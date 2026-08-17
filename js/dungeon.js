// Floor generation, objectives edition: each floor is a branching NODE MAP of
// exactly 12 COMBAT nodes (shops/reliquaries/the Siege are extra), 6 columns
// deep, all paths converging on the floor's Siege finale.
//
// Composition of those 12 (the objectives patch):
//   always      1 Nest Purge, 1 Bounty Hunt, 1 Breach
//   1–2 each    Zone Control, Elite Arena
//   odd floors  +1 Relic Run and +1 Storm Survival
//   even floors +1 Payload
//   the rest    standard horde arenas — ALWAYS 4–6 of them. If a roll would
//               leave fewer, a duplicate Zone/Elite node is dropped.
// Guaranteed per floor: ≥1 Shop, ≥1 Reliquary, and ≥1 Elite Arena that some
// path avoids. Deterministic from the run seed via a per-floor sub-stream.

import { subRng } from './rng.js';
import { CONFIG } from './config.js';
import { TEMPLATE_KEYS, COMBAT_PROFILE_KEYS } from './arenas.js';

const FIGHT_NODES = 12;      // combat nodes per floor (excludes shop/treasure/siege)
export const HORDE_MIN = 4;  // the generator's hard invariant …
export const HORDE_MAX = 6;  // … on plain horde arenas

// ---------------------------------------------------------------- the opening
//
// THE FIRST THREE MAPS ARE PLAIN SKIRMISHES. Clear the enemies, nothing else.
//
// This is a widening of a rule that already existed rather than a new idea:
// column 0 was already forced to plain hordes, for the reason stated below —
// "the objective levels assume a node or two of build-up behind you". A party
// that meets Nest Purge as its second room is learning a win condition, a class
// and a build at the same time. Three columns is the ruled span.
//
// ONLY THE WIN CONDITION IS UNIFIED. Templates, profiles, obstacles and arena
// dimensions are dealt exactly as before, so the three maps still look and play
// differently — `region_opening_gate` asserts they generate distinct layouts,
// because "make three maps the same objective" is one careless edit away from
// "make three maps the same map".
export const OPENING_FLOOR = CONFIG.OPENING_FLOOR;
export const OPENING_SKIRMISH_COLUMNS = CONFIG.OPENING_SKIRMISH_COLUMNS;   // columns 0,1,2

// WHAT IT COSTS, STATED RATHER THAN DISCOVERED LATER. Columns 0-2 are sized
// [2,2,3] = SEVEN nodes, and all seven must now be plain hordes — one more than
// HORDE_MAX. So floor 1 cannot also carry its old special roster: twelve fight
// nodes minus seven hordes leaves FIVE specials, against the eight-to-eleven an
// odd floor used to roll.
//
// The five kept are the three unconditional levels plus one Zone and one Elite
// Arena. Relic Run and Storm Survival are dropped FROM FLOOR 1 ONLY and still
// appear on floor 3, the other odd floor, so no objective type disappears from
// a run. Elite Arena is kept because the avoidability rule below is written
// about it and a floor with none would make that guard vacuous.
export const OPENING_SPECIALS = ['nest', 'bounty', 'breach', 'zone', 'elite_arena'];

export function generateFloorMap(seed, floorNum) {
  const rng = subRng(seed, 'map', floorNum);
  for (let attempt = 0; attempt < 60; attempt++) {
    const map = tryMap(rng, floorNum);
    if (map) return map;
  }
  throw new Error('node map generation failed'); // never expected (verified across seeds)
}

