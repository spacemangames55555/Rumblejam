# Silhouette vocabulary — proposal

**Not applied.** `docs/silhouettes.json` is unchanged. Pick a vocabulary and the
rewrite follows from it.

## Why the current notes will not survive

The 64 notes in `silhouettes.json` are written in the register of **pose and
carried objects** — "one leg held raised in a stance", "a recurve bow carried
horizontally across the back", "arms held wide and low". At 32×32, with roughly
20×26 usable pixels of figure, none of that is resolvable. All four anchor
candidates ignored the pose clause entirely and converged on a generic
horned-warrior shape.

What actually survives at 36 css px on a dark floor is three things:

1. **Mass** — the overall block the figure occupies.
2. **Head / crown shape** — the single most identifiable feature, because it
   sits against empty background on three sides.
3. **One accent colour** — but accent alone cannot separate 46 characters, and
   it separates none of them for a colourblind player.

So the proposal is a **combination code**: mass × head, with accent as a third
axis that is deliberately reused. Two characters may share an accent as long as
they differ in mass or head; two may share a head as long as they differ in
mass. The table below is sorted so collisions are visible.

---

## Axis 1 — mass (4 classes)

| code | name | footprint | reads as |
|---|---|---|---|
| **W** | Wide | broad shoulders, short legs, fills the cell horizontally | tanks, brutes, anything that should feel immovable |
| **T** | Tall | narrow, upright, head near the top of the cell | snipers, casters, poles and staves |
| **C** | Compact | small and centred, clear gap on all sides | rogues, speedsters, anything nimble |
| **F** | Floating | no legs; a gap between the figure and the cell bottom | spirits, drones, anything airborne |

Four is the practical ceiling. A fifth class would not be distinguishable from
its neighbours at this size.

## Axis 2 — head / crown archetype (6 shapes)

| code | name | shape |
|---|---|---|
| **h** | helm | smooth rounded dome, no protrusion — *the anchor's own* |
| **o** | horned | two symmetric points rising from the sides |
| **d** | hooded | a soft peak that merges into the shoulders, no neck |
| **c** | crowned | a flat wide slab sitting above the head |
| **a** | antenna | one asymmetric spike, rod or plume, off-centre |
| **b** | bare | visible hair or skull, narrower than the shoulders |

Six shapes × four masses = 24 unique combinations before accent is considered.
With accent as a third axis at 6 usable hues, the space is 144 — comfortably
more than the 64 units.

## Axis 3 — accent hue (6, freely reused)

`gold` · `crimson` · `cyan` · `violet` · `green` · `white`

Deliberately few, deliberately reused. The accent is the *last* discriminator,
never the only one — the mass+head pair must already be unique or near-unique
within a group a player sees together.

---

## Draft assignment — the 47 characters

Sorted by mass then head, so a collision is two adjacent rows with the same
`code`.

