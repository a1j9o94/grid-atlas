"use client";

// The evidence lightbox: the original scan, or the words of the law.
//
// The plate pans inside its own frame, like reading a survey sheet under
// glass, rather than being squeezed into the modal and made illegible. The
// image only mounts when a source is open, so scrubbing never pays for a scan
// nobody asked to see.
import { useEffect } from "react";
import { closeEvidence } from "../engine/ui/cards";
import { useAtlas } from "../lib/store";

export default function EvidenceModal() {
  const ev = useAtlas((s) => s.evidence);

  useEffect(() => {
    if (!ev) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") closeEvidence();
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); };
  }, [ev]);

  if (!ev) return null;
  return (
    <div
      className="modal-backdrop"
      id="evidence-modal"
      onClick={(e) => { if (e.target === e.currentTarget) closeEvidence(); }}
    >
      <figure className="modal evidence" role="dialog" aria-modal="true" aria-labelledby="evidence-title">
        <button className="modal-close" id="evidence-close" aria-label="Close" onClick={() => { closeEvidence(); }}>
          ✕
        </button>
        <h2 id="evidence-title">{ev.title}</h2>
        {ev.quote !== undefined && <blockquote className="ev-quote">{ev.quote}</blockquote>}
        {ev.gloss !== undefined && <p className="ev-gloss">{ev.gloss}</p>}
        {ev.image !== undefined && (
          <div className="ev-scan">
            {/* deliberately not next/image: these are archival scans shown at
                natural size so the reader can pan them, not responsive art */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ev.image} alt={ev.alt ?? ""} />
          </div>
        )}
        <figcaption className="ev-cite">
          {ev.cite}
          {ev.sourceUrl !== undefined && (
            <>
              {" "}
              <a href={ev.sourceUrl} target="_blank" rel="noopener">View at source ↗</a>
            </>
          )}
          {ev.missingPlate && <i> The plate itself is not committed yet; the link goes to the archive.</i>}
          {ev.unverified && <i> Quotation still being checked against the printed text.</i>}
        </figcaption>
      </figure>
    </div>
  );
}
