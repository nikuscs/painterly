import { adjust, type ColorLike } from '../color.ts'
import { smoothPath, type Pt } from '../math.ts'
import { hatch } from '../brushwork.ts'
import type { Mask, Painter } from '../painter.ts'

/** Points around a rounded rectangle, optionally rotated about its centre. */
export function roundRect(cx: number, cy: number, w: number, h: number, r: number, rot = 0): Pt[] {
  const pts: Pt[] = []
  const corners: [number, number, number][] = [
    [w / 2 - r, -h / 2 + r, -Math.PI / 2],
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
  ]
  for (const [ox, oy, a0] of corners)
    for (let k = 0; k <= 4; k++) {
      const a = a0 + (k / 4) * (Math.PI / 2)
      pts.push([ox + Math.cos(a) * r, oy + Math.sin(a) * r])
    }
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return pts.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c])
}

const ellipse = (p: Painter, x: number, y: number, rx: number, ry: number, rot = 0): Mask =>
  p.mask((ctx) => {
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
    ctx.fill()
  })

export type Face = 'happy' | 'wow' | 'wink' | 'grin' | 'love' | 'effort'

export type RobotOpts = {
  x: number
  ground: number
  /** Total height in px. */
  size: number
  /** Main tin paint and trim paint. */
  paint: ColorLike
  trim: ColorLike
  /** Eye lens glow. */
  lens?: ColorLike
  face: Face
  /** Where the claws go (viewer's left, right). */
  hands: [Pt, Pt]
  headTilt?: number
  /** Light direction (radians). */
  light: number
  sitting?: boolean
  /** 0..1 scuffs, dents and rust. */
  wear?: number
}

const INK = '#35291f'

/**
 * Vintage wind-up tin robot: riveted boxy body, ribbed limbs, lens eyes, grille mouth,
 * spring antenna. Worn paint, rust spots, hatched shadows and a wobbly ink outline.
 */
