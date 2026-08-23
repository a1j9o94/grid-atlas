#!/usr/bin/env python3
"""Emit the 1932 layer into the shipped artifact, and make the anchors testable.

Writes grid-atlas/public/data/timeline/holdings-1925.json in place: adds the 1932
year, legend, rollup and key_rollup, and flips trace_status.1932 to `complete`,
which is what makes the year appear in holdingsYears().

Two things change shape, both deliberate.

`trace_anchors` was a flat map of name to `true`, and CI asserted every value was
truthy. That is a stored claim, not a test: nothing compared it against the trace, so
it would have kept passing while the trace underneath it changed. Anchors are now
per year and carry the FIPS and the canonical key they expect, so CI can check them
against the artifact it ships. Two anchors are retracted rather than deleted, with
the reason recorded, because a retraction is a finding.

`legends[year][key]` gains an optional `subsidiaries` map from numeral to printed
label. Map IV overprints a circled numeral naming the subsidiary inside a group and
Map III carries none, so this is the richer half of the later plate. The client was
rendering it as "subsidiary 2".

  python3 25-emit-1932.py --check      validate and report, write nothing
  python3 25-emit-1932.py --write      write the artifact
"""
import argparse, collections, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lib'))
import plate_legend_map4 as L        # noqa: E402
import holdout_score as hs           # noqa: E402

TRACE = os.path.join(HERE, 'lib', 'map4-county-trace.json')
FIPS = os.path.join(HERE, 'lib', 'counties-conus-fips.json')
ART = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..', '..',
                                  'grid-atlas', 'public', 'data', 'timeline',
                                  'holdings-1925.json'))

STATE_OF = None      # filled from the county base, FIPS prefix to postal code
UNCERTAIN = ('amb:', 'maybe:', 'partial:', 'split:')

ANCHORS_1925 = [
    {'id': 'cook-il-insull', 'fips': ['17031'], 'expect_canonical': 'insull',
     'why': 'Commonwealth Edison was the Insull flagship.'},
    {'id': 'philadelphia-ugi', 'fips': ['42101'], 'expect_base': 'ugi',
     'why': 'United Gas Improvement held the Philadelphia system.'},
    {'id': 'fulton-ga-southeastern', 'fips': ['13121'], 'expect_base': 'southeastern',
     'why': 'Georgia Power was a Southeastern Power and Light company. Checked on the '
            'printed key, because the 1925 rollup folds Southeastern and Hodenpyl both '
            'into Commonwealth and Southern and the canonical form cannot tell them apart.'},
    {'id': 'nashville-hodenpyl', 'fips': ['47037'], 'expect_base': 'hodenpyl',
     'why': 'Tennessee Electric Power was a Hodenpyl-Hardy company. Checked on the printed '
            'key, for the same reason as Fulton.'},
]

ANCHORS_1932 = [
    {'id': 'cook-il-insull', 'fips': ['17031'], 'expect_canonical': 'insull',
     'why': 'Commonwealth Edison was the Insull flagship. Checked canonically, because '
            'Map IV splits Insull into Middle West and its other holdings and either '
            'satisfies the claim.'},
    {'id': 'philadelphia-ugi', 'fips': ['42101'], 'expect_base': 'united-corporation',
     'why': 'United Gas Improvement sits inside The United Corporation on Map IV.'},
    {'id': 'birmingham-ebasco', 'fips': ['01073'], 'expect_base': 'ebasco',
     'why': 'Birmingham Electric was a National Power and Light company inside EBASCO. '
            'This is the claim that retracted the Map III Jefferson County anchor.'},
    {'id': 'sacramento-valley-pge', 'fips': ['06067', '06113', '06101', '06011'],
     'expect_base': 'pacific-gas-electric',
     'why': 'Pacific Gas and Electric held the Sacramento Valley, and p18 is its legend cell.'},
    {'id': 'new-york-united', 'fips': ['36061'], 'expect_base': 'united-corporation',
     'why': 'Consolidated Gas of New York sits inside The United Corporation.'},
    {'id': 'los-angeles-blank', 'fips': ['06037'], 'expect_base': 'none',
     'why': 'All 24 Map IV marks are named holding-company groups. There is no Southern '
            'California Edison cell and no municipal category, and Los Angeles was served '
            'by the city Bureau of Power and Light and by SCE, so no legend key could fill '
            'it even in principle. A blank reading is the correct one, and this anchor '
            'tests that the emitter has not invented a fill.'},
]

