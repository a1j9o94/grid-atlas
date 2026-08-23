// Build per-state electricity prices from EIA-861.
//
// Why this is state-level and not per-utility: in a choice state the wires
// company does not bill you for energy, the retailer does, and retailers have
// no service territory to draw. Colouring the wires layer by revenue per kWh
// would show the five Texas TDUs as the cheapest large utilities in America
// (CenterPoint 4.93, Oncor 5.19 cents), because those are delivery charges with
// the energy half missing. The same distortion hits Ohio, Pennsylvania,
// Illinois and Massachusetts in proportion to how many customers shop. The
// honest denominator only exists once you sum providers that have no shape on
// the map, so the map has to be a state choropleth.
//
// The counting rule, which is the part that is easy to get wrong. Count what
// the customer actually paid, once.
//
//   Part A, bundled utility        the utility billed everything.
//   Part B, energy-only supplier   billed energy; the wires company billed
//                                  delivery separately for the same power.
//   Part C, delivery-only utility  billed delivery.
//   Part D, Texas-style retailer   billed BOTH halves and remits the delivery
//                                  charge to the wires company.
//
// Part D is the trap, and it only exists in Texas. A REP's revenue already
// contains the TDU charge, so adding the Delivery Companies file on top counts
// delivery twice. Doing that put Texas at 17.55 cents against EIA's published
// 14.94. Excluding it, and taking volume from the retailer that billed it,
// reproduces 14.94 exactly and the national average to within 0.02.
//
// So: in a state with Part D filings the Delivery Companies rows stay out of
// the all-in totals. They are still read, because the delivery charge itself is
// a measure worth showing.
//
// Output: <out>/state-prices.json
// Usage:  node 09-build-state-prices.mjs [--out <dir>] [--year 2024]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { gzipSync } from "zlib";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readSheet, num, ensureEia861 } from "./lib/xlsx.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const raw = join(here, "data-raw");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const YEAR = arg("year", "2024");
const outDir = arg("out", join(here, "..", "site", "data"));

mkdirSync(raw, { recursive: true });
mkdirSync(outDir, { recursive: true });

const SHEETS = { sales: `Sales_Ult_Cust_${YEAR}.xlsx`, delivery: `Delivery_Companies_${YEAR}.xlsx` };
const src = await ensureEia861(YEAR, raw, Object.values(SHEETS));
console.log(`EIA-861 ${YEAR}: ${src.sizeMb.toFixed(2)}MB`);

// Column layout is identical in both sheets: each customer class is a block of
// revenue / sales / customers.
const CLASS_BASE = { res: 9, com: 12, ind: 15, tot: 21 };
const REV = 0, MWH = 1;

const st = {};
const seed = () => ({
  rev: { res: 0, com: 0, ind: 0, tot: 0 },
  mwh: { res: 0, com: 0, ind: 0, tot: 0 },
  delRev: { res: 0, tot: 0 },
  delMwh: { res: 0, tot: 0 },
  parts: new Set(),
});

function add(state, row, { countVolume, isDelivery, revenueToTotal = true }) {
  if (!state) return;
  const s = (st[state] ??= seed());
  for (const [cls, base] of Object.entries(CLASS_BASE)) {
    const r = num(row[base + REV]), m = num(row[base + MWH]);
    if (r !== null && revenueToTotal) s.rev[cls] += r;
    if (m !== null && countVolume) s.mwh[cls] += m;
    if (isDelivery && (cls === "res" || cls === "tot")) {
      if (r !== null) s.delRev[cls] += r;
      if (m !== null) s.delMwh[cls] += m;
    }
  }
}

const salesRows = readSheet(join(raw, SHEETS.sales)).slice(3);
// Which states bill through a gross-billing retailer. Read first, because it
// decides how the delivery file is treated.
const grossBilled = new Set(salesRows.filter(r => (r[3] || "").trim() === "D").map(r => (r[6] || "").trim()));

