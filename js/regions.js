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
import { REGION_ENEMY_BY_ID, REGION_BOSS_BY_ID, REGION_ENEMIES, enemyRole } from './content/regions-enemies.js';
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
// THE LEVEL A PLAYER ARRIVES AT, PER REGION (§4.2, §4.3; rulings R-7).
//
// These read 1, 10, 19 … 64 — nine levels a region, from "1–2 levels per map"
// over six fights — and the game never paid that. Measured on main at 22419eb
// (tools/region_pace.mjs, the XP a plain combat room credits): region 1's five
// maps pay about 1,250 XP, which buys level 23, and by the same arithmetic a
// player reached region 4 at about level 50 against an anchor of 28. Every
// enemy number in the game is measured AT these anchors, so the world axis was
// scaling bodies for a character two regions weaker than the one in the room.
// The only map whose exit level anybody asserted was the first.
//
// The curve is now held where §4.2 says it is, and the first map keeps the
// one deliberate exception it was given on 2 Nov: region 1's map 1 is the
// onboarding room and leaves a character at level 6–7 with three slots. So
// region 1 runs 1 → 6.5, then 1.5 a fight, and arrives at region 2 at 14;
// every later region is 1.5 a fight over six fights. The run ends at 77,
// which is the "level 80" docs/power-curve-phase1.md confirmed as the design
// assumption.
//
// `MAP_XP_MULT` (js/arenas.js) is what makes the game pay this, and
// tools/level_curve_gate.mjs plays every map in every region and asserts it.
export const REGION_ANCHOR_LEVEL = [1, 14, 23, 32, 41, 50, 59, 68];
export const LEVELS_PER_FIGHT = 1.5;
export const FIGHTS_PER_REGION = 6;          // five maps and the boss (§2.2)
export const MAP1_EXIT_LEVEL = 6.5;          // region 1's first map: the 6–7 window
// The level a character is expected to carry INTO fight `depth` of a region:
// 0–4 are the five maps, 5 is the boss.
export function expectedLevelAt(regionIndex, depth) {
  const d = Math.max(0, depth | 0);
  if ((regionIndex | 0) <= 1) return d === 0 ? 1 : MAP1_EXIT_LEVEL + LEVELS_PER_FIGHT * (d - 1);
  return REGION_ANCHOR_LEVEL[Math.min(REGION_ANCHOR_LEVEL.length, regionIndex | 0) - 1] + LEVELS_PER_FIGHT * d;
}
// RE-MEASURED 14 Nov 2026 (rulings R-8), `node tools/region_curve.mjs`. The
// table above this comment's predecessor read
//
//   HP ×  1.00  2.13  3.84  4.33  5.29  6.02  7.35  7.36
//
// and was measured honestly against a character that does not exist: four
// classes, at anchors the XP economy overshot by two regions, built by
// assigning `p.level` — which grants a level's skill points and none of its
// stat cards. By region 8 that fixture was missing sixty-three cards, most of
// a character's Damage stat. Re-measured at the anchors the game now actually
// pays (REGION_ANCHOR_LEVEL above), across all fourteen classes, on
// characters built through the game's own level-up path:
//
//   region      1     2      3      4      5      6      7      8
//   level       1    14     23     32     41     50     59     68
//   median dps 16.3  77.1  163.1  155.9  197.7  237.9  276.9  340.0
//
// So a region-8 character puts out about 21× a level-1 one, and the axis said
// 7.36. Everything that rides this table — landmarks, specials, elites,
// pylons, nests — was a third as tough as flat time-to-kill asks by the end
// of the run. That is the "run gets easier the longer it runs" shape the
// four-floor curve was replaced for, arrived at by a different road.
//
// Region 4 measures a hair UNDER region 3 (155.9 against 163.1): the level-32
// loadout window opens a slot the breadth-first build fills with a utility
// skill. The axis may flatten and never reverse (asserted below), so region 4
// holds region 3's value rather than inventing a dip.
//
// DAMAGE keeps the relationship stated above, HP^0.608. It is no longer
// unmeasurable — with stat cards spent, effective HP for a build that takes
// damage and vitality evenly grows ×7 to ×9 by region 8, against ×6.34 here —
// so the inherited exponent lands where a measured one would, and is kept
// because it is the documented rule. A build that takes ONLY damage cards
// grows its effective HP ×1.2 and will find region 8 lethal; that is the
// card's price, not a tuning error.
export const REGION_HP_MULT = [1.00, 4.74, 10.04, 10.04, 12.16, 14.64, 17.04, 20.92];
export const REGION_DMG_MULT = [1.00, 2.57, 4.06, 4.06, 4.56, 5.11, 5.60, 6.34];

