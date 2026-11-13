import { scumble } from '../brushwork.ts'
import { adjust, mix, vary, type ColorLike } from '../color.ts'
import { lerp, type Pt } from '../math.ts'
import type { Painter } from '../painter.ts'
import { block } from './things.ts'

export type HouseOpts = {
  /** Left edge and ground line. */
  x: number
  base: number
  w: number
  h: number
  color: ColorLike
  roof: ColorLike
  floors: number
  cols: number
  /** Azulejo tile colour; covers the facade with a fine tile pattern. */
  tiles?: ColorLike
  balconies?: boolean
  /** 0..1 chance a window catches the low sun. */
  glow?: number
  glowColor?: ColorLike
  /** Light comes from the left (-1) or right (1). */
  lightSide?: -1 | 1
}

/** Tall narrow townhouse: facade, tiles, window grid with frames, iron balconies, tiled roof. */
export function townhouse(p: Painter, o: HouseOpts) {
  const rng = p.rng
  const { x, base, w, h } = o
  const top = base - h
  const lightSide = o.lightSide ?? -1
  const facade = p.polygon(
    [
      [x, base],
      [x + w, base],
      [x + w, top],
      [x, top],
    ],
    0.8,
  )
  const dark = adjust(o.color, -0.09)
  block(p, facade, {
    color: o.color,
    dark,
    light: adjust(o.color, 0.04),
    angle: -Math.PI / 2,
    size: Math.max(4, w / 12),
    // side in shadow, plus the eave shadow at the top
    shade: (xx, yy) => {
      const side = lightSide < 0 ? (xx - x) / w : 1 - (xx - x) / w
      return Math.min(1, side * 0.75 + (yy < top + h * 0.06 ? 0.5 : 0))
    },
  })
  if (o.tiles) {
    const step = Math.max(4, w / 16)
    for (let ty = top + step; ty < base - step; ty += step)
      for (let tx = x + step / 2; tx < x + w; tx += step)
        if (rng.chance(0.85))
          p.stroke(
            [
              [tx - step * 0.18, ty],
              [tx + step * 0.18, ty + step * 0.05],
            ],
            { color: vary(rng, o.tiles, 0.03, 0.01), width: step * 0.32, load: 0.75, taper: [0.1, 0.1], grain: 0.6, clip: facade, opacity: 0.85 },
          )
  }
  // windows
  const floorH = (h * 0.92) / o.floors
  const ww = (w / o.cols) * 0.46
  const wh = floorH * 0.58
  const frame = mix(o.color, '#f4efe4', 0.75)
  for (let f = 0; f < o.floors; f++) {
    const cy = top + h * 0.08 + floorH * (f + 0.5)
    for (let c = 0; c < o.cols; c++) {
      const cx = x + (w / o.cols) * (c + 0.5)
      const ground = f === o.floors - 1
      const hh = ground ? floorH * 0.75 : wh
      const y0 = ground ? base - hh : cy - wh / 2
      const glow = rng.chance(o.glow ?? 0.15)
      const glass = p.polygon(
        [
          [cx - ww / 2, y0 + hh],
          [cx + ww / 2, y0 + hh],
          [cx + ww / 2, y0],
          [cx - ww / 2, y0],
        ],
        0.4,
      )
      const gc = glow ? (o.glowColor ?? '#f2b866') : '#3a3d44'
      p.fill(glass, { color: gc, color2: adjust(gc, glow ? 0.06 : 0.08), streak: 0.4, angle: -0.8, load: 1 })
      const lw = Math.max(1.2, ww * 0.12)
      p.line(
        [
          [cx - ww / 2, y0 + hh],
          [cx - ww / 2, y0],
          [cx + ww / 2, y0],
          [cx + ww / 2, y0 + hh],
        ],
        { color: frame, width: lw, wobble: 0.3, load: 0.9 },
      )
      if (!ground)
        p.line(
          [
            [cx, y0],
            [cx, y0 + hh],
          ],
          { color: frame, width: lw * 0.8, wobble: 0.2, load: 0.9 },
        )
      if (o.balconies && !ground && f > 0) {
        const by = y0 + hh
        const bw = ww * 1.35
        p.line(
          [
            [cx - bw / 2, by - hh * 0.28],
            [cx + bw / 2, by - hh * 0.28],
          ],
          { color: '#2b2a2c', width: lw * 0.9, wobble: 0.2 },
        )
        for (let k = 0; k <= 4; k++) {
          const bx = cx - bw / 2 + (bw * k) / 4
          p.line(
            [
              [bx, by - hh * 0.28],
              [bx, by + 1],
            ],
            { color: '#2b2a2c', width: lw * 0.5, wobble: 0.1 },
          )
        }
        p.stroke(
          [
            [cx - bw / 2 - 2, by + 1],
            [cx + bw / 2 + 2, by + 1],
          ],
          { color: frame, width: lw * 1.3, load: 0.9, taper: [0, 0] },
        )
      }
    }
  }
  // roof: terracotta wedge with a ridge line
  const ov = w * 0.05
  const rh = Math.min(h * 0.18, w * 0.32)
  const roof = p.polygon(
    [
      [x - ov, top + 2],
      [x + w + ov, top + 2],
      [x + w * 0.88, top - rh],
      [x + w * 0.12, top - rh],
    ],
    0.8,
  )
  block(p, roof, { color: o.roof, dark: adjust(o.roof, -0.08), light: adjust(o.roof, 0.06), angle: 0, size: Math.max(3, w / 18) })
  for (let k = 1; k < 4; k++) {
    const t = k / 4
    p.line(
      [
        [lerp(x - ov, x + w * 0.12, t), lerp(top + 2, top - rh, t)],
        [lerp(x + w + ov, x + w * 0.88, t), lerp(top + 2, top - rh, t)],
      ],
      { color: adjust(o.roof, -0.1), width: 1.2, opacity: 0.7, load: 0.6 },
    )
  }
  if (rng.chance(0.35)) {
    const cx = x + w * rng.range(0.25, 0.75)
    const ch = p.polygon([
      [cx - w * 0.05, top - rh * 0.4],
      [cx + w * 0.05, top - rh * 0.4],
      [cx + w * 0.05, top - rh * 1.4],
      [cx - w * 0.05, top - rh * 1.4],
    ])
    block(p, ch, { color: adjust(o.color, -0.03), angle: -Math.PI / 2, size: 3 })
  }
}

