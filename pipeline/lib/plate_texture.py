"""Texture tooling for the FTC 1935 county plates.

The plates are monochrome. Groups are coded by engraved hatch and stipple patterns,
not by colour, so classification is a texture problem. Everything here works on a
normalised "ink" image: 0 is paper, 1 is full ink. Normalising first matters because
the scan carries a heavy fold shadow down the middle and darkens toward the right edge.
"""
import numpy as np
from scipy import ndimage

BLOCK = 128          # paper-white is estimated on this grid, then smoothed
PAPER_PCT = 92       # high percentile inside a block is paper, not ink
PATCH = 32           # default texture window side, in scan pixels
PAD = 64             # FFT size, fixed for every patch size so spectral bins stay comparable
NORIENT = 12
NRAD = 8


def paper_field(gray):
    """Robust per-pixel paper-white estimate.

    Blockwise high percentile, then a median filter across blocks. The median filter is
    the load-bearing part: blocks that fall entirely inside a solid-black empire blob
    would otherwise report a dark "paper" value and wash the ink out of that blob.
    """
    h, w = gray.shape
    bh, bw = h // BLOCK + 1, w // BLOCK + 1
    grid = np.zeros((bh, bw), np.float32)
    for i in range(bh):
        for j in range(bw):
            blk = gray[i*BLOCK:(i+1)*BLOCK, j*BLOCK:(j+1)*BLOCK]
            grid[i, j] = np.percentile(blk, PAPER_PCT) if blk.size else 255.0
    grid = ndimage.median_filter(grid, size=7, mode='nearest')
    grid = ndimage.uniform_filter(grid, size=3, mode='nearest')
    zy = np.linspace(0, bh - 1, h)
    zx = np.linspace(0, bw - 1, w)
    return ndimage.map_coordinates(grid, np.meshgrid(zy, zx, indexing='ij'), order=1, mode='nearest')


def ink_image(gray):
    paper = paper_field(gray)
    ink = (paper - gray) / np.maximum(paper * 0.55, 1.0)
    return np.clip(ink, 0.0, 1.0).astype(np.float32)


_HANN = {}


def _hann(n):
    if n not in _HANN:
        _HANN[n] = np.outer(np.hanning(n), np.hanning(n)).astype(np.float32)
    return _HANN[n]


def _polar_bins():
    """Precompute which (orientation, radius) bin each FFT cell falls in.

    Radial bins span periods of about 4 to 40 pixels, which is the range the engraved
    patterns actually occupy at this scan resolution. Orientation is folded to 180
    degrees because a hatch line has no head or tail.
    """
    fy = np.fft.fftfreq(PAD)[:, None]
    fx = np.fft.fftfreq(PAD)[None, :]
    r = np.hypot(fy, fx)
    ang = np.mod(np.arctan2(fy, fx), np.pi)
    lo, hi = 1.0 / 40.0, 1.0 / 4.0
    rb = np.floor((np.log(np.clip(r, 1e-9, None)) - np.log(lo)) / (np.log(hi) - np.log(lo)) * NRAD)
    ob = np.floor(ang / np.pi * NORIENT)
    valid = (r >= lo) & (r <= hi)
    rb = np.clip(rb, 0, NRAD - 1).astype(int)
    ob = np.clip(ob, 0, NORIENT - 1).astype(int)
    flat = (rb * NORIENT + ob).ravel()
    return flat, valid.ravel()


_BINS, _VALID = _polar_bins()
NSPEC = NORIENT * NRAD
DIM = NSPEC + 4


def patch_descriptor(patch):
    """Descriptor for one PATCH x PATCH ink window.

    Four morphology features carry ink coverage and line thickness. The spectral
    histogram carries orientation and spatial frequency. Phase is discarded on purpose:
    the same hatch shifted by half a period must score as the same pattern.
    """
    cov = float(patch.mean())
    b = patch > 0.4
    e1 = float(ndimage.binary_erosion(b, np.ones((3, 3))).mean())
    e2 = float(ndimage.binary_erosion(b, np.ones((5, 5))).mean())
    lab, n = ndimage.label(b)
    comp = n / float(patch.size) * 1000.0
    z = (patch - cov) * _hann(patch.shape[0])
    F = np.abs(np.fft.fft2(z, s=(PAD, PAD))).ravel() ** 2
    hist = np.bincount(_BINS[_VALID], weights=F[_VALID], minlength=NSPEC)
    s = hist.sum()
    hist = hist / s if s > 0 else hist
    return np.concatenate([[cov, e1, e2, comp], hist]).astype(np.float32)


