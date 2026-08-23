// Build the 1900 city-dot set for the timeline's first plate.
//
// The rule is stated rather than curated: the 50 largest urban places of the
// 1900 Census, plus a short list of small places that were firsts. A hand-picked
// set was the first attempt and it was wrong in a way that only shows up when
// somebody compares two dots. It reached down to Salt Lake City at rank 70 while
// skipping 34 larger cities, so a reader sizing dots against each other would
// have concluded Salt Lake City mattered more than Oakland in 1900. It did not.
// A stated rule cannot fail that way.
//
// Populations come from the Census table, never from typing. Coordinates are the
// one hand-maintained input, and they are the safe one: a misplaced dot is
// visible on the map, while a mistyped population is invisible and still wrong.
//
// Usage: node 11-build-timeline-dots.mjs [--out ../../../../grid-atlas/data/timeline.json]

import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const TABLE_URL = "https://www2.census.gov/library/working-papers/1998/demo/pop-twps0027/tab13.txt";
const CACHE = join(here, "data-raw", "census-1900-tab13.txt");
// Six levels up is the workspace root, where the grid-atlas checkout sits
// beside light-workspace. Override with --out for any other layout.
const OUT = resolve(opt("out", join(here, "../../../../../../grid-atlas/data/timeline.json")));
const TOP_N = 50;

// City centres, [lon, lat]. Only the 50 the table selects need an entry; the
// build fails loudly on a missing one rather than dropping a city quietly.
const COORDS = {
  "New York, NY": [-74.006, 40.713], "Chicago, IL": [-87.632, 41.884],
  "Philadelphia, PA": [-75.165, 39.953], "St. Louis, MO": [-90.199, 38.627],
  "Boston, MA": [-71.058, 42.360], "Baltimore, MD": [-76.612, 39.290],
  "Cleveland, OH": [-81.694, 41.499], "Buffalo, NY": [-78.878, 42.886],
  "San Francisco, CA": [-122.419, 37.775], "Cincinnati, OH": [-84.512, 39.103],
  "Pittsburgh, PA": [-79.996, 40.441], "New Orleans, LA": [-90.071, 29.951],
  "Detroit, MI": [-83.046, 42.331], "Milwaukee, WI": [-87.906, 43.039],
  "Washington, DC": [-77.037, 38.907], "Newark, NJ": [-74.172, 40.736],
  "Jersey City, NJ": [-74.078, 40.728], "Louisville, KY": [-85.759, 38.253],
  "Minneapolis, MN": [-93.265, 44.978], "Providence, RI": [-71.413, 41.824],
  "Indianapolis, IN": [-86.158, 39.769], "Kansas City, MO": [-94.579, 39.100],
  "St. Paul, MN": [-93.090, 44.954], "Rochester, NY": [-77.611, 43.161],
  "Denver, CO": [-104.990, 39.739], "Toledo, OH": [-83.555, 41.654],
  // Allegheny was its own city in 1900 and was annexed by Pittsburgh in 1907.
  // Drawn separately because this plate is 1900, with a note on its card.
  "Allegheny, PA": [-80.010, 40.452], "Columbus, OH": [-82.999, 39.961],
  "Worcester, MA": [-71.802, 42.263], "Syracuse, NY": [-76.147, 43.048],
  "New Haven, CT": [-72.928, 41.308], "Paterson, NJ": [-74.172, 40.917],
  "Fall River, MA": [-71.155, 41.701], "St. Joseph, MO": [-94.847, 39.768],
  "Omaha, NE": [-95.934, 41.257], "Los Angeles, CA": [-118.243, 34.052],
  "Memphis, TN": [-90.049, 35.150], "Scranton, PA": [-75.664, 41.409],
  "Lowell, MA": [-71.316, 42.633], "Albany, NY": [-73.756, 42.652],
  "Cambridge, MA": [-71.106, 42.375], "Portland, OR": [-122.676, 45.523],
  "Atlanta, GA": [-84.388, 33.749], "Grand Rapids, MI": [-85.668, 42.963],
  "Dayton, OH": [-84.192, 39.759], "Richmond, VA": [-77.436, 37.541],
  "Nashville, TN": [-86.784, 36.163], "Seattle, WA": [-122.332, 47.606],
  "Hartford, CT": [-72.685, 41.764], "Reading, PA": [-75.926, 40.336],
};

