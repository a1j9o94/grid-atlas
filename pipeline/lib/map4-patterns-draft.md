# Map IV (1932) legend and pattern draft

Status: evidence draft only. This file does not alter the canonical county trace or production data.

## Count correction

The native 5,521 × 3,784 raster contains **24 printed top-level swatch cells**, not 28. The earlier 28-cell estimate should not be carried into a validator.

Three of the 24 swatches are umbrella textures with numeral overlays:

- P01 Electric Bond & Share: numerals 1–4.
- P02 Middle West Utilities: numerals 1–13; the legend explicitly says number 9 is not shown on the map.
- P04 United Corporation: numerals 1–6.

P03, Other Insull Companies, is also a parent-style entry but has no subsidiary numerals. If every umbrella texture is allowed an explicit `unmarked` identity, the anonymous raw vocabulary has 47 keys. If only the printed numbered identities are retained for those three umbrellas, it has 44. The choice belongs in the schema contract; it must not be inferred county by county.

## Anonymous swatches

Coordinates are native image pixels in `data-raw/ftc72a/map4-1932.png`, origin upper-left. The machine-readable boxes and full label transcription are in `map4-legend-draft.json`.

| Key | Printed entry | Visual description | Primary confusables |
|---|---|---|---|
| P01 | Electric Bond & Share Co. | Near-solid dark mottled field | None at swatch scale; small black counties can hide the subsidiary numeral |
| P02 | Middle West Utilities Co. | Coarse orthogonal square grid | None at swatch scale; grid can collapse to gray in tiny counties |
| P03 | Other Insull Companies | Coarse diagonal crosshatch, open diamonds | P10, P18, P24 |
| P04 | United Corporation (The) | Wide vertical rails plus short vertical dash columns | P23 |
| P05 | American Commonwealths Power Corp. | Rows of short horizontal dashes | P07, P19 |
| P06 | American Electric Power Corp. | Close descending diagonals | P08, P21 |
| P07 | American Water Works & Electric Co. (The) | Horizontal rails alternating with horizontal dash rows | P05, P15, P22 |
| P08 | Associated Gas & Electric Co. | Wide descending diagonals | P06, P21 |
| P09 | Central Public Service Corp. | Heavy vertical stripes | P13 |
| P10 | Central States Electric Co. | Dense crosshatch, small diamonds | P03, P18, P24 |
| P11 | Cities Service Co. | Medium ascending diagonals | P16, P17 |
| P12 | Duke Power Co. | Regular solid-dot or small-diamond grid | P19 |
| P13 | Empire Power Corp. | Fine vertical lines | P09 |
| P14 | Nevada-California Electric Corp. (The) | Short ascending diagonal dashes | P20 |
| P15 | New England Power Association | Medium horizontal stripes | P07, P22 |
| P16 | North American Co. (The) | Close ascending diagonals | P11, P17 |
| P17 | North American Lt. & Pr. Co. | Wide ascending diagonals | P11, P16 |
| P18 | Pacific Gas & Electric Co. | Diamond lattice with a dot/lozenge in each cell | P03, P10, P24 |
| P19 | Rockland Light & Power Co. | Sparse irregular dots/rosettes | P05, P12 |
| P20 | Standard Gas & Electric Co. | Sparse short descending diagonal dashes | P14 |
| P21 | Stone & Webster, Inc. | Fine descending diagonals | P06, P08 |
| P22 | Tri-Utilities Corp. | Fine horizontal lines | P07, P15 |
| P23 | United Light & Power Co. (The) | Vertical rails plus repeated short vertical dashes | P04 |
| P24 | Utilities Power & Light Corp. | Dark field with large white diamonds | P03, P10, P18 |

## Confusable-set audit rules

1. **Ascending diagonal set:** P11/P16/P17. Compare line spacing over a multi-county field. Do not classify from a single narrow county.
2. **Descending diagonal set:** P06/P08/P21. P06 and P21 are especially close; use an anonymous ambiguity set when the scan does not preserve their spacing.
3. **Axis stripe set:** P09/P13 and P15/P22. Heavy versus fine spacing is the discriminator.
4. **Rail-plus-dash set:** P04/P23. These are structurally similar; a blind auditor should review every instance where surrounding counties do not supply a larger texture field.
5. **Crosshatch/diamond set:** P03/P10/P18/P24. P18 has a center mark; P24 is polarity-reversed and much darker; P03 is coarse and open; P10 is dense.
6. **Sparse-mark set:** P05/P12/P14/P19/P20. Stroke direction and regularity matter more than average darkness.
7. **Horizontal hybrid:** P07 can resemble P05, P15, or P22 when only one or two rows survive inside a county.

For each confusable set, the trace should retain `ambiguous_pattern` with the candidate texture keys rather than force a corporate label. Numeral visibility is a separate uncertainty dimension from texture visibility.

## Georeference finding

Map III's coefficients cannot be reused directly: the scans differ in width (5,111 versus 5,521 pixels), crop, affine placement, fold distortion, and local page warp. They are useful only as a conceptual seed because the geographic base map and projection are closely related.

A fresh Map IV fit was run against the Map IV raster using the same Albers projection basis but independent coefficients and independent texture-boundary optimization. Its final national-outline ICP step matched 1,303 retained samples at 2.40 px RMS, 3.98 px at the 95th percentile, and 4.48 px maximum within the retained sample. The provisional coefficients and the limitations of that statistic are recorded separately; they are not a release georeference until a withheld landmark audit signs off.

## Remaining validation before tracing

- Independently re-read all 24 swatches and every subsidiary line from the native raster.
- Freeze the P04/P23 and P06/P21 confusion rules before county transcription begins.
- Decide whether umbrella `unmarked` values are valid trace outputs or only evidence-layer placeholders.
- Validate the provisional fit on withheld interior state/county junctions; national-outline ICP is not sufficient by itself.
- Inspect fold corridors near the vertical page creases separately because the cubic warp can fit the national outline while missing interior county lines locally.

