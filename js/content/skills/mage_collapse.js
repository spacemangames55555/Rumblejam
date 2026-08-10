// MAGE — Collapse tree.
//
// The other half, and — like the Wizard's Arcana, the Priest's Grace and the
// Bard's Ensemble — deliberately the half that does NOT read the engine. It is
// the Mage's ranged and control kit, paid in flat numbers, so a Mage that has
// just walked through a door with an empty crystal pool is still a functioning
// character rather than one waiting to be hit.
//
// AND IT IS THE HALF THAT LETS THE CLASS REFUSE ITS OWN ENGINE. Crystallize only
// pays out in melee (see Crystalblade's header), so every point spent here buys
// power the Mage can use from range — power that does not require standing in
// the damage. That is the depth-versus-breadth decision §4.2 wants, and on this
// class it is a decision about DISTANCE: go deep in Crystalblade and the Mage
// has to be hit to be strong, go wide into Collapse and it does not, and the
// crystal it never earns is the price.
//
// Nothing here scales with crystal, ON PURPOSE. A crystal-scaled bolt would let
// the Mage bank the engine at the back of the room and spend it from safety,
// which is the exact play the class exists to refuse.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Coil Shot
  coilDamage: 5, coilSpeed: 530, coilRange: 255, coilCd: 1100,
  // tier 2 — Gravity Well
  wellDamage: 4, wellRadius: 150, wellCount: 3, wellDuration: 3600,
  wellTickMs: 420, wellCd: 5200, wellSlowMult: 0.7, wellSlowDur: 1500,
  // tier 3 — Event Horizon
  horizonAmount: 22, horizonDuration: 4800, horizonCd: 7600,
  // tier 4 — Redshift
  redshiftDamage: 8, redshiftSpeed: 500, redshiftRange: 260, redshiftCd: 3200,
  redshiftWeakenMult: 0.76, redshiftWeakenDur: 2600,
  // tier 5 — Accretion
  accretionDamage: 7, accretionRange: 240, accretionHealPct: 0.45, accretionCd: 3600,
  // tier 6 — Tidal Shear
  shearDamage: 8, shearAngle: 1.8, shearRange: 225, shearRadius: 185,
  shearCount: 3, shearCd: 4800,
  // tier 7 — Frame Drag
  dragDamage: 8, dragWidth: 34, dragLength: 360, dragRadius: 205,
  dragCount: 3, dragCd: 5600, dragRoot: 1400,
  // tier 8 — Null Geodesic
  geodesicAmount: 30, geodesicDuration: 5200, geodesicReflect: 0.4, geodesicCd: 9400,
  // tier 9 — Spaghettification
  spagDamage: 9, spagSpeed: 470, spagRadius: 210, spagTargets: 3, spagCd: 6000,
  spagDotDamage: 9, spagDotDur: 2400,
  // tier 10 — Heat Death
  heatDamage: 13, heatAngle: 2.7, heatRange: 250, heatRadius: 215,
  heatCount: 4, heatCd: 10500, heatStun: 700,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const MAGE_COLLAPSE = [
  {
    id: 'mage_coil_shot', tree: 'mage_collapse', tier: 1, name: 'Coil Shot',
    desc: 'A rail of compressed air at the nearest thing. Deals 7 damage at 255 range.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.coilRange },
    cooldown: T.coilCd,
    compose: [{ kind: 'bolt', damage: T.coilDamage, speed: T.coilSpeed, range: T.coilRange, riders: {} }],
    ranks: R,
  },
  {
    id: 'mage_gravity_well', tree: 'mage_collapse', tier: 2, name: 'Gravity Well',
    desc: 'A dent in the floor that drags the crowd to 70% speed for 1.5s. 5 damage a tick over 3.6s.',
    type: 'active', domain: 'mental', prereq: 'mage_coil_shot',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.wellRadius, count: T.wellCount },
    cooldown: T.wellCd,
    compose: [{
      kind: 'hazard', damage: T.wellDamage, radius: T.wellRadius,
      duration: T.wellDuration, tickMs: T.wellTickMs,
      riders: { slow: { mult: T.wellSlowMult, dur: T.wellSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'mage_event_horizon', tree: 'mage_collapse', tier: 3, name: 'Event Horizon',
    desc: 'Absorbs 26 over 4.8s when you drop below 60% health.',
    type: 'active', domain: 'mental', prereq: 'mage_gravity_well',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 60 },
    cooldown: T.horizonCd,
    compose: [{ kind: 'shield', amount: T.horizonAmount, duration: T.horizonDuration }],
    ranks: R,
  },
  {
    id: 'mage_redshift', tree: 'mage_collapse', tier: 4, name: 'Redshift',
    desc: 'A stretched shot at the fattest thing in range. 10 damage, and it deals 24% less for 2.6s.',
    type: 'active', domain: 'spiritual', prereq: 'mage_event_horizon',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.redshiftRange },
    cooldown: T.redshiftCd,
    compose: [{
      kind: 'bolt', damage: T.redshiftDamage, speed: T.redshiftSpeed, range: T.redshiftRange,
      riders: { weakenDamage: { mult: T.redshiftWeakenMult, dur: T.redshiftWeakenDur } },
    }],
    ranks: R,
  },
  {
    // A `drain` rather than a passive regen, for the same reason the Priest's
    // Litany and the Bard's Answering Chorus are: `regen` is an ITEM hook, not a
    // registered passive key, and inventing one means a reader in `skillsim.js`
    // — the engine code a content-shaped class is not supposed to cost (§8.3).
    id: 'mage_accretion', tree: 'mage_collapse', tier: 5, name: 'Accretion',
    desc: 'Deals 9 damage and pulls 45% of it back as health.',
    type: 'active', domain: 'spiritual', prereq: 'mage_redshift',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.accretionRange },
    cooldown: T.accretionCd,
    compose: [{ kind: 'drain', damage: T.accretionDamage, range: T.accretionRange, healPct: T.accretionHealPct }],
    ranks: R,
  },
  {
    id: 'mage_tidal_shear', tree: 'mage_collapse', tier: 6, name: 'Tidal Shear',
    desc: 'A fan of pulled space across the crowd. Deals 11 damage.',
    type: 'active', domain: 'mental', prereq: 'mage_accretion',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.shearRadius, count: T.shearCount },
    cooldown: T.shearCd,
    compose: [{ kind: 'cone', damage: T.shearDamage, angle: T.shearAngle, range: T.shearRange, riders: {} }],
    ranks: R,
  },
  {
    id: 'mage_frame_drag', tree: 'mage_collapse', tier: 7, name: 'Frame Drag',
    desc: 'A line that holds what it crosses in place for 1.4s. Deals 11 damage.',
    type: 'active', domain: 'mental', prereq: 'mage_tidal_shear',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.dragRadius, count: T.dragCount },
    cooldown: T.dragCd,
    compose: [{
      kind: 'line', damage: T.dragDamage, width: T.dragWidth, length: T.dragLength,
      riders: { root: T.dragRoot },
    }],
    ranks: R,
  },
  {
    id: 'mage_null_geodesic', tree: 'mage_collapse', tier: 8, name: 'Null Geodesic',
    desc: 'Absorbs 30 over 5.2s and returns 40% of what it stops.',
    type: 'active', domain: 'spiritual', prereq: 'mage_frame_drag',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 45 },
    cooldown: T.geodesicCd,
    compose: [{
      kind: 'ward', amount: T.geodesicAmount, duration: T.geodesicDuration,
      reflectPct: T.geodesicReflect,
    }],
    ranks: R,
  },
  {
    id: 'mage_spaghettification', tree: 'mage_collapse', tier: 9, name: 'Spaghettification',
    desc: 'Three drawn-out shots, each leaving a tear. 12 damage plus 9 over 2.4s.',
    type: 'active', domain: 'spiritual', prereq: 'mage_null_geodesic',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.spagRadius, count: T.spagTargets },
    cooldown: T.spagCd,
    compose: [{
      kind: 'bolt', damage: T.spagDamage, speed: T.spagSpeed, range: T.spagRadius,
      count: T.spagTargets,
      riders: { impactDot: { damage: T.spagDotDamage, dur: T.spagDotDur } },
    }],
    ranks: R,
  },
  {
    id: 'mage_heat_death', tree: 'mage_collapse', tier: 10, name: 'Heat Death',
    desc: 'The end of the argument. 17 damage in a wide fan, and what it touches is stunned for 0.7s.',
    type: 'active', domain: 'mental', prereq: 'mage_spaghettification',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.heatRadius, count: T.heatCount },
    cooldown: T.heatCd,
    compose: [{
      kind: 'cone', damage: T.heatDamage, angle: T.heatAngle, range: T.heatRange,
      riders: { stun: T.heatStun },
    }],
    ranks: R,
  },
];
