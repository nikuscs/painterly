export type Pt = [number, number]

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const TAU = Math.PI * 2

/** Seeded PRNG (mulberry32) with the helpers scenes need. */
export class Rng {
  private s: number
  constructor(seed: number) {
    this.s = seed >>> 0 || 1
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next()
  }
  int(a: number, b: number) {
    return Math.floor(this.range(a, b + 1))
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }
  chance(p: number) {
    return this.next() < p
  }
  gauss(mean = 0, sd = 1) {
    const u = 1 - this.next()
    const v = this.next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v)
  }
  /** Weighted pick: [[value, weight], ...] */
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    let total = 0
    for (const [, w] of items) total += w
    let r = this.next() * total
    for (const [v, w] of items) if ((r -= w) <= 0) return v
    return items[items.length - 1][0]
  }
  fork() {
    return new Rng(Math.floor(this.next() * 4294967296))
  }
}

/** Catmull-Rom through the control points, resampled to roughly `step` px. */
export function smoothPath(pts: Pt[], step = 2): Pt[] {
  if (pts.length < 2) return pts.slice()
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    for (let j = 0; j < n; j++) {
      const t = j / n
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1].slice() as Pt)
  return out
}

/** Straight-segment densify to roughly `step` px. */
export function densify(pts: Pt[], step = 2): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]
    const [bx, by] = pts[i + 1]
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step))
    for (let j = 0; j < n; j++) out.push([lerp(ax, bx, j / n), lerp(ay, by, j / n)])
  }
  out.push(pts[pts.length - 1].slice() as Pt)
  return out
}

/** Quadratic-ish arc from a to b bowed sideways by `bow` px (positive bows left of travel). */
export function arc(a: Pt, b: Pt, bow: number, n = 6): Pt[] {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const k = 4 * t * (1 - t) * bow
    out.push([a[0] + dx * t + nx * k, a[1] + dy * t + ny * k])
  }
  return out
}

/** Points along a direction from a start, curling by `curl` radians over its length. */
export function curve(x: number, y: number, angle: number, length: number, curl = 0, n = 6): Pt[] {
  const out: Pt[] = [[x, y]]
  let a = angle
  const seg = length / n
  for (let i = 0; i < n; i++) {
    a += curl / n
    x += Math.cos(a) * seg
    y += Math.sin(a) * seg
    out.push([x, y])
  }
  return out
}
