// The explorable market map.
// v2: Wholesale + Rules layers live. Wires / You land next.
import { geoAlbersUsa, geoPath, feature, mesh } from "./vendor.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LAYERS = ["wholesale", "rules", "wires", "you"];
const READY = new Set(["wholesale", "rules", "wires", "you"]);
const FILL = {
  PJM: "var(--r-pjm)", ERCOT: "var(--r-ercot)", MISO: "var(--r-miso)",
  SPP: "var(--r-spp)", CAISO: "var(--r-caiso)", NYISO: "var(--r-nyiso)",
  ISONE: "var(--r-isone)", NONE: "var(--r-none)",
};
// wires layer: ownership as ONE hue, stepped from investor-owned (light) to
// citizen-owned (dark). Any two contrasting hues at this area coverage reads
// as an election map, so the encoding is ordered "how public is your power
// company" instead of team colors. Ramp validated on the sage surface.
const WIRE_GROUPS = {
  iou: { label: "Owned by investors", color: "#a98cc4" },
  coop: { label: "Owned by its members", color: "#7c5fae" },
  public: { label: "Owned by the public", color: "#4b3178" },
  other: { label: "Unknown", color: "#c8c3ae" },
};
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

const [copy, rules, statesTopo, rtosTopo] = await Promise.all([
  fetch("data/copy.json").then(r => r.json()),
  fetch("data/rules.json").then(r => r.json()),
  fetch("data/states.topo.json").then(r => r.json()),
  fetch("data/rtos.topo.json").then(r => r.json()),
]);

const statesFC = feature(statesTopo, Object.values(statesTopo.objects)[0]);
const rtosFC = feature(rtosTopo, Object.values(rtosTopo.objects)[0]);
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
  </defs>
  <g id="g-rto" filter="url(#wobble)"></g>
  <g id="g-rules" filter="url(#wobble)" hidden></g>
  <g id="g-wires" filter="url(#wobble)" hidden></g>
  <g id="g-you" hidden></g>
  <g id="g-statelines"></g>
  <g id="g-labels"></g>
  <g id="g-trivia"></g>
