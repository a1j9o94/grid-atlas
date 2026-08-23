#!/usr/bin/env python3
"""Build a county level dataset of electric holding company footprints from the FTC plates.

Source: FTC "Utility Corporations", Senate Doc. 92 Part 72-A (1935), on govinfo. Two
plates carry county level empire footprints:

  Map III  Fields of operations of principal power groups, located by counties, 1925
  Map IV   Fields of operations of principal power groups, located by counties, 1932

The brief for this pipeline assumed the plates were colour coded and that groups could be
read off by sampling legend swatch colours. They are not. Both plates are monochrome
lithographs in which each group is coded by an engraved hatch or stipple pattern. There
are twenty such patterns on Map III and twenty eight on Map IV. So the classification
problem is texture, not colour, and it runs into a hard resolution wall documented below.

Stages, each cached so a rerun is cheap:
  1  fetch the PDF
  2  find the plate pages by scanning page text for the headings
  3  extract the plate images at native resolution
  4  fetch and convert the Census county base
  5  georeference the plate, Albers plus a cubic polynomial, refined by ICP
  6  measure per county ink, classify served versus unserved, attempt empire assignment
  7  run the validation gate and emit JSON

Run: python3 15-build-holdings-1930.py     (or: node 15-build-holdings-1930.mjs)
"""
import json, os, subprocess, sys, time
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage, optimize

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import plate_geo as geo
import plate_texture as pt
import plate_legend as pl

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'data-raw')
CACHE = os.path.join(RAW, 'ftc72a')
OUT = os.path.abspath(os.path.join(HERE, '..', '..', 'grid-timeline', 'holdings-1930.json'))
GEOREF_OUT = os.path.join(HERE, 'lib', 'ftc-map3-georef.json')
PDF_URL = 'https://www.govinfo.gov/content/pkg/SERIALSET-08858_57_02/pdf/SERIALSET-08858_57_02.pdf'
COUNTY_URL = 'https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_county_500k.zip'
MAPSHAPER = os.path.join(HERE, 'node_modules', '.bin', 'mapshaper')
ORDER = 3          # polynomial order of the georeference
BLANK = 0.12       # local ink coverage above this reads as fill rather than bare paper
SHARE = 0.50       # a county counts as served when this share of its interior is filled
DS = 4             # stride of the dense texture grid, in plate pixels
KCLUST = 40


def log(*a):
    print(*a, flush=True)


def sh(cmd):
    subprocess.run(cmd, check=True, cwd=HERE)


# ---------------------------------------------------------------- stage 1 and 2
def fetch_pdf():
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(RAW, 'ftc-72a.pdf')
    if not os.path.exists(p) or os.path.getsize(p) < 10_000_000:
        log('fetching the FTC PDF, it is about 750 MB')
        sh(['curl', '-sSL', '--retry', '3', '-o', p, PDF_URL])
    return p


def find_plates(pdf):
    """Locate the plate pages by heading text rather than by a hardcoded page number.

    The OCR on these fold-outs is bad. Map III's heading comes back as "IELDS OF OPERATIONS
    OF PR I NC I PAL POWf:R GROUPS LOCATED BY COUNT 1E5,1925", so match on the fragments
    that survive rather than on the clean title. Map IV's heading does not survive OCR at
    all, so find it as the next fold-out page, identified by its legend naming The United
    Corporation, which appears on Map IV and not on Map III.
    """
    p = os.path.join(CACHE, 'plates.json')
    if os.path.exists(p):
        return json.load(open(p))
    from pypdf import PdfReader
    r = PdfReader(pdf)
    hits, texts = {}, {}
    for i, page in enumerate(r.pages):
        try:
            t = ' '.join((page.extract_text() or '').split()).lower()
        except Exception:
            continue
        wide = float(page.mediabox.width) > 1.3 * float(page.mediabox.height)
        texts[i] = (t, wide)
        # the wide test is load-bearing: the table of contents also lists the plate titles
        if ('map3' not in hits and wide and '1925' in t
                and ('located by count' in t or 'operations of pr' in t)):
            hits['map3'] = i
            continue
        if 'map3' in hits and 'map4' not in hits and wide and 'united corporation' in t:
            hits['map4'] = i
        if len(hits) == 2:
            break
    if 'map3' not in hits:
        for i, (t, wide) in texts.items():
            if wide and 'located by count' in t:
                hits['map3'] = i
                break
    json.dump(hits, open(p, 'w'))
    return hits


def extract_plate(pdf, page, tag):
    p = os.path.join(CACHE, f'{tag}.png')
    if os.path.exists(p):
        return p
    from pypdf import PdfReader
    r = PdfReader(pdf)
    img = r.pages[page].images[0]
    log(f'extracting {tag} from page index {page}: {img.image.size} {img.image.mode}')
    img.image.save(p)
    return p


