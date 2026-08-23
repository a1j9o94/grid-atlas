"""Map IV (1932) legend, measured off the scan, plus the numbered-subsidiary key.

Companion to `plate_legend.py`, which holds the Map III (1925) legend. Prose
descriptions of every mark, the confusable pairs and the plate hazards live in
`map4-legend-patterns.md`; this file is the machine-readable form.

Source image: data-raw/ftc72a/map4-1932.png, 5521 x 3784, native pixels,
origin upper left. Title block reads
"MAP IV. FIELDS OF OPERATIONS OF PRINCIPAL POWER GROUPS LOCATED BY COUNTIES 1932".

Orientation convention, same as the Map III work and pinned by the self tests
in `plate_measure.py`:

    0 = horizontal rules, 45 = backslash, 90 = vertical rules, 135 = slash

`period` is the perpendicular wavelength in native scan pixels, measured on the
swatch with the border inset by 7 px. `stroke` is the mean ink run length across
the profile, that is the printed line weight. `ink` is the mean ink share after
the paper-white correction in `plate_texture.ink_image`.

READ THIS BEFORE CLASSIFYING ANYTHING. Map IV does NOT carry a single swatch to
fill re-engraving factor the way Map III does. Measured ratios of fill period to
swatch period run from 0.96 to 1.82, because the engraver squeezed each motif
into a fixed 40 px box rather than cutting a true sample of the map screen.
Classify on structure, line weight and rank within a family. Where an absolute
number is needed use `fill_period`, never `period`.
"""

SOURCE = {
    'image': 'data-raw/ftc72a/map4-1932.png',
    'sha256': 'd8d4e5a1c2c0e5e4f59fc6baf1e8d0673351d734bb165f32595b3153c0e7330a',
    'width': 5521,
    'height': 3784,
    'page': 'Senate Doc. 92 Part 72-A, PDF page 90',
}

INSET = 7          # trim the engraved border box off each swatch before measuring
COUNTS = {'top_level_swatches': 24, 'numbered_entries': 23, 'numerals_on_map': 22}

# ---------------------------------------------------------------------------
# The 24 top-level swatches.
#
#   cell        -> the plate's texture id used across this work, m4:pNN
#   key         -> empire key. Reused from plate_legend.py where the same group
#                  prints on both plates; new keys are flagged in `new_on_map4`.
#   printed     -> the FTC's own wording, transcribed verbatim from the plate
#   bbox        -> (x, y, w, h) of the swatch box in native pixels
#   shape       -> short structural description, the thing to look for at 8x
#   period      -> perpendicular wavelength(s) in the swatch, px
#   orient      -> line orientation(s) in degrees, see convention above
#   stroke      -> mean ink run length across the profile, px
#   ink         -> mean ink share inside the swatch
#   fill_site   -> (name, x, y) where the mark was found and read on the map
#   fill_period -> period measured in that fill, px, or None if not confirmed
# ---------------------------------------------------------------------------

