// The page renders nothing: the atlas lives in the layout so it survives
// navigation. This route exists so every deep-link path resolves, carries its
// own title and description for link previews, and 404s junk instead of
// silently showing the default map.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseRoute, type RouteState } from "../../lib/route";
import { describeRoute, isValidRoute, staticViewParams } from "../../lib/registry";

interface Params {
  view?: string[];
}

function resolve(view: string[] | undefined): RouteState {
  const r = parseRoute("/" + (view ?? []).join("/"));
  if (!r || !isValidRoute(r)) notFound();
  return r;
}

export function generateStaticParams(): { view: string[] }[] {
  return staticViewParams();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { view } = await params;
  return describeRoute(resolve(view));
}

export default async function View({ params }: { params: Promise<Params> }) {
  const { view } = await params;
  resolve(view);
  return null;
}
