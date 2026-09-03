# PRIMITIVES — the engine's delivery vocabulary

Every skill in RumbleJam is built from a small fixed set of **delivery
primitives**. A primitive is the answer to one question: *how does this skill
reach the thing it affects?* A punch, a thrown bolt, a patch of burning ground
and a summoned skeleton are four different answers, and the engine has
seventeen in total.

A skill declares a list of steps. Each step names one primitive and gives it
values. A skill can have several steps — the Necromancer's Singularity is a
patch of ground *and* a pull, so it declares two.

**This file is the reference for classifying a skill.** It is written for
someone doing that pass on a class document who has never opened the codebase.

---

## How to read an entry

Each primitive below gives:

- **What it does** — one sentence.
- **Parameters** — what you set, with units. Distances are in pixels, times in
  milliseconds, angles in radians unless a row says otherwise.
- **Always set / sometimes set** — measured across all 420 shipped skills.
  "Always set" means every skill using this primitive declares it, so treat it
  as required. A number in the form `6/17` means six of the seventeen skills
  that use this primitive declare it — optional, with a default.
- **Observed range** — the low and high values shipped content actually uses.
  A new value far outside that range is not forbidden, but it is worth a second
  look.
- **Riders it accepts** — see the rider section at the end.
- **A real example**, by skill id.

Two conventions worth knowing before the list:

**`damage` is a base, not a final number.** Rank, the caster's stats and the
class engine all scale it at the moment it fires.

**`scaleWith` and `scaleWeight`** appear on many primitives and are not
delivery at all — they say a step's output is multiplied by a class engine.
`scaleWith` names the engine; `scaleWeight` adjusts how strongly. Both are
optional everywhere they appear.

---

## The seventeen

### `strike` — a swing around the caster
The most-used primitive in the game: 108 skills. Everything within a reach and
inside an arc centred on the caster's facing is hit at once. Cover blocks it.

| parameter | units | always set? | observed |
|---|---|---|---|
| `damage` | base damage | always | 3–44 |
| `reach` | pixels | always | 44–165 |
| `arc` | radians (`6.28` is a full circle) | always | 1.2–6.28 |
| `select` | which enemy to face | 12/108 | — |

Riders: the full impact set, plus `windUp`, `multiPulse` and `carry`.
Example: `necro_spiked_punch` — 30 damage, 72px, full circle, capped at 3.

### `bolt` — a travelling projectile
59 skills. A shot leaves the caster, flies, and resolves on whatever it hits.
Riders travel with the shot and land on impact. A shot into cover is wasted
rather than passing through.

| parameter | units | always set? | observed |
|---|---|---|---|
| `damage` | base damage | always | 4–30 |
| `range` | pixels | always | 210–480 |
| `speed` | pixels per second | always | 420–620 |
| `count` | number of shots | 8/59 | 2–3 |
| `radius` | pixels — the shot's own size | 18/59 | 6–7 |

Riders: the full impact set, plus `pierce`, `splash`, `impactDot` and
`defenseDown`, which need a projectile to make sense.
Example: `necro_dark_energy_blip` — 18 damage, 480px, the fastest cycle in its class.

### `cone` — a widening wedge
55 skills. Like `strike` but aimed outward at a longer range and stated as an
angle rather than a reach.

| parameter | units | always set? | observed |
|---|---|---|---|
| `damage` | base damage | always | 5–34 |
| `range` | pixels | always | 185–320 |
| `angle` **or** `arc` | radians | 39/55 and 16/55 | 1.22–2.9 / 1.1–3.0 |

**Two names for one thing.** Thirty-nine skills say `angle` and sixteen say
`arc`. Both work. Prefer `angle` for new content; it is the majority.
Riders: the impact set.
Example: `necro_abyssal_blast` — 34 damage in a 70° wedge at 200px.

### `line` — a rectangle in one direction
19 skills. Everything in a straight lane of a given length and width. Not a
narrow cone: it does not widen, and what it catches is decided by a rectangle.

| parameter | units | always set? | observed |
|---|---|---|---|
| `damage` | base damage | always | 5–28 |
| `length` | pixels | always | 320–430 |
| `width` | pixels | always | 30–66 |

