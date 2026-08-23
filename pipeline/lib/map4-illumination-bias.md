# The adjudication tool cropped the raw scan, and that reversed a finding

Written 2026-08-19, during release prep.

## What happened

Round two of adjudication recorded two worked examples. Arthur County, Nebraska read
blank. Adams County, Colorado read "plainly hatched", then the contact-sheet tool was
built, the boundary was drawn, and Adams was recorded as blank inside its own outline
with the hatch outside it. That reversal became the handoff's headline lesson: a
bounding-box crop of a thin county is not evidence about that county, the primary reader
attributes adjacent hatch inward, and every adjudication done without the boundary has
to be redone.

The boundary half of that lesson is right and it stands. The Adams conclusion is wrong.

## Why it was wrong

`19-contact-sheet.py` opened `map4-1932.png`, the raw scan. Every measurement path in
this pipeline normalises first, because `plate_texture.ink_image` exists precisely to
remove what its own docstring calls a heavy fold shadow down the middle and a darkening
toward the right edge. The adjudication path skipped it.

The scan's plate-wide column mean sits near 160 across the western states and rises to
187 at x 2100. Adams County spans x 2081 to 2194. It sits on the bright ridge.

On the raw crop the hatch fades out through the middle of the county and Adams reads
blank. On the normalised plate the bold backslash hatch runs unbroken across its whole
interior, and the southern edge of the patch lands exactly on the printed Adams and
Arapahoe county line, with Arapahoe and Denver bare below it. Adams is served. The
primary reader was right about it and the correction was the error.

Arthur County, Nebraska is unchanged. Its interior is clean paper on the normalised
plate too, with the hatch confined to the strip west of the printed line. The blind
reader was right about that one.

## What this changes

The two readers are still each wrong in different places, which is what round two
concluded. What does not survive is the direction: there is no general finding that the
primary over-reads adjacent hatch. Measured on the normalised plate, across the 119
directional served-status disputes, the group where the primary says served and the
blind says none has median interior ink coverage 0.256. Counties both readers call
filled sit at 0.387 and counties both call blank sit at 0.085. That group belongs with
the filled population. The dominant error in the western trace is the blind reader
under-reading faint hatch, not the primary over-reading adjacent hatch.

The reason is the same in both directions. A reader shown the scan's lighting on top of
the engraving will call washed-out hatch blank, and the wash is worst exactly where the
fold is.

## What was changed in the tree

- `21-ink-plate.py` builds and caches `data-raw/ftc72a/map4-1932-ink.png`.
- `19-contact-sheet.py` crops the normalised plate by default and prints which plate it
  used. `--raw` still crops the scan, for comparing the two.
- The caption now carries the whole verdict including the numeral. It used to truncate
  at 22 characters, which cut every `amb:` pair down to its first candidate and hid the
  one thing an adjudicator has to see.

## The rule

Adjudicate on the normalised plate with the county boundary drawn. Neither half is
optional. The boundary stops a reader importing a neighbour's ink. The normalisation
stops the scan's lighting reading as absence of ink. Round two had the first and not the
second, and got a clean-looking answer that was wrong.
