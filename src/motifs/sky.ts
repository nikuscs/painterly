import { scumble } from '../brushwork.ts'
import { mix, vary, type ColorLike } from '../color.ts'
import { clamp, smoothstep, type Pt } from '../math.ts'
import type { Painter } from '../painter.ts'

export type SkyOpts = {
  /** y where the sky meets the land/sea. */
  horizon: number
  top: ColorLike
  bottom: ColorLike
  /** Colours of the wind-swept scumble strokes. */
  strokes: ColorLike[]
  /** Lighter streak colours laid over the scumble. */
  highlights: ColorLike[]
  /** Wind direction in radians (0 = to the right, negative = rising). */
  wind: number
  density?: number
}

/** Gradient wash plus layers of dry, wind-driven strokes. */
export function sky(p: Painter, o: SkyOpts) {
  const H = o.horizon + 40
  const d = o.density ?? 1
  const n = p.noise
  p.gradient([
    [0, o.top],
    [(o.horizon / p.h) * 0.6, mix(o.top, o.bottom, 0.55)],
    [o.horizon / p.h, o.bottom],
    [1, o.bottom],
  ])
  const angle = (x: number, y: number) => o.wind + n.fbm(x / 900, y / 900, 2) * 0.35
  const gradColor = (y: number) => mix(o.top, o.bottom, clamp(y / o.horizon))

  // Broad underpainting strokes, tinted by height.
  scumble(p, {
    region: (_x, y) => (y < H ? 1 : 0),
    box: [-100, -50, p.w + 100, H],
    count: Math.round(((p.w * H) / 2600) * d),
    color: (x, y, r) => vary(r, mix(gradColor(y), r.pick(o.strokes), 0.55 + 0.3 * n.noise(x / 500, y / 500)), 0.015, 0.0025),
    angle,
    jitter: 0.06,
    length: [140, 520],
    width: [18, 64],
    load: [0.3, 0.7],
    curl: [-0.12, 0.12],
    dryEnd: 0.5,
    edgeDry: 0.6,
    grain: 0.45,
    rough: 0.35,
    taper: [0.2, 0.35],
  })
  // Finer, crisper streaks for the "scratched" crayon look.
  scumble(p, {
    region: (_x, y) => (y < H ? 1 : 0),
    box: [-100, -50, p.w + 100, H],
    count: Math.round(((p.w * H) / 1800) * d),
    color: (x, y, r) => {
      const hi = n.noise(x / 420 + 7, y / 300) > 0.1
      return vary(r, hi ? r.pick(o.highlights) : mix(gradColor(y), r.pick(o.strokes), 0.7), 0.018, 0.0025)
    },
    angle,
    jitter: 0.05,
    length: [60, 260],
    width: [4, 16],
    load: [0.25, 0.6],
    curl: [-0.1, 0.1],
    dryEnd: 0.5,
    edgeDry: 0.5,
    grain: 0.5,
    rough: 0.4,
    opacity: 0.85,
  })
}

export type CloudOpts = {
  /** Path the cloud mass follows, e.g. from its base up into a leaning tower. */
  spine: Pt[]
  /** Billow radius at each spine point (or one radius for all). */
  radius: number | number[]
  light: ColorLike
  shadow: ColorLike
  /** Tint for the deepest shadow (often a muted violet). */
  deep: ColorLike
  /** Sky colour for knocking back edges. */
  sky: ColorLike
  wind: number
  /** Extra billows bubbling off the top side (cauliflower). */
  lumps?: number
  /** y of a flat base, if any. */
  base?: number
  /** 0 = wispy, 1 = dense. */
  body?: number
  density?: number
}

