"use client";

// The page chrome, with every id and class from the original index.html
// intact: styles.css and the layout audit select by them, so this DOM is a
// contract. The map engine owns everything inside #map; everything else
// renders from the store.
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createEngine, type Engine } from "../engine";
import { copy } from "../lib/data";
import { getAtlasState, setAtlasState, useAtlas } from "../lib/store";
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

// Which of the five the reader is on. It used to read "Plate 1 · An explorable
// map", written when there was one map and left behind when there were five: it
// said Plate 1 on all of them. Its own component so a layer change repaints a
// line of text rather than the whole page, and the words come from the copy
// deck the rail already uses, so the header and the rail cannot disagree.
function Kicker() {
  const l = copy.layers[useAtlas((s) => s.layer)];
  return <p className="kicker">{l.title} · {l.gloss}</p>;
}

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
          <Kicker />
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
            {/* Both are pinned to the top of the map panel, so they stack in one
                positioned column rather than each choosing its own offset. That
                is what stops the source-plate control landing on the scrubber
                when the panel is short. */}
            <div className="time-stack">
              <TimelineBar />
            </div>
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
