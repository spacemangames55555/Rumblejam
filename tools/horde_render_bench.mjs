// HORDE RENDER BENCH (pace-spec §5/§7 frame-rate check; Art's status-read case).
//
// N map-1 enemies frozen in the ~1280×720 view around the host, drawn with every
// status OFF, then with the horde's statuses ON: ~85% plagued (plague tint +
// overhead fx.plague_mark), ~30% chilled (chill tint + fx.chill_frost at the
// feet), ~14% chasing (chase tint wins). Then a BREAKDOWN at the largest N with
// one status at a time forced on every body, so the cost of a TINT is read apart
// from the cost of an OVERLAY.
//
// Two readings per case:
//   fpsMed / low1  requestAnimationFrame over 5 s (headless vsync caps it at 60)
//   drawP50/95/99  one renderer.draw() of the frozen view, then a 1 px
//                  getImageData so the canvas rasterises before the clock stops
// Headless Chromium with --disable-gpu is a SOFTWARE canvas: absolute ms are a
// CPU-raster floor, not a player's machine. The tinted/untinted DIFFERENCE is the
// reading. With no enemy art on disk the enemies draw as primitives (the shipped
// state today); drop sheets into assets/sprites/enemy/ to read the sprite path.
//
// Usage (repo root; Node 20 needs the flag, Node 22+ does not; needs
// /tmp/peerjs.min.js like the other CDP tools):
//   node --experimental-websocket tools/horde_render_bench.mjs
//   NS=100,150,200 node --experimental-websocket tools/horde_render_bench.mjs
import { Page, bootHttpd, bootRelay, startRun, sleep, loadPeerjs } from './cdp_harness.mjs';
const { CONFIG } = await import('../js/config.js');
const PORT = 8731, DBG = 9431;
const QS = process.env.QS || '';
const NS = (process.env.NS || '100,150').split(',').map(Number);
bootHttpd(PORT); await sleep(800);
const relay = await bootRelay(9800);
const P = await new Page('rb', DBG, loadPeerjs()).open();
process.on('exit', () => P.close());
await P.goto(`http://localhost:${PORT}/index.html?peerhost=localhost&peerport=${relay.port}&peersecure=0${QS}`);
await P.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden') ? 1 : 0`, 10000, 'title');
await P.exec(`document.getElementById('name-input').value='RB'; document.getElementById('btn-host').click(); return 1;`);
await P.waitFor(`return (window.uv.lobby && window.uv.lobby.code) || ''`, CONFIG.ROOM_REGISTER_BUDGET_MS + 3000, 'room');
await P.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden') ? 1 : 0`, 5000, 'lobby');
await P.exec(`(document.querySelector('.char-card[data-char="toh_samurai"]') || document.querySelector('.char-card')).click(); return 1;`);
await sleep(300);
await startRun(P, 1);
await P.exec(`
  const s = window.uv.sim; const me = s.players[window.uv.myIdx];
  if (me.openingOffer) s.uiAction(me.idx, { kind: 'learnSkill', id: me.openingOffer[0].id });
  s._travelTo(s.reachableNodes()[0]); return 1;`);
