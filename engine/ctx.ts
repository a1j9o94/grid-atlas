// The engine's shared mutable state: DOM handles, loaded geometry, and the
// view state every module reads. One object, created by init and torn down by
// destroy, standing in for what were module-level globals in the old app.js.
import type { GeoPath, GeoProjection } from "d3-geo";
import type { MultiLineString } from "geojson";
import type {
  CartogramFile, LayerKey, MeasuresFile, RtosFC, StatesFC, TimelineFile, TransitionsFC, WireFeature,
} from "../lib/data";
import type { HoldingsBundle, MembershipFrames, SeamData } from "./data";
import type { ViewBox, WireGroupKey } from "./constants";
import type { Scale } from "./scales";

export type GroupKey =
  | "rto" | "transitions" | "rules" | "wires" | "cartogram" | "sizekey"
  | "you" | "zipoutline" | "statelines" | "labels" | "trivia"
  | "timeBase" | "timeMarks" | "holdings" | "seam" | "seamLines" | "membership";

export interface DragState { x: number; y: number; vb: ViewBox }

// What a legend key points at, written as selectors rather than as a predicate:
// every key on every plate names a set the browser can find on its own, because
// the encodings are already in the DOM. `dim` is what fades while the key is
// pointed at and `lit` is what stays. Two lists rather than one and its
// complement, because the wholesale key fades the regions and lights the hatch
// drawn over them, and those are different groups.
export interface LegendTarget {
  dim: readonly string[];
  lit: readonly string[];
  // What the card should say while this key is showing, for a key that names
  // one thing the atlas can already describe — a market, a machine. Pointing at
  // PJM on the strip and reading about ERCOT is the card contradicting the map.
  // Keys that name a set with no card of its own leave it alone.
  describe?: () => void;
}

export interface ParentGroup { color: string; meters: number; n: number; rank: number }

export interface EngineCtx {
  // one signal aborts every listener this engine attached
  ac: AbortController;
  // flips when the host component unmounts mid-load; async work checks it
  dead: boolean;

  // DOM the engine owns. Everything else on the page is React's: the engine
  // reaches it through the store, never by element.
  svg: SVGSVGElement;
  g: Record<GroupKey, SVGGElement>;
  wobbleDisp: SVGElement;
  // the one shared element: React renders it uncontrolled, the engine sets
  // its value on zip deep links and focuses it when the tour ends
  zipInput: HTMLInputElement;

  // geometry
  statesFC: StatesFC;
  rtosFC: RtosFC;
  transitionsFC: TransitionsFC;
  stateLines: MultiLineString;
  projection: GeoProjection;
  path: GeoPath;

  // view state
  current: LayerKey;
  sizeBy: string | null;
  colourBy: string;
  shadeBy: string;
  variantOf: Record<string, string>;
  // the zip the You layer is showing, once a search has landed
  zip: string | null;
  // monotonic token guarding async layer switches against staleness
  routeToken: number;
  // Whether a layer has actually been drawn, as opposed to `current` merely
  // naming the one this context was created with. Boot has to draw its layer
  // even when the route agrees with that name: the svg starts hidden and the
  // drawing note starts showing, and setLayer is the only thing that clears
  // either. Without this, "/" and "/trivia/..." both sat on "The map is being
  // drawn" forever, because wholesale is the name the engine starts with.
  layerDrawn: boolean;

  // wires layer state (DOM-bound, rebuilt per mount; fetches cache elsewhere)
  wiresFeatures: WireFeature[] | null;
  wiresCounts: Record<WireGroupKey, number> | null;
  measures: MeasuresFile | null;
  cartogram: CartogramFile | null;
  circleEls: SVGCircleElement[] | null;
  parentGroups: Map<string, ParentGroup> | null;
  colourScales: Map<string, Scale>;
  priceScales: Record<string, Scale>;

  // history layer state. The file is fetched on first open; frameId is the
  // plate showing, and playTimer is the auto-advance the reader can interrupt.
  timeline: TimelineFile | null;
  frameId: string | null;
  playTimer: ReturnType<typeof setInterval> | null;
  dotAnim: number | null;
  // the three machines, fetched on the first seam plate rather than with the
  // timeline file, because six plates in nine never need it
  seam: SeamData | null;
  // market footprints at the three membership frames, fetched on the first one
  membership: MembershipFrames | null;
  // FTC Map III county geometry plus its hand-read 1925 trace. This is fetched
  // only when the 1930 plate opens.
  holdings: HoldingsBundle | null;
  // which source plate the 1930 plate is drawing, 1925 or 1932

  // animation + interaction
  morphAnim: number | null;
  viewAnim: number | null;
  drag: DragState | null;
  pinch: number | null;
  hoveredWire: Element | null;

  // The legend as an index to the plate: a token per key, rebuilt with the
  // model on every repaint, so a token can only ever name marks this plate
  // draws. `legendGen` prefixes the tokens, which is what makes a stale one
  // inert rather than a handle to whatever key now sits at that index.
  legendTargets: Map<string, LegendTarget>;
  legendGen: number;
  // What the reader is pointing at, and what they asked to keep. A finger
  // raises no hover, so a tap pins instead; the pin is what the plate shows
  // once the pointer moves on, and a preview of another key sits on top of it
  // for as long as the pointer is there.
  legendHover: string | null;
  legendPin: string | null;
  // The one rule the engine writes at runtime. It lives inside the svg, so
  // destroy takes it away with everything else the engine inked.
  legendStyle: SVGStyleElement;
}

let C: EngineCtx | null = null;

export function ctx(): EngineCtx {
  if (!C) throw new Error("engine not initialized");
  return C;
}
export function setCtx(c: EngineCtx | null): void {
  C = c;
}

// The engine may not exist yet, or any more: React renders the chrome before
// init resolves, and a pointer can be over the legend before the map is drawn
// or after destroy has cleared it. Callers that can arrive that early ask
// instead of assuming.
export function maybeCtx(): EngineCtx | null {
  return C;
}

export function setHidden(el: Element, value: boolean): void {
  if (value) el.setAttribute("hidden", "");
  else el.removeAttribute("hidden");
}
