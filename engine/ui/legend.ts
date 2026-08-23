// The legend as data: the engine computes a model on every repaint, because
// its content hangs off engine-owned lazy state (colour scales, parent
// groups); the Legend component renders whatever lands here.
//
// Each key also carries a handle to the marks it names, so that pointing at it
// fades everything else on the plate. The handle is minted here, beside the row
// it belongs to, because this is the only file that knows what a row means.
import {
  copy, parseHoldingsTrace, rules, statePrices,
  type LayerKey, type TimelineFrame,
} from "../../lib/data";
import { fmtMeasure, titleCase } from "../../lib/format";
import { req } from "../../lib/assert";
import { setAtlasState, type LegendKey, type LegendModel } from "../../lib/store";
import {
  FILL, holdingColour, HOLDINGS_AMB_SWATCH, HOLDINGS_MAYBE_SWATCH,
  HOLDINGS_UNKNOWN_SWATCH, NO_DATA, OTHER_PARENT, swatchBackground, TRANSITION_SWATCH,
} from "../constants";
import { ctx, type GroupKey, type LegendTarget } from "../ctx";
import { colourScale, isColourMeasure, measureSpec } from "../data";
import { clearHighlights } from "../highlight";
import type { Scale } from "../scales";
import { WIRE_GROUPS } from "../wiregroups";
import { showMachine, showMarket, showRegion } from "./cards";
import { sizeLegendNote } from "../layers/wires";
import { shownHoldingsYear } from "../layers/history";

// ---- a key, and the marks it names ----
//
// What each plate draws, so a legend key can find it. This table is the whole
// registration a new plate owes the highlight: name the groups you draw into
// and the selector your marks answer to, and every key whose swatch is the
// colour you painted them lights them, with no highlight code of your own. A
// plate whose identity is something other than colour passes its own target at
// the row instead; a plate missing from this table gets an inert legend, and
// says so in development rather than failing quietly.
const PLATE_MARKS: Record<string, { groups: readonly GroupKey[]; family: string }> = {
  wholesale: { groups: ["rto"], family: ".region" },
  rules: { groups: ["rules"], family: ".region" },
  wires: { groups: ["wires", "cartogram"], family: ".region" },
  membership: { groups: ["membership"], family: ".region" },
  holdings: { groups: ["holdings"], family: ".holdings-county" },
  seam: { groups: ["seam"], family: ".sm-region" },
  dots: { groups: ["timeMarks"], family: ".tl-dot" },
};

// The palette read backwards. A membership row carries the same value the plate
// painted, so the value is enough to say which market the row is for.
const MARKET_BY_FILL = new Map(Object.entries(FILL).map(([k, v]) => [v, k]));

// The only characters that can end a quoted attribute value early. No fill in
// the atlas carries one, but they come out of data files, so escape anyway.
const q = (v: string): string => `"${v.replace(/["\\]/g, "\\$&")}"`;

interface KeyMint {
  // A row whose colour is its identity: the common case, and the whole reason
  // most plates need no highlight code. `fill` is the value written onto the
  // marks, which is the swatch except where an HTML swatch cannot say what the
  // SVG paints — SPP West's hatch is a pattern on the plate and a gradient on
  // the strip.
  row: (k: LegendKey, opts?: { fill?: string; describe?: () => void }) => LegendKey;
  step: (swatch: string) => { swatch: string; match?: string };
  // A row whose identity is not its colour: a hatch, a class, an attribute.
  custom: (k: LegendKey, t: LegendTarget) => LegendKey;
  // Narrow to some of this plate's own marks. An empty pick names all of them
  // and fades nothing, which is what a key like "a city with its own power
  // station" means when every mark on the plate is one.
  within: (pick: string) => LegendTarget;
}

