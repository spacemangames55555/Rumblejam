// Can a co-op party hurt anything? (§15 defect #11)
//
// offence_test.mjs answers this for one player. The defect was not a solo
// reading: every full co-op run reported both players at damageDealt 0 while
// enemies were hurting them. A 1-player gate stays green through that, which
// is how the entry outlived the roster change that was supposed to close it.
//
// TWO HALVES, because the two failures are different.
//
//   node    every selectable pair, seed 424242, the §5.6 card answered the
//           way a click answers it (the anti-softlock floor must stay at 0),
//           the 2-player consent vote actually ticked, then what each player
//           dealt. A snapshot is encoded and decoded the way a client decodes
//           one, and a damaged enemy has to survive that round trip — the
//           host's counter moving while the wire still says full HP is the
//           same defect from the other chair.
//
//   browser two real pages over the local relay. The client clicks its own
//           opening card. The host enters region 1 through startRun, which is
//           the helper every browser suite uses. Both damageDealt counters
//           have to move, and the client's decoded snapshot has to show the
//           same enemy below full HP.
//
// THE WINDOW IS THE ONE THE DEFECT ENTRY ALREADY WARNED ABOUT. Three seconds
// after the arena opens is before the first spawn arrives; a check that short
// reads 0,0 on a party that is fighting. This waits until both have dealt
// damage or 30s, whichever comes first, and a zero after enemies have closed
// to 400 is the defect rather than a slow walk.
//
// Usage: node tools/coop_offence_test.mjs

import { Sim } from '../js/game.js';
import { SELECTABLE } from '../js/content/characters.js';
import { encodeSnap, decodeSnap } from '../js/netcodec.js';
import { Page, bootHttpd, bootRelay, loadPeerjs, sleep, startRun } from './cdp_harness.mjs';

const SEED = 424242;
const SECONDS = 22;
const ENGAGE = 400;

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

function answerOpening(sim) {
  for (const p of sim.players) {
    if (!p.openingOffer || !p.openingOffer.length) return false;
    sim.uiAction(p.idx, { kind: 'opening', id: p.openingOffer[0].id });
  }
  return true;
}

function enterFirstNode(sim) {
  const nodeId = sim.reachableNodes()[0];
  sim.uiAction(0, { kind: 'pickNode', nodeId });
  let guard = 0;
  while (sim.phase !== 'arena' && !sim.over && guard++ < 600) sim.tick();
  return sim.phase === 'arena';
}

// One 2-player fight on the pinned seed. `strip` clears the loadout at the
// door, after the floor has already decided not to fire, so a later zero is
// the skills being gone and not the floor being late.
function fightPair(a, b, { strip = false } = {}) {
  const sim = new Sim({
    seed: SEED,
    party: [
      { idx: 0, key: 'h', name: 'H', charId: a, color: '#fff' },
      { idx: 1, key: 'c', name: 'C', charId: b, color: '#0ff' },
    ],
  });
  if (!answerOpening(sim)) return { err: 'no §5.6 offer' };
  if (!enterFirstNode(sim)) return { err: `never entered the arena (${sim.phase})` };
  if (strip) for (const p of sim.players) p.loadout = p.loadout.map(() => null);
  let ticks = 0;
  let closest = Infinity;
  let wireFrac = 1;
  while (!sim.over && sim.phase === 'arena' && ticks++ < SECONDS * 60) {
    sim.tick();
    for (const p of sim.players) {
      for (const e of sim.enemyPool.items) {
        if (!e.active) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < closest) closest = d;
      }
    }
    if (ticks % 30 === 0) {
      const dec = decodeSnap(encodeSnap(sim.getSnapshot()));
      for (const e of dec.enemies) if (e[4] < wireFrac) wireFrac = e[4];
    }
  }
  return {
    d: sim.players.map(p => Math.round(p.damageDealt)),
    hurt: sim.players.some(p => p.hp < p.stats.vitality - 0.5),
    floored: sim.openingFloored || 0,
    load: sim.players.map(p => p.loadout.filter(Boolean)),
    closest: Math.round(closest),
    wireFrac,
  };
}