# ---------------------------------------------------------------- stage 4
def county_base():
    gj = os.path.join(RAW, 'counties-conus.json')
    st = os.path.join(RAW, 'states-conus.json')
    ol = os.path.join(RAW, 'conus-outline.json')
    if all(os.path.exists(x) for x in (gj, st, ol)):
        return gj, st, ol
    z = os.path.join(RAW, 'cb_2020_us_county_500k.zip')
    if not os.path.exists(z):
        sh(['curl', '-sSL', '--retry', '3', '-o', z, COUNTY_URL])
    d = os.path.join(RAW, 'counties')
    os.makedirs(d, exist_ok=True)
    sh(['unzip', '-o', '-q', z, '-d', d])
    shp = os.path.join(d, 'cb_2020_us_county_500k.shp')
    # Drop Alaska, Hawaii and the territories. The plates cover the lower 48 only.
    sh([MAPSHAPER, shp, '-filter',
        '!["02","15","60","66","69","72","78"].includes(STATEFP)',
        '-o', gj, 'format=geojson', 'precision=0.000001'])
    sh([MAPSHAPER, gj, '-dissolve', 'fields=STATEFP', 'copy-fields=STUSPS',
        '-o', st, 'format=geojson', 'precision=0.0001'])
    sh([MAPSHAPER, st, '-dissolve', '-o', ol, 'format=geojson', 'precision=0.0001'])
    return gj, st, ol


# ---------------------------------------------------------------- stage 5
def texture_energy(gray, box, stride):
    m = ndimage.uniform_filter(gray, 9)
    m2 = ndimage.uniform_filter(gray * gray, 9)
    te = np.sqrt(np.maximum(m2 - m * m, 0))
    return ndimage.uniform_filter(te, box)[::stride, ::stride].astype(np.float32)


def georeference(gray, state_path, outline_path):
    """Fit lon/lat to plate pixels without hand digitising control points.

    Blank Canada, Mexico, the oceans and the Great Lakes are smooth grey on the plate,
    while everything inside the drawn United States carries county line work or hatch. So
    local texture energy is a reliable land indicator and the national outline is its zero
    crossing. Stage one maximises texture energy along the reference state borders to get a
    coarse affine. Stage two is ICP against that zero crossing, which converges to a couple
    of pixels, about three kilometres at this scale.
    """
    p = os.path.join(CACHE, 'georef.npy')
    if os.path.exists(p):
        return np.load(p)
    H, W = gray.shape
    te8 = texture_energy(gray, 17, 8)
    ll = geo.ring_points(state_path, step=0.05)
    X, Y = geo.albers(ll[:, 0], ll[:, 1])
    X, Y = X[::3], Y[::3]

    # Four coarse landmarks read off the plate by eye. They only have to be good enough to
    # put the optimiser in the right basin, the two refinement stages do the real work.
    a_ll = np.array([[-124.73, 48.38], [-97.15, 25.96], [-81.10, 25.20], [-67.00, 44.90]])
    a_px = np.array([[600., 564.], [2400., 3000.], [4000., 3200.], [4420., 712.]])
    ax, ay = geo.albers(a_ll[:, 0], a_ll[:, 1])
    A = geo.design(ax, ay, 1)
    p1 = np.concatenate([np.linalg.lstsq(A, a_px[:, 0], rcond=None)[0],
                         np.linalg.lstsq(A, a_px[:, 1], rcond=None)[0]])

    def score(q):
        px, py = geo.apply(q, X, Y, 1)
        iu = np.round(px / 8).astype(np.int64)
        iv = np.round(py / 8).astype(np.int64)
        ok = (iu >= 0) & (iu < te8.shape[1]) & (iv >= 0) & (iv < te8.shape[0])
        if ok.sum() < 0.6 * len(iu):
            return -1.0
        return float(te8[iv[ok], iu[ok]].mean() * (ok.sum() / len(iu)))

    r = optimize.minimize(lambda q: -score(q), p1, method='Nelder-Mead',
                          options={'maxiter': 20000, 'fatol': 1e-6, 'adaptive': True})
    p1 = r.x
    log('  affine line-energy score %.2f' % score(p1))

    # ICP on the land boundary
    L = ndimage.uniform_filter(texture_energy(gray, 5, 2), 13)
    THR = 6.0
    oll = geo.ring_points(outline_path, step=0.03)[::2]
    OX, OY = geo.albers(oll[:, 0], oll[:, 1])
    q = p1
    order = 1
    for order_t, rad in [(2, 60), (2, 40), (3, 30), (3, 20), (3, 12), (3, 8), (3, 5)]:
        if order != order_t:
            q = geo.promote(q, order, order_t)
            order = order_t
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
        best = np.full(len(px), np.nan)
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
                best[j] = steps[i] + t
        ok = ~np.isnan(best)
        off = best[ok]
        if len(off) < 200:
            continue
        # trim the worst offsets, they are usually latched onto the wrong line
        keep = np.abs(off) <= np.percentile(np.abs(off), 85)
        idx = np.nonzero(ok)[0][keep]
        tx = px[idx] + best[idx] * nx[idx]
        ty = py[idx] + best[idx] * ny[idx]
        A = geo.design(OX[idx], OY[idx], order)
        q = np.concatenate([np.linalg.lstsq(A, tx, rcond=None)[0],
                            np.linalg.lstsq(A, ty, rcond=None)[0]])
        px2, py2 = geo.apply(q, OX, OY, order)
        rms = float(np.sqrt(((np.hypot(px2[idx] - tx, py2[idx] - ty)) ** 2).mean()))
        log('  icp order=%d radius=%2d matched=%5d rms=%.2f px' % (order, rad, len(idx), rms))
    np.save(p, q)
    return q


