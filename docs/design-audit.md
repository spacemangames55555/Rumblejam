# Undervault — design audit (post-Great-Rebalance)

> Generated from the live content data by `node tools/gen_design_audit.mjs` —
> regenerate after any content change; do not hand-edit the computed tables.
> Counts verified against boot log: **33 characters / 146 items / 26 weapons**.
> The generator enforces the dead-stat gate: every stat on ≥2 weapons, ≥5 items, ≥1 statline.

## 1. Stat glossary (the ten-stat sheet)

Census: how many **characters** have the stat positive in their base statline, how
many **items** grant it (directly or inside a conditional/aura/per-level/per-floor
hook), and how many **weapons** list it as a scaling tag. Crit is not a stat —
critical hits exist only as granted effects (default ×2).

| Stat | What it does | Formula (as implemented) | Chars | Items | Weapons |
|---|---|---|---:|---:|---:|
| **Vitality** | Your hit point pool. Downed at 0. | Base 80 + modifiers (min 1). Gaining Vitality also grants the difference as current HP. Scaling rate: 1% weapon damage per 4 points. | 7 | 18 | 2 |
| **Ferocity** | The universal damage multiplier. | Hit = weapon base × tier mult × `(1 + Ferocity%/100)` × `(1 + scaling-tag bonus/100)`. Crits are granted-only, ×2 (×3 Duskblade). | 6 | 30 | 5 |
| **Tempo** | One stat for all speed. | Attack cooldown = `base / max(0.25, 1 + Tempo%/100)`; move speed = `300 × (1 + Tempo%/100)`, floored at 60. | 5 | 19 | 5 |
| **Grit** | Mitigation and stubbornness. | Damage taken = `raw × 15 / (15 + Grit)` (negative capped at +50% extra); pulls/knockback resisted by the same ratio. Scaling rate: 1%/point. | 4 | 16 | 2 |
| **Reflex** | Chance to ignore a hit entirely. | Percent roll per hit, capped at 60 (Wisp raises to 90). Every on-dodge effect (Slipstream, Afterimage, items) keys off this. | 4 | 9 | 2 |
| **Recovery** | Amplifies ALL healing received. | Every healing source (regen, lifesteal, kill-heals, fight-clear breathers, floor heals) lands at `×(1 + Recovery%/100)`. | 2 | 13 | 2 |
| **Ingenuity** | Power source for summons/structures. | Summon damage AND HP `×(1 + 0.1 × Ingenuity)`. Scaling rate: 1%/point on summon-tagged weapons. | 4 | 7 | 4 |
| **Attunement** | Elemental/status amplifier. | Burns, chills (strength and duration), chains, novas, blasts and echoes all scale `×(1 + Attunement%/100)`. | 4 | 12 | 10 |
| **Greed** | Fortune unified. | Rarity weights for uncommon+ `×(1 + Greed/100)` everywhere rarity rolls, AND `floor(Greed/2)` materials at every fight clear. No self-growth. Scaling rate: 1%/point. | 5 | 14 | 3 |
| **Reach** | Weapon reach and magnetism. | Ranged/lobbed weapons +100% of Reach, melee +30% (floor 40); pickup radius = `60 + Reach × 0.5`. Scaling rate: 1% per 12 points. | 3 | 8 | 2 |

## 2. Full character roster

Pick appeal is an honest pre-playtest guess (H/M/L). Verdict and Notes are for the owner.

