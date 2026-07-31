// Dev tool: headless simulation exercise (Gauntlet edition).
// Runs the real Sim in Node:
//  1. content counts + dead-stat gate + glossary completeness
//  2. node-map generation gates across seeds (guarantees, avoidable elite)
//  3. consent selection: solo instant; contested vote redirects once, locks
//  4. all 32 characters clear their first fight node
//  5. full solo runs to victory for the six per-fight-trigger/DoD characters
//  6. per-fight trigger mapping (Rampart, Vesper, Facet, Greed, level banking)
//  7. all five arena templates spawn, fight, clear; extraction consent works
//  8. the Siege end-to-end: mutations, collapse, pylon, hold circle,
//     mutation-revive, mid-siege boss, payout and descent
//  9. co-op downs/revives/wipe; build management; rebalance mechanics
// 10. DPS gate (±40% of median), stress timing, snapshot serialization
// Usage: node tools/sim_test.mjs
import { Sim } from '../js/game.js';
import { CHARACTERS, CHAR_BY_ID } from '../js/content/characters.js';
import { ITEMS } from '../js/content/items.js';
import { WEAPONS } from '../js/content/weapons.js';
import { ENEMIES } from '../js/content/enemies.js';
import { BOSSES } from '../js/content/bosses.js';
import { STAT_KEYS } from '../js/config.js';
import { generateFloorMap } from '../js/dungeon.js';
import { TEMPLATE_KEYS, SIEGES } from '../js/arenas.js';

let failures = 0;
const fail = (msg, err) => { failures++; console.error(`✗ ${msg}`, err ? (err.stack || err) : ''); };
const ok = msg => console.log(`✓ ${msg}`);

// ---- 1. content counts ----
if (CHARACTERS.length === 32) ok('characters: 32'); else fail(`characters ${CHARACTERS.length} != 32`);
if (ITEMS.length >= 100) ok(`items: ${ITEMS.length}`); else fail(`items ${ITEMS.length} < 100`);
if (WEAPONS.length === 26) ok('weapons: 26'); else fail(`weapons ${WEAPONS.length} != 26`);
if (ENEMIES.length === 12) ok('enemy types: 12'); else fail(`enemy types ${ENEMIES.length} != 12`);
if (BOSSES.length === 4) ok('bosses: 4'); else fail(`bosses ${BOSSES.length} != 4`);

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
    const sentences = (g.detail.match(/[.!?]/g) || []).length;
    if (sentences < 1 || sentences > 3) { bad++; fail(`glossary: detail for '${k}' has ${sentences} sentence marks (want 1-3)`); }
  }
  for (const k of Object.keys(STAT_GLOSS)) {
    if (!STAT_KEYS.includes(k)) { bad++; fail(`glossary: unknown stat '${k}'`); }
  }
  const rendered = new Set(STAT_KEYS);
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

// ---- 2. node-map generation gates across seeded generations ----
{
  let bad = 0;
  for (let seed = 1; seed <= 150; seed++) {
    for (let f = 1; f <= 4; f++) {
      const m = generateFloorMap(seed, f);
      const kinds = {};
      for (const n of m.nodes) kinds[n.kind] = (kinds[n.kind] || 0) + 1;
      if (m.nodes.length < 8 || m.nodes.length > 10) { bad++; fail(`map ${seed}/${f}: ${m.nodes.length} nodes`); }
      if (kinds.shop !== 1 || kinds.treasure !== 1 || kinds.elite !== 1 || kinds.siege !== 1) { bad++; fail(`map ${seed}/${f}: kinds ${JSON.stringify(kinds)}`); }
      // every non-siege node exits; whole map reachable; siege reachable from all
      for (const n of m.nodes) if (n.id !== m.siegeId && (n.edges.length < 1 || n.edges.length > 3)) { bad++; fail(`map ${seed}/${f}: node ${n.id} has ${n.edges.length} exits`); }
      const seen = new Set(m.startIds); const q = [...m.startIds];
      while (q.length) { const id = q.shift(); for (const e of m.nodes[id].edges) if (!seen.has(e)) { seen.add(e); q.push(e); } }
      if (seen.size !== m.nodes.length) { bad++; fail(`map ${seed}/${f}: unreachable nodes`); }
      // the elite is optional: a path from an entry to the siege avoids it
      const elite = m.nodes.find(n => n.kind === 'elite');
      const seen2 = new Set(m.startIds.filter(id => id !== elite.id));
      const q2 = [...seen2];
      let avoidable = false;
      while (q2.length) {
        const id = q2.shift();
        if (id === m.siegeId) { avoidable = true; break; }
        for (const e of m.nodes[id].edges) if (e !== elite.id && !seen2.has(e)) { seen2.add(e); q2.push(e); }
      }
      if (!avoidable) { bad++; fail(`map ${seed}/${f}: elite is mandatory`); }
      // every floor draws from all five arena templates
      const t = new Set(m.nodes.filter(n => n.template).map(n => n.template));
      if (t.size !== TEMPLATE_KEYS.length) { bad++; fail(`map ${seed}/${f}: templates ${[...t]}`); }
    }
  }
  if (!bad) ok('node maps: 600 seeded generations — counts, guarantees, avoidable elite, all 5 templates');
}

// ---- helpers ----
function drain(sim, p, buyStuff) {
  let g = 0;
  while (p.pendingOffer && g++ < 40) sim.uiAction(p.idx, { kind: 'levelup', id: p.pendingOffer[0].id });
  if (p.treasureOffer) sim.uiAction(p.idx, { kind: 'treasure', id: p.treasureOffer.picks[0] });
  if (p.boonOffer) sim.uiAction(p.idx, { kind: 'boon', id: p.boonOffer[0].id });
  // shops now open at every extraction — act ONCE per shop session, not per tick
  if (p.shop && p._drainKey !== p.shop.key) {
    p._drainKey = p.shop.key;
    if (buyStuff) {
      sim.uiAction(p.idx, { kind: 'reroll' });
      for (let s = 0; s < p.shop.stock.length; s++) sim.uiAction(p.idx, { kind: 'buy', slot: s });
    }
    sim.uiAction(p.idx, { kind: 'closeShop' });
  }
}
// kill everything (twice — shielded elites block single probe hits)
function nuke(sim, p, sparBoss) {
  for (const e of [...sim.enemyPool]) {
    if (sparBoss && e.boss) continue;
    sim.damageEnemy(e, 900, { owner: p });
    if (e.active) sim.damageEnemy(e, 900, { owner: p });
  }
}
// run one arena node to extraction (F3-style). Returns ticks spent.
function clearArena(sim, buyStuff) {
  const p = sim.players[0];
  let ticks = 0;
  while (sim.phase === 'arena' && !sim.over && ticks++ < 60 * 300) {
    sim.tick();
    // the harness stands still at center (no kiting), so keep it alive — flow
    // tests verify structure/triggers; survivability is the balance probe's job
    for (const q of sim.players) if (!q.downed && !q.gone) q.hp = q.stats.vitality;
    if (ticks % 240 === 0) nuke(sim, p);
    if (sim.boss) sim.damageEnemy(sim.boss, 200, { owner: p });
    for (const q of sim.players) drain(sim, q, buyStuff);
    if (sim.cleared && sim.hatch) for (const q of sim.livePlayers()) { q.x = sim.hatch.x; q.y = sim.hatch.y; }
  }
  return ticks;
}
// walk the whole floor: pick nodes until the siege is beaten (floor advances)
function playFloor(sim, buyStuff) {
  const startFloor = sim.floorNum;
  let guard = 0;
  while (!sim.over && sim.floorNum === startFloor && guard++ < 40) {
    if (sim.phase === 'map') {
      for (const q of sim.players) drain(sim, q, buyStuff);
      const r = sim.reachableNodes();
      if (!r.length) { fail(`floor ${startFloor}: no reachable nodes from ${sim.currentNode}`); return; }
      sim.uiAction(0, { kind: 'pickNode', nodeId: r[0] });
      // co-op: the tap starts a consent countdown — tick it out
      for (let i = 0; i < 60 * 5 && sim.phase === 'map' && !sim.over; i++) sim.tick();
    } else {
      clearArena(sim, buyStuff);
    }
  }
  if (sim.floorNum === startFloor && !sim.over) fail(`floor ${startFloor} never completed`);
}

