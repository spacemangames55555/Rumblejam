# Known defects

Real defects that are **not** being fixed right now, recorded so the next person
who trips over one finds this file instead of rediscovering it.

Each entry states what is wrong, how to reproduce it in one command, what has
already been ruled out, and what a fix would have to do. An entry leaves this
file when it is fixed — not when someone decides it is tolerable.

**This is not a wishlist.** Nothing goes in here that is merely unfinished or
undesigned; those live in the briefs. Everything here is behaviour that is
already wrong.

**One exception to "an entry leaves when it is fixed"**, at the bottom of the
file: a *closed* section for defects whose reproduction is worth keeping because
the failure shape recurs. Those entries name the gate that now holds them, so a
regression is findable by the same steps rather than rediscovered.

---

## 1. RESOLVED — `Math.random()` in the simulation broke same-seed reproduction

**Fixed 2026-08-06.** Moved out of the open list because it is fixed and gated,
not because it was tolerated.

**What it was.** This entry named `rushMove()`'s stall detour as the one call
drawing from `Math.random()` instead of the seeded stream. It was **43 calls**
across `js/game.js` (29), `js/entities/enemies.js` (15), `js/telegraphs.js` (1)
and `js/traits-toh.js` (2) — spawn jitter, cooldown scatter, proc chances, the
the Dodge roll, material scatter, wander points, boss teleport targets.

**What it cost, concretely.** Every A/B comparison in patch-region-shell needed
three runs to say anything, because one run proved nothing. It produced at least
two wrong conclusions in a single session: `elite_arena (1p)` was reported as a
regression when it flips between runs on both branches, and a co-op fix was
credited from one clean run out of three.

**The fix.** `Sim.rng`, a seeded stream created from the run seed, and every one
of the 43 routed through it. One shared stream rather than named sub-streams:
sub-streams stop systems perturbing each other, which matters for CONTENT rolls
(layout, shop stock, offers) and those keep theirs — these are per-tick
incidentals whose order is already fixed by tick order.

`initTelegraph(sim, e)` now takes `sim` as a REQUIRED first parameter rather
than defaulting when a caller forgets, which is how this survived four patches.

**What holds it now** — `node tools/determinism_test.mjs`:

| gate | asserts |
|---|---|
| six configurations | the WHOLE SNAPSHOT every 60 ticks is byte-identical across two runs — both rosters, region and non-region, two players with scripted but *different* inputs so movement and dodge paths actually run |
| negative control | a *different* seed produces a *different* run, so the comparisons are not vacuously true |
| the lint | zero `Math.random()` in any of the 13 simulation modules, comments stripped first — routing 43 calls is worth nothing if the 44th goes back in |

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

---

# Closed — kept for the reproduction

Fixed, and gated. Here because the failure shape is one that recurs, so a
regression should be findable by these steps rather than diagnosed from scratch.

## 11. Players deal no damage in the co-op run, and take it normally

**Fixed 2026-10-23.** Weapons are gone, so a character with nothing slotted
deals nothing, and the co-op run was full of those characters. Both players'
`damageDealt` stayed at 0 while enemies hurt them. The fight could not be won,
so every later wait — host run, extraction shop, fight clear — timed out under
its own name.

### What a player saw

A two-player run. Enemies shoot and connect. Neither character's damage tally
moves, on the host, for the whole fight:

```
✗ no organic damage dealt on touch within 15s
✗ damage tallies: {"d0":0,"d1":0,"hurt":true}
```

`hurt: true` is the enemies working. `d0` and `d1` are `players[0]` and
`players[1]` `damageDealt` on the host sim. The client draws whatever that sim
puts on the snapshot, so a zero there is a zero on both screens.

### Root cause

Skills are the only damage source. `CONFIG.WEAPONS_ENABLED` is false,
`weaponSlots` is 0, and `_tickWeapons` is never called. Skills come from trees,
and `treesFor(p)` keys off `charId`.

The classic roster was the default, and none of its 33 characters had a tree.
A party of them walks into the arena, gets shot, and has nothing that can fire.
Where a tree existed the engine already worked — learn, auto-slot, kill — which
is why the fix does not live in the trigger core. `offence_test` measured that
on `toh_necromancer` (necro_blip, 80 damage, 4 kills) and `toh_samurai`
(sam_cross_guard, 162, 4 kills) while the other 45 characters scored 0.

Two things kept a patch from seeing it:

- `sim_test` cleared every fight with `nuke()` (`damageEnemy(e, 900, {owner: p})`
  on a timer). A harness that kills the enemies cannot tell whether the player
  can. That is now `clearFieldForSetup`, and `assertPlayerCleared` refuses a
  combat claim off a sim it has touched.
- `CHAR_BY_ID[id] || CHAR_BY_ID.bulwark` turned an id from the other roster into
  bulwark with bulwark's stats and the original `charId`. The trees, keyed off
  `charId`, did not follow, and nothing threw.

The roster retirement (one ToH roster, unknown id throws, selectability derived
from `TREES_BY_CLASS`, a load assertion that every selectable class has a
damaging tier-1 active) removed the silent fallback and the 33. It was written
into this entry and left here, because at that commit only `toh_samurai` and
`toh_necromancer` had trees and the other twelve could not be chosen. Those
twelve trees are in the tree data now. All 14 classes are selectable, each
tier-1 active deals damage, and `_offerOpening` / the opening card is what puts
that active on the bar. The anti-softlock floor still exists and still has to
stay at 0 on this path: a run that only fights because the floor fired has not
offered the player the choice.

Measured on the pinned seed `424242`, standing still, card answered, both
players, every one of the 196 pairs: both `damageDealt` counters are above 0
inside 22s and `openingFloored` is 0. The recorded browser pair is blacksmith
hosting and wizard joining on that same seed, each clicking their own opening
card: both deal damage, the party is hurt, and the client's decoded snapshot
shows an enemy below full HP.

A three-second read right after the arena opens is still 0,0. That is the
onboarding walk, not an unarmed party — the first spawn is still crossing the
ring. The entry's own caution stands: a window that short accused working
classes once already. The gate waits for the damage or for 30s, and it says
when the arena never presented an enemy.

### Why the suites missed the co-op half

`offence_test` is one player and never ticks the consent vote. A 2-player
`pickNode` only starts the vote; a harness that does not tick it never enters
the arena and reports a different failure. The browser co-op tally slept 3
seconds and still named retired ids (`banneret`, `lodestone`, `facet`), and
`startRun` in both `tools/browser_test.mjs` and `tools/cdp_harness.mjs` clicked
`.world-card`, which the world map no longer renders. The helper threw
`no region N card` before a fight existed, so the tally could not go green or
red. The card is `#world-enter` on the selected `.world-pin`.

### Reproduce (pre-fix)

Start a 2-player run with a character whose `charId` has no tree (any archived
classic id, before the throw), or empty both loadouts after the door and before
the fight. Tick 20 seconds.

```
✗ damage tallies: {"d0":0,"d1":0,"hurt":true}
```

The negative control in the gate does the second of those on samurai + monk and
requires the zero, so a counter that moves without a slotted skill cannot pass.

### What holds it now

| gate | where | asserts |
|---|---|---|
| co-op offence, every pair | `tools/coop_offence_test.mjs` | all 196 selectable pairs, seed 424242, card answered, vote ticked, both `damageDealt` > 0 inside 22s, `openingFloored` === 0 |
| the wire | same file | a decoded snapshot shows an enemy below full HP |
| negative control | same file | samurai + monk with loadouts cleared at the door stay at 0 |
| the recorded tally | same file | blacksmith + wizard on that seed deal damage and are hurt |
| a real session | same file | two browsers, local relay, blacksmith hosting and wizard joining, seed 424242, each clicks the opening card, `startRun` enters region 1, both tallies move, the party is hurt, and the client snapshot shows a wounded enemy or a hit |

`node tools/offence_test.mjs` still holds the solo half: every selectable class,
the card rather than the floor, and a retired id throws.

---

## 4. The boon panel could open with no exit, softlocking a solo touch run

**Fixed 2026-08-05.** Three separate defects stacked into one unrecoverable
state. Each is gated; each gate has a negative control recorded below.

### What a player saw

Blacksmith, solo, phone. Floor 1/4 Cramped Crypt, Skirmish, level 9. The room is
cleared, the crystal-infusion panel appears, they tap a crystal — and the panel
stays. Every further tap does nothing. The run is over: they cannot dismiss it,
and they cannot walk to the hatch, because the panel is also sitting on the
joystick.

### 4a. The close event was never sent — `js/game.js`, `uiAction` case `'boon'`

```js
p.boonOffer = null;
if (tohTakeBoon(this, p, pick)) return;   // ← Blacksmith exits HERE
...
this.pushEvent({ k: 'boonDone', idx });   // ← never reached
```

`boonDone` is the panel's **only** exit (`js/main.js`, `case 'boonDone'`). The
Blacksmith's crystal path returned before it. The offer was already consumed on
the line above, so every later tap died on `if (!p.boonOffer) return`.

Three traits share this overlay — Facet (`prism`), the Druid (`wildshape`) and
the Blacksmith (`crystal_infusion`). Two closed it. One did not.

**Why the suites missed it for so long:** `drain()` in `tools/sim_test.mjs`
answers offers by reading **sim state** (`p.boonOffer`), and the broken path
cleared that state too. All 33 characters "cleared their first fight" with a
stuck panel on screen. The browser suite tapped a boon card — as Facet, the one
character whose path worked.

**Reproduce (pre-fix):** restore the `return` above and run

```
node tools/sim_test.mjs
```

Section 13 reports, naming the character and the path:

```
✗ SOFTLOCK — panel opened with no exit:
    toh_blacksmith → overlay-boon (opened by 'boon', crystal offer, never closed)
```

with `306 panels opened across 47 characters` on the line above, so the gate is
not passing vacuously. Section 13 drives the **event stream**, never sim state,
because the event stream is the only thing a client can close a panel from.

### 4b. `pointer-events:none` on the strip never applied — `css/style.css`

```css
#ui-root > *{pointer-events:auto;}          /* (1,0,0) — wins */
.overlay.overlay-boon{pointer-events:none;} /* (0,2,0) — loses */
```

