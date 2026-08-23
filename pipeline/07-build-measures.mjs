// Build per-utility measures (meters, energy, revenue) from EIA-861 and join
// them onto the map's utility universe by EIA utility ID.
//
// Why this exists: HIFLD ships a CUSTOMERS field, but it is blank for every
// delivery-only TDU in ERCOT (encoded as the sentinel -999999). Oncor,
// CenterPoint, AEP Texas Central/North and TNMP together serve ~8.2M meters and
// all five read as -999999, which makes ERCOT's meter total NEGATIVE. Any map
// that sizes territories by customers would erase Dallas and Houston.
//
// EIA-861 fixes that and much more: HIFLD's ID field IS the EIA utility number,
// so one join brings in sales, revenue and customer counts by customer class.
// Measures live in their own file so the 5.5MB geometry stays cached when they
// change, and so adding a new variable never touches the client.
//
// Output: <out>/measures.json
// Usage:  node 07-build-measures.mjs [--out <dir>] [--wires <path>] [--year 2024]

import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { gzipSync } from "zlib";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readSheet, num } from "./lib/xlsx.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const raw = join(here, "data-raw");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const YEAR = arg("year", "2024");
const outDir = arg("out", join(here, "..", "site", "data"));
const wiresPath = arg("wires", join(outDir, "wires.topo.json"));
const ZIP_URL = `https://www.eia.gov/electricity/data/eia861/zip/f861${YEAR}.zip`;

// ---------------------------------------------------------------------------
// Source data
// ---------------------------------------------------------------------------

mkdirSync(raw, { recursive: true });
mkdirSync(outDir, { recursive: true });

const zipPath = join(raw, `f861${YEAR}.zip`);
if (!existsSync(zipPath)) {
  console.log(`fetching ${ZIP_URL}`);
  const res = await fetch(ZIP_URL);
  if (!res.ok) throw new Error(`EIA-861 ${YEAR} fetch failed: ${res.status}`);
  writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
}
console.log(`EIA-861 ${YEAR}: ${(statSync(zipPath).size / 1048576).toFixed(2)}MB`);

const SHEETS = {
  sales: `Sales_Ult_Cust_${YEAR}.xlsx`,
  delivery: `Delivery_Companies_${YEAR}.xlsx`,
  shortForm: `Short_Form_${YEAR}.xlsx`,
  reliability: `Reliability_${YEAR}.xlsx`,
  netMetering: `Net_Metering_${YEAR}.xlsx`,
  nonNetMetering: `Non_Net_Metering_Distributed_${YEAR}.xlsx`,
  advancedMeters: `Advanced_Meters_${YEAR}.xlsx`,
};
for (const f of Object.values(SHEETS)) {
  execSync(`unzip -o -q "${zipPath}" "${f}" -d "${raw}"`);
}

// ---------------------------------------------------------------------------
// The utility universe: whatever the wires layer actually draws.
// ---------------------------------------------------------------------------

if (!existsSync(wiresPath)) throw new Error(`wires geometry not found at ${wiresPath} (run 02-build-layers.mjs, or pass --wires)`);
const topo = JSON.parse(readFileSync(wiresPath, "utf8"));
const geoms = topo.objects[Object.keys(topo.objects)[0]].geometries;
const universe = new Map();
for (const g of geoms) {
  const p = g.properties;
  // -999999 is HIFLD's "not reported"; 0 on a real utility means the same.
  // Neither is a customer count, so neither survives as a number.
  universe.set(p.ID, { name: p.NAME, rto: p.RTO, hifld: p.CUSTOMERS > 0 ? p.CUSTOMERS : null });
}
console.log(`utility universe: ${universe.size} territories from ${wiresPath.replace(here, ".")}`);

