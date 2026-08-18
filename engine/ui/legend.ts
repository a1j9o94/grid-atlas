// legend (content depends on layer)
import { copy, statePrices, type LayerKey } from "../../lib/data";
import { fmtMeasure, titleCase } from "../../lib/format";
import { req } from "../../lib/assert";
import { NO_DATA, OTHER_PARENT, TRANSITION_SWATCH } from "../constants";
import { ctx } from "../ctx";
import { colourScale, isColourMeasure, measureSpec } from "../data";
import { rules } from "../../lib/data";
import type { Scale } from "../scales";
import { WIRE_GROUPS } from "../wiregroups";
import { sizeLegendNote } from "../layers/wires";

// A sequential scale gets a stepped bar with the break values under it, not a
// list of swatches. The steps are quantiles, so the numbers are what separates
// them and the bar alone would not tell you where you are.
function rampLegend(scale: Scale, label: string, fmt: (v: number) => string = (v) => v.toFixed(1)): string {
  const cells = scale.ramp.map((c) => `<span class="lg-step" style="background:${c}"></span>`).join("");
  const marks = scale.breaks.map((b) => `<span class="lg-tick">${fmt(b)}</span>`).join("");
  return `<span class="lg-ramp"><span class="lg-ramp-label">${label}</span>` +
    `<span class="lg-bar">${cells}</span><span class="lg-ticks">${marks}</span></span>` +
    `<span class="lg-item"><span class="lg-swatch" style="background:${NO_DATA}"></span>${copy.controls.not_reported}</span>`;
}

export function renderLegend(key: LayerKey): void {
  const c = ctx();
  const legend = c.legend;
  if (key === "wholesale") {
    legend.innerHTML = `<span class="lg-item"><span class="lg-swatch" style="${TRANSITION_SWATCH}"></span>Changed grids in 2026</span>`;
  } else if (key === "rules") {
    const scale = c.priceScales[c.shadeBy];
    if (c.shadeBy === "bucket" || !scale) {
      legend.innerHTML = Object.values(rules.buckets)
        .map((b) => `<span class="lg-item"><span class="lg-swatch" style="background:${b.color}"></span>${b.label}</span>`)
        .join("");
    } else {
      const m = statePrices.measures.find((x) => x.id === c.shadeBy);
      const pct = c.shadeBy === "shopped";
      legend.innerHTML = rampLegend(scale, m?.short ?? m?.label ?? c.shadeBy,
        (v) => (pct ? `${String(Math.round(v * 100))}%` : v.toFixed(1)));
    }
  } else if (key === "wires") {
    let base: string;
    const scale = colourScale(c.colourBy);
    if (c.colourBy === "parent" && c.parentGroups) {
      const shown = [...c.parentGroups.entries()].slice(0, 8);
      const covered = [...c.parentGroups.values()].reduce((a, g) => a + g.meters, 0);
      base = shown.map(([name, g]) =>
        `<span class="lg-item"><span class="lg-swatch" style="background:${g.color}"></span>${titleCase(name)}</span>`).join("") +
        `<span class="lg-item"><span class="lg-swatch" style="background:${OTHER_PARENT}"></span>Another parent company</span>` +
        `<span class="lg-item"><span class="lg-swatch" style="background:${NO_DATA}"></span>Owned locally</span>` +
        `<span class="lg-size">${String(c.parentGroups.size)} parent companies cover ${String(Math.round(covered / 1e6))} million meters, about half the country.</span>`;
    } else if (isColourMeasure(c.colourBy) && scale) {
      const spec = req(measureSpec(c.colourBy));
      base = rampLegend(scale, spec.short ?? spec.label, fmtMeasure(spec, true));
    } else {
      base = (Object.entries(WIRE_GROUPS) as [keyof typeof WIRE_GROUPS, typeof WIRE_GROUPS.iou][])
        .map(([g, w]) => `<span class="lg-item"><span class="lg-swatch" style="background:${w.color}"></span>${w.label}${c.wiresCounts ? ` · ${c.wiresCounts[g].toLocaleString()}` : ""}</span>`)
        .join("");
    }
    legend.innerHTML = base + (c.sizeBy !== null ? sizeLegendNote(c.sizeBy) : "");
  }
}
