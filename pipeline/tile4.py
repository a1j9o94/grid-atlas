#!/usr/bin/env python3
"""Crop an arbitrary plate box from Map IV at high zoom, optionally with the mesh.

  python3 tile4.py 3300 1400 3560 1600 --zoom 6 --out t1.png [--mesh --labels]
"""
import argparse, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
RAW = HERE / "data-raw"
LIB = HERE / "lib"
sys.path.insert(0, str(LIB))
import plate_geo as geo

ap = argparse.ArgumentParser()
ap.add_argument("x0", type=int); ap.add_argument("y0", type=int)
ap.add_argument("x1", type=int); ap.add_argument("y1", type=int)
ap.add_argument("--zoom", type=int, default=6)
ap.add_argument("--out", default="tile.png")
ap.add_argument("--mesh", action="store_true")
ap.add_argument("--labels", action="store_true")
ap.add_argument("--raw", action="store_true", help="skip autocontrast")
a = ap.parse_args()

# The normalised plate by default, same reason as 19-contact-sheet.py: the raw scan's
# fold shadow reads as absence of ink. --raw crops the scan and skips autocontrast.
_ink = RAW / "ftc72a" / "map4-1932-ink.png"
_src = RAW / "ftc72a" / "map4-1932.png" if a.raw or not _ink.exists() else _ink
print(f"plate: {_src.name}")
im = Image.open(_src).convert("L")
if not a.raw:
    im = ImageOps.autocontrast(im, cutoff=(0.25, 0.25))
im = im.convert("RGB")
crop = im.crop((a.x0, a.y0, a.x1, a.y1))
z = a.zoom
crop = crop.resize((crop.width * z, crop.height * z), Image.LANCZOS)
if a.mesh or a.labels:
    g = json.loads((LIB / "ftc-map4-georef.json").read_text())
    coeff = np.asarray(g["coeff"], np.float64); order = int(g["order"])
    feats = json.loads((RAW / "counties-conus.json").read_text())["features"]
    d = ImageDraw.Draw(crop)
    font = ImageFont.load_default(size=max(12, 3 * z))
    for f in feats:
        gm = f["geometry"]
        rs = gm["coordinates"] if gm["type"] == "Polygon" else [r for p in gm["coordinates"] for r in p]
        loc = []
        for r in rs:
            arr = np.asarray(r, np.float64)
            xx, yy = geo.albers(arr[:, 0], arr[:, 1])
            px, py = geo.apply(coeff, xx, yy, order)
            loc.append(np.column_stack([px, py]))
        pts = np.vstack(loc)
        if pts[:, 0].max() < a.x0 or pts[:, 0].min() > a.x1 or pts[:, 1].max() < a.y0 or pts[:, 1].min() > a.y1:
            continue
        for r in loc:
            if a.mesh:
                d.line([((x - a.x0) * z, (y - a.y0) * z) for x, y in r],
                       fill=(230, 30, 50), width=max(1, z // 3), joint="curve")
        if a.labels:
            cx = (pts[:, 0].min() + pts[:, 0].max()) / 2
            cy = (pts[:, 1].min() + pts[:, 1].max()) / 2
            d.text(((cx - a.x0) * z, (cy - a.y0) * z), f["properties"]["GEOID"],
                   font=font, anchor="mm", fill=(255, 240, 0), stroke_width=2,
                   stroke_fill=(0, 0, 0))
crop.save(RAW / "map4-crops" / a.out, optimize=True)
print(a.out, crop.size)
