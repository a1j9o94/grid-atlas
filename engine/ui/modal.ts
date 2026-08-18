// methodology & about modal
import { req } from "../../lib/assert";
import { ctx, setHidden } from "../ctx";

export function bindModal(): void {
  const signal = ctx().ac.signal;
  const modal = req(document.getElementById("method-modal"), "#method-modal");
  req(document.getElementById("method-toggle"), "#method-toggle")
    .addEventListener("click", () => { setHidden(modal, false); }, { signal });
  req(document.getElementById("method-close"), "#method-close")
    .addEventListener("click", () => { setHidden(modal, true); }, { signal });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) setHidden(modal, true);
  }, { signal });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setHidden(modal, true);
  }, { signal });
}
