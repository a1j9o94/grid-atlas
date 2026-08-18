// Serializing engine state back into the address bar. Native history writes
// on purpose: Next syncs them into usePathname without a server round-trip,
// which is exactly right for map-state tweaks.
import type { LayerKey } from "../lib/data";
import { buildPath, type RouteState } from "../lib/route";
import { ctx } from "./ctx";
import { isColourMeasure, measureSpec } from "./data";

export type UrlMode = "push" | "replace" | "none";

// Serialize the engine's state for `key` into a route. The default variant is
// left off, so the ordinary link stays short and the shipped saidi and
// saidi-all links keep their meaning.
export function currentRoute(key: LayerKey): RouteState {
  const c = ctx();
  let colour = c.colourBy;
  const spec = isColourMeasure(c.colourBy) ? measureSpec(c.colourBy) : undefined;
  if (spec?.variants) {
    const v = c.variantOf[c.colourBy];
    if (v !== undefined && v !== Object.keys(spec.variants)[0]) colour = `${c.colourBy}-${v}`;
  }
  return {
    layer: key,
    shade: c.shadeBy,
    colour,
    size: c.sizeBy,
    zip: key === "you" ? c.zip : null,
    trivia: null,
  };
}

export function updateUrl(key: LayerKey, mode: UrlMode = "replace"): void {
  if (mode === "none") return;
  const path = buildPath(currentRoute(key));
  // nothing to record; also keeps rapid repaints from spamming history
  if (path === location.pathname && location.search === "") return;
  if (mode === "push" && path !== location.pathname) history.pushState(null, "", path);
  else history.replaceState(null, "", path);
}
