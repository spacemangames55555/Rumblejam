// Shared Chromium/CDP driver for the small focused co-op instruments
// (tools/room_reg_test.mjs, tools/uiack_test.mjs).
//
// tools/browser_test.mjs has its own, larger Browser class and does not export
// it. These tools want a fraction of it — navigate, evaluate, read the console
// — plus the local signalling relay and a static server, and they want to be
// startable in a second rather than after a full suite. Two copies of a CDP
// driver was already one too many.

import { spawn } from 'child_process';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const CHROME = '/opt/pw-browsers/chromium';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// The CDN is unreachable from the sandbox, and a CDN miss is not what any of
// these tools are testing — so PeerJS is served from a local copy or the tool
// declines to run rather than measuring the wrong failure.
export function loadPeerjs(pathOverride) {
  const p = pathOverride || process.env.PEERJS_LOCAL || '/tmp/peerjs.min.js';
  try { return readFileSync(p).toString('base64'); } catch { return null; }
}

export class Page {
  constructor(label, debugPort, peerjsB64) {
    this.label = label;
    this.port = debugPort;
    this.peerjsB64 = peerjsB64;
    this.lines = [];
    this.msgId = 0;
    this.pending = new Map();
  }

  async open() {
    // HARDCODED CDP PORTS WERE A SILENT HANG. room_reg_test / uiack_test /
    // skillscreen_test each pinned a fixed --remote-debugging-port (9711,
    // 9741/9742, 9755). A prior run killed by timeout left Chromium holding
    // that port; the next open() then attached to the orphan (or waited on a
    // wedged /json/list) and printed nothing — the "quiet machine" hang on
    // cursor/horde-pace-map1. Pace-branch benches make those leftovers more
    // common. Always bind an ephemeral port (0) and read it back from
    // DevToolsActivePort so two tools can never collide, and kill the child
    // on process exit so a timeout cannot leave the next run wedged.
    this.profile = mkdtempSync(path.join(tmpdir(), 'uvcdp-'));
    this.proc = spawn(CHROME, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--remote-debugging-port=0', `--user-data-dir=${this.profile}`,
      '--window-size=1280,800', '--mute-audio', 'about:blank',
    ], { stdio: 'ignore' });
    const reap = () => this.close();
    this._reapExit = reap;
    process.on('exit', reap);
    let port = 0;
    for (let i = 0; i < 60 && !port; i++) {
      await sleep(250);
      try {
        const active = readFileSync(path.join(this.profile, 'DevToolsActivePort'), 'utf8').trim().split(/\r?\n/);
        port = parseInt(active[0], 10) || 0;
      } catch { /* not up yet */ }
    }
    if (!port) throw new Error(`[${this.label}] chromium DevToolsActivePort never appeared`);
    this.port = port;
    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json();
        target = list.find(t => t.type === 'page');
      } catch { /* not up yet */ }
      if (!target) await sleep(100);
    }
    if (!target) throw new Error(`[${this.label}] chromium page target never came up on :${this.port}`);
    this.ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = e => this._onMsg(JSON.parse(e.data));
    await this.cdp('Runtime.enable');
    await this.cdp('Page.enable');
    if (this.peerjsB64) await this.cdp('Fetch.enable', { patterns: [{ urlPattern: '*unpkg.com*' }] });
    return this;
  }

  _onMsg(m) {
    if (m.id && this.pending.has(m.id)) {
      const { res, rej } = this.pending.get(m.id);
      this.pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
      return;
    }
    if (m.method === 'Fetch.requestPaused') {
      this.cdp('Fetch.fulfillRequest', {
        requestId: m.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' },
          { name: 'Access-Control-Allow-Origin', value: '*' }],
        body: this.peerjsB64,
      }).catch(() => {});
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      const line = m.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      this.lines.push(line);
      // net.js diagnostics go to stdout, not into an array nobody prints
      if (/^\[net\]/.test(line)) console.error(`  [${this.label}] ${line}`);
    }
  }

  cdp(method, params = {}) {
    const id = ++this.msgId;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async goto(url) {
    await this.cdp('Page.navigate', { url });
    for (let i = 0; i < 80; i++) {
      await sleep(150);
      const r = await this.exec(`return document.readyState === 'complete' ? '1' : ''`).catch(() => '');
      if (r) return;
    }
    throw new Error(`[${this.label}] page never finished loading: ${url}`);
  }

  // 90s ceiling: far above anything under test, so a hit here means "hung",
  // never "the tool got bored". Reporting a timeout as a failure of the thing
  // being measured is the mistake these tools exist to stop making.
  async exec(src) {
    const r = await this.cdp('Runtime.evaluate', {
      expression: `(async()=>{${src}})()`, awaitPromise: true, returnByValue: true, timeout: 90000,
    });
    if (r.exceptionDetails) throw new Error(`[${this.label}] ${r.exceptionDetails.text} ${JSON.stringify(r.result && r.result.value)}`);
    return r.result.value;
  }

  async waitFor(src, ms, what) {
    const t0 = Date.now();
    for (;;) {
      const v = await this.exec(src).catch(() => null);
      if (v) return v;
      if (Date.now() - t0 > ms) throw new Error(`[${this.label}] timeout after ${ms}ms waiting for ${what}`);
      await sleep(100);
    }
  }

  close() {
    if (this._reapExit) {
      try { process.off('exit', this._reapExit); } catch { /* node < off */ }
      this._reapExit = null;
    }
    try { this.ws && this.ws.close(); } catch { /* gone */ }
    try { this.proc && this.proc.kill('SIGKILL'); } catch { /* gone */ }
  }
}

