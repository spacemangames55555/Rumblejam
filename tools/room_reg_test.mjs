// Focused instrument for defect #9: room registration failing before any peer
// exists. Boots the local relay + one Chromium page and drives
// HostTransport.createRoom() DIRECTLY, N times, recording per-attempt outcome
// and elapsed ms.
//
// WHY THIS EXISTS SEPARATELY FROM browser_test.mjs --coop. The suite's co-op
// phase polls window.uv.lobby.code for 12000ms and calls it a failure after
// that. The transport's own worst case is
//   ATTEMPTS x TIMEOUT_MS + backoff
// which is a different number living in a different file, and the two drifted:
// once retries were added, a first-attempt timeout could no longer finish
// inside the suite's window, so the suite reported "registration failed" while
// registration was still in flight — and read window.uvNet.regFailures, which
// main.js only writes after ALL attempts are exhausted, so the diagnostic
// printed `[]` every time. The suite could only ever say "no code in 12s".
// It could not say what PeerJS objected to, which is the actual question.
//
// This tool has no cap of its own: it waits for createRoom() to settle and
// reports what it settled as. That is the whole point.
//
// Usage: node tools/room_reg_test.mjs [trials]     (default 12)

import { readFileSync } from 'fs';
import { Page, bootHttpd, bootRelay, loadPeerjs, sleep } from './cdp_harness.mjs';

const TRIALS = parseInt(process.argv[2] || '12', 10);
const PORT = 8900 + (process.pid % 89);
const RELAY_PORT = 12800 + (process.pid % 89);

let failures = 0;
const ok = m => console.log(`\u2713 ${m}`);
const fail = m => { failures++; console.error(`\u2717 ${m}`); };

const peerjsB64 = loadPeerjs();
if (!peerjsB64) {
  console.warn('\u26a0 SKIPPED \u2014 no local peerjs (set PEERJS_LOCAL, default /tmp/peerjs.min.js). This tool');
  console.warn('  cannot reach the CDN from the sandbox, and a CDN miss is not the defect under test.');
  process.exit(0);
}

const httpd = bootHttpd(PORT);
const relay = await bootRelay(RELAY_PORT);
if (!relay) { console.error('\u2717 relay never came up \u2014 cannot measure registration'); process.exit(1); }
const relayPort = relay.port, relayProc = relay.proc;

const PAGE_URL = `http://localhost:${PORT}/index.html?peerhost=localhost&peerport=${relayPort}&peersecure=0`;
const page = await new Page('R', 9711, peerjsB64).open();
await page.goto(PAGE_URL);

// The transport is driven directly. The lobby, the title screen and the Host
// button are not under test here and only add ways for the measurement to be
// wrong about what it measured.
const CFG = await page.exec(`
  const c = await import('/js/config.js');
  return JSON.stringify({
    attempts: c.CONFIG.ROOM_REGISTER_ATTEMPTS,
    timeout: c.CONFIG.ROOM_REGISTER_TIMEOUT_MS,
    backoff: c.CONFIG.ROOM_REGISTER_BACKOFF_MS,
    budget: c.CONFIG.ROOM_REGISTER_BUDGET_MS,
    prefix: c.NET_PREFIX,
  });
`);
const cfg = JSON.parse(CFG);
console.log(`config: ${cfg.attempts} attempts x ${cfg.timeout}ms, backoff ${cfg.backoff}ms, budget ${cfg.budget}ms`);

// ---------- part 1: does registration succeed, and how long does it take ----------
console.log(`\n--- ${TRIALS} registration trials against the local relay ---`);
const raw = await page.exec(`
  const { HostTransport } = await import('/js/net.js');
  const out = [];
  for (let i = 0; i < ${TRIALS}; i++) {
    const t = new HostTransport();
    const t0 = performance.now();
    let rec;
    try { const code = await t.createRoom(); rec = { ok: true, code, ms: Math.round(performance.now() - t0) }; }
    catch (e) { rec = { ok: false, ms: Math.round(performance.now() - t0), reg: t.regFailures || [] }; }
    rec.attempts = (t.regFailures || []).length + (rec.ok ? 1 : 0);
    out.push(rec);
    t.close();
    await new Promise(r => setTimeout(r, 120));
  }
  return JSON.stringify(out);
`);
const trials = JSON.parse(raw);
const good = trials.filter(t => t.ok);
const bad = trials.filter(t => !t.ok);
const times = good.map(t => t.ms).sort((a, b) => a - b);
console.log(`registered ${good.length}/${trials.length}` +
  (times.length ? `  ms: min ${times[0]} / median ${times[times.length >> 1]} / max ${times[times.length - 1]}` : ''));