// ---- 3. consent selection: solo instant; contested redirects once then locks ----
try {
  const solo = new Sim({ seed: 5, party: [{ idx: 0, key: 'a', name: 'S', charId: 'rampart', color: '#fff' }] });
  const first = solo.reachableNodes()[0];
  solo.uiAction(0, { kind: 'pickNode', nodeId: first });
  if (solo.phase === 'arena' && solo.currentNode === first) ok('solo node tap travels immediately');
  else fail(`solo pick: phase ${solo.phase}`);

  const duo = new Sim({ seed: 5, party: [
    { idx: 0, key: 'a', name: 'A', charId: 'rampart', color: '#fff' },
    { idx: 1, key: 'b', name: 'B', charId: 'redmaw', color: '#fff' }] });
  const [n1, n2] = duo.reachableNodes();
  duo.uiAction(0, { kind: 'pickNode', nodeId: n1 });
  if (duo.phase === 'map' && duo.nodeVote && duo.nodeVote.nodeId === n1) ok('co-op tap starts the 4s consent countdown');
  else fail('co-op vote did not start');
  // same player cannot redirect
  duo.uiAction(0, { kind: 'pickNode', nodeId: n2 });
  if (duo.nodeVote.nodeId === n1) ok('the same player cannot redirect their own vote'); else fail('self-redirect happened');
  // different player redirects once
  duo.uiAction(1, { kind: 'pickNode', nodeId: n2 });
  if (duo.nodeVote.nodeId === n2 && duo.nodeVote.redirected) ok('a different player redirects the countdown once');
  else fail('redirect failed');
  // after the redirect the selection is locked
  duo.uiAction(0, { kind: 'pickNode', nodeId: n1 });
  if (duo.nodeVote.nodeId === n2) ok('after one redirect the selection locks'); else fail('post-redirect tap changed the vote');
  // countdown expiry travels
  for (let i = 0; i < 60 * 5 && duo.phase === 'map'; i++) duo.tick();
  if (duo.phase === 'arena' && duo.currentNode === n2) ok('countdown expiry travels the party');
  else fail(`vote expiry: phase ${duo.phase} node ${duo.currentNode}`);
} catch (err) { fail('consent selection crashed', err); }

// ---- 4. all 32 characters clear their first fight node ----
{
  let smokeFail = 0;
  for (const c of CHARACTERS) {
    try {
      const sim = new Sim({ seed: 123456789, party: [{ idx: 0, key: 'k', name: 'SMOKE', charId: c.id, color: '#fff' }] });
      sim.setInput(0, { mx: 1, my: 0.5 });
      sim.uiAction(0, { kind: 'pickNode', nodeId: sim.reachableNodes()[0] });
      if (sim.phase !== 'arena') throw new Error('did not enter arena');
      clearArena(sim, false);
      if (sim.phase !== 'map') throw new Error(`stuck in arena (cleared=${sim.cleared})`);
      sim.getSnapshot();
      sim.getMeta(sim.players[0]);
    } catch (err) { smokeFail++; fail(`character ${c.id} first fight`, err); }
  }
  if (!smokeFail) ok('all 32 characters clear their first fight node and extract');
}

// ---- 5. full-run victories (per-fight-trigger chars + DoD staples) ----
for (const charId of ['facet', 'rampart', 'vesper', 'bulwark', 'cogsmith', 'zephyr']) {
  try {
    const sim = new Sim({ seed: 424242, party: [{ idx: 0, key: 'k', name: 'RUN', charId, color: '#fff' }] });
    sim.debug('F2');
    for (let f = 1; f <= 4 && !sim.over; f++) playFloor(sim, true);
    if (sim.over && sim.result && sim.result.win) ok(`full-run WIN as ${charId}`);
    else fail(`${charId} run did not win (over=${sim.over}, floor=${sim.floorNum})`);
  } catch (err) { fail(`${charId} full run crashed`, err); }
}

