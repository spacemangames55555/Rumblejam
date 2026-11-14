// REGION 8 — THE AUSTRALIAN OUTBACK (the desert, and the megafauna that once
// walked it). Six types and the last boss in the game. Native class: the
// Hunter. EVEN across all three domains.
//
// Authored to the horde role bands of GDD §4.3.
//
// ON THE SOURCE MATERIAL. The GDD names this region for the Dreaming and for
// desert megafauna. This roster is built ENTIRELY from the second: the
// Pleistocene animals of the continent (Thylacoleo, Diprotodon, Genyornis,
// Megalania) and the country itself (dust, heat, fire). No ancestral being
// and no figure from any people's Dreaming is used as a monster to be killed.
// That is a ruling, R-3, and it is the user's to revisit.
//
// WHAT MAKES THIS REGION ITSELF: everything at once, and no single answer.
//
//   Each earlier region leans on one domain, so a party can re-spec into the
//   triangle and be rewarded. The Outback is the exam: the three fodder
//   bodies are one per domain at near-equal weight, so whatever a build is
//   strong against is a third of the crowd and whatever it is weak against is
//   another third. §3.2 says the endgame "demands full party coverage rather
//   than one counter-build", and this is where that is cashed.
//
//   The reads are all here too — a lane on the special, a circle and a cone
//   on the landmarks — and the three fodder behaviours are the three ways a
//   crowd arrives: the dingo runs at you, the mirage circles you, the cinder
//   fires at you. Nothing new is taught in region 8. Everything is asked.
//
// Domain share by encounter weight: physical 37.0%, mental 32.6%, spiritual
// 30.4% — the cap here is 40%, not 60%.

export const AUS_ENEMIES = [
  // ---- the special: it commits, and it is rare enough to find ----
  {
    // The marsupial lion: the ambush predator of the old continent. A fast,
    // short lane — the pounce — on the shortest light wind-up in the game
    // above the reaction floor, because it is the last region.
    id: 'aus_thylacoleo', domain: 'physical', name: 'Thylacoleo', behavior: 'dasher',
    hp: 8, spd: 165, dmg: 3, radius: 15, mats: 2, w: 0.9,
    shape: 'arrow', color: '#b8894f',
    dash: { windup: 0.45, speed: 600, dur: 0.4, cd: 2.4 },
    telegraph: {
      windupMs: 380, recoverMs: 360, cooldownMs: 3000, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'line', width: 66, length: 270 }, damage: 6, domain: 'physical',
    },
  },

  // ---- fodder: one per domain, near-equal weight ----
  {
    id: 'aus_dust_dingo', domain: 'physical', name: 'Dust Dingo', behavior: 'sprinter',
    hp: 3, spd: 245, dmg: 4, radius: 12, mats: 1, w: 2.6,
    shape: 'triangle', color: '#c9a36b',
  },
  {
    id: 'aus_mirage', domain: 'mental', name: 'Mirage', behavior: 'orbiter',
    hp: 3, spd: 205, dmg: 4, radius: 12, mats: 1, w: 3.0,
    shape: 'diamond', color: '#e6d9c0', orbitR: 190, diveCd: 2.4, diveWindup: 0.35,
  },
  {
    // Ranged fodder at a third of the crowd is more projectiles than any
    // earlier region fields, so the cadence is the slowest of any spitter
    // (2.6 s) — the pressure is that there are many, not that each is fast.
    id: 'aus_cinder', domain: 'spiritual', name: 'Bushfire Cinder', behavior: 'spitter',
    hp: 3, spd: 160, dmg: 3, radius: 13, mats: 1, w: 3.0,
    shape: 'pentagon', color: '#ff7b3a',
    proj: { dmg: 5, speed: 300, radius: 6 }, keepDist: 260, fireCd: 2.6,
  },

  // ---- the landmarks: heavy, and seen rarely ----
  {
    // The giant wombat — three tonnes of it. The heaviest landmark in the
    // game at the lowest draw weight (landmark frequency goes inverse to
    // weight, roster brief constraint 6).
    id: 'aus_diprotodon', domain: 'physical', name: 'Diprotodon', behavior: 'brute',
    hp: 72, spd: 58, dmg: 18, radius: 30, mats: 4, w: 0.15,
    shape: 'square', color: '#8a6a4f',
    telegraph: {
      windupMs: 740, recoverMs: 560, cooldownMs: 3300, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'circle', radius: 150 }, damage: 46, domain: 'physical',
    },
  },
  {
    // The thunder bird: two metres of flightless bird whose cry is the cone.
    id: 'aus_genyornis', domain: 'mental', name: 'Genyornis', behavior: 'warden',
    hp: 48, spd: 84, dmg: 10, radius: 20, mats: 4, w: 0.22,
    shape: 'hex', color: '#6f8f9a', shieldR: 160, shieldReduce: 0.5,
    telegraph: {
      windupMs: 500, recoverMs: 440, cooldownMs: 2800, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'cone', angle: 120, range: 205 }, damage: 34, domain: 'mental',
    },
  },
];

// MEGALANIA, THE LAST DRAGON — seven metres of monitor lizard, the largest
// land lizard that ever lived, and the last fight in the game.
//
// §3.4: clearing region 8 completes the run. The Vault Regent held this slot
// as a redistributed legacy boss and carried ×10 health "to be an endurance
// test rather than one more fight". This boss keeps that intent — the longest
// fight in the game by a wide margin — and keeps the Regent's signature too,
// lifted out of its bespoke kit into the same blocks every other region boss
// now uses.
//
// Phase 1 is a CIRCLE (physical): the tail, 200 around the body. Phase 2 is a
// LANE (spiritual): the breath, 130 wide and 520 long — the body and its two
// committed attacks are deliberately three different relationships to the
// triangle, because this is the even region.
//
// SIGNATURE — EVERYTHING THE RUN TAUGHT. `beams`: three rotating lanes the
// party has to walk with, the Regent's own. `ring`: a burst of sixteen bolts
// between them. And in phase 2 `adds`: the dingo pack arrives, so the last
// phase of the last fight is a boss inside a horde — which is the game.
export const AUS_BOSS = {
  id: 'aus_boss', name: 'Megalania, the Last Dragon', domain: 'physical',
  hp: 8000, spd: 72, dmg: 30, radius: 56, mats: 150,
  shape: 'hex', color: '#7a5a2f',
  telegraph: {
    windupMs: 680, recoverMs: 520, cooldownMs: 2800, retryFrac: 0.25, recoverFrozen: true,
    shape: { kind: 'circle', radius: 200 }, damage: 56, domain: 'physical',
  },
  charge: { cd: 5.0, windup: 0.85, dur: 0.75, speed: 720, width: 92, dmg: 56, minDist: 320 },
  beams: { cd: 9, windup: 1.3, count: 3, width: 26, spin: 0.5, dur: 3.0, dmg: 16 },
  ring: { cd: 4, count: 16, speed: 280, dmg: 12 },
  p2: {
    atFrac: 0.5, spdMult: 1.25,
    chargeCd: 3.6,
    beams: { cd: 7.5, windup: 1.2, count: 4, width: 26, spin: 0.55, dur: 3.2, dmg: 16 },
    ring: { cd: 3, count: 18, speed: 300, dmg: 12 },
    adds: { cd: 8, count: 5, id: 'aus_dust_dingo', cap: 12 },
    telegraph: {
      windupMs: 500, recoverMs: 400, cooldownMs: 2200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'line', width: 130, length: 520 }, damage: 52, domain: 'spiritual',
    },
  },
};
