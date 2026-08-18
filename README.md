# grid-atlas

An explorable map of how electricity works in America. Live at [grid-atlas-coral.vercel.app](https://grid-atlas-coral.vercel.app).

The map teaches the system as a stack of layers. Wholesale: who runs each power market. Rules: whether your state lets you pick your power company. Wires: the ~2,900 utilities that own the poles. You: your zip code's place in all of it. Then: how it got this way, from 1900 to today.

The history layer is a scrubber of dated plates, not a continuous slide through the years. The archives support moments and membership changes; they do not support annual geometry, and a slider gliding through years where nothing happened would be inventing data. The last plate is today, drawn from the same data as the Wholesale layer, so the end of the timeline and the top of the stack cannot drift apart. Every frame, event and law excerpt carries sources and a `verified` flag; anything that has not been through a fact-check pass says so on its own card. Frames whose geometry is not built yet appear on the scrubber marked as still being inked, so the shape of the whole story is visible before every plate is drawn.

Every view is a link. `/rules/res` shades states by what households pay. `/wires/saidi/by-cust` colours utilities by minutes without power and sizes them by meters; the `by-` prefix marks the size channel, so any measure id can be a colour segment without ambiguity. `/you/78701` finds a zip. `/trivia/caldwell-switched-grids` flies to a story. Defaults stay off the URL, junk paths return 404, and the query links this site shipped with redirect to their canonical paths forever.

The Wires layer can also be drawn by size instead of by land. Every utility becomes a circle whose area is its meters, the electricity it delivers, the money it collects, or the rooftop solar on its system, relaxed apart so they do not overlap. Drawn by land, the map suggests empty country matters most. Drawn by meters, the top 100 utilities hold 76% of the country and the median utility serves about 4,500.

The same layer can be recoloured instead of resized: by ownership type, by parent company, by time without power, by rooftop solar per home, or by smart meter share. Adding one is a registry entry in the pipeline plus a label in the copy deck. The client reads `measures.json` and renders whatever it finds marked `colourOnly`, so it never learns what any particular measure means.

## Data sources

- **Utility service territories:** HIFLD Electric Retail Service Territories, via the NBAM mirror on ArcGIS Online. 2,931 features with type, control area, and customer counts.
- **RTO regions:** derived, not fetched. We dissolve the utility territories by RTO membership. Membership comes from each utility's balancing-authority code (`CNTRL_AREA`), with the planning-area field as a fallback only when the control area is missing. That fallback rule matters: at least one utility has a wrong planning area in HIFLD, and a real control area must always win.
- **State boundaries and zip shapes:** Census cartographic boundary files (`cb_2020_us_state_500k`, `cb_2020_us_zcta520_500k`). Zip shapes are ZCTAs, the Census approximation of zip codes.
- **Zip-to-utility lookup:** OpenEI utility rate crosswalk (2020 edition), 80,206 rows covering 39,146 zips.
- **Cartogram layouts:** derived, not fetched. `data/cartogram.json` holds a Dorling layout per measure, precomputed by the pipeline so the browser never runs a force simulation. Circle area is proportional to the value, seeded at each utility's true centroid and relaxed apart. Positions are in the map's projected coordinates, so the file records the projection it was built for and the site checks that they still agree.
- **Timeline (history layer):** `public/data/timeline.json` holds the plates, the dated events, the law excerpts and the evidence manifest. The 1900 dot set is provisional and hand-entered from the 1900 Census city ranks, flagged `verified: false` until the pipeline rebuilds it from the source table and cross-checks it against the Census Bureau's *Central Electric Light and Power Stations: 1902*, which counted 3,620 stations nationally. That count is why the era is drawn as dots: there was no network to draw.
- **Per-utility measures:** EIA-861 Annual Electric Power Industry Report, 2024 edition. HIFLD's `ID` field is the EIA utility number, so one join brings in meters, electricity delivered and revenue, each split by customer class. 2,889 of 2,901 territories match, covering 99.96% of meters. Lives in `data/measures.json`, separate from the geometry so the 5.5MB shape file stays cached when the numbers change.
- **Reliability:** the same report's `Reliability` sheet. 695 utilities carry a value, 77.9% of meters. 223 more file the form and answer nothing, Oncor and ConEd among them, so they stay grey rather than reading as zero. Utilities serving several states file one row per state and the rows are averaged, not summed: Appalachian Power runs 342 storm-free minutes in Virginia and 576 in West Virginia.
- **Rooftop solar:** `Net_Metering` plus `Non_Net_Metering_Distributed`, added together, photovoltaic columns only. Both files are needed. Texas has no statewide net metering rule, so no Texas wires company appears in the first file at all, and using it alone reports 1,080MW for a state that actually has 2,931MW of household panels. Covers 95.0% of meters. Utility-scale solar is not here: only capacity behind a customer's meter counts, and the non-net-metering file's direct-connected column is dropped for that reason.
- **Smart meters:** the same report's `Advanced_Meters` sheet, AMI against total meters. Covers 99.6% of meters. The identity `total = AMR + AMI + standard` holds in all 2,724 rows, so a blank AMI column on a utility that answered the other two is a real zero. Treating those blanks as missing instead once reported the national share as 91.1% rather than 84.0%, by silently dropping every utility that has no smart meters.

## Corrections we apply to the source data

The map should show current reality, so we keep a small, documented corrections list:

- **City of Caldwell, TX → ERCOT.** HIFLD still shows Caldwell in MISO. The town completed its move into ERCOT in March 2026 (PUCT docket 56164; LCRA built the interconnection). Until then it really was an Eastern-grid island inside Texas. There's a marker on the map telling that story.
- **30 shapes excluded** (2,931 fetched, 2,901 drawn). Generation-and-transmission co-ops and joint-action agencies (STEC, Sam Rayburn MPA, Wolverine, EKPC's umbrella shape, WPPI, NC Eastern MPA, Badger, Basin Electric, Deseret G&T) draw shapes that overlay the distribution utilities that actually serve those areas. Their members are all present individually, so drawing both creates phantom islands. The rule also drops shapes with near-zero customers spanning more than 1.5 degrees, which catches one Alaska village whose shape is a digitizing error. Also excluded: Canadian utilities and island territories the Albers USA projection cannot show.
- **Ownership type inferred from names.** 1,684 utilities carry no ownership type in HIFLD, but the names encode it ("... Electric Coop", "City of ...", "... Public Power District"). We classify 1,558 of them by name pattern; the ~130 genuinely ambiguous ones stay Unknown on the map.
- **Meter counts for the Texas delivery companies.** HIFLD reports no customers for a utility that only owns wires, because in a deregulated market the retailer holds the customer. It stores that as `-999999`, and five ERCOT companies carry it: Oncor, CenterPoint, AEP Texas Central, AEP Texas North and Texas-New Mexico Power. Added together they serve 8.2 million meters, and summing HIFLD as shipped gives ERCOT a *negative* meter count. Real numbers come from EIA-861's delivery-only table.
- **Four Pennsylvania utilities were merged.** West Penn Power, Penelec, Met-Ed and Pennsylvania Power became FirstEnergy Pennsylvania Electric on 2024-01-01. EIA reports them as one company; the map still draws four territories. We split the merged filing across the four shapes in proportion to the meters HIFLD records for each. The split is an approximation, the total is exact.
- **One Community Choice Aggregator shape dropped.** Central Coast Community Energy buys power for customers whose poles belong to PG&E. We sampled 1,522 points inside its territory and every one of them falls inside PG&E's, so drawing both double-counts the same ground. On the size view it would have drawn a 443,755-meter circle for a company that owns no meters. The rule excludes the HIFLD type rather than the name, so a data refresh cannot quietly bring the class back.
- **Service states come from EIA, not HIFLD.** HIFLD's `STATE` is where a utility files its paperwork. Appalachian Power files in Ohio and serves none of it. 25 territories name a state they do not serve, and 101 serve more than one, so the map reads the real list from EIA instead.

## Honest limits

- **The map's controls sit beside the card, not on the map.** They were an overlay at first, which cost map area everywhere and buried it on short windows: three control groups over a 1280x660 laptop covered 54% of the drawn map. Putting them in flow under the map stopped the covering but moved the cost rather than removing it, since a wide screen's map is height-bound and every pixel of chrome came off it. In a column of their own they cost nothing. On a short window the controls take at most three fifths of that column and scroll inside it, and the card takes the rest, because a button that is off screen does not exist and prose survives being cut off at the bottom.
- Region borders come from utility shapes, so they are honest but not smooth.
- Blank white gaps are areas where no utility is mapped. Much of that is wilderness.
- People counts on region cards are rough, marked with `~`.
- **Meters are not people.** The utility cards count billing accounts, and commercial and industrial meters are in there. The national total is about 164 million against roughly 131 million households. Where a utility genuinely reports nothing, the card says "not reported" rather than showing a zero.
- **The size view is a cartogram, so it is not a map.** Circles start at each utility's true location, then push each other aside until nothing overlaps. Dense corners move furthest: the Northeast has more utility than it has room. Circle *area* is honest; position is approximate by construction.
- A utility too small to draw is drawn at a floor of 0.8px rather than at its true size. That overstates the very smallest, and the alternative was letting a thousand real companies vanish. About a third of them sit at the floor.
- **Solar capacity is reported on two incompatible bases.** Utilities file capacity as either alternating or direct current and EIA does not normalise it. The same array rates roughly a fifth higher on the DC basis. 1,024 rows say AC, 281 say DC and 70 say nothing, and there is no way to correct from outside, so the numbers are shipped as filed and this is the caveat.
- **Rooftop solar per home is an intensity, not an array size.** It divides a utility's residential solar capacity by every household meter it serves. A thousand watts per home means roughly one house in six has panels, not that every house has a kilowatt.
- **Smart meter share is nearly binary and its scale says so.** 851 utilities report no AMI and 1,120 report nothing else. Quantile breaks come out as `[0, 59.13, 100, 100]`, two of them identical, so this measure uses fixed breaks. Rooftop solar per home uses fixed breaks for the opposite reason: its quantiles pile 47% of the country's meters into one step spanning 165 to 1,696 watts, which would paint Oncor the same shade as Hawaii.
- Energy-only retailers are excluded on purpose. In Texas a retailer like TXU Energy files as a bundled seller but owns no poles, so counting it would attach a statewide book of customers to whichever territory shares its ID. The map keeps only full-service utilities and delivery-only wires companies.
- Every string the map shows lives in `data/copy.json`. Trivia entries carry a `verified` flag and sources; unverified entries are flagged there before they are treated as fact.

## Stack

Next.js (App Router) in strict TypeScript, deployed on Vercel. The page chrome is React. The map is not: an imperative engine owns everything inside the SVG, because 2,900 hover-tracked paths and per-frame tweens have no business going through a reconciler. The engine computes plain-data models for the cards, legend, and controls and hands them to React through a small store. d3-geo draws the Albers USA projection; TopoJSON carries the geometry. No tracking.

`vercel.json` pins the framework to `nextjs` rather than leaving it to a dashboard toggle. That is not decoration: this project was created as a static site, and a project whose preset is still "Other" runs `npm run build` anyway and then publishes `public/` as flat files, throwing the Next build away. The symptom is every route 404ing while `/data/*.json` serves happily, which is a confusing thing to debug from the outside. Pinning it in the repo means the deploy is reproducible from a clone.

This site shipped its first year with no framework and no build step, and that stance is retired on purpose. More measures and features are coming, and the build step buys real routes with per-link previews, strict types over every data file, and code splitting. The registry property survives the move: adding a measure is still an entry in `measures.json` plus a label in the copy deck, and the routes, controls, cards, and page titles pick it up by existing. `lib/route.ts` owns the URL grammar; the proxy answers legacy query links with a 308 before any JavaScript runs.

The data pipeline (fetch, simplify, shard, corrections) runs in a companion workspace; its outputs are the files in `public/data/`. The big files stay lazily fetched: the wires geometry loads on first open of that layer, and zip shapes load in two-digit shards.

## License

Code is MIT. The underlying data comes from public federal sources (HIFLD, Census, DOE/OpenEI).

## Checking the layout

The layout contract is that the page fits the viewport at every size: no scrolling, panels shrink or collapse rather than overlap. That is easy to break and hard to see, so it is asserted rather than eyeballed.

```
npm install
npx playwright install chromium   # or set CHROME_PATH to one you have
npm run build
npm run audit                     # add -- --shots to also write PNGs
```

The audit starts the production build itself with `next start` and drives that, never the dev server: dev mode double-invokes effects and its overlay logs would trip the console-error check. It first asserts the legacy-link redirect matrix and that junk paths 404, then drives eight viewports across fifteen views, 120 combinations, and fails on a page that scrolls, a panel that runs offscreen, two panels that overlap, chrome covering more than 22% of the drawn map, a map smaller than 12% of the viewport or under 150px tall, a map clipped by its own panel, a tap target under 28px, text clipped by its own box, or any console error.

Every one of those checks was added after a real failure, and the same mistake keeps recurring in a new costume. The audit first reported 66 combinations clean on a build where the controls buried the map on a phone: it had only ever compared chrome against chrome, never chrome against the map. So a coverage check went in. Then it reported 90 combinations clean on a build where a landscape phone showed 88x55 pixels of map, because **a map squeezed to nothing scores a perfect 0% coverage**. Hence the minimum-size check. Then it reported overlaps that were not there, because it measured raw layout rects and an element scrolled out of view inside a clipping box keeps its rect wherever the content put it. Hence measuring the visible rect, intersected with every ancestor that clips.

Assert the property you want, not the absence of the bug you just fixed. And measure what the reader experiences, not what the layout tree says.

Typing and linting are part of the same contract. `npm run typecheck` runs strict TypeScript with `noUncheckedIndexedAccess`, because this codebase is full of keyed registry lookups that would otherwise produce a silent `undefined`. `npm run lint` runs typescript-eslint's type-checked strict presets at zero warnings. Both gate every commit.
