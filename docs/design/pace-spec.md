# Rumblejam — Map-1 Pace Spec (horde pacing)

**Status:** Approved direction, 2 Nov 2026; numbers are targets until the pace branch measures them. Written by Game Designer and measured against `main` at `7e189e5` (PRs #144 and #145 merged). Nothing has been built yet. The GDD rewrite that goes with this spec is Draft 12 of `docs/GDD.md`.

**Decided 2026-11-02 (user):**
1. **Wave end on the timer.** When the timer runs out, leftover fodder is culled and drops/pays its loot (magneted in). Specials, elites and the boss still have to be killed.
2. **Elite nodes are a horde with a few champions.** ×0.7 count (was ×0.55) and about 25% heavies/champions (was 75%), with ×2.4 HP on champions only, instead of a handful of tough enemies.
3. **Samurai's Footing is a step-off burst.** Stacks still build while standing; the first step after holding spends them as a burst (was option §6.1b).

**Ruled 2026-11-02 (Designer)** on the engineer's map-1 build (`cursor/horde-pace-map1` at `98db2c3`): see §11 for the eight rulings and §12 for opener tuning.
**Direction (user, 2 Nov 2026):** match Brotato and Diablo 2 Survivors pacing. That means big packs from the first second, many enemies on screen, short intense waves and steady pressure. Most enemies are fast, weak fodder, and only specials and bosses telegraph. The priorities, in order, are **pace**, then **hero skill feel and class distinctness**, then maps and enemies.

Labels used below: **[measured]** comes from the live sim this session. **[cited]** has a source link. **[estimate]** is a design target or inference with no source, so tune it.

---

## 1. Current map-1 pace on main [measured]

**Harness.** `tools/pace_measure.mjs` is a copy of `tools/map1_bot.mjs`, the balance_probe kite bot, with sampling added. It builds `new Sim({seed, party, regionIndex:1})` the same way `region_wire_gate` does. Runs are solo Samurai on Standard with the bot learning skills. Seeds are 777, `0xa11ce` and 424242 for depth 1, and 777, 424242 and 20260728 for depth 3. Seeds `0xa11ce` and 99 have no depth-3 combat node. Depth 1 is the onboarding node. Depth 3 is reached with `_travelTo`. A level-1 character entering depth 3 dies there in 62–72 s on all 3 seeds, so the depth-3 pace numbers come from god-mode runs (HP refilled every tick). The spawner doesn't read player HP, so god mode doesn't change spawning, but alive counts and fight length depend on the bot's kill rate. Raw output was `pace_measure_out.jsonl` (stdout, not committed).

| | Map 1 (depth 1), 3 seeds | Map 3 (depth 3), 3 seeds, god |
|---|---|---|
| Wave config (raw) | r0 0.30 → r1 0.72 /s, dur 65 s | r0 0.50 → r1 1.56 /s, dur 75 s |
| Effective solo rate (× coopSpawn 1.15 × spawnBudgetMult 1.25 = ×1.4375) | **0.43 → 1.04 /s** | **0.72 → 2.24 /s** |
| Spawns per 10 s bucket | 4, 6, 6, 8, 8, 9, 6 (swarm: 5, 6, 8, 9, 10, 11, 7) | 7, 10, 12, 14, 17, 18, 20, 13 |
| Total spawned | **47 / 47 / 56** | **111 / 111 / 111** (swarm-profile seed 31337: 131) |
| First spawn (t) | 2.6–2.95 s | 2.05 s |
| First enemy within 200 u of the player, median per enemy after spawn | 2.4–2.9 s | 3.5–4.4 s |
| First kill (t) | 4.3–4.7 s | 3.6–9.4 s |
| Alive on field: mean / median / max | **2.4–3.2 / 2–3 / 6** | **15–18 / 16–19 / 30–42** |
| Share of fight with ≤2 alive | **28–52%** | 5–7% |
| Share of fight with ≤5 alive | 97–99% | 10–22% |
| Fight duration (to clear) | 70–75 s (timer 65 s, plus a 5–10 s tail) | 96–107 s (timer 75 s, plus a **21–32 s** mop-up) |
| Exit level | 7 / 7 / 8 | 7 (god) |
| Spawn distance from the player (median) | 730–738 u | 693–726 u |

**Enemy live stats on map 1/3** (authored → live HP; live = authored × `enemyHpMult` 1.12 × solo `coopHp` 1.15, rounded):

| Unit | Behaviour | Role today | HP authored → live | Speed (u/s) | ÷ player 300 | Weight `w` | Telegraph |
|---|---|---|---|---|---|---|---|
| pnw_thornhound | sprinter | chaff | 6 → 8 | 220 | 0.73 | 2.8 | no |
| pnw_sapling | warden | light telegrapher | 7 → 9 | 108 | 0.36 | 3.0 | yes |
| pnw_cedar_warden | dasher | light telegrapher | 7 → 9 | 140 (dash 540) | 0.47 | 2.6 (1.5 on map 1) | yes (lane) |
| pnw_mistwalker | spitter | chaff | 10 → 13 | 95 | 0.32 | 1.6 | no |
| pnw_bark_hulk | brute | landmark | 34 → 44 | 66 | 0.22 | 0.25 | yes |
| pnw_elk | warden | landmark | 24 → 31 | 80 | 0.27 | 0.35 | yes |

Map 1 draws only thornhound, sapling and cedar warden. That table is `_onboardingTable()`, which takes the region's three lightest units. **Alive caps never bound on map 1**: the peak was 6, against `ONBOARDING_ALIVE_CAP` 25 and `ONBOARDING_WARDEN_CAP` 8.

**Player.** `CONFIG.BASE_SPEED` is 300 u/s, the arena is 2600 × 1700, and ring spawns land 640–820 u out with at least 520 u to every player.

**Fodder time to kill with the rank-1 opener** (`tools/ttk_probe.mjs`: level 1, rank 1, map 1, the player standing still, stationary targets at 90 u, 30 s per reading; results printed to stdout):

| Class | Opener | cd ms | Packet | vs 8 HP thornhound: single kills/s · TTK | 12-pack kills/s | vs 13 HP mistwalker: 12-pack kills/s |
|---|---|---|---|---|---|---|
| Samurai | Cross Guard Cut | 800 | 9 | 1.27 · one-shot | **4.43** | 2.17 |
| Priest | Rebuke | 1000 | 8 | 1.00 · one-shot | 3.60 | 1.53 |
| Monk | Open Palm | 1000 | 6 | 0.90 · 1.0 s | 3.23 | 2.77 |
| Druid | Rake | 1150 | 10 | 0.83 · one-shot | 2.90 | 1.30 |
| Assassin | Shiv | 1150 | 6 | 0.77 · 1.2 s | 2.70 | 1.30 |
| Savage | Rip | 1200 | 4 | 0.67 · 1.2 s | 2.57 | 1.30 |
| Witch Doctor | Bone Rattle | 1200 | 6 | 0.40 · 1.2 s | 1.93 | 1.30 |
| Mage | Shardcut | 1300 | 5 | 0.40 · 1.3 s | 1.83 | 1.47 |
| Blacksmith | Hammer Blow | 1150 | 7 | 0.40 · 1.2 s | 1.30 | 1.30 |
| Wizard | Cinder Bolt | 950 | 7 | 0.53 · 1.0 s | 1.27 | 1.27 |
| Necromancer | Dark Energy Blip | 1000 | 6 | 1.00 · one-shot* | 1.00 | 0.50 |
| Bard | Opening Note | 900 | 5 | 1.00 · 0.9 s | **1.00** | 0.53 |
| Sundian | Spindrift | 1150 | 6 | 0.40 · 1.2 s | **1.00** | 0.70 |
| Hunter | Sighting Shot | 1100 | 5 | 0.10 · 0.2 s† | **0.60** | 0.37 |

\* A packet under 8 still one-shots, which suggests a Ferocity or crit multiplier. Treat this as a probe reading. † The Hunter's single-target figure looks fixture-bound (one target at 90 u), so read only its pack figure.
**What this shows:** strike openers already cleave and reach 1.8–4.4 kills/s on a pack, while the bolt openers (Bard, Sundian, Necromancer, Wizard, Hunter) top out near one kill per cast. That gap is the §9 problem.

**Every constant that controls map-1 pace (file:line on `7e189e5`):**

| Constant | Where | Value |
|---|---|---|
| `waveConfig` duration | `js/arenas.js:336` | `round(60 + 5·depth + 5·region)` → 65–110 s |
| `waveConfig` r0 / r1 | `js/arenas.js:350-351` | `(0.5 + 0.25(reg−1))·onb·count` / `(1.2 + 0.55(reg−1) + 0.18·depth)·onb·count` |
| `rampT` | `js/arenas.js:354` | = dur (sieges 150) |
| `ONBOARDING_RATE` | `js/arenas.js:209` | [1, 0.75, 1] |
| `ONBOARDING_WAVE_SCALE` / `_DROP_SCALE` | `js/arenas.js:278-279` | 0.6 / 1/0.6 |
| `ONBOARDING_XP_MULT` | `js/arenas.js:251` | [1.7, 1.35, 1] |
| `ONBOARDING_LEVEL_FLOOR` | `js/arenas.js:258` | 6 |
| `ONBOARDING_CEDAR_WEIGHT` | `js/arenas.js:262` | 1.5 |
| `ONBOARDING_WARDEN_CAP` / `_ALIVE_CAP` | `js/arenas.js:268-269` | 8 / 25 (solo, scaled by `_onboardingCapScale`) |
| `ONBOARDING_CEDAR_WINDUP_MULT` | `js/arenas.js:319` | 1.5 |
| Profile `rateMult` | `js/arenas.js:132-142` | bastion 0.65, swarm 1.18, others 1 (horde maps: Bastion's 0.65 is not applied, ruled 2026-11-02, Designer, §11.2) |
| `SOLO_SPAWN_MULT` | `js/config.js:117` (applied `js/game.js:207`) | 1.15 |
| `COOP_SPAWN_SCALE` / `COOP_SPAWN_SOFT` | `js/config.js:219,222` | 0.5 / 0.3 |
| `ALIVE_CEILING` / `SPAWN_BANK_CAP` | `js/config.js:227-228` | 300 / 45 |
| `spawnBudgetMult` / `enemyHpMult` | `js/config.js:234-235` | 1.25 / 1.12 |
| `POOL_ENEMIES` | `js/config.js:376` | 320 |
| `BASE_SPEED` | `js/config.js:37` | 300 |
| `STRAGGLER_CULL_S` / `_CULL_ALIVE` | `js/config.js:252,258` | 20 s / 8 |
| Spawn delay / mark | `js/game.js:1152` | one unit per spawn, 0.7 s queue, r26 mark |
| Ring spawn distance | `js/game.js:1241,1246` | R 640–820, min 520 to any player |
| `SPAWN_CAPS` (base roster per-type) | `js/game.js:43` | e.g. fusehead 10, lobber 22 |
| Spawn loop (spends `acc` one unit at a time) | `js/game.js:1035-1157` (`_tickWave`) | — |
| Elite node count / HP / heavy share | `js/nodebehaviour.js:25-33` | ×0.55 / ×2.4 / 0.75 |
| Enemy speeds and HP | `js/content/enemies-pnw.js:72,90,107,112,129,140` | table above |
| Telegraph floor | `js/content/regions-enemies.js:25` | `MIN_TELEGRAPH_WEIGHT` 0.5 |
| XP curve | `js/config.js:212` | next level = 10 + 4·level |

---

## 2. Benchmarks

**Brotato** (Crash Zone, v1.1.15.4) [cited]
- Wave lengths are 20, 25 … 55 s for waves 1–8, then 60 s through wave 19, and 90 s for wave 20. Source: [Brotato Wiki – Waves](https://brotato.wiki.spellsandguns.com/Waves).
- **Wave 1** drops 4–5 Baby Aliens from 1 s and again every 3 s. That's 7 spawn events and **28–35 enemies in 20 s** before the Enemies stat and co-op scaling, about **1.5 enemies/s**. Sources: [brotatodb Crash Zone waves](https://brotatodb.com/waves/crash-zone) and [teemo.dev Wave 1](https://teemo.dev/game-design/brotato/wiki/waves/wave-1/).
- Later waves, from the same sources: wave 5 drops Baby Alien ×8 every 4 s plus Chasers ×3–4 every 5 s, shrinking to every 2 s. Wave 10 drops Baby Alien ×8–9 every 2 s plus Bruisers, Chargers and Chasers. By [estimate] from those scripts, wave 5 runs about 3.5–4/s and wave 10 about 5–6/s.
- Groups spawn **clustered around one centre**, at least **300 units from every player**, with a short birth marker. The queue releases 20 units/s. Source: [teemo.dev wave scripting and spawns](https://teemo.dev/game-design/brotato/systems/wave-scripting-and-spawns/).
- **At most 100 living enemies per wave.** Past that cap, a random non-elite dies without loot. Source: [Brotato Wiki – Enemies](https://brotato.wiki.spellsandguns.com/Enemies).
- Player base speed is **450**. Baby Alien moves at 200–300 (0.44–0.67×), Chaser at 380 (0.84×), Charger at 400 (0.89×), and Bruiser at 300. Source: Brotato Wiki – Enemies.
- Fodder HP: Baby Alien has **3** HP (+2 per wave) and Chaser has 1 (+1 per wave). Source: Brotato Wiki – Enemies. The starting Pistol deals **12** damage every 1.2 s and pierces 1. Source: [Brotato Wiki – Pistol](https://brotato.wiki.spellsandguns.com/Pistol). So the wave-1 starter weapon **one-shots fodder at 4× overkill**.
- XP: 1 material is 1 XP, and the next level costs (L+3)², so 16, 25, 36 and so on. Sources: [Brotato Wiki – Experience](https://brotato.wiki.spellsandguns.com/Experience) and teemo.dev. "Levels arrive about once a wave in the midgame." Source: [teemo.dev levels](https://teemo.dev/game-design/brotato/systems/levels-upgrades-and-pickups/). Material drop chance is 100%, decaying 1.5% a wave from wave 5 with a 50% floor, and at most 50 material blobs sit on the ground before drops merge. Source: [teemo.dev stats reference](https://teemo.dev/game-design/brotato/systems/stats-and-formulas-reference/).

**Diablo 2 Survivors** [cited, low confidence: two fan-run wikis that disagree in their details, and no official source was found]
- [d2survivors.lol Terror tiers](https://d2survivors.lol/wiki/terror/): a batch of monsters arrives **every second** in packs at the edge of the screen. The field holds **80 monsters in the first wave, rising to 150** in the last. Each wave lasts at least 11 s and waves 1–8 last at most 60 s.
- [d2survivors.wiki spawn mechanics](https://d2survivors.wiki/guides/spawn-mechanics/): the target population is `25 + 13 × minutes` (capped at 390), with a hard cap of 450 and a ranged cap of max(30, target/3).
- What both agree on, and what this spec uses: packs arrive every second at the screen edge, and 80–150 enemies stand on the field.

**Rumblejam today vs the benchmark (map 1 vs Brotato wave 1):** spawns arrive as singles rather than packs of 4–5. The first spawn comes at about 2.8 s rather than 1 s. The rate is 0.43 → 1.04/s against about 1.5/s from the first second. Peak alive is 6 against a cap of 100. The fight runs 70–75 s against 20 s. Fodder speed relative to the player is about 0.36–0.73 against 0.44–0.89. Map 1 fodder takes 1–2 opener hits, against a 4× one-shot in Brotato.

---

## 3. Target pace, region 1 (solo, effective after co-op and budget multipliers) [estimate unless noted]

| Map (depth) | Length | Rate start → end | Pack size | Pack interval | ≈ spawned | Median alive | Peak alive cap |
|---|---|---|---|---|---|---|---|
| 1 (0) | **30 s** | **1.6 → 4.0 /s** | 4 → 6 | ~2.5 s → ~1.5 s | **~85** | ≥ 10 | 60 |
| 2 (1) | 38 s | 2.0 → 4.8 /s | 4 → 7 | 2.0 → 1.4 s | ~130 | ≥ 15 | 90 |
| 3 (2) | 45 s | 2.4 → 5.6 /s | 5 → 7 | 2.0 → 1.25 s | ~180 | ≥ 20 | 120 |
| 4 (3) | 53 s | 2.8 → 6.4 /s | 5 → 8 | 1.8 → 1.25 s | ~245 | ≥ 25 | 120 |
| 5 (4) | 60 s | 3.2 → 7.2 /s | 6 → 8 | 1.8 → 1.1 s | ~310 | ≥ 30 | 120 |

- **The first pack lands at t = 1.0 s** (Brotato's first spawn time [cited]). The 0.7 s spawn mark still runs, with one mark per pack (r ≈ 70).
- **Wave length** is `min(60, 30 + 7.5·depth + 5·(region−1))`. This follows Brotato's 20 → 60 s ramp [cited], starting longer because a map here is also a level-up block.
- **The wave ends on the timer** (decided 2026-11-02, user). Fodder still alive dies, pays its loot and is magneted in. Specials, elites and the boss have to be killed, and the fight ends when they are. This removes the measured 5–32 s mop-up.
- **Composition:** about 80–90% fodder by weight, specials 8–20%, and landmarks ≤ 0.3 weight each. On map 1 that's fodder plus the Cedar Warden as the one special, capped at 4 alive.
- **Alive caps:** 120 solo per horde room (Brotato 100 [cited]; D2S 80–150 [cited, low confidence]) and 60 on map 1. Both scale by `coopSpawn / soloCoopSpawn` up to `ALIVE_CEILING` 300.
- **Speeds:** fodder runs 165–240 u/s (0.55–0.8× of 300), with sprinter fodder at 240–270 (0.8–0.9×). Specials run 90–150 plus their committed move, and landmarks 66–90 (unchanged). `BASE_SPEED` stays **300**. Changing it would move every dodge window, Footing's grace budget, the bot rings and the minion speed relationship. The ratio target is reached through enemy speed instead.
- **Spawn distance:** ring R 500–640 with at least 420 u to every player (was 640–820 / 520). A pack at 165–240 u/s then arrives in about 2–2.5 s, against 2.4–4.4 s measured. That assumes the camera shows about 1280 × 720 (`ROOM_W`/`ROOM_H`), which puts the spawn just inside the left and right edges and just off the top and bottom. The engineer should confirm the viewport.

**Fodder HP vs hero damage**
- **Rule:** a fodder unit's live map-1 HP is at most the **weakest rank-1 opener packet**, which today is 4 (Savage Rip). Every class's opener then one-shots fodder, as Brotato's starter does [cited, 3 HP vs 12 damage].
- **Authored fodder HP is 3** (live 3 × 1.12 × 1.15 = 3.9, which rounds to 4). The fodder TTK target is **one hit, ≤ 0.1 s after first contact**, for every class at level 1 rank 1.
- **Specials** are authored at 7–10 (live 9–13), so 2–3 hits for strikers and 2–4 for bolts. **Landmarks** stay at 24–34 (live 31–44), so 5–10 hits. Regions 2–8 keep the same hit counts through `REGION_HP_MULT`, since §4.3 says the world axis is the only difficulty multiplier.
- **Kill-rate implication [estimate from §1 probe]:** at level 1, strike openers already reach 1.8–4.4 kills/s on a pack of 8 HP fodder, which meets or beats the 1.6 → 4.0/s map-1 curve. Bolt openers sit at 0.6–1.3 kills/s and can't keep up, which is why §9 gives every tier-1 bolt a pack answer (pierce or splash rider).

**XP and materials**
- Map-1 spawns go from about 47–56 to about 85, map 3 from 111 to about 180, and map 5 from about 148 [measured formula: `hordeTotalSpawns(1,4)`] to about 310. At today's `mats` (1–3 each) and 100% drop, levels would run away.
- **Proposal:** a **fodder drop chance** derived from the old and new spawn totals: `hordeYieldScale(region, depth) = oldTotal / newTotal`. That gives about 0.62 on map 3 (111/180) and about 0.47 on map 5 (148/312). Map 1 is set from its measured yield instead, because the old map 1 also carried the 1/0.6 drop scale and a different table: tune it so seed 777 banks about 71 materials, which works out to about 0.75 [estimate]. Specials and landmarks always drop. Per-map materials, gold and XP then stay within ±15% of today. Brotato's drop chance also decays toward 50% [cited].
- **Map 1 specifically:** `ONBOARDING_WAVE_SCALE` 0.6 → removed (1) and `ONBOARDING_DROP_SCALE` → 1. Then 85 bodies × about 1.1 mats × 0.75 ≈ 70 mats, against 71 measured on seed 777 today. `ONBOARDING_XP_MULT[0]` 1.7 and `ONBOARDING_LEVEL_FLOOR` 6 stay. The level 6–7 exit has to be re-measured on seeds 777 and `0xa11ce`.
- **Pickup count:** add a ground-blob cap with merge (Brotato caps 50 blobs on the ground and merges [cited]). Suggested `PICKUP_BLOB_CAP` 60. Without it, about 300 kills on map 5 leave hundreds of pickups.
- A later progression pass may let levels come faster, following Brotato's "about one level a wave". That is out of scope here.

---

## 4. Constant changes (from → to) [estimate; the engineer back-solves raw values]

Effective rate = raw × `coopSpawn` (solo 1.15) × `spawnBudgetMult` (1.25) = raw × 1.4375 solo.

| Constant | File:line | From | To |
|---|---|---|---|
| `waveConfig` dur | `js/arenas.js:336` | `round(60 + 5·depth + 5·region)` | `min(60, round(30 + 7.5·depth + 5·(region−1)))` (sieges unchanged) |
| `waveConfig` r0 | `js/arenas.js:350` | `(0.5 + 0.25(reg−1))·onb·count` | `(1.11 + 0.28·depth)·(1 + 0.15(reg−1))` |
| `waveConfig` r1 | `js/arenas.js:351` | `(1.2 + 0.55(reg−1) + 0.18·depth)·onb·count` | `(2.78 + 0.56·depth)·(1 + 0.15(reg−1))` |
| `HORDE_RATE_TUNE` (map 1 r0 and r1) | `js/arenas.js` (new) | — | **×1.45**, about 120 spawned on map 1 (ruled 2026-11-02, Designer; density is the bar; revisit after §12) |
| `ONBOARDING_RATE` | `js/arenas.js:209` | [1, 0.75, 1] | remove (all 1) |
| `ONBOARDING_XP_MULT` | `js/arenas.js:251` | [1.7, 1.35, 1] | [1.7, 1, 1] (re-measure [0]) |
| `ONBOARDING_WAVE_SCALE` / `_DROP_SCALE` | `js/arenas.js:278-279` | 0.6 / 1.667 | remove (1 / 1) |
| `ONBOARDING_ALIVE_CAP` | `js/arenas.js:269` | 25 | 60 |
| `ONBOARDING_WARDEN_CAP` | `js/arenas.js:268` | 8 | 4 (now "map-1 special cap") |
| `ONBOARDING_CEDAR_WEIGHT` | `js/arenas.js:262` | 1.5 | **1.0** (ruled 2026-11-02, Designer; 0.6 was 7.4% of map-1 draws, under the 8% floor; 1.0 is about 12%) |
| `ONBOARDING_CEDAR_WINDUP_MULT` | `js/arenas.js:319` | 1.5 | 1.5 (keep) |
| NEW `HORDE_ALIVE_CAP` (solo, per horde room) | `js/config.js` near :227 | — (only 300 global) | 120, scaled like map 1's cap |
| `ALIVE_CEILING` | `js/config.js:227` | 300 | 300 (keep, as the co-op ceiling) |
| `SPAWN_BANK_CAP` | `js/config.js:228` | 45 | 60 (one extra pack of backlog at the cap) |
| NEW `PACK_MIN` / `PACK_MAX` / `PACK_SPREAD` | `js/config.js` | — | 4 / 8 / 70 u. `_tickWave` spends `acc` in pack-sized chunks at one `_spawnWavePos` centre |
| NEW `FIRST_PACK_T` | `js/config.js` | — (first spawn about 2–3 s) | 1.0 s (seed `acc` with one pack at t = 0.3) |
| Ring spawn R / min distance | `js/game.js:1241,1246` | 640–820 / 520 | 500–640 / 420 |
| NEW wave-end fodder cull | `_tickWave` / `_spawningStopped` | the fight runs until the field is empty | at `w.t ≥ dur`, fodder dies with loot and magnets in. Specials and elites then chase hard for 3 s, and survivors are culled with loot. Bosses, pylons and landmarks are exempt (ruled 2026-11-02, Designer; tail ≤ 5 s) |
| `STRAGGLER_CULL_S` / `_CULL_ALIVE` | `js/config.js:252,258` | 20 s / 8 | horde maps: replaced by the 3 s post-timer chase and cull of specials and elites (ruled 2026-11-02, Designer). The slow curve (region 2 for now) keeps 20 s / 8 |
| NEW `hordeYieldScale` (fodder drop chance) | `js/arenas.js` | — (100%) | `oldTotal/newTotal` per region and depth |
| NEW `PICKUP_BLOB_CAP` | `js/config.js` | — | 60, merging value into the nearest blob |
| `BASE_SPEED` | `js/config.js:37` | 300 | 300 (unchanged, see §3) |
| pnw_thornhound | `enemies-pnw.js:107` | hp 6, spd 220, w 2.8 | hp 3, spd 245, w 3.5 (fast fodder) |
| pnw_sapling | `enemies-pnw.js:72` | hp 7, spd 108, behavior warden + telegraph, w 3.0 | hp 3, spd 170, behaviour → chaser fodder, **no telegraph**, w 4.0 |
| pnw_cedar_warden | `enemies-pnw.js:90` | hp 7, spd 140, w 2.6 | hp 8, spd 150, w 0.9 (special, keeps the lane telegraph) |
| pnw_mistwalker | `enemies-pnw.js:112` | hp 10, spd 95, w 1.6 | **hp 3** (ruled 2026-11-02, Designer; hp 4 is live 5.2 on map 1, over the Rip packet of 4), spd 165, w 1.0 (ranged fodder, cap about 8 alive) |
| pnw_bark_hulk / pnw_elk | `enemies-pnw.js:129,140` | as is | as is (landmarks) |
| `MIN_TELEGRAPH_WEIGHT` | `regions-enemies.js:25` | ≥ 0.5 | band 0.08–0.25 (`MIN_`/`MAX_TELEGRAPH_WEIGHT`) |
| `eliteCountMult` / `eliteHeavyShare` | `js/nodebehaviour.js:25,33` | 0.55 / 0.75 | 0.7 / 0.25 (×2.4 HP on champions only) |

The region 2 (Xibalba) roster needs the same fodder/special split. It's out of map-1 scope. *Ruled 2026-11-02 (Designer):* region 2 stays on the slow curve (and the slow-curve gate rules) on the map-1 branch only. It gets its own horde pass before `HORDE_REGIONS` includes it.

---

## 5. Gate conflicts and replacements

| Gate / assertion | What it asserts today | Conflict | Replace with |
|---|---|---|---|
| `roster_weight_gate` **A** | telegraph weight ≥ 50% | Horde rosters sit at 8–25% | **A′:** 8% ≤ telegraph weight ≤ 25%, at least 2 telegraph shapes per region |
| `roster_weight_gate` **B** | weighted mean HP 7.9 / dmg 3.45, ±15% (floor-1 parity) | The fodder mean falls to about 4 | **B′:** role bands. Fodder live map-1 HP ≤ the weakest rank-1 opener packet. Specials 2–4× fodder HP. Landmarks ≥ 6× fodder HP. A separate fodder contact-damage band. The no-band-scaling-inside-a-roster rule is kept |
| `roster_weight_gate` **C** | ≥ 2 telegraphers below median HP | Telegraphers are now above fodder by design | **C′:** every telegrapher's HP is above fodder max, and at least one telegrapher is ≤ 3× fodder HP (the teachable special) |
| `roster_weight_gate` **D** | light-telegrapher punish 6–9% of vitality | Mostly compatible | Apply to specials. **Band stays 6–9% for now (ruled 2026-11-02, Designer, §11.5)**; the 8–15% re-band floated here is withdrawn, plus a fodder swarm check: 6 fodder in contact for 1 s ≤ 15% of level-anchor vitality [estimate] |
| `roster_weight_gate` **E** | landmark > 2× median HP at w < 0.3 | Compatible (the median falls) | Keep |
| `regions-enemies.js` load rule 2 | `MIN_TELEGRAPH_WEIGHT` 0.5 | Same as A | Band 0.08–0.25 |
| `regions-enemies.js` rules 1 / 3 | committing behaviours telegraph, chaff doesn't | Compatible, but the sapling (fodder) has `warden` behaviour | Keep the rules and move the sapling to a chaff behaviour. Optionally rename `COMMITTING_BEHAVIORS` to "special behaviours" |
| `nodebehaviour.js` `assertNodeBehaviour` (elite) | elite count < 1, HP > 1, gold > 1, elite population more telegraphing than baseline | Compatible in direction. The heavy share of 0.75 makes elite rooms slab rooms | Keep the assertions and change the tuning (§4). Add: an elite room still meets the §3 median-alive bar at ×0.7 |
| `opener_gate` | two hits kill every map-1 body (bodies hard-coded at 8 / 9 / 9 HP) | Too weak for the horde. HP is hard-coded | **One hit kills every map-1 fodder body. ≤ 4 hits kill the map-1 special. A plague cast kills a fodder body.** Read the bodies from `_onboardingTable()` and roles from the roster |
| NEW `pack_clear_gate` | — | No gate sees pack clear | Rank-1 opener on a 12-pack of live map-1 fodder: ≥ 2.0 kills/s for every class (today 0.6–4.4). At level 12 / 4 slots, kill rate on a 30-pack within ±40% of the roster median |
| `tree_dps` | ±60% within class, immortal single ring on map 1 (`--mortal` as cross-check) | Single-target output can't see horde clear | Keep for bosses. Make `--mortal` with a **pack** ring at the new fodder HP the primary horde reading |
| `sim_test` §10 DPS gate | ±40% of roster median DPS | Same blind spot | Keep, and add the pack-kill-rate band alongside it |
| `sim_test` Bastion ratio / camper-death figures | camper ×1.5 longer in Bastion, dies at 74–82 s in region 1 | Measured at 58% density | Re-measure on the new curve. The ratio rule can stay |
| `straggler_test` | after spawning stops, chase at 4 s, cull at 20 s once ≤ 8 alive | Fodder is culled at the timer | Rewrite: at the timer, fodder dies with loot and is not credited. The 4 s chase and 20 s cull apply to specials only. Bosses and pylons stay exempt |
| `region_test` onboarding | `ONBOARDING_WAVE_SCALE` 0.6 and 47–55 spawned in 65 s. Caps 25 / 8. Cedar weight 1.5. Map 2 has 75%. XP mult [1.7, 1.35]. Level 6–7 exit on 777 / `0xa11ce` | Every constant changes | Assert **75–95 spawned in 30 s**, caps 60 / 4, cedar weight 0.6, no map-2 step, XP mult [1.7, 1, 1]. **Keep** the level 6–7 / 3-slot outcome and the cedar wind-up 630/420 checks |
| `region_wire_gate` #2 | a depth > 1 node spawns a region-only id | Compatible | Keep |
| §8.4 Footing measurements (`footing_grace_test`, sim_test holder / sidestepper) | the trade at 50% density | Density falls to 8–25%. GDD §6.4 says holding then dominates | **Decided 2026-11-02 (user):** Footing becomes a step-off burst (§6.1). Re-run holder / sidestepper / breaker against the burst version |
| `difficulty_gate` | enemy pressure per difficulty, off the onboarding node | Numbers move | Re-baseline, keep the logic |
| `map1_bot` pass bars (Playtester) | clumsy Cascade 19/20 etc. at the old pace | Old pace | See §7 |
| `sim_test` §11 stress | siege ≥ 150 alive, tick ≤ 8 ms | Compatible | Keep. Add a 120-alive horde-room snapshot and wire-size check |

---

## 6. Design questions

1. **Footing (Samurai) at horde density. Decided 2026-11-02 (user): option (b).** The engine is "hold through untelegraphed trash, break for committed zones". At 21% density the old measurement had the holder ahead by ×2.24. Options, none built:
   - (a) Leave Footing and re-measure. If the data says "always hold", report it per §8.4's failure condition.
   - (b) Footing builds while standing and **cashes on the first step**: the stack is spent as a burst when you move, so it's a pack-clear charge rather than a stance to hold.
   - (c) Footing builds from **kills while stationary** and decays on movement, so the stance pays in a crowd.
   - **Decided 2026-11-02 (user): (b).** It turns the engine into pack clear, which is the game's emphasis. Burst damage per stack and radius are tuning for the pace branch.
2. **`bloodprice` / `bloodmire` (region 2)** were tuned against Footing and slow rooms. Re-check them once the pace lands.
3. **Objective nodes** (Nest Purge, Bounty Hunt, Relic Run, Breach) price their rosters off `hordeTotalSpawns` (`objectives.js:110,164`). Their totals scale with the new curve automatically, so a throughput re-check is needed.
4. **Boss maps** stay on their siege structure for now. A horde-pace boss pass comes later.

---

## 7. Suggested Playtester pass bars (new pace)

Use the `map1_bot` kite and the clumsy bot, solo Standard, the default 5 seeds, plus 20-seed clumsy Cascade.
- **Density:** with the timer running, ≤ 2 alive for ≤ 5% of ticks after t = 3 s (today 28–52%). Median alive on map 1 ≥ 10 and on map 3 ≥ 20. Peak alive never above the cap.
- **Opening:** first pack spawns by t ≤ 1.2 s, the first enemy reaches 200 u of the player by t ≤ 3.5 s, and the first kill comes by t ≤ 4 s (today 4.3–4.7 s).
- **Duration:** the fight ends ≤ 5 s after the timer when only fodder remains (today 5–32 s tail).
- **Kill rate:** mean kills/s over the fight ≥ 2.5 on map 1 (today about 0.7) and ≥ 4 on map 3.
- **Survival:** kite bot clears 5/5 on map 1 for every class. Clumsy Cascade clears ≥ 17/20 on map 1 (today 19/20 at the slow pace, which may drop at first, so bank the new number). Report deaths by damage source, because fodder contact damage should be the biggest bucket and the share from telegraph lanes should be small.
- **Progression:** leaving map 1 at level 6–7 with 3 slots on 777 and `0xa11ce`, and region-1 materials within ±15% of today.
- **Feel (subjective, recorded):** "Was I ever waiting for enemies?" (target: never), "Could I find the Cedar Warden lane in the crowd?" (target: yes), and "Did my opener clear packs?" (per class).
- **Co-op:** a 2-browser and a 4-player run with no desync and snapshot wire ≤ about 8 KB per tick at peak.

---

## 8. Performance risk [measured on the box, Node; not a browser]

`tools/perf_probe.mjs` runs N live region-1 enemies around a solo Samurai with skills firing:

| Alive | Sim tick (ms) | Snapshot wire (KB) | Per guest at 15 Hz |
|---|---|---|---|
| 25 | 0.10 | 2.2 | ~33 KB/s |
| 60 | 0.11 | 3.4 | ~51 KB/s |
| 100 | 0.14 | 4.8 | ~72 KB/s |
| 150 | 0.17 | 6.7 | ~100 KB/s |
| 200 | 0.22 | 8.0 | ~121 KB/s |
| 300 | 0.37 | 11.0 | ~165 KB/s |

- **The sim tick is not the risk.** It stays under 0.4 ms at 300 alive, well inside the `sim_test` 8 ms bar.
- **Host upload is a risk.** An 8-player host sends 7 streams. At 120 alive that's about 85 KB/s per guest, roughly 600 KB/s (about 5 Mbit/s) up. At 300 alive it's about 1.15 MB/s (about 9 Mbit/s). Check: WebRTC relay throughput, and whether snapshots should delta-encode or cull enemies by guest viewport.
- **Engineer flag (Game Engineer, 2 Nov 2026):** co-op snapshots send every live enemy to each guest, so 100+ alive multiplies that traffic per guest. Before tuning anything, Engineer will profile frame rate and snapshot size at 100 and 150 enemies so Playtester has numbers for the frame-rate check.
- **Unmeasured (browser):** canvas draw cost of 120–300 sprites plus particles (`POOL_PARTICLES` 900), damage numbers, death pops and pickups on low-end laptops and mobile (`touch.js`). Audio voice spam from many hits and deaths needs a voice cap. Pickups also need checking (hence `PICKUP_BLOB_CAP`). Playtester should run a CDP fps capture (`tools/cdp_harness.mjs`) at 60 / 120 / 200 alive, solo and as a 4-player guest.
- `POOL_ENEMIES` is 320, so the 300 ceiling fits. `POOL_PROJECTILES` (700) needs checking with many spitters plus player bolts.

---

## 9. Hero skill feel at horde pace

Shared rules (GDD §5.10): the rank-1 opener one-shots map-1 fodder. Every class has a way to clear a **pack** by its tier-1 or tier-2 node, using the existing `pierce`/`splash` bolt riders for bolt trees. Every kill visibly pops. Each class clears in its own *shape*, and its engine decides *when* that shape peaks. Engines are from `docs/design/classes/*.md` and GDD §8.3.

- **Samurai (Footing):** wide close-range arcs that already clear packs (4.4 kills/s, the best in the probe). The horde fantasy is wading in and sweeping. Footing pays as a burst on the first step after holding (§6.1b, decided 2026-11-02 (user)). Grit and shield stay only as flat values that don't grow with time stood still (ruled 2026-11-02, Designer, §11.7), a released iaido-style sweep through the crowd, not as standing safety. Distinct shape: the 360° / long-arc cut.
- **Priest (Conviction / judgment marks):** Rebuke one-shots, and marks should **chain-detonate** through a pack on death (a mark kill heals and pops neighbours). Distinct shape: chain reactions spreading outward from one kill, with holy light bursts.
- **Monk (Chi loop):** fast palm combos that cleave (3.2 kills/s). Spending Chi should release a shockwave ring, and Stone Garden traps should be a crowd funnel. Distinct shape: rhythmic close bursts and rings, with the Monk weaving through the horde.
- **Druid (the pack):** Rake one-shots. The fantasy is **your animals versus their horde**: wolves and the pack should hunt fodder on their own, with pounces that scatter packs. Distinct shape: allied bodies carving lanes, so pet count and pet uptime are the clear.
- **Assassin (Killbox):** traps placed inert, detonated by other skills. At horde pace that's ideal: lay a minefield, kite the pack through it and chain it off. Distinct shape: ground detonations triggered by your own path. Shiv needs a small arc so the opener clears.
- **Savage (Cascade):** varied skills firing in a chain shorten every cooldown, so the Savage is the one that **accelerates** into a frenzy of different hits. Rip (packet 4) is the weakest opener and needs fodder HP at or under 4. Distinct shape: escalating cooldown-blur melee, with a visible rank counter.
- **Witch Doctor (Voodoo doll):** damage to one doll mirrors outward. At horde pace the doll should mirror onto **several** nearby bodies or spread a plague cloud, so one designation clears a room. Distinct shape: rot clouds and mirrored hits leaping between bodies.
- **Mage (Crystallize):** gets stronger from being hit. In a horde, getting hit is constant, so Crystalblade becomes a "wade in, get armoured, shatter outward" class. Gravity Well (hazard r150) should pull fodder in for a shard burst. Distinct shape: implosion, then shatter.
- **Blacksmith (Crystal forms):** timed transformations. At horde pace a form should be a **power spike that clears**: hammer quakes, anvil drops, a wide hit radius while transformed. Hammer Blow (1.3 kills/s) needs a quake ring. Distinct shape: the form window as a screen-clearing set piece.
- **Wizard (Domain shift):** Cinder Bolt is single-target (1.3 kills/s), so it needs a `splash` rider (explode on impact). Shifting domain should change the **shape** too (fire splashes, frost pierces in a line, arcane chains), so the shift reads as three ways to clear. Distinct shape: elemental area bursts that change with the shift.
- **Necromancer (Soul tokens):** kills drop tokens and tokens raise skeletons, so a horde is **fuel**. More fodder means a bigger army. Dark Energy Blip (1.0 kills/s) needs pierce. Distinct shape: a snowballing undead tide, with Dark Matter Bomb as the big pop.
- **Bard (Rhythm):** attacking without a gap builds stacks, and in a horde there's always a target, so the challenge moves to holding the beat. Opening Note (1.0 kills/s) needs a pierce or ricochet. Stacks should widen the note into sonic **waves** (cone or ring). Distinct shape: pulsing ring waves on the beat.
- **Sundian (Drench stacks):** drench the room, then `sluice` to cash every stack. That's naturally a pack-clear finisher. Spindrift (1.0 kills/s) needs splash so drench spreads. Distinct shape: tide waves that soak, then one sluice wipe.
- **Hunter (Two bodies / spread):** the slowest pack clear in the probe (0.6 kills/s). Sighting Shot needs pierce (a line shot through a column), and the beast should trample. `spread` should reward a pincer: the hunter and the beast on opposite sides of a pack. Distinct shape: crossfire lanes between two bodies.

**What Art should prioritise from this** (per the Chief of Staff's handoff): death pops and fodder dissolve, then one strong signature effect per class in the shape above (arc, chain, ring, pet trample, trap blast, cloud, shatter, quake, splash, tide, crossfire), then screen-shake and hit-flash tiers.

---

## 10. Files

- `docs/design/pace-spec.md` (this file) and `docs/GDD.md` Draft 12 (the GDD rewrite that goes with it).
- The measuring scripts are `tools/pace_measure.mjs`, `tools/ttk_probe.mjs` and `tools/perf_probe.mjs`; run them from the repo root with `node tools/<name>.mjs` (Node only, no browser or WebSocket needed). Their raw outputs from this session (`pace_measure_out.jsonl`, `ttk_thornhound.tsv`, `ttk_mistwalker.tsv`, `perf.tsv`) are not committed; rerun to regenerate.

---

## 11. Designer rulings on the map-1 build (2026-11-02)

Ruled 2026-11-02 (Designer) on Game Engineer's departures from this spec in `cursor/horde-pace-map1` at `98db2c3`. The user's three decisions (top of file) are unchanged.

1. **Map 1 spawn rate is the §3 curve ×1.45 (about 120 spawned).** *Ruled 2026-11-02 (Designer).* At the raw curve (about 85), the kite bot sat at a median 8–13 alive and 1.9–2.5 kills/s, under the §7 bars. Density is the bar, so the rate moves rather than the bar (`HORDE_RATE_TUNE` 1.45). Revisit after the §12 opener pass: faster openers thin the field, and the multiplier may come back down.
2. **Bastion on horde maps.** *Ruled 2026-11-02 (Designer).* Packs form on the horde ring (R 500–640, at least 420 from any player) in an arc facing the room's front, not at the arena edge. The ×0.65 rate is not applied. Bastion keeps its one-front stream and its bans, and its telegraphing units stay specials. From the edge, the first pack took about 10 s to reach a camper (`map1_bot` seed 10).
3. **Cedar Warden weight on map 1 is 1.0.** *Ruled 2026-11-02 (Designer).* Against the two fodder units' 3.5 + 4.0, that's about 12% of map-1 draws. The spec's 0.6 was 7.4%, under the 8% floor of the special band. The band wins over the constant.
4. **Mistwalker HP is 3 (fodder).** *Ruled 2026-11-02 (Designer).* HP 4 is live 5.2 at map-1 multipliers, over the weakest opener packet (Rip, 4) that §3 makes the fodder rule. All three fodder units now read live 3.9.
5. **Check D stays 6–9% for now.** *Ruled 2026-11-02 (Designer).* The two telegraph numbers measure different things:
   - **The 8–25% band (check A′, GDD §6.4) is a share.** It's the telegraphing fraction of a region's encounter weight (`telegraphWeight`): how often there is something to read. Region 1 measures 15.0% (1.50 / 10.00, three shapes: line, circle, cone).
   - **Check D (`tools/roster_weight_gate.mjs`, `hordeChecks`) is a punish.** For each special (a telegrapher with `w ≥ 0.5`), it divides `telegraph.damage` by the vitality of a character at the region's anchor level, and requires 6–9%. That's how much one missed read costs, not how often a read appears. The Cedar Warden measures 7.5% (6 of 80).
   - The two are independent. A region can sit anywhere in 8–25% with every special inside 6–9%. The ~8–15% re-band floated in §5 is withdrawn until a content pass gives specials harder hits.
   - Caveat, from the gate's own note: the harness never spends banked stat picks, so every anchor resolves to 80 vitality, and D is a flat band rather than a level-scaled one.
6. **Region 2 stays on the slow curve, on this branch only.** *Ruled 2026-11-02 (Designer).* Its roster is still 50%+ telegraphing heavies, which is a wall at horde rates. It gets its own horde pass (fodder plus specials, A′–D, its own pace measurement) before `HORDE_REGIONS` includes it.
7. **Samurai's Footing keeps grit and shield alongside the step-off burst, provided neither scales with time stood still.** *Ruled 2026-11-02 (Designer).*
   - Today both are per stack (`footingShieldPerStack` 4, `footingGritPerStack` 2), so they grow the longer he stands. They become flat values granted while Footing is active.
   - All of the extra payoff for holding comes from stepping off. The stack count buys only the burst (first build: 3-stack minimum, 1.5 damage per stack, radius 70 + 8 per stack).
   - Suggested flat values: about the 3-stack amount (shield 12, grit 6) [estimate]. Tune them on the pace branch.
8. **Map-3 tail: the post-timer chase.** *Ruled 2026-11-02 (Designer).*
   - At the timer, fodder is culled and pays (the user's decision).
   - Specials and elites still alive then chase the party hard for **3 s**. Whatever survives is culled and pays its loot.
   - Bosses, pylons and landmarks are objectives: exempt, and they have to be killed.
   - Target: **the fight ends within 5 s of the timer** on every horde map. This replaces the 4 s chase and 20 s straggler cull on horde maps (GDD §2.6 rule 3).
   - It is also the answer to the measured map-1 tails over 5 s (9 classes, up to 9.8 s for the Mage), which are not an opener problem.

---

## 12. Opener tuning at horde pace (design numbers; nothing built)

**Goal:** with fodder at 4 live HP (3.9 measured), every class's tier-1 opener reaches at least **2.5 kills/s on map 1** and **4 on map 3**, and the floor-1 DPS table stays within **±40%** of the reference median.

**Cooldowns are authored on the 100 ms grid.** Triggers evaluate at 10 Hz (`TRIGGER_TICK_MS` 100, `js/triggers.js:17`), so a 950 or 1150 ms cooldown actually fires at 1000 or 1200.

**Method** (local scratch on `cursor/horde-pace-map1` at `98db2c3`; nothing was pushed to that branch):
- **Overrides:** applied to the live skill objects before each run (cooldown, riders, range). The code was not edited.
- **Map 1:** `tools/map1_bot.mjs`, solo Standard kite bot, default opener with learning, on 16 seeds: 777, 0xa11ce, 424242, 20260728, 99, 1, 2, 3, 31337, 4242, 5, 6, 7, 8, 9 and 10. Kills/s is the bot's own figure: non-culled kills ÷ fight seconds.
- **Map 3:** `tools/pace_measure.mjs --depth=3 --god`, with the character granted level 8 first (the level a map-1 exit at 6–7 reaches map 3 at) [estimate]. It ran on the 6 seeds of 8 tried that have a depth-3 combat node. The figure is kills inside the timer ÷ 45 s, so the tail doesn't dilute it.
- **DPS:** the `sim_test` §10 harness (`measureDps`, 3 slots, four 1e9-HP dummies at 90 u), with the same overrides.
- **Seed effects:** seed 10 is a Bastion room and seed 2 a `cramped_crypt`. They are the low readings for every class, so minima are also given without them.

### 12.1 Bolt openers: the changes

| Class | Opener | Today | Proposed | Map 1 kills/s, mean / worst / worst without seeds 2 and 10 | First kill, worst seed | Map 3 kills/s (lvl 8), mean | Floor-1 DPS vs median |
|---|---|---|---|---|---|---|---|
| Necromancer | Dark Energy Blip | 6 dmg, cd 1000, no riders | **pierce 3**, cd **700** | 0.88 / 0.79 → **2.76 / 2.33 / 2.55** | 2.77 s | 1.59 → **4.32** | −30% → 0% (anchor) |
| Hunter | Sighting Shot | 5 dmg, cd 1100, range 260 | **pierce 4**, cd **700** | 0.97 / 0.86 → **2.79 / 2.24 / 2.54** | 2.77 s | 2.72 → 3.74 | −2% → +16% |
| Bard | Opening Note | 5 dmg, cd 900 | **splash 4 dmg, r 70**, cd **700** | 0.92 / 0.80 → **2.86 / 2.11 / 2.66** | 2.70 s | 2.74 → 3.61 | +17% → +34% |
| Sundian | Spindrift | 6 dmg, cd 1150 (fires at 1200) | **splash 4 dmg, r 60**, cd **1000** | 1.66 / 1.23 → **3.03 / 2.59 / 2.74** | 4.35 → 3.98 s | 4.52 → 4.53 | −8% → −1% |
| Wizard | Cinder Bolt | 7 dmg, cd 950 (fires at 1000), range 250 | **splash 4 dmg, r 60**, range **320**, cd **800** | 2.33 / 1.71 → **2.84 / 2.59 / 2.59** | 4.83 → **3.18 s** | 4.61 → 4.78 | −36% → −26% |

- **Why these shapes** (§9): Necromancer and Hunter pierce, so each shot is a lane through a column. Necromancer's lane feeds soul tokens, and Hunter's is the crossfire lane. Bard, Sundian and Wizard splash, so each shot is a burst on impact: Bard's ring pulse, Sundian's spray that later carries drench, and Wizard's fire burst, which the domain shift should later reshape (fire splash, frost pierce, arcane chain). Splash damage 4 is the fodder one-shot (live 3.9). It is not meant to touch specials meaningfully.
- **Wizard's first-kill fix:** range 250 → 320 lets Cinder Bolt fire as the first pack closes (packs land at 500–640 and converge in about 2.5 s), not after it arrives. Splash forgives the misses on 245 u/s Thornhounds. The worst seed moves from 4.83 s to 3.18 s against the 4 s bar. Engineer's 7 s seed wasn't in this set and should be re-checked with these numbers.
- **Pierce over splash for Necromancer and Hunter, and the cooldown:** pierce 2 or 3 at cd 800 left them at 2.4–2.5 mean. The 700 cooldown is what lifts the worst seeds. Pierce 4 at 800 did no better for the Necromancer (2.57 mean, 1.91 worst).
- **DPS spread:** every class stays inside ±40%. The edges are Druid +34% (untouched), Bard +34% (from cd 900 → 700) and Wizard −26%, up from −36%. The Necromancer is a reference class, so its rise moves the anchor: the median went from 34.5 (Monk) to 34.8 (Necromancer). If the Bard edge needs room, cd 800 with r 70 measured 2.74 mean / 2.15 worst on map 1.

### 12.2 Strike openers: no change this pass

| Class | Opener | Map 1 kills/s, mean / worst / worst without seeds 2 and 10 | First kill, worst seed | Map 3 kills/s (lvl 8), mean |
|---|---|---|---|---|
| Samurai | Cross Guard Cut | 3.00 / 1.84 / 2.57 | 2.92 s | 3.40 |
| Blacksmith | Hammer Blow | 2.93 / 1.74 / 2.68 | 3.32 s | 3.82 |
| Assassin | Shiv | 2.88 / 1.10 / 2.65 | 3.92 s | 3.38 |
| Savage | Rip | 2.87 / 2.00 / 2.40 | 3.32 s | 3.77 |
| Mage | Shardcut | 2.86 / 1.87 / 2.75 | 4.02 s | 4.25 |
| Witch Doctor | Bone Rattle | 2.84 / 1.61 / 2.57 | 3.92 s | 3.55 |
| Priest | Rebuke | 2.81 / 1.46 / 2.50 | 3.72 s | 3.51 |
| Druid | Rake | 2.75 / 1.82 / 2.36 | 2.92 s | 3.42 |
| Monk | Open Palm | 2.68 / 1.44 / 2.37 | 3.12 s | 3.90 |

- **Strike openers already clear packs.** Every mean is over 2.5. The worst seeds (1.1–2.0) are seed 10, the Bastion room, where the field sits at 39–58 alive, so kill capacity rather than supply is the limit, and seed 2. Both are room effects that every class shares.
- **Room fixes come first.** The answer to those seeds is ruling §11.2, then a re-measure on that build. Changing openers to fix two rooms would over-tune the other 14.
- **Mage:** its 4.02 s first kill on seed 2 is the only strike first-kill miss.
- **Cooldown grid:** Spindrift, Shiv, Hammer Blow and Rake at 1150 fire at 1200 anyway. Author them as 1200 so the number on the card is the number that plays. This changes nothing in behaviour.

### 12.3 Map 3

- **At level 8, the 4.0 bar is mostly not an opener question.** Bolt classes after tuning read 3.6–4.8. Strike classes read 3.4–4.3 untouched. One seed is low for every class.
- **Bard and Hunter (3.6 and 3.7) are next.** They need their tier-2 and tier-3 pack answers, per §9: Bard's rhythm stacks widen the note into ring waves, and Hunter's Spotter's Call should pierce. They shouldn't get more opener.
- **Bar ownership:** the map-3 bar stays 4.0. Playtester owns the measurement, and this level-8 harness is an estimate of the arrival level, not a played run.

**Next:**
- Engineer builds these numbers on a branch after sign-off.
- Then re-run `map1_bot` on all 14 classes, plus Engineer's 16 Samurai seeds, and `sim_test` §10.
- Then revisit the ×1.45 map-1 rate (§11.1).
