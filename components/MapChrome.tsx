"use client";

// The chrome that shares the map panel: the drawing note, the zip search,
// and the zoom reset.
import { resetZoom, submitZip } from "../engine/actions";
import { copy } from "../lib/data";
import { useAtlas } from "../lib/store";

export function DrawingNote() {
  const note = useAtlas((s) => s.drawingNote);
  return (
    <div className="drawing-note" id="drawing-note" hidden={note === null}>
      <p>{note?.title ?? ""}</p>
      <p className="sub">{note?.sub ?? ""}</p>
    </div>
  );
}

export function ZipSearch() {
  const layer = useAtlas((s) => s.layer);
  const zipMsg = useAtlas((s) => s.zipMsg);
  return (
    <form
      className="zip-search"
      id="zip-search"
      hidden={layer !== "you" && layer !== "wires"}
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("zip-input");
        if (input instanceof HTMLInputElement) submitZip(input.value.trim());
      }}
    >
      <label htmlFor="zip-input">{copy.ui.zip_label}</label>
      <div className="zip-row">
        {/* uncontrolled on purpose: the engine sets its value on zip deep
            links and focuses it when the tour ends */}
        <input id="zip-input" name="zip-input" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}" maxLength={5} placeholder="78701" required />
        {/* The label text stays in the DOM at every size and is only hidden
            visually, so the button keeps the accessible name "Find me" when
            the glyph is all you can see. */}
        <button type="submit">
          <svg className="ico-search" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <circle cx="6.8" cy="6.8" r="4.4" /><path d="M10.1 10.1 L14 14" />
          </svg>
          <span className="btn-txt">{copy.ui.zip_button}</span>
        </button>
      </div>
      <p className="zip-msg" id="zip-msg">{zipMsg}</p>
    </form>
  );
}

export function ZoomReset() {
  const visible = useAtlas((s) => s.zoomResetVisible);
  return (
    <button className="zoom-reset" id="zoom-reset" hidden={!visible} onClick={() => { resetZoom(); }}>
      {copy.ui.zoom_reset}
    </button>
  );
}
