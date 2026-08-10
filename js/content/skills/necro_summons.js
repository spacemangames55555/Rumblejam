// NECROMANCER — Summons tree. The class's named engine (§8.3).
//
// Three things in this file are firsts for the project, and each is here to be
// tested rather than to be clever:
//
//   1. `summon` steps. A minion is a compose step; its ATTACK is another
//      compose step, run through the same primitives a player uses. Nothing in
//      js/minions.js knows what a skeleton is.
//   2. `rankGrants: 'summonSlots'` on Raise Skeleton — the only skill in the
//      game where a rank buys a structural quantity instead of damage or
//      duration. Registered and asserted in js/skills.js so a second one cannot
//      appear by accident.
//   3. `ON_TOKEN`, used twice, on two different primitives. One use would not
//      have shown whether the trigger composes; two on different shapes does.
//
// Tier 1 is a DIRECT attack, not a summon. §6.3 requires a tree's opening pick
// to be a damaging active, and a summon's damage is deferred by a spawn, a walk
// and an attack cooldown — "something that kills" has to kill now.

export const TUNING = {
  // Skeletons are disposable and wipe every room (§8.5 row 5), so their HP is
  // about surviving one fight rather than a map. These are BASE values: HP is
  // the rank's duration term (§9.5) and rankedDuration scales them, so the flat
  // inflation applied as a balance patch is reverted.
  //
  // Bone Shard stays raised — that was never about minions. The wide shape of
  // this tree measured 7.2 dps against the Druid's 18.0, and the tree's own
  // direct damage is what a Necromancer has during the cold start §8.5 gives it.
  // tier 1 — Bone Shard
  shardDamage: 11, shardSpeed: 520, shardRange: 240, shardCd: 900,
  // tier 2 — Raise Skeleton (the slot grant)
  skelSlotsPerRank: 1,          // one skeleton per point, capped by SUMMON_SLOT_CAP
  skelHp: 26, skelRadius: 10, skelDamage: 5, skelReach: 46, skelArc: 1.6,
  skelAtkCd: 1100, skelSpawnRadius: 44, skelCd: 2600,
  // ON_TOKEN: the range within which a soul token can be reached, and the
  // flight of the throw that reaches it. §8.5 row 4.
  skelTokenRange: 320, skelSeedSpeed: 620, skelSeedRadius: 6,
  // tier 3 — Gravechill
  chillDamage: 5, chillRadius: 120, chillDuration: 4000, chillTickMs: 500,
  chillSlowMult: 0.55, chillSlowDur: 1200, chillCd: 6000, chillTrigCount: 3,
  // tier 4 — Soul Harvest (ON_TOKEN → a temporary wisp)
  wispHp: 12, wispRadius: 7, wispDamage: 6, wispSpeed: 460, wispRange: 260,
  wispAtkCd: 900, wispOrbit: 62, wispDuration: 9000, wispCd: 4200, wispTokenRange: 260,
  // tier 5 — Bone Plate (passive)
  plateGrit: 3, plateVit: 8,
  // tier 6 — Grave Bolt
  graveDamage: 12, graveSpeed: 500, graveRange: 250, graveCd: 3200,
  graveDotDamage: 9, graveDotDur: 3000,
  // tier 7 — Charnel Pact (ON_TOKEN → a cone)
  pactDamage: 15, pactAngle: 2.2, pactRange: 190, pactCd: 5200, pactTokenRange: 200,
  // tier 8 — Bone Golem
  golemHp: 90, golemRadius: 15, golemDamage: 13, golemReach: 62, golemArc: 1.9,
  golemAtkCd: 1600, golemSpawnRadius: 54, golemCd: 9000, golemKnock: 180,
  golemTrigRadius: 220, golemTrigCount: 4,
  // tier 9 — Dread Howl
  howlDamage: 14, howlAngle: 2.8, howlRange: 200, howlRadius: 200, howlCount: 3,
  howlCd: 7500, howlWeakenMult: 0.7, howlWeakenDur: 3200,
  // tier 10 — Army of the Dead
  armyCount: 3, armyHp: 30, armyRadius: 10, armyDamage: 9, armyReach: 50, armyArc: 1.7,
  armyAtkCd: 1000, armySpawnRadius: 66, armyDuration: 14000, armyCd: 16000,
  armyBurstDamage: 16, armyBurstAngle: 3.0, armyBurstRange: 210,
  // the burst rides the pack: more bodies standing, harder it lands. Same hook
  // as Footing and armour — see engineScale() in js/compose.js.
  armyPerPack: 0.06,
  armyTrigPct: 45,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const NECRO_SUMMONS = [
  {
    id: 'necro_bone_shard', tree: 'necro_summons', tier: 1, name: 'Bone Shard',
    desc: 'The first thing you learn is that bone is already a weapon.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.shardRange },
    cooldown: T.shardCd,
    compose: [{ kind: 'bolt', damage: T.shardDamage, speed: T.shardSpeed, range: T.shardRange, riders: {} }],
    ranks: R,
  },
  {
    id: 'necro_raise_skeleton', tree: 'necro_summons', tier: 2, name: 'Raise Skeleton',
    desc: 'It remembers how to hold a weapon. It remembers nothing else.',
    type: 'active', domain: 'spiritual', prereq: 'necro_bone_shard',
    select: 'self',   // writes the caster, picks no target (§5.3)
    // §8.5: Raise Skeleton is triggered by a SOUL TOKEN in range, not by a
    // crowd. The skill throws at the token and the skeleton rises where the
    // throw lands, which is what makes a token a place rather than a counter —
    // a Necromancer's positioning becomes about where things DIED.
    trigger: { kind: 'ON_TOKEN', range: T.skelTokenRange },
    cooldown: T.skelCd,
    // THE ONE SKILL WHERE A RANK BUYS SOMETHING STRUCTURAL. Every other rank in
    // the game buys damage or duration; this one buys room on the field. It is
    // declared here, registered in RANK_GRANTS, and asserted at load — the
    // unstated version of this rule let a passive raise the Footing cap from a
    // designed ten to a measured seventeen.
    rankGrants: 'summonSlots', rankGrantPer: T.skelSlotsPerRank,
    compose: [{
      kind: 'summon', archetype: 'skeleton', move: 'chase',
      count: 1, slotted: true, revives: false,
      hp: T.skelHp, radius: T.skelRadius, spawnRadius: T.skelSpawnRadius,
      duration: 0,                        // permanent: it holds a slot, not a timer
      // THE THROW. `deliver` makes the summon travel to the spot the trigger
      // spent and rise there. It is a property of the step, so any future
      // summon can be delivered without the engine learning a new skill.
      deliver: { speed: T.skelSeedSpeed, radius: T.skelSeedRadius },
      attackCd: T.skelAtkCd,
      attack: { kind: 'strike', damage: T.skelDamage, arc: T.skelArc, reach: T.skelReach, select: 'nearest', riders: {} },
    }],
    ranks: R,
  },
  {
    id: 'necro_gravechill', tree: 'necro_summons', tier: 3, name: 'Gravechill',
    desc: 'The ground goes cold and stays cold.',
    type: 'active', domain: 'spiritual', prereq: 'necro_raise_skeleton',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.chillRadius, count: T.chillTrigCount },
    cooldown: T.chillCd,
    compose: [{
      kind: 'hazard', damage: T.chillDamage, radius: T.chillRadius,
      duration: T.chillDuration, tickMs: T.chillTickMs,
      riders: { slow: { mult: T.chillSlowMult, dur: T.chillSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'necro_soul_harvest', tree: 'necro_summons', tier: 4, name: 'Soul Harvest',
    desc: 'What the dead leave behind is still worth something to you.',
    type: 'active', domain: 'spiritual', prereq: 'necro_gravechill',
    select: 'self',   // writes the caster, picks no target (§5.3)
    // ON_TOKEN, first use. The token is a world resource left by any enemy
    // death — the trigger reads the floor, not a Necromancer counter.
    trigger: { kind: 'ON_TOKEN', range: T.wispTokenRange },
    cooldown: T.wispCd,
    compose: [{
      kind: 'summon', archetype: 'wisp', move: 'orbit',
      count: 1, slotted: false, revives: false,
      hp: T.wispHp, radius: T.wispRadius, spawnRadius: T.wispOrbit, orbitRadius: T.wispOrbit,
      duration: T.wispDuration,           // temporary: a token buys a short escort
      attackCd: T.wispAtkCd,
      attack: { kind: 'bolt', damage: T.wispDamage, speed: T.wispSpeed, range: T.wispRange, select: 'nearest', riders: {} },
    }],
    ranks: R,
  },
  {
    id: 'necro_bone_plate', tree: 'necro_summons', tier: 5, name: 'Bone Plate',
    desc: 'You wear the parts that did not get up.',
    type: 'passive', domain: 'physical', prereq: 'necro_soul_harvest',
    trigger: null, cooldown: 0, compose: [],
    passive: { armorGrit: T.plateGrit, armorVit: T.plateVit },
    maxRank: 1,                            // §1.3: neither damage nor duration
    ranks: R,
  },
  {
    id: 'necro_grave_bolt', tree: 'necro_summons', tier: 6, name: 'Grave Bolt',
    desc: 'It lands, and then it keeps happening.',
    type: 'active', domain: 'spiritual', prereq: 'necro_bone_plate',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.graveRange },
    cooldown: T.graveCd,
    compose: [{
      kind: 'bolt', damage: T.graveDamage, speed: T.graveSpeed, range: T.graveRange,
      riders: { impactDot: { damage: T.graveDotDamage, dur: T.graveDotDur } },
    }],
    ranks: R,
  },
  {
    id: 'necro_charnel_pact', tree: 'necro_summons', tier: 7, name: 'Charnel Pact',
    desc: 'You spend a soul the way other people spend a coin.',
    type: 'active', domain: 'spiritual', prereq: 'necro_grave_bolt',
    select: 'densest_cluster',
    // ON_TOKEN, second use, on a DIFFERENT primitive. One use proves a trigger
    // fires; two on different shapes prove it composes.
    trigger: { kind: 'ON_TOKEN', range: T.pactTokenRange },
    cooldown: T.pactCd,
    compose: [{ kind: 'cone', damage: T.pactDamage, angle: T.pactAngle, range: T.pactRange, riders: {} }],
    ranks: R,
  },
  {
    id: 'necro_bone_golem', tree: 'necro_summons', tier: 8, name: 'Bone Golem',
    desc: 'Enough of them, stacked well enough, and it stands on its own.',
    type: 'active', domain: 'physical', prereq: 'necro_charnel_pact',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'PROXIMITY', radius: T.golemTrigRadius, count: T.golemTrigCount },
    cooldown: T.golemCd,
    compose: [{
      kind: 'summon', archetype: 'golem', move: 'chase',
      count: 1, slotted: true, revives: false,
      hp: T.golemHp, radius: T.golemRadius, spawnRadius: T.golemSpawnRadius,
      duration: 0,
      attackCd: T.golemAtkCd,
      attack: { kind: 'strike', damage: T.golemDamage, arc: T.golemArc, reach: T.golemReach,
        select: 'densest_cluster', riders: { knockback: T.golemKnock } },
    }],
    ranks: R,
  },
  {
    id: 'necro_dread_howl', tree: 'necro_summons', tier: 9, name: 'Dread Howl',
    desc: 'Every skull in the room opens at once.',
    type: 'active', domain: 'spiritual', prereq: 'necro_bone_golem',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.howlRadius, count: T.howlCount },
    cooldown: T.howlCd,
    compose: [{
      kind: 'cone', damage: T.howlDamage, angle: T.howlAngle, range: T.howlRange,
      riders: { weakenDamage: { mult: T.howlWeakenMult, dur: T.howlWeakenDur } },
    }],
    ranks: R,
  },
  {
    id: 'necro_army_of_the_dead', tree: 'necro_summons', tier: 10, name: 'Army of the Dead',
    desc: 'You stop asking. The floor answers anyway.',
    type: 'active', domain: 'spiritual', prereq: 'necro_dread_howl',
    select: 'densest_cluster',
    trigger: { kind: 'SELF_THRESHOLD', pct: T.armyTrigPct },
    cooldown: T.armyCd,
    compose: [
      {
        kind: 'summon', archetype: 'risen', move: 'chase',
        count: T.armyCount, slotted: false, revives: false,
        hp: T.armyHp, radius: T.armyRadius, spawnRadius: T.armySpawnRadius,
        duration: T.armyDuration,
        attackCd: T.armyAtkCd,
        attack: { kind: 'strike', damage: T.armyDamage, arc: T.armyArc, reach: T.armyReach, select: 'nearest', riders: {} },
      },
      // The burst reads `pack` — the count of minions standing — through the
      // same engineScale() hook Footing and armour use. Summons feeding the
      // existing engine hook is the cheapest evidence that they are inside the
      // schema rather than beside it.
      { kind: 'cone', damage: T.armyBurstDamage, angle: T.armyBurstAngle, range: T.armyBurstRange,
        scaleWith: 'pack', scalePer: T.armyPerPack, riders: {} },
    ],
    ranks: R,
  },
];
