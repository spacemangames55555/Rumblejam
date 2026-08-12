// The four floor bosses. Each has two phases (phase 2 below hpPct 0.5) and
// telegraphed attacks — danger zones fill in before they fire. Pattern logic
// lives in entities/bosses.js keyed by `kit`; numbers live here.
// Boss HP was doubled in the objectives patch (620/900/1350/2000 → these):
// bosses are the floor's wall, and Bounty Hunt elites are priced off them.
// Playtest pass 3 then multiplied the FINAL siege boss — and only that one —
// by ten more (4000 → 40000, twenty times its original number). The Vault
// Regent ends the run, so it is meant to be an endurance test rather than one
// more fight; the other three floors are unchanged.

import { ALL_REGION_BOSSES } from './regions-enemies.js';

export const BOSSES = [
  { id: 'ossuary_hulk', name: 'The Ossuary Hulk', kit: 'hulk', floor: 1,
    hp: 1240, dmg: 10, spd: 62, radius: 46, shape: 'square', color: '#c05e4c', mats: 30,
    slam:   { windup: 1.1, dmg: 16, radius: 150, cd: 3.8 },
    charge: { windup: 1.0, dmg: 14, speed: 620, width: 110, cd: 5.5 },
    p2: { spdMult: 1.35, addId: 'skulker', addCount: 3, addCd: 6 } },

  { id: 'choir_of_eyes', name: 'Choir of Eyes', kit: 'choir', floor: 2,
    hp: 1800, dmg: 10, spd: 85, radius: 40, shape: 'pentagon', color: '#a86ae8', mats: 36,
    ring:  { count: 14, dmg: 8, speed: 250, cd: 3.4 },
    volley:{ count: 5, spreadDeg: 24, dmg: 10, speed: 400, cd: 2.4 },
    p2: { spiral: { rate: 0.09, dmg: 8, speed: 300 }, addId: 'lobber', addCount: 2, addCd: 8 } },

  { id: 'broodmother_viv', name: 'Broodmother Viv', kit: 'brood', floor: 3,
    hp: 2700, dmg: 12, spd: 70, radius: 44, shape: 'star', color: '#c98b4f', mats: 42,
    vortex: { windup: 1.1, pullR: 420, pullSpd: 190, dur: 2.2, dps: 8, coreR: 120, cd: 7 },
    spawn:  { ids: ['flit', 'fusehead'], count: 3, cd: 5 },
    pools:  { windup: 1.0, count: 3, radius: 85, dps: 10, dur: 4, cd: 6 },
    p2: { spawnCd: 3.4, spdMult: 1.25 } },

  { id: 'vault_regent', name: 'The Vault Regent', kit: 'regent', floor: 4,
    hp: 40000, dmg: 15, spd: 78, radius: 48, shape: 'hex', color: '#ffd45e', mats: 60,
    // Bounty Hunt prices its champions off the floor boss. The Regent's ×10
    // is an endurance dial for the run's last fight, not a new yardstick, so
    // bounties keep measuring against the number it had before.
    bountyAnchor: 4000,
    beams: { windup: 1.3, count: 4, dmg: 14, width: 26, spin: 0.55, dur: 3.2, cd: 8 },
    burst: { count: 18, dmg: 10, speed: 300, cd: 3.0 },
    slam:  { windup: 0.9, dmg: 24, radius: 170, cd: 5 },
    p2: { spdMult: 1.3, burstCd: 2.0, addId: 'lancerfish', addCount: 2, addCd: 7 } },
];

export const BOSS_BY_FLOOR = Object.fromEntries(BOSSES.map(b => [b.floor, b]));

// Sprite ids. Bosses are authored at 96x96, twice an ordinary enemy.
for (const b of BOSSES) b.spriteId = `boss.${b.id}`;

// EVERY BOSS, the way enemies.js publishes every enemy.
//
// `enemies.js` has `ALL_ENEMY_DEFS` — base roster plus every region — and
// `bosses.js` had no counterpart, so "all bosses" had no name and every
// consumer reached for `BOSSES`, which is the four floor bosses. That
// asymmetry is what let the two region bosses fall out of the manifest, out
// of `docs/prompts.json` and out of the gate that claims to check every def.
// A missing name is not a small thing: consumers reach for the name that
// exists, and the next region's boss would have been missed the same way.
//
// Region bosses carry their own spriteId (assigned in regions-enemies.js),
// so this composes rather than tags.
export const ALL_BOSS_DEFS = [...BOSSES, ...ALL_REGION_BOSSES];
