// Types for every data file the atlas reads, plus the three decks small
// enough to ship in the bundle. The big files (geometry, measures, cartogram,
// zip shards) stay lazily fetched; helpers for those live at the bottom.
import type { Feature, FeatureCollection, Geometry } from "geojson";

export type LayerKey = "wholesale" | "rules" | "wires" | "you" | "history";

export interface LayerCopy {
  title: string;
  gloss: string;
  explainer: string;
}
export interface TourStep {
  layer: LayerKey;
  title: string;
  body: string;
}
export interface RegionSplit {
  label: string;
  anchor: [number, number];
  body: string;
}
export interface RegionCopy {
  name: string;
  body: string;
  stats: { states: string; people: string };
  choice: string;
  display_split?: Record<string, RegionSplit>;
}
export interface TriviaEntry {
  id: string;
  layer: string;
  anchor: { lonlat: [number, number]; feature?: { name: string; state: string } };
  title: string;
  body: string;
  verified?: boolean;
}
export interface CartogramCopy {
  toggle_land: string;
  toggle_size: string;
  toggle_label: string;
  intro_title: string;
  intro_body: string;
  legend_note: string;
  missing_note: string;
  measures: Record<string, { label: string; blurb: string }>;
}
// Known keys are named; the deck also carries per-measure keys built at
// runtime (`colour_${id}`, `${id}_intro_title`, ...) reached by index.
export interface ControlsCopy {
  shade_label: string;
  colour_label: string;
  colour_type: string;
  colour_parent: string;
  not_reported: string;
  parent_intro_title: string;
  parent_intro_body: string;
  price_intro_title: string;
  price_intro_body: string;
  [key: string]: string | undefined;
}
export interface CopyDeck {
  layers: Record<LayerKey, LayerCopy>;
  tour: TourStep[];
  regions: Record<string, RegionCopy>;
  wires_types: Record<string, { label: string; body: string }>;
  trivia: TriviaEntry[];
  cartogram: CartogramCopy;
  controls: ControlsCopy;
  wires_groups: Record<string, { label: string; phrase: string }>;
}

export interface RulesBucket {
  label: string;
  color: string;
  body: string;
}
export interface RulesFile {
  buckets: Record<string, RulesBucket>;
  states: Record<string, { bucket: string; note?: string }>;
}

export interface StatePriceMeasure {
  id: string;
  label: string;
  kind: "categorical" | "sequential";
  unit?: string;
  short?: string;
  note?: string;
}
export interface StatePricesFile {
  measures: StatePriceMeasure[];
  states: Record<string, Record<string, number | string>>;
}

export type MeasureFormat = "integer" | "decimal1" | "percent0";
export interface MeasureSpec {
  id: string;
  label: string;
  unit?: string;
  short?: string;
  format?: MeasureFormat;
  note?: string;
  colourOnly?: boolean;
  cls?: string;
  breaks?: number[];
  variants?: Record<string, string>;
  // `minus` subtracts one stored ratio's parts from another's before dividing,
  // which is how a price is taken over part of a utility's book rather than all
  // of it. Average price is total revenue less the delivery-only revenue, over
  // total volume less the delivery-only volume: the bundled half, without
  // storing it a second time. A utility that only ever billed delivery cancels
  // to zero over zero and reads as not reported, which is the correct answer.
  derived?: {
    numerator: string;
    denominator: string;
    scale?: number;
    minus?: { numerator: string; denominator: string };
  };
}
// A utility row is a handful of scalar fields plus one block of numbers per
// stored measure, keyed by customer class (or by storm basis, for saidi).
export type MeasureBlock = Record<string, number>;
export interface Utility {
  st?: string[];
  src?: string;
  [key: string]: MeasureBlock | string[] | string | undefined;
}
export interface MeasuresFile {
  measures: MeasureSpec[];
  utilities: Record<string, Utility>;
}

export interface CartogramMeasure {
  max: number;
  maxRadius: number;
  scale: number;
  floored: number;
  circles: Record<string, [number, number, number]>;
}
export interface CartogramFile {
  centroids: Record<string, [number, number]>;
  measures: Record<string, CartogramMeasure>;
  meta?: {
    projection?: {
      type: string;
      fitExtent: [[number, number], [number, number]];
      viewBox: number[];
    };
  };
}