RETRACTED = [
    {'id': 'jefferson-al-hatch', 'years': ['1925'],
     'reason': 'Asserted Southeastern Power and Light at Birmingham. Birmingham Electric '
               'was a National Power and Light company inside EBASCO, so the assertion '
               'encoded a contestable parentage rather than a fact the plate must satisfy. '
               'Replaced on Map IV by birmingham-ebasco.'},
    {'id': 'los-angeles-served', 'years': ['1925', '1932'],
     'reason': 'Asserted that Los Angeles must carry a fill. No Map IV legend cell can '
               'express that, so the anchor demanded something the source cannot say. '
               'Full reasoning in pipeline/lib/map4-anchor-retraction-la.md. Map IV now '
               'carries los-angeles-blank, which asserts the opposite and is checkable.'},
]


def base(v):
    return str(v).split('#')[0]


def numeral(v):
    s = str(v)
    return s.split('#', 1)[1] if '#' in s else None


def canonical(rollup, v):
    b = base(v)
    return rollup.get(b, b)


def build_legend():
    """The 24 Map IV marks, in the client's release shape."""
    numbered = {}
    for cell, pairs in L.NUMBERED.items():
        numbered[cell] = {str(n): lab for n, lab in pairs}
    out = {}
    for s in L.SWATCHES:
        entry = {'printed_label': s['printed']}
        subs = numbered.get(s['cell'])
        if subs:
            entry['subsidiaries'] = subs
        out[s['key']] = entry
    return out


def build_rollup(year_rows, state_of):
    """Per key, the states where it reads exactly and the states where it is uncertain."""
    firm = collections.defaultdict(set)
    soft = collections.defaultdict(set)
    for fips, v in year_rows.items():
        st = state_of.get(fips[:2])
        if st is None:
            continue
        raw = str(v)
        if raw == 'none' or raw == 'unknown-served':
            continue
        if raw.startswith(UNCERTAIN):
            body = raw.split(':', 1)[1]
            for k in body.split('|'):
                soft[base(k)].add(st)
        else:
            firm[base(raw)].add(st)
    keys = set(firm) | set(soft)
    return {k: {'states': sorted(firm.get(k, set())),
                'ambiguous_states': sorted(soft.get(k, set()) - firm.get(k, set()))}
            for k in sorted(keys)}


def holdout_estimate(rows):
    """The residual error estimate, computed from the frozen sample rather than typed in.

    Scored through lib/holdout_score.py, the same module 22-holdout.py uses, so the number
    that ships cannot drift from the number the tool reports. It did once: a reimplementation
    here said 88.0% served where the scorer said 90.5%, from the same two files, because the
    two disagreed about whether `amb:` counts as a served reading.
    """
    sample_p = os.path.join(HERE, 'lib', 'map4-holdout-sample.json')
    fresh_p = os.path.join(HERE, 'lib', 'map4-holdout-fresh.json')
    if not os.path.exists(fresh_p):
        return {'status': 'not-read'}
    samp = json.load(open(sample_p))
    fresh = json.load(open(fresh_p))['fresh']
    r = hs.score(rows, fresh, samp['fips'])
    frac = lambda a, b: round(a / b, 4) if b else None
    return {
        'year': '1932',
        'method': 'A stratified sample frozen before adjudication, re-read from the plate '
                  'with the shipped verdict hidden. Scored by pipeline/22-holdout.py. '
                  'See pipeline/lib/map4-holdout-result.md.',
        'sample_counties': samp['n'],
        'served_status_scored': r['served_n'],
        'served_status_agreement': frac(r['served_ok'], r['served_n']),
        'which_system_scored': r['pattern_n'],
        'which_system_exact': frac(r['pattern_exact'], r['pattern_n']),
        'which_system_compatible': frac(r['pattern_compatible'], r['pattern_n']),
        'which_system_note': 'Compatible means the two reads name overlapping candidate '
                             'sets, which is a difference in confidence rather than a '
                             'disagreement about who served the county. That is the number '
                             'to quote; exact match understates agreement.',
        'limitation': 'One person did both the trace and the fresh read. Blinding hides the '
                      'verdict but not familiarity with the plate, so this is biased '
                      'optimistic by an amount the method cannot measure.',
    }


