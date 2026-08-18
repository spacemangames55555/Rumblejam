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
  tapDamage: 11, tapReach: 105, tapArc: 1.5, tapCd: 1100,
  patienceWeight: 0.15,

  // ---- branch A: Cold Iron (form: 'none' — the interval itself) ----
  coldDamage: 16, coldReach: 115, coldArc: 1.9, coldCd: 2400,
  hammerWeight: 0.18,
  swageDamage: 19, swageArc: 1.6, swageRange: 290, swageCd: 4200,
  proofDamage: 28, proofReach: 145, proofArc: 2.9, proofCd: 7600,
  proofPulses: 2, proofKnock: 250,

  // ---- branch B: Tempering (SELF_THRESHOLD — competes with the forms) ----
  quenchAmount: 34, quenchDuration: 4600, quenchPct: 60, quenchCd: 5000,
  grainWeight: 0.18,
  drawDamage: 20, drawReach: 125, drawArc: 2.4, drawPct: 50, drawCd: 4600,
  weldAmount: 52, weldDuration: 5400, weldReflect: 30, weldPct: 35, weldCd: 9000,

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

  // ------------------------------------------------- branch A: Cold Iron
  {
    id: 'smith_cold_work', tree: 'smith_anvil', tier: 4, name: 'Cold Work',
    flavor: 'Shaping without heat. Fires only while no form holds — this branch IS the gap, and it goes quiet the moment one starts.',
    type: 'active', domain: 'physical', prereq: 'smith_patience',
    select: 'objective_target',
    form: 'none',
    trigger: { kind: 'NEAREST', range: T.coldReach },
    cooldown: T.coldCd,
    compose: [{ kind: 'strike', damage: T.coldDamage, arc: T.coldArc, reach: T.coldReach, ...FORM, riders: {} }],
    ranks: R,
  },
  {
    id: 'smith_hammer_hand', tree: 'smith_anvil', tier: 6, name: 'Hammer Hand',
    flavor: 'The hand knows the shape whether or not the metal is glowing.',
    type: 'passive', domain: 'physical', prereq: 'smith_cold_work',
    trigger: null, cooldown: 0, compose: [],
    passive: { formScaleWeight: T.hammerWeight },
    ranks: R,
  },
  {
    id: 'smith_swage', tree: 'smith_anvil', tier: 8, name: 'Swage',
    flavor: 'A whole row of it, worked cold.',
    type: 'active', domain: 'physical', prereq: 'smith_hammer_hand',
    select: 'densest_cluster',
    form: 'none',
    trigger: { kind: 'PROXIMITY', radius: T.swageRange, count: 2 },
    cooldown: T.swageCd,
    compose: [{ kind: 'cone', damage: T.swageDamage, arc: T.swageArc, range: T.swageRange, ...FORM, riders: {} }],
    ranks: R,
  },
  {
    id: 'smith_proof', tree: 'smith_anvil', tier: 10, name: 'Proof',
    flavor: 'CAPSTONE — Cold Iron. The healthy Blacksmith, paid for being healthy. Twice, and what is left is thrown clear.',
    type: 'active', domain: 'physical', prereq: 'smith_swage',
    select: 'objective_target',
    form: 'none',
    trigger: { kind: 'NEAREST', range: T.proofReach },
    cooldown: T.proofCd,
    compose: [{
      kind: 'strike', damage: T.proofDamage, arc: T.proofArc, reach: T.proofReach, ...FORM,
      riders: { multiPulse: T.proofPulses, knockback: T.proofKnock },
    }],
    ranks: R,
  },

  // ------------------------------------------------ branch B: Tempering
  {
    id: 'smith_quenching', tree: 'smith_anvil', tier: 4, name: 'Quenching',
    flavor: 'Tempering competes with the forms for the same low-health moment: spend it becoming something, or spend it on this.',
    type: 'active', domain: 'physical', prereq: 'smith_patience',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.quenchPct },
    cooldown: T.quenchCd,
    compose: [{ kind: 'shield', amount: T.quenchAmount, duration: T.quenchDuration, ...FORM }],
    ranks: R,
  },
  {
    id: 'smith_grain', tree: 'smith_anvil', tier: 6, name: 'Grain',
    flavor: 'What the heat did to the structure stays done.',
    type: 'passive', domain: 'physical', prereq: 'smith_quenching',
    trigger: null, cooldown: 0, compose: [],
    passive: { formScaleWeight: T.grainWeight },
    ranks: R,
  },
  {
    id: 'smith_drawing_out', tree: 'smith_anvil', tier: 8, name: 'Drawing Out',
    flavor: 'Thinner, longer, and it reaches further than it looks.',
    type: 'active', domain: 'physical', prereq: 'smith_grain',
    select: 'objective_target',
    trigger: { kind: 'SELF_THRESHOLD', pct: T.drawPct },
    cooldown: T.drawCd,
    compose: [{ kind: 'strike', damage: T.drawDamage, arc: T.drawArc, reach: T.drawReach, ...FORM, riders: {} }],
    ranks: R,
  },
  {
    id: 'smith_forge_weld', tree: 'smith_anvil', tier: 10, name: 'Forge Weld',
    flavor: 'CAPSTONE — Tempering. Two pieces made one at the bottom of the bar, and it hits back.',
    type: 'active', domain: 'physical', prereq: 'smith_drawing_out',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.weldPct },
    cooldown: T.weldCd,
    compose: [{ kind: 'ward', amount: T.weldAmount, duration: T.weldDuration, reflectPct: T.weldReflect, ...FORM }],
    ranks: R,
  },
];
