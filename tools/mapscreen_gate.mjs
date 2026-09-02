// NO TWO NODE BUTTONS MAY OVERLAP — asserted in a real browser, at the
// viewports players actually hold.
//
// WHY THIS EXISTS. The atlas node map places buttons at percent positions
// along a fixed polyline (`campaignPlace`, js/content/mapgeo.js) with no
// collision avoidance. At 1280x720 that put one pair of region 2's buttons on
// top of each other on every seed tried; at 844x390 it put ten pairs, one of
// them covering 41% of its neighbour, and `document.elementFromPoint` at one
// node's own centre returned a DIFFERENT node — a tap on the middle of Cursed
// selecting Breach. The column layout it replaced measures zero overlaps at
// every size, because flexbox spaces it by construction.
//
// WHAT IT ASSERTS, AND WHY IN A BROWSER. Two things a pure-node test cannot
// reach: the buttons' REAL boxes (their width follows their label and the
// stylesheet, not a number restated here), and the hit test the browser will
// actually run when a thumb lands. So it boots Chromium, drives
// `showMapScreen` with a generated tree, and reads `getBoundingClientRect` and
// `elementFromPoint` off the live DOM.
//
// It also asserts the module's own fit test agrees with what got rendered —
// `campaignFits` returning true while the DOM overlaps would mean the
// predicate had drifted from the CSS, which is the failure mode the whole
// arrangement exists to prevent.
//
//   node tools/mapscreen_gate.mjs [--seeds N]
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { REGIONS } from '../js/regions.js';

// The three viewports the defect was measured at: a phone in each orientation
// and the desktop window where it first showed. Not a sample — these are the
// sizes that failed.
const VIEWPORTS = [
  [390, 844, 'phone portrait'],
  [844, 390, 'phone landscape'],
  [1280, 720, 'desktop window'],
];
const SEEDS = (() => {
  const i = process.argv.indexOf('--seeds');
  return i > 0 ? Math.max(1, parseInt(process.argv[i + 1], 10) || 6) : 6;
})();

const PORT = 8600 + (process.pid % 89), DBG = 9600 + (process.pid % 89);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let checks = 0, fails = 0;
const ok = m => { checks++; console.log(`✓ ${m}`); };
const bad = m => { checks++; fails++; console.log(`✗ ${m}`); };

// The probe page. Written into the repo root because the module graph is
// site-relative, and removed in the finally block.
const PROBE = 'mapscreen_gate_probe.html';
writeFileSync(PROBE, `<!doctype html><meta charset=utf-8><title>mapscreen gate</title>
<link rel=stylesheet href="css/style.css">
<div id="screen-map" class="screen hidden"></div>
<script type=module>
import { initMapScreen, showMapScreen, campaignFits } from './js/ui/mapscreen.js';
import { generateTree } from './js/nodetree.js';
import { REGIONS } from './js/regions.js';
import { geoFor } from './js/content/mapgeo.js';

window.probe = async (regionIndex, seed) => {
  const region = REGIONS.find(r => r.index === regionIndex);
  const layout = generateTree(seed, region, 0);
  initMapScreen({ pickNode() {}, reopenShop() {} });
  showMapScreen({
    layout, visited: [], reachable: layout.startIds.slice(), current: null,
    vote: null, regionIndex, regionName: region.name || region.id, onShop: false,
  });
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const el = document.getElementById('screen-map');
  const btns = [...el.querySelectorAll('.map-node')].map(b => {
    const r = b.getBoundingClientRect();
    return { id: b.dataset.node, kind: [...b.classList].find(c => c.startsWith('mn-')).slice(3),
             x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });

  const overlaps = [];
  for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
    const a = btns[i], b = btns[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 0 && oy > 0) overlaps.push(\`\${a.id}/\${a.kind} x \${b.id}/\${b.kind} by \${ox.toFixed(0)}x\${oy.toFixed(0)}px\`);
  }

  // The hit test the browser will run under a thumb. Two different answers
  // hide behind one null-ish result and must not be conflated: a node COVERED
  // by a neighbour is the overlap defect (the tap picks the wrong map), while
  // a node simply outside the viewport is the column layout being wider than a
  // portrait phone — a scroll away, not a wrong tap.
  const stolen = [], offscreen = [];
  for (const b of btns) {
    if (b.cx < 0 || b.cx > innerWidth || b.cy < 0 || b.cy > innerHeight) { offscreen.push(b); continue; }
    const hit = document.elementFromPoint(b.cx, b.cy);
    const owner = hit && hit.closest ? hit.closest('.map-node') : null;
    if (owner && owner.dataset.node !== b.id) stolen.push(\`\${b.id}/\${b.kind} -> node \${owner.dataset.node}\`);
    else if (!owner) stolen.push(\`\${b.id}/\${b.kind} -> nothing, on screen\`);
  }

  // Anything off screen has to be REACHABLE, or it is a map node the player
  // cannot pick. The scroller is the panel; a surface that overflows must also
  // permit the pan that reaches it, which touch-action decides.
  const scroller = el.querySelector('.map-panel') || el.querySelector('.map-stage');
  const unreachable = [];
  if (offscreen.length) {
    if (!scroller) unreachable.push(...offscreen.map(b => \`\${b.id}/\${b.kind} (no scroller)\`));
    else {
      const ta = getComputedStyle(scroller).touchAction;
      const pansX = ta === 'auto' || ta === 'manipulation' || ta.includes('pan-x');
      if (!pansX && scroller.scrollWidth > scroller.clientWidth) {
        unreachable.push(...offscreen.map(b => \`\${b.id}/\${b.kind} (touch-action: \${ta} blocks the pan)\`));
      } else {
        const x0 = scroller.scrollLeft, y0 = scroller.scrollTop;
        for (const b of offscreen) {
          scroller.scrollLeft = scroller.scrollWidth;
          scroller.scrollTop = scroller.scrollHeight;
          const node = el.querySelector(\`.map-node[data-node="\${b.id}"]\`);
          node.scrollIntoView({ block: 'center', inline: 'center' });
          const r2 = node.getBoundingClientRect();
          const cx = r2.x + r2.width / 2, cy = r2.y + r2.height / 2;
          const hit = document.elementFromPoint(cx, cy);
          const owner = hit && hit.closest ? hit.closest('.map-node') : null;
          if (!owner || owner.dataset.node !== b.id) {
            unreachable.push(\`\${b.id}/\${b.kind} (still not hittable after scrolling to it)\`);
          }
        }
        scroller.scrollLeft = x0; scroller.scrollTop = y0;
      }
    }
  }

  // What the module decided, and what it would decide for this surface.
  const cols = Math.max(...layout.nodes.map(n => n.col)) + 1;
  const byCol = Array.from({ length: cols }, () => []);
  for (const n of layout.nodes) byCol[n.col].push(n);
  const geo = geoFor(regionIndex);
  const r = el.getBoundingClientRect();
  const predicted = !!(geo && geo.campaign)
    && campaignFits(geo.campaign, layout.nodes, byCol, cols, r.width, r.height);

  return JSON.stringify({
    nodes: btns.length, overlaps, stolen,
    offscreen: offscreen.map(b => \`\${b.id}/\${b.kind}\`), unreachable,
    atlas: el.classList.contains('has-atlas'), predicted,
    minBox: Math.min(...btns.map(b => Math.min(b.w, b.h))),
    surface: [Math.round(r.width), Math.round(r.height)],
  });
};
window.probeReady = true;
</script>`);

