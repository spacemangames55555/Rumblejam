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

## R-9 — Every monster is drawn in code until it is painted (15 Nov)

U-4 asked for a distinct animated code-drawn silhouette per monster now, painted sprites from Grokbot later. This is that.

**What was there.** No enemy sheet is on disk, so the renderer fell through to `def.shape`. Forty-eight monsters and eight bosses were six polygons in different colours.

**What is there now.** `js/glyphs.js`: fifty-nine glyphs — every region enemy and boss, plus the three bodies every region borrows (the nest, its brood, the ward pylon). Each is a handful of vector parts in a unit box, shaded from the unit's own colour, mirrored to face the way it moves, on an eight-frame whole-body motion phased by id so a pack does not step in unison. `tools/glyph_sheet.html` shows all of them at the size they are drawn in play.

**Decisions inside it, each mine to make under U-1:**

- **The glyph is a fallback, not the art.** A painted sprite still wins the moment one is installed; nothing about the sprite pipeline changes. The drawings follow the notes in `docs/silhouettes.json`, the same notes the prompts in `docs/prompts.json` are built from, so what Grokbot paints replaces a placeholder of the same creature.
- **Same cost as a polygon.** A glyph is painted once into the renderer's existing cached cell, per frame and facing — 16 cells where the rotating triangle already kept 96 — and copied. The hit-flash is its own cached cell, so a horde under fire costs a copy per flash.
- **The domain ring goes under the body.** Over it, the ring is struck through every antler and spear. Under it, the frost and the wind-up ring (which draw over the body) no longer need a separate ring-less cell.
- **The radius stays the truth.** A glyph may overhang its hitbox — antlers, a tail — but its mass must sit on the disc that gets hit. Megalania is drawn from above for this reason alone: side-on, the picture covered 34% of a 56-unit hitbox and the party would have been shooting floor.

**Measured.**

- `tools/glyph_gate.mjs`, 29 checks: coverage, well-formed parts, every glyph inside its cell in every frame (furthest reach 1.46 radii of a 1.55 cell), every picture on its hitbox (thinnest covers 19% of the disc, the Tide Eel), no two bodies in a region sharing a silhouette (closest pair 58% overlap; the cap is 62%, placed between that and a planted "same body minus its headdress" at 67%), and the renderer actually painting them. Thirteen planted defects, thirteen caught.
- `tools/render_parity_test.mjs` compares the cached path with a direct draw of the same scene. Pixels that differ by more than a whole-pixel snap: **5 of 840,960**, against 830 on the polygons this replaces. The first version of the glyph path measured 1,690 — the status tint was being laid on part by part, so wherever a limb crossed a body it was tinted twice. The outline, the tint and the flash are now each one path around the whole silhouette. The parity test also now fails if any body in its scene was painted as a bare polygon.

**Left for Grokbot.** The painted sprites themselves (59 prompts are written and each names its silhouette), and judging the glyphs' motion by eye in a real fight — I can verify a frame, not a feel.

## R-10 — The Savage's cascade pays a bounded amount (15 Nov)

**Found.** `tools/class_breakdown.mjs savage`: the eight slotted skills, each alone, sum to 183 on the ring; together they measured 860 — a ×4.7 "synergy" that is one engine. In real rooms (five regions, map 3, the room bot): the cascade chain read 43 / 121 / 275 / 428 at 10 / 20 / 40 / 60 s against a design reference of 18, broke zero or one time per room, and a region-4 Savage's damage went from 172 a second in the first ten seconds to 4,754 a second in the last twenty. §13 rule 90 had described exactly this and nothing had acted on it.

**Ruled.**

- What a `scaleWith: 'cascade'` step is paid for stops at `CASCADE_SCALE_CAP = 18`. The chain itself stays uncapped and the cooldown term still reads all of it.
- `CASCADE_CD_FLOOR` 0.5 → 0.85 and the engine's contribution 0.50 → 0.25. Swept on the ring at five anchors (floor × contribution): with the cap alone the class read ×1.54–2.17 of the median; with no engine at all, ×0.84–1.07 — so the Savage's skills are already at the median without it, and the engine is the premium. 0.8 / 0.30 was the first choice (×1.11–1.44) and `sim_test`'s three-slot table moved it: there the class read +54% of its anchor, against a ±40% band, and +30% at 0.85 / 0.25.