// Every failure reason, counted. "1 in 3 or 4 runs never gets a code" is a
// rate; this is what the misses actually were.
const byType = new Map();
for (const t of trials) for (const f of (t.reg || [])) byType.set(f.type, (byType.get(f.type) || 0) + 1);
const retried = trials.filter(t => t.ok && (t.reg || []).length > 0).length;
if (byType.size) {
  for (const [k, v] of [...byType].sort((a, b) => b[1] - a[1])) console.log(`  failed attempts: ${k} x${v}`);
} else {
  console.log('  no failed attempts recorded at all');
}
if (bad.length) fail(`${bad.length}/${trials.length} trials never registered — ${JSON.stringify(bad.slice(0, 3))}`);
else ok(`all ${trials.length} trials registered (${retried} needed a retry)`);

// THE SUITE'S CAP, CHECKED AGAINST THE TRANSPORT'S OWN WORST CASE. These are
// two numbers in two files and nothing related them before; when they drifted
// the suite reported a failure the transport had not had time to have yet.
const worst = cfg.attempts * cfg.timeout + cfg.backoff * (cfg.attempts * (cfg.attempts - 1) / 2);
const bounded = Math.min(worst, cfg.budget);
console.log(`\n--- registration worst case vs the co-op suite's wait ---`);
console.log(`  unbudgeted worst case: ${worst}ms; budget clamps it to ${bounded}ms`);
// Checked as SOURCE, not as a value, because the failure being guarded against
// is someone writing a fresh literal here. A wait computed from the same CONFIG
// the transport reads cannot drift away from it; a number cannot be stopped
// from drifting, only noticed afterwards, which is what happened.
const suiteSrc = readFileSync('tools/browser_test.mjs', 'utf8');
const literalWaits = [...suiteSrc.matchAll(/Date\.now\(\) - t0 > (\d+)\) return null/g)].map(m => m[1]);
const derived = /const REG_WAIT_MS = CONFIG\.ROOM_REGISTER_BUDGET_MS/.test(suiteSrc)
  && /Date\.now\(\) - t0 > REG_WAIT_MS\) return null/.test(suiteSrc);
if (literalWaits.length) fail(`co-op suite hardcodes its registration wait (${literalWaits.join(', ')}ms) instead of deriving it from CONFIG — this is exactly how it drifted past the transport's ${bounded}ms ceiling`);
else if (!derived) fail('co-op suite no longer derives REG_WAIT_MS from CONFIG.ROOM_REGISTER_BUDGET_MS');
else ok(`co-op suite derives its wait from CONFIG.ROOM_REGISTER_BUDGET_MS (${cfg.budget}ms + slack), so it cannot drift below the ${bounded}ms registration can take`);

// ---------- part 2: does a code collision actually recover ----------
// The runtime path, not the definition: Math.random is pinned so the FIRST
// code drawn is one already registered on the relay, then released so the
// retry draws a fresh one. Before the retry existed this was unrecoverable —
// `unavailable-id` means this exact code is taken and nothing redrew it.
console.log('\n--- code collision recovery ---');
const RELAY_JS = `const RELAY = { host: 'localhost', port: ${relayPort}, path: '/', secure: false };`;
const collRaw = await page.exec(`
  ${RELAY_JS}
  const { HostTransport } = await import('/js/net.js');
  const { NET_PREFIX } = await import('/js/config.js');
  // occupy AAAAA (Math.random()->0 maps to 'A' five times)
  // the same relay the transport reads out of location.search — a bare
  // new Peer() goes to the PeerJS cloud, which is unreachable from here, and
  // would "fail to occupy the code" for a reason that has nothing to do with
  // collisions
  const squatter = new Peer(NET_PREFIX + 'AAAAA', RELAY);
  await new Promise((res, rej) => {
    squatter.on('open', res);
    squatter.on('error', e => rej(new Error('squatter could not register: ' + e.type)));
    setTimeout(() => rej(new Error('squatter timed out')), 15000);
  });
  const real = Math.random;
  let pinned = 5;                       // exactly one code's worth
  Math.random = () => (pinned-- > 0 ? 0 : real());
  const t = new HostTransport();
  let res;
  try { const code = await t.createRoom(); res = { ok: true, code }; }
  catch (e) { res = { ok: false }; }
  Math.random = real;
  res.reg = t.regFailures || [];
  t.close(); squatter.destroy();
  return JSON.stringify(res);
`);
const coll = JSON.parse(collRaw);
if (!coll.ok) {
  fail(`a taken room code was not recovered from — attempts: ${JSON.stringify(coll.reg)}`);
} else {
  if (coll.code === 'AAAAA') fail('registered the taken code AAAAA — the collision did not actually happen');
  else ok(`collided on AAAAA, recovered on a fresh code ${coll.code}`);
  const first = coll.reg[0];
  if (!first) fail('collision recovered but no failed attempt was recorded — the ledger missed it');
  else if (first.code !== 'AAAAA') fail(`recorded attempt blames code ${first.code}, not the taken AAAAA`);
  else if (first.type !== 'unavailable-id') fail(`taken code reported as '${first.type}', not 'unavailable-id' — the retry is firing on the wrong classification`);
  else ok(`ledger recorded it as ${first.type} on AAAAA`);
}

