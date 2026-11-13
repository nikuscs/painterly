import { scumble } from '../src/brushwork.ts'
import { vary } from '../src/color.ts'
import { handwrite } from '../src/hand.ts'
import type { Pt } from '../src/math.ts'
import { houseRow, suspensionBridge } from '../src/motifs/city.ts'
import { cat, dog, manjerico, nata, sardine, seagull } from '../src/motifs/critters.ts'
import { figure } from '../src/motifs/figure.ts'
import { calcada, castShadow } from '../src/motifs/land.ts'
import { cloud, sky } from '../src/motifs/sky.ts'
import { bunting, flagpole, grill, gull, portugueseFlag, smoke } from '../src/motifs/things.ts'
import { tram } from '../src/motifs/tram.ts'
import type { Scene } from '../src/scene.ts'

const W = 1600
const H = 2000
const WIND = -0.08
/** Afternoon sun from the upper right. */
const LIGHT = -0.6
const SLOPE = 0.36
const INK = '#35291f'

/** Far edge of the street (where the buildings stand), climbing to the right. */
const street = (x: number) => 1500 - SLOPE * x
const rail = (x: number) => street(x) + 95
const curb = (x: number) => street(x) + 150

const SKY = {
  top: '#5d8fc4',
  bottom: '#d9e5e4',
  strokes: ['#6f9bcb', '#7fa7cf', '#8fb2d2', '#a4c1d8', '#6a94c4'],
  highlights: ['#c5d9e6', '#d6e4ea', '#b8d0e2', '#e4ecec'],
}
const CLOUD = { light: '#fbf8f0', shadow: '#bfcbd6', deep: '#aab5cb', sky: '#9fbedb', wind: WIND }
const FACADES = [
  { color: '#f0cf6a' },
  { color: '#e8a7a0' },
  { color: '#d4e3ea', tiles: '#3f6fb0' },
  { color: '#c3dac6', tiles: '#3e8a6a' },
  { color: '#e3a25a' },
  { color: '#f2ece0', tiles: '#4a78b5' },
  { color: '#d2bfdc' },
  { color: '#f3e3b8', tiles: '#c27a3c' },
]
const ROOFS = ['#b8583a', '#c76a45', '#a94f36', '#bd6542']

