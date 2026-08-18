# Where an enemy's HP actually comes from

Survey only. Reproduce with `node tools/hp_chain_audit.mjs`.

Question: region 2's roster is authored at a weighted mean of **8.64 HP**, its
world axis is **×2.13**, which composes to **~18**. The phase-1 survey measured
**171** mean HP in a region-2 room. Where does ×10 come from?

---

## Short answer

**It is ×19.8, not ×10, and only ×2.13 of it is the world axis.** The two
largest terms are not multipliers on the roster at all — one is *which node the
fixture walked into*, and one is *which units that node's profile draws*.

`roster_weight_gate` is **not** asserting the wrong figure. The parity rule is
intact. The 171 was my fixture's fault, and correcting it overturns the
headline finding of the phase-1 survey.

---

## The chain, in the order `spawnEnemyById` applies it

```
hp  = def.hp                          1. authored, js/content/enemies-<region>.js
    * regionHpMult(regionIndex)       2. REGION_HP_MULT, js/regions.js
    * this.coopHp                     3. party-size scaling, js/game.js
    * this.greedHp                    4. Tollkeeper's Toll Road curse (×1.25)
    * CONFIG.enemyHpMult              5. global knob, js/config.js
    * (elite ? ELITE_HP_MULT : 1)     6. CONFIG.ELITE_HP_MULT, per-enemy flag
    * (fightMods.hp || 1)             7. §2.4 node modifier, per NODE
    * curseEnemyHp                    8. cursed round, per NODE
    * (opts.hpMult || 1)              9. objective variant (elite arena, bounty)
    * (noObjHp ? 1 : objHpMult)      10. objective level dial (Nest Purge +50%)
    * (mini ? 0.35 : 1)              11. splitter spawn
```

Measured at the moment of spawn, in the room the phase-1 survey used:

| # | factor | value | source |
|---|---|---|---|
| — | authored draw-weighted mean | **8.64** | `enemies-xibalba.js`, weights `w` |
| — | **spawn composition** | **×3.01** → 26.03 | the node's profile re-weights the bag |
| 2 | `regionHpMult` | **×2.13** | `REGION_HP_MULT`, `js/regions.js` |
| 3 | `coopHp` | ×1.15 | party size, `js/game.js` |
| 4 | `greedHp` | ×1.00 | Toll Road curse, not held |
| 5 | `CONFIG.enemyHpMult` | ×1.12 | `js/config.js` |
| 6 | `ELITE_HP_MULT` | ×1.00 | no per-enemy elite flag in this room |
| 7 | **`fightMods.hp`** | **×2.40** | §2.4 node modifier — **the node is an elite node** |
| 8–11 | curse, objVariant, objLevel, mini | ×1.00 | none active |

`26.03 × 2.13 × 1.15 × 1.12 × 2.40 = 171.4`. That is the 171.

### Ranked by size

| term | value | is it a difficulty axis? |
|---|---|---|
| spawn composition (elite/artillery profile) | ×3.01 | no — it is which units the bag draws |
| §2.4 node modifier (`fightMods.hp`) | ×2.40 | yes, but PER NODE, not per region |
| world axis | ×2.13 | **yes, the intended one** |
| `coopHp × CONFIG.enemyHpMult` | ×1.29 | no — a uniform global constant |

---

## Is `roster_weight_gate` gating the wrong number?

**No.** Stated plainly, because the consequence if it were would be large.

The gate asserts the **draw-weighted authored mean of `def.hp`** — 8.39 for
region 1, 8.64 for region 2, both inside the 7.9 ±15% band. That is step 1 of
the chain and it is deliberately pre-axis: the parity rule exists to stop a
roster carrying band scaling *in addition to* the world axis, and the only way
to check that is to compare tables to tables.

The check that the rule actually holds in play is the **non-axis multiplier**,
and on a plain combat node it is a constant:

