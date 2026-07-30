// UNDERVAULT — global tuning constants and palette. All numbers referenced by the
// simulation live here or in js/content/ data modules.

export const DEV = true; // enables F1–F6 debug keys (host only; see README). Set false for clean runs.

export const CONFIG = {
  TICK_RATE: 60,
  DT: 1 / 60,
  SNAPSHOT_HZ: 15,
  INPUT_HZ: 30,
  INTERP_DELAY_MS: 120,

  ROOM_W: 1280,
  ROOM_H: 720,
  WALL: 36,            // wall thickness
  DOOR_W: 120,         // door gap width

  FLOORS: 4,
  ROOMS_MIN: 10,
  ROOMS_MAX: 13,

  BASE_SPEED: 300,     // u/s at Speed 0%
  PLAYER_RADIUS: 16,
  PICKUP_RADIUS: 60,
  MAGNET_SPEED: 900,
  CONTACT_COOLDOWN: 0.8,   // s between contact hits from one enemy
  INVULN_AFTER_HIT: 0.35,  // brief player i-frames after any hit

  REVIVE_TIME: 3,
  REVIVE_RADIUS: 70,
  REVIVE_HP: 0.5,          // revived at 50% max HP
  DOOR_COUNTDOWN: 3,

  DODGE_CAP: 60,
  ARMOR_K: 15,             // damage taken = raw * K / (K + armor)
  NEG_ARMOR_MAX_BONUS: 0.5,

  XP_BASE: 10, XP_PER_LEVEL: 4,       // next level cost = 10 + 4*level
  QUOTA_BASE: 12, QUOTA_PER_FLOOR: 4, // room quota = (12+4*floor) * playerScale
  SPAWN_PULSES: 3,

  // co-op scaling
  COOP_SPAWN_SCALE: 0.5,   // spawns *(1+0.5*(n-1))
  COOP_HP_SCALE: 0.35,     // enemy hp *(1+0.35*(n-1))
  FLOOR_HP_MULT: 1.35,
  FLOOR_DMG_MULT: 1.2,

  ELITE_HP_MULT: 3,
  ELITE_DMG_MULT: 1.5,

  REROLL_BASE: 6, REROLL_PER_FLOOR: 3, REROLL_GROWTH: 1.5,
  SHOP_SLOTS: 4,
  RARITY_WEIGHTS: { common: 62, uncommon: 25, rare: 10, legendary: 3 },
  PRICE_FLOOR_SCALE: 0.25,  // prices *(1+0.25*(floor-1))
  WEAPON_SLOT_MAX: 6,
  SHOP_WEAPON_CHANCE: 0.3,

  HARVEST_GROWTH: 0.05,    // harvesting grows 5% (floored) per room clear

  DISCONNECT_TIMEOUT: 5,   // s of silence before a client is dropped
  MAX_PLAYERS: 4,

  // performance
  POOL_ENEMIES: 320, POOL_PROJECTILES: 700, POOL_PARTICLES: 900,
  GRID_CELL: 72,
};

export const PALETTE = {
  bg: '#14161f', grid: '#1b1e2b', wall: '#2b2f45', wallEdge: '#454b6e',
  floorSafe: '#181b28', doorOpen: '#5ee0a8', doorLocked: '#ff5d6c',
  players: ['#4fd8eb', '#ffab4f', '#7dee6a', '#ff7ad9'],
  material: '#ffd45e', materialEdge: '#a87f14',
  hpBar: '#ff5d6c', xpBar: '#5ee0a8',
  outline: '#0b0c12',
  hit: '#ffffff', crit: '#ffd45e',
  telegraph: 'rgba(255,93,108,0.28)', telegraphEdge: '#ff5d6c',
  hazardSpike: '#c8cde8', hazardLava: '#ff7b3a',
  rarity: { common: '#b8bdd4', uncommon: '#5ee0a8', rare: '#5ea8ff', legendary: '#ffd45e' },
  elite: '#c05eff',
  boss: '#ff4560',
};

// Stat registry — the ten player stats (the Great Rebalance sheet).
// `pct` controls tooltip formatting; `base` is the pre-modifier value.
export const STATS = [
  { key: 'vitality',   name: 'Vitality',   pct: false, base: 80 }, // hit points
  { key: 'ferocity',   name: 'Ferocity',   pct: true,  base: 0 },  // universal damage %
  { key: 'tempo',      name: 'Tempo',      pct: true,  base: 0 },  // attack + move speed
  { key: 'grit',       name: 'Grit',       pct: false, base: 0 },  // mitigation + knockback resist
  { key: 'reflex',     name: 'Reflex',     pct: true,  base: 0 },  // dodge (cap 60)
  { key: 'recovery',   name: 'Recovery',   pct: true,  base: 0 },  // amplifies ALL healing received
  { key: 'ingenuity',  name: 'Ingenuity',  pct: false, base: 0 },  // summon dmg+HP ×(1+0.1×I)
  { key: 'attunement', name: 'Attunement', pct: true,  base: 0 },  // burn/chill/chain/nova power
  { key: 'greed',      name: 'Greed',      pct: false, base: 0 },  // rarity bias + floor(G/2) mats per clear
  { key: 'reach',      name: 'Reach',      pct: false, base: 0 },  // weapon reach + pickup radius
];
export const STAT_KEYS = STATS.map(s => s.key);
export const STAT_NAME = Object.fromEntries(STATS.map(s => [s.key, s.name]));
export const STAT_IS_PCT = Object.fromEntries(STATS.map(s => [s.key, s.pct]));
export const STAT_BASE = Object.fromEntries(STATS.map(s => [s.key, s.base]));

// Weapon-scaling conversion: how much +damage% one point of a FLAT stat gives
// when that stat is one of the weapon's scaling tags. Percent stats contribute
// their percentage directly. Crit is not a stat: crits exist only as granted
// effects (default ×2).
export const SCALING_RATES = {
  vitality: 1 / 4,   // 1% per 4 Vitality
  grit: 1,           // 1% per point
  ingenuity: 1,
  greed: 1,
  reach: 1 / 12,     // 1% per 12 Reach
};

// Weapon tier multipliers (I–IV): damage etc. scale, price scales.
export const TIER_MULT = [1, 1.6, 2.5, 3.9];
export const TIER_PRICE_MULT = [1, 2.1, 4.4, 9];
export const TIER_NAMES = ['I', 'II', 'III', 'IV'];

export const NET_PREFIX = 'sg-dungeon-';

// Shared pricing helpers — the sim and the shop UI must agree on sell values.
export function weaponBasePrice(def, tier) {
  return def.price * TIER_PRICE_MULT[tier - 1];
}
export function sellValue(basePrice, floorNum) {
  return Math.floor(basePrice * (1 + CONFIG.PRICE_FLOOR_SCALE * (floorNum - 1)) * 0.3);
}