// ------------------------------------------------ the fodder axis (§4.3, §2.6)
//
// FODDER DOES NOT RIDE `REGION_HP_MULT`. Ruled 2026-11-14.
//
// `REGION_HP_MULT` is the player's TOTAL output growth, and it was measured
// honestly — ×7.36 by region 8. But that growth is almost all RATE: a level-1
// character fires one skill and a level-64 one fires eight. The size of a
// single hit barely moves. Measured across all fourteen classes at every
// anchor (`tools/roster_weight_gate.mjs`, the build the world axis itself was
// measured against):
//
//   region                  1     2     3     4     5     6     7     8
//   weakest opener hit      5     5     5     5     5     5     5     5
//   fodder on REGION_HP   3.9   8.2  14.8  16.7  20.4  23.3  28.4  28.4
//   hits to kill it         1     2     3     4     4     5     6     6
//
// §2.6 rule 4 says fodder dies to one hit and that "later regions keep the
// same hit counts". Multiplying a one-hit body by a rate-growth number breaks
// exactly that, and no authored HP can repair it: 1 HP × 4.33 is already over
// the packet by region 4. The two rules could never both hold.
//
// So the axis is split by what it measures. A body that is supposed to die to
// ONE HIT scales with how hard one hit lands — this table. A body that is
// supposed to take a FIGHT (special, landmark, elite, boss, pylon, nest)
// scales with total output — `REGION_HP_MULT`, unchanged. And the horde grows
// the way the player's rate grows: in COUNT, through the spawn rate, which is
// the pace pass's number and deliberately not this file's.
//
// This is the weakest opener packet at each anchor, MEASURED, not authored.
// It is flat today because ranks are +4% of base on a 5-damage packet and a
// breadth-first build puts one or two ranks in an opener. If openers are ever
// given real per-level growth the table moves with them and fodder thickens
// to match — which is the point of deriving the multiplier from the packet
// rather than writing eight ones. `roster_weight_gate` re-measures every
// entry and fails on drift in either direction.
export const REGION_OPENER_PACKET = [5, 5, 5, 5, 5, 5, 5, 5];

// Clamped rather than wrapped: a region index outside 1..8 is a bug, and the
// last band is the safe thing to be wrong with.
function bandIndex(regionIndex) {
  const i = (regionIndex | 0) - 1;
  return Math.max(0, Math.min(TOTAL_REGIONS - 1, i));
}
export function regionHpMult(regionIndex) { return REGION_HP_MULT[bandIndex(regionIndex)]; }
export function regionDmgMult(regionIndex) { return REGION_DMG_MULT[bandIndex(regionIndex)]; }
export function anchorLevel(regionIndex) { return REGION_ANCHOR_LEVEL[bandIndex(regionIndex)]; }
export function regionFodderHpMult(regionIndex) {
  return REGION_OPENER_PACKET[bandIndex(regionIndex)] / REGION_OPENER_PACKET[0];
}

// A roster authored for horde pace — fodder plus a few specials — as opposed
// to one still on the slow curve, whose non-telegraphing units are 6–9 HP
// chaff tuned AGAINST the world axis and must keep it.
export function isHordeRoster(regionIndex) {
  const r = REGION_BY_INDEX[regionIndex];
  return !!(r && REGION_ENEMIES[r.id] && REGION_ENEMIES[r.id].horde);
}