| region | authored (spawn-weighted) | composed × | → maxHp | axis | non-axis × |
|---|---|---|---|---|---|
| 1 | 6.67 | 1.30 | 8.7 | 1.00 | **1.30** |
| 2 | 9.14 | 2.73 | 25.0 | 2.13 | **1.28** |
| 3 | 10.52 | 4.65 | 48.9 | 3.84 | **1.21** |
| 4 | 7.72 | 5.55 | 42.9 | 4.33 | **1.28** |
| 5 | 7.57 | 6.78 | 51.4 | 5.29 | **1.28** |
| 6 | 7.70 | 7.76 | 59.8 | 6.02 | **1.29** |
| 7 | 6.39 | 9.48 | 60.6 | 7.35 | **1.29** |
| 8 | 7.29 | 9.48 | 69.2 | 7.36 | **1.29** |

**1.21–1.30 in every region** — that is `coopHp 1.15 × CONFIG.enemyHpMult 1.12
= 1.288`, a uniform constant that shifts every region identically and therefore
changes no relative difficulty. **The world axis is the sole *varying*
multiplier on a plain combat node, exactly as the design says.**

Two caveats worth stating rather than burying:

- The gate asserts the **draw-weighted** mean; what a room actually fields is
  the **spawn-weighted** mean, and a node profile can re-weight the bag hard
  (×3.01 in the elite/artillery room above). The parity rule governs the table;
  it does not govern what a profile draws from it. That is a real gap in
  coverage, but it is a *profile* question, not a roster-parity failure.
- Regions 3–8 have no authored roster yet, so their `def.hp` comes from the
  base 12-enemy table. Their "authored" column is not a regional roster and the
  parity band does not apply to it.

---

## The correction this forces to the phase-1 survey

Phase 1's section 4 said, as its headline finding:

> *Region 2 fields the toughest bodies in the game at 171 HP; region 8, at
> ×7.36 the multiplier, fields 68.8. The axis is applied per-body, so a region
> whose roster is mostly chaff comes out softer than one with heavy units.*

**That is wrong.** The selector `depth > 1 && template && kind !== 'shrine'`
picked an **`elite` node with profile `artillery`** in region 2 and a **`relic`
node with profile `puddle`** in region 8. Two different node kinds, one with a
×2.40 modifier and a heavy-drawing profile. It was not a like-for-like
comparison and the conclusion drawn from it does not survive one.

Measured like for like, on a plain **combat** node in every region:

| region | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| mean maxHp | 8.6 | 26.8 | 53.7 | 52.3 | 60.8 | 69.3 | 74.7 | **85.0** |
| incoming HP/sec | 0.3 | 7.0 | 22.6 | 17.5 | 10.2 | 19.9 | 28.3 | **30.0** |
| peak alive | 5 | 27 | 52 | 71 | 35 | 34 | 145 | 101 |

**Both rise across the run.** Per-body HP goes 8.6 → 85.0 tracking the axis;
incoming goes 0.3 → 30.0. Region 8 is the hardest region on both axes, not the
softest. The phase-1 claim that "lateness is not currently harder" is
withdrawn.

*(Regions 4 and 5 dip on incoming — 17.5 and 10.2 against region 3's 22.6.
Peak-alive moves the same way, so that reads as spawn-budget variance between
templates rather than a curve problem. Worth a look, not a headline.)*

### What that does to the phase-2 diagnosis

The phase-1 report named two causes. One survives, one does not.

- **Survives:** growth is real but modest — +40% from level 60 to 80 — and it
  is spent on enemies that die in one hit either way. Section 6's overkill
  measurement is unaffected by the node error (it used region 8 for both arms).
- **Withdrawn:** "the world axis raises per-body numbers and region 8's roster
  is light." The axis works. Region 8's bodies are 10× region 1's and its
  incoming is 100× region 1's.

So the remaining question for phase 2 is narrower and cleaner: **the curve
rises, and player output rises with it — why does the fight not feel harder?**
The overkill number (16.4%, flat across build shapes) and the throughput
figures (a level-82 build clearing 333 bodies in ~45 s) are where that has to
be answered, not in the axis.

---

## Method note

This is the third time in this patch that a fixture picked the wrong subject
and produced a confident wrong number — after `learnableSkills()` returning
already-learned nodes, and `p.level` assigned without stat picks. All three had
the same shape and all three were caught by asking what the number would have
to be if the fixture were right. §13 rule 82.
