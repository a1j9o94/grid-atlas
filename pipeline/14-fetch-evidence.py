#!/usr/bin/env python3
"""Commit the archival plates the timeline cites, so no chip promises a picture
it cannot show.

Every asset here was confirmed by byte retrieval during the research pass, and
the byte counts recorded there are asserted below. A source that has moved or
changed since then fails loudly rather than quietly shipping a different image.

Two source shapes:

  direct   archive.org IIIF and the Library of Congress hand back JPEG. The
           archive.org service answers 302 first, so redirects must be followed.
  pdf      govinfo and FRASER serve scanned pages inside a PDF. These are
           scans, so each page is one embedded image XObject and extracts at
           the resolution it was scanned at. There is no PDF renderer in this
           container, which is fine for a scan and would not be for a page of
           vector text: a page carrying no single full-page image fails rather
           than producing a blank.

Python rather than the .mjs the rest of the pipeline uses, because pypdf does
the page extraction and Pillow does the WebP, both already installed, and
sharp is not.

Usage: python3 14-fetch-evidence.py [--out <grid-atlas/public>] [--only <id>]
"""
import argparse, io, json, os, sys, urllib.request
from pathlib import Path

from PIL import Image
from pypdf import PdfReader

HERE = Path(__file__).resolve().parent
# Six levels up is the workspace root, where the grid-atlas checkout sits
# beside light-workspace. Same anchor 11-build-timeline-dots.mjs uses.
DEFAULT_OUT = HERE.parents[5] / "grid-atlas" / "public"
CACHE = HERE / "data-raw" / "evidence-src"

FULL_EDGE = 1600
THUMB_EDGE = 480

# One entry per evidence id the timeline cites and that owes the reader a
# picture. `bytes` is what the research pass measured; a mismatch on a direct
# fetch means the source changed and wants a human. `pages` is 1-based, matching
# how govinfo counts and how the research notes are written. `join` stitches a
# spread: "h" side by side for two halves of one plate, "v" stacked for a plate
# and the legend that faces it.
GOVINFO_72A = "https://www.govinfo.gov/content/pkg/SERIALSET-08858_57_02/pdf/SERIALSET-08858_57_02.pdf"
STATUTE_49 = "https://www.govinfo.gov/content/pkg/STATUTE-49/pdf/STATUTE-49-Pg803.pdf"