// ---------------------------------------------------------------------------
// Mergers. EIA retires the predecessor IDs and files everything under a new
// number, but HIFLD still draws the old territories, so without a remap those
// polygons silently fall out of the join.
//
// The 2024 Mergers file lists FirstEnergy Pennsylvania Electric (66101) with
// "see footnotes" rather than a machine-readable predecessor list, so the four
// constituent companies are named here. FirstEnergy consolidated West Penn
// Power, Pennsylvania Electric (Penelec), Metropolitan Edison (Met-Ed) and
// Pennsylvania Power into a single utility effective 2024-01-01.
//
// Successor totals are split across the predecessor territories in proportion
// to the meters HIFLD already records for each, because the merged filing
// reports one number for what the map still draws as four shapes. The split is
// a documented approximation; the aggregate is exact.
const MERGERS = [
  { successor: "66101", predecessors: ["20387", "14711", "12390", "14716"], note: "FirstEnergy Pennsylvania Electric, effective 2024-01-01" },
];

// ---------------------------------------------------------------------------
// Aggregation
//
// Part is what makes this correct, and it is not obvious:
//   Part A / Bundled   traditional full-service utilities        KEEP
//   Part B / Energy    energy-only providers, no wires           DROP
//   Part C / Delivery  delivery-only wires companies             KEEP
//   Part D / Bundled   Texas-style REPs that bill energy+delivery DROP
//
// Part D is the trap. TXU Energy (1.84M) and Reliant (1.66M) file as "Bundled"
// because an ERCOT retailer bills the customer for both halves, but they own no
// poles. Keeping them would attach a retailer's statewide book of business to
// whichever polygon happens to share its utility ID. Nueces Electric
// Cooperative is exactly that case: 20,042 meters on its wires under Part A,
// plus a 32,561-meter retail arm under Part D that sells across ERCOT.
// ---------------------------------------------------------------------------

const CLASSES = ["res", "com", "ind", "tra", "tot"];
const COL = { rev: 0, mwh: 1, cust: 2 }; // offsets within each class block
const CLASS_BASE = { res: 9, com: 12, ind: 15, tra: 18, tot: 21 };

const acc = new Map(); // id -> { rev:{}, mwh:{}, cust:{}, states:Set, src:Set }
const blank = () => ({
  rev: Object.create(null),
  mwh: Object.create(null),
  cust: Object.create(null),
  states: new Set(),
  src: new Set(),
});

function addRow(target, id, row, source) {
  if (!target.has(id)) target.set(id, blank());
  const a = target.get(id);
  a.src.add(source);
  const st = (row[6] || "").trim();
  if (st) a.states.add(st);
  for (const cls of CLASSES) {
    for (const [metric, off] of Object.entries(COL)) {
      const v = num(row[CLASS_BASE[cls] + off]);
      if (v === null) continue;
      a[metric][cls] = (a[metric][cls] ?? 0) + v;
    }
  }
}

// Successor IDs are not in the map's universe (HIFLD still draws the old
// territories), so their filings accumulate separately and are redistributed
// onto the predecessor shapes further down.
const successorAcc = new Map();
const successorIds = new Set(MERGERS.map(m => m.successor));

// 1. main table, Parts A and C only
const salesRows = readSheet(join(raw, SHEETS.sales)).slice(3);
let droppedParts = 0;
const partsFiled = new Map(); // id -> Set of parts, to spot energy-only sellers
for (const row of salesRows) {
  const id = (row[1] || "").trim();
  if (!id) continue;
  const part = (row[3] || "").trim();
  if (!partsFiled.has(id)) partsFiled.set(id, new Set());
  partsFiled.get(id).add(part);
  if (part !== "A" && part !== "C") {
    droppedParts++;
    continue;
  }
  if (universe.has(id)) addRow(acc, id, row, "eia861-sales");
  if (successorIds.has(id)) addRow(successorAcc, id, row, "eia861-sales");
}
console.log(`sales rows: ${salesRows.length} read, ${droppedParts} dropped as Part B/D (energy-only providers and retailers)`);

// 2. delivery-only companies. Verified to share no utility IDs with the main
//    table, so these are additive rather than a duplicate view of it.
const deliveryRows = readSheet(join(raw, SHEETS.delivery)).slice(3);
let deliveryHits = 0;
for (const row of deliveryRows) {
  const id = (row[1] || "").trim();
  if (!id || !universe.has(id)) continue;
  addRow(acc, id, row, "eia861-delivery");
  deliveryHits++;
}
console.log(`delivery-only rows: ${deliveryRows.length} read, ${deliveryHits} joined`);

