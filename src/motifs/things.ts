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
    // drift along the wind, billowing out sideways (perpendicular to the drift) as it goes
    const off = rng.gauss(0, 12 + 50 * t * spread) + p.noise.noise(t * 3, 9) * 30 * t
    const x = from[0] + Math.cos(o.wind) * o.length * t - Math.sin(o.wind) * off
    const y = from[1] + Math.sin(o.wind) * o.length * t + Math.cos(o.wind) * off - 40 * Math.sin(t * Math.PI * 0.5) * Math.abs(Math.cos(o.wind))
    const len = lerp(20, 140, t) * rng.range(0.6, 1.2)
    p.stroke(curve(x - (Math.cos(o.wind) * len) / 2, y - (Math.sin(o.wind) * len) / 2, o.wind + rng.gauss(0, 0.1), len, rng.gauss(0, 0.15), 4), {
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

/** Festival bunting: paper flags hanging from a sagging string. */
export function bunting(p: Painter, a: Pt, b: Pt, o: { sag: number; size: number; colors: ColorLike[]; string: ColorLike }) {
  const rng = p.rng
  const at = sagLine(a, b, o.sag)
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const n = Math.max(2, Math.floor(len / (o.size * 1.25)))
  const pts: Pt[] = []
  for (let i = 0; i <= 30; i++) pts.push(at(i / 30))
  for (let i = 0; i < n; i++) {
    const t0 = (i + 0.12) / n
    const t1 = (i + 0.88) / n
    const p0 = at(t0)
    const p1 = at(t1)
    const mid = at((t0 + t1) / 2)
    const swing = rng.gauss(0, 0.12)
    const tip: Pt = [mid[0] + Math.sin(swing) * o.size, mid[1] + Math.cos(swing) * o.size]
    const flag = p.polygon([p0, p1, tip], 0.5)
    const c = o.colors[i % o.colors.length]
    p.shape(flag, { color: c, shadow: adjust(c, -0.1), lightAngle: -0.6, depth: o.size * 0.25, angle: Math.PI / 2 })
  }
  p.line(pts, { color: o.string, width: 1.6, wobble: 0.3 })
}

/** Street sardine grill: charcoal brazier on legs, glowing coals, a row of sardines. Returns where the smoke rises. */
export function grill(p: Painter, x: number, y: number, w: number, ink: ColorLike): Pt {
  const h = w * 0.35
  for (const dx of [-0.42, 0.42]) p.line([[x + dx * w, y - h], [x + dx * w * 1.05, y]], { color: ink, width: w * 0.025, wobble: 0.3 })
  const box: Pt[] = [
    [x - w / 2, y - h],
    [x + w / 2, y - h],
    [x + w * 0.46, y - h * 1.6],
    [x - w * 0.46, y - h * 1.6],
  ]
  const m = p.polygon(box, 0.6)
  p.shape(m, { color: '#4a4746', shadow: '#2c2a2a', light: '#77716c', lightAngle: -0.6, depth: w * 0.08, angle: 0 })
  p.line([...box, box[0]], { color: ink, width: 2, wobble: 0.5 })
  // coals glowing through the grate
  for (let k = 0; k < 18; k++) {
    const cx = x + p.rng.range(-0.42, 0.42) * w
    p.stroke([[cx, y - h * 1.62], [cx + w * 0.04, y - h * 1.6]], { color: p.rng.pick(['#f0703a', '#f6b04a', '#d4442f']), width: w * 0.03, load: 0.9 })
  }
  for (let k = 0; k <= 6; k++) p.line([[x - w * 0.46, y - h * 1.6 - k * 2], [x + w * 0.46, y - h * 1.6 - k * 2]], { color: '#2a2828', width: 1, opacity: 0.6, wobble: 0 })
  return [x, y - h * 1.7]
}

export type FlagOpts = {
  /** Where the flag's top corner meets the pole. */
  at: Pt
  w: number
  h: number
  /** 1 flies to the right, -1 to the left. */
  dir?: 1 | -1
  /** Wave strength (0..1) and phase. */
  wave?: number
  phase?: number
  light: number
  ink: ColorLike
}

/** Portuguese flag in the wind: green hoist, red fly, armillary sphere and shield on the seam. */
export function portugueseFlag(p: Painter, o: FlagOpts) {
  const dir = o.dir ?? 1
  const wave = o.wave ?? 0.5
  const ph = o.phase ?? 0.6
  // cloth surface: u along the fly (0 at the pole), v down; ripples grow toward the free edge
  const S = (u: number, v: number): Pt => {
    const ripple = Math.sin(u * Math.PI * 2.2 + ph) * o.h * 0.12 * wave * u
    const squeeze = 1 - 0.06 * wave * Math.abs(Math.cos(u * Math.PI * 2.2 + ph)) * u
    return [o.at[0] + dir * u * o.w * squeeze, o.at[1] + v * o.h + ripple + v * u * o.h * 0.05 * wave]
  }
  const region = (u0: number, u1: number): Pt[] => {
    const pts: Pt[] = []
    for (let k = 0; k <= 12; k++) pts.push(S(u0 + ((u1 - u0) * k) / 12, 0))
    for (let k = 12; k >= 0; k--) pts.push(S(u0 + ((u1 - u0) * k) / 12, 1))
    return pts
  }
  const green = p.polygon(region(0, 0.4), 0.4)
  p.shape(green, { color: '#1f6b3a', shadow: '#154d29', light: '#2f8a4c', lightAngle: o.light, depth: o.h * 0.15 })
  const red = p.polygon(region(0.4, 1), 0.4)
  p.shape(red, { color: '#d22b2b', shadow: '#9e1d22', light: '#e8524a', lightAngle: o.light, depth: o.h * 0.15 })
  // folds: shade the troughs of the ripple
  for (let k = 0; k < 14; k++) {
    const u = (k + 0.5) / 14
    const slope = Math.cos(u * Math.PI * 2.2 + ph)
    if (slope > -0.2) continue
    p.stroke([S(u, 0.02), S(u, 0.98)], { color: '#2a1416', width: o.w * 0.05, load: 0.7, blend: 'multiply', opacity: 0.25 * -slope, clip: u < 0.4 ? green : red })
  }
  // armillary sphere: golden rings around a shield
  const [cx, cy] = S(0.4, 0.5)
  const r = o.h * 0.27
  p.line(
    Array.from({ length: 25 }, (_, k) => [cx + Math.cos((k / 24) * Math.PI * 2) * r, cy + Math.sin((k / 24) * Math.PI * 2) * r] as Pt),
    { color: '#f2c230', width: Math.max(2, r * 0.14), wobble: 0.2, load: 0.95 },
  )
  for (const tilt of [-0.45, 0.45])
    p.line(
      Array.from({ length: 25 }, (_, k) => {
        const a = (k / 24) * Math.PI * 2
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.32 + Math.cos(a) * r * tilt] as Pt
      }),
      { color: '#f2c230', width: Math.max(1.4, r * 0.09), wobble: 0.2, load: 0.95 },
    )
  // shield: red border, white field, five blue escutcheons
  const sw = r * 0.62
  const shield = (k: number, c: ColorLike) => {
    const m = p.blob([
      [cx - sw * k, cy - sw * 0.9 * k],
      [cx + sw * k, cy - sw * 0.9 * k],
      [cx + sw * k, cy + sw * 0.3 * k],
      [cx, cy + sw * 1.05 * k],
      [cx - sw * k, cy + sw * 0.3 * k],
    ])
    p.fill(m, { color: c, load: 1 })
  }
  shield(1, '#c8202a')
  shield(0.68, '#f6f1e4')
  for (const [dx, dy] of [
    [0, -0.35],
    [-0.3, 0],
    [0, 0],
    [0.3, 0],
    [0, 0.35],
  ])
    p.fill(
      p.mask((ctx) => {
        ctx.beginPath()
        ctx.ellipse(cx + dx * sw, cy + dy * sw, sw * 0.1, sw * 0.12, 0, 0, Math.PI * 2)
        ctx.fill()
      }),
      { color: '#2b4fa0', load: 1 },
    )
  // a light ink edge so it sits with the other hand-drawn bits
  p.line([...region(0, 1), S(0, 0)], { color: o.ink, width: Math.max(1.3, o.h * 0.015), wobble: 0.4, load: 0.8, opacity: 0.8 })
}

/** Flagpole with a gilt finial, from base up to top. */
export function flagpole(p: Painter, base: Pt, top: Pt, width: number, ink: ColorLike) {
  p.stroke([base, top], { color: '#e9e6df', width, load: 0.95, taper: [0, 0], smooth: false })
  p.line([base, top], { color: ink, width: Math.max(1.2, width * 0.18), wobble: 0.3, opacity: 0.6 })
  const ball = p.mask((ctx) => {
    ctx.beginPath()
    ctx.arc(top[0], top[1] - width * 0.6, width * 0.9, 0, Math.PI * 2)
    ctx.fill()
  })
  p.shape(ball, { color: '#e8b83a', shadow: '#b8862a', light: '#f8de8a', lightAngle: -2.4, depth: width * 0.5 })
}
