// TELEGRAPH DENSITY AND ROSTER WEIGHT, ASSERTED TOGETHER.
//
// Either one alone is satisfiable by breaking the other, and that is how the
// Pacific Northwest got to ×2.14 the HP of the floor-1 table it replaced.
//
// The region rosters were authored to a readability goal: at least half the
// population, by encounter weight, must telegraph, so the hold-or-break
// decision is a read rather than arithmetic. Nothing was authored to a weight
// goal — and `HEAVY_BEHAVIORS` quietly supplied one, because the only
// behaviours allowed to telegraph were the three the roster had authored as
// slabs. **A readability goal imported a weight goal through a set named for
// mass.** Meeting the density floor meant putting more heavy units in the room.
//
// Telegraph is an ANIMATION AND TIMING property. It has no necessary
// relationship to HP: a unit that winds up visibly and dies in two hits is a
// perfectly good teacher, and region 1 — where a player learns to read wind-ups
// at all — wants exactly that. So this gate asserts both halves at once:
//
//   A. Telegraph density ≥ the declared floor, by encounter weight.
//   B. Weighted mean HP and damage within a band of the FLOOR-1 TABLE — the
//      same band for every region, 1 through 8.
//   C. At least two telegraphers BELOW the roster's median HP, so the read can
//      be learned against something that dies before the lesson is punishing.
//      A and B together are still satisfiable by one 4-HP telegrapher carrying
//      the density while every other committing unit is a slab.
//   D. Those light telegraphers' PUNISH sized to the vitality a character
//      carries at the region's own anchor level — 6–9%. This is §13 rule 78 in
//      gate form: neither mean in B contains a telegraph's damage or its
//      cooldown, so both can land while the fight plays wrong. Measured, region
//      1 sat at parity on HP and damage and still killed a camper at 71s,
//      because a 7 HP unit was landing 9 damage every 2.2 seconds — harder per
//      commit than a 34 HP Bark Hulk lands per second.
//   E. At least one LANDMARK: a unit above 2× the roster's median HP at a draw
//      weight below 0.3. Both halves together. Heavy alone is a slab everywhere
//      and the region has no texture; low-weight alone is a rare mid unit and
//      the region has no skyline.
//
// D IS GATED ON THE LIGHT TELEGRAPHERS ONLY, and that is a deliberate reading.
// Applied to every telegrapher the band fails both built regions on their
// landmarks — the Elk lands 23.8% of a level-1 character and the Bark Hulk
// 33.8%, the Bloodpriest 30.2% and the Jade Colossus 44.2% — and a landmark
// hitting hard is the whole point of a landmark. Rule 78's term was the LIGHT
// units: the ones common enough that their punish is what a player is actually
// standing in. Every telegrapher's percentage is printed regardless, so the
// stratification is visible rather than assumed.
//
// EVERY REGION'S ROSTER IS AUTHORED AT FLOOR-1 PARITY. THE WORLD AXIS IS THE
// SOLE DIFFICULTY MULTIPLIER.
//
// This is the rule the gate exists to hold, and it is not a region-1 rule with
// exceptions. `REGION_HP_MULT` already scales every region's enemies — it is
// measured against player output at each of §4.3's level anchors, and it is
// applied to authored HP at spawn. A roster that ALSO carries band scaling
// multiplies the axis a second time: Central America was authored at ×3.3 the
// floor-1 table and then multiplied by ×2.13, arriving at 7.02× floor 1 for a
// player who is roughly 2.1× stronger.
//
// So a region's identity is COMPOSITION — which behaviours it fields, what
// shapes its telegraphs draw, how its slabs and its lights are distributed —
// and never weight. Two regions with identical weighted means can play nothing
// alike; two regions differing only in weight are the same region twice with
// one of them wrong.
//
// THE COMPOSED FIGURE IS REPORTED AND NEVER GATED. It is `mean × axis`, a
// derived quantity, and gating it would invite satisfying the check by moving
// the axis — which is the one number here that was measured rather than
// authored (`tools/region_curve.mjs`).
//
// Usage: node tools/roster_weight_gate.mjs [--verbose]
import { REGION_ENEMIES, telegraphWeight, MIN_TELEGRAPH_WEIGHT, HORDE_MIN_TELEGRAPH_WEIGHT, HORDE_MAX_TELEGRAPH_WEIGHT, HORDE_MIN_TELEGRAPH_SHAPES, enemyRole } from '../js/content/regions-enemies.js';
import { CONFIG } from '../js/config.js';
import { ENEMY_BY_ID, FLOOR_TABLES } from '../js/content/enemies.js';
import { REGIONS, regionHpMult, regionDmgMult, enemyHpAxis, TOTAL_REGIONS, REGION_ANCHOR_LEVEL, REGION_OPENER_PACKET } from '../js/regions.js';
import { Sim } from '../js/game.js';
import { DISADVANTAGE_MULT } from '../js/domains.js';
import * as SKILLSIM from '../js/skillsim.js';
import { stepDamage } from '../js/compose.js';
import { TREES, TREES_BY_CLASS } from '../js/skills.js';
import { SELECTABLE } from '../js/content/characters.js';

