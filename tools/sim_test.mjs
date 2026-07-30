// Dev tool: headless simulation exercise (Great Rebalance edition).
// Runs the real Sim in Node:
//  1. content count assertions (32 chars / ≥100 items / 26 weapons) + dead-stat gate
//  2. every character clears floor 1 solo (smoke, tuning gate 2)
//  3. full-run victories for the six gate characters (tuning gate 3)
//  4. floor-1 baseline DPS within ±40% of the roster median (tuning gate 4)
//  5. a 4-player co-op run with downs/revives and shop traffic
//  6. build management: combine / sell / invested lineage
//  7. rebalance mechanics: crits granted-only, Recovery healing, soulbond, prism
//  8. stress: ~250 enemies + heavy projectiles, tick-time measurement
// Usage: node tools/sim_test.mjs
import { Sim } from '../js/game.js';
import { CHARACTERS, CHAR_BY_ID } from '../js/content/characters.js';
import { ITEMS } from '../js/content/items.js';
import { WEAPONS } from '../js/content/weapons.js';
import { ENEMIES } from '../js/content/enemies.js';
import { BOSSES } from '../js/content/bosses.js';
import { STAT_KEYS } from '../js/config.js';

let failures = 0;
const fail = (msg, err) => { failures++; console.error(`✗ ${msg}`, err ? (err.stack || err) : ''); };
const ok = msg => console.log(`✓ ${msg}`);

// ---- 1. content counts ----
if (CHARACTERS.length === 32) ok('characters: 32'); else fail(`characters ${CHARACTERS.length} != 32`);
if (ITEMS.length >= 100) ok(`items: ${ITEMS.length}`); else fail(`items ${ITEMS.length} < 100`);
if (WEAPONS.length === 26) ok('weapons: 26'); else fail(`weapons ${WEAPONS.length} != 26`);
if (ENEMIES.length === 12) ok('enemy types: 12'); else fail(`enemy types ${ENEMIES.length} != 12`);
if (BOSSES.length === 4) ok('bosses: 4'); else fail(`bosses ${BOSSES.length} != 4`);

// weapon class coverage
const byCls = {};
for (const w of WEAPONS) byCls[w.cls] = (byCls[w.cls] || 0) + 1;
for (const cls of ['swing', 'thrust', 'single', 'spread', 'lobbed', 'summon']) {
  if (!byCls[cls] || byCls[cls] < 4) fail(`weapon class ${cls} has ${byCls[cls] || 0} (<4)`);
}
ok(`weapon classes: ${JSON.stringify(byCls)}`);

// ---- 1b. dead-stat gate: every stat on ≥2 weapons, ≥5 items, ≥1 statline ----
{
  const wCover = Object.fromEntries(STAT_KEYS.map(k => [k, 0]));
  for (const w of WEAPONS) {
    if (!Array.isArray(w.scaling) || w.scaling.length < 1 || w.scaling.length > 2) fail(`${w.id}: scaling must list 1-2 stats`);
    for (const k of w.scaling) { if (!(k in wCover)) fail(`${w.id}: unknown scaling stat ${k}`); else wCover[k]++; }
  }
  const iCover = Object.fromEntries(STAT_KEYS.map(k => [k, 0]));
  for (const it of ITEMS) {
    const ks = new Set(Object.keys(it.stats || {}));
    const h = it.hooks || {};
    if (h.condStats) for (const k of Object.keys(h.condStats.stats)) ks.add(k);
    if (h.allyAura) for (const k of Object.keys(h.allyAura.stats)) ks.add(k);
    for (const k of ks) if (k in iCover) iCover[k]++;
  }
  const cCover = Object.fromEntries(STAT_KEYS.map(k => [k, 0]));
  for (const c of CHARACTERS) for (const [k, v] of Object.entries(c.stats)) {
    if (!(k in cCover)) fail(`${c.id}: unknown stat ${k}`); else if (v > 0) cCover[k]++;
  }
  let dead = 0;
  for (const k of STAT_KEYS) {
    if (wCover[k] < 2) { dead++; fail(`stat ${k}: on ${wCover[k]} weapons (<2)`); }
    if (iCover[k] < 5) { dead++; fail(`stat ${k}: on ${iCover[k]} items (<5)`); }
    if (cCover[k] < 1) { dead++; fail(`stat ${k}: on ${cCover[k]} character statlines (<1)`); }
  }
  if (!dead) ok('no dead stats: every stat on ≥2 weapons, ≥5 items, ≥1 statline');
}

