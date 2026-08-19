// Every card the atlas can show, computed as plain data and handed to the
// store; the React card components render it. The engine pre-computes
// anything registry-dependent so the components stay presentational.
import { req } from "../../lib/assert";
import {
  copy, parseHoldingsTrace, rules, statePrices,
  type TimelineFrame, type ZipUtility,
} from "../../lib/data";
import { fmtMeasure, titleCase } from "../../lib/format";
import {
  setAtlasState, type CardModel, type EvidenceChip, type FrameEventRow, type StatModel,
} from "../../lib/store";
import { swatchBackground, wireGroup } from "../constants";
import { ctx } from "../ctx";
import { holdingsChange, holdingsYears } from "../layers/history";
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

// ---- history layer: the plate, its events, its evidence, and its cities ----

function draftFlag(o: { verified?: boolean }): string {
  return o.verified === false ? " · draft, still being checked" : "";
}

// ⌖ for something we looked at, § for something somebody wrote down.
function evidenceChips(ids: readonly string[] | undefined): EvidenceChip[] {
  const t = ctx().timeline;
  if (!t || !ids) return [];
  const chips: EvidenceChip[] = [];
  for (const id of ids) {
    const e = t.evidence[id];
    if (!e) continue;
    const law = e.kind === "law";
    const label = law
      ? (e.excerpt !== undefined ? t.law_excerpts[e.excerpt]?.label ?? "The law" : "The law")
      : e.title ?? id;
    chips.push({
      id,
      glyph: law ? "§" : "⌖",
      label,
      ...(e.files?.thumb !== undefined ? { thumb: e.files.thumb } : {}),
    });
  }
  return chips;
}

// Once both sheets are traced the plate card carries what changed between
// them, because that is the argument the second plate exists to make and it
// should not be something the reader has to derive by flipping.
function holdingsChangeLine(f: TimelineFrame): string | null {
  if (f.geometry.kind !== "holdings") return null;
  const ch = holdingsChange();
  if (ch === null) return null;
  const moved = ch.gained + ch.lost + ch.changed;
  if (moved === 0) return null;
  const parts: string[] = [];
  if (ch.gained) parts.push(`${String(ch.gained)} gained a system`);
  if (ch.changed) parts.push(`${String(ch.changed)} changed hands`);
  if (ch.lost) parts.push(`${String(ch.lost)} went blank`);
  return `Between the two sheets, ${parts.join(", ")}. `
    + `${String(ch.same)} counties read the same in both years, and ${String(ch.uncertain)} `
    + `are too uncertain in one year or the other to compare.`;
}

export function showFrame(f: TimelineFrame): void {
  const t = ctx().timeline;
  const kicker = `${f.label}${f.kicker !== undefined ? ` · ${f.kicker}` : ""}${draftFlag(f)}`;
  const changeLine = holdingsChangeLine(f);
  const events: FrameEventRow[] = [];
  for (const id of f.events ?? []) {
    const e = t?.events[id];
    if (e) events.push({ id, year: e.date.slice(0, 4), title: e.title });
  }
  setAtlasState({
    card: {
      kind: "frame",
      kicker,
      title: f.title,
      body: f.body,
      ...(f.note !== undefined ? { note: f.note } : {}),
      events,
      evidence: evidenceChips(f.evidence),
      pending: !f.ship,
      ...(changeLine !== null ? { changeLine } : {}),
    },
  });
}

export function showFrameEvent(id: string): void {
  const c = ctx();
  const t = c.timeline;
  const e = t?.events[id];
  if (!t || !e) return;
  const excerpt = e.excerpt !== undefined ? t.law_excerpts[e.excerpt] : undefined;
  const back = t.frames.find((f) => f.id === c.frameId)?.label ?? "the plate";
  setAtlasState({
    card: {
      kind: "event",
      // `when` carries a date the records do not pin to a day. Ames is the
      // case: June 1891 is solid, the 19th is the day usually given, and one
      // local account says the 21st. Printing a false precision would be the
      // easy way out, so the card says what is actually known.
      kicker: `${e.when ?? e.date}${draftFlag(e)}`,
      title: e.title,
      body: e.body,
      ...(e.note !== undefined ? { note: e.note } : {}),
      ...(excerpt !== undefined && e.excerpt !== undefined
        ? { excerpt: { id: `law:${e.excerpt}`, glyph: "§", label: excerpt.label } }
        : {}),
      evidence: evidenceChips(e.evidence),
      backLabel: `← back to ${back}`,
    },
  });
}

