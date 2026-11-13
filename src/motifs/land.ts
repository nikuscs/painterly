import { scumble } from '../brushwork.ts'
import { adjust, mix, vary, type ColorLike } from '../color.ts'
import { clamp, curve, lerp, type Pt } from '../math.ts'
import type { Mask, Painter } from '../painter.ts'

export type GroundOpts = {
  /** y of the ground's top edge at x. */
  ridge: (x: number) => number
  /** Main ground colour and a lighter one streaked through it. */
  base: ColorLike
  base2: ColorLike
  /** Colours for the broad brushwork patches. */
  patches: ColorLike[]
  /** Hazy colour the ground fades to at the ridge. */
  haze: ColorLike
  /** Direction of the brush strokes on the ground. */
  angle: number
}

/** Ground mass below a ridge line: textured base, then broad patches that grow with depth. */
export function ground(p: Painter, o: GroundOpts): Mask {
  const m = p.maskFn((x, y) => {
    const r = o.ridge(x) + p.noise.noise(x / 30, 3.3) * 2
    return clamp(y - r + 0.5)
  })
  const top = m.y0
  const depth = (y: number) => clamp((y - top) / (p.h - top))
  p.fill(m, { color: o.base, color2: o.base2, streak: 0.45, load: 1, angle: o.angle, bristle: 2 })
  scumble(p, {
    region: m,
    clip: m,
    count: Math.round((p.w * (p.h - top)) / 700),
    color: (_x, y, r) => vary(r, mix(r.pick(o.patches), o.haze, (1 - depth(y)) ** 3 * 0.6), 0.02, 0.004),
    angle: (x, y) => o.angle + p.noise.noise(x / 400, y / 300) * 0.15,
    jitter: 0.08,
    length: (_x, y) => [lerp(40, 120, depth(y)), lerp(120, 360, depth(y))],
    width: (_x, y) => [lerp(4, 14, depth(y)), lerp(10, 40, depth(y))],
    load: [0.35, 0.75],
    curl: [-0.2, 0.2],
    dryEnd: 0.5,
    edgeDry: 0.5,
    grain: 0.5,
    rough: 0.4,
  })
  return m
}

export type TrailOpts = {
  /** Centre line of the trail from near (wide) to far (thin). */
  spine: Pt[]
  width: [number, number]
  colors: ColorLike[]
  clip?: Mask
}

/** A worn sandy track: dense light strokes along a tapering band. Returns the band's mask. */
export function trail(p: Painter, o: TrailOpts): Mask {
  const rng = p.rng
  const pts = o.spine
  let total = 0
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push((total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])))
  const at = (s: number): [Pt, number, number] => {
    let i = 1
    while (i < pts.length - 1 && cum[i] < s) i++
    const t = clamp((s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1))
    const a = pts[i - 1]
    const b = pts[i]
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
    return [[lerp(a[0], b[0], t), lerp(a[1], b[1], t)], ang, lerp(o.width[0], o.width[1], s / total)]
  }
  const count = Math.round(total / 1.5)
  for (let k = 0; k < count; k++) {
    const s = rng.range(0, total)
    const [[x, y], ang, w] = at(s)
    const off = rng.gauss(0, w * 0.28)
    const nx = -Math.sin(ang)
    const ny = Math.cos(ang)
    const len = rng.range(0.8, 2.5) * w
    const a = ang + rng.gauss(0, 0.06)
    const sx = x + nx * off - (Math.cos(a) * len) / 2
    const sy = y + ny * off - (Math.sin(a) * len) / 2
    const edge = Math.abs(off) / (w * 0.5)
    p.stroke(curve(sx, sy, a, len, rng.gauss(0, 0.1), 4), {
      color: vary(rng, rng.pick(o.colors), 0.02, 0.004),
      width: rng.range(0.12, 0.3) * w,
      load: clamp(rng.range(0.45, 0.9) - edge * 0.35, 0.15, 1),
      dryEnd: 0.5,
      edgeDry: 0.6,
      grain: 0.55,
      rough: 0.45,
      clip: o.clip,
    })
  }
  const left: Pt[] = []
  const right: Pt[] = []
  for (let k = 0; k <= 40; k++) {
    const [[x, y], ang, w] = at((total * k) / 40)
    const nx = -Math.sin(ang) * w * 0.4
    const ny = Math.cos(ang) * w * 0.4
    left.push([x + nx, y + ny])
    right.push([x - nx, y - ny])
  }
  return p.polygon([...left, ...right.reverse()], 4)
}

export type GrassOpts = {
  region: Mask
  count: number
  /** [colour, weight] pairs. */
  colors: [ColorLike, number][]
  /** Lean of the blades in radians away from vertical (positive leans right). */
  lean: number
  /** Blade length at the far and near edge of the region. */
  length: [number, number]
  /** Blade width at the far and near edge. */
  width: [number, number]
  /** Density at the far vs near edge (0..1). */
  falloff?: [number, number]
  /** Extra density multiplier, e.g. thinner on a path. */
  density?: (x: number, y: number) => number
  clip?: Mask
}

