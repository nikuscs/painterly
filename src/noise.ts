import { Rng } from './math.ts'

/** Seeded 2D simplex noise, output roughly in [-1, 1]. */
export class Simplex {
  private perm = new Uint8Array(512)
  constructor(seed: number) {
    const rng = new Rng(seed)
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i++) p[i] = i
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1))
      const t = p[i]
      p[i] = p[j]
      p[j] = t
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]
  }

  noise(xin: number, yin: number): number {
    const F2 = 0.3660254037844386
    const G2 = 0.21132486540518713
    const perm = this.perm
    const s = (xin + yin) * F2
    const i = Math.floor(xin + s)
    const j = Math.floor(yin + s)
    const t = (i + j) * G2
    const x0 = xin - (i - t)
    const y0 = yin - (j - t)
    const i1 = x0 > y0 ? 1 : 0
    const j1 = x0 > y0 ? 0 : 1
    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2
    const ii = i & 255
    const jj = j & 255
    let n = 0
    const corner = (h: number, x: number, y: number) => {
      let tt = 0.5 - x * x - y * y
      if (tt < 0) return 0
      tt *= tt
      const g = h & 7
      const u = g < 4 ? x : y
      const v = g < 4 ? y : x
      return tt * tt * ((g & 1 ? -u : u) + (g & 2 ? -2 * v : 2 * v))
    }
    n += corner(perm[ii + perm[jj]], x0, y0)
    n += corner(perm[ii + i1 + perm[jj + j1]], x1, y1)
    n += corner(perm[ii + 1 + perm[jj + 1]], x2, y2)
    return 40 * n
  }

  /** Fractal sum, output roughly in [-1, 1]. */
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let sum = 0
    let amp = 1
    let norm = 0
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x, y)
      norm += amp
      amp *= gain
      x *= lacunarity
      y *= lacunarity
    }
    return sum / norm
  }
}

/** One octave of periodic value noise: lattice cell size in x and y (must divide the texture size). */
export type Octave = { cx: number; cy: number; amp: number }

/**
 * Tileable grayscale texture, histogram-equalised so values are uniform in [0, 1].
 * Uniform values make "paint load" thresholds behave linearly: load 0.7 covers ~70%.
 */
export class Texture {
  readonly w: number
  readonly h: number
  readonly data: Float32Array

  constructor(w: number, h: number, octaves: Octave[], seed: number, warp = 0) {
    this.w = w
    this.h = h
    const rng = new Rng(seed)
    const data = new Float32Array(w * h)
    for (const { cx, cy, amp } of octaves) {
      const gw = Math.round(w / cx)
      const gh = Math.round(h / cy)
      const lat = new Float32Array(gw * gh)
      for (let i = 0; i < lat.length; i++) lat[i] = rng.next()
      for (let y = 0; y < h; y++) {
        const fy = y / cy
        const y0 = Math.floor(fy)
        const ty = quintic(fy - y0)
        const r0 = (y0 % gh) * gw
        const r1 = ((y0 + 1) % gh) * gw
        for (let x = 0; x < w; x++) {
          const fx = x / cx
          const x0 = Math.floor(fx)
          const tx = quintic(fx - x0)
          const a = x0 % gw
          const b = (x0 + 1) % gw
          const top = lat[r0 + a] + (lat[r0 + b] - lat[r0 + a]) * tx
          const bot = lat[r1 + a] + (lat[r1 + b] - lat[r1 + a]) * tx
          data[y * w + x] += amp * (top + (bot - top) * ty)
        }
      }
    }
    this.data = warp > 0 ? warpField(data, w, h, warp, seed) : data
    equalize(this.data)
  }

  /** Bilinear, wrapping sample in texel units. */
  sample(x: number, y: number): number {
    const w = this.w
    const h = this.h
    let fx = x % w
    let fy = y % h
    if (fx < 0) fx += w
    if (fy < 0) fy += h
    const x0 = fx | 0
    const y0 = fy | 0
    const tx = fx - x0
    const ty = fy - y0
    const x1 = x0 + 1 === w ? 0 : x0 + 1
    const y1 = y0 + 1 === h ? 0 : y0 + 1
    const d = this.data
    const a = d[y0 * w + x0]
    const b = d[y0 * w + x1]
    const c = d[y1 * w + x0]
    const e = d[y1 * w + x1]
    const top = a + (b - a) * tx
    return top + (c + (e - c) * tx - top) * ty
  }
}

const quintic = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/** Self-warp a tileable field by its own values, giving blobby organic speckle shapes. */
function warpField(src: Float32Array, w: number, h: number, amount: number, seed: number) {
  const out = new Float32Array(w * h)
  const off = (seed % 97) + 31
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (src[y * w + ((x + off) % w)] - 0.5) * amount
      const dy = (src[((y + off) % h) * w + x] - 0.5) * amount
      const sx = (((Math.round(x + dx) % w) + w) % w) | 0
      const sy = (((Math.round(y + dy) % h) + h) % h) | 0
      out[y * w + x] = src[sy * w + sx]
    }
  }
  return out
}

/** In-place histogram equalisation to a uniform [0, 1] distribution. */
function equalize(d: Float32Array) {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < d.length; i++) {
    if (d[i] < min) min = d[i]
    if (d[i] > max) max = d[i]
  }
  const bins = 4096
  const hist = new Float64Array(bins)
  const scale = (bins - 1) / (max - min || 1)
  for (let i = 0; i < d.length; i++) hist[((d[i] - min) * scale) | 0]++
  let acc = 0
  for (let i = 0; i < bins; i++) {
    acc += hist[i]
    hist[i] = acc / d.length
  }
  for (let i = 0; i < d.length; i++) d[i] = hist[((d[i] - min) * scale) | 0]
}
