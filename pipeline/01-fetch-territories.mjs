// Fetch HIFLD Electric Retail Service Territories (NBAM mirror on ArcGIS Online).
// Output: data-raw/territories.geojson (~2,931 features). Re-runnable; pages via resultOffset.
// Usage: node 01-fetch-territories.mjs
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "data-raw");
mkdirSync(outDir, { recursive: true });

const BASE = "https://services3.arcgis.com/OYP7N6mAJJCyH6hd/arcgis/rest/services/Electric_Retail_Service_Territories_HIFLD/FeatureServer/0/query";
const FIELDS = "ID,NAME,STATE,TYPE,REGULATED,CNTRL_AREA,PLAN_AREA,HOLDING_CO,CUSTOMERS,RETAIL_MWH,YEAR";
const PAGE = 250;

const features = [];
for (let offset = 0; ; offset += PAGE) {
  const url = `${BASE}?where=1%3D1&outFields=${FIELDS}&outSR=4326&geometryPrecision=6&f=geojson&resultOffset=${offset}&resultRecordCount=${PAGE}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} at offset ${offset}`);
  const chunk = await res.json();
  if (chunk.error) throw new Error(JSON.stringify(chunk.error));
  const got = chunk.features?.length ?? 0;
  features.push(...(chunk.features ?? []));
  console.log(`offset ${offset}: +${got} (total ${features.length})`);
  if (got < PAGE) break;
}

writeFileSync(join(outDir, "territories.geojson"),
  JSON.stringify({ type: "FeatureCollection", features }));
console.log(`wrote data-raw/territories.geojson with ${features.length} features`);
