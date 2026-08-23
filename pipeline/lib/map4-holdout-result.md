# The residual error estimate, and what it says

Read 2026-08-19. This is the fourth release criterion in `map4-release-standard.md`.

## Method

155 counties, stratified across all 49 jurisdictions, frozen in
`map4-holdout-sample.json` with seed 19320101 before any adjudication ran. Read fresh
from the plate through `19-contact-sheet.py --blind`, which captions the FIPS and county
name and nothing else, so the shipped verdict is not on screen. Recorded to
`map4-holdout-fresh.json`, then scored by `22-holdout.py score`.

## Result

| measure | result |
|---|---|
| served status | 86/95 = **90.5%** |
| which system, exact match | 57/78 = 73.1% |
| which system, compatible | 71/78 = **91.0%** |
| which system, hard conflict | 7/78 = **9.0%** |
| declared uncertain in the shipped trace | 21/155 = 13.5% |

**Compatible against hard conflict is the distinction that matters.** A fresh read of
"either A or B" against a shipped "A" is a difference in confidence, not a disagreement
about who served the county. 14 of the 21 pattern mismatches are that. Counting them as
errors gives 73.1% and overstates the problem; the number to quote is the 9% where the
two reads name disjoint sets.

The seven hard conflicts are Greenwood and Neosho in Kansas, Pontotoc in Oklahoma,
Josephine in Oregon, Mifflin in Pennsylvania, Chittenden in Vermont and Marinette in
Wisconsin. Marinette is `north-american` against `north-american-light`, which the legend
records as separating on stroke weight alone.

## The systematic finding, which is worth more than the numbers

**All nine served-status mismatches run the same way: the fresh read says blank where the
shipped trace says filled.** Not one runs the other way.

That is the same error the blind reader makes, and it was measured earlier in this
release: across 119 directional disputes in the west, the counties where the primary says
served and the blind says none sit in the filled population by interior coverage. So the
error is not a property of one careless reader. **A single pass over a small crop
under-reads faint fill, and it does so whoever is reading.** The fresh reader here had
the boundary drawn and the illumination normalised, which are the two fixes already
applied, and still under-read.

## Who is right in those nine

Four were re-opened at high zoom rather than assumed:

- **Greene, Virginia** and **Shiawassee, Michigan**: the interior is white inside the
  drawn boundary with the fill outside it. The fresh read is right and the shipped trace
  attributed a neighbour's fill inward.
- **Sauk, Wisconsin**: grid covers the west and south of the interior. The shipped trace
  is right and the fresh `none` was too strong.
- **Bristol, Rhode Island**: too small to settle at this resolution. Inconclusive.

So the nine split roughly evenly rather than falling one way. **90.5% is a two-sided
estimate of the shipped trace's served-status accuracy, not a floor.** And the error
class the handoff originally described, a reader importing adjacent fill, is real after
all. It is just not the dominant one in the west, and it shows up in the east.

## The limitation, stated rather than buried

One person did both the trace and the fresh read. `--blind` hides the verdict but cannot
erase familiarity with the plate, and the Texas counties in the sample had been read days
earlier in this same session, which is why six of them match exactly. The estimate is
biased optimistic by an amount this method cannot measure. It is reported as an estimate
and labelled as one. A genuinely independent reader would sharpen it, and that is the
single highest-value thing a successor could add.
