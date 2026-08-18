// Rules layer: one path per state, coloured by choice bucket or by a
// state-level price measure.
//
// State-level on purpose. In a choice state the wires company does not bill
// for energy, the retailer does, and retailers have no territory to draw, so
// an honest price needs revenue from providers that are not on this map.
import { rules, statePrices } from "../../lib/data";
import { NO_DATA, PRICE_RAMP, SVG_NS } from "../constants";
import { ctx } from "../ctx";
import { makeScale } from "../scales";
import { req } from "../../lib/assert";

export function buildRules(): void {
  const c = ctx();
  for (const f of c.statesFC.features) {
    const abbr = f.properties.STUSPS;
    const st = rules.states[abbr];
    if (!st) continue;
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", c.path(f) ?? "");
    p.setAttribute("fill", req(rules.buckets[st.bucket], `bucket ${st.bucket}`).color);
    p.setAttribute("class", "region");
    p.dataset.state = abbr;
    c.g.rules.appendChild(p);
  }
}

export function initPriceScales(): void {
  const c = ctx();
  for (const m of statePrices.measures) {
    if (m.kind !== "sequential") continue;
    c.priceScales[m.id] = makeScale(
      Object.values(statePrices.states).map((s) => s[m.id]),
      PRICE_RAMP,
    );
  }
}

export function stateFill(abbr: string): string {
  const c = ctx();
  if (c.shadeBy === "bucket") {
    const st = rules.states[abbr];
    return st ? req(rules.buckets[st.bucket]).color : NO_DATA;
  }
  const scale = c.priceScales[c.shadeBy];
  if (!scale) return NO_DATA;
  return scale.of(statePrices.states[abbr]?.[c.shadeBy]);
}

export function repaintRules(): void {
  const c = ctx();
  for (const p of c.g.rules.children)
    p.setAttribute("fill", stateFill((p as SVGPathElement).dataset.state ?? ""));
}
