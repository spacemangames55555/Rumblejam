// REGIONS — the world's eight chapters, as data.
//
// A region is a tileset, a hazard, a population, a boss and a set of numbers.
// Both regions here and the six that follow are the same shape, so adding
// region three is an entry in REGIONS and nothing else.
//
// WHAT IS DATA-ONLY IN THIS PATCH: `enemies`, `boss`, `tileset`, `hazard` and
// `cursedModifier` name content that does not exist yet. They are declared so
// the systems around them — node trees, domain skew, depth scaling, saves — can
// be built and tested against real region objects rather than fixtures, and so
// the art has a named place to land. `contentReady` says plainly which regions
// can actually be played, and the assertions below do not pretend otherwise.

import { DOMAINS } from './domains.js';

export const CROSS_LINK_CHANCE = 0.45;

// Within a region, enemy stats escalate across the five chosen maps plus boss.
// Resets each region — this is the map-depth axis, not the world axis.
export const DEPTH_MULT_PER_COLUMN = 0.08;
export function depthMult(column) { return 1 + DEPTH_MULT_PER_COLUMN * (column - 1); }

export const REGIONS = [
  {
    id: 'pacific_northwest', index: 1, name: 'Pacific Northwest',
    nativeClass: 'druid',              // recorded on clear, NOT granted
    expectedLevel: 1,
    domainSkew: { primary: 'physical', secondary: null, maxShare: 0.60 },
    tileset: 'pnw',
    hazard: 'undergrowth',             // brush that slows: terrain teaches positioning
    cursedModifier: 'pnw_gloom',       // heavily reduced visibility
    enemies: ['pnw_sapling', 'pnw_elk', 'pnw_bark_hulk', 'pnw_mistwalker', 'pnw_thornhound', 'pnw_cedar_warden'],
    boss: 'pnw_boss',
    tuning: { hpMult: 1.0, damageMult: 1.0, densityMult: 1.0 },
    // Six enemies, a two-phase boss and a cursed modifier all exist and are
    // registered; the population clears the 50% telegraph-density floor.
    contentReady: true,
  },
  {
    id: 'central_america', index: 2, name: 'Central America',
    nativeClass: 'savage',
    expectedLevel: 10,
    // The flip from physical to spiritual is the first real test of the
    // triangle: a party built entirely for region 1 should feel this push back.
    domainSkew: { primary: 'spiritual', secondary: null, maxShare: 0.60 },
    tileset: 'xibalba',
    hazard: 'bloodmire',               // damaging ground: route around, do not cross
    cursedModifier: 'bloodprice',      // no HP restore between rooms
    enemies: ['ca_jaguar_priest', 'ca_bloodletter', 'ca_xib_shade', 'ca_obsidian_knight', 'ca_howler', 'ca_skull_rack'],
    boss: 'ca_boss',
    tuning: { hpMult: 1.15, damageMult: 1.1, densityMult: 1.05 },
    contentReady: true,
  },
];

// Regions 3-8 exist as names so a player can see the shape of the whole run
// from the first session. They are not playable and carry no data.
export const LOCKED_REGION_NAMES = [
  'The Sahel', 'Norse Reach', 'Steppe', 'Indus Delta', 'Abyssal Trench', 'The Vault',
];
export const TOTAL_REGIONS = 8;

export const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r]));
export const REGION_BY_INDEX = Object.fromEntries(REGIONS.map(r => [r.index, r]));

// ---------------------------------------------------------------- assertions

function assertRegions() {
  const problems = [];
  const seenIndex = new Set();
  for (const r of REGIONS) {
    if (seenIndex.has(r.index)) problems.push(`${r.id}: duplicate index ${r.index}`);
    seenIndex.add(r.index);
    if (!(r.index >= 1 && r.index <= TOTAL_REGIONS)) problems.push(`${r.id}: index ${r.index} outside 1..${TOTAL_REGIONS}`);
    if (!(r.expectedLevel >= 1)) problems.push(`${r.id}: expectedLevel ${r.expectedLevel}`);
    if (r.enemies.length !== 6) problems.push(`${r.id}: ${r.enemies.length} enemy archetypes, want 6`);
    if (!r.boss) problems.push(`${r.id}: no boss`);
    if (!r.hazard) problems.push(`${r.id}: no hazard`);
    if (!r.cursedModifier) problems.push(`${r.id}: no cursed modifier`);
    const sk = r.domainSkew;
    if (!sk || !DOMAINS.includes(sk.primary)) problems.push(`${r.id}: domainSkew.primary ${JSON.stringify(sk && sk.primary)} is not a domain`);
    if (sk && sk.secondary && !DOMAINS.includes(sk.secondary)) problems.push(`${r.id}: domainSkew.secondary ${sk.secondary} is not a domain`);
    // "no region's enemy population exceeds maxShare of one domain" — the cap
    // is what stops a region being a single-answer puzzle for one build.
    if (!(sk && sk.maxShare > 0 && sk.maxShare <= 1)) problems.push(`${r.id}: maxShare ${sk && sk.maxShare} must be in (0,1]`);
    for (const k of ['hpMult', 'damageMult', 'densityMult']) {
      if (!(r.tuning && r.tuning[k] > 0)) problems.push(`${r.id}: tuning.${k} must be > 0`);
    }
  }
  if (REGIONS.length + LOCKED_REGION_NAMES.length !== TOTAL_REGIONS) {
    problems.push(`${REGIONS.length} built + ${LOCKED_REGION_NAMES.length} named != ${TOTAL_REGIONS} regions`);
  }
  if (problems.length) throw new Error(`region definitions failed ${problems.length} assertion(s):\n  - ${problems.join('\n  - ')}`);
}

assertRegions();

// The domain-share check, run against a REAL population rather than the
// declaration. Callers hand it the domains actually assigned to a region's
// spawns; a region whose art lands later will fail this the day it lands
// rather than the day someone notices the game feels one-note.
export function domainShareViolation(region, domainsInPlay) {
  if (!domainsInPlay.length) return null;
  const counts = {};
  for (const d of domainsInPlay) counts[d] = (counts[d] || 0) + 1;
  for (const [d, n] of Object.entries(counts)) {
    const share = n / domainsInPlay.length;
    if (share > region.domainSkew.maxShare + 1e-9) {
      return `${region.id}: ${d} is ${(share * 100).toFixed(0)}% of the population, over the ${(region.domainSkew.maxShare * 100).toFixed(0)}% cap`;
    }
  }
  return null;
}
