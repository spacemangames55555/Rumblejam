# Rumblejam — Game Design Document

**Draft 10 · August 2026**
**Status: authoritative.** This file supersedes all prior drafts. Where this document and any other source disagree, this document wins — except for tuning constants, where the per-tree `TUNING` blocks in code are authoritative and this document records intent.

**Reference convention:** a bare §N means this document. Any other source must be named inline.

**How to read this.** Plain text is settled design. Blocks marked **PROPOSED** are not settled and should not be built without a ruling. §15 group B lists design questions awaiting a decision. §16 records implementation status per system.

---

## 1. Concept

Rumblejam is a browser-based co-op action RPG for up to 8 players, played from a link and a room code. Players are monster slayers working through the mythologies of the real world — a swamp, an Egyptian necropolis, a Russian tundra, a Celtic grassland — hunting the creatures, spirits, and old gods native to each region.

Combat is twin-stick movement and positioning. Players do not fire manually. Every ability triggers automatically from a condition the player controls through **where they stand and how they move**, and directs itself by a **selection rule the player chooses when building**. The build decides both what the player's movement means and what their damage lands on.

### 1.1 Design pillars

- **Move and react, not menu and think.** Combat stays fast and physical. All complexity lives in the build screen, never in the fight.
- **Engine, not multiplier.** Every class has a distinct mechanical engine. No class is another class with bigger numbers.
- **A link and a room code.** No accounts, no installs, no setup. Any friction added here is a design failure.
- **Trade-offs make decisions.** Power without cost is not a choice. Items, skills, and map routes all cost something.
- **The world is the progression.** Advancement is measured in territory conquered, not in a number going up.

---

## 2. Run Structure

### 2.1 Definitions

| Term | Meaning |
|---|---|
| Map | One playable dungeon, comparable to a floor in the pre-overhaul build |
| Region | A themed area containing 10 maps on a tree, plus a boss map |
| Run | A full game across all 8 regions, persisting across many sittings |
| Character save | One object: class, level, points, items, frontier, parked region state |

### 2.2 Structure

- **8 regions**, fixed order, 1 through 8.
- Each region presents **10 maps on a branching tree**. The player clears **5** to reach the boss.
- Clearing the **region boss** unlocks the next region.
- **6 maps per region × 8 regions = 48 maps** in a full run.

Picking 5 of 10 means a region replays with roughly half new content, and gives every region a route decision without touching global difficulty.

### 2.3 The map tree

Ten nodes in **five columns of two**. Entry connects to both column-1 nodes; each node links forward to one or two nodes in the next column; both column-5 nodes reach the boss gate.

```
        ┌─ A1 ─┬─ A2 ─┬─ A3 ─┬─ A4 ─┬─ A5 ─┐
ENTRY ──┤      ╳      ╳      ╳      ╳      ├── BOSS
        └─ B1 ─┴─ B2 ─┴─ B3 ─┴─ B4 ─┴─ B5 ─┘
```

Every path is exactly five nodes **by construction**, not by validation. Cross-links randomise per generation (`CROSS_LINK_CHANCE = 0.45`) so routes diverge and reconverge without changing path length.

### 2.4 Node types

Distribution per region: **4 Horde, 2 Elite, 2 Objective, 1 Shrine, 1 Cursed.**

| Type | Contents |
|---|---|
| Horde | Standard arena wave combat |
| Elite | ×0.55 count, ×2.4 HP, ×1.35 damage, ×1.35 gold, 75% drawn from the region's heavy half |
| Objective | One of the 8 existing objective types |
| Shrine | No combat. Party chooses: +1 skill point **or** one guaranteed shop reroll. Never both, never rolled |
| Cursed | Region modifier active for that node only, ×1.6 gold |

Placement: Shrine and Cursed may not sit in column 1; both Elites may not share a column. Node type is **visible before selection** — the route decision does not exist otherwise.

**What each type is for.** §2.3 exists to create a route decision, and a route decision needs the nodes to reward different builds. The deep-versus-wide sweep at the level-70 anchor (`tools/shape_by_node.mjs`) says they do, and says which way:

| Type | Deep/wide | What it asks |
|---|---|---|
| Horde | 1.33, depth wins 4/6 trees | **Asks the build question.** Many thin enemies reward the specialised answer; a spread build clears the room more slowly than a signature does |
| Objective | 0.82, depth wins 0/6 trees | **Prices breadth.** A structure to hold rather than a crowd to delete — the only shape where spreading points is the better buy, and therefore the only place a breadth build gets paid. Unanimous: every tree, both classes |
| Elite | 1.18, depth wins 4/6 trees | **Compresses the spread.** Depth still wins, but by a narrower margin than in a horde — few-and-fat pulls the two shapes together rather than reversing them |

Region-weighted across the 4/2/2 combat mix: **1.16**. Depth wins a region, but not by enough to make breadth a mistake — which is the shape §4.2 wants and is why no per-class breadth cost was added. The design consequence is that Objective is the node a breadth build routes *toward* and Horde is the one a depth build routes toward, and both are visible on the map before the choice is made.

Depth scaling within a region: `depthMult = 1 + 0.08 * (column - 1)`. Resets each region.

The tree regenerates from the region's node pool on party wipe. A failed region never replays identically.

### 2.5 The world map

A **lobby, not a hub**. No shops, no vendors, no walking around. Shows the eight regions with frontier gating and a stated reason on every locked card, each player's character and level, party difficulty, unspent points, and loadout editing.

---

## 3. Regions

Fixed order, permanently tuned to a difficulty band. Because the order is fixed, each region's enemies, hazards, and boss are hand-authored against a known player power level.

### 3.1 Scope

**Eight regions is the complete game.** The target is eight regions fully developed rather than a larger number partially realised. Anything beyond region 8 is a post-launch expansion. No system should be built to accommodate hypothetical regions 9 and up.

### 3.2 The eight regions

| # | Region | Native class | Domain skew | Mythology |
|---|---|---|---|---|
| 1 | Pacific Northwest | Druid | Physical | Coast Salish and Cascadian folklore, forest spirits, old-growth beasts |
| 2 | Central America | Savage | Spiritual | Aztec and Maya underworld, jaguar cults, Xibalba |
| 3 | Great Britain | Bard | Mental | Celtic myth, fae courts, standing stones, hill gods |
| 4 | Egypt | Wizard | Spiritual / Mental | Ancient Egyptian necropolis, animal-headed gods, tomb constructs |
| 5 | Central Africa | Witch Doctor | Spiritual / Physical | Primal Congo spirit cosmology, swamp, rot, masked ancestors |
| 6 | Northern Russia | Necromancer | Physical / Mental | Slavic myth, frozen dead, deep-winter horrors |
| 7 | Off Indonesia | Sundian | Mental | Sunken aquatic city, drowned Sundaland, tide gods |
| 8 | Australian Outback | Hunter | Even across all three | Aboriginal Dreaming, desert megafauna |

No region exceeds **60%** one domain. Region 8 is deliberately even, so the endgame demands full party coverage rather than one counter-build.

### 3.3 The roster

**There is one roster: the fourteen classes in §8.2.** The 33-character classic roster was pre-overhaul content and has been retired to `archive/classic-roster/`. Roster-switching machinery, `setRoster()`, and the silent `charId` fallback are all removed — an unknown id now throws, because a fallback that kept a character's stats while losing its trees is how a totally unplayable party survived an entire patch.

**Take the design from the archive, not the data.** Archived traits are engine hooks keyed to `trait.key` values that mostly no longer exist.

### 3.4 Class unlocks and selectability

The **six non-region classes are the starting roster** — Blacksmith, Mage, Samurai, Monk, Assassin, Priest. The **eight region-native classes unlock by clearing their home region.** Unlocks live on the **player**, not the character — the point of unlocking the Wizard is to create a *new* Wizard.

Clearing region 8 completes the run. The Hunter unlocks at that moment and pays off on the next character.

**Selectability is derived from tree data, not listed.** A class is selectable when it has a tree with a damaging tier-1 active; otherwise it is visible, greyed, and states why. As phase 5 authors trees, classes become selectable with no code change.

The lobby card is an affordance, not a boundary: the host validates the pick and the sim refuses to start on an unplayable class, because a client can send anything.

Asserted at load: every selectable class has a tier-1 active **carrying damage**. "Has a tree" is not enough — a tree of passives arms nobody.

### 3.5 Region identity checklist

1. A tileset and palette recognisable in one frame.
2. **Six or more enemy archetypes**, at least two unique to the region.
3. **One environmental hazard** that changes how players move.
4. **A damage-domain skew** per §3.2.
5. **One boss** with at least two phases and a mechanic that is not a bigger normal enemy.
6. **One Cursed modifier** unique to the region.
7. **Telegraph density at or above 50% by encounter weight** — see §6.4.
8. A node pool large enough to generate a varied 10-node tree.

### 3.6 Where to spend effort

Region 1 is played more than regions 6, 7 and 8 combined — every new save starts there, every new player's first impression is there, every wipe replays it. It gets the most map variety, the most polish, the most archetypes. If scope must be cut, it is cut at the top of the list.

---

## 4. Difficulty and Scaling

### 4.1 Three separate axes

| Axis | Granularity | Controls |
|---|---|---|
| Region band | Coarse, permanent | Baseline enemy HP, damage, density, archetypes |
| Map depth | Fine, within region | Escalation across the 5 chosen maps plus boss |
| Difficulty setting | Party-selected | Global multiplier, adjustable per region |

Four difficulty settings scale HP, damage, density, and gold. **Standard is exactly 1.0 on every axis**, and the ladder is monotonic — otherwise two settings are the same choice.

**XP is never scaled by difficulty.** Asserted at load: a difficulty declaring an XP multiplier fails import. If the hardest setting paid more XP it would stop being a preference and become the only correct choice.

The difficulty setting's primary purpose is replay — a maxed character levelling an alt through region 1.

**Measured, not declared** (`tools/difficulty_gate.mjs`). The table above was true and unreachable from phase 2b until D-24: `difficultyOf()` was called from one function, and that function had no callers. The load assertion passed the whole time because it checked that 1.3 is bigger than 1.0 in a table nothing read. What a 60-second room now fields, per setting:

| Setting | Density | HP | Damage | Gold | XP per kill |
|---|---|---|---|---|---|
| Measured | ×0.87 (0.85) | ×0.87 (0.85) | ×0.89 (0.85) | ×0.93 (0.9) | 1.86 |
| Standard | 1.00 | 1.00 | 1.00 | 1.00 | 1.78 |
| Harrowed | ×1.23 (1.2) | ×1.26 (1.3) | ×1.28 (1.25) | ×1.29 (1.35) | 1.70 |
| Unmade | ×1.56 (1.45) | ×1.69 (1.7) | ×1.53 (1.5) | ×1.76 (1.8) | 1.74 |

Four axes move in the declared direction and within 25% of the declared magnitude; the fifth is flat within 10%, which is §4.1's exclusion observed rather than asserted.

Two things had to change for the gold axis to be real. **A multiplier applied to an integer of 1 or 2 rounds to identity** — the gold factor was scaling `e.mats` at spawn, where `Math.round(1 × 0.9)` is 1, so every setting below Standard paid exactly Standard's gold. It now multiplies on the kill path with the fraction carried across kills. And because gold and XP had ridden the same number since phase 1, more gold meant more XP: **each dropped material now carries its own XP value**, and the extras a difficulty adds carry zero. A player's own doubling hook still carries XP with it — the exclusion is on the difficulty axis, not on multipliers in general, because a hook the player built for is a build paying off.

The measurement denominator is its own lesson. The first version of the gate stood a level-1 character still, divided by the 0.02–0.06 materials it had banked per enemy, and reported the game paying ×0.58 where the table says ×0.9. The game was right; the denominator was a bot's walking pattern. Gold and XP are now read from `sim.payout` — what the kill path paid, per enemy killed — with the banked figures kept only as the end-to-end check that the zero-XP split survives the pickup path (Harrowed banks 1.33 materials per XP against Standard's 1.00).

### 4.2 The player power curve

- **1–2 levels per map.** Across 48 maps this produces a character in the **low 70s** at the end of a run.
- **No rank cap.** A skill accepts unlimited points.
- **Per-rank increment: +4% of base damage, +3% of base duration, linear against base.** Never compounding — `damage *= 1.04` per rank is explosive at rank 40.
- **Ranks raise damage and duration only.** Not radius, not cooldown, not projectile count, not trigger thresholds.

#### Why no cap self-balances

Skills fire on cooldowns. A character running few skills has long gaps and spiky damage. A character running many has syncopated fire rates and smooth damage, but each skill is under-invested and hits softly. Neither extreme wins; the optimum sits in the middle and moves with enemy HP and density.

#### MEASURED — the claim holds, but across a region rather than within a fight

`tools/shape_by_node.mjs` measures deep-versus-wide for six trees at the level-70 anchor, in four encounter shapes rather than one. **Depth does not win everywhere, and where it wins depends on the node.**

| tree | Horde | Elite | Objective |
|---|---:|---:|---:|
| `samurai_armor` | 2.42 | 1.00 | **0.93** |
| `samurai_tactics` | 1.63 | 1.25 | **0.86** |
| `necro_marrow` | **0.25** | **0.48** | **0.61** |
| `necro_dark_matter` | 1.02 | 1.76 | **0.82** |
| `necro_summons` | 1.86 | 1.65 | **0.91** |
| `druid_beasts` | **0.80** | **0.92** | **0.79** |
| **depth wins** | 4/6 | 4/6 | **0/6** |
| **mean ratio** | 1.33 | 1.18 | **0.82** |

Measured against a **real** Elite node — §2.4's modifiers applied, not reconstructed (D-24). Elite fields 69 enemies at 23 HP against Horde's 118 at 9.

The Elite column moved when the gold multiplier moved to the kill path: a node paying ×1.35 gold now drops extra materials, each drop consumes the shared RNG stream, and the sequence downstream differs. Horde and Objective, which pay ×1.0, are unchanged to the digit. That is worth stating rather than quietly re-running — **a balance number carries the build it was measured on**, and this one is measured on the build where difficulty and node gold are both real.

**Objective nodes favour breadth in every tree measured.** A nest is a structure to reach past tough company, and covering several situations beats doing one thing hard. Horde and Elite both favour depth in four of six.

**Elite pulls toward breadth, but by less than the reconstruction suggested.** Its mean is 1.18 against Horde's 1.33 — a real narrowing, and it pulls the extremes in from both ends (`samurai_armor` 2.42 → 1.00, `druid_beasts` 0.80 → 0.92). Fewer-and-fatter compresses the spread rather than reversing it. **Objective, not Elite, is the node that prices breadth.**

**Region-weighted, the claim holds.** §2.4 gives a region 4 Horde, 2 Elite and 2 Objective combat nodes. Weighted by that mixture the ratio is **1.16** — mildly depth-favouring, not the runaway a single horde arena suggests.

So the optimum sits in the middle **across a region, not within a fight**. A player who optimises for the horde nodes pays for it at the objective, and the route decision in §2.3 is what prices the choice. **No per-class breadth cost is needed**, and the Druid's revive scale is a flavour of its engine rather than the only thing holding the design up.

**CORRECTION to the previous entry.** This section briefly claimed depth won in "three of four measured trees" at the endgame. That was drawn from a four-tree table which omitted `necro_marrow` and `necro_dark_matter` — both breadth-dominant in the same run. The full six-tree set was 3 deep / 3 breadth even in a single arena, and the conclusion was an artifact of a subset chosen for a table rather than a measurement. A ratio reported over a chosen subset is not a finding.

#### Measure a ratio at more than one level, and in more than one arena

Two anchors matter because a rank-11 skill is 92% of a level-12 character's points and 16% of a level-70 one's. **Capping skeletons from the level-12 ratio would have capped the endgame using the tutorial.**

Two *arenas* matter for the same reason in a different axis. The single-arena reading also depended on a harness detail: an early version of the sweep restored the player to full HP every tick, which reported `druid_beasts` at 1.46 where a survival-faithful harness said 0.69 — the same tree at the same level, two answers. Two harnesses disagreeing means one is measuring something else.

#### The two levers that must stay off ranks

**Cooldown** is load-bearing. If deep investment bought both damage and uptime, wide builds would lose on every axis and the tension would collapse. A narrow build must always pay in gaps. **Cooldown reduction is off ranks and off items.**

**Radius** is off ranks. Radius growth comes only from modifier items, which raises the item pool's value and keeps skill investment about output.

#### Rank-1-only passives

**A passive granting neither damage nor duration is rank-1 only.** It is an unlock, not an investment.

This ruling exists because "ranks raise damage and duration only" said nothing about a passive granting max stacks or accrual speed, and the ambiguity resolved toward the most permissive reading available — which breached a designed hard cap. Left unstated it recurs across all ~420 skills.

Enforced at import **and** in `canLearn`. A cap that lives only in a data file and an assertion is a label. Classification is a declared registry; an unclassified passive key fails the load.

#### Engine capacity is a declared exception

One skill in the game breaks "damage and duration only": **Raise Skeleton**, where each rank grants one summon slot (§8.5).

It is written as an explicit declaration — `rankGrants: 'summonSlots'` — and asserted at load, so no other skill can acquire the behaviour by accident. This matters because the unstated version of exactly this already happened once: Set Stance granted max Footing stacks per rank, nothing in the rules covered it, and it silently breached a designed hard cap.

**An engine capacity granted by rank must be declared. There is currently one, and adding a second is a design decision, not an implementation detail.**

### 4.3 Enemy scaling

Authored per region band, not computed from a global curve. Expected player level on entry:

| Region | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Level | 1 | 10 | 19 | 28 | 37 | 46 | 55 | 64 |

If a party arrives significantly above or below the anchor, that is the difficulty setting doing its job, not a bug.

---

## 5. Combat Model

### 5.1 The core change

Weapons are gone. Skills replace them, and conditions replace the firing timer. A skill does not fire because time passed; it fires because the player created the situation it was waiting for.

**Two separate jobs.** A trigger decides **when** a skill fires. A selector decides **what it hits**. Both are declared per skill, and both are build decisions.

### 5.2 Trigger taxonomy — *when*

Every active declares exactly one trigger and one cooldown. Triggers evaluate **on the host only**, on a fixed interval.

| Trigger | Params | Fires when |
|---|---|---|
| `PROXIMITY` | `radius`, `count` | `count` or more enemies within `radius` |
| `NEAREST` | `range` | Any enemy within `range` |
| `ISOLATED` | `radius`, `count` | Fewer than `count` enemies within `radius` |
| `ON_KILL` | — | The owning player kills an enemy |
| `ON_HIT_TAKEN` | — | The owning player takes damage |
| `ON_DODGE` | `window` | Player was inside a committed zone at commit and outside at resolve |
| `SELF_THRESHOLD` | `pct` | Own HP crosses below `pct`, edge-triggered |
| `TARGET_THRESHOLD` | `pct`, `range` | An enemy within `range` drops below `pct` HP |
| `ON_STATUS` | `status`, `range` | An enemy within `range` carries `status` |
| `MOVEMENT` | `mode`, `seconds` | Moving or still, sustained |
| `ON_TOKEN` | `range` | A soul token lies within `range` — see §8.5 |

**No unconditional trigger.** There is no "fires when off cooldown" kind and none may be added. The moment one exists it becomes correct for every skill, positioning stops mattering, and the game is an idle auto-battler. Any trigger added later must still depend on a player-controllable condition.

