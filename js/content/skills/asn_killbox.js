// ASSASSIN — Killbox tree.
//
// THE CLASS ENGINE, EXPRESSED AS CONTENT. §8.3 gives the Assassin "killbox —
// traps placed inert, detonating when other skills fire nearby", and the write
// path is the `trap` primitive (§5.7's thirteenth, ruled and gated before this
// file existed). Nothing here is engine code: a trap is a compose step, and the
// resource it builds is `p.engines.killbox`, published in one line.
//
// THE DECISION IS POSITIONAL AND IT HAPPENS BEFORE THE FIGHT. Every other engine
// in the game is banked by acting — casts made, damage taken, marks placed,
// animals kept alive. A killbox is banked by being SOMEWHERE, and it pays out
// only if the fight comes to it. An Assassin who sets four traps and then gets
// pulled twenty metres away has spent four casts on nothing.
//
// AND THE DETONATION IS AUTOMATIC, WHICH IS WHAT MAKES IT A KILLBOX RATHER THAN
// A BOMB. The player does not choose when a trap goes off; ANY skill fired
// inside the range sets off everything nearby at once. So the Assassin cannot
// hold a full field and keep fighting in it — the first cast cashes the ground
// it is standing on. Holding the box means standing OUT of it, and that is the
// tension the whole tree is authored against: `scaleWith: 'killbox'` skills are
// strongest exactly when the Assassin is somewhere its traps are not.
//
// A trap step never sets off other traps. Laying a second one inside a killbox
// would cash the first on the way down, and the class would never hold more than
// one — see `fireSkill`.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Shiv
  shivDamage: 6, shivReach: 100, shivArc: 1.6, shivRadius: 126, shivCount: 1, shivCd: 1150,
  // tier 2 — Caltrops
  caltropDamage: 11, caltropRadius: 88, caltropDuration: 14000, caltropCd: 3000,
  // tier 3 — Cold Read
  readDamage: 8, readSpeed: 520, readRange: 250, readCd: 2800, readPer: 0.05,
  // tier 4 — Tripwire
  tripDamage: 14, tripRadius: 96, tripDuration: 14000, tripCd: 4200,
  // tier 5 — Dead Ground (passive)
  deadPer: 0.02,
  // tier 6 — Garrote
  garroteDamage: 10, garroteReach: 106, garroteArc: 1.7, garroteRadius: 134,
  garroteCount: 1, garroteCd: 3400, garrotePer: 0.055, garroteRoot: 1300,
  // tier 7 — Pressure Plate
  plateDamage: 17, plateRadius: 104, plateDuration: 14000, plateCd: 5400,
  // tier 8 — Blind Angle
  blindDamage: 10, blindWidth: 32, blindLength: 345, blindRadius: 195,
  blindCount: 2, blindCd: 4600, blindPer: 0.06,
  // tier 9 — Quiet Exit
  exitAmount: 24, exitDuration: 4600, exitCd: 7400, exitPer: 0.06,
  // tier 10 — The Room You Chose
  roomDamage: 12, roomAngle: 2.6, roomRange: 245, roomRadius: 205,
  roomCount: 3, roomCd: 9000, roomPer: 0.075, roomStun: 620,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const ASN_KILLBOX = [
  {
    id: 'asn_shiv', tree: 'asn_killbox', tier: 1, name: 'Shiv',
    desc: 'A short quiet cut at whatever came close. Deals 6 damage in a 1.6-radian arc.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.shivRadius, count: T.shivCount },
    cooldown: T.shivCd,
    compose: [{ kind: 'strike', damage: T.shivDamage, reach: T.shivReach, arc: T.shivArc, riders: {} }],
    ranks: R,
  },
  {
    // THE ENGINE, TIER 2 — the same placement as shift, mark, Quickstep, Facet
    // Strike, Pin and Souse. A class should not spend a third of a run being a
    // worse version of another one.
    //
    // The trap's damage is roughly double a comparable direct hit BECAUSE the
    // player pays for it twice: once in the cast that places it, and again in
    // standing somewhere the fight has to come to.
    id: 'asn_caltrops', tree: 'asn_killbox', tier: 2, name: 'Caltrops',
    desc: 'Lays an inert trap where you are looking. It sits for 14s and goes off for 11 when you fight beside it.',
    type: 'active', domain: 'physical', prereq: 'asn_shiv',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.shivRadius, count: T.shivCount },
    cooldown: T.caltropCd,
    compose: [{
      kind: 'trap', damage: T.caltropDamage, radius: T.caltropRadius, duration: T.caltropDuration,
    }],
    ranks: R,
  },
  {
    id: 'asn_cold_read', tree: 'asn_killbox', tier: 3, name: 'Cold Read',
    desc: 'A thrown blade that is surer the more ground you have prepared. 8 damage, +5% per trap set.',
    type: 'active', domain: 'mental', prereq: 'asn_caltrops',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.readRange },
    cooldown: T.readCd,
    compose: [{
      kind: 'bolt', damage: T.readDamage, speed: T.readSpeed, range: T.readRange,
      scaleWith: 'killbox', scalePer: T.readPer, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'asn_tripwire', tree: 'asn_killbox', tier: 4, name: 'Tripwire',
    desc: 'A heavier charge on a wider footprint. Sits for 14s and goes off for 14.',
    type: 'active', domain: 'physical', prereq: 'asn_cold_read',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.shivRadius, count: T.shivCount },
    cooldown: T.tripCd,
    compose: [{
      kind: 'trap', damage: T.tripDamage, radius: T.tripRadius, duration: T.tripDuration,
    }],
    ranks: R,
  },
  {
    id: 'asn_dead_ground', tree: 'asn_killbox', tier: 5, name: 'Dead Ground',
    desc: 'Every trap you have set is worth 2% more to every skill that reads them.',
    type: 'passive', domain: 'mental', prereq: 'asn_tripwire',
    trigger: null, cooldown: 0, compose: [],
    passive: { killboxDamageBonus: T.deadPer },
    // Classified 'damage' in PASSIVE_EFFECT, so it is an INVESTMENT and ranks —
    // the same shape as Held Edge, Sympathetic Resonance, Attend the Fallen,
    // Perfect Time, Lattice, Sympathetic Binding and Tidemark.
    ranks: { damage: T.rankDamage },
  },
  {
    id: 'asn_garrote', tree: 'asn_killbox', tier: 6, name: 'Garrote',
    desc: 'Holds one thing still for 1.3s. 10 damage, +5.5% per trap set.',
    type: 'active', domain: 'physical', prereq: 'asn_dead_ground',
    select: 'lowest_hp',
    trigger: { kind: 'PROXIMITY', radius: T.garroteRadius, count: T.garroteCount },
    cooldown: T.garroteCd,
    compose: [{
      kind: 'strike', damage: T.garroteDamage, reach: T.garroteReach, arc: T.garroteArc,
      scaleWith: 'killbox', scalePer: T.garrotePer,
      riders: { root: T.garroteRoot },
    }],
    ranks: R,
  },
  {
    id: 'asn_pressure_plate', tree: 'asn_killbox', tier: 7, name: 'Pressure Plate',
    desc: 'The biggest charge the kit carries. Sits for 14s and goes off for 17.',
    type: 'active', domain: 'physical', prereq: 'asn_garrote',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.shivRadius, count: T.shivCount },
    cooldown: T.plateCd,
    compose: [{
      kind: 'trap', damage: T.plateDamage, radius: T.plateRadius, duration: T.plateDuration,
    }],
    ranks: R,
  },
  {
    id: 'asn_blind_angle', tree: 'asn_killbox', tier: 8, name: 'Blind Angle',
    desc: 'A line thrown from where they are not looking. 10 damage, +6% per trap set.',
    type: 'active', domain: 'mental', prereq: 'asn_pressure_plate',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.blindRadius, count: T.blindCount },
    cooldown: T.blindCd,
    compose: [{
      kind: 'line', damage: T.blindDamage, width: T.blindWidth, length: T.blindLength,
      scaleWith: 'killbox', scalePer: T.blindPer, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'asn_quiet_exit', tree: 'asn_killbox', tier: 9, name: 'Quiet Exit',
    desc: 'Absorbs 24 over 4.6s, +6% per trap set, when you drop below 50% health.',
    type: 'active', domain: 'mental', prereq: 'asn_blind_angle',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 50 },
    cooldown: T.exitCd,
    compose: [{
      kind: 'shield', amount: T.exitAmount, duration: T.exitDuration,
      scaleWith: 'killbox', scalePer: T.exitPer,
    }],
    ranks: R,
  },
  {
    // The capstone reads the field and does NOT set it off — it is a cone, and a
    // cone fires from the Assassin. Cast it standing in the box and the box goes
    // off first; cast it standing outside and it lands at full strength with the
    // ground still armed. That is the whole class in one node.
    id: 'asn_the_room_you_chose', tree: 'asn_killbox', tier: 10, name: 'The Room You Chose',
    desc: 'Everything you prepared, at once. 12 damage in a wide fan, +7.5% per trap set, and what it touches is stunned for 0.62s.',
    type: 'active', domain: 'physical', prereq: 'asn_quiet_exit',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.roomRadius, count: T.roomCount },
    cooldown: T.roomCd,
    compose: [{
      kind: 'cone', damage: T.roomDamage, angle: T.roomAngle, range: T.roomRange,
      scaleWith: 'killbox', scalePer: T.roomPer,
      riders: { stun: T.roomStun },
    }],
    ranks: R,
  },
];