ASSETS = {
    # ---- archive.org IIIF, all five Federal Power Commission plates ----
    "fpc-1964-nps-principal-transmission-1962": {
        "image": "https://iiif.archive.org/iiif/nationalpowersur00unit%24236/full/1600,/0/default.jpg",
        "bytes": 361450,
    },
    "fpc-1964-nps-1980-projection-west": {
        "image": "https://iiif.archive.org/iiif/nationalpowersur00unit%24242/full/1600,/0/default.jpg",
        "bytes": 363379,
    },
    "fpc-1970-nps-regions-and-power-supply-areas": {
        "image": "https://iiif.archive.org/iiif/1970nationalpowe01unit%2492/full/1600,/0/default.jpg",
        "bytes": 440383,
    },
    # The title runs across the gutter, so neither half carries it whole. Both
    # halves are stitched here rather than showing one and captioning around it.
    "fpc-1970-nps-transmission-system-figure-13-1": {
        "images": [
            "https://iiif.archive.org/iiif/1970nationalpowe01unit%24272/full/1600,/0/default.jpg",
            "https://iiif.archive.org/iiif/1970nationalpowe01unit%24273/full/1600,/0/default.jpg",
        ],
        "bytes": [281258, 322754],
        "join": "h",
    },
    "fpc-1970-nps-principal-electric-facilities-region-1": {
        "image": "https://iiif.archive.org/iiif/1970nationalpowe02unit%24167/full/1600,/0/default.jpg",
        "bytes": 239483,
    },
    # ---- archive.org IIIF, the 1923 and 1902 plates ----
    "middle-west-utilities-1923-properties-map": {
        "images": [
            "https://iiif.archive.org/iiif/essentialservice00midd%2428/full/1600,/0/default.jpg",
            "https://iiif.archive.org/iiif/essentialservice00midd%2429/full/1600,/0/default.jpg",
        ],
        "bytes": [391095, 338174],
        "join": "h",
    },
    "census-1902-pearl-street-station-plate": {
        "image": "https://iiif.archive.org/iiif/cu31924022815181%2458/full/1600,/0/default.jpg",
        "bytes": 714135,
    },
    "census-1902-appleton-first-edison-station-plate": {
        "image": "https://iiif.archive.org/iiif/cu31924022815181%2442/full/1600,/0/default.jpg",
    },
    # ---- Library of Congress ----
    "loc-1904-electric-railway-power-house-interior": {
        "image": "https://tile.loc.gov/storage-services/service/pnp/npcc/18700/18722v.jpg",
    },
    # ---- govinfo PDFs: the FTC's own Part 72-A ----
    # Page numbers are the ones the research pass recorded against the govinfo
    # scan. The pyramid chart is the one it did not open, so it is fetched with
    # its neighbours and checked before it is allowed to ship.
    # Pages 89 and 90 are Map III (1925) and Map IV (1932), both titled Fields
    # of Operations of Principal Power Groups Located by Counties, both facing
    # printed page 56. Stacked, so the pair reads as the before and after it is.
    "ftc-72a-map3-fields-of-operation-1925": {"pdf": GOVINFO_72A, "pages": [89, 90], "join": "v"},
    "ftc-72a-map1-transmission-lines-1932": {"pdf": GOVINFO_72A, "pages": [71]},
    # The research pass put the pyramid charts at "roughly PDF page 190" and
    # said plainly that it had not opened the page. It had not: 190 is printed
    # page 140, body text about class A common stock. Found by scanning the
    # volume for oversized page images, since a fold-out plate scans several
    # times the area of a text page, then looking at each one.
    #
    # Two charts, kept as two assets because they argue different things.
    # Chart IX is the whole Insull group on one sheet, hundreds of companies in
    # nested boxes, and it is the plate that makes "a handful of men own the
    # lights" a thing you can see. Chart X is one chain through it, seven layers
    # from the Insull family down to a company with $100,200 of common stock,
    # and it is how the pyramid worked.
    "ftc-72a-chart-9-insull-group-1932": {"pdf": GOVINFO_72A, "pages": [203]},
    "ftc-72a-chart-10-insull-chain-1930": {"pdf": GOVINFO_72A, "pages": [208]},
    "ftc-72a-table12-generation-by-group": {"pdf": GOVINFO_72A, "pages": [68]},
    "ftc-72a-table19-operating-companies-by-group": {"pdf": GOVINFO_72A, "pages": [86]},
    # ---- govinfo PDFs: the statute itself ----
    "puhca-statute-49-stat-803": {"pdf": STATUTE_49, "pages": [1]},
    "puhca-section-11-49-stat-820-821": {"pdf": STATUTE_49, "pages": [18, 19], "join": "h"},
    # ---- FRASER ----
    "ftc-annual-report-1938-volume-list": {
        "pdf": "https://fraser.stlouisfed.org/files/docs/publications/ftc/ftc_ar_1938.pdf",
        "pages": [205],
    },
}

UA = "grid-atlas evidence fetch (one-time archival retrieval; contact via repo)"


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r:  # follows redirects
        return r.read()


def cached(url: str, name: str) -> bytes:
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / name
    if p.exists():
        return p.read_bytes()
    b = get(url)
    p.write_bytes(b)
    return b


def pdf_page_image(pdf: PdfReader, n: int) -> Image.Image:
    """The scanned page as its embedded image, at scan resolution.

    A scanned page is one full-page image XObject. A page holding several small
    images is not a scan, and guessing which one is the page would be worse than
    failing, so the largest is taken only when it dominates the page.
    """
    page = pdf.pages[n - 1]
    imgs = list(page.images)
    if not imgs:
        raise RuntimeError(f"PDF page {n} carries no image; not a scanned page")
    best = max(imgs, key=lambda im: im.image.width * im.image.height)
    px = best.image.width * best.image.height
    total = sum(im.image.width * im.image.height for im in imgs)
    if px / total < 0.9:
        raise RuntimeError(f"PDF page {n} has {len(imgs)} images and none dominates")
    return best.image.convert("RGB")


