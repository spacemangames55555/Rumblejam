# Rulings — 14–16 November 2026

Every design call made during the three-day push, in the order it was made, with the measurement behind it. **Any of these can be vetoed.** Where a ruling changed the GDD, the GDD carries the rule and this file carries the reason and the date.

## The delegation

Decided by the user, 14 Nov 2026:

| # | Decision |
|---|---|
| U-1 | **Claude rules on balance numbers and new content** (enemy stats, boss mechanics, cooldowns, damage) and logs each call here. Changes to the design pillars (§1.1) or the run structure (§2) still stop for the user. |
| U-2 | **One PR per patch, merged by Claude once every gate is green** against the baseline. The user reviews after the fact. |
| U-3 | **Order of work: regions 3–8, then whole-game balance, then skill animations.** If time runs short, that is the order things are finished in. |
| U-4 | **Monsters ship on code-drawn silhouettes.** Painted sprites follow later from per-monster art briefs. Regions are therefore no longer blocked on art. |

"Green" means `node tools/run_gates.mjs --baseline=…` reports no new failing line. Main is allowed to carry a known red; a patch may not add one, and may not hide behind one — the comparison is per failing line, not per file.

---

## R-1 — Fodder comes off the HP world axis

**14 Nov. GDD §2.6 rule 4, §4.3. Code: `enemyHpAxis`, `REGION_OPENER_PACKET` in `js/regions.js`.**

**The finding.** `REGION_HP_MULT` is total player output growth (×7.36 by region 8), and it is almost all *rate*: more skills firing, not harder hits. The weakest opener hits for 5 at level 1 and 5 at level 64. Fodder multiplied by the world axis went from 3.9 HP to 28.4, so "fodder dies to one hit" held in region 1 and nowhere else — six hits by region 8.

**Why it could not be tuned away.** The lever the Designer named on 4 Nov was authored fodder HP 3 → 2 for a whole region. 2 × 3.84 is already 9.9 live in region 3, and 1 × 4.33 is over the packet by region 4. The two rules — one-hit fodder, and fodder on the world axis — could never both hold.

**The ruling.** The axis is split by what it measures.

- **Fodder** rides the weakest opener packet at the region's anchor level. Flat today, so fodder is ~4 HP live in every region.
- **Specials, landmarks, elites, bosses, pylons and nests** keep `REGION_HP_MULT` unchanged.
- **The horde grows in count.** The per-region spawn rate is set on the pace pass by the density bars of §2.6, the way map 1's ×1.45 was.

**What it costs.** A landmark is worth 11 fodder in region 1 and 62 in region 3. The horde's threat in later regions comes from count, speed and contact damage, never from fodder HP — and a region whose spawn rate is not raised to match will play as an empty room. That number is owed by the pace pass and is not optional.

**How it is held.** `roster_weight_gate` re-measures the packet at all eight anchors and fails on drift either way, and spawns a fodder and a landmark through a real Sim in each horde region to read the HP off the body. Both checks were driven red on purpose before being trusted.

**Not decided here.** Whether openers *should* gain per-level growth, so that numbers visibly climb across a run. That would move the table and thicken fodder to match; it changes how the game feels and not how it balances, and it belongs to the balance pass.

---

## R-2 — Regions 4–8: five rosters, five bosses, five curses

**14 Nov. GDD §3.7. Code: `js/content/enemies-{egypt,congo,russia,sunda,outback}.js`.**

The roster brief (`docs/regions-3-8-roster-brief.md`) is a template with empty slots; these are the slots filled. Every roster is authored to the same role bands — fodder 3 HP, one light special at 8, two landmarks — so the only thing that distinguishes a region is **what it asks of the player.** Each adds one thing the regions before it did not:

| Region | Asks | By fielding |
|---|---|---|
| 4 Egypt | The kill is not the end of the body | a **splitter** as the commonest unit, and the game's first **sniper** |
| 5 Central Africa | The crowd is not uniform | a **bomber** you must not stand beside and a **medic** you must kill first |
| 6 Northern Russia | The crowd is not always one hit | the warden's ally aura on a common **special** — a shield-wall |
| 7 Off Indonesia | Nothing arrives in a straight line | an **orbiter** as the commonest unit, and the longest light lane |
| 8 Australian Outback | Everything at once | one fodder per domain at near-equal weight, under a 40% cap |

