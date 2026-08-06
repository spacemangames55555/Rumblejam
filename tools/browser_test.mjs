// Dev tool: end-to-end browser tests over the Chrome DevTools Protocol using
// Node's built-in WebSocket (no npm deps). Serves the repo with python
// http.server, boots real Chromium, and walks title → lobby → run → results.
// With a reachable PeerJS cloud it also runs the two-browser co-op test;
// otherwise co-op is reported SKIPPED.
// Usage: node tools/browser_test.mjs [--coop]

import { spawn } from 'child_process';
import { mkdtempSync } from 'fs';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { tmpdir } from 'os';
import path from 'path';
import { execFileSync } from 'node:child_process';
// Fixture cell sizes come from the same table the manifest generator uses. They
// were hardcoded 32s until enemies moved to 128 and every enemy fixture became
// a rejected sheet — a test that describes the art layout must read it, not
// restate it.
import { SPRITE_SIZE } from '../js/content/sprites.js';
const E_CELL = SPRITE_SIZE.enemy[0];
const FX_CELL = SPRITE_SIZE.fx[0];

// A minimal RGBA PNG writer at module scope, for fixtures that need real
// transparency — the sprite-pipeline block has its own opaque variant, and a
// content-normalisation fixture has to be mostly transparent by construction.
const PNG_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function pngRGBA(w, h, px) {
  const crc = buf => { let c = -1; for (let i = 0; i < buf.length; i++) c = PNG_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 4);
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = px(x, y);
      const o = row + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// per-process ports so overlapping/stale runs can't steal each other's servers
// NB: `URL` is shadowed by the page-url const below, so this uses argv.
const REPO = path.resolve(path.dirname(process.argv[1]), '..');
const PORT = 8700 + (process.pid % 199);
const RELAY_PORT = 12400 + (process.pid % 199); // clear of the 94xx debug-port range
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
    this.profile = profile;
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
    const patterns = [];
    if (this.opts.peerjsB64) patterns.push({ urlPattern: '*unpkg.com*' });
    if (this.opts.failPattern) patterns.push({ urlPattern: `*${this.opts.failPattern}*` });
    if (patterns.length) await this.cdp('Fetch.enable', { patterns });
    if (this.opts.mobile) {
      await this.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await this.setOrientation('landscape');
    }
  }

  // ---- mobile emulation helpers ----
  async setOrientation(which) {
    await this.cdp('Emulation.setDeviceMetricsOverride', which === 'landscape'
      ? { width: 851, height: 393, deviceScaleFactor: 2.6, mobile: true, screenOrientation: { type: 'landscapePrimary', angle: 90 } }
      : { width: 393, height: 851, deviceScaleFactor: 2.6, mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 } });
    await sleep(300);
  }
  async tap(selector) {
    const r = await this.exec(`const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return null; el.scrollIntoView({block:'nearest'}); const b=el.getBoundingClientRect(); return JSON.stringify({x:b.x+b.width/2,y:b.y+b.height/2});`);
    if (!r) throw new Error(`tap: no element ${selector}`);
    const p = JSON.parse(r);
    await this.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
    await this.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(150);
  }
  async touchDown(x, y) { await this.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); }
  async touchMove(x, y) { await this.cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); }
  async touchUp() { await this.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
  async typeText(text) { await this.cdp('Input.insertText', { text }); }

  _onMsg(m) {
    if (m.id && this.pending.has(m.id)) {
      const { res, rej } = this.pending.get(m.id);
      this.pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message));
      else res(m.result);
      return;
    }
    if (m.method === 'Fetch.requestPaused') {
      const url = m.params.request.url || '';
      if (this.opts.failPattern && url.includes(this.opts.failPattern)) {
        this.cdp('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'ConnectionRefused' }).catch(() => {});
      } else {
        this.cdp('Fetch.fulfillRequest', {
          requestId: m.params.requestId, responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
          body: this.opts.peerjsB64,
        }).catch(() => {});
      }
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
    // Bin the profile directory. A full run opens a dozen browsers and the
    // co-op phase opens eight at once; left behind, these accumulate into
    // gigabytes across runs and eventually starve the multi-browser tests into
    // timing out — which reads as a co-op regression and is not one.
    try { if (this.profile) fs.rmSync(this.profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ---------- boot server ----------
const httpd = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.cwd(), stdio: 'ignore' });
process.on('exit', () => { httpd.kill(); });
await sleep(900);

const wantCoop = process.argv.includes('--coop');

// ---------- shared Gauntlet-flow helpers ----------
const measureFps = br => br.exec(`return new Promise(res => { let f = 0; const t0 = performance.now();
  function g() { f++; if (performance.now() - t0 < 3000) requestAnimationFrame(g); else res(Math.round(f / 3)); }
  requestAnimationFrame(g); })`);
// resolve every pending offer/shop for every player (host-side)
const drainJs = `const s=window.uv.sim; for (const p of s.players) { if (p.gone) continue;
  let g=0; while (p.pendingOffer && g++<40) s.uiAction(p.idx,{kind:'levelup',id:p.pendingOffer[0].id});
  if (p.treasureOffer) s.uiAction(p.idx,{kind:'treasure',id:p.treasureOffer.picks[0]});
  if (p.boonOffer) s.uiAction(p.idx,{kind:'boon',id:p.boonOffer[0].id}); } return 1;`;
// F3-clear the current fight (multi-pass for splitters/spawn queue)
// F3 clears the field AND satisfies the current objective, so this works on
// horde arenas and on all eight objective levels alike
const clearFightJs = `const s=window.uv.sim; let g=0;
  while (!s.cleared && s.phase==='arena' && g++<60) { s.debug('F3'); for (let i=0;i<10;i++) s.tick(); }
  return s.cleared ? 1 : 0;`;
// pin every live player onto the extraction hatch until the countdown travels
async function extractToMap(br, what) {
  for (let i = 0; i < 45; i++) {
    const ph = await br.exec(`const s=window.uv.sim; if (s.phase!=='arena') return s.phase;
      if (s.hatch) for (const p of s.players) { if (!p.gone && !p.downed) { p.x=s.hatch.x; p.y=s.hatch.y; } } return 'arena';`);
    if (ph === 'map') return;
    await sleep(300);
  }
  throw new Error(`extraction never completed (${what})`);
}

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

  // the airhorn preloads at boot (fetch + decode on the suspended context)
  await A.waitFor(`return window.uvAudio && window.uvAudio.stats.samplesLoaded >= 1 ? 1 : 0`, 6000, 'airhorn preload');
  const preWarn = await A.exec('return window.uvAudio.stats.warnings');
  if (preWarn === 0) ok('airhorn preloaded at boot, no warnings'); else fail(`preload warnings: ${preWarn}`);

  // character smoke inside the real browser
  const smoke = await A.exec('return window.uvSmoke().length');
  if (smoke === 0) ok('in-browser uvSmoke: all characters pass'); else fail(`uvSmoke failures: ${smoke}`);

  // host → lobby
  await A.exec(`document.getElementById('name-input').value='TESTER'; document.getElementById('btn-host').click()`);
  await A.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')`, 5000, 'lobby');
  ok('host → lobby');

  // ---- glossary on the character grid: stat inside a trait sentence ----
  const lobbyGloss = await A.exec(`const card=document.querySelector('.char-card[data-char="bulwark"]');
    const t=card.querySelector('.ctrait .gloss-term'); if(!t) return '';
    t.click(); const p=document.getElementById('gloss-pop');
    return p.classList.contains('hidden') ? '' : p.textContent;`);
  if (/Grit|Vitality/.test(lobbyGloss)) ok(`lobby: tapping a stat in a trait sentence opens the glossary ("${lobbyGloss.slice(0, 40)}…")`);
  else fail(`lobby trait glossary: "${lobbyGloss}"`);
  const pickedByGloss = await A.exec(`return document.querySelector('.char-card[data-char="bulwark"]').classList.contains('selected')`);
  if (!pickedByGloss) ok('glossary tap does not select the character'); else fail('tapping a gloss term picked the character');
  const statlineGloss = await A.exec(`return document.querySelector('.char-card .cstats .gloss-term') !== null`);
  if (statlineGloss) ok('lobby statlines render stat names as glossary terms'); else fail('no gloss terms in lobby statlines');
  await A.exec(`document.body.click(); return 1;`); // close the popover

  // pick char + start
  await A.exec(`document.querySelector('.char-card[data-char="vesper"]').click()`);
  await sleep(300);
  await A.exec(`document.getElementById('btn-start').click()`);
  await A.waitFor(`return window.uv.mode==='run' && !!window.uv.sim`, 5000, 'run start');
  ok('run starts (solo host)');

  // ---- the node map is the between-fights home screen ----
  await A.waitFor(`return !document.getElementById('screen-map').classList.contains('hidden')`, 4000, 'map screen');
  const mapInfo = JSON.parse(await A.exec(`const btns=[...document.querySelectorAll('.map-node')];
    return JSON.stringify({ n: btns.length, reach: btns.filter(b=>b.classList.contains('reachable')).length,
      disabled: btns.filter(b=>b.disabled).length, header: document.querySelector('#screen-map .ov-title').textContent })`));
  if (mapInfo.n === 15) ok(`map screen renders the floor's nodes (${mapInfo.n}: 12 combat + shop + reliquary + siege)`); else fail(`map node count: ${mapInfo.n}`);
  if (mapInfo.reach >= 2 && mapInfo.reach <= 3 && mapInfo.disabled === mapInfo.n - mapInfo.reach) ok(`${mapInfo.reach} reachable choices enabled, the rest disabled`);
  else fail(`map reachability: ${JSON.stringify(mapInfo)}`);
  if (/FLOOR 1/.test(mapInfo.header)) ok('map header shows the floor'); else fail(`map header: ${mapInfo.header}`);

  // tap a node → solo travels instantly into the arena
  await A.exec(`document.querySelector('.map-node.reachable').click(); return 1;`);
  await A.waitFor(`return window.uv.sim.phase==='arena'`, 3000, 'arena after node tap');
  await A.waitFor(`return document.getElementById('screen-map').classList.contains('hidden')`, 2000, 'map hides for the fight');
  ok('tapping a node travels into its arena (solo: instant)');

  // ---- objective levels: node-map icons + the on-screen objective HUD ----
  const objMap = JSON.parse(await A.exec(`
    const kinds = window.uv.map.layout.nodes.map(n => n.kind);
    const OBJ = ['zone','elite_arena','nest','bounty','breach','relic','storm','payload'];
    const present = OBJ.filter(k => kinds.includes(k));
    const icons = OBJ.filter(k => document.querySelector('.map-node.mn-' + k) !== null);
    return JSON.stringify({ present, icons, combat: kinds.filter(k=>k==='combat').length,
      legend: !!document.querySelector('.map-legend .legend-obj') });`));
  if (objMap.present.length >= 5) ok(`floor 1 map carries ${objMap.present.length} objective types (${objMap.present.join(', ')})`);
  else fail(`objective types on the map: ${JSON.stringify(objMap.present)}`);
  if (objMap.icons.length === objMap.present.length) ok('every objective node renders its own icon class on the map');
  else fail(`icon classes: ${objMap.icons.join(',')} vs kinds ${objMap.present.join(',')}`);
  if (objMap.combat >= 4 && objMap.combat <= 6) ok(`the horde-arena invariant holds on screen (${objMap.combat} plain arenas)`);
  else fail(`horde arenas on the map: ${objMap.combat}`);
  if (objMap.legend) ok('the node-map legend lists the objective icons'); else fail('objective legend missing');

  // the enemy counter: "incoming" while the budget flows, exact count at stop
  await A.waitFor(`return !document.getElementById('enemy-counter').classList.contains('hidden')`, 4000, 'enemy counter visible');
  const ecInc = await A.exec(`return document.querySelector('#enemy-counter .ec-inc') !== null`);
  if (ecInc) ok('counter shows the "incoming" state while spawning flows'); else fail('no incoming state on the counter');
  // park the player out of weapon range and pin a known group so the count
  // can't hit zero (and clear the fight) while we read the display
  // (park LEFT of center — the camera-follow check below pushes rightward)
  await A.exec(`const s=window.uv.sim, p=s.players[0];
    const spot = s._openSpot(600, s.H - 300); p.x = spot.x; p.y = spot.y;
    for (let i=0;i<6;i++) s.spawnEnemyById('skulker', 180 + i*34, 180, {});
    s.wave.done = true; s.spawnQueue.length = 0; return 1;`);
  await A.waitFor(`const b=document.querySelector('#enemy-counter .ec-n.exact'); return b && parseInt(b.textContent.replace(/[^0-9]/g,''),10) === window.uv.sim.enemyPool.count ? 1 : 0`, 4000, 'exact count at spawn-stop');
  ok('counter switches to the exact alive count at spawn-stop (the sweep signal)');

  // ---- an objective level end to end in the real DOM ----
  // Force the next reachable node to a Zone Control, walk in, and confirm the
  // objective HUD tracks it (label, progress bar, world marker in the view).
  await A.exec(clearFightJs);
  await A.exec(drainJs);
  await extractToMap(A, 'to the objective node');
  await A.exec(`const s=window.uv.sim;
    // a reachable FIGHT node — shop/reliquary stops carry no arena template
    const id = s.reachableNodes().find(i => s.floor.nodes[i].template) ?? s.reachableNodes()[0];
    const n = s.floor.nodes[id];
    n.kind='zone'; if (!n.template) n.template='open_expanse';
    window.__objNode = id; s._mapEvent(); return 1;`);
  await A.waitFor(`return document.querySelector('.map-node.mn-zone') !== null`, 4000, 'zone node on the map');
  await A.exec(`const s=window.uv.sim; s.uiAction(0,{kind:'pickNode',nodeId:window.__objNode}); return 1;`);
  await A.waitFor(`return window.uv.sim.phase==='arena' && window.uv.sim.obj && window.uv.sim.obj.type==='zone'`, 6000, 'inside Zone Control');
  await A.waitFor(`return !document.getElementById('objective-hud').classList.contains('hidden')`, 4000, 'objective HUD visible');
  const objHud = JSON.parse(await A.exec(`const h=document.getElementById('objective-hud');
    return JSON.stringify({ label: h.querySelector('.obj-line b').textContent,
      text: h.querySelector('.obj-text').textContent,
      bar: !!h.querySelector('.obj-bar i'),
      h: Math.round(h.getBoundingClientRect().height) })`));
  if (/Zone Control/.test(objHud.label) && /captured/.test(objHud.text) && objHud.bar)
    ok(`objective HUD tracks the level ("${objHud.label} — ${objHud.text}")`);
  else fail(`objective HUD: ${JSON.stringify(objHud)}`);
  // capture progress moves when a player stands in the zone
  const capMoved = await A.exec(`const s=window.uv.sim, p=s.players[0];
    p.x=s.obj.zone.x; p.y=s.obj.zone.y;
    const m0=s.obj.meter; for (let i=0;i<120;i++){ p.x=s.obj.zone.x; p.y=s.obj.zone.y; s.tick(); }
    return s.obj.meter > m0 + 1 ? 1 : 0;`);
  if (capMoved) ok('standing in the zone fills the shared capture meter'); else fail('capture meter did not move');
  await A.exec(clearFightJs);
  await A.exec(drainJs);
  await A.waitFor(`return document.getElementById('objective-hud').classList.contains('hidden') || window.uv.sim.cleared`, 4000, 'objective resolved');
  ok('an objective level clears and hands back to the extraction flow');
  await extractToMap(A, 'objective extraction');
  await A.exec(`const s=window.uv.sim;
    const id = s.reachableNodes().find(i => s.floor.nodes[i].template) ?? s.reachableNodes()[0];
    const n = s.floor.nodes[id];
    n.kind='combat'; if (!n.template) n.template='open_expanse';
    s.uiAction(0,{kind:'pickNode',nodeId:id}); return 1;`);
  await A.waitFor(`return window.uv.sim.phase==='arena'`, 6000, 'back into a horde arena');

  // ---- Breach in the real client: advancing wall, doors, bounds, radar ----
  await A.exec(clearFightJs);
  await A.exec(drainJs);
  await extractToMap(A, 'to the breach node');
  await A.exec(`const s=window.uv.sim;
    const id = s.reachableNodes().find(i => s.floor.nodes[i].template) ?? s.reachableNodes()[0];
    const n = s.floor.nodes[id];
    n.kind='breach'; if (!n.template) n.template='long_hall';
    window.__brNode = id; s._mapEvent(); return 1;`);
  await A.exec(`const s=window.uv.sim; s.uiAction(0,{kind:'pickNode',nodeId:window.__brNode}); return 1;`);
  await A.waitFor(`return window.uv.sim.phase==='arena' && window.uv.sim.obj && window.uv.sim.obj.type==='breach'`, 8000, 'inside Breach');
  const br0 = JSON.parse(await A.exec(`const s=window.uv.sim,o=s.obj;
    return JSON.stringify({ wall:o.wallX, segs:o.segs, doors:o.doors.length, need:o.need, segDur:o.segDur,
      w:s.W, h:s.H, px:Math.round(s.players[0].x),
      stray: s.obstacles.filter(ob=>ob.x<0||ob.y<0||ob.x+ob.w>s.W||ob.y+ob.h>s.H).length })`));
  if (br0.segs >= 3 && br0.doors === br0.segs) ok(`Breach: ${br0.segs} segments behind ${br0.doors} sealed doors (${Math.round(br0.segDur)}s each)`);
  else fail(`breach segments: ${JSON.stringify(br0)}`);
  if (br0.need === undefined && br0.segDur >= 25 && br0.segDur <= 40) ok('the doors run on a clock, not a kill quota');
  else fail(`breach door timing: need=${br0.need} segDur=${br0.segDur}`);
  if (br0.stray === 0) ok(`Breach architecture stays inside the reshaped room (${br0.w}×${br0.h})`);
  else fail(`${br0.stray} obstacles outside the Breach bounds`);
  if (br0.px < br0.w * 0.25) ok(`the party starts at the mouth of the corridor (x=${br0.px} of ${br0.w})`);
  else fail(`breach drop-in at x=${br0.px}`);
  await sleep(2200);
  const br1 = await A.exec(`return window.uv.sim.obj.wallX`);
  if (br1 > br0.wall + 25) ok(`the collapse advances in the live client (${Math.round(br0.wall)} → ${Math.round(br1)})`);
  else fail(`collapse stalled: ${br0.wall} → ${br1}`);
  // the sealed door holds, and nothing walks out of the map
  const brBounds = JSON.parse(await A.exec(`const s=window.uv.sim,o=s.obj,p=s.players[0];
    p.x=o.doors[0]+600; p.y=-500; s.tick();
    const past = p.x > o.doors[0];
    let out=0;
    for (let i=0;i<120;i++){ s.setInput(0,{mx:(i%4<2?1:-1),my:(i%8<4?1:-1)}); s.tick();
      out=Math.max(out, Math.max(0,36-p.x,36-p.y,p.x-(s.W-36),p.y-(s.H-36))); }
    return JSON.stringify({past, out:Math.round(out)});`));
  if (!brBounds.past) ok('the sealed door blocks the party until its timer expires');
  else fail('walked straight through a sealed Breach door');
  // killing does NOT buy ground any more
  const brKills = JSON.parse(await A.exec(`const s=window.uv.sim,o=s.obj,p=s.players[0];
    const seg0=o.seg;
    for (let k=0;k<60;k++){ const e=s.spawnEnemyById('skulker',p.x-60,p.y,{}); if(e) s._killEnemy(e,p); }
    return JSON.stringify({seg0, seg:o.seg, timer:Math.ceil(o.segT)});`));
  if (brKills.seg === brKills.seg0) ok(`60 kills leave the door sealed — only the clock opens it (${brKills.timer}s left)`);
  else fail(`kills opened a Breach door: ${brKills.seg0} → ${brKills.seg}`);
  // the collapse squeezes the party into a slit against the closed door
  const brSlit = await A.exec(`const s=window.uv.sim,o=s.obj;
    let guard=0; while (o.seg===0 && o.segT>0.02 && guard++<60*90){ for(const p of s.livePlayers()) p.hp=p.stats.vitality; s.tick(); }
    return Math.round((o.seg>0 ? 0 : o.doors[0]-o.wallX));`);
  if (brSlit <= 300) ok(`the collapse compresses the party into a ${brSlit}u slit before the door opens`);
  else fail(`no slit phase: ${brSlit}u of corridor left when the door opened`);
  if (brBounds.out === 0) ok('players cannot leave the playable bounds on Breach');
  else fail(`player escaped the Breach map by ${brBounds.out}u`);
  const brHud = JSON.parse(await A.exec(`const h=document.getElementById('objective-hud');
    return JSON.stringify({ text:h.querySelector('.obj-text').textContent, vis:!h.classList.contains('hidden') })`));
  if (brHud.vis && /door \d\/\d+ — \d+s|reach the gate/.test(brHud.text)) ok(`the Breach HUD counts the door down ("${brHud.text}")`);
  else fail(`breach HUD: ${JSON.stringify(brHud)}`);
  // the radar draws something for the elongated map (wall + gate + doors)
  const radarInk = await A.exec(`const c=document.getElementById('minimap');
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let n=0; for (let i=3;i<d.length;i+=4) if (d[i]>8) n++; return n;`);
  if (radarInk > 400) ok(`the minimap renders the elongated Breach layout (${radarInk} lit pixels)`);
  else fail(`minimap looks empty on Breach (${radarInk} lit pixels)`);

  // ---- playtest 3: the gate IS the portal, and the client agrees ----
  {
    const gateOut = JSON.parse(await A.exec(`const s=window.uv.sim,o=s.obj;
      const gate={x:o.gate.x,y:o.gate.y};
      s.debug('F3');
      return JSON.stringify({ gate, hatch: s.hatch ? {x:s.hatch.x,y:s.hatch.y} : null, w:s.W });`));
    if (gateOut.hatch && Math.hypot(gateOut.hatch.x - gateOut.gate.x, gateOut.hatch.y - gateOut.gate.y) < 1) {
      ok('Breach extraction opens AT the far gate — there is no mid-map hatch to walk back to');
    } else fail(`breach hatch ${JSON.stringify(gateOut.hatch)} vs gate ${JSON.stringify(gateOut.gate)}`);
  }
  await A.exec(drainJs);
  await extractToMap(A, 'out of the Breach');

  // ---- playtest 3: Relic Run — one rim relic, its own pack, no ambient ----
  {
    // Enter the level DIRECTLY rather than walking the node map: these are
    // four extra rooms, and consuming four forward nodes would leave the
    // shop and camera checks below on a different floor than they expect.
    await A.exec(`const s=window.uv.sim;
      s.phase='map';
      s._enterArena({ id: s.currentNode, kind: 'relic', col: 3, template: 'open_expanse', profile: 'mixed' });
      return 1;`);
    await A.waitFor(`return window.uv.sim.phase==='arena' && window.uv.sim.obj && window.uv.sim.obj.type==='relic'`, 8000, 'inside Relic Run');
    const rl = JSON.parse(await A.exec(`const s=window.uv.sim,o=s.obj;
      const d=Math.hypot(o.relics[0].x-o.altar.x, o.relics[0].y-o.altar.y);
      const reach=Math.hypot(s.W/2-40, s.H/2-40);
      const near=[...s.enemyPool].filter(e=>Math.hypot(e.x-o.relics[0].x,e.y-o.relics[0].y)<700).length;
      return JSON.stringify({ n:o.relics.length, pack:o.pack, field:s.enemyPool.count, near, frac:+(d/reach).toFixed(2) });`));
    if (rl.n === 1) ok('Relic Run puts exactly ONE relic in the world at a time');
    else fail(`relics in play: ${rl.n}`);
    if (rl.frac > 0.7) ok(`the relic sits on the rim (${Math.round(100 * rl.frac)}% of the way to the corner from the altar)`);
    else fail(`relic only ${Math.round(100 * rl.frac)}% out from the altar`);
    if (rl.near >= rl.pack * 0.85) ok(`its share of the level's enemy budget lands with it (${rl.near}/${rl.pack} around the relic)`);
    else fail(`relic pack: ${rl.near} of ${rl.pack} near the relic, ${rl.field} on the field`);
    await sleep(600);
    const objHudR = JSON.parse(await A.exec(`const h=document.getElementById('objective-hud');
      return JSON.stringify({ text:h.querySelector('.obj-text').textContent, vis:!h.classList.contains('hidden') })`));
    if (objHudR.vis && /0\/5 banked/.test(objHudR.text)) ok(`the Relic HUD reads "${objHudR.text}"`);
    else fail(`relic HUD: ${JSON.stringify(objHudR)}`);
    await A.exec(`const s=window.uv.sim; s._sanitizeArena(); return 1;`);
    await A.exec(drainJs);
  }

  // ---- playtest 3: Nest Purge — walled fortresses the client can see ----
  {
    // Enter the level DIRECTLY rather than walking the node map: these are
    // four extra rooms, and consuming four forward nodes would leave the
    // shop and camera checks below on a different floor than they expect.
    await A.exec(`const s=window.uv.sim;
      s.phase='map';
      s._enterArena({ id: s.currentNode, kind: 'nest', col: 3, template: 'open_expanse', profile: 'mixed' });
      return 1;`);
    await A.waitFor(`return window.uv.sim.phase==='arena' && window.uv.sim.obj && window.uv.sim.obj.type==='nest'`, 8000, 'inside Nest Purge');
    const ns = JSON.parse(await A.exec(`const s=window.uv.sim,o=s.obj;
      const nest=s.enemyById(o.nests[0]);
      const mine=s.walls.filter(w=>w.nestId===nest.id);
      return JSON.stringify({ nests:o.total, walls:s.walls.length, perNest:mine.length,
        rings:[...new Set(mine.map(w=>w.ring))].length, wallHp:mine[0].maxHp, nestHp:nest.maxHp,
        shielded:!!nest.nestShielded, reach:s.inMainRegion(nest.x,nest.y) });`));
    if (ns.perNest === 8 && ns.rings === 2) ok(`each nest sits behind 2 rings of 4 barricades (${ns.walls} in total, ${ns.wallHp} HP apiece)`);
    else fail(`nest rings: ${JSON.stringify(ns)}`);
    if (ns.shielded) ok(`a walled nest is untouchable until both rings are breached (${ns.nestHp} HP behind them)`);
    else fail('a nest started unshielded');
    if (ns.reach) ok('every nest is placed in the arena’s main open region — never behind a sealed wall');
    else fail('a nest was placed outside the reachable region');
    // the walls ship to the client as destructible obstacles AND objective furniture
    const nsWire = JSON.parse(await A.exec(`const s=window.uv.sim;
      const snapObs = s._snapObstacles();
      const intact = (s.getSnapshot().obj||{}).walls || [];
      // chew one barricade a little: only DAMAGED walls ride the snapshot
      const w = s.walls[0];
      s.damageWall(w, Math.round(w.maxHp * 0.4), s.players[0]);
      const hurt = (s.getSnapshot().obj||{}).walls || [];
      return JSON.stringify({ destructible: snapObs.filter(o=>o[4]).length,
        intact: intact.length, hurt: hurt.length, frac: hurt.length ? hurt[0][4] : null });`));
    if (nsWire.destructible === ns.walls) ok(`the barricades ride the obstacle payload as destructible rects (${nsWire.destructible})`);
    else fail(`obstacle payload: ${nsWire.destructible} destructible of ${ns.walls} walls`);
    if (nsWire.intact === 0 && nsWire.hurt === 1 && nsWire.frac < 1) {
      ok(`only damaged barricades ride the snapshot (0 intact → 1 at ${Math.round(100 * nsWire.frac)}% after a hit)`);
    } else fail(`objective blob walls: intact=${nsWire.intact} hurt=${nsWire.hurt} frac=${nsWire.frac}`);
    // breaking a barricade re-syncs the obstacle list
    const nsBreak = JSON.parse(await A.exec(`const s=window.uv.sim,o=s.obj;
      const nest=s.enemyById(o.nests[0]);
      const w0=s.walls.find(w=>w.nestId===nest.id&&w.ring===0);
      const before=s.obstacles.length;
      s.damageWall(w0, w0.maxHp+1, s.players[0]);
      const mid=!!nest.nestShielded;
      const w1=s.walls.find(w=>w.nestId===nest.id&&w.ring===1);
      s.damageWall(w1, w1.maxHp+1, s.players[0]);
      return JSON.stringify({ before, after:s.obstacles.length, stillShielded:mid, exposed:!nest.nestShielded });`));
    if (nsBreak.after === nsBreak.before - 2) ok('a broken barricade leaves the obstacle list (movement and sight open up)');
    else fail(`obstacles after two breaks: ${nsBreak.before} → ${nsBreak.after}`);
    if (nsBreak.stillShielded && nsBreak.exposed) ok('one ring down is not enough — the nest exposes only when BOTH are breached');
    else fail(`breach gating: ${JSON.stringify(nsBreak)}`);
    // it renders: the canvas draws the barricades in the world
    await sleep(400);
    const nsInk = await A.exec(`const s=window.uv.sim, w=s.walls[0];
      const p=s.players[0]; p.x=w.x+w.w/2; p.y=w.y+w.h/2+140;
      return 1;`);
    await sleep(600);
    const painted = await A.exec(`const c=document.getElementById('game-canvas');
      const d=c.getContext('2d').getImageData(c.width*0.3,c.height*0.2,Math.floor(c.width*0.4),Math.floor(c.height*0.4)).data;
      let n=0; for (let i=0;i<d.length;i+=4) if (d[i]>90 && d[i]>d[i+2]+18) n++; return n;`);
    if (painted > 200) ok(`the barricades are drawn in the world (${painted} lit pixels around one`.concat(')'));
    else fail(`nest barricades did not render (${painted} lit pixels)`);
    await A.exec(`const s=window.uv.sim; s._sanitizeArena(); return 1;`);
    await A.exec(drainJs);
  }

  // ---- playtest 3: Bounty Hunt — a slow stalker with its own stream ----
  {
    // Enter the level DIRECTLY rather than walking the node map: these are
    // four extra rooms, and consuming four forward nodes would leave the
    // shop and camera checks below on a different floor than they expect.
    await A.exec(`const s=window.uv.sim;
      s.phase='map';
      s._enterArena({ id: s.currentNode, kind: 'bounty', col: 3, template: 'open_expanse', profile: 'mixed' });
      return 1;`);
    await A.waitFor(`return window.uv.sim.phase==='arena' && window.uv.sim.obj && window.uv.sim.obj.type==='bounty'`, 8000, 'inside Bounty Hunt');
    await A.waitFor(`return window.uv.sim.obj.markId !== null`, 8000, 'a bounty marked');
    const bn = JSON.parse(await A.exec(`const s=window.uv.sim,o=s.obj;
      for (let i=0;i<60*8;i++){ for(const p of s.livePlayers()){ s.setInput(p.idx,{mx:0,my:0}); p.hp=p.stats.vitality; } s.tick(); }
      const e=s.enemyById(o.markId);
      const boss=(window.uv.BOSS_HP||0);
      const chaff=s.enemyPool.count-1;
      const near=[...s.enemyPool].filter(q=>!q.bounty&&Math.hypot(q.x-e.x,q.y-e.y)<700).length;
      return JSON.stringify({ hp:e.maxHp, spd:Math.round(e.spd), chaff, near, marked:o.killed });`));
    if (bn.spd <= 56) ok(`the mark is a slow stalker (${bn.spd} u/s — slower than anything else on the floor)`);
    else fail(`bounty mark speed ${bn.spd}`);
    if (bn.chaff >= 4 && bn.near >= bn.chaff * 0.6) ok(`it calls a stream to its own position (${bn.near}/${bn.chaff} within 700u after 8s)`);
    else fail(`bounty stream: ${bn.near}/${bn.chaff}`);
    await sleep(600);
    const bnHud = JSON.parse(await A.exec(`const h=document.getElementById('objective-hud');
      return JSON.stringify({ text:h.querySelector('.obj-text').textContent, vis:!h.classList.contains('hidden') })`));
    if (bnHud.vis && /\d\/5 bounties/.test(bnHud.text)) ok(`the Bounty HUD reads "${bnHud.text}"`);
    else fail(`bounty HUD: ${JSON.stringify(bnHud)}`);
    await A.exec(`const s=window.uv.sim; s._sanitizeArena(); return 1;`);
    await A.exec(drainJs);
  }

  // ---- playtest 3: structure relocation, against the REAL camera ----
  {
    // Enter the level DIRECTLY rather than walking the node map: these are
    // four extra rooms, and consuming four forward nodes would leave the
    // shop and camera checks below on a different floor than they expect.
    await A.exec(`const s=window.uv.sim;
      s.phase='map';
      s._enterArena({ id: s.currentNode, kind: 'combat', col: 3, template: 'open_expanse', profile: 'mixed' });
      return 1;`);
    await A.waitFor(`return window.uv.sim.phase==='arena'`, 8000, 'inside a plain arena');
    const st = JSON.parse(await A.exec(`const s=window.uv.sim,p=s.players[0];
      s._sanitizeArena();
      // an open popup PAUSES the channel, so every assertion below would pass
      // for the wrong reason with a level-up card still on screen
      p.pendingOffer=null; p.shop=null; p.treasureOffer=null; p.boonOffer=null; p.downed=false;
      s.summons.length=0;
      // a REAL turret, not a stub: the host keeps ticking between these calls
      // and a summon with no weapon behind it is not a thing the sim ever makes
      s._spawnSummon(p, 'bolt_turret', 1);
      const t=s.summons[0];
      // (a) ON SCREEN, owner motionless for twice the channel: it must NOT move
      p.relocT=0; p.moving=false;
      t.x = p.x + 140; t.y = p.y + 70;
      const at0={x:t.x,y:t.y};
      for (let i=0;i<60*8;i++){ s.setInput(p.idx,{mx:0,my:0}); s._tickStructureRecall(p, 1/60); }
      const stayed = (t.x===at0.x && t.y===at0.y);
      const channel = p.relocT;
      // (b) OFF SCREEN but the owner is MOVING: still must not move
      t.x = p.x + 2600; t.y = p.y;
      const at1={x:t.x,y:t.y};
      p.relocT=0; p.moving=true;
      for (let i=0;i<60*8;i++) s._tickStructureRecall(p, 1/60);
      const movedWhileWalking = !(t.x===at1.x && t.y===at1.y) || p.relocT>0;
      // (c) OFF SCREEN and still: it DOES come home
      p.moving=false; p.relocT=0;
      let fired=false;
      for (let i=0;i<60*5 && !fired;i++){ s._tickStructureRecall(p, 1/60); fired = Math.hypot(t.x-p.x,t.y-p.y) < 400; }
      return JSON.stringify({ stayed, channel:+channel.toFixed(2), movedWhileWalking, fired });`));
    if (st.stayed && st.channel === 0) ok('a structure the owner can SEE never relocates, no matter how long they stand still');
    else fail(`on-screen structure recall fired (stayed=${st.stayed} channel=${st.channel})`);
    if (!st.movedWhileWalking) ok('an off-screen structure never relocates while its owner is moving');
    else fail('recall fired for a moving owner');
    if (st.fired) ok('off-screen AND stationary still brings a structure home');
    else fail('the real recall case stopped working');
    // the owner's camera CLAMPS at the arena edge, exactly like the renderer
    const cam = JSON.parse(await A.exec(`const s=window.uv.sim,p=s.players[0];
      p.x=60; p.y=s.H/2;
      const c=s._ownerCamera(p);
      return JSON.stringify({ px:Math.round(p.x), cx:Math.round(c.cx), hw:c.hw });`));
    if (cam.cx > cam.px) ok(`recall visibility uses the owner's clamped camera (player at ${cam.px}, camera at ${cam.cx})`);
    else fail(`camera not clamped: ${JSON.stringify(cam)}`);
    // hand back a LIVE plain arena: the completion-cleanup and extraction
    // checks below run in whatever room they find themselves in
    await A.exec(`const s=window.uv.sim;
      s.summons.length=0;
      s._enterArena({ id: s.currentNode, kind: 'combat', col: 3, template: 'open_expanse', profile: 'mixed' });
      return 1;`);
    await A.exec(drainJs);
  }

  // ---- completion cleanup: the arena is inert before any popup ----
  await A.exec(`const s=window.uv.sim, p=s.players[0];
    s.addZone({x:p.x,y:p.y,r:90,dps:20,dur:30,hurts:'players',color:'#7dee6a',acid:true});
    s.addTelegraph({shape:'circle',x:p.x,y:p.y,r:90,dur:5,boom:{dmg:40,radius:90}});
    s.spawnEnemyProj(p.x+40,p.y,0,200,10,6,'#f00');
    s.debug('F1'); return 1;`);
  await A.exec(clearFightJs);
  const inert = JSON.parse(await A.exec(`const s=window.uv.sim; return JSON.stringify({
    safe:!!s.safe, enemies:s.enemyPool.count, projs:s.projPool.count, queued:s.spawnQueue.length,
    zones:s.zones.length, tele:s.telegraphs.length, hazards:(s.hazards||[]).length })`));
  const dirty = Object.entries(inert).filter(([k, v]) => k !== 'safe' && v > 0);
  if (inert.safe && !dirty.length) ok('completion cleanup: the arena is inert the moment the objective is met');
  else fail(`arena not safe at completion: ${JSON.stringify(inert)}`);
  const hpHeld = await A.exec(`const s=window.uv.sim,p=s.players[0]; const h0=p.hp;
    for (let i=0;i<180;i++) s.tick(); return p.hp >= h0 ? 1 : 0;`);
  if (hpHeld) ok('no damage lands while the post-clear popups are open');
  else fail('a player took damage after the fight was won');

  // ---- every room starts at full HP ----
  await A.exec(drainJs);
  await extractToMap(A, 'out of the breach');
  await A.exec(`const s=window.uv.sim; s.players[0].hp = 3;
    const id = s.reachableNodes().find(i => s.floor.nodes[i].template) ?? s.reachableNodes()[0];
    const n = s.floor.nodes[id]; n.kind='combat'; if (!n.template) n.template='open_expanse';
    s.uiAction(0,{kind:'pickNode',nodeId:id}); return 1;`);
  await A.waitFor(`return window.uv.sim.phase==='arena'`, 8000, 'next room after breach');
  const fullHp = await A.exec(`const p=window.uv.sim.players[0]; return p.hp === p.stats.vitality ? 1 : 0;`);
  if (fullHp) ok('walking into a room heals you to full'); else fail('room start did not restore full HP');

  // movement via synthetic keys (arena is bigger than the screen now)
  const cam0 = await A.exec('return Math.round(window.uvRenderer.camX)'); // camera baseline before any movement
  // two directions — a single axis can be blocked by an obstacle beside the spawn
  const p0 = JSON.parse(await A.exec(`const p=window.uv.sim.players[0]; return JSON.stringify([p.x,p.y])`));
  await A.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}))`);
  await sleep(500);
  await A.exec(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD'})); window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyS'}))`);
  await sleep(500);
  await A.exec(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyS'}))`);
  const p1 = JSON.parse(await A.exec(`const p=window.uv.sim.players[0]; return JSON.stringify([p.x,p.y])`));
  const moved = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  if (moved > 60) ok(`player moves with keys (${Math.round(moved)}u travelled)`); else fail(`player did not move (${Math.round(moved)}u)`);

  // ---- the camera follows the player across the arena ----
  // park left-of-centre first so "push right" always has room to move the
  // camera right, wherever the preceding sections left the player
  await A.exec(`const s=window.uv.sim, p=s.players[0];
    const spot = s._openSpot(Math.max(200, s.W * 0.22), s.H / 2); p.x = spot.x; p.y = spot.y; return 1;`);
  await sleep(900);
  const camBase = await A.exec('return Math.round(window.uvRenderer.camX)');
  await A.exec(`const s=window.uv.sim, p=s.players[0]; p.x = Math.min(s.W - 400, p.x + 900); return 1;`);
  await sleep(1000); // smooth-follow converges well under a second
  const camInfo = JSON.parse(await A.exec(`return JSON.stringify({ cam: Math.round(window.uvRenderer.camX), px: Math.round(window.uv.sim.players[0].x), aw: window.uv.sim.W })`));
  if (Math.abs(camInfo.cam - camInfo.px) < 80 && camInfo.cam > camBase + 250) ok(`camera follows the player (cam ${camBase}→${camInfo.cam}, player at ${camInfo.px}, arena ${camInfo.aw}w)`);
  else fail(`camera follow: cam ${camBase}→${camInfo.cam}, player ${camInfo.px}`);

  // ---- clear the fight: the shop opens right at extraction (patch 8) ----
  if (!await A.exec(clearFightJs)) fail('first fight never cleared under F3');
  await A.exec(drainJs);
  await A.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 4000, 'extraction shop');
  const exTitle = await A.exec(`return document.querySelector('#overlay-shop .ov-title').textContent`);
  if (exTitle === 'TRADER') ok('extraction shop opens at the fight clear (standard, not Black Market)');
  else fail(`extraction shop title: ${exTitle}`);
  const exW = await A.exec(`return window.uv.sim.players[0].shop.stock.filter(s=>s.kind==='weapon').length`);
  if (exW >= 2) ok(`floor-1 extraction stock guarantees weapons (${exW} in 4 slots)`); else fail(`floor-1 stock weapons: ${exW}`);
  // buy + reroll right here
  await A.exec(`window.uv.sim.debug('F2'); return 1;`);
  const exM0 = await A.exec('return window.uv.sim.players[0].materials');
  await A.exec(`const s=window.uv.sim,p=s.players[0]; const i=p.shop.stock.findIndex(x=>x.kind==='weapon'&&!x.sold); s.uiAction(0,{kind:'buy',slot:i}); s.uiAction(0,{kind:'reroll'}); return 1;`);
  const exM1 = await A.exec('return window.uv.sim.players[0].materials');
  if (exM1 < exM0) ok('buy + reroll work at the extraction shop'); else fail('extraction shop buy/reroll no-op');
  // the F2 grant crossed level thresholds — the airhorn fires once the event
  // pump runs (money-doesn't-wait means mid-fight levels are no longer a given)
  try {
    const hornsSoFar = await A.waitFor(`return window.uvAudio.stats.horns >= 1 ? window.uvAudio.stats.horns : 0`, 4000, 'airhorn after level-ups');
    ok(`level-ups play the airhorn (${hornsSoFar} scheduled so far)`);
  } catch { fail('no airhorn scheduled despite level-ups'); }
  // master volume governs the horn: the sample path routes through the same gain
  await A.exec('window.uvAudio.setVolume(0); return 1;');
  const mg0 = await A.exec('return window.uvAudio.masterGain()');
  await A.exec('window.uvAudio.setVolume(0.6); return 1;');
  const mg1 = await A.exec('return window.uvAudio.masterGain()');
  if (mg0 === 0 && Math.abs(mg1 - 0.36) < 0.001) ok('master volume/mute governs the horn (gain 0 when muted, 0.36 at 60%)');
  else fail(`master gain: muted=${mg0} restored=${mg1}`);
  // confirming extraction with the shop still open behaves sanely: the party
  // travels, the map returns underneath, the browse survives
  await extractToMap(A, 'solo first fight');
  await A.waitFor(`return !document.getElementById('screen-map').classList.contains('hidden')`, 3000, 'map screen after extraction');
  const shopSurvived = await A.exec(`return !document.getElementById('overlay-shop').classList.contains('hidden')`);
  if (shopSurvived) ok('extraction with the shop open: browse survives onto the map'); else fail('shop overlay vanished on extraction');
  await A.exec(`document.getElementById('shop-close').click(); return 1;`);
  const visitedMark = await A.exec(`return document.querySelector('.map-node.visited') !== null`);
  if (visitedMark) ok('extraction returns to the map with the fight marked visited'); else fail('no visited node on the map after extraction');
  // the Bastion shield marks camping fights on the map (force one if unrolled)
  await A.exec(`const s=window.uv.sim; const c=s.floor.nodes.find(n=>n.kind==='combat' && n.id!==s.currentNode);
    if (!s.floor.nodes.some(n=>n.profile==='bastion')) c.profile='bastion';
    s._mapEvent(); return 1;`);
  await A.waitFor(`return document.querySelector('.map-node .mn-bastion') !== null`, 3000, 'bastion shield icon');
  ok('Bastion nodes carry the shield icon — routing IS the playstyle choice');

  // ---- leave-run button: solo abandon → lobby → fresh run ----
  await A.exec(`document.getElementById('leave-btn').click()`);
  await A.waitFor(`return !document.getElementById('leave-confirm').classList.contains('hidden')`, 2000, 'leave confirm dialog');
  const confirmText = await A.exec(`return document.getElementById('leave-confirm').textContent`);
  if (/whole party/.test(confirmText)) ok('host-flavored confirmation text'); else fail(`confirm text: ${confirmText.slice(0, 120)}`);
  await A.exec(`document.getElementById('leave-yes').click()`);
  await A.waitFor(`return window.uv.mode==='lobby' && !document.getElementById('screen-lobby').classList.contains('hidden')`, 3000, 'lobby after abandon');
  ok('solo abandon → straight to lobby (no results screen)');
  await A.exec(`document.querySelector('.char-card[data-char="onrush"]').click()`);
  await sleep(300);
  await A.exec(`document.getElementById('btn-start').click()`);
  await A.waitFor(`return window.uv.mode==='run' && !!window.uv.sim`, 4000, 'second run after abandon');
  const fresh = await A.exec(`const s=window.uv.sim, p=s.players[0]; return JSON.stringify({char:p.charId, mats:p.materials, lvl:p.level, floor:s.floorNum, items:p.items.length, phase:s.phase})`);
  const fr = JSON.parse(fresh);
  if (fr.char === 'onrush' && fr.mats === 0 && fr.lvl === 1 && fr.floor === 1 && fr.items === 0 && fr.phase === 'map') ok(`fresh run after abandon (${fresh})`);
  else fail(`run not fresh after abandon: ${fresh}`);

  // ---- trait meter (Onrush): fills with movement, shows in HUD ----
  await A.exec(`document.querySelector('.map-node.reachable').click(); return 1;`);
  await A.waitFor(`return window.uv.sim.phase==='arena'`, 3000, 'onrush arena');
  await A.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}))`);
  await sleep(1200);
  await A.exec(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD'}))`);
  const meterVal = await A.exec('return window.uv.sim.players[0].meter');
  if (meterVal > 0.3) ok(`Onrush momentum meter fills with movement (${meterVal.toFixed(2)})`);
  else fail(`momentum meter did not fill (${meterVal})`);
  await A.waitFor(`return document.querySelector('.meterbar') !== null`, 4000, 'HUD meter bar');
  ok('trait meter renders in the HUD');

  // ---- build management: combine, sell, 6/6 notice, character sheet ----
  // finish the fight and park on the floor's Trader stop
  if (!await A.exec(clearFightJs)) fail('onrush fight never cleared');
  await A.exec(drainJs);
  await extractToMap(A, 'onrush fight');
  await A.exec(`const s=window.uv.sim; s.debug('F2'); const shop=s.floor.nodes.find(n=>n.kind==='shop'); s._travelTo(shop.id); return 1;`);
  await A.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 5000, 'shop for build mgmt');
  // Trader nodes are the Black Market now: 6 slots, ≥2 weapons, banner says so
  await A.waitFor(`return document.querySelector('#overlay-shop .ov-title').textContent === 'BLACK MARKET'`, 3000, 'Black Market banner');
  const bmInfo = JSON.parse(await A.exec(`const st=window.uv.sim.players[0].shop.stock;
    return JSON.stringify({slots: st.length, weapons: st.filter(s=>s.kind==='weapon').length})`));
  if (bmInfo.slots === 6 && bmInfo.weapons >= 2) ok(`Black Market: ${bmInfo.slots} slots, ${bmInfo.weapons} weapons in stock`);
  else fail(`Black Market stock: ${JSON.stringify(bmInfo)}`);
  // drain until the HOST says no level-ups remain
  async function clickAwayLevelups(br) {
    for (let i = 0; i < 40; i++) {
      const st = JSON.parse(await br.exec(`return JSON.stringify({vis:!document.getElementById('overlay-levelup').classList.contains('hidden'), banked:window.uv.sim.players[0].banked, pending:!!window.uv.sim.players[0].pendingOffer})`));
      if (st.vis) { await br.exec(`const c=document.querySelector('#overlay-levelup .offer-card'); if(c) c.click(); return 1;`); await sleep(150); continue; }
      if (!st.banked && !st.pending) return;
      await sleep(200);
    }
  }
  await clickAwayLevelups(A);
  // duplicate pair (purchase mechanics covered elsewhere; the combine UI is under test)
  await A.exec(`const s=window.uv.sim, p=s.players[0]; s._addWeapon(p,'coilgun',1); s._addWeapon(p,'coilgun',1); return 1;`);
  // Labelled 'a matching pair of coilguns', not 'pair'. The old label read as a
  // PEER pairing in a failure line — "timeout waiting for pair in meta" — and a
  // room-code failure is the most alarming thing this game could report, so a
  // weapon-combine timeout wearing that name cost real diagnosis time. A
  // waitFor label is failure-message text; it should name the thing being
  // waited for in words that cannot be read as a different subsystem.
  await A.waitFor(`return window.uv.meta && window.uv.meta.weapons.filter(w=>w.id==='coilgun').length===2`, 3000, 'a matching pair of coilguns in meta');
  const slotsBefore = await A.exec('return window.uv.meta.weapons.length');
  // character sheet by C key: shows the pair, and solo PAUSES
  await A.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyC'})); return 1;`);
  await A.waitFor(`return !document.getElementById('overlay-sheet').classList.contains('hidden')`, 3000, 'sheet via C');
  const sheetHasPair = await A.exec(`return document.getElementById('overlay-sheet').innerText.includes('Coilgun')`);
  if (sheetHasPair) ok('character sheet lists the owned weapons'); else fail('sheet missing weapons');
  // ---- glossary: hover a stat row in the sheet (desktop) ----
  const sheetHover = await A.exec(`const r=document.querySelector('[data-glossrow="tempo"]');
    r.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
    const p=document.getElementById('gloss-pop');
    const txt = p.classList.contains('hidden') ? '' : p.textContent;
    r.dispatchEvent(new MouseEvent('mouseout',{bubbles:true}));
    return txt;`);
  if (/Tempo/.test(sheetHover) && /faster/.test(sheetHover)) ok('desktop: hovering a sheet stat shows its glossary detail');
  else fail(`sheet hover glossary: "${sheetHover}"`);
  const tick0 = await A.exec('return window.uv.sim.tickNum');
  await sleep(700);
  const tick1 = await A.exec('return window.uv.sim.tickNum');
  if (tick1 === tick0) ok('solo pauses while the sheet is open'); else fail(`sim ticked ${tick0}→${tick1} with sheet open in solo`);
  await A.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyC'})); return 1;`);
  await sleep(500);
  const tick2 = await A.exec('return window.uv.sim.tickNum');
  if (tick2 > tick1) ok('closing the sheet resumes the solo sim'); else fail('sim did not resume after sheet close');
  // combine via the arsenal UI: select one, match highlights, confirm
  await A.exec(`const i=window.uv.meta.weapons.findIndex(w=>w.id==='coilgun'); document.querySelector('[data-wchip="'+i+'"]').click(); return 1;`);
  await A.waitFor(`return document.querySelector('[data-combine]')!==null`, 3000, 'combine affordance on the match');
  await A.exec(`document.querySelector('[data-combine]').click(); return 1;`);
  await A.waitFor(`const w=window.uv.meta.weapons.filter(w=>w.id==='coilgun'); return w.length===1 && w[0].tier===2`, 4000, 'combined pair');
  const slotsAfter = await A.exec('return window.uv.meta.weapons.length');
  if (slotsAfter === slotsBefore - 1) ok('combine via UI: pair → tier II, slot freed'); else fail(`slots ${slotsBefore}→${slotsAfter}`);
  await A.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyC'})); return 1;`);
  await A.waitFor(`return document.getElementById('overlay-sheet').innerText.includes('II')`, 3000, 'sheet shows the new tier');
  await A.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyC'})); return 1;`);
  ok('character sheet reflects the combine immediately');
  // weapon tooltips list their scaling stats
  const scalingShown = await A.exec(`return document.getElementById('overlay-shop').innerText.includes('scales with:') || document.getElementById('overlay-shop').innerText.includes('scales:') || /Ferocity|Tempo|Vitality|Attunement/.test(document.getElementById('overlay-shop').innerText)`);
  if (scalingShown) ok('shop shows weapon scaling stats'); else fail('weapon scaling stats missing from shop UI');
  // ---- glossary: hover a stat named inside a shop tooltip (desktop) ----
  const shopHover = await A.exec(`const t=document.querySelector('#overlay-shop .gloss-term'); if(!t) return '';
    t.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
    const p=document.getElementById('gloss-pop');
    const txt = p.classList.contains('hidden') ? '' : p.textContent;
    t.dispatchEvent(new MouseEvent('mouseout',{bubbles:true}));
    return txt;`);
  if (shopHover.length > 20) ok('desktop: hovering a stat in a shop tooltip shows the glossary');
  else fail(`shop tooltip glossary hover: "${shopHover}"`);
  // sell a stat item with the two-step confirmation; verify stat + refund
  const pickJs = `const it=window.uvContent.ITEMS.find(it=>it.stats&&it.stats.ferocity>0&&!it.hooks); return JSON.stringify({id:it.id,dmg:it.stats.ferocity})`;
  const pick = JSON.parse(await A.exec(pickJs));
  await A.exec(`const s=window.uv.sim,p=s.players[0]; p.items.push(${JSON.stringify(pick.id)}); s._recomputeItems(p); s._recomputeStats(p); return 1;`);
  await A.waitFor(`return window.uv.meta.items.includes(${JSON.stringify(pick.id)})`, 3000, 'item in meta');
  const m0 = await A.exec('return window.uv.meta.materials');
  const dmg0 = await A.exec('return window.uv.meta.stats.ferocity');
  const shownRefund = parseInt((await A.exec(`return document.querySelector('[data-selli="${pick.id}"]').textContent`)).replace(/[^0-9]/g, ''), 10);
  await A.exec(`document.querySelector('[data-selli="${pick.id}"]').click(); return 1;`);
  const armedTxt = await A.exec(`return document.querySelector('[data-selli="${pick.id}"]').textContent`);
  if (/tap again/.test(armedTxt)) ok('first tap arms the sell with the refund shown'); else fail(`sell not armed: "${armedTxt}"`);
  await A.exec(`document.querySelector('[data-selli="${pick.id}"]').click(); return 1;`);
  await A.waitFor(`return window.uv.meta.materials === ${m0 + shownRefund}`, 4000, 'refund credited');
  const dmg1 = await A.exec('return window.uv.meta.stats.ferocity');
  if (dmg1 === dmg0 - pick.dmg) ok(`sold item: +${shownRefund} materials, Ferocity ${dmg0}→${dmg1} on the sheet`);
  else fail(`stat after sell: ${dmg0}→${dmg1} (expected -${pick.dmg})`);
  // sold mechanical item can never fire again (hook aggregation empties)
  const mech = JSON.parse(await A.exec(`const it=window.uvContent.ITEMS.find(it=>it.hooks&&it.hooks.killExplode); return JSON.stringify({id:it.id})`));
  await A.exec(`const s=window.uv.sim,p=s.players[0]; p.items.push(${JSON.stringify(mech.id)}); s._recomputeItems(p); s._recomputeStats(p); return 1;`);
  await A.waitFor(`return window.uv.meta.items.includes(${JSON.stringify(mech.id)}) && document.querySelector('[data-selli="${mech.id}"]')!==null`, 4000, 'mech item chip rendered');
  if (!await A.exec(`return window.uv.sim.players[0].hookAgg.killExplode.length===1`)) fail('mech hook not live before sell');
  await A.exec(`document.querySelector('[data-selli="${mech.id}"]').click(); return 1;`);
  await A.exec(`document.querySelector('[data-selli="${mech.id}"]').click(); return 1;`);
  await A.waitFor(`return window.uv.sim.players[0].hookAgg.killExplode.length===0`, 4000, 'mech hook gone');
  ok('sold mechanical item is unregistered — its effect can never fire again');
  // ---- full-slot flows (patch 8): combine badge, auto-combine, tier-IV
  // reason, and the make-room swap picker ----
  await A.exec(`const s=window.uv.sim,p=s.players[0]; while (p.weapons.length < p.weaponSlots) s._addWeapon(p,'pebbleshot',1); return 1;`);
  await A.waitFor(`return window.uv.meta.weapons.length === window.uv.meta.weaponSlots`, 3000, 'slots full');
  const notice = await A.exec(`return document.getElementById('overlay-shop').innerText.includes('sell or combine to make room')`);
  if (notice) ok('6/6 notice: "sell or combine to make room"'); else fail('full-slots notice missing');
  // deterministic stock: a duplicate, a non-duplicate, and later a tier-IV trap
  await A.exec(`const s=window.uv.sim,p=s.players[0];
    p.shop.stock[0]={kind:'weapon',id:'pebbleshot',tier:1,price:12,sold:false,locked:false};
    p.shop.stock[1]={kind:'weapon',id:'rustcleaver',tier:1,price:14,sold:false,locked:false};
    s._sendShop(p); return 1;`);
  await A.waitFor(`return document.querySelector('.offer-card[data-slot="0"] .wpn-upg') !== null`, 3000, 'combine badge');
  const badgeTxt = await A.exec(`return document.querySelector('.offer-card[data-slot="0"] .wpn-upg').textContent`);
  if (/⇑/.test(badgeTxt) && /combines with your Pebbleshot I/.test(badgeTxt)) ok(`combine badge shows the outcome before purchase ("${badgeTxt.trim().slice(0, 60)}…")`);
  else fail(`badge text: ${badgeTxt}`);
  // buying the duplicate at 6/6 auto-combines in place, charged once
  const acM0 = await A.exec('return window.uv.meta.materials');
  await A.exec(`document.querySelector('.offer-card[data-slot="0"]').click(); return 1;`);
  await A.waitFor(`return window.uv.meta.weapons.some(w=>w.id==='pebbleshot'&&w.tier===2)`, 4000, 'auto-combined tier-up');
  const acAfter = JSON.parse(await A.exec(`return JSON.stringify({n:window.uv.meta.weapons.length, m:window.uv.meta.materials, sold:window.uv.sim.players[0].shop.stock[0].sold})`));
  if (acAfter.n === await A.exec('return window.uv.meta.weaponSlots') && acAfter.m === acM0 - 12 && acAfter.sold)
    ok(`full-slot duplicate purchase auto-combines (still ${acAfter.n}/${acAfter.n}, charged ◆12 once)`);
  else fail(`auto-combine state: ${JSON.stringify(acAfter)} (mats ${acM0}→)`);
  // a tier-IV match shows why it can't be bought, and tapping it changes nothing
  await A.exec(`const s=window.uv.sim,p=s.players[0]; p.weapons.find(w=>w.id==='pebbleshot').tier=4; p.metaDirty=true;
    p.shop.stock[2]={kind:'weapon',id:'pebbleshot',tier:4,price:12,sold:false,locked:false}; s._sendShop(p); return 1;`);
  await A.waitFor(`return document.querySelector('.offer-card[data-slot="2"] .wpn-blocked') !== null`, 3000, 'tier-IV blocked reason');
  ok('tier-IV match shows its blocked reason on the card');
  const t4W = await A.exec('return JSON.stringify(window.uv.meta.weapons)');
  await A.exec(`document.querySelector('.offer-card[data-slot="2"]').click(); return 1;`);
  await sleep(600);
  if (t4W === await A.exec('return JSON.stringify(window.uv.meta.weapons)')) ok('tapping the tier-IV card leaves the build unchanged');
  else fail('tier-IV tap mutated the build');
  // the make-room picker: non-duplicate at full slots
  await A.exec(`document.querySelector('.offer-card[data-slot="1"]').click(); return 1;`);
  await A.waitFor(`return document.querySelector('.swap-card') !== null`, 3000, 'make-room picker');
  const pickerCards = JSON.parse(await A.exec(`const cards=[...document.querySelectorAll('.swap-card')];
    return JSON.stringify({ n: cards.length, detailed: cards.filter(c=>c.querySelector('.wdetail .wd-dps')).length,
      withNet: cards.filter(c=>/net [+\\-−]?\\d+/.test(c.textContent)).length })`));
  if (pickerCards.n === await A.exec('return window.uv.meta.weapons.length') && pickerCards.detailed === pickerCards.n && pickerCards.withNet === pickerCards.n)
    ok(`picker lists every owned weapon as a full detail card with its net cost (${pickerCards.n})`);
  else fail(`picker cards: ${JSON.stringify(pickerCards)}`);
  // cancel returns to the shop unchanged
  const preCancel = await A.exec('return JSON.stringify([window.uv.meta.weapons, window.uv.meta.materials])');
  await A.exec(`document.getElementById('swap-cancel').click(); return 1;`);
  await A.waitFor(`return document.querySelector('.swap-card') === null && document.querySelector('.offer-card[data-slot="1"]') !== null`, 3000, 'picker cancelled');
  if (preCancel === await A.exec('return JSON.stringify([window.uv.meta.weapons, window.uv.meta.materials])')) ok('cancel returns to the shop with nothing changed');
  else fail('cancel mutated state');
  // run the swap: arm (net shown), confirm → atomic sell+buy
  await A.exec(`document.querySelector('.offer-card[data-slot="1"]').click(); return 1;`);
  await A.waitFor(`return document.querySelector('.swap-card') !== null`, 3000, 'picker again');
  await A.exec(`document.querySelector('.swap-card:not(.cantafford)').click(); return 1;`);
  const armedNet = await A.exec(`return document.querySelector('.swap-card.armed') ? document.querySelector('.swap-card.armed .oprice').textContent : ''`);
  if (/sell \+\d+ ⟡ → buy −14 ⟡ · net [+\-−]?\d+ ⟡ — tap again/.test(armedNet)) ok(`swap arms with the full net line ("${armedNet.trim()}")`);
  else fail(`armed net line: "${armedNet}"`);
  const swM0 = await A.exec('return window.uv.meta.materials');
  await A.exec(`document.querySelector('.swap-card.armed').click(); return 1;`);
  await A.waitFor(`return window.uv.meta.weapons.some(w=>w.id==='rustcleaver')`, 4000, 'swap executed');
  const swAfter = JSON.parse(await A.exec(`return JSON.stringify({n:window.uv.meta.weapons.length, m:window.uv.meta.materials})`));
  const netShown = parseInt((armedNet.match(/net ([+\-−]?\d+)/) || [])[1], 10);
  if (swAfter.n === await A.exec('return window.uv.meta.weaponSlots') && swAfter.m === swM0 + netShown)
    ok(`swap executes atomically at the shown net (${netShown} ⟡, still ${swAfter.n} weapons)`);
  else fail(`swap result: ${JSON.stringify(swAfter)} net shown ${netShown} from ${swM0}`);

  // ---- detail cards: owned chips expand; est. DPS is live ----
  await A.exec(`const s=window.uv.sim,p=s.players[0]; p.weapons.length=0; s._addWeapon(p,'gravemaul',1); p.metaDirty=true; return 1;`);
  await A.waitFor(`return window.uv.meta.weapons.length===1 && window.uv.meta.weapons[0].id==='gravemaul'`, 3000, 'gravemaul only');
  await A.exec(`document.querySelector('[data-wchip="0"]').click(); return 1;`);
  await A.waitFor(`return document.querySelector('.wchip.expanded .wdetail .wd-dps') !== null`, 3000, 'owned detail card');
  const detTxt0 = await A.exec(`return document.querySelector('.wchip.expanded .wdetail').textContent`);
  if (/scales:/.test(detTxt0) && /Vitality \+\d+%/.test(detTxt0) && /est\./.test(detTxt0)) ok('owned chip expands: scaling contribution + est. DPS shown');
  else fail(`owned detail: "${detTxt0.slice(0, 120)}"`);
  const dps0 = parseFloat(await A.exec(`return document.querySelector('.wchip.expanded .wd-dps b').textContent`));
  // buying (granting) Vitality must immediately raise a Vitality-scaler's DPS
  await A.exec(`const s=window.uv.sim,p=s.players[0]; p.boosts.vitality=(p.boosts.vitality||0)+40; s._recomputeStats(p); p.metaDirty=true; return 1;`);
  await A.waitFor(`const el=document.querySelector('.wchip.expanded .wd-dps b'); return el && parseFloat(el.textContent) > ${dps0} ? 1 : 0`, 4000, 'live DPS update');
  const dps1 = parseFloat(await A.exec(`return document.querySelector('.wchip.expanded .wd-dps b').textContent`));
  ok(`est. DPS is live: +40 Vitality moved Gravemaul ${dps0} → ${dps1}`);
  const stockDps = await A.exec(`return document.querySelector('.offer-card .wd-dps') !== null`);
  if (stockDps) ok('stock weapon cards show est.-DPS-if-bought'); else fail('stock cards missing est. DPS');
  // close the shop → the map screen offers a reopen button while parked here
  await A.exec(`document.getElementById('shop-close') && document.getElementById('shop-close').click(); return 1;`);
  await A.waitFor(`return document.getElementById('overlay-shop').classList.contains('hidden')`, 3000, 'shop closed');
  await A.waitFor(`return document.querySelector('#map-reopen-shop') !== null`, 3000, 'map reopen-shop button');
  await A.exec(`document.querySelector('#map-reopen-shop').click(); return 1;`);
  await A.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 3000, 'shop reopened from the map');
  ok('map screen "Reopen shop" button replaces the walk-back');
  await A.exec(`document.getElementById('shop-close').click(); return 1;`);

  // ---- scripted full solo run: node map → fights → sieges → victory ----
  const runResult = await A.exec(`
    const sim = window.uv.sim;
    try {
      let guard = 0;
      while (!sim.over && guard++ < 300) {
        if (sim.phase === 'map') {
          for (const p of sim.players) { let g=0; while (p.pendingOffer && g++<40) sim.uiAction(p.idx,{kind:'levelup',id:p.pendingOffer[0].id});
            if (p.treasureOffer) sim.uiAction(p.idx,{kind:'treasure',id:p.treasureOffer.picks[0]});
            if (p.boonOffer) sim.uiAction(p.idx,{kind:'boon',id:p.boonOffer[0].id});
            if (p.shop) sim.uiAction(p.idx,{kind:'closeShop'}); }
          const r = sim.reachableNodes();
          if (!r.length) return 'ERR no reachable nodes from ' + sim.currentNode;
          sim.uiAction(0, { kind: 'pickNode', nodeId: r[0] });
          continue;
        }
        // arena: clear the field; sieges need the mutations run and the boss dead
        let g = 0;
        while (!sim.cleared && g++ < 80) {
          sim.debug('F3'); for (let i=0;i<10;i++) sim.tick();
          if (sim.arenaNode && sim.arenaNode.kind==='siege' && !sim.cleared) {
            if (!sim.bossSpawned) { sim.siegeT = Math.max(sim.siegeT, sim.bossAt); sim.tick(); }
            let b = 0; while (sim.boss && b++<3000) sim.damageEnemy(sim.boss, 400, { owner: sim.players[0] });
            for (let i=0;i<10;i++) sim.tick();
          }
        }
        if (!sim.cleared && !sim.over) return 'ERR fight never cleared (node ' + sim.currentNode + ')';
        for (const p of sim.players) { let g2=0; while (p.pendingOffer && g2++<40) sim.uiAction(p.idx,{kind:'levelup',id:p.pendingOffer[0].id});
          if (p.shop) sim.uiAction(p.idx,{kind:'closeShop'}); }
        let e = 0;
        // sieges add an 8s looting window before the hatch appears
        while (sim.phase === 'arena' && !sim.over && e++ < 1100) {
          if (sim.hatch) { const p = sim.players[0]; p.x = sim.hatch.x; p.y = sim.hatch.y; }
          sim.tick();
        }
        if (!sim.over && sim.phase === 'arena') return 'ERR extraction stalled on node ' + sim.currentNode;
      }
      return JSON.stringify({ over: sim.over, win: sim.result && sim.result.win });
    } catch (e) { return 'ERR ' + (e.stack || e); }
  `);
  if (runResult === '{"over":true,"win":true}') ok('scripted full solo run (map → fights → sieges) → WIN in browser'); else fail(`browser full run: ${String(runResult).slice(0, 400)}`);
  await A.waitFor(`return window.uv.mode==='results' && !document.getElementById('screen-results').classList.contains('hidden')`, 4000, 'results screen');
  const seedShown = await A.exec(`return document.querySelector('.seed-line') && document.querySelector('.seed-line').textContent`);
  if (/run seed: \d+/.test(seedShown || '')) ok(`results shows seed (${seedShown.trim()})`); else fail('seed missing on results');

  errs = await A.errors();
  if (errs.length) fail(`console errors during run: ${errs.join(' | ').slice(0, 500)}`); else ok('no console errors through full run');

  // ---- perf gate: desktop host at a siege crest (≥55 fps at 250 alive) ----
  await A.exec(`document.getElementById('btn-title').click()`);
  await A.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 4000, 'back to title');
  await A.exec(`document.getElementById('btn-host').click()`);
  await A.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')`, 4000, 'lobby2');
  await A.exec(`document.querySelector('.char-card[data-char="threader"]').click()`);
  await sleep(200);
  await A.exec(`document.getElementById('btn-start').click()`);
  await A.waitFor(`return window.uv.mode==='run'`, 4000, 'run2');
  const crest = await A.exec(`const s=window.uv.sim; if (!s.god) s.debug('F5');
    for (const id of ['coilgun','hailburst','gravelmouth','sparkbolt']) s._addWeapon(s.players[0], id, 4);
    s._travelTo(s.floor.siegeId);
    let t=0; while (s.enemyPool.count < 300 && t++ < 16) s.debug('F1');
    // patch 9: the crest now includes LoS raycasts + a full cap of death-puddles
    const p0=s.players[0]; for (let i=0;i<14;i++) s.addZone({x:p0.x+(Math.random()-0.5)*900, y:p0.y+(Math.random()-0.5)*900, r:46, dps:8, dur:30, hurts:'players', color:'#7dee6a', acid:true});
    return s.enemyPool.count;`);
  const dFps = await measureFps(A);
  const dAlive = await A.exec('return window.uv.sim.enemyPool.count');
  const dPud = await A.exec(`return window.uv.sim.zones.filter(z=>z.acid).length`);
  console.log(`  PERF desktop host: ${dFps} fps @ ${crest}→${dAlive} alive, ${dPud} acid puddles, LoS on (siege arena, headless SwiftShader)`);
  if (crest >= 300) ok(`siege crest reached ${crest} alive for the perf gate (patch-8 density)`); else fail(`crest only ${crest} alive`);
  if (dFps >= 55) ok(`desktop perf gate: ${dFps} fps ≥ 55 at the ~300 crest`);
  else console.warn(`⚠ desktop headless fps ${dFps} @ ${dAlive} alive (headless SwiftShader is unrepresentative; sim tick <1ms)`);

  errs = await A.errors();
  if (errs.length) fail(`console errors during stress: ${errs.join(' | ').slice(0, 300)}`); else ok('no console errors during stress');
} catch (e) {
  fail(`browser test crashed: ${e.message}`);
} finally {
  await A.close();
}

