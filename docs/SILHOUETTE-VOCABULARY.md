# Silhouette vocabulary — proposal (revision 2)

**Not applied.** `docs/silhouettes.json` is unchanged. Pick a vocabulary and the
rewrite follows from it.

Revision 2 applies two decisions: the `bare` head class is cut and replaced with
a positive feature, and accents drop from six to four chosen for deuteranopic
separability.

## Why the current notes will not survive

The 64 notes in `silhouettes.json` are written in the register of **pose and
carried objects** — "one leg held raised in a stance", "a recurve bow carried
horizontally across the back", "arms held wide and low". At 32×32, with roughly
20×26 usable pixels of figure, none of that is resolvable. All four anchor
candidates ignored the pose clause entirely and converged on a generic
horned-warrior shape. See
[`art-review/batch0/01-four-candidates.png`](art-review/batch0/01-four-candidates.png).

What survives at 36 css px on a dark floor is **mass**, **head shape**, and
**one accent colour** — in that order of reliability.

## Axis 1 — mass (4 classes)

| code | name | footprint | reads as |
|---|---|---|---|
| **W** | Wide | broad shoulders, short legs, fills the cell horizontally | tanks, brutes, anything immovable |
| **T** | Tall | narrow, upright, head near the top of the cell | snipers, casters, poles and staves |
| **C** | Compact | small and centred, clear gap on all sides | rogues, speedsters, anything nimble |
| **F** | Floating | no legs; a visible gap between figure and cell bottom | spirits, drones, anything airborne |

## Axis 2 — head archetype (6 shapes)

Every one is a **positive** feature. `bare` is gone: a class defined by the
absence of a feature reads as a broken or half-drawn sprite at 36 px, not as an
identity.

| code | name | shape |
|---|---|---|
| **h** | helm | smooth rounded dome, no protrusion — *the anchor's own* |
| **o** | horned | two symmetric points rising from the sides |
| **d** | hooded | a soft peak merging into the shoulders, no neck |
| **c** | crowned | a flat wide slab sitting above the head |
| **a** | antenna | one asymmetric spike, rod or plume, off-centre |
| **m** | maned | a soft mass — hair, fur, feathers — visibly **wider than the shoulders** |

`maned` replaces `bare`. It occupies the same design space (a head that is not
armoured) but is identified by what is there rather than what is missing, and
its silhouette signature — head wider than shoulders — is the single most
legible head cue at this size.

## Axis 3 — accent hue (4)

| accent | approximate | why |
|---|---|---|
| **blue** | `#5ea8ff` | anchors the cool end; safe against amber for every common CVD type |
| **amber** | `#ffab4f` | the warm counterpart; the classic blue/amber pair survives deuteranopia and protanopia |
| **magenta** | `#ff7ad9` | sits off the red-green confusion axis entirely, so it stays separable from both blue and amber |
| **white** | `#e8e9f2` | value-based rather than hue-based, so it works with **no** colour vision at all |

Six hues could not be made deuteranopia-safe — green and amber collapse
together, and cyan and blue are marginal. These four are separable by hue *and*
by value.

**4 mass × 6 heads × 4 accents = 96 slots for 60 units.** Nothing is lost by the
reduction; the assignment below uses 23 of the 24 mass·head codes and loads each
accent exactly 15 times.

## Verified assignment — all 60 units

Grouped by `mass·head`, so a collision would appear as two rows sharing both the
code **and** the accent. There are none: this table is generated from a checked
data structure, and the check is `60 units, 60 unique ids, no (mass, head,
accent) repeated`.

The largest groups sharing a mass·head are `T·h`, `C·h` and `C·o` at four each —
and within each of those, all four accents differ, which is the intended
fallback.

