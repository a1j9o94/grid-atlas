// The explorable market map.
// v1: Wholesale layer live — real RTO boundaries, hover cards, stack rail.
// Rules / Wires / You layers land in the next updates.
import { geoAlbersUsa, geoPath, feature, mesh } from "./vendor.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LAYERS = ["wholesale", "rules", "wires", "you"];
const FILL = {
  PJM: "var(--r-pjm)", ERCOT: "var(--r-ercot)", MISO: "var(--r-miso)",
  SPP: "var(--r-spp)", CAISO: "var(--r-caiso)", NYISO: "var(--r-nyiso)",
  ISONE: "var(--r-isone)", NONE: "var(--r-none)",
};

const [copy, statesTopo, rtosTopo] = await Promise.all([
  fetch("data/copy.json").then(r => r.json()),
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
  <g id="g-statelines"></g>
  <g id="g-labels"></g>
`;
const gRto = svg.querySelector("#g-rto");
const gLines = svg.querySelector("#g-statelines");
const gLabels = svg.querySelector("#g-labels");

for (const f of rtosFC.features) {
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("d", path(f));
  p.setAttribute("fill", FILL[f.properties.RTO] || "#ccc");
  p.setAttribute("class", "region");
  p.dataset.rto = f.properties.RTO;
  gRto.appendChild(p);
}

const lines = document.createElementNS(SVG_NS, "path");
lines.setAttribute("d", path(stateLines));
lines.setAttribute("class", "statelines");
gLines.appendChild(lines);

// region labels: computed centroids with hand nudges; NONE uses the two
// display anchors from the copy deck.
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

// ---- hover card ----
const card = document.getElementById("card");
function showRegion(rto, splitKey) {
  const r = copy.regions[rto];
  const body = rto === "NONE" && splitKey ? r.display_split[splitKey].body : r.body;
  card.hidden = false;
  card.innerHTML =
    `<span class="c-swatch" style="background:${FILL[rto]}"></span><h3>${r.name}</h3>` +
    `<p class="c-body">${body}</p>` +
    `<div class="c-stats"><span class="c-stat"><b>${r.stats.states}</b>states</span>` +
    `<span class="c-stat"><b>${r.stats.people}</b>people</span></div>` +
    `<div class="c-choice">${r.choice}</div>`;
}
showRegion("ERCOT");

function svgPoint(e) {
  const pt = new DOMPoint(e.clientX, e.clientY);
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
svg.addEventListener("mousemove", e => {
  const rto = e.target.dataset && e.target.dataset.rto;
  if (!rto) return;
  svg.classList.add("has-hover");
  for (const p of gRto.children) p.classList.toggle("hov", p.dataset.rto === rto);
  let splitKey;
  if (rto === "NONE") {
    const { x, y } = svgPoint(e);
    const lonlat = projection.invert([x, y]);
    splitKey = lonlat && lonlat[0] < -98 ? "NONE_W" : "NONE_SE";
  }
  showRegion(rto, splitKey);
});
svg.addEventListener("mouseleave", () => {
  svg.classList.remove("has-hover");
  for (const p of gRto.children) p.classList.remove("hov");
});

// ---- stack rail ----
const rail = document.getElementById("rail");
const explainer = document.getElementById("explainer");
const drawingNote = document.getElementById("drawing-note");
let current = "wholesale";

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

function setHidden(el, value) {
  if (value) el.setAttribute("hidden", "");
  else el.removeAttribute("hidden");
}

function setLayer(key) {
  current = key;
  renderRail();
  const ready = key === "wholesale";
  setHidden(svg, !ready);
  setHidden(card, !ready);
  setHidden(drawingNote, ready);
  if (!ready) {
    drawingNote.querySelector("p").textContent = `The ${copy.layers[key].title} layer is being inked.`;
    drawingNote.querySelector(".sub").textContent = "It lands in the next update. The Wholesale layer is live now.";
  }
}

renderRail();
setHidden(svg, false);
setHidden(drawingNote, true);