export function robot(p: Painter, o: RobotOpts) {
  const s = o.size
  const rng = p.rng
  const { x, ground } = o
  const wear = o.wear ?? 0.6
  const ink = { color: INK, width: Math.max(1.6, s * 0.011), wobble: 0.7, load: 0.85, grain: 0.5 }
  const rust = ['#9a5530', '#7c4326', '#b5703f']

  /** One tin plate: paint, wear, hatched shadow side, ink outline, rivets. */
  const plate = (pts: Pt[], color: ColorLike, opt: { rivets?: number; sharp?: boolean; hatch?: boolean } = {}) => {
    const m = opt.sharp === false ? p.blob(pts) : p.polygon(pts, 0.9)
    const depth = Math.max(6, Math.min(m.x1 - m.x0, m.y1 - m.y0) * 0.28)
    p.shape(m, { color, shadow: adjust(color, -0.13), light: adjust(color, 0.08), lightAngle: o.light, depth, angle: 0.1 })
    const area = (m.x1 - m.x0) * (m.y1 - m.y0)
    const n = Math.round((area / (s * s)) * 60 * wear)
    for (let k = 0; k < n; k++) {
      const px = rng.range(m.x0, m.x1)
      const py = rng.range(m.y0, m.y1)
      if (m.data[Math.floor(py) * p.w + Math.floor(px)] < 0.5) continue
      const isRust = rng.chance(0.35) && (py - m.y0) / (m.y1 - m.y0 + 1) > 0.4
      const len = s * rng.range(0.01, isRust ? 0.03 : 0.05)
      const a = rng.gauss(0.1, 0.5)
      p.stroke(
        [
          [px, py],
          [px + Math.cos(a) * len, py + Math.sin(a) * len],
        ],
        {
          color: isRust ? rng.pick(rust) : adjust(color, 0.12),
          width: s * rng.range(isRust ? 0.012 : 0.004, isRust ? 0.025 : 0.008),
          load: rng.range(0.5, 0.9),
          grain: 0.7,
          clip: m,
          opacity: isRust ? 0.75 : 0.6,
        },
      )
    }
    if (opt.hatch !== false) {
      const r = p.rim(m, o.light, depth * 0.7)
      if (r.x1 >= r.x0) hatch(p, r, { color: INK, angle: 0.9, spacing: Math.max(3.5, s * 0.022), width: [0.8, 1.3], wobble: 0.4, load: 0.75, opacity: 0.45, grain: 0.6 })
    }
    p.line([...pts, pts[0]], ink)
    const rv = opt.rivets ?? 0
    if (rv > 0) {
      const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length
      const cy = pts.reduce((a, q) => a + q[1], 0) / pts.length
      const closed = [...pts, pts[0]]
      for (let i = 0; i < rv; i++) {
        const t = (i / rv) * (closed.length - 1)
        const j = Math.floor(t)
        const f = t - j
        const ex = closed[j][0] + (closed[j + 1][0] - closed[j][0]) * f
        const ey = closed[j][1] + (closed[j + 1][1] - closed[j][1]) * f
        const d = Math.hypot(cx - ex, cy - ey) || 1
        const inset = s * 0.028
        rivet(ex + ((cx - ex) / d) * inset, ey + ((cy - ey) / d) * inset)
      }
    }
    return m
  }
  const rivet = (rx: number, ry: number) => {
    p.fill(ellipse(p, rx, ry, s * 0.011, s * 0.011), { color: adjust(o.paint, -0.2), load: 1 })
    p.fill(ellipse(p, rx - s * 0.004, ry - s * 0.004, s * 0.005, s * 0.005), { color: adjust(o.paint, 0.15), load: 1 })
  }
  /** Ribbed tube (accordion limb) with ink edges and ring lines. */
  const limb = (pts: Pt[], width: number, color: ColorLike) => {
    const m = p.tube(pts, () => width)
    p.shape(m, { color, shadow: adjust(color, -0.14), light: adjust(color, 0.08), lightAngle: o.light, depth: width * 0.45 })
    const path = smoothPath(pts, 2)
    const L = path.length
    const side = (k: 1 | -1) =>
      path.map((q, i) => {
        const a = path[Math.min(L - 1, i + 1)]
        const b = path[Math.max(0, i - 1)]
        const dx = a[0] - b[0]
        const dy = a[1] - b[1]
        const l = Math.hypot(dx, dy) || 1
        return [q[0] - (dy / l) * (width / 2) * k, q[1] + (dx / l) * (width / 2) * k] as Pt
      })
    p.line(side(1), { ...ink, wobble: 0.4 })
    p.line(side(-1), { ...ink, wobble: 0.4 })
    const step = Math.max(3, Math.round((width * 0.7) / 2))
    for (let i = step; i < L - step; i += step) {
      const a = path[i + 1]
      const b = path[i - 1]
      const dx = a[0] - b[0]
      const dy = a[1] - b[1]
      const l = Math.hypot(dx, dy) || 1
      const nx = (-dy / l) * (width / 2)
      const ny = (dx / l) * (width / 2)
      p.line(
        [
          [path[i][0] - nx, path[i][1] - ny],
          [path[i][0] + nx, path[i][1] + ny],
        ],
        { ...ink, width: ink.width * 0.6, opacity: 0.55, wobble: 0.2, clip: m },
      )
    }
    return m
  }

  // ---- legs and feet
  const hip = ground - (o.sitting ? 0.17 : 0.34) * s
  for (const side of [-1, 1]) {
    const lx = x + side * 0.12 * s
    if (!o.sitting)
      limb(
        [
          [lx, hip],
          [lx + side * 0.01 * s, ground - 0.07 * s],
        ],
        s * 0.1,
        adjust(o.paint, -0.06),
      )
    const fw = o.sitting ? 0.14 : 0.12
    plate(
      [
        [lx - fw * s, ground],
        [lx + fw * s, ground],
        [lx + (fw - 0.03) * s, ground - 0.08 * s],
        [lx - (fw - 0.03) * s, ground - 0.08 * s],
      ],
      o.trim,
      { rivets: 0 },
    )
  }

  // ---- torso: trapezoid tin box with a front panel, dial, lamps and vents
  const top = hip - 0.3 * s
  const torso: Pt[] = [
    [x - 0.23 * s, hip],
    [x + 0.23 * s, hip],
    [x + 0.26 * s, top],
    [x - 0.26 * s, top],
  ]
  // arms first if they hang behind? Claws reach forward, so arms go after the torso.
  plate(torso, o.paint, { rivets: 14 })
  const pcy = top + 0.13 * s
  plate(
    [
      [x - 0.15 * s, pcy + 0.08 * s],
      [x + 0.15 * s, pcy + 0.08 * s],
      [x + 0.15 * s, pcy - 0.08 * s],
      [x - 0.15 * s, pcy - 0.08 * s],
    ],
    o.trim,
    { hatch: false },
  )
  const dial = ellipse(p, x - 0.06 * s, pcy, s * 0.05, s * 0.05)
  p.shape(dial, { color: '#efe6cf', shadow: '#c9bd9f', lightAngle: o.light, depth: s * 0.02 })
  p.line(
    [
      [x - 0.06 * s, pcy],
      [x - 0.03 * s, pcy - 0.035 * s],
    ],
    { ...ink, width: s * 0.008, wobble: 0 },
  )
  p.line([...roundRect(x - 0.06 * s, pcy, s * 0.1, s * 0.1, s * 0.05)], { ...ink, wobble: 0.3 })
  for (const [lx, c] of [
    [0.05, '#d9493a'],
    [0.1, '#e6c14a'],
  ] as const) {
    p.shape(ellipse(p, x + lx * s, pcy - 0.02 * s, s * 0.018, s * 0.018), { color: c, shadow: adjust(c, -0.15), light: '#fff3d0', lightAngle: o.light, depth: s * 0.01 })
  }
  for (let k = 0; k < 3; k++)
    p.line(
      [
        [x + 0.03 * s, pcy + (0.03 + k * 0.018) * s],
        [x + 0.12 * s, pcy + (0.03 + k * 0.018) * s],
      ],
      { ...ink, width: s * 0.007, wobble: 0.2 },
    )

  // ---- arms with pincer claws
  const hands: Pt[] = []
  for (const i of [0, 1] as const) {
    const side = i ? 1 : -1
    const sh: Pt = [x + side * 0.25 * s, top + 0.06 * s]
    const hand = o.hands[i]
    const elbow: Pt = [(sh[0] + hand[0]) / 2 + side * 0.07 * s, (sh[1] + hand[1]) / 2 + 0.05 * s]
    plate(roundRect(sh[0], sh[1], s * 0.1, s * 0.1, s * 0.03), o.trim, { hatch: false })
    limb([sh, elbow, hand], s * 0.065, adjust(o.paint, -0.04))
    // claw: two prongs opening outward
    const a = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0])
    for (const k of [-1, 1]) {
      const b = a + k * 0.55
      const tip: Pt = [hand[0] + Math.cos(b) * s * 0.07, hand[1] + Math.sin(b) * s * 0.07]
      const hook: Pt = [tip[0] + Math.cos(a - k * 0.6) * s * 0.03, tip[1] + Math.sin(a - k * 0.6) * s * 0.03]
      p.stroke([hand, tip, hook], { color: adjust(o.trim, -0.08), width: s * 0.022, load: 1, taper: [0, 0.2], rough: 0.1 })
      p.line([hand, tip, hook], { ...ink, width: ink.width * 0.6, opacity: 0.7 })
    }
    const wrist = ellipse(p, hand[0], hand[1], s * 0.035, s * 0.035)
    p.shape(wrist, { color: o.trim, shadow: adjust(o.trim, -0.15), lightAngle: o.light, depth: s * 0.015 })
    hands.push(hand)
  }

  // ---- neck, head, ears, antenna
  const tilt = o.headTilt ?? 0
  const neckTop = top - 0.05 * s
  limb(
    [
      [x, top + 0.01 * s],
      [x + Math.sin(tilt) * 0.03 * s, neckTop],
    ],
    s * 0.11,
    adjust(o.paint, -0.08),
  )
  const hcx = x + Math.sin(tilt) * 0.17 * s
  const hcy = neckTop - 0.14 * s
  const c = Math.cos(tilt)
  const sn = Math.sin(tilt)
  const F = (fx: number, fy: number): Pt => [hcx + (fx * c - fy * sn) * s, hcy + (fx * sn + fy * c) * s]
  for (const side of [-1, 1]) plate([F(side * 0.22, -0.07), F(side * 0.28, -0.06), F(side * 0.28, 0.06), F(side * 0.22, 0.07)], o.trim, { hatch: false })
  plate([F(-0.23, 0.14), F(0.23, 0.14), F(0.21, -0.14), F(-0.21, -0.14)], o.paint, { rivets: 12 })
  // spring antenna with a bulb
  const base = F(0, -0.14)
  const coil: Pt[] = [base]
  for (let k = 1; k <= 7; k++) coil.push(F((k % 2 ? 1 : -1) * 0.025, -0.14 - k * 0.018))
  p.line(coil, { ...ink, width: s * 0.012, wobble: 0.1 })
  const bulb = F(0, -0.29)
  p.shape(ellipse(p, bulb[0], bulb[1], s * 0.032, s * 0.032), { color: '#e2533f', shadow: '#a8382a', light: '#ffd9b8', lightAngle: o.light, depth: s * 0.015 })
  p.line(roundRect(bulb[0], bulb[1], s * 0.064, s * 0.064, s * 0.032), { ...ink, wobble: 0.2 })

  // ---- face: brass-rimmed lenses, painted brows, grille mouth
  const lens = o.lens ?? '#f3d27a'
  const eye = (ex: number, open: boolean, pupil: 'dot' | 'big' | 'heart' | 'up') => {
    const [cx, cy] = F(ex, -0.035)
    p.shape(ellipse(p, cx, cy, s * 0.066, s * 0.066), { color: '#9c8458', shadow: '#6b5838', light: '#d8c08a', lightAngle: o.light, depth: s * 0.02 })
    if (!open) {
      p.stroke([F(ex - 0.04, -0.03), F(ex, -0.055), F(ex + 0.04, -0.03)], { color: INK, width: s * 0.014, load: 1, taper: [0.1, 0.1] })
      return
    }
    p.shape(ellipse(p, cx, cy, s * 0.048, s * 0.048), { color: lens, shadow: adjust(lens, -0.12), light: '#fff6d8', lightAngle: o.light, depth: s * 0.02 })
    if (pupil === 'heart') {
      p.stroke([F(ex - 0.025, -0.04), F(ex - 0.012, -0.055), F(ex, -0.04), F(ex + 0.012, -0.055), F(ex + 0.025, -0.04), F(ex, -0.015), F(ex - 0.025, -0.04)], {
        color: '#d9493a',
        width: s * 0.014,
        load: 1,
      })
    } else {
      const r = pupil === 'big' ? 0.03 : 0.018
      const dy = pupil === 'up' ? -0.015 : 0
      p.fill(ellipse(p, ...F(ex, -0.035 + dy), s * r, s * r), { color: '#2a2320', load: 1 })
    }
    p.fill(ellipse(p, cx - s * 0.018, cy - s * 0.018, s * 0.01, s * 0.01), { color: '#fffaf0', load: 1 })
  }
  const brow = (ex: number, lift: number) =>
    p.stroke([F(ex - 0.045, -0.115 - lift * 0.4), F(ex, -0.125 - lift), F(ex + 0.045, -0.115 - lift * 0.4)], {
      color: INK,
      width: s * 0.012,
      load: 0.9,
      taper: [0.2, 0.2],
    })
  const grille = (pts: Pt[]) => {
    const m = p.blob(pts)
    p.fill(m, { color: '#2e2a27', load: 1 })
    for (let k = -3; k <= 3; k++)
      p.line([F(k * 0.022, 0.0), F(k * 0.022, 0.16)], { color: '#b9ad94', width: s * 0.006, wobble: 0, clip: m, opacity: 0.8 })
    p.line([...pts, pts[0]], { ...ink, width: ink.width * 0.8 })
  }
  switch (o.face) {
    case 'happy':
      eye(-0.1, true, 'up')
      eye(0.1, true, 'up')
      brow(-0.1, 0.02)
      brow(0.1, 0.02)
      grille([F(-0.09, 0.06), F(0, 0.075), F(0.09, 0.06), F(0.06, 0.1), F(0, 0.115), F(-0.06, 0.1)])
      break
    case 'grin':
      eye(-0.1, true, 'dot')
      eye(0.1, true, 'dot')
      brow(-0.1, 0.0)
      brow(0.1, 0.0)
      grille([F(-0.12, 0.055), F(0.12, 0.055), F(0.09, 0.115), F(-0.09, 0.115)])
      break
    case 'wink':
      eye(-0.1, false, 'dot')
      eye(0.1, true, 'dot')
      brow(0.1, 0.03)
      grille([F(-0.08, 0.065), F(0, 0.075), F(0.08, 0.06), F(0.05, 0.1), F(-0.05, 0.1)])
      break
    case 'wow':
      eye(-0.1, true, 'big')
      eye(0.1, true, 'big')
      brow(-0.1, 0.05)
      brow(0.1, 0.05)
      grille(roundRect(...F(0, 0.085), s * 0.06, s * 0.07, s * 0.03, tilt))
      break
    case 'effort': {
      // eyes squeezed shut like > <, teeth clenched
      for (const [ex, k] of [
        [-0.1, 1],
        [0.1, -1],
      ] as const) {
        const [cx, cy] = F(ex, -0.035)
        p.shape(ellipse(p, cx, cy, s * 0.066, s * 0.066), { color: '#9c8458', shadow: '#6b5838', light: '#d8c08a', lightAngle: o.light, depth: s * 0.02 })
        p.shape(ellipse(p, cx, cy, s * 0.048, s * 0.048), { color: adjust(lens, -0.1), shadow: adjust(lens, -0.2), lightAngle: o.light, depth: s * 0.02 })
        p.stroke([F(ex - k * 0.03, -0.065), F(ex + k * 0.025, -0.035), F(ex - k * 0.03, -0.005)], { color: INK, width: s * 0.016, load: 1, taper: [0.1, 0.1], smooth: false })
      }
      brow(-0.1, -0.02)
      brow(0.1, -0.02)
      grille([F(-0.12, 0.05), F(0.12, 0.05), F(0.12, 0.11), F(-0.12, 0.11)])
      // sweat drop
      const [dx, dy] = F(0.26, -0.12)
      p.shape(p.blob([[dx, dy - s * 0.035], [dx + s * 0.018, dy], [dx, dy + s * 0.015], [dx - s * 0.018, dy]]), { color: '#9fd3e6', shadow: '#6aa9c2', light: '#e6f7fb', lightAngle: o.light, depth: s * 0.01 })
      break
    }
    case 'love':
      eye(-0.1, true, 'heart')
      eye(0.1, true, 'heart')
      grille([F(-0.09, 0.06), F(0, 0.075), F(0.09, 0.06), F(0.06, 0.1), F(0, 0.115), F(-0.06, 0.1)])
      break
  }
  // rosy cheek dabs, because they're happy
  for (const side of [-1, 1]) {
    const [cx, cy] = F(side * 0.17, 0.06)
    p.stroke(
      [
        [cx - s * 0.02, cy],
        [cx + s * 0.02, cy + s * 0.004],
      ],
      { color: '#e08a78', width: s * 0.026, load: 0.6, grain: 0.7, opacity: 0.7 },
    )
  }
  return { hands: hands as [Pt, Pt], head: [hcx, hcy] as Pt }
}

