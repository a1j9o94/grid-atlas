# Map IV georeference refit report

## Verdict: FAILED — no releasable transform

The rejected cubic's 2.40 px number was an in-sample residual to its own
outline-derived ICP targets. It was not a georeference accuracy estimate. The
frozen audit exposed a spatially structured interior warp: 159.91 px RMS and
289.94 px maximum on eight interstate junctions.

I refitted a deliberately lower-order candidate using those eight junctions
plus eight additional geographically distributed native-raster readings. The
candidate is a global quadratic on the existing Albers coordinates. It avoids
the rejected cubic's exact interpolation and uses no outline self-targets.

The result still fails decisively. Its 16-control fit residual is
**15.95 px RMS** (max **48.64 px**), and its
separate 12-landmark holdout is **57.77 px RMS** with a
**98.66 px** maximum. The release gates are <=3 px RMS and no
unexplained miss >8 px.

## Frozen internal holdout

| Landmark | Observed native px | Candidate px | Error px |
|---|---:|---:|---:|
| CA-OR-NV | (969, 1321) | (920.7, 1313.4) | **48.9** |
| ID-NV-UT | (1387, 1430) | (1392.2, 1426.7) | **6.2** |
| WY-NE-SD | (2200, 1381) | (2204.4, 1426.5) | **45.7** |
| WY-CO-NE | (2179, 1649) | (2189.6, 1647.7) | **10.7** |
| KS-MO-OK | (2973, 2093) | (2993.5, 2095.3) | **20.7** |
| AL-GA-TN | (3795, 2254) | (3824.7, 2235.2) | **35.1** |
| NC-SC-GA | (4029, 2218) | (4048.0, 2199.5) | **26.6** |
| NY-MA-VT | (4480, 1259) | (4560.7, 1202.3) | **98.7** |
| VT-NH-MA | (4623, 1250) | (4617.8, 1185.6) | **64.6** |
| NE-KS-MO | (2944, 1778) | (2916.9, 1774.8) | **27.3** |
| GA-FL-AL | (3885, 2685) | (3960.6, 2629.5) | **93.7** |
| NM-TX-OK | (2324, 2090) | (2240.2, 2140.8) | **98.0** |

These twelve readings were not used in the fit. The misses are too large to be
explained by the several-pixel width of printed state strokes, even allowing
for conservative centerline-reading uncertainty.

## Diagnosis

The scan/map distortion cannot be represented safely by one global polynomial.
An affine fit to the original eight controls is about 16 px RMS in-sample. A
quadratic can reduce that small training set to about 1.1 px, but fails separate
county checkpoints at roughly 30 px RMS. A cubic exactly interpolates the eight
controls and then explodes to roughly 124 px RMS on the five county checkpoints.
That progression is direct evidence of overfit, not an argument for a higher
polynomial order.

The full-raster overlay uses red for the failed quadratic state mesh, cyan for
fit controls, yellow for holdout observations, and magenta residual vectors.

## Stop/go recommendation

**STOP for county-mask production.** Do not put either the rejected cubic or
this failed quadratic into canonical data. A credible next attempt needs a
locally constrained piecewise-affine scan warp fitted to a denser set of
interior controls, followed by a newly frozen independent audit. The present
holdout must not become tuning data for that attempt.