const VERBOSE = process.argv.includes('--verbose');
let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };

// Weighted by encounter weight, which is the only average that describes what a
// player actually meets. An unweighted mean counts the Bark Hulk exactly as
// often as the Sapling, and the whole lever this patch used was the weights.
const weightedMean = (units, f) => {
  let n = 0, d = 0;
  for (const e of units) { n += e.w * f(e); d += e.w; }
  return d ? n / d : 0;
};
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// VITALITY AT A LEVEL, MEASURED RATHER THAN TABLED. There is no formula to
// read: a character's health comes from banked stat picks and from whatever its
// class starts with, so the only honest source is a character that has actually
// been levelled. Median across the selectable roster, because one class is not
// the anchor — the Blacksmith carries 150 where three others carry 80, and
// sizing a region's punish to the tankiest class would under-punish everyone.
//
// AND IT BARELY MOVES WITH LEVEL, WHICH THIS SAYS OUT LOUD. Vitality grows from
// BANKED STAT PICKS — a player's choice at a level-up screen — and a harness
// does not make choices, so a level-10 character here carries the same base its
// class started with. Measured, level 1 and level 10 both resolve to 80.
//
// That is a real limit on what D asserts, not a bug to hide: while the input is
// flat, "6–9% of anchor vitality" is in practice "between 4.8 and 7.2 damage" at
// every region. It is still the term §13 rule 78 is about and still the term
// neither weighted mean contains — but a check whose input does not vary is a
// saturated instrument (§13 rule 37), so the gate prints the figure per anchor
// and calls out the collision rather than letting a reader infer level scaling
// that is not there. Model banked picks and this band tightens by itself.
const vitalityCache = new Map();
function anchorVitality(level) {
  if (vitalityCache.has(level)) return vitalityCache.get(level);
  const vs = [];
  for (const c of SELECTABLE) {
    const g = new Sim({ seed: 4242, regionIndex: 1, allowUnplayable: true,
      party: [{ idx: 0, key: 'k', name: 'P', charId: c.id, color: '#fff' }] });
    const p = g.players[0];
    if (p.openingOffer) g.uiAction(0, { kind: 'opening', id: p.openingOffer[0].id });
    p.level = level;
    const skills = (TREES_BY_CLASS[c.id] || []).flatMap(t => TREES[t].skills).sort((a, b) => a.tier - b.tier);
    let budget = level - 1;
    for (const sk of skills) {
      if (budget <= 0) break;
      p.skillPoints++;
      if (SKILLSIM.spendSkillPoint(g, p, sk.id)) budget--; else p.skillPoints--;
    }
    g._recomputeStats(p);
    vs.push(p.stats.vitality);
  }
  const v = median(vs);
  vitalityCache.set(level, v);
  return v;
}

// D's band, and E's two halves.
const PUNISH_LO = 0.06, PUNISH_HI = 0.09;
const LANDMARK_HP_MULT = 2, LANDMARK_MAX_W = 0.3;

// The roster region 1 replaces. Floor 1's table, at ×1.00, is the yardstick.
const FLOOR1 = FLOOR_TABLES[0].map(id => ENEMY_BY_ID[id]);
const REF_HP = weightedMean(FLOOR1, e => e.hp);
const REF_DMG = weightedMean(FLOOR1, e => e.dmg);
const BAND = 0.15;

// EVERY BUILT REGION IS GATED. There is no such thing as a region whose roster
// band is an open question: the band is floor-1 parity, always, and the world
// axis carries the difficulty. A region added to `REGIONS` is gated the day it
// is added, with no list here to remember to update — which is the point, since
// a gate with an opt-in list is a gate that is green about whatever is not on
// it (§13 rule 73).