/** Porto's finest: a francesinha on a plate, sauce dripping, egg on top. Anchored at the bottom centre. */
export function francesinha(p: Painter, x: number, y: number, s: number, rot = 0, plate = true) {
  const c = Math.cos(rot)
  const sn = Math.sin(rot)
  const R = (dx: number, dy: number): Pt => [x + (dx * c - dy * sn) * s, y + (dx * sn + dy * c) * s]
  const light = -2.3
  if (plate) {
    const pm = p.mask((ctx) => {
      ctx.beginPath()
      ctx.ellipse(x, y, s * 0.75, s * 0.16, rot, 0, Math.PI * 2)
      ctx.fill()
    })
    p.shape(pm, { color: '#f3efe6', shadow: '#c9c6bf', lightAngle: light, depth: s * 0.1 })
  }
  // bread stack
  const bread = p.blob(roundRect(...R(0, -0.24), s * 0.9, s * 0.42, s * 0.08, rot))
  p.shape(bread, { color: '#d9a35e', shadow: '#a8743c', lightAngle: light, depth: s * 0.14 })
  for (const dy of [-0.3, -0.18])
    p.line([R(-0.42, dy), R(0.42, dy)], { color: dy < -0.2 ? '#b8574a' : '#e9c36a', width: s * 0.05, clip: bread, opacity: 0.9 })
  // sauce: blanket over the top with drips down the sides
  const sauce: Pt[] = [R(-0.5, -0.38), R(-0.3, -0.5), R(0, -0.53), R(0.3, -0.5), R(0.5, -0.38), R(0.48, -0.1), R(0.4, -0.25), R(0.3, -0.05), R(0.18, -0.28)]
  sauce.push(R(0.02, -0.12), R(-0.12, -0.3), R(-0.28, -0.02), R(-0.36, -0.28), R(-0.48, -0.15))
  p.shape(p.blob(sauce), { color: '#d4552f', shadow: '#a53b22', light: '#e8784a', lightAngle: light, depth: s * 0.12 })
  // fried egg
  p.shape(
    p.blob([R(-0.28, -0.52), R(-0.1, -0.62), R(0.15, -0.6), R(0.3, -0.5), R(0.1, -0.44), R(-0.18, -0.45)]),
    { color: '#f7f3ea', shadow: '#dcd6ca', lightAngle: light, depth: s * 0.06 },
  )
  const [yx, yy] = R(0.02, -0.535)
  p.shape(
    p.mask((ctx) => {
      ctx.beginPath()
      ctx.ellipse(yx, yy, s * 0.1, s * 0.07, rot, 0, Math.PI * 2)
      ctx.fill()
    }),
    { color: '#f2b233', shadow: '#d88f1e', light: '#f9d26c', lightAngle: light, depth: s * 0.05 },
  )
}

