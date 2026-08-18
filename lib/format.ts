import type { MeasureSpec } from "./data";

export function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/ - \([a-z]{2}\)$/i, "")
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bLlc\b/g, "LLC")
    .replace(/\bInc\b/g, "Inc");
}

export const fmtBig = (v: number): string =>
  v >= 1e9 ? `${(v / 1e9).toFixed(1)}B`
  : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M`
  : v >= 1e3 ? `${String(Math.round(v / 1e3))}K`
  : String(v);

// Format a value the way its registry entry asks. Keeps the legend ticks and
// the hover card reading identically without either knowing the measure.
//
// `precise` is for legend ticks, where a rounded break can misstate the scale.
// The top smart-meter break is 99.9%, and rounding it to "100%" would tell the
// reader the darkest step begins at a value nothing can exceed. Data values
// stay rounded, because "84%" is the honest precision for a share of meters.
export function fmtMeasure(spec: MeasureSpec | undefined, precise = false): (v: number) => string {
  if (spec?.format === "percent0")
    return (v) => `${precise && !Number.isInteger(v) ? v.toFixed(1) : String(Math.round(v))}%`;
  if (spec?.format === "decimal1") return (v) => v.toFixed(1);
  return (v) => Math.round(v).toLocaleString();
}
