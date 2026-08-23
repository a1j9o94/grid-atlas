# What certifies the 1932 layer, and why it is not reader agreement

Decided 2026-08-19 by Adrian, during release prep.

## The gate that was there

Four numbers were meant to hold both plates to one standard: exactly 3,108 unique FIPS
with no partial state, served-status agreement at or above 98%, exact-pattern agreement
at or above 95% after declared uncertainty and rollup, and every date-applicable anchor
passing.

Two of those four cannot be honestly satisfied on this plate, and the reason is the
instrument rather than the state of the work.

## Why agreement cannot certify this

Agreement between two independent readers means something only while the two reads stay
independent. Adjudication ends that. There are two ways to run it and both break the
number.

Correct both traces to the adjudicated verdict and agreement rises toward 100% by
construction. What it then measures is one adjudicator's self-consistency. That is the
same error as an ICP reporting its own residual, which this pipeline already caught and
wrote down: at radius 5 it matches only points already within five pixels, so it scores
the agreement of points that already agreed.

Correct only the primary and agreement rises only where the blind reader was right. The
blind reader recorded 53 `firm` verdicts out of 1,248, so 4% of its own read is
defended. It also under-reads faint hatch systematically, which is now measured. Holding
release to that read passing 98% is holding it to the weaker instrument.

There is a third reason, independent of adjudication. Two careful readers will not agree
95% of the time about which of 24 near-identical hatch marks fills a county at 400 dpi,
because the engraving does not carry that much information. One pair,
`american-electric-power-corp` against `stone-webster`, is already recorded as
unresolvable at this resolution. A gate that cannot be passed by a correct process is
measuring the wrong thing.

## What certifies it instead

1. **Completeness.** Exactly 3,108 unique FIPS, no partial state. Unchanged, and it is
   the criterion Adrian actually cares about. A map with the western third silently
   blank is what `holdingsYears()` was written to prevent, and that is still prevented.

2. **Declared uncertainty rather than guesses.** A county the plate cannot settle reads
   `amb:a|b`, `maybe:k` or `unknown-served`. This is not a concession. `lib/data.ts`
   already parses all five forms and its own comment says the release grammar preserves
   uncertainty instead of turning a hard-to-read hatch into a confident owner. The
   client was built for this. A complete map that admits what it cannot see is the whole
   map; it is a guess dressed as a reading that is not educational.

3. **An anchor set that passes.** Anchors are the only instrument here that tests against
   the world rather than against another reader, and there are four. That is thin for
   3,108 counties and the set needs expanding from documentary sources. An anchor must
   still be a claim the source can express, which is what retracted Los Angeles and
   Jefferson County.

4. **A residual error estimate from a held-out sample.** 155 counties, stratified across
   all 49 jurisdictions, frozen in `lib/map4-holdout-sample.json` with seed 19320101
   before any adjudication ran. At the end they are read fresh from the plate with the
   shipped verdict hidden, via `19-contact-sheet.py --blind`, and scored by
   `22-holdout.py score`. The sample is deliberately not exempt from adjudication: the
   number wanted is the error left in what ships.

The honest limitation, stated rather than buried: one person doing both the trace and the
fresh read is not two independent readers, and `--blind` hides the verdict but cannot
erase familiarity with the plate. The holdout estimates error; it does not eliminate the
correlation between the two reads. It is reported as an estimate and labelled as one.

## What this does not license

Declared uncertainty is for a county the plate cannot settle. It is not a place to put
counties nobody looked at. Every one of the 3,108 gets read. `unknown-served` after
looking is a finding; `unknown-served` instead of looking is the partial map with extra
steps, and the difference does not show up in any of the four criteria above. It shows up
in the tracing log, which is why the log is part of the release rather than a byproduct.