// ---- 6. per-fight trigger mapping ----
try {
  // Rampart: +1 permanent Grit per FIGHT cleared
  const rs = new Sim({ seed: 9, party: [{ idx: 0, key: 'k', name: 'R', charId: 'rampart', color: '#fff' }] });
  rs.uiAction(0, { kind: 'pickNode', nodeId: rs.reachableNodes()[0] });
  clearArena(rs, false);
  if ((rs.players[0].permStats.grit || 0) === 1) ok('Rampart: +1 permanent Grit per fight cleared');
  else fail(`Rampart grit after one fight: ${rs.players[0].permStats.grit}`);

  // Vesper: overheal → Vitality capped +3 per FIGHT, cap resets on the next fight
  const vs = new Sim({ seed: 10, party: [{ idx: 0, key: 'k', name: 'V', charId: 'vesper', color: '#fff' }] });
  vs.uiAction(0, { kind: 'pickNode', nodeId: vs.reachableNodes()[0] });
  const vp = vs.players[0];
  vp.hp = vp.stats.vitality;
  vs._heal(vp, 50);
  if ((vp.permStats.vitality || 0) !== 3) fail(`Vesper first-fight overheal: ${vp.permStats.vitality} (want 3)`);
  clearArena(vs, false);
  vs.uiAction(0, { kind: 'pickNode', nodeId: vs.reachableNodes()[0] });
  if (vs.phase !== 'arena') { // second pick may hit a stop node — walk until a fight
    let g = 0;
    while (vs.phase === 'map' && g++ < 5) { drain(vs, vp, false); vs.uiAction(0, { kind: 'pickNode', nodeId: vs.reachableNodes()[0] }); }
  }
  vp.hp = vp.stats.vitality; vp.healAcc = 0;
  vs._heal(vp, 50);
  if ((vp.permStats.vitality || 0) === 6) ok('Vesper: overheal cap +3 per fight, resets each fight');
  else fail(`Vesper second-fight overheal total: ${vp.permStats.vitality} (want 6)`);

  // Facet: boon offered on entering Combat/Elite/Siege nodes, not on stops
  const fs = new Sim({ seed: 11, party: [{ idx: 0, key: 'k', name: 'F', charId: 'facet', color: '#fff' }] });
  const fp = fs.players[0];
  if (fp.boonOffer) fail('Facet had a boon before the first fight');
  fs.uiAction(0, { kind: 'pickNode', nodeId: fs.reachableNodes()[0] });
  if (fs.phase === 'arena' && fp.boonOffer) ok('Facet: boon offered on entering a fight node');
  else fail(`Facet boon on arena entry: ${!!fp.boonOffer}`);
  const boonStat = fp.boonOffer[0].stat;
  fs.uiAction(0, { kind: 'boon', id: fp.boonOffer[0].id });
  if (fp.boonTemp && fp.boonTemp[boonStat]) ok('Facet: boon applies for the fight');
  clearArena(fs, false);
  if (!fp.boonTemp) ok('Facet: boon expires when the fight ends'); else fail('boon survived extraction');

  // Greed: floor(G/2) materials at every fight clear
  const gs = new Sim({ seed: 12, party: [{ idx: 0, key: 'k', name: 'G', charId: 'gilded_one', color: '#fff' }] });
  gs.players[0].boosts.greed = 15; gs._recomputeStats(gs.players[0]); // 30 total → +15
  gs.uiAction(0, { kind: 'pickNode', nodeId: gs.reachableNodes()[0] });
  const matsBefore = gs.players[0].materials;
  gs.wave.done = true; gs.spawnQueue.length = 0;
  for (const e of [...gs.enemyPool]) gs.enemyPool.release(e);
  for (let i = 0; i < 30 && !gs.cleared; i++) gs.tick();
  if (gs.players[0].materials - matsBefore >= 15) ok(`Greed pays floor(G/2) at fight clear (+${gs.players[0].materials - matsBefore})`);
  else fail(`Greed tithe: +${gs.players[0].materials - matsBefore} (want ≥15)`);

  // level-up banking: banked during the fight, resolved at the clear
  const ls = new Sim({ seed: 13, party: [{ idx: 0, key: 'k', name: 'L', charId: 'redmaw', color: '#fff' }] });
  ls.uiAction(0, { kind: 'pickNode', nodeId: ls.reachableNodes()[0] });
  const lp = ls.players[0];
  ls._collectMaterial(lp, 100); // banks several level-ups mid-fight
  if (lp.banked > 0 && !lp.pendingOffer) ok('level-ups bank during the fight (no mid-combat offer)');
  else fail(`banking: banked=${lp.banked} pending=${!!lp.pendingOffer}`);
  ls.wave.done = true; ls.spawnQueue.length = 0;
  for (const e of [...ls.enemyPool]) ls.enemyPool.release(e);
  for (let i = 0; i < 30 && !lp.pendingOffer; i++) ls.tick();
  if (lp.pendingOffer) ok('banked level-ups resolve at the fight clear');
  else fail('no offer surfaced at clear');
} catch (err) { fail('per-fight trigger tests crashed', err); }

// ---- 7. all five arena templates spawn, fight, and clear ----
for (const template of TEMPLATE_KEYS) {
  try {
    const sim = new Sim({ seed: 77, party: [{ idx: 0, key: 'k', name: 'T', charId: 'bulwark', color: '#fff' }] });
    sim._travelTo(sim.reachableNodes()[0]); // enter, then re-enter with the wanted template
    sim.arenaNode.template = template;
    sim._enterArena(sim.arenaNode);
    let spawned = 0;
    for (let i = 0; i < 60 * 12; i++) { sim.tick(); spawned = Math.max(spawned, sim.enemyPool.count); }
    if (spawned === 0) { fail(`${template}: nothing spawned`); continue; }
    // players/enemies never inside obstacles
    let clip = 0;
    for (const e of sim.enemyPool) if (sim._inObstacle(e.x, e.y, -2)) clip++;
    if (clip > 0) fail(`${template}: ${clip} enemies inside obstacles`);
    clearArena(sim, false);
    if (sim.phase === 'map') ok(`arena template ${template}: spawns, fights, clears, extracts (peak ${spawned})`);
    else fail(`${template}: never cleared`);
  } catch (err) { fail(`arena template ${template} crashed`, err); }
}

// ---- 7b. extraction consent: countdown starts on the portal, cancels off it ----
try {
  const sim = new Sim({ seed: 21, party: [{ idx: 0, key: 'k', name: 'E', charId: 'rampart', color: '#fff' }] });
  sim.uiAction(0, { kind: 'pickNode', nodeId: sim.reachableNodes()[0] });
  const p = sim.players[0];
  sim.wave.done = true; sim.spawnQueue.length = 0;
  for (const e of [...sim.enemyPool]) sim.enemyPool.release(e);
  for (let i = 0; i < 30 && !sim.cleared; i++) sim.tick();
  drain(sim, p, false);
  p.x = sim.hatch.x; p.y = sim.hatch.y;
  for (let i = 0; i < 30; i++) sim.tick();
  if (sim.extract && sim.extract.t < 4) ok('extraction countdown starts while standing on the portal');
  else fail(`extract state: ${JSON.stringify(sim.extract)}`);
  p.x = sim.hatch.x + 300; p.y = sim.hatch.y;
  for (let i = 0; i < 10; i++) sim.tick();
  if (!sim.extract) ok('stepping off the portal cancels the countdown'); else fail('countdown survived leaving the portal');
} catch (err) { fail('extraction consent crashed', err); }

// ---- 7c. the party never spawns inside arena architecture ----
// (cramped layouts can run walls through the exact midpoint — spawns must nudge off)
try {
  let clip = 0;
  const party4 = ['bulwark', 'wisp', 'cogsmith', 'voltaic'].map((c, i) => ({ idx: i, key: 'k' + i, name: 'S' + i, charId: c, color: '#fff' }));
  for (let seed = 1; seed <= 25; seed++) {
    const s = new Sim({ seed: seed * 31, party: party4 });
    const node = s.floor.nodes.find(n => n.kind === 'combat');
    for (const template of TEMPLATE_KEYS) {
      node.template = template;
      s._travelTo(node.id);
      for (const p of s.players) if (s._inObstacle(p.x, p.y, p.radius)) { clip++; fail(`seed ${seed * 31} ${template}: player spawned inside an obstacle at ${Math.round(p.x)},${Math.round(p.y)}`); }
      s.phase = 'map';
    }
  }
  for (let f = 1; f <= 4; f++) { // the bespoke siege arenas too
    const s = new Sim({ seed: 5, party: party4 });
    while (s.floorNum < f) s.debug('F4');
    s._travelTo(s.floor.siegeId);
    for (const p of s.players) if (s._inObstacle(p.x, p.y, p.radius)) { clip++; fail(`floor ${f} siege: player spawned inside an obstacle`); }
  }
  if (!clip) ok('party spawns clear of obstacles (25 seeds × 5 templates + all 4 sieges)');
} catch (err) { fail('spawn-clip check crashed', err); }