// 3. short form: the small-utility tail. Fallback only, never an addend, or the
//    ~1,700 co-ops and municipals that file it would be counted twice.
const shortRows = readSheet(join(raw, SHEETS.shortForm)).slice(1);
let shortHits = 0;
for (const row of shortRows) {
  const id = (row[1] || "").trim();
  if (!id || !universe.has(id) || acc.has(id)) continue;
  const a = blank();
  a.src.add("eia861-short-form");
  const st = (row[4] || "").trim();
  if (st) a.states.add(st);
  const rev = num(row[6]), mwh = num(row[7]), cust = num(row[8]);
  if (rev !== null) a.rev.tot = rev;
  if (mwh !== null) a.mwh.tot = mwh;
  if (cust !== null) a.cust.tot = cust;
  acc.set(id, a);
  shortHits++;
}
console.log(`short-form rows: ${shortRows.length} read, ${shortHits} joined as fallback`);

// 4. redistribute merged filings across the territories the map still draws
for (const m of MERGERS) {
  const src = successorAcc.get(m.successor);
  if (!src) {
    console.warn(`  merger ${m.successor}: no filing found, skipped`);
    continue;
  }
  const parts = m.predecessors.filter(p => universe.has(p));
  const weights = parts.map(p => universe.get(p).hifld ?? 0);
  const wsum = weights.reduce((s, w) => s + w, 0);
  if (!wsum) {
    console.warn(`  merger ${m.successor}: predecessors carry no HIFLD meters, skipped`);
    continue;
  }
  parts.forEach((p, i) => {
    const share = weights[i] / wsum;
    const a = blank();
    a.src.add("eia861-merger-split");
    for (const s of src.states) a.states.add(s);
    for (const metric of Object.keys(COL)) {
      for (const [cls, v] of Object.entries(src[metric])) a[metric][cls] = Math.round(v * share);
    }
    acc.set(p, a);
  });
  console.log(`  merger ${m.successor} -> ${parts.length} territories by meter share (${m.note})`);
}

// ---------------------------------------------------------------------------
// Reliability
//
// SAIDI is the minutes an average customer spent without power over the year.
// EIA reports it three ways and the first two are the interesting pair: with
// major event days included, and with them stripped out. The difference is the
// weather. A utility can look terrible in a hurricane year and run a perfectly
// ordinary system, so the map defaults to the storm-free number and offers the
// other, rather than picking one and hiding the choice.
//
// Columns: 5/6/7 all events, 8/9/10 without major events, 11/12/13 loss of
// supply also removed.
// ---------------------------------------------------------------------------

const relRows = readSheet(join(raw, SHEETS.reliability)).slice(3);
// A utility serving several states files one row per state, so the values are
// collected and averaged rather than letting the last row win. Unweighted,
// because this sheet carries no per-state customer count to weight by.
// Appalachian Power is the clearest case: 342 storm-free minutes in Virginia,
// 576 in West Virginia.
const relRaw = new Map();
let relRows2 = 0, relBlank = 0;
for (const row of relRows) {
  const id = (row[1] || "").trim();
  if (!id || !acc.has(id)) continue;
  relRows2++;
  const vals = { all: num(row[5]), freq: num(row[6]), norm: num(row[8]) };
  if (vals.all === null && vals.norm === null) { relBlank++; continue; }
  if (!relRaw.has(id)) relRaw.set(id, []);
  relRaw.get(id).push(vals);
}
for (const [id, list] of relRaw) {
  const a = acc.get(id);
  a.saidi = {};
  a.saidiStates = list.length;
  for (const k of ["norm", "all", "freq"]) {
    const got = list.map(v => v[k]).filter(v => v !== null);
    if (got.length) a.saidi[k] = got.reduce((x, y) => x + y, 0) / got.length;
  }
}
console.log(`reliability: ${relRows.length} rows read, ${relRows2} matched a territory, ` +
  `${relBlank} reported nothing, ${relRaw.size} utilities carry a value`);

