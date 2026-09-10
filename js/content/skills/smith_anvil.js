// BLACKSMITH — Anvil. The third tree, and it is about THE GAP rather than a
// third way into a form.
//
// WHAT THE FIRST TWO LEAVE UNANSWERED. §8.3 calls Crystal Forms "the only
// engine that is a STATE rather than a quantity" — Iron Pyrite, Prism Quartz,
// Celestial Calcite, each a named condition with a duration. Crystal enters
// them; Forge is the mundane half that swings while they hold. Both trees
// assume the answer to "what are you" is one of the three.
//
// The forms enter on SELF_THRESHOLD. That gives the class a shape nothing else
// on the roster has: **it is strongest when hurt and hollow when healthy.** A
// Blacksmith at full health with the cooldowns up is not in a form, cannot
// enter one, and has no engine — and neither existing tree has a word to say
// about that interval, which is most of a good fight.
//
// A third way into a form would have made the gap shorter. Anvil makes the gap
// PLAYABLE, which is the harder and more honest reading:
//
//   COLD IRON (branch A) is the work done between forms. Every skill declares
//     `form: 'none'` — they fire ONLY while no form holds, so the branch is
//     literally the interval, and it goes quiet the moment a form starts.
//   TEMPERING (branch B) is what the gap is FOR. Every skill fires on
//     SELF_THRESHOLD like the forms themselves, so it competes for the same
//     moment: spend the low-health window on a form, or on this.
//
// Read together the class stops being "wait to be hurt". Cold Iron pays the
// healthy Blacksmith for being healthy; Tempering makes the hurt window a
// choice rather than a script.
//
// `form: 'none'` DID NOT EXIST AND WAS BUILT FIRST. `formHolds` could only ask
// "is this the form I need", so the interval between forms was the one
// condition no skill could name — a tree about the gap could not be written at
// all. It is a VALUE of the existing field rather than a new flag, gated in
// engine_gate in both directions before a line of this tree was authored, per
// the sequence every write path in this project has followed.
//
// PAIRED WITH wd_swarm ON PURPOSE: `form` is a named state with a duration on
// the caster; `doll` is a designation on one enemy plus a mirror. Different
// fields, different tick paths, no shared state — a defect under both surfaces
// twice.
//
// THE SHAPE (§8.1): ten nodes, tiers 1/2/4/6/8/10, one branch at tier 2, two
// capstones, symmetric.