def third_reader():
    """What independent readers of the contested counties concluded.

    Read from the tally the ingester stored, never recomputed here: who a reader upheld can
    only be measured against the trace as it stood before their verdicts were merged, and
    that state does not exist any more.
    """
    p = os.path.join(HERE, 'lib', 'map4-adjudications-reader.json')
    if not os.path.exists(p):
        return {'status': 'none-yet'}
    reads = [r for r in json.load(open(p)).get('reads', []) if r.get('tally')]
    if not reads:
        return {'status': 'none-yet'}
    n = sum(r['tally']['counties'] for r in reads)
    pri = sum(r['tally']['upheld_primary'] for r in reads)
    bli = sum(r['tally']['upheld_blind'] for r in reads)
    thi = sum(r['tally']['third_mark'] for r in reads)
    frac = lambda x: round(x / n, 4) if n else None
    return {
        'year': '1932',
        'method': 'Counties where the primary trace and the independent blind read named '
                  'different marks, presented one at a time with both candidates\' '
                  'provenance hidden and their positions shuffled, each candidate shown as a '
                  'crop of its own engraving from its confirmed legend site. See '
                  'pipeline/lib/map4-third-reader-result.md.',
        'counties_read': n,
        'upheld_primary': pri, 'upheld_primary_share': frac(pri),
        'upheld_blind': bli, 'upheld_blind_share': frac(bli),
        'third_mark': thi, 'third_mark_share': frac(thi),
        'note': 'These are the hardest counties on the sheet by construction, so the primary '
                'share is not the trace\'s accuracy. The third-mark share is counties where '
                'BOTH earlier reads were wrong, which no agreement measure between those two '
                'readers could have surfaced.',
    }


def check_anchors(anchors, rows, rollup, label):
    """An anchor says which granularity it asserts, and both are checked the same way.

    `expect_base` is the key as printed on that plate. `expect_canonical` is the key after
    key_rollup, for a claim that holds however the plate happens to subdivide a group.
    """
    bad = []
    for a in anchors:
        for f in a['fips']:
            v = rows.get(f)
            if v is None:
                bad.append(f'{label} {a["id"]} {f}: missing from the trace')
                continue
            if 'expect_base' in a:
                got, want, how = base(v), a['expect_base'], 'printed'
            else:
                got, want, how = canonical(rollup, v), a['expect_canonical'], 'canonical'
            if got != want:
                bad.append(f'{label} {a["id"]} {f}: expected {how} {want}, got {got}')
    return bad


