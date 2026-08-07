# UNDERVAULT — Compendium

The complete reference for every character, stat, weapon and item in the game.

Generated from the live content modules — 33 characters, 10 stats, 26 weapons, 146 items.
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
- **A starting weapon.** One weapon at tier I, free; you buy the rest, up to 6 slots. Cogsmith is the exception — no starting weapon and no slots, because Cogsmith's trait replaces them entirely.
- **One signature trait.** Never replaced, never upgraded, and no two characters share one. The trait is the character. Four traits also change how many weapon slots you get.

Nothing else is fixed. Weapons, items, stat boosts and boons are all bought, found or picked during a run, and any character can end up anywhere.

### Damage, in one paragraph

A weapon has a base damage and a cooldown. Damage is multiplied by its tier, then by `1 + Ferocity/100`, then by its **scaling tags** — one or two stats listed on the weapon that make *that* weapon hit harder. Percent stats (Ferocity, Tempo, Reflex, Recovery, Attunement) contribute their percentage directly; flat stats convert at the rates in the stat table below. Cooldown is divided by `1 + Tempo/100`.

**Crits are not a stat.** You cannot buy crit chance. Crits happen only where an item or trait grants them, and they deal ×2 by default.

---

## The ten stats

| Stat | In one line | Base |
|---|---|---|
| **Vitality** | Your hit points — how much damage you can take. | 80 |
| **Ferocity** | Raises all the damage you deal. | 0% |
| **Tempo** | Attack speed and movement speed in one. | 0% |
| **Grit** | Toughness — shrug off damage and knockback. | 0 |
| **Reflex** | Your chance to dodge a hit completely. | 0% |
| **Recovery** | Makes all healing you receive stronger. | 0% |
| **Ingenuity** | Makes your turrets and drones stronger. | 0 |
| **Attunement** | Empowers burns, chills, lightning and blasts. | 0% |
| **Greed** | Better loot rarity, plus bonus materials each fight. | 0 |
| **Reach** | Longer weapon range and a bigger pickup magnet. | 0 |

### Vitality

Your health pool — at zero you go down. Gaining Vitality also heals you by the amount gained, and some heavy weapons hit harder the more you have.

**How it works:** Max HP directly. Gaining Vitality heals you by the amount gained. As a weapon scaling tag it converts at **1% damage per 4 points**.

**Where you find it:** 2 weapons scale with it (Gravemaul, Serpent Awl) · 23 items grant it · 11 characters carry it on their sheet.

### Ferocity

A straight boost to every hit from every weapon. The most common damage stat — many weapons also scale with it directly.

**How it works:** Multiplies all weapon damage by `1 + Ferocity/100`. As a scaling tag it contributes its percentage directly.

**Where you find it:** 5 weapons scale with it (Rustcleaver, Gravemaul, Vaultspike, Pebbleshot, Longbarrel) · 39 items grant it · 8 characters carry it on their sheet.

### Tempo

Makes you run faster. It does NOT make your skills fire faster — skills fire on their own cooldowns, and nothing in the game shortens those. Positioning is what Tempo buys.

**How it works:** Multiplies move speed by `1 + Tempo/100`. **Movement only** — see GDD §9.5. It does not shorten skill cooldowns: an attack-speed stat would be cooldown reduction renamed, and §4.2 keeps that off ranks and items so a narrow build cannot buy back its uptime.

**Where you find it:** 5 weapons scale with it (Twinlash, Stormlance, Threadneedle, Fanblade, Hailburst) · 13 items grant it · 6 characters carry it on their sheet.

### Grit

Reduces every hit you take and makes you harder to push around. A few heavy weapons hit harder the more Grit you have.

**How it works:** Mitigation on a diminishing curve, **not** flat reduction: damage taken is `raw × 15 / (15 + Grit)`, so 15 Grit halves incoming damage, 45 Grit quarters it, and it never reaches zero. Also resists knockback and pulls. As a scaling tag it converts at **1% damage per point**.

**Where you find it:** 2 weapons scale with it (Pikefang, Sawsprite) · 13 items grant it · 4 characters carry it on their sheet.

### Reflex

The higher it is, the more often enemy hits simply miss you. Dodging also sets off anything that says "on dodge".

**How it works:** Percent chance to avoid a hit entirely. **Capped at 60%** (one trait raises that cap). A dodge also fires every "on dodge" effect you own.

**Where you find it:** 2 weapons scale with it (Twinlash, Frostscythe) · 7 items grant it · 4 characters carry it on their sheet.

### Recovery

Every heal — regeneration, life-drain, kill-heals, the rest you catch between rooms — is increased by your Recovery. It does nothing alone; it amplifies the healing your items and traits provide.

**How it works:** Multiplies every heal you *receive*, from any source (regen, lifesteal, kill-heals, room rest). Worth nothing on its own — it is an amplifier.

**Where you find it:** 2 weapons scale with it (Serpent Awl, Bogflask) · 9 items grant it · 2 characters carry it on their sheet.

### Ingenuity

Summons and structures deal more damage and survive longer for every point. Only matters if you field turrets, drones or other helpers.

**How it works:** Summon damage and HP scale by `1 + 0.1 × Ingenuity`. As a scaling tag it converts at **1% damage per point**.

**Where you find it:** 4 weapons scale with it (Bolt Turret, Ember Turret, Guard Drone, Sawsprite) · 8 items grant it · 4 characters carry it on their sheet.

### Attunement

Everything elemental — fire, frost, chain lightning, explosions and shockwaves — hits harder and lingers longer. The stat for status-effect builds.

**How it works:** Multiplies burn, chill, chain-lightning, explosion and nova power and duration. Contributes its percentage directly as a scaling tag.

**Where you find it:** 10 weapons scale with it (Emberfang, Frostscythe, Stormlance, Sparkbolt, Cinderspray, Kegbomb, Bogflask, Frostjar, Magmalob, Ember Turret) · 13 items grant it · 4 characters carry it on their sheet.

### Greed

Fortune. Improves the rarity of everything the game offers you, and pays bonus materials every fight you clear. Some weapons and blasts scale with it.

**How it works:** Biases the rarity of every offer, and pays `floor(Greed/2)` bonus materials per fight cleared. As a scaling tag it converts at **1% damage per point**.

**Where you find it:** 3 weapons scale with it (Gravelmouth, Kegbomb, Magmalob) · 15 items grant it · 5 characters carry it on their sheet.

### Reach

Extends how far your weapons reach and pulls dropped materials to you from further away. Snipers and pickup builds want it.

**How it works:** Adds to weapon range and to your material pickup radius. As a scaling tag it converts at **1% damage per 12 points**.

