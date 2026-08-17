// REGION 1 — PACIFIC NORTHWEST. Six types and a boss.
//
// TELEGRAPH DENSITY IS THE POINT OF THIS FILE, not a property it happens to
// have. The base roster telegraphs 21.4% of its population by encounter weight,
// which means roughly three quarters of incoming damage is undodgeable — and
// that decides the hold-or-break question arithmetically before any tuning
// enters it. A stance that cannot be punished is not a decision.
//
// The rule here, asserted in js/content/regions-enemies.js: every COMMITTING
// behaviour telegraphs, and the telegraphing share is at least half the
// population by encounter weight. Chaff stays undodgeable — that is what
// Footing's grit and vitality are for, and it is the other half of the trade.
//
// AND TELEGRAPHING IS NOT A LICENCE TO BE HEAVY. The first version of this file
// met that density floor the only way the old `HEAVY_BEHAVIORS` name suggested:
// every unit permitted to telegraph was also authored as a slab. Measured, the
// roster came out at ×2.14 the weighted mean HP and ×1.69 the damage of the
// floor-1 table it replaces — at a world multiplier of ×1.00, so all of that
// weight was in the units themselves. A level-12 contact tank that held ground
// on floor 1 indefinitely died in 46 seconds here.
//
// The fix is not less telegraph and not a flat HP cut. It is LIGHT
// TELEGRAPHERS: units that wind up visibly, read at a glance, and die fast.
// Region 1 is where a player learns to read a wind-up at all, so it wants the
// most density and the least weight — and it had the most of both.
//
//   Sapling      re-authored from a 9 HP chaser into a 7 HP warden with a short
//                close cone. The commonest unit on the roster now teaches the
//                read, which is the one thing map 1 exists to do.
//   Cedar Warden 15 → 7 HP, zone 17 → 9. It was never one of the two landmarks
//                — the file calls it "a committed line", not a slab — so it is
//                the unit to lighten rather than a heavy to soften.
//   Bark Hulk    STATS UNTOUCHED, weight 2.4 → 0.25.
//   Rootbound Elk STATS UNTOUCHED, weight 2.2 → 0.35.
//
// The two landmarks keep every number they had and lose their frequency. A
// heavy that appears rarely is a landmark; a heavy softened into a mid unit is
// nothing, and the roster already has mids.
//
// Domain skew: pacific_northwest is primary physical, capped at 60% by
// regions.js domainShareViolation(). Three of six are physical, which leaves
// room for the boss without breaching the cap.
//
// `w` is encounter weight, the same scale as the base roster.

