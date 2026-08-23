// The state-changing actions. Everything a control or the router does funnels
// through here, so the map, the card, the legend, the controls, and the URL
// stay in step. React components call these directly; the engine's SVG work
// happens in place and everything HTML-shaped goes out through the store.
import { req } from "../lib/assert";
import { copy, type LayerKey } from "../lib/data";
import type { RouteState } from "../lib/route";
import { setAtlasState } from "../lib/store";
import { HOME_VIEW, READY } from "./constants";
import { ctx, setHidden } from "./ctx";
import { isColourMeasure, measureSpec } from "./data";
import { clearHighlights, clearLegendPin, highlightLegend, pinLegendKey } from "./highlight";
import { buildParentGroups, ensureWires, morphCircles, renderSizeKey, repaintWires } from "./layers/wires";
import { repaintRules } from "./layers/rules";
import { flyToTrivia } from "./layers/wholesale";
import {
  ensureTimeline,
  frames,
  hideHistory,
  renderTimelineBar,
  resolveFrame,
  setFrame,
  startPlay,
  stepFrame,
  stopPlay,
} from "./layers/history";
import { findZip, youBase } from "./layers/you";
import { animateViewBox } from "./viewbox";
import {
  openEvidence, showCartogramMeasureCard, showColourMeasureIntro, showFindYourself,
  showFrame, showFrameEvent, showParentIntro, showPriceIntro, showRegion, showState, showWiresIntro,
} from "./ui/cards";
import { renderLegend } from "./ui/legend";
import { renderColourControls, renderShadeControls, renderSizeControls } from "./ui/controls";
import { currentRoute, updateUrl, type UrlMode } from "./urlstate";

export async function setLayer(key: LayerKey, urlMode: UrlMode = "push"): Promise<void> {
  const c = ctx();
  const token = ++c.routeToken;
  c.current = key;
  c.layerDrawn = true;
  setAtlasState({ layer: key });
  const ready = READY.has(key);
  if (!ready) setAtlasState({ card: null });
  setHidden(c.g.rto, key !== "wholesale");
  setHidden(c.g.transitions, key !== "wholesale");
  setHidden(c.g.labels, key !== "wholesale");
  setHidden(c.g.trivia, key !== "wholesale");
  setHidden(c.g.rules, key !== "rules");
  setHidden(c.g.wires, key !== "wires");
  setHidden(c.g.cartogram, key !== "wires" || c.sizeBy === null);
  setHidden(c.g.you, key !== "you");
  setHidden(c.g.zipoutline, key !== "wires");
  if (key !== "history") hideHistory();
  clearHighlights();
  if (key !== "you") {
    animateViewBox(HOME_VIEW, 500);
    setAtlasState({ zoomResetVisible: false });
  }
  if (key === "you") {
    youBase();
    if (!c.g.you.querySelector("#g-zips")?.children.length) showFindYourself();
    setAtlasState({ zoomResetVisible: c.svg.getAttribute("viewBox") !== HOME_VIEW.join(" ") });
  }
  if (key === "wires" && !c.wiresFeatures) {
    setHidden(c.svg, true);
    setAtlasState({ drawingNote: { title: "Loading 2,907 utility territories", sub: "This may take a moment." } });
    await ensureWires();
    // the reader may have moved on while 5.7MB of geometry inked
    if (c.dead || c.routeToken !== token) return;
    setHidden(c.g.wires, false);
  }
  if (key === "history" && !c.timeline) {
    setHidden(c.svg, true);
    setAtlasState({ drawingNote: { title: "Loading the history maps", sub: "This may take a moment." } });
    await ensureTimeline();
    // the reader may have moved on while the timeline loaded
    if (c.dead || c.routeToken !== token) return;
  }
  setHidden(c.svg, !ready);
  setAtlasState({
    drawingNote: ready ? null : {
      title: `The ${copy.layers[key].title} layer is not available yet.`,
      sub: "Choose another layer to keep exploring.",
    },
  });
  if (key === "wires") {
    renderSizeControls();
    renderColourControls();
    setHidden(c.g.cartogram, c.sizeBy === null);
    c.g.wires.classList.toggle("faded", c.sizeBy !== null);
  }
  if (key === "rules") renderShadeControls();
  renderSizeKey(c.current === "wires" ? c.sizeBy : null);
  renderLegend(key);
  if (key === "wholesale") showRegion("ERCOT");
  if (key === "rules" && c.shadeBy === "bucket") showState("TX");
  if (key === "rules" && c.shadeBy !== "bucket") setShadeBy(c.shadeBy, "none");
  if (key === "wires" && c.sizeBy === null && c.colourBy === "type") showWiresIntro();
  // Opens on the first plate, not on today. "In 1900 there was no grid" is the
  // hook, and today is one press away at the other end of the scrubber.
  if (key === "history") {
    renderTimelineBar();
    const open = c.frameId ?? frames()[0]?.id ?? null;
    if (open !== null) setFrame(open, "none");
  }
  updateUrl(key, urlMode);
}

// Switch between the land map and a sized map. `key` is null for land.
export function setSizeBy(key: string | null, urlMode: UrlMode = "replace"): void {
  const c = ctx();
  c.sizeBy = key;
  setHidden(c.g.cartogram, c.current !== "wires");
  c.g.wires.classList.toggle("faded", key !== null);
  morphCircles(key);
  renderSizeKey(key);
  renderLegend(c.current);
  renderSizeControls();
  updateUrl(c.current, urlMode);
  if (key !== null) showCartogramMeasureCard(key);
  else if (c.wiresCounts) showWiresIntro();
}

