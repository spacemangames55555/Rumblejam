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

**It does make the test suite flaky — this entry used to claim otherwise, and
that was wrong.** The original wording said "nothing in `tools/sim_test.mjs`
asserts tick-exact equality between two runs of one seed", which is true and
beside the point: the **DPS gate** measures each character's damage in a live
fight and asserts it lands within ±40% of the roster median. The fight is not
reproducible, so neither is the measurement. On unchanged `origin/main`, two
consecutive runs:

| character | run 1 | run 2 |
|---|---|---|
| `jester` | 29.7 (+32%) | 28.4 (+26%) |
| `voltaic` | 26.4 (+17%) | 27.0 (+20%) |

`jester` and `gilded_one` sit in the low 30s against a 40% wall, so a run
occasionally pushes one over. **Seen twice in 28 runs across two branches**
(2026-08-05), always as `✗ DPS gate: 1 outlier(s)`, never the same character
twice. Re-run before believing a lone DPS-gate failure; a real regression
repeats.

That makes this defect the answer to a question the suite will keep asking, and
another reason to fix it rather than live with it.

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

# Open again

## 6. The shop still stocks weapons no character can equip

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

**Not fixed here** because the shop's role after the weapon removal is a design
question this patch has no mandate to answer, and guessing at it would bury the
decision in a region-shell commit.

---

## 7. The browser suite deleted committed sprite art on every run

**Fixed 2026-08-06.** `tools/browser_test.mjs`, the 8-direction sprite-grid
block.

**What was wrong.** The test writes fixture PNGs to three paths and cleans up
after itself:

```js
// Remove ONLY the files this test wrote. A blanket rmSync of assets/sprites
// would delete committed art, which is a destructive test, not a cleanup.
const removeArt = () => {
  for (const f of [gridFile, badGridFile, flatFile]) fs.rmSync(f, { force: true });
```

The comment is right about the danger and wrong about the facts. All three paths
are **committed art**:

```
assets/sprites/enemy/skulker.png    tracked=YES
assets/sprites/enemy/flit.png       tracked=YES
assets/sprites/fx/material.png      tracked=YES
```

The test did not *write* those files, it *clobbered* them — so the cleanup
deleted three tracked sprites from the working tree on every run. Nothing failed
and nothing warned; the files were simply gone. A later `git add -A` commits the
deletion, which is how art leaves a repository without anyone deciding to remove
it. This was caught exactly that way: a commit hook reported three deleted PNGs
as uncommitted changes to be pushed.

**Reproduce (pre-fix):**

```
md5sum assets/sprites/enemy/skulker.png > /tmp/before
node tools/browser_test.mjs
git status --short -- assets/
  D assets/sprites/enemy/flit.png
  D assets/sprites/enemy/skulker.png
  D assets/sprites/fx/material.png
```

**Why the sibling block was safe.** The sprite-override test forty lines below
uses `slabjaw.png`, `lobber.png` and `gemmite.png` — none of which are tracked —
and it *also* reads `assets.json` and `sprite-overrides.json` into memory before
touching them and restores them in `finally`. The correct pattern was already in
the same file, applied to the JSON and not to the PNGs.

**The fix.** Originals are read into memory before the fixtures are written and
restored byte-for-byte afterwards. A path with no original (genuinely created by
the test) is still removed.

**What holds it now.** Nothing automated, and that is worth stating plainly
rather than implying a gate exists. The check is one command after any suite
run — `git status --short -- assets/` — and the honest guard would be a suite
that fails when it dirties the working tree. That is not built.

---

## 8. A co-op event sent while a peer's channel is not open is lost forever

**Where:** `js/net.js` `broadcast()` and `js/main.js` `drainSimOutputs()`.

```js
// js/net.js
broadcast(msg) {
  for (const c of this.conns.values()) {
    if (c.open) { try { c.send(msg); } catch { /* ignore */ } }
  }
}

// js/main.js
const list = sim.events.splice(0);          // <- gone from the queue
if (app.hostT) app.hostT.broadcast({ t: 'ev', list });
```

**What is wrong.** The event list is spliced off the queue and broadcast once.
A connection that is not `open` at that instant is skipped, a `send` that throws
is swallowed, and there is **no buffer, no replay, no acknowledgement and no
error**. The event is simply gone for that peer, permanently.

Snapshots recover from this — they are sent 15 times a second and carry whole
state. Events do not: they are one-shot edge notifications, and several of them
are load-bearing for what a client can even see.

**What a player experiences.** The node map is the clearest case. A client opens
it only when it has BOTH `mode === 'map'` from a snapshot AND `app.map`, which
is set *only* by the `map` event (`js/main.js:580`, `js/main.js:1027`). Miss that
one event and the client sits on a blank screen, receiving snapshots, with no
error, while the host plays on. Measured directly:

```
CLIENT MAP DIAG: {"mode":"run","map":"screen hidden","snaps":30,"lastMode":0,"nodes":0}
CLIENT ERRORS:
HOST STATE:      {"mode":"run","phase":"map","cleared":false}
```

Thirty map-mode snapshots arrived, zero console errors, screen still hidden.

**Reproduce:**

```
node tools/browser_test.mjs --coop
```

The co-op block fails intermittently at whichever assertion the lost event
happened to gate. Observed across seven runs on two branches:

| failure point | `patch-region-shell` | `patch-telegraphs` (331898b) |
|---|---|---|
| `host run` | 0/5 | 1/4 |
| `client map screen` | 5/5 | 1/4 |
| `host pair` (late, weapon-related) | 0/5 | 2/4 |

**It is not a regression in either branch** — the same assertion fails on both.
The distribution differs (one branch lands on the same assertion every time,
the other scatters), which is what a timing-sensitive race does when startup
work changes around it.

**What has been ruled out.** Not pairing: registration and join-by-code
succeeded 6/6 across both trees, with the built-in registration retry never
firing. Not a client exception: the console is clean at the moment of failure.
Not the region-shell modules: `regions.js`, `nodetree.js` and `saves.js` are
imported by nothing in the runtime.

**What a fix would have to do.** Give events the delivery guarantee they are
already assumed to have — a per-peer outbound queue that survives a
not-yet-open channel and flushes on open, or a sequence number the client can
detect a gap in and request a resync for. Either way the host must stop
discarding an event list before every peer has actually taken it.

**Not fixed here** because it is netcode surgery well outside a region-shell
patch, and because the right shape (buffer vs. resync) is a decision about the
protocol, not a bug to patch locally.