- **Aftermath's capstone comes down with it**: Flashover 16 → 13, Detonate 13 → 12. Neither rides the cascade, so bounding the engine took output from Primal Fury and Bloodbound and none from Aftermath, which then read +67% of the class's own median in `tree_dps` (band ±60%). Flashover alone carried 36 of that tree's 99.

**After.** Ring ×1.05–1.35 across the anchors from region 2 on (was ×2.2–4.7). Boss time-to-kill ×0.89–0.98 of the median. Real rooms: 6.8 / 9.7 / 5.7 kills a second in regions 2 / 5 / 8 against medians of 6.6 / 9.3 / 5.7.

**Not fixed, and not mine to fix in a numbers pass:** a chain that never breaks is a ramp, not a decision. KNOWN-DEFECTS #19 — repoint the Savage's skills at the trait's own capped momentum engine — is still the design answer.

## R-11 — The Necromancer is put on the roster's scale (15 Nov)

**Found.** ×6.8 the roster median at level 68 (×5.7 at 14). `class_breakdown --roster`: Spiked Punch, a tier-1 node, alone in one slot, measured 990 where the median class's *whole loadout* measures 340 and the median class's strongest single skill 99. Bone Nova 792, the Monster 761. The three Necromancer files say why in their own headers: the trees were transcribed from the conversion document and "no ruling ever reconciled DAMAGE… taken as authored and the consequence reported rather than tuned away."

Three separate things were off the roster's scale, and each is fixed where it lives:

| | Necromancer | the other thirteen |
|---|---|---|
| rank growth | 13–17% a rank, 50% on the Blip (`rankPer`, the document's flat "+5 per rank") | 4–4.5% |
| a tier-1 melee | 30 damage, 1.2 s, full circle | 4–13 damage, 0.8–1.6 s, a 90° arc |
| a tier-4 melee | 24 damage, 1.2 s, a 165 circle | 5–18 damage, 1.8–4.5 s, an arc to 122 |
| a summon's swing | × Damage × Summons × two passives = ×15.6 at level 68 | a caster's own strike: × Damage = ×3.7 |

**Ruled.** Ranks go on the roster's 4%. Each damaging constant goes to what the roster pays for that primitive at that tier, by the table `class_breakdown` and a survey of all 274 damaging steps give; the old value is in a comment beside every new one. A straight fit to a target number was tried first and rejected: it put Spiked Punch at 2 damage, which cannot kill map-1 fodder in a hit (`opener_gate`), so the full-circle skills take the cut in **cadence** and keep a hit that kills. Shapes, riders, ranges, triggers and what each node *does* are the document's and untouched. Entropy Cascade is not retuned: it carries its own earlier ruling and it was not what was over.

Two fixtures then disagreed with the first pass, and both were right. `tree_dps` compares a class's three trees with each other: Dark Matter read +283% of the class's own median, because Marrow's circles (reach 72 and 84) do not span that fixture's ring and Internal Collapse and the Rift were still carrying the tree. And `sim_test`'s three-slot table read the class at −50%. So Collapse and the Rift came down again, Marrow's ranged pieces came up, the Blip went back from 6 to 7, and the Monster and the two summon passives were trimmed once the class's own breakdown showed the Monster at 43% of its best slotting. The trees now read 70 / 45 / 27 in `tree_dps` (all inside ±60%).

**After.** Ring ×1.09–1.28 across the anchors from region 2 on. Boss time-to-kill 44 / 47 / 54 / 119 s in regions 2 / 5 / 7 / 8 against medians of 44 / 53 / 77 / 145 (region 7 was 18 s). Real rooms 5.9 / 9.0 / 5.8 kills a second against medians 6.6 / 9.3 / 5.7. The roster median did not move at any anchor — both outliers were above it — so `REGION_HP_MULT` and every boss's health stand as measured.

**Left open.** A summon is multiplied by two stats where a strike gets one. That is true for the Druid and the Hunter too, they are in band with it, and changing it is a change to the stat system rather than to a class. `docs/design/classes/necromancer.md` still carries the document's original magnitudes, now with a note at its head.

## One gate made stricter on the way

`tools/rider_gate.mjs` reported the retuned Dark Matter Bomb's splash as never landing. The splash was landing on every cast. The fixture stood one bystander beside one of three staged targets, and a `lowest_hp` bolt keeps hitting whichever target it wounded first: the old Bomb passed only because it killed that target inside the window and moved on. There is now a bystander beside every target, and the check compares against the same skill with the rider stripped rather than against zero — because with `skillSplash` planted to deal nothing, three of the game's five splash skills still read as landing under the old check (a piercing bolt hits a bystander without any splash). Under the new one all five fail.

## The gate both rulings leave behind

`tools/class_band_gate.mjs`, 13 checks on the same ring the world axis is measured on: every class within ×0.5–2.0 of the roster median at every anchor from region 2 on (measured ×0.68–1.91); no single skill worth more than 0.75 of a median loadout (strongest 0.52; Spiked Punch was 2.9); no class's second ten seconds paying more than ×2.5 its first ten (steepest ×1.93; the uncapped cascade was ×4.9); the cascade's published value stopping at its cap while the chain runs past it; and no damaging active ranking above 6% a rank. The band is a backstop set just outside what ships, not a target.

## R-12 — Ten heals say who they reach (16 Nov)

`heal_gate` was red on a list the code itself called a design decision waiting to be made: ten heals with no declared reach. All ten fire on the caster's own health and healed the caster.

**Ruled.** Eight are self-heals by name and by trigger, and now say so (`selection: 'self'`, `shape: 'point'`): Second Wind, Gathering Breath, Mend, Quiet the Body, Arcane Recovery, Brine Draught, Mend the Seam, Feed the Pack. Two are the first heal of a support tree and reach the party: the Priest's **Intercession** (everyone within 240) and the Bard's **Refrain** (everyone within 220). In a co-op game the healing class's first heal healing only the healer is the one case a second player would call a bug. 240 is wider than Solace's 140 on purpose — Reckoning heals who is fighting beside the Priest, Grace heals who is in the room. Amounts and cooldowns are unchanged.

## R-13 — Summoned animals live long enough to matter (17 Nov)

**Found.** `combat_gate` could not stage a Druid pack, and the reason was not the test: `tools/minion_uptime.mjs` (new) measured the Druid's wolf, bear and hawk standing for **15–67% of a room**, falling every region. Enemy damage rides the world axis (×6.34 by region 8); an animal's health did not keep up, a region-8 hawk died in about two hits, and then waited 23 seconds to come back. Three things made it worse than the numbers alone: a minion took a landmark's telegraphed slam in full (a zone is a question asked of the *player's* feet — a wolf stands in it because standing next to what it bites is its whole job); a taunting animal was hit by every taunted enemy on that enemy's own clock, so the bear's taunt was the quickest way to lose the bear; and the Hunter's revive times were typed in seconds into a field read as milliseconds, so its hounds came back in **seven thousandths of a second** — effectively immortal, the opposite failure.

**Ruled.**

- A minion takes **25%** of a telegraphed hit (`CONFIG.MINION_TELEGRAPH_TAKEN`). Contact damage is untouched.
- One contact hit per **1.5 s** per minion, from whichever enemy throws it — the taunt path now shares the window the other path always had.
- The Summons stat raises a minion's health at **twice** the rate it raises damage (`ingenuityHpMult`), so a pack's health grows across a run the way a character's body does through cards.
- Druid: wolf 34 → 45, bear 78 → 100, hawk 20 → 30 health; revive `15000 + 4000·(N−1)` → **`6000 + 2000·(N−1)`** ms (GDD §8.5 updated).
- Hunter: revive 7 → **7000** ms, 1.5 → 1500; falcon 6 → 6000. Hound 34 → 45 health, falcon 26 → 34.

