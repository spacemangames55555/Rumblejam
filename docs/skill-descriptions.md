# Skill descriptions: generated, not written

Every active skill states its mechanical facts, in one order, in one set of
units, computed from its own `def` at the rank being displayed. Nothing in the
mechanical line is authored. Reproduce with `node tools/skilltext_gate.mjs
--verbose`.

Generator: `js/skilltext.js`. Gate: `tools/skilltext_gate.mjs`.

---

## What was wrong

**216 of 420 descriptions carried hand-typed numbers**; the other 204 carried
none at all. So half the tree was poetry and half was poetry with arithmetic in
it, and none of it moved when a tuning block moved. A player comparing two
skills was comparing two different kinds of sentence.

## The conventions, chosen once

**Fire rate is a cooldown in seconds.** Not activations per second. Two reasons:
it is the field the def actually holds, so it needs no reciprocal and cannot
round wrong; and a per-second figure would imply a sustained rate the trigger
may not permit — a skill on a 0.9 s cooldown whose trigger is `PROXIMITY count
4` does not fire 1.1 times a second, and printing that would be a confident lie.
The cooldown is the honest half: what the skill costs when it is ready.

**Next rank is `now → next`, on rank-scaled figures only.** A figure that does
not move with rank shows a single number, so the arrow itself carries
information: what changes is exactly what the point buys. Precision rises until
the two differ — a rank-4 Call Wolf buys 82 ms of cooldown, which reads
"2.7s → 2.7s" at one decimal, so it is shown at three. The arrow is never a lie
by rounding and never silently disappears.

**An unlearned skill (rank 0) displays rank 1**, because rank 0 never fires and
what a player wants before spending is what the point buys.

**Field order**: damage, fire rate, range, shape, damage over time, riders —
omitting only what genuinely does not apply.

**Flavor is a separate field.** `desc` is gone; `flavor` holds prose and nothing
else. It renders italic and dim beneath the numbers. 362 skills have flavour,
58 have none, and none of the 420 contains a digit.

## The shape vocabulary needed three more words

The brief specified five names and asked that anything not fitting be reported
rather than forced. **130 of 356 actives did not fit.** Three earned a new word;
the rest have no targeting shape at all and say so by omission.

| shape | actives | |
|---|---|---|
| fan (wide) | 131 | angle ≥ π/2 |
| single target | 65 | |
| cone (narrow) | 23 | angle < π/2 |
| **ground area** | **21** | **added** — trap/hazard, a zone that persists where it lands |
| **line** | **20** | **added** — a rectangle, not a widening cone |
| shotgun | 9 | more than one projectile |
| **contagion** | **8** | **added** — plague, which picks its own next target |
| multi-target | 2 | a bolt carrying a `splash` rider |

**Why each is a new word rather than the nearest old one.** A `line` does not
widen and what it hits is decided by a rectangle, so calling it a narrow cone
would describe the wrong geometry. A ground zone is not a shape the caster aims
— it is a place that stays dangerous. A contagion is not multi-target: the
caster picks one, and the effect picks the rest.

**Shape is read off geometry, not off the primitive's name.** `strike` arcs run
1.2–3.0 rad and `cone` angles run 1.1–3.0 — the two primitives overlap almost
entirely. Keying the word to the primitive would call a 2.9 rad strike a cone
and a 1.1 rad cone a fan.

**77 actives have no shape and 68 have no range**, and both are correct: ward,
shield, heal, form, shift and the summons act on the caster or on allies. The
gate checks those for the magnitudes they *do* state, so "it has no damage" can
never be the reason a skill states nothing.

---

## Findings

Generating from the def rather than transcribing it surfaced four things a
hand-written description would have kept hidden. **None is fixed here** — this
is a descriptions patch, and three of them change behaviour.

### 1. Four summons attack about a thousand times too fast

`attackCd` is milliseconds — `js/minions.js:298` divides it by 1000. Ten summons
declare it that way. **Four declare it in seconds:**

| skill | attackCd | effective interval |
|---|---|---|
| `wd_legion` | 0.9 | 0.0009 s |
| `wd_gravecall` | 1 | 0.001 s |
| `wd_fetish` | 1.1 | 0.0011 s |
| `hun_loosed` | 1.1 | 0.0011 s |
| *(the other ten)* | *900–1600* | *0.9–1.6 s* |

Three of the four are Witch Doctor summons, and **`wd_swarm` has been a standing
`tree_dps` red at +4123%** for the whole of this patch series. That is a strong
candidate for the cause. The generated line renders it honestly — `wd_legion`
reads "Its attack 12.5 every 0.00s" — rather than hiding the anomaly behind a
rounded figure.

**Not fixed here**: correcting it is a balance change that would move the DPS
gate and the tree table, and it belongs in a patch that can re-baseline them.

### 2. `radius` on a bolt is dead data

Eighteen bolts declare a `radius`. The `bolt` primitive never reads it — the
only `step.radius` uses in `js/compose.js` are `trap` (:415, :419), `hazard`
(:431, :435) and `heal` (:451).

The first version of the generator honoured it and labelled those eighteen
skills **multi-target**, which is the misleading-rather-than-terse failure this
patch exists to prevent. A bolt is now multi-target only if it carries a
`splash` rider, which takes the count from 16 to **2**. The dead fields are left
in the data and reported here.

### 3. A summon's HP scales through the *duration* increment

`js/minions.js:292` computes minion HP with `rankedDuration`, not
`rankedDamage`. That looks like a typo and is not — the comment above it records
that the Druid's depth was tuned against the `duration` increment, so a rank-1
wolf and a rank-6 wolf differ by the intended amount. The generator mirrors the
sim exactly rather than the name, so a rank-6 wolf is not advertised as a rank-1
one. Flagged because the next reader will have the same doubt.

### 4. Engine scaling is stated as a condition, not folded in

A step with `scaleWith` rides a live engine value, and so do `summonMult`, the
post-dodge `_atkBuff` and Summons on a minion's swing. A number that moved
while a player read it would be worse than one stated with its conditions, so an
engine-scaled step prints its base and names the engine and per-point rate
beside it: `Scales with shift, +6.0% per point`. The displayed damage is
therefore a **floor** for those skills.

---

## The expected duplicates did not appear

The brief anticipated that many melee skills would read nearly identically and
asked that no distinguishing language be added. **Measured: zero pairs of actives
produce an identical mechanical line.** Damage, cooldown and range differ enough
that the shape word alone was never load-bearing. Nothing was added to make them
look different, and nothing needed to be.

## What the gate checks

`tools/skilltext_gate.mjs`, 12 checks:

- every active produces a non-empty mechanical line (catches flavour-only content)
- every **damaging** active states damage, cooldown, range and shape
- every non-damaging active states its own magnitude — absorb, heal, summon, form or shift
- no `flavor` string contains a digit, checked on the loaded objects **and** on
  the source lines, so a number smuggled through a template literal is caught
- no skill still declares `desc`
- rank-1 and rank-10 views render different magnitudes — **asserted by effect**,
  because a generator that ignored its rank argument would pass every structural
  check and fail only this one
- every active previews at least one next-rank value
- no field previews a next-rank value identical to its current one
- every rendered shape is in the vocabulary
- every rider kind (18) and every passive key has a description rule — an
  unlisted one is a mechanic the player cannot see, and is reported rather than
  dropped
- every passive states an effect or carries flavour