// THE ONE PLACE THAT DECIDES WHICH HP AXIS A BODY RIDES. Both the spawn path
// and the gate call this, so they cannot disagree about what "live HP" means —
// two implementations of one multiplier is how a gate ends up asserting a
// number the game never fields.
//
// `opts` IS PART OF THE QUESTION. "Fodder" is a role in a crowd, not a property
// of a def: the same Dust Dingo is fodder when the wave draws it and is NOT
// fodder when it is spawned as an elite, or as an Elite Arena champion, or as
// a bounty — those are bodies meant to take a fight, and they keep the world
// axis whatever they are a copy of. The first version asked only the def, so
// an elite fodder in region 8 would have arrived at 3 × 1 × 3 = 9 HP against a
// landmark's 683. Anything spawned with `elite` or an objective's `hpMult` is
// not a plain body.
export function enemyHpAxis(regionIndex, def, opts) {
  const plain = !opts || (!opts.elite && !opts.hpMult);
  return plain && isHordeRoster(regionIndex) && enemyRole(def) === 'fodder'
    ? regionFodderHpMult(regionIndex)
    : regionHpMult(regionIndex);
}

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
    expectedLevel: 14,
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
  {
    id: 'great_britain', index: 3, name: 'Great Britain',
    nativeClass: 'bard',
    expectedLevel: 23,
    // Mental after spiritual: the triangle turns a second time, so a party
    // that re-specced for region 2 is pushed again rather than rewarded.
    domainSkew: { primary: 'mental', secondary: null, maxShare: 0.60 },
    // No `britain` biome is declared yet (no tile art on disk), so the region
    // draws its flat fill — the normal missing-art state, see biomes.js.
    tileset: 'britain',
    hazard: 'fae_ring',                // a ring you should not step into
    cursedModifier: 'glamour',         // telegraph tint hidden until just before it fires
    enemies: ['gb_redcap', 'gb_hunt_rider', 'gb_sprite', 'gb_banshee', 'gb_stone_giant', 'gb_sidhe_knight'],
    boss: 'gb_boss',
    tuning: { hpMult: 1.0, damageMult: 1.0, densityMult: 1.0 },
    contentReady: true,
  },
  {
    id: 'egypt', index: 4, name: 'Egypt',
    nativeClass: 'wizard',
    expectedLevel: 32,
    // Back to spiritual, with mental second: region 2's answer works again,
    // but only for half the crowd.
    domainSkew: { primary: 'spiritual', secondary: 'mental', maxShare: 0.60 },
    tileset: 'sahel',
    hazard: 'quicksand',               // ground that holds you while the lane is drawn
    cursedModifier: 'sandglass',       // the wave runs long
    enemies: ['eg_ushabti', 'eg_mummy', 'eg_jackal', 'eg_eye', 'eg_sphinx', 'eg_sobek_guard'],
    boss: 'eg_boss',
    tuning: { hpMult: 1.0, damageMult: 1.0, densityMult: 1.0 },
    contentReady: true,
  },
  {
    id: 'central_africa', index: 5, name: 'Central Africa',
    nativeClass: 'witch_doctor',
    expectedLevel: 41,
    domainSkew: { primary: 'spiritual', secondary: 'physical', maxShare: 0.60 },
    tileset: 'delta',
    hazard: 'rot_pool',                // standing water that rots: do not fight in it
    cursedModifier: 'fever',           // the crowd's touch lands harder
    enemies: ['caf_mire_lunger', 'caf_mire_shade', 'caf_bloat_toad', 'caf_mask_bearer', 'caf_rot_hippo', 'caf_elder_mask'],
    boss: 'caf_boss',
    tuning: { hpMult: 1.0, damageMult: 1.0, densityMult: 1.0 },
    contentReady: true,
  },
  {
    id: 'northern_russia', index: 6, name: 'Northern Russia',
    nativeClass: 'necromancer',
    expectedLevel: 50,
    domainSkew: { primary: 'physical', secondary: 'mental', maxShare: 0.60 },
    tileset: 'tundra',
    hazard: 'black_ice',               // ground you cannot stop on
    cursedModifier: 'deep_winter',     // you move slower
    enemies: ['ru_shieldbearer', 'ru_frozen_dead', 'ru_blizzard_wraith', 'ru_rusalka', 'ru_leshy', 'ru_upyr'],
    boss: 'ru_boss',
    tuning: { hpMult: 1.0, damageMult: 1.0, densityMult: 1.0 },
    contentReady: true,
  },
  {
    id: 'off_indonesia', index: 7, name: 'Off Indonesia',
    nativeClass: 'sundian',
    expectedLevel: 59,
    domainSkew: { primary: 'mental', secondary: null, maxShare: 0.60 },
    tileset: 'abyss',
    hazard: 'riptide',                 // a current that carries you
    cursedModifier: 'undertow',        // they move faster
    enemies: ['ind_spearfish', 'ind_tide_eel', 'ind_drowned_sentinel', 'ind_lantern_lure', 'ind_coral_colossus', 'ind_tide_caller'],
    boss: 'ind_boss',
    tuning: { hpMult: 1.0, damageMult: 1.0, densityMult: 1.0 },
    contentReady: true,
  },
  {
    id: 'australian_outback', index: 8, name: 'Australian Outback',
    nativeClass: 'hunter',
    expectedLevel: 68,
    // EVEN, and the cap says so: 40% where every other region allows 60%.
    // §3.2 — "the endgame demands full party coverage rather than one
    // counter-build". `primary` names the plurality; it leads by four points.
    domainSkew: { primary: 'physical', secondary: null, maxShare: 0.40 },
    tileset: 'outback',
    hazard: 'bushfire',                // a front that moves across the room
    cursedModifier: 'big_country',     // the big things come in numbers
    enemies: ['aus_thylacoleo', 'aus_dust_dingo', 'aus_mirage', 'aus_cinder', 'aus_diprotodon', 'aus_genyornis'],
    boss: 'aus_boss',
    tuning: { hpMult: 1.0, damageMult: 1.0, densityMult: 1.0 },
    contentReady: true,
  },
];

