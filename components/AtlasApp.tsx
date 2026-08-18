"use client";

// The page chrome, with every id and class from the original index.html
// intact: styles.css and the layout audit select by them, so this DOM is a
// contract. The map engine owns everything inside #map; everything else
// renders from the store.
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createEngine, type Engine } from "../engine";
import { getAtlasState, setAtlasState } from "../lib/store";
import { tourShow } from "../engine/ui/tour";
import Rail from "./Rail";
import Card from "./Card";
import Legend from "./Legend";
import { ColourControls, ShadeControls, SizeControls } from "./Controls";
import { DrawingNote, ZipSearch, ZoomReset } from "./MapChrome";
import TourPanel from "./TourPanel";
import TimelineBar from "./TimelineBar";
import EvidenceModal from "./EvidenceModal";
import MethodologyModal from "./MethodologyModal";

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
          <p className="dek">Who runs the grid where you live, in five layers. Start wide. Zoom to your zip code. Then scrub back to 1900 and watch it get built.</p>
        </header>

        <div className="body">
          <nav className="rail" aria-label="Map layers">
            <h2>The stack</h2>
            <Rail />
          </nav>

          <div className="map-panel">
            <DrawingNote />
            <TimelineBar />
            <svg id="map" viewBox="0 0 975 610" role="img" aria-label="Map of the United States electricity system" hidden></svg>
            <ZipSearch />
            <ZoomReset />
          </div>

          {/* The card and the map's controls share a column, so the map panel
              is nothing but map. They used to float over it, which cost map
              area on every screen and buried it outright on short ones. */}
          <div className="side">
            <Card />
            <div className="map-ui">
              <Legend />
              <ShadeControls />
              <ColourControls />
              <SizeControls />
            </div>
          </div>
        </div>

        <footer className="foot">
          <span className="foot-buttons">
            <button
              className="method-toggle"
              id="method-toggle"
              aria-haspopup="dialog"
              onClick={() => { setAtlasState({ modalOpen: true }); }}
            >
              Methodology &amp; about
            </button>
            <button
              className="tour-start"
              id="tour-start"
              onClick={() => {
                if (getAtlasState().ready) tourShow(0);
              }}
            >
              ▶ 30-second tour
            </button>
          </span>
          <a className="gh-link" href="https://github.com/a1j9o94/grid-atlas" target="_blank" rel="noopener">Check our work on GitHub ↗</a>
        </footer>
        <TourPanel />
        <MethodologyModal />
        <EvidenceModal />
      </div>
    </div>
  );
}
