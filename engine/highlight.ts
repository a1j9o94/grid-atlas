// ---- what the plate emphasises, and the two ways a reader asks for it ----
//
// Pointing at the map lifts one region and drops the rest. Pointing at a legend
// key does the same thing from the other end: fade everything the key does not
// name. Both live here, together, because the clearing is the part that rots:
// it used to be written out in hover's mouseleave and again in setLayer, and a
// second highlight mechanism with its own third copy would guarantee a fourth.
//
// The two are never on at once. Each entry point clears the other, except for
// a pinned key: a reader who asked the plate to keep showing one is looking at
// the map next, and the map yields rather than argues with it.
import { setAtlasState } from "../lib/store";
import { maybeCtx, type LegendTarget } from "./ctx";

// Whether the reader has asked the plate to hold a legend key. While they have,
// the map still names what you point at but stops re-dimming underneath it: two
// explanations at once is one too many.
export function legendPinned(): boolean {
  return maybeCtx()?.legendPin != null;
}

// Map hover: the reader is pointing at the marks themselves, so the marks carry
// the state as a class. Moved here verbatim from hover.ts.
export function setHover(group: SVGGElement, match: (p: SVGElement) => boolean): void {
  const c = maybeCtx();
  if (!c) return;
  // A held key is the reader's own question. The map answers it in the card and
  // leaves the dimming alone.
  if (c.legendPin !== null) return;
  c.svg.classList.add("has-hover");
  for (const p of group.children) {
    const el = p as SVGElement;
    el.classList.toggle("hov", match(el));
  }
}

// Every group whose children can wear `hov`. A list rather than the three the
// map hover happens to touch today, so a highlight raised by the legend on a
// history plate is cleared when the pointer comes back to the map.
const HOVER_GROUPS = [
  "rto", "transitions", "rules", "wires", "cartogram",
  "holdings", "seam", "seamLines", "membership", "timeMarks",
] as const;

export function clearMapHover(): void {
  const c = maybeCtx();
  if (!c) return;
  c.svg.classList.remove("has-hover");
  for (const key of HOVER_GROUPS)
    for (const p of c.g[key].children) p.classList.remove("hov");
  if (c.hoveredWire) {
    c.hoveredWire.classList.remove("hov");
    c.hoveredWire = null;
  }
}

// Drop the preview only. What the reader pinned stays, which is what makes the
// pin worth having: they can look at the map without losing the key.
export function clearLegendHover(): void {
  const c = maybeCtx();
  if (!c) return;
  if (c.legendHover === null) return;
  c.legendHover = null;
  paint();
}

export function clearLegendPin(): void {
  const c = maybeCtx();
  if (!c) return;
  c.legendPin = null;
  setAtlasState({ legendPin: null });
  paint();
}

// Layer changes, repaints and teardown all want everything gone.
export function clearHighlights(): void {
  clearMapHover();
  const c = maybeCtx();
  if (c) c.legendHover = null;
  clearLegendPin();
}

const scope = (sels: readonly string[]): string =>
  sels.map((s) => `svg#map.has-legend-hover ${s}`).join(",");

// The reader's pointer entering or leaving a key on the legend strip. `null`
// clears.
//
// The rule fades with fill-opacity rather than opacity on purpose. `opacity`
// isolates every element it touches into its own compositing layer, which is
// exactly why the wires branch of the map hover refuses to set `has-hover` at
// all: there are 2,907 territories and as many circles on that plate. Paint
// alpha costs nothing at that count and looks the same on these marks.
//
// The lit rule does not write fill-opacity back to 1. A `maybe` county carries
// 0.62 as a confidence signal, and lit marks are simply absent from the dim
// selector, so they keep whatever paint they were drawn with.
export function highlightLegend(token: string | null): void {
  const c = maybeCtx();
  if (!c) return;
  c.legendHover = token;
  paint();
}

// A tap, or Enter on a focused key. Tapping the key that is already held lets
// it go — and drops the preview with it, because a finger raises no mouseleave
// and the key would otherwise stay lit under a finger that had gone.
export function pinLegendKey(token: string): void {
  const c = maybeCtx();
  if (!c) return;
  if (c.legendPin === token) {
    c.legendHover = null;
    clearLegendPin();
    return;
  }
  c.legendPin = token;
  setAtlasState({ legendPin: token });
  paint();
}

// The one place the rule is written. What the plate shows is the preview if
// there is one, otherwise the pin, otherwise nothing.
function paint(): void {
  const c = maybeCtx();
  if (!c) return;
  const token = c.legendHover ?? c.legendPin;
  const t = token === null ? undefined : c.legendTargets.get(token);
  if (!t || !lights(t)) {
    // A pin outlives the pointer, so it is the handle most likely to be left
    // holding marks that are gone. Drop it rather than leave the map's own
    // hover switched off with nothing on screen to say why.
    if (c.legendPin !== null) {
      c.legendPin = null;
      setAtlasState({ legendPin: null });
    }
    c.legendStyle.textContent = "";
    c.svg.classList.remove("has-legend-hover");
    return;
  }
  // The map's own highlight and a legend key are two explanations of the same
  // marks, so the newer one wins. A pin is the exception, handled in setHover.
  clearMapHover();
  c.legendStyle.textContent =
    (t.dim.length > 0
      ? `${scope(t.dim)}{fill-opacity:var(--lh-dim,0.28);stroke-opacity:var(--lh-dim,0.28)}`
      : "") +
    (t.lit.length > 0 ? `${scope(t.lit)}{filter:var(--lh-emph,none)}` : "");
  c.svg.classList.add("has-legend-hover");
}

// A last check that the marks are still there. Keys are only minted for marks
// that exist, so this is the case where the plate changed under a pointer that
// had not moved: fading the whole country to point at nothing would be a lie
// about the geometry, so a key that lights nothing does nothing.
function lights(t: LegendTarget): boolean {
  const c = maybeCtx();
  if (!c) return false;
  return t.lit.some((s) => c.svg.querySelector(s) !== null);
}
