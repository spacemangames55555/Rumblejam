// Focused instrument for defect #8: client -> host input had no delivery
// guarantee. Two real pages over the local relay — a host and a client — and
// the client's channel is deliberately broken at the moment of a press.
//
// WHAT MAKES THIS DIFFERENT FROM A UNIT TEST. The defect is not "does the
// handler work"; the handlers were always fine. It is that the message never
// entered the channel, and nothing repeated it. So the send is broken at the
// transport, on a live connection, and the assertion is on the HOST's observed
// state afterwards — did the action land without the player pressing again.
//
// `ready` is the probe throughout, because it TOGGLES. Any fix that heals a
// lost action by repeating it will, if it repeats once too often, un-ready the
// player. A test using an idempotent action would pass either way and prove
// nothing about the part that is hard.
//
// Usage: node tools/uiack_test.mjs

import { Page, bootHttpd, bootRelay, loadPeerjs, sleep } from './cdp_harness.mjs';
import { CONFIG } from '../js/config.js';

const PORT = 8790 + (process.pid % 89);
const RELAY_PORT = 13100 + (process.pid % 89);

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

const peerjsB64 = loadPeerjs();
if (!peerjsB64) {
  console.warn('⚠ SKIPPED — no local peerjs (set PEERJS_LOCAL, default /tmp/peerjs.min.js).');
  process.exit(0);
}

const httpd = bootHttpd(PORT);
const relay = await bootRelay(RELAY_PORT);
if (!relay) { console.error('✗ relay never came up — cannot test client input delivery'); process.exit(1); }
const URL = `http://localhost:${PORT}/index.html?peerhost=localhost&peerport=${relay.port}&peersecure=0`;

const H = await new Page('host', 9741, peerjsB64).open();
const C = await new Page('client', 9742, peerjsB64).open();

async function pairUp() {
  await H.goto(URL);
  await H.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden') ? 1 : 0`, 10000, 'host title');
  await H.exec(`document.getElementById('name-input').value='HOST'; document.getElementById('btn-host').click(); return 1;`);
  const code = await H.waitFor(`return (window.uv.lobby && window.uv.lobby.code) || ''`,
    CONFIG.ROOM_REGISTER_BUDGET_MS + 3000, 'a room code');
  await C.goto(URL);
  await C.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden') ? 1 : 0`, 10000, 'client title');
  await C.exec(`document.getElementById('name-input').value='FRIEND'; document.getElementById('join-code').value='${code}'; document.getElementById('btn-join').click(); return 1;`);
  await C.waitFor(`return window.uv.mode==='lobby' ? 1 : 0`, 15000, 'client in lobby');
  await H.waitFor(`return window.uv.lobby.players.length===2 ? 1 : 0`, 8000, 'host sees the client');
  return code;
}

const code = await pairUp();
ok(`paired on ${code}`);

// The client's own key, so the host's roster can be read for the right player.
const clientKey = await C.exec(`return window.uv.myKey`);

// THE REAL BUTTON, not an exported helper. The defect lives between a player's
// click and the host's state; a test that starts halfway along that path can
// only prove the half it starts in.
const pressReady = () => C.exec(`
  const b = document.getElementById('btn-ready');
  if (!b) throw new Error('no ready button on the client lobby');
  b.click();
  return 1;
`);

const hostReady = () => H.exec(`
  const p = window.uv.lobby.players.find(q => q.key === ${JSON.stringify(clientKey)});
  return JSON.stringify({ ready: !!(p && p.ready), seen: (window.uv.uiSeen && window.uv.uiSeen.get(${JSON.stringify(clientKey)})) || 0 });
`).then(JSON.parse);

// ---------- 1: the happy path still works, and clears ----------
console.log('\n--- an acknowledged action leaves nothing pending ---');
await pressReady();
await sleep(600);
{
  const st = await hostReady();
  const pending = await C.exec(`return window.uv.uiPending.size`);
  if (!st.ready) fail('a plain ready press did not reach the host at all');
  else if (pending !== 0) fail(`ready landed but ${pending} action(s) still pending — the ack is not clearing them`);
  else ok(`ready landed, host seq high-water ${st.seen}, nothing left pending`);
}

// ---------- 2: an action sent while the channel is down still lands ----------
// This is the defect verbatim. ClientTransport.send skips a channel that is not
// open; before the fix the press was simply gone, with a clean console on both
// ends. The channel is put back after the press, and NOTHING presses again.
console.log('\n--- an action taken while the channel is down lands anyway ---');
await C.exec(`
  const t = window.uv.clientT;
  window.__realSend = t.conn.send.bind(t.conn);
  t.conn.send = () => { throw new Error('simulated channel failure'); };
  return 1;
`);
await pressReady();   // un-ready, and it must not arrive yet
await sleep(400);
{
  const st = await hostReady();
  if (!st.ready) fail('the broken send reached the host anyway — the failure was not actually simulated, so nothing below tests recovery');
  else ok('press swallowed by the broken channel, host state unchanged (as before the fix)');
}
const dropsWhileDown = await C.exec(`return (window.uvNet && window.uvNet.drops) || 0`);
await C.exec(`window.uv.clientT.conn.send = window.__realSend; return 1;`);
await sleep(CONFIG.UI_ACK_RESEND_MS * 4 + 600);
{
  const st = await hostReady();
  const pending = await C.exec(`return window.uv.uiPending.size`);
  const resends = await C.exec(`return (window.uvNet && window.uvNet.uiResends) || 0`);
  if (st.ready) fail('the action never arrived after the channel recovered — resend-until-acked is not working, which is the whole of defect #8');
  else if (pending !== 0) fail(`the action arrived but ${pending} still pending — the ack did not clear it`);
  else ok(`recovered without a second press: ready toggled off, ${resends} resend(s), ${dropsWhileDown} drop(s) logged while down`);
}

