// Replay RTO/ISO membership from 1996 and emit each utility's market per frame.
//
// The model is zones, not utilities. A zone is a named operating company that
// appears in a roster; every other utility inherits the zone whose territory
// contains it. That is how it worked, and it is also forced by the data: HIFLD
// carries 312 features for PJM against 21 present-day zones, so a rule keyed on
// utilities would put every co-op in the 1997 founding roster and show Northern
// Virginia Electric Coop inside PJM eight years before Dominion joined.
//
// The gate is a forward invariant. Replay from a 1996 state of NONE, and every
// utility's final state must equal its present-day assignment on the live map.
// Anything else fails and names the utility. PJM is checked first and on its
// own, per the assembly document, because it is the one chain where the roster
// is read from filings rather than derived.
//
// Usage: node 15-build-membership.mjs [--out <path>]
import { execSync } from "child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { preprocess } from "./lib/hifld.mjs";
import { contains } from "./lib/geo.mjs";
import { buildIndex, loadEvents, resolveName } from "./lib/membership.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
// Six levels up is the workspace root, where the grid-atlas checkout sits.
const OUT = resolve(arg("out", join(here, "../../../../../../grid-atlas/public/data/timeline")));
const raw = join(here, "data-raw");
const work = join(raw, "membership");
mkdirSync(work, { recursive: true });
mkdirSync(OUT, { recursive: true });
const mapshaper = `"${join(here, "node_modules", ".bin", "mapshaper")}"`;
const sh = (cmd) => execSync(cmd, { stdio: "inherit" });

const file = loadEvents(here);
const { fc } = preprocess(JSON.parse(readFileSync(join(raw, "territories.geojson"), "utf8")), here);
const byNorm = buildIndex(fc.features);
const key = (f) => `${f.properties.NAME}|${f.properties.STATE}`;

// ---- resolve every roster to features ----
const fail = [];
const rosterOf = new Map();
for (const e of file.events) {
  if (!Array.isArray(e.roster)) continue;
  const feats = [];
  for (const n of e.roster) {
    const r = resolveName(n, byNorm, fc.features);
    if (r.feature) feats.push(r.feature);
    else if (!r.skip) fail.push(`${e.id}: ${n}: ${r.error}`);
  }
  // Columbus Southern and Ohio Power both resolve to OHIO POWER CO after the
  // 2011 merger, so a roster can name one company twice.
  rosterOf.set(e.id, [...new Map(feats.map((f) => [key(f), f])).values()]);
}
if (fail.length) {
  for (const f of fail) console.error("  " + f);
  throw new Error(`${String(fail.length)} roster names do not resolve; a wrong match would redraw a market`);
}

// Every named company in any roster is a zone.
const zones = new Map();
for (const feats of rosterOf.values()) for (const f of feats) zones.set(key(f), f);
console.log(`zones named by rosters: ${String(zones.size)}`);

