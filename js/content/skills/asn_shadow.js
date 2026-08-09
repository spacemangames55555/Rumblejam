// ASSASSIN — Shadow tree.
//
// The other half, and — like Arcana, Grace, Ensemble, Collapse, Blight and Reef
// — deliberately the half that mostly does NOT read the engine. Killbox prepares
// ground and scales off it; Shadow is direct work, paid in flat numbers, so an
// Assassin whose field just went off is still a functioning character rather
// than one waiting to re-lay it.
//
// AND IT IS THE HALF THAT LETS THE CLASS FIGHT AWAY FROM ITS OWN BOX. Every cast
// inside the detonation range cashes the ground it is standing on, so an
// Assassin that only owned Killbox skills could never hold a field and fight at
// the same time. Shadow is what it uses while the box waits: single-target work
// on the thing that matters, which is also the class's §1.1 identity — the
// Assassin does not clear rooms, it removes one thing from them.
//
// ONE NODE READS THE ENGINE, AND IT IS THE EXECUTE. `asn_last_word` hits harder
// the more ground is still armed — the one place where a field the Assassin has
// NOT spent pays it something anyway.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Backstep
  backDamage: 6, backSpeed: 530, backRange: 250, backCd: 1100,
  // tier 2 — Hamstring
  hamDamage: 8, hamReach: 104, hamArc: 1.6, hamRadius: 130, hamCount: 1,
  hamCd: 2800, hamSlowMult: 0.68, hamSlowDur: 1600,
  // tier 3 — Vanish
  vanishAmount: 22, vanishDuration: 4400, vanishCd: 7000,
  // tier 4 — Open Vein
  veinDamage: 9, veinSpeed: 515, veinRange: 255, veinCd: 3200,
  veinDotDamage: 9, veinDotDur: 2800,
  // tier 5 — Last Word
  lastDamage: 12, lastSpeed: 540, lastRange: 260, lastPct: 45, lastCd: 4600, lastPer: 0.06,
  // tier 6 — Mark of Debt
  debtDamage: 10, debtSpeed: 505, debtRange: 255, debtCd: 3400,
  debtDefMult: 0.74, debtDefDur: 2600,
  // tier 7 — Cutpurse
  purseDamage: 9, purseRange: 235, purseHealPct: 0.45, purseCd: 3600,
  // tier 8 — Two Blades
  twoDamage: 8, twoReach: 110, twoArc: 1.9, twoRadius: 138, twoCount: 2,
  twoCd: 3200, twoPulses: 2,
  // tier 9 — Nightwork
  nightDamage: 6, nightRadius: 145, nightCount: 3, nightDuration: 3600,
  nightTickMs: 420, nightCd: 5400, nightSlowMult: 0.76, nightSlowDur: 1200,
  // tier 10 — The Contract
  contractDamage: 20, contractSpeed: 560, contractRange: 270, contractCd: 9500,
  contractStun: 700,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const ASN_SHADOW = [
  {
    id: 'asn_backstep', tree: 'asn_shadow', tier: 1, name: 'Backstep',
    desc: 'A thrown blade at the nearest thing. Deals 6 damage at 250 range.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.backRange },
    cooldown: T.backCd,
    compose: [{ kind: 'bolt', damage: T.backDamage, speed: T.backSpeed, range: T.backRange, riders: {} }],
    ranks: R,
  },
  {
    id: 'asn_hamstring', tree: 'asn_shadow', tier: 2, name: 'Hamstring',
    desc: 'A cut behind the knee — it crawls at 68% for 1.6s. Deals 8 damage.',
    type: 'active', domain: 'physical', prereq: 'asn_backstep',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.hamRadius, count: T.hamCount },
    cooldown: T.hamCd,
    compose: [{
      kind: 'strike', damage: T.hamDamage, reach: T.hamReach, arc: T.hamArc,
      riders: { slow: { mult: T.hamSlowMult, dur: T.hamSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'asn_vanish', tree: 'asn_shadow', tier: 3, name: 'Vanish',
    desc: 'Absorbs 22 over 4.4s when you drop below 55% health.',
    type: 'active', domain: 'mental', prereq: 'asn_hamstring',
    select: 'nearest',
    trigger: { kind: 'SELF_THRESHOLD', pct: 55 },
    cooldown: T.vanishCd,
    compose: [{ kind: 'shield', amount: T.vanishAmount, duration: T.vanishDuration }],
    ranks: R,
  },
  {
    id: 'asn_open_vein', tree: 'asn_shadow', tier: 4, name: 'Open Vein',
    desc: 'A blade that keeps working. 9 damage plus 9 over 2.8s.',
    type: 'active', domain: 'physical', prereq: 'asn_vanish',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.veinRange },
    cooldown: T.veinCd,
    compose: [{
      kind: 'bolt', damage: T.veinDamage, speed: T.veinSpeed, range: T.veinRange,
      riders: { impactDot: { damage: T.veinDotDamage, dur: T.veinDotDur } },
    }],
    ranks: R,
  },
  {
    // The tree's one engine reader, and deliberately the EXECUTE: a field the
    // Assassin has not spent still pays it something, which is the only reason
    // holding a full box while fighting elsewhere is worth doing.
    id: 'asn_last_word', tree: 'asn_shadow', tier: 5, name: 'Last Word',
    desc: 'Finishes what is nearly gone. 12 damage below 45% health, +6% per trap still set.',
    type: 'active', domain: 'mental', prereq: 'asn_open_vein',
    select: 'lowest_hp',
    trigger: { kind: 'TARGET_THRESHOLD', pct: T.lastPct, range: T.lastRange },
    cooldown: T.lastCd,
    compose: [{
      kind: 'bolt', damage: T.lastDamage, speed: T.lastSpeed, range: T.lastRange,
      scaleWith: 'killbox', scalePer: T.lastPer, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'asn_mark_of_debt', tree: 'asn_shadow', tier: 6, name: 'Mark of Debt',
    desc: 'Opens the fattest thing in range — it takes 26% more for 2.6s. Deals 10 damage.',
    type: 'active', domain: 'mental', prereq: 'asn_last_word',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.debtRange },
    cooldown: T.debtCd,
    compose: [{
      kind: 'bolt', damage: T.debtDamage, speed: T.debtSpeed, range: T.debtRange,
      riders: { weakenDefense: { mult: T.debtDefMult, dur: T.debtDefDur } },
    }],
    ranks: R,
  },
  {
    // A `drain` rather than a passive regen, for the same reason the Priest's
    // Litany, the Bard's Answering Chorus, the Mage's Accretion and the
    // Sundian's Sump are: `regen` is an ITEM hook, not a registered passive key
    // (§8.3).
    id: 'asn_cutpurse', tree: 'asn_shadow', tier: 7, name: 'Cutpurse',
    desc: 'Deals 9 damage and takes 45% of it back as health.',
    type: 'active', domain: 'physical', prereq: 'asn_mark_of_debt',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.purseRange },
    cooldown: T.purseCd,
    compose: [{ kind: 'drain', damage: T.purseDamage, range: T.purseRange, healPct: T.purseHealPct }],
    ranks: R,
  },
  {
    id: 'asn_two_blades', tree: 'asn_shadow', tier: 8, name: 'Two Blades',
    desc: 'Two cuts on the same beat. Deals 8 damage a pulse.',
    type: 'active', domain: 'physical', prereq: 'asn_cutpurse',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.twoRadius, count: T.twoCount },
    cooldown: T.twoCd,
    compose: [{
      kind: 'strike', damage: T.twoDamage, reach: T.twoReach, arc: T.twoArc,
      riders: { multiPulse: T.twoPulses },
    }],
    ranks: R,
  },
  {
    id: 'asn_nightwork', tree: 'asn_shadow', tier: 9, name: 'Nightwork',
    desc: 'Ground glass underfoot that slows to 76% for 1.2s. 6 damage a tick over 3.6s.',
    type: 'active', domain: 'physical', prereq: 'asn_two_blades',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.nightRadius, count: T.nightCount },
    cooldown: T.nightCd,
    compose: [{
      kind: 'hazard', damage: T.nightDamage, radius: T.nightRadius,
      duration: T.nightDuration, tickMs: T.nightTickMs,
      riders: { slow: { mult: T.nightSlowMult, dur: T.nightSlowDur } },
    }],
    ranks: R,
  },
  {
    // The single biggest number in the class, on one target, at range. §1.1: the
    // Assassin does not clear rooms, it removes one thing from them.
    id: 'asn_the_contract', tree: 'asn_shadow', tier: 10, name: 'The Contract',
    desc: 'One name, one blade. 20 damage to the fattest thing in range, and it is stunned for 0.7s.',
    type: 'active', domain: 'mental', prereq: 'asn_nightwork',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.contractRange },
    cooldown: T.contractCd,
    compose: [{
      kind: 'bolt', damage: T.contractDamage, speed: T.contractSpeed, range: T.contractRange,
      riders: { stun: T.contractStun },
    }],
    ranks: R,
  },
];
