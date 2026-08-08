// WITCH DOCTOR — Blight tree.
//
// The other half, and — like Arcana, Grace, Ensemble and Collapse — deliberately
// the half that mostly does NOT read the engine. Effigy pins a doll and scales
// off what it has absorbed; Blight is rot and sustain, paid in flat numbers, so
// a Witch Doctor whose doll just died is still a functioning character rather
// than one waiting for a new target.
//
// AND IT IS THE HALF THAT FEEDS THE ENGINE WITHOUT AIMING AT IT. The mirror
// takes 35% of everything the Witch Doctor deals to ANYTHING and puts it in the
// doll, so every point spent here is also loading the effigy — a plague ticking
// across six bodies is six streams of debt arriving in one place. That is the
// class's shape: Effigy is where the debt is spent, Blight is where it is
// earned, and the §4.2 decision is how much of each.
//
// ONE NODE READS THE ENGINE, AND IT IS THE DRAIN. `wd_leech_the_link` pulls
// health in proportion to what the doll is carrying — the one place where the
// debt pays the Witch Doctor rather than the room.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Bogspit
  spitDamage: 6, spitSpeed: 490, spitRange: 250, spitCd: 1150,
  // tier 2 — Rot
  rotDamage: 5, rotDuration: 3600, rotSpread: 130, rotCd: 4200,
  // tier 3 — Fen Shroud
  shroudAmount: 22, shroudDuration: 4600, shroudCd: 7200,
  // tier 4 — Marsh Gas
  gasDamage: 5, gasRadius: 150, gasCount: 3, gasDuration: 3800,
  gasTickMs: 430, gasCd: 5400, gasSlowMult: 0.72, gasSlowDur: 1400,
  // tier 5 — Leech the Link
  leechDamage: 8, leechRange: 235, leechHealPct: 0.5, leechCd: 3800, leechPer: 0.05,
  // tier 6 — Grave Wax
  waxDamage: 10, waxSpeed: 505, waxRange: 255, waxCd: 3400,
  waxWeakenMult: 0.76, waxWeakenDur: 2600,
  // tier 7 — Carrion Choir
  choirDamage: 10, choirAngle: 2.0, choirRange: 225, choirRadius: 185,
  choirCount: 3, choirCd: 4800, choirHealPerHit: 4,
  // tier 8 — Drowned Ward
  drownedAmount: 28, drownedDuration: 5200, drownedReflect: 0.4, drownedCd: 9200,
  // tier 9 — Spoil
  spoilDamage: 7, spoilDuration: 4200, spoilSpread: 175, spoilCd: 6200,
  // tier 10 — The Long Rot
  longDamage: 15, longAngle: 2.6, longRange: 245, longRadius: 210,
  longCount: 4, longCd: 10000, longKnock: 240,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const WD_BLIGHT = [
  {
    id: 'wd_bogspit', tree: 'wd_blight', tier: 1, name: 'Bogspit',
    desc: 'A gob of something wrong at the nearest thing. Deals 6 damage at 250 range.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.spitRange },
    cooldown: T.spitCd,
    compose: [{ kind: 'bolt', damage: T.spitDamage, speed: T.spitSpeed, range: T.spitRange, riders: {} }],
    ranks: R,
  },
  {
    // The Witch Doctor is the natural home for `plague`, and the interaction
    // with the mirror is the point: a plague on six bodies is six streams of
    // debt arriving in one doll, none of them aimed at it.
    id: 'wd_rot', tree: 'wd_blight', tier: 2, name: 'Rot',
    desc: 'A sickness that spreads to everything within 130. 5 damage a second for 3.6s.',
    type: 'active', domain: 'spiritual', prereq: 'wd_bogspit',
    select: 'densest_cluster',
    trigger: { kind: 'NEAREST', range: T.spitRange },
    cooldown: T.rotCd,
    compose: [{
      kind: 'plague', damage: T.rotDamage, duration: T.rotDuration, spreadRadius: T.rotSpread,
    }],
    ranks: R,
  },
  {
    id: 'wd_fen_shroud', tree: 'wd_blight', tier: 3, name: 'Fen Shroud',
    desc: 'Absorbs 22 over 4.6s when you drop below 60% health.',
    type: 'active', domain: 'spiritual', prereq: 'wd_rot',
    select: 'nearest',
    trigger: { kind: 'SELF_THRESHOLD', pct: 60 },
    cooldown: T.shroudCd,
    compose: [{ kind: 'shield', amount: T.shroudAmount, duration: T.shroudDuration }],
    ranks: R,
  },
  {
    id: 'wd_marsh_gas', tree: 'wd_blight', tier: 4, name: 'Marsh Gas',
    desc: 'A low cloud that drags the crowd to 72% speed for 1.4s. 5 damage a tick over 3.8s.',
    type: 'active', domain: 'mental', prereq: 'wd_fen_shroud',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.gasRadius, count: T.gasCount },
    cooldown: T.gasCd,
    compose: [{
      kind: 'hazard', damage: T.gasDamage, radius: T.gasRadius,
      duration: T.gasDuration, tickMs: T.gasTickMs,
      riders: { slow: { mult: T.gasSlowMult, dur: T.gasSlowDur } },
    }],
    ranks: R,
  },
  {
    // The tree's one engine reader, and deliberately the sustain: the debt in
    // the doll pays the Witch Doctor back rather than paying the room.
    id: 'wd_leech_the_link', tree: 'wd_blight', tier: 5, name: 'Leech the Link',
    desc: 'Deals 8 damage, +5% per point the doll is carrying, and returns half of it as health.',
    type: 'active', domain: 'spiritual', prereq: 'wd_marsh_gas',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.leechRange },
    cooldown: T.leechCd,
    compose: [{
      kind: 'drain', damage: T.leechDamage, range: T.leechRange, healPct: T.leechHealPct,
      scaleWith: 'doll', scalePer: T.leechPer,
    }],
    ranks: R,
  },
  {
    id: 'wd_grave_wax', tree: 'wd_blight', tier: 6, name: 'Grave Wax',
    desc: 'A seal on the fattest thing in range. 10 damage, and it deals 24% less for 2.6s.',
    type: 'active', domain: 'mental', prereq: 'wd_leech_the_link',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.waxRange },
    cooldown: T.waxCd,
    compose: [{
      kind: 'bolt', damage: T.waxDamage, speed: T.waxSpeed, range: T.waxRange,
      riders: { weakenDamage: { mult: T.waxWeakenMult, dur: T.waxWeakenDur } },
    }],
    ranks: R,
  },
  {
    id: 'wd_carrion_choir', tree: 'wd_blight', tier: 7, name: 'Carrion Choir',
    desc: 'A fan of flies that returns 4 health for every enemy it touches. Deals 10 damage.',
    type: 'active', domain: 'spiritual', prereq: 'wd_grave_wax',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.choirRadius, count: T.choirCount },
    cooldown: T.choirCd,
    compose: [{
      kind: 'cone', damage: T.choirDamage, angle: T.choirAngle, range: T.choirRange,
      riders: { healPerHit: T.choirHealPerHit },
    }],
    ranks: R,
  },
  {
    id: 'wd_drowned_ward', tree: 'wd_blight', tier: 8, name: 'Drowned Ward',
    desc: 'Absorbs 28 over 5.2s and returns 40% of what it stops.',
    type: 'active', domain: 'spiritual', prereq: 'wd_carrion_choir',
    select: 'nearest',
    trigger: { kind: 'SELF_THRESHOLD', pct: 45 },
    cooldown: T.drownedCd,
    compose: [{
      kind: 'ward', amount: T.drownedAmount, duration: T.drownedDuration,
      reflectPct: T.drownedReflect,
    }],
    ranks: R,
  },
  {
    id: 'wd_spoil', tree: 'wd_blight', tier: 9, name: 'Spoil',
    desc: 'A deeper rot with a wider reach. 7 damage a second for 4.2s, spreading to 175.',
    type: 'active', domain: 'spiritual', prereq: 'wd_drowned_ward',
    select: 'densest_cluster',
    trigger: { kind: 'NEAREST', range: T.waxRange },
    cooldown: T.spoilCd,
    compose: [{
      kind: 'plague', damage: T.spoilDamage, duration: T.spoilDuration, spreadRadius: T.spoilSpread,
    }],
    ranks: R,
  },
  {
    id: 'wd_the_long_rot', tree: 'wd_blight', tier: 10, name: 'The Long Rot',
    desc: 'Everything in front of you goes over at once. 15 damage in a wide fan, and they go with it.',
    type: 'active', domain: 'physical', prereq: 'wd_spoil',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.longRadius, count: T.longCount },
    cooldown: T.longCd,
    compose: [{
      kind: 'cone', damage: T.longDamage, angle: T.longAngle, range: T.longRange,
      riders: { knockback: T.longKnock },
    }],
    ranks: R,
  },
];
