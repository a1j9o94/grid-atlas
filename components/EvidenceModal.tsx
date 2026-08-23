"use client";

// The evidence lightbox: the original scan, or the words of the law.
//
// The plate arrives whole and the reader asks for detail, rather than the other
// way round. It used to open at natural size so it could be panned like a
// survey sheet under glass, which reads well on a desk and not at all on a
// phone: these sheets are 1000-2400px wide, the frame on a 390px screen is
// about 314px, and what the reader got was the top-left corner of a plate with
// no sign that the rest of it existed. Full size is still there, one tap away,
// and that is where the panning lives.
//
// The image only mounts when a source is open, so scrubbing never pays for a
// scan nobody asked to see.
import { useCallback, useState } from "react";
import { closeEvidence } from "../engine/ui/cards";
import { useAtlas } from "../lib/store";
import { useDialog } from "../lib/useDialog";

// Keyed on the image URL by its caller, so a new plate mounts fresh and always
// arrives fitted. That is a `key` rather than an effect resetting state on
// change, because the two cannot drift.
function Scan({ src, alt }: { src: string; alt: string }) {
  const [zoomed, setZoomed] = useState(false);
  const toggle = (): void => { setZoomed((z) => !z); };
  // Entering full size at the top-left corner of a 2400px plate lands the
  // reader on a blank margin that says nothing about the rest of it. Centre
  // horizontally and stay at the top: the head of the plate with both edges
  // visibly cut off is the pan affordance an overlay scrollbar cannot give,
  // because on a phone it is invisible until you already know to drag.
  const centre = useCallback((el: HTMLDivElement | null): void => {
    if (el === null) return;
    el.scrollLeft = Math.round((el.scrollWidth - el.clientWidth) / 2);
  }, []);
  return (
    <>
      <div className={zoomed ? "ev-scan zoomed" : "ev-scan"} ref={zoomed ? centre : null}>
        {/* deliberately not next/image: these are archival scans, and the
            zoomed mode wants the file at its own pixel size */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} onClick={toggle} />
      </div>
      {/* The control sits below the frame rather than floating inside it. An
          absolutely positioned box inside a scroll container is exactly how the
          close button used to go missing. */}
      <div className="ev-scan-bar">
        {/* The label names what pressing will do, and that is the whole
            accessible name. No aria-pressed alongside it: "Fit to screen,
            pressed" would announce the state as the opposite of what it is. */}
        <button type="button" className="ev-zoom" onClick={toggle}>
        {zoomed ? "⤡ Fit to screen" : "⤢ View full size"}
        </button>
      {zoomed && <span className="ev-hint">Drag to move across the page.</span>}
      </div>
    </>
  );
}

export default function EvidenceModal() {
  const ev = useAtlas((s) => s.evidence);
  const ref = useDialog<HTMLElement>(ev !== null, closeEvidence);

  if (!ev) return null;
  return (
    <div
      className="modal-backdrop"
      id="evidence-modal"
      onClick={(e) => { if (e.target === e.currentTarget) closeEvidence(); }}
    >
      <figure ref={ref} className="modal evidence" role="dialog" aria-modal="true" aria-labelledby="evidence-title">
        {/* Sticky, so the way out cannot scroll off the top of a long plate.
            figcaption stays the last child of the figure, which is what keeps
            this structure valid. */}
        <div className="ev-head">
          <h2 id="evidence-title">{ev.title}</h2>
          <button className="modal-close" id="evidence-close" aria-label="Close" onClick={() => { closeEvidence(); }}>
            ✕
          </button>
        </div>
        {ev.quote !== undefined && <blockquote className="ev-quote">{ev.quote}</blockquote>}
        {ev.gloss !== undefined && <p className="ev-gloss">{ev.gloss}</p>}
        {ev.image !== undefined && <Scan key={ev.image} src={ev.image} alt={ev.alt ?? ""} />}
        <figcaption className="ev-cite">
          {ev.cite}
          {ev.sourceUrl !== undefined && (
            <>
              {" "}
          <a href={ev.sourceUrl} target="_blank" rel="noopener">Open the original source ↗</a>
            </>
          )}
          {ev.missingPlate && <i> The scanned page is not included here yet. Use the archive link to view it.</i>}
          {ev.unverified && <i> This quotation still needs to be checked against the printed text.</i>}
        </figcaption>
      </figure>
    </div>
  );
}