// ---- 8. the Siege end-to-end ----
try {
  const party = [
    { idx: 0, key: 'a', name: 'A', charId: 'bulwark', color: '#fff' },
    { idx: 1, key: 'b', name: 'B', charId: 'redmaw', color: '#fff' }];
  const sim = new Sim({ seed: 31, party });
  sim.god = true;
  const p = sim.players[0];
  sim._travelTo(sim.floor.siegeId); // jump straight to the finale
  if (sim.arenaNode.kind !== 'siege') throw new Error('not in siege');
  const obst0 = sim.obstacles.length;
  // down player 1: the first mutation must revive them (mercy rule)
  const p1 = sim.players[1];
  sim.god = false;
  let g = 0;
  while (!p1.downed && g++ < 90) { p1.invuln = 0; p1.stats.reflex = 0; p1.hp = 1; sim.hurtPlayer(p1, 9999, null); }
  sim.god = true;
  if (!p1.downed) fail('could not down the siege test partner');
  const events = [];
  let peak = 0, ticks = 0, revivedByMutation = false, sawPylonBuff = false;
  while (sim.phase === 'arena' && !sim.over && ticks++ < 60 * 260) {
    sim.tick();
    peak = Math.max(peak, sim.enemyPool.count);
    for (const ev of sim.events.splice(0)) {
      if (ev.k === 'mutation') {
        events.push(ev.kind);
        if (!p1.downed) revivedByMutation = true;
      }
      if (ev.k === 'bossSpawn') events.push('boss');
      if (ev.k === 'bossDown') events.push('bossDown');
    }
    if (sim.enemyBuff > 1) sawPylonBuff = true;
    if (ticks % 200 === 0) nuke(sim, p, true);
    if (sim.boss) sim.damageEnemy(sim.boss, 90, { owner: p });
    for (const q of sim.players) drain(sim, q, false);
    if (sim.cleared && sim.hatch) for (const q of sim.livePlayers()) { q.x = sim.hatch.x; q.y = sim.hatch.y; }
  }
  const mutations = events.filter(e => e !== 'boss' && e !== 'bossDown');
  if (mutations.length === SIEGES[0].mutations.length) ok(`siege mutation schedule fired (${mutations.join(' → ')})`);
  else fail(`mutations fired: ${mutations.join(',')}`);
  if (mutations.includes('collapse') && sim.obstacles.length < obst0) ok(`wall collapse removed obstacles (${obst0} → ${sim.obstacles.length})`);
  else fail('collapse did not remove walls');
  if (sawPylonBuff) ok('ward pylon buffed enemies while it stood'); else fail('pylon buff never observed');
  if (revivedByMutation) ok('mutation revived the downed player (mercy rule)'); else fail('mercy revive did not fire');
  if (events.includes('boss') && events.indexOf('boss') > events.indexOf(mutations[mutations.length - 1])) ok('the floor boss entered mid-siege after the final mutation');
  else fail(`boss entry ordering: ${events.join(',')}`);
  if (events.includes('bossDown') && sim.floorNum === 2) ok(`siege victory paid out and descended (peak alive ${peak})`);
  else fail(`siege end: floor ${sim.floorNum}, events ${events.join(',')}`);
} catch (err) { fail('siege end-to-end crashed', err); }

// ---- 8b. hold-circle chokes spawns; hazard field migrates (floor 3 / floor 2) ----
try {
  const sim = new Sim({ seed: 33, party: [{ idx: 0, key: 'k', name: 'H', charId: 'bulwark', color: '#fff' }] });
  sim.god = true;
  while (sim.floorNum < 3) sim.debug('F4');
  sim._travelTo(sim.floor.siegeId);
  const p = sim.players[0];
  // fast-forward to the circle mutation
  while (sim.mutIdx < 1) { sim.siegeT = sim.mutations[0].at; sim.tick(); }
  if (!sim.holdCircle) throw new Error('no hold circle after mutation');
  // uncontested: normal rate; contested: choked
  p.x = sim.holdCircle.x + 900; p.y = sim.holdCircle.y;
  sim.tick();
  const rateFree = !sim.holdCircle.held;
  p.x = sim.holdCircle.x; p.y = sim.holdCircle.y;
  sim.tick();
  if (rateFree && sim.holdCircle.held) ok('hold circle: contested state tracks the players');
  else fail(`hold circle held states: free=${!rateFree} held=${sim.holdCircle.held}`);

  const s2 = new Sim({ seed: 34, party: [{ idx: 0, key: 'k', name: 'H2', charId: 'bulwark', color: '#fff' }] });
  s2.god = true;
  s2.debug('F4');
  s2._travelTo(s2.floor.siegeId);
  while (s2.mutIdx < 2) { s2.siegeT = s2.mutations[Math.min(s2.mutIdx, 1)].at; s2.tick(); }
  const field = s2.hazards.find(h => h.vx !== undefined);
  if (!field) throw new Error('no migrating field');
  const x0 = field.x;
  for (let i = 0; i < 60 * 5; i++) s2.tick();
  if (field.x > x0 + 100) ok(`hazard field migrates across the arena (${Math.round(x0)} → ${Math.round(field.x)})`);
  else fail(`hazard field static: ${x0} → ${field.x}`);
} catch (err) { fail('sub-objective tests crashed', err); }

// ---- 9. co-op: downs, revives, wipe ----
try {
  const party = ['bulwark', 'wisp', 'cogsmith', 'voltaic'].map((c, i) => ({ idx: i, key: 'k' + i, name: 'P' + i, charId: c, color: '#fff' }));
  const sim = new Sim({ seed: 777, party });
  sim.debug('F2');
  playFloor(sim, true);
  if (sim.over) fail('coop wiped unexpectedly on floor 1');
  else ok('4-player co-op clears floor 1 through the node map');
  // enter a fight for revive mechanics
  if (sim.phase === 'map') {
    for (const q of sim.players) drain(sim, q, false);
    sim.uiAction(0, { kind: 'pickNode', nodeId: sim.reachableNodes()[0] });
    let g = 0;
    while (sim.phase === 'map' && g++ < 6) { for (const q of sim.players) drain(sim, q, false); sim.uiAction(0, { kind: 'pickNode', nodeId: sim.reachableNodes()[0] }); }
    for (let i = 0; i < 60 * 5 && sim.phase === 'map'; i++) sim.tick(); // vote countdown
  }
  const p1 = sim.players[1];
  let gDown = 0;
  while (!p1.downed && gDown++ < 90) { p1.hp = Math.min(p1.hp, 1); p1.invuln = 0; p1.stats.reflex = 0; sim.hurtPlayer(p1, 999, null); }
  if (!p1.downed) fail('repeated hurtPlayer(999) did not down the target');
  sim.players[0].x = p1.x; sim.players[0].y = p1.y;
  for (let i = 0; i < 60 * 4; i++) sim.tick();
  if (p1.downed) fail('revive by proximity failed after 4s');
  else ok('down + proximity revive works');
  for (const p of sim.players) {
    let g = 0;
    while (!p.downed && !sim.over && g++ < 90) { p.invuln = 0; p.stats.reflex = 0; p.hp = Math.min(p.hp, 1); sim.hurtPlayer(p, 9999, null); }
  }
  if (sim.over && sim.result && !sim.result.win) ok('full wipe ends run with loss results');
  else fail('wipe did not end the run');
} catch (err) { fail('coop run crashed', err); }

