// BLACKSMITH — PARKED NODES. Referenced by no tree, on purpose.
//
// The tank restructure of 2026-09-10 added three threat tools to a class that
// already had exactly thirty nodes across three ten-node trees. Thirty-three
// into thirty leaves three, and these are them. They are kept here rather than
// deleted because which three leave is a design decision and this one was made
// by arithmetic: every other node was either named in Casey's tank-tree table,
// anchors a form, is gated on a form, or was the only no-form skill left for
// its tree.
//
// WHY THESE THREE. Quench is the class's third cone and the weakest of them
// (9 damage against Slag's 9-with-a-form-boost and Standing Order's taunt).
// Sparks is its only `plague` and the only node whose engine role nothing else
// depends on. Cold Shut is the fourth ward in a class that still fields three.
//
// TO REINSTATE ONE, move it into a tree and move something else here — the
// trees are exactly ten and the loader enforces it. Their tuning travels with
// them; the constants below are the values they shipped with.

export const TUNING = {
  quenchDamage: 9, quenchAngle: 1.8, quenchRange: 185, quenchRadius: 160,
  quenchCount: 2, quenchCd: 2700, quenchSlowMult: 0.68, quenchSlowDur: 1500,
  sparksDamage: 8, sparksRange: 235, sparksTick: 4, sparksDuration: 3400, sparksCd: 2900,
  sparksSpread: 150,
  shutAmount: 30, shutDuration: 5400, shutReflect: 0.32, shutCd: 8400,
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

// Not exported into any tree. `SKILL_BY_ID` never sees these, so they cannot be
// learned, slotted or fired — they are source kept warm, not content.
export const SMITH_PARKED = [
  {
    id: 'smith_quench', tree: 'smith_forge', tier: 4, name: 'Quench',
    flavor: 'Steam and shock.',
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
    flavor: 'Catches, and keeps burning.',
    type: 'active', domain: 'physical', prereq: 'smith_quench',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.sparksRange },
    cooldown: T.sparksCd,
    compose: [{
      kind: 'plague', damage: T.sparksDamage, spreadRadius: T.sparksSpread,
      tick: T.sparksTick, duration: T.sparksDuration,
    }],
    ranks: R,
  },
  {
    id: 'smith_cold_shut', tree: 'smith_forge', tier: 10, name: 'Cold Shut',
    type: 'active', domain: 'spiritual', prereq: 'smith_draw_the_heat',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 40 },
    cooldown: T.shutCd,
    compose: [{
      kind: 'ward', amount: T.shutAmount, duration: T.shutDuration, reflectPct: T.shutReflect,
    }],
    ranks: R,
  },
];
