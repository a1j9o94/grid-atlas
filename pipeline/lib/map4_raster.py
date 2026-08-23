"""County-id raster on Map IV plate pixels, plus per-county interior sampling.

Rasterises the modern county mesh through `ftc-map4-georef.json` so any plate
pixel can be named, and any county can be sampled well inside its own border.
The raster is cached as an .npy next to the plate.
"""
from pathlib import Path
import json
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
PIPE = HERE.parent
RAW = PIPE / "data-raw"
sys.path.insert(0, str(HERE))
import plate_geo as geo  # noqa: E402

# Normalised plate when it exists. The raw scan's fold shadow reads as absence of ink,
# which is how one adjudication went wrong. Build it with 21-ink-plate.py.
_INK = RAW / "ftc72a" / "map4-1932-ink.png"
PLATE = _INK if _INK.exists() else RAW / "ftc72a" / "map4-1932.png"
CACHE = RAW / "map4-county-raster.npz"

_c = {}


def _georef():
    if "g" not in _c:
        d = json.loads((HERE / "ftc-map4-georef.json").read_text())
        _c["g"] = (np.asarray(d["coeff"], np.float64), int(d["order"]))
    return _c["g"]


def project(coords):
    coeff, order = _georef()
    a = np.asarray(coords, np.float64)
    x, y = geo.albers(a[:, 0], a[:, 1])
    px, py = geo.apply(coeff, x, y, order)
    return np.column_stack([px, py])


def _rings(gm):
    if gm["type"] == "Polygon":
        return gm["coordinates"]
    return [r for p in gm["coordinates"] for r in p]


def build(force=False):
    if CACHE.exists() and not force:
        z = np.load(CACHE, allow_pickle=True)
        return z["ids"], list(z["fips"])
    feats = json.loads((RAW / "counties-conus.json").read_text())["features"]
    feats.sort(key=lambda f: f["properties"]["GEOID"])
    w, h = Image.open(PLATE).size
    img = Image.new("I", (w, h), 0)
    d = ImageDraw.Draw(img)
    fips = []
    for i, f in enumerate(feats, start=1):
        fips.append(f["properties"]["GEOID"])
        for r in _rings(f["geometry"]):
            pts = project(r)
            d.polygon([tuple(p) for p in pts], fill=i)
    ids = np.asarray(img, np.int32)
    np.savez_compressed(CACHE, ids=ids, fips=np.asarray(fips))
    return ids, fips


def at(x, y):
    ids, fips = build()
    v = int(ids[int(round(y)), int(round(x))])
    return fips[v - 1] if v else None


def gray():
    if "gray" not in _c:
        _c["gray"] = np.asarray(Image.open(PLATE).convert("L"), np.float32)
    return _c["gray"]


def masks(erode=2):
    """fips -> boolean mask, eroded to keep the printed county border out."""
    key = ("m", erode)
    if key in _c:
        return _c[key]
    from scipy import ndimage
    ids, fips = build()
    out = {}
    objs = ndimage.find_objects(ids)
    for i, sl in enumerate(objs):
        if sl is None:
            continue
        sub = ids[sl] == (i + 1)
        if erode:
            sub = ndimage.binary_erosion(sub, np.ones((3, 3), bool), iterations=erode)
        out[fips[i]] = (sl, sub)
    _c[key] = out
    return out


if __name__ == "__main__":
    ids, fips = build(force="--force" in sys.argv)
    print("raster", ids.shape, "counties", len(fips), "covered px", int((ids > 0).sum()))
    for x, y, want in [(3499, 1502, "17031"), (4565, 1549, "42101"), (867, 2269, "06037")]:
        print(x, y, at(x, y), "want", want)


def inscribed_patch(fips, maxside=100, erode=2):
    """Largest square window fully inside the county, as (gray_patch, (x0,y0,x1,y1))."""
    from scipy import ndimage
    m = masks(erode).get(fips)
    if m is None:
        return None, None
    (sy, sx), sub = m
    if not sub.any():
        return None, None
    dt = ndimage.distance_transform_edt(sub)
    iy, ix = np.unravel_index(int(np.argmax(dt)), dt.shape)
    r = float(dt[iy, ix])
    half = max(4, min(int(r * 0.95), maxside // 2))
    cy, cx = iy + sy.start, ix + sx.start
    box = (cx - half, cy - half, cx + half, cy + half)
    g = gray()
    return g[box[1]:box[3], box[0]:box[2]], box


def county_stats(fips, maxside=100):
    import plate_measure as pm
    patch, box = inscribed_patch(fips, maxside=maxside)
    if patch is None or min(patch.shape) < 10:
        return {"fips": fips, "small": True, "box": box}
    ink = pm.normalise(patch)
    rows = pm.radon(patch, top=2)
    out = {"fips": fips, "box": box, "side": int(patch.shape[0]),
           "mean_ink": round(float(ink.mean()), 3),
           "ink": round(float((ink > 0.5).mean()), 3),
           "radon": [(round(a), None if p is None else round(p, 1), round(v, 3), round(s, 2))
                     for a, p, v, s in rows]}
    if rows:
        sw = pm.stroke_width(patch, rows[0][0])
        out["stroke"] = None if sw is None else round(float(sw), 1)
    return out


BINS12 = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165]


def fingerprint(fips, erode=3):
    """Whole-county texture fingerprint: ink, orientation profile, period+stroke
    along the one or two dominant printed line directions."""
    import plate_measure as pm
    import plate_orient as po
    m = masks(erode).get(fips)
    if m is None:
        return {"empty": True}
    (sy, sx), sub = m
    if sub.sum() < 90:
        return {"empty": True, "px": int(sub.sum())}
    g = gray()[sy, sx]
    ink = pm.normalise(g)
    prof = po.profile(g, sub)
    order = list(np.argsort(prof)[::-1])
    doms = []
    for b in order:
        if all(min(abs(b - c), 12 - abs(b - c)) > 1 for c in doms):
            doms.append(int(b))
        if len(doms) == 2:
            break
    out = {"px": int(sub.sum()),
           "ink": round(float(ink[sub].mean()), 3),
           "dark": round(float((ink[sub] > 0.5).mean()), 3),
           "prof": [round(float(v), 3) for v in prof],
           "dom": []}
    for b in doms:
        ang = BINS12[b]
        per, s = po.period_along(ink, ang, sub)
        w = po.duty(ink, ang, sub)
        out["dom"].append({"ang": ang, "w8": round(float(prof[b]), 3),
                           "per": None if per is None else round(per, 1),
                           "acf": round(s, 2),
                           "stroke": None if w is None else round(w, 1)})
    return out