| code | accent | id | current note (to be replaced) |
|---|---|---|---|
| **W·h** | crimson | `toh_savage` | top-heavy, huge shoulders over short bent legs |
| **W·h** | white | `rampart` | squat and rectangular, layered plates |
| **W·o** | gold | `bulwark` | slab-wide, tower shield fused to the forearm |
| **W·o** | cyan | `toh_blacksmith` | slab-wide, crystal spurs from both shoulders |
| **W·d** | green | `redmaw` | hunched forward, oversized jaw past the chest |
| **W·c** | gold | `gilded_one` | draped robe under a broad flat crown |
| **W·c** | violet | `toh_priest` | squared mantle and a tall standing collar |
| **W·a** | crimson | `powderkeg` | barrel-bodied, stubby limbs |
| **W·b** | white | `lodestone` | a heavy orb floating at the shoulder |
| **T·h** | cyan | `stillness` | braced, one long barrel on a bipod |
| **T·h** | gold | `longshot` | tallest of the roster, rifle longer than the body |
| **T·o** | violet | `toh_wizard` | tall pointed hood, no visible feet |
| **T·o** | green | `toh_druid` | antlered, leaf mantle |
| **T·d** | crimson | `duskblade` | hooded, cloak cut short, dagger reversed |
| **T·d** | white | `toh_monk` | bare-armed, sashed, one leg raised |
| **T·c** | gold | `tollkeeper` | stooped, oversized coin scale |
| **T·c** | cyan | `broker` | top-heavy, strongbox as a backpack |
| **T·a** | violet | `banneret` | tall banner pole above the head |
| **T·a** | green | `toh_hunter` | recurve bow across the back |
| **T·a** | crimson | `cindermage` | shoulders trailing smoke plumes |
| **T·b** | white | `hemomancer` | gaunt, ribcage-thin, trailing sleeves |
| **T·b** | cyan | `threader` | needle-narrow, thinnest in the cast |
| **C·h** | crimson | **`pulsar`** | **the anchor — compact, smooth helm, ring at the sternum** |
| **C·h** | cyan | `voltaic` | rod antennae from both shoulders |
| **C·o** | gold | `jester` | three-pointed cap with bells |
| **C·o** | green | `toh_sundian` | branching coral fins from the forearms |
| **C·d** | violet | `mirage` | doubled outline, ghost offset behind |
| **C·d** | crimson | `toh_assassin` | long forked scarf streaming behind |
| **C·c** | white | `facet` | head replaced by a faceted crystal |
| **C·c** | gold | `quartermaster` | six weapon hafts fanned across the back |
| **C·a** | cyan | `zephyr` | streamlined, twin ribbons from the heels |
| **C·a** | crimson | `onrush` | leaning forward forty-five degrees |
| **C·a** | green | `toh_bard` | wide flat drum across the chest |
| **C·a** | violet | `toh_mage` | dark sphere orbiting one hand |
| **C·b** | gold | `vesper` | wide flower-petal collar |
| **C·b** | green | `sawbones` | apron flaring to a wide hem |
| **C·b** | crimson | `toh_samurai` | flared shoulder plates, conical hat |
| **C·b** | white | `glasswing` | four narrow blade-wings held high |
| **F·h** | cyan | `twinsoul` | small mirrored double at the hip |
| **F·h** | violet | `toh_necromancer` | four bone mounts arced overhead |
| **F·o** | crimson | `toh_witch_doctor` | feathered mask twice the head's width |
| **F·d** | white | `wisp` | barely there, thin drifting flame, no legs |
| **F·c** | gold | `cogsmith` | four folded turret mounts as backpack arms |
| **F·c** | cyan | `tinker` | tool rack doubling the waist width |
| **F·a** | green | `hivewright` | hexagonal hive cell on the back |
| **F·a** | violet | `resonant` | flat ring level with the waist |
| **F·b** | white | `frostcaller` | ice shards along the spine |

**47 characters, 47 rows. No two share a `code` + accent.** The tightest group is
`C·a` (four characters) and `C·b` (four) — each separated by accent, which is
the intended fallback, not the primary read.

## The 13 enemies and 4 bosses

Enemies read against each other in swarms, so mass does most of the work and
head archetypes are secondary.

| code | accent | id |
|---|---|---|
| **C·b** | crimson | `skulker` |
| **C·a** | gold | `flit` |
| **W·h** | crimson | `slabjaw` |
| **W·b** | violet | `lobber` |
| **F·a** | violet | `gyre` |
| **C·h** | green | `gemmite` |
| **C·o** | gold | `fusehead` |
| **W·c** | cyan | `aegimand` |
| **T·b** | white | `stitcher` |
| **W·o** | gold | `wombden` |
| **T·a** | cyan | `lancerfish` |
| **T·h** | crimson | `deadeye` |
| **T·c** | violet | `ward_pylon` |

Bosses are 64×64 and drawn at ~92 css px, so they have four times the pixel
budget and do not need this discipline — silhouette notes for the four can stay
descriptive.

---

## What changes if you accept

1. `docs/silhouettes.json` gets rewritten from this table: each note becomes
   `<mass phrase>, <head phrase>, <accent> accent` rather than a pose.
2. `tools/gen_prompts.mjs` gains a uniqueness check on **(mass, head, accent)**
   rather than on the raw string, so a genuine collision fails the build instead
   of two differently-worded notes that draw the same thing.
3. Batch 1 generates against a vocabulary the model can actually act on at
   32×32.

## Open questions for you

- **Four mass classes or three?** Dropping `Floating` and folding those units
  into `Compact` would simplify, at the cost of the clearest read in the set —
  a gap under the figure is very legible at this size.
- **Is `bare` too weak?** It is defined by the absence of a head feature, which
  is a weaker signal than the other five. It may need to become "long hair" or
  similar to be positively identifiable.
- **Accent count.** Six hues is already tight for colourblind separation.
  Restricting to four high-contrast ones (gold, cyan, crimson, white) would be
  safer but forces more mass/head pressure.
