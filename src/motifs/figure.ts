import { scumble } from '../brushwork.ts'
import { adjust, mix, vary, type ColorLike } from '../color.ts'
import { curve, lerp, smoothstep, type Pt } from '../math.ts'
import type { Mask, Painter } from '../painter.ts'

/**
 * Angle convention for limbs: radians from straight down, positive swings toward +x.
 * 0 = hanging, π/2 = pointing right, π = straight up, -π/2 = pointing left.
 */
export type Limb = {
  angle: number
  /** Extra rotation of the lower segment (forearm / shin). */
  bend: number
  /** Foreshortening 0..1 when the limb points toward or away from the viewer. */
  reach?: number
  /** Draw in front of the torso. Defaults: arms in front for 'front' view, behind for 'back'. */
  front?: boolean
}

export type Body = {
  /** Feet planted at (x, ground). */
  x: number
  ground: number
  /** Standing height in px. */
  height: number
  view: 'front' | 'back'
  /** Which way the head turns: -1 left, 1 right (shows an ear on that side for back views). */
  facing?: -1 | 1
  /** Torso lean, radians (positive leans right). */
  lean?: number
  headTilt?: number
  /** 0 = slight, 1 = broad. */
  build?: number
  /** Viewer's left/right limbs. */
  armL: Limb
  armR: Limb
  legL: Limb
  legR: Limb
}

export type Outfit = {
  skin: ColorLike
  hair: ColorLike
  /** Loose hair blown downwind, px. Omit for short/tied hair. */
  hairBlow?: number
  top: ColorLike
  topShadow: ColorLike
  /** Sleeves end this far down the forearm (0..1, 1 = wrist). */
  sleeve?: number
  legs: ColorLike
  legsShadow: ColorLike
  /** Optional skirt colour and length below the waist in head units. */
  skirt?: ColorLike
  skirtShadow?: ColorLike
  skirtLength?: number
  shoes: ColorLike
  scarf?: ColorLike
  headscarf?: ColorLike
  /** Front views: a simple friendly face. */
  face?: 'smile' | 'open'
  mustache?: ColorLike
  /** Apron over the front of the clothes. */
  apron?: ColorLike
}

export type FigureOpts = {
  wind: number
  /** Direction the light comes from (radians, e.g. -2.4 = from the upper left). */
  light: number
}

export type Joints = {
  hu: number
  pelvis: Pt
  up: Pt
  side: Pt
  shoulders: [Pt, Pt]
  hips: [Pt, Pt]
  neck: Pt
  head: Pt
  elbows: [Pt, Pt]
  wrists: [Pt, Pt]
  hands: [Pt, Pt]
  knees: [Pt, Pt]
  ankles: [Pt, Pt]
}

const dir = (a: number): Pt => [Math.sin(a), Math.cos(a)]
const add = (a: Pt, d: Pt, k: number): Pt => [a[0] + d[0] * k, a[1] + d[1] * k]

/** Forward kinematics on a 7-head illustration canon, placed so the lower foot meets the ground. */
export function solve(b: Body): Joints {
  const hu = b.height / 7
  const lean = b.lean ?? 0
  const build = b.build ?? 0
  const up: Pt = [Math.sin(lean), -Math.cos(lean)]
  const side: Pt = [Math.cos(lean), Math.sin(lean)]
  const P: Pt = [0, 0]
  const hipHalf = hu * (0.42 - 0.04 * build)
  const shHalf = hu * (0.7 + 0.14 * build)
  const S = add(P, up, hu * 2.45)
  const hips: [Pt, Pt] = [add(P, side, -hipHalf), add(P, side, hipHalf)]
  const shoulders: [Pt, Pt] = [add(S, side, -shHalf), add(S, side, shHalf)]
  const neck = add(S, up, hu * 0.12)
  const tilt = b.headTilt ?? 0
  const head = add(neck, [Math.sin(lean + tilt), -Math.cos(lean + tilt)], hu * 0.56)
  const arm = (sh: Pt, l: Limb) => {
    const k = l.reach ?? 1
    const e = add(sh, dir(l.angle), hu * 1.35 * k)
    const w = add(e, dir(l.angle + l.bend), hu * 1.15 * k)
    const h = add(w, dir(l.angle + l.bend), hu * 0.36)
    return [e, w, h] as const
  }
  const leg = (hp: Pt, l: Limb) => {
    const k = l.reach ?? 1
    const kn = add(hp, dir(l.angle), hu * 1.85 * k)
    const an = add(kn, dir(l.angle + l.bend), hu * 1.75 * k)
    return [kn, an] as const
  }
  const [eL, wL, hL] = arm(shoulders[0], b.armL)
  const [eR, wR, hR] = arm(shoulders[1], b.armR)
  const [kL, aL] = leg(hips[0], b.legL)
  const [kR, aR] = leg(hips[1], b.legR)
  const lowest = Math.max(aL[1], aR[1]) + hu * 0.18
  const T = (p: Pt): Pt => [p[0] + b.x, p[1] + b.ground - lowest]
  return {
    hu,
    pelvis: T(P),
    up,
    side,
    shoulders: [T(shoulders[0]), T(shoulders[1])],
    hips: [T(hips[0]), T(hips[1])],
    neck: T(neck),
    head: T(head),
    elbows: [T(eL), T(eR)],
    wrists: [T(wL), T(wR)],
    hands: [T(hL), T(hR)],
    knees: [T(kL), T(kR)],
    ankles: [T(aL), T(aR)],
  }
}

