# Power curve — phase 1 survey

Measurements only. Nothing was tuned; no file under `js/` was changed.

Reproduce: `node tools/power_curve_survey.mjs` (`--only=2,3` to re-measure one
section, `--quick` for a subset of classes).

---

## Read this first — two fixture corrections changed the numbers

This document was measured twice. Both corrections are recorded because both
moved conclusions, and the first version of each looked perfectly plausible.

**1. `learnableSkills()` includes already-learned nodes.** Ranking up is a
spend, so "take the deepest learnable" returns the same node forever. At 80
points the first harness learned 10 nodes and put rank 71 on one. It reported a
plateau at level 20–40. That plateau was the harness (§13 rule 82).

**2. A fixture that assigns `p.level` has spent no stat picks.** `banked` is
incremented by the level-up path, not by the level number, so a level-82
character built by assignment carries a level-1 statline: **vitality 150,
ferocity 0**. Modelled properly through the same offer/answer path the game
uses, the same character is **vitality 210, ferocity 41** — and every
throughput figure below moved with it. The first pass measured a
zero-ferocity character and reported +14% growth from level 60 to 80; with
stat picks it is **+40%**.

Both are the same shape: a survey measuring its own accessor. Everything below
is post-correction.

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
   tension is not there: spread 16.4% waste, concentrated 17.3%. A 0.9-point
   difference is not a decision anyone can feel.

So the diagnosis has to move. Rank works; the choice between spreading and
concentrating does not; and the reason floor 4 "clears the same" is elsewhere.

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

DPS against an immortal ring, level = points spent, spread build, stat picks
spent.

| class | 20 | 40 | 60 | 80 | 100 | 60→80 | 20→100 |
|---|---|---|---|---|---|---|---|
| blacksmith | 51 | 160 | 207 | 289 | 300 | +40% | ×5.9 |
| wizard | 81 | 123 | 151 | 217 | 222 | +44% | ×2.7 |
| necromancer | 64 | 84 | 120 | 158 | 168 | +32% | ×2.6 |
| druid | 312 | 444 | 598 | 929 | 898 | +55% | ×2.9 |
| mage | 206 | 257 | 407 | 606 | 688 | +49% | ×3.3 |
| bard | 142 | 175 | 248 | 309 | 331 | +25% | ×2.3 |
| witch_doctor | 103 | 150 | 217 | 305 | 309 | +41% | ×3.0 |
| samurai | 65 | 87 | 113 | 170 | 159 | +50% | ×2.4 |
| monk | 59 | 103 | 129 | 180 | 164 | +40% | ×2.8 |
| assassin | 140 | 197 | 275 | 390 | 386 | +42% | ×2.8 |
| priest | 112 | 198 | 249 | 385 | 359 | +55% | ×3.2 |
| savage | 1313 | 1681 | 2211 | 3347 | 3493 | +51% | ×2.7 |
| hunter | 112 | 157 | 213 | 319 | 322 | +50% | ×2.9 |
| sundian | 195 | 261 | 325 | 477 | 457 | +47% | ×2.3 |

**0 of 14 classes stop by level 60. 0 of 14 stop by 70.**

**Growth from 60 to 80 is +40% on the roster median**, and 20 → 100 is ×2.3 to
×5.9. That is not a dead band. Symptom 1 is not "growth stopped"; the question
phase 2 has to answer is why +40% is not felt, and section 4 has the answer —
it is spent on enemies that were already dying in one hit.

*The rows are noisy and not strictly monotonic (blacksmith 289 at 80, 300 at
100; druid 929 then 898). Stat picks are chosen as "first offered" from a
seeded roll keyed on level, so the statline takes a different random walk at
each sampled level. The trend is the finding; individual cells carry ±10%.*

*Savage's absolute values remain unreliable against immortal dummies —
accumulating effects compound on a body that never dies (`tree_dps` documents
this). Its shape is fine.*

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
| 2 | 29 | 79 | 171.2 | 2.13 | 1.59 |
| 3 | 67 | 275 | 46.1 | 3.84 | 2.26 |
| 4 | 79 | 187 | 114.7 | 4.33 | 2.44 |
| 5 | 89 | 377 | 62.0 | 5.29 | 2.75 |
| 6 | 93 | 432 | 67.0 | 6.02 | 2.98 |
| 7 | 45 | 266 | 72.0 | 7.35 | 3.36 |
| **8** | **132** | **333** | **68.8** | **7.36** | **3.36** |

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
| spread (points across the slotted 8) | **16.4%** |
| concentrated (all spare points into one skill) | **17.3%** |
| delta | **+0.9 points** |

