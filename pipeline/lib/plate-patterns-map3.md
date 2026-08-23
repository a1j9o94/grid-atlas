# Map III (1925) legend patterns, described from looking at them

Written from 5x to 8x crops of the legend swatches on the normalized plate
(paper-white corrected). These descriptions are the classification key for
tracing the map by eye. Orientation convention used everywhere in this work:
"\" (backslash) means the line runs from upper-left to lower-right;
"/" (slash) runs from lower-left to upper-right. In FFT terms from
`scratchpad/measure.py` logic: reported angle 45 = backslash, 135 = slash
(image y grows downward; a synthetic test pinned this).

Period below is the perpendicular wavelength in native scan pixels (about
1 km/px). Map fills do NOT always reproduce the legend's engraving scale:
verified transfers are noted. Ink cov = mean ink share inside the swatch.

| cell | key | pattern in words | period@angle | ink |
|------|-----|------------------|--------------|-----|
| c1r1 | ebasco | solid black, no engraving at all | - | 0.95 |
| c1r2 | southeastern (Southeastern P&L; rolls up to commonwealth-southern) | heavy black ground with thin WHITE backslash lines. Reads as white-on-black. | 8.9@\ | 0.60 |
| c1r3 | northeastern-super | short FAT backslash dashes, sparse, offset rows, white ground | 11.4@\ | 0.35 |
| c1r4 | united-gas-electric | square grid like graph paper, black lines, white square cells | 13.5 h+v | 0.45 |
| c1r5 | insull | solid black ground with round WHITE polka dots | ~26 lattice | 0.85 |
| c2r1 | standard-gas (Byllesby) | black diamond net with round white pearls in the cells | 12.1 lattice | 0.55 |
| c2r2 | cities-service (Doherty) | BOLD black backslash stripes, wide white gaps | 12.2@\ | 0.44 |
| c2r3 | stone-webster | BOLD black slash stripes, mirror of cities-service | 12.2@/ | 0.44 |
| c2r4 | north-american | solid horizontal black rules | 13.5 h | 0.45 |
| c2r5 | fitkin | solid vertical black rules | 13.5 v | 0.45 |
| c3r1 | north-american-light (Studebaker-McKinley) | slash lines with a row of round dots between each pair | 12.2@/ +dots | 0.50 |
| c3r2 | american-water-works | grid of black plus marks (+) | 12.8 grid | 0.40 |
| c3r3 | hodenpyl (Hodenpyl-Hardy; rolls up to commonwealth-southern) | sparse round black polka dots on white | ~9 lattice | 0.20 |
| c3r4 | age (J.G. White) | fine slash lines, black on white | 9.0@/ | 0.40 |
| c3r5 | united-light-power (Hulswit) | horizontal black dashes, brick-offset rows | 14@h dashes | 0.30 |
| c4r1 | federal-light | vertical black dashes, offset rows | 13.5 v dashes | 0.30 |
| c4r2 | national-electric (Albert Emanuel) | thin slash DASHES in rows | 7.4@/ dashes | 0.34 |
| c4r3 | general-gas-electric (Barstow) | fine backslash lines, black on white | 8.2@\ | 0.45 |
| c4r4 | ugi | square grid of black rings (donuts) | 13.5 grid | 0.40 |
| c4r5 | tenney | short dashes alternating both slopes, basket-weave | 12.5 both | 0.36 |

## Confusable sets and how to break them

- ebasco vs insull: both near-black. Insull has round WHITE dots at 26 px
  spacing, visible at 4x zoom. Ebasco has none.
- southeastern (SE P&L) vs general-gas-electric: both fine backslash.
  SE is WHITE lines on a BLACK ground (heavy, ink 0.6); gge is black lines on
  white. Map fills confirm: Alabama Power / Atlanta blobs are white-on-black
  at 8.8 px; the Savannah-Broad river belt (NE GA, SC Piedmont, Augusta,
  central FL, and patches in NC) is black-on-white at 5.4-6.2 px.
- cities-service vs stone-webster: same boldness, mirrored slopes.
  CS = backslash, SW = slash. Puget Sound fill verified SW at 12.0@/ (1:1
  with legend).
- north-american (solid horiz) vs united-light-power (horiz dashes);
  fitkin (solid vert) vs federal-light (vert dashes): solid versus dashed.
- age (fine slash solid) vs national-electric (thin slash dashes) vs
  north-american-light (slash + dot rows): dashes and dot rows tell them apart.

## Verified fill-to-legend period transfers (map fills can be re-engraved finer)

- southeastern: fill 8.8@\ = legend 8.9. 1:1.
- stone-webster: Puget Sound fill 12.0@/ = legend 12.2. 1:1.
- north-american: Wisconsin fill 9.9 horizontal vs legend 13.5. 0.73x.
- general-gas-electric: fills run 5.4-6.2@\ vs legend 8.2. ~0.7x.
- fitkin: fills (Shenandoah and N Virginia band, west-central Florida block)
  are drawn as WIDE vertical-to-slightly-tilted rules at 12-24 px; the
  Virginia band tilts 10-20 deg toward slash. Identify by solid wide rules
  plus geography, not by exact period.

## Reading hazards on the plate

- Scan fold near x=3560 washes ink out of a 60-150 px column. Fulton GA sits
  in it. Use the raw scan with column-wise contrast enhancement there.
- Rivers, coastal marsh, sounds, lakes (Okeechobee) and swamp symbols
  (Okefenokee, Everglades) are drawn in heavy black and inflate any
  county-interior ink statistic. Never call a coastal county served from
  numbers alone.
- State borders are drawn very thick and darken small border counties.
- Big-city marker circles (GA, S.C., N.C., MD, VA labels; city discs like
  Washington DC and Charlottesville) are ink, not fill.
- The solid black in the central Appalachians (SW Virginia, southern West
  Virginia, Lynchburg) is the legend's Electric Bond and Share pattern, but
  the operating system there in 1925 was Appalachian Power (American Gas &
  Electric), which has NO legend entry of its own. Either the FTC swept it
  into the EBS group on this plate or the black overstates EBS. Recorded as
  ebasco because that is what the legend says black means; flagged in meta.
