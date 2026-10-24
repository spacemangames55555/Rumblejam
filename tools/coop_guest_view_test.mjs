// Does a co-op GUEST draw the room the host is simulating?
//
// Playtester's two-browser run of PR #136 (seed 424242) had the guest on a
// flat floor with region enemies drawn as plain red circles, while the host
// showed PNW tiles and sprites. Two client-only defects, both invisible to
// every single-page suite because the host builds its view from the Sim:
//
//   1. the floor: `biome` rides the one-shot 'arena' event, and the snapshot's
//      state block (which has no biome, deliberately) replaced app.arena
//      wholesale on the next frame — so the event's biome lived ~66 ms.
//   2. the enemies: the wire's typeIdx indexes ALL_ENEMY_DEFS (ENEMY_INDEX),
//      and the client looked it up in ENEMIES, the base twelve. Every region
//      unit (index 12+) resolved to undefined: shape 'circle', '#e2504c', no
//      sprite.
//
// NODE half: the wire's i8 typeIdx can address every def, and a decoded
// snapshot's typeIdx names the same def the host spawned.
// BROWSER half: two real pages over the local relay, blacksmith hosts and
// wizard joins (the reported pair), then the guest's LAST RENDERED VIEW
// (window.uvLastView) is compared with the host Sim: biome, and per enemy id
// the shape, colour and sprite id. Then the host clears the room and the
// guest's counter must follow.
//
// Usage: node tools/coop_guest_view_test.mjs

import { Sim } from '../js/game.js';
import { ENEMIES, ALL_ENEMY_DEFS, ENEMY_INDEX } from '../js/content/enemies.js';
import { encodeSnap, decodeSnap } from '../js/netcodec.js';
import { Page, bootHttpd, bootRelay, loadPeerjs, sleep, startRun } from './cdp_harness.mjs';

const SEED = 424242;
let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

console.log('--- the wire can name every enemy def ---');
{
  // netcodec packs typeIdx as an i8; -1 is the boss and -2 the pylon
  if (ALL_ENEMY_DEFS.length <= 127) ok(`${ALL_ENEMY_DEFS.length} enemy defs fit the i8 typeIdx (base ${ENEMIES.length} + ${ALL_ENEMY_DEFS.length - ENEMIES.length} region)`);
  else fail(`${ALL_ENEMY_DEFS.length} enemy defs overflow the i8 typeIdx in js/netcodec.js`);
  const bad = Object.entries(ENEMY_INDEX).filter(([id, i]) => ALL_ENEMY_DEFS[i].id !== id);
  if (!bad.length) ok('ENEMY_INDEX is the position in ALL_ENEMY_DEFS for every id');
  else fail(`ENEMY_INDEX disagrees with ALL_ENEMY_DEFS: ${bad.slice(0, 4).map(b => b[0]).join(', ')}`);

  const sim = new Sim({ seed: SEED, party: [
    { idx: 0, key: 'h', name: 'H', charId: 'toh_blacksmith', color: '#fff' },
    { idx: 1, key: 'c', name: 'C', charId: 'toh_wizard', color: '#0ff' },
  ] });
  for (const p of sim.players) if (p.openingOffer && p.openingOffer.length) sim.uiAction(p.idx, { kind: 'opening', id: p.openingOffer[0].id });
  sim.uiAction(0, { kind: 'pickNode', nodeId: sim.reachableNodes()[0] });
  for (let g = 0; sim.phase !== 'arena' && g < 600; g++) sim.tick();
  let region = 0, wrong = [];
  for (let t = 0; t < 600; t++) {
    sim.tick();
    if (t % 30) continue;
    const byId = new Map([...sim.enemyPool].map(e => [e.id, e]));
    for (const w of decodeSnap(encodeSnap(sim.getSnapshot())).enemies) {
      const e = byId.get(w[0]);
      if (!e || e.boss || e.typeIdx === -2) continue;
      if (w[1] >= ENEMIES.length) region++;
      if (ALL_ENEMY_DEFS[w[1]] !== e.def) wrong.push(`${e.def && e.def.id}->${w[1]}`);
    }
  }
  if (!region) fail('no region enemy reached the wire on this seed — the check below would not exercise the defect');
  else ok(`${region} region-enemy sample(s) on the wire with typeIdx >= ${ENEMIES.length}`);
  if (!wrong.length) ok('every decoded typeIdx resolves through ALL_ENEMY_DEFS to the def the host spawned');
  else fail(`decoded typeIdx names a different def: ${wrong.slice(0, 6).join(', ')}`);
}