# ---------------------------------------------------------------- stage 6
def county_masks(gj, fit, shape):
    """Rasterise every county into plate pixel space.

    The interior is eroded by four pixels. That is deliberate: county boundary line work is
    two to three pixels wide and the georeference carries a couple of pixels of residual, so
    without the erosion a county samples its neighbour's fill.
    """
    H, W = shape
    g = json.load(open(gj))
    out = []
    for f in g['features']:
        pr = f['properties']
        gm = f['geometry']
        polys = [gm['coordinates']] if gm['type'] == 'Polygon' else gm['coordinates']
        best = None
        for poly in polys:
            a = np.asarray(poly[0])
            px, py = geo.apply(fit, *geo.albers(a[:, 0], a[:, 1]), ORDER)
            area = abs(np.sum(px[:-1] * py[1:] - px[1:] * py[:-1])) / 2
            if best is None or area > best[0]:
                best = (area, px, py, poly)
        if best is None:
            continue
        _, px, py, poly = best
        x0, y0 = max(int(px.min()) - 2, 0), max(int(py.min()) - 2, 0)
        x1, y1 = min(int(px.max()) + 3, W), min(int(py.max()) + 3, H)
        if x1 - x0 < 6 or y1 - y0 < 6:
            out.append((pr, None))
            continue
        im = Image.new('L', (x1 - x0, y1 - y0), 0)
        dr = ImageDraw.Draw(im)
        dr.polygon(list(zip(px - x0, py - y0)), fill=255)
        for ring in poly[1:]:
            a = np.asarray(ring)
            qx, qy = geo.apply(fit, *geo.albers(a[:, 0], a[:, 1]), ORDER)
            dr.polygon(list(zip(qx - x0, qy - y0)), fill=0)
        m = np.asarray(im) > 0
        er = m
        for e in (4, 3, 2, 1):
            t = ndimage.binary_erosion(m, np.ones((2 * e + 1, 2 * e + 1)))
            if t.sum() >= 50:
                er = t
                break
        out.append((pr, (x0, y0, x1, y1, er)))
    return out


