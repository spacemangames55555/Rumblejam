// Fodder time-to-kill with each class's level-1 registry opener (rank 1), solo, map 1 node.
import { Sim } from '../js/game.js';
import { TREES, TREES_BY_CLASS } from '../js/skills.js';
import { isOnboardingNode } from '../js/arenas.js';
const FOE = process.argv[2] || 'pnw_thornhound';
const opener = (id) => { for (const t of TREES_BY_CLASS[id] || []) { const s = TREES[t].skills.find(s => s.tier === 1); if (s) return s; } };
function run(charId, N, R, secs = 30, seed = 777) {
  const sim = new Sim({ seed, regionIndex: 1, party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const p = sim.players[0];
  const sk = opener(charId);
  sim.uiAction(0, { kind: 'learnSkill', id: sk.id });
  const starts = sim.reachableNodes();
  const nodeId = starts.find(id => isOnboardingNode(sim.regionIndex, sim.floor.nodes[id])) ?? starts[0];
  sim.uiAction(0, { kind: 'pickNode', nodeId });
  Object.assign(sim.wave, { r0: 0, r1: 0, dur: 1e9, rampT: 1e9 }); sim.spawnQueue.length = 0;
  for (const e of [...sim.enemyPool]) sim.enemyPool.release ? null : null;
  p.x = sim.W / 2; p.y = sim.H / 2;
  const hit = new Map(); const ttk = []; let kills0 = sim.payout.kills; let k = 0; let maxHp = 0;
  let ang = 0; const t0 = sim.time;
  for (let i = 0; i < secs * 60 && sim.phase === 'arena'; i++) {
    while (sim.enemyPool.count < N) {
      ang += 2.39996; const e = sim.spawnEnemyById(FOE, p.x + Math.cos(ang) * R, p.y + Math.sin(ang) * R);
      if (!e) break; maxHp = e.maxHp; e.spd = 0; // stationary: measures the skill, not the approach
    }
    sim.setInput(0, { mx: 0, my: 0 });
    p.hp = p.stats.vitality; p.level = Math.min(p.level, 1); p.pendingOffer = null;
    const live = new Set();
    for (const e of sim.enemyPool) { live.add(e.id); if (!hit.has(e.id) && e.hp < e.maxHp) hit.set(e.id, sim.time); }
    sim.tick();
    const now = new Set(); for (const e of sim.enemyPool) now.add(e.id);
    for (const id of live) if (!now.has(id)) { k++; if (hit.has(id)) ttk.push(sim.time - hit.get(id)); }
  }
  ttk.sort((a, b) => a - b);
  const el = sim.time - t0; return { el: +el.toFixed(1), kps: +(k / el).toFixed(2), ttkMed: ttk.length ? +ttk[Math.floor(ttk.length / 2)].toFixed(2) : null, maxHp };
}
for (const id of Object.keys(TREES_BY_CLASS)) {
  const sk = opener(id);
  const one = run(id, 1, 90), pack = run(id, 12, 90);
  const st=(sk.compose||[])[0]||{}; console.log(`${id}\t${sk.id}\tcd ${sk.cooldown}\t${st.kind} dmg ${JSON.stringify(st.damage)}\tfoeHP ${one.maxHp}\tsingle: ${one.kps} kills/s (${one.el}s), ttk ${one.ttkMed===null?'one-shot':one.ttkMed+'s'}\tpack12@90u: ${pack.kps} kills/s (${pack.el}s)`);
}
