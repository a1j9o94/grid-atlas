// Precompute Dorling cartogram layouts: one circle per utility, area
// proportional to a chosen measure, relaxed so circles do not overlap.
//
// Why a cartogram at all: the wires layer draws 2,901 territories by land area,
// which makes empty country look important and hides where people actually are.
// The fact in the data is concentration. The top 100 utilities hold about 76% of
// all meters and the median utility serves around 4,500. Sizing by meters is
// what makes that visible.
//
// Why precomputed rather than a force simulation in the browser: no new client
// dependency, no visible settling on 2,901 nodes, positions a reader can check
// on GitHub, and a clean tween from geography into the cartogram instead of a
// jittery relaxation.
//
// Output: <out>/cartogram.json
// Usage:  node 08-build-cartogram.mjs [--out <dir>] [--iterations 400]

import { readFileSync, writeFileSync, existsSync } from "fs";
import { gzipSync } from "zlib";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const outDir = arg("out", join(here, "..", "site", "data"));
// 700 is where the Northeast stops overlapping. 400 leaves ConEd and
// Connecticut Light & Power jammed by 8px.
const ITERATIONS = Number(arg("iterations", 700));

// These must match the client exactly or every circle lands in the wrong place.
// app.js builds `geoAlbersUsa().fitExtent([[8, 8], [967, 602]], statesFC)` and
// index.html fixes viewBox="0 0 975 610". Both are echoed into the output so the
// client can assert they still agree.
const FIT_EXTENT = [[8, 8], [967, 602]];
const VIEWBOX = [0, 0, 975, 610];

// Area encoding: circles cover this share of the plate in total. The binding
// constraint is the Northeast, not the average: ConEd, Connecticut Light &
// Power, Jersey Central and a dozen mid-size utilities all want the same corner
// of an Albers USA plate, with the Atlantic as the only room to grow into. At
// 35% they jam against the edge and overlap by 8px. 26% is what actually packs.
const AREA_TARGET = 0.26;
// No utility should vanish. At the meters scale the median lands near 1.3px and
// the smallest would be under a tenth of a pixel, which reads as "not on the
// map" rather than "small". This floor is a small lie about area told to avoid a
// bigger lie about existence, and it is disclosed in the methodology.
const MIN_RADIUS = 0.8;
// Breathing room between circles so adjacent fills stay distinguishable.
const PAD = 0.35;

const measuresPath = join(outDir, "measures.json");
const wiresPath = join(outDir, "wires.topo.json");
const statesPath = join(outDir, "states.topo.json");
for (const p of [measuresPath, wiresPath, statesPath])
  if (!existsSync(p)) throw new Error(`missing ${p} (run 02-build-layers.mjs and 07-build-measures.mjs first)`);

const measures = JSON.parse(readFileSync(measuresPath, "utf8"));
const wiresTopo = JSON.parse(readFileSync(wiresPath, "utf8"));
const statesTopo = JSON.parse(readFileSync(statesPath, "utf8"));

const statesFC = feature(statesTopo, Object.values(statesTopo.objects)[0]);
const wiresFC = feature(wiresTopo, Object.values(wiresTopo.objects)[0]);
const projection = geoAlbersUsa().fitExtent(FIT_EXTENT, statesFC);
const path = geoPath(projection);

// ---------------------------------------------------------------------------
// Centroids. Shared across measures, so they live in their own block.
// ---------------------------------------------------------------------------

const centroids = {};
let unprojectable = 0;
for (const f of wiresFC.features) {
  const [x, y] = path.centroid(f);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    unprojectable++;
    continue;
  }
  centroids[f.properties.ID] = [x, y];
}
console.log(`centroids: ${Object.keys(centroids).length} of ${wiresFC.features.length}` +
  (unprojectable ? `, ${unprojectable} unprojectable` : ""));

// ---------------------------------------------------------------------------
// Relaxation
//
// Dorling's algorithm: seed each circle at its true centroid, then repeatedly
// push overlapping pairs apart along the line of centres while pulling each
// circle weakly back toward where it belongs. Movement is weighted by area so
// large circles act as anchors and the small ones flow around them, which keeps
// the map recognisable.
//
// Neighbour lookup uses a uniform grid sized to the largest circle. Without it
// the 2,901-squared pair test dominates and the run takes minutes instead of
// seconds.
// ---------------------------------------------------------------------------

