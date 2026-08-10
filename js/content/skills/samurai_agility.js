// SAMURAI — Agility. The first BRANCHING tree, and the proving ground for the
// §8.1 shape spec every remaining tree will be authored against.
//
// WHY THE SAMURAI, AND WHY THIS GAP. Armor and Tactics are both Footing trees:
// one converts holding ground into survival, the other into output. The class
// therefore had one engine wearing two coats and no answer at all to the
// question the engine poses — what do you do when you have to move? §8.2 has
// named the third tree `Agility` since phase 2, and it is the only gap on the
// roster where the missing tree is the missing ANSWER rather than a missing
// theme.
//
// AGILITY IS NOT A SECOND ENGINE. §8.3 gives the Samurai exactly one, and a
// tree that invented a rival resource would make the class two classes. What
// this tree buys instead is the right to keep Footing while moving: its
// passives feed `footingAccrualPct` and `footingDamageBonus`, the same keys
// Armor and Tactics read, so nothing here needs a line of engine code. The
// fantasy is a swordsman who does not have to choose between standing and
// striking — which is exactly the tension the other two trees create.
//
// ---------------------------------------------------------------- THE SHAPE
//
// Ten nodes, tiers 1/2/4/6/8/10, two branches from tier 2:
//
//        T1            Quickstep                (the §5.6 opening, damaging)
//         |
//        T2            Light Feet               <- THE BRANCH POINT
//                     /           \
//        T4    Running Cut       Slip Cut
//        T6    Gale Step         Dancing Edge
//        T8    Hundred Paces     Crescent
//        T10   Windwalk          Moonfall       (a capstone on each branch)
//
// SYMMETRIC ON PURPOSE. An asymmetric tree — one long branch carrying the only
// capstone — is not a choice, it is a main line with a detour. Both branches are
// four nodes deep and both terminate at tier 10, so the decision at tier 2 is
// which capstone you reach first rather than which one you give up. §8.1 rules
// that branching is organisation and dependency, not exclusion: with ~69 points
// against 30 nodes a player eventually owns both sides, and what the branch buys
// is the ORDER, which at one point per level is most of the run.
//
// THE TIERS ARE SPARSE, AND THAT IS THE WHOLE REASON THE SHAPE WORKS. Ten nodes
// across ten dense tiers is one node per tier, which is a chain — the shape spec
// and the tier table are in direct conflict unless a tree may skip tiers. Tier
// is a LEVEL GATE (§8.1.1), not a depth counter, so this tree spends its ten
// nodes on six of the ten gates and the branches run in parallel through them.
// The two capstones sit at tier 10 and unlock at level 60, late in floor 4,
// which is what the gate table exists to produce.
//
// GALE answers movement with more movement: every active here fires on the
// MOVEMENT trigger in `moving` mode, so the branch pays out exactly while the
// Footing engine is paying nothing. EDGE answers it with a counter: every active
// fires on ON_DODGE, so the branch turns the one moment you were forced to move
// into the moment you hit hardest. Same problem, two readings.

