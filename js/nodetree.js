// THE REGION TREE — a region IS the map. There is no floor inside it.
//
// Five COMBAT columns of two, two full-width stops every route crosses, then
// the boss gate. GDD §2.3, with the two stops §2.3 does not mention and a run
// cannot do without.
//
//   ENTRY ─ 1A ─ 2A ─ ⟦RELIQUARY⟧ ─ 3A ─ 4A ─ ⟦SHOP⟧ ─ 5A ─ BOSS
//            ×    ×                  ×    ×             ×
//           1B ─ 2B ─               3B ─ 4B ─          5B ─
//
// WHY THE STOPS ARE BANDS AND NOT CELLS. A route takes exactly one node per
// column, so a node sharing its column with another is on SOME routes. The old
// floor map could afford an avoidable shop because it dealt fourteen nodes and
// you walked six; a five-node route that misses the shop is a run with no shop
// in it. "Every route passes both" therefore means the stop owns its whole
// column — which is not a choice, and is not pretending to be one.
//
// RELIQUARY BEFORE SHOP. The same ruling `_clearArena` already makes one level
// down, where the spend step is raised before `_openShop`: what you slot
// changes what you want to buy. The shop then sits four fights deep, with
// income behind it and one fight in front of it to test the purchase.
//
// PATH LENGTH IS STILL FIVE. The bands carry `depth: null` and are skipped by
// the depth axis, so `depthMult` still runs 1..5 and §2.3's route-length claim
// is about the same five fights it always was. `col` is the GRAPH column
// (0..7, bands included) because that is what the edge invariant and the map
// screen need; `depth` is the fight index, and they are deliberately two
// fields rather than one clever one.

import { subRng } from './rng.js';
import { CROSS_LINK_CHANCE, depthMult } from './regions.js';
import { TEMPLATE_KEYS, COMBAT_PROFILE_KEYS } from './arenas.js';

export const COLUMNS = 5;   // COMBAT columns — the route length §2.3 asserts
export const ROWS = 2;

// GDD §2.4, exactly. Ten nodes, this distribution, every time.
export const NODE_MIX = { horde: 4, elite: 2, objective: 2, shrine: 1, cursed: 1 };
export const NODE_TYPES = Object.keys(NODE_MIX);

export const OBJECTIVE_POOL = ['zone', 'elite_arena', 'nest', 'bounty', 'breach', 'relic', 'storm', 'payload'];

// The mix names types; the sim knows kinds. An `objective` node's kind is the
// objective it drew, which is what puts its real icon on the map screen.
const KIND_OF = { horde: 'combat', elite: 'elite', shrine: 'shrine', cursed: 'cursed' };

// THE TWO STOPS, as data, because their placement is a design call and a design
// call should cost one line to overrule. `after` is the COMBAT depth the band
// follows — `{after: 2}` sits between fights 2 and 3.
export const STOP_BANDS = [
  { after: 2, kind: 'treasure' },
  { after: 4, kind: 'shop' },
];

// WHAT MAY NOT BE THE FIRST FIGHT.
//
// Shrine and Cursed, per §2.4: the first choice a player makes should be
// between fights, not between a fight and a free skill point.
//
// And OBJECTIVES AND ELITES, which §2.4 does not say and the retired floor map
// did: "The floor OPENS on plain horde arenas. A party walks into column 0 with
// whatever it started with, and the objective levels assume a node or two of
// build-up behind you." That reasoning is about a party's FIRST FIGHT rather
// than about which generator produced it, so it transfers — and it binds harder
// here, because a floor map's column 0 was one of six fights before the boss
// and a region's map 1 is one of five, played at a single skill slot.
//
// The elite half was found by measurement, not by reading. `elite` is a node
// TYPE the floor map never had, so nothing swapped it off the entry column, and
// 30% of generated regions opened on one: ×0.55 count, ×2.4 HP, against a
// level-1 character. `region_test` caught it by outcome — a character left map 1
// at LEVEL 2 with one slot instead of level 6 with two, because §2.2's
// onboarding ramp is written for a horde arena and an elite room fields 45%
// fewer bodies to pay it.
//
// Two horde nodes at map 1 is still a choice between fights (different
// templates, different pressure profiles); it is not a choice between a fight
// and a champion pack.
const NO_FIRST_COLUMN = new Set(['shrine', 'cursed', 'objective', 'elite']);

