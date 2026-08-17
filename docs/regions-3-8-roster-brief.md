# Regions 3–8 — roster design brief

A design document to fill, not an implementation spec. Nothing gets built until the slots are filled.

Regions 1 and 2 are done and each surfaced a defect class nobody predicted. What they cost is now written down here as constraints, most of them enforced by `tools/roster_weight_gate.mjs` rather than by memory.

---

## Fixed constraints — every region, no exceptions

| # | Constraint | Enforced by |
|---|---|---|
| 1 | **7 units** — 6 combat archetypes plus one `behavior: 'nest'` | `regions.js` asserts 6 combat; the nest is new, see below |
| 2 | **Authored weighted mean 7.9 HP / 3.45 damage, ±15%** | `roster_weight_gate` check B |
| 3 | **Telegraph density ≥50%** by encounter weight | `regions-enemies.js` load assertion **and** gate check A |
| 4 | **≥2 telegraphers below the roster's own median HP** | gate check C |
| 5 | **Light telegraphers punish for 6–9% of anchor vitality** | gate check D |
| 6 | **≥1 landmark: above 2× median HP at draw weight < 0.3** | gate check E |
| 7 | **Identity is composition, never weight** | not gateable — the reason the rest exist |

**On constraint 2.** The world axis (`REGION_HP_MULT`, `js/regions.js`) is the sole difficulty multiplier and it is measured against player output at each anchor level. A roster that also carries band scaling multiplies the axis a second time — Central America was authored at ×3.3 the floor-1 table *and* multiplied by ×2.13, arriving at 7.02× floor 1 for a player roughly 2.1× stronger. Same band at region 1 and region 8.

**On constraint 5.** Neither weighted mean in constraint 2 contains a telegraph's damage or its cooldown, so both can land while the fight plays wrong — that is §13 rule 78, and it is why this is a separate check. Region 1 sat at parity on HP and damage and still killed a camper at 71s, because a 7 HP unit was landing 9 damage every 2.2 seconds: harder per commit than a 34 HP Bark Hulk lands per second.

The band is gated on the **light** telegraphers only. A landmark hitting hard is the point of a landmark — the Bark Hulk lands 33.8% of a level-1 character and the Jade Colossus 47.5% of a level-10 one, and neither should be inside the band. Every telegrapher's percentage is printed regardless.

*Known limit:* vitality grows from banked stat picks, which a harness never spends, so every anchor currently measures 80 and the band is in practice a flat 4.8–7.2 damage. The gate says so in its own output rather than implying level scaling it does not have.

**On constraint 6.** Both halves together. Heavy alone is a slab you meet constantly; low draw weight alone is a rare mid unit. Landmark frequency goes inverse to weight — region 2's 52 HP Colossus sits at w 0.18 against region 1's 34 HP Hulk at w 0.25, or the heaviest region becomes the one you meet slabs in most often.

---

## The escalation model

Each region escalates **the read**, not the numbers. This is the spine of the progression and the first two established it:

- **R1 Pacific Northwest** — *learn the read.* Single clear telegraphs on light units, small close zones. The commonest unit is a telegrapher, so the thing you meet most is the thing that teaches you.
- **R2 Xibalba** — *overlapping zones.* A wider cone and a longer lane on the two commonest units, so leaving one can put you inside the other. R1's lesson still works; it is no longer sufficient.

Regions 3–8 each need **one escalation axis**. An axis should appear once as a region's identity; re-using one later as a supporting element is fine.

### Candidate axes, split by what they cost

`js/telegraphs.js` states the commit rule in its own header: *"the zone is computed once, at the start of WINDUP, and never updates. The enemy does not track you through the wind-up… an enemy that reaims during wind-up produces an undodgeable attack and defeats the patch."* One telegraph per def, one fixed `windupMs`, states `IDLE → WINDUP → RESOLVE → RECOVER`. That divides the axes sharply:

**Content-only — a roster edit, ships the way regions 1–2 did**

| Axis | Note |
|---|---|
| Direction punishment — the safe exit from one zone is the entrance to another's | Pure zone geometry and placement. The natural successor to R2's overlap |
| Off-screen / orbiter telegraphs — the threat isn't where you're looking | `orbiter` exists but is chaff-only today; needs it added to `COMMITTING_BEHAVIORS` or a new committing behaviour beside it |
| Synchronized commits — multiple units resolve on the same beat | Reachable by tuning `cooldownMs` to a shared period, though not *guaranteed* by it — a real guarantee needs a shared clock |

**Engine work first — scope before committing a region to it**

| Axis | What's missing |
|---|---|
| Variable or delayed timing | `windupMs` is one constant per def |
| Tracking telegraphs | Directly contradicts the stated commit rule. This is a design argument before it is an implementation |
| Chained telegraphs — one commit sets up the next unit's | No cross-unit trigger exists |
| Feints — a wind-up that doesn't resolve | `retryFrac` is a balk-and-retry timer, not a resolve-or-not decision. Needs a new state in the machine |
| Environmental telegraphs — hazards and walls participate | Hazards and walls are outside the telegraph state machine entirely |

**Region 3 should take a content-only axis.** The order below says take it through the full pipeline first; that shakedown is most useful if it is about rosters and art, which is where both known defect classes came from, rather than mixed with a telegraph-system change.

---

## Behaviours

**Twelve are defined** (`BEHAVIOR_PARAMS`, `js/content/regions-enemies.js`):

