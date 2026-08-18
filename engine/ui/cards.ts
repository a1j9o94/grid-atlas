// Every string the card shows, in one module. These render straight to
// card.innerHTML for now; the React card components replace this file's
// internals surface by surface, keeping the same inputs.
import { req } from "../../lib/assert";
import { copy, rules, statePrices, type ZipUtility } from "../../lib/data";
import { fmtMeasure, titleCase } from "../../lib/format";
import { FILL, swatchStyle, wireGroup } from "../constants";
import { ctx } from "../ctx";
import { colourValue, isColourMeasure, measureSpec, measureValue } from "../data";
import { WIRE_GROUPS } from "../wiregroups";
import { ensureWires } from "../layers/wires";

export function showRegion(rto: string, splitKey?: string): void {
  const r = req(copy.regions[rto], `region copy ${rto}`);
  const body = rto === "NONE" && splitKey !== undefined
    ? req(r.display_split?.[splitKey], `split ${splitKey}`).body
    : r.body;
  ctx().card.innerHTML =
    `<span class="c-swatch" style="${swatchStyle(rto)}"></span><h3>${r.name}</h3>` +
    `<p class="c-body">${body}</p>` +
    `<div class="c-stats"><span class="c-stat"><b>${r.stats.states}</b>states</span>` +
    `<span class="c-stat"><b>${r.stats.people}</b>people</span></div>` +
    `<div class="c-choice">${r.choice}</div>`;
}

export function showState(abbr: string): void {
  const c = ctx();
  const st = req(rules.states[abbr], `rules for ${abbr}`);
  const bucket = req(rules.buckets[st.bucket], `bucket ${st.bucket}`);
  const name = c.statesFC.features.find((f) => f.properties.STUSPS === abbr)?.properties.NAME ?? abbr;
  c.card.innerHTML =
    `<span class="c-swatch" style="background:${bucket.color}"></span><h3>${name}</h3>` +
    `<div class="c-choice">${bucket.label}</div>` +
    `<p class="c-body">${bucket.body}</p>` +
    (st.note !== undefined ? `<p class="c-body c-note">${st.note}</p>` : "");
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
  const metersStat = meters !== null
    ? `<span class="c-stat"><b>${Math.round(meters).toLocaleString()}</b>meters</span>`
    : `<span class="c-stat"><b>not reported</b>meters</span>`;
  // Service states come from EIA, because HIFLD's STATE is where the company
  // files its paperwork, not where it serves. PacifiCorp files in Oregon and
  // serves six states; Appalachian Power files in Ohio and serves none of it.
  const served = c.measures?.utilities[p.ID]?.st;
  const where = (served?.length ? served : [p.STATE]).filter(Boolean).join(", ");
  const rtoName = p.RTO === "NONE" ? "No RTO" : (copy.regions[p.RTO]?.name ?? p.RTO);
  // Whichever channel is carrying a measure, the card has to say what this
  // company's value actually is. Without it the reader can see that a territory
  // is darker, or its circle bigger, and has no way to find out by how much.
  // Meters already have their own stat, so sizing by them adds nothing.
  let measureStat = "";
  for (const key of [c.colourBy, c.sizeBy]) {
    const spec = key !== null && key !== "cust" && (isColourMeasure(key) || c.cartogram?.measures[key])
      ? measureSpec(key) : undefined;
    if (!spec) continue;
    const v = isColourMeasure(spec.id) ? colourValue(p.ID, spec.id) : measureValue(p.ID, spec.id);
    measureStat += `<span class="c-stat"><b>${v === null ? "not reported" : fmtMeasure(spec)(v)}</b>${spec.short ?? spec.label}</span>`;
  }
  c.card.innerHTML =
    `<span class="c-swatch" style="background:${WIRE_GROUPS[g].color}"></span><h3>${titleCase(p.NAME)}</h3>` +
    `<div class="c-choice">${typeInfo.label} · ${where}</div>` +
    `<p class="c-body">${typeInfo.body}</p>` +
    `<div class="c-stats">${metersStat}${measureStat}<span class="c-stat"><b>${rtoName}</b>grid</span></div>`;
}

export function showWiresIntro(): void {
  const c = ctx();
  const counts = c.wiresCounts;
  if (!counts) return;
  c.card.innerHTML =
    `<h3>Almost 3,000 wire owners</h3>` +
    `<p class="c-body">Every piece on this map is a company that owns poles and wires. Hover any piece to meet it.</p>` +
    `<div class="c-stats">` +
    `<span class="c-stat"><b>${counts.coop.toLocaleString()}</b>co-ops</span>` +
    `<span class="c-stat"><b>${counts.iou.toLocaleString()}</b>investor-owned</span>` +
    `<span class="c-stat"><b>${counts.public.toLocaleString()}</b>public power</span></div>`;
}