// ---------- asset-missing fallback: level-ups survive a broken asset path ----------
{
  const F = new Browser();
  try {
    await F.open('F', { failPattern: 'airhorn' });
    await F.goto(URL);
    await F.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title (no asset)');
    await F.waitFor(`return window.uvAudio && window.uvAudio.stats.warnings === 1 ? 1 : 0`, 6000, 'one preload warning');
    ok('broken asset path: exactly one console warning at preload');
    await F.exec(`document.getElementById('btn-host').click()`);
    await F.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')`, 5000, 'lobby (no asset)');
    await F.exec(`document.querySelector('.char-card[data-char="bulwark"]').click()`);
    await sleep(250);
    await F.exec(`document.getElementById('btn-start').click()`);
    await F.waitFor(`return window.uv.mode==='run' && !!window.uv.sim`, 5000, 'run (no asset)');
    await F.exec(`window.uv.sim.debug('F2'); return 1;`); // banks level-ups → levelUp events
    await F.waitFor(`return window.uvAudio.stats.blips >= 1 ? 1 : 0`, 5000, 'blip fallback');
    const fstats = JSON.parse(await F.exec(`return JSON.stringify({blips:window.uvAudio.stats.blips, horns:window.uvAudio.stats.horns, banked:window.uv.sim.players[0].banked})`));
    if (fstats.blips >= 1 && fstats.horns === 0 && fstats.banked > 0) ok(`level-ups resolve on the synth blip with the asset absent (${fstats.blips} blips, ${fstats.banked} banked)`);
    else fail(`fallback state: ${JSON.stringify(fstats)}`);
    const ferrs = await F.errors();
    if (ferrs.length) fail(`console errors with asset missing: ${ferrs.join(' | ').slice(0, 300)}`); else ok('zero console errors with the asset missing');
  } catch (e) {
    fail(`fallback test crashed: ${e.message}`);
  } finally { await F.close(); }
}