export function showDot(i: number): void {
  const t = ctx().timeline;
  const d = t?.dots[i];
  if (!t || !d) return;
  const story = d.story !== undefined ? t.events[d.story] : undefined;
  const stats: StatModel[] = [{ value: d.pop1900.toLocaleString(), label: "people in 1900" }];
  if (d.rank !== undefined) stats.push({ value: `#${String(d.rank)}`, label: "largest in 1900" });
  setAtlasState({
    card: {
      kind: "dot",
      kicker: `1900${story ? " · a first worth knowing" : ""}`,
      name: `${d.city}, ${d.state}`,
      body: story?.body ?? "A city with its own power station, lighting the blocks around it and no further.",
      ...(d.note !== undefined ? { note: d.note } : {}),
      stats,
      backLabel: "← back to the plate",
    },
  });
}

// A county on FTC Map III. The card keeps the plate's uncertainty grammar in
// ordinary language: a possible or ambiguous hatch never becomes a confident
// ownership claim just because the reader hovered it.
// One county's reading, per source plate. Where both sheets are traced the card
// shows them together, because the change between 1925 and 1932 is the thing
// this plate exists to show and a reader should not have to flip and remember.
function readingFor(year: string, fips: string): { year: string; plate: string; statusLine: string } | null {
  const h = ctx().holdings;
  const raw = h?.trace.years[year]?.[fips];
  if (!h || raw === undefined) return null;
  const parsed = parseHoldingsTrace(raw);
  const legend = h.trace.legends[year] ?? {};
  const labels = parsed.groups.map((g) => legend[g]?.printed_label ?? g);
  // The numeral names the subsidiary inside the group. Only Map IV carries one.
  const sub = parsed.numeral !== undefined ? ` · subsidiary ${parsed.numeral}` : "";
  let statusLine: string;
  if (parsed.status === "exact") statusLine = (labels[0] ?? "Named holding-company system") + sub;
  else if (parsed.status === "maybe") statusLine = `Possible: ${labels[0] ?? "named system"}${sub}`;
  else if (parsed.status === "amb") statusLine = `Ambiguous: ${labels.join(" or ")}${sub}`;
  else if (parsed.status === "unknown") statusLine = "A principal power group operated here";
  else statusLine = "No county-level group fill";
  const plates = (h.trace.meta.plate_names ?? {}) as Record<string, string>;
  return { year, plate: plates[year] ?? (year === "1925" ? "Map III" : "Map IV"), statusLine };
}

export function showHoldingCounty(fips: string): void {
  const c = ctx();
  const h = c.holdings;
  const county = h?.countiesFC.features.find((f) => f.properties.GEOID === fips);
  if (!h || !county) return;
  const years = holdingsYears();
  const readings = years.map((y) => readingFor(y, fips)).filter((r) => r !== null);
  if (readings.length === 0) return;
  const shown = c.holdingsYear ?? years[0] ?? "1925";
  const current = readings.find((r) => r.year === shown) ?? readings[0];
  if (current === undefined) return;

  // With one sheet the body explains the reading. With two it explains what
  // changed, or says plainly that nothing did, which is itself a finding.
  let body: string;
  if (readings.length < 2) {
    body = "The traced hatch on the FTC's own plate places this county for that year. Uncertain reads stay uncertain rather than resolving to an owner.";
  } else {
    const first = readings[0]?.statusLine;
    const same = readings.every((r) => r.statusLine === first);
    body = same
      ? "Both plates read the same here, so this county did not change hands between the two printings."
      : "The two plates read differently here. Seven years apart, that is the empire growing, shrinking, or changing hands.";
  }
  setAtlasState({
    card: {
      kind: "holdingCounty",
      kicker: `FTC ${current.plate} · ${current.year}`,
      name: `${county.properties.NAME} · ${county.properties.STUSPS}`,
      statusLine: current.statusLine,
      ...(readings.length > 1 ? { readings } : {}),
      body,
      note: "Modern county geometry is used to read a historical plate; changed boundaries and separate towns remain limits of the trace.",
      backLabel: "← back to the plate",
    },
  });
}

