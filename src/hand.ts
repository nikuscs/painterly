import type { ColorLike } from './color.ts'
import type { Pt } from './math.ts'
import type { Painter } from './painter.ts'

/**
 * Single-stroke handwriting, painted with the brush so captions look signed by hand.
 * Glyph units: baseline y = 0, x-height -0.5, ascender -0.95, descender 0.35.
 */
type Glyph = { w: number; strokes: Pt[][]; sharp?: boolean }

const dot = (x: number, y: number): Pt[] => [
  [x - 0.012, y - 0.01],
  [x + 0.012, y + 0.01],
]
const bowl: Pt[] = [
  [0.42, -0.42],
  [0.25, -0.5],
  [0.06, -0.4],
  [0.02, -0.2],
  [0.12, -0.02],
  [0.3, 0],
  [0.42, -0.15],
]

const GLYPHS: Record<string, Glyph> = {
  a: { w: 0.52, strokes: [bowl, [[0.44, -0.5], [0.44, -0.12], [0.5, 0]]] },
  b: { w: 0.5, strokes: [[[0.05, -0.95], [0.05, 0]], [[0.05, -0.3], [0.2, -0.48], [0.38, -0.42], [0.44, -0.22], [0.36, -0.04], [0.18, 0], [0.05, -0.08]]] },
  c: { w: 0.46, strokes: [[[0.42, -0.42], [0.26, -0.5], [0.08, -0.42], [0.02, -0.24], [0.1, -0.05], [0.26, 0], [0.42, -0.08]]] },
  d: { w: 0.52, strokes: [bowl, [[0.44, -0.95], [0.44, -0.12], [0.5, 0]]] },
  e: { w: 0.48, strokes: [[[0.05, -0.25], [0.42, -0.28], [0.38, -0.45], [0.22, -0.5], [0.06, -0.4], [0.03, -0.2], [0.12, -0.04], [0.28, 0], [0.42, -0.08]]] },
  f: { w: 0.36, strokes: [[[0.38, -0.88], [0.26, -0.95], [0.14, -0.85], [0.13, -0.5], [0.13, 0]], [[0.02, -0.5], [0.32, -0.5]]] },
  g: { w: 0.52, strokes: [bowl, [[0.44, -0.5], [0.44, 0.2], [0.36, 0.33], [0.2, 0.35], [0.06, 0.27]]] },
  h: { w: 0.5, strokes: [[[0.05, -0.95], [0.05, 0]], [[0.05, -0.3], [0.18, -0.47], [0.34, -0.48], [0.42, -0.35], [0.42, 0]]] },
  i: { w: 0.18, strokes: [[[0.08, -0.5], [0.08, 0]], dot(0.08, -0.72)] },
  j: { w: 0.26, strokes: [[[0.18, -0.5], [0.18, 0.22], [0.1, 0.33], [0.0, 0.3]], dot(0.18, -0.72)] },
  k: { w: 0.44, sharp: true, strokes: [[[0.05, -0.95], [0.05, 0]], [[0.38, -0.5], [0.06, -0.22]], [[0.16, -0.3], [0.4, 0]]] },
  l: { w: 0.2, strokes: [[[0.08, -0.95], [0.08, -0.1], [0.14, 0]]] },
  m: { w: 0.64, strokes: [[[0.05, -0.5], [0.05, 0]], [[0.05, -0.32], [0.15, -0.48], [0.27, -0.45], [0.3, -0.3], [0.3, 0]], [[0.3, -0.32], [0.4, -0.48], [0.52, -0.45], [0.56, -0.3], [0.56, 0]]] },
  n: { w: 0.48, strokes: [[[0.05, -0.5], [0.05, 0]], [[0.05, -0.32], [0.18, -0.48], [0.34, -0.46], [0.4, -0.3], [0.4, 0]]] },
  o: { w: 0.5, strokes: [[[0.24, -0.5], [0.06, -0.4], [0.02, -0.2], [0.12, -0.03], [0.28, 0], [0.42, -0.14], [0.44, -0.32], [0.34, -0.48], [0.2, -0.5]]] },
  p: { w: 0.5, strokes: [[[0.05, -0.5], [0.05, 0.35]], [[0.05, -0.35], [0.2, -0.5], [0.38, -0.42], [0.44, -0.24], [0.36, -0.05], [0.18, 0], [0.05, -0.1]]] },
  q: { w: 0.52, strokes: [bowl, [[0.44, -0.5], [0.44, 0.35], [0.52, 0.3]]] },
  r: { w: 0.38, strokes: [[[0.05, -0.5], [0.05, 0]], [[0.05, -0.3], [0.16, -0.46], [0.3, -0.5], [0.38, -0.45]]] },
  s: { w: 0.44, strokes: [[[0.38, -0.44], [0.24, -0.5], [0.08, -0.44], [0.08, -0.32], [0.22, -0.25], [0.36, -0.18], [0.38, -0.06], [0.22, 0], [0.04, -0.06]]] },
  t: { w: 0.34, strokes: [[[0.14, -0.78], [0.14, -0.1], [0.2, 0], [0.32, -0.02]], [[0.02, -0.5], [0.3, -0.5]]] },
  u: { w: 0.48, strokes: [[[0.05, -0.5], [0.05, -0.15], [0.14, -0.01], [0.28, 0], [0.4, -0.12]], [[0.41, -0.5], [0.41, -0.1], [0.46, 0]]] },
  v: { w: 0.44, sharp: true, strokes: [[[0.02, -0.5], [0.21, 0], [0.4, -0.5]]] },
  w: { w: 0.6, sharp: true, strokes: [[[0.02, -0.5], [0.15, 0], [0.29, -0.38], [0.43, 0], [0.56, -0.5]]] },
  x: { w: 0.44, sharp: true, strokes: [[[0.03, -0.5], [0.39, 0]], [[0.39, -0.5], [0.03, 0]]] },
  y: { w: 0.44, strokes: [[[0.03, -0.5], [0.21, -0.05]], [[0.4, -0.5], [0.2, 0.05], [0.12, 0.28], [0.02, 0.34]]] },
  z: { w: 0.44, sharp: true, strokes: [[[0.04, -0.5], [0.38, -0.5], [0.04, 0], [0.4, 0]]] },
  ' ': { w: 0.28, strokes: [] },
  '!': { w: 0.2, strokes: [[[0.09, -0.92], [0.08, -0.25]], dot(0.08, -0.03)] },
  ':': { w: 0.2, strokes: [dot(0.08, -0.42), dot(0.08, -0.03)] },
  '.': { w: 0.18, strokes: [dot(0.08, -0.03)] },
  ',': { w: 0.18, strokes: [[[0.1, -0.04], [0.06, 0.12]]] },
  '?': { w: 0.44, strokes: [[[0.04, -0.78], [0.14, -0.92], [0.3, -0.92], [0.38, -0.78], [0.3, -0.6], [0.2, -0.48], [0.2, -0.28]], dot(0.2, -0.03)] },
  '-': { w: 0.36, strokes: [[[0.04, -0.25], [0.3, -0.25]]] },
  "'": { w: 0.16, strokes: [[[0.08, -0.95], [0.06, -0.75]]] },
}

