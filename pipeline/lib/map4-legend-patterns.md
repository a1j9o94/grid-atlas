# Map IV (1932) legend patterns, described from looking at them

Written from 6x to 14x crops of the legend swatches on
`data-raw/ftc72a/map4-1932.png` (5521 x 3784, greyscale, FTC Utility
Corporations, Senate Document 92, Part 72-A, PDF page 90). This file is the
Map IV counterpart of `plate-patterns-map3.md` and serves the same purpose:
it is the classification key for tracing the plate by eye.

Orientation convention, unchanged from the Map III work:
"\" (backslash) runs upper-left to lower-right, "/" (slash) runs lower-left to
upper-right. Measured angle 0 = horizontal rules, 45 = backslash, 90 =
vertical rules, 135 = slash. Image y grows downward. `lib/plate_measure.py`
pins this with synthetic self tests on both of its measurement paths, the FFT
peak and the Radon projection. Run `python3 lib/plate_measure.py` to see them.

Period below is the perpendicular wavelength in native scan pixels, about
1 km/px. `w` is the mean ink run length across the profile, which is the
printed line weight. Ink is the mean ink share inside the swatch after the
paper-white correction in `plate_texture.ink_image`.

## The legend block

The legend sits in the lower left of the plate, roughly x 440 to 2260,
y 2320 to 3400 in native pixels, in three columns. The header reads "LEGEND".

The plate prints **24 top-level swatches and 23 numbered subsidiary entries**.
Both counts are confirmed by direct reading. The subsidiary entries are split
4 / 13 / 6 across three parent groups. Number 9 under Middle West is printed
with the note "(not shown on map)", so 22 numerals can actually appear in the
field.

Column one carries the four parent entries in the order Electric Bond &
Share, Middle West Utilities, Other Insull Companies, United Corporation, with
the numbered lists indented under the first, second and fourth. Columns two
and three carry the other twenty entries in alphabetical order, American
Commonwealths through North American Co. in column two, North American Lt. &
Pr. through Utilities Power & Light in column three. In every case the swatch
sits to the right of the label, not the left.

## What the numbers mean

This is the richest thing on the plate and Map III has no equivalent.

Small numbered circles, about 22 to 24 px in diameter, are overprinted on the
county fills. The numeral is **scoped to the hatch pattern it sits on**. It
indexes the numbered list printed under that pattern's parent in the legend.
The three lists overlap, so a numeral read without its host texture is
meaningless: a circled 2 means American Power & Light on solid black, Central
Illinois Public Service on the square grid, and Commonwealth & Southern on the
vertical rails.

Verified instances, each read at 8x with the host texture identified first:

| plate px | numeral | host texture | reading |
|---|---|---|---|
| 3400,1372 | 12 | square grid (p02) | North West Utilities Co., southern Wisconsin |
| 2856,1948 | 5 | square grid (p02) | Kansas Electric Power Co., eastern Kansas |
| 2140,2760 | 1 | square grid (p02) | Central & South West Utilities Co., west Texas |
| 3660,1498 | 8 | square grid (p02) | Michigan Gas & Electric Co., SW Michigan |
| 3620,1252 | 4 | square grid (p02) | Commonwealth Light & Power Co., north Michigan |
| 3727,1384 | 2 | vertical rails (p04) | Commonwealth & Southern, Michigan |
| 4232,2392 | 2 | vertical rails (p04) | Commonwealth & Southern, South Carolina |
| 4448,1116 | 4 | vertical rails (p04) | Niagara Hudson Power Corp., northern New York |
| 4246,2384 | 3 | solid black (p01) | National Power & Light Co., Carolina Piedmont |

Every one of these lands where the named company actually operated in 1932,
which is the strongest available check that the scoping rule is right.

Two consequences a tracer needs.

Numerals 7 through 13 can only be Middle West, because the other two lists
stop at 4 and 6. Numerals 5 and 6 are Middle West or United Corporation, never
Electric Bond & Share. That is a real disambiguation lever when the host
texture is unreadable but the numeral is not.