console.log('ROSTER WEIGHT AND TELEGRAPH DENSITY — the two halves of one coupling\n');
{
  // Say it once, up front, rather than leaving it to be noticed in two rows.
  const byAnchor = REGIONS.map(r => [r.index, REGION_ANCHOR_LEVEL[r.index - 1], anchorVitality(REGION_ANCHOR_LEVEL[r.index - 1])]);
  const distinct = new Set(byAnchor.map(x => x[2]));
  console.log('anchor vitality: ' + byAnchor.map(([i, lv, v]) => `region ${i} (level ${lv}) ${v}`).join(', '));
  if (distinct.size === 1 && byAnchor.length > 1) {
    console.log('  NOTE: every anchor resolves to the same vitality. Vitality grows from BANKED STAT PICKS, which a harness');
    console.log('  never spends, so check D is currently a flat absolute band rather than a level-scaled one. Stated so the');
    console.log('  label does not imply scaling the measurement does not have (§13 rule 37).');
  }
  console.log('');
}
console.log(`reference: floor-1 table (${FLOOR_TABLES[0].join(', ')}) — weighted mean HP ${REF_HP.toFixed(1)}, damage ${REF_DMG.toFixed(2)}`);
console.log(`band: ±${(BAND * 100).toFixed(0)}% → HP [${(REF_HP * (1 - BAND)).toFixed(1)}, ${(REF_HP * (1 + BAND)).toFixed(1)}], damage [${(REF_DMG * (1 - BAND)).toFixed(2)}, ${(REF_DMG * (1 + BAND)).toFixed(2)}]\n`);

