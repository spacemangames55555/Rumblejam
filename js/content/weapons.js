// Weapon catalog — 26 types across six classes:
//   swing (arc melee), thrust (line melee), single (ranged shot),
//   spread (ranged multi), lobbed (AoE), summon (structures).
// dmg/cd/range are tier-I values; tiers II-IV scale via TIER_MULT in config.
// `scaling` lists 1–2 stats that scale the weapon's damage (shown in tooltips):
// percent stats contribute their % directly, flat stats convert via
// SCALING_RATES in config. Class stays as a tag for conditions/traits only.
// Status payloads (all Attunement-scaled): burn {dps,dur},
// chainHit {count,range,factor}, slow {mult,dur}.

export const WEAPONS = [
  // ---- swing: arc melee ----
  { id: 'rustcleaver', name: 'Rustcleaver', cls: 'swing', sym: '⚔', color: '#c8cde8',
    dmg: 12, cd: 0.8, range: 105, knock: 90, arc: 2.0, swingTime: 0.16,
    scaling: ['ferocity'], price: 14 },
  { id: 'emberfang', name: 'Emberfang', cls: 'swing', sym: '🔥', color: '#ff7b3a',
    dmg: 9, cd: 0.9, range: 100, knock: 60, arc: 1.9, swingTime: 0.16,
    burn: { dps: 4, dur: 2 },
    scaling: ['attunement'], price: 18 },
  { id: 'gravemaul', name: 'Gravemaul', cls: 'swing', sym: '🔨', color: '#9aa0bd',
    dmg: 30, cd: 1.8, range: 120, knock: 260, arc: 2.6, swingTime: 0.24,
    scaling: ['vitality', 'ferocity'], price: 22 },
  { id: 'twinlash', name: 'Twinlash', cls: 'swing', sym: '〰', color: '#7dee6a',
    dmg: 6, cd: 0.42, range: 95, knock: 30, arc: 1.2, swingTime: 0.1,
    scaling: ['tempo', 'reflex'], price: 16 },
  { id: 'frostscythe', name: 'Frostscythe', cls: 'swing', sym: '❄', color: '#5ea8ff',
    dmg: 14, cd: 1.2, range: 125, knock: 80, arc: 2.9, swingTime: 0.2,
    slow: { mult: 0.55, dur: 1.5 },
    scaling: ['attunement', 'reflex'], price: 24 },

  // ---- thrust: line melee ----
  { id: 'pikefang', name: 'Pikefang', cls: 'thrust', sym: '↟', color: '#c8cde8',
    dmg: 14, cd: 0.95, range: 170, knock: 110, thrustW: 26,
    scaling: ['grit'], price: 15 },
  { id: 'vaultspike', name: 'Vaultspike', cls: 'thrust', sym: '☨', color: '#ffd45e',
    dmg: 9, cd: 0.65, range: 120, knock: 50, thrustW: 20,
    scaling: ['ferocity'], price: 18 },
  { id: 'serpent_awl', name: 'Serpent Awl', cls: 'thrust', sym: '↯', color: '#7dee6a',
    dmg: 12, cd: 0.95, range: 200, knock: 70, thrustW: 22, pierceLine: true,
    scaling: ['recovery', 'vitality'], price: 20 },
  { id: 'stormlance', name: 'Stormlance', cls: 'thrust', sym: '⚡', color: '#4fd8eb',
    dmg: 11, cd: 1.1, range: 175, knock: 60, thrustW: 24,
    chainHit: { count: 2, range: 150, factor: 0.6 },
    scaling: ['attunement', 'tempo'], price: 24 },

  // ---- single: ranged one shot ----
  { id: 'pebbleshot', name: 'Pebbleshot', cls: 'single', sym: '•', color: '#c8cde8',
    dmg: 10, cd: 0.65, range: 420, knock: 30, projSpeed: 620, pierce: 0,
    scaling: ['ferocity'], price: 12 },
  { id: 'longbarrel', name: 'Longbarrel', cls: 'single', sym: '━', color: '#9aa0bd',
    dmg: 32, cd: 1.9, range: 640, knock: 140, projSpeed: 950, pierce: 2,
    scaling: ['reach', 'ferocity'], price: 24 },
  { id: 'threadneedle', name: 'Threadneedle', cls: 'single', sym: '∙', color: '#ff7ad9',
    dmg: 4, cd: 0.22, range: 360, knock: 8, projSpeed: 700, pierce: 0,
    scaling: ['tempo'], price: 16 },
  { id: 'coilgun', name: 'Coilgun', cls: 'single', sym: '≡', color: '#4fd8eb',
    dmg: 21, cd: 1.4, range: 560, knock: 60, projSpeed: 1100, pierce: 99,
    scaling: ['reach'], price: 26 },
  { id: 'sparkbolt', name: 'Sparkbolt', cls: 'single', sym: 'ϟ', color: '#ffd45e',
    dmg: 9, cd: 0.95, range: 440, knock: 20, projSpeed: 780, pierce: 0,
    chainHit: { count: 3, range: 160, factor: 0.5 },
    scaling: ['attunement'], price: 22 },

  // ---- spread: ranged multi ----
  { id: 'gravelmouth', name: 'Gravelmouth', cls: 'spread', sym: '⋉', color: '#ffab4f',
    dmg: 6, cd: 1.15, range: 300, knock: 70, projSpeed: 640, pierce: 0, count: 5, spreadDeg: 26,
    scaling: ['greed'], price: 18 },
  { id: 'fanblade', name: 'Fanblade', cls: 'spread', sym: '☰', color: '#7dee6a',
    dmg: 9, cd: 1.05, range: 340, knock: 40, projSpeed: 540, pierce: 1, count: 3, spreadDeg: 34,
    scaling: ['tempo'], price: 20 },
  { id: 'hailburst', name: 'Hailburst', cls: 'spread', sym: '᎒᎒', color: '#5ea8ff',
    dmg: 3, cd: 0.95, range: 260, knock: 20, projSpeed: 600, pierce: 0, count: 8, spreadDeg: 55,
    scaling: ['tempo'], price: 20 },
  { id: 'cinderspray', name: 'Cinderspray', cls: 'spread', sym: '𓂃', color: '#ff7b3a',
    dmg: 5, cd: 1.1, range: 250, knock: 15, projSpeed: 520, pierce: 0, count: 4, spreadDeg: 30,
    burn: { dps: 3, dur: 2 },
    scaling: ['attunement'], price: 22 },

  // ---- lobbed: AoE ----
  { id: 'kegbomb', name: 'Kegbomb', cls: 'lobbed', sym: '●', color: '#ffab4f',
    dmg: 17, cd: 2.0, range: 420, knock: 180, projSpeed: 420, aoe: 110,
    scaling: ['attunement', 'greed'], price: 22 },
  { id: 'bogflask', name: 'Bogflask', cls: 'lobbed', sym: '⌘', color: '#7dee6a',
    dmg: 10, cd: 1.6, range: 380, knock: 20, projSpeed: 400, aoe: 95,
    puddle: { dps: 6, dur: 3 },
    scaling: ['recovery', 'attunement'], price: 24 },
  { id: 'frostjar', name: 'Frostjar', cls: 'lobbed', sym: '❆', color: '#5ea8ff',
    dmg: 12, cd: 1.8, range: 400, knock: 40, projSpeed: 410, aoe: 120,
    slow: { mult: 0.5, dur: 2 },
    scaling: ['attunement'], price: 24 },
  { id: 'magmalob', name: 'Magmalob', cls: 'lobbed', sym: '◉', color: '#ff5d3a',
    dmg: 17, cd: 1.9, range: 390, knock: 90, projSpeed: 400, aoe: 100,
    burn: { dps: 5, dur: 2.5 },
    scaling: ['attunement', 'greed'], price: 26 },

  // ---- summon: structures (damage/HP ride Ingenuity, not the scaling bonus) ----
  { id: 'bolt_turret', name: 'Bolt Turret', cls: 'summon', sym: '⌖', color: '#4fd8eb',
    dmg: 0, cd: 0, range: 0, knock: 0, price: 24,
    summon: { type: 'turret', hp: 40, dmg: 7, cd: 0.7, range: 380, projSpeed: 700, knock: 20 },
    scaling: ['ingenuity'] },
  { id: 'ember_turret', name: 'Ember Turret', cls: 'summon', sym: '♨', color: '#ff7b3a',
    dmg: 0, cd: 0, range: 0, knock: 0, price: 28,
    summon: { type: 'turret', hp: 34, dmg: 5, cd: 0.85, range: 320, projSpeed: 620, knock: 10, burn: { dps: 3, dur: 2 } },
    scaling: ['ingenuity', 'attunement'] },
  { id: 'guard_drone', name: 'Guard Drone', cls: 'summon', sym: '✦', color: '#ff7ad9',
    dmg: 0, cd: 0, range: 0, knock: 0, price: 26,
    summon: { type: 'drone', hp: 30, dmg: 6, cd: 0.55, range: 260, projSpeed: 650, knock: 10, orbit: 70 },
    scaling: ['ingenuity'] },
  { id: 'sawsprite', name: 'Sawsprite', cls: 'summon', sym: '✹', color: '#ffd45e',
    dmg: 0, cd: 0, range: 0, knock: 0, price: 26,
    summon: { type: 'ram', hp: 45, dmg: 10, cd: 0.5, range: 300, knock: 60, speed: 340 },
    scaling: ['ingenuity', 'grit'] },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));