function relax(ids, radii, ox, oy, label) {
  const n = ids.length;
  const x = Float64Array.from(ox);
  const y = Float64Array.from(oy);
  const r = Float64Array.from(radii);
  const w = new Float64Array(n); // area, as the inertia of each circle
  for (let i = 0; i < n; i++) w[i] = r[i] * r[i];

  let maxR = 0;
  for (let i = 0; i < n; i++) if (r[i] > maxR) maxR = r[i];
  const cell = Math.max(2 * maxR + PAD, 4);
  const cols = Math.ceil(VIEWBOX[2] / cell) + 2;
  const rows = Math.ceil(VIEWBOX[3] / cell) + 2;
  const heads = new Int32Array(cols * rows);
  const next = new Int32Array(n);

  const cellOf = i => {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(x[i] / cell) + 1));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(y[i] / cell) + 1));
    return cy * cols + cx;
  };

  let moved = 0;
  for (let iter = 0; iter < ITERATIONS; iter++) {
    heads.fill(-1);
    for (let i = 0; i < n; i++) {
      const c = cellOf(i);
      next[i] = heads[c];
      heads[c] = i;
    }
    // Pull toward the true centroid, strong early and released entirely by two
    // thirds of the way through. The last third is pure separation: any residual
    // pull fights the push and leaves dense regions permanently overlapped,
    // which is what pinned the Northeast against the coast.
    const pull = 0.07 * Math.max(0, 1 - iter / (ITERATIONS * 0.66));
    moved = 0;
    for (let i = 0; i < n; i++) {
      const ci = cellOf(i);
      const cy0 = Math.floor(ci / cols), cx0 = ci % cols;
      for (let gy = cy0 - 1; gy <= cy0 + 1; gy++) {
        if (gy < 0 || gy >= rows) continue;
        for (let gx = cx0 - 1; gx <= cx0 + 1; gx++) {
          if (gx < 0 || gx >= cols) continue;
          for (let j = heads[gy * cols + gx]; j !== -1; j = next[j]) {
            if (j <= i) continue;
            let dx = x[j] - x[i], dy = y[j] - y[i];
            const want = r[i] + r[j] + PAD;
            let d2 = dx * dx + dy * dy;
            if (d2 >= want * want) continue;
            let d = Math.sqrt(d2);
            if (d < 1e-6) {
              // exactly coincident: nudge deterministically so the pair can separate
              dx = ((i % 7) - 3) / 10 || 0.1;
              dy = ((j % 7) - 3) / 10 || 0.1;
              d = Math.hypot(dx, dy);
            }
            const push = (want - d) / d * 0.5;
            const tot = w[i] + w[j];
            const si = (w[j] / tot) * push, sj = (w[i] / tot) * push;
            x[i] -= dx * si; y[i] -= dy * si;
            x[j] += dx * sj; y[j] += dy * sj;
            moved += want - d;
          }
        }
      }
    }
    for (let i = 0; i < n; i++) {
      x[i] += (ox[i] - x[i]) * pull;
      y[i] += (oy[i] - y[i]) * pull;
      // keep every circle on the plate
      x[i] = Math.min(VIEWBOX[2] - r[i], Math.max(r[i], x[i]));
      y[i] = Math.min(VIEWBOX[3] - r[i], Math.max(r[i], y[i]));
    }
  }
  console.log(`  ${label}: ${n} circles, residual overlap ${moved.toFixed(1)}px after ${ITERATIONS} iterations`);
  return { x, y, r };
}

// ---------------------------------------------------------------------------
// Build one layout per magnitude measure.
//
// Rate is deliberately excluded. A ratio cannot drive an area encoding: a tiny
// utility with high prices would draw a huge circle, which means nothing. Rate
// stays a number on the hover card.
// ---------------------------------------------------------------------------

// `colourOnly` has to be excluded as well as `derived`. Reliability is neither
// derived nor sizeable: it is stored per storm variant, so `saidi.tot` is
// undefined, and it would emit a measure with no circles at all. The client
// builds its size buttons from whatever appears here, so that empty entry would
// have shipped as a button that draws an empty map.
const SIZED_BY = measures.measures.filter(m => !m.derived && !m.colourOnly).map(m => m.id);
const out = { centroids: {}, measures: {} };
for (const [id, c] of Object.entries(centroids)) out.centroids[id] = c.map(v => +v.toFixed(1));

