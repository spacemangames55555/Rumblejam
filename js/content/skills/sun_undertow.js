// SUNDIAN — Undertow. The third tree, and the answer to a cost the engine's own
// shape hides.
//
// WHAT THE FIRST TWO LEAVE UNANSWERED. Tidewrack's header states the mechanic
// exactly: "`drench` puts stacks on; `sluice` takes them off and turns them into
// damage. A counter with no payout is a number and a payout with no counter is a
// multiplier." Reef is the flat half, ground control and sustain.
//
// Both are written for a target that lives. The loop has three beats — soak,
// hold, cash — and it only pays if the same body is still standing at the end of
// it. Against chaff that is not what happens: the thing dies to the soak, or to
// somebody else, or to a hazard it walked into, and **the stacks die with it**.
// `sluice` reads `e.drench` off one enemy; a corpse carries nothing. So the
// Sundian's engine is at its weakest in exactly the fight it meets most often,
// and the tell is in the write path — `drenchT` expires and `drenchBy` resets on
// a new owner, but nothing anywhere banks a stack that never got spent.
//
// This is not a tuning problem. A bigger `per` on the sluice pays MORE for the
// long fight and still pays nothing for the short one; the loop is too long for
// the room, and the fix has to shorten the loop rather than fatten its end.
//
// Undertow shortens it from both directions:
//
//   UNDERTOW (branch A) is paid at APPLICATION. Its steps carry damage and
//     `drench` together and nothing in the branch sluices — a stack that never
//     gets cashed has still bought something, because the soaking itself was
//     the payout. This is the answer for the enemy that will not live long
//     enough to be worth waiting on.
//   RIPTIDE (branch B) cashes IMMEDIATELY, at small size. Every node soaks and
//     sluices in the same step, so the whole three-beat loop completes inside a
//     single cast — a fraction of what Tidewrack's patient version pays, but it
//     pays on a body with two seconds left. Tidewrack banks; this collects.
//
// The class keeps its identity either way: both branches still read
// `p.engines.drench`, so a Sundian who has soaked the room is better at both.
// What changes is that neither branch needs the room to cooperate.
//
// PAIRED WITH priest_reckoning ON PURPOSE: `drench` is a room-wide SUM of a
// per-enemy integer with its own expiry and an owner check; `marks` is a COUNT
// of enemies carrying a flag. Different fields, different write paths — a
// defect under both surfaces twice rather than once.
//
// THE SHAPE (§8.1): ten nodes, tiers 1/2/4/6/8/10, one branch at tier 2, two
// capstones, symmetric.

