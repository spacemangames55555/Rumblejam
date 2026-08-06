// THE REGION NODE TREE — ten nodes, five columns of two, pick five.
//
// Constructed directly rather than generated and then validated. Five columns
// of two, every node linking forward into the next column, means EVERY path
// from entry to the boss gate is exactly five nodes long by construction —
// there are no dead ends to detect and no path lengths to verify, because the
// shape cannot produce them.
//
//         A1 - A2 - A3 - A4 - A5
//   ENTRY  X    X    X    X       BOSS
//         B1 - B2 - B3 - B4 - B5
//
// Each node always links to its same-row successor and, with probability
// CROSS_LINK_CHANCE, to the other row's. Routes diverge and reconverge; path
// length never moves.

import { subRng } from './rng.js';
import { CROSS_LINK_CHANCE, depthMult } from './regions.js';

export const COLUMNS = 5;
export const ROWS = 2;

// GDD §2.2, exactly. Ten nodes, this distribution, every time.
export const NODE_MIX = { horde: 4, elite: 2, objective: 2, shrine: 1, cursed: 1 };
export const NODE_TYPES = Object.keys(NODE_MIX);

export const OBJECTIVE_POOL = ['zone', 'elite_arena', 'nest', 'bounty', 'breach', 'relic', 'storm', 'payload'];

// Shrine and Cursed may not sit in column 1 — the first choice a player makes
// should be between fights, not between a fight and a free skill point.
const NO_COLUMN_1 = new Set(['shrine', 'cursed']);

export function generateTree(seed, region, reroll = 0) {
  const rng = subRng(seed, 'nodetree', region.index, reroll);

  // ---- the ten slots, then the types placed into them under constraints ----
  const slots = [];
  for (let c = 1; c <= COLUMNS; c++) for (let r = 0; r < ROWS; r++) slots.push({ col: c, row: r });

  // Build the multiset, shuffle it, and re-shuffle until the placement rules
  // hold. The rules reject a small fraction of orderings, so this converges
  // immediately; the guard exists so a future rule change cannot spin forever
  // without saying so.
  const bag = [];
  for (const [t, n] of Object.entries(NODE_MIX)) for (let i = 0; i < n; i++) bag.push(t);
  let placed = null;
  for (let attempt = 0; attempt < 200 && !placed; attempt++) {
    const shuffled = [...bag];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const trial = slots.map((s, i) => ({ ...s, type: shuffled[i] }));
    if (trial.some(n => n.col === 1 && NO_COLUMN_1.has(n.type))) continue;
    // both Elites in one column would make that column a non-choice
    const eliteCols = trial.filter(n => n.type === 'elite').map(n => n.col);
    if (eliteCols[0] === eliteCols[1]) continue;
    placed = trial;
  }
  if (!placed) throw new Error(`nodetree: could not satisfy placement constraints for ${region.id} — the rules over-constrain 10 slots`);

  // ---- identity, contents, and depth ----
  const nodes = placed.map((n, i) => ({
    id: `${n.col}${n.row === 0 ? 'A' : 'B'}`,
    col: n.col, row: n.row, type: n.type,
    // objective nodes name WHICH objective, so the type is readable before
    // selection rather than being a surprise on arrival
    objective: n.type === 'objective' ? OBJECTIVE_POOL[Math.floor(rng.next() * OBJECTIVE_POOL.length)] : null,
    depthMult: +depthMult(n.col).toFixed(3),
    next: [],
  }));
  const at = (col, row) => nodes.find(n => n.col === col && n.row === row);

  for (const n of nodes) {
    if (n.col === COLUMNS) { n.next = ['BOSS']; continue; }
    n.next.push(at(n.col + 1, n.row).id);                       // same row, always
    if (rng.next() < CROSS_LINK_CHANCE) n.next.push(at(n.col + 1, 1 - n.row).id);
  }

  return {
    regionId: region.id, seed, reroll,
    entry: [at(1, 0).id, at(1, 1).id],
    nodes,
    gate: 'BOSS',
  };
}

// ---------------------------------------------------------------- assertions

// Run on every generated tree. A distribution that drifts is a design change
// nobody made, and it would show up as "the region feels samey" long before
// anyone counted the nodes.
export function assertTree(tree) {
  const problems = [];
  const n = tree.nodes;
  if (n.length !== COLUMNS * ROWS) problems.push(`${n.length} nodes, want ${COLUMNS * ROWS}`);

  const counts = {};
  for (const x of n) counts[x.type] = (counts[x.type] || 0) + 1;
  for (const [t, want] of Object.entries(NODE_MIX)) {
    if ((counts[t] || 0) !== want) problems.push(`${counts[t] || 0} ${t} nodes, want ${want}`);
  }
  for (const t of Object.keys(counts)) if (!NODE_MIX[t]) problems.push(`unknown node type "${t}"`);

  for (const x of n) {
    if (x.col === 1 && NO_COLUMN_1.has(x.type)) problems.push(`${x.id}: ${x.type} in column 1`);
    if (x.type === 'objective' && !OBJECTIVE_POOL.includes(x.objective)) problems.push(`${x.id}: objective "${x.objective}" is not one of the eight`);
    if (x.type !== 'objective' && x.objective) problems.push(`${x.id}: non-objective node carries an objective`);
    if (!x.next.length) problems.push(`${x.id}: dead end`);
    for (const t of x.next) {
      if (t === 'BOSS') { if (x.col !== COLUMNS) problems.push(`${x.id}: column ${x.col} links straight to the boss`); continue; }
      const target = n.find(y => y.id === t);
      if (!target) problems.push(`${x.id}: links to ${t}, which does not exist`);
      else if (target.col !== x.col + 1) problems.push(`${x.id} -> ${t}: not a forward link into the next column`);
    }
  }
  const eliteCols = n.filter(x => x.type === 'elite').map(x => x.col);
  if (eliteCols[0] === eliteCols[1]) problems.push(`both elites in column ${eliteCols[0]}`);

  // Every route is five nodes. Walked rather than assumed, because "by
  // construction" is a claim about the code and this is a check on the output.
  const lengths = new Set();
  // `seen` is the count of NODES already walked, so reaching the gate records
  // the route length rather than the number of hops including the gate itself —
  // which is what the first version counted, reporting 6 for every valid tree.
  const walk = (id, seen) => {
    if (id === 'BOSS') { lengths.add(seen); return; }
    const node = n.find(y => y.id === id);
    if (!node) return;
    for (const t of node.next) walk(t, seen + 1);
  };
  // start at 0: the entry node is counted by the hop OUT of it, so a five-node
  // route reaches the gate with seen === 5
  for (const e of tree.entry) walk(e, 0);
  if (lengths.size !== 1 || !lengths.has(COLUMNS)) problems.push(`path lengths ${[...lengths].join('/')}, want exactly ${COLUMNS}`);

  return problems;
}

// A route a player could actually take, for tests and for the bot.
export function walkRoute(tree, rng) {
  const route = [];
  let id = tree.entry[rng ? Math.floor(rng.next() * tree.entry.length) : 0];
  while (id !== 'BOSS') {
    const node = tree.nodes.find(n => n.id === id);
    route.push(node);
    id = node.next[rng ? Math.floor(rng.next() * node.next.length) : 0];
  }
  return route;
}
