# Handoff — where Rumblejam stands, and what is left

Written 15 November 2026, last updated 17 November, for whoever picks this up next (the owner, and Grokbot).
It covers the November push: eight regions, the level curve, the world tuning,
the monsters' drawings, and the first class-balance pass. It says what was
done, what was measured, what is left, and — honestly — what I could not judge.

Everything below can be checked. Every claim has a tool that reproduces it or
a ruling that records it.

---

## 1. How to work in this repository

**One command tells you if you broke something.**

```
node tools/run_gates.mjs --browser --baseline=BASELINE.json --save=RUN.json
```

- It runs every `tools/*_gate.mjs` and `*_test.mjs` in parallel (about 10 minutes
  with `--browser`; set `PEERJS_LOCAL` to a local `peerjs.min.js` for the co-op
  tests).
- **`main` is not all green.** One gate is red today, `browser_test`, an
  unported suite (§5); ten were red when this push began. So "is it green?"
  is the wrong question; "did I add a failing line?" is the right one.
  `--baseline` compares your run to a saved run of `main`, line by line, and
  prints `N new failure(s), M fixed`. Zero new is the bar.
- Make the baseline by running the suite on a clean checkout of `main` with
  `--save`.
- **Verify from a clean worktree of the commit, not from your working tree.**
  (`git worktree add /tmp/wt <commit>`.) Twice in this push a gate passed only
  because an uncommitted file was sitting there.

**Every gate is checked by planting the defect it claims to catch.** A gate
that has never been seen to fail proves nothing. When you add a check, break
the thing on purpose and watch it go red.

**Decisions are written down.** `docs/design/rulings-2026-11.md` holds every
balance call made in this push (R-1 … R-22), each with the measurement behind
it, and the owner's four instructions (U-1 … U-4). Read it before changing a
number it set. `docs/GDD.md` is the design; `docs/KNOWN-DEFECTS.md` is what is
known to be wrong.

**One pull request per patch**, merged when the comparison says zero new
failures.

---

## 2. What is done

