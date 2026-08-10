// WITCH DOCTOR — Swarm. The third tree, and the answer to the one thing a doll
// cannot be pointed at.
//
// WHAT THE FIRST TWO LEAVE UNANSWERED. §8.3's voodoo doll mirrors damage from a
// doll onto a distant target. Effigy places and feeds the link; Blight is the
// rot that travels along it. Both trees are built on DESIGNATION — the class
// picks one enemy and makes everything it does happen to that enemy instead.
//
// A doll is a one-target instrument and a room is not one target. Against six
// bodies the designation is worth a sixth of itself, and the Witch Doctor's
// whole vocabulary is aimed at the wrong scale — not weak, but pointed at
// something that is not the problem. Neither existing tree has a word for the
// crowd.
//
// Swarm is the crowd, read two ways:
//
//   PLAGUE (branch A) spreads instead of designating. Every skill is a `plague`
//     or a zone, so the tree pays by contact and count rather than by choosing
//     — the exact inverse of a doll, and it gets better as the room gets worse.
//   FETISH (branch B) makes the crowd into bodies of your own. Every skill is a
//     `summon`, so the answer to being outnumbered is to stop being
//     outnumbered.
//
// The class keeps its identity either way: both branches still scale on `doll`,
// so a Witch Doctor that has designated something is better at the crowd too.
// The designation stops being the only thing it can do.
//
// PAIRED WITH smith_anvil ON PURPOSE: `doll` is a designation on one enemy plus
// a mirror; `form` is a named state with a duration on the caster. Different
// fields, different tick paths, no shared state — a defect under both surfaces
// twice rather than once.
//
// THE SHAPE (§8.1): ten nodes, tiers 1/2/4/6/8/10, one branch at tier 2, two
// capstones, symmetric.