Riders: the impact set, plus `windUp`, `multiPulse` and `carry`. **`carry` is
what moves the caster along the lane** — a dash that damages what it passes is
a `line` with `carry`, not a separate primitive.
Example: `necro_wrecking_ball` — 28 damage down a 320px lane.

### `hazard` — a patch of ground that keeps hurting
17 skills. Placed where it lands, damages on a repeating tick for a duration,
and does not follow anybody.

| parameter | units | always set? | observed |
|---|---|---|---|
| `damage` | base damage **per tick** | always | 4–30 |
| `radius` | pixels | always | 70–200 |
| `duration` | milliseconds | always | 400–6400 |
| `tickMs` | milliseconds between ticks | always | 400–500 |

Riders: `slow` only. A field has no impact frame, so the riders that resolve on
one target at one moment cannot apply.
Example: `necro_dark_energy_rift` — 30 damage in a 130px circle.

### `trap` — an inert object that waits to be stepped on
5 skills. Placed and then does nothing until something reaches it. The
difference from `hazard` is the waiting: a hazard is already hurting.

| parameter | units | always set? | observed |
|---|---|---|---|
| `damage` | base damage | always | 11–20 |
| `radius` | pixels | always | 62–104 |
| `duration` | milliseconds it stays armed | always | 14000 |

Riders: none — placing an inert object has no impact. What the detonation
carries is declared on the step and read when it goes off.
Example: `asn_caltrops`.

### `channel` — a sustained beam locked on one enemy
2 skills. Picks one target and ticks on it for up to a maximum duration.
Breaks when the target dies or leaves range — **not** when the caster moves.

| parameter | units | always set? | observed |
|---|---|---|---|
| `damage` | base damage per tick | always | 14–16 |
| `range` | pixels | always | 360 |
| `duration` | milliseconds, maximum | always | 10000 |
| `tickMs` | milliseconds between ticks | always | 500 |
| `moveRate` | fraction of normal tick rate while moving | never set — defaults to 0.6 | — |
| `cdFromEnd` | start the cooldown when the channel ends | always | — |

Riders: the impact set. Note they re-apply on **every tick**, so a stun on a
400ms cadence is a permanent stun. `slow`, `weakenDamage` and `impactDot` are
the ones that read as intended under repetition.
Example: `necro_death_channel`.

### `plague` — a damage-over-time that can spread
9 skills. Applies a DoT. If a spread radius is given, it seeds everything
within that radius once, at cast.

| parameter | units | always set? | observed |
|---|---|---|---|
| `damage` | base damage per tick | always | 4–26 |
| `duration` | milliseconds | always | 3000–5200 |
| `spreadRadius` | pixels; omit or 0 for single-target | 5/9 | 0–175 |

Riders: none.
Example: `necro_internal_collapse` — a stacking DoT with no spread.

**A caution.** Six skills declare a `range` and a `tick` on this primitive and
the engine reads neither. If you are classifying a contagion, the spread comes
from `spreadRadius` or from the skill's targeting rule, not from `range`.

### `gravity_pull` — drag enemies toward a point
1 skill. Repeatedly moves everything in a radius a short distance toward a
centre.

| parameter | units | always set? | observed |
|---|---|---|---|
| `radius` | pixels | always | 200 |
| `range` | pixels — how far away it can be placed | always | 200 |
| `distance` | pixels moved per pulse | always | 14 |
| `duration` | milliseconds | always | 3200 |
| `centre` | where to pull toward | never set — defaults to the placement point | — |

Riders: none. A pull has no impact frame; pair it with a damage step if the
skill should also hurt.
Example: `necro_singularity` — `hazard + gravity_pull`, the only shipped user.

### `aura` — a field that follows the caster
**No skill uses this primitive.** The mechanism it drives is used, through two
other doors — see the unused-primitives note at the end.

| parameter | units | always set? | observed |
|---|---|---|---|
| `radius` | pixels | — | — |
| `tickMs` | milliseconds between pulses | — | — |
| `damage` | base damage per pulse | — | — |
| `duration` | milliseconds | — | — |
| `ampPct` | fraction; enemies inside take more damage | — | — |