/** Wobbly ink outline around a closed shape. */
function outline(p: Painter, pts: Pt[], width: number) {
  p.line(smoothPath([...pts, pts[0], pts[1]], 3), { color: INK, width, wobble: 0.6, load: 0.85, grain: 0.5 })
}

/** A Porto seagull gliding, wings raised; returns the beak tip (for whatever it stole). */
export function seagull(p: Painter, x: number, y: number, span: number, dir: 1 | -1 = 1): Pt {
  const s = span
  const light = -2.3
  const D = (dx: number, dy: number): Pt => [x + dx * s * dir, y + dy * s]
  const lw = Math.max(1.5, s * 0.007)
  const grey = '#b5bdc4'
  const greyShadow = '#88919a'
  const part = (pts: Pt[], color: ColorLike, shadow: ColorLike, depth: number, line = true, sharp = false) => {
    p.shape(sharp ? p.polygon(pts, 0.5) : p.blob(pts), { color, shadow, light: adjust(color, 0.06), lightAngle: light, depth: s * depth })
    if (line) sharp ? p.line([...pts, pts[0]], { color: INK, width: lw, wobble: 0.6, load: 0.85 }) : outline(p, pts, lw)
  }
  // far wing, raised behind the body
  part([D(0.0, -0.05), D(0.08, -0.17), D(-0.2, -0.46), D(-0.12, -0.3), D(-0.08, -0.14), D(-0.09, -0.04)], adjust(grey, -0.07), greyShadow, 0.03, true, true)
  part([D(-0.06, -0.33), D(-0.2, -0.46), D(-0.13, -0.32)], '#2d2f33', '#1d1e21', 0.01, false, true)
  // tail and body
  part([D(-0.26, -0.01), D(-0.4, -0.04), D(-0.42, 0.03), D(-0.26, 0.04)], '#f1efe9', '#c9cac8', 0.02)
  part([D(-0.3, 0.0), D(-0.18, -0.06), D(0.05, -0.085), D(0.2, -0.08), D(0.29, -0.045), D(0.3, -0.005), D(0.22, 0.05), D(0.0, 0.08), D(-0.2, 0.05)], '#f6f4ee', '#cdcfce', 0.06)
  // head, eye, beak with the red spot
  const head = [D(0.21, -0.08), D(0.27, -0.105), D(0.33, -0.08), D(0.33, -0.03), D(0.26, -0.01), D(0.21, -0.04)]
  part(head, '#f8f6f0', '#d3d4d2', 0.02)
  p.fill(
    p.mask((ctx) => {
      ctx.beginPath()
      ctx.ellipse(...D(0.285, -0.07), s * 0.009, s * 0.009, 0, 0, Math.PI * 2)
      ctx.fill()
    }),
    { color: '#1d1d1f', load: 1 },
  )
  const beak = [D(0.32, -0.065), D(0.42, -0.05), D(0.415, -0.035), D(0.32, -0.035)]
  part(beak, '#f1c23e', '#c99a22', 0.008)
  p.stroke([D(0.395, -0.042), D(0.405, -0.038)], { color: '#d6402f', width: s * 0.012, load: 1, taper: [0, 0] })
  // near wing: shoulder → wrist → swept tip, feathered trailing edge
  const wing = [D(0.05, -0.04), D(0.17, -0.2), D(0.06, -0.34), D(-0.16, -0.58), D(-0.11, -0.47), D(-0.07, -0.38), D(-0.05, -0.29), D(-0.02, -0.2), D(-0.03, -0.12), D(-0.07, -0.03)]
  part(wing, grey, greyShadow, 0.05, true, true)
  part([D(0.02, -0.39), D(-0.16, -0.58), D(-0.11, -0.47), D(-0.06, -0.38)], '#2d2f33', '#1d1e21', 0.01, false, true)
  p.fill(
    p.mask((ctx) => {
      ctx.beginPath()
      ctx.ellipse(...D(-0.1, -0.5), s * 0.01, s * 0.008, 0, 0, Math.PI * 2)
      ctx.fill()
    }),
    { color: '#f4f2ec', load: 1 },
  )
  // feather lines
  for (const t of [0.3, 0.5, 0.7]) p.line([D(0.08 - t * 0.12, -0.12 - t * 0.25), D(-0.03 - t * 0.06, -0.1 - t * 0.26)], { color: greyShadow, width: lw * 0.7, opacity: 0.7, wobble: 0.2 })
  // legs tucked
  p.stroke([D(-0.12, 0.04), D(-0.2, 0.06)], { color: '#e3a07a', width: s * 0.012, load: 1, taper: [0, 0.3] })
  return D(0.42, -0.045)
}

