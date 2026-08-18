// The history layer: dated plates, not a continuous scrub.
//
// The archives support moments and membership changes. They do not support
// annual geometry, and a slider gliding through years where nothing happened
// would be inventing data. So the reader moves between nine plates, and every
// plate carries its sources.
//
// Ported from the retired static shell. The geometry work is the same; the
// cards and the scrubber are models now, computed here and rendered by React.
import { fetchJson, type TimelineFile, type TimelineFrame } from "../../lib/data";
import { setAtlasState, type TimelineStop } from "../../lib/store";
import { HOME_VIEW, SVG_NS } from "../constants";
import { ctx, setHidden } from "../ctx";
import { animateViewBox } from "../viewbox";
import { showDot, showFrame } from "../ui/cards";
import { renderLegend } from "../ui/legend";
import { updateUrl, type UrlMode } from "../urlstate";

const DOT_MIN = 1.7;
const DOT_MAX = 7.5;

const reduceMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function frames(): TimelineFrame[] {
  return ctx().timeline?.frames ?? [];
}
export function frameById(id: string | null): TimelineFrame | undefined {
  if (id === null) return undefined;
  return frames().find((f) => f.id === id);
}

// The file is small but the layer is one of five, so it loads on first open
// rather than riding along with the copy deck.
export async function ensureTimeline(): Promise<void> {
  const c = ctx();
  if (c.timeline) return;
  const file = await fetchJson<TimelineFile>("/data/timeline.json");
  if (c.dead) return;
  c.timeline = file;
  buildTimeBase();
  buildDots();
}

// The ground: every state in the pale unlit paper the You layer uses. Tint
// plates repaint these same paths, so recolouring is a fill change and the
// cross-fade comes free from CSS.
function buildTimeBase(): void {
  const c = ctx();
  if (c.g.timeBase.dataset.built === "1") return;
  c.g.timeBase.dataset.built = "1";
  for (const f of c.statesFC.features) {
    // Albers USA cannot place PR, GU, VI, AS or MP, and path() returns null
    // for them. Writing that out gives you d="null".
    const d = c.path(f);
    if (d === null) continue;
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "tl-state");
    p.dataset.state = f.properties.STUSPS;
    c.g.timeBase.appendChild(p);
  }
}

// City dots for the pre-grid plates. Area carries population, not radius:
// New York's 3.4 million against Telluride's 2,446 is a 1,400-to-1 range, and
// on radius the Northeast would be one blot.
function buildDots(): void {
  const c = ctx();
  if (c.g.timeMarks.dataset.built === "1") return;
  c.g.timeMarks.dataset.built = "1";
  const dots = c.timeline?.dots ?? [];
  const maxPop = Math.max(1, ...dots.map((d) => d.pop1900));
  // Biggest first, so small cities stay on top and stay findable, the same
  // reason the wires layer sorts by area. The hit circle is sized to the dot
  // rather than given a generous floor: a flat 7px floor let Newark, eight
  // miles away and a fourteenth the size, cover New York's target completely.
  const order = dots
    .map((d, i) => ({ d, i }))
    .sort((a, b) => b.d.pop1900 - a.d.pop1900);
  for (const { d, i } of order) {
    const pt = c.projection(d.lonlat);
    if (!pt) continue;
    const r = DOT_MIN + (DOT_MAX - DOT_MIN) * Math.sqrt(d.pop1900 / maxPop);
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "tl-dot" + (d.story !== undefined ? " tl-dot-story" : ""));
    g.setAttribute("transform", `translate(${pt[0].toFixed(1)},${pt[1].toFixed(1)})`);
    g.dataset.dot = String(i);
    g.innerHTML =
      `<circle class="tl-glow" r="${(r * 3.4).toFixed(1)}"></circle>` +
      `<circle class="tl-core" r="${r.toFixed(2)}"></circle>` +
      `<circle class="tl-hit" r="${Math.max(3.5, r).toFixed(1)}"></circle>`;
    c.g.timeMarks.appendChild(g);
  }
  // Hovering a city names it, the same affordance the trivia markers use.
  const onPick = (e: Event): void => {
    const g = (e.target as Element).closest<SVGGElement>(".tl-dot");
    if (g?.dataset.dot !== undefined) showDot(Number(g.dataset.dot));
  };
  c.g.timeMarks.addEventListener("mouseover", onPick, { signal: c.ac.signal });
  c.g.timeMarks.addEventListener("click", onPick, { signal: c.ac.signal });
  // Auto-advance yields to the reader touching the map at all.
  c.svg.addEventListener("pointerdown", () => { stopPlay(); }, { signal: c.ac.signal });
}