export const TUNING = {
  hexDamage: 11, hexRange: 250, hexSpeed: 430, hexRadius: 7, hexCd: 1150,
  manyWeight: 0.15,

  // ---- branch A: Plague (contact and count, never designation) ----
  contagionDamage: 13, contagionDuration: 3400, contagionRange: 250, contagionCd: 2600,
  virulenceWeight: 0.18,
  miasmaDamage: 16, miasmaRadius: 165, miasmaDuration: 3800, miasmaTickMs: 400, miasmaCd: 4400,
  miasmaSlowMult: 0.55, miasmaSlowDur: 2200,
  pandemicDamage: 26, pandemicDuration: 5200, pandemicRange: 300, pandemicCd: 7800,

  // ---- branch B: Fetish (stop being outnumbered) ----
  fetishHp: 26, fetishRadius: 12, fetishSpawnRadius: 60, fetishAttackCd: 1.1,
  fetishDamage: 7, fetishMaxAlive: 2, fetishDuration: 14000, fetishPct: 60, fetishCd: 6000,
  hutWeight: 0.18,
  gravecallHp: 34, gravecallRadius: 13, gravecallSpawnRadius: 70, gravecallAttackCd: 1.0,
  gravecallDamage: 9, gravecallMaxAlive: 2, gravecallDuration: 15000, gravecallCd: 6600,
  legionHp: 46, legionRadius: 15, legionSpawnRadius: 80, legionAttackCd: 0.9,
  legionDamage: 12, legionMaxAlive: 3, legionDuration: 17000, legionCd: 9400,

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
const DOLL = { scaleWith: 'doll'};

export const WD_SWARM = [
  {
    id: 'wd_scattered_hex', tree: 'wd_swarm', tier: 1, name: 'Scattered Hex',
    desc: 'Thrown at whatever is closest rather than at the one that matters. The tree begins by giving up on choosing.',
    type: 'active', domain: 'spiritual', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.hexRange },
    cooldown: T.hexCd,
    compose: [{ kind: 'bolt', damage: T.hexDamage, range: T.hexRange, speed: T.hexSpeed, radius: T.hexRadius, ...DOLL, riders: {} }],
    ranks: R,
  },
  {
    id: 'wd_the_many', tree: 'wd_swarm', tier: 2, name: 'The Many',
    desc: 'One of them was never the problem. Both roads out of here are about the other five.',
    type: 'passive', domain: 'spiritual', prereq: 'wd_scattered_hex',
    trigger: null, cooldown: 0, compose: [],
    passive: { dollScaleWeight: T.manyWeight },
    ranks: R,
  },

  // --------------------------------------------------- branch A: Plague
  {
    id: 'wd_contagion', tree: 'wd_swarm', tier: 4, name: 'Contagion',
    desc: 'It does not care which one it started on. Plague pays by contact and count — the inverse of a doll.',
    type: 'active', domain: 'spiritual', prereq: 'wd_the_many',
    select: 'densest_cluster',
    trigger: { kind: 'NEAREST', range: T.contagionRange },
    cooldown: T.contagionCd,
    compose: [{ kind: 'plague', damage: T.contagionDamage, duration: T.contagionDuration, range: T.contagionRange, ...DOLL, riders: {} }],
    ranks: R,
  },
  {
    id: 'wd_virulence', tree: 'wd_swarm', tier: 6, name: 'Virulence',
    desc: 'What is already in them works faster.',
    type: 'passive', domain: 'spiritual', prereq: 'wd_contagion',
    trigger: null, cooldown: 0, compose: [],
    passive: { dollScaleWeight: T.virulenceWeight },
    ranks: R,
  },
  {
    id: 'wd_miasma', tree: 'wd_swarm', tier: 8, name: 'Miasma',
    desc: 'Ground nobody wants to stand in, laid where the most of them are.',
    type: 'active', domain: 'spiritual', prereq: 'wd_virulence',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.miasmaRadius, count: 3 },
    cooldown: T.miasmaCd,
    compose: [{
      kind: 'hazard', damage: T.miasmaDamage, radius: T.miasmaRadius,
      duration: T.miasmaDuration, tickMs: T.miasmaTickMs, ...DOLL,
      riders: { slow: { mult: T.miasmaSlowMult, dur: T.miasmaSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'wd_pandemic', tree: 'wd_swarm', tier: 10, name: 'Pandemic',
    desc: 'CAPSTONE — Plague. It gets better as the room gets worse.',
    type: 'active', domain: 'spiritual', prereq: 'wd_miasma',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.pandemicRange, count: 3 },
    cooldown: T.pandemicCd,
    compose: [{ kind: 'plague', damage: T.pandemicDamage, duration: T.pandemicDuration, range: T.pandemicRange, ...DOLL, riders: {} }],
    ranks: R,
  },

  // --------------------------------------------------- branch B: Fetish
  {
    id: 'wd_fetish', tree: 'wd_swarm', tier: 4, name: 'Fetish',
    desc: 'A little thing with your temper. Fetish answers being outnumbered by stopping being outnumbered.',
    type: 'active', domain: 'spiritual', prereq: 'wd_the_many',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.fetishPct },
    cooldown: T.fetishCd,
    compose: [{
      kind: 'summon', archetype: 'fetish', move: 'chase', slotted: false,
      hp: T.fetishHp, radius: T.fetishRadius, spawnRadius: T.fetishSpawnRadius,
      attackCd: T.fetishAttackCd, maxAlive: T.fetishMaxAlive, duration: T.fetishDuration,
      attack: { kind: 'strike', select: 'nearest', damage: T.fetishDamage, arc: 1.4, reach: 60, riders: {} },
    }],
    ranks: R,
  },
  {
    id: 'wd_spirit_hut', tree: 'wd_swarm', tier: 6, name: 'Spirit Hut',
    desc: 'Somewhere for them to come from.',
    type: 'passive', domain: 'spiritual', prereq: 'wd_fetish',
    trigger: null, cooldown: 0, compose: [],
    passive: { dollScaleWeight: T.hutWeight },
    ranks: R,
  },
  {
    id: 'wd_gravecall', tree: 'wd_swarm', tier: 8, name: 'Gravecall',
    desc: 'The ones already down are not finished being useful.',
    type: 'active', domain: 'spiritual', prereq: 'wd_spirit_hut',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'ON_KILL' },
    cooldown: T.gravecallCd,
    compose: [{
      kind: 'summon', archetype: 'gravecalled', move: 'chase', slotted: false,
      hp: T.gravecallHp, radius: T.gravecallRadius, spawnRadius: T.gravecallSpawnRadius,
      attackCd: T.gravecallAttackCd, maxAlive: T.gravecallMaxAlive, duration: T.gravecallDuration,
      attack: { kind: 'strike', select: 'nearest', damage: T.gravecallDamage, arc: 1.5, reach: 62, riders: {} },
    }],
    ranks: R,
  },
  {
    id: 'wd_legion', tree: 'wd_swarm', tier: 10, name: 'Legion',
    desc: 'CAPSTONE — Fetish. You brought a crowd of your own.',
    type: 'active', domain: 'spiritual', prereq: 'wd_gravecall',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 45 },
    cooldown: T.legionCd,
    compose: [{
      kind: 'summon', archetype: 'legionnaire', move: 'chase', slotted: false,
      hp: T.legionHp, radius: T.legionRadius, spawnRadius: T.legionSpawnRadius,
      attackCd: T.legionAttackCd, maxAlive: T.legionMaxAlive, duration: T.legionDuration,
      attack: { kind: 'strike', select: 'nearest', damage: T.legionDamage, arc: 1.6, reach: 66, riders: {} },
    }],
    ranks: R,
  },
];
