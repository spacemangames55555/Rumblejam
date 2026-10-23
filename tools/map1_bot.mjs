// Five solo Standard map-1 fights with the balance_probe kiting bot.
//
// Playtester runs use tools/balance_probe.mjs (a mediocre-human kite, no god
// mode). That probe walks a whole region. This one stops at region 1's first
// combat node — the onboarding map — and reports clear, death, or stall.
// The bot itself is the probe's: same ring, same telegraph dodge, same
// level-up pick (the first card), same opening (left for the arena floor,
// which grants that same first card).
//
// Usage: node tools/map1_bot.mjs [--chase] [seed ...]
// Default seeds: 777, 0xa11ce, 424242, 20260728, 99.
// --chase walks onto the nearest enemy. Without it this is the balance_probe kite.

import { Sim } from '../js/game.js';
import { dist2 } from '../js/util.js';
import { WEAPON_BY_ID } from '../js/content/weapons.js';
import { isOnboardingNode } from '../js/arenas.js';

const CHAR = 'toh_samurai';
const DEFAULT_SEEDS = [777, 0xa11ce, 424242, 20260728, 99];
const FIGHT_CAP_S = 200;

const chase = process.argv.includes('--chase');
const seeds = process.argv.slice(2).filter(s => s !== '--chase').map(s => Number(s)).filter(n => Number.isFinite(n));
const list = seeds.length ? seeds : DEFAULT_SEEDS;

