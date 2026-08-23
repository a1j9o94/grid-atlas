// Build the seam geometry for the mid-century plates: 1935, 1967 and 1975.
//
// Their subject is the boundary between the Eastern and Western grids, and the
// Texas-shaped hole beside it. So the output is three dissolved regions plus
// the two internal boundaries drawn as their own lines, because a region's
// outline is mostly coastline and international border and the seam is the only
// part of it the plates are about.
//
// Outputs (EPSG:4326 lon/lat TopoJSON, projected at runtime like every other
// layer), one file with three objects:
//   regions      EASTERN, WESTERN, ERCOT as filled areas
//   seam_ew      the boundary Eastern and Western share
//   seam_ercot   the boundary ERCOT shares with either of them
//
// Usage: node 13-build-seam.mjs [--out <path>]
//
// WHY PRECEDENCE IS NEEDED AT ALL. HIFLD retail territories overlap, so
// dissolving by interconnection produces two polygons that both cover the
// northern plains, and the shared boundary of two overlapping shapes is not a
// line, it is nonsense. 12-check-interconnections.mjs names the three places
// this happens: Scottsbluff, Miles City and Rapid City. In all three the broad
// statewide shape is labelled Eastern and the local shape is labelled Western,
// and in all three the ground truth is Western. So the rule is that the more
// specific claim wins, which here means WESTERN erases EASTERN, and ERCOT
// erases both because the Texas assignment is documented rather than inferred.
// That rule is not asserted, it is tested: the fourteen checkpoints run again
// at the bottom of this script, against the drawn geometry rather than against
// the per-feature labels, and all fourteen have to agree or nothing is written.
import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { preprocess } from "./lib/hifld.mjs";
import { contains } from "./lib/geo.mjs";
import { loadInterconnections, assignInterconnection, isMarketingArea } from "./lib/interconnection.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
// Six levels up is the workspace root, where the grid-atlas checkout sits.
const OUT = resolve(arg("out",
  join(here, "../../../../../../grid-atlas/public/data/timeline/seam.topo.json")));
const raw = join(here, "data-raw");
const work = join(raw, "seam");
mkdirSync(work, { recursive: true });
mkdirSync(dirname(OUT), { recursive: true });
const mapshaper = `"${join(here, "node_modules", ".bin", "mapshaper")}"`;
const sh = (cmd) => execSync(cmd, { stdio: "inherit" });
const w = (name, features) => {
  const p = join(work, name);
  writeFileSync(p, JSON.stringify({ type: "FeatureCollection", features }));
  return p;
};
const readFc = (p) => JSON.parse(readFileSync(p, "utf8"));

const terr = join(raw, "territories.geojson");
if (!existsSync(terr)) throw new Error("run 01-fetch-territories.mjs first");

// ---- assignment, reusing the live map's own cleaning ----
const { byCode } = loadInterconnections(here);
const { fc } = preprocess(JSON.parse(readFileSync(terr, "utf8")), here);

// Three features carry no control area and no RTO, so nothing places them on
// an interconnection, and each is excluded for its own reason rather than as a
// class. Matinicus Plantation is an island off Maine that ran on diesel and is
// genuinely on no interconnection. North Shore Towers is one apartment complex
// in Queens, a zero-span point. Alaska Power and Telephone is filed under
// Washington with a shape spanning 31 degrees, which is a bad polygon, not a
// service territory. None of the three would change a boundary; leaving them
// unassigned would put a hole in one.
const EXCLUDE_UNPLACEABLE = new Set([
  "MATINICUS PLANTATION ELEC CO", "NORTH SHORE TOWERS APTS INC", "ALASKA POWER AND TELEPHONE CO",
]);
// Alaska and Hawaii belong to none of the three machines. They are left out
// rather than tinted, so the pale ground shows through where the plate has
// nothing to say, which is the honest rendering of "not on any of these".
const OFF_GRID = new Set(["ALASKA", "HAWAII"]);

const byIc = { EASTERN: [], WESTERN: [], ERCOT: [] };
const skipped = { marketing: 0, offGrid: 0, unplaceable: 0 };
for (const f of fc.features) {
  if (isMarketingArea(f)) { skipped.marketing++; continue; }
  if (EXCLUDE_UNPLACEABLE.has(f.properties.NAME)) { skipped.unplaceable++; continue; }
  const ic = assignInterconnection(f, byCode);
  if (OFF_GRID.has(ic)) { skipped.offGrid++; continue; }
  if (!byIc[ic]) throw new Error(`unplaced territory: ${f.properties.NAME} (${f.properties.STATE}) -> ${ic}`);
  byIc[ic].push({ ...f, properties: { IC: ic } });
}
console.log("territories per interconnection:",
  Object.fromEntries(Object.entries(byIc).map(([k, v]) => [k, v.length])));
console.log("skipped:", skipped);

// ---- dissolve, then apply precedence ----
console.log("== dissolve and resolve overlaps ==");
const dissolve = (name, features) => {
  const src = w(`${name}-src.geojson`, features);
  const out = join(work, `${name}-d.geojson`);
  sh(`${mapshaper} "${src}" -dissolve IC -o "${out}" format=geojson`);
  return out;
};
const ercotD = dissolve("ercot", byIc.ERCOT);
const westernRaw = dissolve("western-raw", byIc.WESTERN);
const easternRaw = dissolve("eastern-raw", byIc.EASTERN);

const erase = (name, src, ...masks) => {
  let cur = src;
  for (const [i, m] of masks.entries()) {
    const out = join(work, `${name}-e${String(i)}.geojson`);
    sh(`${mapshaper} "${cur}" -erase "${m}" remove-slivers -o "${out}" format=geojson`);
    cur = out;
  }
  return cur;
};
const westernD = erase("western", westernRaw, ercotD);
const easternD = erase("eastern", easternRaw, ercotD, westernD);

