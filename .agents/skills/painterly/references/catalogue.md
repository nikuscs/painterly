# Catalogue

## Motifs

| File | Elements | Notes |
| --- | --- | --- |
| `src/motifs/sky.ts` | `sky`, `cloud` | `cloud` follows a `spine` of points with a `radius` per point; billows overlap back to front, each lit on its own sunny side. Lean the spine with the wind for towering clouds. |
| `src/motifs/water.ts` | `sea`, `reflect` | `reflect` samples the painted pixels above a waterline and lays broken horizontal strokes of those colours; run it after everything above the water is painted. |
| `src/motifs/land.ts` | `ground`, `trail`, `grass`, `calcada`, `castShadow` | `grass` blades grow with depth; `trail` returns its mask so grass can thin out on it. `castShadow` is faint multiplied strokes along an angle. |
| `src/motifs/trees.ts` | `canopy`, `stonePine`, `roundTree`, `cypress`, `jacaranda` | A canopy is a dark underlayer plus clumps of leaf dabs, each clump lit on its sunny side. `crown` scales the crown separately from the trunk, which framing trees need. |
| `src/motifs/city.ts` | `townhouse`, `houseRow`, `cityscape`, `belltower`, `castle`, `domeChurch`, `archBridge`, `suspensionBridge` | `houseRow` takes a base line and a per-x height range for terraces on a slope. `cityscape` paints hundreds of tiny houses back to front with a few strokes each, and parks where `green(x, y)` is high. |
| `src/motifs/things.ts` | `block`, `cottage`, `smoke`, `post`, `sagLine`, `cloth`, `gull`, `basket`, `bunting`, `grill`, `portugueseFlag`, `flagpole` | `block` is the fill-plus-scumble finish for walls and roofs. `smoke` drifts along `wind` and billows sideways with `spread`. |
| `src/motifs/tram.ts` | `tram` | Lisbon-style tram on any slope; `passengers(windows)` paints people behind the window frames. Returns `at(u, v)` for attaching things. |
| `src/motifs/boats.ts` | `rabelo` | Douro boat with stern oar, optional sail and barrels; returns the sail centre for lettering. |
| `src/motifs/figure.ts` | `figure`, `solve`, `aim` | 7-head body: tapered limbs, torso with waist and hips, mitten hands, form shading. Outfit options: skirt, sleeve length, scarf, headscarf, apron, mustache, `face`. `solve` gives joints without painting. |
| `src/motifs/critters.ts` | `robot`, `seagull`, `cat`, `dog`, `francesinha`, `nata`, `sardine`, `manjerico`, `iceCream`, `laptop`, `sign`, `cavaquinho`, `note`, `roundRect` | Foreground style: ink outlines, hatched shadow side. `seagull` returns its beak tip. |

## Scenes

Each scene file is the full recipe; read it top to bottom. What made each one work:

- `laundry-day.ts` (seed 21). Windswept headland: one `WIND` angle drives sky strokes, cloud spines, grass lean, smoke and cloth. Grass is two passes, mid-ground before the subjects and long foreground blades after them, so blades cross the figure's feet.
- `porto-golden-hour.ts` (seed 33). Ribeira from the Gaia quay: terraces of `houseRow` stepping down a hill function, `archBridge`, `reflect` on the Douro, low sun from the left. Gag: a `seagull` carries a `francesinha` placed at its returned beak point.
- `lisbon-uphill.ts` (seed 28). Side view of a 36% slope: every line (street, rails, curb, pavement waves) is a function of x with the same slope; people stand upright on it. The tram is tilted by `atan(-slope)`; bunting hangs from `sagLine`s along the facades.
- `lisbon-miradouro.ts` (seed 1147). Panorama: far bank, river and bridge, a far `cityscape` that reaches past where the hill will sit, the wooded castle hill painted over it, then a near `cityscape` climbing toward the terrace wall. Framing trees go last, with small crowns (`crown` 0.55 to 0.6) so the sky still shows.

## Lessons that cost a render

- Grain must be fine (2 to 6 px speckle); coarse grain reads as camouflage, not paint.
- Paint regions that will be partly covered past where they end (the far city under the hill), or gaps of bare paper show.
- Masks that run off the canvas are treated as continuing, so no fake shadow rim appears along the border.
- A tree crown is clumps, not one blob: give it `lobes`, keep leaf dabs small (`leaf` 3 to 12 px).
- Faces: small happy-arc eyes, a smile and rosy cheeks read friendly at any size; anything more detailed fights the style.
- Keep a bold pattern (calçada waves, tiles) lower in contrast than the subjects, or it takes over the picture.
