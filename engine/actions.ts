// The four state-changing actions. Everything a control or the router does
// funnels through here, so the card, legend, controls, and URL stay in step.
import { req } from "../lib/assert";
import { copy, type LayerKey } from "../lib/data";
import { HOME_VIEW, READY } from "./constants";
import { ctx, setHidden } from "./ctx";
import { isColourMeasure } from "./data";
import { buildParentGroups, ensureWires, morphCircles, renderSizeKey, repaintWires } from "./layers/wires";
import { repaintRules } from "./layers/rules";
import { youBase } from "./layers/you";
import { animateViewBox } from "./viewbox";
import {
  showCartogramMeasureCard, showColourMeasureIntro, showFindYourself, showParentIntro,
  showPriceIntro, showRegion, showState, showWiresIntro,
} from "./ui/cards";
import { renderLegend } from "./ui/legend";
import { renderColourControls, renderShadeControls, renderSizeControls } from "./ui/controls";
import { renderRail } from "./ui/rail";
import { updateUrl } from "./urlstate";

export async function setLayer(key: LayerKey): Promise<void> {
  const c = ctx();
  const token = ++c.routeToken;
  c.current = key;
  renderRail((k) => { void setLayer(k); });
  const ready = READY.has(key);
  setHidden(c.card, !ready);
  setHidden(c.g.rto, key !== "wholesale");
  setHidden(c.g.transitions, key !== "wholesale");
  setHidden(c.g.labels, key !== "wholesale");
  setHidden(c.g.trivia, key !== "wholesale");
  setHidden(c.g.rules, key !== "rules");
  setHidden(c.g.wires, key !== "wires");
  setHidden(c.g.cartogram, key !== "wires" || c.sizeBy === null);
  setHidden(c.sizeControls, key !== "wires");
  setHidden(c.colourControls, key !== "wires");
  setHidden(c.shadeControls, key !== "rules");
  setHidden(c.g.you, key !== "you");
  setHidden(c.zipForm, key !== "you" && key !== "wires");
  setHidden(c.g.zipoutline, key !== "wires");
  setHidden(c.legend, key !== "wholesale" && key !== "rules" && key !== "wires");
  c.svg.classList.remove("has-hover");
  if (key !== "you") {
    animateViewBox(HOME_VIEW, 500);
    setHidden(c.zoomReset, true);
  }
  if (key === "you") {
    youBase();
    if (!c.g.you.querySelector("#g-zips")?.children.length) showFindYourself();
    setHidden(c.zoomReset, c.svg.getAttribute("viewBox") === HOME_VIEW.join(" "));
  }
  if (key === "wires" && !c.wiresFeatures) {
    setHidden(c.svg, true);
    setHidden(c.drawingNote, false);
    req(c.drawingNote.querySelector("p")).textContent = "Inking 2,907 utilities.";
    req(c.drawingNote.querySelector(".sub")).textContent = "One moment.";
    await ensureWires();
    // the reader may have moved on while 5.7MB of geometry inked
    if (c.dead || c.routeToken !== token) return;
    setHidden(c.g.wires, false);
  }
  setHidden(c.svg, !ready);
  setHidden(c.drawingNote, ready);
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
  if (key === "rules" && c.shadeBy !== "bucket") setShadeBy(c.shadeBy);
  if (key === "wires" && c.sizeBy === null && c.colourBy === "type") showWiresIntro();
  if (!ready) {
    req(c.drawingNote.querySelector("p")).textContent = `The ${copy.layers[key].title} layer is being inked.`;
    req(c.drawingNote.querySelector(".sub")).textContent =
      "It lands in the next update. Wholesale, Rules, and Wires are live now.";
  }
  updateUrl(key);
}

// Switch between the land map and a sized map. `key` is null for land.
export function setSizeBy(key: string | null): void {
  const c = ctx();
  c.sizeBy = key;
  setHidden(c.g.cartogram, c.current !== "wires");
  c.g.wires.classList.toggle("faded", key !== null);
  morphCircles(key);
  renderSizeKey(key);
  renderLegend(c.current);
  renderSizeControls();
  updateUrl(c.current);
  if (key !== null) showCartogramMeasureCard(key);
  else if (c.wiresCounts) showWiresIntro();
}

export function setColourBy(key: string): void {
  const c = ctx();
  c.colourBy = key;
  if (key === "parent") buildParentGroups();
  repaintWires();
  renderColourControls();
  renderLegend("wires");
  updateUrl(c.current);
  if (key === "parent") showParentIntro();
  else if (isColourMeasure(key)) showColourMeasureIntro(key);
  else if (c.sizeBy === null && c.wiresCounts) showWiresIntro();
}

export function setShadeBy(key: string): void {
  const c = ctx();
  c.shadeBy = key;
  repaintRules();
  renderShadeControls();
  renderLegend("rules");
  updateUrl(c.current);
  if (key === "bucket") showState("TX");
  else showPriceIntro(key);
}
