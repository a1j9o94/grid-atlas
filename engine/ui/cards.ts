// Every card the atlas can show, computed as plain data and handed to the
// store; the React card components render it. The engine pre-computes
// anything registry-dependent so the components stay presentational.
import { req } from "../../lib/assert";
import { copy, rules, statePrices, type ZipUtility } from "../../lib/data";
import { fmtMeasure, titleCase } from "../../lib/format";
import { setAtlasState, type CardModel, type StatModel } from "../../lib/store";
import { swatchBackground, wireGroup } from "../constants";
import { ctx } from "../ctx";
import { colourValue, isColourMeasure, measureSpec, measureValue } from "../data";
import { WIRE_GROUPS } from "../wiregroups";
import { ensureWires } from "../layers/wires";

function show(card: CardModel): void {
  setAtlasState({ card });
}

export function showRegion(rto: string, splitKey?: string): void {
  const r = req(copy.regions[rto], `region copy ${rto}`);
  const body = rto === "NONE" && splitKey !== undefined
    ? req(r.display_split?.[splitKey], `split ${splitKey}`).body
    : r.body;
  show({
    kind: "region",
    swatch: swatchBackground(rto),
    name: r.name,
    body,
    stats: [
      { value: r.stats.states, label: "states" },
      { value: r.stats.people, label: "people" },
    ],
    choice: r.choice,
  });
}

export function showState(abbr: string): void {
  const c = ctx();
  const st = req(rules.states[abbr], `rules for ${abbr}`);
  const bucket = req(rules.buckets[st.bucket], `bucket ${st.bucket}`);
  const name = c.statesFC.features.find((f) => f.properties.STUSPS === abbr)?.properties.NAME ?? abbr;
  show({
    kind: "state",
    swatch: bucket.color,
    name,
    bucketLabel: bucket.label,
    body: bucket.body,
    ...(st.note !== undefined ? { note: st.note } : {}),
  });
}

export function showWire(i: number): void {
  const c = ctx();
  const p = req(c.wiresFeatures?.[i], `wire feature ${String(i)}`).properties;
  const g = wireGroup(p.TYPE);
  const typeInfo = copy.wires_types[p.TYPE] ?? req(copy.wires_types["NOT AVAILABLE"]);
  // Meters, not people. These are billing accounts, and commercial and
  // industrial ones are in the count. HIFLD's own field is only the fallback:
  // it is blank for every delivery-only utility in Texas, which is why the
  // five biggest wires companies in ERCOT used to show nothing here.
  const meters = measureValue(p.ID, "cust") ?? (p.CUSTOMERS > 0 ? p.CUSTOMERS : null);
  const stats: StatModel[] = [
    { value: meters !== null ? Math.round(meters).toLocaleString() : "not reported", label: "meters" },
  ];
  // Whichever channel is carrying a measure, the card has to say what this
  // company's value actually is. Without it the reader can see that a
  // territory is darker, or its circle bigger, and has no way to find out by
  // how much. Meters already have their own stat, so sizing by them adds nothing.
  for (const key of [c.colourBy, c.sizeBy]) {
    const spec = key !== null && key !== "cust" && (isColourMeasure(key) || c.cartogram?.measures[key])
      ? measureSpec(key) : undefined;
    if (!spec) continue;
    const v = isColourMeasure(spec.id) ? colourValue(p.ID, spec.id) : measureValue(p.ID, spec.id);
    stats.push({ value: v === null ? "not reported" : fmtMeasure(spec)(v), label: spec.short ?? spec.label });
  }
  // Service states come from EIA, because HIFLD's STATE is where the company
  // files its paperwork, not where it serves. PacifiCorp files in Oregon and
  // serves six states; Appalachian Power files in Ohio and serves none of it.
  const served = c.measures?.utilities[p.ID]?.st;
  const where = (served?.length ? served : [p.STATE]).filter(Boolean).join(", ");
  stats.push({ value: p.RTO === "NONE" ? "No RTO" : (copy.regions[p.RTO]?.name ?? p.RTO), label: "grid" });
  show({
    kind: "wire",
    swatch: WIRE_GROUPS[g].color,
    name: titleCase(p.NAME),
    typeLine: `${typeInfo.label} · ${where}`,
    body: typeInfo.body,
    stats,
  });
}

export function showWiresIntro(): void {
  const counts = ctx().wiresCounts;
  if (!counts) return;
  show({
    kind: "wiresIntro",
    stats: [
      { value: counts.coop.toLocaleString(), label: "co-ops" },
      { value: counts.iou.toLocaleString(), label: "investor-owned" },
      { value: counts.public.toLocaleString(), label: "public power" },
    ],
  });
}

