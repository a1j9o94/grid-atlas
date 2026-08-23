#!/usr/bin/env python3
"""Measure the printed mark inside a county, so it can be matched to the legend table.

The legend records each mark as period@angle, stroke width and ink fraction. This
reports the same three for a county's own interior, on the illumination-normalised
plate, using only pixels inside the eroded polygon so the printed boundary line does
not contribute. Eyeballing a diagonal's slope from a crop is unreliable and the
backslash and slash families are mirror images of each other, so the slope is measured
rather than judged.

It classifies nothing. Four automated attempts to go from measurement to legend key
failed on this plate and the reasons are recorded in 15-build-holdings-1930.py. This
narrows a mark to a family and a rank within it; a reader still decides.

  python3 23-measure-county.py 48373 48457 48241
  python3 23-measure-county.py --state 48 --limit 20
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lib'))
Image.MAX_IMAGE_PIXELS = None
import plate_geo as geo            # noqa: E402
import plate_orient as po          # noqa: E402

RAW = os.path.join(HERE, 'data-raw')
BINS = ['0 h', '15', '30', '45 \\', '60', '75', '90 v', '105', '120', '135 /', '150', '165']


def load():
    p = os.path.join(RAW, 'ftc72a', 'map4-1932-ink.png')
    if not os.path.exists(p):
        raise SystemExit('build the normalised plate first: python3 21-ink-plate.py')
    ink = (255.0 - np.asarray(Image.open(p).convert('L'), np.float32)) / 255.0
    coeff = np.asarray(json.load(open(os.path.join(HERE, 'lib', 'ftc-map4-georef.json')))['coeff'],
                       np.float64)
    cs = json.load(open(os.path.join(RAW, 'counties-conus.json')))
    return ink, coeff, {f['properties']['GEOID']: f for f in cs['features']}


def rings(ft):
    out = []
    def walk(c, d):
        if d == 1:
            out.append(np.asarray(c, np.float64))
        else:
            for s in c:
                walk(s, d - 1)
    gm = ft['geometry']
    walk(gm['coordinates'], {'Polygon': 2, 'MultiPolygon': 3}[gm['type']])
    return out


def patch(ink, coeff, ft):
    H, W = ink.shape
    rs = rings(ft)
    allp = np.vstack(rs)
    X, Y = geo.albers(allp[:, 0], allp[:, 1])
    px, py = geo.apply(coeff, X, Y, 3)
    x0, x1 = int(max(0, px.min() - 6)), int(min(W, px.max() + 6))
    y0, y1 = int(max(0, py.min() - 6)), int(min(H, py.max() + 6))
    if x1 - x0 < 6 or y1 - y0 < 6:
        return None, None
    m = Image.new('L', (x1 - x0, y1 - y0), 0)
    d = ImageDraw.Draw(m)
    for r in rs:
        RX, RY = geo.albers(r[:, 0], r[:, 1])
        rpx, rpy = geo.apply(coeff, RX, RY, 3)
        d.polygon([(x - x0, y - y0) for x, y in zip(rpx, rpy)], fill=255)
    mm = np.asarray(m) > 0
    er = None
    for it in (3, 2, 1):
        e = ndimage.binary_erosion(mm, iterations=it)
        if e.sum() >= 60:
            er = e
            break
    if er is None:
        return None, None
    return ink[y0:y1, x0:x1], er


def measure(ink, coeff, feat, fips):
    ft = feat.get(fips)
    if ft is None:
        return f'{fips}  not in the county base'
    pa, mask = patch(ink, coeff, ft)
    if pa is None:
        return f'{fips} {ft["properties"]["NAME"]:<14} too small to measure inside its own outline'
    cov = float(pa[mask].mean())
    prof = po.profile(pa, mask)
    order = np.argsort(prof)[::-1]
    bits = []
    for b in order[:2]:
        deg = b * 15 + 7.5
        per, st = po.period_along(pa, deg, mask)
        du = po.duty(pa, deg, mask)
        bits.append('%s e=%.2f%s%s' % (
            BINS[b], prof[b],
            ' p=%.1f(%.2f)' % (per, st) if per else ' p=-',
            ' w=%.1f' % du if du else ''))
    return '%s %-14s ink=%.2f  %s' % (fips, ft['properties']['NAME'][:14], cov, ' | '.join(bits))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('fips', nargs='*')
    ap.add_argument('--state')
    ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()
    ink, coeff, feat = load()
    picks = a.fips
    if a.state:
        picks = sorted(f for f in feat if f.startswith(a.state))
        if a.limit:
            picks = picks[:a.limit]
    for f in picks:
        print(measure(ink, coeff, feat, f), flush=True)
