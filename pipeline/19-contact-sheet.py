"""Contact sheets of labelled county crops, for adjudicating disputes by eye.

Adjudicating the Map IV disputes one crop at a time is 300 round trips. A sheet of 16
labelled crops is 20. That is the whole point of this script.

Each cell is one county, cropped from the plate at native resolution with a small margin,
upscaled so the hatch is legible, captioned with its FIPS, name, and what each reader said.
The county's own boundary is drawn in red, which is the part that matters: the commonest
error in this trace was a reader attributing an adjacent patch inward, and you cannot see
that without the boundary on the crop.

Usage:
  python3 19-contact-sheet.py --disputes served      the 128 served-status disagreements
  python3 19-contact-sheet.py --disputes pattern     the 180 which-system clashes
  python3 19-contact-sheet.py --fips 31005,08001     specific counties
  python3 19-contact-sheet.py --state 19             one state
Options: --per 16 cells per sheet, --out DIR, --year 1932
"""
import argparse, json, os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import plate_geo as geo
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'data-raw')
Image.MAX_IMAGE_PIXELS = None
CELL, PAD, CAP = 300, 18, 56          # cell px, margin around the county, caption strip
# The caption carries the whole verdict, numeral included. Truncating it hid the second
# candidate of every `amb:` pair, which is the one thing an adjudicator has to see.
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 13)


def load(raw=False):
    t = json.load(open(os.path.join(HERE, 'lib', 'map4-county-trace.json')))
    b = json.load(open(os.path.join(HERE, 'lib', 'map4-blind-west.json')))
    g = json.load(open(os.path.join(HERE, 'lib', 'ftc-map4-georef.json')))
    cs = json.load(open(os.path.join(RAW, 'counties-conus.json')))
    # The normalised plate by default. A raw crop carries the scan's fold shadow and the
    # bright ridge beside it, which reads as absence of ink and has already cost one wrong
    # adjudication. `--raw` is kept for comparing the two.
    ink = os.path.join(RAW, 'ftc72a', 'map4-1932-ink.png')
    src = os.path.join(RAW, 'ftc72a', 'map4-1932.png') if raw or not os.path.exists(ink) else ink
    print(f'plate: {os.path.basename(src)}')
    im = Image.open(src).convert('L')
    return t['map4'], b['blind_west'], np.asarray(g['coeff'], np.float64), \
        {f['properties']['GEOID']: f for f in cs['features']}, im


def verdict(e):
    return e['verdict'] if isinstance(e, dict) else e


def conf(e):
    return e.get('confidence', '?') if isinstance(e, dict) else '?'


def rings(feat):
    """Every ring of the county, as lon/lat arrays, so the outline can be drawn."""
    out = []
    def walk(c, d):
        if d == 1:
            out.append(np.asarray(c, np.float64))
        else:
            for s in c:
                walk(s, d - 1)
    gm = feat['geometry']
    walk(gm['coordinates'], {'Polygon': 2, 'MultiPolygon': 3}[gm['type']])
    return out