// ------------------------------------------------------- the objective draw
//
// Two of eight per region, no repeat inside a region, biased toward what the
// player has not seen lately. Sixteen draws across a full run, so the bias is
// what stops a playthrough dealing Nest Purge five times and Payload never.
//
// RECENCY IS THE RUN'S OWN HISTORY, NOT THE SAVE. The tree must stay a pure
// function of (seed, region, reroll, history) — §11.3 lets a character three
// maps into region 3 join a friend's region 3 and play the HOST's rolled tree,
// which is only coherent if the host can roll it from things the host has.
// Reading the guest's save would make the same seed produce different trees for
// different people. `recent` is the objectives dealt in EARLIER REGIONS OF THIS
// RUN, one array per region, oldest first — itself seed-derived, so
// determinism survives.
export const RECENCY_SPAN = 4;   // regions back before a type is "unseen" again

export function drawObjectives(rng, recent = []) {
  const pool = [...OBJECTIVE_POOL];
  const out = [];
  for (let k = 0; k < NODE_MIX.objective; k++) {
    const weights = pool.map(t => {
      let since = RECENCY_SPAN;                        // never seen: maximum staleness
      for (let i = recent.length - 1; i >= 0; i--) {
        if (recent[i] && recent[i].includes(t)) { since = recent.length - i; break; }
      }
      return Math.min(RECENCY_SPAN, Math.max(1, since));
    });
    let r = rng.next() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < weights.length - 1 && (r -= weights[i]) > 0) i++;
    out.push(pool[i]);
    pool.splice(i, 1);                                 // no repeat inside a region
  }
  return out;
}

// ------------------------------------------------------------------ the tree

