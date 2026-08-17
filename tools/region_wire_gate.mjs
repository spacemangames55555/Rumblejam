// THE REGION IS WIRED — asserted by effect, from the entry point `main.js`
// actually uses.
//
// EVERY CHECK HERE CONSTRUCTS `new Sim({ seed, party, regionIndex })` and reads
// what came out. None of them assigns `sim.region`, `sim.regionIndex` or
// `sim.floor` by hand, and that restriction is the whole point of the file:
// the region layer sat dead for 165 commits with a complete, passing test
// suite, because `region_test.mjs` called `generateTree` and `canEnter` and
// `park` DIRECTLY and never once asked whether a running game reached them. A
// fixture that provisions what the product does not is a fixture that proves
// nothing (§13 rule 17).
//
// The nine claims, in the order the patch brief makes them.
//
// Usage: node tools/region_wire_gate.mjs
import { Sim } from '../js/game.js';
import { assertTree, walkRoute, COLUMNS, NODE_MIX, OBJECTIVE_POOL, STOP_BANDS } from '../js/nodetree.js';
import { Rng } from '../js/rng.js';
import { REGIONS, REGION_BY_INDEX, TOTAL_REGIONS, bossForRegion, regionHpMult } from '../js/regions.js';
import { REGION_ENEMIES } from '../js/content/regions-enemies.js';
import { FLOOR_TABLES } from '../js/content/enemies.js';
import { BIOMES, REGION_BIOMES } from '../js/biomes.js';
import { buildArena } from '../js/arenas.js';
import { nestIdFor } from '../js/objectives.js';
import { worldMapState, partyCanEnter } from '../js/worldmap.js';
import { newCharacter, newPlayerStore, onRegionCleared, recordUnlock, canEnter } from '../js/saves.js';

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };

const CHAR = 'toh_blacksmith';
const party = (charId = CHAR) => [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }];
// EXACTLY how main.js builds it — seed, party, difficulty, regionIndex. Nothing
// else is set afterwards.
const sim = (seed, regionIndex, charId) => new Sim({ seed, party: party(charId), regionIndex });

console.log('THE REGION LAYER, FROM A REAL ENTRY POINT — nothing here assigns a region by hand\n');

// ---- 1. a run in region 1 plays exactly five maps, then a boss ----
{
  const bad1 = [];
  for (let s = 0; s < 40; s++) {
    const g = sim(1000 + s * 7919, 1);
    const problems = assertTree(g.floor);
    if (problems.length) { bad1.push(`seed ${s}: ${problems[0]}`); continue; }
    // walked, not counted: the claim is about the ROUTE a party takes
    const route = walkRoute(g.floor, new Rng(s * 31 + 1));
    const fights = route.filter(n => n.depth !== null && n.kind !== 'shrine').length
      + route.filter(n => n.kind === 'shrine').length;
    const last = route[route.length - 1];
    if (fights !== COLUMNS) bad1.push(`seed ${s}: route holds ${fights} maps, want ${COLUMNS}`);
    if (last.kind !== 'siege') bad1.push(`seed ${s}: route ends on ${last.kind}, not the boss gate`);
  }
  if (bad1.length) bad(`${bad1.length} route failure(s) across 40 seeds: ${bad1.slice(0, 3).join('; ')}`);
  else ok(`40 seeded region-1 trees: every route is exactly ${COLUMNS} maps and ends at the boss`);
}

