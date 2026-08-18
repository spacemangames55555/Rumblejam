# Phase 2 precondition: what a measured character is missing

No tuning here. This is the commit that makes phase 2's numbers worth reading,
and it exists because phase 1 published four confident figures that were about
the harness rather than the game. Reproduce with `node tools/fixture_gate.mjs`.

The shared fixture is `tools/fixture_build.mjs`; the gate that keeps it honest
is `tools/fixture_gate.mjs` and it runs with the suite.

---

## The three gaps the brief named

### 1. No fixture carried items

**The rule, stated so it can be argued with: one item per shop visit, per region
reached, drawn on the shop's own rarity mix.** A level-82 character that has been
through all eight regions therefore carries **56 items**.

Why that rule and not another. `p.items` is an unbounded array — there is no
item cap — so the question is not what a character can hold but what a run hands
one, and that has two candidate bounds:

| bound | measured | binding? |
|---|---|---|
| gold | one plain combat room per region pays ~2,500 across the eight; a region's path is ~5 fights, so a run banks on the order of **12,500**. The shop's mix averages ~22 gold an item. | **no** — that is several hundred items' worth |
| shop offers | a shop opens on every arena clear, at every shop node and after every boss: roughly **7 visits a region**. `CONFIG.SHOP_SLOTS` is 4, of which the weapon guarantee eats 1–2 with cards nobody can buy. | **yes** |

So offers bind, and the rule counts visits. It is deliberately **conservative**:
it assumes a player buys one card a visit rather than clearing the rack, and it
ignores Greed's bias toward better rarities. It is a floor on what a real
character carries, not a ceiling — a tuning pass calibrated against it will
under-estimate player power, which is the safe direction to be wrong in.

What it is worth, measured on a level-82 hunter against the same ring:

| | vitality | ferocity | DPS |
|---|---|---|---|
| no items | 150 | 64 | 5,565 |
| 56 items | 196 | 87 | 8,114 |
| | **+31%** | **+36%** | **+46%** |

**Every phase-1 output figure under-reads player power by roughly that**, and the
under-read is not uniform: the same 56 items were worth +46% to a hunter and
+13% to a priest, because the catalog's on-hit terms pay per hit rather than per
second. Any band-by-band ratio computed without items is wrong by a class-
dependent amount, which is worse than being wrong by a constant.

### 2. Samurai could not be measured by a stationary fixture

**The brief's premise is half right, and the half that is wrong changes the
fix.** It said movement *and* footing triggers read 0. Measured:

- `p.stillT` accrues on its own the moment nobody presses a direction
  (`js/game.js:1830`), so `MOVEMENT mode:'still'` fires **for free** on a
  stationary fixture. Nothing was ever missing there.
- `p.movingT` resets every tick the player is not moving
  (`js/game.js:1840`), so `mode:'moving'` is the half that reads low.

Samurai has six MOVEMENT actives: four `moving` (the whole `samurai_agility`
active line) and two `still`. One tree at a time, level 82, against a mortal
ring:

| tree | still | moving | |
|---|---|---|---|
| `samurai_agility` | 174.9 | **682.4** | ×3.9 — the window a stationary fixture never opened |
| `samurai_armor` | **322.2** | 166.1 | wants `still` |
| `samurai_tactics` | **692.3** | 270.8 | wants `still` |

So no tree reads zero, and **no single window measures the class** — each of its
three trees peaks in a different one. A fixture that picks one window and reports
one number is wrong for two trees whichever it picks. `movementWindows(p)` reads
the requirement off the slotted triggers, and `bestOverWindows` runs each and
keeps the best; a class with no MOVEMENT node runs one window and pays nothing.

**How to move, and why not the obvious way.** The first version drove a slow
circle — real travel, `mx/my` rotating. It stages the trigger and it also walks
the character away from its own kit: a level-82 hunter read 8,114 DPS standing
and **417** circling, a 19× collapse about pets and placed effects being left
behind. `tree_dps` had already answered this (`tools/tree_dps.mjs:248`) by
flipping the input axis every frame, so `p.moving` stays true at ~0 net
displacement. Reused verbatim rather than reinvented, so the two fixtures cannot
disagree about what "moving" means. Cost to a hunter: **1%**. (§13 rule 89.)

### 3. Savage could not be measured against immortal dummies

**This is two accumulations, and mortal targets fix one of them.**

**(a) Per-target dot compounding — fixed.** `applyPlague` does
`plagueDps += amt / dur` while only refreshing `plagueT`, so a dot re-applied to
a body that never dies grows without limit. The class that demonstrates it is the
**witch doctor**, not the savage. Peak `plagueDps` on the target:

| | 15 s | 30 s | 45 s | 60 s |
|---|---|---|---|---|
| immortal dummies | 18 | 32 | 50 | 64 |
| mortal ring | 18 | 11 | 14 | 28 |