def cell(im, coeff, feat, lines, cell_px=None):
    rs = rings(feat)
    allpts = np.vstack(rs)
    X, Y = geo.albers(allpts[:, 0], allpts[:, 1])
    px, py = geo.apply(coeff, X, Y, 3)
    x0, x1, y0, y1 = px.min() - PAD, px.max() + PAD, py.min() - PAD, py.max() + PAD
    w, h = max(4, int(x1 - x0)), max(4, int(y1 - y0))
    crop = im.crop((int(x0), int(y0), int(x0) + w, int(y0) + h)).convert('RGB')
    # Upscale to fill the cell, nearest-neighbour so the engraved lines stay crisp rather
    # than being smoothed into the grey they have to be told apart from.
    CP = cell_px or CELL
    s = max(1.0, min(CP / w, CP / h))
    crop = crop.resize((max(1, int(w * s)), max(1, int(h * s))), Image.NEAREST)
    d = ImageDraw.Draw(crop)
    for r in rs:
        RX, RY = geo.albers(r[:, 0], r[:, 1])
        rpx, rpy = geo.apply(coeff, RX, RY, 3)
        d.line([((x - x0) * s, (y - y0) * s) for x, y in zip(rpx, rpy)],
               fill=(220, 30, 30), width=2)
    out = Image.new('RGB', (CP, CP + CAP), (255, 255, 255))
    out.paste(crop, ((CP - crop.width) // 2, (CP - crop.height) // 2))
    dd = ImageDraw.Draw(out)
    for k, (txt, col) in enumerate(lines):
        dd.text((3, CP + 2 + k * 17), txt, fill=col, font=FONT)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--disputes', choices=['served', 'pattern'])
    ap.add_argument('--fips')
    ap.add_argument('--state')
    ap.add_argument('--per', type=int, default=16)
    ap.add_argument('--cell', type=int, default=CELL)
    ap.add_argument('--raw', action='store_true', help='crop the unnormalised scan instead')
    ap.add_argument('--blind', action='store_true',
                    help='caption the FIPS and name only. For reading the holdout sample '
                         'without seeing what the trace already says, which is the whole '
                         'point of having a holdout.')
    ap.add_argument('--from-file', help='JSON file with a "fips" list, e.g. the holdout sample')
    ap.add_argument('--geo', action='store_true',
                    help='order cells by position, north band then west to east, instead of '
                         'by FIPS. A sheet is then one piece of country, which is how the '
                         'plate is read: identify the patch, then assign the counties in it.')
    ap.add_argument('--out', default=os.path.join(RAW, 'ftc72a', 'sheets'))
    args = ap.parse_args()
    prim, blind, coeff, counties, im = load(args.raw)

    def base(v):
        return v.split('#')[0]

    picks = []
    if args.from_file:
        picks = json.load(open(args.from_file))['fips']
    elif args.fips:
        picks = [f.strip() for f in args.fips.split(',')]
    elif args.state:
        picks = sorted(f for f in counties if f[:2] == args.state)
    else:
        for f in sorted(prim):
            if f not in blind:
                continue
            pv, bv = base(prim[f]), base(verdict(blind[f]))
            pblank, bblank = pv == 'none', bv == 'none'
            if args.disputes == 'served' and pblank != bblank:
                picks.append(f)
            elif args.disputes == 'pattern' and not pblank and not bblank and pv != bv \
                    and not pv.startswith(('amb:', 'maybe:')) and not bv.startswith(('amb:', 'maybe:')):
                picks.append(f)
    if args.geo:
        def _pos(f):
            ft = counties.get(f)
            if ft is None:
                return (9e9, 9e9)
            gm = ft['geometry']
            rs = gm['coordinates'] if gm['type'] == 'Polygon' else \
                [r for p in gm['coordinates'] for r in p]
            pts = np.vstack([np.asarray(r, np.float64) for r in rs])
            X, Y = geo.albers(pts[:, 0], pts[:, 1])
            px, py = geo.apply(coeff, X, Y, 3)
            return (round(float(py.mean()) / 26), float(px.mean()))
        picks = sorted(picks, key=_pos)
    os.makedirs(args.out, exist_ok=True)
    print(f'{len(picks)} counties, {args.per} per sheet')
    n = 0
    for i in range(0, len(picks), args.per):
        chunk = picks[i:i + args.per]
        cols = int(np.ceil(np.sqrt(len(chunk))))
        rows = int(np.ceil(len(chunk) / cols))
        CP = args.cell
        sheet = Image.new('RGB', (cols * CP, rows * (CP + CAP)), (255, 255, 255))
        for j, f in enumerate(chunk):
            feat = counties.get(f)
            if feat is None:
                continue
            nm = feat['properties'].get('NAME', '?')
            b = blind.get(f)
            lines = [(f'{f} {nm}', (0, 0, 0))]
            if not args.blind:
                lines.append((f'P: {prim.get(f, "-")}', (120, 0, 0)))
                if b:
                    lines.append((f'B: {verdict(b)} [{conf(b)}]', (0, 60, 140)))
            sheet.paste(cell(im, coeff, feat, lines, CP),
                        ((j % cols) * CP, (j // cols) * (CP + CAP)))
        p = os.path.join(args.out, f'sheet-{args.disputes or args.state or "fips"}-{i // args.per:02d}.png')
        sheet.save(p)
        n += 1
        print(f'  {p}  ({len(chunk)} counties)')
    print(f'{n} sheets')


if __name__ == '__main__':
    main()
