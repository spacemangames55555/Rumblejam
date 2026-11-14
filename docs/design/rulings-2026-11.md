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
