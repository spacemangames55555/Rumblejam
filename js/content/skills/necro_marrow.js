// NECROMANCER — Marrow tree. Bone tank and damage reflect.
//
// The second tree exists to make depth-versus-breadth testable WITHIN one
// class: Marrow is melee and defensive where Dark Matter is ranged output, so a
// Necromancer choosing between them is choosing an axis rather than picking the
// better list. That choice is what gate criterion 1 is asking about.
//
// `scaleWith: 'armor'` on the capstone is the second engine name in the game,
// and it goes through exactly the same hook as Footing — see engineScale() in
// js/compose.js. The value is published on p.engines.armor by skillsim.

export const TUNING = {
  // tier 1 — Bone Dart
  dartDamage: 6, dartSpeed: 500, dartRange: 220, dartCd: 950,
  // tier 2 — Calcify (passive)
  calcifyGrit: 4, calcifyVit: 6,
  // tier 3 — Spiked Punch
  punchDamage: 11, punchReach: 80, punchArc: 1.4, punchCd: 1600, punchTaunt: 2500,
  // tier 4 — Bone Spur
  spurAmount: 16, spurDuration: 4000, spurReflect: 0.45, spurCd: 5000,
  // tier 5 — Stake
  stakeDamage: 9, stakeSpeed: 470, stakeRange: 200, stakePct: 50, stakeCd: 7000,
  stakeRoot: 7000,             // EXACT (source project): 7s immobilise
  // tier 6 — Quill (passive)
  quillReflectPerGrit: 0.004,
  // tier 7 — Bone Nova
  novaDamage: 13, novaAngle: 2.6, novaRange: 165, novaRadius: 140, novaCount: 4,
  novaCd: 6500, novaKnock: 300,
  // tier 8 — Banshee's Wail
  wailDamage: 11, wailAngle: 1.8, wailRange: 185, wailRadius: 160, wailCount: 3,
  wailCd: 7000, wailWeakenMult: 0.7, wailWeakenDur: 3000,
  // tier 9 — Wrecking Ball
  ballDamage: 18, ballWidth: 60, ballLength: 320, ballRadius: 180, ballCount: 2,
  ballCd: 8000, ballKnock: 420, ballStun: 800,
  // tier 10 — Marrownaut
  marrowShield: 34, marrowShieldDur: 6000, marrowWard: 28, marrowWardDur: 6000,
  marrowReflect: 0.6, marrowPct: 40, marrowCd: 14000,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const NECRO_MARROW = [
  {
    id: 'necro_bone_dart', tree: 'necro_marrow', tier: 1, name: 'Bone Dart',
    desc: 'A splinter of your own frame, thrown hard.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'objective_target',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'NEAREST', range: T.dartRange },
    cooldown: T.dartCd,
    compose: [{ kind: 'bolt', damage: T.dartDamage, speed: T.dartSpeed, range: T.dartRange, riders: {} }],
    ranks: R,
  },
  {
    id: 'necro_calcify', tree: 'necro_marrow', tier: 2, name: 'Calcify',
    desc: 'Bone thickens where it has been broken.',
    type: 'passive', domain: 'physical', prereq: 'necro_bone_dart',
    trigger: null, cooldown: 0, compose: [],
    passive: { armorGrit: T.calcifyGrit, armorVit: T.calcifyVit },
    // §1.3: grants no damage and no duration, so a second point buys nothing.
    maxRank: 1,
    ranks: R,
  },
  {
    id: 'necro_spiked_punch', tree: 'necro_marrow', tier: 4, name: 'Spiked Punch',
    desc: 'Close enough to be hit, which is where this tree wants you.',
    type: 'active', domain: 'physical', prereq: 'necro_calcify',
    select: 'nearest',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'NEAREST', range: T.punchReach },
    cooldown: T.punchCd,
    compose: [{
      kind: 'strike', damage: T.punchDamage, arc: T.punchArc, reach: T.punchReach,
      riders: { taunt: T.punchTaunt },
    }],
    ranks: R,
  },
  {
    id: 'necro_bone_spur', tree: 'necro_marrow', tier: 8, name: 'Bone Spur',
    desc: 'Spurs stand out of the skin. Hitting you costs something.',
    type: 'active', domain: 'physical', prereq: 'necro_quill',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'ON_HIT_TAKEN' },
    cooldown: T.spurCd,
    compose: [{ kind: 'ward', amount: T.spurAmount, duration: T.spurDuration, reflectPct: T.spurReflect }],
    ranks: R,
  },
  {
    id: 'necro_stake', tree: 'necro_marrow', tier: 4, name: 'Stake',
    desc: 'Pins a wounded thing in place for a long, long moment.',
    type: 'active', domain: 'physical', prereq: 'necro_calcify',
    select: 'lowest_hp',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'TARGET_THRESHOLD', pct: T.stakePct, range: T.stakeRange },
    cooldown: T.stakeCd,
    compose: [{
      kind: 'bolt', damage: T.stakeDamage, speed: T.stakeSpeed, range: T.stakeRange,
      riders: { root: T.stakeRoot },
    }],
    ranks: R,
  },
  {
    id: 'necro_quill', tree: 'necro_marrow', tier: 6, name: 'Quill',
    desc: 'The harder your shell, the worse it is to strike.',
    type: 'passive', domain: 'spiritual', prereq: 'necro_spiked_punch',
    trigger: null, cooldown: 0, compose: [],
    passive: { reflectPerGrit: T.quillReflectPerGrit },
    ranks: R,
  },
  {
    id: 'necro_bone_nova', tree: 'necro_marrow', tier: 6, name: 'Bone Nova',
    desc: 'Everything within arm\'s reach goes somewhere else.',
    type: 'active', domain: 'physical', prereq: 'necro_stake',
    select: 'densest_cluster',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'PROXIMITY', radius: T.novaRadius, count: T.novaCount },
    cooldown: T.novaCd,
    compose: [{
      kind: 'cone', damage: T.novaDamage, angle: T.novaAngle, range: T.novaRange,
      riders: { knockback: T.novaKnock },
    }],
    ranks: R,
  },
  {
    id: 'necro_banshee', tree: 'necro_marrow', tier: 8, name: "Banshee's Wail",
    desc: 'A sound out of the marrow. What hears it hits softer.',
    type: 'active', domain: 'spiritual', prereq: 'necro_bone_nova',
    select: 'densest_cluster',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'PROXIMITY', radius: T.wailRadius, count: T.wailCount },
    cooldown: T.wailCd,
    compose: [{
      kind: 'cone', damage: T.wailDamage, angle: T.wailAngle, range: T.wailRange,
      riders: { weakenDamage: { mult: T.wailWeakenMult, dur: T.wailWeakenDur } },
    }],
    ranks: R,
  },
  {
    id: 'necro_wrecking_ball', tree: 'necro_marrow', tier: 10, name: 'Wrecking Ball',
    desc: 'You become the thing that goes through the room.',
    type: 'active', domain: 'physical', prereq: 'necro_banshee',
    select: 'farthest',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'ISOLATED', radius: T.ballRadius, count: T.ballCount },
    cooldown: T.ballCd,
    compose: [{
      kind: 'line', damage: T.ballDamage, width: T.ballWidth, length: T.ballLength,
      riders: { knockback: T.ballKnock, stun: T.ballStun },
    }],
    ranks: R,
  },
  {
    id: 'necro_marrownaut', tree: 'necro_marrow', tier: 10, name: 'Marrownaut',
    desc: 'The frame closes over you. Whatever is left outside can try.',
    type: 'active', domain: 'spiritual', prereq: 'necro_bone_spur',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.marrowPct },
    cooldown: T.marrowCd,
    compose: [
      // the SECOND engine name in the game, through the same hook as Footing
      { kind: 'shield', amount: T.marrowShield, duration: T.marrowShieldDur,
        scaleWith: 'armor'},
      { kind: 'ward', amount: T.marrowWard, duration: T.marrowWardDur, reflectPct: T.marrowReflect },
    ],
    ranks: R,
  },
];