Numerals label a **region, not a county**. A single circled 12 covers a large
multi-county block of grid fill in Wisconsin, and neighbouring grid counties
carry no numeral of their own. Any trace must propagate a numeral across the
contiguous same-texture patch it sits in, and must record where propagation
was ambiguous. Treating an unnumbered county as parent-direct would be wrong.

## The 24 swatches

| cell | key | pattern in words | period@angle | w | ink |
|------|-----|------------------|--------------|---|-----|
| p01 | ebasco | solid black. Mottled at high zoom with pinhole white speckle from the lithograph, no engraved structure at all. | - | - | 0.98 |
| p02 | insull-middle-west | square grid like graph paper, thin black lines, clean white square cells, five cells across the swatch | 8.9 v + 9.4 h | 2.8 | 0.40 |
| p03 | insull-other | diagonal crosshatch, thin lines both slopes, open white diamond cells, no mark inside the cells | 9.7@/ + 9.2@\ | 2.5 | 0.43 |
| p04 | united-corporation | continuous vertical rules with a column of short vertical dashes centred in each gap. Rule to rule about 14, rule to dash column 7. | 7.1 v (14 rule-to-rule) | 2.0 | 0.24 |
| p05 | american-commonwealths | rows of short horizontal dashes on white, rows brick-offset, no continuous rules anywhere. Light. | 7.1 h dashes | 2.4 | 0.21 |
| p06 | american-electric-power-corp | thin backslash rules, widest spacing of the backslash family | 13.8@\ | 2.2 | 0.34 |
| p07 | american-water-works | continuous horizontal rules with a row of short horizontal dashes centred in each gap. The horizontal mirror of p04. | 6.1 h (10.3 rule-to-rule) | 1.6 | 0.29 |
| p08 | age | bold backslash rules, thick stroke, medium spacing | 11.2@\ | 3.0 | 0.40 |
| p09 | central-public-service | bold vertical rules, near 50 percent duty, black and white bars of similar width | 9.2 v | 4.2 | 0.50 |
| p10 | central-states-electric | dark diagonal mesh: crosshatch both slopes with a white pearl at each crossing and a white diamond in each cell. Reads dark. | 12.8@/ + 11.2@\ | 4.0 | 0.64 |
| p11 | cities-service | fine slash rules, closest spacing of the slash family | 7.0@/ | 2.5 | 0.39 |
| p12 | duke | grid of isolated black plus marks, four-armed crosses, on a square lattice. Not lines. | 9.4 v + 9.8 h lattice | 3.5 | 0.33 |
| p13 | empire-power | vertical rules, thinner than p09 and more widely spaced, white gaps clearly wider than the bars | 12.0 v | 4.2 | 0.40 |
| p14 | nevada-california | short slash dashes on white, fat and short, rows offset. Light. | 9.5@/ dashes | 2.3 | 0.24 |
| p15 | new-england-power | bold horizontal rules, thick stroke, wide spacing | 11.6 h | 6.0 | 0.39 |
| p16 | north-american | thin slash rules, widest spacing of the slash family. Mirror of p06. | 14.6@/ | 2.2 | 0.34 |
| p17 | north-american-light | bold slash rules, thick stroke, medium spacing. Mirror of p08. | 12.2@/ | 3.0 | 0.33 |
| p18 | pacific-gas-electric | diamond lattice of thin lines with a dark dot centred inside each white diamond cell. Unmistakable. | 14.4@/ + 12.4@\ | 2.4 | 0.36 |
| p19 | rockland | small square dots on an offset quincunx lattice, very light, the lightest mark on the plate | 7.9@/ + 7.4@\ lattice | 2.7 | 0.09 |
| p20 | standard-gas | short backslash dashes on white, thin and sparse, rows offset. Mirror of p14 and lighter. | 9.0@\ dashes | 3.0 | 0.09 |
| p21 | stone-webster | fine backslash rules, closest spacing of the backslash family. Mirror of p11. | 6.5@\ | 2.5 | 0.26 |
| p22 | tri-utilities | fine horizontal rules, closely spaced, about nine across the swatch | 5.3 h | 2.4 | 0.40 |
| p23 | united-light-power | short vertical dashes only, dense, columns brick-offset. No continuous rule anywhere. | 7.2 v cols, 11.5 dash rows | 2.0 | 0.32 |
| p24 | utilities-power-light | dark ground with large white rounded diamonds on a square lattice. Reads white on black. | 14.1 v + 15.4 h lattice | 7.0 | 0.66 |