/** Dry-brush cumulus: billows along a spine → shadow, light, and edge-breaking passes. */
export function cloud(p: Painter, o: CloudOpts) {
  const rng = p.rng
  const n = p.noise
  const body = o.body ?? 0.8
  const d = o.density ?? 1
  type Billow = { x: number; y: number; r: number }
  const billows: Billow[] = []
  const radii = o.spine.map((_, i) => (Array.isArray(o.radius) ? o.radius[i] : o.radius))
  for (let i = 0; i < o.spine.length - 1; i++) {
    const [ax, ay] = o.spine[i]
    const [bx, by] = o.spine[i + 1]
    const len = Math.hypot(bx - ax, by - ay)
    const steps = Math.max(1, Math.round(len / (Math.min(radii[i], radii[i + 1]) * 0.6)))
    for (let j = 0; j < steps; j++) {
      const t = j / steps
      const r = (radii[i] + (radii[i + 1] - radii[i]) * t) * rng.range(0.8, 1.1)
      billows.push({ x: ax + (bx - ax) * t + rng.gauss(0, r * 0.2), y: ay + (by - ay) * t + rng.gauss(0, r * 0.2), r })
    }
  }
  const last = o.spine.length - 1
  billows.push({ x: o.spine[last][0], y: o.spine[last][1], r: radii[last] })
  // Cauliflower lumps on the upper side of existing billows.
  for (let i = 0; i < (o.lumps ?? 0); i++) {
    const parent = rng.pick(billows)
    const ang = -Math.PI / 2 + rng.gauss(0, 0.9)
    const r = parent.r * rng.range(0.4, 0.7)
    billows.push({ x: parent.x + Math.cos(ang) * parent.r * 0.9, y: parent.y + Math.sin(ang) * parent.r * 0.85, r })
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of billows) {
    minX = Math.min(minX, b.x - b.r * 1.6)
    minY = Math.min(minY, b.y - b.r * 1.6)
    maxX = Math.max(maxX, b.x + b.r * 1.6)
    maxY = Math.max(maxY, b.y + b.r * 1.6)
  }
  const top = minY
  const height = maxY - minY
  const baseY = o.base ?? Infinity
  const box: [number, number, number, number] = [minX, minY, maxX, maxY]
  const wc = Math.cos(o.wind)
  const ws = Math.sin(o.wind)
  const crumble = (x: number, y: number) => n.fbm(x / 110, y / 110, 3) * 0.28 + n.fbm(x / 24, y / 24, 2) * 0.14
  const flatBase = (y: number) => 1 - smoothstep(baseY - 30, baseY + 30, y)
  const local = (b: Billow, x: number, y: number) => {
    // ellipse stretched along the wind
    const qx = x - b.x
    const qy = y - b.y
    const dx = (qx * wc + qy * ws) / (b.r * 1.35)
    const dy = (-qx * ws + qy * wc) / b.r
    return 1 - Math.sqrt(dx * dx + dy * dy) + crumble(x, y)
  }
  const field = (x: number, y: number) => {
    let v = -1
    for (const b of billows) v = Math.max(v, local(b, x, y))
    return clamp(v * 2.4 * body) * flatBase(y)
  }
  const angle = (x: number, y: number) => o.wind + n.noise(x / 300, y / 300) * 0.3

  // Back billows (higher bottoms) first; front billows paint over them.
  const order = billows.slice().sort((a, b) => a.y + a.r - (b.y + b.r))
  for (const b of order) {
    const R = b.r * 1.5
    const m = p.maskFn(
      (x, y) => smoothstep(0, 0.07, local(b, x, y)) * flatBase(y),
      [Math.floor(b.x - R), Math.floor(b.y - R), Math.ceil(b.x + R), Math.ceil(b.y + R)],
    )
    if (m.x1 < m.x0) continue
    // 0 = lit (upper left), 1 = shadow (lower right). Lower billows sit in more shadow.
    const shade = (x: number, y: number) =>
      clamp(0.4 + 0.65 * ((y - b.y) / b.r) + 0.3 * ((x - b.x) / b.r) + 0.45 * ((b.y - top) / height - 0.5))
    const area = (Math.PI * b.r * b.r) / 1000
    // Shadow body, nearly opaque so this billow occludes the ones behind it.
    scumble(p, {
      region: m,
      clip: m,
      count: Math.round(area * 1.2 * d),
      color: (x, y, r) => vary(r, mix(o.shadow, o.deep, smoothstep(0.65, 1.1, shade(x, y)) * 0.7), 0.012, 0.002),
      angle,
      jitter: 0.25,
      length: [40, 150],
      width: [16, 42],
      load: [0.7, 0.95],
      dryEnd: 0.3,
      edgeDry: 0.3,
      grain: 0.5,
      rough: 0.4,
    })
    // Lit side: creamy, solid in the core, crumbling toward the shadow and the rim.
    scumble(p, {
      region: (x, y) => m.data[Math.floor(y) * p.w + Math.floor(x)] * smoothstep(0.62, 0.4, shade(x, y)),
      box: [m.x0, m.y0, m.x1, m.y1],
      clip: m,
      count: Math.round(area * 2.2 * d),
      color: (x, y, r) => vary(r, mix(o.light, o.shadow, smoothstep(0.1, 0.8, shade(x, y)) * 0.55), 0.01, 0.002),
      angle,
      jitter: 0.2,
      length: [20, 90],
      width: [8, 26],
      load: (x, y) => {
        const s = 1 - smoothstep(0.2, 0.8, shade(x, y))
        return [0.35 + 0.5 * s, 0.55 + 0.45 * s]
      },
      dryEnd: 0.45,
      edgeDry: 0.6,
      grain: 0.6,
      rough: 0.55,
      curl: [-0.4, 0.4],
    })
  }

  const area = ((maxX - minX) * (maxY - minY)) / 2500
  // Long wind-combed streaks of light dragged across the body.
  scumble(p, {
    region: (x, y) => field(x, y) * 0.7,
    box,
    count: Math.round(area * 1.2 * d),
    color: (_x, _y, r) => vary(r, mix(o.light, o.shadow, r.range(0, 0.5)), 0.01, 0.002),
    angle: o.wind,
    jitter: 0.08,
    length: [80, 280],
    width: [4, 12],
    load: [0.25, 0.5],
    dryEnd: 0.6,
    edgeDry: 0.5,
    grain: 0.5,
    rough: 0.4,
  })
  // Crumbs of white flicked off the rim.
  scumble(p, {
    region: (x, y) => {
      const f = field(x, y)
      return smoothstep(0.0, 0.15, f) * smoothstep(0.5, 0.15, f) * 0.7
    },
    box,
    count: Math.round(area * 2.5 * d),
    color: (_x, _y, r) => vary(r, o.light, 0.01, 0.002),
    angle,
    jitter: 0.5,
    length: [8, 36],
    width: [4, 14],
    load: [0.3, 0.6],
    dryEnd: 0.3,
    edgeDry: 0.7,
    grain: 0.75,
    rough: 0.6,
  })
  // Sky colour dragged back over the rim and through the body.
  scumble(p, {
    region: (x, y) => {
      const f = field(x, y)
      return smoothstep(0.0, 0.25, f) * smoothstep(0.8, 0.2, f) * 0.6
    },
    box,
    count: Math.round(area * 1.4 * d),
    color: (_x, _y, r) => vary(r, o.sky, 0.015, 0.0025),
    angle: o.wind,
    jitter: 0.1,
    length: [50, 220],
    width: [4, 14],
    load: [0.2, 0.45],
    dryEnd: 0.5,
    edgeDry: 0.6,
    grain: 0.6,
    rough: 0.4,
    opacity: 0.9,
  })
}
