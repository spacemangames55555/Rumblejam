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
import { TEMPLATE_KEYS, COMBAT_PROFILE_KEYS } from './arenas.js';

const FIGHT_NODES = 12;      // combat nodes per floor (excludes shop/treasure/siege)
export const HORDE_MIN = 4;  // the generator's hard invariant …
export const HORDE_MAX = 6;  // … on plain horde arenas

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

  // the two stops (shop + reliquary) go on distinct non-entry nodes
  const mid = nodes.filter(n => n.col >= 1 && n.col <= sizes.length - 1 && n.kind === 'combat');
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
  for (const entry of fights.filter(n => n.col === 0)) {
    if (entry.kind === 'combat') continue;
    const swap = fights.find(n => n.col > 0 && n.kind === 'combat');
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
