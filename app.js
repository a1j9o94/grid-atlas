// The explorable market map.
// v2: Wholesale + Rules layers live. Wires / You land next.
import { geoAlbersUsa, geoPath, feature, mesh } from "./vendor.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LAYERS = ["wholesale", "rules", "wires", "you", "history"];
const READY = new Set(["wholesale", "rules", "wires", "you", "history"]);
const FILL = {
  PJM: "var(--r-pjm)", ERCOT: "var(--r-ercot)", MISO: "var(--r-miso)",
  SPP: "var(--r-spp)", CAISO: "var(--r-caiso)", NYISO: "var(--r-nyiso)",
  ISONE: "var(--r-isone)", NONE: "var(--r-none)",
  // SPP West: same operator as SPP, so same ochre, hatched to mark that it
  // sits on the other side of the East-West interconnection seam.
  SPPWEST: "url(#hatch-sppwest)",
};
// HTML swatches can't reference SVG patterns; mirror the hatch in CSS.
function swatchStyle(rto) {
  if (rto === "SPPWEST")
    return "background: repeating-linear-gradient(45deg, #c99a2e 0 4px, #7a621f 4px 5.5px)";
  return `background:${FILL[rto]}`;
}
const TRANSITION_SWATCH = "background: repeating-linear-gradient(-45deg, #b4552d 0 4px, #f0d8ca 4px 5.5px)";
// wires layer: ownership as ONE hue, stepped from investor-owned (light) to
// citizen-owned (dark). Any two contrasting hues at this area coverage reads
// as an election map, so the encoding is ordered "how public is your power
// company" instead of team colors. Ramp validated on the sage surface.
// Colours here, labels in the copy deck. The legend wants one word; the hover
// card carries the full explanation from copy.wires_types.
const WIRE_COLORS = { iou: "#a98cc4", coop: "#7c5fae", public: "#4b3178", other: "#c8c3ae" };
function wireGroup(type) {
  if (type === "INVESTOR OWNED") return "iou";
  if (type === "COOPERATIVE") return "coop";
  if (["MUNICIPAL", "POLITICAL SUBDIVISION", "STATE", "FEDERAL"].includes(type)) return "public";
  return "other";
}
function titleCase(name) {
  return name.toLowerCase()
    .replace(/ - \([a-z]{2}\)$/i, "")
    .replace(/\b[a-z]/g, c => c.toUpperCase())
    .replace(/\bLlc\b/g, "LLC").replace(/\bInc\b/g, "Inc");
}

const [copy, rules, statesTopo, rtosTopo, transitionsTopo, statePrices] = await Promise.all([
  fetch("data/copy.json").then(r => r.json()),
  fetch("data/rules.json").then(r => r.json()),
  fetch("data/states.topo.json").then(r => r.json()),
  fetch("data/rtos.topo.json").then(r => r.json()),
  fetch("data/transitions.topo.json").then(r => r.json()),
  fetch("data/state-prices.json").then(r => (r.ok ? r.json() : null)).catch(() => null),
]);

// Sequential ramps, built in OKLCH at even lightness steps. Lightness carries
// the information, so they survive any colour vision and print. Never used for
// identity: the categorical encodings keep their own hues.
// All four run L 0.895 down to 0.415 in even steps of 0.12, so no ramp reads as
// darker than another at the same step. Solar sits at hue 95 rather than
// somewhere warmer: the outage ramp already owns hue 45, and two gold-brown maps
// would make switching colour measures look like nothing had changed.
const RAMPS = {
  price: ["#c5e5e5", "#97c1c0", "#6a9d9c", "#3c7b7a", "#00595a"],
  outage: ["#fad5c5", "#daac97", "#ba846b", "#9a5d41", "#7a3713"],
  solar: ["#eddda0", "#ccb55f", "#a88f29", "#816c00", "#5b4a00"],
  meter: ["#c7dffa", "#92bae4", "#6295c9", "#3c71a5", "#234e78"],
};
const NO_DATA = "#dcdccf";
// A utility whose parent falls outside the named twenty still has a parent.
// Painting it the same as a town-owned utility would say the opposite, so it
// gets its own neutral, darker than "no parent" and quieter than the named hues.
const OTHER_PARENT = "#9aa08c";

