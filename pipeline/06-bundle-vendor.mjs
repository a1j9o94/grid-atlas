// Bundle the site's runtime deps (d3-geo projection, topojson decode) into
// one self-hosted ES module: ../site/vendor.js. Run after `npm install` here.
// Usage: node 06-bundle-vendor.mjs
import { execSync } from "child_process";
import { writeFileSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "vendor-entry.mjs");
const out = join(here, "..", "site", "vendor.js");

writeFileSync(entry, `export { geoAlbersUsa, geoPath } from "d3-geo";
export { feature, mesh } from "topojson-client";
`);

execSync(`npx -y esbuild "${entry}" --bundle --format=esm --minify --outfile="${out}"`, { stdio: "inherit", cwd: here });
console.log("vendor.js", (statSync(out).size / 1024).toFixed(0) + "KB");
