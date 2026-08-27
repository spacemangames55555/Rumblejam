# Primitive reference

**What this is for.** A doc block describes what a skill does but never names its
primitive. Every skill definition in `js/` must name one. This sheet is what you
classify against.

Everything here was read out of `js/compose.js` and verified against the 420
built skills. Where a description in circulation was wrong, it is corrected and
flagged — see **Corrections** at the bottom.

---

## The seventeen

| primitive | what a player sees | clearest example |
|---|---|---|
| **strike** | A melee sweep in front of you. Instant, arc-shaped, stops at walls. | Rebuke — Priest (`priest_judgment.js:65`) |
| **bolt** | A projectile that flies across the screen. It travels, so it can miss a moving target. | Dark Energy Blip — Necromancer (`necro_dark_matter.js:54`) |
| **cone** | A fan of damage that turns itself toward the thickest part of the crowd. | Abyssal Blast — Necromancer (`necro_dark_matter.js:146`) |
| **line** | A beam that appears instantly along a straight lane and hits everything in it. | Refracted Lance — Wizard (`wizard_attunement.js:88`) |
| **trap** | Something you leave on the ground that sits there doing nothing until it is set off. | Caltrops — Assassin (`asn_killbox.js:79`) |
| **hazard** | A patch of ground that hurts anything standing in it, then fades. | Blight — Necromancer (`necro_dark_matter.js:64`) |
| **gravity_pull** | Enemies slide toward a point — once, or in repeated tugs. Nothing is drawn; the movement is the tell. | *(built, no skill user yet — Mage's Contraction and the Necromancer's Singularity are its first)* |
| **aura** | A field that hangs around you and moves with you — always on, or for as long as a form holds. | Blight — Necromancer (`necro_dark_matter.js`) |
| **channel** | A beam that stays on one enemy and keeps hurting it, until it dies, walks out, or your time runs out. | *(built, no skill user yet — the Necromancer's Death Channel is its first)* |
| **heal** | Green numbers on you and any ally standing close enough. | Intercession — Priest (`priest_grace.js:70`) |
| **shield** | A bubble that soaks a set amount of damage and expires. | Null Field — Wizard (`wizard_arcana.js:140`) |
| **ward** | A bubble that soaks damage **and hits back** at whatever struck it. | Prism Ward — Wizard (`wizard_attunement.js:111`) |
| **drain** | You hit one enemy and some of the damage comes back as your own health. | Litany — Priest (`priest_grace.js:105`) |
| **summon** | A body appears and fights on its own. | Hound — Hunter (`hun_houndmaster.js:73`) |
| **shift** | Nothing visible hits anything; your own damage type changes for the room. | Attune: Physical — Wizard (`wizard_attunement.js:75`) |
| **form** | You transform. A name appears, your stats change, it wears off. | Iron Pyrite — Blacksmith (`smith_crystal.js:101`) |
| **plague** | A damage-over-time that lands on one enemy and everything near it at that moment. | Rot — Witch Doctor (`wd_blight.js:69`) |

---

## The five questions that decide the hard pairs

1. **strike or cone?** — *Does it point at your target, or at the crowd?*
   `strike` aims at whatever the skill selected. `cone` aims at the densest
   cluster of enemies regardless of what you were targeting. **Not a size
   difference** — both are arc sweeps that respect walls.

2. **bolt or line?** — *Does it travel?*
   A `bolt` is an object crossing the screen and can miss. A `line` resolves
   instantly along its lane and cannot.

3. **shield or ward?** — *Does it hit back?*
   Both absorb. Only `ward` reflects a share of what it eats.

4. **hazard or trap?** — *Does it hurt things standing in it?*
   A `hazard` ticks damage on a cadence and ends by expiring. A `trap` does
   nothing at all until a later cast sets it off, and ends by being consumed.

5. **plague or an `impactDot` rider?** — *Does the DoT need its own cast?*
   `impactDot` rides a bolt that is already hitting something. `plague` is the
   whole action — it picks a seed itself and applies the DoT there.

---

## `CAST` → primitive menu

The docs use seven `CAST` values against fourteen primitives. This is the
many-to-many mapping; each row is your shortlist, not an answer.

| doc `CAST` | uses | plausible primitives |
|---|---|---|
| `self` | 123 | `shield` · `ward` · `form` · `shift` · `heal` · **or a passive, no primitive at all** |
| `melee` | 67 | `strike` · `cone` |
| `n/a` | 63 | usually a passive — **no compose step** |
| `instant-at-range` | 49 | `line` · `drain` · `plague` · `bolt` (if it should be dodgeable) |
| `projectile` | 49 | `bolt` |
| `placed` | 43 | `hazard` · `trap` |
| `summoned` | 23 | `summon` |

Only `projectile` and `summoned` map to a single primitive. The other five need
a decision.

---

## Two doc types that are **not** a fifteenth and sixteenth primitive

- **`stacking_dot`** → this is **`plague`**. (4 doc nodes, 3 classes.)
- **`transformation`** → this is **`form`**. (10 doc nodes, 8 classes.)

---

## Riders are not primitives

Several doc blocks lead with the effect: *"root 1400ms"*, *"taunt on the marked
enemy"*. **A skill is never "a root."** It is a strike or a bolt **that roots**.
The rider is a key on the step, and it needs a primitive underneath it.

Live impact riders: `stun` `root` `taunt` `knockback` `slow` `weakenDamage`
`weakenDefense` `defenseDown` `healPerHit` `mend` `mark` `doll` `drench`
`sluice`. Shape riders: `windUp` `multiPulse`. Bolt riders: `pierce` `splash`
`impactDot`.

`defenseDown` is the built spelling of what the docs call *vulnerability*.

---

## Not built yet — classify as these rather than forcing a fit

A skill correctly marked **needs gravity pull** is more useful than one
mislabelled `bolt`.

**Correction — the gravity-pull figure in an earlier version of this sheet was
wrong.** It read **11 nodes, 6 classes** and it counted the word *pull*, not the
effect. Five of those eleven redirect **attention**, not position: the MAGNET
aggro decoys on the Monk's Astral Projection, the Wizard's golem and two
Necromancer summons, plus the Samurai's Whistling Arrow, which is a `taunt`. All
five are already expressible — `taunt` is an impact rider and magnet radius is a
summon parameter. The real positional-pull demand is **6 nodes, 3 classes**:
Mage (Contraction, Graviton Surge, Singularity Collapse, Black Hole),
Necromancer (Singularity), Sundian (Riptide). Still the highest cross-class
demand of the three missing primitives, so the build order it justified stands.

| missing | doc demand | note |
|---|---|---|
| ~~gravity pull~~ | ~~6 nodes, 3 classes~~ | **BUILT** — `gravity_pull`, the fifteenth primitive. |
| ~~channel~~ | ~~4 nodes, 3 classes~~ | **BUILT** — `channel`, the sixteenth primitive. The figure was exact: `TYPE: channel` is a declared field, not a word in prose. |
| ~~aura~~ | ~~3 nodes, 2 classes~~ | **BUILT** — `aura`, the seventeenth primitive, and the mechanism carries 7 nodes across 5 classes once the form-bounded and timed ones are counted. |
| **ally-targeted defense** | **34 nodes, 8 classes** (priest 13, bard 10, monk 3, witchdoctor 3, druid 2, blacksmith) | `shield` and `ward` write the caster only. `heal` is the one primitive that reaches allies. |

---
---

# Reference — below the fold

## Required parameters

Measured across all 420 built skills. **ALWAYS** means every existing user
supplies it. Use this to tell whether a doc block carries enough to be a given
primitive.

| primitive | always | sometimes |
|---|---|---|
| `strike` | `damage` `reach` `arc` | `scaleWith` `scaleWeight` |
| `bolt` | `damage` `speed` `range` | `count` `radius` `scaleWith` |
| `cone` | `damage` `range` | `angle` **or** `arc` · `scaleWith` |
| `line` | `damage` `width` `length` | `scaleWith` |
| `trap` | `damage` `radius` `duration` | — |
| `hazard` | `damage` `radius` `duration` `tickMs` | `scaleWith` |
| `aura` | `radius` | `damage` + `tickMs` · `duration` (absent from a passive = always-on) · `ampPct` · `slow` |
| `channel` | `damage` `range` `tickMs` `duration` | `moveRate` (default 0.6) · `cdFromEnd` · `scaleWith` |
| `gravity_pull` | `radius` `distance` | `duration` (absent = one pull, present = a field) · `centre` (`target` default, or `self`) · `range` |
| `heal` | `amount` | `radius` `scaleWith` |
| `shield` | `amount` `duration` | `scaleWith` |
| `ward` | `amount` `duration` | `reflectPct` (21/25) `scaleWith` |
| `drain` | `damage` `range` `healPct` | `scaleWith` |
| `summon` | `archetype` `move` `slotted` `hp` `radius` `spawnRadius` `duration` `attackCd` `attack` | `maxAlive` `count` `revives` `orbitRadius` `deliver` |
| `shift` | `domain` | — |
| `form` | `form` `duration` `stats` | — |
| `plague` | `damage` `duration` | `spreadRadius` (4/8) `range` `tick` |

`summon` is by far the heaviest — nine required fields, and `attack` is itself a
compose step the minion runs through this same table.

**`attackCd` is milliseconds.** Four built summons declare seconds in it
(`hun_pincer/Loosed`, `wd_swarm/Fetish`, `wd_swarm/Gravecall`,
`wd_swarm/Legion`) and those two trees are the two worst `tree_dps` outliers at
+4123% and +2313%. Do not add a fifth.

## Combinations

`compose` is a list, so a skill can be several primitives in sequence. **Only
three combinations exist in the built roster, across four skills:**

| combination | count | example |
|---|---|---|
| `shield + ward` | 2 | Bulwark — Samurai |
| `bolt + summon` | 1 | Loosed — Hunter |
| `summon + cone` | 1 | Army of the Dead — Necromancer |

Combinations are *expressible* but *rare*. "A bolt that leaves a hazard where it
lands" would work and **has no precedent in the built roster** — if a doc block
needs one, that is a note worth making rather than a pattern to copy.

## How each primitive picks what it affects

| primitive | picks its target by |
|---|---|
| `strike` `line` | the skill's `select`, via `facing()` |
| `cone` | **the densest cluster**, ignoring `select` |
| `bolt` `drain` `plague` `trap` `hazard` | the skill's `select`, via `selectTarget()` |
| `heal` | every live player within `radius` — **the only ally-reaching primitive** |
| `shield` `ward` `form` `shift` | the caster, always |
| `summon` | spawn point near the caster, or a claimed token if `deliver` |

`trap` and `hazard` are placed **where the selector is looking**, not at the
caster's feet — so they go where you are aiming.

## Corrections to descriptions in circulation

Five things previously stated about these primitives are wrong.

1. **`plague` does not spread over time.** It is described as a "spreading
   damage-over-time" and a "contagion". The implementation seeds one target and
   applies the DoT to everything within `spreadRadius` **once, at the moment of
   cast** (`compose.js:569-582`). `tickSkillStatuses` only decrements the timer
   and accrues damage — nothing re-seeds. **Four of its eight users declare no
   `spreadRadius` at all** and are plain single-target DoTs.

2. **`plague` stacks in intensity but not in duration.** The comment says
   "stacks rather than refreshing". Half right: `plagueDps += amt/dur` stacks,
   but `plagueT = Math.max(...)` refreshes to the longer of the two
   (`skillsim.js:799-800`).

3. **`heal` is not unused.** The code comment reads *"No phase-1 skill uses
   it"* — **13 skills use it today**.

4. **`drain` is not unused.** The code comment reads *"Unused in phase 1"* —
   **12 skills use it today**.

5. **`strike` vs `cone` is not a size difference.** Both are arc-limited sweeps
   with line-of-sight checks. The real difference is aiming: `strike` points at
   the selected target, `cone` points at the densest cluster.

**A transcription trap worth knowing:** `strike` takes `reach` and `arc`; `cone`
takes `range` and `angle` — the same two quantities under four names. And `cone`
itself is inconsistent, with 44 of 60 users declaring `angle` and 16 declaring
`arc`.
