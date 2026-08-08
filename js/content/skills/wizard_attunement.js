// WIZARD — Attunement tree.
//
// THE CLASS ENGINE, EXPRESSED AS CONTENT. §8.3 gives the Wizard "domain shift —
// the only class that changes its own damage domain mid-fight", and the write
// path for that is the `shift` primitive (§5.7's twelfth, ruled and gated before
// this file existed). Nothing in this tree is engine code: a shift is a compose
// step, and the resource it banks is `p.engines.shift`, published in one line.
//
// HOW THE ENGINE READS. `bestDomainMult` takes the best of the skill's own
// domain, the current shift, and any item grant — never worse than what the
// skill already had. So a shift is upside with a cost measured in TIME rather
// than in risk: the Wizard spends a cast to line its damage up against what is
// actually in front of it, and pays for that in the fires it did not make.
//
// WHY THE SHIFTS BANK. `p.domainShifts` counts shifts made this room, and half
// this tree scales off it. That is what stops the shift being a free action
// bolted to the front of a rotation: a Wizard who shifts once and settles has a
// weak engine, and a Wizard who shifts constantly has a strong engine and very
// little time left to attack. The resource resets at every door, so the ramp is
// per-room and never compounds across a map — the same shape §8.5 gives the
// Necromancer's skeletons, and for the same reason.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Cinder Bolt
  cinderDamage: 7, cinderSpeed: 500, cinderRange: 250, cinderCd: 950,
  // tier 2 — Attune: Physical
  attunePhysCd: 5200,
  // tier 3 — Refracted Lance
  lanceDamage: 8, lanceWidth: 30, lanceLength: 330, lanceRadius: 210,
  lanceCount: 2, lanceCd: 3400, lancePer: 0.05,
  // tier 4 — Attune: Mental
  attuneMentalCd: 5200,
  // tier 5 — Prism Ward
  prismAmount: 26, prismDuration: 5000, prismCd: 8000, prismPer: 0.06,
  // tier 6 — Spectral Cascade
  cascadeDamage: 9, cascadeAngle: 1.5, cascadeRange: 235, cascadeRadius: 190,
  cascadeCount: 3, cascadeCd: 5200, cascadePer: 0.05,
  // tier 7 — Attune: Spiritual
  attuneSpiritCd: 5200,
  // tier 8 — Sympathetic Resonance (passive)
  resonancePer: 0.02,
  // tier 9 — Unmaking Beam
  unmakeDamage: 8, unmakeWidth: 38, unmakeLength: 400, unmakePulses: 2,
  unmakeRadius: 220, unmakeCount: 2, unmakeCd: 6800, unmakePer: 0.06,
  // tier 10 — The Third Reading
  thirdDamage: 15, thirdAngle: 2.6, thirdRange: 250, thirdRadius: 200,
  thirdCount: 4, thirdCd: 9500, thirdPer: 0.07,
  thirdWeakenMult: 0.78, thirdWeakenDur: 2600,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const WIZARD_ATTUNEMENT = [
  {
    id: 'wiz_cinder_bolt', tree: 'wizard_attunement', tier: 1, name: 'Cinder Bolt',
    desc: 'A quick mote of fire at the nearest thing. Deals 7 damage at 250 range.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.cinderRange },
    cooldown: T.cinderCd,
    compose: [{ kind: 'bolt', damage: T.cinderDamage, speed: T.cinderSpeed, range: T.cinderRange, riders: {} }],
    ranks: R,
  },
  {
    // THE ENGINE, TIER 2. Early on purpose: a Wizard whose shift arrives at tier
    // 6 spends a third of a run as a worse Mage. The three Attune nodes are
    // deliberately identical in cost and cooldown and differ only in which
    // domain they write, because the decision is WHEN to shift and into WHAT,
    // and pricing them differently would answer that in advance.
    id: 'wiz_attune_physical', tree: 'wizard_attunement', tier: 2, name: 'Attune: Physical',
    desc: 'Your skills also resolve as Physical, whichever reads better. Lasts until you attune again or leave the room.',
    type: 'active', domain: 'physical', prereq: 'wiz_cinder_bolt',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.cinderRange },
    cooldown: T.attunePhysCd,
    compose: [{ kind: 'shift', domain: 'physical' }],
    // A shift grants neither damage nor duration, so a second point buys
    // nothing — §1.3's unlock rule, the same one the Samurai's stance passives
    // are capped under.
    maxRank: 1,
  },
  {
    id: 'wiz_refracted_lance', tree: 'wizard_attunement', tier: 3, name: 'Refracted Lance',
    desc: 'A beam that sharpens with every attunement made this room. 8 damage, +5% per shift banked.',
    type: 'active', domain: 'mental', prereq: 'wiz_attune_physical',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.lanceRadius, count: T.lanceCount },
    cooldown: T.lanceCd,
    compose: [{
      kind: 'line', damage: T.lanceDamage, width: T.lanceWidth, length: T.lanceLength,
      scaleWith: 'shift', scalePer: T.lancePer, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'wiz_attune_mental', tree: 'wizard_attunement', tier: 4, name: 'Attune: Mental',
    desc: 'Your skills also resolve as Mental, whichever reads better. Lasts until you attune again or leave the room.',
    type: 'active', domain: 'mental', prereq: 'wiz_refracted_lance',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.cinderRange },
    cooldown: T.attuneMentalCd,
    compose: [{ kind: 'shift', domain: 'mental' }],
    maxRank: 1,
  },
  {
    id: 'wiz_prism_ward', tree: 'wizard_attunement', tier: 5, name: 'Prism Ward',
    desc: 'A ward that thickens with attunements. Absorbs 26, +6% per shift banked, over 5s.',
    type: 'active', domain: 'spiritual', prereq: 'wiz_attune_mental',
    select: 'nearest',
    trigger: { kind: 'SELF_THRESHOLD', pct: 55 },
    cooldown: T.prismCd,
    compose: [{
      kind: 'ward', amount: T.prismAmount, duration: T.prismDuration, reflectPct: 0,
      scaleWith: 'shift', scalePer: T.prismPer,
    }],
    ranks: R,
  },
  {
    id: 'wiz_spectral_cascade', tree: 'wizard_attunement', tier: 6, name: 'Spectral Cascade',
    desc: 'A fan of raw arcana across the crowd. 9 damage, +5% per shift banked.',
    type: 'active', domain: 'spiritual', prereq: 'wiz_prism_ward',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.cascadeRadius, count: T.cascadeCount },
    cooldown: T.cascadeCd,
    compose: [{
      kind: 'cone', damage: T.cascadeDamage, angle: T.cascadeAngle, range: T.cascadeRange,
      scaleWith: 'shift', scalePer: T.cascadePer, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'wiz_attune_spiritual', tree: 'wizard_attunement', tier: 7, name: 'Attune: Spiritual',
    desc: 'Your skills also resolve as Spiritual, whichever reads better. Lasts until you attune again or leave the room.',
    type: 'active', domain: 'spiritual', prereq: 'wiz_spectral_cascade',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.cinderRange },
    cooldown: T.attuneSpiritCd,
    compose: [{ kind: 'shift', domain: 'spiritual' }],
    maxRank: 1,
  },
  {
    // The one passive in the tree, and it raises what a SHIFT is worth rather
    // than granting a flat number — the same hook Held Edge uses on Footing,
    // keyed by engine name so it needed no code here.
    id: 'wiz_sympathetic_resonance', tree: 'wizard_attunement', tier: 8, name: 'Sympathetic Resonance',
    desc: 'Every attunement is worth 2% more to every skill that reads them.',
    type: 'passive', domain: 'mental', prereq: 'wiz_attune_spiritual',
    trigger: null, cooldown: 0, compose: [],
    passive: { shiftDamageBonus: T.resonancePer },
    // Classified 'damage' in PASSIVE_EFFECT, so it is an INVESTMENT and ranks —
    // the same shape as Held Edge on Footing and Pack Bond on the pack. A
    // rank-1 cap here would have been the assertion's other complaint.
    ranks: { damage: T.rankDamage },
  },
  {
    id: 'wiz_unmaking_beam', tree: 'wizard_attunement', tier: 9, name: 'Unmaking Beam',
    desc: 'Two pulses down a long line. 8 damage a pulse, +6% per shift banked.',
    type: 'active', domain: 'mental', prereq: 'wiz_sympathetic_resonance',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.unmakeRadius, count: T.unmakeCount },
    cooldown: T.unmakeCd,
    compose: [{
      kind: 'line', damage: T.unmakeDamage, width: T.unmakeWidth, length: T.unmakeLength,
      scaleWith: 'shift', scalePer: T.unmakePer,
      riders: { multiPulse: T.unmakePulses },
    }],
    ranks: R,
  },
  {
    id: 'wiz_third_reading', tree: 'wizard_attunement', tier: 10, name: 'The Third Reading',
    desc: 'The whole room read at once. 15 damage in a wide fan, +7% per shift banked, and what it touches deals 22% less for 2.6s.',
    type: 'active', domain: 'spiritual', prereq: 'wiz_unmaking_beam',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.thirdRadius, count: T.thirdCount },
    cooldown: T.thirdCd,
    compose: [{
      kind: 'cone', damage: T.thirdDamage, angle: T.thirdAngle, range: T.thirdRange,
      scaleWith: 'shift', scalePer: T.thirdPer,
      riders: { weakenDamage: { mult: T.thirdWeakenMult, dur: T.thirdWeakenDur } },
    }],
    ranks: R,
  },
];
