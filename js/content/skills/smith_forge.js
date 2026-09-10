// BLACKSMITH — Forge tree. THE TANK.
//
// Restructured 2026-09-10 to Casey's ruling. It was the half that read no
// engine — Tank and DPS folded together, "the heavy end of a Blacksmith who
// never transforms". It is now the tank tree proper: Celestial Calcite is its
// form, and four of its ten nodes exist to make enemies attack the Blacksmith
// instead of somebody squishier.
//
// SURVIVING IS NOT TANKING, which is the whole reason this tree changed. The
// class had one threat tool — Standing Order, a cone that taunts when you are
// hit — against four wards, a shield, armour passives and a heal. In an
// eight-player party a Blacksmith who cannot pull enemies OFF the other seven
// is a durable damage dealer, not a tank.
//
// THE STATUE TEST GOVERNS ALL THREE NEW NODES. Every one of them deals zero
// damage, stated rather than defaulted. That is what kept Marrownaut honest and
// it is what keeps a permanent aggro field honest here: a stationary Blacksmith
// with the whole room walking at it clears none of it.
//
// THE PULL RADIUS IS NOT THIS FILE'S TO CHOOSE. It reads CONFIG.TANK_PULL, the
// same constant Marrownaut reads, because a per-class tank radius means "who
// tanks better" gets settled by whoever authored the larger number.
//
// EVERY OTHER NUMBER IN THIS FILE LIVES IN TUNING.

import { TANK_PULL } from '../../config.js';

