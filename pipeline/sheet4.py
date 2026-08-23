#!/usr/bin/env python3
"""Contact sheet of per-county plate windows, for reading a whole state county by county.

Each cell is a square of plate pixels centred on the county's deepest interior
point, sized to the county but capped, drawn at a fixed zoom so cells from
different counties are directly comparable. A thin frame marks how much of the
window is actually inside the county: full frame means the window fits, dashed
corners mean the window spills into neighbours and the read may be a straddle.

  python3 sheet4.py OH --page 0
  python3 sheet4.py OH --fips 39095,39173 --zoom 10
"""
import argparse, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "lib"))
import map4_raster as R

STATE_FIPS = {
    "AL": "01", "AZ": "04", "AR": "05", "CA": "06", "CO": "08", "CT": "09",
    "DE": "10", "DC": "11", "FL": "12", "GA": "13", "ID": "16", "IL": "17",
    "IN": "18", "IA": "19", "KS": "20", "KY": "21", "LA": "22", "ME": "23",
    "MD": "24", "MA": "25", "MI": "26", "MN": "27", "MS": "28", "MO": "29",
    "MT": "30", "NE": "31", "NV": "32", "NH": "33", "NJ": "34", "NM": "35",
    "NY": "36", "NC": "37", "ND": "38", "OH": "39", "OK": "40", "OR": "41",
    "PA": "42", "RI": "44", "SC": "45", "SD": "46", "TN": "47", "TX": "48",
    "UT": "49", "VT": "50", "VA": "51", "WA": "53", "WV": "54", "WI": "55",
    "WY": "56",
}


def centres(fipses, maxside):
    from scipy import ndimage
    out = {}
    m = R.masks(2)
    for f in fipses:
        e = m.get(f)
        if e is None:
            continue
        (sy, sx), sub = e
        if not sub.any():
            continue
        dt = ndimage.distance_transform_edt(sub)
        iy, ix = np.unravel_index(int(np.argmax(dt)), dt.shape)
        out[f] = (ix + sx.start, iy + sy.start, float(dt[iy, ix]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("state", nargs="?")
    ap.add_argument("--fips")
    ap.add_argument("--zoom", type=int, default=6)
    ap.add_argument("--side", type=int, default=56)
    ap.add_argument("--cols", type=int, default=5)
    ap.add_argument("--rows", type=int, default=4)
    ap.add_argument("--page", type=int, default=0)
    ap.add_argument("--all", action="store_true", help="write every page")
    ap.add_argument("--out")
    a = ap.parse_args()

    uni = json.loads((HERE / "lib" / "counties-conus-fips.json").read_text())["fips"]
    if a.fips:
        fipses = a.fips.split(",")
        tag = "sel"
    else:
        fipses = [f for f in uni if f.startswith(STATE_FIPS[a.state.upper()])]
        tag = a.state.lower()
    cen = centres(fipses, a.side)
    g = R.gray()
    im = Image.fromarray(np.clip(g, 0, 255).astype(np.uint8))
    per = a.cols * a.rows
    pages = range((len(fipses) + per - 1) // per) if a.all else [a.page]
    cell = a.side * a.zoom
    font = ImageFont.load_default(size=max(13, a.zoom * 3))
    written = []
    for p in pages:
        chunk = fipses[p * per:(p + 1) * per]
        if not chunk:
            continue
        rows = (len(chunk) + a.cols - 1) // a.cols
        sheet = Image.new("L", (a.cols * (cell + 8), rows * (cell + 22)), 255)
        d = ImageDraw.Draw(sheet)
        for i, f in enumerate(chunk):
            cx0 = (i % a.cols) * (cell + 8)
            cy0 = (i // a.cols) * (cell + 22)
            if f not in cen:
                d.text((cx0 + 4, cy0 + 4), f + " (no geometry)", fill=0, font=font)
                continue
            x, y, r = cen[f]
            h = a.side // 2
            crop = im.crop((x - h, y - h, x + h, y + h)).resize((cell, cell), Image.LANCZOS)
            sheet.paste(crop, (cx0, cy0 + 20))
            fits = r >= h
            d.text((cx0 + 4, cy0 + 3), "%s r%d%s" % (f, int(r), "" if fits else " *"),
                   fill=0, font=font)
            d.rectangle([cx0, cy0 + 20, cx0 + cell - 1, cy0 + cell + 19],
                        outline=0 if fits else 128)
        out = a.out or f"sheet-{tag}-{p}.png"
        sheet.save(HERE / "data-raw" / "map4-crops" / out)
        written.append((out, sheet.size, len(chunk)))
    for o, s, n in written:
        print(o, s, n)
    print("pages", (len(fipses) + per - 1) // per, "counties", len(fipses))


if __name__ == "__main__":
    main()
