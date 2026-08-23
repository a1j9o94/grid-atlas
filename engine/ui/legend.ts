// The legend as data: the engine computes a model on every repaint, because
// its content hangs off engine-owned lazy state (colour scales, parent
// groups); the Legend component renders whatever lands here.
import { copy, parseHoldingsTrace, rules, statePrices, type LayerKey } from "../../lib/data";
import { fmtMeasure, titleCase } from "../../lib/format";
import { req } from "../../lib/assert";
import { setAtlasState, type LegendModel } from "../../lib/store";
import {
  holdingColour, HOLDINGS_AMB_SWATCH, HOLDINGS_MAYBE_SWATCH,
  HOLDINGS_UNKNOWN_SWATCH, NO_DATA, OTHER_PARENT, TRANSITION_SWATCH,
} from "../constants";
import { ctx } from "../ctx";
import { colourScale, isColourMeasure, measureSpec } from "../data";
import type { Scale } from "../scales";
import { WIRE_GROUPS } from "../wiregroups";
import { sizeLegendNote } from "../layers/wires";
import { shownHoldingsYear } from "../layers/history";

// The systems the reader is actually looking at, named. This used to list five confidence
// states and no company at all, while the counties underneath were coloured by company, so
// a reader saw twenty-odd hues explained as though they meant certainty. Name the systems
// that cover ground, in the order they cover it, and keep the states that are not a system
// at the end where they belong.
function holdingsLegend(): LegendModel | null {
  const c = ctx();
  const h = c.holdings;
  if (!h) return null;
  const year = shownHoldingsYear();
  if (year === undefined) return null;
  const rows = h.trace.years[year];
  if (rows === undefined) return null;
  const rollup = h.trace.key_rollup?.[year];
  const labels = h.trace.legends[year] ?? {};

  // Count by the system a key rolls up to, so Map IV's two Insull cells count as Insull
  // and the two sheets can be read side by side.
  const n = new Map<string, number>();
  let maybe = 0, amb = 0, unknown = 0, none = 0;
  for (const raw of Object.values(rows)) {
    const p = parseHoldingsTrace(raw);
    if (p.status === "none") { none++; continue; }
    if (p.status === "unknown") { unknown++; continue; }
    if (p.status === "maybe") maybe++;
    if (p.status === "amb") amb++;
    const key = p.groups[0];
    if (key === undefined) continue;
    const sys = rollup?.[key] ?? key;
    // An uncertain county is counted toward its leading candidate for ordering only. It
    // is not drawn as a confident one: the hatch swatches below say what it is.
    n.set(sys, (n.get(sys) ?? 0) + 1);
  }
  // The plate prints "United Corporation, (The)" and "American Water Works & Electric
  // Co.,(The)". The article is how a 1935 government printer alphabetised a company name
  // and it tells a reader nothing, while the length clips the count off the end of the
  // row. The county card still shows the printed name in full.
  const short = (t: string): string =>
    t.replace(/,?\s*\(The\)\s*$/i, "").replace(/,\s*$/, "").trim();
  const ranked = [...n.entries()].sort((a, b) => b[1] - a[1]);
  const SHOWN = 10;
  const items = ranked.slice(0, SHOWN).map(([sys, count]) => ({
    swatch: holdingColour(sys, rollup) ?? NO_DATA,
    label: `${short(labels[sys]?.printed_label ?? titleCase(sys.replace(/-/g, " ")))} `
      + `· ${String(count)}`,
  }));
  const tail = ranked.slice(SHOWN);
  if (tail.length > 0) {
    const rest = tail.reduce((a, [, v]) => a + v, 0);
    items.push({
      swatch: NO_DATA,
      label: `${String(tail.length)} smaller systems · ${String(rest)}`,
    });
  }
  if (maybe > 0) items.push({ swatch: HOLDINGS_MAYBE_SWATCH, label: "Possible, not defended" });
  if (amb > 0) items.push({ swatch: HOLDINGS_AMB_SWATCH, label: "Two candidates" });
  if (unknown > 0) {
    items.push({ swatch: HOLDINGS_UNKNOWN_SWATCH, label: "Filled, system unreadable" });
  }
  if (none > 0) items.push({ swatch: "#e4e7db", label: "No county fill" });
  return {
    kind: "swatches",
    items,
    note: "Counts are counties on this sheet. Colour separates systems; the FTC plate is "
      + "monochrome, and the hatch swatches mark counties the engraving does not settle. "
      + "Click a county for the printed name, the operating company where the plate names "
      + "one, and how sure the reading is.",
  };
}

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
  } else if (key === "history") {
    const f = c.timeline?.frames.find((x) => x.id === c.frameId);
    // The last plate IS the wholesale layer, so it borrows that legend rather
    // than describing the same marks in different words.
    if (f?.geometry.kind === "current") {
      legend = { kind: "swatches", items: [{ swatch: TRANSITION_SWATCH, label: "Changed grids in 2026" }] };
    } else if (f?.geometry.kind === "holdings") {
      legend = holdingsLegend() ?? {
        kind: "swatches",
        items: [{ swatch: HOLDINGS_UNKNOWN_SWATCH, label: "Loading the trace" }],
      };
    } else {
      legend = {
        kind: "swatches",
        // A swatch value that names a shape rather than a colour: a lamp for
        // the dot plates, a rule for the seam. The seam entry matters because
        // on the 1975 plate that line is the heaviest mark on the map and the
        // whole point of the plate.
        items: (f?.legend ?? []).map((it) =>
          it.swatch === "dot"
            ? { swatch: "#f6e3ae", label: it.label, shape: "dot" as const }
            : it.swatch === "dot-story"
              ? { swatch: "#fff3cd", label: it.label, shape: "dot-story" as const }
              : it.swatch === "line" || it.swatch === "line-ghost"
                ? { swatch: "transparent", label: it.label, shape: it.swatch }
                : { swatch: it.swatch, label: it.label }),
        ...(f?.ship === false ? { note: "This plate is still being inked." } : {}),
      };
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