// Bucket a value onto a ramp. Quantiles rather than equal intervals, because
// these distributions have long tails: Hawaii at 42.86 cents would otherwise
// flatten the other fifty states into the first two steps.
//
// A measure can override with `fixed` breaks, and one has to. Smart meter
// rollout is close to binary per utility, so its quantiles come out as
// [0, 59.13, 100, 100]: two identical breaks drawing a five-step legend over a
// three-colour map. Quantiles need a spread distribution to describe.
function makeScale(values, ramp, fixed) {
  const sorted = values.filter(v => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return { of: () => NO_DATA, breaks: [], ramp };
  const breaks = fixed ? fixed.slice(0, ramp.length - 1) : [];
  if (!fixed) for (let i = 1; i < ramp.length; i++) breaks.push(sorted[Math.floor((sorted.length * i) / ramp.length)]);
  return {
    ramp,
    breaks,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    of(v) {
      if (v == null || !Number.isFinite(v)) return NO_DATA;
      let i = 0;
      while (i < breaks.length && v >= breaks[i]) i++;
      return ramp[i];
    },
  };
}

const WIRE_GROUPS = Object.fromEntries(Object.entries(WIRE_COLORS).map(([g, color]) =>
  [g, { color, label: copy.wires_groups?.[g]?.label ?? g, phrase: copy.wires_groups?.[g]?.phrase ?? "" }]));

const statesFC = feature(statesTopo, Object.values(statesTopo.objects)[0]);
const rtosFC = feature(rtosTopo, Object.values(rtosTopo.objects)[0]);
const transitionsFC = feature(transitionsTopo, Object.values(transitionsTopo.objects)[0]);
const stateLines = mesh(statesTopo, Object.values(statesTopo.objects)[0], (a, b) => a !== b);

const projection = geoAlbersUsa().fitExtent([[8, 8], [967, 602]], statesFC);
const path = geoPath(projection);

// ---- svg scaffolding ----
const svg = document.getElementById("map");
svg.innerHTML = `
  <defs>
    <filter id="wobble" filterUnits="userSpaceOnUse" x="-20" y="-20" width="1020" height="660" primitiveUnits="userSpaceOnUse">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="11" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="6.5" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <pattern id="hatch-sppwest" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="var(--r-spp)"/>
      <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(38,48,31,0.4)" stroke-width="1.6"/>
    </pattern>
    <pattern id="hatch-transition" width="0.18" height="0.18" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
      <rect width="0.18" height="0.18" fill="var(--r-ercot)"/>
      <line x1="0" y1="0" x2="0" y2="0.18" stroke="rgba(246,238,224,0.95)" stroke-width="0.045"/>
    </pattern>
    <!-- lamplight for the 1900 plate: a city with its own station, and nothing
         between the dots. Gradient rather than a blur filter, because a filter
         in user space would displace at a fixed size the way #wobble does. -->
    <radialGradient id="lampglow">
      <stop offset="0%" stop-color="#f2d68a" stop-opacity="0.95"/>
      <stop offset="40%" stop-color="#e0a838" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#e0a838" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g id="g-rto" filter="url(#wobble)"></g>
  <g id="g-transitions" filter="url(#wobble)"></g>
  <g id="g-rules" filter="url(#wobble)" hidden></g>
  <g id="g-wires" filter="url(#wobble)" hidden></g>
  <!-- No wobble on the cartogram. The hand-ink filter displaces by an absolute
       6.5px, which would fling a 1px circle several times its own width off
       position and corrupt the area encoding this view exists to show. -->
  <g id="g-cartogram" hidden></g>
  <g id="g-sizekey" hidden></g>
  <g id="g-you" hidden></g>
  <!-- history: the ground for a past plate. Under the state lines, so the
       borders you know still sit on top of a map you do not. -->
  <g id="g-time-base" filter="url(#wobble)" hidden></g>
  <g id="g-zipoutline"></g>
  <g id="g-statelines"></g>
  <g id="g-labels"></g>
  <g id="g-trivia"></g>
  <!-- history marks ride above everything, and never through #wobble: it
       displaces by an absolute 6.5px, which would throw a 2px city dot several
       times its own width off the city it stands for. -->
  <g id="g-time-marks" hidden></g>
`;
const gRto = svg.querySelector("#g-rto");
const gTransitions = svg.querySelector("#g-transitions");
const gRules = svg.querySelector("#g-rules");
const gWires = svg.querySelector("#g-wires");
const gCartogram = svg.querySelector("#g-cartogram");
const gSizeKey = svg.querySelector("#g-sizekey");
const gYou = svg.querySelector("#g-you");
const gTimeBase = svg.querySelector("#g-time-base");
const gTimeMarks = svg.querySelector("#g-time-marks");
const gLines = svg.querySelector("#g-statelines");
const gLabels = svg.querySelector("#g-labels");
const gTrivia = svg.querySelector("#g-trivia");

// wholesale layer marks
for (const f of rtosFC.features) {
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("d", path(f));
  p.setAttribute("fill", FILL[f.properties.RTO] || "#ccc");
  p.setAttribute("class", "region");
  p.dataset.rto = f.properties.RTO;
  gRto.appendChild(p);
}

// The geometry marks the territory that changed. It sits above the current
// wholesale layer, so the hatch reads as ERCOT today with a visible history.
for (const [i, f] of transitionsFC.features.entries()) {
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("d", path(f));
  p.setAttribute("fill", "url(#hatch-transition)");
  p.setAttribute("class", "region transition");
  p.dataset.transition = i;
  p.dataset.rto = f.properties.RTO;
  gTransitions.appendChild(p);
}

// rules layer marks: one path per state, colored by bucket
for (const f of statesFC.features) {
  const abbr = f.properties.STUSPS;
  const st = rules.states[abbr];
  if (!st) continue;
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("d", path(f));
  p.setAttribute("fill", rules.buckets[st.bucket].color);
  p.setAttribute("class", "region");
  p.dataset.state = abbr;
  gRules.appendChild(p);
}

const lines = document.createElementNS(SVG_NS, "path");
lines.setAttribute("d", path(stateLines));
lines.setAttribute("class", "statelines");
gLines.appendChild(lines);

// region labels (wholesale layer): computed centroids with hand nudges; NONE
// uses the two display anchors from the copy deck.
const NUDGE = { ISONE: [26, -14], NYISO: [0, -6], CAISO: [-4, 10], MISO: [10, -20], SPP: [0, 16] };
for (const f of rtosFC.features) {
  const rto = f.properties.RTO;
  if (rto === "NONE") continue;
  const [cx, cy] = path.centroid(f);
  const [dx, dy] = NUDGE[rto] || [0, 0];
  addLabel(copy.regions[rto].name.toUpperCase(), cx + dx, cy + dy, rto === "NYISO" || rto === "ISONE");
}
for (const half of Object.values(copy.regions.NONE.display_split)) {
  const pt = projection(half.anchor);
  if (pt) addLabel(half.label, pt[0], pt[1], true);
}
function addLabel(text, x, y, small) {
  const t = document.createElementNS(SVG_NS, "text");
  t.setAttribute("x", x); t.setAttribute("y", y);
  t.setAttribute("class", "rlabel" + (small ? " small" : ""));
  t.textContent = text;
  gLabels.appendChild(t);
}

// wires layer: lazy-loaded on first open (5.8MB of geometry)
let wiresFeatures = null;
let wiresCounts = null;
// per-utility measures from EIA-861, keyed on utility id. Kept out of the
// geometry so the big topojson stays cached when the numbers change.
let measures = null;
// precomputed Dorling layouts, one per magnitude measure. Relaxing 2,900
// circles in the browser would settle visibly and cost a force library, so the
// pipeline does it and ships the positions.
let cartogram = null;
// null means draw territories by land. Otherwise the id of the measure sizing
// the circles.
let sizeBy = null;

// The layouts are in projected space, so they only line up if the pipeline used
// the same projection this file builds. Say so loudly rather than silently
// drawing every circle in the wrong place.
function assertCartogramProjection() {
  const p = cartogram?.meta?.projection;
  if (!p) return;
  const want = JSON.stringify([[8, 8], [967, 602]]);
  const vb = JSON.stringify([0, 0, 975, 610]);
  if (JSON.stringify(p.fitExtent) !== want || JSON.stringify(p.viewBox) !== vb)
    console.warn("cartogram.json was built for a different projection; circle positions will not match the map", p);
}
async function ensureWires() {
  if (wiresFeatures) return;
  const [topo, meas, carto] = await Promise.all([
    (await fetch("data/wires.topo.json")).json(),
    fetch("data/measures.json").then(r => (r.ok ? r.json() : null)).catch(() => null),
    fetch("data/cartogram.json").then(r => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  measures = meas;
  cartogram = carto;
  // Each measure that offers variants opens on the first one the registry lists.
  // Reliability leads with the storm-free number on purpose: one hurricane can
  // outweigh everything else a utility does in a year.
  for (const m of measures?.measures ?? []) {
    if (m.variants) variantOf[m.id] ??= Object.keys(m.variants)[0];
  }
  assertCartogramProjection();
  const fc = feature(topo, Object.values(topo.objects)[0]);
  // draw big territories first so small ones stay hoverable on top
  wiresFeatures = fc.features
    .map(f => ({ f, area: path.area(f) }))
    .sort((a, b) => b.area - a.area)
    .map(x => x.f);
  wiresCounts = { iou: 0, coop: 0, public: 0, other: 0 };
  wiresFeatures.forEach((f, i) => {
    const g = wireGroup(f.properties.TYPE);
    wiresCounts[g]++;
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", path(f));
    p.setAttribute("fill", WIRE_GROUPS[g].color);
    p.setAttribute("class", "region wire");
    p.dataset.wire = i;
    gWires.appendChild(p);
  });
  buildCircles();
}

// One circle per utility, drawn once and re-aimed whenever the measure changes.
// They carry the same dataset.wire index as the territories, so the existing
// mousemove handler resolves them without knowing they are circles.
let circleEls = null;
function buildCircles() {
  if (!cartogram || circleEls) return;
  circleEls = [];
  wiresFeatures.forEach((f, i) => {
    const id = f.properties.ID;
    const seat = cartogram.centroids[id];
    if (!seat) return;
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("fill", WIRE_GROUPS[wireGroup(f.properties.TYPE)].color);
    c.setAttribute("class", "region dot");
    c.setAttribute("cx", seat[0]);
    c.setAttribute("cy", seat[1]);
    c.setAttribute("r", 0);
    c.dataset.wire = i;
    c.dataset.id = id;
    gCartogram.appendChild(c);
    circleEls.push(c);
  });
}

// Tween from where a utility sits on the ground to where its circle has room,
// growing the radius from nothing. Reuses the ease from animateViewBox.
let morphAnim = null;
function morphCircles(key, ms = 900) {
  if (!cartogram || !circleEls) return;
  if (morphAnim) cancelAnimationFrame(morphAnim);
  const layout = key ? cartogram.measures[key]?.circles : null;
  const from = circleEls.map(c => [+c.getAttribute("cx"), +c.getAttribute("cy"), +c.getAttribute("r")]);
  const to = circleEls.map(c => {
    const seat = cartogram.centroids[c.dataset.id];
    const t = layout?.[c.dataset.id];
    // with no measure, or none reported, the circle collapses back to its seat
    return t ? t : [seat[0], seat[1], 0];
  });
  const ease = t => 1 - Math.pow(1 - t, 3);
  // Seed the clock from the first frame, not from performance.now(). rAF hands
  // back the timestamp of the frame it belongs to, which on a busy load can
  // predate a now() captured just before the request. That makes t negative,
  // and the cubic ease turns a small negative into a large one: radii came out
  // around -600 on the deep-link path.
  let t0 = null;
  const tick = now => {
    if (t0 === null) t0 = now;
    const t = Math.min(1, (now - t0) / ms), k = ease(t);
    for (let i = 0; i < circleEls.length; i++) {
      const a = from[i], b = to[i], c = circleEls[i];
      c.setAttribute("cx", (a[0] + (b[0] - a[0]) * k).toFixed(1));
      c.setAttribute("cy", (a[1] + (b[1] - a[1]) * k).toFixed(1));
      c.setAttribute("r", Math.max(0, a[2] + (b[2] - a[2]) * k).toFixed(2));
    }
    if (t < 1) morphAnim = requestAnimationFrame(tick);
  };
  morphAnim = requestAnimationFrame(tick);
}

// Switch between the land map and a sized map. `key` is null for land.
function setSizeBy(key) {
  sizeBy = key;
  setHidden(gCartogram, current !== "wires");
  gWires.classList.toggle("faded", !!key);
  morphCircles(key);
  renderSizeKey(key);
  renderLegend(current);
  renderSizeControls();
  if (typeof updateUrl === "function") updateUrl(current);
  if (key) {
    const m = copy.cartogram.measures[key];
    card.innerHTML =
      `<h3>${copy.cartogram.intro_title}</h3>` +
      `<p class="c-body">${copy.cartogram.intro_body}</p>` +
      `<p class="c-body c-note"><b>${m.label}.</b> ${m.blurb}</p>`;
  } else if (wiresCounts) showWiresIntro();
}

// Read a measure for one utility. Measures declared as `derived` are computed
// here from two stored fields, so a variable like average price never has to be
// stored twice or kept in sync.
function measureValue(id, measureId, cls = "tot") {
  const u = measures?.utilities?.[id];
  if (!u) return null;
  const spec = measures.measures?.find(m => m.id === measureId);
  if (spec?.derived) {
    const n = u[spec.derived.numerator]?.[cls];
    const d = u[spec.derived.denominator]?.[cls];
    if (n == null || !d) return null;
    return (n / d) * (spec.derived.scale ?? 1);
  }
  return u[measureId]?.[cls] ?? null;
}

// ---- trivia markers (wholesale layer): the map's curiosities ----
const transitionTriviaIds = new Set(transitionsFC.features.map(f => f.properties.TRIVIA));
copy.trivia.forEach((t, i) => {
  const pt = projection(t.anchor.lonlat);
  if (!pt) return;
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "trivia" + (transitionTriviaIds.has(t.id) ? " transition-trivia" : ""));
  g.setAttribute("transform", `translate(${pt[0].toFixed(1)},${pt[1].toFixed(1)})`);
  g.dataset.trivia = i;
  g.dataset.x = pt[0].toFixed(1);
  g.dataset.y = pt[1].toFixed(1);
  if (transitionTriviaIds.has(t.id)) {
    g.innerHTML = `<line class="trivia-leader" x1="2" y1="-2" x2="11" y2="-9"></line>` +
      `<circle cx="15" cy="-12" r="9"></circle><text x="15" y="-12" dy="4">✳</text>`;
  } else {
    g.innerHTML = `<circle r="9"></circle><text dy="4">✳</text>`;
  }
  gTrivia.appendChild(g);
});
function showTrivia(i) {
  const t = copy.trivia[i];
  const transition = transitionsFC.features.find(f => f.properties.TRIVIA === t.id)?.properties;
  const transitionStatus = transition ?
    `<div class="transition-status" aria-label="Changed from ${transition.FROM_RTO} to ${transition.RTO} on ${transition.CHANGED}">` +
      `<span><i style="background:${FILL[transition.FROM_RTO]}"></i><b>Before</b>${transition.FROM_RTO}</span>` +
      `<span class="transition-arrow">→</span>` +
      `<span><i style="background:${FILL[transition.RTO]}"></i><b>Now</b>${transition.RTO}</span>` +
    `</div><p class="transition-date">Changed March 12, 2026</p>` : "";
  card.innerHTML =
    `<div class="c-kicker">${transition ? "Grid change" : "Curiosity"}${t.verified ? "" : " · draft, still being checked"}</div>` +
    `<h3>${t.title}</h3>` +
    transitionStatus + `<p class="c-body">${t.body}</p>`;
}
gTrivia.addEventListener("mouseover", e => {
  const g = e.target.closest(".trivia");
  if (g) showTrivia(+g.dataset.trivia);
});
gTrivia.addEventListener("click", e => {
  const g = e.target.closest(".trivia");
  if (g) showTrivia(+g.dataset.trivia);
});

// ---- You layer: zip search, fly-to, your place in the stack ----
const zipForm = document.getElementById("zip-search");
const zipInput = document.getElementById("zip-input");
const zipMsg = document.getElementById("zip-msg");
const zoomReset = document.getElementById("zoom-reset");
const HOME_VIEW = [0, 0, 975, 610];
let viewAnim = null;

function youBase() {
  if (gYou.dataset.base) return;
  gYou.dataset.base = "1";
  for (const f of statesFC.features) {
    // Albers USA has no place for Puerto Rico, Guam, the Virgin Islands,
    // American Samoa or the Marianas, so path() hands back null for them.
    // Passing that to setAttribute writes the string "null" and the browser
    // rejects the path. Skip them: the omission is footnoted in the copy deck.
    const d = path(f);
    if (!d) continue;
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "#e4e7db");
    gYou.appendChild(p);
  }
  const zg = document.createElementNS(SVG_NS, "g");
  zg.id = "g-zips";
  gYou.appendChild(zg);
}

// viewBox is the single source of zoom state; setVb also scales the hand-inked
// wobble down with zoom so boundaries stay crisp, and manages the reset button.
const wobbleDisp = svg.querySelector("#wobble feDisplacementMap");
function getVb() { return svg.getAttribute("viewBox").split(" ").map(Number); }
function setVb(v) {
  svg.setAttribute("viewBox", v.join(" "));
  const k = HOME_VIEW[2] / v[2];
  wobbleDisp.setAttribute("scale", (6.5 / Math.max(1, k * 0.75)).toFixed(2));
  // trivia markers keep their on-screen size at any zoom
  const mk = 1 / Math.max(1, k * 0.8);
  for (const m of gTrivia.children) {
    m.setAttribute("transform", `translate(${m.dataset.x},${m.dataset.y}) scale(${mk.toFixed(3)})`);
  }
  if (typeof current !== "undefined" && (current === "wires" || current === "you"))
    setHidden(zoomReset, k < 1.05);
}
function animateViewBox(to, ms = 900) {
  if (viewAnim) cancelAnimationFrame(viewAnim);
  const from = getVb();
  // seeded from the first frame: rAF's timestamp can predate performance.now(),
  // which drives t negative and the cubic ease overshoots hard
  let t0 = null;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const tick = now => {
    if (t0 === null) t0 = now;
    const t = Math.min(1, (now - t0) / ms), k = ease(t);
    setVb(from.map((v, i) => v + (to[i] - v) * k));
    if (t < 1) viewAnim = requestAnimationFrame(tick);
  };
  viewAnim = requestAnimationFrame(tick);
}

// ---- free zoom & pan (wires and you layers) ----
const zoomable = () => current === "wires" || current === "you";
function zoomAt(pt, factor) {
  const [x, y, w, h] = getVb();
  const nw = Math.min(Math.max(w * factor, HOME_VIEW[2] / 32), HOME_VIEW[2] * 1.15);
  const k = nw / w, nh = h * k;
  setVb([pt.x - (pt.x - x) * k, pt.y - (pt.y - y) * k, nw, nh]);
}
svg.addEventListener("wheel", e => {
  if (!zoomable()) return;
  e.preventDefault();
  zoomAt(svgPoint(e), Math.exp(e.deltaY * 0.0022));
}, { passive: false });
svg.addEventListener("dblclick", e => { if (zoomable()) zoomAt(svgPoint(e), 0.5); });

let drag = null;
let pinch = null;
svg.addEventListener("pointerdown", e => {
  if (!zoomable() || pinch || e.button !== 0) return;
  drag = { x: e.clientX, y: e.clientY, vb: getVb() };
  svg.setPointerCapture(e.pointerId);
});
svg.addEventListener("pointermove", e => {
  if (!drag || pinch) return;
  const r = svg.getBoundingClientRect();
  const [x, y, w, h] = drag.vb;
  const dx = (e.clientX - drag.x) * (w / r.width);
  const dy = (e.clientY - drag.y) * (h / r.height);
  setVb([x - dx, y - dy, w, h]);
});
svg.addEventListener("pointerup", () => { drag = null; });
svg.addEventListener("pointercancel", () => { drag = null; });

svg.addEventListener("touchstart", e => {
  if (zoomable() && e.touches.length === 2) {
    drag = null;
    pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY);
  }
}, { passive: true });
svg.addEventListener("touchmove", e => {
  if (!zoomable() || e.touches.length !== 2 || !pinch) return;
  e.preventDefault();
  const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
    e.touches[0].clientY - e.touches[1].clientY);
  const mid = svgPoint({
    clientX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
    clientY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
  });
  zoomAt(mid, pinch / d);
  pinch = d;
}, { passive: false });
svg.addEventListener("touchend", () => { pinch = null; }, { passive: true });

