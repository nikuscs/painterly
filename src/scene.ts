import type { ColorLike } from './color.ts'
import type { Painter } from './painter.ts'

export type Scene = {
  width: number
  height: number
  seed: number
  /** Paper colour under everything. */
  paper?: ColorLike
  /** Paint the scene; call `step` after each layer to log timings. */
  draw: (p: Painter, step: (label: string) => void) => void | Promise<void>
}
