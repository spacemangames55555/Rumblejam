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
Reflex dodge roll, material scatter, wander points, boss teleport targets.

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

**What this does not prove.** The original symptom was intermittent
`timeout waiting for client ready` in the full co-op suite, and that suite
cannot currently reach its co-op phase reliably for an unrelated reason (see
the note on dead weapon tests in §9). The failure mode is reproduced and fixed
under deliberate injection; it has not been observed absent in the wild,
because the wild run is blocked.

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

### Still open

**The original symptom is not confirmed fixed, and no root cause is claimed.**
Registration measures healthy, so the fixes above are for real defects found by
reading the code and by instrumenting the harness — not for a cause anyone
observed. Cases 1 and 2 remain live possibilities and neither has been seen
since the instrument was fixed. What has changed is that the next occurrence
names which one it was; before, all three printed the same sentence.

**Not to be closed on an absence of failures.** With a 1-in-3-or-4 rate, a
couple of clean runs is not evidence. It closes when a run reproduces it and
the new diagnostic says what it was, or when enough co-op runs accumulate to
put that rate out of reach.

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