**Where you find it:** 2 weapons scale with it (Longbarrel, Coilgun) · 7 items grant it · 4 characters carry it on their sheet.

### What Grit is actually worth

Grit is the one stat whose value curves, so it is worth seeing the numbers.

| Grit | Damage taken | Effective HP multiplier |
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

All 33, in roster order. The **sheet** is a set of modifiers *added to the base*, not absolute values — Bulwark's "+80 Vitality" means 80 + 80 = 160 HP. Anything not listed sits at base.

### At a glance

| | Character | Roles | Sheet (on top of base) | HP | Starting weapon |
|---|---|---|---|---|---|
| ⛨ | **Bulwark** | tank, melee | +80 Vitality, +8 Grit, -20% Tempo | 160 | Gravemaul |
| ⚙ | **Cogsmith** | summons | +10 Ingenuity | 80 | *none — see trait* |
| 𖤓 | **Zephyr** | dodge, speed | +20% Reflex, +15% Tempo, -15 Vitality | 65 | Twinlash |
| ⚖ | **Tollkeeper** | economy | +5 Greed | 80 | Pikefang |
| ☽ | **Duskblade** | crit, melee | +15% Ferocity, -25 Vitality | 55 | Vaultspike |
| ▣ | **Rampart** | tank | +6 Grit, +20 Vitality | 100 | Pikefang |
| ➶ | **Onrush** | speed, melee | +25% Tempo, -10 Vitality | 70 | Threadneedle |
| ❀ | **Vesper** | sustain | +8% Recovery | 80 | Serpent Awl |
| ⛃ | **The Broker** | economy | +10 Greed | 80 | Pebbleshot |
| 〜 | **Resonant** | melee, status | +5% Ferocity | 80 | Rustcleaver |
| ◐ | **Facet** | economy | +5 Greed | 80 | Fanblade |
| ◈ | **Stillness** | ranged | +10% Ferocity, +40 Reach | 80 | Longbarrel |
| ✸ | **Powderkeg** | economy, status | +10 Vitality | 90 | Kegbomb |
| ⚒ | **Quartermaster** | economy | +5% Ferocity | 80 | Gravelmouth |
| ≋ | **Mirage** | dodge, status | +25% Reflex | 80 | Frostscythe |
| ⚑ | **Banneret** | support | +10 Vitality | 90 | Stormlance |
| ✚ | **Sawbones** | support, sustain | +6% Recovery | 80 | Bogflask |
| ⧉ | **Lodestone** | support, tank | +15 Vitality, +3 Grit | 95 | Gravemaul |
| ⚡ | **Voltaic** | status | +12% Attunement, -10% Ferocity | 80 | Sparkbolt |
| ❍ | **Wisp** | dodge | +40% Reflex, +10% Tempo | 80 | Threadneedle |
| ☼ | **Gilded One** | economy | +15 Greed | 80 | Kegbomb |
| ⽕ | **Redmaw** | melee | +20% Ferocity, +15 Vitality | 95 | Emberfang |
| ⟡ | **Glasswing** | speed, dodge | +15% Tempo, +10% Reflex | 80 | Hailburst |
| ⧇ | **Twinsoul** | summons | +3 Ingenuity | 80 | Pebbleshot |
| 🩸 | **Hemomancer** | sustain | -20 Vitality | 60 | Stormlance |
| ♦ | **Jester** | crit, economy | +10 Greed | 80 | Fanblade |
| ♨ | **Cindermage** | status | +15% Attunement, -10% Ferocity | 80 | Cinderspray |
| ❅ | **Frostcaller** | status | +12% Attunement, +5% Tempo | 80 | Frostjar |
| ⌖ | **Longshot** | ranged | +60 Reach, +10% Ferocity | 80 | Longbarrel |
| ☍ | **Threader** | ranged | +24 Reach | 80 | Coilgun |
| ⚙ | **Tinker** | summons | +6 Ingenuity | 80 | Bolt Turret |
| ⬡ | **Hivewright** | summons | +4 Ingenuity, +10 Vitality | 90 | Guard Drone |
| ◎ | **Pulsar** | status, melee | +15% Attunement, +6 Grit, -30 Reach | 80 | Rustcleaver |

### ⛨ Bulwark

**Roles:** tank, melee  
**Sheet:** +80 Vitality, +8 Grit, -20% Tempo *(added to the base sheet)*  
**Starting HP:** 160  
**Starting weapon:** 🔨 Gravemaul — 30 damage every 1.8s, 120 range

**Trait — `immovable`** *(hitbox 1.4 · base 3)*

> Immovable: cannot be pushed, but a far bigger target (hitbox ×1.4). Enemies touching you take 3 + 25% of Grit + 5% of Vitality contact damage.

### ⚙ Cogsmith

**Roles:** summons  
**Sheet:** +10 Ingenuity *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** none

**Trait — `overseer`** *(mounts 4)*

> Overseer: no weapons — 4 turret mounts instead. Turrets inherit 100% of your stats on top of Ingenuity, combine in the shop, and can be picked up (E) and redeployed.

### 𖤓 Zephyr

**Roles:** dodge, speed  
**Sheet:** +20% Reflex, +15% Tempo, -15 Vitality *(added to the base sheet)*  
**Starting HP:** 65  
**Starting weapon:** 〰 Twinlash — 6 damage every 0.42s, 95 range

**Trait — `slipstream`** *(tempo 40 · dur 2)*

> Slipstream: dodging grants +40% Tempo for 2s and your next attack is a guaranteed crit.

### ⚖ Tollkeeper

**Roles:** economy  
**Sheet:** +5 Greed *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ↟ Pikefang — 14 damage every 0.95s, 170 range

**Trait — `toll_road`** *(matMult 2 · enemyHp 1.25)*

> Toll Road: enemies drop double materials but gain +25% HP (affects the whole party).

### ☽ Duskblade

**Roles:** crit, melee  
**Sheet:** +15% Ferocity, -25 Vitality *(added to the base sheet)*  
**Starting HP:** 55  
**Starting weapon:** ☨ Vaultspike — 9 damage every 0.65s, 120 range

**Trait — `executioner`**

> Executioner: attacks never crit randomly; granted crits deal ×3 instead of ×2; your first hit against any full-HP enemy is a guaranteed crit.

### ▣ Rampart

**Roles:** tank  
**Sheet:** +6 Grit, +20 Vitality *(added to the base sheet)*  
**Starting HP:** 100  
**Starting weapon:** ↟ Pikefang — 14 damage every 0.95s, 170 range

