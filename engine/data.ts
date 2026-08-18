// Data loading and the measure registry readers. The fetches cache at module
// level so a remount (dev StrictMode, fast refresh) never re-downloads the
// 5.7MB of wires geometry; everything DOM-bound lives on the ctx instead.
import { feature, mesh } from "topojson-client";
import type { GeometryObject, Topology } from "topojson-specification";
import type { FeatureCollection, GeoJsonProperties, Geometry, MultiLineString } from "geojson";
import { req } from "../lib/assert";
import {
  fetchJson, fetchJsonOrNull,
  type CartogramFile, type MeasureBlock, type MeasureSpec, type MeasuresFile,
  type HoldingsCountyFC, type HoldingsCountyProps, type HoldingsFile,
  type MembershipProps, type RtoProps, type RtosFC, type SeamLineProps, type SeamProps,
  type StateProps, type StatesFC,
  type TransitionProps, type TransitionsFC, type Utility, type ZctaFC, type ZctaProps, type ZipLookup,
} from "../lib/data";
import { makeScale, type Scale } from "./scales";
import { PRICE_RAMP, RAMPS, RAMP_FOR } from "./constants";
import { ctx } from "./ctx";

function firstObject(topo: Topology): GeometryObject<GeoJsonProperties> {
  return req(Object.values(topo.objects)[0], "topology object");
}
function toFC<P>(topo: Topology): FeatureCollection<Geometry, P> {
  return feature(topo, firstObject(topo)) as unknown as FeatureCollection<Geometry, P>;
}
// A file with more than one object in it, read by name. The seam file is the
// only one: three regions and the two boundaries between them, which have to
// travel together to stay coincident after quantization.
function namedFC<P>(topo: Topology, key: string): FeatureCollection<Geometry, P> {
  return feature(topo, req(topo.objects[key], `topology object ${key}`)) as unknown as FeatureCollection<Geometry, P>;
}

export interface BaseData {
  statesFC: StatesFC;
  rtosFC: RtosFC;
  transitionsFC: TransitionsFC;
  stateLines: MultiLineString;
}
let basePromise: Promise<BaseData> | null = null;
export function loadBase(): Promise<BaseData> {
  basePromise ??= (async () => {
    const [statesTopo, rtosTopo, transitionsTopo] = await Promise.all([
      fetchJson<Topology>("/data/states.topo.json"),
      fetchJson<Topology>("/data/rtos.topo.json"),
      fetchJson<Topology>("/data/transitions.topo.json"),
    ]);
    return {
      statesFC: toFC<StateProps>(statesTopo),
      rtosFC: toFC<RtoProps>(rtosTopo),
      transitionsFC: toFC<TransitionProps>(transitionsTopo),
      stateLines: mesh(statesTopo, firstObject(statesTopo) as GeometryObject, (a, b) => a !== b),
    };
  })();
  return basePromise;
}

// wires layer: lazy-loaded on first open (5.7MB of geometry). Per-utility
// measures are kept out of the geometry so the big topojson stays cached when
// the numbers change; the Dorling layouts are precomputed by the pipeline.
export interface WiresBundle {
  topo: Topology;
  measures: MeasuresFile | null;
  cartogram: CartogramFile | null;
}
let wiresPromise: Promise<WiresBundle> | null = null;
export function loadWiresBundle(): Promise<WiresBundle> {
  wiresPromise ??= (async () => {
    const [topo, measures, cartogram] = await Promise.all([
      fetchJson<Topology>("/data/wires.topo.json"),
      fetchJsonOrNull<MeasuresFile>("/data/measures.json"),
      fetchJsonOrNull<CartogramFile>("/data/cartogram.json"),
    ]);
    return { topo, measures, cartogram };
  })();
  return wiresPromise;
}
export function wiresTopoToFC(topo: Topology): FeatureCollection<Geometry, import("../lib/data").WireProps> {
  return toFC(topo);
}

// The three machines, for the 1935, 1967 and 1975 plates. Built by
// pipeline/13-build-seam.mjs, whose twenty checkpoints have to place every one
// of them in the right region before the file is written at all.
export interface SeamData {
  regionsFC: FeatureCollection<Geometry, SeamProps>;
  linesFC: FeatureCollection<Geometry, SeamLineProps>;
}
let seamPromise: Promise<SeamData> | null = null;
export function loadSeam(): Promise<SeamData> {
  seamPromise ??= (async () => {
    const topo = await fetchJson<Topology>("/data/timeline/seam.topo.json");
    const ew = namedFC<SeamLineProps>(topo, "seam_ew").features
      .map((f) => ({ ...f, properties: { seam: "ew" as const } }));
    const ercot = namedFC<SeamLineProps>(topo, "seam_ercot").features
      .map((f) => ({ ...f, properties: { seam: "ercot" as const } }));
    return {
      regionsFC: namedFC<SeamProps>(topo, "regions"),
      linesFC: { type: "FeatureCollection", features: [...ercot, ...ew] },
    };
  })();
  return seamPromise;
}