SWATCHES = [
 dict(cell='m4:p01', key='ebasco', new_on_map4=False,
      printed='Electric Bond & Share Co.',
      bbox=(774, 2416, 53, 54),
      shape='solid black, mottled with pinhole white speckle, no engraved structure',
      period=None, orient=None, stroke=None, ink=0.98,
      fill_site=('Louisiana and Mississippi delta', 3270, 2470), fill_period=None,
      fill_note='solid, ink 0.84 in the fill'),

 dict(cell='m4:p02', key='insull-middle-west', new_on_map4=True, rollup_map3='insull',
      printed='Middle West Utilities Co',
      bbox=(773, 2584, 51, 52),
      shape='square grid, thin black lines, clean white square cells',
      period=(8.9, 9.4), orient=(90, 0), stroke=2.8, ink=0.40,
      fill_site=('west Texas, numeral 1', 2120, 2770), fill_period=(7.4, 8.9)),

 dict(cell='m4:p03', key='insull-other', new_on_map4=True, rollup_map3='insull',
      printed='Other Insull Companies',
      bbox=(731, 3068, 51, 52),
      shape='diagonal crosshatch, thin lines both slopes, open white diamond cells, nothing inside the cells',
      period=(9.7, 9.2), orient=(135, 45), stroke=2.5, ink=0.43,
      fill_site=('north-east Illinois, ring around Chicago', 3400, 1480), fill_period=None),

 dict(cell='m4:p04', key='united-corporation', new_on_map4=True,
      printed='United Corporation, (The)',
      bbox=(794, 3113, 52, 51),
      shape='continuous vertical rules with a column of short vertical dashes centred in each gap',
      period=(7.1,), orient=(90,), stroke=2.0, ink=0.24,
      fill_site=('northern New York, numeral 4', 4440, 1150), fill_period=(11.5,),
      fill_note='rule to rule about 14 in the swatch, wider in the fill'),

 dict(cell='m4:p05', key='american-commonwealths', new_on_map4=True,
      printed='American Commonwealths Power Corp.',
      bbox=(1587, 2685, 53, 52),
      shape='rows of short horizontal dashes, brick-offset, no continuous rule anywhere',
      period=(7.1,), orient=(0,), stroke=2.4, ink=0.21,
      fill_site=('central Arizona', 1420, 2130), fill_period=(8.3,)),

 dict(cell='m4:p06', key='american-electric-power-corp', new_on_map4=True,
      printed='American Electric Power Corp.',
      bbox=(1447, 2740, 52, 52),
      shape='thin backslash rules, widest spacing of the backslash family',
      period=(13.8,), orient=(45,), stroke=2.2, ink=0.34,
      fill_site=None, fill_period=None,
      fill_note='NOT confirmed in the field. Not the modern American Electric Power, '
                'whose ancestor American Gas & Electric is m4:p01:n1 on this plate.'),

 dict(cell='m4:p07', key='american-water-works', new_on_map4=False,
      printed='American Water Works & Electric Co.,(The)',
      bbox=(1588, 2797, 53, 52),
      shape='continuous horizontal rules with a row of short horizontal dashes centred in each gap, the horizontal mirror of p04',
      period=(6.1,), orient=(0,), stroke=1.6, ink=0.29,
      fill_site=('northern West Virginia', 4200, 1660), fill_period=None,
      fill_note='rule to rule 10.3 in the swatch'),

 dict(cell='m4:p08', key='age', new_on_map4=False,
      printed='Associated Gas & Electric Co.',
      bbox=(1426, 2854, 54, 53),
      shape='bold backslash rules, thick stroke, medium spacing',
      period=(11.2,), orient=(45,), stroke=3.0, ink=0.40,
      fill_site=('north-east Pennsylvania', 4336, 1276), fill_period=(11.9,),
      fill_note='fill stroke 4.4, fill ink 0.39 to 0.42'),

 dict(cell='m4:p09', key='central-public-service', new_on_map4=True,
      printed='Central Public Service Corp.',
      bbox=(1426, 2913, 54, 54),
      shape='bold vertical rules, near 50 percent duty, black and white bars of similar width',
      period=(9.2,), orient=(90,), stroke=4.2, ink=0.50,
      fill_site=('Portland, Oregon', 830, 880), fill_period=(10.6,)),

 dict(cell='m4:p10', key='central-states-electric', new_on_map4=True,
      printed='Central States Electric Co.',
      bbox=(1428, 2973, 52, 54),
      shape='dark diagonal mesh, crosshatch both slopes with a white pearl at each crossing and a white diamond in each cell',
      period=(12.8, 11.2), orient=(135, 45), stroke=4.0, ink=0.64,
      fill_site=('eastern Iowa, Cedar Rapids and Dubuque', 3170, 1508), fill_period=(17.0, 20.6)),

 dict(cell='m4:p11', key='cities-service', new_on_map4=False,
      printed='Cities Service Co.',
      bbox=(1295, 3027, 52, 53),
      shape='fine slash rules, closest spacing of the slash family',
      period=(7.0,), orient=(135,), stroke=2.5, ink=0.39,
      fill_site=('Joplin, south-west Missouri', 3024, 2108), fill_period=(8.2,),
      fill_note='Empire District Electric, a Cities Service company. Fill ink 0.33.'),

 dict(cell='m4:p12', key='duke', new_on_map4=True,
      printed='Duke Power Co.',
      bbox=(1297, 3091, 52, 55),
      shape='grid of isolated black plus marks on a square lattice, not lines',
      period=(9.4, 9.8), orient=(90, 0), stroke=3.5, ink=0.33,
      fill_site=('Carolina Piedmont', 4120, 2090), fill_period=(16.5, 19.3),
      fill_note='the plus motif is drawn at roughly half scale in the swatch, ratio 1.8'),

 dict(cell='m4:p13', key='empire-power', new_on_map4=True,
      printed='Empire Power Corp.',
      bbox=(1356, 3146, 52, 55),
      shape='vertical rules, thinner than p09 and more widely spaced, white gaps clearly wider than the bars',
      period=(12.0,), orient=(90,), stroke=4.2, ink=0.40,
      fill_site=None, fill_period=None,
      fill_note='NOT confirmed in the field'),

 dict(cell='m4:p14', key='nevada-california', new_on_map4=True,
      printed='Nevada-California Electric Corp. (The)',
      bbox=(1558, 3210, 54, 54),
      shape='short slash dashes, fat and short, rows offset, light',
      period=(9.5,), orient=(135,), stroke=2.3, ink=0.24,
      fill_site=('Owens Valley, eastern California', 1030, 1960), fill_period=None),

 dict(cell='m4:p15', key='new-england-power', new_on_map4=True,
      printed='New England Power Association',
      bbox=(1493, 3267, 52, 52),
      shape='bold horizontal rules, thick stroke, wide spacing',
      period=(11.6,), orient=(0,), stroke=6.0, ink=0.39,
      fill_site=('central Massachusetts', 4752, 1180), fill_period=(14.0,)),

 dict(cell='m4:p16', key='north-american', new_on_map4=False,
      printed='North American Co., (The)',
      bbox=(1410, 3319, 54, 56),
      shape='thin slash rules, widest spacing of the slash family, mirror of p06',
      period=(14.6,), orient=(135,), stroke=2.2, ink=0.34,
      fill_site=('Cleveland; also Milwaukee', 4007, 1492), fill_period=None),

 dict(cell='m4:p17', key='north-american-light', new_on_map4=False,
      printed='North American Lt. & Pr. Co.',
      bbox=(2029, 2919, 53, 51),
      shape='bold slash rules, thick stroke, medium spacing, mirror of p08',
      period=(12.2,), orient=(135,), stroke=3.0, ink=0.33,
      fill_site=('central Illinois, Decatur', 3421, 1736), fill_period=(15.8,),
      fill_note='distinct company from north-american, see TRAPS'),

 dict(cell='m4:p18', key='pacific-gas-electric', new_on_map4=True,
      printed='Pacific Gas & Electric Co.',
      bbox=(2044, 2976, 52, 53),
      shape='diamond lattice of thin lines with a dark dot centred inside each white cell',
      period=(14.4, 12.4), orient=(135, 45), stroke=2.4, ink=0.36,
      fill_site=('Sacramento Valley', 660, 1590), fill_period=(15.7, 14.9)),

 dict(cell='m4:p19', key='rockland', new_on_map4=True,
      printed='Rockland Light & Power Co.',
      bbox=(2110, 3035, 50, 52),
      shape='small square dots on an offset quincunx lattice, the lightest mark on the plate',
      period=(7.9, 7.4), orient=(135, 45), stroke=2.7, ink=0.09,
      fill_site=('Orange and Rockland counties, lower Hudson', 4565, 1362), fill_period=(10.0,),
      fill_note='one dotted county west of the Hudson, dots on an offset lattice about 10 px. '
                'Prints bolder in the fill than the swatch suggests.'),

 dict(cell='m4:p20', key='standard-gas', new_on_map4=False,
      printed='Standard Gas & Electric Co.',
      bbox=(2112, 3097, 50, 50),
      shape='short backslash dashes, thin and sparse, rows offset, mirror of p14 and lighter',
      period=(9.0,), orient=(45,), stroke=3.0, ink=0.09,
      fill_site=('Minneapolis; Green Bay; Oklahoma City; San Diego', 3005, 1168),
      fill_period=None, fill_note='four independent sites, fill ink 0.26 to 0.30'),

 dict(cell='m4:p21', key='stone-webster', new_on_map4=False,
      printed='Stone & Webster, Inc.',
      bbox=(2047, 3145, 52, 51),
      shape='fine backslash rules, closest spacing of the backslash family, mirror of p11',
      period=(6.5,), orient=(45,), stroke=2.5, ink=0.26,
      fill_site=('Norfolk; Beaumont; Tacoma', 4531, 1918), fill_period=(8.4, 12.6),
      fill_note='fill period varies 8.4 to 12.6 across sites, thin stroke throughout'),

 dict(cell='m4:p22', key='tri-utilities', new_on_map4=True,
      printed='Tri-Utilities Corp.',
      bbox=(1999, 3206, 53, 51),
      shape='fine horizontal rules, closely spaced, about nine across the swatch',
      period=(5.3,), orient=(0,), stroke=2.4, ink=0.40,
      fill_site=('south-west Wyoming', 1690, 1455), fill_period=(5.1,)),

 dict(cell='m4:p23', key='united-light-power', new_on_map4=False,
      printed='United Light & Power Co. (The)',
      bbox=(2153, 3262, 50, 56),
      shape='short vertical dashes only, dense, columns brick-offset, no continuous rule anywhere',
      period=(7.2,), orient=(90,), stroke=2.0, ink=0.32,
      fill_site=('Fort Dodge, Iowa; also Davenport', 2995, 1505), fill_period=(7.4, 7.8),
      fill_note='columns of short vertical dashes with no continuous rule anywhere, which is what '
                'separates it from p04. Grand Rapids, the other obvious candidate, reads as p04.'),

 dict(cell='m4:p24', key='utilities-power-light', new_on_map4=True,
      printed='Utilities Power & Light Corp',
      bbox=(2143, 3323, 50, 52),
      shape='dark ground with large white rounded diamonds on a square lattice, reads white on black',
      period=(14.1, 15.4), orient=(90, 0), stroke=7.0, ink=0.66,
      fill_site=('south-west Missouri', 3150, 2035), fill_period=(20.9,)),
]