// THE WEAKEST OPENER HIT ON ARRIVAL (Designer ruling 4 Nov 2026). B′'s rule is
// that a region's fodder dies to ONE opener hit at the level a player arrives
// in that region, so the packet is computed, not a constant (it was a
// hard-coded 4, the map-1 Rip, applied to every region).
//
// The level is the region's `expectedLevel` (falling back to its §4.3 anchor),
// so map 1 stays at level 1. A character of every class is built at that level
// the way tools/region_curve.mjs builds one — (level − 1) points spent
// breadth-first in tier order, which is the build REGION_HP_MULT was measured
// against — and every tree's tier-1 is scored as that class's opener: one
// impact of its first damage step at the rank that spend reached (at least 1),
// times the class's Ferocity (harness characters bank no stat picks), rounded
// as damageEnemy rounds it. Neutral domain, no crit, no engine stacks, the same
// reading tools/opener_gate.mjs makes on map 1. Plague openers have no impact
// packet and are left to opener_gate's DoT rule. The weakest packet across
// every class and tree is the bar.
const IMPACT_KINDS = new Set(['bolt', 'strike', 'cone', 'line', 'drain', 'channel']);
const _packetCache = new Map();
function arrivalLevel(region) {
  return region.expectedLevel || REGION_ANCHOR_LEVEL[region.index - 1] || 1;
}
function weakestOpenerPacket(level) {
  if (_packetCache.has(level)) return _packetCache.get(level);
  let weakest = null;
  for (const classId of Object.keys(TREES_BY_CLASS)) {
    const sim = new Sim({
      seed: 4242, allowUnplayable: true,
      party: [{ idx: 0, key: 'k', name: 'C', charId: classId, color: '#fff' }],
    });
    const p = sim.players[0];
    if (p.openingOffer) sim.uiAction(0, { kind: 'opening', id: p.openingOffer[0].id });
    p.level = level;
    const skills = TREES_BY_CLASS[classId].flatMap(t => TREES[t].skills).sort((a, b) => a.tier - b.tier);
    let budget = level - 1;
    for (let pass = 0; pass < 12 && budget > 0; pass++) {
      let spent = 0;
      for (const sk of skills) {
        if (budget <= 0) break;
        p.skillPoints++;
        if (SKILLSIM.spendSkillPoint(sim, p, sk.id)) { budget--; spent++; } else p.skillPoints--;
      }
      if (!spent) break;
    }
    sim._recomputeStats(p);
    const caster = { stats: { ferocity: p.stats.ferocity }, engines: {} };
    for (const tid of TREES_BY_CLASS[classId]) {
      const sk = TREES[tid].skills.find(s => s.tier === 1);
      const step = sk && (sk.compose || []).find(s => IMPACT_KINDS.has(s.kind) && Number.isFinite(s.damage));
      if (!step) continue;
      const rank = Math.max(1, p.skillRanks[sk.id] || 0);
      const packet = Math.max(1, Math.round(stepDamage(step, sk, rank, caster) * SKILLSIM.ferocityMult(caster)));
      if (!weakest || packet < weakest.packet) weakest = { packet, id: sk.id, classId, rank, ferocity: p.stats.ferocity };
    }
  }
  _packetCache.set(level, weakest);
  return weakest;
}
const SOLO_COOP_HP = 1.15; // coopHp for one player, the map-1 measurement party
const SPECIAL_PUNISH_LO = PUNISH_LO, SPECIAL_PUNISH_HI = PUNISH_HI;
function hordeChecks(region, units) {
  const { total, tel, share } = telegraphWeight(units);
  const shapes = new Set(units.filter(e => e.telegraph).map(e => e.telegraph.shape.kind));
  // A′ — 8–25% telegraphing, at least two shapes.
  if (share >= HORDE_MIN_TELEGRAPH_WEIGHT && share <= HORDE_MAX_TELEGRAPH_WEIGHT && shapes.size >= HORDE_MIN_TELEGRAPH_SHAPES) {
    ok(`A′ region ${region.index} telegraph density ${(share * 100).toFixed(1)}% (${tel.toFixed(2)}/${total.toFixed(2)}) inside the ${(HORDE_MIN_TELEGRAPH_WEIGHT * 100).toFixed(0)}–${(HORDE_MAX_TELEGRAPH_WEIGHT * 100).toFixed(0)}% special band, ${shapes.size} shapes (${[...shapes].join(', ')})`);
  } else {
    bad(`A′ region ${region.index} telegraph density ${(share * 100).toFixed(1)}% with ${shapes.size} shape(s) — want ${(HORDE_MIN_TELEGRAPH_WEIGHT * 100).toFixed(0)}–${(HORDE_MAX_TELEGRAPH_WEIGHT * 100).toFixed(0)}% and ≥${HORDE_MIN_TELEGRAPH_SHAPES} shapes`);
  }
  const fodder = units.filter(e => enemyRole(e) === 'fodder');
  const specials = units.filter(e => enemyRole(e) === 'special');
  const landmarks = units.filter(e => enemyRole(e) === 'landmark');
  // `enemyHpAxis` is the same call the spawn path makes, so "live" here is the
  // number the game fields — fodder on the opener-packet axis, everything
  // else on total output (§4.3, ruled 2026-11-14).
  const live = e => e.hp * enemyHpAxis(region.index, e) * CONFIG.enemyHpMult * SOLO_COOP_HP;
  const fodderMax = Math.max(...fodder.map(e => e.hp));
  // B′ — role bands. Fodder dies to the weakest opener; specials 2–4×
  // fodder; landmarks ≥ 6× fodder. No band-scaling inside a roster: the
  // world axis is the only multiplier, and `enemyHpAxis` says which half of
  // it a role rides.
  const lvl = arrivalLevel(region);
  const W = weakestOpenerPacket(lvl);
  const bar = `the weakest opener hit at arrival level ${lvl}, ${W.packet} (${W.id} rank ${W.rank}, ferocity ${W.ferocity})`;
  const fatFodder = fodder.filter(e => Math.round(live(e)) > W.packet);
  if (fodder.length && !fatFodder.length) ok(`B′ region ${region.index} fodder live HP ${fodder.map(e => `${e.id.replace(/^[a-z]+_/, '')} ${live(e).toFixed(1)}`).join(', ')} — every one ≤ ${bar}`);
  else bad(`B′ region ${region.index} fodder over ${bar}: ${fatFodder.map(e => `${e.id} ${live(e).toFixed(1)}`).join(', ') || 'no fodder at all'}`);
  // ...AND AT TRIANGLE DISADVANTAGE (§7). "Every class's opener one-shots it"
  // has to hold for the class whose domain the body BEATS, or a third of the
  // roster needs two hits on a third of the crowd. The margin is exactly
  // zero today — 5 × 0.80 = 4.0 against a 4 HP body — so this is the check
  // that fails first if `enemyHpMult` or the packet moves.
  const weak = W.packet * DISADVANTAGE_MULT;
  const fatWeak = fodder.filter(e => Math.round(live(e)) > weak + 1e-9);
  if (fodder.length && !fatWeak.length) ok(`B′ region ${region.index} fodder still dies to one hit at triangle disadvantage — ${W.packet} × ${DISADVANTAGE_MULT} = ${weak.toFixed(1)} against ${Math.max(...fodder.map(e => Math.round(live(e))))} HP`);
  else bad(`B′ region ${region.index} fodder survives a disadvantaged opener (${weak.toFixed(1)}): ${fatWeak.map(e => `${e.id} ${Math.round(live(e))}`).join(', ')}`);
  const offSpec = specials.filter(e => e.hp < 2 * fodderMax || e.hp > 4 * fodderMax);
  if (specials.length && !offSpec.length) ok(`B′ region ${region.index} specials ${specials.map(e => `${e.id.replace(/^[a-z]+_/, '')} ${e.hp}`).join(', ')} are 2–4× fodder max ${fodderMax}`);
  else bad(`B′ region ${region.index} specials outside 2–4× fodder max ${fodderMax}: ${offSpec.map(e => `${e.id} ${e.hp}`).join(', ') || 'no specials'}`);
  const thinMarks = landmarks.filter(e => e.hp < 6 * fodderMax);
  if (landmarks.length && !thinMarks.length) ok(`B′ region ${region.index} landmarks ${landmarks.map(e => `${e.id.replace(/^[a-z]+_/, '')} ${e.hp}`).join(', ')} are ≥ 6× fodder max ${fodderMax}`);
  else bad(`B′ region ${region.index} landmarks under 6× fodder max ${fodderMax}: ${thinMarks.map(e => `${e.id} ${e.hp}`).join(', ') || 'no landmarks'}`);
  // C′ — every telegrapher is above fodder, and one is teachable (≤ 3× fodder).
  const tels = units.filter(e => e.telegraph);
  const under = tels.filter(e => e.hp <= fodderMax);
  const teach = tels.filter(e => e.hp <= 3 * fodderMax);
  if (!under.length && teach.length) ok(`C′ region ${region.index} every telegrapher is above fodder max ${fodderMax}; teachable special(s): ${teach.map(e => `${e.id} ${e.hp}`).join(', ')}`);
  else bad(`C′ region ${region.index}: ${under.length} telegrapher(s) at or under fodder HP, ${teach.length} teachable (≤ ${3 * fodderMax})`);
  // D — the special's punish, against the anchor vitality. The band stays
  // 6–9%: pace-spec §5 suggests ~8–15% [estimate], which the Cedar Warden's
  // 6 damage would fail without a content change the spec does not list.
  const anchor = REGION_ANCHOR_LEVEL[region.index - 1];
  const vit = anchorVitality(anchor);
  const pct = e => e.telegraph.damage / vit;
  const outD = specials.filter(e => e.telegraph && (pct(e) < SPECIAL_PUNISH_LO || pct(e) > SPECIAL_PUNISH_HI));
  if (specials.length && !outD.length) ok(`D region ${region.index} specials punish ${specials.map(e => `${(100 * pct(e)).toFixed(1)}%`).join(' / ')} of ${vit} vitality at level ${anchor} — inside ${(100 * SPECIAL_PUNISH_LO).toFixed(0)}–${(100 * SPECIAL_PUNISH_HI).toFixed(0)}%`);
  else bad(`D region ${region.index} specials outside the punish band: ${outD.map(e => `${e.id} ${(100 * pct(e)).toFixed(1)}%`).join(', ') || 'no specials'}`);
  // Fodder contact damage — reported, not gated: the 6-in-contact swarm check
  // needs the contact cadence measured in a fight (i-frames), not a sum.
  console.log(`  · fodder contact damage per touch: ${fodder.map(e => `${e.id.replace(/^[a-z]+_/, '')} ${e.dmg}`).join(', ')} (swarm check pending a contact-cadence measurement)`);
}

