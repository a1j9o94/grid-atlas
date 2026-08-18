// The three control groups as data. Option lists exist only once the lazy
// registries load, which is why the engine computes them rather than React.
import { copy, statePrices } from "../../lib/data";
import { setAtlasState, type ColourControlsModel, type ControlsModel } from "../../lib/store";
import { ctx } from "../ctx";
import { colourMeasures, isColourMeasure, measureSpec } from "../data";

export function renderShadeControls(): void {
  const c = ctx();
  const model: ControlsModel = {
    label: copy.controls.shade_label,
    options: statePrices.measures.map((m) => ({ key: m.id, label: m.label, pressed: c.shadeBy === m.id })),
  };
  setAtlasState({ shadeControls: model });
}

// size controls: land vs each magnitude measure, inside the wires layer so the
// four-step stack stays four steps.
export function renderSizeControls(): void {
  const c = ctx();
  if (!c.cartogram) return;
  const deck = copy.cartogram;
  const model: ControlsModel = {
    label: deck.toggle_label,
    options: [
      { key: "", label: deck.toggle_land, pressed: c.sizeBy === null },
      ...Object.keys(c.cartogram.measures).map((k) => ({
        key: k,
        label: deck.measures[k]?.label ?? k,
        pressed: c.sizeBy === k,
      })),
    ],
  };
  setAtlasState({ sizeControls: model });
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
  const options = [
    { key: "type", label: copy.controls.colour_type, pressed: c.colourBy === "type" },
    { key: "parent", label: copy.controls.colour_parent, pressed: c.colourBy === "parent" },
    ...colourMeasures().map((m) => ({
      key: m.id,
      label: copy.controls[`colour_${m.id}`] ?? m.label,
      pressed: c.colourBy === m.id,
    })),
  ];
  const active = isColourMeasure(c.colourBy) ? measureSpec(c.colourBy) : undefined;
  const model: ColourControlsModel = {
    label: copy.controls.colour_label,
    options,
    variants: active?.variants
      ? Object.entries(active.variants).map(([k, label]) => ({
          key: k,
          label,
          pressed: c.variantOf[c.colourBy] === k,
        }))
      : null,
  };
  setAtlasState({ colourControls: model });
}
