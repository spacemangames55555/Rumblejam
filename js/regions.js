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
import { REGION_ENEMY_BY_ID, REGION_BOSS_BY_ID } from './content/regions-enemies.js';
import { BOSS_BY_ID, ALL_BOSS_DEFS } from './content/bosses.js';

export const CROSS_LINK_CHANCE = 0.45;

// Within a region, enemy stats escalate across the five chosen maps plus boss.
// Resets each region — this is the map-depth axis, not the world axis.
export const DEPTH_MULT_PER_COLUMN = 0.08;
export function depthMult(column) { return 1 + DEPTH_MULT_PER_COLUMN * (column - 1); }

// ---------------------------------------------------- the world axis (§4.3)
//
// THE OTHER AXIS. `depthMult` is escalation WITHIN a region and resets at its
// border; this is escalation ACROSS the eight, and it is the only thing that
// makes region 8 harder than region 1 for a character who has been growing the
// whole time.
//
// It replaces `CONFIG.FLOOR_HP_MULT ^ (floorNum-1)` — a geometric ramp over
// four points. THE FOUR-POINT CURVE WAS NOT STRETCHED, deliberately: rescaling
// 1.35-per-floor to eight points (1.35^(3/7) ≈ 1.143 per region) preserves the
// endpoints and gets the middle wrong, because the old curve's endpoints were
// never the thing that was tuned — the fights in between were, and there were
// three of them.
//
// AUTHORED PER BAND, from §4.3's own level anchors — 1, 10, 19, 28, 37, 46, 55,
// 64 — against MEASURED player output at each of them (`tools/region_curve.mjs`,
// which levels a character, spends its trees in tier order and fires it at
// dummies for the same window `tree_dps` uses). The target is FLAT TIME TO
// KILL: an enemy at the region's anchor level should take about as long to
// bring down as a region-1 enemy took at level 1, so the difficulty a player
// feels comes from the fight's shape rather than from arithmetic drift.
//
// The damage axis is NOT measured separately. Player effective HP grows from
// banked stat picks, which are a player's choice rather than a table, so there
// is nothing to measure that is not really a measurement of one build. Instead
// it keeps the RELATIONSHIP the old curve authored between the two axes:
// ln(1.20)/ln(1.35) = 0.608, so damage grows as HP^0.608. That number is the
// only thing inherited from the four-point curve, and it is inherited because
// it is a statement about how hard enemies should hit relative to how long they
// live, which does not depend on how many regions there are.
// MEASURED, 2026-08-17, `node tools/region_curve.mjs` — median composed output
// across Blacksmith, Wizard, Necromancer and Druid at each anchor, best of
// three loadout windows, 20s:
//
//   region   1     2     3     4     5     6     7     8
//   level    1    10    19    28    37    46    55    64
//   dps   14.4  30.8  55.5  62.5  76.4  87.0 106.2 106.3
//
// TWO THINGS THIS SAYS THAT THE OLD CURVE DID NOT.
//
// The old ramp reached ×2.46 HP at floor 4. This reaches ×4.33 by region 4 —
// whose anchor is level 28 — so the four-floor curve was scaling enemies
// SLOWER than it was scaling players, and a run got easier the longer it ran.
// That is the shape the brief predicted and the reason a stretch was refused.
//
// And regions 7 and 8 are flat, 7.35 against 7.36, because three of the four
// classes stop gaining output between level 55 and 64: the trees absorb every
// point (measured — zero unspendable at every anchor) but the last nine points
// buy ranks, and a rank is −3% cooldown against a floor of 70%. Region 8 is
// therefore NOT harder than region 7 on this axis, and must not be made so by
// inventing a number the measurement does not support. §3.2 already says where
// region 8's difficulty comes from — it is "deliberately even, so the endgame
// demands full party coverage rather than one counter-build" — and the Regent
// carries its own ×10.
export const REGION_ANCHOR_LEVEL = [1, 10, 19, 28, 37, 46, 55, 64];
export const REGION_HP_MULT = [1.00, 2.13, 3.84, 4.33, 5.29, 6.02, 7.35, 7.36];
export const REGION_DMG_MULT = [1.00, 1.59, 2.26, 2.44, 2.75, 2.98, 3.36, 3.36];

// Clamped rather than wrapped: a region index outside 1..8 is a bug, and the
// last band is the safe thing to be wrong with.
function bandIndex(regionIndex) {
  const i = (regionIndex | 0) - 1;
  return Math.max(0, Math.min(TOTAL_REGIONS - 1, i));
}
export function regionHpMult(regionIndex) { return REGION_HP_MULT[bandIndex(regionIndex)]; }
export function regionDmgMult(regionIndex) { return REGION_DMG_MULT[bandIndex(regionIndex)]; }
export function anchorLevel(regionIndex) { return REGION_ANCHOR_LEVEL[bandIndex(regionIndex)]; }

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
    // `nestWallHpMult` is region tuning, not a property of a barricade: the
    // wall entity is identical everywhere and it is REGION 1 that is meant to
    // be the gentle introduction to Nest Purge. Putting the halving on the wall
    // would make every later region's barricade carry a number explaining
    // something about the first one.
    tuning: { hpMult: 1.0, damageMult: 1.0, densityMult: 1.0, nestWallHpMult: 0.5 },
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
    enemies: ['xib_howler', 'xib_ashmoth', 'xib_censer', 'xib_jade_colossus', 'xib_bloodpriest', 'xib_obsidian_lancer'],
    boss: 'xib_boss',
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