const httpd = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: process.cwd(), stdio: 'ignore' });
const profile = mkdtempSync(path.join(tmpdir(), 'mapgate-'));
const chrome = spawn('/opt/pw-browsers/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
  '--disable-dev-shm-usage', `--remote-debugging-port=${DBG}`, `--user-data-dir=${profile}`,
  '--window-size=1280,800', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });

try {
  await sleep(900);
  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch(`http://localhost:${DBG}/json/list`)).json()).find(t => t.type === 'page'); }
    catch { /* not up yet */ }
  }
  if (!target) throw new Error('chromium devtools endpoint never came up');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
  let id = 0; const pend = new Map(); let lastExc = null;
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') {
      lastExc = m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text;
    }
  };
  const cdp = (method, params = {}) => new Promise(res => {
    const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
  });
  await cdp('Runtime.enable'); await cdp('Page.enable');

  const playable = REGIONS.map(r => r.index);
  console.log(`MAP NODE OVERLAP — ${playable.length} region(s), ${SEEDS} seed(s), ${VIEWPORTS.length} viewports\n`);

  for (const [w, h, label] of VIEWPORTS) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    for (const regionIndex of playable) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        lastExc = null;
        await cdp('Page.navigate', { url: `http://127.0.0.1:${PORT}/${PROBE}` });
        let ready = false;
        for (let i = 0; i < 40 && !ready; i++) {
          await sleep(150);
          const q = await cdp('Runtime.evaluate', { expression: 'window.probeReady === true', returnByValue: true });
          ready = q.result?.result?.value === true;
        }
        if (!ready) { bad(`${label} ${w}x${h} r${regionIndex} seed ${seed}: probe never loaded${lastExc ? ` — ${lastExc.split('\n')[0]}` : ''}`); continue; }
        const r = await cdp('Runtime.evaluate', {
          expression: `window.probe(${regionIndex}, ${seed})`, awaitPromise: true, returnByValue: true,
        });
        const raw = r.result?.result?.value;
        if (!raw) { bad(`${label} ${w}x${h} r${regionIndex} seed ${seed}: probe threw${lastExc ? ` — ${lastExc.split('\n')[0]}` : ''}`); continue; }
        const o = JSON.parse(raw);
        const where = `${label} ${w}x${h} r${regionIndex} seed ${seed}`;
        const mode = o.atlas ? 'campaign' : 'columns';

        if (o.overlaps.length) bad(`${where} (${mode}): ${o.overlaps.length} overlapping pair(s) — ${o.overlaps.slice(0, 3).join('; ')}`);
        else ok(`${where} (${mode}): ${o.nodes} nodes, no overlap`);

        if (o.stolen.length) bad(`${where} (${mode}): ${o.stolen.length} node(s) whose own centre hits something else — ${o.stolen.slice(0, 3).join('; ')}`);
        if (o.unreachable.length) bad(`${where} (${mode}): ${o.unreachable.length} node(s) the player cannot reach — ${o.unreachable.slice(0, 3).join('; ')}`);
        else if (o.offscreen.length) console.log(`  · ${o.offscreen.length} node(s) off screen, reachable by scrolling — ${o.offscreen.slice(0, 4).join(', ')}`);

        // The predicate and the DOM must tell the same story.
        if (o.atlas !== o.predicted) {
          bad(`${where}: rendered ${mode} but campaignFits() says ${o.predicted} — the fit test has drifted from the layout it gates`);
        }
        if (o.predicted && o.overlaps.length) {
          bad(`${where}: campaignFits() passed a placement the DOM overlaps — the box it reads no longer matches the stylesheet`);
        }
      }
    }
  }
} finally {
  try { chrome.kill(); } catch { /* already gone */ }
  try { httpd.kill(); } catch { /* already gone */ }
  try { unlinkSync(PROBE); } catch { /* never written */ }
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
process.exit(fails ? 1 : 0);
