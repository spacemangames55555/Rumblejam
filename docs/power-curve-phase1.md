# Power curve — phase 1 survey

Measurements only. Nothing was tuned; no file under `js/` was changed.

Reproduce: `node tools/power_curve_survey.mjs` (`--only=2,3` to re-measure one
section, `--quick` for a subset of classes).

---

## Headline: the blocker does NOT fire, and two of the brief's premises are wrong

The brief's stop condition was "if output plateaus at 60, say so and stop."
**It does not plateau.** With a build that spends its points the way the design
describes, every one of the fourteen classes gains output monotonically from
level 20 to level 100. Nothing is dead.

But two stated premises turn out not to hold, and both change what phase 2
should do:

1. **"The rank change shipped as cooldown only."** It did not. 415 of 420
   skills declare `ranks.damage`, at 0.040–0.045 per rank, applied linearly as
   `base * (1 + rate * rank)`. Rank 1 → 10 measured at ×1.23 to ×3.05 output
   depending on class, median ≈ ×1.79. Rank already *is* a damage term, already
   linear, already primary.
2. **"Concentration wastes damage, spreading does not."** Measured, the
   tension does not exist: spread 10.9% waste, concentrated 10.5%. Overkill is
   flat regardless of how the points are distributed.

So the diagnosis has to move. Rank works; the choice between spreading and
concentrating does not; and the reason floor 4 "clears the same" is elsewhere.

### A harness warning, because it nearly produced the opposite answer

The first version of this survey reported a plateau at level 20–40 for most
classes. That was the harness. `learnableSkills()` returns everything a point
can be spent on **including already-learned nodes**, because ranking up is a
spend — so "take the deepest learnable" returned the same node forever. At 80
points it learned 10 nodes and put rank 71 on one of them. §13 rule 82: the
fixture made its subject unreachable and the flat line was the fixture's.

---

## 1. Where a run actually ends

| | |
|---|---|
| skill points per level | **1** (`grantSkillPoint`, one call per level-up) |
| XP to next level | `10 + 4 × level` |
| cumulative XP | L40 3,510 · L60 7,670 · L80 13,430 · L100 20,790 |
| measured XP across 8 regions | ~14,134 |
| **derived end level** | **~82, i.e. ~82 points** |

The design assumption of **level 80 is confirmed** to within the precision of
the extrapolation.

XP measured clearing one representative combat room per region, then multiplied
by path length (a region's tree offers 13 nodes across 5 depths; a player picks
one per depth, so ~5 fights + boss). Rooms in regions 3–6 and 8 did not clear
inside the 240 s cap, so those figures are floors.

**The 8 × rank-10 arithmetic does not close at 80 points.** Measured, spending
80 points breadth-first and then into the slotted eight gives ranks
`8,8,7,7,7,7,7,7`. Reaching `10,10,10,10,10,10,9,9` takes **100 points**,
because 30 of them go on learning the nodes at all. Either the target build is
level ~100, or it assumes a player leaves two thirds of the tree unlearned.

## 2. Output vs level — no plateau

DPS against an immortal ring, level = points spent, spread build.

| class | 20 | 40 | 60 | 80 | 100 | 60→80 | 20→100 |
|---|---|---|---|---|---|---|---|
| blacksmith | 48 | 123 | 145 | 163 | 192 | +12% | ×4.0 |
| wizard | 76 | 85 | 95 | 114 | 131 | +20% | ×1.7 |
| necromancer | 60 | 65 | 80 | 87 | 105 | +9% | ×1.8 |
| druid | 279 | 328 | 381 | 437 | 484 | +15% | ×1.7 |
| mage | 159 | 168 | 204 | 231 | 260 | +13% | ×1.6 |
| bard | 131 | 148 | 183 | 208 | 237 | +14% | ×1.8 |
| witch_doctor | 96 | 109 | 142 | 164 | 194 | +15% | ×2.0 |
| samurai | 60 | 70 | 76 | 95 | 102 | +25% | ×1.7 |
| monk | 59 | 84 | 93 | 104 | 115 | +12% | ×1.9 |
| assassin | 125 | 152 | 182 | 208 | 235 | +14% | ×1.9 |
| priest | 108 | 152 | 181 | 204 | 234 | +13% | ×2.2 |
| savage | 1265 | 1470 | 1750 | 2275 | 2729 | +30% | ×2.2 |
| hunter | 99 | 121 | 138 | 158 | 183 | +14% | ×1.5 |
| sundian | 158 | 190 | 216 | 254 | 288 | +18% | ×1.8 |

**0 of 14 classes stop by level 60. 0 of 14 stop by 70. All 14 are still
gaining at 100.**

The growth is real but slow: **about +14% between level 60 and 80**, roughly
0.7% per level. That is the actual finding behind symptom 1 — not that growth
stopped, but that 20 levels of investment buys a seventh more damage, which is
below what a player notices in a fight against enemies they were already
one-shotting.

