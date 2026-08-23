#!/usr/bin/env python3
"""Render plate crops with the pinned modern county mesh.

The crop is a tracing aid. It does not classify counties.

Run:
  python3 18-render-holdings-trace-crops.py AR LA KS OK TX
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
RAW = HERE / "data-raw"
LIB = HERE / "lib"

STATE_FIPS = {
    "AL": "01", "AZ": "04", "AR": "05", "CA": "06", "CO": "08",
    "CT": "09", "DE": "10", "DC": "11", "FL": "12", "GA": "13",
    "ID": "16", "IL": "17", "IN": "18", "IA": "19", "KS": "20",
    "KY": "21", "LA": "22", "ME": "23", "MD": "24", "MA": "25",
    "MI": "26", "MN": "27", "MS": "28", "MO": "29", "MT": "30",
    "NE": "31", "NV": "32", "NH": "33", "NJ": "34", "NM": "35",
    "NY": "36", "NC": "37", "ND": "38", "OH": "39", "OK": "40",
    "OR": "41", "PA": "42", "RI": "44", "SC": "45", "SD": "46",
    "TN": "47", "TX": "48", "UT": "49", "VT": "50", "VA": "51",
    "WA": "53", "WV": "54", "WI": "55", "WY": "56",
}


def load_geo():
    import sys
    sys.path.insert(0, str(LIB))
    import plate_geo as geo
    return geo


def polygon_rings(geometry):
    if geometry["type"] == "Polygon":
        return geometry["coordinates"]
    if geometry["type"] == "MultiPolygon":
        return [ring for polygon in geometry["coordinates"] for ring in polygon]
    raise ValueError(f"unsupported geometry {geometry['type']}")


def project_ring(coords, geo, coeff, order):
    a = np.asarray(coords, dtype=np.float64)
    x, y = geo.albers(a[:, 0], a[:, 1])
    px, py = geo.apply(coeff, x, y, order)
    return list(zip(px.tolist(), py.tolist()))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("states", nargs="+", help="two-letter postal abbreviations")
    parser.add_argument("--labels", choices=("fips", "name", "both", "none"), default="both")
    parser.add_argument("--padding", type=int, default=55)
    parser.add_argument("--output", type=Path, default=RAW / "trace-crops")
    args = parser.parse_args()

    geo = load_geo()
    georef = json.loads((LIB / "ftc-map3-georef.json").read_text())
    coeff = np.asarray(georef["coeff"], dtype=np.float64)
    order = int(georef["order"])
    counties = json.loads((RAW / "counties-conus.json").read_text())["features"]

    plate = Image.open(RAW / "ftc72a" / "map3-1925.png").convert("L")
    plate = ImageOps.autocontrast(plate, cutoff=(0.25, 0.25)).convert("RGB")
    args.output.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default(size=12)

    for postal in [s.upper() for s in args.states]:
        state_fips = STATE_FIPS.get(postal)
        if state_fips is None:
            raise SystemExit(f"unknown state {postal}")
        features = [f for f in counties if f["properties"]["STATEFP"] == state_fips]
        projected = []
        all_points = []
        for feature in features:
            rings = [project_ring(ring, geo, coeff, order) for ring in polygon_rings(feature["geometry"])]
            projected.append((feature, rings))
            all_points.extend(point for ring in rings for point in ring)
        if not all_points:
            raise SystemExit(f"no county geometry for {postal}")

        xs = [p[0] for p in all_points]
        ys = [p[1] for p in all_points]
        x0 = max(0, int(min(xs)) - args.padding)
        y0 = max(0, int(min(ys)) - args.padding)
        x1 = min(plate.width, int(max(xs)) + args.padding)
        y1 = min(plate.height, int(max(ys)) + args.padding)
        crop = plate.crop((x0, y0, x1, y1))
        draw = ImageDraw.Draw(crop)

        index = {}
        for feature, rings in projected:
            local = [[(x - x0, y - y0) for x, y in ring] for ring in rings]
            for ring in local:
                draw.line(ring, fill=(220, 25, 45), width=2, joint="curve")
            pts = [point for ring in local for point in ring]
            bx0 = min(p[0] for p in pts)
            by0 = min(p[1] for p in pts)
            bx1 = max(p[0] for p in pts)
            by1 = max(p[1] for p in pts)
            props = feature["properties"]
            fips = props["GEOID"]
            name = props.get("NAME", "")
            index[fips] = {
                "name": name,
                "bbox": [round(bx0, 1), round(by0, 1), round(bx1, 1), round(by1, 1)],
            }
            if args.labels != "none":
                if args.labels == "fips":
                    label = fips[-3:]
                elif args.labels == "name":
                    label = name
                else:
                    label = f"{fips[-3:]} {name}"
                tx = (bx0 + bx1) / 2
                ty = (by0 + by1) / 2
                draw.text(
                    (tx, ty), label, font=font, anchor="mm",
                    fill=(255, 240, 0), stroke_width=2, stroke_fill=(0, 0, 0),
                )

        target = args.output / f"map3-{postal.lower()}.png"
        crop.save(target, optimize=True)
        (args.output / f"map3-{postal.lower()}.json").write_text(
            json.dumps(index, indent=2, sort_keys=True) + "\n"
        )
        print(f"{postal}: {len(features)} counties, crop {crop.size}, {target}")


if __name__ == "__main__":
    main()
