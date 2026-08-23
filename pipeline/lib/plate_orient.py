"""Structure-tensor line orientation for a plate crop.

Same convention as plate_measure: 0 horizontal, 45 backslash, 90 vertical,
135 slash, y growing downward. Robust on small windows where the Radon sweep
gets confused by a county border crossing the patch.
"""
import numpy as np
from scipy import ndimage


def orient(gray, sigma=1.0):
    a = np.asarray(gray, np.float32)
    a = ndimage.gaussian_filter(a, sigma)
    gx = ndimage.sobel(a, axis=1)
    gy = ndimage.sobel(a, axis=0)
    jxx = float((gx * gx).mean()); jyy = float((gy * gy).mean())
    jxy = float((gx * gy).mean())
    # dominant gradient direction
    theta = 0.5 * np.degrees(np.arctan2(2 * jxy, jxx - jyy))
    line = (theta + 90.0) % 180.0
    num = np.hypot(jxx - jyy, 2 * jxy)
    coh = float(num / (jxx + jyy + 1e-9))
    return line, coh


def _selftest():
    N, P = 80, 12
    y, x = np.mgrid[0:N, 0:N]
    for name, mask, want in [
        ('horizontal', (y % P) < 4, 0), ('vertical', (x % P) < 4, 90),
        ('backslash', ((x - y) % P) < 4, 45), ('slash', ((x + y) % P) < 4, 135)]:
        g = np.where(mask, 20.0, 240.0)
        l, c = orient(g)
        d = min(abs(l - want), 180 - abs(l - want))
        print('%-10s want %3d got %6.1f coh %.2f %s' % (name, want, l, c, 'OK' if d < 8 else 'BAD'))


if __name__ == '__main__':
    _selftest()


BINS = 12  # 15-degree bins of line orientation over 0..180


def profile(gray, mask=None, sigma=1.0):
    """Energy of printed lines by orientation, 12 bins of 15 degrees, sums to 1."""
    a = ndimage.gaussian_filter(np.asarray(gray, np.float32), sigma)
    gx = ndimage.sobel(a, axis=1); gy = ndimage.sobel(a, axis=0)
    mag = np.hypot(gx, gy)
    if mask is not None:
        m = ndimage.binary_erosion(mask, np.ones((3, 3), bool), iterations=1)
        mag = np.where(m, mag, 0.0)
    line = (np.degrees(np.arctan2(gy, gx)) + 90.0) % 180.0
    idx = np.clip((line / (180.0 / BINS)).astype(int), 0, BINS - 1)
    out = np.bincount(idx.ravel(), weights=(mag ** 2).ravel(), minlength=BINS)
    s = out.sum()
    return out / s if s > 0 else out


def period_along(ink, deg, mask=None, pmin=4.0, pmax=32.0):
    """Perpendicular period of lines at orientation `deg`, using only masked pixels."""
    h, w = ink.shape
    y, x = np.mgrid[0:h, 0:w]
    th = np.radians(deg)
    # perpendicular coordinate
    t = x * np.sin(th) - y * np.cos(th)
    t = t - t.min()
    m = np.ones_like(ink, bool) if mask is None else mask
    if m.sum() < 60:
        return None, 0.0
    bins = int(t[m].max()) + 1
    if bins < 16:
        return None, 0.0
    num = np.bincount(t[m].astype(int), weights=ink[m], minlength=bins)
    den = np.bincount(t[m].astype(int), minlength=bins)
    keep = den >= max(3, den.max() * 0.35)
    if keep.sum() < 16:
        return None, 0.0
    lo, hi = np.argmax(keep), bins - np.argmax(keep[::-1])
    prof = (num[lo:hi] / np.maximum(den[lo:hi], 1))
    prof = prof[den[lo:hi] >= max(3, den.max() * 0.35)] if False else prof
    p = prof - prof.mean()
    if p.size < 16 or p.std() < 1e-6:
        return None, 0.0
    ac = np.correlate(p, p, 'full')[p.size - 1:]
    ac = ac / ac[0]
    a0 = int(np.floor(pmin)); a1 = min(int(np.ceil(pmax)), p.size - 2)
    if a1 <= a0 + 1:
        return None, 0.0
    neg = np.argmax(ac[:a1 + 1] < 0.0)
    if ac[:a1 + 1].min() < 0:
        a0 = max(a0, int(neg) + 1)
    if a1 <= a0 + 1:
        return None, 0.0
    seg = ac[a0:a1 + 1]
    best = float(seg.max())
    cand = [j for j in range(1, seg.size - 1)
            if seg[j] >= seg[j - 1] and seg[j] >= seg[j + 1] and seg[j] >= 0.62 * best]
    k = cand[0] if cand else int(np.argmax(seg)); i = a0 + k
    if not (0 < i < ac.size - 1 and ac[i] >= ac[i - 1] and ac[i] >= ac[i + 1]):
        return None, float(seg[k])
    a, b, c = ac[i - 1], ac[i], ac[i + 1]
    den2 = a - 2 * b + c
    off = 0.5 * (a - c) / den2 if abs(den2) > 1e-9 else 0.0
    return float(i + np.clip(off, -1, 1)), float(b)


def duty(ink, deg, mask=None):
    """Mean ink run length across the perpendicular profile: the printed stroke."""
    h, w = ink.shape
    y, x = np.mgrid[0:h, 0:w]
    th = np.radians(deg)
    t = x * np.sin(th) - y * np.cos(th); t = t - t.min()
    m = np.ones_like(ink, bool) if mask is None else mask
    if m.sum() < 60:
        return None
    bins = int(t[m].max()) + 1
    num = np.bincount(t[m].astype(int), weights=ink[m], minlength=bins)
    den = np.bincount(t[m].astype(int), minlength=bins)
    keep = den >= max(3, den.max() * 0.35)
    prof = num[keep] / np.maximum(den[keep], 1)
    if prof.size < 8:
        return None
    thr = (prof.max() + prof.min()) / 2
    on = prof > thr
    runs, cur = [], 0
    for v in on:
        if v: cur += 1
        elif cur: runs.append(cur); cur = 0
    if cur: runs.append(cur)
    return float(np.mean(runs)) if runs else None
