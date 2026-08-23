"""Measure engraved hatch period and orientation from a crop of an FTC plate.

Used to build the Map IV legend key. Works on any greyscale crop: legend swatch or
county fill. Reports the period as the perpendicular wavelength in native scan pixels
and the orientation of the printed LINES, in the convention this project already uses:

    orientation 0   = horizontal rules
    orientation 45  = backslash "\\" (upper-left to lower-right)
    orientation 90  = vertical rules
    orientation 135 = slash "/" (lower-left to upper-right)

Image y grows downward, so the line orientation is the wave-vector angle rotated by 90
degrees. `_selftest()` pins that with synthetic patterns; run this file directly.
"""
import numpy as np

PAD = 256          # fixed FFT size so bins are comparable across patch sizes
PMIN, PMAX = 3.0, 60.0   # plausible engraved periods, native scan px


def normalise(gray):
    """Greyscale crop -> ink in 0..1, with a local paper-white estimate.

    A legend swatch is small enough that a single high percentile is a good paper
    estimate, except for near-solid swatches. Guard those with a floor.
    """
    g = np.asarray(gray, np.float32)
    paper = np.percentile(g, 90)
    paper = max(paper, np.percentile(g, 99) * 0.75, 60.0)
    ink = (paper - g) / max(paper * 0.55, 1.0)
    return np.clip(ink, 0.0, 1.0)


def ink_fraction(gray, thresh=0.5):
    return float((normalise(gray) > thresh).mean())


def _spectrum(ink):
    a = ink - ink.mean()
    h, w = a.shape
    win = np.outer(np.hanning(h), np.hanning(w)).astype(np.float32)
    a = a * win
    buf = np.zeros((PAD, PAD), np.float32)
    buf[:min(h, PAD), :min(w, PAD)] = a[:PAD, :PAD]
    return np.abs(np.fft.fft2(buf)) ** 2


def _peaks(power, n=3, suppress=6):
    """Top n distinct spectral peaks, folded to a half plane. Returns (period, line_deg, weight)."""
    fy = np.fft.fftfreq(PAD)[:, None] * np.ones((1, PAD))
    fx = np.fft.fftfreq(PAD)[None, :] * np.ones((PAD, 1))
    r = np.hypot(fy, fx)
    with np.errstate(divide='ignore'):
        period = 1.0 / np.where(r > 0, r, np.inf)
    valid = (period >= PMIN) & (period <= PMAX) & (fy >= 0)   # half plane, fold conjugates
    p = np.where(valid, power, 0.0)
    total = p.sum() or 1.0
    out = []
    for _ in range(n):
        idx = int(np.argmax(p))
        iy, ix = divmod(idx, PAD)
        if p[iy, ix] <= 0:
            break
        # wave-vector angle; line orientation is that rotated 90 degrees
        kang = np.degrees(np.arctan2(fy[iy, ix], fx[iy, ix])) % 180.0
        line = (kang + 90.0) % 180.0
        out.append((float(period[iy, ix]), float(line), float(p[iy, ix] / total)))
        y0, y1 = max(0, iy - suppress), iy + suppress + 1
        x0, x1 = max(0, ix - suppress), ix + suppress + 1
        p[y0:y1, x0:x1] = 0.0
        # kill the mirrored lobe too (the other half plane wraps to fy==0 rows)
        my, mx = (-iy) % PAD, (-ix) % PAD
        p[max(0, my - suppress):my + suppress + 1, max(0, mx - suppress):mx + suppress + 1] = 0.0
    return out


def measure(gray, n=3):
    """Return dict with ink fraction and the top spectral peaks of a crop."""
    ink = normalise(gray)
    pk = _peaks(_spectrum(ink), n=n)
    return {
        'ink': float((ink > 0.5).mean()),
        'mean_ink': float(ink.mean()),
        'peaks': [{'period': round(p, 2), 'orient': round(a, 1), 'weight': round(w, 4)}
                  for p, a, w in pk],
    }


def fmt(m):
    return ' '.join('%.1f@%.0f(%.3f)' % (p['period'], p['orient'], p['weight']) for p in m['peaks'])


def _selftest():
    N, P = 120, 12
    y, x = np.mgrid[0:N, 0:N]
    cases = {
        'horizontal': (y % P) < 4,
        'vertical': (x % P) < 4,
        'backslash': ((x - y) % P) < 4,     # upper-left to lower-right on screen
        'slash': ((x + y) % P) < 4,         # lower-left to upper-right on screen
    }
    expect = {'horizontal': 0, 'vertical': 90, 'backslash': 45, 'slash': 135}
    ok = True
    for name, mask in cases.items():
        g = np.where(mask, 20.0, 240.0)
        m = measure(g, n=1)
        got = m['peaks'][0]['orient']
        want = expect[name]
        d = min(abs(got - want), 180 - abs(got - want))
        flag = 'OK ' if d < 6 else 'BAD'
        ok &= d < 6
        print('%-10s want %3d got %5.1f period %5.2f  %s' % (name, want, got, m['peaks'][0]['period'], flag))
    print('selftest', 'PASS' if ok else 'FAIL')


if __name__ == '__main__':
    _selftest()


