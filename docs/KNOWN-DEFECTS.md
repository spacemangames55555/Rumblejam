# Known defects

Real defects that are **not** being fixed right now, recorded so the next person
who trips over one finds this file instead of rediscovering it.

Each entry states what is wrong, how to reproduce it in one command, what has
already been ruled out, and what a fix would have to do. An entry leaves this
file when it is fixed — not when someone decides it is tolerable.

**This is not a wishlist.** Nothing goes in here that is merely unfinished or
undesigned; those live in the briefs. Everything here is behaviour that is
already wrong.

---

## 1. `rushMove()` uses `Math.random()`, so a fight cannot be reproduced from its seed

**Where:** `js/entities/enemies.js`, `rushMove()` — the stall-detection detour.

```js
if (moved < 24 * 24) { // barely moved: detour somewhere open at random
  const a = Math.random() * Math.PI * 2;
```

**What is wrong.** Everything else in the sim derives from the run seed through
named sub-streams (`js/rng.js`, `subRng`). This one call does not. It fires
whenever a rushing enemy has moved less than 24u in 1.2s — which is common the
moment `wave.done` flips and survivors start pressing — so **two runs of the
same seed stop matching partway through the first real fight.**

**Reproduce — one command:**

```
node tools/determinism_probe.mjs [seed] [charId] [ticks]
```

It builds two `Sim`s on the same seed, travels both to the same `open_expanse`
combat node, ticks them side by side and reports the first tick where a
positional hash of the enemy field disagrees. It exits 1 while the defect is
live and 0 once the two runs match, so it can become a gate the day it starts
passing.

**Measured**, on a party with no Hunter and no beast in it, so none of this is
the beast's RNG:

| seed | character | diverged at |
|---|---|---|
| 4242 | `toh_druid` | tick **402** (6.70s) |
| 777 | `bulwark` | tick **431** (7.18s) |

Both land shortly after the wave-end rush begins, which is when `rushMove()`
starts running.

**What this does NOT break, and why it has survived this long:**

- **It cannot desync co-op.** The sim is host-authoritative — clients render
  snapshots and run no enemy logic — so both peers see the host's roll.
- **It does not make the test suite flaky.** Nothing in `tools/sim_test.mjs`
  asserts tick-exact equality between two runs of one seed.

**What it does break:** seed-based bug reproduction. "It happened on seed
ABCDEFG" is not currently a reproduction, and any future gate that wants
tick-exact replay — desync detection, a recorded-input regression, netcode
rollback — has to fix this first.

**What a fix looks like.** A per-enemy sub-stream, the way
`js/entities/beast.js` does it for wander points:
`subRng(sim.seed, 'rush', e.id, e.rushN++)`. The enemy id is already stable and
already deterministic, so the change is local. Check the other `Math.random()`
sites in the sim at the same time — `Sim._spawnSummon` scatters new summons the
same way (beasts already opt out of that in `initBeast`, deliberately, and the
comment there explains why).

**Not in scope for `patch-hunter-melee-beast`** (2026-08-05), which found it.
The beast's own wander is seeded and gated; that gate has to clear the enemy
field to isolate it, and the workaround is a marker pointing back here.

---

---

## 2. Regeneration scales off `maxHp`, so a high-HP entity can become unkillable

**Where:** `js/content/enemies.js`, `ELITE_MODS` — `{ id: 'regenerating',
regenPct: 0.02 }`, applied in `js/entities/enemies.js`.

**This entry is the ROOT CAUSE and it is still live.** The damage below has been
treated, not removed. Read it before adding any entity that multiplies HP.

### The shape of it

Regeneration is **a percentage of the entity's own max HP**. Player damage is a
flat number. The two diverge as HP grows, so for every build there is an HP
above which the target heals faster than it can be hurt — not slowly killable,
**never killable**.

`js/objectives.js` has `BOUNTY_HP_MULT = 10`: a Bounty Hunt mark is priced at ten
times a boss fraction. That put a floor-1 solo mark at ~6,700–7,600 HP, so:

| | |
|---|---|
| mark heals (2% of max HP/s) | **135–151 HP/s** |
| solo player lands on the mark | **105–110 HP/s** |
| net | **−25 to −42 HP/s, permanently** |

Marks sat at 98–99% HP after twenty minutes with 30,000+ damage delivered into
them. The level could not end, for any budget.

### What it looked like from the outside, and why that matters

It presented as **the `bounty (1p)` sim gate failing intermittently**, and it was
recorded in this file as a flake for exactly that reason. The gate asked *"did
the level finish inside 20 minutes"*, and a timeout **cannot tell HARD from
IMPOSSIBLE**. That ambiguity is the whole reason this survived as long as it did.

The real rate was never the "2 of 5 suite runs" first recorded here. Measured
properly on the solo objective itself: **4 of 13 runs cleared — roughly two in
three solo Bounty Hunts failed.** A second defect (marks counted killed when they
merely left the enemy pool, since fixed) was masking it by skipping past marks
nobody could kill, which is what dragged the observed rate down.

### What has been done

`regenLockS: 2` — no regeneration within 2 seconds of taking damage. Sustained
pressure shuts the healing off, so damage always wins and the breakpoint cannot
be reached while a player is attacking.

**That treats it. It does not remove it.** The rate is still a percentage of max
HP, and a target left alone still heals at the uncapped rate. The lockout works
because a player who is killing something is, by definition, hitting it.

`regenLockMult` is the fraction that still ticks while locked, and it is the dial
between two different modifiers:

| `regenLockMult` | measured healing under sustained fire | what the mod becomes |
|---|---|---|
| **0** (shipped) | ~0 HP/s | a cost to *disengaging*; free to anyone who keeps firing |
| 0.1 | 13–15 HP/s against ~102 landed | a constant tax; Regenerating marks took 84s against 69–79s for other mods |

Both were measured. 0 is shipped because it is the stronger guarantee against
unkillability; 0.1 was measured and kept documented because "the mod does
nothing to an attacking player" is a real cost of that choice.

### For whoever adds the next 10×-HP entity

**This is the thing to check.** Any new multiplier on `maxHp` — a boss variant, a
raid target, an objective anchor — re-opens the same arithmetic against any
percentage-of-max-HP effect, and the lockout only helps while the player is
actively hitting it. If the design has the target ever *not* being hit while
still needing to die on a clock, do the division before shipping it:

```
heal rate  = maxHp × regenPct
kill floor = the least damage a plausible build lands on ONE target
```

If the first is anywhere near the second, the entity is unkillable for that
build, and no timeout will tell you — only an HP-goes-down assertion will.
`tools/sim_test.mjs` now has one.

---

## 3. A `shielded` bounty mark stalled at 4p, and it is not explained

**Where:** unknown. Seen once, during the investigation above.

A `shielded` mark at 4 players sat at **84% HP after 1,071 seconds**. It fits
neither mechanism in entry 2 — `shielded` negates one hit every 3s, which is a
throughput cost and nothing like a heal, and the mark was not being counted
killed either.

**Deliberately not folded into entry 2.** It would have been easy to file it
under "the same thing" and it is not obviously the same thing; a wrong story in
this file is worse than an open question.

**Seen twice now, both at 4p, both `shielded`.** The second was during the
lockout measurement for entry 2: across a 5-run 4p sweep, **8 of 9 `shielded`
marks died and one did not**, while `regenerating` went 4/4, `volatile` 8/8 and
`magnetic` 6/6. Two sightings is not a diagnosis, but it is enough to say this
is not a one-off and not a symptom of the entry-2 defects — those are fixed and
it happened anyway.

It has never appeared in a solo run, and it has never tripped the suite, because
the suite's Bounty Hunt gate runs one seed per party size.

**Reproducing it is the first job**, and `tools/determinism_probe.mjs` (entry 1)
explains why that is harder than re-running a seed. A 4p Bounty Hunt harness with
per-mark HP logging is the tool; `bounty_regen.mjs`-style instrumentation over
enough 4p runs to catch a second occurrence is the method.
