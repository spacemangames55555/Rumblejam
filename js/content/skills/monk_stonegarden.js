// MONK — Stone Garden tree.
//
// The other half, and — like Arcana, Grace, Ensemble, Collapse, Blight, Reef,
// Shadow and Houndmaster — deliberately the half that does NOT read the engine.
// Nothing here carries `scaleWith: 'chi'`. Chi still funds it, because two of
// these nodes SPEND, but no number in this file grows with the pool.
//
// AND THAT IS WHAT MAKES THE §4.2 DECISION REAL ON THIS CLASS. Chi's own tree
// converts Chi into damage and back into health, so every point banked is worth
// more the deeper you go. Stone Garden converts Chi into GROUND — traps laid
// ahead of a fight, which pay out whether the pool is full or empty. A Monk deep
// in Chi wants a big pool and hates spending it; a Monk deep in Stone Garden
// wants to spend the moment there is anything to spend, because a trap in the
// floor is worth the same at 40 Chi and at 1.
//
// THE TRAPS ARE THE ASSASSIN'S PRIMITIVE, NOT A SECOND ONE. §13 rule 23 named
// the Monk's traps and the Assassin's killbox as the same shape years before
// either existed, and the thirteenth primitive (§5.7) settled it: a trap is an
// object placed inert and consumed by a later cast. What differs is who pays.
// The Assassin pays in positioning and gets its killbox free; the Monk pays in
// Chi, which is damage it has already dealt. Same object, opposite currency.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Low Sweep
  sweepDamage: 6, sweepReach: 92, sweepArc: 1.7, sweepRadius: 124,
  sweepCount: 1, sweepCd: 1050,
  // tier 2 — Set Stone
  stoneDamage: 16, stoneRadius: 62, stoneDuration: 14000, stoneCd: 3400, stoneChi: 8,
  // tier 3 — Turning Elbow
  elbowDamage: 9, elbowReach: 100, elbowArc: 1.6, elbowRadius: 134,
  elbowCount: 2, elbowCd: 2100, elbowKnock: 150,
  // tier 4 — Warded Ground
  wardedAmount: 22, wardedDuration: 4200, wardedCd: 6200,
  // tier 5 — Long Garden (passive)
  gardenPer: 0.05,
  // tier 6 — Iron Bell
  bellDamage: 10, bellAngle: 2.0, bellRange: 200, bellRadius: 172,
  bellCount: 3, bellCd: 3300, bellTaunt: 1500,
  // tier 7 — Second Stone
  stone2Damage: 20, stone2Radius: 70, stone2Duration: 14000, stone2Cd: 4600, stone2Chi: 12,
  // tier 8 — Snare Line
  lineDamage: 9, lineWidth: 34, lineLength: 320, lineRadius: 190,
  lineCount: 3, lineCd: 4800, lineRoot: 1350,
  // tier 9 — Give Ground
  giveDamage: 10, giveRange: 210, giveHealPct: 0.45, giveCd: 3700,
  // tier 10 — The Garden Closes
  closeDamage: 15, closeAngle: 2.5, closeRange: 225, closeRadius: 198,
  closeCount: 4, closeCd: 9000, closeSlowMult: 0.7, closeSlowDur: 1600,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const MONK_STONEGARDEN = [
  {
    id: 'monk_low_sweep', tree: 'monk_stonegarden', tier: 1, name: 'Low Sweep',
    desc: 'A short kick at the ankles. Deals 6 damage in a 1.7-radian arc.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.sweepRadius, count: T.sweepCount },
    cooldown: T.sweepCd,
    compose: [{ kind: 'strike', damage: T.sweepDamage, reach: T.sweepReach, arc: T.sweepArc, riders: {} }],
    ranks: R,
  },
  {
    // THE TREE'S THESIS IN ONE NODE. A stone costs 8 Chi — damage already dealt
    // — and sits in the floor doing nothing until a later cast sets it off. The
    // Monk is spending its offence on GROUND rather than on health, and the
    // decision is which of the two the next eight points buy.
    id: 'monk_set_stone', tree: 'monk_stonegarden', tier: 2, name: 'Set Stone',
    desc: 'Spends 8 Chi to set a stone. It waits, and goes off for 16 when you next strike nearby.',
    type: 'active', domain: 'physical', prereq: 'monk_low_sweep',
    select: 'densest_cluster', chi: T.stoneChi,
    trigger: { kind: 'PROXIMITY', radius: 210, count: 1 },
    cooldown: T.stoneCd,
    compose: [{
      kind: 'trap', damage: T.stoneDamage, radius: T.stoneRadius, duration: T.stoneDuration,
    }],
    ranks: R,
  },
  {
    id: 'monk_turning_elbow', tree: 'monk_stonegarden', tier: 3, name: 'Turning Elbow',
    desc: 'A close turn that shoves the front rank off you. Deals 9 damage.',
    type: 'active', domain: 'physical', prereq: 'monk_set_stone',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.elbowRadius, count: T.elbowCount },
    cooldown: T.elbowCd,
    compose: [{
      kind: 'strike', damage: T.elbowDamage, reach: T.elbowReach, arc: T.elbowArc,
      riders: { knockback: T.elbowKnock },
    }],
    ranks: R,
  },
  {
    // NO CHI COST, deliberately. Every spend in the game so far has been a
    // choice made when the pool is full; this is the node that has to work when
    // it is empty, because a Monk at zero Chi with no free defensive is a Monk
    // whose engine failing also removes its ability to survive failing.
    id: 'monk_warded_ground', tree: 'monk_stonegarden', tier: 4, name: 'Warded Ground',
    desc: 'Absorbs 22 over 4.2s. Costs no Chi — the one thing that still works when the pool is dry.',
    type: 'active', domain: 'spiritual', prereq: 'monk_turning_elbow',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 50 },
    cooldown: T.wardedCd,
    compose: [{ kind: 'ward', amount: T.wardedAmount, duration: T.wardedDuration }],
    ranks: R,
  },
  {
    id: 'monk_long_garden', tree: 'monk_stonegarden', tier: 5, name: 'Long Garden',
    desc: 'Every stone you have set makes you hit harder. +5% damage per stone standing, per rank.',
    type: 'passive', domain: 'mental', prereq: 'monk_warded_ground',
    passive: { killboxDamageBonus: T.gardenPer },
    ranks: R,
  },
  {
    id: 'monk_iron_bell', tree: 'monk_stonegarden', tier: 6, name: 'Iron Bell',
    desc: 'A ringing shout that pulls the crowd onto you for 1.5s. Deals 10 damage.',
    type: 'active', domain: 'spiritual', prereq: 'monk_long_garden',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.bellRadius, count: T.bellCount },
    cooldown: T.bellCd,
    compose: [{
      kind: 'cone', damage: T.bellDamage, angle: T.bellAngle, range: T.bellRange,
      riders: { taunt: T.bellTaunt },
    }],
    ranks: R,
  },
  {
    id: 'monk_second_stone', tree: 'monk_stonegarden', tier: 7, name: 'Second Stone',
    desc: 'Spends 12 Chi to set a heavier stone. 20 damage in a wider circle.',
    type: 'active', domain: 'physical', prereq: 'monk_iron_bell',
    select: 'densest_cluster', chi: T.stone2Chi,
    trigger: { kind: 'PROXIMITY', radius: 220, count: 2 },
    cooldown: T.stone2Cd,
    compose: [{
      kind: 'trap', damage: T.stone2Damage, radius: T.stone2Radius, duration: T.stone2Duration,
    }],
    ranks: R,
  },
  {
    id: 'monk_snare_line', tree: 'monk_stonegarden', tier: 8, name: 'Snare Line',
    desc: 'A drawn cord that holds what crosses it for 1.35s. Deals 9 damage.',
    type: 'active', domain: 'mental', prereq: 'monk_second_stone',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.lineRadius, count: T.lineCount },
    cooldown: T.lineCd,
    compose: [{
      kind: 'line', damage: T.lineDamage, width: T.lineWidth, length: T.lineLength,
      riders: { root: T.lineRoot },
    }],
    ranks: R,
  },
  {
    id: 'monk_give_ground', tree: 'monk_stonegarden', tier: 9, name: 'Give Ground',
    desc: 'Deals 10 damage and takes 45% of it back as health.',
    type: 'active', domain: 'physical', prereq: 'monk_snare_line',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.giveRange },
    cooldown: T.giveCd,
    compose: [{ kind: 'drain', damage: T.giveDamage, range: T.giveRange, healPct: T.giveHealPct }],
    ranks: R,
  },
  {
    id: 'monk_garden_closes', tree: 'monk_stonegarden', tier: 10, name: 'The Garden Closes',
    desc: 'Everything you laid out, at once. 15 damage in a wide fan, and what it touches crawls at 70% for 1.6s.',
    type: 'active', domain: 'physical', prereq: 'monk_give_ground',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.closeRadius, count: T.closeCount },
    cooldown: T.closeCd,
    compose: [{
      kind: 'cone', damage: T.closeDamage, angle: T.closeAngle, range: T.closeRange,
      riders: { slow: { mult: T.closeSlowMult, dur: T.closeSlowDur } },
    }],
    ranks: R,
  },
];
