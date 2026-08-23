// Shared HIFLD preprocessing: RTO assignment, exclusions, name-based type
// inference, and the dated corrections list.
//
// Extracted from 02-build-layers.mjs so the timeline builds replay exactly the
// same cleaning the live map was built from. Two scripts inferring "which
// utilities are real and which RTO is each one in" separately would drift, and
// the drift would show up as a market footprint that silently disagrees with
// the map it sits underneath.
//
// 02 imports this back. The guard on the extraction is that 02's four outputs
// stay byte-identical.
import { existsSync, readFileSync } from "fs";
import { join } from "path";


// CNTRL_AREA holds balancing-authority codes; the seven RTO/ISO codes map to
// regions, everything else (TVA, SOCO, BPAT, WACM, ...) is genuinely non-RTO.
// Multi-valued entries ("ERCO, SWPP") take their first code.
// PLAN_AREA is the fallback ONLY when CNTRL_AREA is missing — delivery-only
// utilities (Oncor, CenterPoint, AEP Texas, TNMP, EKPC) have no control area
// but name their market there. It must not override a real control area:
// HIFLD has at least one bad PLAN_AREA (United Electric ID says "ERCOT").
export const RTO_CODES = { MISO: "MISO", SWPP: "SPP", PJM: "PJM", ERCO: "ERCOT", ISNE: "ISONE", NYIS: "NYISO", CISO: "CAISO" };
export function assignRto(p) {
  const c = (p.CNTRL_AREA || "").split(",")[0].trim();
  if (c && c !== "NOT AVAILABLE") return RTO_CODES[c] || "NONE";
  const pl = (p.PLAN_AREA || "").toUpperCase();
  if (pl.includes("ERCOT")) return "ERCOT";
  if (pl.includes("PJM")) return "PJM";
  if (pl.includes("MIDCONTINENT") || pl.includes("MIDWEST INDEPENDENT")) return "MISO";
  if (pl.includes("SOUTHWEST POWER POOL")) return "SPP";
  if (pl.includes("NEW YORK INDEPENDENT")) return "NYISO";
  if (pl.includes("NEW ENGLAND")) return "ISONE";
  if (pl.includes("CALIFORNIA INDEPENDENT")) return "CAISO";
  return "NONE";
}

// Supply-only entities (G&T co-ops, joint-action agencies, power marketers)
// whose shapes overlay the distribution utilities that actually serve those
// areas. Their members are all present individually; drawing both creates
// phantom islands (STEC inside ERCOT, Wolverine across the Michigan mitten).
// Two rules: (1) customer sentinel + not an investor-owned wires company;
// (2) near-zero customers with a shape too big to be a town (Basin Electric
// spans 7.5 degrees with CUSTOMERS=1; also Deseret G&T, Kings River CD, and
// one Alaska village whose shape is a digitizing error).
export function bboxSpan(geometry) {
  let b = [999, 999, -999, -999];
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) for (const ring of poly) for (const [x, y] of ring) {
    if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y;
    if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
  }
  return Math.max(b[2] - b[0], b[3] - b[1]);
}
// (3) Community Choice Aggregators. A CCA buys power on behalf of customers
// whose poles belong to someone else, so its territory is always a duplicate of
// the utility that actually owns the wires. Central Coast Community Energy is
// the only one HIFLD types as such, and 100% of its area sits inside PG&E
// (1,522 of 1,522 sampled points). They are sellers on this map, not wire
// owners, and on a cartogram the shape would draw a 443,755-meter circle for a
// company that owns no meters. The rule is by type rather than by name so a
// HIFLD refresh cannot quietly reintroduce the class.
export function isOverlay(f) {
  const p = f.properties;
  if (p.CUSTOMERS === -999999 && p.TYPE !== "INVESTOR OWNED" && p.TYPE !== "FEDERAL") return true;
  if (p.CUSTOMERS >= 0 && p.CUSTOMERS <= 3 && bboxSpan(f.geometry) > 1.5) return true;
  if (p.TYPE === "COMMUNITY CHOICE AGGREGATOR") return true;
  return false;
}

// This map covers the 50 states + DC (albersUsa projection).
export const DROP_STATES = new Set(["AB", "BC", "PR", "VI", "GU", "AS", "MP"]);

// One HIFLD record is a name collision that the source resolved the wrong way.
// ID 2409 is labelled BROWNSVILLE PUBLIC UTILITIES BOARD, Texas, ERCO control
// area, 53,485 customers. Its polygon is 14.7 square kilometres centred at
// 35.596 N, 89.261 W: Brownsville, Haywood County, Tennessee, 900 miles from
// Brownsville, Texas. ID 2411, CITY OF BROWNSVILLE, Tennessee, TVA, 5,374
// customers, is 17.0 square kilometres with a centroid 200 metres away. The
// geometry belongs to the Tennessee town and the attributes to the Texas one.
//
// Found by the seam build, which asked which interconnection every shape sits
// on and got ERCOT in west Tennessee. The live wholesale map had been drawing
// that island too.
//
// Dropped rather than relabelled. Relabelling it TVA would draw Brownsville,
// Tennessee twice and credit the second copy with 53,485 customers it does not
// have, which would then flow into the wires layer and the cartogram. ID 2411
// already covers that ground with the right utility. The cost is that
// Brownsville Public Utilities Board, a real ERCOT municipal, is absent from
// the map. It was already absent in substance: no polygon in this snapshot
// covers its territory.
export const MISPLACED_IDS = new Set(["2409"]);

