import { scumble } from '../src/brushwork.ts'
import { vary } from '../src/color.ts'
import { handwrite } from '../src/hand.ts'
import type { Pt } from '../src/math.ts'
import { rabelo } from '../src/motifs/boats.ts'
import { archBridge, belltower, houseRow } from '../src/motifs/city.ts'
import { cavaquinho, francesinha, laptop, note, robot, seagull, sign } from '../src/motifs/critters.ts'
import { figure } from '../src/motifs/figure.ts'
import { castShadow } from '../src/motifs/land.ts'
import { cloud, sky } from '../src/motifs/sky.ts'
import { gull } from '../src/motifs/things.ts'
import { reflect } from '../src/motifs/water.ts'
import type { Scene } from '../src/scene.ts'

const W = 1600
const H = 2000
const WIND = -0.12
/** Low evening sun from the upper left (west, downriver). */
const LIGHT = -2.7
const RIVER_TOP = 1268
const QUAY = 1585

const SKY = {
  top: '#8ea3bd',
  bottom: '#f0c497',
  strokes: ['#9fb0c6', '#b7b3c4', '#d9b3a8', '#e8bf9c', '#c9a9b3'],
  highlights: ['#f6d9b2', '#fbe5c4', '#f3cfa8', '#efc7b0'],
}
const CLOUD = { light: '#fdebd0', shadow: '#e0ab9b', deep: '#b897ab', sky: '#e7b99c', wind: WIND }

const FACADES = [
  { color: '#e7b25c' }, // ochre
  { color: '#d9826b' }, // salmon
  { color: '#e9dcc4' }, // cream
  { color: '#c6d2d6', tiles: '#5f86b8' }, // azulejo blue
  { color: '#b9c79e' }, // sage
  { color: '#e4c7a2', tiles: '#c9874d' }, // ochre tiles
  { color: '#d36a52' }, // brick red
  { color: '#efe6d6', tiles: '#6c8fbf' },
]
const ROOFS = ['#b8583a', '#c76a45', '#a94f36', '#c0603f']

/** Ribeira hillside top edge. */
const hill = (x: number) => (x < 330 ? 700 + (330 - x) * 0.45 : 700 + (x - 330) * 0.42) + 8 * Math.sin(x / 47)

