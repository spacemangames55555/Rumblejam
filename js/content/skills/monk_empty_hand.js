// MONK — Empty Hand. The third tree, and the answer to a question §8.3 created
// with a ruling rather than with a mechanic.
//
// WHAT THE FIRST TWO LEAVE UNANSWERED. Chi is "the only engine that runs in two
// directions, and the only one the player empties on purpose": damage skills
// put Chi in, heals and traps take it out, and at zero Chi the damage skills sit
// at their floor. Chi is the filling half. Stone Garden is the spending half.
// Between them the engine is complete — and neither tree has a word for WHO
// DECIDES.
//
// §8.3 ruled spending automatic, because everything in this game auto-triggers.
// A Monk's heal fires on its own trigger, which means standing next to a hurt
// ally drains the pool whether or not that was the plan. **This is the only
// engine on the roster the SITUATION can empty rather than the player** — every
// other one is filled and spent by what the build does. So "at zero Chi" is not
// an edge case for the Monk, it is a state the room can impose, and the class
// had nothing to say about it.
//
// Empty Hand is what a Monk at zero Chi still is, read two ways:
//
//   EMPTY HAND (branch A) costs nothing. Not one skill declares `chi`, so the
//     whole branch fires at zero — it is the floor, raised. A Monk drained by a
//     bad room still has this, and it is the answer to being emptied by
//     something that was not a decision.
//   ONE BREATH (branch B) empties on purpose. Every skill carries the heaviest
//     Chi costs in the class and NONE of them deals damage — §8.3 makes damage
//     generate Chi, so a costed damage skill would fund and drain the same loop
//     in one cast, and the load assertion refused the first draft of this branch
//     for precisely that. What is left is the honest version: the pool buys
//     survival, and the BUILD decides when the Monk goes to zero rather than the
//     room.
//
// Same zero, two ways of arriving: refuse to depend on the pool, or spend it
// deliberately before the room can.
//
// NO NEW MACHINERY, and that is deliberate. `chiCostOf` already returns 0 for a
// skill with no `chi` field and the gate already refuses a skill the pool cannot
// pay for one line after the cooldown check, so "fires at zero" and "costs
// everything" are both expressible today. A tree that needed an engine change to
// say what it means would be a tree arguing with §8.3 rather than answering it.
//
// PAIRED WITH wizard_dissonance ON PURPOSE: `chi` is a two-directional counter
// with its own tick; `shift` is a domain enum on the caster with no tick at all.
// Different fields, different code paths — a defect under both surfaces twice.
//
// THE SHAPE (§8.1): ten nodes, tiers 1/2/4/6/8/10, one branch at tier 2, two
// capstones, symmetric.