/** Wind-bent grass blades with perspective: short and fine far away, long and thick up close. */
export function grass(p: Painter, o: GrassOpts) {
  const rng = p.rng
  const m = o.region
  const [fa, fb] = o.falloff ?? [0.6, 1]
  const depth = (y: number) => clamp((y - m.y0) / (m.y1 - m.y0 || 1))
  let placed = 0
  for (let tries = 0; placed < o.count && tries < o.count * 20; tries++) {
    const x = rng.range(m.x0, m.x1)
    const y = rng.range(m.y0, m.y1)
    const dz = depth(y)
    if (rng.next() > m.data[Math.floor(y) * p.w + Math.floor(x)] * lerp(fa, fb, dz) * (o.density ? o.density(x, y) : 1)) continue
    placed++
    const z = dz ** 1.4
    const len = lerp(o.length[0], o.length[1], z) * rng.range(0.5, 1.2)
    const gust = p.noise.noise(x / 250, y / 250) * 0.35
    const ang = -Math.PI / 2 + o.lean + gust + rng.gauss(0, 0.3)
    const curl = (o.lean > 0 ? 1 : -1) * rng.range(0.3, 1.4)
    const steps = 6
    p.stroke(curve(x, y, ang, len, curl, steps), {
      color: vary(rng, rng.weighted(o.colors), 0.025, 0.005),
      width: lerp(o.width[0], o.width[1], z) * rng.range(0.6, 1.3),
      taper: [0.05, 0.85],
      load: rng.range(0.7, 1),
      dryEnd: 0.3,
      edgeDry: 0.2,
      grain: 0.4,
      rough: 0.15,
      soft: 0.08,
      clip: o.clip,
    })
  }
}

/** Soft cast shadow on the ground: many thin, faint, multiplied strokes stretching along `angle`. */
export function castShadow(p: Painter, x: number, y: number, w: number, color: ColorLike, angle = 0) {
  for (let i = 0; i < 14; i++) {
    const len = w * p.rng.range(0.45, 1)
    const cy = y + p.rng.gauss(0, w * 0.025)
    p.stroke(curve(x - len / 2, cy, angle + p.rng.gauss(0, 0.03), len, 0, 3), {
      color,
      width: w * p.rng.range(0.03, 0.07),
      load: 0.8,
      grain: 0.3,
      dryEnd: 0.4,
      taper: [0.3, 0.4],
      blend: 'multiply',
      opacity: 0.22,
    })
  }
}

export type CalcadaOpts = {
  region: Mask
  /** Direction the wave rows run along (radians). */
  angle: number
  light: ColorLike
  dark: ColorLike
  /** Distance between wave rows and the wave length, px. */
  spacing: number
  period: number
  /** Keep the waves out of these spots (e.g. under a caption). */
  avoid?: (x: number, y: number) => boolean
}

/** Portuguese pavement: pale limestone setts with rolling bands of dark basalt. */
export function calcada(p: Painter, o: CalcadaOpts) {
  const rng = p.rng
  const m = o.region
  p.fill(m, { color: o.light, color2: adjust(o.light, -0.04), streak: 0.5, angle: o.angle, load: 1 })
  const ca = Math.cos(o.angle)
  const sa = Math.sin(o.angle)
  // wave bands, in pavement coordinates (u along, v across)
  const cx = (m.x0 + m.x1) / 2
  const cy = (m.y0 + m.y1) / 2
  const R = Math.hypot(m.x1 - m.x0, m.y1 - m.y0) / 2 + o.period
  const avoid = o.avoid
  const waveClip = avoid ? p.maskFn((x, y) => (avoid(x, y) ? 0 : m.data[y * p.w + x]), [m.x0, m.y0, m.x1, m.y1]) : m
  for (let v = -R; v < R; v += o.spacing) {
    const pts: Pt[] = []
    for (let u = -R; u <= R; u += o.period / 12) {
      const w = Math.sin((u / o.period) * Math.PI * 2) * o.spacing * 0.18
      pts.push([cx + ca * u - sa * (v + w), cy + sa * u + ca * (v + w)])
    }
    p.stroke(pts, { color: o.dark, width: o.spacing * 0.15, load: 0.8, grain: 0.6, rough: 0.4, taper: [0, 0], clip: waveClip, smooth: false })
  }
  // individual setts: tiny square-ish dabs breaking up both colours
  const count = Math.round(((m.x1 - m.x0) * (m.y1 - m.y0)) / 60)
  for (let k = 0; k < count; k++) {
    const x = rng.range(m.x0, m.x1)
    const y = rng.range(m.y0, m.y1)
    if (m.data[Math.floor(y) * p.w + Math.floor(x)] < 0.5) continue
    const s = rng.range(3, 6)
    const i = (Math.floor(y) * p.w + Math.floor(x)) * 3
    const under: [number, number, number] = [p.px[i], p.px[i + 1], p.px[i + 2]]
    p.stroke(
      [
        [x - s / 2, y],
        [x + s / 2, y + rng.gauss(0, 0.5)],
      ],
      { color: adjust(under, rng.range(-0.05, 0.04)), width: s, load: 0.8, grain: 0.5, taper: [0, 0], clip: m },
    )
  }
}
