import { scumble } from '../brushwork.ts'
import { adjust, mix, vary, type ColorLike } from '../color.ts'
import { clamp, curve, lerp, smoothstep, type Pt } from '../math.ts'
import type { Mask, Painter } from '../painter.ts'

const poly = (p: Painter, pts: Pt[], ragged = 1.2) => p.polygon(pts, ragged)

/** Paint a mask solid-ish, then work brush strokes over it in a direction. */
export function block(
  p: Painter,
  m: Mask,
  o: { color: ColorLike; dark?: ColorLike; light?: ColorLike; angle: number; size: number; shade?: (x: number, y: number) => number },
) {
  p.fill(m, { color: o.color, color2: o.light ?? adjust(o.color, 0.03), streak: 0.35, load: 1, angle: o.angle, bristle: 1.5 })
  const area = (m.x1 - m.x0) * (m.y1 - m.y0)
  scumble(p, {
    region: m,
    clip: m,
    count: Math.round(area / (o.size * o.size * 3)),
    color: (x, y, r) => {
      const s = o.shade ? o.shade(x, y) : r.next()
      const c = s > 0.6 && o.dark ? mix(o.color, o.dark, (s - 0.6) * 2) : s < 0.3 && o.light ? mix(o.color, o.light, (0.3 - s) * 2.5) : o.color
      return vary(r, c, 0.02, 0.004)
    },
    angle: o.angle,
    jitter: 0.05,
    length: [o.size * 1.5, o.size * 5],
    width: [o.size * 0.3, o.size * 0.8],
    load: [0.45, 0.85],
    dryEnd: 0.5,
    edgeDry: 0.4,
    grain: 0.5,
    rough: 0.3,
  })
}

export type CottageOpts = {
  /** Bottom-left corner of the front wall. */
  x: number
  y: number
  /** Front wall width/height. */
  w: number
  h: number
  /** Gable end depth (seen on the right, in shadow). */
  depth: number
  roofH: number
  wall: ColorLike
  wallShade: ColorLike
  roof: ColorLike
  trim: ColorLike
  door: ColorLike
  windows: number
}

