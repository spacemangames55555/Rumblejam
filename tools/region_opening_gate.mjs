// FLOOR 1'S OPENING — three plain skirmishes, the first at double rate.
//
// Every check instruments the RESULT. "Is the node kind combat" is a claim
// about a config field; "does the map clear when the last enemy dies, and NOT
// while one lives" is a claim about the level, and only the second is what was
// asked for.
//
// THE CHECK THAT MATTERS MOST IS THE ONE ABOUT LAYOUT. Unifying the win
// condition of three maps is one careless edit away from unifying the three
// maps, and that edit would look like a success everywhere else in this file.
//
// WHY FLOOR 1 AND NOT REGION 1. A real run is `new Sim({seed, party,
// difficulty})` (js/main.js) — no region is ever passed, `sim.regionIndex` is
// undefined, and js/nodetree.js's region tree is called by nothing in js/. The
// opening a player actually meets is floor 1 of generateFloorMap, so that is
// where the change lives. See the patch report.
//
// Usage: node tools/region_opening_gate.mjs
import { FixtureSim as Sim } from './fixture_sim.mjs';
import { generateFloorMap, rollComposition, OPENING_FLOOR, OPENING_SKIRMISH_COLUMNS, OPENING_SPECIALS } from '../js/dungeon.js';
import { waveConfig } from '../js/arenas.js';
import { CONFIG } from '../js/config.js';

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`\u2713 ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`\u2717 ${m}`); };


console.log('FLOOR 1 OPENING — asserted by effect\n');

const SIM = (seed) => new Sim({ seed, allowUnplayable: true,
  party: [{ idx: 0, key: 'k', name: 'P', charId: 'toh_samurai', color: '#fff' }] });

// ---------------------------------------------------------------- 1. type
{
  const SEEDS = 500;
  const bads = [];
  for (let s = 0; s < SEEDS; s++) {
    const m = generateFloorMap(3000 + s, OPENING_FLOOR);
    for (const n of m.nodes) {
      if (n.col < OPENING_SKIRMISH_COLUMNS && n.kind !== 'combat') bads.push(`seed ${s} col ${n.col}=${n.kind}`);
    }
  }
  if (!bads.length) ok(`${SEEDS} floor-1 maps: every node in columns 0-${OPENING_SKIRMISH_COLUMNS - 1} is a plain skirmish, and no shop or reliquary sits in them`);
  else bad(`${bads.length} non-skirmish node(s) in the opening across ${SEEDS} maps: ${bads.slice(0, 4).join(', ')}`);

  // later floors keep their opening rule at ONE column, unchanged
  checks++;
  const later = [];
  for (let s = 0; s < 200; s++) {
    for (const f of [2, 3, 4]) {
      const m = generateFloorMap(4000 + s, f);
      const c1 = m.nodes.filter(n => n.col === 1 && n.kind !== 'combat');
      if (c1.length) later.push(f);
    }
  }
  if (later.length) console.log(`✓ floors 2-4 still put specials in column 1 (${later.length} instances seen) — the widened opening is floor 1 only`);
  else { fails++; console.log('✗ floors 2-4 have no specials in column 1 across 600 maps — the opening rule leaked past floor 1'); }
}

// ---------------------------------------------------------------- 2. clears on the last kill
{
  const results = [];
  for (let col = 0; col < OPENING_SKIRMISH_COLUMNS; col++) {
    const sim = SIM(5000 + col);
    const node = sim.floor.nodes.find(n => n.col === col);
    sim.god = true;
    sim._travelTo(node.id);
    if (sim.obj) { results.push(`col ${col}: carries objective "${sim.obj.type}"`); continue; }
    let pinned = null;
    for (let i = 0; i < 60 * 200; i++) {
      sim.tick();
      const live = [...sim.enemyPool].filter(e => e.active);
      if (!pinned && live.length) pinned = live[0];
      if (pinned && pinned.active) { pinned.hp = pinned.maxHp = 1e9; }
      for (const e of live) if (e !== pinned) e.hp = 0;
      if (sim.wave.done && sim.spawnQueue.length === 0 && live.length <= 1) break;
    }
    const heldWithOneAlive = !sim.cleared;
    if (pinned) { pinned.maxHp = 1; pinned.hp = 1; sim.damageEnemy(pinned, 10); }
    for (let i = 0; i < 300 && !sim.cleared; i++) sim.tick();
    results.push({ col, heldWithOneAlive, clearedAfter: sim.cleared });
  }
  const wrong = results.filter(r => typeof r === 'string' || !r.heldWithOneAlive || !r.clearedAfter);
  if (!wrong.length) ok(`maps 1-3 each HELD while one enemy lived and cleared the moment it died (columns ${results.map(r => r.col).join(', ')})`);
  else bad(`opening completion is wrong: ${wrong.map(w => typeof w === 'string' ? w : `col ${w.col} held=${w.heldWithOneAlive} clearedAfter=${w.clearedAfter}`).join('; ')}`);

  // and the HUD follows the type: a skirmish must carry no objective blob at all
  checks++;
  const sim = SIM(6001);
  sim._travelTo(sim.floor.nodes.find(n => n.col === 0).id);
  const blob = sim.serializeObjective ? sim.serializeObjective() : sim.obj;
  if (!sim.obj && !blob) console.log('✓ a skirmish carries no objective blob, so the HUD banner hides and the remaining-enemy counter is what shows');
  else { fails++; console.log(`✗ a skirmish still serializes an objective (${JSON.stringify(blob).slice(0, 80)}) — the HUD would show a stale objective string`); }
}

// ---------------------------------------------------------------- 3. map 1 rate
{
  const saved = CONFIG.OPENING_RATE_MULT;
  CONFIG.OPENING_RATE_MULT = 1;
  const base = waveConfig(OPENING_FLOOR, CONFIG.OPENING_RATE_COLUMN, 'combat');
  CONFIG.OPENING_RATE_MULT = saved;
  const fast = waveConfig(OPENING_FLOOR, CONFIG.OPENING_RATE_COLUMN, 'combat');
  const total = w => ((w.r0 + w.r1) / 2) * w.dur;
  const rateOk = Math.abs(fast.r0 / base.r0 - 2) < 1e-9 && Math.abs(fast.r1 / base.r1 - 2) < 1e-9;
  const countOk = Math.abs(total(fast) - total(base)) < 1e-9;
  if (rateOk && countOk) {
    ok(`map 1 doubles the RATE (r0 ${base.r0.toFixed(3)}→${fast.r0.toFixed(3)}, r1 ${base.r1.toFixed(3)}→${fast.r1.toFixed(3)}) `
      + `and holds the COUNT exactly (${total(base).toFixed(3)} spawns, dur ${base.dur}s→${fast.dur}s) — the same fight, arriving twice as fast`);
  } else {
    bad(`map 1: rate doubled=${rateOk}, count preserved=${countOk} (${total(base).toFixed(3)} vs ${total(fast).toFixed(3)}) — `
      + 'doubling the rate WITHOUT halving the duration is twice the fight, not a faster one');
  }
  checks++;
  const others = [[1, 1], [1, 2], [2, 0]].every(([f, c]) => {
    CONFIG.OPENING_RATE_MULT = 1; const a = waveConfig(f, c, 'combat');
    CONFIG.OPENING_RATE_MULT = saved; const b = waveConfig(f, c, 'combat');
    return a.r0 === b.r0 && a.r1 === b.r1 && a.dur === b.dur;
  });
  if (others) console.log('✓ maps 2 and 3, and every other floor, are untouched — the multiplier is floor 1 column 0 only');
  else { fails++; console.log('✗ the spawn multiplier leaked past map 1'); }

  // BY EFFECT: count real spawns in a fixed window, same seed, multiplier on vs off.
  checks++;
  const spawnsIn = (mult) => {
    CONFIG.OPENING_RATE_MULT = mult;
    const sim = SIM(777);
    sim.god = true;
    sim._travelTo(sim.floor.nodes.find(n => n.col === 0).id);
    const known = new Set(); let seen = 0;
    for (let i = 0; i < 60 * 10; i++) {
      sim.tick();
      for (const e of [...sim.enemyPool]) if (e.active) { if (!known.has(e.id)) { known.add(e.id); seen++; } e.hp = 0; }
    }
    CONFIG.OPENING_RATE_MULT = saved;
    return seen;
  };
  const fastN = spawnsIn(2), slowN = spawnsIn(1);
  const ratio = slowN ? fastN / slowN : 0;
  if (ratio >= 1.7) console.log(`✓ in a real 10 s window map 1 spawns ${fastN} against ${slowN} at baseline (${ratio.toFixed(2)}x) — the doubled rate reaches the spawn loop`);
  else { fails++; console.log(`✗ a 10 s window spawned ${fastN} against ${slowN} (${ratio.toFixed(2)}x) — the doubled rate is not reaching the spawn loop`); }
}

// ---------------------------------------------------------------- 4. layouts still differ
{
  const sigOf = (col) => {
    const sim = SIM(31337);
    const node = sim.floor.nodes.find(n => n.col === col);
    sim._travelTo(node.id);
    const obs = (sim.obstacles || []).map(o => `${Math.round(o.x)},${Math.round(o.y)},${Math.round(o.w)},${Math.round(o.h)}`).sort();
    return { n: obs.length, sig: `${sim.W}x${sim.H}|${obs.join('|')}`, w: sim.W, h: sim.H, tpl: node.template };
  };
  const s = [0, 1, 2].map(sigOf);
  const distinct = new Set(s.map(x => x.sig)).size;
  const tpls = new Set(s.map(x => x.tpl)).size;
  if (distinct === 3) {
    ok(`maps 1-3 still generate DISTINCT layouts — ${s.map((x, i) => `map ${i + 1}: ${x.tpl} ${x.w}x${x.h} ${x.n} obstacles`).join(' · ')} (${tpls} distinct templates)`);
  } else {
    bad(`maps 1-3 produced ${distinct} distinct layout(s) from 3 maps — unifying the objective has unified the maps, `
      + 'which is the one thing this change was told not to do');
  }
}

// ---------------------------------------------------------------- 5. report
{
  const SEEDS = 2000;
  let withNest = 0;
  const kinds = {};
  for (let s = 0; s < SEEDS; s++) {
    const m = generateFloorMap(20000 + s, OPENING_FLOOR);
    const set = new Set();
    for (const n of m.nodes) if (!['combat', 'shop', 'treasure', 'siege'].includes(n.kind)) { kinds[n.kind] = (kinds[n.kind] || 0) + 1; set.add(n.kind); }
    if (set.has('nest')) withNest++;
  }
  console.log(`\nREPORT — floor 1 after the change, over ${SEEDS} generated maps:`);
  console.log(`  opening: columns 0-${OPENING_SKIRMISH_COLUMNS - 1}, ${OPENING_SPECIALS.length} specials in the remaining columns`);
  console.log(`  ${(100 * withNest / SEEDS).toFixed(1)}% of floor-1 maps contain a Nest Purge — it is unconditional, only moved right`);
  console.log(`  special kinds: ${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'THE OPENING DOES NOT BEHAVE AS SPECIFIED' : 'FLOOR 1 OPENS ON THREE DISTINCT SKIRMISHES, THE FIRST AT DOUBLE RATE');
process.exit(fails ? 1 : 0);