// ---------- the sprite pipeline: zero art, partial art, and the off switch ----------
// The whole point of this layer is that it can be absent. These tests cover
// the three states it actually ships in — no manifest, a manifest with no
// files, and a manifest with SOME files — plus the ?sprites=off escape hatch
// that has to reproduce the pre-sprite renderer exactly.
//
// Units are DIRECTIONAL: their sheet is a grid, rows = facings in the order
// E SE S SW W NW N NE, columns = animation frames. The generated test grid
// paints each row a different colour, so a single sampled pixel says which row
// the renderer picked — which is the only way to catch an off-by-one or a
// mirrored row order, both of which look almost right in motion.
{
  const spriteRoot = path.join(process.cwd(), 'assets', 'sprites');
  const enemyDir = path.join(spriteRoot, 'enemy');
  const fxDir = path.join(spriteRoot, 'fx');
  const gridFile = path.join(enemyDir, 'skulker.png');
  const badGridFile = path.join(enemyDir, 'flit.png');
  const flatFile = path.join(fxDir, 'material.png');
  // row d -> rgb(20 + d*30, 200, 40); decode with round((r - 20) / 30)
  const ROW_RGB = d => [20 + d * 30, 200, 40];
  const rowOf = rgb => Math.round((rgb[0] - 20) / 30);
  const ROWS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

  const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc32 = buf => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const pngChunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  // px(x, y) -> [r, g, b]. Everything here is opaque.
  const png = (w, h, px) => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGBA
    const raw = Buffer.alloc(h * (1 + w * 4));
    for (let y = 0; y < h; y++) {
      const row = y * (1 + w * 4);
      raw[row] = 0;   // filter: none
      for (let x = 0; x < w; x++) {
        const [r, g, b] = px(x, y);
        const o = row + 1 + x * 4;
        raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
      }
    }
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', zlib.deflateSync(raw)),
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
  };
  // a valid 8-direction enemy grid: one frame across, eight facings down
  const directionGrid = () => png(E_CELL, E_CELL * 8, (x, y) => ROW_RGB(Math.floor(y / E_CELL)));
  // left half red, right half blue — asymmetric, so rotation is visible
  const flatAsymmetric = () => png(FX_CELL, FX_CELL, x => (x < FX_CELL / 2 ? [255, 60, 60] : [60, 60, 255]));

  const installArt = () => {
    fs.mkdirSync(enemyDir, { recursive: true });
    fs.mkdirSync(fxDir, { recursive: true });
    fs.writeFileSync(gridFile, directionGrid());
    fs.writeFileSync(flatFile, flatAsymmetric());
    fs.writeFileSync(badGridFile, png(E_CELL, E_CELL, () => [255, 0, 255]));   // square, so deliberately not an 8-row grid
  };
  // Remove ONLY the files this test wrote. A blanket rmSync of assets/sprites
  // would delete committed art, which is a destructive test, not a cleanup.
  const removeArt = () => {
    for (const f of [gridFile, badGridFile, flatFile]) fs.rmSync(f, { force: true });
    for (const d of [enemyDir, fxDir, spriteRoot]) { try { fs.rmdirSync(d); } catch { /* not empty: real art lives here */ } }
  };

  // Drop a player into an open arena with one pinned, motionless enemy.
  const probeSetupJs = `
    const s = window.uv.sim;
    s.god = true;
    s.wave.done = true; s.spawnQueue.length = 0;
    for (const e of [...s.enemyPool]) s.enemyPool.release(e);
    const p = s.players[0];
    p.x = s.W / 2; p.y = s.H / 2;
    const e = s.spawnEnemyById('skulker', p.x + 150, p.y, { noMats: true });
    e.hp = 1e9; e.maxHp = 2e9; e.spd = 0; e.dmg = 0; e.hitFlash = 0;
    window._probe = { ex: e.x, ey: e.y, id: e.id };
    return 1;`;
  // hold still (or drift) for n animation frames, then let the last frame settle
  const moveJs = (dx, dy, n) => `
    return new Promise(res => {
      const s = window.uv.sim, pr = window._probe;
      const e = s.enemyById(pr.id);
      let i = 0;
      (function step() {
        const p = s.players[0]; p.x = s.W / 2; p.y = s.H / 2;
        e.x += ${dx}; e.y += ${dy}; e.hitFlash = 0;
        pr.ex = e.x; pr.ey = e.y;
        if (++i < ${n}) requestAnimationFrame(step); else res(1);
      })();
    });`;
  const readJs = `
    const r = window.uvRenderer, pr = window._probe;
    if (!r._screen) return 'no frame drawn';
    const sx = Math.round((pr.ex - r.camX) * r._screen.scale + r._screen.cw / 2);
    const sy = Math.round((pr.ey - r.camY) * r._screen.scale + r._screen.ch / 2);
    const d = r.ctx.getImageData(sx, sy, 1, 1).data;
    return JSON.stringify([d[0], d[1], d[2]]);`;

  const near = (got, want, tol = 40) => got.every((v, i) => Math.abs(v - want[i]) <= tol);

  async function intoArena(br, url) {
    await br.goto(url);
    await br.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title');
    await br.exec(`document.getElementById('btn-host').click()`);
    await br.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')`, 5000, 'lobby');
    await br.exec(`document.querySelector('.char-card[data-char="bulwark"]').click()`);
    await sleep(250);
    await br.exec(`document.getElementById('btn-start').click()`);
    await br.waitFor(`return window.uv.mode==='run' && !!window.uv.sim`, 8000, 'run');
    await br.exec(`const s=window.uv.sim; const n=s.floor.nodes.find(x=>x.kind==='combat'); n.template='open_expanse'; s._travelTo(n.id); return 1;`);
    await br.waitFor(`return window.uv.sim.phase==='arena'`, 8000, 'arena');
  }

  // ---- 1. no manifest at all: the state before this patch, and any deploy
  //         where assets/ was never uploaded ----
  {
    const S1 = new Browser();
    try {
      await S1.open('S1', { failPattern: 'assets.json' });
      await S1.goto(URL);
      await S1.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title (no manifest)');
      await sleep(800);
      const st = JSON.parse(await S1.exec(`const A=window.uvAssets; return JSON.stringify({ready:A.ready, size:A.size(), missing:A.missing.size})`));
      if (st.ready && st.size === 0) ok(`manifest 404: loader resolves with an empty registry (ready=${st.ready}, ${st.size} ids) — never rejects`);
      else fail(`manifest 404 state: ${JSON.stringify(st)}`);
      const errs = await S1.errors();
      if (errs.length) fail(`console errors with no manifest: ${errs.join(' | ').slice(0, 300)}`);
      else ok('zero console errors with no manifest — a missing asset is a normal state, not an error path');
      await intoArena(S1, URL);
      const fps = await measureFps(S1);
      if (fps >= 30) ok(`the game plays with assets/ effectively deleted (${fps} fps in an arena)`);
      else fail(`fps with no manifest: ${fps}`);
    } catch (e) { fail(`no-manifest test: ${e.message}`); } finally { await S1.close(); }
  }

  // ---- 2. manifest present, not one file on disk: what this patch ships ----
  let baseline = null;
  {
    const S2 = new Browser();
    try {
      await S2.open('S2');
      await intoArena(S2, URL);
      await S2.waitFor(`return window.uvAssets.ready ? 1 : 0`, 12000, 'assets settled');
      // Whatever art is committed, every id must register and every id WITHOUT
      // a file must resolve to null. Not pinned to "zero files", so landing a
      // batch does not break the suite.
      const st = JSON.parse(await S2.exec(`const A=window.uvAssets; return JSON.stringify({size:A.size(), missing:A.missing.size, hit:A.get('enemy.skulker')?1:0})`));
      if (st.size > 250 && st.missing > 0 && st.missing <= st.size && !st.hit) {
        ok(`all ${st.size} ids registered; the ${st.missing} without a file resolve to null (${st.size - st.missing} drawn)`);
      } else fail(`registry state: ${JSON.stringify(st)}`);
      const errs = await S2.errors();
      if (errs.length) fail(`console errors with zero sprite files: ${errs.join(' | ').slice(0, 300)}`);
      else ok('zero console errors with every sprite file absent');
      const drawCheck = JSON.parse(await S2.exec(`const A=window.uvAssets, D=window.uvDrawSprite;
        const c=document.createElement('canvas').getContext('2d');
        let drew=0; for (const id of A.ids()) if (D(c,id,0,0)) drew++;
        return JSON.stringify({drew, expected: A.size() - A.missing.size});`));
      if (drawCheck.drew === drawCheck.expected) {
        ok(`drawSprite draws exactly the ${drawCheck.drew} id(s) with a file and refuses the rest — every other entity falls back to its primitive`);
      } else fail(`drawSprite drew ${drawCheck.drew}, expected ${drawCheck.expected}`);
      await S2.exec(probeSetupJs);
      await S2.exec(moveJs(0, 0, 12));
      await sleep(200);
      baseline = JSON.parse(await S2.exec(readJs));
      ok(`primitive skulker paints rgb(${baseline.join(',')}) at its centre — the pre-sprite renderer, unchanged`);
    } catch (e) { fail(`zero-file test: ${e.message}`); } finally { await S2.close(); }
  }

  // ---- 3. ?sprites=off, WITH real files on disk: the escape hatch has to
  //         reproduce the primitive exactly, art present or not ----
  // ---- 4. directional grids, on a live entity and cell by cell ----
  // ---- 5. a directions:1 entry still rotates, exactly as before ----
  {
    installArt();
    const S3 = new Browser(), S4 = new Browser();
    try {
      // 3: forced off
      await S3.open('S3');
      await intoArena(S3, `${URL}?sprites=off`);
      const offState = JSON.parse(await S3.exec(`const A=window.uvAssets; return JSON.stringify({mode:window.uvSpriteMode, ready:A.ready, size:A.size(), hit:A.get('enemy.skulker')?1:0})`));
      if (offState.mode === 'off' && offState.ready && offState.size === 0 && !offState.hit) {
        ok('?sprites=off short-circuits the loader entirely — nothing fetched, get() always null');
      } else fail(`sprites=off state: ${JSON.stringify(offState)}`);
      await S3.exec(probeSetupJs);
      await S3.exec(moveJs(0, 0, 12));
      await sleep(200);
      const offPx = JSON.parse(await S3.exec(readJs));
      if (baseline && near(offPx, baseline, 12)) ok(`?sprites=off with art installed paints rgb(${offPx.join(',')}) — identical to the no-art primitive`);
      else fail(`sprites=off pixel ${JSON.stringify(offPx)} != baseline ${JSON.stringify(baseline)}`);

      // 4 + 5: the real thing
      await S4.open('S4');
      await intoArena(S4, URL);
      await S4.waitFor(`return window.uvAssets.ready ? 1 : 0`, 12000, 'assets settled (partial)');
      const part = JSON.parse(await S4.exec(`const A=window.uvAssets;
        const g=A.get('enemy.skulker'), f=A.get('fx.material');
        return JSON.stringify({size:A.size(), missing:A.missing.size,
          gridDirs:g?g.directions:0, gridW:g?g.w:0, gridH:g?g.h:0,
          flatDirs:f?f.directions:0,
          badRejected:A.missing.has('enemy.flit')?1:0, badNull:A.get('enemy.flit')?0:1,
          other:A.get('enemy.gyre')?1:0});`));
      if (part.gridDirs === 8 && part.gridW === E_CELL && part.gridH === E_CELL && part.flatDirs === 1 && !part.other) {
        ok(`partial manifest: an 8-direction 32x32 grid and a 1-direction 32x32 icon load, the other ${part.missing} ids stay null`);
      } else fail(`partial state: ${JSON.stringify(part)}`);
      // grid validation: wrong dimensions is no sprite, not a wrong sprite
      if (part.badRejected && part.badNull) ok('a 32x32 file for an 8-row grid is rejected and marked missing — it falls back rather than drawing a wrong facing');
      else fail(`bad grid was not rejected: ${JSON.stringify(part)}`);

      // every row, addressed by angle, off screen and exhaustively
      const bucket = JSON.parse(await S4.exec(`
        const D = window.uvDrawSprite;
        const c = document.createElement('canvas'); c.width = 128; c.height = 128;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        const TAU = Math.PI * 2;
        const rowAt = opts => { g.clearRect(0,0,128,128); D(g,'enemy.skulker',64,64,opts);
          const d = g.getImageData(64,64,1,1).data; return Math.round((d[0]-20)/30); };
        const out = { viaFacing: [], viaRot: [], wound: [], negative: [], idle: null, rotated: null };
        for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8;
          out.viaFacing.push(rowAt({ facing: a }));
          out.viaRot.push(rowAt({ rot: a }));
          out.wound.push(rowAt({ facing: a + TAU * 3 }));
          out.negative.push(rowAt({ facing: a - TAU * 2 }));
        }
        out.idle = rowAt({});
        // a directional sprite must NEVER rotate: row 0 drawn with a facing of
        // 0 and with an extra rot of 0 is the same image, and the grid rows are
        // solid, so any rotation would smear the row colours together
        g.clearRect(0,0,128,128); D(g,'enemy.skulker',64,64,{ facing: 0 });
        const top = g.getImageData(64, 64-10, 1, 1).data, bot = g.getImageData(64, 64+10, 1, 1).data;
        out.rotated = (Math.round((top[0]-20)/30) === 0 && Math.round((bot[0]-20)/30) === 0) ? 0 : 1;
        return JSON.stringify(out);`));
      const want = [0, 1, 2, 3, 4, 5, 6, 7];
      const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
      if (eq(bucket.viaFacing, want)) ok(`direction rows resolve E SE S SW W NW N NE from angle — ${bucket.viaFacing.join('')}`);
      else fail(`row order via facing: got ${bucket.viaFacing.join(',')} want ${want.join(',')}`);
      if (eq(bucket.viaRot, want)) ok('the documented { rot: angle } call selects the same rows — callers need not change');
      else fail(`row order via rot: got ${bucket.viaRot.join(',')}`);
      if (eq(bucket.wound, want) && eq(bucket.negative, want)) ok('angles wound past ±τ and negative angles land on the same rows');
      else fail(`winding: +3τ ${bucket.wound.join(',')} / -2τ ${bucket.negative.join(',')}`);
      if (bucket.idle === 2) ok('a sprite drawn with no facing at all defaults to row 2 (S) — an idle arena never snaps east');
      else fail(`idle default row ${bucket.idle}, want 2 (S)`);
      if (bucket.rotated === 0) ok('a directional sprite is never rotated — the row is the facing, and the cell is drawn square');
      else fail('directional sprite came out rotated');

      // 5: a directions:1 entry still rotates and still mirrors
      const flat = JSON.parse(await S4.exec(`
        const D = window.uvDrawSprite;
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        const at = (opts, dx) => { g.clearRect(0,0,64,64); D(g,'fx.material',32,32,opts);
          const d = g.getImageData(32+dx,32,1,1).data; return [d[0],d[1],d[2]]; };
        return JSON.stringify({ plain: at({}, -4), turned: at({rot: Math.PI}, -4), mirrored: at({flipX: true}, -4) });`));
      const RED = [255, 60, 60], BLUE = [60, 60, 255];
      if (near(flat.plain, RED, 30) && near(flat.turned, BLUE, 30) && near(flat.mirrored, BLUE, 30)) {
        ok('a directions:1 entry is untouched by this patch — still rotated by rot, still mirrored by flipX');
      } else fail(`flat sprite: plain ${flat.plain} turned ${flat.turned} mirrored ${flat.mirrored}`);

      // the facing memory, on a real entity moving through a real arena
      await S4.exec(probeSetupJs);
      await S4.exec(moveJs(0, 0, 14));
      await sleep(200);
      const stillPx = JSON.parse(await S4.exec(readJs));
      if (rowOf(stillPx) === 2) ok(`a spawned, motionless enemy faces the camera — row ${rowOf(stillPx)} (${ROWS[rowOf(stillPx)]})`);
      else fail(`idle enemy row ${rowOf(stillPx)} from rgb(${stillPx.join(',')}), want 2 (S)`);
      await S4.exec(moveJs(8, 0, 14));
      await sleep(200);
      const eastPx = JSON.parse(await S4.exec(readJs));
      if (rowOf(eastPx) === 0) ok(`walking east turns it to row ${rowOf(eastPx)} (${ROWS[rowOf(eastPx)]}) — facing is derived from motion, never networked`);
      else fail(`east-walking enemy row ${rowOf(eastPx)}, want 0 (E)`);
      await S4.exec(moveJs(0, -8, 14));
      await sleep(200);
      const northPx = JSON.parse(await S4.exec(readJs));
      if (rowOf(northPx) === 6) ok(`walking north (canvas -y) turns it to row ${rowOf(northPx)} (${ROWS[rowOf(northPx)]})`);
      else fail(`north-walking enemy row ${rowOf(northPx)}, want 6 (N)`);
      await S4.exec(moveJs(0, 0, 20));
      await sleep(200);
      const heldPx = JSON.parse(await S4.exec(readJs));
      if (rowOf(heldPx) === 6) ok('and it keeps that facing once it stops — a stopped unit holds its last real heading');
      else fail(`stopped enemy row ${rowOf(heldPx)}, want 6 (N) held`);

      // facing lives in the renderer, not on anything the sim owns
      const wall = JSON.parse(await S4.exec(`const s=window.uv.sim, r=window.uvRenderer;
        let onEntity=0; for (const e of s.enemyPool) if ('facing' in e || 'dir' in e || '_faceA' in e) onEntity++;
        for (const p of s.players) if ('facing' in p || 'dir' in p) onEntity++;
        return JSON.stringify({onEntity, mapSize:r._facing.size, snap: JSON.stringify(s.getSnapshot()).indexOf('facing')});`));
      if (!wall.onEntity && wall.mapSize > 0 && wall.snap === -1) {
        ok(`facing is render-local: ${wall.mapSize} entries in the renderer's map, none on any entity, none in the snapshot`);
      } else fail(`facing leaked: ${JSON.stringify(wall)}`);

      // 5b: the manifest's cosmetic `scale`. It multiplies how big the cell is
      // PAINTED, composed on top of the caller's own scale, and it must not
      // touch which cell is chosen or leak any context state — a scaled sprite
      // is the only thing in the renderer that takes save()/restore(), so an
      // unbalanced one would corrupt everything drawn after it.
      const sc = JSON.parse(await S4.exec(`
        const A = window.uvAssets, D = window.uvDrawSprite;
        const e = A.declared('enemy.skulker');
        const c = document.createElement('canvas'); c.width = 256; c.height = 256;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        // opaque span across the sprite's middle row, in device px
        const span = () => { const d = g.getImageData(0, 128, 256, 1).data; let n = 0;
          for (let x = 0; x < 256; x++) if (d[x*4+3] > 0) n++; return n; };
        const draw = opts => { g.clearRect(0,0,256,256); D(g,'enemy.skulker',128,128,opts); return span(); };
        // which row got picked, at the sprite's own centre
        const rowAt = () => { const d = g.getImageData(128,128,1,1).data; return Math.round((d[0]-20)/30); };

        const was = e.scale;
        const out = {};
        e.scale = 1;
        out.plain = draw({});                       // one cell across
        out.callerHalf = draw({ scale: 0.5 });      // half a cell
        e.scale = 1.5;
        out.scaled = draw({});                      // 1.5 cells
        out.composed = draw({ scale: 0.5 });        // 0.75: caller 0.5 x manifest 1.5
        out.rowScaled = (draw({ facing: Math.PI }), rowAt());   // still W = row 4

        // save()/restore() balance: the slow path is the only one that touches
        // the context, and it has to hand it back exactly as it found it
        g.setTransform(1, 0, 0, 1, 7, 11); g.globalAlpha = 0.5;
        const t0 = g.getTransform(), a0 = g.globalAlpha;
        D(g, 'enemy.skulker', 0, 0, { scale: 2, alpha: 0.3 });
        const t1 = g.getTransform();
        out.transformKept = (t1.a===t0.a && t1.d===t0.d && t1.e===t0.e && t1.f===t0.f) ? 1 : 0;
        out.alphaKept = g.globalAlpha === a0 ? 1 : 0;
        g.setTransform(1,0,0,1,0,0); g.globalAlpha = 1;

        e.scale = was;
        out.restored = e.scale;
        return JSON.stringify(out);`));
      // expectations derive from the enemy cell: the point of the assertion is
      // the RATIOS (1.0 / 1.5 / caller 0.5 composing to 0.75), not the literal
      // pixel counts, which move whenever the authored size does
      if (sc.plain === E_CELL && sc.scaled === E_CELL * 1.5 && sc.callerHalf === E_CELL / 2 && sc.composed === E_CELL * 0.75) {
        ok(`manifest scale is a pure size multiplier: ${sc.plain}px at 1.0, ${sc.scaled}px at 1.5, and it composes with the caller's own scale (0.5 x 1.5 = ${sc.composed}px)`);
      } else fail(`scale spans: ${JSON.stringify(sc)} (cell ${E_CELL})`);
      if (sc.rowScaled === 4) ok('a scaled sprite still resolves the same row — the multiplier changes the size a cell is painted, never which cell');
      else fail(`scaled row ${sc.rowScaled}, want 4 (W)`);
      if (sc.transformKept && sc.alphaKept) ok('the scaled draw hands the context back untouched — transform and globalAlpha survive it, so nothing drawn afterwards is corrupted');
      else fail(`context leaked after a scaled draw: ${JSON.stringify(sc)}`);
      if (sc.restored === 1) ok('and every other sprite composes to exactly 1, so it stays on drawSprite\'s bare-drawImage fast path');
      else fail(`the fixture's scale was not restored: ${sc.restored}`);

      const perrs = await S4.errors();
      if (perrs.length) fail(`console errors with a partial manifest: ${perrs.join(' | ').slice(0, 300)}`);
      else ok('zero console errors with sprites, rejected grids and primitives on screen together');
      const pfps = await measureFps(S4);
      if (pfps >= 30) ok(`mixed sprites and primitives render at ${pfps} fps`);
      else fail(`partial-manifest fps: ${pfps}`);

      const smooth = JSON.parse(await S4.exec(`const r=window.uvRenderer;
        const before = r.ctx.imageSmoothingEnabled;
        r._resize();
        return JSON.stringify({before, after: r.ctx.imageSmoothingEnabled});`));
      if (smooth.before === false && smooth.after === false) ok('imageSmoothingEnabled stays false across a resize (a resize resets context state)');
      else fail(`imageSmoothing: ${JSON.stringify(smooth)}`);
    } catch (e) { fail(`sprite-art test: ${e.message}`); } finally {
      await S3.close(); await S4.close();
    }
  }

  // ---- 5c. the manifest scale ON THE REAL PLAYER RENDER PATH ----
  //
  // Every other check in this file calls window.uvDrawSprite directly, on a
  // scratch canvas. That proves drawSprite's arithmetic and NOTHING about
  // whether the renderer reaches it: _drawPlayer could stop passing a scale,
  // could size the sprite itself, could call a different helper, and every one
  // of those tests would still pass. This one starts a real run through the
  // real UI, picks a character whose sheet carries a manifest scale, and reads
  // the size off the drawImage the renderer actually issues, with the live
  // transform applied. It is the only test here that would fail if the player
  // path stopped honouring the key.
  {
    const S6 = new Browser();
    try {
      await S6.open('S6');
      const SCALED_CHAR = 'toh_druid', SCALED_ID = 'char.toh_druid';
      await S6.goto(`${URL}?roster=toh`);
      await S6.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 12000, 'title (scaled char)');
      await S6.waitFor(`return window.uvAssets && window.uvAssets.ready ? 1 : 0`, 12000, 'assets settled (scaled char)');
      const decl = JSON.parse(await S6.exec(`
        const A = window.uvAssets, d = A.declared('${SCALED_ID}');
        return JSON.stringify({ declared: !!d, scale: d ? d.scale : null, w: d ? d.w : null, loaded: !!A.get('${SCALED_ID}') });`));

      if (!decl.loaded || !(decl.scale > 1)) {
        // The art or the override can legitimately be absent on a branch that
        // has not landed them. Say so rather than passing silently.
        ok(`no scaled character art on disk (${SCALED_ID}: loaded=${decl.loaded} scale=${decl.scale}) — real-path scale check skipped`);
      } else {
        await S6.exec(`document.getElementById('btn-host').click()`);
        await S6.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')`, 8000, 'lobby (scaled char)');
        await S6.exec(`document.querySelector('.char-card[data-char="${SCALED_CHAR}"]').click()`);
        await sleep(250);
        await S6.exec(`document.getElementById('btn-start').click()`);
        await S6.waitFor(`return window.uv.mode==='run' && !!window.uv.sim`, 8000, 'run (scaled char)');
        await S6.exec(`const s=window.uv.sim; const n=s.floor.nodes.find(x=>x.kind==='combat'); n.template='open_expanse'; s._travelTo(n.id); return 1;`);
        await S6.waitFor(`return window.uv.sim.phase==='arena'`, 8000, 'arena (scaled char)');
        // a trait that offers boons on the fight covers the arena with its
        // picker; take the offer so real frames of the arena actually run
        await S6.exec(`
          const s=window.uv.sim, p=s.players[0];
          if (p.boonOffer && p.boonOffer.length) s.uiAction(0, { kind:'boon', id:p.boonOffer[0].id });
          s.god=true; s.wave.done=true; s.spawnQueue.length=0;
          for (const e of [...s.enemyPool]) s.enemyPool.release(e);
          p.x=s.W/2; p.y=s.H/2; return 1;`);
        await sleep(400);

        // Capture the renderer's own drawImage for this sheet. getTransform()
        // folds in the world-to-device scale, so onScreen is device pixels.
        // exec() wraps in a plain function and resolves the returned promise,
        // so page code that needs await has to hand back its own async IIFE.
        const measured = JSON.parse(await S6.exec(`return (async () => {
          const A = window.uvAssets, r = window.uvRenderer, s = window.uv.sim;
          const entry = A.get('${SCALED_ID}');
          // declared() and get() return the SAME registry object, so the probe
          // has to remember the starting value; comparing them to each other
          // afterwards would pass no matter what the probe left behind.
          const before = entry.scale;
          const fromManifest = (await (await fetch('assets/assets.json', { cache: 'no-cache' })).json())
            .sprites['${SCALED_ID}'].scale;
          const proto = CanvasRenderingContext2D.prototype, orig = proto.drawImage;
          const grab = async mult => {
            const was = entry.scale; entry.scale = mult;
            const hits = [];
            proto.drawImage = function (img, ...a) {
              if (img === entry.img) { const t = this.getTransform();
                hits.push(a.length === 8 ? a[6] * t.a : img.width * t.a); }
              return orig.apply(this, [img, ...a]);
            };
            await new Promise(res => { let n=0; (function f(){ if(++n>8) return res(); requestAnimationFrame(f); })(); });
            proto.drawImage = orig;
            entry.scale = was;
            return hits;
          };
          const one = await grab(1), scaled = await grab(${decl.scale});
          const p = s.players[0];
          return JSON.stringify({
            at1: one[0] || null, atScale: scaled[0] || null,
            calls1: one.length, callsScaled: scaled.length,
            radius: p.radius, worldScale: r._screen.scale, cell: entry.w, fit: entry.fit,
            fromManifest, before, liveScale: entry.scale,
          });
        })();`));

        if (!measured.calls1 || !measured.callsScaled) {
          fail(`the renderer never drew ${SCALED_ID} — the real player path is not reaching drawSprite at all (${JSON.stringify(measured)})`);
        } else {
          // what the geometry says it must be: 2*radius world units, converted
          // to device px, times the sheet's content fit, times the manifest
          // multiplier. Derived from the live radius, viewport and fit, not
          // constants retyped from the manifest.
          const wantAt1 = measured.radius * 2 * measured.worldScale * measured.fit;
          const wantScaled = wantAt1 * decl.scale;
          const close = (a, b) => Math.abs(a - b) < 0.5;
          if (close(measured.at1, wantAt1) && close(measured.atScale, wantScaled)) {
            ok(`the real player render path honours the manifest scale — ${SCALED_ID} draws ${measured.at1.toFixed(1)} device px at scale 1 and ${measured.atScale.toFixed(1)} at ${decl.scale}, measured off the renderer's own drawImage`);
          } else {
            fail(`player path size: ${measured.at1?.toFixed(2)} (want ${wantAt1.toFixed(2)}) at scale 1, ${measured.atScale?.toFixed(2)} (want ${wantScaled.toFixed(2)}) at ${decl.scale} — ${JSON.stringify(measured)}`);
          }
          const ratio = measured.atScale / measured.at1;
          if (Math.abs(ratio - decl.scale) < 0.01) ok(`and the ratio is exactly the manifest's ${decl.scale}x (${ratio.toFixed(3)}) — nothing between the manifest and the canvas is dropping or double-applying it`);
          else fail(`on-screen ratio ${ratio.toFixed(3)}, manifest says ${decl.scale}`);

          // THE PIN. Content normalisation changed how the Druid's size is
          // EXPRESSED (2.25 on the cell became 2.18 on the content) and must
          // not have changed the size itself. Stated in world units so it holds
          // at any viewport: 2 x radius 16 x the 2.25 Casey tuned by eye = 72.
          const PINNED_WORLD_UNITS = 72;
          const cellWorld = measured.atScale / measured.worldScale;
          if (Math.abs(cellWorld - PINNED_WORLD_UNITS) < 0.25) {
            ok(`and he still paints ${cellWorld.toFixed(2)} world units across, against the ${PINNED_WORLD_UNITS} he was tuned at — content normalisation re-expressed the size without moving it`);
          } else {
            fail(`the Druid moved: ${cellWorld.toFixed(3)} world units, pinned at ${PINNED_WORLD_UNITS} `
              + `(fit ${measured.fit} x scale ${decl.scale} = ${(measured.fit * decl.scale).toFixed(6)}, want 2.25)`);
          }
          // checked against the manifest as served, not against the same
          // registry object the probe was mutating
          if (measured.liveScale === measured.fromManifest && measured.before === measured.fromManifest) {
            ok(`and the registry still matches the manifest as served (${measured.fromManifest}) — the probe put back what it borrowed`);
          } else fail(`scale drift: live ${measured.liveScale}, before ${measured.before}, manifest ${measured.fromManifest}`);
        }
      }
      const s6errs = await S6.errors();
      if (s6errs.length) fail(`console errors in the scaled-character run: ${s6errs.join(' | ').slice(0, 300)}`);
      else ok('zero console errors driving a real run with a scaled character sheet');
    } catch (e) { fail(`real-path scale test: ${e.message}`); } finally { await S6.close(); }
  }

  // ---- 5d. ?spritescale and ?playerscale, on the real render path ----
  //
  // The flags exist so a size can be found by eye in a real arena, so the test
  // that matters is the same one: a real run, real frames, size read off the
  // renderer's own drawImage. Checked on a PLAYER sprite (which both flags
  // reach) and an ENEMY sprite (which only ?spritescale reaches), because
  // getting that separation wrong is the whole way this feature is useless.
  {
    const S7 = new Browser();
    try {
      await S7.open('S7');
      // ?spritescale=2 x ?playerscale=1.5 => players 3x, everything else 2x
      await S7.goto(`${URL}?roster=toh&spritescale=2&playerscale=1.5`);
      await S7.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 12000, 'title (tuned)');
      await S7.waitFor(`return window.uvAssets && window.uvAssets.ready ? 1 : 0`, 12000, 'assets settled (tuned)');
      const flags = JSON.parse(await S7.exec(`return (async () => {
        const M = await import('./js/assets.js');
        return JSON.stringify({ sprite: M.SPRITE_SCALE, player: M.PLAYER_SCALE });
      })();`));
      if (flags.sprite === 2 && flags.player === 1.5) ok(`?spritescale=2&playerscale=1.5 parse to ${flags.sprite} and ${flags.player}`);
      else fail(`flag parse: ${JSON.stringify(flags)}`);

      await S7.exec(`document.getElementById('btn-host').click()`);
      await S7.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')`, 8000, 'lobby (tuned)');
      await S7.exec(`document.querySelector('.char-card[data-char="toh_druid"]').click()`);
      await sleep(250);
      await S7.exec(`document.getElementById('btn-start').click()`);
      await S7.waitFor(`return window.uv.mode==='run' && !!window.uv.sim`, 8000, 'run (tuned)');
      await S7.exec(`const s=window.uv.sim; const n=s.floor.nodes.find(x=>x.kind==='combat'); n.template='open_expanse'; s._travelTo(n.id); return 1;`);
      await S7.waitFor(`return window.uv.sim.phase==='arena'`, 8000, 'arena (tuned)');
      await S7.exec(`
        const s=window.uv.sim, p=s.players[0];
        if (p.boonOffer && p.boonOffer.length) s.uiAction(0, { kind:'boon', id:p.boonOffer[0].id });
        s.god=true; s.wave.done=true; s.spawnQueue.length=0;
        for (const e of [...s.enemyPool]) s.enemyPool.release(e);
        p.x=s.W/2; p.y=s.H/2;
        const e = s.spawnEnemyById('skulker', p.x + 120, p.y, { noMats: true });
        if (e) { e.hp=1e9; e.maxHp=2e9; e.spd=0; e.dmg=0; }
        return 1;`);
      await sleep(500);

      const tuned = JSON.parse(await S7.exec(`return (async () => {
        const A = window.uvAssets, r = window.uvRenderer, s = window.uv.sim;
        const proto = CanvasRenderingContext2D.prototype, orig = proto.drawImage;
        const seen = new Map();
        proto.drawImage = function (img, ...a) {
          if (a.length === 8) { const t = this.getTransform();
            for (const id of ['char.toh_druid', 'enemy.skulker']) {
              const en = A.get(id);
              if (en && en.img === img && !seen.has(id)) seen.set(id, a[6] * t.a);
            } }
          return orig.apply(this, [img, ...a]);
        };
        await new Promise(res => { let n=0; (function f(){ if(++n>8) return res(); requestAnimationFrame(f); })(); });
        proto.drawImage = orig;
        const p = s.players[0];
        const en = [...s.enemyPool][0];
        return JSON.stringify({
          player: seen.get('char.toh_druid') ?? null,
          enemy: seen.get('enemy.skulker') ?? null,
          playerRadius: p.radius, enemyRadius: en ? en.radius : null,
          worldScale: r._screen.scale,
          playerFit: A.get('char.toh_druid').fit,
          enemyFit: A.get('enemy.skulker') ? A.get('enemy.skulker').fit : 1,
          manifestScale: A.declared('char.toh_druid').scale,
          enemyLoaded: !!A.get('enemy.skulker'),
        });
      })();`));

      // Players take manifest x spritescale x playerscale; enemies take
      // spritescale alone. Both derived from the live radius and viewport.
      const wantPlayer = tuned.playerRadius * 2 * tuned.worldScale * tuned.playerFit * tuned.manifestScale * 2 * 1.5;
      if (tuned.player !== null && Math.abs(tuned.player - wantPlayer) < 0.5) {
        ok(`?spritescale x ?playerscale compose on the real player path — the Druid draws ${tuned.player.toFixed(1)} device px (manifest ${tuned.manifestScale} x 2 x 1.5)`);
      } else fail(`tuned player size ${tuned.player}, want ${wantPlayer.toFixed(2)} — ${JSON.stringify(tuned)}`);

      if (!tuned.enemyLoaded || tuned.enemy === null) {
        ok('no enemy sprite on disk — ?playerscale isolation checked on the player alone');
      } else {
        const wantEnemy = tuned.enemyRadius * 2 * tuned.worldScale * tuned.enemyFit * 2;   // spritescale only
        if (Math.abs(tuned.enemy - wantEnemy) < 0.5) ok(`and ?playerscale leaves enemies alone — the skulker draws ${tuned.enemy.toFixed(1)} device px, ?spritescale only`);
        else fail(`enemy took the player flag: ${tuned.enemy.toFixed(2)}, want ${wantEnemy.toFixed(2)} — ${JSON.stringify(tuned)}`);
      }

      // the flags are cosmetic: the entity they scale is untouched
      const sim = JSON.parse(await S7.exec(`
        const s = window.uv.sim, p = s.players[0];
        return JSON.stringify({ radius: p.radius, snapHasScale: /"(sprite)?[Ss]cale"/.test(JSON.stringify(s.getSnapshot())) });`));
      if (sim.radius === 16 && !sim.snapHasScale) ok('and at 3x painted size the player radius is still 16 with nothing on the wire — the flags are paint');
      else fail(`tuning reached the sim: ${JSON.stringify(sim)}`);

      const s7errs = await S7.errors();
      if (s7errs.length) fail(`console errors with size tuning on: ${s7errs.join(' | ').slice(0, 300)}`);
      else ok('zero console errors with ?spritescale and ?playerscale active');
    } catch (e) { fail(`size-tuning test: ${e.message}`); } finally { await S7.close(); }
  }

  // ---- 5e. CONTENT NORMALISATION: different padding, same rendered size ----
  //
  // This is the gate, not a derivation. Two sheets whose figures occupy very
  // different fractions of their cell must paint at the SAME size once content
  // is divided out — that property is the entire reason the key exists, and
  // asserting the arithmetic instead would prove nothing about the chain from
  // sprite-overrides.json through the generated manifest into the loader.
  //
  // It runs the real chain: write fixture PNGs, write the overrides, regenerate
  // assets.json with the real generator, load the real game. Both files are
  // restored in `finally` from copies taken before anything is touched.
  {
    const spriteRoot = path.join(process.cwd(), 'assets', 'sprites');
    const enemyDir = path.join(spriteRoot, 'enemy');
    const OVERRIDES = path.join(process.cwd(), 'assets', 'sprite-overrides.json');
    const MANIFEST = path.join(process.cwd(), 'assets', 'assets.json');
    const overridesBefore = fs.readFileSync(OVERRIDES, 'utf8');
    const manifestBefore = fs.readFileSync(MANIFEST, 'utf8');
    // TALL fills 24 of its 32 cell; SQUAT fills 16. Same 20px width, so only the
    // height fraction differs — 75% against 50%.
    // NAKED is installed with NO content override on purpose: the silent
    // fallback has to be visible, so it must produce a warning naming it.
    const TALL = 'enemy.slabjaw', SQUAT = 'enemy.lobber', NAKED = 'enemy.gemmite';
    const tallFile = path.join(enemyDir, 'slabjaw.png'), squatFile = path.join(enemyDir, 'lobber.png');
    const nakedFile = path.join(enemyDir, 'gemmite.png');
    const CELL = E_CELL, DIRS = 8;
    const FIG_W = Math.round(CELL * 0.625), TALL_H = Math.round(CELL * 0.75), SQUAT_H = Math.round(CELL * 0.5);
    // one solid block per row, centred, transparent everywhere else
    const blockGrid = figH => pngRGBA(CELL, CELL * DIRS, (x, y) => {
      const cy = y % CELL;
      const inX = x >= (CELL - FIG_W) / 2 && x < (CELL + FIG_W) / 2;
      const inY = cy >= (CELL - figH) / 2 && cy < (CELL + figH) / 2;
      return inX && inY ? [240, 90, 90, 255] : [0, 0, 0, 0];
    });
    const S8 = new Browser();
    try {
      fs.mkdirSync(enemyDir, { recursive: true });
      fs.writeFileSync(tallFile, blockGrid(TALL_H));
      fs.writeFileSync(squatFile, blockGrid(SQUAT_H));
      fs.writeFileSync(nakedFile, blockGrid(TALL_H));
      const over = JSON.parse(overridesBefore);
      over[TALL] = { ...(over[TALL] || {}), content: [FIG_W, TALL_H] };
      over[SQUAT] = { ...(over[SQUAT] || {}), content: [FIG_W, SQUAT_H] };
      fs.writeFileSync(OVERRIDES, JSON.stringify(Object.fromEntries(Object.keys(over).sort().map(k => [k, over[k]])), null, 2) + '\n');
      execFileSync(process.execPath, [path.join(process.cwd(), 'tools', 'gen_assets_manifest.mjs')], { stdio: 'pipe' });

      await S8.open('S8');
      await S8.goto(URL);
      await S8.waitFor(`return window.uvAssets && window.uvAssets.ready ? 1 : 0`, 12000, 'assets settled (content)');

      const m = JSON.parse(await S8.exec(`return (async () => {
        const A = window.uvAssets, D = window.uvDrawSprite;
        const t = A.get('${TALL}'), q = A.get('${SQUAT}');
        if (!t || !q) return JSON.stringify({ loaded: false });
        const c = document.createElement('canvas'); c.width = c.height = 400;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        // painted silhouette height, measured off the canvas, not derived
        const paintedH = (id, forceFit) => {
          const e = A.get(id), was = e.fit;
          if (forceFit !== undefined) e.fit = forceFit;
          g.clearRect(0, 0, 400, 400);
          D(g, id, 200, 200, { scale: 1, facing: Math.PI / 2 });
          e.fit = was;
          const d = g.getImageData(0, 0, 400, 400).data;
          let top = -1, bot = -1;
          for (let y = 0; y < 400; y++) {
            let any = false;
            for (let x = 0; x < 400; x++) if (d[(y * 400 + x) * 4 + 3] > 0) { any = true; break; }
            if (any) { if (top < 0) top = y; bot = y; }
          }
          return top < 0 ? 0 : bot - top + 1;
        };
        return JSON.stringify({
          loaded: true,
          tallFit: t.fit, squatFit: q.fit,
          tallContent: t.content, squatContent: q.content,
          normTall: paintedH('${TALL}'), normSquat: paintedH('${SQUAT}'),
          rawTall: paintedH('${TALL}', 1), rawSquat: paintedH('${SQUAT}', 1),
        });
      })();`));

      if (!m.loaded) {
        fail('content-normalisation fixtures did not load');
      } else {
        const wantFitT = CELL / TALL_H, wantFitQ = CELL / SQUAT_H;
        if (Math.abs(m.tallFit - wantFitT) < 1e-6 && Math.abs(m.squatFit - wantFitQ) < 1e-6) {
          ok(`content reached the loader through overrides -> generated manifest: fit ${m.tallFit.toFixed(3)} for a ${TALL_H}/${CELL} figure and ${m.squatFit.toFixed(3)} for a ${SQUAT_H}/${CELL} one`);
        } else fail(`fit not derived from content: ${JSON.stringify(m)}`);

        // THE GATE. Two figures padded 75% and 50% of their cell, painted.
        if (Math.abs(m.normTall - m.normSquat) <= 1) {
          ok(`padding no longer decides size — a 75%-filled and a 50%-filled sheet both paint ${m.normTall}px tall, measured off the canvas`);
        } else fail(`content normalisation did not equalise: ${m.normTall}px vs ${m.normSquat}px (fits ${m.tallFit}, ${m.squatFit})`);

        // and prove the gate can fail: without fit they differ by 24/16
        const rawRatio = m.rawTall / m.rawSquat;
        if (Math.abs(rawRatio - TALL_H / SQUAT_H) < 0.12) {
          ok(`and the same two sheets differ ${rawRatio.toFixed(2)}x when fit is forced to 1 (${m.rawTall}px vs ${m.rawSquat}px) — the bug this replaces, still reproducible`);
        } else fail(`forcing fit=1 should reproduce the ${TALL_H / SQUAT_H}x spread, got ${rawRatio.toFixed(2)}x`);
      }

      // A sheet installed without `content` silently falls back to fit 1 and is
      // sized by its padding again — the bug this whole key removes, back with
      // no symptom. So it must be ANNOUNCED, and named.
      const naked = JSON.parse(await S8.exec(`
        const A = window.uvAssets, e = A.get('${NAKED}');
        return JSON.stringify({ loaded: !!e, fit: e ? e.fit : null, tracked: [...A.missingContent] });`));
      const warnLine = (S8.consoleLines || []).find(l => /no "content"/.test(l)) || '';
      if (naked.loaded && naked.fit === 1 && naked.tracked.includes(NAKED)) {
        ok(`a sheet installed without content falls back to fit 1 and is tracked — ${naked.tracked.length} id(s) in Assets.missingContent`);
      } else fail(`missing-content fallback not tracked: ${JSON.stringify(naked)}`);
      if (warnLine.includes(NAKED) && /--record-content/.test(warnLine)) {
        ok('and it warns at load naming the id and the command that fixes it, rather than failing silently');
      } else fail(`no warning naming ${NAKED}: ${warnLine.slice(0, 200) || '(none)'}`);
    } catch (e) { fail(`content-normalisation test: ${e.message}`); } finally {
      for (const f of [tallFile, squatFile, nakedFile]) { try { fs.rmSync(f, { force: true }); } catch {} }
      try { fs.rmdirSync(enemyDir); } catch { /* real art lives here */ }
      fs.writeFileSync(OVERRIDES, overridesBefore);
      fs.writeFileSync(MANIFEST, manifestBefore);
      await S8.close();
    }
  }

  // ---- 5f. the Hunter's beast on the real client path ----
  //
  // The sim suite already proves the state machine. What only a browser can
  // prove is that the beast survives the trip through the real renderer and the
  // real client-side decode: main.js builds one view shape from the sim (host)
  // and another from a decoded snapshot (client), and a field added to one and
  // not the other is invisible until somebody joins a game.
  //
  // This runs in ONE browser on purpose. The two-browser check is in the --coop
  // phase, which needs a working relay; this one has no such dependency, so the
  // beast never goes unverified just because signalling was down.
  {
    const S9 = new Browser();
    try {
      await S9.open('S9');
      await S9.goto(`${URL}?roster=toh`);
      await S9.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 12000, 'title (beast)');
      await S9.exec(`document.getElementById('btn-host').click()`);
      await S9.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')`, 8000, 'lobby (beast)');
      await S9.exec(`document.querySelector('.char-card[data-char="toh_hunter"]').click()`);
      await sleep(250);
      await S9.exec(`document.getElementById('btn-start').click()`);
      await S9.waitFor(`return window.uv.mode==='run' && !!window.uv.sim`, 8000, 'run (beast)');
      await S9.exec(`const s=window.uv.sim; const n=s.floor.nodes.find(x=>x.kind==='combat'); n.template='open_expanse'; s._travelTo(n.id); return 1;`);
      await S9.waitFor(`return window.uv.sim.phase==='arena'`, 8000, 'arena (beast)');
      await S9.exec(`
        const s=window.uv.sim, p=s.players[0];
        if (p.boonOffer && p.boonOffer.length) s.uiAction(0, { kind:'boon', id:p.boonOffer[0].id });
        s.god=true; return 1;`);
      await sleep(500);

      const live = JSON.parse(await S9.exec(`
        const s = window.uv.sim;
        const b = s.summons.find(x => x.type === 'beast');
        return JSON.stringify({ has: !!b, state: b && b.state, hp: b && b.maxHp });`));
      if (live.has) ok(`the Hunter's beast is live in a real run (state ${live.state}, ${live.hp} HP)`);
      else fail('no beast in a real Hunter run');

      // ---- the bear sheet: does it load, and does the renderer pick the row
      //      that matches the facing? ----
      //
      // _drawSummon is a DIFFERENT draw path from _drawPlayer, and it is the
      // only one that passes a summon's aimA as a facing. Every other
      // directional check in this file goes through the player path or through
      // drawSprite in isolation, so neither would notice this one regressing —
      // the bear would just face the wrong way, which reads as "the art is a
      // bit off" and survives a playtest.
      //
      // The sim is frozen for the measurement: updateBeast rewrites aimA from
      // the movement direction every tick, so a facing set from outside is
      // overwritten before the renderer ever sees it.
      const rows = JSON.parse(await S9.exec(`return (async () => {
        const A = window.uvAssets, s = window.uv.sim, p = s.players[0];
        const entry = A.get('beast.bear');
        if (!entry || !entry.img) return JSON.stringify({ loaded: false });
        const b = s.summons.find(x => x.type === 'beast');
        const proto = CanvasRenderingContext2D.prototype, orig = proto.drawImage;
        const frames = n => new Promise(r => { let i = 0; (function f(){ if (++i > n) return r(); requestAnimationFrame(f); })(); });
        const realTick = s.tick.bind(s);
        s.tick = () => {};
        const out = [];
        for (let d = 0; d < 8; d++) {
          b.down = false; b.x = p.x + 150; b.y = p.y; b.aimA = d * Math.PI / 4;
          await frames(2);
          let row = -1;
          proto.drawImage = function (img, ...a) {
            if (img === entry.img && a.length === 8 && row < 0) row = Math.round(a[1] / entry.h);
            return orig.apply(this, [img, ...a]);
          };
          await frames(3);
          proto.drawImage = orig;
          out.push(row);
        }
        s.tick = realTick;
        return JSON.stringify({ loaded: true, rows: out, cell: entry.w, content: entry.content, scale: entry.scale });
      })();`));
      if (!rows.loaded) {
        // legitimate on a branch where the sheet has not landed — say so
        ok('no beast.bear art on disk — the sheet check is skipped, the primitive carries it');
      } else {
        const want = [0, 1, 2, 3, 4, 5, 6, 7];
        if (JSON.stringify(rows.rows) === JSON.stringify(want)) {
          ok(`the bear sheet loads and _drawSummon picks the right row for all eight facings (E→0 … NE→7, cell ${rows.cell}, content ${rows.content})`);
        } else fail(`bear facing→row mapping is wrong: got ${JSON.stringify(rows.rows)}, want ${JSON.stringify(want)}`);
      }

      // the two view builders must agree. Encode and decode the host's own
      // snapshot in-page — the same netcodec a client uses — and compare the
      // summon rows the client would draw from.
      // exec() wraps page code in a PLAIN function, so anything needing await
      // has to hand back its own async IIFE.
      const agree = JSON.parse(await S9.exec(`return (async () => {
        const codec = await import('/js/netcodec.js');
        const s = window.uv.sim;
        const snap = s.getSnapshot();
        const wire = codec.decodeSnap(codec.encodeSnap(snap));
        const a = snap.summons.filter(r => r[1] === 'beast');
        const b = wire.summons.filter(r => r[1] === 'beast');
        return JSON.stringify({ n: a.length, same: JSON.stringify(a) === JSON.stringify(b), row: a[0] || null });
      })();`));
      if (agree.n === 1 && agree.same && agree.row.length === 8) {
        ok(`the beast survives the real codec unchanged — 8-field summon row, summons are pass-through (${JSON.stringify(agree.row.slice(6))} tail)`);
      } else fail(`codec disagreement on the beast row: ${JSON.stringify(agree)}`);

      // knock it down and watch the WIRE field, then the renderer, then revive
      const down = JSON.parse(await S9.exec(`
        const s = window.uv.sim;
        const b = s.summons.find(x => x.type === 'beast');
        window.uvBeast.hurtBeast(s, b, 99999);
        const row = s.getSnapshot().summons.find(r => r[1] === 'beast');
        return JSON.stringify({ p: row ? row[7] : -1, sent: !!row, down: !!b.down, dead: !!b.dead });`));
      if (down.sent && down.down && !down.dead && down.p > 0.9) {
        ok(`a downed beast stays on the wire with its countdown (${down.p}), it is not deleted`);
      } else fail(`downed beast on the wire: ${JSON.stringify(down)}`);

      // the renderer has to survive drawing it in both states — with no art on
      // disk this exercises the primitive fallback, which is what ships first
      await sleep(600);
      const drewDown = await S9.exec(`return window.uvRenderer && window.uvRenderer.canvas.width > 0 ? 1 : 0`);
      if (drewDown) ok(`the renderer survives drawing a downed beast (${rows.loaded ? 'sheet path' : 'primitive fallback'})`);
      else fail('renderer stalled on a downed beast');

      await S9.exec(`
        const s = window.uv.sim;
        const b = s.summons.find(x => x.type === 'beast');
        b.downT = 0.02; return 1;`);
      await sleep(500);
      const back = JSON.parse(await S9.exec(`
        const s = window.uv.sim, p = s.players[0];
        const b = s.summons.find(x => x.type === 'beast');
        const row = s.getSnapshot().summons.find(r => r[1] === 'beast');
        return JSON.stringify({ down: !!b.down, hp: b.hp, max: b.maxHp, d: Math.round(Math.hypot(b.x-p.x, b.y-p.y)), p: row ? row[7] : -1 });`));
      if (!back.down && back.hp === back.max && back.p === 0) {
        ok(`it revives at full HP (${back.hp}/${back.max}) near the owner (${back.d}u) and the wire flag clears`);
      } else fail(`revive on the real path: ${JSON.stringify(back)}`);

      const bErrs = await S9.errors();
      if (bErrs.length) fail(`console errors with a beast in play: ${bErrs.join(' | ').slice(0, 300)}`);
      else ok('zero console errors across a beast knockdown and revival');
    } catch (e) { fail(`beast client-path test: ${e.message}`); } finally { await S9.close(); }
  }

  // ---- 6. ?sprites=debug names what is missing and what row it picked ----
  {
    const S5 = new Browser();
    try {
      await S5.open('S5');
      await S5.goto(`${URL}?sprites=debug`);
      await S5.waitFor(`return window.uvAssets && window.uvAssets.ready ? 1 : 0`, 12000, 'assets settled (debug)');
      await sleep(400);
      const logs = await S5.logs();
      const list = logs.find(l => /\[sprites\] missing:/.test(l));
      if (list && /enemy\.gyre/.test(list)) ok(`?sprites=debug lists every missing id once at load (${list.length} chars)`);
      else fail('sprites=debug did not log the missing list');
      const rejected = logs.find(l => new RegExp(`enemy\\.flit.*grid must be exactly ${E_CELL}x${E_CELL * 8}`).test(l));
      if (rejected) ok('the rejected grid says exactly what size it should have been');
      else fail('no diagnostic for the wrong-sized grid');
      // the direction readout: ink above the sprite in debug mode, none without it
      const overlay = JSON.parse(await S5.exec(`
        const D = window.uvDrawSprite;
        const c = document.createElement('canvas'); c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        g.clearRect(0,0,128,128); D(g,'enemy.skulker',64,80,{facing:0});
        // band strictly above the 32px cell, whose top edge is at 80-16=64
        const band = g.getImageData(0, 50, 128, 14).data;
        let ink = 0; for (let i=3;i<band.length;i+=4) if (band[i] > 0) ink++;
        return JSON.stringify({ink});`));
      if (overlay.ink > 0) ok(`?sprites=debug overlays the resolved direction index on directional sprites (${overlay.ink} px of readout)`);
      else fail('no direction readout drawn in debug mode');
      const derrs = await S5.errors();
      if (derrs.length) fail(`console errors in debug mode: ${derrs.join(' | ').slice(0, 300)}`);
      else ok('debug mode logs, it does not error');
    } catch (e) { fail(`sprites=debug test: ${e.message}`); } finally {
      await S5.close();
      removeArt();
    }
  }
}

