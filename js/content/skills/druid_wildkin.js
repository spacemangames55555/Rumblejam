// DRUID — Wild Kin. The SECOND tree, and the only one on the roster that
// answers a question a single existing tree poses rather than a pair.
//
// WHAT THE DRUID'S ONE TREE LEAVES OPEN. Tapestry of Beasts is the pack: one
// summon per animal skill, a revive timer that lengthens with pack size (§8.5).
// It is a complete engine and it has a hole in the middle of it — the DRUID
// does nothing. The character stands behind bodies that are not its own, and
// §8.5's revive curve means a wiped pack leaves it with no build at all and
// 15-23 seconds of waiting to get one back. One tree, and it contains both the
// class's identity and its only failure state.
//
// Wild Kin answers both halves with the machinery that already exists:
//
//   WILD KIN (branch A) makes the pack a MULTIPLIER ON THE DRUID rather than a
//     replacement for it. Every skill scales on `pack`, so animals standing
//     make the Druid's own body hit harder — commander to participant.
//   EARTH'S WRATH (branch B) is what is left when the animals are down. Every
//     skill fires on SELF_THRESHOLD, which is the state a wiped pack produces:
//     hurt, alone, and waiting on a revive timer.
//
// WHY NOT "RESTORATION", WHICH IS THE NAME §8.2 CARRIES. Keeping the pack alive
// is the obvious second tree and it CANNOT BE AUTHORED TODAY: `heal` iterates
// `sim.livePlayers()` and nothing else in the primitive set touches a minion's
// HP, so a heal-the-pack tree would need a new primitive or a new rider. That is
// engine work with a ruling behind it, not content — and inventing it mid-tree
// is exactly the failure the D-36 discipline exists to prevent. Checked before
// authoring rather than discovered halfway through. Restoration stays on §8.2's
// list for the Druid's THIRD tree, behind that ruling.
//
// PAIRED WITH asn_range ON PURPOSE: `pack` is a live-minion count, `killbox` is
// a placed-trap count. Different primitives, different tick paths, no shared
// state — so a defect in the machinery under both surfaces twice.
//
// THE SHAPE (§8.1): ten nodes, tiers 1/2/4/6/8/10, one branch at tier 2, two
// capstones, symmetric.

