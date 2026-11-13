// Render a scene to PNG:  node render.ts scenes/windy-day.ts [--seed 7] [--out out/name.png]
import { basename, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { Painter } from './src/painter.ts'
import type { Scene } from './src/scene.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { seed: { type: 'string' }, out: { type: 'string' } },
})
const file = positionals[0]
if (!file) {
  console.error('usage: node render.ts scenes/<name>.ts [--seed N] [--out file.png]')
  process.exit(1)
}
const scene: Scene = (await import(pathToFileURL(resolve(file)).href)).default
const seed = values.seed ? Number(values.seed) : scene.seed
const out = values.out ?? `out/${basename(file, '.ts')}${values.seed ? `-${seed}` : ''}.png`

const t0 = performance.now()
const p = new Painter(scene.width, scene.height, seed, scene.paper)
await scene.draw(p, (label) => console.log(`  ${label.padEnd(18)} ${((performance.now() - t0) / 1000).toFixed(1)}s`))
p.save(out)
console.log(`${out}  (${((performance.now() - t0) / 1000).toFixed(1)}s)`)
