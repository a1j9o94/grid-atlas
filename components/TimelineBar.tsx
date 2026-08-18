"use client";

// The scrubber. Stops are evenly spaced rather than proportional to years:
// 1967, 1975, 1999, 2005, 2014 and today would collide at true scale and no
// stop would clear a thumb. The year labels carry the real spacing.
//
// Nine stops do not fit a phone, so the track scrolls and the active stop is
// scrolled into view whenever it changes. Otherwise pressing "later" moves a
// notch the reader cannot see.
import { useEffect, useRef } from "react";
import { pickFrame, togglePlay, walkFrame } from "../engine/actions";
import { useAtlas } from "../lib/store";

export default function TimelineBar() {
  const bar = useAtlas((s) => s.timeline);
  const trackRef = useRef<HTMLDivElement>(null);
  const active = bar?.stops.findIndex((s) => s.pressed) ?? -1;

  useEffect(() => {
    if (active < 0) return;
    const el = trackRef.current?.children[active];
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  return (
    <div className="timeline-bar" id="timeline-bar" hidden={bar === null}>
      <button
        className="tl-play"
        id="tl-play"
        aria-label={bar?.playing ? "Stop" : "Play through the history"}
        onClick={() => { togglePlay(); }}
      >
        {bar?.playing ? "❚❚" : "▶"}
      </button>
      <button
        className="tl-step-btn"
        id="tl-prev"
        aria-label="Earlier"
        disabled={!bar?.canPrev}
        onClick={() => { walkFrame(-1); }}
      >
        ‹
      </button>
      <div className="tl-track" id="tl-track" ref={trackRef} role="group" aria-label="Choose a moment in history">
        {bar?.stops.map((s) => (
          <button
            key={s.id}
            className="tl-stop"
            aria-pressed={s.pressed}
            title={s.title}
            {...(s.pending ? { "data-pending": "1" } : {})}
            onClick={() => { pickFrame(s.id); }}
          >
            <span className="tl-notch"></span>
            <span className="tl-year">{s.label}</span>
          </button>
        ))}
      </div>
      <button
        className="tl-step-btn"
        id="tl-next"
        aria-label="Later"
        disabled={!bar?.canNext}
        onClick={() => { walkFrame(1); }}
      >
        ›
      </button>
    </div>
  );
}
