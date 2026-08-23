#!/usr/bin/env python3
"""Validate the hand trace before it can enter a generated holdings artifact.

Checkpoint mode permits wholly unstarted states and a not-yet-built Map IV.
Release mode requires both plates to contain the complete pinned county universe.

Run:
  python3 17-validate-holdings-trace.py
  python3 17-validate-holdings-trace.py --release
"""
import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = HERE / "lib"
MANIFEST = LIB / "counties-conus-fips.json"
MAP3_TRACE = LIB / "map3-county-trace.json"
MAP4_TRACE = LIB / "map4-county-trace.json"
MAP4_KEYS = LIB / "map4-legend-keys.json"

MAP3_KEYS = {
    "ebasco", "southeastern", "northeastern-super", "united-gas-electric",
    "insull", "standard-gas", "cities-service", "stone-webster",
    "north-american", "fitkin", "north-american-light",
    "american-water-works", "hodenpyl", "age", "united-light-power",
    "federal-light", "national-electric", "general-gas-electric", "ugi",
    "tenney",
}
SPECIAL = {"none", "unknown-served"}
LEGACY_ALIASES = {"gge": "general-gas-electric"}

ANCHORS = {
    "cook-il-insull": ("17031", "exact", "insull"),
    "philadelphia-ugi": ("42101", "exact", "ugi"),
    "fulton-ga-southeastern": ("13121", "exact", "southeastern"),
    "nashville-hodenpyl": ("47037", "exact", "hodenpyl"),
    "los-angeles-served": ("06037", "served", None),
}


