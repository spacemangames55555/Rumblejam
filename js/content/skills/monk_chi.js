// MONK — Chi tree.
//
// THE FIRST ENGINE THAT RUNS IN TWO DIRECTIONS. Every engine before it only
// accumulates: footing, marks, drench, crystal, killbox and spread all move one
// way and are emptied by a door or by a mistake, never by the player deciding to
// empty them. Chi is put in by dealing damage and taken out by the Monk's own
// heals — so the class's sustain is funded by its offence, and every point of
// health bought here is damage the next few seconds will not do.
//
// THE TREE IS AUTHORED AT THE FLOOR, AND THAT IS THE WHOLE RULING (§8.3).
// "Damage skills weaken at zero Chi" is the design, and the obvious reading — a
// multiplier below 1.0 on the damage step — would have made this the only thing
// in the game that subtracts. So the numbers below ARE the winded numbers. They
// are what a Monk at zero Chi deals, they are what the DPS gate measures against
// when the pool is empty, and `scaleWith: 'chi'` adds on top of them. Nothing
// anywhere multiplies a damage number by less than one.
//
// The cliff is still a cliff, because the published engine value carries a STEP:
// `p.engines.chi` is 0 at zero and `chi + CHI_FOCUS_STEP` above it. The first
// point of Chi is worth six, and every point after it is worth one. Crossing
// zero downward is a fall, not a slope — which is the feeling the design asked
// for, reached by adding rather than by taking away.
//
// SPENDING IS CONDITIONAL. A skill declaring `chi` does not fire unless the Monk
// can pay, checked one line after the cooldown check and for the same reason. A
// heal near a hurt ally still fires on its own trigger and still takes the Chi
// with it — that cost is deliberate and survives the ruling — but a broke Monk
// gets a heal that does not fire rather than a heal that is free.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.
// (The ENGINE's numbers do not: CHI_PER_DAMAGE, CHI_CAP, CHI_FOCUS_STEP,
// CHI_IDLE_SECONDS and CHI_DECAY_PER_SEC live in js/config.js, because the
// engine shipped and gated before this file existed.)