export interface StateProps {
  STUSPS: string;
  NAME: string;
}
export interface RtoProps {
  RTO: string;
}
// The seam file's own two shapes: a region carries which machine it is, a line
// carries which pair of machines it divides.
export type Interconnection = "EASTERN" | "WESTERN" | "ERCOT";
export interface SeamProps {
  IC: Interconnection;
}
export interface SeamLineProps {
  seam: "ew" | "ercot";
}
// A market footprint at one frame. `m` is the market key, the same key the
// wholesale layer colours by, so a 2005 PJM is the same blue as today's.
export interface MembershipProps {
  m: string;
}
export interface TransitionProps {
  ID: string;
  NAME: string;
  STATE: string;
  RTO: string;
  FROM_RTO: string;
  CHANGED: string;
  TRIVIA: string;
}
export interface WireProps {
  ID: string;
  NAME: string;
  STATE: string;
  TYPE: string;
  CUSTOMERS: number;
  REGULATED: string;
  HOLDING_CO: string;
  RTO: string;
}
export interface ZctaProps {
  GEOID20: string;
  pfx: string;
}
export type StateFeature = Feature<Geometry, StateProps>;
export type RtoFeature = Feature<Geometry, RtoProps>;
export type TransitionFeature = Feature<Geometry, TransitionProps>;
export type WireFeature = Feature<Geometry, WireProps>;
export type ZctaFeature = Feature<Geometry, ZctaProps>;
export type StatesFC = FeatureCollection<Geometry, StateProps>;
export type RtosFC = FeatureCollection<Geometry, RtoProps>;
export type TransitionsFC = FeatureCollection<Geometry, TransitionProps>;
export type ZctaFC = FeatureCollection<Geometry, ZctaProps>;

// County geometry and the hand-read FTC Map III trace. The geometry is kept
// separate from the trace so a later plate can reuse the same 3,108 paths
// without downloading another copy of the county mesh.
export interface HoldingsCountyProps {
  GEOID: string;
  NAME: string;
  STUSPS: string;
}
export type HoldingsCountyFC = FeatureCollection<Geometry, HoldingsCountyProps>;
export type HoldingsTraceStatus = "exact" | "maybe" | "amb" | "unknown" | "none";
export interface HoldingsTrace {
  raw: string;
  status: HoldingsTraceStatus;
  groups: string[];
  // Map IV overprints a circled numeral on the hatch, naming the subsidiary
  // inside the group. Map III has no such mark, so this is absent for 1925.
  numeral?: string;
}
export interface HoldingsLegendEntry {
  printed_label: string;
  note?: string;
  // Map IV prints a numbered list under some legend cells, naming the subsidiaries
  // inside that group, and overprints the matching circled numeral on the county.
  // Keyed by the numeral as it appears in a trace value's `key#n` suffix. The three
  // lists overlap, so a numeral only means anything once its texture is known, which
  // is why this hangs off the legend entry rather than sitting in one flat table.
  subsidiaries?: Record<string, string>;
}
export interface HoldingsFile {
  schema_version: number;
  status: string;
  meta: Record<string, unknown>;
  legends: Record<string, Record<string, HoldingsLegendEntry>>;
  years: Record<string, Record<string, string>>;
  rollups: Record<string, unknown>;
  // Raw plate key to the canonical system the two sheets can be compared on,
  // per year. The plates name systems at different grain: Map IV separates
  // Middle West Utilities from Insull's other holdings where Map III prints one
  // Insull cell. The raw key keeps what the plate says; this is how the years
  // are made to mean the same thing without flattening either.
  key_rollup?: Record<string, Record<string, string>>;
}

// The release grammar preserves uncertainty instead of turning a hard-to-read
// hatch into a confident owner. Exact values are bare legend keys; the four
// reserved forms are intentionally parsed here, at the JSON/type boundary.
export function parseHoldingsTrace(raw: string): HoldingsTrace {
  // A numeral rides on a key as `key#3`, naming the operating company inside that
  // group. It belongs to the candidate it is attached to, not to the record: an
  // ambiguous pair carries one per side, and they differ, because which subsidiary
  // it is depends on which mark it is. Splitting the record first and stripping each
  // candidate's own numeral is what keeps `groups` bare legend keys.
  //
  // It used to take the LAST numeral off the whole string, which left the first
  // candidate of every numbered pair reading `ebasco#3`. That matched no colour and
  // no legend label, so 87 counties drew grey and their cards showed a raw key where
  // the company name belongs.
  const cut = (s: string): { key: string; num?: string } => {
    const h = s.lastIndexOf("#");
    if (h <= 0) return { key: s };
    const num = s.slice(h + 1);
    return num === "" ? { key: s.slice(0, h) } : { key: s.slice(0, h), num };
  };

  const head = raw.startsWith("amb:") ? "amb:" : raw.startsWith("maybe:") ? "maybe:" : "";
  const parts = (head === "" ? [raw] : raw.slice(head.length).split("|"))
    .filter(Boolean).map(cut);
  const nums = [...new Set(parts.map((p) => p.num).filter((n) => n !== undefined))];
  // One numeral only when every candidate agrees on it. Two candidates naming
  // different subsidiaries cannot be summarised as one, and printing either would
  // assert the half the reader did not choose.
  const numeral = nums.length === 1 ? nums[0] : undefined;
  const groups = parts.map((p) => p.key);
  const body = groups[0] ?? "";
  const out = (t: Omit<HoldingsTrace, "raw" | "numeral">): HoldingsTrace =>
    ({ raw, ...t, ...(numeral !== undefined ? { numeral } : {}) });

  if (head === "amb:") return out({ status: "amb", groups });
  if (head === "maybe:") return out({ status: "maybe", groups });
  if (body === "none") return out({ status: "none", groups: [] });
  if (body === "unknown-served") return out({ status: "unknown", groups: [] });
  return out({ status: "exact", groups });
}

