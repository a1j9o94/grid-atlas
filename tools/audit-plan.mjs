import { appendFileSync } from "fs";
import { changedFiles, impactOf, probesOf } from "./audit-selection.mjs";

const base = process.argv[2];
let files;
try {
  files = changedFiles(base);
} catch (e) {
  console.error(e.message);
  process.exit(2);
}

const impact = impactOf(files);
const probes = probesOf(files, impact);
const views = impact.selectors.join(",");
const any = views !== "" || probes.history || probes.legend;
const outputs = {
  views,
  history: String(probes.history),
  legend: String(probes.legend),
  any: String(any),
};

console.log(`browser plan: ${files.length} changed files`);
console.log(`  layout: ${views || "none"}`);
console.log(`  history probe: ${outputs.history}`);
console.log(`  legend probe: ${outputs.legend}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT,
    Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(""));
}