/** Whitewashed cottage: lit front wall, shadowed gable, slate roof, chimneys, deep-set windows. */
export function cottage(p: Painter, o: CottageOpts): Pt[] {
  const { x, y, w, h, depth: d, roofH } = o
  const top = y - h
  const skew = d * 0.35 // gable recedes up-right a little
  const ink = adjust(o.roof, -0.12)
  // gable end (shadow side)
  const gable: Pt[] = [
    [x + w, y],
    [x + w + d, y - skew],
    [x + w + d, top - skew],
    [x + w + d / 2, top - skew / 2 - roofH * 0.95],
    [x + w, top],
  ]
  block(p, poly(p, gable), { color: o.wallShade, dark: adjust(o.wallShade, -0.06), light: adjust(o.wallShade, 0.03), angle: -Math.PI / 2, size: 9 })
  // front wall
  const front = poly(p, [
    [x, y],
    [x + w, y],
    [x + w, top],
    [x, top],
  ])
  block(p, front, {
    color: o.wall,
    dark: o.wallShade,
    light: adjust(o.wall, 0.03),
    angle: -Math.PI / 2,
    size: 10,
    shade: (_x, yy) => 0.3 + 0.55 * smoothstep(top + 30, top, yy),
  })
  // roof: front slope as a trapezoid, overhanging
  const ov = 14
  const roofPts: Pt[] = [
    [x - ov, top + 6],
    [x + w + ov * 0.6, top + 6],
    [x + w + d / 2, top - skew / 2 - roofH],
    [x + d * 0.2, top - roofH - 2],
  ]
  block(p, poly(p, roofPts, 1.5), { color: o.roof, dark: adjust(o.roof, -0.05), light: adjust(o.roof, 0.07), angle: 0.02, size: 9 })
  // slate courses
  for (let i = 1; i < 6; i++) {
    const t = i / 6
    const a: Pt = [lerp(x - ov, x + d * 0.2, t), lerp(top + 6, top - roofH - 2, t)]
    const b: Pt = [lerp(x + w + ov * 0.6, x + w + d / 2, t), lerp(top + 6, top - skew / 2 - roofH, t)]
    p.line([a, b], { color: adjust(o.roof, -0.06), width: 1.6, opacity: 0.6, load: 0.6 })
  }
  // eave shadow on the wall
  p.stroke(
    [
      [x, top + 10],
      [x + w, top + 10],
    ],
    { color: o.wallShade, width: 12, load: 0.7, grain: 0.6, taper: [0.02, 0.02], blend: 'multiply', opacity: 0.6 },
  )
  // chimneys
  const chimneys: Pt[] = []
  for (const cx of [x + d * 0.2 + 14, x + w + d / 2 - 34]) {
    const cy = cx < x + w / 2 ? top - roofH - 2 : top - skew / 2 - roofH
    const ch = poly(p, [
      [cx - 16, cy + 8],
      [cx + 16, cy + 8],
      [cx + 15, cy - 46],
      [cx - 15, cy - 46],
    ])
    block(p, ch, { color: o.wall, dark: o.wallShade, angle: -Math.PI / 2, size: 6, shade: (xx) => (xx > cx + 4 ? 0.9 : 0.3) })
    p.stroke(
      [
        [cx - 18, cy - 46],
        [cx + 18, cy - 46],
      ],
      { color: ink, width: 7, load: 0.85, taper: [0, 0] },
    )
    chimneys.push([cx, cy - 50])
  }
  // windows and door
  const slots = o.windows + 1
  const doorAt = Math.floor(slots / 2)
  for (let i = 0; i < slots; i++) {
    const cx = x + (w * (i + 0.5)) / slots
    if (i === doorAt) {
      const dw = w * 0.11
      const dh = h * 0.62
      const door = poly(p, [
        [cx - dw / 2, y],
        [cx + dw / 2, y],
        [cx + dw / 2, y - dh],
        [cx - dw / 2, y - dh],
      ])
      block(p, door, { color: o.door, dark: adjust(o.door, -0.08), angle: -Math.PI / 2, size: 5 })
      p.line(
        [
          [cx - dw / 2 - 2, y - dh - 3],
          [cx + dw / 2 + 2, y - dh - 3],
        ],
        { color: o.trim, width: 4 },
      )
      continue
    }
    const ww = w * 0.1
    const wh = h * 0.36
    const wy = y - h * 0.52
    const glass = poly(p, [
      [cx - ww / 2, wy + wh / 2],
      [cx + ww / 2, wy + wh / 2],
      [cx + ww / 2, wy - wh / 2],
      [cx - ww / 2, wy - wh / 2],
    ])
    block(p, glass, { color: '#3b4249', dark: '#2c3238', light: '#59626b', angle: -0.6, size: 4 })
    p.line(
      [
        [cx, wy - wh / 2],
        [cx, wy + wh / 2],
      ],
      { color: o.trim, width: 3, wobble: 0.4 },
    )
    p.line(
      [
        [cx - ww / 2, wy],
        [cx + ww / 2, wy],
      ],
      { color: o.trim, width: 3, wobble: 0.4 },
    )
    // sill
    p.stroke(
      [
        [cx - ww / 2 - 5, wy + wh / 2 + 3],
        [cx + ww / 2 + 5, wy + wh / 2 + 3],
      ],
      { color: o.wall, width: 5, load: 0.9, taper: [0, 0] },
    )
  }
  return chimneys
}

/** Chimney smoke torn sideways by the wind. */
export function smoke(p: Painter, from: Pt, o: { wind: number; length: number; color: ColorLike; spread?: number }) {
  const rng = p.rng
  const spread = o.spread ?? 0.25
  for (let i = 0; i < 160; i++) {
    const t = rng.next() ** 1.6
    const x = from[0] + Math.cos(o.wind) * o.length * t + p.noise.noise(t * 3, 9) * 30 * t
    const y = from[1] + Math.sin(o.wind) * o.length * t - 40 * Math.sin(t * Math.PI * 0.5) + rng.gauss(0, 12 + 50 * t * spread)
    const len = lerp(20, 140, t) * rng.range(0.6, 1.2)
    p.stroke(curve(x - len / 2, y, o.wind + rng.gauss(0, 0.1), len, rng.gauss(0, 0.15), 4), {
      color: vary(rng, o.color, 0.02, 0.003),
      width: lerp(10, 30, t) * rng.range(0.6, 1.2),
      load: lerp(0.95, 0.35, t),
      dryEnd: 0.5,
      edgeDry: 0.5,
      grain: 0.55,
      rough: 0.5,
      opacity: lerp(1, 0.7, t),
    })
  }
}

