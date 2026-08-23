# Map IV provisional georeference validation

Status: **rejected** by the subsequent frozen blind landmark audit. The eight
interstate controls measured 159.91 px RMS and a 289.94 px maximum. The fit
below is retained only to document the failed candidate and must not be used
for county masks.

## Independence test

The fit uses the same geographic Albers basis and polynomial machinery as Map III, but it has a new four-point Map IV affine seed and newly optimized Map IV coefficients. Map III's 20 pixel coefficients were not copied, rescaled, or transformed. Direct reuse is invalid because Map III is 5,111 × 3,789 pixels while Map IV is 5,521 × 3,784, and the page placement and fold warp differ.

## Optimizer convergence

| Stage | Radius | Retained samples | RMS px | P95 px | Max px |
|---|---:|---:|---:|---:|---:|
| Quadratic ICP | 60 | 8,223 | 29.77 | 48.83 | 70.40 |
| Quadratic ICP | 40 | 6,177 | 18.97 | 31.73 | 43.21 |
| Cubic ICP | 30 | 5,323 | 13.42 | 23.04 | 29.75 |
| Cubic ICP | 20 | 4,132 | 9.06 | 15.23 | 19.61 |
| Cubic ICP | 12 | 2,794 | 5.66 | 9.39 | 12.00 |
| Cubic ICP | 8 | 2,034 | 3.90 | 6.52 | 7.66 |
| Cubic ICP | 5 | 1,303 | 2.40 | 3.98 | 4.48 |

The sequence converges monotonically, and a full-raster red-line overlay visually tracks the national outline and the major state boundaries. This establishes that a separate Map IV fit is feasible. It does **not** establish withheld accuracy, because the final table measures residuals to the same outline-derived targets used for fitting.

## Interior checkpoint predictions

These coordinates are supplied so a blind validator can crop the native raster without seeing the fit overlay first. Geographic labels are approximate border-junction names; the pixels are model predictions, not manually corrected answers.

| Checkpoint | Approx. lon, lat | Predicted native pixel x, y | Intended audit |
|---|---|---|---|
| Washington–Oregon–Idaho vicinity | -117.05, 46.00 | 1375.7, 1190.4 | Northwest placement and diagonal state line |
| Idaho–Montana–Wyoming vicinity | -111.05, 44.50 | 1787.2, 1382.3 | Interior western junction |
| Four Corners | -109.045, 36.999 | 1888.8, 2104.6 | Straight-line western grid |
| Colorado–Kansas–Oklahoma vicinity | -102.041, 36.993 | 2455.4, 2114.4 | Central straight-line junction |
| Missouri–Arkansas–Oklahoma vicinity | -94.618, 36.50 | 3059.1, 2125.0 | Fold-adjacent central junction |
| Nebraska–Iowa–Missouri vicinity | -95.77, 40.59 | 2931.2, 1746.0 | Missouri River bend |
| Kentucky–Tennessee–Virginia vicinity | -83.675, 36.60 | 3938.0, 1985.5 | Eastern interior junction |
| Pennsylvania–Maryland–West Virginia vicinity | -80.52, 39.72 | 4112.6, 1648.0 | Dense eastern linework |

## Adversarial checks still required

1. Have a validator who did not see the overlay mark the eight junctions directly on native crops, then calculate Euclidean errors.
2. Add at least four county-level checkpoints, including one small eastern county and one county crossed by each major vertical fold.
3. Reject the fit if any unexplained landmark miss exceeds 8 px or if RMS exceeds 3 px after excluding genuinely ambiguous printed junctions.
4. Do not treat strong coastal alignment as evidence of interior alignment; the current ICP target is dominated by the national outline.
5. If a fold corridor fails, fit a controlled local correction or preserve a georeference-uncertain band rather than increasing the global polynomial order without restraint.

## Provisional conclusion

Map III's **method** can seed Map IV, but Map III's **coefficients** cannot. The independent Map IV fit is good enough to proceed to blind landmark testing and likely good enough to seed county crop generation after that test passes. It is not yet safe to emit county classifications into the canonical trace.
