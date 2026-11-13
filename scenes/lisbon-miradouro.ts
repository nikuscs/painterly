import { scumble } from '../src/brushwork.ts'
import { vary } from '../src/color.ts'
import { handwrite } from '../src/hand.ts'
import { castle, cityscape, domeChurch, suspensionBridge } from '../src/motifs/city.ts'
import { cavaquinho, iceCream, note } from '../src/motifs/critters.ts'
import { figure } from '../src/motifs/figure.ts'
import { calcada, castShadow } from '../src/motifs/land.ts'
import { cloud, sky } from '../src/motifs/sky.ts'
import { flagpole, gull, portugueseFlag } from '../src/motifs/things.ts'
import { tram } from '../src/motifs/tram.ts'
import { canopy, cypress, jacaranda, roundTree, stonePine } from '../src/motifs/trees.ts'
import type { Scene } from '../src/scene.ts'

const W = 1600
const H = 2000
const WIND = -0.06
/** Late-afternoon sun from the upper left. */
const LIGHT = -2.5
const INK = '#35291f'
const WALL_TOP = 1560
const TERRACE = 1640

const SKY = {
  top: '#79a5cf',
  bottom: '#f3dcb8',
  strokes: ['#86afd3', '#9bbbd8', '#b9c8d8', '#d9cdbf', '#8fb3d4'],
  highlights: ['#d6e2ea', '#f0e2c8', '#e4e6e0', '#f6e6c9'],
}
const CLOUD = { light: '#fdf6e8', shadow: '#d3c4c4', deep: '#b9b1c4', sky: '#b8cde0', wind: WIND }
const PINE = { dark: '#3d5a34', mid: '#577a42', light: '#82a557' }
const GREEN = { dark: '#4c6a3c', mid: '#6d8f4c', light: '#9dbb66' }
const BLOOM = { dark: '#7a5aa8', mid: '#9b7fd1', light: '#c3b0ea', blossom: '#a98bdc' }
const WALLS = ['#f4eee2', '#f1e7d2', '#efe0c2', '#f2d7a6', '#ead2c8', '#d8e2e6', '#f4ecdc', '#e9c89a']
const ROOFS = ['#c0603f', '#b8583a', '#cc7049', '#a94f36', '#d0805a', '#b9776a', '#9e6b5a', '#c98a6e', '#d9a07e']