def main(write):
    doc = json.load(open(ART))
    tr = json.load(open(TRACE))
    rows = tr['map4']
    kr = tr['key_rollup']
    universe = json.load(open(FIPS))['fips']

    global STATE_OF
    import csv
    # Postal codes come from the states layer built alongside the county base.
    states = json.load(open(os.path.join(HERE, 'data-raw', 'states-conus.json')))
    STATE_OF = {f['properties']['STATEFP']: f['properties']['STUSPS']
                for f in states['features']}

    problems = []
    if sorted(rows) != sorted(universe):
        problems.append(f'1932 covers {len(rows)} counties, universe is {len(universe)}')
    legend = build_legend()
    used = set()
    for v in rows.values():
        raw = str(v)
        if raw in ('none', 'unknown-served'):
            continue
        body = raw.split(':', 1)[1] if raw.startswith(UNCERTAIN) else raw
        for k in body.split('|'):
            used.add(base(k))
    unknown = sorted(used - set(legend))
    if unknown:
        problems.append(f'keys not in the Map IV legend: {unknown}')

    rollup32 = kr['1932']
    problems += check_anchors(ANCHORS_1932, rows, rollup32, '1932')
    problems += check_anchors(ANCHORS_1925, doc['years']['1925'], kr['1925'], '1925')

    # The failed classifier's fields must not be able to reach the artifact. They are field
    # names, so the test is on structure: every 1932 row must be one plain grammar string,
    # and no forbidden name may appear as a key anywhere in what is emitted. Matching on
    # value substrings instead would flag `unknown-served` for containing `served`, which
    # is the honest record rather than a leak.
    forbidden = set(doc['meta']['forbidden_legacy_fields'])
    def keys_in(node):
        if isinstance(node, dict):
            for k, v in node.items():
                yield k
                yield from keys_in(v)
        elif isinstance(node, list):
            for v in node:
                yield from keys_in(v)
    leaked = sorted(forbidden.intersection(keys_in(rows)))
    if leaked:
        problems.append(f'forbidden legacy fields reached the 1932 rows: {leaked}')
    nonstr = [k for k, v in rows.items() if not isinstance(v, str)]
    if nonstr:
        problems.append(f'{len(nonstr)} rows are not plain strings, first: {nonstr[:3]}')
    grammar_bad = [f'{k}={v}' for k, v in rows.items()
                   if not (str(v) == 'none' or str(v) == 'unknown-served'
                           or str(v).startswith(UNCERTAIN) or base(v) in legend)]
    if grammar_bad:
        problems.append(f'{len(grammar_bad)} values outside the release grammar, '
                        f'first: {grammar_bad[:3]}')

    n_unc = sum(1 for v in rows.values()
                if str(v) == 'unknown-served' or str(v).startswith(UNCERTAIN))
    print(f'1932: {len(rows)} counties, {len(rollup32)} rollup keys, '
          f'{n_unc} declared uncertain ({100*n_unc/len(rows):.1f}%)')
    print(f'legend: {len(legend)} marks, '
          f'{sum(1 for e in legend.values() if "subsidiaries" in e)} carrying numerals')
    if problems:
        print('PROBLEMS:')
        for p in problems:
            print('  ' + p)
        raise SystemExit(1)
    print('all checks pass')
    if not write:
        print('(--check only, nothing written)')
        return

    doc['years']['1932'] = {k: rows[k] for k in sorted(rows)}
    doc['legends']['1932'] = legend
    doc['rollups']['1932'] = build_rollup(rows, STATE_OF)
    doc['key_rollup'] = {'1925': kr['1925'], '1932': kr['1932']}
    doc['meta']['trace_status']['1932'] = 'complete'
    doc['meta']['trace_anchors'] = {'1925': ANCHORS_1925, '1932': ANCHORS_1932}
    doc['meta']['trace_anchors_retracted'] = RETRACTED
    doc['meta']['plate_names'] = {'1925': 'Map III', '1932': 'Map IV'}
    doc['meta']['trace_error_estimate'] = holdout_estimate(rows)
    doc['meta']['trace_third_reader'] = third_reader()
    # Named rather than averaged away. A single residual figure over 3,108 counties hides
    # where the doubt actually sits, and Oklahoma is the one state a second reader and a
    # measurement both decline to settle. Shipped as it was read, with the doubt stated.
    # Named per state rather than averaged. A single residual figure over 3,108 counties
    # hides where the doubt sits, and a third reader showed the doubt is not where the
    # agreement numbers put it: Oklahoma's contested counties went mostly to the blind
    # read, Iowa's almost entirely to the primary, and Minnesota's to neither.
    doc['meta']['trace_known_weaknesses'] = [
        {
            'year': '1932', 'state': 'MN', 'state_name': 'Minnesota', 'counties': 87,
            'declared_uncertain': 64,
            'status': 'weakest state on the sheet',
            'note': 'An independent third reader read 14 of Minnesota\'s contested counties '
                    'and named a mark neither existing read had chosen on 6 of them, the '
                    'highest third-mark rate anywhere. Four were standard-gas where the '
                    'primary read utilities-power-light and the blind read '
                    'central-states-electric, so both readers were wrong the same way. Two '
                    'more read blank. 64 of 87 counties still carry declared uncertainty. '
                    'This is the state to send a reader at next.',
        },
        {
            'year': '1932', 'state': 'OK', 'state_name': 'Oklahoma', 'counties': 77,
            'declared_uncertain': 15,
            'status': 'was the weakest state, now adjudicated by a third reader',
            'note': 'Shipped as the weakest state because 58 of 77 counties disagreed with '
                    'the independent read and neither measurement nor a second reader could '
                    'say which was right. A third reader has now read all 44 contested '
                    'counties: 22 went to the blind read, 17 to the primary, 5 to a third '
                    'mark. So the primary was the wrong one here, which is the opposite of '
                    'Iowa, and the flag was correctly placed. The trace now carries the '
                    'third reader\'s verdicts.',
        },
        {
            'year': '1932', 'state': 'IA', 'state_name': 'Iowa', 'counties': 99,
            'declared_uncertain': 14,
            'status': 'contested but resolved in the primary\'s favour, twice over',
            'note': 'Agreement with the independent read was 22.2%, which looked like two '
                    'noisy readers and nearly triggered a full re-read. Two independent '
                    'checks say otherwise. Measuring lattice orientation against both '
                    'candidate marks\' legend field sites favoured the primary on 40 of 43 '
                    'decidable counties and the blind read on none. A third reader then read '
                    '60 contested counties and favoured the primary on 51, the blind read on '
                    '3, and a third mark on 6. Re-reading Iowa would have degraded it.',
        },
    ]
    doc['meta']['release_scope'] = (
        'Map III (1925) and Map IV (1932), both traced to all 3,108 counties. '
        'Counties the plate cannot settle carry declared uncertainty rather than a guess.')
    doc['meta']['source']['plates']['map4']['georeference_status'] = 'built'
    doc['meta']['source']['plates']['map4']['georeference_note'] = (
        'Transfers the converged Map III fit by an affine correction and refits, then runs '
        'the same ICP ladder. Good enough to navigate and crop, not to sample blind: the '
        'mesh runs 10 to 40 px off, and about 18 px north of the printed lines in the Texas '
        'South Plains. Follow the printed county lines when the two disagree.')
    doc['meta']['trace_limits'] = doc['meta']['trace_limits'] + [
        'Map IV agreement between two independent readers is not a release gate and is not '
        'claimed. Two readers do not agree 95% of the time on which of 24 near-identical '
        'hatches fills a county at 400 dpi, and one pair is unresolvable at this '
        'resolution. What is claimed is complete coverage, declared uncertainty, checkable '
        'anchors, and a residual error estimate from a held-out sample. See '
        'pipeline/lib/map4-release-standard.md.',
        'Map IV numerals are recorded as printed even where they decode implausibly. Five '
        'such cases are logged rather than quietly corrected.',
        'Uncertainty is not uniform across the sheet, and meta.trace_known_weaknesses names '
        'where it concentrates. Minnesota is now the weakest state: a third reader named a '
        'mark neither existing read had chosen on 6 of the 14 contested counties read there, '
        'and 64 of 87 still carry declared uncertainty. Oklahoma was the weakest and has '
        'been adjudicated by that reader across all 44 of its contested counties.',
        'A third reader independently read 288 contested counties, holding the two candidate '
        'readings and their provenance hidden from view. On those counties, which are the '
        'hardest on the sheet by construction, the primary trace was upheld 62.5% of the '
        'time, the independent blind read 25.0%, and a mark neither had chosen 12.5%. That '
        '12.5% is the part no agreement measure between the first two readers could ever '
        'have surfaced.',
    ]
    doc['status'] = 'release-map3-1925+map4-1932'
    json.dump(doc, open(ART, 'w'), indent=1, sort_keys=True)
    print(f'wrote {ART}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--check', action='store_true')
    g.add_argument('--write', action='store_true')
    a = ap.parse_args()
    main(a.write)