export const TUNING = {
  // ---- moved in 2026-09-10: Iron Pyrite and Anvil Strike from Crystal (a form
  // and the skill gated on it belong in one tree), Swage Block from the old
  // Forge. Numbers unchanged. Pyrite's own tree is this one now.
  pyriteGrit: 22, pyriteVit: 14,
  anvilDamage: 12, anvilReach: 112, anvilArc: 1.9, anvilRadius: 150,
  anvilCount: 2, anvilCd: 2400, anvilKnock: 190,
  blockDamage: 11, blockReach: 106, blockArc: 1.7, blockRadius: 142,
  blockCount: 2, blockCd: 3200, blockKnock: 200,
  tapDamage: 11, tapReach: 105, tapArc: 1.5, tapCd: 1100,
  patienceWeight: 0.15,

  // ---- branch A: Cold Iron (form: 'none' — the interval itself) ----
  coldDamage: 16, coldReach: 115, coldArc: 1.9, coldCd: 2400,
  hammerWeight: 0.18,
  // 19 -> 25 by Casey's ruling of 2026-09-10. Swage was the one Cold Iron node
  // BEHIND its form-boosted equivalent — 19 against Drawing Out's 24.8 effective,
  // 77% — and a no-form branch that is worse at everything is not a choice.
  // 25 is parity on damage; the advantage stays the area it already had, which
  // is range 290 against every other cone in the class at 185-200. Area unchanged.
  swageDamage: 25, swageArc: 1.6, swageRange: 290, swageCd: 4200,
  proofDamage: 28, proofReach: 145, proofArc: 2.9, proofCd: 7600,
  proofPulses: 2, proofKnock: 250,

  // ---- branch B: Tempering (SELF_THRESHOLD — competes with the forms) ----
  quenchAmount: 34, quenchDuration: 4600, quenchPct: 60, quenchCd: 5000,
  grainWeight: 0.18,
  drawDamage: 20, drawReach: 125, drawArc: 2.4, drawPct: 50, drawCd: 4600,
  // A REFLECT IS A FRACTION. This was authored as a whole number and read as
  // one: 30 meant 30x the damage absorbed thrown back, not 30%. Converted, not
  // retuned — the intent is unchanged and the magnitude is what it always read as.
  weldAmount: 52, weldDuration: 5400, weldReflect: 0.30, weldPct: 35, weldCd: 9000,

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
// Anvil reads `form` like the other two trees. A tree about the gap that could
// not see the engine would be a tree about nothing in particular — and reading
// it is what makes Cold Iron's silence during a form legible rather than a bug.
const FORM = { scaleWith: 'form'};

export const SMITH_ANVIL = [
  {
    id: 'smith_tap', tree: 'smith_anvil', tier: 1, name: 'Tap',
    flavor: 'The small corrective blow. It does not care what you are made of today.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.tapReach },
    cooldown: T.tapCd,
    compose: [{ kind: 'strike', damage: T.tapDamage, arc: T.tapArc, reach: T.tapReach, ...FORM, riders: {} }],
    ranks: R,
  },
  {
    id: 'smith_patience', tree: 'smith_anvil', tier: 2, name: 'Patience',
    flavor: 'Most of the work happens between the heats. Both roads out of here are about the interval.',
    type: 'passive', domain: 'physical', prereq: 'smith_tap',
    trigger: null, cooldown: 0, compose: [],
    passive: { formScaleWeight: T.patienceWeight },
    ranks: R,
  },
  {
    // A CRYSTAL FORM IS A STATE YOU CHOSE, NOT AN EMERGENCY BUTTON. Casey's
    // ruling of 2026-09-09: the forms hold permanently while slotted, exactly as
    // Marrownaut does. It shipped as a 7000ms form on a 12000ms cooldown
    // firing at 70% health, which is a panic cast — and a panic cast cannot
    // be a commitment to a tree.
    //
    // AN ACTIVE THAT NEVER FIRES, through the same `persist` door Marrownaut
    // uses. It occupies one of the eight slots, and spending that slot IS the
    // specialisation; a passive would hand the form out for free. It has no
    // trigger for the trigger loop to read and never enters the pace band.
    //
    // The stat delta is carried forward unchanged from the timed version.
    id: 'smith_iron_pyrite', tree: 'smith_anvil', tier: 4, name: 'Iron Pyrite',
    type: 'active', domain: 'physical', prereq: 'smith_patience',
    select: 'self',   // writes the caster, picks no target (§5.3)
    // ONE RANK. A form is a state, not an investment: the stat delta is what it
    // is, and a second point in it would buy nothing. Same rule the rank-1
    // passives declare, for the same reason.
    maxRank: 1,
    // TREE-SCOPED. Recorded as the tree this form ACTUALLY sits in today,
    // not the one the restructure will move it to — that layout is Casey's
    // and is not invented here.
    persist: { form: 'pyrite', tree: 'smith_anvil', stats: { grit: T.pyriteGrit, vitality: T.pyriteVit } },
  },
  {
    id: 'smith_swage_block', tree: 'smith_anvil', tier: 4, name: 'Swage Block',
    flavor: 'A shaping blow that sends the front rank somewhere else.',
    type: 'active', domain: 'physical', prereq: 'smith_patience',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.blockRadius, count: T.blockCount },
    cooldown: T.blockCd,
    compose: [{
      kind: 'strike', damage: T.blockDamage, reach: T.blockReach, arc: T.blockArc,
      riders: { knockback: T.blockKnock },
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
    id: 'smith_anvil_strike', tree: 'smith_anvil', tier: 6, name: 'Anvil Strike',
    flavor: 'Only in Iron Pyrite.',
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
    id: 'smith_hammer_hand', tree: 'smith_anvil', tier: 6, name: 'Hammer Hand',
    flavor: 'The hand knows the shape whether or not the metal is glowing.',
    type: 'passive', domain: 'physical', prereq: 'smith_swage_block',
    trigger: null, cooldown: 0, compose: [],
    passive: { formScaleWeight: T.hammerWeight },
    ranks: R,
  },
  {
    id: 'smith_drawing_out', tree: 'smith_anvil', tier: 8, name: 'Drawing Out',
    flavor: 'Thinner, longer, and it reaches further than it looks.',
    type: 'active', domain: 'physical', prereq: 'smith_anvil_strike',
    select: 'objective_target',
    trigger: { kind: 'SELF_THRESHOLD', pct: T.drawPct },
    cooldown: T.drawCd,
    compose: [{ kind: 'strike', damage: T.drawDamage, arc: T.drawArc, reach: T.drawReach, ...FORM, riders: {} }],
    ranks: R,
  },
  {
    id: 'smith_grain', tree: 'smith_anvil', tier: 8, name: 'Grain',
    flavor: 'What the heat did to the structure stays done.',
    type: 'passive', domain: 'physical', prereq: 'smith_hammer_hand',
    trigger: null, cooldown: 0, compose: [],
    passive: { formScaleWeight: T.grainWeight },
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
    id: 'smith_proof', tree: 'smith_anvil', tier: 10, name: 'Proof',
    flavor: 'CAPSTONE — Cold Iron. The healthy Blacksmith, paid for being healthy. Twice, and what is left is thrown clear.',
    type: 'active', domain: 'physical', prereq: 'smith_drawing_out',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.proofReach },
    cooldown: T.proofCd,
    compose: [{
      // NO `...FORM` ON THE COLD IRON NODES. It was here and it was dead: a
      // `form: 'none'` skill fires only while no form is held, which forces
      // `p.engines.form` to 0, which makes `engineScale` return exactly 1.
      // Measured at x1.00 on all three. Advertising a payoff that cannot arrive
      // is worse than having none — Casey's ruling of 2026-09-09 pays this
      // branch in raw damage and area instead, set separately.
      kind: 'strike', damage: T.proofDamage, arc: T.proofArc, reach: T.proofReach,
      riders: { multiPulse: T.proofPulses, knockback: T.proofKnock },
    }],
    ranks: R,
  },
  {
    id: 'smith_forge_weld', tree: 'smith_anvil', tier: 10, name: 'Forge Weld',
    flavor: 'CAPSTONE — Tempering. Two pieces made one at the bottom of the bar, and it hits back.',
    type: 'active', domain: 'physical', prereq: 'smith_grain',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.weldPct },
    cooldown: T.weldCd,
    compose: [{ kind: 'ward', amount: T.weldAmount, duration: T.weldDuration, reflectPct: T.weldReflect, ...FORM }],
    ranks: R,
  },
];