// ---- inheritance: which zone contains each other utility ----
// Restricted to zones of the same present-day market, because a utility's
// present-day market is known and is the thing the invariant has to reproduce.
// Without that restriction a border co-op picks up the nearest zone across a
// market boundary and the invariant fails for a reason that is not a data
// problem.
const IN_SCOPE = new Set(["PJM", "MISO", "SPP", "ERCOT", "CAISO", "NYISO", "ISONE", "SPPWEST"]);
const centroid = (f) => {
  let sx = 0, sy = 0, n = 0;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) for (const [x, y] of poly[0]) { sx += x; sy += y; n++; }
  return [sx / n, sy / n];
};
// Points known to be inside a territory, for a majority vote rather than a
// single test. A co-op's vertex-average centroid frequently falls outside the
// shape itself, let alone inside a zone, which is why the first pass assigned
// four utilities in five by proximity instead of containment. Sampling the ring
// vertices and their pairwise midpoints costs nothing and lands real points in
// the interior of a concave shape.
const samplePoints = (f, cap = 24) => {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const verts = [];
  for (const poly of polys) for (const [x, y] of poly[0]) verts.push([x, y]);
  if (verts.length === 0) return [];
  const out = [];
  const step = Math.max(1, Math.floor(verts.length / cap));
  for (let i = 0; i < verts.length; i += step) {
    const a = verts[i], b = verts[(i + Math.floor(verts.length / 2)) % verts.length];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (contains(f, mid)) out.push(mid);
  }
  const c = centroid(f);
  if (contains(f, c)) out.push(c);
  return out.length ? out : [c];
};
// A bounding box per zone, tested before the ray cast. Without it this is
// 2,900 utilities times 24 points times 42 zones of full polygon traversal,
// which does not finish; with it almost every pair is rejected on four
// comparisons.
const bbox = (f) => {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) for (const ring of poly) for (const [x, y] of ring) {
    if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y;
    if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
  }
  return b;
};
const inBox = (b, [x, y]) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
const zonesByMarket = new Map();
const zoneBox = new Map();
for (const z of zones.values()) {
  const m = z.properties.RTO;
  if (!zonesByMarket.has(m)) zonesByMarket.set(m, []);
  zonesByMarket.get(m).push(z);
  zoneBox.set(key(z), bbox(z));
}
const zoneOf = new Map();
const contested = new Map(), nearestOnly = new Map();
let byContainment = 0, byNearest = 0, noZone = 0;
for (const f of fc.features) {
  const m = f.properties.RTO;
  if (!IN_SCOPE.has(m)) continue;
  if (zones.has(key(f))) { zoneOf.set(key(f), key(f)); continue; }
  const cands = zonesByMarket.get(m) ?? [];
  if (cands.length === 0) { noZone++; continue; }
  // Majority vote over interior points. Ties break to the larger zone, because
  // a co-op straddling two overlapping zone shapes belongs to the one that
  // defines the region.
  const pts = samplePoints(f);
  const votes = new Map();
  for (const p of pts) for (const z of cands) {
    if (!inBox(zoneBox.get(key(z)), p)) continue;
    if (contains(z, p)) votes.set(key(z), (votes.get(key(z)) ?? 0) + 1);
  }
  if (votes.size > 0) {
    const ranked = [...votes.entries()].sort((a, b) =>
      b[1] - a[1] || (zones.get(b[0]).properties.CUSTOMERS - zones.get(a[0]).properties.CUSTOMERS));
    zoneOf.set(key(f), ranked[0][0]);
    // A utility whose interior points land in more than one zone is where the
    // inheritance is a judgement rather than a reading, so record the runners-up
    // and let the sensitivity pass below decide whether it matters.
    if (votes.size > 1) contested.set(key(f), ranked.map((r) => r[0]));
    byContainment++;
  } else {
    const c = centroid(f);
    let best = null, bd = Infinity;
    for (const z of cands) {
      const zc = centroid(z);
      const d = (zc[0] - c[0]) ** 2 + (zc[1] - c[1]) ** 2;
      if (d < bd) { bd = d; best = z; }
    }
    zoneOf.set(key(f), key(best));
    // No interior point of this utility lies in any zone of its own market, so
    // proximity is all there is. Every one of these is a candidate for review.
    nearestOnly.set(key(f), key(best));
    byNearest++;
  }
}
console.log(`inheritance: ${String(byContainment)} by containment, ${String(byNearest)} by nearest zone, ` +
  `${String(noZone)} in a market with no named zone`);

// ---- the closure rule ----
// Defect A from the assembly document: the rule as written silently drops every
// utility that was in a market at founding and left afterward, and its
// departure then fires from an empty state. The augmentation clause is the
// second half here.
function closureRoster(market, event) {
  const laterJoin = new Set();
  const earlierJoin = new Set();
  for (const e of file.events) {
    if (!Array.isArray(e.roster)) continue;
    const feats = rosterOf.get(e.id) ?? [];
    if (e.date > event.date && (e.kind === "join" || e.kind === "move") && e.market === market)
      for (const f of feats) laterJoin.add(key(f));
    if (e.date <= event.date && (e.kind === "join" || e.kind === "move") && e.market === market)
      for (const f of feats) earlierJoin.add(key(f));
  }
  const out = new Map();
  for (const z of zones.values()) {
    if (z.properties.RTO !== market) continue;
    if (laterJoin.has(key(z))) continue;
    out.set(key(z), z);
  }
  // plus the source of every later departure that never joined
  for (const e of file.events) {
    if (!Array.isArray(e.roster)) continue;
    const departs = (e.kind === "leave" && e.market === market) ||
                    (e.kind === "move" && e.from === market);
    if (!departs || e.date <= event.date) continue;
    for (const f of rosterOf.get(e.id) ?? []) {
      if (earlierJoin.has(key(f))) continue;
      out.set(key(f), f);
    }
  }
  const less = new Set((event.roster.less ?? []).map((n) => {
    const r = resolveName(n, byNorm, fc.features);
    return r.feature ? key(r.feature) : n;
  }));
  for (const k of less) out.delete(k);
  return [...out.values()];
}

