// ASSASSIN — Range. The third tree, and the answer to the question Killbox and
// Shadow both dodge.
//
// WHAT THE FIRST TWO LEAVE UNANSWERED. §8.3 calls Killbox "the only engine
// banked by BEING SOMEWHERE rather than by acting": traps go down inert and
// detonate when other skills fire near them. Shadow is stealth — vanish, close,
// open from a place nothing was looking at. Both trees are about ARRIVING
// FIRST: the box is set, the angle is chosen, and then the fight happens where
// you put it.
//
// Neither has anything to say about the fight that comes to you. A room that
// opens on top of the Assassin, an objective that moves, a mark escorted past
// the box — and the class has no answer at all, because both its trees spend
// their first seconds on preparation it no longer has time for. §8.2 has named
// the third tree `Range` since phase 2 and this is what it is for: output that
// does not require having been somewhere first.
//
//   LONGLINE (branch A) is reach. Every skill selects `farthest`, so the tree
//     deliberately shoots past what is already on you at what is not yet — the
//     opposite of Killbox, which pays for standing still in the middle.
//   OVERWATCH (branch B) is finishing. Every skill fires on TARGET_THRESHOLD
//     and selects `lowest_hp`, so it converts a fight already in progress into
//     kills without needing a box under it.
//
// Both still scale on `killbox`, and that is deliberate rather than lazy: a
// trap standing in a room the Assassin has left is a trap that finally does
// something, which is the reconciliation between the two halves of the class.
//
// PAIRED WITH druid_wildkin ON PURPOSE: `killbox` counts placed traps,
// `pack` counts live minions. Different primitives, different tick paths, no
// shared state — a defect in the machinery under both surfaces twice.
//
// THE SHAPE (§8.1): ten nodes, tiers 1/2/4/6/8/10, one branch at tier 2, two
// capstones, symmetric.

