// The query-param links this site shipped with have been shared publicly, so
// they redirect forever. A real 308 here means a crawler, a preview card, or
// a reader with scripts blocked all land on the canonical path — no client
// JavaScript involved. cleanUrls meant every legacy link pointed at "/", so
// that is the only path this runs on.
import { NextResponse, type NextRequest } from "next/server";
import { buildPath, parseLegacyQuery } from "./lib/route";

export function proxy(req: NextRequest): NextResponse {
  const legacy = parseLegacyQuery(req.nextUrl.search);
  if (!legacy) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = buildPath(legacy);
  url.search = "";
  return NextResponse.redirect(url, 308);
}

export const config = { matcher: "/" };
