// Dev tool: organic balance probe. A simple kiting bot plays real combat (no
// debug cheats) so egregious balance failures show up: instant deaths,
// unkillable fights, siege walls. Not a tuning oracle — a smoke alarm.
// Walks the node map like a player: picks nodes, fights arenas, extracts,
// shops at stops, and takes the Siege at the end of each floor.
// Usage: node tools/balance_probe.mjs [charId] [floors=2]

import { Sim } from '../js/game.js';
import { dist2 } from '../js/util.js';
import { WEAPON_BY_ID } from '../js/content/weapons.js';

const charId = process.argv[2] || 'bulwark';
const maxFloor = Math.min(4, parseInt(process.argv[3] || '2', 10));
const sim = new Sim({ seed: 20260728, party: [{ idx: 0, key: 'k', name: 'BOT', charId, color: '#fff' }] });
const p = sim.players[0];

import { pilot, steerTo } from './pilot.mjs';
// steering lives in tools/pilot.mjs so this tool and run_continuity cannot
// drift into two different ideas of how a room is played.
const botInput = () => pilot(sim, p);

// materials-flow ledger, reported per floor (the economy interlock: denser
// waves fund the shop at every extraction)
const econ = { spent: 0, bought: 0, weapons: 0, sessions: 0, lastShopKey: null };

function resolveUi() {
  let g = 0;
  while (p.pendingOffer && g++ < 30) sim.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
  if (p.treasureOffer) sim.uiAction(0, { kind: 'treasure', id: p.treasureOffer.picks[0] });
  if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  if (p.shop && p.shop.key !== econ.lastShopKey) { econ.lastShopKey = p.shop.key; econ.sessions++; }
  if (p.shop) {
    // like a human on a budget: cheapest affordable first (high-Greed characters
    // roll pricier rarities and would otherwise walk out empty-handed)
    const tried = new Set();
    for (let pass = 0; pass < 6; pass++) {
      // weapons first while the rack is thin — DPS wins fights, trinkets don't
      const wantWeapon = p.weapons.length < 3;
      let best = -1, bestPrice = Infinity, bestIsWeapon = false;
      p.shop.stock.forEach((s, i) => {
        if (s.sold || tried.has(i) || s.price > p.materials) return;
        const isW = s.kind === 'weapon';
        const better = wantWeapon ? (isW && !bestIsWeapon) || (isW === bestIsWeapon && s.price < bestPrice) : s.price < bestPrice;
        if (better) { best = i; bestPrice = s.price; bestIsWeapon = isW; }
      });
      if (best < 0) break;
      tried.add(best);
      const m0 = p.materials, isW = p.shop.stock[best].kind === 'weapon';
      sim.uiAction(0, { kind: 'buy', slot: best });
      if (p.materials < m0) { econ.spent += m0 - p.materials; econ.bought++; if (isW) econ.weapons++; }
    }
    sim.uiAction(0, { kind: 'closeShop' });
  }
}

// prefer stops and treasure like a human would; dodge the Champion road (the
// map guarantees elites are optional — that's what the branch is FOR when
// playing a below-median kit); siege only when it's the only road
function pickNode() {
  const r = sim.reachableNodes();
  const byKind = k => r.find(id => sim.floor.nodes[id].kind === k);
  const id = byKind('treasure') ?? byKind('shop')
    ?? r.find(n => !['siege', 'elite'].includes(sim.floor.nodes[n].kind))
    ?? r.find(n => sim.floor.nodes[n].kind !== 'siege')
    ?? r[0];
  sim.uiAction(0, { kind: 'pickNode', nodeId: id });
  return id;
}