export default {
  width: W,
  height: H,
  seed: 1147,
  paper: '#f3efe6',
  draw(p, step) {
    sky(p, { horizon: 700, wind: WIND, ...SKY })
    cloud(p, { spine: [[460, 300], [700, 250], [930, 270]], radius: [80, 100, 70], lumps: 7, base: 360, ...CLOUD })
    cloud(p, { spine: [[1000, 520], [1180, 500], [1300, 515]], radius: [44, 52, 36], lumps: 4, base: 560, body: 0.7, ...CLOUD })
    step('sky')

    // across the Tejo: hazy far bank, the statue, the red bridge
    const bank = (x: number) => 652 + 16 * Math.sin(x / 210) + 8 * Math.sin(x / 61)
    const far = p.maskFn((x, y) => (y > bank(x) && y < 712 ? 1 : 0))
    p.fill(far, { color: '#aab3be', color2: '#b9c0c6', streak: 0.5, angle: 0, load: 1 })
    for (let i = 0; i < 140; i++) {
      const x = p.rng.range(0, W)
      const y = p.rng.range(bank(x) + 6, 708)
      p.stroke([[x, y], [x + p.rng.range(2, 5), y]], { color: p.rng.pick(['#e9e6de', '#f0e2cc', '#cdbfb0']), width: 2.5, load: 0.9, clip: far })
    }
    const sx = 1170
    const sy = bank(sx) + 4
    p.stroke([[sx, sy], [sx, sy - 34]], { color: '#959a9c', width: 9, load: 0.95, taper: [0, 0] })
    p.stroke([[sx, sy - 34], [sx, sy - 48]], { color: '#a3a7a8', width: 4, load: 0.95, taper: [0, 0] })
    p.stroke([[sx - 7, sy - 45], [sx + 7, sy - 45]], { color: '#a3a7a8', width: 2.5, load: 0.95, taper: [0, 0] })
    const river = p.maskFn((_x, y) => (y >= 708 && y < 840 ? 1 : 0))
    p.fill(river, { color: '#9fc0cf', color2: '#b4cfd8', streak: 0.5, angle: 0, load: 1 })
    scumble(p, {
      region: river,
      clip: river,
      count: 420,
      color: (x, _y, r) => vary(r, r.weighted([['#89afc2', 3], ['#c4d9de', 2], [x < 800 ? '#fbe9c4' : '#eef3ef', 1]]), 0.015, 0.004),
      angle: 0,
      jitter: 0.02,
      length: [16, 70],
      width: [2, 4],
      load: [0.5, 0.9],
    })
    suspensionBridge(p, { deckY: 716, x0: 860, x1: 1700, towers: [1060, 1420], towerH: 92, waterY: 752, color: '#c65a42', shadow: '#9b4636' })
    step('river')

    // the far city, down to the river
    const green = (x: number, y: number) => Math.max(0, p.noise.fbm(x / 260, y / 160, 3) - 0.15) * 1.4
    cityscape(p, { top: (x) => 790 + 10 * Math.sin(x / 90), bottom: 1150, size: [12, 18], walls: WALLS, roofs: ROOFS, green, foliage: GREEN, lightSide: -1 })
    domeChurch(p, 1180, 940, 120, '#f4f0e6', '#c7c0b2', LIGHT)
    step('far city')

    // castle hill: a green mound with pines and cypresses, walls on top
    const hill = (x: number) => 1150 - 320 * Math.exp(-(((x - 330) / 430) ** 4)) + 6 * Math.sin(x / 37)
    const mound = p.maskFn((x, y) => (y > hill(x) && y < 1160 ? 1 : 0))
    p.fill(mound, { color: '#4c6a3c', color2: '#5a7a44', streak: 0.4, angle: 0, load: 1 })
    // the hill is wooded: a bumpy skyline of crowns, then rows down the slope
    for (let x = -60; x < 900; x += 44) {
      const y = hill(x) + 8
      if (y < 1140) canopy(p, x, y, p.rng.range(34, 50), p.rng.range(24, 32), p.rng.chance(0.3) ? PINE : GREEN, LIGHT, { lobes: 6, leaf: 5 })
    }
    for (let row = 1; row < 8; row++)
      for (let k = 0; k < 16; k++) {
        const x = -60 + (k + p.rng.range(-0.3, 0.3)) * 60
        const y = hill(x) + 10 + row * 30 + p.rng.gauss(0, 8)
        if (y > 1150) continue
        if (p.rng.chance(0.1)) cypress(p, x, y + 20, p.rng.range(60, 90), PINE, LIGHT)
        else canopy(p, x, y, p.rng.range(32, 46), p.rng.range(22, 30), p.rng.chance(0.3) ? PINE : GREEN, LIGHT, { lobes: 6, leaf: 5 })
      }
    castle(p, 150, 852, 360, 96, '#d8c19c', '#a68d68', LIGHT)
    // trees in front of the castle's feet so it sits in the woods
    for (let x = 120; x < 540; x += 52) canopy(p, x + p.rng.gauss(0, 8), 860 + p.rng.gauss(0, 6), p.rng.range(30, 42), p.rng.range(18, 24), GREEN, LIGHT, { lobes: 6, leaf: 5 })
    for (const x of [60, 600]) stonePine(p, x, hill(x) + 40, 110, 0.08, PINE, '#5a4636', LIGHT)
    step('castle')

    // the near city climbing up toward us
    cityscape(p, {
      top: () => 1090,
      bottom: WALL_TOP + 30,
      size: [18, 36],
      walls: WALLS,
      roofs: ROOFS,
      green,
      foliage: GREEN,
      lightSide: -1,
    })
    for (const [x, y, h] of [
      [880, 1170, 90],
      [1320, 1250, 110],
      [520, 1320, 100],
      [1040, 1400, 120],
    ] as const)
      roundTree(p, x, y, h, GREEN, '#5a4636', LIGHT)
    // a tiny 28 tram crossing down in the streets
    tram(p, { x: 250, y: 1356, length: 150, angle: -0.06, body: '#f2c230', cream: '#f1e8d2', roof: '#8f969b', ink: INK, light: LIGHT })
    step('near city')

    // the miradouro: tiled wall, then the terrace
    const wall = p.maskFn((_x, y) => (y >= WALL_TOP && y < TERRACE ? 1 : 0))
    p.fill(wall, { color: '#e9e1cf', color2: '#f1eadb', streak: 0.5, angle: 0, load: 1 })
    const tiles = p.maskFn((_x, y) => (y >= WALL_TOP + 22 && y < TERRACE - 8 ? 1 : 0))
    p.fill(tiles, { color: '#f2efe6', load: 1 })
    for (let x = 0; x < W; x += 26)
      for (let y = WALL_TOP + 26; y < TERRACE - 10; y += 26) {
        p.stroke([[x + 6, y + 6], [x + 18, y + 18]], { color: '#3f6fb0', width: 4, load: 0.85, grain: 0.6, clip: tiles })
        p.stroke([[x + 18, y + 6], [x + 6, y + 18]], { color: '#3f6fb0', width: 4, load: 0.85, grain: 0.6, clip: tiles })
        p.line([[x, y], [x + 26, y]], { color: '#c9c3b5', width: 1, opacity: 0.6, wobble: 0, clip: tiles })
      }
    p.stroke([[-20, WALL_TOP + 8], [W + 20, WALL_TOP + 8]], { color: '#f3ecdc', width: 20, load: 0.95, taper: [0, 0], smooth: false })
    p.line([[-20, WALL_TOP + 19], [W + 20, WALL_TOP + 19]], { color: INK, width: 2, wobble: 0.6, opacity: 0.8 })
    p.line([[-20, TERRACE], [W + 20, TERRACE]], { color: INK, width: 2, wobble: 0.6, opacity: 0.8 })
    const terrace = p.maskFn((_x, y) => (y >= TERRACE ? 1 : 0))
    calcada(p, { region: terrace, angle: 0, light: '#efebe2', dark: '#85858b', spacing: 130, period: 260, avoid: (x, y) => x < 700 && y > H - 110 })
    // bougainvillea spilling over the wall on the right
    for (const [x, y, r] of [
      [1380, WALL_TOP - 10, 120],
      [1520, WALL_TOP - 30, 140],
      [1260, WALL_TOP + 10, 80],
    ] as const)
      canopy(p, x, y, r, r * 0.55, { dark: '#3f5e34', mid: '#5c7d45', light: '#7fa05a', blossom: '#d23c8c' }, LIGHT, { lobes: 10 })
    step('terrace')

    // framing trees: jacaranda on the left, stone pine on the right
    jacaranda(p, 70, 1800, 1650, 0.1, BLOOM, '#4f3b30', LIGHT, 0.55)
    stonePine(p, 1540, 1760, 1420, -0.12, PINE, '#6a5240', LIGHT, 0.6)
    step('trees')

    // a flagpole at the end of the terrace wall
    flagpole(p, [1010, WALL_TOP + 4], [1010, 1170], 9, INK)
    portugueseFlag(p, { at: [1013, 1176], w: 210, h: 140, light: LIGHT, ink: INK, wave: 0.7, phase: 1.1 })
    // people enjoying the view
    for (const [x, w] of [
      [690, 170],
      [830, 170],
      [1230, 200],
      [470, 140],
    ] as const)
      castShadow(p, x + w * 0.3, x === 470 ? 1888 : x === 1230 ? 1912 : 1846, w, '#9a9284', 0)
    figure(
      p,
      {
        x: 690,
        ground: 1842,
        height: 420,
        view: 'back',
        facing: 1,
        lean: 0.05,
        headTilt: 0.12,
        armL: { angle: -0.15, bend: 0.5, reach: 0.7 },
        armR: { angle: 0.6, bend: -0.2, reach: 0.8 },
        legL: { angle: -0.06, bend: 0.02 },
        legR: { angle: 0.08, bend: -0.02 },
      },
      { skin: '#e2b48f', hair: '#3b2b22', top: '#e9c46a', topShadow: '#c49c46', sleeve: 0.3, legs: '#e2b48f', legsShadow: '#c48e6c', skirt: '#e9c46a', skirtShadow: '#c49c46', skirtLength: 2.4, shoes: '#c9473a' },
      { wind: WIND, light: LIGHT },
    )
    figure(
      p,
      {
        x: 830,
        ground: 1844,
        height: 450,
        view: 'back',
        facing: -1,
        build: 1,
        lean: -0.04,
        headTilt: -0.1,
        armL: { angle: -0.55, bend: 0.25, reach: 0.8 },
        armR: { angle: 0.15, bend: -0.4, reach: 0.7 },
        legL: { angle: -0.07, bend: 0.02 },
        legR: { angle: 0.07, bend: -0.02 },
      },
      { skin: '#d9a982', hair: '#2a211c', top: '#9cc3dc', topShadow: '#739fbd', sleeve: 0.45, legs: '#e6dcc6', legsShadow: '#c4b89e', shoes: '#6b4a2e' },
      { wind: WIND, light: LIGHT },
    )
    // a guitarist playing to the view
    const guitarist = figure(
      p,
      {
        x: 1230,
        ground: 1910,
        height: 450,
        view: 'front',
        build: 1,
        armL: { angle: 0.75, bend: 0.9 },
        armR: { angle: -0.35, bend: -1.5 },
        legL: { angle: -0.1, bend: 0.03 },
        legR: { angle: 0.12, bend: -0.03 },
      },
      { skin: '#c99272', hair: '#2a2420', top: '#2f3d63', topShadow: '#222c4a', sleeve: 0.5, legs: '#4b4a5a', legsShadow: '#363542', shoes: '#4a3a2c', face: 'smile', scarf: '#d9493a' },
      { wind: WIND, light: LIGHT },
    )
    const [ga, gb] = guitarist.hands
    cavaquinho(p, (ga[0] + gb[0]) / 2 - 10, (ga[1] + gb[1]) / 2 + 10, 230, -0.55)
    for (const [x, y, s] of [
      [1090, 1520, 30],
      [1040, 1450, 24],
      [1110, 1390, 20],
    ] as const)
      note(p, x, y, s, '#3d3a4a')
    // a kid and an ice cream
    const kid = figure(
      p,
      {
        x: 470,
        ground: 1886,
        height: 300,
        view: 'front',
        armL: { angle: -0.25, bend: 0.1 },
        armR: { angle: 0.9, bend: -1.5 },
        legL: { angle: -0.08, bend: 0.02 },
        legR: { angle: 0.1, bend: -0.03 },
      },
      { skin: '#e2b48f', hair: '#6b4a2e', top: '#e98d78', topShadow: '#c26a58', sleeve: 0.35, legs: '#3f6fb0', legsShadow: '#2f5590', shoes: '#f1ede4', face: 'open' },
      { wind: WIND, light: LIGHT },
    )
    iceCream(p, kid.hands[1][0] + 4, kid.hands[1][1] + 6, 70)
    for (const [x, y, s] of [
      [620, 480, 18],
      [690, 520, 13],
      [980, 600, 11],
    ] as const)
      gull(p, x, y, s, '#4a4544')
    step('people')

    handwrite(p, 'lisboa, menina e moça :)', 52, H - 50, { size: 46, color: '#2f2d2c' })
    p.finish()
  },
} satisfies Scene