console.log('--- every selectable pair, 2 players, opening card answered, seed ' + SEED + ' ---');
const ids = SELECTABLE.map(c => c.id);
if (ids.length < 2) fail(`need two selectable classes, found ${ids.length}`);

const mute = [];
const floored = [];
const starved = [];
let wireShown = false;
for (const a of ids) {
  for (const b of ids) {
    const r = fightPair(a, b);
    if (r.err) { fail(`${a} + ${b}: ${r.err}`); continue; }
    if (r.floored) floored.push(`${a}+${b}`);
    if (r.closest > ENGAGE) starved.push(`${a.replace('toh_', '')}+${b.replace('toh_', '')}:${r.closest}`);
    if (!(r.d[0] > 0 && r.d[1] > 0)) mute.push(`${a.replace('toh_', '')}+${b.replace('toh_', '')} ${r.d.join('/')} @${r.closest}`);
    if (r.wireFrac < 1) wireShown = true;
  }
}
const pairs = ids.length * ids.length;
if (!floored.length) ok(`anti-softlock floor fired 0 times across ${pairs} pairs — the §5.6 card armed both players`);
else fail(`the floor rescued ${floored.length} pair(s): ${floored.slice(0, 8).join(', ')}. A co-op run that only fights because the net fired is the defect, not the fix`);
if (starved.length) {
  fail(`FIXTURE, NOT ROSTER: ${starved.length} pair(s) never had an enemy within ${ENGAGE}: ${starved.slice(0, 8).join(' ')}`);
} else ok(`every pair was offered a fight (an enemy closed to within ${ENGAGE})`);
if (mute.length) fail(`${mute.length}/${pairs} pair(s) dealt no damage from at least one player: ${mute.slice(0, 12).join('; ')}`);
else ok(`all ${pairs} selectable pairs deal damage from both players within ${SECONDS}s`);
if (wireShown) ok('a decoded snapshot shows an enemy below full HP — the client wire carries the damage, not only the host counter');
else fail('damageDealt moved and every decoded snapshot still had every enemy at full HP');

// The same seed, the same two classes, loadout emptied at the door. If this
// still deals damage, the assertion above is not reading player offence.
console.log('\n--- negative control: the same fight with nothing slotted ---');
{
  const r = fightPair('toh_samurai', 'toh_monk', { strip: true });
  if (r.err) fail(`stripped pair: ${r.err}`);
  else if (r.d[0] === 0 && r.d[1] === 0) ok(`samurai + monk with empty loadouts deal 0 (${r.d.join('/')}) — the counter is the skills`);
  else fail(`empty loadouts still dealt ${r.d.join('/')} — damageDealt is moving without a slotted skill, so the gate above cannot see #11`);
}

// Pinned alongside the sweep. This pair is hurt inside the window on this
// seed; the defect's reading was hurt:true next to a zero, and a gate that
// never sees the hurt half cannot tell "enemies are not spawning" from
// "players are not swinging".
console.log('\n--- the recorded pair takes damage while it deals it ---');
{
  const r = fightPair('toh_blacksmith', 'toh_wizard');
  if (r.err) fail(r.err);
  else if (r.d[0] > 0 && r.d[1] > 0 && r.hurt) ok(`blacksmith ${r.d[0]} / wizard ${r.d[1]}, and the party was hurt`);
  else fail(`damage tallies: ${JSON.stringify({ d0: r.d[0], d1: r.d[1], hurt: r.hurt })}`);
}

