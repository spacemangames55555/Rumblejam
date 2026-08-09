// BLACKSMITH — Crystal tree. The last class.
//
// THE ENGINE IS A STATE, NOT A QUANTITY, AND IT IS THE ONLY ONE. Every engine
// before this measures something the player has accumulated — seconds stood
// still, casts made, stacks applied, objects placed, damage absorbed, bands of
// ground, points of Chi, ranks of chain. A Crystal Form is a thing the player
// IS: it has a name, a duration, a stat delta, and skills that only fire while
// it holds.
//
// WHAT THE ARCHAEOLOGY FOUND. §8.3 lists the Druid's morph beside this, and they
// are not the same shape. `wildshape` is `prism` reskinned — a boon picker whose
// "mutation" is cosmetic. `crystal_infusion`, this class's own trait, grants a
// PERMANENT stat after every fight, which is the opposite of a timed form. And
// the source project's timed-stat field, `p.tempStats`, was initialised in the
// player reset and read by NOTHING — one more declared capability with no
// reader, found by looking rather than by a red check.
//
// So nothing survived, and the shape was ruled from first principles:
//
//   - NOT already expressible. No primitive writes a named timed player state.
//     `shield` and `ward` write pools; `shift` writes one field with no clock.
//   - NOT a rider (§5.7 condition 2). A rider resolves on a target at impact and
//     a form has no target — it is caster state, exactly like `shift`.
//   - SO: the FOURTEENTH PRIMITIVE, plus a registry row. The primitive enters
//     the form; the tick runs the clock and recomputes the sheet when it ends;
//     the registry's `stats` hook — built for Footing in the Monk patch and
//     unused by anything else until now — is what makes a form change the player
//     rather than only their multipliers.
//
// THE THREE FORMS ARE THE TRAIT'S THREE CRYSTALS. Crystal Infusion permanently
// grants Iron Pyrite (Grit), Prism Quartz (Attunement) or Celestial Calcite
// (Recovery) after every fight. The forms are the TEMPORARY version of the same
// three, entered on SELF_THRESHOLD when a fight turns — so the class's slow
// permanent accretion and its emergency transformations are the same three
// materials at two timescales, which is the identity the trait already wrote.
//
// AND THEY ARE ALL IN ONE TREE, in a two-tree class. §8.2's aspiration was Tank
// / DPS / Runes-Crystal Forms, but all thirteen built classes shipped two trees
// and the forms are the ENGINE — splitting them across trees would mean a
// Blacksmith who took the other half had a third of an engine. See §8.3.
//
// ONE FORM AT A TIME, ALWAYS. Entering one replaces whatever is held. Two at
// once would stack their deltas and make the deepest threshold strictly the
// best, which erases the choice between them.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.
// (FORM_POWER lives in js/config.js — the engine shipped and gated first.)

