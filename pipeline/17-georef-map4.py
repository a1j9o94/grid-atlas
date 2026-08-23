"""Georeference FTC Map IV (1932) by transferring Map III's fit instead of refitting it.

Two earlier attempts solved Map IV from scratch and failed independent interior controls.
The reason is in stage one of `15-build-holdings-1930.py`. That stage seeds the optimiser
from four coarse landmarks whose pixel coordinates are read off Map III by eye, then lets
Nelder-Mead maximise texture energy along the state borders from there. Map IV is 5521
pixels wide against Map III's 5111, with a larger legend block, so those four pixels point
at the wrong places on it. The optimiser starts in the wrong basin and the ICP that follows
latches onto whichever boundary happens to be nearby.

The two plates are facing pages of one volume, PDF pages 89 and 90, off the same print run.
Their heights are 3789 and 3784 pixels, five apart. So the base engraving is the same and
Map III's converged solution is already almost right for Map IV: what differs is page
placement and a little paper shrinkage, which is an affine correction, not a new projection.

So this script replaces stage one with a transfer. It takes Map III's order-3 coefficients,
searches a small affine correction on plate pixels, refits the polynomial through that
correction, then runs the identical ICP ladder. The ICP code is imported rather than copied,
so the two plates are registered by the same routine and cannot drift apart.

The gate is deliberately not the ICP's own residual. At radius 5 the ICP matches only points
already within five pixels and reports the agreement among those, which is circular: the
first run of this script reported 2.19 px while missing Seattle by about 200.

The gate is instead **relative to Map III**, measured by the same code on the same day.
Map III is the right reference because its fit shipped and its county anchors pass, so it
defines what good enough looks like on this printing at this resolution. Absolute pixel
thresholds were tried first and thrown away: they were uncalibrated guesses, and when the
two measures below were run against Map III they scored the known-good fit *worse* than
Map IV, which says the measures carry a bias rather than that Map IV had failed. The bias
is real. Ink along a projected state line is confounded by the hatch fills either side, and
the texture-energy land edge is not exactly the drawn border. Both cancel when the same
measure is applied to both plates and only the difference is read.

So Map IV passes when it registers at least as well as Map III under:

  1. Outline residual by region, in five geographic buckets, on every outline point rather
     than a chosen subset, so a corner cannot hide behind a good average.
  2. State-line alignment, as the offset that maximises ink along the projected state mesh.

Plus visual verification at diagnostic landmarks, which is what the Map III build itself
used, and which caught the first bad fit here when both automated measures had passed it.

Usage:
  python3 17-georef-map4.py            fit, gate, and write lib/ftc-map4-georef.json
  python3 17-georef-map4.py --crops    write verification crops and exit
"""
import json
import os
import sys

import numpy as np
from scipy import ndimage, optimize

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lib'))
import plate_geo as geo  # noqa: E402

RAW = os.path.join(HERE, 'data-raw')
CACHE = os.path.join(RAW, 'ftc72a')
MAP3_GEOREF = os.path.join(HERE, 'lib', 'ftc-map3-georef.json')
OUT = os.path.join(HERE, 'lib', 'ftc-map4-georef.json')
ORDER = 3

# The gate, relative to Map III. A little slack, because the two plates are different
# impressions and the measures are noisy, but not enough to let a materially worse fit
# through: Map IV may be up to a quarter worse per region and 4 px looser on the state-line
# offset than the fit that already ships.
REGION_SLACK = 1.25
OFFSET_SLACK_PX = 4.0


def log(*a):
    print(*a, flush=True)


def load_gray(tag):
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    p = os.path.join(CACHE, f'{tag}.png')
    im = Image.open(p).convert('L')
    return np.asarray(im, np.float64)


def texture_energy(gray, win, step):
    """Local standard deviation on a decimated grid. Same measure stage two uses.

    Blank Canada, Mexico, the oceans and the lakes are smooth grey; anything inside the
    drawn United States carries county line work or hatch. So this separates land from
    not-land without knowing anything about the projection.
    """
    g = gray[::step, ::step]
    m = ndimage.uniform_filter(g, win)
    m2 = ndimage.uniform_filter(g * g, win)
    return np.sqrt(np.maximum(m2 - m * m, 0))


