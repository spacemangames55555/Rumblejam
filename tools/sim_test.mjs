// Dev tool: headless simulation exercise. Runs the real Sim in Node:
//  1. content count assertions
//  2. every character spawns and fights (smoke, DoD #4)
//  3. a scripted full solo run floor 1 → 4 boss → win
//  4. a 4-player co-op run with downs/revives and shop traffic
//  5. stress: ~250 enemies + heavy projectiles, tick-time measurement (DoD #7)
// Usage: node tools/sim_test.mjs

import { Sim } from '../js/game.js';
import { CHARACTERS } from '../js/content/characters.js';
import { ITEMS } from '../js/content/items.js';
import { WEAPONS } from '../js/content/weapons.js';
import { ENEMIES } from '../js/content/enemies.js';
import { BOSSES } from '../js/content/bosses.js';

let failures = 0;
const fail = (msg, err) => { failures++; console.error(`✗ ${msg}`, err ? (err.stack || err) : ''); };
const ok = msg => console.log(`✓ ${msg}`);

// ---- 1. content counts ----
if (CHARACTERS.length >= 30) ok(`characters: ${CHARACTERS.length}`); else fail(`characters ${CHARACTERS.length} < 30`);
if (ITEMS.length >= 100) ok(`items: ${ITEMS.length}`); else fail(`items ${ITEMS.length} < 100`);
if (WEAPONS.length >= 25) ok(`weapons: ${WEAPONS.length}`); else fail(`weapons ${WEAPONS.length} < 25`);
if (ENEMIES.length === 12) ok('enemy types: 12'); else fail(`enemy types ${ENEMIES.length} != 12`);
if (BOSSES.length === 4) ok('bosses: 4'); else fail(`bosses ${BOSSES.length} != 4`);

// weapon class coverage
const byCls = {};
for (const w of WEAPONS) byCls[w.cls] = (byCls[w.cls] || 0) + 1;
for (const cls of ['swing', 'thrust', 'single', 'spread', 'lobbed', 'summon']) {
  if (!byCls[cls] || byCls[cls] < 4) fail(`weapon class ${cls} has ${byCls[cls] || 0} (<4)`);
}
ok(`weapon classes: ${JSON.stringify(byCls)}`);

// ---- 1b. dungeon structure across many seeds ----
{
  const { generateFloor } = await import('../js/dungeon.js');
  const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
  let bad = 0;
  for (let seed = 1; seed <= 25; seed++) {
    for (let f = 1; f <= 4; f++) {
      const fl = generateFloor(seed, f);
      const kinds = {};
      for (const r of fl.rooms) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
      for (const k of ['start', 'shop', 'treasure', 'elite', 'boss']) {
        if (kinds[k] !== 1) { bad++; fail(`seed ${seed} floor ${f}: ${k} count = ${kinds[k] || 0}`); }
      }
      if ((kinds.combat || 0) < 3) { bad++; fail(`seed ${seed} floor ${f}: only ${kinds.combat} combat rooms`); }
      for (const r of fl.rooms) {
        for (const [dir, id] of Object.entries(r.doors)) {
          const n = fl.rooms[id];
          if (!n) { bad++; fail(`seed ${seed} floor ${f}: room ${r.id} door ${dir} -> missing room ${id}`); }
          else if (n.doors[OPP[dir]] !== r.id) { bad++; fail(`seed ${seed} floor ${f}: door ${r.id}->${id} not bidirectional`); }
        }
      }
    }
  }
  if (!bad) ok('dungeon structure: 100 floors — kinds exact, all doors bidirectional');
}

// ---- 2. character smoke ----
let smokeFail = 0;
for (const c of CHARACTERS) {
  try {
    const sim = new Sim({ seed: 123456789, party: [{ idx: 0, key: 'k', name: 'SMOKE', charId: c.id, color: '#fff' }] });
    sim.setInput(0, { mx: 1, my: 0.5 });
    sim.debug('F1');
    for (let i = 0; i < 240; i++) sim.tick();
    sim.getSnapshot();
    sim.getMeta(sim.players[0]);
    sim.debug('F3');
    for (let i = 0; i < 60; i++) sim.tick();
    sim.events.length = 0;
  } catch (err) { smokeFail++; fail(`character ${c.id}`, err); }
}
if (!smokeFail) ok(`all ${CHARACTERS.length} characters smoke-tested`);

// ---- helpers for scripted runs ----
function run(sim, n) { for (let i = 0; i < n; i++) sim.tick(); }
function events(sim) { return sim.events.splice(0); }
function forceKillBoss(sim) {
  let guard = 0;
  while (sim.boss && guard++ < 500) sim.damageEnemy(sim.boss, 500, { owner: sim.players[0] });
}

