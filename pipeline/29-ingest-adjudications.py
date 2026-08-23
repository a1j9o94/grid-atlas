#!/usr/bin/env python3
"""Merge a reader's adjudications from the Hatch Bench page back into the trace.

The page keeps verdicts on the reader's own device and hands them over as JSON when they
press Copy. Paste that into a file and point `--json` at it. `--html` still works for a
saved copy of the page, where each verdict rides on its county's card as `data-verdict`.

What it does with each verdict:

- a legend key      -> that key becomes the reading. If it is the mark the trace already
                       carried, the trace's numeral is kept: the reader was shown the mark
                       and not the subsidiary list, so confirming the mark says nothing
                       against the numeral and dropping it would discard a reading nobody
                       disputed
- `none`            -> no fill
- `unreadable`      -> `unknown-served`, which is the honest record for a county whose
                       two candidates a third reader could not separate either

It refuses to overwrite silently. Every change is printed, and `--check` writes nothing.
A verdict naming a key that is not in the Map IV legend is rejected rather than trusted.

  python3 29-ingest-adjudications.py --html saved.html --check
  python3 29-ingest-adjudications.py --html saved.html --write
"""
import argparse, json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lib'))
import plate_legend_map4 as L        # noqa: E402

TRACE = os.path.join(HERE, 'lib', 'map4-county-trace.json')
LOG = os.path.join(HERE, 'lib', 'map4-adjudications-reader.json')
CARD = re.compile(r'<article class="card" data-fips="(\d{5})" data-verdict="([^"]*)"')


def read_html(path):
    found = CARD.findall(open(path, encoding='utf-8').read())
    if not found:
        raise SystemExit('no cards found: is this the saved Hatch Bench page?')
    return len(found), {f: v for f, v in found if v}


def read_json(path):
    """The page's own export: a flat map of FIPS to verdict."""
    d = json.load(open(path))
    d = d.get('verdicts', d)
    bad = [k for k in d if not (isinstance(k, str) and len(k) == 5 and k.isdigit())]
    if bad:
        raise SystemExit(f'keys that are not five-digit FIPS: {bad[:5]}')
    picks = {k: v for k, v in d.items() if v}
    return len(d), picks


def main(html_path, json_path, write):
    legend = {s['key'] for s in L.SWATCHES}
    doc = json.load(open(TRACE))
    rows = doc['map4']
    total, picks = read_json(json_path) if json_path else read_html(html_path)
    found = [None] * total
    unknown_fips = sorted(f for f in picks if f not in rows)
    if unknown_fips:
        raise SystemExit(f'verdicts for counties not in the trace: {unknown_fips[:5]}')
    bad = sorted({v for v in picks.values()
                  if v not in legend and v not in ('none', 'unreadable')})
    if bad:
        raise SystemExit(f'verdicts naming keys that are not in the Map IV legend: {bad}')

    changes, same, kinds = [], 0, collections.Counter()
    for f, v in sorted(picks.items()):
        old = str(rows.get(f))
        if v == 'unreadable':
            new = 'unknown-served'
        elif old.split('#')[0] == v and '#' in old:
            new = old          # same mark confirmed: the numeral was never in question
        else:
            new = v
        kinds[v if v in ('none', 'unreadable') else 'named a mark'] += 1
        if old == new:
            same += 1
        else:
            changes.append((f, old, new))

    print(f'{total} counties in the handoff, {len(picks)} adjudicated, '
          f'{total-len(picks)} left blank')
    for k, c in kinds.most_common():
        print(f'  {c:4d}  {k}')
    print(f'\n{same} already agreed with the trace, {len(changes)} change it')
    for f, old, new in changes:
        print(f'    {f}  {old}  ->  {new}')

    if not write:
        print('\n(--check only, nothing written)')
        return
    for f, _old, new in changes:
        rows[f] = new
    json.dump(doc, open(TRACE, 'w'), indent=1, sort_keys=True)
    # The reader's own verdicts are kept separately as well, because they are a second
    # independent read and worth having as evidence rather than only as a mutation.
    # The tally goes with them: who the reader upheld can only be computed against the
    # trace as it stood BEFORE the merge, and one line below this that moment is gone.
    prior = json.load(open(LOG)) if os.path.exists(LOG) else {'reads': []}
    blind = json.load(open(os.path.join(HERE, 'lib', 'map4-blind-west.json')))['blind_west']
    tal, per = collections.Counter(), collections.defaultdict(collections.Counter)
    for f, v in picks.items():
        pv = str(rows.get(f)).split('#')[0]
        bv = str(blind.get(f, {}).get('verdict')).split('#')[0]
        k = 'primary' if v == pv else ('blind' if v == bv else 'third')
        tal[k] += 1
        per[f[:2]][k] += 1
    prior['reads'].append({'source': os.path.basename(json_path or html_path),
                           'verdicts': picks,
                           'tally': {'counties': len(picks),
                                     'upheld_primary': tal['primary'],
                                     'upheld_blind': tal['blind'],
                                     'third_mark': tal['third'],
                                     'by_state': {s2: dict(c) for s2, c in sorted(per.items())}}})
    json.dump(prior, open(LOG, 'w'), indent=1, sort_keys=True)
    print(f'\nwrote {TRACE} and appended the read to {LOG}')
    print('Re-run 25-emit-1932.py --write, then verify in grid-atlas.')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument('--json', help="the page's Copy verdicts output")
    src.add_argument('--html', help='a saved copy of the page itself')
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--check', action='store_true')
    g.add_argument('--write', action='store_true')
    a = ap.parse_args()
    main(a.html, a.json, a.write)