The plate is built on a deliberate system, which is worth naming because it
makes the marks easier to hold in the head. Each diagonal slope carries four
marks: fine and close, bold and medium, thin and wide, and a dashed one. The
backslash set is p21, p08, p06, p20. The slash set is p11, p17, p16, p14. They
mirror each other exactly, pair by pair. The same idea runs through the axes:
p04 and p07 are the same rule-plus-dash construction, vertical and horizontal.

## Verified fill sites, with the period measured in the fill

Every mark below was found on the map and read at 8x before being measured.
Coordinates are native plate pixels. Twenty-two of the twenty-four are
confirmed. Only american-electric-power-corp and empire-power are not, and
both are named in the confusable section with the reason.

| key | where | plate px | measured in the fill |
|---|---|---|---|
| ebasco | Louisiana and Mississippi delta | 3270,2470 | solid, ink 0.84 |
| insull-middle-west | west Texas, numeral 1 | 2120,2770 | 7.4 v + 8.9 h grid |
| insull-other | north-east Illinois, ring around Chicago | 3400,1480 | crosshatch both slopes |
| united-corporation | northern New York, numeral 4 | 4440,1150 | 11.5 v rails plus dash columns |
| american-commonwealths | central Arizona | 1420,2130 | 8.3 h dashes, ink 0.14 |
| american-electric-power-corp | not confirmed | - | - |
| american-water-works | northern West Virginia | 4200,1660 | horizontal rules alternating with dash rows |
| age | north-east Pennsylvania | 4336,1276 | 11.9@\ w 4.4, ink 0.39 |
| central-public-service | Portland, Oregon | 830,880 | 10.6 v w 3.6, ink 0.39 |
| central-states-electric | eastern Iowa, Cedar Rapids and Dubuque | 3170,1508 | diagonal mesh, 17 to 21 |
| cities-service | Joplin, south-west Missouri, Empire District Electric | 3024,2108 | 8.2@/ ink 0.33 |
| duke | Carolina Piedmont | 4120,2090 | plus marks on a 16 to 19 lattice |
| empire-power | not confirmed | - | - |
| nevada-california | Owens Valley, eastern California | 1030,1960 | slash dashes, ink 0.16 |
| new-england-power | central Massachusetts | 4752,1180 | 14.0 h bold |
| north-american | Cleveland; Milwaukee | 4007,1492 | slash, thin |
| north-american-light | central Illinois, Decatur | 3421,1736 | 15.8@/ w 4.2, ink 0.36 |
| pacific-gas-electric | Sacramento Valley | 660,1590 | 15.7@/ + 14.9@\ dot-in-diamond |
| rockland | Orange and Rockland counties, lower Hudson | 4565,1362 | dot lattice about 10, offset rows |
| standard-gas | Minneapolis; Green Bay; Oklahoma City; San Diego | 3005,1168 | backslash dashes, ink 0.26 to 0.30 |
| stone-webster | Norfolk; Beaumont; Tacoma | 4531,1918 | 8.4 to 12.6@\ thin, ink 0.17 to 0.26 |
| tri-utilities | south-west Wyoming | 1690,1455 | 5.1 h fine, ink 0.30 |
| united-light-power | Fort Dodge, Iowa; also Davenport | 2995,1505 | 7.4 to 7.8 v dash columns, no rules |
| utilities-power-light | south-west Missouri | 3150,2035 | 20.9 lattice, white diamonds, ink 0.64 |