export function setColourBy(key: string, urlMode: UrlMode = "replace"): void {
  const c = ctx();
  c.colourBy = key;
  if (key === "parent") buildParentGroups();
  repaintWires();
  renderColourControls();
  renderLegend("wires");
  updateUrl(c.current, urlMode);
  if (key === "parent") showParentIntro();
  else if (isColourMeasure(key)) showColourMeasureIntro(key);
  else if (c.sizeBy === null && c.wiresCounts) showWiresIntro();
}

export function setShadeBy(key: string, urlMode: UrlMode = "replace"): void {
  const c = ctx();
  c.shadeBy = key;
  repaintRules();
  renderShadeControls();
  renderLegend("rules");
  updateUrl(c.current, urlMode);
  if (key === "bucket") showState("TX");
  else showPriceIntro(key);
}

// pick a storm basis (or any measure variant) for the active colour measure
export function setVariant(v: string): void {
  const c = ctx();
  c.variantOf[c.colourBy] = v;
  setColourBy(c.colourBy);
}

export function resetZoom(): void {
  animateViewBox(HOME_VIEW);
  setAtlasState({ zoomResetVisible: false });
}

// user-typed zip searches arrive here from the form; a search the reader
// typed is a navigation, so it earns a history entry
export function submitZip(zip: string): void {
  if (/^\d{5}$/.test(zip)) void findZip(zip, "push");
}

// A colour segment may carry a "-variant" suffix, as in saidi-all. Split on
// the last hyphen only, and only when the suffix names a real variant of the
// base, so a measure id containing a hyphen still resolves.
function splitColour(colour: string): { base: string; variant: string | null } {
  const cut = colour.lastIndexOf("-");
  if (cut > 0) {
    const base = colour.slice(0, cut);
    const variant = colour.slice(cut + 1);
    if (measureSpec(base)?.variants?.[variant] !== undefined) return { base, variant };
  }
  return { base: colour, variant: null };
}

// Drive the engine to match a parsed route. Called on every pathname change,
// including ones this engine wrote itself, so every step diffs before acting
// and writes nothing back to history.
export async function applyRoute(route: RouteState): Promise<void> {
  const c = ctx();
  if (route.trivia !== null) {
    if (!c.layerDrawn || c.current !== "wholesale") await setLayer("wholesale", "none");
    if (c.dead) return;
    flyToTrivia(route.trivia);
    return;
  }
  // Not just when the layer changes: on boot nothing has been drawn yet, and
  // the layer the route asks for is usually the one `current` already names.
  if (!c.layerDrawn || c.current !== route.layer) {
    await setLayer(route.layer, "none");
    // a later route may have superseded this one while wires inked
    if (c.dead || c.current !== route.layer) return;
  }
  if (route.layer === "rules" && route.shade !== c.shadeBy) {
    if (route.shade === "bucket" || c.priceScales[route.shade]) setShadeBy(route.shade, "none");
  }
  if (route.layer === "wires") {
    if (route.colour !== currentRoute("wires").colour) {
      const { base, variant } = splitColour(route.colour);
      if (base === "type" || base === "parent" || isColourMeasure(base)) {
        const variants = measureSpec(base)?.variants;
        if (variant !== null) c.variantOf[base] = variant;
        // a bare id means the default variant: reset so back/forward is honest
        else if (variants) c.variantOf[base] = req(Object.keys(variants)[0]);
        setColourBy(base, "none");
      }
    }
    if (route.size !== c.sizeBy) {
      if (route.size === null || c.cartogram?.measures[route.size]) setSizeBy(route.size, "none");
    }
  }
  if (route.layer === "history") {
    const id = resolveFrame(route.frame);
    if (id !== null && id !== c.frameId) setFrame(id, "none");
    if (route.evidence !== null) openEvidence(route.evidence);
  }
  if (route.layer === "you" && route.zip !== null && route.zip !== c.zip) {
    c.zipInput.value = route.zip;
    await findZip(route.zip, "none");
  }
}

// ---- history layer actions, called by the scrubber ----
// Every one of these is a reader action, so each stops any auto-advance first.
export function pickFrame(id: string): void {
  stopPlay();
  setFrame(id, "push");
}
export function walkFrame(delta: number): void {
  stopPlay();
  stepFrame(delta);
}
export function togglePlay(): void {
  const c = ctx();
  if (c.playTimer !== null) stopPlay();
  else startPlay();
}
export function openEvidenceCard(id: string): void {
  openEvidence(id);
}
export function showEventCard(id: string): void {
  showFrameEvent(id);
}
// The reader running a finger down the legend strip. Every key names marks on
// the plate; this is how the strip asks the map to show which. `null` on the
// way out.
export function hoverLegendKey(token: string | null): void {
  highlightLegend(token);
}

// A tap, a click, or Enter on a focused key: the reader asking the plate to
// keep showing this one while they look at the map. Tapping it again lets go.
//
// A reader action, so it stops the auto-advance first, for the same reason
// pickFrame and walkFrame do: holding a key and then watching the plate change
// out from under it seven seconds later is the timeline overruling a request.
export function toggleLegendPin(token: string): void {
  stopPlay();
  pinLegendKey(token);
}

// Escape, or a tap on something that is neither the strip nor the map.
export function releaseLegendPin(): void {
  clearLegendPin();
}

export function backToFrame(): void {
  const c = ctx();
  const f = c.timeline?.frames.find((x) => x.id === c.frameId);
  if (f) showFrame(f);
}
