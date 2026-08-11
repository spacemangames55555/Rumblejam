// PRIEST — Reckoning. The third tree, and the answer to a hole the first two
// cannot see because both of them assume a party.
//
// WHAT THE FIRST TWO LEAVE UNANSWERED. Judgment's own header calls a mark "a
// debt the room pays later", and that is exact: `mark` does not heal when
// applied, it heals when the marked thing dies, to every ally in reach, whoever
// landed the blow. Grace is the flat half, and its one engine-reading node is a
// heal that gets bigger the more debt is outstanding.
//
// Both are written for a room with people in it. Read the detonation:
// `game.js` loops `livePlayers()` and heals everyone inside the radius — so the
// payout is multiplied by the party, and **solo it divides by the party too**.
// A Priest alone marks something, waits for it to die, and heals exactly one
// body. The class's signature mechanic is at one eighth strength in the state a
// player is in for most of a solo run, and no amount of tuning fixes it,
// because the number that shrank is the number of people standing there.
//
// TWO THINGS MAKE THAT INTERESTING RATHER THAN JUST BAD, and both already
// exist. The Priest's `grace_and_judgment` trait converts healing into damage
// through `tohOnHeal` — so a solo detonation is not wasted, it is *converted*,
// accidentally. And `p.engines.marks` counts marks STANDING, which is a number
// the Priest can raise on its own without anybody else's help.
//
// Reckoning makes both deliberate:
//
//   VIGIL (branch A) is the Priest as its own congregation. Every node heals
//     the caster, and the trait turns that into damage on the way out — a
//     Priest with nobody to save saves itself, loudly. It scales on `marks`
//     because outstanding debt is what a Priest alone actually has.
//   RECKONING (branch B) is the impatient half, and it is the honest solo
//     answer: **nothing else is going to kill your marks.** In a party the debt
//     is collected by whoever swings next; alone, the Priest is the only
//     collector, so this branch is damage that scales on standing marks and
//     re-marks what it hits. Mark, kill, collect, repeat — a loop of one.
//
// NO NEW MACHINERY. `mark` is a rider, `marks` is a published count, and
// `tohOnHeal` has converted Priest healing into damage since the class shipped.
// A tree that needed an engine change to say "the Priest is alone" would be
// arguing with §8.3 rather than answering it.
//
// PAIRED WITH sun_undertow ON PURPOSE: `marks` is a COUNT of enemies carrying a
// flag, recomputed by scanning the pool; `drench` is a room-wide SUM of a
// per-enemy integer with its own expiry. Different fields, different write
// paths, different shapes of arithmetic — a defect in the machinery under both
// surfaces twice rather than once.
//
// THE SHAPE (§8.1): ten nodes, tiers 1/2/4/6/8/10, one branch at tier 2, two
// capstones, symmetric.