// ---- replay ----
const state = new Map();      // zone key -> market or NONE
for (const z of zones.keys()) state.set(z, "NONE");
const history = [];           // [date, zone key, market] for every change
const applyRoster = (feats, market, date) => {
  for (const f of feats) {
    const k = key(f);
    if (state.get(k) === market) continue;
    state.set(k, market);
    history.push([date, k, market]);
  }
};
for (const e of file.events) {
  if (e.kind === "designation" || e.kind === "market-start") continue;
  const feats = Array.isArray(e.roster) ? (rosterOf.get(e.id) ?? []) : closureRoster(e.market, e);
  if (e.kind === "leave") {
    for (const f of feats) { state.set(key(f), "NONE"); history.push([e.date, key(f), "NONE"]); }
  } else {
    applyRoster(feats, e.market, e.date);
  }
  console.log(`  ${e.date} ${e.kind.padEnd(10)} ${e.market.padEnd(8)} ${String(feats.length).padStart(3)} zones`);
}

// ---- the invariant ----
const invariantFails = [];
for (const [k, z] of zones) {
  const want = z.properties.RTO;
  const got = state.get(k);
  if (got !== want) invariantFails.push(`${k}: replay ends at ${got}, live map says ${want}`);
}
console.log(`\ninvariant over ${String(zones.size)} zones: ${String(zones.size - invariantFails.length)} agree`);
for (const f of invariantFails) console.error("  FAIL " + f);

// PJM on its own, first, because it is the one chain read from filings.
const pjmZones = [...zones.values()].filter((z) => z.properties.RTO === "PJM");
const pjmFails = pjmZones.filter((z) => state.get(key(z)) !== "PJM");
console.log(`PJM regression: ${String(pjmZones.length - pjmFails.length)}/${String(pjmZones.length)} zones end in PJM`);
for (const z of pjmFails) console.error("  PJM FAIL " + key(z) + " ends at " + state.get(key(z)));

// ---- per-frame assignment, and how much the inheritance model matters ----
// A zone's market at an instant, read off the replay history.
const FRAMES = file.meta.snapshot_instants;
function marketAt(zoneKey, instant) {
  let cur = "NONE";
  for (const [date, k, m] of history) {
    if (k !== zoneKey) continue;
    if (date <= instant) cur = m; else break;
  }
  return cur;
}
// The zones nearest a utility, in order, so the same assignment can be redone
// under the second and third choice and compared. If all three give the same
// market at every frame, the proximity model is not carrying the answer.
function nearestZones(f, cands, n = 3) {
  const c = centroid(f);
  return cands
    .map((z) => ({ k: key(z), d: (centroid(z)[0] - c[0]) ** 2 + (centroid(z)[1] - c[1]) ** 2 }))
    .sort((a, b) => a.d - b.d).slice(0, n).map((x) => x.k);
}

// Which rule each market uses, and which markets a frame may draw at all. Both
// are declared in the events file with a reason, not decided here.
const RULE = Object.fromEntries(Object.entries(file.meta.roster_completeness)
  .map(([m, why]) => [m, why.startsWith("complete") ? "inheritance" : "closure"]));
const DRAWN = Object.fromEntries(Object.entries(file.meta.drawn_per_frame)
  .map(([fr, v]) => [fr, new Set(v.markets)]));
console.log("rule per market:", RULE);

const foundingDate = (m) => file.events.find((e) => e.market === m && e.kind === "founding")?.date;
// Under closure, a utility not named in any roster is in its market from
// founding; one that is named follows its own dates. Under inheritance it
// follows the nearest named zone either way.
const namedSomewhere = new Set();
for (const feats of rosterOf.values()) for (const f of feats) namedSomewhere.add(key(f));

