import { adjust, mix, vary, type ColorLike } from '../color.ts'
import { lerp, type Pt } from '../math.ts'
import type { Painter } from '../painter.ts'

export type Foliage = { dark: ColorLike; mid: ColorLike; light: ColorLike; blossom?: ColorLike }

type Lobe = { x: number; y: number; rx: number; ry: number }

/** Clumps that make up a canopy: one big core and smaller ones around its edge. */
function clumps(p: Painter, cx: number, cy: number, rx: number, ry: number, n: number, flat: number): Lobe[] {
  const rng = p.rng
  const out: Lobe[] = [{ x: cx, y: cy, rx: rx * 0.6, ry: ry * 0.6 }]
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2)
    const d = rng.range(0.35, 0.7)
    const r = rng.range(0.28, 0.45)
    out.push({ x: cx + Math.cos(a) * d * rx, y: cy + Math.sin(a) * d * ry * (1 - flat * 0.4), rx: r * rx, ry: r * ry * (1 - flat * 0.3) })
  }
  return out
}

/**
 * Paint a canopy as clumps of foliage, each lit on its own sunny side, then dense leaf dabs
 * that break the silhouette. Blossom colour (if any) is scattered through the light side.
 */
export function canopy(p: Painter, cx: number, cy: number, rx: number, ry: number, f: Foliage, light: number, o: { lobes?: number; flat?: number; leaf?: number } = {}) {
  const rng = p.rng
  const ls = clumps(p, cx, cy, rx, ry, o.lobes ?? 9, o.flat ?? 0)
  const m = p.mask((ctx) => {
    for (const l of ls) {
      ctx.beginPath()
      ctx.ellipse(l.x, l.y, l.rx, l.ry, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  // dark underlayer: the canopy's mass in shade
  p.fill(m, { color: f.dark, color2: adjust(f.dark, 0.04), streak: 0.4, angle: 0.4, load: 0.97 })
  const lx = Math.cos(light)
  const ly = Math.sin(light)
  const leaf = o.leaf ?? Math.min(12, Math.max(3, Math.min(rx, ry) * 0.06))
  // clumps from the back (lower) to the front (upper), each lit on its sunny side
  for (const l of ls.slice().sort((a, b) => b.y - a.y)) {
    const n = Math.round(((l.rx * l.ry) / (leaf * leaf)) * 3.2)
    for (let k = 0; k < n; k++) {
      const a = rng.range(0, Math.PI * 2)
      const d = Math.sqrt(rng.next()) * 1.08
      const x = l.x + Math.cos(a) * d * l.rx
      const y = l.y + Math.sin(a) * d * l.ry
      // how much this spot faces the light, within its clump and within the whole crown
      const local = Math.cos(a) * d * lx + Math.sin(a) * d * ly
      const global = ((x - cx) / rx) * lx + ((y - cy) / ry) * ly
      const sun = local * 0.7 + global * 0.4 + rng.gauss(0, 0.18)
      if (sun < -0.35) continue // leave the shadow underlayer showing
      let c: ColorLike = sun > 0.35 ? f.light : sun > -0.05 ? f.mid : mix(f.mid, f.dark, 0.5)
      if (f.blossom && rng.chance(sun > 0 ? 0.6 : 0.3)) c = sun > 0.3 ? f.light : f.blossom
      const ang = rng.gauss(-0.5, 0.7)
      const len = leaf * rng.range(0.7, 1.4)
      p.stroke(
        [
          [x, y],
          [x + Math.cos(ang) * len, y + Math.sin(ang) * len],
        ],
        { color: vary(rng, c, 0.03, 0.006), width: leaf * rng.range(0.5, 0.9), load: rng.range(0.7, 1), grain: 0.45, taper: [0.25, 0.35], rough: 0.2 },
      )
    }
  }
  return m
}

const trunk = (p: Painter, pts: Pt[], w0: number, w1: number, bark: ColorLike, light: number) => {
  const m = p.tube(pts, (t) => lerp(w0, w1, t))
  p.shape(m, { color: bark, shadow: adjust(bark, -0.12), light: adjust(bark, 0.08), lightAngle: light, depth: w0 * 0.45 })
  return m
}

/** Umbrella pine: tall leaning trunk, a few limbs, a flat wide crown. (x, y) is the trunk base. */
export function stonePine(p: Painter, x: number, y: number, h: number, lean: number, f: Foliage, bark: ColorLike, light: number, crown = 1) {
  const top: Pt = [x + lean * h, y - h]
  const mid: Pt = [x + lean * h * 0.35, y - h * 0.55]
  trunk(p, [[x, y], mid, top], h * 0.05, h * 0.025, bark, light)
  const c = h * crown
  const limbs: Pt[] = [
    [top[0] - c * 0.35, top[1] - c * 0.05],
    [top[0] + c * 0.3, top[1] - c * 0.08],
    [top[0], top[1] - c * 0.12],
  ]
  for (const l of limbs) trunk(p, [top, l], h * 0.022, h * 0.01, bark, light)
  const crowns: [number, number, number, number][] = [
    [top[0] - c * 0.32, top[1] - c * 0.1, c * 0.3, c * 0.12],
    [top[0] + c * 0.3, top[1] - c * 0.12, c * 0.32, c * 0.13],
    [top[0], top[1] - c * 0.2, c * 0.38, c * 0.14],
  ]
  for (const [cx, cy, rx, ry] of crowns) canopy(p, cx, cy, rx, ry, f, light, { lobes: 12, flat: 0.6 })
}

/** Round broadleaf tree. (x, y) is the trunk base. */
export function roundTree(p: Painter, x: number, y: number, h: number, f: Foliage, bark: ColorLike, light: number) {
  trunk(
    p,
    [
      [x, y],
      [x + h * 0.02, y - h * 0.45],
    ],
    h * 0.08,
    h * 0.05,
    bark,
    light,
  )
  canopy(p, x, y - h * 0.62, h * 0.38, h * 0.36, f, light, { lobes: 10 })
}

/** Tall dark cypress flame. (x, y) is the base. */
export function cypress(p: Painter, x: number, y: number, h: number, f: Foliage, light: number) {
  const w = h * 0.13
  const m = p.blob([
    [x - w * 0.5, y],
    [x - w, y - h * 0.35],
    [x - w * 0.6, y - h * 0.75],
    [x, y - h],
    [x + w * 0.6, y - h * 0.75],
    [x + w, y - h * 0.35],
    [x + w * 0.5, y],
  ])
  p.shape(m, { color: f.mid, shadow: f.dark, light: f.light, lightAngle: light, depth: w * 0.7, angle: -Math.PI / 2 })
  for (let k = 0; k < h * 0.5; k++) {
    const yy = y - p.rng.range(0.02, 0.95) * h
    const xx = x + p.rng.gauss(0, w * 0.4)
    p.stroke(
      [
        [xx, yy],
        [xx + p.rng.gauss(0, 1), yy - h * 0.05],
      ],
      { color: p.rng.chance(0.5) ? f.dark : f.light, width: w * 0.18, load: 0.7, clip: m, opacity: 0.8 },
    )
  }
}

/** Jacaranda: twisting dark limbs under a hazy purple bloom. (x, y) is the trunk base. */
export function jacaranda(p: Painter, x: number, y: number, h: number, lean: number, bloom: Foliage, bark: ColorLike, light: number, crown = 1) {
  const top: Pt = [x + lean * h, y - h * 0.62]
  trunk(p, [[x, y], [x + lean * h * 0.4, y - h * 0.35], top], h * 0.06, h * 0.03, bark, light)
  const c = h * crown
  const limbs: Pt[] = [
    [top[0] - c * 0.3, top[1] - c * 0.18],
    [top[0] + c * 0.32, top[1] - c * 0.2],
    [top[0] + c * 0.05, top[1] - c * 0.3],
  ]
  for (const l of limbs) trunk(p, [top, l], h * 0.025, h * 0.012, bark, light)
  for (const [dx, dy, r] of [
    [-0.3, -0.25, 0.28],
    [0.3, -0.27, 0.3],
    [0.02, -0.38, 0.32],
  ] as const)
    canopy(p, top[0] + dx * c, top[1] + dy * c, r * c, r * c * 0.75, bloom, light, { lobes: 16 })
  // fallen blossom carpet
  for (let k = 0; k < 120; k++) {
    const fx = x + p.rng.gauss(lean * h * 0.5, h * 0.35)
    const fy = y + p.rng.gauss(h * 0.02, h * 0.03)
    p.stroke(
      [
        [fx, fy],
        [fx + 4, fy + 1],
      ],
      { color: mix(bloom.mid, bloom.light, p.rng.next()), width: 4, load: 0.8, opacity: 0.8 },
    )
  }
}