export const PNW_ENEMIES = [
  // ---- light telegraphers: they commit, and they die ----
  {
    // THE ROSTER'S TEACHER, and the commonest thing in it. A sapling roots and
    // lashes: a slow walk, a short close cone, and seven hit points. A player
    // meets this more than anything else in region 1, which is exactly where a
    // wind-up should be learned.
    //
    // `warden` rather than `chaser` because only a COMMITTING behaviour may
    // telegraph (rule 1), and a slow advance is what a walking plant does. It
    // carries no `shieldR`, so it grants no ally aura — the Elk's 50% reduction
    // is a landmark's privilege and would be absurd on a 7 HP unit.
    //
    // The wind-up is short (380ms, just over the 350ms reaction floor) and the
    // zone is small, following the same rule the Bark Hulk states from the
    // other end: more punishing must mean more time to read it.
    //
    // AND THE PUNISH IS SIZED TO THE UNIT, not just the wind-up. Measured, HP
    // parity alone did not fix the fight: a camper still died at 71s because
    // 58% of everything reaching it was telegraph zones, and a 7 HP unit
    // landing 9 damage every 2.2 seconds hits harder per commit than a 34 HP
    // Bark Hulk does per second. A unit that dies in two hits should not
    // punish like one that takes ten. Five damage on a 3s cycle is 3% of a
    // level-12 character and 12% of the level-1 one that meets it on map 1 —
    // a real lesson where it is taught, a nuisance where it is not.
    id: 'pnw_sapling', domain: 'physical', name: 'Sapling', behavior: 'warden',
    hp: 7, spd: 108, dmg: 3, radius: 14, mats: 1, w: 3.0,
    shape: 'triangle', color: '#6f8f4a',
    telegraph: {
      windupMs: 380, recoverMs: 260, cooldownMs: 3000, retryFrac: 0.3, recoverFrozen: true,
      shape: { kind: 'cone', angle: 70, range: 105 }, damage: 5, domain: 'physical',
    },
  },
  {
    // A committed line. Fast, narrow, and the one that most rewards reading the
    // direction rather than the distance.
    //
    // 15 → 7 HP and zone 17 → 6, on a longer cycle. This was the roster's mid,
    // not one of its two landmarks, and it is the unit to lighten rather than a
    // heavy to soften. The read it teaches — a lane, not a radius — is
    // unchanged; only the cost of being wrong and the time to kill it moved.
    // Slightly more punishing than the Sapling because a lane is easier to
    // leave than a cone you are standing inside.
    id: 'pnw_cedar_warden', domain: 'spiritual', name: 'Cedar Warden', behavior: 'dasher',
    hp: 7, spd: 140, dmg: 3, radius: 16, mats: 2, w: 2.6,
    shape: 'triangle', color: '#4d7a5a',
    dash: { windup: 0.5, speed: 540, dur: 0.42, cd: 2.5 },
    telegraph: {
      windupMs: 420, recoverMs: 380, cooldownMs: 3200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'line', width: 70, length: 260 }, damage: 6, domain: 'spiritual',
    },
  },

  // ---- chaff: no telegraph, and deliberately so ----
  //
  // Two rather than three, because a light telegrapher took a slot. Rule 3 is
  // about PROPORTION — if everything commits, holding stance is always punished
  // and Footing collapses into "always break" — and two undodgeable archetypes
  // at 4.4 of 10.6 encounter weight is 42% of the room that cannot be read.
  {
    id: 'pnw_thornhound', domain: 'physical', name: 'Thornhound', behavior: 'sprinter',
    hp: 6, spd: 220, dmg: 4, radius: 12, mats: 1, w: 2.8,
    shape: 'diamond', color: '#8a5a3c',
  },
  {
    id: 'pnw_mistwalker', domain: 'spiritual', name: 'Mistwalker', behavior: 'spitter',
    hp: 10, spd: 95, dmg: 3, radius: 14, mats: 2, w: 1.6,
    shape: 'pentagon', color: '#7fa8bf',
    proj: { dmg: 6, speed: 300, radius: 6 }, keepDist: 250, fireCd: 2.3,
  },

  // ---- the landmarks: every stat untouched, seen rarely ----
  //
  // Their weights carry the whole weight reduction that the two re-authored
  // units did not: 2.4 → 0.25 and 2.2 → 0.35. At ~40 spawns in a map that is
  // roughly one Bark Hulk and one Elk per room — an event rather than a
  // texture. Softening their numbers instead would have produced two more mids
  // and no landmark at all.
  {
    // The region's slab. Longest wind-up on the roster because it is the
    // biggest zone — more punishing must mean more time to read it, or the
    // decision is a coin flip rather than a read.
    id: 'pnw_bark_hulk', domain: 'physical', name: 'Bark Hulk', behavior: 'brute',
    hp: 34, spd: 66, dmg: 11, radius: 25, mats: 3, w: 0.25,
    shape: 'square', color: '#5d4a33',
    telegraph: {
      windupMs: 680, recoverMs: 520, cooldownMs: 3300, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'circle', radius: 125 }, damage: 27, domain: 'physical',
    },
  },
  {
    // A cleave rather than a slam: narrower, so the sidestep is a smaller
    // movement and a shorter wind-up is still fair.
    id: 'pnw_elk', domain: 'mental', name: 'Rootbound Elk', behavior: 'warden',
    hp: 24, spd: 80, dmg: 6, radius: 19, mats: 3, w: 0.35,
    shape: 'hex', color: '#9c7b4f', shieldR: 150, shieldReduce: 0.5,
    telegraph: {
      windupMs: 480, recoverMs: 420, cooldownMs: 2900, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'cone', angle: 95, range: 170 }, damage: 19, domain: 'mental',
    },
  },
];

// Two-phase boss. Phase 2 is not a stat multiplier: the zone shape changes, so
// the read a player learned in phase 1 stops being the right one.
export const PNW_BOSS = {
  id: 'pnw_boss', name: 'The Cedar Mother', domain: 'physical',
  hp: 900, spd: 58, dmg: 14, radius: 46, mats: 30,
  shape: 'hex', color: '#3f5d3a',
  telegraph: {
    windupMs: 700, recoverMs: 560, cooldownMs: 3000, retryFrac: 0.25, recoverFrozen: true,
    shape: { kind: 'circle', radius: 165 }, damage: 34, domain: 'physical',
  },
  // THE ANSWER TO KITING, and the only one that does not break the commit
  // rule. `windupMs` here is longer than the slam's because the lane is longer
  // and a player has further to travel to leave it: 900ms to read a 78-wide
  // corridor is the same generosity the 700ms slam gives at radius 165.
  //
  // Damage sits at the slam's 34 rather than above it. This is a REACH fix,
  // not a difficulty raise — a player who stood in melee and read the circle
  // faces exactly what they always faced, and a player who stood at 700 units
  // faces the same number instead of nothing at all.
  charge: { cd: 5.2, windup: 0.9, dur: 0.75, speed: 620, width: 78, dmg: 34, minDist: 210 },
  p2: {
    atFrac: 0.5, spdMult: 1.15,
    // Phase 2 shortens the gap between lanes rather than widening or
    // strengthening them — same read, less time to sit still between reads.
    chargeCd: 4.0,
    telegraph: {
      windupMs: 520, recoverMs: 420, cooldownMs: 2400, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'cone', angle: 130, range: 260 }, damage: 30, domain: 'physical',
    },
  },
};