export type RowOpts = {
  x0: number
  x1: number
  base: number | ((x: number) => number)
  height: [number, number] | ((x: number) => [number, number])
  width: [number, number]
  palette: { color: ColorLike; tiles?: ColorLike }[]
  roof: ColorLike[]
  floors: [number, number]
  balconies?: number
  glow?: number
  glowColor?: ColorLike
}

/** A terrace of townhouses shoulder to shoulder with varied widths, heights and colours. */
export function houseRow(p: Painter, o: RowOpts) {
  const rng = p.rng
  let x = o.x0
  while (x < o.x1) {
    const w = rng.range(o.width[0], o.width[1])
    const [ha, hb] = typeof o.height === 'function' ? o.height(x) : o.height
    const h = rng.range(ha, hb)
    const pal = rng.pick(o.palette)
    const base = typeof o.base === 'function' ? o.base(x + w / 2) : o.base
    townhouse(p, {
      x,
      base,
      w,
      h,
      color: vary(rng, pal.color, 0.015, 0.006),
      tiles: pal.tiles,
      roof: rng.pick(o.roof),
      floors: rng.int(o.floors[0], o.floors[1]),
      cols: w > (o.width[0] + o.width[1]) / 2 ? 3 : 2,
      balconies: rng.chance(o.balconies ?? 0.6),
      glow: o.glow,
      glowColor: o.glowColor,
    })
    x += w - 1
  }
}