export const TUNING = {
  // tier 1 — Quickstep
  quickDamage: 9, quickReach: 100, quickArc: 1.4, quickCd: 1100, quickMove: 0.35,
  // tier 2 — Light Feet (passive, the branch point)
  lightAccrual: 0.20,

  // ---- branch A: Gale ----
  // tier 4 — Running Cut
  runDamage: 12, runReach: 105, runArc: 1.6, runCd: 2600, runMove: 0.6, runPulses: 2,
  // tier 6 — Gale Step (passive)
  galeAccrual: 0.30,
  // tier 8 — Hundred Paces
  hundredDamage: 15, hundredRange: 300, hundredArc: 1.1, hundredCd: 4200, hundredMove: 1.0,
  // tier 10 — Windwalk (capstone)
  windDamage: 22, windReach: 135, windArc: 2.8, windRadius: 135, windCount: 4,
  windPulses: 2, windCd: 9000, windMove: 1.4, windKnock: 260,

  // ---- branch B: Edge ----
  // tier 4 — Slip Cut
  slipDamage: 16, slipReach: 100, slipArc: 1.3, slipCd: 2400, slipWindow: 900,
  // tier 6 — Dancing Edge (passive)
  dancePerStack: 0.012,
  // tier 8 — Crescent
  crescentDamage: 19, crescentReach: 120, crescentArc: 2.6, crescentCd: 4600, crescentWindow: 1000,
  // tier 10 — Moonfall (capstone)
  moonDamage: 30, moonReach: 130, moonArc: 1.5, moonRadius: 120, moonCount: 3,
  moonCd: 9500, moonWindow: 1100, moonStun: 750,

  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
// Agility skills scale on Footing like the rest of the class — the point of the
// tree is that you keep the stance, not that you trade it away.
const FOOT = { scaleWith: 'footing', scalePer: 0.05 };

export const SAMURAI_AGILITY = [
  // ------------------------------------------------------------------ root
  {
    id: 'sam_quickstep', tree: 'samurai_agility', tier: 1, name: 'Quickstep',
    desc: 'A cut thrown mid-stride. The first thing this tree teaches is that moving is not the same as retreating.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'MOVEMENT', mode: 'moving', seconds: T.quickMove },
    cooldown: T.quickCd,
    compose: [{ kind: 'strike', damage: T.quickDamage, arc: T.quickArc, reach: T.quickReach, ...FOOT, riders: {} }],
    ranks: R,
  },

  // ------------------------------------------------- the branch point (T2)
  {
    id: 'sam_light_feet', tree: 'samurai_agility', tier: 2, name: 'Light Feet',
    desc: 'The stance settles faster when you have been moving. Both roads out of this node lead somewhere; the choice is which one first.',
    type: 'passive', domain: 'physical', prereq: 'sam_quickstep',
    trigger: null, cooldown: 0, compose: [],
    passive: { footingAccrualPct: T.lightAccrual },
    maxRank: 1,          // §1.3: an unlock, not an investment
    ranks: R,
  },

  // ----------------------------------------------------- branch A: Gale ---
  {
    id: 'sam_running_cut', tree: 'samurai_agility', tier: 4, name: 'Running Cut',
    desc: 'Two cuts on the move. Gale pays out precisely while the Footing engine is paying nothing.',
    type: 'active', domain: 'physical', prereq: 'sam_light_feet',
    select: 'objective_target',
    trigger: { kind: 'MOVEMENT', mode: 'moving', seconds: T.runMove },
    cooldown: T.runCd,
    compose: [{ kind: 'strike', damage: T.runDamage, arc: T.runArc, reach: T.runReach, ...FOOT, riders: { multiPulse: T.runPulses } }],
    ranks: R,
  },
  {
    id: 'sam_gale_step', tree: 'samurai_agility', tier: 6, name: 'Gale Step',
    desc: 'Ground taken at speed is ground held. The stance recovers faster still.',
    type: 'passive', domain: 'physical', prereq: 'sam_running_cut',
    trigger: null, cooldown: 0, compose: [],
    passive: { footingAccrualPct: T.galeAccrual },
    maxRank: 1,
    ranks: R,
  },
  {
    id: 'sam_hundred_paces', tree: 'samurai_agility', tier: 8, name: 'Hundred Paces',
    desc: 'The cut arrives before you do.',
    type: 'active', domain: 'physical', prereq: 'sam_gale_step',
    select: 'objective_target',
    trigger: { kind: 'MOVEMENT', mode: 'moving', seconds: T.hundredMove },
    cooldown: T.hundredCd,
    compose: [{ kind: 'cone', damage: T.hundredDamage, arc: T.hundredArc, range: T.hundredRange, ...FOOT, riders: {} }],
    ranks: R,
  },
  {
    id: 'sam_windwalk', tree: 'samurai_agility', tier: 10, name: 'Windwalk',
    desc: 'CAPSTONE — Gale. Everything within reach is thrown clear, twice, and you have not stopped once.',
    type: 'active', domain: 'physical', prereq: 'sam_hundred_paces',
    select: 'objective_target',
    trigger: { kind: 'MOVEMENT', mode: 'moving', seconds: T.windMove },
    cooldown: T.windCd,
    compose: [{
      kind: 'strike', damage: T.windDamage, arc: T.windArc, reach: T.windReach, ...FOOT,
      riders: { multiPulse: T.windPulses, knockback: T.windKnock },
    }],
    ranks: R,
  },

  // ----------------------------------------------------- branch B: Edge ---
  {
    id: 'sam_slip_cut', tree: 'samurai_agility', tier: 4, name: 'Slip Cut',
    desc: 'The answer to being moved. Edge turns the one moment you had no choice into the one that hits hardest.',
    type: 'active', domain: 'physical', prereq: 'sam_light_feet',
    select: 'objective_target',
    trigger: { kind: 'ON_DODGE', window: T.slipWindow },
    cooldown: T.slipCd,
    compose: [{ kind: 'strike', damage: T.slipDamage, arc: T.slipArc, reach: T.slipReach, ...FOOT, riders: {} }],
    ranks: R,
  },
  {
    id: 'sam_dancing_edge', tree: 'samurai_agility', tier: 6, name: 'Dancing Edge',
    desc: 'Every stack of Footing you kept through the dodge sharpens what comes out of it.',
    type: 'passive', domain: 'physical', prereq: 'sam_slip_cut',
    trigger: null, cooldown: 0, compose: [],
    passive: { footingDamageBonus: T.dancePerStack },
    ranks: R,
  },
  {
    id: 'sam_crescent', tree: 'samurai_agility', tier: 8, name: 'Crescent',
    desc: 'A wide arc off the back foot.',
    type: 'active', domain: 'physical', prereq: 'sam_dancing_edge',
    select: 'objective_target',
    trigger: { kind: 'ON_DODGE', window: T.crescentWindow },
    cooldown: T.crescentCd,
    compose: [{ kind: 'strike', damage: T.crescentDamage, arc: T.crescentArc, reach: T.crescentReach, ...FOOT, riders: {} }],
    ranks: R,
  },
  {
    id: 'sam_moonfall', tree: 'samurai_agility', tier: 10, name: 'Moonfall',
    desc: 'CAPSTONE — Edge. Whatever made you move is on the ground.',
    type: 'active', domain: 'physical', prereq: 'sam_crescent',
    select: 'objective_target',
    trigger: { kind: 'ON_DODGE', window: T.moonWindow },
    cooldown: T.moonCd,
    compose: [{
      kind: 'strike', damage: T.moonDamage, arc: T.moonArc, reach: T.moonReach, ...FOOT,
      riders: { stun: T.moonStun },
    }],
    ranks: R,
  },
];
