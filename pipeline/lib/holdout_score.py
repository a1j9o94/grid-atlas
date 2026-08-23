"""One definition of the holdout score, used by the scorer and by the emitter.

This exists because there were briefly two. The emitter reimplemented the rules and
produced 88.0% served where the scorer produced 90.5%, from the same two files, because
one treated `amb:` as a served reading and the other treated it as uncertain. Shipping a
number that disagrees with the tool that documents it is worse than shipping neither, so
the rules live here and both callers import them.

The rules, and why:

`amb:a|b` is a served reading. The reader saw ink and could not name which of two marks,
which is a statement about the pattern, not about whether anyone served the county. So it
scores for served status and is excluded from the exact-pattern count.

`maybe:k`, `partial:` and `unknown-served` are not served readings. They decline on the
question, so they are unscored on both measures rather than counted as either answer.

Pattern agreement is reported three ways. Exact match is the strictest. Compatible means
the two candidate sets overlap, which is the number worth quoting: a fresh read of
"either A or B" against a shipped "A" is a difference in confidence, not a disagreement
about who served the county. Hard conflict is the remainder, where the sets are disjoint.
"""
UNCERTAIN = ('amb:', 'maybe:', 'partial:', 'split:')
DECLINES = ('maybe:', 'partial:', 'split:')


def base(v):
    return str(v).split('#')[0]


def candidates(v):
    s = str(v)
    if s in ('none', 'unknown-served'):
        return {s}
    if s.startswith(UNCERTAIN):
        return {base(c) for c in s.split(':', 1)[1].split('|') if c}
    return {base(s)}


def served(v):
    s = str(v)
    if s == 'none':
        return 'none'
    if s == 'unknown-served' or s.startswith(DECLINES):
        return 'declined'
    return 'served'


def score(shipped, fresh, fipses):
    """Compare a shipped trace against a fresh read over a fixed sample."""
    out = {'scored': 0, 'served_n': 0, 'served_ok': 0,
           'pattern_n': 0, 'pattern_exact': 0, 'pattern_compatible': 0, 'misses': []}
    for f in fipses:
        a, b = shipped.get(f), fresh.get(f)
        if a is None or b is None:
            continue
        out['scored'] += 1
        sa, sb = served(a), served(b)
        if 'declined' not in (sa, sb):
            out['served_n'] += 1
            if sa == sb:
                out['served_ok'] += 1
            else:
                out['misses'].append((f, a, b, 'served'))
        if sa == 'served' and sb == 'served':
            out['pattern_n'] += 1
            ca, cb = candidates(a), candidates(b)
            if base(a) == base(b):
                out['pattern_exact'] += 1
                out['pattern_compatible'] += 1
            elif ca & cb:
                out['pattern_compatible'] += 1
                out['misses'].append((f, a, b, 'pattern-soft'))
            else:
                out['misses'].append((f, a, b, 'pattern-hard'))
    return out