| | State | Where to look |
|---|---|---|
| **Eight regions** | Built. Six monsters and a boss each, themed to the place, on the horde pacing. Each region asks one new thing of the player (GDD §3.7). | `js/content/enemies-*.js`, `roster_weight_gate`, `region_wire_gate` |
| **Eight bosses** | Every one has a signature mechanic (R-18 gave regions 1–3 theirs: saplings; a blood-moon ring then pools; elf-shot then the Wild Hunt). Median time to kill 44 / 53 / 77 / 145 s for regions 2 / 5 / 7 / 8. | `boss_gate`, `tools/boss_ttk_probe.mjs` |
| **Eight curses** | Each is one lever read at one place in the code; Gloom, the last with no effect, shrouds your sight (R-19). | `curse_gate` |
| **Eight ground hazards** | Brush, bloodmire, fae rings, quicksand, rot pools, black ice, riptides and a sweeping bushfire, from five primitives; players only, plain fights only (R-20). | `js/hazards.js`, `hazard_gate` |
| **Eight nests** | Every Nest Purge besieges its region's own nest, which births the region's commonest creature (R-21). | `region_wire_gate` |
| **Saves keep the character** | Level, skills, loadout and gear are saved with the region progress, and Reset character (world map) starts both over (KNOWN-DEFECTS #43, reported by the owner 18 Nov). | `carry_gate`, `save_persist_test` |
| **Level curve** | Every fight pays about 1.5 levels; a run ends near level 77. | `level_curve_gate` (plays all 48 fights) |
| **Enemy health and damage** | Follow the level a party actually arrives at, measured against fourteen real builds. Fodder dies to one hit everywhere. | `tools/region_curve.mjs`, `js/regions.js` |
| **Horde density** | Rooms stay full without pinning at the cap, eight regions × three maps × fourteen classes. | `tools/region_pace.mjs` |
| **Monster drawings** | All 59 bodies, and the eight nests, are drawn in code as creatures (no sprites exist yet). | `js/glyphs.js`, `glyph_gate`, open `tools/glyph_sheet.html` |
| **Class balance, first pass** | The classes that were far outside the roster (Necromancer ×6.8, Savage ×2.5–4, Samurai, Priest, Druid) are back inside it. Every class is within ×0.72–1.58 of the median on the dummy ring (R-10, R-11, R-13, R-16). | `class_band_gate`, `tools/class_breakdown.mjs` |

---

## 3. What is left, in the order I would do it

### 3.1 Painted sprites — best suited to Grokbot

Nothing is painted. The game shows code-drawn glyphs, which are a readable
placeholder and not art.

- `docs/prompts.json` has a prompt for every unit (89, including all 59
  glyph bodies). Each is built from a one-clause silhouette note in
  `docs/silhouettes.json`, and the glyph on screen was drawn from the same
  note — so a painted sprite replaces a placeholder of the same creature.
- The pipeline exists and is tested: `tools/process_sprite.mjs`,
  `tools/verify_art_batch.mjs`, `tools/gen_contact_sheet.mjs`,
  `tools/gen_assets_manifest.mjs`. README "Art pipeline" has the commands.
- **A sprite wins automatically.** Drop a valid sheet under
  `assets/sprites/enemy/` and regenerate the manifest; the renderer uses it
  and the glyph stops being drawn. No code change.
- The style anchor (batch 0) has to be generated and approved first; the
  prompts all quote it.

### 3.2 Feel — things I measured around but could not judge

I can run the game headless and capture frames. I cannot feel it. Someone
should play each of these and say whether it is right:

- Whether the glyphs' motion reads as alive at horde density.
- Whether a region-6 shield-wall, a region-7 vortex and a region-8 beam sweep
  are fun or merely correct.
- Whether the Savage still feels like a Savage after R-10 (its engine now pays
  a bounded amount; see §4).
- Skill effects: every skill fire draws a class-coloured shape
  (`js/content/skillfx.js`, 18 shapes × 14 class palettes). R-14 made them
  *visible* at play scale — a filled crescent for melee, larger casts, wider
  beams. Whether they *feel* good in motion at horde density is a judgment I
  could not make from frozen frames. `tools/fx_gallery.mjs` draws every shape
  at a chosen moment for review; painted effect sprites drop in on top.

### 3.3 Class balance — the rest of the pass

Measured and not yet fixed:

- **Bosses: two classes are still slow, and two were not what they looked.**
  Median boss time is 44 / 56 / 155 s for regions 2 / 5 / 8. The Priest was
  ×1.5–2.0 because its marks engine counts enemies and a boss is one; R-22
  makes a marked boss count as a full room, and it is now ×1.18–1.34. The
  Mage read ×1.15–1.47 only because the probe runs in god mode and its
  crystal fills from damage taken; with it full it is ×0.90–0.94
  (`boss_ttk_probe --crystal`). **Still slow:** the Witch Doctor
  (×1.37–1.68, a crowd kit) and the Hunter (×1.22–1.41, hounds die to boss
  slams).
- **Every class is now within ×0.72–1.58 of the median** on the dummy ring
  (R-10, R-11, R-13, R-16 brought down the Necromancer, Savage, Druid and
  Samurai and brought up the Priest). The Witch Doctor and Mage remain strong
  in crowds and weak alone — an identity, but a steep one on bosses.
- **Crowd-clearing barely grows with level** for about half the roster, so
  the horde cannot grow across the run. `HORDE_REGION_RATE` in `js/arenas.js`
  was fitted around that and should be re-measured once it is fixed.
- **Survival is the biggest open question, and I could not answer it.** With
  the player mortal (`node tools/region_pace.mjs --mortal`), the room bot dies
  in most rooms of regions 1–5 with most classes; the tanky and self-healing
  ones (Necromancer, Savage, Blacksmith, Priest) live. But the bot dies in
  *region 1* too, so it cannot tell "too lethal" from "the bot doesn't dodge
  like a person". R-15 fixed the one thing the arithmetic proves: regions 2–4
  were hitting 1.2–1.6× harder, relative to health, than region 1. **Play
  region 1–2 with a fragile class first.** If it is unfair, 45–80% of what
  kills is telegraphed slams from specials and landmarks.
- **Summoned animals now live (R-13), at a cost to the Hunter.** The Druid's
  pack stood 15–67% of a room and now stands 48–100%; the Hunter's hounds
  were immortal by a units bug and now die and return on their authored
  seven seconds. The Hunter is therefore slower against bosses (×1.2–1.5 of
  the median). `node tools/minion_uptime.mjs` measures it. Survival of the
  *player* is still unmeasured, and the Necromancer's skeletons (≈1,200
  health, taunting) may turn out to make it the safest class in the game.

