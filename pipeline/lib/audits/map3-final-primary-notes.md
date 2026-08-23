# Map III remaining states — primary plate trace notes

Source read: the native Map III raster (`map3-1925.png`) with the projected modern county mesh used only as a locator, plus the twenty printed Map III legend swatches. No outside corporate geography or later ownership history was used.

## Method

- Every modern FIPS in AZ, CA, CO, ID, MT, NE, NV, NM, ND, OR, SD, UT, WA, and WY is present.
- The plate-derived interior fill-share measurement used in the earlier primary packet supplied the conservative blank/visible-fill split: `none` at or below 0.35 and `unknown-served` above it.
- Exact raw keys replace `unknown-served` only where a large, coherent field shows a distinctive printed motif. Small counties, mixed fields, fold/border interference, and uncertain diagonal hatches remain `unknown-served`.
- `maybe:ebasco` is used for the two clear near-solid edge crossings in Mohave County, Arizona, and Elko County, Nevada.

## Exact motif calls

- **Near-solid (`ebasco`):** clear interiors in Arizona, western Colorado, southern Idaho, Clark County (Nevada), Oregon, Utah, and selected dark Washington fields. Possible white-lozenge/near-solid confusion was not forced.
- **Open diamond (`standard-gas`):** southern California, the Colorado core, north Idaho/northwest Montana, northeast Nebraska, and the isolated North Dakota fields.
- **Horizontal rule (`north-american`):** only the unmistakable Central Valley/coastal California belt.
- **Vertical dash (`federal-light`):** Pima County, the north-central New Mexico field, the southern Colorado field, and Carbon County, Wyoming.
- **Single-orientation short diagonal dash (`national-electric`):** only the coherent eastern South Dakota field. The darker southeast overlap remains unresolved.

## State cautions

- **California and Washington:** several diagonal families are visually present, but their direction/period is too close across multiple legend swatches to assign safely at county scale.
- **Colorado and Nebraska:** interlocking fields make boundary counties the largest expected blind-audit disagreement set.
- **North and South Dakota:** modern county lines cut historical filled islands; edge counties are intentionally conservative.
- **Montana and Nevada:** most of the plate is blank; visible partial edge crossings are not promoted to exact keys without a stable interior sample.

## Validation

- 626 unique FIPS: AZ 15, CA 58, CO 64, ID 44, MT 56, NE 93, NV 17, NM 33, ND 53, OR 36, SD 66, UT 29, WA 39, WY 23.
- Value counts: 248 `none`, 258 `unknown-served`, 60 `ebasco`, 24 `standard-gas`, 16 `national-electric`, 10 `north-american`, 8 `federal-light`, and 2 `maybe:ebasco`.
- The canonical trace and GitHub branch were not modified.
