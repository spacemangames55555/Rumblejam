// SAMURAI — Tactics tree. The offensive half of the Footing engine.
//
// Armor was the defensive payoff for holding ground; Tactics is where holding
// ground converts into output. EVERY damaging skill here carries
// `scaleWith: 'footing'`, which is the point: the param arrived in phase 1 on a
// single shield, and ten skills across a second primitive is the real test of
// whether it generalises or whether it was a Samurai special case wearing a
// generic name.
//
// It reads p.engines.footing through compose.js's engineScale(), which knows
// nothing about the Samurai — every remaining class engine exposes its state
// the same way and inherits this without a line of code.

export const TUNING = {
  // per-stack damage multiplier for a scaleWith step, before Held Edge
  perFooting: 0.06,
  perFootingHeavy: 0.09,        // the slower, committed swings pay more for the stance
  // tier 1 — Draw Cut
  drawDamage: 8, drawReach: 95, drawArc: 1.5, drawCd: 850,
  // tier 2 — Measured Breath (passive)
  breathAccrualPct: 0.25,
  // tier 3 — Rising Cut
  risingDamage: 15, risingReach: 100, risingArc: 1.3, risingCd: 3200, risingWindUp: 400,
  // tier 4 — Two Heavens
  twinDamage: 7, twinReach: 100, twinArc: 1.8, twinRadius: 100, twinCount: 2,
  twinPulses: 2, twinCd: 3600,
  // tier 5 — Read the Line
  readDamage: 12, readReach: 105, readArc: 1.9, readWindow: 400, readCd: 4000,
  readDefMult: 0.75, readDefDur: 2500,
  // tier 6 — Held Edge (passive)
  heldEdgePerStack: 0.015,
  // tier 7 — Severing Arc
  severDamage: 9, severReach: 125, severArc: 2.9, severRadius: 120, severCount: 3, severCd: 5000,
  // tier 8 — Mountain Stance
  mountainAmount: 22, mountainDuration: 5000, mountainSeconds: 4, mountainCd: 9000,
  mountainPerFooting: 0.14,
  // tier 9 — Killing Ground
  killDamage: 13, killReach: 100, killArc: 1.2, killPct: 35, killPulses: 2, killCd: 5200,
  // tier 10 — Unsheathed
  unsheathedDamage: 14, unsheathedReach: 130, unsheathedArc: 3.0, unsheathedRadius: 130,
  unsheathedCount: 4, unsheathedPulses: 2, unsheathedStun: 700, unsheathedCd: 10000,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
const FOOT = { scaleWith: 'footing', scalePer: T.perFooting };
const FOOT_HEAVY = { scaleWith: 'footing', scalePer: T.perFootingHeavy };

export const SAMURAI_TACTICS = [
  {
    id: 'sam_draw_cut', tree: 'samurai_tactics', tier: 1, name: 'Draw Cut',
    desc: 'The cut that comes out of the stance. It is worth more the longer you have held it.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'objective_target',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'NEAREST', range: T.drawReach },
    cooldown: T.drawCd,
    compose: [{ kind: 'strike', damage: T.drawDamage, arc: T.drawArc, reach: T.drawReach, ...FOOT, riders: {} }],
    ranks: R,
  },
  {
    id: 'sam_measured_breath', tree: 'samurai_tactics', tier: 2, name: 'Measured Breath',
    desc: 'You settle into the ground faster than you used to.',
    type: 'passive', domain: 'mental', prereq: 'sam_draw_cut',
    trigger: null, cooldown: 0, compose: [],
    passive: { footingAccrualPct: T.breathAccrualPct },
    // §1.3: grants no damage and no duration, so a second point buys nothing.
    maxRank: 1,
    ranks: R,
  },
  {
    id: 'sam_rising_cut', tree: 'samurai_tactics', tier: 3, name: 'Rising Cut',
    desc: 'Slower, heavier, and it asks you to still be standing when it lands.',
    type: 'active', domain: 'physical', prereq: 'sam_measured_breath',
    select: 'highest_hp',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'NEAREST', range: T.risingReach },
    cooldown: T.risingCd,
    compose: [{
      kind: 'strike', damage: T.risingDamage, arc: T.risingArc, reach: T.risingReach,
      ...FOOT_HEAVY, riders: { windUp: T.risingWindUp },
    }],
    ranks: R,
  },
  {
    id: 'sam_two_heavens', tree: 'samurai_tactics', tier: 4, name: 'Two Heavens',
    desc: 'Both blades, one motion.',
    type: 'active', domain: 'physical', prereq: 'sam_rising_cut',
    select: 'densest_cluster',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'PROXIMITY', radius: T.twinRadius, count: T.twinCount },
    cooldown: T.twinCd,
    compose: [{
      kind: 'strike', damage: T.twinDamage, arc: T.twinArc, reach: T.twinReach,
      ...FOOT, riders: { multiPulse: T.twinPulses },
    }],
    ranks: R,
  },
  {
    id: 'sam_read_the_line', tree: 'samurai_tactics', tier: 5, name: 'Read the Line',
    desc: 'You saw where it was going. Now it cannot guard.',
    type: 'active', domain: 'mental', prereq: 'sam_two_heavens',
    select: 'nearest',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'ON_DODGE', window: T.readWindow },
    cooldown: T.readCd,
    compose: [{
      kind: 'strike', damage: T.readDamage, arc: T.readArc, reach: T.readReach,
      // deliberately NOT scaleWith: this is the dodge payoff, and a dodge means
      // the stance is already gone. Scaling it off Footing would make it read
      // as zero exactly when it fires.
      riders: { weakenDefense: { mult: T.readDefMult, dur: T.readDefDur } },
    }],
    ranks: R,
  },
  {
    id: 'sam_held_edge', tree: 'samurai_tactics', tier: 6, name: 'Held Edge',
    desc: 'Every stack of footing is worth more edge than it was.',
    type: 'passive', domain: 'physical', prereq: 'sam_read_the_line',
    trigger: null, cooldown: 0, compose: [],
    passive: { footingDamageBonus: T.heldEdgePerStack },
    ranks: R,
  },
  {
    id: 'sam_severing_arc', tree: 'samurai_tactics', tier: 7, name: 'Severing Arc',
    desc: 'A long sweep that answers a crowd without giving up the ground.',
    type: 'active', domain: 'physical', prereq: 'sam_held_edge',
    select: 'densest_cluster',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'PROXIMITY', radius: T.severRadius, count: T.severCount },
    cooldown: T.severCd,
    compose: [{ kind: 'strike', damage: T.severDamage, arc: T.severArc, reach: T.severReach, ...FOOT, riders: {} }],
    ranks: R,
  },
  {
    id: 'sam_mountain_stance', tree: 'samurai_tactics', tier: 8, name: 'Mountain Stance',
    desc: 'Four seconds of not moving, and the mountain answers.',
    type: 'active', domain: 'mental', prereq: 'sam_severing_arc',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'MOVEMENT', mode: 'still', seconds: T.mountainSeconds },
    cooldown: T.mountainCd,
    compose: [{
      kind: 'shield', amount: T.mountainAmount, duration: T.mountainDuration,
      scaleWith: 'footing', scalePer: T.mountainPerFooting,
    }],
    ranks: R,
  },
  {
    id: 'sam_killing_ground', tree: 'samurai_tactics', tier: 9, name: 'Killing Ground',
    desc: 'The ground you chose is the ground it dies on.',
    type: 'active', domain: 'physical', prereq: 'sam_mountain_stance',
    select: 'lowest_hp',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'TARGET_THRESHOLD', pct: T.killPct, range: T.killReach },
    cooldown: T.killCd,
    compose: [{
      kind: 'strike', damage: T.killDamage, arc: T.killArc, reach: T.killReach,
      ...FOOT_HEAVY, riders: { multiPulse: T.killPulses },
    }],
    ranks: R,
  },
  {
    id: 'sam_unsheathed', tree: 'samurai_tactics', tier: 10, name: 'Unsheathed',
    desc: 'Everything the stance was for, spent at once.',
    type: 'active', domain: 'physical', prereq: 'sam_killing_ground',
    select: 'objective_target',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'PROXIMITY', radius: T.unsheathedRadius, count: T.unsheathedCount },
    cooldown: T.unsheathedCd,
    compose: [{
      kind: 'strike', damage: T.unsheathedDamage, arc: T.unsheathedArc, reach: T.unsheathedReach,
      ...FOOT_HEAVY, riders: { multiPulse: T.unsheathedPulses, stun: T.unsheathedStun },
    }],
    ranks: R,
  },
];