`ON_TOKEN` is the eleventh trigger and the only addition since the taxonomy was written. It qualifies because a token exists only where the player killed something — the condition is created by play, not by waiting.

`ISOLATED` is true in an empty room — a skill rewarding solitude should not also require company. Steps needing a target no-op when there is none.

### 5.3 Selectors — *what*

Every active declares a `select`. **There is no default**, and a missing selector fails at load.

```js
trigger: { kind: 'PROXIMITY', radius: 140, count: 3 },   // when
select:  'highest_hp',                                    // what
```

| Selector | Picks |
|---|---|
| `nearest` | Closest valid target |
| `farthest` | Most distant within range |
| `highest_hp` | Fattest target — elites, heavies |
| `lowest_hp` | Weakest — finishers, execution |
| `densest_cluster` | The point maximising enemies hit |
| `objective_target` | Role-tagged objective entities: nest → mark → boss → elite, distance as tiebreak |

#### Why selectors exist

Weapons had varied targeting rules built in — a shotgun hit everything close, a sniper took the farthest or fattest, a homing weapon tracked one thing — and the player chose the rule by choosing the weapon. The first trigger taxonomy collapsed all of that into position and health fraction, so every skill converged on *whatever is nearest*, and chaff is always nearest.

The measured consequence: an armed necromancer dealt 4230 damage in Elite Arena with **zero kills**, spreading it across forty enemies instead of concentrating into one, and never damaged a single nest across a full Nest Purge. Objectives assume the player can choose targets. Splitting selection out of the trigger restored that as a build decision — after the split, the same test cleared Elite Arena outright.

#### Two rules selectors must obey

1. **A selector re-ranks only what the skill's own range already returns.** It never widens the search. A selector that could reach past a skill's range would silently hand every skill infinite reach.
2. **A selector never picks a target that cannot be hurt.** `objective_target` skips shielded nests — preferring one would fire into a wall while the ring that drops the shield went unkilled.

A passive declaring a selector is an error.

### 5.4 Evaluation

```
TRIGGER_TICK_MS            = 100    // 10 Hz
GRID_CELL_PX               = 128
MAX_TRIGGER_EVALS_PER_TICK = 256
```

Cooldown is tested **before** any spatial query. This ordering is most of the performance win — measured at 8 players, 20 skills, 8 slots, 200 enemies: 25.8 evals/tick, 0.280 ms median, 0 cap hits. Roughly 0.9% of a 60 fps frame.

Clients never evaluate a trigger, never decide a skill fired, and never predict locally.

### 5.5 The loadout

Passives are always on; actives must be slotted.

| Slot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Level | 1 | 5 | 12 | 21 | 31 | 42 | 54 | 66 |

**8 slots is a hard ceiling** — beyond that the screen stops being readable on a phone.

**Anti-softlock floor:** the loadout UI refuses to leave a player with zero damaging actives slotted. With a 1-slot start this is load-bearing from the first minute.

Loadout changes happen at the world map, at Shrine nodes, and between rooms — never mid-fight.

### 5.6 The opening ability

Characters start with **no abilities at all**. The first point spent is the character's opening ability, chosen from the tier-1 nodes of their trees. **Every tree's tier-1 node must be a damaging active**, asserted at load.

### 5.7 The composed-action schema

Any active is data: an ordered list of steps from thirteen primitives plus riders.

**Primitives:** `strike` · `bolt` · `cone` · `line` · `hazard` · `heal` · `shield` · `ward` · `drain` · `summon` · `plague` · `shift` · `trap`

**Impact riders** (land wherever damage lands): `stun` · `taunt` · `root` · `knockback` · `slow` · `weakenDamage` · `weakenDefense` · `healPerHit` · `mark` · `doll` · `drench` · `sluice`
**Shape riders** (shape a swing): `arc` · `windUp` · `multiPulse`
**Projectile riders:** `pierce` · `splash` · `impactDot` · `defenseDown`

This decomposition replaced an earlier per-primitive rider split that could not express a bolt carrying `weakenDamage`.

**Hard rule: every number lives in its tree's `TUNING` block. No constant is ever inline in behaviour code.**

**Result:** 200 skills across 20 trees, zero bespoke handlers. Summons were the largest bespoke category in the source project and cost one primitive and one trigger (§8.5). The Wizard and the Priest each cost a write path ruled ahead of their trees and then nothing else — two publish lines apiece.

#### The primitive set is OPEN, and what admits a twelfth

The set was eleven from phase 1 to phase 5 and the discipline that kept it there is worth stating, because it is now twelve and will not stop on its own.

**A primitive is admitted when a class engine needs a WRITE PATH no existing primitive provides.** Not when a skill would read nicely as one, not when a class has a distinctive verb — those are compose steps, and the whole point of the schema is that a distinctive verb is a list of existing steps. The bar is that content cannot produce the state at all.

**Ruled before the tree, never during.** This carries the same weight as `rankGrants` and is enforced the same way: `rankGrants` is a declared, asserted-at-load exception because the unstated version of it silently breached a hard cap once. A primitive added while authoring a tree is a design decision made by whoever happened to be writing content that afternoon.

**Three conditions, all of them:**

1. **No existing primitive writes the state.** Demonstrated, not asserted — `bestDomainMult` read `p.hookAgg.domainAdd` and nothing else, and the only primitive writing a domain at all was `ward`, writing `p.wardDomain` for the ward's reflect.
2. **A rider will not do.** Riders resolve on a target at the moment of impact. State on the *caster* has no impact to resolve on, which is why the Priest's mark is a rider and the Wizard's shift is a primitive: one writes the enemy, the other writes the player.
3. **The write path passes its gate before a single tree is authored against it.** `engine_gate` for a caster-state primitive, `rider_gate` for a rider — and `rider_gate` now probes riders no content declares yet on a synthetic host, precisely so a write path can be proven in the window between ruling and authoring.

**The twelfth is `shift`** (§8.3, the Wizard). Recorded here rather than in a commit message so the thirteenth has to argue against the same three conditions.

**The thirteenth is `trap`** (§8.3, the Assassin), and it argued against them. Both cheaper options were tested first and both were rejected on the conditions rather than on taste:

- **Could `hazard` carry it with a dormant flag?** No — and the demonstration is what a zone IS, not what it looks like. `addZone` makes `{t, acc, x, y, r, dps, dur, hurts}`, and the zone tick advances a clock, accumulates against a cadence, damages everything inside every 0.4 s, applies the slow rider and splices the zone at `t >= dur`. A trap does **none** of that: no cadence, no damage while it sits there, and it ends by being **consumed** rather than by expiring. Carrying it on `hazard` means a dormant flag, a branch in the tick that skips every single thing the tick does, a payload the tick must ignore, and a consumption path — at which point the object shares its geometry with a zone and not one of its behaviours. That is condition 1 answered by demonstration: no existing primitive writes an inert object.
- **Is the detonation a rider on the triggering skill?** No, and **condition 2 is exactly the test**. Riders resolve on a target at the moment of impact; a detonation has neither. The skill that sets a trap off may be a heal, a shield, a ward or a shift — none of which touches an enemy — so there is no impact to hang it on. What the moment has is a *cast at a position*, which is caster state. By the same condition that made the Wizard's shift a primitive rather than a rider, the detonation is a property of the **object**, checked in `fireSkill` where casts are already observed.

There was also a cost that is not aesthetic: `fireSkill` runs on every cast in the game, so scanning `sim.zones` — which holds enemy hazards, objective hazards and every player's ground — to find one class's traps would be O(all zones) on every cast forever. `sim.traps` is O(traps).

#### What a primitive owes the world, not just the enemy

A primitive that deals damage is not finished when it has damaged bodies. **`game.js` has one rule for destructible scenery — "every splash, nova and blast chews barricades as well as bodies" — and every damage primitive owes it.** `strike`, `cone` and `line` did not pay it for an entire era, so a melee class could not take down a Nest Purge barricade at all; see D-27 in §15 and §13 rules 30 and 31.

| Primitive | Barricades | How |
|---|---|---|
| `strike`, `cone` | yes | `_sweepWalls` at the step's own reach, **full circle** — a barricade in reach is struck regardless of which way the swing aimed (§13 rule 31) |
| `line` | yes | `_areaDamageWalls` at the beam's clipped end: the beam stops at the wall, so the wall it stopped on takes the hit |
| `bolt` | yes | already, via the friendly-projectile tick |
| `hazard` | yes | already, via the zone tick's `_areaDamageEnemies` |
| `drain` | **no, by design** | single-target on a living thing, paying the caster back out of what it took. There is nothing to drain from a barricade, and giving it one would invent a behaviour rather than restore one |

**A thirteenth primitive that deals damage must answer this table before it is admitted.**

### 5.8 Engine scaling — `scaleWith`

A step may declare `scaleWith: '<engine>'` and `scalePer`, reading `p.engines[name]`. **The hook knows no engine by name.** Footing and Marrow's `armor` engine both ride it with zero engine-specific code.

This is what makes the remaining class engines data rather than engineering — but only the READ side (§13 rule 29). `shift` and `marks` joined `footing`, `armor` and `pack` on this hook with no change to it at all; what each of them cost was a **publish line**, and two of them cost a write path before that. Cascade, drench, crystallize, Chi, killbox and two bodies still owe the same two answers.

### 5.9 Selection is not delivery

A selector picks the right entity. Whether damage reaches it is a separate question.

Measured on a bounty mark: 23 of 23 shots correctly selected the mark; **2 arrived.** The other 21 were intercepted by the escort pack that spawns with every mark by design — `bolt` stops at the first body it meets.

**This is intended.** Escorts are a wall you clear first, and that is what distinguishes a mark from a nest. **`pierce` remains a §9.2 modifier item**, not a property of `objective_target` — a party that wants to punch through buys it and slots it, which is a build decision with a cost.

Consequence: until phase 4 ships modifier items, bounty marks are clear-the-escort-first. Tests for this objective assert **selection correctness**, never mark kills, so a throughput change cannot silently satisfy a targeting test.

---

## 6. Telegraphs

Not present in Draft 7. Added because `ON_DODGE` had nothing real to bind to, which made the Footing decision unjudgeable — and because positional combat is only readable if a player can see what is about to hurt them and where.

### 6.1 State machine

```
IDLE  →  WINDUP  →  RESOLVE  →  RECOVER  →  IDLE
```

**The danger zone is computed once at the start of `WINDUP` and never updates.** The enemy does not track the player through the wind-up. A committed attack is a promise about a piece of ground, which is what makes stepping off it a skill rather than a stat. An enemy that reaims produces an undodgeable attack.

An enemy commits only if the zone it just built **actually contains someone**. Committing against a target already outside the zone produces attacks nobody was ever caught by — which reads as "telegraphs feel bad" and is not.

Knockback during `WINDUP` moves the enemy but **not** the zone. A stun during `WINDUP` cancels the attack outright.

`recoverFrozen` is declared explicitly as a boolean either way — a telegraph that omits it is one where nobody decided, and the punish window is too load-bearing for a default.

### 6.2 Zones and timing

Shapes reuse the compose geometry (`inZone`, `inCone`, `inLine`) so an enemy telegraph and a player skill ask the same question of the same shape. Two implementations would drift, and the drift is an attack that looks dodged and lands anyway — the one bug that makes telegraphs worse than none.

```
TELEGRAPH_MIN_WINDUP_MS = 350
```

Wind-ups run 450–700 ms scaled to zone size. Bigger zone, longer read.

### 6.3 Rendering

The zone draws on the ground in its committed shape. **Fill sweeps 0→100% over the wind-up — the fill is the timer.** Domain-tinted, outlined so overlapping zones stay legible, cleared immediately on resolve. **No telegraph may depend on sound**; the game runs in muted tabs.

### 6.4 Density

**Every heavy or elite archetype telegraphs. Trash and swarm do not.**

Target: **at or above 50% by encounter weight** per region, asserted at load.

If everything telegraphs, holding stance is always punished. If nothing does, holding is free. The decision only exists when some damage is dodgeable and some is not.

Density is also the dial that resolved Footing's offensive balance: at 21% density the holder led by ×2.24; at 50% it is ×1.08. **Do not tune a stance mechanic against a low-density world and then raise the density.**

### 6.5 `ON_DODGE`

Fires when a player was **inside** a committed zone at commit and **outside** it at resolve. Positional, requires actual movement, cannot be satisfied by a stat roll.

The Reflex dodge stat remains as a defensive mechanic and **does not feed `ON_DODGE`**. Conflating them made dodge-triggered skills reward Reflex instead of movement.

---

## 7. The Damage Triangle

```
physical  beats  spiritual   →  red    #C0392B
mental    beats  physical    →  blue   #2E6DA4
spiritual beats  mental      →  violet #7D4A9E

ADVANTAGE_MULT    = 1.25
DISADVANTAGE_MULT = 0.80
```

All damage routes through the triangle, including hazard and plague ticks. There is no unrouted damage path. Every skill and every enemy declares a domain. Enemies render a **4px domain-coloured rim**, always visible, no inspection required.

**Domain, trigger, selector, and TUNING assignment all happen while writing a tree, never afterward.** One extra field during authoring; a 420-item audit with no context otherwise.

---

## 8. Skill System

### 8.1 Shape

- **14 classes × 3 trees × ~10 skills ≈ 420 skills.**
- Trees run tier 1 → tier 10, terminating in a capstone.
- **1 skill point per level**, spendable freely across all three of a character's trees. No per-tree budget.
- Prerequisites are linear within a tree. No cross-tree prerequisites.

### 8.2 Class roster

| # | Class | Home | Tree 1 | Tree 2 | Tree 3 |
|---|---|---|---|---|---|
| 1 | Blacksmith | Munich | Tank | DPS | Runes / Crystal Forms |
| 2 | Wizard | Cairo | Soul | Mystic | Ethereal |
| 3 | Necromancer | Murmansk | Marrow | Summons | Dark Matter |
| 4 | Druid | Enumclaw | Tapestry of Beasts | Restoration | Wild Kin & Earth's Wrath |
| 5 | Mage | Moscow | Arcane Warrior | Buffs / Debuffs | Quantum / Spacetime |
| 6 | Bard | London | Harmony | Instrument Melee | Sonic / Resonance |
| 7 | Witch Doctor | Kinshasa | Voodoo Mastery | Alchemy of Decay | Spirit Whisperer |
| 8 | Samurai | Kyoto | Armor | Tactics | Agility |
| 9 | Monk | Lhasa | Melee Heals | Gauntlets | Traps |
| 10 | Assassin | Dubai | Traps | Stealth | Range |
| 11 | Priest | Rome | Light | Rebuke | Vanquish |
| 12 | Savage | Mexico City | Primal Fury | Swift Reckoning | Bloodbound Guardian |
| 13 | Hunter | Sydney | Melee | Marksmanship | Beast Control |
| 14 | Sundian | Bali | Tide | Regalia | Deluge |

The Sundian's `classId` remains `atlantean` internally for save compatibility. **Do not rename the id.**

**Built: 2 of 14.** Samurai (Armor, Tactics) and Necromancer (Marrow, Dark Matter). The remaining twelve are §15 group A.

### 8.3 Class engines

Every class has a mechanical engine no other class has. Each must interact with the trigger system differently — that is the test for whether an engine is real.

| Class | Engine |
|---|---|
| Savage | **Cascade** — an ordered 3-skill sequence banks uncapped ranks; each grants +8% damage and removes 8% of *remaining* reducible cooldown, floored at 50% of base |
| Sundian | **Drench stacks** — its own status, applied by `drench` and cashed by `sluice`. The engine counts STACKS across the room, and spending them is the class's own best move |
| Mage | **Crystallize** — damage TAKEN accumulates crystal; crystal drives melee output. The only engine filled by the enemy rather than by the player's own action, and **the only one Grit fights** |
| Witch Doctor | **Voodoo doll** — damage to a doll mirrors onto a distant target |
| Druid | **The pack** — one summon per animal skill, revive timer scales with pack size (§8.5). Morph layers on top: animal DNA visibly mutates the character |
| Blacksmith | **Crystal Forms** — timed transformations on `SELF_THRESHOLD` |
| Necromancer | **Soul tokens** — kills drop tokens, `ON_TOKEN` raises skeletons into rank-granted slots, all wiped at room end (§8.5) |
| Bard | **Rhythm** — attacking without a gap builds stacks; missing the window drops every one of them at once. **The only engine with a loss condition** |
| Wizard | **Domain shift** — the only class that changes its own damage domain mid-fight |
| Priest | **Judgment marks** — marks detonate on the target's death, healing nearby allies |
| Samurai | **Footing** — see §8.4 |
| Monk | **Chi loop** — damage generates Chi; heals and traps spend it |
| Assassin | **Killbox** — traps placed inert, detonating when other skills fire nearby. The only engine banked by BEING SOMEWHERE rather than by acting |
| Hunter | **Two bodies** — skills may trigger off the pet's position |

#### Batch order for phase 5 — engine shape decides it

`p.engines` is a bag of readable numbers and `engineScale()` reads it by name, knowing none of them. That is why a class costs two content files and one registration line — **as long as its engine is a resource something already computes.** A class whose engine needs a new per-tick behaviour costs a function in `skillsim.js` alongside the content, and that function is the one thing `engine_gate` was built to catch: an engine tick written and never called returns exactly 1.0 through `engineScale`, so the class plays slightly weak rather than broken.

The eleven unbuilt classes sort into three shapes. **The sort is the batch plan.**

#### Phase 5 batch order — the write-path audit, run

The first sort asked "does it need a tick" and that was the wrong question. `engineScale()` reads `p.engines[name]` knowing no engine by name, and that read-side generality was mistaken for the whole story. **Nothing publishes into the bag generically** — `tickFooting()` is a function, `armor` is one line in `tickSkills`, `pack` is one line in `tickMinions` — so every engine costs at least a publish line, and two classes needed a write path the engine did not have at all.

Both of those are now built and gated: the `shift` primitive (§5.7) and the `mark` rider. **The audit below was then run across the remaining nine**, asking of each: what state must a skill produce, and can content produce it today?

**CONTENT-SHAPED — a publish line, batchable two per patch.**

| Class | Engine | What exists | Cost |
|---|---|---|---|
| **Wizard** | domain shift | `shift` primitive, `p.domainShift`, read by `bestDomainMult` — **built, gated and AUTHORED** | 2 tree files + `p.engines.shift = p.domainShifts` |
| **Priest** | judgment marks | `mark` rider, `e.markT/markBy/markHeal/markRadius`, `_killEnemy` detonation — **built, gated and AUTHORED** | 2 tree files + a publish line counting marked enemies |
| **Bard** | **rhythm** *(ruled)* | `tohOnFire` writes `p.rhythm` on every cast, `tohTick` runs the decay — **built, gated and AUTHORED** | 2 tree files + `p.engines.rhythm = p.rhythm` |
| **Mage** | **crystallize** *(ruled non-consuming)* | one line in `tohOnHurt`, which `hurtPlayer` already called — **built, gated and AUTHORED** | 2 tree files + `p.engines.crystal = p.crystal` |

#### The second pair, checked before authoring — and only one of them survived

Rule 29 says a generic read is not a generic write. **Both of these classes were filed content-shaped on a read, and neither claim held.** The check is cheap and it is the whole reason phase 5 is estimable, so it is recorded rather than left in a commit message.