// ---------- part 3: is the ledger written per attempt, or only at the end ----------
// window.uvNet.regFailures was written by main.js's terminal catch only, so a
// registration still retrying read as `[]` — "no failures" and "not finished
// yet" were the same reading. This is the instrument rule: the ledger is
// written where the event happens.
console.log('\n--- the failure ledger is readable while registration is still running ---');
const ledgerRaw = await page.exec(`
  ${RELAY_JS}
  const { HostTransport } = await import('/js/net.js');
  const { NET_PREFIX } = await import('/js/config.js');
  // the same relay the transport reads out of location.search — a bare
  // new Peer() goes to the PeerJS cloud, which is unreachable from here, and
  // would "fail to occupy the code" for a reason that has nothing to do with
  // collisions
  const squatter = new Peer(NET_PREFIX + 'AAAAA', RELAY);
  await new Promise(res => { squatter.on('open', res); setTimeout(res, 15000); });
  const real = Math.random;
  let pinned = 5;
  Math.random = () => (pinned-- > 0 ? 0 : real());
  const t = new HostTransport();
  const p = t.createRoom();
  // read the GLOBAL ledger mid-flight, the way the co-op suite does
  await new Promise(r => setTimeout(r, 600));
  const mid = JSON.stringify((window.uvNet && window.uvNet.regFailures) || []);
  Math.random = real;
  await p.catch(() => {});
  t.close(); squatter.destroy();
  return mid;
`);
const mid = JSON.parse(ledgerRaw);
if (!mid.length) fail('window.uvNet.regFailures was empty mid-registration — a run still retrying is indistinguishable from a run with no failures, which is exactly the reading that made this defect undiagnosable');
else if (mid[0].type !== 'unavailable-id') fail(`mid-flight ledger recorded '${mid[0].type}', expected 'unavailable-id'`);
else ok(`mid-flight ledger already carries the failed attempt: ${mid[0].type} on ${mid[0].code}`);

// ---------- part 4: a failure that cannot change is not retried ----------
// Retrying spends the budget that the recoverable cases need. A missing
// PeerJS library is the same in 400ms; every page in the suite that isn't
// testing co-op was logging three identical attempts for it.
console.log('\n--- an unretryable failure costs exactly one attempt ---');
const termRaw = await page.exec(`
  const { HostTransport } = await import('/js/net.js');
  const realPeer = window.Peer;
  window.Peer = undefined;
  const t = new HostTransport();
  const t0 = performance.now();
  try { await t.createRoom(); } catch { /* expected */ }
  window.Peer = realPeer;
  return JSON.stringify({ reg: t.regFailures || [], ms: Math.round(performance.now() - t0) });
`);
const term = JSON.parse(termRaw);
if (term.reg.length !== 1) fail(`a missing PeerJS cost ${term.reg.length} attempts, expected 1 — the retry is being spent where it cannot help`);
else if (term.reg[0].type !== 'peerjs-missing') fail(`expected 'peerjs-missing', got '${term.reg[0].type}'`);
else ok(`missing PeerJS: 1 attempt, ${term.ms}ms, not retried`);

page.close();
if (relayProc) relayProc.kill();
httpd.kill();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nall room-registration checks passed');
process.exit(failures ? 1 : 0);
