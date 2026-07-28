// Dev tool: end-to-end browser tests over the Chrome DevTools Protocol using
// Node's built-in WebSocket (no npm deps). Serves the repo with python
// http.server, boots real Chromium, and walks title → lobby → run → results.
// With a reachable PeerJS cloud it also runs the two-browser co-op test;
// otherwise co-op is reported SKIPPED.
// Usage: node tools/browser_test.mjs [--coop]

import { spawn } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const PORT = 8741;
const URL = `http://localhost:${PORT}/index.html`;
const CHROME = '/opt/pw-browsers/chromium';
let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let nextDebugPort = 9411;

class Browser {
  // opts.peerjsB64: serve this JS for any unpkg peerjs request (offline co-op tests)
  async open(label, opts = {}) {
    this.label = label;
    this.opts = opts;
    this.port = nextDebugPort++;
    this.errorsList = [];
    this.consoleLines = [];
    this.msgId = 0;
    this.pending = new Map();
    const profile = mkdtempSync(path.join(tmpdir(), 'uvchrome-'));
    this.proc = spawn(CHROME, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      `--remote-debugging-port=${this.port}`, `--user-data-dir=${profile}`,
      '--window-size=1440,900', '--autoplay-policy=no-user-gesture-required', '--mute-audio',
      'about:blank',
    ], { stdio: 'ignore' });
    // wait for the devtools endpoint, then grab the page target
    let target = null;
    for (let i = 0; i < 60 && !target; i++) {
      await sleep(250);
      try {
        const list = await (await fetch(`http://localhost:${this.port}/json/list`)).json();
        target = list.find(t => t.type === 'page');
      } catch { /* not up yet */ }
    }
    if (!target) throw new Error('chromium devtools endpoint never came up');
    this.ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = e => this._onMsg(JSON.parse(e.data));
    await this.cdp('Runtime.enable');
    await this.cdp('Page.enable');
    if (this.opts.peerjsB64) {
      await this.cdp('Fetch.enable', { patterns: [{ urlPattern: '*unpkg.com*' }] });
    }
  }

  _onMsg(m) {
    if (m.id && this.pending.has(m.id)) {
      const { res, rej } = this.pending.get(m.id);
      this.pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message));
      else res(m.result);
      return;
    }
    if (m.method === 'Fetch.requestPaused') {
      this.cdp('Fetch.fulfillRequest', {
        requestId: m.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
        body: this.opts.peerjsB64,
      }).catch(() => {});
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      const desc = (d.exception && (d.exception.description || d.exception.value)) || d.text || 'unknown';
      this.errorsList.push(String(desc));
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      const line = m.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      if (!/peerjs|PeerJS|wss:|ERR_|Failed to fetch|NetworkError|WebSocket/i.test(line)) this.errorsList.push(line);
      this.consoleLines.push(line);
    } else if (m.method === 'Runtime.consoleAPICalled') {
      this.consoleLines.push(m.params.args.map(a => a.value ?? '').join(' '));
    }
  }

  cdp(method, params = {}) {
    const id = ++this.msgId;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error(`CDP timeout: ${method}`)); } }, 30000);
    });
  }

  async goto(url) {
    await this.cdp('Page.navigate', { url });
    await sleep(400);
  }

  async exec(script) {
    const body = /\breturn\b/.test(script) ? script
      : script.includes(';') ? script
      : 'return (' + script + ')';
    const wrapped = `(function(){ ${body} })()`;
    const r = await this.cdp('Runtime.evaluate', { expression: wrapped, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('page eval failed: ' + ((d.exception && d.exception.description) || d.text).slice(0, 300));
    }
    return r.result ? r.result.value : undefined;
  }

  async waitFor(script, timeoutMs, what) {
    const t0 = Date.now();
    for (;;) {
      const v = await this.exec(script).catch(() => undefined);
      if (v) return v;
      if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${what}`);
      await sleep(200);
    }
  }

  async errors() { return this.errorsList.splice(0); }
  async logs() { return this.consoleLines; }

  async close() {
    try { this.ws && this.ws.close(); } catch { /* ignore */ }
    try { this.proc && this.proc.kill(); } catch { /* ignore */ }
    await sleep(200);
  }
}

// ---------- boot server ----------
const httpd = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.cwd(), stdio: 'ignore' });
process.on('exit', () => { httpd.kill(); });
await sleep(900);

const wantCoop = process.argv.includes('--coop');
const A = new Browser();
try {
  await A.open('A');
  await A.goto(URL);
  await A.waitFor(`return document.querySelector('#screen-title') && !document.querySelector('#screen-title').classList.contains('hidden')`, 8000, 'title screen');
  ok('title screen renders');

  // boot log + zero console errors
  await sleep(600);
  const logs = await A.logs();
  const boot = logs.find(l => /content loaded/.test(l));
  if (boot) ok(`boot log: ${boot.replace(/%c/g, '').trim().slice(0, 120)}`); else fail('boot log missing');
  let errs = await A.errors();
  if (errs.length) fail(`console errors at boot: ${errs.join(' | ').slice(0, 400)}`); else ok('no console errors at boot');

  // character smoke inside the real browser
  const smoke = await A.exec('return window.uvSmoke().length');
  if (smoke === 0) ok('in-browser uvSmoke: all characters pass'); else fail(`uvSmoke failures: ${smoke}`);

  // host → lobby
  await A.exec(`document.getElementById('name-input').value='TESTER'; document.getElementById('btn-host').click()`);
  await A.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')`, 5000, 'lobby');
  ok('host → lobby');
  // pick char + start
  await A.exec(`document.querySelector('.char-card[data-char="lamprey"]').click()`);
  await sleep(300);
  await A.exec(`document.getElementById('btn-start').click()`);
  await A.waitFor(`return window.uv.mode==='run' && !!window.uv.sim`, 5000, 'run start');
  ok('run starts (solo host)');

  // movement via synthetic keys
  const x0 = await A.exec('return window.uv.sim.players[0].x');
  await A.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}))`);
  await sleep(700);
  await A.exec(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD'}))`);
  const x1 = await A.exec('return window.uv.sim.players[0].x');
  if (x1 > x0 + 30) ok(`player moves with keys (${Math.round(x0)}→${Math.round(x1)})`); else fail(`player did not move (${x0}→${x1})`);

  // fast full run using sim driving (renderer active the whole time)
  const runResult = await A.exec(`
    const app = window.uv, sim = app.sim;
    try {
      for (let f = 0; f < 4; f++) {
        const floorN = sim.floorNum;
        for (const room of sim.floor.rooms) {
          if (room.kind === 'boss') continue;
          sim._enterRoom(room.id, null);
          for (let i = 0; i < 20; i++) sim.tick();
          let g = 0;
          while (sim.roomLocked && g++ < 40) { sim.debug('F3'); for (let i = 0; i < 20; i++) sim.tick(); }
          const p = sim.players[0];
          let g2 = 0;
          while (p.pendingOffer && g2++ < 30) sim.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
          if (p.treasureOffer) sim.uiAction(0, { kind: 'treasure', id: p.treasureOffer.picks[0] });
        }
        sim._enterRoom(sim.floor.bossId, null);
        for (let i = 0; i < 30; i++) sim.tick();
        let g3 = 0;
        while (sim.boss && g3++ < 900) sim.damageEnemy(sim.boss, 500, { owner: sim.players[0] });
        for (let i = 0; i < 30; i++) sim.tick();
        const p = sim.players[0];
        let g4 = 0;
        while (p.pendingOffer && g4++ < 30) sim.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
        if (sim.floorNum >= 4) { for (let i = 0; i < 200; i++) sim.tick(); break; }
        const fl = sim.floorNum;
        let g5 = 0;
        while (sim.floorNum === fl && g5++ < 400) { sim.players[0].x = sim.W/2; sim.players[0].y = sim.H/2; sim.tick(); }
      }
      return JSON.stringify({ over: sim.over, win: sim.result && sim.result.win });
    } catch (e) { return 'ERR ' + (e.stack || e); }
  `);
  if (runResult === '{"over":true,"win":true}') ok('scripted full solo run → WIN in browser'); else fail(`browser full run: ${String(runResult).slice(0, 400)}`);
  await A.waitFor(`return window.uv.mode==='results' && !document.getElementById('screen-results').classList.contains('hidden')`, 4000, 'results screen');
  const seedShown = await A.exec(`return document.querySelector('.seed-line') && document.querySelector('.seed-line').textContent`);
  if (/run seed: \d+/.test(seedShown || '')) ok(`results shows seed (${seedShown.trim()})`); else fail('seed missing on results');

  errs = await A.errors();
  if (errs.length) fail(`console errors during run: ${errs.join(' | ').slice(0, 500)}`); else ok('no console errors through full run');

  // stress fps in real browser
  await A.exec(`document.getElementById('btn-title').click()`);
  await A.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 4000, 'back to title');
  await A.exec(`document.getElementById('btn-host').click()`);
  await A.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')`, 4000, 'lobby2');
  await A.exec(`document.querySelector('.char-card[data-char="threader"]').click()`);
  await sleep(200);
  await A.exec(`document.getElementById('btn-start').click()`);
  await A.waitFor(`return window.uv.mode==='run'`, 4000, 'run2');
  const fps = await A.exec(`
    const sim = window.uv.sim;
    for (const id of ['coilgun','hailburst','gravelmouth','sparkbolt']) sim._addWeapon(sim.players[0], id, 4);
    for (let i = 0; i < 5; i++) sim.debug('F1');
    return new Promise(res => {
      let frames = 0;
      const t0 = performance.now();
      function f() { frames++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(JSON.stringify({ fps: Math.round(frames / 3), enemies: sim.enemyPool.count })); }
      requestAnimationFrame(f);
    });
  `);
  const fpsData = JSON.parse(fps);
  if (fpsData.fps >= 55) ok(`stress fps: ${fpsData.fps} @ ${fpsData.enemies} enemies (headless)`);
  else console.warn(`⚠ headless fps ${fpsData.fps} @ ${fpsData.enemies} enemies (headless rendering is unrepresentative; sim tick is 0.1ms)`);

  errs = await A.errors();
  if (errs.length) fail(`console errors during stress: ${errs.join(' | ').slice(0, 300)}`); else ok('no console errors during stress');
} catch (e) {
  fail(`browser test crashed: ${e.message}`);
} finally {
  if (!wantCoop) await A.close();
}

