# Undervault — design audit

> Generated from the live content data by `node tools/gen_design_audit.mjs` —
> regenerate after any content change; do not hand-edit the computed tables.
> Counts verified against boot log: **36 characters / 110 items / 26 weapons**.

## 1. Stat glossary

Census: how many **characters** modify the stat in their base statline, how many
**items** grant it (directly or inside an aura/low-HP/per-level/per-floor hook),
and how many **weapons** list it as a scaling tag. Defensive/economy stats have no
weapon tags by design — only the ⚠ flag marks genuinely thin usage.

| Stat | What it does | Formula (as implemented) | Chars | Items | Weapons | Flag |
|---|---|---|---:|---:|---:|---|
| **Max HP** | Your hit point pool. Downed at 0. | Base 80 + modifiers (min 1). Gaining Max HP also grants the difference as current HP. | 10 | 16 | 0 |  |
| **HP Regen** | Passive healing over time. | Heals `HP Regen / 5` HP per second (whole points, accumulated). Lamprey's trait disables it. | 0 | 8 | 0 | ⚠ low usage |
| **Life Steal** | Heal a cut of the damage you deal. | Heal `damage dealt × LifeSteal%` (accumulated to whole HP). Hemomancer turns overheal into a shield (cap 20). | 3 | 6 | 0 |  |
| **Damage** | The universal damage multiplier. | Hit = weapon base × tier mult × `(1 + Damage%/100)` × matching class bonus, ×2 on crit (×3 for Duskblade). | 4 | 14 | 22 |  |
| **Melee Damage** | Multiplier for melee-tagged weapons. | Extra `×(1 + Melee%/100)` on swing/thrust weapons (stacks multiplicatively with Damage%). | 3 | 11 | 9 |  |
| **Ranged Damage** | Multiplier for ranged-tagged weapons. | Extra `×(1 + Ranged%/100)` on shot/spread (and Kegbomb) weapons. | 4 | 8 | 10 |  |
| **Elemental Damage** | Multiplier for elemental-tagged weapons and effects. | Extra `×(1 + Elem%/100)` on elemental weapons; also scales burn DPS (weapons, traits, summons) and Bogflask puddles. | 3 | 8 | 9 |  |
| **Attack Speed** | Attack rate for all weapons. | Cooldown = `base / max(0.25, 1 + AS%/100)` — floored so stacked penalties can't invert it. | 1 | 9 | 3 |  |
| **Crit Chance** | Chance a hit is critical. | Rolled per fire: `random(100) < CritChance + weapon bonus`. Crits deal ×2 (×3 Duskblade). Several traits/items guarantee crits. | 3 | 8 | 1 | ⚠ low usage |
| **Engineering** | Power source for summons/structures. | Summon damage AND HP `×(1 + 0.1 × Engineering)` — +10% each per point. | 4 | 7 | 4 |  |
| **Range** | Flat reach added to weapons. | Ranged/lobbed gain 100% of Range; melee gains 30%; weapon range floors at 40. | 1 | 10 | 2 |  |
| **Armor** | Flat damage mitigation. | Damage taken = `raw × 15 / (15 + Armor)`. Negative armor allowed, capped at +50% extra damage. | 3 | 16 | 0 |  |
| **Dodge** | Chance to ignore a hit entirely. | Percent roll per hit, capped at 60 (Wisp raises to 90, Bastion lowers to 30). Dodging triggers several traits/items. | 4 | 8 | 0 |  |
| **Speed** | Movement rate. | Move speed = `300 × (1 + Speed%/100)` u/s, floored at 60. | 10 | 12 | 0 |  |
| **Luck** | Rarity bias everywhere rarity is rolled. | Uncommon+ weights `×(1 + Luck/100)`, renormalized — shop stock, treasure, elite rewards, level-up boost sizes. | 6 | 9 | 0 |  |
| **Harvesting** | Self-growing per-room income. | Grants `floor(Harvesting)` materials at each room clear, then grows by `floor(5%)` of itself (+item bonuses). | 4 | 10 | 0 |  |

## 2. Full character roster

Pick appeal is an honest pre-playtest guess (H/M/L). Verdict and Notes are for the owner.