// Documented corrections to the HIFLD snapshot (kept current by hand):
// - City of Caldwell, TX moved from MISO to ERCOT in March 2026 (PUCT docket
//   56164; LCRA built the interconnection). HIFLD still shows MISO.
export const OVERRIDES = [{
  NAME: "CITY OF CALDWELL", STATE: "TX", RTO: "ERCOT",
  FROM_RTO: "MISO", CHANGED: "2026-03-12", TRIVIA: "caldwell-switched-grids",
}];

// SPP RTO West (go-live 2026-04-01): HIFLD predates it, so membership comes
// from rto-west.json: a balancing-authority rule (WAPA's western BAs whose
// footprints joined) plus an explicit roster for members served inside other
// BAs (Platte River's cities sit in PSCO, Deseret's co-ops in PACE, some
// Tri-State members in PNM/WALC). Built from SPP participant rosters,
// verified 2026-08-15.
// Loaded per call rather than at import time, so a consumer in another
// directory still finds rto-west.json beside the pipeline scripts.
export function loadRtoWest(dir) {
  let RTO_WEST = { ba_rule: [], members: [], spp_east: [] };
  const p = join(dir, "rto-west.json");
  if (existsSync(p)) RTO_WEST = JSON.parse(readFileSync(p, "utf8"));
  const members = new Set(RTO_WEST.members.map(m => m.NAME + "|" + m.STATE));
  // HIFLD balancing-authority miscodes: utilities actually in SPP East
  const sppEast = new Set((RTO_WEST.spp_east || []).map(m => m.NAME + "|" + m.STATE));
  const isRtoWest = p2 => {
    if (members.has(p2.NAME + "|" + p2.STATE)) return true;
    const ba = (p2.CNTRL_AREA || "").split(",")[0].trim();
    return RTO_WEST.ba_rule.includes(ba);
  };
  return { isRtoWest, sppEastFixes: sppEast };
}

// 1,684 features carry TYPE "NOT AVAILABLE", but the names encode ownership
// ("... ELECTRIC COOP", "CITY OF ...", "... PUBLIC POWER DIST"). Infer type
// from the name when the field is missing; ~150 genuinely ambiguous names
// stay unknown. Documented in the site README as methodology.
export function inferType(name) {
  const n = " " + name.toUpperCase() + " ";
  if (/\b(COOP|CO-OP|COOPERATIVE|ELECTRIC MEMBERSHIP|EMC|REMC|RECC|E M C|R E C|E C C|E C A|MEMBER|RURAL ELECTRIC|ELEC ASSN|ELECTRIC ASSN)\b/.test(n)) return "COOPERATIVE";
  if (/^\s*(CITY OF|TOWN OF|VILLAGE OF|BOROUGH OF|CITY & COUNTY)/.test(n) ||
      /\b(MUNICIPAL|CITY CORPORATION|TOWN CORPORATION|VILLAGE COUNCIL|CITY UTILITIES)\b/.test(n)) return "MUNICIPAL";
  if (/\b(PUBLIC POWER|POWER DIST|PUBLIC UTIL|UTILITY DISTRICT|IRRIGATION DIST|P U D|PUD|P P D|CONSERVATION DIST|POWER AGENCY|UTILITIES BOARD|UTILITY BOARD|UTILITY COMM|UTILITIES COMM|BOARD OF PUBLIC WORKS|PUBLIC WORKS)\b/.test(n)) return "POLITICAL SUBDIVISION";
  return null;
}

// Drop the shapes that are not real territories, assign each survivor its
// present-day RTO, fill in ownership type where HIFLD left it blank, and apply
// the dated corrections. Mutates and returns the collection it is given.
export function preprocess(fc, dir) {
  const { isRtoWest, sppEastFixes } = loadRtoWest(dir);
  let dropped = 0;
  fc.features = fc.features.filter(f => {
    const p = f.properties;
    if (DROP_STATES.has(p.STATE) || MISPLACED_IDS.has(String(p.ID)) || isOverlay(f)) { dropped++; return false; }
    return true;
  });
  let inferred = 0, sppWest = 0;
  for (const f of fc.features) {
    const p = f.properties;
    p.RTO = assignRto(p);
    if (p.RTO === "NONE" && isRtoWest(p)) { p.RTO = "SPPWEST"; sppWest++; }
    if (p.RTO === "NONE" && sppEastFixes.has(p.NAME + "|" + p.STATE)) p.RTO = "SPP";
    if (!p.TYPE || p.TYPE === "NOT AVAILABLE") {
      const t = inferType(p.NAME);
      if (t) { p.TYPE = t; inferred++; }
    }
    for (const o of OVERRIDES)
      if (p.NAME === o.NAME && p.STATE === o.STATE) p.RTO = o.RTO;
  }
  return { fc, dropped, inferred, sppWest };
}
