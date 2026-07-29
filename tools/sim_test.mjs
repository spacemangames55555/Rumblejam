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

// ---- 4b. build management: combine / sell (host-validated) ----
try {
  const { sellValue, weaponBasePrice } = await import('../js/config.js');
  const { WEAPON_BY_ID } = await import('../js/content/weapons.js');
  const sim = new Sim({ seed: 31337, party: [{ idx: 0, key: 'k', name: 'MGMT', charId: 'redmaw', color: '#fff' }] });
  const p = sim.players[0];
  // duplicates now co-exist (no auto-combine on buy)
  sim._addWeapon(p, 'coilgun', 1);
  sim._addWeapon(p, 'coilgun', 1);
  if (p.weapons.filter(w => w.id === 'coilgun').length !== 2) fail('duplicate purchase no longer keeps both copies');
  // combine the pair → next tier, slot freed
  const slots0 = p.weapons.length;
  sim.uiAction(0, { kind: 'combine', a: 1, b: 2, id: 'coilgun', tier: 1 });
  const cg = p.weapons.filter(w => w.id === 'coilgun');
  if (cg.length === 1 && cg[0].tier === 2 && p.weapons.length === slots0 - 1) ok('combine merges pair → tier II and frees a slot');
  else fail(`combine result wrong: ${JSON.stringify(p.weapons)}`);
  // invalid combine (mismatched pair / not owned) is rejected without change
  const before = JSON.stringify(p.weapons);
  sim.uiAction(0, { kind: 'combine', a: 0, b: 1, id: 'emberfang', tier: 1 });
  sim.uiAction(0, { kind: 'combine', a: 0, b: 7, id: 'coilgun', tier: 2 });
  if (JSON.stringify(p.weapons) === before) ok('invalid combine attempts are rejected unchanged');
  else fail('invalid combine mutated the arsenal');
  // tier IV cannot combine
  sim._addWeapon(p, 'twinlash', 4); sim._addWeapon(p, 'twinlash', 4);
  sim.uiAction(0, { kind: 'combine', a: p.weapons.length - 2, b: p.weapons.length - 1, id: 'twinlash', tier: 4 });
  if (p.weapons.filter(w => w.id === 'twinlash').length === 2) ok('tier IV pairs refuse to combine');
  else fail('tier IV combined');
  // sell a weapon: refund 30% floored, slot freed
  const mats0 = p.materials;
  const slot = p.weapons.findIndex(w => w.id === 'coilgun');
  const expect = sellValue(weaponBasePrice(WEAPON_BY_ID.coilgun, 2), sim.floorNum);
  sim.uiAction(0, { kind: 'sellWeapon', slot, id: 'coilgun', tier: 2 });
  if (p.materials === mats0 + expect && !p.weapons.some(w => w.id === 'coilgun')) ok(`sell weapon refunds 30% (+${expect}) and frees the slot`);
  else fail(`sell weapon: mats ${mats0}→${p.materials} (expected +${expect})`);
  // summon weapons: two turrets → two structures; combine → one structure at tier II; sell → none
  sim._addWeapon(p, 'bolt_turret', 1); sim._addWeapon(p, 'bolt_turret', 1);
  const mine = () => sim.summons.filter(s => s.owner === 0 && s.weaponId === 'bolt_turret');
  if (mine().length !== 2) fail(`expected 2 turrets, got ${mine().length}`);
  const ti = p.weapons.map((w, i) => w.id === 'bolt_turret' ? i : -1).filter(i => i >= 0);
  sim.uiAction(0, { kind: 'combine', a: ti[0], b: ti[1], id: 'bolt_turret', tier: 1 });
  if (mine().length === 1 && mine()[0].tier === 2) ok('combining turrets merges the structures too');
  else fail(`turret combine: ${mine().length} structures, tier ${mine()[0] && mine()[0].tier}`);
  sim.uiAction(0, { kind: 'sellWeapon', slot: p.weapons.findIndex(w => w.id === 'bolt_turret'), id: 'bolt_turret', tier: 2 });
  if (mine().length === 0) ok('selling a turret weapon removes its structure');
  else fail('sold turret left its structure behind');
  // sell a stat item: stat drops, materials rise by shown refund
  const statItem = ITEMS.find(it => it.stats && it.stats.damage > 0 && !it.hooks);
  p.items.push(statItem.id);
  sim._recomputeItems(p); sim._recomputeStats(p);
  const dmgWith = p.stats.damage, matsI = p.materials;
  const iExpect = sellValue(statItem.price, sim.floorNum);
  sim.uiAction(0, { kind: 'sellItem', id: statItem.id });
  if (p.stats.damage === dmgWith - statItem.stats.damage && p.materials === matsI + iExpect) ok(`sell item drops its stats and refunds +${iExpect}`);
  else fail(`sell item: dmg ${dmgWith}→${p.stats.damage}, mats ${matsI}→${p.materials}`);
  // sell a mechanical item: its hook can never fire again
  const mech = ITEMS.find(it => it.hooks && it.hooks.killExplode);
  p.items.push(mech.id);
  sim._recomputeItems(p);
  if (p.hookAgg.killExplode.length !== 1) fail('mech hook not registered');
  sim.uiAction(0, { kind: 'sellItem', id: mech.id });
  if (p.hookAgg.killExplode.length === 0) ok('sold mechanical item is unregistered from hook aggregation');
  else fail('sold mechanical item still registered');
  // selling one of a stack keeps the rest
  p.items.push(statItem.id, statItem.id);
  sim._recomputeItems(p); sim._recomputeStats(p);
  sim.uiAction(0, { kind: 'sellItem', id: statItem.id });
  if (p.items.filter(i => i === statItem.id).length === 1) ok('selling from a stack removes exactly one');
  else fail('stack sell removed wrong count');
  // full slots: buy denied with the make-room reason, then sell frees a purchase
  while (p.weapons.length < p.weaponSlots) sim._addWeapon(p, 'pebbleshot', 1);
  const okAdd = sim._addWeapon(p, 'rustcleaver', 1);
  if (!okAdd) ok('purchase at 6/6 is denied (no silent auto-combine)');
  else fail('purchase at full slots succeeded unexpectedly');
  sim.uiAction(0, { kind: 'sellWeapon', slot: p.weapons.length - 1, id: p.weapons[p.weapons.length - 1].id, tier: p.weapons[p.weapons.length - 1].tier });
  if (sim._addWeapon(p, 'rustcleaver', 1)) ok('after selling, a new purchase fits');
  else fail('purchase still blocked after selling');
} catch (err) { fail('build management tests crashed', err); }

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
