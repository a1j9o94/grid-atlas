// Minimal xlsx reader, shared by the EIA-861 build steps.
//
// An xlsx is a zip of XML, and these EIA files are machine-generated and flat,
// so a real spreadsheet library would be a dependency we do not need. Cell
// positions come from the r="B12" reference rather than document order, because
// empty cells are simply omitted and counting siblings would silently shift
// columns.

import { execSync } from "child_process";

const XML_ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescapeXml = s =>
  s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(parseInt(e[1] === "x" ? e.slice(2) : e.slice(1), e[1] === "x" ? 16 : 10));
    return XML_ENT[e] ?? m;
  });

// "AB12" -> 27. Letters only; the row number is ignored.
function colIndex(ref) {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

export function readSheet(xlsxPath) {
  const entry = p => execSync(`unzip -p "${xlsxPath}" "${p}"`, { maxBuffer: 1 << 28 }).toString("utf8");

  // shared strings: one <si> per string, possibly split across rich-text runs
  const strings = [];
  try {
    const xml = entry("xl/sharedStrings.xml");
    for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\s*\/>/g)) {
      const body = m[1] ?? "";
      let s = "";
      for (const t of body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) s += t[1];
      strings.push(unescapeXml(s));
    }
  } catch {
    /* a sheet with no strings is legal */
  }

  const sheet = entry("xl/worksheets/sheet1.xml");
  const rows = [];
  for (const rm of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1] || "";
      const body = cm[2] ?? "";
      const ref = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
      const type = (attrs.match(/\bt="([^"]+)"/) || [])[1];
      let val = "";
      if (type === "inlineStr") {
        for (const t of body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) val += t[1];
        val = unescapeXml(val);
      } else {
        const v = body.match(/<v>([\s\S]*?)<\/v>/);
        if (v) val = type === "s" ? strings[Number(v[1])] ?? "" : unescapeXml(v[1]);
      }
      const at = ref ? colIndex(ref) : cells.length;
      while (cells.length < at) cells.push("");
      cells[at] = val;
    }
    rows.push(cells);
  }
  return rows;
}

// EIA writes "." for "not applicable" and leaves genuinely absent numbers blank.
// Both mean no data, and neither means zero.
export const num = v => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || s === "." || s === "NA") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// Fetch the EIA-861 zip once and extract the sheets a step needs.
export async function ensureEia861(year, rawDir, files) {
  const { existsSync, writeFileSync, statSync } = await import("fs");
  const { join } = await import("path");
  const url = `https://www.eia.gov/electricity/data/eia861/zip/f861${year}.zip`;
  const zipPath = join(rawDir, `f861${year}.zip`);
  if (!existsSync(zipPath)) {
    console.log(`fetching ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`EIA-861 ${year} fetch failed: ${res.status}`);
    writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  }
  for (const f of files) execSync(`unzip -o -q "${zipPath}" "${f}" -d "${rawDir}"`);
  return { zipPath, url, sizeMb: statSync(zipPath).size / 1048576 };
}
