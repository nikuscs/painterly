import { mix } from '../src/color.ts'
import { handwrite } from '../src/hand.ts'
import type { Pt } from '../src/math.ts'
import { figure } from '../src/motifs/figure.ts'
import { castShadow, grass, ground, trail } from '../src/motifs/land.ts'
import { cloud, sky } from '../src/motifs/sky.ts'
import { basket, cloth, cottage, gull, post, sagLine, smoke } from '../src/motifs/things.ts'
import { sea } from '../src/motifs/water.ts'
import type { Scene } from '../src/scene.ts'

const W = 1600
const H = 2000
const HORIZON = 1185
const WIND = -0.26

const SKY = {
  top: '#7d8c92',
  bottom: '#c9cfc8',
  strokes: ['#8796a0', '#93a1a6', '#7b8a93', '#a1adae', '#8c979a'],
  highlights: ['#aab6b8', '#b5bebd', '#a3afb3', '#c0c6c1'],
}
const CLOUD = { light: '#f5f0e2', shadow: '#a7aeb2', deep: '#a39caa', sky: '#97a4a9', wind: WIND }
const GRASS = {
  dark: '#4b5739',
  olive: '#6c7950',
  mid: '#85916a',
  sage: '#9da792',
  straw: '#e2d29e',
  ochre: '#c3995a',
}
const GRASS_MIX: [string, number][] = [
  [GRASS.dark, 3],
  [GRASS.olive, 3],
  [GRASS.mid, 2],
  [GRASS.sage, 1.5],
  [GRASS.straw, 2.2],
  [GRASS.ochre, 0.7],
]

// Washing line between two posts, receding to the right.
const POST_A: Pt = [380, 1150]
const POST_B: Pt = [1490, 1128]
const line = sagLine(POST_A, POST_B, 44)

/** Headland: high on the left where the cottage sits, falling away to the cliff on the right. */
const ridge = (x: number) => 1128 + 150 * (x / W) ** 1.6 + 8 * Math.sin(x / 170) + 4 * Math.sin(x / 53 + 1)