const zctaCache = {};
async function zctaShard(pfx) {
  if (!zctaCache[pfx]) {
    const [geo, lookup] = await Promise.all([
      fetch(`data/zcta/${pfx}.topo.json`).then(r => r.ok ? r.json() : null),
      fetch(`data/zip/${pfx}.json`).then(r => r.ok ? r.json() : null),
    ]);
    zctaCache[pfx] = { geo, lookup };
  }
  return zctaCache[pfx];
}

async function findZip(zip) {
  zipMsg.textContent = "Looking…";
  const shard = await zctaShard(zip.substring(0, 2));
  const topo = shard.geo;
  const fc = topo ? feature(topo, Object.values(topo.objects)[0]) : { features: [] };
  const target = fc.features.find(f => f.properties.GEOID20 === zip);
  const utils = shard.lookup?.[zip] || [];
  if (!target && !utils.length) {
    zipMsg.textContent = "We can't find that zip. Try another?";
    return;
  }
  zipMsg.textContent = "";

  // on the Wires layer the search flies to your area and outlines your zip
  // over the utility pieces, then hands you back to hover.
  if (current === "wires") {
    const zo = svg.querySelector("#g-zipoutline");
    zo.innerHTML = "";
    let view = HOME_VIEW;
    if (target) {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", path(target) ?? "");
      p.setAttribute("class", "zip-outline");
      zo.appendChild(p);
      const [[x0, y0], [x1, y1]] = path.bounds(target);
      const w = Math.max(x1 - x0, 8), h = Math.max(y1 - y0, 8);
      const pad = Math.max(w, h) * 2.2;
      view = [x0 - pad, y0 - pad, w + 2 * pad, h + 2 * pad];
    }
    animateViewBox(view);
    card.innerHTML = `<h3>Zip ${zip}</h3>` +
      `<p class="c-body">The dashed line is your zip. Hover the pieces around it to meet the companies that own the wires near you.</p>`;
    return;
  }

  youBase();
  const zg = gYou.querySelector("#g-zips");
  zg.innerHTML = "";
  // neighbors for context, target on top
  for (const f of fc.features) {
    if (f.properties.GEOID20 === zip) continue;
    const d = path(f);
    if (!d) continue; // zips the projection cannot place, as above
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "zip-neighbor");
    zg.appendChild(p);
  }
  let view = HOME_VIEW;
  if (target) {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", path(target) ?? "");
    p.setAttribute("class", "zip-target");
    zg.appendChild(p);
    const [[x0, y0], [x1, y1]] = path.bounds(target);
    const w = Math.max(x1 - x0, 8), h = Math.max(y1 - y0, 8);
    const pad = Math.max(w, h) * 1.6;
    view = [x0 - pad, y0 - pad, w + 2 * pad, h + 2 * pad];
  }
  animateViewBox(view);
  setHidden(zoomReset, false);
  await showYouCard(zip, utils);
}