/** A laptop held open with a big green check on the screen. */
export function laptop(p: Painter, x: number, y: number, w: number, rot = 0) {
  const c = Math.cos(rot)
  const sn = Math.sin(rot)
  const R = (dx: number, dy: number): Pt => [x + (dx * c - dy * sn) * w, y + (dx * sn + dy * c) * w]
  const lid = p.polygon([R(-0.5, 0), R(0.5, 0), R(0.46, -0.66), R(-0.46, -0.66)], 0.5)
  p.shape(lid, { color: '#b9bec4', shadow: '#8d939a', lightAngle: -2.3, depth: w * 0.08 })
  const scr = p.polygon([R(-0.42, -0.05), R(0.42, -0.05), R(0.39, -0.6), R(-0.39, -0.6)], 0.4)
  p.fill(scr, { color: '#24303a', load: 1 })
  p.stroke([R(-0.15, -0.33), R(-0.04, -0.2), R(0.18, -0.48)], { color: '#6fe08f', width: w * 0.07, load: 1, taper: [0.1, 0.1], grain: 0.2 })
  const base = p.polygon([R(-0.52, 0), R(0.52, 0), R(0.56, 0.08), R(-0.56, 0.08)], 0.4)
  p.shape(base, { color: '#c9cdd2', shadow: '#9aa0a6', lightAngle: -2.3, depth: w * 0.03 })
}

/** Hand-painted sign on a stick. Text is painted after with `p.text`. Returns the board centre. */
export function sign(p: Painter, x: number, y: number, w: number, h: number, board: ColorLike, rot = 0): Pt {
  const top: Pt = [x + Math.sin(rot) * h * 2.2, y - Math.cos(rot) * h * 2.2]
  p.stroke([[x, y], top], { color: '#8a6a48', width: w * 0.07, load: 0.95, taper: [0, 0] })
  const cx = top[0]
  const cy = top[1] - h * 0.3
  const m = p.blob(roundRect(cx, cy, w, h, h * 0.12, rot))
  p.shape(m, { color: board, shadow: adjust(board, -0.1), lightAngle: -2.3, depth: h * 0.15 })
  return [cx, cy]
}

/** Tiny cavaquinho (Portuguese four-string guitar). */
export function cavaquinho(p: Painter, x: number, y: number, s: number, rot: number) {
  const c = Math.cos(rot)
  const sn = Math.sin(rot)
  const R = (dx: number, dy: number): Pt => [x + (dx * c - dy * sn) * s, y + (dx * sn + dy * c) * s]
  p.stroke([R(0.1, 0), R(0.95, 0)], { color: '#6b4a2e', width: s * 0.09, load: 1, taper: [0, 0] })
  p.stroke([R(0.92, 0), R(1.08, 0)], { color: '#4a3220', width: s * 0.13, load: 1, taper: [0, 0] })
  const body = p.blob([R(-0.35, 0), R(-0.3, -0.2), R(-0.08, -0.17), R(0.0, -0.12), R(0.15, -0.15), R(0.22, 0), R(0.15, 0.15), R(0.0, 0.12), R(-0.08, 0.17), R(-0.3, 0.2)])
  p.shape(body, { color: '#d09a52', shadow: '#a26f33', lightAngle: -2.3, depth: s * 0.08 })
  p.fill(
    p.mask((ctx) => {
      ctx.beginPath()
      ctx.ellipse(...R(-0.02, 0), s * 0.05, s * 0.05, 0, 0, Math.PI * 2)
      ctx.fill()
    }),
    { color: '#3a2a1d', load: 1 },
  )
  for (const k of [-0.03, 0.03]) p.line([R(-0.25, k), R(1.0, k * 0.6)], { color: '#efe6d2', width: 1, opacity: 0.7, wobble: 0 })
}