/** A weathered wooden post. */
export function post(p: Painter, x: number, top: number, bottom: number, w: number, color: ColorLike) {
  const rng = p.rng
  for (let i = 0; i < 5; i++) {
    const ox = (i / 4 - 0.5) * w * 0.6
    p.stroke(
      [
        [x + ox + rng.gauss(0, 0.6), bottom],
        [x + ox * 0.95 + rng.gauss(0, 0.6), (top + bottom) / 2],
        [x + ox * 0.9 + rng.gauss(0, 0.6), top],
      ],
      {
        color: vary(rng, i < 2 ? adjust(color, 0.06) : i > 3 ? adjust(color, -0.06) : color, 0.02, 0.004),
        width: w * (i === 2 ? 0.8 : 0.45),
        load: 0.9,
        taper: [0.01, 0.01],
        grain: 0.4,
        rough: 0.2,
        smooth: false,
      },
    )
  }
}

/** Sagging line between two points; returns a sampler t → point on the line. */
export function sagLine(a: Pt, b: Pt, sag: number) {
  return (t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t) + 4 * sag * t * (1 - t)]
}

export type ClothOpts = {
  /** Where on the line it is pegged (t from..to). */
  line: (t: number) => Pt
  from: number
  to: number
  /** Hanging length. */
  drop: number
  /** How far the wind blows the free edge sideways (px) and lifts it (0..1). */
  blow: number
  lift?: number
  color: ColorLike
  shade: ColorLike
  light: ColorLike
  /** Optional stripes: [colour, count]. */
  stripes?: [ColorLike, number]
  /** Sweep direction of folds (radians). */
  flow?: number
  pegs?: ColorLike
}

/** A sheet or towel pegged on a line, bellying in the wind, with long soft folds. */
export function cloth(p: Painter, o: ClothOpts) {
  const rng = p.rng
  const n = p.noise
  const top: Pt[] = []
  const N = 14
  for (let i = 0; i <= N; i++) top.push(o.line(lerp(o.from, o.to, i / N)))
  const lift = o.lift ?? 0.25
  const seed = rng.range(0, 100)
  // free edge: blown downwind and lifted, rippling
  const bottom: Pt[] = top.map(([x, y], i) => {
    const t = i / N
    const ripple = Math.sin(t * Math.PI * 2.5 + seed) * o.drop * 0.06 + n.noise(t * 3, seed) * o.drop * 0.05
    return [x + o.blow * (0.7 + 0.3 * t), y + o.drop * (1 - lift * (0.6 + 0.4 * t)) + ripple]
  })
  // sides bow outward with the wind
  const side = (a: Pt, b: Pt, bow: number): Pt[] => {
    const out: Pt[] = []
    for (let i = 1; i < 6; i++) {
      const t = i / 6
      out.push([lerp(a[0], b[0], t) + Math.sin(t * Math.PI) * bow, lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * bow * 0.15])
    }
    return out
  }
  const outline: Pt[] = [
    ...top,
    ...side(top[N], bottom[N], o.blow * 0.35),
    ...bottom.slice().reverse(),
    ...side(bottom[0], top[0], -o.blow * 0.15),
  ]
  const m = p.polygon(outline, 1)
  const flow = o.flow ?? Math.atan2(o.drop, o.blow)
  const fc = Math.cos(flow)
  const fs = Math.sin(flow)
  // Folds: bands running along the flow direction.
  const fold = (x: number, y: number) => {
    const across = -x * fs + y * fc
    return 0.5 + 0.5 * Math.sin(across / (o.drop * 0.09) + n.noise(x / 120, y / 120) * 2.2)
  }
  const span = Math.hypot(top[N][0] - top[0][0], top[N][1] - top[0][1])
  const tone = (x: number, y: number) => {
    const along = (x - top[0][0]) / Math.max(1, span)
    return clamp(fold(x, y) * 0.75 + along * 0.35 - 0.1)
  }
  p.fill(m, { color: o.color, color2: o.light, streak: 0.3, load: 1, angle: flow, bristle: 1.6 })
  scumble(p, {
    region: m,
    clip: m,
    count: Math.round(((m.x1 - m.x0) * (m.y1 - m.y0)) / 260),
    color: (x, y, r) => {
      const t = tone(x, y)
      const c = t > 0.55 ? mix(o.color, o.shade, smoothstep(0.55, 0.95, t)) : mix(o.color, o.light, smoothstep(0.4, 0.1, t))
      return vary(r, c, 0.012, 0.003)
    },
    angle: flow,
    jitter: 0.12,
    length: [o.drop * 0.15, o.drop * 0.5],
    width: [3, Math.max(5, o.drop * 0.06)],
    load: [0.5, 0.9],
    curl: [-0.25, 0.25],
    dryEnd: 0.5,
    edgeDry: 0.4,
    grain: 0.5,
    rough: 0.35,
  })
  if (o.stripes) {
    const [sc, count] = o.stripes
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count
      const pts = top.map(([x, y], i) => {
        const b = bottom[i]
        return [lerp(x, b[0], t), lerp(y, b[1], t)] as Pt
      })
      p.stroke(pts, { color: sc, width: o.drop * 0.05, load: 0.8, grain: 0.5, taper: [0.02, 0.02], clip: m })
    }
  }
  // pencil outline, lightly
  p.line([...outline, outline[0]], { color: mix(o.shade, '#3a3f45', 0.5), width: 1.4, opacity: 0.55, load: 0.6, wobble: 0.6 })
  // pegs
  for (const t of [0.02, 0.5, 0.98]) {
    const [px, py] = top[Math.round(t * N)]
    p.stroke(
      [
        [px, py - 7],
        [px + 1, py + 9],
      ],
      { color: o.pegs ?? '#8a6f52', width: 4, load: 0.95, taper: [0, 0.2] },
    )
  }
  return m
}

