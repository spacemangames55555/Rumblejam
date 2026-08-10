// WIZARD — Dissonance. The third tree, and the answer to the cost the first two
// pretend is free.
//
// WHAT THE FIRST TWO LEAVE UNANSWERED. §8.3: the Wizard is "the only class that
// changes its own damage domain mid-fight". Attunement performs the shift;
// Arcana spends whatever domain you are currently in. Both trees are written as
// though the shift always lands on the right answer.
//
// It cannot. §5's triangle means a domain is strong against one thing and weak
// against another, so a shift is a BET on what is in front of you — and against
// a mixed room there is no correct bet. Worse, the shift is the class's whole
// identity, so the Wizard is the one character whose signature move can be
// actively wrong. Neither existing tree says anything about the wrong bet,
// which is a large fraction of them.
//
// Dissonance is that cost, read two ways:
//
//   SPREAD (branch A) refuses to bet. Its actives are deliberately one of each
//     domain — physical, mental, spiritual — so whatever the room turns out to
//     be, something in the branch already matches it. The Wizard stops needing
//     to be right.
//   CONVICTION (branch B) is paid for having been wrong. Its skills fire on
//     ON_HIT_TAKEN and SELF_THRESHOLD — the two states a bad matchup actually
//     produces — so the branch turns the cost of the mismatch into the trigger
//     for the answer.
//
// Both scale on `shift`, so a Wizard that shifts often is better at both. The
// tree does not remove the bet; it makes losing it survivable and, in Spread's
// case, largely irrelevant.
//
// PAIRED WITH monk_empty_hand ON PURPOSE: `shift` is a domain enum on the
// caster with no tick; `chi` is a two-directional counter with its own tick and
// its own decay. Different fields, different code paths — a defect in the
// machinery under both surfaces twice rather than once.
//
// THE SHAPE (§8.1): ten nodes, tiers 1/2/4/6/8/10, one branch at tier 2, two
// capstones, symmetric.