// ---- 1c. stat glossary: complete, short, and covers every rendered stat ----
{
  const { STAT_GLOSS } = await import('../js/content/glossary.js');
  let bad = 0;
  for (const k of STAT_KEYS) {
    const g = STAT_GLOSS[k];
    if (!g || typeof g.short !== 'string' || typeof g.detail !== 'string' || !g.short.length || !g.detail.length) {
      bad++; fail(`glossary: missing/incomplete entry for '${k}'`); continue;
    }
    const words = g.short.split(/\s+/).filter(w => /[a-zA-Z]/.test(w)).length;
    if (words > 12) { bad++; fail(`glossary: short for '${k}' is ${words} words (>12)`); }
    // 1-2 sentences plus an optional one-word label ("Fortune.") — the spec's
    // own Greed example counts three period marks
    const sentences = (g.detail.match(/[.!?]/g) || []).length;
    if (sentences < 1 || sentences > 3) { bad++; fail(`glossary: detail for '${k}' has ${sentences} sentence marks (want 1-3)`); }
  }
  for (const k of Object.keys(STAT_GLOSS)) {
    if (!STAT_KEYS.includes(k)) { bad++; fail(`glossary: unknown stat '${k}'`); }
  }
  // every stat name the UI can render (weapon scaling tags, item stat blocks
  // and stat-granting hooks, character statlines, the sheet itself) must
  // resolve to a glossary entry
  const rendered = new Set(STAT_KEYS); // the sheet renders all ten
  for (const w of WEAPONS) for (const k of w.scaling) rendered.add(k);
  for (const c of CHARACTERS) for (const k of Object.keys(c.stats)) rendered.add(k);
  for (const it of ITEMS) {
    for (const k of Object.keys(it.stats || {})) rendered.add(k);
    const h = it.hooks || {};
    for (const hk of ['condStats', 'allyAura', 'levelStats', 'floorStats']) {
      if (h[hk] && h[hk].stats) for (const k of Object.keys(h[hk].stats)) rendered.add(k);
    }
  }
  for (const k of rendered) if (!STAT_GLOSS[k]) { bad++; fail(`glossary: UI renders stat '${k}' with no glossary entry`); }
  if (!bad) ok(`stat glossary: all 10 entries complete; ${rendered.size} rendered stat names all resolve`);
}

// ---- 1d. dungeon structure across many seeds ----
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

// ---- helpers for scripted runs ----
function run(sim, n) { for (let i = 0; i < n; i++) sim.tick(); }
function events(sim) { return sim.events.splice(0); }
function forceKillBoss(sim) {
  let guard = 0;
  while (sim.boss && guard++ < 500) sim.damageEnemy(sim.boss, 500, { owner: sim.players[0] });
}
function resolveOffers(sim, buyStuff) {
  for (const p of sim.players) {
    let g2 = 0;
    while (p.pendingOffer && g2++ < 40) sim.uiAction(p.idx, { kind: 'levelup', id: p.pendingOffer[0].id });
    if (p.treasureOffer) sim.uiAction(p.idx, { kind: 'treasure', id: p.treasureOffer.picks[0] });
    if (p.boonOffer) sim.uiAction(p.idx, { kind: 'boon', id: p.boonOffer[0].id });
    if (buyStuff && p.shop) {
      sim.uiAction(p.idx, { kind: 'reroll' });
      sim.uiAction(p.idx, { kind: 'lock', slot: 0 });
      for (let s = 0; s < 4; s++) sim.uiAction(p.idx, { kind: 'buy', slot: s });
      sim.uiAction(p.idx, { kind: 'closeShop' });
    }
  }
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
    resolveOffers(sim, buyStuff);
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
  resolveOffers(sim, false);
  if (sim.floorNum >= 4) {
    run(sim, 200); // pendingEnd → win
  } else {
    if (!sim.hatch) fail(`no hatch after floor ${floorN} boss`);
    sim.players[0].x = sim.hatch.x; sim.players[0].y = sim.hatch.y;
    let g3 = 0;
    while (sim.floorNum === floorN && g3++ < 400) { sim.players[0].x = sim.W / 2; sim.players[0].y = sim.H / 2; sim.tick(); }
    if (sim.floorNum === floorN) fail(`hatch transition failed on floor ${floorN}`);
  }
  events(sim);
}

