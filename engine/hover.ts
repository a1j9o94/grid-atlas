// ---- hover: one delegated mousemove resolves regions, states, and wires ----
//
// The effect itself lives in highlight.ts, next to the legend's way of asking
// for the same thing. This file is only the arbiter: which mark is under the
// pointer, and which card that opens.
import { ctx } from "./ctx";
import { clearLegendHover, clearMapHover, legendPinned, setHover } from "./highlight";
import { svgPoint } from "./viewbox";
import { showRegion, showState, showWire } from "./ui/cards";

export function bindHover(): void {
  const c = ctx();
  const signal = c.ac.signal;
  c.svg.addEventListener("mousemove", (e) => {
    // The pointer is on the map, so the key it was resting on is no longer the
    // question. A pinned key is: that one the reader asked for, and it stands.
    // A null check rather than a call, because this is the hot path.
    if (c.legendHover !== null) clearLegendHover();
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
      // The one mark that highlights itself rather than its whole family, so it
      // needs the pinned check setHover makes for everything else.
      if (!legendPinned()) {
        if (c.hoveredWire) c.hoveredWire.classList.remove("hov");
        c.hoveredWire = target;
        c.hoveredWire.classList.add("hov");
      }
      showWire(Number(d.wire));
    }
  }, { signal });
  c.svg.addEventListener("mouseleave", () => { clearMapHover(); }, { signal });
}