export const TUNING = {
  indictDamage: 12, indictRange: 240, indictSpeed: 450, indictRadius: 7, indictCd: 1200,
  indictMark: { heal: 6, dur: 6000, radius: 150 },
  aloneWeight: 0.15,

  // ---- branch A: Vigil (heal yourself; the trait does the rest) ----
  // NOTHING HERE TARGETS AN ALLY, and that is the branch rather than an
  // oversight. `select: 'self'` is the honest declaration for a step that picks
  // no target (§5.3), and a Priest alone is the only body its own heal can
  // reach anyway — the difference is that this says so.
  solaceAmount: 22, solaceRadius: 140, solacePct: 70, solaceCd: 2500,
  matinsWeight: 0.18,
  compline: 34, complineDuration: 4600, complinePct: 55, complineCd: 4800,
  vespersAmount: 46, vespersDuration: 5400, vespersReflect: 30, vespersPct: 40, vespersCd: 8800,

  // ---- branch B: Reckoning (collect your own debts) ----
  tallyDamage: 17, tallyReach: 118, tallyArc: 1.9, tallyCd: 2400,
  tallyMark: { heal: 7, dur: 6000, radius: 150 },
  arrearsWeight: 0.18,
  distraintDamage: 21, distraintArc: 1.7, distraintRange: 280, distraintCd: 4300,
  distraintMark: { heal: 8, dur: 6500, radius: 160 },
  forecloseDamage: 29, forecloseReach: 145, forecloseArc: 2.8, forecloseCd: 7600,
  foreclosePulses: 2, forecloseMark: { heal: 11, dur: 7000, radius: 180 },

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
const MARKS = { scaleWith: 'marks' };

export const PRIEST_RECKONING = [
  {
    id: 'pri_indictment', tree: 'priest_reckoning', tier: 1, name: 'Indictment',
    desc: 'Names a debt. Somebody has to, and there is nobody else here.',
    type: 'active', domain: 'spiritual', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.indictRange },
    cooldown: T.indictCd,
    compose: [{
      kind: 'bolt', damage: T.indictDamage, range: T.indictRange, speed: T.indictSpeed,
      radius: T.indictRadius, ...MARKS, riders: { mark: T.indictMark },
    }],
    ranks: R,
  },
  {
    id: 'pri_alone', tree: 'priest_reckoning', tier: 2, name: 'Alone',
    desc: 'A congregation of one is still a congregation. Both roads out of here are about being the only one standing.',
    type: 'passive', domain: 'spiritual', prereq: 'pri_indictment',
    trigger: null, cooldown: 0, compose: [],
    passive: { marksScaleWeight: T.aloneWeight },
    ranks: R,
  },

  // ------------------------------------- branch A: Vigil (your own congregation)
  {
    id: 'pri_solace', tree: 'priest_reckoning', tier: 4, name: 'Solace',
    desc: 'Vigil keeps the Priest standing. The trait turns the mercy into damage on the way out — nobody said it had to be gentle.',
    type: 'active', domain: 'spiritual', prereq: 'pri_alone',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.solacePct },
    cooldown: T.solaceCd,
    compose: [{ kind: 'heal', amount: T.solaceAmount, radius: T.solaceRadius, ...MARKS }],
    ranks: R,
  },
  {
    id: 'pri_matins', tree: 'priest_reckoning', tier: 6, name: 'Matins',
    desc: 'The office is kept whether or not anyone attends.',
    type: 'passive', domain: 'spiritual', prereq: 'pri_solace',
    trigger: null, cooldown: 0, compose: [],
    passive: { marksScaleWeight: T.matinsWeight },
    ranks: R,
  },
  {
    id: 'pri_compline', tree: 'priest_reckoning', tier: 8, name: 'Compline',
    desc: 'The last hour, and the door is barred from the inside.',
    type: 'active', domain: 'spiritual', prereq: 'pri_matins',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.complinePct },
    cooldown: T.complineCd,
    compose: [{ kind: 'shield', amount: T.compline, duration: T.complineDuration, ...MARKS }],
    ranks: R,
  },
  {
    id: 'pri_vespers', tree: 'priest_reckoning', tier: 10, name: 'Vespers',
    desc: 'CAPSTONE — Vigil. Alone, at the end of the day, and what comes at you goes back.',
    type: 'active', domain: 'spiritual', prereq: 'pri_compline',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.vespersPct },
    cooldown: T.vespersCd,
    compose: [{
      kind: 'ward', amount: T.vespersAmount, duration: T.vespersDuration,
      reflectPct: T.vespersReflect, ...MARKS,
    }],
    ranks: R,
  },

  // --------------------------------- branch B: Reckoning (collect them yourself)
  {
    id: 'pri_tally', tree: 'priest_reckoning', tier: 4, name: 'Tally',
    desc: 'In a party the debt is collected by whoever swings next. Alone, this is who swings next.',
    type: 'active', domain: 'physical', prereq: 'pri_alone',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.tallyReach },
    cooldown: T.tallyCd,
    compose: [{
      kind: 'strike', damage: T.tallyDamage, arc: T.tallyArc, reach: T.tallyReach,
      ...MARKS, riders: { mark: T.tallyMark },
    }],
    ranks: R,
  },
  {
    id: 'pri_arrears', tree: 'priest_reckoning', tier: 6, name: 'Arrears',
    desc: 'Every name still on the list makes the next one heavier.',
    type: 'passive', domain: 'spiritual', prereq: 'pri_tally',
    trigger: null, cooldown: 0, compose: [],
    passive: { marksScaleWeight: T.arrearsWeight },
    ranks: R,
  },
  {
    id: 'pri_distraint', tree: 'priest_reckoning', tier: 8, name: 'Distraint',
    desc: 'Seizes against the debt. Marks what it does not finish, which is most of them.',
    type: 'active', domain: 'spiritual', prereq: 'pri_arrears',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.distraintRange, count: 2 },
    cooldown: T.distraintCd,
    compose: [{
      kind: 'cone', damage: T.distraintDamage, arc: T.distraintArc, range: T.distraintRange,
      ...MARKS, riders: { mark: T.distraintMark },
    }],
    ranks: R,
  },
  {
    id: 'pri_foreclose', tree: 'priest_reckoning', tier: 10, name: 'Foreclose',
    desc: 'CAPSTONE — Reckoning. Twice, and the second one is for the interest.',
    type: 'active', domain: 'physical', prereq: 'pri_distraint',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.forecloseReach },
    cooldown: T.forecloseCd,
    compose: [{
      kind: 'strike', damage: T.forecloseDamage, arc: T.forecloseArc, reach: T.forecloseReach, ...MARKS,
      riders: { multiPulse: T.foreclosePulses, mark: T.forecloseMark },
    }],
    ranks: R,
  },
];
