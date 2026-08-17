// Layout audit: drive the real site across viewports and assert the layout
// contract holds. The contract is in styles.css: the page fits the viewport at
// every size, no vertical scroll, panels shrink or collapse rather than overlap.
//
// This exists because eyeballing a screenshot does not catch a 12px overlap or
// an input clipping its last character, and both shipped at least once.
//
// Usage: npm run audit            (serves ./ on a free port, runs headless)
//        npm run audit -- --url https://grid-atlas-coral.vercel.app
//        npm run audit -- --shots  (also write PNGs to tools/shots/)
//
// Auditing a remote --url needs the browser to reach the internet. Behind a
// proxy, set HTTPS_PROXY or pass --proxy; some sandboxes block browser egress
// outright, in which case audit the local server and compare the deployed
// files by checksum instead.

import { createServer } from "http";
import { readFile } from "fs/promises";
import { mkdirSync } from "fs";
import { extname, join, normalize, dirname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const argv = process.argv.slice(2);
const flag = n => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const VIEWPORTS = [
  { name: "phone-small", w: 360, h: 740 },
  { name: "phone", w: 390, h: 844 },
  { name: "phone-landscape", w: 844, h: 390 },
  { name: "tablet", w: 768, h: 1024 },
  { name: "laptop-short", w: 1280, h: 660 },
  { name: "desktop", w: 1500, h: 950 },
];

const VIEWS = [
  { name: "wholesale", q: "?layer=wholesale" },
  { name: "rules", q: "?layer=rules" },
  { name: "wires-land", q: "?layer=wires" },
  { name: "wires-meters", q: "?layer=wires&size=cust" },
  { name: "wires-energy", q: "?layer=wires&size=mwh" },
  { name: "wires-parent", q: "?layer=wires&colour=parent" },
  { name: "wires-outages", q: "?layer=wires&colour=saidi" },
  { name: "wires-solar", q: "?layer=wires&colour=solarw" },
  { name: "wires-smart", q: "?layer=wires&colour=amishare" },
  { name: "wires-solar-size", q: "?layer=wires&size=solarmw" },
  { name: "wires-size-colour", q: "?layer=wires&size=cust&colour=saidi" },
  // Three stats plus a long legend label is the widest the card and the legend
  // ever get, so the combination is worth a viewport of its own.
  { name: "wires-solar-both", q: "?layer=wires&size=solarmw&colour=solarw" },
  { name: "rules-price", q: "?layer=rules&shade=res" },
  { name: "rules-delivery", q: "?layer=rules&shade=delivery" },
  { name: "you", q: "?zip=78701" },
];

// Boxes that must never overlap each other. All of them are chrome floating
// over or beside the map, which is exactly where collisions hide.
const PANELS = {
  legend: "#legend",
  sizeControls: "#size-controls",
  card: "#card",
  zip: "#zip-search",
  rail: "#rail",
  foot: ".foot",
  zoomReset: "#zoom-reset",
  colourControls: "#colour-controls",
  shadeControls: "#shade-controls",
};

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p === "/") p = "/index.html";
      const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ""));
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise(r => server.listen(0, r));
  return { server, url: `http://localhost:${server.address().port}` };
}

const problems = [];
const add = (tag, msg) => problems.push(`${tag}: ${msg}`);

const external = opt("url", null);
const host = external ? { url: external, server: null } : await serve();