export const TUNING = {
  // tier 1 — Tongs
  tongsDamage: 7, tongsReach: 92, tongsArc: 1.4, tongsRadius: 118, tongsCount: 1, tongsCd: 1100,
  // tier 2 — Deadweight (passive)
  deadGrit: 7,
  // tier 4 — Cold Work, moved in from Anvil with its numbers unchanged
  coldDamage: 16, coldReach: 115, coldArc: 1.9, coldCd: 2400,
  // tier 4 — Bellows
  bellowsAmount: 22, bellowsDuration: 4800, bellowsCd: 5400,
  // tier 6 — Din. The sustained pull. Radius/tick/hold come from CONFIG.
  // tier 6 — Quenching, moved in from Anvil. Renamed keys: `quench*` belonged
  // to the old Quench cone, which left this tree, and two different skills
  // sharing `quenchCd` is how a tuning value gets edited for the wrong one.
  temperAmount: 34, temperDuration: 4600, temperPct: 60, temperCd: 5000,
  // tier 8 — Standing Order
  orderDamage: 10, orderAngle: 2.0, orderRange: 200, orderCd: 3800, orderTaunt: 1600,
  // tier 8 — Long Tongs. THE REACH TAUNT, and its length is deliberate.
  // The spec proposed 250-300; every line in the shipped roster is 320-430, so
  // 270 would have made the class's one long-range grab the SHORTEST line in
  // the game by fifty pixels, which is backwards for the tool whose whole job
  // is reaching something that walked past. 320 is the floor of the real band —
  // hun_raking_shot, monk_snare_line and necro_wrecking_ball all sit there.
  // Width matches those two at 60: a taunt wants to catch a file of enemies
  // walking by, not thread one.
  longLength: 320, longWidth: 60, longTaunt: 1800, longCd: 4400,
  // tier 10 — Call the Room. THE EMERGENCY RE-GRAB. A line rather than a
  // full-circle strike: the failure it answers is the party losing a lane, and
  // a nova centred on the tank pulls hardest exactly where the tank already
  // holds. Longer and wider than Long Tongs, on a capstone cooldown.
  roomLength: 380, roomWidth: 66, roomTaunt: 2600, roomCd: 8200,
  // tier 10 — Celestial Calcite, moved in from Crystal. Stats unchanged.
  calciteRec: 40, calciteVit: 24,

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const SMITH_FORGE = [
  {
    id: 'smith_tongs', tree: 'smith_forge', tier: 1, name: 'Tongs',
    flavor: 'Close and unglamorous.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.tongsRadius, count: T.tongsCount },
    cooldown: T.tongsCd,
    compose: [{ kind: 'strike', damage: T.tongsDamage, reach: T.tongsReach, arc: T.tongsArc, riders: {} }],
    ranks: R,
  },
  {
    id: 'smith_deadweight', tree: 'smith_forge', tier: 2, name: 'Deadweight',
    flavor: 'Nothing moves you and nothing ever has.',
    type: 'passive', domain: 'physical', prereq: 'smith_tongs',
    passive: { armorGrit: T.deadGrit },
    maxRank: 1,
  },
  {
    // NOT GATED ON THE ABSENCE OF A FORM, and this is deliberate — do not add
    // `form: 'none'` back. A Cold Iron skill fires whether or not a form is
    // slotted; what makes it a no-form skill is that it carries no `scaleWith`,
    // so a form pays it nothing and it is strong at baseline instead.
    id: 'smith_cold_work', tree: 'smith_forge', tier: 4, name: 'Cold Work',
    flavor: 'Shaping without heat. It does not care what you are wearing.',
    type: 'active', domain: 'physical', prereq: 'smith_deadweight',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.coldReach },
    cooldown: T.coldCd,
    compose: [{ kind: 'strike', damage: T.coldDamage, arc: T.coldArc, reach: T.coldReach, riders: {} }],
    ranks: R,
  },
  {
    id: 'smith_bellows', tree: 'smith_forge', tier: 4, name: 'Bellows',
    type: 'active', domain: 'spiritual', prereq: 'smith_deadweight',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 65 },
    cooldown: T.bellowsCd,
    compose: [{ kind: 'ward', amount: T.bellowsAmount, duration: T.bellowsDuration }],
    ranks: R,
  },
  {
    // THE SUSTAINED PULL, and it is Marrownaut's shape rather than a second
    // answer to the same question: a persistent zero-damage aura carrying a
    // taunt, entering through the `persist` door, resolving at position 3 in
    // tauntTarget() — below every cast taunt and the Mirage decoy, above the
    // relic carrier. A permanent state must never silently override another
    // player's spent cast.
    id: 'smith_din', tree: 'smith_forge', tier: 6, name: 'Din',
    flavor: 'The shop is loud. Everything in it is looking at you.',
    type: 'active', domain: 'physical', prereq: 'smith_cold_work',
    select: 'self',
    // ZERO DAMAGE, STATED. The pull is the whole effect.
    persist: { aura: { radius: TANK_PULL.radius, pulseMs: TANK_PULL.pulseMs, taunt: TANK_PULL.hold } },
    maxRank: 1,
  },
  {
    id: 'smith_quenching', tree: 'smith_forge', tier: 6, name: 'Quenching',
    flavor: 'Tempering competes with the forms for the same low-health moment: spend it becoming something, or spend it on this.',
    type: 'active', domain: 'physical', prereq: 'smith_bellows',
    select: 'self',
    trigger: { kind: 'SELF_THRESHOLD', pct: T.temperPct },
    cooldown: T.temperCd,
    compose: [{ kind: 'shield', amount: T.temperAmount, duration: T.temperDuration, scaleWith: 'form' }],
    ranks: R,
  },
  {
    id: 'smith_standing_order', tree: 'smith_forge', tier: 8, name: 'Standing Order',
    type: 'active', domain: 'spiritual', prereq: 'smith_din',
    select: 'densest_cluster',
    trigger: { kind: 'ON_HIT_TAKEN' },
    cooldown: T.orderCd,
    compose: [{
      kind: 'cone', damage: T.orderDamage, angle: T.orderAngle, range: T.orderRange,
      riders: { taunt: T.orderTaunt },
    }],
    ranks: R,
  },
  {
    // THE REACH TAUNT. A line rather than a cone because the failure it fixes is
    // one enemy walking PAST toward a named ally, and that is a direction rather
    // than a spread. Zero damage: a threat tool that also kills is a damage
    // skill wearing a taunt.
    id: 'smith_long_tongs', tree: 'smith_forge', tier: 8, name: 'Long Tongs',
    flavor: 'Whatever thought it was going somewhere else.',
    type: 'active', domain: 'physical', prereq: 'smith_quenching',
    select: 'farthest',
    trigger: { kind: 'NEAREST', range: T.longLength },
    cooldown: T.longCd,
    compose: [{ kind: 'line', damage: 0, length: T.longLength, width: T.longWidth, riders: { taunt: T.longTaunt } }],
    ranks: { duration: T.rankDuration },
  },
  {
    // TREE-SCOPED: this form pays smith_forge and nothing else.
    id: 'smith_celestial_calcite', tree: 'smith_forge', tier: 10, name: 'Celestial Calcite',
    type: 'active', domain: 'spiritual', prereq: 'smith_standing_order',
    select: 'self',
    maxRank: 1,
    persist: { form: 'calcite', tree: 'smith_forge', stats: { recovery: T.calciteRec, vitality: T.calciteVit } },
  },
  {
    // THE EMERGENCY RE-GRAB. Same shape as Long Tongs, longer and wider, on a
    // capstone cooldown — for the moment the party has lost a lane rather than
    // for the steady state Din already covers. Zero damage, like the other two.
    id: 'smith_call_the_room', tree: 'smith_forge', tier: 10, name: 'Call the Room',
    flavor: 'CAPSTONE — every hand stops. Whatever they were doing, they are doing this now.',
    type: 'active', domain: 'spiritual', prereq: 'smith_long_tongs',
    select: 'densest_cluster',
    trigger: { kind: 'NEAREST', range: T.roomLength },
    cooldown: T.roomCd,
    compose: [{ kind: 'line', damage: 0, length: T.roomLength, width: T.roomWidth, riders: { taunt: T.roomTaunt } }],
    ranks: { duration: T.rankDuration },
  },
];
