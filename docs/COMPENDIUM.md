# UNDERVAULT — Compendium

The complete reference for every character, stat, weapon and item in the game.

Generated from the live content modules — 14 characters, 10 stats, 26 weapons, 173 items.
Re-generate with `node tools/gen_compendium.mjs`.

---

## Contents

1. [How a character works](#how-a-character-works)
2. [The ten stats](#the-ten-stats)
3. [Characters](#characters) — all 33, with their traits
4. [Weapons](#weapons) — all 26, by class
5. [Items](#items) — all 146, by rarity
6. [Cursed goods](#cursed-goods)
7. [Reference tables](#reference-tables)

---

## How a character works

Every character is three things:

- **A stat line.** Everyone starts from the same base — **80 Vitality and zero in everything else** — and their listed stats are applied on top. A character with no listed stat for something simply has the base value.
- **A starting weapon.** One weapon at tier I, free; you buy the rest, up to 6 slots. Necromancer is the exception — no starting weapon and no slots, because Necromancer's trait replaces them entirely.
- **One signature trait.** Never replaced, never upgraded, and no two characters share one. The trait is the character. Four traits also change how many weapon slots you get.

Nothing else is fixed. Weapons, items, stat boosts and boons are all bought, found or picked during a run, and any character can end up anywhere.

### Damage, in one paragraph

Damage comes from your **skills**. A skill has a base damage and a cooldown; the damage is multiplied by `1 + Damage/100`, and anything tagged elemental or status is multiplied by `1 + Elemental Damage/100` on top. A skill's cooldown shortens with its own RANK — 3% per rank, down to a floor of 70% of the authored value — and **no stat shortens a cooldown**. Speed buys movement and nothing else.

**Crit chance is Dodge.** Every point of Dodge is half a percent of crit (`CRIT_CHANCE_PER_REFLEX`), so a defensive stat is also the game's only buyable offence-by-chance. Items and traits grant crit on top. Crits deal ×2 by default.

---

## The ten stats

| Stat | In one line | Base |
|---|---|---|
| **Vitality** | Your hit points — how much damage you can take. | 80 |
| **Damage** | Raises all the damage you deal. | 0% |
| **Speed** | How fast you move. | 0% |
| **Defense** | Toughness — shrug off damage and knockback. | 0 |
| **Dodge** | Your chance to dodge a hit completely. | 0% |
| **Recovery** | Makes all healing you receive stronger. | 0% |
| **Summons** | Makes your turrets and drones stronger. | 0 |
| **Elemental Damage** | Empowers burns, chills, lightning and blasts. | 0% |
| **Greed** | Better loot rarity, plus bonus materials each fight. | 0 |
| **Reach** | Longer weapon range and a bigger pickup magnet. | 0 |

### Vitality

Your health pool — at zero you go down. Gaining Vitality also heals you by the amount gained, and some heavy weapons hit harder the more you have.

**How it works:** Max HP directly (`js/game.js:379`). Gaining Vitality grants you the difference as health rather than only raising the ceiling, and every room starts you at full.

**Where you find it:** 2 weapons scale with it (Gravemaul, Serpent Awl) · 25 items grant it · 7 characters carry it on their sheet.

### Damage

A straight boost to every hit from every weapon. The most common damage stat — many weapons also scale with it directly.

**How it works:** A **percentage, not a flat figure** — it multiplies ALL damage you deal by `1 + Damage/100` (`ferocityMult`, `js/skillsim.js:511`). Floored at zero, so even a heavy penalty cannot invert damage into healing.

**Where you find it:** 5 weapons scale with it (Rustcleaver, Gravemaul, Vaultspike, Pebbleshot, Longbarrel) · 41 items grant it · 4 characters carry it on their sheet.

### Speed

Makes you run faster, and nothing else. It does NOT make your skills fire faster — the only thing that shortens a skill's cooldown is ranking up that skill. Positioning is what Speed buys.

**How it works:** **Movement only.** Move speed is `BASE_SPEED × (1 + Speed/100)` (`js/game.js:1842`). It does NOT shorten cooldowns: no stat in the game touches a cooldown, which `js/config.js` states and `econ_gate` measures by rolling a penalty into every stat and counting how often skills fire. Cooldowns shorten with a skill's own RANK instead.

**Where you find it:** 5 weapons scale with it (Twinlash, Stormlance, Threadneedle, Fanblade, Hailburst) · 13 items grant it · 3 characters carry it on their sheet.

### Defense

Reduces every hit you take and makes you harder to push around. A few heavy weapons hit harder the more Defense you have.

**How it works:** Shown as a flat number, **applied on a diminishing curve** — damage taken is `raw × 15 / (15 + Defense)` (`js/game.js:2903`), so 15 Defense halves incoming damage, 45 quarters it, and it never reaches zero. The consequence worth knowing: **+1 Defense at 40 is worth far less than +1 at 0**, and the number on your sheet does not show that. Also resists knockback and pulls.

**Where you find it:** 2 weapons scale with it (Pikefang, Sawsprite) · 14 items grant it · 2 characters carry it on their sheet.

### Dodge

The higher it is, the more often enemy hits simply miss you. Dodging also sets off anything that says "on dodge".

**How it works:** **Two mechanics, and the name only covers one.** It is your percent chance to avoid a hit entirely, capped at 60% — and it is also your crit chance, at half a percent per point (`CRIT_CHANCE_PER_REFLEX`, `js/skillsim.js:529`). A build at the 60 cap therefore carries **30% crit alongside 60% dodge**. Buying "+5% Dodge" also buys +2.5% crit. A dodge additionally fires every "on dodge" effect you own.

**Where you find it:** 2 weapons scale with it (Twinlash, Frostscythe) · 10 items grant it · 1 characters carry it on their sheet.

### Recovery

Every heal — regeneration, life-drain, kill-heals, the rest you catch between rooms — is increased by your Recovery. It does nothing alone; it amplifies the healing your items and traits provide.

**How it works:** Multiplies every heal you *receive*, from any source — regen, lifesteal, kill-heals, room rest (`js/game.js:2162`). Worth nothing on its own; it is an amplifier. It also sizes the Priest's grace shield.

**Where you find it:** 2 weapons scale with it (Serpent Awl, Bogflask) · 9 items grant it · 3 characters carry it on their sheet.

### Summons

Summons and structures deal more damage and survive longer for every point. Only matters if you field turrets, drones or other helpers.

**How it works:** Stored as a flat number but **applied as a multiplier**: summon damage and HP scale by `1 + 0.1 × Summons` (`js/minions.js:141`). Nothing else reads it — it is worth exactly zero to a character with no summons.

**Where you find it:** 4 weapons scale with it (Bolt Turret, Ember Turret, Guard Drone, Sawsprite) · 9 items grant it · 2 characters carry it on their sheet.

### Elemental Damage

Everything elemental — fire, frost, chain lightning, explosions and shockwaves — hits harder and lingers longer. The stat for status-effect builds.

**How it works:** A percentage that multiplies everything tagged elemental or status — burn, chill, chain-lightning, explosions and novas — by `1 + Elemental Damage/100` (`_attuned`, `js/game.js:639`). It does not touch ordinary weapon or skill impact damage; that is Damage's job.

**Where you find it:** 10 weapons scale with it (Emberfang, Frostscythe, Stormlance, Sparkbolt, Cinderspray, Kegbomb, Bogflask, Frostjar, Magmalob, Ember Turret) · 14 items grant it · 4 characters carry it on their sheet.

### Greed

Fortune. Improves the rarity of everything the game offers you, and pays bonus materials every fight you clear. Some weapons and blasts scale with it.

**How it works:** Biases the rarity of every offer you are shown, and pays `floor(Greed/2)` bonus materials per fight cleared (`js/game.js:3471`).

**Where you find it:** 3 weapons scale with it (Gravelmouth, Kegbomb, Magmalob) · 16 items grant it · 2 characters carry it on their sheet.

### Reach

Extends how far your weapons reach and pulls dropped materials to you from further away. Snipers and pickup builds want it.

**How it works:** Adds to skill and weapon range (`js/game.js:2246`) and to your material pickup radius (`js/game.js:3337`). It also widens several class traits that key off it, each at **half** your Reach — the Mage's singularity, the Bard's ensemble radius and the Wizard's Miracle among them.

**Where you find it:** 2 weapons scale with it (Longbarrel, Coilgun) · 7 items grant it · 3 characters carry it on their sheet.

### What Defense is actually worth

Defense is the one stat whose value curves, so it is worth seeing the numbers. Note how each block of 5 buys less than the one before it.

| Defense | Damage taken | Effective HP multiplier |
|---|---|---|
| 0 | 100% | ×1 |
| 5 | 75% | ×1.33 |
| 10 | 60% | ×1.67 |
| 15 | 50% | ×2 |
| 25 | 38% | ×2.67 |
| 40 | 27% | ×3.67 |
| 60 | 20% | ×5 |

Every point is worth *less* than the last, but it never stops helping — and it multiplies with Vitality rather than competing with it.

---

## Characters

All 14, in roster order. The **sheet** is a set of modifiers *added to the base*, not absolute values — Bulwark's "+80 Vitality" means 80 + 80 = 160 HP. Anything not listed sits at base.

### At a glance

| | Character | Roles | Sheet (on top of base) | HP | Starting weapon |
|---|---|---|---|---|---|
| ⛨ | **Blacksmith** | tank, melee | +70 Vitality, +8 Defense, -20% Speed | 150 | Gravemaul |
| ♨ | **Wizard** | status, support | +15% Elemental Damage, +20 Reach, -10% Damage | 80 | Magmalob |
| ⚙ | **Necromancer** | summons | +10 Summons | 80 | *none — see trait* |
| ◐ | **Druid** | economy, summons | +5 Greed | 80 | Fanblade |
| ◈ | **Mage** | ranged, control | +8% Elemental Damage, +30 Reach | 80 | Coilgun |
| ➶ | **Bard** | speed, support | +15% Speed, -10 Vitality | 70 | Twinlash |
| 〜 | **Witch Doctor** | sustain, status | +6% Recovery, +5% Elemental Damage | 80 | Bogflask |
| ⚔ | **Samurai** | melee | +8% Damage, +10 Vitality | 90 | Rustcleaver |
| 𖤓 | **Monk** | dodge, sustain | +12% Dodge, +6% Recovery, +2 Defense | 80 | Twinlash |
| ☽ | **Assassin** | crit, economy | +12% Damage, +8 Greed, -25 Vitality | 55 | Vaultspike |
| ✚ | **Priest** | support, sustain | +8% Recovery, +10 Vitality | 90 | Sparkbolt |
| ⽕ | **Savage** | melee | +10% Damage, +10 Vitality | 90 | Gravemaul |
| ⬡ | **Hunter** | summons, ranged | +5 Summons, +20 Reach | 80 | Pebbleshot |
| ≋ | **Sundian** | status, speed | +10% Elemental Damage, +8% Speed, -10 Vitality | 70 | Pikefang |

### ⛨ Blacksmith

**Roles:** tank, melee  
**Sheet:** +70 Vitality, +8 Defense, -20% Speed *(added to the base sheet)*  
**Starting HP:** 150  
**Starting weapon:** 🔨 Gravemaul — 30 damage every 1.8s, 120 range

**Trait — `crystal_infusion`** *(contactBase 3 · gritPct 0.25 · vitPct 0.05 · hitbox 1.4 · pyriteGrit 2 · quartzAtt 4 · calciteRec 5 · detonateEvery 3 · detonateRadius 90)*

> Crystal Infusion: cannot be pushed, but a far bigger target (hitbox ×1.4). Enemies touching you take 3 + 25% of Defense + 5% of Vitality contact damage. After every fight, infuse one crystal permanently — Iron Pyrite (+2 Defense), Prism Quartz (+4% Elemental Damage) or Celestial Calcite (+5% Recovery). Infusions never cap. Every third Prism Quartz makes your contact damage detonate for attuned damage in a 90 radius.

### ♨ Wizard

**Roles:** status, support  
**Sheet:** +15% Elemental Damage, +20 Reach, -10% Damage *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ◉ Magmalob — 17 damage every 1.9s, 390 range

**Trait — `decree`** *(intervalSec 7 · calamityBase 14 · plagueDps 4 · plagueDur 3 · plagueRadius 120 · miracleHeal 8 · miracleFer 10 · miracleDur 4 · miracleRadius 220)*

> Decree: every 7s (faster with Speed) a Decree fires, alternating, starting with Calamity. Calamity deals 14 attuned damage to every enemy on screen and anything it kills spreads a plague — 4 attuned damage per second for 3s to enemies within 120. Miracle heals 8 and grants +10% Damage for 4s to every ally within 220 + half your Reach.

### ⚙ Necromancer

**Roles:** summons  
**Sheet:** +10 Summons *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** none

**Trait — `bonelord`** *(mounts 4 · boneDustRadius 200 · boneDustRepair 6 · marrownautGritShare 1 · marrownautVitShare 0.5)*

> Bonelord: no weapons — 4 summon mounts instead. Summons inherit 100% of your stats on top of Summons, combine in the shop, and can be picked up (E) and redeployed. Enemies dying within 200 drop bone-dust that repairs your most damaged summon by 6 HP. Combine all four mounts into one and it becomes the Marrownaut: while it stands you gain 100% of its Defense and 50% of its Vitality.

### ◐ Druid

**Roles:** economy, summons  
**Sheet:** +5 Greed *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ☰ Fanblade — 9 damage every 1.05s, 340 range

**Trait — `wildshape`** *(offers 3 · permanentAt 3 · boonMult 2 · greedPerFusion 1 · qualityGreedScale 1.5)*

> Wildshape: entering every fight, pick 1 of 3 splices for that battle — better offers the more Greed you carry. Any splice taken 3 times fuses permanently, and every permanent fusion also grants +1 Greed.

### ◈ Mage

**Roles:** ranged, control  
**Sheet:** +8% Elemental Damage, +30 Reach *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ≡ Coilgun — 21 damage every 1.4s, 560 range

**Trait — `singularity`** *(everyNth 9 · pullDur 1.5 · pullRadius 110 · pullSpd 200 · burstBase 16 · vulnPct 25 · vulnDur 1.5 · crystalRange 90 · crystalGrit 5 · crystalPer 0.06 · crystalCap 10)*

> Singularity: every 9th attack collapses a singularity where it lands — enemies within 110 + half your Reach are dragged in for 1.5s, then it bursts for 16 attuned damage. Anything caught inside takes +25% damage from every source, allies included. Crystalblade: while an enemy is within 90 you gain +5 Defense and singularities form on you instead of on the target.

### ➶ Bard

**Roles:** speed, support  
**Sheet:** +15% Speed, -10 Vitality *(added to the base sheet)*  
**Starting HP:** 70  
**Starting weapon:** 〰 Twinlash — 6 damage every 0.42s, 95 range

**Trait — `rhythm`** *(windowSec 1.5 · maxStacks 10 · tempoPer 4 · ferPer 3 · ensembleRadius 160 · ensembleShare 0.5 · soloMult 2)*

> Rhythm: keep attacking with no gap longer than 1.5s and stacks build to 10, each worth +4% Speed and +3% Damage. Miss the window and every stack drops at once. Ensemble: with an ally within 160 + half your Reach they receive half your stack bonuses. Alone, your own bonuses are doubled instead.

### 〜 Witch Doctor

**Roles:** sustain, status  
**Sheet:** +6% Recovery, +5% Elemental Damage *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ⌘ Bogflask — 10 damage every 1.6s, 380 range

**Trait — `voodoo_link`** *(mirrorPct 0.35 · bindRange 900 · stitchTargets 2 · stitchRadius 150 · stitchDur 3 · deathHealPct 0.05 · dollPer 0.05 · dollCap 10)*

> Voodoo Link: the nearest enemy is bound to your doll and rebound whenever it dies or drifts away. 35% of all damage you deal to anything is mirrored onto the bound enemy through walls and across the map. When it dies the link stitches to 2 more enemies within 150 for 3s, and you heal for 5% of everything that enemy took while bound.

### ⚔ Samurai

**Roles:** melee  
**Sheet:** +8% Damage, +10 Vitality *(added to the base sheet)*  
**Starting HP:** 90  
**Starting weapon:** ⚔ Rustcleaver — 12 damage every 0.8s, 105 range

**Trait — `three_stances`** *(ironGrit 6 · ironRefundPct 0.2 · precisionBleedDur 4 · precisionBleedFerScale 0.15 · flowTempoPer 8 · flowMax 5 · swapCooldown 0.5)*

> Three Stances: swap freely (Q, or the stance button on touch) with a half-second cooldown. IRON — +6 Defense, and a fifth of everything your Defense absorbs is banked onto your next attack. PRECISION — your first hit on any enemy crits and bleeds it for 4s at 15% of your Damage per second. FLOW — every consecutive hit on a NEW enemy grants +8% Speed up to 5 stacks; hitting the same enemy twice in a row resets it.

### 𖤓 Monk

**Roles:** dodge, sustain  
**Sheet:** +12% Dodge, +6% Recovery, +2 Defense *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** 〰 Twinlash — 6 damage every 0.42s, 95 range

**Trait — `karma`** *(karmaCap 40 · karmaPct 1 · spiritDur 3 · spiritFactor 0.5 · spiritRegen 2)*

> Karma: damage you take is stored, up to 40, and your next attack releases all of it as bonus damage. Astral Projection: dodging leaves a spirit at your feet for 3s that copies every attack you make at half damage and regenerates 2 HP per second while it stands. Dodging again refreshes it rather than spawning a second.

### ☽ Assassin

**Roles:** crit, economy  
**Sheet:** +12% Damage, +8 Greed, -25 Vitality *(added to the base sheet)*  
**Starting HP:** 55  
**Starting weapon:** ☨ Vaultspike — 9 damage every 0.65s, 120 range

**Trait — `contract`** *(payoutBase 5 · payoutGreedScale 1 · ferPerContract 15 · payoutsPerRoom 3 · openerCritMult 3 · vanishDur 1.2 · remarkDelay 3)*

> Contract: one enemy per fight is marked — an elite or boss if there is one, otherwise the healthiest thing alive. Killing it pays 5 + your Greed in materials and grants +15% Damage for the rest of the fight, stacking with every contract closed. A new mark appears 3s later. You also never crit at random: granted crits deal ×3, your first hit on any full-health enemy is always a crit, and every kill makes you untargetable for 1.2s.

### ✚ Priest

**Roles:** support, sustain  
**Sheet:** +8% Recovery, +10 Vitality *(added to the base sheet)*  
**Starting HP:** 90  
**Starting weapon:** ϟ Sparkbolt — 9 damage every 0.95s, 440 range

**Trait — `grace_and_judgment`** *(graceThreshold 25 · shieldBase 12 · shieldRecScale 1 · reflectPct 0.3 · reviveBoost 0.5 · partyVitPerRevive 3 · targetRadius 200)*

> Grace and Judgment: every point of healing you cause, to anyone, becomes Grace. At 25 it spends itself — shielding the most injured ally within 200 + half your Reach (or you, alone) for 12 scaled by Recovery, and smiting the nearest enemy for attuned damage equal to that shield. Shields reflect 30% of what they absorb back at the attacker. You revive 50% faster, and every revive grants the whole party +3 permanent Vitality.

### ⽕ Savage

**Roles:** melee  
**Sheet:** +10% Damage, +10 Vitality *(added to the base sheet)*  
**Starting HP:** 90  
**Starting weapon:** 🔨 Gravemaul — 30 damage every 1.8s, 120 range

**Trait — `blood_dance`** *(heatPer 8 · heatMax 120 · heatDecaySec 3 · bloodPerMissing 0.8 · leechPct 0.08 · heavyBonus 0.15 · heavyCd 1.5)*

> Blood Dance: every attack that connects grants +8% Damage up to +120%, and all of it falls off 3s after your last connecting hit. On top of that: +0.8% Damage for every 1% of health you are missing, 8% of all damage you deal comes back as healing, and any weapon with a base cooldown of 1.5s or longer hits 15% harder.

### ⬡ Hunter

**Roles:** summons, ranged  
**Sheet:** +5 Summons, +20 Reach *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** • Pebbleshot — 10 damage every 0.65s, 420 range

**Trait — `pack_tactics`** *(freeBeastPerFloor 1 · maxBeasts 4 · alphaRadius 120 · beastDmg 4 · beastCd 1.2 · alphaMinBeasts 2 · alphaFer 20 · alphaTempo 10 · marksmanRadius 250 · marksmanPierce 1 · marksmanDmgPerBeast 8)*

> Pack Tactics: a free beast joins you at the start of every floor, up to four. ALPHA — with 2 or more beasts within 120 of you, you and every beast gain +20% Damage and +10% Speed. MARKSMAN — with no beast within 250 of you, your shots pierce one more target and hit 8% harder per living beast. A beast combined in the shop counts as two.

### ≋ Sundian

**Roles:** status, speed  
**Sheet:** +10% Elemental Damage, +8% Speed, -10 Vitality *(added to the base sheet)*  
**Starting HP:** 70  
**Starting weapon:** ↟ Pikefang — 14 damage every 0.95s, 170 range

**Trait — `coral_growth`** *(everyNth 4 · nodeDur 8 · nodeRadius 60 · nodeSlowPct 35 · nodeDps 5 · nodeCap 8 · linkRange 100 · wallHp 40 · dashRefreshTempo 15 · dashRefreshDur 2)*

> Coral Growth: every 4th attack plants a coral node where it lands, for 8s. Nodes slow enemies within 60 by 35% and burn them for 5 attuned damage a second. Two nodes within 100 of each other grow a coral wall with 40 HP that stops enemies and their shots — but never yours. Walking through your own node refreshes it and grants +15% Speed for 2s. Eight nodes at once, no more.

---

## Weapons

All 26, grouped by class. Every number shown is **tier I**; tiers multiply damage by I ×1, II ×1.6, III ×2.5, IV ×3.9.

**Two** copies of the same weapon at the same tier combine into one of the next tier, for free — automatically when you buy the second one.

### Swing

Arc melee — sweeps a cone in front of you and hits everything inside it.

| | Weapon | Damage | Cooldown | DPS | Range | Knock | Scales with | Extra | Price |
|---|---|---|---|---|---|---|---|---|---|
| ⚔ | **Rustcleaver** | 12 | 0.8s | 15 | 105 | 90 | Damage | 115° arc | 14 ⟡ |
| 🔥 | **Emberfang** | 9 | 0.9s | 10 | 100 | 60 | Elemental Damage | burn 4/s for 2s; 109° arc | 18 ⟡ |
| 🔨 | **Gravemaul** | 30 | 1.8s | 16.67 | 120 | 260 | Vitality + Damage | 149° arc | 22 ⟡ |
| 〰 | **Twinlash** | 6 | 0.42s | 14.29 | 95 | 30 | Speed + Dodge | 69° arc | 16 ⟡ |
| ❄ | **Frostscythe** | 14 | 1.2s | 11.67 | 125 | 80 | Elemental Damage + Dodge | chill to 55% speed for 1.5s; 166° arc | 24 ⟡ |

### Thrust

Line melee — stabs along a narrow lane; some models pierce every body in the line.

| | Weapon | Damage | Cooldown | DPS | Range | Knock | Scales with | Extra | Price |
|---|---|---|---|---|---|---|---|---|---|
| ↟ | **Pikefang** | 14 | 0.95s | 14.74 | 170 | 110 | Defense | 26u wide | 15 ⟡ |
| ☨ | **Vaultspike** | 9 | 0.65s | 13.85 | 120 | 50 | Damage | 20u wide | 18 ⟡ |
| ↯ | **Serpent Awl** | 12 | 0.95s | 12.63 | 200 | 70 | Recovery + Vitality | pierces the whole line; 22u wide | 20 ⟡ |
| ⚡ | **Stormlance** | 11 | 1.1s | 10 | 175 | 60 | Elemental Damage + Speed | chains to 2 more at 60%; 24u wide | 24 ⟡ |

### Single shot

Ranged — one projectile per shot, stopped by the first thing it hits unless it pierces.

| | Weapon | Damage | Cooldown | DPS | Range | Knock | Scales with | Extra | Price |
|---|---|---|---|---|---|---|---|---|---|
| • | **Pebbleshot** | 10 | 0.65s | 15.38 | 420 | 30 | Damage | — | 12 ⟡ |
| ━ | **Longbarrel** | 32 | 1.9s | 16.84 | 640 | 140 | Reach + Damage | pierces 2 | 24 ⟡ |
| ∙ | **Threadneedle** | 4 | 0.22s | 18.18 | 360 | 8 | Speed | — | 16 ⟡ |
| ≡ | **Coilgun** | 21 | 1.4s | 15 | 560 | 60 | Reach | pierces 99 | 26 ⟡ |
| ϟ | **Sparkbolt** | 9 | 0.95s | 9.47 | 440 | 20 | Elemental Damage | chains to 3 more at 50% | 22 ⟡ |

### Spread

Ranged — several projectiles per shot in a fan.

| | Weapon | Damage | Cooldown | DPS | Range | Knock | Scales with | Extra | Price |
|---|---|---|---|---|---|---|---|---|---|
| ⋉ | **Gravelmouth** | 6 | 1.15s | 5.22 | 300 | 70 | Greed | 5 projectiles over 26° | 18 ⟡ |
| ☰ | **Fanblade** | 9 | 1.05s | 8.57 | 340 | 40 | Speed | pierces 1; 3 projectiles over 34° | 20 ⟡ |
| ᎒᎒ | **Hailburst** | 3 | 0.95s | 3.16 | 260 | 20 | Speed | 8 projectiles over 55° | 20 ⟡ |
| 𓂃 | **Cinderspray** | 5 | 1.1s | 4.55 | 250 | 15 | Elemental Damage | burn 3/s for 2s; 4 projectiles over 30° | 22 ⟡ |

### Lobbed

Arcs over walls and detonates in an area. The only class that ignores line of sight.

| | Weapon | Damage | Cooldown | DPS | Range | Knock | Scales with | Extra | Price |
|---|---|---|---|---|---|---|---|---|---|
| ● | **Kegbomb** | 17 | 2s | 8.5 | 420 | 180 | Elemental Damage + Greed | blast radius 110 | 22 ⟡ |
| ⌘ | **Bogflask** | 10 | 1.6s | 6.25 | 380 | 20 | Recovery + Elemental Damage | blast radius 95; leaves a puddle | 24 ⟡ |
| ❆ | **Frostjar** | 12 | 1.8s | 6.67 | 400 | 40 | Elemental Damage | chill to 50% speed for 2s; blast radius 120 | 24 ⟡ |
| ◉ | **Magmalob** | 17 | 1.9s | 8.95 | 390 | 90 | Elemental Damage + Greed | burn 5/s for 2.5s; blast radius 100 | 26 ⟡ |

### Summon

Places a structure that fights on its own. Scales with Summons, not with your weapon stats.

| | Weapon | Structure HP | Damage | Every | Range | Scales with | Price |
|---|---|---|---|---|---|---|---|
| ⌖ | **Bolt Turret** | 40 | 7 | 0.7s | 380 | Summons | 24 ⟡ |
| ♨ | **Ember Turret** | 34 | 5 | 0.85s | 320 | Summons + Elemental Damage | 28 ⟡ |
| ✦ | **Guard Drone** | 30 | 6 | 0.55s | 260 | Summons | 26 ⟡ |
| ✹ | **Sawsprite** | 45 | 10 | 0.5s | 300 | Summons + Defense | 26 ⟡ |

---

## Items

All 173, grouped by rarity. Items are permanent for the run and never combine.

**The tradeoff rule:** commons are clean gains. Roughly half of uncommons, and *every* rare and legendary, also subtract from a stat — always on an opposing axis to what they give, and always spelled out on the item.

### Common — 41 items

0 of them carry a subtraction. Prices run 10–16 ⟡.

| Item | Stats | What it does | Price |
|---|---|---|---|
| **Hardtack Ration** | +5 Vitality | — | 11 ⟡ |
| **Grindstone Chip** | +4% Damage | — | 12 ⟡ |
| **Springwound Cog** | +4% Speed | — | 13 ⟡ |
| **Iron Rivet Plate** | +1 Defense | — | 12 ⟡ |
| **Softsole Boots** | +4% Dodge | — | 12 ⟡ |
| **Cavemoss Salve** | +6% Recovery | — | 10 ⟡ |
| **Tinker's Pliers** | +1 Summons | — | 12 ⟡ |
| **Flintspark Shard** | +4% Elemental Damage | — | 12 ⟡ |
| **Tin Lantern** | +3 Greed | — | 11 ⟡ |
| **Vaultwatch Spyglass** | +12 Reach | — | 11 ⟡ |
| **Copper Band** | +4 Vitality, +4% Recovery | — | 14 ⟡ |
| **Miner's Mitts** | +3% Damage, +2 Greed | — | 14 ⟡ |
| **Fletcher's Kit** | +8 Reach, +3% Damage | — | 14 ⟡ |
| **Embercoal Lump** | +3% Elemental Damage, +3% Damage | — | 15 ⟡ |
| **Rustbitten Charm** | +2 Greed, +6 Reach | — | 13 ⟡ |
| **Padded Jerkin** | +1 Defense, +3 Vitality | — | 14 ⟡ |
| **Quickstep Laces** | +3% Speed, +3% Dodge | — | 14 ⟡ |
| **Servo Winder** | +1 Summons, +3% Speed | — | 14 ⟡ |
| **Chillbottle** | +3% Elemental Damage, +4% Recovery | — | 14 ⟡ |
| **Loadbearer Straps** | +1 Defense, +2 Greed | — | 14 ⟡ |
| **Cavemoss Poultice** | — | Recover 1 HP per second. | 13 ⟡ |
| **Leech Locket** | — | Heal 2% of damage dealt. | 13 ⟡ |
| **Grave Snack** | — | Kills heal 1 HP. | 12 ⟡ |
| **Cornered Rat** | — | +15% Damage while below 35% HP. | 14 ⟡ |
| **Wanderer's Soles** | — | +8% Speed while moving. | 13 ⟡ |
| **Planted Heels** | — | +4 Defense while standing still. | 13 ⟡ |
| **Skirmish Garb** | — | +6% Dodge while moving. | 14 ⟡ |
| **Hermit Wrap** | — | +15% Recovery while no enemy is within 150u. | 13 ⟡ |
| **Fresh Legs** | — | +10% Speed for the first 8s of every fight. | 13 ⟡ |
| **Longwatch Lens** | — | +20 Reach while standing still. | 14 ⟡ |
| **Payload Harness** | — | +2% Damage for each material you stand on (up to 5). | 14 ⟡ |
| **Nervous Fingers** | — | +8% Speed while below half HP. | 13 ⟡ |
| **Scavenger's Instinct** | — | +1 Greed for each material you stand on (up to 8). | 14 ⟡ |
| **Loose Change** | — | 5% chance a picked-up material is worth one extra. | 13 ⟡ |
| **Pitchfire Vial** | — | 15% chance on hit to ignite: 3 dmg/s for 2s. | 14 ⟡ |
| **Frostbite Ring** | — | 15% chance on hit to chill: −40% speed for 1.2s. | 14 ⟡ |
| **Reroll Chit** | — | The first reroll in every shop is free. | 13 ⟡ |
| **Quick Study** | — | +10% XP from materials. | 13 ⟡ |
| **Crooked Ledger** | +5 Greed | +5 Greed, and −3 to one other stat, rolled when you take it. | 15 ⟡ |
| **Butcher's Apron** | +7% Damage | +7% Damage, and −4 to one other stat, rolled when you take it. | 16 ⟡ |
| **Ballast Vest** | +12 Vitality | +12 Vitality, and −4 to one other stat, rolled when you take it. | 16 ⟡ |

### Uncommon — 65 items

30 of them carry a subtraction. Prices run 26–33 ⟡.

| Item | Stats | What it does | Price |
|---|---|---|---|
| **Oxblood Tonic** | +20 Vitality, -3% Speed | Costs you −3% Speed. | 26 ⟡ |
| **Flywheel Gauntlet** | +9% Speed | — | 27 ⟡ |
| **Bulwark Pauldron** | +4 Defense, +6 Vitality, -4% Dodge | Costs you −4% Dodge. | 27 ⟡ |
| **Quicksilver Soles** | +6% Speed, +5% Dodge | — | 28 ⟡ |
| **Vault Servo Core** | +5 Summons, -3% Damage | Costs you −3% Damage. | 27 ⟡ |
| **Ashen Grimoire** | +9% Elemental Damage, +3 Greed | — | 26 ⟡ |
| **Ratcatcher's Elixir** | +8 Greed, +5% Recovery, -3% Damage | Costs you −3% Damage. | 30 ⟡ |
| **Surveyor's Array** | +20 Reach, +4% Damage | — | 26 ⟡ |
| **Whetstone Wheel** | +11% Damage, -3% Speed | Costs you −3% Speed. | 27 ⟡ |
| **Sistered Plates** | +2 Defense, +4% Dodge | — | 27 ⟡ |
| **Assembler's Manual** | +4 Summons, +3 Greed, -3% Damage | Costs you −3% Damage. | 28 ⟡ |
| **Deepmoss Compress** | — | Recover 2 HP per second. | 28 ⟡ |
| **Bloodgroove Blade** | +7% Damage, -3% Speed | Heal 4% of damage dealt. Costs you −3% Speed. | 28 ⟡ |
| **Butcher's Bill** | +6 Vitality | Kills heal 2 HP. | 29 ⟡ |
| **Bandolier of Salves** | +5% Recovery, -1 Defense | Heal 10 HP at every fight clear. Costs you −1 Defense. | 27 ⟡ |
| **Sugarrock Shard** | — | 15% chance to heal 1 HP when picking up a material. | 26 ⟡ |
| **Brawler's Knuckle** | +3% Damage, -3% Speed | +25% Damage while an enemy is within 60u. Costs you −3% Speed. | 28 ⟡ |
| **Sniper's Discipline** | — | +20% Damage while no enemy is within 150u. | 28 ⟡ |
| **Clean Bill of Health** | +3% Damage, -3% Speed | +20% Damage while above 90% HP. Costs you −3% Speed. | 27 ⟡ |
| **Adrenal Gland** | — | +12% Speed for 3s after a kill. | 28 ⟡ |
| **First Blood Pennant** | +3% Damage, -3% Speed | Costs you −3% Speed. | 27 ⟡ |
| **Doorbreaker Charm** | — | +15% Damage for the first 10s of every fight. | 27 ⟡ |
| **Phalanx Badge** | +3% Damage, -3% Speed | +4 Defense while an ally is within 150u. Costs you −3% Speed. | 26 ⟡ |
| **Dragon's Bed** | — | +2 Defense for each material you stand on (up to 10). | 29 ⟡ |
| **Duelist's Veil** | +3% Damage, -3% Speed | +10% Dodge while an enemy is within 60u. Costs you −3% Speed. | 28 ⟡ |
| **Triage Tabard** | — | +25% Recovery while below half HP. | 27 ⟡ |
| **Bloodscent Locket** | +3% Damage, -3% Speed | +12% Damage for 3s after a kill. Costs you −3% Speed. | 28 ⟡ |
| **Emberstoked Bellows** | — | +12% Elemental Damage while an enemy is within 90u. | 27 ⟡ |
| **Caravan Flag** | +3% Damage, -3% Speed | +8% Speed while an ally is within 150u. Costs you −3% Speed. | 26 ⟡ |
| **Vault Compass** | — | +5 Greed for the first 10s of every fight. | 27 ⟡ |
| **Ironblood Draught** | +3% Damage, -3% Speed | +3 Defense while above 75% HP. Costs you −3% Speed. | 27 ⟡ |
| **Boneset Splint** | — | +3 Defense and +10% Recovery while below 60% HP. | 28 ⟡ |
| **Headsman's Memento** | +3% Damage, -3% Speed | Your first attack after a kill crits. Costs you −3% Speed. | 29 ⟡ |
| **Tenth-Strike Tally** | — | Every 10th attack crits. | 28 ⟡ |
| **Opener's Oath** | +3% Damage, -3% Speed | Your first attack in every fight crits. Costs you −3% Speed. | 26 ⟡ |
| **Red Ribbon Salve** | — | Critical hits heal 2 HP. | 27 ⟡ |
| **Matador's Cape** | +2% Speed, -1 Defense | After a dodge, your next attack deals +50% damage. Costs you −1 Defense. | 28 ⟡ |
| **Sparkdust Pouch** | — | Picking up a material detonates it for 6 attuned damage (radius 70). | 28 ⟡ |
| **Greedwind Charm** | +2 Greed, -3% Damage | Picking up a material grants +10% Speed for 2s (stacks 3×). Costs you −3% Damage. | 27 ⟡ |
| **Magpie's Eye** | — | 8% chance a picked-up material is worth one extra. | 28 ⟡ |
| **Wick and Tallow** | +4% Elemental Damage, -3% Damage | 25% chance on hit to ignite: 4 dmg/s for 2s. Costs you −3% Damage. | 28 ⟡ |
| **Glacier Salt** | — | 25% chance on hit to chill: −45% speed for 1.5s. | 28 ⟡ |
| **Galvanic Coil** | +4% Elemental Damage, -3% Damage | 20% chance on hit to arc 8 attuned damage to a nearby enemy. Costs you −3% Damage. | 29 ⟡ |
| **Kindler's Manual** | +4% Elemental Damage | Your burns, chills, chains and blasts are 15% stronger. | 28 ⟡ |
| **Rallying Horn** | +8 Vitality, -3% Speed | Allies within 150u gain +8% Damage. Costs you −3% Speed. | 28 ⟡ |
| **Chirurgeon's Censer** | — | Allies within 150u gain +15% Recovery. | 28 ⟡ |
| **Drillmaster's Whistle** | +8 Vitality, -3% Speed | Allies within 150u gain +6% Speed. Costs you −3% Speed. | 28 ⟡ |
| **Thorncoat** | +1 Defense | Attackers take 4 damage when they hit you. | 27 ⟡ |
| **Cinder Cloak** | +1 Defense, -4% Dodge | Enemies within 80u smolder for 4 damage per second. Costs you −4% Dodge. | 29 ⟡ |
| **Slaughter Rhythm** | — | Kills grant +8% Speed for 3s (stacks 4×). | 29 ⟡ |
| **Powder Charges** | +3% Damage, -3% Speed | 20% chance for kills to detonate: 10 attuned damage within 80u. Costs you −3% Speed. | 29 ⟡ |
| **Drillbit Rounds** | — | Your projectiles pierce +1 enemy. | 28 ⟡ |
| **Rambounce Pads** | +3% Damage, -3% Speed | Your knockback is 50% stronger. Costs you −3% Speed. | 26 ⟡ |
| **Coin of Return** | — | Earn 5% interest on held materials at each fight clear (max 10). | 28 ⟡ |
| **Haggler's Tongue** | +2 Greed, -3% Damage | Shop prices −10%. Costs you −3% Damage. | 27 ⟡ |
| **Archivist's Folio** | +3 Greed | Level-ups offer 1 extra choice. | 29 ⟡ |
| **Growth Chart** | +8 Vitality, -3% Speed | +2 permanent Vitality on every level-up. Costs you −3% Speed. | 28 ⟡ |
| **Medic's Satchel** | — | You revive allies 50% faster. | 27 ⟡ |
| **Foreman's Manual** | +2 Summons, -3% Damage | Your summons deal +20% damage and have +20% HP. Costs you −3% Damage. | 28 ⟡ |
| **Gambler's Cuff** | +9% Dodge | +9% Dodge — dodge and crit both — and −5 to one other stat, rolled when you take it. | 26 ⟡ |
| **Thaumic Shunt** | +12% Elemental Damage | +12% Elemental Damage, and −6 to one other stat, rolled when you take it. | 28 ⟡ |
| **Boneglass Lens** | +6 Summons | +6 Summons, and −4 to one other stat, rolled when you take it. | 27 ⟡ |
| **Giant's Follow-Through** | — | Knockback riders push 60% further. | 30 ⟡ |
| **Emberwick Thread** | — | 20% of hits set the target burning for 7 damage a second over 3s. | 32 ⟡ |
| **Hoarfrost Shim** | — | 22% of hits chill the target to 65% speed for 2s. | 33 ⟡ |

### Rare — 38 items

27 of them carry a subtraction. Prices run 46–66 ⟡.

| Item | Stats | What it does | Price |
|---|---|---|---|
| **Heartstone Core** | +40 Vitality, +8% Recovery, -8% Speed | Costs you −8% Speed. | 52 ⟡ |
| **Warcaster's Sigil** | +22% Damage, +6% Elemental Damage, -8% Speed | Costs you −8% Speed. | 55 ⟡ |
| **Stormheart Metronome** | +21% Speed, -3 Defense | Costs you −3 Defense. | 54 ⟡ |
| **Adamant Aegis** | +8 Defense, +8 Vitality, -9% Dodge | Costs you −9% Dodge. | 52 ⟡ |
| **Prism Lens Array** | +24% Elemental Damage, +12 Reach, -8% Damage | Costs you −8% Damage. | 54 ⟡ |
| **Magnate's Ledgerstone** | +17 Greed, +6 Vitality, -8% Damage | Costs you −8% Damage. | 56 ⟡ |
| **Ghostweave Cloak** | +15% Dodge, +4% Speed, -14 Vitality | Costs you −14 Vitality. | 54 ⟡ |
| **Foundry Heart** | +9 Summons, +6 Vitality, -8% Damage | Costs you −8% Damage. | 55 ⟡ |
| **Aegis Coil** | +3 Defense, -9% Dodge | Blocks one hit entirely, then recharges for 6s. Costs you −9% Dodge. | 55 ⟡ |
| **Regicide Edge** | +8% Damage, -8% Speed | +25% Damage during the Siege. Costs you −8% Speed. | 54 ⟡ |
| **Executioner's Hood** | +8% Damage, -8% Speed | +20% Elemental Damage during the Siege. Costs you −8% Speed. | 52 ⟡ |
| **Deadline Chronometer** | +8% Damage, -8% Speed | Costs you −8% Speed. | 53 ⟡ |
| **Warcamp Standard** | +8% Damage, -8% Speed | +10% Damage while an ally is within 180u. Costs you −8% Speed. | 54 ⟡ |
| **Overcharged Core** | +8% Damage, -8% Speed | +15% Speed and +10% Damage while above 90% HP. Costs you −8% Speed. | 56 ⟡ |
| **Rimeheart Prism** | +8% Damage, -8% Speed | Attacks against chilled enemies crit. Costs you −8% Speed. | 55 ⟡ |
| **Pyre Sight** | +8% Damage, -8% Speed | Attacks against burning enemies crit. Costs you −8% Speed. | 55 ⟡ |
| **Assassin's Primer** | +8% Damage, -8% Speed | Attacks against full-HP enemies crit. Costs you −8% Speed. | 54 ⟡ |
| **Detonation Tithe** | +7 Greed, -8% Damage | Picking up a material detonates it for 12 attuned damage (radius 90). Costs you −8% Damage. | 54 ⟡ |
| **Stormbinder Loop** | +10% Elemental Damage, -8% Damage | 30% chance on hit to arc 14 attuned damage; statuses 10% stronger. Costs you −8% Damage. | 56 ⟡ |
| **Standard of the Vault** | +20 Vitality, -8% Speed | Allies within 170u gain +6% Damage and +2 Defense. Costs you −8% Speed. | 56 ⟡ |
| **Lodemother's Chime** | +7% Speed, -3 Defense | You revive allies 50% faster; allies within 140u gain +10% Recovery. Costs you −3 Defense. | 55 ⟡ |
| **Bulette Plating** | +3 Defense, -9% Dodge | Taking a hit releases an attuned nova: 12 damage within 110u. Costs you −9% Dodge. | 55 ⟡ |
| **Gravedigger's Pact** | +20 Vitality, -8% Speed | Kills grant +1 permanent Vitality (up to +30 per run). Costs you −8% Speed. | 56 ⟡ |
| **Giantsbane Bolt** | +8% Damage, -8% Speed | +25% damage to elites and bosses. Costs you −8% Speed. | 55 ⟡ |
| **Deepvault Compact** | +20 Vitality, -8% Speed | +3 Greed and +4 Vitality at the start of every floor. Costs you −8% Speed. | 55 ⟡ |
| **Doublestrike Ledger** | +7 Greed, -8% Damage | 15% chance for kills to drop double materials. Costs you −8% Damage. | 56 ⟡ |
| **Overclock Governor** | +6 Summons, -8% Damage | Your summons deal +35% damage and have +10% HP. Costs you −8% Damage. | 55 ⟡ |
| **Warden's Yoke** | +7 Defense, +14 Vitality | +7 Defense and +14 Vitality, and −7 to one other stat, rolled when you take it. | 48 ⟡ |
| **Duelist's Promise** | +16% Damage, +8% Dodge | +16% Damage and +8% Dodge, and −8 to one other stat, rolled when you take it. | 52 ⟡ |
| **Awl of the Line** | — | Your bolts pierce 1 extra target. Each upgrade adds 1 more. | 46 ⟡ |
| **Headhunter's Tally** | — | +22% damage to elites and bosses. Each upgrade adds 12%. | 58 ⟡ |
| **Hairline Edge** | — | +8% crit chance on top of Dodge. Each upgrade adds 5%. | 54 ⟡ |
| **Ossuary Harness** | — | Your summons deal +25% damage and have +25% HP. Each upgrade adds 15%. | 50 ⟡ |
| **Arcline Coil** | — | 25% of hits arc to a second enemy within 190 units for 14 damage. | 56 ⟡ |
| **Iron Reading** | — | Your skills also resolve as Physical when that reads better (×1.25 into Spiritual). | 62 ⟡ |
| **The Quiet Argument** | — | Your skills also resolve as Mental when that reads better (×1.25 into Physical). | 62 ⟡ |
| **Second Sight** | — | Bolt skills also strike the highest-HP target in range. | 66 ⟡ |
| **Coup de Grâce** | — | Bolt skills also strike the lowest-HP target in range. | 64 ⟡ |

### Legendary — 19 items

12 of them carry a subtraction. Prices run 88–118 ⟡.

| Item | Stats | What it does | Price |
|---|---|---|---|
| **Second Wind Whistle** | +15% Recovery, -3 Defense | Once per floor: refuse death and stand back up at 50% Vitality. Costs you −3 Defense. | 90 ⟡ |
| **Jester's Own Deck** | +8% Damage, -8% Speed | Every 6th attack crits. Costs you −8% Speed. | 88 ⟡ |
| **Splitting Chamber** | +8% Damage, -8% Speed | Your ranged weapons fire +1 projectile. Costs you −8% Speed. | 95 ⟡ |
| **Vault Sovereign's Crown** | +22 Greed, +10 Vitality, -8% Damage | Costs you −8% Damage. | 96 ⟡ |
| **Worldbreaker Sledge** | +33% Damage, -8% Speed | Costs you −8% Speed. | 95 ⟡ |
| **Chronomancer's Gear** | +27% Speed, +8% Dodge, -3 Defense | Costs you −3 Defense. | 96 ⟡ |
| **Saint's Reliquary** | +45% Recovery, -3 Defense | Recover 1 HP per second. Costs you −3 Defense. | 92 ⟡ |
| **Architect's Omnitool** | +12 Summons, -8% Damage | Your summons deal +25% damage and have +25% HP. Costs you −8% Damage. | 96 ⟡ |
| **Tempest Codex** | +35% Elemental Damage, -8% Damage | Your burns, chills, chains and blasts are 15% stronger. Costs you −8% Damage. | 95 ⟡ |
| **Panoply of the Deep** | +11 Defense, +15 Vitality, -9% Dodge | Costs you −9% Dodge. | 94 ⟡ |
| **Horizon Glass** | +40 Reach, +18% Damage, -8% Speed | Costs you −8% Speed. | 93 ⟡ |
| **Banner of the Last Stand** | +20 Vitality, -8% Speed | Allies within 180u gain +10% Damage and +15% Recovery. Costs you −8% Speed. | 98 ⟡ |
| **The Long Odds** | +22% Dodge | +22% Dodge, and −12 to one other stat, rolled when you take it. | 96 ⟡ |
| **Skewer of Ruin** | — | Your bolts pierce 3 extra targets. Each upgrade adds 2 more. | 104 ⟡ |
| **Split Quarrel** | — | Bolt skills fire at 1 extra target. Each upgrade adds 1 more. | 112 ⟡ |
| **The Deep Cut** | — | Crits deal ×0.9 more. Each upgrade adds ×0.4. | 118 ⟡ |
| **Pyre Conductor** | — | 45% of hits set the target burning for 16 damage a second over 4s. | 108 ⟡ |
| **Ghostlight Sigil** | — | Your skills also resolve as Spiritual when that reads better (×1.25 into Mental). | 96 ⟡ |
| **The Far Mark** | — | Bolt skills also strike the objective — nest, mark, boss, elite — when one is in range. | 98 ⟡ |

---

## Cursed goods

10 items in the shop are **cursed**: they are priced and statted well above their rarity, and the cost is paid by the *next* fight — for the whole party, in co-op. The curse expires when that fight ends.

| Item | Rarity | Stats | The curse | Price |
|---|---|---|---|---|
| **Gravebound Locket** | uncommon | +16 Vitality, +10% Recovery | CURSED — next round only: every enemy has +5% HP (the whole party's round). | 30 ⟡ |
| **Whipcrack Spur** | uncommon | +11% Speed, +6% Damage | CURSED — next round only: every enemy moves 10% faster (the whole party's round). | 31 ⟡ |
| **Leadfoot Ballast** | uncommon | +5 Defense, +12 Vitality | CURSED — next round only: you have −5% Speed. | 29 ⟡ |
| **Blindfold of Certainty** | uncommon | +12% Damage, +8% Elemental Damage | CURSED — next round only: you have −10% Dodge. | 32 ⟡ |
| **Scab-Stitched Charm** | rare | +24 Vitality, +4 Defense | Kills heal 2 HP. CURSED — next round only: all healing you receive is halved. | 52 ⟡ |
| **Siege Bell** | rare | +16% Damage, +18 Reach | CURSED — next round only: one extra artillery barrage falls on the party. | 55 ⟡ |
| **Hollow King's Signet** | rare | +9 Greed, +10% Damage | CURSED — next round only: every enemy has +5% HP (the whole party's round). | 54 ⟡ |
| **Quicksilver Vial** | rare | +15% Speed, +10% Dodge | CURSED — next round only: all healing you receive is halved. | 53 ⟡ |
| **Apostate's Reliquary** | legendary | +30% Elemental Damage, +12% Damage | Your burns, chills, chains and blasts are 12% stronger. CURSED — next round only: every enemy moves 10% faster (the whole party's round). | 92 ⟡ |
| **The Bad Bargain** | legendary | +22% Damage, +12% Speed, +18 Vitality | CURSED — next round only: one extra artillery barrage falls on the party, and you take −5% Speed with it. | 95 ⟡ |

---

## Reference tables

### Weapon tiers

| Tier | Damage × | Price × |
|---|---|---|
| I | ×1 | ×1 |
| II | ×1.6 | ×2.1 |
| III | ×2.5 | ×4.4 |
| IV | ×3.9 | ×9 |

### Flat-stat scaling rates

When a flat stat is one of a weapon's scaling tags, this is how much bonus damage one point buys. Percent stats contribute their percentage directly and are not listed.

| Stat | Damage per point |
|---|---|

### Stat coverage across the catalog

| Stat | Weapons scaling | Items granting | Characters carrying |
|---|---|---|---|
| Vitality | 2 | 25 | 7 |
| Damage | 5 | 41 | 4 |
| Speed | 5 | 13 | 3 |
| Defense | 2 | 14 | 2 |
| Dodge | 2 | 10 | 1 |
| Recovery | 2 | 9 | 3 |
| Summons | 4 | 9 | 2 |
| Elemental Damage | 10 | 14 | 4 |
| Greed | 3 | 16 | 2 |
| Reach | 2 | 7 | 3 |

### Roles across the roster

| Role | Characters |
|---|---|
| control | Mage |
| crit | Assassin |
| dodge | Monk |
| economy | Druid, Assassin |
| melee | Blacksmith, Samurai, Savage |
| ranged | Mage, Hunter |
| speed | Bard, Sundian |
| status | Wizard, Witch Doctor, Sundian |
| summons | Necromancer, Druid, Hunter |
| support | Wizard, Bard, Priest |
| sustain | Witch Doctor, Monk, Priest |
| tank | Blacksmith |

