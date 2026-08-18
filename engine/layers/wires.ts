// Wires layer: ~2,900 utility territories, their Dorling-cartogram circles,
// and the colour/size channel machinery.
import { req } from "../../lib/assert";
import { copy, type WireFeature } from "../../lib/data";
import { fmtBig } from "../../lib/format";
import {
  FIT_EXTENT, HOME_VIEW, NO_DATA, OTHER_PARENT, PARENT_COLORS, SVG_NS,
  WIRE_COLORS, wireGroup,
} from "../constants";
import { ctx, setHidden, type ParentGroup } from "../ctx";
import { colourScale, colourValue, isColourMeasure, loadWiresBundle, measureSpec, measureValue, wiresTopoToFC } from "../data";

// The layouts are in projected space, so they only line up if the pipeline used
// the same projection this file builds. Say so loudly rather than silently
// drawing every circle in the wrong place.
function assertCartogramProjection(): void {
  const p = ctx().cartogram?.meta?.projection;
  if (!p) return;
  const want = JSON.stringify(FIT_EXTENT);
  const vb = JSON.stringify(HOME_VIEW);
  if (JSON.stringify(p.fitExtent) !== want || JSON.stringify(p.viewBox) !== vb)
    console.warn("cartogram.json was built for a different projection; circle positions will not match the map", p);
}

export async function ensureWires(): Promise<void> {
  const c = ctx();
  if (c.wiresFeatures) return;
  const bundle = await loadWiresBundle();
  if (c.dead) return;
  // re-read through ctx(): a concurrent ensureWires may have built the layer
  // while this call awaited, and c's narrowing can't see that
  if (ctx().wiresFeatures) return;
  c.measures = bundle.measures;
  c.cartogram = bundle.cartogram;
  // Each measure that offers variants opens on the first one the registry
  // lists. Reliability leads with the storm-free number on purpose: one
  // hurricane can outweigh everything else a utility does in a year.
  for (const m of c.measures?.measures ?? []) {
    if (m.variants) c.variantOf[m.id] ??= req(Object.keys(m.variants)[0]);
  }
  assertCartogramProjection();
  const fc = wiresTopoToFC(bundle.topo);
  // draw big territories first so small ones stay hoverable on top
  c.wiresFeatures = fc.features
    .map((f) => ({ f, area: c.path.area(f) }))
    .sort((a, b) => b.area - a.area)
    .map((x) => x.f);
  c.wiresCounts = { iou: 0, coop: 0, public: 0, other: 0 };
  c.wiresFeatures.forEach((f, i) => {
    const g = wireGroup(f.properties.TYPE);
    req(c.wiresCounts)[g]++;
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", c.path(f) ?? "");
    p.setAttribute("fill", WIRE_COLORS[g]);
    p.setAttribute("class", "region wire");
    p.dataset.wire = String(i);
    c.g.wires.appendChild(p);
  });
  buildCircles();
}

// One circle per utility, drawn once and re-aimed whenever the measure changes.
// They carry the same dataset.wire index as the territories, so the existing
// mousemove handler resolves them without knowing they are circles.
function buildCircles(): void {
  const c = ctx();
  if (!c.cartogram || c.circleEls) return;
  c.circleEls = [];
  req(c.wiresFeatures).forEach((f, i) => {
    const id = f.properties.ID;
    const seat = req(c.cartogram).centroids[id];
    if (!seat) return;
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("fill", WIRE_COLORS[wireGroup(f.properties.TYPE)]);
    circle.setAttribute("class", "region dot");
    circle.setAttribute("cx", String(seat[0]));
    circle.setAttribute("cy", String(seat[1]));
    circle.setAttribute("r", "0");
    circle.dataset.wire = String(i);
    circle.dataset.id = id;
    c.g.cartogram.appendChild(circle);
    req(c.circleEls).push(circle);
  });
}

// Tween from where a utility sits on the ground to where its circle has room,
// growing the radius from nothing. Reuses the ease from animateViewBox.
export function morphCircles(key: string | null, ms = 900): void {
  const c = ctx();
  if (!c.cartogram || !c.circleEls) return;
  if (c.morphAnim !== null) cancelAnimationFrame(c.morphAnim);
  const layout = key ? c.cartogram.measures[key]?.circles : null;
  const els = c.circleEls;
  const from: [number, number, number][] = els.map((el) => [
    Number(el.getAttribute("cx")), Number(el.getAttribute("cy")), Number(el.getAttribute("r")),
  ]);
  const to: [number, number, number][] = els.map((el) => {
    const seat = req(c.cartogram).centroids[el.dataset.id ?? ""];
    const t = layout?.[el.dataset.id ?? ""];
    // with no measure, or none reported, the circle collapses back to its seat
    return t ?? [seat?.[0] ?? 0, seat?.[1] ?? 0, 0];
  });
  const ease = (t: number): number => 1 - Math.pow(1 - t, 3);
  // Seed the clock from the first frame, not from performance.now(). rAF hands
  // back the timestamp of the frame it belongs to, which on a busy load can
  // predate a now() captured just before the request. That makes t negative,
  // and the cubic ease turns a small negative into a large one: radii came out
  // around -600 on the deep-link path.
  let t0: number | null = null;
  const tick = (now: number): void => {
    t0 ??= now;
    const t = Math.min(1, (now - t0) / ms);
    const k = ease(t);
    for (let i = 0; i < els.length; i++) {
      const a = req(from[i]);
      const b = req(to[i]);
      const el = req(els[i]);
      el.setAttribute("cx", (a[0] + (b[0] - a[0]) * k).toFixed(1));
      el.setAttribute("cy", (a[1] + (b[1] - a[1]) * k).toFixed(1));
      el.setAttribute("r", Math.max(0, a[2] + (b[2] - a[2]) * k).toFixed(2));
    }
    if (t < 1) c.morphAnim = requestAnimationFrame(tick);
  };
  c.morphAnim = requestAnimationFrame(tick);
}