**Trait — `living_fortress`** *(perRoom 1)*

> Living Fortress: +1 permanent Grit per fight cleared, and +1% Ferocity per point of bonus Grit.

### ➶ Onrush

**Roles:** speed, melee  
**Sheet:** +25% Tempo, -10 Vitality *(added to the base sheet)*  
**Starting HP:** 70  
**Starting weapon:** ∙ Threadneedle — 4 damage every 0.22s, 360 range

**Trait — `momentum_meter`** *(fillSec 2 · bonus 0.6)*

> Momentum: moving fills a meter (~2s, faster with Tempo); your next attack consumes it for up to +60% damage.

### ❀ Vesper

**Roles:** sustain  
**Sheet:** +8% Recovery *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ↯ Serpent Awl — 12 damage every 0.95s, 200 range

**Trait — `red_tithe`** *(healPerKill 1 · vitCapPerRoom 3)*

> Red Tithe: kills heal 1 HP (Recovery applies); healing beyond full HP becomes permanent Vitality, up to +3 per fight.

### ⛃ The Broker

**Roles:** economy  
**Sheet:** +10 Greed *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** • Pebbleshot — 10 damage every 0.65s, 420 range

**Trait — `insider`** *(discount 25 · slots 7)*

> Insider Trading: shop prices −25%, reroll cost never compounds, and 7 weapon slots.

### 〜 Resonant

**Roles:** melee, status  
**Sheet:** +5% Ferocity *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ⚔ Rustcleaver — 12 damage every 0.8s, 105 range

**Trait — `resonance`** *(hits 9 · factor 2 · radius 130)*

> Resonance: attacks build a charge ring (9 hits); when full, your next hit releases an attuned shockwave for 200% weapon damage.

### ◐ Facet

**Roles:** economy  
**Sheet:** +5 Greed *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ☰ Fanblade — 9 damage every 1.05s, 340 range

**Trait — `prism`** *(boonMult 1.5)*

> Prism: entering each fight, pick 1 of 3 boons for that battle (quality scales with Greed). Any boon chosen 3 times becomes permanent.

### ◈ Stillness

**Roles:** ranged  
**Sheet:** +10% Ferocity, +40 Reach *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ━ Longbarrel — 32 damage every 1.9s, 640 range

**Trait — `overwatch`** *(idle 1.5 · mult 2 · reachPct 50)*

> Overwatch: after 1.5s without attacking (moving is fine), your next attack is charged — ×2 damage and +50% Reach on that hit.

### ✸ Powderkeg

**Roles:** economy, status  
**Sheet:** +10 Vitality *(added to the base sheet)*  
**Starting HP:** 90  
**Starting weapon:** ● Kegbomb — 17 damage every 2s, 420 range

**Trait — `volatile_greed`** *(base 4 · radius 40)*

> Volatile Greed: materials explode on pickup for 4 + 40% of Greed attuned damage; blast radius 40 + 50% of Reach.

### ⚒ Quartermaster

**Roles:** economy  
**Sheet:** +5% Ferocity *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ⋉ Gravelmouth — 6 damage every 1.15s, 300 range

**Trait — `arsenal_doctrine`**

> Arsenal Doctrine: cannot buy items; every weapon held also grants you the stats it scales with. Weapons sell for exactly the materials invested in them.

### ≋ Mirage

**Roles:** dodge, status  
**Sheet:** +25% Reflex *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ❄ Frostscythe — 14 damage every 1.2s, 125 range

**Trait — `afterimage`** *(dur 2 · tauntR 180 · burst 12 · radius 100)*

> Afterimage: dodging leaves a decoy that taunts nearby enemies for 2s, then bursts for attuned damage.

### ⚑ Banneret

**Roles:** support  
**Sheet:** +10 Vitality *(added to the base sheet)*  
**Starting HP:** 90  
**Starting weapon:** ⚡ Stormlance — 11 damage every 1.1s, 175 range

**Trait — `standard_high`** *(radius 150 · fer 10 · rec 20)*

> Standard High: a banner aura (radius 150 + 50% of Reach) grants allies and summons +10% Ferocity and +20% Recovery, scaling with your Vitality. You get half.

### ✚ Sawbones

**Roles:** support, sustain  
**Sheet:** +6% Recovery *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ⌘ Bogflask — 10 damage every 1.6s, 380 range

**Trait — `field_rites`** *(reviveBoost 0.5 · partyVit 3 · shieldCap 15)*

> Field Rites: your overheal drips to the nearest injured ally; you revive allies 50% faster; each revive grants the party +3 permanent Vitality. Solo: overheal becomes a small shield (cap 15).

### ⧉ Lodestone

**Roles:** support, tank  
**Sheet:** +15 Vitality, +3 Grit *(added to the base sheet)*  
**Starting HP:** 95  
**Starting weapon:** 🔨 Gravemaul — 30 damage every 1.8s, 120 range

**Trait — `soulbond`** *(dmgShare 0.3 · healShare 0.25 · window 1 · echoFactor 0.5)*

> Soulbond: a tether to your nearest ally — you share 30% of incoming damage and 25% of healing both ways; hitting the same enemy within 1s echoes attuned damage. Solo it binds your strongest summon; with none, it lies dormant.

### ⚡ Voltaic

**Roles:** status  
**Sheet:** +12% Attunement, -10% Ferocity *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ϟ Sparkbolt — 9 damage every 0.95s, 440 range

**Trait — `chain_attacks`** *(chance 0.3 · factor 0.6 · range 170)*

> Attacks have a 30% chance to chain lightning to a nearby enemy at 60% damage (chains scale with Attunement).

### ❍ Wisp

**Roles:** dodge  
**Sheet:** +40% Reflex, +10% Tempo *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ∙ Threadneedle — 4 damage every 0.22s, 360 range

**Trait — `reflex_master`** *(cap 90 · hpCap 30 · ferPerReflex 1)*

> Reflex cap raised to 90% and +1% Ferocity per 1% Reflex, but Vitality is capped at 30.

### ☼ Gilded One

**Roles:** economy  
**Sheet:** +15 Greed *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ● Kegbomb — 17 damage every 2s, 420 range

**Trait — `legendary_shop`** *(slots 2)*

> Shops hold only the finest goods — legendary items or the floor's top weapon tier — but just 2 of them.

### ⽕ Redmaw

**Roles:** melee  
**Sheet:** +20% Ferocity, +15 Vitality *(added to the base sheet)*  
**Starting HP:** 95  
**Starting weapon:** 🔥 Emberfang — 9 damage every 0.9s, 100 range

**Trait — `berserk_missing`** *(perMissing 1)*

