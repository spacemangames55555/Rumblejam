# SOURCE CONVERSIONS — ARCHIVE

These are the class conversion documents **as written**, before any roster
ruling was applied to them. They are kept verbatim.

## This is not the live document set

For every class here there is a counterpart in `docs/design/classes/`, and the
counterpart is the one the project works from. It is the same document carried
forward: same structure, same 30-node layout, same authored fields — plus a
`## ROSTER RULING APPLIED` block at the top recording what was decided, and the
edits those decisions required.

| | `docs/design/toh/` | `docs/design/classes/` |
|---|---|---|
| what it is | the conversion as authored | the conversion after rulings |
| read by a gate | no | yes — `class_doc_gate`, `statname_gate` |
| read by the code | no | numbers are read out of it by `sim_test` |
| edited going forward | no | yes |

The five files here were re-supplied after the `classes/` set already existed.
Comparing them shows the `classes/` versions are the later ones — they carry
ruling blocks these do not, and the diffs run one way: pace values rebucketed,
rider durations cut to ~70% of their skill's cooldown, tree names resolved
against the built trees.

Concretely, per file:

- **priest** — trees renamed Light→Reckoning and Rebuke→Judgment; Grace held.
- **druid** — tree names held (the built names are crossed against their own
  contents; filed as KNOWN-DEFECTS #20). Pace and rider passes applied.
- **blacksmith** — tree names held. Pace and rider passes applied.
- **bard** — tree names held; the built pair Cadence/Requiem carried no role
  signal strong enough to decide the mapping. Pace and rider passes applied.
- **samurai** — the largest divergence. The archived version documents 30 nodes
  and a `Resolve` engine; the live version documents 26, supersedes that engine
  with the built one, dissolves the Stances tree, and logs the missing Bow tree
  as a real gap.

## Why keep them

A ruling is only auditable against what it ruled on. These files are the
"before" the `classes/` set is the "after" of; without them the ruling blocks
describe edits to a document nobody can read.

## Rules for this directory

1. **Do not edit these files.** Corrections go to the `classes/` counterpart.
   Editing an archive to match a later decision deletes the thing it records.
2. **They predate the stat rename** and spell retired stat names throughout.
   `statname_gate` files this directory as a frozen archive for exactly that
   reason; the entry names the directory, so files added here are covered
   without a new exemption per file.
3. **They are not authoritative.** Where an archived file and its `classes/`
   counterpart disagree, the `classes/` file is the project's document, and the
   built engine outranks both on structural matters.

## Open

Whether these five supersede their `classes/` counterparts is **Casey's call and
has not been made.** This README records the observed relationship — later
revision in `classes/`, source here — not a ruling. If the intent was to replace
the live set rather than archive the source, say so and the direction reverses.