// The floor's objective menu, resolved before layout so the count is exact.
// Returns a list of 12 kinds (order irrelevant — it gets shuffled onto nodes).
export function rollComposition(rng, floorNum) {
  // The opening floor's roster is fixed rather than rolled: seven of its twelve
  // fight nodes are spoken for by the skirmish columns, and the remaining five
  // are exactly OPENING_SPECIALS. Rolling 1-2 Zones against a five-slot budget
  // would be a roll that cannot lose, which is not a roll.
  if (floorNum === OPENING_FLOOR) {
    // THE STREAM IS CONSUMED EVEN THOUGH THE ROLL IS NOT USED, and that is not
    // superstition. The general path below draws `rng.chance(0.5)` twice; an
    // early return that skips them shifts every subsequent draw on this floor —
    // the composition shuffle, the two stop placements, the template deck and
    // the profile deck. Floor 1's seeded maps would all become different maps.
    //
    // Measured, not feared: skipping them re-rolled floor 1 for every seed and
    // took `region_test`, `stat_gate`, `difficulty_gate` and `econ_gate` red
    // together, because each pins a seed to a floor-1 arena and was suddenly
    // measuring a different one. Two discarded draws keep every existing
    // fixture pointed at the arena it was tuned against.
    rng.chance(0.5); rng.chance(0.5);
    const kinds = [...OPENING_SPECIALS];
    while (kinds.length < FIGHT_NODES) kinds.push('combat');
    return kinds.slice(0, FIGHT_NODES);
  }
  const kinds = ['nest', 'bounty', 'breach'];
  let zones = 1 + (rng.chance(0.5) ? 1 : 0);
  let elites = 1 + (rng.chance(0.5) ? 1 : 0);
  const extra = floorNum % 2 === 1 ? ['relic', 'storm'] : ['payload'];
  // drop duplicate Zone/Elite nodes until the horde arenas fit the invariant
  for (;;) {
    const special = kinds.length + zones + elites + extra.length;
    const horde = FIGHT_NODES - special;
    if (horde >= HORDE_MIN) break;
    if (zones > 1) zones--;
    else if (elites > 1) elites--;
    else break; // can't happen with the current numbers; the guard is the point
  }
  for (let i = 0; i < zones; i++) kinds.push('zone');
  for (let i = 0; i < elites; i++) kinds.push('elite_arena');
  kinds.push(...extra);
  while (kinds.length < FIGHT_NODES) kinds.push('combat'); // the horde arenas
  return kinds.slice(0, FIGHT_NODES);
}