console.log('\n--- two browsers, local relay, the client watches the same HP ---');
const peerjsB64 = loadPeerjs();
if (!peerjsB64) {
  fail('no local peerjs (set PEERJS_LOCAL, default /tmp/peerjs.min.js) — the browser half is the reproduction, not an optional extra');
} else {
  const PORT = 8800 + (process.pid % 180);
  const RELAY = 13220 + (process.pid % 180);
  const httpd = bootHttpd(PORT);
  const relay = await bootRelay(RELAY);
  let H, C;
  try {
    if (!relay) fail('relay never came up');
    else {
      const url = `http://localhost:${PORT}/index.html?peerhost=localhost&peerport=${relay.port}&peersecure=0`;
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
      await H.exec(`document.querySelector('.char-card[data-char="toh_samurai"]').click(); return 1;`);
      await C.exec(`document.querySelector('.char-card[data-char="toh_necromancer"]').click(); return 1;`);
      await sleep(300);
      await C.exec(`document.getElementById('btn-ready').click(); return 1;`);
      await H.waitFor(`return window.uv.lobby.players[1] && window.uv.lobby.players[1].ready && window.uv.lobby.players[1].charId==='toh_necromancer' ? 1 : 0`, 8000, 'client ready');
      await startRun(H, 1);
      await C.waitFor(`return window.uv.mode==='run' ? 1 : 0`, 8000, 'client run');
      // Answer the card the way a pointer does, on each page, before travel.
      // The floor granting the skill here would still deal damage and hide a
      // card the client cannot reach.
      for (const P of [H, C]) {
        await P.waitFor(`return document.querySelector('#overlay-opening .offer-card') ? 1 : 0`, 8000, 'opening card');
        await P.exec(`document.querySelector('#overlay-opening .offer-card').click(); return 1;`);
      }
      await sleep(400);
      const armed = JSON.parse(await H.exec(`const s=window.uv.sim; return JSON.stringify({
        floored: s.openingFloored||0,
        load: s.players.map(p => p.loadout.filter(Boolean))
      })`));
      if (armed.floored) fail(`opening floor fired ${armed.floored} time(s) before the fight — the card click did not arm the party`);
      else if (armed.load.some(l => !l.length)) fail(`a player entered the map with an empty loadout: ${JSON.stringify(armed.load)}`);
      else ok(`both players armed from the card they clicked (${armed.load.map(l => l[0]).join(' / ')}), floor stayed 0`);
      await H.exec(`const b=document.querySelector('.map-node.reachable'); if(!b) throw new Error('no reachable node'); b.click(); return 1;`);
      await H.waitFor(`return window.uv.sim.phase==='arena' ? 1 : 0`, 12000, 'arena');
      const t0 = Date.now();
      let last = null;
      let clientSaw = null;
      while (Date.now() - t0 < 30000) {
        last = JSON.parse(await H.exec(`const s=window.uv.sim; return JSON.stringify({
          d0: Math.round(s.players[0].damageDealt), d1: Math.round(s.players[1].damageDealt),
          hurt: s.players.some(p => p.hp < p.stats.vitality - 0.5),
          ens: [...s.enemyPool].filter(e => e.active && e.hp < e.maxHp).slice(0, 4).map(e => ({ id: e.id, frac: +(e.hp / e.maxHp).toFixed(2) }))
        })`));
        if (last.ens.length) {
          const seen = JSON.parse(await C.exec(`const snaps=window.uv.snaps||[]; const last=snaps[snaps.length-1];
            if (!last || !last.s.enemies) return '[]';
            return JSON.stringify(last.s.enemies.slice(0, 12).map(e => ({ id: e[0], frac: +e[4].toFixed(2) })));`));
          const hit = last.ens.find(e => {
            const c = seen.find(x => x.id === e.id);
            return c && c.frac < 0.98 && Math.abs(c.frac - e.frac) <= 0.08;
          });
          if (hit) clientSaw = hit;
        }
        if (last.d0 > 0 && last.d1 > 0 && clientSaw) break;
        await sleep(400);
      }
      if (last && last.d0 > 0 && last.d1 > 0) ok(`both players deal damage (host ${last.d0}, client ${last.d1})`);
      else fail(`damage tallies: ${JSON.stringify(last)}`);
      if (last && last.hurt) ok('players take damage from enemies');
      else fail(`nobody was hurt during the co-op window: ${JSON.stringify(last)}`);
      if (clientSaw) ok(`client snapshot shows enemy ${clientSaw.id} at ${clientSaw.frac} HP, matching the host`);
      else fail(`client never saw a damaged enemy the host had already hurt: ${JSON.stringify(last && last.ens)}`);
    }
  } catch (e) {
    fail(e.message || String(e));
  } finally {
    if (H) H.close();
    if (C) C.close();
    if (relay) relay.proc.kill();
    httpd.kill();
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall co-op offence checks passed');
process.exit(failures ? 1 : 0);
