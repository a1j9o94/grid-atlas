# Can the labelled East teach a classifier to read the West? No.

Step zero of the finish plan, run 2026-08-19 before committing to nineteen states of
reading. It fails at its first check, which is the cheap one, and the failure is
specific rather than general.

## The check

Count exact-labelled examples per legend mark across the 1,860 counties already read
by hand. A supervised classifier can only learn a mark it has examples of, and every
labelled county is east of the remaining work.

## The result

24 legend marks. **17 have at least one exact example. Seven have none.**

    american-electric-power-corp    93 uncertain-only mentions
    stone-webster                   69 uncertain-only mentions
    tri-utilities                    7 uncertain-only mentions   south-west Wyoming
    central-public-service           0                           Portland, Oregon
    nevada-california                0                           Owens Valley, California
    pacific-gas-electric             0                           Sacramento Valley
    empire-power                     0                           never field-confirmed

Seven more are too thin to learn from: `central-states-electric` 1, `rockland` 2,
`utilities-power-light` 8, `american-commonwealths` 9, `cities-service` 13,
`united-light-power` 15, `new-england-power` 16.

## Why this is decisive rather than a tuning problem

Four of the marks with **zero** examples are western by their own legend fill sites:
Pacific Gas and Electric in the Sacramento Valley, Nevada-California in the Owens
Valley, Central Public Service at Portland, Tri-Utilities in south-west Wyoming.
Those four largely define California, Oregon, Nevada and Wyoming, which are four of
the nineteen states the classifier would exist to read.

A classifier trained on the East cannot emit a class it has never seen. It would
read California as whichever eastern mark looked nearest, confidently, and the
per-mark accuracy report would not catch it because the class has no held-out
examples to be wrong about either.

`american-electric-power-corp` and `stone-webster` have no exact examples for a
different and already-known reason: they are the pair that cannot be separated at 400
dpi, so every read of them is `amb:`. That is the trace working as designed.

## The irony worth recording

The marks with no training examples are the ones a human finds easiest. The blind
reader called Pacific Gas and Electric's dot-in-diamond "one of the two easiest things
on the plate". So the automated route fails hardest exactly where the manual route is
most comfortable, which is a good reason to stop looking for an automated shortcut
rather than to keep tuning one.

## Decision

Do not build the classifier. Per the plan's own gate, coverage is bad for
western-only marks, so the readers take the West.

Two things from this check are still worth having. The counts above tell a reader
which marks are rare, and a rare mark asserted often is a signal to re-read. And a
classifier restricted to the ten well-populated eastern marks would be a usable second
opinion on the already-traced 1,860 counties, which is more coverage than the
444-county stride sample gives. Neither is on the critical path.