# ---------------------------------------------------------------------------
# The 23 numbered subsidiary entries.
#
# The numeral printed inside a small circle on a county fill indexes THIS list,
# scoped to the parent whose texture the county carries. The three lists overlap,
# so a numeral read without its host texture is meaningless. A circled 2 is
# American Power & Light on solid black, Central Illinois Public Service on the
# square grid, and Commonwealth & Southern on the vertical rails.
#
# Numerals label a REGION, not a single county. One circle covers a whole
# contiguous block of the same texture and neighbouring counties in that block
# carry no numeral of their own. A trace must propagate the numeral across the
# patch and record where the propagation was ambiguous.
# ---------------------------------------------------------------------------

NUMBERED = {
 'm4:p01': [   # Electric Bond & Share Co., numerals 1-4
   (1, 'American Gas & Electric Co.'),
   (2, 'American Power & Light Co'),
   (3, 'National Power & Light Co'),
   (4, 'Electric Power & Light Corp.'),
 ],
 'm4:p02': [   # Middle West Utilities Co, numerals 1-13
   (1,  'Central & South West Utilities Co.'),
   (2,  'Central Illinois Public Service Co'),
   (3,  'Central Power Co'),
   (4,  'Commonwealth Light & Power Co., The'),
   (5,  'Kansas Electric Power Co., The'),
   (6,  'Kentucky Securities Corp., The'),
   (7,  'Kentucky Utilities Co'),
   (8,  'Michigan Gas & Electric Co'),
   (9,  'Middle West Utilities Co of Canada, Ltd.'),   # printed "(not shown on map)"
   (10, 'Missouri Gas & Electric Service Co'),
   (11, 'National Electric Power Co.'),
   (12, 'North West Utilities Co.'),
   (13, 'United Public Service Co'),
 ],
 'm4:p04': [   # United Corporation, (The), numerals 1-6
   (1, 'Columbia Gas & Electric Corp.'),
   (2, 'Commonwealth & Southern Corp. (The)'),
   (3, 'Consolidated Gas Co. of New York'),
   (4, 'Niagara Hudson Power Corp.'),
   (5, 'Public Service Corp. of New Jersey'),
   (6, 'United Gas Improvement Co. (The)'),
 ],
}

