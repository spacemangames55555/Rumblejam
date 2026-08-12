// BLACKSMITH — Forge tree.
//
// The other half, and — like Arcana, Grace, Ensemble, Collapse, Blight, Reef,
// Shadow, Houndmaster, Stone Garden and Bloodbound — deliberately the half that
// does NOT read the engine. Nothing here carries `scaleWith: 'form'` and nothing
// here is gated on a form.
//
// §8.2's THIRD TREE IS THIS ONE, FOLDED IN. The aspiration was Tank / DPS /
// Runes-Crystal Forms. Every one of the thirteen built classes shipped two
// trees, and the forms are the ENGINE — a Blacksmith who took the "other" half
// would otherwise own a third of an engine, which is not a §4.2 decision, it is
// a broken class. So the forms are all in Crystal, and Tank and DPS are folded
// together here: the heavy end of a Blacksmith who never transforms.
//
// AND THAT MAKES THE DECISION ON THIS CLASS THE SHARPEST OF THE FOURTEEN. Every
// form is on a SELF_THRESHOLD, so the Crystal tree only pays when the fight is
// going badly. Forge pays all the time and never spikes. A Blacksmith deep in
// Crystal is strongest at 35% health; a Blacksmith deep in Forge would rather
// not be there at all.
//
// THE TRAIT SITS UNDER BOTH. Crystal Infusion grants a PERMANENT crystal after
// every fight — the same three materials the forms use, on a run-long timescale
// rather than a seven-second one. It also makes the Blacksmith unpushable and a
// far bigger target (hitbox ×1.4), which is why every node here is close-range
// and none of them ask the player to reposition.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Tongs
  tongsDamage: 7, tongsReach: 92, tongsArc: 1.4, tongsRadius: 118, tongsCount: 1, tongsCd: 1100,
  // tier 2 — Bellows
  bellowsAmount: 22, bellowsDuration: 4800, bellowsCd: 5400,
  // tier 3 — Quench
  quenchDamage: 9, quenchAngle: 1.8, quenchRange: 185, quenchRadius: 160,
  quenchCount: 2, quenchCd: 2700, quenchSlowMult: 0.68, quenchSlowDur: 1500,
  // tier 4 — Sparks
  sparksDamage: 8, sparksRange: 235, sparksTick: 4, sparksDuration: 3400, sparksCd: 2900,
  // tier 5 — Deadweight (passive)
  deadGrit: 7,
  // tier 6 — Swage Block
  swageDamage: 11, swageReach: 106, swageArc: 1.7, swageRadius: 142,
  swageCount: 2, swageCd: 3200, swageKnock: 200,
  // tier 7 — Draw the Heat
  drawDamage: 11, drawRange: 215, drawHealPct: 0.45, drawCd: 3600,
  // tier 8 — Standing Order
  orderDamage: 10, orderAngle: 2.0, orderRange: 200, orderCd: 3800, orderTaunt: 1600,
  // tier 9 — Cold Shut
  shutAmount: 30, shutDuration: 5400, shutReflect: 0.32, shutCd: 8400,
  // tier 10 — Strike While It's Hot
  hotDamage: 16, hotReach: 126, hotArc: 2.3, hotRadius: 178,
  hotCount: 3, hotCd: 8600, hotStun: 600,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const SMITH_FORGE = [
  {
    id: 'smith_tongs', tree: 'smith_forge', tier: 1, name: 'Tongs',
    desc: 'Close and unglamorous. Deals 7 damage in a narrow arc.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.tongsRadius, count: T.tongsCount },
    cooldown: T.tongsCd,
    compose: [{ kind: 'strike', damage: T.tongsDamage, reach: T.tongsReach, arc: T.tongsArc, riders: {} }],
    ranks: R,
  },
  {
    id: 'smith_bellows', tree: 'smith_forge', tier: 2, name: 'Bellows',
    desc: 'Absorbs 22 over 4.8s.',
    type: 'active', domain: 'spiritual', prereq: 'smith_tongs',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 65 },
    cooldown: T.bellowsCd,
    compose: [{ kind: 'ward', amount: T.bellowsAmount, duration: T.bellowsDuration }],
    ranks: R,
  },
  {
    id: 'smith_quench', tree: 'smith_forge', tier: 4, name: 'Quench',
    desc: 'Steam and shock. 9 damage, and what it touches crawls at 68% for 1.5s.',
    type: 'active', domain: 'physical', prereq: 'smith_bellows',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.quenchRadius, count: T.quenchCount },
    cooldown: T.quenchCd,
    compose: [{
      kind: 'cone', damage: T.quenchDamage, angle: T.quenchAngle, range: T.quenchRange,
      riders: { slow: { mult: T.quenchSlowMult, dur: T.quenchSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'smith_sparks', tree: 'smith_forge', tier: 6, name: 'Sparks',
    desc: 'Catches, and keeps burning for 3.4s. Deals 8 up front.',
    type: 'active', domain: 'physical', prereq: 'smith_quench',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.sparksRange },
    cooldown: T.sparksCd,
    compose: [{
      kind: 'plague', damage: T.sparksDamage, range: T.sparksRange,
      tick: T.sparksTick, duration: T.sparksDuration,
    }],
    ranks: R,
  },
  {
    // maxRank: 1 — `armorGrit` is 'other' in PASSIVE_EFFECT, an unlock rather
    // than an investment. Same registry refusal the Savage's Old Scars hit.
    id: 'smith_deadweight', tree: 'smith_forge', tier: 4, name: 'Deadweight',
    desc: 'Nothing moves you and nothing ever has. +7 Grit.',
    type: 'passive', domain: 'physical', prereq: 'smith_bellows',
    passive: { armorGrit: T.deadGrit },
    maxRank: 1,
  },
  {
    id: 'smith_swage_block', tree: 'smith_forge', tier: 6, name: 'Swage Block',
    desc: 'A shaping blow that sends the front rank somewhere else. Deals 11 damage.',
    type: 'active', domain: 'physical', prereq: 'smith_deadweight',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.swageRadius, count: T.swageCount },
    cooldown: T.swageCd,
    compose: [{
      kind: 'strike', damage: T.swageDamage, reach: T.swageReach, arc: T.swageArc,
      riders: { knockback: T.swageKnock },
    }],
    ranks: R,
  },
  {
    id: 'smith_draw_the_heat', tree: 'smith_forge', tier: 8, name: 'Draw the Heat',
    desc: 'Deals 11 damage and takes 45% of it back as health.',
    type: 'active', domain: 'physical', prereq: 'smith_swage_block',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.drawRange },
    cooldown: T.drawCd,
    compose: [{ kind: 'drain', damage: T.drawDamage, range: T.drawRange, healPct: T.drawHealPct }],
    ranks: R,
  },
  {
    // The trait makes this class unpushable and oversized, so pulling a crowd
    // onto itself is the one thing a Blacksmith can do that nobody else survives.
    id: 'smith_standing_order', tree: 'smith_forge', tier: 8, name: 'Standing Order',
    desc: 'Everything comes to you for 1.6s. Deals 10 damage.',
    type: 'active', domain: 'spiritual', prereq: 'smith_sparks',
    select: 'densest_cluster',
    trigger: { kind: 'ON_HIT_TAKEN' },
    cooldown: T.orderCd,
    compose: [{
      kind: 'cone', damage: T.orderDamage, angle: T.orderAngle, range: T.orderRange,
      riders: { taunt: T.orderTaunt },
    }],
    ranks: R,
  },
  {
    id: 'smith_cold_shut', tree: 'smith_forge', tier: 10, name: 'Cold Shut',
    desc: 'Absorbs 30 over 5.4s and returns 32% of what it stops.',
    type: 'active', domain: 'spiritual', prereq: 'smith_draw_the_heat',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 40 },
    cooldown: T.shutCd,
    compose: [{
      kind: 'ward', amount: T.shutAmount, duration: T.shutDuration, reflectPct: T.shutReflect,
    }],
    ranks: R,
  },
  {
    id: 'smith_strike_while_hot', tree: 'smith_forge', tier: 10, name: "Strike While It's Hot",
    desc: 'The whole weight of the shop behind it. 16 damage in a wide arc, and a 0.6s stun.',
    type: 'active', domain: 'physical', prereq: 'smith_standing_order',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.hotRadius, count: T.hotCount },
    cooldown: T.hotCd,
    compose: [{
      kind: 'strike', damage: T.hotDamage, reach: T.hotReach, arc: T.hotArc,
      riders: { stun: T.hotStun },
    }],
    ranks: R,
  },
];
