#!/usr/bin/env python3
"""Measure the plate at each county's deepest interior point.

  python3 probe4.py 42001 42011 ...
  python3 probe4.py --state PA
"""
import sys, json
from pathlib import Path
import numpy as np
from scipy import ndimage
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "lib"))
import map4_raster as R, plate_measure as pm, plate_orient as po
B = [0,15,30,45,60,75,90,105,120,135,150,165]
args = sys.argv[1:]
if args and args[0] == "--state":
    from sheet4 import STATE_FIPS
    uni = json.loads((HERE/"lib"/"counties-conus-fips.json").read_text())["fips"]
    args = [f for f in uni if f.startswith(STATE_FIPS[args[1].upper()])]
g = R.gray()
for f in args:
    m = R.masks(2).get(f)
    if not m:
        print(f, "no geometry"); continue
    (sy, sx), sub = m
    dt = ndimage.distance_transform_edt(sub)
    iy, ix = np.unravel_index(int(np.argmax(dt)), dt.shape)
    x, y, r = ix+sx.start, iy+sy.start, float(dt[iy,ix])
    h = 26
    w = g[y-h:y+h, x-h:x+h]
    rad = pm.radon(w, top=2)
    pr = po.profile(w); j = int(np.argmax(pr))
    per, _ = po.period_along(pm.normalise(w), B[j])
    st = po.duty(pm.normalise(w), B[j])
    print("%s r%-3d ink%.2f dom%3d(%.2f) per%-6s w%-5s radon %s" % (
        f, r, float(pm.normalise(w).mean()), B[j], pr[j],
        None if per is None else round(per,1), None if st is None else round(st,1),
        " ".join("%s@%s"%(None if p is None else round(p,1), round(a)) for a,p,v,s2 in rad)))
