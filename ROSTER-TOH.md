# Thrones of Heaven — the second roster

Fourteen warriors, an alternate cast for the same game. Weapons, items, stats,
maps, objectives and netcode are **shared** with the classic 33 and are not
forked; only the character list and its traits are new.

## Switching rosters

| where | how |
|---|---|
| URL | `?roster=toh` or `?roster=classic` (persists to localStorage) |
| storage | `localStorage['undervault.roster']` |
| lobby | the roster buttons above the character grid — **host only** |
| default | `classic` |

**The host owns the choice.** It rides every lobby broadcast, the `start`
message and the `abandon` message, and a joining client force-corrects to the
host's roster whatever its own URL or storage said — a mismatch would look up
the host's character ids in the wrong table and silently desync every trait in
the party. The client logs a warning when it has to move.

Switching rosters in the lobby clears everyone's character pick, because the
ids in one roster do not exist in the other.

Files: `js/content/characters-classic.js` (frozen), `js/content/characters-toh.js`,
`js/content/characters.js` (the selector), `js/roster.js` (URL/storage/co-op
guard), `js/traits-toh.js` (the trait engine).

## The fourteen

Sheets are modifiers on the shared base (80 Vitality, everything else 0).

| | Name | Roles | Sheet | HP | Weapon | Trait |
|---|---|---|---|---|---|---|
| ⛨ | **Blacksmith** | tank, melee | +70 Vit, +8 Grit, −20% Tempo | 150 | Gravemaul | `crystal_infusion` |
| ♨ | **Wizard** | status, support | +15% Att, +20 Reach, −10% Fer | 80 | Magmalob | `decree` |
| ⚙ | **Necromancer** | summons | +10 Ing | 80 | *none* | `bonelord` |
| ◐ | **Druid** | economy, summons | +5 Greed | 80 | Fanblade | `wildshape` |
| ◈ | **Mage** | ranged, control | +8% Att, +30 Reach | 80 | Coilgun | `singularity` |
| ➶ | **Bard** | speed, support | +15% Tempo, −10 Vit | 70 | Twinlash | `rhythm` |
| 〜 | **Witch Doctor** | sustain, status | +6% Rec, +5% Att | 80 | Bogflask | `voodoo_link` |
| ⚔ | **Samurai** | melee | +8% Fer, +10 Vit | 90 | Rustcleaver | `three_stances` |
| 𖤓 | **Monk** | dodge, sustain | +12% Ref, +6% Rec, +2 Grit | 80 | Twinlash | `karma` |
| ☽ | **Assassin** | crit, economy | +12% Fer, +8 Greed, −25 Vit | 55 | Vaultspike | `contract` |
| ✚ | **Priest** | support, sustain | +8% Rec, +10 Vit | 90 | Sparkbolt | `grace_and_judgment` |
| ⽕ | **Savage** | melee | +10% Fer, +10 Vit | 90 | Gravemaul | `blood_dance` |
| ⬡ | **Hunter** | summons, ranged | +5 Ing, +20 Reach | 80 | Pebbleshot | `pack_tactics` |
| ≋ | **Sundian** | status, speed | +10% Att, +8% Tempo, −10 Vit | 70 | Pikefang | `coral_growth` |

No trait key here collides with a classic trait key, and no character id
collides with a classic id (ToH ids are `toh_`-prefixed).

## Traits

**⛨ Blacksmith — `crystal_infusion`.** Cannot be pushed; hitbox ×1.4. Enemies
touching you take `3 + 25% Grit + 5% Vitality`. After every fight cleared,
infuse one crystal permanently — Iron Pyrite (+2 Grit), Prism Quartz (+4%
Attunement) or Celestial Calcite (+5% Recovery). No cap. Every third Prism
Quartz makes contact damage detonate for attuned damage in a 90u radius. The
choice reuses Facet's post-fight picker with three fixed options.

**♨ Wizard — `decree`.** Every 7s (divided by `1 + Tempo/100`) a Decree fires,
alternating, Calamity first. **Calamity**: 14 attuned damage to every enemy on
screen; anything it kills spreads a plague to enemies within 120u for 4 attuned
damage/s over 3s. **Miracle**: heal 8 and grant +10% Ferocity for 4s to every
ally within 220u + half Reach. Solo, Miracle heals only you.

**⚙ Necromancer — `bonelord`.** No weapons; 4 summon mounts. Summons inherit
100% of your stats on top of Ingenuity, combine in the shop and can be carried
(E). Enemies dying within 200u repair your most damaged summon by 6 HP. All
four mounts fused into one makes the **Marrownaut**: while it lives you gain
100% of its Grit and 50% of its Vitality.

**◐ Druid — `wildshape`.** Facet's prism, reskinned: 1 of 3 splices per fight,
quality scaling with Greed, permanent at 3 takes — and every permanent fusion
also grants +1 Greed.

