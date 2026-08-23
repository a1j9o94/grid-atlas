# Iowa does not need re-reading, and the blind reader is the one that is wrong

Written 2026-08-19, during release prep.

## What the handoff said, and why

Round two of adjudication found agreement of 22.2% on 72 comparable Iowa counties and
27.9% on 61 in Oklahoma, and concluded: those are large samples with near-total
disagreement, so choosing between them county by county is arbitrating noise, and both
states should be re-read rather than adjudicated.

The reasoning is sound if near-total disagreement implies both reads are noisy. In Iowa
it does not. It is one good read and one bad one.

## The measurement that settles it

The Iowa clash is two marks: `central-states-electric` (p10) against
`utilities-power-light` (p24). Both are dark grounds carrying white diamonds, which is
why a reader confuses them. Their legend field sites are not confusable at all:

| mark | field site measured | lattice |
|---|---|---|
| p10 `central-states-electric` | 17@46 + 14@138, stroke 5.0, ink 0.57 | diagonal |
| p24 `utilities-power-light` | 22@88 + 20@3, stroke 8.8, ink 0.71 | orthogonal |

Forty five degrees of lattice orientation, plus a factor of nearly two in stroke. That is
a two-way call a measurement can make, and it is not the 24-way classification this
pipeline already ruled out four times. The four failed attempts died because every
cluster-to-legend distance exceeded the legend-to-legend nearest-neighbour distance
across all 24 marks. Two marks 45 degrees apart in lattice orientation are not that
problem, and the call is validated against both field sites before being used.

Of the 60 Iowa disagreements, the measurement calls 43 decisively and declines on 17.

**Primary matches the measurement on 40 of 43. The blind reader matches on 0 of 43.**

The blind reader has the two marks swapped, and where it does not it reaches for a third:
`insull-other` and `north-american-light` on counties measuring cleanly as p10.

## So Iowa is not re-read

Re-reading Iowa on the handoff's advice would have spent 99 counties of effort and
replaced a read that is right about 93% of the time on the contested counties. The three
counties where the primary and the measurement disagree are left alone rather than
overwritten: the discriminator is a two-way call between p10 and p24, so a county the
primary read as some third mark can fall inside the p10 envelope without that being
evidence against the primary.

## Oklahoma is genuinely unresolved

The same treatment does not clear Oklahoma. Its clash is `insull-middle-west` against
`standard-gas`, and a sample of five measures 15@178, 12@0, 28@0, 8@90 and no periodicity
at all. Only Beckham, at 8@90 and 7@2, matches a field site cleanly, and it matches p02
where the primary already reads `insull-middle-west#1`. The rest match neither mark, so
the disagreement there is real and this does not settle it. Oklahoma remains the
outstanding quality item, and the primary already carries `unknown-served` on part of it.

## The pattern worth carrying forward

This is the second time the blind reader has been found to confuse a pair of marks
systematically rather than at random. In the Texas South Plains it swapped p05
`american-commonwealths` for p23 `united-light-power`, which are horizontal and vertical
dashes, mirror images. Here it swapped p10 and p24.

**Low agreement between two readers does not mean both are noisy, and the fix is to
measure something that separates the two candidate marks rather than to re-read.** A
re-read on the assumption of symmetric noise would have moved the good read toward the
bad one, and nothing in the agreement number would have shown it.

## Oklahoma ships as read, with the doubt stated

Decided 2026-08-19 by Adrian: go with what we have on Oklahoma and note the uncertainty.

That is the right call under the release standard, which asks for declared uncertainty
rather than a guess and does not ask for agreement. Re-reading 77 counties to chase a
disagreement that neither measurement nor a second reader can adjudicate would have been
the Iowa mistake in a state where the primary has not been vindicated: effort spent with
no way to tell whether the result got better.

What ships, recorded in the artifact's `meta.trace_known_weaknesses` so it travels with
the data rather than living only here:

- 77 counties, 58 disagreeing with the independent read, 15 carrying declared uncertainty.
- The dominant clash is `insull-middle-west` against `standard-gas`, 42 counties.
- **14 of the 58 are numeral-only**: both readers name the same mark and differ about
  which subsidiary numeral rides on it. Those are not disputes about who served the
  county, and lumping them in overstates the problem by a quarter.

So the honest statement is that Oklahoma's pattern keys are the weakest on the sheet, the
served-or-blank reading there is not in question, and a reader who wants to improve it
should start by measuring something that separates p02's grid from p20's backslash dashes
rather than by re-reading.