function tryMap(rng, floorNum) {
  // 6 fight columns holding 14 nodes: 12 combat + the shop + the reliquary.
  // Column sizes stay 2–3 wide so the map reads at a glance on a phone.
  const sizes = [2, 2, 3, 3, 2, 2];
  const spare = 14 - sizes.reduce((a, b) => a + b, 0);
  for (let i = 0; i < spare; i++) sizes[1 + rng.int(0, 3)]++;
  const nodes = [];
  const cols = sizes.map((n, c) => {
    const col = [];
    for (let r = 0; r < n; r++) {
      const nd = { id: nodes.length, col: c, row: r, kind: 'combat', template: null, edges: [] };
      nodes.push(nd); col.push(nd);
    }
    return col;
  });
  const siege = { id: nodes.length, col: sizes.length, row: 0, kind: 'siege', template: null, edges: [] };
  nodes.push(siege);
  cols.push([siege]);

  // edges: non-crossing range mapping col→col+1 (every node has an exit,
  // every next-column node an entrance), plus a chance to widen the choice
  for (let c = 0; c < cols.length - 1; c++) {
    const A = cols[c], B = cols[c + 1];
    for (let i = 0; i < A.length; i++) {
      const lo = Math.floor(i * B.length / A.length);
      const hi = Math.floor(((i + 1) * B.length - 1) / A.length);
      for (let j = lo; j <= hi; j++) A[i].edges.push(B[j].id);
      if (hi + 1 < B.length && rng.chance(0.45)) A[i].edges.push(B[hi + 1].id);
    }
  }

  // The two stops (shop + reliquary) go on distinct non-entry nodes — and on
  // the opening floor they must also clear the skirmish columns, because those
  // columns are three MAPS and a shop is not a map. Pushing them right is what
  // makes the opening seven fights rather than five fights and two stops.
  const stopFloor = floorNum === OPENING_FLOOR ? OPENING_SKIRMISH_COLUMNS : 1;
  const mid = nodes.filter(n => n.col >= stopFloor && n.col <= sizes.length - 1 && n.kind === 'combat');
  const picks = rng.shuffle([...mid]);
  if (picks.length < 3) return null;
  picks[0].kind = 'shop';
  picks[1].kind = 'treasure';

  // deal the 12-kind composition across everything that is still combat
  const fights = nodes.filter(n => n.kind === 'combat');
  if (fights.length !== FIGHT_NODES) return null;
  const comp = rng.shuffle(rollComposition(rng, floorNum));
  fights.forEach((n, i) => { n.kind = comp[i]; });

  // The floor OPENS on plain horde arenas. A party walks into column 0 with
  // whatever it started with, and the objective levels — a 90-second survival,
  // a five-champion bounty — assume a node or two of build-up behind you.
  // There are always ≥4 horde arenas, so the two entry slots can spare them.
  //
  // On the opening floor this runs across the first THREE columns, not one:
  // maps 1-3 are plain skirmishes (see OPENING_SKIRMISH_COLUMNS). The swap is
  // the same one — a special in an opening slot trades places with a horde
  // further in — and it cannot run out of hordes because rollComposition sized
  // the roster for exactly this.
  const openCols = floorNum === OPENING_FLOOR ? OPENING_SKIRMISH_COLUMNS : 1;
  for (const entry of fights.filter(n => n.col < openCols)) {
    if (entry.kind === 'combat') continue;
    const swap = fights.find(n => n.col >= openCols && n.kind === 'combat');
    if (!swap) return null;
    swap.kind = entry.kind;
    entry.kind = 'combat';
  }

  // the avoidability rule now guards Elite Arenas: at least one of them must
  // sit on a branch some path skips, so a party can always route around the
  // floor's nastiest room
  const eliteNodes = fights.filter(n => n.kind === 'elite_arena');
  if (!eliteNodes.some(n => avoidablePathExists(nodes, cols[0], siege.id, n.id))) return null;

  // arena templates: deal a seeded shuffle round-robin across the fight nodes
  // so every floor draws from all five shapes
  const deck = rng.shuffle([...TEMPLATE_KEYS]);
  fights.forEach((n, i) => { n.template = deck[i % deck.length]; });

  // pressure profiles: Bastion (the sanctioned camping fight) rolls ~1 in 4
  // HORDE nodes; everything else deals from a shuffled recipe deck so
  // consecutive fights differ and every role shows up across the floor.
  // Objective levels never roll Bastion — their own script is the pressure.
  const pdeck = rng.shuffle([...COMBAT_PROFILE_KEYS]);
  let pi = 0;
  for (const n of fights) {
    if (n.kind === 'combat' && rng.chance(0.25)) n.profile = 'bastion';
    else { n.profile = pdeck[pi % pdeck.length]; pi++; }
  }

  return {
    floorNum, nodes,
    siegeId: siege.id,
    startIds: cols[0].map(n => n.id),
  };
}

// path from any entry to target avoiding `skip`?
function avoidablePathExists(nodes, entries, targetId, skipId) {
  const seen = new Set();
  const q = entries.filter(n => n.id !== skipId).map(n => n.id);
  for (const id of q) seen.add(id);
  while (q.length) {
    const id = q.shift();
    if (id === targetId) return true;
    for (const nid of nodes[id].edges) {
      if (nid === skipId || seen.has(nid)) continue;
      seen.add(nid); q.push(nid);
    }
  }
  return false;
}

// Serializable layout for clients (the node-map screen)
export function serializeMap(map) {
  return {
    floorNum: map.floorNum,
    siegeId: map.siegeId,
    startIds: map.startIds,
    nodes: map.nodes.map(n => ({ id: n.id, col: n.col, row: n.row, kind: n.kind, template: n.template, profile: n.profile || null, edges: n.edges })),
  };
}