/** Little floating music note. */
export function note(p: Painter, x: number, y: number, s: number, color: ColorLike) {
  p.fill(
    p.mask((ctx) => {
      ctx.beginPath()
      ctx.ellipse(x, y, s * 0.28, s * 0.2, -0.4, 0, Math.PI * 2)
      ctx.fill()
    }),
    { color, load: 1 },
  )
  p.stroke(
    [
      [x + s * 0.24, y - s * 0.05],
      [x + s * 0.26, y - s],
      [x + s * 0.6, y - s * 0.7],
    ],
    { color, width: s * 0.1, load: 1, taper: [0, 0.3], smooth: false },
  )
}


/** Pastel de nata tumbling: fluted flaky cup, custard top with scorched spots, speed lines. (x, y) is its centre. */
export function nata(p: Painter, x: number, y: number, r: number, tilt = 0.5) {
  const rng = p.rng
  const light = -0.6
  const c = Math.cos(tilt)
  const sn = Math.sin(tilt)
  const R = (u: number, v: number): Pt => [x + (u * c - v * sn) * r, y + (u * sn + v * c) * r]
  // speed lines trailing uphill (to the right)
  for (let k = 0; k < 4; k++) {
    const yy = y - r * 0.5 + k * r * 0.35
    p.stroke(
      [
        [x + r * 1.3, yy],
        [x + r * (2.1 + rng.range(0, 0.9)), yy - r * 0.3],
      ],
      { color: INK, width: Math.max(1.5, r * 0.05), load: 0.8, taper: [0.1, 0.5], opacity: 0.7 },
    )
  }
  // fluted cup, wider at the top
  const cm = p.blob([R(-1, -0.15), R(-0.5, -0.05), R(0.5, -0.05), R(1, -0.15), R(0.8, 0.75), R(0, 0.82), R(-0.8, 0.75)])
  p.shape(cm, { color: '#d9984a', shadow: '#9e6229', light: '#f0c27a', lightAngle: light, depth: r * 0.35, angle: tilt + Math.PI / 2 })
  for (let k = 1; k < 8; k++) {
    const t = k / 8
    p.line([R(-1 + 2 * t, -0.1), R(-0.78 + 1.56 * t, 0.76)], { color: '#8e5524', width: Math.max(1.2, r * 0.04), clip: cm, opacity: 0.75, wobble: 0.3 })
  }
  // custard top: an ellipse with a burnt, blistered surface
  const top = p.mask((ctx) => {
    ctx.beginPath()
    ctx.ellipse(...R(0, -0.15), r * 0.98, r * 0.36, tilt, 0, Math.PI * 2)
    ctx.fill()
  })
  p.shape(top, { color: '#c9853c', shadow: '#9e6229', lightAngle: light, depth: r * 0.1 })
  const custard = p.mask((ctx) => {
    ctx.beginPath()
    ctx.ellipse(...R(0, -0.17), r * 0.8, r * 0.26, tilt, 0, Math.PI * 2)
    ctx.fill()
  })
  p.shape(custard, { color: '#f4cf58', shadow: '#e2a93b', light: '#fbe58e', lightAngle: light, depth: r * 0.12 })
  for (let k = 0; k < 9; k++) {
    const [sx, sy] = R(rng.range(-0.6, 0.6), -0.17 + rng.range(-0.15, 0.15))
    p.stroke([[sx - r * 0.07, sy], [sx + r * 0.07, sy + r * 0.02]], { color: rng.pick(['#4a2a14', '#6e3c1c']), width: r * rng.range(0.08, 0.15), load: 0.85, grain: 0.6, clip: custard })
  }
  outline(p, [R(-1, -0.15), R(-0.5, -0.32), R(0.5, -0.32), R(1, -0.15), R(0.8, 0.75), R(0, 0.82), R(-0.8, 0.75)], Math.max(1.5, r * 0.035))
}

/** A silver sardine, for gulls to steal. Centred at (x, y), pointing along `angle`. */
export function sardine(p: Painter, x: number, y: number, len: number, angle = 0) {
  const c = Math.cos(angle)
  const sn = Math.sin(angle)
  const R = (u: number, v: number): Pt => [x + (u * c - v * sn) * len, y + (u * sn + v * c) * len]
  const body = [R(-0.42, 0), R(-0.2, -0.1), R(0.2, -0.11), R(0.48, -0.03), R(0.5, 0.01), R(0.2, 0.09), R(-0.2, 0.08)]
  p.shape(p.blob(body), { color: '#a9bccb', shadow: '#5f7488', light: '#e6eef3', lightAngle: -0.6, depth: len * 0.08, angle })
  p.stroke([R(-0.3, -0.03), R(0.3, -0.06)], { color: '#3e5f7c', width: len * 0.05, load: 0.8, opacity: 0.8 })
  p.shape(p.polygon([R(-0.4, 0), R(-0.58, -0.12), R(-0.55, 0.12)], 0.3), { color: '#8ea3b4', shadow: '#5f7488', lightAngle: -0.6, depth: len * 0.03 })
  p.fill(
    p.mask((ctx) => {
      ctx.beginPath()
      ctx.ellipse(...R(0.38, -0.02), len * 0.022, len * 0.022, 0, 0, Math.PI * 2)
      ctx.fill()
    }),
    { color: '#1d1d1f', load: 1 },
  )
  outline(p, body, Math.max(1.2, len * 0.012))
}

