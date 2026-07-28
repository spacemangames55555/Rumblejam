// The 12 base enemy types. Values are floor-1 solo baselines; the sim applies
// floor scaling (hp ×1.35, dmg ×1.2 compounding) and co-op scaling on spawn.
// shape drives the silhouette in render.js; behavior keys are implemented in
// entities/enemies.js.

export const ENEMIES = [
  { id: 'skulker',   name: 'Skulker',   behavior: 'chaser',   hp: 12, spd: 125, dmg: 5,  radius: 14, mats: 1,
    shape: 'circle',   color: '#e2504c', w: 3 },                                    // basic chaser
  { id: 'flit',      name: 'Flit',      behavior: 'sprinter', hp: 7,  spd: 225, dmg: 4,  radius: 11, mats: 1,
    shape: 'triangle', color: '#ffab4f', w: 2.2 },                                  // fast, fragile
  { id: 'slabjaw',   name: 'Slabjaw',   behavior: 'brute',    hp: 48, spd: 68,  dmg: 12, radius: 24, mats: 3,
    shape: 'square',   color: '#b03a3a', w: 1.4 },                                  // slow tank
  { id: 'lobber',    name: 'Lobber',    behavior: 'spitter',  hp: 14, spd: 92,  dmg: 4,  radius: 14, mats: 2,
    shape: 'pentagon', color: '#a86ae8', w: 1.8,
    proj: { dmg: 7, speed: 340, radius: 6 }, keepDist: 260, fireCd: 2.2 },          // ranged spitter
  { id: 'gyre',      name: 'Gyre',      behavior: 'orbiter',  hp: 12, spd: 165, dmg: 6,  radius: 12, mats: 2,
    shape: 'diamond',  color: '#ff7ad9', w: 1.8, orbitR: 190, diveCd: 2.6 },        // circles then dives
  { id: 'gemmite',   name: 'Gemmite',   behavior: 'splitter', hp: 22, spd: 100, dmg: 6,  radius: 18, mats: 2,
    shape: 'circle',   color: '#6ecf68', w: 1.6, splitInto: 2 },                    // splits on death
  { id: 'fusehead',  name: 'Fusehead',  behavior: 'bomber',   hp: 10, spd: 150, dmg: 2,  radius: 13, mats: 2,
    shape: 'circle',   color: '#ffd45e', w: 1.6,
    boom: { dmg: 18, radius: 95, fuse: 0.9 }, triggerDist: 70 },                    // telegraphed death explosion
  { id: 'aegimand',  name: 'Aegimand',  behavior: 'warden',   hp: 32, spd: 78,  dmg: 6,  radius: 18, mats: 3,
    shape: 'hex',      color: '#5ea8ff', w: 1.2, shieldR: 150, shieldReduce: 0.5 }, // shields nearby allies
  { id: 'stitcher',  name: 'Stitcher',  behavior: 'medic',    hp: 16, spd: 118, dmg: 3,  radius: 13, mats: 3,
    shape: 'cross',    color: '#8be8c8', w: 1.2, healPs: 6, healR: 170 },           // heals allies, flees
  { id: 'wombden',   name: 'Wombden',   behavior: 'nest',     hp: 38, spd: 0,   dmg: 4,  radius: 22, mats: 3,
    shape: 'star',     color: '#c98b4f', w: 1.0, spawnCd: 4, maxBrood: 3, broodId: 'flit' }, // spawner
  { id: 'lancerfish', name: 'Lancerfish', behavior: 'dasher', hp: 16, spd: 105, dmg: 9,  radius: 14, mats: 2,
    shape: 'arrow',    color: '#4fd8eb', w: 1.6,
    dash: { windup: 0.55, speed: 560, dur: 0.45, cd: 2.4 } },                       // telegraphed dash
  { id: 'deadeye',   name: 'Deadeye',   behavior: 'sniper',   hp: 12, spd: 62,  dmg: 12, radius: 13, mats: 2,
    shape: 'thindiamond', color: '#e85aa0', w: 1.2,
    beam: { windup: 1.4, dmg: 12, width: 16, len: 900, cd: 3.2 } },                 // long windup beam
];

export const ENEMY_BY_ID = Object.fromEntries(ENEMIES.map(e => [e.id, e]));
export const ENEMY_INDEX = Object.fromEntries(ENEMIES.map((e, i) => [e.id, i]));

// Elite modifiers: any base type can spawn elite (×3 HP, ×1.5 dmg, ×1.45 size)
// plus exactly one of these.
export const ELITE_MODS = [
  { id: 'regenerating', name: 'Regenerating', regenPct: 0.02 },  // 2% max hp / s
  { id: 'volatile',     name: 'Volatile',     boom: { dmg: 16, radius: 120, fuse: 0.8 } },
  { id: 'shielded',     name: 'Shielded',     blockCd: 3 },      // negates one hit every 3 s
  { id: 'magnetic',     name: 'Magnetic',     pullR: 260, pullSpd: 70 },
];

// Spawn tables per floor: which enemies appear and their weights.
export const FLOOR_TABLES = [
  ['skulker', 'flit', 'gemmite', 'lobber', 'fusehead'],
  ['skulker', 'flit', 'slabjaw', 'lobber', 'gyre', 'fusehead', 'stitcher'],
  ['skulker', 'flit', 'slabjaw', 'gyre', 'gemmite', 'aegimand', 'wombden', 'lancerfish'],
  ['flit', 'slabjaw', 'lobber', 'gyre', 'aegimand', 'stitcher', 'wombden', 'lancerfish', 'deadeye'],
];
