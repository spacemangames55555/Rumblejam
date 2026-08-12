// BARD — Ensemble tree.
//
// The other half, and — like the Wizard's Arcana and the Priest's Grace —
// deliberately the half that mostly does NOT read the engine. Cadence banks
// stacks and scales off them; Ensemble is flat numbers and party support, so a
// Bard whose chain has lapsed is still a functioning character rather than one
// waiting for permission to matter.
//
// AND IT IS THE TREE THAT COSTS THE ENGINE SOMETHING. Every skill in the game
// refreshes the rhythm window when it fires, so Ensemble does not break the
// chain by existing — it breaks it by being SLOW. These cooldowns are the
// longest on the class, which is what makes a point spent here a real trade
// rather than a free addition: each one is power the Bard gains and a gap the
// Bard has to cover from somewhere else. §4.2 wants depth-versus-breadth live,
// and this is that decision measured in seconds rather than in damage.
//
// ONE NODE READS THE ENGINE, AND IT IS THE HEAL. `bard_refrain` restores more
// the longer the chain has held — the one place where keeping time pays the
// party rather than the Bard, which is what §8.3's Ensemble clause is about.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Sting
  stingDamage: 5, stingReach: 100, stingArc: 1.5, stingRadius: 125,
  stingCount: 1, stingCd: 1600,
  // tier 2 — Refrain
  refrainAmount: 15, refrainCd: 5600,
  // tier 3 — Traveling Song
  travelAmount: 20, travelDuration: 4400, travelCd: 7200,
  // tier 4 — Cutting Remark
  remarkDamage: 7, remarkSpeed: 500, remarkRange: 255, remarkCd: 4200,
  remarkWeakenMult: 0.78, remarkWeakenDur: 2600,
  // tier 5 — Answering Chorus
  chorusDamage: 6, chorusRange: 235, chorusHealPct: 0.5, chorusCd: 4400,
  // tier 6 — Dirge
  dirgeDamage: 4, dirgeRadius: 145, dirgeCount: 3, dirgeDuration: 3800,
  dirgeTickMs: 440, dirgeCd: 6400, dirgeSlowMult: 0.74, dirgeSlowDur: 1300,
  // tier 7 — Rondo
  rondoDamage: 8, rondoAngle: 2.0, rondoRange: 225, rondoRadius: 180,
  rondoCount: 3, rondoCd: 5400, rondoHealPerHit: 5,
  // tier 8 — Standing Ovation
  ovationAmount: 32, ovationDuration: 5400, ovationReflect: 0.35, ovationCd: 9200,
  // tier 9 — Marching Order
  marchDamage: 7, marchWidth: 36, marchLength: 370, marchRadius: 205,
  marchCount: 3, marchCd: 6600, marchRoot: 1300,
  // tier 10 — Finale
  finaleDamage: 10, finaleAngle: 2.6, finaleRange: 245, finaleRadius: 215,
  finaleCount: 4, finaleCd: 11000, finaleKnock: 260, finaleHealPerHit: 6,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const BARD_ENSEMBLE = [
  {
    id: 'bard_sting', tree: 'bard_ensemble', tier: 1, name: 'Sting',
    desc: 'A short lash at whatever came close. Deals 5 damage in a 1.5-radian arc.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.stingRadius, count: T.stingCount },
    cooldown: T.stingCd,
    compose: [{ kind: 'strike', damage: T.stingDamage, reach: T.stingReach, arc: T.stingArc, riders: {} }],
    ranks: R,
  },
  {
    // The one node in the tree that reads the engine, and deliberately the heal.
    // A Bard holding a long chain heals harder, which is the only place in the
    // class where keeping time pays the PARTY instead of the Bard.
    id: 'bard_refrain', tree: 'bard_ensemble', tier: 2, name: 'Refrain',
    desc: 'Restores 15 health, +2.5% for every stack you are holding.',
    type: 'active', domain: 'spiritual', prereq: 'bard_sting',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 70 },
    cooldown: T.refrainCd,
    compose: [{
      kind: 'heal', amount: T.refrainAmount,
      scaleWith: 'rhythm',
    }],
    ranks: R,
  },
  {
    id: 'bard_traveling_song', tree: 'bard_ensemble', tier: 4, name: 'Traveling Song',
    desc: 'Absorbs 20 over 4.4s when you drop below 60% health.',
    type: 'active', domain: 'spiritual', prereq: 'bard_refrain',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 60 },
    cooldown: T.travelCd,
    compose: [{ kind: 'shield', amount: T.travelAmount, duration: T.travelDuration }],
    ranks: R,
  },
  {
    id: 'bard_cutting_remark', tree: 'bard_ensemble', tier: 4, name: 'Cutting Remark',
    desc: 'A barb at the fattest thing in range. 7 damage, and it deals 22% less for 2.6s.',
    type: 'active', domain: 'mental', prereq: 'bard_refrain',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.remarkRange },
    cooldown: T.remarkCd,
    compose: [{
      kind: 'bolt', damage: T.remarkDamage, speed: T.remarkSpeed, range: T.remarkRange,
      riders: { weakenDamage: { mult: T.remarkWeakenMult, dur: T.remarkWeakenDur } },
    }],
    ranks: R,
  },
  {
    // A `drain` rather than a passive regen, for the same reason the Priest's
    // Litany is one: `regen` is an ITEM hook, not a registered passive key, and
    // inventing a passive key means a reader in `skillsim.js` — the engine code
    // a content-shaped class is not supposed to cost. See §8.3.
    id: 'bard_answering_chorus', tree: 'bard_ensemble', tier: 6, name: 'Answering Chorus',
    desc: 'Deals 6 damage and returns half of it as health.',
    type: 'active', domain: 'spiritual', prereq: 'bard_traveling_song',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.chorusRange },
    cooldown: T.chorusCd,
    compose: [{ kind: 'drain', damage: T.chorusDamage, range: T.chorusRange, healPct: T.chorusHealPct }],
    ranks: R,
  },
  {
    id: 'bard_dirge', tree: 'bard_ensemble', tier: 6, name: 'Dirge',
    desc: 'A slow tune that hangs on the ground, slowing to 74% for 1.3s. 4 damage a tick over 3.8s.',
    type: 'active', domain: 'mental', prereq: 'bard_cutting_remark',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.dirgeRadius, count: T.dirgeCount },
    cooldown: T.dirgeCd,
    compose: [{
      kind: 'hazard', damage: T.dirgeDamage, radius: T.dirgeRadius,
      duration: T.dirgeDuration, tickMs: T.dirgeTickMs,
      riders: { slow: { mult: T.dirgeSlowMult, dur: T.dirgeSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'bard_rondo', tree: 'bard_ensemble', tier: 8, name: 'Rondo',
    desc: 'A returning phrase that heals 5 for every enemy it touches. Deals 8 damage.',
    type: 'active', domain: 'spiritual', prereq: 'bard_dirge',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.rondoRadius, count: T.rondoCount },
    cooldown: T.rondoCd,
    compose: [{
      kind: 'cone', damage: T.rondoDamage, angle: T.rondoAngle, range: T.rondoRange,
      riders: { healPerHit: T.rondoHealPerHit },
    }],
    ranks: R,
  },
  {
    id: 'bard_standing_ovation', tree: 'bard_ensemble', tier: 8, name: 'Standing Ovation',
    desc: 'Absorbs 32 over 5.4s and returns 35% of what it stops.',
    type: 'active', domain: 'spiritual', prereq: 'bard_answering_chorus',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 45 },
    cooldown: T.ovationCd,
    compose: [{
      kind: 'ward', amount: T.ovationAmount, duration: T.ovationDuration,
      reflectPct: T.ovationReflect,
    }],
    ranks: R,
  },
  {
    id: 'bard_marching_order', tree: 'bard_ensemble', tier: 10, name: 'Marching Order',
    desc: 'A line that holds what it crosses in place for 1.3s. Deals 7 damage.',
    type: 'active', domain: 'mental', prereq: 'bard_standing_ovation',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.marchRadius, count: T.marchCount },
    cooldown: T.marchCd,
    compose: [{
      kind: 'line', damage: T.marchDamage, width: T.marchWidth, length: T.marchLength,
      riders: { root: T.marchRoot },
    }],
    ranks: R,
  },
  {
    id: 'bard_finale', tree: 'bard_ensemble', tier: 10, name: 'Finale',
    desc: 'The whole room told to leave. 10 damage, 6 health back for every enemy it touches, and they go with it.',
    type: 'active', domain: 'physical', prereq: 'bard_rondo',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.finaleRadius, count: T.finaleCount },
    cooldown: T.finaleCd,
    compose: [{
      kind: 'cone', damage: T.finaleDamage, angle: T.finaleAngle, range: T.finaleRange,
      riders: { knockback: T.finaleKnock, healPerHit: T.finaleHealPerHit },
    }],
    ranks: R,
  },
];
