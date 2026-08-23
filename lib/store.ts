// The seam between the imperative map engine and the React chrome. The engine
// computes plain-data models and sets them here; components subscribe through
// useSyncExternalStore and render. Nothing in this file touches the DOM.
import { useSyncExternalStore } from "react";
import type { LayerKey } from "./data";

export interface StatModel {
  value: string;
  label: string;
}

// A source behind a plate: an archival scan, a statute, or a written record.
// The glyph distinguishes something we looked at from something somebody
// wrote down, and `thumb` is present only once the scan is committed.
export interface EvidenceChip {
  id: string;
  glyph: string;
  label: string;
  thumb?: string;
}
export interface FrameEventRow {
  id: string;
  year: string;
  title: string;
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
  | { kind: "intro"; title: string; body: string; note?: { lead?: string; text: string } }
  | {
      kind: "frame";
      kicker: string;
      title: string;
      body: string;
      note?: string;
      events: FrameEventRow[];
      evidence: EvidenceChip[];
      // the plate's map is not built yet, so the card says so instead of
      // leaving the reader in an empty country wondering
      pending: boolean;
      // what moved between two traced source plates, present only when the
      // plate carries more than one
      changeLine?: string;
      // How the plate was read and how wrong it might be. Every figure is read
      // off the artifact's own meta rather than written here, so the card cannot
      // drift from the trace it describes.
      method?: { rows: { label: string; value: string }[]; notes: string[] };
    }
  | {
      kind: "event";
      kicker: string;
      title: string;
      body: string;
      note?: string;
      excerpt?: EvidenceChip;
      // assets backing this claim specifically, not the plate around it
      evidence: EvidenceChip[];
      backLabel: string;
    }
  // A city dot on a 1900-era plate and a machine on a seam plate render the
  // same way, so they share a shape and differ only in what the reader pointed
  // at. Card.tsx handles both in one branch.
  | {
      kind: "dot" | "machine";
      kicker: string;
      name: string;
      body: string;
      note?: string;
      stats: StatModel[];
      backLabel: string;
    }
  | {
      kind: "holdingCounty";
      kicker: string;
      name: string;
      statusLine: string;
      // Present only when more than one source plate is traced. The reader sees
      // both years at once, because the change between them is the point.
      readings?: { year: string; plate: string; statusLine: string }[];
      body: string;
      note?: string;
      backLabel: string;
    };

// One key on the legend strip. `shape` turns a square swatch into a lamp for
// the dot plates or a rule for the seam; everything else is a plain background
// value. `match` is an opaque handle the engine hands back to itself: pointing
// at this key shows you the marks on the plate it names. The component never
// reads it, only returns it, so the seam stays plain data and the engine keeps
// the knowledge of what a key means.
export interface LegendKey {
  swatch: string;
  label: string;
  shape?: "dot" | "dot-story" | "line" | "line-ghost";
  match?: string;
}

export type LegendModel =
  | { kind: "swatches"; items: LegendKey[]; note?: string }
  | {
      kind: "ramp";
      label: string;
      // A colour, the handle to the marks wearing it, and the range it stands
      // for, together rather than in parallel arrays, so a step cannot drift
      // from what it points at. The band is a bare colour on screen, so the
      // range is what names it to a reader who arrives by keyboard.
      steps: readonly { swatch: string; label: string; match?: string }[];
      ticks: string[];
      // A key like any other, so every row on the strip renders through one
      // path and the component has no colour of its own to know.
      notReported: LegendKey;
      note?: string;
    };

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

// Which source plate the holdings layer is drawing. Two sheets seven years
// apart, and the control names the one on screen, because the plate around it
// is labelled for an era rather than for a printing.
export interface DrawingNoteModel {
  title: string;
  sub: string;
}

export interface TimelineStop {
  id: string;
  label: string;
  title: string;
  pressed: boolean;
  pending: boolean;
}
export interface TimelineBarModel {
  stops: TimelineStop[];
  canPrev: boolean;
  canNext: boolean;
  playing: boolean;
}

// The evidence lightbox. The citation is passed as text plus an optional link
// rather than as markup, so the component owns the anchor.
export interface EvidenceModel {
  title: string;
  quote?: string;
  gloss?: string;
  image?: string;
  alt?: string;
  cite: string;
  sourceUrl?: string;
  // a map that promises a picture and has none committed yet owes the reader
  // an explanation; a written source is complete as a citation
  missingPlate: boolean;
  unverified: boolean;
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
  timeline: TimelineBarModel | null;
  evidence: EvidenceModel | null;
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
  timeline: null,
  evidence: null,
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