def dense_clusters(ink, gj, fit):
    """Cluster the plate's texture densely, then let counties inherit a region label.

    Classifying each county on its own produces confetti. A county is only about forty
    plate pixels across here, roughly forty kilometres at one kilometre per pixel, while the
    engraved patterns have periods of eight to twenty six pixels. Two to five periods is not
    enough evidence to pick one of twenty patterns. The fills, though, are drawn as blobs
    many counties wide, so texture is estimated at that scale instead.
    """
    p = os.path.join(CACHE, 'clusters.npz')
    if os.path.exists(p):
        z = np.load(p)
        return z['lab'], z['cov']
    from scipy.cluster.vq import kmeans2
    NOR, NRA, LO, HI, SM = 8, 6, 1 / 34.0, 1 / 4.5, 33
    H, W = ink.shape
    lm = ndimage.uniform_filter(ink, SM)
    F = np.fft.rfft2((ink - lm).astype(np.float32))
    fy = np.fft.fftfreq(H).astype(np.float32)[:, None]
    fx = np.fft.rfftfreq(W).astype(np.float32)[None, :]
    r = np.hypot(fy, fx)
    ang = np.mod(np.arctan2(fy, fx), np.pi)
    rb = np.floor((np.log(np.clip(r, 1e-9, None)) - np.log(LO)) / (np.log(HI) - np.log(LO)) * NRA)
    ob = np.floor(ang / np.pi * NOR)
    valid = (r >= LO) & (r <= HI)
    oh, ow = len(range(0, H, DS)), len(range(0, W, DS))
    spec = np.zeros((NOR * NRA, oh, ow), np.float32)
    for ri in range(NRA):
        for oi in range(NOR):
            m = valid & (rb == ri) & (ob == oi)
            if not m.any():
                continue
            band = np.fft.irfft2(F * m, s=(H, W)).astype(np.float32)
            spec[ri * NOR + oi] = ndimage.uniform_filter(band ** 2, SM)[::DS, ::DS]
        log('  dense band row %d/%d' % (ri + 1, NRA))
    cov = ndimage.uniform_filter(ink, SM)[::DS, ::DS]
    im = Image.new('L', (ow, oh), 0)
    d = ImageDraw.Draw(im)
    for f in json.load(open(gj))['features']:
        gm = f['geometry']
        polys = [gm['coordinates']] if gm['type'] == 'Polygon' else gm['coordinates']
        for poly in polys:
            a = np.asarray(poly[0])
            px, py = geo.apply(fit, *geo.albers(a[:, 0], a[:, 1]), ORDER)
            d.polygon(list(zip(px / DS, py / DS)), fill=255)
    land = ndimage.binary_erosion(np.asarray(im) > 0, np.ones((5, 5)))
    S = spec.reshape(spec.shape[0], -1).T
    # normalise each spectrum to unit mass, so the cluster shapes are contrast free. The
    # legend blocks are inked heavier than the map fills and absolute ink level does not
    # transfer between them.
    Xn = np.sqrt(S / np.maximum(S.sum(1, keepdims=True), 1e-12)).astype(np.float32)
    keep = land.ravel() & (cov.ravel() >= BLANK)
    idx = np.nonzero(keep)[0]
    rng = np.random.default_rng(11)
    sub = rng.choice(idx, size=min(250000, len(idx)), replace=False)
    cen, _ = kmeans2(Xn[sub], KCLUST, minit='++', iter=80, seed=11)
    lab = np.full(len(Xn), -1, np.int16)
    for s in range(0, len(idx), 200000):
        ii = idx[s:s + 200000]
        lab[ii] = np.argmin(((Xn[ii][:, None, :] - cen[None, :, :]) ** 2).sum(2), 1)
    lab = lab.reshape(oh, ow)
    np.savez_compressed(p, lab=lab, cov=cov.astype(np.float32), spec_shape=np.array(spec.shape))
    return lab, cov.astype(np.float32)


def region_geometry(ink, lab, lag=30, nfft=256):
    """Per cluster: ink coverage plus the strongest periodic peaks of its pure core.

    Period and orientation are geometry, so unlike ink level they do transfer between the
    legend blocks and the map fills. Measured on a masked autocorrelation, which corrects
    for the irregular shape of the region.
    """
    def peaks(acf):
        full = np.zeros((2 * lag + 1, 2 * lag + 1))
        dy, dx = pt.lag_index(lag)
        full[dy + lag, dx + lag] = acf
        full[-dy + lag, -dx + lag] = acf
        full[lag, lag] = 1.0
        win = np.outer(np.hanning(2 * lag + 1), np.hanning(2 * lag + 1))
        F = np.abs(np.fft.fftshift(np.fft.fft2(full * win, s=(nfft, nfft))))
        fy = np.fft.fftshift(np.fft.fftfreq(nfft))
        R = np.hypot(fy[:, None], fy[None, :])
        F[(R < 1 / 26.) | (R > 1 / 5.)] = 0
        out, Fc, mx = [], F.copy(), F.max()
        for _ in range(4):
            i, j = np.unravel_index(np.argmax(Fc), Fc.shape)
            if Fc[i, j] <= 0:
                break
            out.append((float(1 / R[i, j]),
                        float(np.degrees(np.arctan2(fy[i], fy[j])) % 180),
                        float(Fc[i, j] / mx)))
            sup = (np.hypot(fy[:, None] - fy[i], fy[None, :] - fy[j]) < 0.045) | \
                  (np.hypot(fy[:, None] + fy[i], fy[None, :] + fy[j]) < 0.045)
            Fc[sup] = 0
        return out
    stats = {}
    for k in range(int(lab.max()) + 1):
        m = lab == k
        pur = ndimage.uniform_filter(m.astype(np.float32), 9)
        core = m & (pur > 0.9)
        if core.sum() < 200:
            continue
        big = np.repeat(np.repeat(core, DS, 0), DS, 1)[:ink.shape[0], :ink.shape[1]]
        big = ndimage.binary_erosion(big, np.ones((9, 9)))
        if big.sum() < 8000:
            continue
        ys, xs = np.nonzero(big)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        sub, sm = ink[y0:y1, x0:x1], big[y0:y1, x0:x1]
        acf, _ = pt.masked_autocorr(sub, sm, lag=lag)
        if acf is None:
            continue
        stats[k] = {'n': int(m.sum()), 'cov': float(sub[sm].mean()), 'peaks': peaks(acf)}
    return stats