const plate = VIEWBOX[2] * VIEWBOX[3];
for (const key of SIZED_BY) {
  const ids = [], vals = [];
  for (const id of Object.keys(centroids)) {
    const v = measures.utilities[id]?.[key]?.tot;
    if (typeof v === "number" && v > 0) { ids.push(id); vals.push(v); }
  }
  const vMax = Math.max(...vals);
  // sum(pi * K^2 * v/vMax) = AREA_TARGET * plate
  const share = vals.reduce((s, v) => s + v / vMax, 0);
  const K = Math.sqrt((AREA_TARGET * plate) / (Math.PI * share));
  const radii = vals.map(v => Math.max(MIN_RADIUS, K * Math.sqrt(v / vMax)));
  const ox = ids.map(id => centroids[id][0]);
  const oy = ids.map(id => centroids[id][1]);
  const { x, y, r } = relax(ids, radii, ox, oy, key);

  const circles = {};
  ids.forEach((id, i) => {
    circles[id] = [+x[i].toFixed(1), +y[i].toFixed(1), +r[i].toFixed(2)];
  });
  const coverage = radii.reduce((s, v) => s + Math.PI * v * v, 0) / plate;
  out.measures[key] = {
    max: vMax,
    maxRadius: +Math.max(...radii).toFixed(2),
    scale: +K.toFixed(4),
    floored: radii.filter(v => v === MIN_RADIUS).length,
    coverage: +coverage.toFixed(3),
    circles,
  };
  console.log(`  ${key}: K=${K.toFixed(2)}px, largest r=${Math.max(...radii).toFixed(1)}px, ` +
    `${(coverage * 100).toFixed(1)}% of plate, ${radii.filter(v => v === MIN_RADIUS).length} at the floor`);
}

out.meta = {
  built_from: "measures.json + wires.topo.json",
  projection: { type: "albersUsa", fitExtent: FIT_EXTENT, viewBox: VIEWBOX },
  areaTarget: AREA_TARGET,
  minRadius: MIN_RADIUS,
  pad: PAD,
  iterations: ITERATIONS,
  note: "Circle area is proportional to the measure. Positions are relaxed from each utility's true centroid, so the map is geographic but not a map: circles move to make room. Utilities below the minimum radius are drawn at the floor so they stay visible.",
};

const json = JSON.stringify(out);
writeFileSync(join(outDir, "cartogram.json"), json);

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

const fail = [];
for (const [key, m] of Object.entries(out.measures)) {
  const entries = Object.entries(m.circles);
  for (const [id, [cx, cy, r]] of entries) {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r)) fail.push(`${key}/${id}: non-finite`);
    if (cx - r < -0.5 || cy - r < -0.5 || cx + r > VIEWBOX[2] + 0.5 || cy + r > VIEWBOX[3] + 0.5)
      fail.push(`${key}/${id}: escapes the plate at ${cx},${cy} r=${r}`);
  }
  // area proportionality is the whole encoding, so check it numerically
  const sorted = entries.slice().sort((a, b) => b[1][2] - a[1][2]);
  const [idA] = sorted[0];
  const vA = measures.utilities[idA][key].tot, rA = m.circles[idA][2];
  for (const [idB, [, , rB]] of sorted.slice(1, 40)) {
    const vB = measures.utilities[idB][key].tot;
    if (rB <= MIN_RADIUS) continue;
    const expect = Math.sqrt(vB / vA) * rA;
    if (Math.abs(expect - rB) > 0.05) fail.push(`${key}/${idB}: radius ${rB} but area-proportional would be ${expect.toFixed(2)}`);
  }
  // worst pairwise overlap, sampled through the grid the relaxation used
  let worst = 0;
  const arr = entries.map(([, c]) => c);
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const dx = arr[j][0] - arr[i][0], dy = arr[j][1] - arr[i][1];
      const want = arr[i][2] + arr[j][2];
      if (dx * dx + dy * dy >= want * want) continue;
      const ov = want - Math.hypot(dx, dy);
      if (ov > worst) worst = ov;
    }
  }
  console.log(`  ${key}: worst pairwise overlap ${worst.toFixed(2)}px`);
  if (worst > 1.5) fail.push(`${key}: circles overlap by ${worst.toFixed(2)}px, relaxation did not converge`);
}

console.log(`\ncartogram.json  ${(json.length / 1024).toFixed(0)}KB raw, ${(gzipSync(json, { level: 9 }).length / 1024).toFixed(0)}KB gzipped`);
if (fail.length) {
  console.error("\nFAILED:");
  for (const f of fail.slice(0, 12)) console.error(`  - ${f}`);
  if (fail.length > 12) console.error(`  ... and ${fail.length - 12} more`);
  process.exit(1);
}
console.log("all assertions passed");