const report = [];
let stuck = false;
let floorMark = { floor: sim.floorNum, collected: 0, spent: 0, bought: 0, weapons: 0, sessions: 0 };
function floorEconLine() {
  const earned = p.matsCollected - floorMark.collected;
  report.push(`  floor ${floorMark.floor} economy: earned ${earned}, spent ${econ.spent - floorMark.spent} across ${econ.sessions - floorMark.sessions} shop sessions (${econ.bought - floorMark.bought} buys, ${econ.weapons - floorMark.weapons} weapons), holding ${p.materials}`);
  floorMark = { floor: sim.floorNum, collected: p.matsCollected, spent: econ.spent, bought: econ.bought, weapons: econ.weapons, sessions: econ.sessions };
}
outer:
while (!sim.over && sim.floorNum <= maxFloor && !stuck) {
  if (sim.floorNum !== floorMark.floor) floorEconLine();
  if (sim.phase === 'map') {
    resolveUi();
    pickNode();
    continue;
  }
  // in an arena: fight it out organically
  const node = sim.arenaNode, floor = sim.floorNum;
  const isSiege = node.kind === 'siege';
  const t0 = sim.tickNum;
  let ticks = 0, peak = 0;
  // low-DPS economy characters legitimately take ~2.5min on their first fight;
  // a CLEARED fight gets extra time for the extraction walk — only the fight
  // itself counts against the cap
  // objective levels run long by design (Zone Control is ~6×20s of holding
  // plus travel), so they get a bigger budget than a horde arena
  const isObj = sim.obj !== null && sim.obj !== undefined;
  const cap = 60 * (isSiege ? 360 : isObj ? 320 : 200);
  const extractCap = cap + 60 * 45;
  while (sim.phase === 'arena' && !sim.over && ticks++ < (sim.cleared ? extractCap : cap)) {
    if (!sim.cleared) botInput();
    else if (!sim.hatch && sim.pickups.length) { // the siege looting window: sweep!
      let best = null, bd = Infinity;
      for (const m of sim.pickups) { const d2 = (m.x - p.x) ** 2 + (m.y - p.y) ** 2; if (d2 < bd) { bd = d2; best = m; } }
      steerTo(sim, p, best.x, best.y);
    } else if (sim.hatch) steerTo(sim, p, sim.hatch.x, sim.hatch.y);
    sim.tick();
    peak = Math.max(peak, sim.enemyPool.count);
    if (ticks % 30 === 0) resolveUi();
    if (process.env.PROBE_LOG && ticks % 300 === 0) {
      let pyl = null;
      for (const e of sim.enemyPool) if (e.def && e.def.behavior === 'pylon') pyl = e;
      console.log(`  t=${(ticks / 60).toFixed(0)}s alive=${sim.enemyPool.count} hp=${Math.round(p.hp)}/${p.stats.vitality} waveDone=${!!(sim.wave && sim.wave.done)} boss=${sim.boss ? Math.round(sim.boss.hp) : '-'} pylon=${pyl ? Math.round(pyl.hp) : '-'} buff=${sim.enemyBuff}`);
    }
  }
  sim.events.length = 0;
  const secs = (sim.tickNum - t0) / 60;
  report.push(`floor ${floor} ${node.kind}${isSiege ? '' : ` (${node.template})`}: ${secs.toFixed(1)}s, peak ${peak} alive, hp ${Math.round(p.hp)}/${p.stats.vitality}, lvl ${p.level}, mats ${p.materials}, weapons ${p.weapons.length}`);
  if (sim.over) {
    report.push(sim.result && sim.result.win
      ? `RUN WON — the Vault Regent fell on floor ${floor}`
      : `BOT DIED on floor ${floor} in the ${node.kind} node`);
    break outer;
  }
  if (sim.phase === 'arena' && ticks >= (sim.cleared ? extractCap : cap)) {
    const left = {};
    for (const e of sim.enemyPool) { const k = e.boss ? 'BOSS' : e.def.id; left[k] = (left[k] || 0) + 1; }
    report.push(`STUCK: floor ${floor} ${node.kind} node — cleared=${sim.cleared} remaining=${JSON.stringify(left)} queue=${sim.spawnQueue.length}`);
    stuck = true;
  }
}
floorEconLine();
console.log(`=== balance probe: ${charId} (floors 1-${maxFloor}) ===`);
console.log(report.join('\n'));
console.log(sim.over ? (sim.result && sim.result.win ? 'WON' : 'DIED') : stuck ? 'STUCK — see above' : `alive on floor ${sim.floorNum} after the probe — looks sane`);