`node tools/class_breakdown.mjs <class>` shows a class's statline, what its
stat cards are worth, and every skill alone in one slot. `--roster` puts the
classes side by side. That is how the Necromancer's problem was found.

### 3.4 Content that is named but not built

Nothing named is unbuilt now. Hazards (R-20), nests (R-21), the region 1–3
boss signatures (R-18) and Gloom (R-19) were the last four. What each still
lacks is art: the hazards are code-drawn patches, and the eight region nests
share one code-drawn mound glyph in their region's colours (`NEST_GLYPHS` in
`js/glyphs.js`). Each nest already has its own sprite id, silhouette note and
prompt in `docs/prompts.json`, so a painted nest drops in like any sprite.

### 3.5 Open design questions for the owner

These are yours, not a bot's:

1. **Ten battles per region?** You said "each region will have (I think) 10
   battles". The game has ten maps per region on a branching tree, of which a
   run clears five and then the boss. I kept that. If you want all ten fought,
   it changes the level curve and the run's length, and should be said aloud.
2. **Region 8's source material.** The design names the Dreaming. I built the
   roster entirely from extinct megafauna and the land itself, and used no
   figure from any living people's sacred stories as a monster to kill
   (ruling R-3). That is my call and yours to overrule.
3. **The Savage's engine.** Its chain never breaks in play, so it is a ramp
   and not a decision. Capping what it pays (R-10) makes it fair, not
   interesting. KNOWN-DEFECTS #19 describes the redesign.
4. **A summon is multiplied by two stats where a strike gets one.** True for
   Necromancer, Druid and Hunter. It is why summoner builds scale so hard.
   Changing it is a change to the stat system.

---

## 4. Rulings made in this push, in one line each

Full text and measurements: `docs/design/rulings-2026-11.md`.

| | |
|---|---|
| R-1 | Fodder comes off the health axis; it dies to one hit in every region. |
| R-2 | Regions 4–8: five rosters, five bosses, five curses. |
| R-3 | Regions 5, 7, 8 use invented creatures and megafauna, not living traditions' sacred figures. |
| R-4 | Boss mechanics are data blocks, not bespoke code. |
| R-5 | Two leaks closed (base-roster monsters appearing in region rooms). |
| R-6 | Every region runs at horde pace. |
| R-7 | Every fight pays about 1.5 levels. |
| R-8 | The world's health and damage re-measured against real builds. |
| R-9 | Every monster is drawn in code until it is painted. |
| R-10 | The Savage's cascade pays a bounded amount. |
| R-11 | The Necromancer is put on the roster's scale. |
| R-12 | Ten heals say who they reach (eight self, two party). |
| R-13 | Summoned animals live long enough to matter. |
| R-14 | A player can see their own attacks (skill FX at play scale). |
| R-15 | A hit costs the same share of your health in regions 1–4. |
| R-16 | The strongest (Samurai) and weakest (Priest) class meet the roster; Bard's Ensemble tree raised. |
| R-17 | Map 1 leaves a perfect player at level 7, not 8. |
| R-18 | The region 1–3 bosses each get a signature (saplings; ring then pools; elf-shot then the Wild Hunt). |
| R-19 | Gloom, region 1's curse, shrouds your sight; what will hurt you shows through. |
| R-20 | Every region's ground hazard is built: a slow, a burn, a current, ice or a sweeping front; players only. |
| R-21 | Every region's Nest Purge besieges its own nest, which births the region's own commonest creature. |
| R-22 | A marked boss counts as a full room of the Priest's marks. |

