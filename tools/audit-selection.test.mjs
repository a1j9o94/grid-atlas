import assert from "node:assert/strict";
import { impactOf, parseList, probesOf, selectByName } from "./audit-selection.mjs";

const views = [
  { name: "wholesale" },
  { name: "rules-price" },
  { name: "wires-parent" },
  { name: "you" },
  { name: "history-1900" },
  { name: "history-today" },
];
const groups = {
  "rules-all": (v) => v.name.startsWith("rules"),
  "wires-all": (v) => v.name.startsWith("wires"),
  "history-all": (v) => v.name.startsWith("history"),
};

assert.deepEqual(parseList("history, wires-parent"), ["history", "wires-parent"]);
assert.deepEqual(selectByName(views, ["rules-all", "history-today"], groups).map((v) => v.name),
  ["rules-price", "history-today"]);
assert.throws(() => selectByName(views, ["typo"], groups), /unknown selection: typo/);

assert.deepEqual(impactOf(["public/data/timeline.json"]),
  { selectors: ["history-all"], fixed: false });
assert.deepEqual(impactOf(["public/data/measures.json"]),
  { selectors: ["wires-all", "you"], fixed: false });
assert.deepEqual(impactOf(["public/data/rtos.topo.json"]),
  { selectors: ["wholesale", "history-today"], fixed: false });
assert.deepEqual(impactOf(["app/globals.css"]),
  { selectors: ["all"], fixed: true });
assert.deepEqual(impactOf(["README.md", "tools/probe-history.mjs"]),
  { selectors: [], fixed: false });
assert.deepEqual(impactOf(["some/new-runtime-file.ts"]),
  { selectors: ["all"], fixed: true });

assert.deepEqual(probesOf(["public/data/timeline.json"], impactOf(["public/data/timeline.json"])),
  { history: true, legend: true });
assert.deepEqual(probesOf(["public/data/rules.json"], impactOf(["public/data/rules.json"])),
  { history: false, legend: true });
assert.deepEqual(probesOf(["public/data/zip/78.json"], impactOf(["public/data/zip/78.json"])),
  { history: false, legend: false });
assert.deepEqual(probesOf(["tools/probe-history.mjs"], impactOf(["tools/probe-history.mjs"])),
  { history: true, legend: false });
assert.deepEqual(probesOf(["README.md"], impactOf(["README.md"])),
  { history: false, legend: false });

console.log("audit selection: mappings clean");
