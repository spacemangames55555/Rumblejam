// PRIEST — Grace tree.
//
// The support half, and — like the Wizard's Arcana — deliberately the half that
// mostly does NOT read the engine. Judgment banks marks and scales off them;
// Grace is the Priest's own throughput and the party's floor, paid in flat
// numbers so that a Priest who never marks anything is still a functioning
// character rather than a healer waiting for permission.
//
// ONE NODE READS THE ENGINE, AND IT IS THE HEAL. `pri_intercession` scales its
// restoration with marks standing, which is the only place in the class where
// the debt and the payout meet: a Priest holding six marks heals harder RIGHT
// NOW, before any of them dies. That is the moment the class is designed
// around, and putting it on the heal rather than on a damage node is what keeps
// the Priest a support class with teeth instead of a mage with a conscience.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Consecrate
  consecrateDamage: 8, consecrateAngle: 1.6, consecrateRange: 200,
  consecrateRadius: 160, consecrateCount: 2, consecrateCd: 1100,
  // tier 2 — Intercession
  intercessionAmount: 14, intercessionCd: 5000, intercessionWeight: 1.14,
  // tier 3 — Warding Hand
  wardingAmount: 22, wardingDuration: 4200, wardingCd: 7000,
  // tier 4 — Smite
  smiteDamage: 12, smiteSpeed: 510, smiteRange: 250, smiteCd: 3000,
  // tier 5 — Litany
  litanyDamage: 10, litanyRange: 230, litanyHealPct: 0.55, litanyCd: 3400,
  // tier 6 — Hallowed Ground
  hallowDamage: 6, hallowRadius: 140, hallowCount: 3, hallowDuration: 3600,
  hallowTickMs: 420, hallowCd: 5200, hallowSlowMult: 0.72, hallowSlowDur: 1100,
  // tier 7 — Staff of Office
  staffDamage: 13, staffReach: 112, staffArc: 1.9, staffRadius: 145,
  staffCount: 2, staffCd: 3800, staffKnock: 220,
  // tier 8 — Vigil
  vigilAmount: 30, vigilDuration: 5200, vigilReflect: 0.4, vigilCd: 9000,
  // tier 9 — Procession
  processionDamage: 11, processionWidth: 34, processionLength: 360,
  processionRadius: 205, processionCount: 3, processionCd: 5800,
  processionRoot: 1400,
  // tier 10 — Benediction
  benedictionDamage: 16, benedictionAngle: 2.5, benedictionRange: 245,
  benedictionRadius: 215, benedictionCount: 4, benedictionCd: 10000,
  benedictionHealPerHit: 6,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const PRIEST_GRACE = [
  {
    id: 'pri_consecrate', tree: 'priest_grace', tier: 1, name: 'Consecrate',
    flavor: 'A sweep of clean fire through the crowd.',
    type: 'active', domain: 'spiritual', prereq: null,
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.consecrateRadius, count: T.consecrateCount },
    cooldown: T.consecrateCd,
    compose: [{
      kind: 'cone', damage: T.consecrateDamage, angle: T.consecrateAngle,
      range: T.consecrateRange, riders: {},
    }],
    ranks: R,
  },
  {
    // The one node in the tree that reads the engine, and it is deliberately the
    // heal — see the header. 14 base, +8% per mark standing.
    id: 'pri_intercession', tree: 'priest_grace', tier: 2, name: 'Intercession',
    type: 'active', domain: 'spiritual', prereq: 'pri_consecrate',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 70 },
    cooldown: T.intercessionCd,
    compose: [{
      kind: 'heal', amount: T.intercessionAmount,
      scaleWith: 'marks', scaleWeight: T.intercessionWeight,
    }],
    ranks: R,
  },
  {
    id: 'pri_warding_hand', tree: 'priest_grace', tier: 3, name: 'Warding Hand',
    type: 'active', domain: 'spiritual', prereq: 'pri_intercession',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 60 },
    cooldown: T.wardingCd,
    compose: [{ kind: 'shield', amount: T.wardingAmount, duration: T.wardingDuration }],
    ranks: R,
  },
  {
    id: 'pri_smite', tree: 'priest_grace', tier: 4, name: 'Smite',
    flavor: 'A bolt of judgment at the fattest thing in range.',
    type: 'active', domain: 'mental', prereq: 'pri_warding_hand',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.smiteRange },
    cooldown: T.smiteCd,
    compose: [{ kind: 'bolt', damage: T.smiteDamage, speed: T.smiteSpeed, range: T.smiteRange, riders: {} }],
    ranks: R,
  },
  {
    // A `drain` rather than a passive regen: `regen` is an ITEM hook, not a
    // registered passive key, and adding one means adding a reader in
    // `skillsim.js`. Drain says the same thing about the Priest and says it
    // better — sustain paid for by staying in the fight rather than by existing.
    id: 'pri_litany', tree: 'priest_grace', tier: 5, name: 'Litany',
    type: 'active', domain: 'spiritual', prereq: 'pri_smite',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.litanyRange },
    cooldown: T.litanyCd,
    compose: [{ kind: 'drain', damage: T.litanyDamage, range: T.litanyRange, healPct: T.litanyHealPct }],
    ranks: R,
  },
  {
    id: 'pri_hallowed_ground', tree: 'priest_grace', tier: 6, name: 'Hallowed Ground',
    flavor: 'Consecrated floor that burns and slows.',
    type: 'active', domain: 'spiritual', prereq: 'pri_litany',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.hallowRadius, count: T.hallowCount },
    cooldown: T.hallowCd,
    compose: [{
      kind: 'hazard', damage: T.hallowDamage, radius: T.hallowRadius,
      duration: T.hallowDuration, tickMs: T.hallowTickMs,
      riders: { slow: { mult: T.hallowSlowMult, dur: T.hallowSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'pri_staff_of_office', tree: 'priest_grace', tier: 7, name: 'Staff of Office',
    flavor: 'A heavy sweep that shoves what it touches away.',
    type: 'active', domain: 'physical', prereq: 'pri_hallowed_ground',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.staffRadius, count: T.staffCount },
    cooldown: T.staffCd,
    compose: [{
      kind: 'strike', damage: T.staffDamage, reach: T.staffReach, arc: T.staffArc,
      riders: { knockback: T.staffKnock },
    }],
    ranks: R,
  },
  {
    id: 'pri_vigil', tree: 'priest_grace', tier: 8, name: 'Vigil',
    type: 'active', domain: 'spiritual', prereq: 'pri_staff_of_office',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 45 },
    cooldown: T.vigilCd,
    compose: [{
      kind: 'ward', amount: T.vigilAmount, duration: T.vigilDuration,
      reflectPct: T.vigilReflect,
    }],
    ranks: R,
  },
  {
    id: 'pri_procession', tree: 'priest_grace', tier: 9, name: 'Procession',
    flavor: 'A line that holds what it crosses in place.',
    type: 'active', domain: 'mental', prereq: 'pri_vigil',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.processionRadius, count: T.processionCount },
    cooldown: T.processionCd,
    compose: [{
      kind: 'line', damage: T.processionDamage, width: T.processionWidth,
      length: T.processionLength, riders: { root: T.processionRoot },
    }],
    ranks: R,
  },
  {
    id: 'pri_benediction', tree: 'priest_grace', tier: 10, name: 'Benediction',
    flavor: 'A wide blessing.',
    type: 'active', domain: 'spiritual', prereq: 'pri_procession',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.benedictionRadius, count: T.benedictionCount },
    cooldown: T.benedictionCd,
    compose: [{
      kind: 'cone', damage: T.benedictionDamage, angle: T.benedictionAngle,
      range: T.benedictionRange,
      riders: { healPerHit: T.benedictionHealPerHit },
    }],
    ranks: R,
  },
];