export const TUNING = {
  frayDamage: 11, frayRange: 250, fraySpeed: 440, frayRadius: 7, frayCd: 1150,
  discordPerShift: 0.010,

  // ---- branch A: Spread (one of each domain — always something that fits) ----
  ironDamage: 16, ironReach: 112, ironArc: 1.8, ironCd: 2400,          // physical
  polyPerShift: 0.013,
  murmurDamage: 19, murmurRange: 270, murmurSpeed: 460, murmurRadius: 7, murmurCd: 4200,  // mental
  chorusDamage: 27, chorusArc: 2.9, chorusRange: 300, chorusCd: 7600,  // spiritual
  chorusWeaken: { mult: 0.7, dur: 3000 },

  // ---- branch B: Conviction (paid for having been wrong) ----
  recoilDamage: 17, recoilRadius: 150, recoilDuration: 3400, recoilTickMs: 400, recoilCd: 2800,
  temperPerShift: 0.013,
  bulwarkAmount: 40, bulwarkDuration: 4800, bulwarkPct: 55, bulwarkCd: 5200,
  reversalAmount: 50, reversalDuration: 5200, reversalReflect: 32, reversalPct: 38, reversalCd: 9000,

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
const SHIFT = { scaleWith: 'shift', scalePer: 0.05 };

export const WIZARD_DISSONANCE = [
  {
    id: 'wiz_fray', tree: 'wizard_dissonance', tier: 1, name: 'Fray',
    desc: 'An unfocused bolt. It is not the right answer to anything, which is the point of starting here.',
    type: 'active', domain: 'mental', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.frayRange },
    cooldown: T.frayCd,
    compose: [{ kind: 'bolt', damage: T.frayDamage, range: T.frayRange, speed: T.fraySpeed, radius: T.frayRadius, ...SHIFT, riders: {} }],
    ranks: R,
  },
  {
    id: 'wiz_discord', tree: 'wizard_dissonance', tier: 2, name: 'Discord',
    desc: 'Being wrong is information. Both roads out of here are about the bet that did not land.',
    type: 'passive', domain: 'mental', prereq: 'wiz_fray',
    trigger: null, cooldown: 0, compose: [],
    passive: { shiftDamageBonus: T.discordPerShift },
    ranks: R,
  },

  // --------------------------------------- branch A: Spread (one of each)
  {
    id: 'wiz_iron_word', tree: 'wizard_dissonance', tier: 4, name: 'Iron Word',
    desc: 'PHYSICAL. Spread refuses the bet: whatever the room turns out to be, one of these three already matches it.',
    type: 'active', domain: 'physical', prereq: 'wiz_discord',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.ironReach },
    cooldown: T.ironCd,
    compose: [{ kind: 'strike', damage: T.ironDamage, arc: T.ironArc, reach: T.ironReach, ...SHIFT, riders: {} }],
    ranks: R,
  },
  {
    id: 'wiz_polyglot', tree: 'wizard_dissonance', tier: 6, name: 'Polyglot',
    desc: 'Fluent in all three, expert in none, and never silent.',
    type: 'passive', domain: 'mental', prereq: 'wiz_iron_word',
    trigger: null, cooldown: 0, compose: [],
    passive: { shiftDamageBonus: T.polyPerShift },
    ranks: R,
  },
  {
    id: 'wiz_murmur', tree: 'wizard_dissonance', tier: 8, name: 'Murmur',
    desc: 'MENTAL. The second of the three.',
    type: 'active', domain: 'mental', prereq: 'wiz_polyglot',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.murmurRange },
    cooldown: T.murmurCd,
    compose: [{ kind: 'bolt', damage: T.murmurDamage, range: T.murmurRange, speed: T.murmurSpeed, radius: T.murmurRadius, ...SHIFT, riders: {} }],
    ranks: R,
  },
  {
    id: 'wiz_chorus', tree: 'wizard_dissonance', tier: 10, name: 'Chorus',
    desc: 'CAPSTONE — Spread. SPIRITUAL, and the third voice. All of them at once, and whatever it is weak against is weakened.',
    type: 'active', domain: 'spiritual', prereq: 'wiz_murmur',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.chorusRange, count: 2 },
    cooldown: T.chorusCd,
    compose: [{
      kind: 'cone', damage: T.chorusDamage, arc: T.chorusArc, range: T.chorusRange, ...SHIFT,
      riders: { weakenDamage: T.chorusWeaken },
    }],
    ranks: R,
  },

  // ---------------------------------- branch B: Conviction (paid for it)
  {
    id: 'wiz_recoil', tree: 'wizard_dissonance', tier: 4, name: 'Recoil',
    desc: 'Fires when the bet has already gone badly. Conviction turns the cost of a mismatch into the trigger for the answer.',
    type: 'active', domain: 'spiritual', prereq: 'wiz_discord',
    select: 'densest_cluster',
    trigger: { kind: 'ON_HIT_TAKEN' },
    cooldown: T.recoilCd,
    compose: [{
      kind: 'hazard', damage: T.recoilDamage, radius: T.recoilRadius,
      duration: T.recoilDuration, tickMs: T.recoilTickMs, ...SHIFT, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'wiz_tempered', tree: 'wizard_dissonance', tier: 6, name: 'Tempered',
    desc: 'Every wrong guess left something behind.',
    type: 'passive', domain: 'spiritual', prereq: 'wiz_recoil',
    trigger: null, cooldown: 0, compose: [],
    passive: { shiftDamageBonus: T.temperPerShift },
    ranks: R,
  },
  {
    id: 'wiz_bulwark', tree: 'wizard_dissonance', tier: 8, name: 'Bulwark',
    desc: 'Standing in the wrong domain costs less than it did.',
    type: 'active', domain: 'spiritual', prereq: 'wiz_tempered',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.bulwarkPct },
    cooldown: T.bulwarkCd,
    compose: [{ kind: 'shield', amount: T.bulwarkAmount, duration: T.bulwarkDuration, ...SHIFT }],
    ranks: R,
  },
  {
    id: 'wiz_reversal', tree: 'wizard_dissonance', tier: 10, name: 'Reversal',
    desc: 'CAPSTONE — Conviction. The mismatch turns around and goes back the way it came.',
    type: 'active', domain: 'spiritual', prereq: 'wiz_bulwark',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.reversalPct },
    cooldown: T.reversalCd,
    compose: [{ kind: 'ward', amount: T.reversalAmount, duration: T.reversalDuration, reflectPct: T.reversalReflect, ...SHIFT }],
    ranks: R,
  },
];