// ---- 9b. build management (host-validated) ----
try {
  const { sellValue, weaponBasePrice } = await import('../js/config.js');
  const { WEAPON_BY_ID } = await import('../js/content/weapons.js');
  const sim = new Sim({ seed: 31337, party: [{ idx: 0, key: 'k', name: 'MGMT', charId: 'redmaw', color: '#fff' }] });
  const p = sim.players[0];
  sim._addWeapon(p, 'coilgun', 1);
  sim._addWeapon(p, 'coilgun', 1);
  const slots0 = p.weapons.length;
  sim.uiAction(0, { kind: 'combine', a: 1, b: 2, id: 'coilgun', tier: 1 });
  const cg = p.weapons.filter(w => w.id === 'coilgun');
  if (cg.length === 1 && cg[0].tier === 2 && p.weapons.length === slots0 - 1) ok('combine merges pair → tier II and frees a slot');
  else fail(`combine result wrong: ${JSON.stringify(p.weapons)}`);
  const mats0 = p.materials;
  const slot = p.weapons.findIndex(w => w.id === 'coilgun');
  const expect = sellValue(weaponBasePrice(WEAPON_BY_ID.coilgun, 2), sim.floorNum);
  sim.uiAction(0, { kind: 'sellWeapon', slot, id: 'coilgun', tier: 2 });
  if (p.materials === mats0 + expect && !p.weapons.some(w => w.id === 'coilgun')) ok(`sell weapon refunds 30% (+${expect})`);
  else fail(`sell weapon: mats ${mats0}→${p.materials}`);
  // Quartermaster invested lineage
  const qsim = new Sim({ seed: 555, party: [{ idx: 0, key: 'k', name: 'QM', charId: 'quartermaster', color: '#fff' }] });
  const qp = qsim.players[0];
  qsim._addWeapon(qp, 'pebbleshot', 1, 30);
  qsim._addWeapon(qp, 'pebbleshot', 1, 40);
  const pi = qp.weapons.map((w, i) => w.id === 'pebbleshot' ? i : -1).filter(i => i >= 0);
  qsim.uiAction(0, { kind: 'combine', a: pi[0], b: pi[1], id: 'pebbleshot', tier: 1 });
  const merged = qp.weapons.find(w => w.id === 'pebbleshot');
  const qmats = qp.materials;
  qsim.uiAction(0, { kind: 'sellWeapon', slot: qp.weapons.indexOf(merged), id: 'pebbleshot', tier: 2 });
  if (qp.materials === qmats + 70) ok('Quartermaster sells for exact invested materials (70)');
  else fail(`Quartermaster sell: +${qp.materials - qmats}`);
} catch (err) { fail('build management crashed', err); }

// ---- 9c. rebalance mechanics still hold ----
try {
  const rsim = new Sim({ seed: 43, party: [{ idx: 0, key: 'k', name: 'R', charId: 'rampart', color: '#fff' }] });
  const rp = rsim.players[0];
  rp.hp = 10;
  rsim._heal(rp, 10);
  const gained0 = rp.hp - 10;
  rp.boosts.recovery = 100; rsim._recomputeStats(rp);
  rp.hp = 10; rp.healAcc = 0;
  rsim._heal(rp, 10);
  if (gained0 === 10 && rp.hp - 10 === 20) ok('Recovery amplifies healing (+100% → double heal)');
  else fail(`Recovery healing: ${gained0} / ${rp.hp - 10}`);

  const bsim = new Sim({ seed: 44, party: [
    { idx: 0, key: 'a', name: 'L', charId: 'lodestone', color: '#fff' },
    { idx: 1, key: 'b', name: 'M', charId: 'rampart', color: '#fff' }] });
  bsim._travelTo(bsim.reachableNodes()[0]);
  const [lp, mp] = bsim.players;
  lp.invuln = 0; mp.invuln = 0;
  const lHp = lp.hp, mHp = mp.hp;
  lp.stats.reflex = 0;
  bsim.hurtPlayer(lp, 30, null);
  if (lp.hp < lHp && mp.hp < mHp) ok('Soulbond: partner soaks a share of incoming damage');
  else fail(`Soulbond share: ${lHp}→${lp.hp}, ${mHp}→${mp.hp}`);
} catch (err) { fail('rebalance mechanics crashed', err); }