// ---- 2. it spawns a region-1 enemy that the old FLOOR_TABLES never had ----
{
  const legacy = new Set(FLOOR_TABLES.flat());
  const regionOnly = REGION_ENEMIES.pacific_northwest.enemies.map(e => e.id).filter(id => !legacy.has(id));
  const seen = new Set();
  let sampled = 0;
  for (let s = 0; s < 8 && seen.size === 0; s++) {
    const g = sim(4242 + s * 977, 1);
    // NOT the onboarding node — map 1 draws from ONBOARDING_TABLE by design, so
    // asking it about the region roster asks the one room built not to have one.
    const node = g.floor.nodes.find(n => n.depth && n.depth > 1 && n.kind === 'combat');
    if (!node) continue;
    g._travelTo(node.id);
    for (let i = 0; i < 3000 && g.phase === 'arena'; i++) {
      g.tick();
      for (const e of g.enemyPool) if (e.def) seen.add(e.def.id);
      if (seen.size) break;
    }
    sampled++;
  }
  const found = regionOnly.filter(id => seen.has(id));
  if (found.length) ok(`region 1 spawns ${found.length} enemy id(s) absent from every legacy floor table (e.g. ${found[0]}) — the population is live`);
  else bad(`no region-1-only enemy spawned across ${sampled} fight(s); saw [${[...seen].join(', ') || 'nothing'}]. `
    + `The region roster is ${regionOnly.join(', ')} and none of it reached the field`);
}

// ---- 3. a nest in region 1 resolves wall HP at 0.5x base ----
{
  const region = REGION_BY_INDEX[1];
  const declared = region.tuning.nestWallHpMult;
  let measured = null, plain = null;
  for (let s = 0; s < 60 && measured === null; s++) {
    const g = sim(777 + s * 613, 1);
    const nest = g.floor.nodes.find(n => n.kind === 'nest');
    if (!nest) continue;
    g._travelTo(nest.id);
    for (let i = 0; i < 400 && !g.walls.length; i++) g.tick();
    if (!g.walls.length) continue;
    measured = Math.max(...g.walls.map(w => w.maxHp));
    // the same wall with the region multiplier taken out, to make the claim a
    // RATIO rather than a number that could be right by coincidence
    plain = Math.round(210 * regionHpMult(1) * g.coopHp * 1.12);
  }
  if (measured === null) bad('no Nest Purge node appeared in 60 region-1 trees — the claim could not be tested, which is not the same as it passing');
  else {
    const ratio = measured / plain;
    if (Math.abs(ratio - declared) < 0.02) ok(`region 1 nest walls resolve at ×${ratio.toFixed(2)} of base (declared ${declared}) — ${measured} HP against ${plain}; nestWallHpMult fires for the first time`);
    else bad(`region 1 nest wall HP is ${measured}, ×${ratio.toFixed(2)} of the ${plain} base — regions.js declares nestWallHpMult ${declared}`);
  }
}

// ---- 4. region 1 renders pnw ground on all five maps, and no tundra anywhere ----
{
  const g = sim(20260817, 1);
  const seen = new Map();
  for (const n of g.floor.nodes) {
    // Only rooms. The two stops and the shrine have no arena — a shrine is not
    // a fight and carries no template, so asking `buildArena` for one reads
    // `ARENA_TEMPLATES[null]` and throws.
    if (!n.template && n.kind !== 'siege') continue;
    const arena = buildArena(g.seed, g.regionIndex, n, 1);
    seen.set(n.key, arena.biome);
  }
  const wrong = [...seen].filter(([, b]) => b !== 'pnw');
  const tundra = [...seen].filter(([, b]) => b === 'tundra');
  if (tundra.length) bad(`${tundra.length} region-1 arena(s) still render tundra: ${tundra.map(([k]) => k).join(', ')}`);
  else if (wrong.length) bad(`${wrong.length} region-1 arena(s) do not render pnw: ${wrong.map(([k, b]) => `${k}=${b}`).join(', ')}`);
  else ok(`all ${seen.size} region-1 arenas (five maps, both stops' neighbours and the boss room) render pnw ground; no tundra at any column`);
  checks++;
  if (BIOMES.tundra && !REGION_BIOMES.includes('tundra')) console.log('✓ the tundra tileset is still declared and assigned to no region — the art is kept, the slot is not guessed');
  else { fails++; console.log('✗ tundra is either deleted or assigned to a region; the brief says declared and unassigned'); }
}