// STARTING A RUN IS TWO CLICKS NOW, AND EVERY BROWSER SUITE MADE ONE.
//
// `#btn-start` used to construct the Sim directly. It now opens the WORLD MAP,
// because a run has to be a run of somewhere — and twenty call sites across
// three suites clicked the button, waited for `window.uv.sim`, and timed out.
// One helper rather than twenty edits: the sequence is a property of the shell,
// not of any one test.
//
// THE SECOND CLICK IS `#world-enter`, NOT `.world-card`. The card was the
// dossier's old shape. The live control is a `.world-pin` plus the enter
// button `paintDossier` writes for the selected region. Clicking the removed
// card threw "no region N card" on every suite that starts a run, so none of
// them ever reached a fight. `browser_test.mjs` has its own copy of this
// helper and it has to move with this one.
//
// A pin's first click only arms it (js/ui/worldmap.js). The frontier pin is
// already selected, and the dossier is already painted, so clicking it again
// would enter on its own. Only an unselected pin is clicked. `#world-enter`
// starts the run; a disabled button is a region this character cannot enter.
// `.world-card` stays as a fallback for the old grid, where one click on the
// card was the whole enter. The live atlas has no cards.
//
// `regionIndex` defaults to 1 because that is the only region a fresh
// character may enter, and every browser suite starts from a fresh profile.
export async function startRun(P, regionIndex = 1) {
  await P.exec(`document.getElementById('btn-start').click(); return 1;`);
  await P.waitFor(`return document.getElementById('screen-world') && !document.getElementById('screen-world').classList.contains('hidden') ? 1 : 0`, 8000, 'world map');
  await P.exec(`
    const idx = ${regionIndex | 0};
    const card = document.querySelector('.world-card[data-region="' + idx + '"]');
    if (card) { card.click(); return 1; }
    const pin = document.querySelector('.world-pin[data-region="' + idx + '"]');
    if (!pin) throw new Error('no region ' + idx + ' pin');
    if (!pin.classList.contains('selected')) pin.click();
    const enter = document.getElementById('world-enter');
    if (!enter || enter.disabled) throw new Error('region ' + idx + ' is not enterable');
    enter.click();
    return 1;
  `);
  return P.waitFor(`return window.uv.mode==='run' ? 1 : 0`, 12000, `region ${regionIndex} run started`);
}

export function bootHttpd(port) {
  const httpd = spawn('python3', ['-m', 'http.server', String(port)], { cwd: process.cwd(), stdio: 'ignore' });
  process.on('exit', () => httpd.kill());
  return httpd;
}

// PROBED, NOT SLEPT ON. A blind wait races a slow start and then reports the
// race as whatever the tool was actually trying to measure.
export async function bootRelay(basePort) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const port = basePort + attempt * 7;
    const relay = spawn('node', ['tools/peer_relay.mjs', String(port)], { stdio: 'ignore' });
    process.on('exit', () => relay.kill());
    for (let i = 0; i < 24; i++) {
      await sleep(250);
      try {
        const r = await fetch(`http://localhost:${port}/peerjs/id`);
        if (r.ok) return { port, proc: relay };
      } catch { /* not yet */ }
    }
    relay.kill();
  }
  return null;
}
