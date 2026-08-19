// BARD — Requiem. The third tree, and the answer to the question Rhythm poses.
//
// WHAT THE FIRST TWO LEAVE UNANSWERED. §8.3 calls Rhythm "the only engine with
// a loss condition": attacking without a gap builds stacks, and missing the
// window drops every one of them at once. Cadence builds the stacks and
// Ensemble shares them with the party — both trees are about HAVING the rhythm.
// Neither has anything to say about losing it, which is the one thing this
// engine does that no other engine does. A Bard whose window lapses in a lull
// between waves loses the whole build and both existing trees are silent about
// it.
//
// Requiem is that answer, read two ways:
//
//   CADENZA (branch A) prevents the break. Every skill fires on ON_KILL, so
//     the thing that keeps the phrase alive is finishing what you started —
//     the beat is bought back by killing rather than by swinging at air.
//   DIRGE (branch B) plays through it. Every skill fires on ON_HIT_TAKEN, so
//     the tree pays out exactly when the Bard is being interrupted, which is
//     when a window is most likely to lapse.
//
// Same loss, two readings: refuse it, or be paid for it.
//
// FIRST CONTENT ON ON_KILL, AND CHECKED RATHER THAN ASSUMED. Across 290 skills
// no tree had ever used the ON_KILL trigger — it was a declared kind with a
// live reader (`p.trigEvents.kill`, written in `_killEnemy`) and no content, the
// exact shape D-36 turned out to be. It was verified wired BEFORE this tree was
// authored, and `skill_sweep` fires every node here to prove it.
//
// THE SHAPE (§8.1): ten nodes, tiers 1/2/4/6/8/10, one branch point at tier 2,
// two capstones, symmetric.
//
//        T1  Grace Note
//         |
//        T2  Held Breath            <- the branch point
//           /            \
//        T4  Answering Verse    Struck Chord
//        T6  Cadenza (passive)  Undertow (passive)
//        T8  Round               Threnody
//        T10 Last Measure        Requiem