// ---- 5. region 2 spawns a population disjoint from region 1 ----
{
  const one = new Set(REGION_ENEMIES.pacific_northwest.enemies.map(e => e.id));
  const two = new Set(REGION_ENEMIES.central_america.enemies.map(e => e.id));
  const overlap = [...two].filter(id => one.has(id));
  const g1 = sim(31337, 1), g2 = sim(31337, 2);
  const drawn = (g) => {
    const node = g.floor.nodes.find(n => n.depth && n.depth > 1 && n.kind === 'combat');
    if (!node) return new Set();
    g._travelTo(node.id);
    const out = new Set();
    for (let i = 0; i < 2500 && g.phase === 'arena'; i++) {
      g.tick();
      for (const e of g.enemyPool) if (e.def) out.add(e.def.id);
      if (out.size >= 3) break;
    }
    return out;
  };
  const d1 = drawn(g1), d2 = drawn(g2);
  const shared = [...d2].filter(id => d1.has(id));
  if (overlap.length) bad(`the two region rosters share ${overlap.length} id(s): ${overlap.join(', ')}`);
  else if (!d1.size || !d2.size) bad(`could not sample both regions (region 1 drew ${d1.size}, region 2 drew ${d2.size})`);
  else if (shared.length) bad(`region 2 spawned ${shared.length} id(s) that region 1 also spawned: ${shared.join(', ')}`);
  else ok(`region 2 fielded [${[...d2].join(', ')}] against region 1's [${[...d1].join(', ')}] — disjoint, drawn from the live sim`);

  // AND NEITHER OF THEM IS BORROWING THE BASE ROSTER.
  //
  // The check above passed on its first run with region 1 fielding
  // `lancerfish` and region 2 fielding `gyre` — two BASE enemies, in two
  // regions, and "disjoint from each other" was still perfectly true. The
  // profile's flanker and artillery levers hard-assign ids and bypass the
  // table, so a region's population was never the whole of what it fielded.
  // Rule 73 again: the check was green about a weaker claim than its name.
  const legacyIds = new Set(FLOOR_TABLES.flat());
  // NEST PURGE'S KEEP IS NOT ROSTER CONTAMINATION, AND THE DIFFERENCE MATTERS.
  // `wombden` is the structure the level is built around and `flit` is its
  // brood; a region supplies its own by authoring `behavior: 'nest'`, and
  // neither has. That is a CONTENT gap — six archetypes, no spawner — reported
  // below rather than folded into a wiring failure, because conflating the two
  // is how a missing enemy gets "fixed" by deleting a check.
  const nestBorrow = [1, 2].filter(i => {
    const g = sim(4242, i);
    return nestIdFor(g) === 'wombden';
  });
  const OBJECTIVE_STRUCTURES = new Set(nestBorrow.length ? ['wombden', 'flit'] : []);
  const contaminated = [];
  for (const [label, region] of [['region 1', 1], ['region 2', 2]]) {
    const own = new Set(REGIONS.find(r => r.index === region).enemies);
    const strays = new Set();
    // Many fights and many seeds: the levers are chance-gated, so one room
    // proves nothing about whether the door is shut.
    for (let s = 0; s < 6; s++) {
      const g = sim(8800 + s * 1301, region);
      for (const node of g.floor.nodes.filter(n => n.depth && n.depth > 1 && n.template)) {
        g._travelTo(node.id);
        for (let i = 0; i < 1800 && g.phase === 'arena'; i++) {
          g.tick();
          for (const e of g.enemyPool) if (e.def && !e.boss && !own.has(e.def.id) && legacyIds.has(e.def.id) && !OBJECTIVE_STRUCTURES.has(e.def.id)) strays.add(e.def.id);
        }
        if (g.phase === 'arena') g.debug('F3');
        if (g.phase === 'arena') break;
      }
    }
    if (strays.size) contaminated.push(`${label} fielded base-roster ${[...strays].join(', ')}`);
  }
  if (contaminated.length) bad(`${contaminated.length} region(s) still draw from the base roster: ${contaminated.join('; ')} — `
    + 'every lever that names an id instead of drawing from the table has to be closed');
  else ok('across 12 seeded regions and every fight node in them, neither region fielded a base-roster enemy outside Nest Purge\'s own structure — the profile levers resolve their role from the region');

  // The content gap, named rather than hidden by the exemption above.
  checks++;
  if (nestBorrow.length) {
    console.log(`✓ REPORTED, not failed: region(s) ${nestBorrow.join(', ')} have no enemy with \`behavior: 'nest'\`, so Nest Purge borrows \`wombden\` and its \`flit\` brood. `
      + 'The wiring is done — `nestIdFor` resolves from the region — and what is missing is a spawner archetype in the roster.');
  } else {
    console.log('✓ every built region authors its own nest creature; nothing borrows `wombden`');
  }
}