/** Unimpressed cat loafing on a windowsill, tail hanging down. (x, y) is the sill under its front paws. */
export function cat(p: Painter, x: number, y: number, s: number, fur: ColorLike, stripes: ColorLike) {
  const light = -0.6
  const lw = Math.max(1.4, s * 0.02)
  // tail hanging over the sill
  const tail: Pt[] = [
    [x + s * 0.32, y - s * 0.05],
    [x + s * 0.42, y + s * 0.25],
    [x + s * 0.36, y + s * 0.55],
    [x + s * 0.44, y + s * 0.72],
  ]
  p.shape(p.tube(tail, (t) => s * (0.11 - 0.04 * t)), { color: fur, shadow: adjust(fur, -0.12), lightAngle: light, depth: s * 0.05 })
  const body: Pt[] = [
    [x - s * 0.4, y],
    [x - s * 0.38, y - s * 0.3],
    [x - s * 0.1, y - s * 0.42],
    [x + s * 0.25, y - s * 0.38],
    [x + s * 0.42, y - s * 0.18],
    [x + s * 0.4, y],
  ]
  p.shape(p.blob(body), { color: fur, shadow: adjust(fur, -0.12), light: adjust(fur, 0.06), lightAngle: light, depth: s * 0.14 })
  for (let k = 0; k < 4; k++) {
    const sx = x - s * 0.05 + k * s * 0.1
    p.stroke(
      [
        [sx, y - s * 0.4],
        [sx + s * 0.03, y - s * 0.22],
      ],
      { color: stripes, width: s * 0.04, load: 0.8, taper: [0.1, 0.5] },
    )
  }
  outline(p, body, lw)
  // head with ears
  const hx = x - s * 0.32
  const hy = y - s * 0.4
  const head: Pt[] = [
    [hx - s * 0.17, hy + s * 0.08],
    [hx - s * 0.2, hy - s * 0.08],
    [hx - s * 0.16, hy - s * 0.26],
    [hx - s * 0.08, hy - s * 0.15],
    [hx + s * 0.08, hy - s * 0.15],
    [hx + s * 0.16, hy - s * 0.26],
    [hx + s * 0.2, hy - s * 0.08],
    [hx + s * 0.17, hy + s * 0.08],
    [hx, hy + s * 0.14],
  ]
  p.shape(p.polygon(head, 0.6), { color: fur, shadow: adjust(fur, -0.12), light: adjust(fur, 0.06), lightAngle: light, depth: s * 0.08 })
  p.line([...head, head[0]], { color: INK, width: lw, wobble: 0.4 })
  // half-closed, deeply unimpressed eyes
  for (const side of [-1, 1]) {
    const ex = hx + side * s * 0.08
    const ey = hy - s * 0.01
    p.stroke(
      [
        [ex - s * 0.045, ey],
        [ex + s * 0.045, ey],
      ],
      { color: INK, width: s * 0.025, load: 1, taper: [0.1, 0.1] },
    )
    p.stroke(
      [
        [ex - s * 0.035, ey + s * 0.012],
        [ex + s * 0.035, ey + s * 0.012],
      ],
      { color: '#c9d36a', width: s * 0.018, load: 1, taper: [0.2, 0.2] },
    )
  }
  p.stroke(
    [
      [hx - s * 0.02, hy + s * 0.06],
      [hx + s * 0.02, hy + s * 0.06],
    ],
    { color: '#c46b6b', width: s * 0.03, load: 1, taper: [0, 0] },
  )
  // whiskers
  for (const side of [-1, 1])
    for (const k of [-1, 1])
      p.line(
        [
          [hx + side * s * 0.1, hy + s * 0.07],
          [hx + side * s * 0.28, hy + s * (0.05 + k * 0.03)],
        ],
        { color: INK, width: 1, opacity: 0.7, wobble: 0.1 },
      )
}

/** Happy scruffy dog mid-gallop, side view. (x, y) is where the feet meet the ground. */
export function dog(p: Painter, x: number, y: number, s: number, dir: 1 | -1, fur: ColorLike) {
  const light = -0.6
  const D = (dx: number, dy: number): Pt => [x + dx * s * dir, y + dy * s]
  const lw = Math.max(1.5, s * 0.018)
  const dark = adjust(fur, -0.12)
  const limb = (pts: Pt[], w: number, c: ColorLike) => {
    const m = p.tube(pts, () => w * s)
    p.shape(m, { color: c, shadow: adjust(c, -0.12), lightAngle: light, depth: s * 0.04 })
  }
  // far legs, then tail, body, near legs, head
  limb([D(0.28, -0.42), D(0.42, -0.2), D(0.55, -0.04)], 0.09, dark)
  limb([D(-0.3, -0.42), D(-0.45, -0.22), D(-0.62, -0.1)], 0.09, dark)
  limb([D(-0.42, -0.62), D(-0.6, -0.78), D(-0.66, -0.92)], 0.07, fur)
  const body: Pt[] = [D(-0.48, -0.58), D(-0.2, -0.7), D(0.2, -0.72), D(0.42, -0.6), D(0.4, -0.38), D(0.1, -0.34), D(-0.3, -0.36), D(-0.5, -0.42)]
  p.shape(p.blob(body), { color: fur, shadow: dark, light: adjust(fur, 0.07), lightAngle: light, depth: s * 0.12 })
  outline(p, body, lw)
  limb([D(0.32, -0.42), D(0.5, -0.24), D(0.62, -0.12)], 0.1, fur)
  limb([D(-0.36, -0.42), D(-0.5, -0.24), D(-0.48, -0.02)], 0.1, fur)
  // head with floppy ear and tongue out
  const head: Pt[] = [D(0.36, -0.66), D(0.5, -0.86), D(0.68, -0.88), D(0.84, -0.78), D(0.86, -0.7), D(0.66, -0.62), D(0.46, -0.56)]
  p.shape(p.blob(head), { color: fur, shadow: dark, light: adjust(fur, 0.07), lightAngle: light, depth: s * 0.08 })
  outline(p, head, lw)
  p.stroke([D(0.82, -0.66), D(0.86, -0.58), D(0.83, -0.52)], { color: '#e0727a', width: s * 0.06, load: 1, taper: [0.1, 0.3] })
  p.fill(
    p.mask((ctx) => {
      ctx.beginPath()
      ctx.ellipse(...D(0.86, -0.76), s * 0.03, s * 0.025, 0, 0, Math.PI * 2)
      ctx.fill()
    }),
    { color: '#1d1d1f', load: 1 },
  )
  p.stroke([D(0.64, -0.8), D(0.7, -0.78)], { color: '#1d1d1f', width: s * 0.03, load: 1, taper: [0.2, 0.2] })
  const ear: Pt[] = [D(0.5, -0.84), D(0.42, -0.94), D(0.34, -0.8), D(0.42, -0.68)]
  p.shape(p.blob(ear), { color: dark, shadow: adjust(dark, -0.1), lightAngle: light, depth: s * 0.03 })
  outline(p, ear, lw * 0.8)
}