> Deals +1% Ferocity for every 1% of HP missing.

### ⟡ Glasswing

**Roles:** speed, dodge  
**Sheet:** +15% Tempo, +10% Reflex *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ᎒᎒ Hailburst — 3 damage every 0.95s, 260 range

**Trait — `glass`** *(dealMult 1.5 · takeMult 1.5)*

> Deals +50% damage — and takes +50% damage.

### ⧇ Twinsoul

**Roles:** summons  
**Sheet:** +3 Ingenuity *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** • Pebbleshot — 10 damage every 0.65s, 420 range

**Trait — `mirror_drone`** *(factor 0.5)*

> A mirror-drone hovers beside you, copying your first weapon at 50% damage.

### 🩸 Hemomancer

**Roles:** sustain  
**Sheet:** -20 Vitality *(added to the base sheet)*  
**Starting HP:** 60  
**Starting weapon:** ⚡ Stormlance — 11 damage every 1.1s, 175 range

**Trait — `overheal_shield`** *(cap 20 · lifesteal 10)*

> Innately heals 10% of damage dealt (Recovery applies); healing beyond full HP becomes a shield of up to 20.

### ♦ Jester

**Roles:** crit, economy  
**Sheet:** +10 Greed *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ☰ Fanblade — 9 damage every 1.05s, 340 range

**Trait — `crit_ramp`** *(per 5 · max 60)*

> Each attack that fails to crit adds +5% to the Jester’s own crit odds (cap 60%); a crit resets them.

### ♨ Cindermage

**Roles:** status  
**Sheet:** +15% Attunement, -10% Ferocity *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** 𓂃 Cinderspray — 5 damage every 1.1s, 250 range

**Trait — `burn_attacks`** *(dps 4 · dur 2)*

> All attacks ignite for 4 damage/s over 2s (burns scale with Attunement).

### ❅ Frostcaller

**Roles:** status  
**Sheet:** +12% Attunement, +5% Tempo *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ❆ Frostjar — 12 damage every 1.8s, 400 range

**Trait — `slow_attacks`** *(mult 0.6 · dur 1.2)*

> All attacks chill, slowing enemies by 40% for 1.2s (chills deepen with Attunement).

### ⌖ Longshot

**Roles:** ranged  
**Sheet:** +60 Reach, +10% Ferocity *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ━ Longbarrel — 32 damage every 1.9s, 640 range

**Trait — `far_bonus`** *(dist 250 · bonus 25)*

> Deals +25% damage to enemies further than 250 units away.

### ☍ Threader

**Roles:** ranged  
**Sheet:** +24 Reach *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ≡ Coilgun — 21 damage every 1.4s, 560 range

**Trait — `pierce_innate`** *(add 1)*

> All projectiles pierce +1 enemy.

### ⚙ Tinker

**Roles:** summons  
**Sheet:** +6 Ingenuity *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ⌖ Bolt Turret — 0 damage every 0s, 0 range

**Trait — `structures_fast`** *(rate 1.25 · slotCap 4)*

> Structures attack 25% faster, but you have only 4 weapon slots.

### ⬡ Hivewright

**Roles:** summons  
**Sheet:** +4 Ingenuity, +10 Vitality *(added to the base sheet)*  
**Starting HP:** 90  
**Starting weapon:** ✦ Guard Drone — 0 damage every 0s, 0 range

**Trait — `free_drone_floor`**

> Gains a free Guard Drone at the start of every floor.

### ◎ Pulsar

**Roles:** status, melee  
**Sheet:** +15% Attunement, +6 Grit, -30 Reach *(added to the base sheet)*  
**Starting HP:** 80  
**Starting weapon:** ⚔ Rustcleaver — 12 damage every 0.8s, 105 range

**Trait — `nova_core`** *(radius 120 · cd 1.2 · base 10 · slots 3 · heatPer 0.15 · heatMax 1.5 · heatDecay 2 · healPer 1)*

> Nova Core: while an enemy stands within 120, you pulse every 1.2s for attuned damage to everything in that fixed radius (Reach never changes it) and heal 1 HP per enemy struck. Each pulse that connects stacks +15% nova damage up to +150%; the stacks all fall off 2s after a pulse hits nothing. Only 3 weapon slots, and every weapon you hold is range-capped to 120.

---

## Weapons

All 26, grouped by class. Every number shown is **tier I**; tiers multiply damage by I ×1, II ×1.6, III ×2.5, IV ×3.9.

**Two** copies of the same weapon at the same tier combine into one of the next tier, for free — automatically when you buy the second one.

### Swing

Arc melee — sweeps a cone in front of you and hits everything inside it.

| | Weapon | Damage | Cooldown | DPS | Range | Knock | Scales with | Extra | Price |
|---|---|---|---|---|---|---|---|---|---|
| ⚔ | **Rustcleaver** | 12 | 0.8s | 15 | 105 | 90 | Ferocity | 115° arc | 14 ⟡ |
| 🔥 | **Emberfang** | 9 | 0.9s | 10 | 100 | 60 | Attunement | burn 4/s for 2s; 109° arc | 18 ⟡ |
| 🔨 | **Gravemaul** | 30 | 1.8s | 16.67 | 120 | 260 | Vitality + Ferocity | 149° arc | 22 ⟡ |
| 〰 | **Twinlash** | 6 | 0.42s | 14.29 | 95 | 30 | Tempo + Reflex | 69° arc | 16 ⟡ |
| ❄ | **Frostscythe** | 14 | 1.2s | 11.67 | 125 | 80 | Attunement + Reflex | chill to 55% speed for 1.5s; 166° arc | 24 ⟡ |

### Thrust

Line melee — stabs along a narrow lane; some models pierce every body in the line.

| | Weapon | Damage | Cooldown | DPS | Range | Knock | Scales with | Extra | Price |
|---|---|---|---|---|---|---|---|---|---|
| ↟ | **Pikefang** | 14 | 0.95s | 14.74 | 170 | 110 | Grit | 26u wide | 15 ⟡ |
| ☨ | **Vaultspike** | 9 | 0.65s | 13.85 | 120 | 50 | Ferocity | 20u wide | 18 ⟡ |
| ↯ | **Serpent Awl** | 12 | 0.95s | 12.63 | 200 | 70 | Recovery + Vitality | pierces the whole line; 22u wide | 20 ⟡ |
| ⚡ | **Stormlance** | 11 | 1.1s | 10 | 175 | 60 | Attunement + Tempo | chains to 2 more at 60%; 24u wide | 24 ⟡ |

### Single shot

Ranged — one projectile per shot, stopped by the first thing it hits unless it pierces.