# ---------------------------------------------------------------------------
# Radon-style measurement. More reliable than the raw FFT peak on a swatch only
# 40 px wide, where the FFT bin spacing is coarse and harmonics can outrank the
# fundamental. Sweeps line orientation, keeps the angle whose projection profile
# has the highest variance, then reads the period off the profile autocorrelation.
# ---------------------------------------------------------------------------

def _project(ink, deg):
    """Mean ink along lines of orientation `deg`; returns the perpendicular profile.

    Rotates so the lines lie horizontal, then averages rows. Rotation beats binning
    the perpendicular coordinate directly: on a 45 degree hatch, integer bins alias
    and read the period about 17 percent short.
    """
    from scipy import ndimage
    a = np.asarray(ink, np.float32)
    mask = np.ones_like(a)
    ra = ndimage.rotate(a, deg, reshape=True, order=1, mode='constant', cval=0.0)
    rm = ndimage.rotate(mask, deg, reshape=True, order=1, mode='constant', cval=0.0)
    num = (ra * (rm > 0.9)).sum(axis=1)
    den = (rm > 0.9).sum(axis=1)
    keep = den > den.max() * 0.55
    prof = np.where(den > 0, num / np.maximum(den, 1), 0.0)
    return prof[keep]


def _acf_period(prof, pmin=3.5, pmax=30.0):
    p = prof - prof.mean()
    if p.size < 12 or p.std() < 1e-6:
        return None, 0.0
    ac = np.correlate(p, p, 'full')[p.size - 1:]
    ac = ac / ac[0]
    lo, hi = int(np.floor(pmin)), min(int(np.ceil(pmax)), p.size - 2)
    if hi <= lo + 1:
        return None, 0.0
    # start past the autocorrelation's first zero crossing, otherwise the shoulder of
    # the central lobe outranks the real period whenever the profile carries a trend
    z = np.argmax(ac[:hi + 1] < 0.0)
    lo = max(lo, int(z) + 1) if ac[:hi + 1].min() < 0 else lo
    if hi <= lo + 1:
        return None, 0.0
    seg = ac[lo:hi + 1]
    k = int(np.argmax(seg))
    i = lo + k
    if not (0 < i < ac.size - 1 and ac[i] >= ac[i - 1] and ac[i] >= ac[i + 1]):
        return None, 0.0
    if i <= 0 or i >= ac.size - 1:
        return float(i), float(seg[k])
    # parabolic refinement on the autocorrelation peak
    a, b, c = ac[i - 1], ac[i], ac[i + 1]
    den = (a - 2 * b + c)
    off = 0.5 * (a - c) / den if abs(den) > 1e-9 else 0.0
    return float(i + np.clip(off, -1, 1)), float(b)


def radon(gray, angles=None, top=3):
    """Return the strongest line orientations and their perpendicular periods.

    Each entry: (orientation_deg, period_px, profile_contrast, acf_strength).
    Orientation follows the project convention: 0 horizontal, 45 backslash,
    90 vertical, 135 slash.
    """
    ink = normalise(gray)
    if angles is None:
        angles = np.arange(0, 180, 1.0)
    rows = []
    for a in angles:
        prof = _project(ink, float(a))
        if prof.size < 12:
            continue
        per, s = _acf_period(prof)
        rows.append((float(a), per, float(prof.std()), s))
    rows.sort(key=lambda r: -r[2])
    out, used = [], []
    for a, per, v, s in rows:
        if any(min(abs(a - u), 180 - abs(a - u)) < 18 for u in used):
            continue
        used.append(a)
        out.append((a, per, v, s))
        if len(out) >= top:
            break
    return out


def stroke_width(gray, deg):
    """Mean run length of ink along the perpendicular profile at orientation `deg`.

    Separates a thin rule from a bold rule at the same spacing, which is the real
    discriminator inside Map IV's diagonal families.
    """
    prof = _project(normalise(gray), deg)
    if prof.size < 6:
        return None
    t = (prof.max() + prof.min()) / 2.0
    on = prof > t
    runs, cur = [], 0
    for v in on:
        if v:
            cur += 1
        elif cur:
            runs.append(cur); cur = 0
    if cur:
        runs.append(cur)
    return float(np.mean(runs)) if runs else None


def _selftest_radon():
    N, P = 120, 12
    y, x = np.mgrid[0:N, 0:N]
    cases = {'horizontal': ((y % P) < 4, 0), 'vertical': ((x % P) < 4, 90),
             'backslash': (((x - y) % P) < 4, 45), 'slash': (((x + y) % P) < 4, 135)}
    ok = True
    for name, (mask, want) in cases.items():
        g = np.where(mask, 20.0, 240.0)
        a, per, c, s = radon(g, top=1)[0]
        d = min(abs(a - want), 180 - abs(a - want))
        ok &= d < 6
        print('%-10s want %3d got %5.1f period %5.2f (true %.2f)  %s'
              % (name, want, a, per or 0, P / (1.4142 if want in (45, 135) else 1.0),
                 'OK ' if d < 6 else 'BAD'))
    print('radon selftest', 'PASS' if ok else 'FAIL')
