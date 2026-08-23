# Map III batch 1 — primary plate trace notes

Source read: native Map III raster (`map3-1925.png`) with the modern county mesh used only as a locator. No outside ownership claims were used to change a plate call.

## Calls

- **Arkansas:** The central and southern field is the near-solid `ebasco` motif. The north-central/northeastern vertical-rule field is `fitkin`. Counties on the irregular join or with only partial visible fill remain `maybe:ebasco` or `unknown-served`.
- **Louisiana:** The high-coverage solid blocks in the north continue the visible `ebasco` motif. South Louisiana contains multiple isolated diagonal fields. Their periods and weights are too close to separate safely at county scale in this pass, so they remain `unknown-served`.
- **Kansas:** The long northern vertical-rule block is `fitkin`. The high-coverage open-diamond lattice at the far eastern edge is `standard-gas`. The solid central/southern blocks and sparse southeast diagonal marks are left `unknown-served` rather than forcing a legend match.
- **Oklahoma:** The high-coverage open-diamond lattice across the core is `standard-gas`. A dark white-lozenge motif crosses and overlaps it; counties on that overprint or on field edges remain `unknown-served`.
- **Texas:** Blank versus visibly filled/partial counties were indexed, but the large state contains several interlocking motifs (solid, white-lozenge, diagonal, and short horizontal marks). Pattern identity was not forced during this checkpoint; all visible Texas fills remain `unknown-served` for independent adjudication.

## Conservative uncertainty rules

- A county with measured fill share below 0.35 is `none`; at this level the residual ink is adequately explained by county/state linework.
- A county above that threshold is retained as served or partially served. Exact keys are used only in the high-coverage interiors of visually distinctive regional motifs.
- `unknown-served` is intentional evidence preservation, not a missing FIPS. It marks visible fill whose legend identity should be resolved by a blind auditor.
- Present-day county geometry does not perfectly match 1925 boundaries. Edge counties are therefore the main expected disagreement set.

## Validation

- 575 unique FIPS are present: AR 75, LA 64, KS 105, OK 77, TX 254.
- Values are restricted to exact raw keys, `none`, `maybe:key`, or `unknown-served`.
- The canonical trace was not modified.
