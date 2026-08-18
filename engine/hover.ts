// ---- hover: one delegated mousemove resolves regions, states, and wires ----
import { ctx } from "./ctx";
import { svgPoint } from "./viewbox";
import { showRegion, showState, showWire } from "./ui/cards";

function setHover(group: SVGGElement, match: (p: SVGElement) => boolean): void {
  ctx().svg.classList.add("has-hover");
  for (const p of group.children) {
    const el = p as SVGElement;
    el.classList.toggle("hov", match(el));
  }
}

export function bindHover(): void {
  const c = ctx();
  const signal = c.ac.signal;
  c.svg.addEventListener("mousemove", (e) => {
    const target = e.target as SVGElement;
    const d = target.dataset;
    if (c.current === "wholesale" && d.rto !== undefined) {
      const rto = d.rto;
      setHover(c.g.rto, (p) => p.dataset.rto === rto);
      setHover(c.g.transitions, (p) => p.dataset.rto === rto);
      let splitKey: string | undefined;
      if (rto === "NONE") {
        const { x, y } = svgPoint(e);
        const lonlat = c.projection.invert?.([x, y]);
        splitKey = lonlat && lonlat[0] < -98 ? "NONE_W" : "NONE_SE";
      }
      showRegion(rto, splitKey);
    } else if (c.current === "rules" && d.state !== undefined) {
      const state = d.state;
      setHover(c.g.rules, (p) => p.dataset.state === state);
      showState(state);
    } else if (c.current === "wires" && d.wire !== undefined) {
      if (c.hoveredWire) c.hoveredWire.classList.remove("hov");
      c.hoveredWire = target;
      c.hoveredWire.classList.add("hov");
      showWire(Number(d.wire));
    }
  }, { signal });
  c.svg.addEventListener("mouseleave", () => {
    c.svg.classList.remove("has-hover");
    for (const grp of [c.g.rto, c.g.transitions, c.g.rules])
      for (const p of grp.children) p.classList.remove("hov");
    if (c.hoveredWire) {
      c.hoveredWire.classList.remove("hov");
      c.hoveredWire = null;
    }
  }, { signal });
}