NOT_SHOWN_ON_MAP = {('m4:p02', 9)}   # the plate says so in as many words

# 'Other Insull Companies' (m4:p03) is a parent-style entry with NO numbered list.
# A numeral found on a p03 fill is either a misread of the host texture or a
# circle that belongs to a neighbouring patch. Do not invent a p03 subsidiary.

# Numeral ranges, useful when the host texture is unreadable but the numeral is not.
NUMERAL_SCOPE_HINTS = {
  'ge7':  ['m4:p02'],                        # 7 to 13 can only be Middle West
  '5to6': ['m4:p02', 'm4:p04'],              # never Electric Bond & Share
  '1to4': ['m4:p01', 'm4:p02', 'm4:p04'],
}

# Verified numeral instances, each read at 8x with the host texture identified first.
# (x, y, numeral, host cell, what it resolves to, where)
VERIFIED_NUMERALS = [
  (3400, 1372, 12, 'm4:p02', 'North West Utilities Co.',            'southern Wisconsin'),
  (2856, 1948,  5, 'm4:p02', 'Kansas Electric Power Co., The',      'eastern Kansas'),
  (2140, 2760,  1, 'm4:p02', 'Central & South West Utilities Co.',  'west Texas'),
  (3660, 1498,  8, 'm4:p02', 'Michigan Gas & Electric Co',          'south-west Michigan'),
  (3620, 1252,  4, 'm4:p02', 'Commonwealth Light & Power Co., The', 'northern Michigan'),
  (3727, 1384,  2, 'm4:p04', 'Commonwealth & Southern Corp. (The)', 'Michigan'),
  (4232, 2392,  2, 'm4:p04', 'Commonwealth & Southern Corp. (The)', 'South Carolina'),
  (4448, 1116,  4, 'm4:p04', 'Niagara Hudson Power Corp.',          'northern New York'),
  (4246, 2384,  3, 'm4:p01', 'National Power & Light Co',           'Carolina Piedmont'),
]