// ---------- 3: a resend is not a second press ----------
// The ack is swallowed instead of the action, so the host sees the SAME action
// several times. `ready` toggles, so if the host applies a duplicate the flag
// flips back and the player un-readies themselves by pressing once.
console.log('\n--- a duplicate delivery is acknowledged but not applied ---');
const before = await hostReady();
await C.exec(`
  window.__acks = 0;
  const t = window.uv.clientT;
  window.__realOnMessage = t.onMessage;
  t.onMessage = m => { if (m && m.t === 'uiack') { window.__acks++; return; } window.__realOnMessage(m); };
  return 1;
`);
await pressReady();
await sleep(CONFIG.UI_ACK_RESEND_MS * 6 + 400);
const acksSwallowed = await C.exec(`return window.__acks`);
await C.exec(`window.uv.clientT.onMessage = window.__realOnMessage; return 1;`);
await sleep(800);
{
  const st = await hostReady();
  const dups = await H.exec(`return (window.uvNet && window.uvNet.uiDuplicates) || 0`);
  const pending = await C.exec(`return window.uv.uiPending.size`);
  if (acksSwallowed < 2) fail(`only ${acksSwallowed} ack(s) were swallowed — the client did not resend enough for this to test anything`);
  else if (st.ready === before.ready) fail('the toggle never applied at all');
  else if (dups < 1) fail('the host recorded no duplicates, so the resends never reached it and this proves nothing');
  else ok(`${acksSwallowed} acks swallowed, ${dups} duplicate(s) seen by the host, ready toggled exactly once (${before.ready} -> ${st.ready})`);
  if (pending !== 0) fail(`${pending} still pending after the acks were let through again`);
}

// ---------- 4: the host acks a duplicate rather than ignoring it ----------
// A duplicate is what a LOST ACK looks like from the host's side: the action
// landed, the reply did not, the client is asking again. Staying quiet would
// leave the client resending an action already carried out, until it gave up.
console.log('\n--- a duplicate is still acknowledged, so a lost ack self-heals ---');
{
  const seen = (await hostReady()).seen;
  const acked = await C.exec(`
    const t = window.uv.clientT;
    let got = false;
    const real = t.onMessage;
    t.onMessage = m => { if (m && m.t === 'uiack' && m.useq === ${seen}) got = true; real(m); };
    t.send({ t: 'ui', useq: ${seen}, kind: 'ready' });   // deliberately an OLD sequence number
    await new Promise(r => setTimeout(r, 800));
    t.onMessage = real;
    return got ? 1 : 0;
  `);
  const st = await hostReady();
  if (!acked) fail(`the host did not acknowledge a replay of seq ${seen} — a client whose ack was lost would resend until it gave up on an action the host had already done`);
  else if (st.seen !== seen) fail(`replaying seq ${seen} moved the host's high-water mark to ${st.seen}`);
  else ok(`replay of seq ${seen} acknowledged and not re-applied`);
}

// ---------- 5: a rejoining peer is not mistaken for a duplicate ----------
// The client's sequence numbers restart at 1 on a new connection. If the host
// kept the old high-water mark under the same peer key, every action after a
// reconnect would be discarded as already-seen — a lobby that accepts you and
// then ignores every button you press.
console.log('\n--- the host forgets a departed peer\'s sequence numbers ---');
{
  const key = clientKey;
  const seenBefore = (await hostReady()).seen;
  // A REAL DEPARTURE. The client closes its transport and the host's own
  // onPeerLeave fires; calling the handler directly would test the line I
  // wrote rather than the path a disconnect actually takes.
  await C.exec(`window.uv.clientT.close(); return 1;`);
  await H.waitFor(`return window.uv.hostT.conns.size === 0 ? 1 : 0`, 8000, 'host to notice the peer left');
  await sleep(400);
  const after = await H.exec(`return (window.uv.uiSeen.get(${JSON.stringify(key)}) || 0)`);
  if (seenBefore === 0) fail('the high-water mark was already 0, so the departure proves nothing');
  else if (after !== 0) fail(`peer left with high-water ${seenBefore} and the host still holds ${after} — a rejoin would have its first ${after} actions discarded as duplicates`);
  else ok(`peer left holding seq ${seenBefore}; host now holds 0, so a rejoin starts clean`);
}

H.close(); C.close();
relay.proc.kill();
httpd.kill();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nall client-input delivery checks passed');
process.exit(failures ? 1 : 0);