const perFrame = {};       // utility key -> { frame: market }
const sensitive = [];      // utilities whose answer depends on which zone won
for (const f of fc.features) {
  const m = f.properties.RTO;
  if (!IN_SCOPE.has(m)) continue;
  const k = key(f);
  const z = zoneOf.get(k);
  const row = {};
  const rule = RULE[m] ?? "closure";
  for (const [fr, instant] of Object.entries(FRAMES)) {
    if (namedSomewhere.has(k) || rule === "inheritance") {
      row[fr] = z === undefined ? "NONE" : marketAt(z, instant);
    } else {
      const fd = foundingDate(m);
      row[fr] = fd !== undefined && fd <= instant ? m : "NONE";
    }
    // The frame draws a declared set of markets, and the test is on the market
    // the replay produced, not on the utility's present-day one. Duke Energy
    // Ohio is the case that caught this: it is PJM today, and the closure rule's
    // augmentation clause correctly puts it in MISO from 1998, so testing the
    // present-day market let MISO onto a 1999 plate that must not draw it.
    if (!DRAWN[fr].has(row[fr])) row[fr] = "NONE";
  }
  // Sensitivity is only a question where inheritance is doing the work.
  if (rule === "inheritance" && !zones.has(k) && z !== undefined) {
    const alts = nearestZones(f, zonesByMarket.get(m) ?? []);
    const disagree = Object.entries(FRAMES).filter(([fr, instant]) =>
      DRAWN[fr].has(m) && new Set(alts.map((a) => marketAt(a, instant))).size > 1).map(([fr]) => fr);
    if (disagree.length) sensitive.push({ utility: k, market: m, frames: disagree, candidates: alts });
  }
  perFrame[k] = row;
}
const assigned = Object.keys(perFrame).length;
console.log(`
per-frame assignment for ${String(assigned)} utilities`);
for (const fr of Object.keys(FRAMES)) {
  const tally = {};
  for (const row of Object.values(perFrame)) tally[row[fr]] = (tally[row[fr]] ?? 0) + 1;
  console.log(`  ${fr}: ${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${String(n)}`).join(", ")}`);
}
console.log(`
inheritance sensitivity: ${String(sensitive.length)} of ${String(assigned - zones.size)} inherited utilities ` +
  `would get a different market at some frame under their second or third nearest zone ` +
  `(${(100 * sensitive.length / Math.max(1, assigned - zones.size)).toFixed(1)}%)`);
const byMarket = {};
for (const s of sensitive) byMarket[s.market] = (byMarket[s.market] ?? 0) + 1;
console.log("  by market:", byMarket);

writeFileSync(join(work, "roster-report.json"), JSON.stringify({
  note: "For human review. `sensitive` lists utilities whose frame membership depends on which zone the proximity model picked. `nearestOnly` lists utilities no interior point of which lies in any zone of their own market. `contested` lists utilities whose interior points landed in more than one zone.",
  sensitive, nearestOnly: [...nearestOnly.entries()], contested: [...contested.entries()],
}, null, 1));
writeFileSync(join(work, "per-frame.json"), JSON.stringify(perFrame));

writeFileSync(join(work, "replay.json"), JSON.stringify({
  zones: [...zones.keys()], history, final: [...state.entries()],
  inheritance: [...zoneOf.entries()], invariantFails,
}, null, 1));
if (invariantFails.length) throw new Error(`${String(invariantFails.length)} zones do not reproduce the live map`);

// ---- the dissolve ----
// Same cleaning the live map was built from, and the same Texas precedence, so
// a 2014 footprint and a 2026 one disagree only where history disagrees. The
// marketing polygons come out for the same reason they come out of the seam:
// they are not service territories.
import { isMarketingArea } from "./lib/interconnection.mjs";
const drawable = fc.features.filter((f) => !isMarketingArea(f) && perFrame[key(f)] !== undefined);
console.log(`\ndissolving ${String(drawable.length)} territories per frame`);

const ercotTx = drawable.filter((f) => f.properties.STATE === "TX" && f.properties.RTO === "ERCOT");
if (!ercotTx.some((f) => f.properties.NAME === "CITY OF CALDWELL"))
  throw new Error("Caldwell missing from the Texas precedence mask");

const frameFiles = [];
for (const fr of Object.keys(FRAMES)) {
  const feats = drawable.map((f) => ({
    type: "Feature",
    geometry: f.geometry,
    properties: { m: perFrame[key(f)][fr] },
  })).filter((f) => f.properties.m !== "NONE");
  const src = join(work, `f${fr}-src.geojson`);
  writeFileSync(src, JSON.stringify({ type: "FeatureCollection", features: feats }));
  const out = join(work, `f${fr}.geojson`);
  sh(`${mapshaper} "${src}" -dissolve m -simplify 5% keep-shapes -clean -o "${out}" format=geojson`);
  frameFiles.push(out);
  const got = JSON.parse(readFileSync(out, "utf8")).features.map((x) => x.properties.m).sort();
  console.log(`  f${fr}: ${got.join(", ")}`);
  const want = [...DRAWN[fr]].filter((mk) => Object.values(perFrame).some((r) => r[fr] === mk)).sort();
  if (got.join() !== want.join())
    throw new Error(`f${fr} dissolved to ${got.join()}, expected ${want.join()}`);
}

const OUTFILE = join(OUT, "regions.topo.json");
sh(`${mapshaper} ${frameFiles.map((f) => `"${f}"`).join(" ")} combine-files ` +
  `-o "${OUTFILE}" format=topojson quantization=1e5`);
const topo = JSON.parse(readFileSync(OUTFILE, "utf8"));
console.log(`\n${OUTFILE} ${(statSync(OUTFILE).size / 1e6).toFixed(2)}MB objects: ${Object.keys(topo.objects).join(", ")}`);
console.log(`roster report: ${join(work, "roster-report.json")}`);
