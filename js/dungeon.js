// Floor generation, Gauntlet edition: each floor is a branching NODE MAP —
// 5 columns deep (4 fight/stop columns + the Siege), 9–10 nodes total,
// 2–3 choices per step, all paths converging on the floor's Siege finale.
// Guaranteed per floor: ≥1 Shop, ≥1 Treasure, and ≥1 Elite on an optional
// branch (at least one path avoids it). Everything else is Combat.
// Deterministic from the run seed via a per-floor sub-stream.

import { subRng } from './rng.js';
import { TEMPLATE_KEYS } from './arenas.js';

export function generateFloorMap(seed, floorNum) {
  const rng = subRng(seed, 'map', floorNum);
  for (let attempt = 0; attempt < 40; attempt++) {
    const map = tryMap(rng, floorNum);
    if (map) return map;
  }
  throw new Error('node map generation failed'); // never expected (verified across seeds)
}

function tryMap(rng, floorNum) {
  // column sizes: [2,2,2,2] or one middle column of 3 → 9–10 nodes with the Siege
  const sizes = [2, 2, 2, 2];
  if (rng.chance(0.6)) sizes[rng.int(1, 2)] = 3;
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

  // kind assignment: shop, treasure, elite on distinct non-entry fight nodes
  const mid = nodes.filter(n => n.col >= 1 && n.col <= 3 && n.kind === 'combat');
  const picks = rng.shuffle([...mid]);
  if (picks.length < 3) return null;
  picks[0].kind = 'shop';
  picks[1].kind = 'treasure';
  // elite: must be avoidable — some path from an entry to the siege skips it
  let elite = null;
  for (const cand of picks.slice(2)) {
    if (avoidablePathExists(nodes, cols[0], siege.id, cand.id)) { elite = cand; break; }
  }
  if (!elite) return null;
  elite.kind = 'elite';

  // arena templates: deal a seeded shuffle round-robin across the fight nodes
  // (6–7 of them) so every floor draws from all five shapes
  const fights = nodes.filter(n => n.kind === 'combat' || n.kind === 'elite');
  const deck = rng.shuffle([...TEMPLATE_KEYS]);
  fights.forEach((n, i) => { n.template = deck[i % deck.length]; });

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
    nodes: map.nodes.map(n => ({ id: n.id, col: n.col, row: n.row, kind: n.kind, template: n.template, edges: n.edges })),
  };
}
