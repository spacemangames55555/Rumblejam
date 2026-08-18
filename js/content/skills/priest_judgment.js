// PRIEST — Judgment tree.
//
// THE CLASS ENGINE, EXPRESSED AS CONTENT. §8.3 gives the Priest "judgment marks
// — marks detonate on the target's death, healing nearby allies", and the write
// path is the `mark` rider (ruled and gated before this file existed). Nothing
// here is engine code: a mark is a rider on a damage step, and the resource it
// feeds is `p.engines.marks`, published in one line.
//
// THE MARK IS A DEBT THE ROOM PAYS LATER. It does not heal when applied; it
// heals when the marked thing dies, to every ally in reach, whoever landed the
// killing blow. That is the shape that makes the Priest a party class rather
// than a self-sustain class: a mark on something the Samurai is about to kill is
// worth exactly as much as one on something the Priest kills, and a mark placed
// while the party is healthy is worth nothing at all.
//
// AND IT IS WHY THE ENGINE IS A COUNT, NOT A RATE. `p.engines.marks` is how many
// marked things are currently standing — a Priest who has marked the whole room
// is holding a large unpaid debt, and this tree's later skills read that as
// power. Kill them and the power is spent along with the heal. Spread marks and
// hold them, and the Priest is strongest in the moment before the room breaks.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Rebuke
  rebukeDamage: 8, rebukeReach: 100, rebukeArc: 1.6, rebukeRadius: 130,
  rebukeCount: 1, rebukeCd: 1000,
  // tier 2 — Judgment
  judgeDamage: 9, judgeSpeed: 500, judgeRange: 250, judgeCd: 2800,
  judgeMarkDur: 9000, judgeMarkHeal: 7, judgeMarkRadius: 190,
  // tier 3 — Censure
  censureDamage: 10, censureAngle: 1.7, censureRange: 220, censureRadius: 170,
  censureCount: 3, censureCd: 4400,
  censureMarkDur: 8000, censureMarkHeal: 5, censureMarkRadius: 170,
  // tier 4 — Weight of Sin
  weightDamage: 11, weightReach: 108, weightArc: 1.8, weightRadius: 140,
  weightCount: 2, weightCd: 4000, weightWeakenMult: 0.78, weightWeakenDur: 2500,
  // tier 5 — Attend the Fallen (passive)
  attendWeight: 0.286,
  // tier 6 — Sentence
  sentenceDamage: 14, sentenceSpeed: 520, sentenceRange: 260, sentencePct: 50,
  sentenceCd: 4600, sentenceMarkDur: 7000, sentenceMarkHeal: 12, sentenceMarkRadius: 210,
  // tier 7 — Chorus of the Named
  chorusDamage: 10, chorusAngle: 2.2, chorusRange: 235, chorusRadius: 195,
  chorusCount: 4, chorusCd: 5600, chorusWeight: 0.71,
  // tier 8 — Reliquary Ward
  reliquaryAmount: 24, reliquaryDuration: 5000, reliquaryCd: 8500,
  // tier 9 — The Long Ledger
  ledgerDamage: 12, ledgerWidth: 36, ledgerLength: 380, ledgerRadius: 215,
  ledgerCount: 3, ledgerCd: 6400, ledgerWeight: 0.86,
  ledgerMarkDur: 8000, ledgerMarkHeal: 8, ledgerMarkRadius: 200,
  // tier 10 — Day of Accounts
  accountsDamage: 17, accountsAngle: 2.8, accountsRange: 255, accountsRadius: 225,
  accountsCount: 4, accountsCd: 10500,
  accountsMarkDur: 10000, accountsMarkHeal: 16, accountsMarkRadius: 240,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const PRIEST_JUDGMENT = [
  {
    id: 'pri_rebuke', tree: 'priest_judgment', tier: 1, name: 'Rebuke',
    flavor: 'A backhand at whatever came close.',
    type: 'active', domain: 'spiritual', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.rebukeRadius, count: T.rebukeCount },
    cooldown: T.rebukeCd,
    compose: [{ kind: 'strike', damage: T.rebukeDamage, reach: T.rebukeReach, arc: T.rebukeArc, riders: {} }],
    ranks: R,
  },
  {
    // THE ENGINE, TIER 2 — for the same reason the Wizard's shift is tier 2. A
    // Priest without marks is a weak Mage, and a class should not spend a third
    // of a run being a worse version of another one.
    id: 'pri_judgment', tree: 'priest_judgment', tier: 2, name: 'Judgment',
    flavor: 'Marks a target. When it dies.',
    type: 'active', domain: 'spiritual', prereq: 'pri_rebuke',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.judgeRange },
    cooldown: T.judgeCd,
    compose: [{
      kind: 'bolt', damage: T.judgeDamage, speed: T.judgeSpeed, range: T.judgeRange,
      riders: { mark: { dur: T.judgeMarkDur, heal: T.judgeMarkHeal, radius: T.judgeMarkRadius } },
    }],
    ranks: R,
  },
  {
    id: 'pri_censure', tree: 'priest_judgment', tier: 4, name: 'Censure',
    flavor: 'Marks a whole fan at once.',
    type: 'active', domain: 'spiritual', prereq: 'pri_judgment',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.censureRadius, count: T.censureCount },
    cooldown: T.censureCd,
    compose: [{
      kind: 'cone', damage: T.censureDamage, angle: T.censureAngle, range: T.censureRange,
      riders: { mark: { dur: T.censureMarkDur, heal: T.censureMarkHeal, radius: T.censureMarkRadius } },
    }],
    ranks: R,
  },
  {
    id: 'pri_weight_of_sin', tree: 'priest_judgment', tier: 4, name: 'Weight of Sin',
    flavor: 'A heavy arc.',
    type: 'active', domain: 'physical', prereq: 'pri_judgment',
    select: 'highest_hp',
    trigger: { kind: 'PROXIMITY', radius: T.weightRadius, count: T.weightCount },
    cooldown: T.weightCd,
    compose: [{
      kind: 'strike', damage: T.weightDamage, reach: T.weightReach, arc: T.weightArc,
      riders: { weakenDamage: { mult: T.weightWeakenMult, dur: T.weightWeakenDur } },
    }],
    ranks: R,
  },
  {
    id: 'pri_attend_the_fallen', tree: 'priest_judgment', tier: 6, name: 'Attend the Fallen',
    type: 'passive', domain: 'spiritual', prereq: 'pri_weight_of_sin',
    trigger: null, cooldown: 0, compose: [],
    passive: { marksScaleWeight: T.attendWeight },
    // Classified 'damage' in PASSIVE_EFFECT, so it is an INVESTMENT and ranks —
    // the same shape as Held Edge on Footing and Pack Bond on the pack. A
    // rank-1 cap here would have been the assertion's other complaint.
    ranks: { damage: T.rankDamage },
  },
  {
    id: 'pri_sentence', tree: 'priest_judgment', tier: 8, name: 'Sentence',
    flavor: 'Marks the dying for a large payout.',
    type: 'active', domain: 'spiritual', prereq: 'pri_attend_the_fallen',
    select: 'lowest_hp',
    trigger: { kind: 'TARGET_THRESHOLD', pct: T.sentencePct, range: T.sentenceRange },
    cooldown: T.sentenceCd,
    compose: [{
      kind: 'bolt', damage: T.sentenceDamage, speed: T.sentenceSpeed, range: T.sentenceRange,
      riders: { mark: { dur: T.sentenceMarkDur, heal: T.sentenceMarkHeal, radius: T.sentenceMarkRadius } },
    }],
    ranks: R,
  },
  {
    id: 'pri_chorus', tree: 'priest_judgment', tier: 6, name: 'Chorus of the Named',
    flavor: 'Louder for every mark still standing.',
    type: 'active', domain: 'mental', prereq: 'pri_censure',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.chorusRadius, count: T.chorusCount },
    cooldown: T.chorusCd,
    compose: [{
      kind: 'cone', damage: T.chorusDamage, angle: T.chorusAngle, range: T.chorusRange,
      scaleWith: 'marks', scaleWeight: T.chorusWeight, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'pri_reliquary_ward', tree: 'priest_judgment', tier: 8, name: 'Reliquary Ward',
    flavor: 'A ward that thickens with every mark held.',
    type: 'active', domain: 'spiritual', prereq: 'pri_chorus',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 50 },
    cooldown: T.reliquaryCd,
    compose: [{
      kind: 'ward', amount: T.reliquaryAmount, duration: T.reliquaryDuration, reflectPct: 0,
      scaleWith: 'marks',
    }],
    ranks: R,
  },
  {
    id: 'pri_long_ledger', tree: 'priest_judgment', tier: 10, name: 'The Long Ledger',
    flavor: 'A line that marks everything it crosses.',
    type: 'active', domain: 'mental', prereq: 'pri_sentence',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.ledgerRadius, count: T.ledgerCount },
    cooldown: T.ledgerCd,
    compose: [{
      kind: 'line', damage: T.ledgerDamage, width: T.ledgerWidth, length: T.ledgerLength,
      scaleWith: 'marks', scaleWeight: T.ledgerWeight,
      riders: { mark: { dur: T.ledgerMarkDur, heal: T.ledgerMarkHeal, radius: T.ledgerMarkRadius } },
    }],
    ranks: R,
  },
  {
    id: 'pri_day_of_accounts', tree: 'priest_judgment', tier: 10, name: 'Day of Accounts',
    flavor: 'Everything in front of you is named at once.',
    type: 'active', domain: 'spiritual', prereq: 'pri_reliquary_ward',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.accountsRadius, count: T.accountsCount },
    cooldown: T.accountsCd,
    compose: [{
      kind: 'cone', damage: T.accountsDamage, angle: T.accountsAngle, range: T.accountsRange,
      scaleWith: 'marks',
      riders: { mark: { dur: T.accountsMarkDur, heal: T.accountsMarkHeal, radius: T.accountsMarkRadius } },
    }],
    ranks: R,
  },
];