export interface ZipUtility {
  id: number | string;
  name: string;
  st: string;
  svc?: string;
  own?: string;
  res_rate?: number;
}
export type ZipLookup = Record<string, ZipUtility[]>;

// ---- the history layer's timeline ----
// Dated plates rather than a continuous scrub: the archives support moments and
// membership changes, not annual geometry. Lazy-fetched like measures, because
// four readers in five never open this layer.
export interface TimelineDot {
  city: string;
  state: string;
  lonlat: [number, number];
  pop1900: number;
  rank?: number;
  // a small place that earns its dot for what happened there
  story?: string;
  note?: string;
}
export interface TimelineEvent {
  date: string;
  // a date the records place only in a month or a year, shown instead of `date`
  when?: string;
  title: string;
  body: string;
  note?: string;
  excerpt?: string;
  // Assets that back this particular claim, as against the plate around it.
  // The concentration card is the case: its percentages are read off one
  // committed table, and the reader should be one click from that table rather
  // than hunting the plate's whole evidence list for it.
  evidence?: string[];
  verified?: boolean;
  verify_notes?: string;
  sources?: string[];
}
export interface LawExcerpt {
  label: string;
  citation: string;
  quote: string;
  gloss?: string;
  source_url?: string;
  verified?: boolean;
}
export interface EvidenceAsset {
  kind: "map" | "document" | "note" | "law";
  title?: string;
  archive?: string;
  citation?: string;
  note?: string;
  source_url?: string;
  rights?: string;
  // a law asset points at a law_excerpts entry instead of carrying prose
  excerpt?: string;
  // Verbatim text from the source, where the words are the evidence and there
  // is no plate to show. The 1938 FTC annual report is the case: FRASER serves
  // it as a text PDF, so there is no page scan, and a quotation of the page
  // carries more than a picture of the same type would.
  quote?: string;
  files?: { full?: string; thumb?: string };
  verified?: boolean;
}
export type FrameKind = "dots" | "dots+tints" | "holdings" | "seam" | "membership" | "current";
export interface TimelineGeometry {
  kind: FrameKind;
  // holdings plates only: which source sheet this plate draws. The timeline is the
  // control. There used to be one 1930 plate carrying both sheets behind a separate
  // switch, which put two controls on screen doing the same job and dated the plate to
  // a year neither sheet was printed in.
  year?: string;
  scale?: { field: string; min_r: number; max_r: number };
  frame_key?: string;
  tints?: Record<string, string>;
  groups?: Record<string, { label: string; color: string }>;
  // seam plates only. `unified` means the Eastern and Western grids were
  // running in step, so they take one colour and the seam between them is
  // ghosted. `emphasis` is the boundary that plate is about.
  unified?: boolean;
  emphasis?: "ew" | "ercot";
}
export interface TimelineFrame {
  id: string;
  year: number;
  label: string;
  span: [number, number];
  kicker?: string;
  title: string;
  body: string;
  note?: string;
  geometry: TimelineGeometry;
  legend?: { swatch: string; label: string }[];
  events?: string[];
  evidence?: string[];
  // false while the plate's map is still being built; the scrubber says so
  ship: boolean;
  verified?: boolean;
  verify_notes?: string;
  sources?: string[];
  view?: ViewBoxTuple;
}
export type ViewBoxTuple = [number, number, number, number];
// What one of the three machines is, for the seam plates' hover card.
export interface SeamMachine {
  name: string;
  body: string;
  note?: string;
  sources?: string[];
}
export interface TimelineFile {
  meta: Record<string, unknown>;
  frames: TimelineFrame[];
  dots: TimelineDot[];
  events: Record<string, TimelineEvent>;
  law_excerpts: Record<string, LawExcerpt>;
  evidence: Record<string, EvidenceAsset>;
  seam_machines?: Record<string, SeamMachine>;
}

// The one seam between untyped JSON and typed code. Each file is cast once,
// here, against the interfaces above; everything downstream stays typed.
import copyJson from "../public/data/copy.json";
import rulesJson from "../public/data/rules.json";
import statePricesJson from "../public/data/state-prices.json";

export const copy = copyJson as unknown as CopyDeck;
export const rules = rulesJson as unknown as RulesFile;
export const statePrices = statePricesJson as unknown as StatePricesFile;

export async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url}: ${String(r.status)}`);
  return (await r.json()) as T;
}
export async function fetchJsonOrNull<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}
