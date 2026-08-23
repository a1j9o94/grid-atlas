#!/usr/bin/env python3
"""Build the illumination-normalised ink plate for Map IV, and cache it.

Why this exists. The scan carries a heavy fold shadow down the middle and a bright
ridge beside it, which `plate_texture.ink_image` was written to remove. Every
measurement path already normalised. The adjudication path did not: 19-contact-sheet.py
cropped raw greyscale, so a reader adjudicating a dispute saw the scan's lighting on
top of the engraving.

That cost a real error. Adams County, Colorado sits at plate x 2081..2194, and the
plate-wide column mean peaks at x 2100, about 25 levels above the local baseline. On the
raw crop Adams reads blank through its middle and the adjudication recorded it blank.
On the normalised plate the bold backslash hatch runs unbroken across its whole
interior, and the patch edge lands exactly on the printed Adams/Arapahoe county line.

  python3 21-ink-plate.py                 # writes data-raw/ftc72a/map4-1932-ink.png
  python3 21-ink-plate.py --force         # rebuild even if it exists
"""
import argparse, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lib'))
Image.MAX_IMAGE_PIXELS = None
import plate_texture as pt          # noqa: E402

RAW = os.path.join(HERE, 'data-raw', 'ftc72a')
SRC = os.path.join(RAW, 'map4-1932.png')
DST = os.path.join(RAW, 'map4-1932-ink.png')


def build(force=False):
    if os.path.exists(DST) and not force:
        return DST
    g = np.asarray(Image.open(SRC).convert('L'), np.float32)
    ink = pt.ink_image(g)
    # Written back as a paper-white image rather than an ink-fraction float, so every
    # existing crop tool can open it in place of the raw plate with no other change.
    out = np.clip(255.0 * (1.0 - ink), 0, 255).astype(np.uint8)
    Image.fromarray(out).save(DST)
    return DST


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    print(build(a.force))
