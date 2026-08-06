// The 12 base enemy types.
//
// `domain` places each type in the damage triangle (js/domains.js): physical
// beats spiritual, mental beats physical, spiritual beats mental. Distributed
// roughly evenly for now — four of each — because per-region skew is a later
// phase and an even spread is the only distribution that tests all six matchups
// in one arena. It is rendered as a 4px rim on every enemy, always on: the
// triangle is only a decision a player can make if they can see which way it
// points without inspecting anything. Values are floor-1 solo baselines; the sim applies
// floor scaling (hp ×1.35, dmg ×1.2 compounding) and co-op scaling on spawn.
// shape drives the silhouette in render.js; behavior keys are implemented in
// entities/enemies.js.

export const ENEMIES = [
  { id: 'skulker', domain: 'physical',   name: 'Skulker',   behavior: 'chaser',   hp: 8,  spd: 125, dmg: 4,  radius: 14, mats: 1,
    shape: 'circle',   color: '#e2504c', w: 3 },                                    // basic chaser
  { id: 'flit', domain: 'mental',      name: 'Flit',      behavior: 'sprinter', hp: 4,  spd: 215, dmg: 3,  radius: 11, mats: 1,
    shape: 'triangle', color: '#ffab4f', w: 2.2 },                                  // fast, fragile
  { id: 'slabjaw', domain: 'physical',   name: 'Slabjaw',   behavior: 'brute',    hp: 30, spd: 68,  dmg: 10, radius: 24, mats: 3,
    shape: 'square',   color: '#b03a3a', w: 1.4 },                                  // slow tank
  { id: 'lobber', domain: 'spiritual',    name: 'Lobber',    behavior: 'spitter',  hp: 9,  spd: 92,  dmg: 3,  radius: 14, mats: 2,
    shape: 'pentagon', color: '#a86ae8', w: 1.8,
    proj: { dmg: 6, speed: 320, radius: 6 }, keepDist: 260, fireCd: 2.2,            // ranged spitter
    mortar: { cd: 3.4, dmg: 8, radius: 62, windup: 1.35, range: 950 } },            // artillery variant (profiles)
  { id: 'gyre', domain: 'mental',      name: 'Gyre',      behavior: 'orbiter',  hp: 8,  spd: 160, dmg: 5,  radius: 12, mats: 2,
    shape: 'diamond',  color: '#ff7ad9', w: 1.8, orbitR: 190, diveCd: 2.6,
    diveWindup: 0.35 },                                                             // circles, telegraphs, then dives
  { id: 'gemmite', domain: 'spiritual',   name: 'Gemmite',   behavior: 'splitter', hp: 14, spd: 100, dmg: 5,  radius: 18, mats: 2,
    shape: 'circle',   color: '#6ecf68', w: 1.6, splitInto: 2 },                    // splits on death
  { id: 'fusehead', domain: 'spiritual',  name: 'Fusehead',  behavior: 'bomber',   hp: 6,  spd: 145, dmg: 2,  radius: 13, mats: 2,
    shape: 'circle',   color: '#ffd45e', w: 1.6,
    boom: { dmg: 14, radius: 90, fuse: 0.9 }, triggerDist: 70 },                    // telegraphed death explosion
  { id: 'aegimand', domain: 'physical',  name: 'Aegimand',  behavior: 'warden',   hp: 22, spd: 78,  dmg: 5,  radius: 18, mats: 3,
    shape: 'hex',      color: '#5ea8ff', w: 1.2, shieldR: 150, shieldReduce: 0.5 }, // shields nearby allies
  { id: 'stitcher', domain: 'mental',  name: 'Stitcher',  behavior: 'medic',    hp: 11, spd: 118, dmg: 3,  radius: 13, mats: 3,
    shape: 'cross',    color: '#8be8c8', w: 1.2, healPs: 6, healR: 170 },           // heals allies, flees
  { id: 'wombden', domain: 'spiritual',   name: 'Wombden',   behavior: 'nest',     hp: 26, spd: 0,   dmg: 4,  radius: 22, mats: 3,
    shape: 'star',     color: '#c98b4f', w: 1.0, spawnCd: 4, maxBrood: 3, broodId: 'flit' }, // spawner
  { id: 'lancerfish', domain: 'physical', name: 'Lancerfish', behavior: 'dasher', hp: 11, spd: 105, dmg: 7,  radius: 14, mats: 2,
    shape: 'arrow',    color: '#4fd8eb', w: 1.6,
    dash: { windup: 0.55, speed: 560, dur: 0.45, cd: 2.4 } },                       // telegraphed dash
  { id: 'deadeye', domain: 'mental',   name: 'Deadeye',   behavior: 'sniper',   hp: 8,  spd: 62,  dmg: 6, radius: 13, mats: 2,
    shape: 'thindiamond', color: '#e85aa0', w: 1.2,
    beam: { windup: 1.4, dmg: 11, width: 16, len: 900, cd: 3.2 } },                 // long windup beam
];

export const ENEMY_BY_ID = Object.fromEntries(ENEMIES.map(e => [e.id, e]));
export const ENEMY_INDEX = Object.fromEntries(ENEMIES.map((e, i) => [e.id, i]));

// Elite modifiers: any base type can spawn elite (×3 HP, ×1.5 dmg, ×1.45 size)
// plus exactly one of these.
export const ELITE_MODS = [
  // 2% max hp / s, and NONE of it within regenLockS seconds of taking a hit.
  //
  // The lock exists because the rate is a percentage of the entity's OWN max HP
  // while player damage is a flat number, so the two diverge as HP grows. On
  // anything carrying a large multiplier — a Bounty Hunt mark is 10x a boss
  // fraction — the raw rate outruns what a small party can land and the target
  // stops being tough and starts being unkillable. Measured on a solo mark:
  // 135-151 HP/s of healing against 105-110 HP/s landed.
  //
  // regenLockMult is the fraction that still ticks WHILE locked. 0 is a hard
  // lockout: sustained pressure shuts the healing off completely and the
  // modifier costs a disengaging player, not an attacking one. Raising it to
  // ~0.1 makes regen a constant tax instead — see docs/KNOWN-DEFECTS.md, which
  // records what each setting measures, because the choice is a design one and
  // the knob is one character wide.
  { id: 'regenerating', name: 'Regenerating', regenPct: 0.02, regenLockS: 2, regenLockMult: 0 },
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

// Sprite ids. Cosmetic only — the wire still carries a type index and the
// renderer resolves the sprite from it locally, exactly as it already resolves
// `shape` and `color`.
for (const e of ENEMIES) e.spriteId = `enemy.${e.id}`;