console.log('\n--- two browsers: the guest draws what the host simulates ---');
const peerjsB64 = loadPeerjs();
if (!peerjsB64) {
  fail('no local peerjs (set PEERJS_LOCAL, default /tmp/peerjs.min.js) — the browser half is the reproduction');
} else {
  const PORT = 8800 + (process.pid % 180);
  const RELAY = 13220 + (process.pid % 180);
  const httpd = bootHttpd(PORT);
  const relay = await bootRelay(RELAY);
  let H, C;
  try {
    if (!relay) throw new Error('relay never came up');
    const url = `http://localhost:${PORT}/index.html?peerhost=localhost&peerport=${relay.port}&peersecure=0&seed=${SEED}`;
    H = await new Page('host', 9900 + (process.pid % 180), peerjsB64).open();
    C = await new Page('client', 9901 + (process.pid % 180), peerjsB64).open();
    await H.goto(url);
    await H.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden') ? 1 : 0`, 10000, 'host title');
    await H.exec(`document.getElementById('name-input').value='HOST'; document.getElementById('btn-host').click(); return 1;`);
    const code = await H.waitFor(`return (window.uv.lobby && window.uv.lobby.code) || ''`, 15000, 'room code');
    await C.goto(url);
    await C.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden') ? 1 : 0`, 10000, 'client title');
    await C.exec(`document.getElementById('name-input').value='FRIEND'; document.getElementById('join-code').value=${JSON.stringify(code)}; document.getElementById('btn-join').click(); return 1;`);
    await C.waitFor(`return window.uv.mode==='lobby' ? 1 : 0`, 15000, 'client lobby');
    await H.waitFor(`return window.uv.lobby.players.length===2 ? 1 : 0`, 8000, 'host sees client');
    await H.exec(`document.querySelector('.char-card[data-char="toh_blacksmith"]').click(); return 1;`);
    await C.exec(`document.querySelector('.char-card[data-char="toh_wizard"]').click(); return 1;`);
    await sleep(300);
    await C.exec(`document.getElementById('btn-ready').click(); return 1;`);
    await H.waitFor(`return window.uv.lobby.players[1] && window.uv.lobby.players[1].ready ? 1 : 0`, 8000, 'client ready');
    await startRun(H, 1);
    await C.waitFor(`return window.uv.mode==='run' ? 1 : 0`, 8000, 'client run');
    for (const P of [H, C]) {
      await P.waitFor(`return document.querySelector('#overlay-opening .offer-card') ? 1 : 0`, 8000, 'opening card');
      await P.exec(`document.querySelector('#overlay-opening .offer-card').click(); return 1;`);
    }
    await sleep(400);
    await H.exec(`const b=document.querySelector('.map-node.reachable'); if(!b) throw new Error('no reachable node'); b.click(); return 1;`);
    await H.waitFor(`return window.uv.sim.phase==='arena' ? 1 : 0`, 12000, 'arena');
    // Long enough for many snapshots to have landed after the 'arena' event —
    // the floor defect needed only one.
    await H.waitFor(`return window.uv.sim.enemyPool.count >= 3 ? 1 : 0`, 15000, 'enemies on the field');
    await sleep(1500);

    const host = JSON.parse(await H.exec(`const s=window.uv.sim; return JSON.stringify({ biome: s.biome,
      enemies: [...s.enemyPool].filter(e => !e.boss && e.typeIdx !== -2).map(e => ({ id: e.id, def: e.def.id, shape: e.def.shape, color: e.def.color, spriteId: e.def.spriteId, region: e.typeIdx >= ${ENEMIES.length} })) })`));
    const guest = JSON.parse(await C.exec(`const v=window.uvLastView && window.uvLastView(); return JSON.stringify(v ? { mode: v.mode, biome: v.biome,
      enemies: (v.enemies||[]).filter(e => !e.boss && !e.pylon).map(e => ({ id: e.id, shape: e.shape, color: e.color, spriteId: e.spriteId })) } : null)`));
    if (!guest) throw new Error('window.uvLastView is missing on the guest');

    if (!host.biome) fail('the host room has no biome on this seed — nothing to compare');
    else if (guest.biome === host.biome) ok(`guest floor biome is "${guest.biome}", the host's, many snapshots after the 'arena' event`);
    else fail(`guest floor biome is ${JSON.stringify(guest.biome)}, host is "${host.biome}" — the guest draws the flat floor`);

    const hmap = new Map(host.enemies.map(e => [e.id, e]));
    let compared = 0, region = 0; const diff = [];
    for (const g of guest.enemies) {
      const h = hmap.get(g.id);
      if (!h) continue;   // spawned or died between the two reads
      compared++; if (h.region) region++;
      if (g.shape !== h.shape || g.color !== h.color || g.spriteId !== h.spriteId) {
        diff.push(`${h.def}: guest ${g.shape}/${g.color}/${g.spriteId}, host ${h.shape}/${h.color}/${h.spriteId}`);
      }
    }
    if (!compared) fail(`no enemy id present on both screens (host ${host.enemies.length}, guest ${guest.enemies.length})`);
    else if (!region) fail(`compared ${compared} enemies but none was a region unit — the defect's half of the table was not exercised`);
    else if (diff.length) fail(`${diff.length}/${compared} enemies look different on the guest: ${diff.slice(0, 4).join(' | ')}`);
    else ok(`all ${compared} enemies on both screens (${region} region units) have the host's shape, colour and sprite id on the guest`);

    // The room ends on the host; the guest's counter must follow it.
    await H.exec(`window.uv.sim.debug('F3'); return 1;`);
    await H.waitFor(`return window.uv.sim.cleared ? 1 : 0`, 3000, 'host clear');
    const t0 = Date.now();
    let after = null;
    while (Date.now() - t0 < 2000) {
      after = JSON.parse(await C.exec(`const el=document.getElementById('enemy-counter'); const v=window.uvLastView&&window.uvLastView();
        return JSON.stringify({ hidden: el.classList.contains('hidden'), text: el.innerText, ec: v ? v.ec : null })`));
      if (after.ec === 0 && (after.hidden || /⚔ 0/.test(after.text))) break;
      await sleep(100);
    }
    if (after && after.ec === 0 && (after.hidden || /⚔ 0/.test(after.text))) ok(`guest counter follows the host clear within ${Date.now() - t0} ms`);
    else fail(`guest counter after the host cleared: ${JSON.stringify(after)}`);
  } catch (e) {
    fail(e.message || String(e));
  } finally {
    if (H) H.close();
    if (C) C.close();
    if (relay) relay.proc.kill();
    httpd.kill();
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall co-op guest view checks passed');
process.exit(failures ? 1 : 0);
