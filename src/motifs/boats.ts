import { scumble } from '../brushwork.ts'
import { adjust, vary, type ColorLike } from '../color.ts'
import { lerp, type Pt } from '../math.ts'
import type { Painter } from '../painter.ts'

export type RabeloOpts = {
  /** Stern x, waterline y; the boat extends `length` px toward `dir`. */
  x: number
  y: number
  length: number
  dir: 1 | -1
  hull: ColorLike
  sail?: { color: ColorLike; stripe?: ColorLike }
  barrels?: number
  light: number
}

/** Douro rabelo boat: long low hull, raised stern deck with the long steering oar, square sail, port barrels. */
export function rabelo(p: Painter, o: RabeloOpts) {
  const L = o.length
  const B = (t: number, dy: number): Pt => [o.x + o.dir * t * L, o.y + dy * L]
  const hullDark = adjust(o.hull, -0.08)
  // hull: low banana, bow sweeping up
  const hull = p.blob([B(0, -0.1), B(0.08, -0.07), B(0.5, -0.06), B(0.9, -0.08), B(1.0, -0.14), B(0.97, -0.05), B(0.85, 0.02), B(0.4, 0.035), B(0.08, 0.02)])
  p.shape(hull, { color: o.hull, shadow: hullDark, light: adjust(o.hull, 0.06), lightAngle: o.light, depth: L * 0.025, angle: 0 })
  // strakes
  for (const dy of [-0.035, -0.005]) p.line([B(0.03, dy - 0.02), B(0.5, dy), B(0.93, dy - 0.04)], { color: hullDark, width: L * 0.004, clip: hull, opacity: 0.8 })
  p.line([B(0.02, -0.09), B(0.5, -0.06), B(0.98, -0.12)], { color: adjust(o.hull, 0.12), width: L * 0.006 })
  // barrels on deck
  const n = o.barrels ?? 6
  for (let i = 0; i < n; i++) {
    const t = lerp(0.3, 0.8, (i + 0.5) / n)
    const [bx, by] = B(t, -0.085)
    const bw = L * 0.03
    const bh = L * 0.032
    const m = p.mask((ctx) => {
      ctx.beginPath()
      ctx.ellipse(bx, by, bw, bh, 0, 0, Math.PI * 2)
      ctx.fill()
    })
    p.shape(m, { color: '#8a5a34', shadow: '#5e3b22', light: '#a87244', lightAngle: o.light, depth: bw * 0.6 })
    for (const k of [-0.5, 0.5]) p.line([[bx - bw, by + k * bh], [bx + bw, by + k * bh]], { color: '#3a3a3c', width: 1.6, clip: m, wobble: 0.2 })
  }
  // raised stern platform with a little rail and the steersman's pole
  const deck = p.polygon([B(0.02, -0.1), B(0.2, -0.1), B(0.2, -0.17), B(0.02, -0.17)], 0.6)
  p.shape(deck, { color: adjust(o.hull, 0.04), shadow: hullDark, lightAngle: o.light, depth: L * 0.02, angle: 0 })
  p.line([B(0.03, -0.2), B(0.2, -0.2)], { color: hullDark, width: 2.4 })
  for (const t of [0.04, 0.11, 0.18]) p.line([B(t, -0.17), B(t, -0.2)], { color: hullDark, width: 2 })
  // espadela: long steering oar from the stern deck down into the water behind
  p.line([B(0.16, -0.22), B(-0.32, 0.04)], { color: '#5a4330', width: L * 0.008, wobble: 0.4 })
  p.stroke([B(-0.36, 0.03), B(-0.26, 0.05)], { color: '#5a4330', width: L * 0.02, load: 0.9, taper: [0.2, 0.2] })
  // mast and square sail
  if (o.sail) {
    const mx = 0.5
    const top = -0.62
    p.line([B(mx, -0.07), B(mx, top)], { color: '#4a3828', width: L * 0.009, wobble: 0.3 })
    p.line([B(mx - 0.16, top + 0.04), B(mx + 0.16, top + 0.04)], { color: '#4a3828', width: L * 0.006 })
    const belly = 0.03 * o.dir
    const sailPts: Pt[] = [B(mx - 0.155, top + 0.045), B(mx + 0.155, top + 0.045), B(mx + 0.16 + belly, top + 0.3), B(mx + 0.15, top + 0.48), B(mx - 0.15, top + 0.48), B(mx - 0.16 + belly, top + 0.3)]
    const sail = p.blob(sailPts)
    p.shape(sail, { color: o.sail.color, shadow: adjust(o.sail.color, -0.1), light: adjust(o.sail.color, 0.04), lightAngle: o.light, depth: L * 0.07, angle: Math.PI / 2 })
    if (o.sail.stripe) {
      for (const t of [mx - 0.06, mx + 0.06]) {
        p.stroke([B(t, top + 0.05), B(t + belly * 0.5, top + 0.27), B(t, top + 0.47)], { color: o.sail.stripe, width: L * 0.03, load: 0.9, clip: sail, taper: [0, 0] })
      }
    }
    scumble(p, {
      region: sail,
      clip: sail,
      count: 30,
      color: (_x, _y, r) => vary(r, adjust(o.sail!.color, r.range(-0.06, 0.03)), 0.01, 0.003),
      angle: Math.PI / 2,
      length: [L * 0.05, L * 0.2],
      width: [2, 5],
      load: [0.35, 0.6],
    })
    // rigging
    p.line([B(mx, top), B(0.98, -0.13)], { color: '#4a3828', width: 1.4, opacity: 0.8 })
    p.line([B(mx, top), B(0.08, -0.17)], { color: '#4a3828', width: 1.4, opacity: 0.8 })
    return { sailCenter: B(mx, top + 0.26), sailSize: L * 0.3 }
  }
  return { sailCenter: B(0.5, -0.3), sailSize: 0 }
}
