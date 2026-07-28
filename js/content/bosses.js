// The four floor bosses. Each has two phases (phase 2 below hpPct 0.5) and
// telegraphed attacks — danger zones fill in before they fire. Pattern logic
// lives in entities/bosses.js keyed by `kit`; numbers live here.

export const BOSSES = [
  { id: 'ossuary_hulk', name: 'The Ossuary Hulk', kit: 'hulk', floor: 1,
    hp: 620, dmg: 14, spd: 62, radius: 46, shape: 'square', color: '#c05e4c', mats: 30,
    slam:   { windup: 1.0, dmg: 22, radius: 150, cd: 3.6 },
    charge: { windup: 0.85, dmg: 18, speed: 640, width: 110, cd: 5.5 },
    p2: { spdMult: 1.35, addId: 'skulker', addCount: 3, addCd: 6 } },

  { id: 'choir_of_eyes', name: 'Choir of Eyes', kit: 'choir', floor: 2,
    hp: 900, dmg: 12, spd: 85, radius: 40, shape: 'pentagon', color: '#a86ae8', mats: 36,
    ring:  { count: 14, dmg: 9, speed: 260, cd: 3.2 },
    volley:{ count: 5, spreadDeg: 24, dmg: 11, speed: 420, cd: 2.2 },
    p2: { spiral: { rate: 0.09, dmg: 8, speed: 300 }, addId: 'lobber', addCount: 2, addCd: 8 } },

  { id: 'broodmother_viv', name: 'Broodmother Viv', kit: 'brood', floor: 3,
    hp: 1350, dmg: 15, spd: 70, radius: 44, shape: 'star', color: '#c98b4f', mats: 42,
    vortex: { windup: 1.1, pullR: 420, pullSpd: 190, dur: 2.2, dps: 8, coreR: 120, cd: 7 },
    spawn:  { ids: ['flit', 'fusehead'], count: 3, cd: 5 },
    pools:  { windup: 1.0, count: 3, radius: 85, dps: 10, dur: 4, cd: 6 },
    p2: { spawnCd: 3.4, spdMult: 1.25 } },

  { id: 'vault_regent', name: 'The Vault Regent', kit: 'regent', floor: 4,
    hp: 2000, dmg: 18, spd: 78, radius: 48, shape: 'hex', color: '#ffd45e', mats: 60,
    beams: { windup: 1.3, count: 4, dmg: 14, width: 26, spin: 0.55, dur: 3.2, cd: 8 },
    burst: { count: 18, dmg: 10, speed: 300, cd: 3.0 },
    slam:  { windup: 0.9, dmg: 24, radius: 170, cd: 5 },
    p2: { spdMult: 1.3, burstCd: 2.0, addId: 'lancerfish', addCount: 2, addCd: 7 } },
];

export const BOSS_BY_FLOOR = Object.fromEntries(BOSSES.map(b => [b.floor, b]));
