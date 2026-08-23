import { spawnSync } from "child_process";

const ALL = "all";

// Map changed files to the smallest safe set of route families. Anything that
// can affect shared chrome, routing, or an unknown runtime surface expands to
// every view. Data and layer implementations stay scoped to their own maps.
export function impactOf(files) {
  const selectors = new Set();
  let fixed = false;

  const add = (...names) => names.forEach((name) => selectors.add(name));
  const all = () => { add(ALL); fixed = true; };

  for (const path of files) {
    if (
      path === "tools/layout-audit.mjs"
      || path === "tools/audit-selection.mjs"
      || path === ".github/workflows/site.yml"
      || path === "package.json"
      || path === "package-lock.json"
      || path === "app/globals.css"
      || path.startsWith("components/")
      || path.startsWith("app/")
      || path.startsWith("lib/")
    ) {
      all();
      continue;
    }

    if (path === "public/data/copy.json") {
      // Copy is one shared deck loaded by every route. A layer-specific edit
      // can still change the global methodology modal or tour, so stay broad.
      all();
      continue;
    }
    if (path === "content/copy.json" || path === "content/editorial-guide.md") continue;

    if (path === "engine/layers/history.ts" || path.startsWith("public/data/timeline")) {
      add("history-all");
      continue;
    }
    if (
      path === "engine/layers/rules.ts"
      || path === "content/rules.json"
      || path === "public/data/rules.json"
      || path === "public/data/state-prices.json"
    ) {
      add("rules-all");
      continue;
    }
    if (
      path === "engine/layers/wires.ts"
      || path === "engine/wiregroups.ts"
      || path === "public/data/measures.json"
      || path === "public/data/cartogram.json"
      || path === "public/data/wires.topo.json"
    ) {
      add("wires-all", "you");
      continue;
    }
    if (
      path === "engine/layers/wholesale.ts"
      || path === "public/data/rtos.topo.json"
      || path === "public/data/transitions.topo.json"
    ) {
      add("wholesale", "history-today");
      continue;
    }
    if (
      path === "engine/layers/you.ts"
      || path.startsWith("public/data/zip/")
      || path.startsWith("public/data/zcta/")
    ) {
      add("you");
      continue;
    }
    if (path.startsWith("engine/")) {
      all();
      continue;
    }

    // Tests, research inputs, generated pipeline code, and prose do not alter
    // the rendered site. An unfamiliar source file fails safe to the full set.
    if (
      path.startsWith("tools/probe-")
      || path === "tools/validate-holdings.mjs"
      || path.startsWith("pipeline/")
      || path.endsWith(".md")
      || path.startsWith(".gitignore")
    ) continue;

    all();
  }

  return { selectors: [...selectors], fixed };
}

export function probesOf(files, impact) {
  const selected = new Set(impact.selectors);
  const all = impact.fixed || selected.has(ALL);
  const historyViews = all
    || selected.has("history-all")
    || selected.has("history-today");
  const history = historyViews || files.includes("tools/probe-history.mjs");
  const legend = all
    || historyViews
    || selected.has("wholesale")
    || selected.has("rules-all")
    || selected.has("wires-all")
    || files.includes("tools/probe-legend.mjs");
  return { history, legend };
}

export function changedFiles(base) {
  if (!base) throw new Error("--changed needs a base commit or ref");
  const diff = spawnSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMRTUXB", `${base}...HEAD`],
    { encoding: "utf8" },
  );
  if (diff.status !== 0) {
    const detail = (diff.stderr || diff.stdout).trim();
    throw new Error(`could not diff ${base}...HEAD${detail ? `: ${detail}` : ""}`);
  }
  return diff.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
}

export function parseList(value) {
  return value === null || value === undefined
    ? null
    : value.split(",").map((s) => s.trim()).filter(Boolean);
}

export function selectByName(items, requested, groups = {}) {
  if (requested === null) return items;
  const picked = new Set();
  const unknown = [];
  for (const token of requested) {
    if (token === ALL) {
      items.forEach((item) => picked.add(item.name));
      continue;
    }
    const group = groups[token];
    if (group) {
      items.filter(group).forEach((item) => picked.add(item.name));
      continue;
    }
    if (items.some((item) => item.name === token)) picked.add(token);
    else unknown.push(token);
  }
  if (unknown.length) throw new Error(`unknown selection: ${unknown.join(", ")}`);
  return items.filter((item) => picked.has(item.name));
}