/** Baroque granite bell tower: shaft, stacked stages, onion cap and a cross. */
export function belltower(p: Painter, x: number, base: number, h: number, stone: ColorLike, shadow: ColorLike) {
  const w = h * 0.16
  const stage = (y0: number, y1: number, ww: number) => {
    const m = p.polygon(
      [
        [x - ww / 2, y0],
        [x + ww / 2, y0],
        [x + ww / 2, y1],
        [x - ww / 2, y1],
      ],
      0.6,
    )
    p.shape(m, { color: stone, shadow, lightAngle: Math.PI, depth: ww * 0.35, angle: -Math.PI / 2 })
    p.stroke(
      [
        [x - ww / 2 - 2, y1],
        [x + ww / 2 + 2, y1],
      ],
      { color: adjust(stone, 0.05), width: 3, load: 0.9, taper: [0, 0] },
    )
  }
  stage(base, base - h * 0.55, w)
  stage(base - h * 0.55, base - h * 0.72, w * 0.86)
  stage(base - h * 0.72, base - h * 0.84, w * 0.7)
  // openings
  for (const [yy, ww] of [
    [base - h * 0.63, w * 0.86],
    [base - h * 0.78, w * 0.7],
  ] as const)
    for (const dx of [-0.22, 0.22]) {
      const o = p.mask((ctx) => {
        ctx.beginPath()
        ctx.ellipse(x + dx * ww, yy, ww * 0.12, h * 0.035, 0, 0, Math.PI * 2)
        ctx.fill()
      })
      p.fill(o, { color: '#3b3a3f', load: 1 })
    }
  const cap = p.blob([
    [x - w * 0.36, base - h * 0.84],
    [x - w * 0.3, base - h * 0.9],
    [x, base - h * 0.97],
    [x + w * 0.3, base - h * 0.9],
    [x + w * 0.36, base - h * 0.84],
  ])
  p.shape(cap, { color: stone, shadow, lightAngle: Math.PI, depth: w * 0.25 })
  p.line(
    [
      [x, base - h * 0.97],
      [x, base - h * 1.04],
    ],
    { color: '#3b3a3f', width: 3 },
  )
  p.line(
    [
      [x - w * 0.1, base - h * 1.015],
      [x + w * 0.1, base - h * 1.015],
    ],
    { color: '#3b3a3f', width: 3 },
  )
}

export type ArchBridgeOpts = {
  /** Arch springs (both feet) at this y, crown at (crownX, crownY). */
  springY: number
  crownX: number
  crownY: number
  /** Half span of the arch in px. */
  halfSpan: number
  /** Arch depth at the crown. */
  depth: number
  upperDeck: { y: number; x0: number; x1: number }
  lowerDeck?: { y: number; x0: number; x1: number }
  iron: ColorLike
  stone: ColorLike
  stoneShadow: ColorLike
}

