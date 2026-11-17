// DO A SUMMONER'S MINIONS LIVE? — a measurement, not a gate.
//
// Every output probe in tools/ runs the player in god mode, and a minion is
// not the player: it takes the room's damage in full. Enemy damage rides the
// world axis (×6.34 by region 8). A character's own vitality grows with stat
// cards. A minion's health grows with Ingenuity and the summon's rank and
// nothing else — so the question "is the pack standing?" has a different
// answer in every region, and until this tool nothing asked it.
//
// It was found sideways: `combat_gate` could not stage a Druid pack because
// all three beasts were down fifteen seconds into a region-1 room.
//
// For each summoner class, in a real room at each asked region (map 3, the
// level a player has there, a build made by tools/lib/build_char.mjs, the room
// bot kiting): the share of the wave each minion spent standing, how many
// times it went down, and its health against one hit from the region's fodder.
//
// Usage: node tools/minion_uptime.mjs [--regions=1,2,5,8] [--classes=druid,hunter,necromancer] [--seeds=2]
import { Sim } from '../js/game.js';
import { buildCharacter } from './lib/build_char.mjs';
import { ringFor, botInput, answerOffers } from './lib/room_bot.mjs';
import { anchorLevel, regionDmgMult } from '../js/regions.js';
import { REGION_ENEMIES, enemyRole } from '../js/content/regions-enemies.js';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const regions = arg('regions', '1,2,5,8').split(',').map(Number);
const classes = arg('classes', 'druid,hunter,necromancer').split(',').map(c => c.startsWith('toh_') ? c : `toh_${c}`);
const NSEEDS = +arg('seeds', 2);
const DEPTH = 2;

function stage(regionIndex, classId, seed0) {
  for (let k = 0, seed = seed0; k < 24; k++, seed += 6151) {
    const sim = new Sim({ seed, regionIndex, party: [{ idx: 0, key: 'k', name: 'B', charId: classId, color: '#fff' }] });
    sim.god = true;                                  // the PLAYER cannot die; the minions can
    const level = Math.round(anchorLevel(regionIndex) + 1.5 * DEPTH);
    const { p } = buildCharacter(sim, { level });
    const node = sim.floor.nodes.find(n => n.kind === 'combat' && (n.depth || 1) === DEPTH + 1);
    if (!node) continue;
    sim._travelTo(node.id);
    if (sim.phase === 'arena' && !sim.obj) return { sim, p, level };
  }
  return null;
}

function run(regionIndex, classId, seed) {
  const st = stage(regionIndex, classId, seed);
  if (!st) return null;
  const { sim, p, level } = st;
  const ring = ringFor(p);
  const by = new Map();
  let ticks = 0;
  for (let i = 0; i < 200 * 60 && sim.phase === 'arena'; i++) {
    botInput(sim, p, ring, {});
    sim.tick(); answerOffers(sim, p);
    if (!(sim.wave && !sim.wave.done)) { if (sim.enemyPool.count === 0 && sim.spawnQueue.length === 0) break; continue; }
    ticks++;
    for (const m of p.minions) {
      const k = m.arch || m.kind || 'minion';
      let s = by.get(k);
      if (!s) by.set(k, s = { up: 0, seen: 0, downs: 0, wasDown: false, maxHp: 0 });
      s.seen++; s.maxHp = Math.max(s.maxHp, m.maxHp || 0);
      const down = !!(m.down || m.dead);
      if (!down) s.up++;
      if (down && !s.wasDown) s.downs++;
      s.wasDown = down;
    }
  }
  return { level, ticks, by, ingenuity: p.stats.ingenuity, vitality: p.stats.vitality };
}

console.log(`MINION UPTIME — map ${DEPTH + 1} of each region, the player in god mode, the minions mortal, ${NSEEDS} seed(s)\n`);
console.log('reg  lvl  class         minion      health  fodder hit  hits to kill   standing   downs/room   (owner: vitality, Summons)');
for (const ri of regions) {
  const pop = Object.values(REGION_ENEMIES)[ri - 1];
  const fodder = pop.enemies.filter(e => enemyRole(e) === 'fodder');
  const hit = Math.max(...fodder.map(e => e.dmg)) * regionDmgMult(ri);
  for (const c of classes) {
    const agg = new Map(); let lvl = 0, vit = 0, ing = 0, n = 0;
    for (let s = 0; s < NSEEDS; s++) {
      const r = run(ri, c, 100 + s * 977);
      if (!r) continue;
      n++; lvl = r.level; vit += r.vitality; ing += r.ingenuity;
      for (const [k, v] of r.by) {
        const a = agg.get(k) || { up: 0, seen: 0, downs: 0, maxHp: 0, rooms: 0 };
        a.up += v.up; a.seen += v.seen; a.downs += v.downs; a.maxHp = Math.max(a.maxHp, v.maxHp); a.rooms++;
        agg.set(k, a);
      }
    }
    if (!n) { console.log(`${String(ri).padStart(3)}       ${c.replace('toh_', '').padEnd(13)} no room staged`); continue; }
    if (!agg.size) { console.log(`${String(ri).padStart(3)}  ${String(lvl).padStart(3)}  ${c.replace('toh_', '').padEnd(13)} fielded no minion`); continue; }
    for (const [k, a] of agg) {
      console.log(`${String(ri).padStart(3)}  ${String(lvl).padStart(3)}  ${c.replace('toh_', '').padEnd(13)} ${k.padEnd(11)} ${String(Math.round(a.maxHp)).padStart(6)}  ${hit.toFixed(1).padStart(10)}  ${(a.maxHp / hit).toFixed(1).padStart(12)}   ${(100 * a.up / Math.max(1, a.seen)).toFixed(0).padStart(7)}%   ${(a.downs / a.rooms).toFixed(1).padStart(10)}   (${Math.round(vit / n)}, ${Math.round(ing / n)})`);
    }
  }
  console.log('');
}
