import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createCanvas, type Canvas, type SKRSContext2D } from '@napi-rs/canvas'
import { rgb, type ColorLike, type RGB } from './color.ts'
import { clamp, densify, lerp, Rng, smoothPath, smoothstep, type Pt } from './math.ts'
import { Simplex, Texture } from './noise.ts'

/** Coverage mask the size of the canvas, with a bounding box for fast iteration. */
export type Mask = { data: Float32Array; x0: number; y0: number; x1: number; y1: number }

export type StrokeOpts = {
  color: ColorLike
  /** Second pigment streaked through the stroke along the bristles. */
  color2?: ColorLike
  /** 0..1 how much of color2 shows. */
  streak?: number
  /** Full width in px, or a function of t in [0, 1] along the stroke. */
  width: number | ((t: number) => number)
  /** Fraction of the length that tapers at start and end. */
  taper?: [number, number]
  /** Paint load 0..1. 1 is solid; lower lets the grain show through. */
  load?: number
  /** How much the load runs out toward the end (dry brush). */
  dryEnd?: number
  /** Breakup toward the stroke edges. */
  edgeDry?: number
  /** 0 = bristle streaks only, 1 = paper grain only. */
  grain?: number
  /** Scale of bristle streak spacing (1 ≈ 2-6 px streaks). */
  bristle?: number
  /** Edge raggedness 0..1. */
  rough?: number
  /** Edge sharpness of the grain threshold (smaller = crisper speckle). */
  soft?: number
  opacity?: number
  smooth?: boolean
  clip?: Mask
  blend?: 'normal' | 'multiply' | 'screen'
}

export type FillOpts = {
  color: ColorLike
  color2?: ColorLike
  streak?: number
  load?: number
  grain?: number
  bristle?: number
  /** Direction of the brush streaks inside the fill, radians. */
  angle?: number
  soft?: number
  opacity?: number
  blend?: 'normal' | 'multiply' | 'screen'
}

/**
 * The paint surface: a float RGB buffer plus procedural brush textures.
 * Every mark goes through the same dry-media model: coverage × (texture > 1 - load).
 */
export class Painter {
  readonly w: number
  readonly h: number
  readonly rng: Rng
  readonly noise: Simplex
  readonly px: Float32Array
  /** Canvas-fixed paper tooth: small blotchy speckle. */
  readonly paper: Texture
  /** Stroke-local bristle streaks: long along u, fine across v. */
  readonly bristles: Texture
  /** Second bristle field for colour streaking. */
  readonly bristles2: Texture
  /** Low-frequency 1D-ish noise for ragged edges. */
  readonly edge: Texture

  private scratch = new Float32Array(0)
  private maskCanvas: Canvas | null = null

  constructor(w: number, h: number, seed: number, background: ColorLike = '#f2efe6') {
    this.w = w
    this.h = h
    this.rng = new Rng(seed)
    this.noise = new Simplex(seed)
    this.px = new Float32Array(w * h * 3)
    const [r, g, b] = rgb(background)
    for (let i = 0; i < w * h; i++) {
      this.px[i * 3] = r
      this.px[i * 3 + 1] = g
      this.px[i * 3 + 2] = b
    }
    this.paper = new Texture(
      512,
      512,
      [
        { cx: 2, cy: 2, amp: 0.9 },
        { cx: 4, cy: 4, amp: 0.8 },
        { cx: 8, cy: 8, amp: 0.45 },
        { cx: 16, cy: 16, amp: 0.25 },
        { cx: 64, cy: 64, amp: 0.3 },
      ],
      seed + 1,
      3,
    )
    this.bristles = new Texture(
      1920,
      240,
      [
        { cx: 16, cy: 1, amp: 0.5 },
        { cx: 32, cy: 2, amp: 0.8 },
        { cx: 96, cy: 3, amp: 0.6 },
        { cx: 240, cy: 6, amp: 0.45 },
        { cx: 480, cy: 12, amp: 0.3 },
        { cx: 6, cy: 2, amp: 0.3 },
      ],
      seed + 2,
    )
    this.bristles2 = new Texture(
      1920,
      240,
      [
        { cx: 160, cy: 4, amp: 0.8 },
        { cx: 480, cy: 10, amp: 0.6 },
        { cx: 48, cy: 2, amp: 0.3 },
      ],
      seed + 3,
    )
    this.edge = new Texture(
      1024,
      64,
      [
        { cx: 8, cy: 64, amp: 0.4 },
        { cx: 32, cy: 64, amp: 0.8 },
        { cx: 128, cy: 64, amp: 0.6 },
      ],
      seed + 4,
    )
  }