let counted = 0, volumeDropped = 0;
for (const row of salesRows) {
  const state = (row[6] || "").trim();
  const part = (row[3] || "").trim();
  if (!state || !part) continue;
  st[state] ??= seed();
  st[state].parts.add(part);
  // Volume comes from whoever billed the customer for it: the bundled utility,
  // the delivery utility behind an energy-only supplier, or the gross-billing
  // retailer. Part B duplicates Part C volume, so it never counts.
  const countVolume = part === "A" || part === "C" || part === "D";
  if (!countVolume) volumeDropped++;
  add(state, row, { countVolume, isDelivery: part === "C" });
  counted++;
}
let deliveryFolded = 0, deliveryHeldOut = 0;
for (const row of readSheet(join(raw, SHEETS.delivery)).slice(3)) {
  const state = (row[6] || "").trim();
  if (!state) continue;
  st[state] ??= seed();
  st[state].parts.add("C");
  const gross = grossBilled.has(state);
  // Always record the delivery charge itself; only fold it into the all-in
  // totals where no retailer has already billed it.
  add(state, row, { countVolume: !gross, isDelivery: true, revenueToTotal: !gross });
  gross ? deliveryHeldOut++ : deliveryFolded++;
  counted++;
}
console.log(`rows counted: ${counted}; ${volumeDropped} gave revenue but not volume (energy-only filings)`);
console.log(`delivery rows: ${deliveryFolded} folded into the all-in price, ` +
  `${deliveryHeldOut} held out because a retailer already billed them (${[...grossBilled].join(", ")})`);

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const rulesPath = join(outDir, "rules.json");
const rules = existsSync(rulesPath) ? JSON.parse(readFileSync(rulesPath, "utf8")) : { states: {} };

const cents = (r, m) => (m > 0 ? +(r / m * 100).toFixed(2) : null);
// Minimum share of a state's residential load that has to be unbundled before a
// delivery charge derived from it means anything. See the note at its use below.
const MIN_SHOPPED_SHARE = 0.01;
const thinSamples = [];
const states = {};
for (const [abbr, s] of Object.entries(st)) {
  if (!rules.states[abbr]) continue; // territories and non-states the map cannot draw
  const rec = {
    bucket: rules.states[abbr].bucket,
    res: cents(s.rev.res, s.mwh.res),
    com: cents(s.rev.com, s.mwh.com),
    ind: cents(s.rev.ind, s.mwh.ind),
  };
  // Delivery is only broken out where retail competition exists. Everywhere
  // else the utility files one bundled number and the wires portion is simply
  // not in the data. Leaving it null is the honest answer; a zero would not be.
  //
  // A share floor rather than `> 0`, because a handful of unbundled customers is
  // not a sample. Montana has two unbundled households in the whole state and
  // Michigan twenty-one, and those produced published delivery rates of 6.00 and
  // 9.59 cents: arithmetic on nobody, sitting on the map next to Ohio's 8.26
  // drawn from 2.98 million households. Both were also the only non-choice states
  // in the list, which is the tell. One per cent of residential load is well
  // clear of the real floor: the lowest genuine reading is New Jersey at 5.0%,
  // and Montana and Michigan are both under 0.05%.
  const shopped = s.mwh.res > 0 ? s.delMwh.res / s.mwh.res : 0;
  if (shopped >= MIN_SHOPPED_SHARE) {
    rec.delivery = cents(s.delRev.res, s.delMwh.res);
    rec.shopped = +shopped.toFixed(3);
  } else if (s.delMwh.res > 0) {
    thinSamples.push(`${abbr} ${(shopped * 100).toFixed(3)}% of residential load`);
  }
  states[abbr] = rec;
}