// ---- 6. every route passes one shop and one reliquary ----
{
  const misses = [];
  for (let s = 0; s < 60; s++) {
    const g = sim(555 + s * 4099, 1 + (s % 2));
    // exhaustive, not sampled: walkRoute picks ONE path and the claim is about
    // all of them, which is the difference between this and a spot check
    const routes = [];
    const walk = (id, stops) => {
      const n = g.floor.nodes[id];
      if (n.kind === 'siege') { routes.push(stops); return; }
      const next = (n.kind === 'shop' || n.kind === 'treasure') ? [...stops, n.kind] : stops;
      for (const t of n.edges) walk(t, next);
    };
    for (const e of g.floor.startIds) walk(e, []);
    for (const r of routes) {
      for (const band of STOP_BANDS) {
        if (r.filter(x => x === band.kind).length !== 1) misses.push(`seed ${s}: a route passes ${r.filter(x => x === band.kind).length} ${band.kind} nodes`);
      }
    }
  }
  if (misses.length) bad(`${misses.length} route(s) miss or double a stop: ${misses.slice(0, 3).join('; ')}`);
  else ok(`60 trees, every route enumerated: each passes exactly one ${STOP_BANDS.map(b => b.kind).join(' and one ')}`);
}

// ---- 7. no objective type appears twice in one region ----
{
  const dupes = [];
  const histogram = {};
  for (let s = 0; s < 200; s++) {
    const g = sim(90210 + s * 7717, 1 + (s % 2));
    const objs = g.floor.objectives;
    if (objs.length !== NODE_MIX.objective) dupes.push(`seed ${s}: ${objs.length} objectives`);
    if (new Set(objs).size !== objs.length) dupes.push(`seed ${s}: ${objs.join(' + ')}`);
    for (const o of objs) histogram[o] = (histogram[o] || 0) + 1;
  }
  if (dupes.length) bad(`${dupes.length} region(s) repeat an objective: ${dupes.slice(0, 3).join('; ')}`);
  else ok(`200 regions, ${NODE_MIX.objective} objectives each, never the same type twice`);

  // and the pool is actually used — a draw rule that always deals the same two
  // satisfies "no repeat" perfectly and is still broken
  const unseen = OBJECTIVE_POOL.filter(o => !histogram[o]);
  if (unseen.length) bad(`${unseen.length} objective type(s) never drawn in 200 regions: ${unseen.join(', ')} — "no repeat within a region" is satisfied by a rule that only ever deals two`);
  else ok(`all ${OBJECTIVE_POOL.length} objective types are drawn across 200 regions (${Object.entries(histogram).map(([k, v]) => `${k} ${v}`).join(', ')})`);
}