/** Limb angle that points from a joint toward a target (handy when posing hands onto things). */
export const aim = (from: Pt, to: Pt) => Math.atan2(to[0] - from[0], to[1] - from[1])

/** Torso outline: [depth below the shoulder line, half-width], in head units. */
const TORSO: [number, number][] = [
  [-0.34, 0.24], // neck base
  [-0.16, 0.5], // trapezius
  [0.05, 0.86], // deltoid cap
  [0.4, 0.8], // armpit
  [0.9, 0.7], // ribcage
  [1.45, 0.58], // waist
  [2.05, 0.76], // hips
  [2.5, 0.72], // seat
]

/** Painted figure: one anatomical mask per body part, each form-shaded, clothing as colour. */
export function figure(p: Painter, b: Body, o: Outfit, f: FigureOpts): Joints {
  const rng = p.rng
  const j = solve(b)
  const hu = j.hu
  const build = b.build ?? 0
  // Form-shaded base, then a few dry strokes in nearby tones so clothing has the same hand as the landscape.
  const shade = (m: Mask, color: ColorLike, shadow: ColorLike, depth: number, angle = Math.PI / 2) => {
    p.shape(m, { color, shadow, light: adjust(color, 0.05), lightAngle: f.light, depth, angle })
    const area = (m.x1 - m.x0 + 1) * (m.y1 - m.y0 + 1)
    if (area < hu * hu * 0.3) return
    scumble(p, {
      region: m,
      clip: m,
      count: Math.round(area / (hu * hu * 0.12)),
      color: (_x, _y, r) => vary(r, mix(color, r.chance(0.5) ? shadow : adjust(color, 0.06), r.range(0.2, 0.6)), 0.01, 0.003),
      angle,
      jitter: 0.25,
      length: [hu * 0.3, hu * 1.1],
      width: [hu * 0.03, hu * 0.09],
      load: [0.35, 0.7],
      dryEnd: 0.6,
      edgeDry: 0.5,
      grain: 0.5,
      opacity: 0.8,
    })
  }
  const along = (a: Pt, b: Pt) => Math.atan2(b[1] - a[1], b[0] - a[0])

  // ---- legs: thigh tapers to the knee, calf swells, ankle is slim
  const legWidth = (t: number) => {
    if (t < 0.5) return hu * lerp(0.66, 0.38, smoothstep(0, 0.5, t))
    const s = (t - 0.5) / 0.5
    return hu * (lerp(0.38, 0.19, s) + 0.08 * Math.sin(Math.min(1, s * 1.5) * Math.PI))
  }
  for (const i of [0, 1] as const) {
    shade(p.tube([j.hips[i], j.knees[i], j.ankles[i]], legWidth), i ? o.legs : adjust(o.legs, -0.02), o.legsShadow, hu * 0.16, along(j.hips[i], j.ankles[i]))
    const a = j.ankles[i]
    const toe = b.view === 'back' ? (i ? 0.25 : -0.25) : i ? 0.5 : -0.5
    const foot = p.tube(
      [
        [a[0] - toe * hu * 0.2, a[1] + hu * 0.02],
        [a[0] + toe * hu * 0.35, a[1] + hu * 0.12],
      ],
      (t) => hu * lerp(0.3, 0.24, t),
    )
    shade(foot, o.shoes, adjust(o.shoes, -0.06), hu * 0.08, 0)
  }

  // ---- arms: deltoid → elbow → forearm swell → wrist; sleeve, then a mitten hand
  const armWidth = (t: number) => {
    if (t < 0.53) return hu * lerp(0.38, 0.26, smoothstep(0, 0.53, t))
    const s = (t - 0.53) / 0.47
    return hu * (lerp(0.27, 0.17, s) + 0.05 * Math.sin(Math.min(1, s * 1.6) * Math.PI))
  }
  const sleeve = o.sleeve ?? 1
  const drawArm = (i: 0 | 1) => {
    const sh = j.shoulders[i]
    const el = j.elbows[i]
    const wr = j.wrists[i]
    const hand = j.hands[i]
    if (sleeve < 1) shade(p.tube([el, wr], (t) => armWidth(0.53 + 0.47 * t) * 0.92), o.skin, adjust(o.skin, -0.08), hu * 0.08)
    const cuff: Pt = [lerp(el[0], wr[0], sleeve), lerp(el[1], wr[1], sleeve)]
    shade(
      p.tube([sh, el, cuff], (t) => armWidth(t * (0.53 + 0.47 * sleeve)) * 1.08),
      i ? o.top : adjust(o.top, -0.02),
      o.topShadow,
      hu * 0.14,
      along(sh, cuff),
    )
    const d: Pt = [hand[0] - wr[0], hand[1] - wr[1]]
    const tip: Pt = [hand[0] + d[0] * 0.5, hand[1] + d[1] * 0.5]
    shade(p.tube([wr, hand, tip], (t) => hu * (0.19 + 0.09 * Math.sin(t * Math.PI))), o.skin, adjust(o.skin, -0.09), hu * 0.06)
    const thumbSide = i ? -1 : 1
    const n: Pt = [-d[1] * thumbSide, d[0] * thumbSide]
    p.stroke([add(wr, d, 0.4), add(add(wr, d, 0.9), n, 0.35)], { color: adjust(o.skin, -0.04), width: hu * 0.07, load: 0.95, taper: [0.1, 0.4] })
  }
  const armFront = (l: Limb) => l.front ?? b.view === 'front'
  for (const i of [0, 1] as const) if (!armFront(i ? b.armR : b.armL)) drawArm(i)

  const S: Pt = [(j.shoulders[0][0] + j.shoulders[1][0]) / 2, (j.shoulders[0][1] + j.shoulders[1][1]) / 2]
  const down: Pt = [-j.up[0], -j.up[1]]
  // ---- skirt, blown downwind
  if (o.skirt) {
    const len = (o.skirtLength ?? 2) * hu
    const waist = add(S, down, 1.75 * hu)
    const wc = Math.cos(f.wind)
    const hemPts: Pt[] = []
    for (let k = 0; k <= 6; k++) {
      const t = k / 6
      const across = lerp(-0.95, 1.05, t) * hu
      const flutter = Math.sin(t * Math.PI * 3 + rng.next()) * hu * 0.06
      const blow = wc * hu * (0.15 + 0.45 * t)
      hemPts.push([waist[0] + j.side[0] * across + blow, waist[1] + len + flutter + t * hu * 0.05])
    }
    const skirt = p.blob([add(waist, j.side, -0.6 * hu), add(waist, j.side, 0.62 * hu), ...hemPts.reverse()])
    const skShadow = o.skirtShadow ?? adjust(o.skirt, -0.08)
    shade(skirt, o.skirt, skShadow, hu * 0.3)
    for (let k = 0; k < 4; k++) {
      const t = (k + 1) / 5
      const a = add(waist, j.side, lerp(-0.5, 0.5, t) * hu)
      p.stroke(curve(a[0], a[1], Math.PI / 2 - 0.25 + t * 0.2, len * 0.95, -0.1, 4), {
        color: skShadow,
        width: hu * 0.06,
        load: 0.55,
        opacity: 0.7,
        clip: skirt,
      })
    }
  }

  // ---- torso (over the skirt waistband)
  const left: Pt[] = []
  const right: Pt[] = []
  for (const [depth, half] of TORSO) {
    const c = add(S, down, depth * hu)
    const hw = half * hu * (depth < 1 ? 1 + 0.12 * build : 1 - 0.1 * build)
    left.push(add(c, j.side, -hw))
    right.push(add(c, j.side, hw))
  }
  const torso = p.blob([...left, ...right.reverse()])
  shade(torso, o.top, o.topShadow, hu * 0.35)
  const hemC = add(S, down, 2.35 * hu)
  p.stroke([add(S, down, 0.1 * hu), add(S, down, 1.6 * hu), hemC], { color: o.topShadow, width: hu * 0.05, load: 0.6, opacity: 0.6, clip: torso })
  p.stroke([add(hemC, j.side, -0.74 * hu), hemC, add(hemC, j.side, 0.74 * hu)], { color: o.topShadow, width: hu * 0.06, load: 0.7, clip: torso })

  if (o.apron) {
    const a0 = add(S, down, 0.35 * hu)
    const a1 = add(S, down, 3.3 * hu)
    const apron = p.blob([
      add(a0, j.side, -0.32 * hu),
      add(a0, j.side, 0.32 * hu),
      add(add(S, down, 1.5 * hu), j.side, 0.5 * hu),
      add(a1, j.side, 0.62 * hu),
      add(a1, j.side, -0.62 * hu),
      add(add(S, down, 1.5 * hu), j.side, -0.5 * hu),
    ])
    shade(apron, o.apron, adjust(o.apron, -0.1), hu * 0.25)
    p.line([add(a0, j.side, -0.3 * hu), add(j.neck, j.side, -0.15 * hu)], { color: adjust(o.apron, -0.15), width: hu * 0.05, wobble: 0.3 })
    p.line([add(a0, j.side, 0.3 * hu), add(j.neck, j.side, 0.15 * hu)], { color: adjust(o.apron, -0.15), width: hu * 0.05, wobble: 0.3 })
    const pocket = add(S, down, 2.3 * hu)
    p.line([add(pocket, j.side, -0.25 * hu), add(pocket, j.side, 0.25 * hu)], { color: adjust(o.apron, -0.15), width: hu * 0.04, wobble: 0.3 })
  }

  for (const i of [0, 1] as const) if (armFront(i ? b.armR : b.armL)) drawArm(i)

  // ---- neck and head
  const [hx, hy] = j.head
  const tilt = (b.lean ?? 0) + (b.headTilt ?? 0)
  shade(p.tube([add(j.neck, j.up, -0.15 * hu), add(j.neck, j.up, 0.45 * hu)], () => hu * 0.36), o.skin, adjust(o.skin, -0.1), hu * 0.12)
  const skull = p.mask((ctx) => {
    ctx.beginPath()
    ctx.ellipse(hx, hy - hu * 0.04, hu * 0.42, hu * 0.5, tilt, 0, Math.PI * 2)
    ctx.fill()
  })
  const facing = b.facing ?? -1
  // loose hair goes behind the cap / face
  if (o.headscarf) {
    for (let k = 0; k < 7; k++) {
      const a = facing > 0 ? rng.range(-0.3, 1.2) : rng.range(Math.PI - 1.2, Math.PI + 0.3)
      p.stroke(curve(hx + Math.cos(a) * hu * 0.36, hy + Math.sin(a) * hu * 0.44, f.wind + rng.gauss(0, 0.3), hu * rng.range(0.08, 0.18), rng.gauss(0, 0.5), 4), {
        color: vary(rng, o.hair, 0.02, 0.003),
        width: hu * 0.035,
        taper: [0.05, 0.7],
        load: 0.85,
      })
    }
  }
  if (!o.headscarf && o.hairBlow) {
    for (let k = 0; k < 16; k++) {
      const a = rng.range(-Math.PI * 0.85, Math.PI * 0.15)
      p.stroke(curve(hx + Math.cos(a) * hu * 0.3, hy - hu * 0.1 + Math.sin(a) * hu * 0.3, f.wind + rng.gauss(0, 0.25), o.hairBlow * rng.range(0.5, 1), rng.gauss(0, 0.4), 5), {
        color: vary(rng, k % 3 ? o.hair : adjust(o.hair, 0.08), 0.02, 0.004),
        width: hu * rng.range(0.05, 0.1),
        taper: [0.05, 0.75],
        load: 0.9,
      })
    }
  }
  if (b.view === 'front') {
    if (!o.headscarf) {
      const hair = p.mask((ctx) => {
        ctx.beginPath()
        ctx.ellipse(hx, hy - hu * 0.08, hu * 0.47, hu * 0.52, tilt, 0, Math.PI * 2)
        ctx.fill()
      })
      shade(hair, o.hair, adjust(o.hair, -0.06), hu * 0.16)
    }
    const face = p.mask((ctx) => {
      ctx.beginPath()
      ctx.ellipse(hx, hy + hu * 0.06, hu * 0.36, hu * 0.42, tilt, 0, Math.PI * 2)
      ctx.fill()
    })
    shade(face, o.skin, adjust(o.skin, -0.08), hu * 0.14)
  } else {
    const ear: Pt = [hx + facing * hu * 0.38, hy + hu * 0.05]
    shade(p.tube([ear, [ear[0] + facing * hu * 0.02, ear[1] + hu * 0.14]], () => hu * 0.12), o.skin, adjust(o.skin, -0.1), hu * 0.05)
  }
  const cap = o.headscarf ?? o.hair
  // fringe for front views, full cap from behind
  const capMask =
    b.view === 'front'
      ? p.mask((ctx) => {
          ctx.beginPath()
          ctx.ellipse(hx, hy - hu * 0.12, hu * 0.45, hu * 0.36, tilt, Math.PI * 0.98, Math.PI * 2.02)
          ctx.quadraticCurveTo(hx + hu * 0.1, hy - hu * 0.02, hx - hu * 0.44, hy - hu * 0.08)
          ctx.fill()
        })
      : skull
  shade(capMask, cap, adjust(cap, -0.08), hu * 0.18, tilt + f.wind)
  if (o.headscarf) {
    for (let k = 0; k < 3; k++)
      p.stroke(curve(hx - hu * 0.32, hy - hu * (0.3 - k * 0.2), -0.25 + k * 0.2, hu * 0.6, 0.6, 4), {
        color: adjust(cap, -0.07),
        width: hu * 0.035,
        load: 0.6,
        clip: skull,
      })
    const knot: Pt = [hx - facing * hu * 0.05, hy + hu * 0.42]
    shade(
      p.tube(
        [
          [knot[0] - hu * 0.09, knot[1]],
          [knot[0] + hu * 0.09, knot[1] + hu * 0.02],
        ],
        () => hu * 0.16,
      ),
      adjust(cap, -0.02),
      adjust(cap, -0.1),
      hu * 0.05,
    )
    for (let k = 0; k < 2; k++) {
      const tail = curve(knot[0], knot[1], f.wind + 1.2 + k * 0.5, hu * (0.75 - k * 0.2), k ? -0.5 : 0.7, 6)
      shade(p.tube(tail, (t) => hu * lerp(0.15, 0.04, t) * (1 + 0.4 * Math.sin(t * Math.PI))), k ? adjust(cap, -0.05) : cap, adjust(cap, -0.12), hu * 0.05)
    }
  }

  // ---- friendly face for front views: happy eyes, smile, rosy cheeks
  if (b.view === 'front' && o.face) {
    const F = (dx: number, dy: number): Pt => [hx + dx * hu, hy + dy * hu]
    const ink = '#3a2a22'
    for (const ex of [-0.14, 0.14])
      p.stroke([F(ex - 0.06, 0.04), F(ex, -0.01), F(ex + 0.06, 0.04)], { color: ink, width: hu * 0.035, load: 1, taper: [0.15, 0.15] })
    for (const cx of [-0.22, 0.22])
      p.stroke([F(cx - 0.05, 0.14), F(cx + 0.05, 0.145)], { color: '#e58c7c', width: hu * 0.07, load: 0.6, grain: 0.7, opacity: 0.7 })
    if (o.mustache) p.stroke([F(-0.13, 0.19), F(0, 0.15), F(0.13, 0.19)], { color: o.mustache, width: hu * 0.07, load: 0.95, taper: [0.3, 0.3] })
    if (o.face === 'open') {
      const m = p.blob([F(-0.09, 0.22), F(0.09, 0.22), F(0.06, 0.3), F(0, 0.32), F(-0.06, 0.3)])
      p.fill(m, { color: '#7a3a34', load: 1 })
    } else p.stroke([F(-0.1, 0.22), F(0, 0.28), F(0.1, 0.22)], { color: '#8a3f36', width: hu * 0.035, load: 1, taper: [0.2, 0.2] })
  }

  // ---- neck scarf with tails in the wind
  if (o.scarf) {
    const c = add(j.neck, j.up, -0.1 * hu)
    shade(
      p.tube([add(c, j.side, -0.38 * hu), add(c, j.up, -0.05 * hu), add(c, j.side, 0.38 * hu)], () => hu * 0.22),
      o.scarf,
      adjust(o.scarf, -0.1),
      hu * 0.08,
    )
    for (let k = 0; k < 2; k++) {
      const tail = curve(c[0] + hu * 0.25, c[1] + hu * 0.1, f.wind + 1.1 + k * 0.35, hu * (1.1 - k * 0.3), k ? -0.4 : 0.3, 7)
      shade(p.tube(tail, (t) => hu * lerp(0.2, 0.12, t)), k ? adjust(o.scarf, -0.06) : o.scarf, adjust(o.scarf, -0.12), hu * 0.06)
    }
  }
  return j
}
