"use client";

import { setAtlasState, useAtlas } from "../lib/store";
import { copy } from "../lib/data";
import { useDialog } from "../lib/useDialog";

function close(): void {
  setAtlasState({ modalOpen: false });
}

export default function MethodologyModal() {
  const open = useAtlas((s) => s.modalOpen);
  // Escape used to be handled here, written out a second time; the hook owns
  // that plus the focus handling neither modal had.
  const ref = useDialog<HTMLDivElement>(open, close);
  return (
    <div
      className="modal-backdrop"
      id="method-modal"
      hidden={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="method-title">
        <button className="modal-close" id="method-close" aria-label="Close" onClick={close}>✕</button>
        <h2 id="method-title">{copy.methodology.title}</h2>
        {copy.methodology.sections.map((section) => (
          <p className="note" key={section.title}>
            <b>{section.title}.</b> {section.body}
          </p>
        ))}
        <p className="note">
          <a href="https://github.com/a1j9o94/grid-atlas" target="_blank" rel="noopener">
            {copy.methodology.source_link}
          </a>
        </p>
      </div>
    </div>
  );
}