export const TUNING = {
  dartDamage: 10, dartRange: 300, dartSpeed: 520, dartRadius: 6, dartCd: 1100,
  steadyWeight: 0.15,

  // ---- branch A: Longline (reach — shoot past what is already on you) ----
  pinDamage: 15, pinRange: 380, pinSpeed: 560, pinRadius: 6, pinCd: 2600,
  pinRoot: 1100,
  marksmanWeight: 0.18,
  volleyDamage: 17, volleyRange: 400, volleySpeed: 540, volleyRadius: 6, volleyCount: 2, volleyCd: 4200,
  deadfallDamage: 26, deadfallRange: 430, deadfallSpeed: 600, deadfallRadius: 7, deadfallCd: 8200,
  deadfallSplash: { radius: 120, damage: 14 },

  // ---- branch B: Overwatch (finish what is already bleeding) ----
  cullDamage: 18, cullRange: 320, cullSpeed: 540, cullRadius: 6, cullPct: 55, cullCd: 2800,
  coldEyeWeight: 0.18,
  ricochetDamage: 19, ricochetRange: 340, ricochetSpeed: 520, ricochetRadius: 6,
  ricochetCount: 2, ricochetPct: 45, ricochetCd: 4400,
  headhunterDamage: 30, headhunterRange: 360, headhunterSpeed: 620, headhunterRadius: 7,
  headhunterPct: 40, headhunterCd: 8600, headhunterWeaken: { mult: 0.65, dur: 3200 },

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
const KB = { scaleWith: 'killbox'};

export const ASN_RANGE = [
  {
    id: 'asn_dart', tree: 'asn_range', tier: 1, name: 'Dart',
    flavor: 'Thrown, not placed. The first thing this tree teaches is that you do not always get to choose the ground.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.dartRange },
    cooldown: T.dartCd,
    compose: [{ kind: 'bolt', damage: T.dartDamage, range: T.dartRange, speed: T.dartSpeed, radius: T.dartRadius, ...KB, riders: {} }],
    ranks: R,
  },
  {
    id: 'asn_steady_hand', tree: 'asn_range', tier: 2, name: 'Steady Hand',
    flavor: 'Every box you left standing is worth something from here. Both roads out of this node are output without setup.',
    type: 'passive', domain: 'physical', prereq: 'asn_dart',
    trigger: null, cooldown: 0, compose: [],
    passive: { killboxScaleWeight: T.steadyWeight },
    ranks: R,
  },

  // ------------------------------------------------- branch A: Longline
  {
    id: 'asn_pin', tree: 'asn_range', tier: 4, name: 'Pin',
    flavor: 'The far one stops moving. Longline shoots past what is on you at what is not yet.',
    type: 'active', domain: 'physical', prereq: 'asn_steady_hand',
    select: 'farthest',
    trigger: { kind: 'NEAREST', range: T.pinRange },
    cooldown: T.pinCd,
    compose: [{
      kind: 'bolt', damage: T.pinDamage, range: T.pinRange, speed: T.pinSpeed, radius: T.pinRadius, ...KB,
      riders: { root: T.pinRoot },
    }],
    ranks: R,
  },
  {
    id: 'asn_marksman', tree: 'asn_range', tier: 6, name: 'Marksman',
    flavor: 'Distance stops costing you anything.',
    type: 'passive', domain: 'physical', prereq: 'asn_pin',
    trigger: null, cooldown: 0, compose: [],
    passive: { killboxScaleWeight: T.marksmanWeight },
    ranks: R,
  },
  {
    id: 'asn_volley', tree: 'asn_range', tier: 8, name: 'Volley',
    flavor: 'Two lines out at once, both of them long.',
    type: 'active', domain: 'physical', prereq: 'asn_marksman',
    select: 'farthest',
    trigger: { kind: 'NEAREST', range: T.volleyRange },
    cooldown: T.volleyCd,
    compose: [{ kind: 'bolt', damage: T.volleyDamage, range: T.volleyRange, speed: T.volleySpeed, radius: T.volleyRadius, count: T.volleyCount, ...KB, riders: {} }],
    ranks: R,
  },
  {
    id: 'asn_deadfall', tree: 'asn_range', tier: 10, name: 'Deadfall',
    flavor: 'CAPSTONE — Longline. It lands where you were never standing, and takes the ground with it.',
    type: 'active', domain: 'physical', prereq: 'asn_volley',
    select: 'farthest',
    trigger: { kind: 'NEAREST', range: T.deadfallRange },
    cooldown: T.deadfallCd,
    compose: [{
      kind: 'bolt', damage: T.deadfallDamage, range: T.deadfallRange, speed: T.deadfallSpeed, radius: T.deadfallRadius, ...KB,
      riders: { splash: T.deadfallSplash },
    }],
    ranks: R,
  },

  // ------------------------------------------------ branch B: Overwatch
  {
    id: 'asn_cull', tree: 'asn_range', tier: 4, name: 'Cull',
    flavor: 'The one already bleeding. Overwatch converts a fight in progress without needing a box under it.',
    type: 'active', domain: 'physical', prereq: 'asn_steady_hand',
    select: 'lowest_hp',
    trigger: { kind: 'TARGET_THRESHOLD', pct: T.cullPct, range: T.cullRange },
    cooldown: T.cullCd,
    compose: [{ kind: 'bolt', damage: T.cullDamage, range: T.cullRange, speed: T.cullSpeed, radius: T.cullRadius, ...KB, riders: {} }],
    ranks: R,
  },
  {
    id: 'asn_cold_eye', tree: 'asn_range', tier: 6, name: 'Cold Eye',
    flavor: 'You stopped counting the ones that are going to die anyway.',
    type: 'passive', domain: 'physical', prereq: 'asn_cull',
    trigger: null, cooldown: 0, compose: [],
    passive: { killboxScaleWeight: T.coldEyeWeight },
    ranks: R,
  },
  {
    id: 'asn_ricochet', tree: 'asn_range', tier: 8, name: 'Ricochet',
    flavor: 'It finds the second one on its own.',
    type: 'active', domain: 'physical', prereq: 'asn_cold_eye',
    select: 'lowest_hp',
    trigger: { kind: 'TARGET_THRESHOLD', pct: T.ricochetPct, range: T.ricochetRange },
    cooldown: T.ricochetCd,
    compose: [{ kind: 'bolt', damage: T.ricochetDamage, range: T.ricochetRange, speed: T.ricochetSpeed, radius: T.ricochetRadius, count: T.ricochetCount, ...KB, riders: {} }],
    ranks: R,
  },
  {
    id: 'asn_headhunter', tree: 'asn_range', tier: 10, name: 'Headhunter',
    flavor: 'CAPSTONE — Overwatch. The thing the level is about, at whatever range it thought was safe.',
    type: 'active', domain: 'physical', prereq: 'asn_ricochet',
    select: 'objective_target',
    trigger: { kind: 'TARGET_THRESHOLD', pct: T.headhunterPct, range: T.headhunterRange },
    cooldown: T.headhunterCd,
    compose: [{
      kind: 'bolt', damage: T.headhunterDamage, range: T.headhunterRange, speed: T.headhunterSpeed, radius: T.headhunterRadius, ...KB,
      riders: { weakenDefense: T.headhunterWeaken },
    }],
    ranks: R,
  },
];