| # | Character | Stat modifiers | Weapon | Signature trait | Pick appeal | Verdict | Notes |
|---:|---|---|---|---|---|---|---|
| 1 | **Bulwark** | +80 maxHp, +8 armor, -20% speed | Gravemaul | Twice the health and immune to pulls and forced movement, but a far bigger target (hitbox ×1.4). | **H** — Double HP forgiveness; the obvious first pick | | |
| 2 | **Voltaic** | +20% elementalDamage, -50% meleeDamage | Sparkbolt | Attacks have a 30% chance to chain lightning to a nearby enemy at 60% damage. | **M** — Flashy chains, but the melee penalty confuses | | |
| 3 | **Magnate** | +8 luck | Pebbleshot | Shop prices −25% and the first reroll each shop is free, but only 5 weapon slots. | **M** — Economy scaling for the optimizers | | |
| 4 | **Wisp** | +40% dodge, +10% speed | Threadneedle | Dodge cap raised to 90% and +1% Damage per 1% Dodge, but Max HP is capped at 20. | **M** — Thrilling 20-HP glass build for veterans | | |
| 5 | **Cogsmith** | +10 engineering | — | Cannot equip weapons; starts with 2 Bolt Turrets that inherit half of Damage%. | **H** — No-weapons turret gimmick is irresistible novelty | | |
| 6 | **Lamprey** | +8% lifeSteal | Twinlash | HP Regen does nothing; gains +2 permanent Max HP for every room cleared. | **M** — Quietly strong sustain scaler | | |
| 7 | **Powderkeg** | +10 maxHp | Kegbomb | Materials detonate for 8 area damage around you when picked up. | **M** — Pickup explosions feel great early, fade late | | |
| 8 | **Echo** | -15% attackSpeed, +5% damage | Rustcleaver | Every 4th attack echoes twice more at 50% damage. | **L** — Invisible passive; weak fantasy | | |
| 9 | **Quartermaster** | +10% damage | Gravelmouth | Can only ever buy weapons — never items — and weapons cost 20% less. | **L** — Item ban reads as pure downside | | |
| 10 | **Gilded One** | +15 luck, +4 harvesting | Vaultspike | Shop slots are always legendary — but there are only 2 of them. | **M** — Legendary-only shop is a fun lottery | | |
| 11 | **Chameleon** | +5 luck | Fanblade | Gains a different random temporary stat boost in every room. | **L** — Random temp stat has no identity | | |
| 12 | **Tollkeeper** | +5 harvesting | Pikefang | Enemies drop double materials but have +25% HP (affects the whole party). | **M** — Party-wide tradeoff sparks table arguments | | |
| 13 | **Stillness** | +10% damage, -10% speed | Longbarrel | Standing still charges the next attack, up to +100% damage. | **L** — Standing still fights the genre's motion | | |
| 14 | **Redmaw** | +20% meleeDamage, +15 maxHp | Emberfang | Deals +1% Damage for every 1% of HP missing. | **M** — Simple readable berserker fantasy | | |
| 15 | **Glasswing** | +15% speed, +10% dodge | Hailburst | Deals +50% damage — and takes +50% damage. | **M** — Double-edged risk appeals to gamblers | | |
| 16 | **Twinsoul** | +3 engineering | Pebbleshot | A mirror-drone hovers beside you, copying your first weapon at 50% damage. | **M** — Mirror drone doubles your favorite weapon | | |
| 17 | **Bastion** | +5 armor, +20 maxHp | Pikefang | Gains +1 permanent Armor each room cleared, but Dodge is capped at 30%. | **M** — Infinite armor for the patient | | |
| 18 | **Fleetfoot** | +30% speed, -10 maxHp | Threadneedle | Gains +1% Damage for every 2% Speed bonus. | **M** — Speed-into-damage rewards movement lovers | | |
| 19 | **Duskblade** | +25% critChance, -25 maxHp | Vaultspike | Critical hits deal ×3 damage instead of ×2. | **H** — Triple crits: big numbers sell themselves | | |
| 20 | **Highroller** | +25 luck | Gravelmouth | Reroll cost never compounds within a shop. | **L** — Flat reroll cost is invisible mid-run | | |
| 21 | **Archivist** | +5 luck, +3 harvesting | Bogflask | Level-ups offer 5 choices instead of 4. | **L** — A fifth choice is marginal and passive | | |
| 22 | **Cindermage** | +15% elementalDamage, -20% rangedDamage | Cinderspray | All attacks ignite for 4 damage/s over 2 s (burn scales with Elemental Damage). | **M** — Everything burns; clean elemental identity | | |
| 23 | **Frostcaller** | +12% elementalDamage, +5% speed | Frostjar | All attacks chill, slowing enemies by 40% for 1.2 seconds. | **M** — Universal chill is strong utility | | |
| 24 | **Longshot** | +15% rangedDamage, +60 range | Longbarrel | Deals +25% damage to enemies further than 250 units away. | **M** — Distance bonus suits natural snipers | | |
| 25 | **Threader** | +10% rangedDamage | Coilgun | All projectiles pierce +1 enemy. | **M** — Universal pierce is quietly excellent | | |
| 26 | **Skirmisher** | +8% rangedDamage, +12% speed | Fanblade | Gains +20% Ranged Damage while moving. | **L** — Always-moving bonus is effectively invisible | | |
| 27 | **Tinker** | +6 engineering | Bolt Turret | Structures attack 25% faster, but you have only 4 weapon slots. | **M** — Faster turrets with a tight slot puzzle | | |
| 28 | **Hivewright** | +4 engineering, +10 maxHp | Guard Drone | Gains a free Guard Drone at the start of every floor. | **M** — Free drone per floor compounds nicely | | |
| 29 | **Ironclad** | +10 armor, -15% speed | Gravemaul | Gains +1% Damage per point of Armor. | **M** — Armor-into-damage single-stat dream | | |
| 30 | **Zephyr** | +20% dodge, +15% speed, -15 maxHp | Twinlash | Dodging grants a burst of +40% Speed and the next attack is a guaranteed crit. | **H** — Dodge-crits plus speed bursts feel amazing | | |
| 31 | **Mirage** | +25% dodge | Frostscythe | Dodging releases a retaliatory nova dealing 10 damage around you. | **L** — Small uncontrollable retaliate nova | | |
| 32 | **Bloodpetal** | +6% lifeSteal, +5% damage, -10 maxHp | Serpent Awl | Every kill heals 1 HP. | **M** — Kill-heal drip suits aggression | | |
| 33 | **Hemomancer** | +10% lifeSteal, -20 maxHp | Stormlance | Life steal beyond full HP becomes a shield of up to 20. | **M** — Overheal shield rewards lifesteal stacking | | |
| 34 | **Jester** | +10% critChance, +10 luck | Fanblade | Each non-crit attack adds +5% Crit Chance until the next crit lands. | **M** — Crit ramp smooths RNG; niche appeal | | |
| 35 | **Lancer** | +12% meleeDamage, +8% critChance | Pikefang | The first hit in every room is a guaranteed critical. | **L** — One guaranteed crit per room is tiny | | |
| 36 | **Courier** | +10% speed, +2 harvesting | Pebbleshot | Gains +2% permanent Speed each room cleared. | **M** — Permanent speed snowball, simple pleasure | | |