// Use a browser that is already on the machine when one is pointed at, rather
// than insisting on Playwright's own download. Set CHROME_PATH, or pass
// --browser, to reuse a system Chromium.
const executablePath = opt("browser", process.env.CHROME_PATH) || undefined;
// Auditing a deployed URL from behind a corporate or sandbox proxy needs the
// browser pointed at it too; node's env vars do not reach Chromium's network
// stack. The local server path never hits this, which is why it went unnoticed.
const proxyServer = opt("proxy", process.env.HTTPS_PROXY || process.env.HTTP_PROXY) || undefined;
let browser;
try {
  browser = await chromium.launch({
    executablePath,
    ...(proxyServer && external ? { proxy: { server: proxyServer } } : {}),
  });
} catch (e) {
  host.server?.close();
  console.error(`could not start a browser: ${e.message.split("\n")[0]}`);
  console.error("run `npx playwright install chromium`, or point at one you have with CHROME_PATH=/path/to/chrome");
  process.exit(2);
}
if (flag("shots")) mkdirSync(join(here, "shots"), { recursive: true });

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  page.on("console", m => m.type() === "error" && errs.push(m.text()));

  for (const view of VIEWS) {
    const tag = `${vp.name}/${view.name}`;
    await page.goto(host.url + "/" + view.q, { waitUntil: "networkidle" });
    // the wires layer lazy-loads 5.5MB of geometry and then tweens
    await page.waitForTimeout(view.name.startsWith("wires") ? 2600 : 1200);

    const r = await page.evaluate(panels => {
      const de = document.documentElement;
      const vw = de.clientWidth, vh = de.clientHeight;
      const out = { scrollX: de.scrollWidth - vw, scrollY: de.scrollHeight - vh, offscreen: [], overlaps: [], tiny: [], clipped: [] };

      const boxes = {};
      for (const [k, sel] of Object.entries(panels)) {
        const el = document.querySelector(sel);
        if (!el || el.hasAttribute("hidden")) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        boxes[k] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
        if (b.right > vw + 1 || b.left < -1 || b.bottom > vh + 1 || b.top < -1)
          out.offscreen.push(`${k} ${JSON.stringify(boxes[k])} in ${vw}x${vh}`);
      }
      const keys = Object.keys(boxes);
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
        const a = boxes[keys[i]], c = boxes[keys[j]];
        const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
        const oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
        if (ox > 4 && oy > 4) out.overlaps.push(`${keys[i]} x ${keys[j]} by ${ox}x${oy}px`);
      }

      // Chrome must not bury the map. The overlap checks above only compare
      // chrome to chrome, so a control stack sitting on top of the map passed
      // clean while covering two thirds of it on a real phone.
      const svg = document.getElementById("map");
      if (svg && !svg.hasAttribute("hidden")) {
        const panel = document.querySelector(".map-panel").getBoundingClientRect();
        const sb = svg.getBoundingClientRect();
        // the svg itself has to fit its panel, or the map is clipped
        if (sb.height > panel.height + 2 || sb.width > panel.width + 2)
          out.mapClipped = `svg ${Math.round(sb.width)}x${Math.round(sb.height)} exceeds panel ${Math.round(panel.width)}x${Math.round(panel.height)}`;
        // the drawn map letterboxes inside the svg; compare against that, not
        // the element, or the empty margins forgive real coverage
        const vb = svg.viewBox.baseVal;
        const scale = Math.min(sb.width / vb.width, sb.height / vb.height);
        const drawn = {
          x: sb.x + (sb.width - vb.width * scale) / 2,
          y: sb.y + (sb.height - vb.height * scale) / 2,
          w: vb.width * scale,
          h: vb.height * scale,
        };
        const area = drawn.w * drawn.h;
        let covered = 0;
        for (const sel of [".map-ui", "#zip-search", "#zoom-reset"]) {
          const el = document.querySelector(sel);
          if (!el || el.hasAttribute("hidden") || getComputedStyle(el).display === "none") continue;
          const b = el.getBoundingClientRect();
          const ox = Math.min(b.right, drawn.x + drawn.w) - Math.max(b.x, drawn.x);
          const oy = Math.min(b.bottom, drawn.y + drawn.h) - Math.max(b.y, drawn.y);
          if (ox > 0 && oy > 0) covered += ox * oy;
        }
        out.mapCovered = area > 0 ? Math.round((covered / area) * 100) : 0;
        out.mapDrawn = `${Math.round(drawn.w)}x${Math.round(drawn.h)}`;
      }

      // tap targets a thumb can actually hit
      for (const el of document.querySelectorAll("button, .step, input")) {
        const b = el.getBoundingClientRect();
        if (b.height > 0 && b.height < 28) out.tiny.push(`${el.id || el.className || el.tagName} ${Math.round(b.height)}px`);
      }

      // content wider than its own box: an input that clips its value, a
      // button whose label is cut off. scrollWidth beats a visual check.
      for (const el of document.querySelectorAll("input, button, .sz-btn, .lg-item")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.overflow === "auto" || cs.overflow === "scroll") continue;
        if (el.scrollWidth - el.clientWidth > 2)
          out.clipped.push(`${el.id || el.className || el.tagName} content ${el.scrollWidth}px in ${el.clientWidth}px`);
      }
      return out;
    }, PANELS);

    if (r.mapClipped) add(tag, `map clipped: ${r.mapClipped}`);
    // A little overlap is the design: the legend deliberately sits over ocean.
    // A quarter of the map is not.
    if (r.mapCovered > 22) add(tag, `chrome covers ${r.mapCovered}% of the drawn map (${r.mapDrawn})`);
    if (r.scrollX > 1) add(tag, `horizontal scroll ${r.scrollX}px`);
    if (r.scrollY > 1) add(tag, `vertical scroll ${r.scrollY}px (the page must fit the viewport)`);
    for (const s of r.offscreen) add(tag, `offscreen ${s}`);
    for (const s of r.overlaps) add(tag, `overlap ${s}`);
    for (const s of new Set(r.tiny)) add(tag, `tap target ${s}`);
    for (const s of new Set(r.clipped)) add(tag, `clipped ${s}`);
    if (errs.length) { add(tag, `${errs.length} console errors, first: ${errs[0]}`); errs.length = 0; }

    if (flag("shots")) await page.screenshot({ path: join(here, "shots", `${vp.name}-${view.name}.png`) });
  }
  await page.close();
}

await browser.close();
host.server?.close();

const checks = VIEWPORTS.length * VIEWS.length;
if (problems.length) {
  console.error(`layout audit: ${problems.length} problems across ${checks} viewport/view combinations\n`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`layout audit: ${checks} viewport/view combinations clean`);
