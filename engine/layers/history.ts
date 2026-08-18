// The history layer: dated plates, not a continuous scrub.
//
// The archives support moments and membership changes. They do not support
// annual geometry, and a slider gliding through years where nothing happened
// would be inventing data. So the reader moves between nine plates, and every
// plate carries its sources.
//
// Ported from the retired static shell. The geometry work is the same; the
// cards and the scrubber are models now, computed here and rendered by React.
import {
  fetchJson, parseHoldingsTrace, type TimelineFile, type TimelineFrame,
} from "../../lib/data";
import { loadHoldingsBundle, loadMembership, loadSeam } from "../data";
import { setAtlasState, type TimelineStop } from "../../lib/store";
import { FILL, HOLDING_COLORS, HOME_VIEW, SVG_NS } from "../constants";
import { ctx, setHidden } from "../ctx";
import { animateViewBox } from "../viewbox";
import { showDot, showFrame, showHoldingCounty, showMachine, showMarket } from "../ui/cards";
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
  bindMembershipPicks();
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

// ---- the seam: the three machines, for 1935, 1967 and 1975 ----
//
// One file carries the three regions and the two boundaries between them,
// because they have to stay coincident through quantization. What changes
// between the three plates is not the geometry, it is which boundary is the
// subject and whether East and West are one machine or two, and both of those
// are attributes on the group that CSS reads.
async function ensureSeam(): Promise<void> {
  const c = ctx();
  if (c.seam) return;
  const seam = await loadSeam();
  if (c.dead) return;
  c.seam = seam;
  buildSeam();
}

function buildSeam(): void {
  const c = ctx();
  if (c.seam === null || c.g.seam.dataset.built === "1") return;
  c.g.seam.dataset.built = "1";
  for (const f of c.seam.regionsFC.features) {
    const d = c.path(f);
    if (d === null) continue;
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "sm-region");
    p.dataset.ic = f.properties.IC;
    c.g.seam.appendChild(p);
  }
  // ERCOT's boundary first, so the East-West seam wins where the two meet in
  // the Panhandle. On the 1975 plate that crossing is the one place a reader
  // could mistake one line for the other.
  for (const f of c.seam.linesFC.features) {
    const d = c.path(f);
    if (d === null) continue;
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "sm-line");
    p.dataset.seam = f.properties.seam;
    c.g.seamLines.appendChild(p);
  }
  const onPick = (e: Event): void => {
    const p = (e.target as Element).closest<SVGPathElement>(".sm-region");
    if (p?.dataset.ic !== undefined) showMachine(p.dataset.ic);
  };
  c.g.seam.addEventListener("mouseover", onPick, { signal: c.ac.signal });
  c.g.seam.addEventListener("click", onPick, { signal: c.ac.signal });
}

// Hovering a market on a past plate names it and says when it started running,
// which is the question a reader has when a shape appears between two plates.
export function bindMembershipPicks(): void {
  const c = ctx();
  if (c.g.membership.dataset.bound === "1") return;
  c.g.membership.dataset.bound = "1";
  const onPick = (e: Event): void => {
    const p = (e.target as Element).closest<SVGPathElement>(".ms-region");
    if (p?.dataset.market !== undefined) showMarket(p.dataset.market);
  };
  c.g.membership.addEventListener("mouseover", onPick, { signal: c.ac.signal });
  c.g.membership.addEventListener("click", onPick, { signal: c.ac.signal });
}

// Two flags, read by CSS rather than by more code: `unified` repaints the
// Western grid in the Eastern colour and ghosts the line between them, and
// `emphasis` thickens the boundary the plate is about.
function applySeamState(f: TimelineFrame): void {
  const c = ctx();
  for (const g of [c.g.seam, c.g.seamLines]) {
    g.dataset.unified = f.geometry.unified === true ? "1" : "0";
    g.dataset.emphasis = f.geometry.emphasis ?? "";
  }
}

// ---- membership: market footprints at 1999, 2005 and 2014 ----
//
// One file holds all three dissolves, and each plate draws the object its
// frame_key names. The fills come from the wholesale layer's own palette, so a
// 2005 PJM is the same blue as today's PJM and the reader can follow one colour
// across four plates. That continuity is the argument these plates make.
async function ensureMembership(): Promise<void> {
  const c = ctx();
  if (c.membership) return;
  const m = await loadMembership();
  if (c.dead) return;
  c.membership = m;
}