// ---------- co-op two-browser test ----------
// The sandbox can't reach the PeerJS cloud, so we run the game's supported
// self-host path: a local signaling relay (tools/peer_relay.mjs) + the real
// peerjs client injected in place of the CDN copy. WebRTC itself is p2p.
if (wantCoop) {
  await A.close();
  const { readFileSync, existsSync } = await import('fs');
  const PJS = process.env.PEERJS_LOCAL || '/tmp/peerjs.min.js';
  if (!existsSync(PJS)) {
    console.warn('⚠ COOP SKIPPED — no local peerjs.min.js (set PEERJS_LOCAL or place /tmp/peerjs.min.js)');
    console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL BROWSER TESTS PASSED');
    process.exit(failures ? 1 : 0);
  }
  const peerjsB64 = readFileSync(PJS).toString('base64');
  const relay = spawn('node', ['tools/peer_relay.mjs', '9500'], { stdio: 'ignore' });
  process.on('exit', () => relay.kill());
  await sleep(700);
  const COOP_URL = `${URL}?peerhost=localhost&peerport=9500&peersecure=0`;
  const A2 = new Browser();
  const B = new Browser();
  try {
    await A2.open('A2', { peerjsB64 });
    await A2.goto(COOP_URL);
    const A = A2; // reuse flow variable name below
    await A.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title A');
    await A.exec(`document.getElementById('name-input').value='HOST'; document.getElementById('btn-host').click()`);
    const code = await (async () => {
      const t0 = Date.now();
      for (;;) {
        const c = await A.exec(`return window.uv.lobby && window.uv.lobby.code`);
        if (c) return c;
        const pending = await A.exec(`return window.uv.lobby && window.uv.lobby.codePending`);
        if (!pending) return null;
        if (Date.now() - t0 > 12000) return null;
        await sleep(300);
      }
    })();
    if (!code) {
      fail('room registration failed against local relay');
    } else {
      ok(`room registered: ${code}`);
      await B.open('B', { peerjsB64 });
      await B.goto(COOP_URL);
      await B.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title B');
      await B.exec(`document.getElementById('name-input').value='FRIEND'; document.getElementById('join-code').value='${code}'; document.getElementById('btn-join').click()`);
      await B.waitFor(`return window.uv.mode==='lobby'`, 15000, 'client joins lobby');
      ok('client joined by code');
      await A.waitFor(`return window.uv.lobby.players.length===2`, 5000, 'host sees client');
      await A.exec(`document.querySelector('.char-card[data-char="bulwark"]').click()`);
      await B.waitFor(`return document.querySelector('.char-card[data-char="wisp"]')!==null`, 4000, 'client char grid');
      await B.exec(`document.querySelector('.char-card[data-char="wisp"]').click()`);
      await sleep(400);
      await B.exec(`document.getElementById('btn-ready').click()`);
      await A.waitFor(`return window.uv.lobby.players[1] && window.uv.lobby.players[1].ready && window.uv.lobby.players[1].charId`, 5000, 'client ready');
      await A.exec(`document.getElementById('btn-start').click()`);
      await A.waitFor(`return window.uv.mode==='run'`, 5000, 'host run');
      await B.waitFor(`return window.uv.mode==='run'`, 5000, 'client run');
      ok('both enter the run');
      // client moves; host should see it
      const hx0 = await A.exec(`return Math.round(window.uv.sim.players[1].x)`);
      await B.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}))`);
      await sleep(900);
      await B.exec(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD'}))`);
      const hx1 = await A.exec(`return Math.round(window.uv.sim.players[1].x)`);
      if (hx1 > hx0 + 30) ok(`host sees client movement (${hx0}→${hx1})`); else fail(`client movement not seen by host (${hx0}→${hx1})`);
      // client sees host's snapshot state
      const snapAge = await B.exec(`return performance.now() - window.uv.lastSnapAt`);
      if (snapAge < 1000) ok('client receives snapshots'); else fail(`stale snapshots (${Math.round(snapAge)}ms)`);
      // both deal and take damage in organic combat
      await A.exec(`window.uv.sim.debug('F1')`);
      await sleep(3500);
      const combat = await A.exec(`const s=window.uv.sim; return JSON.stringify({d0:Math.round(s.players[0].damageDealt), d1:Math.round(s.players[1].damageDealt), hurt:s.players.some(p=>p.hp<p.stats.maxHp)})`);
      const cb = JSON.parse(combat);
      if (cb.d0 > 0 && cb.d1 > 0) ok(`both players deal damage (host ${cb.d0}, client ${cb.d1})`); else fail(`damage tallies: ${combat}`);
      if (cb.hurt) ok('players take damage from enemies'); else console.warn('⚠ nobody was hit during the combat window (kiting luck)');
      await A.exec(`window.uv.sim.debug('F3')`);
      // down the client, host revives (via sim manipulation on host)
      await A.exec(`const s=window.uv.sim, p=s.players[1]; p.invuln=0; let g=0; while(!p.downed&&g++<80){p.hp=1;s.hurtPlayer(p,999,null);}`);
      await sleep(600);
      const cDown = await B.exec(`const s=window.uv.snaps; const last=s[s.length-1]; return last && last.s.players[1][5]`);
      if (cDown) ok('client sees itself downed'); else fail('downed state not visible on client');
      await A.exec(`const s=window.uv.sim; s.players[0].x=s.players[1].x; s.players[0].y=s.players[1].y;`);
      await A.waitFor(`return !window.uv.sim.players[1].downed`, 6000, 'revive');
      ok('proximity revive works in co-op');
      // per-player shops: drive both into shop room
      await A.exec(`const s=window.uv.sim; const shop=s.floor.rooms.find(r=>r.kind==='shop'); s._enterRoom(shop.id,null);`);
      await A.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 4000, 'host shop overlay');
      await B.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 4000, 'client shop overlay');
      ok('both players get their own shop overlay simultaneously');
      // door countdown sync: clear + stand host in doorway
      const doorOk = await A.exec(`
        const s = window.uv.sim; const room = s._room();
        const dirs = Object.keys(room.doors);
        if (!dirs.length) return 'nodoor';
        const d = dirs[0]; const W=s.W,H=s.H,WALL=36;
        const p = s.players[0];
        if (d==='n'){p.x=W/2;p.y=WALL+p.radius+2;} if (d==='s'){p.x=W/2;p.y=H-WALL-p.radius-2;}
        if (d==='w'){p.x=WALL+p.radius+2;p.y=H/2;} if (d==='e'){p.x=W-WALL-p.radius-2;p.y=H/2;}
        return 'set';
      `);
      if (doorOk === 'set') {
        await B.waitFor(`const s=window.uv.snaps; const last=s[s.length-1]; return last && last.s.door`, 4000, 'client sees countdown');
        ok('door countdown syncs to client');
      }
      // boss kill → hatch → both transition to floor 2
      await A.exec(`const s=window.uv.sim; s._enterRoom(s.floor.bossId, null);`);
      await sleep(600);
      await A.exec(`const s=window.uv.sim; let g=0; while (s.boss && g++<900) s.damageEnemy(s.boss, 500, {owner:s.players[0]});`);
      await sleep(400);
      await A.exec(`const s=window.uv.sim; for (const p of s.players){let g=0; while(p.pendingOffer&&g++<30) s.uiAction(p.idx,{kind:'levelup',id:p.pendingOffer[0].id});} `);
      await A.exec(`const s=window.uv.sim; const h=s.hatch; if (h) { s.players[0].x=h.x; s.players[0].y=h.y; s.players[1].x=h.x+30; s.players[1].y=h.y; }`);
      // hold host player on the hatch through the 3 s countdown
      for (let i = 0; i < 14; i++) {
        await A.exec(`const s=window.uv.sim; if (s.hatch){ s.players[0].x=s.hatch.x; s.players[0].y=s.hatch.y; }`);
        const fl = await A.exec(`return window.uv.sim.floorNum`);
        if (fl === 2) break;
        await sleep(350);
      }
      const hostFloor = await A.exec(`return window.uv.sim.floorNum`);
      const clientFloor = await B.waitFor(`return window.uv.floorNum===2 && window.uv.floorNum`, 6000, 'client floor 2').catch(() => 0);
      if (hostFloor === 2 && clientFloor === 2) ok('boss kill + hatch transitions BOTH players to floor 2');
      else fail(`floor transition: host=${hostFloor} client=${clientFloor}`);
      // wipe → both see results
      await A.exec(`const s=window.uv.sim; for (const p of s.players){let g=0; while(!p.downed&&!s.over&&g++<90){p.invuln=0;p.hp=1;s.hurtPlayer(p,9999,null);}}`);
      await A.waitFor(`return window.uv.mode==='results'`, 5000, 'host results');
      await B.waitFor(`return window.uv.mode==='results'`, 5000, 'client results');
      ok('wipe → results on both host and client');
      // host disconnect → client notified
      await A.close();
      await B.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden') && document.getElementById('title-err').textContent.includes('Host disconnected')`, 12000, 'host-disconnected notice');
      ok('client shows "Host disconnected" when host dies');
      const berrs = await B.errors();
      if (berrs.length) fail(`client console errors: ${berrs.join(' | ').slice(0, 300)}`); else ok('no client console errors');
    }
  } catch (e) {
    fail(`coop test: ${e.message}`);
  } finally {
    await A2.close(); await B.close();
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL BROWSER TESTS PASSED');
process.exit(failures ? 1 : 0);
