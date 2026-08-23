# Map III final adjudication — remaining 626 counties

## Decision

**GO for a checkpoint merge; NO-GO for release.** The packet is complete, grammar-valid, and conservative enough to merge as the human-auditable Map III checkpoint. It is not a release artifact: 120 counties deliberately retain uncertainty (`unknown-served`, `maybe:`, or `amb:`), and the adjudicated packet does not meet the 0.98 served-status threshold when mechanically compared with the blind packet.

This adjudication used only the native Map III plate, its printed legend, and the projected modern-county mesh as a locator. No corporate geography or later ownership knowledge was used.

## Method

- Identical primary/blind values were retained.
- A blind exact label replaced primary `unknown-served` only when the same printed motif repeated across a coherent visible field in the state crop. Isolated exact claims stayed `unknown-served`.
- A blind `none` did not erase primary `unknown-served`; `none` was used only when the county interior was cleanly blank on re-read.
- Exact-vs-exact pattern conflicts became sorted `amb:` values unless the native plate clearly distinguished the repeated motif.
- Partial edge crossings became `maybe:key`; visible service with an unreadable motif stayed `unknown-served`.
- The 37 scorer-visible disagreements were re-read individually. Codes in the table are: **P** repeated visible motif, **B** clean blank, **U** partial/edge uncertainty, and **R** served but raw pattern unresolved.

## Direct-conflict resolutions

| FIPS | County | Primary | Blind | Adjudicated | Basis |
|---|---|---|---|---|---|
| 04013 | Maricopa, AZ | `ebasco` | `none` | `maybe:ebasco` | U |
| 06073 | San Diego, CA | `standard-gas` | `none` | `standard-gas` | P |
| 08025 | Crowley, CO | `none` | `amb:federal-light|standard-gas` | `none` | B |
| 08041 | El Paso, CO | `standard-gas` | `none` | `none` | B |
| 16017 | Bonner, ID | `standard-gas` | `none` | `none` | B |
| 16019 | Bonneville, ID | `ebasco` | `none` | `none` | B |
| 30099 | Teton, MT | `standard-gas` | `cities-service` | `unknown-served` | R |
| 31013 | Box Butte, NE | `none` | `cities-service` | `none` | B |
| 31051 | Dixon, NE | `standard-gas` | `ugi` | `amb:standard-gas|ugi` | R |
| 31057 | Dundy, NE | `none` | `amb:standard-gas|united-light-power` | `none` | B |
| 31163 | Sherman, NE | `none` | `standard-gas` | `none` | B |
| 35061 | Valencia, NM | `none` | `federal-light` | `maybe:federal-light` | U |
| 38039 | Griggs, ND | `standard-gas` | `none` | `standard-gas` | P |
| 38061 | Mountrail, ND | `standard-gas` | `none` | `maybe:standard-gas` | U |
| 38063 | Nelson, ND | `standard-gas` | `none` | `maybe:standard-gas` | U |
| 41009 | Columbia, OR | `ebasco` | `standard-gas` | `ebasco` | P |
| 41047 | Marion, OR | `ebasco` | `standard-gas` | `ebasco` | P |
| 41051 | Multnomah, OR | `ebasco` | `standard-gas` | `ebasco` | P |
| 41053 | Polk, OR | `ebasco` | `standard-gas` | `ebasco` | P |
| 41057 | Tillamook, OR | `ebasco` | `standard-gas` | `ebasco` | P |
| 41063 | Wallowa, OR | `ebasco` | `none` | `ebasco` | P |
| 41067 | Washington, OR | `ebasco` | `standard-gas` | `ebasco` | P |
| 41071 | Yamhill, OR | `ebasco` | `standard-gas` | `ebasco` | P |
| 46011 | Brookings, SD | `national-electric` | `none` | `national-electric` | P |
| 46029 | Codington, SD | `national-electric` | `none` | `national-electric` | P |
| 46039 | Deuel, SD | `national-electric` | `none` | `national-electric` | P |
| 46051 | Grant, SD | `national-electric` | `none` | `national-electric` | P |
| 46089 | McPherson, SD | `national-electric` | `none` | `national-electric` | P |
| 46091 | Marshall, SD | `national-electric` | `none` | `national-electric` | P |
| 46109 | Roberts, SD | `national-electric` | `none` | `national-electric` | P |
| 49005 | Cache, UT | `ebasco` | `none` | `ebasco` | P |
| 49013 | Duchesne, UT | `none` | `ebasco` | `none` | B |
| 49015 | Emery, UT | `ebasco` | `none` | `ebasco` | P |
| 49035 | Salt Lake, UT | `ebasco` | `cities-service` | `ebasco` | P |
| 53037 | Kittitas, WA | `ebasco` | `stone-webster` | `ebasco` | P |
| 53063 | Spokane, WA | `ebasco` | `none` | `none` | B |
| 56041 | Uinta, WY | `ebasco` | `none` | `ebasco` | P |

### Systemic re-reads

- **Oregon:** the disputed western and eastern dark fields match the dense near-solid `ebasco` swatch, not the open-diamond `standard-gas` swatch. All eight scorer-visible Oregon conflicts were resolved from that repeated motif; isolated blind pattern upgrades elsewhere in Oregon were not accepted without the same visual support.
- **South Dakota:** the seven disputed northeastern counties sit in a coherent, repeated sparse-diagonal field matching `national-electric`. They were retained as exact even though the blind packet read them as blank. Counties at the overlap/boundary with the open-diamond field remain `amb:national-electric|standard-gas` or otherwise uncertain.

## Packet and audit summary

The frozen packet contains exactly 626 unique five-digit FIPS across AZ, CA, CO, ID, MT, NE, NV, NM, ND, OR, SD, UT, WA, and WY.

| Class | Counties |
|---|---:|
| Exact raw key | 262 |
| `none` | 244 |
| `unknown-served` | 75 |
| `maybe:` | 33 |
| `amb:` | 12 |
| **Total** | **626** |

The original thresholds were not changed: served status 0.98 and raw pattern 0.95. The comparator also reports how many counties it excludes because either packet carries uncertainty; those exclusions are kept visible rather than converted to agreement.

| Comparison | Served agreement | Raw agreement | Unscored uncertainty | Scored disagreements | Threshold result |
|---|---:|---:|---:|---:|---|
| Adjudicated vs primary | 0.988701 | 0.988571 | 276 | 4 | Pass both |
| Adjudicated vs blind | 0.964912 | 0.950100 | 123 | 27 | Served fail; raw pass |

The blind served-status miss is expected from the adjudicator's plate re-read of coherent fields that the blind packet called blank, especially Oregon, South Dakota, Utah, and Wyoming. It is recorded as a release warning, not hidden by relabeling those counties uncertain. The checkpoint can merge because every disagreement has an explicit plate-based resolution and residual uncertainty remains machine-readable; release should stay blocked until the full Map III packet and Map IV pass the repository release validator.
