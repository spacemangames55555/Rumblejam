// REGION 2 — CENTRAL AMERICA (the xibalba tileset). Six types and a boss.
//
// Same density rule as region 1 and for the same reason: every heavy or elite
// archetype commits, chaff does not, and the telegraphing share is at least
// half the population by encounter weight. See enemies-pnw.js for why.
//
// Region 2's skew is spiritual (regions.js), and it sits ten levels above
// region 1 — so the numbers are higher, but the SHAPES are what differ. Region
// 1 teaches circle, cone and line separately; region 2 overlaps them, which is
// what makes the sidestep a choice of direction rather than a reflex.

export const XIB_ENEMIES = [
  // ---- chaff ----
  {
    id: 'xib_howler', domain: 'spiritual', name: 'Howler', behavior: 'chaser',
    hp: 14, spd: 138, dmg: 6, radius: 14, mats: 1, w: 2.4,
    shape: 'circle', color: '#8e4a7a',
  },
  {
    id: 'xib_ashmoth', domain: 'mental', name: 'Ashmoth', behavior: 'orbiter',
    hp: 10, spd: 170, dmg: 6, radius: 12, mats: 2, w: 1.8,
    shape: 'diamond', color: '#c98b3a', orbitR: 185, diveCd: 2.5, diveWindup: 0.35,
  },
  {
    id: 'xib_censer', domain: 'spiritual', name: 'Censer Bearer', behavior: 'spitter',
    hp: 15, spd: 90, dmg: 5, radius: 15, mats: 2, w: 1.5,
    shape: 'pentagon', color: '#6a9a7a',
    proj: { dmg: 9, speed: 315, radius: 6 }, keepDist: 265, fireCd: 2.1,
  },

  // ---- heavies: every one commits ----
  {
    id: 'xib_jade_colossus', domain: 'physical', name: 'Jade Colossus', behavior: 'brute',
    hp: 52, spd: 62, dmg: 15, radius: 27, mats: 4, w: 2.4,
    shape: 'square', color: '#2f7d6a',
    telegraph: {
      windupMs: 700, recoverMs: 540, cooldownMs: 3200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'circle', radius: 135 }, damage: 38, domain: 'physical',
    },
  },
  {
    id: 'xib_bloodpriest', domain: 'spiritual', name: 'Bloodpriest', behavior: 'warden',
    hp: 36, spd: 82, dmg: 8, radius: 20, mats: 4, w: 2.2,
    shape: 'hex', color: '#9c2f3a', shieldR: 155, shieldReduce: 0.5,
    telegraph: {
      windupMs: 500, recoverMs: 440, cooldownMs: 2800, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'cone', angle: 110, range: 190 }, damage: 26, domain: 'spiritual',
    },
  },
  {
    id: 'xib_obsidian_lancer', domain: 'physical', name: 'Obsidian Lancer', behavior: 'dasher',
    hp: 22, spd: 150, dmg: 9, radius: 16, mats: 3, w: 2.0,
    shape: 'triangle', color: '#3a3a4d',
    dash: { windup: 0.48, speed: 600, dur: 0.45, cd: 2.3 },
    telegraph: {
      windupMs: 400, recoverMs: 360, cooldownMs: 2400, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'line', width: 78, length: 360 }, damage: 24, domain: 'physical',
    },
  },
];

export const XIB_BOSS = {
  id: 'xib_boss', name: 'Ixkik, the Blood Moon', domain: 'spiritual',
  hp: 1600, spd: 64, dmg: 20, radius: 48, mats: 45,
  shape: 'hex', color: '#6d1f3d',
  telegraph: {
    windupMs: 640, recoverMs: 520, cooldownMs: 2800, retryFrac: 0.25, recoverFrozen: true,
    shape: { kind: 'cone', angle: 120, range: 300 }, damage: 44, domain: 'spiritual',
  },
  p2: {
    atFrac: 0.5, spdMult: 1.2,
    telegraph: {
      windupMs: 470, recoverMs: 400, cooldownMs: 2200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'line', width: 95, length: 460 }, damage: 40, domain: 'spiritual',
    },
  },
};