export const TUNING = {
  // tier 1 — Open Palm
  palmDamage: 6, palmReach: 96, palmArc: 1.5, palmRadius: 120,
  palmCount: 1, palmCd: 1000, palmWeight: 0.83,
  // tier 2 — Gathering Breath
  breathAmount: 12, breathCd: 4200, breathChi: 6,
  // tier 3 — Rolling Fist
  fistDamage: 8, fistReach: 104, fistArc: 1.9, fistRadius: 132,
  fistCount: 2, fistCd: 2000, fistWeight: 0.92,
  // tier 4 — Mend
  mendAmount: 18, mendCd: 5200, mendChi: 10,
  // tier 5 — Still Water (passive)
  stillWeight: 0.133,
  // tier 6 — Hammerfall
  hammerDamage: 11, hammerReach: 112, hammerArc: 1.7, hammerRadius: 146,
  hammerCount: 2, hammerCd: 3000, hammerKnock: 170,
  // tier 7 — Breathe Out
  outAmount: 26, outDuration: 4400, outCd: 6600, outChi: 14,
  // tier 8 — Crane Step
  craneDamage: 12, craneAngle: 1.7, craneRange: 195, craneRadius: 168,
  craneCount: 3, craneCd: 3600, craneWeight: 1.08, craneSlowMult: 0.76, craneSlowDur: 1300,
  // tier 9 — Quiet the Body
  quietAmount: 30, quietCd: 7400, quietChi: 18,
  // tier 10 — Empty Hand
  emptyDamage: 17, emptyReach: 124, emptyArc: 2.3, emptyRadius: 178,
  emptyCount: 3, emptyCd: 8200, emptyWeight: 1.25, emptyStun: 620,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const MONK_CHI = [
  {
    // THE GENERATOR, and it is every damaging skill rather than a node. Chi is
    // filled in `skillDamage`, so a Monk fills the pool by fighting at all —
    // there is no "build Chi" button, because a resource with its own generator
    // button is a rotation rather than a decision.
    id: 'monk_open_palm', tree: 'monk_chi', tier: 1, name: 'Open Palm',
    desc: 'The opening form. Deals 6 damage, +1% per point of Chi held.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.palmRadius, count: T.palmCount },
    cooldown: T.palmCd,
    compose: [{
      kind: 'strike', damage: T.palmDamage, reach: T.palmReach, arc: T.palmArc,
      scaleWith: 'chi', scaleWeight: T.palmWeight, riders: {},
    }],
    ranks: R,
  },
  {
    // THE FIRST SPEND, and the tier where the class becomes itself: from here on
    // the Monk's health bar is denominated in damage it has already dealt.
    id: 'monk_gathering_breath', tree: 'monk_chi', tier: 2, name: 'Gathering Breath',
    desc: 'Spends 6 Chi to restore 12 health when you drop below 70%.',
    type: 'active', domain: 'spiritual', prereq: 'monk_open_palm',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 70 },
    cooldown: T.breathCd,
    compose: [{ kind: 'heal', amount: T.breathAmount }],
    ranks: R,
  },
  {
    id: 'monk_rolling_fist', tree: 'monk_chi', tier: 4, name: 'Rolling Fist',
    desc: 'A turning strike through two. Deals 8 damage, +1.1% per point of Chi.',
    type: 'active', domain: 'physical', prereq: 'monk_gathering_breath',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.fistRadius, count: T.fistCount },
    cooldown: T.fistCd,
    compose: [{
      kind: 'strike', damage: T.fistDamage, reach: T.fistReach, arc: T.fistArc,
      scaleWith: 'chi', scaleWeight: T.fistWeight, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'monk_mend', tree: 'monk_chi', tier: 4, name: 'Mend',
    desc: 'Spends 10 Chi to restore 18 health when you drop below 55%.',
    type: 'active', domain: 'spiritual', prereq: 'monk_gathering_breath',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 55 },
    cooldown: T.mendCd,
    compose: [{ kind: 'heal', amount: T.mendAmount }],
    ranks: R,
  },
  {
    // The engine's own investment node — the one passive in the tree, and the
    // only registered way to make a point of Chi worth more without touching a
    // step. Rankable, because it is a damage investment (§8.3).
    id: 'monk_still_water', tree: 'monk_chi', tier: 6, name: 'Still Water',
    desc: 'Every point of Chi you hold is worth more. +0.16% damage per point, per rank.',
    type: 'passive', domain: 'mental', prereq: 'monk_mend',
    passive: { chiScaleWeight: T.stillWeight },
    ranks: R,
  },
  {
    id: 'monk_hammerfall', tree: 'monk_chi', tier: 6, name: 'Hammerfall',
    desc: 'A dropping heel that throws the front rank back. 11 damage, +1.2% per point of Chi.',
    type: 'active', domain: 'physical', prereq: 'monk_rolling_fist',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.hammerRadius, count: T.hammerCount },
    cooldown: T.hammerCd,
    compose: [{
      kind: 'strike', damage: T.hammerDamage, reach: T.hammerReach, arc: T.hammerArc,
      scaleWith: 'chi', riders: { knockback: T.hammerKnock },
    }],
    ranks: R,
  },
  {
    // A `ward` rather than a passive mitigation, for the same reason the
    // Priest's Litany and the Hunter's Blood Trail are actives: `regen` is an
    // ITEM hook, not a registered passive key (§8.3).
    id: 'monk_breathe_out', tree: 'monk_chi', tier: 8, name: 'Breathe Out',
    desc: 'Spends 14 Chi. Absorbs 26 over 4.4s.',
    type: 'active', domain: 'spiritual', prereq: 'monk_still_water',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 60 },
    cooldown: T.outCd,
    compose: [{ kind: 'ward', amount: T.outAmount, duration: T.outDuration }],
    ranks: R,
  },
  {
    id: 'monk_crane_step', tree: 'monk_chi', tier: 8, name: 'Crane Step',
    desc: 'A sweeping turn that leaves the crowd crawling at 76% for 1.3s. 12 damage, +1.3% per point of Chi.',
    type: 'active', domain: 'physical', prereq: 'monk_hammerfall',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.craneRadius, count: T.craneCount },
    cooldown: T.craneCd,
    compose: [{
      kind: 'cone', damage: T.craneDamage, angle: T.craneAngle, range: T.craneRange,
      scaleWith: 'chi', scaleWeight: T.craneWeight,
      riders: { slow: { mult: T.craneSlowMult, dur: T.craneSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'monk_quiet_the_body', tree: 'monk_chi', tier: 10, name: 'Quiet the Body',
    desc: 'Spends 18 Chi to restore 30 health when you drop below 40%.',
    type: 'active', domain: 'spiritual', prereq: 'monk_breathe_out',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 40 },
    cooldown: T.quietCd,
    compose: [{ kind: 'heal', amount: T.quietAmount }],
    ranks: R,
  },
  {
    // THE CAPSTONE IS A DAMAGE SKILL, and deliberately so: the deepest node in
    // the tree that funds the healing is the one that funds it fastest. A
    // capstone that spent would have made the tree's own end its own drain.
    id: 'monk_empty_hand', tree: 'monk_chi', tier: 10, name: 'Empty Hand',
    desc: 'Everything at once and nothing held back. 17 damage in a wide arc, +1.5% per point of Chi, and what it touches is stunned for 0.6s.',
    type: 'active', domain: 'physical', prereq: 'monk_crane_step',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.emptyRadius, count: T.emptyCount },
    cooldown: T.emptyCd,
    compose: [{
      kind: 'strike', damage: T.emptyDamage, reach: T.emptyReach, arc: T.emptyArc,
      scaleWith: 'chi', scaleWeight: T.emptyWeight, riders: { stun: T.emptyStun },
    }],
    ranks: R,
  },
];
