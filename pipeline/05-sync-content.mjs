// Copy the content deck into the deployable site directory.
//
// Takes --out like every other step in this pipeline. It used to hardcode
// site/data, which meant a copy deck edit reached the deployable repo only if
// somebody remembered to copy the file by hand.
//
// Usage: node 05-sync-content.mjs [--out <dir>]
import { copyFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const i = argv.indexOf("--out");
const outDir = i >= 0 && argv[i + 1] ? argv[i + 1] : join(here, "..", "site", "data");

mkdirSync(outDir, { recursive: true });
for (const f of ["copy.json", "rules.json"]) {
  copyFileSync(join(here, "..", "content", f), join(outDir, f));
  console.log(`copied content/${f} -> ${join(outDir, f)}`);
}
