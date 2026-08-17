// SAVAGE — Primal Fury tree.
//
// THE ENGINE TREE, AND THE ENGINE IS NOT WHAT §8.3 SPECIFIED. Cascade was
// written as "an ordered 3-skill sequence" before any of this machinery existed,
// and measured against the combat model that was actually built, an ordered
// sequence is not a decision a player can make. Nothing is manually cast. The
// full ruling and the measurement that forced it are in §8.3; the short version
// is that fire order is decided by cooldown arithmetic and by which triggers
// happen to hold, and forcing it to be reliable requires making the three skills
// identical — at which point the "sequence" is `runTriggerTick` walking the
// loadout array in index order, arranged once between rooms and never touched.
//
// SO CASCADE COUNTS VARIETY. A fire by a skill other than the one before it
// banks a rank; the same skill twice running resets the whole chain. That keeps
// everything §8.3 reasoned about — uncapped ranks, damage per rank, the
// asymptotic cooldown floor that makes uncapped safe — and replaces the one part
// the combat model cannot express.
//
// AND IT MAKES THE TREE'S OWN SHAPE THE DECISION. A Savage wants several skills
// whose triggers hold in DIFFERENT situations, so that whatever the fight is
// doing, something other than the last thing is ready. Measured across built
// classes, that varies enormously: a Samurai's stream is 63% the same skill
// twice running and a Druid's is 35%. This tree is authored to be the low end of
// that range on purpose — no two consecutive tiers share a trigger kind, and the
// radii and ranges are deliberately staggered so the set covers a crowd, a
// straggler and a wall of bodies rather than all wanting the same picture.
//
// THE BUILT-IN COST IS IN THE ENGINE ITSELF, not bolted on. Each rank shortens
// every cooldown, so the FASTEST skill comes back soonest, so it is the likeliest
// to be the one that fires twice running and breaks the chain. The deeper the
// cascade, the harder it is to keep — which is why the ranks can be uncapped.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.
// (The ENGINE's numbers do not: CASCADE_CD_RATE, CASCADE_CD_FLOOR,
// CASCADE_IDLE_SECONDS and CASCADE_DECAY_PER_SEC live in js/config.js, because
// the engine shipped and gated before this file existed.)

