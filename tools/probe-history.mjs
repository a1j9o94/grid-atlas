// Assert the seam plates render what they claim, in a browser, on the built
// site. The layout audit proves nothing overlaps; this proves the map says the
// right thing.
//
// It exists because every one of these behaviours was wrong at least once
// during the build: the Western grid kept its own colour on a plate that says
// East and West ran as one machine, the seam line drew at the same weight on
// the plate whose whole point is that nothing crosses it, and the hover card
// counted three machines in a year when there were two.
//
// Usage: node tools/probe-history.mjs [--browser <chrome>] [--port 3451]
import { spawn } from "child_process";
import { chromium } from "playwright";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const port = Number(arg("port", "3451"));
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

const read = () => page.evaluate(() => {
  const style = (sel, prop) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el)[prop] : null;
  };
  return {
    regions: document.querySelectorAll("#g-seam .sm-region").length,
    lines: document.querySelectorAll("#g-seam-lines .sm-line").length,
    east: style('.sm-region[data-ic="EASTERN"]', "fill"),
    west: style('.sm-region[data-ic="WESTERN"]', "fill"),
    ewWidth: style('.sm-line[data-seam="ew"]', "strokeWidth"),
    ewDash: style('.sm-line[data-seam="ew"]', "strokeDasharray"),
    dotsHidden: document.getElementById("g-time-marks")?.hasAttribute("hidden"),
  };
});
const hoverKicker = (ic) => page.evaluate((i) => {
  document.querySelector(`.sm-region[data-ic="${i}"]`)
    ?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  return new Promise(r => setTimeout(
    () => r(document.querySelector(".card .c-kicker")?.textContent), 150));
}, ic);

const open = async (frame) => {
  await page.goto(`${url}/then/${frame}`, { waitUntil: "networkidle" });
  // attached, not visible: an SVG path inside a filtered group is present the
  // moment it is appended, and waiting for visibility here is what made this
  // probe flaky under load.
  await page.waitForSelector("#g-seam .sm-region", { state: "attached", timeout: 30000 });
  return read();
};

// FTC Map III: every county-equivalent must be present, and the five explicit
// trace states must survive the JSON-to-DOM boundary. This is deliberately an
// exact count: silently dropping one tiny independent city is still data loss.
await page.goto(`${url}/then/1925`, { waitUntil: "networkidle" });
await page.waitForFunction(
  () => document.querySelectorAll("#g-holdings .holdings-county").length === 3108,
  null, { timeout: 30000 });
const holdings = await page.evaluate(() => ({
  total: document.querySelectorAll("#g-holdings .holdings-county").length,
  exact: document.querySelectorAll("#g-holdings .holdings-exact").length,
  maybe: document.querySelectorAll("#g-holdings .holdings-maybe").length,
  amb: document.querySelectorAll("#g-holdings .holdings-amb").length,
  unknown: document.querySelectorAll("#g-holdings .holdings-unknown").length,
  none: document.querySelectorAll("#g-holdings .holdings-none").length,
  visible: !document.getElementById("g-holdings")?.hasAttribute("hidden"),
  dotsHidden: document.getElementById("g-time-marks")?.hasAttribute("hidden"),
  pending: document.querySelector('.tl-stop[aria-pressed="true"]')?.hasAttribute("data-pending"),
  legend: document.getElementById("legend")?.textContent?.replace(/\s+/g, " ").trim(),
}));
want("1925 draws every county once", holdings.total, 3108);
want("1925 preserves exact/maybe/amb/unknown/none",
  [holdings.exact, holdings.maybe, holdings.amb, holdings.unknown, holdings.none],
  [1329, 57, 215, 334, 1173]);
want("1925 holdings visible and city dots hidden", [holdings.visible, holdings.dotsHidden], [true, true]);
want("1925 is shipped, not pending", holdings.pending, false);
// The legend used to list five confidence states and name no company, while the counties
// under it were coloured by company. Assert the fix rather than the old wording: it names
// the systems, biggest first, and still says the colour is ours and not the plate's.
want("1925 legend names the biggest system", holdings.legend?.includes("Insull"), true);
want("1925 legend says the colour is not the plate's",
  holdings.legend?.includes("monochrome"), true);

// Cook County is a release anchor. Picking it must name both the county and
// the printed system, proving geometry, trace, legend and card are joined.
await page.locator('.holdings-county[data-fips="17031"]').dispatchEvent("mouseover");
await page.waitForTimeout(100);
want("Cook County pick names the county", await page.locator(".card h3").textContent(), "Cook · IL");
want("Cook County pick names Insull", await page.evaluate(() => {
  const one = document.querySelector(".card .c-choice")?.textContent ?? "";
  const many = [...document.querySelectorAll(".card .c-year dd")].map((d) => d.textContent ?? "");
  return one.includes("Insull") || many.some((t) => t.includes("Insull"));
}), true);