for (const region of REGIONS) {
  const units = REGION_ENEMIES[region.id].enemies;
  const { total, tel, share } = telegraphWeight(units);
  const hp = weightedMean(units, e => e.hp);
  const dmg = weightedMean(units, e => e.dmg);
  const med = median(units.map(e => e.hp));
  const lightTel = units.filter(e => e.telegraph && e.hp < med);
  console.log(`── region ${region.index} · ${region.name}${REGION_ENEMIES[region.id].horde ? ' · HORDE PACE' : ''}`);
  // HORDE PACE (user ruling 2 Nov 2026, pace-spec.md §5). A horde region is
  // fodder plus a few specials, so A–C are replaced by A′–C′ and D is applied
  // to specials. E (landmarks) is unchanged and runs below for both.
  if (REGION_ENEMIES[region.id].horde) { hordeChecks(region, units); }
  else {
  if (VERBOSE) {
    for (const e of [...units].sort((a, b) => a.hp - b.hp)) {
      console.log(`     ${e.id.padEnd(20)} hp ${String(e.hp).padStart(3)}  dmg ${String(e.dmg).padStart(2)}`
        + `  w ${e.w.toFixed(2)}  ${e.telegraph ? `telegraph ${String(e.telegraph.damage).padStart(2)} @ ${e.telegraph.windupMs}ms` : 'chaff'}`);
    }
  }

  // ---- A. the readability floor ----
  if (share >= MIN_TELEGRAPH_WEIGHT) {
    ok(`region ${region.index} telegraph density ${(share * 100).toFixed(1)}% by encounter weight (${tel.toFixed(2)}/${total.toFixed(2)}), at or over the ${(MIN_TELEGRAPH_WEIGHT * 100).toFixed(0)}% floor`);
  } else {
    bad(`region ${region.index} telegraph density ${(share * 100).toFixed(1)}%, under the ${(MIN_TELEGRAPH_WEIGHT * 100).toFixed(0)}% floor — `
      + 'weight relief must not be bought by removing telegraphs');
  }

  // ---- B. the weight band, same band for every region ----
  const hpOff = (hp - REF_HP) / REF_HP, dmgOff = (dmg - REF_DMG) / REF_DMG;
  if (Math.abs(hpOff) <= BAND) ok(`region ${region.index} weighted mean HP ${hp.toFixed(1)} — ${(hpOff * 100 >= 0 ? '+' : '')}${(hpOff * 100).toFixed(1)}% against floor-1 parity`);
  else bad(`region ${region.index} weighted mean HP ${hp.toFixed(1)} is ${(hpOff * 100 >= 0 ? '+' : '')}${(hpOff * 100).toFixed(1)}% against the floor-1 table's ${REF_HP.toFixed(1)} — `
    + `the world axis already multiplies this region by ×${regionHpMult(region.index).toFixed(2)}, so authored weight above parity is a second difficulty multiplier`);

  if (Math.abs(dmgOff) <= BAND) ok(`region ${region.index} weighted mean contact damage ${dmg.toFixed(2)} — ${(dmgOff * 100 >= 0 ? '+' : '')}${(dmgOff * 100).toFixed(1)}%`);
  else bad(`region ${region.index} weighted mean contact damage ${dmg.toFixed(2)} is ${(dmgOff * 100 >= 0 ? '+' : '')}${(dmgOff * 100).toFixed(1)}% against ${REF_DMG.toFixed(2)}`);

  // ---- C. the coupling, broken and asserted broken ----
  if (lightTel.length >= 2) {
    ok(`region ${region.index} has ${lightTel.length} telegrapher(s) below its median HP of ${med} (${lightTel.map(e => `${e.id} ${e.hp}`).join(', ')}) — the read can be learned on something that dies`);
  } else {
    bad(`region ${region.index} has ${lightTel.length} telegrapher(s) below its median HP of ${med} — want at least 2. `
      + 'Density and mean weight can BOTH be satisfied while every committing unit is a slab and one 4-HP outlier carries the average; '
      + 'this is the check that says the coupling is actually broken rather than averaged around');
  }

  // ---- D. punish sized to the level the unit is met at ----
  const anchor = REGION_ANCHOR_LEVEL[region.index - 1];
  const vit = anchorVitality(anchor);
  const pct = e => e.telegraph.damage / vit;
  const telUnits = units.filter(e => e.telegraph).sort((a, b) => a.hp - b.hp);
  const outOfBand = lightTel.filter(e => pct(e) < PUNISH_LO || pct(e) > PUNISH_HI);
  if (!lightTel.length) {
    // C already failed; saying "0 of 0 in band" here would be a second green
    // about an empty set (§13 rule 73).
    bad(`region ${region.index} has no light telegrapher to size a punish against — D cannot be evaluated, which is not the same as passing`);
  } else if (!outOfBand.length) {
    ok(`region ${region.index} light telegraphers punish for ${lightTel.map(e => `${(100 * pct(e)).toFixed(1)}%`).join(' / ')} of the ${vit} vitality a level-${anchor} character carries `
      + `— inside the ${(100 * PUNISH_LO).toFixed(0)}–${(100 * PUNISH_HI).toFixed(0)}% band`);
  } else {
    bad(`region ${region.index}: ${outOfBand.length} light telegrapher(s) outside the ${(100 * PUNISH_LO).toFixed(0)}–${(100 * PUNISH_HI).toFixed(0)}% punish band against ${vit} vitality at level ${anchor}: `
      + outOfBand.map(e => `${e.id} ${e.telegraph.damage} = ${(100 * pct(e)).toFixed(1)}%`).join(', ')
      + ' — neither weighted mean contains a telegraph\'s damage or its cooldown, so both can land while the fight plays wrong (§13 rule 78)');
  }
  console.log(`  · punish, every telegrapher against ${vit} vitality at level ${anchor}: `
    + telUnits.map(e => `${e.id.replace(/^[a-z]+_/, '')} ${(100 * pct(e)).toFixed(1)}%`).join(', ')
    + ' — the band gates the light ones; a landmark hitting hard is the point of a landmark');

  // ---- E. at least one landmark, on BOTH halves ----
  }
  const heavy = units.filter(e => e.hp > LANDMARK_HP_MULT * med);
  const landmarks = heavy.filter(e => e.w < LANDMARK_MAX_W);
  if (landmarks.length) {
    ok(`region ${region.index} has ${landmarks.length} landmark(s) — above ${LANDMARK_HP_MULT}× the median (${LANDMARK_HP_MULT * med}) at a draw weight under ${LANDMARK_MAX_W}: `
      + landmarks.map(e => `${e.id} ${e.hp}hp @ w${e.w}`).join(', '));
  } else {
    bad(`region ${region.index} has no landmark: ${heavy.length} unit(s) above ${LANDMARK_HP_MULT}× the median HP `
      + `(${heavy.map(e => `${e.id} ${e.hp}hp @ w${e.w}`).join(', ') || 'none'}), none of them under w${LANDMARK_MAX_W}. `
      + 'Both halves are the check: heavy alone is a slab you meet constantly, low weight alone is a rare mid unit');
  }

  // ---- the domain cap (§3.2), by ENCOUNTER WEIGHT ----
  //
  // "No region exceeds 60% one domain" is a statement about what a player
  // meets, so it is measured the way spawns are drawn — by weight — not by
  // counting archetypes. REPORTED, NOT YET GATED: region 1 is over its own cap
  // (its horde re-weighting put two physical bodies at 7.5 of 10) and that
  // fix is a balance change to the most-played region in the game, owed by
  // the balance pass and not smuggled into a content patch. Regions 4–8 were
  // authored to the cap by this measure. When region 1 is fixed this becomes
  // a check for all eight at once — an opt-in list is how region 2's weight
  // went unmeasured.
  {
    const by = {};
    for (const e of units) by[e.domain] = (by[e.domain] || 0) + e.w;
    const tot = Object.values(by).reduce((a, b) => a + b, 0);
    const shares = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([d, w]) => [d, w / tot]);
    const cap = region.domainSkew.maxShare;
    const over = shares[0][1] > cap + 1e-9;
    const lead = shares[0][0] === region.domainSkew.primary;
    console.log(`  · domain share by weight: ${shares.map(([d, sh]) => `${d} ${(100 * sh).toFixed(1)}%`).join(', ')} — cap ${(100 * cap).toFixed(0)}%, declared primary ${region.domainSkew.primary}`
      + `${over ? '   ⚠ OVER ITS CAP' : ''}${lead ? '' : '   ⚠ the declared primary does not lead'}`);
  }

  // ---- reported, never gated: what the axis makes of it ----
  console.log(`  · composed: HP ${(hp * regionHpMult(region.index)).toFixed(1)} (${(hp * regionHpMult(region.index) / REF_HP).toFixed(2)}× floor 1), `
    + `damage ${(dmg * regionDmgMult(region.index)).toFixed(2)} (${(dmg * regionDmgMult(region.index) / REF_DMG).toFixed(2)}×) `
    + `— derived from the ×${regionHpMult(region.index).toFixed(2)} world axis, not asserted`);
  console.log('');
}

