// Wholesale layer marks: RTO regions, the territories that changed grids,
// region labels, state lines, and the trivia markers.
import { req } from "../../lib/assert";
import { copy } from "../../lib/data";
import { setAtlasState } from "../../lib/store";
import { FILL, NUDGE, SVG_NS } from "../constants";
import { ctx } from "../ctx";
import { animateViewBox } from "../viewbox";
import { showTrivia } from "../ui/cards";

export function buildWholesale(): void {
  const c = ctx();
  for (const f of c.rtosFC.features) {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", c.path(f) ?? "");
    p.setAttribute("fill", FILL[f.properties.RTO] ?? "#ccc");
    p.setAttribute("class", "region");
    p.dataset.rto = f.properties.RTO;
    c.g.rto.appendChild(p);
  }

  // The geometry marks the territory that changed. It sits above the current
  // wholesale layer, so the hatch reads as ERCOT today with a visible history.
  for (const [i, f] of c.transitionsFC.features.entries()) {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", c.path(f) ?? "");
    p.setAttribute("fill", "url(#hatch-transition)");
    p.setAttribute("class", "region transition");
    p.dataset.transition = String(i);
    p.dataset.rto = f.properties.RTO;
    c.g.transitions.appendChild(p);
  }

  const lines = document.createElementNS(SVG_NS, "path");
  lines.setAttribute("d", c.path(c.stateLines) ?? "");
  lines.setAttribute("class", "statelines");
  c.g.statelines.appendChild(lines);

  // region labels: computed centroids with hand nudges; NONE uses the two
  // display anchors from the copy deck.
  for (const f of c.rtosFC.features) {
    const rto = f.properties.RTO;
    if (rto === "NONE") continue;
    const [cx, cy] = c.path.centroid(f);
    const [dx, dy] = NUDGE[rto] ?? [0, 0];
    addLabel(req(copy.regions[rto], `region copy ${rto}`).name.toUpperCase(),
      cx + dx, cy + dy, rto === "NYISO" || rto === "ISONE");
  }
  for (const half of Object.values(req(copy.regions.NONE, "NONE region").display_split ?? {})) {
    const pt = c.projection(half.anchor);
    if (pt) addLabel(half.label, pt[0], pt[1], true);
  }

  buildTrivia();
}

function addLabel(text: string, x: number, y: number, small: boolean): void {
  const t = document.createElementNS(SVG_NS, "text");
  t.setAttribute("x", String(x));
  t.setAttribute("y", String(y));
  t.setAttribute("class", "rlabel" + (small ? " small" : ""));
  t.textContent = text;
  ctx().g.labels.appendChild(t);
}

// ---- trivia markers (wholesale layer): the map's curiosities ----
function buildTrivia(): void {
  const c = ctx();
  const transitionTriviaIds = new Set(c.transitionsFC.features.map((f) => f.properties.TRIVIA));
  copy.trivia.forEach((t, i) => {
    const pt = c.projection(t.anchor.lonlat);
    if (!pt) return;
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "trivia" + (transitionTriviaIds.has(t.id) ? " transition-trivia" : ""));
    g.setAttribute("transform", `translate(${pt[0].toFixed(1)},${pt[1].toFixed(1)})`);
    g.dataset.trivia = String(i);
    g.dataset.x = pt[0].toFixed(1);
    g.dataset.y = pt[1].toFixed(1);
    if (transitionTriviaIds.has(t.id)) {
      g.innerHTML = `<line class="trivia-leader" x1="2" y1="-2" x2="11" y2="-9"></line>` +
        `<circle cx="15" cy="-12" r="9"></circle><text x="15" y="-12" dy="4">✳</text>`;
    } else {
      g.innerHTML = `<circle r="9"></circle><text dy="4">✳</text>`;
    }
    c.g.trivia.appendChild(g);
  });
  const onPick = (e: Event): void => {
    const g = (e.target as Element).closest<SVGGElement>(".trivia");
    if (g) showTrivia(Number(g.dataset.trivia));
  };
  c.g.trivia.addEventListener("mouseover", onPick, { signal: c.ac.signal });
  c.g.trivia.addEventListener("click", onPick, { signal: c.ac.signal });
}

// deep link to a curiosity: open the card and fly to its marker
export function flyToTrivia(id: string): void {
  const c = ctx();
  const i = copy.trivia.findIndex((t) => t.id === id);
  if (i < 0) return;
  showTrivia(i);
  const pt = c.projection(req(copy.trivia[i]).anchor.lonlat);
  if (!pt) return;
  const transition = c.transitionsFC.features.find((f) => f.properties.TRIVIA === id);
  if (transition) {
    const [[x0, y0], [x1, y1]] = c.path.bounds(transition);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    animateViewBox([cx - 12.5, cy - 8, 25, 16]);
  } else {
    animateViewBox([pt[0] - 130, pt[1] - 90, 260, 180]);
  }
  setAtlasState({ zoomResetVisible: true });
}