/** Manjerico: a little pot of basil with a paper carnation and a tiny flag, the Santo António gift. */
export function manjerico(p: Painter, x: number, y: number, s: number) {
  const light = -0.6
  const lw = Math.max(1.4, s * 0.02)
  const pot: Pt[] = [
    [x - s * 0.32, y - s * 0.55],
    [x + s * 0.32, y - s * 0.55],
    [x + s * 0.24, y],
    [x - s * 0.24, y],
  ]
  p.shape(p.polygon(pot, 0.5), { color: '#c8673f', shadow: '#94472a', light: '#e08a5c', lightAngle: light, depth: s * 0.12 })
  p.line([...pot, pot[0]], { color: INK, width: lw, wobble: 0.4 })
  p.stroke([[x - s * 0.36, y - s * 0.55], [x + s * 0.36, y - s * 0.55]], { color: '#d77a4f', width: s * 0.1, load: 1, taper: [0, 0] })
  // round basil bush
  const bush = p.mask((ctx) => {
    ctx.beginPath()
    ctx.ellipse(x, y - s * 0.95, s * 0.48, s * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
  })
  p.shape(bush, { color: '#5f9a4a', shadow: '#3f6f33', light: '#86bd62', lightAngle: light, depth: s * 0.2 })
  for (let k = 0; k < 40; k++) {
    const a = p.rng.range(0, Math.PI * 2)
    const d = p.rng.range(0, s * 0.42)
    const lx = x + Math.cos(a) * d
    const ly = y - s * 0.95 + Math.sin(a) * d * 0.85
    p.stroke([[lx, ly], [lx + s * 0.05, ly - s * 0.02]], { color: p.rng.pick(['#4c8a3c', '#78b058', '#3a6a30']), width: s * 0.06, load: 0.9, clip: bush })
  }
  // paper carnation on a stick, and a little flag
  p.line([[x + s * 0.1, y - s * 1.1], [x + s * 0.2, y - s * 1.55]], { color: '#5a7a3a', width: lw, wobble: 0.2 })
  const fl = p.mask((ctx) => {
    ctx.beginPath()
    ctx.ellipse(x + s * 0.21, y - s * 1.6, s * 0.13, s * 0.11, 0, 0, Math.PI * 2)
    ctx.fill()
  })
  p.shape(fl, { color: '#e2483c', shadow: '#a8302a', light: '#f27a6a', lightAngle: light, depth: s * 0.05 })
  p.line([[x - s * 0.12, y - s * 1.1], [x - s * 0.18, y - s * 1.6]], { color: '#8a6a48', width: lw, wobble: 0.2 })
  const flag = p.polygon([[x - s * 0.18, y - s * 1.6], [x - s * 0.5, y - s * 1.55], [x - s * 0.47, y - s * 1.35], [x - s * 0.17, y - s * 1.38]], 0.4)
  p.shape(flag, { color: '#f6efe0', shadow: '#d8cfbd', lightAngle: light, depth: s * 0.04 })
  p.line([[x - s * 0.18, y - s * 1.6], [x - s * 0.5, y - s * 1.55], [x - s * 0.47, y - s * 1.35], [x - s * 0.17, y - s * 1.38]], { color: INK, width: lw * 0.8, wobble: 0.3 })
}

/** Ice cream cone with two scoops and a drip. (x, y) is the tip of the cone. */
export function iceCream(p: Painter, x: number, y: number, s: number, scoops: [ColorLike, ColorLike] = ['#f2a7b8', '#a8dcc4']) {
  const light = -2.5
  const lw = Math.max(1.4, s * 0.025)
  const cone: Pt[] = [
    [x, y],
    [x - s * 0.22, y - s * 0.6],
    [x + s * 0.22, y - s * 0.6],
  ]
  p.shape(p.polygon(cone, 0.4), { color: '#d9a35e', shadow: '#a8743c', light: '#ecc37f', lightAngle: light, depth: s * 0.1 })
  for (const k of [-1, 1]) for (const t of [0.3, 0.6]) p.line([[x + k * s * 0.22 * (1 - t) - k * s * 0.05, y - s * 0.6 * (1 - t)], [x - k * s * 0.15 * (1 - t), y - s * 0.6 + s * 0.05]], { color: '#a8743c', width: lw * 0.8, opacity: 0.7, wobble: 0.2 })
  p.line([...cone, cone[0]], { color: INK, width: lw, wobble: 0.4 })
  for (const [i, c] of scoops.entries()) {
    const cy = y - s * (0.7 + i * 0.28)
    const pts: Pt[] = Array.from({ length: 10 }, (_, k) => {
      const a = (k / 10) * Math.PI * 2
      const wob = k % 2 ? 0.92 : 1
      return [x + Math.cos(a) * s * 0.27 * wob, cy + Math.sin(a) * s * 0.2 * wob] as Pt
    })
    p.shape(p.blob(pts), { color: c, shadow: adjust(c, -0.1), light: adjust(c, 0.06), lightAngle: light, depth: s * 0.1 })
    outline(p, pts, lw)
  }
  p.stroke([[x + s * 0.18, y - s * 0.66], [x + s * 0.2, y - s * 0.52]], { color: scoops[0], width: s * 0.07, load: 1, taper: [0, 0.3] })
}
