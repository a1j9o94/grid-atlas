# Blind Map III audit — AR, LA, KS, OK, TX

## Scope and isolation

This audit was made from the native `map3-1925.png` scan and the projected 2020
county mesh only. It did not use the primary batch transcription, the canonical
county trace, or outside corporate-footprint claims. The JSON has exactly one
machine label for each of the 575 modern county FIPS codes in the five states.

The audit is deliberately conservative. A county is not assigned a company key
unless the texture repeats coherently across a multi-county region. `unknown-served`
means the plate visibly carries fill but this pass could not identify the texture
without guessing. `maybe:key` is used on a fill boundary where the adjacent repeated
texture is identifiable. `amb:key|key` records a genuine texture-identification tie;
candidate keys are alphabetically sorted.

## Anonymous visual reads

Texture identity was first recorded with anonymous descriptions:

- A — near-solid black field
- B — continuous fine vertical rules
- C — open diamond lattice
- D — dark ground punctured by large white lozenges
- E — separated short diagonal strokes rising to the right
- F — broad continuous diagonal bands rising to the right
- G — broad continuous diagonal bands falling to the right

Only after the county reads were complete were those descriptions mapped to the
printed legend keys:

- A → `ebasco`
- B → `fitkin`
- C → `standard-gas`
- D → `insull`
- E → `national-electric`
- F → `stone-webster`
- G → unresolved between `cities-service` and `general-gas-electric`

The A/D distinction is the principal residual failure mode. Several map fills are
inked more heavily than their legend swatches, and small counties may contain less
than one complete white lozenge. Those reads remain `amb:ebasco|insull`.

## Boundary method

The plate was normalized against local paper white. For boundary triage, a 15-pixel
local ink field was sampled inside an eroded county mask. Counties with fill share at
or below 0.25 were called `none`; counties from 0.25 to 0.75 were treated as boundary
cases; counties at or above 0.75 were eligible for a texture label. These numerical
cuts did not choose a company texture. They only prevented state labels, county-line
ink, and a neighboring hatch from turning a visibly blank county into a served one.

## State observations

### Arkansas

- The fine vertical field is strongest along the north edge. Several fringe counties
  are left `unknown-served` where the plate boundary cuts through the modern mesh.
- The open diamond lattice is clearest in Crawford, Franklin, and Sebastian Counties.
- South-central Arkansas is heavily inked. Near-solid and white-lozenge fills are not
  reliably separable in every small county, so the doubtful cells retain the A/D tie.
- The Mississippi River edge is especially unstable in Cross, Woodruff, Monroe,
  St. Francis, Lee, and Phillips Counties because the fill edge and modern river
  geometry do not coincide cleanly.

### Louisiana

- The northern fields are fragmented by conspicuous unfilled holes; the scan supports
  service/blank decisions more strongly than exact texture decisions there.
- Broad rising diagonal bands are repeatable at Calcasieu and Pointe Coupee. The rest
  of the lower Mississippi corridor is not forced into that key.
- Ascension, Iberia, Lafayette, Acadia, Evangeline, Sabine, and Vernon read blank in
  their usable interiors.
- St. Bernard, Plaquemines, Lafourche, Terrebonne, and the parish-scale water polygons
  are boundary-sensitive. Their modern land/water geometry is a poor fit to the 1925
  engraved coastline, so uncertain coastal reads stay unresolved.

### Kansas

- Fine vertical rules occupy a repeated western/north-central pattern and a second
  southern block. Only counties containing a coherent repeat are keyed `fitkin`.
- The open diamond lattice is clearest in the northeast and along the eastern edge.
- Short rising diagonal strokes form a separate central-eastern field. Chase,
  Dickinson, Lyon, Morris, Greenwood, and Butler supply the repeat evidence; fringe
  counties use `maybe:national-electric` when the fill edge crosses the mesh.
- The transition around Riley, Geary, Wabaunsee, Osage, Franklin, and Coffey is a dense
  collision of fill edges and county boundaries and is intentionally conservative.

### Oklahoma

- The central open-diamond lattice is the most stable read in the batch. Blaine,
  Canadian, Logan, Oklahoma, Cleveland, Lincoln, Payne, Pottawatomie, and Okfuskee
  provide the clearest interiors.
- Dark lozenge fields are interleaved with the lattice. Custer, Washita, Kiowa, and
  Murray contain complete white-lozenge repeats and are keyed `insull`; neighboring
  single-period counties remain tied or unresolved.
- The panhandle and southwest are predominantly blank. State-label ink and adjacent
  Texas fill create false local ink in several fringe counties, which is why a 0.25
  blank cutoff was used.

### Texas

- Texas contains the largest number of pattern changes and the smallest number of
  safe single-county reads. This checkpoint therefore favors `unknown-served` over a
  guessed company key.
- A broad falling-diagonal field through Bell, Williamson, Travis, Hays, Comal, Bexar,
  Medina, and Guadalupe is visually coherent, but its line weight does not safely
  distinguish the two similar legend cells. Those counties retain
  `amb:cities-service|general-gas-electric` when clearly filled.
- Near-solid reads are keyed `ebasco` only at very high ink and fill shares. Darker
  western and southern lozenge regions are otherwise left unresolved rather than
  inferred from geography.
- The Gulf coast, Rio Grande, Trans-Pecos, and Panhandle fringe contain many partial
  modern counties. Coastal water geometry and the 1925/2020 boundary mismatch are the
  dominant issues, not texture alone.

## Counts

| State | Counties | Exact/none | Maybe/ambiguous/unknown |
|---|---:|---:|---:|
| AR | 75 | 49 | 26 |
| LA | 64 | 26 | 38 |
| KS | 105 | 72 | 33 |
| OK | 77 | 33 | 44 |
| TX | 254 | 90 | 164 |
| **Total** | **575** | **270** | **305** |

The high unresolved count is intentional: this is an adversarial checkpoint, not a
second agent manufacturing agreement with the primary trace.