*Savage's row is non-monotonic against immortal dummies (accumulating effects
compound on a body that never dies — `tree_dps` documents this). Treat its
absolute values as unreliable; its shape is not.*

## 3. What rank adds today

```
rankedDamage(base, skill, rank) = base * (1 + ranks.damage * rank)
rankCooldown(base, rank)        = base * 0.97^(rank-1), floored at 0.70
```

- **415 of 420 skills (99%) declare `ranks.damage`**, at 0.040 (×287) or
  0.045 (×128).
- Mean rate 0.0415 → rank 1→10 is ×1.36 damage.
- Cooldown over the same span: ×0.760, i.e. 24% faster.
- Combined, arithmetically: **×1.79 output**.

Measured, same build with ranks forced:

| class | r1 | r5 | r10 | r20 | r1→r10 |
|---|---|---|---|---|---|
| sundian | 216 | 373 | 659 | 1359 | ×3.05 |
| witch_doctor | 123 | 206 | 364 | 756 | ×2.96 |
| bard | 132 | 223 | 375 | 745 | ×2.85 |
| wizard | 42 | 65 | 88 | 186 | ×2.11 |
| blacksmith | 31 | 44 | 58 | 81 | ×1.89 |
| necromancer | 35 | 49 | 64 | 83 | ×1.82 |
| assassin | 149 | 198 | 267 | 373 | ×1.79 |
| savage | 231 | 253 | 409 | 391 | ×1.77 |
| hunter | 65 | 76 | 104 | 161 | ×1.59 |
| mage | 136 | 171 | 196 | 366 | ×1.45 |
| priest | 124 | 148 | 174 | 233 | ×1.40 |
| druid | 329 | 373 | 428 | 495 | ×1.30 |
| monk | 244 | 262 | 299 | 326 | ×1.23 |

**Rank is not the problem.** A whole build going rank 1 → rank 10 is a
×1.2–×3.0 change. The playtest comparison ("rank-1 vs rank-6") is ×1.4
arithmetically, and that would be visible against enemies that survive long
enough to show it.

*Samurai measures 0 at every rank — its kit triggers on movement and footing,
which this stationary fixture cannot stage. Excluded, not a real zero; the same
gap `tree_dps` names.*

## 4. Endgame enemies vs endgame throughput

| region | peak alive | total spawned | mean HP | hpMult | dmgMult |
|---|---|---|---|---|---|
| 1 | 12 | 39 | 56.2 | 1.00 | 1.00 |
| 2 | 33 | 79 | 171.2 | 2.13 | 1.59 |
| 3 | 73 | 275 | 46.1 | 3.84 | 2.26 |
| 4 | 84 | 187 | 109.0 | 4.33 | 2.44 |
| 5 | 93 | 377 | 55.3 | 5.29 | 2.75 |
| 6 | 101 | 432 | 62.5 | 6.02 | 2.98 |
| 7 | 49 | 266 | 70.1 | 7.35 | 3.36 |
| **8** | **133** | **333** | **68.8** | **7.36** | **3.36** |

Two things stand out and neither matches symptom 3:

- **Enemy count already rises steeply** — 12 alive in region 1 to 133 in
  region 8, 39 spawned to 333. "Not enough enemies late" is not what the spawn
  budget does.
- **Mean HP does not follow the world axis.** Region 2 fields the toughest
  bodies in the game at 171 HP; region 8, at ×7.36 the multiplier, fields 68.8.
  The axis is applied per-body, so a region whose roster is mostly chaff comes
  out *softer* than one with heavy units, no matter what the multiplier says.
  That is why region 8 does not feel like an escalation.

Against an 8-slot level-80 build, per class, in region 8:

| class | dps | kills/s | time to clear 333 |
|---|---|---|---|
| druid | 448 | 6.51 | 51 s |
| sundian | 269 | 3.92 | 85 s |
| mage | 231 | 3.36 | 99 s |
| assassin | 225 | 3.28 | 102 s |
| bard | 208 | 3.03 | 110 s |
| priest | 201 | 2.92 | 114 s |
| blacksmith | 163 | 2.38 | 140 s |
| witch_doctor | 164 | 2.38 | 140 s |
| hunter | 152 | 2.22 | 150 s |
| monk | 106 | 1.54 | 216 s |
| wizard | 114 | 1.65 | 201 s |
| samurai | 95 | 1.38 | 241 s |
| necromancer | 87 | 1.26 | 264 s |

