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
    const profile = mkdtempSync(path.join(tmpdir(), 'uvcdp-'));
    this.proc = spawn(CHROME, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      `--remote-debugging-port=${this.port}`, `--user-data-dir=${profile}`,
      '--window-size=1280,800', '--mute-audio', 'about:blank',
    ], { stdio: 'ignore' });
    let target = null;
    for (let i = 0; i < 60 && !target; i++) {
      await sleep(250);
      try {
        const list = await (await fetch(`http://localhost:${this.port}/json/list`)).json();
        target = list.find(t => t.type === 'page');
      } catch { /* not up yet */ }
    }
    if (!target) throw new Error(`[${this.label}] chromium devtools endpoint never came up`);
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

  close() { try { this.proc.kill(); } catch { /* gone */ } }
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
