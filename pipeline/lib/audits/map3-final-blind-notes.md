# Map III blind plate audit — western and Plains states

## Scope and source discipline

This is an independent read of the native `data-raw/ftc72a/map3-1925.png` for AZ, CA,
CO, ID, MT, NE, NV, NM, ND, OR, SD, UT, WA, and WY. Modern county identities and
boundaries came only from the county geometry under
`trace-work/market-map/pipeline/data-raw/`. Corporate identities came only from the
twenty printed Map III legend cells. I did not consult any `map3-final-primary*` file,
canonical trace judgment for these states, outside corporate geography, or another
agent's work.

## Method

1. Read all twenty legend textures at native raster resolution and keyed them by the
   raw Map III vocabulary used in the output: `ebasco`, `southeastern`,
   `northeastern-super`, `united-gas-electric`, `insull`, `standard-gas`,
   `cities-service`, `stone-webster`, `north-american`, `fitkin`,
   `north-american-light`, `american-water-works`, `hodenpyl`, `age`,
   `united-light-power`, `federal-light`, `national-electric`,
   `general-gas-electric`, `ugi`, and `tenney`.
2. Projected modern county geometry onto the plate solely to identify the modern FIPS
   intersecting each printed 1925 county field. The texture itself, not image darkness
   alone, determined the key. I compared regional runs as well as single counties so
   engraved borders and state lines would not be mistaken for a fill.
3. Used `none` where the county interior is blank. Used `maybe:key` when the plate
   supports one identity but modern/1925 boundary mismatch or a thin edge leaves
   presence uncertain. Used sorted `amb:key|key` only where a modern county lies on a
   legible two-texture boundary and the scan does not support choosing one. No uncertain
   case was silently forced to a definite key.
4. Treated the two important post-1925 counties conservatively: La Paz, AZ inherits the
   clearly filled 1925 Yuma field; Broomfield, CO is marked from the texture visible at
   its modern footprint rather than assumed from any later corporate history.

## Plate observations

- The West is dominated by a few unusually legible textures: near-solid `ebasco`, the
  large diamond lattice of `standard-gas`, the wide opposing diagonal rules of
  `cities-service` and `stone-webster`, the horizontal rule of `north-american`, and the
  vertical dashes of `federal-light`.
- Arizona has only the old Yuma field plus the isolated Pima dash field; the dark field
  immediately northwest of modern Mohave is outside Arizona.
- California has four coherent regions: northern `stone-webster`, the Bay/Sacramento
  `standard-gas` cluster, the central/coastal `north-american` run, and the southern
  `standard-gas` cluster. The main uncertainty is at the small Sierra/Bay transition
  counties where the modern overlay is close to several engraved borders.
- Idaho's broad southwestern and southeastern dark fields are `ebasco`; the northern
  Boundary County lattice is `standard-gas`. Montana is otherwise blank except for the
  Flathead/Glacier lattice and the Teton–Lewis and Clark diagonal run.
- New Mexico's served fields all carry the same `federal-light` vertical-dash texture.
  The modern Cibola/Valencia split is handled as the single filled 1925 Valencia field.
- Oregon's Willamette/coastal lattice is `standard-gas`, its southern-edge diagonals are
  `stone-webster`, and the eastern dark islands are `ebasco`. Washington contains a
  northern/Puget `stone-webster` run, Olympic `federal-light` dashes, southern/northwest
  `standard-gas` fragments, and substantial `ebasco` interiors.
- In the Plains, the dense field of horizontal dashes in Nebraska is
  `united-light-power`, not the visually similar horizontal solid rule of
  `north-american`. Nebraska also has `ugi` dots, `standard-gas` diamonds,
  `north-american-light` loops, and two diagonal/dash textures. South Dakota's broad
  short-slash field is `national-electric`; its southeast lattice is `standard-gas`.
  North Dakota has only the Ward lattice and the eastern lattice block.
- Wyoming's two isolated dash fields are `federal-light`; the two southeast diagonal
  counties are `cities-service`.

## Validation

The JSON is a flat object sorted by five-digit county FIPS. It contains exactly 626
unique keys. Per-state counts are:

| State FIPS | Counties |
|---|---:|
| 04 | 15 |
| 06 | 58 |
| 08 | 64 |
| 16 | 44 |
| 30 | 56 |
| 31 | 93 |
| 32 | 17 |
| 35 | 33 |
| 38 | 53 |
| 41 | 36 |
| 46 | 66 |
| 49 | 29 |
| 53 | 39 |
| 56 | 23 |

All values pass the required grammar: an exact raw key, `none`, sorted
`amb:key|key`, `maybe:key`, or `unknown-served`.
