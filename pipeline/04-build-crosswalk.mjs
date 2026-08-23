// Build the zip -> utility lookup shards from the OpenEI 2020 crosswalk
// (iou_zipcodes_2020.csv + non_iou_zipcodes_2020.csv, data.openei.org/files/5650).
// Output: ../site/data/zip/<2-digit-prefix>.json
//   { "78701": [{ id, name, own, res_rate }], ... }
// A zip can map to several utilities (overlapping/delivery-only territories).
// Usage: node 04-build-crosswalk.mjs
import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const raw = join(here, "data-raw");
const outDir = join(here, "..", "site", "data", "zip");
mkdirSync(raw, { recursive: true });
mkdirSync(outDir, { recursive: true });

for (const f of ["iou_zipcodes_2020.csv", "non_iou_zipcodes_2020.csv"]) {
  if (!existsSync(join(raw, f)))
    execSync(`curl -s -o "${join(raw, f)}" "https://data.openei.org/files/5650/${f}"`);
}

// quote-aware CSV splitter (utility names contain commas, e.g. "Duke Energy Carolinas, LLC")
function splitCsv(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

const byZip = {};
let rows = 0;
for (const f of ["iou_zipcodes_2020.csv", "non_iou_zipcodes_2020.csv"]) {
  const lines = readFileSync(join(raw, f), "utf8").trim().split("\n").slice(1);
  for (const line of lines) {
    const [zip, eiaid, name, state, service, own, , , res] = splitCsv(line);
    if (!zip) continue;
    rows++;
    (byZip[zip] ||= []).push({
      id: +eiaid, name, st: state, svc: service, own,
      res_rate: res ? +(+res).toFixed(4) : null,
    });
  }
}

const shards = {};
for (const [zip, utils] of Object.entries(byZip))
  (shards[zip.substring(0, 2)] ||= {})[zip] = utils;

let total = 0;
for (const [pfx, data] of Object.entries(shards)) {
  const out = JSON.stringify(data);
  total += out.length;
  writeFileSync(join(outDir, pfx + ".json"), out);
}
console.log(`${rows} rows -> ${Object.keys(byZip).length} zips -> ${Object.keys(shards).length} shards, ${(total / 1e6).toFixed(1)}MB total`);