// A machine on a seam plate: hovering the Eastern grid should say what the
// Eastern grid is. Same card shape as a city dot, because the reader is doing
// the same thing, pointing at a thing on the map and asking what it is.
export function showMachine(ic: string): void {
  const c = ctx();
  const t = c.timeline;
  const m = t?.seam_machines?.[ic];
  if (!m) return;
  // On the 1967 plate East and West were running in step, so there are two
  // machines that year, not three. Counting them from the frame keeps the card
  // from contradicting the legend beside it.
  const unified = t.frames.find((f) => f.id === c.frameId)?.geometry.unified === true;
  setAtlasState({
    card: {
      kind: "machine",
      kicker: unified ? "one of two, this year" : "one of three",
      name: m.name,
      body: m.body,
      ...(m.note !== undefined ? { note: m.note } : {}),
      stats: [],
      backLabel: "← back to the plate",
    },
  });
}

// A market on a membership plate. The name and the one-line description come
// from the copy deck the wholesale layer already uses, so the same region reads
// the same way whether the reader met it on Today or on 1999. What this card
// adds is the date, because on a past plate the question is when it started.
export function showMarket(market: string): void {
  const c = ctx();
  const t = c.timeline;
  const region = copy.regions[market];
  if (!t || !region) return;
  const started = t.events[FOUNDING_EVENT[market] ?? ""];
  setAtlasState({
    card: {
      kind: "machine",
      kicker: started ? `running since ${started.when ?? started.date}` : "a market operator",
      name: region.name,
      body: region.body,
      stats: [],
      backLabel: "← back to the plate",
    },
  });
}
// The event on this timeline that starts each market. Named rather than derived
// so a market with no founding card on the plate says nothing instead of
// guessing a date.
const FOUNDING_EVENT: Record<string, string> = {
  PJM: "pjm-iso-1997", ERCOT: "ercot-iso-1996", MISO: "miso-market-2005",
  CAISO: "caiso-1998", NYISO: "nyiso-1999", ISONE: "iso-ne-1997",
};

// ---- the evidence lightbox ----

function citeText(o: { citation?: string; rights?: string }): string {
  // The rights note is dropped when the citation already says the same thing,
  // which is most of them: these are all federal publications.
  const cite = o.citation ?? "";
  const rights = o.rights !== undefined && !cite.toLowerCase().includes("public domain")
    ? ` ${o.rights}` : "";
  return `${cite}${rights}`;
}

export function openExcerpt(key: string): void {
  const x = ctx().timeline?.law_excerpts[key];
  if (!x) return;
  setAtlasState({
    evidence: {
      title: x.label,
      quote: `“${x.quote}”`,
      ...(x.gloss !== undefined ? { gloss: x.gloss } : {}),
      cite: citeText({ citation: x.citation }),
      ...(x.source_url !== undefined ? { sourceUrl: x.source_url } : {}),
      missingPlate: false,
      unverified: x.verified === false,
    },
  });
}

export function openEvidence(id: string): void {
  // an event's law chip carries its excerpt key behind a prefix
  if (id.startsWith("law:")) {
    openExcerpt(id.slice(4));
    return;
  }
  const e = ctx().timeline?.evidence[id];
  if (!e) return;
  if (e.kind === "law") {
    if (e.excerpt !== undefined) openExcerpt(e.excerpt);
    return;
  }
  const full = e.files?.full;
  setAtlasState({
    evidence: {
      title: e.title ?? id,
      ...(e.quote !== undefined ? { quote: `“${e.quote}”` } : {}),
      ...(e.note !== undefined ? { gloss: e.note } : {}),
      // The full scan is fetched by the component when it renders, not with
      // the plate, so scrubbing never pays for an image nobody opened.
      ...(full !== undefined ? { image: full, alt: e.title ?? "" } : {}),
      cite: citeText(e),
      ...(e.source_url !== undefined ? { sourceUrl: e.source_url } : {}),
      // A chip labelled "first printed page" or "Map III" promises a picture,
      // so it owes the reader a sentence when the picture is not committed yet.
      // Gating this on kind === "map" let the statute pages go silent about it.
      // A written source, which never promised an image, is complete on its
      // citation alone, and so is one that quotes itself.
      missingPlate: full === undefined && e.kind !== "note" && e.quote === undefined,
      unverified: false,
    },
  });
}

export function closeEvidence(): void {
  setAtlasState({ evidence: null });
}