// The registry drives the client the same way measures.json does: a new
// shading is an entry here plus a copy string, with no rendering code.
const measures = [
  { id: "bucket", label: "Who can choose", kind: "categorical" },
  { id: "res", label: "What households pay", unit: "cents per kWh", short: "¢/kWh", kind: "sequential" },
  { id: "ind", label: "What industry pays", unit: "cents per kWh", short: "¢/kWh", kind: "sequential",
    note: "The closest thing in the data to the structural cost of moving power, since industrial customers buy near cost with little retail margin on top." },
  { id: "delivery", label: "What delivery alone costs", unit: "cents per kWh", short: "¢/kWh", kind: "sequential",
    note: "Only reported where customers can shop, because only then does the wires company bill separately. Blank across most of the country: a bundled utility files one number and the wires portion of it is not in the public record at all." },
  { id: "shopped", label: "How many actually switched", unit: "share of household electricity", short: "%", kind: "sequential",
    note: "Share of household electricity delivered to customers who bought their energy from someone other than the wires company." },
];

const payload = {
  meta: {
    source: `EIA-861 Annual Electric Power Industry Report, ${YEAR} edition`,
    url: src.url,
    files: Object.values(SHEETS),
    retrieved: new Date().toISOString().slice(0, 10),
    rule: "Price is what customers paid, counted once. A shopping customer's megawatthours are reported by both the energy seller and the wires company. In Texas the retailer bills both halves and remits delivery to the wires company, so the delivery file is held out of the all-in total there to avoid counting it twice.",
    caveat: "Restructured states are more expensive on household bills, but they did not become expensive by restructuring. The Northeast, Illinois and Texas opened their markets largely because prices were already high. This map shows correlation.",
  },
  measures,
  states,
};

const json = JSON.stringify(payload);
writeFileSync(join(outDir, "state-prices.json"), json);

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

const vals = Object.values(states);
const withDelivery = vals.filter(v => v.delivery != null).length;
const natRev = Object.values(st).reduce((a, s) => a + s.rev.res, 0);
const natMwh = Object.values(st).reduce((a, s) => a + s.mwh.res, 0);
const national = natRev / natMwh * 100;

const byBucket = {};
for (const v of vals) (byBucket[v.bucket] ??= []).push(v.res);
console.log("\nstate-prices.json");
console.log(`  states                ${vals.length}`);
console.log(`  national residential  ${national.toFixed(2)} c/kWh`);
console.log(`  delivery reported in  ${withDelivery} states`);
if (thinSamples.length) {
  console.log(`  delivery suppressed   ${thinSamples.length} states under the ${(MIN_SHOPPED_SHARE * 100).toFixed(0)}% residential-load floor`);
  for (const t of thinSamples) console.log(`    ${t}`);
}
for (const [b, arr] of Object.entries(byBucket)) {
  const sorted = arr.slice().sort((a, c) => a - c);
  console.log(`  ${b.padEnd(9)} n=${String(arr.length).padStart(2)}  median ${sorted[sorted.length >> 1].toFixed(2)}  range ${sorted[0].toFixed(2)}-${sorted[sorted.length - 1].toFixed(2)}`);
}
console.log(`  size                  ${(json.length / 1024).toFixed(1)}KB raw, ${(gzipSync(json, { level: 9 }).length / 1024).toFixed(1)}KB gzipped`);

const fail = [];
if (vals.length < 50) fail.push(`only ${vals.length} states, expected 51 including DC`);
// EIA's published US average residential price for recent years sits in the
// mid-teens. Well outside that band means the double-count rule is wrong.
if (national < 13 || national > 20) fail.push(`national residential ${national.toFixed(2)} c/kWh is outside the plausible 13-20 band`);
for (const [abbr, v] of Object.entries(states)) {
  for (const k of ["res", "com", "ind", "delivery"]) {
    if (v[k] != null && (v[k] <= 0 || v[k] > 100)) fail.push(`${abbr}.${k} = ${v[k]} is not a plausible price`);
  }
  if (v.delivery != null && v.res != null && v.delivery > v.res)
    fail.push(`${abbr}: delivery ${v.delivery} exceeds the all-in price ${v.res}`);
  if (v.shopped != null && (v.shopped < 0 || v.shopped > 1)) fail.push(`${abbr}.shopped = ${v.shopped}`);
}
if (fail.length) {
  console.error("\nFAILED:");
  for (const f of fail.slice(0, 12)) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nall assertions passed");