| | Weapon | Damage | Cooldown | DPS | Range | Knock | Scales with | Extra | Price |
|---|---|---|---|---|---|---|---|---|---|
| • | **Pebbleshot** | 10 | 0.65s | 15.38 | 420 | 30 | Ferocity | — | 12 ⟡ |
| ━ | **Longbarrel** | 32 | 1.9s | 16.84 | 640 | 140 | Reach + Ferocity | pierces 2 | 24 ⟡ |
| ∙ | **Threadneedle** | 4 | 0.22s | 18.18 | 360 | 8 | Tempo | — | 16 ⟡ |
| ≡ | **Coilgun** | 21 | 1.4s | 15 | 560 | 60 | Reach | pierces 99 | 26 ⟡ |
| ϟ | **Sparkbolt** | 9 | 0.95s | 9.47 | 440 | 20 | Attunement | chains to 3 more at 50% | 22 ⟡ |

### Spread

Ranged — several projectiles per shot in a fan.

| | Weapon | Damage | Cooldown | DPS | Range | Knock | Scales with | Extra | Price |
|---|---|---|---|---|---|---|---|---|---|
| ⋉ | **Gravelmouth** | 6 | 1.15s | 5.22 | 300 | 70 | Greed | 5 projectiles over 26° | 18 ⟡ |
| ☰ | **Fanblade** | 9 | 1.05s | 8.57 | 340 | 40 | Tempo | pierces 1; 3 projectiles over 34° | 20 ⟡ |
| ᎒᎒ | **Hailburst** | 3 | 0.95s | 3.16 | 260 | 20 | Tempo | 8 projectiles over 55° | 20 ⟡ |
| 𓂃 | **Cinderspray** | 5 | 1.1s | 4.55 | 250 | 15 | Attunement | burn 3/s for 2s; 4 projectiles over 30° | 22 ⟡ |

### Lobbed

Arcs over walls and detonates in an area. The only class that ignores line of sight.

| | Weapon | Damage | Cooldown | DPS | Range | Knock | Scales with | Extra | Price |
|---|---|---|---|---|---|---|---|---|---|
| ● | **Kegbomb** | 17 | 2s | 8.5 | 420 | 180 | Attunement + Greed | blast radius 110 | 22 ⟡ |
| ⌘ | **Bogflask** | 10 | 1.6s | 6.25 | 380 | 20 | Recovery + Attunement | blast radius 95; leaves a puddle | 24 ⟡ |
| ❆ | **Frostjar** | 12 | 1.8s | 6.67 | 400 | 40 | Attunement | chill to 50% speed for 2s; blast radius 120 | 24 ⟡ |
| ◉ | **Magmalob** | 17 | 1.9s | 8.95 | 390 | 90 | Attunement + Greed | burn 5/s for 2.5s; blast radius 100 | 26 ⟡ |

### Summon

Places a structure that fights on its own. Scales with Ingenuity, not with your weapon stats.

| | Weapon | Structure HP | Damage | Every | Range | Scales with | Price |
|---|---|---|---|---|---|---|---|
| ⌖ | **Bolt Turret** | 40 | 7 | 0.7s | 380 | Ingenuity | 24 ⟡ |
| ♨ | **Ember Turret** | 34 | 5 | 0.85s | 320 | Ingenuity + Attunement | 28 ⟡ |
| ✦ | **Guard Drone** | 30 | 6 | 0.55s | 260 | Ingenuity | 26 ⟡ |
| ✹ | **Sawsprite** | 45 | 10 | 0.5s | 300 | Ingenuity + Grit | 26 ⟡ |

---

## Items

All 146, grouped by rarity. Items are permanent for the run and never combine.

**The tradeoff rule:** commons are clean gains. Roughly half of uncommons, and *every* rare and legendary, also subtract from a stat — always on an opposing axis to what they give, and always spelled out on the item.

### Common — 38 items

0 of them carry a subtraction. Prices run 10–15 ⟡.

| Item | Stats | What it does | Price |
|---|---|---|---|
| **Hardtack Ration** | +5 Vitality | — | 11 ⟡ |
| **Grindstone Chip** | +4% Ferocity | — | 12 ⟡ |
| **Springwound Cog** | +4% Tempo | — | 13 ⟡ |
| **Iron Rivet Plate** | +1 Grit | — | 12 ⟡ |
| **Softsole Boots** | +4% Reflex | — | 12 ⟡ |
| **Cavemoss Salve** | +6% Recovery | — | 10 ⟡ |
| **Tinker's Pliers** | +1 Ingenuity | — | 12 ⟡ |
| **Flintspark Shard** | +4% Attunement | — | 12 ⟡ |
| **Tin Lantern** | +3 Greed | — | 11 ⟡ |
| **Vaultwatch Spyglass** | +12 Reach | — | 11 ⟡ |
| **Copper Band** | +4 Vitality, +4% Recovery | — | 14 ⟡ |
| **Miner's Mitts** | +3% Ferocity, +2 Greed | — | 14 ⟡ |
| **Fletcher's Kit** | +8 Reach, +3% Ferocity | — | 14 ⟡ |
| **Embercoal Lump** | +3% Attunement, +3% Ferocity | — | 15 ⟡ |
| **Rustbitten Charm** | +2 Greed, +6 Reach | — | 13 ⟡ |
| **Padded Jerkin** | +1 Grit, +3 Vitality | — | 14 ⟡ |
| **Quickstep Laces** | +3% Tempo, +3% Reflex | — | 14 ⟡ |
| **Servo Winder** | +1 Ingenuity, +3% Tempo | — | 14 ⟡ |
| **Chillbottle** | +3% Attunement, +4% Recovery | — | 14 ⟡ |
| **Loadbearer Straps** | +1 Grit, +2 Greed | — | 14 ⟡ |
| **Cavemoss Poultice** | — | Recover 1 HP per second. | 13 ⟡ |
| **Leech Locket** | — | Heal 2% of damage dealt. | 13 ⟡ |
| **Grave Snack** | — | Kills heal 1 HP. | 12 ⟡ |
| **Cornered Rat** | — | +15% Ferocity while below 35% HP. | 14 ⟡ |
| **Wanderer's Soles** | — | +8% Tempo while moving. | 13 ⟡ |
| **Planted Heels** | — | +4 Grit while standing still. | 13 ⟡ |
| **Skirmish Garb** | — | +6% Reflex while moving. | 14 ⟡ |
| **Hermit Wrap** | — | +15% Recovery while no enemy is within 150u. | 13 ⟡ |
| **Fresh Legs** | — | +10% Tempo for the first 8s of every fight. | 13 ⟡ |
| **Longwatch Lens** | — | +20 Reach while standing still. | 14 ⟡ |
| **Payload Harness** | — | +2% Ferocity for each material you stand on (up to 5). | 14 ⟡ |
| **Nervous Fingers** | — | +8% Tempo while below half HP. | 13 ⟡ |
| **Scavenger's Instinct** | — | +1 Greed for each material you stand on (up to 8). | 14 ⟡ |
| **Loose Change** | — | 5% chance a picked-up material is worth one extra. | 13 ⟡ |
| **Pitchfire Vial** | — | 15% chance on hit to ignite: 3 dmg/s for 2s. | 14 ⟡ |
| **Frostbite Ring** | — | 15% chance on hit to chill: −40% speed for 1.2s. | 14 ⟡ |
| **Reroll Chit** | — | The first reroll in every shop is free. | 13 ⟡ |
| **Quick Study** | — | +10% XP from materials. | 13 ⟡ |

