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
import { REGIONS, expectedLevelAt, bossForRegion } from '../js/regions.js';
import { buildCharacter } from './lib/build_char.mjs';

const CLASSES = process.argv.includes('--ref') ? ['toh_blacksmith', 'toh_wizard', 'toh_necromancer', 'toh_druid'] : Object.keys(TREES_BY_CLASS);
const SEEDS = [5];
const CAP_S = 600;
const args = process.argv.slice(2).filter(a => !a.startsWith('--')).map(Number).filter(n => n > 0);
const regions = args.length ? args : REGIONS.map(r => r.index);

function run(regionIndex, classId, seed) {
  // THE LEVEL A PLAYER MEETS THE BOSS AT, not the level they entered the
  // region at: the boss is the sixth fight, five maps and 7.5 levels later
  // (expectedLevelAt). And a character BUILT, not assigned — this probe set
  // `p.level` and sent `{kind:'levelUp'}` for the stat cards, which is not an
  // action the sim has (it is `levelup`), so every figure it printed was for
  // a character with no stat cards at all.
  const level = Math.floor(expectedLevelAt(regionIndex, 5));
  const sim = new Sim({ seed, regionIndex, party: [{ idx: 0, key: 'k', name: 'C', charId: classId, color: '#fff' }] });
  sim.god = true;
  const { p } = buildCharacter(sim, { level });
  sim._travelTo(sim.floor.bossId);
  sim.siegeT = sim.bossAt;
  for (let i = 0; i < 600 && !sim.boss; i++) sim.tick();
  const b = sim.boss;
  if (!b) return null;
  const maxHp = b.maxHp, t0 = sim.time;
  let p2At = null;
  for (let i = 0; i < CAP_S * 60 && b.active && b.hp > 0; i++) {
    for (const e of sim.enemyPool) if (e.active && !e.boss && e !== b && e.id !== sim.pylonId && !(b.bs && e.id === b.bs.wardId)) { e.hp = 0; sim.enemyPool.release(e); }
    // A WARDED BOSS IS FOUGHT AT THE WARD. The character's only input is where
    // it stands, so a probe that stands still measures a boss it is not
    // fighting: Koschei read 272 s here because the bot stayed beside him
    // while he refused 85% of every hit. Walk to the ward while it stands.
    const ward = b.bs && b.bs.wardId ? sim.enemyById(b.bs.wardId) : null;
    if (ward) { const d = Math.hypot(ward.x - p.x, ward.y - p.y) || 1; sim.setInput(0, d > 90 ? { mx: (ward.x - p.x) / d, my: (ward.y - p.y) / d } : { mx: 0, my: 0 }); }
    else sim.setInput(0, { mx: 0, my: 0 });
    sim.tick();
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
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
  console.log(`region ${ri} ${boss.id} (${boss.name}): authored ${boss.hp} HP, spawned ${hp} HP — median TTK ${median(ttks).toFixed(1)}s across ${CLASSES.join(', ')} at level ${Math.floor(expectedLevelAt(ri, 5))} [${ttks.map(t => t.toFixed(1)).join(', ')}]\n`);
}
const base = out[1] && out[1].ttk;
if (base) for (const [ri, o] of Object.entries(out)) console.log(`region ${ri}: ${o.ttk.toFixed(1)}s = ×${(o.ttk / base).toFixed(2)} of region 1`);
