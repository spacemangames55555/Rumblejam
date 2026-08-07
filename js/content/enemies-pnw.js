// REGION 1 — PACIFIC NORTHWEST. Six types and a boss.
//
// TELEGRAPH DENSITY IS THE POINT OF THIS FILE, not a property it happens to
// have. The base roster telegraphs 21.4% of its population by encounter weight,
// which means roughly three quarters of incoming damage is undodgeable — and
// that decides the hold-or-break question arithmetically before any tuning
// enters it. A stance that cannot be punished is not a decision.
//
// The rule here, asserted in js/content/regions-enemies.js: EVERY heavy or
// elite archetype telegraphs, and the telegraphing share is at least half the
// population by encounter weight. Chaff stays undodgeable — that is what
// Footing's grit and vitality are for, and it is the other half of the trade.
//
// Domain skew: pacific_northwest is primary physical, capped at 60% by
// regions.js domainShareViolation(). Three of six are physical, which leaves
// room for the boss without breaching the cap.
//
// `w` is encounter weight, the same scale as the base roster.

export const PNW_ENEMIES = [
  // ---- chaff: no telegraph, and deliberately so ----
  {
    id: 'pnw_sapling', domain: 'physical', name: 'Sapling', behavior: 'chaser',
    hp: 9, spd: 130, dmg: 4, radius: 14, mats: 1, w: 2.6,
    shape: 'triangle', color: '#6f8f4a',
  },
  {
    id: 'pnw_thornhound', domain: 'physical', name: 'Thornhound', behavior: 'sprinter',
    hp: 6, spd: 220, dmg: 4, radius: 12, mats: 1, w: 2.0,
    shape: 'diamond', color: '#8a5a3c',
  },
  {
    id: 'pnw_mistwalker', domain: 'spiritual', name: 'Mistwalker', behavior: 'spitter',
    hp: 10, spd: 95, dmg: 3, radius: 14, mats: 2, w: 1.6,
    shape: 'pentagon', color: '#7fa8bf',
    proj: { dmg: 6, speed: 300, radius: 6 }, keepDist: 250, fireCd: 2.3,
  },

  // ---- heavies: every one commits ----
  {
    // The region's slab. Longest wind-up on the roster because it is the
    // biggest zone — more punishing must mean more time to read it, or the
    // decision is a coin flip rather than a read.
    id: 'pnw_bark_hulk', domain: 'physical', name: 'Bark Hulk', behavior: 'brute',
    hp: 34, spd: 66, dmg: 11, radius: 25, mats: 3, w: 2.4,
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
    hp: 24, spd: 80, dmg: 6, radius: 19, mats: 3, w: 2.2,
    shape: 'hex', color: '#9c7b4f', shieldR: 150, shieldReduce: 0.5,
    telegraph: {
      windupMs: 480, recoverMs: 420, cooldownMs: 2900, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'cone', angle: 95, range: 170 }, damage: 19, domain: 'mental',
    },
  },
  {
    // A committed line. Fast, narrow, and the one that most rewards reading the
    // direction rather than the distance.
    id: 'pnw_cedar_warden', domain: 'spiritual', name: 'Cedar Warden', behavior: 'dasher',
    hp: 15, spd: 140, dmg: 6, radius: 16, mats: 2, w: 2.0,
    shape: 'triangle', color: '#4d7a5a',
    dash: { windup: 0.5, speed: 540, dur: 0.42, cd: 2.5 },
    telegraph: {
      windupMs: 420, recoverMs: 380, cooldownMs: 2600, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'line', width: 70, length: 320 }, damage: 17, domain: 'spiritual',
    },
  },
];

// Two-phase boss. Phase 2 is not a stat multiplier: the zone shape changes, so
// the read a player learned in phase 1 stops being the right one.
export const PNW_BOSS = {
  id: 'pnw_boss', name: 'The Ceder Mother', domain: 'physical',
  hp: 900, spd: 58, dmg: 14, radius: 46, mats: 30,
  shape: 'hex', color: '#3f5d3a',
  telegraph: {
    windupMs: 700, recoverMs: 560, cooldownMs: 3000, retryFrac: 0.25, recoverFrozen: true,
    shape: { kind: 'circle', radius: 165 }, damage: 34, domain: 'physical',
  },
  p2: {
    atFrac: 0.5, spdMult: 1.15,
    telegraph: {
      windupMs: 520, recoverMs: 420, cooldownMs: 2400, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'cone', angle: 130, range: 260 }, damage: 30, domain: 'physical',
    },
  },
};
