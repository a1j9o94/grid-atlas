# Prior art check: has anyone digitised the FTC county plates?

Date of search: 2026-08-23. Purpose: decide whether we can claim a first before
saying so publicly.

Target of the claim. FTC *Utility Corporations*, Senate Document 92 part 72-A
(1935), Map III (fields of operation of principal power groups by county, 1925)
and Map IV (same, 1932). The question is not whether the images exist online.
It is whether the county-level information on them exists as data anywhere.

## Result

No prior county-level digitisation of either plate found. No machine-readable
version, no shapefile, no join to county FIPS, no interactive. Fourteen queries
across map collections, data repositories, the economic history literature, and
code hosting.

## What does exist, and why none of it is the same thing

**Scans of the volume.** govinfo carries the serial set volume
(`SERIALSET-08858_57_02`). HathiTrust carries the same report
(catalog record 003849155, scan `ien.35556021351598`). Both are page images with
no text layer over the plates, no georeference, and no county attribution. The
information is visible to a human eye and inaccessible to everything else. This
is the distinction the claim rests on.

**The closest real digitisation effort: Kitchens and Jaworski (NBER w22254,
2016).** They digitised the Federal Power Commission's *Electric Rate Survey*
for 1935 and 1940, covering more than 15,000 markets and about 99 percent of
residential kilowatt hours. They also digitised FPC transmission grid maps for
1935 and 1941. This is the strongest adjacent work and the one most likely to
be raised in reply. It is not the same variable. Their ownership field is
public versus private. It does not name the holding company or the system, and
the unit is a market, not a county.

**Kitchens and Fishback (NBER w19743, *Flip the Switch*).** County panel for the
1930s covering electrification rates and REA lending. Different variable
entirely: how electrified a county was, not who owned the system in it.

**Rival paper sources nobody appears to have digitised either.** The Library of
Congress holds *Atlas of the electric light and power properties of the public
utility companies in the United States as of December, 1935* (Institutional
Utility Service, Inc.) and FPC National Power Survey service-area maps from
1935. Both are candidates for a better source than the FTC plates. Both are
still paper. If someone points at one of these, the answer is that it is the
same problem we just solved, one shelf over.

**Modern service-territory GIS.** EIA Electric Retail Service Territories, HIFLD,
and the state PUC layers. Present day, and unrelated to 1925 or 1932 ownership.

## Limits of this search

Worth stating plainly, because it is the reason to keep a hedge in the claim.

- Web search only. No Google Scholar, no JSTOR, no Web of Science full text.
- ICPSR was searched through the open web rather than its own catalogue. One
  early lead (ICPSR 8908) turned out to be the Study of Consumer Purchases and
  not utility data at all.
- Dataverse and OpenICPSR were searched by keyword, not browsed.
- A dissertation, a course project, or an unindexed state historical society
  effort would not surface here.

## Claim language that survives this

"As far as I can find, nobody had turned them into data." The hedge costs one
clause and buys the case where an unindexed effort exists. If a reply produces
one, the reply is a gift, not a correction to eat.
