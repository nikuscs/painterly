import type { ColorLike } from './color.ts'
import { curve, type Pt, type Rng } from './math.ts'
import type { Mask, Painter, StrokeOpts } from './painter.ts'

type Range = [number, number]
type Field<T> = T | ((x: number, y: number, rng: Rng) => T)
const get = <T>(f: Field<T>, x: number, y: number, rng: Rng): T =>
  typeof f === 'function' ? (f as (x: number, y: number, rng: Rng) => T)(x, y, rng) : f

export type ScumbleOpts = Omit<StrokeOpts, 'color' | 'width' | 'load' | 'clip'> & {
  /** Where strokes may start: a mask, or a density function 0..1. */
  region: Mask | ((x: number, y: number) => number)
  /** Bounding box for density functions [x0, y0, x1, y1]. */
  box?: [number, number, number, number]
  count: number
  color: Field<ColorLike>
  angle: Field<number>
  jitter?: number
  length: Field<Range>
  width: Field<Range>
  load?: Field<Range>
  curl?: Range
  /** Clip strokes to the region mask so they never spill out. */
  clipToRegion?: boolean
  /** Clip strokes to this mask instead. */
  clip?: Mask
}

/** Many loose brush strokes scattered over a region, following a direction field. */
export function scumble(p: Painter, o: ScumbleOpts) {
  const rng = p.rng
  const isMask = typeof o.region !== 'function'
  const m = isMask ? (o.region as Mask) : null
  const [x0, y0, x1, y1] = m ? [m.x0, m.y0, m.x1, m.y1] : (o.box ?? [0, 0, p.w - 1, p.h - 1])
  if (x1 < x0) return
  const density = (x: number, y: number) =>
    m ? m.data[Math.floor(y) * p.w + Math.floor(x)] : (o.region as (x: number, y: number) => number)(x, y)
  let placed = 0
  let tries = 0
  while (placed < o.count && tries < o.count * 30) {
    tries++
    const x = rng.range(x0, x1)
    const y = rng.range(y0, y1)
    if (rng.next() > density(x, y)) continue
    placed++
    const [la, lb] = get(o.length, x, y, rng)
    const [wa, wb] = get(o.width, x, y, rng)
    const [ld0, ld1] = get(o.load ?? [0.6, 0.9], x, y, rng)
    const [ca, cb] = o.curl ?? [-0.15, 0.15]
    const len = rng.range(la, lb)
    const a = get(o.angle, x, y, rng) + rng.gauss(0, o.jitter ?? 0.08)
    // centre the stroke on the sample point
    const sx = x - (Math.cos(a) * len) / 2
    const sy = y - (Math.sin(a) * len) / 2
    p.stroke(curve(sx, sy, a, len, rng.range(ca, cb), 5), {
      ...o,
      color: get(o.color, x, y, rng),
      width: rng.range(wa, wb),
      load: rng.range(ld0, ld1),
      clip: o.clip ?? (o.clipToRegion && m ? m : undefined),
    })
  }
}

export type HatchOpts = Omit<StrokeOpts, 'color' | 'width' | 'clip'> & {
  color: Field<ColorLike>
  angle: number
  /** Distance between hatch lines in px. */
  spacing: number
  /** Line width in px. */
  width?: Range
  /** Each line is broken into dashes of this length range (crayon hatching). */
  length?: Range
  /** Random gap chance between dashes. */
  gaps?: number
  wobble?: number
}

/** Parallel hatching clipped to a mask: pencil shading, crayon fills, engraving texture. */
export function hatch(p: Painter, m: Mask, o: HatchOpts) {
  if (m.x1 < m.x0) return
  const rng = p.rng
  const ca = Math.cos(o.angle)
  const sa = Math.sin(o.angle)
  const cx = (m.x0 + m.x1) / 2
  const cy = (m.y0 + m.y1) / 2
  const R = Math.hypot(m.x1 - m.x0, m.y1 - m.y0) / 2 + 4
  const [wa, wb] = o.width ?? [1.2, 2.2]
  const [la, lb] = o.length ?? [R * 2, R * 2]
  for (let off = -R; off <= R; off += o.spacing * rng.range(0.75, 1.25)) {
    let t = -R + rng.range(-o.spacing, 0)
    while (t < R) {
      const len = rng.range(la, lb)
      if (!rng.chance(o.gaps ?? 0)) {
        const a: Pt = [cx + ca * t - sa * off, cy + sa * t + ca * off]
        const b: Pt = [cx + ca * (t + len) - sa * off, cy + sa * (t + len) + ca * off]
        const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        const pts = p.wobble([a, mid, b], o.wobble ?? 1, 0.01)
        p.stroke(pts, { taper: [0.05, 0.1], ...o, color: get(o.color, mid[0], mid[1], rng), width: rng.range(wa, wb), clip: m })
      }
      t += len + rng.range(2, 8)
    }
  }
}
