import { STAT_NAME } from '../../config.js';
// SAVAGE — Aftermath. The third tree, and the answer to the half of the engine
// that the engine's own code describes and neither existing tree mentions.
//
// WHAT THE FIRST TWO LEAVE UNANSWERED. Primal Fury reads `cascade`; Bloodbound
// carries no cascade scaling at all and exists to give the Savage *more
// different skills*, because the chain advances on VARIETY and a repeat resets
// it. Both trees are about keeping the chain going.
//
// Neither says what happens when it stops — and §8.3 already ruled that the
// player cannot stop it stopping. Fire order is not a decision: nothing is
// manually cast, so the order is cooldown arithmetic and whichever triggers
// happen to hold. That ruling rests on a measurement rather than a preference,
// which makes the consequence as durable as the engine.
//
// AND THE ENGINE MAKES IT WORSE THE BETTER YOU ARE DOING. `cascadeAdvance`
// shortens the cooldown of the cast that extends the chain, so a deeper cascade
// shortens the FASTEST skill most, so the fastest skill comes back soonest, so
// it is likeliest to be the one that fires twice running. The comment in
// `js/engines.js` says it outright: "the engine makes its own maintenance
// harder as it deepens." Cascade is uncapped (measured to 185), and the break
// is total rather than a decay — `p.cascade = 0`, all of it, at the moment the
// number is largest and the reset is nearest.
//
// So the Savage's power is a sawtooth whose teeth get taller and whose falls
// get steeper, and the player owns neither edge. Aftermath is the tooth, read
// from both ends:
//
//   BACKDRAFT (branch A) cashes the peak. Long cooldowns, heavy cascade
//     scaling — these are the skills that are worth the most at exactly the
//     moment the chain is most likely to break, which is the honest way to
//     spend a number you are about to lose.
//   BEDROCK (branch B) survives the trough. Not one node scales on `cascade`;
//     they scale on `armor`, which is `max(0, Grit)` and the one resource in
//     this class that no fire order can zero. Long durations on purpose: a
//     ward set at the crest is still standing in the valley.
//
// A NOTE ON WHAT THIS TREE CANNOT DO ALONE. `cascadeAdvance` returns early
// unless the player has spent in `sav_primal_fury`, so a Savage who takes only
// this tree banks no cascade and branch A's scaling reads 1. That is the
// cross-tree supply §8.1 intends — points spread freely across three trees —
// and it is why Bedrock is the branch that works regardless.
//
// PAIRED WITH hun_pincer ON PURPOSE: `cascade` is a float on the caster with a
// decay tick, an idle timer and a total-reset rule; `spread` is an integer
// recomputed every tick from the DISTANCE between two entities. Different
// fields, different write paths, nothing shared — a defect under both surfaces
// twice rather than once.
//
// THE SHAPE (§8.1): ten nodes, tiers 1/2/4/6/8/10, one branch at tier 2, two
// capstones, symmetric.

