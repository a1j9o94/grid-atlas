# Map IV georeferencing blind validation

## Verdict: REJECTED (FAIL)

The provisional Map IV transform fails both release criteria:

- Required withheld-landmark RMS: **<= 3 px**
- Measured RMS on the eight requested interstate junctions: **159.91 px**
- Required maximum: **no unexplained miss > 8 px**
- Measured maximum: **289.94 px** at WA-OR-ID

The failure is decisive. Even the four high-confidence interstate readings alone have RMS **187.84 px** and maximum **289.94 px**. The residuals are far larger than the 3-5 px uncertainty assigned to the state-line readings, so landmark ambiguity cannot explain the result.

## Blind protocol

I inspected only the native 5521 x 3784 raster and raw current state/county geometry while making readings. I wrote and froze `trace-work/map4-georef-blind-marks.json` before opening `trace-work/map4-georef-provisional.json`; I did not adjust any blind reading after seeing a fitted prediction. Predictions below use the provisional file's stated Albers projection, cubic design terms, and coefficient vector.

Errors are Euclidean native-pixel distances. `dx = observed x - predicted x` and likewise for `dy`.

## Requested interstate junctions

| Landmark | Blind observed (x, y) | Model predicted (x, y) | dx | dy | Error (px) | Reading confidence |
|---|---:|---:|---:|---:|---:|---|
| WA-OR-ID | (1260, 925) | (1376.46, 1190.52) | -116.46 | -265.52 | **289.94** | High |
| ID-MT-WY | (1671, 1190) | (1786.86, 1384.70) | -115.86 | -194.70 | **226.56** | Medium |
| Four Corners | (1719, 2044) | (1888.75, 2104.57) | -169.75 | -60.57 | **180.23** | High |
| CO-KS-OK | (2325, 2089) | (2455.39, 2113.71) | -130.39 | -24.71 | **132.71** | High |
| MO-AR-OK | (2978, 2145) | (3059.11, 2125.10) | -81.11 | 19.90 | **83.52** | High |
| NE-IA-MO | (2858, 1710) | (2931.58, 1746.41) | -73.58 | -36.41 | **82.10** | Medium |
| KY-TN-VA | (3959, 2049) | (3937.97, 1985.43) | 21.03 | 63.57 | **66.96** | Medium |
| PA-MD-WV | (4211, 1653) | (4192.05, 1630.46) | 18.95 | 22.54 | **29.45** | Medium |

Interstate-junction summary: **n = 8, RMS = 159.91 px, maximum = 289.94 px**.

All eight requested junctions miss by more than 8 px. Four of them were marked high confidence and have clear state-boundary topology; their misses range from 83.52 to 289.94 px. Those are unexplained misses under the release rule.

## County-level checkpoints

| Checkpoint | Special role | Blind observed (x, y) | Model predicted (x, y) | Error (px) | Confidence / ambiguity |
|---|---|---:|---:|---:|---|
| Crowley-El Paso-Lincoln-Pueblo, CO | Left/central fold-adjacent | (2193, 1919) | (2294.76, 1970.40) | **114.01** | Medium; fold illumination broadens the four-way corner |
| Bailey-Curry-Parmer, TX-NM | Left/central fold-adjacent | (2219, 2382) | (2371.03, 2371.76) | **152.38** | Low; faint county divider at heavy state line |
| Cannon-Coffee-Rutherford, TN | Right/central fold-adjacent | (3749, 2153) | (3751.51, 2107.00) | **46.07** | Low; continuous vertical hatch makes the junction genuinely ambiguous |
| Delaware-Montgomery-Philadelphia, PA | Small eastern county | (4544, 1574) | (4502.99, 1532.13) | **58.61** | Medium; dense symbols partly hide small Philadelphia tripoint |
| Adams-Carroll-York, PA-MD | Eastern county/state edge | (4408, 1646) | (4380.34, 1586.99) | **65.17** | Low; doubled state border weakens exact endpoint |

County-checkpoint summary: **n = 5, RMS = 95.94 px, maximum = 152.38 px**. County ambiguity is material for individual readings, especially Cannon-Coffee-Rutherford, but it does not rescue the fit: the independent interstate junctions already fail overwhelmingly.

## Residual pattern and interpretation

The residuals are spatially structured rather than random marking noise. Western landmarks are predicted progressively too far east and mostly too far south: WA-OR-ID has residual (-116, -266) px, Four Corners (-170, -61) px, and CO-KS-OK (-130, -25) px. Errors shrink toward the eastern seaboard but remain well above tolerance (29.45 px at PA-MD-WV). This pattern is consistent with a large interior warp/registration error in the provisional transform, not isolated ambiguous point selection.

The provisional file's reported 2.40 px retained-outline RMS is explicitly an in-sample ICP-target statistic. The withheld interior controls show that it is not an accuracy estimate for interstate or county geometry.

## Release recommendation

**REJECTED:** do not use this transform for canonical county masks or trace work. Refit with geographically distributed interior controls, especially western interstate junctions and both fold corridors, then repeat a frozen withheld-point test. A future candidate should satisfy both **RMS <= 3 px** and **no unexplained miss > 8 px** on independent interior landmarks.
