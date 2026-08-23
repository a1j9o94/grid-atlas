"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { hoverLegendKey, releaseLegendPin, toggleLegendPin } from "../engine/actions";
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

// Pointing at a key shows the marks it names on the plate; pressing it asks the
// plate to keep showing them. `match` is the engine's own handle, opaque here:
// the strip hands back what it was given.
//
// A finger raises no hover, which is the whole reason the press exists. It is
// not a touch-only affordance though: with a key held, a reader on a mouse can
// look at the map without the highlight going out from under them.
//
// Only a key the engine could resolve gets the attribute and the tab stop, so a
// key that names nothing on this plate stays exactly as inert as it reads. A
// span with role=button rather than a real button: the box stays the size the
// layout audit measures, and the reach a thumb needs is added around it in CSS
// rather than by growing a fourteen-row strip to 28px a row.
function live(match: string | undefined, pinned: boolean): Record<string, unknown> {
  if (match === undefined) return {};
  return {
    "data-lh": "",
    role: "button",
    tabIndex: 0,
    "aria-pressed": pinned,
    onMouseEnter: () => { hoverLegendKey(match); },
    onMouseLeave: () => { hoverLegendKey(null); },
    onFocus: () => { hoverLegendKey(match); },
    onBlur: () => { hoverLegendKey(null); },
    onClick: () => { toggleLegendPin(match); },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      // Space scrolls the page if it is let through, and a legend that jumps
      // the reader down the page is worse than one that does nothing.
      e.preventDefault();
      toggleLegendPin(match);
    },
  };
}

function Key({ item, pin }: { item: LegendKey; pin: string | null }) {
  return (
    <span className="lg-item" {...live(item.match, item.match !== undefined && item.match === pin)}>
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
  const pin = useAtlas((s) => s.legendPin);
  const ref = useRef<HTMLDivElement>(null);

  // Escape lets a held key go, the same way it closes the two modals. So does a
  // press on anything that is neither the strip nor the map — the map is
  // excluded on purpose, because looking at the map is what the reader held the
  // key in order to do.
  useEffect(() => {
    if (pin === null) return;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === "Escape") releaseLegendPin();
    };
    const onDown = (e: PointerEvent): void => {
      const el = e.target as Element | null;
      if (el === null) return;
      if (el.closest("#legend") !== null || el.closest("#map") !== null) return;
      releaseLegendPin();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [pin]);

  // Under 980px the strip is a horizontal scroller, so a held key can be off
  // the side of it — and pressing it again is how a reader lets it go. The
  // scrubber solved this first; this is the same two lines.
  useEffect(() => {
    if (pin === null) return;
    ref.current?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pin, legend]);

  return (
    <div className="legend" id="legend" hidden={legend === null} ref={ref}>
      {legend?.kind === "swatches" && (
        <>
          {legend.items.map((it, i) => <Key key={i} item={it} pin={pin} />)}
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
                  {...live(s.match, s.match !== undefined && s.match === pin)}
                ></span>
              ))}
            </span>
            <span className="lg-ticks">
              {legend.ticks.map((t, i) => (
                <span key={i} className="lg-tick">{t}</span>
              ))}
            </span>
          </span>
          <Key item={legend.notReported} pin={pin} />
          {legend.note !== undefined && <span className="lg-size">{legend.note}</span>}
        </>
      )}
    </div>
  );
}
