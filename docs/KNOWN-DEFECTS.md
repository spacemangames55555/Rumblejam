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

## Fixed, and kept here only as a pointer

**The `bounty (1p)` gate flake** was entry 2 in this file. It is fixed —
2026-08-05, `patch-bounty-unkillable-mark`. It was never a gate problem: a
Regenerating elite modifier on a Bounty Hunt mark healed 135–151 HP/s against
the 105–110 HP/s a solo player lands, so the mark was mathematically
unkillable and no budget could have covered it. A second defect, marks counted
killed when they merely left the enemy pool, was masking it. Both are gated
now. The reasoning is in `README.md` under Decisions; the measurements are in
the commit.
