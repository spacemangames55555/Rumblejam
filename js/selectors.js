// WHAT A SKILL HITS, as a field separate from when it fires.
//
// Weapons had varied targeting rules and the player chose the rule by choosing
// the weapon: a shotgun hit everything close, a sniper took the farthest or the
// fattest, a homing shot tracked one thing. Triggers collapsed all of that into
// position and health fraction, so every skill converged on "whatever is
// nearest" — and chaff is always nearest. Nests, bounty marks and elites were
// never targeted by anything (§15 defect #13: an armed necromancer at 4230
// damage and ZERO kills in Elite Arena, 311 kills and 0 of 5 marks in Bounty
// Hunt, 22 kills and 3 of 3 nests untouched).
//
// The loss was variety in the SELECTION RULE, not aiming. So the trigger keeps
// its one job — when to fire — and `select` gets the other:
//
//   trigger: { kind: 'PROXIMITY', radius: 140, count: 3 }   // when
//   select:  'highest_hp'                                    // what
//
// Every selector is a rule over what is ALREADY queryable. None of them is a
// new player input; the player picks the rule by picking the skill, exactly as
// they used to pick it by picking the weapon.

// A hand-maintained list, because adding a selector should be a deliberate act
// with a load assertion behind it rather than a string someone typed once.
export const SELECT_KINDS = [
  'nearest',           // the old universal default, now one option among several
  'farthest',          // reach builds: hit the back line, not the thing on you
  'highest_hp',        // the fattest target — elites and bosses, by construction
  'lowest_hp',         // execute: finish what is nearly dead
  'densest_cluster',   // the crowd answer: aim where the most bodies are
  'objective_target',  // nests, marks, elites, bosses — the thing the level is about
  // THE HONEST ANSWER FOR A SKILL THAT PICKS NOTHING. `select` means what a
  // skill hits, and a self-buff hits the caster — it has no target to choose.
  // Before this existed those skills declared `nearest` and ignored it, which
  // is the same shape as D-36 and D-37: something declared, nothing reading it,
  // and nobody noticing because the convention was consistent. It also made the
  // rule uncheckable — with every skill naming a real selector there was no way
  // for a load assertion to say "this one should not have".
  'self',
];

// Roles the level cares about, in the order a player would prioritise them.
// Read off tags the sim already sets; this adds no new bookkeeping.
function objectivePriority(e) {
  if (e.isNest) return 4;
  if (e.bounty) return 3;
  if (e.boss) return 2;
  if (e.elite || e.mini) return 1;
  return 0;
}

// A shielded nest cannot be hurt (damageEnemy refuses it outright), so
// preferring it would be worse than useless — the skill would fire into a wall
// while the ring that drops the shield went unkilled. A player would shoot the
// ring; so does the selector.
function attackable(e) {
  return e && e.active && !e.nestShielded;
}

function dist2(a, x, y) { const dx = a.x - x, dy = a.y - y; return dx * dx + dy * dy; }

// The candidate set is whatever the grid already returns for this range — the
// selector re-ranks, it never widens the search. A selector that could reach
// past a skill's range would silently give every skill infinite reach.
//
// LINE OF SIGHT IS PART OF THE CANDIDATE SET, NOT PART OF THE RANKING. `los`
// is a predicate the caller supplies (it owns the geometry; this module has no
// `sim`), and a target it rejects is not a worse target — it is not a target.
// Ranking it and then discarding the winner would silently hand the skill to
// whatever placed second, which is a different bug wearing the same fix.
//
// WHY THIS LAYER. `losBlocked` and `_nearestVisibleEnemy` have existed since
// patch 9 and are correct; the live attack path simply never reached them.
// Weapons were removed and `_fireWeapon` — the one caller that tested sight —
// stopped running with them (js/config.js says so in as many words). Every
// composed skill selects through here, so this is the single place the rule
// can be stated once and hold for all fifteen primitives. §13 rule 75: the
// module was imported and still a graveyard.
function candidates(grid, x, y, range, los) {
  const out = [];
  const r2 = range * range;
  for (const e of grid.near(x, y, range)) {
    if (!attackable(e)) continue;
    if (dist2(e, x, y) > r2) continue;
    if (los && !los(e)) continue;
    out.push(e);
  }
  return out;
}

// The densest cluster is scored by how many others sit within a fixed radius of
// each candidate — the same question "where is the crowd" asked per target
// rather than globally, so the answer is always something in range.
const CLUSTER_R2 = 120 * 120;
function clusterScore(e, list) {
  let n = 0;
  for (const o of list) if (o !== e && dist2(o, e.x, e.y) <= CLUSTER_R2) n++;
  return n;
}

function rank(kind, e, list, x, y) {
  switch (kind) {
    case 'nearest': return -dist2(e, x, y);
    case 'farthest': return dist2(e, x, y);
    case 'highest_hp': return e.hp;
    case 'lowest_hp': return -e.hp;
    case 'densest_cluster': return clusterScore(e, list);
    // Priority first, then proximity inside a priority band — with three nests
    // on the field the near one is the right nest.
    case 'objective_target': return objectivePriority(e) * 1e9 - dist2(e, x, y);
    default: return -dist2(e, x, y);
  }
}

// ONE target. Returns null when nothing is in range, exactly as grid.nearest()
// did, so every call site's existing null handling still holds.
// `self` never resolves to an enemy. Guarded here as well as asserted at load,
// because a step that reads a selector must never silently inherit a target
// from a skill that declared it has none.
export function selectTarget(kind, grid, x, y, range, los) {
  if (kind === 'self') return null;
  const list = candidates(grid, x, y, range, los);
  if (!list.length) return null;
  let best = null, bestScore = -Infinity;
  for (const e of list) {
    const sc = rank(kind, e, list, x, y);
    if (sc > bestScore) { bestScore = sc; best = e; }
  }
  return best;
}

// N targets, best-first by the same rule. Used by multi-bolt steps, which used
// to take grid.nearestN() and therefore always the N nearest.
export function selectTargets(kind, grid, x, y, range, count, los) {
  if (kind === 'self') return [];
  const list = candidates(grid, x, y, range, los);
  if (!list.length) return [];
  return list
    .map(e => ({ e, sc: rank(kind, e, list, x, y) }))
    .sort((a, b) => b.sc - a.sc)
    .slice(0, count)
    .map(o => o.e);
}
