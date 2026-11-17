// EVERY SKILL EFFECT, FROZEN AT ONE MOMENT — a picture, not a gate.
//
// A skill effect lasts a third of a second and a screenshot of a fight
// catches most of them already fading, which is how the November review
// found effects nobody could see: they were judged, if at all, in motion.
// This boots the real game, freezes the sim, pushes one effect of every
// shape the catalog uses (each from a different class, so the palettes vary)
// into the real renderer at the same point of its animation, and saves one
// frame on the real floor at play scale.
//
//   node --experimental-websocket tools/fx_gallery.mjs out.png [progress]
//
// `progress` is 0..1 through each effect's life (default 0.3). Run it at
// 0.1, 0.3 and 0.7 to see the strike, the hold and the fade. A painted FX
// sprite, once installed, is drawn here exactly as it is in play.
import { writeFileSync } from 'fs';
const REPO = process.cwd();
const { Page, bootHttpd, bootRelay, startRun, sleep, loadPeerjs } = await import(REPO + '/tools/cdp_harness.mjs');
const { CONFIG } = await import(REPO + '/js/config.js');
const out = process.argv[2] || 'fx_gallery.png', PR = +(process.argv[3] || 0.3);
const PORT = 8768;
bootHttpd(PORT); await sleep(800);
const relay = await bootRelay(9960);
const H = await new Page('gal', 9490, loadPeerjs()).open();
await H.goto(`http://localhost:${PORT}/index.html?peerhost=localhost&peerport=${relay.port}&peersecure=0&seed=777`);
await H.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden') ? 1 : 0`, 10000, 'title');
await H.exec(`document.getElementById('name-input').value='P'; document.getElementById('btn-host').click(); return 1;`);
await H.waitFor(`return (window.uv.lobby && window.uv.lobby.code) || ''`, CONFIG.ROOM_REGISTER_BUDGET_MS + 3000, 'room');
await H.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden') ? 1 : 0`, 5000, 'lobby');
await H.exec(`document.querySelector('.char-card[data-char="toh_samurai"]').click(); return 1;`);
await sleep(300);
await startRun(H, 1);
await H.waitFor(`return document.querySelector('#overlay-opening .offer-card') ? 1 : 0`, 8000, 'opening');
await H.exec(`document.querySelector('#overlay-opening .offer-card').click(); return 1;`);
await sleep(400);
await H.exec(`document.querySelector('.map-node.reachable').click(); return 1;`);
await H.waitFor(`return window.uv.sim.phase==='arena' ? 1 : 0`, 12000, 'arena');
await sleep(800);
const res = await H.exec(`
  const s = window.uv.sim; const me = s.players[window.uv.myIdx]; s.god = true;
  for (const e of [...s.enemyPool]) s.enemyPool.release(e);
  s.spawnQueue.length = 0; Object.assign(s.wave, { r0: 0, r1: 0, acc: 0, dur: 1e9, done: false });
  s.tick = () => {};
  await new Promise(r => setTimeout(r, 300));
  const { fxSpec, SHAPE } = await import('/js/content/skillfx.js');
  const { SKILL_BY_ID } = await import('/js/skills.js');
  const R = window.uvRenderer;
  // one skill per shape, from a spread of classes so the palettes vary
  const byShape = {};
  for (const sk of Object.values(SKILL_BY_ID)) {
    const sp = fxSpec(sk); if (!sp) continue;
    (byShape[sp.shape] = byShape[sp.shape] || []).push(sk.id);
  }
  const shapes = Object.keys(byShape).sort();
  R.arcs.length = 0; R.casts.length = 0; R.muzzles.length = 0; R.flashBeams.length = 0; R.particles.length = 0;
  const v0 = window.uvLastView();
  const cols = 6, gw = 190, gh = 170;
  const x0 = me.x - gw * 2.5, y0 = me.y - gh * 1.4;
  const labels = [];
  shapes.forEach((shape, i) => {
    const ids = byShape[shape];
    const id = ids[(i * 7) % ids.length];
    const sp = fxSpec(id);
    const cx = x0 + (i % cols) * gw, cy = y0 + Math.floor(i / cols) * gh;
    const a = 0;
    if (sp.role === 'arc') R.arcs.push({ x: cx - 40, y: cy, a, r: Math.min(sp.reach, 110), arc: sp.arc, color: sp.color, spec: sp, shape: sp.shape, t: sp.dur * ${PR}, dur: sp.dur, stack: 1, lw: 7 });
    else if (sp.role === 'beam') R.flashBeams.push({ x1: cx - 60, y1: cy, x2: cx + 70, y2: cy, t: sp.dur * ${PR}, dur: sp.dur, spec: sp, color: sp.color, w: sp.width || 10 });
    else if (sp.role === 'bolt') R.muzzles.push({ x: cx, y: cy, a, t: sp.dur * ${PR}, dur: sp.dur, spec: sp });
    else R.casts.push({ x: cx - 30, y: cy, tx: cx + 30, ty: cy, a, t: sp.dur * ${PR}, dur: sp.dur, spec: sp, reach: Math.min(sp.reach, 90), arc: sp.arc });
    labels.push({ shape, id, cx, cy });
  });
  const realNow = performance.now.bind(performance); const T0 = realNow(); performance.now = () => T0;
  const empty = { ...v0, enemies: [], projs: [], tokens: [], pickups: [], tele: [], telZones: [], hazards: [] };
  R.draw(empty, 0);
  performance.now = realNow;
  const cv = R.canvas;
  return { url: cv.toDataURL('image/png'), labels, shapes: shapes.length };`);
writeFileSync(out, Buffer.from(res.url.split(',')[1], 'base64'));
console.log(`${res.shapes} shapes at ${PR} of their life -> ${out}\n  ` + res.labels.map(l => `${l.shape} (${l.id})`).join(', '));
H.close(); relay.proc.kill(); process.exit(0);
