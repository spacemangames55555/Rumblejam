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
| Elite | ×0.55 count, ×2.4 HP, 75% drawn from the region's heavy half |
| Objective | One of the 8 existing objective types |
| Shrine | No combat. Party chooses: +1 skill point **or** one guaranteed shop reroll. Never both, never rolled |
| Cursed | Region modifier active for that node only, ×1.6 gold |

Placement: Shrine and Cursed may not sit in column 1; both Elites may not share a column. Node type is **visible before selection** — the route decision does not exist otherwise.

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

### 4.2 The player power curve

- **1–2 levels per map.** Across 48 maps this produces a character in the **low 70s** at the end of a run.
- **No rank cap.** A skill accepts unlimited points.
- **Per-rank increment: +4% of base damage, +3% of base duration, linear against base.** Never compounding — `damage *= 1.04` per rank is explosive at rank 40.
- **Ranks raise damage and duration only.** Not radius, not cooldown, not projectile count, not trigger thresholds.

#### Why no cap self-balances

Skills fire on cooldowns. A character running few skills has long gaps and spiky damage. A character running many has syncopated fire rates and smooth damage, but each skill is under-invested and hits softly. Neither extreme wins; the optimum sits in the middle and moves with enemy HP and density.

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

Any active is data: an ordered list of steps from ten primitives plus riders.

**Primitives:** `strike` · `bolt` · `cone` · `line` · `hazard` · `heal` · `shield` · `ward` · `drain` · `plague`

**Impact riders** (land wherever damage lands): `stun` · `taunt` · `root` · `knockback` · `slow` · `weakenDamage` · `weakenDefense` · `healPerHit`
**Shape riders** (shape a swing): `arc` · `windUp` · `multiPulse`
**Projectile riders:** `pierce` · `splash` · `impactDot` · `defenseDown`

This decomposition replaced an earlier per-primitive rider split that could not express a bolt carrying `weakenDamage`.

**Hard rule: every number lives in its tree's `TUNING` block. No constant is ever inline in behaviour code.**

**Result:** 40 skills across 4 trees, zero bespoke handlers. Summons remain untested and were the largest bespoke category in the source project — expect the rate to rise there, but not enough to threaten the schema.

### 5.8 Engine scaling — `scaleWith`

A step may declare `scaleWith: '<engine>'` and `scalePer`, reading `p.engines[name]`. **The hook knows no engine by name.** Footing and Marrow's `armor` engine both ride it with zero engine-specific code.

This is what makes the remaining twelve class engines data rather than engineering. Cascade, drench, crystallize, Chi, judgment marks, killbox, and two bodies all use the same hook.

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
| Sundian | **Drench stacks** — a stacking debuff spent by `ON_STATUS` triggers |
| Mage | **Crystallize** |
| Witch Doctor | **Voodoo doll** — damage to a doll mirrors onto a distant target |
| Druid | **The pack** — one summon per animal skill, revive timer scales with pack size (§8.5). Morph layers on top: animal DNA visibly mutates the character |
| Blacksmith | **Crystal Forms** — timed transformations on `SELF_THRESHOLD` |
| Necromancer | **Soul tokens** — kills drop tokens, `ON_TOKEN` raises skeletons into rank-granted slots, all wiped at room end (§8.5) |
| Bard | **Stances** — a stance multiplier gates other skills' output |
| Wizard | **Domain shift** — the only class that changes its own damage domain mid-fight |
| Priest | **Judgment marks** — marks detonate on the target's death, healing nearby allies |
| Samurai | **Footing** — see §8.4 |
| Monk | **Chi loop** — damage generates Chi; heals and traps spend it |
| Assassin | **Killbox** — traps placed inert, detonating when other skills fire nearby |
| Hunter | **Two bodies** — skills may trigger off the pet's position |

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