# ---------------------------------------------------------------------------
# Honest limits. A tracer who hits one of these should mark the county ambiguous
# rather than guess. Prose on how to break each pair is in map4-legend-patterns.md.
# ---------------------------------------------------------------------------

CONFUSABLE = [
  (('m4:p06', 'm4:p21'), 'unresolvable',
   'both thin backslash. stone-webster fills measure 8.4 to 12.6, which covers '
   'where american-electric-power-corp should sit. Period cannot separate them. '
   'Use geography or leave ambiguous.'),
  (('m4:p08', 'm4:p21'), 'separable',
   'same slope, similar fill period. Break on line weight: age thick, w 4.4 and '
   'ink 0.39 to 0.45; stone-webster thin, w 3.0 and ink 0.17 to 0.26. Needs three '
   'or more lines in the window.'),
  (('m4:p16', 'm4:p17'), 'separable',
   'the slash mirror of the pair above. north-american thin and wide, '
   'north-american-light bold and medium. Weight, not spacing.'),
  (('m4:p04', 'm4:p23'), 'separable',
   'both dense vertical stipple at about 7.2. p04 has continuous full-height '
   'rules alternating with dash columns, p23 has no continuous rule at all. '
   'Not separable in a county too small to show a full rule. A numeral settles it, '
   'since p23 has no numbered subsidiaries.'),
  (('m4:p09', 'm4:p13'), 'marginal',
   'both plain bold vertical rules. Only the duty cycle differs, ink 0.50 against '
   '0.40. Will not survive fold shadow or fading.'),
  (('m4:p15', 'm4:p22'), 'separable',
   'the same bold-versus-fine horizontal mark at a factor of two. A county showing '
   'two rules cannot carry the distinction. Geography is the tiebreak.'),
  (('m4:p02', 'm4:p12'), 'separable',
   'both square lattices at about 9.5 in the swatch. p02 is continuous grid lines, '
   'p12 is isolated plus marks. They merge if the plus arms blur.'),
  (('m4:p03', 'm4:p10', 'm4:p18'), 'separable',
   'all diagonal lattices. p03 thin and open, ink 0.43. p10 dark, ink 0.64, white '
   'pearls at the crossings. p18 has a dark dot inside each white cell.'),
  (('m4:p19', 'm4:p20'), 'marginal',
   'the two lightest marks on the plate, both ink 0.09. p19 dots, p20 backslash '
   'dashes. Either can read as bare paper in a small fold-shadowed county, which '
   'produces false unserved counties.'),
  (('m4:p14', 'm4:p20'), 'separable',
   'mirrored dash marks, slash against backslash. Slope is the whole test.'),
]

# ---------------------------------------------------------------------------
# Cross-plate traps, all live on this plate.
# ---------------------------------------------------------------------------