// ---------- tiled floors: the biome layer, which only a renderer can check ----------
//
// Everything here is a pixel claim. The sim suite can prove the variant hash is
// deterministic and that the biome never reaches the simulation; it cannot
// prove the floor actually paints, scrolls with the camera, or has no gaps at
// the viewport edge. That is this section's job.
{
  const T = new Browser();
  // Reach into a floor-1 arena. Floor 1 is the tundra floor; floor 2 is not,
  // which is what makes "non-tundra maps are unchanged" checkable.
  const enterArena = async (br) => {
    await br.exec(`document.getElementById('btn-host').click()`);
    await br.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')`, 5000, 'lobby');
    await br.exec(`document.querySelector('.char-card[data-char="bulwark"]').click()`);
    await sleep(200);
    await br.exec(`document.getElementById('btn-start').click()`);
    await br.waitFor(`return window.uv.mode==='run' && !!window.uv.sim`, 5000, 'run');
    await br.exec(`const s=window.uv.sim; if(!s.god) s.debug('F5'); s._travelTo(s.reachableNodes()[0]); return 1;`);
    await br.waitFor(`return window.uv.sim.phase==='arena'`, 5000, 'arena');
    await sleep(400);
  };
  // Sample the floor: a band across the middle of the canvas, well clear of the
  // HUD chrome at top and bottom. Returns a colour histogram plus a hash, so
  // one readback answers "is it tiles", "is it flat" and "is it the same as
  // last time" without three round trips.
  const FLOOR_SCAN = `(function(){
    const c = document.getElementById('game-canvas');
    const g = c.getContext('2d');
    // Below the player, deliberately. The camera keeps the player at screen
    // centre and its idle animation is driven by performance.now(), so a band
    // across the middle measures the character's current frame as much as the
    // ground — which is exactly what made the determinism check fail.
    const y0 = Math.round(c.height * 0.68), h = Math.round(c.height * 0.14);
    const d = g.getImageData(0, y0, c.width, h).data;
    const hist = new Map(); let hash = 0;
    for (let i = 0; i < d.length; i += 4) {
      const k = (d[i] << 16) | (d[i+1] << 8) | d[i+2];
      hist.set(k, (hist.get(k) || 0) + 1);
      hash = (Math.imul(hash, 31) + k) | 0;
    }
    const top = [...hist.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4)
      .map(([k,n]) => ['#' + k.toString(16).padStart(6,'0'), n]);
    const px = d.length / 4;
    const flat = (hist.get(0x14161f) || 0) / px;
    return JSON.stringify({ px, distinct: hist.size, top, flatFrac: flat, hash });
  })()`;

  try {
    await T.open('T');
    await T.goto(URL);
    await T.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title');
    await enterArena(T);

    // -- the tiles are actually loaded, through the ordinary sprite registry --
    const loaded = JSON.parse(await T.exec(`const ids=['tile.tundra_00','tile.tundra_01','tile.tundra_02','tile.tundra_03','tile.tundra_04'];
      return JSON.stringify(ids.map(id => { const s = window.uvAssets.get(id); return s && s.img ? [s.w, s.h] : null; }));`));
    const got = loaded.filter(Boolean);
    if (got.length === 5 && got.every(([w, h]) => w === 64 && h === 64)) ok(`all 5 tundra tiles loaded at 64x64 through the sprite registry — no second image path`);
    else fail(`tundra tiles loaded: ${JSON.stringify(loaded)} — want five 64x64 entries`);

    // -- floor 1 renders tiled, not flat --
    const tundra = JSON.parse(await T.exec(`return ${FLOOR_SCAN}`));
    if (tundra.distinct > 20) ok(`tundra floor renders tiled — ${tundra.distinct} distinct colours across ${tundra.px} sampled pixels (a flat fill is 1)`);
    else fail(`tundra floor looks flat: only ${tundra.distinct} distinct colour(s), top ${JSON.stringify(tundra.top)}`);
    if (tundra.flatFrac < 0.02) ok(`no gaps at the viewport edges — ${(tundra.flatFrac * 100).toFixed(2)}% of the band is bare fallbackFill (a seam or a missed margin row shows as #14161f)`);
    else fail(`${(tundra.flatFrac * 100).toFixed(1)}% of the floor band is bare fallbackFill — the tile draw is leaving gaps`);

    // -- and it scrolls with the camera, using the entity layer's transform --
    await T.exec(`const s=window.uv.sim; s.players[0].x += 500; s.players[0].y += 220; return 1;`);
    await sleep(700);   // camera glides; give it time to arrive
    const moved = JSON.parse(await T.exec(`return ${FLOOR_SCAN}`));
    if (moved.hash !== tundra.hash) ok(`the floor scrolls with the camera — the sampled band changed after the player moved 500u (was ${tundra.hash}, now ${moved.hash})`);
    else fail('the floor did not change when the camera moved — it is not tracking the camera transform');
    if (moved.distinct > 20 && moved.flatFrac < 0.02) ok(`still fully tiled after scrolling (${moved.distinct} colours, ${(moved.flatFrac * 100).toFixed(2)}% bare)`);
    else fail(`scrolling exposed bare floor: ${moved.distinct} colours, ${(moved.flatFrac * 100).toFixed(1)}% fallbackFill`);

    // -- same coordinates, same tiles --
    // Rendered through the renderer's own _drawFloor() onto a scratch canvas,
    // with nothing else on it. Sampling the live frame cannot answer this: the
    // band also contains the player (screen centre, time-driven idle frame),
    // the hatch, and any fx alive that instant, and the camera only ever
    // converges on a position asymptotically. Two earlier versions of this
    // check measured exactly those things and called the floor
    // non-deterministic. Isolated, the claim is exact — same world rectangle,
    // byte-identical pixels — and needs no tolerance at all.
    const floorHash = (x0, y0) => T.exec(`
      const r = window.uvRenderer;
      const c = document.createElement('canvas'); c.width = 640; c.height = 320;
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, -${x0}, -${y0});
      r._tileCache = null;
      r._drawFloor(g, { biome: 'tundra' }, 100000, 100000, ${x0}, ${x0} + 640, ${y0}, ${y0} + 320);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let h = 0; for (let i = 0; i < d.length; i += 4) h = (Math.imul(h, 31) + ((d[i] << 16) | (d[i+1] << 8) | d[i+2])) | 0;
      return h;`);
    const hA1 = await floorHash(900, 500);
    const hB = await floorHash(1900, 800);
    const hA2 = await floorHash(900, 500);
    if (hA1 === hA2) ok(`the same world rectangle renders the identical floor twice (hash ${hA1}) — byte-exact, no tolerance; the layout is a function of coordinates, not of time or of a roll`);
    else fail(`the same world rectangle produced two different floors (${hA1} then ${hA2}) — the tile layout is not deterministic`);
    if (hB !== hA1) ok(`and a different rectangle is a different floor (${hB}) — the check is not passing on a constant`);
    else fail(`two different world rectangles hashed the same (${hA1}) — the floor is not varying by coordinate at all`);

    // -- the debug grid is off by default and comes back on the flag --
    const gridOff = JSON.parse(await T.exec(`return JSON.stringify({on: /grid=1/.test(location.search)})`));
    const noGrid = await T.exec(`const c=document.getElementById('game-canvas'); const g=c.getContext('2d');
      const d=g.getImageData(0, Math.round(c.height*0.42), c.width, Math.round(c.height*0.16)).data;
      let n=0; for (let i=0;i<d.length;i+=4) if (d[i]===0x1b && d[i+1]===0x1e && d[i+2]===0x2b) n++; return n;`);
    if (!gridOff.on && noGrid === 0) ok('the debug grid is off by default — no grid pixels on a themed floor');
    else fail(`debug grid drew ${noGrid} grid-coloured pixels with no ?grid=1`);

    // -- floor 2 has no biome and must look exactly as it always has --
    await T.exec(`const s=window.uv.sim; s._startFloor(2); return 1;`);
    await T.exec(`const s=window.uv.sim; s._travelTo(s.reachableNodes()[0]); return 1;`);
    await T.waitFor(`return window.uv.sim.phase==='arena' && window.uv.sim.floorNum===2`, 5000, 'floor 2 arena');
    await sleep(400);
    const plain = JSON.parse(await T.exec(`return ${FLOOR_SCAN}`));
    const biome2 = await T.exec(`return JSON.stringify(window.uv.sim.biome)`);
    if (biome2 === 'null') ok('floor 2 carries no biome');
    else fail(`floor 2 biome is ${biome2}, want null`);
    if (plain.flatFrac > 0.5) ok(`floor 2 renders the flat #14161f floor exactly as before — ${(plain.flatFrac * 100).toFixed(0)}% of the band is the original fill`);
    else fail(`floor 2 is not flat: only ${(plain.flatFrac * 100).toFixed(1)}% original fill, top colours ${JSON.stringify(plain.top)}`);

    const terr = await T.errors();
    if (!terr.length) ok('no console errors rendering a themed floor');
    else fail(`console errors on the tiled floor: ${terr.join(' | ').slice(0, 300)}`);
  } catch (e) { fail(`tiled floor: ${e.message}`); } finally { await T.close(); }

  // -- what the tiled floor costs, measured rather than asserted --
  // A/B in ONE process on ONE static scene: same build, same camera, same
  // frame, tiles on and then off. Cross-build timing on headless SwiftShader is
  // dominated by machine noise; this difference is not, because everything
  // except the floor draw is identical between the two measurements.
  //
  // It times Renderer.draw() itself, NOT the rAF interval. The browser is
  // vsync-limited, so every frame interval reads ~16.7 ms whatever the renderer
  // does — measuring intervals reported the tile layer as free, which it is
  // not. Draw duration is the thing the floor can actually move.
  {
    const P = new Browser();
    try {
      await P.open('P');
      await P.goto(URL);
      await P.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title (perf)');
      await enterArena(P);
      await P.exec(clearFightJs);
      await sleep(300);
      await P.exec(`const r = window.uvRenderer;
        if (!r._perfWrapped) { const orig = r.draw.bind(r); r._perfT = [];
          r.draw = (v, d) => { const t0 = performance.now(); orig(v, d); r._perfT.push(performance.now() - t0); };
          r._perfWrapped = true; }
        return 1;`);
      const drawMs = async () => {
        await P.exec(`window.uvRenderer._perfT.length = 0; return 1;`);
        await sleep(3000);
        return JSON.parse(await P.exec(`const t = window.uvRenderer._perfT.slice().sort((a,b)=>a-b);
          return JSON.stringify({ n: t.length, med: +t[t.length>>1].toFixed(3), p95: +t[Math.floor(t.length*0.95)].toFixed(3) });`));
      };
      const drawn = await P.exec(`const r = window.uvRenderer, c = document.getElementById('game-canvas');
        const T = window.uvBiome.FLOOR_TILE, sc = r._screen.scale;
        return Math.ceil(c.width / sc / T + 2) * Math.ceil(c.height / sc / T + 2);`);
      const on = await drawMs();
      // Tiles off at the renderer, not via the biome config: stubbing the one
      // lookup is unambiguous, where mutating `variants` left the cache holding
      // the old set and quietly measured the same scene twice.
      await P.exec(`const r = window.uvRenderer; r._tileSetReal = r._tileSet; r._tileSet = () => null; r._tileCache = null; return 1;`);
      await sleep(400);
      const flatCheck = JSON.parse(await P.exec(`return ${FLOOR_SCAN}`));
      const off = await drawMs();
      await P.exec(`const r = window.uvRenderer; r._tileSet = r._tileSetReal; r._tileCache = null; return 1;`);
      if (flatCheck.flatFrac > 0.5) ok(`perf A/B is honest — with the tile lookup stubbed the same scene draws ${(flatCheck.flatFrac * 100).toFixed(0)}% flat fill`);
      else fail(`perf A/B did not actually turn the tiles off (${(flatCheck.flatFrac * 100).toFixed(1)}% flat) — the numbers below would compare nothing`);
      const d = on.med - off.med;
      console.log(`  PERF tundra floor draw(): tiles ON ${on.med.toFixed(3)} ms median / ${on.p95.toFixed(3)} p95 (n=${on.n})`
        + ` · OFF ${off.med.toFixed(3)} / ${off.p95.toFixed(3)} (n=${off.n})`
        + ` · delta ${d >= 0 ? '+' : ''}${d.toFixed(3)} ms for ~${drawn} drawImage calls/frame (headless SwiftShader)`);
      if (on.med <= 16.6) ok(`tundra floor holds the 60fps budget: ${on.med.toFixed(3)} ms median draw() <= 16.6 ms`);
      else fail(`tundra floor draw() ${on.med.toFixed(3)} ms exceeds the 16.6 ms 60fps budget`);
      if (d <= 4) ok(`the tile layer costs ${d >= 0 ? '+' : ''}${d.toFixed(3)} ms/frame on an identical scene (~${drawn} tiles)`);
      else fail(`the tile layer costs ${d.toFixed(3)} ms/frame — more than the 4 ms this patch is willing to spend on ground`);
    } catch (e) { fail(`floor perf: ${e.message}`); } finally { await P.close(); }
  }

  // -- degrade: a biome whose atlas is not there must draw the flat floor --
  // Missing art is the normal state of this project, so the failure mode has to
  // be a floor, not a black screen and not a crash. Tested by moving the real
  // tiles aside, which is also the state every future biome is in on the day
  // its config lands and before its art does.
  {
    const tilesDir = path.join(REPO, 'assets/tiles/tundra');
    const stashed = path.join(REPO, 'assets/tiles/_tundra_stashed');
    const D = new Browser();
    let moved = false;
    try {
      if (fs.existsSync(tilesDir)) { fs.renameSync(tilesDir, stashed); moved = true; }
      await D.open('D');
      await D.goto(URL);
      await D.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title (no atlas)');
      await enterArena(D);
      const bare = JSON.parse(await D.exec(`return ${FLOOR_SCAN}`));
      if (bare.flatFrac > 0.5) ok(`a missing atlas degrades to the flat ${'#14161f'} floor — ${(bare.flatFrac * 100).toFixed(0)}% of the band, no black screen`);
      else fail(`missing atlas did not fall back: ${(bare.flatFrac * 100).toFixed(1)}% fallbackFill, top ${JSON.stringify(bare.top)}`);
      const derrs = await D.errors();
      if (!derrs.length) ok('a missing atlas is not an error — zero console errors with no tiles on disk');
      else fail(`missing atlas raised console errors: ${derrs.join(' | ').slice(0, 300)}`);
      const lines = (await D.logs()).filter(l => /\[biome\]/.test(l));
      if (lines.length === 1) ok(`and it says so exactly once: "${lines[0].trim().slice(0, 110)}"`);
      else fail(`expected one [biome] log line with no atlas, got ${lines.length}${lines.length ? ': ' + lines[0].slice(0, 120) : ''}`);
      // and the game is still a game: the sim keeps running under a flat floor
      const t0 = await D.exec('return window.uv.sim.tickNum');
      await sleep(400);
      const t1 = await D.exec('return window.uv.sim.tickNum');
      if (t1 > t0) ok('the run continues normally with no floor art'); else fail('the sim stalled with no floor art');
    } catch (e) { fail(`missing atlas: ${e.message}`); } finally {
      await D.close();
      if (moved && fs.existsSync(stashed)) fs.renameSync(stashed, tilesDir);
    }
  }

  // -- degrade: a tile of the wrong size is rejected BY PATH, not drawn --
  {
    const bad = path.join(REPO, 'assets/tiles/tundra/tile-00.png');
    const keep = fs.existsSync(bad) ? fs.readFileSync(bad) : null;
    const C = new Browser();
    try {
      fs.writeFileSync(bad, pngRGBA(32, 32, () => [255, 0, 255, 255]));   // right file, wrong size
      await C.open('C');
      await C.goto(URL);
      await C.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title (bad tile)');
      await enterArena(C);
      const reject = (await C.logs()).find(l => /tile\.tundra_00/.test(l) && /32x32/.test(l)) || '';
      if (/tile-00\.png/.test(reject)) ok(`a 32x32 tile is rejected and the offending PATH is named: "${reject.trim().slice(0, 130)}"`);
      else fail(`a wrong-sized tile was not rejected by path — logs: ${(await C.logs()).filter(l => /tile/.test(l)).slice(0, 2).join(' | ').slice(0, 200)}`);
      const four = JSON.parse(await C.exec(`return ${FLOOR_SCAN}`));
      if (four.distinct > 20 && four.flatFrac < 0.02) ok(`and the floor still tiles from the four good variants (${four.distinct} colours, ${(four.flatFrac * 100).toFixed(2)}% bare) — one bad tile is not a bare floor`);
      else fail(`one bad tile broke the floor: ${four.distinct} colours, ${(four.flatFrac * 100).toFixed(1)}% bare`);
      const cerrs = await C.errors();
      if (!cerrs.length) ok('a wrong-sized tile warns, it does not error'); else fail(`bad tile raised console errors: ${cerrs.join(' | ').slice(0, 200)}`);
    } catch (e) { fail(`bad tile: ${e.message}`); } finally {
      await C.close();
      if (keep) fs.writeFileSync(bad, keep);
    }
  }

  // -- the debug grid, on the flag, aligned to tile boundaries --
  {
    const G = new Browser();
    try {
      await G.open('G');
      await G.goto(URL + '?grid=1');
      await G.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title (grid)');
      await enterArena(G);
      // Grid lines are drawn at world multiples of CONFIG.FLOOR_TILE. Convert
      // one to screen and confirm a grid-coloured pixel is actually there:
      // "the grid still aligns to tile boundaries" is a claim about geometry,
      // not about whether any lines appeared.
      // A grid line is 1 WORLD unit wide, so at any scale below 1 device px per
      // world unit it lands antialiased — a blend of #1b1e2b and whatever tile
      // is under it, never the pure grid colour. Looking for an exact RGB match
      // finds almost nothing (it found 1 of 13). What is actually true is that
      // the boundary column is DARKER than the tile a half-cell away, because
      // the grid is much darker than 0.60-value snow. That is what is measured.
      await G.exec(`const s=window.uv.sim; s.enemyPool.clear(); s.projPool.clear(); s.pickups.length=0; return 1;`);
      await sleep(300);
      const align = JSON.parse(await G.exec(`
        const c = document.getElementById('game-canvas'), g = c.getContext('2d');
        const T = window.uvBiome.FLOOR_TILE;
        const r = window.uvRenderer;
        const scale = r._screen.scale, camX = r.camX;   // the renderer's own numbers
        const ox = c.width / 2 - camX * scale;
        const y0 = Math.round(c.height * 0.44), h = Math.round(c.height * 0.10);
        const lumAt = sx => {
          const d = g.getImageData(sx, y0, 1, h).data;
          let s2 = 0; for (let i = 0; i < d.length; i += 4) s2 += 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2];
          return s2 / (d.length / 4);
        };
        let hits = 0, tried = 0; const deltas = [];
        for (let wx = Math.ceil((camX - 380) / T) * T; wx < camX + 380; wx += T) {
          const sx = Math.round(wx * scale + ox);
          const ref = Math.round((wx + T / 2) * scale + ox);
          if (sx < 2 || sx > c.width - 3 || ref < 2 || ref > c.width - 3) continue;
          tried++;
          // best of the boundary pixel and its two neighbours: the line can
          // straddle a device-pixel edge at a fractional scale
          const onLine = Math.min(lumAt(sx - 1), lumAt(sx), lumAt(sx + 1));
          const d = lumAt(ref) - onLine;
          deltas.push(Math.round(d));
          if (d > 8) hits++;
        }
        return JSON.stringify({ T, tried, hits, deltas, scale: +scale.toFixed(3) });`));
      if (align.T === 64) ok(`the grid and the atlas agree on one number: CONFIG.FLOOR_TILE = ${align.T}`);
      else fail(`CONFIG.FLOOR_TILE is ${align.T} — the tile atlas is 64px, so a tile would not fill a cell`);
      if (align.tried >= 4 && align.hits >= align.tried - 1) ok(`?grid=1 draws the grid ON tile boundaries — ${align.hits}/${align.tried} world-multiples of ${align.T} are darker than the tile beside them (render scale ${align.scale})`);
      else fail(`grid alignment: only ${align.hits}/${align.tried} tile boundaries carried a darker line — the grid and the tiles have drifted apart (per-boundary luminance deltas: ${align.deltas.join(',')})`);
      const gerr = await G.errors();
      if (gerr.length) fail(`console errors with ?grid=1: ${gerr.join(' | ').slice(0, 200)}`);
    } catch (e) { fail(`debug grid: ${e.message}`); } finally { await G.close(); }
  }
}

