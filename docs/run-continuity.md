# One character, eight regions

Reproduce with `node tools/run_continuity_gate.mjs` (assertions),
`--verbose` (boss-room series), `--survey` (full routes, slow).

---

## It was a wiring gap, and the wire was the only thing missing

`js/saves.js` has been **correct and per-character since the region shell**.
`frontier` lives on the character; `onRegionCleared(character, i)` advances that
character's own; `canEnter(character, i)` gates on it; `park`/`unpark` are
per character. `js/worldmap.js` is correct too — `worldMapState` offers a
character its cleared regions plus its frontier and nothing above, and
`partyCanEnter` already answers the multiplayer question.

None of that was connected to a run.

| direction | what existed | what happened |
|---|---|---|
| **into a region** | nothing | `new Sim({...})` built every player at `level: 1` with an empty tree and no items. A character that had cleared region 1 walked into region 2 a newborn. |
| **out of a region** | `frontier`, `parked` | `character.level` was **1 for the entire history of the game** and `character.items` was `[]`, because nothing ever assigned them. |
| **after a region** | — | `hostReturnToLobby(clearChars = true)` wiped every player's `charId`, which is character select. |

So **the 1→8 progression the whole power curve is specified against had never
once been played**, and nothing was red about it. Same shape as the eight-slot
finding and the region layer before it: rule present, store present, wire
missing.

## What this patch adds

Two functions in `js/saves.js`, because that is where the brief said the API
lives and because harnesses must be able to exercise the real thing:

- **`carryInto(character)`** — the level, ranks, unspent points, items and stat
  picks a Sim needs to rebuild this character. Copies, so a Sim cannot mutate a
  save.
- **`recordRun(character, player)`** — the way back. Called on any exit that
  keeps progress: a region cleared, and now also a region *parked*, because
  levels earned in the rooms already walked are earned whether or not the boss
  died.

`Sim` takes a `carry` option and `_carryPlayer` rebuilds on top of a fresh
player. **Ranks go in through `spendSkillPoint`, not by writing `skillRanks`** —
so the prerequisite chain, the loadout auto-slot and every rank-derived engine
are built by the code a real spend uses. A save that wrote ranks straight in
would produce a character the game could not have made. `xpNext` is re-derived
from the carried level, or a level-19 character would arrive still owing the
level-2 threshold and gain nine levels on its first kill.

The results screen offers **▶ ONWARD (world map)** after a clear, handing the
same character back to the map its advanced frontier now unlocks.

## What a run is actually worth

**Region 1 today finishes around level 13–24** depending on how much of the
route is played (13 from the boss room alone; 16 across five rooms; 19–24 across
seven).

**Carried through all eight regions the character reaches level 68** — measured,
`--survey`, one character, `recordRun`/`carryInto` between every region:

| region | rooms played | level |
|---|---|---|
| 1 | 5 | 1 → 16 |
| 2 | 5 | 16 → 28 |
| 3 | 2 | 28 → 33 |
| 4 | 4 | 33 → 38 |
| 5 | 2 | 38 → 41 |
| 6 | 8 | 41 → 54 |
| 7 | 8 | 54 → 63 |
| 8 | 7 | 63 → 68 |

That is **41 rooms of a possible ~64**, so 68 is a **floor**. It already clears
the §4.3 region-8 anchor of 64, and a complete play-through would land near or
above the power curve's ~82. **The XP curve is not the problem** — it was never
being run.

*(The rooms not played are ones the bot could not finish, not rooms that do not
exist. Every one is reported rather than waited out.)*

---

## Questions the brief asked me to report, not resolve

### What happens when a character dies mid-region?

**Progress in the failed region is lost; the character keeps everything up to
its last recorded exit.** `_finish(false)` sets `win: false` and
`regionCleared: false`, and the `end` handler only records on
`win && regionCleared`. `parkCurrentRegion` — the other write — is called only
from `hostAbandonRun`, deliberately not on a wipe.

