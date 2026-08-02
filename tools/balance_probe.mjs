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

function steerTo(x, y) {
  const d = Math.hypot(x - p.x, y - p.y) || 1;
  sim.setInput(0, { mx: (x - p.x) / d, my: (y - p.y) / d });
}

function botInput() {
  // a "mediocre human": kite at ring distance, avoid walls, hunt stragglers.
  // Mop-up stance: once spawning is over and only stragglers remain, stand
  // ground at mid-range instead of kiting to the horizon — hits must land.
  // no HP gate: fleeing forever isn't an option the game offers — the fight
  // must be finished to leave, so a hurt bot fights hurt (and may die honestly)
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
  // melee mop-up: charge the nearest straggler down through its fire —
  // flee-forever against a handful of ranged holdouts is the one thing a
  // human never does (overrides kite + projectile-dodge, keeps telegraphs)
  if (mopUp && melee && nearest) {
    const d = Math.sqrt(nd) || 1;
    vx = (nearest.x - p.x) / d * 4;
    vy = (nearest.y - p.y) / d * 4;
  }
  // objective pull: the levels that don't end by killing need the bot to go
  // somewhere specific. Weighted alongside kiting rather than overriding it,
  // so the probe still reports honest survivability while making progress.
  const obj = sim.obj;
  if (obj && !obj.done) {
    let gx = null, gy = null, weight = 2.6;
    if (obj.type === 'zone') { gx = obj.zone.x; gy = obj.zone.y; }
    else if (obj.type === 'storm') { gx = obj.c.x; gy = obj.c.y; weight = 4.5; }
    else if (obj.type === 'breach') { gx = obj.gate.x; gy = obj.gate.y; weight = 4; }
    else if (obj.type === 'payload') { gx = obj.x; gy = obj.y; }
    else if (obj.type === 'relic') {
      const mine = obj.relics.find(r => r.carrier === 0);
      if (mine) { gx = obj.altar.x; gy = obj.altar.y; weight = 4; }
      else {
        let best = null, bd = Infinity;
        for (const r of obj.relics) {
          if (r.carrier >= 0) continue;
          const d2 = dist2(p.x, p.y, r.x, r.y);
          if (d2 < bd) { bd = d2; best = r; }
        }
        if (best) { gx = best.x; gy = best.y; weight = 3.2; }
      }
    } else if (obj.type === 'nest') {
      let best = null, bd = Infinity;
      for (const id of obj.nests) {
        const e = sim.enemyById(id); if (!e) continue;
        const d2 = dist2(p.x, p.y, e.x, e.y);
        if (d2 < bd) { bd = d2; best = e; }
      }
      if (best) { gx = best.x; gy = best.y; weight = 2.2; }
    } else if (obj.type === 'bounty' && obj.markId !== null) {
      const e = sim.enemyById(obj.markId);
      if (e) { gx = e.x; gy = e.y; weight = 2.2; }
    }
    if (gx !== null) {
      const d = Math.hypot(gx - p.x, gy - p.y) || 1;
      const inPlace = (obj.type === 'zone' && d < obj.zone.r * 0.6)
        || (obj.type === 'storm' && d < obj.r * 0.6);
      if (!inPlace) { vx += (gx - p.x) / d * weight; vy += (gy - p.y) / d * weight; }
    }
  }
  // wall avoidance: strong pull toward center when near arena edges
  const cx = sim.W / 2 - p.x, cy = sim.H / 2 - p.y;
  const edge = Math.min(p.x, sim.W - p.x, p.y, sim.H - p.y);
  if (edge < 150) { const cl = Math.hypot(cx, cy) || 1; vx += cx / cl * 2.2; vy += cy / cl * 2.2; }
  // sidle away from obstacle blocks so kiting doesn't pin against them
  for (const o of sim.obstacles) {
    const ox = o.x + o.w / 2, oy = o.y + o.h / 2;
    const d = Math.hypot(p.x - ox, p.y - oy) || 1;
    if (d < Math.max(o.w, o.h) / 2 + 60) { vx += (p.x - ox) / d * 1.8; vy += (p.y - oy) / d * 1.8; }
  }
  // dodge telegraphs and hazards
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
  // siege priorities a human reads off the edge arrows: burn the ward pylon
  // (it buffs everything), then focus the boss — weapons hit what you stand near
  let objective = sim.boss;
  for (const e of sim.enemyPool) if (e.def && e.def.behavior === 'pylon') { objective = e; break; }
  // once spawning stops, hunt the SOURCES first — the enemies that keep the
  // rest alive: Wombden nests replenish the field, Aegimand wardens shield
  // it, Stitcher medics out-heal a low-DPS kit. Nearest-target weapons never
  // break those stalemates on their own; a player reads the field and walks.
  const SOURCES = { nest: 1, warden: 1, medic: 1 };
  if (!objective && sim.wave && sim.wave.done) {
    let bestD = Infinity;
    for (const e of sim.enemyPool) {
      if (!e.def || !SOURCES[e.def.behavior]) continue;
      const d2 = dist2(p.x, p.y, e.x, e.y);
      if (d2 < bestD) { bestD = d2; objective = e; }
    }
  }
  if (objective) {
    const d = Math.hypot(objective.x - p.x, objective.y - p.y) || 1;
    // healthy → commit to the dive (shove through chaff like a player) and
    // walk all the way ON TO the objective — hovering at the edge leaves its
    // brood/adds holding the nearest-target slot; hurt → hover and whittle
    const healthy = p.hp > p.stats.vitality * 0.45;
    const pull = d > 60 ? (healthy ? 7 : 2.2) : 1.2;
    vx += (objective.x - p.x) / d * pull; vy += (objective.y - p.y) / d * pull;
  }
  // contest the hold circle when it's safe-ish
  if (sim.holdCircle && count < 12) {
    const c = sim.holdCircle;
    const d = Math.hypot(c.x - p.x, c.y - p.y) || 1;
    vx += (c.x - p.x) / d * 1.2; vy += (c.y - p.y) / d * 1.2;
  }
  // money doesn't wait (patch 9): the counter's lesson — once spawning stops
  // and only stragglers remain, run the field for the money BEFORE the last
  // kill fizzles it; mid-fight, scoop drops that are already close
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
      steerTo(best.x, best.y);
    } else if (sim.hatch) steerTo(sim.hatch.x, sim.hatch.y);
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
