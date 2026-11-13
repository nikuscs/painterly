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
  height: [number, number]
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
    const h = rng.range(o.height[0], o.height[1])
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
