# The pipeline

Every JSON and topojson file under `public/data` is generated. Nothing in there is
hand-edited. These are the scripts that generate it, vendored here so a reader can
check the numbers on the map against the source they came from.

## Where this comes from

| | |
|---|---|
| Canonical home | `a1j9o94/light-workspace` |
| Path in that repo | `writing/energy-market-series/interactives/market-map/pipeline` |
| Vendored at commit | `34026732e880c1889444cd550ec599afe7b903cc` (2026-08-23) |

**This copy is a mirror, not the working tree.** Edits belong upstream, in
light-workspace, and land here by re-vendoring:

```sh
git -C <light-workspace> archive HEAD \
  writing/energy-market-series/interactives/market-map/pipeline \
  | tar -x --strip-components=5 -C pipeline
```

If a script here disagrees with the committed data, the data is what shipped and
the script is what to read; re-run it and see.

## Output paths

The scripts default `--out` to `../site/data`, which is the layout of the
interactive inside light-workspace. In this repo the data lives in `public/data`,
so pass it explicitly:

```sh
node pipeline/07-build-measures.mjs --out public/data --year 2024
```

Raw downloads land in `pipeline/data-raw/`, which is gitignored. The EIA and HIFLD
fetchers are cached — they skip the download if the archive is already there.

## Which script writes what

| Script | Writes |
|---|---|
| `01-fetch-territories.mjs` | raw HIFLD territories into `data-raw/` |
| `02-build-layers.mjs` | `wires.topo.json`, `rtos.topo.json`, `states.topo.json`, `transitions.topo.json` |
| `03-build-zips.mjs` | `zcta/*.topo.json` |
| `04-build-crosswalk.mjs` | `zip/*.json` |
| `05-sync-content.mjs` | `copy.json`, `rules.json` |
| `06-bundle-vendor.mjs` | vendored client JS |
| `07-build-measures.mjs` | `measures.json` |
| `08-build-cartogram.mjs` | `cartogram.json` |
| `09-build-state-prices.mjs` | `state-prices.json` |
| `11-build-timeline-dots.mjs` | `timeline.json` |
| `12-check-interconnections.mjs` | check only, writes nothing |
| `13-build-seam.mjs` | `timeline/seam.topo.json` |
| `15-build-membership.mjs` | `timeline/regions.topo.json` |
| `15-build-holdings-1930.py` | `timeline/holdings-1925.json`, `timeline/holdings-counties.topo.json` |
| `14-fetch-evidence.py` | evidence scans under `public/evidence` |

The `16-` through `29-` Python scripts, plus `apply4.py`, `probe4.py`, `refsheet.py`,
`sheet4.py` and `tile4.py`, are the 1925/1932 FTC plate tracing and adjudication
tools. They feed `15-build-holdings-1930.py` and are not part of a routine rebuild.

## Two things that are easy to get wrong

Both are documented at length in the header comments of the scripts themselves.
They are repeated here because both have already produced a wrong map once.

**EIA-861 Parts.** A customer's power can be billed by one company or two, and the
form reflects that:

| Part | Service type | Who billed what |
|---|---|---|
| A | Bundled | the utility billed energy and delivery together |
| B | Energy | a supplier billed energy; the wires company billed delivery for the same power |
| C | Delivery | the wires company billed delivery only |
| D | Bundled | a Texas-style retailer billed **both** halves and remits delivery to the wires company |

Consequences, in order of how easily they bite:

- **Part B duplicates Part C volume.** The same megawatthours appear under both.
  Count volume once.
- **Part D already contains the delivery charge.** `Delivery_Companies_2024.xlsx`
  says so in its own footer: *"This data should not be added to the data in sales to
  ultimate customers, since it is already included by the power marketers on Part
  D."* Adding it put Texas at 17.55 ¢/kWh against EIA's published 14.94.
- **Part A and Part C revenue are different quantities.** A bundled bill is not a
  delivery charge. Summing them into one revenue figure and dividing by total
  volume produces a number that is neither, biased downward in proportion to how
  many customers shop. For the 67 utilities that file both, the bias reaches
  −15.6 ¢/kWh. `07-build-measures.mjs` keeps the two revenue streams in separate
  accumulators for exactly this reason.

**A retailer has no shape.** Energy-only providers and Texas retailers own no
poles, so they have no service territory to draw and cannot be coloured on the
wires layer. Any all-in price that includes them is therefore a state-level
number, which is why `state-prices.json` exists alongside `measures.json`. The
wires layer can honestly show a utility's own bundled price and its own delivery
charge; it cannot show what a shopping customer paid in total.