---

## 5. The gates that are red on `main`

Ten were red when this push began; one is left (`browser_test`, an unported suite). None was caused by it. Each was either a
real finding or a broken test, and the difference matters — a test that
reports working things as broken teaches everyone to ignore it.

**Green now.** Most were broken tests, each repair proved by planting the
defect it should catch. One was a design call nobody had made, and one was
the game:

| Gate | What it said | What was actually wrong |
|---|---|---|
| `combat_gate` | The Druid pack fixture never stages | **The game was wrong, not the test**: the pack was dead most of every room. Fixed in R-13; green. |
| `skill_sweep` | Four skills crash; two never fire; three "wired to nothing" | The sweep crashed on skills that have no trigger, looked for forms in the wrong place, could not read an aura, and stopped watching before a channel's first tick. All nine skills work. |
| `item_gate` | Two item modifiers are "sold and do nothing" | Both work. One probe lined up three targets for a bolt that already pierces three; the other ran in the one room where damage types are switched off. |
| `heal_gate` | Ten heals never declared who they reach | A design call nobody had made. Made in ruling R-12: eight are self-heals, two (Priest's Intercession, Bard's Refrain) now reach the party. |
| `statname_gate` | Three doc lines use a retired stat name | They did. |
| `patch_gate` (2) | A coral planted with nothing to hit; no bounty mark in 20 s | Both fixtures. The "nothing to hit" room was a live horde room that kept spawning; the bounty check's seed draws a map with no bounty node. |
| `tree_dps` | `bard_ensemble` is −61% of its own class | Real, balance: its damage ×1.25 (R-16), now −51%. |
| `rider_gate` | (went red during the Necromancer retune) | Its splash check could not tell splash from a piercing bolt. Stricter now. |
| `region_test` (3) | A perfect map 1 leaves at level 8, paying 119 / 104 materials | Real: map 1's hand-set payout had drifted. `HORDE_MAP1_YIELD` 0.58 → 0.5 (R-17): level 7, 97 / 91. |

**Still red:**

| Gate | What it says | What it is |
|---|---|---|
| `browser_test` (11) | Every case fails clicking a character card | **Broken test.** A 3,900-line browser suite written against a roster that no longer exists (`bulwark`, `facet`, `vesper`…). Porting it is its own job. |
| `trait_gate` | Green today, and should not be trusted | The Blacksmith's `crystal_infusion` check passes or fails depending on an unrelated Necromancer number that leaks into its control run. |

---

## 6. Tools worth knowing

| Tool | Answers |
|---|---|
| `tools/run_gates.mjs` | Did I break anything? |
| `tools/region_curve.mjs` | What is the median class worth at each region's level? (prints `REGION_HP_MULT`) |
| `tools/class_breakdown.mjs` | Why does this class put out what it does? |
| `tools/class_band_gate.mjs` | Is any class a different game? |
| `tools/region_pace.mjs` | How full is the room, per region × map × class? (`--mortal` for survival) |
| `tools/level_curve_gate.mjs` | Does every fight pay 1–2 levels? |
| `tools/boss_ttk_probe.mjs` | How long does each class take on each boss? |
| `tools/tree_dps.mjs` | Are a class's three trees near each other? |
| `tools/glyph_sheet.html` | What does every monster look like? |
| `tools/lib/build_char.mjs` | A character built the way the game builds one (use this, never `p.level = N`). |
| `tools/lib/room_bot.mjs` | A bot that stands where its skills reach and picks up loot. |

**Two traps that cost real time in this push:**

- Setting `p.level = 28` in a test makes a character with level 28's skills
  and level 1's body. Stat cards are banked by the level-up path. Use
  `buildCharacter`.
- A fixture that holds every target at full health will never fire a skill
  that triggers on a wounded target, and will report the skill as broken.