**The Bard: `p.stance` is the Samurai's field, and the audit verified the Samurai.** It is initialised to 0 for every player and read in eight places, which is what "verified present" saw. Every write is inside `tohSwapStance`, and its first line is `if (!has(p, 'three_stances') …) return false` — `three_stances` is the **Samurai's** trait. Measured on the live path, four swap attempts each:

| class | trait | `p.stance` | `tohSwapStance` returned |
|---|---|---|---|
| Samurai | `three_stances` | 0 → **1** | true, true, true, true |
| Bard | `rhythm` | 0 → 0 | **false, false, false, false** |
| Mage | `singularity` | 0 → 0 | **false, false, false, false** |

And sharing the field would be wrong even if it were writable. `p.stance` is 0/1/2 = IRON/PRECISION/FLOW, and each value is read by Samurai-specific code — `ironGrit`, the `ironBank` refund, the precision crit and bleed, the flow tempo stacks. **A Bard writing `stance = 1` would inherit the Samurai's precision crit.** That is the drench-into-`weakened` mistake in a different costume: one class's engine coupled to another class's trait through a shared generic field.

**But the Bard has a real engine, and it is Rhythm.** `p.rhythm` is written by `tohOnFire`, which `fireSkill` calls on **every** skill cast (unconditionally — see `skillsim.js`, the hook that was orphaned when weapons were removed and has been reconnected since). The decay is already live too: `tohTick` drops every stack the moment the window lapses. Measured by lending the Bard a tree so it could cast at all — **`p.rhythm` 0 → 3 in thirty seconds of play, with no engine code of any kind.**

So the Bard is content-shaped — **cheaper than the Wizard or the Priest, both of which needed a write path built first** — under Rhythm rather than under Stances.

#### RULED: the Bard's engine is Rhythm

"Stances" was written into the table before any engine existed, and it has since collided with the Samurai's `three_stances` trait — a collision that has already produced one false positive in an audit, which is a cost the name was never going to stop paying.

Rhythm is right on identity: the Bard's entire character sheet is Rhythm — stacks, a window, ensemble sharing, solo doubling — and Group A's red check is named `Bard rhythm never built` after it.

**And it passes §8.3's structural test in a way nothing else does: it is the first engine with a LOSS CONDITION.** Record that as the distinguishing property, because it is what makes the engine a different *kind* of thing rather than a differently-named counter:

| engine | how it is produced | can play lose it? |
|---|---|---|
| footing | stationary time | drops on movement past the grace budget — but the budget is a **defended** loss, not a missed one |
| armor | derived from Grit | no — it is a stat reading |
| pack | count of standing animals | only by the animals dying |
| shift | count of casts this room | no — monotonic until the door |
| marks | count of live marked enemies | only by the marks being paid out |
| **rhythm** | **casts inside a rolling window** | **yes — one gap longer than the window drops every stack at once** |

Every other engine is *spent* or *reset*; rhythm is the only one a player can simply **drop**. That gives it a different relationship to the trigger system: a Bard is not choosing when to cash a resource in, it is choosing whether to keep the chain alive at all, and every cooldown in the build is a threat to it. **That is the property the class is designed around, and it is what a Rhythm tree must be authored against.**

#### What authoring against a loss condition actually cost — measured

The trees are **Cadence** (the engine tree, scaling `scaleWith: 'rhythm'`) and **Ensemble** (support, mostly flat, one node reading the engine — the heal). Two findings came out of tuning them, and both are the kind that only a measurement produces.

**The trait was ALREADY a damage engine, and the tree charged for it twice.** Rhythm grants +3% Ferocity per stack, doubled when solo, and Ferocity multiplies all composed damage (§9.5). At ten stacks that is +60 Ferocity — measured, an average sheet of 56.1 against 2.3 with the chain suppressed. A Cadence tree that ALSO scales damage by the same stacks is billing one resource on two lines. First measurement: **137.5 DPS against a 29.5 anchor, +366%**, and the anchor did not move — which is the pinned reference set (§13 rule 28) doing exactly the job it was pinned for.

**And the cooldowns were the real culprit, not the damage.** "Cadence has the shortest cooldowns in the game" is right for the *metronome* nodes and wrong applied across a tree: the AoE and multi-target nodes were priced at 2–4× the cast rate of comparable Wizard nodes at similar damage. Corrected against Arcana as the reference — Ley Surge's cone at 5400 ms, Starfall's three bolts at 6200 — and then damage trimmed to pay for the trait's multiplier, which no other class carries.

**The curve that came out is the class:**

| | DPS | vs anchor |
|---|---|---|
| chain held, ten stacks | **36.9** | +25% |
| chain dropped | **20.7** | −30% |

Both ends inside the ±40% band, which is the property worth having: the Bard is balanced **at both extremes** rather than on average, and the loss condition costs 44% of output. Opening Note keeps the shortest cooldown in the game (900 ms) and is single-target and cheap *because* it is — a node that comes up that often cannot also hit the room.

**One more thing the gate found, and it is content rather than harness.** Slotted alone, `bard_quickstep` reached exactly **one** stack: its 2000 ms cooldown is longer than the 1.5 s window, so the chain lapsed between every cast. **A Cadence node slower than the window cannot hold its own chain** — which is precisely why the tree opens with a metronome, and why `engine_gate`'s filler for rhythm is derived as "any active whose cooldown fits inside the window" rather than by naming a skill. Retune a cooldown past that line and the gate says so.

#### DEFINED, and then checked: crystallize

The engine had been one word in a table — no mechanic in the GDD, none in the compendium, and no field matching `/cryst/i` anywhere in a Mage's player object or in the sim. (`crystal_infusion` is the **Blacksmith's** trait; `crystal_pyrite`/`quartz`/`calcite` are its post-fight boons. Different class.) That is §13 rule 33, and the definition below closes it.

**CRYSTALLIZE. The Mage accumulates crystal on damage TAKEN, and spends it on melee output.** It is the only engine in the game filled by the enemy rather than by the player's own action, and that is what makes the class the Arcane Warrior: it rewards standing in melee and eating hits, and converts absorbed damage into dealt damage. Every other engine is paid for in the player's own initiative — time stood still, casts made, animals kept alive, marks placed. This one is paid for in health, by someone else's decision.

**The rule-29 result: the accumulate half passed, the spend half did not — and the spend was then ruled away.**

**A — accumulation. PASSES, with one line, in a hook `hurtPlayer` already calls.** `hurtPlayer` calls `tohOnHurt(this, p, raw, dmg)` — both the pre-mitigation and post-mitigation amounts, which is exactly what "converts absorbed damage into dealt damage" needs. **The pattern is not hypothetical: `karma` already accumulates on damage taken through that hook**, measured live at `p.karma` 0 → 40.0 over 45 s. A Mage standing in a fight took 40 damage events in 36 s — 259 raw, 238 actually taken — from both enemy-attributed and unattributed sources, all of them reaching the hook. Four paths bypass it and each is correct to: `opts.trueDamage` (objective hazards are the level, not an attacker), a Reflex dodge, the auto-block item, and a ward that absorbs to zero. **Damage that was avoided should not crystallize.**

**B — the spend. FAILED, for two independent reasons.** Nothing writes an engine value down: all five engines at the time were either recomputed from a source every tick or a monotonic counter reset at the door, and `engineScale()` reads. And the trait layer cannot tell a melee cast from a ranged one — `tohOnFire`'s only call site passes `{ def: null, a, tx, ty }`, no skill, no step, no primitive kind, while "melee" is a property of the **step** (`strike`) in `compose.js`.

#### RULED: crystallize is NON-CONSUMING, and the health is the spend

Crystal ramps within a room and resets at the door, the same shape as the Wizard's shift. Melee steps read it through `scaleWith: 'crystal'`. **There is no consumption step and no step-level spend hook**, and that is a design decision rather than a concession to the engineering.

**The player has already paid.** Every point of crystal was bought in health, in the only currency that matters, at the moment it accrued. Charging again at the point of use taxes one decision twice — and the room reset already gives the ramp an end, so nothing runs away. The Mage becomes content-shaped and needs no new machinery: one line in `tohOnHurt`, one field, one room reset, one publish line.

**And it is NOT Footing wearing a different hat**, which is worth stating because Footing is its nearest neighbour and the two would collapse into each other if the distinction were left implicit. **Footing is stationary TIME and rewards holding ground; crystal is damage ABSORBED and rewards being hit.** A Samurai who holds a corner nothing reaches still banks a full stance; a Mage who kites perfectly gets nothing at all. The melee-only ruling below sharpens it further — Footing pays out wherever the Samurai is standing, crystal pays out only in reach of the thing that filled it.

**AND THE BUILT-IN COST §8.3 REQUIRES IS GRIT.** Crystal is written off `mitigated` — what actually got through — so **armour is anti-synergistic with the engine**. Mitigation means less damage taken means less crystal. The Mage is **the only class in the game punished for playing safely**, and that is the tension the engine exists to create rather than a bug to tune out later. Every other class's engine is paid for in the player's own initiative — time stood still, casts made, animals kept alive, marks placed; this one is paid for in health, by someone else's decision, and the obvious defensive answer makes it worse.

**Asserted, not described.** §13 rule 24 says a claim of the form "X reduces Y" is not real until something moves X and reads Y, so `engine_gate` does: two identical Mages eat twelve identical blows through `hurtPlayer`, one of them wearing armour. **5.8 crystal bare, 1.4 at 40 Grit — a 75% cut.** The gate also asserts that crystal does not survive a door, for the same reason a shift must not.

**Melee only, and that is also a ruling.** Every `scaleWith: 'crystal'` step in Crystalblade is a `strike`. A crystal-scaled bolt would let the Mage bank the engine at the back of the room and spend it from safety, which is the exact play the class exists to refuse — so the ranged half lives in Collapse and is paid in flat numbers. The depth-versus-breadth decision §4.2 wants is therefore a decision about **distance** on this class: deep in Crystalblade and the Mage has to be hit to be strong, wide into Collapse and it does not, and the crystal it never earns is the price.

**Measured at both ends, per rule 34:**

| | DPS | vs anchor |
|---|---|---|
| pool full (10 crystal) | **37.5** | +27% |
| pool empty, straight through the door | **30.3** | +3% |

#### The DPS gate could not fill this one, and that was a real blind spot

Every other engine fills itself in `measureDps`: footing accrues because the harness pins the player still, rhythm and shift accrue because it casts, marks accrue because it marks. **`crystal` is the exception, and it is the exception by design** — the fixture's dummies deal no damage on purpose, because the gate measures output rather than survival. So the Mage would have been scored forever at an empty pool: **30.3 against 37.5 with the pool full, and only the second number is the class anyone plays.**

The first tuning pass proved the cost of that. At the numbers the tree was authored with, the Mage read **34.9 at an empty pool (+18%, in band) and 45.2 with the pool full (+53%, OUT)** — a class that passes its own gate and is out of band in every fight it has ever been in. The harness now stages any engine it cannot fill, **named rather than inferred**, because the alternative is a silent zero and that is the whole failure mode `engine_gate` exists to prevent.

#### The rest of the sort, as it now stands

**WRITE-PATH — a new primitive or rider first, alone, gated before any tree.**

| Class | Engine | What is missing |
|---|---|---|
| ~~**Witch Doctor**~~ | voodoo doll | **BUILT, GATED AND AUTHORED.** The `doll` rider — see below. It was the cheapest write path yet, because the mirror was already live and only the DESIGNATION was missing |
| ~~**Sundian**~~ | drench stacks | **BUILT, GATED AND AUTHORED.** Two riders, not one — see below |
| ~~**Assassin**~~ | killbox | **BUILT, GATED AND AUTHORED.** It did need the thirteenth primitive — see §5.7 |
| **Hunter** | two bodies | "skills may trigger off the pet's position" is a change to `triggers.js`, not to `p.engines` — the evaluation origin is the player throughout |

**TICK-SHAPED — a stateful accumulator or decay, alone.**

| Class | Engine | Why |
|---|---|---|
| **Monk** | Chi loop | accrues from damage dealt, drains on spend — neither is a derivation of an existing field |
| **Savage** | cascade | banked ranks decay out of combat, and §8.3's asymptotic cooldown floor is bespoke arithmetic |
| **Blacksmith** | Crystal Forms | timed transformations; `crystal_infusion` is live but the forms decay, and a decay is a tick |

#### The Witch Doctor: the mirror was live, the CHOICE was not

`voodooMirror` has sent 35% of everything the Witch Doctor deals onto `p.voodooId` — through walls, across the map — since the trait era. What did not exist was any way to say **which** enemy. `tickVoodoo` binds the NEAREST and rebinds on death or drift, so the doll was whatever trash happened to be closest, and the class's whole fantasy — pour damage into a doll and have it come out of something that matters — was unreachable.

**So the write path is a rider, not a primitive, and §5.7 condition 2 is what decides that**: a designation resolves on a target at the moment of impact, so there is an impact to hang it on. The rider writes `p.voodooId` on the caster rather than state on the enemy, which is unusual and is exactly right — the doll *is* an enemy identity, and impact is when the game knows which one.

**Designation is STICKY, and that half is load-bearing.** `p.voodooDmg` is per-doll and `tickVoodoo` zeroes it on every rebind, so a rider that re-designated on every hit would reset the bank on every swing — a cone touching four bodies would end each cast with a fresh doll and an empty engine. The rider binds only when the slot is open: no doll, or a doll that has died. The player's choice is still expressed, through the skill's own **selector** — `wd_pin` takes `highest_hp`, so it pins the elite the moment the last doll dies.

**The engine is the debt, and it dies with the doll.** `p.engines.doll` is what the bound enemy has absorbed, capped, zeroed on rebind. Every point in it arrived as damage *to the doll*, so the Witch Doctor is always killing the thing it is loading. **Marks pay out on death; the doll pays out by staying alive** — the opposite half of the same idea, which is what keeps the Priest's engine and this one from being the same engine. Measured ramp in a real fight: 2.1 stacks at 10 s, 4.0 at 20 s, 6.0 at 30 s, cap around 50 s.

**Cost of the write path:** one entry in `IMPACT_RIDERS`, one branch in `applyImpactRiders`, two numbers on the trait, one publish line, one `engineScaleBonus` reader, one `PASSIVE_EFFECT` entry. No primitive, no new field on the enemy, no tick.

#### The test for content-shaped, stated so the sort stops producing false positives

Three checks now, and a class must pass all of them. Each one exists because it caught something the previous ones let through.

1. **Can content WRITE the value?** Not "does the field exist", not "is the function live" — can *this class*, casting a skill, move it. Rule 29. This caught the Wizard and the Priest (no write path at all) and the Bard (a write path owned by the Samurai).
2. **Is the engine SPECIFIED?** A word in a table is not a mechanic. This caught the Mage, where the audit ran against a name and found the nearest live counter.
3. **Does the tree need a new PASSIVE KEY?** If it does, the class is not content-shaped and the sort was wrong.

**The third check has already paid, and it paid by rejecting.** Two Wizard/Priest nodes were authored as passives keyed to `healPerHit` and `regen`, and `PASSIVE_EFFECT` refused both — those are **item** hooks, not registered passive keys. That refusal was the right outcome and it is worth stating why, because the cheap fix was to register the keys.

**A new passive key is not content. It is a reader in `skillsim.js`** — the passive has to be summed and then consumed somewhere in the shared tick, which is engine code in shared code, which is precisely what "content-shaped" promises the class will not cost. A class that needs one has an engine the game does not model yet, and it belongs in the write-path or tick-shaped group where its real cost is visible. Registering the key instead would have moved a class between groups silently, by making the estimate true after the fact.

Both nodes were rewritten as actives — a `heal` and a `drain` — and say the same thing about the character while costing nothing. **`PASSIVE_EFFECT` is therefore load-bearing on the batch plan, not just on balance**: it is the only thing standing between "this class costs two content files" and a patch that quietly grows a reader.

#### Drench is not one of `ON_STATUS`'s four — ruled, and closed

The cheap reading of the Sundian was to fold drench into `weakened` and call the class content-shaped. **It is not, and the reason is a category error rather than a tuning one.**

`dot`, `slow`, `plague` and `weakened` are **effects**: each one describes something happening to the enemy right now, and `ON_STATUS` fires because that thing is true. **Drench is a counter that pays out in burst** — it is not doing anything to the enemy while it sits there; it is a number the Sundian spends later. Those are different kinds of object, and the taxonomy only works because everything in it is the same kind.

The cost of folding them is not local. `ON_STATUS` reads the four generically, so admitting drench as `weakened` would make **every `ON_STATUS` skill in the game fire on drench** — and the Sundian's engine would then be coupled to the whole status taxonomy, in both directions, forever. A later change to what counts as `weakened` would silently reprice the Sundian, and a change to drench would silently reprice every other class's `ON_STATUS` node.

**The Sundian therefore keeps its own status, and stays WRITE-PATH: a rider plus an enemy field, ruled and gated before its trees, exactly like the Priest's `mark`.** This is settled; it is not to be reopened as a scoping shortcut when the Sundian comes up for batching.

#### BUILT: two riders, because a counter and its payout are one mechanic

The ruling said "a rider plus an enemy field". Building it found that **it is two riders**, and the pair is the mechanic:

| rider | what it does |
|---|---|
| `drench` | adds stacks to the enemy, capped, with a clock. Writes `e.drench` / `e.drenchT` / `e.drenchBy` |
| `sluice` | reads what the target was carrying, turns it into burst damage, and **clears it** |

**A counter with no payout is a number, and a payout with no counter is a multiplier.** Neither half can be gated alone — which the rider gate proved twice, once on each path. The synthetic probe adds one rider at a time and read `sluice` DROPPED because it found an empty counter; the declared-content probe stages a skill ALONE, by design, and read the Sundian's two sluice skills DROPPED for the same reason. Both are now staged with the precondition: `SYNTH_WITH` names companion riders for the synthetic path, and the counter is pre-staged **on the targets** for the content path — on the targets rather than by slotting a second skill, so the burst stays attributable to the skill under test.

**Ordering inside `sluice` is load-bearing, and it is the mark's lesson reused.** The stacks are cleared *before* the burst damage lands, because `damageEnemy` can kill and a death that re-entered the rider while it still held its stacks would pay twice — the same recursion the Priest's `grace_and_judgment` produced through `_killEnemy`.

**The engine counts STACKS, not enemies.** `p.engines.drench` sums across every enemy this player has soaked, in the same tick sweep that counts the Priest's marks. A Sundian who has soaked one body four times has four times the payout waiting, and a counter that measured bodies would price that identically to four bodies at one stack each.

**And that makes it the only engine whose loss condition is the player's own best move.** The Bard drops rhythm by playing badly; the Sundian spends drench by playing well. Every `scaleWith: 'drench'` skill in the build reads the room-wide count, so sluicing pays out on one target and makes everything else weaker in the same instant. The tree is authored against exactly that: spread versus cash.

Measured in the DPS harness, which soaks its own dummies: **24 stacks standing, 33.7 DPS, +14% against the anchor.**

The general form is §13 rule 25's neighbour: **a taxonomy read generically is a contract with everything that reads it. Adding a member is not a local decision.**

**The Savage cascade is exempt from the no-cooldown-reduction rule** because its ranks are banked by in-combat sequencing rather than point investment. Uncapped linear reduction would run away with no investment cost, so the reduction is asymptotic with a hard floor.

### 8.4 Footing

The Samurai's engine, and the most-iterated design in the project.