def stitch(parts: list[Image.Image], how: str) -> Image.Image:
    if len(parts) == 1:
        return parts[0]
    if how == "h":
        h = max(p.height for p in parts)
        scaled = [p.resize((round(p.width * h / p.height), h), Image.LANCZOS) for p in parts]
        out = Image.new("RGB", (sum(p.width for p in scaled), h), "white")
        x = 0
        for p in scaled:
            out.paste(p, (x, 0))
            x += p.width
        return out
    w = max(p.width for p in parts)
    scaled = [p.resize((w, round(p.height * w / p.width)), Image.LANCZOS) for p in parts]
    out = Image.new("RGB", (w, sum(p.height for p in scaled)), "white")
    y = 0
    for p in scaled:
        out.paste(p, (0, y))
        y += p.height
    return out


def fit(img: Image.Image, edge: int) -> Image.Image:
    if max(img.width, img.height) <= edge:
        return img
    s = edge / max(img.width, img.height)
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--only", default=None)
    args = ap.parse_args()
    out = Path(args.out)
    imgdir = out / "evidence"
    imgdir.mkdir(parents=True, exist_ok=True)

    pdfs: dict[str, PdfReader] = {}
    report, failed = {}, []
    ids = [args.only] if args.only else list(ASSETS)
    for aid in ids:
        spec = ASSETS[aid]
        try:
            if "pdf" in spec:
                url = spec["pdf"]
                if url not in pdfs:
                    name = url.rsplit("/", 1)[-1]
                    raw = cached(url, name)
                    pdfs[url] = PdfReader(io.BytesIO(raw))
                    print(f"  pdf {name}: {len(raw):,} bytes, {len(pdfs[url].pages)} pages")
                parts = [pdf_page_image(pdfs[url], n) for n in spec["pages"]]
                origin = f"{url} pages {spec['pages']}"
            else:
                urls = spec.get("images") or [spec["image"]]
                want = spec.get("bytes")
                wants = want if isinstance(want, list) else [want] * len(urls)
                parts = []
                # Numbered by position, not derived from the URL: every IIIF
                # path ends in the same /full/1600,/0/default.jpg, so a name
                # taken from the path collides and the second half of a spread
                # silently reads back the first half's bytes.
                for i, (u, w) in enumerate(zip(urls, wants)):
                    b = cached(u, f"{aid}-{i}.jpg")
                    if w is not None and len(b) != w:
                        raise RuntimeError(f"{len(b):,} bytes, research recorded {w:,}; source changed")
                    parts.append(Image.open(io.BytesIO(b)).convert("RGB"))
                origin = ", ".join(urls)
            img = stitch(parts, spec.get("join", "h"))
            full, thumb = fit(img, FULL_EDGE), fit(img, THUMB_EDGE)
            fp, tp = imgdir / f"{aid}.webp", imgdir / f"{aid}.thumb.webp"
            full.save(fp, "WEBP", quality=82, method=6)
            thumb.save(tp, "WEBP", quality=78, method=6)
            report[aid] = {
                "full": f"/evidence/{fp.name}", "thumb": f"/evidence/{tp.name}",
                "source_px": [img.width, img.height],
                "full_px": [full.width, full.height],
                "full_kb": round(fp.stat().st_size / 1024, 1),
                "thumb_kb": round(tp.stat().st_size / 1024, 1),
                "origin": origin,
            }
            print(f"OK   {aid}: {img.width}x{img.height} -> {full.width}x{full.height}, "
                  f"{report[aid]['full_kb']}KB + {report[aid]['thumb_kb']}KB thumb")
        except Exception as e:  # a source that moved is news, not a crash
            failed.append((aid, str(e)))
            print(f"FAIL {aid}: {e}")

    (HERE / "data-raw" / "evidence-report.json").write_text(
        json.dumps({"committed": report, "failed": dict(failed)}, indent=2))
    print(f"\n{len(report)} committed, {len(failed)} failed")
    for aid, why in failed:
        print(f"  failed: {aid}: {why}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
