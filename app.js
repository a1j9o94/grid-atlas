// The explorable market map.
// v2: Wholesale + Rules layers live. Wires / You land next.
import { geoAlbersUsa, geoPath, feature, mesh } from "./vendor.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LAYERS = ["wholesale", "rules", "wires", "you"];
const READY = new Set(["wholesale", "rules"]);
const FILL = {
  PJM: "var(--r-pjm)", ERCOT: "var(--r-ercot)", MISO: "var(--r-miso)",
  SPP: "var(--r-spp)", CAISO: "var(--r-caiso)", NYISO: "var(--r-nyiso)",
  ISONE: "var(--r-isone)", NONE: "var(--r-none)",
};

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
  <g id="g-statelines"></g>
  <g id="g-labels"></g>
`;
const gRto = svg.querySelector("#g-rto");
const gRules = svg.querySelector("#g-rules");
const gLines = svg.querySelector("#g-statelines");
const gLabels = svg.querySelector("#g-labels");

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

// rules legend
const legend = document.getElementById("legend");
legend.innerHTML = Object.values(rules.buckets)
  .map(b => `<span class="lg-item"><span class="lg-swatch" style="background:${b.color}"></span>${b.label}</span>`)
  .join("");

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
  }
});
svg.addEventListener("mouseleave", () => {
  svg.classList.remove("has-hover");
  for (const g of [gRto, gRules]) for (const p of g.children) p.classList.remove("hov");
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

function setLayer(key) {
  current = key;
  renderRail();
  const ready = READY.has(key);
  setHidden(svg, !ready);
  setHidden(card, !ready);
  setHidden(drawingNote, ready);
  setHidden(gRto, key !== "wholesale");
  setHidden(gLabels, key !== "wholesale");
  setHidden(gRules, key !== "rules");
  setHidden(legend, key !== "rules");
  svg.classList.remove("has-hover");
  if (key === "wholesale") showRegion("ERCOT");
  if (key === "rules") showState("TX");
  if (!ready) {
    drawingNote.querySelector("p").textContent = `The ${copy.layers[key].title} layer is being inked.`;
    drawingNote.querySelector(".sub").textContent = "It lands in the next update. Wholesale and Rules are live now.";
  }
  if (typeof updateUrl === "function") updateUrl(key);
}

renderRail();
const wanted = new URLSearchParams(location.search).get("layer");
setLayer(LAYERS.includes(wanted) ? wanted : "wholesale");

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
