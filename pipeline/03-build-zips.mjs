// Build lazy-loadable ZCTA geometry shards, keyed by 2-digit zip prefix.
// Input: Census cb_2020_us_zcta520_500k shapefile (downloaded if absent).
// Output: ../site/data/zcta/<prefix>.topo.json (~100 files), 15% simplification.
// Usage: node 03-build-zips.mjs
import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const raw = join(here, "data-raw");
const shp = join(raw, "cb_2020_us_zcta520_500k.shp");
const outDir = join(here, "..", "site", "data", "zcta");
mkdirSync(raw, { recursive: true });
mkdirSync(outDir, { recursive: true });

if (!existsSync(shp)) {
  console.log("downloading Census ZCTA shapefile (~67MB zipped)...");
  execSync(`curl -sL -o "${raw}/zcta.zip" "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip" && unzip -o -q "${raw}/zcta.zip" -d "${raw}"`, { stdio: "inherit" });
}

console.log("simplifying and sharding by 2-digit zip prefix...");
execSync(
  `npx -y mapshaper "${shp}" -filter-fields GEOID20 ` +
  `-simplify 15% keep-shapes ` +
  `-each 'pfx=GEOID20.substring(0,2)' ` +
  `-split pfx ` +
  `-o "${outDir}" format=topojson quantization=1e5 extension=".topo.json" singles`,
  { stdio: "inherit", env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" } }
);

const files = readdirSync(outDir).filter(f => f.endsWith(".topo.json"));
const total = files.reduce((s, f) => s + statSync(join(outDir, f)).size, 0);
console.log(`${files.length} shards, ${(total / 1e6).toFixed(1)}MB total`);
