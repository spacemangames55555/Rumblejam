// WITCH DOCTOR — Effigy tree.
//
// THE CLASS ENGINE, EXPRESSED AS CONTENT. §8.3: "voodoo doll — damage to a doll
// mirrors onto a distant target." The mirror was already live before this file
// existed — `voodooMirror` has sent 35% of everything the Witch Doctor deals
// onto `p.voodooId`, through walls and across the map, since the trait era. What
// did NOT exist was the choice of doll, and that is the `doll` rider (§5.7
// condition 2: it writes at the moment of impact, so a rider will do and a
// thirteenth primitive was never needed).
//
// WHAT THE RIDER BOUGHT. `tickVoodoo` binds the NEAREST enemy and rebinds on
// death or drift, so before this the doll was whatever trash happened to be
// closest, and the class's whole fantasy — pour damage into a doll and have it
// come out of something that matters — was unreachable. Now a designating cast
// names the target, and the tree's selectors are how the player says which:
// `wd_pin` takes `highest_hp`, so it pins the elite in the room.
//
// THE ENGINE IS THE DEBT, AND IT DIES WITH THE DOLL. `p.engines.doll` is what
// the bound enemy has absorbed, capped, and it zeroes the moment the link
// rebinds. Every point in it arrived as damage to the doll — so the Witch Doctor
// is always killing the thing it is loading, and the payoff is in the window
// before it dies. Marks pay out on death (§8.3, the Priest); THE DOLL PAYS OUT
// BY STAYING ALIVE, which is the opposite half of the same idea and is what
// keeps the two engines from being the same engine.
//
// So designation is deliberately STICKY — the rider binds only when the slot is
// open. A rider that re-designated on every hit would reset the bank on every
// swing, and the class would never accumulate anything.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Bone Rattle
  rattleDamage: 6, rattleReach: 100, rattleArc: 1.7, rattleRadius: 128,
  rattleCount: 1, rattleCd: 1200,
  // tier 2 — Pin
  pinDamage: 7, pinSpeed: 500, pinRange: 255, pinCd: 2600,
  // tier 3 — Sympathetic Ache
  acheDamage: 8, acheSpeed: 520, acheRange: 250, acheCd: 3000, achePer: 0.05,
  // tier 4 — Needlework
  needleDamage: 9, needleReach: 108, needleArc: 1.9, needleRadius: 138,
  needleCount: 2, needleCd: 3600, needlePer: 0.055,
  needleDefMult: 0.78, needleDefDur: 2400,
  // tier 5 — Sympathetic Binding (passive)
  bindingPer: 0.02,
  // tier 6 — Hollow Man
  hollowAmount: 22, hollowDuration: 4600, hollowCd: 7200, hollowPer: 0.06,
  // tier 7 — Second Skin
  skinDamage: 10, skinAngle: 1.9, skinRange: 225, skinRadius: 180,
  skinCount: 3, skinCd: 4600, skinPer: 0.06,
  // tier 8 — Crooked Thread
  threadDamage: 10, threadWidth: 34, threadLength: 355, threadRadius: 200,
  threadCount: 3, threadCd: 5400, threadPer: 0.065, threadRoot: 1300,
  // tier 9 — What the Doll Knows
  knowsDamage: 11, knowsSpeed: 530, knowsRange: 260, knowsPct: 50,
  knowsCd: 5000, knowsPer: 0.07,
  // tier 10 — Everything It Held
  heldDamage: 15, heldAngle: 2.7, heldRange: 245, heldRadius: 210,
  heldCount: 4, heldCd: 9500, heldPer: 0.08, heldStun: 650,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const WD_EFFIGY = [
  {
    id: 'wd_bone_rattle', tree: 'wd_effigy', tier: 1, name: 'Bone Rattle',
    desc: 'A rattle of charms at whatever came close. Deals 6 damage in a 1.7-radian arc.',
    type: 'active', domain: 'spiritual', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.rattleRadius, count: T.rattleCount },
    cooldown: T.rattleCd,
    compose: [{ kind: 'strike', damage: T.rattleDamage, reach: T.rattleReach, arc: T.rattleArc, riders: {} }],
    ranks: R,
  },
  {
    // THE ENGINE, TIER 2 — the same placement as shift, mark, Quickstep and
    // Facet Strike, for the same reason. And the SELECTOR is the whole point:
    // `highest_hp` names the fattest thing in range, so the pin goes into the
    // elite rather than into whatever the auto-bind would have grabbed.
    id: 'wd_pin', tree: 'wd_effigy', tier: 2, name: 'Pin',
    desc: 'Names the fattest thing in range as your doll. Everything you deal to anything else bleeds into it. Deals 7 damage.',
    type: 'active', domain: 'spiritual', prereq: 'wd_bone_rattle',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.pinRange },
    cooldown: T.pinCd,
    compose: [{
      kind: 'bolt', damage: T.pinDamage, speed: T.pinSpeed, range: T.pinRange,
      riders: { doll: true },
    }],
    ranks: R,
  },
  {
    id: 'wd_sympathetic_ache', tree: 'wd_effigy', tier: 3, name: 'Sympathetic Ache',
    desc: 'Hurts more the more the doll is carrying. 8 damage, +5% per point banked.',
    type: 'active', domain: 'mental', prereq: 'wd_pin',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.acheRange },
    cooldown: T.acheCd,
    compose: [{
      kind: 'bolt', damage: T.acheDamage, speed: T.acheSpeed, range: T.acheRange,
      scaleWith: 'doll', scalePer: T.achePer, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'wd_needlework', tree: 'wd_effigy', tier: 4, name: 'Needlework',
    desc: 'Close work that opens a seam — what it touches takes 22% more for 2.4s. 9 damage, +5.5% per point banked.',
    type: 'active', domain: 'physical', prereq: 'wd_sympathetic_ache',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.needleRadius, count: T.needleCount },
    cooldown: T.needleCd,
    compose: [{
      kind: 'strike', damage: T.needleDamage, reach: T.needleReach, arc: T.needleArc,
      scaleWith: 'doll', scalePer: T.needlePer,
      riders: { weakenDefense: { mult: T.needleDefMult, dur: T.needleDefDur } },
    }],
    ranks: R,
  },
  {
    id: 'wd_sympathetic_binding', tree: 'wd_effigy', tier: 5, name: 'Sympathetic Binding',
    desc: 'Everything the doll is carrying is worth 2% more to every skill that reads it.',
    type: 'passive', domain: 'spiritual', prereq: 'wd_needlework',
    trigger: null, cooldown: 0, compose: [],
    passive: { dollDamageBonus: T.bindingPer },
    // Classified 'damage' in PASSIVE_EFFECT, so it is an INVESTMENT and ranks —
    // the same shape as Held Edge, Sympathetic Resonance, Attend the Fallen,
    // Perfect Time and Lattice.
    ranks: { damage: T.rankDamage },
  },
  {
    id: 'wd_hollow_man', tree: 'wd_effigy', tier: 6, name: 'Hollow Man',
    desc: 'The doll takes it instead. Absorbs 22 over 4.6s, +6% per point banked, below 55% health.',
    type: 'active', domain: 'spiritual', prereq: 'wd_sympathetic_binding',
    select: 'nearest',
    trigger: { kind: 'SELF_THRESHOLD', pct: 55 },
    cooldown: T.hollowCd,
    compose: [{
      kind: 'shield', amount: T.hollowAmount, duration: T.hollowDuration,
      scaleWith: 'doll', scalePer: T.hollowPer,
    }],
    ranks: R,
  },
  {
    id: 'wd_second_skin', tree: 'wd_effigy', tier: 7, name: 'Second Skin',
    desc: 'A fan of borrowed pain. 10 damage, +6% per point banked.',
    type: 'active', domain: 'mental', prereq: 'wd_hollow_man',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.skinRadius, count: T.skinCount },
    cooldown: T.skinCd,
    compose: [{
      kind: 'cone', damage: T.skinDamage, angle: T.skinAngle, range: T.skinRange,
      scaleWith: 'doll', scalePer: T.skinPer, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'wd_crooked_thread', tree: 'wd_effigy', tier: 8, name: 'Crooked Thread',
    desc: 'A line of stitching that holds what it crosses for 1.3s. 10 damage, +6.5% per point banked.',
    type: 'active', domain: 'spiritual', prereq: 'wd_second_skin',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.threadRadius, count: T.threadCount },
    cooldown: T.threadCd,
    compose: [{
      kind: 'line', damage: T.threadDamage, width: T.threadWidth, length: T.threadLength,
      scaleWith: 'doll', scalePer: T.threadPer,
      riders: { root: T.threadRoot },
    }],
    ranks: R,
  },
  {
    id: 'wd_what_the_doll_knows', tree: 'wd_effigy', tier: 9, name: 'What the Doll Knows',
    desc: 'Finishes what is nearly gone. 11 damage below 50% health, +7% per point banked.',
    type: 'active', domain: 'mental', prereq: 'wd_crooked_thread',
    select: 'lowest_hp',
    trigger: { kind: 'TARGET_THRESHOLD', pct: T.knowsPct, range: T.knowsRange },
    cooldown: T.knowsCd,
    compose: [{
      kind: 'bolt', damage: T.knowsDamage, speed: T.knowsSpeed, range: T.knowsRange,
      scaleWith: 'doll', scalePer: T.knowsPer, riders: {},
    }],
    ranks: R,
  },
  {
    // The steepest doll scaling in the tree on its longest cooldown, and the two
    // together are the class's whole clock: this is what a full doll is FOR, and
    // the doll is dying the entire time you are loading it.
    id: 'wd_everything_it_held', tree: 'wd_effigy', tier: 10, name: 'Everything It Held',
    desc: 'The doll gives it all back at once. 15 damage in a wide fan, +8% per point banked, and what it touches is stunned for 0.65s.',
    type: 'active', domain: 'spiritual', prereq: 'wd_what_the_doll_knows',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.heldRadius, count: T.heldCount },
    cooldown: T.heldCd,
    compose: [{
      kind: 'cone', damage: T.heldDamage, angle: T.heldAngle, range: T.heldRange,
      scaleWith: 'doll', scalePer: T.heldPer,
      riders: { stun: T.heldStun },
    }],
    ranks: R,
  },
];