### Uncommon — 59 items

30 of them carry a subtraction. Prices run 26–30 ⟡.

| Item | Stats | What it does | Price |
|---|---|---|---|
| **Oxblood Tonic** | +20 Vitality, -3% Tempo | Costs you −3% Tempo. | 26 ⟡ |
| **Flywheel Gauntlet** | +9% Tempo | — | 27 ⟡ |
| **Bulwark Pauldron** | +4 Grit, +6 Vitality, -4% Reflex | Costs you −4% Reflex. | 27 ⟡ |
| **Quicksilver Soles** | +6% Tempo, +5% Reflex | — | 28 ⟡ |
| **Vault Servo Core** | +5 Ingenuity, -3% Ferocity | Costs you −3% Ferocity. | 27 ⟡ |
| **Ashen Grimoire** | +9% Attunement, +3 Greed | — | 26 ⟡ |
| **Ratcatcher's Elixir** | +8 Greed, +5% Recovery, -3% Ferocity | Costs you −3% Ferocity. | 30 ⟡ |
| **Surveyor's Array** | +20 Reach, +4% Ferocity | — | 26 ⟡ |
| **Whetstone Wheel** | +11% Ferocity, -3% Tempo | Costs you −3% Tempo. | 27 ⟡ |
| **Sistered Plates** | +2 Grit, +4% Reflex | — | 27 ⟡ |
| **Assembler's Manual** | +4 Ingenuity, +3 Greed, -3% Ferocity | Costs you −3% Ferocity. | 28 ⟡ |
| **Deepmoss Compress** | — | Recover 2 HP per second. | 28 ⟡ |
| **Bloodgroove Blade** | +7% Ferocity, -3% Tempo | Heal 4% of damage dealt. Costs you −3% Tempo. | 28 ⟡ |
| **Butcher's Bill** | +6 Vitality | Kills heal 2 HP. | 29 ⟡ |
| **Bandolier of Salves** | +5% Recovery, -1 Grit | Heal 10 HP at every fight clear. Costs you −1 Grit. | 27 ⟡ |
| **Sugarrock Shard** | — | 15% chance to heal 1 HP when picking up a material. | 26 ⟡ |
| **Brawler's Knuckle** | +3% Ferocity, -3% Tempo | +25% Ferocity while an enemy is within 60u. Costs you −3% Tempo. | 28 ⟡ |
| **Sniper's Discipline** | — | +20% Ferocity while no enemy is within 150u. | 28 ⟡ |
| **Clean Bill of Health** | +3% Ferocity, -3% Tempo | +20% Ferocity while above 90% HP. Costs you −3% Tempo. | 27 ⟡ |
| **Adrenal Gland** | — | +12% Tempo for 3s after a kill. | 28 ⟡ |
| **First Blood Pennant** | +3% Ferocity, -3% Tempo | Costs you −3% Tempo. | 27 ⟡ |
| **Doorbreaker Charm** | — | +15% Ferocity for the first 10s of every fight. | 27 ⟡ |
| **Phalanx Badge** | +3% Ferocity, -3% Tempo | +4 Grit while an ally is within 150u. Costs you −3% Tempo. | 26 ⟡ |
| **Dragon's Bed** | — | +2 Grit for each material you stand on (up to 10). | 29 ⟡ |
| **Duelist's Veil** | +3% Ferocity, -3% Tempo | +10% Reflex while an enemy is within 60u. Costs you −3% Tempo. | 28 ⟡ |
| **Triage Tabard** | — | +25% Recovery while below half HP. | 27 ⟡ |
| **Bloodscent Locket** | +3% Ferocity, -3% Tempo | +12% Ferocity for 3s after a kill. Costs you −3% Tempo. | 28 ⟡ |
| **Emberstoked Bellows** | — | +12% Attunement while an enemy is within 90u. | 27 ⟡ |
| **Caravan Flag** | +3% Ferocity, -3% Tempo | +8% Tempo while an ally is within 150u. Costs you −3% Tempo. | 26 ⟡ |
| **Vault Compass** | — | +5 Greed for the first 10s of every fight. | 27 ⟡ |
| **Ironblood Draught** | +3% Ferocity, -3% Tempo | +3 Grit while above 75% HP. Costs you −3% Tempo. | 27 ⟡ |
| **Boneset Splint** | — | +3 Grit and +10% Recovery while below 60% HP. | 28 ⟡ |
| **Headsman's Memento** | +3% Ferocity, -3% Tempo | Your first attack after a kill crits. Costs you −3% Tempo. | 29 ⟡ |
| **Tenth-Strike Tally** | — | Every 10th attack crits. | 28 ⟡ |
| **Opener's Oath** | +3% Ferocity, -3% Tempo | Your first attack in every fight crits. Costs you −3% Tempo. | 26 ⟡ |
| **Red Ribbon Salve** | — | Critical hits heal 2 HP. | 27 ⟡ |
| **Matador's Cape** | +2% Tempo, -1 Grit | After a dodge, your next attack deals +50% damage. Costs you −1 Grit. | 28 ⟡ |
| **Sparkdust Pouch** | — | Picking up a material detonates it for 6 attuned damage (radius 70). | 28 ⟡ |
| **Greedwind Charm** | +2 Greed, -3% Ferocity | Picking up a material grants +10% Tempo for 2s (stacks 3×). Costs you −3% Ferocity. | 27 ⟡ |
| **Magpie's Eye** | — | 8% chance a picked-up material is worth one extra. | 28 ⟡ |
| **Wick and Tallow** | +4% Attunement, -3% Ferocity | 25% chance on hit to ignite: 4 dmg/s for 2s. Costs you −3% Ferocity. | 28 ⟡ |
| **Glacier Salt** | — | 25% chance on hit to chill: −45% speed for 1.5s. | 28 ⟡ |
| **Galvanic Coil** | +4% Attunement, -3% Ferocity | 20% chance on hit to arc 8 attuned damage to a nearby enemy. Costs you −3% Ferocity. | 29 ⟡ |
| **Kindler's Manual** | +4% Attunement | Your burns, chills, chains and blasts are 15% stronger. | 28 ⟡ |
| **Rallying Horn** | +8 Vitality, -3% Tempo | Allies within 150u gain +8% Ferocity. Costs you −3% Tempo. | 28 ⟡ |
| **Chirurgeon's Censer** | — | Allies within 150u gain +15% Recovery. | 28 ⟡ |
| **Drillmaster's Whistle** | +8 Vitality, -3% Tempo | Allies within 150u gain +6% Tempo. Costs you −3% Tempo. | 28 ⟡ |
| **Thorncoat** | +1 Grit | Attackers take 4 damage when they hit you. | 27 ⟡ |
| **Cinder Cloak** | +1 Grit, -4% Reflex | Enemies within 80u smolder for 4 damage per second. Costs you −4% Reflex. | 29 ⟡ |
| **Slaughter Rhythm** | — | Kills grant +8% Tempo for 3s (stacks 4×). | 29 ⟡ |
| **Powder Charges** | +3% Ferocity, -3% Tempo | 20% chance for kills to detonate: 10 attuned damage within 80u. Costs you −3% Tempo. | 29 ⟡ |
| **Drillbit Rounds** | — | Your projectiles pierce +1 enemy. | 28 ⟡ |
| **Rambounce Pads** | +3% Ferocity, -3% Tempo | Your knockback is 50% stronger. Costs you −3% Tempo. | 26 ⟡ |
| **Coin of Return** | — | Earn 5% interest on held materials at each fight clear (max 10). | 28 ⟡ |
| **Haggler's Tongue** | +2 Greed, -3% Ferocity | Shop prices −10%. Costs you −3% Ferocity. | 27 ⟡ |
| **Archivist's Folio** | +3 Greed | Level-ups offer 1 extra choice. | 29 ⟡ |
| **Growth Chart** | +8 Vitality, -3% Tempo | +2 permanent Vitality on every level-up. Costs you −3% Tempo. | 28 ⟡ |
| **Medic's Satchel** | — | You revive allies 50% faster. | 27 ⟡ |
| **Foreman's Manual** | +2 Ingenuity, -3% Ferocity | Your summons deal +20% damage and have +20% HP. Costs you −3% Ferocity. | 28 ⟡ |