The five behaviours no earlier roster used (splitter, sniper, bomber, medic, and the aura on a light unit) are each introduced once, in order of how much they ask.

**Boss health continues the 900 → 1600 → 2300 line** against measured output at each anchor: 2600, 3200, 3600, 4400, and 8000 for the last. These are provisional. `boss_gate` reports a level-anchor Necromancer killing them in 26–51 s in god mode, which is short — the Necromancer is the fastest boss-killer measured — and the last boss at 51 s is not yet the endurance fight §3.4 intends. **The balance pass owes all eight bosses a time-to-kill target and a re-measure.**

**Not done, and said so.** Hazards are named for all eight regions and implemented for none. No region authors a nest, so Nest Purge still borrows the dungeon's. Regions 2–8 are not yet on the horde curve.

## R-3 — Source material for regions 5, 7 and 8

**14 Nov. Recorded in the roster files and GDD §3.7.**

The GDD names region 5 for "Congo spirit cosmology … masked ancestors", region 7 for "tide gods", and region 8 for "Aboriginal Dreaming". **No figure from a living tradition's sacred stories is used as a monster to be killed.**

- Region 5 is invented swamp-and-rot bodies and Mokele-mbembe, a river cryptid.
- Region 7 is invented sea-things and a drowned king of an invented city.
- Region 8 is built entirely from the continent's extinct megafauna — Thylacoleo, Diprotodon, Genyornis, Megalania — and the country itself (dust, heat, fire). Nothing from any people's Dreaming appears.

This is a call made on the user's behalf about their game, and it narrows what the GDD describes. It is theirs to revisit.

## R-4 — Boss mechanics become data

**14 Nov. GDD §3.5 item 5. Code: `tickBossBlocks` in `js/entities/enemies.js`.**

The three region bosses shared one kit — zone, charge, a phase 2 with a different shape — and were the same fight at three sizes. The four legacy bosses each had a real mechanic, as four bespoke `kit` cases, which is why a fifth boss could not have one without a fifth case.

The mechanics are lifted into seven optional **blocks** on a boss def: `adds`, `ring`, `volley`, `pools`, `vortex`, `beams`, `ward`. Each drives a sim primitive that already existed. `p2.<block>` **replaces** rather than merges, so a block can exist in phase 2 only, tighten, or stop.

**Two things the gate found on its first run, both fixed here:**

- **A ring born at the boss's centre is born inside the player.** A boss walks onto its target, so all sixteen bolts of Megalania's ring struck a stationary player in the tick they spawned — 192 damage with no travel time. Bolts now leave from the rim. *The legacy Choir and Regent kits spawn from the centre the same way and have not been changed.*
- **Phase 2 waited on phase 1's timers.** A block redeclared with a shorter cooldown still ran out the old one first. Timers are now clamped on the tick the phase turns. This was found by the gate's own negative control.

## R-5 — Two leaks closed, and a hole in R-1

**14 Nov. Found by `region_wire_gate` when regions 4–8 first existed.**

- **A lever asks for a role, and a region with nobody in that role has no lever.** `_leverPick(...) || 'lobber'` borrowed the dungeon's Lobber for any region without a ranged body. Central Africa has none by design. With a region roster, no match now means the drawn id stands.
- **The Elite Arena's champions are the region's own.** Its four variants named dungeon monsters outright. They are now resolved by role against the region, scaled to land on the variant's tuned health whatever the stand-in's own HP is, and the "Splitter" champion splits whatever body is standing in for it.
- **R-1 asked the def and should have asked the spawn.** "Fodder" is a role in a crowd. The same body spawned as an elite, an Elite Arena champion or a bounty is meant to take a fight; `enemyHpAxis` now takes the spawn options and keeps the world axis for all three. Without this an elite fodder in region 8 would have had 9 HP.

## Findings logged, not acted on