def no_duplicate_object(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError(f"duplicate JSON key: {key}")
        out[key] = value
    return out


def load_json(path):
    try:
        return json.loads(path.read_text(), object_pairs_hook=no_duplicate_object)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise SystemExit(f"{path}: {exc}") from exc


def state_counts(fips):
    out = Counter()
    for code in fips:
        out[code[:2]] += 1
    return out


def load_traces():
    map3_doc = load_json(MAP3_TRACE)
    map3 = map3_doc.get("map3", map3_doc)
    map3_status = map3_doc.get("status", "in-progress")
    embedded_map4 = map3_doc.get("map4", {})
    if MAP4_TRACE.exists():
        map4_doc = load_json(MAP4_TRACE)
        map4 = map4_doc.get("map4", map4_doc)
        map4_status = map4_doc.get("status", "in-progress" if map4 else "not-built")
        if embedded_map4:
            raise SystemExit(
                "Map IV exists in both map3-county-trace.json and "
                "map4-county-trace.json"
            )
    else:
        map4 = embedded_map4
        map4_status = "in-progress" if map4 else "not-built"
    return map3, map3_status, map4, map4_status


def allowed_map4_keys():
    if not MAP4_KEYS.exists():
        return set()
    doc = load_json(MAP4_KEYS)
    values = doc.get("keys", doc)
    if not isinstance(values, list) or not all(isinstance(v, str) for v in values):
        raise SystemExit(f"{MAP4_KEYS}: expected a string list or {{\"keys\": [...]}}")
    return set(values)


def validate_fips_shape(name, trace, universe, expected_states, release, errors):
    invalid = sorted(k for k in trace if not isinstance(k, str) or len(k) != 5 or not k.isdigit())
    if invalid:
        errors.append(f"{name}: {len(invalid)} malformed FIPS, first: {invalid[:8]}")
    extra = sorted(set(trace) - universe)
    missing = sorted(universe - set(trace))
    if extra:
        errors.append(f"{name}: {len(extra)} FIPS outside the pinned universe, first: {extra[:8]}")

    actual_states = state_counts(k for k in trace if k in universe)
    partial = {
        st: (actual_states[st], total)
        for st, total in expected_states.items()
        if 0 < actual_states[st] < total
    }
    if partial:
        errors.append(f"{name}: partial states are forbidden: {partial}")
    if release and missing:
        errors.append(f"{name}: release is missing {len(missing)} FIPS across "
                      f"{sum(1 for st in expected_states if actual_states[st] == 0)} states")
    return missing, actual_states


def validate_labels(name, trace, allowed, errors):
    invalid = Counter()
    alias_use = Counter()
    ambiguity_none = []
    ambiguity_order = []
    ambiguity_duplicate = []
    for fips, value in trace.items():
        if not isinstance(value, str):
            invalid[repr(value)] += 1
            continue
        if value in SPECIAL or value in allowed:
            continue
        if value in LEGACY_ALIASES:
            alias_use[value] += 1
            continue
        if value.startswith("maybe:"):
            candidates = value[6:].split("|")
            if not candidates or any(not c for c in candidates):
                invalid[value] += 1
                continue
            if len(candidates) != len(set(candidates)):
                ambiguity_duplicate.append(fips)
            if candidates != sorted(candidates):
                ambiguity_order.append(fips)
            bad = [c for c in candidates if c not in allowed and c not in LEGACY_ALIASES]
            if bad:
                invalid[value] += 1
            continue
        if value.startswith("amb:"):
            candidates = value[4:].split("|")
            if len(candidates) < 2:
                invalid[value] += 1
                continue
            if len(candidates) != len(set(candidates)):
                ambiguity_duplicate.append(fips)
            if candidates != sorted(candidates):
                ambiguity_order.append(fips)
            if "none" in candidates:
                ambiguity_none.append(fips)
            bad = [c for c in candidates if c not in allowed and c not in LEGACY_ALIASES]
            if bad:
                invalid[value] += 1
            continue
        invalid[value] += 1

    if alias_use:
        errors.append(
            f"{name}: legacy aliases must be migrated: "
            + ", ".join(f"{k}={n} -> {LEGACY_ALIASES[k]}" for k, n in sorted(alias_use.items()))
        )
    if ambiguity_none:
        errors.append(
            f"{name}: {len(ambiguity_none)} ambiguity labels include none; "
            "served-status uncertainty needs its own status, first: "
            f"{ambiguity_none[:8]}"
        )
    if ambiguity_order:
        errors.append(
            f"{name}: {len(ambiguity_order)} ambiguity labels have noncanonical candidate order, "
            f"first: {ambiguity_order[:8]}"
        )
    if ambiguity_duplicate:
        errors.append(
            f"{name}: {len(ambiguity_duplicate)} ambiguity labels repeat a candidate, "
            f"first: {ambiguity_duplicate[:8]}"
        )
    if invalid:
        errors.append(
            f"{name}: invalid labels: "
            + ", ".join(f"{label}={count}" for label, count in invalid.most_common(12))
        )


def anchor_results(map3):
    out = {}
    for name, (fips, kind, expected) in ANCHORS.items():
        actual = map3.get(fips)
        if actual is None:
            out[name] = {"status": "pending", "fips": fips}
        elif kind == "exact":
            out[name] = {
                "status": "pass" if actual == expected else "fail",
                "fips": fips,
                "expected": expected,
                "actual": actual,
            }
        else:
            out[name] = {
                "status": "pass" if actual not in {"none", None} else "fail",
                "fips": fips,
                "expected": "served",
                "actual": actual,
            }
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--release", action="store_true")
    args = parser.parse_args()

    manifest = load_json(MANIFEST)
    fips = manifest.get("fips", [])
    if manifest.get("count") != len(fips) or len(fips) != 3108:
        raise SystemExit(f"{MANIFEST}: expected a self-consistent 3,108-FIPS manifest")
    if len(fips) != len(set(fips)):
        raise SystemExit(f"{MANIFEST}: duplicate FIPS")

    universe = set(fips)
    expected_states = state_counts(fips)
    map3, map3_status, map4, map4_status = load_traces()
    errors = []
    valid_status = {"not-built", "in-progress", "complete"}
    if map3_status not in valid_status:
        errors.append(f"Map III: invalid status {map3_status!r}")
    if map4_status not in valid_status:
        errors.append(f"Map IV: invalid status {map4_status!r}")
    if map3_status == "not-built" and map3:
        errors.append("Map III: not-built trace must be empty")
    if map4_status == "not-built" and map4:
        errors.append("Map IV: not-built trace must be empty")

    missing3, states3 = validate_fips_shape(
        "Map III", map3, universe, expected_states, args.release, errors
    )
    validate_labels("Map III", map3, MAP3_KEYS, errors)
    if map3_status == "complete" and missing3:
        errors.append(f"Map III: complete status has {len(missing3)} missing FIPS")
    if args.release and map3_status != "complete":
        errors.append(f"Map III: release requires complete status, got {map3_status}")

    map4_keys = allowed_map4_keys()
    missing4, states4 = validate_fips_shape(
        "Map IV", map4, universe, expected_states, args.release, errors
    )
    if map4 and not map4_keys:
        errors.append("Map IV: trace exists without map4-legend-keys.json")
    if map4_keys:
        validate_labels("Map IV", map4, map4_keys, errors)
    if map4_status == "complete" and missing4:
        errors.append(f"Map IV: complete status has {len(missing4)} missing FIPS")
    if args.release and map4_status != "complete":
        errors.append(f"Map IV: release requires complete status, got {map4_status}")

    anchors = anchor_results(map3)
    failed = [name for name, result in anchors.items() if result["status"] == "fail"]
    pending = [name for name, result in anchors.items() if result["status"] == "pending"]
    if failed:
        errors.append(f"Map III: failed anchors: {failed}")
    if args.release and pending:
        errors.append(f"Map III: release has pending anchors: {pending}")

    summary = {
        "mode": "release" if args.release else "checkpoint",
        "manifest_count": len(fips),
        "map3": {
            "status": map3_status,
            "count": len(map3),
            "missing": len(missing3),
            "unstarted_states": sorted(st for st in expected_states if states3[st] == 0),
            "labels": dict(sorted(Counter(map3.values()).items())),
        },
        "map4": {
            "status": map4_status,
            "count": len(map4),
            "missing": len(missing4),
            "unstarted_states": sorted(st for st in expected_states if states4[st] == 0),
            "legend_keys": len(map4_keys),
        },
        "anchors": anchors,
        "errors": errors,
    }
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
