// Measure the real world-to-screen scale in the running game, at several
// viewports. Answers "how big is a sprite actually drawn" with a number rather
// than an approximation — the renderer shows a fixed ROOM_W x ROOM_H of world,
// so scale falls out of the canvas size and nothing else.
//
//   node tools/probe_display_scale.mjs
//
// Reports device pixels as well as css pixels, because device pixels are the
// actual sampling grid and therefore the number art should be designed against.
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
// Per-process ports, so two runs (or a leftover from a previous one still
// shutting down) cannot collide on a fixed port and look like a tool failure.
const PORT = 8900 + (process.pid % 89), DBG = 9500 + (process.pid % 89);
const httpd = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.cwd(), stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(900);
const profile = mkdtempSync(path.join(tmpdir(), 'uvscale-'));
const proc = spawn('/opt/pw-browsers/chromium', ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  `--remote-debugging-port=${DBG}`,`--user-data-dir=${profile}`,'--window-size=1440,900','--mute-audio','about:blank'],{stdio:'ignore'});
let target=null;
for (let i=0;i<60&&!target;i++){ await sleep(250);
  try{ const l=await (await fetch(`http://localhost:${DBG}/json/list`)).json(); target=l.find(t=>t.type==='page'); }catch{} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>{ws.onopen=r;});
let id=0; const pend=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m); pend.delete(m.id);} };
const cdp=(method,params={})=>new Promise(res=>{const i=++id; pend.set(i,res); ws.send(JSON.stringify({id:i,method,params}));});
const exec=async js=>{const r=await cdp('Runtime.evaluate',{expression:`(async()=>{${js}})()`,awaitPromise:true,returnByValue:true});
  return r.result?.result?.value;};
await cdp('Runtime.enable'); await cdp('Page.enable');
for (const [w,h,dpr] of [[1440,900,2],[1920,1080,1],[851,393,2.6],[1280,800,2]]) {
  await cdp('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:dpr,mobile:dpr>2});
  await cdp('Page.navigate',{url:`http://localhost:${PORT}/index.html`});
  await sleep(2200);
  const out = await exec(`
    const C = (await import('/js/config.js')).CONFIG;
    const r = window.uvRenderer, cv = r.canvas;
    const scale = Math.min(cv.width / C.ROOM_W, cv.height / C.ROOM_H);
    const A = window.uvAssets;
    const spec = A.declared('char.pulsar');
    const radius = 16;                 // js/main.js: default player radius
    const worldUnits = 2 * radius;     // js/render.js _drawPlayer: spriteScaleFor(id, r*2)
    return JSON.stringify({
      window: [window.innerWidth, window.innerHeight],
      devicePixelRatio: window.devicePixelRatio,
      rendererDpr: r.dpr,
      canvasDevicePx: [cv.width, cv.height],
      ROOM: [C.ROOM_W, C.ROOM_H],
      scale_devicePx_per_worldUnit: scale,
      sheetCell: spec ? [spec.w, spec.h] : null,
      worldUnitsDrawn: worldUnits,
      renderedDevicePx: worldUnits * scale,
      renderedCssPx: worldUnits * scale / r.dpr,
      sheetPxPerDevicePx: spec ? (worldUnits * scale) / spec.w : null,
      imageSmoothingEnabled: r.ctx.imageSmoothingEnabled,
    });`);
  console.log(`${String(w)+'x'+h} @dpr${dpr}  ${out}`);
}
ws.close(); proc.kill(); httpd.kill();
// The browser is still flushing its profile when we ask to remove it, so the
// rmdir races and throws ENOTEMPTY. Give it a moment, and never let cleanup
// fail a run whose measurements already succeeded.
await sleep(400);
try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* a temp dir, not a result */ }
process.exit(0);   // do not wait on the killed browser/server handles
