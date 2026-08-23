#!/usr/bin/env python3
"""Tracing aids for Map IV (1932). Renders plate crops with the county mesh and
reports per-county texture statistics. It does not classify anything.

  python3 20-trace-map4.py crop IL IN            # one image per state
  python3 20-trace-map4.py crop IL --zoom 3      # upscaled for close looking
  python3 20-trace-map4.py measure IL            # per-county ink / radon / stroke
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
RAW = HERE / "data-raw"
LIB = HERE / "lib"
sys.path.insert(0, str(LIB))
import plate_geo as geo          # noqa: E402
import plate_measure as pm       # noqa: E402

STATE_FIPS = {
    "AL": "01", "AZ": "04", "AR": "05", "CA": "06", "CO": "08",
    "CT": "09", "DE": "10", "DC": "11", "FL": "12", "GA": "13",
    "ID": "16", "IL": "17", "IN": "18", "IA": "19", "KS": "20",
    "KY": "21", "LA": "22", "ME": "23", "MD": "24", "MA": "25",
    "MI": "26", "MN": "27", "MS": "28", "MO": "29", "MT": "30",
    "NE": "31", "NV": "32", "NH": "33", "NJ": "34", "NM": "35",
    "NY": "36", "NC": "37", "ND": "38", "OH": "39", "OK": "40",
    "OR": "41", "PA": "42", "RI": "44", "SC": "45", "SD": "46",
    "TN": "47", "TX": "48", "UT": "49", "VT": "50", "VA": "51",
    "WA": "53", "WV": "54", "WI": "55", "WY": "56",
}

_cache = {}


def georef():
    if "g" not in _cache:
        g = json.loads((LIB / "ftc-map4-georef.json").read_text())
        _cache["g"] = (np.asarray(g["coeff"], np.float64), int(g["order"]))
    return _cache["g"]


def plate_gray():
    if "gray" not in _cache:
        _cache["gray"] = np.asarray(
            Image.open(RAW / "ftc72a" / "map4-1932.png").convert("L"), np.float32)
    return _cache["gray"]


def counties(state=None):
    if "c" not in _cache:
        _cache["c"] = json.loads((RAW / "counties-conus.json").read_text())["features"]
    feats = _cache["c"]
    if state:
        feats = [f for f in feats if f["properties"]["STATEFP"] == STATE_FIPS[state]]
    return feats


def rings(geometry):
    if geometry["type"] == "Polygon":
        return geometry["coordinates"]
    return [r for poly in geometry["coordinates"] for r in poly]


def project(coords):
    coeff, order = georef()
    a = np.asarray(coords, np.float64)
    x, y = geo.albers(a[:, 0], a[:, 1])
    px, py = geo.apply(coeff, x, y, order)
    return np.column_stack([px, py])


def projected(state):
    out = []
    for f in counties(state):
        out.append((f, [project(r) for r in rings(f["geometry"])]))
    return out


def do_crop(args):
    plate = Image.open(RAW / "ftc72a" / "map4-1932.png").convert("L")
    plate = ImageOps.autocontrast(plate, cutoff=(0.25, 0.25)).convert("RGB")
    outdir = args.output
    outdir.mkdir(parents=True, exist_ok=True)
    for st in [s.upper() for s in args.states]:
        proj = projected(st)
        pts = np.vstack([r for _, rs in proj for r in rs])
        x0 = max(0, int(pts[:, 0].min()) - args.padding)
        y0 = max(0, int(pts[:, 1].min()) - args.padding)
        x1 = min(plate.width, int(pts[:, 0].max()) + args.padding)
        y1 = min(plate.height, int(pts[:, 1].max()) + args.padding)
        if args.box:
            bx0, by0, bx1, by1 = args.box
            x0, y0, x1, y1 = max(x0, bx0), max(y0, by0), min(x1, bx1), min(y1, by1)
        crop = plate.crop((x0, y0, x1, y1))
        z = args.zoom
        if z != 1:
            crop = crop.resize((crop.width * z, crop.height * z), Image.LANCZOS)
        draw = ImageDraw.Draw(crop)
        font = ImageFont.load_default(size=max(11, 6 * z))
        index = {}
        for f, rs in proj:
            local = [[((x - x0) * z, (y - y0) * z) for x, y in r] for r in rs]
            for r in local:
                if args.mesh:
                    draw.line(r, fill=(220, 25, 45), width=max(1, z // 2), joint="curve")
            allp = [p for r in local for p in r]
            bx0 = min(p[0] for p in allp); by0 = min(p[1] for p in allp)
            bx1 = max(p[0] for p in allp); by1 = max(p[1] for p in allp)
            fips = f["properties"]["GEOID"]
            index[fips] = {"name": f["properties"].get("NAME", ""),
                           "bbox": [round(bx0, 1), round(by0, 1), round(bx1, 1), round(by1, 1)]}
            if args.labels:
                draw.text(((bx0 + bx1) / 2, (by0 + by1) / 2), fips[-3:], font=font,
                          anchor="mm", fill=(255, 240, 0), stroke_width=2,
                          stroke_fill=(0, 0, 0))
        tag = args.tag or st.lower()
        crop.save(outdir / f"map4-{tag}.png", optimize=True)
        (outdir / f"map4-{tag}.json").write_text(
            json.dumps({"origin": [x0, y0], "zoom": z, "counties": index},
                       indent=1, sort_keys=True) + "\n")
        print(f"{st}: {len(proj)} counties, crop {crop.size}, origin {x0},{y0}")


def interior_patch(rs, gray, shrink=0.62, maxside=90):
    """Largest inscribed-ish square patch of plate pixels inside a county."""
    big = max(rs, key=lambda r: len(r))
    cx, cy = big[:, 0].mean(), big[:, 1].mean()
    w = (big[:, 0].max() - big[:, 0].min()) * shrink
    h = (big[:, 1].max() - big[:, 1].min()) * shrink
    s = max(10.0, min(w, h, maxside))
    x0 = int(round(cx - s / 2)); y0 = int(round(cy - s / 2))
    x1 = int(round(cx + s / 2)); y1 = int(round(cy + s / 2))
    x0 = max(0, x0); y0 = max(0, y0)
    x1 = min(gray.shape[1], x1); y1 = min(gray.shape[0], y1)
    if x1 - x0 < 8 or y1 - y0 < 8:
        return None, (x0, y0, x1, y1)
    return gray[y0:y1, x0:x1], (x0, y0, x1, y1)


def do_measure(args):
    gray = plate_gray()
    rows = []
    for st in [s.upper() for s in args.states]:
        for f, rs in projected(st):
            fips = f["properties"]["GEOID"]
            patch, box = interior_patch(rs, gray, maxside=args.maxside)
            if patch is None:
                rows.append({"fips": fips, "name": f["properties"]["NAME"],
                             "px": [(box[0] + box[2]) // 2, (box[1] + box[3]) // 2],
                             "small": True})
                continue
            ink = pm.normalise(patch)
            r = pm.radon(patch, top=2)
            entry = {"fips": fips, "name": f["properties"]["NAME"],
                     "px": [(box[0] + box[2]) // 2, (box[1] + box[3]) // 2],
                     "side": patch.shape[1],
                     "mean_ink": round(float(ink.mean()), 3),
                     "ink": round(float((ink > 0.5).mean()), 3),
                     "radon": [[round(a, 0), None if p is None else round(p, 1),
                                round(v, 3), round(s, 2)] for a, p, v, s in r]}
            if r:
                sw = pm.stroke_width(patch, r[0][0])
                entry["stroke"] = None if sw is None else round(float(sw), 1)
            rows.append(entry)
    out = json.dumps(rows, indent=None)
    if args.out:
        args.out.write_text(out + "\n")
        print(f"wrote {args.out} ({len(rows)} counties)")
    else:
        print(out)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("crop")
    c.add_argument("states", nargs="+")
    c.add_argument("--zoom", type=int, default=2)
    c.add_argument("--padding", type=int, default=40)
    c.add_argument("--labels", action="store_true")
    c.add_argument("--mesh", action="store_true")
    c.add_argument("--tag")
    c.add_argument("--box", type=int, nargs=4)
    c.add_argument("--output", type=Path, default=RAW / "map4-crops")
    c.set_defaults(func=do_crop)
    m = sub.add_parser("measure")
    m.add_argument("states", nargs="+")
    m.add_argument("--maxside", type=int, default=90)
    m.add_argument("--out", type=Path)
    m.set_defaults(func=do_measure)
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
