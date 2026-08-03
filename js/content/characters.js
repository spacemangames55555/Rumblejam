// Roster selector. Two rosters ship — the classic 33 and the 14 Thrones of
// Heaven warriors — and exactly one is active at a time.
//
// `CHARACTERS` and `CHAR_BY_ID` are live ES bindings that `setRoster()`
// reassigns, so every existing import site (game.js, main.js, the UI, the test
// harnesses) keeps working untouched and simply sees the active roster. Nothing
// downstream needs to know a second roster exists.
//
// This module stays PURE: no `location`, no `localStorage`, no DOM. Resolving
// which roster a browser session should open with lives in js/roster.js, and
// the headless test harnesses import this file directly and get `classic`.
//
// In co-op the roster is HOST-AUTHORITATIVE: the host's choice rides the lobby
// and start messages, and a joining client calls setRoster() with the host's id
// before it touches a single charId. See applyHostRoster() in js/roster.js.

import { CHARACTERS_CLASSIC } from './characters-classic.js';
import { CHARACTERS_TOH } from './characters-toh.js';

const byId = list => Object.fromEntries(list.map(c => [c.id, c]));

export const ROSTERS = {
  classic: { id: 'classic', name: 'Classic', blurb: 'The original 33.', chars: CHARACTERS_CLASSIC },
  toh: { id: 'toh', name: 'Thrones of Heaven', blurb: 'The 14 warriors.', chars: CHARACTERS_TOH },
};
export const ROSTER_IDS = Object.keys(ROSTERS);
export const DEFAULT_ROSTER = 'classic';

// Every character from every roster, for lookups that must never fail — a
// results screen replaying a finished run, or a client that has not switched
// yet. Character ids are unique across both rosters (ToH ids are `toh_`-
// prefixed), so this map is unambiguous.
export const ALL_CHARS = [...CHARACTERS_CLASSIC, ...CHARACTERS_TOH];
export const ALL_CHAR_BY_ID = byId(ALL_CHARS);

export let ROSTER_ID = DEFAULT_ROSTER;
export let CHARACTERS = ROSTERS[DEFAULT_ROSTER].chars;
export let CHAR_BY_ID = byId(CHARACTERS);

// Switch the active roster. Returns the id actually in force, so a caller
// handed a bad value from the wire still knows what it ended up with.
export function setRoster(id) {
  const next = ROSTERS[id] ? id : DEFAULT_ROSTER;
  if (next !== ROSTER_ID) {
    ROSTER_ID = next;
    CHARACTERS = ROSTERS[next].chars;
    CHAR_BY_ID = byId(CHARACTERS);
  }
  return ROSTER_ID;
}

export function activeRoster() { return ROSTERS[ROSTER_ID]; }

// Which roster a character id belongs to — used by the co-op guard to notice
// that a client is holding characters the host's roster does not contain.
export function rosterOf(charId) {
  for (const r of ROSTER_IDS) if (ROSTERS[r].chars.some(c => c.id === charId)) return r;
  return null;
}
