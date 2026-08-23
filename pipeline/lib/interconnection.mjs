// Assign each HIFLD territory to a synchronous interconnection, for the
// timeline's mid-century plates (1941, 1967, 1975), whose subject is the seam
// between the Eastern and Western grids.
//
// The balancing-authority code is the authority. The table it is read against
// is ../../grid-timeline/ba-interconnections.json, sourced from EIA's own
// EIA-930 reference tables and cross-checked for every Western assignment
// against WECC's balancing-authority layer.
//
// Two traps, both found by testing against known ground truth rather than by
// reading the output:
//
// 1. FEDERAL MARKETING AREAS ARE NOT SERVICE TERRITORIES. One feature, "WAPA --
//    Western Area Power Administration", reports 221 customers and spans 29.7
//    by 17.7 degrees, most of the western half of the country. Left in, it puts
//    WESTERN over Bismarck, North Dakota, and over every other checkpoint in
//    the plains. Bonneville is the same shape at 11 customers. The existing
//    isOverlay rule misses both, because it keys on a -999999 sentinel and
//    exempts FEDERAL. Excluded here for the seam only; the wires map still
//    draws them, where they sit harmlessly under the real territories.
//
// 2. THE SPAN TEST ONLY MEANS ANYTHING IN THE LOWER 48. Alaska's shapes cross
//    the antimeridian, so their bounding boxes come out absurd: the City of
//    Saint Paul spans 359 degrees. Alaska and Hawaii are not on any of the
//    three interconnections anyway, so the rule is scoped to the lower 48 and
//    they are labelled directly.
import { readFileSync } from "fs";
import { join } from "path";
import { bboxSpan } from "./hifld.mjs";

const OFF_GRID_STATES = { AK: "ALASKA", HI: "HAWAII" };
// The RTO the map already assigned is the fallback where HIFLD records no
// control area. It carries the planning-area fallback with it, so it resolves
// the delivery-only Texas companies that have no BA code of their own.
const RTO_TO_IC = {
  ERCOT: "ERCOT", MISO: "EASTERN", SPP: "EASTERN", PJM: "EASTERN",
  ISONE: "EASTERN", NYISO: "EASTERN", CAISO: "WESTERN", SPPWEST: "WESTERN",
};

export function loadInterconnections(dir) {
  const path = join(dir, "..", "..", "grid-timeline", "ba-interconnections.json");
  const table = JSON.parse(readFileSync(path, "utf8"));
  const byCode = {};
  for (const [ic, codes] of Object.entries(table.interconnections))
    for (const c of codes) byCode[c] = ic;
  return { table, byCode };
}

// A shape too large to be a service territory at the customer count it reports
// is a marketing area. In the lower 48 this catches exactly two features, both
// power marketing administrations, with no near miss: the largest survivor is
// Rio Grande Electric Co-op at 7.8 degrees and 14,259 customers.
export function isMarketingArea(f) {
  const p = f.properties;
  if (OFF_GRID_STATES[p.STATE]) return false;
  return bboxSpan(f.geometry) > 5 && p.CUSTOMERS >= 0 && p.CUSTOMERS < 5000;
}

export function assignInterconnection(f, byCode) {
  const p = f.properties;
  if (OFF_GRID_STATES[p.STATE]) return OFF_GRID_STATES[p.STATE];
  const ba = (p.CNTRL_AREA || "").split(",")[0].trim();
  const fromBa = byCode[ba];
  if (fromBa && fromBa !== "UNKNOWN") return fromBa;
  return RTO_TO_IC[p.RTO] ?? "UNKNOWN";
}
