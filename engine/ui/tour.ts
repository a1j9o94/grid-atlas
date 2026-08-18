// ---- the 30-second tour ----
import { req } from "../../lib/assert";
import { copy } from "../../lib/data";
import { ctx, setHidden } from "../ctx";
import { setLayer } from "../actions";

function byId(id: string): HTMLElement {
  return req(document.getElementById(id), `#${id}`);
}

export function tourShow(i: number): void {
  const c = ctx();
  c.tourIdx = i;
  const step = req(copy.tour[i], `tour step ${String(i)}`);
  void setLayer(step.layer);
  byId("tour-step-label").textContent = `${String(i + 1)} of ${String(copy.tour.length)}`;
  byId("tour-title").textContent = step.title;
  byId("tour-body").textContent = step.body;
  byId("tour-next").textContent = i === copy.tour.length - 1 ? "Explore" : "Next";
  setHidden(byId("tour-panel"), false);
}

function tourEnd(): void {
  ctx().tourIdx = -1;
  setHidden(byId("tour-panel"), true);
  try {
    localStorage.setItem("ga-tour-done", "1");
  } catch {
    // private mode: the tour will simply offer itself again next visit
  }
}

export function bindTour(): void {
  const c = ctx();
  const signal = c.ac.signal;
  byId("tour-next").addEventListener("click", () => {
    if (c.tourIdx >= copy.tour.length - 1) {
      tourEnd();
      c.zipInput.focus();
    } else tourShow(c.tourIdx + 1);
  }, { signal });
  byId("tour-skip").addEventListener("click", tourEnd, { signal });
  byId("tour-start").addEventListener("click", () => { tourShow(0); }, { signal });
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
