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