/** Little "m" gulls. */
export function gull(p: Painter, x: number, y: number, s: number, color: ColorLike) {
  const flap = p.rng.range(-0.3, 0.3)
  p.stroke(
    [
      [x - s, y - s * (0.1 + flap)],
      [x - s * 0.45, y - s * 0.38],
      [x, y],
    ],
    { color, width: Math.max(1.6, s * 0.12), load: 0.9, taper: [0.3, 0.05] },
  )
  p.stroke(
    [
      [x, y],
      [x + s * 0.5, y - s * 0.42],
      [x + s * 1.05, y - s * (0.15 - flap)],
    ],
    { color, width: Math.max(1.6, s * 0.12), load: 0.9, taper: [0.05, 0.3] },
  )
}

/** Wicker basket seen from the side. */
export function basket(p: Painter, x: number, y: number, w: number, h: number, color: ColorLike, fill: ColorLike) {
  const body = p.polygon([
    [x - w / 2, y - h],
    [x + w / 2, y - h],
    [x + w * 0.42, y],
    [x - w * 0.42, y],
  ])
  p.fill(body, { color, color2: adjust(color, -0.08), streak: 0.5, angle: 0, load: 1 })
  for (let i = 0; i < 6; i++) {
    const yy = y - h + (h * (i + 0.5)) / 6
    p.line(
      [
        [x - w / 2, yy],
        [x + w / 2, yy],
      ],
      { color: adjust(color, -0.12), width: 1.8, clip: body, opacity: 0.8 },
    )
  }
  // folded laundry peeking out
  p.stroke(
    [
      [x - w * 0.4, y - h - 2],
      [x - w * 0.1, y - h - h * 0.3],
      [x + w * 0.3, y - h - h * 0.15],
    ],
    { color: fill, width: h * 0.35, load: 0.95, taper: [0.2, 0.3] },
  )
  p.stroke(
    [
      [x - w / 2 - 2, y - h],
      [x + w / 2 + 2, y - h],
    ],
    { color: adjust(color, 0.06), width: 6, load: 0.9, taper: [0, 0] },
  )
}