`chaser` · `sprinter` · `brute` · `splitter` · `warden` · `spitter` · `orbiter` · `bomber` · `medic` · `nest` · `dasher` · `sniper`

**`COMMITTING_BEHAVIORS` — the only ones that may telegraph:** `brute`, `warden`, `dasher`.
Every committing unit **must** telegraph and every non-committing unit **must not** — both are load assertions. The set is named for commitment rather than mass on purpose: naming it `HEAVY_BEHAVIORS` is what made a readability floor import a weight goal (§13 rule 77).

**Required fields per behaviour.** A missing one is not a soft failure — it throws on the unit's first tick:

| Behaviour | Must declare |
|---|---|
| `spitter` | `keepDist`, `fireCd`, `proj` |
| `orbiter` | `orbitR`, `diveCd`, `diveWindup` |
| `bomber` | `boom`, `triggerDist` |
| `medic` | `healR`, `healPs` |
| `nest` | `spawnCd`, `maxBrood`, `broodId` |
| `dasher` | `dash` |
| `sniper` | `beam` |
| `chaser`, `sprinter`, `brute`, `splitter`, `warden` | nothing |

`warden`'s ally aura (`shieldR`, `shieldReduce`) is **optional** — region 1's 7 HP Sapling is a warden with none. Reserve it for landmarks.

A new region may introduce a new behaviour if its escalation axis needs one. **Say so rather than forcing the axis into an existing behaviour.**

---

## The nest archetype — why 7 units, not 6

Nest Purge builds its level around a `behavior: 'nest'` spawner. **Neither built region authors one**, so regions 1 and 2 currently borrow the base roster's `wombden` and its `flit` brood — a star-shaped dungeon spawner in a cedar forest.

The wiring is done: `nestIdFor(sim)` in `js/objectives.js` resolves from the region and falls back with the gap reported by `region_wire_gate`. It picks up a region's own nest **the moment one exists**, with no code change.

So each region needs a seventh unit. It is not part of the six that carry the weighted means — it spawns as level furniture rather than from the draw — but it is a seventh silhouette to draw, and it needs `spawnCd`, `maxBrood` and a `broodId` naming one of the region's own chaff.

---

## Per-region slots to fill

For each of regions 3–8:

| Field | Notes |
|---|---|
| **Theme / mythology** | |
| **Tileset** | `tundra` is spoken for by the Russian / necromancer region — assign it an index. It is declared in `js/biomes.js` and worn by nothing |
| **Escalation axis** | one from the list above, or a new one — state which side of the content/engine split it lands on |
| **6 combat units** | name, behaviour, role |
| **1 nest archetype** | `spawnCd`, `maxBrood`, `broodId` pointing at one of the six |
| **Which 2+ are light telegraphers** | below median HP, punishing for 6–9% of anchor vitality |
| **Which 1–2 are landmarks** | above 2× median HP at draw weight < 0.3 |
| **Cursed modifier** | one per region, unique. `js/nodebehaviour.js` |
| **Hazard** | one per region |
| **Boss** | two-phase, and phase 2 must change the zone SHAPE rather than its numbers |

### Checklist when a region actually lands

Every one of these is a load assertion or a gate, and they fire in roughly this order:

1. Add to `REGIONS` in `js/regions.js` — needs `index`, `expectedLevel`, `domainSkew`, `tileset`, `hazard`, `cursedModifier`, `enemies` (6 ids), `boss`, `tuning`, `contentReady`.
2. **Remove its name from `LOCKED_REGION_NAMES`** — built plus named must equal 8, and this assertion fires at import.
3. Add the population to `REGION_ENEMIES` in `js/content/regions-enemies.js`; ids must be globally unique across regions.
4. Boss needs `telegraph` **and** `p2` with its own telegraph of a *different shape*.
5. Add its tileset to `BIOMES` in `js/biomes.js`, or leave `tileset` naming one that exists. `REGION_BIOMES` derives from `REGIONS[].tileset` — there is no second table to update.
6. Regenerate `assets/assets.json` and `docs/prompts.json`.
7. Run `roster_weight_gate`, `region_wire_gate`, `telegraph_test`, `region_test`.

Bosses: regions 3, 4, 5 and 8 currently take redistributed legacy bosses; **6 and 7 fall back loudly** with a logged warning. All six need one eventually.

---

## Two things worth deciding early

**Art scope.** 6 combat units + 1 nest × 6 regions = **42 units**, hand-drawn, plus 6 bosses. At the current per-unit cost this is the largest remaining work item in the project by a wide margin. Worth deciding now whether all six regions ship at launch or whether 3–4 ship and 5–8 follow.

**Region 2's opening.** The onboarding ramp is region-1-only by construction (`onboardingMult` returns 1 unless `regionIndex === 1`), so region 2's map 1 is full density and kills a camper at 46–50s against region 1's map 1, where the same camper survives indefinitely. That is the sharpest difficulty step in the game. It may be correct — watch it in playtest before treating it as a defect — but it sets the precedent for how regions 3–8 open.

---

## Order

**Fill region 3 first and take it through the full pipeline — roster, gate, art, playtest — before specifying 4–8.**

Two regions have now each surfaced a defect class nobody predicted: region 1's readability-imported-weight coupling, and region 2's the-same-coupling-uncaught-because-the-gate-had-an-opt-in-list. A third will too, and it is cheaper to find it once than six times.