Riders: `slow` only, for the same reason as `hazard`.

### `summon` — put a body on the field
13 skills. Everything about the minion is declared on the step. This is the
widest parameter list in the vocabulary.

| parameter | units | always set? | observed |
|---|---|---|---|
| `archetype` | which minion | always | — |
| `hp` | hit points | always | 20–220 |
| `attack` | a nested step — the minion's own attack | always | — |
| `attackCd` | **milliseconds** between its swings | always | 0.9–1500 |
| `move` | how it moves | always | — |
| `radius` | pixels — its body size | always | 8–22 |
| `spawnRadius` | pixels from the caster | always | 44–80 |
| `duration` | milliseconds; 0 means until killed | always | 0–20000 |
| `slotted` | whether it counts against the loadout | always | — |
| `maxAlive` | standing cap | 12/13 | 1–6 |
| `count` | how many per cast | 10/13 | 1–6 |
| `deliver` | spawn where a thrown token landed | 1/13 | — |

Riders: none on the summon itself. What the **minion's** attack carries is
declared on the nested `attack` step and validated against that step's own
primitive.
Example: `necro_summon_skeleton`.

**A known defect lives in this table.** `attackCd` is milliseconds, and the
observed range runs from 0.9 to 1500 — four summons declare it in *seconds*,
so those minions swing about a thousand times too fast. If you are classifying
a summon, state the swing in milliseconds.

### `heal` — restore health
13 skills.

| parameter | units | always set? | observed |
|---|---|---|---|
| `amount` | health restored | always | 12–30 |
| `radius` | pixels; who else it reaches | 3/13 | 140–260 |

Riders: none.
Example: `wiz_arcane_recovery`.

**A known defect lives in this table too.** Ten of the thirteen declare no
`radius`. A missing radius does not mean "self only" — it means the range check
compares against nothing and nobody is excluded, so the heal reaches every
living ally anywhere on the map. New heals must declare a radius.

### `shield` — a pool that absorbs damage
22 skills. Soaks incoming damage until spent or expired.

| parameter | units | always set? | observed |
|---|---|---|---|
| `amount` | damage absorbed | always | 14–44 |
| `duration` | milliseconds | always | 4000–6000 |

Riders: none.
Example: `wiz_null_field`.

### `ward` — a shield that hits back
24 skills. A shield that also returns a fraction of what it absorbs.

| parameter | units | always set? | observed |
|---|---|---|---|
| `amount` | damage absorbed | always | 16–58 |
| `duration` | milliseconds | always | 4000–7200 |
| `reflectPct` | fraction returned | 20/24 | 0–35 |

Riders: none.
Example: `wiz_prism_ward`.

### `drain` — damage that returns health
13 skills. Hits one target and heals the caster for a fraction of the damage.

| parameter | units | always set? | observed |
|---|---|---|---|
| `damage` | base damage | always | 4–40 |
| `range` | pixels | always | 120–250 |
| `healPct` | fraction of damage returned as health | always | 0.15–0.6 |

Riders: none.
Example: `pri_litany`.

### `form` — a timed transformation
3 skills. Changes the caster's stats for a duration.

| parameter | units | always set? | observed |
|---|---|---|---|
| `form` | the form's name | always | — |
| `stats` | stat changes while it holds | always | — |
| `duration` | milliseconds | always | 6000–7000 |

Riders: none.
Example: `smith_iron_pyrite`.

**Not to be confused with `persist`** — see below.

### `shift` — change the caster's damage type
3 skills. Persists until the next shift or the end of the room; it has no
duration by design.

| parameter | units | always set? | observed |
|---|---|---|---|
| `domain` | the damage type to change to | always | — |

Riders: none.
Example: `wiz_attune_physical`.

---

## Not a primitive, but a third door: `persist`

A skill can declare `persist` instead of steps. It then occupies a loadout slot
and holds a state for as long as it is slotted — **no trigger, no cooldown, no
duration** — and everything it granted is torn down when it leaves the bar.

