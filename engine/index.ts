// The engine's public face: create, init against the mounted DOM, destroy.
// Data fetches cache at module level, so a remount re-inks the SVG without
// re-downloading anything.
import { geoAlbersUsa, geoPath } from "d3-geo";
import { req } from "../lib/assert";
import { copy, type LayerKey } from "../lib/data";
import { setColourBy, setLayer, setShadeBy, setSizeBy } from "./actions";
import { FIT_EXTENT, HOME_VIEW, LAYERS } from "./constants";
import { ctx, setCtx, setHidden, type EngineCtx } from "./ctx";
import { isColourMeasure, loadBase, measureSpec } from "./data";
import { bindHover } from "./hover";
import { buildRules, initPriceScales } from "./layers/rules";
import { buildWholesale, flyToTrivia } from "./layers/wholesale";
import { findZip } from "./layers/you";
import { buildScaffold } from "./scaffold";
import { bindModal } from "./ui/modal";
import { bindTour, maybeAutoStartTour } from "./ui/tour";
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
    if (/^\d{5}$/.test(zip)) void findZip(zip);
  }, { signal });
  c.zoomReset.addEventListener("click", () => {
    animateViewBox(HOME_VIEW);
    setHidden(c.zoomReset, true);
  }, { signal });
}

// Deep-link boot: the legacy query-param parser, kept working verbatim until
// the path router replaces it. Returns whether a deep link was followed.
function bootFromUrl(): boolean {
  const c = ctx();
  const params = new URLSearchParams(location.search);
  const wanted = params.get("layer");
  const wantedZip = params.get("zip");
  const wantedTrivia = params.get("trivia");
  if (wantedZip !== null && /^\d{5}$/.test(wantedZip)) {
    void setLayer("you").then(() => {
      if (c.dead) return;
      c.zipInput.value = wantedZip;
      void findZip(wantedZip);
    });
  } else if (wantedTrivia !== null && copy.trivia.some((t) => t.id === wantedTrivia)) {
    void setLayer("wholesale").then(() => {
      if (!c.dead) flyToTrivia(wantedTrivia);
    });
  } else if (wanted === "wires" && (params.get("size") !== null || params.get("colour") !== null)) {
    // deep link straight into a sized or recoloured map,
    // e.g. ?layer=wires&size=cust&colour=saidi
    void setLayer("wires").then(() => {
      if (c.dead) return;
      const k = params.get("size");
      if (k !== null && c.cartogram?.measures[k]) setSizeBy(k);
      // A trailing "-variant" picks a storm basis, as in saidi-all. Split on
      // the last hyphen only, so a measure id containing one still resolves.
      let col = params.get("colour");
      if (col !== null) {
        const cut = col.lastIndexOf("-");
        const base = cut > 0 ? col.slice(0, cut) : col;
        const variant = cut > 0 ? col.slice(cut + 1) : null;
        if (variant !== null && measureSpec(base)?.variants?.[variant] !== undefined) {
          c.variantOf[base] = variant;
          col = base;
        }
        if (col === "parent" || isColourMeasure(col)) setColourBy(col);
      }
    });
  } else if (wanted === "rules" && params.get("shade") !== null) {
    void setLayer("rules").then(() => {
      if (c.dead) return;
      const k = params.get("shade");
      if (k !== null && c.priceScales[k]) setShadeBy(k);
    });
  } else {
    void setLayer(LAYERS.includes(wanted as LayerKey) ? (wanted as LayerKey) : "wholesale");
  }
  return !!(wantedZip ?? wanted ?? wantedTrivia);
}

export interface Engine {
  init(): Promise<void>;
  destroy(): void;
}

export function createEngine(): Engine {
  let mine: EngineCtx | null = null;
  let destroyed = false;
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
      const deepLinked = bootFromUrl();
      maybeAutoStartTour(deepLinked);
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