`;
const gRto = svg.querySelector("#g-rto");
const gRules = svg.querySelector("#g-rules");
const gWires = svg.querySelector("#g-wires");
const gYou = svg.querySelector("#g-you");
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
async function ensureWires() {
  if (wiresFeatures) return;
  const topo = await (await fetch("data/wires.topo.json")).json();
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
}

// ---- trivia markers (wholesale layer): the map's curiosities ----
copy.trivia.forEach((t, i) => {
  const pt = projection(t.anchor.lonlat);
  if (!pt) return;
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "trivia");
  g.setAttribute("transform", `translate(${pt[0].toFixed(1)},${pt[1].toFixed(1)})`);
  g.dataset.trivia = i;
  g.innerHTML = `<circle r="9"></circle><text dy="4">✳</text>`;
  gTrivia.appendChild(g);
});
function showTrivia(i) {
  const t = copy.trivia[i];
  card.innerHTML =
    `<div class="c-kicker">Curiosity${t.verified ? "" : " · draft, still being checked"}</div>` +
    `<h3>${t.title}</h3>` +
    `<p class="c-body">${t.body}</p>`;
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
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", path(f));
    p.setAttribute("fill", "#e4e7db");
    gYou.appendChild(p);
  }
  const zg = document.createElementNS(SVG_NS, "g");
  zg.id = "g-zips";
  gYou.appendChild(zg);
}

function animateViewBox(to, ms = 900) {
  if (viewAnim) cancelAnimationFrame(viewAnim);
  const from = svg.getAttribute("viewBox").split(" ").map(Number);
  const t0 = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);
  const tick = now => {
    const t = Math.min(1, (now - t0) / ms), k = ease(t);
    svg.setAttribute("viewBox", from.map((v, i) => v + (to[i] - v) * k).join(" "));
    if (t < 1) viewAnim = requestAnimationFrame(tick);
  };
  viewAnim = requestAnimationFrame(tick);
}

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
  youBase();
  const zg = gYou.querySelector("#g-zips");
  zg.innerHTML = "";
  // neighbors for context, target on top
  for (const f of fc.features) {
    if (f.properties.GEOID20 === zip) continue;
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", path(f));
    p.setAttribute("class", "zip-neighbor");
    zg.appendChild(p);
  }
  let view = HOME_VIEW;
  if (target) {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", path(target));
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
  const rto = rows.find(r => r.rto && r.rto !== "NONE")?.rto || (rows.some(r => r.rto === "NONE") ? "NONE" : null);
  const rtoName = rto === null ? null : rto === "NONE" ? "No RTO. Utilities run this grid themselves." : `${copy.regions[rto].name} runs the market here.`;
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
    `<p class="c-body"><b>Your wires:</b> ${rows.map(r => `${r.name} (${WIRE_GROUPS[r.group].label.toLowerCase()})`).join(", ")}${utils.length > 3 ? " and others" : ""}.</p>` +
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

// legend (content depends on layer)
const legend = document.getElementById("legend");
function renderLegend(key) {
  if (key === "rules") {
    legend.innerHTML = Object.values(rules.buckets)
      .map(b => `<span class="lg-item"><span class="lg-swatch" style="background:${b.color}"></span>${b.label}</span>`)
      .join("");
  } else if (key === "wires") {
    legend.innerHTML = Object.entries(WIRE_GROUPS)
      .map(([g, w]) => `<span class="lg-item"><span class="lg-swatch" style="background:${w.color}"></span>${w.label}${wiresCounts ? ` · ${wiresCounts[g].toLocaleString()}` : ""}</span>`)
      .join("");
  }
}

// ---- hover cards ----
const card = document.getElementById("card");
function showRegion(rto, splitKey) {
  const r = copy.regions[rto];
  const body = rto === "NONE" && splitKey ? r.display_split[splitKey].body : r.body;
  card.innerHTML =
    `<span class="c-swatch" style="background:${FILL[rto]}"></span><h3>${r.name}</h3>` +
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
  const customers = p.CUSTOMERS > 0
    ? `<span class="c-stat"><b>${p.CUSTOMERS.toLocaleString()}</b>customers</span>` : "";
  const rtoName = p.RTO === "NONE" ? "No RTO" : (copy.regions[p.RTO]?.name || p.RTO);
  card.innerHTML =
    `<span class="c-swatch" style="background:${WIRE_GROUPS[g].color}"></span><h3>${titleCase(p.NAME)}</h3>` +
    `<div class="c-choice">${typeInfo.label} · ${p.STATE}</div>` +
    `<p class="c-body">${typeInfo.body}</p>` +
    `<div class="c-stats">${customers}<span class="c-stat"><b>${rtoName}</b>grid</span></div>`;
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
  for (const g of [gRto, gRules]) for (const p of g.children) p.classList.remove("hov");
  if (hoveredWire) { hoveredWire.classList.remove("hov"); hoveredWire = null; }
});
function setHover(group, match) {
  svg.classList.add("has-hover");
  for (const p of group.children) p.classList.toggle("hov", match(p));
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
  setHidden(gLabels, key !== "wholesale");
  setHidden(gTrivia, key !== "wholesale");
  setHidden(gRules, key !== "rules");
  setHidden(gWires, key !== "wires");
  setHidden(gYou, key !== "you");
  setHidden(zipForm, key !== "you");
  setHidden(legend, key !== "rules" && key !== "wires");
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
  setHidden(svg, !ready);
  setHidden(drawingNote, ready);
  renderLegend(key);
  if (key === "wholesale") showRegion("ERCOT");
  if (key === "rules") showState("TX");
  if (key === "wires") showWiresIntro();
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
if (wantedZip && /^\d{5}$/.test(wantedZip)) {
  setLayer("you").then(() => { zipInput.value = wantedZip; findZip(wantedZip); });
} else {
  setLayer(LAYERS.includes(wanted) ? wanted : "wholesale");
}

function updateUrl(key) {
  const url = key === "wholesale" ? location.pathname : `?layer=${key}`;
  history.replaceState(null, "", url);
}

// about overlay (mobile)
const aboutToggle = document.getElementById("about-toggle");
const aboutOverlay = document.getElementById("about-overlay");
aboutToggle.addEventListener("click", () => {
  const open = aboutOverlay.hasAttribute("hidden");
  setHidden(aboutOverlay, !open);
  aboutToggle.setAttribute("aria-expanded", String(open));
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
if (!tourSeen && !wantedZip && !wanted) tourShow(0);