An id in the selector outscores two classes, so the wrapper — `position:absolute;
inset:0` — captured **the entire viewport** whenever the strip was up, not just
the area under the panel. The source comment claimed the opposite ("lets clicks
pass through everywhere except the panel itself"), which is what the code
intended and never did.

Invisible on a keyboard, where movement is WASD. On touch it killed the joystick
outright, everywhere on screen, from the moment the strip appeared until a pick
was made. Fixed by giving the rule an id of its own:
`#ui-root > .overlay.overlay-boon{pointer-events:none;}`.

**Reproduce (pre-fix):** drop the `#ui-root > ` prefix and run
`node tools/browser_test.mjs`:

```
✗ the boon strip swallowed the joystick: thumb at (426,354) moved the player 0.0 units;
  panel occupies y 158–306 of 393
```

### 4c. The panel sat in the thumb zone — a layout rule, not a Blacksmith bug

The strip is `align-items:flex-end`, and the joystick **floats** — `js/touch.js`
anchors it wherever the first finger lands on the canvas, and in landscape a
thumb lands low. On a phone the bottom ~20% of the screen is input territory, so
a `pointer-events:auto` panel there eats the movement finger with nothing on
screen to explain why.

This is a rule about the band, not about one panel:

> An overlay that leaves the game playable underneath it (`pointer-events:none`
> on the wrapper) must keep its interactive panel clear of the bottom 20% on
> touch. An overlay that blocks owns the whole viewport by design and must
> instead have an exit.

`overlay-boon` is the only non-blocking overlay today — no other overlay uses
`.boon-panel`, and the other four (`levelup`, `shop`, `treasure`, `sheet`) are
centred, full-screen, blocking modals. The rule is written for the class of
overlay, not for this one, and the gate enumerates `.overlay` out of the live DOM
so a new one is covered the moment it exists in the markup.

Fixed with `body.touch-on .overlay.overlay-boon{padding-bottom:calc(20vh + 8px);}`
— desktop keeps the bottom-hugging design, touch lifts it above the band.

**Reproduce (pre-fix):** remove that rule and run `node tools/browser_test.mjs`:

```
✗ overlay-boon: non-blocking panel reaches y=379, inside the bottom 20%
  (below y=314) — it will swallow the joystick thumb
```

### Co-op, for the record

Reachable in co-op — the stuck player is stuck — but it does not end the session.
`hostTick` has no overlay gate, so the sim runs regardless, and `_tickExtract`
(`js/game.js`) needs **any one** live player on the portal, not all of them. An
ally can still finish the level. Solo on touch is where it is terminal.

### What holds it now

| gate | where | asserts |
|---|---|---|
| overlay exits | `tools/sim_test.mjs` §13 | every panel that opens emits its close event, across **all 47 characters in both rosters** |
| overlay wiring | `tools/sim_test.mjs` §13 | every `.overlay` in `index.html` has a `show*`/`close*` pair and either a host close event or a `#x-close` control |
| driver coverage | `tools/sim_test.mjs` §13 | every `.overlay` has a driver in the gate — a new overlay **fails** rather than being skipped |
| thumb-zone band | `tools/browser_test.mjs` | every non-blocking `.overlay`, enumerated from the DOM, keeps its panel above `0.8 × innerHeight` |
| live joystick | `tools/browser_test.mjs` | a thumb at 90% screen height moves the player **while the strip is up**, and does not dismiss it |

The overlay list is scraped from `index.html` and the open/close events from the
`case` bodies in `js/main.js`. Nothing here is hand-maintained, deliberately: a
written-down list is how the asset-loader namespace whitelist went stale and how
the hitbox gate stopped catching things. If a new overlay can be added without
the gate covering it, the gate will rot.

---

## 5. Every siege crashed the host the moment its boss spawned

**Fixed 2026-08-06.** Introduced by `patch-telegraphs`, found by
`patch-region-shell`, never merged to `main`.

### What happened

`js/telegraphs.js` read `e.def.telegraph` in five places without a guard. The
siege boss does not have a `def`:

```js
// js/game.js, _spawnSiegeBoss()
Object.assign(e, {
  id: ++this.spawnCounter, def: null, typeIdx: -1, boss: true, bossDef: def, ...
```

So `tickTelegraphs()` threw `TypeError: Cannot read properties of null (reading
'telegraph')` on the first tick after a boss existed — on **every siege, on
every floor**. Not an edge case; the mid-siege boss is the point of the siege.

### Why it survived a whole patch

The legacy suite was hanging at §9i on seven `while (p.weapons.length < 3)`
loops that could never terminate once `weaponSlots` was 0, so the only evidence
anyone had was a **partial** log that stopped before the siege runs. The
telegraph suite passed in full — it stages single enemies in cleared rooms and
never reaches a boss. Two green-looking suites, neither of which had executed
the failing line.

*The lesson is not "add a boss test". It is that a suite which stops early is
not a suite that passed, and a partial log must be read as unknown rather than
as clean.*

### The second instance of the same shape

Enemy slots are **pooled**. `spawnEnemyById()` cleared the objective flags on
reuse but not the telegraph fields, so a recycled chaff slot could inherit
`telState: WINDUP` from the slabjaw that held it last. `tickTelegraphs` skips it
(no `def.telegraph`) and it sits in WINDUP forever — until a stun rider calls
`cancelTelegraph()` on it and dereferences the same missing block. Found by
Unsheathed's stun landing on a recycled skulker.

**Reproduce (pre-fix):**

```
node tools/telegraph_test.mjs
```

```
✗ a siege boss crashed the tick: TypeError: Cannot read properties of null (reading 'telegraph')
```

### What holds it now

| gate | where | asserts |
|---|---|---|
| boss ticks | `tools/telegraph_test.mjs` | a real siege is driven to a real boss spawn and ticked 4s **with it alive**, and the boss is confirmed outside the telegraph system rather than accidentally inside it |
| pooled reset | `js/game.js`, `spawnEnemyById()` | `telState/telT/telZone/telCaught/telCd` are cleared on every spawn, beside the objective flags that taught the same lesson |
| single reader | `js/telegraphs.js`, `telegraphOf()` | one helper answers "does this entity telegraph"; nothing in the file reads `e.def` directly, so a sixth call site cannot reintroduce the dereference |

---

## 6. The shop stocked weapons no character could equip

**Where:** `js/config.js` `SHOP_WEAPON_CHANCE: 0.3`, and every shop-stock roll
that reads it. Introduced by `patch-trigger-core`, which set `weaponSlots: 0`
and removed weapons as a source of damage but left the shop generating them.

**What is wrong.** Measured over 400 seeded shops on floor 1:

```
SHOP_WEAPON_CHANCE = 0.3
slot 0 is a weapon in 128/400 shops (32.0%)
at least one weapon in stock: 400/400 (100.0%)
player weaponSlots at spawn: 0
```

**Every single shop** offers at least one card that cannot be bought by anybody.
Tapping one spends nothing and prints `Can't buy: no weapon slots`. That is a
live player-facing defect — materials are the run's only currency and a third of
the storefront is inert — not merely a test artifact.

**Reproduce — the observable a player sees:**

```
node tools/browser_test.mjs
```

Roughly one run in three:

```
✗ tap purchase failed (408 unchanged) — diag: {"shop":true,...,"stock0":{"kind":"weapon","id":"sparkbolt",
  "tier":1,"price":22,...},"toasts":"...\nCan't buy: no weapon slots","weapons":0,"slots":0}
```

**This is what made the browser suite look flaky, and it is not defect #1.** The
suite taps card 0 unconditionally; the roll decides whether that card is
purchasable. Observed failing on `sparkbolt` and on `fanblade`, and passing on
the runs where slot 0 rolled an item — a 32% failure rate against a 4↔5 failure
count that flickered across four runs in two trees. Nothing about it is
non-deterministic given the seed; the harness simply does not pin the stock.

**What has been ruled out.** Not `rushMove()` (defect #1) — no enemy movement is
involved, the shop is a map-phase overlay. Not a timing race — the 3s
`waitFor` expires because the purchase is *refused*, and the refusal toast is
already on screen when the diagnostic runs. Not a touch-input problem — the same
tap succeeds whenever slot 0 is an item.

**What a fix would have to do.** Decide what a shop sells now that weapons are
gone. Either drop `SHOP_WEAPON_CHANCE` to 0 and backfill those slots with items,
or make weapon cards unofferable while `weaponSlots` is 0 — the second keeps the
code path alive for a future in which something can hold a weapon again. Whatever
is chosen, the browser gate should pin the stock rather than tap whatever rolled,
so that a real purchase regression is distinguishable from a stock composition.

**FIXED 2026-08-06.** It was not a design question — weapons are removed from
the game, so a shop stocking one is simply a bug. Shops stock stat items only,
from the existing pool; no new item category was introduced, because the
stat/modifier split is phase 4 and is not being pulled forward to paper over
this.

The gate is `Sim._stocksWeapons(p)`, which reads `p.weaponSlots > 0` — the
player's real state, not a `WEAPONS_REMOVED` flag that could go stale. Every
weapon branch consults it: the base roll, the per-shop weapon minimums, the
Quartermaster's all-weapon rack, the Overseer's summon rack, the Gilded One's
top-tier shelf. All fall through to items.

One hole had to be closed for the predicate to be trustworthy: `js/traits-toh.js`
handed the Necromancer four weapon slots back *after* `_makePlayer` zeroed them
for the whole roster — the only exception in an otherwise total removal, and the
source of all 48 remaining weapon-stocking shops in a 2256-shop sweep. Nothing
depended on it: `_startingGear` is short-circuited so the Necromancer never
receives a weapon, and the Marrownaut payoff reads `sim.summons` for a fused
tier-IV summon, not a mount.

Measured after the fix: **0 of 2256** shops stock a weapon, across 47 characters
in both rosters, four floors, base roll plus three rerolls each. Held by
`tools/sim_test.mjs` §16, which asserts the rule ("no stock entry may be a kind
the player cannot hold") rather than the literal string `weapon`, so it survives
the phase-4 category split.

---

## 7. RETRACTED — the browser suite was never destructive; I committed its fixtures

**Retracted 2026-08-06, same day it was filed.** This entry claimed the suite
deleted committed sprite art on every run. **It did not. There was no committed
art at those paths, and there still isn't.**

### What actually happened

`tools/browser_test.mjs` writes three scratch fixtures — an 8-direction grid, a
flat magenta square, a two-tone 32×32 — to `assets/sprites/enemy/skulker.png`,
`assets/sprites/enemy/flit.png` and `assets/sprites/fx/material.png`, then
removes them. The enemy and fx sheets **do not exist yet**; the manifest carries
their ids and the tests assert they resolve to null. Creating and deleting
scratch files at those paths is correct, and the original comment — *"Remove
ONLY the files this test wrote"* — was accurate.

I read that comment as wrong, swept the fixtures into the repository with
`git add -A`, and then built machinery to preserve them as if they were art.

The evidence I should have gathered before filing, not after:

```
$ git log --all --oneline -- assets/sprites/enemy/ assets/sprites/fx/
bb99b9f Dump client state when the co-op map screen never appears   <- my own commit

$ ls -l + PNG headers
assets/sprites/enemy/skulker.png    128x1024   2512B  <- directionGrid(), the fixture
assets/sprites/enemy/flit.png       128x128     356B  <- flat magenta, the fixture
assets/sprites/fx/material.png       32x32      107B  <- flatAsymmetric(), the fixture
```

One `git log --diff-filter=A` would have shown the files entered the repository
in my own commit, hours after I started calling their deletion a defect. Their
dimensions and byte sizes are exactly what the generators produce.

### What it broke

Committing them made `enemy.skulker` resolve to a 2.5 KB synthetic grid, which
broke two sprite tests that had been passing:

```
✗ registry state: {"size":304,"missing":281,"hit":1}     <- expects enemy.skulker to have NO file
✗ sprites=off pixel [226,80,76] != baseline [80,200,40]  <- the "primitive" baseline drew the fixture
```

Confirmed by running the pre-change commit with the files present: both
reproduce, so the cause is the files, not any code change.

### What was kept

- The fixture snapshot/restore, which is inert while nothing is committed at
  those paths (records null, deletes — the original behaviour) and becomes
  useful the day real art lands there.
- The spanning `try/finally`, so cleanup runs on every exit path rather than
  only the last inner `finally`.
- `assertCleanTree()` at both suite exits. The gate is still right for its own
  reasons — a suite that dirties the tree has failed — and it is what would have
  caught the fixtures being left behind in the first place.

The `restoreFromGit` helper was removed. It existed only to resurrect files that
should never have been committed.

### The lesson

Three separate signals said "these are test fixtures" — the byte sizes, the
dimensions matching `E_CELL`/`E_GRID` exactly, and the fact that no enemy art
has ever been generated — and I read a stop-hook nag about uncommitted changes
as proof of a destructive test instead. *Check whether a file is art before
defending it as art.* `git log --diff-filter=A` is one command.

---

# Open

## 8. Client input has no delivery guarantee, no repeating channel, and nothing to heal from

**Where:** `js/net.js` `ClientTransport.send()`.

**Scope corrected 2026-08-06.** This entry originally blamed host→client event
delivery. Half of that is now fixed and the half that remains is the *other
direction*, which the original diagnosis had backwards.

### What was fixed

In-run state (node map, arena geometry and obstacles, pending picks, boss phase,
run-over, loadout) moved out of one-shot events and into `snap.st`, which
repeats 15x/s and therefore heals on the next frame. Lobby state got a 3Hz
heartbeat (`CONFIG.LOBBY_HEARTBEAT_HZ`) for the same reason — the lobby has no
snapshot stream, so it needed a repeating channel of its own.

Both are gated: `tools/snapstate_test.mjs` runs every case with `pushEvent`
replaced by a sink, so **no event is delivered at all**, and the snapshot must
still carry everything.

### What is still broken, and why the first diagnosis was wrong

`client ready` still fails intermittently in `browser_test.mjs --coop`, **with
the drop counter reading zero**. That reading was true and useless: only
`HostTransport` was instrumented, and the failing path is
`ClientTransport.send` — the client clicks ready, the host never sees it.

Everything a client does leaves by that method: character pick, ready, node tap,
buy, loadout change. It has:

- **no delivery guarantee** — a not-open channel or a throwing send is a
  permanent loss (now logged and counted, previously silent);
- **no repeating channel** — the lobby heartbeat repeats HOST state to clients
  and does nothing for input travelling the other way;
- **nothing to heal from** — snapshots are host-authored, so there is no stream
  a client can re-derive its own unsent intent from.

**Reproduce:**

```
node tools/browser_test.mjs --coop
```

Observed across three runs after the state fix and the heartbeat:

| run | outcome |
|---|---|
| 1 | full co-op sequence to the end |
| 2 | `room registration failed against local relay` (see #9) |
| 3 | `timeout waiting for client ready` — this defect |

### Fixed: resent until acknowledged, applied once per sequence number

The heartbeat pattern does not transfer to this direction, and the reason is
worth stating because it decided the shape of the fix. Host state repeats
safely because repeating it is **idempotent** — the same roster applied twice is
the same roster. Input is not. `ready` toggles, so a second delivery of one
press un-readies the player who made it. Repetition alone would trade a lost
action for a phantom one.

So the two halves are split:

- **The client repeats.** Every `ui` message carries `useq`, a per-connection
  sequence number, and stays in `app.uiPending` until the host acks that number.
  `clientPump` (already running at 30 Hz) resends anything unacked for
  `UI_ACK_RESEND_MS`, gives up loudly after `UI_ACK_GIVEUP_MS`, and refuses to
  queue past `UI_ACK_MAX_PENDING` — an unbounded pending list is a memory leak
  wearing a reliability costume.
- **The host does not repeat the effect.** `hostHandleUi` keeps a per-peer
  high-water mark and applies a sequence number once. A duplicate is
  **acknowledged and discarded**, because from the host's side a duplicate is
  what a *lost ack* looks like: the action landed, the reply did not, and the
  client is asking again. Staying quiet would leave it resending until it gave
  up on something already done.
- **A departing peer's mark is forgotten** in `hostDropPeer`. A reconnecting
  client counts from 1 again; a stale mark would have the host discard its first
  actions as duplicates — a lobby that lets you in and then ignores every button
  you press.
- **`hello` self-heals off the lobby heartbeat.** It is the one client message
  that cannot be acked, because until it lands the host does not know the peer
  exists. Instead the client watches the heartbeat's roster for itself and says
  hello again if it is missing — reusing a channel that already exists rather
  than inventing a second protocol.

The host's own input never touches any of this; it is applied inline.

Counters: `window.uvNet.uiResends`, `.uiDuplicates`, `.uiGaveUp`,
`.helloResends`.

### Verified

`node tools/uiack_test.mjs` — two real pages over the local relay, driving the
real `#btn-ready` button, with the client's channel broken at the transport:

| check | result |
|---|---|
| an acknowledged action leaves nothing pending | pass |
| a press during a broken channel does **not** reach the host | pass (the failure is real, so what follows means something) |
| it lands after the channel recovers, **with no second press** | pass — 2 resends |
| 8 swallowed acks → 8 duplicates at the host, `ready` toggles **once** | pass |
| a replayed old sequence is acked and not re-applied | pass |
| a real disconnect clears the host's high-water mark | pass |

`ready` is the probe throughout precisely because it toggles: an idempotent
action would pass with or without the dedupe and prove nothing about the part
that is hard.

### The wild run says the ack is not the cause of this symptom

Once §10 stopped ending the co-op phase early, eleven full co-op runs became
possible. `timeout waiting for client ready` reproduced, and the ledger read:

```
host:   {present:true, ready:false, charId:"lodestone", n:2, seen:"c6bcc6:4", conns:1}
client: {uiSeq:4, pending:[], open:true, drops:0, resends:0, myKey:"c6bcc6"}
```

The host's per-peer high-water mark is **4** and the client's sequence counter
is **4**. Nothing pending, zero drops, zero resends, zero duplicates, channel
open, and the pick applied. **Every message the client sent was delivered and
applied** — and `ready` is still false.

`hostHandleUi` does `p.ready = !p.ready`, so it was toggled an EVEN number of
times. That is not a lost message, which is the only thing the ack addresses.
The fix above is correct for what it covers and `uiack_test.mjs` proves it
under injection, but **it does not explain this symptom and must not be
credited with it.**

Two mechanisms remain, and they want opposite fixes:

1. **One press became two messages** — a double-fired handler on the client.
   The toggle would not be the cause, and making `ready` idempotent would hide
   a UI bug rather than fix it.
2. **A second, distinct `ready` arrived from somewhere else.** Not a duplicate
   delivery: `uiDuplicates` is 0, so the dedupe never saw a repeated sequence
   number.

Neither ledger can separate them — the ack answers "did it arrive", not "how
many times did one click become a message". `window.uvNet.uiLog` (every `ui`
the client sends, in order) and `window.uvNet.uiApplied` (every one the host
applies) now record exactly that, and the failure dump prints both. It has not
reproduced since they were added: 1 failure in the 7 runs after the assertion
was split, against 3 in the 4 runs before it. **That spread means the rate
itself is not measurable at these sample sizes, and no conclusion should be
drawn from a quiet run.**

**Do not "fix" the toggle yet.** Sending an explicit `ready` value instead of
flipping is the obvious change and may well be right, but two diagnoses of this
defect have already been overturned by the next measurement, and both times the
cause was choosing the fix before the data.

---

## 9. Room registration fails against the local relay, before any peer exists

**Where:** unknown. `js/net.js` `HostTransport` room creation, `tools/peer_relay.mjs`,
or the harness's relay probe.

**What is wrong.** One co-op run in three or four never gets a room code at all:

```
✗ room registration failed against local relay
```

The harness boots the relay, probes `/peerjs/id` until it answers, and only then
opens the host browser — and it retries registration once before failing. So
this is not a naive startup race, and it is not the retry being absent.

**Separate from #8.** No peer exists yet, so nothing has been sent or dropped;
the drop ledger is clean on these runs. Recorded as its own entry specifically
so it stops being absorbed into "co-op is flaky", which is how it stayed
invisible while two other distinct failures wore the same description.

### What was measured

`tools/room_reg_test.mjs` drives `HostTransport.createRoom()` directly against
the local relay, with no lobby, no Host button, and no cap of its own — it waits
for the promise to settle and reports what it settled as.

| trials | registered | min | median | max | retries needed |
|---|---|---|---|---|---|
| 20 | 20 / 20 | 3 ms | 3 ms | 8 ms | 0 |

**Room registration was not what was failing.** Twenty for twenty, in single-digit
milliseconds, on the same relay the suite boots. Whatever made one co-op run in
three or four report `room registration failed against local relay`, it was not
`createRoom()` failing to register a room.

### What the message was actually reporting

The suite's `tryRegister()` returned a bare `null` for three unrelated outcomes
and the caller printed one sentence for all of them:

1. `window.uv.lobby` null — the host flow never started, so nothing was ever
   registered;
2. registration settled as failed — the real case the message described;
3. still in flight when the poll gave up.

Case 3 was guaranteed for a while. The suite polled for a hardcoded `12000` ms;
the transport's own ceiling is `ROOM_REGISTER_ATTEMPTS x ROOM_REGISTER_TIMEOUT_MS`
plus backoff, in a different file. Adding retries pushed that to 16200 ms without
moving the suite's number, so any first-attempt timeout guaranteed the suite
reported failure while registration was still running.

And the diagnostic printed with it was structurally empty: `main.js` published
`window.uvNet.regFailures` only from its terminal `.catch()`, so a registration
still retrying and a registration with nothing wrong both read `[]`.

### Fixed

- **Registration is budget-bounded, not just attempt-bounded.**
  `ROOM_REGISTER_BUDGET_MS` (11000) caps the whole sequence on wall clock. A
  collision fails instantly and keeps all its retries; a relay that has gone
  quiet stops costing attempts. Per-attempt timeout dropped 8000 -> 5000.
- **The suite derives its wait from that constant** (`REG_WAIT_MS`) instead of
  restating it. Four separate hardcoded literals across the file — three at
  12000 and one at 15000 — are gone. Two numbers that must agree are one number.
- **The ledger is written per attempt, in `net.js`, where the failure happens** —
  not by whoever catches the final rejection. "Still retrying" and "nothing has
  gone wrong" are no longer the same reading.
- **`tryRegister()` reports which of the three outcomes ended it**, with elapsed
  ms and the ledger contents.
- **Unretryable failures cost one attempt.** `peerjs-missing` will still be
  missing in 400 ms; it was being retried three times on every page in the suite
  that isn't testing co-op.
- **A taken room code now recovers.** `unavailable-id` means that exact code is
  registered, and the original code retried nothing at all — one collision ended
  the session. Verified on the runtime path: `Math.random` is pinned so the first
  code drawn is one already squatted on the relay, then released; the transport
  collides, redraws, and registers, and the ledger records
  `unavailable-id` on the taken code.

### Still open — this is a negative result, not a fix

**20/20 at 3–8 ms does not explain failures that were happening 1 run in 3–4.**
That is the whole finding. A healthy measurement of the component named in the
defect is evidence that the name was wrong; it is not evidence that anything
was repaired. Everything fixed above was found by *reading* — a collision that
could never recover, a ledger written too late, a suite wait that had drifted —
and none of it was implicated by an observation.

So the honest position is that **the failure stopped reproducing and nobody
knows why.** A defect that stops reproducing without a known cause is not a
fixed defect; it is a defect that is currently quiet. The two live
possibilities are unchanged and both remain untested:

1. `window.uv.lobby` was null when the poll started — the host flow never began,
   and nothing was ever registered;
2. registration genuinely settled as failed, for a reason the old ledger could
   not have recorded.

What actually changed is the *resolution* of the next occurrence. The suite used
to print one sentence for three outcomes; it now names which one, with elapsed
ms and the ledger contents attached.

**Closing conditions.** Either a run reproduces it and the new diagnostic says
what it was, or enough clean full co-op runs accumulate that a 1-in-3-or-4 rate
is statistically out of reach. Neither has happened. A handful of quiet runs is
not the second condition — at that rate, four clean runs in a row is roughly a
1-in-4 coincidence on its own.

---

## 10. The browser suite gates co-op behind tests for content that was removed

**Where:** `tools/browser_test.mjs`, the shop/meta phases and the co-op phase.

**What is wrong.** Weapons were removed from the game — `js/game.js` sets
`p.weaponSlots = 0` unconditionally, and `_addWeapon` refuses when
`p.weapons.length >= p.weaponSlots`, which `0 >= 0` always is. Several suite
checks still wait for weapons to appear:

```
✗ browser test crashed: timeout waiting for a matching pair of coilguns in meta
✗ coop test: timeout waiting for a matching pair of coilguns in the host's meta
✗ mobile test crashed: tap: no element [data-wchip="0"] .wsym
✗ mobile combine badge: null
```

None of these can pass. They are not reporting a defect in the game; they are
tests for content that no longer exists.

**Why it matters beyond the noise.** These `waitFor`s **throw**, and a throw
ends the phase. So a co-op run can abort before it reaches the co-op sequence at
all, which means "co-op failed" and "co-op never ran" look similar in the log —
the same conflation that kept #9 undiagnosed one level down. It also makes the
suite an unreliable instrument for exactly the two defects that most need it.

**Not fixed here.** Deleting or rewriting these belongs with the phase-4 economy
work that owns the weapon removal, and pulling that forward was explicitly
out of scope. Recorded so the failures are attributed rather than re-diagnosed.

**Note the interaction with #8's verification.** `tools/uiack_test.mjs` exists
partly because of this: it pairs two real pages directly and never touches a
shop, so it can verify client input delivery without depending on a suite that
cannot reliably get there.

---

## 18. `samurai_agility` scales on Footing, and its own play pattern destroys Footing

**Where:** `js/content/skills/samurai_agility.js` — the tree declares
`scaleWith: 'footing'` and its nodes trigger on `MOVEMENT`. Footing is granted
by **standing still** (GDD §8.4: one stack per 500ms stationary, cap 10, with a
400ms grace *budget* rather than a timer).

**What is wrong.** The tree scales on an engine its own play pattern spends. A
player using Agility as designed — Quickstep, Running Cut, Slip Cut, Windwalk,
all movement-triggered — is moving continuously, which drains the 400ms budget
and drops every stack. The reward and the requirement are opposites, so the
tree's scaling term reads as near-zero exactly when the tree is being played
correctly. The GDD already names this in §8.1 and it has never been costed.

**Reproduce:** `node tools/balance_probe.mjs toh_samurai` — the pilot bot
kites, so it plays Agility's pattern by default. Footing stacks should sit near
the floor for the whole run.

**Ruled out.** Rescaling Agility onto another engine term. Two reasons: the
conflict is not Agility's alone — Footing is stationary-fed in a game whose only
input is movement, so every class scaling on it has this tension and Agility
merely states it loudest — and `samurai_agility` is GDD §8.1's cited
shape-spec reference for the whole roster, so making it a special case costs
more than it fixes.

**What a fix would have to do.** Widen the grace budget rather than change what
Agility scales on. **Proposed: `footingGraceMs` 400 → 900**, `footingGraceRefill`
unchanged at 1.0.

- 900ms is chosen as roughly one *reposition* rather than one sidestep: enough
  to leave a hazard and re-plant, still far short of a room crossing, which is
  several seconds at player move speed. §8.4's boundary — "one sidestep out of
  the fastest committed zone fits and a room crossing does not" — is preserved
  and moved out one step.
- The budget, not `footingTickMs`. Halving the tick would make stacks cheaper
  for a Samurai who never moves; widening the budget pays only the player who
  does, which is the population this defect is about.
- §8.4 calls Footing "the most-iterated design in the project", so a fourth
  iteration should be deliberate rather than incidental.

**It does not ship without a fixture.** The test is whether an Agility build
holds Footing **above ~5 stacks** while playing the tree as intended — which is
a measurement, not an argument, and the number is what decides whether 900ms is
the right widening or merely a different wrong one.

**Status:** proposal accepted, `js/` change, lands in its own patch. Raised by
the Samurai pass of the class-conversion revision
(`docs/design/classes/samurai.md`).

---

## 19. The Savage's thirty skills scale on `cascade`, not on the engine in its own trait

**Where:** `js/content/skills/savage_*.js` carry `scaleWith: 'cascade'` on 12
skills (plus `armor` on 3). The class trait in `js/content/characters-toh.js` is
`blood_dance`: `heatPer: 8`, `heatMax: 120`, `heatDecaySec: 3`.

**What is wrong.** `blood_dance` is a momentum engine — it builds on hits, caps,
and drains after three seconds of not connecting. That is the class's engine and
it works. **No skill reads it.** The skills scale on `cascade`, which measures
chain length (`ENGINE_SCALE.cascade`, max 18, uncapped by §8.3), a different
quantity that happens to correlate with hitting things.

So the Savage has a working engine its own kit ignores, and a scaling term
nothing in the class was designed around. A player building for momentum is
rewarded through a proxy, and every tuning change to `blood_dance` moves a
number no skill consults.

**Reproduce:** `node tools/balance_probe.mjs toh_savage` — heat climbs and
decays as designed while output tracks chain length instead.

**Ruled out.** Changing `blood_dance` to match `cascade`. The trait is the
better engine and it is the one the conversion document independently arrived
at, deriving Momentum from Warrior's Momentum's declared text without knowing
the trait existed. Two designs converging is evidence for the design.

**What a fix would have to do.** Repoint the class's `scaleWith` terms from
`cascade` to the trait's heat. `ENGINE_SCALE` needs a `momentum` entry with a
hard cap — `blood_dance` already has one at 120, unlike `cascade` which §8.3
leaves uncapped, so this also closes an uncapped scaling term.

**Status:** `js/` change, own patch. Raised by the engine ruling of the
class-conversion revision (`docs/design/classes/engines-doc-vs-built.md`),
which ruled the document's Momentum as the Savage's engine.

---

## 20. Two Druid trees are named for each other's contents

**Where:** `js/content/skills/druid_*.js`. The class's three built trees are
`Wild Kin`, `Tapestry of Beasts` and `Restoration`.

**What is wrong.** The names are crossed against what the trees hold:

| built tree | what it actually contains |
|---|---|
| **Wild Kin** | `strike ×3, cone ×2, hazard ×1, ward ×1` — **no summons at all** |
| **Tapestry of Beasts** | `strike ×2, summon ×3, hazard, heal, line, cone` — **all three summons** |

"Wild Kin" names a summoner tree that summons nothing. "Tapestry of Beasts" — a
name that reads as *borrowed* animal traits, one at a time — holds every actual
animal the class calls. A player reading the tree titles picks the wrong tree
for the build they want, and every document that maps the class by name inherits
the error.

**This is independent of the conversion documents.** They arrange the same two
axes the other way round and are internally consistent; the defect is that the
code's own labels do not describe the code's own contents. It would still be
wrong if the documents did not exist.

**Reproduce:**
```
node -e "import('./js/skills.js').then(m=>{for(const id of m.TREES_BY_CLASS['toh_druid']){const t=m.TREES[id];const k={};for(const s of t.skills)for(const c of (s.compose||[]))k[c.kind]=(k[c.kind]||0)+1;console.log(t.name, JSON.stringify(k))}})"
```

**Ruled out.** Moving the skills. The trees are coherent as *designs* — one is a
summoner tree and one is a melee-flex tree — so the cheap and correct fix is the
labels, not the contents.

**What a fix would have to do.** Swap the two tree `name` fields, leaving skills
and ids where they are. Tree ids are referenced by saves through spent skill
points, so the `id` must not move; only the display `name` does. Check
`tools/class_doc_gate.mjs`'s tree inventory afterwards — it reads names and will
show the change.

**Status:** `js/` change, own patch. Raised by the twelve-class pass of the
class-conversion revision, where it was the reason the Druid's tree-name mapping
could not be resolved.

---

## 21. `rankedDuration` and `rankCooldown` disagree on rank indexing

**Where:** `js/compose.js:24-27` and `js/skills.js:296-300`.

```js
// js/compose.js:24
export function rankedDuration(base, skill, rank) {
  const inc = (skill.ranks && skill.ranks.duration) || 0;
  return base * (1 + inc * rank);          // rank 1 -> base x 1.03
}

// js/skills.js:296
export function rankCooldown(base, rank) {
  if (!(rank > 1)) return base;            // rank 1 -> base, exactly
  const r = base * Math.pow(1 - CONFIG.SKILL_RANK_CD_RATE, rank - 1);
  return Math.max(base * CONFIG.SKILL_RANK_CD_FLOOR, r);
}
```

**What is wrong.** The two functions index rank differently. `rankedDuration`
multiplies by `rank` directly, so a rank-1 skill's durations are already
**+3% above their authored value** the moment the skill is learned.
`rankCooldown` early-returns at rank 1, so a rank-1 cooldown is *exactly*
authored. Every call site passes the same `rank` to both — `rankedDuration` is
called with `rank` at `js/compose.js:421, 437, 464, 471, 560, 572, 578`,
`js/minions.js:292-293` and `js/skilltext.js:241, 247`; `rankCooldown` at
`js/skillsim.js:440`.

**Why it matters.** Any authored duration-to-cooldown ratio is off by 3% before
a single point is spent past the first. A rider written at 70% of its cooldown
measures 72% in play at rank 1. The same asymmetry shifts every duration the
skill card displays (`js/skilltext.js`) against the cooldown displayed beside
it.

**It is not caught by anything.** `tools/patch_gate.mjs:85` asserts
`rankCooldown(base, 1) === base` — the correct half — and nothing asserts the
matching property for `rankedDuration`. The two were written to different
conventions and the gate only covers one of them.

**Which is right is a design call, not a bug report.** Either `rankedDuration`
should read `(rank - 1)` so rank 1 is authored base, or `rankCooldown` should
drop its early return so rank 1 is already discounted. The first preserves every
authored duration in the game and is the smaller change; the second matches the
"a rank is an investment" reading. GDD §4.2 states "+3% of base duration, linear
against base" without saying which rank is the identity, so the document does
not settle it either.

**How it was found.** The rank-ladder survey, which measured rider durations
against cooldowns across rank and needed both curves to agree on what rank 1
means before it could report anything. Not raised by ruling 6 and not affected
by ruling 6's retirement — the asymmetry is a property of the two functions and
stands on its own.

**Status:** `js/` change, behind the queued implementation order. **Nothing
fixed here** — filed only. Changing either function moves every timed value in
the game by 3% in one direction or the other, so it wants its own patch and its
own measurement.

---

## 12. A client-page eval dies on an undefined `.x` mid co-op

**Where:** the client page, during the co-op phase.

```
✗ coop test: page eval failed on [B]: TypeError: Cannot read properties of undefined (reading 'x')
```

**Status.** Intermittent — 2 of the last 7 runs. The message named neither the
page nor the expression until `Browser.exec` was changed to report both, and
even then the exception's multi-line stack pushed the script snippet onto a
later line where every run-log grep dropped it. Both are fixed; the next
occurrence carries the failing expression on one line with it.

**Recorded rather than chased** because #11 is the larger blocker and this may
turn out to be downstream of it — an eval reading a position off an entity that
a stalled fight never produced.

---

## 13. Skills cannot be aimed, and every objective assumes aimed damage

**Where:** `js/triggers.js` `TRIGGER_KINDS`, against the objective designs in
`js/objectives.js`.

**This is the finding under #11's offence failures.** It is *not* a content gap
waiting on phase-5 trees, and that distinction decides where the fix goes.

### Measured

A fully-armed necromancer — ten skill ranks spent, permanent stat grants applied
— put into each objective with no harness kills:

| objective | damage dealt | kills | objective progress |
|---|---:|---:|---|
| Nest Purge | 666 | 22 | `alive: 3` of 3 — **no nest ever damaged** |
| Elite Arena | 4230 | **0** | 40 spawned, none killed |
| Bounty Hunt | 8318 | 311 | `killed: 0` of 5 marks |

It is killing plenty. It is killing *the wrong things*, and it cannot be told
otherwise.

### Why

Every trigger selects by **position or health fraction**, never by role:

```
PROXIMITY  NEAREST  ISOLATED  TARGET_THRESHOLD  ON_KILL  ON_HIT_TAKEN
ON_DODGE   SELF_THRESHOLD     ON_STATUS         MOVEMENT
```

There is no way to express *the nest*, *the mark*, *the elite* or *the boss*. A
player with a weapon aimed at what they chose; a player with skills cannot
choose at all. Chaff is always nearer, so chaff is always what dies.

Elite Arena is the cleanest reading: **4230 damage, zero kills.** Elites carry
`ELITE_HP_MULT` 3×, a single tier-1 skill cannot finish one, and the damage
spreads across forty of them instead of concentrating on any. No kills means no
XP, no XP means level 1, level 1 means **one loadout slot** — the party cannot
grow its way out.

### Why more trees will not fix it

Phase 5 adds skills. Every one of them will still pick its target by proximity.
More damage arriving at the nearest chaff does not kill a nest that nothing ever
targets. The gap is between the objective designs, which were authored for aimed
weapon fire, and the trigger vocabulary, which cannot name a target.

### Fixed: `select` is a field, not a new trigger kind

The framing above was wrong and worth correcting, because it would have sent the
fix to the wrong place. **The loss was variety in the selection rule, not
aiming.** Weapons had varied targeting rules and the player chose the rule by
choosing the weapon — a shotgun hit everything close, a sniper took the farthest
or the fattest, a homing shot tracked one thing. Triggers collapsed all of that
into position and health fraction.

So the two jobs a trigger was doing are split:

```js
trigger: { kind: 'PROXIMITY', radius: 140, count: 3 },   // when it fires
select:  'highest_hp',                                    // what it hits
```

`js/selectors.js` ships six rules — `nearest`, `farthest`, `highest_hp`,
`lowest_hp`, `densest_cluster`, `objective_target`. Every one is a rule over
what is **already queryable**; none is a new player input. A selector re-ranks
the candidates the grid returns for the skill's own range and never widens the
search, because a selector that could reach past a skill's range would silently
give every skill infinite reach.

`objective_target` reads role tags the sim already sets — `isNest`, `bounty`,
`boss`, `elite`/`mini` — in that priority order, with distance as the tiebreak
so that with three nests on the field the near one is the right nest. It skips
`nestShielded` nests: a shielded nest cannot be hurt at all, so preferring it
would fire into a wall while the ring that drops the shield went unkilled.

**`select` is required on every active, with no default.** Defaulting a missing
one to `nearest` would silently reproduce this defect on every skill anyone
forgot — which is exactly how it existed in the first place, as an unwritten
universal default nobody had to opt into. All 34 actives now declare one, and a
passive declaring a `select` is also an error: a passive hits nothing.

### Confirmed, in the shape that found it

An armed party (all ranks spent, permanent stats, steered at the objective):

| objective | dealt | kills | progress | before |
|---|---:|---:|---|---|
| Nest Purge | 10394 | 244 | **1/3 nests down** | 0/3, none ever damaged |
| Elite Arena | 53964 | 78 | **all 52 elites — CLEARED** | 0 kills |
| Bounty Hunt | 54786 | 398 | **2/5 marks** | 0/5 |

All three off zero; Elite Arena finishes. `sim_test` also drops one failure
(`UNKILLABLE at 4p`, 13110 → 13110 becomes real damage), 39 → 38.

### What is still short, and why it is a different question

Nest Purge and Bounty Hunt make progress but do not finish inside the harness
budget. That is **throughput, not selection** — the targets are being hit now,
there is not enough damage arriving before the clock runs out. Whether one
tier-1 skill at ten ranks should chew through a 3×-HP elite or a 10×-HP mark in
six minutes is a question about elite and mark HP, and it is **deliberately not
answered here**: retuning on the back of a targeting fix would let a throughput
change silently satisfy a targeting test.

The `offence_test` assertion is therefore "something got targeted", never "the
level finished".

### Still a harness gap: the 1p UNKILLABLE check

`UNKILLABLE at 1p` survives because that harness parks a player 120u from the
mark "in weapon range, firing" and never arms it — a weapons-era assumption. The
4p variant now passes because its party is armed. Worth fixing, but it is a
harness gap and not evidence about regeneration.

### The five camper-statue failures are a different, smaller thing

`statueRun()` never spends its skill point, so the "camper" is unarmed. That is
a harness gap, not a defect — but it is not worth fixing until #13 is decided,
because an armed statue still cannot aim.

### Not to be counted as content

Recorded separately from #11 precisely so it is not absorbed into "waiting on
phase-5 trees". Trees are content. This is not.

---

## 14. The ToH trait layer is wired to two subsystems that were deleted

**Where:** `js/traits-toh.js`, against `js/game.js` `_tickWeapons` and
`_addWeapon`.

All fourteen trait keys are implemented. Several of them are nonetheless inert,
because they hang off hooks that stopped being called when weapons were removed.

### `tohOnFire` was orphaned — FIXED

`tohOnFire(sim, p, ctx)` is the "an attack happened" hook. Its only caller was
`_tickWeapons()`, which has not run since `weaponSlots` went to 0. So the Bard's
Rhythm never built a stack, the Mage's every-Nth-attack singularity never
counted, and the Sundian never planted coral — **the hook was orphaned, not
broken.**

It needs only a target position, so it is now called from `fireSkill()` with the
position the skill's own selector chose. Skills are what attacks are now.

### `bonelord` builds its structure out of a weapon — OPEN

```js
if (has(p, 'bonelord')) { sim._addWeapon(p, 'bolt_turret', 1); return true; }
```

`_addWeapon` refuses when `p.weapons.length >= p.weaponSlots`, and `weaponSlots`
is 0, so the Necromancer's bonelord summons nothing. The structure-recall gate
(off-screen packing, redeploy, carry) therefore has **no class in the game that
can exercise it** — the retired Cogsmith's `overseer` mounts were the other.

This is a design decision, not a repair: the bonelord's structure has to become
a skill-era summon, and what grants it (a tree node? the trait at fight start?)
is a GDD question. **Not attempted.**

### What is still inert, and why the tests cannot pass yet

`Bard rhythm`, `no singularity in 30s`, `no coral planted`, `toh blob` — these
run as `toh_bard`, `toh_mage`, `toh_sundian`, `toh_druid`, all of which have **no
skill tree**. With `tohOnFire` now on the skill path, a class that cannot fire a
skill still cannot trigger an attack hook. They resolve when phase 5 arms those
classes, and not before. Content gap, not defect.

`expected 2 beasts across 2 Hunters` is the same shape: the Hunter's beast is
granted at fight start by `pack_tactics`, but the test constructs Hunters through
a path that only runs for a started run.

---

## 15. `hitbox` was honoured by trait NAME, not by presence — FIXED

`js/game.js` computed a player's radius as

```js
CONFIG.PLAYER_RADIUS * (char.trait.key === 'immovable' ? char.trait.hitbox : 1)
```

`immovable` is a **retired classic trait**. The Blacksmith's `crystal_infusion`
carries `hitbox: 1.4` and the sim ignored it entirely — a bigger target that was
only bigger on screen, because `js/main.js` special-cased both names and the sim
special-cased one. A data field should not need the engine to know who owns it;
both now read `trait.hitbox || 1`.

---

## 16. The style anchor pointed at a retired character — FIXED

`tools/gen_prompts.mjs` hardcoded `char.pulsar` as batch 0. Pulsar retired with
the classic roster, so **batch 0 became empty** and the gate it exists to be
stopped gating: `--require-all` had nothing to require. It is now
`STYLE_ANCHOR_ID`, a named constant, pointing at `char.toh_assassin` — which
unit carries the style is a decision someone should be able to find and change.

---

## 17. UNKILLABLE bounty mark — reclassified, still open

Was "a Regenerating mark took 20s of point-blank fire and its HP did not fall
(7354 → 7354)". Two causes want opposite fixes — the mark out-heals the damage,
or nothing was ever aimed at it — and the message could not tell them apart.

Instrumented, it now reports:

```
armed: [necro_blip] parked 130u, player dealt 260 total, level 1, fires 20
```

So the player **is** armed, **is** firing, and **is** dealing damage — and none
of it reaches the mark, whose HP is unchanged to the point. The harness gap is
closed (it parks at half the armed skill's own trigger range now, not a
weapons-era literal 120u). What remains is: where did the 260 go — the escort
pack, or projectiles missing a moving stalker at range?

### Resolved by per-target attribution: it is DELIVERY, not any of the three

`sim.dmgLog` (every damage event, by target, with `landed`/`blocked`) and
`sim.selLog` (what each fire selected) are opt-in ledgers — a harness sets them,
nothing records when they are absent. Read at teardown:

```
SELECTED:    necro_blip->MARK x23
ON THE MARK: 2 hits for 10, 0 blocked
BY TAG:      MARK 2h/10dmg/0blk, chaff 21h/120dmg/0blk
```

**The selector is right 23 times out of 23.** Nothing was blocked. Of 23 shots
aimed at the mark, **2 arrived** — the other 21 were intercepted by the escort
pack that spawns with every bounty mark by design.

So it was a fourth cause, and none of the three I had listed. **Selection is not
delivery.** `objective_target` picks the correct entity and the bolt primitive
stops at the first body it meets, so a deliberately-escorted target cannot be
focused at all. A `pierce` rider on objective-targeting bolts would fix it;
whether that is the right answer — or whether escorts are supposed to be a wall
you clear first — is a design question. Recorded as §15 defect #17.

**A note against my own instrument.** The first classifier had three branches
and reported `REGENERATION` here, because two hits did land. Two hits out of
twenty-three is not regeneration; the branch was too coarse and would have sent
the fix at the elite mod. It now compares hits-on-target against
selections-of-target and names `DELIVERY` when the gap is wide.

---

## #22 — the converted Dark Matter tree makes standing still a winning strategy

**Retired.** Dark Energy Blip is 9 damage every 1000ms (was 18 every 600ms, about 30 DPS down to about 9). A motionless Necromancer now dies in all 25 statue rooms. `STATUE_REF` in `tools/sim_test.mjs` points at `toh_necromancer` again, and the block that reported the survival count is gone. A survival fails the Statue Test.

The record below is the state that shipped the exception.

**Shipped deliberately, and was the thing Casey was playtesting.**

The Necromancer's Dark Matter tree is converted from
`docs/design/classes/necromancer.md`. Converted, a **never-moving** Necromancer
survives all 25 statue rooms and **clears 20 of them**. The built tree, at built
numbers, dies in all 25.

**No single node or dial is responsible.** Eleven full suite runs:

| configuration | statue rooms survived |
|---|---|
| doc damage + doc pace | 25 |
| doc damage + built pace | 25 |
| built damage + doc pace | 25 |
| **built damage + built pace + doc shapes** | **25** |
| doc numbers + built selectors | 25 |
| trigger conditions restored | 25 |
| the three area nodes silenced | 25 |
| the channel silenced | 25 |
| the plague silenced | 25 |
| every range at its built value | 25 |

Built numbers with the document's shapes still fail, so this is not a magnitude
problem and there is no number to tune. It is ruling 7's lesson arriving through
a whole tree rather than through one aura: nine ranged actives, each
individually reasonable, remove the cost of not playing. **Marrow is the
control** — melee, converted, and it passes. The difference is reach.

**What was done about it: nothing, on purpose.** The tree ships as authored so
the problem can be felt rather than read about. The statue check still ran for
the whole roster — its reference character moved to the Samurai, which is melee
and unconverted — and the Necromancer still ran beside it, reporting the room
count against this defect. The day that line reported zero clears, the exception
was to be retired and `STATUE_REF` pointed back at the Necromancer. That day
arrived with the opener retune above: zero of 25 rooms survived, and the
exception is retired.

**AND THE TREE IS NOT UNIQUE — the test is already false of six classes.**
Measured across all fourteen as motionless statues, 15 rooms each:

| outcome | classes |
|---|---|
| dies in every room | druid, mage, bard, witch doctor, priest, sundian |
| dies in most | assassin (11 of 15) |
| **never dies, clears rooms** | **blacksmith, wizard, necromancer, samurai, monk, savage** |

The **Wizard clears 15 of 15** — more than the Necromancer's 10 — and the
**Samurai ends every room at 100% health**, never touched at all. The converted
Dark Matter tree joined an existing group of six rather than creating a new
problem, and the statue check has been asserting something false of nearly half
the roster.

Its reference character is now the Priest, which dies in every room. The
Samurai was the first choice and was the worst possible one.

**So the ruling is probably about the test, not only the tree.** Whether a
motionless character *should* be able to clear a room is a design question;
whether this check can tell you is now answered — it cannot, for six classes.

---

## #23 — the converted Necromancer can barely break a barricade

**Shipped with #22, same reason, and the cause is a field the document never mentions.**

`toh_necromancer cannot break a barricade: 18/135 damage in 150s` (was 27/135 before Dark Energy Blip went to 9 damage / 1000ms). Not a
softlock — it chips — but a barricade that took seconds now takes minutes. The opener nerf moved the chip; it did not give the class a barricade selector.

**The built tier-1 node declared `select: 'objective_target'` and the
conversion changed it to `nearest`.** That selector was the class's
barricade-breaker, and no line in `docs/design/classes/necromancer.md` mentions
objectives, barricades or walls at all. The document specifies what a skill
hits in terms of enemies only, so a faithful conversion silently drops the one
target type that is not an enemy.

**This is the sharpest instance of the `select` finding.** `select` is the one
category that still needs a judgment call per node, and this shows the call is
not merely "which enemy" — it is sometimes "an enemy at all". Any of the twelve
remaining classes whose built tree uses `objective_target` will lose the same
capability when converted, invisibly, because the documents cannot express it.

Not fixed: restoring the selector would change ranged targeting behaviour, and
that is the ruling Casey is playtesting.

## #24 — straight-line harness movers stall on map 1's obstacle walls

**Harness, not the game.** Nothing a player experiences; everything a
*measurement* experiences. It froze four of nine runs in the spawn-gap
measurement and silently zeroed the XP figure in two more, so it has now
corrupted two different numbers in one session.

**What it is.** `driveEngage` (`tools/fixture_build.mjs:228`) walks a straight
line at `trigGrid.nearest` and stops at a standoff. Region 1 map 1 has 60-wide
obstacle walls — measured on seed `cafe`, `{x:786, y:36, w:60, h:827}` — and
`warden`-behaviour enemies (`pnw_sapling`) that never move toward the player.
Put those together and the driver parks against the wall with a stationary
enemy 85 units away on the other side of it, pressing into stone forever.

Measured, solo, seed `cafe`: **31 kills, 8 alive, frozen for 230 seconds** —
player hp 76 and total enemy hp 71 both unchanged tick after tick, nearest
enemy 85 units away the whole time. The player can move (pushed +x it travelled
600 units); it just never chooses to, because the target is straight through a
wall. Sweeping the standoff (110 / 60 / 30 / 0) did not fix it: at every value
the run plateaued with enemies alive.

**It is not only `driveEngage`.** `region_test`'s XP probe walks loot with the
same straight-line rule (`tools/region_test.mjs:341`). On seeds where the loot
falls across a wall the character banks nothing, the drops fizzle, and the probe
reports **level 1 from a room that paid 79 kills** — indistinguishable, from the
outside, from a room that pays nothing. Measured on seed `cafe`: 0 materials
banked from ~79 kills. `region_test` is green today only because it hardcodes
seed 777, which happens not to sit behind a wall.

**Workaround, so the next measurement does not rediscover this.** Add a stall
detector and commit to a perpendicular detour for a beat, alternating sides —
the same shape `rushMove` already uses for enemies
(`js/entities/enemies.js:20`). Roughly:

```js
const moved = Math.hypot(p.x - lastX, p.y - lastY);
if (moved < 0.4) stuck++; else stuck = Math.max(0, stuck - 2);
if (stuck > 12 && detour <= 0) { detour = 48; side = -side; stuck = 0; }
if (detour > 0) { detour--; setInput({ mx: -dy / d * side, my: dx / d * side }); }
else setInput({ mx: dx / d, my: dy / d });
```

With that in place the same seed `cafe` fight clears at **82.5 s with 39 kills**
instead of hanging. It is a floor on human competence, not a model of good play
— a person sees the wall and goes around it immediately — so tail and duration
figures measured this way stay pessimistic, and it does not rescue every seed:
`cafe` still banks 0 loot, so seeds must be checked for collection before their
XP numbers are trusted.

**Not fixed.** The workaround lives in the probes that need it rather than in
`fixture_build.mjs`, because changing `driveEngage` changes the numbers every
existing tuning tool has already reported. Promoting it is a separate call —
and the right version is pathfinding, not a sidestep.

**Unrelated to the map 1 onboarding change** it was found alongside. It
reproduces at both `ONBOARDING_RATE[0]` values, in two flavours: at 0.5 the run
freezes outright (kills and both sides' hp unchanged for 230 s), and at 1.0 it
degrades into a crawl instead — measured, 62 to 65 kills across 100 seconds with
16 enemies alive, the nearest parked at 84 units, while the player's own hp
bleeds 35 to 23. Same cause, and the second flavour is the more dangerous one to
a measurement because it still looks like progress.

## #25 — minion facing flickers when the minion list reorders — DEFERRED, fix identified

**Ruled acceptable, not undiscovered.** Recorded so the next person to see a
skeleton snap to a wrong heading for a frame does not re-derive the cause.

**What it is.** Minion sprites are directional, and their facing is derived from
movement by `_faceAngle(key, x, y, null)` (`js/render.js:131`) — the same way
enemies get theirs, and deliberately so, because it needs nothing on the wire.
`_faceAngle` remembers the last position per KEY, and minions have no id to key
on: the snapshot tuple is `[ownerIdx, arch, x, y, hpFrac, downFrac]`
(`js/game.js:4854`). The key is therefore array-positional —
`` `m${m.owner}:${m.arch}:${mi}` `` — so when a skeleton dies, every minion
after it in the array shifts down one index and inherits the dead one's
remembered position. The next frame's delta is then measured between two
different creatures, and the survivors face a direction nobody walked in until
they move far enough to correct.

**How bad.** One frame per death, and only for same-owner same-archetype
minions behind the one that died. A ten-skeleton Necromancer losing one mid-
fight is the worst case and it self-corrects on the next movement tick. It
cannot desync anything — facing is presentation only and never reaches the sim.

**The fix, already identified.** Add a stable minion id as a seventh field on
the snapshot tuple and key the facing on that. It is a netcodec change, which
is why it was not taken: the flicker is a frame of cosmetics and the wire is
not a place to spend a change casually. If the tuple is being touched for some
other reason, take this at the same time.

**Not fixed** by ruling, on the record, at the time the sprites were wired.

## #26 — shop pricing assumes materials reset per region — FLAGGED, not fixed

**Raised by session carry, deliberately left alone.** `materials` is one of the
sixteen fields that now cross a region boundary and a retry (see
`CARRY_FIELDS` in `js/game.js` and `tools/carry_gate.mjs`). Before that, every
region began at zero and the shop was priced against what a single region
takes.

**Why it matters.** Prices are set against a floor's takings rather than against
a level — that is stated in the XP-compensation note in `js/arenas.js`, which
compensates XP and deliberately does NOT compensate gold, on the grounds that
"the shop is priced against a floor's takings". Carrying materials forward
breaks that assumption in the player's favour: region 2's shop is now met with
region 1's leftovers on top of region 2's earnings, and the effect compounds
across a run and across every retry of a region.

**Measured, one region:** a god-mode probe leaves region 1 map 1 with **71
materials** banked. That is the size of the carry into region 2's first shop,
per player, per region cleared.

**Not fixed** because pricing is a design pass, not a bug fix: the options —
scale prices by region, tax the boundary, or let the ramp stand as a
deliberate power curve — are different games, and choosing between them is not
something a carry patch should decide silently.

## #27 — a weapon swing repaints a live skill arc in the wrong colour

**From #123's render rewrite, accepted rather than fixed.** Cosmetic, bounded,
and in a merge that is doing the right thing for the wrong swing.

**Reproduce.**

    node tools/fx_defect_repro.mjs

**What it is.** `_ingestSwing` (`js/render.js:223`) folds a second swipe of the
same cut into a live arc instead of spawning a second pie that reads as
flicker. The merge is right; what it copies across is not. It takes the
INCOMING swing's `color` and keeps the EXISTING arc's `spec` and `shape`:

    a.stack = Math.min(5, (a.stack || 1) + 1);
    a.lw    = Math.min(22, (a.lw || lw0) + 3.2);
    a.t     = Math.min(a.t, a.dur * 0.12);
    a.color = color;                      // <- the only field that follows the newcomer

Weapon swings carry no `sid` (`js/game.js:2427` and `:2446`), so their spec is
null and their colour is the weapon's. A basic attack landing within 10 units
and 0.4 radians of a live skill arc therefore recolours that arc to the weapon
while it goes on drawing the skill's class particle and its class sprite. The
reverse case loses more: a skill swing merging into a weapon arc takes the
skill's colour but inherits `spec: undefined, shape: slash`, so the class kit
and the authored sprite are dropped entirely. Which of the two wins is decided
by arrival order and nothing else.

Measured, one merge — a necromancer slash arc met by one weapon swing:

    before: color #a3e635  spec necro_abyssal_blast  shape slash  t 0
    after : color #ff5d6c  spec necro_abyssal_blast  shape slash  t 0.041

**Second effect, same three lines.** `a.t = Math.min(a.t, a.dur * 0.12)` rewinds
the arc. An arc 59% through its life goes back to 12% and replays its wipe. At
a high enough attack speed a cut restarts instead of stacking — which is the
flicker the merge exists to prevent, arriving by a different door. It is not a
leak: the array is capped at 56 and one arc is kept per cluster.

**How bad.** Presentation only, on a swipe that lives 0.34 s. Nothing here
reaches the sim, the snapshot or the wire. It cannot change what an attack hits;
`_ingestSwing` runs after the primitive has already resolved.

**What a fix would have to do.** Decide which swing owns the merged arc rather
than splitting the answer across fields. The cheap version is to merge only
swings whose `sid` matches — a weapon swing and a skill swing then stack
separately, which is honest, at the cost of two arcs where the merge wanted
one. The better version keeps the merge and lets the SPEC-bearing swing own
colour, spec and shape together, with a plain weapon swing contributing only
width and stack.

**Not fixed** because the fix is a design choice about what a stacked swipe is,
and #123 landed as art rather than as a behaviour pass.

## #28 — a targeted cast's sprite lands on the caster when the target is due north

**From #123's render rewrite, accepted rather than fixed.** One comparison, one
axis, 44 skills.

**Reproduce.**

    node tools/fx_defect_repro.mjs

**What it is.** `_drawCast` (`js/render.js:1814`) picks the sprite's anchor by
asking whether it chose the caster:

    const atx = (shape === SHAPE.shockwave || shape === SHAPE.ring || shape === SHAPE.healPulse
      || shape === SHAPE.wardShell || shape === SHAPE.summonBurst) ? x : tx;
    const aty = atx === x ? y : ty;

The second line infers the branch from the VALUE rather than reading the
condition again. When the target sits directly above or below the caster, `tx`
and `x` are the same number, so a target-anchored shape is misread as
caster-anchored and the y falls back to the caster's:

    target east        : target (300,100) -> sprite (300,100)
    target due north   : target (100, 40) -> sprite (100,100)   <- the caster

**Who it reaches.** The five caster-anchored shapes are unaffected by
construction. The target-anchored ones that exist in the catalog today are
`blight` (9 skills), `tether` (13), `trap` (5) and `puddle` (17) — **44 skills**,
each of them whenever the cast is aimed along the vertical. The canvas drawing
underneath is unaffected: it reads `tx`/`ty` directly and lands correctly, so
only the sprite overlay separates from its own effect.

**How bad.** One frame's worth of sprite, on a cast that lives 0.4–0.5 s, on a
bearing the player has to be roughly on. No sim, snapshot or wire contact.

**What a fix would have to do.** Compute the anchor once — `const atCaster =
CASTER_ANCHORED.has(shape); const ax = atCaster ? x : tx, ay = atCaster ? y :
ty;` — so the two coordinates come from one decision instead of one and an
inference. Two lines.

**Not fixed** here only because it arrived with #27 in the same review and both
were held for one pass over `_drawCast`.

## #29 — 64 declared fx sprites have no file, and nothing says which are meant to

**Recorded, not a break.** The loader is built for missing art and says so; what
is missing is any way to tell art that has not been drawn yet from art whose
path is wrong.

**Reproduce.**

    node -e "const m=require('./assets/assets.json'),fs=require('fs');
      const fx=Object.keys(m.sprites).filter(i=>i.startsWith('fx.'));
      const miss=fx.filter(i=>!fs.existsSync('assets/sprites/'+i.replace('.','/')+'.png'));
      console.log(fx.length+' fx ids, '+miss.length+' with no png')"

**The numbers.** `assets/assets.json` declares 127 `fx.*` sprite ids. **64 have
no PNG on disk.** They split cleanly:

* **55** are class×shape ids from #123's generator. `SKILL_FX_SPRITE_IDS`
  (`js/content/skillfx.js`) is built by walking the live catalog so "a new
  class×shape cannot be forgotten", which declares 118 ids while 63 files
  exist. Only the samurai is complete (6/6); the wizard is 9/10; the other
  twelve classes sit at 3–4 of 7–9.
* **9** predate #123 entirely: `fx.block`, `fx.blood`, `fx.bonedust`, `fx.boom`,
  `fx.heal`, `fx.material`, `fx.smoke`, `fx.spark`, `fx.telegraph_mark`.

**Why this is not a visual defect.** #123's rule is that the canvas primitive is
drawn first and a sprite is an overlay on top of it, never a replacement
(`js/render.js`, the projectile and `_drawArc` paths). A missing sprite
therefore draws nothing and the authored canvas shape stands on its own — which
is the intended look, not a degraded one. `Assets.load` agrees and logs the
count at info level with a comment saying a long, shrinking list "is the normal
state of the project — it is not a warning and it is definitely not an error".

**What IS wrong.** The declaration and the authoring have no relationship that
anything checks. A typo'd path, a sheet dropped in the wrong folder and a
sprite nobody has drawn yet all present identically: one more number in
`64 still to be drawn`. Two authored files already sit on the other side of the
same gap — `fx.sam_smite` and `fx.wiz_smite` exist on disk while **no skill in
the catalog classifies as `smite`**, so nothing can ever draw them.

**What a fix would have to do.** Split "declared" from "expected". A manifest
entry could carry an `authored` flag, or `SKILL_FX_SPRITE_IDS` could be
intersected with a checked-in list of what art has actually been commissioned,
so the loader's count means "these are late" and anything outside it is an
error. That is a pipeline decision, not a patch.

**Not fixed** because deciding what a declared-but-undrawn sprite means is the
art pipeline's contract, and this file's job is to stop the next person
counting to 64 by hand.

**Partly addressed by the manifest cleanup (art/manifest-cleanup).** The
declared set is now exactly what `fxSpec()` can return over the live catalog:
`fx.impact` and `fx.muzzle` moved to the `FX` table, and the four class×shapes
no skill classifies as (`fx.sam_thrust`, `fx.sam_smite`, `fx.sam_shockwave`,
`fx.wiz_smite`) left the manifest — their PNGs stay on disk for the day a skill
uses the shape. Sprite ids now snake_case the shape (`fx.asn_ward_shell`, not
`fx.asn_wardShell`), which the loader had been rejecting. The declared-vs-
commissioned split above is still open.

## #30 — DPS summons taunt, and now fight the tank they stand beside

**Ruled, scheduled, deliberately not implemented here.** Recorded because the
conflict is live from the moment a Marrownaut is slotted, and the next person to
watch an enemy flip between a skeleton and its owner should find this rather
than re-derive it.

**Casey's ruling, for a later pass: DPS summons should not taunt. Defensive
summons should.**

**Reproduce.**

    node tools/summon_survival.mjs --seconds 90 --seeds 12

**What it is.** Three summons in the game taunt on their OWN attack, which is
what makes the minion — rather than its owner — the thing an enemy is sent at:
`tauntBy` is set to `p.minion`, and that is populated only when the taunting
attack is the minion's. Everything else with a taunt rider carries it on
`compose.0`, the owner's cast, and points enemies at the player.

| summon | taunt | tree |
| --- | --- | --- |
| skeleton | 1600 ms | `necro_summons` |
| the Monster | 3000 ms | `necro_summons` |
| druid bear | 2200 ms | `druid_beasts` |

**Why it is a conflict now.** Marrownaut's pull is a persistent field resolved
at step 3 of `tauntTarget`; a summon's taunt is a cast effect resolved at step
1. A Necromancer running Marrow-tank plus Summons therefore has both, and they
alternate: the skeleton wins its 1600 ms window, the field reclaims the enemy
between windows, and aggro oscillates for as long as both are on the field. The
precedence is correct — a deliberate taunt must beat a persistent state, and
that ordering is asserted in `tools/persist_gate.mjs` — so the fix is not a
precedence change. It is that a DPS summon should never have been asking for
aggro in the first place.

**Both Necromancer summons need classifying** when that pass happens. Neither is
obviously defensive: the skeleton is the tree's damage, and the Monster is a
single large body that reads as a tank until you look at what it does.

**Not fixed** because the classification is a design pass over every summon in
the game and it lands with the balance rebalance, not with the node that
exposed it.

## #31 — the HUD "⚔ 1" has no clear meaning

**From a map-1 playtest.** The number is on screen. Nothing next to it says
what it is.

**What it is.** Once a fight is no longer spawning and is not in the sweep,
`updateHud` (`js/ui/hud.js`) writes `⚔ ${n}` into `#enemy-counter`. `n` is the
alive count (`view.ec`, or the enemy list when that field is absent). The same
glyph is a weapon mark and the Samurai's symbol, so "⚔ 1" does not read as a
count of enemies. The "incoming" and "sweep" states of the same element use
words. This state does not.

**What a fix would have to do.** Name the count in that element, the way the
other two states already do.

**Not fixed** because this pass is the playtest log, not a HUD pass.

## #32 — `?seed=` is not honoured in co-op

**From a map-1 playtest.** A co-op URL carrying `?seed=` did not play that seed.

**What it is.** Nothing in `js/` reads a `seed` query parameter. `hostStartRun`
(`js/main.js`) uses `seedOverride ?? randomRunSeed()`. The override is a retry
of a region the host already rolled, and the start message broadcasts whatever
that function chose. A guest has no seed of their own to apply: the host's
start message is the run.

**What a fix would have to do.** Read the query on the host before
`randomRunSeed()`, and send that value in the start message the guests already
accept.

**Not fixed** because the playtest recorded the miss. The query is still unread.

## #33 — the skills button shows on the node map

**From a map-1 playtest.**

**What it is.** `startRunCommon` (`js/main.js`) calls `showHud(true)` for the
whole run, and `showHud` (`js/ui/hud.js`) unhides `#skills-btn` with the rest
of the HUD. The run begins on the node map (`app.runMode` starts as `'map'`),
so the button is up while that screen is up.

**What a fix would have to do.** Hide it on the node map, or decide that the
button belongs between rooms and stop treating its presence there as a defect.

**Not fixed** because which screens own the button is a screen decision, and
this entry only records that it is there.

## #34 — sprites under `item/`, `proj/`, `prop/` and `ui/` return 404s

**This was there before the plague-mark and Cascade work.** The loader asks
for every manifest path under `assets/sprites/`. Those four namespaces are
declared and have no files, so each request 404s. Missing art is the loader's
ordinary path (#29 is the same shape for `fx`).

**The counts**, from the manifest against disk:

| namespace | declared | on disk |
|---|---|---|
| `item` | 199 | 0 |
| `proj` | 21 | 0 |
| `prop` | 24 | 0 |
| `ui` | 8 | 0 |

**Not fixed** because the gap predates this branch, and a 404 on an undrawn
sheet is what the loader is built to absorb.

## #35 — opener cards show no picked indicator after a click

**From a map-1 playtest.**

**What it is.** `showOpening` (`js/ui/overlays.js`) paints each tier-1 choice
as a `.boon-card`. The click calls `pickOpening` immediately. Nothing sets a
picked or selected class on the card that was clicked, so the panel gives no
sign that the click landed before it closes.

**What a fix would have to do.** Mark the clicked card, then send the pick.
The send itself already happens.

**Not fixed** because the pick still goes through. The missing piece is the
indicator.

## #36 — (Low) a name label and damage numbers hide a plague mark when an enemy stands on the player

**From a map-1 playtest. Draw order, not the art.** The mark itself is the
redraw in `3e7be4f`. What covers it is later paint: the enemy's name and the
floating damage numbers, when that enemy is standing on the player.

**What a fix would have to do.** The designer will review the stacking order
for all overhead labels together. It is not a mark-size change, and it is not
a change to the plague sprite.

**Not fixed** in this pass. Low.

## #37 — `skillscreen_test` stops before the spend step

**Reproduce.**

    node tools/skillscreen_test.mjs

**What it is.** `startRun` in `tools/cdp_harness.mjs` clicks
`.world-card[data-region="…"]`. `tools/browser_test.mjs` clicks the same
selector. The world map draws `.world-pin` (`js/ui/worldmap.js`). The helper
throws `no region card` and never reaches the spend step. `.world-card` is
still styled in `css/style.css`. It is not what the map emits.

**Under plain Node 20.** The test crashes with `WebSocket is not defined`
before it reaches the selector. It needs `node --experimental-websocket` or a
polyfill.

**What a fix would have to do.** Point the shared helper at `.world-pin`. The
skill screen's own assertions are behind that click, so they do not run.

**Not fixed** because the selector is the browser harness, not the skill
screen, and this entry is the record of where the test stops.

## #38 — `applySlow` in `js/skillsim.js` does not reset an expired `slowMult`

**Found during the chill / slow status pass.**

**What it is.** `Sim._applySlow` in `js/game.js` resets an expired slow before
comparing multipliers (`const cur = e.slowT > 0 ? (e.slowMult || 1) : 1; e.slowMult = Math.min(cur, mult)`).
`applySlow` in `js/skillsim.js` writes `e.slowMult = Math.min(e.slowMult || 1, m)`
without checking `(e.slowT || 0) > 0`, and `js/entities/enemies.js` only stops
multiplying speed when `e.slowT <= 0` without resetting `e.slowMult` to `1`. A
weak composed-skill slow that lands after a deeper chill or slow has expired
inherits the old deeper `slowMult`.

**What a fix would have to do.** Reset `e.slowMult` to `1` when `(e.slowT || 0) <= 0`
before taking `Math.min` in `js/skillsim.js` (matching `js/game.js`). Fixed on
the chill status PR.
