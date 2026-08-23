"use client";

// What an open dialog owes the keyboard. Both modals had the Escape half of
// this, written out twice; neither had the rest, so opening a lightbox left
// focus back on the page behind it and Tab walked straight out of the dialog
// into the map chrome the backdrop was covering.
//
// Returns a ref to put on the dialog element. Focus moves inside on open,
// cycles within it while open, and returns to whatever opened it on close —
// the evidence chip, usually, so the reader lands back on the row of sources
// they were working through.
import { useEffect, useRef, type RefObject } from "react";

// Tab order, minus anything the browser will not actually stop on. Checking
// offsetParent catches the ones hidden by a `hidden` attribute or display:none
// ancestor, which is how the methodology modal stays out of the way: it is
// always mounted and only toggles `hidden`.
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => el.offsetParent !== null || el === document.activeElement);
}

export function useDialog<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    // Where to send focus back. Reading it inside the effect rather than on
    // render means it is the element that actually had focus when the dialog
    // opened, not whatever the last render happened to see.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // The close button is first in the dialog, and it is the one control a
    // reader who opened this by accident is looking for.
    const first = dialog ? focusable(dialog)[0] : undefined;
    first?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = focusable(dialog);
      if (items.length === 0) return;
      const edge = e.shiftKey ? items[0] : items[items.length - 1];
      // Wrap at whichever end we are walking off. Focus may also be outside
      // the dialog entirely (a click on the backdrop lands on the body), in
      // which case pull it back in rather than letting Tab escape.
      if (document.activeElement === edge || !dialog.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? items[items.length - 1] : items[0])?.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Only when the dialog still owns focus, so closing by clicking something
      // else leaves the reader where they chose to be. "Still owns it" has two
      // shapes: the dialog is on its way out but still attached, or it has
      // already been removed and the browser has dropped focus to the body —
      // which is the usual one, because an unmounting subtree is detached
      // before its cleanup runs.
      const active = document.activeElement;
      const held = active === null || active === document.body || (dialog?.contains(active) ?? false);
      if (held && opener?.isConnected === true) opener.focus();
    };
  }, [open, onClose]);

  return ref;
}
