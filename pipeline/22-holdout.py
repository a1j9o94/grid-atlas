#!/usr/bin/env python3
"""Freeze a held-out sample, and score the shipped trace against a fresh read of it.

Why a holdout at all. Two-reader agreement stopped being a usable release gate the
moment an adjudicator started correcting both traces: once one person's judgement is
written into both sides, the agreement number measures that person's self-consistency
and nothing else. The same trap as an ICP reporting its own residual.

A holdout keeps one honest number. Freeze a stratified sample of counties now, ship the
trace, then read those counties fresh from the plate with the shipped verdict hidden and
compare. That estimates the error rate of the artifact as shipped.

The sample is not excluded from adjudication. The estimate wanted is the error left in
what ships, not the error in a deliberately neglected corner of it.

  python3 22-holdout.py freeze --n 150      write lib/map4-holdout-sample.json
  python3 22-holdout.py score               compare the fresh read against the trace
"""
import argparse, json, os, random, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, 'lib')
sys.path.insert(0, LIB)
import holdout_score as hs      # noqa: E402
SAMPLE = os.path.join(LIB, 'map4-holdout-sample.json')
FRESH = os.path.join(LIB, 'map4-holdout-fresh.json')
TRACE = os.path.join(LIB, 'map4-county-trace.json')
SEED = 19320101      # fixed so the sample is reproducible from the file alone
UNCERTAIN = ('amb:', 'maybe:', 'partial:', 'split:')


def freeze(n):
    fips = json.load(open(os.path.join(LIB, 'counties-conus-fips.json')))['fips']
    by_state = collections.defaultdict(list)
    for f in fips:
        by_state[f[:2]].append(f)
    rng = random.Random(SEED)
    picks = []
    # Proportional by state, at least one county per state, so no state is unrepresented
    # and no state dominates. Sorted before sampling so the draw does not depend on the
    # order the FIPS list happens to be in.
    for st in sorted(by_state):
        pool = sorted(by_state[st])
        k = max(1, round(n * len(pool) / len(fips)))
        picks.extend(rng.sample(pool, min(k, len(pool))))
    picks = sorted(set(picks))
    json.dump({'seed': SEED, 'n': len(picks),
               'note': 'Frozen before adjudication. Read these fresh with the shipped '
                       'verdict hidden, via 19-contact-sheet.py --blind, and score with '
                       '22-holdout.py score.',
               'fips': picks}, open(SAMPLE, 'w'), indent=1)
    print(f'froze {len(picks)} counties across {len(by_state)} states -> {SAMPLE}')


def score():
    if not os.path.exists(FRESH):
        raise SystemExit(f'no fresh read yet: expected {FRESH}')
    samp = json.load(open(SAMPLE))['fips']
    trace = json.load(open(TRACE))['map4']
    fresh = json.load(open(FRESH))
    fresh = fresh.get('fresh', fresh)
    r = hs.score(trace, fresh, samp)
    print(f'holdout {r["scored"]} of {len(samp)} scored')
    if r['served_n']:
        print('  served status  %d/%d = %.1f%%'
              % (r['served_ok'], r['served_n'], 100 * r['served_ok'] / r['served_n']))
    if r['pattern_n']:
        n = r['pattern_n']
        print('  which system, exact match      %d/%d = %.1f%%'
              % (r['pattern_exact'], n, 100 * r['pattern_exact'] / n))
        print('  which system, compatible       %d/%d = %.1f%%   (candidate sets overlap)'
              % (r['pattern_compatible'], n, 100 * r['pattern_compatible'] / n))
        hard = n - r['pattern_compatible']
        print('  which system, hard conflict    %d/%d = %.1f%%   (candidate sets disjoint)'
              % (hard, n, 100 * hard / n))
    unc = sum(1 for f in samp if f in trace and hs.served(trace[f]) == 'declined')
    print('  declared uncertain in the shipped trace: %d/%d = %.1f%%'
          % (unc, len(samp), 100 * unc / max(1, len(samp))))
    for f, a, b, k in sorted(r['misses'], key=lambda m: m[3]):
        print(f'    {k:13} {f}  shipped={a}  fresh={b}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['freeze', 'score'])
    ap.add_argument('--n', type=int, default=150)
    a = ap.parse_args()
    freeze(a.n) if a.cmd == 'freeze' else score()