export default {
  width: W,
  height: H,
  seed: 33,
  paper: '#f3ede2',
  draw(p, step) {
    sky(p, { horizon: 1050, wind: WIND, ...SKY })
    // sun glow low on the left
    scumble(p, {
      region: (x, y) => Math.max(0, 1 - Math.hypot(x - 170, y - 640) / 330),
      box: [0, 300, 520, 980],
      count: 260,
      color: (x, y, r) => vary(r, Math.hypot(x - 170, y - 640) < 120 ? '#fff4dc' : '#fbe1b6', 0.01, 0.003),
      angle: WIND,
      length: [30, 140],
      width: [8, 26],
      load: [0.4, 0.85],
      grain: 0.55,
    })
    step('sky')
    cloud(p, { spine: [[-80, 380], [140, 300], [380, 240], [560, 200]], radius: [150, 170, 140, 90], lumps: 12, base: 460, ...CLOUD })
    cloud(p, { spine: [[900, 330], [1120, 250], [1380, 200], [1700, 180]], radius: [110, 160, 170, 140], lumps: 14, base: 420, ...CLOUD })
    cloud(p, { spine: [[1050, 620], [1250, 600], [1450, 610]], radius: [50, 60, 45], lumps: 4, base: 650, body: 0.7, ...CLOUD })
    step('clouds')

    // distant upstream hills, hazy violet
    const far = p.maskFn((x, y) => (y > 900 - 40 * Math.sin(x / 260) - x * 0.03 && y < RIVER_TOP + 2 ? 1 : 0))
    p.fill(far, { color: '#b79aa6', color2: '#c7a9ad', streak: 0.4, angle: 0, load: 1 })
    scumble(p, {
      region: far,
      clip: far,
      count: 500,
      color: (_x, _y, r) => vary(r, r.pick(['#a98f9f', '#c4a3a6', '#9f8a9c', '#d0b0a8']), 0.02, 0.004),
      angle: 0,
      length: [40, 140],
      width: [6, 16],
      load: [0.4, 0.75],
    })
    // Ribeira hillside
    const slope = p.maskFn((x, y) => (y > hill(x) && x < 760 ? 1 : 0))
    p.fill(slope, { color: '#9b8f62', color2: '#a99a6a', streak: 0.4, angle: 0, load: 1 })
    scumble(p, {
      region: slope,
      clip: slope,
      count: 900,
      color: (_x, _y, r) => vary(r, r.pick(['#7f7a4c', '#b3a272', '#6d7148', '#c7ab78', '#8c8458']), 0.02, 0.005),
      angle: (x) => (x < 330 ? 0.4 : -0.4),
      jitter: 0.3,
      length: [20, 70],
      width: [6, 18],
      load: [0.5, 0.85],
    })
    belltower(p, 330, hill(330) + 30, 300, '#d9c7a4', '#9d8a6c')
    step('hill')

    // terraces of houses stepping down to the river, back to front
    const tiers: [number, [number, number], [number, number], number, [number, number]][] = [
      [800, [60, 100], [36, 56], 640, [2, 3]],
      [900, [80, 130], [44, 66], 690, [3, 3]],
      [1010, [100, 160], [52, 78], 720, [3, 4]],
      [1130, [120, 180], [62, 90], 740, [3, 4]],
      [RIVER_TOP, [170, 240], [80, 118], 760, [4, 5]],
    ]
    for (const [base, height, width, x1, floors] of tiers) {
      houseRow(p, {
        x0: -30 + p.rng.range(0, 30),
        x1: x1 - (base < 900 ? Math.max(0, 330 - Math.abs(330 - x1)) * 0 : 0),
        base: (x) => Math.max(base, hill(x) + height[0] * 0.6),
        height,
        width,
        palette: FACADES,
        roof: ROOFS,
        floors,
        balconies: base === RIVER_TOP ? 0.9 : 0.5,
        glow: 0.2,
        glowColor: '#f6c46f',
      })
    }
    step('houses')

    archBridge(p, {
      springY: RIVER_TOP,
      crownX: 1250,
      crownY: 818,
      halfSpan: 560,
      depth: 72,
      upperDeck: { y: 788, x0: 700, x1: 1650 },
      lowerDeck: { y: 1190, x0: 720, x1: 1650 },
      iron: '#3e3836',
      stone: '#cdb796',
      stoneShadow: '#8e7a62',
    })
    step('bridge')

    // the Douro
    const river = p.maskFn((_x, y) => (y >= RIVER_TOP && y < QUAY ? 1 : 0))
    p.fill(river, { color: '#3f6f80', color2: '#4d7f8c', streak: 0.5, angle: 0, load: 1, bristle: 2 })
    reflect(p, { waterline: RIVER_TOP, region: river, water: '#3f6f80', count: 2600, strength: 0.65, length: [14, 90] })
    scumble(p, {
      region: river,
      clip: river,
      count: 900,
      color: (x, _y, r) => vary(r, r.weighted([['#2f5a6b', 3], ['#5b8c97', 2], [x < 600 ? '#f2c27e' : '#e8b593', 1.1]]), 0.015, 0.004),
      angle: 0,
      jitter: 0.02,
      length: [20, 120],
      width: [2, 6],
      load: [0.5, 0.9],
    })
    // sun glitter path
    for (let i = 0; i < 260; i++) {
      const y = p.rng.range(RIVER_TOP + 4, QUAY - 10)
      const x = 200 + (y - RIVER_TOP) * 0.25 + p.rng.gauss(0, 30 + (y - RIVER_TOP) * 0.25)
      p.stroke(
        [
          [x - 10, y],
          [x + 10 + p.rng.range(0, 30), y],
        ],
        { color: p.rng.pick(['#fff1cf', '#f9d796']), width: p.rng.range(1.5, 3.5), load: 0.9, grain: 0.4 },
      )
    }
    step('river')

    // boats: a small one upstream, the "lol" one mid-river, a big one moored by the quay
    rabelo(p, { x: 1010, y: 1338, length: 240, dir: 1, hull: '#5a4231', sail: { color: '#e9dcc0' }, barrels: 3, light: LIGHT })
    const lolBoat = rabelo(p, { x: 120, y: 1418, length: 440, dir: 1, hull: '#5c4230', sail: { color: '#f3ead6' }, barrels: 5, light: LIGHT })
    rabelo(p, { x: 1720, y: 1572, length: 760, dir: -1, hull: '#4f3a2b', barrels: 5, light: LIGHT })
    step('boats')

    // Gaia quay: warm granite slabs
    const quay = p.maskFn((_x, y) => (y >= QUAY ? 1 : 0))
    p.fill(quay, { color: '#b9a991', color2: '#c7b79c', streak: 0.5, angle: 0, load: 1 })
    scumble(p, {
      region: quay,
      clip: quay,
      count: 1600,
      color: (_x, _y, r) => vary(r, r.pick(['#a8987f', '#cbbb9f', '#9d8d76', '#d6c5a6', '#b29f84']), 0.02, 0.005),
      angle: 0,
      jitter: 0.05,
      length: [30, 110],
      width: [6, 18],
      load: [0.45, 0.85],
    })
    // slab joints in perspective
    for (let k = 0; k < 6; k++) {
      const y = QUAY + 40 + k * k * 12 + k * 30
      p.line(
        [
          [-10, y],
          [W + 10, y],
        ],
        { color: '#8e7f6a', width: 1.6 + k * 0.4, opacity: 0.6, wobble: 1 },
      )
    }
    for (let k = -10; k < 22; k++) {
      const x = 800 + k * 90
      p.line(
        [
          [800 + k * 40, QUAY],
          [x + (x - 800) * 0.8, H + 10],
        ],
        { color: '#8e7f6a', width: 1.5, opacity: 0.45, wobble: 1 },
      )
    }
    // quay edge: light coping stone with a dark face below
    p.stroke(
      [
        [-20, QUAY + 6],
        [W + 20, QUAY + 6],
      ],
      { color: '#ddd0b8', width: 16, load: 0.95, taper: [0, 0], smooth: false },
    )
    p.stroke(
      [
        [-20, QUAY - 4],
        [W + 20, QUAY - 4],
      ],
      { color: '#5e5446', width: 8, load: 0.85, taper: [0, 0], smooth: false },
    )
    // iron bollard
    const bollard = (x: number, y: number, s: number) => {
      const m = p.blob([
        [x - s * 0.35, y],
        [x - s * 0.3, y - s * 0.7],
        [x - s * 0.45, y - s * 0.85],
        [x, y - s],
        [x + s * 0.45, y - s * 0.85],
        [x + s * 0.3, y - s * 0.7],
        [x + s * 0.35, y],
      ])
      p.shape(m, { color: '#3c3a3b', shadow: '#232224', light: '#6a6462', lightAngle: LIGHT, depth: s * 0.2 })
    }
    bollard(1460, 1655, 70)
    step('quay')

    // ---- the crew
    // long evening shadows stretch to the right
    for (const [x, y, w] of [
      [430, 1888, 220],
      [820, 1918, 300],
      [1170, 1905, 240],
      [300, 1950, 170],
    ] as const)
      castShadow(p, x + w * 0.35, y, w, '#8a7a66', 0.05)

    // laptop bot: all tests green
    robot(p, {
      x: 420,
      ground: 1885,
      size: 250,
      paint: '#c9c2ae',
      trim: '#bf5a3d',
      face: 'happy',
      hands: [
        [366, 1800],
        [474, 1800],
      ],
      headTilt: 0.12,
      light: LIGHT,
    })
    laptop(p, 420, 1806, 128, 0.02)

    // the hero: arms up, conducting the crew
    figure(
      p,
      {
        x: 800,
        ground: 1915,
        height: 470,
        view: 'back',
        facing: 1,
        lean: 0.03,
        armL: { angle: -2.35, bend: -0.35, reach: 0.95 },
        armR: { angle: 2.4, bend: 0.4, reach: 0.95 },
        legL: { angle: -0.1, bend: 0.03 },
        legR: { angle: 0.12, bend: -0.04 },
      },
      {
        skin: '#e2b48f',
        hair: '#3b2b22',
        top: '#33456e',
        topShadow: '#24324f',
        legs: '#4f6d93',
        legsShadow: '#3a5372',
        shoes: '#f1ede4',
        scarf: '#2a62b5',
      },
      { wind: WIND, light: LIGHT },
    )
    // a few short hair tufts
    step('hero')

    // plate bot: the gull just stole the francesinha
    const plateBot = robot(p, {
      x: 1150,
      ground: 1905,
      size: 270,
      paint: '#8fb2a6',
      trim: '#d3a540',
      face: 'wow',
      hands: [
        [1080, 1590],
        [1222, 1586],
      ],
      headTilt: 0.18,
      light: LIGHT,
    })
    const [px, py] = plateBot.hands[0]
    const pm = p.mask((ctx) => {
      ctx.beginPath()
      ctx.ellipse(px + 71, py - 10, 88, 16, -0.03, 0, Math.PI * 2)
      ctx.fill()
    })
    p.shape(pm, { color: '#f4f0e7', shadow: '#cfcac0', lightAngle: LIGHT, depth: 12 })
    // a little crumb trail of sauce
    for (const [dx, dy] of [
      [40, -50],
      [70, -110],
      [95, -170],
    ])
      p.stroke(
        [
          [px + 71 + dx, py + dy],
          [px + 73 + dx, py + dy + 6],
        ],
        { color: '#d4552f', width: 7, load: 1 },
      )
    const beak: Pt = seagull(p, 1170, 1150, 360, 1)
    francesinha(p, beak[0] + 34, beak[1] + 58, 110, 0.3, false)
    step('gull')

    // sign bot on the bollard
    const signBot = robot(p, {
      x: 1462,
      ground: 1592,
      size: 165,
      paint: '#d6a446',
      trim: '#52709a',
      face: 'grin',
      hands: [
        [1420, 1500],
        [1515, 1520],
      ],
      headTilt: -0.1,
      light: LIGHT,
      sitting: true,
    })
    const board = sign(p, signBot.hands[0][0], signBot.hands[0][1] + 10, 130, 62, '#fbf6ea', -0.08)

    // cavaquinho bot
    robot(p, {
      x: 230,
      ground: 1900,
      size: 185,
      paint: '#c4624b',
      trim: '#d9ceb4',
      face: 'wink',
      hands: [
        [200, 1810],
        [262, 1800],
      ],
      headTilt: -0.15,
      light: LIGHT,
      sitting: true,
    })
    cavaquinho(p, 228, 1812, 110, -0.35)
    for (const [x, y, s] of [
      [150, 1700, 34],
      [110, 1630, 26],
      [175, 1575, 20],
    ] as const)
      note(p, x, y, s, '#3d3a4a')
    // more Porto gulls, just watching
    for (const [x, y, s] of [
      [620, 560, 22],
      [700, 520, 16],
      [1500, 960, 14],
    ] as const)
      gull(p, x, y, s, '#4a4544')
    step('crew')

    // words
    handwrite(p, 'lol', lolBoat.sailCenter[0], lolBoat.sailCenter[1] + 18, { size: 64, color: '#a83f2b', weight: 0.12, align: 'center' })
    handwrite(p, 'ship it!', board[0], board[1] + 12, { size: 34, color: '#2e3a52', angle: -0.08, align: 'center', weight: 0.1 })
    handwrite(p, 'everything green :p', 52, H - 50, { size: 46, color: '#3a3330' })
    p.finish()
  },
} satisfies Scene
