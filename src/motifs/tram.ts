import { hatch } from '../brushwork.ts'
import { adjust, type ColorLike } from '../color.ts'
import type { Pt } from '../math.ts'
import type { Painter } from '../painter.ts'

export type TramWindow = { c: Pt; w: number; h: number; mask: ReturnType<Painter['polygon']> }

export type TramOpts = {
  /** Rear wheel on the rail; the tram runs `length` px along `angle` (negative climbs to the right). */
  x: number
  y: number
  length: number
  angle: number
  body: ColorLike
  cream: ColorLike
  roof: ColorLike
  ink: ColorLike
  light: number
  /** Paint whoever sits at the windows; drawn before the window frames so they sit inside. */
  passengers?: (windows: TramWindow[], at: (u: number, v: number) => Pt) => void
}

/** Lisbon-style tram in side view: yellow body, cream window band, roof, bogies and trolley pole. */
export function tram(p: Painter, o: TramOpts) {
  const L = o.length
  const dx = Math.cos(o.angle)
  const dy = Math.sin(o.angle)
  // "up" is perpendicular to the rail
  const ux = Math.sin(o.angle)
  const uy = -Math.cos(o.angle)
  const T = (u: number, v: number): Pt => [o.x + (dx * u + ux * v) * L, o.y + (dy * u + uy * v) * L]
  const ink = { color: o.ink, width: Math.max(1.8, L * 0.003), wobble: 0.6, load: 0.85, grain: 0.5 }
  const panel = (pts: Pt[], color: ColorLike, hatchIt = true) => {
    const m = p.polygon(pts, 0.8)
    const depth = Math.max(8, L * 0.03)
    p.shape(m, { color, shadow: adjust(color, -0.12), light: adjust(color, 0.07), lightAngle: o.light, depth, angle: o.angle })
    if (hatchIt) {
      const r = p.rim(m, o.light, depth * 0.8)
      if (r.x1 >= r.x0) hatch(p, r, { color: o.ink, angle: o.angle + 1.1, spacing: 4.5, width: [0.8, 1.3], wobble: 0.4, load: 0.75, opacity: 0.4 })
    }
    p.line([...pts, pts[0]], ink)
    return m
  }

  // bogies and wheels
  for (const [a, b] of [
    [0.12, 0.38],
    [0.62, 0.88],
  ]) {
    panel([T(a, 0), T(b, 0), T(b, 0.07), T(a, 0.07)], '#3d3b3a', false)
    for (const u of [a + 0.05, b - 0.05]) {
      const [cx, cy] = T(u, 0.03)
      const w = p.mask((ctx) => {
        ctx.beginPath()
        ctx.arc(cx, cy, L * 0.032, 0, Math.PI * 2)
        ctx.fill()
      })
      p.shape(w, { color: '#545150', shadow: '#2d2b2b', light: '#8a8580', lightAngle: o.light, depth: L * 0.012 })
    }
  }

  // interior behind the windows
  const interior = p.polygon([T(0.03, 0.19), T(0.97, 0.19), T(0.97, 0.35), T(0.03, 0.35)], 0.4)
  p.fill(interior, { color: '#40464c', color2: '#555c62', streak: 0.4, angle: o.angle, load: 1 })
  const windows: TramWindow[] = []
  const n = 7
  for (let i = 0; i < n; i++) {
    const u = 0.1 + (0.8 * (i + 0.5)) / n
    const hw = 0.045
    const pts: Pt[] = [T(u - hw, 0.21), T(u + hw, 0.21), T(u + hw, 0.33), T(u - hw, 0.33)]
    windows.push({ c: T(u, 0.27), w: hw * 2 * L, h: 0.12 * L, mask: p.polygon(pts, 0.3) })
  }
  o.passengers?.(windows, T)
  // glass sheen
  for (const w of windows)
    p.stroke([w.c, [w.c[0] + w.w * 0.3, w.c[1] - w.h * 0.45]], { color: '#dfe7ea', width: w.w * 0.12, load: 0.5, opacity: 0.35, clip: w.mask })

  // cream frame: sill, pillars, top band, end posts
  panel([T(0.0, 0.185), T(1.0, 0.185), T(1.0, 0.215), T(0.0, 0.215)], o.cream, false)
  panel([T(0.0, 0.33), T(1.0, 0.33), T(1.0, 0.38), T(0.0, 0.38)], o.cream)
  const centers = windows.map((_, i) => 0.1 + (0.8 * (i + 0.5)) / n)
  const gaps: [number, number][] = [[0, centers[0] - 0.045]]
  for (let i = 0; i < n - 1; i++) gaps.push([centers[i] + 0.045, centers[i + 1] - 0.045])
  gaps.push([centers[n - 1] + 0.045, 1])
  for (const [a, b] of gaps) panel([T(a, 0.215), T(b, 0.215), T(b, 0.33), T(a, 0.33)], o.cream, false)

  // lower body
  const body = panel([T(0, 0.06), T(1, 0.06), T(1.005, 0.185), T(-0.005, 0.185)], o.body)
  p.line([T(0.02, 0.1), T(0.98, 0.1)], { ...ink, width: ink.width * 0.6, opacity: 0.6, clip: body })
  // roof and destination box
  panel([T(0.01, 0.38), T(0.99, 0.38), T(0.95, 0.42), T(0.05, 0.42)], o.roof)
  const sign = panel([T(0.83, 0.42), T(0.95, 0.42), T(0.95, 0.475), T(0.83, 0.475)], '#2f3133', false)
  // bumpers, headlight
  p.stroke([T(-0.012, 0.05), T(-0.012, 0.11)], { color: '#2f2d2c', width: L * 0.012, load: 1, taper: [0, 0] })
  p.stroke([T(1.012, 0.05), T(1.012, 0.11)], { color: '#2f2d2c', width: L * 0.012, load: 1, taper: [0, 0] })
  const [hx, hy] = T(1.0, 0.14)
  p.shape(
    p.mask((ctx) => {
      ctx.beginPath()
      ctx.arc(hx, hy, L * 0.013, 0, Math.PI * 2)
      ctx.fill()
    }),
    { color: '#fff1c2', shadow: '#e2c46e', lightAngle: o.light, depth: 3 },
  )
  // trolley pole up to the wire
  const poleBase = T(0.28, 0.42)
  const poleTop = T(0.62, 0.66)
  p.line([poleBase, poleTop], { ...ink, width: L * 0.006 })
  p.stroke([T(0.25, 0.42), T(0.31, 0.42)], { color: '#2f2d2c', width: L * 0.012, load: 1, taper: [0, 0] })
  return { at: T, sign, signCenter: T(0.89, 0.448), rear: T(0, 0.12), poleTop, wire: (u: number) => T(u, 0.67) }
}