**Generalise it as: give the new thing an actor, not a vocabulary.** The Monk's traps, the Assassin's killbox, the Hunter's second body and the Priest's judgment marks are all the same shape — an entity that acts somewhere the player is not. Each should borrow the primitives and the owner's identity rather than grow its own verbs. Recorded as §13 rule 21.

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

#### Balance pass, and the two questions it could not answer

Measured by `tools/balance_summoners.mjs` at level 12 — three slots, just past region 2's expected 10 — against the four already-tuned trees, at both build shapes, because §8.5 frames these engines as a depth-versus-breadth decision that one shape cannot see.

| tree | shape | dps | avg minions |
|---|---|---:|---:|
| reference band (4 tuned trees) | — | 3.0 – 29.0 | — |
| `necro_summons` | wide | 10.3 | 0.48 |
| `necro_summons` | deep (rank 11) | 19.5 | 8.66 |
| `druid_beasts` | wide | 18.0 | 3.00 |
| `druid_beasts` | deep (rank 11) | 9.1 | 0.84 |

Both trees sit inside the band at both shapes. One tuning round moved them there: animal and skeleton HP up, and Bone Shard up, because a Necromancer's own damage is what it has during the cold start this section gives it.

**Two findings are structural, not magnitudes, and are NOT tuned around.**

**A rank buys a minion's damage and not its life.** A rank-11 wolf has the same HP as a rank-1 wolf, so depth buys a pet that hits harder, dies just as fast, and then costs 15 seconds. It averaged 0.53 of an animal standing before the HP raise and 0.84 after — the dial moved the number and not the shape, which per §8.4's lesson means the dial is not what is wrong. §4.2 says ranks raise damage and duration only; whether a summon's HP counts as its duration is a **§9.5-shaped question this document has not answered**, and no amount of HP tuning will make depth a real choice for the Druid until it is.

**Skeletons are uncapped by design and depth therefore dominates for the Necromancer** (deep/wide = 1.90, against 0.63 for the tuned Samurai trees, where wide normally wins). This section says "deliberately uncapped for first playtest; a cap may follow". This is that playtest reporting back: the cap is now the open question, and the number to set it against is 11 skeletons at rank 11.

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
| Domain swap | Changes one skill's damage domain | Rare–Legendary |
| Selector add | The skill **also** hits what a second selector picks | Rare–Legendary |

**Radius lives in magnitude items exclusively**, since ranks no longer grant it.

**No cooldown reduction on any item.** Same reasoning as ranks: an item that shortens cooldowns lets a narrow build buy back its uptime and the depth-versus-breadth pressure disappears.

**Pierce is the answer to escorted targets** (§5.9) and belongs in magnitude.

#### Items add, they never take away

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

### 9.3 Sinks and respec

Shop rerolls escalating within a visit; item upgrades; **skill respec at 1000 gold base, multiplying ×2.5 per use, never resetting**. Respec refunds all points at once — per-point respec would let players micro-optimise between every map.

### 9.4 Numbers

All placeholders for playtest. Income roughly flat within a region, scaling ~15% per band; item prices ~25% per band; reroll cost doubling within a visit. **Target: 1–2 purchases per shop visit throughout the run, never 6.**

### 9.5 Stats

**GAP — this document does not record the stat system.** The ten stats live in `js/config.js` and are authoritative there, but the GDD records no intent: what each stat is for, which are opposed for §9.2's +/− trade-offs, and which are engine-readable via `scaleWith`. This needs writing before phase 4, since the stat item tier is defined in terms of opposing axes that are nowhere named.

`SCALING_RATES` in config is dead with weapons and is scheduled for removal.

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
22. **An entity that acts is an ACTOR, not a behaviour.** Give it the existing primitives and the owner's identity by reference; do not give it verbs of its own. A minion's attack is a compose step through the same `PRIMITIVES` table a player's skill uses, and its `idx`/`stats`/`hookAgg` *are* the owner's fields, so attribution never has to be forwarded because it never diverged. This is why summoning — the largest bespoke category in the source project, where every summon carried its own spawn, attack and death code — cost **one primitive and one trigger** here, with zero per-archetype handlers across twenty new skills. The same shape is waiting for the Monk's traps, the Assassin's killbox, the Hunter's second body and the Priest's judgment marks. See §8.5.

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
| 4 | Economy: stat items, modifier tiers, sinks, respec, §9.5 stats | Not started |
| 5 | Remaining 12 classes, 38 trees, regions 3–8 | Not started |