**A single rank-10 projectile would need to deal ~69 to one-shot region 8's
mean body.** The design condition ("endgame enemy HP at or just below one
rank-10 projectile's damage") is a target for phase 2 to hit; it is a statement
about a number that does not exist yet.

## 5. Sustain vs incoming

12 sustain items. **Every one is flat** — none scales with max HP:

| item | rarity | effect |
|---|---|---|
| cavemoss_poultice | common | `regen 1 HP/s` |
| deepmoss_compress | uncommon | `regen 2 HP/s` |
| saints_reliquary | legendary | `regen 1 HP/s` |
| grave_snack | common | `killHeal 1` |
| butchers_bill | uncommon | `killHeal 2` |
| scab_stitched_charm | rare | `killHeal 2` |
| leech_locket | common | `lifesteal 2%` |
| bloodgroove_blade | uncommon | `lifesteal 4%` |
| bandolier_of_salves | uncommon | `roomClearHeal 10` |
| sugarrock_shard | uncommon | `materialHeal 15% × 1` |
| crit_salve | uncommon | `critHeal 2` |
| second_wind_whistle | legendary | `secondWind 50%` |

Incoming DPS, character that does not fight back, per region:

| region | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| incoming/s | 7.5 | 36.7 | 16.6 | 26.3 | 31.9 | 34.1 | 28.1 | **28.6** |

**Incoming does not rise across the run.** Region 2 is the most dangerous room
in the game at 36.7 HP/sec; region 8 is 28.6. That is the same per-body
application as the HP finding above, and it is the root of symptoms 2 and 3
together — the world axis raises *per-enemy* numbers, and the rosters that
carry the highest multipliers are the ones made of the lightest bodies.

**The crossover:**

```
regen        4.0 HP/sec   (flat, scales with nothing)
per-kill    19.5 HP/sec   (5 HP/kill × 3.90 kills/sec measured in a region-8 room)
total       23.5 HP/sec   vs 28.6 incoming   ->  ratio 0.82x
```

Sustain sits at **82% of incoming** in this fixture, i.e. just under. It goes
over in play for two reasons this measurement deliberately does not model: a
character that fights back takes less than a passive one because it removes the
bodies hitting it, and lifesteal, crit-heal and room-clear healing are all on
top of the two terms above. **Per-kill healing is the dominant term at 83% of
the total**, and it scales with the kill rate — the exact axis phase 2 proposes
to raise.

*Vitality reads 150 at level 80 because a harness never spends banked stat
picks. A played character carries more, so "2 HP/s as a share of max" is an
upper bound on what a flat trickle is worth.*

## 6. Overkill waste — the tension does not exist

| build | mean waste |
|---|---|
| spread (points across the slotted 8) | **10.9%** |
| concentrated (all spare points into one skill, rank 51) | **10.5%** |
| delta | **−0.4 points** |

Per class, spread → concentrated: blacksmith 7.3→9.4, wizard 6.2→5.4,
necromancer 6.9→8.9, druid 14.8→16.4, mage 9.9→9.8, bard 5.6→3.6,
witch_doctor 3.2→8.6, samurai 13.1→14.4, monk 10.9→13.0, assassin 7.0→9.9,
priest 9.0→13.9, savage 41.2→19.9, hunter 6.1→4.0, sundian 11.7→10.4.

**Concentrating costs no more waste than spreading.** The design tension the
brief wants to preserve is not currently present in any measurable form, and it
cannot be preserved — it would have to be *created*. The reason is visible in
section 4: at 68.8 mean HP against builds landing hundreds of DPS in small
packets, nearly everything is already a clean kill regardless of how the points
were spent.

---

## What phase 2 should be specced against

**Not blocked.** Output grows to 100; the stop condition does not fire.

**The four symptoms resolve to two causes, and neither is the one in the brief.**

1. **Growth is too slow, not absent.** +14% from level 60 to 80. Rank is
   already a linear damage term at ~4%/rank; making it "primary" is not the
   change, *steepening* it is. The lever is the rate, not the mechanism.
2. **The world axis raises per-body numbers, and region 8's roster is light.**
   Region 8 has the highest multiplier in the game and fields softer bodies
   and less incoming damage than region 2. Until that is addressed, no amount
   of player growth will be felt late, because lateness is not currently
   harder. This is the single highest-value finding here and it was not one of
   the four symptoms.

**Consequences for the phase-2 shapes as written:**

- *"Rank adds damage linearly as the primary term"* — already true. Restate as
  a rate change, and note the whole-build effect is already ×1.2–×3.0 from rank
  1 to 10.
- *"Enemy count at region 8 rises"* — count already rises 12 → 133 alive. The
  axis that has not risen is per-body threat. Raising count further without
  fixing that makes region 8 more chaff, which is what it already is.
- *"Sustain converts flat to proportional"* — supported, and the per-kill cap
  matters more than the conversion: per-kill is 83% of available sustain and
  rides the kill rate directly.
- *"Concentration vs spreading"* — this tension has to be built, not preserved.
  It requires enemy HP near a single rank-10 projectile's damage, which is a
  number phase 2 would be choosing rather than protecting.

**Two fixture gaps to close before phase 2 tunes anything:** samurai cannot be
measured by a stationary fixture (movement/footing triggers), and savage cannot
be measured against immortal dummies (accumulating effects compound without
limit). Both are known to `tree_dps`; both would silently distort a tuning pass.