// Small places that earn a dot for what happened there, not for their size.
// Each one is an event in the copy deck, and the map marks it differently.
const STORY_DOTS = [
  { city: "Appleton", state: "WI", lonlat: [-88.417, 44.262], pop1900: 15085, story: "appleton-1882" },
  { city: "Great Barrington", state: "MA", lonlat: [-73.362, 42.196], pop1900: 5854, story: "great-barrington-1886" },
  { city: "Telluride", state: "CO", lonlat: [-107.812, 37.937], pop1900: 2446, story: "telluride-1891" },
  { city: "Niagara Falls", state: "NY", lonlat: [-79.041, 43.094], pop1900: 19457, story: "niagara-buffalo-1896" },
];
// The largest city in the country is also where the first station opened.
const STORY_ON_TOP50 = { "New York, NY": "pearl-street-1882" };

// A line on the card for a city whose dot needs explaining. Allegheny sits
// almost exactly on top of Pittsburgh, which is correct and looks like a bug
// until you know why, so the card says why.
const NOTES = {
  "Allegheny, PA": "The 27th largest city in the country, and today it is Pittsburgh's North Side. Pittsburgh annexed it in 1907 over the objections of its own voters.",
  "Cambridge, MA": "Boston, Cambridge, Somerville and Lynn are four separate cities on this map because they were four separate cities, each buying its own light.",
};

async function table() {
  if (existsSync(CACHE)) return readFile(CACHE, "utf8");
  const r = await fetch(TABLE_URL);
  if (!r.ok) throw new Error(`census table fetch failed: ${r.status}`);
  return r.text();
}

// Two columns per line: ranks 1-50 on the left, 51-100 on the right. Only the
// left half is ever needed, but both are parsed so the rank total can be
// checked: a layout change that silently halved the table would otherwise pass.
function parse(txt) {
  const rows = [];
  const re = /(\d{1,3})\s+([A-Za-z][A-Za-z .'-]*?)\s+city,?\s+([A-Z]{2})\s*\*?\.+\s*([\d,]+)/g;
  for (const m of txt.matchAll(re)) {
    rows.push({ rank: +m[1], city: m[2].trim(), state: m[3], pop1900: +m[4].replace(/,/g, "") });
  }
  return rows.sort((a, b) => a.rank - b.rank);
}

const rows = parse(await table());
if (rows.length !== 100) throw new Error(`expected 100 urban places, parsed ${rows.length}`);
if (rows[0].pop1900 !== 3437202) throw new Error(`rank 1 should be New York at 3,437,202, got ${rows[0].pop1900}`);

const top = rows.slice(0, TOP_N);
const missing = top.map(r => `${r.city}, ${r.state}`).filter(k => !COORDS[k]);
if (missing.length) throw new Error(`no coordinates for: ${missing.join("; ")}`);

const dots = [
  ...top.map(r => {
    const key = `${r.city}, ${r.state}`;
    const story = STORY_ON_TOP50[key];
    return {
      city: r.city, state: r.state, lonlat: COORDS[key], pop1900: r.pop1900, rank: r.rank,
      ...(story ? { story } : {}), ...(NOTES[key] ? { note: NOTES[key] } : {}),
    };
  }),
  ...STORY_DOTS,
];

const doc = JSON.parse(await readFile(OUT, "utf8"));
doc.dots = dots;
doc.meta.dots_note =
  `The ${TOP_N} largest urban places of the 1900 Census, every one of which had central-station service, ` +
  `plus four small places that were firsts. Populations are read from the Census table, not transcribed. ` +
  `Generated by pipeline/11-build-timeline-dots.mjs.`;
doc.meta.dots_source = TABLE_URL;
await writeFile(OUT, JSON.stringify(doc, null, 2) + "\n");

console.log(`parsed ${rows.length} urban places; wrote ${dots.length} dots (${top.length} by size, ${STORY_DOTS.length} by story)`);
console.log(`largest ${top[0].city} ${top[0].pop1900.toLocaleString()}, smallest by size ${top[top.length - 1].city} ${top[top.length - 1].pop1900.toLocaleString()}`);
console.log(`-> ${OUT}`);