async function showYouCard(zip, utils) {
  // join crosswalk utilities to the wires layer for grid + ownership
  await ensureWires();
  const seen = new Set();
  utils = utils.filter(u => {
    const k = String(u.id);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const rows = utils.slice(0, 3).map(u => {
    const match = wiresFeatures.find(f => String(f.properties.ID) === String(u.id));
    const g = match ? wireGroup(match.properties.TYPE) : (u.own === "Investor Owned" ? "iou" : u.own === "Cooperative" ? "coop" : u.own ? "public" : "other");
    const rto = match ? match.properties.RTO : null;
    return { name: titleCase(u.name), group: g, rto, st: u.st };
  });
  const st = rows[0]?.st;
  const rule = st && rules.states[st] ? rules.states[st] : null;
  const bucket = rule ? rules.buckets[rule.bucket] : null;
  // a zip can straddle a grid border (Caldwell, Lubbock): name each market
  const rtoSet = [...new Set(rows.filter(r => r.rto).map(r => r.rto))];
  let rtoName = null;
  if (rtoSet.length === 1) {
    rtoName = rtoSet[0] === "NONE"
      ? "No RTO. Utilities run this grid themselves."
      : `${copy.regions[rtoSet[0]].name} runs the market here.`;
  } else if (rtoSet.length > 1) {
    rtoName = "This zip sits near a grid border. " + rows.filter(r => r.rto)
      .map(r => `${r.name} trades in ${r.rto === "NONE" ? "no market" : copy.regions[r.rto].name}`)
      .join(". ") + ".";
  }
  // the honest bottom line: in choice states, co-ops and city utilities are
  // usually exempt, so their customers still have one seller.
  // Exception: Lubbock's city utility joined the Texas retail market in 2024.
  let choiceLine = "";
  if (bucket) {
    const primary = rows[0];
    const exemptOwner = primary && (primary.group === "coop" || primary.group === "public");
    const lubbock = primary && /Lubbock/i.test(primary.name);
    if (rule.bucket === "choice" && exemptOwner && !lubbock) {
      const kind = primary.group === "coop" ? "a co-op" : "city-owned";
      choiceLine = `<div class="c-choice">Here, probably not: ${primary.name} is ${kind}, and those usually keep one seller even in choice states. Most of the state can pick.</div>`;
    } else if (lubbock) {
      choiceLine = `<div class="c-choice">${bucket.label}: Lubbock's city utility joined the Texas shopping market in 2024, the first to do it voluntarily.</div>`;
    } else {
      choiceLine = `<div class="c-choice">${bucket.label}: ${bucket.body}</div>`;
    }
  }
  card.innerHTML =
    `<h3>Zip ${zip} in the stack</h3>` +
    `<p class="c-body"><b>Your wires:</b> ${rows.map(r => `${r.name} (${WIRE_GROUPS[r.group].phrase})`).join(", ")}${utils.length > 3 ? " and others" : ""}.</p>` +
    choiceLine +
    (rtoName ? `<p class="c-body c-note"><b>Your market:</b> ${rtoName}</p>` : "") +
    `<p class="c-body c-fine">Zip shapes are the Census version of zip codes. Utility match comes from a 2020 federal lookup.</p>`;
}

zipForm.addEventListener("submit", e => {
  e.preventDefault();
  const zip = zipInput.value.trim();
  if (/^\d{5}$/.test(zip)) findZip(zip);
});
zoomReset.addEventListener("click", () => {
  animateViewBox(HOME_VIEW);
  setHidden(zoomReset, true);
});

// ---- rules layer: shade by choice, or by what power costs ----
// State-level on purpose. In a choice state the wires company does not bill for
// energy, the retailer does, and retailers have no territory to draw, so an
// honest price needs revenue from providers that are not on this map at all.
let shadeBy = "bucket";
let priceScales = {};
if (statePrices) {
  for (const m of statePrices.measures) {
    if (m.kind !== "sequential") continue;
    priceScales[m.id] = makeScale(Object.values(statePrices.states).map(s => s[m.id]),
      RAMPS.price);
  }
}
const shadeControls = document.getElementById("shade-controls");
function renderShadeControls() {
  if (!statePrices) return;
  shadeControls.innerHTML = `<span class="sz-label">${copy.controls.shade_label}</span>` +
    statePrices.measures.map(m =>
      `<button class="sz-btn" data-shade="${m.id}" aria-pressed="${shadeBy === m.id}">${m.label}</button>`).join("");
}
shadeControls.addEventListener("click", e => {
  const b = e.target.closest("[data-shade]");
  if (b) setShadeBy(b.dataset.shade);
});
function stateFill(abbr) {
  if (shadeBy === "bucket") {
    const st = rules.states[abbr];
    return st ? rules.buckets[st.bucket].color : NO_DATA;
  }
  return priceScales[shadeBy].of(statePrices.states[abbr]?.[shadeBy]);
}
function setShadeBy(key) {
  shadeBy = key;
  for (const p of gRules.children) p.setAttribute("fill", stateFill(p.dataset.state));
  renderShadeControls();
  renderLegend("rules");
  if (typeof updateUrl === "function") updateUrl(current);
  if (key === "bucket") showState("TX");
  else {
    const m = statePrices.measures.find(x => x.id === key);
    card.innerHTML = `<h3>${copy.controls.price_intro_title}</h3>` +
      `<p class="c-body">${copy.controls.price_intro_body}</p>` +
      (m.note ? `<p class="c-body c-note">${m.note}</p>` : "");
  }
}

// size controls: land vs each magnitude measure, inside the wires layer so the
// four-step stack stays four steps.
const sizeControls = document.getElementById("size-controls");
function renderSizeControls() {
  if (!cartogram) return;
  const c = copy.cartogram;
  const opts = [[null, c.toggle_land], ...Object.keys(cartogram.measures).map(k => [k, c.measures[k].label])];
  sizeControls.innerHTML = `<span class="sz-label">${c.toggle_label}</span>` + opts
    .map(([k, label]) =>
      `<button class="sz-btn" data-size="${k ?? ""}" aria-pressed="${sizeBy === k}">${label}</button>`)
    .join("");
}
sizeControls.addEventListener("click", e => {
  const b = e.target.closest("[data-size]");
  if (b) setSizeBy(b.dataset.size || null);
});

// ---- wires layer: colour by ownership, by parent, or by any colour measure ----
// These are all attributes of the same territories, so they share the colour
// channel rather than each becoming a layer. The channel already answered "who
// owns this" through the ownership types; parent company is a sharper answer to
// the same question.
//
// Ownership and parent are read off the geometry. Everything else comes from the
// measure registry: any measure marked `colourOnly` becomes a button here
// without this file learning what it means. That is the whole point of the
// registry, and it is why rooftop solar and smart meters needed no new branches.
let colourBy = "type";
let parentGroups = null;   // holding company -> { color, meters, n }
const colourScales = new Map();
const variantOf = {};      // measure id -> which variant is showing
// Which ramp suits which measure. A measure with no entry falls back rather
// than failing, so a new one is legible before anyone picks its colours.
const RAMP_FOR = { saidi: "outage", solarw: "solar", amishare: "meter" };

const measureSpec = id => measures?.measures?.find(m => m.id === id);
const colourMeasures = () => measures?.measures?.filter(m => m.colourOnly) ?? [];
const isColourMeasure = id => id !== "type" && id !== "parent" && !!measureSpec(id)?.colourOnly;

// Format a value the way its registry entry asks. Keeps the legend ticks and the
// hover card reading identically without either knowing the measure.
//
// `precise` is for legend ticks, where a rounded break can misstate the scale.
// The top smart-meter break is 99.9%, and rounding it to "100%" would tell the
// reader the darkest step begins at a value nothing can exceed. Data values stay
// rounded, because "84%" is the honest precision for a share of meters.
function fmtMeasure(spec, precise) {
  if (spec?.format === "percent0")
    return v => `${precise && !Number.isInteger(v) ? v.toFixed(1) : Math.round(v)}%`;
  if (spec?.format === "decimal1") return v => v.toFixed(1);
  return v => Math.round(v).toLocaleString();
}

// Reliability stores a block of storm variants where other measures store a
// block of customer classes, so it is read directly and the rest go through the
// class-aware reader. `cls` lets a measure name the class it means: rooftop
// solar per home is residential over residential, never total over total.
function colourValue(uid, id) {
  const spec = measureSpec(id);
  if (spec?.variants) return measures?.utilities?.[uid]?.[id]?.[variantOf[id]] ?? null;
  return measureValue(uid, id, spec?.cls ?? "tot");
}
function colourScale(id) {
  if (!wiresFeatures || !isColourMeasure(id)) return null;
  const spec = measureSpec(id);
  const key = spec.variants ? `${id}:${variantOf[id]}` : id;
  if (!colourScales.has(key)) {
    colourScales.set(key, makeScale(
      wiresFeatures.map(f => colourValue(f.properties.ID, id)),
      RAMPS[RAMP_FOR[id]] ?? RAMPS.price, spec.breaks));
  }
  return colourScales.get(key);
}

// HIFLD repeats the utility's own name in HOLDING_CO for the ~2,700 municipals
// and co-ops that have no parent, so a plain distinct count says 2,831 and
// hides the story. Only a parent that genuinely differs from the utility name,
// and covers more than one utility or a lot of meters, is a group.
const PARENT_COLORS = [
  "#3a6ea8", "#b4552d", "#1d8a6a", "#c99a2e", "#a05680", "#66801c", "#6b5aa0", "#8a94a8",
  "#2e5c8a", "#8f4423", "#176e55", "#a17c25", "#804566", "#516319", "#554880", "#6e7686",
  "#20496e", "#6d341b", "#115442", "#7a5d1c",
];
function buildParentGroups() {
  if (parentGroups || !wiresFeatures) return;
  const tally = new Map();
  for (const f of wiresFeatures) {
    const p = f.properties;
    const parent = (p.HOLDING_CO || "").trim();
    if (!parent || parent.toUpperCase() === (p.NAME || "").trim().toUpperCase()) continue;
    const t = tally.get(parent) ?? { meters: 0, n: 0 };
    t.meters += measureValue(p.ID, "cust") ?? 0;
    t.n++;
    tally.set(parent, t);
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1].meters - a[1].meters).slice(0, PARENT_COLORS.length);
  parentGroups = new Map(ranked.map(([name, t], i) => [name, { ...t, color: PARENT_COLORS[i], rank: i }]));
}
function wireFill(f) {
  const p = f.properties;
  if (colourBy === "parent") {
    const parent = (p.HOLDING_CO || "").trim();
    if (!parent || parent.toUpperCase() === (p.NAME || "").trim().toUpperCase()) return NO_DATA;
    return parentGroups?.get(parent)?.color ?? OTHER_PARENT;
  }
  if (isColourMeasure(colourBy)) {
    return colourScale(colourBy)?.of(colourValue(p.ID, colourBy)) ?? NO_DATA;
  }
  return WIRE_GROUPS[wireGroup(p.TYPE)].color;
}
function repaintWires() {
  if (!wiresFeatures) return;
  wiresFeatures.forEach((f, i) => {
    const fill = wireFill(f);
    gWires.children[i]?.setAttribute("fill", fill);
  });
  for (const c of gCartogram.children) {
    const f = wiresFeatures[+c.dataset.wire];
    if (f) c.setAttribute("fill", wireFill(f));
  }
}
const colourControls = document.getElementById("colour-controls");
function renderColourControls() {
  const opts = [["type", copy.controls.colour_type], ["parent", copy.controls.colour_parent]];
  for (const m of colourMeasures()) opts.push([m.id, copy.controls[`colour_${m.id}`] ?? m.label]);
  const active = isColourMeasure(colourBy) ? measureSpec(colourBy) : null;
  colourControls.innerHTML = `<span class="sz-label">${copy.controls.colour_label}</span>` +
    opts.map(([k, label]) => `<button class="sz-btn" data-colour="${k}" aria-pressed="${colourBy === k}">${label}</button>`).join("") +
    (active?.variants
      ? `<span class="sz-sub">` + Object.entries(active.variants)
        .map(([k, label]) => `<button class="sz-btn sz-alt" data-variant="${k}" aria-pressed="${variantOf[colourBy] === k}">${label}</button>`).join("") + `</span>`
      : "");
}
colourControls.addEventListener("click", e => {
  const c = e.target.closest("[data-colour]");
  if (c) return setColourBy(c.dataset.colour);
  const v = e.target.closest("[data-variant]");
  if (v) { variantOf[colourBy] = v.dataset.variant; setColourBy(colourBy); }
});
function setColourBy(key) {
  colourBy = key;
  if (key === "parent") buildParentGroups();
  repaintWires();
  renderColourControls();
  renderLegend("wires");
  if (typeof updateUrl === "function") updateUrl(current);
  const c = copy.controls;
  if (key === "parent") {
    card.innerHTML = `<h3>${c.parent_intro_title}</h3><p class="c-body">${c.parent_intro_body}</p>`;
  } else if (isColourMeasure(key)) {
    // Copy deck first, registry note as the fallback. A measure that nobody has
    // written an introduction for still explains itself.
    const spec = measureSpec(key);
    const note = c[`${key}_note`] ?? spec.note;
    card.innerHTML = `<h3>${c[`${key}_intro_title`] ?? spec.label}</h3>` +
      `<p class="c-body">${c[`${key}_intro_body`] ?? ""}</p>` +
      (note ? `<p class="c-body c-note">${note}</p>` : "");
  } else if (!sizeBy && wiresCounts) showWiresIntro();
}

// legend (content depends on layer)
const legend = document.getElementById("legend");
const fmtBig = v => v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : `${v}`;

// The size key is drawn on the plate rather than in the HTML legend, in the
// map's own coordinates, so its circles are exactly the size of the map's. A
// key that had to be rescaled to fit a legend strip would not be a size key.
// It sits bottom-left, over the empty Pacific.
function renderSizeKey(key) {
  const m = key && cartogram?.measures[key];
  setHidden(gSizeKey, !m);
  if (!m) return;
  const spec = measures?.measures?.find(x => x.id === key);
  const vals = [m.max, m.max / 8, m.max / 40];
  const R = m.maxRadius;
  const rs = vals.map(v => R * Math.sqrt(v / m.max));
  // Bottom-centre-left is the emptiest part of the plate at every measure, but
  // never completely clear, so the key sits on its own backing panel.
  const baseX = 306, baseY = 584;
  gSizeKey.innerHTML =
    `<rect class="sk-plate" x="${baseX - R - 10}" y="${baseY - 2 * R - 20}" ` +
    `width="${2 * R + 78}" height="${2 * R + 36}"/>` +
    rs.map(r => `<circle cx="${baseX}" cy="${(baseY - r).toFixed(1)}" r="${r.toFixed(1)}"/>`).join("") +
    rs.map((r, i) =>
      `<line x1="${baseX}" y1="${(baseY - 2 * r).toFixed(1)}" x2="${(baseX + R + 6).toFixed(1)}" y2="${(baseY - 2 * r).toFixed(1)}"/>` +
      `<text x="${(baseX + R + 9).toFixed(1)}" y="${(baseY - 2 * r + 3).toFixed(1)}">${fmtBig(vals[i])}</text>`).join("") +
    `<text class="sk-unit" x="${baseX - R - 4}" y="${baseY + 11}">${spec?.short ?? ""}</text>`;
}

// The strip keeps the words; the circles are on the plate.
function sizeLegend(key) {
  const m = cartogram?.measures[key];
  if (!m) return "";
  const missing = Object.keys(cartogram.centroids).length - Object.keys(m.circles).length;
  return `<span class="lg-size">${copy.cartogram.legend_note}` +
    (missing > 0 ? ` ${copy.cartogram.missing_note.replace("{n}", missing.toLocaleString())}` : "") + `</span>`;
}
// A sequential scale gets a stepped bar with the break values under it, not a
// list of swatches. The steps are quantiles, so the numbers are what separates
// them and the bar alone would not tell you where you are.
function rampLegend(scale, label, fmt = v => v.toFixed(1)) {
  const cells = scale.ramp.map(c => `<span class="lg-step" style="background:${c}"></span>`).join("");
  const marks = scale.breaks.map(b => `<span class="lg-tick">${fmt(b)}</span>`).join("");
  return `<span class="lg-ramp"><span class="lg-ramp-label">${label}</span>` +
    `<span class="lg-bar">${cells}</span><span class="lg-ticks">${marks}</span></span>` +
    `<span class="lg-item"><span class="lg-swatch" style="background:${NO_DATA}"></span>${copy.controls.not_reported}</span>`;
}

const changedGridsItem = `<span class="lg-item"><span class="lg-swatch" style="${TRANSITION_SWATCH}"></span>Changed grids in 2026</span>`;

function renderLegend(key) {
  if (key === "wholesale") {
    legend.innerHTML = changedGridsItem;
  } else if (key === "history") {
    const f = framesById.get(frameId);
    // The last plate IS the wholesale layer, so it borrows that legend rather
    // than describing the same marks in different words.
    if (f?.geometry?.kind === "current") { legend.innerHTML = changedGridsItem; return; }
    const swatch = s => s === "dot" ? `<span class="lg-swatch lg-dot"></span>`
      : s === "dot-story" ? `<span class="lg-swatch lg-dot lg-dot-story"></span>`
      : `<span class="lg-swatch" style="background:${s}"></span>`;
    legend.innerHTML = (f?.legend ?? []).map(it =>
      `<span class="lg-item">${swatch(it.swatch)}${it.label}</span>`).join("") +
      (f?.ship === false ? `<span class="lg-size">This plate is still being inked.</span>` : "");
  } else if (key === "rules") {
    if (shadeBy === "bucket" || !statePrices) {
      legend.innerHTML = Object.values(rules.buckets)
        .map(b => `<span class="lg-item"><span class="lg-swatch" style="background:${b.color}"></span>${b.label}</span>`)
        .join("");
    } else {
      const m = statePrices.measures.find(x => x.id === shadeBy);
      const pct = shadeBy === "shopped";
      legend.innerHTML = rampLegend(priceScales[shadeBy], m.short ?? m.label,
        v => (pct ? `${Math.round(v * 100)}%` : v.toFixed(1)));
    }
  } else if (key === "wires") {
    let base;
    if (colourBy === "parent" && parentGroups) {
      const shown = [...parentGroups.entries()].slice(0, 8);
      const covered = [...parentGroups.values()].reduce((a, g) => a + g.meters, 0);
      base = shown.map(([name, g]) =>
        `<span class="lg-item"><span class="lg-swatch" style="background:${g.color}"></span>${titleCase(name)}</span>`).join("") +
        `<span class="lg-item"><span class="lg-swatch" style="background:${OTHER_PARENT}"></span>Another parent company</span>` +
        `<span class="lg-item"><span class="lg-swatch" style="background:${NO_DATA}"></span>Owned locally</span>` +
        `<span class="lg-size">${parentGroups.size} parent companies cover ${Math.round(covered / 1e6)} million meters, about half the country.</span>`;
    } else if (isColourMeasure(colourBy) && colourScale(colourBy)) {
      const spec = measureSpec(colourBy);
      base = rampLegend(colourScale(colourBy), spec.short ?? spec.label, fmtMeasure(spec, true));
    } else {
      base = Object.entries(WIRE_GROUPS)
        .map(([g, w]) => `<span class="lg-item"><span class="lg-swatch" style="background:${w.color}"></span>${w.label}${wiresCounts ? ` · ${wiresCounts[g].toLocaleString()}` : ""}</span>`)
        .join("");
    }
    legend.innerHTML = base + (sizeBy ? sizeLegend(sizeBy) : "");
  }
}

// ---- hover cards ----
const card = document.getElementById("card");
function showRegion(rto, splitKey) {
  const r = copy.regions[rto];
  const body = rto === "NONE" && splitKey ? r.display_split[splitKey].body : r.body;
  card.innerHTML =
    `<span class="c-swatch" style="${swatchStyle(rto)}"></span><h3>${r.name}</h3>` +
    `<p class="c-body">${body}</p>` +
    `<div class="c-stats"><span class="c-stat"><b>${r.stats.states}</b>states</span>` +
    `<span class="c-stat"><b>${r.stats.people}</b>people</span></div>` +
    `<div class="c-choice">${r.choice}</div>`;
}
function showState(abbr) {
  const st = rules.states[abbr];
  const bucket = rules.buckets[st.bucket];
  const name = statesFC.features.find(f => f.properties.STUSPS === abbr)?.properties.NAME || abbr;
  card.innerHTML =
    `<span class="c-swatch" style="background:${bucket.color}"></span><h3>${name}</h3>` +
    `<div class="c-choice">${bucket.label}</div>` +
    `<p class="c-body">${bucket.body}</p>` +
    (st.note ? `<p class="c-body c-note">${st.note}</p>` : "");
}
function showWire(i) {
  const p = wiresFeatures[i].properties;
  const g = wireGroup(p.TYPE);
  const typeInfo = copy.wires_types[p.TYPE] || copy.wires_types["NOT AVAILABLE"];
  // Meters, not people. These are billing accounts, and commercial and
  // industrial ones are in the count. HIFLD's own field is only the fallback:
  // it is blank for every delivery-only utility in Texas, which is why the
  // five biggest wires companies in ERCOT used to show nothing here.
  const meters = measureValue(p.ID, "cust") ?? (p.CUSTOMERS > 0 ? p.CUSTOMERS : null);
  const metersStat = meters
    ? `<span class="c-stat"><b>${Math.round(meters).toLocaleString()}</b>meters</span>`
    : `<span class="c-stat"><b>not reported</b>meters</span>`;
  // Service states come from EIA, because HIFLD's STATE is where the company
  // files its paperwork, not where it serves. PacifiCorp files in Oregon and
  // serves six states; Appalachian Power files in Ohio and serves none of it.
  const served = measures?.utilities?.[p.ID]?.st;
  const where = (served?.length ? served : [p.STATE]).filter(Boolean).join(", ");
  const rtoName = p.RTO === "NONE" ? "No RTO" : (copy.regions[p.RTO]?.name || p.RTO);
  // Whichever channel is carrying a measure, the card has to say what this
  // company's value actually is. Without it the reader can see that a territory
  // is darker, or its circle bigger, and has no way to find out by how much.
  // Meters already have their own stat, so sizing by them adds nothing.
  let measureStat = "";
  for (const key of [colourBy, sizeBy]) {
    const spec = key && key !== "cust" && (isColourMeasure(key) || cartogram?.measures[key]) ? measureSpec(key) : null;
    if (!spec) continue;
    const v = isColourMeasure(key) ? colourValue(p.ID, key) : measureValue(p.ID, key);
    measureStat += `<span class="c-stat"><b>${v == null ? "not reported" : fmtMeasure(spec)(v)}</b>${spec.short ?? spec.label}</span>`;
  }
  card.innerHTML =
    `<span class="c-swatch" style="background:${WIRE_GROUPS[g].color}"></span><h3>${titleCase(p.NAME)}</h3>` +
    `<div class="c-choice">${typeInfo.label} · ${where}</div>` +
    `<p class="c-body">${typeInfo.body}</p>` +
    `<div class="c-stats">${metersStat}${measureStat}<span class="c-stat"><b>${rtoName}</b>grid</span></div>`;
}
function showWiresIntro() {
  card.innerHTML =
    `<h3>Almost 3,000 wire owners</h3>` +
    `<p class="c-body">Every piece on this map is a company that owns poles and wires. Hover any piece to meet it.</p>` +
    `<div class="c-stats">` +
    `<span class="c-stat"><b>${wiresCounts.coop.toLocaleString()}</b>co-ops</span>` +
    `<span class="c-stat"><b>${wiresCounts.iou.toLocaleString()}</b>investor-owned</span>` +
    `<span class="c-stat"><b>${wiresCounts.public.toLocaleString()}</b>public power</span></div>`;
}

function svgPoint(e) {
  const pt = new DOMPoint(e.clientX, e.clientY);
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
svg.addEventListener("mousemove", e => {
  const d = e.target.dataset || {};
  if (current === "wholesale" && d.rto) {
    setHover(gRto, p => p.dataset.rto === d.rto);
    setHover(gTransitions, p => p.dataset.rto === d.rto);
    let splitKey;
    if (d.rto === "NONE") {
      const { x, y } = svgPoint(e);
      const lonlat = projection.invert([x, y]);
      splitKey = lonlat && lonlat[0] < -98 ? "NONE_W" : "NONE_SE";
    }
    showRegion(d.rto, splitKey);
  } else if (current === "rules" && d.state) {
    setHover(gRules, p => p.dataset.state === d.state);
    showState(d.state);
  } else if (current === "wires" && d.wire !== undefined) {
    if (hoveredWire) hoveredWire.classList.remove("hov");
    hoveredWire = e.target;
    hoveredWire.classList.add("hov");
    showWire(+d.wire);
  }
});
let hoveredWire = null;
svg.addEventListener("mouseleave", () => {
  svg.classList.remove("has-hover");
  for (const g of [gRto, gTransitions, gRules]) for (const p of g.children) p.classList.remove("hov");
  if (hoveredWire) { hoveredWire.classList.remove("hov"); hoveredWire = null; }
});
function setHover(group, match) {
  svg.classList.add("has-hover");
  for (const p of group.children) p.classList.toggle("hov", match(p));
}

// ---- the history layer: how the map got this way ----
// Dated plates, not a continuous scrub. The archives support moments and
// membership changes; they do not support annual geometry, and a slider that
// glided through years where nothing happened would be inventing data. Every
// frame, event and excerpt carries sources, and anything that has not been
// through a fact-check pass says so on its own card.
const timelineBar = document.getElementById("timeline-bar");
const tlTrack = document.getElementById("tl-track");
const tlPlayBtn = document.getElementById("tl-play");
let timeline = null;
let frames = [];
let framesById = new Map();
let frameId = null;
let playTimer = null;

async function ensureTimeline() {
  if (timeline) return;
  timeline = await fetch("data/timeline.json").then(r => r.json());
  frames = timeline.frames ?? [];
  framesById = new Map(frames.map(f => [f.id, f]));
  buildTimeBase();
  buildDots();
  renderScrubber();
}

// The ground: every state in the pale unlit paper of the You layer. Tint frames
// repaint these same paths, so recolouring a frame is a fill change and the
// cross-fade comes free from CSS.
function buildTimeBase() {
  if (gTimeBase.dataset.built) return;
  gTimeBase.dataset.built = "1";
  for (const f of statesFC.features) {
    // Albers USA cannot place PR, GU, VI, AS or MP, and path() returns null
    // rather than a d string. Writing that out gives you d="null".
    const d = path(f);
    if (!d) continue;
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "tl-state");
    p.dataset.state = f.properties.STUSPS;
    gTimeBase.appendChild(p);
  }
}

// City dots for the pre-grid plates. Area carries population, not radius:
// New York's 3.4 million against Telluride's 2,446 is a 1,400-to-1 range, and
// on radius the Northeast would be one blot.
function buildDots() {
  if (gTimeMarks.dataset.built) return;
  gTimeMarks.dataset.built = "1";
  const dots = timeline.dots ?? [];
  const maxPop = Math.max(1, ...dots.map(d => d.pop1900 ?? 0));
  const [rMin, rMax] = [1.7, 7.5];
  // Biggest first, so small cities stay on top and stay findable. Same reason
  // the wires layer sorts by area. The hit circle is sized to the dot rather
  // than given a generous floor: a flat 7px floor let Newark, eight miles away
  // and a fourteenth the size, cover New York's target completely, so the
  // largest city in the country could not be hovered at all.
  const order = dots.map((d, i) => ({ d, i, pop: d.pop1900 ?? 0 })).sort((a, b) => b.pop - a.pop);
  for (const { d, i, pop } of order) {
    const pt = projection(d.lonlat);
    if (!pt) continue;
    const r = rMin + (rMax - rMin) * Math.sqrt(pop / maxPop);
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "tl-dot" + (d.story ? " tl-dot-story" : ""));
    g.setAttribute("transform", `translate(${pt[0].toFixed(1)},${pt[1].toFixed(1)})`);
    g.dataset.dot = i;
    g.innerHTML =
      `<circle class="tl-glow" r="${(r * 3.4).toFixed(1)}"/>` +
      `<circle class="tl-core" r="${r.toFixed(2)}"/>` +
      `<circle class="tl-hit" r="${Math.max(3.5, r).toFixed(1)}"/>`;
    gTimeMarks.appendChild(g);
  }
}

