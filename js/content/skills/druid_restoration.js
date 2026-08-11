// DRUID — Restoration. The third tree, and the one §8.2 named from the start.
//
// WHAT THE FIRST TWO LEAVE UNANSWERED. Tapestry of Beasts makes the pack a
// standing commitment: an animal that falls is REVIVED, not replaced, and
// `reviveSeconds()` counts animals OWNED rather than alive, so a wiped pack is
// the slowest to repair and not the fastest. Wildkin makes the pack a
// multiplier — `p.engines.pack` counts the standing animals and the tree rides
// the number.
//
// Between them the pack is a resource that can be spent and a resource that can
// be lost, and **neither tree gives the Druid one thing to do about an animal
// that is about to fall.** `p.engines.pack` counts a wolf at one hit point
// exactly the same as a wolf at full, so the engine reads healthy right up to
// the instant it collapses, and the only lever on the collapse is waiting out a
// timer whose length was decided by how many animals you own. The class's whole
// identity is a pack it cannot maintain.
//
// That gap is why `mend` exists. It was built as a RIDER rather than a
// primitive and gated before this file was authored — §5.7's second condition
// decided it, and `healMinions` in `js/minions.js` is still the only thing in
// the game that can heal a live minion. Restoration is the content that rider
// was ruled for.
//
// Two answers, and they are answers to different questions:
//
//   THORNBARK (branch A) is prevention. Every active carries `mend`, so the
//     Druid's own swings are what keep the pack up — the heal is not a spell
//     the Druid stops to cast, it is a property of fighting alongside them.
//     The revive timer never starts, which is worth more than any speed-up of
//     it could be: `reviveSeconds` is a punishment for owning a big pack, and
//     the only way to win against that arithmetic is to not enter it.
//   BRAMBLEHIDE (branch B) is what a Druid is with nothing standing. Not one
//     node reads `pack`, because a branch that scales on the pack is worthless
//     in the exact moment the pack is gone — which is the moment this branch
//     exists for. It is the Druid's own body: melee, flat, and unbothered by an
//     engine reading zero.
//
// SO THE TWO BRANCHES DISAGREE ABOUT THE PACK ON PURPOSE, and that is the §4.2
// decision this class never had. Thornbark says the pack is the character and
// must be protected; Bramblehide says the pack is equipment and the Druid is
// the character. Wildkin and Beasts both assume the first and neither says so.
//
// THE FIFTEENTH TREE, AND THE LAST OF PHASE 5's AUTHORING. Fourteen classes,
// three trees each, 420 skills.
//
// NO NEW MACHINERY. `mend` is a gated rider, `healMinions` is a shipped
// function, and `pack` is a published count. The one thing this tree needed was
// ruled and proven three patches before a node was written against it, which is
// the sequence every write path in this project has followed.
//
// THE SHAPE (§8.1): ten nodes, tiers 1/2/4/6/8/10, one branch at tier 2, two
// capstones, symmetric.

