# Map IV adjudication, round one

Overlap between the primary trace and the frozen blind sample, measured 2026-08-19,
while the primary trace stood at 194 counties (Illinois and Indiana) and the blind
sample at 444.

## The numbers

| measure | result | carried-over gate |
|---|---|---|
| overlap | 27 counties | |
| served-status agreement | 27/27, 100% | 98% |
| exact-pattern agreement, declared uncertainty excluded, rollup applied | 19/24, 79.2% | 95% |
| clashes where the blind read was firm | 0 of 5 | |

Raw agreement before excluding declared uncertainty and before the rollup is 18/27,
66.7%. The rollup recovers one county where the two readers said `insull-middle-west`
and `insull-other`, which are the same system at the level the two sheets can be
compared on.

## What the split means

The two readers agree completely on **whether** a county was served and disagree on
**which system** served it. That is a specific and useful failure, not a general one.
The served layer is solid; the attribution is where the uncertainty lives.

Every one of the five clashes sits on a blind read the blind reader itself marked
`leaning` rather than `firm`. It marked only 32 of 444 counties firm, reserving that
for a numeral read inside the county itself or a mark that cannot be anything else.
So these disagreements do not establish that the primary read is wrong. They
establish that neither reader is confident, which is a different finding.

## The clashes

    17097  blind north-american-light (leaning)   trace insull-other
    17111  blind north-american-light (leaning)   trace insull-other
    17153  blind insull-middle-west   (leaning)   trace american-commonwealths
    17167  blind insull-middle-west   (leaning)   trace north-american-light
    18173  blind insull-other         (leaning)   trace united-corporation#2

Four of the five are Insull-family marks against `north-american-light`. That is the
mirror-pair structure the legend describes: each diagonal slope carries four marks
separated by stroke weight rather than spacing, so a slash mark and an Insull mark
are separated by weight, and weight is what degrades first in a small county window.

## Two cautions on reading this

The overlap is 27 counties in two states, traced before the blind reader's four
legend corrections were relayed. It is an early signal and not a basis for a release
decision. The `ebasco` p01 ink-range correction in particular postdates this trace.

Map III is not a clean precedent to measure against. Its own second blind packet
missed the served-status threshold at 96.49% against a 98% gate, and that dissent is
preserved in `pipeline/lib/audits/` rather than resolved.

## The proposed resolution

Where two independent readers disagree on which system and neither is firm, the
county **is** ambiguous, and `amb:a|b` is the correct reading rather than a
compromise. Adjudicating clashes that way is not lowering the bar; it is applying the
vocabulary the release grammar already has for exactly this case.

That turns an attribution-accuracy question into a disclosure question: not "is the
map right" but "how much of the map declares itself uncertain, and does enough remain
to be worth drawing". The second question is answerable from the finished trace and
is the one worth putting to a human.