// The two sheets are two plates on the timeline, not one plate with a switch inside it.
// There used to be a 1930 plate carrying both, which put two controls on screen doing the
// same job and dated the plate to a year neither sheet was printed in.
want("the source-plate switch is gone",
  await page.evaluate(() => document.getElementById("holdings-years") === null), true);

// The guard that keeps a half-read year off the site: a holdings plate may only draw a
// year the artifact itself calls `complete`. A denylist on `not-built` used to sit here and
// it admitted `in-progress`, which is what a trace reads while it is being worked, so the
// map would have drawn the eastern two thirds and left the west silently blank.
const sheets = await page.evaluate(async () => {
  const f = await fetch("/data/timeline/holdings-1925.json").then((r) => r.json());
  const t = await fetch("/data/timeline.json").then((r) => r.json());
  return {
    status: f.meta.trace_status ?? {},
    years: Object.keys(f.years ?? {}),
    drawn: t.frames.filter((x) => x.geometry?.kind === "holdings").map((x) => x.geometry.year),
  };
});
const complete = Object.entries(sheets.status)
  .filter(([, v]) => v === "complete").map(([k]) => k).sort();
want("every holdings plate names a sheet", sheets.drawn.every((y) => typeof y === "string"), true);
want("every sheet drawn is complete in the artifact", sheets.drawn.slice().sort(), complete);
want("every year in the file is accounted for by a status",
  sheets.years.every((y) => y in sheets.status), true);

// The later sheet is its own plate and draws its own trace.
await page.goto(`${url}/then/1932`, { waitUntil: "networkidle" });
await page.waitForFunction(
  () => document.querySelectorAll("#g-holdings .holdings-county").length === 3108,
  null, { timeout: 30000 });
const m4 = await page.evaluate(() => ({
  total: document.querySelectorAll("#g-holdings .holdings-county").length,
  exact: document.querySelectorAll("#g-holdings .holdings-exact").length,
  maybe: document.querySelectorAll("#g-holdings .holdings-maybe").length,
  amb: document.querySelectorAll("#g-holdings .holdings-amb").length,
  unknown: document.querySelectorAll("#g-holdings .holdings-unknown").length,
  none: document.querySelectorAll("#g-holdings .holdings-none").length,
  year: document.getElementById("g-holdings")?.dataset.year,
  // Colour is the whole claim of this layer: it says WHO, not merely that someone was
  // there. Half of this sheet drew grey once, because the colour table only carried Map
  // III's twenty keys and Map IV names systems Map III does not.
  coloured: [...document.querySelectorAll("#g-holdings .holdings-county")]
    .filter((e) => e.style.getPropertyValue("--holding-fill") !== "").length,
}));
want("1932 draws every county once", m4.total, 3108);
want("1932 preserves exact/maybe/amb/unknown/none",
  [m4.exact, m4.maybe, m4.amb, m4.unknown, m4.none], [2094, 143, 376, 300, 195]);
want("the drawn sheet follows the plate", m4.year, "1932");
// Every county with a named system carries a colour. The only ones without are the
// counties whose hatch is filled but unreadable, which have no system to colour by.
want("every named county is coloured", m4.coloured, m4.total - m4.none - m4.unknown);

// A link to the old combined plate has to land somewhere honest rather than 404. The
// trace is lazy-loaded, so wait for the paint rather than for the network to fall quiet.
await page.goto(`${url}/then/1930`, { waitUntil: "networkidle" });
await page.waitForFunction(
  () => document.getElementById("g-holdings")?.dataset.year !== undefined,
  null, { timeout: 30000 });
want("an old 1930 link still lands on the earlier sheet",
  await page.evaluate(() => document.getElementById("g-holdings")?.dataset.year), "1925");

// Stepping between the sheets must repaint, never rebuild: a county that does not change
// between them has to stay the same element or the map shifts under the reader.
const before = await page.evaluate(() =>
  document.querySelector("#g-holdings .holdings-county")?.getAttribute("d"));
await page.goto(`${url}/then/1932`, { waitUntil: "networkidle" });
await page.waitForFunction(
  () => document.getElementById("g-holdings")?.dataset.year === "1932",
  null, { timeout: 30000 });
const after = await page.evaluate(() => ({
  d: document.querySelector("#g-holdings .holdings-county")?.getAttribute("d"),
  count: document.querySelectorAll("#g-holdings .holdings-county").length,
}));
want("the county mesh is the same geometry on both sheets", after.d, before);
want("switching sheet keeps every county", after.count, 3108);

// Leaving the plate in-app must hide it without destroying it; stepping back
// reuses the already-built paths and never duplicates the county mesh.
const clickStop = async (label) => {
  const stop = page.locator(".tl-stop").filter({ hasText: label });
  await stop.click();
  await page.waitForFunction((text) => {
    const active = document.querySelector('.tl-stop[aria-pressed="true"]');
    return active?.textContent?.includes(text);
  }, label);
};
await clickStop("1935");
want("1935 hides holdings", await page.evaluate(
  () => document.getElementById("g-holdings")?.hasAttribute("hidden")), true);
