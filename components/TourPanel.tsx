"use client";

import { copy } from "../lib/data";
import { useAtlas } from "../lib/store";
import { tourEnd, tourNext } from "../engine/ui/tour";

export default function TourPanel() {
  const idx = useAtlas((s) => s.tourIdx);
  const step = idx !== null ? copy.tour[idx] : undefined;
  return (
    <div className="tour-panel" id="tour-panel" hidden={idx === null}>
      <p className="tour-step" id="tour-step-label">
        {idx !== null ? `${String(idx + 1)} of ${String(copy.tour.length)}` : ""}
      </p>
      <h3 id="tour-title">{step?.title ?? ""}</h3>
      <p className="tour-body" id="tour-body">{step?.body ?? ""}</p>
      <div className="tour-actions">
        <button id="tour-skip" onClick={tourEnd}>Skip</button>
        <button id="tour-next" className="primary" onClick={tourNext}>
          {idx !== null && idx >= copy.tour.length - 1 ? "Explore" : "Next"}
        </button>
      </div>
    </div>
  );
}