## 3. Roster analysis

### Build-axis coverage (from the `roles` data)

| Axis | Count | Characters |
|---|---:|---|
| melee | 6 | Bulwark, Echo, Redmaw, Duskblade, Ironclad, Lancer |
| ranged | 4 | Stillness, Longshot, Threader, Skirmisher |
| elemental | 4 | Voltaic, Powderkeg, Cindermage, Frostcaller |
| engineering | 4 | Cogsmith, Twinsoul, Tinker, Hivewright |
| tank | 3 | Bulwark, Bastion, Ironclad |
| dodge | 4 | Wisp, Glasswing, Zephyr, Mirage |
| lifesteal | 3 | Lamprey, Bloodpetal, Hemomancer |
| crit | 4 | Duskblade, Zephyr, Jester, Lancer |
| economy | 8 | Magnate, Powderkeg, Quartermaster, Gilded One, Tollkeeper, Highroller, Archivist, Courier |
| luck | 4 | Gilded One, Chameleon, Highroller, Jester |
| speed | 5 | Glasswing, Fleetfoot, Skirmisher, Zephyr, Courier |

**Over-served:** economy (8) is the widest axis and several of its members overlap
(Magnate/Highroller both discount the shop loop; Powderkeg and Courier are economy
in name only). Speed (5) has three separate "speed becomes value" designs.