// Grow the dots in from nothing when a plate opens. Same cubic ease and the
// same first-frame clock seeding as morphCircles: rAF hands back its own frame
// timestamp, which can predate a performance.now() captured just before, and a
// negative t through a cubic ease overshoots hard.
function animateDots(ms = 700): void {
  const c = ctx();
  if (c.dotAnim !== null) cancelAnimationFrame(c.dotAnim);
  const marks = [...c.g.timeMarks.querySelectorAll<SVGGElement>(".tl-dot")].map((g) => {
    const glow = g.querySelector<SVGCircleElement>(".tl-glow");
    const core = g.querySelector<SVGCircleElement>(".tl-core");
    return {
      glow,
      core,
      gr: Number(glow?.getAttribute("r") ?? 0),
      cr: Number(core?.getAttribute("r") ?? 0),
    };
  });
  if (reduceMotion()) return;
  const ease = (t: number): number => 1 - Math.pow(1 - t, 3);
  let t0: number | null = null;
  const tick = (now: number): void => {
    if (c.dead) return;
    t0 ??= now;
    const k = ease(Math.min(1, (now - t0) / ms));
    for (const m of marks) {
      m.glow?.setAttribute("r", (m.gr * k).toFixed(1));
      m.core?.setAttribute("r", (m.cr * k).toFixed(2));
    }
    if (k < 1) c.dotAnim = requestAnimationFrame(tick);
  };
  c.dotAnim = requestAnimationFrame(tick);
}

// A plate id is its year, so /then/1967 and a legacy ?year=1970 resolve the
// same way: an exact id, or the latest plate at or before the year asked for.
// That is what keeps a link to a retired year landing somewhere honest.
export function resolveFrame(v: string | null): string | null {
  if (v === null) return null;
  const all = frames();
  if (all.some((f) => f.id === v)) return v;
  const y = Number.parseInt(v, 10);
  if (!Number.isFinite(y)) return null;
  let best: TimelineFrame | undefined;
  for (const f of all) if (f.year <= y && (!best || f.year > best.year)) best = f;
  return (best ?? all[0])?.id ?? null;
}

export function setFrame(id: string, urlMode: UrlMode = "replace"): void {
  const c = ctx();
  const f = frameById(id) ?? frames()[frames().length - 1];
  if (!f) return;
  c.frameId = f.id;
  const kind = f.ship ? f.geometry.kind : "pending";
  const showDots = kind === "dots" || kind === "dots+tints";
  const showGround = kind !== "current";
  const showToday = kind === "current";

  setHidden(c.g.timeBase, !showGround);
  setHidden(c.g.timeMarks, !showDots);
  // The last plate IS the wholesale layer. Nothing is redrawn for it: the
  // marks that already exist are unhidden, so the end of the timeline and the
  // top of the stack can never drift apart.
  setHidden(c.g.rto, !showToday);
  setHidden(c.g.transitions, !showToday);
  setHidden(c.g.labels, !showToday);
  if (showDots) animateDots();
  animateViewBox(f.view ?? HOME_VIEW, reduceMotion() ? 0 : 500);

  renderTimelineBar();
  renderLegend("history");
  showFrame(f);
  updateUrl("history", urlMode);
}

export function stepFrame(delta: number): void {
  const c = ctx();
  const all = frames();
  const i = all.findIndex((f) => f.id === c.frameId);
  const next = all[Math.min(all.length - 1, Math.max(0, i + delta))];
  if (next && next.id !== c.frameId) setFrame(next.id, "push");
}

export function renderTimelineBar(): void {
  const c = ctx();
  const all = frames();
  const i = all.findIndex((f) => f.id === c.frameId);
  const stops: TimelineStop[] = all.map((f) => ({
    id: f.id,
    label: f.label,
    title: f.ship ? f.title : `${f.title} · still being inked`,
    pressed: f.id === c.frameId,
    pending: !f.ship,
  }));
  setAtlasState({
    timeline: {
      stops,
      canPrev: i > 0,
      canNext: i >= 0 && i < all.length - 1,
      playing: c.playTimer !== null,
    },
  });
}

// Auto-advance is a nicety, so it yields immediately: any tap on the map, any
// scrubber press, any layer change stops it. Reduced motion turns it off.
export function startPlay(): void {
  const c = ctx();
  if (reduceMotion() || c.playTimer !== null) return;
  const all = frames();
  if (all.findIndex((f) => f.id === c.frameId) >= all.length - 1) {
    const first = all[0];
    if (first) setFrame(first.id);
  }
  c.playTimer = setInterval(() => {
    const now = ctx();
    const list = frames();
    const i = list.findIndex((f) => f.id === now.frameId);
    const next = list[i + 1];
    if (!next) {
      stopPlay();
      return;
    }
    setFrame(next.id);
  }, 7000);
  renderTimelineBar();
}

export function stopPlay(): void {
  const c = ctx();
  if (c.playTimer === null) return;
  clearInterval(c.playTimer);
  c.playTimer = null;
  renderTimelineBar();
}

export function hideHistory(): void {
  const c = ctx();
  stopPlay();
  setHidden(c.g.timeBase, true);
  setHidden(c.g.timeMarks, true);
  setAtlasState({ timeline: null, evidence: null });
}
