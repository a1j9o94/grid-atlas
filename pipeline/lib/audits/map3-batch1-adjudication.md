# Map III batch 1 — conservative adjudication

## Result

- 575 unique county FIPS: AR 75, LA 64, KS 105, OK 77, TX 254.
- Machine grammar passes: exact raw keys, `none`, `maybe:key`, sorted `amb:key|key`, or `unknown-served` only.
- Final mix: 117 exact, 150 none, 13 maybe, 72 ambiguous, and 223 unknown-served.
- The canonical trace and GitHub branch were not modified.

## Decision rules

1. Exact agreement was preserved without alteration (61 counties); shared `none` (131) and shared `unknown-served` (193) were also preserved.
2. Exact-versus-ambiguous and unknown-versus-ambiguous cases retain the auditor's sorted `amb:` value. A single-county crop cannot safely collapse those A/D texture ties.
3. Exact-versus-unknown is exact only where an independent crop read showed a coherent repeat of the claimed texture. This retained 49 exact calls. The other 24 remain `unknown-served`.
4. None-versus-unknown was re-inspected. Nineteen counties with a clean usable interior remain `none`; six boundary-sensitive counties remain `unknown-served`.
5. `maybe:` survives when the disputed county visibly lies on a field edge and the adjacent repeated texture supplies a plausible key. It is not promoted to exact.
6. No corporate footprint, neighboring-company geography, or outside historical ownership evidence was used.

## Ten direct exact conflicts

| FIPS | Primary | Blind | Adjudicated | Plate rationale |
|---|---|---|---|---|
| 05063 | fitkin | ebasco | `amb:ebasco|fitkin` | Dense, incomplete texture; vertical-rule identity is not independently separable at the modern county inset. |
| 05093 | fitkin | ebasco | `amb:ebasco|fitkin` | Heavy edge fill and river-boundary mismatch prevent a safe two-way choice. |
| 05131 | ebasco | standard-gas | `standard-gas` | A complete open-diamond lattice repeats through the usable interior. |
| 40005 | standard-gas | ebasco | `insull` | Complete large white lozenges on a dark ground match the independently readable Insull motif; neither submitted exact key fits the crop. |
| 40029 | standard-gas | ebasco | `amb:ebasco|standard-gas` | The small inset is heavily inked but does not preserve a full diagnostic repeat. |
| 40039 | standard-gas | insull | `insull` | Multiple complete white lozenges are visible in the county interior. |
| 40075 | standard-gas | insull | `insull` | The white-lozenge-on-dark motif is complete and repeated. |
| 40099 | standard-gas | insull | `insull` | The small irregular inset retains a recognizable white-lozenge repeat. |
| 40131 | standard-gas | ebasco | `ebasco` | Interior is dense and near-solid without the open-diamond repeat. |
| 40149 | standard-gas | insull | `insull` | Complete white lozenges repeat across the interior. |

## Independent exact-versus-unknown review

Exact calls were retained only where the crop independently showed the claimed repeated motif:

- AR: 05033, 05047.
- LA: 22019, 22077.
- KS: 20005, 20009, 20015, 20017, 20019, 20035, 20049, 20067, 20077, 20081, 20085, 20095, 20119, 20131, 20155, 20159, 20173, 20175, 20189, 20191.
- OK: 40035, 40097.
- TX: 48009, 48015, 48023, 48035, 48053, 48089, 48097, 48121, 48147, 48161, 48217, 48237, 48239, 48251, 48259, 48275, 48285, 48289, 48349, 48425, 48439, 48447, 48473. These are high-coverage near-solid interiors; lower-coverage Texas fields remain unresolved.

## Blank-boundary limitation

The nineteen re-inspected none-versus-unknown counties with clean blank interiors are 05065, 05081, 05113, 22013, 22035, 22047, 20007, 20093, 40007, 40025, 40053, 40139, 48033, 48073, 48141, 48195, 48329, 48421, and 48505.

The six disputed counties left `unknown-served` are 05023, 48031, 48095, 48171, 48343, and 48457. Each contains visible ink that could be a clipped field rather than only adjacent boundary or label ink. The 1925/2020 boundary mismatch is the limiting factor, especially on river and coastal edges; `unknown-served` preserves that evidence without manufacturing a blank.