// ---- 9d. patch 8: shop economy — cadence, guarantees, auto-combine, swaps ----
try {
  const { ITEM_BY_ID } = await import('../js/content/items.js');
  const { CONFIG } = await import('../js/config.js');
  const rarePlus = s => s.kind === 'item' && ['rare', 'legendary'].includes(ITEM_BY_ID[s.id].rarity);

  // shop at every extraction: clearing a combat node opens each player's shop
  const es = new Sim({ seed: 71, party: [
    { idx: 0, key: 'a', name: 'A', charId: 'bulwark', color: '#fff' },
    { idx: 1, key: 'b', name: 'B', charId: 'redmaw', color: '#fff' }] });
  es._travelTo(es.reachableNodes()[0]);
  es.wave.done = true; es.spawnQueue.length = 0;
  for (const e of [...es.enemyPool]) es.enemyPool.release(e);
  for (let i = 0; i < 60 * 5 && !es.cleared; i++) es.tick(); // co-op vote... none needed; F3-less clear
  if (es.cleared && es.players.every(q => q.shop && /:clear:/.test(q.shop.key))) ok('extraction shop opens per player at the fight clear');
  else fail(`extraction shop: cleared=${es.cleared} shops=${es.players.map(q => q.shop && q.shop.key)}`);
  const ep = es.players[0];
  ep.materials = 500;
  const w0 = ep.shop.stock.findIndex(s => s.kind === 'weapon' && !s.sold);
  es.uiAction(0, { kind: 'buy', slot: w0 });
  if (ep.weapons.length === 2) ok('buying at the extraction shop works'); else fail('extraction shop buy failed');
  es.uiAction(0, { kind: 'lock', slot: (w0 + 1) % ep.shop.stock.length });
  const lockedId = ep.shop.stock[(w0 + 1) % ep.shop.stock.length].id;
  es.uiAction(0, { kind: 'reroll' });
  if (ep.shop.stock.some(s => s.locked && s.id === lockedId)) ok('lock + reroll work at the extraction shop');
  else fail('lock did not survive extraction-shop reroll');
  // the lock carries into the NEXT shop (the Black Market)
  es._finishNode();
  es._travelTo(es.floor.nodes.find(n => n.kind === 'shop').id);
  if (ep.shop.black && ep.shop.stock.some(s => s.locked && s.id === lockedId)) ok('locks carry from the extraction shop into the Black Market');
  else fail(`lock carry: black=${ep.shop.black} stock=${ep.shop.stock.map(s => s.id + (s.locked ? '🔒' : ''))}`);

  // 100 seeded rolls incl. rerolls: standard ≥1 weapon (≥2 floor 1); BM ≥2 + rare+ + 6 slots + cheaper rerolls
  let rollBad = 0;
  for (let seed = 1; seed <= 100 && rollBad < 5; seed++) {
    const s1 = new Sim({ seed: seed * 7919, party: [{ idx: 0, key: 'k', name: 'S', charId: 'bulwark', color: '#fff' }] });
    const p1 = s1.players[0];
    p1.materials = 10000;
    for (let f = 1; f <= 2; f++) {
      if (f === 2) s1.debug('F4');
      s1.currentNode = s1.floor.nodes.find(n => n.kind === 'combat').id;
      s1._openShop(p1, 'clear');
      const needW = f === 1 ? 2 : 1;
      for (let r = 0; r < 3; r++) {
        const w = p1.shop.stock.filter(s => s.kind === 'weapon').length;
        if (w < needW) { rollBad++; fail(`seed ${seed * 7919} floor ${f} standard roll ${r}: ${w} weapons (< ${needW})`); }
        s1.uiAction(0, { kind: 'reroll' });
      }
      s1._travelTo(s1.floor.nodes.find(n => n.kind === 'shop').id);
      for (let r = 0; r < 3; r++) {
        const st = p1.shop.stock;
        if (st.length !== 6) { rollBad++; fail(`seed ${seed * 7919} floor ${f} BM roll ${r}: ${st.length} slots`); }
        if (st.filter(s => s.kind === 'weapon').length < 2) { rollBad++; fail(`seed ${seed * 7919} floor ${f} BM roll ${r}: <2 weapons`); }
        if (!st.some(rarePlus)) { rollBad++; fail(`seed ${seed * 7919} floor ${f} BM roll ${r}: no rare+ item`); }
        s1.uiAction(0, { kind: 'reroll' });
      }
      s1.phase = 'map';
    }
  }
  if (!rollBad) ok('100 seeded shop rolls × rerolls: standard ≥1 weapon (≥2 floor 1); Black Market 6 slots, ≥2 weapons, ≥1 rare+');
  // BM reroll discount: fresh sims, same reroll count
  {
    const a = new Sim({ seed: 3, party: [{ idx: 0, key: 'k', name: 'X', charId: 'bulwark', color: '#fff' }] });
    const pa = a.players[0];
    a.currentNode = 0; a._openShop(pa, 'clear');
    const std = a._rerollCost(pa);
    a._travelTo(a.floor.nodes.find(n => n.kind === 'shop').id);
    const bm = a._rerollCost(pa);
    if (bm === Math.round(std * 0.75)) ok(`Black Market rerolls cost −25% (${std} → ${bm})`);
    else fail(`BM reroll cost ${bm} vs standard ${std}`);
  }

  // full-slot duplicate purchase auto-combines — at 6/6, Broker's 5/5, Tinker's 4/4
  for (const [charId, wantCap] of [['bulwark', 6], ['broker', 5], ['tinker', 4]]) {
    const cs = new Sim({ seed: 11, party: [{ idx: 0, key: 'k', name: 'C', charId, color: '#fff' }] });
    const cp = cs.players[0];
    if (cp.weaponSlots !== wantCap) { fail(`${charId} weapon cap ${cp.weaponSlots} (want ${wantCap})`); continue; }
    cp.materials = 500;
    cs.currentNode = 0; cs._openShop(cp, 'clear');
    while (cp.weapons.length < cp.weaponSlots - 1) cs._addWeapon(cp, 'pebbleshot', 1);
    cs._addWeapon(cp, 'coilgun', 2);
    cp.shop.stock[0] = { kind: 'weapon', id: 'coilgun', tier: 2, price: 40, sold: false, locked: false };
    const m0 = cp.materials;
    cs.uiAction(0, { kind: 'buy', slot: 0 });
    const cg = cp.weapons.find(w => w.id === 'coilgun');
    if (cp.weapons.length === wantCap && cg && cg.tier === 3 && cp.materials === m0 - 40 && cp.shop.stock[0].sold)
      ok(`auto-combine at ${wantCap}/${wantCap} (${charId}): copy bought → tier III in place, charged once`);
    else fail(`${charId} auto-combine: n=${cp.weapons.length} tier=${cg && cg.tier} mats ${m0}→${cp.materials}`);
    // tier-IV match is refused with a reason, not silently
    cg.tier = 4;
    cp.shop.stock[1] = { kind: 'weapon', id: 'coilgun', tier: 4, price: 40, sold: false, locked: false };
    cs.events.length = 0;
    cs.uiAction(0, { kind: 'buy', slot: 1 });
    const br = cs.events.find(e => e.k === 'buyResult');
    if (br && !br.ok && /tier IV/.test(br.reason)) { if (charId === 'bulwark') ok('tier-IV match refuses with a shown reason'); }
    else fail(`${charId} T4 refusal: ${JSON.stringify(br)}`);
  }
  // below max slots a duplicate still adds a copy (manual combine stays a choice)
  {
    const ds = new Sim({ seed: 12, party: [{ idx: 0, key: 'k', name: 'D', charId: 'bulwark', color: '#fff' }] });
    const dp = ds.players[0];
    dp.materials = 500;
    ds.currentNode = 0; ds._openShop(dp, 'clear');
    ds._addWeapon(dp, 'coilgun', 1);
    dp.shop.stock[0] = { kind: 'weapon', id: 'coilgun', tier: 1, price: 30, sold: false, locked: false };
    ds.uiAction(0, { kind: 'buy', slot: 0 });
    const pair = dp.weapons.filter(w => w.id === 'coilgun');
    if (pair.length === 2 && pair.every(w => w.tier === 1)) ok('below max slots a duplicate purchase still adds a copy');
    else fail(`below-max duplicate: ${JSON.stringify(dp.weapons)}`);
    ds.uiAction(0, { kind: 'combine', a: dp.weapons.indexOf(pair[0]), b: dp.weapons.indexOf(pair[1]), id: 'coilgun', tier: 1 });
    if (dp.weapons.filter(w => w.id === 'coilgun').length === 1) ok('manual combine still works below max');
    else fail('manual combine broke');
  }

  // Quartermaster: all-weapon stock everywhere, invested-cost sell unchanged
  {
    const qs = new Sim({ seed: 13, party: [{ idx: 0, key: 'k', name: 'Q', charId: 'quartermaster', color: '#fff' }] });
    const qp = qs.players[0];
    qp.materials = 5000;
    qs.currentNode = 0; qs._openShop(qp, 'clear');
    let allW = qp.shop.stock.every(s => s.kind === 'weapon');
    qs.uiAction(0, { kind: 'reroll' });
    allW = allW && qp.shop.stock.every(s => s.kind === 'weapon');
    qs._travelTo(qs.floor.nodes.find(n => n.kind === 'shop').id);
    allW = allW && qp.shop.stock.every(s => s.kind === 'weapon') && qp.shop.stock.length === 6;
    if (allW) ok('Quartermaster stock is all weapons (standard + reroll + 6-slot Black Market)');
    else fail(`QM stock: ${qp.shop.stock.map(s => s.kind)}`);
  }

  // atomic swap-buy: both legs or neither; insufficient funds rejected cleanly
  {
    const ss = new Sim({ seed: 14, party: [{ idx: 0, key: 'k', name: 'W', charId: 'bulwark', color: '#fff' }] });
    const sp = ss.players[0];
    ss.currentNode = 0; ss._openShop(sp, 'clear');
    while (sp.weapons.length < sp.weaponSlots) ss._addWeapon(sp, 'pebbleshot', 1);
    sp.shop.stock[0] = { kind: 'weapon', id: 'rustcleaver', tier: 1, price: 30, sold: false, locked: false };
    sp.materials = 28; // can't afford outright — the refund covers the difference
    ss.uiAction(0, { kind: 'swapBuy', slot: 0, sell: 0, sellId: sp.weapons[0].id, sellTier: sp.weapons[0].tier });
    if (sp.weapons.length === sp.weaponSlots && sp.weapons.some(w => w.id === 'rustcleaver') && sp.shop.stock[0].sold)
      ok(`swap-buy executes atomically (refund funds the purchase, still ${sp.weaponSlots}/${sp.weaponSlots})`);
    else fail(`swap: ${JSON.stringify(sp.weapons.map(w => w.id))} mats=${sp.materials}`);
    // rejection: price beyond refund+mats leaves EVERYTHING untouched
    sp.materials = 0;
    sp.shop.stock[1] = { kind: 'weapon', id: 'longbarrel', tier: 4, price: 900, sold: false, locked: false };
    const snap = JSON.stringify([sp.weapons.map(w => [w.id, w.tier]), sp.materials]);
    ss.events.length = 0;
    ss.uiAction(0, { kind: 'swapBuy', slot: 1, sell: 0, sellId: sp.weapons[0].id, sellTier: sp.weapons[0].tier });
    const rbr = ss.events.find(e => e.k === 'buyResult');
    if (snap === JSON.stringify([sp.weapons.map(w => [w.id, w.tier]), sp.materials]) && !sp.shop.stock[1].sold && rbr && !rbr.ok)
      ok('unaffordable swap is rejected with both legs rolled back');
    else fail('poor swap mutated state');
  }

  // the two difficulty knobs: HP spot-checks and the ~1.25× density ratio
  {
    const hs = new Sim({ seed: 15, party: [{ idx: 0, key: 'k', name: 'H', charId: 'bulwark', color: '#fff' }] });
    hs._travelTo(hs.reachableNodes()[0]);
    const { ENEMY_BY_ID } = await import('../js/content/enemies.js');
    const chaff = hs.spawnEnemyById('skulker', 400, 400, {});
    const elite = hs.spawnEnemyById('lobber', 500, 500, { elite: true, mod: { key: 'none' } });
    const wantChaff = Math.round(ENEMY_BY_ID.skulker.hp * CONFIG.enemyHpMult);
    const wantElite = Math.round(ENEMY_BY_ID.lobber.hp * CONFIG.ELITE_HP_MULT * CONFIG.enemyHpMult);
    const okChaff = chaff.maxHp === wantChaff, okElite = elite.maxHp === wantElite;
    // boss: use the floor-1 siege boss
    const bs = new Sim({ seed: 16, party: [{ idx: 0, key: 'k', name: 'B', charId: 'bulwark', color: '#fff' }] });
    bs._travelTo(bs.floor.siegeId);
    bs.siegeT = bs.bossAt; bs.tick();
    const { BOSS_BY_FLOOR } = await import('../js/content/bosses.js');
    const okBoss = bs.boss && bs.boss.maxHp === Math.round(BOSS_BY_FLOOR[1].hp * CONFIG.enemyHpMult);
    if (okChaff && okElite && okBoss) ok(`enemyHpMult ${CONFIG.enemyHpMult} applies to chaff (${wantChaff}), elite (${wantElite}), boss (${bs.boss.maxHp})`);
    else fail(`hp spot checks: chaff ${chaff.maxHp}/${wantChaff} elite ${elite.maxHp}/${wantElite} boss ${bs.boss && bs.boss.maxHp}`);
    // density: identical no-kill fight with the knob on vs off. Count spawn
    // EVENTS (a contact-damage or armed character would cull the field and
    // flatten the ratio); redmaw with no weapons kills nothing.
    const countSpawns = () => {
      const d = new Sim({ seed: 17, party: [{ idx: 0, key: 'k', name: 'D', charId: 'redmaw', color: '#fff' }] });
      d._travelTo(d.reachableNodes()[0]);
      d.god = true;
      d.players[0].weapons.length = 0;
      let n = 0;
      const orig = d.spawnEnemyById.bind(d);
      d.spawnEnemyById = (...a) => { const e = orig(...a); if (e) n++; return e; };
      for (let i = 0; i < 60 * 50; i++) d.tick();
      return n;
    };
    const withKnob = countSpawns();
    const saved = CONFIG.spawnBudgetMult;
    CONFIG.spawnBudgetMult = 1;
    const baseline = countSpawns();
    CONFIG.spawnBudgetMult = saved;
    const ratio = withKnob / Math.max(1, baseline);
    if (ratio > 1.1 && ratio < 1.45) ok(`spawnBudgetMult density ratio ≈ ${ratio.toFixed(2)}× (${baseline} → ${withKnob} spawned in 50s)`);
    else fail(`density ratio ${ratio.toFixed(2)} (${baseline} → ${withKnob})`);
  }
} catch (err) { fail('shop economy tests crashed', err); }

