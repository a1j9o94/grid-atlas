import { req } from "../lib/assert";
import { setAtlasState } from "../lib/store";
import { HOME_VIEW, type ViewBox } from "./constants";
import { ctx } from "./ctx";

export function getVb(): ViewBox {
  const p = (ctx().svg.getAttribute("viewBox") ?? HOME_VIEW.join(" ")).split(" ").map(Number);
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? HOME_VIEW[2], p[3] ?? HOME_VIEW[3]];
}

// viewBox is the single source of zoom state; setVb also scales the hand-inked
// wobble down with zoom so boundaries stay crisp, and manages the reset button.
export function setVb(v: ViewBox): void {
  const c = ctx();
  c.svg.setAttribute("viewBox", v.join(" "));
  const k = HOME_VIEW[2] / v[2];
  c.wobbleDisp.setAttribute("scale", (6.5 / Math.max(1, k * 0.75)).toFixed(2));
  // trivia markers keep their on-screen size at any zoom
  const mk = 1 / Math.max(1, k * 0.8);
  for (const m of c.g.trivia.children) {
    const el = m as SVGGElement;
    el.setAttribute("transform", `translate(${el.dataset.x ?? "0"},${el.dataset.y ?? "0"}) scale(${mk.toFixed(3)})`);
  }
  // the store short-circuits identical writes, so per-frame calls are free
  if (c.current === "wires" || c.current === "you") setAtlasState({ zoomResetVisible: k >= 1.05 });
}

export function animateViewBox(to: ViewBox, ms = 900): void {
  const c = ctx();
  if (c.viewAnim !== null) cancelAnimationFrame(c.viewAnim);
  const from = getVb();
  // Seed the clock from the first frame, not from performance.now(). rAF hands
  // back the timestamp of the frame it belongs to, which on a busy load can
  // predate a now() captured just before the request. That makes t negative,
  // and the cubic ease turns a small negative into a large one.
  let t0: number | null = null;
  const ease = (t: number): number => 1 - Math.pow(1 - t, 3);
  const tick = (now: number): void => {
    t0 ??= now;
    const t = Math.min(1, (now - t0) / ms);
    const k = ease(t);
    setVb([
      from[0] + (to[0] - from[0]) * k,
      from[1] + (to[1] - from[1]) * k,
      from[2] + (to[2] - from[2]) * k,
      from[3] + (to[3] - from[3]) * k,
    ]);
    if (t < 1) c.viewAnim = requestAnimationFrame(tick);
  };
  c.viewAnim = requestAnimationFrame(tick);
}

export function svgPoint(e: { clientX: number; clientY: number }): DOMPoint {
  const pt = new DOMPoint(e.clientX, e.clientY);
  return pt.matrixTransform(req(ctx().svg.getScreenCTM(), "screen CTM").inverse());
}

// ---- free zoom & pan (wires and you layers) ----
function zoomable(): boolean {
  const cur = ctx().current;
  return cur === "wires" || cur === "you";
}
function zoomAt(pt: { x: number; y: number }, factor: number): void {
  const [x, y, w, h] = getVb();
  const nw = Math.min(Math.max(w * factor, HOME_VIEW[2] / 32), HOME_VIEW[2] * 1.15);
  const k = nw / w;
  const nh = h * k;
  setVb([pt.x - (pt.x - x) * k, pt.y - (pt.y - y) * k, nw, nh]);
}

export function bindZoomPan(): void {
  const c = ctx();
  const { svg } = c;
  const signal = c.ac.signal;
  svg.addEventListener("wheel", (e) => {
    if (!zoomable()) return;
    e.preventDefault();
    zoomAt(svgPoint(e), Math.exp(e.deltaY * 0.0022));
  }, { passive: false, signal });
  svg.addEventListener("dblclick", (e) => {
    if (zoomable()) zoomAt(svgPoint(e), 0.5);
  }, { signal });

  svg.addEventListener("pointerdown", (e) => {
    if (!zoomable() || c.pinch !== null || e.button !== 0) return;
    c.drag = { x: e.clientX, y: e.clientY, vb: getVb() };
    svg.setPointerCapture(e.pointerId);
  }, { signal });
  svg.addEventListener("pointermove", (e) => {
    if (!c.drag || c.pinch !== null) return;
    const r = svg.getBoundingClientRect();
    const [x, y, w, h] = c.drag.vb;
    const dx = (e.clientX - c.drag.x) * (w / r.width);
    const dy = (e.clientY - c.drag.y) * (h / r.height);
    setVb([x - dx, y - dy, w, h]);
  }, { signal });
  svg.addEventListener("pointerup", () => { c.drag = null; }, { signal });
  svg.addEventListener("pointercancel", () => { c.drag = null; }, { signal });

  svg.addEventListener("touchstart", (e) => {
    if (zoomable() && e.touches.length === 2) {
      c.drag = null;
      const a = req(e.touches[0]);
      const b = req(e.touches[1]);
      c.pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
  }, { passive: true, signal });
  svg.addEventListener("touchmove", (e) => {
    if (!zoomable() || e.touches.length !== 2 || !c.pinch) return;
    e.preventDefault();
    const a = req(e.touches[0]);
    const b = req(e.touches[1]);
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const mid = svgPoint({
      clientX: (a.clientX + b.clientX) / 2,
      clientY: (a.clientY + b.clientY) / 2,
    });
    zoomAt(mid, c.pinch / d);
    c.pinch = d;
  }, { passive: false, signal });
  svg.addEventListener("touchend", () => { c.pinch = null; }, { passive: true, signal });
}