`mortalRing` fixes this: a body that dies takes its accrued dot with it. Its
stations are **absolute**, captured once, rather than following the player —
a ring that followed would have hidden the circling-fixture failure above.

**(b) `cascade` — not fixed, and not fixable by a fixture.** The savage's own
unboundedness turns out not to be plague at all. `cascade` is uncapped **by
design** (§8.3), fed by firing *variety* rather than by kills, and decays only
after `CASCADE_IDLE_SECONDS` of no fires at all — so it ramps against anything,
mortal ring included. Twelve savage steps carry `scaleWith: 'cascade'`, and
`js/compose.js:54` turns an engine into a **linear damage multiplier with no
ceiling**.

Level-82 savage on a mortal ring, 20 s windows:

| 20 s | 40 s | 60 s | 80 s | 100 s | 120 s |
|---|---|---|---|---|---|
| 4,325 | 5,663 | 8,981 | 12,303 | 16,674 | **19,896** |

×4.6 and still rising, cascade 1,155. Hunter control over the same 120 s:
8,114 → 8,136, flat.

The design's safety argument for leaving cascade uncapped is about the
**cooldown** term, which is asymptotic to `CASCADE_CD_FLOOR` and genuinely
bounded — still above half at rank 1000. It does not cover the **damage** term,
and the damage term is the one that runs.

Two consequences, kept separate on purpose:

- **Measurement (fixed here):** a savage number is meaningless without its
  window, so every fixture states one. `MEASURE_SECONDS = 20`, against a ~45 s
  region-8 room.
- **Design (reported, not fixed):** whether an unbounded damage term is intended
  is a tuning ruling. It is not a fixture's call and it is not in this commit.

---

## Also in this commit: the deferred slot re-pin

`ARM_LEVEL = 12` and `DPS_LEVEL = 12` both meant "three loadout slots". When the
ladders merged in `patch-skill-level-gates`, 12 became **four** slots and both
fixtures silently changed what they measured while the literal sat there looking
deliberate. `levelForSlots(n)` is now exported from `js/skills.js`, asserted as
the exact inverse of `slotsAtLevel` in `assertTrees()`, and both fixtures declare
`ARM_SLOTS = 3` / `DPS_SLOTS = 3` — level 5.

**What moved, with a cause for each:**

| check | before | after | cause |
|---|---|---|---|
| Statue Test × 4 (`artillery`, `flanker`, `puddle`, `mixed` on `open_expanse`) | RED — statue survived | **green** | the check asserts a median statue *dies*; at four slots it stopped dying. Three slots restores the fixture's meaning. |
| DPS gate | 3 outliers | **6 outliers** | roster spread widened from [26.4, 60.7] to [23.4, 74.0]. At three tiers, classes whose damage lives deeper read low. |
| Assassin contract | green | green (rewritten) | see below — it was flaky at every level and passed on seed luck. |

**The DPS gate's dispersion is a calibration question, now visible.** A gate that
flags 43% of its population discriminates less than one flagging 21%. Pinning to
slots is what the brief asked for and it is the right *kind* of pin; whether the
right *number* is three slots or four is a ruling for whoever owns the gate. Four
slots (level 11) would reproduce the old tier reach exactly — level 11 and level
12 both grant 5 tiers and 4 slots — so the alternative is a one-line change.

**The Assassin contract check was never about the level.** It read
`p.contractId !== null` at the last tick of an 8 s run. A contract clears the
moment its target dies and re-arms after `remarkDelay`, so an Assassin who is
killing things is unmarked for **32–69%** of a fight. Sampled across five seeds:

| level | 5 | 8 | 11 | 12 | 15 |
|---|---|---|---|---|---|
| seeds marked at the final tick | 1/5 | 3/5 | 3/5 | 3/5 | 3/5 |

It failed on 2 of 5 seeds at *every* level including the old one; seed 4242
happened to land on the right side at 12 and the wrong side at 5. The re-pin did
not break it, it exposed it. It now counts marks over the window and checks each
one names a live enemy, which is what "marked and tracked" means. (§13 rule 88.)

---

## What is still not modelled

Stated so it is not mistaken for covered:

- **Trait and boon state.** Out of scope for this fixture. A character's boons
  are picked from offers during a run and the fixture does not stage them.
- **Greed's bias on the shop roll.** Ignored, which errs low (see above).
- **Regions 3–8 have no authored rosters** and fall back to the base table, so
  any per-body figure for them is provisional and must be re-checked when real
  rosters land.

New §13 rules from this commit: **87** (pin the meaning, derive the number),
**88** (do not photograph a churning state), **89** (staging must not cost the
thing being staged), **90** (an uncapped engine is bounded only on the term its
safety argument covers).