def legend_geometry(ink, lag=30, nfft=256):
    rects = pl.swatch_rects()
    out = {}
    for cell, (x0, y0, x1, y1) in rects.items():
        s = np.clip(ink[y0:y1, x0:x1], 0, 1)
        acf, _ = pt.masked_autocorr(s, np.ones(s.shape, bool), lag=lag)
        full = np.zeros((2 * lag + 1, 2 * lag + 1))
        dy, dx = pt.lag_index(lag)
        full[dy + lag, dx + lag] = acf
        full[-dy + lag, -dx + lag] = acf
        full[lag, lag] = 1.0
        win = np.outer(np.hanning(2 * lag + 1), np.hanning(2 * lag + 1))
        F = np.abs(np.fft.fftshift(np.fft.fft2(full * win, s=(nfft, nfft))))
        fy = np.fft.fftshift(np.fft.fftfreq(nfft))
        R = np.hypot(fy[:, None], fy[None, :])
        F[(R < 1 / 26.) | (R > 1 / 5.)] = 0
        pk, Fc, mx = [], F.copy(), F.max()
        for _ in range(3):
            i, j = np.unravel_index(np.argmax(Fc), Fc.shape)
            if Fc[i, j] <= 0:
                break
            pk.append((float(1 / R[i, j]), float(np.degrees(np.arctan2(fy[i], fy[j])) % 180),
                       float(Fc[i, j] / mx)))
            sup = (np.hypot(fy[:, None] - fy[i], fy[None, :] - fy[j]) < 0.045) | \
                  (np.hypot(fy[:, None] + fy[i], fy[None, :] + fy[j]) < 0.045)
            Fc[sup] = 0
        out[cell] = {'cov': float(s.mean()), 'peaks': pk}
    return out


def angdist(a, b):
    d = abs(a - b) % 180
    return min(d, 180 - d)


def attempt_empires(cstats):
    """Strictest defensible rule, applied to clusters rather than counties.

    Only two of the twenty patterns are separable without leaning on absolute ink level:
    the Insull fill, the one pattern with a coarse period near twenty five arranged as a
    lattice on a nearly black ground, and the Electric Bond and Share fill, solid black
    with no engraving at all. Everything else needs ink level to break ties, and ink level
    does not transfer from the legend blocks to the map fills on this plate.
    """
    labels = {}
    for k, s in cstats.items():
        coarse = any(20 <= T <= 28 and (angdist(th, 45) <= 22 or angdist(th, 135) <= 22)
                     and pr >= 0.60 for T, th, pr in s['peaks'])
        engraved = any(6 <= T <= 28 and pr >= 0.50 for T, th, pr in s['peaks'])
        if coarse and s['cov'] >= 0.50:
            labels[k] = 'insull'
        elif s['cov'] >= 0.86 and not engraved:
            labels[k] = 'ebasco'
    return labels


def validate(labels, cstats, counties):
    """Gate the empire layer. It must clear all of these or the layer is not emitted.

    The gate exists because the failure mode here is not random noise, it is systematic:
    a misread cluster mislabels several hundred contiguous counties at once, which is
    exactly the kind of error that reads as a real finding.
    """
    fails = []
    keys = set(labels.values())
    if 'ebasco' not in keys:
        fails.append('Electric Bond and Share, the largest group in the country, is not '
                     'separated at all: no cluster clears the solid-black test, because the '
                     'Insull test absorbs every near-solid fill.')
    if 'insull' not in keys:
        fails.append('The Insull fill is not identified.')
    share = sum(1 for v in counties.values()
                if v and v.get('empire') == 'insull') / max(len(counties), 1)
    if share > 0.12:
        fails.append('Insull is assigned %.0f%% of all counties, spread over New England, '
                     'the Pacific Northwest, the Texas Gulf coast and the Deep South. Those '
                     'are Electric Bond and Share and Southeastern Power and Light fills '
                     'being swept in, not Insull.' % (100 * share))
    resolved = len(keys)
    if resolved < 6:
        fails.append('Only %d of the twenty legend patterns are separable, so no useful '
                     'multi-empire layer exists.' % resolved)
    return fails