## The swatch to fill scale does not transfer

Map III records a single re-engraving factor of about 0.7 between swatch and
fill. **Map IV has no single factor, and assuming one will merge two marks.**
Measured ratios of fill period to swatch period:

- pacific-gas-electric 15.7 / 14.4 = 1.09
- age 11.9 / 11.2 = 1.06
- north-american-light 15.8 / 12.2 = 1.30
- new-england-power 14.0 / 11.6 = 1.21
- tri-utilities 5.1 / 5.3 = 0.96
- central-public-service 10.6 / 9.2 = 1.15
- utilities-power-light 20.9 / 15.3 = 1.37
- duke 17.5 / 9.6 = 1.82
- stone-webster 8.4 to 12.6 / 6.5 = 1.3 to 1.9

The engraver appears to have squeezed each mark into a fixed 40 px swatch box
rather than cutting a true sample of the map screen, so marks with a large
motif (duke's plus, utilities-power-light's diamonds, stone-webster's fine
rules) are compressed hardest. **Classify by structure, weight and relative
rank inside a family, never by absolute period against the legend.** Where an
absolute number is needed, use the fill column above, not the swatch column.

## Confusable sets and how to break them

These are honest limits at 400 dpi. A tracer who hits one of these should mark
the county ambiguous rather than pick.

- **p06 american-electric-power-corp vs p21 stone-webster in the field.** Both
  are thin backslash rules with wide white gaps. Their swatches differ by more
  than a factor of two (13.8 against 6.5), but stone-webster's fill runs 8.4 to
  12.6 depending on where you measure it, which overlaps where p06's fill
  should sit. **They cannot be separated by period alone.** Separate them by
  geography, or leave the pair ambiguous. This is the single worst pair on the
  plate and the reason american-electric-power-corp has no confirmed field
  site above.
- **p08 age vs p21 stone-webster.** Same slope, similar fill period. Break them
  on line weight: age prints a thick stroke, w 4.4 in the fill and ink 0.39 to
  0.45; stone-webster prints a thin stroke, w 3.0 and ink 0.17 to 0.26. This
  one is reliable when the window holds three or more lines.
- **p16 north-american vs p17 north-american-light.** The slash mirror of the
  pair above and the same rule applies: north-american is the thin wide one,
  north-american-light is the bold medium one. Weight, not spacing.
- **p04 united-corporation vs p23 united-light-power.** Both read as dense
  vertical stipple at a glance and both measure about 7.2 vertically. The
  discriminator is structural and it is decisive at 8x: p04 has continuous
  full-height vertical rules alternating with dash columns, p23 has no
  continuous rule at all. In a county too small to show a full rule they are
  not separable. Any p04 county carrying a numeral is settled by the numeral,
  since p23 has no numbered subsidiaries.
- **p09 central-public-service vs p13 empire-power.** Both are plain bold
  vertical rules and nothing else. They differ only in duty cycle: p09 is near
  50 percent black, ink 0.50; p13 has clearly wider white gaps, ink 0.40. On a
  faded or fold-shadowed part of the plate that difference will not survive.
  Confusable pair.
- **p15 new-england-power vs p22 tri-utilities.** The same mark at two scales,
  bold horizontal rules against fine horizontal rules, 11.6 against 5.3 in the
  swatch. The factor of two makes them separable in a clean fill, but a small
  county showing two rules will not carry the distinction. Geography is the
  tiebreak, since one is a New England company.
- **p02 insull-middle-west vs p12 duke.** Both are square lattices at about
  9.5 in the swatch. p02 is continuous grid lines, p12 is isolated plus marks
  with white between them. If the plus arms blur into their neighbours the two
  merge. p02's ink is 0.40 against p12's 0.33.
- **p03 insull-other vs p10 central-states-electric vs p18
  pacific-gas-electric.** All three are diagonal lattices. p03 is thin lines
  and open white cells, ink 0.43. p10 is dark, ink 0.64, with white pearls at
  the crossings. p18 has a dark dot centred inside each white cell and is the
  most distinctive of the three. Separable in a clean fill, and p03 against
  p10 is separable on ink alone.