export function generateTree(seed, region, reroll = 0, opts = {}) {
  const rng = subRng(seed, 'nodetree', region.index, reroll);

  // ---- the ten combat slots, then the types placed into them ----
  const slots = [];
  for (let d = 1; d <= COLUMNS; d++) for (let r = 0; r < ROWS; r++) slots.push({ depth: d, row: r });

  const bag = [];
  for (const [t, n] of Object.entries(NODE_MIX)) for (let i = 0; i < n; i++) bag.push(t);
  let placed = null;
  for (let attempt = 0; attempt < 200 && !placed; attempt++) {
    const shuffled = rng.shuffle([...bag]);
    const trial = slots.map((s, i) => ({ ...s, type: shuffled[i] }));
    if (trial.some(n => n.depth === 1 && NO_FIRST_COLUMN.has(n.type))) continue;
    // both Elites at one depth would make that column a non-choice
    const eliteDepths = trial.filter(n => n.type === 'elite').map(n => n.depth);
    if (eliteDepths[0] === eliteDepths[1]) continue;
    placed = trial;
  }
  if (!placed) throw new Error(`nodetree: could not satisfy placement constraints for ${region.id} — the rules over-constrain ${COLUMNS * ROWS} slots`);

  const objectives = drawObjectives(rng, opts.recent || []);
  let oi = 0;

  // ---- lay the graph out: combat columns interleaved with the stop bands ----
  //
  // `id` is an index into `nodes`, matching the contract the sim, the snapshot
  // codec and the map screen have always used (`floor.nodes[nodeId]`). `key` is
  // the stable string a save parks against, so `cleared: ['1A','2B']` survives
  // a regeneration that renumbers ids.
  const nodes = [];
  const columns = [];
  const add = (col, row, kind, extra) => {
    const nd = {
      id: nodes.length, key: null, col, row, kind,
      depth: null, mix: null, objective: null, depthMult: 1,
      template: null, profile: null, edges: [], ...extra,
    };
    nodes.push(nd);
    return nd;
  };

  let col = 0;
  for (let d = 1; d <= COLUMNS; d++) {
    const band = placed.filter(p => p.depth === d).sort((a, b) => a.row - b.row).map(s => {
      const kind = s.type === 'objective' ? objectives[oi++] : KIND_OF[s.type];
      return add(col, s.row, kind, {
        key: `${d}${s.row === 0 ? 'A' : 'B'}`,
        depth: d, mix: s.type,
        objective: s.type === 'objective' ? kind : null,
        depthMult: +depthMult(d).toFixed(3),
      });
    });
    columns.push(band);
    col++;
    for (const stop of STOP_BANDS) {
      if (stop.after !== d) continue;
      columns.push([add(col, 0, stop.kind, { key: stop.kind === 'shop' ? 'SHOP' : 'RELIC' })]);
      col++;
    }
  }
  const boss = add(col, 0, 'siege', { key: 'BOSS' });
  columns.push([boss]);

  // ---- edges: forward one graph column, always ----
  for (let c = 0; c < columns.length - 1; c++) {
    const A = columns[c], B = columns[c + 1];
    for (const a of A) {
      // into a band or the gate: forced, which is what "every route passes it"
      // means in edges rather than in prose
      if (B.length === 1) { a.edges.push(B[0].id); continue; }
      // out of a band: both rows open. A band is a full reconvergence, so the
      // row a player was on before it carries no meaning after it.
      if (A.length === 1) { for (const b of B) a.edges.push(b.id); continue; }
      // combat → combat: same row always, the other row on the cross-link roll
      a.edges.push(B.find(b => b.row === a.row).id);
      if (rng.next() < CROSS_LINK_CHANCE) a.edges.push(B.find(b => b.row !== a.row).id);
    }
  }

  // ---- arena templates and pressure profiles ----
  // Dealt across the FIGHT nodes only: a shrine has no arena, and the two stops
  // are not rooms. Round-robin off a seeded shuffle so a region draws from all
  // five shapes rather than rolling the same one twice.
  const fights = nodes.filter(n => n.depth !== null && n.kind !== 'shrine');
  const deck = rng.shuffle([...TEMPLATE_KEYS]);
  fights.forEach((n, i) => { n.template = deck[i % deck.length]; });
  const pdeck = rng.shuffle([...COMBAT_PROFILE_KEYS]);
  let pi = 0;
  for (const n of fights) {
    // Bastion (the sanctioned camping fight) rolls ~1 in 4 HORDE nodes;
    // objective levels never roll it — their own script is the pressure.
    if (n.mix === 'horde' && rng.next() < 0.25) n.profile = 'bastion';
    else { n.profile = pdeck[pi % pdeck.length]; pi++; }
  }

  return {
    regionId: region.id, regionIndex: region.index, seed, reroll,
    nodes,
    startIds: columns[0].map(n => n.id),
    bossId: boss.id,
    objectives,
  };
}

// Serializable layout for clients (the node-map screen). Same field names the
// floor map published, because the map screen, the codec and the client-side
// prediction were never the thing that was wrong.
export function serializeMap(map) {
  return {
    regionIndex: map.regionIndex, regionId: map.regionId,
    bossId: map.bossId, startIds: map.startIds,
    nodes: map.nodes.map(n => ({
      id: n.id, key: n.key, col: n.col, row: n.row, kind: n.kind, depth: n.depth,
      template: n.template, profile: n.profile || null, edges: n.edges,
    })),
  };
}

// ---------------------------------------------------------------- assertions