export function buildParentGroups(): void {
  const c = ctx();
  if (c.parentGroups || !c.wiresFeatures) return;
  const tally = new Map<string, { meters: number; n: number }>();
  for (const f of c.wiresFeatures) {
    const p = f.properties;
    const parent = p.HOLDING_CO.trim();
    if (!parent || parent.toUpperCase() === p.NAME.trim().toUpperCase()) continue;
    const t = tally.get(parent) ?? { meters: 0, n: 0 };
    t.meters += measureValue(p.ID, "cust") ?? 0;
    t.n++;
    tally.set(parent, t);
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1].meters - a[1].meters).slice(0, PARENT_COLORS.length);
  c.parentGroups = new Map<string, ParentGroup>(
    ranked.map(([name, t], i) => [name, { ...t, color: req(PARENT_COLORS[i]), rank: i }]),
  );
}

export function wireFill(f: WireFeature): string {
  const c = ctx();
  const p = f.properties;
  if (c.colourBy === "parent") {
    const parent = p.HOLDING_CO.trim();
    if (!parent || parent.toUpperCase() === p.NAME.trim().toUpperCase()) return NO_DATA;
    return c.parentGroups?.get(parent)?.color ?? OTHER_PARENT;
  }
  if (isColourMeasure(c.colourBy)) {
    return colourScale(c.colourBy)?.of(colourValue(p.ID, c.colourBy)) ?? NO_DATA;
  }
  return WIRE_COLORS[wireGroup(p.TYPE)];
}

export function repaintWires(): void {
  const c = ctx();
  if (!c.wiresFeatures) return;
  c.wiresFeatures.forEach((f, i) => {
    c.g.wires.children[i]?.setAttribute("fill", wireFill(f));
  });
  for (const el of c.g.cartogram.children) {
    const f = c.wiresFeatures[Number((el as SVGCircleElement).dataset.wire)];
    if (f) el.setAttribute("fill", wireFill(f));
  }
}

// The size key is drawn on the plate rather than in the HTML legend, in the
// map's own coordinates, so its circles are exactly the size of the map's. A
// key that had to be rescaled to fit a legend strip would not be a size key.
// It sits bottom-left, over the empty Pacific.
export function renderSizeKey(key: string | null): void {
  const c = ctx();
  const m = key !== null ? c.cartogram?.measures[key] : undefined;
  setHidden(c.g.sizekey, !m);
  if (!m || key === null) return;
  const spec = measureSpec(key);
  const vals = [m.max, m.max / 8, m.max / 40];
  const R = m.maxRadius;
  const rs = vals.map((v) => R * Math.sqrt(v / m.max));
  // Bottom-centre-left is the emptiest part of the plate at every measure, but
  // never completely clear, so the key sits on its own backing panel.
  const baseX = 306;
  const baseY = 584;
  c.g.sizekey.innerHTML =
    `<rect class="sk-plate" x="${String(baseX - R - 10)}" y="${String(baseY - 2 * R - 20)}" ` +
    `width="${String(2 * R + 78)}" height="${String(2 * R + 36)}"/>` +
    rs.map((r) => `<circle cx="${String(baseX)}" cy="${(baseY - r).toFixed(1)}" r="${r.toFixed(1)}"/>`).join("") +
    rs.map((r, i) =>
      `<line x1="${String(baseX)}" y1="${(baseY - 2 * r).toFixed(1)}" x2="${(baseX + R + 6).toFixed(1)}" y2="${(baseY - 2 * r).toFixed(1)}"/>` +
      `<text x="${(baseX + R + 9).toFixed(1)}" y="${(baseY - 2 * r + 3).toFixed(1)}">${fmtBig(req(vals[i]))}</text>`).join("") +
    `<text class="sk-unit" x="${String(baseX - R - 4)}" y="${String(baseY + 11)}">${spec?.short ?? ""}</text>`;
}

// The strip keeps the words; the circles are on the plate.
export function sizeLegendNote(key: string): string | undefined {
  const c = ctx();
  const m = c.cartogram?.measures[key];
  if (!m || !c.cartogram) return undefined;
  const missing = Object.keys(c.cartogram.centroids).length - Object.keys(m.circles).length;
  return copy.cartogram.legend_note +
    (missing > 0 ? ` ${copy.cartogram.missing_note.replace("{n}", missing.toLocaleString())}` : "");
}