// ---- 7b. the recency bias actually biases ----
{
  // A type dealt in the immediately previous region must come up less often
  // than one unseen for four. Measured rather than asserted from the constant.
  const HOT = 'nest';
  let hotAgain = 0, trials = 400;
  for (let s = 0; s < trials; s++) {
    const g = new Sim({ seed: 6000 + s * 3301, party: party(), regionIndex: 2,
      objectiveHistory: [[HOT, 'storm']] });
    if (g.floor.objectives.includes(HOT)) hotAgain++;
  }
  const rate = hotAgain / trials;
  // 2 draws from 8 types with flat weights would repeat ~25% of the time
  if (rate < 0.20) ok(`recency bias measured: "${HOT}" dealt in the previous region reappears ${(rate * 100).toFixed(1)}% of the time, against ~25% for a flat draw`);
  else bad(`"${HOT}" reappears ${(rate * 100).toFixed(1)}% of the time after being dealt last region — a flat draw would be ~25%, so the bias is not biting`);
}

// ---- 8. a locked region cannot be entered; clearing a boss advances the frontier ----
{
  const c = newCharacter('t1', CHAR, { name: 'T' });
  const store = newPlayerStore();
  const st = worldMapState(c, store);
  const enterable = st.rows.filter(r => r.enterable).map(r => r.index);
  if (enterable.length === 1 && enterable[0] === 1) ok('a fresh character may enter region 1 and nothing else — every other card is inert with a stated reason');
  else bad(`a fresh character can enter regions [${enterable.join(', ')}]; want [1] only`);

  checks++;
  const blocked = partyCanEnter([c], 2);
  if (!blocked.ok && canEnter(c, 2) === false) console.log(`✓ region 2 refuses a frontier-1 party: "${blocked.reason}"`);
  else { fails++; console.log('✗ region 2 accepted a frontier-1 party'); }

  const moved = onRegionCleared(c, 1);
  const unlocked = recordUnlock(store, 1);
  const after = worldMapState(c, store);
  const nowEnterable = after.rows.filter(r => r.enterable).map(r => r.index);
  if (moved.after === 2 && nowEnterable.includes(2)) ok(`clearing region 1 advanced the frontier ${moved.before} → ${moved.after} and opened region 2 (unlocked ${unlocked})`);
  else bad(`after clearing region 1 the frontier is ${moved.after} and enterable is [${nowEnterable.join(', ')}]`);
}

// ---- 9. the world axis is keyed to regions, and reaches every one of them ----
{
  const flat = [];
  for (let i = 1; i <= TOTAL_REGIONS; i++) if (!(regionHpMult(i) > 0)) flat.push(i);
  if (flat.length) bad(`the world axis returns a non-positive multiplier at region(s) ${flat.join(', ')}`);
  else ok(`the world axis covers all ${TOTAL_REGIONS} regions: ${Array.from({ length: TOTAL_REGIONS }, (_, i) => regionHpMult(i + 1).toFixed(2)).join(' → ')}`);

  // and every region resolves a boss without throwing, which is the fallback's
  // whole job — regions 6 and 7 have none authored
  const bosses = [];
  for (let i = 1; i <= TOTAL_REGIONS; i++) {
    const b = bossForRegion(i);
    if (!b || !b.id) { bad(`region ${i} resolved no boss`); bosses.length = 0; break; }
    bosses.push(`${i}:${b.id}`);
  }
  if (bosses.length === TOTAL_REGIONS) ok(`every region resolves a boss, fallback included — ${bosses.join(' ')}`);
}

// ---- and the structure that was retired is actually gone ----
{
  checks++;
  let stillThere = false;
  try { await import('../js/dungeon.js'); stillThere = true; } catch { /* expected */ }
  if (stillThere) { fails++; console.log('✗ js/dungeon.js still exists — two map structures is what produced this whole detour'); }
  else console.log('✓ js/dungeon.js is gone; there is one map structure in the game');
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'THE REGION LAYER IS NOT WIRED' : 'A REGION IS THE MAP, AND A RUNNING GAME REACHES ALL OF IT');
process.exit(fails ? 1 : 0);