// ---- 9e. patch 8.1: the Gilded One rescue — finest-goods stock + Kegbomb ----
try {
  const { ITEM_BY_ID } = await import('../js/content/items.js');
  const finest = (sim, s) => s.kind === 'weapon' ? s.tier === sim._topTier()
    : ITEM_BY_ID[s.id].rarity === 'legendary';

  // starts with the Kegbomb (Greed-scaled — its own statline powers it)
  const ks = new Sim({ seed: 61, party: [{ idx: 0, key: 'k', name: 'G', charId: 'gilded_one', color: '#fff' }] });
  if (ks.players[0].weapons[0].id === 'kegbomb') ok('Gilded One starts with the Kegbomb');
  else fail(`starting weapon: ${ks.players[0].weapons[0].id}`);

  // stock rule across floors and 30 seeds: every slot is a legendary item or
  // a top-tier weapon; 2 slots standard, 3 at the Black Market; rerolls too
  let bad = 0, sawWeapon = 0;
  for (let seed = 1; seed <= 30 && bad < 5; seed++) {
    const gs = new Sim({ seed: seed * 101, party: [{ idx: 0, key: 'k', name: 'G', charId: 'gilded_one', color: '#fff' }] });
    const gp = gs.players[0];
    gp.materials = 9999;
    for (let f = 1; f <= 3; f++) {
      if (f > 1) gs.debug('F4');
      gs.currentNode = 0; gs._openShop(gp, 'clear');
      for (let r = 0; r < 2; r++) {
        if (gp.shop.stock.length !== 2) { bad++; fail(`seed ${seed * 101} f${f}: std slots ${gp.shop.stock.length}`); }
        for (const s of gp.shop.stock) {
          if (!finest(gs, s)) { bad++; fail(`seed ${seed * 101} f${f}: not finest — ${s.kind}:${s.id}/T${s.tier}`); }
          if (s.kind === 'weapon') sawWeapon++;
        }
        gs.uiAction(0, { kind: 'reroll' });
      }
      gs._travelTo(gs.floor.nodes.find(n => n.kind === 'shop').id);
      if (gp.shop.stock.length !== 3) { bad++; fail(`seed ${seed * 101} f${f}: BM slots ${gp.shop.stock.length}`); }
      for (const s of gp.shop.stock) if (!finest(gs, s)) { bad++; fail(`seed ${seed * 101} f${f} BM: ${s.kind}:${s.id}`); }
      gs.phase = 'map';
    }
  }
  if (!bad) ok(`Gilded One stock: only legendary items / top-tier weapons, 2 std + 3 BM slots (30 seeds × 3 floors; ${sawWeapon} weapon offers seen)`);
  if (sawWeapon > 20) ok('the finest-goods rack participates in the weapon economy'); else fail(`only ${sawWeapon} weapon offers across the sweep`);

  // auto-combine, swap, and locks against the 2-slot trait stock
  const cs = new Sim({ seed: 62, party: [{ idx: 0, key: 'k', name: 'G', charId: 'gilded_one', color: '#fff' }] });
  const cp = cs.players[0];
  cp.materials = 2000;
  cs.currentNode = 0; cs._openShop(cp, 'clear');
  while (cp.weapons.length < cp.weaponSlots) cs._addWeapon(cp, 'kegbomb', 2);
  cp.shop.stock[0] = { kind: 'weapon', id: 'kegbomb', tier: 2, price: 60, sold: false, locked: false };
  cs.uiAction(0, { kind: 'buy', slot: 0 });
  // the starting Kegbomb is tier I — the first TIER-II copy absorbs the buy
  if (cp.weapons.some(w => w.id === 'kegbomb' && w.tier === 3) && cp.weapons.length === cp.weaponSlots)
    ok('auto-combine works on the 2-slot trait stock');
  else fail(`gilded auto-combine: ${JSON.stringify(cp.weapons.map(w => [w.id, w.tier]))}`);
  cp.shop.stock[1] = { kind: 'weapon', id: 'longbarrel', tier: 2, price: 60, sold: false, locked: false };
  cs.uiAction(0, { kind: 'swapBuy', slot: 1, sell: 5, sellId: cp.weapons[5].id, sellTier: cp.weapons[5].tier });
  if (cp.weapons.some(w => w.id === 'longbarrel') && cp.weapons.length === cp.weaponSlots) ok('make-room swap works on the trait stock');
  else fail('gilded swap failed');
  cs.uiAction(0, { kind: 'reroll' }); // fresh unsold stock, then lock through a reroll
  cs.uiAction(0, { kind: 'lock', slot: 0 });
  const lockedId2 = cp.shop.stock[0].id;
  cs.uiAction(0, { kind: 'reroll' });
  if (cp.shop.stock.some(s => s.locked && s.id === lockedId2) && cp.shop.stock.length === 2) ok('locks survive rerolls in the 2-slot stock');
  else fail(`gilded lock: ${JSON.stringify(cp.shop.stock.map(s => s.id + (s.locked ? '🔒' : '')))}`);
} catch (err) { fail('Gilded One rescue tests crashed', err); }

