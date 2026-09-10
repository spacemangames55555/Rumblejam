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
  // ---- moved in 2026-09-10: Swage from Anvil, Draw the Heat and Strike While
  // It's Hot from the old Forge, which became the tank tree. Numbers unchanged.
  swageDamage: 25, swageArc: 1.6, swageRange: 290, swageCd: 4200,
  drawDamage: 11, drawRange: 215, drawHealPct: 0.45, drawCd: 3600,
  hotDamage: 16, hotReach: 126, hotArc: 2.3, hotRadius: 178,
  hotCount: 3, hotCd: 8600, hotStun: 600,
  // tier 1 — Hammer Blow
  hammerDamage: 7, hammerReach: 100, hammerArc: 1.5, hammerRadius: 124,
  hammerCount: 1, hammerCd: 1150, hammerWeight: 0.92,
  // tier 2 — IRON PYRITE, the defensive form
  pyritePct: 70, pyriteDuration: 7000, pyriteCd: 12000,
  pyriteGrit: 22, pyriteVit: 14,
  // tier 3 — Anvil Strike (Pyrite only)
  anvilDamage: 12, anvilReach: 112, anvilArc: 1.9, anvilRadius: 150,
  anvilCount: 2, anvilCd: 2400, anvilKnock: 190,
  // tier 4 — Slag
  slagDamage: 9, slagAngle: 1.9, slagRange: 195, slagRadius: 168,
  slagCount: 3, slagCd: 3000,
  // tier 5 — PRISM QUARTZ, the offensive form
  quartzPct: 55, quartzDuration: 6500, quartzCd: 13000,
  quartzAtt: 26, quartzFer: 18,
  // tier 6 — Refraction (Quartz only)
  refractDamage: 13, refractSpeed: 540, refractRange: 250, refractCd: 2600,
  // tier 7 — Facet (passive)
  facetWeight: 0.21,
  // tier 8 — CELESTIAL CALCITE, the recovery form
  calcitePct: 35, calciteDuration: 6000, calciteCd: 15000,
  calciteRec: 40, calciteVit: 24,
  // tier 9 — Mend the Seam (Calcite only)
  seamAmount: 26, seamCd: 3400,
  // tier 10 — Whole Cloth
  clothDamage: 17, clothReach: 130, clothArc: 2.4, clothRadius: 182,
  clothCount: 3, clothCd: 8400, clothWeight: 1.25, clothStun: 640,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const SMITH_CRYSTAL = [
  {
    id: 'smith_hammer_blow', tree: 'smith_crystal', tier: 1, name: 'Hammer Blow',
    flavor: 'The plain one.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.hammerRadius, count: T.hammerCount },
    cooldown: T.hammerCd,
    compose: [{
      kind: 'strike', damage: T.hammerDamage, reach: T.hammerReach, arc: T.hammerArc,
      scaleWith: 'form', scaleWeight: T.hammerWeight, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'smith_slag', tree: 'smith_crystal', tier: 2, name: 'Slag',
    flavor: 'A spray of hot waste.',
    type: 'active', domain: 'physical', prereq: 'smith_hammer_blow',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.slagRadius, count: T.slagCount },
    cooldown: T.slagCd,
    compose: [{
      kind: 'cone', damage: T.slagDamage, angle: T.slagAngle, range: T.slagRange,
      scaleWith: 'form', riders: {},
    }],
    ranks: R,
  },
  {
    // A CRYSTAL FORM IS A STATE YOU CHOSE, NOT AN EMERGENCY BUTTON. Casey's
    // ruling of 2026-09-09: the forms hold permanently while slotted, exactly as
    // Marrownaut does. It shipped as a 6500ms form on a 13000ms cooldown
    // firing at 55% health, which is a panic cast — and a panic cast cannot
    // be a commitment to a tree.
    //
    // AN ACTIVE THAT NEVER FIRES, through the same `persist` door Marrownaut
    // uses. It occupies one of the eight slots, and spending that slot IS the
    // specialisation; a passive would hand the form out for free. It has no
    // trigger for the trigger loop to read and never enters the pace band.
    //
    // The stat delta is carried forward unchanged from the timed version.
    id: 'smith_prism_quartz', tree: 'smith_crystal', tier: 4, name: 'Prism Quartz',
    type: 'active', domain: 'mental', prereq: 'smith_slag',
    select: 'self',   // writes the caster, picks no target (§5.3)
    // ONE RANK. A form is a state, not an investment: the stat delta is what it
    // is, and a second point in it would buy nothing. Same rule the rank-1
    // passives declare, for the same reason.
    maxRank: 1,
    // TREE-SCOPED. Recorded as the tree this form ACTUALLY sits in today,
    // not the one the restructure will move it to — that layout is Casey's
    // and is not invented here.
    persist: { form: 'quartz', tree: 'smith_crystal', stats: { attunement: T.quartzAtt, ferocity: T.quartzFer } },
  },
  {
    id: 'smith_refraction', tree: 'smith_crystal', tier: 4, name: 'Refraction',
    flavor: 'Only in Prism Quartz. A splitting bolt.',
    type: 'active', domain: 'mental', prereq: 'smith_slag',
    select: 'farthest', form: 'quartz',
    trigger: { kind: 'NEAREST', range: T.refractRange },
    cooldown: T.refractCd,
    compose: [{
      kind: 'bolt', damage: T.refractDamage, speed: T.refractSpeed, range: T.refractRange, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'smith_facet', tree: 'smith_crystal', tier: 6, name: 'Facet',
    flavor: 'Being crystal is worth more.',
    type: 'passive', domain: 'mental', prereq: 'smith_prism_quartz',
    passive: { formScaleWeight: T.facetWeight },
    ranks: R,
  },
  {
    id: 'smith_draw_the_heat', tree: 'smith_crystal', tier: 6, name: 'Draw the Heat',
    type: 'active', domain: 'physical', prereq: 'smith_refraction',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.drawRange },
    cooldown: T.drawCd,
    compose: [{ kind: 'drain', damage: T.drawDamage, range: T.drawRange, healPct: T.drawHealPct }],
    ranks: R,
  },
  {
    // NOT GATED ON THE ABSENCE OF A FORM, and this is deliberate — do not add
    // `form: 'none'` back. Casey's ruling of 2026-09-10: a Cold Iron skill fires
    // whether or not a form is slotted. What makes it a "no-form" skill is that
    // it takes NO tree boost — it carries no `scaleWith`, so a form pays it
    // nothing — and it is strong at baseline instead. It shipped gated, which
    // meant a player who slotted a form could not fire it at all; that is the
    // opposite of a splash node you spend a few points on from outside your
    // tree. Older GDD text still describes the gate.
    id: 'smith_swage', tree: 'smith_crystal', tier: 8, name: 'Swage',
    flavor: 'A whole row of it, worked cold.',
    type: 'active', domain: 'physical', prereq: 'smith_facet',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.swageRange, count: 2 },
    cooldown: T.swageCd,
      // NO `...FORM` ON THE COLD IRON NODES. It was here and it was dead: a
      // `form: 'none'` skill fires only while no form is held, which forces
      // `p.engines.form` to 0, which makes `engineScale` return exactly 1.
      // Measured at x1.00 on all three. Advertising a payoff that cannot arrive
      // is worse than having none — Casey's ruling of 2026-09-09 pays this
      // branch in raw damage and area instead, set separately.
    compose: [{ kind: 'cone', damage: T.swageDamage, arc: T.swageArc, range: T.swageRange, riders: {} }],
    ranks: R,
  },
  {
    id: 'smith_strike_while_hot', tree: 'smith_crystal', tier: 8, name: "Strike While It's Hot",
    flavor: 'The whole weight of the shop behind it.',
    type: 'active', domain: 'physical', prereq: 'smith_draw_the_heat',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.hotRadius, count: T.hotCount },
    cooldown: T.hotCd,
    compose: [{
      kind: 'strike', damage: T.hotDamage, reach: T.hotReach, arc: T.hotArc,
      riders: { stun: T.hotStun },
    }],
    ranks: R,
  },
  {
    id: 'smith_whole_cloth', tree: 'smith_crystal', tier: 10, name: 'Whole Cloth',
    flavor: 'Whatever you are made of right now, all of it at once.',
    type: 'active', domain: 'physical', prereq: 'smith_swage',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.clothRadius, count: T.clothCount },
    cooldown: T.clothCd,
    compose: [{
      kind: 'strike', damage: T.clothDamage, reach: T.clothReach, arc: T.clothArc,
      scaleWith: 'form', scaleWeight: T.clothWeight, riders: { stun: T.clothStun },
    }],
    ranks: R,
  },
  {
    id: 'smith_mend_the_seam', tree: 'smith_crystal', tier: 10, name: 'Mend the Seam',
    flavor: 'Only in Celestial Calcite.',
    type: 'active', domain: 'spiritual', prereq: 'smith_strike_while_hot',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 60 },
    cooldown: T.seamCd,
    compose: [{ kind: 'heal', amount: T.seamAmount }],
    ranks: R,
  },
];