/** Wrought-iron two-deck arch bridge drawn as lattice lines, with granite pylons. */
export function archBridge(p: Painter, o: ArchBridgeOpts) {
  const { springY, crownX, crownY, halfSpan, depth } = o
  const rise = springY - crownY
  const outer = (x: number) => crownY + rise * ((x - crownX) / halfSpan) ** 2
  const inner = (x: number) => {
    const t = Math.min(1, Math.abs((x - crownX) / halfSpan))
    return outer(x) + depth * (1 - t * t)
  }
  const lw = { color: o.iron, wobble: 0.5, load: 0.95 }
  const sample = (f: (x: number) => number, x0: number, x1: number, n = 60): Pt[] => {
    const pts: Pt[] = []
    for (let i = 0; i <= n; i++) {
      const x = lerp(x0, x1, i / n)
      pts.push([x, f(x)])
    }
    return pts
  }
  const xa = crownX - halfSpan
  const xb = crownX + halfSpan
  // lattice between the arch chords
  const n = 46
  for (let i = 0; i < n; i++) {
    const x0 = lerp(xa, xb, i / n)
    const x1 = lerp(xa, xb, (i + 1) / n)
    p.line(
      [
        [x0, outer(x0)],
        [x1, inner(x1)],
      ],
      { ...lw, width: 2.2 },
    )
    p.line(
      [
        [x0, inner(x0)],
        [x1, outer(x1)],
      ],
      { ...lw, width: 1.6, opacity: 0.8 },
    )
  }
  p.line(sample(outer, xa, xb), { ...lw, width: 5 })
  p.line(sample(inner, xa, xb), { ...lw, width: 4 })
  // deck truss
  const deck = (d: { y: number; x0: number; x1: number }, hgt: number) => {
    p.line(
      [
        [d.x0, d.y],
        [d.x1, d.y],
      ],
      { ...lw, width: 5 },
    )
    p.line(
      [
        [d.x0, d.y + hgt],
        [d.x1, d.y + hgt],
      ],
      { ...lw, width: 4 },
    )
    const step = hgt * 1.4
    for (let x = d.x0; x < d.x1 - step; x += step) {
      p.line(
        [
          [x, d.y + hgt],
          [x + step / 2, d.y],
          [x + step, d.y + hgt],
        ],
        { ...lw, width: 1.6, wobble: 0.2 },
      )
    }
  }
  deck(o.upperDeck, 22)
  // spandrel posts from arch up to the upper deck
  for (let x = o.upperDeck.x0 + 40; x < o.upperDeck.x1; x += 64) {
    const ya = outer(x)
    if (ya > o.upperDeck.y + 30 && x > xa && x < xb)
      p.line(
        [
          [x, o.upperDeck.y + 22],
          [x, ya],
        ],
        { ...lw, width: 3 },
      )
  }
  if (o.lowerDeck) {
    deck(o.lowerDeck, 18)
    // hangers from the arch down to the lower deck
    for (let x = Math.max(o.lowerDeck.x0, xa) + 30; x < Math.min(o.lowerDeck.x1, xb); x += 48) {
      const yi = inner(x)
      if (yi < o.lowerDeck.y - 10)
        p.line(
          [
            [x, yi],
            [x, o.lowerDeck.y],
          ],
          { ...lw, width: 1.8, opacity: 0.85 },
        )
    }
    // granite pylon at the left end of the lower deck
    const px = o.lowerDeck.x0
    const pylon = p.polygon([
      [px - 34, springY + 4],
      [px + 34, springY + 4],
      [px + 28, o.lowerDeck.y - 70],
      [px - 28, o.lowerDeck.y - 70],
    ])
    p.shape(pylon, { color: o.stone, shadow: o.stoneShadow, lightAngle: Math.PI, depth: 26, angle: -Math.PI / 2 })
    scumble(p, {
      region: pylon,
      clip: pylon,
      count: 30,
      color: (_x, _y, r) => vary(r, r.chance(0.5) ? o.stoneShadow : o.stone, 0.03, 0.005),
      angle: 0,
      length: [8, 24],
      width: [2, 4],
      load: [0.4, 0.7],
    })
  }
}

export type SuspensionOpts = {
  deckY: number
  x0: number
  x1: number
  /** Tower x positions and height above the deck. */
  towers: [number, number]
  towerH: number
  /** Where the tower legs meet the water. */
  waterY: number
  color: ColorLike
  shadow: ColorLike
}