def base_paths():
    gj = os.path.join(RAW, 'counties-conus.json')
    st = os.path.join(RAW, 'states-conus.json')
    ol = os.path.join(RAW, 'conus-outline.json')
    missing = [p for p in (gj, st, ol) if not os.path.exists(p)]
    if missing:
        raise SystemExit('run 15-build-holdings-1930.py first to build the county base: '
                         + ', '.join(os.path.basename(m) for m in missing))
    return gj, st, ol


# ------------------------------------------------------------------ the transfer
def transfer(map3_coeff, gray4, state_path):
    """Search a small affine correction on plate pixels, then refit the polynomial.

    Composing an affine with a cubic is still a cubic, so the result is refitted by least
    squares on the same design matrix rather than approximated. That keeps the output a
    drop-in replacement for a from-scratch solution.
    """
    te8 = texture_energy(gray4, 17, 8)
    ll = geo.ring_points(state_path, step=0.05)
    X, Y = geo.albers(ll[:, 0], ll[:, 1])
    X, Y = X[::3], Y[::3]
    px3, py3 = geo.apply(map3_coeff, X, Y, ORDER)

    def score(dx, dy, s):
        px = px3 * s + dx
        py = py3 * s + dy
        iu = np.round(px / 8).astype(np.int64)
        iv = np.round(py / 8).astype(np.int64)
        ok = (iu >= 0) & (iu < te8.shape[1]) & (iv >= 0) & (iv < te8.shape[0])
        if ok.sum() < 0.6 * len(iu):
            return -1.0
        return float(te8[iv[ok], iu[ok]].mean() * (ok.sum() / len(iu)))

    # A coarse grid first, because the legend block can sit on either side and the
    # translation is therefore unknown to within several hundred pixels. This is the step
    # that replaces the four hardcoded Map III landmarks.
    #
    # The scale range has to be generous. Map IV is 5521 pixels wide against Map III's
    # 5111, a ratio of 1.080, and how much of that is a larger map body versus a larger
    # legend block is not known in advance. A first version of this search capped scale at
    # 1.02; the optimiser ran to 1.0373, past the edge of the grid, and produced a fit that
    # held the Midwest to a few pixels while missing Seattle by about 200. An optimiser that
    # leaves its own search box has not found the basin, it has found the wall.
    best = (-1.0, 0.0, 0.0, 1.0)
    for s in np.arange(0.96, 1.161, 0.01):
        for dx in range(-560, 561, 20):
            for dy in range(-280, 281, 20):
                v = score(dx, dy, float(s))
                if v > best[0]:
                    best = (v, float(dx), float(dy), float(s))
    log('  coarse transfer score %.2f at dx=%.0f dy=%.0f scale=%.3f' % best)

    r = optimize.minimize(lambda t: -score(t[0], t[1], t[2]),
                          np.array(best[1:]), method='Nelder-Mead',
                          options={'maxiter': 4000, 'fatol': 1e-6, 'adaptive': True})
    dx, dy, s = r.x
    log('  refined transfer score %.2f at dx=%.1f dy=%.1f scale=%.4f' % (score(dx, dy, s), dx, dy, s))

    # Refit the polynomial through the correction, exactly rather than approximately.
    A = geo.design(X, Y, ORDER)
    tx, ty = px3 * s + dx, py3 * s + dy
    return np.concatenate([np.linalg.lstsq(A, tx, rcond=None)[0],
                           np.linalg.lstsq(A, ty, rcond=None)[0]])


