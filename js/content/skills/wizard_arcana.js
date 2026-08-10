// WIZARD — Arcana tree.
//
// The other half of the class, and deliberately the half that does NOT read the
// engine. Attunement banks shifts and scales off them; Arcana is flat, hard,
// domain-committed damage that gets better because the SHIFT made its matchup
// better, not because a multiplier grew.
//
// WHY THE SPLIT IS SHAPED THIS WAY. §4.2 wants depth and breadth to stay a live
// decision, and a class whose every node scales off one resource answers that
// question by itself: pour everything into the engine. Splitting the class so
// one tree rides the engine and the other is paid in raw numbers means a Wizard
// choosing between them is choosing between "my damage grows when I spend time
// shifting" and "my damage is what it is and I spend that time attacking".
//
// The domains here are spread ACROSS the tree on purpose. A Wizard who never
// shifts is holding a hand of mismatched tools; a Wizard who shifts well has
// every one of them landing at ×1.25. That is the engine's payoff expressed as
// content rather than as a number.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Scorch
  scorchDamage: 8, scorchSpeed: 470, scorchRange: 240, scorchCd: 1000,
  // tier 2 — Frost Nail
  nailDamage: 9, nailSpeed: 520, nailRange: 260, nailCd: 2600,
  nailSlowMult: 0.7, nailSlowDur: 1400,
  // tier 3 — Mind Spike
  spikeDamage: 11, spikeSpeed: 540, spikeRange: 270, spikePct: 55, spikeCd: 3200,
  // tier 4 — Kindled Ground
  kindleDamage: 5, kindleRadius: 130, kindleCount: 3, kindleDuration: 3400,
  kindleTickMs: 400, kindleCd: 5000,
  // tier 5 — Arcane Recovery
  recoveryAmount: 16, recoveryCd: 6000,
  // tier 6 — Shatterpoint
  shatterDamage: 13, shatterReach: 105, shatterArc: 1.7, shatterRadius: 150,
  shatterCount: 2, shatterCd: 4200, shatterDefMult: 0.76, shatterDefDur: 2400,
  // tier 7 — Ley Surge
  leyDamage: 10, leyAngle: 1.9, leyRange: 225, leyRadius: 185, leyCount: 3, leyCd: 5400,
  // tier 8 — Null Field
  nullAmount: 30, nullDuration: 4500, nullCd: 9000,
  // tier 9 — Starfall
  starDamage: 12, starSpeed: 430, starRadius: 215, starCount: 4, starTargets: 3,
  starCd: 6200, starDotDamage: 9, starDotDur: 2400,
  // tier 10 — The Long Equation
  equationDamage: 18, equationWidth: 42, equationLength: 430, equationRadius: 230,
  equationCount: 3, equationCd: 10000, equationStun: 700,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const WIZARD_ARCANA = [
  {
    id: 'wiz_scorch', tree: 'wizard_arcana', tier: 1, name: 'Scorch',
    desc: 'A gout of flame at the nearest thing. Deals 8 damage at 240 range.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.scorchRange },
    cooldown: T.scorchCd,
    compose: [{ kind: 'bolt', damage: T.scorchDamage, speed: T.scorchSpeed, range: T.scorchRange, riders: {} }],
    ranks: R,
  },
  {
    id: 'wiz_frost_nail', tree: 'wizard_arcana', tier: 2, name: 'Frost Nail',
    desc: 'A spike of cold that slows what it hits to 70% for 1.4s. Deals 9 damage.',
    type: 'active', domain: 'physical', prereq: 'wiz_scorch',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.nailRange },
    cooldown: T.nailCd,
    compose: [{
      kind: 'bolt', damage: T.nailDamage, speed: T.nailSpeed, range: T.nailRange,
      riders: { slow: { mult: T.nailSlowMult, dur: T.nailSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'wiz_mind_spike', tree: 'wizard_arcana', tier: 3, name: 'Mind Spike',
    desc: 'Finds the weakest thing in range and finishes it. 11 damage below 55% health.',
    type: 'active', domain: 'mental', prereq: 'wiz_frost_nail',
    select: 'lowest_hp',
    trigger: { kind: 'TARGET_THRESHOLD', pct: T.spikePct, range: T.spikeRange },
    cooldown: T.spikeCd,
    compose: [{ kind: 'bolt', damage: T.spikeDamage, speed: T.spikeSpeed, range: T.spikeRange, riders: {} }],
    ranks: R,
  },
  {
    id: 'wiz_kindled_ground', tree: 'wizard_arcana', tier: 4, name: 'Kindled Ground',
    desc: 'The floor burns where the crowd is thickest. 5 damage a tick over 3.4s.',
    type: 'active', domain: 'physical', prereq: 'wiz_mind_spike',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.kindleRadius, count: T.kindleCount },
    cooldown: T.kindleCd,
    compose: [{
      kind: 'hazard', damage: T.kindleDamage, radius: T.kindleRadius,
      duration: T.kindleDuration, tickMs: T.kindleTickMs, riders: {},
    }],
    ranks: R,
  },
  {
    // AUTHORED AS AN ACTIVE, not a passive, because `healPerHit` is an ITEM hook
    // and not a registered passive key — and inventing a passive key means
    // adding a reader in `skillsim.js`, which is engine code this pair is not
    // supposed to need. The `heal` primitive already exists and says the same
    // thing about the character.
    id: 'wiz_arcane_recovery', tree: 'wizard_arcana', tier: 5, name: 'Arcane Recovery',
    desc: 'Draws 16 health back out of the weave when you fall below 65%.',
    type: 'active', domain: 'spiritual', prereq: 'wiz_kindled_ground',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 65 },
    cooldown: T.recoveryCd,
    compose: [{ kind: 'heal', amount: T.recoveryAmount }],
    ranks: R,
  },
  {
    id: 'wiz_shatterpoint', tree: 'wizard_arcana', tier: 6, name: 'Shatterpoint',
    desc: 'A close arc that cracks armour. 13 damage, and what it touches takes 24% more for 2.4s.',
    type: 'active', domain: 'mental', prereq: 'wiz_arcane_recovery',
    select: 'highest_hp',
    trigger: { kind: 'PROXIMITY', radius: T.shatterRadius, count: T.shatterCount },
    cooldown: T.shatterCd,
    compose: [{
      kind: 'strike', damage: T.shatterDamage, reach: T.shatterReach, arc: T.shatterArc,
      riders: { weakenDefense: { mult: T.shatterDefMult, dur: T.shatterDefDur } },
    }],
    ranks: R,
  },
  {
    id: 'wiz_ley_surge', tree: 'wizard_arcana', tier: 7, name: 'Ley Surge',
    desc: 'A wave of spirit through the crowd. 10 damage in a 1.9-radian fan.',
    type: 'active', domain: 'spiritual', prereq: 'wiz_shatterpoint',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.leyRadius, count: T.leyCount },
    cooldown: T.leyCd,
    compose: [{ kind: 'cone', damage: T.leyDamage, angle: T.leyAngle, range: T.leyRange, riders: {} }],
    ranks: R,
  },
  {
    id: 'wiz_null_field', tree: 'wizard_arcana', tier: 8, name: 'Null Field',
    desc: 'A shell of nothing. Absorbs 30 over 4.5s when you drop below 45% health.',
    type: 'active', domain: 'mental', prereq: 'wiz_ley_surge',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 45 },
    cooldown: T.nullCd,
    compose: [{ kind: 'shield', amount: T.nullAmount, duration: T.nullDuration }],
    ranks: R,
  },
  {
    id: 'wiz_starfall', tree: 'wizard_arcana', tier: 9, name: 'Starfall',
    desc: 'Three falling motes, each leaving a burn. 12 damage plus 9 over 2.4s.',
    type: 'active', domain: 'spiritual', prereq: 'wiz_null_field',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.starRadius, count: T.starCount },
    cooldown: T.starCd,
    compose: [{
      kind: 'bolt', damage: T.starDamage, speed: T.starSpeed, range: T.starRadius,
      count: T.starTargets,
      riders: { impactDot: { damage: T.starDotDamage, dur: T.starDotDur } },
    }],
    ranks: R,
  },
  {
    id: 'wiz_long_equation', tree: 'wizard_arcana', tier: 10, name: 'The Long Equation',
    desc: 'The answer, written across the room. 18 damage down a wide line, and what it crosses is stunned for 0.7s.',
    type: 'active', domain: 'physical', prereq: 'wiz_starfall',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.equationRadius, count: T.equationCount },
    cooldown: T.equationCd,
    compose: [{
      kind: 'line', damage: T.equationDamage, width: T.equationWidth, length: T.equationLength,
      riders: { stun: T.equationStun },
    }],
    ranks: R,
  },
];