// Every region is built. This list held the names of the unbuilt ones so a
// player could see the shape of the whole run from the first session; it is
// kept, empty, because `built + named === 8` is asserted below and the world
// map reads it — an unbuilt region is a state the code should still be able to
// express, even though the game no longer has one.
export const LOCKED_REGION_NAMES = [];
export const TOTAL_REGIONS = 8;

export const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r]));
export const REGION_BY_INDEX = Object.fromEntries(REGIONS.map(r => [r.index, r]));

// ------------------------------------------------------------------- bosses
//
// Eight regions need eight bosses. Three are authored (`pnw_boss`, `xib_boss`,
// `gb_boss`; an authored boss always wins over the legacy table below)
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
  for (const [name, arr] of [['REGION_HP_MULT', REGION_HP_MULT], ['REGION_DMG_MULT', REGION_DMG_MULT], ['REGION_ANCHOR_LEVEL', REGION_ANCHOR_LEVEL], ['REGION_OPENER_PACKET', REGION_OPENER_PACKET]]) {
    if (arr.length !== TOTAL_REGIONS) problems.push(`${name} has ${arr.length} entries for ${TOTAL_REGIONS} regions`);
    if (arr.some(v => !(v > 0))) problems.push(`${name} contains a non-positive entry`);
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < arr[i - 1]) problems.push(`${name} falls from ${arr[i - 1]} to ${arr[i]} at region ${i + 1} — the world axis may flatten, never reverse`);
    }
  }
  // THE LEVEL CURVE IS ONE STATEMENT MADE IN THREE PLACES — the anchor table,
  // each region's `expectedLevel`, and "1.5 a fight over six fights" — and
  // three places is how the anchors came to describe a game nobody was
  // playing. They are held to each other here.
  for (const r of REGIONS) {
    if (r.expectedLevel !== REGION_ANCHOR_LEVEL[r.index - 1]) problems.push(`${r.id}: expectedLevel ${r.expectedLevel} is not its anchor ${REGION_ANCHOR_LEVEL[r.index - 1]}`);
  }
  for (let i = 1; i < TOTAL_REGIONS; i++) {
    const out = expectedLevelAt(i, FIGHTS_PER_REGION);
    if (Math.abs(out - REGION_ANCHOR_LEVEL[i]) > 1e-9) problems.push(`region ${i} ends at level ${out} after ${FIGHTS_PER_REGION} fights and region ${i + 1}'s anchor is ${REGION_ANCHOR_LEVEL[i]} — the curve does not join`);
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