export const TUNING = {
  palmDamage: 11, palmReach: 100, palmArc: 1.5, palmCd: 1100,
  // 0.004, NOT 0.010, AND THE DPS GATE NAMED THE CAUSE. This is a per-point
  // bonus on an engine that PUBLISHES up to 45 (CHI_CAP 40 plus the focus
  // step), so 0.010 is +45% on everything the Monk does — measured, exactly the
  // 42.9 / +45% outlier the gate reported.
  //
  // The first fix attempt cut branch A's damage numbers instead and moved the
  // reading by ZERO, which is the useful part: at DPS_LEVEL 12 the tier gate
  // reaches tier 4 and the two older trees fill all three slots, so none of
  // Empty Hand's ACTIVES are ever slotted in that fixture. The tier-2 passive is
  // always on regardless. A third tree's T2 passive is the one node of it the
  // DPS gate can see, and it has to be priced against what its engine publishes
  // rather than against the other trees' per-point values.
  stillnessWeight: 0.15,

  // ---- branch A: Empty Hand (no chi cost anywhere — the floor, raised) ----
  formlessDamage: 16, formlessReach: 112, formlessArc: 1.8, formlessCd: 2300,
  hollowWeight: 0.18,
  cascadeDamage: 19, cascadeArc: 1.6, cascadeRange: 285, cascadeCd: 4100,
  nothingDamage: 27, nothingReach: 140, nothingArc: 2.8, nothingCd: 7400,
  nothingPulses: 2, nothingKnock: 235,

  // ---- branch B: One Breath (the heaviest costs in the class) ----
  // NOTHING HERE DEALS DAMAGE, and §8.3 is the reason rather than a preference:
  // damage GENERATES Chi, so a skill that costs Chi and deals damage funds and
  // drains the same loop in one cast. The load assertion refused the first draft
  // of this branch for exactly that, and it was right — a Monk spending the pool
  // has to be spending it on something the pool does not immediately refill.
  gatherChi: 14, gatherAmount: 26, gatherRadius: 210, gatherPct: 75, gatherCd: 3000,
  wellWeight: 0.18,
  riverChi: 20, riverAmount: 44, riverDuration: 5000, riverPct: 55, riverCd: 4800,
  oceanChi: 30, oceanAmount: 58, oceanDuration: 5600, oceanReflect: 34, oceanPct: 40, oceanCd: 9000,

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
const CHI = { scaleWith: 'chi'};

export const MONK_EMPTY_HAND = [
  {
    id: 'monk_open_hand', tree: 'monk_empty_hand', tier: 1, name: 'Open Hand',
    desc: 'The strike that needs nothing to be true first.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.palmReach },
    cooldown: T.palmCd,
    compose: [{ kind: 'strike', damage: T.palmDamage, arc: T.palmArc, reach: T.palmReach, ...CHI, riders: {} }],
    ranks: R,
  },
  {
    id: 'monk_stillness', tree: 'monk_empty_hand', tier: 2, name: 'Stillness',
    desc: 'The pool is not the person. Both roads out of here are about being at zero.',
    type: 'passive', domain: 'mental', prereq: 'monk_open_hand',
    trigger: null, cooldown: 0, compose: [],
    passive: { chiScaleWeight: T.stillnessWeight },
    ranks: R,
  },

  // ----------------------------------- branch A: Empty Hand (costs nothing)
  {
    id: 'monk_formless', tree: 'monk_empty_hand', tier: 4, name: 'Formless',
    desc: 'Costs nothing, so a room that drained you cannot take it. This branch is the floor, raised.',
    type: 'active', domain: 'physical', prereq: 'monk_stillness',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.formlessReach },
    cooldown: T.formlessCd,
    compose: [{ kind: 'strike', damage: T.formlessDamage, arc: T.formlessArc, reach: T.formlessReach, ...CHI, riders: {} }],
    ranks: R,
  },
  {
    id: 'monk_hollow', tree: 'monk_empty_hand', tier: 6, name: 'Hollow',
    desc: 'What is empty can still be moved through.',
    type: 'passive', domain: 'mental', prereq: 'monk_formless',
    trigger: null, cooldown: 0, compose: [],
    passive: { chiScaleWeight: T.hollowWeight },
    ranks: R,
  },
  {
    id: 'monk_falling_water', tree: 'monk_empty_hand', tier: 8, name: 'Falling Water',
    desc: 'It goes where it was already going.',
    type: 'active', domain: 'physical', prereq: 'monk_hollow',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.cascadeRange, count: 2 },
    cooldown: T.cascadeCd,
    compose: [{ kind: 'cone', damage: T.cascadeDamage, arc: T.cascadeArc, range: T.cascadeRange, ...CHI, riders: {} }],
    ranks: R,
  },
  {
    id: 'monk_nothing_held', tree: 'monk_empty_hand', tier: 10, name: 'Nothing Held',
    desc: 'CAPSTONE — Empty Hand. Twice, at zero, and it did not need your permission.',
    type: 'active', domain: 'physical', prereq: 'monk_falling_water',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.nothingReach },
    cooldown: T.nothingCd,
    compose: [{
      kind: 'strike', damage: T.nothingDamage, arc: T.nothingArc, reach: T.nothingReach, ...CHI,
      riders: { multiPulse: T.nothingPulses, knockback: T.nothingKnock },
    }],
    ranks: R,
  },

  // -------------------------------- branch B: One Breath (empty on purpose)
  {
    id: 'monk_gathering', tree: 'monk_empty_hand', tier: 4, name: 'Gathering',
    desc: 'Spent by choice rather than by the room. One Breath makes the build decide when the Monk goes to zero.',
    type: 'active', domain: 'spiritual', prereq: 'monk_stillness',
    select: 'self',   // writes the caster, picks no target (§5.3)
    chi: T.gatherChi,
    trigger: { kind: 'SELF_THRESHOLD', pct: T.gatherPct },
    cooldown: T.gatherCd,
    compose: [{ kind: 'heal', amount: T.gatherAmount, radius: T.gatherRadius, ...CHI }],
    ranks: R,
  },
  {
    id: 'monk_the_well', tree: 'monk_empty_hand', tier: 6, name: 'The Well',
    desc: 'Deeper, and therefore worth more on the way down.',
    type: 'passive', domain: 'spiritual', prereq: 'monk_gathering',
    trigger: null, cooldown: 0, compose: [],
    passive: { chiScaleWeight: T.wellWeight },
    ranks: R,
  },
  {
    id: 'monk_river_turns', tree: 'monk_empty_hand', tier: 8, name: 'The River Turns',
    desc: 'A large expense, taken willingly, before the room can take it for you.',
    type: 'active', domain: 'spiritual', prereq: 'monk_the_well',
    select: 'self',   // writes the caster, picks no target (§5.3)
    chi: T.riverChi,
    trigger: { kind: 'SELF_THRESHOLD', pct: T.riverPct },
    cooldown: T.riverCd,
    compose: [{ kind: 'shield', amount: T.riverAmount, duration: T.riverDuration, ...CHI }],
    ranks: R,
  },
  {
    id: 'monk_one_breath', tree: 'monk_empty_hand', tier: 10, name: 'One Breath',
    desc: 'CAPSTONE — One Breath. The whole pool at once, because you chose the moment, and what strikes it is struck back.',
    type: 'active', domain: 'spiritual', prereq: 'monk_river_turns',
    select: 'self',   // writes the caster, picks no target (§5.3)
    chi: T.oceanChi,
    trigger: { kind: 'SELF_THRESHOLD', pct: T.oceanPct },
    cooldown: T.oceanCd,
    compose: [{ kind: 'ward', amount: T.oceanAmount, duration: T.oceanDuration, reflectPct: T.oceanReflect, ...CHI }],
    ranks: R,
  },
];
