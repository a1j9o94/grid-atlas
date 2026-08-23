#!/usr/bin/env python3
"""Contact sheet of plate crops at a fixed zoom, for comparing an unknown fill
against confirmed field sites. Sites come from the legend plus anything added here.

  python3 refsheet.py --sites p17,p16,p11,p21 --probe 3120,1730 --probe 3230,1620
"""
import argparse, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "lib"))
import plate_legend_map4 as L
import plate_measure as pm

# confirmed field sites, plate px centres (from the legend's fill_site column)
FIELD = {
 'p01': (3270, 2470), 'p02': (2120, 2770), 'p03': (3400, 1480),
 'p04': (4440, 1150), 'p05': (1420, 2130), 'p07': (4200, 1660),
 'p08': (4336, 1276), 'p09': (830, 880),   'p10': (3170, 1508),
 'p11': (3024, 2108), 'p12': (4120, 2090), 'p14': (1030, 1960),
 'p15': (4752, 1180), 'p16': (4007, 1492), 'p17': (3421, 1736),
 'p18': (660, 1590),  'p19': (4565, 1362), 'p20': (3005, 1168),
 'p21': (4531, 1918), 'p22': (1690, 1455), 'p23': (2995, 1505),
 'p24': (3150, 2035),
}

ap = argparse.ArgumentParser()
ap.add_argument("--sites", default="")
ap.add_argument("--probe", action="append", default=[])
ap.add_argument("--half", type=int, default=32)
ap.add_argument("--zoom", type=int, default=8)
ap.add_argument("--out", default="ref.png")
a = ap.parse_args()

# Normalised plate by default, same reason as the other crop tools: the raw scan's fold
# shadow reads as absence of ink and biased one adjudication already.
_ink = HERE / "data-raw" / "ftc72a" / "map4-1932-ink.png"
_src = _ink if _ink.exists() else HERE / "data-raw" / "ftc72a" / "map4-1932.png"
print(f"plate: {_src.name}")
im = Image.open(_src).convert("L")
arr = np.asarray(im, np.float32)
tiles = []
for s in [t for t in a.sites.split(",") if t]:
    x, y = FIELD[s]
    tiles.append((s, x, y))
for p in a.probe:
    x, y = [int(v) for v in p.split(",")]
    tiles.append((f"{x},{y}", x, y))

H = a.half
side = 2 * H * a.zoom
sheet = Image.new("L", (len(tiles) * (side + 8), side + 34), 255)
d = ImageDraw.Draw(sheet)
for i, (nm, x, y) in enumerate(tiles):
    g = arr[y - H:y + H, x - H:x + H]
    r = pm.radon(g, top=2)
    sw = pm.stroke_width(g, r[0][0]) if r else None
    txt = " ".join("%d@%s" % (round(p) if p else 0, round(ang))
                   for ang, p, v, s in r)
    d.text((i * (side + 8) + 3, 3), nm, fill=0)
    d.text((i * (side + 8) + 3, 15), "%s w%.1f i%.2f" % (
        txt, sw or 0, float(pm.normalise(g).mean())), fill=0)
    sheet.paste(im.crop((x - H, y - H, x + H, y + H)).resize((side, side), Image.LANCZOS),
                (i * (side + 8), 32))
sheet.save(HERE / "data-raw" / "map4-crops" / a.out)
print(a.out, sheet.size)