  // ---------------------------------------------------------------- blending

  private put(i: number, c: RGB, a: number, blend: StrokeOpts['blend']) {
    if (a <= 0.001) return
    if (a > 1) a = 1
    const k = i * 3
    const px = this.px
    for (let ch = 0; ch < 3; ch++) {
      const d = px[k + ch]
      const s = c[ch]
      const t = blend === 'multiply' ? d * s : blend === 'screen' ? 1 - (1 - d) * (1 - s) : s
      px[k + ch] = d + (t - d) * a
    }
  }

  /** Dry-media threshold: returns 0..1 paint presence for texture value `tex` at paint `load`. */
  private static dry(tex: number, load: number, soft: number) {
    if (load >= 0.999) return 1
    if (load <= 0) return 0
    const th = 1 - load
    return smoothstep(th - soft, th + soft, tex)
  }

  // ---------------------------------------------------------------- strokes

  /** One brush stroke along a path. The core mark-making primitive. */
  stroke(points: Pt[], o: StrokeOpts) {
    if (points.length < 2) return
    const W = this.w
    const H = this.h
    const path = o.smooth === false ? densify(points, 2) : smoothPath(points, 2)
    const n = path.length
    if (n < 2) return

    const cum = new Float32Array(n)
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
    const total = cum[n - 1] || 1
    const [ta, tb] = o.taper ?? [0.15, 0.25]
    const rad = new Float32Array(n)
    let maxR = 0
    for (let i = 0; i < n; i++) {
      const t = cum[i] / total
      const base = typeof o.width === 'function' ? o.width(t) : o.width
      let f = 1
      if (ta > 0 && t < ta) f = Math.sqrt(t / ta)
      if (tb > 0 && t > 1 - tb) f = Math.min(f, Math.sqrt((1 - t) / tb))
      rad[i] = Math.max(0.35, (base / 2) * (0.25 + 0.75 * f))
      if (rad[i] > maxR) maxR = rad[i]
    }
    const rough = o.rough ?? 0.25
    const pad = maxR * (1 + rough) + 2

    let bx0 = Infinity
    let by0 = Infinity
    let bx1 = -Infinity
    let by1 = -Infinity
    for (const [x, y] of path) {
      if (x < bx0) bx0 = x
      if (y < by0) by0 = y
      if (x > bx1) bx1 = x
      if (y > by1) by1 = y
    }
    bx0 = Math.max(0, Math.floor(bx0 - pad))
    by0 = Math.max(0, Math.floor(by0 - pad))
    bx1 = Math.min(W - 1, Math.ceil(bx1 + pad))
    by1 = Math.min(H - 1, Math.ceil(by1 + pad))
    if (bx0 > bx1 || by0 > by1) return
    const bw = bx1 - bx0 + 1
    const bh = by1 - by0 + 1
    const N = bw * bh
    if (this.scratch.length < N * 4) this.scratch = new Float32Array(N * 4)
    const S = this.scratch // [metric, u, v, r] per pixel
    for (let k = 0; k < N; k++) S[k * 4] = 1e9

    // Pass 1: nearest segment per pixel → stroke-local (u along, v across).
    for (let i = 0; i < n - 1; i++) {
      const ax = path[i][0]
      const ay = path[i][1]
      const dx = path[i + 1][0] - ax
      const dy = path[i + 1][1] - ay
      const l2 = dx * dx + dy * dy
      const segLen = Math.sqrt(l2)
      const r0 = rad[i]
      const r1 = rad[i + 1]
      const rp = Math.max(r0, r1) * (1 + rough) + 1.5
      const sx0 = Math.max(bx0, Math.floor(Math.min(ax, ax + dx) - rp))
      const sx1 = Math.min(bx1, Math.ceil(Math.max(ax, ax + dx) + rp))
      const sy0 = Math.max(by0, Math.floor(Math.min(ay, ay + dy) - rp))
      const sy1 = Math.min(by1, Math.ceil(Math.max(ay, ay + dy) + rp))
      for (let y = sy0; y <= sy1; y++) {
        const py = y + 0.5 - ay
        let k = ((y - by0) * bw + (sx0 - bx0)) * 4
        for (let x = sx0; x <= sx1; x++, k += 4) {
          const qx = x + 0.5 - ax
          let t = l2 > 0 ? (qx * dx + py * dy) / l2 : 0
          t = t < 0 ? 0 : t > 1 ? 1 : t
          const ex = qx - dx * t
          const ey = py - dy * t
          const d = Math.sqrt(ex * ex + ey * ey)
          const r = r0 + (r1 - r0) * t
          const m = d - r
          if (m < S[k]) {
            S[k] = m
            S[k + 1] = cum[i] + t * segLen
            S[k + 2] = dx * py - dy * qx >= 0 ? d : -d
            S[k + 3] = r
          }
        }
      }
    }

    // Pass 2: coverage × dry-media texture → composite.
    const c1 = rgb(o.color)
    const c2 = o.color2 ? rgb(o.color2) : null
    const streak = o.streak ?? 0.5
    const load0 = o.load ?? 0.85
    const dryEnd = o.dryEnd ?? 0.25
    const edgeDry = o.edgeDry ?? 0.3
    const grainMix = o.grain ?? 0.4
    const bs = o.bristle ?? 1
    const soft = o.soft ?? 0.06
    const opacity = o.opacity ?? 1
    const clip = o.clip
    const blend = o.blend ?? 'normal'
    const su = this.rng.range(0, 1920)
    const sv = this.rng.range(0, 240)
    const se = this.rng.range(0, 1024)
    const col: RGB = [0, 0, 0]
    for (let y = by0; y <= by1; y++) {
      let k = (y - by0) * bw * 4
      for (let x = bx0; x <= bx1; x++, k += 4) {
        if (S[k] > rough * S[k + 3] + 1.5) continue
        const u = S[k + 1]
        const v = S[k + 2]
        const r = S[k + 3]
        const d = Math.abs(v)
        const rn = rough > 0 ? r * (1 + rough * (this.edge.sample(se + u * 0.35, v > 0 ? 5 : 37) - 0.5) * 2) : r
        const cov = 1 - smoothstep(rn - 0.7, rn + 0.7, d)
        if (cov <= 0) continue
        const t = u / total
        const vn = d / Math.max(rn, 0.6)
        const load = load0 * (1 - dryEnd * smoothstep(0.3, 1, t)) - edgeDry * vn * vn * 0.45
        const bv = this.bristles.sample(su + u / bs, sv + v / bs)
        const tex = grainMix >= 1 ? this.paper.sample(x, y) : lerp(bv, this.paper.sample(x, y), grainMix)
        let a = cov * Painter.dry(tex, load, soft) * opacity
        if (clip) a *= clip.data[y * W + x]
        if (a <= 0.001) continue
        let c = c1
        if (c2) {
          const s = smoothstep(1 - streak - 0.12, 1 - streak + 0.12, this.bristles2.sample(su + u / bs, sv + v / bs))
          col[0] = c1[0] + (c2[0] - c1[0]) * s
          col[1] = c1[1] + (c2[1] - c1[1]) * s
          col[2] = c1[2] + (c2[2] - c1[2]) * s
          c = col
        }
        this.put(y * W + x, c, a, blend)
      }
    }
  }