| # | Character | Stat modifiers | Weapon | Signature trait | Pick appeal | Verdict | Notes |
|---:|---|---|---|---|---|---|---|
| 1 | **Bulwark** | +80 vitality, +8 grit, -20% tempo | Gravemaul | Immovable: cannot be pushed, but a far bigger target (hitbox ×1.4). Enemies touching you take 3 + 25% of Grit + 5% of Vitality contact damage. | **H** — Huge HP plus touch-me-and-suffer; the obvious first pick | | |
| 2 | **Cogsmith** | +10 ingenuity | — | Overseer: no weapons — 4 turret mounts instead. Turrets inherit 100% of your stats on top of Ingenuity, combine in the shop, and can be picked up (E) and redeployed. | **H** — Four carryable turret mounts is irresistible novelty | | |
| 3 | **Zephyr** | +20% reflex, +15% tempo, -15 vitality | Twinlash | Slipstream: dodging grants +40% Tempo for 2s and your next attack is a guaranteed crit. | **H** — Dodge-crits plus tempo bursts feel amazing | | |
| 4 | **Tollkeeper** | +5 greed | Pikefang | Toll Road: enemies drop double materials but gain +25% HP (affects the whole party). | **M** — Party-wide tradeoff sparks table arguments | | |
| 5 | **Duskblade** | +15% ferocity, -25 vitality | Vaultspike | Executioner: attacks never crit randomly; granted crits deal ×3 instead of ×2; your first hit against any full-HP enemy is a guaranteed crit. | **H** — Triple crits with a clear first-hit rule | | |
| 6 | **Rampart** | +6 grit, +20 vitality | Pikefang | Living Fortress: +1 permanent Grit per fight cleared, and +1% Ferocity per point of bonus Grit. | **M** — Ever-growing Grit that feeds damage back | | |
| 7 | **Onrush** | +25% tempo, -10 vitality | Threadneedle | Momentum: moving fills a meter (~2s, faster with Tempo); your next attack consumes it for up to +60% damage. | **H** — A visible meter you charge by playing well | | |
| 8 | **Vesper** | +8% recovery | Serpent Awl | Red Tithe: kills heal 1 HP (Recovery applies); healing beyond full HP becomes permanent Vitality, up to +3 per fight. | **M** — Overheal into permanent HP rewards sustain builds | | |
| 9 | **The Broker** | +10 greed | Pebbleshot | Insider Trading: shop prices −25%, reroll cost never compounds, and 7 weapon slots. | **M** — Cheap shopping with a slot squeeze | | |
| 10 | **Resonant** | +5% ferocity | Rustcleaver | Resonance: attacks build a charge ring (9 hits); when full, your next hit releases an attuned shockwave for 200% weapon damage. | **M** — The charge-ring shockwave is readable and rhythmic | | |
| 11 | **Facet** | +5 greed | Fanblade | Prism: entering each fight, pick 1 of 3 boons for that battle (quality scales with Greed). Any boon chosen 3 times becomes permanent. | **H** — A draft pick at every door; collection subgame | | |
| 12 | **Stillness** | +10% ferocity, +40 reach | Longbarrel | Overwatch: after 1.5s without attacking (moving is fine), your next attack is charged — ×2 damage and +50% Reach on that hit. | **M** — Hold-fire charge shots reward deliberate play | | |
| 13 | **Powderkeg** | +10 vitality | Kegbomb | Volatile Greed: materials explode on pickup for 4 + 40% of Greed attuned damage; blast radius 40 + 50% of Reach. | **M** — Pickup explosions that scale with Greed and Reach | | |
| 14 | **Quartermaster** | +5% ferocity | Gravelmouth | Arsenal Doctrine: cannot buy items; every weapon held also grants you the stats it scales with. Weapons sell for exactly the materials invested in them. | **M** — Weapons-only economy with full-refund selling | | |
| 15 | **Mirage** | +25% reflex | Frostscythe | Afterimage: dodging leaves a decoy that taunts nearby enemies for 2s, then bursts for attuned damage. | **M** — Decoys turn dodges into crowd control | | |
| 16 | **Banneret** | +10 vitality | Stormlance | Standard High: a banner aura (radius 150 + 50% of Reach) grants allies and summons +10% Ferocity and +20% Recovery, scaling with your Vitality. You get half. | **M** — The party wants to stand near you — solo it still works | | |
| 17 | **Sawbones** | +6% recovery | Bogflask | Field Rites: your overheal drips to the nearest injured ally; you revive allies 50% faster; each revive grants the party +3 permanent Vitality. Solo: overheal becomes a small shield (cap 15). | **M** — Medic fantasy with permanent party growth | | |
| 18 | **Lodestone** | +15 vitality, +3 grit | Gravemaul | Soulbond: a tether to your nearest ally — you share 30% of incoming damage and 25% of healing both ways; hitting the same enemy within 1s echoes attuned damage. Solo it binds your strongest summon; with none, it lies dormant. | **M** — A visible lifeline to your ally; co-op signature | | |
| 19 | **Voltaic** | +12% attunement, -10% ferocity | Sparkbolt | Attacks have a 30% chance to chain lightning to a nearby enemy at 60% damage (chains scale with Attunement). | **M** — Flashy chains with Attunement scaling | | |
| 20 | **Wisp** | +40% reflex, +10% tempo | Threadneedle | Reflex cap raised to 90% and +1% Ferocity per 1% Reflex, but Vitality is capped at 30. | **M** — Thrilling 30-HP evasion build for veterans | | |
| 21 | **Gilded One** | +15 greed | Kegbomb | Shops hold only the finest goods — legendary items or the floor's top weapon tier — but just 2 of them. | **M** — Legendary-only shop is a fun lottery | | |
| 22 | **Redmaw** | +20% ferocity, +15 vitality | Emberfang | Deals +1% Ferocity for every 1% of HP missing. | **M** — Simple readable berserker fantasy | | |
| 23 | **Glasswing** | +15% tempo, +10% reflex | Hailburst | Deals +50% damage — and takes +50% damage. | **M** — Double-edged risk appeals to gamblers | | |
| 24 | **Twinsoul** | +3 ingenuity | Pebbleshot | A mirror-drone hovers beside you, copying your first weapon at 50% damage. | **M** — Mirror drone doubles your favorite weapon | | |
| 25 | **Hemomancer** | -20 vitality | Stormlance | Innately heals 10% of damage dealt (Recovery applies); healing beyond full HP becomes a shield of up to 20. | **M** — Innate lifesteal with an overheal shield | | |
| 26 | **Jester** | +10 greed | Fanblade | Each attack that fails to crit adds +5% to the Jester’s own crit odds (cap 60%); a crit resets them. | **M** — Crit odds you can watch ramp on the meter | | |
| 27 | **Cindermage** | +15% attunement, -10% ferocity | Cinderspray | All attacks ignite for 4 damage/s over 2s (burns scale with Attunement). | **M** — Everything burns; clean Attunement identity | | |
| 28 | **Frostcaller** | +12% attunement, +5% tempo | Frostjar | All attacks chill, slowing enemies by 40% for 1.2s (chills deepen with Attunement). | **M** — Universal chill is strong utility | | |
| 29 | **Longshot** | +60 reach, +10% ferocity | Longbarrel | Deals +25% damage to enemies further than 250 units away. | **M** — Distance bonus suits natural snipers | | |
| 30 | **Threader** | +24 reach | Coilgun | All projectiles pierce +1 enemy. | **M** — Universal pierce is quietly excellent | | |
| 31 | **Tinker** | +6 ingenuity | Bolt Turret | Structures attack 25% faster, but you have only 4 weapon slots. | **M** — Faster turrets with a tight slot puzzle | | |
| 32 | **Hivewright** | +4 ingenuity, +10 vitality | Guard Drone | Gains a free Guard Drone at the start of every floor. | **M** — Free drone per floor compounds nicely | | |
| 33 | **Pulsar** | +15% attunement, +6 grit, -30 reach | Rustcleaver | Nova Core: while an enemy stands within 120, you pulse every 1.2s for attuned damage to everything in that fixed radius (Reach never changes it) and heal 1 HP per enemy struck. Each pulse that connects stacks +15% nova damage up to +150%; the stacks all fall off 2s after a pulse hits nothing. Only 3 weapon slots, and every weapon you hold is range-capped to 120. | **H** — Melee-range elementalist: half his damage is a fixed 120u nova | | |

