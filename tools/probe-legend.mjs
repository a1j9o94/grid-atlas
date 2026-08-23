// Assert every key on the legend strip names the right marks, in a browser, on
// the built site.
//
// The layout audit proves the strip fits; probe-history proves the plates draw
// what they claim. This proves the two are wired to each other: that pointing
// at a key fades everything it does not name, that a key naming nothing on this
// plate does nothing at all, and — the assertion this file exists for — that
// every key on every plate has a target. A future plate that forgets to
// register in PLATE_MARKS fails here, by name, rather than shipping a legend
// that quietly does nothing.
//
// Usage: npm run build && npm run probe:legend
//        node tools/probe-legend.mjs [--browser <chrome>] [--port 3452]
import { spawn } from "child_process";
import { chromium } from "playwright";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const port = Number(arg("port", "3452"));
const url = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], { stdio: "ignore" });
for (let i = 0; i < 90; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}

const browser = await chromium.launch(
  arg("browser", null) ? { executablePath: arg("browser", null) } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const noise = [];
page.on("console", m => { if (m.type() === "error") noise.push(m.text()); });
page.on("pageerror", e => noise.push(String(e)));

const failures = [];
const want = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${JSON.stringify(actual)}`);
  if (!ok) failures.push(`${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};
const ok = (label, cond, detail) => want(label, cond ? "yes" : `no (${detail})`, "yes");

// The plates worth walking. Every legend shape the atlas can render is here:
// both swatch families, both ramps, and each of the five history geometries.
const ROUTES = [
  "/", "/rules", "/rules/res", "/wires", "/wires/parent", "/wires/saidi", "/wires/by-cust",
  "/then", "/then/1925", "/then/1932", "/then/1935", "/then/1967", "/then/1975",
  "/then/1999", "/then/2014", "/then/2026",
];
// The keys in the atlas that name something the plate does not draw, and how
// many there are on each route. Everything else must have a target — that is
// the inheritance contract, and a plate that forgets to register in
// PLATE_MARKS fails it here by name rather than shipping a legend that quietly
// does nothing.
//
//   /rules/res  — every state reports a residential price, so "not reported"
//                 names no state. The row is still printed, because the reader
//                 is owed the scale's own out-of-range colour.
//   membership  — the geometry carries no NONE feature: "nobody running the
//                 traffic" is a hole in the map rather than a shape on it.
const NAMES_NOTHING = { "/rules/res": 1, "/then/1999": 1, "/then/2014": 1 };

const KEYS = ".legend .lg-item, .legend .lg-step";

const open = async (route) => {
  await page.goto(url + route, { waitUntil: "networkidle" });
  await page.waitForSelector(KEYS, { timeout: 30000 });
  // the plates that fetch their geometry rebuild the strip when it lands, so
  // wait for the marks rather than for the network to go quiet
  await page.waitForFunction(
    () => !document.body.textContent.includes("Loading the trace"), null, { timeout: 30000 });
  // Park the pointer off the strip. A goto leaves the mouse where it was, and
  // whatever renders under it enters on its own, which reads as a key the probe
  // never pointed at.
  await page.mouse.move(4, 4);
  await page.waitForTimeout(400);
};

// Point at one key with the real mouse and report what the plate did about it.
// A real hover rather than a dispatched event on purpose: React synthesises
// mouseenter from mouseover, so a hand-made MouseEvent never reaches the
// handler and this file would pass while the feature was dead.
//
// The engine writes at most two rules: the one carrying fill-opacity fades what
// the key does not name, the one carrying filter emphasises what it does.
const read = () => page.evaluate(() => {
  const svg = document.getElementById("map");
  const sheet = document.getElementById("lh-rules");
  const rules = sheet.sheet ? [...sheet.sheet.cssRules] : [];
  const find = (prop) => rules.find(r => r.style.getPropertyValue(prop) !== "");
  const match = (rule) => rule ? [...svg.querySelectorAll(rule.selectorText)] : [];
  const dim = match(find("fill-opacity"));
  const lit = match(find("filter"));
  return {
    on: svg.classList.contains("has-legend-hover"),
    ruleCount: rules.length,
    text: sheet.textContent.length,
    litCount: lit.length,
    litSelector: find("filter")?.selectorText ?? "",
    // fill-opacity as the browser resolved it, which is the whole effect
    dimAlpha: dim[0] ? getComputedStyle(dim[0]).fillOpacity : null,
    litAlpha: lit[0] ? getComputedStyle(lit[0]).fillOpacity : null,
    overlap: lit.filter(e => dim.includes(e)).length,
  };
});

const describe = (i) => page.evaluate((idx) => {
  const el = [...document.querySelectorAll(".legend .lg-item, .legend .lg-step")][idx];
  return {
    label: (el.textContent || "").trim() || `step ${String(idx)}`,
    live: el.hasAttribute("data-lh"),
    tabbable: el.tabIndex === 0,
  };
}, i);

const point = async (i) => {
  await page.locator(KEYS).nth(i).hover();
  // The fade is a 120ms transition on most families, so a read taken on the
  // same tick catches the marks part-way there and calls it a failure.
  await page.waitForTimeout(250);
  return { ...await describe(i), ...await read() };
};
// Move off the strip entirely. The heading is the furthest thing from it that
// is always on the page.
const release = async () => {
  await page.locator("h1").hover();
  return read();
};

for (const route of ROUTES) {
  await open(route);
  const n = await page.evaluate(
    () => document.querySelectorAll(".legend .lg-item, .legend .lg-step").length);
  ok(`${route} has keys`, n > 0, `${n} keys`);
  const inert = [];
  let lit = 0;
  for (let i = 0; i < n; i++) {
    const r = await point(i);
    if (!r.live) { inert.push(r.label); continue; }
    lit++;
    ok(`${route} [${r.label}] tab stop`, r.tabbable, "not focusable");
    ok(`${route} [${r.label}] lights the plate`, r.on && r.litCount > 0,
      `on=${r.on} lit=${r.litCount}`);
    ok(`${route} [${r.label}] rule parses`, r.text === 0 || r.ruleCount > 0,
      `${r.text} chars, ${r.ruleCount} rules`);
    ok(`${route} [${r.label}] lit and dim are disjoint`, r.overlap === 0,
      `${r.overlap} in both`);
    if (r.dimAlpha !== null) {
      ok(`${route} [${r.label}] the rest fades`, Number(r.dimAlpha) < 0.5, `alpha ${r.dimAlpha}`);
      ok(`${route} [${r.label}] the named marks keep their paint`,
        Number(r.litAlpha) > 0.5, `alpha ${r.litAlpha}`);
    }
    const off = await release();
    ok(`${route} [${r.label}] releases`, !off.on && off.text === 0, `on=${off.on}`);
  }
  // The inheritance contract: a plate whose keys have no target is a plate
  // somebody forgot to register, and it must fail here rather than ship inert.
  want(`${route} keys with no target`, inert.length, NAMES_NOTHING[route] ?? 0);
  ok(`${route} keys that light something`, lit > 0, "none");
}

// ---- the three that are easy to get wrong ----

// 1967 prints one row for two machines, because that is the year they ran in
// step. Getting this wrong is invisible on the strip and obvious on the map.
await open("/then/1967");
await page.locator(".legend .lg-item", { hasText: "East and West" }).first().hover();
want("1967's one row names both machines", await page.evaluate((sel) =>
  [...new Set([...document.querySelectorAll(sel)].map(e => e.dataset.ic))].sort(),
  (await read()).litSelector), ["EASTERN", "WESTERN"]);

// A key that names a hole in the map must not offer itself as one that does
// something: no cursor, no tab stop.
await open("/then/1999");
want("the key for nobody running the traffic stays inert", await page.evaluate(() => {
  const key = [...document.querySelectorAll(".legend .lg-item")]
    .find(e => e.textContent.includes("Nobody running"));
  return { found: !!key, live: key?.hasAttribute("data-lh") ?? null };
}), { found: true, live: false });

// The count a holdings row prints is the count it lights. If `data-sys` and the
// legend's own tally ever read key_rollup differently, "Insull · 412" would
// light some other number of counties and nothing else would say so.
for (const sheetYear of ["1925", "1932"]) {
  await open(`/then/${sheetYear}`);
  const rows = await page.evaluate(() => [...document.querySelectorAll(".legend .lg-item[data-lh]")]
    .map((e, i) => ({ i, text: e.textContent.trim() }))
    .filter(r => /·\s*[\d,]+\s*$/.test(r.text) && !r.text.includes("smaller systems")));
  ok(`${sheetYear} has system rows`, rows.length > 0, "none");
  const bad = [];
  for (const row of rows) {
    await page.locator(".legend .lg-item[data-lh]").nth(row.i).hover();
    const n = await page.evaluate((sel) => document.querySelectorAll(sel).length,
      (await read()).litSelector);
    const printed = Number(/·\s*([\d,]+)\s*$/.exec(row.text)[1].replace(/,/g, ""));
    if (n !== printed) bad.push(`${row.text} lit ${n}`);
  }
  want(`${sheetYear}: every system row lights the number it prints`, bad, []);
}

// The map's own hover must be exactly what it was: the legend borrowed its
// effect, it did not replace it.
await page.goto(`${url}/`, { waitUntil: "networkidle" });
await page.waitForSelector("#g-rto .region", { state: "attached", timeout: 30000 });
const pjmBox = await page.evaluate(() => {
  const pjm = [...document.querySelectorAll("#g-rto .region")].find(p => p.dataset.rto === "PJM");
  const b = pjm.getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
});
await page.mouse.move(pjmBox.x, pjmBox.y);
await page.waitForTimeout(150);
want("pointing at the map still lifts one region", await page.evaluate(() => {
  const svg = document.getElementById("map");
  const hov = [...document.querySelectorAll("#g-rto .region.hov")];
  return {
    hover: svg.classList.contains("has-hover"),
    lifted: hov.length > 0 && hov.every(p => p.dataset.rto === "PJM"),
    legendOff: !svg.classList.contains("has-legend-hover"),
  };
}), { hover: true, lifted: true, legendOff: true });

want("no console errors", noise, []);
await browser.close();
child.kill();
if (failures.length) {
  for (const f of failures) console.error("  " + f);
  throw new Error(`${failures.length} legend assertions failed`);
}
console.log(`\nlegend probe clean`);