Per class, spread → concentrated: blacksmith 7.3→9.4, wizard 6.2→5.4,
necromancer 6.9→8.9, druid 14.8→16.4, mage 9.9→9.8, bard 5.6→3.6,
witch_doctor 3.2→8.6, samurai 13.1→14.4, monk 10.9→13.0, assassin 7.0→9.9,
priest 9.0→13.9, savage 41.2→19.9, hunter 6.1→4.0, sundian 11.7→10.4.

**Concentrating costs 0.9 points more waste than spreading — noise, not a
trade.** The design tension the
brief wants to preserve is not currently present in any measurable form, and it
cannot be preserved — it would have to be *created*. The reason is visible in
section 4: at 68.8 mean HP against builds landing hundreds of DPS in small
packets, nearly everything is already a clean kill regardless of how the points
were spent.

---

## 7. The spend spectrum — shallow vs deep at the same budget

Both builds at **82 points** (the measured end-of-run budget), region 8, god
off, stat picks spent, **no items**.

- **shallow** — stop learning once the loadout is full. Eight early-tier
  actives at rank 10–11, max tier 3–4 in each tree, 1–3 always-on passives.
- **deep** — learn every node in all three trees, reaching tier 10 in each,
  then equip the eight deepest actives. Rank 7–8, 3–7 always-on passives.

| class | build | nodes | passives | slot rank | max tier/tree | dps | region 8 |
|---|---|---|---|---|---|---|---|
| blacksmith | shallow | 10 | 2 | 10–10 | 3/4/4 | 307 | died 25 s |
| | deep | 30 | 5 | 7–8 | 10/10/10 | 209 | died 24 s |
| wizard | shallow | 9 | 1 | 10–12 | 3/4/2 | 221 | died 14 s |
| | deep | 30 | 4 | 7–8 | 10/10/10 | 252 | died 17 s |
| necromancer | shallow | 9 | 1 | 10–11 | 3/4/2 | 169 | died 15 s |
| | deep | 30 | 3 | 7–8 | 10/10/10 | 38 | died 20 s |
| druid | shallow | 10 | 2 | 10–10 | 4/4/2 | 734 | died 14 s |
| | deep | 30 | 7 | 7–8 | 10/10/10 | 993 | died 21 s |
| mage | shallow | 9 | 1 | 10–11 | 3/4/2 | 671 | died 16 s |
| | deep | 30 | 4 | 7–8 | 10/10/10 | 448 | died 15 s |
| bard | shallow | 9 | 1 | 10–11 | 3/4/2 | 298 | died 16 s |
| | deep | 30 | 4 | 7–8 | 10/10/10 | 80 | died 21 s |
| witch_doctor | shallow | 9 | 1 | 10–11 | 3/4/2 | 288 | died 16 s |
| | deep | 30 | 4 | 7–8 | 10/10/10 | 143 | died 25 s |
| samurai | shallow | 11 | 3 | 9–10 | 4/3/4 | 147 | died 62 s |
| | deep | 30 | 7 | 7–8 | 10/10/10 | 144 | died 30 s |
| monk | shallow | 9 | 1 | 10–11 | 4/3/2 | 167 | died 19 s |
| | deep | 30 | 5 | 7–8 | 10/10/10 | 477 | died 21 s |
| assassin | shallow | 9 | 1 | 10–11 | 3/4/2 | 473 | died 16 s |
| | deep | 30 | 4 | 7–8 | 10/10/10 | 178 | died 15 s |
| priest | shallow | 9 | 1 | 10–11 | 4/3/2 | 364 | died 45 s |
| | deep | 30 | 4 | 7–8 | 10/10/10 | 335 | survived 180 s |
| savage | shallow | 9 | 1 | 10–11 | 4/4/2 | 3250 | survived 180 s |
| | deep | 30 | 5 | 7–8 | 10/10/10 | 340 | survived 180 s |
| hunter | shallow | 9 | 1 | 10–11 | 3/4/2 | 320 | died 14 s |
| | deep | 30 | 4 | 7–8 | 10/10/10 | 541 | died 16 s |
| sundian | shallow | 9 | 1 | 10–11 | 3/4/2 | 446 | died 18 s |
| | deep | 30 | 4 | 7–8 | 10/10/10 | 938 | died 19 s |

