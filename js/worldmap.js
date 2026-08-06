// THE WORLD MAP — the layer above the node tree.
//
// Eight regions, played in order, gated by each character's own frontier. This
// module is the STATE and the RULES; the DOM lives in ui/worldmap.js so the
// rules can be tested headless, the same split every other screen uses.
//
// Difficulty lives here too rather than in regions.js, because it is a party
// choice made on this screen and it applies to the region about to be entered —
// it is not a property of the region.

import { REGIONS, REGION_BY_INDEX, TOTAL_REGIONS, LOCKED_REGION_NAMES, depthMult } from './regions.js';
import { canEnter } from './saves.js';

// ---------------------------------------------------------------- difficulty
//
// Party-selected, per region, and it multiplies enemy HP, damage and density.
// XP IS NOT TIED TO IT. That is the load-bearing rule: if a harder setting paid
// more XP, it stops being a preference and becomes the correct choice, and
// every player who wanted the easier fight is now playing wrong. Gold scales,
// because gold is a per-run resource a player can choose to gamble on; levels
// are permanent and must not be.
export const DIFFICULTIES = [
  { id: 'measured', name: 'Measured', hp: 0.85, dmg: 0.85, density: 0.85, gold: 0.9,
    desc: 'The vault takes its time with you.' },
  { id: 'standard', name: 'Standard', hp: 1.0, dmg: 1.0, density: 1.0, gold: 1.0,
    desc: 'As intended.' },
  { id: 'harrowed', name: 'Harrowed', hp: 1.3, dmg: 1.25, density: 1.2, gold: 1.35,
    desc: 'More of them, and they hit like the floor below.' },
  { id: 'unmade', name: 'Unmade', hp: 1.7, dmg: 1.5, density: 1.45, gold: 1.8,
    desc: 'Every mistake is the last one you make in this room.' },
];
export const DIFFICULTY_BY_ID = Object.fromEntries(DIFFICULTIES.map(d => [d.id, d]));
export const DEFAULT_DIFFICULTY = 'standard';

export function difficultyOf(id) { return DIFFICULTY_BY_ID[id] || DIFFICULTY_BY_ID[DEFAULT_DIFFICULTY]; }

// ---------------------------------------------------------------- the map

// One row per region: what it is, whether this character may enter it, and why
// not if not. `reason` is shown on the card — a locked door with no explanation
// reads as a bug rather than a goal.
export function worldMapState(character, playerStore) {
  const rows = [];
  for (let i = 1; i <= TOTAL_REGIONS; i++) {
    const region = REGION_BY_INDEX[i];
    if (!region) {
      rows.push({
        index: i, id: null, name: LOCKED_REGION_NAMES[i - 3] || `Region ${i}`,
        state: 'unbuilt', reason: 'Not built yet.', contentReady: false,
        enterable: false, expectedLevel: null, depth: null,
      });
      continue;
    }
    const withinFrontier = canEnter(character, i);
    let state, reason;
    if (!region.contentReady) { state = 'unbuilt'; reason = 'Not built yet.'; }
    else if (!withinFrontier) { state = 'locked'; reason = `Clear region ${character.frontier} first.`; }
    else if (i < character.frontier) { state = 'cleared'; reason = 'Cleared. Replaying grants loot but no world progress.'; }
    else { state = 'frontier'; reason = 'Your frontier. Clearing this advances you.'; }
    rows.push({
      index: i, id: region.id, name: region.name,
      state, reason, contentReady: !!region.contentReady,
      enterable: !!region.contentReady && withinFrontier,
      expectedLevel: region.expectedLevel,
      nativeClass: region.nativeClass,
      unlocked: !!(playerStore && playerStore.unlockedClasses || []).includes(region.nativeClass),
      depth: [1, 2, 3, 4, 5].map(depthMult),
      parked: !!(character.parked && character.parked.region === i),
    });
  }
  return {
    rows,
    frontier: character.frontier,
    total: TOTAL_REGIONS,
    built: rows.filter(r => r.contentReady).length,
  };
}

// A party enters together, so the entry check is over every member. The rule is
// the HOST's frontier gates the room — a friend below their frontier is carried
// (loot and XP, no world progress), a friend above it cannot be, because a
// region they have not reached is a region they cannot legally be in.
export function partyCanEnter(characters, regionIndex) {
  const region = REGION_BY_INDEX[regionIndex];
  if (!region) return { ok: false, reason: `region ${regionIndex} does not exist` };
  if (!region.contentReady) return { ok: false, reason: `${region.name} is not built yet` };
  const blocked = characters.filter(c => !canEnter(c, regionIndex));
  if (blocked.length) {
    return { ok: false, reason: `${blocked.length} player(s) are below this region: ${blocked.map(c => c.name || c.id).join(', ')}`, blocked };
  }
  return { ok: true };
}

// ---------------------------------------------------------------- assertions

function assertWorldMap() {
  const problems = [];
  const ids = new Set();
  for (const d of DIFFICULTIES) {
    if (ids.has(d.id)) problems.push(`difficulty ${d.id}: duplicate id`);
    ids.add(d.id);
    for (const k of ['hp', 'dmg', 'density', 'gold']) {
      if (!(d[k] > 0)) problems.push(`difficulty ${d.id}: ${k} must be > 0`);
    }
    // XP DELIBERATELY ABSENT. Asserted so nobody adds it back as a "reward".
    if ('xp' in d) problems.push(`difficulty ${d.id}: declares an xp multiplier — XP must NOT scale with difficulty, or the hardest setting stops being a preference and becomes the only correct choice`);
    if (!d.desc) problems.push(`difficulty ${d.id}: needs a description — a player picks this before they know what it feels like`);
  }
  if (!DIFFICULTY_BY_ID[DEFAULT_DIFFICULTY]) problems.push(`DEFAULT_DIFFICULTY ${DEFAULT_DIFFICULTY} is not a declared difficulty`);
  const std = DIFFICULTY_BY_ID.standard;
  if (!std || std.hp !== 1 || std.dmg !== 1 || std.density !== 1 || std.gold !== 1) {
    problems.push('the "standard" difficulty must be exactly 1.0 on every axis — it is the baseline every other number in the game is tuned against');
  }
  // Monotonic: harder must mean harder on every axis, and pay more.
  for (let i = 1; i < DIFFICULTIES.length; i++) {
    const a = DIFFICULTIES[i - 1], b = DIFFICULTIES[i];
    for (const k of ['hp', 'dmg', 'density', 'gold']) {
      if (!(b[k] > a[k])) problems.push(`difficulty ${b.id}: ${k} ${b[k]} is not above ${a.id}'s ${a[k]} — the ladder must be monotonic or two settings are the same choice`);
    }
  }
  if (REGIONS.some(r => r.index < 1 || r.index > TOTAL_REGIONS)) problems.push('a region index is outside 1..TOTAL_REGIONS');
  if (problems.length) throw new Error(`world map failed ${problems.length} load assertion(s):\n  - ${problems.join('\n  - ')}`);
}

assertWorldMap();
