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
const url = `http://localhost:${port}`;
const child = spawn("npx", ["next", "start", "-p", String(port)], { stdio: "ignore" });
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
