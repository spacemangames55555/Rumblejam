// DOES THE SIM REPRODUCE FROM ITS SEED? A GATE, not a probe.
//
//   node tools/determinism_test.mjs
//
// KNOWN-DEFECTS #1 named rushMove()'s Math.random() as the reason two runs of
// one seed part company. It was 43 calls across game.js, entities/enemies.js,
// telegraphs.js and traits-toh.js — and the cost was not theoretical: EVERY A/B
// comparison in this patch needed three runs to say anything, because a single
// run proved nothing. "It happened on seed ABCDEFG" was not a reproduction.
//
// Every one now draws from `sim.rng`, a seeded stream on the Sim. This file is
// the deliverable: not "the code changed" but "same seed, same bytes".
//
// Compared: the WHOLE SNAPSHOT every 60 ticks, not just the enemy field, so a
// divergence anywhere in players, projectiles, fx, objectives or trait state
// counts. Both rosters, region and non-region play, two players with scripted
// but DIFFERENT inputs so movement and dodge paths actually run.

import { setRoster } from '../js/content/characters.js';
const { Sim } = await import('../js/game.js');

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

function run(seed, charId, roster, region, ticks) {
  setRoster(roster);
  const g = new Sim({ seed, party: [
    { idx: 0, key: 'a', name: 'A', charId, color: '#fff' },
    { idx: 1, key: 'b', name: 'B', charId, color: '#fff' }] });
  if (region) { g.region = region; g.regionIndex = 1; g.nodeType = 'horde'; g.difficulty = 'standard'; }
  g.uiAction(0, { kind: 'pickNode', nodeId: g.reachableNodes()[0] });
  const hashes = [];
  for (let i = 0; i < ticks; i++) {
    // Scripted but NOT identical between the two players: two statues standing
    // still would never exercise the movement, dodge or stance paths, and a
    // determinism gate that only covers idle enemies is not one.
    g.setInput(0, { mx: Math.sin(i / 37), my: Math.cos(i / 53) });
    g.setInput(1, { mx: Math.cos(i / 29), my: Math.sin(i / 41) });
    g.tick();
    if (i % 60 === 0) hashes.push(JSON.stringify(g.getSnapshot()));
  }
  return hashes.join('|');
}

const CASES = [
  { seed: 4242, charId: 'toh_samurai', roster: 'toh', region: null, ticks: 1800 },
  { seed: 90210, charId: 'toh_necromancer', roster: 'toh', region: null, ticks: 1800 },
  { seed: 13337, charId: 'toh_samurai', roster: 'toh', region: 'pacific_northwest', ticks: 1800 },
  { seed: 55555, charId: 'toh_necromancer', roster: 'toh', region: 'central_america', ticks: 1800 },
  { seed: 7, charId: 'bulwark', roster: 'classic', region: null, ticks: 1800 },
  { seed: 31337, charId: 'onrush', roster: 'classic', region: null, ticks: 2400 },
];

for (const c of CASES) {
  const a = run(c.seed, c.charId, c.roster, c.region, c.ticks);
  const b = run(c.seed, c.charId, c.roster, c.region, c.ticks);
  const label = `seed ${c.seed} ${c.charId}${c.region ? ' in ' + c.region : ''}, ${c.ticks} ticks`;
  if (a === b) ok(`${label} — byte-identical (${(a.length / 1024).toFixed(0)} KB of snapshot compared)`);
  else {
    let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
    fail(`${label} — diverged at byte ${i}: ...${a.slice(Math.max(0, i - 60), i + 60)}  vs  ...${b.slice(Math.max(0, i - 60), i + 60)}`);
  }
}

// NEGATIVE CONTROL. Without this the whole file passes if the sim ignores its
// seed entirely, which is the failure mode a determinism gate is most likely to
// have and least likely to notice.
{
  const a = run(4242, 'toh_samurai', 'toh', null, 900);
  const b = run(4243, 'toh_samurai', 'toh', null, 900);
  if (a !== b) ok('negative control: a DIFFERENT seed produces a different run, so the comparisons above are not vacuously true');
  else fail('two different seeds produced identical runs — the sim is ignoring its seed and every check above is meaningless');
}

// THE LINT. Routing 43 calls is worth nothing if the 44th goes back in. The sim
// modules are enumerated here rather than globbed because render/ui/audio/input
// legitimately use Math.random() — they are not the simulation.
{
  const { readFileSync } = await import('node:fs');
  const SIM_FILES = [
    'js/game.js', 'js/entities/enemies.js', 'js/entities/beast.js', 'js/telegraphs.js',
    'js/traits-toh.js', 'js/skillsim.js', 'js/compose.js', 'js/triggers.js',
    'js/objectives.js', 'js/arenas.js', 'js/nodemap.js', 'js/nodetree.js', 'js/biomes.js',
  ];
  const offenders = [];
  for (const f of SIM_FILES) {
    let src;
    try { src = readFileSync(f, 'utf8'); } catch { continue; }
    // strip comments first — the gate has twice matched its own explanatory
    // prose, which is a false positive that teaches people to ignore it
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
    const n = (code.match(/Math\.random\(\)/g) || []).length;
    if (n) offenders.push(`${f} (${n})`);
  }
  if (!offenders.length) ok(`no Math.random() in any of the ${SIM_FILES.length} simulation modules — the seed is the only source of variation`);
  else fail(`Math.random() is back in the simulation: ${offenders.join(', ')}. Every call must draw from sim.rng or same-seed reproduction breaks again.`);
}

// ---- THE POOL RESET, which is the other half of "same seed, same run" ----
//
// A recycled slot that carries state from its previous occupant is a second
// source of variation: what a fight does depends on what the LAST fight left in
// the pool. Two shipped bugs had this shape — a nest's invulnerability leaking
// onto chaff, and telegraph state leaking onto a type with no telegraph — and
// both were "fixed" by adding fields to an enumerated reset list. The list IS
// the defect: correct until the next field, and silent when wrong.
{
  const { Pool } = await import('../js/util.js');
  const pool = new Pool(4, () => ({}));
  const a = pool.alloc();
  a.nestShielded = true; a.telState = 1; a.bounty = true;
  a.aFieldNoResetListHasEverHeardOf = 'stale';
  pool.release(a);
  const b = pool.alloc();
  const leaked = ['nestShielded', 'telState', 'bounty', 'aFieldNoResetListHasEverHeardOf']
    .filter(k => b[k] !== undefined);
  if (!leaked.length) ok('a recycled pool slot carries NOTHING from its previous occupant — including a field no reset list has ever heard of, which is the whole point of wiping rather than enumerating');
  else fail(`a recycled slot leaked ${leaked.join(', ')} — the reset is enumerated again`);
  if (b._pi === a._pi) ok('..._pi survives the wipe, because the pool needs it to free the slot');
  else fail('_pi was wiped — the pool can no longer free this slot');
}

console.log(failures ? `\n${failures} DETERMINISM FAILURE(S)` : '\nTHE SIM REPRODUCES FROM ITS SEED');
process.exit(failures ? 1 : 0);