TRAPS = {
 'north-american vs north-american-light':
   'm4:p16 is The North American Co.; m4:p17 is Studebaker-McKinley\'s North '
   'American Light and Power. Different companies, adjacent in the legend, both '
   'slash. The easiest error to make on Map IV.',
 'united-corporation vs united-gas-electric':
   'm4:p04 is The United Corporation, formed January 1929, so unlike on Map III it '
   'legitimately appears here. Map III\'s united-gas-electric has no Map IV cell.',
 'commonwealth-southern':
   'does not print as a Map IV swatch. It appears only as m4:p04:n2. Map III\'s '
   'separate southeastern and hodenpyl cells are both folded into that one numeral, '
   'so a 1925 to 1932 comparison must union those two against m4:p04:n2.',
 'american-electric-power-corp':
   'm4:p06 is not the modern American Electric Power. AEP\'s ancestor American Gas '
   '& Electric is m4:p01:n1 on this plate.',
 'insull split':
   'Map III\'s single insull cell becomes two on Map IV, m4:p02 insull-middle-west '
   'and m4:p03 insull-other. Both carry rollup_map3 = insull.',
}

# Map III keys with no Map IV representation at all. This is itself a finding
# about consolidation between the two plates.
GONE_FROM_MAP4 = ['fitkin', 'general-gas-electric', 'federal-light',
                  'northeastern-super', 'tenney', 'united-gas-electric',
                  'southeastern', 'hodenpyl']

# Map III keys that survive only as a numeral under a Map IV parent.
DEMOTED_TO_NUMERAL = {
  'ugi': 'm4:p04:n6',
  'national-electric': 'm4:p02:n11',
  'commonwealth-southern': 'm4:p04:n2',
}

# ---------------------------------------------------------------------------
# Plate hazards. See map4-legend-patterns.md for the full list.
# ---------------------------------------------------------------------------

HAZARDS = [
 'Two vertical page folds, near x 1290 and x 3550, wash ink out of a 60 to 150 px '
 'column and add a gradient that pulls autocorrelation period estimates short.',
 'State borders and the map frame are thick black and darken small border counties.',
 'State-name labels sit in white boxes inside the fill and punch holes in the texture.',
 'Rivers, lakes, coastlines and swamp symbols are heavy black and inflate any '
 'county-interior ink statistic.',
 'The numbered circles are themselves ink and lift the ink share of a light-mark county.',
 'The plate note reads "Separate cities and towns served not shown on map", so a blank '
 'county is not evidence that nobody served it.',
 'The near-solid black at Chicago and Gary carries no readable structure and cannot be '
 'told from ebasco solid black by looking. Record it as unresolved, not as ebasco.',
]


def by_cell():
    return {s['cell']: s for s in SWATCHES}


def by_key():
    return {s['key']: s for s in SWATCHES}


def swatch_rects():
    """Cell -> (x0, y0, x1, y1) with the engraved border box trimmed off."""
    out = {}
    for s in SWATCHES:
        x, y, w, h = s['bbox']
        out[s['cell']] = (x + INSET, y + INSET, x + w - INSET, y + h - INSET)
    return out


def raw_key(cell, numeral=None):
    """Trace vocabulary. m4:pNN for a texture, m4:pNN:nK when a numeral is read."""
    return '%s:n%d' % (cell, numeral) if numeral is not None else cell


def resolve(cell, numeral=None):
    """(printed parent label, printed subsidiary label or None). Raises on a bad numeral."""
    s = by_cell()[cell]
    if numeral is None:
        return s['printed'], None
    for n, label in NUMBERED.get(cell, []):
        if n == numeral:
            return s['printed'], label
    raise KeyError('%s has no numeral %r; the host texture is probably misread' % (cell, numeral))


if __name__ == '__main__':
    assert len(SWATCHES) == COUNTS['top_level_swatches']
    assert sum(len(v) for v in NUMBERED.values()) == COUNTS['numbered_entries']
    assert len({s['cell'] for s in SWATCHES}) == len(SWATCHES)
    assert len({s['key'] for s in SWATCHES}) == len(SWATCHES)
    for x, y, n, cell, label, where in VERIFIED_NUMERALS:
        assert resolve(cell, n)[1] == label, (cell, n)
    print('%d swatches, %d numbered entries, %d numerals on the map'
          % (len(SWATCHES), COUNTS['numbered_entries'], COUNTS['numerals_on_map']))
    print('confirmed in the field: %d of %d'
          % (sum(1 for s in SWATCHES if s['fill_site']), len(SWATCHES)))
    print('unconfirmed: %s'
          % ', '.join(s['key'] for s in SWATCHES if not s['fill_site']))
