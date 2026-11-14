// REGION 7 — OFF INDONESIA (the drowned shelf of Sundaland: a sunken city and
// what the tide left in it). Six types and a boss. Native class: the Sundian.
// Mental.
//
// Authored to the horde role bands of GDD §4.3. The bodies here are invented
// sea-things and drowned sentinels, not figures from any living tradition —
// see rulings R-3.
//
// WHAT MAKES THIS REGION ITSELF: nothing comes at you in a straight line.
//
//   Six regions of crowds that walk at the player. Sundaland's commonest body
//   does not: the Tide Eel is an ORBITER, so most of the horde is circling at
//   190 units and stooping in from the side, and "back away from the crowd"
//   stops being a direction. The roster is built so the threat is always
//   lateral or behind:
//
//   The eels circle. The Lantern Lure fires from past them. The Spearfish —
//   the light special — commits to the LONGEST light lane in the game, 420
//   units, from outside the orbit; it is the lane a player crosses while
//   watching the ring. And the Tide-Caller's aura sits in the middle of the
//   drowned sentinels, the only bodies here that do walk straight.
//
//   Every earlier region can be kited in a line. This one has to be kited in
//   an arc.
//
// Domain share by encounter weight: mental 53.9%, physical 43.7%, spiritual
// 2.4% — mental leads, inside the 60% cap.

export const IND_ENEMIES = [
  // ---- the special: it commits, from outside the ring ----
  {
    // Long and thin. 420 is 60% longer than any other light lane; 50 wide is
    // narrower than any. The whole read is direction — distance does not help.
    id: 'ind_spearfish', domain: 'physical', name: 'Sunda Spearfish', behavior: 'dasher',
    hp: 8, spd: 160, dmg: 3, radius: 14, mats: 2, w: 0.9,
    shape: 'arrow', color: '#4fd8eb',
    dash: { windup: 0.55, speed: 760, dur: 0.5, cd: 2.6 },
    telegraph: {
      windupMs: 460, recoverMs: 380, cooldownMs: 3200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'line', width: 50, length: 420 }, damage: 6, domain: 'physical',
    },
  },

  // ---- fodder: no telegraph, one opener hit ----
  {
    // The commonest body, and it circles. Faster than any earlier orbiter so
    // the ring closes quickly; the stoop is the orbiter's own committed dive.
    id: 'ind_tide_eel', domain: 'mental', name: 'Tide Eel', behavior: 'orbiter',
    hp: 3, spd: 215, dmg: 4, radius: 12, mats: 1, w: 3.8,
    shape: 'diamond', color: '#7b6fd6', orbitR: 190, diveCd: 2.4, diveWindup: 0.35,
  },
  {
    // The only bodies that walk straight: the city's guards, still at post.
    id: 'ind_drowned_sentinel', domain: 'physical', name: 'Drowned Sentinel', behavior: 'chaser',
    hp: 3, spd: 175, dmg: 4, radius: 15, mats: 1, w: 3.0,
    shape: 'square', color: '#4a7f86',
  },
  {
    // An angler's light in the dark water, firing from past the ring.
    id: 'ind_lantern_lure', domain: 'mental', name: 'Lantern Lure', behavior: 'spitter',
    hp: 3, spd: 150, dmg: 3, radius: 13, mats: 2, w: 1.2,
    shape: 'pentagon', color: '#f2e27a',
    proj: { dmg: 6, speed: 285, radius: 7 }, keepDist: 285, fireCd: 2.0,
  },

  // ---- the landmarks: heavy, and seen rarely ----
  {
    id: 'ind_coral_colossus', domain: 'physical', name: 'Coral Colossus', behavior: 'brute',
    hp: 68, spd: 58, dmg: 17, radius: 29, mats: 4, w: 0.15,
    shape: 'square', color: '#d6736b',
    telegraph: {
      windupMs: 740, recoverMs: 560, cooldownMs: 3300, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'circle', radius: 148 }, damage: 44, domain: 'physical',
    },
  },
  {
    id: 'ind_tide_caller', domain: 'spiritual', name: 'Tide-Caller', behavior: 'warden',
    hp: 46, spd: 80, dmg: 10, radius: 20, mats: 4, w: 0.22,
    shape: 'hex', color: '#3d8f7a', shieldR: 160, shieldReduce: 0.5,
    telegraph: {
      windupMs: 500, recoverMs: 440, cooldownMs: 2800, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'cone', angle: 120, range: 200 }, damage: 32, domain: 'spiritual',
    },
  },
];

// THE DROWNED KING — the last ruler of the sunken city, and the water he sank
// with.
//
// Phase 1 is a CONE (the tidal sweep, 125° at 310). Phase 2 is a CIRCLE of
// 210, the largest committed circle in the game.
//
// SIGNATURE — THE UNDERTOW (`vortex`). Every eight seconds a core is marked
// under his target and, a second later, everything within 420 units is
// dragged toward it. That is the fight: the pull moves a player INTO the
// zones the rest of the kit draws. In phase 2 the tide then breaks outward as
// a `ring` of fourteen bolts — drawn in, then thrown out — so the safe answer
// to one half is the wrong place to be for the other.
//
// It is the only boss whose signature takes the player's movement away, in
// the one game where movement is the player's only input. That is why it is
// the seventh region's and not an earlier one.
export const IND_BOSS = {
  id: 'ind_boss', name: 'The Drowned King', domain: 'mental',
  hp: 4400, spd: 66, dmg: 28, radius: 52, mats: 120,
  shape: 'hex', color: '#2f5f8a',
  telegraph: {
    windupMs: 660, recoverMs: 520, cooldownMs: 2800, retryFrac: 0.25, recoverFrozen: true,
    shape: { kind: 'cone', angle: 125, range: 310 }, damage: 52, domain: 'mental',
  },
  charge: { cd: 5.2, windup: 0.85, dur: 0.75, speed: 700, width: 90, dmg: 52, minDist: 320 },
  vortex: { cd: 8, windup: 1.0, pullR: 420, pullSpd: 180, dur: 2.4, dps: 10, coreR: 120 },
  p2: {
    atFrac: 0.5, spdMult: 1.2,
    chargeCd: 4.0,
    vortex: { cd: 6, windup: 0.9, pullR: 440, pullSpd: 210, dur: 2.6, dps: 12, coreR: 125 },
    ring: { cd: 4.5, count: 14, speed: 240, dmg: 12 },
    telegraph: {
      windupMs: 500, recoverMs: 400, cooldownMs: 2300, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'circle', radius: 210 }, damage: 48, domain: 'mental',
    },
  },
};