function runSeed(seed) {
  const sim = new Sim({
    seed, difficulty: 'standard', regionIndex: 1,
    party: [{ idx: 0, key: 'k', name: 'BOT', charId: CHAR, color: '#fff' }],
  });
  const p = sim.players[0];

  function botInput() {
    const mopUp = sim.wave && sim.wave.done && sim.enemyPool.count <= 12;
    const wdef = p.weapons[0] ? WEAPON_BY_ID[p.weapons[0].id] : null;
    const melee = wdef && (wdef.cls === 'swing' || wdef.cls === 'thrust');
    const ring = wdef ? (melee ? Math.max(70, wdef.range * 0.75) : (mopUp ? 110 : 230)) : 200;
    let vx = 0, vy = 0;
    let nearest = null, nd = Infinity, count = 0;
    for (const e of sim.enemyPool) {
      const d2 = dist2(p.x, p.y, e.x, e.y);
      if (d2 < nd) { nd = d2; nearest = e; }
      count++;
      const d = Math.sqrt(d2) || 1;
      if (!chase && d < ring) {
        const w = (ring - d) / ring;
        vx += (p.x - e.x) / d * w * 3;
        vy += (p.y - e.y) / d * w * 3;
      }
    }
    if (chase && nearest) {
      const d = Math.sqrt(nd) || 1;
      vx += (nearest.x - p.x) / d * 4;
      vy += (nearest.y - p.y) / d * 4;
    }
    if (!chase) for (const pr of sim.projPool) {
      if (pr.friendly) continue;
      const d = Math.hypot(p.x - pr.x, p.y - pr.y) || 1;
      if (d < 110) { vx += (p.x - pr.x) / d * 2.5; vy += (p.y - pr.y) / d * 2.5; }
    }
    if (!chase && nearest && nd > (ring + 30) * (ring + 30)) {
      const d = Math.sqrt(nd);
      vx += (nearest.x - p.x) / d * 1.6;
      vy += (nearest.y - p.y) / d * 1.6;
    }
    if (mopUp && melee && nearest) {
      const d = Math.sqrt(nd) || 1;
      vx = (nearest.x - p.x) / d * 4;
      vy = (nearest.y - p.y) / d * 4;
    }
    const cx = sim.W / 2 - p.x, cy = sim.H / 2 - p.y;
    const edge = Math.min(p.x, sim.W - p.x, p.y, sim.H - p.y);
    if (edge < 150) { const cl = Math.hypot(cx, cy) || 1; vx += cx / cl * 2.2; vy += cy / cl * 2.2; }
    for (const o of sim.obstacles) {
      const ox = o.x + o.w / 2, oy = o.y + o.h / 2;
      const d = Math.hypot(p.x - ox, p.y - oy) || 1;
      if (d < Math.max(o.w, o.h) / 2 + 60) { vx += (p.x - ox) / d * 1.8; vy += (p.y - oy) / d * 1.8; }
    }
    for (const tg of sim.telegraphs) {
      if (tg.spawnMark) continue;
      const d = Math.hypot(p.x - tg.x, p.y - tg.y) || 1;
      if (d < (tg.r || 120) + 40) { vx += (p.x - tg.x) / d * 4; vy += (p.y - tg.y) / d * 4; }
    }
    for (const hz of sim.hazards || []) {
      if (hz.type === 'lava') {
        const d = Math.hypot(p.x - hz.x, p.y - hz.y) || 1;
        if (d < hz.r + 50) { vx += (p.x - hz.x) / d * 4; vy += (p.y - hz.y) / d * 4; }
      } else if (p.x > hz.x - 30 && p.x < hz.x + hz.w + 30 && p.y > hz.y - 30 && p.y < hz.y + hz.h + 30) {
        const ox = hz.x + hz.w / 2, oy = hz.y + hz.h / 2;
        const d = Math.hypot(p.x - ox, p.y - oy) || 1;
        vx += (p.x - ox) / d * 4; vy += (p.y - oy) / d * 4;
      }
    }
    if (sim.pickups.length) {
      let nd2 = Infinity, mx = 0, my = 0;
      for (const m of sim.pickups) {
        const d2 = (m.x - p.x) * (m.x - p.x) + (m.y - p.y) * (m.y - p.y);
        if (d2 < nd2) { nd2 = d2; mx = m.x; my = m.y; }
      }
      const sweep = sim.wave && sim.wave.done && sim.enemyPool.count <= 8;
      if (sweep) {
        const d = Math.sqrt(nd2) || 1;
        vx += (mx - p.x) / d * 3; vy += (my - p.y) / d * 3;
      } else if (nd2 < 300 * 300) {
        const d = Math.sqrt(nd2) || 1;
        vx += (mx - p.x) / d * 0.8; vy += (my - p.y) / d * 0.8;
      }
    }
    const len = Math.hypot(vx, vy) || 1;
    sim.setInput(0, { mx: vx / len, my: vy / len });
  }

  function resolveUi() {
    let g = 0;
    while (p.pendingOffer && g++ < 30) sim.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  }

  const starts = sim.reachableNodes();
  const nodeId = starts.find(id => isOnboardingNode(sim.regionIndex, sim.floor.nodes[id])) ?? starts[0];
  const node = sim.floor.nodes[nodeId];
  sim.uiAction(0, { kind: 'pickNode', nodeId });
  if (sim.phase !== 'arena' || !isOnboardingNode(sim.regionIndex, sim.arenaNode)) {
    return { seed, outcome: 'error', detail: `did not enter map 1 (phase ${sim.phase}, node ${node && node.kind})` };
  }

  const cap = FIGHT_CAP_S * 60;
  let ticks = 0, peak = 0;
  while (sim.phase === 'arena' && !sim.over && !sim.cleared && ticks++ < cap) {
    botInput();
    sim.tick();
    peak = Math.max(peak, sim.enemyPool.count);
    if (ticks % 30 === 0) resolveUi();
  }

  const left = {};
  for (const e of sim.enemyPool) {
    const k = e.def ? e.def.id : '?';
    left[k] = (left[k] || 0) + 1;
  }
  let outcome = 'stall';
  if (sim.cleared || sim.phase === 'map') outcome = 'clear';
  else if (sim.over) outcome = 'death';
  return {
    seed,
    outcome,
    secs: +(ticks / 60).toFixed(1),
    peak,
    alive: sim.enemyPool.count,
    queue: sim.spawnQueue.length,
    waveDone: !!(sim.wave && sim.wave.done),
    hp: Math.round(p.hp),
    maxHp: p.stats.vitality,
    level: p.level,
    left,
    node: `${node.kind}/${node.template}`,
  };
}

const rows = list.map(runSeed);
let clears = 0, deaths = 0, stalls = 0;
for (const r of rows) {
  if (r.outcome === 'clear') clears++;
  else if (r.outcome === 'death') deaths++;
  else stalls++;
  const tag = r.seed === 0xa11ce ? '0xa11ce' : String(r.seed);
  console.log(`${tag}\t${r.outcome}\t${r.secs}s\talive ${r.alive} peak ${r.peak} queue ${r.queue} waveDone ${r.waveDone} hp ${r.hp}/${r.maxHp} lvl ${r.level} ${r.node || ''} ${r.left ? JSON.stringify(r.left) : r.detail || ''}`);
}
console.log(`TOTAL\tclears ${clears}/${rows.length}\tdeaths ${deaths}\tstalls ${stalls}`);