export const TUNING = {
  // tier 1 — Rip
  ripDamage: 3, ripReach: 98, ripArc: 1.5, ripRadius: 122,
  ripCount: 1, ripCd: 1050, ripWeight: 0.72,
  // tier 2 — Run Down
  runDamage: 4, runRange: 250, runCd: 2200, runWeight: 0.79,
  // tier 3 — Wide Swing
  wideDamage: 5, wideAngle: 2.0, wideRange: 190, wideRadius: 165,
  wideCount: 3, wideCd: 2600, wideWeight: 0.86,
  // tier 4 — Gore
  goreDamage: 5, goreReach: 106, goreArc: 1.4, gorePct: 60,
  goreRange: 200, goreCd: 3000, goreWeight: 0.94, goreKnock: 160,
  // tier 5 — Red Memory (passive)
  memoryWeight: 0.126,
  // tier 6 — Break Line
  breakDamage: 5, breakWidth: 36, breakLength: 330, breakRadius: 185,
  breakCount: 2, breakCd: 3400, breakWeight: 1.01, breakRoot: 1100,
  // tier 7 — Alone With It
  aloneDamage: 7, aloneReach: 116, aloneArc: 1.8, aloneRadius: 150,
  aloneCount: 2, aloneCd: 3800, aloneWeight: 1.08,
  // tier 8 — Second Wind
  windAmount: 24, windCd: 6800,
  // tier 9 — Hooked
  hookedDamage: 6, hookedRange: 235, hookedHealPct: 0.4, hookedCd: 4200, hookedWeight: 1.15,
  // tier 10 — Nothing Left
  nothingDamage: 9, nothingAngle: 2.6, nothingRange: 230, nothingRadius: 200,
  nothingCount: 4, nothingCd: 8600, nothingWeight: 1.3, nothingStun: 600,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const SAV_PRIMAL_FURY = [
  {
    // TIER 1 IS PROXIMITY AND TIER 2 IS NEAREST, and every adjacent pair below
    // differs the same way. That is the tree doing its own job: two skills that
    // hold in the same situation are two skills that cannot follow each other,
    // because whichever is faster fires twice and breaks the chain.
    id: 'sav_rip', tree: 'sav_primal_fury', tier: 1, name: 'Rip',
    desc: 'The opening tear. Deals 3 damage, +2% per rank of cascade.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.ripRadius, count: T.ripCount },
    cooldown: T.ripCd,
    compose: [{
      kind: 'strike', damage: T.ripDamage, reach: T.ripReach, arc: T.ripArc,
      scaleWith: 'cascade', scaleWeight: T.ripWeight, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'sav_run_down', tree: 'sav_primal_fury', tier: 2, name: 'Run Down',
    desc: 'Reaches whatever is closest, wherever it is. Deals 4 damage, +2.2% per rank.',
    type: 'active', domain: 'physical', prereq: 'sav_rip',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.runRange },
    cooldown: T.runCd,
    compose: [{
      kind: 'drain', damage: T.runDamage, range: T.runRange, healPct: 0.15,
      scaleWith: 'cascade', scaleWeight: T.runWeight,
    }],
    ranks: R,
  },
  {
    id: 'sav_wide_swing', tree: 'sav_primal_fury', tier: 4, name: 'Wide Swing',
    desc: 'For when there are enough of them. Deals 5 damage in a wide fan, +2.4% per rank.',
    type: 'active', domain: 'physical', prereq: 'sav_run_down',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.wideRadius, count: T.wideCount },
    cooldown: T.wideCd,
    compose: [{
      kind: 'cone', damage: T.wideDamage, angle: T.wideAngle, range: T.wideRange,
      scaleWith: 'cascade', scaleWeight: T.wideWeight, riders: {},
    }],
    ranks: R,
  },
  {
    // TARGET_THRESHOLD — holds only when something is nearly dead, which is a
    // situation none of the others share. A finisher is a good cascade link
    // precisely because it cannot be the skill that fires twice.
    id: 'sav_gore', tree: 'sav_primal_fury', tier: 4, name: 'Gore',
    desc: 'Goes for something already bleeding. Deals 5 damage and throws it, +2.6% per rank.',
    type: 'active', domain: 'physical', prereq: 'sav_run_down',
    select: 'lowest_hp',
    trigger: { kind: 'TARGET_THRESHOLD', pct: T.gorePct, range: T.goreRange },
    cooldown: T.goreCd,
    compose: [{
      kind: 'strike', damage: T.goreDamage, reach: T.goreReach, arc: T.goreArc,
      scaleWith: 'cascade', scaleWeight: T.goreWeight, riders: { knockback: T.goreKnock },
    }],
    ranks: R,
  },
  {
    id: 'sav_red_memory', tree: 'sav_primal_fury', tier: 8, name: 'Red Memory',
    desc: 'Every rank you are holding is worth more. +0.35% damage per rank, per rank of this.',
    type: 'passive', domain: 'mental', prereq: 'sav_break_line',
    passive: { cascadeScaleWeight: T.memoryWeight },
    ranks: R,
  },
  {
    id: 'sav_break_line', tree: 'sav_primal_fury', tier: 6, name: 'Break Line',
    desc: 'Through the middle of them, and what it crosses stays put for 1.1s. 5 damage, +2.8% per rank.',
    type: 'active', domain: 'physical', prereq: 'sav_wide_swing',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.breakRadius, count: T.breakCount },
    cooldown: T.breakCd,
    compose: [{
      kind: 'line', damage: T.breakDamage, width: T.breakWidth, length: T.breakLength,
      scaleWith: 'cascade', scaleWeight: T.breakWeight, riders: { root: T.breakRoot },
    }],
    ranks: R,
  },
  {
    // ISOLATED — true when there are FEWER than `count` nearby, which is the
    // exact complement of the PROXIMITY nodes. This is the skill that carries the
    // chain through the quiet moments when Rip and Wide Swing have nothing.
    id: 'sav_alone_with_it', tree: 'sav_primal_fury', tier: 6, name: 'Alone With It',
    desc: 'For one at a time, with nobody else close. Deals 7 damage, +3% per rank.',
    type: 'active', domain: 'physical', prereq: 'sav_gore',
    select: 'nearest',
    trigger: { kind: 'ISOLATED', radius: T.aloneRadius, count: T.aloneCount },
    cooldown: T.aloneCd,
    compose: [{
      kind: 'strike', damage: T.aloneDamage, reach: T.aloneReach, arc: T.aloneArc,
      scaleWith: 'cascade', scaleWeight: T.aloneWeight, riders: {},
    }],
    ranks: R,
  },
  {
    // NO CASCADE SCALING, and a SELF_THRESHOLD trigger. The Savage's one purely
    // defensive node has to work when the chain is broken, because the chain
    // breaking and the health bar emptying tend to be the same moment.
    id: 'sav_second_wind', tree: 'sav_primal_fury', tier: 8, name: 'Second Wind',
    desc: 'Restores 24 health when you drop below 45%.',
    type: 'active', domain: 'spiritual', prereq: 'sav_alone_with_it',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 45 },
    cooldown: T.windCd,
    compose: [{ kind: 'heal', amount: T.windAmount }],
    ranks: R,
  },
  {
    id: 'sav_hooked', tree: 'sav_primal_fury', tier: 10, name: 'Hooked',
    desc: 'Deals 6 damage and takes 40% of it back, +3.2% per rank.',
    type: 'active', domain: 'physical', prereq: 'sav_second_wind',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.hookedRange },
    cooldown: T.hookedCd,
    compose: [{
      kind: 'drain', damage: T.hookedDamage, range: T.hookedRange, healPct: T.hookedHealPct,
      scaleWith: 'cascade', scaleWeight: T.hookedWeight,
    }],
    ranks: R,
  },
  {
    id: 'sav_nothing_left', tree: 'sav_primal_fury', tier: 10, name: 'Nothing Left',
    desc: 'The end of the chain. 9 damage in a huge fan, +3.6% per rank, and what it touches is stunned for 0.6s.',
    type: 'active', domain: 'physical', prereq: 'sav_red_memory',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.nothingRadius, count: T.nothingCount },
    cooldown: T.nothingCd,
    compose: [{
      kind: 'cone', damage: T.nothingDamage, angle: T.nothingAngle, range: T.nothingRange,
      scaleWith: 'cascade', scaleWeight: T.nothingWeight, riders: { stun: T.nothingStun },
    }],
    ranks: R,
  },
];
