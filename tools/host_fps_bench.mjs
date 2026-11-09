// SOLO-HOST FRAME-RATE BENCH (Region 2 horde gate: median >= 50 fps, 1% low
// >= 30 at 120 alive, CPU slowed 4x via CDP Emulation.setCPUThrottlingRate).
//
// Live map 1, Necromancer, seed 777, the real frame loop (main.js frame()):
// the sim advances, the renderer draws, the HUD updates. The room is topped up
// to N each tick at fixed spawn angles (tool-side counter, never Sim.rng) and
// the party is kept alive, so the horde moves, fights and carries the statuses
// the Necromancer actually applies.
//
// Per N, after a warm-up: a WINDOW_MS (default 15 s) requestAnimationFrame
// window. Reported:
//   fpsMed   1000 / median rAF delta
//   low1     1000 / mean of the worst 1% of rAF deltas
//   hist     rAF delta histogram in vsync buckets (<=20 ms ~60, <=36 ~30, ...)
//   drawMs   median JS time inside renderer.draw() during the window
//   rasterMs median of renderer.draw() + 1 px getImageData on the live view,
//            so the canvas rasterises before the clock stops (the number the
//            earlier 33-44 ms profile reported)
// Headless Chromium with --disable-gpu is a software canvas, so this is a
// CPU-raster floor; the vsync cliff (60 -> 30) is why the histogram is printed.
//
//   node --experimental-websocket tools/host_fps_bench.mjs
//   NS=60,80,100,120,200 WINDOW_MS=15000 SHOT=/workspace/perf_shots/x.png node --experimental-websocket tools/host_fps_bench.mjs
import { Page, bootHttpd, bootRelay, startRun, sleep, loadPeerjs } from './cdp_harness.mjs';
import { writeFileSync } from 'fs';
const { CONFIG } = await import('../js/config.js');
const CLS = process.env.CLS || 'toh_necromancer';
const RATE = +(process.env.RATE || 4);
const NS = (process.env.NS || '60,80,100,120,200').split(',').map(Number);
const WINDOW_MS = +(process.env.WINDOW_MS || 15000);
const WARM_MS = +(process.env.WARM_MS || 5000);
const SHOT = process.env.SHOT || '';        // screenshot path, taken at SHOT_N alive
const SHOT_N = +(process.env.SHOT_N || 120);
const QS = process.env.QS || '';
const PORT = +(process.env.PORT || 8750);
bootHttpd(PORT); await sleep(800);
const relay = await bootRelay(9840);
if (!relay) { console.error('relay failed'); process.exit(1); }
const H = await new Page('h', +(process.env.DBG || 9452), loadPeerjs()).open();   // the port is ignored by a harness that binds an ephemeral one
const url = `http://localhost:${PORT}/index.html?peerhost=localhost&peerport=${relay.port}&peersecure=0&seed=777${QS}`;
await H.goto(url);
await H.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden') ? 1 : 0`, 10000, 'title');
await H.exec(`document.getElementById('name-input').value='H'; document.getElementById('btn-host').click(); return 1;`);
await H.waitFor(`return (window.uv.lobby && window.uv.lobby.code) || ''`, CONFIG.ROOM_REGISTER_BUDGET_MS + 3000, 'room');
await H.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden') ? 1 : 0`, 5000, 'lobby');
await H.exec(`document.querySelector('.char-card[data-char="${CLS}"]').click(); return 1;`);
await sleep(300);
await startRun(H, 1);
await H.waitFor(`return document.querySelector('#overlay-opening .offer-card') ? 1 : 0`, 8000, 'opening');
await H.exec(`document.querySelector('#overlay-opening .offer-card').click(); return 1;`);
await sleep(400);
await H.exec(`const b=document.querySelector('.map-node.reachable'); b.click(); return 1;`);
await H.waitFor(`return window.uv.sim.phase==='arena' ? 1 : 0`, 12000, 'arena');
await H.cdp('Emulation.setCPUThrottlingRate', { rate: RATE });
await H.exec(`const s=window.uv.sim; window.__N=0; let k=0;
  const orig=s.tick.bind(s);
  const MIX=['pnw_thornhound','pnw_sapling','pnw_thornhound','pnw_mistwalker','pnw_sapling','pnw_thornhound','pnw_sapling','pnw_cedar_warden'];
  s.tick=function(){ for(const p of s.players){ p.hp=p.stats.vitality; }
    if (s.wave) { s.wave.dur=1e9; }
    s._hordeAliveCap=()=>window.__N;
    const me=s.players[0]; let n=0;
    while (s.enemyPool.count < window.__N && n++ < 8) { k++; const a=k*2.39996; s.spawnEnemyById(MIX[k%8], me.x+Math.cos(a)*560, me.y+Math.sin(a)*400, {}); }
    return orig(); };
  const R=window.uvRenderer; const d0=R.draw.bind(R); window.__drawMs=null;
  R.draw=function(v,dt){ const t0=performance.now(); d0(v,dt); if(window.__drawMs) window.__drawMs.push(performance.now()-t0); };
  return 1;`);