**◈ Mage — `singularity`.** Every 9th attack collapses a singularity at the
point of impact: enemies within 110u + half Reach are pulled in for 1.5s, then
it bursts for 16 attuned damage. Anything inside takes **+25% damage from every
source, allies included**. **Crystalblade**: with an enemy within 90u you gain
+5 Grit and singularities form on you instead of on the target.

**➶ Bard — `rhythm`.** Attacking with no gap longer than 1.5s builds a stack,
max 10, each +4% Tempo and +3% Ferocity. Missing the window drops them all.
**Ensemble**: any ally within 160u + half Reach receives half your stack
bonuses. **Solo**: with nobody in that radius, your own bonuses double.

**〜 Witch Doctor — `voodoo_link`.** The nearest enemy is bound to your doll and
rebound when it dies or leaves range. 35% of all damage you deal is mirrored
onto it through walls and across the map. Mirrored damage never mirrors again.
On its death the link stitches to 2 enemies within 150u for 3s, and you heal
5% of everything that enemy absorbed while bound.

**⚔ Samurai — `three_stances`.** Q on a keyboard, the stance button on touch,
0.5s cooldown. **Iron**: +6 Grit, and 20% of what Grit absorbs is banked onto
your next attack. **Precision**: your first hit on any enemy crits and bleeds it
for 4s at 15% of Ferocity per second. **Flow**: each consecutive hit on a *new*
enemy grants +8% Tempo, to 5 stacks; the same enemy twice resets it.

**𖤓 Monk — `karma`.** Damage taken banks as Karma, capped at 40; your next
attack releases all of it. **Astral Projection**: dodging leaves a spirit for 3s
that copies every attack at 50% damage and regenerates 2 HP/s. Dodging again
refreshes it rather than spawning a second.

**☽ Assassin — `contract`.** One enemy per fight is marked — elite or boss
first, otherwise the healthiest. Killing it pays `5 + Greed` materials and
grants +15% Ferocity for the fight, stacking. A new mark 3s later. Separately:
never crits at random, granted crits deal ×3, the first hit on any full-HP
enemy always crits, and any kill makes you untargetable for 1.2s.

**✚ Priest — `grace_and_judgment`.** All healing you cause generates Grace 1:1.
At 25 it spends: shields the most injured ally within 200u + half Reach (or you,
solo) for `12 × (1 + Recovery/100)`, and smites the nearest enemy for attuned
damage equal to that shield. Shields reflect 30% of what they absorb. You revive
50% faster and every revive grants the party +3 permanent Vitality.

**⽕ Savage — `blood_dance`.** Heat: +8% Ferocity per connecting attack to
+120%, all of it gone 3s after the last hit. Blood: +0.8% Ferocity per 1% of max
HP missing. 8% of damage dealt leeches back. Weapons with a base cooldown ≥1.5s
deal +15%.

**⬡ Hunter — `pack_tactics`.** A free beast per floor, up to 4 alive. **Alpha's
Fury**: with 2+ beasts within 120u, you and every beast gain +20% Ferocity and
+10% Tempo. **Marksman**: with no beast within 250u, projectiles pierce +1 and
deal +8% per living beast. A combined beast counts as two for both checks.

The beast is a **melee pet**, not a drone — `js/entities/beast.js`. It meanders
within 320u of you, pursues an enemy inside 320u of itself, bites on contact,
and is hard-clamped to 640u from you in every state. It **body-blocks enemies
and enemy fire**, and passes through you, other players and their beasts. At 0
HP it is knocked **down for 15s** — inert, not deleted, still holding its Pack
Tactics slot — and revives on you at full HP. A downed beast does not count for
Alpha or Marksman; Marksman's wording was already "per *living* beast".

Its HP, damage and cooldown are still `guard_drone`'s, scaled by Ingenuity
exactly as before (30 × tier × (1 + 0.1 × Ingenuity) = 45 at level 1). **Only
the delivery changed**, from a ranged shot to a bite.

**≋ Sundian — `coral_growth`.** Every 4th attack plants a node for 8s, slowing
enemies within 60u by 35% and dealing 5 attuned damage/s. Two nodes within 100u
grow a 40 HP wall that stops enemies and **enemy** projectiles but never yours.
Walking your own node refreshes it and grants +15% Tempo for 2s. **8 nodes max.**

## Item interactions (the classic catalog is shared and unchanged)

- **Assassin** — every random-crit item (Tenth-Strike Tally, Jester's Own Deck,
  every-Nth-attack effects) is dead weight: crits fire only where granted. They
  stay in his pool; the tradeoff is intentional, exactly as it is for Duskblade.
- **Savage** — Reach does nothing for the trait but still helps weapons. As-is.
- **Necromancer** — weapon-granting items and weapon-slot effects are inert,
  same as Cogsmith today.
- **Bard** — Tempo items compound with stacks. Measured solo at max stacks:
  **+80% Tempo from stacks alone** (10 × 4% × the ×2 solo multiplier), before a
  single Tempo item. Watch this one.
- **Priest** — the engine is off until the player has a healing source. Confirm
  a sustain item can appear in his first two shops.
