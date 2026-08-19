// MAGE — Crystalblade tree.
//
// THE CLASS ENGINE, EXPRESSED AS CONTENT. §8.3: "crystallize — damage TAKEN
// accumulates crystal; crystal drives melee output. The only engine filled by
// the enemy rather than by the player's own action." The write path is one line
// in `tohOnHurt`, which `hurtPlayer` already called; the resource is
// `p.engines.crystal`, published in one line. Nothing here is engine code.
//
// WHY EVERY SCALING STEP IN THIS FILE IS A `strike`. Crystal drives MELEE
// output, and that is the ruling rather than a preference. The Mage is the
// Arcane Warrior: the class converts absorbed damage into dealt damage, and the
// conversion only makes sense standing where the damage is. A crystal-scaled
// bolt would let the Mage bank the engine at the back of the room and spend it
// from safety, which is the exact play the class exists to refuse. So the ranged
// half of the kit lives in Collapse and is paid in flat numbers.
//
// AND THE ENGINE IS NOT SPENT. Crystal ramps inside a room and resets at the
// door, the same shape as the Wizard's shift — there is no consumption step and
// no spend hook. THE HEALTH IS THE SPEND. Every point of crystal was already
// bought, in the only currency that matters, at the moment it accrued; charging
// again at the point of use would tax one decision twice.
//
// THE COST IS BUILT IN, AND IT IS GRIT. Crystal is written off MITIGATED damage
// — what actually got through — so armour is ANTI-SYNERGISTIC with the engine.
// Every point of Grit a Mage takes is crystal it will not earn. This is the only
// class in the game punished for playing safely, and that is the tension the
// engine exists to create.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Shardcut
  shardDamage: 5, shardReach: 104, shardArc: 1.7, shardRadius: 130,
  shardCount: 1, shardCd: 1300,
  // tier 2 — Facet Strike
  facetDamage: 5, facetReach: 108, facetArc: 1.8, facetRadius: 135,
  facetCount: 1, facetCd: 2200, facetWeight: 0.75,
  // tier 3 — Fracture Line
  fractureDamage: 6, fractureReach: 112, fractureArc: 2.0, fractureRadius: 140,
  fractureCount: 2, fractureCd: 3400, fractureWeight: 0.83,
  fractureDefMult: 0.78, fractureDefDur: 2400,
  // tier 4 — Hardened Edge
  hardenAmount: 18, hardenDuration: 4600, hardenCd: 7000, hardenWeight: 0.9,
  // tier 5 — Lattice (passive)
  latticeWeight: 0.3,
  // tier 6 — Refracted Guard
  guardDamage: 7, guardReach: 116, guardArc: 2.2, guardRadius: 145,
  guardCount: 2, guardCd: 3800, guardWeight: 0.9, guardKnock: 200,
  // tier 7 — Pressure Front
  pressureDamage: 8, pressureReach: 120, pressureArc: 2.4, pressureRadius: 150,
  pressureCount: 3, pressureCd: 4600,
  pressureSlowMult: 0.74, pressureSlowDur: 1400,
  // tier 8 — Cleavage Plane
  planeDamage: 8, planeReach: 124, planeArc: 2.6, planeRadius: 155,
  planeCount: 3, planeCd: 5400, planeWeight: 1.05, planePulses: 2,
  // tier 9 — Inclusion
  inclusionDamage: 9, inclusionReach: 118, inclusionArc: 2.0, inclusionRadius: 150,
  inclusionCount: 2, inclusionCd: 5000, inclusionWeight: 1.13, inclusionRoot: 1500,
  // tier 10 — The Whole Stone
  wholeDamage: 12, wholeReach: 132, wholeArc: 3.0, wholeRadius: 165,
  wholeCount: 3, wholeCd: 9500, wholeWeight: 1.25, wholeStun: 650,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const MAGE_CRYSTALBLADE = [
  {
    // The one melee node that does NOT read the engine, and it is the opener on
    // purpose: a Mage that has just walked through the door has no crystal, and
    // a tier-1 node scaling off an empty pool is a node that does nothing for
    // the first ten seconds of every room.
    id: 'mage_shardcut', tree: 'mage_crystalblade', tier: 1, name: 'Shardcut',
    flavor: 'A short glassy cut at whatever came close.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.shardRadius, count: T.shardCount },
    cooldown: T.shardCd,
    compose: [{ kind: 'strike', damage: T.shardDamage, reach: T.shardReach, arc: T.shardArc, riders: {} }],
    ranks: R,
  },
  {
    // THE ENGINE, TIER 2 — the same placement as the Wizard's shift, the
    // Priest's mark and the Bard's Quickstep. A class should not spend a third
    // of a run being a worse version of another one.
    id: 'mage_facet_strike', tree: 'mage_crystalblade', tier: 2, name: 'Facet Strike',
    flavor: 'A cut that sharpens with everything you have absorbed.',
    type: 'active', domain: 'physical', prereq: 'mage_shardcut',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.facetRadius, count: T.facetCount },
    cooldown: T.facetCd,
    compose: [{
      kind: 'strike', damage: T.facetDamage, reach: T.facetReach, arc: T.facetArc,
      scaleWith: 'crystal', scaleWeight: T.facetWeight, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'mage_fracture_line', tree: 'mage_crystalblade', tier: 3, name: 'Fracture Line',
    flavor: 'A cut that leaves a seam — what it touches takes.',
    type: 'active', domain: 'mental', prereq: 'mage_facet_strike',
    select: 'highest_hp',
    trigger: { kind: 'PROXIMITY', radius: T.fractureRadius, count: T.fractureCount },
    cooldown: T.fractureCd,
    compose: [{
      kind: 'strike', damage: T.fractureDamage, reach: T.fractureReach, arc: T.fractureArc,
      scaleWith: 'crystal', scaleWeight: T.fractureWeight,
      riders: { weakenDefense: { mult: T.fractureDefMult, dur: T.fractureDefDur } },
    }],
    ranks: R,
  },
  {
    // The engine's one defensive read, and it is deliberately a SHIELD rather
    // than a heal or a Grit grant. Grit would fight the engine — see the header
    // — and this does not: it converts crystal already earned into a pool that
    // absorbs, which does not reduce what gets through in the first place, so it
    // never quietly turns off the class's own accumulation.
    id: 'mage_hardened_edge', tree: 'mage_crystalblade', tier: 4, name: 'Hardened Edge',
    type: 'active', domain: 'physical', prereq: 'mage_fracture_line',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 55 },
    cooldown: T.hardenCd,
    compose: [{
      kind: 'shield', amount: T.hardenAmount, duration: T.hardenDuration,
      scaleWith: 'crystal', scaleWeight: T.hardenWeight,
    }],
    ranks: R,
  },
  {
    id: 'mage_lattice', tree: 'mage_crystalblade', tier: 5, name: 'Lattice',
    type: 'passive', domain: 'mental', prereq: 'mage_hardened_edge',
    trigger: null, cooldown: 0, compose: [],
    passive: { crystalScaleWeight: T.latticeWeight },
    // Classified 'damage' in PASSIVE_EFFECT, so it is an INVESTMENT and ranks —
    // the same shape as Held Edge on Footing, Sympathetic Resonance on shift,
    // Attend the Fallen on marks and Perfect Time on rhythm.
    ranks: { damage: T.rankDamage },
  },
  {
    id: 'mage_refracted_guard', tree: 'mage_crystalblade', tier: 6, name: 'Refracted Guard',
    flavor: 'A sweep that throws the front rank off you.',
    type: 'active', domain: 'physical', prereq: 'mage_lattice',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.guardRadius, count: T.guardCount },
    cooldown: T.guardCd,
    compose: [{
      kind: 'strike', damage: T.guardDamage, reach: T.guardReach, arc: T.guardArc,
      scaleWith: 'crystal', scaleWeight: T.guardWeight,
      riders: { knockback: T.guardKnock },
    }],
    ranks: R,
  },
  {
    id: 'mage_pressure_front', tree: 'mage_crystalblade', tier: 7, name: 'Pressure Front',
    flavor: 'A wide grinding arc.',
    type: 'active', domain: 'mental', prereq: 'mage_refracted_guard',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.pressureRadius, count: T.pressureCount },
    cooldown: T.pressureCd,
    compose: [{
      kind: 'strike', damage: T.pressureDamage, reach: T.pressureReach, arc: T.pressureArc,
      scaleWith: 'crystal',
      riders: { slow: { mult: T.pressureSlowMult, dur: T.pressureSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'mage_cleavage_plane', tree: 'mage_crystalblade', tier: 8, name: 'Cleavage Plane',
    flavor: 'Two cuts along the same seam.',
    type: 'active', domain: 'physical', prereq: 'mage_pressure_front',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.planeRadius, count: T.planeCount },
    cooldown: T.planeCd,
    compose: [{
      kind: 'strike', damage: T.planeDamage, reach: T.planeReach, arc: T.planeArc,
      scaleWith: 'crystal', scaleWeight: T.planeWeight,
      riders: { multiPulse: T.planePulses },
    }],
    ranks: R,
  },
  {
    id: 'mage_inclusion', tree: 'mage_crystalblade', tier: 9, name: 'Inclusion',
    flavor: 'Drives a splinter.',
    type: 'active', domain: 'spiritual', prereq: 'mage_cleavage_plane',
    select: 'highest_hp',
    trigger: { kind: 'PROXIMITY', radius: T.inclusionRadius, count: T.inclusionCount },
    cooldown: T.inclusionCd,
    compose: [{
      kind: 'strike', damage: T.inclusionDamage, reach: T.inclusionReach, arc: T.inclusionArc,
      scaleWith: 'crystal', scaleWeight: T.inclusionWeight,
      riders: { root: T.inclusionRoot },
    }],
    ranks: R,
  },
  {
    // The steepest crystal scaling in the game, on the longest cooldown in the
    // tree, and both of those are the same statement: this is what a whole
    // room's worth of absorbed damage is FOR.
    id: 'mage_whole_stone', tree: 'mage_crystalblade', tier: 10, name: 'The Whole Stone',
    flavor: 'Everything you have taken, returned at once.',
    type: 'active', domain: 'physical', prereq: 'mage_inclusion',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.wholeRadius, count: T.wholeCount },
    cooldown: T.wholeCd,
    compose: [{
      kind: 'strike', damage: T.wholeDamage, reach: T.wholeReach, arc: T.wholeArc,
      scaleWith: 'crystal', scaleWeight: T.wholeWeight,
      riders: { stun: T.wholeStun },
    }],
    ranks: R,
  },
];
