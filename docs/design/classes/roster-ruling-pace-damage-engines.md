# Roster ruling — pace, damage share, engine cost

Applies to all fourteen RumbleJam class conversion files. The class files get revised against this; the eight judgment fields stay as authored except where these rules force a change.

## Why

Measured across all fourteen conversions (329 timed actives):

- Mean cooldown **15.6 seconds**. An 8-slot build fires ~~0.51 times per second~~ — **corrected: 2.6 times per second.** See "The activation-rate formula" below. Current measured in-game rate is 4.1/sec, and 4.1 already reads as too sparse in play.
- **155 of 391 skills deal no damage** (40%). Only **9 are high damage** (2.3%).
- Two depleting engines (Wizard Mana, Mage Energy) charge a flat cost per cast by pace bucket, so burn-per-second varies ~8× between a fast and a slow skill.

The cooldowns came from Thrones of Heaven, where a human pressed buttons every few seconds. RumbleJam fires everything automatically against mobs of up to 133 simultaneous enemies. The numbers are correct for the wrong game.

---

## Ruling 1 — Pace

**Target: a slotted 8-skill build fires 6–8 times per second**, measured as **`sum(1/cd)` over the eight slotted cooldowns.** Genre reference is Brotato's six weapons at one to two attacks each.

### The activation-rate formula

This ruling was first written against `8 / mean_cooldown`. **That formula is wrong** and it understated every rate in the document.

`8/mean` is the firing rate only when all eight slotted cooldowns are equal. By the AM–HM inequality `sum(1/cd) >= 8/mean` for every other build, with the gap widening as the build's cooldowns spread out — and a real build is deliberately spread, because a player slots a fast opener next to a capstone.

Recomputed on `sum(1/cd)`, with a representative build taken evenly across the three trees:

| | 8/mean (wrong) | sum(1/cd) (correct) |
|---|---|---|
| the fourteen conversions as authored | 1.60/sec (0.51 quoted, taken over *all* actives rather than a slotted eight) | **2.62/sec** |
| the built game today | 3.40/sec | **4.52/sec** |

**The correct formula reproduces the measured number.** The built game measures 4.1/sec in play and computes to 4.52/sec on `sum(1/cd)`, against 3.40/sec on `8/mean`. That agreement is the evidence for the formula, and the 0.51 figure was never reconcilable with the 4.1 sitting beside it in the same sentence.

**What this changes.** The gap is **4.1 → 6–8, roughly 1.5–1.8x**, not the ~8x the 0.51 figure implied. The bucket table below has been **rescaled once against the corrected gap** — see the note under it.

Fixed bucket values. "Slow" means one thing roster-wide:

| bucket | cooldown |
|---|---|
| very fast | 0.6 s |
| fast | 1.2 s |
| medium | 2.0 s |
| slow | 4 s |
| very slow | 8 s |
| capstone | 20–30 s |

**Rescaled once, against the corrected gap.** The first table (0.4 / 0.8 / 1.5 / 3 / 6) was sized against the 0.51/sec figure and assumed an ~8x jump. The real gap is 1.5–1.8x, and the first table overshot: the Necromancer measured **12.92/sec** under it against a 6–8 target, because four very-fast slots produce 6.7/sec between them before anything else is slotted.

**Distribution rule, per tree of 10:** at least **2 nodes fast or better**, at most **1 very fast**, at most **2 in very slow**. Capstones are exempt from the distribution count.

The speed half was originally "at least 4 nodes in medium or faster". That is a floor on composition and it does not reach the target: 4 medium plus 4 slow satisfies it and yields 3.0/sec. Worse, it says nothing about the top of the range, and the top is what actually moves the number — the Necromancer's four very-fast nodes produced 6.7/sec between them before anything else was slotted, while the Samurai owned no very-fast node at all and could not exceed 6.67/sec even with all eight slots fast.

**A bucket-mix rule fixes both ends.** The floor of 2 fast-or-better guarantees a class can reach the band; the ceiling of 1 very-fast per tree stops one class running away with it.

