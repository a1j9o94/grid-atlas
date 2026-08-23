// Build the map layers from HIFLD territories + Census states.
// Outputs (all EPSG:4326 lon/lat TopoJSON; the site projects at runtime):
//   ../site/data/rtos.topo.json    RTO regions dissolved from utility control areas
//   ../site/data/wires.topo.json   all ~2,931 utility territories
//   ../site/data/states.topo.json  state boundaries
// Usage: node 02-build-layers.mjs   (run 01-fetch-territories.mjs first)
import { execSync } from "child_process";
import { geoContains } from "d3-geo";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { feature as topoFeature } from "topojson-client";
import { OVERRIDES, preprocess } from "./lib/hifld.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const raw = join(here, "data-raw");
const outDir = join(here, "..", "site", "data");
mkdirSync(outDir, { recursive: true });
const sh = cmd => execSync(cmd, { stdio: "inherit", env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" } });
const mapshaper = `"${join(here, "node_modules", ".bin", "mapshaper")}"`;

const terr = join(raw, "territories.geojson");
if (!existsSync(terr)) throw new Error("run 01-fetch-territories.mjs first");

// ---- preprocessing: RTO assignment, exclusions, corrections ----
// Lives in lib/hifld.mjs so the timeline builds replay the identical cleaning.
// Anything changed there changes this map too, which is the point.
const { fc, dropped, inferred, sppWest } = preprocess(
  JSON.parse(readFileSync(terr, "utf8")), here);
console.log(`type inferred from name: ${inferred}; SPP West members: ${sppWest}`);

// Keep dated transitions separate from the current wholesale geometry. HIFLD
// service territories overlap around Caldwell, so the source cannot support a
// precise city-scale RTO boundary. The site renders these records as dated
// annotations rather than manufacturing a territorial correction.
const transitions = [];
for (const o of OVERRIDES) {
  if (!o.CHANGED) continue;
  const f = fc.features.find(f => f.properties.NAME === o.NAME && f.properties.STATE === o.STATE);
  if (!f) throw new Error(`transition feature missing: ${o.NAME}|${o.STATE}`);
  f.properties.FROM_RTO = o.FROM_RTO;
  f.properties.CHANGED = o.CHANGED;
  f.properties.TRIVIA = o.TRIVIA;
  transitions.push(structuredClone(f));
}

const clean = join(raw, "territories-clean.geojson");
writeFileSync(clean, JSON.stringify(fc));
console.log(`preprocessed: ${fc.features.length} features kept, ${dropped} dropped (overlay/non-map)`);

// Surface, without dropping, territories that EIA files only as Part B
// (energy-only). That is the same "owns no wires" signal the CCA rule above
// catches, arrived at from the data side instead of the type field. Anything
// listed here is a candidate overlay and wants a human decision, because the
// tail of the list is genuinely ambiguous: a transit authority and a one-
// customer hydro both look like this and both are harmless to draw.
const partBOnly = join(raw, "eia-energy-only-ids.json");
if (existsSync(partBOnly)) {
  const ids = new Set(JSON.parse(readFileSync(partBOnly, "utf8")));
  const flagged = fc.features.filter(f => ids.has(f.properties.ID));
  if (flagged.length) {
    console.log(`review: ${flagged.length} kept territories file only as energy-only in EIA-861`);
    for (const f of flagged)
      console.log(`   ${f.properties.ID} ${f.properties.NAME} (${f.properties.STATE}, ${f.properties.TYPE})`);
  }
}

// Resolve HIFLD's overlapping Texas wholesale polygons. Entergy's broad MISO
// shape covers documented ERCOT utilities, producing false green islands and
// visually joining Caldwell to MISO. Where Texas records conflict, current
// ERCOT assignments take precedence in the wholesale layer. Wires retain the
// untouched source polygons so the underlying overlap remains inspectable.
const caldwellPriority = fc.features.filter(f =>
  f.properties.STATE === "TX" && f.properties.RTO === "ERCOT");
if (!caldwellPriority.some(f => f.properties.NAME === "CITY OF CALDWELL"))
  throw new Error("Caldwell missing from Texas ERCOT precedence mask");
const priorityIn = join(raw, "caldwell-rto-priority.geojson");
const priorityMask = join(raw, "caldwell-rto-priority-mask.geojson");
const rtoErased = join(raw, "territories-rto-erased.geojson");
const rtoClean = join(raw, "territories-rto-clean.geojson");
writeFileSync(priorityIn, JSON.stringify({ type: "FeatureCollection", features: caldwellPriority }));
sh(`${mapshaper} "${priorityIn}" -dissolve RTO -o "${priorityMask}" format=geojson`);
sh(`${mapshaper} "${clean}" -erase "${priorityMask}" remove-slivers -o "${rtoErased}" format=geojson`);
const rtoErasedFc = JSON.parse(readFileSync(rtoErased, "utf8"));
const priorityMaskFc = JSON.parse(readFileSync(priorityMask, "utf8"));
writeFileSync(rtoClean, JSON.stringify({
  type: "FeatureCollection",
  features: [...rtoErasedFc.features, ...priorityMaskFc.features],
}));

const mb = f => (statSync(f).size / 1e6).toFixed(1) + "MB";

console.log("== wires layer (all territories, simplified) ==");
sh(`${mapshaper} "${clean}" ` +
  `-filter-fields ID,NAME,STATE,TYPE,CUSTOMERS,REGULATED,HOLDING_CO,RTO ` +
  `-simplify 6% keep-shapes ` +
  `-o "${join(outDir, "wires.topo.json")}" format=topojson quantization=1e5`);
console.log("wires.topo.json", mb(join(outDir, "wires.topo.json")));

console.log("== RTO layer (dissolve control areas at full res, then simplify) ==");
sh(`${mapshaper} "${rtoClean}" ` +
  `-dissolve RTO ` +
  `-simplify 5% keep-shapes -clean ` +
  `-o "${join(outDir, "rtos.topo.json")}" format=topojson quantization=1e5`);
console.log("rtos.topo.json", mb(join(outDir, "rtos.topo.json")));

const rtosTopo = JSON.parse(readFileSync(join(outDir, "rtos.topo.json"), "utf8"));
const rtosBuilt = topoFeature(rtosTopo, Object.values(rtosTopo.objects)[0]);
const rtosAt = point => rtosBuilt.features.filter(f => geoContains(f, point)).map(f => f.properties.RTO).sort();
for (const [label, point, expected] of [
  ["Caldwell", [-96.70, 30.53], "ERCOT"],
  ["false Entergy island", [-96.60, 31.45], "ERCOT"],
  ["East Texas MISO", [-94.50, 30.50], "MISO"],
]) {
  const actual = rtosAt(point).join();
  if (actual !== expected) throw new Error(`${label} RTO regression: expected ${expected}, found ${actual}`);
}
console.log("Texas overlap regression passed: Caldwell and false island ERCOT; East Texas MISO");

console.log("== recent grid transitions ==");
const transitionsGeojson = join(raw, "transitions.geojson");
writeFileSync(transitionsGeojson, JSON.stringify({ type: "FeatureCollection", features: transitions }));
sh(`${mapshaper} "${transitionsGeojson}" ` +
  `-filter-fields ID,NAME,STATE,RTO,FROM_RTO,CHANGED,TRIVIA ` +
  `-simplify 20% keep-shapes ` +
  `-o "${join(outDir, "transitions.topo.json")}" format=topojson quantization=1e5`);
console.log("transitions.topo.json", mb(join(outDir, "transitions.topo.json")));

const caldwellTransition = transitions.find(f => f.properties.TRIVIA === "caldwell-switched-grids");
if (caldwellTransition?.properties.RTO !== "ERCOT" ||
    caldwellTransition?.properties.FROM_RTO !== "MISO" ||
    caldwellTransition?.properties.CHANGED !== "2026-03-12") {
  throw new Error("Caldwell transition metadata regression");
}
console.log("Caldwell transition passed: MISO -> ERCOT on 2026-03-12");

console.log("== states layer ==");
const stshp = join(raw, "cb_2020_us_state_500k.shp");
if (!existsSync(stshp))
  sh(`curl -sL -o "${raw}/states.zip" "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_state_500k.zip" && unzip -o -q "${raw}/states.zip" -d "${raw}"`);
sh(`${mapshaper} "${stshp}" -filter-fields STUSPS,NAME ` +
  `-simplify 20% keep-shapes ` +
  `-o "${join(outDir, "states.topo.json")}" format=topojson quantization=1e5`);
console.log("states.topo.json", mb(join(outDir, "states.topo.json")));