/** Red suspension bridge seen side-on in the distance: towers, sagging main cable, hangers, deck. */
export function suspensionBridge(p: Painter, o: SuspensionOpts) {
  const [ta, tb] = o.towers
  const top = o.deckY - o.towerH
  const lw = { color: o.color, wobble: 0.3, load: 0.95 }
  const sag = (x: number) => {
    if (x < ta) return top + (o.deckY - top) * ((ta - x) / Math.max(1, ta - o.x0)) ** 1.15
    if (x > tb) return top + (o.deckY - top) * ((x - tb) / Math.max(1, o.x1 - tb)) ** 1.15
    const t = (x - ta) / (tb - ta)
    return top + (o.deckY - 10 - top) * 4 * t * (1 - t)
  }
  // hangers first so the cable and deck sit over them
  for (let x = o.x0 + 6; x < o.x1; x += 9) {
    const y = sag(x)
    if (y < o.deckY - 3) p.line([[x, y], [x, o.deckY]], { ...lw, width: 0.9, opacity: 0.7, wobble: 0 })
  }
  const cable: Pt[] = []
  for (let x = o.x0; x <= o.x1; x += 6) cable.push([x, sag(x)])
  p.line(cable, { ...lw, width: 2.2 })
  for (const tx of [ta, tb]) {
    const w = o.towerH * 0.07
    for (const side of [-1, 1]) {
      const leg = p.polygon([
        [tx + side * w * 0.9, o.waterY],
        [tx + side * w * 0.55, top - 4],
        [tx + side * w * 0.2, top - 4],
        [tx + side * w * 0.45, o.waterY],
      ], 0.3)
      p.shape(leg, { color: o.color, shadow: o.shadow, lightAngle: -0.6, depth: w * 0.4, angle: -Math.PI / 2 })
    }
    for (const t of [0.05, 0.45, 0.85]) {
      const y = top + (o.waterY - top) * t
      p.line([[tx - w * 0.75, y], [tx + w * 0.75, y]], { ...lw, width: 2.4 })
    }
  }
  p.stroke([[o.x0, o.deckY], [o.x1, o.deckY]], { color: o.color, width: 5, load: 0.95, taper: [0, 0], smooth: false })
  p.line([[o.x0, o.deckY + 4], [o.x1, o.deckY + 4]], { ...lw, color: o.shadow, width: 1.6 })
}

export type CityscapeOpts = {
  /** Skyline: the furthest y at x where houses start. */
  top: (x: number) => number
  bottom: number
  /** House width in px at the far and near edge (perspective). */
  size: [number, number]
  walls: ColorLike[]
  roofs: ColorLike[]
  /** Where greenery breaks through, 0..1 (e.g. parks, garden trees). */
  green?: (x: number, y: number) => number
  foliage?: { dark: ColorLike; mid: ColorLike; light: ColorLike }
  /** Light comes from the left (-1) or right (1). */
  lightSide?: -1 | 1
  x0?: number
  x1?: number
}

/**
 * A carpet of little houses seen from above, painted back to front with a few quick strokes each:
 * wall, shaded side, terracotta roof, window dots, and trees where the city goes green.
 */
