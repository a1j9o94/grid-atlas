# grid-atlas

An explorable map of how electricity works in America. Live at [grid-atlas-coral.vercel.app](https://grid-atlas-coral.vercel.app).

The map teaches the system as a stack of layers. Wholesale: who runs each power market. Rules: whether your state lets you pick your power company. Wires: the ~2,900 utilities that own the poles. You: your zip code's place in all of it.

## Data sources

- **Utility service territories:** HIFLD Electric Retail Service Territories, via the NBAM mirror on ArcGIS Online. 2,931 features with type, control area, and customer counts.
- **RTO regions:** derived, not fetched. We dissolve the utility territories by RTO membership. Membership comes from each utility's balancing-authority code (`CNTRL_AREA`), with the planning-area field as a fallback only when the control area is missing. That fallback rule matters: at least one utility has a wrong planning area in HIFLD, and a real control area must always win.
- **State boundaries and zip shapes:** Census cartographic boundary files (`cb_2020_us_state_500k`, `cb_2020_us_zcta520_500k`). Zip shapes are ZCTAs, the Census approximation of zip codes.
- **Zip-to-utility lookup:** OpenEI utility rate crosswalk (2020 edition), 80,206 rows covering 39,146 zips.

## Corrections we apply to the source data

The map should show current reality, so we keep a small, documented corrections list:

- **City of Caldwell, TX → ERCOT.** HIFLD still shows Caldwell in MISO. The town completed its move into ERCOT in March 2026 (PUCT docket 56164; LCRA built the interconnection). Until then it really was an Eastern-grid island inside Texas. There's a marker on the map telling that story.
- **24 shapes excluded.** Generation-and-transmission co-ops and joint-action agencies (STEC, Sam Rayburn MPA, Wolverine, EKPC's umbrella shape, WPPI, NC Eastern MPA, Badger) draw shapes that overlay the distribution utilities that actually serve those areas. Their members are all present individually, so drawing both creates phantom islands. Also excluded: Canadian utilities and island territories the Albers USA projection cannot show.
- **Ownership type inferred from names.** 1,684 utilities carry no ownership type in HIFLD, but the names encode it ("... Electric Coop", "City of ...", "... Public Power District"). We classify 1,558 of them by name pattern; the ~130 genuinely ambiguous ones stay Unknown on the map.

## Honest limits

- Region borders come from utility shapes, so they are honest but not smooth.
- Blank white gaps are areas where no utility is mapped. Much of that is wilderness.
- People counts on region cards are rough, marked with `~`.
- Every string the map shows lives in `data/copy.json`. Trivia entries carry a `verified` flag and sources; unverified entries are flagged there before they are treated as fact.

## Stack

Static site: vanilla JS, d3-geo for the Albers USA projection, TopoJSON for geometry. No framework, no tracking. The data pipeline (fetch, simplify, shard, corrections) runs in a companion workspace; its outputs are the files in `data/`.

## License

Code is MIT. The underlying data comes from public federal sources (HIFLD, Census, DOE/OpenEI).