await clickStop("1932");
await page.waitForFunction(
  () => document.querySelectorAll("#g-holdings .holdings-county").length === 3108);
want("returning to a sheet reuses one county mesh", await page.evaluate(
  () => document.querySelectorAll("#g-holdings .holdings-county").length), 3108);
await page.locator("#rail .step").first().click();
want("leaving History hides holdings", await page.evaluate(
  () => document.getElementById("g-holdings")?.hasAttribute("hidden")), true);

// Three machines, two boundaries, on every seam plate. The dots belong to 1900.
for (const frame of ["1935", "1967", "1975"]) {
  const s = await open(frame);
  want(`${frame} regions and lines`, [s.regions, s.lines, s.dotsHidden], [3, 2, true]);
}

// 1967: they ran in step, so one colour and a broken line where the divide was.
const y1967 = await open("1967");
want("1967 East and West share a fill", y1967.east === y1967.west, true);
want("1967 the divide is broken", y1967.ewDash !== "none", true);
want("1967 counts two machines", await hoverKicker("WESTERN"), "one of two, this year");

// 1975: three machines again, and the seam is the heaviest mark on the plate.
const y1975 = await open("1975");
want("1975 East and West differ", y1975.east !== y1975.west, true);
want("1975 the seam is solid", y1975.ewDash, "none");
want("1975 the seam is emphasised",
  Number.parseFloat(y1975.ewWidth) > Number.parseFloat(y1967.ewWidth), true);
want("1975 counts three machines", await hoverKicker("EASTERN"), "one of three");

// 1935: Texas is the subject, so its boundary carries the weight, not the seam.
const y1935 = await open("1935");
want("1935 does not emphasise the East-West seam",
  Number.parseFloat(y1935.ewWidth) < Number.parseFloat(y1975.ewWidth), true);

// The membership plates. Their argument is that a reader can follow one colour
// across four plates, so the check is that a market keeps its fill and that the
// footprints grow in the direction history went.
const msRead = (frame) => page.goto(`${url}/then/${frame}`, { waitUntil: "networkidle" })
  .then(() => page.waitForSelector("#g-membership .ms-region", { state: "attached", timeout: 30000 }))
  .then(() => page.evaluate(() => {
    const paths = [...document.querySelectorAll("#g-membership .ms-region")];
    const fill = (m) => {
      const el = paths.find((p) => p.dataset.market === m);
      return el ? getComputedStyle(el).fill : null;
    };
    return {
      markets: [...new Set(paths.map((p) => p.dataset.market))].sort(),
      pjm: fill("PJM"),
      seamHidden: document.getElementById("g-seam")?.hasAttribute("hidden"),
    };
  }));

const y1999 = await msRead("1999");
want("1999 draws the five referees and nothing else", y1999.markets,
  ["CAISO", "ERCOT", "ISONE", "NYISO", "PJM"]);
want("1999 hides the seam", y1999.seamHidden, true);
const y2005 = await msRead("2005");
want("2005 draws all seven", y2005.markets,
  ["CAISO", "ERCOT", "ISONE", "MISO", "NYISO", "PJM", "SPP"]);
const y2014 = await msRead("2014");
want("2014 draws all seven", y2014.markets,
  ["CAISO", "ERCOT", "ISONE", "MISO", "NYISO", "PJM", "SPP"]);
want("PJM keeps one colour across the three plates",
  new Set([y1999.pjm, y2005.pjm, y2014.pjm]).size, 1);
// Today reuses the wholesale layer's own marks, so its PJM has to be that same
// colour or the whole continuity argument breaks at the last plate.
await page.goto(`${url}/then/2026`, { waitUntil: "networkidle" });
await page.waitForSelector("#g-rto .region", { state: "attached", timeout: 30000 });
want("Today's PJM is the same colour", await page.evaluate(() => {
  const el = [...document.querySelectorAll("#g-rto .region")].find((p) => p.dataset.rto === "PJM");
  return el ? getComputedStyle(el).fill : null;
}), y2014.pjm);
want("membership is hidden on Today", await page.evaluate(
  () => document.getElementById("g-membership")?.hasAttribute("hidden")), true);

// A retired year still has to land somewhere honest. The scrubber only exists
// once timeline.json has arrived, so wait for a pressed stop rather than for
// the network to go quiet: networkidle can land before React has rendered it.
await page.goto(`${url}/then/1941`, { waitUntil: "networkidle" });
await page.waitForSelector('.tl-stop[aria-pressed="true"]', { timeout: 30000 });
want("1941 snaps to the plate at or before it", await page.evaluate(
  () => document.querySelector('.tl-stop[aria-pressed="true"]')?.textContent?.trim()), "1935");

want("no console errors", noise, []);
await browser.close();
child.kill();
if (failures.length) {
  for (const f of failures) console.error("  " + f);
  throw new Error(`${failures.length} history-layer assertions failed`);
}
console.log(`\nhistory probe clean`);
