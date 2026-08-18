// Legacy query-param URL state. This module keeps today's shared links
// working verbatim during the migration; the path codec in lib/route.ts
// replaces it in the routing step.
import type { LayerKey } from "../lib/data";
import { ctx } from "./ctx";
import { isColourMeasure, measureSpec } from "./data";

export function updateUrl(key: LayerKey): void {
  const c = ctx();
  const q = new URLSearchParams();
  if (key !== "wholesale") q.set("layer", key);
  if (key === "wires" && c.sizeBy !== null) q.set("size", c.sizeBy);
  if (key === "wires" && c.colourBy !== "type") {
    // The default variant is left off, so the ordinary link stays short and the
    // existing ?colour=saidi and ?colour=saidi-all links keep their meaning.
    const spec = isColourMeasure(c.colourBy) ? measureSpec(c.colourBy) : undefined;
    const v = spec?.variants ? c.variantOf[c.colourBy] : undefined;
    q.set("colour",
      v !== undefined && spec?.variants && v !== Object.keys(spec.variants)[0]
        ? `${c.colourBy}-${v}`
        : c.colourBy);
  }
  if (key === "rules" && c.shadeBy !== "bucket") q.set("shade", c.shadeBy);
  const s = q.toString();
  history.replaceState(null, "", s ? `?${s}` : location.pathname);
}
