# Map IV adjudication, round two: the western overlap

Primary reader at 2,854 of 3,108 counties, 18 western states done and Texas deliberately
left. Blind reader at all 1,248 counties of 19 western states. Overlap 994 counties.

## Both gates fail

| measure | result | gate |
|---|---|---|
| served-status agreement | 866/994, 87.1% | 98% |
| exact-pattern agreement, uncertainty excluded, rollup applied | 326/506, 64.4% | 95% |
| clashes | 180, of which 5 firm on the blind side | |

Round one, on the eastern overlap of 27 counties, had served status at 100% and pattern at
79.2%. So the West is worse on both, and served status failing is new. Served versus blank
is the easy question, and 128 counties where one reader sees ink and the other sees paper
is a different class of problem from two readers disagreeing about which hatch.

## Where it fails

Served status collapses in Colorado at 57.8%, Washington 69.2%, South Dakota 74.2%,
New Mexico 75.8%, Nebraska 77.4%, Montana 78.6%.

Exact-pattern agreement is bimodal rather than uniformly poor. Idaho, Montana, Nevada,
Utah and Wyoming come in at 100%, California 94.3%, South Dakota 89.7%, Washington 90%.
Iowa is 22.2% on 72 comparable counties and Oklahoma 27.9% on 61. Those two are large
samples with near-total disagreement, which is systematic rather than noisy.

The clash pairs say why: 43 `central-states-electric` against `utilities-power-light`, 42
`insull-middle-west` against `standard-gas`, 29 `central-states-electric` against
`insull-other`. `central-states-electric` had exactly **one** confirmed example in the
whole eastern trace and `utilities-power-light` had eight. The readers diverge hardest on
the marks that were never properly established.

## The largest single component, and why it cannot be resolved by rule

**55 of the 128 served-status disagreements are one pattern**: the primary records
`amb:american-electric-power-corp|stone-webster` where the blind reader records `none`.
That is the pair with no confirmed example anywhere in 3,108 counties, so the primary was
asserting a mark it had never seen calibrated, concentrated in the emptiest country on the
map.

I looked at two of them at native resolution.

**Arthur County, Nebraska, 31005: bare paper.** Thin backslash hatch runs immediately west
of the county line and more of it to the south, but the interior is empty. The primary read
an adjacent patch and attributed it inward. That is exactly the crop-bounding hazard the
primary itself flagged, where a mis-bounded box pulls in neighbouring territory and looks
like plate content.

**Adams County, Colorado, 08001: plainly hatched.** Regular thin diagonals cover the county
interior. The primary is right and the blind reader is wrong.

So the two readers are each wrong in different places. There is no side to pick, and
adjudicating the whole class to `amb:` would be wrong too, because Adams County is
unambiguous once looked at. Marking it uncertain would throw away a clean read to buy a
rule.

## What follows

The disputes have to be looked at rather than resolved by rule: 128 served-status
disagreements plus 180 pattern clashes, roughly 300 counties. Contact sheets of labelled
county crops make that tractable at about 16 counties per sheet, which is 20 sheets rather
than 300 round trips.

Two findings to carry forward regardless of how adjudication lands.

**A mark with no confirmed example should not be assertable.** The `amb:` form was meant
for a county whose pattern is genuinely between two candidates. It was used here as a
default for faint ink, 55 times, for a pair neither reader had ever confirmed. A reader
should record `unknown-served` in that situation, which claims less.

**Iowa and Oklahoma need re-reading, not adjudicating.** At 22% and 28% agreement on large
samples the two reads are not variations on one answer, and picking between them county by
county would be arbitrating noise.