```
footingTickMs         = 500     // one stack per half-second stationary
FOOTING_MAX_STACKS    = 10      // hard cap, no skill may raise it
footingShieldPerStack = 4
footingGritPerStack   = 2
footingGraceMs        = 400
footingGraceRefill    = 1.0
```

**Footing grants a shield pool and grit. It does not grant Vitality, and it does not grant Reflex.**

- *Vitality was removed* because max HP has a destructive removal path — dropping stance clamped current HP, so dodging cost health in an amount unrelated to the attack, invisibly, scaling worst at high stacks. The shield pool loses protection you had not spent, not health you had.
- *Reflex was removed* because a stance that makes you harder to hit contradicts the mechanic. The Samurai has surrendered his ability to dodge anything telegraphed; granting dodge chance does the opposite.

The shield lives in its own field, not the general shield pool, so breaking stance drops exactly the Footing part and does not eat an unrelated absorb.

#### The grace window is a budget, not a timer

Movement under `footingGraceMs` does not drop the stack. Movement accumulates against the budget; standing still refills it at `footingGraceRefill`.

**A timer reset by standing still would let a player cross the entire map at full stance in 300 ms hops.** The budget prevents that structurally.

400 ms is chosen against the shortest wind-up on the roster, so **one sidestep out of the fastest committed zone fits and a room crossing does not.**

Gated explicitly: sidestep keeps, reposition drops, wiggle drops, settling recharges, and inside the window the stance holds without growing so moving never pays.

#### What the engine is for

Hold ground through untelegraphed trash; break stance for committed zones. Measured at 50% density, three strategies:

| | damage dealt | damage taken |
|---|---|---|
| holder vs sidestepper | ×0.84 | ×0.60 |

Roughly **+19% damage for +67% damage taken** — a live trade, which is what the engine exists to offer.

**Failure condition:** if tuning ever makes it correct to always hold or always break, the engine has failed and that should be reported rather than tuned around.

#### History worth keeping

Two earlier versions failed:

- **Iaido** (skills charge while idle, damage scales with time since last fired) was rejected: rewarding a skill for *not being used* runs against the short intense bursts the game is built on.
- **Instant drop** made the defensive gap ×0.37 and completely insensitive to every dial tried — per-stack Grit, removing Reflex, tripling telegraph density. Movement cost the entire stance and the rebuild was slower than commits arrived, so a moving player was never *choosing* to fight without a stance; it was never allowed one. The grace window moved the number 60% on the first attempt.

The lesson generalises: **a measurement insensitive to every dial you try is measuring something other than what you think.**

### 8.5 Summoning

Summons were the largest bespoke category in the source project and are the largest untested area of the composed-action schema. Two classes use them, and they are deliberately opposite engines rather than one mechanic with different art.

**Implementation status: built, and diverging from this section in eight places.** The engine, both trees and the instrumentation shipped before this section was available to build against. The divergence log at the end of §8.5 lists every gap; **§8.5 wins on all eight and the code changes to match.** Nothing below is a proposal.

#### A minion is an ACTOR, not a behaviour

**This is the pattern the remaining eleven classes should follow, and it is the reason summoning cost one primitive instead of a handler per archetype.**

The instinct is to model a summon as a *behaviour*: a skeleton knows how to swing, a hawk knows how to dive, and each new archetype brings the code that makes it act. That is what the source project did, and it is why summons were its largest bespoke category — every summon carried its own spawn, attack and death path, so adding one meant editing the engine.

A minion here is an **actor**. It does not know how to do anything. It is a position, a body and an allegiance, handed to the same machinery a player is handed to. Two halves make that work:

1. **Its attack is a compose step**, run through the same `PRIMITIVES` table a player's skill uses (§5.7). A skeleton's cleave *is* `strike`. A hawk's dive *is* `bolt`. There is no minion attack code, because an attack is already a thing this codebase knows how to resolve, and a minion has no better claim to a private version of it than a skill does.
2. **Its identity fields are the owner's, by reference** — `idx`, `stats`, `hookAgg`, `char`. Only the spatial fields are the minion's own. So a skeleton's kill is the Necromancer's kill, its lifesteal heals the Necromancer, and the damage ledger attributes to the Necromancer, with **no special case in `damageEnemy` or `skillDamage`**. Attribution is not forwarded; it never diverged.

What falls out: a new archetype is a row of data. `js/minions.js` does not know what a skeleton is, and neither does `js/compose.js` — asserted by a scan in `sim_test` that searches every engine file for any skill id or archetype name, reading the needles out of the live registry so a rename cannot empty the search, and carrying a negative control that plants a handler and confirms the scan sees it.

**Generalise it as: give the new thing an actor, not a vocabulary.** The Monk's traps, the Assassin's killbox, the Hunter's second body and the Priest's judgment marks are all the same shape — an entity that acts somewhere the player is not. Each should borrow the primitives and the owner's identity rather than grow its own verbs. Recorded as §13 rule 23.

#### The shape

```
{ kind: 'summon', archetype: 'wolf', move: 'chase', maxAlive: 1,
  slotted: true, revives: true, hp, radius, spawnRadius, duration,
  attackCd, reviveBase, revivePerAnimal,
  attack: { kind: 'strike', damage, arc, reach, select: 'nearest' } }
```

`move` is a closed taxonomy (`MOVE_KINDS`: `chase`, `orbit`), asserted at load like `TRIGGER_KINDS` (§5.2) and `SELECT_KINDS` (§5.3). A third kind, `guard`, was written and deleted before shipping because no skill used one — §13 rule 1.

**`select` on the *attack* step is the minion's own targeting rule, not the summoner's.** The summoner chose where to put it; the minion chooses what to bite. A summon step therefore carries two independent selection decisions, and collapsing them would make every pet a mirror of its owner's build.

`maxAlive` caps one archetype without capping the rest. It exists because the cheapest-triggering summon otherwise takes every available place: the first armed Druid fielded three wolves and never once a bear.

**Tier 1 in both summoner trees is a direct attack, not a summon.** §5.6 requires a tree's opening pick to be a damaging active, and a summon defers its damage behind a spawn, a walk and an attack cooldown — "something that kills" has to kill now. The first animal and the first skeleton are tier 2.

#### Druid — the pack

- **One summon per animal skill.** Additional ranks make that animal stronger, not more numerous.
- **All animals spawn at the start of every map**, fully restored, alongside the room-start HP restore in §10.
- **A dead animal revives at the Druid's current position** after a timer.

```
reviveMs = 15000 + 4000 × (totalAnimals − 1)
```

| Animals | Revive |
|---|---|
| 1 | 15s |
| 2 | 19s |
| 3 | 23s |
| 4 | 27s |
| 5 | 31s |
| 6 | 35s |

**`totalAnimals` counts animals owned, not animals alive.** If it counted the living, losing the whole pack would make revives fastest — the cost would invert exactly when the player is most punished. Each dead animal runs its own independent timer at the same N-derived duration.

**The engine's built-in cost is opportunity, not the timer.** Points spent on animals are points not spent on the Druid's own offence, so a Druid whose pack is down has to survive on badly reduced damage output. The revive scale exists so that going wide has a price at the moment it matters: a six-animal Druid waits more than twice as long as a one-animal Druid to get anything back.

**Depth versus breadth, expressed as shape.** Six animal skills at rank 1 is six weak pets on a 35s revive. One animal at rank 20 is a single strong pet back in 15s. Neither is obviously correct, which is the test.

#### Necromancer — soul tokens

- **Every enemy killed drops a soul token** at the place it died.
- **Tokens are visible only to Necromancers.** They are state and ride the snapshot per §12.1, but render per-player.
- **Tokens expire after 30 seconds.**
- **Raise Skeleton is triggered by `ON_TOKEN`** — a token within range. The skill fires a projectile at the token, and a skeleton rises where it lands.
- **Each rank of Raise Skeleton grants one skeleton slot.** Ranks buy capacity; kills fill it.
- **Skeletons are weak**, and they **wipe at the end of every room.**
- With two Necromancers in a party, **one token drops per enemy and it is shared.** First to fire claims it.

**No cap beyond rank.** A rank-20 Raise Skeleton means twenty skeletons, each earned by a kill. This is deliberately uncapped for first playtest; a cap may follow.

**The built-in cost is the cold start.** A Necromancer begins every room with nothing and must kill with its own skills to get the first token, so points cannot all go into Raise Skeleton — a build with twenty slots and no offence fills none of them. And because skeletons wipe at room end, the count never compounds across a map: every fight ramps from zero.

**Shared tokens make two Necromancers a weaker pairing** than two of any other class, since each token can only raise one skeleton. That is a known consequence rather than a defect.

#### Why they are different engines

| | Druid | Necromancer |
|---|---|---|
| What breadth buys | More pets | Nothing |
| What depth buys | Stronger pets | More pet capacity |
| Where pets come from | Free at map start | Earned by killing |
| Across a room | Persist, revive on a timer | Wipe, rebuild from zero |
| Cost | Offence forgone; revives slow as the pack grows | Cold start every room; capacity is useless without offence |

#### The token is a place, not a counter

Row 4 is the substantial one, and it matters beyond correctness. A token that is merely *spent* is a counter: it could be an integer on the player and nothing about the game would change. A token that is **thrown at, and raises a skeleton where the throw lands**, is a position on the floor — and positions are what this game is made of.

**This is §5.1's premise applied to a resource.** Players do not fire manually; every ability triggers from a condition the player controls through where they stand and how they move. Until row 4, the Necromancer's positioning was about where enemies *are*, like everyone else's. Now it is also about **where things died** — a fought-over corner is a place worth standing near, a body dropped behind a wall is a skeleton you cannot reach, and a kill in the wrong spot is a resource wasted. The build reads the floor's history rather than only its present.

It is also why the Necromancer's cold start is a real cost rather than a tax. A room begins with no tokens because nothing has died in it yet: the floor has no history to read.

Mechanically this is a `deliver` block on the summon step — a property of the step, not of the skill — so any future summon can be thrown without the engine learning what a skeleton is. `claimToken()` returns the position rather than a boolean for the same reason; a boolean would reduce it back to a counter in the one function that decides.

#### Divergence log — CLOSED

All eight rows are closed. The summoning engine now matches this section; the log is kept because the shape of the mistake is worth remembering — the engine, both trees and the instrumentation were built from a brief citing a §8.5 that had not yet reached the repository, so the magnitudes and several mechanics were invented at the keyboard. §8.5 won on every row.

| # | §8.5 | how it was closed, and what asserts it |
|---|---|---|
| 1 | **Every** kill drops a token | No roll, no cap. Asserted by counting: 40 kills, 40 tokens, exact equality — a rate looks identical to certainty on a lucky sample |
| 2 | Visible only to classes that can read them | A **view** filter, not a wire filter — tokens stay on the snapshot for everyone because they are state. Derived from tree data (`readsTokens()`), so the Wizard's Soul tree inherits it with no code change |
| 3 | Expire after 30 s | Read off a token dropped through the real kill path |
| 4 | Thrown at the token; rises where it lands | See above. Asserted spatially: 4u from the token, 264u from the caster |
| 5 | Skeletons wipe every room | Asserted across a **real node transition**, never a timer — a wipe that happened to look right because a duration expired would pass a timer check and fail a player walking through a door |
| 6 | No cap beyond rank | `SUMMON_SLOTS_BASE` and `SUMMON_SLOT_CAP` deleted. Asserted at **rank 12**, chosen because the old ceiling of 8 would have bitten: 12 slots granted and 12 skeletons standing |
| 7 | Animals present at map start, fully restored | Restored at the room-start HP restore, where this section puts it. Asserted by downing an animal, travelling, and checking it arrives standing at full HP |
| 8 | `15000 + 4000 × (N−1)` | Asserted at **five** pack sizes with slope and intercept checked separately — one sample cannot see a wrong slope, and two cannot tell a wrong slope from a wrong intercept |

**`SUMMON_SLOTS_BASE` is gone and must not return.** It was invented to give the Druid somewhere to put an animal. This section solves that differently: a Druid's pack size is how many animal skills it took, its animals are **not slotted at all**, and the Necromancer's capacity is rank alone. A shared pool would couple two engines this section keeps deliberately opposite. If a future class needs standing capacity, it belongs to that class's own engine.

#### Balance pass, at two anchors

Measured by `tools/balance_summoners.mjs` against the four already-tuned trees, at both build shapes, at **two levels**. One anchor is not enough: a depth-versus-breadth ratio is a point on a curve that moves with how much of a character's total investment one rank represents.

| | level 12 (3 slots, region 2) | level 70 (region-8 anchor) |
|---|---|---|
| a rank-11/69 signature is | 92% of every point owned | 99% of every point owned |
| `necro_summons` wide → deep | 14.2 → 24.6 (1.74) | 26.1 → 48.3 (**1.85**) |
| `druid_beasts` wide → deep | 18.0 → 7.8 (0.43) | 27.5 → 19.0 (**0.69 — live decision**) |
| `samurai_armor` wide → deep | 25.9 → 16.4 (0.63) | 29.0 → 49.3 (**1.70**) |
| `samurai_tactics` wide → deep | — | 39.6 → 55.8 (**1.41**) |

Both trees sit inside the reference band at both shapes and both anchors.

**No skeleton cap. The earlier reading was an artifact of the anchor.** "Depth dominates at 1.90 against the Samurai's 0.63" was measured only at level 12 — and at level 70 the *already-tuned* Samurai trees flip to 1.70 and 1.41. Depth favouring the endgame is the norm for a tuned tree here, not a Necromancer anomaly, and the Necromancer's 1.85 sits beside `samurai_armor`'s 1.70. Capping skeletons from the level-12 number would have capped the endgame using the tutorial.

**The Druid's shape problem resolved without a balance patch.** §9.5's ruling that minion HP is the rank's duration term is what fixed it: a rank now raises a minion's damage *and* how long it survives, so investment stops buying a pet that hits harder and dies just as fast. The ratio moved 0.43 → 0.69 at the endgame anchor, from BREADTH DOMINATES to a live decision. The flat HP inflation applied earlier as a balance patch has been **reverted** — it moved the number (0.53 → 0.84 animals standing) without moving the shape, which was the evidence that the constant was never what was wrong.

---


## 9. Economy and Shop

*Not yet built. Phase 4.*

### 9.1 The problem

The pre-overhaul shop pays out fast because a run was one floor. Across 48 maps that curve produces a party that has bought everything relevant by region 4 and then accumulates gold with nothing to spend it on.

Two levers together: **slower income** and **escalating prices**. Price escalation matters more.

### 9.2 Item categories

| Tier | Changes | Rarity |
|---|---|---|
| Stat items | Flat + with a **randomly rolled** − on another stat | Common |
| Magnitude | Splash radius, projectile count, **pierce**, chain jumps, duration | Common–Rare |
| Rider | Adds an effect the skill did not have | Rare |
| Domain add | A skill also resolves the triangle as a second domain, whichever reads better | Rare–Legendary |
| Selector add | The skill **also** hits what a second selector picks | Rare–Legendary |

**Radius lives in magnitude items exclusively**, since ranks no longer grant it.

**No cooldown reduction on any item.** Same reasoning as ranks: an item that shortens cooldowns lets a narrow build buy back its uptime and the depth-versus-breadth pressure disappears.

**Pierce is the answer to escorted targets** (§5.9) and belongs in magnitude.

#### Items add, they never take away

**The tier is "domain ADD", and that is the design rather than a compromise.** It was drafted as "domain swap" and the two halves of the section disagreed: a swap replaces, and the governing rule below says an item may never take away. **The governing rule wins over the label.** A skill resolves the triangle as the best of its own domain and any an item grants, so a build gains the matchup it lacked and keeps every matchup it had. A literal replacement would let a single shop roll invert a build's whole triangle position — the exact failure that deleted trigger-swap items from the design — and shipping it would have re-introduced that failure under a different name.

**Trigger-swap items are deleted from the design.** An item that changed *when* a skill fired could invalidate a build mid-run — a player who had spent forty points around a trigger could have it rewritten by a shop roll.

The late-game power spike that tier was meant to deliver is better served by items that **add** to what a skill already does: hit the nearest two targets instead of one, add a little splash, add an effect it did not have. Those are the magnitude and rider tiers, which already exist and need no new machinery.

The same principle governs selection. **Selector-add, not selector-swap.** An item does not change `nearest` to `highest_hp`; it makes the skill *also* strike the highest-HP target in range. A crowd-clearing build that finds one gains an elite-killer without losing its crowd clear and without spending a point.

**The rule for every modifier tier: an item may add, never take away.** Finding a modifier should feel like a new capability arriving, never like a familiar one leaving.

#### Late-game weighting

Magnitude, rider, and selector-add items weight toward later regions. That is where an additive spike belongs — the maps are harder, and a build has settled enough by then for a new capability to read as a change rather than as noise. It is also the second reward curve in the game: §3.4's class unlocks pay off on the *next* character, while modifiers pay off on this one.

#### Stat items and the random roll

A stat item grants a flat bonus and rolls its penalty **randomly against another stat**. There is no fixed opposition table.

A fixed table — damage always costs speed — is memorised after one run, and the shop stops being a gamble. Rolling the pairing keeps every offer a real question: sometimes the penalty lands somewhere the build does not care about, sometimes it lands on the stat the whole character rests on. That variance is the point, and it is the same lottery the reroll economy is built around.

**OPEN — penalty weighting.** Fully random means an item can roll its penalty into a stat the build does not use at all, which makes it free. Roll enough offers and the correct play becomes shopping for the free one, and the trade-off stops existing. The candidate fix is to weight the penalty *lightly* toward stats the build actually uses — still random, still occasionally lucky, rarely free. Needs a ruling before the roll table is built.

**Weapons are gone from the game. `SHOP_WEAPON_CHANCE = 0`.** A shop stocking unequippable items is a bug, not a design question.

#### Where each modifier is read

The tiers above are not new machinery. Every one of them already had an item hook and an aggregate field; what they lacked was a reader on the skill path, because the readers were all in `_fireWeapon` and `_hitEnemy` and nothing has called those since weapons were removed (D-25). Recorded here so the next tier is authored against a site rather than a hope:

| Tier | Hook | Read in | Notes |
|---|---|---|---|
| Magnitude | `extraProjectiles` | `PRIMITIVES.bolt` — added to the target `count` | The tier's headline shape: "hit the nearest two targets instead of one" |
| Magnitude | `extraPierce` | `spawnSkillProj` — added to `pr.pierce` | **No skill declares a `pierce` rider**, so the item is the whole of pierce. §5.9 puts it in the shop deliberately |
| Magnitude | `eliteBossDamage` | `skillDamage()` | Beside Ferocity and the domain triangle |
| Magnitude | `knockbackBoost` | `applyImpactRiders` | Scales a declared knockback; see rule 25 for why there was nothing to scale |
| Magnitude | `nextAttackAfterDodge` | `fireSkill` → `stepDamage` | Consumed once per fire, for the whole fire, exactly as the weapon path spent it |
| Magnitude | `summonBoost` | `minions.js` — damage and HP terms | Beside Ingenuity, not folded into it, so a report can say which one moved |
| Rider | `burnOnHit`, `chillOnHit`, `chainOnHit` | `skillDamage()` → `applyOnHitRiders` | |

**`skillDamage()` is the modifier path**, for the same reason it is Ferocity's: it is the one function every composed impact passes through, so no primitive has to know a modifier exists. That is the property that makes phase 5's twelve classes free — a tier added here reaches skills nobody has written yet.

