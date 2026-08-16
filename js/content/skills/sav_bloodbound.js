import { STAT_NAME } from '../../config.js';
// SAVAGE — Bloodbound tree.
//
// The other half, and — like Arcana, Grace, Ensemble, Collapse, Blight, Reef,
// Shadow, Houndmaster and Stone Garden — deliberately the half that does NOT
// read the engine. Nothing here carries `scaleWith: 'cascade'`.
//
// BUT IT IS NOT INDEPENDENT OF IT, AND THAT IS THIS TREE'S WHOLE POINT. Cascade
// is advanced by VARIETY: a fire by a skill other than the one before it. So
// every node here is a skill the Savage can put in a slot to have something
// different ready — the tree pays in flat numbers, and it pays a second time by
// being *another trigger shape*. A Savage running Primal Fury alone has ten
// skills and eight slots; a Savage splitting the trees has more situations
// covered and a chain that breaks less often.
//
// That makes the §4.2 decision on this class unusually concrete. Depth in Primal
// Fury buys bigger per-rank multipliers on the skills that read the engine.
// Breadth into Bloodbound buys a chain that survives more of the fight. Neither
// dominates, and the measurement that settles it for a given player is how much
// of their own fire stream is the same skill twice running.
//
// THE TRAIT SITS ON THIS SIDE TOO. Blood Dance grants +8% Ferocity per connecting
// hit up to +120%, falling off 3s after the last one — it counts HITS where
// cascade counts VARIETY, so the two stack without being the same mechanic. A
// Savage spamming one fast skill maxes Blood Dance and holds zero cascade, which
// is precisely the build this tree exists to argue against.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Headbutt
  headDamage: 3, headReach: 88, headArc: 1.3, headRadius: 116, headCount: 1, headCd: 1150,
  // tier 2 — Bleed Them
  bleedDamage: 4, bleedRange: 215, bleedTick: 4, bleedDuration: 3600, bleedCd: 2400,
  // tier 3 — Thick Hide
  hideAmount: 20, hideDuration: 4600, hideCd: 5600,
  // tier 4 — Scent of It
  scentDamage: 5, scentRange: 245, scentSpeed: 520, scentCd: 2300,
  // tier 5 — Old Scars (passive)
  scarsGrit: 6,
  // tier 6 — Drag Down
  dragDamage: 5, dragReach: 100, dragArc: 1.6, dragRadius: 140,
  dragCount: 2, dragCd: 3100, dragSlowMult: 0.7, dragSlowDur: 1500,
  // tier 7 — Answer It
  answerDamage: 6, answerAngle: 1.9, answerRange: 195, answerCd: 3500, answerTaunt: 1400,
  // tier 8 — Blood Price
  priceDamage: 6, priceRange: 220, priceHealPct: 0.55, priceCd: 3900,
  // tier 9 — Won't Go Down
  downAmount: 30, downDuration: 5200, downReflect: 0.3, downCd: 8200,
  // tier 10 — Everything At Once
  allDamage: 8, allReach: 128, allArc: 2.4, allRadius: 176,
  allCount: 3, allCd: 8800, allKnock: 220,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const SAV_BLOODBOUND = [
  {
    id: 'sav_headbutt', tree: 'sav_bloodbound', tier: 1, name: 'Headbutt',
    desc: 'Short, close and immediate. Deals 3 damage in a narrow arc.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.headRadius, count: T.headCount },
    cooldown: T.headCd,
    compose: [{ kind: 'strike', damage: T.headDamage, reach: T.headReach, arc: T.headArc, riders: {} }],
    ranks: R,
  },
  {
    id: 'sav_bleed_them', tree: 'sav_bloodbound', tier: 2, name: 'Bleed Them',
    desc: 'Opens something up and lets it run for 3.6s. Deals 4 up front.',
    type: 'active', domain: 'physical', prereq: 'sav_headbutt',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.bleedRange },
    cooldown: T.bleedCd,
    compose: [{
      kind: 'plague', damage: T.bleedDamage, range: T.bleedRange,
      tick: T.bleedTick, duration: T.bleedDuration,
    }],
    ranks: R,
  },
  {
    id: 'sav_thick_hide', tree: 'sav_bloodbound', tier: 3, name: 'Thick Hide',
    desc: 'Absorbs 20 over 4.6s.',
    type: 'active', domain: 'spiritual', prereq: 'sav_bleed_them',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 65 },
    cooldown: T.hideCd,
    compose: [{ kind: 'ward', amount: T.hideAmount, duration: T.hideDuration }],
    ranks: R,
  },
  {
    // The one ranged node the class has, and it exists for the chain rather than
    // for the range: a Savage in a doorway with nothing in arc still has
    // something other than the last thing to fire.
    id: 'sav_scent_of_it', tree: 'sav_bloodbound', tier: 4, name: 'Scent of It',
    desc: 'Thrown, for whatever is running. Deals 5 damage.',
    type: 'active', domain: 'physical', prereq: 'sav_thick_hide',
    select: 'lowest_hp',
    trigger: { kind: 'NEAREST', range: T.scentRange },
    cooldown: T.scentCd,
    compose: [{ kind: 'bolt', damage: T.scentDamage, speed: T.scentSpeed, range: T.scentRange, riders: {} }],
    ranks: R,
  },
  {
    // maxRank: 1, because `armorGrit` is classified 'other' in PASSIVE_EFFECT —
    // an unlock rather than an investment. The registry refused this at load
    // when it was written rankable, which is the registry doing its job: a
    // second point in a flat stat grant buys the same flat grant again and
    // reads as depth that is not there.
    id: 'sav_old_scars', tree: 'sav_bloodbound', tier: 5, name: 'Old Scars',
    desc: `Everything that has hit you made you harder to hit. +6 ${STAT_NAME.grit}.`,
    type: 'passive', domain: 'spiritual', prereq: 'sav_scent_of_it',
    passive: { armorGrit: T.scarsGrit },
    maxRank: 1,
  },
  {
    id: 'sav_drag_down', tree: 'sav_bloodbound', tier: 6, name: 'Drag Down',
    desc: 'Takes the legs out. 5 damage, and what it touches crawls at 70% for 1.5s.',
    type: 'active', domain: 'physical', prereq: 'sav_old_scars',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.dragRadius, count: T.dragCount },
    cooldown: T.dragCd,
    compose: [{
      kind: 'strike', damage: T.dragDamage, reach: T.dragReach, arc: T.dragArc,
      riders: { slow: { mult: T.dragSlowMult, dur: T.dragSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'sav_answer_it', tree: 'sav_bloodbound', tier: 7, name: 'Answer It',
    desc: 'Fires the moment something lands on you, and pulls the rest onto you for 1.4s. Deals 6 damage.',
    type: 'active', domain: 'spiritual', prereq: 'sav_drag_down',
    select: 'densest_cluster',
    trigger: { kind: 'ON_HIT_TAKEN' },
    cooldown: T.answerCd,
    compose: [{
      kind: 'cone', damage: T.answerDamage, angle: T.answerAngle, range: T.answerRange,
      riders: { taunt: T.answerTaunt },
    }],
    ranks: R,
  },
  {
    id: 'sav_blood_price', tree: 'sav_bloodbound', tier: 8, name: 'Blood Price',
    desc: 'Deals 6 damage and takes 55% of it back as health.',
    type: 'active', domain: 'physical', prereq: 'sav_answer_it',
    select: 'nearest',
    trigger: { kind: 'SELF_THRESHOLD', pct: 55 },
    cooldown: T.priceCd,
    compose: [{ kind: 'drain', damage: T.priceDamage, range: T.priceRange, healPct: T.priceHealPct }],
    ranks: R,
  },
  {
    id: 'sav_wont_go_down', tree: 'sav_bloodbound', tier: 9, name: "Won't Go Down",
    desc: 'Absorbs 30 over 5.2s and returns 30% of what it stops.',
    type: 'active', domain: 'spiritual', prereq: 'sav_blood_price',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 35 },
    cooldown: T.downCd,
    compose: [{
      kind: 'ward', amount: T.downAmount, duration: T.downDuration, reflectPct: T.downReflect,
    }],
    ranks: R,
  },
  {
    id: 'sav_everything_at_once', tree: 'sav_bloodbound', tier: 10, name: 'Everything At Once',
    desc: 'No technique left in it at all. 8 damage in a huge arc, and everything goes backwards.',
    type: 'active', domain: 'physical', prereq: 'sav_wont_go_down',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.allRadius, count: T.allCount },
    cooldown: T.allCd,
    compose: [{
      kind: 'strike', damage: T.allDamage, reach: T.allReach, arc: T.allArc,
      riders: { knockback: T.allKnock },
    }],
    ranks: R,
  },
];
