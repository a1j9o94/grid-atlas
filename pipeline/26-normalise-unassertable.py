#!/usr/bin/env python3
"""Drop legend keys the trace never confirmed from the records that merely guess them.

The rule is the pipeline's own, recorded in the round-two adjudication: a mark with no
confirmed example should not be assertable. `amb:a|b` is for a county genuinely between
two candidates. It was being used as a default for faint ink, naming a pair that no
reader ever resolved anywhere on the plate.

Measured across all 3,108 counties, three of the 24 marks have zero exact reads:
`american-electric-power-corp`, `stone-webster` and `empire-power`. The first two are
named inside 319 `amb:` records each. `american-electric-power-corp` against
`stone-webster` alone accounts for 289 counties, 9% of the map, and the legend records
that pair as unresolvable at 400 dpi, so no reader was ever going to separate them.

Naming two companies that the trace never once resolved claims more than the plate
supports. `unknown-served` claims less and is true: something is printed there and its
pattern cannot be read.

The transformation, applied only to uncertain records and never to an exact read:

  drop every candidate with zero confirmed exact reads
  no candidates left            -> unknown-served
  exactly one candidate left    -> maybe:<key>, because a lone survivor the reader
                                   would not defend is a lean, not a reading
  more than one left            -> amb: over the survivors

An exact read is never touched. If a key has zero exact reads it cannot be the subject
of one, so there is nothing to rewrite.

  python3 26-normalise-unassertable.py --check
  python3 26-normalise-unassertable.py --write
"""
import argparse, collections, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
TRACE = os.path.join(HERE, 'lib', 'map4-county-trace.json')
UNCERTAIN = ('amb:', 'maybe:', 'partial:', 'split:')


def base(v):
    return str(v).split('#')[0]


def confirmed(rows):
    """Keys carrying at least one exact read, which is what makes a key assertable."""
    c = collections.Counter()
    for v in rows.values():
        s = str(v)
        if s in ('none', 'unknown-served') or s.startswith(UNCERTAIN):
            continue
        c[base(s)] += 1
    return c


def rewrite(value, ok):
    s = str(value)
    if not s.startswith(UNCERTAIN):
        return s
    prefix, body = s.split(':', 1)
    cands = [c for c in body.split('|') if c]
    keep = [c for c in cands if base(c) in ok]
    if len(keep) == len(cands):
        return s
    if not keep:
        return 'unknown-served'
    if len(keep) == 1:
        return 'maybe:' + keep[0]
    return 'amb:' + '|'.join(sorted(keep))


def main(write):
    doc = json.load(open(TRACE))
    rows = doc['map4']
    conf = confirmed(rows)
    ok = set(conf)
    never = sorted(set(base(k) for k in doc['key_rollup']['1932']) - ok)
    print(f'{len(ok)} of 24 marks carry an exact read')
    print(f'never confirmed anywhere: {never}')

    changes = collections.Counter()
    out = {}
    for f, v in rows.items():
        nv = rewrite(v, ok)
        out[f] = nv
        if nv != str(v):
            changes[f'{v}  ->  {nv}'] += 1
    print(f'\n{sum(changes.values())} counties rewritten, {len(changes)} distinct rewrites')
    for k, c in changes.most_common(12):
        print('  %5d  %s' % (c, k))

    before = sum(1 for v in rows.values()
                 if str(v) == 'unknown-served' or str(v).startswith(UNCERTAIN))
    after = sum(1 for v in out.values()
                if str(v) == 'unknown-served' or str(v).startswith(UNCERTAIN))
    print(f'\ndeclared uncertain: {before} -> {after} of {len(rows)}')
    print('unchanged by design: this makes the uncertain records honest, not fewer')
    if not write:
        print('(--check only, nothing written)')
        return
    doc['map4'] = out
    json.dump(doc, open(TRACE, 'w'), indent=1, sort_keys=True)
    print(f'wrote {TRACE}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--check', action='store_true')
    g.add_argument('--write', action='store_true')
    a = ap.parse_args()
    main(a.write)
