// Dev tool: organic balance probe. A simple kiting bot plays real combat (no
// F3 cheats) so egregious balance failures show up: instant deaths, unkillable
// rooms, boss walls. Not a tuning oracle — a smoke alarm.
// Usage: node tools/balance_probe.mjs [charId]

import { Sim } from '../js/game.js';
import { dist2 } from '../js/util.js';
import { WEAPON_BY_ID } from '../js/content/weapons.js';

const charId = process.argv[2] || 'bulwark';
const sim = new Sim({ seed: 20260728, party: [{ idx: 0, key: 'k', name: 'BOT', charId, color: '#fff' }] });
const p = sim.players[0];

function botInput() {
  // a "mediocre human": kite at ring distance, avoid walls, hunt stragglers
  const wdef = p.weapons[0] ? WEAPON_BY_ID[p.weapons[0].id] : null;
  const melee = wdef && (wdef.cls === 'swing' || wdef.cls === 'thrust');
  const ring = wdef ? (melee ? Math.max(70, wdef.range * 0.75) : 230) : 200;
  let vx = 0, vy = 0;
  let nearest = null, nd = Infinity, count = 0;
  for (const e of sim.enemyPool) {
    const d2 = dist2(p.x, p.y, e.x, e.y);
    if (d2 < nd) { nd = d2; nearest = e; }
    count++;
    const d = Math.sqrt(d2) || 1;
    if (d < ring) {
      const w = (ring - d) / ring;
      vx += (p.x - e.x) / d * w * 3;
      vy += (p.y - e.y) / d * w * 3;
    }
  }
  // dodge enemy projectiles
  for (const pr of sim.projPool) {
    if (pr.friendly) continue;
    const d = Math.hypot(p.x - pr.x, p.y - pr.y) || 1;
    if (d < 110) { vx += (p.x - pr.x) / d * 2.5; vy += (p.y - pr.y) / d * 2.5; }
  }
  // hunt when nothing is inside the ring (stragglers like Lobbers)
  if (nearest && nd > (ring + 30) * (ring + 30)) {
    const d = Math.sqrt(nd);
    vx += (nearest.x - p.x) / d * 1.6;
    vy += (nearest.y - p.y) / d * 1.6;
  }
  // wall avoidance: strong pull toward center when near edges
  const cx = sim.W / 2 - p.x, cy = sim.H / 2 - p.y;
  const edge = Math.min(p.x, sim.W - p.x, p.y, sim.H - p.y);
  if (edge < 150) { const cl = Math.hypot(cx, cy) || 1; vx += cx / cl * 2.2; vy += cy / cl * 2.2; }
  // dodge telegraphs
  for (const tg of sim.telegraphs) {
    if (tg.spawnMark) continue;
    const d = Math.hypot(p.x - tg.x, p.y - tg.y) || 1;
    if (d < (tg.r || 120) + 40) { vx += (p.x - tg.x) / d * 4; vy += (p.y - tg.y) / d * 4; }
  }
  // grab pickups when safe
  if (count === 0 && sim.pickups.length) {
    const m = sim.pickups[0];
    const d = Math.hypot(m.x - p.x, m.y - p.y) || 1;
    vx += (m.x - p.x) / d; vy += (m.y - p.y) / d;
  }
  const len = Math.hypot(vx, vy) || 1;
  sim.setInput(0, { mx: vx / len, my: vy / len });
}

function resolveUi() {
  let g = 0;
  while (p.pendingOffer && g++ < 30) sim.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
  if (p.treasureOffer) sim.uiAction(0, { kind: 'treasure', id: p.treasureOffer.picks[0] });
  if (p.shop) {
    for (let s = 0; s < 4; s++) sim.uiAction(0, { kind: 'buy', slot: s });
    sim.uiAction(0, { kind: 'closeShop' });
  }
}

let report = [];
outer:
for (const floor of [1, 2]) {
  const order = sim.floor.rooms.filter(r => r.kind !== 'boss').map(r => r.id).concat([sim.floor.bossId]);
  for (const id of order) {
    sim._enterRoom(id, null);
    const kind = sim.floor.rooms[id].kind;
    const t0 = sim.tickNum;
    let ticks = 0;
    while ((sim.roomLocked || sim.boss) && ticks < 60 * 150) {
      botInput();
      sim.tick();
      ticks++;
      if (sim.over) break;
    }
    sim.events.length = 0;
    const secs = (sim.tickNum - t0) / 60;
    if (kind !== 'start' && kind !== 'shop' && kind !== 'treasure') {
      report.push(`floor ${floor} ${kind} room ${id}: ${secs.toFixed(1)}s, hp ${Math.round(p.hp)}/${p.stats.maxHp}, lvl ${p.level}, mats ${p.materials}, weapons ${p.weapons.length}`);
    }
    if (sim.over) { report.push(`BOT DIED on floor ${floor} in ${kind} room`); break outer; }
    if (ticks >= 60 * 150) {
      const left = {};
      for (const e of sim.enemyPool) { const k = e.boss ? 'BOSS' : e.def.id; left[k] = (left[k] || 0) + 1; }
      report.push(`STUCK: floor ${floor} ${kind} room >150s — remaining: ${JSON.stringify(left)} queue:${sim.spawnQueue.length} pulses:${sim.pulses.length - sim.pulseIdx}`);
      break outer;
    }
    for (let i = 0; i < 90; i++) sim.tick(); // vacuum mats
    resolveUi();
    sim.events.length = 0;
  }
  if (sim.floorNum < 2 && !sim.over) {
    // descend via hatch
    let g = 0;
    while (sim.floorNum === floor && g++ < 400 && sim.hatch) { p.x = sim.hatch.x; p.y = sim.hatch.y; sim.tick(); }
    resolveUi();
    sim.events.length = 0;
  }
}
console.log(`=== balance probe: ${charId} ===`);
console.log(report.join('\n'));
console.log(sim.over ? (sim.result && sim.result.win ? 'WON' : 'DIED') : `alive after floor ${sim.floorNum} probe — looks sane`);