export default {
  width: W,
  height: H,
  seed: 28,
  paper: '#f3efe6',
  draw(p, step) {
    sky(p, { horizon: 880, wind: WIND, ...SKY })
    cloud(p, { spine: [[60, 330], [260, 280], [420, 300]], radius: [70, 90, 60], lumps: 6, base: 380, ...CLOUD })
    cloud(p, { spine: [[620, 160], [820, 120], [1000, 140]], radius: [60, 80, 55], lumps: 5, base: 210, ...CLOUD })
    cloud(p, { spine: [[300, 640], [420, 625]], radius: [34, 28], lumps: 3, base: 665, body: 0.7, ...CLOUD })
    step('sky')

    // the Tejo, the far bank, the red bridge and the statue on the hill
    const river = p.maskFn((_x, y) => (y >= 868 ? 1 : 0))
    p.fill(river, { color: '#86aac0', color2: '#9bbccc', streak: 0.5, angle: 0, load: 1 })
    scumble(p, {
      region: river,
      clip: river,
      count: 500,
      color: (_x, _y, r) => vary(r, r.weighted([['#7299b3', 3], ['#a9c6d3', 2], ['#e8f0ef', 0.8]]), 0.015, 0.004),
      angle: 0,
      jitter: 0.02,
      length: [20, 80],
      width: [2, 5],
      load: [0.5, 0.9],
    })
    const farBank = (x: number) => 800 + 22 * Math.sin(x / 190) + 10 * Math.sin(x / 53)
    const bank = p.maskFn((x, y) => (y > farBank(x) && y < 872 ? 1 : 0))
    p.fill(bank, { color: '#9fb0a6', color2: '#b2bfb2', streak: 0.5, angle: 0, load: 1 })
    for (let i = 0; i < 160; i++) {
      const x = p.rng.range(0, 900)
      const y = p.rng.range(farBank(x) + 6, 866)
      p.stroke(
        [
          [x, y],
          [x + p.rng.range(3, 7), y],
        ],
        { color: p.rng.pick(['#eeeadf', '#f3e6cf', '#d9c6b0']), width: 3, load: 0.9, clip: bank },
      )
    }
    // statue: pedestal and figure with open arms
    const sx = 700
    const sy = farBank(sx) + 6
    p.stroke([[sx, sy], [sx, sy - 44]], { color: '#8d8f8c', width: 11, load: 0.95, taper: [0, 0] })
    p.stroke([[sx, sy - 44], [sx, sy - 62]], { color: '#9b9c98', width: 5, load: 0.95, taper: [0, 0] })
    p.stroke([[sx - 9, sy - 58], [sx + 9, sy - 58]], { color: '#9b9c98', width: 3, load: 0.95, taper: [0, 0] })
    suspensionBridge(p, { deckY: 905, x0: -40, x1: 720, towers: [140, 520], towerH: 150, waterY: 960, color: '#c4472f', shadow: '#8f2f1f' })
    step('river')

    // houses climbing the hill, short on the left so the river shows
    houseRow(p, {
      x0: -40,
      x1: 1680,
      base: (cx) => street(cx) + 30,
      height: (x) => {
        const t = Math.min(1, Math.max(0, x / 1600))
        return [330 + 420 * t * t, 400 + 400 * t * t]
      },
      width: [130, 190],
      palette: FACADES,
      roof: ROOFS,
      floors: [3, 5],
      balconies: 0.7,
      glow: 0.08,
      glowColor: '#fbe7a8',
    })
    step('houses')

    // cobbled street with tram rails
    const road = p.maskFn((x, y) => (y >= street(x) && y < curb(x) + 2 ? 1 : 0))
    p.fill(road, { color: '#8e8983', color2: '#9d978f', streak: 0.5, angle: Math.atan(-SLOPE), load: 1 })
    scumble(p, {
      region: road,
      clip: road,
      count: 2600,
      color: (_x, _y, r) => vary(r, r.pick(['#7b7671', '#a29c93', '#6e6a66', '#b1aaa0']), 0.02, 0.004),
      angle: Math.atan(-SLOPE),
      jitter: 0.1,
      length: [5, 11],
      width: [4, 7],
      load: [0.6, 0.9],
    })
    for (const off of [-30, 0]) {
      const pts: Pt[] = [
        [-20, rail(-20) + off],
        [W + 20, rail(W + 20) + off],
      ]
      p.line(pts, { color: '#4a4643', width: 5, wobble: 0.3 })
      p.line(pts.map(([x, y]) => [x, y - 2] as Pt), { color: '#d8d4cc', width: 2, wobble: 0.3 })
    }
    // the near pavement: calçada with basalt waves
    const walk = p.maskFn((x, y) => (y >= curb(x) + 6 ? 1 : 0))
    calcada(p, {
      region: walk,
      angle: Math.atan(-SLOPE),
      light: '#efebe2',
      dark: '#56565b',
      spacing: 120,
      period: 230,
      avoid: (x, y) => x < 560 && y > H - 120,
    })
    p.stroke([[-20, curb(-20) + 4], [W + 20, curb(W + 20) + 4]], { color: '#d9d2c2', width: 12, load: 0.95, taper: [0, 0], smooth: false })
    p.line([[-20, curb(-20) + 10], [W + 20, curb(W + 20) + 10]], { color: INK, width: 2, wobble: 0.5, opacity: 0.7 })
    step('street')

    // festival bunting strung along the hill
    const flags = ['#d9493a', '#f0c64e', '#3e8a6a', '#4a78b5', '#e98fa3', '#f6efe0']
    bunting(p, [-20, street(-20) - 470], [820, street(820) - 470], { sag: 46, size: 34, colors: flags, string: '#5b4a3c' })
    bunting(p, [820, street(820) - 470], [1660, street(1660) - 470], { sag: 46, size: 34, colors: flags.slice(2).concat(flags.slice(0, 2)), string: '#5b4a3c' })

    // a flag hung out of a balcony for the festa
    flagpole(p, [1000, 690], [1090, 560], 6, INK)
    portugueseFlag(p, { at: [1090, 564], w: 150, h: 100, light: LIGHT, ink: INK, wave: 0.7, phase: 0.3 })
    // a sill with a cat who has seen it all
    const sillX = 1180
    const sillY = 760
    p.stroke([[sillX - 70, sillY], [sillX + 70, sillY]], { color: '#e9e2d2', width: 12, load: 0.95, taper: [0, 0] })
    p.line([[sillX - 70, sillY + 6], [sillX + 70, sillY + 6]], { color: INK, width: 1.8, wobble: 0.3 })
    cat(p, sillX + 10, sillY - 6, 150, '#e0913f', '#b0662a')
    step('cat')

    // tram shadow on the cobbles, then the 28 itself
    castShadow(p, 700, rail(700) + 22, 760, '#5d5852', Math.atan(-SLOPE))
    const t = tram(p, {
      x: 380,
      y: rail(380),
      length: 720,
      angle: Math.atan(-SLOPE),
      body: '#f2c230',
      cream: '#f1e8d2',
      roof: '#8f969b',
      ink: INK,
      light: LIGHT,
      passengers: (windows) => {
        const heads = ['#3b2b22', '#c9c2b6', '#6b4a2e', '#1f1c1a', '#a8743c']
        windows.forEach((w, i) => {
          if (i === 1 || i === 6) return
          const hx = w.c[0] + p.rng.gauss(0, 4)
          const hy = w.c[1] - w.h * 0.05
          const body = p.blob([
            [hx - w.w * 0.42, w.c[1] + w.h * 0.6],
            [hx - w.w * 0.34, hy + w.h * 0.22],
            [hx + w.w * 0.34, hy + w.h * 0.22],
            [hx + w.w * 0.42, w.c[1] + w.h * 0.6],
          ])
          const c = p.rng.pick(['#4a5a7a', '#8a4a3a', '#5a6a4a', '#7a6a8a'])
          p.shape(body, { color: c, shadow: c, lightAngle: LIGHT, depth: 4 })
          const head = p.mask((ctx) => {
            ctx.beginPath()
            ctx.ellipse(hx, hy, w.w * 0.2, w.w * 0.24, 0, 0, Math.PI * 2)
            ctx.fill()
          })
          p.shape(head, { color: heads[i % heads.length], shadow: heads[i % heads.length], lightAngle: LIGHT, depth: 4 })
        })
      },
    })
    handwrite(p, '28', t.signCenter[0], t.signCenter[1] + 12, { size: 30, color: '#f6d76a', align: 'center', angle: Math.atan(-SLOPE), weight: 0.12 })
    // overhead wire with span wires to the facades
    const wire: Pt[] = []
    for (let u = -0.7; u <= 1.9; u += 0.05) wire.push(t.wire(u))
    p.line(wire, { color: INK, width: 2, wobble: 0.4 })
    for (const u of [-0.4, 0.3, 1.0, 1.6]) {
      const [wx, wy] = t.wire(u)
      p.line([[wx, wy], [wx + 40, wy - 70]], { color: INK, width: 1.4, wobble: 0.3, opacity: 0.8 })
    }
    step('tram')

    // someone on the tram waving out of the window
    {
      const [wx, wy] = t.at(0.1 + (0.8 * 4.5) / 7, 0.27)
      const arm: Pt[] = [
        [wx + 6, wy + 18],
        [wx + 24, wy - 40],
        [wx + 14, wy - 96],
      ]
      p.shape(p.tube(arm, (k) => 22 - 6 * k), { color: '#d9534a', shadow: '#a93b34', lightAngle: LIGHT, depth: 6 })
      const hand = p.mask((ctx) => {
        ctx.beginPath()
        ctx.ellipse(wx + 12, wy - 108, 13, 15, 0.3, 0, Math.PI * 2)
        ctx.fill()
      })
      p.shape(hand, { color: '#e6b894', shadow: '#c48e6c', lightAngle: LIGHT, depth: 4 })
      for (const k of [-1, 1]) p.line([[wx + 12 + k * 26, wy - 120], [wx + 12 + k * 36, wy - 132]], { color: INK, width: 2, wobble: 0.2 })
    }
    step('wave')

    // the runaway pastel de nata, a kid and a dog in hot pursuit
    const depth = 270
    const nx = 470
    const nr = 52
    nata(p, nx, curb(nx) + depth - nr * 0.8, nr, -0.7)
    const kx = 760
    castShadow(p, kx + 20, curb(kx) + depth + 4, 180, '#7d776d', Math.atan(-SLOPE))
    figure(
      p,
      {
        x: kx,
        ground: curb(kx) + depth,
        height: 330,
        view: 'front',
        lean: -0.14,
        armL: { angle: -1.95, bend: 0.25 },
        armR: { angle: -1.25, bend: -0.35 },
        legL: { angle: -0.4, bend: 0.25 },
        legR: { angle: 0.32, bend: 0.45 },
      },
      {
        skin: '#e2b48f',
        hair: '#4a3022',
        hairBlow: 26,
        top: '#3f86c4',
        topShadow: '#2d6497',
        sleeve: 0.35,
        legs: '#e2b48f',
        legsShadow: '#c48e6c',
        skirt: '#f0c64e',
        skirtShadow: '#c99a2e',
        skirtLength: 1.2,
        shoes: '#e9e4da',
        face: 'open',
      },
      { wind: 0.4, light: LIGHT },
    )
    const dx = 1000
    castShadow(p, dx, curb(dx) + depth + 30, 170, '#7d776d', Math.atan(-SLOPE))
    dog(p, dx, curb(dx) + depth + 26, 150, -1, '#c88a4a')
    step('chase')

    // Santo António on the pavement: an avô grilling sardines, a neighbour bringing a manjerico
    const gx = 1330
    const gy = curb(gx) + 600
    castShadow(p, gx + 40, gy + 10, 360, '#7d776d', Math.atan(-SLOPE))
    const avo = figure(
      p,
      {
        x: gx + 120,
        ground: gy - 40,
        height: 430,
        view: 'front',
        build: 1,
        lean: 0.03,
        armL: { angle: -0.5, bend: -0.9 },
        armR: { angle: 3.0, bend: -0.25 },
        legL: { angle: -0.08, bend: 0.02 },
        legR: { angle: 0.08, bend: -0.02 },
      },
      {
        skin: '#e0ae88',
        hair: '#d8d4cc',
        top: '#4f7fa8',
        topShadow: '#3a6386',
        sleeve: 0.45,
        legs: '#5a5a62',
        legsShadow: '#45454c',
        shoes: '#4a3a2c',
        apron: '#f3eee4',
        face: 'smile',
        mustache: '#e8e4dc',
      },
      { wind: -1.6, light: LIGHT },
    )
    const smokeFrom = grill(p, gx - 10, gy + 10, 230, INK)
    for (let k = 0; k < 4; k++) sardine(p, gx - 60 + (k % 2) * 40, smokeFrom[1] - 6 - k * 10, 80, p.rng.gauss(0, 0.08))
    smoke(p, smokeFrom, { wind: -2.0, length: 380, color: '#ece9e2', spread: 1.5 })
    // a sardine held up proudly on the fork
    const fh = avo.hands[1]
    p.line([[fh[0] - 2, fh[1] + 10], [fh[0] + 10, fh[1] - 80]], { color: '#6e6a66', width: 4, wobble: 0.2 })
    sardine(p, fh[0] + 12, fh[1] - 110, 76, -1.4)
    const neighbour = figure(
      p,
      {
        x: gx - 290,
        ground: gy + 30,
        height: 400,
        view: 'front',
        lean: 0.06,
        armL: { angle: 0.12, bend: 1.0 },
        armR: { angle: -0.12, bend: -1.0 },
        legL: { angle: -0.06, bend: 0.02 },
        legR: { angle: 0.1, bend: -0.03 },
      },
      {
        skin: '#d9a982',
        hair: '#2e211b',
        top: '#e8a33c',
        topShadow: '#bf7f27',
        sleeve: 0.3,
        legs: '#d9a982',
        legsShadow: '#b98a66',
        skirt: '#c9473a',
        skirtShadow: '#9f3329',
        skirtLength: 2.3,
        shoes: '#3a2e28',
        face: 'smile',
      },
      { wind: -1.6, light: LIGHT },
    )
    const [ha, hb] = neighbour.hands
    manjerico(p, (ha[0] + hb[0]) / 2, (ha[1] + hb[1]) / 2 + 26, 62)
    step('festa')

    // the gull got the sardine
    const beak = seagull(p, 560, 470, 250, -1)
    sardine(p, beak[0] - 26, beak[1] + 10, 70, 0.5)
    for (const [x, y, s] of [
      [180, 560, 16],
      [240, 600, 12],
    ] as const)
      gull(p, x, y, s, '#4a4544')
    step('gull')

    handwrite(p, 'uphill both ways :p', 52, H - 50, { size: 46, color: '#2f2d2c' })
    p.finish()
  },
} satisfies Scene