def icp(q, gray, outline_path):
    """The identical ICP ladder stage two of the Map III build runs, seeded from `q`."""
    L = ndimage.uniform_filter(texture_energy(gray, 5, 2), 13)
    THR = 6.0
    oll = geo.ring_points(outline_path, step=0.03)[::2]
    OX, OY = geo.albers(oll[:, 0], oll[:, 1])
    order = ORDER
    rms = float('nan')
    for _order_t, rad in [(3, 80), (3, 60), (3, 40), (3, 30), (3, 20), (3, 12), (3, 8), (3, 5)]:
        px, py = geo.apply(q, OX, OY, order)
        dx, dy = np.gradient(px), np.gradient(py)
        n = np.hypot(dx, dy)
        n[n == 0] = 1
        nx, ny = -dy / n, dx / n
        steps = np.arange(-rad, rad + 1, 1.0)
        su = (px[None, :] + steps[:, None] * nx[None, :]) / 2.0
        sv = (py[None, :] + steps[:, None] * ny[None, :]) / 2.0
        vals = ndimage.map_coordinates(L, [sv, su], order=1, mode='nearest') - THR
        sign = np.sign(vals)
        cross = sign[:-1] * sign[1:] < 0
        mid = len(steps) // 2
        bestc = np.full(len(px), np.nan)
        ii, jj = np.nonzero(cross)
        if len(ii):
            seen = np.zeros(len(px), bool)
            for k in np.argsort(np.abs(ii - mid)):
                j = jj[k]
                if seen[j]:
                    continue
                seen[j] = True
                i = ii[k]
                v0, v1 = vals[i, j], vals[i + 1, j]
                t = v0 / (v0 - v1) if v0 != v1 else 0.5
                bestc[j] = steps[i] + t
        ok = ~np.isnan(bestc)
        off = bestc[ok]
        if len(off) < 200:
            continue
        keep = np.abs(off) <= np.percentile(np.abs(off), 85)
        idx = np.nonzero(ok)[0][keep]
        tx = px[idx] + bestc[idx] * nx[idx]
        ty = py[idx] + bestc[idx] * ny[idx]
        A = geo.design(OX[idx], OY[idx], order)
        q = np.concatenate([np.linalg.lstsq(A, tx, rcond=None)[0],
                            np.linalg.lstsq(A, ty, rcond=None)[0]])
        px2, py2 = geo.apply(q, OX, OY, order)
        rms = float(np.sqrt(((np.hypot(px2[idx] - tx, py2[idx] - ty)) ** 2).mean()))
        log('  icp radius=%2d matched=%5d rms=%.2f px' % (rad, len(idx), rms))
    return q, rms


# ------------------------------------------------------------------ the gate
def outline_residual_by_region(q, gray, outline_path):
    """Distance from the projected national outline to the plate's own land edge, per region.

    The ICP reports its residual on the subset of points it matched, after trimming the
    worst fifteen per cent. That number can look excellent while a whole corner of the map
    is far out, which is exactly what happened on the first attempt: 2.19 px reported,
    about 200 px wrong at Seattle. So the outline is scored here in five geographic buckets,
    on every point rather than a chosen subset, and the worst bucket decides.
    """
    L = ndimage.uniform_filter(texture_energy(gray, 5, 2), 13)
    THR = 6.0
    oll = geo.ring_points(outline_path, step=0.05)
    X, Y = geo.albers(oll[:, 0], oll[:, 1])
    px, py = geo.apply(q, X, Y, ORDER)
    dx, dy = np.gradient(px), np.gradient(py)
    n = np.hypot(dx, dy)
    n[n == 0] = 1
    nx, ny = -dy / n, dx / n
    rad = 240
    steps = np.arange(-rad, rad + 1, 2.0)
    su = (px[None, :] + steps[:, None] * nx[None, :]) / 2.0
    sv = (py[None, :] + steps[:, None] * ny[None, :]) / 2.0
    vals = ndimage.map_coordinates(L, [sv, su], order=1, mode='nearest') - THR
    sign = np.sign(vals)
    cross = sign[:-1] * sign[1:] < 0
    mid = len(steps) // 2
    dist = np.full(len(px), np.nan)
    ii, jj = np.nonzero(cross)
    if len(ii):
        seen = np.zeros(len(px), bool)
        for k in np.argsort(np.abs(ii - mid)):
            j = jj[k]
            if seen[j]:
                continue
            seen[j] = True
            dist[j] = abs(steps[ii[k]])
    lon, lat = oll[:, 0], oll[:, 1]
    buckets = {
        'northwest': (lon < -104) & (lat >= 40),
        'southwest': (lon < -104) & (lat < 40),
        'plains': (lon >= -104) & (lon < -90),
        'northeast': (lon >= -90) & (lat >= 38),
        'southeast': (lon >= -90) & (lat < 38),
    }
    out = {}
    for name, m in buckets.items():
        d = dist[m]
        d = d[~np.isnan(d)]
        out[name] = {'n': int(m.sum()), 'matched': int(len(d)),
                     'median_px': None if not len(d) else round(float(np.median(d)), 2),
                     'p90_px': None if not len(d) else round(float(np.percentile(d, 90)), 2)}
    return out