// ---- the fodder axis is MEASURED, so measure it ----
//
// `REGION_OPENER_PACKET` is what takes fodder off the world axis: fodder's HP
// multiplier at region N is packet[N] / packet[1]. It is a table of numbers in
// a source file, which is the shape every stale constant in this project has
// had — the gate above this one compared fodder to a hard-coded 4 for every
// region until 4 Nov. So every entry is re-measured here against the same
// fourteen builds, for ALL eight regions rather than only the built ones, and
// drift fails in BOTH directions: a table entry above the measured packet is
// fodder that no longer dies to one hit, and one below it is a horde thinner
// than the player's hits have earned.
console.log('── the fodder axis · REGION_OPENER_PACKET against the measured packet');
{
  const drift = [];
  const row = [];
  for (let i = 0; i < TOTAL_REGIONS; i++) {
    const W = weakestOpenerPacket(REGION_ANCHOR_LEVEL[i]);
    row.push(`${W.packet}`);
    if (W.packet !== REGION_OPENER_PACKET[i]) drift.push(`region ${i + 1} (level ${REGION_ANCHOR_LEVEL[i]}): table ${REGION_OPENER_PACKET[i]}, measured ${W.packet} (${W.id} rank ${W.rank})`);
  }
  if (!drift.length) ok(`REGION_OPENER_PACKET [${REGION_OPENER_PACKET.join(', ')}] matches the weakest opener hit measured at all ${TOTAL_REGIONS} anchors [${row.join(', ')}] — fodder HP ×${REGION_OPENER_PACKET.map(v => (v / REGION_OPENER_PACKET[0]).toFixed(2)).join(' / ')}`);
  else bad(`REGION_OPENER_PACKET has drifted from the measured weakest opener hit: ${drift.join('; ')} — re-measure and update js/regions.js; the table is a measurement, not a dial`);
  console.log('');
}

