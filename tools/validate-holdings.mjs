// Validate the FTC holdings artifact before anything ships against it.
//
// Lifted verbatim out of .github/workflows/site.yml, where it was ninety lines
// of JavaScript inside a YAML block: unlinted, untypechecked, and impossible to
// run without copying it back out. The checks are unchanged; they are simply
// runnable by a person now, which is the point of a rule.
//
// Needs neither a browser nor a build.
//
// Usage: npm run validate:holdings
import fs from "node:fs";
import { feature } from "topojson-client";
const topo = JSON.parse(fs.readFileSync("public/data/timeline/holdings-counties.topo.json", "utf8"));
const geometry = feature(topo, Object.values(topo.objects)[0]);
const holdings = JSON.parse(fs.readFileSync("public/data/timeline/holdings-1925.json", "utf8"));
const geometryIds = new Set(geometry.features.map((item) => item.properties.GEOID));
if (holdings.status !== "release-map3-1925+map4-1932") {
  throw new Error(`bad release status: ${holdings.status}`);
}
if (geometry.features.length !== 3108 || geometryIds.size !== 3108) {
  throw new Error("county geometry must be exactly 3,108 unique FIPS");
}

// Every year the artifact calls `complete` is held to the same standard, because
// that flag is the only thing gating a year into the client. A year that ships
// gets the full join and its own anchors; a year still being read is skipped
// here and cannot appear in the map either.
const status = holdings.meta.trace_status ?? {};
const shipped = Object.keys(status).filter((y) => status[y] === "complete").sort();
if (shipped.length === 0) throw new Error("no year is marked complete");
const UNCERTAIN = ["amb:", "maybe:", "partial:", "split:"];
const base = (v) => String(v).split("#")[0];

for (const year of shipped) {
  const trace = holdings.years[year];
  if (trace === undefined) throw new Error(`${year} is complete but has no rows`);
  const ids = Object.keys(trace);
  if (ids.length !== 3108) {
    throw new Error(`${year} must join exactly 3,108 trace FIPS, got ${ids.length}`);
  }
  for (const fips of ids) {
    if (!geometryIds.has(fips)) throw new Error(`${year}: missing geometry ${fips}`);
  }

  // Every key a row names has to exist in that year's legend. A trace naming a
  // mark the legend cannot print is how a classifier's invented class would
  // reach the map, and it is the one failure the anchors cannot catch.
  const legend = holdings.legends[year] ?? {};
  for (const [fips, raw] of Object.entries(trace)) {
    if (typeof raw !== "string") throw new Error(`${year} ${fips}: row is not a string`);
    if (raw === "none" || raw === "unknown-served") continue;
    const prefix = UNCERTAIN.find((p) => raw.startsWith(p));
    const body = prefix === undefined ? raw : raw.slice(prefix.length);
    for (const cand of body.split("|")) {
      if (legend[base(cand)] === undefined) {
        throw new Error(`${year} ${fips}: ${base(cand)} is not in the ${year} legend`);
      }
    }
  }

  // Anchors are checked against the artifact rather than trusted as a stored
  // boolean. A flag that nothing compares keeps passing while the trace under it
  // changes, which is the same mistake as an optimiser reporting its own residual.
  const anchors = (holdings.meta.trace_anchors ?? {})[year] ?? [];
  if (anchors.length === 0) throw new Error(`${year} ships with no anchors`);
  const rollup = (holdings.key_rollup ?? {})[year] ?? {};
  for (const a of anchors) {
    for (const fips of a.fips) {
      const raw = trace[fips];
      if (raw === undefined) throw new Error(`${year} anchor ${a.id}: ${fips} missing`);
      const got = a.expect_base !== undefined
        ? base(raw)
        : (rollup[base(raw)] ?? base(raw));
      const want = a.expect_base ?? a.expect_canonical;
      if (want === undefined) throw new Error(`${year} anchor ${a.id}: no expectation`);
      if (got !== want) {
        throw new Error(`${year} anchor ${a.id} at ${fips}: expected ${want}, got ${got}`);
      }
    }
  }

  // The failed classifier's field names must not reach the artifact. They are
  // keys, so this walks structure. Matching value substrings instead would flag
  // `unknown-served` for containing `served`, which is the honest record.
  const forbidden = new Set(holdings.meta.forbidden_legacy_fields ?? []);
  const walk = (node, path) => {
    if (Array.isArray(node)) { node.forEach((v) => walk(v, path)); return; }
    if (node === null || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (forbidden.has(k)) throw new Error(`forbidden field ${k} at ${path}`);
      walk(v, `${path}.${k}`);
    }
  };
  walk(trace, `years.${year}`);
  walk(holdings.legends[year] ?? {}, `legends.${year}`);
}
console.log(`validated years: ${shipped.join(", ")}`);