// ------------------------------------------------------------------- bosses
//
// Eight regions need eight bosses. Two are authored (`pnw_boss`, `xib_boss`)
// and four exist as the old floor bosses, which are real, finished, two-phase
// fights and are worth redistributing rather than retiring.
//
// The Regent goes to region 8 rather than to region 4, because its ×10 HP was
// authored to be the LAST fight in the game ("an endurance test rather than one
// more fight" — content/bosses.js) and §3.4 says clearing region 8 completes
// the run. The other three take regions 3, 4 and 5 in their original order.
//
// Regions 6 and 7 have no boss. That is a content gap, not an error state, and
// it must never be a crash: rosters and bosses for 3–8 are separate design
// work. They fall back, once, loudly.
export const LEGACY_BOSS_BY_REGION = {
  3: 'ossuary_hulk', 4: 'choir_of_eyes', 5: 'broodmother_viv', 8: 'vault_regent',
};

const warnedBoss = new Set();
export function bossForRegion(regionIndex) {
  const r = REGION_BY_INDEX[regionIndex];
  if (r && r.boss && BOSS_BY_ID[r.boss]) return BOSS_BY_ID[r.boss];
  const legacy = LEGACY_BOSS_BY_REGION[regionIndex];
  if (legacy && BOSS_BY_ID[legacy]) return BOSS_BY_ID[legacy];
  const fallback = BOSS_BY_ID[LEGACY_BOSS_BY_REGION[8]] || ALL_BOSS_DEFS[0];
  if (!warnedBoss.has(regionIndex)) {
    warnedBoss.add(regionIndex);
    console.log(`[region] region ${regionIndex} has no authored boss — falling back to ${fallback.id}. `
      + 'A region without its own boss is unfinished content, not a broken build; this is the message that says which one.');
  }
  return fallback;
}

// Which regions actually have their own boss, for the world map and for gates
// that want to say "6 of 8" rather than pretend.
export function regionsWithAuthoredBoss() {
  const out = [];
  for (let i = 1; i <= TOTAL_REGIONS; i++) {
    const r = REGION_BY_INDEX[i];
    if ((r && r.boss && BOSS_BY_ID[r.boss]) || BOSS_BY_ID[LEGACY_BOSS_BY_REGION[i]]) out.push(i);
  }
  return out;
}

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
    // A COUNT IS NOT A SET (§13 rule 43). The line above counted six and passed
    // for central_america while all six ids — ca_jaguar_priest, ca_bloodletter,
    // ca_xib_shade, ca_obsidian_knight, ca_howler, ca_skull_rack — named
    // content that was never authored; the region actually ships xib_*. The
    // names were placeholders from when this file predated the populations
    // (see the header), and nothing ever resolved them, so they stayed wrong
    // through both regions going contentReady.
    //
    // Only applied to regions that HAVE a population: regions 3-8 are names
    // with no content by design, and this must not demand art that the roadmap
    // says does not exist yet.
    if (r.contentReady) {
      const dead = r.enemies.filter(id => !REGION_ENEMY_BY_ID[id]);
      if (dead.length) problems.push(`${r.id}: declares ${dead.length} enemy id(s) that no population defines: ${dead.join(', ')} `
        + '— a contentReady region naming content that does not exist is a count passing over a set nobody resolved');
      if (!REGION_BOSS_BY_ID[r.boss]) problems.push(`${r.id}: boss "${r.boss}" is not defined in any region population`);
    }
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
  // THE WORLD AXIS COVERS EVERY REGION. A short table is the defect this
  // replaced: `FLOOR_BIOMES` had four entries for four floors and would have
  // read `undefined` at floor five, and the shop's tier table has the same
  // shape. A curve with seven entries for eight regions is a game that gets
  // easier at the end and says nothing about it.
  for (const [name, arr] of [['REGION_HP_MULT', REGION_HP_MULT], ['REGION_DMG_MULT', REGION_DMG_MULT], ['REGION_ANCHOR_LEVEL', REGION_ANCHOR_LEVEL]]) {
    if (arr.length !== TOTAL_REGIONS) problems.push(`${name} has ${arr.length} entries for ${TOTAL_REGIONS} regions`);
    if (arr.some(v => !(v > 0))) problems.push(`${name} contains a non-positive entry`);
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < arr[i - 1]) problems.push(`${name} falls from ${arr[i - 1]} to ${arr[i]} at region ${i + 1} — the world axis may flatten, never reverse`);
    }
  }
  if (REGION_HP_MULT[0] !== 1 || REGION_DMG_MULT[0] !== 1) {
    problems.push('region 1 must be exactly ×1 on both world-axis multipliers — it is the baseline every number in the game was tuned against');
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