export const TUNING = {
  rakeDamage: 10, rakeReach: 100, rakeArc: 1.6, rakeCd: 1150,
  kinshipWeight: 0.15,

  // ---- branch A: Wild Kin (scale on the standing pack) ----
  rendDamage: 15, rendReach: 115, rendArc: 1.8, rendCd: 2500,
  alphaWeight: 0.18,
  thunderDamage: 18, thunderArc: 1.5, thunderRange: 300, thunderCd: 4200,
  apexDamage: 27, apexReach: 145, apexArc: 2.9, apexCd: 8000,
  apexPulses: 2, apexKnock: 240,

  // ---- branch B: Earth's Wrath (what is left when the pack is not) ----
  thornDamage: 14, thornRadius: 155, thornDuration: 3600, thornTickMs: 400,
  thornPct: 65, thornCd: 4600, thornSlowMult: 0.55, thornSlowDur: 2000,
  rootsWeight: 0.18,
  stoneAmount: 42, stoneDuration: 5000, stoneReflect: 25, stonePct: 45, stoneCd: 8600,
  quakeDamage: 25, quakeArc: 3.0, quakeRange: 280, quakePct: 40, quakeCd: 8800,
  quakeStun: 700,

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
const PACK = { scaleWith: 'pack'};

export const DRUID_WILDKIN = [
  {
    id: 'druid_rake', tree: 'druid_wildkin', tier: 1, name: 'Rake',
    desc: 'The Druid\'s own claws. The pack is not the only thing on the field with teeth.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.rakeReach },
    cooldown: T.rakeCd,
    compose: [{ kind: 'strike', damage: T.rakeDamage, arc: T.rakeArc, reach: T.rakeReach, ...PACK, riders: {} }],
    ranks: R,
  },
  {
    id: 'druid_kinship', tree: 'druid_wildkin', tier: 2, name: 'Kinship',
    desc: 'Every animal standing makes you more of one. Both roads out of here are about the Druid rather than the pack.',
    type: 'passive', domain: 'physical', prereq: 'druid_rake',
    trigger: null, cooldown: 0, compose: [],
    passive: { packScaleWeight: T.kinshipWeight },
    ranks: R,
  },

  // ------------------------------------------------- branch A: Wild Kin
  {
    id: 'druid_rend', tree: 'druid_wildkin', tier: 4, name: 'Rend',
    desc: 'You go in with them. The pack stops being a screen and starts being a multiplier.',
    type: 'active', domain: 'physical', prereq: 'druid_kinship',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.rendReach },
    cooldown: T.rendCd,
    compose: [{ kind: 'strike', damage: T.rendDamage, arc: T.rendArc, reach: T.rendReach, ...PACK, riders: {} }],
    ranks: R,
  },
  {
    id: 'druid_alpha_bond', tree: 'druid_wildkin', tier: 6, name: 'Alpha Bond',
    desc: 'They hunt harder with you in the middle of it.',
    type: 'passive', domain: 'physical', prereq: 'druid_rend',
    trigger: null, cooldown: 0, compose: [],
    passive: { packScaleWeight: T.alphaWeight },
    ranks: R,
  },
  {
    id: 'druid_thunder_run', tree: 'druid_wildkin', tier: 8, name: 'Thunder Run',
    desc: 'The whole pack moves as one body and you are the front of it.',
    type: 'active', domain: 'physical', prereq: 'druid_alpha_bond',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.thunderRange, count: 2 },
    cooldown: T.thunderCd,
    compose: [{ kind: 'cone', damage: T.thunderDamage, arc: T.thunderArc, range: T.thunderRange, ...PACK, riders: {} }],
    ranks: R,
  },
  {
    id: 'druid_apex', tree: 'druid_wildkin', tier: 10, name: 'Apex',
    desc: 'CAPSTONE — Wild Kin. Twice, and everything still standing is thrown off you.',
    type: 'active', domain: 'physical', prereq: 'druid_thunder_run',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.apexReach },
    cooldown: T.apexCd,
    compose: [{
      kind: 'strike', damage: T.apexDamage, arc: T.apexArc, reach: T.apexReach, ...PACK,
      riders: { multiPulse: T.apexPulses, knockback: T.apexKnock },
    }],
    ranks: R,
  },

  // --------------------------------------------- branch B: Earth's Wrath
  {
    id: 'druid_thornwall', tree: 'druid_wildkin', tier: 4, name: 'Thornwall',
    desc: 'Ground that fights for you when nothing else is. Earth\'s Wrath fires in the state a wiped pack produces.',
    type: 'active', domain: 'spiritual', prereq: 'druid_kinship',
    select: 'densest_cluster',
    trigger: { kind: 'SELF_THRESHOLD', pct: T.thornPct },
    cooldown: T.thornCd,
    compose: [{
      kind: 'hazard', damage: T.thornDamage, radius: T.thornRadius,
      duration: T.thornDuration, tickMs: T.thornTickMs, ...PACK,
      riders: { slow: { mult: T.thornSlowMult, dur: T.thornSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'druid_deep_roots', tree: 'druid_wildkin', tier: 6, name: 'Deep Roots',
    desc: 'What the pack taught you does not leave when the pack does.',
    type: 'passive', domain: 'spiritual', prereq: 'druid_thornwall',
    trigger: null, cooldown: 0, compose: [],
    passive: { packScaleWeight: T.rootsWeight },
    ranks: R,
  },
  {
    id: 'druid_stoneskin', tree: 'druid_wildkin', tier: 8, name: 'Stoneskin',
    desc: 'Bark over everything soft, and it bites back.',
    type: 'active', domain: 'spiritual', prereq: 'druid_deep_roots',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.stonePct },
    cooldown: T.stoneCd,
    compose: [{ kind: 'ward', amount: T.stoneAmount, duration: T.stoneDuration, reflectPct: T.stoneReflect, ...PACK }],
    ranks: R,
  },
  {
    id: 'druid_earthshaker', tree: 'druid_wildkin', tier: 10, name: 'Earthshaker',
    desc: 'CAPSTONE — Earth\'s Wrath. Alone, hurt, and the ground answers instead of the pack.',
    type: 'active', domain: 'spiritual', prereq: 'druid_stoneskin',
    select: 'densest_cluster',
    trigger: { kind: 'SELF_THRESHOLD', pct: T.quakePct },
    cooldown: T.quakeCd,
    compose: [{
      kind: 'cone', damage: T.quakeDamage, arc: T.quakeArc, range: T.quakeRange, ...PACK,
      riders: { stun: T.quakeStun },
    }],
    ranks: R,
  },
];