export function cityscape(p: Painter, o: CityscapeOpts) {
  const rng = p.rng
  const x0 = o.x0 ?? -20
  const x1 = o.x1 ?? p.w + 20
  let minTop = Infinity
  for (let x = x0; x < x1; x += 10) minTop = Math.min(minTop, o.top(x))
  const side = o.lightSide ?? 1
  for (let y = minTop; y < o.bottom; ) {
    const t = (y - minTop) / Math.max(1, o.bottom - minTop)
    const s = lerp(o.size[0], o.size[1], t)
    let x = x0 + rng.range(-s, 0)
    while (x < x1) {
      const w = s * rng.range(0.7, 1.4)
      const cx = x + w / 2
      const yy = y + rng.gauss(0, s * 0.15)
      if (yy >= o.top(cx)) {
        const green = o.green ? o.green(cx, yy) : 0
        if (o.foliage && rng.next() < green) {
          const f = o.foliage
          const r = s * rng.range(0.45, 0.8)
          for (let k = 0; k < 5; k++) {
            const lx = cx + rng.gauss(0, r * 0.5)
            const ly = yy - r * 0.5 + rng.gauss(0, r * 0.35)
            p.stroke(
              [
                [lx - r * 0.3, ly],
                [lx + r * 0.3, ly - r * 0.1],
              ],
              { color: vary(rng, k < 2 ? f.dark : k < 4 ? f.mid : f.light, 0.03, 0.008), width: r * rng.range(0.5, 0.8), load: 0.85, grain: 0.5 },
            )
          }
        } else {
          const h = w * rng.range(0.55, 1.1) * (rng.chance(0.12) ? 1.6 : 1)
          const wall = vary(rng, rng.pick(o.walls), 0.02, 0.006)
          // wall
          p.stroke(
            [
              [x, yy - h / 2],
              [x + w, yy - h / 2],
            ],
            { color: wall, width: h, load: 0.95, grain: 0.4, taper: [0, 0], rough: 0.1 },
          )
          // side in shade
          const sx = side > 0 ? x + w * 0.08 : x + w * 0.92
          p.stroke(
            [
              [sx, yy - h * 0.98],
              [sx, yy - h * 0.02],
            ],
            { color: adjust(wall, -0.12), width: w * 0.16, load: 0.85, taper: [0, 0], grain: 0.5 },
          )
          // roof: terracotta wedge, sometimes a flat terrace
          if (rng.chance(0.65)) {
            const rh = Math.min(h, w) * rng.range(0.25, 0.45)
            p.stroke(
              [
                [x - w * 0.04, yy - h - rh * 0.4],
                [x + w * 1.04, yy - h - rh * 0.4],
              ],
              { color: vary(rng, rng.pick(o.roofs), 0.03, 0.008), width: rh, load: 0.9, grain: 0.5, taper: [0.08, 0.08], rough: 0.2 },
            )
            p.stroke(
              [
                [x, yy - h - rh * 0.1],
                [x + w, yy - h - rh * 0.1],
              ],
              { color: adjust(rng.pick(o.roofs), -0.1), width: rh * 0.25, load: 0.8, taper: [0, 0], opacity: 0.8 },
            )
          }
          // window dots
          const cols = Math.max(1, Math.round(w / (s * 0.35)))
          const rows = Math.max(1, Math.round(h / (s * 0.35)))
          for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++) {
              if (rng.chance(0.25)) continue
              const wx = x + (w * (c + 0.5)) / cols
              const wy = yy - h + (h * (r + 0.55)) / rows
              p.stroke(
                [
                  [wx, wy - s * 0.06],
                  [wx, wy + s * 0.06],
                ],
                { color: rng.chance(0.15) ? '#f5d58a' : '#3e3a3a', width: Math.max(1.5, s * 0.09), load: 0.95, taper: [0, 0], grain: 0.3 },
              )
            }
        }
      }
      x += w * rng.range(0.75, 1.0)
    }
    y += lerp(o.size[0], o.size[1], t) * 0.45
  }
}

/** Crenellated castle on a hilltop: curtain walls between square towers, and a flag. */
export function castle(p: Painter, x: number, base: number, w: number, h: number, stone: ColorLike, shadow: ColorLike, light: number) {
  const ink = { color: '#3a2e26', width: 1.6, wobble: 0.5, load: 0.85 }
  const block = (x0: number, x1: number, top: number) => {
    const m = p.polygon(
      [
        [x0, base],
        [x1, base],
        [x1, top],
        [x0, top],
      ],
      0.6,
    )
    p.shape(m, { color: stone, shadow, light: adjust(stone, 0.06), lightAngle: light, depth: (x1 - x0) * 0.25, angle: -Math.PI / 2 })
    // merlons along the top
    const mw = Math.max(4, h * 0.07)
    for (let mx = x0; mx < x1 - mw * 0.5; mx += mw * 2) {
      const mm = p.polygon(
        [
          [mx, top + 1],
          [mx + mw, top + 1],
          [mx + mw, top - mw],
          [mx, top - mw],
        ],
        0.3,
      )
      p.shape(mm, { color: stone, shadow, lightAngle: light, depth: mw * 0.4 })
    }
    p.line(
      [
        [x0, base],
        [x0, top],
        [x1, top],
        [x1, base],
      ],
      ink,
    )
  }
  const towers = 5
  const tw = w / (towers * 2.2)
  for (let i = 0; i < towers - 1; i++) {
    const a = x + (w * (i + 0.5)) / towers
    const b = x + (w * (i + 1.5)) / towers
    block(a, b, base - h * 0.62)
  }
  for (let i = 0; i < towers; i++) {
    const cx = x + (w * (i + 0.5)) / towers
    const th = h * (i === 2 ? 1.15 : p.rng.range(0.85, 1))
    block(cx - tw / 2, cx + tw / 2, base - th)
    // arrow slit
    p.stroke(
      [
        [cx, base - th * 0.7],
        [cx, base - th * 0.55],
      ],
      { color: '#3a2e26', width: 2.5, load: 1, taper: [0, 0] },
    )
  }
  // flag on the keep
  const fx = x + w * 0.5
  const ft = base - h * 1.15
  p.line(
    [
      [fx, ft - h * 0.06],
      [fx, ft - h * 0.4],
    ],
    { ...ink, width: 2 },
  )
  const flag = p.polygon(
    [
      [fx, ft - h * 0.4],
      [fx + h * 0.24, ft - h * 0.36],
      [fx + h * 0.22, ft - h * 0.25],
      [fx, ft - h * 0.27],
    ],
    0.4,
  )
  p.fill(flag, { color: '#2f6b3a', load: 1 })
  const red = p.polygon(
    [
      [fx + h * 0.09, ft - h * 0.385],
      [fx + h * 0.24, ft - h * 0.36],
      [fx + h * 0.22, ft - h * 0.25],
      [fx + h * 0.09, ft - h * 0.265],
    ],
    0.3,
  )
  p.fill(red, { color: '#c8382c', load: 1 })
}

