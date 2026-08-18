import type { LayerKey } from "../lib/data";

export const SVG_NS = "http://www.w3.org/2000/svg";
export const LAYERS: readonly LayerKey[] = ["wholesale", "rules", "wires", "you", "history"];
export const READY: ReadonlySet<LayerKey> = new Set(LAYERS);

export const FILL: Record<string, string> = {
  PJM: "var(--r-pjm)", ERCOT: "var(--r-ercot)", MISO: "var(--r-miso)",
  SPP: "var(--r-spp)", CAISO: "var(--r-caiso)", NYISO: "var(--r-nyiso)",
  ISONE: "var(--r-isone)", NONE: "var(--r-none)",
  // SPP West: same operator as SPP, so same ochre, hatched to mark that it
  // sits on the other side of the East-West interconnection seam.
  SPPWEST: "url(#hatch-sppwest)",
};
// HTML swatches can't reference SVG patterns; mirror the hatch in CSS. These
// are CSS background values, handed to React style props.
export function swatchBackground(rto: string): string {
  if (rto === "SPPWEST")
    return "repeating-linear-gradient(45deg, #c99a2e 0 4px, #7a621f 4px 5.5px)";
  return FILL[rto] ?? "#ccc";
}
export const TRANSITION_SWATCH =
  "repeating-linear-gradient(-45deg, #b4552d 0 4px, #f0d8ca 4px 5.5px)";

// FTC Map III is monochrome. These editorial colours separate the twenty
// printed hatch identities after they have been hand traced; the legend says
// that explicitly so nobody mistakes them for colours sampled from the plate.
export const HOLDING_COLORS: Record<string, string> = {
  age: "#8f5f4b",
  "american-water-works": "#52799a",
  "cities-service": "#b87c34",
  ebasco: "#697d91",
  "federal-light": "#876b9d",
  fitkin: "#ba6861",
  "general-gas-electric": "#477a72",
  hodenpyl: "#657d45",
  insull: "#9d5545",
  "national-electric": "#9a7b43",
  "north-american": "#4c7790",
  "north-american-light": "#7566a0",
  "northeastern-super": "#4e8585",
  southeastern: "#a86877",
  "standard-gas": "#797b42",
  "stone-webster": "#5f6e9b",
  tenney: "#9c6d8a",
  ugi: "#477c59",
  "united-gas-electric": "#a76437",
  "united-light-power": "#77705d",
};
export const HOLDINGS_EXACT_SWATCH =
  "linear-gradient(90deg, #9d5545 0 20%, #697d91 20% 40%, #657d45 40% 60%, #52799a 60% 80%, #b87c34 80%)";
export const HOLDINGS_MAYBE_SWATCH =
  "repeating-linear-gradient(135deg, #718279 0 3px, #e4e7db 3px 6px)";
export const HOLDINGS_AMB_SWATCH =
  "repeating-linear-gradient(45deg, #696e65 0 2px, #d8dbd1 2px 5px)";
export const HOLDINGS_UNKNOWN_SWATCH =
  "repeating-linear-gradient(90deg, #9da296 0 1px, #d8dbd1 1px 4px)";

// wires layer: ownership as ONE hue, stepped from investor-owned (light) to
// citizen-owned (dark). Any two contrasting hues at this area coverage reads
// as an election map, so the encoding is ordered "how public is your power
// company" instead of team colors. Ramp validated on the sage surface.
// Colours here, labels in the copy deck. The legend wants one word; the hover
// card carries the full explanation from copy.wires_types.
export type WireGroupKey = "iou" | "coop" | "public" | "other";
export const WIRE_COLORS: Record<WireGroupKey, string> = {
  iou: "#a98cc4", coop: "#7c5fae", public: "#4b3178", other: "#c8c3ae",
};
export function wireGroup(type: string): WireGroupKey {
  if (type === "INVESTOR OWNED") return "iou";
  if (type === "COOPERATIVE") return "coop";
  if (["MUNICIPAL", "POLITICAL SUBDIVISION", "STATE", "FEDERAL"].includes(type)) return "public";
  return "other";
}

// Sequential ramps, built in OKLCH at even lightness steps. Lightness carries
// the information, so they survive any colour vision and print. Never used for
// identity: the categorical encodings keep their own hues.
// All four run L 0.895 down to 0.415 in even steps of 0.12, so no ramp reads as
// darker than another at the same step. Solar sits at hue 95 rather than
// somewhere warmer: the outage ramp already owns hue 45, and two gold-brown maps
// would make switching colour measures look like nothing had changed.
export const PRICE_RAMP: readonly string[] = ["#c5e5e5", "#97c1c0", "#6a9d9c", "#3c7b7a", "#00595a"];
export const RAMPS: Record<string, readonly string[]> = {
  price: PRICE_RAMP,
  outage: ["#fad5c5", "#daac97", "#ba846b", "#9a5d41", "#7a3713"],
  solar: ["#eddda0", "#ccb55f", "#a88f29", "#816c00", "#5b4a00"],
  meter: ["#c7dffa", "#92bae4", "#6295c9", "#3c71a5", "#234e78"],
};
export const NO_DATA = "#dcdccf";
// A utility whose parent falls outside the named twenty still has a parent.
// Painting it the same as a town-owned utility would say the opposite, so it
// gets its own neutral, darker than "no parent" and quieter than the named hues.
export const OTHER_PARENT = "#9aa08c";

// Which ramp suits which measure. A measure with no entry falls back rather
// than failing, so a new one is legible before anyone picks its colours.
export const RAMP_FOR: Record<string, string> = {
  saidi: "outage", solarw: "solar", amishare: "meter",
};

// HIFLD repeats the utility's own name in HOLDING_CO for the ~2,700 municipals
// and co-ops that have no parent, so a plain distinct count says 2,831 and
// hides the story. Only a parent that genuinely differs from the utility name,
// and covers more than one utility or a lot of meters, is a group.
export const PARENT_COLORS: readonly string[] = [
  "#3a6ea8", "#b4552d", "#1d8a6a", "#c99a2e", "#a05680", "#66801c", "#6b5aa0", "#8a94a8",
  "#2e5c8a", "#8f4423", "#176e55", "#a17c25", "#804566", "#516319", "#554880", "#6e7686",
  "#20496e", "#6d341b", "#115442", "#7a5d1c",
];

// region labels (wholesale layer): computed centroids with hand nudges; NONE
// uses the two display anchors from the copy deck.
export const NUDGE: Record<string, [number, number]> = {
  ISONE: [26, -14], NYISO: [0, -6], CAISO: [-4, 10], MISO: [10, -20], SPP: [0, 16],
};

export type ViewBox = [number, number, number, number];
export const HOME_VIEW: ViewBox = [0, 0, 975, 610];
// The cartogram layouts are computed against exactly this projection frame;
// assertCartogramProjection checks the file still agrees.
export const FIT_EXTENT: [[number, number], [number, number]] = [[8, 8], [967, 602]];