### Rare — 27 items

27 of them carry a subtraction. Prices run 52–56 ⟡.

| Item | Stats | What it does | Price |
|---|---|---|---|
| **Heartstone Core** | +40 Vitality, +8% Recovery, -8% Tempo | Costs you −8% Tempo. | 52 ⟡ |
| **Warcaster's Sigil** | +22% Ferocity, +6% Attunement, -8% Tempo | Costs you −8% Tempo. | 55 ⟡ |
| **Stormheart Metronome** | +21% Tempo, -3 Grit | Costs you −3 Grit. | 54 ⟡ |
| **Adamant Aegis** | +8 Grit, +8 Vitality, -9% Reflex | Costs you −9% Reflex. | 52 ⟡ |
| **Prism Lens Array** | +24% Attunement, +12 Reach, -8% Ferocity | Costs you −8% Ferocity. | 54 ⟡ |
| **Magnate's Ledgerstone** | +17 Greed, +6 Vitality, -8% Ferocity | Costs you −8% Ferocity. | 56 ⟡ |
| **Ghostweave Cloak** | +15% Reflex, +4% Tempo, -14 Vitality | Costs you −14 Vitality. | 54 ⟡ |
| **Foundry Heart** | +9 Ingenuity, +6 Vitality, -8% Ferocity | Costs you −8% Ferocity. | 55 ⟡ |
| **Aegis Coil** | +3 Grit, -9% Reflex | Blocks one hit entirely, then recharges for 6s. Costs you −9% Reflex. | 55 ⟡ |
| **Regicide Edge** | +8% Ferocity, -8% Tempo | +25% Ferocity during the Siege. Costs you −8% Tempo. | 54 ⟡ |
| **Executioner's Hood** | +8% Ferocity, -8% Tempo | +20% Attunement during the Siege. Costs you −8% Tempo. | 52 ⟡ |
| **Deadline Chronometer** | +8% Ferocity, -8% Tempo | Costs you −8% Tempo. | 53 ⟡ |
| **Warcamp Standard** | +8% Ferocity, -8% Tempo | +10% Ferocity while an ally is within 180u. Costs you −8% Tempo. | 54 ⟡ |
| **Overcharged Core** | +8% Ferocity, -8% Tempo | +15% Tempo and +10% Ferocity while above 90% HP. Costs you −8% Tempo. | 56 ⟡ |
| **Rimeheart Prism** | +8% Ferocity, -8% Tempo | Attacks against chilled enemies crit. Costs you −8% Tempo. | 55 ⟡ |
| **Pyre Sight** | +8% Ferocity, -8% Tempo | Attacks against burning enemies crit. Costs you −8% Tempo. | 55 ⟡ |
| **Assassin's Primer** | +8% Ferocity, -8% Tempo | Attacks against full-HP enemies crit. Costs you −8% Tempo. | 54 ⟡ |
| **Detonation Tithe** | +7 Greed, -8% Ferocity | Picking up a material detonates it for 12 attuned damage (radius 90). Costs you −8% Ferocity. | 54 ⟡ |
| **Stormbinder Loop** | +10% Attunement, -8% Ferocity | 30% chance on hit to arc 14 attuned damage; statuses 10% stronger. Costs you −8% Ferocity. | 56 ⟡ |
| **Standard of the Vault** | +20 Vitality, -8% Tempo | Allies within 170u gain +6% Ferocity and +2 Grit. Costs you −8% Tempo. | 56 ⟡ |
| **Lodemother's Chime** | +7% Tempo, -3 Grit | You revive allies 50% faster; allies within 140u gain +10% Recovery. Costs you −3 Grit. | 55 ⟡ |
| **Bulette Plating** | +3 Grit, -9% Reflex | Taking a hit releases an attuned nova: 12 damage within 110u. Costs you −9% Reflex. | 55 ⟡ |
| **Gravedigger's Pact** | +20 Vitality, -8% Tempo | Kills grant +1 permanent Vitality (up to +30 per run). Costs you −8% Tempo. | 56 ⟡ |
| **Giantsbane Bolt** | +8% Ferocity, -8% Tempo | +25% damage to elites and bosses. Costs you −8% Tempo. | 55 ⟡ |
| **Deepvault Compact** | +20 Vitality, -8% Tempo | +3 Greed and +4 Vitality at the start of every floor. Costs you −8% Tempo. | 55 ⟡ |
| **Doublestrike Ledger** | +7 Greed, -8% Ferocity | 15% chance for kills to drop double materials. Costs you −8% Ferocity. | 56 ⟡ |
| **Overclock Governor** | +6 Ingenuity, -8% Ferocity | Your summons deal +35% damage and have +10% HP. Costs you −8% Ferocity. | 55 ⟡ |