## 3. Roster analysis

### Build-axis coverage (from the `roles` data)

| Axis | Count | Characters |
|---|---:|---|
| melee | 6 | Bulwark, Duskblade, Onrush, Resonant, Redmaw, Pulsar |
| ranged | 3 | Stillness, Longshot, Threader |
| tank | 3 | Bulwark, Rampart, Lodestone |
| dodge | 4 | Zephyr, Mirage, Wisp, Glasswing |
| speed | 3 | Zephyr, Onrush, Glasswing |
| crit | 2 | Duskblade, Jester |
| status | 7 | Resonant, Powderkeg, Mirage, Voltaic, Cindermage, Frostcaller, Pulsar |
| summons | 4 | Cogsmith, Twinsoul, Tinker, Hivewright |
| sustain | 3 | Vesper, Sawbones, Hemomancer |
| support | 3 | Banneret, Sawbones, Lodestone |
| economy | 7 | Tollkeeper, The Broker, Facet, Powderkeg, Quartermaster, Gilded One, Jester |

### What the rebalance resolved

- The 36-character near-duplicate clusters were merged: Bastion+Ironclad → **Rampart**,
  Duskblade+Lancer → **Duskblade** (Executioner), Lamprey+Bloodpetal → **Vesper**,
  Magnate+Highroller → **The Broker**. Fleetfoot/Skirmisher/Courier's "speed becomes value"
  triplet collapsed into **Onrush**'s visible momentum meter.