export const TUNING = {
  scudDamage: 12, scudRange: 245, scudSpeed: 440, scudRadius: 7, scudCd: 1150,
  scudDrench: { stacks: 2, cap: 12, dur: 9000 },
  shallowsWeight: 0.15,

  // ---- branch A: Undertow (paid at application; nothing here sluices) ----
  // NOT ONE `sluice` IN THIS BRANCH, and that is the branch rather than an
  // omission. The damage is on the same step as the soak, so the payout has
  // already happened by the time the target dies — which against chaff is
  // immediately.
  dragDamage: 18, dragReach: 120, dragArc: 1.9, dragCd: 2400,
  dragDrench: { stacks: 3, cap: 12, dur: 9000 },
  sluicewayWeight: 0.18,
  sweepDamage: 22, sweepArc: 1.7, sweepRange: 285, sweepCd: 4200,
  sweepDrench: { stacks: 3, cap: 12, dur: 9000 },
  seawallDamage: 30, seawallArc: 2.8, seawallRange: 310, seawallCd: 7400,
  seawallDrench: { stacks: 4, cap: 12, dur: 9000 },
  seawallSlow: { mult: 0.6, dur: 2600 },

  // ---- branch B: Riptide (soak and cash in one cast) ----
  // EVERY NODE CARRIES BOTH RIDERS. `applyImpactRiders` runs `drench` before
  // `sluice` in one pass, so a step declaring both soaks and then immediately
  // spends what it just put on plus whatever was already there — a small,
  // certain payout instead of a large, conditional one.
  undertowDamage: 16, undertowReach: 116, undertowArc: 1.8, undertowCd: 2300,
  undertowDrench: { stacks: 3, cap: 12, dur: 9000 },
  undertowSluice: { per: 3, radius: 26 },
  ebbWeight: 0.18,
  raceDamage: 20, raceRange: 265, raceSpeed: 460, raceRadius: 7, raceCd: 4100,
  raceDrench: { stacks: 3, cap: 12, dur: 9000 },
  raceSluice: { per: 4, radius: 30 },
  maelstromDamage: 27, maelstromReach: 142, maelstromArc: 2.7, maelstromCd: 7200,
  maelstromDrench: { stacks: 4, cap: 12, dur: 9000 },
  maelstromSluice: { per: 6, radius: 42 }, maelstromPulses: 2,

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
const DRENCH = { scaleWith: 'drench' };

export const SUN_UNDERTOW = [
  {
    id: 'sun_scud', tree: 'sun_undertow', tier: 1, name: 'Scud',
    flavor: 'Wets what it hits and does not wait to find out whether that mattered.',
    type: 'active', domain: 'spiritual', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.scudRange },
    cooldown: T.scudCd,
    compose: [{
      kind: 'bolt', damage: T.scudDamage, range: T.scudRange, speed: T.scudSpeed,
      radius: T.scudRadius, ...DRENCH, riders: { drench: T.scudDrench },
    }],
    ranks: R,
  },
  {
    id: 'sun_shallows', tree: 'sun_undertow', tier: 2, name: 'Shallows',
    flavor: 'Not everything is worth drowning slowly. Both roads out of here are about the fight that ends first.',
    type: 'passive', domain: 'spiritual', prereq: 'sun_scud',
    trigger: null, cooldown: 0, compose: [],
    passive: { drenchScaleWeight: T.shallowsWeight },
    ranks: R,
  },

  // ------------------------------ branch A: Undertow (the soak IS the payout)
  {
    id: 'sun_drag', tree: 'sun_undertow', tier: 4, name: 'Drag',
    flavor: 'Undertow never cashes. The damage rides the soak, so a stack that dies with its body still bought something.',
    type: 'active', domain: 'physical', prereq: 'sun_shallows',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.dragReach },
    cooldown: T.dragCd,
    compose: [{
      kind: 'strike', damage: T.dragDamage, arc: T.dragArc, reach: T.dragReach,
      ...DRENCH, riders: { drench: T.dragDrench },
    }],
    ranks: R,
  },
  {
    id: 'sun_sluiceway', tree: 'sun_undertow', tier: 6, name: 'Sluiceway',
    flavor: 'Water does work on the way past. It does not have to arrive anywhere.',
    type: 'passive', domain: 'spiritual', prereq: 'sun_drag',
    trigger: null, cooldown: 0, compose: [],
    passive: { drenchScaleWeight: T.sluicewayWeight },
    ranks: R,
  },
  {
    id: 'sun_sweep', tree: 'sun_undertow', tier: 8, name: 'Sweep',
    flavor: 'Wets the whole line at once, because the line will not be there long.',
    type: 'active', domain: 'spiritual', prereq: 'sun_sluiceway',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.sweepRange, count: 2 },
    cooldown: T.sweepCd,
    compose: [{
      kind: 'cone', damage: T.sweepDamage, arc: T.sweepArc, range: T.sweepRange,
      ...DRENCH, riders: { drench: T.sweepDrench },
    }],
    ranks: R,
  },
  {
    id: 'sun_seawall', tree: 'sun_undertow', tier: 10, name: 'Seawall',
    flavor: 'CAPSTONE — Undertow. Everything in front of you is wet and slow, and none of it was ever going to be cashed.',
    type: 'active', domain: 'spiritual', prereq: 'sun_sweep',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.seawallRange, count: 3 },
    cooldown: T.seawallCd,
    compose: [{
      kind: 'cone', damage: T.seawallDamage, arc: T.seawallArc, range: T.seawallRange, ...DRENCH,
      riders: { drench: T.seawallDrench, slow: T.seawallSlow },
    }],
    ranks: R,
  },

  // -------------------------- branch B: Riptide (soak and cash in one breath)
  {
    id: 'sun_undertow_cut', tree: 'sun_undertow', tier: 4, name: 'Riptide',
    flavor: 'Riptide completes the whole loop in one cast — soak and spend together. Small, certain, and it fits inside two seconds of life.',
    type: 'active', domain: 'physical', prereq: 'sun_shallows',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.undertowReach },
    cooldown: T.undertowCd,
    compose: [{
      kind: 'strike', damage: T.undertowDamage, arc: T.undertowArc, reach: T.undertowReach, ...DRENCH,
      riders: { drench: T.undertowDrench, sluice: T.undertowSluice },
    }],
    ranks: R,
  },
  {
    id: 'sun_ebb', tree: 'sun_undertow', tier: 6, name: 'Ebb',
    flavor: 'What goes out was never being saved.',
    type: 'passive', domain: 'spiritual', prereq: 'sun_undertow_cut',
    trigger: null, cooldown: 0, compose: [],
    passive: { drenchScaleWeight: T.ebbWeight },
    ranks: R,
  },
  {
    id: 'sun_race', tree: 'sun_undertow', tier: 8, name: 'Race',
    flavor: 'Arrives wet and leaves dry, in that order, at range.',
    type: 'active', domain: 'spiritual', prereq: 'sun_ebb',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.raceRange },
    cooldown: T.raceCd,
    compose: [{
      kind: 'bolt', damage: T.raceDamage, range: T.raceRange, speed: T.raceSpeed,
      radius: T.raceRadius, ...DRENCH, riders: { drench: T.raceDrench, sluice: T.raceSluice },
    }],
    ranks: R,
  },
  {
    id: 'sun_maelstrom', tree: 'sun_undertow', tier: 10, name: 'Maelstrom',
    flavor: 'CAPSTONE — Riptide. Twice, and it spends both times, because there is no second chance to.',
    type: 'active', domain: 'physical', prereq: 'sun_race',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.maelstromReach },
    cooldown: T.maelstromCd,
    compose: [{
      kind: 'strike', damage: T.maelstromDamage, arc: T.maelstromArc, reach: T.maelstromReach, ...DRENCH,
      riders: { multiPulse: T.maelstromPulses, drench: T.maelstromDrench, sluice: T.maelstromSluice },
    }],
    ranks: R,
  },
];
