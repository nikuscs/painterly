import { clamp, type Rng } from './math.ts'

/** sRGB colour, channels in [0, 1]. */
export type RGB = [number, number, number]
export type ColorLike = RGB | string

export function rgb(c: ColorLike): RGB {
  if (typeof c !== 'string') return c
  const h = c.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** OKLab [L, a, b] */
export function toLab(c: ColorLike): RGB {
  const [r0, g0, b0] = rgb(c)
  const r = toLin(r0)
  const g = toLin(g0)
  const b = toLin(b0)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

export function fromLab([L, A, B]: RGB): RGB {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    clamp(toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    clamp(toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    clamp(toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ]
}

/** Perceptual mix in OKLab. */
export function mix(a: ColorLike, b: ColorLike, t: number): RGB {
  const x = toLab(a)
  const y = toLab(b)
  return fromLab([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}

/** Shift lightness (dl) and scale chroma (cs) in OKLab. */
export function adjust(c: ColorLike, dl: number, cs = 1): RGB {
  const [L, A, B] = toLab(c)
  return fromLab([L + dl, A * cs, B * cs])
}

/** Random small variation of a colour, like a hand-mixed paint load. */
export function vary(rng: Rng, c: ColorLike, light = 0.03, chroma = 0.01): RGB {
  const [L, A, B] = toLab(c)
  return fromLab([L + rng.gauss(0, light), A + rng.gauss(0, chroma), B + rng.gauss(0, chroma)])
}
