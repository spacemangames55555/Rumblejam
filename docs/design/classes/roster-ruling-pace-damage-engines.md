# Roster ruling — pace, damage share, engine cost

Applies to all fourteen RumbleJam class conversion files. The class files get revised against this; the eight judgment fields stay as authored except where these rules force a change.

## Why

Measured across all fourteen conversions (329 timed actives):

- Mean cooldown **15.6 seconds**. An 8-slot build fires **0.51 times per second**. Current measured in-game rate is 4.1/sec, and 4.1 already reads as too sparse in play.
- **155 of 391 skills deal no damage** (40%). Only **9 are high damage** (2.3%).
- Two depleting engines (Wizard Mana, Mage Energy) charge a flat cost per cast by pace bucket, so burn-per-second varies ~8× between a fast and a slow skill.

The cooldowns came from Thrones of Heaven, where a human pressed buttons every few seconds. RumbleJam fires everything automatically against mobs of up to 133 simultaneous enemies. The numbers are correct for the wrong game.

---

## Ruling 1 — Pace

**Target: a slotted 8-skill build fires 6–8 times per second.** Genre reference is Brotato's six weapons at one to two attacks each. Mean cooldown across a slotted build lands near 1.1s.

Fixed bucket values. "Slow" means one thing roster-wide:

| bucket | cooldown |
|---|---|
| very fast | 0.4 s |
| fast | 0.8 s |
| medium | 1.5 s |
| slow | 3 s |
| very slow | 6 s |
| capstone | 20–30 s |

**Distribution rule, per tree of 10:** at least **4 nodes in medium or faster**, at most **2 in very slow**. Capstones are exempt from the distribution count.

Buckets alone don't reach the target — half the current roster sits in slow or very slow, which would still only yield ~2.3/sec. The distribution rule is what gets there.

Where a skill's identity genuinely requires a long cooldown that isn't a capstone, say so and keep it — but it counts against the tree's two very-slow slots.

---

## Ruling 2 — Damage share

**Per tree of 10: at least 5 nodes deal real damage, and at least 1 is high tier.**

Zero-damage control skills stay. Black Ice dealing literally nothing is correct design and should not have damage grafted onto it; the same goes for Intimidate, the Ice Golem, and every pure-utility node. The rule guarantees that a player who commits to one tree has output, not that every node is an attack.

High-tier damage at 2.3% of the roster is the sharper half of this problem. Every tree needs a node that hits hard, or nothing in the game feels like a payoff.

---

## Ruling 3 — Engine cost proportional to cooldown

Applies to the two depleting engines, **Wizard Mana** and **Mage Energy**:

```
cost = cooldown_seconds × k        k ≈ 0.6
```

Burn-per-second is then flat per slotted skill, and the constraint becomes **how many actives you run** rather than which pace bucket they sit in. Against 4/sec regeneration, roughly six actives is sustainable and eight is not — which is the pressure both class files state they want.

This also makes the engines survive any future pace change. A flat per-cast cost is coupled to cooldown values; a proportional one isn't.

**Both files' "silent character" windows need shortening.** Elemental Storm currently leaves the Wizard doing nothing for ten seconds. Movement is the player's only input, so a character with nothing firing isn't a tradeoff they chose — it's the game stopping. Dead air should read as recovery, not punishment: a couple of seconds, not ten.

---

## Ruling 4 — Passive slots

Passives get their own budget: **4 passive slots**, separate from the 8 active slots, on the same unlock ladder.

Passive counts run from 1 (Druid) to 12 (Blacksmith), median 4. A shared budget would punish passive-heavy classes for their identity; an unlimited one would hand Blacksmith twelve always-on effects against Druid's one. Fixed 4 binds six of thirteen classes, so it's a real build decision rather than a formality.

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
