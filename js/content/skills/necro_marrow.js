// NECROMANCER — Marrow tree. Bone tank and damage reflect.
//
// CONVERTED FROM docs/design/classes/necromancer.md. The tree NAME and eight of
// the ten nodes were already here; what this pass changes is that the nodes now
// say what the conversion document says they say.
//
// THREE THINGS ABOUT THE CONTENTS, before the definitions:
//
//   OSTEO AURA IS TABLED, not deleted. The document's plan (its own line 16)
//   was "Osteo Aura and Grasp of Death replace Quill and Banshee's Wail" —
//   first for first, second for second. Osteo is set aside pending playtest, so
//   the node it was going to replace stays: `necro_quill` is the tenth slot,
//   unchanged. Grasp of Death does replace Banshee's Wail.
//
//   MAGNITUDES ARE THE DOCUMENT'S. Roster ruling 1 rebucketed pace and ruling 6
//   cut durations, but no ruling ever reconciled DAMAGE, and the document's
//   numbers run about 2.4x the numbers this tree shipped with (Bone Dart 26
//   against 6, Wrecking Ball 28 against 18). They are taken as authored and the
//   consequence is reported rather than tuned away — the same treatment Blight's
//   cadence got.
//
//   `scaleWith: 'armor'` on the capstone is the second engine name in the game,
//   and it goes through the same hook as Footing — see engineScale() in
//   js/compose.js. The value is published on p.engines.armor by skillsim.

import { docTrigger, rankPer } from '../doc_conversion.js';