It can carry a `form` (with `stats`), an `aura` (radius, pulse interval, and a
`taunt` that pulls enemy attention), and a `shield`. One skill uses it:
`necro_marrownaut`. Classify such a node as `persist { ... }` rather than
forcing it into `form`.

There is also `passive`, for always-on effects that never fire. Neither is a
delivery primitive, but both are places a skill's behaviour can live, and a
classification pass that only looks at steps will call these nodes empty.

---

## Riders

Riders are modifiers attached to a step. Which are legal depends on the
primitive, and the rule behind that is worth stating once: **a rider resolves
on a target at the moment of impact.** A primitive with no impact frame — a
summon, a trap, a pull, a shift — takes no riders at all, and a field takes only
the one rider a field can apply continuously.

**Impact riders** (`strike`, `line`, `cone`, `bolt`, `channel`):
`stun`, `taunt`, `root`, `knockback`, `slow`, `weakenDamage`, `weakenDefense`,
`healPerHit`, `mend`, `mark`, `doll`, `drench`, `sluice`.

**Shape riders** (`strike`, `line` only) — these change the swing rather than
the target: `windUp` delays it, `multiPulse` makes it land several times on the
same tick, `carry` moves the caster along the step's own axis.

**Projectile riders** (`bolt` only) — these need a flight and an impact point:
`pierce`, `splash`, `impactDot`, `defenseDown`.

**Fields** (`hazard`, `aura`): `slow` only.

**No riders at all**: `summon`, `trap`, `shift`, `gravity_pull`, `heal`,
`shield`, `ward`, `drain`, `form`, `plague`.

---

## GAPS — shapes the class documents describe with no primitive behind them

### `chain` — eight nodes, no primitive

Eight skills across seven classes declare a chain shape: a strike that jumps
from its target to the next enemy, and on again, for a set number of hops.

| node | class |
|---|---|
| Trick Shot | Assassin |
| Resonance Cascade, War Song, Chaotic Riff | Bard |
| Lightning Strike | Druid |
| Hundred Hands | Monk |
| Thousand Cuts | Samurai |
| Endless Slaughter | Savage |

Nothing in the vocabulary hops. `bolt` with `pierce` travels in a straight line
through several enemies, which is a different shape — a pierce cannot turn a
corner and a chain is defined by turning one. **This is the largest unmet
delivery need in the roster** and the only shape with more than one class
waiting on it.

### A basic attack the game does not have

The Blacksmith document has four nodes that modify a basic attack. RumbleJam has
no basic attack — every skill fires on its own trigger. These nodes need
redefining rather than a primitive.

### Closed since the documents were written

Three gaps the conversion documents record are no longer gaps. Anything still
carrying these notes is stale:

- **`aura`** — the mechanism ships. Used by `necro_blight` and
  `necro_marrownaut`.
- **`channel`** — ships, and both Necromancer beams use it.
- **`gravity_pull`** — ships, and `necro_singularity` uses it.
- **a dash that damages along its path** — this is `line` with the `carry`
  rider, not a missing primitive.

### Two names that were never primitives

The archived Necromancer conversion classifies nodes as `nova` and `mortar`.
Neither has ever existed. A burst centred on the caster is a `strike` with a
full-circle arc; a placed area burst is a `hazard`.

---

## UNUSED — one primitive, and the reason is not neglect

**`aura`** is the only primitive no shipped skill declares as a step.

That is not the same as unused machinery. The aura *mechanism* — a field that
follows the caster and pulses — has three doors into it, and content uses the
other two:

| door | used by |
|---|---|
| a step declaring `kind: 'aura'` | **nothing** |
| `passive: { aura: {...} }` | `necro_blight` |
| `persist: { aura: {...} }` | `necro_marrownaut` |

All three end in the same call. The step form is unused because both shipped
auras are always-on rather than cast — one is a passive and one is a persistent
state. A future *cast* aura, on a cooldown and lasting a while, is what the step
form is for.

Every other primitive has at least one shipped user. `gravity_pull` and
`channel` are the thinnest, with one and two.
