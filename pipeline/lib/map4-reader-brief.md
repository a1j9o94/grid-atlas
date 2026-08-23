# Map IV reader brief

Everything a reader needs to trace FTC Map IV (1932) at county level. Self-contained on
purpose: readers get interrupted and replaced, and a fresh one should need this file and
the trace log and nothing else.

Paths are relative to `writing/energy-market-series/interactives/market-map/pipeline/`
in the `light-workspace` repo. Branch is `claude/timeline-exploration-layers-r4untr`.

## The job

Decide, for each county, which of 24 printed hatch patterns fills it on Map IV, or that
none does, or that it cannot be read. Record what the plate shows. Do not substitute
outside knowledge of who operated where; the sourced state claims are a later check on
the reading, not a replacement for it.

**A read that admits what it cannot see is usable. A read that guesses is not, and it
will fail adjudication anyway**, because a second reader is working the same state
independently.

## Inputs

- Plate: `data-raw/ftc72a/map4-1932.png`, 5521 by 3784. If missing, `15-build-holdings-1930.py`
  has `fetch_pdf`, `find_plates` and `extract_plate` to rebuild it.
- Georeference: `lib/ftc-map4-georef.json`, order-3 polynomial on Albers, lon/lat to plate
  pixels. Apply with `lib/plate_geo.py`.
- Legend: `lib/map4-legend-patterns.md` in prose, `lib/plate_legend_map4.py` as data. 24
  swatches, 23 numbered subsidiary entries, plus `CONFUSABLE`, `TRAPS` and `HAZARDS`.
- Measuring: `lib/plate_measure.py`, whose Radon path beats its FFT path on small samples;
  `lib/plate_orient.py` for `profile`, `period_along` and `duty`; `lib/plate_texture.py`
  for ink normalisation, which kills the fold shadow; `lib/map4_raster.py`.
- County base: `data-raw/counties-conus.json`, and the canonical FIPS list in
  `lib/counties-conus-fips.json`.

## Method that works, and the one that does not

Crop and magnify, and read regions before counties. A 500 pixel crop shows 20 to 60
pattern periods; a 40 pixel county window shows two to five. Four automated attempts
failed on this plate for exactly that reason, documented in `15-build-holdings-1930.py`.
Identify a contiguous patch by its texture, then assign the counties inside it.

**Do not trust absolute pattern period.** Map III had a roughly constant 0.7 factor
between legend swatch and map fill. Map IV has none: measured ratios run 0.96 to 1.82,
because the engraver squeezed each motif into a fixed 40 pixel legend box rather than
sampling the map screen. Classify on structure, stroke weight, and rank within a family.

## Four corrections to the legend, all found after part of the trace was done

1. **`ebasco` p01's ink range is badly understated, and this is the biggest available
   error.** The legend says fill 0.84. Real fills run 0.30 to 0.37 in Montana and 0.35 to
   0.51 in Arkansas. Any threshold near 0.84 deletes the northern Rockies. Identify p01 by
   structureless mottle with white pinhole speckle, not by darkness.
2. **The legend's `fill_site` place names are wrong in five cases**, so never sanity-check
   a mark by geography. Use the coordinates. Known bad: `age` says north-east Pennsylvania
   and lands in Yates NY; `new-england-power` says central Massachusetts and lands in
   Hillsborough NH; `ebasco` says the Louisiana delta and lands in Desha AR;
   `nevada-california` says Owens Valley and lands in Nye NV; and `central-public-service`
   says Portland, Oregon and lands just north of the Columbia in Washington.
3. **`empire-power` p13's prose contradicts its own table.** It calls the mark thinner than
   p09 while both measure stroke 4.2. They differ in period and duty cycle, not weight.
4. **Ambiguity comes from patch-boundary straddle, not legend confusion.** Only 12 of a
   blind reader's 57 ambiguities were legend-named pairs. When a small county straddles two
   patches, name both rather than taking the larger share.

## The mesh is offset, and by how much

The georeference is good enough to navigate and crop, not good enough to sample blind.
A 3 px standard was tried and discarded because Map III's own shipped fit, whose anchors
pass, misses Four Corners by about 60 px. **When the county mesh disagrees with the
printed county lines in your crop, follow the printed lines.**

Recorded offsets: about 10 px in Illinois, Indiana and Michigan; 15 to 25 px in Ohio,
Virginia and the Carolinas; 30 px north-west at Cleveland; 20 to 40 px seaward on the
Maryland Eastern Shore, the New Jersey coast and both Florida coasts. **Error grows
westward, so expect more than this in the remaining states.** Log any region where the
offset is bad enough to make a county's identity unclear.

