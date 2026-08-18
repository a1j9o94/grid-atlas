// You layer: zip search, fly-to, your place in the stack.
import { req } from "../../lib/assert";
import { HOME_VIEW, SVG_NS, type ViewBox } from "../constants";
import { ctx, setHidden } from "../ctx";
import { zctaShard, zctaToFC } from "../data";
import { animateViewBox } from "../viewbox";
import { showYouCard, showZipWiresCard } from "../ui/cards";

export function youBase(): void {
  const c = ctx();
  if (c.g.you.dataset.base) return;
  c.g.you.dataset.base = "1";
  for (const f of c.statesFC.features) {
    // Albers USA has no place for Puerto Rico, Guam, the Virgin Islands,
    // American Samoa or the Marianas, so path() hands back null for them.
    // Passing that to setAttribute writes the string "null" and the browser
    // rejects the path. Skip them: the omission is footnoted in the copy deck.
    const d = c.path(f);
    if (!d) continue;
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "#e4e7db");
    c.g.you.appendChild(p);
  }
  const zg = document.createElementNS(SVG_NS, "g");
  zg.id = "g-zips";
  c.g.you.appendChild(zg);
}

export async function findZip(zip: string): Promise<void> {
  const c = ctx();
  c.zipMsg.textContent = "Looking…";
  const shard = await zctaShard(zip.substring(0, 2));
  if (c.dead) return;
  const topo = shard.geo;
  const fc = topo ? zctaToFC(topo) : { features: [] as never[] };
  const target = fc.features.find((f) => f.properties.GEOID20 === zip);
  const utils = shard.lookup?.[zip] ?? [];
  if (!target && !utils.length) {
    c.zipMsg.textContent = "We can't find that zip. Try another?";
    return;
  }
  c.zipMsg.textContent = "";

  // on the Wires layer the search flies to your area and outlines your zip
  // over the utility pieces, then hands you back to hover.
  if (c.current === "wires") {
    const zo = c.g.zipoutline;
    zo.innerHTML = "";
    let view: ViewBox = HOME_VIEW;
    if (target) {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", c.path(target) ?? "");
      p.setAttribute("class", "zip-outline");
      zo.appendChild(p);
      const [[x0, y0], [x1, y1]] = c.path.bounds(target);
      const w = Math.max(x1 - x0, 8);
      const h = Math.max(y1 - y0, 8);
      const pad = Math.max(w, h) * 2.2;
      view = [x0 - pad, y0 - pad, w + 2 * pad, h + 2 * pad];
    }
    animateViewBox(view);
    showZipWiresCard(zip);
    return;
  }

  youBase();
  const zg = req(c.g.you.querySelector<SVGGElement>("#g-zips"), "#g-zips");
  zg.innerHTML = "";
  // neighbors for context, target on top
  for (const f of fc.features) {
    if (f.properties.GEOID20 === zip) continue;
    const d = c.path(f);
    if (!d) continue; // zips the projection cannot place, as above
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "zip-neighbor");
    zg.appendChild(p);
  }
  let view: ViewBox = HOME_VIEW;
  if (target) {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", c.path(target) ?? "");
    p.setAttribute("class", "zip-target");
    zg.appendChild(p);
    const [[x0, y0], [x1, y1]] = c.path.bounds(target);
    const w = Math.max(x1 - x0, 8);
    const h = Math.max(y1 - y0, 8);
    const pad = Math.max(w, h) * 1.6;
    view = [x0 - pad, y0 - pad, w + 2 * pad, h + 2 * pad];
  }
  animateViewBox(view);
  setHidden(c.zoomReset, false);
  await showYouCard(zip, utils);
}