export type HandOpts = {
  /** Ascender height in px (roughly the cap height). */
  size?: number
  color?: ColorLike
  /** Stroke width as a fraction of size. */
  weight?: number
  /** Forward slant (0.15 ≈ 8°). */
  slant?: number
  /** Rotation of the whole line around (x, y). */
  angle?: number
  /** Horizontal alignment at x. */
  align?: 'left' | 'center'
}

/** Measure a line in px. */
export function handWidth(text: string, size: number) {
  let w = 0
  for (const ch of text.toLowerCase()) w += ((GLYPHS[ch] ?? GLYPHS[' ']).w + 0.07) * size
  return w
}

/** Paint a line of handwriting with baseline starting at (x, y). */
export function handwrite(p: Painter, text: string, x: number, y: number, o: HandOpts = {}) {
  const rng = p.rng
  const size = o.size ?? 40
  const slant = o.slant ?? 0.14
  const ca = Math.cos(o.angle ?? 0)
  const sa = Math.sin(o.angle ?? 0)
  let pen = o.align === 'center' ? -handWidth(text, size) / 2 : 0
  const seed = rng.range(0, 100)
  for (const ch of text.toLowerCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[' ']
    // each letter sits a little differently: baseline drift, scale and tilt
    const drift = p.noise.noise(seed + pen / (size * 3), 0.5) * size * 0.06
    const k = size * (1 + rng.gauss(0, 0.03))
    const tilt = rng.gauss(0, 0.03)
    for (const stroke of g.strokes) {
      const pts: Pt[] = stroke.map(([gx, gy]) => {
        const lx = gx + slant * -gy + tilt * gy
        const ly = gy
        const px = pen + lx * k
        const py = ly * k + drift
        return [x + px * ca - py * sa, y + px * sa + py * ca]
      })
      const isDot = stroke.length === 2 && Math.hypot(stroke[1][0] - stroke[0][0], stroke[1][1] - stroke[0][1]) < 0.05
      p.stroke(pts, {
        color: o.color ?? '#2c2a28',
        width: size * (o.weight ?? 0.085) * (isDot ? 1.5 : 1),
        load: 0.95,
        dryEnd: 0.15,
        edgeDry: 0.2,
        grain: 0.45,
        rough: 0.15,
        taper: isDot ? [0, 0] : [0.08, 0.2],
        smooth: !g.sharp,
      })
    }
    pen += (g.w + 0.07) * size
  }
}