Phase 5 is the bulk of remaining work by volume, but phases 1–3 established that it is authoring rather than engineering: zero bespoke handlers across 40 skills, `scaleWith` generalising with no engine known by name, and selectability derived from tree data so a new class needs no code. **The binding constraint on phase 5 is art** — 36+ enemies and 6 bosses.

---

## 15. Open Items

**Almost none of the current red is a defect — but Group D is no longer empty.** `tools/sim_test.mjs` reports **17 failing checks**: 7 are content not authored, 3 await a design decision, 7 are a deferred subsystem. Alongside them, `tools/stat_gate.mjs` reports **3 real defects** (D-23): three of the ten stats are sold to players and do nothing. The counts sum to 17 with nothing double-counted, and the focused instruments — `offence_test`, `determinism_test`, `snapstate_test`, `region_test`, `telegraph_test`, `skill_sweep`, `footing_grace_test`, `validate_items` — are all green.

**A failing check and an open question are not the same thing**, and this section previously counted them together. Group B below lists six items; only three of them are red lines. The other three are decisions with nothing currently failing, marked *no failing check*.

### Group A — waiting on phase-5 trees (7)

Eleven classes have no trees. Weapons are removed, so a class without a tree cannot attack, cannot trigger an attack hook, and cannot finish a level. **Nothing here is repairable by code.**