await P.waitFor(`return window.uv.sim && window.uv.sim.phase === 'arena' ? 1 : 0`, 10000, 'arena');
await sleep(1500);
const sprites = await P.exec(`return !!(window.uvAssets || null)`).catch(() => false);
const out = [];
for (const N of NS) for (const tint of [false, true]) {
  const info = await P.exec(`
    const s = window.uv.sim; const me = s.players[window.uv.myIdx];
    s.god = true;
    if (!s.__frozen) { s.__tick = s.tick; s.__frozen = true; }
    s.tick = s.__tick;
    for (const e of [...s.enemyPool]) s.enemyPool.release(e);
    s.spawnQueue.length = 0; s.projPool.clear && s.projPool.clear();
    Object.assign(s.wave, { r0: 0, r1: 0, acc: 0, firstPack: true, dur: 1e9, done: false });
    const MIX = ['pnw_thornhound','pnw_sapling','pnw_thornhound','pnw_mistwalker','pnw_sapling','pnw_thornhound','pnw_sapling','pnw_cedar_warden'];
    // a deterministic scatter over the ~1280x720 view around the player
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < ${N}; i++) {
      const e = s.spawnEnemyById(MIX[i % MIX.length], me.x + (rnd() - 0.5) * 1180, me.y + (rnd() - 0.5) * 640, {});
      if (!e) continue;
      e.spd = 0; e.hp = e.maxHp = 1e6; e.dmg = 0;
    }
    const T = ${tint};
    let k = 0, pl = 0, ch = 0, st = 0;
    for (const e of s.enemyPool) {
      k++;
      e.plagueT = T && (k % 20) < 17 ? 1e6 : 0;           // ~85% plagued: tint + overhead mark
      e.slowT = T && (k % 10) < 3 ? 1e6 : 0;              // ~30% chilled: frost strip (+tint where not plagued)
      e.straggle = T && (k % 7) === 0;                    // ~14% chasing: chase tint wins
      e.plagueDps = 0;
      pl += e.plagueT > 0; ch += e.slowT > 0; st += e.straggle;
    }
    // freeze the world so every frame draws the same scene
    s.tick = () => {};
    return { alive: s.enemyPool.count, plagued: pl, chilled: ch, chasing: st };`);
  await sleep(700);
  const raf = await P.exec(`
    return await new Promise(res => { const ts = []; const t0 = performance.now();
      const f = t => { ts.push(t); if (t - t0 < 5000) requestAnimationFrame(f); else res(ts); }; requestAnimationFrame(f); });`);
  const dts = raf.slice(1).map((t, i) => t - raf[i]).sort((a, b) => a - b);
  const fpsMed = 1000 / dts[dts.length >> 1];
  const worst = dts.slice(Math.floor(dts.length * 0.99));
  const low1 = 1000 / (worst.reduce((a, b) => a + b, 0) / worst.length);
  const draw = await P.exec(`
    const v = window.uvLastView(); const R = window.uvRenderer; const ms = [];
    // getImageData(1 px) forces the canvas to rasterise the frame before the
    // clock stops, so each sample is a whole draw, not a queued command list.
    const cv = R.canvas || document.querySelector('canvas'); const g = cv.getContext('2d');
    for (let i = 0; i < 30; i++) { R.draw(v, 1 / 60); g.getImageData(0, 0, 1, 1); }
    for (let i = 0; i < 200; i++) { const t = performance.now(); R.draw(v, 1 / 60); g.getImageData(0, 0, 1, 1); ms.push(performance.now() - t); }
    ms.sort((a, b) => a - b);
    return { p50: ms[100], p95: ms[190], p99: ms[198], cw: cv.width, ch: cv.height, enemiesInView: v.enemies.length, plaguedInView: v.enemies.filter(e => e.plagued).length };`);
  out.push({ N, tint, ...info, fpsMed: +fpsMed.toFixed(1), low1: +low1.toFixed(1), frames: dts.length, drawP50: +draw.p50.toFixed(2), drawP95: +draw.p95.toFixed(2), drawP99: +draw.p99.toFixed(2), canvas: draw.cw + 'x' + draw.ch, inView: draw.enemiesInView, plaguedInView: draw.plaguedInView });
  console.log(JSON.stringify(out[out.length - 1]));
}
// BREAKDOWN at the largest N: the same frozen view with one status at a time
// forced on EVERY enemy in view — which part of "tinted" costs what.
{
  const bd = await P.exec(`
    const base = window.uvLastView(); const R = window.uvRenderer;
    const cv = R.canvas || document.querySelector('canvas'); const g = cv.getContext('2d');
    const time = mut => {
      const v = { ...base, enemies: base.enemies.map(e => ({ ...e, plagued: false, slowed: false, straggle: false, ...mut })) };
      for (let i = 0; i < 20; i++) { R.draw(v, 1 / 60); g.getImageData(0, 0, 1, 1); }
      const ms = [];
      for (let i = 0; i < 150; i++) { const t = performance.now(); R.draw(v, 1 / 60); g.getImageData(0, 0, 1, 1); ms.push(performance.now() - t); }
      ms.sort((a, b) => a - b); return +ms[75].toFixed(2);
    };
    // THE MARK AND FROST PATHS, before and after:
    //   inline         each mark drawn scaled inside its enemy (pre-batch)
    //   batchScaled    one batched pass, still resampled per draw
    //   batchPrescaled one batched pass, frames pre-scaled to screen size (live)
    // and the frost strip scaled per draw vs pre-scaled (drawn in place).
    const A = await import('/js/assets.js');
    const mode = (batch, pre) => { R.markBatching = batch; A.setSpritePrescale(pre); };
    mode(false, false); const plagueInline = time({ plagued: true }); const chillScaled = time({ slowed: true }); const allBefore = time({ plagued: true, slowed: true });
    mode(true, false); const plagueBatchScaled = time({ plagued: true });
    mode(true, true);
    const out = { n: base.enemies.length, none: time({}), chaseTintOnly: time({ straggle: true }),
      plagueInline, plagueBatchScaled, plagueBatchPrescaled: time({ plagued: true }),
      chillScaled, chillPrescaled: time({ slowed: true }),
      allBefore, allAfter: time({ plagued: true, slowed: true }),
      markFrames: (A.Assets.get('fx.plague_mark') || {}).frames || null };
    // PARITY: one plagued, chilled body, before vs after, same frame. Pre-scaling
    // is nearest-neighbour, the same filter as the main canvas, so the cached
    // frame is pixel-crisp: no resampling differences, the 1 px outline and the
    // mark palette survive. It also snaps to whole device pixels, so a nonzero
    // diff is only the nearest-neighbour sampling phase (which source column or
    // row lands on an edge), never new colours.
    const one = { ...base, enemies: base.enemies.slice(0, 1).map(e => ({ ...e, plagued: true, slowed: true, straggle: false })) };
    const grab = () => { R.draw(one, 0); return g.getImageData(0, 0, cv.width, cv.height).data; };
    // The same path drawn twice is the noise floor (loop phases and idle
    // animation run on the wall clock between grabs).
    const cmp = (a, b) => {
      let diff = 0, worst = 0;
      for (let i = 0; i < a.length; i += 4) {
        const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        if (d) { diff++; worst = Math.max(worst, d); }
      }
      return [diff, worst];
    };
    mode(false, false); const a = grab(); const a2 = grab(); mode(true, false); const bs = grab(); mode(true, true); const b = grab();
    [out.noiseDiffPx, out.noiseWorstDelta] = cmp(a, a2);
    [out.batchVsInlineDiffPx, out.batchVsInlineWorst] = cmp(a2, bs);       // batching alone
    [out.prescaleVsInlineDiffPx, out.prescaleVsInlineWorst] = cmp(a2, b);  // batching + pre-scale
    return out;`);
  console.log('BREAKDOWN ' + JSON.stringify(bd));
}
const spriteState = await P.exec(`
  const m = await import('/js/assets.js');
  return JSON.stringify(Object.fromEntries(['enemy.pnw_sapling', 'enemy.pnw_thornhound', 'enemy.pnw_cedar_warden', 'fx.plague_mark', 'fx.chill_frost'].map(id => [id, !!m.Assets.get(id)])));`);
console.log('SPRITES ' + spriteState);
P.close(); process.exit(0);