// ---------------------------------------------------------------------------
// Rooftop solar
//
// Net metering is the obvious source and on its own it is badly wrong. Texas
// has no statewide net metering rule, so not one of its wires companies files a
// net metering row: Oncor, both AEP Texas companies, TNMP and Austin Energy are
// all absent. A solar map built on that file alone paints the second-sunniest
// large state in the country almost empty. That is the -999999 meter bug in a
// new costume.
//
// EIA publishes the other half separately. Non_Net_Metering_Distributed carries
// the distributed generation that sits outside a net metering tariff, and it is
// where Texas lives: Oncor alone reports 865.9 MW of residential PV there. The
// two files together are the fleet. Texas is 1,080 MW net-metered plus 1,756 MW
// not, so using one file would have hidden 62% of the state's rooftops.
//
// Only the photovoltaic block is read. The non-net-metering file also covers
// fuel cells, gensets and combustion turbines, and a backup diesel set behind a
// factory is not a rooftop. Its "Direct Connected" column is dropped for the
// same reason: that capacity is wired into the distribution system rather than
// sitting behind a customer's meter.
//
// Capacity, not installation counts, is the measure. Counts exist only in the
// net metering file, so a count-based map would inherit exactly the Texas hole
// this join is here to close.
// ---------------------------------------------------------------------------

const CLASSES4 = ["res", "com", "ind", "tra"];

// Read one Residential/Commercial/Industrial/Transportation block and add it in.
// Multi-state filers get one row per state and these are counts and capacities,
// so they sum. Reliability had to average instead, which is why that sheet is
// handled on its own terms rather than through this helper.
//
// A blank cell counts as zero here, and that is the opposite of the rule the
// rest of this file follows. It is right for these three sheets because the row
// itself is the report: a utility that filed a net metering row with an empty
// residential column has told us it net-meters no houses, and one that filed an
// advanced meters row with an empty AMI column has told us it has none.
//
// Getting this wrong was not theoretical. Dropping those blanks discarded every
// utility with no smart meters, which pulled 10.8 million meters out of the
// denominator and reported the national AMI share as 91.1% instead of 83.8%.
// Absence of a row is still null: those utilities never answered at all.
function addBlock(map, id, row, base) {
  if (!map.has(id)) map.set(id, Object.create(null));
  const t = map.get(id);
  for (let i = 0; i < CLASSES4.length; i++) {
    t[CLASSES4[i]] = (t[CLASSES4[i]] ?? 0) + (num(row[base + i]) ?? 0);
  }
}

// A merged utility files under its new number while HIFLD still draws the old
// territories, so the successor's row has to be spread back over the shapes the
// map has. Same rule as the sales table: split by the meters HIFLD records.
function redistribute(map, label) {
  for (const m of MERGERS) {
    const src = map.get(m.successor);
    if (!src) continue;
    const parts = m.predecessors.filter(p => universe.has(p));
    const weights = parts.map(p => universe.get(p).hifld ?? 0);
    const wsum = weights.reduce((s, w) => s + w, 0);
    if (!wsum) continue;
    parts.forEach((p, i) => {
      const share = weights[i] / wsum;
      const t = Object.create(null);
      for (const [cls, v] of Object.entries(src)) t[cls] = v * share;
      map.set(p, t);
    });
    map.delete(m.successor);
    console.log(`  ${label}: merger ${m.successor} split across ${parts.length} territories`);
  }
}

const solarAcc = new Map();

// Net metering: PV capacity MW at columns 6-9. The group header sits at column 5
// because "Type" shares its merged cell, so the data starts one to the right.
const nmRows = readSheet(join(raw, SHEETS.netMetering)).slice(3);
let nmHits = 0;
const acBasis = { AC: 0, DC: 0, "": 0 };
for (const row of nmRows) {
  const id = (row[2] || "").trim();
  if (!id) continue;
  if (!universe.has(id) && !successorIds.has(id)) continue;
  acBasis[(row[5] || "").trim()] = (acBasis[(row[5] || "").trim()] ?? 0) + 1;
  addBlock(solarAcc, id, row, 6);
  nmHits++;
}
console.log(`net metering: ${nmRows.length} rows read, ${nmHits} joined`);

