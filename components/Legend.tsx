"use client";

import { NO_DATA } from "../engine/constants";
import { useAtlas } from "../lib/store";

export default function Legend() {
  const legend = useAtlas((s) => s.legend);
  return (
    <div className="legend" id="legend" hidden={legend === null}>
      {legend?.kind === "swatches" && (
        <>
          {legend.items.map((it, i) => (
            <span key={i} className="lg-item">
              <span className="lg-swatch" style={{ background: it.swatch }}></span>
              {it.label}
            </span>
          ))}
          {legend.note !== undefined && <span className="lg-size">{legend.note}</span>}
        </>
      )}
      {legend?.kind === "ramp" && (
        <>
          <span className="lg-ramp">
            <span className="lg-ramp-label">{legend.label}</span>
            <span className="lg-bar">
              {legend.steps.map((c, i) => (
                <span key={i} className="lg-step" style={{ background: c }}></span>
              ))}
            </span>
            <span className="lg-ticks">
              {legend.ticks.map((t, i) => (
                <span key={i} className="lg-tick">{t}</span>
              ))}
            </span>
          </span>
          <span className="lg-item">
            <span className="lg-swatch" style={{ background: NO_DATA }}></span>
            {legend.notReported}
          </span>
          {legend.note !== undefined && <span className="lg-size">{legend.note}</span>}
        </>
      )}
    </div>
  );
}