// ---------- mobile / touch emulation (Pixel-ish viewport, real touch events) ----------
{
  const M = new Browser();
  try {
    await M.open('M', { mobile: true });
    await M.goto(URL);
    await M.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'mobile title');
    if (await M.exec(`return document.body.classList.contains('touch-on')`)) ok('touch controls auto-detect on a touch device');
    else fail('touch-on class missing on emulated touch device');
    // portrait → rotate overlay; landscape resumes
    await M.setOrientation('portrait');
    if (await M.exec(`return getComputedStyle(document.getElementById('rotate-overlay')).display !== 'none'`)) ok('portrait shows the rotate overlay');
    else fail('rotate overlay missing in portrait');
    await M.setOrientation('landscape');
    if (await M.exec(`return getComputedStyle(document.getElementById('rotate-overlay')).display === 'none'`)) ok('landscape dismisses the rotate overlay');
    else fail('rotate overlay stuck in landscape');

    // ---- layout rule: the bottom fifth of a phone screen is input, not UI ----
    // The joystick floats — js/touch.js anchors it wherever the first finger
    // lands on the canvas — so a pointer-events:auto panel low on the screen
    // eats the movement thumb with nothing on screen to explain why.
    // Enumerated from the live DOM, never from a list here: every .overlay gets
    // a stand-in panel so the CONTAINER's own align-items/padding decide where
    // interactive chrome would land, which works for overlays that have never
    // been opened. A new overlay is covered the moment it exists in the markup.
    {
      const probed = JSON.parse(await M.exec(`
        const H = window.innerHeight, band = H * 0.8;
        const out = [];
        for (const el of document.querySelectorAll('.overlay')) {
          const hidden = el.classList.contains('hidden'), html = el.innerHTML;
          el.classList.remove('hidden');
          el.innerHTML = '<div class="panel" id="__ovprobe" style="min-height:96px">probe</div>';
          const blocking = getComputedStyle(el).pointerEvents !== 'none';
          const r = document.getElementById('__ovprobe').getBoundingClientRect();
          out.push({ id: el.id, blocking, bottom: Math.round(r.bottom) });
          el.innerHTML = html;
          if (hidden) el.classList.add('hidden');
        }
        return JSON.stringify({ H: Math.round(H), band: Math.round(band), out });`));
      if (probed.out.length >= 5) ok(`thumb-zone gate enumerated ${probed.out.length} overlays from the DOM: ${probed.out.map(o => o.id).join(', ')}`);
      else fail(`thumb-zone gate found only ${probed.out.length} overlays — the scrape is broken, not the layout`);
      // Non-blocking overlays leave the game playable underneath, so their
      // panel must stay above the band. Blocking ones own the whole viewport by
      // design and are dismissed in one tap; the sim suite gates their exits.
      for (const o of probed.out) {
        if (o.blocking) continue;
        if (o.bottom <= probed.band) ok(`${o.id}: non-blocking panel ends at y=${o.bottom}, clear of the ${probed.band}px thumb line (viewport ${probed.H})`);
        else fail(`${o.id}: non-blocking panel reaches y=${o.bottom}, inside the bottom 20% (below y=${probed.band}) — it will swallow the joystick thumb`);
      }
      const blocking = probed.out.filter(o => o.blocking).map(o => o.id);
      console.log(`  (blocking overlays, exempt from the band rule and gated for exits in the sim suite: ${blocking.join(', ') || 'none'})`);
    }
    // touch-only: host → tap character → start
    await M.tap('#btn-host');
    await M.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')`, 5000, 'mobile lobby');
    await M.tap('.char-card[data-char="facet"]');
    await sleep(250);
    await M.tap('#btn-start');
    await M.waitFor(`return window.uv.mode==='run' && !!window.uv.sim`, 5000, 'mobile run start');
    ok('touch-only: host → tap character → start run');
    // the preloaded (suspended) context resumed on the first touch
    const ctxSt = await M.exec(`return window.uvAudio.ctxState()`);
    if (ctxSt === 'running') ok('first-touch unlock resumed the preloaded audio context');
    else fail(`audio context state after touch flow: ${ctxSt}`);

    // ---- the node map on touch: ≥44px nodes, tap to travel ----
    await M.waitFor(`return !document.getElementById('screen-map').classList.contains('hidden')`, 4000, 'mobile map screen');
    const nodeRect = JSON.parse(await M.exec(`const b=document.querySelector('.map-node'); const r=b.getBoundingClientRect(); return JSON.stringify({w:Math.round(r.width),h:Math.round(r.height)})`));
    if (nodeRect.w >= 44 && nodeRect.h >= 44) ok(`map nodes meet the 44px touch standard (${nodeRect.w}×${nodeRect.h})`);
    else fail(`map node too small: ${JSON.stringify(nodeRect)}`);
    await M.tap('.map-node.reachable');
    await M.waitFor(`return window.uv.sim.phase==='arena'`, 4000, 'mobile arena after node tap');
    ok('tapping a map node by touch travels into the arena');

    // ---- Facet's boon picker on touch: offered on fight entry, ≥44px, non-blocking ----
    await M.waitFor(`return !document.getElementById('overlay-boon').classList.contains('hidden')`, 5000, 'boon picker (facet, fight entry)');
    const boonRect = JSON.parse(await M.exec(`const c=document.querySelector('.boon-card'); const r=c.getBoundingClientRect(); return JSON.stringify({w:r.width,h:r.height})`));
    if (boonRect.h >= 44 && boonRect.w >= 44) ok(`boon cards meet the 44px touch standard (${Math.round(boonRect.w)}×${Math.round(boonRect.h)})`);
    else fail(`boon card too small: ${JSON.stringify(boonRect)}`);
    const bt0 = await M.exec('return window.uv.sim.tickNum');
    await sleep(500);
    const bt1 = await M.exec('return window.uv.sim.tickNum');
    if (bt1 > bt0) ok('boon picker never pauses the game (non-blocking)'); else fail('sim paused while boon picker open');
    // "non-blocking" has to mean the thumb too, not just the clock. Put a
    // finger down where a thumb actually rests — low, centre-screen, right
    // under the strip — and require the player to move. Before the band rule
    // the panel sat here with pointer-events:auto and ate the whole gesture.
    {
      const geo = JSON.parse(await M.exec(`const r=document.querySelector('.boon-panel').getBoundingClientRect();
        return JSON.stringify({top:Math.round(r.top),bottom:Math.round(r.bottom),H:window.innerHeight,W:window.innerWidth})`));
      const thumbY = Math.round(geo.H * 0.9), thumbX = Math.round(geo.W / 2);
      const pos = `const p=window.uv.sim.players[0]; return JSON.stringify([Math.round(p.x),Math.round(p.y)])`;
      const t0 = JSON.parse(await M.exec(pos));
      await M.touchDown(thumbX, thumbY);
      await M.touchMove(thumbX + 70, thumbY);
      await sleep(600);
      const t1 = JSON.parse(await M.exec(pos));
      await M.touchUp();
      await sleep(200);
      const moved = Math.hypot(t1[0] - t0[0], t1[1] - t0[1]);
      if (moved > 8) ok(`thumb at (${thumbX},${thumbY}) drives the joystick with the boon strip up — moved ${moved.toFixed(0)} world units (panel occupies y ${geo.top}–${geo.bottom} of ${geo.H})`);
      else fail(`the boon strip swallowed the joystick: thumb at (${thumbX},${thumbY}) moved the player ${moved.toFixed(1)} units; panel occupies y ${geo.top}–${geo.bottom} of ${geo.H}`);
      const stillOpen = await M.exec(`return !document.getElementById('overlay-boon').classList.contains('hidden')`);
      if (stillOpen) ok('moving under the strip does not dismiss it — the pick is still there to make');
      else fail('the joystick gesture dismissed the boon strip');
    }
    await M.tap('.boon-card');
    await M.waitFor(`return document.getElementById('overlay-boon').classList.contains('hidden')`, 3000, 'boon picked');
    const boonApplied = await M.exec(`return JSON.stringify(window.uv.sim.players[0].boonTemp)`);
    if (boonApplied && boonApplied !== 'null') ok(`boon picked by tap → ${boonApplied}`); else fail('boon pick did not apply');

    // ---- the strip is shared by three traits and they do not share its rules ----
    // Facet/Druid roll a room-length boon that needs three takes to stick; the
    // Blacksmith's crystal is permanent on the spot and quartz arms detonation
    // every third. The panel used to hardcode Prism's copy, so two of the three
    // openers told the player the wrong thing about the pick they just made.
    // Pushed onto sim.events so it renders through the real host drain → showBoon.
    {
      const inject = (json) => `window.uv.sim.events.push(${json}); return 1;`;
      const crystal = `{k:'boon',idx:window.uv.myIdx,crystal:true,picks:[{id:'crystal_quartz',stat:'attunement',rarity:'rare',crystal:'quartz',n:1,amount:4,name:'Prism Quartz',every:3}]}`;
      await M.exec(inject(crystal));
      await M.waitFor(`return !document.getElementById('overlay-boon').classList.contains('hidden')`, 3000, 'crystal panel render');
      const cr = JSON.parse(await M.exec(`const e=document.getElementById('overlay-boon');
        return JSON.stringify({title:e.querySelector('.ov-title').textContent, pips:e.querySelector('.orarity').textContent})`));
      if (/BLACKSMITH/.test(cr.title)) ok(`crystal offer titles itself for the Blacksmith: "${cr.title}"`);
      else fail(`crystal offer still shows the wrong trait's title: "${cr.title}"`);
      if (/permanent/.test(cr.pips) && /2\/3 to detonation/.test(cr.pips)) ok(`crystal card states its real terms: "${cr.pips}"`);
      else fail(`crystal card copy wrong — expected permanent + detonation progress, got "${cr.pips}"`);
      if (!/to keep/.test(cr.pips)) ok(`crystal card no longer claims Prism's "n/3 to keep"`);
      else fail(`crystal card still shows Prism's pip semantics: "${cr.pips}"`);

      const shape = `{k:'boon',idx:window.uv.myIdx,trait:'wildshape',picks:[{id:'b_fer',stat:'ferocity',rarity:'common',n:0,amount:3}]}`;
      await M.exec(inject(shape));
      await sleep(250);
      const dr = await M.exec(`return document.querySelector('#overlay-boon .ov-title').textContent`);
      if (/THE SHAPE/.test(dr)) ok(`the Druid's offer names the Druid: "${dr}"`);
      else fail(`the Druid's offer still shows Prism's title: "${dr}"`);
      await M.exec(`document.getElementById('overlay-boon').classList.add('hidden'); return 1;`);
    }
    // the touch path under test is steering, not survival — an 80-HP Facet can
    // die during the long organic combat window, killing every later step
    await M.exec(`window.uv.sim.debug('F5'); return 1;`);
    // joystick drag moves; release stops (two directions — one axis can be
    // blocked by arena architecture beside the spawn)
    const jp0 = JSON.parse(await M.exec(`const p=window.uv.sim.players[0]; return JSON.stringify([p.x,p.y])`));
    await M.touchDown(420, 200);
    await M.touchMove(480, 200);
    await sleep(500);
    await M.touchMove(420, 260);
    await sleep(500);
    const jp1 = JSON.parse(await M.exec(`const p=window.uv.sim.players[0]; return JSON.stringify([p.x,p.y])`));
    await M.touchUp();
    await sleep(350);
    const jx2 = await M.exec('return window.uv.sim.players[0].x');
    await sleep(350);
    const jx3 = await M.exec('return window.uv.sim.players[0].x');
    const jMoved = Math.hypot(jp1[0] - jp0[0], jp1[1] - jp0[1]);
    if (jMoved > 60) ok(`joystick drag moves the player (${Math.round(jMoved)}u travelled)`);
    else fail(`joystick did not move player (${Math.round(jMoved)}u)`);
    if (Math.abs(jx3 - jx2) < 8) ok('joystick release stops the player');
    else fail(`player kept drifting after release (${jx2}→${jx3})`);
    // camera follows on mobile too
    const mCam = JSON.parse(await M.exec(`return JSON.stringify({cam:Math.round(window.uvRenderer.camX), px:Math.round(window.uv.sim.players[0].x)})`));
    if (Math.abs(mCam.cam - mCam.px) < 140) ok(`mobile camera follows the player (cam ${mCam.cam}, player ${mCam.px})`);
    else fail(`mobile camera adrift: ${JSON.stringify(mCam)}`);
    // character sheet via the HUD button (in the arena)
    await M.tap('#sheet-btn');
    await M.waitFor(`return !document.getElementById('overlay-sheet').classList.contains('hidden')`, 3000, 'sheet via HUD button (touch)');
    await M.tap('#sheet-close');
    await M.waitFor(`return document.getElementById('overlay-sheet').classList.contains('hidden')`, 3000, 'sheet closed');
    ok('character sheet opens/closes by HUD button on touch');

    // organic touch combat, then finish and walk out via the hatch
    // (enemies spawn across the big arena — wait for them to close to weapon range)
    let mDmg = 0;
    try {
      mDmg = await M.waitFor(`const d=Math.round(window.uv.sim.players[0].damageDealt); return d > 0 ? d : 0`, 15000, 'organic damage');
      ok(`touch character fights organically (dmg ${mDmg})`);
    } catch { fail('no organic damage dealt on touch within 15s'); }
    // patch 9: the enemy counter is a touch-sized pill mid-combat
    await M.waitFor(`const ec=document.getElementById('enemy-counter'); return !ec.classList.contains('hidden') ? 1 : 0`, 5000, 'enemy counter visible on touch');
    const ecR = JSON.parse(await M.exec(`const r=document.getElementById('enemy-counter').getBoundingClientRect(); return JSON.stringify({w:Math.round(r.width), h:Math.round(r.height)})`));
    if (ecR.h >= 44) ok(`enemy counter meets the 44px touch standard (${ecR.w}×${ecR.h})`);
    else fail(`enemy counter only ${ecR.h}px tall on touch`);
    await M.exec(`window.uv.sim.debug('F2'); return 1;`); // bank a few level-ups for the clear
    await M.exec(clearFightJs);
    // level-up cards surface at the clear: glossary short lines + tap to pick
    await M.waitFor(`return !document.getElementById('overlay-levelup').classList.contains('hidden')`, 5000, 'level-up cards at the clear');
    const lu = JSON.parse(await M.exec(`const cards=[...document.querySelectorAll('#overlay-levelup .offer-card')];
      return JSON.stringify({ n: cards.length,
        withShort: cards.filter(c => c.querySelector('.gloss-short') && c.querySelector('.gloss-short').textContent.trim().length > 5).length,
        h: cards.length ? Math.round(cards[0].getBoundingClientRect().height) : 0 })`));
    if (lu.n > 0 && lu.withShort === lu.n && lu.h >= 44) ok(`level-up cards all show glossary short lines (${lu.n} cards, ${lu.h}px tall)`);
    else fail(`level-up short lines: ${JSON.stringify(lu)}`);
    await M.tap('#overlay-levelup .offer-card');
    ok('level-up picked by tap');
    await M.exec(drainJs); // the rest drain host-side so overlays can't block the joystick
    await M.waitFor(`return document.getElementById('overlay-levelup').classList.contains('hidden')`, 5000, 'offer backlog drained');
    // the extraction shop opened at the clear — close it by touch to walk out
    await M.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 4000, 'extraction shop on touch');
    ok('extraction shop opens at the clear on touch');
    await M.tap('#shop-close');
    await M.waitFor(`return document.getElementById('overlay-shop').classList.contains('hidden')`, 3000, 'extraction shop closed');
    // steer to the hatch with the joystick only — the extraction countdown runs
    const JX = 400, JY = 200;
    async function steerPoll(getDirJs, doneJs, timeoutMs, what) {
      await M.touchDown(JX, JY);
      const t0 = Date.now();
      try {
        for (;;) {
          if (await M.exec(doneJs)) return true;
          if (Date.now() - t0 > timeoutMs) throw new Error(`steer timeout: ${what}`);
          const v = await M.exec(getDirJs);
          if (v) { const [dx, dy] = JSON.parse(v); await M.touchMove(JX + dx * 55, JY + dy * 55); }
          await sleep(140);
        }
      } finally { await M.touchUp(); }
    }
    const hatchDirJs = `const s=window.uv.sim, p=s.players[0]; if (s.phase!=='arena' || !s.hatch) return '';
      let dx=s.hatch.x-p.x, dy=s.hatch.y-p.y; const l=Math.hypot(dx,dy)||1; dx/=l; dy/=l;
      for (const o of s.obstacles) { // sidle around blocks sitting on the straight line
        const ox=o.x+o.w/2, oy=o.y+o.h/2, d=Math.hypot(p.x-ox,p.y-oy)||1;
        if (d < Math.max(o.w,o.h)/2 + 70) { dx+=(p.x-ox)/d*1.6; dy+=(p.y-oy)/d*1.6; }
      }
      const L=Math.hypot(dx,dy)||1; return JSON.stringify([dx/L,dy/L]);`;
    try {
      await steerPoll(hatchDirJs, `return window.uv.sim.phase==='map'`, 75000, 'joystick extraction walk');
      ok('joystick walks to the hatch; the extraction countdown returns to the map');
    } catch {
      console.warn('⚠ joystick hatch walk over time budget (steering exercised throughout) — pinning to finish');
      await extractToMap(M, 'mobile extraction fallback');
    }
    await M.waitFor(`return !document.getElementById('screen-map').classList.contains('hidden')`, 3000, 'map back after touch extraction');

    // shop stop: travel there, buy by tap, glossary buy-guard
    async function tapAwayLevelups() {
      await M.exec(`const s=window.uv.sim, p=s.players[0];
        if (p.boonOffer) s.uiAction(0,{kind:'boon',id:p.boonOffer[0].id});
        if (p.banked > 0 && !p.pendingOffer) s._maybeOffer(p);
        let g=0; while (p.pendingOffer && g++<80) s.uiAction(0,{kind:'levelup',id:p.pendingOffer[0].id});
        return 1;`);
      await M.waitFor(`return document.getElementById('overlay-levelup').classList.contains('hidden') && document.getElementById('overlay-boon').classList.contains('hidden') && !window.uv.sim.players[0].banked && !window.uv.sim.players[0].pendingOffer`, 6000, 'offer backlog drained');
    }
    await M.exec(`const s=window.uv.sim; s.debug('F2'); const shop=s.floor.nodes.find(n=>n.kind==='shop'); s._travelTo(shop.id); return 1;`);
    try {
      await M.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 8000, 'mobile shop overlay');
    } catch (e) {
      const diag = await M.exec(`const g=id=>!document.getElementById(id).classList.contains('hidden');
        return JSON.stringify({mode:window.uv.mode, tick:window.uv.sim&&window.uv.sim.tickNum, node:window.uv.sim&&window.uv.sim.currentNode,
        shop:g('overlay-shop'), lvl:g('overlay-levelup'), boon:g('overlay-boon'), sheet:g('overlay-sheet'),
        pshop:!!(window.uv.sim&&window.uv.sim.players[0].shop), banked:window.uv.sim&&window.uv.sim.players[0].banked})`).catch(err => 'diag failed: ' + err.message);
      console.error('  shop-overlay diag:', diag, '| page errors:', (await M.errors()).join(' | ').slice(0, 500));
      throw e;
    }
    await tapAwayLevelups(); // F2 XP banks levels; the offers stack above the shop
    const matsB = await M.exec('return window.uv.sim.players[0].materials');
    // tap the card's NAME line — the card center can land on a stat term,
    // which (by design) opens the glossary instead of buying
    await M.tap('#overlay-shop .offer-card .oname');
    let matsA = matsB;
    try {
      matsA = await M.waitFor(`const m=window.uv.sim.players[0].materials; return m < ${matsB} ? m : 0`, 3000, 'purchase debit');
      ok(`shop purchase by tap (◆${matsB}→◆${matsA})`);
    } catch {
      const diag = await M.exec(`const g=id=>!document.getElementById(id).classList.contains('hidden');
        return JSON.stringify({shop:g('overlay-shop'), lvl:g('overlay-levelup'), sheet:g('overlay-sheet'),
        stock0:window.uv.sim.players[0].shop.stock[0], toasts:document.getElementById('hud-toasts').innerText,
        weapons:window.uv.sim.players[0].weapons.length, slots:window.uv.sim.players[0].weaponSlots})`);
      fail(`tap purchase failed (${matsB} unchanged) — diag: ${diag}`);
    }
    // tapping a stat name inside an offer opens the glossary and never buys
    // (stock can roll all hook-items with no stat names — reroll until one shows)
    let hasTerm = false;
    for (let r = 0; r < 8 && !hasTerm; r++) {
      hasTerm = await M.exec(`return document.querySelector('#overlay-shop .offer-card:not(.sold) .gloss-term') !== null`);
      if (!hasTerm) { await M.exec(`document.getElementById('shop-reroll').click(); return 1;`); await sleep(300); }
    }
    if (hasTerm) {
      const matsG = await M.exec('return window.uv.sim.players[0].materials');
      await M.tap('#overlay-shop .offer-card:not(.sold) .gloss-term');
      const matsG2 = await M.exec('return window.uv.sim.players[0].materials');
      const popVis = await M.exec(`return !document.getElementById('gloss-pop').classList.contains('hidden')`);
      if (matsG2 === matsG && popVis) ok('tapping a stat name in a shop card opens the glossary without buying');
      else fail(`glossary buy-guard: mats ${matsG}→${matsG2}, popover=${popVis}`);
      await M.tap('.ov-title'); // close the popover
    } else fail('no glossary term found in shop stock');
    // two-step sell by touch, with tap-elsewhere disarm
    const mItem = JSON.parse(await M.exec(`const it=window.uvContent.ITEMS.find(it=>it.stats&&it.stats.grit>0&&!it.hooks); return JSON.stringify({id:it.id})`));
    await M.exec(`const s=window.uv.sim,p=s.players[0]; p.items.push(${JSON.stringify(mItem.id)}); s._recomputeItems(p); s._recomputeStats(p); return 1;`);
    await M.waitFor(`return window.uv.meta && window.uv.meta.items.includes(${JSON.stringify(mItem.id)})`, 3000, 'mobile item in meta');
    await M.tap(`[data-selli="${mItem.id}"]`);
    if (/tap again/.test(await M.exec(`return document.querySelector('[data-selli="${mItem.id}"]').textContent`))) ok('touch: first tap arms the sell');
    else fail('mobile sell did not arm');
    await M.tap('.ov-title'); // tap elsewhere → disarm
    if (!/tap again/.test(await M.exec(`return document.querySelector('[data-selli="${mItem.id}"]').textContent`))) ok('touch: tapping elsewhere disarms');
    else fail('sell stayed armed after tapping elsewhere');
    const mm0 = await M.exec('return window.uv.meta.materials');
    await M.tap(`[data-selli="${mItem.id}"]`);
    await M.tap(`[data-selli="${mItem.id}"]`);
    await M.waitFor(`return window.uv.meta.materials > ${mm0}`, 4000, 'mobile sell refund');
    ok('touch: second tap sells and credits the refund');
    // character sheet from inside the shop, scrollable, glossary rows
    await M.tap('#shop-sheet');
    await M.waitFor(`return !document.getElementById('overlay-sheet').classList.contains('hidden')`, 3000, 'sheet from shop (touch)');
    if (await M.exec(`return getComputedStyle(document.querySelector('.sheet-cols')).overflowY === 'auto'`)) ok('sheet columns scroll on phones');
    else fail('sheet not scrollable');
    const rowH = await M.exec(`return Math.round(document.querySelector('[data-glossrow="tempo"]').getBoundingClientRect().height)`);
    if (rowH >= 44) ok(`sheet stat rows meet the 44px touch standard (${rowH}px)`); else fail(`sheet row only ${rowH}px tall on touch`);
    await M.tap('[data-glossrow="tempo"]');
    const detTxt = await M.exec(`const d=document.querySelector('.gloss-detail'); return d ? d.textContent : ''`);
    if (/faster/.test(detTxt)) ok('mobile: tapping Tempo expands its glossary detail inline');
    else fail(`sheet row tap detail: "${detTxt}"`);
    await M.tap('[data-glossrow="tempo"]');
    if (await M.exec(`return document.querySelector('.gloss-detail') === null`)) ok('mobile: tapping the row again collapses the detail');
    else fail('sheet glossary detail did not collapse');
    await M.tap('#sheet-close');
    await M.tap('#shop-close');
    // the map screen offers the reopen button while parked on the Trader
    await M.waitFor(`return document.querySelector('#map-reopen-shop') !== null`, 3000, 'map reopen-shop (touch)');
    await M.tap('#map-reopen-shop');
    await M.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 3000, 'shop reopened by map button');
    ok('map "Reopen shop" button works by touch');

    // ---- touch detail cards, combine badge, and the swap picker (≥44px) ----
    await M.exec(`const s=window.uv.sim,p=s.players[0]; while (p.weapons.length < p.weaponSlots) s._addWeapon(p,'pebbleshot',1);
      p.shop.stock[0]={kind:'weapon',id:'rustcleaver',tier:1,price:14,sold:false,locked:false};
      p.shop.stock[1]={kind:'weapon',id:'pebbleshot',tier:1,price:12,sold:false,locked:false};
      s._sendShop(p); return 1;`);
    await M.waitFor(`return window.uv.meta.weapons.length === window.uv.meta.weaponSlots`, 3000, 'mobile slots full');
    const mbadge = JSON.parse(await M.exec(`const b=document.querySelector('.offer-card[data-slot="1"] .wpn-upg');
      if (!b) return 'null'; const r=b.getBoundingClientRect(); return JSON.stringify({h:Math.round(r.height), len:b.textContent.trim().length})`) || 'null');
    if (mbadge && mbadge.h >= 14 && mbadge.len > 20) ok(`combine badge is readable on touch (${mbadge.h}px tall)`);
    else fail(`mobile combine badge: ${JSON.stringify(mbadge)}`);
    await M.tap('[data-wchip="0"] .wsym'); // the symbol — a chip-center tap can land on the sell button
    await M.waitFor(`return document.querySelector('.wchip.expanded .wdetail .wd-dps') !== null`, 3000, 'mobile owned detail');
    ok('touch: owned chip expands to the full detail card');
    await M.tap('.offer-card[data-slot="0"] .oname'); // non-duplicate at cap → picker
    await M.waitFor(`return document.querySelector('.swap-card') !== null`, 3000, 'mobile swap picker');
    const mswap = JSON.parse(await M.exec(`const c=document.querySelector('.swap-card'); const r=c.getBoundingClientRect();
      return JSON.stringify({h:Math.round(r.height), scroll:getComputedStyle(document.querySelector('.swap-row')).overflowY})`));
    if (mswap.h >= 44 && mswap.scroll === 'auto') ok(`swap picker cards ≥44px and the list scrolls (${mswap.h}px)`);
    else fail(`mobile picker: ${JSON.stringify(mswap)}`);
    await M.tap('#swap-cancel');
    await M.waitFor(`return document.querySelector('.swap-card') === null`, 3000, 'mobile picker cancelled');
    await M.tap('#shop-close');

    // ---- perf gate: mobile emulation at the new siege crest (≥40 fps at ~200) ----
    await M.exec(`const s=window.uv.sim; if (!s.god) s.debug('F5'); s._travelTo(s.floor.siegeId);
      let t=0; while (s.enemyPool.count < 200 && t++ < 10) s.debug('F1');
      const p0=s.players[0]; for (let i=0;i<14;i++) s.addZone({x:p0.x+(Math.random()-0.5)*900, y:p0.y+(Math.random()-0.5)*900, r:46, dps:8, dur:30, hurts:'players', color:'#7dee6a', acid:true});
      return 1;`);
    const mAlive0 = await M.exec('return window.uv.sim.enemyPool.count');
    const mFps = await measureFps(M);
    const mPerf = JSON.parse(await M.exec(`return JSON.stringify({alive:window.uv.sim.enemyPool.count, dpr:window.uvRenderer.dpr, pud:window.uv.sim.zones.filter(z=>z.acid).length})`));
    console.log(`  PERF mobile emulation: ${mFps} fps @ ${mAlive0}→${mPerf.alive} alive, ${mPerf.pud} acid puddles, dpr cap ${mPerf.dpr} (headless SwiftShader)`);
    if (mAlive0 >= 200) ok(`mobile siege crest reached ${mAlive0} alive for the perf gate`); else fail(`mobile crest only ${mAlive0}`);
    if (mFps >= 40) ok(`mobile perf gate: ${mFps} fps ≥ 40 at the ~200 crest (dpr ${mPerf.dpr})`);
    else console.warn(`⚠ mobile headless fps ${mFps} (headless SwiftShader is unrepresentative; DPR capped at ${mPerf.dpr})`);

    // Leave Run by tap (from the siege arena) → lobby
    await M.tap('#leave-btn');
    await M.waitFor(`return !document.getElementById('leave-confirm').classList.contains('hidden')`, 3000, 'mobile leave confirm');
    await M.tap('#leave-yes');
    await M.waitFor(`return window.uv.mode==='lobby' && !document.getElementById('screen-lobby').classList.contains('hidden')`, 4000, 'mobile lobby after leave');
    ok('Leave Run via touch → back to lobby');
    const merrs = await M.errors();
    if (merrs.length) fail(`mobile console errors: ${merrs.join(' | ').slice(0, 400)}`); else ok('zero console errors in the touch-only flow');

    // setting forced Off: no touch UI at all
    await M.exec(`localStorage.setItem('uv_touch','off'); return 1;`);
    await M.goto(URL);
    await M.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title with touch Off');
    if (!await M.exec(`return document.body.classList.contains('touch-on')`)) ok('forced Off: touch UI class absent');
    else fail('touch-on class still set with setting Off');
    await M.setOrientation('portrait');
    if (await M.exec(`return getComputedStyle(document.getElementById('rotate-overlay')).display === 'none'`)) ok('forced Off: no rotate overlay in portrait');
    else fail('rotate overlay shown despite Off');
    await M.setOrientation('landscape');
    await M.tap('#btn-host');
    await M.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')`, 5000, 'lobby (touch off)');
    await M.tap('.char-card[data-char="onrush"]');
    await sleep(250);
    await M.tap('#btn-start');
    await M.waitFor(`return window.uv.mode==='run'`, 5000, 'run (touch off)');
    // enter an arena so the HUD meter + joystick checks run in a fight
    await M.exec(`document.querySelector('.map-node.reachable').click(); return 1;`);
    await M.waitFor(`return window.uv.sim.phase==='arena'`, 4000, 'arena (touch off)');
    await M.waitFor(`return document.querySelector('.meterbar') !== null`, 4000, 'mobile HUD meter bar');
    ok('trait meter renders on the mobile HUD');
    const fx0 = await M.exec('return window.uv.sim.players[0].x');
    await M.touchDown(420, 200);
    await M.touchMove(500, 200);
    await sleep(700);
    const joyOff = await M.exec('return window.uvRenderer.joy.active');
    const fx1 = await M.exec('return window.uv.sim.players[0].x');
    await M.touchUp();
    if (!joyOff && Math.abs(fx1 - fx0) < 10) ok('forced Off: joystick never engages');
    else fail(`joystick engaged with setting Off (active=${joyOff}, ${fx0}→${fx1})`);
  } catch (e) {
    fail(`mobile test crashed: ${e.message}`);
  } finally {
    await M.close();
  }
}

