"use client";

import { hoverLegendKey } from "../engine/actions";
import { useAtlas, type LegendKey } from "../lib/store";

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

// Pointing at a key shows the marks it names on the plate. `match` is the
// engine's own handle, opaque here: the strip hands back what it was given.
//
// Only a key the engine could resolve gets the attribute and the tab stop, so a
// key that names nothing on this plate stays exactly as inert as it reads. A
// span rather than a button on purpose: this reveals, it does not command, and
// the layout audit holds every button to a 28px tap target that would double
// the height of a fourteen-row strip.
function live(match: string | undefined): Record<string, unknown> {
  if (match === undefined) return {};
  return {
    "data-lh": "",
    tabIndex: 0,
    onMouseEnter: () => { hoverLegendKey(match); },
    onMouseLeave: () => { hoverLegendKey(null); },
    onFocus: () => { hoverLegendKey(match); },
    onBlur: () => { hoverLegendKey(null); },
  };
}

function Key({ item }: { item: LegendKey }) {
  return (
    <span className="lg-item" {...live(item.match)}>
      <span
        // a story lamp is a lamp first: it needs lg-dot for the round
        // shape and lg-dot-story only for its brighter core
        className={"lg-swatch" + (item.shape === undefined ? "" : SHAPE_CLASS[item.shape])}
        style={{ background: item.swatch }}
      ></span>
      {item.label}
    </span>
  );
}

export default function Legend() {
  const legend = useAtlas((s) => s.legend);
  return (
    <div className="legend" id="legend" hidden={legend === null}>
      {legend?.kind === "swatches" && (
        <>
          {legend.items.map((it, i) => <Key key={i} item={it} />)}
          {legend.note !== undefined && <span className="lg-size">{legend.note}</span>}
        </>
      )}
      {legend?.kind === "ramp" && (
        <>
          <span className="lg-ramp">
            <span className="lg-ramp-label">{legend.label}</span>
            <span className="lg-bar">
              {legend.steps.map((s, i) => (
                <span
                  key={i}
                  className="lg-step"
                  style={{ background: s.swatch }}
                  // the band is a bare colour, so the range it stands for is
                  // the only name a reader arriving by keyboard would get
                  aria-label={s.label}
                  {...live(s.match)}
                ></span>
              ))}
            </span>
            <span className="lg-ticks">
              {legend.ticks.map((t, i) => (
                <span key={i} className="lg-tick">{t}</span>
              ))}
            </span>
          </span>
          <Key item={legend.notReported} />
          {legend.note !== undefined && <span className="lg-size">{legend.note}</span>}
        </>
      )}
    </div>
  );
}
