// Horde-pace profiler (pace-spec.md §8, Playtester's §7 co-op bar).
//
// Holds N live region-1 enemies around the party with skills firing and
// reports, per N: sim tick p50/p95/max (ms), and the ENCODED wire snapshot
// (js/netcodec.js encodeSnap → wireSize, the same bytes main.js's uvNet ledger
// counts) — mean and peak, split into enemies / telegraphs+zones / rest, and
// kB/s per guest at CONFIG.SNAPSHOT_HZ. Runs solo and as a 4-player host.
//
//   node tools/horde_profile.mjs                 # 60 100 120 150 200, solo + 4p
//   node tools/horde_profile.mjs --n 50,100,150  # custom counts
//   node tools/horde_profile.mjs --ticks 900 --json
//   node tools/horde_profile.mjs --cull          # also report with interest culling off-screen chaff
//
// Not a gate: it prints numbers. The 8 KB/snapshot bar is pace-spec §7.
import { Sim } from '../js/game.js';
import { CONFIG } from '../js/config.js';
import { isOnboardingNode } from '../js/arenas.js';
import { encodeSnap, wireSize } from '../js/netcodec.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const NS = String(arg('--n', '60,100,120,150,200')).split(',').map(Number);
const TICKS = +arg('--ticks', 720);
const JSON_OUT = process.argv.includes('--json');
const BUDGET = 8 * 1024;
// map-1 horde mix: fodder (thornhound, sapling, mistwalker) + the one special
// (cedar warden, lane telegraph). Weighted like the spec's §4 table so the
// telegraph list carries a realistic special share (~12%), plus spawn marks.
const MIX = ['pnw_thornhound', 'pnw_thornhound', 'pnw_sapling', 'pnw_sapling', 'pnw_thornhound',
  'pnw_sapling', 'pnw_mistwalker', 'pnw_cedar_warden'];
const PARTY4 = [['toh_samurai', 'sam_cross_guard'], ['toh_priest', null], ['toh_mage', null], ['toh_savage', null]];

function pct(a, q) { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }

function run(N, nPlayers) {
  const party = PARTY4.slice(0, nPlayers).map(([charId], i) => ({ idx: i, key: 'k' + i, name: 'P' + i, charId, color: '#fff' }));
  const sim = new Sim({ seed: 777, regionIndex: 1, party });
  // learn each player's offered opener (the first offer), whatever the class
  for (const p of sim.players) {
    const off = p.openingOffer && (p.openingOffer.options || p.openingOffer.ids || p.openingOffer);
    const id = Array.isArray(off) ? (off[0]?.id ?? off[0]) : null;
    if (id) sim.uiAction(p.idx, { kind: 'learnSkill', id });
  }
  const s = sim.reachableNodes();
  for (const p of sim.players) sim.uiAction(p.idx, { kind: 'pickNode', nodeId: s.find(id => isOnboardingNode(1, sim.floor.nodes[id])) ?? s[0] });
  for (let i = 0; i < 400 && sim.phase !== 'arena'; i++) sim.tick();
  Object.assign(sim.wave, { r0: 0, r1: 0, dur: 1e9, rampT: 1e9 });
  let k = 0;
  const ticks = [], wire = [], parts = [];
  const snapEvery = Math.round(60 / CONFIG.SNAPSHOT_HZ);
  for (let i = 0; i < TICKS; i++) {
    while (sim.enemyPool.count < N) {
      const a = (k++) * 2.4;
      sim.spawnEnemyById(MIX[k % MIX.length], sim.W / 2 + Math.cos(a) * (250 + (k % 7) * 60), sim.H / 2 + Math.sin(a) * (200 + (k % 5) * 50));
    }
    for (const p of sim.players) { p.hp = p.stats.vitality; p.downed = false; }
    const t0 = performance.now(); sim.tick(); const dt = performance.now() - t0;
    if (i >= 60) ticks.push(dt);
    if (i >= 60 && i % snapEvery === 0) {
      const snap = sim.getSnapshot();
      const enc = encodeSnap(snap);
      const w = wireSize(enc);
      wire.push(w);
      const en = enc.eb ? enc.eb.byteLength + 6 : 0;
      const tz = (enc.tb ? enc.tb.byteLength + 6 : 0) + (enc.zb ? enc.zb.byteLength + 6 : 0);
      parts.push({ w, en, tz, nTel: snap.tele.length, nZones: snap.zones.length, nEn: snap.enemies.length, nProj: snap.projs.length });
    }
  }
  const peakI = wire.indexOf(Math.max(...wire));
  const pk = parts[peakI];
  return {
    N, players: nPlayers,
    tickP50: pct(ticks, 0.5), tickP95: pct(ticks, 0.95), tickMax: Math.max(...ticks),
    wireMean: wire.reduce((a, b) => a + b, 0) / wire.length, wirePeak: wire[peakI],
    peakEnemyBytes: pk.en, peakTelZoneBytes: pk.tz, peakOther: pk.w - pk.en - pk.tz,
    peakTel: pk.nTel, peakZones: pk.nZones, peakEnemiesShipped: pk.nEn, peakProjs: pk.nProj,
    kBsPerGuest: wire.reduce((a, b) => a + b, 0) / wire.length * CONFIG.SNAPSHOT_HZ / 1024,
    overBudget: wire.filter(w => w > BUDGET).length / wire.length,
  };
}

const rows = [];
for (const np of [1, 4]) for (const N of NS) rows.push(run(N, np));
if (JSON_OUT) console.log(JSON.stringify(rows, null, 1));
else {
  console.log(`snapshot rate ${CONFIG.SNAPSHOT_HZ} Hz, budget ${BUDGET} B/snapshot, ${TICKS} ticks/run (first 60 discarded)`);
  console.log('players\talive\ttick p50\tp95\tmax ms\twire mean B\tpeak B\t(enemies/tele+zones/other)\ttel/zones\tprojs\tkB/s/guest\t>8KB');
  for (const r of rows) console.log([r.players, r.N, r.tickP50.toFixed(3), r.tickP95.toFixed(3), r.tickMax.toFixed(2),
    r.wireMean.toFixed(0), r.wirePeak, `${r.peakEnemyBytes}/${r.peakTelZoneBytes}/${r.peakOther}`, `${r.peakTel}/${r.peakZones}`, r.peakProjs,
    r.kBsPerGuest.toFixed(1), (r.overBudget * 100).toFixed(0) + '%'].join('\t'));
}
