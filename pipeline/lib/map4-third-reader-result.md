# A third reader read the 288 contested counties, and the doubt was not where the numbers put it

Read 2026-08-22 by Adrian, through the Hatch Bench page. Verdicts kept in
`map4-adjudications-reader.json`, merged into the trace by `29-ingest-adjudications.py`.

## The method

Every county where the primary trace and the independent blind read named different marks,
288 of them, presented one at a time with the county's own crop and its boundary drawn on
the illumination-normalised plate. The two candidate marks each carried a reference crop
from their own confirmed legend field site, so the choice was engraving against engraving.

**Neither candidate was labelled with its provenance and the sides were shuffled per
county.** A reader told which mark the machine picked anchors to it, and the independence
is then worth nothing. A third option offered all 24 legend marks by their engraving, so a
county where both existing reads were wrong could be recorded as such rather than rounded
to the nearer wrong answer.

All 288 were adjudicated. None were skipped and none recorded as unreadable.

## Result

| the reader sided with | counties | share |
|---|---|---|
| the primary trace | 180 | 62.5% |
| the independent blind read | 72 | 25.0% |
| a mark neither had chosen | 36 | 12.5% |

These are the hardest counties on the sheet by construction, so 62.5% is not the trace's
accuracy. It is how often the primary won where two readers had already failed to agree.

**The 12.5% is the finding no agreement measure could have produced.** Thirty-six counties
where both existing reads were wrong. Comparing two readers to each other can only ever
tell you they differ; it cannot tell you they are both wrong, and that is exactly the case
here on one county in eight.

## Per state, which is where it gets useful

| state | read | primary | blind | third mark |
|---|---|---|---|---|
| Iowa | 60 | **51** | 3 | 6 |
| Oklahoma | 44 | 17 | **22** | 5 |
| Texas | 43 | **38** | 4 | 1 |
| Kansas | 27 | 14 | 10 | 3 |
| Nebraska | 17 | 12 | 4 | 1 |
| South Dakota | 15 | 9 | 3 | 3 |
| Minnesota | 14 | 6 | 2 | **6** |
| Colorado | 13 | 10 | 1 | 2 |
| Montana | 10 | 7 | 3 | 0 |
| Oregon | 10 | 1 | **7** | 2 |
| New Mexico | 9 | 3 | **6** | 0 |

**Iowa is settled twice over.** Its 22.2% agreement looked like two noisy readers and
nearly triggered a re-read of all 99 counties. Measuring lattice orientation against both
candidates' field sites favoured the primary on 40 of 43 decidable counties and the blind
read on none. This reader favoured the primary on 51 of 60 and the blind read on 3. Two
independent methods, same answer: **re-reading Iowa would have made it worse.**

**Oklahoma went the other way, and the flag was right.** It shipped as the weakest state
because 58 of 77 counties disagreed and nothing could adjudicate them. The reader gave 22
of 44 to the blind read against 17 to the primary. So the primary was the wrong one there.
Naming it as weak rather than averaging it into a global figure is what made it the first
thing a reader was shown.

**Minnesota is the new worst, and nothing had flagged it.** Six of 14 contested counties
went to a third mark, the highest rate anywhere. Four of those are `standard-gas` where the
primary read `utilities-power-light` and the blind read `central-states-electric`: both
wrong, the same way, on four adjacent counties. Two more read blank. 64 of its 87 counties
still carry declared uncertainty. **This is where to send a reader next.**

**Texas holds at 38 of 43.** It was traced in a single pass by one reader in one session,
so 88% on its contested counties is better than it had any right to be.

## A mark became assertable

`stone-webster` had zero confirmed exact reads across all 3,108 counties, which is why
`26-normalise-unassertable.py` stripped it from 319 records as a candidate nobody had ever
resolved. This reader recorded it at Sierra County, California. It now carries one
confirmed read, and 22 of the 24 marks are confirmed rather than 21. Only
`american-electric-power-corp` and `empire-power` remain unattested anywhere on the plate.

## What this does and does not fix

It corrects 108 counties in the shipped trace. It does not replace the residual error
estimate in `map4-holdout-result.md`: that comes from a stratified random sample and this
is the contested subset, so the two measure different things and this one cannot be quoted
as an overall accuracy.

It does retire the estimate's stated limitation in part. That limitation was that one
person did both the trace and the check, so the estimate was biased optimistic by an
unmeasurable amount. There is now a genuinely independent reader in the record, and where
that reader disagreed with the machine, the machine has been changed rather than defended.