- The invisible-passive traits (Echo, Skirmisher, Chameleon, Lancer, Archivist) were cut or
  rebuilt around on-screen artifacts: charge rings, meters, decoys, auras, tethers, boons.
- Archivist's extra level-up choice survives as the **Archivist's Folio** Greed item.

### Watch items for playtesting

- Support (3) is new and co-op-shaped: Banneret/Sawbones/Lodestone solo modes work but are
  deliberately weaker halves — watch solo pick rates.
- Economy (7) remains the widest axis; the Toll Road party curse and Prism boons make it
  more interactive, but shop-time still concentrates there.
- Attunement is the most common weapon scaling tag (by design — every status weapon carries
  it), so status builds have the smoothest gearing curve. Ferocity is the safe generalist tag.

## 4. Brotato-resemblance inventory

What already diverges: the Isaac-style room dungeon, door countdowns, bosses,
co-op with downs/revives, elite/treasure/shop rooms, the sell/combine arsenal UI —
and, after the Great Rebalance, the stat system itself: a ten-stat sheet where any
stat can be a weapon's damage stat, granted-only crits, source×Recovery healing,
and traits that live on visible artifacts. What follows is the list of mechanics
that still trace back to Brotato, each with what changing it would ripple into.

| # | Mechanic (Brotato-shaped) | Ripple if changed |
|---:|---|---|
| 1 | Materials double as currency AND XP in one pickup | Splitting them changes drop tables, Greed's tithe, interest items, level pacing, the HUD, and both economy traits (Tollkeeper, Powderkeg). |
| 2 | Banked level-ups → pick 1-of-4 rarity-weighted stat boosts | Touches the statboost pool, the offer overlay, Greed's rarity bias, and the Archivist's Folio item. |
| 3 | Weapon tiers I–IV with duplicate-combining into the next tier | Touches shop pricing (tier multipliers), the arsenal combine UI, sell values, invested-materials lineage, and turret tier scaling. |
| 4 | Reroll/lock shop: 4 slots, escalating reroll cost, rarity weights 62/25/10/3 | The whole shop economy plus four traits (Broker, Gilded One, Quartermaster, Overseer stock) and lock carryover. |
| 5 | Six auto-attacking weapon slots, no aiming | Core combat identity; slot-altering traits (Broker, Tinker, Cogsmith) and the aim-free touch scheme depend on it. |
| 6 | Rarity bias multiplying uncommon+ weights (now Greed) | Shop, treasure, elite rewards, level-up boost sizes, and Prism boon quality all roll through the same function. |
| 7 | Summons/structures as a parallel damage class (now Ingenuity) | Four summon weapons, four summons characters, and summon-boost items. |
| 8 | Character = statline + one rule-breaking trait, huge roster | The roster's entire design language — though this is the genre hook you likely want to keep. |
| 9 | Elites as stat-multiplied base enemies with a modifier | Elite room rewards and floor pacing; a light resemblance, cheap to restyle. |
| 10 | Four-rarity item pool | Item catalog structure, shop card styling, Greed, and treasure/elite reward pools. |
| 11 | Wave-style spawn pulses inside a locked room | Room pacing, quota scaling, spawn telegraphs, and the co-op spawn multiplier. |
| 12 | Percent-stat tooltips and additive statline math | The sheet UI, boost pool, item stat blocks, and every trait that reads a stat. |

