// BARD — Cadence tree.
//
// THE CLASS ENGINE, EXPRESSED AS CONTENT. §8.3 gives the Bard "rhythm —
// attacking without a gap builds stacks; missing the window drops every one of
// them at once", and both halves of that were already live before this file
// existed: `tohOnFire` builds the stack on every cast, `tohTick` wipes the whole
// stack the moment the window lapses. Nothing here is engine code. The resource
// is `p.engines.rhythm`, published in one line.
//
// WHAT MAKES THIS ENGINE DIFFERENT, AND WHAT THIS TREE IS AUTHORED AGAINST.
// Rhythm is the only engine in the game with a LOSS CONDITION. Footing is
// defended, the pack dies, marks are paid out, shifts are banked until the door
// — none of those can be simply DROPPED by playing badly. Rhythm can, and it
// goes all at once.
//
// So a Bard is not choosing when to cash a resource in. It is choosing whether
// to keep the chain alive at all, and EVERY COOLDOWN IN THE BUILD IS A THREAT TO
// IT. That is why this tree's cooldowns are the shortest in the game and get
// shorter as it deepens: Cadence is what a Bard uses to fill its own gaps, and
// the deeper it goes the more reliably it can. The payoff is that the same
// stacks that keep the chain alive are what this tree's later skills read.
//
// The tension with Ensemble is therefore real and per-cast rather than
// per-build: Ensemble's nodes are worth more when they land and cost more time
// to land, so every point spent there is a point that makes the chain harder to
// hold. §4.2 wants depth-versus-breadth to stay a live decision, and on this
// class the decision is measured in seconds.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Opening Note. THE METRONOME: still the shortest cooldown in the
  // game, and single-target and cheap BECAUSE it is. A node that comes up this
  // often cannot also hit the room.
  openDamage: 4, openSpeed: 520, openRange: 250, openCd: 900,
  // tier 2 — Quickstep
  quickDamage: 4, quickReach: 104, quickArc: 1.8, quickRadius: 130,
  quickCount: 1, quickCd: 2000, quickWeight: 0.88,
  // tier 3 — Counterpoint
  counterDamage: 5, counterSpeed: 540, counterRange: 255, counterCd: 3600,
  counterWeight: 0.95, counterTargets: 2,
  // tier 4 — Syncopation
  syncDamage: 6, syncAngle: 1.6, syncRange: 215, syncRadius: 175,
  syncCount: 3, syncCd: 5200, syncSlowMult: 0.76, syncSlowDur: 1200,
  // tier 5 — Perfect Time (passive)
  perfectWeight: 0.375,
  // tier 6 — Drum Line
  drumDamage: 6, drumReach: 112, drumArc: 2.1, drumRadius: 145,
  drumCount: 2, drumCd: 4400, drumKnock: 190,
  // tier 7 — Running Sixteenths
  sixteenDamage: 4, sixteenSpeed: 560, sixteenRange: 260, sixteenTargets: 3,
  sixteenCd: 3200,
  // tier 8 — Hemiola
  hemiolaDamage: 5, hemiolaWidth: 32, hemiolaLength: 340, hemiolaRadius: 200,
  hemiolaCount: 2, hemiolaCd: 5600, hemiolaWeight: 1.05, hemiolaPulses: 2,
  // tier 9 — Stretto
  strettoDamage: 7, strettoAngle: 2.3, strettoRange: 230, strettoRadius: 190,
  strettoCount: 4, strettoCd: 6200, strettoWeight: 1.13,
  strettoWeakenMult: 0.8, strettoWeakenDur: 2200,
  // tier 10 — The Last Bar
  lastDamage: 9, lastAngle: 2.8, lastRange: 250, lastRadius: 210,
  lastCount: 4, lastCd: 9000, lastWeight: 1.25, lastStun: 600,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const BARD_CADENCE = [
  {
    // The shortest cooldown in the game, and that is the point. A Bard's opener
    // is not a damage skill, it is a METRONOME — the thing that keeps the window
    // from lapsing while everything else is recovering.
    id: 'bard_opening_note', tree: 'bard_cadence', tier: 1, name: 'Opening Note',
    flavor: 'A struck note at the nearest thing.',
    type: 'active', domain: 'spiritual', prereq: null,
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.openRange },
    cooldown: T.openCd,
    compose: [{ kind: 'bolt', damage: T.openDamage, speed: T.openSpeed, range: T.openRange, riders: {} }],
    ranks: R,
  },
  {
    // THE ENGINE, TIER 2 — same placement as the Wizard's shift and the Priest's
    // mark, for the same reason. A class should not spend a third of a run being
    // a worse version of another one.
    id: 'bard_quickstep', tree: 'bard_cadence', tier: 2, name: 'Quickstep',
    flavor: 'A close flourish that sharpens with the beat.',
    type: 'active', domain: 'physical', prereq: 'bard_opening_note',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.quickRadius, count: T.quickCount },
    cooldown: T.quickCd,
    compose: [{
      kind: 'strike', damage: T.quickDamage, reach: T.quickReach, arc: T.quickArc,
      scaleWith: 'rhythm', scaleWeight: T.quickWeight, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'bard_counterpoint', tree: 'bard_cadence', tier: 3, name: 'Counterpoint',
    flavor: 'Two answering notes at once.',
    type: 'active', domain: 'mental', prereq: 'bard_quickstep',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.counterRange },
    cooldown: T.counterCd,
    compose: [{
      kind: 'bolt', damage: T.counterDamage, speed: T.counterSpeed, range: T.counterRange,
      count: T.counterTargets, scaleWith: 'rhythm', scaleWeight: T.counterWeight, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'bard_syncopation', tree: 'bard_cadence', tier: 4, name: 'Syncopation',
    flavor: 'An off-beat sweep.',
    type: 'active', domain: 'mental', prereq: 'bard_counterpoint',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.syncRadius, count: T.syncCount },
    cooldown: T.syncCd,
    compose: [{
      kind: 'cone', damage: T.syncDamage, angle: T.syncAngle, range: T.syncRange,
      scaleWith: 'rhythm',
      riders: { slow: { mult: T.syncSlowMult, dur: T.syncSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'bard_perfect_time', tree: 'bard_cadence', tier: 5, name: 'Perfect Time',
    type: 'passive', domain: 'mental', prereq: 'bard_syncopation',
    trigger: null, cooldown: 0, compose: [],
    passive: { rhythmScaleWeight: T.perfectWeight },
    // Classified 'damage' in PASSIVE_EFFECT, so it is an INVESTMENT and ranks —
    // the same shape as Held Edge on Footing, Sympathetic Resonance on shift and
    // Attend the Fallen on marks.
    ranks: { damage: T.rankDamage },
  },
  {
    id: 'bard_drum_line', tree: 'bard_cadence', tier: 6, name: 'Drum Line',
    flavor: 'A wide beat that shoves the front rank back.',
    type: 'active', domain: 'physical', prereq: 'bard_perfect_time',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.drumRadius, count: T.drumCount },
    cooldown: T.drumCd,
    compose: [{
      kind: 'strike', damage: T.drumDamage, reach: T.drumReach, arc: T.drumArc,
      scaleWith: 'rhythm',
      riders: { knockback: T.drumKnock },
    }],
    ranks: R,
  },
  {
    // Deliberately low damage on a short cooldown into three targets. This is
    // the tree's second metronome, and it exists because by tier 7 the build's
    // other skills are long enough that the opener alone can no longer hold the
    // chain through them.
    id: 'bard_running_sixteenths', tree: 'bard_cadence', tier: 7, name: 'Running Sixteenths',
    flavor: 'Three quick notes, one after another.',
    type: 'active', domain: 'spiritual', prereq: 'bard_drum_line',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.sixteenRange },
    cooldown: T.sixteenCd,
    compose: [{
      kind: 'bolt', damage: T.sixteenDamage, speed: T.sixteenSpeed, range: T.sixteenRange,
      count: T.sixteenTargets, scaleWith: 'rhythm', riders: {},
    }],
    ranks: R,
  },
  {
    id: 'bard_hemiola', tree: 'bard_cadence', tier: 8, name: 'Hemiola',
    flavor: 'Two beats laid across three, down a line.',
    type: 'active', domain: 'mental', prereq: 'bard_running_sixteenths',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.hemiolaRadius, count: T.hemiolaCount },
    cooldown: T.hemiolaCd,
    compose: [{
      kind: 'line', damage: T.hemiolaDamage, width: T.hemiolaWidth, length: T.hemiolaLength,
      scaleWith: 'rhythm', scaleWeight: T.hemiolaWeight,
      riders: { multiPulse: T.hemiolaPulses },
    }],
    ranks: R,
  },
  {
    id: 'bard_stretto', tree: 'bard_cadence', tier: 9, name: 'Stretto',
    flavor: 'The theme piled on itself.',
    type: 'active', domain: 'spiritual', prereq: 'bard_hemiola',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.strettoRadius, count: T.strettoCount },
    cooldown: T.strettoCd,
    compose: [{
      kind: 'cone', damage: T.strettoDamage, angle: T.strettoAngle, range: T.strettoRange,
      scaleWith: 'rhythm', scaleWeight: T.strettoWeight,
      riders: { weakenDamage: { mult: T.strettoWeakenMult, dur: T.strettoWeakenDur } },
    }],
    ranks: R,
  },
  {
    // The capstone is the tree's LONGEST cooldown by a wide margin, and that is
    // the tension the class is built on: the biggest thing a Bard can do is also
    // the biggest hole in its own chain. Play it on a full stack and it hits for
    // nearly double; play it too early and the window lapses while it recovers.
    id: 'bard_last_bar', tree: 'bard_cadence', tier: 10, name: 'The Last Bar',
    flavor: 'Everything resolves at once.',
    type: 'active', domain: 'spiritual', prereq: 'bard_stretto',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.lastRadius, count: T.lastCount },
    cooldown: T.lastCd,
    compose: [{
      kind: 'cone', damage: T.lastDamage, angle: T.lastAngle, range: T.lastRange,
      scaleWith: 'rhythm', scaleWeight: T.lastWeight,
      riders: { stun: T.lastStun },
    }],
    ranks: R,
  },
];
