#!/usr/bin/env python3
"""Build the swipe adjudicator's data: county crops, reference swatches, and a queue.

Why this exists. The residual error estimate in map4-holdout-result.md is biased
optimistic because one person did both the trace and the fresh read. The fix is a reader
who has not seen the trace. This packages the contested counties so a person can be that
reader from a phone, in minutes, without the 744 MB plate or any of this toolchain.

The queue is binary on purpose. Every card is a county where two reads already disagree,
so the question is A or B rather than one-of-24, which is what makes a swipe the right
gesture. A full 24-way classification is a palette problem, not a swipe problem.

Each card carries the county at high zoom on the normalised plate with its own boundary
drawn, plus a reference crop of each candidate mark taken from that mark's confirmed
legend field site, so the reader compares like with like rather than against a
description.

  python3 27-build-adjudicator.py --out /tmp/adj.json
"""
import argparse, base64, io, json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lib'))
Image.MAX_IMAGE_PIXELS = None
import plate_geo as geo                # noqa: E402
import plate_legend_map4 as L          # noqa: E402

RAW = os.path.join(HERE, 'data-raw')
CELL = 300          # px of the county card
REF = 150           # px of a reference swatch
UNCERTAIN = ('amb:', 'maybe:', 'partial:', 'split:')

# Confirmed field sites, plate px centres, same table refsheet.py uses.
FIELD = {
 'ebasco': (3270, 2470), 'insull-middle-west': (2120, 2770), 'insull-other': (3400, 1480),
 'united-corporation': (4440, 1150), 'american-commonwealths': (1420, 2130),
 'american-water-works': (4200, 1660), 'age': (4336, 1276),
 'central-public-service': (830, 880), 'central-states-electric': (3170, 1508),
 'cities-service': (3024, 2108), 'duke': (4120, 2090), 'nevada-california': (1030, 1960),
 'new-england-power': (4752, 1180), 'north-american': (4007, 1492),
 'north-american-light': (3421, 1736), 'pacific-gas-electric': (660, 1590),
 'rockland': (4565, 1362), 'standard-gas': (3005, 1168), 'stone-webster': (4531, 1918),
 'tri-utilities': (1690, 1455), 'united-light-power': (2995, 1505),
 'utilities-power-light': (3150, 2035),
}


def base(v):
    return str(v).split('#')[0]