| code | accent | id | kind |
|---|---|---|---|
| **W·h** | blue | `bulwark` | char |
| **W·h** | white | `rampart` | char |
| **W·h** | magenta | `slabjaw` | enemy |
| | | | |
| **W·o** | magenta | `toh_blacksmith` | char |
| **W·o** | amber | `redmaw` | char |
| **W·o** | blue | `wombden` | enemy |
| | | | |
| **W·m** | amber | `toh_savage` | char |
| **W·m** | white | `sawbones` | char |
| | | | |
| **W·c** | amber | `gilded_one` | char |
| **W·c** | white | `toh_priest` | char |
| **W·c** | blue | `aegimand` | enemy |
| | | | |
| **W·a** | amber | `powderkeg` | char |
| **W·a** | blue | `lobber` | enemy |
| | | | |
| **W·d** | white | `lodestone` | char |
| **W·d** | amber | `tollkeeper` | char |
| | | | |
| **T·h** | blue | `stillness` | char |
| **T·h** | amber | `longshot` | char |
| **T·h** | white | `threader` | char |
| **T·h** | magenta | `deadeye` | enemy |
| | | | |
| **T·o** | amber | `toh_druid` | char |
| **T·o** | white | `toh_monk` | char |
| | | | |
| **T·d** | magenta | `toh_wizard` | char |
| **T·d** | blue | `duskblade` | char |
| | | | |
| **T·a** | amber | `toh_hunter` | char |
| **T·a** | magenta | `banneret` | char |
| **T·a** | white | `lancerfish` | enemy |
| | | | |
| **T·m** | amber | `cindermage` | char |
| **T·m** | magenta | `hemomancer` | char |
| **T·m** | white | `stitcher` | enemy |
| | | | |
| **T·c** | blue | `broker` | char |
| **T·c** | amber | `quartermaster` | char |
| **T·c** | magenta | `ward_pylon` | enemy |
| | | | |
| **C·h** | amber | `pulsar` | char |
| **C·h** | blue | `voltaic` | char |
| **C·h** | white | `glasswing` | char |
| **C·h** | magenta | `flit` | enemy |
| | | | |
| **C·o** | amber | `jester` | char |
| **C·o** | blue | `toh_sundian` | char |
| **C·o** | white | `frostcaller` | char |
| **C·o** | magenta | `fusehead` | enemy |
| | | | |
| **C·d** | magenta | `mirage` | char |
| **C·d** | blue | `toh_assassin` | char |
| | | | |
| **C·a** | blue | `zephyr` | char |
| **C·a** | magenta | `onrush` | char |
| **C·a** | amber | `toh_bard` | char |
| **C·a** | white | `toh_mage` | char |
| | | | |
| **C·c** | white | `facet` | char |
| **C·c** | blue | `gemmite` | enemy |
| | | | |
| **C·m** | magenta | `toh_samurai` | char |
| **C·m** | white | `vesper` | char |
| **C·m** | blue | `skulker` | enemy |
| | | | |
| **F·h** | blue | `twinsoul` | char |
| **F·h** | white | `resonant` | char |
| | | | |
| **F·o** | magenta | `toh_witch_doctor` | char |
| | | | |
| **F·c** | magenta | `toh_necromancer` | char |
| **F·c** | amber | `cogsmith` | char |
| | | | |
| **F·a** | blue | `tinker` | char |
| **F·a** | amber | `hivewright` | char |
| **F·a** | magenta | `gyre` | enemy |
| | | | |
| **F·d** | white | `wisp` | char |

## What changes if you accept

1. `docs/silhouettes.json` is rewritten from this table: each note becomes
   `<mass phrase>, <head phrase>, <accent> accent` rather than a pose.
2. `tools/gen_prompts.mjs` gains a uniqueness check on the **(mass, head,
   accent)** triple rather than on the raw note string, so a genuine collision
   fails the build instead of two differently-worded notes that draw the same
   thing.
3. Batch 1 generates against a vocabulary the model can act on at 32×32.

## Remaining open question

**Four mass classes or three?** Dropping `Floating` and folding those ten units
into `Compact` would simplify, at the cost of the clearest read in the set — a
gap under the figure is very legible at this size. Kept at four in this
revision; say the word if you would rather it were three.
