// SAMURAI — Armor tree, and the Footing engine.
//
// Melee and defensive. This is the riskiest part of the patch and the part most
// worth watching in playtest.
//
// FOOTING is a continuously scaling resource, not a MOVEMENT trigger. The
// difference matters: other trees read the stack count — Tactics scales damage
// off it, Agility spends it outright — so it has to be readable state on the
// player rather than a condition evaluated inside one skill. Neither of those
// trees is in this patch; the resource is exposed so they drop in without
// rework.
//
// The full stack drops the INSTANT the player moves. No decay, no partial
// retention. A gradual falloff would let the Samurai drift around the arena and
// keep most of the payoff, which erases the decision the engine exists to
// create: a high-Footing Samurai is extremely durable and has surrendered his
// ability to dodge anything telegraphed, because dodging means moving means
// losing everything.
//
// No skill list for the Samurai exists in any source document. This tree is
// authored for this patch and is the most likely thing here to need revision.

export const TUNING = {
  // the engine
  footingTickMs: 500,          // one stack per half-second stationary
  footingMaxStacks: 10,
  // Absorb per stack, NOT max HP — see engineStatBonus in js/skillsim.js for
  // why. Roughly the old per-stack vitality, so a full stance is worth about
  // what it was worth before, without taking current HP when it breaks.
  footingShieldPerStack: 4,
  footingGritPerStack: 2,
  footingDodgePerStack: 1.2,
  // tier 1 — Cross Guard Cut
  cutDamage: 9, cutReach: 90, cutArc: 1.6, cutCd: 800,
  // tier 2 — Set Stance (passive)
  stanceBonusStacks: 1, stanceAccrualPct: 0.20,
  // tier 3 — Iron Sleeve
  sleeveAmount: 14, sleeveDuration: 4000, sleeveCd: 5000, sleevePerFooting: 0.12,
  // tier 4 — Sweeping Guard
  sweepDamage: 8, sweepReach: 115, sweepArc: 2.6, sweepRadius: 110,
  sweepCount: 3, sweepCd: 4500, sweepKnock: 260,
  // tier 5 — Immovable
  immovableAmount: 20, immovableDuration: 4000, immovableSeconds: 3,
  immovableReflect: 0.35, immovableCd: 8000,
  // tier 6 — Rebuke
  rebukeDamage: 14, rebukeReach: 100, rebukeArc: 2.0, rebukeWindow: 400,
  rebukeStun: 900, rebukeCd: 3500,
  // tier 7 — Weight of Armor (passive)
  weightGritPerStack: 2,
  // tier 8 — Crushing Descent
  crushDamage: 11, crushReach: 100, crushArc: 1.2, crushPct: 40,
  crushPulses: 2, crushCd: 5000,
  // tier 9 — Bulwark
  bulwarkShield: 30, bulwarkShieldDur: 5000, bulwarkWard: 24,
  bulwarkWardDur: 5000, bulwarkReflect: 0.5, bulwarkPct: 35, bulwarkCd: 12000,
  // tier 10 — Unbroken Line
  unbrokenDamage: 12, unbrokenReach: 130, unbrokenArc: 3.0, unbrokenRadius: 130,
  unbrokenCount: 4, unbrokenPulses: 2, unbrokenCd: 9000,
  unbrokenSlowMult: 0.65, unbrokenSlowDur: 1500,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const SAMURAI_ARMOR = [
  {
    id: 'sam_cross_guard', tree: 'samurai_armor', tier: 1, name: 'Cross Guard Cut',
    desc: 'A short cut from a closed guard. Nothing fancy; it is always there.',
    type: 'active', domain: 'physical', prereq: null,
    trigger: { kind: 'NEAREST', range: T.cutReach },
    cooldown: T.cutCd,
    compose: [{ kind: 'strike', damage: T.cutDamage, arc: T.cutArc, reach: T.cutReach, riders: {} }],
    ranks: R,
  },
  {
    id: 'sam_set_stance', tree: 'samurai_armor', tier: 2, name: 'Set Stance',
    desc: 'You settle faster, and hold more.',
    type: 'passive', domain: 'physical', prereq: 'sam_cross_guard',
    trigger: null, cooldown: 0, compose: [],
    passive: { footingMaxBonus: T.stanceBonusStacks, footingAccrualPct: T.stanceAccrualPct },
    ranks: R,
  },
  {
    id: 'sam_iron_sleeve', tree: 'samurai_armor', tier: 3, name: 'Iron Sleeve',
    desc: 'Armour takes the blow you did not. Worth more the longer you have stood.',
    type: 'active', domain: 'physical', prereq: 'sam_set_stance',
    trigger: { kind: 'ON_HIT_TAKEN' },
    cooldown: T.sleeveCd,
    compose: [{
      kind: 'shield', amount: T.sleeveAmount, duration: T.sleeveDuration,
      scaleWith: 'footing', scalePer: T.sleevePerFooting,
    }],
    ranks: R,
  },
  {
    id: 'sam_sweeping_guard', tree: 'samurai_armor', tier: 4, name: 'Sweeping Guard',
    desc: 'A wide sweep that buys back the ground around you.',
    type: 'active', domain: 'physical', prereq: 'sam_iron_sleeve',
    trigger: { kind: 'PROXIMITY', radius: T.sweepRadius, count: T.sweepCount },
    cooldown: T.sweepCd,
    compose: [{
      kind: 'strike', damage: T.sweepDamage, arc: T.sweepArc, reach: T.sweepReach,
      riders: { knockback: T.sweepKnock },
    }],
    ranks: R,
  },
  {
    id: 'sam_immovable', tree: 'samurai_armor', tier: 5, name: 'Immovable',
    desc: 'Stand long enough and what comes at you starts coming back.',
    type: 'active', domain: 'mental', prereq: 'sam_sweeping_guard',
    trigger: { kind: 'MOVEMENT', mode: 'still', seconds: T.immovableSeconds },
    cooldown: T.immovableCd,
    compose: [{
      kind: 'ward', amount: T.immovableAmount, duration: T.immovableDuration,
      reflectPct: T.immovableReflect,
    }],
    ranks: R,
  },
  {
    id: 'sam_rebuke', tree: 'samurai_armor', tier: 6, name: 'Rebuke',
    desc: 'The answer to a blow that missed. The one skill here that pays you for moving.',
    type: 'active', domain: 'physical', prereq: 'sam_immovable',
    trigger: { kind: 'ON_DODGE', window: T.rebukeWindow },
    cooldown: T.rebukeCd,
    compose: [{
      kind: 'strike', damage: T.rebukeDamage, arc: T.rebukeArc, reach: T.rebukeReach,
      riders: { stun: T.rebukeStun },
    }],
    ranks: R,
  },
  {
    id: 'sam_weight', tree: 'samurai_armor', tier: 7, name: 'Weight of Armor',
    desc: 'Every stack of footing is worth more grit than it was.',
    type: 'passive', domain: 'physical', prereq: 'sam_rebuke',
    trigger: null, cooldown: 0, compose: [],
    passive: { footingGritBonus: T.weightGritPerStack },
    ranks: R,
  },
  {
    id: 'sam_crushing', tree: 'samurai_armor', tier: 8, name: 'Crushing Descent',
    desc: 'Finish what the guard already broke.',
    type: 'active', domain: 'physical', prereq: 'sam_weight',
    trigger: { kind: 'TARGET_THRESHOLD', pct: T.crushPct, range: T.crushReach },
    cooldown: T.crushCd,
    compose: [{
      kind: 'strike', damage: T.crushDamage, arc: T.crushArc, reach: T.crushReach,
      riders: { multiPulse: T.crushPulses },
    }],
    ranks: R,
  },
  {
    id: 'sam_bulwark', tree: 'samurai_armor', tier: 9, name: 'Bulwark',
    desc: 'Once, on the way down.',
    type: 'active', domain: 'mental', prereq: 'sam_crushing',
    trigger: { kind: 'SELF_THRESHOLD', pct: T.bulwarkPct },
    cooldown: T.bulwarkCd,
    compose: [
      { kind: 'shield', amount: T.bulwarkShield, duration: T.bulwarkShieldDur },
      { kind: 'ward', amount: T.bulwarkWard, duration: T.bulwarkWardDur, reflectPct: T.bulwarkReflect },
    ],
    ranks: R,
  },
  {
    id: 'sam_unbroken', tree: 'samurai_armor', tier: 10, name: 'Unbroken Line',
    desc: 'The line does not move. Neither do you.',
    type: 'active', domain: 'physical', prereq: 'sam_bulwark',
    trigger: { kind: 'PROXIMITY', radius: T.unbrokenRadius, count: T.unbrokenCount },
    cooldown: T.unbrokenCd,
    compose: [{
      kind: 'strike', damage: T.unbrokenDamage, arc: T.unbrokenArc, reach: T.unbrokenReach,
      riders: {
        multiPulse: T.unbrokenPulses,
        slow: { mult: T.unbrokenSlowMult, dur: T.unbrokenSlowDur },
      },
    }],
    ranks: R,
  },
];
