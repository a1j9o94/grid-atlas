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
await page.goto(`${url}/then/1930`, { waitUntil: "networkidle" });
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
want("1930 draws every county once", holdings.total, 3108);
want("1930 preserves exact/maybe/amb/unknown/none",
  [holdings.exact, holdings.maybe, holdings.amb, holdings.unknown, holdings.none],
  [1329, 57, 215, 334, 1173]);
want("1930 holdings visible and city dots hidden", [holdings.visible, holdings.dotsHidden], [true, true]);
want("1930 is shipped, not pending", holdings.pending, false);
want("1930 legend explains source colour", holdings.legend?.includes("source plate is monochrome"), true);

// Cook County is a release anchor. Picking it must name both the county and
// the printed system, proving geometry, trace, legend and card are joined.
await page.locator('.holdings-county[data-fips="17031"]').dispatchEvent("mouseover");
await page.waitForTimeout(100);
want("Cook County pick names the county", await page.locator(".card h3").textContent(), "Cook · IL");
want("Cook County pick names Insull", await page.locator(".card .c-choice").textContent(), "Insull Interests");

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
await clickStop("1930");
await page.waitForFunction(
  () => document.querySelectorAll("#g-holdings .holdings-county").length === 3108);
want("returning to 1930 reuses one county mesh", await page.evaluate(
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