// ---- and the spawn path FIELDS it ----
//
// Everything above reads `enemyHpAxis`, and so does `spawnEnemyById` — which
// makes them agree by construction and proves nothing about whether the call
// in the spawn path survives the next edit to it. So spawn one fodder and one
// landmark through a real Sim in every horde-roster region and read the body:
// fodder must come out at the packet axis, the landmark at the world axis, and
// the two must DIFFER wherever the axes do (regions 2+), or the split is a
// function nothing calls.
console.log('── the fodder axis · read off a spawned body');
for (const region of REGIONS) {
  if (!REGION_ENEMIES[region.id].horde) continue;
  const units = REGION_ENEMIES[region.id].enemies;
  const fod = units.find(e => enemyRole(e) === 'fodder');
  const mark = units.find(e => enemyRole(e) === 'landmark');
  const g = new Sim({ seed: 9100 + region.index, party: [{ idx: 0, key: 'k', name: 'C', charId: 'toh_samurai', color: '#fff' }], regionIndex: region.index });
  const base = g.coopHp * g.greedHp * CONFIG.enemyHpMult;
  const body = (def) => g.spawnEnemyById(def.id, g.W / 2, g.H / 2, { noObjHp: true });
  const f = body(fod), m = body(mark);
  // "FODDER" IS A ROLE IN A CROWD, NOT A PROPERTY OF A DEF. The same body
  // spawned as an elite is meant to take a fight and must keep the world axis
  // — the first version of enemyHpAxis asked only the def, and an elite Dust
  // Dingo in region 8 would have arrived at 9 HP beside a 683 HP landmark.
  const el = g.spawnEnemyById(fod.id, g.W / 2, g.H / 2, { noObjHp: true, elite: true });
  const wantF = Math.round(fod.hp * (REGION_OPENER_PACKET[region.index - 1] / REGION_OPENER_PACKET[0]) * base * (g.curseEnemyHp || 1));
  const wantM = Math.round(mark.hp * regionHpMult(region.index) * base * (g.curseEnemyHp || 1));
  const wantE = Math.round(fod.hp * regionHpMult(region.index) * base * CONFIG.ELITE_HP_MULT * (g.curseEnemyHp || 1));
  if (f && m && el && f.maxHp === wantF && m.maxHp === wantM && el.maxHp === wantE) {
    ok(`region ${region.index} spawns ${fod.id} at ${f.maxHp} HP (packet axis), the same body as an ELITE at ${el.maxHp} (world axis), and ${mark.id} at ${m.maxHp} (world axis ×${regionHpMult(region.index).toFixed(2)}) — one landmark is worth ${(m.maxHp / f.maxHp).toFixed(0)} fodder`);
  } else {
    bad(`region ${region.index} spawn path disagrees with the axis: ${fod.id} ${f && f.maxHp} (want ${wantF}), elite ${el && el.maxHp} (want ${wantE}), ${mark.id} ${m && m.maxHp} (want ${wantM})`);
  }
}
console.log('');