**And then the Druid had to come down**, because it had been tuned — by accident — against a pack that was dead most of the time. With animals standing it read ×2.2 the median on the ring and killed Megalania in 80 s against a 145 s median. Zeroing parts one at a time located it: of 432 at level 41, the animals' bites carried ~90, the pack engine (on every Wild Kin skill) ~75, the Druid's own kit ~265. So: bites ×0.6 (wolf 7 → 4, bear 12 → 7, hawk 9 → 5.5), pack engine contribution 0.48 → **0.2**, Thornwall 14 → 8.5, and Cutting Back 13 → 11 (the highest tier-1 strike in the game, and what kept a level-5 Druid at +48% of the early-game anchor).

**After.**

| | Before | After |
|---|---|---|
| Druid animals standing, regions 2 / 5 / 8 | 15–37% / 34–67% / 19–23% | 78–100% / 72–92% / 48–67% |
| Hunter animals standing | 100% (the revive bug) | 66–77% / 75–76% / 49–65% |
| Druid on the ring | ×1.9 (×2.2 mid-change) | ×1.27–1.52 |
| Druid boss time-to-kill, regions 2 / 5 / 8 | — | ×0.84 / 1.0 / 0.74 of the median |
| Druid real-room clear rate | — | 6.9 / 9.8 / 5.9 kills a second against medians 6.6 / 9.2 / 5.8 |

**Cost, recorded rather than hidden.** The Hunter's hounds now die to bosses like everyone else's animals, and the Hunter's boss time-to-kill went from about the median to ×1.2–1.5 of it — it joins the Priest, Witch Doctor and Mage as the classes that are slow against bosses (next pass). Its ring output and room clear rate are unchanged. And the Necromancer's skeletons, which stack several health passives on top of the faster Summons scaling, now carry ~1,200 health — they were already never dying, so this changes no output, but a skeleton that taunts is now a very good wall. Survival is the measurement that will say whether that matters.

## R-19 — Gloom shrouds your sight, and what will hurt you shows through (17 Nov)

**Found.** Region 1's curse declared `sightMult: 0.55` and nothing read it (KNOWN-DEFECTS #41): a Gloom room was a plain room with the generic cursed-node multipliers. The defect asked for a design call on what "sight" means in a game that draws the whole room.

