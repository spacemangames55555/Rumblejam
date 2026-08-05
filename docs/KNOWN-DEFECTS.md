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

## 2. The `bounty (1p)` sim gate fails intermittently — measured 2 runs in 5

**Where:** `tools/sim_test.mjs`, the solo objective sweep.

```
✗ bounty (1p) never cleared in 20 minutes: {"type":"bounty","done":false,
  "killed":4,"need":5,"markHp":0.99...}
```

**What is wrong.** A solo Bounty Hunt does not reliably reach 5 marks killed
inside the 20-minute sim budget. The failure shape is consistent across runs:
**`killed` lands at 1–4 of 5, `streamKills` is in the low hundreds, and the
live mark is at ~99–100% HP.** The player is clearing the endless stream fine
and is not killing the mark.

**Reproduce:** `node tools/sim_test.mjs`, several times. It is not deterministic
— this is the same defect as entry 1 showing up as a symptom — so a single
green run proves nothing about it, and neither does a single red one.

**Rate, measured rather than estimated.** Five consecutive runs at
`origin/main` (`7c75911`, before any of the beast work): **2 failed, 3 passed.**
Informally it has looked closer to half over ~10 runs across branches. Treat it
as "fails often enough that a green suite is not evidence" and not as a precise
number — establishing the real rate is part of the work, not a prerequisite for
starting it.

**What has been ruled out.** It is **not** caused by the Hunter's melee beast
patch: the five baseline runs above predate it, and no `js/` file the bounty
path touches is in that diff. It is also not the art pipeline — it was already
failing across the whole `patch-art-pipeline` sequence, where every commit was
assets and docs only.

**Why the rate is the interesting part.** A gate that fails this often is not a
flake to be re-run past; at face value it says solo Bounty Hunt fails to clear
in 20 minutes a large fraction of the time at the tuning the sim asserts. Either
the objective is mistuned for one player or the gate's budget is wrong, and
**which one it is has not been established.** Whoever picks this up should
answer that first rather than widening the timeout — widening it makes the gate
green and leaves solo players with an objective that takes 20 minutes.

Start at `js/objectives.js`, the bounty mark's HP (`bountyAnchor`) against
`sim.coopHp` at one player, and its re-spawn cadence versus the stream.

**Consequence today:** the sim suite's exit code cannot be trusted as a
pass/fail signal on its own. Every report in this repo that says "suite green
apart from the bounty flake" is leaning on this entry.
