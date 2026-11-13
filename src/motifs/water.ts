import { scumble } from '../brushwork.ts'
import { mix, vary, type ColorLike } from '../color.ts'
import { clamp, curve, lerp } from '../math.ts'
import type { Mask, Painter } from '../painter.ts'

export type SeaOpts = {
  horizon: number
  /** Lowest y the sea needs to reach (it is hidden behind the land below). */
  bottom: number
  deep: ColorLike
  mid: ColorLike
  light: ColorLike
  /** Pale haze band right at the horizon. */
  haze: ColorLike
  foam: ColorLike
}

/** Open sea: dark band with horizontal chop, a pale horizon haze and flecks of foam. */
export function sea(p: Painter, o: SeaOpts): Mask {
  const rng = p.rng
  const m = p.maskFn((_x, y) => clamp(y - o.horizon + 0.5) * clamp(o.bottom - y + 1))
  const depth = (y: number) => clamp((y - o.horizon) / (o.bottom - o.horizon))
  p.fill(m, { color: o.mid, color2: o.deep, streak: 0.5, load: 1, angle: 0, bristle: 2 })
  // horizontal chop, getting bigger toward the viewer
  scumble(p, {
    region: m,
    clip: m,
    count: Math.round((p.w * (o.bottom - o.horizon)) / 120),
    color: (_x, y, r) => vary(r, r.weighted([[o.deep, 3], [o.mid, 2], [o.light, 1.2]]), 0.015, 0.003),
    angle: 0,
    jitter: 0.02,
    length: (_x, y) => [lerp(20, 60, depth(y)), lerp(80, 220, depth(y))],
    width: (_x, y) => [lerp(1.5, 4, depth(y)), lerp(3, 9, depth(y))],
    load: [0.5, 0.9],
    curl: [-0.03, 0.03],
    dryEnd: 0.4,
    edgeDry: 0.4,
    grain: 0.45,
    rough: 0.3,
  })
  // pale haze along the horizon
  for (let i = 0; i < p.w / 18; i++) {
    const x = rng.range(-50, p.w)
    const y = o.horizon + rng.range(0, 6)
    p.stroke(curve(x, y, rng.gauss(0, 0.004), rng.range(60, 240), 0, 3), {
      color: vary(rng, mix(o.haze, o.light, rng.next() * 0.4), 0.015, 0.003),
      width: rng.range(2, 5),
      load: rng.range(0.4, 0.8),
      dryEnd: 0.5,
      grain: 0.5,
      clip: m,
    })
  }
  // foam flecks
  for (let i = 0; i < (p.w * (o.bottom - o.horizon)) / 1500; i++) {
    const x = rng.range(0, p.w)
    const y = rng.range(o.horizon + 4, o.bottom)
    const dz = depth(y)
    p.stroke(curve(x, y, rng.gauss(0, 0.05), lerp(4, 18, dz) * rng.range(0.6, 1.4), 0, 2), {
      color: vary(rng, o.foam, 0.02, 0.003),
      width: lerp(1.2, 3, dz),
      load: rng.range(0.5, 0.9),
      grain: 0.5,
      clip: m,
    })
  }
  return m
}

export type ReflectOpts = {
  /** y of the waterline the scene above is mirrored about. */
  waterline: number
  region: Mask
  water: ColorLike
  count: number
  /** 0..1 how strongly the mirrored colour shows. */
  strength?: number
  /** Ripple strokes get longer toward the viewer. */
  length?: [number, number]
}

/** Broken horizontal strokes picking up the colours mirrored above the waterline (houses, sky, boats). */
export function reflect(p: Painter, o: ReflectOpts) {
  const rng = p.rng
  const m = o.region
  const strength = o.strength ?? 0.6
  const [la, lb] = o.length ?? [12, 70]
  const span = Math.max(1, m.y1 - o.waterline)
  for (let k = 0, tries = 0; k < o.count && tries < o.count * 10; tries++) {
    const x = rng.range(m.x0, m.x1)
    const y = rng.range(Math.max(m.y0, o.waterline), m.y1)
    if (m.data[Math.floor(y) * p.w + Math.floor(x)] < 0.5) continue
    k++
    const d = (y - o.waterline) / span
    const sy = Math.round(o.waterline - (y - o.waterline) * 1.1)
    const sx = Math.round(x + p.noise.noise(x / 40, y / 6) * 10)
    if (sy < 0 || sx < 0 || sx >= p.w) continue
    const i = (sy * p.w + sx) * 3
    const src: [number, number, number] = [p.px[i], p.px[i + 1], p.px[i + 2]]
    const len = lerp(la, lb, d) * rng.range(0.5, 1.3)
    p.stroke(curve(x - len / 2, y, rng.gauss(0, 0.01), len, 0, 3), {
      color: mix(src, o.water, 0.25 + 0.5 * d * (1 - strength)),
      width: lerp(1.5, 5, d) * rng.range(0.7, 1.3),
      load: rng.range(0.55, 0.95),
      dryEnd: 0.4,
      grain: 0.5,
      rough: 0.3,
      clip: m,
      opacity: strength * (1 - d * 0.5),
    })
  }
}
