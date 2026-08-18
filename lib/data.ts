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
  derived?: { numerator: string; denominator: string; scale?: number };
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
export type FrameKind = "dots" | "dots+tints" | "seam" | "membership" | "current";
export interface TimelineGeometry {
  kind: FrameKind;
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