- **p19 rockland vs p20 standard-gas.** Both print at ink 0.09, the two
  lightest marks on the plate. p19 is dots, p20 is short backslash dashes. In a
  small county with fold shading over it both can read as bare paper. Watch for
  false "unserved" counties in light-mark territory.
- **p14 nevada-california vs p20 standard-gas.** Mirrored dash marks, slash
  against backslash. Get the slope right and they separate; get it wrong and
  they are indistinguishable. Both are dashed, so slope is the whole test.

## Reading hazards on the plate

- Two vertical page folds cross the map, one near x 1290 and one near x 3550.
  Both wash ink out of a 60 to 150 px column and both add a low-frequency
  gradient that pulls autocorrelation-based period estimates toward spurious
  short lags. `plate_measure._acf_period` starts its search past the first
  autocorrelation zero crossing for exactly this reason.
- State borders and the map frame are drawn very thick and darken small border
  counties. State-name labels sit in white boxes inside the fill, which punches
  holes in the texture.
- Rivers, lakes, coastlines and swamp symbols are heavy black and inflate any
  county-interior ink statistic. The Mississippi, the Great Lakes shoreline and
  the Florida coast are the worst offenders.
- The numbered circles themselves are ink. A circle sitting in a light-mark
  county will lift its ink share by several points.
- The plate's own note reads "Separate cities and towns served not shown on
  map", so a blank county is not evidence that nobody served it.
- The near-solid black at Chicago and Gary carries no readable structure. The
  operators there were Insull companies, but the fill cannot be told from
  ebasco solid black by looking. Treat the Chicago-Gary black as unresolved
  rather than assigning it to ebasco on the strength of the legend.

## Empire keys, and how they relate to Map III

Keys reused from `plate_legend.py` where the same group prints on both plates:
`ebasco`, `age`, `north-american`, `north-american-light`, `cities-service`,
`standard-gas`, `stone-webster`, `american-water-works`, `united-light-power`.

New keys, introduced by Map IV:
`united-corporation`, `insull-middle-west`, `insull-other`,
`american-commonwealths`, `american-electric-power-corp`,
`central-public-service`, `central-states-electric`, `duke`, `empire-power`,
`nevada-california`, `new-england-power`, `pacific-gas-electric`, `rockland`,
`tri-utilities`, `utilities-power-light`.

Three traps, all live on this plate.

`north-american-light` (p17, Studebaker-McKinley's North American Light and
Power) is a different company from `north-american` (p16, The North American
Co.). They are adjacent in the legend, both slash, and mirror the same pair of
backslash marks. This is the easiest error to make on Map IV.

`united-corporation` (p04) is not Map III's `united-gas-electric`. The United
Corporation was formed in January 1929, so unlike on Map III it legitimately
appears here, as a top-level swatch with six numbered subsidiaries.
`united-gas-electric` has no Map IV cell at all.

`commonwealth-southern` does not print as its own cell on Map IV. It appears
only as United Corporation numeral 2, that is `m4:p04:n2`. Map III's separate
`southeastern` and `hodenpyl` cells are both gone, folded into that one
numeral. A Map III to Map IV comparison must union those two 1925 cells against
`m4:p04:n2`, not against any 1932 swatch.

Two more Map III keys survive only as numerals. `ugi` is United Corporation
numeral 6. `national-electric` is Middle West numeral 11. Map III's `fitkin`,
`general-gas-electric`, `federal-light`, `northeastern-super`, `tenney` and
`united-gas-electric` have no Map IV representation of any kind, which is
itself a finding about 1925 to 1932 consolidation.

Map III's single `insull` cell splits into two on Map IV, `insull-middle-west`
(p02) and `insull-other` (p03). Both carry `rollup_map3 = insull` in
`plate_legend_map4.py` so the two years can still be compared at group level.