| what fails | count | why |
|---|---:|---|
| `Bard rhythm never built`, `no singularity in 30s`, `no coral planted`, `toh blob` | 4 | These traits key off `tohOnFire`, which is correctly wired to `fireSkill` — but `toh_bard`, `toh_mage` and `toh_sundian` have no tree, so they never fire a skill. The hook is right; there is nothing to hook onto. (`toh blob` is the Sundian's coral array specifically.) |
| `expected 2 beasts across 2 Hunters` | 1 | `toh_hunter` has no tree, so it is constructed through a path that never reaches fight-start granting. |
| `elite_arena (1p) never cleared` | 1 | **Back, and it is §8.5 working.** It left this group when the Summons tree landed and returned when that tree was made §8.5-conformant: skeletons now wipe every room and capacity is rank alone, so a solo Necromancer ramps from zero in every fight instead of arriving with a standing army. `offence_test` clears it at 4p. Solo is not the target party size for an objective node, and the cold start is the class's stated cost — not a defect, and not to be tuned away. |
| `DPS gate: 2 outlier(s)` | 1 | The DPS table measures all fourteen; eleven score 0 because they cannot attack. |

**Two entries left this group by being built.** `elite_arena (1p) never cleared` went green when the Necromancer's Summons tree landed — the class gained a third tree, the solo build got deeper, and the objective cleared with nothing tuned. `toh_druid` left with its own tree. That is the group working as labelled: it said "not built yet", something got built, and it closed.

### Group B — waiting on a design decision (3 failing, 3 open questions)

| Item | Question |
|---|---|
| **Throughput: Nest Purge** | **CLOSED — working as intended.** Measured at both party sizes with the party arriving at level 12: 4p clears 3/3 at 213 s of 360 s. Solo reaches 2/3 and is not the target. The deciding factor was **loadout slots, not HP** — see §13 rule 20. *No failing check.* |
| **Throughput: Bounty Hunt** *(2 failing)* | **EXPECTED-RED until phase 4 — see below.** Not throughput and not a tuning gap. |
| **Summoner harness gap** *(1 failing)* | Narrowed by §8.5, not closed. Skill-era summons exist and the Necromancer fields them, but they are *units* — they walk, they die, they are re-raised. Structure **recall** (`STRUCT_CHANNEL_S`) still has nothing to act on: `bonelord` builds its structure via `_addWeapon` and `weaponSlots` is 0. The decision is whether recall survives the removal of weapons at all. |
| **Penalty weighting on stat items** | §9.2 — fully random penalties can roll free on stats a build does not use. Weight lightly toward used stats, or accept free rolls as luck? *No failing check.* |
| **#8 — `ready` toggles even** | Every message delivered and applied, zero drops, and `ready` is still false — so `p.ready = !p.ready` fired an even number of times. Two mechanisms remain and they call for opposite fixes: one press became two messages, or one message was applied twice. **Deliberately unfixed** — two diagnoses have already been overturned by the next measurement, both times because the fix was chosen before the data. *No failing check.* |
| **§9.5 stats** | The stat system has no recorded intent, and phase 4's stat tier is defined in terms of opposing axes that are nowhere named. Separately measured: **Ferocity, Tempo and Attunement are read by no skill path** — Ferocity multiplies no composed damage at all, Tempo reaches move speed only, and `_attuned` has no caller in `compose.js` or `skillsim.js`. Ferocity is still offered on level-up at 4/7/12%. *No failing check — nothing asserts it yet.* |

#### Bounty Hunt is EXPECTED-RED until phase 4. Do not re-diagnose it.

`bounty (1p) never cleared` and `bounty (4p) never cleared` are **§5.9's design resolution appearing as a red line.** The specific thing to not do is reach for mark HP.

- Marks spawn with an escort pack **by design**. Escorts are a wall you clear first, and that is what distinguishes a mark from a nest: a nest is a structure you reach, a mark is a target you earn a line on.
- Punching straight through needs **pierce**, a §9.2 modifier item at the magnitude tier. It does not exist until phase 4.
- A 4-player armed party reaches **3 of 5 marks** in the full budget, which is the correct number for a party with no pierce.

Measured twice so nobody re-derives it: per-target attribution on the 1p mark showed the selector chose the mark on **23 of 23** fires with **2** arriving; across `offence_test` the selector chooses the mark on **93.4%** of objective-targeting fires. It is not a targeting failure — the shots are intercepted. `offence_test` therefore asserts **selection correctness** for this objective and never mark kills, because asserting kills would demand a capability the game has not shipped and would quietly become a retune request on mark HP.

**These two go green when pierce exists, not before.** If they go green earlier, something has been tuned that should not have been.

### Group C — phase 4, the economy (7)

Weapon leftovers and shop-economy checks. **Skipped, not deleted** — named, counted, and reported separately so a skip never reads as a pass, and restored by flipping `CONFIG.WEAPONS_ENABLED`.

`below-max duplicate` · `combine result wrong` · `manual combine broke` · `extraction shop buy failed` · `sell weapon: mats 0→0` · `toh_druid weapon cap 0` · `toh_necromancer weapon cap 0`.

The weapon-cap pair names whichever two classes head `SELECTABLE`, so it read `toh_samurai` before the Druid gained a tree. Same defect, different class in the string — worth knowing before a set diff reads one as fixed and the other as new.

### Group D — genuine open defects (1)

#### D-23 — three of the ten stats are sold to players and do nothing

**Ferocity, Ingenuity and Attunement are read by nothing in the live path.** They are offered at every level-up from `STAT_BOOSTS` — Ferocity at 4/7/12% — and a player who buys them gets no effect of any kind. This is a defect, not a note: the game is taking a level-up pick in exchange for nothing.

Measured by `tools/stat_gate.mjs`, which stages each stat in the situation it would matter in and compares a +120 swing against an unbumped run from the same seed:

| stat | probe | base | +120 |
|---|---|---:|---:|
| **ferocity** | damage a skill deals to a pinned target | 35 | **35** |
| **ingenuity** | damage a summoned minion deals | 45 | **45** |
| **attunement** | chill depth + plague rate applied through the skill path | 900 | **900** |

Ferocity is dead for **every selectable class**, Samurai included — its one live reader is the stance-1 precision bleed in `traits-toh.js`, which needs a stance the fight never holds long enough to reach.

**Why it survived this long.** A grep finds all three: `p.stats.ferocity` is read in `_fireWeapon`, `p.stats.ingenuity` in `_summonStats`, and `_attuned()` has twenty callers. Every one of those sites is on a dead path — `_tickWeapons` has not been called since weapons were removed, `_summonStats` serves weapon-era structures rather than skill-era minions, and `_attuned`'s callers are all in `game.js` and `traits-toh.js` with none in `compose.js` or `skillsim.js`. **Existence is not the question; effect is**, and no check asked the second question until now.

The clearest single instance: the chill path forked and nobody noticed. `_applySlow` (`game.js`) takes an owner and applies Attunement; `applySlow` (`skillsim.js`) — the one every composed skill calls — takes no owner and applies none. Two functions one character apart in name, one of which silently drops the stat.

**Not being fixed in the patch that found it.** §9.5 records no intent, so there is nothing to say what Ferocity *should* multiply. The read-site table below is the input for writing §9.5; the fix follows the section, not the other way round.

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
| Telegraphs | Built, 9 telegraphing types, ≥50% density both regions |
| Footing | Built, three-way measured, decision live |
| Skill points, ranks, loadout | Built, rank-1 passive rule enforced |
| Node trees, node types | Built, runtime behaviour for Shrine/Cursed/Elite |
| World map | Rules built, **no DOM** |
| Difficulty | Built, 4 settings, XP exclusion asserted |
| Saves, frontier rule | Built, file round-trip verified |
| Netcode state migration | Built, lobby heartbeat at 3 Hz, drops classified |
| Determinism | Built, negative control, byte-identical same-seed runs |
| Offence gate | Built — `offence_test.mjs` never kills on the player's behalf |
| Stat gate | Built — `stat_gate.mjs` proves each stat by EFFECT; **3 of 10 fail** (D-23) |
| Roster | **One roster.** Classic 33 archived; selectability derived from trees |
| Regions 1–2 | Playable — 12 enemies, 2 two-phase bosses |
| Region tilesets, hazards | **Named, unimplemented** — `undergrowth`, `bloodmire` |
| Regions 3–8 | **Names only** |
| Classes 3–14 | **Not started** — 11 of 14 classes have no trees |
| Summoning | **Built and conformant** — all 8 divergence rows closed; balance pass run. Two structural questions open in §8.5 |
| `ON_TOKEN` trigger | **Built and conformant** — every kill drops, 30 s, per-player render, Raise Skeleton throws at it |
| Economy | **Not started** |

---

## 17. Notes for Future Work

**`bloodmire` and Footing.** The Region 2 curse damages players for standing still, aimed at Footing. It was authored while instant-drop was still live, so it punished a stance over-rewarded for unrelated reasons. Re-check that it is a real counter and not a Samurai-specific tax.

**Pending-pick and results screens are partial fixes.** Presence rides state so a lost close cannot softlock a panel open, but an offer's contents still ride the open event — a lost open is a missed level-up pick. Similarly `st.over` stops a client stranding in a dead world but the results payload still rides `end`. Both are noted in code where the next reader hits them.

**Summons are the largest untested area of the composed-action schema.** They were the largest bespoke category in the source project, and the "420 skills are data" claim is unverified against them. §8.5 now specifies both classes' mechanics; the patch that builds them should treat the schema question as its primary finding, not a side effect — if summons need bespoke handlers, that is worth knowing before the remaining ten classes are authored.

**Twelve class engines exist only as design.** §8.3 specifies them; only Footing and Marrow's `armor` are implemented.

**The archived classic roster is design reference, not data.** Its traits are engine hooks keyed to values that no longer exist.