// Tokens are minted per repaint, behind a generation. A pointer resting on the
// strip while the plate repaints holds a handle to marks that are no longer
// there, and it must resolve to nothing rather than to whatever key now sits at
// that index.
function beginKeys(plate: string | null): KeyMint {
  const c = ctx();
  clearHighlights();
  c.legendTargets.clear();
  const gen = ++c.legendGen;
  let n = 0;
  const marks = plate === null ? undefined : PLATE_MARKS[plate];
  let warned = false;
  // A key that names nothing on this plate is not a key. The membership plates
  // print "nobody running the traffic", and the geometry carries no shape for
  // it — it is a hole in the map, not a region — so that row renders as the
  // plain caption it is, with no cursor and no tab stop. The check happens here
  // rather than at hover time so the strip looks like what it can do, which is
  // also why the plates that fetch their geometry rebuild the strip when it
  // lands.
  const token = (t: LegendTarget): string | undefined => {
    if (!t.lit.some((x) => c.svg.querySelector(x) !== null)) return undefined;
    const id = `${String(gen)}.${String(n++)}`;
    c.legendTargets.set(id, t);
    return id;
  };
  // Group ids come off the scaffold rather than a second table here, so a group
  // is named in one place.
  const sel = (): string[] =>
    marks === undefined ? [] : marks.groups.map((k) => `#${c.g[k].id} ${marks.family}`);
  const within = (pick: string): LegendTarget => {
    const base = sel();
    if (pick === "") return { dim: [], lit: base };
    return { dim: base.map((x) => `${x}:not(${pick})`), lit: base.map((x) => x + pick) };
  };
  const byDefault = (swatch: string, describe?: () => void): string | undefined => {
    if (marks !== undefined) {
      const t = within(`[fill=${q(swatch)}]`);
      return token(describe === undefined ? t : { ...t, describe });
    }
    if (process.env.NODE_ENV !== "production" && !warned) {
      warned = true;
      console.warn(
        `legend: no PLATE_MARKS entry for "${plate ?? "(none)"}", so its keys cannot `
        + "highlight anything. Add one, or give each row its own target.",
      );
    }
    return undefined;
  };
  return {
    within,
    custom: (k, t) => {
      const m = token(t);
      return m === undefined ? k : { ...k, match: m };
    },
    row: (k, opts) => {
      const m = byDefault(opts?.fill ?? k.swatch, opts?.describe);
      return m === undefined ? k : { ...k, match: m };
    },
    step: (swatch) => {
      const m = byDefault(swatch);
      return m === undefined ? { swatch } : { swatch, match: m };
    },
  };
}