// Non-net-metering: PV capacity MW at columns 10-13. Column 14 is Direct
// Connected and is deliberately skipped, so addBlock's four-column read is
// exactly the four customer classes.
const nnRows = readSheet(join(raw, SHEETS.nonNetMetering)).slice(2);
let nnHits = 0;
for (const row of nnRows) {
  const id = (row[2] || "").trim();
  if (!id) continue;
  if (!universe.has(id) && !successorIds.has(id)) continue;
  acBasis[(row[9] || "").trim()] = (acBasis[(row[9] || "").trim()] ?? 0) + 1;
  addBlock(solarAcc, id, row, 10);
  nnHits++;
}
console.log(`non-net-metering distributed: ${nnRows.length} rows read, ${nnHits} joined`);
redistribute(solarAcc, "solar");
console.log(`  reporting basis: ${acBasis.AC} rows AC, ${acBasis.DC} rows DC, ${acBasis[""] ?? 0} unstated`);

// ---------------------------------------------------------------------------
// Smart meters
//
// AMI is a meter the utility can read, and talk back to, over a network. AMR
// only reads. The distinction matters because a customer cannot see yesterday's
// usage, and no time-of-use tariff can work, without the two-way kind.
//
// Columns: 12-15 AMI by class, 27-30 total meters by class. The identity
// total = AMR + AMI + standard holds in all 2,724 rows of the 2024 file, so a
// blank AMI column on a utility that reports the other two is a real zero, not
// a gap. A row with nothing in any of the three is skipped instead.
// ---------------------------------------------------------------------------

const amiAcc = new Map();
const amMetersAcc = new Map();
const amRows = readSheet(join(raw, SHEETS.advancedMeters)).slice(2);
let amHits = 0, amEmpty = 0;
for (const row of amRows) {
  const id = (row[1] || "").trim();
  if (!id) continue;
  if (!universe.has(id) && !successorIds.has(id)) continue;
  // AMR total, AMI total, standard total. None reported means the utility
  // filed the sheet without answering, which is not the same as no AMI.
  if (num(row[11]) === null && num(row[16]) === null && num(row[26]) === null) { amEmpty++; continue; }
  addBlock(amiAcc, id, row, 12);
  addBlock(amMetersAcc, id, row, 27);
  amHits++;
}
console.log(`advanced meters: ${amRows.length} rows read, ${amHits} joined, ${amEmpty} reported nothing`);
redistribute(amiAcc, "ami");
redistribute(amMetersAcc, "meters");

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const round = (v, d = 0) => (v === null || v === undefined ? undefined : Number(v.toFixed(d)));

// A territory can report rooftop solar or smart meters without filing a sales
// row, so a record has to exist before those blocks can hang off it.
let shells = 0;
for (const m of [solarAcc, amiAcc]) {
  for (const id of m.keys()) {
    if (!universe.has(id) || acc.has(id)) continue;
    const a = blank();
    a.src.add("eia861-no-sales-row");
    acc.set(id, a);
    shells++;
  }
}
if (shells) console.log(`${shells} territories report solar or meters but file no sales row`);

// The four customer classes plus a total derived from them. The files carry
// their own total column and it is not used: the net metering total is fine, but
// the non-net-metering one folds in direct-connected capacity that belongs to
// nobody's roof, and a total that means two different things by source is worse
// than no total.
// `keep` narrows which classes are written out. The total is always summed over
// all four regardless, so trimming changes what ships and never what it means.
// Meter counts keep residential and the total only: industrial and
// transportation smart-meter counts were a third of the file and nothing draws
// them.
function withTot(block, digits, keep = CLASSES4) {
  if (!block) return undefined;
  const out = {};
  let tot = 0;
  let seen = false;
  for (const cls of CLASSES4) {
    if (block[cls] === undefined) continue;
    seen = true;
    if (keep.includes(cls)) out[cls] = round(block[cls], digits);
    tot += block[cls];
  }
  if (!seen) return undefined;
  out.tot = round(tot, digits);
  return out;
}