## Numerals

Map IV overprints circled numerals naming the subsidiary inside a group. Map III has
none, so this is the richer half of the plate and worth capturing.

- **A numeral is scoped to the hatch beneath it** and indexes the list under that hatch's
  parent. The three lists overlap: a circled 2 is American Power and Light on black,
  Central Illinois Public Service on the grid, Commonwealth and Southern on vertical rails.
  Identify the texture first, always.
- Numerals 7 to 13 can only be Middle West, which is a lever when the texture is unreadable.
- **A numeral labels a region, not a county.** One circle covers a contiguous same-texture
  block, so propagate it across that block.
- **Record the numeral you actually see even when it decodes implausibly**, and note the
  conflict in the log. Five such cases now exist: a circled 6 on rails in eastern Colorado
  and central Arizona, a circled 4 on the grid in Osborne and Ford, Kansas, and disjoint
  circled 12s on the grid at Greenbrier WV, in Nebraska and in South Dakota. The
  transcription has been re-verified as correct twice, so this is a real finding about the
  plate and most likely the FTC reusing numerals across disjoint regions of one parent.
  Quietly fixing one hides it.

## Vocabulary

Per county, exactly one of:

- `none` — no fill
- an exact legend key
- `amb:key1|key2` — genuinely ambiguous, candidates sorted alphabetically, both named
- `maybe:key` — a read you lean toward but would not defend
- `unknown-served` — visibly filled, pattern unreadable

Any of these may carry a numeral as a suffix: `insull-middle-west#2`, `ebasco#3`.

One pair is **unresolvable at 400 dpi**: `american-electric-power-corp` and
`stone-webster`, both thin backslash with overlapping measured fills. Record
`amb:american-electric-power-corp|stone-webster` rather than choosing. Treat
`empire-power` against `central-public-service` the same way unless you are certain.

## Anchors

Any of these failing means stop and re-read rather than continue.

- Cook County, Illinois `17031` is Insull. Already passing.
- Philadelphia `42101` is UGI, reading `united-corporation#6`. Already passing.
- The Sacramento Valley reads `pacific-gas-electric`. Pacific Gas and Electric is legend
  cell p18, so the plate can express it.
- **Los Angeles County `06037` is NOT an anchor and a blank reading there is correct.**
  It used to be one, asserting the county must be served, and that was wrong. Every one of
  the 24 legend marks is a named holding company or group; there is no Southern California
  Edison cell and no municipal category. Los Angeles was served by the city's own Bureau of
  Power and Light and by Southern California Edison, neither of which is a principal power
  group, so no legend key could fill that county even in principle. Read it as you find it
  and do not force a fill. Full reasoning in `lib/map4-anchor-retraction-la.md`.
- Jefferson County, Alabama is **not** an anchor. It was used on Map III and encoded a
  contestable assumption about Birmingham Electric.

Expect footprints to differ from 1925 in both directions. Insull collapsed in 1932 and
Middle West Utilities entered receivership that April, so a shrinking or transferred
Insull footprint is a finding, not an error. The United Corporation was formed in January
1929 and legitimately appears here where Map III has no cell for it.

## Marks with no example yet, which means extra care

Seven of the 24 marks have no confirmed exact read anywhere in the 1,860 counties traced
so far. Four are western and are about to matter: `pacific-gas-electric` in the
Sacramento Valley, `nevada-california` in the Owens Valley, `central-public-service` at
Portland, `tri-utilities` in south-west Wyoming. You will be the first to record them, so
measure rather than assume, and say in the log where you first found each one.

## Working rules

- **Commit and push after every state.** A state in the tree is worth something; a state
  in your context is worth nothing, and readers do get interrupted. Pull with rebase first,
  because several agents commit to this branch.
- Append to `../../grid-timeline/1930-tracing-log.md` in the same commit as the state it
  describes: patterns seen, judgement calls, unresolved counties, mesh offsets.
- Commit messages: short declarative sentences, no em dashes, ending with the trailer
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Never put a model identifier in
  the message body.
- Every county in a state gets a record before that state is committed. No partial states.

## State order

Chosen so patch continuity carries across the seam from already-traced territory:

Iowa, Minnesota, Kansas, Nebraska, Oklahoma, Texas, North Dakota, South Dakota, Montana,
Wyoming, Colorado, New Mexico, Utah, Arizona, Idaho, Nevada, Washington, Oregon,
California.

Already complete, do not redo: AL AR CT DE DC FL GA IL IN KY LA ME MD MA MI MS MO NH NJ
NY NC OH PA RI SC TN VT VA WV WI.