  /** Thin wobbly pencil/ink line. */
  line(points: Pt[], o: Partial<StrokeOpts> & { color: ColorLike; wobble?: number }) {
    const wob = o.wobble ?? 1.2
    const pts = wob > 0 ? this.wobble(smoothPath(points, 6), wob, 0.02) : points
    this.stroke(pts, {
      width: 2,
      load: 0.9,
      grain: 0.7,
      dryEnd: 0.05,
      edgeDry: 0.2,
      rough: 0.15,
      taper: [0.02, 0.02],
      soft: 0.1,
      ...o,
    })
  }

  /** Perpendicular noise displacement along a path (hand tremor). */
  wobble(pts: Pt[], amp: number, freq = 0.02): Pt[] {
    const seed = this.rng.range(0, 1000)
    let acc = 0
    return pts.map((p, i) => {
      const q = pts[Math.min(i + 1, pts.length - 1)]
      const o = pts[Math.max(i - 1, 0)]
      const dx = q[0] - o[0]
      const dy = q[1] - o[1]
      const l = Math.hypot(dx, dy) || 1
      if (i > 0) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])
      const n = this.noise.fbm(acc * freq, seed, 3) * amp
      return [p[0] - (dy / l) * n, p[1] + (dx / l) * n] as Pt
    })
  }

  // ---------------------------------------------------------------- masks & fills

  /** Rasterise a shape with Canvas path commands into a soft-edged mask. */
  mask(draw: (ctx: SKRSContext2D) => void): Mask {
    this.maskCanvas ??= createCanvas(this.w, this.h)
    const ctx = this.maskCanvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.w, this.h)
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#fff'
    draw(ctx)
    const img = ctx.getImageData(0, 0, this.w, this.h).data
    const data = new Float32Array(this.w * this.h)
    for (let i = 0; i < data.length; i++) data[i] = img[i * 4 + 3] / 255
    return this.bounds(data)
  }

  /** Mask from a function of (x, y) → 0..1. */
  maskFn(f: (x: number, y: number) => number, box?: [number, number, number, number]): Mask {
    const data = new Float32Array(this.w * this.h)
    const [x0, y0, x1, y1] = box ?? [0, 0, this.w - 1, this.h - 1]
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) data[y * this.w + x] = clamp(f(x, y))
    return this.bounds(data)
  }

  /** Polygon mask with a ragged, hand-cut edge. */
  polygon(pts: Pt[], ragged = 1.5): Mask {
    const edge = ragged > 0 ? this.wobble(densify([...pts, pts[0]], 3), ragged, 0.08) : pts
    return this.mask((ctx) => {
      ctx.beginPath()
      edge.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.fill()
    })
  }

  private bounds(data: Float32Array): Mask {
    let x0 = this.w
    let y0 = this.h
    let x1 = -1
    let y1 = -1
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (data[y * this.w + x] > 0) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
    return { data, x0, y0, x1, y1 }
  }

  /** Textured flat fill of a mask, with brush streaks running along `angle`. */
  fill(m: Mask, o: FillOpts) {
    const c1 = rgb(o.color)
    const c2 = o.color2 ? rgb(o.color2) : null
    const streak = o.streak ?? 0.5
    const load = o.load ?? 0.9
    const grainMix = o.grain ?? 0.4
    const bs = o.bristle ?? 1.5
    const soft = o.soft ?? 0.06
    const op = o.opacity ?? 1
    const ca = Math.cos(o.angle ?? 0)
    const sa = Math.sin(o.angle ?? 0)
    const su = this.rng.range(0, 1920)
    const sv = this.rng.range(0, 240)
    const col: RGB = [0, 0, 0]
    for (let y = m.y0; y <= m.y1; y++) {
      for (let x = m.x0; x <= m.x1; x++) {
        const i = y * this.w + x
        const cov = m.data[i]
        if (cov <= 0) continue
        const u = (x * ca + y * sa) / bs
        const v = (-x * sa + y * ca) / bs
        const tex = lerp(this.bristles.sample(su + u, sv + v), this.paper.sample(x, y), grainMix)
        const a = cov * Painter.dry(tex, load, soft) * op
        if (a <= 0.001) continue
        let c = c1
        if (c2) {
          const s = smoothstep(1 - streak - 0.12, 1 - streak + 0.12, this.bristles2.sample(su + u, sv + v))
          col[0] = c1[0] + (c2[0] - c1[0]) * s
          col[1] = c1[1] + (c2[1] - c1[1]) * s
          col[2] = c1[2] + (c2[2] - c1[2]) * s
          c = col
        }
        this.put(i, c, a, o.blend)
      }
    }
  }

  /** Mask of a variable-width tube along a path (limbs, ribbons). `width(t)` is the full width at t in [0, 1]. */
  tube(points: Pt[], width: (t: number) => number): Mask {
    const path = smoothPath(points, 1)
    const cum = [0]
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
    const total = cum[cum.length - 1] || 1
    return this.mask((ctx) => {
      ctx.beginPath()
      path.forEach(([x, y], i) => {
        const r = Math.max(0.4, width(cum[i] / total) / 2)
        ctx.moveTo(x + r, y)
        ctx.arc(x, y, r, 0, Math.PI * 2)
      })
      ctx.fill()
    })
  }

  /** Mask of a smooth closed outline through the given points. */
  blob(points: Pt[]): Mask {
    const closed = smoothPath([...points, points[0], points[1]], 2)
    return this.mask((ctx) => {
      ctx.beginPath()
      closed.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.fill()
    })
  }

  /**
   * Form-shaded fill: base colour, a grainy shadow band on the side facing away from the light,
   * and an optional highlight band on the lit side. Gives flat shapes a gouache-illustration volume.
   */
  shape(
    m: Mask,
    o: {
      color: ColorLike
      shadow: ColorLike
      light?: ColorLike
      /** Direction the light comes from, radians (e.g. -2.4 = upper left). */
      lightAngle: number
      /** Width of the shadow band in px. */
      depth: number
      /** Width of the highlight band in px (default depth × 0.5). */
      lightDepth?: number
      /** Brush streak direction. */
      angle?: number
      grain?: number
      soft?: number
    },
  ) {
    const W = this.w
    const H = this.h
    const base = rgb(o.color)
    const sh = rgb(o.shadow)
    const li = o.light ? rgb(o.light) : null
    const lx = Math.cos(o.lightAngle)
    const ly = Math.sin(o.lightAngle)
    const ld = o.lightDepth ?? o.depth * 0.5
    const grainMix = o.grain ?? 0.45
    const soft = o.soft ?? 0.08
    const ca = Math.cos(o.angle ?? Math.PI / 2)
    const sa = Math.sin(o.angle ?? Math.PI / 2)
    const su = this.rng.range(0, 1920)
    const sv = this.rng.range(0, 240)
    const at = (x: number, y: number) => {
      const xi = Math.round(x)
      const yi = Math.round(y)
      return xi < 0 || yi < 0 || xi >= W || yi >= H ? 0 : m.data[yi * W + xi]
    }
    const col: RGB = [0, 0, 0]
    for (let y = m.y0; y <= m.y1; y++) {
      for (let x = m.x0; x <= m.x1; x++) {
        const i = y * W + x
        const cov = m.data[i]
        if (cov <= 0) continue
        const u = (x * ca + y * sa) / 1.5
        const v = (-x * sa + y * ca) / 1.5
        const tex = lerp(this.bristles.sample(su + u, sv + v), this.paper.sample(x, y), grainMix)
        // probe away from the light: falling off the shape there means we sit on the shadow side
        const away = 1 - (at(x - lx * o.depth, y - ly * o.depth) * 0.6 + at(x - lx * o.depth * 0.5, y - ly * o.depth * 0.5) * 0.4)
        const s = Painter.dry(tex, smoothstep(0.15, 0.6, away), soft)
        let k = s
        col[0] = base[0] + (sh[0] - base[0]) * k
        col[1] = base[1] + (sh[1] - base[1]) * k
        col[2] = base[2] + (sh[2] - base[2]) * k
        if (li) {
          const toward = 1 - at(x + lx * ld, y + ly * ld)
          k = Painter.dry(1 - tex, smoothstep(0.3, 0.8, toward) * (1 - s), soft) * 0.85
          col[0] += (li[0] - col[0]) * k
          col[1] += (li[1] - col[1]) * k
          col[2] += (li[2] - col[2]) * k
        }
        this.put(i, col, cov * Painter.dry(tex, 0.97, soft), 'normal')
      }
    }
  }

  /** Vertical gradient wash over the whole canvas (or a mask). */
  gradient(stops: [number, ColorLike][], m?: Mask) {
    const cs = stops.map(([t, c]) => [t, rgb(c)] as const)
    for (let y = 0; y < this.h; y++) {
      const t = y / (this.h - 1)
      let j = 0
      while (j < cs.length - 2 && t > cs[j + 1][0]) j++
      const [ta, ca] = cs[j]
      const [tb, cb] = cs[j + 1]
      const f = clamp((t - ta) / (tb - ta || 1))
      const c: RGB = [lerp(ca[0], cb[0], f), lerp(ca[1], cb[1], f), lerp(ca[2], cb[2], f)]
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x
        this.put(i, c, m ? m.data[i] : 1, 'normal')
      }
    }
  }

  // ---------------------------------------------------------------- finishing

  /** Paper tooth and a whisper of colour noise over everything. */
  finish(amount = 0.035) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const k = (y * this.w + x) * 3
        const g = (this.paper.sample(x * 1.7 + 113, y * 1.7 + 71) - 0.5) * amount
        const fine = (this.rng.next() - 0.5) * amount * 0.4
        for (let c = 0; c < 3; c++) this.px[k + c] = clamp(this.px[k + c] + g + fine)
      }
  }

  /** Pixels of a mask on the side facing away from the light (for hatching shadows). */
  rim(m: Mask, lightAngle: number, depth: number): Mask {
    const W = this.w
    const lx = Math.cos(lightAngle) * depth
    const ly = Math.sin(lightAngle) * depth
    return this.maskFn(
      (x, y) => {
        const v = m.data[y * W + x]
        if (v <= 0) return 0
        const sx = Math.round(x - lx)
        const sy = Math.round(y - ly)
        const out = sx < 0 || sy < 0 || sx >= W || sy >= this.h ? 1 : 1 - m.data[sy * W + sx]
        return v * smoothstep(0.3, 0.7, out)
      },
      [m.x0, m.y0, m.x1, m.y1],
    )
  }

  toCanvas() {
    const canvas = createCanvas(this.w, this.h)
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(this.w, this.h)
    for (let i = 0; i < this.w * this.h; i++) {
      img.data[i * 4] = this.px[i * 3] * 255
      img.data[i * 4 + 1] = this.px[i * 3 + 1] * 255
      img.data[i * 4 + 2] = this.px[i * 3 + 2] * 255
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    return canvas
  }

  save(path: string) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, this.toCanvas().toBuffer('image/png'))
  }
}