// ---- 10. DPS gate: ±40% of the roster median at floor-1 baseline ----
function measureDps(charId) {
  const sim = new Sim({ seed: 9999, party: [{ idx: 0, key: 'k', name: 'DPS', charId, color: '#fff' }] });
  sim.god = true;
  // an open arena, wave silenced — pure baseline weapon output
  const fight = sim.floor.nodes.find(n => n.kind === 'combat');
  fight.template = 'open_expanse';
  sim._travelTo(fight.id);
  sim.wave.done = true; sim.spawnQueue.length = 0;
  for (const e of [...sim.enemyPool]) sim.enemyPool.release(e);
  const p = sim.players[0];
  const cx = sim.W / 2, cy = sim.H / 2;
  p.x = cx; p.y = cy;
  const dummies = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const e = sim.spawnEnemyById('slabjaw', cx + Math.cos(a) * 90, cy + Math.sin(a) * 90, { noMats: true });
    e.hp = 1e9; e.maxHp = 2e9; e.spd = 0; e.dmg = 0;
    dummies.push({ e, x: e.x, y: e.y });
  }
  for (let t = 0; t < 1200; t++) {
    p.x = cx; p.y = cy;
    for (const d of dummies) { d.e.x = d.x; d.e.y = d.y; d.e.knockX = d.e.knockY = 0; d.e.hp = 1e9; }
    sim.tick();
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  }
  return p.damageDealt / 20;
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
  else fail(`DPS gate: ${outliers} outlier(s)`);
} catch (err) { fail('DPS harness crashed', err); }

// ---- 11. stress: siege crest density, tick-time measurement ----
try {
  const sim = new Sim({ seed: 99, party: [{ idx: 0, key: 'k', name: 'STRESS', charId: 'threader', color: '#fff' }] });
  sim.god = true;
  while (sim.floorNum < 4) sim.debug('F4');
  sim._travelTo(sim.floor.siegeId);
  const p = sim.players[0];
  p.weapons.length = 0; sim.summons.length = 0; // let the siege pile up
  for (let t = 0; t < 60 * 130; t++) { sim.tick(); drain(sim, p, false); }
  const alive0 = sim.enemyPool.count;
  for (const id of ['coilgun', 'hailburst', 'gravelmouth', 'sparkbolt', 'threadneedle']) sim._addWeapon(p, id, 4);
  const t0 = performance.now();
  const TICKS = 600;
  for (let i = 0; i < TICKS; i++) sim.tick();
  const ms = (performance.now() - t0) / TICKS;
  ok(`siege stress: ${alive0}→${sim.enemyPool.count} alive, ${sim.projPool.count} projectiles, avg tick ${ms.toFixed(3)} ms (60fps budget 16.6ms)`);
  if (alive0 < 150) fail(`siege crest only ${alive0} alive (<150)`);
  if (ms > 8) fail(`tick too slow under stress: ${ms.toFixed(2)} ms`);
  const snap = JSON.stringify(sim.getSnapshot());
  ok(`snapshot at crest: ${(snap.length / 1024).toFixed(1)} KB (~${(snap.length * 15 / 1024).toFixed(0)} KB/s at 15Hz)`);
} catch (err) { fail('stress test crashed', err); }

// ---- 12. snapshot serializability (with Gauntlet fields) ----
try {
  const sim = new Sim({ seed: 5, party: [
    { idx: 0, key: 'a', name: 'S', charId: 'banneret', color: '#fff' },
    { idx: 1, key: 'b', name: 'T', charId: 'lodestone', color: '#fff' }] });
  // map-phase snapshot with a live vote
  sim.uiAction(0, { kind: 'pickNode', nodeId: sim.reachableNodes()[0] });
  let snap = sim.getSnapshot();
  JSON.parse(JSON.stringify(snap));
  if (snap.mode !== 0 || !snap.vote) fail(`map snapshot: mode=${snap.mode} vote=${JSON.stringify(snap.vote)}`);
  for (let i = 0; i < 60 * 5 && sim.phase === 'map'; i++) sim.tick();
  sim.debug('F1');
  for (let i = 0; i < 90; i++) sim.tick();
  snap = sim.getSnapshot();
  const json = JSON.stringify(snap);
  JSON.parse(json);
  if (!snap.auras.length) fail('snapshot missing Banneret aura');
  if (!snap.tethers.length) fail('snapshot missing Lodestone tether');
  ok(`snapshots serialize in both phases (${json.length} bytes @ ${snap.enemies.length} enemies)`);
} catch (err) { fail('snapshot serialization', err); }

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL SIM TESTS PASSED');
process.exit(failures ? 1 : 0);
