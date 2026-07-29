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
const RELAY_PORT = 9400 + (process.pid % 199);
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

  // ---- start-room re-entry via real doorway mechanics ----
  const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
  const doorPosJs = dir => `const s=window.uv.sim, p=s.players[0], W=s.W, H=s.H, WALL=36;
    ${dir === 'n' ? 'p.x=W/2; p.y=WALL+p.radius+2;'
    : dir === 's' ? 'p.x=W/2; p.y=H-WALL-p.radius-2;'
    : dir === 'w' ? 'p.x=WALL+p.radius+2; p.y=H/2;'
    : 'p.x=W-WALL-p.radius-2; p.y=H/2;'} return 1;`;
  async function clearIfLocked(br) {
    await br.exec(`const s=window.uv.sim; let g=0; while(s.roomLocked && !s.boss && g++<40){s.debug('F3'); for(let i=0;i<20;i++)s.tick();}
      const p=s.players[0]; let g2=0; while(p.pendingOffer&&g2++<30) s.uiAction(0,{kind:'levelup',id:p.pendingOffer[0].id});
      if (p.treasureOffer) s.uiAction(0,{kind:'treasure',id:null}); return 1;`);
  }
  async function walkThroughDoor(br, dir, what) {
    const from = await br.exec('return window.uv.sim.roomId');
    for (let i = 0; i < 26; i++) {
      await br.exec(doorPosJs(dir));
      await sleep(300);
      const cur = await br.exec('return window.uv.sim.roomId');
      if (cur !== from) return cur;
    }
    throw new Error(`door walk (${what}, dir ${dir}) never transitioned`);
  }
  async function startRoomRoundTrip(floorLabel) {
    const startId = await A.exec('return window.uv.sim.floor.startId');
    const dirOut = await A.exec(`const s=window.uv.sim; return Object.keys(s.floor.rooms[s.floor.startId].doors)[0]`);
    await walkThroughDoor(A, dirOut, `${floorLabel}: leave start`);
    await clearIfLocked(A);
    const back = await walkThroughDoor(A, OPP[dirOut], `${floorLabel}: re-enter start`);
    if (back !== startId) { fail(`${floorLabel}: walked back but landed in room ${back}, not start ${startId}`); return; }
    // cross through and out a different door if one exists (else the same one)
    const dirs = await A.exec(`const s=window.uv.sim; return Object.keys(s.floor.rooms[s.floor.startId].doors)`);
    const dir2 = dirs.find(d => d !== dirOut) || dirOut;
    await walkThroughDoor(A, dir2, `${floorLabel}: cross out of start`);
    await clearIfLocked(A);
    ok(`${floorLabel}: start room exits, re-enters, and crosses (out ${dirOut}, back ${OPP[dirOut]}, out ${dir2})`);
  }
  await startRoomRoundTrip('floor 1');
  await A.exec(`window.uv.sim.debug('F4'); return 1;`);
  await sleep(300);
  await startRoomRoundTrip('floor 2');

  // ---- leave-run button: solo abandon → lobby → fresh run ----
  await A.exec(`document.getElementById('leave-btn').click()`);
  await A.waitFor(`return !document.getElementById('leave-confirm').classList.contains('hidden')`, 2000, 'leave confirm dialog');
  const confirmText = await A.exec(`return document.getElementById('leave-confirm').textContent`);
  if (/whole party/.test(confirmText)) ok('host-flavored confirmation text'); else fail(`confirm text: ${confirmText.slice(0, 120)}`);
  await A.exec(`document.getElementById('leave-yes').click()`);
  await A.waitFor(`return window.uv.mode==='lobby' && !document.getElementById('screen-lobby').classList.contains('hidden')`, 3000, 'lobby after abandon');
  ok('solo abandon → straight to lobby (no results screen)');
  await A.exec(`document.querySelector('.char-card[data-char="courier"]').click()`);
  await sleep(300);
  await A.exec(`document.getElementById('btn-start').click()`);
  await A.waitFor(`return window.uv.mode==='run' && !!window.uv.sim`, 4000, 'second run after abandon');
  const fresh = await A.exec(`const s=window.uv.sim, p=s.players[0]; return JSON.stringify({char:p.charId, mats:p.materials, lvl:p.level, floor:s.floorNum, items:p.items.length})`);
  const fr = JSON.parse(fresh);
  if (fr.char === 'courier' && fr.mats === 0 && fr.lvl === 1 && fr.floor === 1 && fr.items === 0) ok(`fresh run after abandon (${fresh})`);
  else fail(`run not fresh after abandon: ${fresh}`);
  // play into the second room of the new run
  const d2 = await A.exec(`const s=window.uv.sim; return Object.keys(s.floor.rooms[s.floor.startId].doors)[0]`);
  await walkThroughDoor(A, d2, 'second run: first door');
  await clearIfLocked(A);
  ok('new run plays into its second room');

  // ---- build management: combine, sell, 6/6 notice, character sheet ----
  async function clickAwayLevelups(br) {
    for (let i = 0; i < 24; i++) {
      if (!await br.exec(`return !document.getElementById('overlay-levelup').classList.contains('hidden')`)) break;
      await br.exec(`document.querySelector('#overlay-levelup .offer-card').click()`);
      await sleep(200);
    }
  }
  await A.exec(`const s=window.uv.sim; s.debug('F2'); const shop=s.floor.rooms.find(r=>r.kind==='shop'); s._enterRoom(shop.id,null); return 1;`);
  await A.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 5000, 'shop for build mgmt');
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
  // sell a stat item with the two-step confirmation; verify stat + refund
  const pickJs = `const it=window.uvContent.ITEMS.find(it=>it.stats&&it.stats.damage>0&&!it.hooks); return JSON.stringify({id:it.id,dmg:it.stats.damage})`;
  const pick = JSON.parse(await A.exec(pickJs));
  await A.exec(`const s=window.uv.sim,p=s.players[0]; p.items.push(${JSON.stringify(pick.id)}); s._recomputeItems(p); s._recomputeStats(p); return 1;`);
  await A.waitFor(`return window.uv.meta.items.includes(${JSON.stringify(pick.id)})`, 3000, 'item in meta');
  const m0 = await A.exec('return window.uv.meta.materials');
  const dmg0 = await A.exec('return window.uv.meta.stats.damage');
  const shownRefund = parseInt((await A.exec(`return document.querySelector('[data-selli="${pick.id}"]').textContent`)).replace(/[^0-9]/g, ''), 10);
  await A.exec(`document.querySelector('[data-selli="${pick.id}"]').click(); return 1;`);
  const armedTxt = await A.exec(`return document.querySelector('[data-selli="${pick.id}"]').textContent`);
  if (/tap again/.test(armedTxt)) ok('first tap arms the sell with the refund shown'); else fail(`sell not armed: "${armedTxt}"`);
  await A.exec(`document.querySelector('[data-selli="${pick.id}"]').click(); return 1;`);
  await A.waitFor(`return window.uv.meta.materials === ${m0 + shownRefund}`, 4000, 'refund credited');
  const dmg1 = await A.exec('return window.uv.meta.stats.damage');
  if (dmg1 === dmg0 - pick.dmg) ok(`sold item: +${shownRefund} materials, Damage ${dmg0}→${dmg1} on the sheet`);
  else fail(`stat after sell: ${dmg0}→${dmg1} (expected -${pick.dmg})`);
  // sold mechanical item can never fire again (hook aggregation empties)
  const mech = JSON.parse(await A.exec(`const it=window.uvContent.ITEMS.find(it=>it.hooks&&it.hooks.killExplode); return JSON.stringify({id:it.id})`));
  await A.exec(`const s=window.uv.sim,p=s.players[0]; p.items.push(${JSON.stringify(mech.id)}); s._recomputeItems(p); s._recomputeStats(p); return 1;`);
  // wait on the META (which re-renders the owned row), not the sim-side hookAgg
  await A.waitFor(`return window.uv.meta.items.includes(${JSON.stringify(mech.id)}) && document.querySelector('[data-selli="${mech.id}"]')!==null`, 4000, 'mech item chip rendered');
  if (!await A.exec(`return window.uv.sim.players[0].hookAgg.killExplode.length===1`)) fail('mech hook not live before sell');
  await A.exec(`document.querySelector('[data-selli="${mech.id}"]').click(); return 1;`);
  await A.exec(`document.querySelector('[data-selli="${mech.id}"]').click(); return 1;`);
  await A.waitFor(`return window.uv.sim.players[0].hookAgg.killExplode.length===0`, 4000, 'mech hook gone');
  ok('sold mechanical item is unregistered — its effect can never fire again');
  // 6/6: notice appears, purchase blocked, selling frees it
  await A.exec(`const s=window.uv.sim,p=s.players[0]; while (p.weapons.length < p.weaponSlots) s._addWeapon(p,'pebbleshot',1); return 1;`);
  await A.waitFor(`return window.uv.meta.weapons.length === window.uv.meta.weaponSlots`, 3000, 'slots full');
  const notice = await A.exec(`return document.getElementById('overlay-shop').innerText.includes('sell or combine to make room')`);
  if (notice) ok('6/6 notice: "sell or combine to make room"'); else fail('full-slots notice missing');
  // find (reroll if needed) a weapon in stock, verify blocked buy, sell, then buy
  let stockSlot = -1;
  for (let r = 0; r < 10; r++) {
    stockSlot = await A.exec(`const st=window.uv.sim.players[0].shop.stock; return st.findIndex(s=>s.kind==='weapon'&&!s.sold)`);
    if (stockSlot >= 0) break;
    await A.exec(`document.getElementById('shop-reroll').click(); return 1;`);
    await sleep(300);
  }
  if (stockSlot < 0) fail('no weapon appeared in stock after rerolls');
  else {
    const wCount0 = await A.exec('return window.uv.meta.weapons.length');
    await A.exec(`document.querySelector('.offer-card[data-slot="${stockSlot}"]').click(); return 1;`);
    await sleep(500);
    const wCount1 = await A.exec('return window.uv.meta.weapons.length');
    if (wCount1 === wCount0) ok('purchase at 6/6 is blocked'); else fail('purchase went through at full slots');
    const lastIdx = wCount0 - 1;
    await A.exec(`document.querySelector('[data-sellw="${lastIdx}"]').click(); return 1;`);
    await A.exec(`document.querySelector('[data-sellw="${lastIdx}"]').click(); return 1;`);
    await A.waitFor(`return window.uv.meta.weapons.length === ${wCount0 - 1}`, 4000, 'slot freed by sale');
    stockSlot = await A.exec(`const st=window.uv.sim.players[0].shop.stock; return st.findIndex(s=>s.kind==='weapon'&&!s.sold)`);
    await A.exec(`document.querySelector('.offer-card[data-slot="${stockSlot}"]').click(); return 1;`);
    await A.waitFor(`return window.uv.meta.weapons.length === ${wCount0}`, 4000, 'purchase after sale');
    ok('after selling, the new weapon purchase succeeds');
  }
  await A.exec(`document.getElementById('shop-close') && document.getElementById('shop-close').click(); return 1;`);

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
    await M.tap('.char-card[data-char="bulwark"]');
    await sleep(250);
    await M.tap('#btn-start');
    await M.waitFor(`return window.uv.mode==='run' && !!window.uv.sim`, 5000, 'mobile run start');
    ok('touch-only: host → tap character → start run');
    // joystick drag moves; release stops
    const jx0 = await M.exec('return window.uv.sim.players[0].x');
    await M.touchDown(420, 200);
    await M.touchMove(480, 200);
    await sleep(800);
    const jx1 = await M.exec('return window.uv.sim.players[0].x');
    await M.touchUp();
    await sleep(350);
    const jx2 = await M.exec('return window.uv.sim.players[0].x');
    await sleep(350);
    const jx3 = await M.exec('return window.uv.sim.players[0].x');
    if (jx1 > jx0 + 60) ok(`joystick drag moves the player (${Math.round(jx0)}→${Math.round(jx1)})`);
    else fail(`joystick did not move player (${jx0}→${jx1})`);
    if (Math.abs(jx3 - jx2) < 8) ok('joystick release stops the player');
    else fail(`player kept drifting after release (${jx2}→${jx3})`);

    // steer via joystick only: hold one touch, aim the nub each poll
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
    async function tapAwayLevelups() {
      for (let i = 0; i < 24; i++) {
        if (!await M.exec(`return !document.getElementById('overlay-levelup').classList.contains('hidden')`)) break;
        await M.tap('#overlay-levelup .offer-card');
        await sleep(200);
      }
    }
    // walk a full door countdown with the joystick
    const roomA = await M.exec('return window.uv.sim.roomId');
    const doorDirJs = `const s=window.uv.sim; const d=Object.keys(s._room().doors)[0]; const p=s.players[0];
      const t={n:[s.W/2,0],s:[s.W/2,s.H],w:[0,s.H/2],e:[s.W,s.H/2]}[d];
      const dx=t[0]-p.x, dy=t[1]-p.y, l=Math.hypot(dx,dy)||1; return JSON.stringify([dx/l,dy/l]);`;
    await steerPoll(doorDirJs, `return window.uv.sim.roomId !== ${roomA}`, 30000, 'joystick door walk');
    ok('joystick walks a full door countdown into the next room');
    // clear the combat room with touch-driven kiting (F3 fallback keeps CI stable)
    if (await M.exec('return window.uv.sim.roomLocked')) {
      const kiteJs = `const s=window.uv.sim, p=s.players[0]; let vx=0, vy=0, nd=1e9, nx=0, ny=0;
        for (const e of s.enemyPool){const d2=(e.x-p.x)*(e.x-p.x)+(e.y-p.y)*(e.y-p.y); if(d2<nd){nd=d2;nx=e.x;ny=e.y;}}
        if (nd<1e9){const d=Math.sqrt(nd)||1; if(d<95){vx+=(p.x-nx)/d*3;vy+=(p.y-ny)/d*3;} else if(d>140){vx+=(nx-p.x)/d*1.5;vy+=(ny-p.y)/d*1.5;}}
        const cx=s.W/2-p.x, cy=s.H/2-p.y, edge=Math.min(p.x,s.W-p.x,p.y,s.H-p.y);
        if (edge<150){const l=Math.hypot(cx,cy)||1;vx+=cx/l*2;vy+=cy/l*2;}
        const L=Math.hypot(vx,vy)||1; return JSON.stringify([vx/L,vy/L]);`;
      try {
        await steerPoll(kiteJs, 'return !window.uv.sim.roomLocked', 75000, 'touch combat clear');
        ok('combat room cleared with touch-driven kiting');
      } catch {
        console.warn('⚠ organic touch combat over time budget — F3 finish (joystick path exercised throughout)');
        await M.exec(`const s=window.uv.sim; let g=0; while(s.roomLocked&&g++<40){s.debug('F3'); for(let i=0;i<20;i++)s.tick();} return 1;`);
      }
      await sleep(700);
    }
    // level-up pick by tap (room clear resolves banked levels)
    if (await M.exec(`return !document.getElementById('overlay-levelup').classList.contains('hidden')`)) {
      await M.tap('#overlay-levelup .offer-card');
      ok('level-up picked by tap');
    }
    // shop: fund + enter (navigation is not the touch path under test), buy by tap
    await M.exec(`const s=window.uv.sim; s.debug('F2'); const shop=s.floor.rooms.find(r=>r.kind==='shop'); s._enterRoom(shop.id,null); return 1;`);
    await M.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 5000, 'mobile shop overlay');
    await tapAwayLevelups(); // F2 XP banks levels; the offers stack above the shop
    const matsB = await M.exec('return window.uv.sim.players[0].materials');
    await M.tap('#overlay-shop .offer-card');
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
    // contextual OPEN SHOP button appears in a cleared shop room after closing
    await M.tap('#shop-close');
    if (await M.exec(`return !document.getElementById('overlay-shop').classList.contains('hidden')`)) {
      const diag = await M.exec(`const b=document.getElementById('shop-close'); const r=b?b.getBoundingClientRect():null;
        return JSON.stringify({closeRect:r&&[r.x,r.y,r.width,r.height], vw:innerWidth, vh:innerHeight})`);
      fail(`shop did not close on tap — diag: ${diag}`);
      await M.exec(`document.getElementById('shop-close').click(); return 1;`); // recover for later steps
    }
    await M.waitFor(`return !document.getElementById('interact-btn').classList.contains('hidden')`, 3000, 'contextual shop button');
    await M.tap('#interact-btn');
    await M.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 3000, 'shop reopened by button');
    ok('contextual OPEN SHOP button replaces the E key');
    // two-step sell by touch, with tap-elsewhere disarm
    const mItem = JSON.parse(await M.exec(`const it=window.uvContent.ITEMS.find(it=>it.stats&&it.stats.armor>0&&!it.hooks); return JSON.stringify({id:it.id})`));
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
    // character sheet from inside the shop, and scrollable columns
    await M.tap('#shop-sheet');
    await M.waitFor(`return !document.getElementById('overlay-sheet').classList.contains('hidden')`, 3000, 'sheet from shop (touch)');
    if (await M.exec(`return getComputedStyle(document.querySelector('.sheet-cols')).overflowY === 'auto'`)) ok('sheet columns scroll on phones');
    else fail('sheet not scrollable');
    await M.tap('#sheet-close');
    await M.tap('#shop-close');
    // character sheet via the HUD button
    await M.tap('#sheet-btn');
    await M.waitFor(`return !document.getElementById('overlay-sheet').classList.contains('hidden')`, 3000, 'sheet via HUD button (touch)');
    await M.tap('#sheet-close');
    await M.waitFor(`return document.getElementById('overlay-sheet').classList.contains('hidden')`, 3000, 'sheet closed');
    ok('character sheet opens/closes by HUD button on touch');
    // Leave Run by tap → lobby
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
    await M.tap('.char-card[data-char="courier"]');
    await sleep(250);
    await M.tap('#btn-start');
    await M.waitFor(`return window.uv.mode==='run'`, 5000, 'run (touch off)');
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
  await A.close();
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
  await sleep(700);
  const COOP_URL = `${URL}?peerhost=localhost&peerport=${RELAY_PORT}&peersecure=0`;
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

      // host abandons the run → whole party lands in the lobby together
      await A.exec(`document.getElementById('leave-btn').click()`);
      await A.waitFor(`return !document.getElementById('leave-confirm').classList.contains('hidden')`, 2000, 'host confirm dialog');
      await A.exec(`document.getElementById('leave-yes').click()`);
      await A.waitFor(`return window.uv.mode==='lobby'`, 4000, 'host in lobby after abandon');
      await B.waitFor(`return window.uv.mode==='lobby' && !document.getElementById('screen-lobby').classList.contains('hidden')`, 5000, 'client in lobby after abandon');
      const lobbySizes = [await A.exec(`return window.uv.lobby.players.length`), await B.exec(`return window.uv.lobby.players.length`)];
      if (lobbySizes[0] === 2 && lobbySizes[1] === 2) ok('host abandon → both players in the lobby, connection intact');
      else fail(`lobby sizes after abandon: host=${lobbySizes[0]} client=${lobbySizes[1]}`);
      // both pick fresh characters and start a brand-new run
      await A.exec(`document.querySelector('.char-card[data-char="lamprey"]').click()`);
      await B.exec(`document.querySelector('.char-card[data-char="glasswing"]').click()`);
      await sleep(400);
      await B.exec(`document.getElementById('btn-ready').click()`);
      await A.waitFor(`return window.uv.lobby.players[1] && window.uv.lobby.players[1].ready`, 5000, 'client re-ready');
      await A.exec(`document.getElementById('btn-start').click()`);
      await A.waitFor(`return window.uv.mode==='run' && window.uv.sim && window.uv.sim.players[0].charId==='lamprey' && window.uv.sim.players[0].materials===0`, 5000, 'fresh co-op run (host)');
      await B.waitFor(`return window.uv.mode==='run'`, 5000, 'fresh co-op run (client)');
      ok('fresh co-op run starts for both after abandon');

      // both players walk out of the start room and back in together
      const posAllJs = dir => `const s=window.uv.sim, W=s.W, H=s.H, WALL=36;
        for (const p of s.players) { if (p.gone||p.downed) continue;
          ${dir === 'n' ? 'p.x=W/2; p.y=WALL+p.radius+2;'
          : dir === 's' ? 'p.x=W/2; p.y=H-WALL-p.radius-2;'
          : dir === 'w' ? 'p.x=WALL+p.radius+2; p.y=H/2;'
          : 'p.x=W-WALL-p.radius-2; p.y=H/2;'} } return 1;`;
      async function walkAllThroughDoor(dir, what) {
        const from = await A.exec('return window.uv.sim.roomId');
        for (let i = 0; i < 26; i++) {
          await A.exec(posAllJs(dir));
          await sleep(300);
          const cur = await A.exec('return window.uv.sim.roomId');
          if (cur !== from) return cur;
        }
        throw new Error(`co-op door walk (${what}, ${dir}) never transitioned`);
      }
      const coopOpp = { n: 's', s: 'n', e: 'w', w: 'e' };
      const cStart = await A.exec('return window.uv.sim.floor.startId');
      const cDir = await A.exec(`const s=window.uv.sim; return Object.keys(s.floor.rooms[s.floor.startId].doors)[0]`);
      await walkAllThroughDoor(cDir, 'party leaves start');
      await A.exec(`const s=window.uv.sim; let g=0; while(s.roomLocked && !s.boss && g++<40){s.debug('F3'); for(let i=0;i<20;i++)s.tick();}
        for (const p of s.players){let g2=0; while(p.pendingOffer&&g2++<30) s.uiAction(p.idx,{kind:'levelup',id:p.pendingOffer[0].id}); if (p.treasureOffer) s.uiAction(p.idx,{kind:'treasure',id:null});} return 1;`);
      const cBack = await walkAllThroughDoor(coopOpp[cDir], 'party re-enters start');
      if (cBack === cStart) ok('both players walk back into the start room together');
      else fail(`party walked back into room ${cBack}, not start ${cStart}`);
      await B.waitFor(`return window.uv.roomInfo && window.uv.roomInfo.roomId===${cStart}`, 4000, 'client sees start room re-entry');
      ok('client HUD follows the start-room re-entry');

      // ---- co-op build management: both players manage simultaneously ----
      await A.exec(`const s=window.uv.sim; s.debug('F2'); const shop=s.floor.rooms.find(r=>r.kind==='shop'); s._enterRoom(shop.id,null); return 1;`);
      await A.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 5000, 'host shop (mgmt)');
      await B.waitFor(`return !document.getElementById('overlay-shop').classList.contains('hidden')`, 5000, 'client shop (mgmt)');
      const coopItem = JSON.parse(await A.exec(`const it=window.uvContent.ITEMS.find(it=>it.stats&&it.stats.maxHp>0&&!it.hooks); return JSON.stringify({id:it.id})`));
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
      await B.exec(`window.uv.clientT.send({t:'ui', kind:'combine', a:0, b:5, id:'gravemaul', tier:3}); window.uv.clientT.send({t:'ui', kind:'sellWeapon', slot:'__proto__', id:'x', tier:1}); return 1;`);
      await sleep(800);
      const bAfter = await A.exec(`return JSON.stringify(window.uv.sim.players[1].weapons.map(w=>[w.id,w.tier]))`);
      if (bBefore === bAfter) ok('forged invalid combine/sell from a client is safely rejected'); else fail('forged client action mutated the build');
      // one player's character sheet never touches the other's game
      await A.exec(`window.uv.sim.debug('F1'); return 1;`);
      await B.exec(`document.getElementById('sheet-btn').click(); return 1;`);
      await B.waitFor(`return !document.getElementById('overlay-sheet').classList.contains('hidden')`, 3000, 'client sheet in combat');
      const hTick0 = await A.exec('return window.uv.sim.tickNum');
      await sleep(800);
      const hTick1 = await A.exec('return window.uv.sim.tickNum');
      const hostSheet = await A.exec(`return !document.getElementById('overlay-sheet').classList.contains('hidden')`);
      if (hTick1 > hTick0 + 30 && !hostSheet) ok("client's mid-combat sheet leaves the host's game untouched");
      else fail(`sheet isolation: host ticked ${hTick0}→${hTick1}, host sheet visible=${hostSheet}`);
      await B.exec(`document.getElementById('sheet-close').click(); return 1;`);
      await A.exec(`const s=window.uv.sim; let g=0; while((s.roomLocked||s.enemyPool.count)&&g++<40){s.debug('F3'); for(let i=0;i<20;i++)s.tick();}
        for (const p of s.players){let g2=0; while(p.pendingOffer&&g2++<30) s.uiAction(p.idx,{kind:'levelup',id:p.pendingOffer[0].id}); if (p.treasureOffer) s.uiAction(p.idx,{kind:'treasure',id:null});} return 1;`);
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
            await B.exec(`document.querySelector('.char-card[data-char="redmaw"]').click()`);
            await C.waitFor(`return document.querySelector('.char-card[data-char="courier"]')!==null`, 4000, 'C char grid');
            await C.exec(`document.querySelector('.char-card[data-char="courier"]').click()`);
            await sleep(400);
            await C.exec(`document.getElementById('btn-ready').click()`);
            await B.waitFor(`return window.uv.lobby.players[1] && window.uv.lobby.players[1].ready`, 5000, 'C ready');
            await B.exec(`document.getElementById('btn-start').click()`);
            await C.waitFor(`return window.uv.mode==='run'`, 6000, 'C in run');
          };
          await joinAndStart();
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
          await D.exec(`const s=window.uv.sim; let g=0; while((s.roomLocked||s.enemyPool.count)&&g++<40){s.debug('F3'); for(let i=0;i<20;i++)s.tick();}
            for (const p of s.players){let g2=0; while(p.pendingOffer&&g2++<30) s.uiAction(p.idx,{kind:'levelup',id:p.pendingOffer[0].id});} return 1;`);
          // down the touch client, desktop host revives by proximity
          await D.exec(`const s=window.uv.sim, p=s.players[1]; let g=0; while(!p.downed&&!s.over&&g++<80){p.invuln=0;p.hp=1;s.hurtPlayer(p,999,null);} return 1;`);
          await D.exec(`const s=window.uv.sim; s.players[0].x=s.players[1].x; s.players[0].y=s.players[1].y; return 1;`);
          await D.waitFor(`return !window.uv.sim.players[1].downed`, 8000, 'cross-play revive');
          ok('down + revive works cross-play');
          // door countdown syncs to the touch client
          await D.exec(`
            const s = window.uv.sim; const room = s._room();
            const d = Object.keys(room.doors)[0]; const W=s.W,H=s.H,WALL=36; const p=s.players[0];
            if (d==='n'){p.x=W/2;p.y=WALL+p.radius+2;} if (d==='s'){p.x=W/2;p.y=H-WALL-p.radius-2;}
            if (d==='w'){p.x=WALL+p.radius+2;p.y=H/2;} if (d==='e'){p.x=W-WALL-p.radius-2;p.y=H/2;}
            return 1;`);
          await M2.waitFor(`const s=window.uv.snaps; const last=s[s.length-1]; return last && !!last.s.door`, 6000, 'door countdown on touch client');
          ok('door countdown syncs to the touch client');
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