### MEASURED ACROSS ALL FOURTEEN — the floor of 2 is one short

Applied to every class. All fourteen now comply on all three clauses. **Five of fourteen land in the 6–8 band.**

| result | classes |
|---|---|
| in band | Blacksmith 6.58, Druid 6.33, Hunter 6.00, Samurai 6.00, Wizard 7.67 |
| below, 5.50–5.75 | Assassin, Bard, Mage, Monk, Priest, Savage, Sundian, Witch Doctor |
| above | Necromancer 8.25 |

The eight below are not scattered — they sit in a 0.25-wide cluster just under the floor, because **they are all sitting exactly ON the rule's minimum.** Two fast-or-better per tree gives a spread build six fast slots and two more from whatever the trees offer third, which is 5.0/sec plus whatever the last two contribute: 6.00 when both are medium, 5.75 when one is slow, 5.50 when both are.

**The floor wants to be 3, not 2.** Three fast-or-better per tree fills all eight slots from the fast heads — 8 × 1.2s is 6.67/sec, inside the band for any class without a very-fast node and higher for one with. That is arithmetic, not a measurement, and it is the smallest change that would put the cluster inside the band. Not applied — the floor of 2 is what was ruled.

### What a per-tree rule cannot do

**It constrains composition, not builds.** A player slots eight nodes and may take them all from one tree, and a mono-tree build is a different arithmetic from a spread one — the same tree that contributes its two fast nodes to a spread build also contributes its slow and very-slow ones when it has to fill all eight slots.

Measured after this rule (see the two class files):

| build | Necromancer | Samurai |
|---|---|---|
| spread across three trees | in band | in band |
| single tree | **below band** | **below band** |

That is the rule's limit and it is structural: no per-tree composition rule can put every build in the band, because a tree of ten cannot be all fast without the distribution rule's other half collapsing. Mono-tree builds are slower by construction. **Whether that is a defect or a correct cost of specialising is a design call and is not made here.**

Where a skill's identity genuinely requires a long cooldown that isn't a capstone, say so and keep it — but it counts against the tree's two very-slow slots.

---

## Ruling 2 — Damage share

**Per tree of 10: at least 5 nodes are damaging, and at least 1 is high tier.**

**A node is damaging if it PRODUCES damage** — from the cast, from a placed hazard or trap, or from a body it summons. Counting only damage on the cast itself fails the Necromancer, the Druid and the Hunter by construction, because a summoner's output is delivered by the summon: six Necromancer nodes read `DAMAGE TIER: none (0) — the skeleton deals the damage, not the cast`, and that tree has output.

Zero-damage control skills stay. Black Ice dealing literally nothing is correct design and should not have damage grafted onto it; the same goes for Intimidate, the Ice Golem, and every pure-utility node. The rule guarantees that a player who commits to one tree has output, not that every node is an attack.

High-tier damage at 2.3% of the roster is the sharper half of this problem. Every tree needs a node that hits hard, or nothing in the game feels like a payoff.

---

## Ruling 3 — VOID. Engine cost proportional to cooldown

**This rule has no subject left.** It applied to the roster's two depleting
engines, Wizard Mana and Mage Energy. The engine rulings cut both: the Wizard
takes the built `shift` and the Mage takes the built `crystal`, and neither is a
resource that is spent per cast. **No class in the roster now has a depleting
engine**, so there is nothing for a proportional cost to be proportional to.

Kept as a void entry rather than deleted, because the reasoning survives its
subject: if a depleting engine is ever added, a flat per-cast cost couples it to
the cooldown table and a proportional one does not.

**One clause outlived the rule and is promoted here.** The "silent character"
requirement stands on its own for every class: movement is the player's only
input, so a character with nothing firing is not a tradeoff the player chose, it
is the game stopping. Dead air should read as recovery, not punishment — a
couple of seconds, not ten.

---

## Ruling 4 — Passive slots

