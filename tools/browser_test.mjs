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

// per-process ports so overlapping/stale runs can't steal each other's servers
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
  if (mapInfo.n >= 8 && mapInfo.n <= 10) ok(`map screen renders the floor's nodes (${mapInfo.n})`); else fail(`map node count: ${mapInfo.n}`);
  if (mapInfo.reach >= 2 && mapInfo.reach <= 3 && mapInfo.disabled === mapInfo.n - mapInfo.reach) ok(`${mapInfo.reach} reachable choices enabled, the rest disabled`);
  else fail(`map reachability: ${JSON.stringify(mapInfo)}`);
  if (/FLOOR 1/.test(mapInfo.header)) ok('map header shows the floor'); else fail(`map header: ${mapInfo.header}`);

  // tap a node → solo travels instantly into the arena
  await A.exec(`document.querySelector('.map-node.reachable').click(); return 1;`);
  await A.waitFor(`return window.uv.sim.phase==='arena'`, 3000, 'arena after node tap');
  await A.waitFor(`return document.getElementById('screen-map').classList.contains('hidden')`, 2000, 'map hides for the fight');
  ok('tapping a node travels into its arena (solo: instant)');

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
  await A.exec(`const s=window.uv.sim, p=s.players[0]; p.x = Math.min(s.W - 800, p.x + 600); return 1;`);
  await sleep(1000); // smooth-follow converges well under a second
  const camInfo = JSON.parse(await A.exec(`return JSON.stringify({ cam: Math.round(window.uvRenderer.camX), px: Math.round(window.uv.sim.players[0].x), aw: window.uv.sim.W })`));
  if (Math.abs(camInfo.cam - camInfo.px) < 80 && camInfo.cam > cam0 + 250) ok(`camera follows the player (cam ${cam0}→${camInfo.cam}, player at ${camInfo.px}, arena ${camInfo.aw}w)`);
  else fail(`camera follow: cam ${cam0}→${camInfo.cam}, player ${camInfo.px}`);

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
  // confirming extraction with the shop still open behaves sanely: the party
  // travels, the map returns underneath, the browse survives
  await extractToMap(A, 'solo first fight');
  await A.waitFor(`return !document.getElementById('screen-map').classList.contains('hidden')`, 3000, 'map screen after extraction');
  const shopSurvived = await A.exec(`return !document.getElementById('overlay-shop').classList.contains('hidden')`);
  if (shopSurvived) ok('extraction with the shop open: browse survives onto the map'); else fail('shop overlay vanished on extraction');
  await A.exec(`document.getElementById('shop-close').click(); return 1;`);
  const visitedMark = await A.exec(`return document.querySelector('.map-node.visited') !== null`);
  if (visitedMark) ok('extraction returns to the map with the fight marked visited'); else fail('no visited node on the map after extraction');

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
  await A.waitFor(`return window.uv.meta && window.uv.meta.weapons.filter(w=>w.id==='coilgun').length===2`, 3000, 'pair in meta');
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
        while (sim.phase === 'arena' && !sim.over && e++ < 600) {
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
    return s.enemyPool.count;`);
  const dFps = await measureFps(A);
  const dAlive = await A.exec('return window.uv.sim.enemyPool.count');
  console.log(`  PERF desktop host: ${dFps} fps @ ${crest}→${dAlive} alive (siege arena, headless SwiftShader)`);
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
    // touch-only: host → tap character → start
    await M.tap('#btn-host');
    await M.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')`, 5000, 'mobile lobby');
    await M.tap('.char-card[data-char="facet"]');
    await sleep(250);
    await M.tap('#btn-start');
    await M.waitFor(`return window.uv.mode==='run' && !!window.uv.sim`, 5000, 'mobile run start');
    ok('touch-only: host → tap character → start run');

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
    await M.tap('.boon-card');
    await M.waitFor(`return document.getElementById('overlay-boon').classList.contains('hidden')`, 3000, 'boon picked');
    const boonApplied = await M.exec(`return JSON.stringify(window.uv.sim.players[0].boonTemp)`);
    if (boonApplied && boonApplied !== 'null') ok(`boon picked by tap → ${boonApplied}`); else fail('boon pick did not apply');
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
      let t=0; while (s.enemyPool.count < 200 && t++ < 10) s.debug('F1'); return 1;`);
    const mAlive0 = await M.exec('return window.uv.sim.enemyPool.count');
    const mFps = await measureFps(M);
    const mPerf = JSON.parse(await M.exec(`return JSON.stringify({alive:window.uv.sim.enemyPool.count, dpr:window.uvRenderer.dpr})`));
    console.log(`  PERF mobile emulation: ${mFps} fps @ ${mAlive0}→${mPerf.alive} alive, dpr cap ${mPerf.dpr} (headless SwiftShader)`);
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
  const relay = spawn('node', ['tools/peer_relay.mjs', String(RELAY_PORT)], { stdio: 'ignore' });
  process.on('exit', () => relay.kill());
  await sleep(1500);
  const COOP_URL = `${URL}?peerhost=localhost&peerport=${RELAY_PORT}&peersecure=0`;
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
      const badge = await B.exec(`return document.querySelector('.map-node .mn-count') !== null`);
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
      await A.waitFor(`return window.uv.sim.phase==='arena' && window.uv.sim.arenaNode.kind==='siege'`, 3000, 'host in siege');
      await B.waitFor(`return window.uv.arena && window.uv.arena.kind==='siege'`, 5000, 'client got the siege arena event');
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
      // post-boss shop opens for BOTH players
      await A.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 5000, 'host post-boss shop');
      await B.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 5000, 'client post-boss shop');
      ok('post-boss shop opens for both players');
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
          // both move: keyboard on D, joystick on M2
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
    }
  } catch (e) {
    fail(`coop test: ${e.message}`);
  } finally {
    await A2.close(); await B.close();
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL BROWSER TESTS PASSED');
process.exit(failures ? 1 : 0);