// ---- 2. character smoke: every character clears floor 1 solo (gate 2) ----
let smokeFail = 0;
for (const c of CHARACTERS) {
  try {
    const sim = new Sim({ seed: 123456789, party: [{ idx: 0, key: 'k', name: 'SMOKE', charId: c.id, color: '#fff' }] });
    sim.setInput(0, { mx: 1, my: 0.5 });
    playFloor(sim, false);
    if (sim.over) throw new Error('run ended on floor 1');
    if (sim.floorNum !== 2) throw new Error(`still on floor ${sim.floorNum}`);
    sim.getSnapshot();
    sim.getMeta(sim.players[0]);
  } catch (err) { smokeFail++; fail(`character ${c.id} floor-1 clear`, err); }
}
if (!smokeFail) ok(`all ${CHARACTERS.length} characters clear floor 1 solo`);

// ---- 3. full-run victories for the six gate characters (gate 3) ----
for (const charId of ['bulwark', 'cogsmith', 'zephyr', 'powderkeg', 'quartermaster', 'facet']) {
  try {
    const sim = new Sim({ seed: 424242, party: [{ idx: 0, key: 'k', name: 'RUN', charId, color: '#fff' }] });
    sim.debug('F2'); // funds for shopping
    for (let f = 1; f <= 4 && !sim.over; f++) playFloor(sim, true);
    if (sim.over && sim.result && sim.result.win) ok(`full-run WIN as ${charId}`);
    else fail(`${charId} run did not end in a win (over=${sim.over}, result=${JSON.stringify(sim.result && { win: sim.result.win, floor: sim.result.floor })})`);
  } catch (err) { fail(`${charId} full run crashed`, err); }
}

// ---- 4. floor-1 baseline DPS: within ±40% of the roster median (gate 4) ----
// Harness: god-mode player pinned at room center shooting four immobile
// high-HP training dummies at 90u (N/E/S/W). Melee reaches them, AoE clips
// neighbors, and nothing ever dies or overlaps the player. 20 simulated
// seconds; DPS = damageDealt / 20.
function measureDps(charId) {
  const sim = new Sim({ seed: 9999, party: [{ idx: 0, key: 'k', name: 'DPS', charId, color: '#fff' }] });
  sim.god = true;
  const p = sim.players[0];
  p.x = sim.W / 2; p.y = sim.H / 2;
  const dummies = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const e = sim.spawnEnemyById('slabjaw', p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90, { noMats: true });
    e.hp = 1e9; e.maxHp = 2e9; // never full (no free full-HP crits), never dies
    e.spd = 0; e.dmg = 0;      // training dummies don't fight back (or eat drones)
    dummies.push({ e, x: e.x, y: e.y });
  }
  const SECS = 20;
  for (let t = 0; t < SECS * 60; t++) {
    p.x = sim.W / 2; p.y = sim.H / 2;
    for (const d of dummies) { d.e.x = d.x; d.e.y = d.y; d.e.knockX = d.e.knockY = 0; }
    sim.tick();
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  }
  return p.damageDealt / SECS;
}
try {
  const table = CHARACTERS.map(c => ({ id: c.id, dps: measureDps(c.id) }));
  const sorted = [...table].sort((a, b) => a.dps - b.dps);
  const median = sorted[Math.floor(sorted.length / 2)].dps;
  let outliers = 0;
  console.log('  DPS table (floor-1 baseline, median ' + median.toFixed(1) + '):');
  for (const row of table) {
    const dev = (row.dps - median) / median * 100;
    const flag = Math.abs(dev) > 40 ? '  ← OUTLIER' : '';
    console.log(`    ${row.id.padEnd(14)} ${row.dps.toFixed(1).padStart(7)}  ${(dev >= 0 ? '+' : '') + dev.toFixed(0)}%${flag}`);
    if (Math.abs(dev) > 40) outliers++;
  }
  if (!outliers) ok('DPS gate: all 32 characters within ±40% of median');
  else fail(`DPS gate: ${outliers} outlier(s) beyond ±40% of median`);
} catch (err) { fail('DPS harness crashed', err); }