// Grow the dots in from nothing when the plate opens. Same cubic ease and the
// same first-frame clock seeding as morphCircles: rAF hands back its own frame
// timestamp, which can predate a performance.now() captured just before, and a
// negative t through a cubic ease overshoots hard.
let dotAnim = null;
function animateDots(ms = 700) {
  if (dotAnim) cancelAnimationFrame(dotAnim);
  const cores = [...gTimeMarks.querySelectorAll(".tl-dot")].map(g => ({
    glow: g.querySelector(".tl-glow"), core: g.querySelector(".tl-core"),
    gr: +g.querySelector(".tl-glow").getAttribute("r"),
    cr: +g.querySelector(".tl-core").getAttribute("r"),
  }));
  if (reduceMotion()) return;
  const ease = t => 1 - Math.pow(1 - t, 3);
  let t0 = null;
  const tick = now => {
    if (t0 === null) t0 = now;
    const k = ease(Math.min(1, (now - t0) / ms));
    for (const c of cores) {
      c.glow.setAttribute("r", (c.gr * k).toFixed(1));
      c.core.setAttribute("r", (c.cr * k).toFixed(2));
    }
    if (k < 1) dotAnim = requestAnimationFrame(tick);
  };
  dotAnim = requestAnimationFrame(tick);
}
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// A frame id is its year, so ?frame= and ?year= resolve the same way: an exact
// id, or the latest plate at or before the year asked for.
function resolveFrame(v) {
  if (v == null) return null;
  if (framesById.has(String(v))) return String(v);
  const y = parseInt(v, 10);
  if (!Number.isFinite(y)) return null;
  let best = null;
  for (const f of frames) if (f.year <= y && (!best || f.year > best.year)) best = f;
  return (best ?? frames[0])?.id ?? null;
}

