"use client";

import { useEffect, type RefObject } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Print a document as ONE page, whatever length it needs.
//
// The obvious approach — scale the content down until it fits A4 — is the wrong
// one here. A budget squeezed to 45% is unreadable, and a call sheet that
// clipped to fit would drop somebody's call time. Both failures are worse than
// the problem.
//
// Instead the *page* is resized to the content: `@page { size: 210mm <n>mm }`
// makes the sheet as tall as the document, so it prints continuous with nothing
// scaled and nothing lost. A4 width is kept so it still reads as a document and
// prints sanely on real paper if anyone ever does.
//
// Extracted from CallSheetDocument, which already did this. The production
// budget was printing blank for an unrelated reason (see globals.css) and had
// no page sizing at all, so it paginated mid-table.
// ─────────────────────────────────────────────────────────────────────────────

const PX_TO_MM = 0.264583; // 96dpi

export interface SinglePagePrintOptions {
  /** Unique per document so two mounted previews can't fight over one <style>. */
  id: string;
  /** Page margin in mm. */
  marginMm?: number;
  /** Slack below the content so a rounding error can't spill to a second sheet. */
  bufferMm?: number;
  widthMm?: number;
  enabled?: boolean;
}

/**
 * Injects an `@page` rule sized to the referenced element's rendered height.
 * Re-measures on resize, so switching to cost tracking or filtering unused
 * lines re-sizes the sheet rather than leaving the old height behind.
 */
export function useSinglePagePrint(
  ref: RefObject<HTMLElement | null>,
  { id, marginMm = 10, bufferMm = 20, widthMm = 210, enabled = true }: SinglePagePrintOptions
) {
  useEffect(() => {
    if (!enabled) return;

    const style = document.createElement("style");
    style.id = id;
    document.head.appendChild(style);

    const update = () => {
      const el = ref.current;
      if (!el) return;
      const heightMm = Math.ceil(el.scrollHeight * PX_TO_MM) + bufferMm;
      // Guard against a zero measurement — an unmounted or display:none node
      // would otherwise ask for a 20mm page and print a sliver.
      if (heightMm <= bufferMm) return;
      style.textContent = `@media print { @page { size: ${widthMm}mm ${heightMm}mm; margin: ${marginMm}mm; } }`;
    };

    const observer = new ResizeObserver(update);
    if (ref.current) observer.observe(ref.current);
    update();
    // The masthead logo is an <img>; if it loads after the first measure the
    // page would be sized short of the real content.
    const t = window.setTimeout(update, 250);

    return () => {
      observer.disconnect();
      window.clearTimeout(t);
      style.remove();
    };
  }, [ref, id, marginMm, bufferMm, widthMm, enabled]);
}