**Under-served:** tank (3) and lifesteal (3) sit at the spec minimum, and all three
tanks lean on the same Armor stat rather than distinct survival mechanics (block,
shields, retaliation tanking are unexplored). Ranged (4) is broad but shallow —
nothing there changes *how* shooting works the way Cogsmith changes summons.

### Near-duplicates

- **Bastion / Ironclad** — both are melee-adjacent Armor engines; one grows Armor, the other converts it. Same pick fantasy, one shop plan.
- **Fleetfoot / Courier** (and half of Skirmisher) — three flavors of "Speed becomes damage/value"; Courier's growth and Fleetfoot's conversion collapse into the same run.
- **Duskblade / Lancer** — crit-melee pair where Lancer's once-per-room crit is strictly less exciting than ×3 crits.
- **Lamprey / Bloodpetal** — per-room vs per-kill sustain drips; numbers differ, feel doesn't.
- **Magnate / Highroller** — both are "shop is cheaper" characters; Magnate's version is visible, Highroller's isn't.

### Cool on paper, passive in play

- **Echo** (every 4th attack echoes) — no cue, no decision; players can't tell it's happening.
- **Skirmisher** (+ranged while moving) — you are always moving in this genre; it's a hidden flat bonus.
- **Highroller** (rerolls never compound) — only matters on the 3rd+ reroll of one shop; invisible until late.
- **Archivist** (5 level-up choices) — a marginal EV bump with zero moment-to-moment presence.
- **Lancer** (first hit each room crits) — one bonus hit per ~30-second room.
- **Mirage** (nova on dodge) — fires on RNG the player neither sees coming nor aims.
- **Chameleon** (random temp stat per room) — variance without agency; nothing to build around.

## 4. Brotato-resemblance inventory

What already diverges: the Isaac-style room dungeon, door countdowns, bosses,
co-op with downs/revives, elite/treasure/shop rooms, and the sell/combine arsenal
UI are not Brotato mechanics. What follows is the list of mechanics that still
*are*, each with what changing it would ripple into.

| # | Mechanic (Brotato-shaped) | Ripple if changed |
|---:|---|---|
| 1 | The sixteen-stat sheet — names and semantics near-mirror Brotato's (Max HP…Harvesting) | Everything keys off these: ~70 stat items, the 48-boost level-up pool, tooltips, character statlines, the sheet UI. Renaming is cosmetic; merging/removing stats forces an item+boost+UI redesign. |
| 2 | Materials double as currency AND XP in one pickup | Splitting them changes drop tables, Harvesting, interest items, level pacing, the HUD, and both economy traits (Tollkeeper, Powderkeg). |
| 3 | Banked level-ups → pick 1-of-4 rarity-weighted stat boosts | Touches the statboost pool, the offer overlay, Luck, and Archivist's trait. |
| 4 | Weapon tiers I–IV with duplicate-combining into the next tier | Touches shop pricing (tier multipliers), the arsenal combine UI, sell values, and turret tier scaling. |
| 5 | Reroll/lock shop: 4 slots, escalating reroll cost, rarity weights 62/25/10/3 | The whole shop economy plus four traits (Magnate, Highroller, Gilded One, Quartermaster) and lock carryover. |
| 6 | Six auto-attacking weapon slots, no aiming | Core combat identity; slot-altering traits (Magnate, Tinker, Cogsmith) and the aim-free touch scheme depend on it. |
| 7 | Harvesting as a self-growing income stat (5%/round growth) | Room-clear resolution, growth items, and the economy characters' scaling curves. |
| 8 | Luck multiplying uncommon+ rarity weights | Shop, treasure, elite rewards, and level-up boost sizes all roll through the same function. |
| 9 | Engineering/structures as a parallel damage class | Four summon weapons, three engineering characters, and summon-boost items. |
| 10 | Character = statline + one rule-breaking trait, huge roster | The roster's entire design language — though this is the genre hook you likely want to keep. |
| 11 | Elites as stat-multiplied base enemies with a modifier | Elite room rewards and floor pacing; a light resemblance, cheap to restyle. |
| 12 | Four-rarity item pool where rare+ stat items carry tradeoffs | Item catalog structure, shop card styling, Luck, and treasure/elite reward pools. |