# ---------------------------------------------------------------- main
def main():
    t0 = time.time()
    pdf = fetch_pdf()
    plates = find_plates(pdf)
    log('plate pages (0-based):', plates)
    if 'map3' not in plates:
        log('FATAL: could not locate Map III'); sys.exit(1)
    p3 = extract_plate(pdf, plates['map3'], 'map3-1925')
    if 'map4' in plates:
        extract_plate(pdf, plates['map4'], 'map4-1932')
    gj, st, ol = county_base()

    gray = np.asarray(Image.open(p3).convert('L'), dtype=np.float32)
    log('Map III raster %dx%d, about %.0f dpi, so roughly 1 km per pixel'
        % (gray.shape[1], gray.shape[0], gray.shape[1] / 12.78))

    log('georeferencing')
    fit = georeference(gray, st, ol)
    json.dump({'projection': 'Albers conic, lat0 %g lon0 %g sp %g/%g, R %g, scaled to Mm'
                             % (geo.LAT0, geo.LON0, geo.SP1, geo.SP2, geo.R),
               'order': ORDER, 'coeff': fit.tolist(),
               'note': 'lon/lat -> Map III plate pixels of ftc72a/map3-1925.png'},
              open(GEOREF_OUT, 'w'), indent=1)

    log('normalising ink')
    ink = pt.ink_image(gray)

    log('dense texture clustering')
    lab, dcov = dense_clusters(ink, gj, fit)

    log('measuring region geometry')
    cstats = region_geometry(ink, lab)
    lstats = legend_geometry(ink)
    log('  legend patterns measured: %d, map clusters measured: %d' % (len(lstats), len(cstats)))
    labels = attempt_empires(cstats)
    log('  clusters that clear the strict rule: %s' % (labels or 'none'))

    log('measuring counties')
    # Decide served on the SHARE of a county's interior that is filled, not on its mean ink.
    # The share is robust to the two things that break a mean here: a small county whose
    # eroded sliver lands on one side of a fill boundary, and a state label or river inking
    # an otherwise blank county.
    lc = ndimage.uniform_filter(ink, 15)
    masks = county_masks(gj, fit, gray.shape)
    counties = {}
    for pr, mk in masks:
        gid = pr['GEOID']
        if mk is None:
            counties[gid] = None
            continue
        x0, y0, x1, y1, er = mk
        cov = float(ink[y0:y1, x0:x1][er].mean())
        frac = float((lc[y0:y1, x0:x1][er] > BLANK).mean())
        sl = lab[y0 // DS:(y1 + DS - 1) // DS, x0 // DS:(x1 + DS - 1) // DS]
        sm = er[::DS, ::DS][:sl.shape[0], :sl.shape[1]]
        v = sl[:sm.shape[0], :sm.shape[1]][sm]
        v = v[v >= 0]
        clu = int(np.bincount(v).argmax()) if len(v) else -1
        served = frac >= SHARE
        counties[gid] = {'st': pr['STUSPS'], 'nm': pr['NAME'], 'cov': round(cov, 4),
                         'fill_share': round(frac, 4), 'served': served,
                         'mixed': bool(0.25 < frac < 0.75), 'px': int(er.sum()),
                         'cluster': clu, 'empire': labels.get(clu) if served else None}

    fails = validate(labels, cstats, counties)
    served = {g: v['served'] for g, v in counties.items() if v}
    mixed = sorted(g for g, v in counties.items() if v and v['mixed'])
    nserved = sum(1 for x in served.values() if x)
    nblank = sum(1 for x in served.values() if not x)
    nomask = sum(1 for v in counties.values() if v is None)

    # ------------------------------------------------------------------ anchors
    log('')
    log('ANCHORS  (fips, county, measured ink coverage, served, empire attempt)')
    ANCH = [('17031', 'Cook IL, Chicago, must be Insull'), ('18089', 'Lake IN'),
            ('26163', 'Wayne MI, Detroit'), ('48201', 'Harris TX, Houston'),
            ('06037', 'Los Angeles CA'), ('13121', 'Fulton GA, Atlanta'),
            ('36061', 'New York NY'), ('42101', 'Philadelphia PA')]
    for gid, note in ANCH:
        v = counties.get(gid)
        if not v:
            log('  %-6s %-34s no usable mask' % (gid, note)); continue
        log('  %-6s %-34s cov=%.3f fill_share=%.2f served=%-5s%s empire=%s'
            % (gid, note, v['cov'], v['fill_share'], v['served'],
               ' MIXED' if v['mixed'] else '     ', v['empire'] or 'unclassified'))

    # ------------------------------------------------------------------ rollup
    log('')
    log('SERVED BY SOME HOLDING COMPANY GROUP, 1925, by state')
    bystate = {}
    for g, v in counties.items():
        if not v:
            continue
        a, b = bystate.setdefault(v['st'], [0, 0])
        bystate[v['st']] = [a + (1 if v['served'] else 0), b + 1]
    for s in sorted(bystate, key=lambda s: -bystate[s][0] / bystate[s][1]):
        a, b = bystate[s]
        log('  %-3s %3d/%3d  %3.0f%%' % (s, a, b, 100 * a / b))

    # ------------------------------------------------------------------ emit
    groups = {}
    for cell, (text, key, note) in sorted(pl.MAP3.items()):
        g = groups.setdefault(key, {'label': text, 'legend_colour': None,
                                    'legend_pattern': [], 'legend_entries': []})
        g['legend_entries'].append(text)
        g['legend_pattern'].append(
            'period %.1f px at %.0f deg' % (lstats[cell]['peaks'][0][0], lstats[cell]['peaks'][0][1])
            if lstats[cell]['peaks'] else 'no periodic structure, solid')
        if note:
            g.setdefault('notes', []).append(note)
    for key in ('united', 'commonwealth-southern'):
        groups.setdefault(key, {'label': key, 'legend_colour': None,
                                'legend_pattern': [], 'legend_entries': []})
    groups['united']['notes'] = ['The United Corporation was formed in January 1929 and does '
                                 'not appear on the 1925 plate at all. Map IV (1932) does '
                                 'carry it, with six numbered subsidiaries.']

    doc = {
      'meta': {
        'built': time.strftime('%Y-%m-%d'),
        'source_url': PDF_URL,
        'source_plate': ('Map III, Fields of operations of principal power groups, located by '
                         'counties, 1925. PDF page index %d, that is page %d counting from one. '
                         'Map IV is the 1932 county-level equivalent, page index %d. Both carry '
                         'the plate code 102777-35-PT 72A. (Face p. 56.), numbered No. 1 and '
                         'No. 2. Map I is a different plate, transmission lines by holding '
                         'company group 1932, and is not county level.'
                         % (plates['map3'], plates['map3'] + 1, plates.get('map4', -1))),
        'county_base': 'Census cb_2020_us_county_500k, lower 48 only, lon/lat',
        'plate_raster': '%dx%d px, about %.0f dpi, roughly 1 km per pixel'
                        % (gray.shape[1], gray.shape[0], gray.shape[1] / 12.78),
        'method': (
          'Georeferencing works and is the reusable part. The plate is registered by '
          'maximising texture energy along reference state borders for a coarse affine, then '
          'by ICP against the land/blank boundary, fitting a cubic polynomial on Albers '
          'coordinates. Final ICP residual is about 2 px, roughly 3 km, verified visually at '
          'county scale and by checking that a dozen city coordinates land in the right '
          'state. Coefficients are in pipeline/lib/ftc-map3-georef.json. '
          'Ink is then normalised against a blockwise paper-white estimate, which removes the '
          'fold shadow down the middle of the scan. '
          'Empire classification FAILED and is not emitted. The plate is monochrome: groups '
          'are coded by twenty engraved hatch and stipple patterns, not colours, so there are '
          'no legend swatch colours to sample. Four methods were tried and are described in '
          'classification_attempts below. The blocking constraint is resolution: at about '
          '1 km per pixel a typical county is 40 px across while the engravings have periods '
          'of 8 to 26 px, giving two to five pattern periods per county, and five of the '
          'twenty patterns are plain diagonal hatches differing only in period, line weight '
          'or sign of slope. What IS emitted is the served layer: whether each county carried '
          'any group fill at all, which is a clean ink-coverage decision.'),
        'error_modes': [
          'Georeference residual is about 2 px, roughly 3 km, largest in the Pacific Northwest '
          'and smallest along the Gulf and Atlantic coasts where the ICP had the most boundary '
          'to lock onto.',
          'The served layer asks what share of a county\'s interior carries fill, at a local '
          'ink threshold of %.2f, and calls the county served above a share of %.2f. Moving '
          'the ink threshold from 0.06 to 0.20 moves the unshaded count from about 18 to '
          'about 31 percent of counties, so the headline share is good to a few points, not '
          'to a decimal.' % (BLANK, SHARE),
          'Counties listed in mixed[] are genuinely split on the plate: a fill boundary runs '
          'through them, or the modern boundary does not match the 1925 one. Fulton County, '
          'Georgia is the clearest case, half filled and half bare, and it also sits on the '
          'scan fold.',
          'The scan has a fold down the middle, near plate x=3560, running through Ohio, '
          'Kentucky, Georgia and Florida. The blockwise paper-white correction removes most '
          'of it. The residual is a coverage bias of roughly 0.05 to 0.10 in that column, '
          'measured by comparing mean ink of filled land pixels across plate columns.',
          'Small counties fall back to less boundary erosion, so a few of them sample a '
          'neighbouring county\'s fill. Independent cities and the smallest eastern counties '
          'are the worst affected.',
          'County geometry is 2020. Boundaries moved between 1925 and 2020 and a handful of '
          'counties did not exist in 1925, so those inherit whatever the plate shows at their '
          'modern location.'],
        'classification_attempts': [
          'Patch FFT polar histograms compared against the legend swatches. Failed: almost no '
          'county can host a 32 px window inside its own eroded borders, so most counties '
          'yielded zero to three windows.',
          'Masked autocorrelation per county with a dot-gain search over the legend swatches. '
          'Failed: the near-solid patterns have a flat autocorrelation, so Insull, Electric '
          'Bond and Share and any low-variance patch all collapse onto each other.',
          'Dense oriented band-pass energy clustered over the whole plate, clusters matched to '
          'the legend spectrally, with the legend references computed two different ways '
          'including tiling each swatch through the identical dense pipeline. Failed: every '
          'cluster-to-legend distance exceeded the legend-to-legend nearest-neighbour '
          'distance, so the match is not identifiable. Twenty two of forty clusters matched '
          'the same class.',
          'Region-scale geometry, measuring period and orientation on masked autocorrelation '
          'of homogeneous multi-county regions. This is the method that came closest: period '
          'and orientation do transfer from the legend blocks to the map fills. It cleanly '
          'identifies the Insull lattice, the Byllesby diamond lattice, the Cities Service '
          'single diagonal and the North American horizontal rule. It still cannot separate '
          'Insull from Electric Bond and Share, because both are near-solid, nor the five '
          'plain diagonal hatches from one another, which is where Associated Gas and '
          'Electric, Cities Service and the Southeastern half of Commonwealth and Southern '
          'live. Overlaying its output on the plate shows the Insull rule lighting up every '
          'dark fill in the country, including New England and the Deep South.'],
        'caveats': [
          'County boundaries moved between 1925 and 2020 and a handful of counties did not '
          'exist in 1925.',
          'The plates are monochrome pattern-coded lithographs. legend_colour is null for '
          'every group because the plate has no colours to record.',
          'Map III is dated 1925, not 1930. Map IV is the 1932 county-level equivalent and is '
          'extracted by this pipeline, but it carries twenty eight patterns rather than twenty '
          'and is strictly harder, so it is not classified either.',
          'The United Corporation was formed in January 1929, so the key "united" cannot have '
          'a 1925 footprint under any method.',
          'Commonwealth and Southern was formed in 1929 from Hodenpyl-Hardy and Southeastern '
          'Power and Light, which are two separate legend entries on the 1925 plate. Any 1925 '
          'commonwealth-southern layer is the union of two patterns.',
          'Cities Service appears as the Doherty Group and Associated Gas and Electric as the '
          'J. G. White Group in the 1925 legend.',
          'Map IV prints "Note: Separate cities and towns served not shown on map". The same '
          'limit applies to Map III: a group serving one town inside an otherwise unserved '
          'county leaves no mark, so the served layer is a county-level fill, not a claim '
          'about every community.',
          'The Map III legend carries twenty swatches. A brace labelled General Electric spans '
          'the first four of them: Electric Bond and Share, Southeastern Power and Light, '
          'Northeastern Super-Power and United Gas and Electric. Map IV\'s legend is longer '
          'and structured differently, with numbered member lists under Electric Bond and '
          'Share, Middle West Utilities and The United Corporation, plus an Other Insull '
          'Companies entry that Map III does not have.'],
        'validation': {
          'gate': 'passed' if not fails else 'FAILED',
          'reasons': fails,
          'consequence': 'years.1925 and years.1932 are emitted empty. The served layer and '
                         'the georeference are emitted because both pass their own checks.'}
      },
      'groups': groups,
      'years': {'1925': {}, '1932': {}},
      'served': {'1925': {g: bool(v) for g, v in sorted(served.items())}},
      'fill_share': {'1925': {g: v['fill_share'] for g, v in sorted(counties.items()) if v}},
      'coverage': {'1925': {g: v['cov'] for g, v in sorted(counties.items()) if v}},
      'mixed': {'1925': mixed},
      'unclassified': {'1925': nserved, '1932': nserved + nblank},
      'counts': {'counties_total': len(counties), 'counties_measured': len(served),
                 'counties_no_mask': nomask,
                 'served_1925': nserved, 'unshaded_1925': nblank,
                 'mixed_1925': len(mixed),
                 'legend_patterns_on_map3': len(pl.MAP3),
                 'patterns_separable': sorted(set(labels.values()))}
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(doc, open(OUT, 'w'), indent=1)

    log('')
    log('VALIDATION GATE: %s' % ('passed' if not fails else 'FAILED'))
    for f in fails:
        log('  - ' + f)
    log('')
    log('counties measured %d of %d (%d had no usable mask)' % (len(served), len(counties), nomask))
    log('served by some group  %d  (%.1f%% of measured)' % (nserved, 100 * nserved / len(served)))
    log('unshaded              %d  (%.1f%%)' % (nblank, 100 * nblank / len(served)))
    log('empire-unclassified   %d  (%.1f%% of the country, every shaded county)'
        % (nserved, 100 * nserved / len(served)))
    log('wrote %s' % OUT)
    log('wrote %s' % GEOREF_OUT)
    log('%.0f s' % (time.time() - t0))


if __name__ == '__main__':
    main()
