// REGION 6 — NORTHERN RUSSIA (Slavic myth, the frozen dead, deep winter). Six
// types and a boss. Native class: the Necromancer. Physical, with mental
// second.
//
// Authored to the horde role bands of GDD §4.3.
//
// WHAT MAKES THIS REGION ITSELF: the crowd is not always one hit.
//
//   Every region before this keeps the promise that fodder dies to one
//   opener. Russia is where the roster itself breaks it, deliberately and
//   legibly: the light special is a SHIELD-BEARER, a warden carrying the ally
//   aura that only landmarks have worn until now. Fodder inside 130 units of
//   one takes half damage — a 4 HP body shrugging off a 5-damage hit — so a
//   patch of the horde stops dying, and the only fix is the body in the
//   middle of it.
//
//   It is the same rule as region 5's Elder Mask, moved from a landmark you
//   meet once a room to a special you meet constantly. The shield-wall is the
//   texture of the region rather than an event in it, and target priority
//   stops being something a player does at a landmark and becomes how the
//   crowd is read from second to second.
//
//   The fodder supports it: the Frozen Dead walk slowly and hit hard (they
//   are meant to arrive AS a line, under a shield), the Blizzard Wraith
//   circles and stoops from outside the line, and the Rusalka fires from
//   behind it.
//
// Domain share by encounter weight: physical 53.3%, mental 32.5%, spiritual
// 14.2% — physical leads, mental second, inside the 60% cap.

export const RU_ENEMIES = [
  // ---- the special: it commits, and it changes the crowd around it ----
  {
    // A frozen warrior of the old retinue, shield up. `shieldR: 130` is
    // smaller than a landmark's 150–160 on purpose: the protected patch is a
    // knot in the crowd, not half the room, and a player can see its edge.
    // 8 HP and no aura on itself — it dies in two hits like any special, and
    // the knot comes apart with it.
    id: 'ru_shieldbearer', domain: 'physical', name: 'Druzhina Shade', behavior: 'warden',
    hp: 8, spd: 110, dmg: 3, radius: 15, mats: 2, w: 0.9,
    shape: 'hex', color: '#7d93a8', shieldR: 130, shieldReduce: 0.5,
    telegraph: {
      windupMs: 420, recoverMs: 300, cooldownMs: 3000, retryFrac: 0.3, recoverFrozen: true,
      shape: { kind: 'cone', angle: 80, range: 130 }, damage: 6, domain: 'physical',
    },
  },

  // ---- fodder: no telegraph, one opener hit — unless it is under a shield ----
  {
    // The line. The slowest chaser in the game and the hardest-hitting
    // fodder: dmg 5 where every other region's chaser deals 3. Slow so that
    // it arrives together, under a shield, rather than as a stream.
    id: 'ru_frozen_dead', domain: 'physical', name: 'Frozen Dead', behavior: 'chaser',
    hp: 3, spd: 150, dmg: 5, radius: 15, mats: 1, w: 3.4,
    shape: 'square', color: '#9fb4c2',
  },
  {
    // The threat from outside the line: circles in the snow, then stoops.
    id: 'ru_blizzard_wraith', domain: 'mental', name: 'Blizzard Wraith', behavior: 'orbiter',
    hp: 3, spd: 205, dmg: 4, radius: 12, mats: 1, w: 2.6,
    shape: 'diamond', color: '#dfe9f2', orbitR: 190, diveCd: 2.5, diveWindup: 0.35,
  },
  {
    // Ranged fodder from behind the line — the drowned girl under the ice.
    id: 'ru_rusalka', domain: 'spiritual', name: 'Rusalka', behavior: 'spitter',
    hp: 3, spd: 150, dmg: 3, radius: 14, mats: 2, w: 1.2,
    shape: 'pentagon', color: '#6fa8a0',
    proj: { dmg: 5, speed: 300, radius: 6 }, keepDist: 265, fireCd: 2.2,
  },

  // ---- the landmarks: heavy, and seen rarely ----
  {
    // The forest's own giant, come north. The widest light-landmark circle so
    // far, on the longest wind-up.
    id: 'ru_leshy', domain: 'mental', name: 'Leshy', behavior: 'brute',
    hp: 64, spd: 60, dmg: 16, radius: 29, mats: 4, w: 0.16,
    shape: 'square', color: '#4e5d43',
    telegraph: {
      windupMs: 740, recoverMs: 560, cooldownMs: 3300, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'circle', radius: 145 }, damage: 42, domain: 'mental',
    },
  },
  {
    // The revenant that does not wait for the line: a lane through it.
    id: 'ru_upyr', domain: 'physical', name: 'Upyr', behavior: 'dasher',
    hp: 42, spd: 88, dmg: 10, radius: 20, mats: 4, w: 0.22,
    shape: 'arrow', color: '#7a2f3a',
    dash: { windup: 0.6, speed: 580, dur: 0.5, cd: 3.0 },
    telegraph: {
      windupMs: 520, recoverMs: 440, cooldownMs: 3000, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'line', width: 84, length: 340 }, damage: 30, domain: 'physical',
    },
  },
];

// KOSCHEI THE DEATHLESS — whose death is not in his body.
//
// In the tale his death is a needle, in an egg, in a duck, in a hare, in a
// chest, far from wherever he is standing. So is the fight.
//
// Phase 1 is a LANE (the sword, 90 wide and 460 long). Phase 2 is a CONE of
// 130° at 300, wider than a sidestep clears.
//
// SIGNATURE — HIS DEATH IS ELSEWHERE (`ward`, phase 2 only). At half health
// the ward rises on the far side of the room, and while it stands he ignores
// 85% of every hit and everything in the room hits 30% harder (the siege
// pylon's own rule, reused whole). The fight stops being about him: the party
// has to cross the arena, through the crowd, and break the ward while he
// follows — and the 15% that still lands is there so the health bar keeps
// moving and nobody mistakes the mechanic for a bug.
//
// `hpMult: 0.45` because the siege pylon rides the world axis (×6.02 here)
// and would arrive at more than half of Koschei's own health; at 0.45 it is
// roughly ten seconds of a level-46 character's focus.
export const RU_BOSS = {
  id: 'ru_boss', name: 'Koschei the Deathless', domain: 'mental',
  hp: 3600, spd: 70, dmg: 26, radius: 46, mats: 105,
  shape: 'hex', color: '#8fa3b0',
  telegraph: {
    windupMs: 640, recoverMs: 520, cooldownMs: 2800, retryFrac: 0.25, recoverFrozen: true,
    shape: { kind: 'line', width: 90, length: 460 }, damage: 50, domain: 'mental',
  },
  charge: { cd: 5.0, windup: 0.85, dur: 0.75, speed: 700, width: 86, dmg: 50, minDist: 300 },
  p2: {
    atFrac: 0.5, spdMult: 1.2,
    chargeCd: 3.8,
    ward: { reduce: 0.85, hpMult: 0.45 },
    telegraph: {
      windupMs: 480, recoverMs: 400, cooldownMs: 2200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'cone', angle: 130, range: 300 }, damage: 46, domain: 'mental',
    },
  },
};