// Market footprints at the three membership frames, built by
// pipeline/15-build-membership.mjs. One file, three objects, because the three
// dissolves share arcs and have to stay coincident where a boundary did not move.
export type MembershipFrames = Record<string, FeatureCollection<Geometry, MembershipProps>>;
let membershipPromise: Promise<MembershipFrames> | null = null;
export function loadMembership(): Promise<MembershipFrames> {
  membershipPromise ??= (async () => {
    const topo = await fetchJson<Topology>("/data/timeline/regions.topo.json");
    const out: MembershipFrames = {};
    for (const k of Object.keys(topo.objects)) out[k] = namedFC<MembershipProps>(topo, k);
    return out;
  })();
  return membershipPromise;
}

// FTC Map III: lazy on the first 1930 plate. The 1.2MB county topology is not
// part of base data because no other layer needs county boundaries, while the
// compact trace can later gain a 1932 year without duplicating geometry.
export interface HoldingsBundle {
  countiesFC: HoldingsCountyFC;
  trace: HoldingsFile;
}
let holdingsPromise: Promise<HoldingsBundle> | null = null;
export function loadHoldingsBundle(): Promise<HoldingsBundle> {
  holdingsPromise ??= (async () => {
    const [topo, trace] = await Promise.all([
      fetchJson<Topology>("/data/timeline/holdings-counties.topo.json"),
      fetchJson<HoldingsFile>("/data/timeline/holdings-1925.json"),
    ]);
    return { countiesFC: toFC<HoldingsCountyProps>(topo), trace };
  })();
  return holdingsPromise;
}

export interface ZctaShard {
  geo: Topology | null;
  lookup: ZipLookup | null;
}
const zctaCache: Record<string, Promise<ZctaShard>> = {};
export function zctaShard(pfx: string): Promise<ZctaShard> {
  zctaCache[pfx] ??= (async () => {
    const [geo, lookup] = await Promise.all([
      fetchJsonOrNull<Topology>(`/data/zcta/${pfx}.topo.json`),
      fetchJsonOrNull<ZipLookup>(`/data/zip/${pfx}.json`),
    ]);
    return { geo, lookup };
  })();
  return req(zctaCache[pfx]);
}
export function zctaToFC(topo: Topology): ZctaFC {
  return toFC<ZctaProps>(topo);
}

// ---- measure registry readers ----
export const measureSpec = (id: string): MeasureSpec | undefined =>
  ctx().measures?.measures.find((m) => m.id === id);
export const colourMeasures = (): MeasureSpec[] =>
  ctx().measures?.measures.filter((m) => m.colourOnly) ?? [];
export const isColourMeasure = (id: string): boolean =>
  id !== "type" && id !== "parent" && !!measureSpec(id)?.colourOnly;

function blockOf(u: Utility, key: string): MeasureBlock | undefined {
  const b = u[key];
  return b !== undefined && typeof b === "object" && !Array.isArray(b) ? b : undefined;
}

// Read a measure for one utility. Measures declared as `derived` are computed
// here from two stored fields, so a variable like average price never has to
// be stored twice or kept in sync.
export function measureValue(id: string, measureId: string, cls = "tot"): number | null {
  const u = ctx().measures?.utilities[id];
  if (!u) return null;
  const spec = measureSpec(measureId);
  if (spec?.derived) {
    const n = blockOf(u, spec.derived.numerator)?.[cls];
    const d = blockOf(u, spec.derived.denominator)?.[cls];
    if (n == null || !d) return null;
    return (n / d) * (spec.derived.scale ?? 1);
  }
  return blockOf(u, measureId)?.[cls] ?? null;
}

// Reliability stores a block of storm variants where other measures store a
// block of customer classes, so it is read directly and the rest go through
// the class-aware reader. `cls` lets a measure name the class it means:
// rooftop solar per home is residential over residential, never total.
export function colourValue(uid: string, id: string): number | null {
  const spec = measureSpec(id);
  if (spec?.variants) {
    const u = ctx().measures?.utilities[uid];
    const variant = ctx().variantOf[id];
    if (!u || variant === undefined) return null;
    return blockOf(u, id)?.[variant] ?? null;
  }
  return measureValue(uid, id, spec?.cls ?? "tot");
}

export function colourScale(id: string): Scale | null {
  const c = ctx();
  if (!c.wiresFeatures || !isColourMeasure(id)) return null;
  const spec = req(measureSpec(id), `measure spec ${id}`);
  const key = spec.variants ? `${id}:${c.variantOf[id] ?? ""}` : id;
  let s = c.colourScales.get(key);
  if (!s) {
    s = makeScale(
      c.wiresFeatures.map((f) => colourValue(f.properties.ID, id)),
      RAMPS[RAMP_FOR[id] ?? ""] ?? PRICE_RAMP,
      spec.breaks,
    );
    c.colourScales.set(key, s);
  }
  return s;
}
