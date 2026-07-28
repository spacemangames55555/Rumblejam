// Weapon catalog — 26 types across six classes:
//   swing (arc melee), thrust (line melee), single (ranged shot),
//   spread (ranged multi), lobbed (AoE), summon (engineering structures).
// dmg/cd/range are tier-I values; tiers II-IV scale via TIER_MULT in config.
// tags list the stats that scale the weapon (shown in tooltips).
// Elemental payloads: burn {dps,dur}, chainHit {count,range,factor}, slow {mult,dur}.

export const WEAPONS = [
  // ---- swing: arc melee ----
  { id: 'rustcleaver', name: 'Rustcleaver', cls: 'swing', sym: '⚔', color: '#c8cde8',
    dmg: 10, cd: 0.95, range: 105, knock: 90, arc: 2.0, swingTime: 0.16,
    tags: ['damage', 'meleeDamage'], price: 14 },
  { id: 'emberfang', name: 'Emberfang', cls: 'swing', sym: '🔥', color: '#ff7b3a',
    dmg: 8, cd: 1.0, range: 100, knock: 60, arc: 1.9, swingTime: 0.16,
    burn: { dps: 4, dur: 2 },
    tags: ['damage', 'meleeDamage', 'elementalDamage'], price: 18 },
  { id: 'gravemaul', name: 'Gravemaul', cls: 'swing', sym: '🔨', color: '#9aa0bd',
    dmg: 26, cd: 1.9, range: 120, knock: 260, arc: 2.6, swingTime: 0.24,
    tags: ['damage', 'meleeDamage'], price: 22 },
  { id: 'twinlash', name: 'Twinlash', cls: 'swing', sym: '〰', color: '#7dee6a',
    dmg: 5, cd: 0.45, range: 95, knock: 30, arc: 1.2, swingTime: 0.1,
    tags: ['damage', 'meleeDamage', 'attackSpeed'], price: 16 },
  { id: 'frostscythe', name: 'Frostscythe', cls: 'swing', sym: '❄', color: '#5ea8ff',
    dmg: 12, cd: 1.3, range: 125, knock: 80, arc: 2.9, swingTime: 0.2,
    slow: { mult: 0.55, dur: 1.5 },
    tags: ['damage', 'meleeDamage', 'elementalDamage'], price: 24 },

  // ---- thrust: line melee ----
  { id: 'pikefang', name: 'Pikefang', cls: 'thrust', sym: '↟', color: '#c8cde8',
    dmg: 13, cd: 1.1, range: 170, knock: 110, thrustW: 26,
    tags: ['damage', 'meleeDamage', 'range'], price: 15 },
  { id: 'vaultspike', name: 'Vaultspike', cls: 'thrust', sym: '☨', color: '#ffd45e',
    dmg: 8, cd: 0.7, range: 120, knock: 50, thrustW: 20, critBonus: 20,
    tags: ['damage', 'meleeDamage', 'critChance'], price: 18 },
  { id: 'serpent_awl', name: 'Serpent Awl', cls: 'thrust', sym: '↯', color: '#7dee6a',
    dmg: 11, cd: 1.0, range: 200, knock: 70, thrustW: 22, pierceLine: true,
    tags: ['damage', 'meleeDamage'], price: 20 },
  { id: 'stormlance', name: 'Stormlance', cls: 'thrust', sym: '⚡', color: '#4fd8eb',
    dmg: 9, cd: 1.15, range: 175, knock: 60, thrustW: 24,
    chainHit: { count: 2, range: 150, factor: 0.6 },
    tags: ['damage', 'meleeDamage', 'elementalDamage'], price: 24 },

  // ---- single: ranged one shot ----
  { id: 'pebbleshot', name: 'Pebbleshot', cls: 'single', sym: '•', color: '#c8cde8',
    dmg: 7, cd: 0.85, range: 420, knock: 30, projSpeed: 620, pierce: 0,
    tags: ['damage', 'rangedDamage'], price: 12 },
  { id: 'longbarrel', name: 'Longbarrel', cls: 'single', sym: '━', color: '#9aa0bd',
    dmg: 30, cd: 2.1, range: 640, knock: 140, projSpeed: 950, pierce: 2,
    tags: ['damage', 'rangedDamage', 'range'], price: 24 },
  { id: 'threadneedle', name: 'Threadneedle', cls: 'single', sym: '∙', color: '#ff7ad9',
    dmg: 3, cd: 0.22, range: 360, knock: 8, projSpeed: 700, pierce: 0,
    tags: ['damage', 'rangedDamage', 'attackSpeed'], price: 16 },
  { id: 'coilgun', name: 'Coilgun', cls: 'single', sym: '≡', color: '#4fd8eb',
    dmg: 16, cd: 1.5, range: 560, knock: 60, projSpeed: 1100, pierce: 99,
    tags: ['damage', 'rangedDamage'], price: 26 },
  { id: 'sparkbolt', name: 'Sparkbolt', cls: 'single', sym: 'ϟ', color: '#ffd45e',
    dmg: 8, cd: 1.0, range: 440, knock: 20, projSpeed: 780, pierce: 0,
    chainHit: { count: 3, range: 160, factor: 0.55 },
    tags: ['damage', 'rangedDamage', 'elementalDamage'], price: 22 },

  // ---- spread: ranged multi ----
  { id: 'gravelmouth', name: 'Gravelmouth', cls: 'spread', sym: '⋉', color: '#ffab4f',
    dmg: 5, cd: 1.25, range: 300, knock: 70, projSpeed: 640, pierce: 0, count: 5, spreadDeg: 26,
    tags: ['damage', 'rangedDamage'], price: 18 },
  { id: 'fanblade', name: 'Fanblade', cls: 'spread', sym: '☰', color: '#7dee6a',
    dmg: 8, cd: 1.1, range: 340, knock: 40, projSpeed: 540, pierce: 1, count: 3, spreadDeg: 34,
    tags: ['damage', 'rangedDamage'], price: 20 },
  { id: 'hailburst', name: 'Hailburst', cls: 'spread', sym: '᎒᎒', color: '#5ea8ff',
    dmg: 3, cd: 0.95, range: 260, knock: 20, projSpeed: 600, pierce: 0, count: 8, spreadDeg: 55,
    tags: ['damage', 'rangedDamage', 'attackSpeed'], price: 20 },
  { id: 'cinderspray', name: 'Cinderspray', cls: 'spread', sym: '𓂃', color: '#ff7b3a',
    dmg: 4, cd: 1.15, range: 250, knock: 15, projSpeed: 520, pierce: 0, count: 4, spreadDeg: 30,
    burn: { dps: 3, dur: 2 },
    tags: ['damage', 'rangedDamage', 'elementalDamage'], price: 22 },

  // ---- lobbed: AoE ----
  { id: 'kegbomb', name: 'Kegbomb', cls: 'lobbed', sym: '●', color: '#ffab4f',
    dmg: 22, cd: 2.2, range: 420, knock: 180, projSpeed: 420, aoe: 110,
    tags: ['damage', 'rangedDamage'], price: 22 },
  { id: 'bogflask', name: 'Bogflask', cls: 'lobbed', sym: '⌘', color: '#7dee6a',
    dmg: 8, cd: 1.7, range: 380, knock: 20, projSpeed: 400, aoe: 95,
    puddle: { dps: 6, dur: 3 },
    tags: ['damage', 'elementalDamage'], price: 24 },
  { id: 'frostjar', name: 'Frostjar', cls: 'lobbed', sym: '❆', color: '#5ea8ff',
    dmg: 10, cd: 1.9, range: 400, knock: 40, projSpeed: 410, aoe: 120,
    slow: { mult: 0.5, dur: 2 },
    tags: ['damage', 'elementalDamage'], price: 24 },
  { id: 'magmalob', name: 'Magmalob', cls: 'lobbed', sym: '◉', color: '#ff5d3a',
    dmg: 15, cd: 2.0, range: 390, knock: 90, projSpeed: 400, aoe: 100,
    burn: { dps: 5, dur: 2.5 },
    tags: ['damage', 'elementalDamage'], price: 26 },

  // ---- summon: engineering structures ----
  { id: 'bolt_turret', name: 'Bolt Turret', cls: 'summon', sym: '⌖', color: '#4fd8eb',
    dmg: 0, cd: 0, range: 0, knock: 0, price: 24,
    summon: { type: 'turret', hp: 40, dmg: 6, cd: 0.8, range: 380, projSpeed: 700, knock: 20 },
    tags: ['engineering'] },
  { id: 'ember_turret', name: 'Ember Turret', cls: 'summon', sym: '♨', color: '#ff7b3a',
    dmg: 0, cd: 0, range: 0, knock: 0, price: 28,
    summon: { type: 'turret', hp: 34, dmg: 4, cd: 0.9, range: 320, projSpeed: 620, knock: 10, burn: { dps: 3, dur: 2 } },
    tags: ['engineering', 'elementalDamage'] },
  { id: 'guard_drone', name: 'Guard Drone', cls: 'summon', sym: '✦', color: '#ff7ad9',
    dmg: 0, cd: 0, range: 0, knock: 0, price: 26,
    summon: { type: 'drone', hp: 30, dmg: 5, cd: 0.6, range: 260, projSpeed: 650, knock: 10, orbit: 70 },
    tags: ['engineering'] },
  { id: 'sawsprite', name: 'Sawsprite', cls: 'summon', sym: '✹', color: '#ffd45e',
    dmg: 0, cd: 0, range: 0, knock: 0, price: 26,
    summon: { type: 'ram', hp: 45, dmg: 9, cd: 0.5, range: 300, knock: 60, speed: 340 },
    tags: ['engineering'] },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));
export const WEAPON_CLASS_NAMES = {
  swing: 'Melee · Swing', thrust: 'Melee · Thrust', single: 'Ranged · Shot',
  spread: 'Ranged · Spread', lobbed: 'Lobbed · AoE', summon: 'Structure',
};