// ---- and the coupling itself, named where it lives ----
{
  const src = await import('node:fs').then(fs => fs.readFileSync(new URL('../js/content/regions-enemies.js', import.meta.url), 'utf8'));
  checks++;
  // The EXPORTED IDENTIFIER, not a mention. The file has to be able to name the
  // old one in prose to explain what changed — `secret_gate` learned the same
  // lesson catching its own header, and the answer there was to be precise
  // about what is actually forbidden rather than to exempt the file.
  const exportsCommitting = /export const COMMITTING_BEHAVIORS\s*=/.test(src);
  const exportsHeavy = /export const HEAVY_BEHAVIORS\s*=/.test(src);
  if (exportsCommitting && !exportsHeavy) {
    console.log('✓ the behaviour set is named for COMMITMENT rather than for mass — `COMMITTING_BEHAVIORS`. '
      + 'The old name is the coupling in one word: it made "may telegraph" and "is a slab" the same predicate, '
      + 'so meeting a readability floor meant adding weight.');
  } else {
    fails++;
    console.log('✗ `HEAVY_BEHAVIORS` is back. The set governs which units may TELEGRAPH, which is a timing property; '
      + 'naming it for mass is what made a readability goal import a weight goal.');
  }
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A REGION IS BUYING READABILITY WITH WEIGHT' : 'READABILITY AND WEIGHT ARE INDEPENDENT, AND BOTH HOLD');
process.exit(fails ? 1 : 0);