export const TUNING = {
  // tier 1 — Hammer Blow
  hammerDamage: 7, hammerReach: 100, hammerArc: 1.5, hammerRadius: 124,
  hammerCount: 1, hammerCd: 1150, hammerPer: 0.22,
  // tier 2 — IRON PYRITE, the defensive form
  pyritePct: 70, pyriteDuration: 7000, pyriteCd: 12000,
  pyriteGrit: 22, pyriteVit: 14,
  // tier 3 — Anvil Strike (Pyrite only)
  anvilDamage: 12, anvilReach: 112, anvilArc: 1.9, anvilRadius: 150,
  anvilCount: 2, anvilCd: 2400, anvilKnock: 190,
  // tier 4 — Slag
  slagDamage: 9, slagAngle: 1.9, slagRange: 195, slagRadius: 168,
  slagCount: 3, slagCd: 3000, slagPer: 0.24,
  // tier 5 — PRISM QUARTZ, the offensive form
  quartzPct: 55, quartzDuration: 6500, quartzCd: 13000,
  quartzAtt: 26, quartzFer: 18,
  // tier 6 — Refraction (Quartz only)
  refractDamage: 13, refractSpeed: 540, refractRange: 250, refractCd: 2600,
  // tier 7 — Facet (passive)
  facetPer: 0.05,
  // tier 8 — CELESTIAL CALCITE, the recovery form
  calcitePct: 35, calciteDuration: 6000, calciteCd: 15000,
  calciteRec: 40, calciteVit: 24,
  // tier 9 — Mend the Seam (Calcite only)
  seamAmount: 26, seamCd: 3400,
  // tier 10 — Whole Cloth
  clothDamage: 17, clothReach: 130, clothArc: 2.4, clothRadius: 182,
  clothCount: 3, clothCd: 8400, clothPer: 0.30, clothStun: 640,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const SMITH_CRYSTAL = [
  {
    id: 'smith_hammer_blow', tree: 'smith_crystal', tier: 1, name: 'Hammer Blow',
    desc: 'The plain one. Deals 7 damage, +22% while a crystal form holds.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.hammerRadius, count: T.hammerCount },
    cooldown: T.hammerCd,
    compose: [{
      kind: 'strike', damage: T.hammerDamage, reach: T.hammerReach, arc: T.hammerArc,
      scaleWith: 'form', scalePer: T.hammerPer, riders: {},
    }],
    ranks: R,
  },
  {
    // THE FIRST FORM, and the shallowest threshold — the one a Blacksmith is in
    // most often. Grit and Vitality, because Pyrite is the trait's Grit crystal.
    id: 'smith_iron_pyrite', tree: 'smith_crystal', tier: 2, name: 'Iron Pyrite',
    desc: 'At 70% health you go to iron for 7s: +22 Grit, +14 Vitality, and Anvil Strike becomes available.',
    type: 'active', domain: 'physical', prereq: 'smith_hammer_blow',
    select: 'nearest',
    trigger: { kind: 'SELF_THRESHOLD', pct: T.pyritePct },
    cooldown: T.pyriteCd,
    compose: [{
      kind: 'form', form: 'pyrite', duration: T.pyriteDuration,
      stats: { grit: T.pyriteGrit, vitality: T.pyriteVit },
    }],
    ranks: R,
  },
  {
    // A FORM-GATED SKILL, and the reason forms are more than a stat buff. This
    // stays slotted and visible at all times; what the form changes is whether
    // its condition can hold — the same shape as the Monk's `chi` cost and the
    // Hunter's need for a live beast. §5.5 forbids mid-fight loadout changes, so
    // a form that swapped slots would be §9.2's deleted trigger-swap item aimed
    // at the player by their own class.
    id: 'smith_anvil_strike', tree: 'smith_crystal', tier: 3, name: 'Anvil Strike',
    desc: 'Only in Iron Pyrite. Deals 12 damage and throws the front rank back.',
    type: 'active', domain: 'physical', prereq: 'smith_iron_pyrite',
    select: 'densest_cluster', form: 'pyrite',
    trigger: { kind: 'PROXIMITY', radius: T.anvilRadius, count: T.anvilCount },
    cooldown: T.anvilCd,
    compose: [{
      kind: 'strike', damage: T.anvilDamage, reach: T.anvilReach, arc: T.anvilArc,
      riders: { knockback: T.anvilKnock },
    }],
    ranks: R,
  },
  {
    id: 'smith_slag', tree: 'smith_crystal', tier: 4, name: 'Slag',
    desc: 'A spray of hot waste. Deals 9 damage, +24% while a form holds.',
    type: 'active', domain: 'physical', prereq: 'smith_anvil_strike',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.slagRadius, count: T.slagCount },
    cooldown: T.slagCd,
    compose: [{
      kind: 'cone', damage: T.slagDamage, angle: T.slagAngle, range: T.slagRange,
      scaleWith: 'form', scalePer: T.slagPer, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'smith_prism_quartz', tree: 'smith_crystal', tier: 5, name: 'Prism Quartz',
    desc: 'At 55% health you go to glass for 6.5s: +26 Attunement, +18 Ferocity, and Refraction becomes available.',
    type: 'active', domain: 'mental', prereq: 'smith_slag',
    select: 'nearest',
    trigger: { kind: 'SELF_THRESHOLD', pct: T.quartzPct },
    cooldown: T.quartzCd,
    compose: [{
      kind: 'form', form: 'quartz', duration: T.quartzDuration,
      stats: { attunement: T.quartzAtt, ferocity: T.quartzFer },
    }],
    ranks: R,
  },
  {
    id: 'smith_refraction', tree: 'smith_crystal', tier: 6, name: 'Refraction',
    desc: 'Only in Prism Quartz. A splitting bolt for 13 damage.',
    type: 'active', domain: 'mental', prereq: 'smith_prism_quartz',
    select: 'farthest', form: 'quartz',
    trigger: { kind: 'NEAREST', range: T.refractRange },
    cooldown: T.refractCd,
    compose: [{
      kind: 'bolt', damage: T.refractDamage, speed: T.refractSpeed, range: T.refractRange, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'smith_facet', tree: 'smith_crystal', tier: 7, name: 'Facet',
    desc: 'Being crystal is worth more. +5% damage while any form holds, per rank.',
    type: 'passive', domain: 'mental', prereq: 'smith_refraction',
    passive: { formDamageBonus: T.facetPer },
    ranks: R,
  },
  {
    // THE DEEPEST THRESHOLD, and Recovery rather than damage — the form you
    // enter when the fight has already gone wrong. Its stats are the largest in
    // the tree and its cooldown is the longest, so it is a rescue rather than a
    // rotation.
    id: 'smith_celestial_calcite', tree: 'smith_crystal', tier: 8, name: 'Celestial Calcite',
    desc: 'At 35% health you go to light for 6s: +40 Recovery, +24 Vitality, and Mend the Seam becomes available.',
    type: 'active', domain: 'spiritual', prereq: 'smith_facet',
    select: 'nearest',
    trigger: { kind: 'SELF_THRESHOLD', pct: T.calcitePct },
    cooldown: T.calciteCd,
    compose: [{
      kind: 'form', form: 'calcite', duration: T.calciteDuration,
      stats: { recovery: T.calciteRec, vitality: T.calciteVit },
    }],
    ranks: R,
  },
  {
    id: 'smith_mend_the_seam', tree: 'smith_crystal', tier: 9, name: 'Mend the Seam',
    desc: 'Only in Celestial Calcite. Restores 26 health — and Calcite\'s own Recovery amplifies it.',
    type: 'active', domain: 'spiritual', prereq: 'smith_celestial_calcite',
    select: 'nearest', form: 'calcite',
    trigger: { kind: 'SELF_THRESHOLD', pct: 60 },
    cooldown: T.seamCd,
    compose: [{ kind: 'heal', amount: T.seamAmount }],
    ranks: R,
  },
  {
    id: 'smith_whole_cloth', tree: 'smith_crystal', tier: 10, name: 'Whole Cloth',
    desc: 'Whatever you are made of right now, all of it at once. 17 damage, +30% in form, and a 0.64s stun.',
    type: 'active', domain: 'physical', prereq: 'smith_mend_the_seam',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.clothRadius, count: T.clothCount },
    cooldown: T.clothCd,
    compose: [{
      kind: 'strike', damage: T.clothDamage, reach: T.clothReach, arc: T.clothArc,
      scaleWith: 'form', scalePer: T.clothPer, riders: { stun: T.clothStun },
    }],
    ranks: R,
  },
];
