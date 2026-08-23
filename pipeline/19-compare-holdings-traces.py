#!/usr/bin/env python3
"""Compare two frozen trace packets without modifying either one.

Run:
  python3 19-compare-holdings-traces.py primary.json blind.json
"""
import argparse
import json
import sys
from pathlib import Path

UNCERTAIN_PREFIXES = ("amb:", "maybe:", "partial:", "split:")
UNCERTAIN_VALUES = {"unknown-served"}


def load(path):
    doc = json.loads(Path(path).read_text())
    for key in ("map3", "map4", "counties"):
        if key in doc and isinstance(doc[key], dict):
            return doc[key]
    if not isinstance(doc, dict):
        raise SystemExit(f"{path}: expected an object")
    return doc


def served(value):
    if value == "none":
        return False
    if value in UNCERTAIN_VALUES or value.startswith(("maybe:", "partial:")):
        return None
    return True


def exact(value):
    if value in UNCERTAIN_VALUES or value.startswith(UNCERTAIN_PREFIXES):
        return None
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("primary")
    parser.add_argument("blind")
    parser.add_argument("--served-min", type=float, default=0.98)
    parser.add_argument("--pattern-min", type=float, default=0.95)
    parser.add_argument("--output")
    args = parser.parse_args()

    left = load(args.primary)
    right = load(args.blind)
    missing_left = sorted(set(right) - set(left))
    missing_right = sorted(set(left) - set(right))
    shared = sorted(set(left) & set(right))

    served_scored = served_agree = 0
    exact_scored = exact_agree = 0
    disagreements = []
    unscored = []

    for fips in shared:
        a = left[fips]
        b = right[fips]
        sa = served(a)
        sb = served(b)
        ea = exact(a)
        eb = exact(b)
        kinds = []
        if sa is not None and sb is not None:
            served_scored += 1
            if sa == sb:
                served_agree += 1
            else:
                kinds.append("served-status")
        if ea is not None and eb is not None:
            exact_scored += 1
            if ea == eb:
                exact_agree += 1
            else:
                kinds.append("raw-pattern")
        if kinds:
            disagreements.append({"fips": fips, "primary": a, "blind": b, "kinds": kinds})
        elif sa is None or sb is None or ea is None or eb is None:
            unscored.append({"fips": fips, "primary": a, "blind": b})

    served_rate = served_agree / served_scored if served_scored else 0.0
    exact_rate = exact_agree / exact_scored if exact_scored else 0.0
    result = {
        "primary": args.primary,
        "blind": args.blind,
        "counts": {
            "primary": len(left),
            "blind": len(right),
            "shared": len(shared),
            "missing_primary": len(missing_left),
            "missing_blind": len(missing_right),
            "served_scored": served_scored,
            "exact_scored": exact_scored,
            "unscored_uncertainty": len(unscored),
            "disagreements": len(disagreements),
        },
        "agreement": {
            "served_status": round(served_rate, 6),
            "raw_pattern": round(exact_rate, 6),
        },
        "thresholds": {
            "served_status": args.served_min,
            "raw_pattern": args.pattern_min,
        },
        "missing_primary": missing_left,
        "missing_blind": missing_right,
        "disagreements": disagreements,
        "unscored": unscored,
    }
    text = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        Path(args.output).write_text(text)
    else:
        print(text, end="")

    passed = (
        not missing_left
        and not missing_right
        and served_rate >= args.served_min
        and exact_rate >= args.pattern_min
    )
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