export const TUNING = {
  cuttingDamage: 13, cuttingReach: 118, cuttingArc: 1.8, cuttingCd: 1200,
  cuttingMend: 4,
  tendingWeight: 0.15,

  // ---- branch A: Thornbark (the pack never gets to the timer) ----
  // EVERY ACTIVE CARRIES `mend`, and the magnitudes climb with the tier while
  // the cooldowns stay short. That shape is the branch: a trickle that never
  // stops beats a large heal on a long cooldown, because the thing being
  // outrun is a revive timer that only starts if an animal reaches zero.
  thornDamage: 18, thornReach: 122, thornArc: 1.9, thornCd: 2200, thornMend: 7,
  grovekeepWeight: 0.18,
  barkDamage: 21, barkArc: 1.7, barkRange: 280, barkCd: 3800, barkMend: 10,
  thornbarkDamage: 28, thornbarkReach: 148, thornbarkArc: 2.7, thornbarkCd: 6800,
  thornbarkMend: 16, thornbarkPulses: 2,

  // ---- branch B: Bramblehide (what is left when they are all down) ----
  // NOT ONE `scaleWith` IN THIS BRANCH AT ALL. A branch reading `pack` would
  // be at its weakest in the only situation it was written for, which is
  // `samurai_agility`'s defect restated — an engine the branch's own premise
  // sets to zero (§13 rule 65).
  //
  // The first draft avoided that and then made the same mistake one field over:
  // it read `armor` instead, and **the Druid has no Grit** — measured peak 0
  // with every tree of the class spent, so the clause multiplied by 1 forever.
  // The class-supply pass in `tools/tree_dps.mjs` caught it in the same patch
  // that cites the rule it breaks. Flat numbers, which is what the paragraph
  // above always said; the scaling was the part that disagreed with the design.
  //
  // `dru_hidebind` grants Grit rather than scaling on it — the Druid wearing
  // what it grew for the pack — and takes `maxRank: 1` under §1.3 because a
  // passive granting neither damage nor duration buys nothing with a second
  // point.
  huskAmount: 34, huskDuration: 5200, huskPct: 60, huskCd: 4200,
  hidebindGrit: 6, hidebindVit: 14,
  goreDamage: 26, goreReach: 130, goreArc: 2.0, goreCd: 3400, goreKnock: 210,
  bramblehideAmount: 48, bramblehideDuration: 6400, bramblehideReflect: 32,
  bramblehidePct: 42, bramblehideCd: 8800,

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
const PACK = { scaleWith: 'pack' };

export const DRUID_RESTORATION = [
  {
    id: 'dru_cutting_back', tree: 'druid_restoration', tier: 1, name: 'Cutting Back',
    desc: 'Prunes what is dying so the rest of it does not. The pack is a garden, not a stockpile.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.cuttingReach },
    cooldown: T.cuttingCd,
    compose: [{
      kind: 'strike', damage: T.cuttingDamage, arc: T.cuttingArc, reach: T.cuttingReach,
      ...PACK, riders: { mend: T.cuttingMend },
    }],
    ranks: R,
  },
  {
    id: 'dru_tending', tree: 'druid_restoration', tier: 2, name: 'Tending',
    desc: 'A standing pack is not the same as a healthy one. Both roads out of here are about the animal that is about to fall.',
    type: 'passive', domain: 'spiritual', prereq: 'dru_cutting_back',
    trigger: null, cooldown: 0, compose: [],
    passive: { packScaleWeight: T.tendingWeight },
    ranks: R,
  },

  // ------------------------------ branch A: Thornbark (the timer never starts)
  {
    id: 'dru_thorn', tree: 'druid_restoration', tier: 4, name: 'Thorn',
    desc: 'Thornbark heals by fighting. The Druid does not stop to tend the pack — tending is what its swings already do.',
    type: 'active', domain: 'physical', prereq: 'dru_tending',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.thornReach },
    cooldown: T.thornCd,
    compose: [{
      kind: 'strike', damage: T.thornDamage, arc: T.thornArc, reach: T.thornReach,
      ...PACK, riders: { mend: T.thornMend },
    }],
    ranks: R,
  },
  {
    id: 'dru_grovekeeper', tree: 'druid_restoration', tier: 6, name: 'Grovekeeper',
    desc: 'They stand because you kept them standing, and they are worth more for it.',
    type: 'passive', domain: 'spiritual', prereq: 'dru_thorn',
    trigger: null, cooldown: 0, compose: [],
    passive: { packScaleWeight: T.grovekeepWeight },
    ranks: R,
  },
  {
    id: 'dru_bark_shield', tree: 'druid_restoration', tier: 8, name: 'Bark Shield',
    desc: 'The whole line at once, and everything behind it comes back up with it.',
    type: 'active', domain: 'spiritual', prereq: 'dru_grovekeeper',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.barkRange, count: 2 },
    cooldown: T.barkCd,
    compose: [{
      kind: 'cone', damage: T.barkDamage, arc: T.barkArc, range: T.barkRange,
      ...PACK, riders: { mend: T.barkMend },
    }],
    ranks: R,
  },
  {
    id: 'dru_thornbark', tree: 'druid_restoration', tier: 10, name: 'Thornbark',
    desc: 'CAPSTONE — Thornbark. Twice, and both times the pack is further from the ground than it was.',
    type: 'active', domain: 'physical', prereq: 'dru_bark_shield',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.thornbarkReach },
    cooldown: T.thornbarkCd,
    compose: [{
      kind: 'strike', damage: T.thornbarkDamage, arc: T.thornbarkArc, reach: T.thornbarkReach, ...PACK,
      riders: { multiPulse: T.thornbarkPulses, mend: T.thornbarkMend },
    }],
    ranks: R,
  },

  // --------------------------- branch B: Bramblehide (when nothing is standing)
  {
    id: 'dru_husk', tree: 'druid_restoration', tier: 4, name: 'Husk',
    desc: 'Bramblehide reads no pack at all. A branch for the empty field cannot depend on the field being full.',
    type: 'active', domain: 'physical', prereq: 'dru_tending',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.huskPct },
    cooldown: T.huskCd,
    compose: [{ kind: 'shield', amount: T.huskAmount, duration: T.huskDuration }],
    ranks: R,
  },
  {
    id: 'dru_hidebind', tree: 'druid_restoration', tier: 6, name: 'Hidebind',
    desc: 'What you grew for them, you can wear yourself.',
    type: 'passive', domain: 'physical', prereq: 'dru_husk',
    trigger: null, cooldown: 0, compose: [],
    passive: { armorGrit: T.hidebindGrit, armorVit: T.hidebindVit },
    // §1.3: grants no damage and no duration, so a second point buys nothing.
    maxRank: 1,
    ranks: R,
  },
  {
    id: 'dru_gore', tree: 'druid_restoration', tier: 8, name: 'Gore',
    desc: 'No animal in front of you and no animal behind you. Still teeth.',
    type: 'active', domain: 'physical', prereq: 'dru_hidebind',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.goreReach },
    cooldown: T.goreCd,
    compose: [{
      kind: 'strike', damage: T.goreDamage, arc: T.goreArc, reach: T.goreReach,
      riders: { knockback: T.goreKnock },
    }],
    ranks: R,
  },
  {
    id: 'dru_bramblehide', tree: 'druid_restoration', tier: 10, name: 'Bramblehide',
    desc: 'CAPSTONE — Bramblehide. The pack is gone and you are still the worst thing in the room.',
    type: 'active', domain: 'physical', prereq: 'dru_gore',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.bramblehidePct },
    cooldown: T.bramblehideCd,
    compose: [{
      kind: 'ward', amount: T.bramblehideAmount, duration: T.bramblehideDuration,
      reflectPct: T.bramblehideReflect,
    }],
    ranks: R,
  },
];
