// Server-side registry reads: which measure ids, shades, sizes, and trivia
// actually exist. Imported only from server code (the catch-all page and the
// proxy), so the 695KB measures file never reaches the client bundle — the
// client keeps lazily fetching it as data.
//
// Everything here reads the registries, never a hardcoded list: a new measure
// in measures.json becomes a valid, prerendered, titled route by existing.
import measuresJson from "../public/data/measures.json";
import cartogramJson from "../public/data/cartogram.json";
import timelineJson from "../public/data/timeline.json";
import {
  copy, statePrices,
  type CartogramFile, type MeasureSpec, type MeasuresFile, type TimelineFile,
} from "./data";
import type { RouteState } from "./route";

const measures = measuresJson as unknown as MeasuresFile;
const cartogram = cartogramJson as unknown as CartogramFile;

const shadeIds = statePrices.measures.filter((m) => m.kind === "sequential").map((m) => m.id);
const sizeIds = Object.keys(cartogram.measures);
const colourSpecs = measures.measures.filter((m) => m.colourOnly);
const triviaById = new Map(copy.trivia.map((t) => [t.id, t]));
const timeline = timelineJson as unknown as TimelineFile;
const frameById = new Map(timeline.frames.map((f) => [f.id, f]));
const evidenceIds = new Set(Object.keys(timeline.evidence));

interface ColourParts {
  spec?: MeasureSpec;
  variant?: string;
}

// Resolve a colour path segment: "parent", a colourOnly measure id, or an
// id-variant pair split on the last hyphen (saidi-all).
function resolveColour(seg: string): ColourParts | null {
  if (seg === "parent") return {};
  const direct = colourSpecs.find((m) => m.id === seg);
  if (direct) return { spec: direct };
  const cut = seg.lastIndexOf("-");
  if (cut > 0) {
    const base = colourSpecs.find((m) => m.id === seg.slice(0, cut));
    const variant = seg.slice(cut + 1);
    if (base?.variants?.[variant] !== undefined) return { spec: base, variant };
  }
  return null;
}

export function isValidRoute(r: RouteState): boolean {
  if (r.trivia !== null) return triviaById.has(r.trivia);
  if (r.layer === "history") {
    // A known plate is valid. So is any bare four-digit year, because the
    // client snaps one to the nearest plate at or before it: /then/1941 was a
    // real link before that plate moved to 1935, and it should still land
    // somewhere honest rather than 404. Anything else is junk.
    if (r.frame !== null && !frameById.has(r.frame) && !/^\d{4}$/.test(r.frame)) return false;
    if (r.evidence !== null && !evidenceIds.has(r.evidence)) return false;
    return true;
  }
  if (r.layer === "rules" && r.shade !== "bucket") return shadeIds.includes(r.shade);
  if (r.layer === "wires") {
    if (r.colour !== "type" && resolveColour(r.colour) === null) return false;
    if (r.size !== null && !sizeIds.includes(r.size)) return false;
  }
  return true;
}

// Every enumerable route, for prerendering. Zips stay dynamic: forty
// thousand of them is not a build target.
export function staticViewParams(): { view: string[] }[] {
  const views: string[][] = [[], ["rules"], ["wires"], ["you"]];
  for (const s of shadeIds) views.push(["rules", s]);
  const colours = ["parent", ...colourSpecs.flatMap((m) => [
    m.id,
    // the default variant stays off the URL; only the others are routes
    ...Object.keys(m.variants ?? {}).slice(1).map((v) => `${m.id}-${v}`),
  ])];
  for (const c of colours) views.push(["wires", c]);
  for (const s of sizeIds) views.push(["wires", `by-${s}`]);
  for (const c of colours) for (const s of sizeIds) views.push(["wires", c, `by-${s}`]);
  for (const t of copy.trivia) views.push(["trivia", t.id]);
  // The plates enumerate themselves, so a tenth one becomes a prerendered
  // titled route by existing in timeline.json. Retired years and evidence
  // sub-paths stay dynamic: they are valid but not worth a build target.
  views.push(["then"]);
  for (const f of timeline.frames) views.push(["then", f.id]);
  return views.map((view) => ({ view }));
}

const SITE = "How your electricity works";

function trimBody(body: string, max = 200): string {
  if (body.length <= max) return body;
  const cut = body.lastIndexOf(" ", max - 1);
  return body.slice(0, cut > 0 ? cut : max - 1) + "…";
}

export function describeRoute(r: RouteState): { title?: string; description?: string } {
  if (r.trivia !== null) {
    const t = triviaById.get(r.trivia);
    if (!t) return {};
    return { title: `${t.title} · ${SITE}`, description: trimBody(t.body) };
  }
  if (r.layer === "wholesale") return {};
  if (r.layer === "rules") {
    if (r.shade !== "bucket") {
      const m = statePrices.measures.find((x) => x.id === r.shade);
      if (m) return { title: `${m.label} · ${SITE}`, description: m.note ?? copy.layers.rules.explainer };
    }
    return { title: `${copy.layers.rules.title} · ${SITE}`, description: copy.layers.rules.explainer };
  }
  if (r.layer === "history") {
    const f = r.frame !== null ? frameById.get(r.frame) : timeline.frames[0];
    if (f) return { title: `${f.title} · ${f.label} · ${SITE}`, description: trimBody(f.body) };
    return { title: `${copy.layers.history.title} · ${SITE}`, description: copy.layers.history.explainer };
  }
  if (r.layer === "you") {
    if (r.zip !== null)
      return { title: `Zip ${r.zip} in the stack · ${SITE}`, description: copy.layers.you.explainer };
    return { title: `${copy.layers.you.title} · ${SITE}`, description: copy.layers.you.explainer };
  }
  // wires: name the colour channel first, the size channel as a qualifier
  const parts: string[] = [];
  if (r.colour === "parent") parts.push(copy.controls.colour_parent);
  else if (r.colour !== "type") {
    const resolved = resolveColour(r.colour);
    if (resolved?.spec) {
      const variantLabel = resolved.variant !== undefined ? resolved.spec.variants?.[resolved.variant] : undefined;
      parts.push(variantLabel !== undefined ? `${resolved.spec.label} (${variantLabel.toLowerCase()})` : resolved.spec.label);
    }
  }
  if (r.size !== null) {
    const label = copy.cartogram.measures[r.size]?.label;
    if (label !== undefined) parts.push(`drawn by ${label.toLowerCase()}`);
  }
  if (parts.length === 0) return { title: `${copy.layers.wires.title} · ${SITE}`, description: copy.layers.wires.explainer };
  const colourDesc = r.colour !== "type" && r.colour !== "parent"
    ? resolveColour(r.colour)?.spec?.note
    : undefined;
  return {
    title: `${parts.join(", ")} · ${SITE}`,
    description: colourDesc ?? copy.layers.wires.explainer,
  };
}