export const TUNING = {
  // tier 1 — Grace Note
  graceDamage: 10, graceRange: 260, graceSpeed: 460, graceRadius: 7, graceCd: 1200,
  // tier 2 — Held Breath (passive, the branch point)
  heldWeight: 0.15,

  // ---- branch A: Cadenza (ON_KILL — buy the beat back) ----
  answerDamage: 14, answerReach: 110, answerArc: 1.7, answerCd: 1800,
  cadenzaWeight: 0.18,
  roundDamage: 16, roundArc: 1.5, roundRange: 300, roundCd: 3400,
  finaleDamage: 26, finaleReach: 140, finaleArc: 2.9, finaleCd: 7200,
  finalePulses: 2, finaleSlowMult: 0.6, finaleSlowDur: 2200,

  // ---- branch B: Dirge (ON_HIT_TAKEN — be paid for the interruption) ----
  struckDamage: 15, struckRadius: 150, struckDuration: 3200, struckTickMs: 400, struckCd: 2600,
  undertowWeight: 0.18,
  threnodyDamage: 18, threnodyReach: 125, threnodyArc: 2.4, threnodyCd: 4400,
  requiemDamage: 28, requiemRadius: 175, requiemDuration: 4200, requiemTickMs: 400, requiemCd: 7600,
  requiemSlowMult: 0.45, requiemSlowDur: 2600,

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
// Requiem scales on the same engine the other two trees fill. The tree is about
// what happens to the rhythm, so it would be incoherent for it not to read it.
const RHY = { scaleWith: 'rhythm'};

export const BARD_REQUIEM = [
  {
    id: 'bard_grace_note', tree: 'bard_requiem', tier: 1, name: 'Grace Note',
    flavor: 'A small figure thrown ahead of the beat. Costs nothing and keeps the line moving.',
    type: 'active', domain: 'mental', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.graceRange },
    cooldown: T.graceCd,
    compose: [{ kind: 'bolt', damage: T.graceDamage, range: T.graceRange, speed: T.graceSpeed, radius: T.graceRadius, ...RHY, riders: {} }],
    ranks: R,
  },
  {
    id: 'bard_held_breath', tree: 'bard_requiem', tier: 2, name: 'Held Breath',
    flavor: 'The pause before the phrase resolves. Both roads out of here are about what happens when it does not.',
    type: 'passive', domain: 'mental', prereq: 'bard_grace_note',
    trigger: null, cooldown: 0, compose: [],
    passive: { rhythmScaleWeight: T.heldWeight },
    ranks: R,
  },

  // ---------------------------------------------- branch A: Cadenza (ON_KILL)
  {
    id: 'bard_answering_verse', tree: 'bard_requiem', tier: 4, name: 'Answering Verse',
    flavor: 'The phrase answers itself the moment something falls. Cadenza refuses the break by finishing what it started.',
    type: 'active', domain: 'mental', prereq: 'bard_held_breath',
    select: 'objective_target',
    trigger: { kind: 'ON_KILL' },
    cooldown: T.answerCd,
    compose: [{ kind: 'strike', damage: T.answerDamage, arc: T.answerArc, reach: T.answerReach, ...RHY, riders: {} }],
    ranks: R,
  },
  {
    id: 'bard_cadenza', tree: 'bard_requiem', tier: 6, name: 'Cadenza',
    flavor: 'The solo passage. Every stack you kept is worth more while you are the only one playing.',
    type: 'passive', domain: 'mental', prereq: 'bard_answering_verse',
    trigger: null, cooldown: 0, compose: [],
    passive: { rhythmScaleWeight: T.cadenzaWeight },
    ranks: R,
  },
  {
    id: 'bard_round', tree: 'bard_requiem', tier: 8, name: 'Round',
    flavor: 'The figure repeats outward, each voice entering as the last one lands.',
    type: 'active', domain: 'mental', prereq: 'bard_cadenza',
    select: 'objective_target',
    trigger: { kind: 'ON_KILL' },
    cooldown: T.roundCd,
    compose: [{ kind: 'cone', damage: T.roundDamage, arc: T.roundArc, range: T.roundRange, ...RHY, riders: {} }],
    ranks: R,
  },
  {
    id: 'bard_last_measure', tree: 'bard_requiem', tier: 10, name: 'Finale',
    flavor: 'CAPSTONE — Cadenza. The phrase closes twice and nothing near you keeps its footing.',
    type: 'active', domain: 'mental', prereq: 'bard_round',
    select: 'objective_target',
    trigger: { kind: 'ON_KILL' },
    cooldown: T.finaleCd,
    compose: [{
      kind: 'strike', damage: T.finaleDamage, arc: T.finaleArc, reach: T.finaleReach, ...RHY,
      riders: { multiPulse: T.finalePulses, slow: { mult: T.finaleSlowMult, dur: T.finaleSlowDur } },
    }],
    ranks: R,
  },

  // ------------------------------------------ branch B: Dirge (ON_HIT_TAKEN)
  {
    id: 'bard_struck_chord', tree: 'bard_requiem', tier: 4, name: 'Struck Chord',
    flavor: 'Interrupted, and the interruption is the note. Dirge is paid exactly when the window is most likely to lapse.',
    type: 'active', domain: 'mental', prereq: 'bard_held_breath',
    select: 'objective_target',
    trigger: { kind: 'ON_HIT_TAKEN' },
    cooldown: T.struckCd,
    compose: [{ kind: 'hazard', damage: T.struckDamage, radius: T.struckRadius, duration: T.struckDuration, tickMs: T.struckTickMs, ...RHY, riders: {} }],
    ranks: R,
  },
  {
    id: 'bard_undertow', tree: 'bard_requiem', tier: 6, name: 'Undertow',
    flavor: 'The line under the melody does not stop when the melody does.',
    type: 'passive', domain: 'mental', prereq: 'bard_struck_chord',
    trigger: null, cooldown: 0, compose: [],
    passive: { rhythmScaleWeight: T.undertowWeight },
    ranks: R,
  },
  {
    id: 'bard_threnody', tree: 'bard_requiem', tier: 8, name: 'Threnody',
    flavor: 'A song for what it cost you.',
    type: 'active', domain: 'mental', prereq: 'bard_undertow',
    select: 'objective_target',
    trigger: { kind: 'ON_HIT_TAKEN' },
    cooldown: T.threnodyCd,
    compose: [{ kind: 'strike', damage: T.threnodyDamage, arc: T.threnodyArc, reach: T.threnodyReach, ...RHY, riders: {} }],
    ranks: R,
  },
  {
    id: 'bard_requiem_mass', tree: 'bard_requiem', tier: 10, name: 'Requiem',
    flavor: 'CAPSTONE — Dirge. Whatever broke the phrase is left standing in it, and slowing.',
    type: 'active', domain: 'mental', prereq: 'bard_threnody',
    select: 'objective_target',
    trigger: { kind: 'ON_HIT_TAKEN' },
    cooldown: T.requiemCd,
    compose: [{
      kind: 'hazard', damage: T.requiemDamage, radius: T.requiemRadius,
      duration: T.requiemDuration, tickMs: T.requiemTickMs, ...RHY,
      riders: { slow: { mult: T.requiemSlowMult, dur: T.requiemSlowDur } },
    }],
    ranks: R,
  },
];
