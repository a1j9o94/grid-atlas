// The three control groups. Rendering only; the click handlers are delegated
// once in boot, so re-rendering the buttons never re-binds anything.
import { copy, statePrices } from "../../lib/data";
import { ctx } from "../ctx";
import { colourMeasures, isColourMeasure, measureSpec } from "../data";

export function renderShadeControls(): void {
  const c = ctx();
  c.shadeControls.innerHTML = `<span class="sz-label">${copy.controls.shade_label}</span>` +
    statePrices.measures.map((m) =>
      `<button class="sz-btn" data-shade="${m.id}" aria-pressed="${String(c.shadeBy === m.id)}">${m.label}</button>`).join("");
}

// size controls: land vs each magnitude measure, inside the wires layer so the
// four-step stack stays four steps.
export function renderSizeControls(): void {
  const c = ctx();
  if (!c.cartogram) return;
  const deck = copy.cartogram;
  const opts: [string | null, string][] = [
    [null, deck.toggle_land],
    ...Object.keys(c.cartogram.measures).map((k): [string, string] => [k, deck.measures[k]?.label ?? k]),
  ];
  c.sizeControls.innerHTML = `<span class="sz-label">${deck.toggle_label}</span>` + opts
    .map(([k, label]) =>
      `<button class="sz-btn" data-size="${k ?? ""}" aria-pressed="${String(c.sizeBy === k)}">${label}</button>`)
    .join("");
}

// colour controls: ownership, parent, or any colour measure. These are all
// attributes of the same territories, so they share the colour channel rather
// than each becoming a layer.
//
// Ownership and parent are read off the geometry. Everything else comes from
// the measure registry: any measure marked `colourOnly` becomes a button here
// without this file learning what it means. That is the whole point of the
// registry, and it is why rooftop solar and smart meters needed no new branches.
export function renderColourControls(): void {
  const c = ctx();
  const opts: [string, string][] = [
    ["type", copy.controls.colour_type],
    ["parent", copy.controls.colour_parent],
  ];
  for (const m of colourMeasures()) opts.push([m.id, copy.controls[`colour_${m.id}`] ?? m.label]);
  const active = isColourMeasure(c.colourBy) ? measureSpec(c.colourBy) : undefined;
  c.colourControls.innerHTML = `<span class="sz-label">${copy.controls.colour_label}</span>` +
    opts.map(([k, label]) => `<button class="sz-btn" data-colour="${k}" aria-pressed="${String(c.colourBy === k)}">${label}</button>`).join("") +
    (active?.variants
      ? `<span class="sz-sub">` + Object.entries(active.variants)
        .map(([k, label]) => `<button class="sz-btn sz-alt" data-variant="${k}" aria-pressed="${String(c.variantOf[c.colourBy] === k)}">${label}</button>`).join("") + `</span>`
      : "");
}
