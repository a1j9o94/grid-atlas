"""Map III legend: swatch rectangles measured off the scan, and the group taxonomy."""

# native scan pixel rects for Map III (page index 88), measured from a gridded crop
COLS = {'c1': (381, 457), 'c2': (737, 804), 'c3': (1093, 1159), 'c4': (1447, 1515)}
ROWS = {'r1': (2764, 2834), 'r2': (2851, 2920), 'r3': (2946, 3015),
        'r4': (3040, 3108), 'r5': (3128, 3198)}

# cell -> (legend text as printed, empire key, note)
# The empire keys are pinned by the copy this feeds. Where a 1925 legend entry is a
# predecessor of a 1929-30 empire the key reflects the later empire, because the whole
# point of the dataset is the empire footprint, not the 1925 corporate name.
MAP3 = {
 'c1r1': ('Electric Bond and Share Co.',                             'ebasco',                None),
 'c1r2': ('Southeastern Power and Light Co.',                        'southeastern',          'merged into C&S in 1929; rollup unions with hodenpyl'),
 'c1r3': ('Northeastern Super-Power Group',                          'northeastern-super',    None),
 'c1r4': ('United Gas and Electric Corp.',                           'united-gas-electric',   'not The United Corporation'),
 'c1r5': ('Insull Interests',                                        'insull',                None),
 'c2r1': ('Byllesby Group or Standard Gas and Electric Co.',         'standard-gas',          None),
 'c2r2': ('Doherty Group or Cities Service Co.',                     'cities-service',        None),
 'c2r3': ('Stone and Webster',                                       'stone-webster',         None),
 'c2r4': ('North American Co.',                                      'north-american',        None),
 'c2r5': ('Fitkin Group or General Engineering and Management Co.',  'fitkin',                None),
 'c3r1': ('Studebaker-McKinley Group or N. American Light and Power Co.', 'north-american-light', 'distinct from North American Co.'),
 'c3r2': ('American Water Works and Electric Co.',                   'american-water-works',  None),
 'c3r3': ('Hodenpyl-Hardy Group or Commonwealth Power Co.',          'hodenpyl',              'merged into C&S in 1929; rollup unions with southeastern'),
 'c3r4': ('J. G. White Group or Associated Gas and Electric Co.',    'age',                   None),
 'c3r5': ('Hulswit Group or United Light and Power Co.',             'united-light-power',    None),
 'c4r1': ('Federal Light & Traction Co.',                            'federal-light',         None),
 'c4r2': ('Albert Emanuel Group or National Electric Power Co.',     'national-electric',     None),
 'c4r3': ('Barstow Group or General Gas and Electric Corp.',         'general-gas-electric',  None),
 'c4r4': ('United Gas Improvement Co.',                              'ugi',                   None),
 'c4r5': ('Charles H. Tenney and Co.',                               'tenney',                None),
}

INSET = 8  # trim the engraved border box off each swatch

def swatch_rects():
    out = {}
    for cell in MAP3:
        c, r = cell[:2], cell[2:]
        x0, x1 = COLS[c]; y0, y1 = ROWS[r]
        out[cell] = (x0 + INSET, y0 + INSET, x1 - INSET, y1 - INSET)
    return out