// ---- 5. co-op run: 4 players, downs, revives ----
try {
  const party = ['bulwark', 'wisp', 'cogsmith', 'voltaic'].map((c, i) => ({ idx: i, key: 'k' + i, name: 'P' + i, charId: c, color: '#fff' }));
  const sim = new Sim({ seed: 777, party });
  sim.debug('F2');
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

// ---- 6. build management: combine / sell (host-validated) ----
try {
  const { sellValue, weaponBasePrice } = await import('../js/config.js');
  const { WEAPON_BY_ID } = await import('../js/content/weapons.js');
  const sim = new Sim({ seed: 31337, party: [{ idx: 0, key: 'k', name: 'MGMT', charId: 'redmaw', color: '#fff' }] });
  const p = sim.players[0];
  sim._addWeapon(p, 'coilgun', 1);
  sim._addWeapon(p, 'coilgun', 1);
  if (p.weapons.filter(w => w.id === 'coilgun').length !== 2) fail('duplicate purchase no longer keeps both copies');
  const slots0 = p.weapons.length;
  sim.uiAction(0, { kind: 'combine', a: 1, b: 2, id: 'coilgun', tier: 1 });
  const cg = p.weapons.filter(w => w.id === 'coilgun');
  if (cg.length === 1 && cg[0].tier === 2 && p.weapons.length === slots0 - 1) ok('combine merges pair → tier II and frees a slot');
  else fail(`combine result wrong: ${JSON.stringify(p.weapons)}`);
  const before = JSON.stringify(p.weapons);
  sim.uiAction(0, { kind: 'combine', a: 0, b: 1, id: 'emberfang', tier: 1 });
  sim.uiAction(0, { kind: 'combine', a: 0, b: 7, id: 'coilgun', tier: 2 });
  if (JSON.stringify(p.weapons) === before) ok('invalid combine attempts are rejected unchanged');
  else fail('invalid combine mutated the arsenal');
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
  // summon weapons: structures follow combine/sell
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
  const statItem = ITEMS.find(it => it.stats && it.stats.ferocity > 0 && !it.hooks);
  p.items.push(statItem.id);
  sim._recomputeItems(p); sim._recomputeStats(p);
  const ferWith = p.stats.ferocity, matsI = p.materials;
  const iExpect = sellValue(statItem.price, sim.floorNum);
  sim.uiAction(0, { kind: 'sellItem', id: statItem.id });
  if (p.stats.ferocity === ferWith - statItem.stats.ferocity && p.materials === matsI + iExpect) ok(`sell item drops its stats and refunds +${iExpect}`);
  else fail(`sell item: ferocity ${ferWith}→${p.stats.ferocity}, mats ${matsI}→${p.materials}`);
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

  // Quartermaster: invested lineage — buy 2, combine, sell for exact total
  const qsim = new Sim({ seed: 555, party: [{ idx: 0, key: 'k', name: 'QM', charId: 'quartermaster', color: '#fff' }] });
  const qp = qsim.players[0];
  const startInvested = qp.weapons[0].invested;
  qsim._addWeapon(qp, 'pebbleshot', 1, 30);
  qsim._addWeapon(qp, 'pebbleshot', 1, 40);
  const pi = qp.weapons.map((w, i) => w.id === 'pebbleshot' ? i : -1).filter(i => i >= 0);
  qsim.uiAction(0, { kind: 'combine', a: pi[0], b: pi[1], id: 'pebbleshot', tier: 1 });
  const merged = qp.weapons.find(w => w.id === 'pebbleshot');
  if (merged.invested !== 70) fail(`combine lineage: invested ${merged.invested} != 70`);
  const qmats = qp.materials;
  qsim.uiAction(0, { kind: 'sellWeapon', slot: qp.weapons.indexOf(merged), id: 'pebbleshot', tier: 2 });
  if (qp.materials === qmats + 70) ok(`Quartermaster sells for exact invested materials (70; starting gear ${startInvested})`);
  else fail(`Quartermaster sell: mats ${qmats}→${qp.materials} (expected +70)`);
} catch (err) { fail('build management tests crashed', err); }

// ---- 7. rebalance mechanic assertions ----
try {
  // crits are granted-only: a plain character never crits
  const sim = new Sim({ seed: 42, party: [{ idx: 0, key: 'k', name: 'C', charId: 'rampart', color: '#fff' }] });
  const p = sim.players[0];
  let crits = 0;
  const origHits = sim.fx.hits;
  for (let i = 0; i < 200; i++) {
    const e = sim.spawnEnemyById('slabjaw', p.x + 80, p.y, { noMats: true });
    e.hp = 10000; e.maxHp = 10000; // not full-HP-crit relevant (no such item held)
    sim.tick();
    for (const h of sim.fx.hits) if (h.c === 1) crits++;
    sim.fx.hits.length = 0;
    for (const en of [...sim.enemyPool]) sim.enemyPool.release(en);
  }
  if (crits === 0) ok('crit is not a stat: no random crits without a granted effect');
  else fail(`plain character landed ${crits} random crits`);

  // Recovery amplifies healing sources
  const rsim = new Sim({ seed: 43, party: [{ idx: 0, key: 'k', name: 'R', charId: 'rampart', color: '#fff' }] });
  const rp = rsim.players[0];
  rp.hp = 10;
  rsim._heal(rp, 10);
  const gained0 = rp.hp - 10;
  rp.boosts.recovery = 100; rsim._recomputeStats(rp);
  rp.hp = 10; rp.healAcc = 0;
  rsim._heal(rp, 10);
  const gained1 = rp.hp - 10;
  if (gained0 === 10 && gained1 === 20) ok('Recovery amplifies healing (+100% → double heal)');
  else fail(`Recovery healing: base ${gained0}, amplified ${gained1}`);

  // Soulbond shares damage both ways
  const bsim = new Sim({ seed: 44, party: [
    { idx: 0, key: 'a', name: 'L', charId: 'lodestone', color: '#fff' },
    { idx: 1, key: 'b', name: 'M', charId: 'rampart', color: '#fff' }] });
  const [lp, mp] = bsim.players;
  lp.invuln = 0; mp.invuln = 0;
  const lHp = lp.hp, mHp = mp.hp;
  lp.stats.reflex = 0; // force the hit through
  bsim.hurtPlayer(lp, 30, null);
  if (lp.hp < lHp && mp.hp < mHp) ok('Soulbond: partner soaks a share of incoming damage');
  else fail(`Soulbond share: lodestone ${lHp}→${lp.hp}, partner ${mHp}→${mp.hp}`);

  // Prism: 3 picks of the same boon make it permanent
  const fsim = new Sim({ seed: 45, party: [{ idx: 0, key: 'k', name: 'F', charId: 'facet', color: '#fff' }] });
  const fp = fsim.players[0];
  for (let i = 0; i < 3; i++) {
    fp.boonOffer = [{ id: 'ferocity_small', stat: 'ferocity', amount: 6, rarity: 'common', n: i }];
    fsim.uiAction(0, { kind: 'boon', id: 'ferocity_small' });
  }
  if ((fp.permStats.ferocity || 0) === 6 && fp.boonCounts.ferocity_small === 3) ok('Prism: third pick of a boon makes it permanent');
  else fail(`Prism permanence: permStats ${JSON.stringify(fp.permStats)}, counts ${JSON.stringify(fp.boonCounts)}`);

  // Tempo drives attack cooldown and move speed
  const tsim = new Sim({ seed: 46, party: [{ idx: 0, key: 'k', name: 'T', charId: 'onrush', color: '#fff' }] });
  const tp = tsim.players[0];
  if (tp.stats.tempo === 25) ok('Onrush statline: +25% Tempo');
  else fail(`Onrush tempo ${tp.stats.tempo}`);
} catch (err) { fail('rebalance mechanics crashed', err); }

// ---- 8. stress ----
try {
  const sim = new Sim({ seed: 99, party: [{ idx: 0, key: 'k', name: 'STRESS', charId: 'threader', color: '#fff' }] });
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

// ---- 9. snapshot serializability (with trait visuals) ----
try {
  const sim = new Sim({ seed: 5, party: [
    { idx: 0, key: 'a', name: 'S', charId: 'banneret', color: '#fff' },
    { idx: 1, key: 'b', name: 'T', charId: 'lodestone', color: '#fff' }] });
  sim.debug('F1'); run(sim, 90);
  const snap = sim.getSnapshot();
  const json = JSON.stringify(snap);
  JSON.parse(json);
  if (!snap.auras.length) fail('snapshot missing Banneret aura');
  if (!snap.tethers.length) fail('snapshot missing Lodestone tether');
  ok(`snapshot serializes (${json.length} bytes @ ${snap.enemies.length} enemies, ${snap.auras.length} aura, ${snap.tethers.length} tether)`);
} catch (err) { fail('snapshot serialization', err); }

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL SIM TESTS PASSED');
process.exit(failures ? 1 : 0);
