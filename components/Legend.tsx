"use client";

import { NO_DATA } from "../engine/constants";
import { useAtlas } from "../lib/store";

// Legend swatch shapes. A plain colour swatch is the default and takes no
// class. A lamp needs lg-dot for the round shape and lg-dot-story only for its
// brighter core; a rule needs lg-line, and lg-line-ghost only for the broken
// version. Both families key off `shape`, so the class is looked up per shape
// rather than derived from one of them.
const SHAPE_CLASS: Record<"dot" | "dot-story" | "line" | "line-ghost", string> = {
  dot: " lg-dot",
  "dot-story": " lg-dot lg-dot-story",
  line: " lg-line",
  "line-ghost": " lg-line lg-line-ghost",
};

export default function Legend() {
  const legend = useAtlas((s) => s.legend);
  return (
    <div className="legend" id="legend" hidden={legend === null}>
      {legend?.kind === "swatches" && (
        <>
          {legend.items.map((it, i) => (
            <span key={i} className="lg-item">
              <span
                // a story lamp is a lamp first: it needs lg-dot for the round
                // shape and lg-dot-story only for its brighter core
                className={"lg-swatch" + (it.shape === undefined ? "" : SHAPE_CLASS[it.shape])}
                style={{ background: it.swatch }}
              ></span>
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
