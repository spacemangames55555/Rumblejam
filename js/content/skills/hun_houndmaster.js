// HUNTER — Houndmaster tree.
//
// The other half, and — like Arcana, Grace, Ensemble, Collapse, Blight, Reef and
// Shadow — deliberately the half that does NOT read the engine. Longshot sends
// one body away and scales off the span; Houndmaster keeps the pack close and is
// paid in flat numbers.
//
// AND ON THIS CLASS THE TWO HALVES ARE THE TRAIT'S TWO ENDS. Pack Tactics pays
// **ALPHA** for two or more beasts within 120 — +20% Ferocity and +10% Tempo to
// the Hunter and every beast — and **MARKSMAN** for no beast within 250. It pays
// at both ends and nothing in between, so the §4.2 decision here is not "how
// deep" but *which shape of Hunter*: one bird a long way out reading the room,
// or a pack underfoot that makes everything hit harder.
//
// Longshot's engine agrees with Marksman and fights Alpha. This tree is where
// the other end lives, which is why nothing in it scales with `spread` and why
// every summon here is short-leashed: `move: 'orbit'` keeps the pack inside
// Alpha's 120 instead of chasing out of it.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Whistle Up
  whistleDamage: 5, whistleReach: 100, whistleArc: 1.6, whistleRadius: 126,
  whistleCount: 1, whistleCd: 1200,
  // tier 2 — Hound
  houndHp: 34, houndRadius: 12, houndSpawn: 54, houndAtkCd: 1150,
  houndDamage: 4, houndArc: 1.6, houndReach: 50, houndOrbit: 62,
  houndReviveBase: 7, houndRevivePer: 1.5, houndCd: 4000,
  // tier 3 — Bay
  bayDamage: 8, bayAngle: 1.8, bayRange: 210, bayRadius: 170, bayCount: 3,
  bayCd: 3200, bayTaunt: 1600,
  // tier 4 — Second Hound
  hound2Hp: 34, hound2Radius: 12, hound2Spawn: 54, hound2AtkCd: 1150,
  hound2Damage: 4, hound2Arc: 1.6, hound2Reach: 50, hound2Orbit: 74, hound2Cd: 5000,
  // tier 5 — Feed the Pack
  feedAmount: 15, feedCd: 5400,
  // tier 6 — Boarspear
  spearDamage: 11, spearReach: 112, spearArc: 1.8, spearRadius: 138,
  spearCount: 2, spearCd: 3400, spearKnock: 210,
  // tier 7 — Snare Net
  netDamage: 9, netWidth: 34, netLength: 340, netRadius: 195, netCount: 3,
  netCd: 5000, netRoot: 1400,
  // tier 8 — Kennel Guard
  kennelAmount: 26, kennelDuration: 5000, kennelReflect: 0.35, kennelCd: 8600,
  // tier 9 — Blood Trail
  trailDamage: 9, trailRange: 230, trailHealPct: 0.5, trailCd: 3800,
  // tier 10 — Loose the Pack
  looseDamage: 15, looseAngle: 2.6, looseRange: 240, looseRadius: 205,
  looseCount: 4, looseCd: 9500, looseSlowMult: 0.7, looseSlowDur: 1600,
  // rank increments — linear, never compounding
  rankDamage: 0.045, rankDuration: 0.035,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const HUN_HOUNDMASTER = [
  {
    id: 'hun_whistle_up', tree: 'hun_houndmaster', tier: 1, name: 'Whistle Up',
    flavor: 'A short cut at whatever came close.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.whistleRadius, count: T.whistleCount },
    cooldown: T.whistleCd,
    compose: [{ kind: 'strike', damage: T.whistleDamage, reach: T.whistleReach, arc: T.whistleArc, riders: {} }],
    ranks: R,
  },
  {
    // `move: 'orbit'` rather than 'chase', and that is the tree's whole thesis
    // in one field: a hound that orbits stays inside ALPHA's 120, a bird that
    // chases does not. Same primitive, opposite class.
    id: 'hun_hound', tree: 'hun_houndmaster', tier: 2, name: 'Hound',
    flavor: 'A hound that stays at your heel.',
    type: 'active', domain: 'physical', prereq: 'hun_whistle_up',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'NEAREST', range: T.bayRange },
    cooldown: T.houndCd,
    compose: [{
      kind: 'summon', archetype: 'wolf', maxAlive: 1, move: 'orbit',
      count: 1, slotted: false,
      revives: true, reviveBase: T.houndReviveBase, revivePerAnimal: T.houndRevivePer,
      hp: T.houndHp, radius: T.houndRadius, spawnRadius: T.houndSpawn,
      orbitRadius: T.houndOrbit, duration: 0,
      attackCd: T.houndAtkCd,
      attack: { kind: 'strike', damage: T.houndDamage, arc: T.houndArc, reach: T.houndReach, select: 'nearest', riders: {} },
    }],
    ranks: R,
  },
  {
    id: 'hun_bay', tree: 'hun_houndmaster', tier: 4, name: 'Bay',
    flavor: 'The pack gives tongue.',
    type: 'active', domain: 'spiritual', prereq: 'hun_hound',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.bayRadius, count: T.bayCount },
    cooldown: T.bayCd,
    compose: [{
      kind: 'cone', damage: T.bayDamage, angle: T.bayAngle, range: T.bayRange,
      riders: { taunt: T.bayTaunt },
    }],
    ranks: R,
  },
  {
    // The second hound is the node that turns Alpha on — the trait wants TWO
    // within 120, so this is the tier where the tree's whole bonus arrives at
    // once rather than growing.
    id: 'hun_second_hound', tree: 'hun_houndmaster', tier: 4, name: 'Second Hound',
    flavor: 'A second hound at the other heel.',
    type: 'active', domain: 'physical', prereq: 'hun_hound',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'NEAREST', range: T.bayRange },
    cooldown: T.hound2Cd,
    compose: [{
      // TWO, BECAUSE THE CEILING COUNTS THE ARCHETYPE AND NOT THE SKILL. Both
      // hounds are `wolf`, and `maxAlive` is enforced as "how many of this
      // archetype may stand" — so at 1 the first hound filled the quota and this
      // node, whose whole content is a second hound, could never spawn anything.
      // A purchasable node that does nothing.
      //
      // Same shape as the Monster drawing on a summon-slot pool only the
      // skeleton minted, and the same resolution: stop sharing the first
      // summon's ceiling and declare the correct one. Two hounds may stand, and
      // this is the node that says so — the archetype stays `wolf` because they
      // are both hounds, which keeps the per-archetype ceiling doing its real
      // job of stopping one animal crowding out a pack tree.
      kind: 'summon', archetype: 'wolf', maxAlive: 2, move: 'orbit',
      count: 1, slotted: false,
      revives: true, reviveBase: T.houndReviveBase, revivePerAnimal: T.houndRevivePer,
      hp: T.hound2Hp, radius: T.hound2Radius, spawnRadius: T.hound2Spawn,
      orbitRadius: T.hound2Orbit, duration: 0,
      attackCd: T.hound2AtkCd,
      attack: { kind: 'strike', damage: T.hound2Damage, arc: T.hound2Arc, reach: T.hound2Reach, select: 'nearest', riders: {} },
    }],
    ranks: R,
  },
  {
    id: 'hun_feed_the_pack', tree: 'hun_houndmaster', tier: 6, name: 'Feed the Pack',
    type: 'active', domain: 'spiritual', prereq: 'hun_second_hound',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 65 },
    cooldown: T.feedCd,
    compose: [{ kind: 'heal', amount: T.feedAmount }],
    ranks: R,
  },
  {
    id: 'hun_boarspear', tree: 'hun_houndmaster', tier: 8, name: 'Boarspear',
    flavor: 'A braced thrust that throws the front rank off the pack.',
    type: 'active', domain: 'physical', prereq: 'hun_snare_net',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.spearRadius, count: T.spearCount },
    cooldown: T.spearCd,
    compose: [{
      kind: 'strike', damage: T.spearDamage, reach: T.spearReach, arc: T.spearArc,
      riders: { knockback: T.spearKnock },
    }],
    ranks: R,
  },
  {
    id: 'hun_snare_net', tree: 'hun_houndmaster', tier: 6, name: 'Snare Net',
    flavor: 'A cast net.',
    type: 'active', domain: 'mental', prereq: 'hun_bay',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.netRadius, count: T.netCount },
    cooldown: T.netCd,
    compose: [{
      kind: 'line', damage: T.netDamage, width: T.netWidth, length: T.netLength,
      riders: { root: T.netRoot },
    }],
    ranks: R,
  },
  {
    id: 'hun_kennel_guard', tree: 'hun_houndmaster', tier: 10, name: 'Kennel Guard',
    type: 'active', domain: 'spiritual', prereq: 'hun_boarspear',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 50 },
    cooldown: T.kennelCd,
    compose: [{
      kind: 'ward', amount: T.kennelAmount, duration: T.kennelDuration,
      reflectPct: T.kennelReflect,
    }],
    ranks: R,
  },
  {
    // A `drain` rather than a passive regen, for the same reason the Priest's
    // Litany, the Bard's Answering Chorus, the Mage's Accretion, the Sundian's
    // Sump and the Assassin's Cutpurse are: `regen` is an ITEM hook, not a
    // registered passive key (§8.3).
    id: 'hun_blood_trail', tree: 'hun_houndmaster', tier: 8, name: 'Blood Trail',
    type: 'active', domain: 'physical', prereq: 'hun_feed_the_pack',
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.trailRange },
    cooldown: T.trailCd,
    compose: [{ kind: 'drain', damage: T.trailDamage, range: T.trailRange, healPct: T.trailHealPct }],
    ranks: R,
  },
  {
    id: 'hun_loose_the_pack', tree: 'hun_houndmaster', tier: 10, name: 'Loose the Pack',
    flavor: 'Everything at once, off the leash.',
    type: 'active', domain: 'physical', prereq: 'hun_blood_trail',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.looseRadius, count: T.looseCount },
    cooldown: T.looseCd,
    compose: [{
      kind: 'cone', damage: T.looseDamage, angle: T.looseAngle, range: T.looseRange,
      riders: { slow: { mult: T.looseSlowMult, dur: T.looseSlowDur } },
    }],
    ranks: R,
  },
];