// One layer, three features, no overlaps. Simplify and clean here rather than
// per region, so the shared edges stay a single set of arcs and the seam lines
// derived below land exactly on the region edges the reader sees.
const regionsFull = w("regions-full.geojson", [
  ...readFc(ercotD).features, ...readFc(westernD).features, ...readFc(easternD).features,
]);
const regions = join(work, "regions.geojson");
sh(`${mapshaper} "${regionsFull}" -simplify 5% keep-shapes -clean -o "${regions}" format=geojson`);

// ---- the two seams ----
// -innerlines on a two-feature layer returns exactly what they share, which is
// why each seam gets its own reduction to two features instead of one call.
console.log("== seams ==");
const seamEw = join(work, "seam_ew.geojson");
sh(`${mapshaper} "${regions}" -filter 'IC !== "ERCOT"' -innerlines -o "${seamEw}" format=geojson`);
const seamErcot = join(work, "seam_ercot.geojson");
sh(`${mapshaper} "${regions}" -each 'IC = IC === "ERCOT" ? "ERCOT" : "OTHER"' -dissolve IC ` +
  `-innerlines -o "${seamErcot}" format=geojson`);

// ---- the gate ----
// The same fourteen checkpoints 12-check-interconnections.mjs uses, run here
// against the drawn regions. There they can each be covered by several
// overlapping territories and three of them come back ambiguous. Here each
// point falls in exactly one region or the geometry is wrong, so all fourteen
// have to resolve, and the precedence rule above is what has to earn that.
const CHECKS = [
  ["El Paso, TX", [-106.49, 31.76], "WESTERN"],
  ["Scottsbluff, NE", [-103.66, 41.87], "WESTERN"],
  ["Omaha, NE", [-95.93, 41.26], "EASTERN"],
  ["Denver, CO", [-104.99, 39.74], "WESTERN"],
  ["Dallas, TX", [-96.80, 32.78], "ERCOT"],
  ["Beaumont, TX", [-94.13, 30.08], "EASTERN"],
  ["Amarillo, TX", [-101.83, 35.22], "EASTERN"],
  ["Los Angeles, CA", [-118.24, 34.05], "WESTERN"],
  ["Chicago, IL", [-87.63, 41.88], "EASTERN"],
  ["Miles City, MT", [-105.84, 46.41], "WESTERN"],
  ["Bismarck, ND", [-100.78, 46.81], "EASTERN"],
  ["Rapid City, SD", [-103.23, 44.08], "WESTERN"],
  ["Atlanta, GA", [-84.39, 33.75], "EASTERN"],
  ["Phoenix, AZ", [-112.07, 33.45], "WESTERN"],
  // Added here because a dissolve can fail in ways a per-feature label cannot:
  // an erase that overreaches leaves a hole, and a hole reads as no grid at all.
  ["Houston, TX", [-95.37, 29.76], "ERCOT"],
  ["Sioux Falls, SD", [-96.73, 43.55], "EASTERN"],
  ["Billings, MT", [-108.50, 45.78], "WESTERN"],
  ["Wichita, KS", [-97.34, 37.69], "EASTERN"],
  ["Seattle, WA", [-122.33, 47.61], "WESTERN"],
  ["Miami, FL", [-80.19, 25.76], "EASTERN"],
];
const gate = (label, path) => {
  const fcAt = readFc(path);
  const failures = [];
  for (const [name, pt, want] of CHECKS) {
    const hits = [...new Set(fcAt.features.filter((f) => contains(f, pt)).map((f) => f.properties.IC))];
    const ok = hits.length === 1 && hits[0] === want;
    console.log(`${(ok ? "PASS" : "FAIL").padEnd(5)} ${label.padEnd(10)} ${name.padEnd(16)} want ${want.padEnd(8)} got ${hits.join("+") || "no coverage"}`);
    if (!ok) failures.push(`${name}: want ${want}, got ${hits.join("+") || "no coverage"}`);
  }
  if (failures.length) {
    for (const f of failures) console.error("  " + f);
    throw new Error(`${label}: ${String(failures.length)} checkpoints in the wrong region; the seam would be drawn in the wrong place`);
  }
};
console.log("== gate: full resolution ==");
gate("full-res", regionsFull);
console.log("== gate: as drawn ==");
gate("as-drawn", regions);

// A seam that came back empty would draw nothing and look like a design
// choice, so both lines have to exist. -innerlines writes a GeometryCollection
// holding one MultiLineString, not a FeatureCollection, so the count that
// matters is the number of strands in it.
const strands = (path) => {
  const g = readFc(path).geometries ?? [];
  return g.reduce((n, geom) => n + (geom.type === "MultiLineString" ? geom.coordinates.length : 1), 0);
};
for (const [name, path] of [["seam_ew", seamEw], ["seam_ercot", seamErcot]]) {
  const n = strands(path);
  if (n === 0) throw new Error(`${name} is empty; -innerlines found no shared boundary`);
  console.log(`${name}: ${String(n)} strands`);
}

console.log("== write ==");
sh(`${mapshaper} "${regions}" "${seamEw}" "${seamErcot}" combine-files ` +
  `-o "${OUT}" format=topojson quantization=1e5`);
const topo = JSON.parse(readFileSync(OUT, "utf8"));
console.log(`${OUT} ${(statSync(OUT).size / 1e6).toFixed(2)}MB objects: ${Object.keys(topo.objects).join(", ")}`);