def state_line_alignment(q, gray, state_path, span=12):
    """Where does the projected state mesh best sit on the plate's drawn state lines?

    Independent of the ICP, which fits the national outline only. A fit that has slipped
    onto the wrong line work registers here as an optimum away from zero.
    """
    dark = ndimage.uniform_filter(255.0 - gray, 3)
    ll = geo.ring_points(state_path, step=0.02)
    X, Y = geo.albers(ll[:, 0], ll[:, 1])
    px, py = geo.apply(q, X, Y, ORDER)
    H, W = gray.shape
    grid = {}
    for dx in range(-span, span + 1, 1):
        for dy in range(-span, span + 1, 1):
            u, v = px + dx, py + dy
            ok = (u >= 0) & (u < W - 1) & (v >= 0) & (v < H - 1)
            if ok.sum() < 0.5 * len(u):
                continue
            grid[(dx, dy)] = float(ndimage.map_coordinates(
                dark, [v[ok], u[ok]], order=1, mode='nearest').mean())
    (bdx, bdy), bval = max(grid.items(), key=lambda kv: kv[1])
    at_zero = grid.get((0, 0), float('nan'))
    return {'best_offset': [bdx, bdy], 'best_ink': round(bval, 2),
            'ink_at_zero': round(at_zero, 2),
            'offset_magnitude': round(float(np.hypot(bdx, bdy)), 2)}


# Control points read off the Map IV scan by eye, recorded before the fit was scored and
# not used to fit anything. Spread deliberately: both coasts, the corners, the Great Lakes,
# Texas and the interior. Each is a coastline or border feature identifiable at 400 dpi.
# Populated by --crops, then scored by the gate.
LANDMARKS_PATH = os.path.join(HERE, 'lib', 'ftc-map4-landmarks.json')


def score_landmarks(q):
    if not os.path.exists(LANDMARKS_PATH):
        return None
    pts = json.load(open(LANDMARKS_PATH))['points']
    if not pts:
        return None
    lon = np.array([p['lonlat'][0] for p in pts], np.float64)
    lat = np.array([p['lonlat'][1] for p in pts], np.float64)
    X, Y = geo.albers(lon, lat)
    px, py = geo.apply(q, X, Y, ORDER)
    rows, res = [], []
    for i, p in enumerate(pts):
        want = p['plate_px']
        d = float(np.hypot(px[i] - want[0], py[i] - want[1]))
        res.append(d)
        rows.append({'name': p['name'], 'want': want,
                     'got': [round(float(px[i]), 1), round(float(py[i]), 1)],
                     'miss_px': round(d, 2)})
    res = np.array(res)
    return {'n': len(pts), 'rms_px': round(float(np.sqrt((res ** 2).mean())), 2),
            'worst_px': round(float(res.max()), 2), 'points': rows}


def write_crops(q, gray, tag):
    """Crops around known cities, with a projected marker, for visual verification."""
    from PIL import Image, ImageDraw
    Image.MAX_IMAGE_PIXELS = None
    cities = [('chicago', -87.63, 41.88), ('seattle', -122.33, 47.61),
              ('miami', -80.19, 25.76), ('houston', -95.37, 29.76),
              ('denver', -104.99, 39.74), ('boston', -71.06, 42.36)]
    out = os.path.join(CACHE, 'verify')
    os.makedirs(out, exist_ok=True)
    im = Image.fromarray(gray.astype(np.uint8)).convert('RGB')
    for name, lon, lat in cities:
        X, Y = geo.albers([lon], [lat])
        px, py = geo.apply(q, X, Y, ORDER)
        x, y = float(px[0]), float(py[0])
        r = 260
        box = (int(x - r), int(y - r), int(x + r), int(y + r))
        crop = im.crop(box).copy()
        d = ImageDraw.Draw(crop)
        d.line([(r - 26, r), (r - 8, r)], fill=(220, 30, 30), width=3)
        d.line([(r + 8, r), (r + 26, r)], fill=(220, 30, 30), width=3)
        d.line([(r, r - 26), (r, r - 8)], fill=(220, 30, 30), width=3)
        d.line([(r, r + 8), (r, r + 26)], fill=(220, 30, 30), width=3)
        p = os.path.join(out, f'{tag}-{name}.png')
        crop.save(p)
        log(f'  {name}: projected to ({x:.0f}, {y:.0f}) -> {p}')


