// ---- the 30-second tour ----
// The engine owns the sequencing (steps change layers); the store carries
// which step is open and the TourPanel component renders it.
import { copy } from "../../lib/data";
import { getAtlasState, setAtlasState } from "../../lib/store";
import { ctx } from "../ctx";
import { setLayer } from "../actions";

export function tourShow(i: number): void {
  // a tour shouldn't spam the back button: each step replaces, never pushes
  void setLayer(copy.tour[i]?.layer ?? "wholesale", "replace");
  setAtlasState({ tourIdx: i });
}

export function tourEnd(): void {
  setAtlasState({ tourIdx: null });
  try {
    localStorage.setItem("ga-tour-done", "1");
  } catch {
    // private mode: the tour will simply offer itself again next visit
  }
}

export function tourNext(): void {
  const idx = getAtlasState().tourIdx;
  if (idx === null) return;
  if (idx >= copy.tour.length - 1) {
    tourEnd();
    ctx().zipInput.focus();
  } else {
    tourShow(idx + 1);
  }
}

// first visit: offer the tour automatically (skippable, never repeats)
export function maybeAutoStartTour(deepLinked: boolean): void {
  let tourSeen = true;
  try {
    tourSeen = !!localStorage.getItem("ga-tour-done");
  } catch {
    // treat unreadable storage as seen rather than nagging every visit
  }
  if (!tourSeen && !deepLinked) tourShow(0);
}