### Legendary — 12 items

12 of them carry a subtraction. Prices run 88–98 ⟡.

| Item | Stats | What it does | Price |
|---|---|---|---|
| **Second Wind Whistle** | +15% Recovery, -3 Grit | Once per floor: refuse death and stand back up at 50% Vitality. Costs you −3 Grit. | 90 ⟡ |
| **Jester's Own Deck** | +8% Ferocity, -8% Tempo | Every 6th attack crits. Costs you −8% Tempo. | 88 ⟡ |
| **Splitting Chamber** | +8% Ferocity, -8% Tempo | Your ranged weapons fire +1 projectile. Costs you −8% Tempo. | 95 ⟡ |
| **Vault Sovereign's Crown** | +22 Greed, +10 Vitality, -8% Ferocity | Costs you −8% Ferocity. | 96 ⟡ |
| **Worldbreaker Sledge** | +33% Ferocity, -8% Tempo | Costs you −8% Tempo. | 95 ⟡ |
| **Chronomancer's Gear** | +27% Tempo, +8% Reflex, -3 Grit | Costs you −3 Grit. | 96 ⟡ |
| **Saint's Reliquary** | +45% Recovery, -3 Grit | Recover 1 HP per second. Costs you −3 Grit. | 92 ⟡ |
| **Architect's Omnitool** | +12 Ingenuity, -8% Ferocity | Your summons deal +25% damage and have +25% HP. Costs you −8% Ferocity. | 96 ⟡ |
| **Tempest Codex** | +35% Attunement, -8% Ferocity | Your burns, chills, chains and blasts are 15% stronger. Costs you −8% Ferocity. | 95 ⟡ |
| **Panoply of the Deep** | +11 Grit, +15 Vitality, -9% Reflex | Costs you −9% Reflex. | 94 ⟡ |
| **Horizon Glass** | +40 Reach, +18% Ferocity, -8% Tempo | Costs you −8% Tempo. | 93 ⟡ |
| **Banner of the Last Stand** | +20 Vitality, -8% Tempo | Allies within 180u gain +10% Ferocity and +15% Recovery. Costs you −8% Tempo. | 98 ⟡ |

---

## Cursed goods

10 items in the shop are **cursed**: they are priced and statted well above their rarity, and the cost is paid by the *next* fight — for the whole party, in co-op. The curse expires when that fight ends.

| Item | Rarity | Stats | The curse | Price |
|---|---|---|---|---|
| **Gravebound Locket** | uncommon | +16 Vitality, +10% Recovery | CURSED — next round only: every enemy has +5% HP (the whole party's round). | 30 ⟡ |
| **Whipcrack Spur** | uncommon | +11% Tempo, +6% Ferocity | CURSED — next round only: every enemy moves 10% faster (the whole party's round). | 31 ⟡ |
| **Leadfoot Ballast** | uncommon | +5 Grit, +12 Vitality | CURSED — next round only: you have −5% Tempo. | 29 ⟡ |
| **Blindfold of Certainty** | uncommon | +12% Ferocity, +8% Attunement | CURSED — next round only: you have −10% Reflex. | 32 ⟡ |
| **Scab-Stitched Charm** | rare | +24 Vitality, +4 Grit | Kills heal 2 HP. CURSED — next round only: all healing you receive is halved. | 52 ⟡ |
| **Siege Bell** | rare | +16% Ferocity, +18 Reach | CURSED — next round only: one extra artillery barrage falls on the party. | 55 ⟡ |
| **Hollow King's Signet** | rare | +9 Greed, +10% Ferocity | CURSED — next round only: every enemy has +5% HP (the whole party's round). | 54 ⟡ |
| **Quicksilver Vial** | rare | +15% Tempo, +10% Reflex | CURSED — next round only: all healing you receive is halved. | 53 ⟡ |
| **Apostate's Reliquary** | legendary | +30% Attunement, +12% Ferocity | Your burns, chills, chains and blasts are 12% stronger. CURSED — next round only: every enemy moves 10% faster (the whole party's round). | 92 ⟡ |
| **The Bad Bargain** | legendary | +22% Ferocity, +12% Tempo, +18 Vitality | CURSED — next round only: one extra artillery barrage falls on the party, and you take −5% Tempo with it. | 95 ⟡ |

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
| Vitality | 25% |
| Grit | 100% |
| Ingenuity | 100% |
| Greed | 100% |
| Reach | 8.33% |

### Stat coverage across the catalog

| Stat | Weapons scaling | Items granting | Characters carrying |
|---|---|---|---|
| Vitality | 2 | 23 | 11 |
| Ferocity | 5 | 39 | 8 |
| Tempo | 5 | 13 | 6 |
| Grit | 2 | 13 | 4 |
| Reflex | 2 | 7 | 4 |
| Recovery | 2 | 9 | 2 |
| Ingenuity | 4 | 8 | 4 |
| Attunement | 10 | 13 | 4 |
| Greed | 3 | 15 | 5 |
| Reach | 2 | 7 | 4 |

### Roles across the roster

| Role | Characters |
|---|---|
| crit | Duskblade, Jester |
| dodge | Zephyr, Mirage, Wisp, Glasswing |
| economy | Tollkeeper, The Broker, Facet, Powderkeg, Quartermaster, Gilded One, Jester |
| melee | Bulwark, Duskblade, Onrush, Resonant, Redmaw, Pulsar |
| ranged | Stillness, Longshot, Threader |
| speed | Zephyr, Onrush, Glasswing |
| status | Resonant, Powderkeg, Mirage, Voltaic, Cindermage, Frostcaller, Pulsar |
| summons | Cogsmith, Twinsoul, Tinker, Hivewright |
| support | Banneret, Sawbones, Lodestone |
| sustain | Vesper, Sawbones, Hemomancer |
| tank | Bulwark, Rampart, Lodestone |