// walk the whole floor: visit every room, clear combats, exercise offers/shops
function playFloor(sim, buyStuff) {
  const floorN = sim.floorNum;
  const roomIds = sim.floor.rooms.filter(r => r.kind !== 'boss').map(r => r.id);
  for (const id of roomIds) {
    sim._enterRoom(id, null);
    run(sim, 30);
    let guard = 0;
    while (sim.roomLocked && guard++ < 40) {
      sim.debug('F3');
      run(sim, 30);
    }
    if (sim.roomLocked) fail(`room ${id} kind=${sim.floor.rooms[id].kind} never cleared on floor ${floorN}`);
    run(sim, 60);
    // resolve any pending offers / treasure for everyone
    for (const p of sim.players) {
      let g2 = 0;
      while (p.pendingOffer && g2++ < 30) sim.uiAction(p.idx, { kind: 'levelup', id: p.pendingOffer[0].id });
      if (p.treasureOffer) sim.uiAction(p.idx, { kind: 'treasure', id: p.treasureOffer.picks[0] });
      if (buyStuff && p.shop) {
        sim.uiAction(p.idx, { kind: 'reroll' });
        sim.uiAction(p.idx, { kind: 'lock', slot: 0 });
        for (let s = 0; s < 4; s++) sim.uiAction(p.idx, { kind: 'buy', slot: s });
        sim.uiAction(p.idx, { kind: 'closeShop' });
      }
    }
    events(sim);
    if (sim.over) return;
  }
  // boss room
  sim._enterRoom(sim.floor.bossId, null);
  run(sim, 5);
  const bossSpawned = !!sim.boss;
  run(sim, 115);
  if (!bossSpawned) fail(`boss did not spawn on floor ${floorN}`);
  forceKillBoss(sim);
  run(sim, 30);
  for (const p of sim.players) {
    let g2 = 0;
    while (p.pendingOffer && g2++ < 30) sim.uiAction(p.idx, { kind: 'levelup', id: p.pendingOffer[0].id });
  }
  if (sim.floorNum >= 4) {
    run(sim, 200); // pendingEnd → win
  } else {
    if (!sim.hatch) fail(`no hatch after floor ${floorN} boss`);
    // stand on hatch
    sim.players[0].x = sim.hatch.x; sim.players[0].y = sim.hatch.y;
    let g3 = 0;
    while (sim.floorNum === floorN && g3++ < 400) { sim.players[0].x = sim.W / 2; sim.players[0].y = sim.H / 2; sim.tick(); }
    if (sim.floorNum === floorN) fail(`hatch transition failed on floor ${floorN}`);
  }
  events(sim);
}

// ---- 3. full solo run ----
try {
  const sim = new Sim({ seed: 424242, party: [{ idx: 0, key: 'k', name: 'SOLO', charId: 'lamprey', color: '#fff' }] });
  sim.debug('F2'); // funds for shopping
  for (let f = 1; f <= 4 && !sim.over; f++) playFloor(sim, true);
  if (sim.over && sim.result && sim.result.win) ok(`solo run completed with WIN — seed shown: ${sim.result.seed}`);
  else fail(`solo run did not end in a win (over=${sim.over}, result=${JSON.stringify(sim.result && { win: sim.result.win, floor: sim.result.floor })})`);
} catch (err) { fail('solo full run crashed', err); }

// ---- 4. co-op run: 4 players, downs, revives ----
try {
  const party = ['bulwark', 'wisp', 'cogsmith', 'voltaic'].map((c, i) => ({ idx: i, key: 'k' + i, name: 'P' + i, charId: c, color: '#fff' }));
  const sim = new Sim({ seed: 777, party });
  sim.debug('F2');
  // basic combat with all four
  playFloor(sim, true);
  if (sim.over) fail('coop wiped unexpectedly on floor 1');
  // down player 1 then revive via proximity
  const p1 = sim.players[1];
  let gDown = 0;
  while (!p1.downed && gDown++ < 60) { p1.hp = Math.min(p1.hp, 1); p1.invuln = 0; sim.hurtPlayer(p1, 999, null); }
  if (!p1.downed) fail('repeated hurtPlayer(999) did not down the target');
  sim.players[0].x = p1.x; sim.players[0].y = p1.y;
  run(sim, 60 * 4);
  if (p1.downed) fail('revive by proximity failed after 4s');
  else ok('down + proximity revive works');
  // wipe: down everyone (repeat hits — dodge/block/second-wind can eat some)
  for (const p of sim.players) {
    let g = 0;
    while (!p.downed && !sim.over && g++ < 60) { p.invuln = 0; p.hp = Math.min(p.hp, 1); sim.hurtPlayer(p, 9999, null); }
  }
  if (sim.over && sim.result && !sim.result.win) ok('full wipe ends run with loss results');
  else fail('wipe did not end the run');
} catch (err) { fail('coop run crashed', err); }

// ---- 5. stress ----
try {
  const sim = new Sim({ seed: 99, party: [{ idx: 0, key: 'k', name: 'STRESS', charId: 'threader', color: '#fff' }] });
  // arm with lots of ranged weapons
  for (const id of ['coilgun', 'hailburst', 'gravelmouth', 'sparkbolt', 'threadneedle']) sim._addWeapon(sim.players[0], id, 4);
  for (let i = 0; i < 5; i++) sim.debug('F1');
  run(sim, 30);
  const n0 = sim.enemyPool.count;
  const t0 = performance.now();
  const TICKS = 600;
  for (let i = 0; i < TICKS; i++) { sim.tick(); if (sim.enemyPool.count < 200) sim.debug('F1'); }
  const ms = (performance.now() - t0) / TICKS;
  ok(`stress: ~${n0}→${sim.enemyPool.count} enemies, ${sim.projPool.count} projectiles, avg tick ${ms.toFixed(3)} ms (60fps budget: 16.6ms)`);
  if (ms > 8) fail(`tick too slow under stress: ${ms.toFixed(2)} ms`);
} catch (err) { fail('stress test crashed', err); }

// ---- 6. snapshot serializability ----
try {
  const sim = new Sim({ seed: 5, party: [{ idx: 0, key: 'k', name: 'S', charId: 'jester', color: '#fff' }] });
  sim.debug('F1'); run(sim, 90);
  const snap = sim.getSnapshot();
  const json = JSON.stringify(snap);
  if (json.length > 25000) console.warn(`  (snapshot is ${json.length} bytes with ~60 enemies — watch bandwidth)`);
  JSON.parse(json);
  ok(`snapshot serializes (${json.length} bytes @ ${snap.enemies.length} enemies)`);
} catch (err) { fail('snapshot serialization', err); }

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL SIM TESTS PASSED');
process.exit(failures ? 1 : 0);