export default {
  width: W,
  height: H,
  seed: 21,
  paper: '#efece2',
  draw(p, step) {
    sky(p, { horizon: HORIZON, wind: WIND, ...SKY })
    step('sky')
    cloud(p, {
      spine: [[-80, 760], [160, 640], [420, 520], [640, 430]],
      radius: [190, 200, 160, 110],
      lumps: 12,
      base: 830,
      ...CLOUD,
    })
    cloud(p, {
      spine: [[860, 520], [1060, 380], [1260, 260], [1480, 170], [1700, 120]],
      radius: [100, 150, 170, 150, 120],
      lumps: 12,
      base: 600,
      ...CLOUD,
    })
    cloud(p, { spine: [[1100, 1020], [1300, 990], [1460, 1000]], radius: [60, 70, 50], lumps: 4, base: 1060, body: 0.75, ...CLOUD })
    cloud(p, { spine: [[700, 1090], [800, 1085]], radius: [30, 24], lumps: 2, base: 1110, body: 0.6, ...CLOUD })
    step('clouds')

    sea(p, { horizon: HORIZON, bottom: 1300, deep: '#3e5c63', mid: '#55747a', light: '#7c9798', haze: '#bcc8c3', foam: '#dadfd6' })
    step('sea')

    const land = ground(p, {
      ridge,
      base: '#8a9677',
      base2: '#97a185',
      patches: [GRASS.mid, GRASS.olive, GRASS.sage, '#a8ad8c', '#7e8a63', '#b2a777'],
      haze: '#aab4a6',
      angle: -0.1,
    })
    step('ground')

    const path = trail(p, {
      spine: [[1120, 2040], [980, 1900], [760, 1760], [560, 1600], [420, 1440], [320, 1290], [262, 1160]],
      width: [150, 18],
      colors: ['#d9cea6', '#e4dab8', '#cfc196', mix('#d9cea6', '#ffffff', 0.3)],
      clip: land,
    })
    step('trail')

    grass(p, {
      region: land,
      clip: land,
      count: 6000,
      colors: GRASS_MIX,
      lean: 0.7,
      length: [8, 130],
      width: [1.1, 6],
      falloff: [0.45, 1],
      density: (x, y) => (1 - 0.85 * path.data[Math.floor(y) * p.w + Math.floor(x)]) * (x < 560 && y > H - 110 ? 0.3 : 1),
    })
    step('grass')

    const chimneys = cottage(p, {
      x: 105,
      y: 1150,
      w: 300,
      h: 140,
      depth: 92,
      roofH: 92,
      wall: '#ebe5d4',
      wallShade: '#b9bab2',
      roof: '#4d5864',
      trim: '#dfe2dc',
      door: '#3f5e78',
      windows: 2,
    })
    smoke(p, chimneys[1], { wind: WIND + 0.12, length: 420, color: '#d8d8d0' })
    smoke(p, chimneys[0], { wind: WIND + 0.12, length: 300, color: '#cfd0c9', spread: 0.2 })
    // grass in front of the cottage's footing
    grass(p, {
      region: p.maskFn((x, y) => (x > 80 && x < 520 && y > 1135 && y < 1175 ? 1 : 0)),
      clip: land,
      count: 500,
      colors: GRASS_MIX,
      lean: 0.7,
      length: [10, 22],
      width: [1.2, 2],
    })
    step('cottage')

    post(p, POST_A[0], POST_A[1] - 14, 1712, 15, '#6e604f')
    post(p, POST_B[0], POST_B[1] - 8, 1505, 9, '#6e604f')
    // the line itself
    const linePts: Pt[] = []
    for (let i = 0; i <= 40; i++) linePts.push(line(i / 40))
    p.line(linePts, { color: '#4a4744', width: 2.2, wobble: 0.6 })

    const SHEET = { line, pegs: '#8a6f52' }
    cloth(p, { ...SHEET, from: 0.66, to: 0.72, drop: 92, blow: 54, color: '#e9e3d3', shade: '#b8b6ad', light: '#f6f2e6', stripes: ['#c5503f', 3] })
    cloth(p, { ...SHEET, from: 0.75, to: 0.83, drop: 120, blow: 66, lift: 0.35, color: '#d9b45a', shade: '#a98a43', light: '#e8c977' })
    cloth(p, { ...SHEET, from: 0.86, to: 0.94, drop: 96, blow: 46, color: '#f0ece0', shade: '#b8b8b0', light: '#faf7ee' })
    cloth(p, { ...SHEET, from: 0.45, to: 0.63, drop: 270, blow: 120, lift: 0.3, color: '#a9bfcc', shade: '#7f97a8', light: '#c4d4dc' })
    cloth(p, { ...SHEET, from: 0.21, to: 0.42, drop: 330, blow: 140, lift: 0.28, color: '#efebe0', shade: '#b4b5ae', light: '#fbf8ef' })
    step('laundry')

    basket(p, 452, 1748, 96, 52, '#b58e58', '#e8e2d2')
    castShadow(p, 560, 1774, 150, '#5c6648')
    figure(
      p,
      {
        x: 540,
        ground: 1772,
        height: 520,
        view: 'back',
        facing: 1,
        lean: 0.07,
        armL: { angle: 2.05, bend: 0.75, reach: 0.9 },
        armR: { angle: 2.3, bend: 0.5, reach: 0.85 },
        legL: { angle: -0.08, bend: 0.03 },
        legR: { angle: 0.1, bend: -0.03 },
      },
      {
        skin: '#e0b896',
        hair: '#d6d1c8',
        top: '#c9873e',
        topShadow: '#9a6230',
        legs: '#33405a',
        legsShadow: '#262f44',
        skirt: '#3a4a6a',
        skirtShadow: '#2b3852',
        skirtLength: 1.9,
        shoes: '#2e2a28',
        headscarf: '#b6443a',
      },
      { wind: WIND, light: -2.3 },
    )
    step('figure')

    // foreground grass over the figure's feet and the posts' bases
    grass(p, {
      region: p.maskFn((_x, y) => (y > 1690 ? 1 : 0)),
      clip: land,
      count: 900,
      colors: GRASS_MIX,
      lean: 0.7,
      length: [60, 170],
      width: [3, 7],
      density: (x, y) => (1 - 0.85 * path.data[Math.floor(y) * p.w + Math.floor(x)]) * (x < 560 && y > H - 130 ? 0.15 : 1),
    })
    for (const [x, y, s] of [
      [980, 700, 26],
      [1060, 660, 18],
      [760, 860, 14],
    ] as const)
      gull(p, x, y, s, '#3e4448')
    step('details')

    handwrite(p, 'hold on to the corners', 52, H - 52, { size: 44, color: '#2a2d2a' })
    p.finish()
  },
} satisfies Scene