So after this patch a wipe in region 3 returns the character to the world map at
the level it finished region 2 with, and region 3 can be replayed. That is
"retained to the last cleared region", and it is roguelite-conventional. **It is
now a decision you can make rather than an accident**, because before this patch
nothing was retained from any outcome.

**One defect found while establishing this.** `main.js` says a wipe "must clear
the park rather than write one", citing §11.1 — *a failed region never replays
identically*. **No code path clears `character.parked` on a wipe.** The only
clear is in `onRegionCleared`, on success. So a park written by an earlier
abandon of that region survives a wipe, and re-entering resumes the same tree
and the same cleared nodes. Reported, not fixed: which way it should go is the
same design call as the rest of this question.

### Multiplayer

`partyCanEnter` already answers entry and the gate asserts it: a party is
refused a region **any** member has not reached, and admitted to one they all
have — carrying the members who are above it for loot and XP with no world
progress. The host's frontier is not consulted separately; every member is
checked.

**The carry itself is solo-only in this patch, and that is a real limit rather
than an oversight.** `carry` is built from `app.character`, which is the local
player's save; a joined peer's save does not travel over the wire. So in a party
the host arrives as itself and **every client still arrives at level 1**. Making
that work needs per-peer saves on the wire, which is its own patch. The
constructor already accepts an array of carries, one per party slot, so the
engine half is ready for it.

### Replaying a cleared region

**Allowed, and it grants XP and loot but no world progress.** `onRegionCleared`
returns `outcome: 'replay'` and leaves `frontier` alone; nothing gates XP on the
frontier, so kills pay normally. The world map already says exactly this
("Cleared. Replaying grants loot but no world progress.").

With `recordRun` wired, a replay's **levels and items now persist** — which is
new, and is the thing to look at if grinding a cleared region turns out to be
the efficient way to level.

---

## A tooling defect found on the way

The measurement needed a bot that can finish a room. The only one in the repo
was inside `tools/balance_probe.mjs`, unexported, and **calibrated against a
subsystem that no longer exists**: its kite ring came from `p.weapons[0]`, and
weapons were retired, so every class in every measurement kited at a flat 200.
A samurai whose skills reach 90–110 landed nothing — measured, it sat on a
cleared-able elite arena with one enemy alive for 500 simulated seconds. §13
rule 81.

It is now `tools/pilot.mjs`, shared, with three fixes, each caught by a stall:

1. **Kite ring derived from the loadout's actual reach**, not from a retired
   weapon.
2. **Obstacle avoidance for "walk to a point".** `steerTo` pushes in a straight
   line and a straight line can end in a wall: a bot cleared a room, was handed
   a hatch 148 px due north, held `my = -1` for nine simulated minutes and never
   moved a pixel. Enemies have had `_steerAround` since `patch-combat-defects`;
   the bot never did. Repulsion is taken from the **nearest point on the rect**,
   because the arena's dividing walls are long and thin (one measured 1127×60)
   and a centre-based normal points *along* such a wall.
3. **A committed tangent and an objective commit-ramp.** Signing the slide
   direction by "whichever way points at the target now" flips every tick, and
   the bot slid 5 px left, 5 px right, forever — the same failure and the same
   fix as `_steerAround`. And the kite term is summed *per enemy*, so a 30-body
   room out-votes a weight-3 objective pull by an order of magnitude: a Relic Run
   sat at 1/5 banked for 36 simulated minutes with a relic on the floor. The
   objective pull now grows while the objective makes no progress and resets the
   moment it does.

`balance_probe` imports the shared pilot and its output is unchanged. It is
otherwise stale — it still reports "floor undefined", against a four-floor model
that the region rework replaced. Reported, not fixed.

**The pilot still cannot reliably finish a Relic Run**, which is why the survey
plays 41 rooms rather than 64. Stated rather than papered over: a harness that
silently waited out the rooms it could not finish would have reported a lower
level as if it were the curve's fault.