def windows_in_mask(mask, stride=6, limit=64, patch=PATCH):
    """Top-left corners of PATCH-sized windows lying wholly inside mask.

    Uses a summed-area table so it stays fast over 3108 counties.
    """
    ii = np.cumsum(np.cumsum(mask.astype(np.int32), 0), 1)
    ii = np.pad(ii, ((1, 0), (1, 0)))
    h, w = mask.shape
    if h < patch or w < patch:
        return []
    ys = np.arange(0, h - patch + 1, stride)
    xs = np.arange(0, w - patch + 1, stride)
    if len(ys) == 0 or len(xs) == 0:
        return []
    Y, X = np.meshgrid(ys, xs, indexing='ij')
    tot = (ii[Y + patch, X + patch] - ii[Y, X + patch] - ii[Y + patch, X] + ii[Y, X])
    full = tot == patch * patch
    out = list(zip(Y[full].ravel(), X[full].ravel()))
    if len(out) > limit:
        sel = np.linspace(0, len(out) - 1, limit).astype(int)
        out = [out[i] for i in sel]
    return out


# ---------------------------------------------------------------------------
# Masked autocorrelation descriptor.
#
# Patch sampling was the first thing tried and it is the wrong tool here. A typical
# county on this plate is only about 40 pixels across, so almost no county can host a
# 32 px square wholly inside its own borders, and the ones that can give two or three
# windows. Masked autocorrelation uses every interior pixel of an arbitrarily shaped
# county instead, and normalising by the autocorrelation of the mask itself removes the
# shape bias. Dividing through by the zero lag makes it contrast invariant, which matters
# because the legend blocks on this plate are inked noticeably heavier than the map fills.
LAG = 10


def _lag_index(lag=LAG):
    dy, dx = np.mgrid[-lag:lag+1, -lag:lag+1]
    # a hatch pattern has no head or tail, so fold the lag plane through the origin
    keep = (dy > 0) | ((dy == 0) & (dx >= 0))
    keep[lag, lag] = False
    return dy[keep], dx[keep]


_LDY, _LDX = _lag_index()
NLAG = len(_LDY)
_LCACHE = {LAG: (_LDY, _LDX)}


def lag_index(lag=LAG):
    if lag not in _LCACHE:
        _LCACHE[lag] = _lag_index(lag)
    return _LCACHE[lag]


def masked_autocorr(ink_patch, mask, lag=LAG, min_support=25):
    """Normalised autocorrelation of ink inside mask, plus a support weight per lag.

    Returns (acf, support). acf is divided by the zero lag so it is contrast invariant.
    """
    m = mask.astype(np.float32)
    n = m.sum()
    if n < 60:
        return None, None
    mu = float((ink_patch * m).sum() / n)
    x = (ink_patch - mu) * m
    h, w = m.shape
    fh, fw = h + 2*lag + 1, w + 2*lag + 1
    X = np.fft.rfft2(x, s=(fh, fw))
    M = np.fft.rfft2(m, s=(fh, fw))
    R = np.fft.irfft2(X * np.conj(X), s=(fh, fw))
    N = np.fft.irfft2(M * np.conj(M), s=(fh, fw))
    R = np.fft.fftshift(R)[fh//2-lag:fh//2+lag+1, fw//2-lag:fw//2+lag+1]
    N = np.fft.fftshift(N)[fh//2-lag:fh//2+lag+1, fw//2-lag:fw//2+lag+1]
    z = N[lag, lag]
    var = R[lag, lag] / max(z, 1.0)
    if var <= 1e-8:
        return None, None
    ldy, ldx = lag_index(lag)
    sup = N[ldy + lag, ldx + lag]
    acf = (R[ldy + lag, ldx + lag] / np.maximum(sup, 1.0)) / var
    return acf.astype(np.float32), np.maximum(sup, 0.0).astype(np.float32)


def morph_features(ink_patch, mask):
    """Ink coverage and a white-hole count.

    The hole count is what separates the Insull fill (solid black punched with white
    lozenges) from the Electric Bond and Share fill (solid black), which are otherwise
    the same texture.
    """
    m = mask
    n = float(m.sum())
    cov = float((ink_patch * m).sum() / n)
    holes = (ink_patch < 0.35) & m
    lab, k = ndimage.label(holes)
    if k:
        sizes = ndimage.sum(holes, lab, np.arange(1, k+1))
        k = int((sizes >= 4).sum())
    dark = (ink_patch > 0.6) & m
    return np.array([cov, float(dark.sum()/n), k / n * 1000.0], np.float32)