// The systems the reader is actually looking at, named. This used to list five confidence
// states and no company at all, while the counties underneath were coloured by company, so
// a reader saw twenty-odd hues explained as though they meant certainty. Name the systems
// that cover ground, in the order they cover it, and keep the states that are not a system
// at the end where they belong.
function holdingsLegend(keys: KeyMint): LegendModel | null {
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
  // A county wears its rolled-up system as an attribute, set by the same
  // rollup this tally uses. That is what keeps the lit count honest: if the two
  // ever read the key differently, "Insull · 412" would light some other number
  // of counties than it prints.
  const bySys = (sys: string): LegendTarget => keys.within(`[data-sys=${q(sys)}]`);
  const items = ranked.slice(0, SHOWN).map(([sys, count]) => keys.custom({
    swatch: holdingColour(sys, rollup) ?? NO_DATA,
    label: `${short(labels[sys]?.printed_label ?? titleCase(sys.replace(/-/g, " ")))} `
      + `· ${String(count)}`,
  }, bySys(sys)));
  const tail = ranked.slice(SHOWN);
  if (tail.length > 0) {
    const rest = tail.reduce((a, [, v]) => a + v, 0);
    items.push(keys.custom({
      swatch: NO_DATA,
      label: `${String(tail.length)} smaller systems · ${String(rest)}`,
    }, keys.within(`:is(${tail.map(([sys]) => `[data-sys=${q(sys)}]`).join(",")})`)));
  }
  // Confidence is a class on the county, not a colour, because the source plate
  // is monochrome and the hatch is what the reading could not settle.
  const byStatus = (status: string): LegendTarget => keys.within(`.holdings-${status}`);
  if (maybe > 0) {
    items.push(keys.custom(
      { swatch: HOLDINGS_MAYBE_SWATCH, label: "Possible, not defended" }, byStatus("maybe")));
  }
  if (amb > 0) {
    items.push(keys.custom(
      { swatch: HOLDINGS_AMB_SWATCH, label: "Two candidates" }, byStatus("amb")));
  }
  if (unknown > 0) {
    items.push(keys.custom(
      { swatch: HOLDINGS_UNKNOWN_SWATCH, label: "Filled, system unreadable" }, byStatus("unknown")));
  }
  if (none > 0) {
    items.push(keys.custom({ swatch: "#e4e7db", label: "No county fill" }, byStatus("none")));
  }
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
// them and the bar alone would not tell you where you are. Each band is its own
// key: `Scale.of` puts a value on exactly one step, so pointing at a band shows
// precisely the marks in that quantile.
function ramp(
  keys: KeyMint, scale: Scale, label: string, fmt: (v: number) => string, note?: string,
): LegendModel {
  const ticks = scale.breaks.map(fmt);
  // A band is a bare colour, so it says out loud what it stands for. The breaks
  // sit between the steps, which is why the ends read as open-ended: the scale
  // knows where a quantile starts, not where the data does.
  const band = (i: number): string => {
    const lo = ticks[i - 1];
    const hi = ticks[i];
    if (lo === undefined) return `${label}, under ${hi ?? ""}`;
    if (hi === undefined) return `${label}, ${lo} and up`;
    return `${label}, ${lo} to ${hi}`;
  };
  return {
    kind: "ramp",
    label,
    steps: scale.ramp.map((c, i) => ({ ...keys.step(c), label: band(i) })),
    ticks,
    notReported: keys.row({ swatch: NO_DATA, label: copy.controls.not_reported }),
    ...(note !== undefined ? { note } : {}),
  };
}

// The territories that changed grids, drawn as a hatch over the regions they
// left. The hatch is an SVG pattern, so the strip's swatch is a CSS gradient
// standing in for it and cannot be matched by colour: the key names the group.
function transitionKey(keys: KeyMint): LegendKey {
  return keys.custom(
    { swatch: TRANSITION_SWATCH, label: "Changed grids in 2026" },
    { dim: [`#${ctx().g.rto.id} .region`], lit: [`#${ctx().g.transitions.id} .region`] },
  );
}

// The markets themselves, which the plate names in text on the map and the
// strip did not name at all. Biggest first, so the list reads in the order the
// eye takes the country, and the hatch that says what changed reads last.
function wholesaleLegend(keys: KeyMint): LegendModel {
  const c = ctx();
  const named = c.rtosFC.features
    .map((f) => ({ rto: f.properties.RTO, area: c.path.area(f) }))
    .sort((a, b) => b.area - a.area)
    .map(({ rto }) => keys.row(
      { swatch: swatchBackground(rto), label: copy.regions[rto]?.name ?? rto },
      {
        // SPP West is a pattern on the plate and a gradient on the strip, so the
        // marks are found by what they were painted, not by what the swatch shows.
        fill: FILL[rto] ?? "#ccc",
        describe: () => { showRegion(rto); },
      },
    ));
  return { kind: "swatches", items: [...named, transitionKey(keys)] };
}

// The colour rows on a seam plate name machines, and a machine is an attribute
// rather than a fill: the three take their colour from CSS so that the plate
// where East and West ran in step can repaint one of them without touching the
// geometry. That plate also prints one row for two machines, so the row has to
// name both.
const SEAM_IC: Record<string, string> = {
  "var(--sm-east)": "EASTERN", "var(--sm-west)": "WESTERN", "var(--r-ercot)": "ERCOT",
};

function seamTarget(keys: KeyMint, f: TimelineFrame, swatch: string): LegendTarget | undefined {
  const ic = SEAM_IC[swatch];
  if (ic === undefined) return undefined;
  const unified = f.geometry.unified === true;
  return {
    ...keys.within(
      unified && ic === "EASTERN"
        ? ':is([data-ic="EASTERN"],[data-ic="WESTERN"])'
        : `[data-ic=${q(ic)}]`,
    ),
    // The row that stands for two machines describes the Eastern one; the card
    // counts them off the frame, so on that plate it says "one of two" itself.
    describe: () => { showMachine(ic); },
  };
}

// The seam itself is a line, not a region, so its key fades the machines and
// lights the rule between them. On the plate where the divide closed, the row
// names that one boundary; on the others it names the boundary the plate is
// about, and both lines are the same subject.
function seamLineTarget(shape: "line" | "line-ghost"): LegendTarget {
  const c = ctx();
  const lines = `#${c.g.seamLines.id} .sm-line`;
  const pick = shape === "line-ghost" ? '[data-seam="ew"]' : "";
  return pick === ""
    ? { dim: [`#${c.g.seam.id} .sm-region`], lit: [lines] }
    : { dim: [`#${c.g.seam.id} .sm-region`, `${lines}:not(${pick})`], lit: [lines + pick] };
}

// A plate whose legend is written into the artifact rather than computed. The
// swatch is either a colour the marks were painted, or one of four sentinels
// naming a shape: a lamp for the dot plates, a rule for the seam.
function frameLegend(keys: KeyMint, f: TimelineFrame | undefined): LegendModel {
  const kind = f?.geometry.kind;
  const items = (f?.legend ?? []).map((it) => {
    if (it.swatch === "dot" || it.swatch === "dot-story") {
      const story = it.swatch === "dot-story";
      return keys.custom(
        {
          swatch: story ? "#fff3cd" : "#f6e3ae",
          label: it.label,
          shape: story ? ("dot-story" as const) : ("dot" as const),
        },
        // Every lamp on the plate is a city with its own station, so that key
        // fades nothing and turns the constellation up instead.
        keys.within(story ? ".tl-dot-story" : ""),
      );
    }
    if (it.swatch === "line" || it.swatch === "line-ghost") {
      return keys.custom(
        { swatch: "transparent", label: it.label, shape: it.swatch },
        seamLineTarget(it.swatch),
      );
    }
    const key = { swatch: it.swatch, label: it.label };
    if (kind === "seam" && f !== undefined) {
      const t = seamTarget(keys, f, it.swatch);
      return t === undefined ? key : keys.custom(key, t);
    }
    // Market footprints are painted from the same palette the swatch names, so
    // the default finds them, and the same palette says which market it is. A
    // market with no shape on this plate — "nobody running the traffic" is a
    // hole in the map, not a region — mints a key that lights nothing, and the
    // strip renders it inert.
    const market = MARKET_BY_FILL.get(it.swatch);
    return keys.row(key, market === undefined ? {} : { describe: () => { showMarket(market); } });
  });
  return {
    kind: "swatches",
    items,
    ...(f?.ship === false ? { note: "This plate is still being inked." } : {}),
  };
}

// Which plate is on the easel, in the terms PLATE_MARKS is written in. The
// history layer draws a different plate at every stop, so the layer key alone
// does not say what marks are on the paper.
function plateKind(key: LayerKey, f: TimelineFrame | undefined): string | null {
  if (key !== "history") return key;
  const kind = f?.geometry.kind;
  if (kind === undefined) return null;
  if (kind === "current") return "wholesale";
  if (kind === "dots+tints") return "dots";
  return kind;
}

export function renderLegend(key: LayerKey): void {
  const c = ctx();
  const frame = key === "history" ? c.timeline?.frames.find((x) => x.id === c.frameId) : undefined;
  const keys = beginKeys(plateKind(key, frame));
  let legend: LegendModel | null = null;
  if (key === "wholesale") {
    legend = wholesaleLegend(keys);
  } else if (key === "rules") {
    const scale = c.priceScales[c.shadeBy];
    if (c.shadeBy === "bucket" || !scale) {
      legend = {
        kind: "swatches",
        items: Object.values(rules.buckets).map((b) => keys.row({ swatch: b.color, label: b.label })),
      };
    } else {
      const m = statePrices.measures.find((x) => x.id === c.shadeBy);
      const pct = c.shadeBy === "shopped";
      legend = ramp(keys, scale, m?.short ?? m?.label ?? c.shadeBy,
        (v) => (pct ? `${String(Math.round(v * 100))}%` : v.toFixed(1)));
    }
  } else if (key === "history") {
    // The last plate IS the wholesale layer, so it borrows that legend rather
    // than describing the same marks in different words.
    if (frame?.geometry.kind === "current") {
      legend = wholesaleLegend(keys);
    } else if (frame?.geometry.kind === "holdings") {
      legend = holdingsLegend(keys) ?? {
        kind: "swatches",
        items: [{ swatch: HOLDINGS_UNKNOWN_SWATCH, label: "Loading the trace" }],
      };
    } else {
      legend = frameLegend(keys, frame);
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
          ...[...c.parentGroups.entries()].slice(0, 8).map(([name, g]) =>
            keys.row({ swatch: g.color, label: titleCase(name) })),
          keys.row({ swatch: OTHER_PARENT, label: "Another parent company" }),
          keys.row({ swatch: NO_DATA, label: "Owned locally" }),
        ],
        note: note !== undefined ? `${summary} ${note}` : summary,
      };
    } else if (isColourMeasure(c.colourBy) && scale) {
      const spec = req(measureSpec(c.colourBy));
      legend = ramp(keys, scale, spec.short ?? spec.label, fmtMeasure(spec, true), note);
    } else {
      legend = {
        kind: "swatches",
        items: (Object.keys(WIRE_GROUPS) as (keyof typeof WIRE_GROUPS)[]).map((g) => keys.row({
          swatch: WIRE_GROUPS[g].color,
          label: `${WIRE_GROUPS[g].label}${c.wiresCounts ? ` · ${c.wiresCounts[g].toLocaleString()}` : ""}`,
        })),
        ...(note !== undefined ? { note } : {}),
      };
    }
  }
  setAtlasState({ legend });
}
