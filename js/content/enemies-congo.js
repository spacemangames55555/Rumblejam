// REGION 5 — CENTRAL AFRICA (the Congo basin: swamp, rot, masked spirits). Six
// types and a boss. Native class: the Witch Doctor. Spiritual, with physical
// second.
//
// Authored to the horde role bands of GDD §4.3. The creatures here are
// invented swamp-and-rot bodies and a river cryptid, not figures taken from
// any living tradition's sacred stories — see rulings R-3.
//
// WHAT MAKES THIS REGION ITSELF: the crowd has things in it you must kill
// first, and things you must not be standing next to when you do.
//
//   Up to region 4 every fodder body is the same decision — it is in reach,
//   so it dies. Central Africa makes the crowd NON-UNIFORM, with the two
//   behaviours that do it:
//
//   BOMBER. A Bloat-Toad that reaches you swells and bursts; one killed
//   before it gets there bursts anyway, where it fell (the sim schedules the
//   death-boom for any bomber that did not fuse). So every toad is a circle
//   on the ground a moment after it dies, and a build that kills at arm's
//   length is standing on its own kills. Area damage is still right — WHERE
//   you stand while it lands is the new question.
//
//   MEDIC. The Mask-Bearer runs from players and toward hurt allies. Against
//   one-hit fodder it has nothing to heal; beside a landmark it restores a
//   third of an Elder Mask's health in the time a party spends kiting it. It
//   is 3 HP and it keeps its distance, so "kill the mask first" is a
//   positioning problem, not a damage one.
//
// The light special draws a LANE and the two landmarks a circle and a cone,
// so all three shapes are on the field.
//
// Domain share by encounter weight: spiritual 46.5%, physical 40.4%, mental
// 13.1% — spiritual leads, physical second, inside the 60% cap.

export const CAF_ENEMIES = [
  // ---- the special: it commits, and it is rare enough to find ----
  {
    // A young crocodile out of the mire. The lunge is the lane that crosses a
    // field already dotted with toad-circles — leaving one can mean entering
    // the other, which is region 2's overlap asked with the crowd's help.
    id: 'caf_mire_lunger', domain: 'physical', name: 'Mire Lunger', behavior: 'dasher',
    hp: 8, spd: 150, dmg: 3, radius: 16, mats: 2, w: 0.9,
    shape: 'arrow', color: '#4d6b3a',
    dash: { windup: 0.5, speed: 540, dur: 0.42, cd: 2.5 },
    telegraph: {
      windupMs: 420, recoverMs: 380, cooldownMs: 3200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'line', width: 64, length: 250 }, damage: 6, domain: 'physical',
    },
  },

  // ---- fodder: no telegraph, one opener hit ----
  {
    // The commonest body: a drowned shade walking out of the water.
    id: 'caf_mire_shade', domain: 'spiritual', name: 'Mire Shade', behavior: 'chaser',
    hp: 3, spd: 185, dmg: 3, radius: 14, mats: 1, w: 3.3,
    shape: 'circle', color: '#5f7f78',
  },
  {
    // The body that is a hazard. Slower than the shade, so a moving player is
    // never caught by one alone — it is caught by the one it did not see
    // behind the shades. Boom 5 is 6% of the 80-vitality baseline: light,
    // because there are a great many of them.
    id: 'caf_bloat_toad', domain: 'physical', name: 'Bloat-Toad', behavior: 'bomber',
    hp: 3, spd: 160, dmg: 2, radius: 14, mats: 1, w: 2.0,
    shape: 'circle', color: '#9bb04a',
    boom: { dmg: 5, radius: 62, fuse: 0.75 }, triggerDist: 56,
  },
  {
    // The priority target. `healPs` is scaled by the region's damage axis in
    // the sim (×2.75 here), so 9 authored is about 25 HP/s onto a landmark
    // carrying ~270 — a third of it back in four seconds if the mask is left
    // alone. Flees inside 300 units, as the medic behaviour does.
    id: 'caf_mask_bearer', domain: 'mental', name: 'Mask-Bearer', behavior: 'medic',
    hp: 3, spd: 150, dmg: 2, radius: 13, mats: 2, w: 1.0,
    shape: 'cross', color: '#d9c7a0', healPs: 9, healR: 170,
  },

  // ---- the landmarks: heavy, and seen rarely ----
  {
    id: 'caf_rot_hippo', domain: 'physical', name: 'Rot Hippo', behavior: 'brute',
    hp: 60, spd: 62, dmg: 15, radius: 28, mats: 4, w: 0.18,
    shape: 'square', color: '#6b5a66',
    telegraph: {
      windupMs: 720, recoverMs: 540, cooldownMs: 3200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'circle', radius: 140 }, damage: 40, domain: 'physical',
    },
  },
  {
    // Carries the warden's ally aura: bodies within 160 take half damage, so
    // fodder standing in it is NOT one-hit. With a Mask-Bearer behind it this
    // is the region's whole lesson in one place.
    id: 'caf_elder_mask', domain: 'spiritual', name: 'Elder Mask', behavior: 'warden',
    hp: 40, spd: 80, dmg: 9, radius: 20, mats: 4, w: 0.25,
    shape: 'hex', color: '#a8452f', shieldR: 160, shieldReduce: 0.5,
    telegraph: {
      windupMs: 500, recoverMs: 440, cooldownMs: 2800, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'cone', angle: 110, range: 190 }, damage: 28, domain: 'spiritual',
    },
  },
];

// MOKELE-MBEMBE, THE RIVER-STOPPER — the Congo's river cryptid, "the one who
// stops the flow of rivers".
//
// Phase 1 is a CIRCLE: the stomp, 185 around a slow body. Phase 2 breaks the
// river — a lane 120 wide and 500 long — so a party that learned to stand off
// at range learns that range is where the lane goes.
//
// SIGNATURE — THE GROUND ROTS (`pools`). Three telegraphed pools every seven
// seconds, the first always under his target, each staying for five seconds.
// The arena gets smaller as the fight goes on, and the stomp and the lane are
// read on whatever ground is left. Nothing here is a bigger normal enemy: the
// boss's real attack is the floor.
export const CAF_BOSS = {
  id: 'caf_boss', name: 'Mokele-mbembe, the River-Stopper', domain: 'spiritual',
  hp: 3200, spd: 60, dmg: 24, radius: 54, mats: 90,
  shape: 'hex', color: '#3d5a4a',
  telegraph: {
    windupMs: 700, recoverMs: 540, cooldownMs: 2900, retryFrac: 0.25, recoverFrozen: true,
    shape: { kind: 'circle', radius: 185 }, damage: 48, domain: 'spiritual',
  },
  charge: { cd: 5.4, windup: 0.9, dur: 0.75, speed: 640, width: 96, dmg: 48, minDist: 300 },
  pools: { cd: 7, count: 3, radius: 80, windup: 1.0, dps: 12, dur: 5 },
  p2: {
    atFrac: 0.5, spdMult: 1.15,
    chargeCd: 4.2,
    pools: { cd: 5, count: 4, radius: 85, windup: 0.9, dps: 14, dur: 6 },
    telegraph: {
      windupMs: 520, recoverMs: 420, cooldownMs: 2300, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'line', width: 120, length: 500 }, damage: 44, domain: 'spiritual',
    },
  },
};