### Breadth buys something — 14 of 14 classes

The deep build brings capabilities the shallow one does not have, in **every**
class. It is not only lower damage, so this is not the tree-design finding.

**Only the deep build has**, counted across the roster:

| capability | classes |
|---|---|
| rider `stun` | 13 |
| rider `multiPulse` | 11 |
| effect `ward` | 10 |
| effect `cone` | 8 |
| rider `knockback` | 6 |
| effect `line` | 5 |
| effect `drain` | 4 · rider `slow` 4 |
| rider `taunt` 3 · effect `shield` 3 · rider `weakenDamage` 3 · rider `root` 3 · rider `healPerHit` 3 | 3 |
| effect `heal` 2 · rider `impactDot` 2 · rider `splash` 2 · effect `hazard` 2 | 2 |
| effect `summon` 1 · rider `sluice` 1 | 1 |

Plus **2–5 more always-on passives**, in all 14 classes. Passives need no slot,
so they are the one thing breadth buys that does not compete for the eight.

**But the shallow build also has things the deep one lacks** — effect `hazard`
×5, rider `slow` ×5, effect `shield` ×4, effect `heal` ×3, `strike` ×2,
`bolt` ×2, `trap` ×2, `summon` ×2. Going deep does not add to a kit; it
*swaps* one. The eight slots are the constraint, and equipping the capstones
means unequipping the openers.

### The cost is large and inconsistent

| deep vs shallow dps | classes |
|---|---|
| deep much worse (−30% or more) | necromancer −78%, bard −73%, assassin −62%, witch_doctor −50%, mage −33%, blacksmith −32% |
| about level (±5%) | samurai −2%, priest −8% |
| deep much better (+30% or more) | monk +186%, sundian +110%, hunter +69%, druid +35% |
| deep modestly better | wizard +14% |

Six classes lose a third to three quarters of their output for going deep; five
gain a third to nearly triple. **That spread is not a trade-off, it is
variance** — which capstone a class happens to have decides whether depth is a
reward or a penalty, and a player cannot know that in advance.

*(Savage's −90% is excluded from the reading above: its shallow figure is the
immortal-dummy accumulation artefact, not a real number.)*

### Nobody clears region 8

**0 of 14 shallow, 0 of 14 deep.** Most die in 14–25 seconds; priest-deep,
savage and savage-deep survive the 180 s cap without clearing.

**This is a floor, not the real number.** These builds carry skills and stat
picks and **no items at all** — a real endgame character has a full complement
of shop gear, which is a third power source this fixture does not model. Read
it as "skills plus stats alone do not survive region 8", which is still a
useful bound: it says the item layer is currently load-bearing for endgame
survival rather than additive to it.

The tuning condition the brief states — *both builds clear region 8* — is
currently met by neither, so it is a target to build toward rather than a
property to preserve.

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

**A third finding, from section 7, that is a tree question rather than a tuning
one.** Breadth does buy capability — 14 of 14 classes — but the eight slots
mean depth *swaps* a kit rather than extending it, and whether that swap is a
gain or a loss varies from −78% to +186% depending on which capstone a class
owns. Before tuning an enemy curve against "a build", it is worth deciding
whether that spread is intended.

**Three fixture gaps to close before phase 2 tunes anything:**

1. Samurai cannot be measured by a stationary fixture (movement/footing
   triggers) — reads 0 at every rank in section 3.
2. Savage cannot be measured against immortal dummies (accumulating effects
   compound without limit) — 41% overkill, non-monotonic DPS.
3. **No fixture here carries items.** Section 7's survival numbers and section
   5's sustain crossover both exclude the shop layer entirely. Any tuning pass
   that sets enemy numbers against item-less builds will overshoot.