export function showTrivia(i: number): void {
  const c = ctx();
  const t = req(copy.trivia[i], `trivia ${String(i)}`);
  const transition = c.transitionsFC.features.find((f) => f.properties.TRIVIA === t.id)?.properties;
  show({
    kind: "trivia",
    kicker: `${transition ? "Grid change" : "Curiosity"}${t.verified ? "" : " · draft, still being checked"}`,
    title: t.title,
    body: t.body,
    ...(transition
      ? {
          transition: {
            fromRto: transition.FROM_RTO,
            fromSwatch: swatchBackground(transition.FROM_RTO),
            toRto: transition.RTO,
            toSwatch: swatchBackground(transition.RTO),
            ariaLabel: `Changed from ${transition.FROM_RTO} to ${transition.RTO} on ${transition.CHANGED}`,
            date: "Changed March 12, 2026",
          },
        }
      : {}),
  });
}

export function showZipWiresCard(zip: string): void {
  show({ kind: "zipWires", zip });
}

export async function showYouCard(zip: string, utilsIn: ZipUtility[]): Promise<void> {
  const c = ctx();
  // join crosswalk utilities to the wires layer for grid + ownership
  await ensureWires();
  if (c.dead) return;
  const seen = new Set<string>();
  const utils = utilsIn.filter((u) => {
    const k = String(u.id);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const rows = utils.slice(0, 3).map((u) => {
    const match = c.wiresFeatures?.find((f) => f.properties.ID === String(u.id));
    const g = match ? wireGroup(match.properties.TYPE)
      : (u.own === "Investor Owned" ? "iou" : u.own === "Cooperative" ? "coop" : u.own ? "public" : "other");
    const rto = match ? match.properties.RTO : null;
    return { name: titleCase(u.name), group: g, rto, st: u.st };
  });
  const st = rows[0]?.st;
  const rule = st !== undefined ? rules.states[st] : undefined;
  const bucket = rule ? rules.buckets[rule.bucket] : undefined;
  // a zip can straddle a grid border (Caldwell, Lubbock): name each market
  const rtoSet = [...new Set(rows.filter((r) => r.rto !== null).map((r) => r.rto))];
  let market: string | undefined;
  if (rtoSet.length === 1) {
    market = rtoSet[0] === "NONE"
      ? "No RTO. Utilities run this grid themselves."
      : `${req(copy.regions[req(rtoSet[0])]).name} runs the market here.`;
  } else if (rtoSet.length > 1) {
    market = "This zip sits near a grid border. " + rows.filter((r) => r.rto !== null)
      .map((r) => `${r.name} trades in ${r.rto === "NONE" ? "no market" : req(copy.regions[req(r.rto)]).name}`)
      .join(". ") + ".";
  }
  // the honest bottom line: in choice states, co-ops and city utilities are
  // usually exempt, so their customers still have one seller.
  // Exception: Lubbock's city utility joined the Texas retail market in 2024.
  let choice: string | undefined;
  if (bucket && rule) {
    const primary = rows[0];
    const exemptOwner = primary && (primary.group === "coop" || primary.group === "public");
    const lubbock = primary && /Lubbock/i.test(primary.name);
    if (rule.bucket === "choice" && exemptOwner && !lubbock) {
      const kind = primary.group === "coop" ? "a co-op" : "city-owned";
      choice = `Here, probably not: ${primary.name} is ${kind}, and those usually keep one seller even in choice states. Most of the state can pick.`;
    } else if (lubbock) {
      choice = `${bucket.label}: Lubbock's city utility joined the Texas shopping market in 2024, the first to do it voluntarily.`;
    } else {
      choice = `${bucket.label}: ${bucket.body}`;
    }
  }
  show({
    kind: "you",
    zip,
    wires: `${rows.map((r) => `${r.name} (${WIRE_GROUPS[r.group].phrase})`).join(", ")}${utils.length > 3 ? " and others" : ""}.`,
    ...(choice !== undefined ? { choice } : {}),
    ...(market !== undefined ? { market } : {}),
  });
}

// ---- intro cards for the control channels ----
export function showCartogramMeasureCard(key: string): void {
  const m = req(copy.cartogram.measures[key], `cartogram copy ${key}`);
  show({
    kind: "intro",
    title: copy.cartogram.intro_title,
    body: copy.cartogram.intro_body,
    note: { lead: `${m.label}.`, text: m.blurb },
  });
}

export function showParentIntro(): void {
  show({ kind: "intro", title: copy.controls.parent_intro_title, body: copy.controls.parent_intro_body });
}

// Copy deck first, registry note as the fallback. A measure that nobody has
// written an introduction for still explains itself.
export function showColourMeasureIntro(key: string): void {
  const spec = req(measureSpec(key), `measure spec ${key}`);
  const note = copy.controls[`${key}_note`] ?? spec.note;
  show({
    kind: "intro",
    title: copy.controls[`${key}_intro_title`] ?? spec.label,
    body: copy.controls[`${key}_intro_body`] ?? "",
    ...(note !== undefined ? { note: { text: note } } : {}),
  });
}

export function showPriceIntro(key: string): void {
  const m = statePrices.measures.find((x) => x.id === key);
  show({
    kind: "intro",
    title: copy.controls.price_intro_title,
    body: copy.controls.price_intro_body,
    ...(m?.note !== undefined ? { note: { text: m.note } } : {}),
  });
}

export function showFindYourself(): void {
  show({ kind: "intro", title: "Find yourself", body: copy.layers.you.explainer });
}