**Impacts, never ticks.** Zones, burn and plague damage through `_areaDamageEnemies` and direct HP subtraction, not through `skillDamage`, so a 15%-chance proc rolls on hits rather than sixty times a second inside a hazard. That is a property of the call graph rather than a guard, and `item_gate` measures it.

**A minion's hit procs its owner's riders**, because §13 rule 23 makes `hookAgg` the owner's field by reference on the actor facade. A skeleton carrying its summoner's burn is the same statement as a skeleton's kill being its summoner's kill.

#### Crit — RULED

Crit did not exist in the skill era. It was decided only in `_fireWeapon`: no composed step rolled it, no rider granted it, no stat carried a crit term, and this document had never mentioned it — while six items sold it and a seventh healed off it.

**Crit is a roll inside `skillDamage()`**, the same single path that made Ferocity work, so every composed source inherits it without a per-primitive decision and phase 5's twelve classes get it free.

**Reflex drives crit chance.** Reflex is already the variance stat — a chance-based outlier outcome on defence — and crit is the same thing on offence. That makes it two-sided the way Grit is, and it creates the decision the design needs: **Ferocity buys damage, Reflex buys the chance of much more.**

**Ferocity was rejected for the job, and the reason is the ruling's whole point.** Ferocity already multiplies all composed damage, so a crit term would have made one point buy flat damage and variance damage together, compounding into a strictly dominant stat. That breaks §1.1's trade-off pillar, and it poisons §9.2's penalty roll specifically: a penalty into a dominant stat is always the worst roll, so the randomness that makes the shop a gamble stops mattering.

Two terms in one formula, not two definitions of one thing:

| Term | Sources |
|---|---|
| chance | Reflex × `CRIT_CHANCE_PER_REFLEX` + item `critChance` |
| multiplier | the player's base (`CONFIG.CRIT_MULT_BASE`, or a trait's) + item `critMult` |

Splitting a *mechanic* across two sources is what rule 25 warns about. Splitting one *formula* across two terms is arithmetic, and both resolve in one roll on one path.

The six conditional grants — after a kill, every Nth hit, versus chilled, versus burning, versus full HP, first hit of a room — resolve **before** the roll and do not consume it. An item promising "every 10th hit crits" delivers on the 10th hit whether or not the dice agreed.

**The RATE is an assumption, not a ruling.** `CRIT_CHANCE_PER_REFLEX = 0.5` means a Reflex build at the `DODGE_CAP` of 60 carries 30% crit alongside 60% dodge. It is set low deliberately, because Reflex now pays on both sides of the fight and a conservative number can be raised after measurement rather than walked back after a patch.

**The roll draws from a dedicated seeded stream** (`sim.critRng`), for two reasons. Determinism: same seed, same crits, so a gate compares exact numbers instead of averaging variance out — a variance mechanic measured by washing variance out is a gate that cannot tell a small effect from none. And isolation: crit rolls do not consume from the shared `rng`, so adding crit did not shift the sequence every existing balance measurement was taken against. §4.2's sweep moved once already when a gold multiplier started drawing from the shared stream, and once was enough.

**`stat_gate` measures both halves of Reflex.** It now sweeps *channels* rather than stats — 11 channels across 10 stats — because proving one channel says nothing about the other, and a single-probe gate would have reported Reflex green with half of it unmeasured.

#### BUILT — what phase 4 shipped, and the two answers it owes

`item_gate` reports **48 of 48 hook kinds live across 173 items**, and refuses to let anything into the shop that does not move an observable. `econ_gate` asserts §9.2's and §9.3's constraints by effect rather than by name.

| Tier | Items | Read in |
|---|---|---|
| Stat, rolled penalty | 9 | the sheet, via `_itemStats` — level scales bonus and penalty together |
| Magnitude | 8 | `bolt` count, `spawnSkillProj` pierce, `skillDamage`, `applyImpactRiders`, `minions.js` |
| Rider | 4 | `skillDamage` → `applyOnHitRiders` |
| Domain add | 3 | `skillDamage` → `bestDomainMult` |
| Selector add | 3 | `PRIMITIVES.bolt` |

