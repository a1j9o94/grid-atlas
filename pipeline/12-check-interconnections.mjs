// Assert the interconnection assignment against places whose grid is known
// independently, before any of it is allowed to draw a seam.
//
// This exists because the first version of this assignment passed no checks at
// all and looked fine in aggregate. Counts by interconnection are not evidence:
// a single 30-degree federal marketing polygon put the Western grid over North
// Dakota while every summary number stayed plausible.
//
// Usage: node 12-check-interconnections.mjs
import { readFileSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { preprocess } from "./lib/hifld.mjs";
import { contains } from "./lib/geo.mjs";
import { loadInterconnections, assignInterconnection, isMarketingArea } from "./lib/interconnection.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { byCode } = loadInterconnections(here);
const { fc } = preprocess(JSON.parse(readFileSync(`${here}/data-raw/territories.geojson`, "utf8")), here);

const kept = [], marketing = [];
for (const f of fc.features) {
  (isMarketingArea(f) ? marketing : kept).push(f);
  f.properties.IC = assignInterconnection(f, byCode);
}
const tally = {};
for (const f of kept) tally[f.properties.IC] = (tally[f.properties.IC] ?? 0) + 1;
console.log("territories by interconnection:", tally);
console.log(`excluded as marketing areas: ${marketing.length}`);
for (const f of marketing) console.log(`   ${f.properties.NAME} (${f.properties.STATE}) ${f.properties.CUSTOMERS} customers`);

// Ground truth. Several of these are already told as curiosities on the live
// map, so a seam that contradicts them contradicts the map it sits under.
const CHECKS = [
  ["El Paso, TX", [-106.49, 31.76], "WESTERN", "in Texas, on the Western grid"],
  ["Scottsbluff, NE", [-103.66, 41.87], "WESTERN", "the Nebraska panhandle is Western"],
  ["Omaha, NE", [-95.93, 41.26], "EASTERN", "the rest of Nebraska is Eastern"],
  ["Denver, CO", [-104.99, 39.74], "WESTERN"],
  ["Dallas, TX", [-96.80, 32.78], "ERCOT"],
  ["Beaumont, TX", [-94.13, 30.08], "EASTERN", "Entergy Texas is on the Eastern grid"],
  ["Amarillo, TX", [-101.83, 35.22], "EASTERN", "the Panhandle is not on the Texas grid"],
  ["Los Angeles, CA", [-118.24, 34.05], "WESTERN"],
  ["Chicago, IL", [-87.63, 41.88], "EASTERN"],
  ["Miles City, MT", [-105.84, 46.41], "WESTERN"],
  ["Bismarck, ND", [-100.78, 46.81], "EASTERN"],
  ["Rapid City, SD", [-103.23, 44.08], "WESTERN"],
  ["Atlanta, GA", [-84.39, 33.75], "EASTERN"],
  ["Phoenix, AZ", [-112.07, 33.45], "WESTERN"],
];
// Three checkpoints cannot be resolved from this source and are expected to
// disagree. Each is a real utility whose single HIFLD shape spans the seam,
// carrying one control-area code for territory on both sides:
//   Scottsbluff  Nebraska Public Power District's statewide shape (Eastern)
//                overlaps Roosevelt Public Power District (Western).
//   Miles City   Montana-Dakota Utilities spans 9.4 degrees across the seam
//                and overlaps Tongue River Electric Co-op (Western).
//   Rapid City   Black Hills Electric Co-op (Eastern) overlaps Black Hills
//                Power (Western), and a stray City of Aurora polygon lands
//                here too, 300 miles from Aurora.
// This is the limit of deriving a synchronous boundary from retail service
// territories, and it is why the plates that use the seam carry the caveat
// that it is drawn from today's boundaries. A new failure outside this list is
// a real regression and fails the build.
const KNOWN_UNRESOLVED = new Set(["Scottsbluff, NE", "Miles City, MT", "Rapid City, SD"]);
let pass = 0;
const failures = [], known = [];
for (const [name, pt, want, why] of CHECKS) {
  const hits = kept.filter(f => contains(f, pt));
  const ics = [...new Set(hits.map(f => f.properties.IC))];
  const ok = ics.length > 0 && ics.every(i => i === want);
  const detail = `${name}: want ${want}, got ${ics.join("+") || "no coverage"} via ${hits.map(h => h.properties.NAME).join("; ")}`;
  if (ok) pass++;
  else if (KNOWN_UNRESOLVED.has(name)) known.push(detail);
  else failures.push(detail);
  const mark = ok ? "PASS" : KNOWN_UNRESOLVED.has(name) ? "KNOWN" : "FAIL";
  console.log(`${mark.padEnd(5)} ${name.padEnd(16)} ${want.padEnd(8)}${why ? "  (" + why + ")" : ""}`);
}
console.log(`\n${pass}/${CHECKS.length} checkpoints agree with the known grid, ${known.length} known unresolved`);
for (const k of known) console.log("  known: " + k);
if (failures.length) {
  for (const f of failures) console.error("  " + f);
  throw new Error(`${failures.length} NEW interconnection checkpoints failed; the seam would be drawn in the wrong place`);
}
console.log("no new regressions");
