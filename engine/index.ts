// The engine's public face: create, init against the mounted DOM, destroy.
// Data fetches cache at module level, so a remount re-inks the SVG without
// re-downloading anything.
import { geoAlbersUsa, geoPath } from "d3-geo";
import { req } from "../lib/assert";
import { buildPath, DEFAULT_ROUTE, parseLegacyQuery, parseRoute } from "../lib/route";
import { resetAtlasState, setAtlasState } from "../lib/store";
import { applyRoute } from "./actions";
import { FIT_EXTENT } from "./constants";
import { ctx, setCtx, type EngineCtx } from "./ctx";
import { loadBase } from "./data";
import { bindHover } from "./hover";
import { buildRules, initPriceScales } from "./layers/rules";
import { buildWholesale } from "./layers/wholesale";
import { buildScaffold } from "./scaffold";
import { maybeAutoStartTour } from "./ui/tour";
import { updateUrl } from "./urlstate";
import { bindZoomPan } from "./viewbox";

// Deep-link boot. Legacy query params still resolve here as a client-side
// canonicalizer (the proxy answers them with a real redirect first);
// otherwise the pathname is the state. Returns whether a deep link was
// followed, which is what decides if the tour may offer itself.
function bootRoute(): boolean {
  const c = ctx();
  const legacy = parseLegacyQuery(location.search);
  const route = legacy ?? parseRoute(location.pathname) ?? { ...DEFAULT_ROUTE };
  const deepLinked = legacy !== null || location.pathname !== "/";
  void applyRoute(route).then(() => {
    if (c.dead) return;
    // canonicalize what the address bar shows: clears legacy params and
    // normalizes segment spellings without adding a history entry
    if (route.trivia !== null) history.replaceState(null, "", buildPath(route));
    else updateUrl(c.current, "replace");
  });
  return deepLinked;
}

export interface Engine {
  init(): Promise<void>;
  // point the engine at a new pathname; no-ops until init has finished
  route(pathname: string): void;
  destroy(): void;
}

export function createEngine(): Engine {
  let mine: EngineCtx | null = null;
  let destroyed = false;
  let ready = false;
  return {
    async init(): Promise<void> {
      const base = await loadBase();
      if (destroyed) return;
      const svg = req(document.getElementById("map"), "#map") as unknown as SVGSVGElement;
      const projection = geoAlbersUsa().fitExtent(FIT_EXTENT, base.statesFC);
      const { g, wobbleDisp, legendStyle } = buildScaffold(svg);
      const c: EngineCtx = {
        ac: new AbortController(),
        dead: false,
        svg,
        g,
        wobbleDisp,
        zipInput: req(document.getElementById("zip-input"), "#zip-input") as HTMLInputElement,
        statesFC: base.statesFC,
        rtosFC: base.rtosFC,
        transitionsFC: base.transitionsFC,
        stateLines: base.stateLines,
        projection,
        path: geoPath(projection),
        current: "wholesale",
        sizeBy: null,
        colourBy: "type",
        shadeBy: "bucket",
        variantOf: {},
        zip: null,
        routeToken: 0,
        wiresFeatures: null,
        wiresCounts: null,
        measures: null,
        cartogram: null,
        circleEls: null,
        parentGroups: null,
        colourScales: new Map(),
        priceScales: {},
        timeline: null,
        frameId: null,
        playTimer: null,
        dotAnim: null,
        seam: null,
        membership: null,
        holdings: null,
        morphAnim: null,
        viewAnim: null,
        drag: null,
        pinch: null,
        hoveredWire: null,
        legendTargets: new Map(),
        legendGen: 0,
        legendHover: null,
        legendStyle,
      };
      mine = c;
      setCtx(c);
      buildWholesale();
      buildRules();
      initPriceScales();
      bindZoomPan();
      bindHover();
      const deepLinked = bootRoute();
      ready = true;
      setAtlasState({ ready: true });
      maybeAutoStartTour(deepLinked);
    },
    route(pathname: string): void {
      if (destroyed || !ready || !mine || mine.dead) return;
      const parsed = parseRoute(pathname);
      // an unknown path can only arrive from outside; the server 404s those
      if (parsed) void applyRoute(parsed);
    },
    destroy(): void {
      destroyed = true;
      if (!mine) return;
      mine.dead = true;
      mine.ac.abort();
      if (mine.viewAnim !== null) cancelAnimationFrame(mine.viewAnim);
      if (mine.morphAnim !== null) cancelAnimationFrame(mine.morphAnim);
      // The svg element itself is React's, so the classes the engine put on it
      // outlive the ink unless they are taken off here.
      mine.svg.classList.remove("has-hover", "has-legend-hover");
      mine.svg.innerHTML = "";
      setCtx(null);
      mine = null;
      resetAtlasState();
    },
  };
}
