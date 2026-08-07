// The roster. ONE roster — the fourteen Thrones of Heaven warriors.
//
// The classic 33 are retired and preserved, unimported, in
// archive/classic-roster/. They were pre-overhaul content that the GDD's
// 14-class design replaces rather than extends, and §15 defect #11 forced the
// call: weapons are gone, skills are the only damage source, skills come from
// trees, and not one of those 33 had a tree. Building 33 trees would have been
// authoring content the design had already removed.
//
// Everything that existed to reconcile two rosters went with them — the
// switcher, js/roster.js's URL/localStorage resolution, the lobby picker, the
// host-authoritative `applyHostRoster` co-op guard, and the silent
// `CHAR_BY_ID[id] || CHAR_BY_ID.bulwark` fallback in game.js. With one roster
// there is nothing to resolve, nothing to guard, and nothing to fall back from.
//
// This module stays PURE: no `location`, no `localStorage`, no DOM.

import { CHARACTERS_TOH } from './characters-toh.js';
import { TREES, TREES_BY_CLASS } from '../skills.js';

export const CHARACTERS = CHARACTERS_TOH;
export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

// Kept as aliases because a finished run's results screen and a save file both
// look up characters that may no longer be selectable. Lookup must never fail
// for a character that exists; SELECTABLE below is about what you may START as.
export const ALL_CHARS = CHARACTERS;
export const ALL_CHAR_BY_ID = CHAR_BY_ID;

// ---------------------------------------------------------------- selectability
//
// A class you can pick must have something to fight with. Weapons are removed,
// so that means a skill tree — and this is DERIVED from the tree data, never
// listed by hand. As phase 5 lands trees, classes become selectable with no
// code change at all; a hand-maintained list would need editing once per class
// and would be wrong the first time someone forgot.
//
// Twelve of the fourteen are unselectable today. They stay VISIBLE, greyed,
// with the reason on the card — a roster that silently shrinks to two looks
// broken, and a player who cannot see what is coming cannot look forward to it.
export function classTrees(charId) { return TREES_BY_CLASS[charId] || []; }
export function isSelectable(charId) { return classTrees(charId).length > 0; }
export function unselectableReason(charId) {
  return isSelectable(charId) ? null : 'No skill tree yet — this class cannot fight, so it cannot be chosen.';
}
export const SELECTABLE = CHARACTERS.filter(c => isSelectable(c.id));

// ---------------------------------------------------------------- load assertion
//
// THE CHECK nuke() PREVENTED FROM EVER MATTERING. tools/sim_test.mjs cleared
// every fight by killing the enemies itself, so the suite stayed green for a
// whole patch against a party with no offence whatsoever. A selectable class
// with no way to deal damage is a class a player can choose and then be unable
// to play, and that must fail at import rather than twenty seconds into a
// fight that will never end.
//
// "Has a tree" is not enough — a tree of nothing but passives arms no one. The
// requirement is a tier-1 ACTIVE that can actually deal damage, because tier 1
// is the only thing a level-1 character can reach.
const problems = [];
for (const c of SELECTABLE) {
  const trees = classTrees(c.id);
  // Tier 1 is the only thing a level-1 character can reach, so it is the only
  // tier that decides whether they can fight on the first floor.
  const tier1Actives = trees
    .flatMap(id => (TREES[id] ? TREES[id].skills : []))
    .filter(s => s.tier === 1 && s.type === 'active');

  if (!tier1Actives.length) {
    problems.push(`${c.id} is selectable but has no tier-1 active in [${trees.join(', ') || 'no tree'}]`
      + ' — a level-1 player of this class cannot act at all');
    continue;
  }
  // "Has an active" is not enough either: an active that only wards or buffs
  // arms nobody. A damaging step is one whose compose entry carries damage.
  const damaging = tier1Actives.filter(s => (s.compose || []).some(step => (step.damage || 0) > 0));
  if (!damaging.length) {
    problems.push(`${c.id}'s tier-1 actives (${tier1Actives.map(s => s.id).join(', ')}) carry no damage in any`
      + ' compose step — a level-1 player of this class can act but cannot kill anything');
  }
}
if (problems.length) {
  throw new Error('SELECTABLE CLASS WITHOUT OFFENCE:\n  ' + problems.join('\n  ')
    + '\n\nA class is selectable because it has a tree (see isSelectable). If a tree exists but arms nobody,'
    + '\neither it needs a damaging tier-1 active or the class is not ready to be selectable.'
    + '\n\nThis is the check nuke() prevented from ever mattering: sim_test cleared every fight by killing'
    + '\nthe enemies itself, so the suite stayed green for a patch against a party with no offence at all.');
}
