// The engine's shared mutable state: DOM handles, loaded geometry, and the
// view state every module reads. One object, created by init and torn down by
// destroy, standing in for what were module-level globals in the old app.js.
import type { GeoPath, GeoProjection } from "d3-geo";
import type { MultiLineString } from "geojson";
import type {
  CartogramFile, LayerKey, MeasuresFile, RtosFC, StatesFC, TransitionsFC, WireFeature,
} from "../lib/data";
import type { ViewBox, WireGroupKey } from "./constants";
import type { Scale } from "./scales";

export type GroupKey =
  | "rto" | "transitions" | "rules" | "wires" | "cartogram" | "sizekey"
  | "you" | "zipoutline" | "statelines" | "labels" | "trivia";

export interface DragState { x: number; y: number; vb: ViewBox }
export interface ParentGroup { color: string; meters: number; n: number; rank: number }

export interface EngineCtx {
  // one signal aborts every listener this engine attached
  ac: AbortController;
  // flips when the host component unmounts mid-load; async work checks it
  dead: boolean;

  // DOM
  svg: SVGSVGElement;
  g: Record<GroupKey, SVGGElement>;
  wobbleDisp: SVGElement;
  card: HTMLElement;
  legend: HTMLElement;
  shadeControls: HTMLElement;
  colourControls: HTMLElement;
  sizeControls: HTMLElement;
  rail: HTMLElement;
  explainer: HTMLElement;
  drawingNote: HTMLElement;
  zipForm: HTMLFormElement;
  zipInput: HTMLInputElement;
  zipMsg: HTMLElement;
  zoomReset: HTMLElement;

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

  // wires layer state (DOM-bound, rebuilt per mount; fetches cache elsewhere)
  wiresFeatures: WireFeature[] | null;
  wiresCounts: Record<WireGroupKey, number> | null;
  measures: MeasuresFile | null;
  cartogram: CartogramFile | null;
  circleEls: SVGCircleElement[] | null;
  parentGroups: Map<string, ParentGroup> | null;
  colourScales: Map<string, Scale>;
  priceScales: Record<string, Scale>;

  // animation + interaction
  morphAnim: number | null;
  viewAnim: number | null;
  drag: DragState | null;
  pinch: number | null;
  hoveredWire: Element | null;

  // tour
  tourIdx: number;
}

let C: EngineCtx | null = null;

export function ctx(): EngineCtx {
  if (!C) throw new Error("engine not initialized");
  return C;
}
export function setCtx(c: EngineCtx | null): void {
  C = c;
}

export function setHidden(el: Element, value: boolean): void {
  if (value) el.setAttribute("hidden", "");
  else el.removeAttribute("hidden");
}
