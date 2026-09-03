# SOURCE CONVERSIONS — ARCHIVE

Fourteen class conversion documents plus the roster ruling they were revised
against. Kept verbatim as supplied.

## This is not the live document set

Every file here has a counterpart in `docs/design/classes/`, and the counterpart
is the one the project works from.

| | `docs/design/toh/` | `docs/design/classes/` |
|---|---|---|
| what it is | the conversions as supplied | the conversions the project works from |
| read by a gate | no | yes — `class_doc_gate`, `statname_gate` |
| read by the code | no | numbers are read out of it by `sim_test` |
| edited going forward | no | yes |

## Which version is later, per file

**Thirteen of the fourteen are earlier.** Their `classes/` counterparts carry a
`## ROSTER RULING APPLIED` block these do not, and the diffs run one way: pace
values rebucketed to the fixed table, rider durations cut to ~70% of their
skill's cooldown, tree names resolved against the built trees.

**`roster-ruling-pace-damage-engines.md` is also earlier** — 96 lines here
against 236 in `classes/`. The longer version is not an expansion; it *corrects*
this one. This version computes a slotted build's firing rate as `8 / mean_cd`
and gets 0.51/sec. The `classes/` version replaces that with `sum(1/cd)`, gets
2.62/sec, and notes that the corrected formula reproduces the game's measured
4.1/sec while the old one does not. Working from the copy in this directory
would reinstate an arithmetic error the project has already found and fixed.

**`necromancer.md` is the exception, and it is not simply later or earlier.**
It and its `classes/` counterpart are two branches off a common ancestor, and
neither contains the other:

| | `toh/necromancer.md` | `classes/necromancer.md` |
|---|---|---|
| pace values | original (9000ms, 45000ms, 60000ms…) | rebucketed (600/1200/2000/4000ms, capstones) |
| `PRIMITIVE:` field | on all 30 nodes | absent |
| `NEEDS aura` / `NEEDS channel` / `NEEDS gravity_pull` | flagged, with an OPEN ITEMS list | absent |
| Dark Matter summon (tier_code 4) | cut per ruling — 30 skills | present — 31 skills |
| Stake | ranged, 360px projectile ("on Casey's ruling") | melee, 84px on breach |
| branch pair exclusivity | dropped; costs two of four passive slots | exclusive |
| roster ruling block | absent | present |

So this file carries a primitive-classification pass and two rulings the live
document has never received, while the live document carries a pace pass this
one has never received. **Merging them is a decision, not a copy**, and it has
not been made.

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
   built engine outranks both on structural matters. The Necromancer is the one
   place where that rule loses information, which is why it is called out above
   rather than left to be discovered.

## Open

Which set is authoritative is **Casey's call and has not been made.** This
README records the observed relationship, not a ruling. Two things need
deciding rather than assuming:

- whether the `classes/` set stands as the live one (the README assumes it does
  because the gates and `sim_test` already read it);
- what happens to the Necromancer, where taking either side whole discards work
  that only exists on the other.
