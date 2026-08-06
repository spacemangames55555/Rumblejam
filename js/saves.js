// SAVES — one object per character, and a small player-level store beside it.
//
// There is no separate world save. A character carries its own world progress,
// which is what makes "open a character in solo and the world map is where you
// left it" true without a second source of truth to keep in sync.
//
// CLEARING BROWSER DATA DESTROYS SAVES. That is a property of localStorage, not
// something this file can fix, so export/import to a real file is part of the
// format rather than a nicety — and the UI has to say so plainly.

import { REGIONS, REGION_BY_INDEX, TOTAL_REGIONS } from './regions.js';
import { TREES, TREES_BY_CLASS, SKILL_BY_ID } from './skills.js';

export const SAVE_VERSION = 1;
const CHAR_KEY = 'rj.characters.v1';
const PLAYER_KEY = 'rj.player.v1';

// ---------------------------------------------------------------- shape

export function newCharacter(id, classId, opts = {}) {
  return {
    v: SAVE_VERSION,
    id, class: classId,
    name: opts.name || 'Unnamed',
    level: opts.level || 1,
    points: { spent: {}, unspent: opts.unspent ?? 1 },
    items: [],
    frontier: 1,                      // highest region reached
    parked: null,                     // { region, tree, cleared, difficulty }
  };
}

export function newPlayerStore() {
  // Deliberately small. Unlocked classes, shared across a player's characters,
  // and nothing else — every other piece of state belongs to a character.
  return { v: SAVE_VERSION, unlockedClasses: [] };
}

// ---------------------------------------------------------------- frontier

// A character advances its frontier ONLY by clearing the region that IS its
// frontier. Below it is a replay; above it grants levels and items but no world
// progress. Advancement is on PRESENCE at the boss kill, regardless of how many
// nodes that player personally cleared — a friend who joined for the last two
// maps still moved forward.
export function onRegionCleared(character, regionIndex) {
  const before = character.frontier;
  let outcome;
  if (regionIndex < before) outcome = 'replay';
  else if (regionIndex > before) outcome = 'above-frontier';
  else {
    character.frontier = Math.min(TOTAL_REGIONS, before + 1);
    outcome = 'advanced';
  }
  // the parked tree for that region is finished either way
  if (character.parked && character.parked.region === regionIndex) character.parked = null;
  return { outcome, before, after: character.frontier };
}

export function canEnter(character, regionIndex) {
  return regionIndex >= 1 && regionIndex <= character.frontier;
}

// Clearing region N records its native class as unlocked. The class does not
// exist yet — the store proves it works, the UI shows a named but unplayable
// entry, and no class comes into scope to prove a store.
export function recordUnlock(store, regionIndex) {
  const region = REGION_BY_INDEX[regionIndex];
  if (!region || !region.nativeClass) return null;
  if (!store.unlockedClasses.includes(region.nativeClass)) store.unlockedClasses.push(region.nativeClass);
  return region.nativeClass;
}

// ---------------------------------------------------------------- parking

// A character three maps into region 2 who joins a friend's region 2 plays the
// HOST's rolled tree for that session. Their own tree and cleared nodes are
// untouched — parking is per character, and a session never writes to it.
export function park(character, regionIndex, tree, cleared, difficulty) {
  character.parked = { region: regionIndex, tree, cleared: [...cleared], difficulty };
}
export function unpark(character, regionIndex) {
  if (!character.parked || character.parked.region !== regionIndex) return null;
  return character.parked;
}

// ---------------------------------------------------------------- validation

// Run on every load, including import. A save that arrived from a file is
// untrusted input: it may be from an older build, hand-edited, or truncated.
export function validateCharacter(c) {
  const problems = [];
  if (!c || typeof c !== 'object') return ['not an object'];
  if (c.v !== SAVE_VERSION) problems.push(`save version ${c.v}, this build reads ${SAVE_VERSION}`);
  if (!c.id) problems.push('no id');
  if (!TREES_BY_CLASS[c.class]) problems.push(`class "${c.class}" has no trees in this build`);
  if (!(c.level >= 1)) problems.push(`level ${c.level}`);
  if (!(c.frontier >= 1 && c.frontier <= TOTAL_REGIONS)) problems.push(`frontier ${c.frontier} outside 1..${TOTAL_REGIONS}`);
  if (!c.points || typeof c.points.spent !== 'object' || !(c.points.unspent >= 0)) problems.push('points block malformed');
  else {
    const own = new Set((TREES_BY_CLASS[c.class] || []).flatMap(t => TREES[t].skills.map(s => s.id)));
    for (const [id, rank] of Object.entries(c.points.spent)) {
      if (!SKILL_BY_ID[id]) problems.push(`spent points on unknown skill "${id}"`);
      else if (!own.has(id)) problems.push(`spent points on "${id}", which is not a ${c.class} skill`);
      if (!(rank >= 1)) problems.push(`"${id}" has rank ${rank}`);
    }
  }
  if (c.parked) {
    if (!REGION_BY_INDEX[c.parked.region]) problems.push(`parked in region ${c.parked.region}, which does not exist`);
    if (!Array.isArray(c.parked.cleared)) problems.push('parked.cleared is not an array');
  }
  return problems;
}

// ---------------------------------------------------------------- storage

function store() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function loadAll() {
  const s = store();
  const empty = { characters: [], player: newPlayerStore() };
  if (!s) return empty;
  try {
    const chars = JSON.parse(s.getItem(CHAR_KEY) || '[]');
    const player = JSON.parse(s.getItem(PLAYER_KEY) || 'null') || newPlayerStore();
    return { characters: Array.isArray(chars) ? chars : [], player };
  } catch { return empty; }
}

export function saveAll(characters, player) {
  const s = store();
  if (!s) return false;
  try {
    s.setItem(CHAR_KEY, JSON.stringify(characters));
    s.setItem(PLAYER_KEY, JSON.stringify(player));
    return true;
  } catch { return false; }   // quota, private mode — the caller tells the player
}

// ---------------------------------------------------------------- export

// The file format. A wrapper rather than a bare array so a future version can
// be detected on import instead of parsed as garbage.
export function exportBundle(characters, player) {
  return JSON.stringify({ v: SAVE_VERSION, exported: null, characters, player }, null, 2);
}

// Untrusted input. Returns { ok, characters, player, problems } and never
// throws — an import that half-succeeds is worse than one that refuses.
export function importBundle(text) {
  let data;
  try { data = JSON.parse(text); }
  catch (err) { return { ok: false, problems: [`not valid JSON: ${err.message}`] }; }
  if (!data || typeof data !== 'object') return { ok: false, problems: ['not an object'] };
  if (data.v !== SAVE_VERSION) return { ok: false, problems: [`bundle version ${data.v}, this build reads ${SAVE_VERSION}`] };
  if (!Array.isArray(data.characters)) return { ok: false, problems: ['no characters array'] };
  const problems = [];
  data.characters.forEach((c, i) => {
    for (const p of validateCharacter(c)) problems.push(`character ${i} (${c && c.name}): ${p}`);
  });
  if (problems.length) return { ok: false, problems };
  const player = data.player && Array.isArray(data.player.unlockedClasses) ? data.player : newPlayerStore();
  return { ok: true, characters: data.characters, player, problems: [] };
}

// The prompt fires after each region clear. Stated here so the rule lives with
// the format rather than in whichever screen happens to call it.
export const EXPORT_PROMPT_AFTER_REGION_CLEAR = true;
export const STORAGE_WARNING = 'Saves live in this browser. Clearing browser data will destroy them — export to a file to keep them.';
