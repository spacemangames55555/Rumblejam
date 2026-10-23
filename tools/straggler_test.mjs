// Stragglers. A body walled off from the party used to stand there until the
// fight could not end — measured once as seven enemies behind a wall on Gentle.
//
//   node tools/straggler_test.mjs
//
// After spawning has stopped, four seconds outside 300 units of every living
// player and the body walks straight through the wall. Twenty seconds after
// the last spawn it dies where it stands and pays the normal loot, and the
// kill is not credited to the player. A boss and a ward pylon are not culled.
// The chase itself must not draw from sim.rng.

const { FixtureSim: Sim } = await import('./fixture_sim.mjs');
const { CONFIG } = await import('../js/config.js');

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

function enter() {
  const g = new Sim({ seed: 11, party: [{ idx: 0, key: 'k', name: 'K', charId: 'toh_samurai', color: '#fff' }] });
  const id = g.reachableNodes()[0];
  g.uiAction(0, { kind: 'pickNode', nodeId: id });
  g.tick();
  g.god = true;
  g.wave.done = true;
  g.spawnQueue.length = 0;
  for (const e of [...g.enemyPool]) g.enemyPool.release(e);
  g.projPool.clear();
  g.pickups.length = 0;
  return g;
}

const g = enter();
const p = g.players[0];
const wallX = g.W * 0.5;
// One solid wall, floor to ceiling, so steering has no corner to take.
g.obstacles = [{ x: wallX, y: -400, w: 48, h: g.H + 800 }];
p.x = wallX - 250;
p.y = g.H / 2;

// Far side of the wall, just over 300 from the player, so the away clock runs
// and a straight step is the only way across.
const stray = g.spawnEnemyById('skulker', wallX + 90, g.H / 2, {});
// Damage cannot kill it. The cull goes through _killEnemy, which does not
// consult this flag — so a death here is the cull and not the player's weapon.
stray.nestShielded = true;

// A boss and a pylon, both out of range. The cull must leave them standing.
const boss = g.spawnEnemyById('skulker', wallX + 400, g.H / 2 - 200, {});
boss.boss = true;
boss.bossDef = { name: 'Stub', color: '#fff' };
boss.bs = {};
boss.spd = 0;
boss.straggle = true;
const pylon = g.spawnEnemyById('skulker', wallX + 400, g.H / 2 + 200, {});
pylon.typeIdx = -2;
pylon.spd = 0;

const spawnedAt = g.lastSpawnAt;
const rightOfWall = () => stray.x > wallX + 48;
let draws = 0;
const origNext = g.rng.next.bind(g.rng);
g.rng.next = () => { draws++; return origNext(); };

const dt = CONFIG.DT;
let chaseDraws = null;
let crossed = false;
let sawStraggle = false;
const limit = spawnedAt + CONFIG.STRAGGLER_CULL_S + 1;
let guard = 0;
while (stray.active && g.time < limit && guard++ < 60 * 30) {
  const before = g.time;
  g.setInput(0, { mx: 0, my: 0 });
  g.tick();
  if (!sawStraggle && stray.straggle) {
    sawStraggle = true;
    const waited = g.time - spawnedAt;
    if (waited >= CONFIG.STRAGGLER_CHASE_S - dt && waited <= CONFIG.STRAGGLER_CHASE_S + dt * 2) {
      ok(`chase arms at ${waited.toFixed(3)}s (the rule is ${CONFIG.STRAGGLER_CHASE_S}s)`);
    } else fail(`chase armed at ${waited.toFixed(3)}s, want ${CONFIG.STRAGGLER_CHASE_S}s`);
    chaseDraws = draws;
  }
  if (sawStraggle && !crossed && stray.x < wallX) {
    crossed = true;
    const movedFor = g.time - (spawnedAt + CONFIG.STRAGGLER_CHASE_S);
    if (chaseDraws !== null && draws === chaseDraws) ok('crossing the wall added no sim.rng draws');
    else fail(`the chase drew ${draws - (chaseDraws || 0)} times from sim.rng while crossing`);
    ok(`through the wall ${movedFor.toFixed(2)}s after the chase armed (x ${stray.x.toFixed(0)}, wall at ${wallX.toFixed(0)})`);
    // Park it back in the pocket so the player never walks the kill in, and
    // so the body is still alive when the 20s cull arrives.
    stray.spd = 0;
    stray.x = wallX + 400;
    stray.y = 80;
    g.projPool.clear();
  }
  if (!stray.straggle && g.time - spawnedAt > 3 && !rightOfWall()) {
    fail(`crossed the wall at t=${(g.time - spawnedAt).toFixed(2)}s, before the chase`);
    break;
  }
  void before;
}

if (!sawStraggle) fail('the walled enemy never started chasing');
if (!crossed) fail('the chase never carried it through the wall');
if (stray.active) fail(`still alive at t=${(g.time - spawnedAt).toFixed(2)}s — the 20s cull did not fire`);
else {
  const diedAt = g.time - spawnedAt;
  if (diedAt <= CONFIG.STRAGGLER_CULL_S + dt) ok(`culled at ${diedAt.toFixed(3)}s after the last spawn (the rule is ${CONFIG.STRAGGLER_CULL_S}s)`);
  else fail(`culled late, at ${diedAt.toFixed(3)}s`);
}

if (boss.active) ok('the boss is still standing — bosses are chased, not culled');
else fail('the boss was culled');
if (pylon.active) ok('the ward pylon is still standing — scripted structures are not culled');
else fail('the pylon was culled');

const gold = g.payout.gold;
const xp = g.payout.xp;
if (gold >= 1 && xp >= 1) ok(`cull paid the normal loot into the fight tally (gold ${gold}, xp ${xp})`);
else fail(`cull paid gold ${gold}, xp ${xp} — a skulker is worth 1 material and 1 xp`);
if (p.kills === 0) ok('the cull did not credit the player a kill');
else fail(`player.kills is ${p.kills} — the cull was credited`);
if (g.pickups.length >= 1) ok(`loot is on the ground (${g.pickups.length} pickup${g.pickups.length === 1 ? '' : 's'})`);
else fail('no pickup dropped');

if (g.pickups.length) {
  const mats = p.materials;
  const pxp = p.xp;
  p.x = g.pickups[0].x;
  p.y = g.pickups[0].y;
  for (let i = 0; i < 40; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); }
  if (p.materials > mats && p.xp > pxp) ok(`picking it up pays materials (${mats} -> ${p.materials}) and xp (${pxp.toFixed(1)} -> ${p.xp.toFixed(1)})`);
  else fail(`pickup did not pay (materials ${mats} -> ${p.materials}, xp ${pxp} -> ${p.xp})`);
  if (p.kills === 0) ok('collecting the cull loot still is not a kill');
  else fail(`collecting the loot raised kills to ${p.kills}`);
}

// The chase flag is cleared when the fight ends, including on a body the
// cull was not allowed to touch.
pylon.straggle = true;
g._clearFight();
if (pylon.straggle === false && g.straggleCullAt === null) ok('fight end clears the chase flag and the cull clock');
else fail(`after clear: straggle=${pylon.straggle} cullAt=${g.straggleCullAt}`);

console.log(failures ? `\n${failures} STRAGGLER FAILURE(S)` : '\nSTRAGGLERS CHASE, THEN THE FIGHT ENDS');
process.exit(failures ? 1 : 0);