Passives get their own budget: **4 passive slots**, separate from the 8 active slots, on the same unlock ladder.

Passive counts run from 1 (Druid) to 12 (Blacksmith), median 4. A shared budget would punish passive-heavy classes for their identity; an unlimited one would hand Blacksmith twelve always-on effects against Druid's one. Fixed 4 binds six of thirteen classes, so it's a real build decision rather than a formality.

---

## Ruling 6 — Rider duration against cooldown

**A rider's duration must be shorter than its skill's cooldown.** Where the authored duration exceeds the new cooldown, **cut the duration to ~70% of the cooldown.** Do not lengthen the cooldown to fit the rider — pace is the thing being fixed, and solving a rider by slowing the skill undoes ruling 1.

**Floor: a rider that would be cut below 500ms is cut ENTIRELY, not shortened.** A 30% weaken lasting nine frames is worse than no weaken — it reads as a broken skill rather than a deliberate omission, and a player cannot tell the difference between a rider that is tiny and one that is failing. Where cutting the rider removes the skill's whole point, hold the skill and report it instead of deleting its reason to exist.

**Exception: transformations and forms keep their duration and take a capstone-bucket cooldown instead** — **and a form's duration must be at most one third of its cooldown.** A form is the skill, so shortening it to 70% of a fast cooldown deletes it rather than balancing it; but the exception alone is not enough. The Necromancer's Marrownaut is a 30000ms form, and at the capstone bucket's 30s ceiling it was still permanently up. The one-third rule is the missing half: a 30s capstone carries a 10s form.

**Stacking DoTs are not riders for this rule.** A stacking DoT whose duration exceeds its cooldown is rationed by its stack ceiling, not by the clock — Entropy Cascade's 5000ms DoT on a 600ms cooldown caps at 6 stacks and behaves correctly.

This rule exists because ruling 1 sets cooldowns and says nothing about durations, so rebucketing silently converts every timed rider into a permanent one. It is not a per-class problem. Three landed in the Necromancer alone on the first pass:

| skill | rider | new cooldown | before the rule | after |
|---|---|---|---|---|
| Stake | root 2500ms | 1500ms | permanent single-target root | root 1000ms |
| Hex of Entropy | slow ×0.5 + weaken 40%, 2000ms | 1500ms | permanent area control | both 1000ms |
| Marrownaut | form 30000ms | 6000ms | permanent +50% HP / +45% mitigation | form kept, cooldown to the capstone bucket |

---

## Ruling 5 — Channels

Channels do not break on movement. They tick at **60%** while the caster is moving. A channel that breaks on movement can never complete when movement is the only input.

---

## Also fix

**Duplicate tier-0 openers in four classes.** Each tree's opener should announce that tree's axis — burst, control, sustain — rather than being the same bolt three times.

- **Wizard** — Fireball (26/360), Icicle (24/380), Ethereal Bolt (26/360) are all single-target projectiles at near-identical numbers. The file says so outright: "it is Fireball. Genuinely."
- **Witch Doctor** — Voodoo Doll and Blow Dart are both single target at 340px.
- **Mage** — Quantum Blast (360) and Arcane Orb (340) are both single-target projectiles.
- **Necromancer** — Bone Dart (26/460) and Dark Energy Blip (18/480) are both single-target projectiles at long range on near-identical geometry. Only Summon Skeleton announces its tree.

The other ten classes differentiate their three openers properly, so this is a fix, not a pattern.

---

## Out of scope

**Absolute damage values are not being retuned here.** The power-curve pass owns those, and it will move them against measured enemy threat per region. These rulings change pace, distribution, and engine shape only.

**Projectile visibility is a separate patch.** Player projectiles currently live a mean of 47 ms — under three frames — because a bolt is released the instant it touches a body. Firing eight times a second won't *look* like eight times a second until that's addressed, via `fx.skillFires` (the channel exists, carries position and skill id, and nothing reads it) and projectile speed. Both are needed before the pace change is visible on screen.
