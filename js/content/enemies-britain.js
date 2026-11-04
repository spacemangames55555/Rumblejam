// REGION 3 — GREAT BRITAIN (fae courts, standing stones, hill gods). Six types
// and a boss. Native class: the Bard. Primary domain: mental.
//
// No band scaling inside the roster: `REGION_HP_MULT[2]` (×3.84) is the only
// thing that makes this region harder than region 1.
//
// WHAT MAKES THIS REGION ITSELF is that its light special draws a CIRCLE.
// Region 1 and region 2 teach the light reads as cones and lanes — a direction
// to step out of. A circle centred on an 8 HP Redcap has no "side": the only
// answer is distance, so the sidestep stops being enough.
//
// Roster numbers are Game Designer's Item 6 spec. Fields the spec did not name
// (radius, mats, colour, cooldowns, projectile and orbit parameters, the
// landmarks' walk speed) mirror the region-2 unit in the same role, so the
// only things that differ from Central America are the ones the spec chose.

export const GB_ENEMIES = [
  // ---- HORDE PACE (pace-spec.md, user ruling 2 Nov 2026) ----
  //
  // Region 3 is authored as a HORDE roster: fodder plus a few specials, only
  // specials and bosses telegraph, 8–25% telegraphing by encounter weight.
  // The REGION_ENEMIES entry carries `horde: true`. Fodder is authored at the
  // same 3 HP as region 1's; the world axis (`REGION_HP_MULT`) is the only
  // multiplier, so the hit counts match region 1's at the anchor level.
  //
  // The region's identity is kept where it belongs: the ONE teachable special
  // is the Redcap, and it still draws a light CIRCLE, the read region 1 and 2
  // do not give their light units. The Wild Hunt rides as fast fodder and the
  // Sidhe Knight and Stone Giant stay the landmarks, every stat intact.

  // ---- the special: it commits, and it is rare enough to find ----
  {
    // The teachable special and the first light circle in the game. hp 7 → 8
    // (above fodder, 2.7× it), w 2.8 → 0.9 (region 1's Cedar Warden weight).
    // Walk speed, telegraph and punish are unchanged: 6 dmg is 7.5% of 80.
    id: 'gb_redcap', domain: 'mental', name: 'Redcap', behavior: 'warden',
    hp: 8, spd: 110, dmg: 3, radius: 14, mats: 2, w: 0.9,
    shape: 'circle', color: '#a3352b',
    telegraph: {
      windupMs: 400, recoverMs: 280, cooldownMs: 3000, retryFrac: 0.3, recoverFrozen: true,
      shape: { kind: 'circle', radius: 90 }, damage: 6, domain: 'mental',
    },
  },

  // ---- fodder: no telegraph, one opener hit ----
  {
    // The Wild Hunt as the fast fodder: a pack of riders that arrives, not a
    // lane to read. dasher → sprinter (a dasher must telegraph, and fodder
    // must not), hp 7 → 3, spd 150 → 245 (region 1's Thornhound), w 2.5 → 3.5.
    id: 'gb_hunt_rider', domain: 'physical', name: 'Wild Hunt Rider', behavior: 'sprinter',
    hp: 3, spd: 245, dmg: 3, radius: 16, mats: 1, w: 3.5,
    shape: 'triangle', color: '#4a4f5c',
  },
  {
    // The commonest body: a swarm of sprites. hp 6 → 3, spd 170 → 200, w 2.4 → 4.0.
    id: 'gb_sprite', domain: 'mental', name: 'Sprite', behavior: 'orbiter',
    hp: 3, spd: 200, dmg: 4, radius: 12, mats: 1, w: 4.0,
    shape: 'diamond', color: '#b7a0e8', orbitR: 185, diveCd: 2.5, diveWindup: 0.35,
  },
  {
    // Ranged fodder, as region 1's Mistwalker: hp 9 → 3, spd 90 → 165, w 1.6 → 1.0.
    id: 'gb_banshee', domain: 'spiritual', name: 'Banshee', behavior: 'spitter',
    hp: 3, spd: 165, dmg: 3, radius: 15, mats: 2, w: 1.0,
    shape: 'pentagon', color: '#c8d6dc',
    proj: { dmg: 5, speed: 315, radius: 6 }, keepDist: 265, fireCd: 2.1,
  },

  // ---- the landmarks: heavy, and seen rarely ----
  {
    id: 'gb_stone_giant', domain: 'physical', name: 'Stone Giant', behavior: 'brute',
    hp: 50, spd: 62, dmg: 14, radius: 27, mats: 4, w: 0.20,
    shape: 'square', color: '#7d7a6e',
    telegraph: {
      windupMs: 700, recoverMs: 540, cooldownMs: 3200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'circle', radius: 130 }, damage: 36, domain: 'physical',
    },
  },
  {
    id: 'gb_sidhe_knight', domain: 'mental', name: 'Sidhe Knight', behavior: 'warden',
    hp: 36, spd: 82, dmg: 8, radius: 20, mats: 4, w: 0.25,
    shape: 'hex', color: '#5e8f6b', shieldR: 155, shieldReduce: 0.5,
    telegraph: {
      windupMs: 500, recoverMs: 440, cooldownMs: 2800, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'cone', angle: 110, range: 190 }, damage: 26, domain: 'mental',
    },
  },
];

// THE HOLLOW KING. Phase 1 is region 2's read — a 120° cone at 300 plus the
// lane charge — so a player arrives knowing it. Phase 2 takes the direction
// away: the zone becomes a circle of 190 around the king, and the only way out
// is distance, which is the same lesson the Redcap teaches at 7 HP.
//
// HP follows the 900 → 1600 → 2300 line. Damage, timings, radius and the
// charge block are region 2's, unchanged, pending the boss sim (spec named HP
// and shapes only).
export const GB_BOSS = {
  id: 'gb_boss', name: 'The Hollow King', domain: 'mental',
  hp: 2300, spd: 64, dmg: 20, radius: 48, mats: 60,
  shape: 'hex', color: '#4b3f6b',
  telegraph: {
    windupMs: 640, recoverMs: 520, cooldownMs: 2800, retryFrac: 0.25, recoverFrozen: true,
    shape: { kind: 'cone', angle: 120, range: 300 }, damage: 44, domain: 'mental',
  },
  charge: { cd: 5.0, windup: 0.85, dur: 0.75, speed: 660, width: 84, dmg: 44, minDist: 300 },
  p2: {
    atFrac: 0.5, spdMult: 1.2,
    chargeCd: 3.8,
    telegraph: {
      windupMs: 470, recoverMs: 400, cooldownMs: 2200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'circle', radius: 190 }, damage: 40, domain: 'mental',
    },
  },
};