- **Region 1 is over its own domain cap.** By encounter weight it is 77.5% physical against a 60% cap; the horde re-weighting put two physical bodies at 7.5 of 10. `roster_weight_gate` now reports the share for every region. Fixing it changes the most-played region in the game and belongs to the balance pass.
- **Fodder one-hit has zero margin at triangle disadvantage.** 5 × 0.80 = 4.0 against a 4 HP body. Now gated, so it fails first if `enemyHpMult` or the packet moves.
- **Nest Purge's +50% map toughness lands on fodder**, taking it to 6 HP against a 5-damage opener — in region 1 too, today. Not changed here.
- **A siege's crowd is thinner under R-1.** `sim_test`'s stress harness fell from ≥150 alive to 106 in region 4 because one level-1 opener now mows the fodder it could not dent before. The harness was stripping weapons and leaving the skill firing; it now strips both, as its comment always intended. The underlying fact stands and is the pace pass's: **the horde has to grow in count.**

---

## R-6 — Every region runs at horde pace, and the horde's growth is the fodder's

**14 Nov. GDD §2.6. Code: `HORDE_REGION_RATE`, `hordeSpecialWeightScale` in `js/arenas.js`; `CONFIG.HORDE_REGIONS`.**

Region 2's roster is re-authored to the Designer's spec of 4 Nov (`pace-spec.md` §15) and all eight regions are on the horde curve.

**A correction to R-1 first.** R-1 predicted that a region whose spawn rate was not raised "will play as an empty room". **Measured, that was wrong, and in the opposite direction.** With every region on the horde curve at the rate it then had, median alive at map 3 ran 49–107, and from region 4 on thirteen of fourteen classes sat pinned at the 120 alive cap for the whole wave. Specials and landmarks keep the world axis and carry most of a room's health; a room fills rather than empties.

**Why it filled.** The region rate was `1 + 0.15 × (region − 1)`, applied to the whole spawn stream — ×2.05 by region 8, landmarks included. The rosters author a landmark at a draw weight meant to make it "an event rather than a texture"; a region-8 room fielded about fourteen. Their health already scales with the player through the world axis, so multiplying their arrival rate multiplied the same axis twice.

**The ruling.** The region factor is how much more *fodder* a region fields. It is divided back out of every telegraphing unit's draw weight, so specials and landmarks arrive at region 1's rate per second whatever the crowd's size. Elite rooms are exempt — a room about champions should not thin them.

**The table is measured, not a formula** (`tools/region_pace.mjs`, fourteen classes): ×1.00 / 1.30 / 1.00 / 1.00 / 1.80 / 1.00 / 1.10 / 1.10. It is not a smooth climb because it depends on what a roster does to its own crowd — mummies split, bombers remove themselves, orbiters accumulate.

**What it shows about the classes.** The horde barely grows across the run because the classes' crowd-clearing barely does: the median class clears 5–7 fodder a second at level 4 and about the same at level 70. The rate table can only follow that. **Raising it is owed to the class pass, after which it is re-measured.**

**Also fixed.** Egypt paid double the materials of any other region, because each mummy's two scarabs paid as well. The split is the fight; the mummy is the pay (`splitNoMats`).

## R-7 — The level curve is held to what the GDD says it is

**14 Nov. GDD §4.2, §4.3. Code: `REGION_ANCHOR_LEVEL`, `expectedLevelAt` in `js/regions.js`; `MAP_XP_MULT` in `js/arenas.js`.**

**The finding, and it pre-dates this push.** The GDD says 1–2 levels per map. The game paid five to seven in region 1. Measured on main at `22419eb`, before any of this work:

| Arriving at region | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Anchor the game was tuned for | 1 | 10 | 19 | 28 | 37 | 46 | 55 | 64 |
| Level the XP actually bought | 1 | ~23 | ~39 | ~50 | ~65 | ~75 | ~83 | ~92 |

Every enemy number in the game is measured at the top row. The only map whose exit level any check asserted was region 1's first.

**Why.** XP rides materials, and materials are sized for the shop by spawn count. A room's materials grow with the horde; a level's cost grows with the level. Nothing ever tied them.

**The ruling.** 1.5 levels a fight, six fights a region. Region 1's first map keeps the exception it was given on 2 Nov — it is the onboarding room and exits at level 6–7 — so the anchors become **1, 14, 23, 32, 41, 50, 59, 68** and the run ends at about level 77, which is the "level 80" `power-curve-phase1.md` confirmed as the design assumption.

