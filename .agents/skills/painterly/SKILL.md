---
name: painterly
description: Paint gouache-style illustrations in code with this repo's TypeScript engine. Use when asked for a new painting or illustration in this style, to add a new element (a building, animal, prop, character, landmark) to the motif library, to change how something is drawn, or to re-render or adapt one of the existing scenes.
---

# Painterly

Owns painting with this repository: scenes in `scenes/`, the engine in `src/`, reusable elements in `src/motifs/`. Paths below start at the repo root. Everything is procedural: never load an image file as a texture or trace one. Look at references, then write the colours and shapes by hand in code.

## How a painting is made

- `Painter` (`src/painter.ts`) is a float RGB canvas plus seeded brush textures. Every mark is a dry-media mark: coverage × (texture above `1 - load`). `load` is the paint on the brush: about 0.95 reads solid, 0.6 shows grain, 0.3 is broken dry brush. `dryEnd` makes a stroke run out of paint; `edgeDry` and `rough` crumble its edges.
- Marks: `p.stroke(points, opts)` is the brush; `p.line` is a wobbly pencil/ink line; `p.fill(mask)` is a flat streaky fill; `p.shape(mask, { color, shadow, light, lightAngle, depth })` is the workhorse for solid objects: flat colour with a grainy shadow band on the side away from the light.
- Masks: `p.polygon` (ragged hand-cut edge), `p.blob` (smooth closed curve), `p.tube(path, width(t))` (limbs, trunks, ribbons), `p.mask(ctx => …)` (any canvas path), `p.maskFn((x, y) => 0..1)` (regions), `p.rim(mask, light, depth)` (the shadow side, for hatching).
- Brushwork (`src/brushwork.ts`): `scumble` scatters loose strokes over a region following a direction field (skies, ground, water, clouds); `hatch` lays parallel lines inside a mask.
- Lettering: `handwrite(p, text, x, y, { size, color, align, angle })` from `src/hand.ts` paints captions and signs as brush handwriting, accents included.
- Colour: write palettes as hex in the scene, keep them muted and close in value; `vary(rng, c, 0.02, 0.004)` gives each stroke a hand-mixed shift. Chroma jitter above about 0.006 turns greys pink and green.
- Light: one `LIGHT` angle per scene (direction the light comes from, e.g. `-2.5` upper left, `-0.6` upper right) passed to every `shape` and motif, so all shadows agree.

## Paint a new scene

1. Copy the closest file in `scenes/` to `scenes/<name>.ts`. Keep the scene shape: `{ width, height, seed, paper, draw(p, step) }`, constants (`W`, `H`, `LIGHT`, `WIND`, key horizon/ground lines as functions of x) and named palettes at the top. **Done when:** the scene renders the copied picture under the new name.
2. Block the composition back to front and render after each layer: sky (`sky`, `cloud` along a hand-placed `spine`), far distance (hazy, low contrast), middle ground (city, hills, water with `reflect`), ground, subjects, foreground framing, caption, then `p.finish()`. Call `step('label')` after each layer. **Done when:** every layer is in, nothing unpainted shows through, and the full render takes under about 20 seconds.
3. Place characters with the posable `figure` (`src/motifs/figure.ts`): pose by joint angles (0 = hanging down, π = straight up, negative swings left), `view: 'front' | 'back'`, `face: 'smile' | 'open'` for front views. `figure` returns the joints, so props go into `hands` exactly (`manjerico(p, …hands)`). **Done when:** every hand that holds something touches it and no prop covers a face.
4. Check it like a painter, not like a test: render, then look at a half-size preview and at full-size crops of each subject.

   ```sh
   node render.ts scenes/<name>.ts
   magick out/<name>.png -resize 50% /tmp/<name>-preview.png
   magick out/<name>.png -crop 700x700+X+Y +repage /tmp/<name>-crop.png
   ```

   Fix what reads wrong (a blob that should be a tree, a hidden face, a floating building, text lost in texture) and render again. **Done when:** each named subject reads at half size, and `pnpm typecheck` passes.
5. Caption with `handwrite` in a calm corner; if a texture runs under it, keep it clear (`calcada` takes `avoid`, `grass` takes `density`). **Done when:** the caption reads at half size.

## Add a new element

1. Look for an existing motif first (catalogue in [references/catalogue.md](references/catalogue.md)); extend it with an option before writing a new one. **Done when:** you know whether it is an option on an existing motif or a new function.
2. Write it as `export function name(p: Painter, x, y, size, …, light)` in the matching `src/motifs/*.ts` file. Build it from a local frame: a helper like `R(u, v)` that maps unit coordinates (scaled by `size`, rotated by an angle) to the canvas, so every proportion is a fraction of `size`. Paint back to front inside the function: far parts, body, near parts, details. **Done when:** it renders at two different sizes and two positions without changes.
3. Pick the finish by role. Landscape and buildings: `shape` or `block` plus scumbled texture, no outlines. Characters, animals and props in the foreground: `shape` per part, a wobbly ink outline (`p.line` or the `outline` helper in `critters.ts`, colour `#35291f`), and hatching on the `rim` for older or rougher things. **Done when:** it sits in a test scene next to existing elements and matches their finish.
4. Return the points other things attach to (hands, beak tip, sail centre, smoke origin). **Done when:** the scene places attached things from those return values instead of hand-tuned numbers.

## Re-render or adapt an existing scene

`node render.ts scenes/<file>.ts`, add `--seed N` for fresh brushwork (same composition; strokes and small placements change), `--out path.png` to keep both. What each scene is built from, and the choices that made it work, is in [references/catalogue.md](references/catalogue.md#scenes). **Done when:** the render matches the README preview (or the requested change) at half size.