**Ruled: render-only, like Glamour.** A near-black shroud around your own character — clear to 283 units, 90% dark from 404 (0.55 of the room-screen's half-diagonal of 734) — over the ground, the bodies and the players. **Committed zones, boss telegraphs and enemy shots are drawn again on top of it.** So Gloom hides what is *coming* (bodies, and where the crowd is thick) and never what will *hurt* you; the rule that every committed attack is readable holds in the dark. Targeting, the sim and its rng are untouched, so co-op guests shroud from the curse id they already receive and nothing can desync. The curse's card text now says this: "Sight closes in. The wind-ups and the shots still show through the dark; the bodies behind them do not."

**Why not a targeting range.** It would make region 1's cursed room a damage nerf to ranged classes on the one map that teaches the game, and auto-fire aimed into the dark is what makes a horde game feel fair when you cannot see.

**Checked.** `curse_gate` (5 new checks): host and guest read ×0.55 from the curse id on the wire; a plain region-1 room draws no shroud; no other curse shrouds; the shroud's numbers; 20 s of a Gloom fight byte-identical with and without the shroud work. A planted dead reader fails it. A real frame of a Gloom room was captured in the browser and looked at.

## R-18 — The first three bosses stop being one fight at three sizes (17 Nov)

**Found.** R-4 made boss mechanics data blocks and regions 4–8 got one each; the Cedar Mother, Ixkik and the Hollow King were left with the shared kit (zone, lane charge, a phase 2 that changes the zone's shape) and nothing else.

**Ruled.** Each gets a signature, chosen so the three teach in order the reads the later bosses combine:

| Boss | Phase 1 | Phase 2 | The read it teaches |
|---|---|---|---|
| The Cedar Mother (r1) | — | `adds`: 4 saplings / 10 s, 8 at most | Clear a crowd while the lanes keep coming. Phase 1 stays a lesson in the slam and the lane. |
| Ixkik, the Blood Moon (r2) | `ring`: 10 bolts / 5 s, speed 220, 10 damage | ring 12 / 4 s at 240; `pools`: 2 / 7 s, r 70, 10 dps, the first under her target | A radial ring is dodged by stepping into a gap, not by running. Then the gap is not safe either. |
| The Hollow King (r3) | `volley`: aimed fan of 5 over 40° / 3.5 s, speed 300, 10 damage | fan of 7 over 50° / 2.8 s at 320; `adds`: 3 Wild Hunt riders / 9 s, 6 at most | An aimed attack is dodged across its line. `volley` had never been used. |

Damage sits well under each boss's slam (a bolt is 10 against 44 before the region's multiplier); the blocks add reads, not lethality.

**Checked.** `boss_gate` sees every declared block in the phase that declares it (20 checks), and catches a planted dead block (the Hollow King's volley on a 9,000 s cooldown: "declares volley in phase 1 and the world shows nothing"). With the player mortal and the room bot dodging, four classes × two seeds, deaths with and without the blocks: 7/8 and 7/8 (r1), 4/8 and 5/8 (r2), 6/8 and 6/8 (r3); damage taken a second 5.6 → 5.6, 6.2 → 6.2, 9.2 → 10.0. The bot dies to these bosses either way — the survival question of R-15, not something the signatures caused.

## R-17 — Map 1 leaves a perfect player at level 7, not 8 (17 Nov)

**Found.** `region_test` (red on `main`) clears map 1 perfectly — every enemy dies the tick it spawns — and holds the onboarding promise of 9 Nov: leave map 1 at **level 6–7** with three slots, paying about what it paid then (95 materials on seed 777, 90 on `0xa11ce`, ±15%). It measured level **8** and **119 / 104**. Map 1's payout is one hand-set number, `HORDE_MAP1_YIELD` (`js/arenas.js`), measured rather than derived, and the room had drifted under it.

**Ruled.** `HORDE_MAP1_YIELD` 0.58 → **0.5**.

**After.** A perfect clear leaves at level 7 with 97 / 91 materials. The `map1_bot` kite (no god mode, five seeds) leaves the Wizard, Samurai, Necromancer and Priest at level 6, one Samurai seed at 7, and none of them needed the map-1 catch-up top-up. `level_curve_gate`: map 1 pays 5.44 levels (window 5–6.5) and region 1's six fights carry level 1 to 14.0, where region 2 expects 14. `econ_gate` green.

**Why lower the payout rather than widen the test.** The window is a design promise (three slots and a level-up card after the first fight, not a fourth); the test was right. A normal player now sits at the floor of it — the catch-up rule already guarantees level 6 to anyone short, so nobody leaves map 1 under-levelled.

## R-16 — The strongest and weakest class meet the roster (17 Nov)

**Found.** With a dummy-count option on the shared ring (`tools/lib/dummy_ring.mjs`, `dummies: 1`), each class against one target and against six at level 59: the **Samurai** was ×1.59 the median alone and ×1.79 in a crowd — the strongest at everything; the **Priest** ×0.66 and ×0.71 — the weakest at everything. (The Witch Doctor and Mage are ×0.70 alone but ×1.0–1.1 in a crowd: an area class that is slow on bosses, which is an identity, not an error — left alone and recorded.)

**Ruled.** Every Samurai damage constant ×0.8. Every Priest damage constant from tier 4 up ×1.45; its tier 1–2 skills unchanged, because the early Priest was already +14% of the early-game anchor and a flat raise put it at +49% (`sim_test`'s level-5 table, band ±40%). Rank growth untouched — a first version of the script caught `rankDamage` by name and turned the 4% step into 50%; `class_band_gate` check E would have failed it, but it was caught first by the measurement going the wrong way.

**And the Bard's Ensemble tree** (its party-support tree) read −61% of the Bard's own median in `tree_dps`, against a band of 60 — red on `main` since before this push. Its damage constants ×1.25: −51%, the early Bard unchanged.

**After.** Samurai ×1.26 alone / ×1.42 in a crowd; boss time-to-kill ×0.99–1.11 of the median. Priest ×0.83 / ×0.99 on its best slotting. The Priest's boss time in the probe is still ×1.5–2.0, because the probe slots skills in tier order and the Priest's early skills — deliberately unchanged — fill most of that loadout; it is a healer, and its co-op value is not in any of these numbers.

## R-15 — A hit costs the same share of your health in regions 1–4 (17 Nov)

**Found while measuring survival.** With the player mortal (`tools/region_pace.mjs --mortal`, the room bot dodging), 10 of 14 classes died in all three region-2 rooms tried, most still died in region 5, and almost none in region 8 — the reverse of a difficulty curve. Damage taken was 45–80% telegraphed slams the bot tries to dodge.

**The arithmetic.** `REGION_DMG_MULT` was `REGION_HP_MULT^0.608`, and `REGION_HP_MULT` tracks *output*. Effective health (health × armour × dodge; median of fourteen classes × four seeds, stat cards spent) grows ×1.80 / 2.54 / 3.48 / 5.53 / 6.79 / 8.62 / 8.31 at the region anchors. Against the old table, a hit cost **1.43× / 1.60× / 1.17×** its region-1 share of a character's health in regions 2 / 3 / 4, and **0.83× / 0.75× / 0.65× / 0.76×** in regions 5–8.

**Ruled.** Regions 2–4 take effective-health growth: `[1.00, 1.80, 2.54, 3.48, 4.56, 5.11, 5.60, 6.34]` (were 2.57 / 4.06 / 4.06). Regions 5–8 are unchanged.

**Why not the whole curve.** Matching all eight would raise regions 5–8 by 21–36%, and I have no evidence a player survives that. I tried to get it: the same survey run with the full health-tracking table shows the bot dying in **region 1** with nearly every class — including the Necromancer, which never died elsewhere — and region 1's multiplier is 1.0 and was not touched. So the bot cannot survive low-level horde rooms in any region, and its death counts cannot separate "too lethal" from "bot too simple". The early fix only makes things easier where the arithmetic says they were harsher than region 1; the late question is open and needs human play or a better bot.

**What the owner should play first:** region 1 maps 2–3 and region 2, with a fragile class (Wizard, Bard, Witch Doctor). If those feel unfair, the problem is the telegraph damage of the specials and landmarks, not the fodder.

## R-14 — A player can see their own attacks (17 Nov)

U-3's third priority was skill animations. The pipeline was already complete — every active skill sends a fire to the renderer and every one of the 18 effect shapes has a code-drawn, class-coloured drawing (`js/content/skillfx.js`, `js/render.js`). What was wrong is that at play scale most of them could not be seen. Captured in the running game, a Samurai's sword arcs were a faint grey curve, a Priest's attacks barely registered, a Witch Doctor's bolt was a speck. Half of all activations in the game are melee arcs.

**Ruled, render-only (nothing in the simulation changed):**

- The melee arc is a **filled, tapered crescent** — thickest mid-swing, pointed at both ends, a bright core along its leading edge — instead of three thin strokes. It still wipes along the swing. A cleave is wider and carries a second, inner swath.
- Casts are larger and more opaque: the smite is a column of light with a burst where it lands; rings and shockwaves are 6–9 px with a faint swept disc; heals, wards, pools and blights are bigger; detonations are a filled star; tethers are a lane.
- The beam is at least 10 wide with a soft glow; the bolt muzzle flash and the hit impact are about half as large again; a trap shows a ring as it is set; a summon burst is six markers and a disc.

**How it is judged.** `tools/fx_gallery.mjs` freezes the game and draws one effect of every shape at the same moment of its animation on the real floor. That is how the before and after were compared; a screenshot of a fight catches most effects already fading. `render_parity_test` is green — the effect passes are drawn identically on both render paths.

**Left for Grokbot.** Painted effect sprites, which the pipeline already supports (a sprite is drawn on top of the code-drawn effect when installed), and the judgement I cannot make: whether these feel good *in motion*, at full horde density, with eight skills firing.

## Four red gates that were broken tests, and what each was hiding (16 Nov)

Ten gates were red on `main` when this push began. Four turned out to be the test, not the game — and three of those were also reporting working things as broken, which is its own kind of harm: a list of "dead" skills nobody believes.

- **`skill_sweep` (9 lines → 0).** Four skills *crashed* the sweep: a persistent node (Marrownaut, the Blacksmith's three forms) has no trigger, and the sweep read `skill.trigger.kind`. Two form-gated skills "never fired" because the sweep looked for the form only as a compose step and the Blacksmith's forms moved to `persist` nodes in September. Blight read "wired to nothing" because an aura is an object and the sweep summed numbers. Both channels read "wired to nothing" because the sweep stopped watching half a second after a cast and a channel pays on its first tick. Each now has a real check — a persistent node's form, aura, shield and stat block must be *standing* once slotted; an aura must hurt a body stood inside it; a channel is watched through its tick — and four planted defects (an aura that registers and deals nothing, a shield that never arrives, a form that changes no stat, a channel that never ticks) are each caught.
- **`item_gate` (1 → 0).** "Two item modifiers are sold and do nothing." Both are read. The pierce probe stood three targets in a line, and the Necromancer's opener has pierced three since 2 November: with or without the item it hit all of them. The domain probe ran in map 1, which the onboarding ruling later made domain-neutral. Eight targets, and the triangle switched on; with each read site deleted in turn, each probe reads DEAD.
- **`statname_gate` (1 → 0).** Three lines of prose used a stat's retired label.
- **`rider_gate`** — see R-11 above.

- **`patch_gate` (2 → 0, 17 Nov).** The coral check's "nothing to hit" arm was a live horde room: the fixture killed what stood at the door and the wave kept spawning, so the Sundian was planting coral off real hits. The bounty check's fixed seed draws a map with no bounty node, so it ticked a room that had never asked for a mark. The wave is stopped for the first; seeds are walked until a bounty is drawn for the second. A planted defect (coral appearing without a hit) is caught.

Still red, and real or unported: ~~`combat_gate`~~ (it could not stage a Druid pack because the pack was dead — fixed in the game by R-13, and green), ~~`region_test` (3)~~ (real — map 1 overpaid; R-17), ~~`tree_dps` (`bard_ensemble`)~~ (real — R-16), `browser_test` (a 3,900-line suite written against a roster that no longer exists; it fails at its first character click).

## What every earlier measurement was standing on

`tools/lib/build_char.mjs` is new and the three rulings above depend on it. Every harness that wanted "a level-28 character" set `p.level = 28`. That is a character with level 28's skills and level 1's body — no stat cards — and two harnesses sent `{kind: 'levelUp'}` to spend them, for an action the sim spells `levelup`. The builder grants levels through `_grantLevel`, spends points through `spendSkillPoint`, and resolves the banked cards through the real offer path by a stated policy.

`tools/lib/room_bot.mjs` is the other half: a bot that stands where its slotted skills connect and picks up what drops. Its first version held a flat 190-unit ring and reported the five melee classes getting *worse* with level; it was standing outside sword reach. Its second stood still once nothing was alive and reported a boss room paying 0.02 levels.

## Findings logged for the class pass

- ~~**Two classes put out six to eight times the roster median.**~~ **Closed by R-10 and R-11.** As found: On the dummy ring at level 68: Necromancer 2,307 and Savage 860–1,198 against a median of 340. The Necromancer kills region 7's boss in 18 s where the median takes 77.
- **Crowd-clearing barely grows with level for half the roster.** Samurai, Monk, Assassin, Bard and Blacksmith clear 5–6.5 fodder a second in region 8, about what they manage in region 1.
- **Boss time-to-kill spreads 5–10× across classes** (region 8: 38 s to 314 s).
- **Region 1's first map dips to two or fewer alive for up to 9% of the wave** for its thinnest class, against a 5% bar. Pre-existing and previously accepted as noise at 5.2%.
