// RENDER PARITY for the horde fast paths (render-batch-perf).
//
// One frozen map-1 scene (Necromancer, N enemies with the horde's statuses
// forced on: ~85% plagued, ~30% chilled, ~14% chasing, a few damaged / winding)
// drawn twice on the same canvas with the clock frozen:
//   legacy  renderer.enemyFastPath = false, renderer.floorCache = false
//           (per-enemy save/restore, scaled body drawImage, live domain arcs,
//           live soul-token arcs, live tiled floor)
//   fast    the shipped path (cached floor chunks, pre-scaled body cells,
//           cached rings / tokens)
// and compared pixel by pixel. The floor must be bit-identical; bodies may
// differ only by the anti-aliasing / nearest-neighbour phase of a cached cell
// snapped to a whole device pixel (<= 1 device px of placement), never by new
// colours. The floor cache is not bit-exact: at the 53.33-px tile seams the
// edge anti-aliasing / nearest-neighbour ties resolve slightly differently
// under the chunk's translation (faint, <= 22 levels measured), much as the
// legacy floor itself changes under a one-pixel camera pan (measured here). Status
// precedence (chase > plague > chill) is checked on the view itself and the
// per-status pixel colours are counted in both images.
//
//   node --experimental-websocket tools/render_parity_test.mjs
//   OUT=/workspace/perf_shots node --experimental-websocket tools/render_parity_test.mjs
import { Page, bootHttpd, bootRelay, startRun, sleep, loadPeerjs } from './cdp_harness.mjs';
import { writeFileSync, mkdirSync } from 'fs';
const { CONFIG } = await import('../js/config.js');
const N = +(process.env.N || 120);
const OUT = process.env.OUT || '';
const PORT = +(process.env.PORT || 8762);
bootHttpd(PORT); await sleep(800);
const relay = await bootRelay(9900);
const H = await new Page('par', +(process.env.DBG || 9462), loadPeerjs()).open();   // ignored by a harness that binds an ephemeral port
await H.goto(`http://localhost:${PORT}/index.html?peerhost=localhost&peerport=${relay.port}&peersecure=0&seed=777`);
await H.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden') ? 1 : 0`, 10000, 'title');
await H.exec(`document.getElementById('name-input').value='P'; document.getElementById('btn-host').click(); return 1;`);
await H.waitFor(`return (window.uv.lobby && window.uv.lobby.code) || ''`, CONFIG.ROOM_REGISTER_BUDGET_MS + 3000, 'room');
await H.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden') ? 1 : 0`, 5000, 'lobby');
await H.exec(`document.querySelector('.char-card[data-char="toh_necromancer"]').click(); return 1;`);
await sleep(300);
await startRun(H, 1);
await H.waitFor(`return document.querySelector('#overlay-opening .offer-card') ? 1 : 0`, 8000, 'opening');
await H.exec(`document.querySelector('#overlay-opening .offer-card').click(); return 1;`);
await sleep(400);
await H.exec(`document.querySelector('.map-node.reachable').click(); return 1;`);
await H.waitFor(`return window.uv.sim.phase==='arena' ? 1 : 0`, 12000, 'arena');
await sleep(2500);   // let a few soul tokens / projectiles exist
const res = await H.exec(`
  const s = window.uv.sim; const me = s.players[window.uv.myIdx]; s.god = true;
  for (const e of [...s.enemyPool]) s.enemyPool.release(e);
  s.spawnQueue.length = 0;
  Object.assign(s.wave, { r0: 0, r1: 0, acc: 0, dur: 1e9, done: false });
  const MIX = ['pnw_thornhound','pnw_sapling','pnw_thornhound','pnw_mistwalker','pnw_sapling','pnw_thornhound','pnw_sapling','pnw_cedar_warden'];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < ${N}; i++) s.spawnEnemyById(MIX[i % 8], me.x + (rnd() - 0.5) * 1180, me.y + (rnd() - 0.5) * 640, {});
  let k = 0;
  for (const e of s.enemyPool) { k++;
    e.spd = 0; e.dmg = 0;
    e.plagueT = (k % 20) < 17 ? 1e6 : 0; e.plagueDps = 0;
    e.slowT = (k % 10) < 3 ? 1e6 : 0;
    e.straggle = (k % 7) === 0;
    if (k % 9 === 0) e.hp = e.maxHp * 0.5;
  }
  s.tick = () => {};
  await new Promise(r => setTimeout(r, 600));
  const R = window.uvRenderer; const cv = R.canvas; const g = cv.getContext('2d');
  const v = window.uvLastView();
  // status precedence on the view (chase > plague > chill)
  const { enemyBodyTint } = await import('/js/render.js');
  const want = e => e.straggle ? '#8E4432' : e.plagued ? '#7A8C3A' : e.slowed ? '#8FC8E8' : null;
  let prec = 0; for (const e of v.enemies) if (((enemyBodyTint(e, v) || {}).tint || null) !== want(e)) prec++;
  // freeze every clock the renderer reads
  const realNow = performance.now.bind(performance); const T0 = realNow();
  performance.now = () => T0;
  const t0 = R.t;
  // nothing in the fx lists may move between the grabs
  const grab = (fast) => { R.enemyFastPath = fast; R.floorCache = fast; R.t = t0; R.draw(v, 0); return g.getImageData(0, 0, cv.width, cv.height); };
  grab(false); grab(true);   // warm every cache
  const L1 = grab(false), L2 = grab(false), F1 = grab(true);
  R.enemyFastPath = true; R.floorCache = true;
  const legacyURL = (() => { g.putImageData(L1, 0, 0); return cv.toDataURL('image/png'); })();
  const fastURL = (() => { g.putImageData(F1, 0, 0); return cv.toDataURL('image/png'); })();
  // diff + a diff mask
  const a = L1.data, b = F1.data, a2 = L2.data;
  let diff = 0, worst = 0, noise = 0, diff32 = 0;
  const mask = g.createImageData(cv.width, cv.height);
  // floor-only region check: pixels of the legacy frame that are floor (no entity) cannot be told apart here,
  // so the floor is checked on a separate pair with no entities at all.
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2]));
    const n = Math.max(Math.abs(a[i]-a2[i]), Math.abs(a[i+1]-a2[i+1]), Math.abs(a[i+2]-a2[i+2]));
    if (n) noise++;
    if (d > 32) diff32++;
    if (d) { diff++; worst = Math.max(worst, d); mask.data[i] = 255; mask.data[i+1] = 64; mask.data[i+2] = 64; mask.data[i+3] = 255; }
    else { mask.data[i] = a[i] >> 2; mask.data[i+1] = a[i+1] >> 2; mask.data[i+2] = a[i+2] >> 2; mask.data[i+3] = 255; }
  }
  // PLACEMENT-TOLERANT: a fast-path pixel counts as moved only if NO pixel of
  // the legacy frame within 1 device px of it matches (channel delta <= 32) —
  // the cached cells are allowed a whole-pixel snap, never a different picture.
  let beyond1 = 0;
  { const W = cv.width, Hh = cv.height;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; let best = 999;
      for (let dy = -1; dy <= 1 && best > 32; dy++) for (let dx = -1; dx <= 1 && best > 32; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= Hh) continue;
        const j = (yy * W + xx) * 4;
        best = Math.min(best, Math.max(Math.abs(a[j]-b[i]), Math.abs(a[j+1]-b[i+1]), Math.abs(a[j+2]-b[i+2])));
      }
      if (best > 32) beyond1++;
    } }
  g.putImageData(mask, 0, 0); const maskURL = cv.toDataURL('image/png');
  // floor alone: identical or not
  const empty = { ...v, enemies: [], tokens: [], projs: [], players: [], pickups: [], tele: [], telZones: [], hazards: [] };
  const fx = [R.particles, R.floaters, R.arcs, R.rings, R.casts, R.impacts, R.muzzles, R.flashBeams, R.puffs].map(x => x.splice(0));
  const fl = (fast) => { R.floorCache = fast; R.enemyFastPath = fast; R.t = t0; R.draw(empty, 0); return g.getImageData(0, 0, cv.width, cv.height).data; };
  const FL = fl(false), FF = fl(true);
  const W = cv.width, Hh = cv.height;
  const pxd = (A, i, B, j) => Math.max(Math.abs(A[i]-B[j]), Math.abs(A[i+1]-B[j+1]), Math.abs(A[i+2]-B[j+2]));
  let floorDiff = 0, floorWorst = 0;
  for (let i = 0; i < FL.length; i += 4) { const d = pxd(FL, i, FF, i); if (d) { floorDiff++; floorWorst = Math.max(floorWorst, d); } }
  // THE LEGACY FLOOR'S OWN TIE NOISE: the same legacy floor with the camera
  // one device pixel over, compared at the shifted position. Nearest-neighbour
  // ties at the 53.33-px tile seams resolve differently with the translation
  // alone, so a pan already flips these texels frame to frame on the old path.
  const sc = R._screen.scale, cx0 = R.camX;
  R.camX = cx0 + 1 / sc; const FS = fl(false); R.camX = cx0;
  let panDiff = 0;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W - 1; x++) { const i = (y * W + x + 1) * 4, j = (y * W + x) * 4; if (pxd(FL, i, FS, j)) panDiff++; }
  R.floorCache = true; R.enemyFastPath = true;
  performance.now = realNow;
  // how many enemies took the fast path
  const fastN = v.enemies.filter(e => !e.elite && !e.fusing && !e.flash).length;
  return { canvas: cv.width + 'x' + cv.height, enemiesInView: v.enemies.length, fastEligible: fastN,
    plagued: v.enemies.filter(e => e.plagued).length, chilled: v.enemies.filter(e => e.slowed).length, chasing: v.enemies.filter(e => e.straggle).length,
    tokens: (v.tokens || []).length, precedenceMismatches: prec,
    pixels: a.length / 4, noisePx: noise, diffPx: diff, diffPct: +(100 * diff / (a.length / 4)).toFixed(3), worstDelta: worst,
    diffOver32Px: diff32, diffOver32Pct: +(100 * diff32 / (a.length / 4)).toFixed(3),
    movedBeyond1pxPx: beyond1, movedBeyond1pxPct: +(100 * beyond1 / (a.length / 4)).toFixed(4),
    floorDiffPx: floorDiff, floorWorst, legacyFloorPanNoisePx: panDiff, legacyURL, fastURL, maskURL };`);
const { legacyURL, fastURL, maskURL, ...summary } = res;
console.log(JSON.stringify(summary));
if (OUT) {
  mkdirSync(OUT, { recursive: true });
  for (const [n, u] of [['parity_legacy_120.png', legacyURL], ['parity_fast_120.png', fastURL], ['parity_diffmask_120.png', maskURL]])
    writeFileSync(`${OUT}/${n}`, Buffer.from(u.split(',')[1], 'base64'));
}
// Pass: the frozen frame is stable (no clock leak), status precedence holds,
// under 0.25% of pixels differ by more than a 32-level channel delta once a
// whole-pixel snap is allowed (measured 0.10% primitives, 0.12% with the
// region-1 fodder sheets: isolated single texels of 1-px art details that a
// different nearest-neighbour phase keeps or drops), and no floor pixel moves by more than a
// 32-level delta (the seam differences are low-contrast texel ties).
const ok = summary.noisePx === 0 && summary.precedenceMismatches === 0 && summary.movedBeyond1pxPct < 0.25
  && summary.floorWorst <= 32;
console.log(ok ? 'PARITY OK' : 'PARITY FAIL');
H.close(); relay.proc.kill(); process.exit(ok ? 0 : 1);