/** White church with a drum, dome and lantern, and a pair of bell towers. (x, base) is the bottom centre. */
export function domeChurch(p: Painter, x: number, base: number, w: number, white: ColorLike, shadow: ColorLike, light: number) {
  const ink = { color: '#3a2e26', width: 1.6, wobble: 0.4, load: 0.85 }
  const part = (pts: Pt[]) => {
    const m = p.polygon(pts, 0.5)
    p.shape(m, { color: white, shadow, light: adjust(white, 0.03), lightAngle: light, depth: w * 0.08, angle: -Math.PI / 2 })
    p.line([...pts, pts[0]], ink)
  }
  const bh = w * 0.45
  for (const s of [-1, 1]) {
    const tx = x + s * w * 0.42
    part([
      [tx - w * 0.09, base],
      [tx + w * 0.09, base],
      [tx + w * 0.09, base - w * 0.85],
      [tx - w * 0.09, base - w * 0.85],
    ])
    part([
      [tx - w * 0.07, base - w * 0.85],
      [tx + w * 0.07, base - w * 0.85],
      [tx, base - w * 1.0],
    ])
  }
  part([
    [x - w * 0.38, base],
    [x + w * 0.38, base],
    [x + w * 0.38, base - bh],
    [x - w * 0.38, base - bh],
  ])
  part([
    [x - w * 0.2, base - bh],
    [x + w * 0.2, base - bh],
    [x + w * 0.2, base - bh - w * 0.16],
    [x - w * 0.2, base - bh - w * 0.16],
  ])
  const domeTop = base - bh - w * 0.16
  const dome = p.mask((ctx) => {
    ctx.beginPath()
    ctx.ellipse(x, domeTop, w * 0.22, w * 0.24, 0, Math.PI, Math.PI * 2)
    ctx.fill()
  })
  p.shape(dome, { color: white, shadow, light: adjust(white, 0.03), lightAngle: light, depth: w * 0.1 })
  p.line(
    Array.from({ length: 13 }, (_, k) => [x + Math.cos(Math.PI + (k / 12) * Math.PI) * w * 0.22, domeTop + Math.sin(Math.PI + (k / 12) * Math.PI) * w * 0.24] as Pt),
    ink,
  )
  part([
    [x - w * 0.04, domeTop - w * 0.23],
    [x + w * 0.04, domeTop - w * 0.23],
    [x + w * 0.04, domeTop - w * 0.32],
    [x - w * 0.04, domeTop - w * 0.32],
  ])
  // arched windows
  for (const dx of [-0.2, 0, 0.2])
    p.stroke(
      [
        [x + dx * w, base - bh * 0.25],
        [x + dx * w, base - bh * 0.6],
      ],
      { color: '#4a4440', width: w * 0.05, load: 0.95, taper: [0, 0.3] },
    )
}