`MAP_XP_MULT` multiplies **XP only**, at the single site it is credited, by a measured factor per region and map. **Gold is untouched** — the shop's economy is the economy it was.

**What a player will notice.** Levelling after the first map is about a third as fast as it was in regions 1–5, and unchanged by region 8. That is five stat cards and five skill points between every 45-second fight becoming one or two. If that feels too slow in play, the lever is `LEVELS_PER_FIGHT` and the anchors that follow from it — one number, with the gate re-run.

**Also fixed.** The boss room has no depth, and the XP site filed it under map 1 — so region 1's boss paid the onboarding room's ×1.7.

**How it is held.** `tools/level_curve_gate.mjs` plays every map and every boss in every region with a character at the expected level and asserts 1.0–2.0 levels, and that each region's six fights arrive within 1.5 levels of the next anchor. 55 checks; driven red by putting one map back at ×1.

## R-8 — The world axis, re-measured against characters that exist

**14 Nov. GDD §4.3. Code: `REGION_HP_MULT`, `REGION_DMG_MULT` in `js/regions.js`.**

The axis read ×1.00 / 2.13 / 3.84 / 4.33 / 5.29 / 6.02 / 7.35 / 7.36. It was measured carefully, against the wrong character three ways: four classes of fourteen; anchors two regions below where players were; and built by assigning `p.level`, which grants a level's skill points and none of its stat cards.

Re-measured across all fourteen classes at the paid anchors, on characters built through the game's own level-up path:

| Region | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Median output | 16.3 | 77.1 | 163.1 | 155.9 | 197.7 | 237.9 | 276.9 | 340.0 |
| HP × | 1.00 | 4.74 | 10.04 | 10.04 | 12.16 | 14.64 | 17.04 | 20.92 |
| damage × | 1.00 | 2.57 | 4.06 | 4.06 | 4.56 | 5.11 | 5.60 | 6.34 |

**A region-8 character puts out about 21× a level-1 one; the axis said 7.36.** Landmarks, specials, elites, pylons and nests were a third as tough as flat time-to-kill asks by the end of the run — the game got easier the longer it ran.

Damage keeps `HP^0.608`. With stat cards spent, a build taking damage and vitality evenly grows its effective HP about ×7–9 by region 8, so the inherited exponent lands where a measured one would.

**Bosses.** Their health is authored, not on the axis. Against real characters at the level a player meets them, median time-to-kill across fourteen classes is 40 / 43 / 56 / 53 / 53 / 88 / 77 / 145 s. Regions 1–5 and 7 are unchanged. Koschei drops to 2,800 HP because the walk to his ward is a third of the fight and is paid in time. Megalania rises to 13,000: at 8,000 the last boss died in 91 s, which is one more fight rather than the endurance test.

## What every earlier measurement was standing on

`tools/lib/build_char.mjs` is new and the three rulings above depend on it. Every harness that wanted "a level-28 character" set `p.level = 28`. That is a character with level 28's skills and level 1's body — no stat cards — and two harnesses sent `{kind: 'levelUp'}` to spend them, for an action the sim spells `levelup`. The builder grants levels through `_grantLevel`, spends points through `spendSkillPoint`, and resolves the banked cards through the real offer path by a stated policy.

`tools/lib/room_bot.mjs` is the other half: a bot that stands where its slotted skills connect and picks up what drops. Its first version held a flat 190-unit ring and reported the five melee classes getting *worse* with level; it was standing outside sword reach. Its second stood still once nothing was alive and reported a boss room paying 0.02 levels.

## Findings logged for the class pass

- **Two classes put out six to eight times the roster median.** On the dummy ring at level 68: Necromancer 2,307 and Savage 860–1,198 against a median of 340. The Necromancer kills region 7's boss in 18 s where the median takes 77.
- **Crowd-clearing barely grows with level for half the roster.** Samurai, Monk, Assassin, Bard and Blacksmith clear 5–6.5 fodder a second in region 8, about what they manage in region 1.
- **Boss time-to-kill spreads 5–10× across classes** (region 8: 38 s to 314 s).
- **Region 1's first map dips to two or fewer alive for up to 9% of the wave** for its thinnest class, against a 5% bar. Pre-existing and previously accepted as noise at 5.2%.