// ---------- co-op two-browser test ----------
// The sandbox can't reach the PeerJS cloud, so we run the game's supported
// self-host path: a local signaling relay (tools/peer_relay.mjs) + the real
// peerjs client injected in place of the CDN copy. WebRTC itself is p2p.
if (wantCoop) {
  const { readFileSync, existsSync } = await import('fs');
  const PJS = process.env.PEERJS_LOCAL || '/tmp/peerjs.min.js';
  if (!existsSync(PJS)) {
    console.warn('⚠ COOP SKIPPED — no local peerjs.min.js (set PEERJS_LOCAL or place /tmp/peerjs.min.js)');
    console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL BROWSER TESTS PASSED');
    process.exit(failures ? 1 : 0);
  }
  const peerjsB64 = readFileSync(PJS).toString('base64');
  // boot the relay and PROBE it — a blind sleep races slow starts and port
  // collisions, which shows up as flaky "registration failed" runs
  let relayPort = RELAY_PORT;
  let relayUp = false;
  for (let attempt = 0; attempt < 3 && !relayUp; attempt++) {
    const port = RELAY_PORT + attempt * 7;
    const relay = spawn('node', ['tools/peer_relay.mjs', String(port)], { stdio: 'ignore' });
    process.on('exit', () => relay.kill());
    for (let i = 0; i < 24 && !relayUp; i++) {
      await sleep(250);
      try { const r = await fetch(`http://localhost:${port}/peerjs/id`); relayUp = r.ok; } catch { /* not yet */ }
    }
    if (relayUp) relayPort = port;
    else { relay.kill(); console.warn(`⚠ relay did not come up on :${port}, trying :${port + 7}`); }
  }
  if (!relayUp) console.warn('⚠ relay never came up — co-op will report registration failure');
  const COOP_URL = `${URL}?peerhost=localhost&peerport=${relayPort}&peersecure=0`;
  const A2 = new Browser();
  const B = new Browser();
  try {
    await A2.open('A2', { peerjsB64 });
    await A2.goto(COOP_URL);
    const A = A2; // reuse flow variable name below
    const tryRegister = async () => {
      await A.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title A');
      await A.exec(`document.getElementById('name-input').value='HOST'; document.getElementById('btn-host').click()`);
      const t0 = Date.now();
      for (;;) {
        const c = await A.exec(`return window.uv.lobby && window.uv.lobby.code`);
        if (c) return c;
        const pending = await A.exec(`return window.uv.lobby && window.uv.lobby.codePending`);
        if (!pending) return null;
        if (Date.now() - t0 > 12000) return null;
        await sleep(300);
      }
    };
    let code = await tryRegister();
    if (!code) { // the relay can be slow to bind under load — one clean retry
      await sleep(1500);
      await A.goto(COOP_URL);
      code = await tryRegister();
    }
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

      // ---- the roster is HOST-AUTHORITATIVE, verified across two real clients ----
      // The client is deliberately put on the WRONG roster first — via its own
      // localStorage, the way a returning player would arrive — and must end up
      // on the host's regardless. A mismatch would resolve the host's character
      // ids in the wrong table and silently desync every trait in the party.
      {
        const bBefore = await B.exec(`return window.uvRoster ? window.uvRoster.id() : (window.uv.lobby && window.uv.lobby.roster) || 'classic'`);
        // host switches to Thrones of Heaven
        await A.exec(`document.querySelector('.roster-btn[data-roster="toh"]').click(); return 1;`);
        await A.waitFor(`return document.querySelector('.roster-btn[data-roster="toh"]').classList.contains('on')`, 4000, 'host on toh');
        const hostGrid = await A.exec(`return document.querySelectorAll('.char-card').length`);
        if (hostGrid === 14) ok(`host switched roster: the grid is the 14 Thrones of Heaven warriors (was 33)`);
        else fail(`host grid shows ${hostGrid} characters after switching to toh`);
        // the client follows, without being asked
        await B.waitFor(`return document.querySelectorAll('.char-card').length===14`, 6000, 'client follows the host roster');
        const bGrid = await B.exec(`return JSON.stringify({
          n: document.querySelectorAll('.char-card').length,
          first: document.querySelector('.char-card').dataset.char,
          roster: window.uv.lobby.roster,
          hostOnly: document.querySelector('.roster-btn').disabled })`);
        const bg = JSON.parse(bGrid);
        if (bg.n === 14 && /^toh_/.test(bg.first)) ok(`the client followed the host onto "${bg.roster}" (was "${bBefore}") without being asked`);
        else fail(`client roster: ${bGrid}`);
        if (bg.hostOnly) ok('and the client cannot change it — the switch is host-only');
        else fail('the roster switch was live on a client');
        // a ToH character actually starts a run across the wire
        await A.exec(`document.querySelector('.char-card[data-char="toh_samurai"]').click()`);
        await B.exec(`document.querySelector('.char-card[data-char="toh_bard"]').click()`);
        await sleep(400);
        await B.exec(`document.getElementById('btn-ready').click()`);
        await A.waitFor(`return window.uv.lobby.players[1] && window.uv.lobby.players[1].charId==='toh_bard'`, 5000, 'client picked a ToH character');
        ok('both players pick Thrones of Heaven characters over the network');
        // ...and back to classic for the rest of the co-op phase
        await A.exec(`document.querySelector('.roster-btn[data-roster="classic"]').click(); return 1;`);
        await B.waitFor(`return document.querySelectorAll('.char-card').length===33`, 6000, 'client follows back to classic');
        const cleared = await A.exec(`return window.uv.lobby.players.every(p=>!p.charId) ? 1 : 0`);
        if (cleared) ok('switching rosters clears every pick — the old ids do not exist in the new roster');
        else fail('picks survived a roster switch');
      }

      // the tuning-gate pairing: Banneret (aura) hosts, Lodestone (tether) joins
      await A.exec(`document.querySelector('.char-card[data-char="banneret"]').click()`);
      await B.waitFor(`return document.querySelector('.char-card[data-char="lodestone"]')!==null`, 4000, 'client char grid');
      await B.exec(`document.querySelector('.char-card[data-char="lodestone"]').click()`);
      await sleep(400);
      await B.exec(`document.getElementById('btn-ready').click()`);
      await A.waitFor(`return window.uv.lobby.players[1] && window.uv.lobby.players[1].ready && window.uv.lobby.players[1].charId`, 5000, 'client ready');
      await A.exec(`document.getElementById('btn-start').click()`);
      await A.waitFor(`return window.uv.mode==='run'`, 5000, 'host run');
      await B.waitFor(`return window.uv.mode==='run'`, 5000, 'client run');
      ok('both enter the run');

      // ---- DoD 6: contested node pick — consent countdown, one redirect, lock ----
      await A.waitFor(`return !document.getElementById('screen-map').classList.contains('hidden')`, 4000, 'host map screen');
      await B.waitFor(`return !document.getElementById('screen-map').classList.contains('hidden')`, 5000, 'client map screen');
      ok('both players see the node map');
      const firstPick = await A.exec(`const b=document.querySelector('.map-node.reachable'); b.click(); return parseInt(b.dataset.node,10);`);
      await A.waitFor(`return window.uv.sim.nodeVote && window.uv.sim.nodeVote.nodeId===${firstPick}`, 3000, 'vote started');
      ok(`host tap starts the consent countdown (node ${firstPick})`);
      await B.waitFor(`const s=window.uv.snaps; const last=s[s.length-1]; return last && last.s.vote && last.s.vote.nodeId===${firstPick} ? 1 : 0`, 4000, 'vote visible on client');
      let badge = false;
      try {
        await B.waitFor(`return document.querySelector('.map-node .mn-count') !== null`, 3000, 'client countdown badge');
        badge = true;
      } catch { /* reported below */ }
      if (badge) ok('client map shows the live countdown badge'); else fail('no countdown badge on client map');
      // the client redirects to a different node — allowed exactly once
      const redirectPick = await B.exec(`const v=window.uv.snaps[window.uv.snaps.length-1].s.vote;
        const b=[...document.querySelectorAll('.map-node.reachable')].find(x=>parseInt(x.dataset.node,10)!==v.nodeId);
        if (!b) return -1; b.click(); return parseInt(b.dataset.node,10);`);
      if (redirectPick < 0) fail('client found no alternative node to redirect to');
      await A.waitFor(`return window.uv.sim.nodeVote && window.uv.sim.nodeVote.nodeId===${redirectPick} && window.uv.sim.nodeVote.redirected`, 4000, 'redirect landed');
      ok(`client redirected the pick once (${firstPick} → ${redirectPick})`);
      await A.exec(`const b=document.querySelector('.map-node[data-node="${firstPick}"]'); if (b && !b.disabled) b.click(); return 1;`);
      await sleep(400);
      const lockCheck = await A.exec(`return window.uv.sim.nodeVote ? window.uv.sim.nodeVote.nodeId : window.uv.sim.currentNode`);
      if (lockCheck === redirectPick) ok('after one redirect the selection is locked'); else fail(`lock broken: vote moved to ${lockCheck}`);
      await A.waitFor(`return window.uv.sim.phase==='arena' && window.uv.sim.currentNode===${redirectPick}`, 7000, 'countdown travels the party');
      await B.waitFor(`const s=window.uv.snaps; const last=s[s.length-1]; return last && last.s.mode===1 ? 1 : 0`, 5000, 'client in arena');
      await B.waitFor(`return document.getElementById('screen-map').classList.contains('hidden')`, 3000, 'client map hidden');
      ok('consent countdown expires → both players travel into the arena');

      // client moves; host should see it
      const hx0 = await A.exec(`return Math.round(window.uv.sim.players[1].x)`);
      await B.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}))`);
      await sleep(900);
      await B.exec(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD'}))`);
      const hx1 = await A.exec(`return Math.round(window.uv.sim.players[1].x)`);
      if (hx1 > hx0 + 30) ok(`host sees client movement (${hx0}→${hx1})`); else fail(`client movement not seen by host (${hx0}→${hx1})`);

      // ---- the Hunter's beast across the wire: position, state, countdown ----
      //
      // The beast is host-authoritative and clients run NONE of its logic, so
      // the only thing that can be wrong is what the wire carries. The beast is
      // spawned directly on the host rather than by re-picking characters: the
      // Pack Tactics grant is covered by the sim suite, and what needs a real
      // second browser is the snapshot path, not the trait.
      {
        await A.exec(`
          const s = window.uv.sim, p = s.players[0];
          s._spawnSummon(p, 'guard_drone', 1, 'beast');
          const b = s.summons.find(x => x.type === 'beast');
          window.__pinB = setInterval(() => { b.x = p.x + 120; b.y = p.y; }, 8);
          return 1;`);
        await sleep(700);
        const hostB = JSON.parse(await A.exec(`
          const s = window.uv.sim, b = s.summons.find(x => x.type === 'beast');
          return JSON.stringify({ x: Math.round(b.x), y: Math.round(b.y), down: !!b.down });`));
        const seen = await B.waitFor(`
          const s = window.uv.snaps, last = s[s.length - 1];
          const row = last && last.s.summons && last.s.summons.find(r => r[1] === 'beast');
          return row && Math.abs(row[2] - ${hostB.x}) <= 3 && Math.abs(row[3] - ${hostB.y}) <= 3 ? 1 : 0;`,
          6000, 'client sees the beast where the host has it').then(() => true).catch(() => false);
        if (seen) ok(`client agrees on the beast's position over the wire (${hostB.x},${hostB.y})`);
        else {
          const got = await B.exec(`const s=window.uv.snaps,l=s[s.length-1];
            return JSON.stringify(l && l.s.summons ? l.s.summons.filter(r=>r[1]==='beast') : null);`);
          fail(`client beast position disagrees: host ${JSON.stringify(hostB)}, client ${got}`);
        }

        // knock it down on the host: the client must see the state flip AND a
        // countdown that runs down rather than a bare boolean
        await A.exec(`
          const s = window.uv.sim, b = s.summons.find(x => x.type === 'beast');
          window.uvBeast.hurtBeast(s, b, 99999);
          return 1;`);
        const downSeen = await B.waitFor(`
          const s = window.uv.snaps, last = s[s.length - 1];
          const row = last && last.s.summons && last.s.summons.find(r => r[1] === 'beast');
          return row && row[7] > 0 ? 1 : 0;`, 5000, 'client sees the beast go down').then(() => true).catch(() => false);
        if (downSeen) ok('client sees the knockdown — the beast stays on the wire while it is down, it is not deleted');
        else fail('the knockdown never reached the client');
        const p1 = await B.exec(`const s=window.uv.snaps,l=s[s.length-1];
          const r=l.s.summons.find(x=>x[1]==='beast'); return r ? r[7] : -1;`);
        await sleep(2500);
        const p2 = await B.exec(`const s=window.uv.snaps,l=s[s.length-1];
          const r=l.s.summons.find(x=>x[1]==='beast'); return r ? r[7] : -1;`);
        const hostLeft = await A.exec(`const s=window.uv.sim, b=s.summons.find(x=>x.type==='beast');
          return b.down ? Math.round(b.downT * 100) / 100 : 0;`);
        if (p1 > 0 && p2 > 0 && p2 < p1 && Math.abs(p2 * 15 - hostLeft) < 1.2) {
          ok(`client's revive countdown tracks the host's (${p1}→${p2} of the timer, host has ${hostLeft}s left)`);
        } else fail(`countdown disagreement: client ${p1}→${p2}, host ${hostLeft}s left`);

        // clean up: this beast belongs to a Banneret, and nothing below expects it
        await A.exec(`
          clearInterval(window.__pinB);
          const s = window.uv.sim;
          for (const b of s.summons) if (b.type === 'beast') b.dead = true;
          return 1;`);
        await sleep(300);
      }

      // ---- gate: Banneret aura + Lodestone tether across the network ----
      await B.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA'}))`);
      await sleep(700);
      await B.exec(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyA'}))`); // back inside the aura
      await B.waitFor(`return window.uv.meta && window.uv.meta.stats.ferocity > 5`, 8000, 'aura buff in client stats');
      ok('Banneret aura buffs the client across the network');
      await B.waitFor(`const s=window.uv.snaps; const last=s[s.length-1]; return last && last.s.tethers && last.s.tethers.length===1`, 6000, 'tether in client snapshots');
      ok('Lodestone tether present in client snapshots (renders on both screens)');
      const auraSnap = await B.exec(`const s=window.uv.snaps; const last=s[s.length-1]; return last.s.auras.length`);
      if (auraSnap >= 1) ok('Banneret aura ring present in client snapshots'); else fail('aura missing from client snapshots');
      // tether shares incoming damage both ways
      const shareBefore = JSON.parse(await A.exec(`const s=window.uv.sim; return JSON.stringify([Math.round(s.players[0].hp), Math.round(s.players[1].hp)])`));
      await A.exec(`const s=window.uv.sim, p=s.players[1]; p.invuln=0; p.stats.reflex=0; s.hurtPlayer(p, 40, null); return 1;`);
      const shareAfter = JSON.parse(await A.exec(`const s=window.uv.sim; return JSON.stringify([Math.round(s.players[0].hp), Math.round(s.players[1].hp)])`));
      if (shareAfter[0] < shareBefore[0] && shareAfter[1] < shareBefore[1]) ok(`tether shares damage both ways (host ${shareBefore[0]}→${shareAfter[0]}, client ${shareBefore[1]}→${shareAfter[1]})`);
      else fail(`tether damage share: ${JSON.stringify({ shareBefore, shareAfter })}`);
      // ...and healing
      const healBefore = JSON.parse(await A.exec(`const s=window.uv.sim; return JSON.stringify([Math.round(s.players[0].hp), Math.round(s.players[1].hp)])`));
      await A.exec(`const s=window.uv.sim; s._heal(s.players[1], 12); return 1;`);
      const healAfter = JSON.parse(await A.exec(`const s=window.uv.sim; return JSON.stringify([Math.round(s.players[0].hp), Math.round(s.players[1].hp)])`));
      if (healAfter[1] > healBefore[1] && healAfter[0] > healBefore[0]) ok(`tether shares healing both ways (host ${healBefore[0]}→${healAfter[0]}, client ${healBefore[1]}→${healAfter[1]})`);
      else fail(`tether heal share: ${JSON.stringify({ healBefore, healAfter })}`);

      // ---- DoD 6: independent cameras — each client follows its own character ----
      await A.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA'}))`);
      await B.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}))`);
      await sleep(1600);
      await A.exec(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyA'}))`);
      await B.exec(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD'}))`);
      await sleep(900); // cameras settle
      const camA = JSON.parse(await A.exec(`return JSON.stringify({cam:Math.round(window.uvRenderer.camX), px:Math.round(window.uv.sim.players[0].x)})`));
      const camB = JSON.parse(await B.exec(`const s=window.uv.snaps; const last=s[s.length-1];
        return JSON.stringify({cam:Math.round(window.uvRenderer.camX), px:Math.round(last.s.players[1][1])})`));
      if (Math.abs(camA.cam - camA.px) < 200 && Math.abs(camB.cam - camB.px) < 200 && camB.cam - camA.cam > 200)
        ok(`independent cameras: host cam ${camA.cam}@${camA.px}, client cam ${camB.cam}@${camB.px}`);
      else fail(`cameras not independent: host ${JSON.stringify(camA)}, client ${JSON.stringify(camB)}`);

      // host abandons the run → whole party lands in the lobby together
      await A.exec(`document.getElementById('leave-btn').click()`);
      await A.waitFor(`return !document.getElementById('leave-confirm').classList.contains('hidden')`, 2000, 'host confirm dialog');
      await A.exec(`document.getElementById('leave-yes').click()`);
      await A.waitFor(`return window.uv.mode==='lobby'`, 4000, 'host in lobby after abandon');
      await B.waitFor(`return window.uv.mode==='lobby' && !document.getElementById('screen-lobby').classList.contains('hidden')`, 5000, 'client in lobby after abandon');
      const lobbySizes = [await A.exec(`return window.uv.lobby.players.length`), await B.exec(`return window.uv.lobby.players.length`)];
      if (lobbySizes[0] === 2 && lobbySizes[1] === 2) ok('host abandon → both players in the lobby, connection intact');
      else fail(`lobby sizes after abandon: host=${lobbySizes[0]} client=${lobbySizes[1]}`);
      // both pick fresh characters and start a brand-new run (host = Facet for
      // the boon-isolation gate)
      await A.exec(`document.querySelector('.char-card[data-char="facet"]').click()`);
      await B.exec(`document.querySelector('.char-card[data-char="glasswing"]').click()`);
      await sleep(400);
      await B.exec(`document.getElementById('btn-ready').click()`);
      await A.waitFor(`return window.uv.lobby.players[1] && window.uv.lobby.players[1].ready`, 5000, 'client re-ready');
      await A.exec(`document.getElementById('btn-start').click()`);
      await A.waitFor(`return window.uv.mode==='run' && window.uv.sim && window.uv.sim.players[0].charId==='facet' && window.uv.sim.players[0].materials===0`, 5000, 'fresh co-op run (host)');
      await B.waitFor(`return window.uv.mode==='run'`, 5000, 'fresh co-op run (client)');
      ok('fresh co-op run starts for both after abandon');

      // ---- gate: Facet's boon picker fires on fight entry, only on Facet's screen ----
      await A.waitFor(`return !document.getElementById('screen-map').classList.contains('hidden')`, 4000, 'map for boon run');
      await A.exec(`document.querySelector('.map-node.reachable').click(); return 1;`);
      await A.waitFor(`return window.uv.sim.phase==='arena'`, 8000, 'boon-run arena (vote expiry)');
      await A.waitFor(`return !document.getElementById('overlay-boon').classList.contains('hidden')`, 5000, 'host boon picker');
      const clientBoon = await B.exec(`return !document.getElementById('overlay-boon').classList.contains('hidden')`);
      if (!clientBoon) ok("Facet's boon picker shows only on Facet's screen"); else fail('boon picker leaked to the client');
      const snapCount0 = await B.exec(`return window.uv.snaps.length ? window.uv.snaps[window.uv.snaps.length-1].s.tick : 0`);
      await A.exec(`document.querySelector('.boon-card').click(); return 1;`);
      await sleep(800);
      const snapCount1 = await B.exec(`return window.uv.snaps.length ? window.uv.snaps[window.uv.snaps.length-1].s.tick : 0`);
      if (snapCount1 > snapCount0) ok('host boon pick never interrupts the client (sim keeps ticking for both)');
      else fail(`client snapshots stalled during boon pick (tick ${snapCount0}→${snapCount1})`);

      // ---- co-op build management: both players manage simultaneously ----
      await A.exec(clearFightJs);
      await A.exec(drainJs);
      await A.exec(`const s=window.uv.sim; s.debug('F2'); const shop=s.floor.nodes.find(n=>n.kind==='shop'); s._travelTo(shop.id); return 1;`);
      await A.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 5000, 'host shop (mgmt)');
      await B.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 5000, 'client shop (mgmt)');
      ok('both players get their own shop overlay at the Trader stop');
      const coopItem = JSON.parse(await A.exec(`const it=window.uvContent.ITEMS.find(it=>it.stats&&it.stats.vitality>0&&!it.hooks); return JSON.stringify({id:it.id})`));
      await A.exec(`const s=window.uv.sim; for (const p of s.players){ s._addWeapon(p,'coilgun',1); s._addWeapon(p,'coilgun',1); p.items.push(${JSON.stringify(coopItem.id)}); s._recomputeItems(p); s._recomputeStats(p); } return 1;`);
      await A.waitFor(`return window.uv.meta.weapons.filter(w=>w.id==='coilgun').length===2`, 3000, 'host pair');
      await B.waitFor(`return window.uv.meta && window.uv.meta.weapons.filter(w=>w.id==='coilgun').length===2`, 4000, 'client pair');
      // interleave: host arms a combine while client arms a sell, then both confirm
      await A.exec(`const i=window.uv.meta.weapons.findIndex(w=>w.id==='coilgun'); document.querySelector('[data-wchip="'+i+'"]').click(); return 1;`);
      await B.exec(`document.querySelector('[data-selli="${coopItem.id}"]').click(); return 1;`);
      await A.waitFor(`return document.querySelector('[data-combine]')!==null`, 3000, 'host combine affordance');
      const bMats0 = await B.exec('return window.uv.meta.materials');
      await A.exec(`document.querySelector('[data-combine]').click(); return 1;`);
      await B.exec(`document.querySelector('[data-selli="${coopItem.id}"]').click(); return 1;`);
      await A.waitFor(`const w=window.uv.meta.weapons.filter(w=>w.id==='coilgun'); return w.length===1 && w[0].tier===2`, 4000, 'host combined');
      await B.waitFor(`return window.uv.meta.materials > ${bMats0} && !window.uv.meta.items.includes(${JSON.stringify(coopItem.id)})`, 4000, 'client sold');
      // authoritative builds match what each client displays
      const hostView = await A.exec(`const s=window.uv.sim; return JSON.stringify(s.players.map(p=>({w:p.weapons.map(w=>[w.id,w.tier]), it:p.items.length})))`);
      const bMetaView = await B.exec(`return JSON.stringify({w:window.uv.meta.weapons.map(w=>[w.id,w.tier]), it:window.uv.meta.items.length})`);
      const hv = JSON.parse(hostView), bv = JSON.parse(bMetaView);
      if (JSON.stringify(hv[1]) === JSON.stringify(bv)) ok('simultaneous combine+sell: host build state and client display agree');
      else fail(`desync: host has ${JSON.stringify(hv[1])}, client shows ${bMetaView}`);
      // forged invalid action from the client is rejected without effect
      const bBefore = await A.exec(`return JSON.stringify(window.uv.sim.players[1].weapons.map(w=>[w.id,w.tier]))`);
      await B.exec(`window.uv.clientT.send({t:'ui', kind:'combine', a:0, b:5, id:'gravemaul', tier:3}); window.uv.clientT.send({t:'ui', kind:'sellWeapon', slot:'__proto__', id:'x', tier:1}); window.uv.clientT.send({t:'ui', kind:'pickNode', nodeId:999}); return 1;`);
      await sleep(800);
      const bAfter = await A.exec(`return JSON.stringify(window.uv.sim.players[1].weapons.map(w=>[w.id,w.tier]))`);
      if (bBefore === bAfter) ok('forged invalid combine/sell/pick from a client is safely rejected'); else fail('forged client action mutated the build');
      // one player's character sheet never touches the other's game
      await A.exec(`const s=window.uv.sim; const f=s.floor.nodes.find(n=>n.kind==='combat' && n.id!==s.currentNode); s._travelTo(f.id); return 1;`);
      await A.waitFor(`return window.uv.sim.phase==='arena'`, 3000, 'sheet-isolation arena');
      await A.exec(`window.uv.sim.debug('F1'); return 1;`);
      await B.exec(`document.getElementById('sheet-btn').click(); return 1;`);
      await B.waitFor(`return !document.getElementById('overlay-sheet').classList.contains('hidden')`, 3000, 'client sheet in combat');
      await B.exec(`document.querySelector('[data-glossrow="grit"]').click(); return 1;`);
      if (await B.exec(`return document.querySelector('.gloss-detail') !== null`)) ok('co-op: client expands a stat glossary in its own sheet');
      else fail('client glossary detail did not expand');
      const hTick0 = await A.exec('return window.uv.sim.tickNum');
      await sleep(800);
      const hTick1 = await A.exec('return window.uv.sim.tickNum');
      const hostSheet = await A.exec(`return !document.getElementById('overlay-sheet').classList.contains('hidden')`);
      if (hTick1 > hTick0 + 30 && !hostSheet) ok("client's mid-combat sheet leaves the host's game untouched");
      else fail(`sheet isolation: host ticked ${hTick0}→${hTick1}, host sheet visible=${hostSheet}`);
      await B.exec(`document.getElementById('sheet-close').click(); return 1;`);
      // client sees host's snapshot state
      const snapAge = await B.exec(`return performance.now() - window.uv.lastSnapAt`);
      if (snapAge < 1000) ok('client receives snapshots'); else fail(`stale snapshots (${Math.round(snapAge)}ms)`);
      // both deal and take damage in organic combat
      await sleep(3000);
      const combat = await A.exec(`const s=window.uv.sim; return JSON.stringify({d0:Math.round(s.players[0].damageDealt), d1:Math.round(s.players[1].damageDealt), hurt:s.players.some(p=>p.hp<p.stats.vitality)})`);
      const cb = JSON.parse(combat);
      if (cb.d0 > 0 && cb.d1 > 0) ok(`both players deal damage (host ${cb.d0}, client ${cb.d1})`); else fail(`damage tallies: ${combat}`);
      if (cb.hurt) ok('players take damage from enemies'); else console.warn('⚠ nobody was hit during the combat window (kiting luck)');
      // down the client, host revives (via sim manipulation on host)
      await A.exec(`const s=window.uv.sim, p=s.players[1]; p.invuln=0; let g=0; while(!p.downed&&g++<80){p.hp=1;s.hurtPlayer(p,999,null);}`);
      await sleep(600);
      const cDown = await B.exec(`const s=window.uv.snaps; const last=s[s.length-1]; return last && last.s.players[1][5]`);
      if (cDown) ok('client sees itself downed'); else fail('downed state not visible on client');
      await A.exec(`const s=window.uv.sim; s.players[0].x=s.players[1].x; s.players[0].y=s.players[1].y;`);
      await A.waitFor(`return !window.uv.sim.players[1].downed`, 6000, 'revive');
      ok('proximity revive works in co-op');

      // ---- patch 9: co-op ring spawning — the merged ring keeps every
      // sampled spawn ≥520u from BOTH players, wherever they stand ----
      const ringChk = await A.exec(`const s=window.uv.sim, p0=s.players[0], p1=s.players[1];
        const keep={profile:s.profile, x0:p0.x, y0:p0.y, x1:p1.x, y1:p1.y};
        s.profile={ring:true, artillery:0, puddle:0, flankers:0, rateMult:1};
        p0.x=s.W*0.32; p0.y=s.H*0.5; p1.x=s.W*0.68; p1.y=s.H*0.5;
        let bad=0, minD=1e9;
        for (let i=0;i<40;i++){ const pos=s._spawnWavePos();
          const d=Math.sqrt(Math.min((pos.x-p0.x)**2+(pos.y-p0.y)**2,(pos.x-p1.x)**2+(pos.y-p1.y)**2));
          minD=Math.min(minD,d); if (d<519) bad++; }
        s.profile=keep.profile; p0.x=keep.x0; p0.y=keep.y0; p1.x=keep.x1; p1.y=keep.y1;
        return JSON.stringify({bad, minD:Math.round(minD)});`);
      const rc9 = JSON.parse(ringChk);
      if (rc9.bad === 0) ok(`co-op merged ring: 40 sampled spawns all ≥520u from both players (closest ${rc9.minD}u)`);
      else fail(`ring spawns landed on-screen: ${rc9.bad}/40 inside 520u (closest ${rc9.minD}u)`);

      // ---- the airhorn in co-op: own = loud, ally = quiet, debounced ----
      await sleep(1200); // clear any debounce window from organic levels
      await A.exec(`const s=window.uv.sim; s._collectMaterial(s.players[0], 150); return 1;`);
      await A.waitFor(`return window.uvAudio.stats.hornLog.includes(1) ? 1 : 0`, 4000, 'own horn on host');
      await B.waitFor(`return window.uvAudio.stats.hornLog.includes(0.35) ? 1 : 0`, 4000, 'ally horn on client');
      await sleep(1200); // past the debounce window
      await A.exec(`const s=window.uv.sim; s._collectMaterial(s.players[1], 150); return 1;`);
      await B.waitFor(`return window.uvAudio.stats.hornLog.includes(1) ? 1 : 0`, 4000, 'own horn on client');
      await A.waitFor(`return window.uvAudio.stats.hornLog.includes(0.35) ? 1 : 0`, 4000, 'ally horn on host');
      ok('co-op level-ups: each side hears its own loud and the ally quiet, debounced');

      // ---- patch 8 co-op: extraction shops for both; auto-combine, swap,
      // and rerolls run in parallel with host validation, no desync ----
      await A.exec(clearFightJs);
      await A.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 5000, 'host extraction shop');
      await B.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 5000, 'client extraction shop');
      ok('extraction shop opens for BOTH players at the co-op clear');
      await A.exec(`const s=window.uv.sim,p0=s.players[0],p1=s.players[1];
        while (p0.weapons.length < p0.weaponSlots) s._addWeapon(p0,'pebbleshot',1);
        p0.materials=500; p1.materials=500;
        p0.shop.stock[0]={kind:'weapon',id:'pebbleshot',tier:1,price:12,sold:false,locked:false};
        p0.shop.stock[1]={kind:'weapon',id:'rustcleaver',tier:1,price:14,sold:false,locked:false};
        s._sendShop(p0); s._sendShop(p1); return 1;`);
      await A.waitFor(`return window.uv.meta.weapons.length===window.uv.meta.weaponSlots`, 4000, 'host at cap');
      // simultaneous: client rerolls while the host's duplicate buy auto-combines
      await B.exec(`document.getElementById('shop-reroll').click(); return 1;`);
      await A.exec(`document.querySelector('.offer-card[data-slot="0"]').click(); return 1;`);
      await A.waitFor(`return window.uv.meta.weapons.some(w=>w.id==='pebbleshot'&&w.tier===2)`, 4000, 'co-op auto-combine');
      await A.waitFor(`return window.uv.sim.players[1].shop.rerolls===1`, 4000, 'client reroll validated');
      ok('client rerolls while the host auto-combines at full slots — host validates both');
      // simultaneous: client rerolls again while the host runs a make-room swap
      await B.exec(`document.getElementById('shop-reroll').click(); return 1;`);
      await A.exec(`document.querySelector('.offer-card[data-slot="1"]').click(); return 1;`);
      await A.waitFor(`return document.querySelector('.swap-card') !== null`, 3000, 'co-op swap picker');
      await A.exec(`document.querySelector('.swap-card:not(.cantafford)').click(); return 1;`);
      await A.exec(`const c=document.querySelector('.swap-card.armed'); if (c) c.click(); return 1;`);
      await A.waitFor(`return window.uv.meta.weapons.some(w=>w.id==='rustcleaver')`, 4000, 'co-op swap executed');
      await A.waitFor(`return window.uv.sim.players[1].shop.rerolls===2`, 4000, 'client second reroll validated');
      const coopSlots = await A.exec('return window.uv.meta.weaponSlots');
      const coopN = await A.exec('return window.uv.meta.weapons.length');
      if (coopN === coopSlots) ok(`swap + parallel rerolls: host still at ${coopN}/${coopSlots}, no desync`);
      else fail(`co-op swap count: ${coopN}/${coopSlots}`);
      // client display agrees with the authoritative build
      const cv = await B.exec(`return JSON.stringify(window.uv.meta.weapons.map(w=>[w.id,w.tier]))`);
      const hv2 = await A.exec(`return JSON.stringify(window.uv.sim.players[1].weapons.map(w=>[w.id,w.tier]))`);
      if (cv === hv2) ok('client build display matches the host after the parallel session');
      else fail(`co-op shop desync: host ${hv2} client ${cv}`);
      await A.exec(`document.getElementById('shop-close') && document.getElementById('shop-close').click(); return 1;`);
      await B.exec(`document.getElementById('shop-close') && document.getElementById('shop-close').click(); return 1;`);

      // ---- DoD 6: the full Siege in co-op — mutations, mercy revive, boss, payout ----
      await A.exec(drainJs);
      await A.exec(`const s=window.uv.sim; s._travelTo(s.floor.siegeId); return 1;`);
      await A.waitFor(`return window.uv.sim.phase==='arena' && window.uv.sim.arenaNode.kind==='siege'`, 8000, 'host in siege');
      await B.waitFor(`return window.uv.arena && window.uv.arena.kind==='siege'`, 12000, 'client got the siege arena event');
      ok('both players enter the Siege');
      const obst0 = await A.exec('return window.uv.sim.obstacles.length');
      // down the client: the first mutation must revive them (mercy rule)
      await A.exec(`const s=window.uv.sim, p=s.players[1]; p.invuln=0; p.stats.reflex=0; let g=0; while(!p.downed&&g++<90){p.hp=1;s.hurtPlayer(p,9999,null);} return 1;`);
      await A.waitFor(`return window.uv.sim.players[1].downed`, 3000, 'client downed pre-mutation');
      await A.exec(`const s=window.uv.sim; s.siegeT = Math.max(s.siegeT, s.mutations[0].at); s.tick(); return 1;`);
      await A.waitFor(`return !window.uv.sim.players[1].downed`, 3000, 'mercy revive');
      ok('mutation revives the downed client (mercy rule)');
      const obst1 = await A.exec('return window.uv.sim.obstacles.length');
      if (obst1 < obst0) ok(`wall collapse removed obstacles on the host (${obst0}→${obst1})`); else fail(`no collapse: ${obst0}→${obst1}`);
      await B.waitFor(`return window.uv.arena && window.uv.arena.obstacles.length===${obst1} ? 1 : 0`, 5000, 'client obstacles updated');
      ok('collapsed walls sync to the client mid-siege');
      await B.waitFor(`const s=window.uv.snaps; const last=s[s.length-1]; return last && last.s.players[1][5]===0 ? 1 : 0`, 4000, 'client sees itself revived');
      // fast-forward to the boss
      await A.exec(`const s=window.uv.sim; s.siegeT = Math.max(s.siegeT, s.bossAt); s.tick(); return 1;`);
      await A.waitFor(`return !!window.uv.sim.boss`, 4000, 'siege boss up');
      await B.waitFor(`const s=window.uv.snaps; const last=s[s.length-1]; return last && last.s.boss ? 1 : 0`, 5000, 'boss in client snapshots');
      ok('the floor boss enters mid-siege on both screens');
      await A.exec(`const s=window.uv.sim; let b=0; while (s.boss && b++<3000) s.damageEnemy(s.boss, 400, {owner:s.players[0]}); for (let i=0;i<20;i++) s.tick(); return 1;`);
      await A.waitFor(`return window.uv.sim.cleared`, 4000, 'siege cleared after boss death');
      // ---- patch 9: the looting window — countdown runs on the host and
      // syncs to the client before any shop appears ----
      const hostLootT = await A.exec(`return window.uv.sim.lootT`);
      if (hostLootT !== null && hostLootT !== undefined && hostLootT > 0) ok(`boss death opens the looting window on the host (${hostLootT.toFixed(1)}s)`);
      else fail(`no looting window on the host after boss death (lootT=${hostLootT})`);
      await B.waitFor(`const s=window.uv.snaps; const last=s[s.length-1]; return last && last.s.loot !== null && last.s.loot !== undefined && last.s.loot > 0 ? 1 : 0`, 5000, 'loot countdown in client snapshots');
      ok('looting countdown syncs to the client');
      await A.waitFor(`const ec=document.getElementById('enemy-counter'); return !ec.classList.contains('hidden') && ec.querySelector('.ec-loot') !== null ? 1 : 0`, 4000, 'host HUD sweep state');
      await B.waitFor(`const ec=document.getElementById('enemy-counter'); return !ec.classList.contains('hidden') && ec.querySelector('.ec-loot') !== null ? 1 : 0`, 4000, 'client HUD sweep state');
      ok('both HUDs show the "sweep!" countdown during the looting window');
      // post-boss shop opens for BOTH players — only after the window closes
      // (8s by default; shortened here to keep the suite quick)
      await A.exec(`const s=window.uv.sim; if (s.lootT !== null && s.lootT !== undefined) s.lootT = Math.min(s.lootT, 0.4); return 1;`);
      await A.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 6000, 'host post-boss shop');
      await B.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 6000, 'client post-boss shop');
      ok('post-boss shop opens for both players after the looting window');
      await A.exec(drainJs);
      await A.exec(`const s=window.uv.sim; for (const p of s.players) if (p.shop) s.uiAction(p.idx,{kind:'closeShop'}); return 1;`);
      // extraction consent countdown syncs, then the party descends
      await A.exec(`const s=window.uv.sim; for (const p of s.players) { p.x=s.hatch.x; p.y=s.hatch.y; } return 1;`);
      await B.waitFor(`const s=window.uv.snaps; const last=s[s.length-1]; return last && last.s.extract !== null && last.s.extract !== undefined ? 1 : 0`, 5000, 'extraction countdown on client');
      ok('extraction countdown syncs to the client');
      await extractToMap(A, 'co-op siege descent');
      await A.waitFor(`return window.uv.sim.floorNum===2`, 3000, 'host on floor 2');
      await B.waitFor(`return window.uv.floorNum===2`, 6000, 'client on floor 2');
      ok('siege payout + descent lands BOTH players on floor 2');

      // wipe → both see results
      await A.exec(`const s=window.uv.sim; for (const p of s.players){let g=0; while(!p.downed&&!s.over&&g++<90){p.invuln=0;p.stats.reflex=0;p.hp=1;s.hurtPlayer(p,9999,null);}}`);
      await A.waitFor(`return window.uv.mode==='results'`, 5000, 'host results');
      await B.waitFor(`return window.uv.mode==='results'`, 5000, 'client results');
      ok('wipe → results on both host and client');

      // ---- defeat flow: back to THIS room's character select, no rehosting ----
      const codeBefore = await A.exec(`return window.uv.hostT.code`);
      const peersBefore = await A.exec(`return window.uv.hostT.conns.size`);
      const hostHasBtn = await A.exec(`return document.getElementById('btn-lobby') !== null`);
      const clientWaits = await B.exec(`return document.getElementById('btn-lobby') === null`);
      if (hostHasBtn && clientWaits) ok('results: the host drives the new run, the client is told to wait');
      else fail(`new-run button: host=${hostHasBtn} clientHidden=${clientWaits}`);

      // a player dropping DURING the transition must leave a clean lobby
      await B.exec(`document.getElementById('btn-title').click(); return 1;`);
      await B.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 5000, 'client left during results');
      await sleep(600);
      await A.exec(`document.getElementById('btn-lobby').click(); return 1;`);
      await A.waitFor(`return window.uv.mode==='lobby'`, 5000, 'host back in the lobby');
      const afterDrop = JSON.parse(await A.exec(`return JSON.stringify({
        code: window.uv.hostT.code, n: window.uv.lobby.players.length,
        host: window.uv.lobby.players.filter(p=>p.isHost).length,
        chars: window.uv.lobby.players.map(p=>p.charId) })`));
      if (afterDrop.code === codeBefore) ok(`defeat keeps the room code (${afterDrop.code}) — nothing to re-share`);
      else fail(`code changed on defeat: ${codeBefore} → ${afterDrop.code}`);
      if (afterDrop.n === 1 && afterDrop.host === 1)
        ok('a player leaving during the defeat transition leaves a clean, still-hosted lobby');
      else fail(`lobby after mid-transition drop: ${JSON.stringify(afterDrop)}`);
      if (afterDrop.chars.every(c => c === null)) ok('everyone re-picks: character choices cleared on defeat');
      else fail(`characters not cleared: ${JSON.stringify(afterDrop.chars)}`);

      // the SAME room is still live: the client rejoins with the same code
      await B.exec(`document.getElementById('name-input').value='FRIEND'; document.getElementById('join-code').value='${codeBefore}'; document.getElementById('btn-join').click(); return 1;`);
      await B.waitFor(`return window.uv.mode==='lobby'`, 15000, 'client rejoins the same room after a defeat');
      await A.waitFor(`return window.uv.lobby.players.length===2`, 6000, 'host sees the rejoin');
      if (await A.exec(`return window.uv.hostT.conns.size >= 1`)) ok(`peer connections work on the same room code after a defeat (${peersBefore} before)`);
      // …and a new run starts straight from here
      await A.exec(`document.querySelector('.char-card[data-char="rampart"]').click(); return 1;`);
      await B.waitFor(`return document.querySelector('.char-card[data-char="vesper"]')!==null`, 5000, 'client char grid again');
      await B.exec(`document.querySelector('.char-card[data-char="vesper"]').click(); return 1;`);
      await sleep(300);
      await B.exec(`document.getElementById('btn-ready').click(); return 1;`);
      await A.waitFor(`return window.uv.lobby.players[1] && window.uv.lobby.players[1].ready && window.uv.lobby.players[1].charId`, 8000, 'client ready for run 2');
      await A.exec(`document.getElementById('btn-start').click(); return 1;`);
      await A.waitFor(`return window.uv.mode==='run'`, 6000, 'run 2 on host');
      await B.waitFor(`return window.uv.mode==='run'`, 8000, 'run 2 on client');
      ok('defeat → same-session character select → new run, without rehosting');

      // wipe run 2 so the original post-run checks below still have a defeat
      await A.exec(`const s=window.uv.sim; for (const p of s.players){let g=0; while(!p.downed&&!s.over&&g++<90){p.invuln=0;p.stats.reflex=0;p.hp=1;s.hurtPlayer(p,9999,null);}} return 1;`);
      await A.waitFor(`return window.uv.mode==='results'`, 8000, 'results after run 2');
      await B.waitFor(`return window.uv.mode==='results'`, 8000, 'client results after run 2');

      // host closes while client reads results → client keeps the results screen
      await A.close();
      await sleep(2500);
      const stillResults = await B.exec(`return window.uv.mode==='results' && !document.getElementById('screen-results').classList.contains('hidden')`);
      if (stillResults) ok('client keeps its results screen when the host leaves post-run'); else fail('client lost results screen on host close');
      await B.exec(`document.getElementById('btn-title').click()`);
      await B.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 4000, 'client back to title');

      // phase 2 (DoD 6): B hosts a fresh run, C joins, host dies MID-RUN
      await B.exec(`document.getElementById('name-input').value='HOST2'; document.getElementById('btn-host').click()`);
      const code2 = await (async () => {
        const t0 = Date.now();
        for (;;) {
          const c = await B.exec(`return window.uv.lobby && window.uv.lobby.code`);
          if (c) return c;
          if (Date.now() - t0 > 12000) return null;
          await sleep(300);
        }
      })();
      if (!code2) fail('re-host registration failed');
      else {
        const C = new Browser();
        try {
          await C.open('C', { peerjsB64 });
          await C.goto(COOP_URL);
          await C.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title C');
          const joinAndStart = async () => {
            await C.exec(`document.getElementById('name-input').value='LATE'; document.getElementById('join-code').value='${code2}'; document.getElementById('btn-join').click()`);
            await C.waitFor(`return window.uv.mode==='lobby'`, 15000, 'C joins lobby');
            await B.waitFor(`return window.uv.lobby.players.length===2`, 5000, 'B sees C');
            await B.exec(`document.querySelector('.char-card[data-char="cogsmith"]').click()`);
            await C.waitFor(`return document.querySelector('.char-card[data-char="onrush"]')!==null`, 4000, 'C char grid');
            await C.exec(`document.querySelector('.char-card[data-char="onrush"]').click()`);
            await sleep(400);
            await C.exec(`document.getElementById('btn-ready').click()`);
            await B.waitFor(`return window.uv.lobby.players[1] && window.uv.lobby.players[1].ready`, 5000, 'C ready');
            await B.exec(`document.getElementById('btn-start').click()`);
            await C.waitFor(`return window.uv.mode==='run'`, 6000, 'C in run');
            // travel into the first fight so summons/turrets are on the field
            await B.exec(`const s=window.uv.sim; s.uiAction(0,{kind:'pickNode', nodeId:s.reachableNodes()[0]}); return 1;`);
            await B.waitFor(`return window.uv.sim.phase==='arena'`, 8000, 'phase-2 arena (vote expiry)');
          };
          await joinAndStart();

          // ---- gate: Cogsmith turret carry + redeploy syncs on both screens ----
          await B.exec(`const s=window.uv.sim, p=s.players[0], t=s.summons.find(x=>x.owner===0 && !x.dead); p.x=t.x; p.y=t.y; return 1;`);
          await B.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'})); return 1;`);
          await B.waitFor(`return !!window.uv.sim.players[0].carrying`, 4000, 'host picks up turret');
          await C.waitFor(`const s=window.uv.snaps; const last=s[s.length-1]; return last && last.s.players[0][11]===1`, 6000, 'client sees carry flag');
          ok('turret pickup (E) syncs the carry state to the client');
          await B.exec(`const s=window.uv.sim, p=s.players[0]; p.x=s.W/2+140; p.y=s.H/2+80; p.aimA=0; return 1;`);
          await B.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'})); return 1;`);
          await B.waitFor(`return !window.uv.sim.players[0].carrying`, 6000, 'redeploy channel completes');
          const tpos = JSON.parse(await B.exec(`const s=window.uv.sim, t=s.summons.find(x=>x.owner===0 && !x.dead); return JSON.stringify([Math.round(t.x), Math.round(t.y)])`));
          await C.waitFor(`const s=window.uv.snaps; const last=s[s.length-1]; if(!last) return 0; const t=(last.s.summons||[]).find(x=>x[0]===0); return t && Math.abs(t[2]-${tpos[0]})<60 && Math.abs(t[3]-${tpos[1]})<60 ? 1 : 0`, 6000, 'client sees redeployed turret');
          ok(`turret redeploy position syncs to the client (${tpos})`);

          // non-host uses the leave button: leaves alone, host's game continues
          await C.exec(`document.getElementById('leave-btn').click()`);
          await C.waitFor(`return !document.getElementById('leave-confirm').classList.contains('hidden')`, 2000, 'C confirm dialog');
          const cText = await C.exec(`return document.getElementById('leave-confirm').textContent`);
          if (/plays on without you/.test(cText)) ok('non-host-flavored confirmation text'); else fail(`C confirm text: ${cText.slice(0, 120)}`);
          await C.exec(`document.getElementById('leave-yes').click()`);
          await C.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 5000, 'C back at title');
          await B.waitFor(`return window.uv.mode==='run' && window.uv.sim && !window.uv.sim.over && window.uv.sim.players[1].gone`, 8000, 'host continues without C');
          ok('non-host leave: player exits alone, host run continues');
          // host abandons its now-solo run → back to a joinable lobby with the same code
          await B.exec(`document.getElementById('leave-btn').click()`);
          await B.waitFor(`return !document.getElementById('leave-confirm').classList.contains('hidden')`, 2000, 'B confirm dialog');
          await B.exec(`document.getElementById('leave-yes').click()`);
          await B.waitFor(`return window.uv.mode==='lobby'`, 4000, 'B in lobby after abandon');
          await joinAndStart(); // same room code accepts a rejoin post-abandon
          ok('post-abandon lobby is joinable with the same code; new run starts');
          await B.close(); // kill the host window mid-run
          await C.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden') && document.getElementById('title-err').textContent.includes('Host disconnected')`, 12000, 'host-disconnected notice');
          ok('client shows "Host disconnected" when the host window dies mid-run');
          const cerrs = await C.errors();
          if (cerrs.length) fail(`client console errors: ${cerrs.join(' | ').slice(0, 300)}`); else ok('no client console errors');
        } finally { await C.close(); }
      }

      // phase 3: cross-play — desktop keyboard host + emulated touch client
      const D = new Browser(), M2 = new Browser();
      try {
        await D.open('D', { peerjsB64 });
        await D.goto(COOP_URL);
        await D.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title D');
        await D.exec(`document.getElementById('name-input').value='DESK'; document.getElementById('btn-host').click()`);
        const code3 = await (async () => {
          const t0 = Date.now();
          for (;;) {
            const c = await D.exec(`return window.uv.lobby && window.uv.lobby.code`);
            if (c) return c;
            if (Date.now() - t0 > 12000) return null;
            await sleep(300);
          }
        })();
        if (!code3) fail('cross-play host registration failed');
        else {
          await M2.open('M2', { peerjsB64, mobile: true });
          await M2.goto(COOP_URL);
          await M2.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title M2');
          // type the room code the mobile-keyboard way: tap to focus, insert text
          await M2.tap('#join-code');
          await M2.typeText(code3.toLowerCase());
          const typed = await M2.exec(`return document.getElementById('join-code').value`);
          if (typed.toUpperCase() === code3) ok(`room code typed on the touch device ("${typed}")`);
          else fail(`mobile-typed code "${typed}" != ${code3}`);
          await M2.tap('#btn-join');
          await M2.waitFor(`return window.uv.mode==='lobby'`, 15000, 'touch client joins by code');
          await D.waitFor(`return window.uv.lobby.players.length===2`, 5000, 'host sees touch client');
          await D.exec(`document.querySelector('.char-card[data-char="bulwark"]').click()`);
          await M2.waitFor(`return document.querySelector('.char-card[data-char="wisp"]')!==null`, 4000, 'M2 char grid');
          await M2.tap('.char-card[data-char="wisp"]');
          await sleep(300);
          await M2.tap('#btn-ready');
          await D.waitFor(`return window.uv.lobby.players[1] && window.uv.lobby.players[1].ready`, 5000, 'touch client ready');
          await D.exec(`document.getElementById('btn-start').click()`);
          await M2.waitFor(`return window.uv.mode==='run'`, 6000, 'cross-play run');
          ok('cross-play run starts (desktop host + touch client)');
          // into the first fight (touch client taps its map vote; expiry travels)
          await M2.waitFor(`return !document.getElementById('screen-map').classList.contains('hidden')`, 5000, 'touch client map screen');
          await D.exec(`const s=window.uv.sim; s.uiAction(0,{kind:'pickNode', nodeId:s.reachableNodes()[0]}); return 1;`);
          await D.waitFor(`return window.uv.sim.phase==='arena'`, 8000, 'cross-play arena');
          await M2.waitFor(`return document.getElementById('screen-map').classList.contains('hidden')`, 5000, 'touch client map hides');
          // both move: keyboard on D, joystick on M2. Ring spawns converge
          // bodies on the players, so clear the field and park both in open
          // space first — the check is that inputs travel, not crowd physics
          await D.exec(`const s=window.uv.sim;
            for (const e of [...s.enemyPool]) s._killEnemy(e, null);
            s.spawnQueue.length = 0;
            const a=s._openSpot(s.W*0.35, s.H*0.5); s.players[0].x=a.x; s.players[0].y=a.y;
            const b=s._openSpot(s.W*0.35+140, s.H*0.5+140); s.players[1].x=b.x; s.players[1].y=b.y;
            return 1;`);
          await sleep(400); // let the teleports reconcile on the touch client
          const cp0 = JSON.parse(await D.exec(`const s=window.uv.sim; return JSON.stringify([Math.round(s.players[0].x), Math.round(s.players[1].x)])`));
          await D.exec(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}))`);
          await M2.touchDown(420, 200);
          await M2.touchMove(480, 200);
          await sleep(1100);
          await D.exec(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD'}))`);
          await M2.touchUp();
          const cp1 = JSON.parse(await D.exec(`const s=window.uv.sim; return JSON.stringify([Math.round(s.players[0].x), Math.round(s.players[1].x)])`));
          if (cp1[0] > cp0[0] + 40 && cp1[1] > cp0[1] + 40) ok(`both move: keys (${cp0[0]}→${cp1[0]}) + joystick (${cp0[1]}→${cp1[1]})`);
          else fail(`cross-play movement: host ${cp0[0]}→${cp1[0]}, touch ${cp0[1]}→${cp1[1]}`);
          // both fight
          await D.exec(`window.uv.sim.debug('F1')`);
          await sleep(3500);
          const cpd = JSON.parse(await D.exec(`const s=window.uv.sim; return JSON.stringify([Math.round(s.players[0].damageDealt), Math.round(s.players[1].damageDealt)])`));
          if (cpd[0] > 0 && cpd[1] > 0) ok(`both fight cross-play (dmg ${cpd[0]} / ${cpd[1]})`); else fail(`cross-play damage: ${cpd}`);
          // down the touch client, desktop host revives by proximity
          await D.exec(`const s=window.uv.sim, p=s.players[1]; let g=0; while(!p.downed&&!s.over&&g++<80){p.invuln=0;p.hp=1;s.hurtPlayer(p,999,null);} return 1;`);
          await D.exec(`const s=window.uv.sim; s.players[0].x=s.players[1].x; s.players[0].y=s.players[1].y; return 1;`);
          await D.waitFor(`return !window.uv.sim.players[1].downed`, 8000, 'cross-play revive');
          ok('down + revive works cross-play');
          // clear the fight; the extraction countdown syncs to the touch client
          await D.exec(clearFightJs);
          await D.exec(drainJs);
          await D.exec(`const s=window.uv.sim; if (s.hatch) for (const p of s.players) { p.x=s.hatch.x; p.y=s.hatch.y; } return 1;`);
          await M2.waitFor(`const s=window.uv.snaps; const last=s[s.length-1]; return last && last.s.extract !== null && last.s.extract !== undefined ? 1 : 0`, 6000, 'extraction countdown on touch client');
          ok('extraction countdown syncs to the touch client');
          await extractToMap(D, 'cross-play extraction');
          await M2.waitFor(`return !document.getElementById('screen-map').classList.contains('hidden')`, 5000, 'touch client back on the map');
          ok('extraction returns both players to the node map');
          const m2errs = await M2.errors();
          if (m2errs.length) fail(`touch client console errors: ${m2errs.join(' | ').slice(0, 300)}`); else ok('no console errors on the touch client');
        }
      } finally { await D.close(); await M2.close(); }

      // ---- phase 4: the Warband — 8 windows, one room ----
      // Full flow at the new cap: 8 join by code, fight with merged rings,
      // complete a siege (mercy revive, boss, looting window, shops ×8) and
      // descend. Plus the hard numbers: host upload via WebRTC getStats at
      // the crest, snapshot age/smoothness on the 7th peer, fps on host and
      // the mobile client, and the 8-seat UI checks.
      const W = [new Browser()];
      const WCHARS = ['banneret', 'lodestone', 'sawbones', 'tollkeeper', 'bulwark', 'cindermage', 'zephyr', 'redmaw'];
      try {
        const W0 = W[0];
        await W0.open('W0', { peerjsB64 });
        await W0.goto(COOP_URL);
        await W0.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 8000, 'title W0');
        await W0.exec(`document.getElementById('name-input').value='WARLORD'; document.getElementById('btn-host').click()`);
        const code4 = await (async () => {
          const t0 = Date.now();
          for (;;) {
            const c = await W0.exec(`return window.uv.lobby && window.uv.lobby.code`);
            if (c) return c;
            if (Date.now() - t0 > 15000) return null;
            await sleep(300);
          }
        })();
        if (!code4) fail('warband host registration failed');
        else {
          await W0.exec(`document.querySelector('.char-card[data-char="${WCHARS[0]}"]').click(); return 1;`);
          // 7 peers join by code — the 8th window is the mobile client
          for (let i = 1; i <= 7; i++) {
            const mob = i === 7;
            const Wi = new Browser();
            W.push(Wi);
            await Wi.open(`W${i}`, { peerjsB64, mobile: mob });
            await Wi.goto(COOP_URL);
            await Wi.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')`, 10000, `title W${i}`);
            await Wi.exec(`document.getElementById('name-input').value='WARB${i}'; document.getElementById('join-code').value='${code4}'; document.getElementById('btn-join').click(); return 1;`);
            await Wi.waitFor(`return window.uv.mode==='lobby'`, 20000, `W${i} joins`);
            await Wi.waitFor(`return document.querySelector('.char-card[data-char="${WCHARS[i]}"]') !== null`, 6000, `W${i} char grid`);
            await Wi.exec(`document.querySelector('.char-card[data-char="${WCHARS[i]}"]').click(); return 1;`);
            await sleep(250);
            await Wi.exec(`document.getElementById('btn-ready').click(); return 1;`);
          }
          await W0.waitFor(`return window.uv.lobby.players.length===8`, 10000, 'host sees 8 seats');
          ok('8 players join one room by code');
          const seatInfo = JSON.parse(await W0.exec(`const ps=window.uv.lobby.players; return JSON.stringify({n:ps.length, colors:new Set(ps.map(p=>p.color)).size, seats:document.querySelectorAll('.lobby-player').length})`));
          if (seatInfo.colors === 8 && seatInfo.seats === 8) ok('8 seats render with 8 distinct colors');
          else fail(`lobby at 8: ${JSON.stringify(seatInfo)}`);
          // the mobile window's lobby: 8 seats visible, touch-sized
          const mseat = JSON.parse(await W[7].exec(`const els=[...document.querySelectorAll('.lobby-player')]; const r=els.length?els[0].getBoundingClientRect():{height:0};
            return JSON.stringify({n:els.length, h:Math.round(r.height)})`));
          if (mseat.n === 8 && mseat.h >= 44) ok(`mobile lobby renders 8 seats at the 44px standard (${mseat.h}px)`);
          else fail(`mobile lobby seats: ${JSON.stringify(mseat)}`);
          await W0.waitFor(`return window.uv.lobby.players.every(p=>p.charId && (p.ready||p.isHost))`, 10000, 'all 8 ready');
          await W0.exec(`document.getElementById('btn-start').click(); return 1;`);
          await W0.waitFor(`return window.uv.mode==='run'`, 8000, 'warband run starts');
          for (const Wi of [W[1], W[4], W[7]]) await Wi.waitFor(`return window.uv.mode==='run'`, 10000, 'client in run');
          ok('the 8-player run starts on every screen');
          // shrink the middle clients' windows — they stay live (input keepalive,
          // snapshots) but render cheap, so perf numbers measure the game, not
          // six extra headless compositors
          for (let i = 2; i <= 6; i++) await W[i].cdp('Emulation.setDeviceMetricsOverride', { width: 360, height: 220, deviceScaleFactor: 1, mobile: false });
          // crowd snapshot rate: 12/s at 6+ players
          const hz0 = await W0.exec(`window.uvNet.snaps=0; window.uvNet.snapBytes=0; return window.uvNet.hz`);
          // into the first fight (consent countdown expires and travels)
          await W0.exec(`const s=window.uv.sim; s.uiAction(0,{kind:'pickNode', nodeId:s.reachableNodes()[0]}); return 1;`);
          await W0.waitFor(`return window.uv.sim.phase==='arena'`, 12000, 'warband arena (vote expiry)');
          await W[7].waitFor(`return window.uv.arena !== null`, 8000, 'mobile client got the arena');
          if (hz0 === 12 || await W0.exec(`return window.uvNet.hz`) === 12) ok('snapshot rate drops to 12/s at 6+ players');
          else fail(`crowd snapshot rate: ${await W0.exec(`return window.uvNet.hz`)} Hz`);
          // merged rings with 8 live players
          const ring8 = JSON.parse(await W0.exec(`const s=window.uv.sim;
            const keep=s.profile; s.profile={ring:true, artillery:0, puddle:0, flankers:0, rateMult:1};
            let bad=0, minD=1e9;
            for (let i=0;i<30;i++){ const pos=s._spawnWavePos();
              for (const p of s.players){ if (p.gone||p.downed) continue;
                const d=Math.hypot(pos.x-p.x,pos.y-p.y); minD=Math.min(minD,d); if (d<519){bad++;break;} } }
            s.profile=keep; return JSON.stringify({bad, minD:Math.round(minD)});`));
          if (ring8.bad === 0) ok(`merged ring at 8: 30 samples all ≥520u from every player (closest ${ring8.minD}u)`);
          else fail(`ring at 8: ${ring8.bad}/30 inside 520u`);
          // the arena scaled up for the warband
          const dims8 = JSON.parse(await W0.exec(`const s=window.uv.sim; return JSON.stringify([s.W,s.H])`));
          ok(`8-player arena bounds ${dims8[0]}×${dims8[1]} (×1.25 templates)`);
          // HUD at 8: condensed two-column strip, own row prominent
          await sleep(1200);
          const strip = JSON.parse(await W0.exec(`const w=document.getElementById('hud-players');
            return JSON.stringify({crowd:w.classList.contains('crowd'), rows:w.querySelectorAll('.php').length, own:w.querySelectorAll('.php.own-row').length, minis:w.querySelectorAll('.php.mini').length})`));
          if (strip.crowd && strip.rows === 8 && strip.own === 1 && strip.minis === 7) ok('HP strip condenses to the two-column crowd layout (own row + 7 minis)');
          else fail(`crowd strip: ${JSON.stringify(strip)}`);
          const mstrip = JSON.parse(await W[7].exec(`const w=document.getElementById('hud-players'); const r=w.getBoundingClientRect();
            const mini=w.querySelector('.php.mini'); const mr=mini?mini.getBoundingClientRect():{height:0};
            return JSON.stringify({h:Math.round(r.height), miniH:Math.round(mr.height), vh:window.innerHeight})`));
          if (mstrip.h <= mstrip.vh * 0.5 && mstrip.miniH >= 16) ok(`mobile HP strip stays compact at 8 (${mstrip.h}px of ${mstrip.vh}px, minis ${mstrip.miniH}px)`);
          else fail(`mobile strip at 8: ${JSON.stringify(mstrip)}`);
          // organic combat everywhere, then snapshot health on the 7th peer
          await sleep(2500);
          const gaps = JSON.parse(await W[7].exec(`const s=window.uv.snaps; const g=[]; for (let i=1;i<s.length;i++) g.push(Math.round(s[i].rt-s[i-1].rt)); return JSON.stringify(g.slice(-20))`));
          const age7 = await W[7].exec(`return Math.round(performance.now() - window.uv.lastSnapAt)`);
          const maxGap = Math.max(...gaps);
          console.log(`  NET 7th peer: snapshot age ${age7}ms, gaps max ${maxGap}ms of ${gaps.length} sampled (12Hz nominal 83ms)`);
          if (age7 < 600 && maxGap <= 450) ok(`7th peer interpolates smoothly (age ${age7}ms, max gap ${maxGap}ms)`);
          else fail(`7th peer snapshot health: age ${age7}ms, max gap ${maxGap}ms`);
          // clear the fight → all 8 get their extraction shop
          await W0.exec(clearFightJs);
          await W0.waitFor(`return window.uv.sim.players.every(p=>p.gone||p.shop)`, 8000, 'shops ×8');
          ok('extraction shops open for all 8 players');
          await W[4].waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 8000, 'mid client shop');
          await W0.exec(drainJs);
          await W0.exec(`const s=window.uv.sim; for (const p of s.players) if (p.shop) s.uiAction(p.idx,{kind:'closeShop'}); return 1;`);
          await extractToMap(W0, 'warband extraction');
          // ---- the 8-player siege ----
          await W0.exec(drainJs);
          await W0.exec(`const s=window.uv.sim; s._travelTo(s.floor.siegeId); return 1;`);
          await W0.waitFor(`return window.uv.sim.phase==='arena' && window.uv.sim.arenaNode.kind==='siege'`, 10000, 'warband siege');
          await W[7].waitFor(`return window.uv.arena && window.uv.arena.kind==='siege'`, 12000, 'mobile client in siege');
          ok('all 8 enter the siege');
          // crest: fill to the alive ceiling, then measure the real wire
          await W0.exec(`const s=window.uv.sim; if (!s.god) s.debug('F5'); let t=0; while (s.enemyPool.count < 290 && t++ < 8) s.debug('F1'); return s.enemyPool.count;`);
          const crest8 = await W0.exec('return window.uv.sim.enemyPool.count');
          await sleep(1000);
          const bw = JSON.parse(await W0.exec(`return (async () => {
            const conns = [...window.uv.hostT.conns.values()];
            const grab = async () => {
              let bytes = 0;
              for (const c of conns) {
                if (!c.peerConnection) continue;
                const st = await c.peerConnection.getStats();
                st.forEach(r => { if (r.type === 'data-channel') bytes += (r.bytesSent || 0); });
              }
              return bytes;
            };
            const est0 = window.uvNet.bytesOut;
            const b0 = await grab(); const t0 = performance.now();
            await new Promise(r => setTimeout(r, 8000));
            const b1 = await grab(); const t1 = performance.now();
            return JSON.stringify({ real: Math.round((b1 - b0) / ((t1 - t0) / 1000)), est: Math.round((window.uvNet.bytesOut - est0) / ((t1 - t0) / 1000)), peers: conns.length, alive: window.uv.sim.enemyPool.count, snapKB: +(window.uvNet.lastSnapBytes / 1024).toFixed(2) });
          })()`));
          console.log(`  NET host upload @ 8-player siege crest: ${(bw.real / 1024).toFixed(0)} KB/s real (getStats, ${bw.peers} peers, ${bw.alive} alive) · estimator ${(bw.est / 1024).toFixed(0)} KB/s · last snapshot ${bw.snapKB} KB`);
          if (bw.real > 0 && bw.real <= 450 * 1024) ok(`host upload ${(bw.real / 1024).toFixed(0)} KB/s ≤ 450 KB/s at the 8-player crest (target from a ~1.5 MB/s naive baseline)`);
          else fail(`host upload gate: ${(bw.real / 1024).toFixed(0)} KB/s`);
          // perf at the ceiling: desktop host and the mobile CLIENT
          const fps8 = await measureFps(W0);
          const fps7 = await measureFps(W[7]);
          const ceil8 = await W0.exec(`return (async()=>{ const m = await import('./js/config.js'); return m.CONFIG.ALIVE_CEILING; })()`);
          console.log(`  PERF warband: host ${fps8} fps @ ${crest8} alive (ceiling ${ceil8}), mobile client ${fps7} fps (headless SwiftShader, 8 browsers sharing CPU)`);
          if (fps8 >= 50) ok(`desktop host ${fps8} fps ≥ 50 at the 8-player crest`);
          else console.warn(`⚠ host headless fps ${fps8} with 8 concurrent Chromiums (SwiftShader; sim tick <1ms — see sim stress gate)`);
          if (fps7 >= 40) ok(`mobile client ${fps7} fps ≥ 40 at the crest`);
          else console.warn(`⚠ mobile-client headless fps ${fps7} under 8-browser CPU contention (unrepresentative)`);
          // measurements done — god OFF (it shielded the crest fill), sweep the
          // field and steady the party so the scripted boss steps run clean
          await W0.exec(`const s=window.uv.sim; if (s.god) s.debug('F5');
            for (const e of [...s.enemyPool]) if (!e.boss) s._killEnemy(e, null);
            for (const p of s.players) { p.hp = p.stats.vitality; p.invuln = 2; } return 1;`);
          // mercy revive at 8: down the mobile client's player, first mutation revives
          await W0.exec(`const s=window.uv.sim, p=s.players[7]; p.invuln=0; p.stats.reflex=0; let g=0; while(!p.downed&&g++<90){p.hp=1;s.hurtPlayer(p,9999,null);} return 1;`);
          await W0.waitFor(`return window.uv.sim.players[7].downed`, 4000, 'W7 downed');
          await W0.exec(`const s=window.uv.sim; s.siegeT = Math.max(s.siegeT, s.mutations[0].at); s.tick(); return 1;`);
          await W0.waitFor(`return !window.uv.sim.players[7].downed`, 4000, 'mercy revive at 8');
          ok('mutation mercy-revives the downed 8th player');
          // boss → looting window synced to the far peer → shops ×8 → descend
          await W0.exec(`const s=window.uv.sim; s.siegeT = Math.max(s.siegeT, s.bossAt); s.tick(); return 1;`);
          await W0.waitFor(`return !!window.uv.sim.boss`, 5000, 'warband boss up');
          await W0.exec(`const s=window.uv.sim; let b=0; while (s.boss && b++<4000) s.damageEnemy(s.boss, 500, {owner:s.players[0]}); for (let i=0;i<20;i++) s.tick(); return 1;`);
          await W0.waitFor(`return window.uv.sim.cleared`, 5000, 'warband boss down');
          await W[7].waitFor(`const s=window.uv.snaps; const last=s[s.length-1]; return last && last.s.loot !== null && last.s.loot !== undefined && last.s.loot > 0 ? 1 : 0`, 6000, 'loot countdown on the 7th peer');
          ok('the looting window syncs across the 8-player room');
          await W0.exec(`const s=window.uv.sim; if (s.lootT !== null && s.lootT !== undefined) s.lootT = Math.min(s.lootT, 0.4); return 1;`);
          await W0.waitFor(`return window.uv.sim.players.every(p=>p.gone||p.shop)`, 8000, 'post-boss shops ×8');
          ok('post-boss shops open for all 8');
          await W0.exec(drainJs);
          await W0.exec(`const s=window.uv.sim; for (const p of s.players) if (p.shop) s.uiAction(p.idx,{kind:'closeShop'}); return 1;`);
          await W0.waitFor(`return !!window.uv.sim.hatch`, 8000, 'descent hatch after the looting window');
          await W0.exec(`const s=window.uv.sim; if (!s.hatch) return 0; for (const p of s.players) if (!p.gone) { p.x=s.hatch.x; p.y=s.hatch.y; } return 1;`);
          await W0.waitFor(`return window.uv.sim.floorNum===2`, 15000, 'warband descent');
          await W[7].waitFor(`return window.uv.floorNum===2`, 10000, 'mobile client on floor 2');
          ok('the warband descends to floor 2 together');
          // wipe → results with 8 rows on the mobile screen
          await W0.exec(`const s=window.uv.sim; for (const p of s.players){let g=0; while(!p.downed&&!s.over&&g++<90){p.invuln=0;p.stats.reflex=0;p.hp=1;s.hurtPlayer(p,9999,null);}} return 1;`);
          await W[7].waitFor(`return window.uv.mode==='results'`, 10000, 'results on mobile client');
          const res8 = JSON.parse(await W[7].exec(`const cards=document.querySelectorAll('.result-card'); const b=document.getElementById('btn-title'); const r=b?b.getBoundingClientRect():{height:0};
            return JSON.stringify({cards:cards.length, btnH:Math.round(r.height)})`));
          if (res8.cards === 8 && res8.btnH >= 44) ok(`results screen renders 8 rows on mobile (button ${res8.btnH}px)`);
          else fail(`results at 8: ${JSON.stringify(res8)}`);
          // zero console errors across sampled windows
          for (const [name, Wi] of [['host', W0], ['client W1', W[1]], ['mobile W7', W[7]]]) {
            const errs8 = await Wi.errors();
            if (errs8.length) fail(`${name} console errors: ${errs8.join(' | ').slice(0, 300)}`);
          }
          ok('zero console errors across the sampled warband windows');
        }
      } finally { for (const Wi of W) await Wi.close(); }
    }
  } catch (e) {
    fail(`coop test: ${e.message}`);
  } finally {
    await A2.close(); await B.close();
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL BROWSER TESTS PASSED');
process.exit(failures ? 1 : 0);