function drawMembership(frameKey: string): void {
  const c = ctx();
  const fcm = c.membership?.[frameKey];
  if (!fcm) return;
  if (c.g.membership.dataset.frame === frameKey) return;
  c.g.membership.dataset.frame = frameKey;
  c.g.membership.replaceChildren();
  // Biggest last is wrong here and biggest first is wrong too: these are a
  // partition, not a stack, so painting order does not matter and the only
  // thing that does is that every market gets the palette's own fill.
  for (const f of fcm.features) {
    const d = c.path(f);
    if (d === null) continue;
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", FILL[f.properties.m] ?? "#ccc");
    p.setAttribute("class", "region ms-region");
    p.dataset.market = f.properties.m;
    c.g.membership.appendChild(p);
  }
}

// ---- the holding-company empires: FTC Map III, dated 1925 ----

async function ensureHoldings(): Promise<void> {
  const c = ctx();
  if (c.holdings) return;
  const h = await loadHoldingsBundle();
  if (c.dead) return;
  c.holdings = h;
  buildHoldings();
}

function buildHoldings(): void {
  const c = ctx();
  const h = c.holdings;
  if (!h || c.g.holdings.dataset.built === "1") return;
  c.g.holdings.dataset.built = "1";
  const year = h.trace.years["1925"] ?? {};
  for (const f of h.countiesFC.features) {
    const d = c.path(f);
    if (d === null) continue;
    const fips = f.properties.GEOID;
    const parsed = parseHoldingsTrace(year[fips] ?? "unknown-served");
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", `holdings-county holdings-${parsed.status}`);
    p.dataset.fips = fips;
    p.dataset.trace = parsed.raw;
    const colour = parsed.groups[0] !== undefined ? HOLDING_COLORS[parsed.groups[0]] : undefined;
    if (colour !== undefined) p.style.setProperty("--holding-fill", colour);
    c.g.holdings.appendChild(p);
  }
  const onPick = (e: Event): void => {
    const p = (e.target as Element).closest<SVGPathElement>(".holdings-county");
    if (p?.dataset.fips !== undefined) showHoldingCounty(p.dataset.fips);
  };
  c.g.holdings.addEventListener("mouseover", onPick, { signal: c.ac.signal });
  c.g.holdings.addEventListener("click", onPick, { signal: c.ac.signal });
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
  const showSeam = kind === "seam";
  const showMembership = kind === "membership";
  const showHoldings = kind === "holdings";

  setHidden(c.g.timeBase, !showGround);
  setHidden(c.g.timeMarks, !showDots);
  setHidden(c.g.seam, !showSeam);
  setHidden(c.g.seamLines, !showSeam);
  setHidden(c.g.membership, !showMembership);
  setHidden(c.g.holdings, !showHoldings);
  if (showHoldings && c.holdings === null) {
    const want = f.id;
    void ensureHoldings()
      .then(() => {
        // Use this engine instance, not a replacement mounted while the fetch
        // was in flight. A destroyed context owns detached DOM and must stay
        // untouched.
        if (c.dead || c.current !== "history" || c.frameId !== want) return;
        setHidden(c.g.holdings, false);
      })
      .catch(() => {
        if (c.dead || c.current !== "history" || c.frameId !== want) return;
        setHidden(c.g.holdings, true);
        showFrame({
          ...f,
          note: "The 1925 county layer could not be loaded. The source evidence remains available; reload to try the interactive trace again.",
        });
      });
  }
  if (showMembership) {
    const fk = f.geometry.frame_key;
    if (fk !== undefined) {
      if (c.membership) drawMembership(fk);
      else {
        const want = f.id;
        void ensureMembership().then(() => {
          const now = ctx();
          if (now.dead || now.frameId !== want) return;
          drawMembership(fk);
        });
      }
    }
  }
  if (showSeam) {
    applySeamState(f);
    // The 380KB of seam geometry loads on the first plate that needs it, not
    // with the timeline file. The frame is checked again on arrival because the
    // reader can be three plates further along by then.
    if (c.seam === null) {
      const want = f.id;
      void ensureSeam().then(() => {
        const now = ctx();
        const still = frameById(now.frameId);
        if (now.dead || now.frameId !== want || !still) return;
        applySeamState(still);
      });
    }
  }
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
  setHidden(c.g.seam, true);
  setHidden(c.g.seamLines, true);
  setHidden(c.g.membership, true);
  setHidden(c.g.holdings, true);
  setAtlasState({ timeline: null, evidence: null });
}
