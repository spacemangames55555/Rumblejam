// SUNDIAN — Reef tree.
//
// The other half, and — like Arcana, Grace, Ensemble, Collapse and Blight —
// deliberately the half that mostly does NOT read the engine. Tidewrack soaks
// and cashes; Reef is ground control and sustain, paid in flat numbers, so a
// Sundian who has just sluiced the room dry is still a functioning character
// rather than one waiting for the tide.
//
// IT IS ALSO WHERE THE CLASS'S OWN TRAIT LIVES. Coral Growth plants a node every
// fourth attack, and nodes within reach of each other grow walls — so every
// skill in this tree is also a coral planter whether it says so or not. That is
// why the tree leans on hazards and slows: the trait wants the Sundian standing
// in a field it built, and content that pulls it out of that field would be
// fighting its own character.
//
// ONE NODE READS THE ENGINE, AND IT IS THE HEAL. `sun_brine_draught` returns
// more the wetter the room is — the one place where soaking pays the Sundian
// rather than paying the burst.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Reefcut
  cutDamage: 6, cutReach: 102, cutArc: 1.6, cutRadius: 128, cutCount: 1, cutCd: 1200,
  // tier 2 — Shoal
  shoalDamage: 5, shoalRadius: 150, shoalCount: 3, shoalDuration: 3800,
  shoalTickMs: 430, shoalCd: 5000, shoalSlowMult: 0.72, shoalSlowDur: 1400,
  // tier 3 — Brine Draught
  draughtAmount: 14, draughtCd: 5600, draughtPer: 0.02,
  // tier 4 — Barnacle
  barnDamage: 9, barnSpeed: 505, barnRange: 250, barnCd: 3200,
  barnDefMult: 0.78, barnDefDur: 2500,
  // tier 5 — Kelp Snare
  snareDamage: 9, snareWidth: 34, snareLength: 355, snareRadius: 200,
  snareCount: 3, snareCd: 5200, snareRoot: 1400,
  // tier 6 — Salt Rime
  rimeDamage: 6, rimeDuration: 3800, rimeSpread: 150, rimeCd: 5400,
  // tier 7 — Sea Wall
  wallAmount: 24, wallDuration: 4800, wallCd: 7400,
  // tier 8 — Riptooth
  riptoothDamage: 11, riptoothReach: 116, riptoothArc: 2.1, riptoothRadius: 146,
  riptoothCount: 2, riptoothCd: 4000, riptoothKnock: 210,
  // tier 9 — Sump
  sumpDamage: 9, sumpRange: 235, sumpHealPct: 0.5, sumpCd: 4200,
  // tier 10 — Longshore
  longDamage: 14, longAngle: 2.6, longRange: 245, longRadius: 210,
  longCount: 4, longCd: 10000, longSlowMult: 0.66, longSlowDur: 1800,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const SUN_REEF = [
  {
    id: 'sun_reefcut', tree: 'sun_reef', tier: 1, name: 'Reefcut',
    desc: 'A short raking cut at whatever came close. Deals 6 damage in a 1.6-radian arc.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.cutRadius, count: T.cutCount },
    cooldown: T.cutCd,
    compose: [{ kind: 'strike', damage: T.cutDamage, reach: T.cutReach, arc: T.cutArc, riders: {} }],
    ranks: R,
  },
  {
    id: 'sun_shoal', tree: 'sun_reef', tier: 2, name: 'Shoal',
    desc: 'Shallow water underfoot that drags the crowd to 72% speed for 1.4s. 5 damage a tick over 3.8s.',
    type: 'active', domain: 'physical', prereq: 'sun_reefcut',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.shoalRadius, count: T.shoalCount },
    cooldown: T.shoalCd,
    compose: [{
      kind: 'hazard', damage: T.shoalDamage, radius: T.shoalRadius,
      duration: T.shoalDuration, tickMs: T.shoalTickMs,
      riders: { slow: { mult: T.shoalSlowMult, dur: T.shoalSlowDur } },
    }],
    ranks: R,
  },
  {
    // The tree's one engine reader, and deliberately the sustain: a wet room
    // keeps the Sundian standing, which is the only place soaking pays the
    // character rather than the burst.
    id: 'sun_brine_draught', tree: 'sun_reef', tier: 3, name: 'Brine Draught',
    desc: 'Restores 14 health, +2% for every drench stack standing in the room.',
    type: 'active', domain: 'spiritual', prereq: 'sun_shoal',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 65 },
    cooldown: T.draughtCd,
    compose: [{
      kind: 'heal', amount: T.draughtAmount,
      scaleWith: 'drench', scalePer: T.draughtPer,
    }],
    ranks: R,
  },
  {
    id: 'sun_barnacle', tree: 'sun_reef', tier: 4, name: 'Barnacle',
    desc: 'Crusts the fattest thing in range — it takes 22% more for 2.5s. Deals 9 damage.',
    type: 'active', domain: 'physical', prereq: 'sun_brine_draught',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.barnRange },
    cooldown: T.barnCd,
    compose: [{
      kind: 'bolt', damage: T.barnDamage, speed: T.barnSpeed, range: T.barnRange,
      riders: { weakenDefense: { mult: T.barnDefMult, dur: T.barnDefDur } },
    }],
    ranks: R,
  },
  {
    id: 'sun_kelp_snare', tree: 'sun_reef', tier: 5, name: 'Kelp Snare',
    desc: 'A line of weed that holds what it crosses for 1.4s. Deals 9 damage.',
    type: 'active', domain: 'mental', prereq: 'sun_barnacle',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.snareRadius, count: T.snareCount },
    cooldown: T.snareCd,
    compose: [{
      kind: 'line', damage: T.snareDamage, width: T.snareWidth, length: T.snareLength,
      riders: { root: T.snareRoot },
    }],
    ranks: R,
  },
  {
    id: 'sun_salt_rime', tree: 'sun_reef', tier: 6, name: 'Salt Rime',
    desc: 'A crust that spreads to everything within 150. 6 damage a second for 3.8s.',
    type: 'active', domain: 'spiritual', prereq: 'sun_kelp_snare',
    select: 'densest_cluster',
    trigger: { kind: 'NEAREST', range: T.barnRange },
    cooldown: T.rimeCd,
    compose: [{
      kind: 'plague', damage: T.rimeDamage, duration: T.rimeDuration, spreadRadius: T.rimeSpread,
    }],
    ranks: R,
  },
  {
    id: 'sun_sea_wall', tree: 'sun_reef', tier: 7, name: 'Sea Wall',
    desc: 'Absorbs 24 over 4.8s when you drop below 60% health.',
    type: 'active', domain: 'spiritual', prereq: 'sun_salt_rime',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 60 },
    cooldown: T.wallCd,
    compose: [{ kind: 'shield', amount: T.wallAmount, duration: T.wallDuration }],
    ranks: R,
  },
  {
    id: 'sun_riptooth', tree: 'sun_reef', tier: 8, name: 'Riptooth',
    desc: 'A raking sweep that throws the front rank back. Deals 11 damage.',
    type: 'active', domain: 'physical', prereq: 'sun_sea_wall',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.riptoothRadius, count: T.riptoothCount },
    cooldown: T.riptoothCd,
    compose: [{
      kind: 'strike', damage: T.riptoothDamage, reach: T.riptoothReach, arc: T.riptoothArc,
      riders: { knockback: T.riptoothKnock },
    }],
    ranks: R,
  },
  {
    // A `drain` rather than a passive regen, for the same reason the Priest's
    // Litany, the Bard's Answering Chorus and the Mage's Accretion are: `regen`
    // is an ITEM hook, not a registered passive key, and inventing one means a
    // reader in `skillsim.js` (§8.3).
    id: 'sun_sump', tree: 'sun_reef', tier: 9, name: 'Sump',
    desc: 'Deals 9 damage and draws half of it back as health.',
    type: 'active', domain: 'spiritual', prereq: 'sun_riptooth',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.sumpRange },
    cooldown: T.sumpCd,
    compose: [{ kind: 'drain', damage: T.sumpDamage, range: T.sumpRange, healPct: T.sumpHealPct }],
    ranks: R,
  },
  {
    id: 'sun_longshore', tree: 'sun_reef', tier: 10, name: 'Longshore',
    desc: 'The whole shelf moves. 14 damage in a wide fan, and what it touches crawls at 66% for 1.8s.',
    type: 'active', domain: 'physical', prereq: 'sun_sump',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.longRadius, count: T.longCount },
    cooldown: T.longCd,
    compose: [{
      kind: 'cone', damage: T.longDamage, angle: T.longAngle, range: T.longRange,
      riders: { slow: { mult: T.longSlowMult, dur: T.longSlowDur } },
    }],
    ranks: R,
  },
];
