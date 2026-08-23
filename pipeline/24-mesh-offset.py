#!/usr/bin/env python3
"""Measure the local offset between the county mesh and the plate's printed county lines.

The georeference is good enough to navigate and crop, not to sample blind. The reader
brief already says to follow the printed lines when the mesh disagrees, but a reader
cannot do that for a county whose short dimension is smaller than the offset, and any
tool that centres a sampling window on the mesh inherits the error silently. That is how
a window centred on Bailey County, Texas came to sample Lamb County's hatch.

The plate draws every county boundary as a dark line. So rasterise the mesh boundaries
over a region, slide that raster against the plate's ink, and take the shift that puts
the most ink under the mesh lines. Hatch fill contributes roughly uniformly at every
shift, so it raises the floor without moving the peak.

  python3 24-mesh-offset.py --state 48                    one offset for Texas
  python3 24-mesh-offset.py --state 48 --tiles 3          a 3x3 grid of local offsets
  python3 24-mesh-offset.py --validate                    against states with logged offsets

DIAGNOSE WITH THIS. DO NOT CORRECT WITH IT. Validated 2026-08-19 and it does not hold.

Run against states whose offsets the primary reader logged, it is unstable in exactly the
way this pipeline has learned to distrust. Ohio returns dx+11 dy+14 and North Carolina
dx-4 dy-22 repeatably, both consistent with the 15 to 25 px logged for them. But Indiana
moved from dx-10 dy+11 to dx-42 dy+45 when the search window widened and the input was
high-passed, which is a 61 px offset for a state logged at about 10. Texas moved from
dx-9 dy-26 to dx+2 dy-34. And the first Texas run stopped at dy -26 with the span set to
26, which is the same error as an optimiser reported earlier in this pipeline: a peak on
the edge of its own search grid has hit a wall, not converged.

The confound is hatch. County lines are thin and dark and so is most of the fill on this
plate, so over a large region the correlation is driven by whichever patch happens to
have line-like texture near the mesh geometry. High-passing suppressed the solid-black
fills, which is why the numbers moved, and did nothing about the hatched ones.

So the offset stays a thing a reader sees rather than a number a tool applies. Use
19-contact-sheet.py, which draws the county outline on the crop next to the printed
lines: where the two disagree the printed line wins, and the reader can see by how much.
That is how Bailey and Cochran counties were settled, and an 18 px correction applied
blind would have moved a different county the wrong way.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lib'))
Image.MAX_IMAGE_PIXELS = None
import plate_geo as geo            # noqa: E402

RAW = os.path.join(HERE, 'data-raw')
SPAN = 48           # search +/- this many pixels in each axis. An optimiser that stops
                    # at the edge of its own grid has hit a wall rather than converged, so
                    # a result at +/-SPAN is reported as not converged, never as an answer.


def load():
    p = os.path.join(RAW, 'ftc72a', 'map4-1932-ink.png')
    ink = (255.0 - np.asarray(Image.open(p).convert('L'), np.float32)) / 255.0
    # High-pass so the correlation responds to thin printed lines rather than to broad
    # dark fills. A solid-black county is uniformly dark, so it flattens to nothing here,
    # which stops the mesh being dragged onto the nearest empire blob.
    from scipy import ndimage as _nd
    ink = np.clip(ink - _nd.uniform_filter(ink, 15), 0, None)
    coeff = np.asarray(json.load(open(os.path.join(HERE, 'lib', 'ftc-map4-georef.json')))['coeff'],
                       np.float64)
    cs = json.load(open(os.path.join(RAW, 'counties-conus.json')))
    return ink, coeff, cs['features']


def mesh_lines(feats, coeff, state, box):
    """Binary raster of county boundary polylines inside box, in plate pixels."""
    x0, y0, x1, y1 = box
    img = Image.new('L', (x1 - x0, y1 - y0), 0)
    d = ImageDraw.Draw(img)
    n = 0
    for f in feats:
        g = f['properties']['GEOID']
        if state and not g.startswith(state):
            continue
        gm = f['geometry']
        rs = gm['coordinates'] if gm['type'] == 'Polygon' else [r for p in gm['coordinates'] for r in p]
        for r in rs:
            a = np.asarray(r, np.float64)
            X, Y = geo.albers(a[:, 0], a[:, 1])
            px, py = geo.apply(coeff, X, Y, 3)
            if px.max() < x0 or px.min() > x1 or py.max() < y0 or py.min() > y1:
                continue
            d.line([(x - x0, y - y0) for x, y in zip(px, py)], fill=255, width=1)
            n += 1
    return (np.asarray(img) > 0), n


def offset(ink, feats, coeff, state, box):
    m, n = mesh_lines(feats, coeff, state, box)
    if n == 0 or m.sum() < 400:
        return None
    x0, y0, x1, y1 = box
    pad = SPAN + 2
    sub = ink[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad]
    oy = y0 - max(0, y0 - pad)
    ox = x0 - max(0, x0 - pad)
    h, w = m.shape
    best = None
    scores = np.full((2 * SPAN + 1, 2 * SPAN + 1), np.nan)
    for dy in range(-SPAN, SPAN + 1):
        for dx in range(-SPAN, SPAN + 1):
            yy, xx = oy + dy, ox + dx
            if yy < 0 or xx < 0 or yy + h > sub.shape[0] or xx + w > sub.shape[1]:
                continue
            s = float(sub[yy:yy + h, xx:xx + w][m].mean())
            scores[dy + SPAN, dx + SPAN] = s
            if best is None or s > best[0]:
                best = (s, dx, dy)
    if best is None:
        return None
    s, dx, dy = best
    flat = scores[~np.isnan(scores)]
    # A peak worth trusting stands clear of the field it sits in.
    z = (s - flat.mean()) / (flat.std() + 1e-9)
    wall = abs(dx) >= SPAN or abs(dy) >= SPAN
    return {'dx': dx, 'dy': dy, 'score': round(s, 4), 'z': round(float(z), 2),
            'mesh_px': int(m.sum()),
            **({'converged': False, 'why': 'peak sits on the search-grid edge'} if wall else {})}


def state_box(feats, coeff, state):
    xs, ys = [], []
    for f in feats:
        if not f['properties']['GEOID'].startswith(state):
            continue
        gm = f['geometry']
        rs = gm['coordinates'] if gm['type'] == 'Polygon' else [r for p in gm['coordinates'] for r in p]
        for r in rs:
            a = np.asarray(r, np.float64)
            X, Y = geo.albers(a[:, 0], a[:, 1])
            px, py = geo.apply(coeff, X, Y, 3)
            xs += [px.min(), px.max()]
            ys += [py.min(), py.max()]
    return int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))


def run(state, tiles):
    ink, coeff, feats = load()
    x0, y0, x1, y1 = state_box(feats, coeff, state)
    if tiles <= 1:
        r = offset(ink, feats, coeff, state, (x0, y0, x1, y1))
        print(f'state {state} box {x0},{y0}..{x1},{y1} -> {r}')
        return
    xs = np.linspace(x0, x1, tiles + 1).astype(int)
    ys = np.linspace(y0, y1, tiles + 1).astype(int)
    for j in range(tiles):
        row = []
        for i in range(tiles):
            r = offset(ink, feats, coeff, state, (xs[i], ys[j], xs[i + 1], ys[j + 1]))
            row.append('  ----  ' if r is None else 'dx%+3d dy%+3d z%4.1f' % (r['dx'], r['dy'], r['z']))
        print(f'y {ys[j]:5d}..{ys[j+1]:5d} | ' + ' | '.join(row))
    print('x bands: ' + '  '.join('%d..%d' % (xs[i], xs[i + 1]) for i in range(tiles)))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--state', default='48')
    ap.add_argument('--tiles', type=int, default=1)
    ap.add_argument('--validate', action='store_true')
    a = ap.parse_args()
    if a.validate:
        # States with offsets logged by the primary reader, as a known-good check.
        for st, note in (('17', 'Illinois, logged about 10 px'),
                         ('18', 'Indiana, logged about 10 px'),
                         ('39', 'Ohio, logged 15 to 25 px'),
                         ('37', 'North Carolina, logged 15 to 25 px'),
                         ('48', 'Texas, not yet logged')):
            ink, coeff, feats = load()
            r = offset(ink, feats, coeff, st, state_box(feats, coeff, st))
            print('%-4s %-34s %s' % (st, note, r))
    else:
        run(a.state, a.tiles)