**ANSWER 1 — the free-roll rate with a real item pool is 10.8%, not 28%.** Measured the way `penalty_roll` measured it, with every build run twice: bare, and holding what a run of that length actually hands it (`level/3` items drawn through the shop's own rarity roll and late-weighted picker).

| | mean | worst build |
|---|---:|---:|
| No items — the old measurement | 18.8% | 29.3% |
| Real pool | **10.8%** | 25.8% |

The gap is the measurement's own bias, and it is exactly the one flagged when the 28% was first reported: with no items, `druid_rejuvenate` is the only healing source in the game, so Recovery reads free in every build that is not a Druid. Give the build the regen, lifesteal and kill-heal items a run supplies and Recovery becomes a stat it can feel. What survives at 10.8% is genuine build shape — a Samurai still does not care about Ingenuity, because it has no summons and never will.

**Weighting is still not added.** One in ten rolls landing somewhere harmless is variance, not a broken trade-off, and §9.2 already argues that the occasional lucky roll is the point. Re-measure when phase 5's twelve classes widen the spread of what a build can ignore.

**ANSWER 2 — late-game weighting is data on the item, at a cost of one number.** `lateWeight` (0..1) lives on the item; the shop holds no region table and knows nothing about which items belong where. It passes a single normalised progress scalar to `_pickWeighted`, and the item's own data decides.

That one number is the whole coupling and is worth naming rather than pretending it is zero: weighting is a function of the item *and* the position in the run, so something must know the position. The choice was whether the shop knows **region semantics** — a table of which items appear where, which grows with every region and every item and is exactly the sort of thing that spreads — or a single float. It is the float. **Adding region 5 changes no shop code.** Measured: late-weighted rares are 16.3% of region-1 rolls and 34.0% of region-8 rolls.

### 9.3 Sinks and respec

Shop rerolls escalating within a visit; item upgrades; **skill respec at 1000 gold base, multiplying ×2.5 per use, never resetting**. Respec refunds all points at once — per-point respec would let players micro-optimise between every map.

**Built and measured** (`econ_gate`). Rerolls run 6 → 9 → 14 → 20 within a visit and reset to 6 at the next shop: escalation is the pressure inside one browse, not a tax across a run. The respec ladder is 1000 → 2500 → 6250 → 15625 and survives a floor change — never resetting is the whole mechanic, since a cost that reset per region would make rebuilding a routine rather than a decision.

**An item upgrade is a duplicate purchase**, priced at ×1.6, capped at level 4, and it deepens *both halves*: the bonus and the rolled penalty scale together, so buying a second copy is never a way to acquire the upside alone. Hook payloads are not scaled by a blanket multiplier — an item declares an explicit `perLevel` block instead, because "stronger" is not the same direction for every field and a generic ×1.5 would quietly weaken a lower-is-better one.

### 9.4 Numbers

All placeholders for playtest. Income roughly flat within a region, scaling ~15% per band; item prices ~25% per band; reroll cost doubling within a visit. **Target: 1–2 purchases per shop visit throughout the run, never 6.**

### 9.5 Stats

Ten stats. This section records what each is **for** — the code in `js/config.js` records what each is worth. Where they disagree, this section wins.

Three stats are currently dead (D-23) and one is half-live. Their entries below state the intended job, not the current behaviour; §15 tracks the gap.

#### The ten

| Stat | Job | Reads |
|---|---|---|
| **Vitality** | How much punishment the body absorbs before it stops | Max HP, room-start restore, `hpAbove`/`hpBelow` conditions, objective %-max true damage |
| **Ferocity** | The general offence stat — **multiplies all composed damage** | *Dead. Intended: a multiplier applied in the compose damage path, the counterpart to Vitality* |
| **Tempo** | How fast the body moves. **Movement only** | Move speed, Wizard decree tick |
| **Grit** | Damage mitigation and staying put | Mitigation, knockback resistance, Quill reflect, and `p.engines.armor` for `scaleWith` |
| **Reflex** | Avoiding a hit outright | Dodge roll in `hurtPlayer` |
| **Recovery** | How much healing is worth | `_heal()`, every healing source; Priest shield scaling |
| **Ingenuity** | **The summoner stat** — minion damage and minion HP | *Dead. Intended: applied to every summoned actor's damage and HP* |
| **Attunement** | **Status potency** — the strength and duration of slows, weakens, and damage-over-time | *Dead. Intended: applied wherever a status is written, including the composed path* |
| **Greed** | Wealth and luck | Tithe on fight clear, rarity bias in `_rollRarity`; Assassin contract payout |
| **Reach** | How far the body's influence extends | Pickup magnetism, ToH trait radii |

#### Tempo is movement, and the label is the bug

Tempo reaches only move speed. **That is correct and should not be changed.**

An "attack speed" stat would be cooldown reduction wearing a different name, and §4.2 keeps cooldown reduction off ranks and off items because it is the only thing preventing a narrow build from buying back its uptime. A stat item granting Tempo would reintroduce it through the back door.

**The defect is the UI claiming attack speed, not the implementation withholding it.** Fix the label.

#### The three dead stats and their intended jobs

Each dead stat's old read-sites point at what it was for, and each has a natural home in the skill era:

- **Ferocity** was weapon damage. Its skill-era job is the same one generalised: **a multiplier on all composed damage.** It is the offence stat the way Vitality is the defence stat, and it is the one every class wants some of.
- **Ingenuity** was read only by `_summonStats` — the summon stat, in a game that then had no summons. §8.5 gives it a job: **minion damage and minion HP.** The class that just gained summons currently ignores the summon stat.
- **Attunement** was applied by `_applySlow` but not by `applySlow`, the one every composed skill calls. Its job is **status potency** — how hard a slow slows, how long a weaken lasts, how much a plague ticks.

**A stat is defined by what it multiplies, not by which function happens to call it.** All three were alive in the weapon era and were left behind by a migration that moved the damage path; none is a new stat needing a new design.

#### Minion HP is duration

A summoned actor's HP is how long it lasts. Under §4.2 — ranks raise damage and duration — **a rank in a summon skill raises both its minion's damage and its minion's HP**, because for an actor those are the two terms.

This is the intended reading and it resolves a measured problem: a rank-11 wolf that hits harder but dies just as fast, then costs a 15-second revive, makes depth strictly worse than breadth for the Druid. HP scaling as the duration term is not a balance patch; it is the rank rule applied correctly to a thing that has a body.

#### Which stats feed `scaleWith`

Grit already bridges to skills as `p.engines.armor`. Any stat may be exposed the same way, but exposure is a design decision per stat, not a default — a stat readable by every skill stops being a stat and becomes a global multiplier.

Currently exposed: **Grit**. Nothing else, deliberately.

#### The penalty roll — constraints and measurement

*§9.2 states the rule; this states what the roll may not do, and what it measures at.* Both sections were headed "Stat items and the random roll" until the merge that folded the last web upload found two identical headings in one document — the only structural defect it turned up, and pre-existing rather than merge-made.

§9.2's stat items grant a flat bonus and roll their penalty **randomly against another stat**. There is no fixed opposition table, because a fixed one is memorised after a run and the shop stops being a gamble.

Two constraints on the roll:

1. **A penalty may not roll into a stat the character has none of.** Reducing a stat already at zero is free, and a shop full of free items has no trade-offs.
2. **Tempo is rollable; cooldown is not a stat.** Nothing in the roll table may reach a cooldown, directly or by proxy.

**OPEN — penalty weighting. MEASURED, NOT YET RULED.** `tools/penalty_roll.mjs` applies a real penalty to each eligible stat, replays the same fight from the same seed, and calls it free when nothing observable changes.

| build | eligible pool | free-roll rate | free for this build |
|---|---:|---:|---|
| Necromancer L12 | 7/10 | 40.3% | reflex, recovery, reach |
| Druid L12 | 7/10 | 28.5% | reflex, recovery |
| Samurai L12 | 7/10 | 42.3% | reflex, recovery, ingenuity |
| Necromancer L70 | 10/10 | 9.8% | recovery |
| Druid L70 | 10/10 | 17.8% | reflex, recovery |
| Samurai L70 | 10/10 | 29.3% | grit, recovery, ingenuity |

**Mean 28.0%, worst 42.3%.** The zero-stat constraint alone removes only 1.5 of 10 stats from the pool on average, so **it is not sufficient** — roughly one roll in 3.5 lands somewhere the build cannot feel.

**But the number is inflated by content that does not exist yet, and weighting should not be added on it.** Recovery is free in **five of the six builds**, and it dominates the result for one reason: `druid_rejuvenate` is the only healing skill in the game. A stat is free for a build with no source for it, and eleven of fourteen classes have no tree at all — so the measured pool of "stats a build engages" is small because the content is missing, not because the design leaks.

**Re-measure when phase 5 has landed healers, status classes and more summoners.** If the rate stays near 30% with a full roster, weighting is justified; if it falls, fully random stands and the lottery is preserved unmodified. Adding weighting now would tune against a three-class game.

*Known limitation:* three cells read UNTESTED — a build owns a status or summon source that the 45-second staged fight never fired. They are counted as neither free nor felt rather than assumed.

#### The stat gate

**Everything the game sells must be read by something in the live path, proven by effect rather than existence.** `tools/stat_gate.mjs` stages each stat in the situation where it would matter and compares a bumped run against an unbumped one from the same seed.

A grep cannot do this job: `p.stats.ferocity` appears at four read sites and all four are dead code. Nor can a single arena run — Reflex read as dead until the probe arranged to be hit, and Greed read as dead until the probe learned the tithe fires on fight clear rather than per kill.

This is the stat-system counterpart to the offence gate, and its absence is the same gap that let a party with no offence pass a green suite for an entire overhaul.

**Any stat displayed to a player, offered on level-up, or sold in a shop must pass the gate.** A stat that cannot be shown to move something is not a stat.

#### Dead constants

`SCALING_RATES` was weapon-era and unread by the combat path. **It is deleted, not deprecated** — `js/config.js` keeps a comment where it stood, naming what it did and why it went, because a dead constant that looks live is how the README drifted the first time.

This line said "scheduled for removal" for two drafts after the removal had happened. It was caught by the merge that folded the last web upload, not by a check — the GDD has no gate, which is the argument for it having exactly one writer.

---

## 10. Failure and Death

**Party wipe resets the current region.** The tree regenerates, region progress is lost, the party re-enters at the first node. Level, points, and items are kept in full.

**Downed, not dead.** A player at zero HP is downed and revivable by a teammate. A wipe is declared only when the whole party is down simultaneously. In an 8-player game, removing a player for the rest of a 10-minute map means they sit and watch.

**No solo exception.** A solo player who goes down restarts the region.

Full HP restore at the start of every room, except under the `bloodprice` curse.

---

## 11. Saves and Multiplayer

### 11.1 One object per character

There is no separate world save. World progress lives on the character:

```js
{
  id, class, level,
  points: { spent: {...}, unspent: n },
  items: [...],
  frontier: 2,
  parked: { region, tree, cleared, difficulty }
}
```

Opening a character in solo sets the world map to that character's frontier and restores its parked tree. A character can never be in two worlds at once, because the character **is** the world.

A separate small player-level store holds unlocked classes and nothing else.

### 11.2 The frontier rule

- The **host's active character sets the region** for everyone.
- A character advances its frontier **only by clearing the region that is its frontier**.
- Playing below it is a replay and grants nothing new.
- Playing above it — being carried — grants **levels and items but no world progress**.
- Frontier advances on **presence at the region boss kill**.

Hosting is not privileged; it only decides which region everyone is in. Two friends at the same frontier both advance by playing together.

### 11.3 Mid-region state parks

A character three maps into region 3 who joins a friend's region 3 plays the host's rolled tree for that session. Their own tree and cleared nodes are untouched.

The save format follows: a frontier integer and parked region state, nothing more. Nodes cleared in someone else's game never write back.

### 11.4 Levelling alternate characters

Finishing with one character leaves every other at level 1. Replaying regions is the intended path. **Replay difficulty is the lever** — and XP is not tied to difficulty, so the reward for raising it is that content stays playable, not that it goes faster.

The other path is being carried, which gives established players a standing reason to host.

### 11.5 Mismatched levels

**No clamping.** A high-level character may join a low-level world and power-level the party. The lobby shows each player's level against the region's expected level so a party sees the mismatch before committing.

### 11.6 Storage

localStorage or IndexedDB, with **export and import to a file**. **Clearing browser data destroys saves** — stated plainly in the UI, with an export prompt after each region clear.

Client-authored saves are trivially editable and that is accepted. The consequence: **this model cannot support leaderboards or public matchmaking**, and neither should be proposed without revisiting the architecture.

---

## 12. Netcode

### 12.1 State versus event

**If losing it breaks the game, it is state and rides the snapshot. If losing it is cosmetic, it is an event and may be dropped.**

This rule was derived from a live defect: an event sent while a peer's channel was not open was gone permanently — no buffer, no replay, no error. Snapshots survive this because they repeat at 15 Hz carrying whole state; one-shot events do not.

Examples: the region node map, cleared nodes, frontier, difficulty, loadout, boss phase, and arena geometry are **state**. A per-floor biome string is an **event** — losing it costs a flat floor, not a run.

**Send-on-change is not an acceptable optimisation for state.** A client that misses the single snapshot carrying a change is back where it started — this reintroduces the exact bug it appears to fix. Redundant transmission is the mechanism. Measured cost: 22.9 KB/s on the map screen, 4.9 KB/s in an arena.

### 12.2 Any screen holding co-op state needs a repeating channel

The lobby had none, so lobby state travelled as a one-shot broadcast with the same drop hazard. It now carries a **3 Hz heartbeat**. Screens that cannot carry state redundantly cannot hold state that matters.

### 12.3 Never swallow a failed send

A silent drop with a clean console cost seven runs to diagnose. Every skipped send logs peer id and event type, and the counter is asserted at suite teardown.

**Both directions must be instrumented.** "Zero drops" was true and useless for a full session because only `HostTransport` was instrumented while the failing path was `ClientTransport.send`.

Drops are classified: `ui` resends until acknowledged, so a drop there is a delay; `in` and `ping` are lossy by design; anything else fails. A `GAVE UP` line fails regardless — that is an action resent for its whole budget and never acknowledged.

---

## 13. Engineering Standing Rules

Each has caught a real defect on this project. They are design constraints on how the game is built, not preferences.

1. **Runtime-path tests, not definition tests.** The source project shipped 19 skill kinds wired to nothing, all passing existence checks.
2. **A harness that clears fights cannot launder a combat result.** `nuke()` killed every enemy every 240 ticks, so the suite stayed green against a party with **no offence at all**, for the entire overhaul. It is now `clearFieldForSetup(sim, p, reason)` — it demands a reason, stamps the sim, and a stamped sim may not carry a combat result. Every run prints how many fights the harness ended.
3. **An instrument no test reads is not an instrument.** A drop log written to a console the harness did not pipe caught nothing.
4. **Gates assert their own instrument before measuring.** Seven instances, including a 12-second offence test that declared a working engine broken, and a three-branch classifier that read 2-of-23 hits as regeneration.
5. **Assertions read the event log, never derived state.** HP has misled three times, in both directions.
6. **A count is not a set.** Regressions are reported by set diff, always.
7. **A suite that stops early is not a suite that passed.** A crash is not one failure — fixing it reveals what it was hiding.
8. **A suite that dirties the working tree is a failed suite.** Prefer making a reflex unavailable over detectable — `.gitignore` over a gate.
9. **Enumerated resets are the defect.** Pool reuse wipes every own field; anything forgotten reads `undefined` at the point of use rather than a plausible value from another entity.
10. **Determinism is a prerequisite for measurement.** Same seed → byte-identical run, with a negative control that fails if the sim ignores its seed.
11. **A failure name describes the cause, not the symptom that tripped first.** Five instances: "co-op is flaky" covering three defects, a "coilgun pair" read as PeerJS pairing, a compound `client ready`, one unplayable-run defect wearing three names, and a cogsmith check naming the wrong gap.
12. **A test's negative case must be unreachable by search-and-replace over the thing it tests.** A bulk rename rewrote a deliberate retired-id literal into a valid class, turning the test into a tautology — twice. `RETIRED_ID = ['bul','wark'].join('')` is ugly on purpose.
13. **A number impossible on its face is a free bug detector.** "78 of 52 elites" caught a miscount before anyone quoted it.
14. **Guards use `&&`, never `;`.** A guard that cannot fail the command is not a guard.
15. **Strip comments before pattern-checking code.**
16. **Vary test staging** — more than one seed, more than one position.
17. **All numbers in `TUNING` blocks.**
18. **Verified push** — confirm with `git ls-remote` before treating a branch as landed.
19. **Save tests round-trip through a real file.**
20. **A harness must arrive in the state a player would arrive in.** Level, slots and items are part of the FIXTURE, not incidental setup. Objective harnesses dropped a party in at level 1, and `spendSkillPoint` auto-slots only into an already-unlocked slot while `setLoadout` refuses mid-fight — so a party that learned ten skills fought entire objectives with **one**, however high it levelled during them. That hid a build-depth constraint behind an apparent HP constraint for three patches: at three slots, with nothing tuned, Nest Purge at 4p went from 1/3 to cleared and Elite Arena solo from zero kills to cleared.
21. **Everything the game SELLS a player must be read by something in the live path, and a gate must prove it by effect rather than by existence.** This is the stat-system form of the offence gate, and its absence was the same gap: a green suite once hid a party that could not deal damage, and a green suite then hid three stats that did nothing while being offered at every level-up. A search for the identifier is not evidence — `p.stats.ferocity` is read in four places, all of them dead code. `tools/stat_gate.mjs` stages each stat in the situation it would matter in and compares a large swing against an unbumped run from the same seed; a stat that moves no observable fails. Extend it to any other currency the game offers, and never let a probe that could not run report as a pass.
22. **A ratio reported over a chosen subset is not a finding.** Six trees measured deep-versus-wide at the endgame anchor came out 3 depth-dominant and 3 breadth-dominant. A four-tree table drawn from the same run — omitting the two breadth-dominant Necromancer trees — read as "3 of 4 depth-dominant" and sent a design conclusion the wrong way: it argued that §4.2's self-balancing claim was half broken and that every class might need its own breadth cost. Neither was true. Report the whole population or state the selection rule in the same sentence as the number; a subset chosen while building a table is a selection rule nobody declared.
23. **An entity that acts is an ACTOR, not a behaviour.** Give it the existing primitives and the owner's identity by reference; do not give it verbs of its own. A minion's attack is a compose step through the same `PRIMITIVES` table a player's skill uses, and its `idx`/`stats`/`hookAgg` *are* the owner's fields, so attribution never has to be forwarded because it never diverged. This is why summoning — the largest bespoke category in the source project, where every summon carried its own spawn, attack and death code — cost **one primitive and one trigger** here, with zero per-archetype handlers across twenty new skills. The same shape is waiting for the Monk's traps, the Assassin's killbox, the Hunter's second body and the Priest's judgment marks. See §8.5.

24. **An exclusion asserted on a table is not an exclusion until something measures the effect.** §4.1 has said "XP is never scaled by difficulty" since phase 2b and asserted it at load — by checking that no difficulty row *declares* an XP multiplier. That assertion was true and irrelevant for four phases, because gold and XP rode the same number: a difficulty's gold multiplier paid XP with it through a shared quantity the assertion never looked at. The exclusion was not written down wrongly; it was written down in a place that could not see the leak. The general form is worse than a dead constant, because a dead constant merely does nothing while a declared exclusion actively tells the reader a risk has been handled. **Any rule of the form "X never affects Y" needs a probe that moves X and reads Y**, and the probe belongs in the same patch as the rule. Three separate defects have now been found this way — Ferocity, §2.4's Elite modifiers, and the difficulty ladder — each after a check on the declaration had passed for months.

25. **A rider table that lists a rider is not a primitive that applies one.** `RIDER_TABLE` declared `cone: [...IMPACT_RIDERS]` and `line: [...IMPACT_RIDERS]` while neither primitive called `applyImpactRiders`, so Bone Nova's knockback 300, Wrecking Ball's knockback and stun, Stampede's knockback, and the Banshee's and Dread Howl's `weakenDamage` were authored, validated against the table, and silently dropped at the moment of impact — five skills across two classes. This is rule 24 in the content layer: the table said the capability existed, and nothing measured whether it arrived. It was found by an item gate measuring something else entirely (`knockbackBoost` had no live knockback to scale), which is the argument for gates that assert by effect even when the effect is somebody else's.

26. **A probe that stages the wrong precondition is measuring a different game, and it fails in the direction that looks like a finding.** The rider gate's first run reported twelve declared riders DROPPED. Two were real. The other ten were one room: a crowd of six full-HP dummies satisfies `PROXIMITY` and `NEAREST` and *defeats* `ISOLATED`, which is "fewer than count within radius"; it never dips under a `TARGET_THRESHOLD`; and a Reflex dodge is deliberately not an `ON_DODGE` (§6.5), so hitting the player until the dice saved them armed nothing. Add an observer reading `burnDps` for a rider that applies plague and the count reaches ten. **Every one of those failures pointed at the game and was in the harness** — which is the dangerous direction, because a red gate reads as evidence. Stage per-trigger, name the mechanism rather than the flavour in every observer, and give any "it moved" observable a stripped-rider baseline: six bodies packed around a player separate by collision alone, and every knockback row passed on that drift before the baseline existed.

27. **A new stochastic mechanic gets its own RNG stream, or it silently reprices every measurement taken before it existed.** §4.2's deep-versus-wide sweep moved when the difficulty gold multiplier started drawing from the shared `rng` — not because build shapes changed, but because extra material drops consumed floats and every downstream roll shifted. The sweep had to be re-measured and the old number retired. Crit and the economy's penalty roll both arrived after that lesson and both got their own streams (`sim.critRng`, `sim.econRng`), which buys two things: a gate can compare exact numbers from one seed instead of averaging variance out of a variance mechanic, and adding the feature does not invalidate the balance table. The cost is one line at construction. **`econ_gate` asserts the isolation by effect** — twenty penalty rolls must leave the shared stream in the same place — because "it has its own stream" is a declaration, and rule 24 applies to this rule too.

28. **An anchor derived from the population it measures cannot detect a bad population.** The DPS gate compared every class against the median of every class, which is a tautology at scale: author twelve mediocre classes together and they become the median, and the one check that would catch a systematically weak batch reports "all within band". Worse, it had been measuring the wrong thing entirely — the harness was weapon-era and spent no skill points, so after weapons were removed every BUILT class read 0.0 while two classes with no tree read 3.2 and 16.2 off trait damage alone. The table was upside down for months and the median hid it, because the median was computed from the same broken numbers. **Anchor a band to a declared reference set, not to a live aggregate** — a constant list of things that have actually been balanced, which a new entry joins by an edit rather than by existing. And exclude the unbuilt: "has no tree yet" and "is badly tuned" are different findings (rule 11), and averaging them together produces neither.

29. **A generic READ is not a generic WRITE, and only one of them makes something content.** `engineScale()` reads `p.engines[name]` knowing no engine by name, and that read-side generality was mistaken for the whole story when phase 5 was scoped: the batch sort promised six "resource-shaped" classes that could be authored two per patch with no engine code. Checking before authoring found that nothing publishes into `p.engines` generically — all three live engines are hand-written in shared code — and that two of the six needed a write path the engine does not have at all, one of them a twelfth entry in a primitive set closed since phase 1. **The question that decides whether a feature is content is not "is there a generic reader" but "can content produce the value the reader wants".** Ask it of the write side, per feature, before estimating anything.

30. **A capability the old system enforced is not inherited by the new one, and the gate that "covers" it may be reading a fixture that still has it.** `game.js` has stated one rule since patch 9 — "every splash, nova and blast chews barricades as well as bodies" — and enforced it on every weapon path: melee arcs called `_sweepWalls`, blasts went through `_areaDamageEnemies`, a straight shot damaged the wall that absorbed it. Composed primitives inherited none of it. Weapons were then removed, so in the skill era `strike`, `cone` and `line` swept **through** a Nest Purge barricade without scratching it, and a melee class had no way to damage a wall at all — measured, a Samurai parked against a ring for six minutes took twenty-four barricades down to twenty-two, and every point of that came from splash it had not aimed. **The gate that should have caught it said the level was completable**, because `bolt` reaches walls through the projectile tick and `hazard` through the zone tick, and the fixture happened to be holding a class with one. It surfaced only when registering the Wizard's trees moved which class `SELECTABLE[0]` returns — which is rule 28 a third time, now about a claim on a LEVEL decided by a positional class. Two habits follow. **When a subsystem is retired, enumerate what it was the only enforcer of** — grep the rule, not the identifier, and check each new path states it. And **a claim about a level is only as strong as the worst class that has to finish it**: `sim_test`'s solo objective fixture is now a named class chosen for being the hardest, and a separate check proves every built class can break a barricade in the situation the level presents (staged fight, ~14–74 s across the five).

31. **A composed skill aims itself, so anything that used to depend on the player's aim needs re-ruling, not re-plumbing.** The fix above was not simply "call `_sweepWalls` from the primitives". A weapon arc tested facing against a wall because `p.aimA` was the player's own aim; a composed skill's direction comes from `facing()`, which follows the skill's selector to an *enemy* (§15 defect #13, changed deliberately). Restoring the arc test verbatim would therefore have restored the *mechanism* while leaving the *capability* removed — a melee player could no longer choose to hit a wall, and the measurement said so: with facing respected, the Samurai went 24 → 22 barricades; with the ruling below, 24 → 11 and the level clears. **Ruled: a barricade within reach is struck regardless of which way the swing aimed.** A barricade does not dodge and fills the space it occupies, so range still matters and facing does not. **When authority over an input moves from the player to the system, every rule that read that input is now a design question.**

32. **A live write path is not YOUR write path. Check the guard, not the function.** The phase-5 audit filed the Bard as content-shaped on the finding "`p.stance` exists, initialised to 0, with `stanceCd` and `tohSwapStance` live" — every clause true, and the conclusion wrong. `tohSwapStance`'s first line is `if (!has(p, 'three_stances')) return false`, and `three_stances` is the **Samurai's** trait; measured, a Bard calling it gets `false` four times out of four while a Samurai moves 0 → 1. The field exists for everyone because initialisation is generic; the *write* is one class's. This is rule 29 sharpened: it is not enough to ask whether a generic reader exists, or even whether a writer exists — **ask whether the writer accepts this caller**, and prove it by calling it as this class. Worse, the read side was also unshareable: `p.stance`'s three values are read by Samurai-specific code, so a Bard that *could* write it would have inherited the precision-stance crit. **A shared field with a per-class guard is a private field wearing a public name**, and the audit that only greps for the name will file it wrong every time.

33. **An engine that is one word in a table cannot be audited, and auditing it anyway invents one.** The Mage's engine is listed as "Crystallize" and that word appears exactly twice in the project — the table row, and the audit line derived from it. No mechanic in the GDD, none in the compendium, and no field matching `/cryst/i` anywhere in a Mage's player object or in the sim. Asked "does it have a write path", the first audit found the nearest live counter — the `singularity` trait's per-fire tally — and proposed it, which would have given the Mage the **Bard's** engine (casts made) under a different label, breaking §8.3's one structural test that no two engines share a shape. Every other row in that table carries a clause saying what the engine *does*; the ones that do not are not scoped, they are named. **Before estimating a feature, check that the feature has a definition, and treat a bare name as an open design question rather than as a specification with the details omitted.**

34. **A trait that grants a damage stat is already an engine, and a tree that scales off the same resource bills it twice.** The Bard's Rhythm grants +3% Ferocity per stack (doubled solo), and Ferocity multiplies all composed damage — so a Cadence tree that also read `scaleWith: 'rhythm'` charged one resource on two lines and measured **137.5 DPS against a 29.5 anchor, +366%**. This is the compounding argument that disqualified Ferocity from driving crit (§9.5), arriving from the other direction: there the worry was one stat buying two kinds of damage, here it was one resource paying out through two systems. **Before authoring a tree against an engine, check what the class's TRAIT already converts that engine into.** The trait layer and the skill layer are different files, different eras, and nothing joins them but a measurement.

35. **A cast rate is a damage number.** The same tree's real fault was not its damage values, it was pricing AoE and multi-target nodes at 2–4× the cast rate of comparable nodes elsewhere while giving them comparable damage. "This class has the shortest cooldowns" is a legitimate identity and it belongs on the *single-target metronome* nodes that justify it; applied across a tree it silently multiplies everything. Tune a new tree against a NAMED existing tree node-for-node by shape — cone against cone, multi-bolt against multi-bolt — rather than against a feeling about the class, because a cooldown is the one number whose effect on output is invisible in the table it lives in.

36. **An engine the fixture cannot fill must be STAGED, or the class is measured in a state it never plays in.** The DPS gate fills most engines for free — footing because it pins the player still, rhythm and shift because it casts, marks because it marks — and `crystal` not at all, because its fixture's dummies deal no damage *on purpose*: the gate measures output, not survival. So the one engine filled by the enemy was the one engine the gate could never see, and the Mage would have been scored forever at an empty pool. The cost was concrete: at the numbers its trees were first authored with, the Mage read **+18% in band at an empty pool and +53% out of band with the pool full** — passing its own gate while being out of band in every fight it had ever been in. This is rule 28's family (a fixture deciding a claim it was never meant to decide) and rule 20's (arrive in the state a player arrives in) meeting on one line. Stage it, and **name the staging rather than inferring it** — a list of "engines this harness cannot fill" is reviewable, and a silent zero is exactly what `engine_gate` exists to prevent.

37. **A saturated instrument reads identical for a working mechanism and a broken one.** The probe asserting Grit's anti-synergy with crystallize first ran for six seconds and reported **10.0 crystal bare and 10.0 at 40 Grit** — no difference, because both had pinned `crystalCap` long before the window closed. The engine was working perfectly; the measurement had run off the end of its own scale. Sized to twelve blows, comfortably under the cap, the same probe reads **5.8 against 1.4, a 75% cut**. Any probe measuring a RATIO has to stay inside the region where the quantity can still move, and a capped resource makes that region finite — so check the cap before choosing the window, not after reading a null result.

38. **Retiring a subsystem orphans every hook it was the sole caller of, and the hooks do not announce it.** `tohOnFire` was found and reconnected when weapons were removed; its two siblings — `tohHitDamage` and `tohOnHit` — were not, and stayed dead for the whole skill era, taking four traits with them across three classes including one shipped as BUILT (§15, D-28). Each was a live function, exported, imported, and referenced in `game.js`; a grep for any of their names finds them and finds them "used". **What makes a hook orphaned is not the absence of a reference but the absence of a CALLER THAT STILL RUNS**, and that is invisible to every check the project had. Two habits follow. When a subsystem is removed, enumerate the functions it was the sole caller of and re-home each one deliberately — the same discipline rule 30 asks for capabilities. And prefer gates that assert a trait's EFFECT over gates that assert its existence, because the only reason this was ever found is that a write path was gated before the content that would have quietly absorbed the loss.

    **The audit that followed found two more, and a gate now stands where the audit was.** All fourteen roster traits were walked: which hook handles each, who calls that hook, whether any caller still runs, and — the question the static answers cannot reach — whether the trait's own observable moves in a real fight. Two were dead, both through `sim.summons` rather than through a function (§15, D-29). `tools/trait_gate.mjs` is the standing version of that walk, and it is the shape every future subsystem removal should be checked against.

39. **The control for "does this feature do anything" should be the feature's own switch, not a hand-built neutral fixture.** Every branch in `traits-toh.js` is guarded by `t.key === '<name>'`, so `trait_gate` runs each probe twice on the same seed, the same room and the same tree, swapping only the trait key for a sentinel. That is a starve with no teardown, no per-trait neutral variant to maintain, and no risk of the control differing in some second way — the failure mode that made the first knockback probe pass on collision drift. Look for the guard the code already branches on; it is usually a better control than anything a gate can construct.

40. **A gate's first red is a claim about the FIXTURE until proven otherwise, and the message should say so.** `trait_gate`'s first run reported five traits dead. **All five were staging.** The voodoo mirror banked nothing because a symmetric ring made every selector pick the same dummy the doll was pinned to — measured, 10 hits out of 10 landed on the doll, and `voodooMirror` skips the bound target by design. Bone dust read zero because a greedy deepest-first spender put all sixty points into the Necromancer's own trees and never reached the lent one that carries the summons. The Hunter's pack read alive-when-dead because the observable added a beast count the staging provided either way. Each looked exactly like a finding. **Write the failure message to name both hypotheses and their order** — "either its hook has no caller that still runs, or this probe stages the wrong situation; check the caller before the trait" — because a red gate reads as evidence, and the harness is the more likely author of it. §13 rule 26 is the same lesson; this is the instruction that follows from it.

41. **A mechanic that is a PAIR cannot be gated one half at a time, and a gate that stages one skill alone will say the second half is dead.** The Sundian's `drench` puts a counter on an enemy and `sluice` cashes it; each is useless without the other, and the rider gate reported `sluice` DROPPED twice — once on the synthetic path, which adds one rider at a time, and once on the declared path, whose whole idiom is a skill staged ALONE so that a landing rider is attributable. Both reds were the fixture. The fix is not to relax the isolation, which is what makes the gate trustworthy, but to **stage the precondition rather than a second actor**: companion riders are named per-rider for the synthetic host, and for real content the counter is written directly onto the targets. The measured skill stays the only thing in the room that could have produced the observable. Ask of any new rider whether it READS state something else writes; if it does, its probe needs that state staged, not inferred.

42. **When a primitive is proposed, test the cheap option by asking what the existing thing IS, not what it looks like.** The Assassin's killbox looked like a `hazard` with a dormant flag — same circle, same placement, same owner. It is not, and the way to see that is to read what a zone actually does rather than what it is shaped like: `addZone` makes a clock, and the zone tick advances it, accumulates against a cadence, damages on that cadence, applies riders and expires. A trap has no cadence, deals nothing while placed, and ends by being *consumed*. Carrying it on `hazard` would have meant a flag, a branch skipping every behaviour the tick has, an ignored payload and a consumption path — an object sharing its geometry with a zone and none of its verbs. **Shape is not identity.** Two things that occupy the same circle can still be two things, and the test that separates them is the list of behaviours, written out. Where that comparison lands also tells you where the code goes: `engine_gate` now asserts both halves of the answer — inert while placed, consumed by a cast — so the ruling is measured rather than remembered.

### 13.1 The through-line

**After a migration this large, a red check is more likely to be a test still describing the old world than a bug in the new one.** Of the last ten failures triaged, nine were tests measuring something that no longer existed. This will recur in phase 5, when twelve more classes arrive and every trait test written against two gets re-exercised.

---

## 14. Build Order

| Phase | Scope | Status |
|---|---|---|
| 1 | Trigger system, composed-action schema, damage triangle, 2 classes × 1 tree | **Done** |
| 1.5 | Telegraphs, positional `ON_DODGE` | **Done** |
| 2 | Region systems, node trees, saves, second trees | **Done** |
| 2b | Node behaviour, world map, difficulty, regions 1–2 | **Done** |
| 3 | Co-op hardening, roster retirement, selectors, offence gate | **Done** |
| 4 | Economy: stat items, modifier tiers, sinks, respec, §9.5 stats | **Done** |
| 5 | Remaining 12 classes, 38 trees, regions 3–8 | **In progress** — Wizard and Priest built (10 trees, 100 skills, 5 selectable classes); regions 3–8 blocked on `PIXELLAB_API_KEY` |

Phase 5 is the bulk of remaining work by volume, but phases 1–3 established that it is authoring rather than engineering: zero bespoke handlers across 40 skills, `scaleWith` generalising with no engine known by name, and selectability derived from tree data so a new class needs no code. **The binding constraint on phase 5 is art** — 36+ enemies and 6 bosses.

---

## 15. Open Items

**None of the current sim_test red is a defect.** `tools/sim_test.mjs` reports **10 failing checks**: 1 is content not authored, 2 await a design decision, 7 are weapon leftovers waiting on a ruling. The counts sum to 10 with nothing double-counted, and all eighteen focused instruments are green — `offence_test`, `determinism_test`, `snapstate_test`, `region_test`, `room_reg_test`, `uiack_test`, `telegraph_test`, `skill_sweep`, `footing_grace_test`, `phase2_gates`, `stat_gate`, `difficulty_gate`, `item_gate`, `rider_gate`, `econ_gate`, `engine_gate`, `trait_gate`, plus `validate_items`.

**The count did not move when the Wizard and the Priest landed, and one line inside it did.** `DPS gate` closed (Group A), and the weapon-cap pair renamed itself — see Group C. Registering two classes turned `nest (1p)` red on the way, which was **D-27**, a real defect, now closed below.

**Group D is empty.** D-23, D-24, D-25, D-26, D-27, D-28 and D-29 are all closed. Every one was found by measurement rather than by a red check, and the last two were found by a gate written *before* the content it guards — D-25 by an item gate built ahead of the item pool, D-26 by a rider gate built to generalise a defect the item gate had stumbled into. That is the argument for keeping the measuring tools between patches, and for writing the gate first.

**A failing check and an open question are not the same thing**, and this section previously counted them together. Group B below lists six items; only three of them are red lines. The other three are decisions with nothing currently failing, marked *no failing check*.

### Group A — waiting on phase-5 trees (1)

Eleven classes have no trees. Weapons are removed, so a class without a tree cannot attack, cannot trigger an attack hook, and cannot finish a level. **Nothing here is repairable by code.**

| what fails | count | why |
|---|---:|---|
| ~~`no coral planted`~~, ~~`toh blob`~~ | 0 | **BOTH LEFT THIS GROUP.** `no coral planted` closed by content: the Sundian has trees, so it casts, so `tohOnFire` plants coral every fourth cast. `toh blob` needed one more thing — the snapshot fixture seated a Samurai beside a Samurai, so no class present could produce the coral the check asserts rides the wire. `toh blob: null` was a statement about the fixture (§13 rule 20). It now seats a Sundian and reads 3 nodes. |
| ~~`no singularity in 30s`~~ | 0 | **LEFT THIS GROUP by gaining content.** The Mage's trees landed, so it casts, so `tohOnFire` counts to nine and the singularity forms. Nothing about the trait changed. |
| ~~`Bard rhythm never built`~~ | 0 | **LEFT THIS GROUP — half by gaining content, half by rule 20.** The Bard's trees landed, and the check still read 0 because the trait fixture spent no skill points: `tohOnFire` runs only from `fireSkill` now, so a bot with a tree it never learned still never attacks. Arming the fixture the way a player arrives (§13 rule 20) closes it at **10 stacks, +60% Ferocity, +95% Tempo solo**. The remaining three stay red for the reason this group gives — those classes genuinely have no tree. |
| `expected 2 beasts across 2 Hunters` | 1 | `toh_hunter` has no tree, so it is constructed through a path that never reaches fight-start granting. |
| ~~`DPS gate`~~ | 0 | **LEFT THIS GROUP, and not by gaining content.** The harness was weapon-era: it spent no skill points, so with weapons removed every BUILT class measured 0.0 while two classes with no tree measured 3.2 and 16.2 off trait damage alone. The table was upside down since `patch-trigger-core` and nothing said so, because the median it compared against came from the same broken numbers. It now spends the class's trees, and the anchor is a declared reference set rather than a live median. |

**Three entries have now left this group.** `elite_arena (1p) never cleared` went green when the Necromancer's Summons tree landed — the class gained a third tree, the solo build got deeper, and the objective cleared with nothing tuned. `toh_druid` left with its own tree. That is the group working as labelled: it said "not built yet", something got built, and it closed.

### Group B — waiting on a design decision (2 failing, 3 open questions)

| Item | Question |
|---|---|
| **Throughput: Nest Purge** | **CLOSED — working as intended.** Measured at both party sizes with the party arriving at level 12: 4p clears 3/3 at 213 s of 360 s. Solo reaches 2/3 and is not the target. The deciding factor was **loadout slots, not HP** — see §13 rule 20. *No failing check.* |
| **Throughput: Bounty Hunt** *(1 failing)* | **1p only now — 4p CLEARS.** See below; the EXPECTED-RED ruling has moved. The 1p number is now **0 of 5**, down from 1, because the solo fixture is a named worst-case class — **expected, and explained below so a diff does not read it as a regression.** |
| **Summoner harness gap** *(1 failing)* | Narrowed by §8.5, not closed. Skill-era summons exist and the Necromancer fields them, but they are *units* — they walk, they die, they are re-raised. Structure **recall** (`STRUCT_CHANNEL_S`) still has nothing to act on: `bonelord` builds its structure via `_addWeapon` and `weaponSlots` is 0. The decision is whether recall survives the removal of weapons at all. |
| **Penalty weighting on stat items** | **MEASURED AGAIN, still not added.** With a real item pool the free-roll rate is **10.8% mean / 25.8% worst**, down from 18.8%/29.3% with no items — the old number was inflated because one healing skill in the game made Recovery free in every non-Druid build. One roll in ten landing harmlessly is variance, not a broken trade-off. Re-measure when phase 5 widens what a build can ignore. *No failing check.* |
| **#8 — `ready` toggles even** | Every message delivered and applied, zero drops, and `ready` is still false — so `p.ready = !p.ready` fired an even number of times. Two mechanisms remain and they call for opposite fixes: one press became two messages, or one message was applied twice. **Deliberately unfixed** — two diagnoses have already been overturned by the next measurement, both times because the fix was chosen before the data. *No failing check.* |
| **§9.5 stats** | **CLOSED — §9.5 is written and D-23 is fixed.** All ten stats are read by the live path and proved by effect at 10/10 (`stat_gate.mjs`). Tempo's defect was the *label*, not the code: it reaches move speed only, and nothing shortens a skill cooldown. The glossary and compendium now say so. *No failing check.* |

#### Bounty Hunt is EXPECTED-RED until phase 4. Do not re-diagnose it.

`bounty (1p) never cleared` and `bounty (4p) never cleared` are **§5.9's design resolution appearing as a red line.** The specific thing to not do is reach for mark HP.

- Marks spawn with an escort pack **by design**. Escorts are a wall you clear first, and that is what distinguishes a mark from a nest: a nest is a structure you reach, a mark is a target you earn a line on.
- Punching straight through needs **pierce**, a §9.2 modifier item at the magnitude tier. It does not exist until phase 4.
- A 4-player armed party reaches **3 of 5 marks** in the full budget, which is the correct number for a party with no pierce.

Measured twice so nobody re-derives it: per-target attribution on the 1p mark showed the selector chose the mark on **23 of 23** fires with **2** arriving; across `offence_test` the selector chooses the mark on **93.4%** of objective-targeting fires. It is not a targeting failure — the shots are intercepted. `offence_test` therefore asserts **selection correctness** for this objective and never mark kills, because asserting kills would demand a capability the game has not shipped and would quietly become a retune request on mark HP.

**UPDATE — 4p now clears, and nothing was tuned to make it.** The line above used to read "these two go green when pierce exists, not before; if they go green earlier, something has been tuned that should not have been". That test has now fired, and the honest answer is that the condition was written before Ferocity had a job.

`bounty (4p)` went green when §9.5 gave Ferocity its job as a multiplier on all composed damage. No mark HP was touched, no escort was weakened, and the selector is unchanged at 100%. A four-player party simply now has enough throughput to grind through an escort pack the long way. Pierce would still be the *efficient* answer, and remains a §9.2 modifier item.

**`bounty (1p)` stays EXPECTED-RED and the original reasoning holds for it**: one player cannot out-throughput a wall built for a party, and the wall is the point.

#### The 1p number moved from 1 of 5 to 0 of 5, and that is the fixture, not a regression

**Recorded so a set diff never reads it as one.** `bounty (1p)` is the same expected-red check it has always been; what changed is who is standing in it. The solo objective fixture used to be positional — whichever class headed `SELECTABLE` — and it is now a **named** class chosen for being the hardest to finish a level with (`toh_samurai`; see D-27 and §13 rule 30). The Samurai is the only built class with neither a projectile nor a ground hazard, so against five escorted marks it reaches **0 of 5** where the Necromancer reached 1.

That is the guard working exactly as §5.9 describes it, not failing. **Escorts are a wall, the wall is built for a party carrying pierce, and a melee class solo has neither.** Pinning the fixture made the test measure the worst case on purpose; a worse number from a harder fixture is the intended consequence of that choice, and reverting it to recover the 1 would be tuning the harness to flatter the result.

**The guard below still reads correctly and is unchanged.** The question to ask if this row ever goes green is still "is the party carrying pierce yet" — the class in the string does not change that. What a future diff must not conclude is that throughput regressed between the two numbers: nothing about marks, escorts, or damage moved in the patch that changed them.

**WARNING — the guard's condition has moved, and the next patch could trip it.** The old line said "if the solo row goes green before pierce exists, that IS the tuning failure". Pierce now exists: `extraPierce` is live on the skill path (D-25) and reads a real projectile. It is not *sold* — no item pool is authored — so nothing has been tuned and the row is still red. But it is much closer: across the crit ruling and the rider fixes the solo mark went from **20.5% HP remaining to 0.4%**, on 159 stream kills against 108. If it clears in a later patch, the question to ask is not "did we tune the mark" but "is the party carrying pierce yet" — and if the answer is no, the wall has been eroded by throughput after all.

### Group C — weapon leftovers, waiting on the structure-recall ruling (7)

**REFILED.** This group was labelled "phase 4, the economy" and phase 4 has shipped — stat items, four modifier tiers, upgrades, respec, weighting, all gated. None of these seven has anything to do with that economy. They are **weapon** checks: combine, sell, extraction-shop buy, weapon caps. They are skipped rather than deleted — named, counted, and reported separately so a skip never reads as a pass — and restored by flipping `CONFIG.WEAPONS_ENABLED`.

**What they are actually waiting on is Group B's summoner-structure question**: whether structure recall survives the removal of weapons at all. `bonelord` builds its structure through `_addWeapon` and `weaponSlots` is 0 for the whole roster, so the answer to that one decides whether these seven get restored or deleted together. **Nothing in phase 5 will close them**, and scoping phase 5 as if it might is the mistake this refiling exists to prevent.

`below-max duplicate` · `combine result wrong` · `manual combine broke` · `extraction shop buy failed` · `sell weapon: mats 0→0` · `toh_necromancer weapon cap 0` · `toh_samurai weapon cap 0`.

#### RULED: the 34 orphaned classic-roster trait keys are DELETED, with this group

`game.js` branches on 34 trait keys that **no living character carries** — `slipstream`, `afterimage`, `glass`, `soulbond`, `immovable`, `prism`, `overwatch` and 27 more, from the archived classic roster. **90 references across three files**, 87 of them in `game.js`.

They are the same category as the seven checks above, and the same category as D-28 and D-29: **code whose caller stopped existing.** The difference is only that these branches are unreachable rather than merely unfed — no character has the key, so no guard ever passes — which is why nothing has broken and why nothing will notice them until an audit finds them again. It already has: they turned up in the D-28 follow-up walk, and without a ruling they will turn up in the next one.

**They are deleted with Group C.** Not before it, because the same structure-recall ruling that decides whether `bonelord`'s structure returns also decides whether any of this era's machinery does; and not after it, because leaving 34 inert branches behind a resolved group is how a cleanup becomes two cleanups. When Group C is executed, the 34 keys go with it.

**Recorded here so it is a decision rather than a rediscovery.** §16's line that "the archived classic roster is design reference, not data" states the intent; this states the disposal.

**The weapon-cap pair used to name whichever two classes headed `SELECTABLE`, and it has now been pinned.** It read `toh_samurai`/`toh_necromancer` before the Druid gained a tree, then `toh_druid`/`toh_necromancer`, and when the Wizard's trees landed both positional references collapsed onto the Necromancer and the check reported the **same class twice**. `T1_REFERENCE` and `T2_REFERENCE` are now named constants (`toh_necromancer`, `toh_samurai`) covering 36 checks between them, so the strings stop moving. A set diff across this patch therefore shows `toh_druid weapon cap` leaving and `toh_samurai weapon cap` arriving: **the same two skipped checks, renamed once, deliberately, for the last time.**

### Group D — genuine open defects (0)

#### D-29 — CLOSED: two more traits reading a data structure the weapon removal emptied

**Found by the audit D-28 called for**, which is the point of doing the audit rather than declaring the class of defect closed after one example.

`sim.summons` is annotated in `game.js` as *"weapon-era structures; phase 4, untouched"* and is pushed to from exactly one weapon path. Skill-era units live on `p.minions`. **Two traits read the empty array:**

| trait | class | what stopped |
|---|---|---|
| `bonelord` | Necromancer | bone dust — a dying enemy repairs the most-hurt summon — repaired nothing |
| `pack_tactics` | Hunter | Alpha and Marksman modes counted an empty pack, so `packMode` never left 0 |

**This is D-28's shape through a DATA STRUCTURE rather than a function.** The hooks had live callers, the callers ran, the code executed — and read an array that a migration had quietly stopped filling. A grep finds `sim.summons` used in five places and all five look healthy.

Both now read `ownedUnits(sim, p)`, which returns the player's live minions **and** any weapon-era structures they own. The old array is not deleted: if structure recall survives Group B's ruling, these traits should count it.

**Neither reconnection moved a number.** sim_test set diff 12 → 12, zero fixed, zero new — the Necromancer's bone dust repairs summons it only fields through the token loop, and the Hunter has no tree to field beasts with at all. That is the honest reading: **both were dead, both are now live, and neither has content standing on it yet** — which is precisely why they could stay dead. The next patch to build either class inherits a working trait instead of a silent one.

#### D-28 — CLOSED: two trait hooks orphaned by the weapon removal, taking four traits with them

**Found by gating a write path before authoring its trees**, which is the sequence §5.7 condition 3 exists to force. The `doll` rider designated its target correctly and the engine read zero, and the reason was not the rider.

`tohHitDamage` and `tohOnHit` were called from `_fireWeapon` and nothing else — and `_fireWeapon` has not run since weapons were removed. **Exactly the orphaning that hit `tohOnFire`, on the two sibling hooks, and nobody went back for them.** What went dead with them:

| trait | class | what stopped |
|---|---|---|
| `voodoo_link` | Witch Doctor | **the mirror never fired** — the entire class engine |
| `three_stances` | **Samurai** | Precision's crit and bleed, Flow's stacks, Iron's bank payout — three of three stances, on a class shipped as BUILT |
| `blood_dance` | Savage | Heat and leech |
| `karma` | Monk | the spirit echo, and the karma release |

plus the singularity **vulnerability**, which is a property of the enemy rather than of a trait and so applies to every source including allies — the Mage's burst debuff was doing nothing to anyone's skills.

Reconnected in `skillDamage` in the weapon path's exact order: `tohHitDamage` adjusts the number before mitigation, `tohOnHit` observes after the hit resolved and **before** any dead-enemy bail, because a killing blow is still a hit. The mirror's own follow-up goes through `damageEnemy` rather than `skillDamage`, so the bounce cannot re-enter.

**It cost the Mage a retune, which is the honest sign the fix did something.** With the vulnerability live, the Mage went from +27% to **+42% — out of band** at a full crystal pool; its crystal ramp was trimmed ~40% to pay for a trait that had been silently switched off. No other built class moved: the Samurai's stances need a stance swap and an enemy that dies, neither of which the DPS fixture does.

**The general form is §13 rule 38.** When a subsystem is retired, its hooks do not announce that they have stopped being called.

#### D-27 — CLOSED: a melee class could not damage a barricade, and the gate said the level was fine

**Found by registering a class.** `nest (1p)` went red the moment the Wizard's trees moved which class `SELECTABLE[0]` returns. The red was not about the Wizard.

`game.js` has stated the rule since patch 9 — *"every splash, nova and blast chews barricades as well as bodies"* — and enforced it on the weapon paths only: melee arcs called `_sweepWalls`, blasts routed through `_areaDamageEnemies`, and a straight shot damaged the wall that absorbed it. **Composed primitives inherited none of it**, and weapons are gone. So `strike`, `cone` and `line` swept straight through a Nest Purge barricade.

| Primitive | Reached a wall before? | How |
|---|---|---|
| `bolt` | yes | the friendly-projectile tick already damaged the wall that stopped it |
| `hazard` | yes | the zone tick calls `_areaDamageEnemies`, which chews walls |
| `strike`, `cone`, `line` | **no** | nothing |
| `drain` | no, **and deliberately** | single-target on a living thing, paying the caster back out of what it took; there is nothing to drain from a barricade |

Measured across the five built classes, solo, on the same seed and the same 6-minute budget the gate used:

| | before | after the fix | 20-minute clear time |
|---|---|---|---|
| Druid | cleared 334 s | cleared 176 s | — |
| Necromancer | cleared 303 s | cleared 303 s | — |
| Wizard | **3/3 nests alive**, 21 walls left | cleared 284 s | — |
| Priest | **3/3 alive**, 23 walls left | 1/3 alive, 5 walls left | cleared **396 s** |
| Samurai | **3/3 alive, 24 → 22 walls in six minutes** | 1/3 alive, 11 walls left | cleared **513 s** |

Two fixes, and the second is a ruling rather than a repair:

1. **`strike`, `cone` and `line` chew barricades**, via the same `_sweepWalls`/`_areaDamageWalls` the weapon paths used. `line` damages the wall at its clipped end, which is the wall it stopped on.
2. **A barricade within reach is struck regardless of which way the swing aimed.** Restoring the arc test verbatim would have restored the mechanism and left the capability removed, because a composed skill's facing comes from its own selector and points at an *enemy* — see §13 rule 31. With facing respected the Samurai went 24 → 22 barricades; with the ruling, 24 → 11 and the level clears.

**Why it survived for a whole era.** The gate that should have caught it asserted "every objective level is completable, solo and 4p" using a *positional* fixture class, and the two classes that headed `SELECTABLE` both had `bolt` or `hazard`. That is §13 rule 28 a third time. Both halves are now closed: the solo objective fixture is a **named** class chosen for being the hardest (`toh_samurai` — the only built class with neither a projectile nor a ground hazard), the nest budget is 12 minutes against a measured 513 s worst case, and a separate check proves **every built class breaks a barricade** in a staged fight at the wall — wizard 70 s · necromancer 35 s · druid 12 s · samurai 19 s · priest 23 s, against a 150 s ceiling.

#### D-26 — CLOSED: thirty declared riders, eight of which had never landed

`tools/rider_gate.mjs` exists because rule 25's defect was found by luck — an item gate measuring `knockbackBoost` noticed there was no live knockback to scale. The gate is the process instead: every rider on every skill, staged and asserted by effect, with coverage as part of the assertion so a rider it cannot measure fails by name rather than being skipped.

**Three separate places dropped a declared rider, all the same shape.** A value plumbed to a consumer that ignored it, validated by a table that only checked the declaration:

| Where | Riders lost | Skills |
|---|---|---|
| `PRIMITIVES.cone` never called `applyImpactRiders` | knockback, weakenDamage | Bone Nova, Banshee's Wail, Dread Howl |
| `PRIMITIVES.line` never called `applyImpactRiders` | knockback, stun | Wrecking Ball, Stampede |
| the zone tick read `z.dps` and ignored `z.slowMult` | slow | Blight, Gravechill, Bramble |

`PRIMITIVES.hazard` had always passed `slowMult`/`slowDur` into `addZone`; nothing on the other end read them. Eight skills across three classes, every one of them authored correctly and doing less than it said.

**All thirty riders now land** — asserted per skill, per rider, in the situation that skill's trigger requires.



#### D-25 — CLOSED: 44 of 44 item hooks live

`tools/item_gate.mjs` was written before the phase-4 item pool, on the principle that an item granting a modifier nothing reads is Ferocity with a price tag. Its first run says **28 of 44 hook kinds in the catalog are connected to anything**, and the other 16 are sold across 22 items:

`burnOnHit` · `chillOnHit` · `chainOnHit` · `critHeal` · `critAfterKill` · `critEveryN` · `critVsChilled` · `critVsBurning` · `critVsFullHp` · `firstHitCrit` · `eliteBossDamage` · `extraPierce` · `extraProjectiles` · `knockbackBoost` · `nextAttackAfterDodge` · `summonBoost`

**One cause, not sixteen.** Every one of them is read in exactly one place, and that place is `_fireWeapon`, `_hitEnemy` or `_summonStats` — the weapon era. Skills reach damage through `compose → skillDamage → damageEnemy` and never touch any of them. This is D-23's defect with a price attached: the damage path moved from weapons to skills, and the hooks that hung off the old path stayed where they were. Crit is the sharpest case, because crit is only *decided* in `_fireWeapon`: six item hooks grant it and no skill in the game can crit.

**The fix is the phase-4 modifier plumbing, not a repair.** §9.2's four tiers need exactly these mechanisms on the skill path — `extraPierce` is the pierce §5.9 names as the answer to escorted targets, `extraProjectiles` is the magnitude tier's projectile count, and `burnOnHit`/`chillOnHit`/`chainOnHit` are the rider tier's "adds an effect the skill did not have". Reconnecting them is building the tier, and the gate is what says when it is done.

**NINE ARE RECONNECTED. `item_gate` reports 37 of 44 live**, up from 28. Every read site is recorded in §9.2's table above; the shape is that `skillDamage()` is the modifier path for the same reason it is Ferocity's.

**The last seven were one question, not seven**, and it is now answered. `critAfterKill`, `critEveryN`, `critVsChilled`, `critVsBurning`, `critVsFullHp` and `firstHitCrit` grant crit; `critHeal` consumes it; crit did not exist. §9.2 records the ruling — a roll inside `skillDamage()`, chance from Reflex plus items, multiplier from `CONFIG.CRIT_MULT_BASE` plus items — and with it wired **`item_gate` reports 44 of 44**. Two aggregate fields, `critChance` and `critMult`, exist ahead of any item that grants them and carry probes anyway: rule 24 says a declared capability is worth less than nothing until something measures it, and phase 4 is about to price items against those sites.

*Worth stating because the arithmetic misleads:* sixteen minus six crit-granting hooks is ten, but `critHeal` fires only on a crit, so the reconnectable set was nine and the residual was seven. A hook can be blocked by a mechanic without being named after it.

**Five of the twenty-one verdicts the gate has issued were the gate's own fault**, and every one was §13 rule 20 — the fixture must arrive in the state a player would arrive in.

- `killExplode` and `onHurtRetaliate` are read in live code and came back DEAD because `_areaDamageEnemies` queries the spatial grid, the grid is rebuilt every tick, and a probe that spawned a target and fired a blast in the same instant blasted an empty index. One frame of settling fixed both.
- `extraPierce` and `extraProjectiles` were staged on a Samurai. **Only the Necromancer has `bolt` skills**, so the probes measured projectile items in a class with no projectile.
- `extraProjectiles` then still read DEAD against a single pinned dummy: a fan across a target list has nowhere to fan when there is one target. The claim is "hits more things" and the observable had to contain more things.
- `knockbackBoost` took three passes. Slotting a knockback skill was necessary and not sufficient — `necro_bone_nova` is `PROXIMITY radius 140 count 4` and does not fire until **four** enemies are inside 140 units, so the probe had to stage the trigger's condition and not merely the loadout. The 58 units of drift it had been reading was collision separation from the player's own body.

The third pass is what found rule 25: with the trigger finally satisfied, the knockback still did not scale, because `cone` and `line` declared impact riders in `RIDER_TABLE` and applied none.


#### D-24 — CLOSED: §2.4 wins, and an Elite node is now fewer and fatter

**The ruling: §2.4 is the definition of an Elite node.** An Elite node that fields more enemies at the same health is a Horde node with a bigger number, and the two would ask the same build question — which wastes 2 of every 10 nodes and the route decision they exist to create.

Three things were wrong and all three are fixed. `this.nodeType` was read twice and assigned nowhere, so every fight computed `'horde'`. `regionFightMods()` — the only consumer of `nodeModifiers()` — appeared exactly once in the codebase, its own definition, and had no callers. And `waveConfig()` raised an Elite node's spawn *rates*, pulling against the modifiers rather than agreeing with them; that bump is deleted, along with the elite injections, which are now siege-only. **§2.4 is the single definition; nothing multiplies against it.**

Measured against a Horde room from the same seed, over 60 s:

| axis | §2.4 asks | measured |
|---|---:|---:|
| count | ×0.55 | **×0.53** |
| HP | ×2.4 | **×2.60** |
| damage | ×1.35 | **×1.38** |
| gold | ×1.35 | **×1.23** |

**Asserted by effect, not by wiring.** `sim_test` counts what actually spawned; a version that resolved the modifiers, stored them on the sim and never applied them would pass any check reading `sim.fightMods` and fails this one. The direction of each axis is absolute — a count ratio above 1 fails outright, with the message naming why: an Elite node that is Horde with a bigger number asks the same build question.

*Wired along with it:* `difficultyOf()` was the other half of the orphan and had never been applied either. At the default setting every multiplier is 1.0, so nothing changed on the day — and "a non-default setting will do something" was a prediction, not a measurement. It has since been measured: `tools/difficulty_gate.mjs` fights the same room on all four settings and finds every axis moving in the declared direction, after two further defects that only a measurement could have found (a gold multiplier rounding to identity against an integer of 1, and gold dragging XP with it). See §4.1.

#### D-23 — CLOSED: three stats sold and doing nothing

Ferocity, Ingenuity and Attunement now have the jobs §9.5 gives them — a multiplier on all composed damage, minion damage and HP, and status potency — and `tools/stat_gate.mjs` reports **10 live of 10**. Every stat the game sells moves something a player can observe.

The fix was not a redesign. Each of the three was alive in the weapon era and left behind when the damage path moved to skills, so each was reconnected to the modern equivalent of the site it used to read. The one that took a second attempt was the *gate*, not the game: Ingenuity's probe never ticked, so `summonSlots` was still 0, every spawn was refused, and the probe measured the player's own damage — which Ingenuity correctly does not scale. A working stat read as dead. The probe now benches the player's loadout so every point of damage is the minion's, and returns a broken verdict rather than a dead one when no minion reaches the field.

#### What each stat is actually read by

`live` = moved its probe. Dead paths are listed because they are what a search finds, and what would otherwise be mistaken for the stat working.

| stat | verdict | live readers | dead readers (what a grep finds) |
|---|---|---|---|
| **vitality** | live | max HP everywhere; room-start restore; `hpAbove`/`hpBelow` conditions; objective % -max true damage | — |
| **ferocity** | **DEAD** | none reachable | `weapons.js` weaponStats; `_fireWeapon`; `_tickNova` (`nova_core`, archived); `_summonStats` (`overseer`, archived); Samurai stance-1 bleed (stance never held) |
| **tempo** | live (movement only) | move speed (`game.js:1509`); Wizard decree tick | **skill cooldowns do not read it** — `skillCd = cooldown/1000`, no Tempo term. Every attack-speed site is weapon-era |
| **grit** | live | mitigation; knockback resist; **bridges to skills** as `p.engines.armor` for `scaleWith: 'armor'`; Quill reflect | — |
| **reflex** | live | dodge roll in `hurtPlayer` | — |
| **recovery** | live | `_heal()` — every healing source | Priest shield scaling (no tree yet) |
| **ingenuity** | **DEAD** | none | `_summonStats` only — weapon-era structures. **Skill-era minions do not read it**, so the class that just gained summons still ignores the summon stat |
| **attunement** | **DEAD** | none | `_attuned()` × 20 callers, all in `game.js`/`traits-toh.js`, none in the skill path; `_applySlow` applies it, `applySlow` (the skill one) does not |
| **greed** | live | tithe on fight clear (`_clearRewards`); rarity bias in `_rollRarity` | Assassin contract payout (no tree yet) |
| **reach** | live | pickup magnetism (`game.js:2832`); ToH trait radii | weapon range; `standard_high` (archived) |

Two of the live ones are only *partly* live and should be settled in §9.5 as well: **Tempo** claims "attack + move speed" and reaches only movement, and **Greed**'s two channels both work while its declared "+1% Ferocity per bonus Grit" interaction feeds a dead stat.

### The browser suite is counted separately, and it is not clean

`tools/browser_test.mjs` reports **13 failures, none of them in the count above**, because this section has only ever tallied `sim_test`. They share one cause: the browser fixtures still click `.char-card[data-char="bulwark"]` and `"facet"` — **retired classic ids** left behind by §3.3. Every one is a `querySelector(...).click()` on null, which then fails that whole page's test. Fixture cleanup, not a game defect. Measured across the summoning patch the set went **15 → 13** with no additions.

### Fixed, kept for the record

| # | was | now |
|---|---|---|
| 8 | Client→host input had no delivery guarantee | Ack with resend-until-acked; **the wild `client ready` failure is NOT explained by it** — still open above |
| 9 | Room registration failing ~1 run in 3–4 | **A negative result, not a fix** — see below |
| 10 | Suite gated co-op behind tests for removed weapons | Skipped, named, counted; co-op reaches its phase every run |
| 11 | Only 2 of 47 characters could deal damage | Classic roster retired per §3.3; selection gated on having a tree |
| 13 | Skills converged on "whatever is nearest" | `select` is a required field on every active (§5.3) |
| 14 | `tohOnFire` orphaned on a dead `_tickWeapons` | Called from `fireSkill` |
| 15 | `hitbox` honoured by trait *name* (`immovable`, retired) | Read by presence |
| 16 | Art style anchor hardcoded a retired character | `STYLE_ANCHOR_ID`, named and live |

### External dependencies

**Regions 3–8 are blocked on art, not code.** Every system a region needs is generic across all eight already: `REGION_BY_INDEX`, `nodeModifiers()`, node-tree generation, floor composition, difficulty scaling and the objective set all run off `js/regions.js` with no per-region branches. A region costs one entry in `js/content/regions-enemies.js` — six enemies and a two-phase boss — and no engine code at all.

What it also costs is **36 enemy sprites, 6 boss sprites and 6 tilesets**, and those need `PIXELLAB_API_KEY`. The key has been **absent from the working environment for every recent session**, so no art can be generated here at all. `assets/assets.json` carries 298 entries against 3 sprite files and 1 tile directory on disk.

Recorded here so it is not rediscovered as a code problem three regions into the phase. **The correct scoping question for regions 3–8 is not "how long does the content take" but "when does the key come back"** — and until it does, region work is authoring enemy stat blocks and telegraph timings against placeholder art.

Note also that `js/regions.js` declares **2 regions, not 8**. §3.2 names all eight; the table has the two that are built. `telegraph_test` now iterates that table rather than the populations that happen to exist, so region 3 fails by name the moment it is declared without a population — which is the guard that stops one shipping unchecked.

### Recorded negatives

**#9 — room registration.** Failed roughly 1 co-op run in 3–4. Now 8/8 full runs and 20/20 direct trials at 3–8 ms with zero `regFailures`. **It stopped reproducing and nobody knows why.** A healthy measurement of the component a defect *names* is evidence the name was wrong, not that anything was repaired. Closing conditions are recorded; the entry stays open.

---

## 16. Implementation Status

| System | Status |
|---|---|
| Trigger system, 11 kinds | Built, gated, measured — `ON_TOKEN` added with summoning |
| Selectors, 6 rules | Built, required field, no default |
| Composed-action schema | Built, 11 primitives, **zero bespoke handlers across 60 skills** — scanned, with a negative control |
| `scaleWith` engine hook | Built, generalised across three engines — footing, armor, pack |
| Damage triangle | Built, all damage routed |
| Telegraphs | Built, 9 telegraphing types, density floor enforced over the REGION TABLE so an undeclared population fails by name |
| Footing | Built, three-way measured, decision live |
| Skill points, ranks, loadout | Built, rank-1 passive rule enforced |
| Node trees, node types | Built, runtime behaviour for Shrine/Cursed/Elite |
| World map | Rules built, **no DOM** |
| Difficulty | **Built and measured** — `difficulty_gate.mjs`: 4 axes move in a real fight, XP per kill flat within 10% |
| Saves, frontier rule | Built, file round-trip verified |
| Netcode state migration | Built, lobby heartbeat at 3 Hz, drops classified |
| Determinism | Built, negative control, byte-identical same-seed runs |
| Offence gate | Built — `offence_test.mjs` never kills on the player's behalf |
| Stat gate | Built — `stat_gate.mjs` proves each CHANNEL by effect; **11 of 11 across 10 stats**, Reflex measured on both defence and crit |
| Item gate | Built **before** the phase-4 pool — `item_gate.mjs`, three layers: coverage, effect, grant. **48 of 48 hook kinds live across 173 items** (D-25 closed) |
| Rider gate | Built — `rider_gate.mjs`: every declared rider on every skill, asserted by effect. **91 of 91 land across 10 classes** (D-26 closed). Riders content has not taken up yet are probed on a synthetic host, and one whose write path belongs to a TRAIT puts that trait in the chair |
| Trait gate | Built **after** D-28, which is the wrong order and is why it exists — `trait_gate.mjs`: every trait on the roster reached by the live path and moving its own observable, against a control with the trait key switched off. **14 of 14** |
| Engine gate | Built **before** phase 5 — `engine_gate.mjs`: every key in `p.engines` filled by play, read by a skill, and claimed by content. **10 of 10** — `footing`, `armor`, `pack`, `shift`, `marks`, `rhythm`, `crystal`, `doll`, `drench`, `killbox`. Also asserts Grit's anti-synergy with crystallize by effect (§8.3) |
| Difficulty gate | Built — `difficulty_gate.mjs` fights one room per setting; four axes move, XP per kill flat |
| Penalty roll | Measured — `penalty_roll.mjs`: 28% mean free-roll rate; weighting NOT added, re-measure at phase 5 (§9.5) |
| Build-shape sweep | Measured — `shape_by_node.mjs`: region-weighted deep/wide 1.16; objective nodes favour breadth 0/6 (§4.2) |
| Node types | Horde, Elite and Objective all live and measured; difficulty wired (D-24) |
| Roster | **One roster.** Classic 33 archived; selectability derived from trees |
| Regions 1–2 | Playable — 12 enemies, 2 two-phase bosses |
| Region tilesets, hazards | **Named, unimplemented** — `undergrowth`, `bloodmire` |
| Regions 3–8 | **Names only** — blocked on `PIXELLAB_API_KEY`, an EXTERNAL dependency, not on code |
| Classes 3–14 | **In progress** — Wizard, Priest, Bard, Mage, Witch Doctor, Sundian and Assassin built (20 trees, 200 skills, 10 selectable); 4 of 14 classes have no trees. All four content-shaped classes are done, plus three write-path ones; the remaining four are write-path (Hunter) or tick-shaped (Monk, Savage, Blacksmith) |
| Summoning | **Built, conformant, balanced** — 8 divergence rows closed, balance pass run at two anchors, no cap needed |
| `ON_TOKEN` trigger | **Built and conformant** — every kill drops, 30 s, per-player render, Raise Skeleton throws at it |
| Stats | **All ten live** — §9.5 records intent; Ferocity, Ingenuity and Attunement given their jobs |
| Modifier tiers | **Magnitude and rider wired** — 16 hooks reconnected to the skill path, read sites recorded in §9.2 |
| Crit | **Built and ruled** — a roll in `skillDamage()`; chance from Reflex + items, multiplier from `CONFIG.CRIT_MULT_BASE` + items, on a dedicated seeded stream |
| Economy | **Built** — 27 new items across four tiers, rolled penalties, upgrades, respec, late weighting. `econ_gate` green |
| Econ gate | Built — `econ_gate.mjs`: cooldown ban, zero-stat rule, stream isolation, respec ladder, reroll escalation and weighting, all by effect |

---

## 17. Notes for Future Work

**`bloodmire` and Footing.** The Region 2 curse damages players for standing still, aimed at Footing. It was authored while instant-drop was still live, so it punished a stance over-rewarded for unrelated reasons. Re-check that it is a real counter and not a Samurai-specific tax.

**Pending-pick and results screens are partial fixes.** Presence rides state so a lost close cannot softlock a panel open, but an offer's contents still ride the open event — a lost open is a missed level-up pick. Similarly `st.over` stops a client stranding in a dead world but the results payload still rides `end`. Both are noted in code where the next reader hits them.

**Summons are the largest untested area of the composed-action schema.** They were the largest bespoke category in the source project, and the "420 skills are data" claim is unverified against them. §8.5 now specifies both classes' mechanics; the patch that builds them should treat the schema question as its primary finding, not a side effect — if summons need bespoke handlers, that is worth knowing before the remaining ten classes are authored.

**Four class engines exist only as design.** Footing, Marrow's `armor`, the Druid's `pack`, the Wizard's `shift`, the Priest's `marks`, the Bard's `rhythm`, the Mage's `crystal`, the Witch Doctor's `doll`, the Sundian's `drench` and the Assassin's `killbox` are implemented and gated at **10 of 10**. The remaining four — cascade, Chi, Crystal Forms, two bodies — are specified in §8.3 and unbuilt.

**The archived classic roster is design reference, not data.** Its traits are engine hooks keyed to values that no longer exist.
