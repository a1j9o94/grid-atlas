// The legend as data: the engine computes a model on every repaint, because
// its content hangs off engine-owned lazy state (colour scales, parent
// groups); the Legend component renders whatever lands here.
import { copy, rules, statePrices, type LayerKey } from "../../lib/data";
import { fmtMeasure, titleCase } from "../../lib/format";
import { req } from "../../lib/assert";
import { setAtlasState, type LegendModel } from "../../lib/store";
import { NO_DATA, OTHER_PARENT, TRANSITION_SWATCH } from "../constants";
import { ctx } from "../ctx";
import { colourScale, isColourMeasure, measureSpec } from "../data";
import type { Scale } from "../scales";
import { WIRE_GROUPS } from "../wiregroups";
import { sizeLegendNote } from "../layers/wires";

// A sequential scale gets a stepped bar with the break values under it, not a
// list of swatches. The steps are quantiles, so the numbers are what separates
// them and the bar alone would not tell you where you are.
function ramp(scale: Scale, label: string, fmt: (v: number) => string, note?: string): LegendModel {
  return {
    kind: "ramp",
    label,
    steps: scale.ramp,
    ticks: scale.breaks.map(fmt),
    notReported: copy.controls.not_reported,
    ...(note !== undefined ? { note } : {}),
  };
}

export function renderLegend(key: LayerKey): void {
  const c = ctx();
  let legend: LegendModel | null = null;
  if (key === "wholesale") {
    legend = { kind: "swatches", items: [{ swatch: TRANSITION_SWATCH, label: "Changed grids in 2026" }] };
  } else if (key === "rules") {
    const scale = c.priceScales[c.shadeBy];
    if (c.shadeBy === "bucket" || !scale) {
      legend = {
        kind: "swatches",
        items: Object.values(rules.buckets).map((b) => ({ swatch: b.color, label: b.label })),
      };
    } else {
      const m = statePrices.measures.find((x) => x.id === c.shadeBy);
      const pct = c.shadeBy === "shopped";
      legend = ramp(scale, m?.short ?? m?.label ?? c.shadeBy,
        (v) => (pct ? `${String(Math.round(v * 100))}%` : v.toFixed(1)));
    }
  } else if (key === "wires") {
    const note = c.sizeBy !== null ? sizeLegendNote(c.sizeBy) : undefined;
    const scale = colourScale(c.colourBy);
    if (c.colourBy === "parent" && c.parentGroups) {
      const covered = [...c.parentGroups.values()].reduce((a, g) => a + g.meters, 0);
      const summary = `${String(c.parentGroups.size)} parent companies cover ${String(Math.round(covered / 1e6))} million meters, about half the country.`;
      legend = {
        kind: "swatches",
        items: [
          ...[...c.parentGroups.entries()].slice(0, 8).map(([name, g]) => ({ swatch: g.color, label: titleCase(name) })),
          { swatch: OTHER_PARENT, label: "Another parent company" },
          { swatch: NO_DATA, label: "Owned locally" },
        ],
        note: note !== undefined ? `${summary} ${note}` : summary,
      };
    } else if (isColourMeasure(c.colourBy) && scale) {
      const spec = req(measureSpec(c.colourBy));
      legend = ramp(scale, spec.short ?? spec.label, fmtMeasure(spec, true), note);
    } else {
      legend = {
        kind: "swatches",
        items: (Object.keys(WIRE_GROUPS) as (keyof typeof WIRE_GROUPS)[]).map((g) => ({
          swatch: WIRE_GROUPS[g].color,
          label: `${WIRE_GROUPS[g].label}${c.wiresCounts ? ` · ${c.wiresCounts[g].toLocaleString()}` : ""}`,
        })),
        ...(note !== undefined ? { note } : {}),
      };
    }
  }
  setAtlasState({ legend });
}
