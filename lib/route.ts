// The path ⇄ view-state codec. One module owns the URL grammar, shared by the
// client engine and the middleware, so a link can never mean two things.
//
// Grammar:
//   /                          wholesale (default)
//   /rules[/<shade>]           rules, shaded by a state-prices measure
//   /wires[/<colour>][/by-<size>]
//                              colour: parent | any colourOnly measure id,
//                              with an optional -variant suffix (saidi-all);
//                              size: a cartogram measure, marked by the by-
//                              prefix so it can never collide with a colour
//   /you[/<zip>]               zip search
//   /then[/<frame>]            the history layer, on a dated plate
//   /then/<frame>/evidence/<id>
//                              that plate with an archival source open
//
// Defaults stay off the URL, so the ordinary link stays short. Parsing is
// syntactic only; whether a measure id actually exists is checked against the
// registries by whoever applies the route.
import type { LayerKey } from "./data";

export interface RouteState {
  layer: LayerKey;
  shade: string;
  colour: string;
  size: string | null;
  zip: string | null;
  trivia: string | null;
  // a plate on the history scrubber. Syntax only: an unknown year is snapped
  // to the nearest plate at or before it by whoever applies the route, so a
  // link to a year we do not draw still lands somewhere honest.
  frame: string | null;
  evidence: string | null;
}

export const DEFAULT_ROUTE: RouteState = {
  layer: "wholesale",
  shade: "bucket",
  colour: "type",
  size: null,
  zip: null,
  trivia: null,
  frame: null,
  evidence: null,
};

function decode(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

export function parseRoute(pathname: string): RouteState | null {
  const segs = pathname.split("/").filter((s) => s.length > 0).map(decode);
  if (segs.length === 0) return { ...DEFAULT_ROUTE };
  const [head, a] = segs;
  switch (head) {
    // legacy spelling of the default layer; buildPath never emits it
    case "wholesale":
      return segs.length === 1 ? { ...DEFAULT_ROUTE } : null;
    case "rules":
      if (segs.length === 1) return { ...DEFAULT_ROUTE, layer: "rules" };
      // "bucket" is the default and stays off the URL; only its named form exists
      if (segs.length === 2 && a !== undefined && a !== "bucket") return { ...DEFAULT_ROUTE, layer: "rules", shade: a };
      return null;
    case "wires": {
      if (segs.length > 3) return null;
      let colour = "type";
      let size: string | null = null;
      for (const seg of segs.slice(1)) {
        if (seg.startsWith("by-")) {
          if (size !== null || seg === "by-") return null;
          size = seg.slice(3);
        } else {
          // a colour segment: exactly one, and it comes before the size
          if (colour !== "type" || size !== null || seg === "" || seg === "type") return null;
          colour = seg;
        }
      }
      return { ...DEFAULT_ROUTE, layer: "wires", colour, size };
    }
    case "you":
      if (segs.length > 2) return null;
      if (a !== undefined && !/^\d{5}$/.test(a)) return null;
      return { ...DEFAULT_ROUTE, layer: "you", zip: a ?? null };
    case "then": {
      if (segs.length === 1) return { ...DEFAULT_ROUTE, layer: "history" };
      if (a === undefined || a === "") return null;
      if (segs.length === 2) return { ...DEFAULT_ROUTE, layer: "history", frame: a };
      // /then/<frame>/evidence/<id>
      if (segs.length === 4 && segs[2] === "evidence" && segs[3] !== undefined && segs[3] !== "")
        return { ...DEFAULT_ROUTE, layer: "history", frame: a, evidence: segs[3] };
      return null;
    }
    case "trivia":
      if (segs.length !== 2 || a === undefined || a === "") return null;
      return { ...DEFAULT_ROUTE, trivia: a };
    default:
      return null;
  }
}

export function buildPath(r: RouteState): string {
  if (r.trivia !== null) return `/trivia/${encodeURIComponent(r.trivia)}`;
  switch (r.layer) {
    case "wholesale":
      return "/";
    case "rules":
      return r.shade === "bucket" ? "/rules" : `/rules/${encodeURIComponent(r.shade)}`;
    case "wires": {
      let p = "/wires";
      if (r.colour !== "type") p += `/${encodeURIComponent(r.colour)}`;
      if (r.size !== null) p += `/by-${encodeURIComponent(r.size)}`;
      return p;
    }
    case "you":
      return r.zip !== null ? `/you/${r.zip}` : "/you";
    case "history": {
      if (r.frame === null) return "/then";
      const p = `/then/${encodeURIComponent(r.frame)}`;
      return r.evidence !== null ? `${p}/evidence/${encodeURIComponent(r.evidence)}` : p;
    }
  }
}

// The query-param links this site shipped with. They have been shared, so
// they redirect forever: the middleware answers with a 308, and the client
// keeps this parser as a belt-and-braces canonicalizer.
// Precedence mirrors the original boot: zip wins, then trivia, then layer.
export function parseLegacyQuery(search: string): RouteState | null {
  const params = new URLSearchParams(search);
  const zip = params.get("zip");
  const trivia = params.get("trivia");
  const layer = params.get("layer");
  const year = params.get("year");
  const frame = params.get("frame");
  const colour = params.get("colour");
  const size = params.get("size");
  const shade = params.get("shade");
  if (zip === null && trivia === null && layer === null && colour === null && size === null
    && shade === null && year === null && frame === null)
    return null;
  if (zip !== null && /^\d{5}$/.test(zip)) return { ...DEFAULT_ROUTE, layer: "you", zip };
  if (trivia !== null && trivia !== "") return { ...DEFAULT_ROUTE, trivia };
  if (layer === "wires") {
    return {
      ...DEFAULT_ROUTE,
      layer: "wires",
      colour: colour !== null && colour !== "" ? colour : "type",
      size: size !== null && size !== "" ? size : null,
    };
  }
  if (layer === "rules") {
    return { ...DEFAULT_ROUTE, layer: "rules", shade: shade !== null && shade !== "" ? shade : "bucket" };
  }
  if (layer === "you") return { ...DEFAULT_ROUTE, layer: "you" };
  // ?year= was its own entry point, with no layer param, so it is checked
  // alongside the history layer rather than under it
  if (layer === "history" || year !== null) {
    const f = frame !== null && frame !== "" ? frame : year !== null && year !== "" ? year : null;
    return { ...DEFAULT_ROUTE, layer: "history", frame: f };
  }
  return { ...DEFAULT_ROUTE };
}