const pct = (a, q) => a[Math.min(a.length - 1, Math.floor(q * a.length))];
const out = [];
for (const N of NS) {
  await H.exec(`window.__N=${N}; return 1;`);
  await sleep(WARM_MS);
  const r = JSON.parse(await H.exec(`window.__drawMs=[]; return await new Promise(res=>{const ts=[];const t0=performance.now();const f=t=>{ts.push(t); if(t-t0<${WINDOW_MS}) requestAnimationFrame(f); else { const d=window.__drawMs; window.__drawMs=null; res(JSON.stringify({ts,d})); }}; requestAnimationFrame(f);});`));
  const dts = r.ts.slice(1).map((t, i) => t - r.ts[i]).sort((a, b) => a - b);
  const worst = dts.slice(Math.floor(dts.length * 0.99));
  const low1 = 1000 / (worst.reduce((a, b) => a + b, 0) / worst.length);
  const draws = [...r.d].sort((a, b) => a - b);
  const hist = { '<=20': 0, '<=36': 0, '<=53': 0, '>53': 0 };
  for (const d of dts) hist[d <= 20 ? '<=20' : d <= 36 ? '<=36' : d <= 53 ? '<=53' : '>53']++;
  for (const k in hist) hist[k] = +(100 * hist[k] / dts.length).toFixed(1);
  const alive = await H.exec(`return window.uv.sim.enemyPool.count`);
  // isolated draw + raster of the live view (the earlier profile's draw number)
  const ras = await H.exec(`const R=window.uvRenderer; const g=R.canvas.getContext('2d'); const a=[];
    const v=window.uvLastView();
    for(let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,0)); const t0=performance.now(); R.draw(v, 0.016); g.getImageData(0,0,1,1); a.push(performance.now()-t0); }
    a.sort((x,y)=>x-y); return a[a.length>>1];`).catch(e => String(e));
  if (SHOT && N === SHOT_N) {
    const img = await H.cdp('Page.captureScreenshot', { format: 'png' });
    writeFileSync(SHOT, Buffer.from(img.data, 'base64'));
  }
  // the worst frames, with the JS draw time of the draw that ended them
  const pairs = r.ts.slice(1).map((t, i) => [+(t - r.ts[i]).toFixed(1), r.d[i] != null ? +r.d[i].toFixed(1) : null]);
  const worstFrames = [...pairs].sort((a, b) => b[0] - a[0]).slice(0, 6);
  const row = { N, alive, fpsMed: +(1000 / pct(dts, 0.5)).toFixed(1), low1: +low1.toFixed(1),
    drawMs: +pct(draws, 0.5).toFixed(2), drawP95: +pct(draws, 0.95).toFixed(2),
    rasterMs: typeof ras === 'number' ? +ras.toFixed(2) : ras, frames: dts.length, hist, worst: worstFrames };
  console.log(JSON.stringify(row)); out.push(row);
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
H.close(); relay.proc.kill(); process.exit(0);