def png(img, quality_pal=64):
    """Grayscale, palette-reduced PNG as a data URI. Small enough to embed hundreds."""
    buf = io.BytesIO()
    img.convert('L').convert('P', palette=Image.ADAPTIVE, colors=quality_pal).save(
        buf, format='PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def load():
    p = os.path.join(RAW, 'ftc72a', 'map4-1932-ink.png')
    if not os.path.exists(p):
        raise SystemExit('run 21-ink-plate.py first')
    im = Image.open(p).convert('L')
    coeff = np.asarray(json.load(open(os.path.join(HERE, 'lib', 'ftc-map4-georef.json')))['coeff'],
                       np.float64)
    cs = json.load(open(os.path.join(RAW, 'counties-conus.json')))
    return im, coeff, {f['properties']['GEOID']: f for f in cs['features']}


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


def county_crop(im, coeff, ft):
    rs = rings(ft)
    allp = np.vstack(rs)
    X, Y = geo.albers(allp[:, 0], allp[:, 1])
    px, py = geo.apply(coeff, X, Y, 3)
    pad = 16
    x0, x1 = px.min() - pad, px.max() + pad
    y0, y1 = py.min() - pad, py.max() + pad
    w, h = max(4, int(x1 - x0)), max(4, int(y1 - y0))
    crop = im.crop((int(x0), int(y0), int(x0) + w, int(y0) + h)).convert('RGB')
    s = max(1.0, min(CELL / w, CELL / h))
    crop = crop.resize((max(1, int(w * s)), max(1, int(h * s))), Image.NEAREST)
    d = ImageDraw.Draw(crop)
    for r in rs:
        RX, RY = geo.albers(r[:, 0], r[:, 1])
        rpx, rpy = geo.apply(coeff, RX, RY, 3)
        d.line([((x - x0) * s, (y - y0) * s) for x, y in zip(rpx, rpy)],
               fill=(220, 30, 30), width=2)
    return crop


def ref_crop(im, key):
    """A reference swatch from the mark's own confirmed field site, at the same zoom."""
    site = FIELD.get(key)
    if site is None:
        return None
    x, y = site
    half = 30
    c = im.crop((x - half, y - half, x + half, y + half))
    return c.resize((REF, REF), Image.NEAREST)


def main(out):
    im, coeff, feat = load()
    trace = json.load(open(os.path.join(HERE, 'lib', 'map4-county-trace.json')))['map4']
    blind = json.load(open(os.path.join(HERE, 'lib', 'map4-blind-west.json')))['blind_west']
    legend = {s['key']: s['printed'] for s in L.SWATCHES}
    shapes = {s['key']: s['shape'] for s in L.SWATCHES}

    # Oklahoma first: it shipped as the weakest state on the sheet, and its clash is one
    # pair over 42 counties, so a short session moves a named weakness.
    queue = []
    seen = set()
    for f in sorted(trace):
        if f not in blind:
            continue
        pv, bv = str(trace[f]), str(blind[f]['verdict'])
        pb, bb = base(pv), base(bv)
        if pb == bb:
            continue
        if pv.startswith(UNCERTAIN) or bv.startswith(UNCERTAIN):
            continue
        if pv in ('unknown-served',) or bv in ('unknown-served',):
            continue
        rank = 0 if f.startswith('40') else 1
        queue.append((rank, f, pb, bb, blind[f]['confidence']))
    queue.sort()
    queue = [q for q in queue if q[1] not in seen and not seen.add(q[1])]

    refs = {}
    for k in FIELD:
        c = ref_crop(im, k)
        if c is not None:
            refs[k] = png(c, 32)
    cards = []
    for rank, f, pb, bb, conf in queue:
        ft = feat.get(f)
        if ft is None:
            continue
        for k in (pb, bb):
            if k not in refs and k != 'none':
                c = ref_crop(im, k)
                if c is not None:
                    refs[k] = png(c, 32)
        cards.append({
            'fips': f,
            'name': ft['properties'].get('NAME', '?'),
            'state': ft['properties'].get('STUSPS', f[:2]),
            'img': png(county_crop(im, coeff, ft)),
            'a': pb, 'b': bb,
            'a_label': legend.get(pb, pb) if pb != 'none' else 'No fill',
            'b_label': legend.get(bb, bb) if bb != 'none' else 'No fill',
            'a_shape': shapes.get(pb, ''), 'b_shape': shapes.get(bb, ''),
            'blind_confidence': conf,
        })
    # The full mark list for the third-choice dropdown. Three of the 24 have no confirmed
    # field site anywhere on the plate, so they carry no swatch: they are still offerable,
    # because a reader seeing one is exactly the evidence that would make them assertable.
    marks = [{'key': s2['key'], 'label': s2['printed'], 'shape': s2['shape'],
              'has_swatch': s2['key'] in refs}
             for s2 in sorted(L.SWATCHES, key=lambda z: z['printed'])]
    doc = {'cards': cards, 'refs': refs, 'marks': marks,
           'note': 'Built by 27-build-adjudicator.py. Candidate A is the primary trace, '
                   'candidate B is the independent blind read. Neither label says which '
                   'is which in the page: the reader should not be told what to prefer.'}
    json.dump(doc, open(out, 'w'))
    size = os.path.getsize(out)
    ok = sum(1 for c in cards if c['fips'].startswith('40'))
    print(f'{len(cards)} cards, {ok} in Oklahoma, {len(refs)} reference swatches')
    print(f'{out}  {size/1e6:.1f} MB of JSON')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/adjudicator.json')
    a = ap.parse_args()
    main(a.out)