export const TUNING = {
  emberDamage: 12, emberReach: 116, emberArc: 1.8, emberCd: 1150,
  sawtoothWeight: 0.15,

  // ---- branch A: Backdraft (cash the peak; it is about to be gone) ----
  // HEAVY WEIGHTS AND LONG COOLDOWNS, and the two go together. A weight above
  // the engine's standard says this step rides cascade harder than the roster
  // does; a long cooldown means it comes round rarely enough that when it does,
  // the chain has had time to be deep. Together they are a skill that is worth
  // most at the crest — which is also the moment the crest is likeliest to end.
  backdraftDamage: 26, backdraftArc: 1.8, backdraftRange: 290, backdraftCd: 5200,
  backdraftWeight: 1.25,
  emberfallWeight: 0.18,
  detonateDamage: 34, detonateReach: 150, detonateArc: 2.6, detonateCd: 7400,
  detonateKnock: 240, detonateWeight: 1.25,
  flashoverDamage: 44, flashoverArc: 2.9, flashoverReach: 155, flashoverCd: 9600,
  flashoverPulses: 2, flashoverWeight: 1.3,

  // ---- branch B: Bedrock (what is still there afterwards) ----
  // NOT ONE `cascade` IN THIS BRANCH. Grit does not reset when a skill fires
  // twice running, so `armor` is the term that is still worth something in the
  // valley — and the durations are long for the same reason: a ward raised at
  // the crest should outlive the fall that follows it.
  bedrockAmount: 38, bedrockDuration: 6000, bedrockPct: 65, bedrockCd: 4600,
  graniteWeight: 0.18,
  scarDamage: 20, scarRadius: 170, scarDuration: 6400, scarTickMs: 420, scarCd: 5400,
  scarSlow: { mult: 0.6, dur: 2400 },
  bedrockWardAmount: 52, bedrockWardDuration: 7200, bedrockWardReflect: 34,
  bedrockWardPct: 45, bedrockWardCd: 9200,

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
const CASC = { scaleWith: 'cascade' };
const ARMOR = { scaleWith: 'armor' };

export const SAV_AFTERMATH = [
  {
    id: 'sav_ember', tree: 'sav_aftermath', tier: 1, name: 'Ember',
    desc: 'What is left when the fire goes out, and the reason there is a tree here at all.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.emberReach },
    cooldown: T.emberCd,
    compose: [{ kind: 'strike', damage: T.emberDamage, arc: T.emberArc, reach: T.emberReach, ...CASC, riders: {} }],
    ranks: R,
  },
  {
    id: 'sav_sawtooth', tree: 'sav_aftermath', tier: 2, name: 'Sawtooth',
    desc: 'It climbs and it falls and you chose neither. Both roads out of here are about the fall.',
    type: 'passive', domain: 'mental', prereq: 'sav_ember',
    trigger: null, cooldown: 0, compose: [],
    passive: { cascadeScaleWeight: T.sawtoothWeight },
    ranks: R,
  },

  // ------------------------------------- branch A: Backdraft (spend the crest)
  {
    id: 'sav_backdraft', tree: 'sav_aftermath', tier: 4, name: 'Backdraft',
    desc: 'Backdraft is worth most at the top, which is where the chain is most likely to break. Spend it there.',
    type: 'active', domain: 'physical', prereq: 'sav_sawtooth',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.backdraftRange, count: 2 },
    cooldown: T.backdraftCd,
    compose: [{
      kind: 'cone', damage: T.backdraftDamage, arc: T.backdraftArc, range: T.backdraftRange,
      ...CASC, scaleWeight: T.backdraftWeight, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'sav_emberfall', tree: 'sav_aftermath', tier: 6, name: 'Emberfall',
    desc: 'Everything you banked is worth more on the way down than it was on the way up.',
    type: 'passive', domain: 'mental', prereq: 'sav_backdraft',
    trigger: null, cooldown: 0, compose: [],
    passive: { cascadeScaleWeight: T.emberfallWeight },
    ranks: R,
  },
  {
    id: 'sav_detonate', tree: 'sav_aftermath', tier: 8, name: 'Detonate',
    desc: 'A long fuse, so that when it comes round the chain has had time to get deep.',
    type: 'active', domain: 'physical', prereq: 'sav_emberfall',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.detonateReach },
    cooldown: T.detonateCd,
    compose: [{
      kind: 'strike', damage: T.detonateDamage, arc: T.detonateArc, reach: T.detonateReach,
      ...CASC, scaleWeight: T.detonateWeight, riders: { knockback: T.detonateKnock },
    }],
    ranks: R,
  },
  {
    id: 'sav_flashover', tree: 'sav_aftermath', tier: 10, name: 'Flashover',
    desc: 'CAPSTONE — Backdraft. Twice, at the crest, because there is not going to be a third.',
    type: 'active', domain: 'physical', prereq: 'sav_detonate',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.flashoverReach },
    cooldown: T.flashoverCd,
    compose: [{
      kind: 'strike', damage: T.flashoverDamage, arc: T.flashoverArc, reach: T.flashoverReach,
      ...CASC, scaleWeight: T.flashoverWeight, riders: { multiPulse: T.flashoverPulses },
    }],
    ranks: R,
  },

  // ------------------------------------ branch B: Bedrock (outlive the fall)
  {
    id: 'sav_bedrock', tree: 'sav_aftermath', tier: 4, name: 'Bedrock',
    desc: `Bedrock never reads the chain. ${STAT_NAME.grit} does not reset because a skill fired twice running.`,
    type: 'active', domain: 'physical', prereq: 'sav_sawtooth',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.bedrockPct },
    cooldown: T.bedrockCd,
    compose: [{ kind: 'shield', amount: T.bedrockAmount, duration: T.bedrockDuration, ...ARMOR }],
    ranks: R,
  },
  {
    id: 'sav_granite', tree: 'sav_aftermath', tier: 6, name: 'Granite',
    desc: 'Slower than the fire and still there after it.',
    type: 'passive', domain: 'physical', prereq: 'sav_bedrock',
    trigger: null, cooldown: 0, compose: [],
    passive: { armorScaleWeight: T.graniteWeight },
    ranks: R,
  },
  {
    id: 'sav_scar', tree: 'sav_aftermath', tier: 8, name: 'Scar',
    desc: 'Burned ground keeps burning whether or not you are still swinging.',
    type: 'active', domain: 'physical', prereq: 'sav_granite',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.scarRadius, count: 2 },
    cooldown: T.scarCd,
    compose: [{
      kind: 'hazard', damage: T.scarDamage, radius: T.scarRadius,
      duration: T.scarDuration, tickMs: T.scarTickMs, ...ARMOR, riders: { slow: T.scarSlow },
    }],
    ranks: R,
  },
  {
    id: 'sav_ashfield', tree: 'sav_aftermath', tier: 10, name: 'Ashfield',
    desc: 'CAPSTONE — Bedrock. Raised at the crest, still standing in the valley, and it hits back the whole way down.',
    type: 'active', domain: 'physical', prereq: 'sav_scar',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.bedrockWardPct },
    cooldown: T.bedrockWardCd,
    compose: [{
      kind: 'ward', amount: T.bedrockWardAmount, duration: T.bedrockWardDuration,
      reflectPct: T.bedrockWardReflect, ...ARMOR,
    }],
    ranks: R,
  },
];