// Run on every generated tree. A distribution that drifts is a design change
// nobody made, and it would show up as "the region feels samey" long before
// anyone counted the nodes.
export function assertTree(tree) {
  const problems = [];
  const n = tree.nodes;
  const fights = n.filter(x => x.depth !== null);
  if (fights.length !== COLUMNS * ROWS) problems.push(`${fights.length} combat-column nodes, want ${COLUMNS * ROWS}`);

  const counts = {};
  for (const x of fights) counts[x.mix] = (counts[x.mix] || 0) + 1;
  for (const [t, want] of Object.entries(NODE_MIX)) {
    if ((counts[t] || 0) !== want) problems.push(`${counts[t] || 0} ${t} nodes, want ${want}`);
  }
  for (const t of Object.keys(counts)) if (!NODE_MIX[t]) problems.push(`unknown node type "${t}"`);

  // the stops, and the gate
  for (const stop of STOP_BANDS) {
    const found = n.filter(x => x.kind === stop.kind);
    if (found.length !== 1) problems.push(`${found.length} ${stop.kind} nodes, want exactly 1`);
    else if (found[0].depth !== null) problems.push(`the ${stop.kind} carries a combat depth — a stop is not a fight`);
  }
  if (n.filter(x => x.kind === 'siege').length !== 1) problems.push('want exactly one boss gate');

  // objectives: two, distinct, from the pool
  const objs = fights.filter(x => x.mix === 'objective').map(x => x.objective);
  for (const o of objs) if (!OBJECTIVE_POOL.includes(o)) problems.push(`objective "${o}" is not one of the eight`);
  if (new Set(objs).size !== objs.length) problems.push(`objective types repeat within the region: ${objs.join(', ')} — two of the same level in five fights is the variety this structure exists to buy`);
  for (const x of fights) if (x.mix !== 'objective' && x.objective) problems.push(`${x.key}: non-objective node carries an objective`);

  for (const x of fights) {
    if (x.depth === 1 && NO_FIRST_COLUMN.has(x.mix)) problems.push(`${x.key}: ${x.mix} at depth 1 — map 1 is played at one skill slot`);
    if (x.kind !== 'shrine' && !x.template) problems.push(`${x.key}: fight node with no arena template`);
  }
  const eliteDepths = fights.filter(x => x.mix === 'elite').map(x => x.depth);
  if (eliteDepths[0] === eliteDepths[1]) problems.push(`both elites at depth ${eliteDepths[0]}`);

  for (const x of n) {
    if (x.kind !== 'siege' && !x.edges.length) problems.push(`${x.key}: dead end`);
    for (const t of x.edges) {
      const target = n[t];
      if (!target) problems.push(`${x.key}: links to ${t}, which does not exist`);
      else if (target.col !== x.col + 1) problems.push(`${x.key} -> ${target.key}: not a forward link into the next column`);
    }
  }

  // EVERY ROUTE, WALKED. "By construction" is a claim about the code; this is a
  // check on the output, and it is the only thing that proves the stops are
  // unavoidable rather than merely intended to be.
  const routes = [];
  const walk = (id, depths, stops) => {
    const node = n[id];
    if (!node) return;
    if (node.kind === 'siege') { routes.push({ depths, stops }); return; }
    const d2 = node.depth !== null ? depths + 1 : depths;
    const s2 = (node.kind === 'shop' || node.kind === 'treasure') ? [...stops, node.kind] : stops;
    for (const t of node.edges) walk(t, d2, s2);
  };
  for (const e of tree.startIds) walk(e, 0, []);
  if (!routes.length) problems.push('no route reaches the boss gate');
  const lengths = new Set(routes.map(r => r.depths));
  if (lengths.size !== 1 || !lengths.has(COLUMNS)) problems.push(`route fight counts ${[...lengths].join('/')}, want exactly ${COLUMNS}`);
  const missed = routes.filter(r => STOP_BANDS.some(s => r.stops.filter(x => x === s.kind).length !== 1));
  if (missed.length) problems.push(`${missed.length} of ${routes.length} routes do not pass exactly one of each stop (${STOP_BANDS.map(s => s.kind).join(', ')})`);

  return problems;
}

// A route a player could actually take, for tests and for the bot.
export function walkRoute(tree, rng) {
  const route = [];
  let id = tree.startIds[rng ? Math.floor(rng.next() * tree.startIds.length) : 0];
  for (;;) {
    const node = tree.nodes[id];
    route.push(node);
    if (node.kind === 'siege') return route;
    id = node.edges[rng ? Math.floor(rng.next() * node.edges.length) : 0];
  }
}