export const TUNING = {
  // tier_code 0 — Bone Dart
  dartDamage: 26, dartSpeed: 500, dartRange: 460, dartCd: 600, dartPierce: 1,
  // tier_code 1 — Spiked Punch
  punchDamage: 30, punchReach: 72, punchArc: 6.28, punchCd: 1200,
  // tier_code 2 — Bone Nova
  novaDamage: 24, novaReach: 165, novaArc: 6.28, novaCd: 1200,
  novaKnock: 90, novaStun: 160, novaCount: 4,
  // tier_code 3 — Calcify (passive)
  calcifyGrit: 4, calcifyVit: 6,
  // tier_code 5 — Stake
  stakeDamage: 14, stakeReach: 84, stakeArc: 6.28, stakeCd: 2000, stakeRoot: 1400,
  // tier_code 6 — Quill (passive) — the slot Osteo Aura is tabled out of
  quillReflectPerGrit: 0.004,
  // tier_code 7 — Bone Spur
  spurAmount: 16, spurDuration: 4000, spurReflect: 0.40, spurCd: 5000,
  // tier_code 8 — Wrecking Ball
  ballDamage: 28, ballWidth: 60, ballLength: 320, ballRadius: 100, ballCount: 1,
  ballCd: 4000, ballStun: 1500, ballCarry: 320,
  // tier_code 9 — Grasp of Death — replaces Banshee's Wail
  graspDamage: 40, graspRange: 120, graspHealPct: 0.60, graspCd: 4000, graspPct: 65,
  // tier_code 4 — Marrownaut. A PERSISTENT FORM: no duration, no cooldown, no
  // trigger. `marrowDuration`, `marrowCd` and `marrowPct` are deliberately gone
  // rather than left unread — a tuning key nothing consumes is the shape this
  // file keeps finding elsewhere.
  marrowGrit: 20, marrowVit: 40,
  marrowTempo: -3,              // 300 -> 291 u/s; one of the two negative rungs the item table uses
  marrowAuraR: 165,             // Bone Nova's reach: the pull ends where the tank's own swing does
  marrowAuraTick: 800,          // under the shortest shipped taunt (1400ms), so the pull does not flicker
  marrowPull: 1000,             // how long a pulled enemy stays pulled after leaving the radius
  marrowShield: 34,             // carried forward from the emergency shield, unretuned
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
// Rank rates, the document's flat additions turned into fractions of the base
// — `rankPer` in ./_conversion.js, so the arithmetic happens in one place.

export const NECRO_MARROW = [
  {
    id: 'necro_spiked_punch', tree: 'necro_marrow', tier: 1, name: 'Spiked Punch',
    flavor: 'Close enough to be hit, which is where this tree wants you.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'densest_cluster',   // "multi-target (uncapped circle r72)"
    trigger: docTrigger('ENEMY_BREACHES_RING', { radius: T.punchReach }),
    cooldown: T.punchCd,
    // A CIRCLE, WRITTEN AS A FULL-ARC STRIKE. The document says "uncapped circle
    // r72"; `strike` with a 2pi arc is that circle, and it is the only primitive
    // that sweeps around the caster rather than away from him.
    compose: [{ kind: 'strike', damage: T.punchDamage, arc: T.punchArc, reach: T.punchReach, riders: {} }],
    ranks: rankPer(5, T.punchDamage),
  },
  {
    id: 'necro_marrownaut', tree: 'necro_marrow', tier: 2, name: 'Marrownaut',
    flavor: 'The frame closes over you. Whatever is left outside can try.',
    type: 'active', domain: 'spiritual', prereq: 'necro_spiked_punch',
    select: 'self',   // writes the caster, picks no target (§5.3)
    // NO TRIGGER, NO COOLDOWN, NO DURATION. The identity of the tree is not an
    // emergency button: this is a state you are in because you chose to spend a
    // slot on being a bone construct. It shipped on `SELF_HP_BELOW_X pct 45`
    // with a 30s cooldown and a 10s life, which is a panic cast, and the ruling
    // is that the form IS the tree.
    //
    // AN ACTIVE THAT NEVER FIRES, which is why `persist` exists rather than a
    // conversion to `passive`. It occupies one of the eight slots — slotting it
    // is the decision to tank, and a passive would hand that out for free
    // alongside everything else. But it has no trigger for the trigger loop to
    // evaluate and never enters the swarm pace band, so it is not a firing
    // skill either. `js/skillsim.js` registers this block per player per room
    // from the loadout, the same door `passive.aura` already came through.
    //
    // ZERO DAMAGE, AND THAT IS LOAD-BEARING. The aura pulls and does nothing
    // else — no contact damage, no retaliation, no pulse damage. It is what
    // keeps a permanent aggro field on the right side of the statue test: a
    // stationary Marrownaut drags the room onto itself and kills none of it.
    persist: {
      // THE FORM. Same `stats` block the `form` primitive would have written,
      // read by `formStats()` through the registry hook Footing uses, so WHAT
      // the form does to the sheet stays content rather than code. `tempo` is
      // the cost of tanking and rides the same passthrough — `_recomputeStats`
      // applies any key that exists on the sheet.
      form: 'marrownaut',
      stats: { grit: T.marrowGrit, vitality: T.marrowVit, tempo: T.marrowTempo },
      // THE PULL. A zero-damage aura carrying a taunt rider: `dps` stays 0 and
      // the pulse writes only the pull marker. Radius is Bone Nova's reach, so
      // the field ends where the tank's own longest swing ends.
      aura: { radius: T.marrowAuraR, pulseMs: T.marrowAuraTick, taunt: T.marrowPull },
      // THE SHIELD, now persistent. `armor` is the Necromancer's class engine
      // and this is still the only node in the game that reads it, so the
      // `scaleWith` hook has to survive the conversion or `engine_gate` fails a
      // resource that multiplies nothing. Armor mirrors `grit` rather than
      // accumulating over a fight, so a door-time grant scales correctly — and
      // it is computed AFTER the form lands, so the +20 Grit is in it.
      shield: { amount: T.marrowShield, scaleWith: 'armor' },
    },
    compose: [],
    ranks: R,
  },
  {
    id: 'necro_bone_dart', tree: 'necro_marrow', tier: 3, name: 'Bone Dart',
    flavor: 'A splinter of your own frame, thrown hard.',
    type: 'active', domain: 'physical', prereq: 'necro_marrownaut',
    select: 'nearest',   // "single target", and the trigger names the nearest
    trigger: docTrigger('NEAREST_IN_RANGE', { range: T.dartRange }),
    cooldown: T.dartCd,
    // PIERCE FROM RANK 1, not from rank 6. The document says "pierces 1
    // additional enemy at rank 6" — a rank that turns a rider ON, which is the
    // same shape as the rank-gated primitive ruled out on Dark Matter Bomb: the
    // rank model scales values and never changes what a step is made of.
    compose: [{ kind: 'bolt', damage: T.dartDamage, speed: T.dartSpeed, range: T.dartRange,
      riders: { pierce: T.dartPierce } }],
    ranks: rankPer(4, T.dartDamage),
  },
  {
    id: 'necro_bone_nova', tree: 'necro_marrow', tier: 4, name: 'Bone Nova',
    flavor: 'Everything within arm\'s reach goes somewhere else.',
    type: 'active', domain: 'physical', prereq: 'necro_bone_dart',
    select: 'densest_cluster',   // "uncapped in area — breadth is the point"
    trigger: docTrigger('CROWD_THRESHOLD', { radius: T.novaReach, count: T.novaCount }),
    cooldown: T.novaCd,
    // "circle r165 on caster" — the same full-arc strike as Spiked Punch, and
    // the reason `nova` did not need to be an eighteenth primitive.
    compose: [{ kind: 'strike', damage: T.novaDamage, arc: T.novaArc, reach: T.novaReach,
      riders: { knockback: T.novaKnock, stun: T.novaStun } }],
    ranks: rankPer(4, T.novaDamage),
  },
  {
    id: 'necro_stake', tree: 'necro_marrow', tier: 5, name: 'Stake',
    flavor: 'Pins a wounded thing in place for a long, long moment.',
    type: 'active', domain: 'physical', prereq: 'necro_bone_nova',
    select: 'densest_cluster',   // "multi-target (uncapped circle r84)"
    trigger: docTrigger('ENEMY_BREACHES_RING', { radius: T.stakeReach }),
    cooldown: T.stakeCd,
    compose: [{ kind: 'strike', damage: T.stakeDamage, arc: T.stakeArc, reach: T.stakeReach,
      riders: { root: T.stakeRoot } }],
    ranks: rankPer(2, T.stakeDamage),
  },
  {
    id: 'necro_quill', tree: 'necro_marrow', tier: 6, name: 'Quill',
    flavor: 'The harder your shell, the worse it is to strike.',
    type: 'passive', domain: 'spiritual', prereq: 'necro_stake',
    trigger: null, cooldown: 0, compose: [],
    passive: { reflectPerGrit: T.quillReflectPerGrit },
    ranks: R,
  },
  {
    id: 'necro_bone_spur', tree: 'necro_marrow', tier: 7, name: 'Bone Spur',
    flavor: 'Spurs stand out of the skin. Hitting you costs something.',
    type: 'active', domain: 'physical', prereq: 'necro_quill',
    select: 'self',   // writes the caster, picks no target (§5.3)
    // The document calls this a passive on ON_DAMAGE_TAKEN with a flat
    // `reflectPct`. There is no flat-reflect passive key — `reflectPerGrit` is
    // the only one and it scales with Defense — so it stays the shipped `ward`,
    // which reflects a flat fraction and fires on the trigger the document
    // names. See the report.
    trigger: docTrigger('ON_DAMAGE_TAKEN'),
    cooldown: T.spurCd,
    compose: [{ kind: 'ward', amount: T.spurAmount, duration: T.spurDuration, reflectPct: T.spurReflect }],
    ranks: R,
  },
  {
    id: 'necro_wrecking_ball', tree: 'necro_marrow', tier: 8, name: 'Wrecking Ball',
    flavor: 'You become the thing that goes through the room.',
    type: 'active', domain: 'physical', prereq: 'necro_bone_spur',
    select: 'densest_cluster',   // the direction is resolved from the crowd
    trigger: docTrigger('ENEMY_BREACHES_RING', { radius: T.ballRadius, count: T.ballCount }),
    cooldown: T.ballCd,
    // `carry` IS THE DISPLACEMENT, ruled as a rider rather than a dash
    // primitive: `line` already picks the direction, clips on walls and hits
    // every body in the lane once.
    compose: [{ kind: 'line', damage: T.ballDamage, width: T.ballWidth, length: T.ballLength,
      riders: { stun: T.ballStun, carry: T.ballCarry } }],
    ranks: rankPer(4, T.ballDamage),
  },
  {
    id: 'necro_grasp_of_death', tree: 'necro_marrow', tier: 9, name: 'Grasp of Death',
    flavor: 'What you take from it, you keep.',
    type: 'active', domain: 'spiritual', prereq: 'necro_wrecking_ball',
    select: 'lowest_hp',   // "single target (nearest)", wounded first
    // THE DOCUMENT ASKS FOR TWO TRIGGERS. "SELF_HP_BELOW_X (65%), falling back
    // to LOWEST_HP_ENEMY within 120px when at full health" is a primary and a
    // fallback, and a skill has one trigger. The threshold is kept, because it
    // is the half that makes this the class's emergency; the fallback survives
    // as the SELECTOR, which is where "lowest HP enemy" belongs anyway.
    trigger: docTrigger('SELF_HP_BELOW_X', { pct: T.graspPct }),
    cooldown: T.graspCd,
    compose: [{ kind: 'drain', damage: T.graspDamage, range: T.graspRange, healPct: T.graspHealPct }],
    ranks: rankPer(6, T.graspDamage),
  },
  {
    id: 'necro_calcify', tree: 'necro_marrow', tier: 10, name: 'Calcify',
    flavor: 'Bone thickens where it has been broken.',
    type: 'passive', domain: 'physical', prereq: 'necro_grasp_of_death',
    trigger: null, cooldown: 0, compose: [],
    // THE DOCUMENT ASKS FOR PERCENTAGES AND THE ENGINE HAS POINTS. It declares
    // "damageReduction +0.12, maxHPMult +0.15"; `armorGrit` and `armorVit` are
    // flat Defense and flat max health, which is what a passive can grant. Kept
    // at the shipped magnitudes rather than inventing a percentage key.
    passive: { armorGrit: T.calcifyGrit, armorVit: T.calcifyVit },
    // Grants no damage, duration or field, so a second point buys nothing —
    // which the document's "+2.5% per rank" line disagrees with. See the report.
    maxRank: 1,
    ranks: R,
  },
];