export const WEAPON_CLASS_NAMES = {
  swing: 'Melee · Swing', thrust: 'Melee · Thrust', single: 'Ranged · Shot',
  spread: 'Ranged · Spread', lobbed: 'Lobbed · AoE', summon: 'Structure',
};

// ---------------- tooltip math (patch 8) ----------------
// Live scaling contribution and an effective-DPS estimate, computed from a
// player's CURRENT stats. Used by the shop's detail cards so an owned weapon
// and a stock offer compare apples-to-apples. This is a uniform single-target
// baseline, not a combat sim: every projectile of a spread is assumed to hit,
// chains/burns/blasts and travel time are ignored, and turrets use the plain
// Ingenuity rule (character-specific inheritance like the Overseer's is not
// modeled). Label it "est." wherever it's shown.
import { TIER_MULT as _TM, STAT_IS_PCT as _PCT, SCALING_RATES as _SR } from '../config.js';

// per-stat contribution to the weapon's scaling-tag bonus, in percent
export function scalingParts(def, stats) {
  return def.scaling.map(k => ({
    stat: k,
    pct: Math.round(_PCT[k] ? (stats && stats[k] || 0) : (stats && stats[k] || 0) * (_SR[k] || 1)),
  }));
}

export function estimateDps(def, tier, stats) {
  const s = stats || {};
  if (def.summon) {
    const sd = def.summon;
    if (!sd.dmg) return 0;
    const ing = 1 + Math.max(-8, s.ingenuity || 0) * 0.1;
    return sd.dmg * _TM[tier - 1] * ing / Math.max(0.15, sd.cd);
  }
  const bonus = Math.max(-60, scalingParts(def, s).reduce((b, part) => b + part.pct, 0));
  const dmg = Math.max(1, def.dmg * _TM[tier - 1] * (1 + (s.ferocity || 0) / 100) * (1 + bonus / 100));
  const cd = def.cd / Math.max(0.25, 1 + (s.tempo || 0) / 100);
  return dmg * (def.count || 1) / Math.max(0.05, cd);
}