function setFrame(id) {
  const f = framesById.get(id) ?? frames[frames.length - 1];
  if (!f) return;
  frameId = f.id;
  const kind = f.ship === false ? "pending" : (f.geometry?.kind ?? "pending");
  const showDots = kind === "dots" || kind === "dots+tints";
  const showGround = kind !== "current";
  const showToday = kind === "current";

  setHidden(gTimeBase, !showGround);
  setHidden(gTimeMarks, !showDots);
  // Frame "today" is the wholesale layer, exactly. Nothing is redrawn for it:
  // the marks that already exist are unhidden, so the last plate of the
  // timeline and the first layer of the stack can never drift apart.
  setHidden(gRto, !showToday);
  setHidden(gTransitions, !showToday);
  setHidden(gLabels, !showToday);
  if (showDots) animateDots();
  animateViewBox(HOME_VIEW, reduceMotion() ? 0 : 500);

  renderScrubber();
  renderLegend("history");
  showFrame(f);
  updateUrl("history");
}

function stepFrame(delta) {
  const i = frames.findIndex(f => f.id === frameId);
  const next = frames[Math.min(frames.length - 1, Math.max(0, i + delta))];
  if (next && next.id !== frameId) setFrame(next.id);
}

function renderScrubber() {
  tlTrack.innerHTML = frames.map(f =>
    `<button class="tl-stop" data-frame="${f.id}" aria-pressed="${f.id === frameId}"` +
    (f.ship === false ? ` data-pending="1" title="${f.title} · still being inked"` : ` title="${f.title}"`) +
    `><span class="tl-notch"></span><span class="tl-year">${f.label}</span></button>`).join("");
  const i = frames.findIndex(f => f.id === frameId);
  document.getElementById("tl-prev").disabled = i <= 0;
  document.getElementById("tl-next").disabled = i >= frames.length - 1;
  // Nine stops do not fit a phone, so the track scrolls. Keep the plate you are
  // on inside the window, or pressing "later" moves a notch you cannot see.
  tlTrack.children[i]?.scrollIntoView({ block: "nearest", inline: "center" });
  tlPlayBtn.textContent = playTimer ? "❚❚" : "▶";
  tlPlayBtn.setAttribute("aria-label", playTimer ? "Stop" : "Play through the history");
}