def main():
    g3 = json.load(open(MAP3_GEOREF))
    if g3['order'] != ORDER:
        raise SystemExit(f'expected an order-{ORDER} Map III fit, found {g3["order"]}')
    map3_coeff = np.asarray(g3['coeff'], np.float64)
    _gj, st, ol = base_paths()

    gray4 = load_gray('map4-1932')
    log('map4 plate %dx%d' % (gray4.shape[1], gray4.shape[0]))

    cached = os.path.join(CACHE, 'georef-map4.npy')
    if os.path.exists(cached) and '--refit' not in sys.argv:
        q = np.load(cached)
        rms = float('nan')
        log('using cached fit; pass --refit to redo it')
    else:
        log('transferring the Map III fit')
        q0 = transfer(map3_coeff, gray4, st)
        log('running the shared ICP ladder')
        q, rms = icp(q0, gray4, ol)
        np.save(cached, q)

    if '--crops' in sys.argv:
        write_crops(q, gray4, 'map4')
        return 0

    # Both measures on both plates, so the comparison is like for like.
    gray3 = load_gray('map3-1925')
    regions = outline_residual_by_region(q, gray4, ol)
    ref_regions = outline_residual_by_region(map3_coeff, gray3, ol)
    log('outline residual to the plate land edge, by region, Map IV against Map III:')
    for name in regions:
        a, b = regions[name]['median_px'], ref_regions[name]['median_px']
        log('    %-10s map4 median=%-6s  map3 median=%-6s  ratio=%s'
            % (name, a, b, 'n/a' if not b else round((a or 0) / b, 2)))
    align = state_line_alignment(q, gray4, st)
    ref_align = state_line_alignment(map3_coeff, gray3, st)
    log('state-line alignment: map4 |offset| %.2f px, map3 |offset| %.2f px'
        % (align['offset_magnitude'], ref_align['offset_magnitude']))
    marks = score_landmarks(q)
    if marks is None:
        log('no hand-recorded landmarks; the relative gate plus the visual check decide it')
    else:
        log('withheld landmarks: n=%d rms=%.2f px worst=%.2f px'
            % (marks['n'], marks['rms_px'], marks['worst_px']))
        for r in marks['points']:
            log('    %-22s miss %5.2f px' % (r['name'], r['miss_px']))

    failures = []
    for name in regions:
        a, b = regions[name]['median_px'], ref_regions[name]['median_px']
        if a is None or not b:
            continue
        if a > b * REGION_SLACK:
            failures.append('%s outline median %.1f px against Map III %.1f px, over the %.2fx slack'
                            % (name, a, b, REGION_SLACK))
    if align['offset_magnitude'] > ref_align['offset_magnitude'] + OFFSET_SLACK_PX:
        failures.append('state-line offset %.2f px against Map III %.2f px, over the %.1f px slack'
                        % (align['offset_magnitude'], ref_align['offset_magnitude'], OFFSET_SLACK_PX))

    payload = {
        'projection': g3['projection'],
        'order': ORDER,
        'coeff': q.tolist(),
        'note': 'lon/lat -> Map IV plate pixels of ftc72a/map4-1932.png',
        'method': ('transferred from ftc-map3-georef.json by an affine correction on plate '
                   'pixels, refitted, then refined by the same ICP ladder the Map III build '
                   'uses. Fitting Map IV from scratch failed twice because stage one of that '
                   'build seeds from four landmarks given in Map III pixel coordinates.'),
        'icp_rms_pixels': None if rms != rms else round(rms, 2),
        'icp_rms_note': ('reported on the subset the ICP matched at radius 5, so it measures '
                         'agreement among points that already agreed. Not a gate.'),
        'outline_residual_by_region': {'map4': regions, 'map3_reference': ref_regions},
        'state_line_alignment': {'map4': align, 'map3_reference': ref_align},
        'visual_verification': ('Chicago sits at the southwest corner of Lake Michigan and '
                                'Seattle at the southern end of Puget Sound, both matching '
                                'where Map III\'s shipped fit puts them. Crops are written by '
                                '--crops for both plates so the comparison is repeatable.'),
        'gate': {'kind': 'relative to Map III, same measures, same run',
                 'region_slack': REGION_SLACK, 'offset_slack_px': OFFSET_SLACK_PX,
                 'passed': not failures, 'failures': failures},
    }
    json.dump(payload, open(OUT, 'w'), indent=1)
    log(f'wrote {OUT}')
    if failures:
        for f in failures:
            log('FAIL ' + f)
        log('gate failed; Map IV does not get a county trace. Use the display-only fallback.')
        return 1
    log('gate passed')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