const utilities = {};
for (const [id, a] of acc) {
  const rec = { st: [...a.states].sort(), src: [...a.src].sort().join("+") };
  for (const metric of Object.keys(COL)) {
    const block = {};
    for (const cls of CLASSES) if (a[metric][cls] !== undefined) block[cls] = round(a[metric][cls]);
    if (Object.keys(block).length) rec[metric] = block;
  }
  if (a.saidi) {
    rec.saidi = Object.fromEntries(Object.entries(a.saidi).map(([k, v]) => [k, +v.toFixed(1)]));
    if (a.saidiStates > 1) rec.saidi.n = a.saidiStates;
  }
  const solar = withTot(solarAcc.get(id), 3);
  if (solar) rec.solarmw = solar;
  const ami = withTot(amiAcc.get(id), 0, ["res"]);
  const amMeters = withTot(amMetersAcc.get(id), 0, ["res"]);
  // Both halves of a share or neither. A numerator with no denominator would
  // read as zero on the map, which is the opposite of "not reported".
  if (ami && amMeters) {
    rec.ami = ami;
    rec.ammeters = amMeters;
  }
  utilities[id] = rec;
}

// The measure registry. This is what makes the map variable-agnostic: a new
// variable is an entry here plus whatever the pipeline already collected, and
// the client renders it without knowing what it means. `derived` measures are
// computed at read time from two stored fields so nothing is stored twice.
const measures = [
  { id: "cust", label: "Meters", unit: "meters", short: "meters", format: "integer", note: "Billing accounts, not people. Commercial and industrial meters are included." },
  { id: "mwh", label: "Electricity delivered", unit: "MWh", short: "MWh", format: "integer" },
  { id: "rev", label: "Revenue", unit: "thousand dollars", short: "$K", format: "integer" },
  { id: "rate", label: "Average price", unit: "cents per kWh", short: "¢/kWh", format: "decimal1", derived: { numerator: "rev", denominator: "mwh", scale: 100 } },
  // Not a size measure. Outage minutes colour the map; they cannot drive an
  // area encoding, because a big circle would then mean a bad utility rather
  // than a large one.
  { id: "saidi", label: "Minutes without power", unit: "minutes per year", short: "min/yr", format: "integer", colourOnly: true,
    variants: { norm: "Ordinary conditions", all: "Including major storms" },
    note: "How long the average customer went without power over the year. Reported by utilities covering most of the country, but not all of them." },
  // Rooftop solar comes in two registry entries off one stored field. Capacity
  // is a magnitude, so it can size circles. Capacity per home is an intensity,
  // which is what makes Hawaii legible next to California, and intensity can
  // only colour: a circle drawn from it would say a dense small utility is big.
  { id: "solarmw", label: "Rooftop solar", unit: "megawatts of panels", short: "MW", format: "decimal1",
    note: "Small-scale solar on customer roofs, both net-metered and not. Utility-scale solar farms are not here: they are generation, not something behind a customer's meter." },
  // Fixed breaks again, for the opposite reason to smart meters. This
  // distribution is long-tailed rather than binary: quantiles land on
  // [10, 36, 80, 165] and pile 47% of the country's meters into a top step that
  // spans 165 to 1,696 watts. Oncor at 249 would be painted the same as Hawaii
  // at 1,427, which erases the only comparison worth making. These breaks put
  // 8/21/34/25/13 percent of meters in the five steps and read as round numbers.
  { id: "solarw", label: "Rooftop solar per home", unit: "watts per home", short: "W/home", format: "integer",
    colourOnly: true, cls: "res", breaks: [25, 75, 200, 600],
    derived: { numerator: "solarmw", denominator: "cust", scale: 1e6 },
    note: "Residential solar capacity spread across every household meter in the territory, not the size of a typical array. 1,000 watts per home means roughly one house in six has panels." },
  // Fixed breaks, not quantiles. Smart meter rollout is close to binary at the
  // utility level: 851 utilities report no AMI at all and 1,120 report nothing
  // else, so quantiles come out as [0, 59.13, 100, 100]. Two identical breaks
  // would draw a five-step legend over what is really a three-colour map. These
  // breaks put 10/5/8/49/28 percent of the country's meters in the five steps
  // and let the half-finished rollouts show as half finished.
  // `short` has to read correctly after a number, because it captions the value
  // on the hover card as well as labelling the legend ramp. "84% smart meters"
  // works; "84% % smart" is what a bare unit string would have produced.
  { id: "amishare", label: "Smart meters", unit: "percent of meters", short: "smart meters", format: "percent0",
    colourOnly: true, breaks: [1, 50, 90, 99.9],
    derived: { numerator: "ami", denominator: "ammeters", scale: 100 },
    note: "Share of meters that are the two-way networked kind, which the utility can read and signal remotely. The older automated meters only send readings out, so no hourly price or usage feedback can reach the customer through them." },
];

