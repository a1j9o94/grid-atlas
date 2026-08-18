"use client";

// The page chrome, transcribed from the old index.html with every id and
// class intact: styles.css and the layout audit select by them, so this DOM
// is a contract. The map engine mounts into #map and owns everything inside.
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createEngine, type Engine } from "../engine";

export default function AtlasApp() {
  const engineRef = useRef<Engine | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const engine = createEngine();
    engineRef.current = engine;
    void engine.init();
    return () => {
      engineRef.current = null;
      engine.destroy();
    };
  }, []);

  // The pathname is the view state. This fires for Next navigations and for
  // the engine's own native history writes alike; the engine diffs against
  // its current state, so echoes of its own writes are no-ops.
  useEffect(() => {
    engineRef.current?.route(pathname);
  }, [pathname]);

  return (
    <div className="plate">
      <div className="plate-inner">
        <header className="head">
          <p className="kicker">Plate 1 · An explorable map</p>
          <h1>How your electricity works</h1>
          <p className="dek">Who runs the grid where you live, in four layers. Start wide. Zoom to your zip code.</p>
        </header>

        <div className="body">
          <nav className="rail" aria-label="Map layers">
            <h2>The stack</h2>
            <div className="steps" id="rail"></div>
            <aside className="explainer" id="explainer"></aside>
          </nav>

          <div className="map-panel">
            <div className="drawing-note" id="drawing-note">
              <p>The map is being drawn.</p>
              <p className="sub">Check back shortly. The boundaries of 2,900 utilities take a moment to ink.</p>
            </div>
            <svg id="map" viewBox="0 0 975 610" role="img" aria-label="Map of the United States electricity system" hidden></svg>
            <form className="zip-search" id="zip-search" hidden>
              <label htmlFor="zip-input">Type your zip code</label>
              <div className="zip-row">
                <input id="zip-input" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}" maxLength={5} placeholder="78701" required />
                {/* The label text stays in the DOM at every size and is only
                    hidden visually, so the button keeps the accessible name
                    "Find me" when the glyph is all you can see. */}
                <button type="submit">
                  <svg className="ico-search" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <circle cx="6.8" cy="6.8" r="4.4" /><path d="M10.1 10.1 L14 14" />
                  </svg>
                  <span className="btn-txt">Find me</span>
                </button>
              </div>
              <p className="zip-msg" id="zip-msg"></p>
            </form>
            <button className="zoom-reset" id="zoom-reset" hidden>← Whole country</button>
          </div>

          {/* The card and the map's controls share a column, so the map panel is
              nothing but map. They used to float over it, which cost map area on
              every screen and buried it outright on short ones. */}
          <div className="side">
            <aside className="card" id="card" hidden></aside>
            <div className="map-ui">
              <div className="legend" id="legend" hidden></div>
              <div className="size-controls" id="shade-controls" hidden></div>
              <div className="size-controls" id="colour-controls" hidden></div>
              <div className="size-controls" id="size-controls" hidden></div>
            </div>
          </div>
        </div>

        <footer className="foot">
          <span className="foot-buttons">
            <button className="method-toggle" id="method-toggle" aria-haspopup="dialog">Methodology &amp; about</button>
            <button className="tour-start" id="tour-start">▶ 30-second tour</button>
          </span>
          <a className="gh-link" href="https://github.com/a1j9o94/grid-atlas" target="_blank" rel="noopener">Check our work on GitHub ↗</a>
        </footer>
        <div className="tour-panel" id="tour-panel" hidden>
          <p className="tour-step" id="tour-step-label"></p>
          <h3 id="tour-title"></h3>
          <p className="tour-body" id="tour-body"></p>
          <div className="tour-actions">
            <button id="tour-skip">Skip</button>
            <button id="tour-next" className="primary">Next</button>
          </div>
        </div>
        <div className="modal-backdrop" id="method-modal" hidden>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="method-title">
            <button className="modal-close" id="method-close" aria-label="Close">✕</button>
            <h2 id="method-title">How this map is made</h2>
            <p className="note"><b>Where the shapes come from.</b> Utility service areas are federal HIFLD data (2,900+ utilities). Market regions are built by merging those utilities by the market each one belongs to. Zip shapes are the Census version of zip codes. Region borders are honest but not smooth, and blank gaps are areas where no utility is mapped; much of that is wilderness.</p>
            <p className="note"><b>What we fix.</b> The source data has known errors and stale facts. Every correction is documented: the biggest is the City of Caldwell, which really was an Eastern-grid island inside Texas until it joined ERCOT in March 2026. SPP opened a market for a group of western utilities in April 2026; they show as the striped SPP West region, membership verified utility by utility against SPP&apos;s rosters.</p>
            <p className="note"><b>Where the numbers come from.</b> Utility size comes from the EIA&apos;s annual industry report, joined to each territory by utility ID. A count is meters, not people: business and factory meters are in there, so the national total is about 164 million against roughly 131 million homes. Texas needed a fix. A company that only owns wires reports no customers, because there the retailer holds the customer, so the five biggest wire owners in Texas came through blank. Their real counts come from the EIA&apos;s delivery-company table. Where a utility truly reports nothing, the card says so instead of showing a zero.</p>
            <p className="note"><b>Drawing the map by size.</b> On the wires layer you can swap land for size. Every company becomes a circle, and the area of the circle is the amount: meters, electricity, or money. Circles start where the company really is, then push each other apart until none overlap, so crowded corners like the Northeast drift furthest from home. The area is honest; the position is close. Companies too small to see are drawn at a smallest size so they do not vanish, and a few that report nothing are left out. One company, Central Coast Community Energy, was removed from the map entirely: it sells power but owns no wires, and its shape sat entirely on top of PG&amp;E&apos;s.</p>
            <p className="note"><b>Shading the map.</b> The wires layer can also be coloured by time without power, by rooftop solar, and by smart meters. All three come from the same annual report, and each has a gap worth knowing. Reliability is filed by companies covering about four fifths of the country&apos;s meters; the rest report nothing and stay grey. Rooftop solar needed two separate files. Texas has no net metering rule, so no Texas wires company files a net metering form, and the obvious single source would have drawn the second-sunniest large state almost empty. The other file, covering solar outside a net metering tariff, is where Texas keeps its 2,900 megawatts of household panels. Only panels behind a customer&apos;s meter are counted here. Solar farms are generation and belong on a different map.</p>
            <p className="note"><b>Two things the shading cannot tell you.</b> Companies report solar capacity on one of two bases, alternating or direct current, and the report does not convert between them. The same array rates about a fifth higher on the direct current basis, and there is no way to correct for it from outside. Smart meters are close to all or nothing: a company has either swapped its meters or it has not. That map has five steps and most of the country sits in the top one or the bottom one, which is the finding rather than a flaw in the colours.</p>
            <p className="note"><b>What the marks mean.</b> Every claim on a trivia marker carries sources in the data files. Anything still being checked says so on its card. People counts are rough and marked with ~.</p>
            <p className="note"><b>Who made this.</b> Part of a series on how electricity markets work. I work at Light, which only exists because Texas structured its market a particular way. Judge my arguments accordingly.</p>
            <p className="note"><a href="https://github.com/a1j9o94/grid-atlas" target="_blank" rel="noopener">All code, data, and corrections are public on GitHub ↗</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
