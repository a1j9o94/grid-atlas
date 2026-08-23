#!/usr/bin/env python3
"""Merge a batch of Map IV county readings into lib/map4-county-trace.json.

A batch file is a JSON object {"<label>": ["fips", ...], ...}. Labels use the
trace vocabulary: none, an exact legend key, amb:a|b, maybe:key, unknown-served,
with an optional #numeral suffix on the key.

  python3 apply4.py batches/il.json
  python3 apply4.py --status   # coverage report
"""
import argparse, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = HERE / "lib"
TRACE = LIB / "map4-county-trace.json"
sys.path.insert(0, str(LIB))
import plate_legend_map4 as L  # noqa: E402

KEYS = {s["key"] for s in L.SWATCHES}
NUMERALS = {s["key"]: {n for n, _ in L.NUMBERED.get(s["cell"], [])} for s in L.SWATCHES}
UNIVERSE = json.loads((LIB / "counties-conus-fips.json").read_text())["fips"]


def check_atom(a):
    key, _, num = a.partition("#")
    if key not in KEYS:
        raise SystemExit(f"unknown legend key {key!r}")
    if num:
        if not num.isdigit() or int(num) not in NUMERALS[key]:
            raise SystemExit(f"{key} has no numeral {num!r}")


def check(label):
    if label in ("none", "unknown-served"):
        return
    body = label
    for p in ("amb:", "maybe:"):
        if label.startswith(p):
            body = label[len(p):]
            break
    parts = body.split("|")
    if label.startswith("amb:") and len(parts) < 2:
        raise SystemExit(f"amb: needs two candidates: {label!r}")
    if not label.startswith("amb:") and len(parts) != 1:
        raise SystemExit(f"only amb: may carry a pipe: {label!r}")
    for a in parts:
        check_atom(a)
    if label.startswith("amb:") and parts != sorted(parts):
        raise SystemExit(f"amb: candidates must be sorted: {label!r}")


# ---------------------------------------------------------------------------
# Comparison rollup. The raw trace keeps every distinction the plate prints.
# This block says, in the file rather than by implication, which raw keys mean
# the same system across the two plate years, so a 1925 to 1932 diff does not
# read a naming change as a change of hands.
#
# Map IV splits Map III's single `insull` cell into `insull-middle-west` and
# `insull-other`; both roll to `insull`. Map III's `southeastern` and
# `hodenpyl` roll to `commonwealth-southern`, which on Map IV prints only as
# United Corporation numeral 2, so the numeral rollup carries that edge.
# `united-corporation` itself is a real new entity, formed January 1929, and
# rolls to itself: a county moving into it genuinely changed hands.
# ---------------------------------------------------------------------------

ROLLUP_1932 = {
    'insull-middle-west': 'insull',
    'insull-other': 'insull',
}

ROLLUP_1925 = {
    'southeastern': 'commonwealth-southern',
    'hodenpyl': 'commonwealth-southern',
    'fitkin': 'insull',
    'general-gas-electric': 'age',
}

NEW_IN_1932 = [
    'american-commonwealths', 'american-electric-power-corp',
    'central-public-service', 'central-states-electric', 'duke', 'empire-power',
    'nevada-california', 'new-england-power', 'pacific-gas-electric',
    'rockland', 'tri-utilities', 'united-corporation', 'utilities-power-light',
]


def rollup_block():
    r32 = {s['key']: ROLLUP_1932.get(s['key'], s['key']) for s in L.SWATCHES}
    numeral = {v.replace('m4:p01', 'ebasco').replace('m4:p02', 'insull-middle-west')
               .replace('m4:p04', 'united-corporation').replace(':n', '#'): k
               for k, v in L.DEMOTED_TO_NUMERAL.items()}
    return {
        'note': ('Raw keys are what the plate prints and are never collapsed. '
                 'Compare the two plate years on these canonical keys instead. '
                 'A key absent from a year map rolls to itself.'),
        '1932': dict(sorted(r32.items())),
        '1925': dict(sorted(ROLLUP_1925.items())),
        'numeral_1932': dict(sorted(numeral.items())),
        'new_in_1932': sorted(NEW_IN_1932),
        'gone_from_1932': sorted(L.GONE_FROM_MAP4),
    }


def load():
    if TRACE.exists():
        d = json.loads(TRACE.read_text())
    else:
        d = {"status": "in-progress", "map4": {}}
    d.setdefault("map4", {})
    return d


def save(d):
    d["key_rollup"] = rollup_block()
    seen = set(d["map4"])
    d["status"] = "complete" if seen >= set(UNIVERSE) else "in-progress"
    TRACE.write_text(json.dumps(d, indent=1, sort_keys=True) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("batch", nargs="*")
    ap.add_argument("--status", action="store_true")
    a = ap.parse_args()
    d = load()
    uni = set(UNIVERSE)
    for path in a.batch:
        b = json.loads(Path(path).read_text())
        n = 0
        for label, fipses in b.items():
            check(label)
            for f in fipses:
                if f not in uni:
                    raise SystemExit(f"{f} not in the canonical universe")
                d["map4"][f] = label
                n += 1
        print(f"{path}: {n} counties, {len(set(sum(b.values(), [])))} unique")
    save(d)
    if a.status or a.batch:
        have = set(d["map4"])
        by_state = {}
        for f in uni:
            by_state.setdefault(f[:2], [0, 0])
            by_state[f[:2]][0] += 1
            if f in have:
                by_state[f[:2]][1] += 1
        done = [s for s, (t, h) in sorted(by_state.items()) if h == t]
        part = [(s, h, t) for s, (t, h) in sorted(by_state.items()) if 0 < h < t]
        print(f"status {d['status']}: {len(have)}/{len(uni)} counties, "
              f"{len(done)} states complete")
        if part:
            print("partial:", ", ".join(f"{s} {h}/{t}" for s, h, t in part))


if __name__ == "__main__":
    main()