export function showTrivia(i: number): void {
  const c = ctx();
  const t = req(copy.trivia[i], `trivia ${String(i)}`);
  const transition = c.transitionsFC.features.find((f) => f.properties.TRIVIA === t.id)?.properties;
  const transitionStatus = transition
    ? `<div class="transition-status" aria-label="Changed from ${transition.FROM_RTO} to ${transition.RTO} on ${transition.CHANGED}">` +
      `<span><i style="background:${FILL[transition.FROM_RTO] ?? ""}"></i><b>Before</b>${transition.FROM_RTO}</span>` +
      `<span class="transition-arrow">→</span>` +
      `<span><i style="background:${FILL[transition.RTO] ?? ""}"></i><b>Now</b>${transition.RTO}</span>` +
    `</div><p class="transition-date">Changed March 12, 2026</p>` : "";
  c.card.innerHTML =
    `<div class="c-kicker">${transition ? "Grid change" : "Curiosity"}${t.verified ? "" : " · draft, still being checked"}</div>` +
    `<h3>${t.title}</h3>` +
    transitionStatus + `<p class="c-body">${t.body}</p>`;
}

export function showZipWiresCard(zip: string): void {
  ctx().card.innerHTML = `<h3>Zip ${zip}</h3>` +
    `<p class="c-body">The dashed line is your zip. Hover the pieces around it to meet the companies that own the wires near you.</p>`;
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
  let rtoName: string | null = null;
  if (rtoSet.length === 1) {
    rtoName = rtoSet[0] === "NONE"
      ? "No RTO. Utilities run this grid themselves."
      : `${req(copy.regions[req(rtoSet[0])]).name} runs the market here.`;
  } else if (rtoSet.length > 1) {
    rtoName = "This zip sits near a grid border. " + rows.filter((r) => r.rto !== null)
      .map((r) => `${r.name} trades in ${r.rto === "NONE" ? "no market" : req(copy.regions[req(r.rto)]).name}`)
      .join(". ") + ".";
  }
  // the honest bottom line: in choice states, co-ops and city utilities are
  // usually exempt, so their customers still have one seller.
  // Exception: Lubbock's city utility joined the Texas retail market in 2024.
  let choiceLine = "";
  if (bucket && rule) {
    const primary = rows[0];
    const exemptOwner = primary && (primary.group === "coop" || primary.group === "public");
    const lubbock = primary && /Lubbock/i.test(primary.name);
    if (rule.bucket === "choice" && exemptOwner && !lubbock) {
      const kind = primary.group === "coop" ? "a co-op" : "city-owned";
      choiceLine = `<div class="c-choice">Here, probably not: ${primary.name} is ${kind}, and those usually keep one seller even in choice states. Most of the state can pick.</div>`;
    } else if (lubbock) {
      choiceLine = `<div class="c-choice">${bucket.label}: Lubbock's city utility joined the Texas shopping market in 2024, the first to do it voluntarily.</div>`;
    } else {
      choiceLine = `<div class="c-choice">${bucket.label}: ${bucket.body}</div>`;
    }
  }
  c.card.innerHTML =
    `<h3>Zip ${zip} in the stack</h3>` +
    `<p class="c-body"><b>Your wires:</b> ${rows.map((r) => `${r.name} (${WIRE_GROUPS[r.group].phrase})`).join(", ")}${utils.length > 3 ? " and others" : ""}.</p>` +
    choiceLine +
    (rtoName !== null ? `<p class="c-body c-note"><b>Your market:</b> ${rtoName}</p>` : "") +
    `<p class="c-body c-fine">Zip shapes are the Census version of zip codes. Utility match comes from a 2020 federal lookup.</p>`;
}

// ---- intro cards for the control channels ----
export function showCartogramMeasureCard(key: string): void {
  const m = req(copy.cartogram.measures[key], `cartogram copy ${key}`);
  ctx().card.innerHTML =
    `<h3>${copy.cartogram.intro_title}</h3>` +
    `<p class="c-body">${copy.cartogram.intro_body}</p>` +
    `<p class="c-body c-note"><b>${m.label}.</b> ${m.blurb}</p>`;
}

export function showParentIntro(): void {
  const c = copy.controls;
  ctx().card.innerHTML = `<h3>${c.parent_intro_title}</h3><p class="c-body">${c.parent_intro_body}</p>`;
}

// Copy deck first, registry note as the fallback. A measure that nobody has
// written an introduction for still explains itself.
export function showColourMeasureIntro(key: string): void {
  const c = copy.controls;
  const spec = req(measureSpec(key), `measure spec ${key}`);
  const note = c[`${key}_note`] ?? spec.note;
  ctx().card.innerHTML = `<h3>${c[`${key}_intro_title`] ?? spec.label}</h3>` +
    `<p class="c-body">${c[`${key}_intro_body`] ?? ""}</p>` +
    (note !== undefined ? `<p class="c-body c-note">${note}</p>` : "");
}

export function showPriceIntro(key: string): void {
  const c = copy.controls;
  const m = statePrices.measures.find((x) => x.id === key);
  ctx().card.innerHTML = `<h3>${c.price_intro_title}</h3>` +
    `<p class="c-body">${c.price_intro_body}</p>` +
    (m?.note !== undefined ? `<p class="c-body c-note">${m.note}</p>` : "");
}

export function showFindYourself(): void {
  ctx().card.innerHTML =
    `<h3>Find yourself</h3><p class="c-body">${copy.layers.you.explainer}</p>`;
}
