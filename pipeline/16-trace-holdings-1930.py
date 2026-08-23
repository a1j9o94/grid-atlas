#!/usr/bin/env python3
"""Build the trace-backed FTC county holdings artifact from clean inputs.

The rejected statistical classifier output is never read. By default this command
fails closed unless both source-plate traces pass release validation. Use
``--allow-incomplete`` only to make a visibly marked review artifact.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = HERE / "lib"
DEFAULT_OUT = HERE.parent.parent / "grid-timeline" / "holdings-1930.json"

STATE_BY_FIPS = {
    "01": "AL", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
    "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA",
    "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS",
    "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA",
    "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT",
    "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM",
    "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK",
    "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA",
    "53": "WA", "54": "WV", "55": "WI", "56": "WY",
}

EMPIRE_OF = {
    "southeastern": "commonwealth-southern",
    "hodenpyl": "commonwealth-southern",
    "fitkin": "insull",
    "general-gas-electric": "age",
}

TRACE_LIMITS = [
    "County fill is not a claim that every community was served. Map IV explicitly "
    "omits separate cities and towns, and the same cartographic limit applies to Map III.",
    "County geometry uses modern equivalents. Changed boundaries, independent cities, "
    "coasts, folds, partial fills, and split fills remain explicit uncertainty.",
    "The general-gas-electric to age succession edge is inferred; the raw plate label "
    "remains available and is authoritative for the 1925 layer.",
]


def read_trace(path: Path, key: str) -> tuple[str, dict[str, str]]:
    doc = json.loads(path.read_text())
    if key not in doc or not isinstance(doc[key], dict):
        raise SystemExit(f"{path.name}: missing object {key!r}")
    return doc.get("status", "not-built"), doc[key]


def rollup(assign: dict[str, str]) -> dict[str, dict[str, list[str]]]:
    by: dict[str, set[str]] = defaultdict(set)
    for fips, label in assign.items():
        state = STATE_BY_FIPS.get(fips[:2])
        if not state or label in {"none", "unknown-served"}:
            continue
        uncertain = False
        if label.startswith("maybe:"):
            labels = label[6:].split("|")
            uncertain = True
        elif label.startswith("amb:"):
            labels = label[4:].split("|")
            uncertain = True
        else:
            labels = [label]
        keys = {EMPIRE_OF.get(item, item) for item in labels}
        if len(keys) != 1:
            uncertain = True
        for group in keys:
            by[group].add(state + ("?" if uncertain else ""))
    result = {}
    for group in sorted(by):
        states = by[group]
        exact = sorted(s for s in states if not s.endswith("?"))
        ambiguous = sorted({s[:-1] for s in states if s.endswith("?")} - set(exact))
        result[group] = {"states": exact, "ambiguous_states": ambiguous}
    return result


def map3_legend() -> dict[str, dict[str, object]]:
    sys.path.insert(0, str(LIB))
    from plate_legend import MAP3  # pylint: disable=import-outside-toplevel

    result = {}
    for _cell, (printed, key, note) in MAP3.items():
        item: dict[str, object] = {"printed_label": printed}
        if note:
            item["note"] = note
        result[key] = item
    return dict(sorted(result.items()))


def map4_legend() -> dict[str, object] | None:
    path = LIB / "map4-legend-draft.json"
    if not path.exists():
        return None
    doc = json.loads(path.read_text())
    return {
        "status": doc.get("status", "draft_evidence_only"),
        "top_level_swatch_count": len(doc.get("swatches", [])),
        "swatches": doc.get("swatches", []),
    }


def anchors(map3: dict[str, str]) -> dict[str, bool]:
    return {
        "cook-il-insull": map3.get("17031") == "insull",
        "philadelphia-ugi": map3.get("42101") == "ugi",
        "fulton-ga-southeastern": map3.get("13121") == "southeastern",
        "nashville-hodenpyl": map3.get("47037") == "hodenpyl",
        "jefferson-al-hatch": map3.get("01073") == "southeastern",
        "los-angeles-served": map3.get("06037") not in {None, "none"},
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--allow-incomplete", action="store_true")
    mode.add_argument(
        "--release-map3",
        action="store_true",
        help="release the complete 1925 Map III trace while Map IV remains unavailable",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.allow_incomplete and not args.release_map3:
        subprocess.run(
            [sys.executable, str(HERE / "17-validate-holdings-trace.py"), "--release"],
            cwd=HERE,
            check=True,
        )

    status3, trace3 = read_trace(LIB / "map3-county-trace.json", "map3")
    status4, trace4 = read_trace(LIB / "map4-county-trace.json", "map4")
    source_manifest = json.loads((LIB / "ftc-72a-source-manifest.json").read_text())
    legend4 = map4_legend()

    anchor_results = anchors(trace3)
    if args.release_map3:
        if status3 != "complete" or len(trace3) != 3108:
            raise SystemExit(
                f"Map III-only release requires complete 3,108-county trace; "
                f"got status={status3}, count={len(trace3)}"
            )
        if not all(anchor_results.values()):
            failed = sorted(key for key, passed in anchor_results.items() if not passed)
            raise SystemExit(f"Map III-only release has failed anchors: {failed}")

    if args.allow_incomplete:
        artifact_status = "review-only-incomplete"
    elif args.release_map3:
        artifact_status = "release-map3-1925"
    else:
        artifact_status = "release"

    years: dict[str, dict[str, str]] = {"1925": dict(sorted(trace3.items()))}
    if not args.release_map3:
        years["1932"] = dict(sorted(trace4.items()))

    artifact: dict[str, object] = {
        "schema_version": 2,
        "status": artifact_status,
        "meta": {
            "source": source_manifest,
            "county_universe": "3,108 modern lower-48 and District of Columbia county equivalents",
            "trace_status": {"1925": status3, "1932": status4},
            "trace_method": "Human plate trace with independent blind review and preserved uncertainty.",
            "trace_limits": TRACE_LIMITS,
            "trace_anchors": anchor_results,
            "release_scope": (
                "Map III (1925) only; Map IV (1932) is explicitly unavailable"
                if args.release_map3
                else "Map III (1925) and Map IV (1932)"
            ),
            "forbidden_legacy_fields": [
                "served", "fill_share", "mixed", "classification_attempts",
                "patterns_separable", "validation.gate=FAILED",
            ],
        },
        "legends": {"1925": map3_legend()},
        "years": years,
        "rollups": {"1925": rollup(trace3)},
    }
    if legend4 is not None:
        artifact["legends"]["1932"] = legend4  # type: ignore[index]

    encoded = json.dumps(artifact, indent=1, sort_keys=True, ensure_ascii=False) + "\n"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(encoded)
    print(
        f"wrote {args.output}: Map III {len(trace3):,}, Map IV {len(trace4):,}, "
        f"status={artifact['status']}"
    )


if __name__ == "__main__":
    main()
