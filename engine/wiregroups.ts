import { copy } from "../lib/data";
import { WIRE_COLORS, type WireGroupKey } from "./constants";

export interface WireGroupInfo {
  color: string;
  label: string;
  phrase: string;
}

// Colours from the constants, labels from the copy deck. The legend wants one
// word; the hover card carries the full explanation from copy.wires_types.
export const WIRE_GROUPS: Record<WireGroupKey, WireGroupInfo> = {
  iou: groupInfo("iou"),
  coop: groupInfo("coop"),
  public: groupInfo("public"),
  other: groupInfo("other"),
};

function groupInfo(g: WireGroupKey): WireGroupInfo {
  return {
    color: WIRE_COLORS[g],
    label: copy.wires_groups[g]?.label ?? g,
    phrase: copy.wires_groups[g]?.phrase ?? "",
  };
}