// ---- the frame card, its events, and the evidence behind them ----
function evidenceChips(ids) {
  const chips = (ids ?? []).map(id => {
    const e = timeline.evidence?.[id];
    if (!e) return "";
    const law = e.kind === "law";
    const label = law ? (timeline.law_excerpts?.[e.excerpt]?.label ?? "The law") : e.title;
    // ⌖ for something we looked at, § for something somebody wrote down.
    return `<button class="ev-chip" data-evidence="${id}">${law ? "§" : "⌖"} ${label}</button>`;
  }).join("");
  return chips ? `<div class="ev-chips">${chips}</div>` : "";
}

function draftFlag(o) { return o?.verified === false ? " · draft, still being checked" : ""; }

function showFrame(f) {
  const kicker = `<div class="c-kicker">${f.label}${f.kicker ? ` · ${f.kicker}` : ""}${draftFlag(f)}</div>`;
  if (f.ship === false) {
    card.innerHTML = kicker + `<h3>${f.title}</h3><p class="c-body">${f.body}</p>` +
      `<p class="c-body c-note">This plate is still being inked. The words are here. The map for this moment lands in the next update.</p>`;
    return;
  }
  const events = (f.events ?? []).map(id => {
    const e = timeline.events?.[id];
    if (!e) return "";
    return `<button class="c-event" data-event="${id}">` +
      `<b>${(e.date ?? "").slice(0, 4)}</b><span>${e.title}</span></button>`;
  }).join("");
  card.innerHTML = kicker + `<h3>${f.title}</h3>` +
    `<p class="c-body">${f.body}</p>` +
    (f.note ? `<p class="c-body c-note">${f.note}</p>` : "") +
    (events ? `<div class="c-events">${events}</div>` : "") +
    evidenceChips(f.evidence);
}

function showEvent(id) {
  const e = timeline.events?.[id];
  if (!e) return;
  const ev = [...(e.excerpt ? [`law:${e.excerpt}`] : [])];
  card.innerHTML =
    `<div class="c-kicker">${e.date}${draftFlag(e)}</div><h3>${e.title}</h3>` +
    `<p class="c-body">${e.body}</p>` +
    (ev.length ? `<div class="ev-chips">` + ev.map(k =>
      `<button class="ev-chip" data-excerpt="${k.slice(4)}">§ ${timeline.law_excerpts?.[k.slice(4)]?.label ?? "The law"}</button>`).join("") + `</div>` : "") +
    `<button class="c-back" data-back="1">← back to ${framesById.get(frameId)?.label ?? "the plate"}</button>`;
}

card.addEventListener("click", e => {
  const back = e.target.closest("[data-back]");
  if (back) return showFrame(framesById.get(frameId));
  const evt = e.target.closest("[data-event]");
  if (evt) return showEvent(evt.dataset.event);
  const chip = e.target.closest("[data-evidence]");
  if (chip) return openEvidence(chip.dataset.evidence);
  const ex = e.target.closest("[data-excerpt]");
  if (ex) return openExcerpt(ex.dataset.excerpt);
});

// ---- the evidence lightbox: the scan, or the words ----
const evidenceModal = document.getElementById("evidence-modal");
const evTitle = document.getElementById("evidence-title");
const evQuote = document.getElementById("evidence-quote");
const evGloss = document.getElementById("evidence-gloss");
const evScan = document.getElementById("evidence-scan");
const evImg = document.getElementById("evidence-img");
const evCite = document.getElementById("evidence-cite");

function citeLine(o) {
  const link = o.source_url
    ? ` <a href="${o.source_url}" target="_blank" rel="noopener">View at source ↗</a>` : "";
  // The rights note is dropped when the citation already says the same thing,
  // which is most of them: these are all federal publications.
  const rights = o.rights && !(o.citation ?? "").toLowerCase().includes("public domain")
    ? ` ${o.rights}` : "";
  return `${o.citation ?? ""}${rights}${link}`;
}

function openExcerpt(key) {
  const x = timeline.law_excerpts?.[key];
  if (!x) return;
  evTitle.textContent = x.label;
  evQuote.textContent = `“${x.quote}”`;
  setHidden(evQuote, false);
  evGloss.textContent = x.gloss ?? "";
  setHidden(evGloss, !x.gloss);
  setHidden(evScan, true);
  evImg.removeAttribute("src");
  evCite.innerHTML = citeLine(x) + (x.verified === false ? " <i>Quotation still being checked against the printed text.</i>" : "");
  setHidden(evidenceModal, false);
}

function openEvidence(id) {
  const e = timeline.evidence?.[id];
  if (!e) return;
  if (e.kind === "law") return openExcerpt(e.excerpt);
  evTitle.textContent = e.title ?? "";
  setHidden(evQuote, true);
  evGloss.textContent = e.note ?? "";
  setHidden(evGloss, !e.note);
  // The full scan is fetched here and not with the frame, so scrubbing never
  // pays for an image nobody opened.
  const full = e.files?.full;
  if (full) {
    evImg.src = full;
    evImg.alt = e.title ?? "";
  } else {
    evImg.removeAttribute("src");
  }
  setHidden(evScan, !full);
  // Only a map promises a picture, so only a map owes an explanation when the
  // picture is not here yet. A written source is complete as a citation.
  evCite.innerHTML = citeLine(e) +
    (e.kind === "map" && !full ? " <i>The plate itself is not committed yet; the link goes to the archive.</i>" : "");
  setHidden(evidenceModal, false);
}
function closeEvidence() {
  setHidden(evidenceModal, true);
  evImg.removeAttribute("src");
}
document.getElementById("evidence-close").addEventListener("click", closeEvidence);
evidenceModal.addEventListener("click", e => { if (e.target === evidenceModal) closeEvidence(); });

// A thumbnail on hover, so "show me the original" costs no click on a desktop.
// Guarded on a thumb existing: entries whose scans are not committed yet fall
// through to the chip's own tooltip rather than opening an empty frame.
let evPop = null;
document.addEventListener("mouseover", e => {
  const chip = e.target.closest?.(".ev-chip[data-evidence]");
  if (!chip) return;
  const thumb = timeline?.evidence?.[chip.dataset.evidence]?.files?.thumb;
  if (!thumb) return;
  evPop?.remove();
  evPop = document.createElement("div");
  evPop.className = "ev-pop";
  evPop.innerHTML = `<img src="${thumb}" alt=""><span>Click to read it</span>`;
  document.body.appendChild(evPop);
  const b = chip.getBoundingClientRect();
  evPop.style.left = `${Math.min(b.left, innerWidth - 190)}px`;
  evPop.style.top = `${Math.max(6, b.top - evPop.offsetHeight - 8)}px`;
});
document.addEventListener("mouseout", e => {
  if (e.target.closest?.(".ev-chip")) { evPop?.remove(); evPop = null; }
});

// ---- scrubber controls ----
tlTrack.addEventListener("click", e => {
  const b = e.target.closest("[data-frame]");
  if (b) { stopPlay(); setFrame(b.dataset.frame); }
});
document.getElementById("tl-prev").addEventListener("click", () => { stopPlay(); stepFrame(-1); });
document.getElementById("tl-next").addEventListener("click", () => { stopPlay(); stepFrame(1); });
tlPlayBtn.addEventListener("click", () => (playTimer ? stopPlay() : startPlay()));

// Auto-advance is a nicety, so it yields immediately: any tap on the map, any
// scrubber click, any layer change stops it. Reduced motion turns it off.
function startPlay() {
  if (reduceMotion()) return;
  if (frames.findIndex(f => f.id === frameId) >= frames.length - 1) setFrame(frames[0].id);
  playTimer = setInterval(() => {
    const i = frames.findIndex(f => f.id === frameId);
    if (i >= frames.length - 1) return stopPlay();
    setFrame(frames[i + 1].id);
  }, 7000);
  renderScrubber();
}
function stopPlay() {
  if (!playTimer) return;
  clearInterval(playTimer);
  playTimer = null;
  renderScrubber();
}
svg.addEventListener("pointerdown", () => stopPlay());

// ---- hovering a city on the 1900 plate ----
gTimeMarks.addEventListener("mouseover", e => {
  const g = e.target.closest(".tl-dot");
  if (g) showDot(+g.dataset.dot);
});
gTimeMarks.addEventListener("click", e => {
  const g = e.target.closest(".tl-dot");
  if (g) showDot(+g.dataset.dot);
});
function showDot(i) {
  const d = timeline?.dots?.[i];
  if (!d) return;
  const story = d.story ? timeline.events?.[d.story] : null;
  card.innerHTML =
    `<div class="c-kicker">1900${story ? " · a first worth knowing" : ""}</div>` +
    `<h3>${d.city}, ${d.state}</h3>` +
    (story ? `<p class="c-body">${story.body}</p>` : `<p class="c-body">A city with its own power station, lighting the blocks around it and no further.</p>`) +
    `<div class="c-stats"><span class="c-stat"><b>${(d.pop1900 ?? 0).toLocaleString()}</b>people in 1900</span>` +
    (story ? `<span class="c-stat"><b>${story.date.slice(0, 4)}</b>${story.title.toLowerCase()}</span>` : "") +
    `</div>` +
    `<button class="c-back" data-back="1">← back to the plate</button>`;
}

// ---- stack rail & layer switching ----
const rail = document.getElementById("rail");
const explainer = document.getElementById("explainer");
const drawingNote = document.getElementById("drawing-note");
let current = "wholesale";

