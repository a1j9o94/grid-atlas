// Resolve the membership rosters' filing-era company names onto HIFLD
// features, and replay the events onto every utility.
//
// The names in the research come from FERC filings and press releases. The map
// keys on HIFLD's NAME field, which is abbreviated, inconsistently punctuated,
// and occasionally records a company under a state it does not serve. So the
// match is normalised and then checked, and anything that does not resolve to
// exactly one feature fails the build by name. A silent mismatch here redraws a
// market footprint, which is the one class of error nobody would notice.
import { readFileSync } from "fs";
import { join } from "path";

// HIFLD's own abbreviations, expanded. Longest first, so ELEC does not eat the
// front of ELECTRIC and leave a fragment.
const ABBREV = [
  ["ELECTRIC", "ELEC"], ["ILLUMINATING", "ILLUM"], ["COOPERATIVE", "COOP"],
  ["INCORPORATED", "INC"], ["CORPORATION", "CORP"], ["COMPANY", "CO"],
  ["LIGHT", "LT"], ["POWER", "PWR"], ["DISTRICT", "DIST"], ["UTILITIES", "UTIL"],
  ["SERVICE", "SVC"], ["AND", "&"],
];
// Words that carry no identity. Dropping them is what lets "Baltimore Gas and
// Electric" meet "BALTIMORE GAS & ELECTRIC CO".
const NOISE = new Set(["CO", "CORP", "INC", "THE", "LLC", "LP", "COMPANY", "OF"]);

export function normalise(name) {
  let s = " " + name.toUpperCase().replace(/[.,'()]/g, " ").replace(/[-/]/g, " ") + " ";
  for (const [long, short] of ABBREV) s = s.replaceAll(` ${long} `, ` ${short} `);
  return s.split(/\s+/).filter((w) => w && !NOISE.has(w)).join(" ");
}

// Names where normalising cannot bridge the gap, each with the reason. Every
// entry is a fact about the source data, not a preference.
export const NAME_OVERRIDES = {
  // HIFLD drops "& Light" from Delmarva and files it in Delaware.
  "Delmarva Power & Light": "DELMARVA POWER",
  // Filed as a state-suffixed name because the parent operates in several.
  "Duke Energy Ohio": "DUKE ENERGY OHIO INC",
  "Duke Energy Kentucky": "DUKE ENERGY KENTUCKY",
  // Entergy Gulf States Louisiana merged into Entergy Louisiana in 2015, so no
  // present-day shape carries the old name. Resolved to the survivor, which
  // means the 2013 event moves the merged territory; that is the honest read of
  // a map drawn with today's boundaries.
  "Entergy Gulf States Louisiana": "ENTERGY LOUISIANA LLC",
  // Columbus Southern merged into Ohio Power in 2011, same situation.
  "Columbus Southern Power": "OHIO POWER CO",
  // HIFLD files municipal systems as "CITY OF ...", so the utility's trading
  // name never matches. Lubbock is the one roster entry in that class.
  "Lubbock Power & Light": "CITY OF LUBBOCK - (TX)",
};

// Companies the rosters name that own no service territory in HIFLD, each with
// the reason it is absent rather than mismatched. These are dropped from a
// roster instead of failing it.
export const NO_TERRITORY = {
  "Ohio Valley Electric Corporation": "a generating company jointly owned by its sponsors; owns no retail territory",
  "Indiana-Kentucky Electric Corporation": "OVEC's Indiana subsidiary, same situation",
  "Basin Electric Power Cooperative": "a generation and transmission co-op; its shape is an overlay the map already drops",
  "East Kentucky Power Cooperative": "a generation and transmission co-op serving its member distribution systems",
  // A South Dakota wholesale supplier to municipal systems. Its member cities
  // own the meters, so it has no retail shape. Worth naming explicitly: three
  // unrelated companies in Kansas, Indiana and Iowa carry "Heartland" in their
  // HIFLD names, and a fuzzy match would have bound this to a Kansas co-op and
  // silently rewritten that co-op's history.
  "Heartland Consumers Power District": "a South Dakota wholesale supplier to municipal systems; its members own the meters",
};

export function buildIndex(features) {
  const byNorm = new Map();
  for (const f of features) {
    const k = normalise(f.properties.NAME);
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k).push(f);
  }
  return byNorm;
}

// One roster name to one feature, or an explained failure. Ambiguity is a
// failure too: two features sharing a normalised name means the override table
// has to say which one.
export function resolveName(name, byNorm, features) {
  if (NO_TERRITORY[name]) return { skip: NO_TERRITORY[name] };
  const target = NAME_OVERRIDES[name] ?? name;
  const k = normalise(target);
  let hits = byNorm.get(k) ?? [];
  if (hits.length === 0) {
    // Fall back to a prefix match on the normalised form, which catches the
    // cases where HIFLD appends a qualifier: "KINGSPORT POWER CO" against a
    // roster's "Kingsport Power" already matches, but "LUBBOCK POWER & LIGHT"
    // against HIFLD's "CITY OF LUBBOCK - (TX)" does not.
    hits = features.filter((f) => {
      const n = normalise(f.properties.NAME);
      return n.startsWith(k + " ") || k.startsWith(n + " ");
    });
  }
  if (hits.length === 1) return { feature: hits[0] };
  return { error: hits.length === 0 ? "no HIFLD feature matches" :
    `${String(hits.length)} features match: ${hits.map((h) => `${h.properties.NAME}|${h.properties.STATE}`).join(", ")}` };
}

export function loadEvents(dir) {
  const p = join(dir, "..", "..", "grid-timeline", "membership-events.json");
  const f = JSON.parse(readFileSync(p, "utf8"));
  // Date order, and a stable tiebreak so two events on one day always replay
  // the same way. Foundings settle before joins on the same date, because a
  // join into a market founded that day has to land in something.
  const rank = { founding: 0, designation: 1, "market-start": 1, join: 2, move: 3, leave: 4 };
  f.events.sort((a, b) => a.date.localeCompare(b.date) || (rank[a.kind] - rank[b.kind]));
  return f;
}
