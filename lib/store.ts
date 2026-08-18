// The seam between the imperative map engine and the React chrome. The engine
// computes plain-data models and sets them here; components subscribe through
// useSyncExternalStore and render. Nothing in this file touches the DOM.
import { useSyncExternalStore } from "react";
import type { LayerKey } from "./data";

export interface StatModel {
  value: string;
  label: string;
}

export type CardModel =
  | { kind: "region"; swatch: string; name: string; body: string; stats: StatModel[]; choice: string }
  | { kind: "state"; swatch: string; name: string; bucketLabel: string; body: string; note?: string }
  | { kind: "wire"; swatch: string; name: string; typeLine: string; body: string; stats: StatModel[] }
  | { kind: "wiresIntro"; stats: StatModel[] }
  | {
      kind: "trivia";
      kicker: string;
      title: string;
      body: string;
      transition?: { fromRto: string; fromSwatch: string; toRto: string; toSwatch: string; ariaLabel: string; date: string };
    }
  | { kind: "zipWires"; zip: string }
  | { kind: "you"; zip: string; wires: string; choice?: string; market?: string }
  | { kind: "intro"; title: string; body: string; note?: { lead?: string; text: string } };

export type LegendModel =
  | { kind: "swatches"; items: { swatch: string; label: string }[]; note?: string }
  | { kind: "ramp"; label: string; steps: readonly string[]; ticks: string[]; notReported: string; note?: string };

export interface ControlOption {
  key: string;
  label: string;
  pressed: boolean;
}
export interface ControlsModel {
  label: string;
  options: ControlOption[];
}
export interface ColourControlsModel extends ControlsModel {
  variants: ControlOption[] | null;
}

export interface DrawingNoteModel {
  title: string;
  sub: string;
}

export interface AtlasState {
  ready: boolean;
  layer: LayerKey;
  card: CardModel | null;
  legend: LegendModel | null;
  shadeControls: ControlsModel | null;
  colourControls: ColourControlsModel | null;
  sizeControls: ControlsModel | null;
  drawingNote: DrawingNoteModel | null;
  zipMsg: string;
  zoomResetVisible: boolean;
  tourIdx: number | null;
  modalOpen: boolean;
}

// Also the SSR snapshot: it must describe the page as index.html shipped it,
// map being drawn, everything else waiting.
const INITIAL: AtlasState = {
  ready: false,
  layer: "wholesale",
  card: null,
  legend: null,
  shadeControls: null,
  colourControls: null,
  sizeControls: null,
  drawingNote: {
    title: "The map is being drawn.",
    sub: "Check back shortly. The boundaries of 2,900 utilities take a moment to ink.",
  },
  zipMsg: "",
  zoomResetVisible: false,
  tourIdx: null,
  modalOpen: false,
};

let state: AtlasState = INITIAL;
const listeners = new Set<() => void>();

export function getAtlasState(): AtlasState {
  return state;
}

export function setAtlasState(partial: Partial<AtlasState>): void {
  let changed = false;
  for (const k of Object.keys(partial) as (keyof AtlasState)[]) {
    if (!Object.is(state[k], partial[k])) {
      changed = true;
      break;
    }
  }
  // callers fire per animation frame in places; identical writes cost nothing
  if (!changed) return;
  state = { ...state, ...partial };
  for (const l of listeners) l();
}

export function resetAtlasState(): void {
  state = INITIAL;
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAtlas<T>(selector: (s: AtlasState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(INITIAL),
  );
}