const nat = {};
for (const metric of Object.keys(COL)) {
  nat[metric] = Object.values(utilities).reduce((s, u) => s + (u[metric]?.tot ?? 0), 0);
}

const payload = {
  meta: {
    source: `EIA-861 Annual Electric Power Industry Report, ${YEAR} edition`,
    url: ZIP_URL,
    files: Object.values(SHEETS),
    retrieved: new Date().toISOString().slice(0, 10),
    key: "EIA utility number, the same identifier HIFLD carries as ID",
    rules: [
      "Parts A and C only: full-service utilities and delivery-only wires companies. Parts B and D are energy-only providers and retailers that own no wires.",
      "Short-form filings are a fallback for utilities absent from the main table, never added to it.",
      "Merged utilities are split back across the territories the map still draws, in proportion to HIFLD meter counts.",
      "Missing is null, never zero.",
      "Rooftop solar sums the net-metered and non-net-metered distributed files. Texas files no net metering at all, so either file alone is incomplete.",
      "Only photovoltaic capacity counts as rooftop solar, and only behind a customer meter. Direct-connected capacity, fuel cells and gensets are excluded.",
      "Utilities report solar capacity on either an AC or a DC basis and EIA does not normalise it. DC ratings run roughly a fifth higher for the same array.",
    ],
    national: nat,
    classes: { res: "residential", com: "commercial", ind: "industrial", tra: "transportation", tot: "total" },
  },
  measures,
  utilities,
};

const json = JSON.stringify(payload);
writeFileSync(join(outDir, "measures.json"), json);

// A territory whose only EIA filing is Part B sells energy but owns no wires,
// which is the Community Choice Aggregator signature. 02-build-layers.mjs reads
// this list on its next run and prints the survivors for review. It is a
// reviewer's aid, not a gate: the tail is ambiguous and stays on the map.
const energyOnly = [...universe.keys()].filter(id => {
  const parts = partsFiled.get(id);
  return parts && parts.size === 1 && parts.has("B");
});
writeFileSync(join(raw, "eia-energy-only-ids.json"), JSON.stringify(energyOnly));
if (energyOnly.length) {
  console.log(`energy-only territories (own no wires, candidates for exclusion): ${energyOnly.length}`);
  for (const id of energyOnly) console.log(`   ${id} ${universe.get(id).name}`);
}

// ---------------------------------------------------------------------------
// Assertions. A silent regression here is the whole reason this file exists.
// ---------------------------------------------------------------------------

const matched = [...universe.keys()].filter(id => utilities[id]).length;
const matchRate = matched / universe.size;
const hifldTotal = [...universe.values()].reduce((s, u) => s + (u.hifld ?? 0), 0);
const weighted = [...universe.entries()].reduce((s, [id, u]) => s + (utilities[id] ? u.hifld ?? 0 : 0), 0) / hifldTotal;

const byRto = {};
for (const [id, u] of universe) byRto[u.rto] = (byRto[u.rto] ?? 0) + (utilities[id]?.cust?.tot ?? 0);

// Coverage for the two new joins, weighted by meters rather than counted by
// utility. A count says 858 of 2,901 for solar and reads like a hole; the
// weighted figure says how much of the country a reader actually sees.
const covered = field => [...universe.entries()]
  .reduce((s, [id, u]) => s + (utilities[id]?.[field] ? u.hifld ?? 0 : 0), 0) / hifldTotal;
