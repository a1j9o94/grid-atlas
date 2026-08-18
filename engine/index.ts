// The engine's public face: create, init against the mounted DOM, destroy.
// Data fetches cache at module level, so a remount re-inks the SVG without
// re-downloading anything.
import { geoAlbersUsa, geoPath } from "d3-geo";
import { req } from "../lib/assert";
import { buildPath, DEFAULT_ROUTE, parseLegacyQuery, parseRoute } from "../lib/route";
import { applyRoute, setColourBy, setShadeBy, setSizeBy } from "./actions";
import { FIT_EXTENT, HOME_VIEW } from "./constants";
import { ctx, setCtx, setHidden, type EngineCtx } from "./ctx";
import { loadBase } from "./data";
import { bindHover } from "./hover";
import { buildRules, initPriceScales } from "./layers/rules";
import { buildWholesale } from "./layers/wholesale";
import { findZip } from "./layers/you";
import { buildScaffold } from "./scaffold";
import { bindModal } from "./ui/modal";
import { bindTour, maybeAutoStartTour } from "./ui/tour";
import { updateUrl } from "./urlstate";
import { animateViewBox, bindZoomPan } from "./viewbox";

function byId(id: string): HTMLElement {
  return req(document.getElementById(id), `#${id}`);
}

function bindControls(): void {
  const c = ctx();
  const signal = c.ac.signal;
  c.shadeControls.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-shade]");
    if (b) setShadeBy(b.dataset.shade ?? "bucket");
  }, { signal });
  c.sizeControls.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-size]");
    if (!b) return;
    // the land button carries data-size="", which means "no measure"
    const size = b.dataset.size;
    setSizeBy(size === undefined || size === "" ? null : size);
  }, { signal });
  c.colourControls.addEventListener("click", (e) => {
    const t = e.target as Element;
    const cb = t.closest<HTMLElement>("[data-colour]");
    if (cb) {
      setColourBy(cb.dataset.colour ?? "type");
      return;
    }
    const v = t.closest<HTMLElement>("[data-variant]");
    if (v) {
      c.variantOf[c.colourBy] = v.dataset.variant ?? "";
      setColourBy(c.colourBy);
    }
  }, { signal });
  c.zipForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const zip = c.zipInput.value.trim();
    // a search the reader typed is a navigation: it earns a history entry
    if (/^\d{5}$/.test(zip)) void findZip(zip, "push");
  }, { signal });
  c.zoomReset.addEventListener("click", () => {
    animateViewBox(HOME_VIEW);
    setHidden(c.zoomReset, true);
  }, { signal });
}

// Deep-link boot. Legacy query params still resolve here as a client-side
// canonicalizer (the middleware answers them with a real redirect first);
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
      const { g, wobbleDisp } = buildScaffold(svg);
      const c: EngineCtx = {
        ac: new AbortController(),
        dead: false,
        svg,
        g,
        wobbleDisp,
        card: byId("card"),
        legend: byId("legend"),
        shadeControls: byId("shade-controls"),
        colourControls: byId("colour-controls"),
        sizeControls: byId("size-controls"),
        rail: byId("rail"),
        explainer: byId("explainer"),
        drawingNote: byId("drawing-note"),
        zipForm: byId("zip-search") as HTMLFormElement,
        zipInput: byId("zip-input") as HTMLInputElement,
        zipMsg: byId("zip-msg"),
        zoomReset: byId("zoom-reset"),
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
        morphAnim: null,
        viewAnim: null,
        drag: null,
        pinch: null,
        hoveredWire: null,
        tourIdx: -1,
      };
      mine = c;
      setCtx(c);
      buildWholesale();
      buildRules();
      initPriceScales();
      bindZoomPan();
      bindHover();
      bindControls();
      bindTour();
      bindModal();
      const deepLinked = bootRoute();
      ready = true;
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
      mine.svg.innerHTML = "";
      setCtx(null);
      mine = null;
    },
  };
}
