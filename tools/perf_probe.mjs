import { Sim } from '../js/game.js';
import { isOnboardingNode } from '../js/arenas.js';
import { encodeSnap, wireSize } from '../js/netcodec.js';
const ids = ['pnw_thornhound','pnw_sapling','pnw_cedar_warden','pnw_mistwalker'];
for (const N of [25, 60, 100, 150, 200, 300]) {
  const sim = new Sim({ seed: 777, regionIndex: 1, party: [{ idx: 0, key: 'k', name: 'P', charId: 'toh_samurai', color: '#fff' }] });
  sim.uiAction(0, { kind: 'learnSkill', id: 'sam_cross_guard' });
  const s = sim.reachableNodes(); sim.uiAction(0, { kind: 'pickNode', nodeId: s.find(id => isOnboardingNode(1, sim.floor.nodes[id])) ?? s[0] });
  Object.assign(sim.wave, { r0: 0, r1: 0, dur: 1e9, rampT: 1e9 });
  const p = sim.players[0];
  let k = 0, ms = 0, n = 0;
  for (let i = 0; i < 600; i++) {
    while (sim.enemyPool.count < N) { const a = (k++) * 2.4; sim.spawnEnemyById(ids[k % 4], sim.W/2 + Math.cos(a) * (250 + (k % 7) * 40), sim.H/2 + Math.sin(a) * (200 + (k%5)*30)); }
    p.hp = p.stats.vitality;
    const t0 = performance.now(); sim.tick(); const dt = performance.now() - t0;
    if (i >= 60) { ms += dt; n++; }
  }
  const snap = JSON.stringify(sim.getSnapshot()); const wire = wireSize(encodeSnap(sim.getSnapshot())); console.log(`alive ${N}\tavg sim tick ${(ms/n).toFixed(3)} ms\tprojectiles ${sim.projPool.count}\tjson ${(snap.length/1024).toFixed(1)} KB, wire ${(wire/1024).toFixed(1)} KB (~${(wire*15/1024).toFixed(0)} KB/s at 15Hz)`);
}
