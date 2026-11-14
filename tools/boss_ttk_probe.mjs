// BOSS TIME-TO-KILL, region by region — a probe, not a gate.
//
// A character at the region's §4.3 anchor level (points spent breadth-first in
// tier order, as region_curve.mjs does), in god mode, fights the region's own
// boss in its real siege room. The clock starts when the boss spawns and stops
// at bossDown. Siege adds are culled every tick so the number is the BOSS's
// time to kill, not the room's.
//
// Usage: node tools/boss_ttk_probe.mjs [regionIndex ...]
import { Sim } from '../js/game.js';
import { TREES, TREES_BY_CLASS, slotsAtLevel } from '../js/skills.js';
import * as SKILLSIM from '../js/skillsim.js';
import { REGIONS, anchorLevel, bossForRegion } from '../js/regions.js';

const CLASSES = ['toh_blacksmith', 'toh_wizard', 'toh_necromancer', 'toh_druid'];
const SEEDS = [5, 6, 7];
const CAP_S = 600;
const args = process.argv.slice(2).map(Number).filter(n => n > 0);
const regions = args.length ? args : REGIONS.map(r => r.index);

function run(regionIndex, classId, seed) {
  const level = anchorLevel(regionIndex);
  const sim = new Sim({ seed, regionIndex, party: [{ idx: 0, key: 'k', name: 'C', charId: classId, color: '#fff' }] });
  sim.god = true;
  const p = sim.players[0];
  if (p.openingOffer) sim.uiAction(0, { kind: 'opening', id: p.openingOffer[0].id });
  p.level = level;
  const skills = (TREES_BY_CLASS[classId] || []).flatMap(t => TREES[t].skills).sort((a, b) => a.tier - b.tier);
  let budget = level - 1;
  for (let pass = 0; pass < 12 && budget > 0; pass++) {
    let spent = 0;
    for (const sk of skills) {
      if (budget <= 0) break;
      p.skillPoints++;
      if (SKILLSIM.spendSkillPoint(sim, p, sk.id)) { budget--; spent++; } else p.skillPoints--;
    }
    if (!spent) break;
  }
  const slots = slotsAtLevel(level);
  const learned = skills.filter(s => s.type === 'active' && (p.skillRanks[s.id] || 0) >= 1).map(s => s.id);
  if (learned.length) { p.loadout = new Array(8).fill(null); for (let i = 0; i < slots && i < learned.length; i++) p.loadout[i] = learned[i]; }
  sim._recomputeStats(p);
  sim._travelTo(sim.floor.bossId);
  sim.siegeT = sim.bossAt;
  for (let i = 0; i < 600 && !sim.boss; i++) sim.tick();
  const b = sim.boss;
  if (!b) return null;
  const maxHp = b.maxHp, t0 = sim.time;
  let p2At = null;
  for (let i = 0; i < CAP_S * 60 && b.active && b.hp > 0; i++) {
    for (const e of sim.enemyPool) if (e.active && !e.boss && e !== b && e.id !== sim.pylonId) { e.hp = 0; sim.enemyPool.release(e); }
    sim.tick();
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
    if (p.pendingOffer && p.pendingOffer.length) sim.uiAction(0, { kind: 'levelUp', id: p.pendingOffer[0].id });
    if (p2At === null && b.bs && b.bs.phase2) p2At = sim.time - t0;
  }
  const dead = !(b.active && b.hp > 0);
  return { ttk: dead ? sim.time - t0 : null, maxHp, p2At, left: dead ? 0 : b.hp };
}

const median = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN; };
const out = {};
for (const ri of regions) {
  const boss = bossForRegion(ri);
  const ttks = [];
  let hp = null;
  for (const c of CLASSES) {
    const per = [];
    for (const s of SEEDS) {
      const r = run(ri, c, s);
      if (!r) { console.log(`  region ${ri} ${c} seed ${s}: no boss spawned`); continue; }
      hp = r.maxHp;
      per.push(r.ttk ?? Infinity);
      console.log(`  region ${ri} ${c} seed ${s}: ${r.ttk === null ? `NOT DOWN in ${CAP_S}s (${Math.round(r.left)} left)` : `${r.ttk.toFixed(1)}s`} (phase 2 at ${r.p2At === null ? '—' : r.p2At.toFixed(1) + 's'})`);
    }
    ttks.push(median(per));
  }
  out[ri] = { boss: boss.id, authored: boss.hp, spawned: hp, ttk: median(ttks), perClass: ttks };
  console.log(`region ${ri} ${boss.id} (${boss.name}): authored ${boss.hp} HP, spawned ${hp} HP — median TTK ${median(ttks).toFixed(1)}s across ${CLASSES.join(', ')} at level ${anchorLevel(ri)} [${ttks.map(t => t.toFixed(1)).join(', ')}]\n`);
}
const base = out[1] && out[1].ttk;
if (base) for (const [ri, o] of Object.entries(out)) console.log(`region ${ri}: ${o.ttk.toFixed(1)}s = ×${(o.ttk / base).toFixed(2)} of region 1`);