function setHidden(el, value) {
  if (value) el.setAttribute("hidden", "");
  else el.removeAttribute("hidden");
}

function renderRail() {
  rail.innerHTML = "";
  for (const key of LAYERS) {
    const l = copy.layers[key];
    const btn = document.createElement("button");
    btn.className = "step";
    btn.setAttribute("aria-current", key === current ? "true" : "false");
    btn.innerHTML = `<span class="dot"></span><span><span class="s-name">${l.title}</span><br><span class="s-gloss">${l.gloss}</span></span>`;
    btn.addEventListener("click", () => setLayer(key));
    rail.appendChild(btn);
  }
  const l = copy.layers[current];
  explainer.innerHTML = `<b>${l.title}.</b> ${l.explainer}`;
}

async function setLayer(key) {
  current = key;
  renderRail();
  const ready = READY.has(key);
  setHidden(card, !ready);
  setHidden(gRto, key !== "wholesale");
  setHidden(gTransitions, key !== "wholesale");
  setHidden(gLabels, key !== "wholesale");
  setHidden(gTrivia, key !== "wholesale");
  setHidden(gRules, key !== "rules");
  setHidden(gWires, key !== "wires");
  setHidden(gCartogram, key !== "wires" || !sizeBy);
  setHidden(sizeControls, key !== "wires");
  setHidden(colourControls, key !== "wires");
  setHidden(shadeControls, key !== "rules" || !statePrices);
  setHidden(gYou, key !== "you");
  setHidden(zipForm, key !== "you" && key !== "wires");
  setHidden(svg.querySelector("#g-zipoutline"), key !== "wires");
  setHidden(legend, key === "you");
  setHidden(timelineBar, key !== "history");
  if (key !== "history") {
    stopPlay();
    setHidden(gTimeBase, true);
    setHidden(gTimeMarks, true);
  }
  svg.classList.remove("has-hover");
  if (key !== "you") {
    animateViewBox(HOME_VIEW, 500);
    setHidden(zoomReset, true);
  }
  if (key === "you") {
    youBase();
    if (!gYou.querySelector("#g-zips")?.children.length) {
      card.innerHTML = `<h3>Find yourself</h3><p class="c-body">${copy.layers.you.explainer}</p>`;
    }
    setHidden(zoomReset, svg.getAttribute("viewBox") === HOME_VIEW.join(" "));
  }
  if (key === "wires" && !wiresFeatures) {
    setHidden(svg, true);
    setHidden(drawingNote, false);
    drawingNote.querySelector("p").textContent = "Inking 2,907 utilities.";
    drawingNote.querySelector(".sub").textContent = "One moment.";
    await ensureWires();
    if (current !== "wires") return;
    setHidden(gWires, false);
  }
  if (key === "history" && !timeline) {
    await ensureTimeline();
    if (current !== "history") return;
  }
  setHidden(svg, !ready);
  setHidden(drawingNote, ready);
  if (key === "wires") {
    renderSizeControls();
    renderColourControls();
    setHidden(gCartogram, !sizeBy);
    gWires.classList.toggle("faded", !!sizeBy);
  }
  if (key === "rules") renderShadeControls();
  renderSizeKey(current === "wires" ? sizeBy : null);
  renderLegend(key);
  if (key === "wholesale") showRegion("ERCOT");
  if (key === "rules" && shadeBy === "bucket") showState("TX");
  if (key === "rules" && shadeBy !== "bucket") setShadeBy(shadeBy);
  if (key === "wires" && !sizeBy && colourBy === "type") showWiresIntro();
  // Opens on the first plate, not on today. "In 1900 there was no grid" is the
  // hook, and today is one click away at the other end of the scrubber.
  if (key === "history") setFrame(frameId ?? frames[0]?.id);
  if (!ready) {
    drawingNote.querySelector("p").textContent = `The ${copy.layers[key].title} layer is being inked.`;
    drawingNote.querySelector(".sub").textContent = "It lands in the next update. Wholesale, Rules, and Wires are live now.";
  }
  if (typeof updateUrl === "function") updateUrl(key);
}

renderRail();
const params = new URLSearchParams(location.search);
const wanted = params.get("layer");
const wantedZip = params.get("zip");
const wantedTrivia = params.get("trivia");
if (wantedZip && /^\d{5}$/.test(wantedZip)) {
  setLayer("you").then(() => { zipInput.value = wantedZip; findZip(wantedZip); });
} else if (wantedTrivia && copy.trivia.some(t => t.id === wantedTrivia)) {
  // deep link to a curiosity: open the card and fly to its marker
  setLayer("wholesale").then(() => {
    const i = copy.trivia.findIndex(t => t.id === wantedTrivia);
    showTrivia(i);
    const pt = projection(copy.trivia[i].anchor.lonlat);
    if (pt) {
      const transition = transitionsFC.features.find(f => f.properties.TRIVIA === wantedTrivia);
      if (transition) {
        const [[x0, y0], [x1, y1]] = path.bounds(transition);
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        animateViewBox([cx - 12.5, cy - 8, 25, 16]);
      } else {
        animateViewBox([pt[0] - 130, pt[1] - 90, 260, 180]);
      }
      setHidden(zoomReset, false);
    }
  });
} else if (wanted === "wires" && (params.get("size") || params.get("colour"))) {
  // deep link straight into a sized or recoloured map,
  // e.g. ?layer=wires&size=cust&colour=saidi
  setLayer("wires").then(() => {
    const k = params.get("size");
    if (k && cartogram?.measures[k]) setSizeBy(k);
    // A trailing "-variant" picks a storm basis, as in saidi-all. Split on the
    // last hyphen only, so a measure id containing one still resolves.
    let c = params.get("colour");
    if (c) {
      const cut = c.lastIndexOf("-");
      const base = cut > 0 ? c.slice(0, cut) : c;
      const variant = cut > 0 ? c.slice(cut + 1) : null;
      if (variant && measureSpec(base)?.variants?.[variant]) { variantOf[base] = variant; c = base; }
      if (c === "parent" || isColourMeasure(c)) setColourBy(c);
    }
  });
} else if (wanted === "history" || params.get("year")) {
  // ?layer=history&frame=1967, and a bare ?year=1970 that snaps to the plate at
  // or before the year asked for. &evidence= opens a scan or an excerpt.
  setLayer("history").then(() => {
    const id = resolveFrame(params.get("frame") ?? params.get("year"));
    if (id) setFrame(id);
    const ev = params.get("evidence");
    if (ev && timeline.evidence?.[ev]) openEvidence(ev);
  });
} else if (wanted === "rules" && params.get("shade")) {
  setLayer("rules").then(() => {
    const k = params.get("shade");
    if (statePrices?.states && priceScales[k]) setShadeBy(k);
  });
} else {
  setLayer(LAYERS.includes(wanted) ? wanted : "wholesale");
}

function updateUrl(key) {
  const q = new URLSearchParams();
  if (key !== "wholesale") q.set("layer", key);
  if (key === "wires" && sizeBy) q.set("size", sizeBy);
  if (key === "wires" && colourBy !== "type") {
    // The default variant is left off, so the ordinary link stays short and the
    // existing ?colour=saidi and ?colour=saidi-all links keep their meaning.
    const spec = isColourMeasure(colourBy) ? measureSpec(colourBy) : null;
    const v = spec?.variants ? variantOf[colourBy] : null;
    q.set("colour", v && v !== Object.keys(spec.variants)[0] ? `${colourBy}-${v}` : colourBy);
  }
  if (key === "rules" && shadeBy !== "bucket") q.set("shade", shadeBy);
  // The plate the layer opens on is left off, so the plain rail link stays short
  // the way ?layer=wires does.
  if (key === "history" && frameId && frameId !== frames[0]?.id) q.set("frame", frameId);
  const s = q.toString();
  history.replaceState(null, "", s ? `?${s}` : location.pathname);
}

// methodology & about modal
const methodModal = document.getElementById("method-modal");
document.getElementById("method-toggle").addEventListener("click", () => setHidden(methodModal, false));
document.getElementById("method-close").addEventListener("click", () => setHidden(methodModal, true));
methodModal.addEventListener("click", e => { if (e.target === methodModal) setHidden(methodModal, true); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { setHidden(methodModal, true); closeEvidence(); }
  // Arrow keys walk the plates, unless the reader is typing a zip code.
  if (current !== "history" || e.target.tagName === "INPUT") return;
  if (e.key === "ArrowLeft") { stopPlay(); stepFrame(-1); }
  if (e.key === "ArrowRight") { stopPlay(); stepFrame(1); }
});

// ---- the 30-second tour ----
const tourPanel = document.getElementById("tour-panel");
const tourTitle = document.getElementById("tour-title");
const tourBody = document.getElementById("tour-body");
const tourStepLabel = document.getElementById("tour-step-label");
const tourNext = document.getElementById("tour-next");
const tourSkip = document.getElementById("tour-skip");
let tourIdx = -1;

function tourShow(i) {
  tourIdx = i;
  const step = copy.tour[i];
  setLayer(step.layer);
  tourStepLabel.textContent = `${i + 1} of ${copy.tour.length}`;
  tourTitle.textContent = step.title;
  tourBody.textContent = step.body;
  tourNext.textContent = i === copy.tour.length - 1 ? "Explore" : "Next";
  setHidden(tourPanel, false);
}
function tourEnd() {
  tourIdx = -1;
  setHidden(tourPanel, true);
  try { localStorage.setItem("ga-tour-done", "1"); } catch {}
}
tourNext.addEventListener("click", () => {
  if (tourIdx >= copy.tour.length - 1) { tourEnd(); zipInput.focus(); }
  else tourShow(tourIdx + 1);
});
tourSkip.addEventListener("click", tourEnd);
document.getElementById("tour-start").addEventListener("click", () => tourShow(0));

// first visit: offer the tour automatically (skippable, never repeats)
let tourSeen = true;
try { tourSeen = !!localStorage.getItem("ga-tour-done"); } catch {}
if (!tourSeen && !wantedZip && !wanted && !wantedTrivia) tourShow(0);