const solarMeters = covered("solarmw"), amiMeters = covered("ami");
const solarRes = Object.values(utilities).reduce((s, u) => s + (u.solarmw?.res ?? 0), 0);
const solarAll = Object.values(utilities).reduce((s, u) => s + (u.solarmw?.tot ?? 0), 0);
const amiNat = Object.values(utilities).reduce((s, u) => s + (u.ami?.tot ?? 0), 0);
const amiDen = Object.values(utilities).reduce((s, u) => s + (u.ammeters?.tot ?? 0), 0);
// The state that broke the last two joins gets its own line, permanently.
const txSolar = [...universe.keys()]
  .filter(id => utilities[id]?.st?.includes("TX"))
  .reduce((s, id) => s + (utilities[id].solarmw?.res ?? 0), 0);

console.log("\nmeasures.json");
console.log(`  utilities matched     ${matched} / ${universe.size}  (${(matchRate * 100).toFixed(1)}%)`);
console.log(`  meter-weighted        ${(weighted * 100).toFixed(2)}%`);
console.log(`  national meters       ${nat.cust.toLocaleString()}`);
console.log(`  national MWh          ${nat.mwh.toLocaleString()}`);
console.log(`  rooftop solar         ${(solarRes / 1000).toFixed(1)}GW residential, ${(solarAll / 1000).toFixed(1)}GW all classes, ` +
  `${(solarMeters * 100).toFixed(1)}% of meters covered`);
console.log(`  Texas residential     ${Math.round(txSolar).toLocaleString()}MW  (zero here means the net-metering hole reopened)`);
console.log(`  smart meters          ${(amiNat / amiDen * 100).toFixed(1)}% AMI of ${(amiDen / 1e6).toFixed(1)}M meters, ` +
  `${(amiMeters * 100).toFixed(1)}% of meters covered`);
console.log(`  size                  ${(json.length / 1024).toFixed(0)}KB raw, ${(gzipSync(json, { level: 9 }).length / 1024).toFixed(0)}KB gzipped`);
console.log("  meters by market");
for (const [rto, v] of Object.entries(byRto).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${rto.padEnd(8)} ${v.toLocaleString().padStart(13)}`);
}

const fail = [];
if (matchRate < 0.98) fail.push(`utility match rate ${(matchRate * 100).toFixed(1)}% is below 98%`);
// EIA's published national retail total is ~163M customers; the map's universe
// excludes territories it cannot draw, so it should land near but under that.
if (nat.cust < 150e6 || nat.cust > 170e6) fail.push(`national meters ${nat.cust.toLocaleString()} is outside the plausible 150M-170M band`);
for (const [rto, v] of Object.entries(byRto)) {
  if (v < 0) fail.push(`${rto} has negative meters (${v.toLocaleString()})`);
}
// the bug that started this: ERCOT must not collapse
if ((byRto.ERCOT ?? 0) < 8e6) fail.push(`ERCOT meters ${(byRto.ERCOT ?? 0).toLocaleString()} is implausibly low; the delivery-only TDU join has regressed`);
// EIA's own small-scale solar series puts residential capacity in the low tens
// of gigawatts at the end of 2024. Well outside that band means the PV columns
// moved or a non-PV technology is being counted.
if (solarRes < 20e3 || solarRes > 60e3) fail.push(`residential rooftop solar ${(solarRes / 1000).toFixed(1)}GW is outside the plausible 20-60GW band`);
// The Texas guard. If this trips, the non-net-metering file stopped joining and
// the map is about to show the second-sunniest big state as empty.
if (txSolar < 2000) fail.push(`Texas residential rooftop solar ${Math.round(txSolar)}MW is implausibly low; the non-net-metering join has regressed`);
if (solarMeters < 0.85) fail.push(`rooftop solar covers only ${(solarMeters * 100).toFixed(1)}% of meters, below 85%`);
if (amiMeters < 0.95) fail.push(`smart meters cover only ${(amiMeters * 100).toFixed(1)}% of meters, below 95%`);
const amiPct = amiNat / amiDen;
if (amiPct < 0.55 || amiPct > 0.95) fail.push(`national AMI share ${(amiPct * 100).toFixed(1)}% is outside the plausible 55-95% band`);

if (fail.length) {
  console.error("\nFAILED:");
  for (const f of fail) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nall assertions passed");
