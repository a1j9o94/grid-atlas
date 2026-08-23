# Holdings trace schema

The trace records what is visibly printed on one FTC county plate. It does not record a later corporate rollup.

Map III and Map IV use separate files and separate allowed-key lists.

## County values

| value | meaning |
|---|---|
| `none` | No principal-group county fill is visible. This does not mean that no electric service existed. |
| `<raw-key>` | One printed legend pattern is readable. |
| `amb:<key-a>|<key-b>` | Fill is visible, but the pattern cannot be distinguished between the sorted raw keys. |
| `maybe:<key>` | The named pattern may be present, but served versus blank is not readable. |
| `unknown-served` | Fill is visible, but its pattern cannot be read. |
| `partial:<key>` | Only part of the county is visibly filled by the named raw pattern. Reserved for the next trace pass. |
| `split:<key-a>|<key-b>` | Two raw patterns are visibly present inside the county. Reserved for the next trace pass. |

Candidate keys are unique and sorted. `none` never appears inside `amb:`. Pattern ambiguity and served-status ambiguity are different observations.

## Raw keys and story rollups

Raw keys reproduce the printed legend. They do not change when a company later merged or entered another system.

Dated story rollups live in the generated artifact. Each edge carries an effective date, a source, and a certainty status.

Map III preserves these predecessors:

- `southeastern`
- `hodenpyl`
- `fitkin`
- `general-gas-electric`

The existing general-gas-electric to Associated Gas and Electric relationship is inferred. It cannot be emitted as certain without a source.

## Plate status

A trace file declares one of:

- `not-built`
- `in-progress`
- `complete`

Checkpoint validation permits wholly unstarted states. A started state must be county-complete. Release validation requires all 3,108 pinned lower-48 and District of Columbia county equivalents exactly once.

An empty map is never interpreted as every county being blank.
