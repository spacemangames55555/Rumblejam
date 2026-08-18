// POWER CURVE — PHASE 1 SURVEY. Measures, changes nothing.
//
//   node tools/power_curve_survey.mjs [--quick]
//
// Six questions, asked because the tuning phase has to be specced against real
// numbers rather than against the design assumptions in the brief:
//
//   1. what level does a run actually END at, and how many points is that
//   2. where does each class's output stop growing
//   3. what does rank add today
//   4. endgame enemy count and HP, against an endgame build's throughput
//   5. sustain available, against incoming — and where they cross
//   6. how much damage is currently wasted as overkill
//
// EVERY NUMBER HERE IS MEASURED OR DERIVED FROM A MEASUREMENT, and where a
// figure is an extrapolation the extrapolation is printed next to it. §13 rule
// 37: a survey that quietly models what it could have measured is worse than
// one that says it did not measure.
import { FixtureSim as Sim } from './fixture_sim.mjs';
import * as SKILLSIM from '../js/skillsim.js';
import { TREES, TREES_BY_CLASS, TIER_LEVELS, SLOT_LEVELS, slotsAtLevel, skillRank } from '../js/skills.js';
import { SELECTABLE } from '../js/content/characters.js';
import { CONFIG } from '../js/config.js';
import { ITEMS } from '../js/content/items.js';
import { REGIONS, regionHpMult, regionDmgMult, TOTAL_REGIONS } from '../js/regions.js';
import { REGION_ENEMIES } from '../js/content/regions-enemies.js';

const QUICK = process.argv.includes('--quick');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean).map(Number);
const want = n => !ONLY.length || ONLY.includes(n);
const CLASSES = SELECTABLE.map(c => c.id);
const P = charId => [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }];
const H = t => { console.log('\n' + '='.repeat(92)); console.log(t); console.log('='.repeat(92)); };

const pump = (g, p) => {
  let k = 0;
  while (p.pendingOffer && k++ < 40) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
  if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
};

// SPEND N POINTS AS THE DESIGN DESCRIBES A BUILD, and the first version of this
// was wrong in a way worth recording: `learnableSkills` returns everything
// spendable INCLUDING already-learned nodes, because ranking up is a spend. So
// "take the deepest learnable" kept returning the same node forever — at 80
// points it learned 10 nodes and put rank 71 on one of them, and the flat DPS
// curve that produced was the harness, not the game (§13 rule 82).
//
// What a build actually is: learn breadth-first so prereqs open, then pour the
// remainder into the SLOTTED actives, which is what "8 skills at rank 10"
// means. `mode: 'concentrated'` puts the remainder into one skill instead —
// the other half of the tension the brief wants preserved.
function spend(g, p, points, mode = 'spread') {
  let left = points;
  // 1. breadth: one point into each distinct unlearned node, lowest tier first.
  //
  // `shallow` STOPS once the loadout is full — it buys the cheapest eight
  // actives it can slot and spends everything else on rank. `deep` and
  // `spread` keep learning until the trees run out, which is what reaches the
  // tier-10 capstones in all three. Those two shapes are the ends of the
  // spend spectrum, not a target and a shortfall.
  const slotCap = slotsAtLevel(p.level);
  for (let pass = 0; pass < 12 && left > 0; pass++) {
    if (mode === 'shallow' && (p.loadout || []).filter(Boolean).length >= slotCap) break;
    const fresh = SKILLSIM.learnableSkills(p)
      .filter(s => skillRank(p, s.id) < 1)
      .sort((a, b) => a.tier - b.tier);
    if (!fresh.length) break;
    for (const s of fresh) {
      if (left <= 0) break;
      if (mode === 'shallow' && (p.loadout || []).filter(Boolean).length >= slotCap) break;
      p.skillPoints++;
      if (SKILLSIM.spendSkillPoint(g, p, s.id)) left--; else p.skillPoints--;
    }
  }
  // A DEEP BUILD EQUIPS WHAT IT PAID FOR. `spendSkillPoint` auto-slots the
  // first eight actives a character learns and never swaps them, which is right
  // as an anti-softlock floor and wrong as a model of a player: learning
  // breadth-first means both build shapes end up fielding the SAME eight
  // early-tier actives, and the deep build's twenty extra nodes — including
  // every tier-10 capstone it spent points reaching — sit unequipped. Measured
  // that way the two builds differ in nothing but damage, which is an artefact
  // of the slotter rather than a fact about the trees.
  if (mode === 'deep') {
    const byId = Object.fromEntries(Object.values(TREES).flatMap(t => t.skills).map(x => [x.id, x]));
    const owned = Object.keys(p.skillRanks || {}).map(id => byId[id]).filter(x => x && x.type === 'active');
    const best = owned.sort((a, b) => b.tier - a.tier).slice(0, slotCap).map(x => x.id);
    for (let i = 0; i < p.loadout.length; i++) p.loadout[i] = best[i] || null;
  }
  // 2. depth: the remainder into what is actually equipped
  const slotted = () => (p.loadout || []).filter(Boolean);
  let guard = 0;
  while (left > 0 && guard++ < 6000) {
    const pool = slotted().length ? slotted() : Object.keys(p.skillRanks);
    if (!pool.length) break;
    const targets = mode === 'concentrated' ? [pool[0]] : pool;
    let any = false;
    for (const id of targets) {
      if (left <= 0) break;
      p.skillPoints++;
      if (SKILLSIM.spendSkillPoint(g, p, id)) { left--; any = true; } else p.skillPoints--;
    }
    if (!any) break;
  }
  g._recomputeStats(p);
  return points - left;
}

// A CHARACTER AT LEVEL N HAS SPENT N STAT PICKS, and a fixture that sets
// `p.level` directly has spent none. `banked` is incremented by the level-up
// path, not by the level number, so every survey that assigns a level and walks
// into a room is carrying a level-1 statline on a level-80 build — vitality
// reads 150 at level 80 for exactly this reason. That is fine for a throughput
// reading and fatal for a survival one, so it is modelled here through the same
// offer/answer path the game uses rather than by writing permStats directly.
function spendStats(g, p, n) {
  p.banked = n;
  let guard = 0;
  while (p.banked > 0 && guard++ < 600) {
    g._maybeOffer(p);
    if (!p.pendingOffer) break;
    g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
  }
  p.banked = 0;
  g._recomputeStats(p);
}

function room(charId, { level, points, regionIndex = 2, seed = 771, mode = 'spread', stats = true } = {}) {
  const g = new Sim({ seed, regionIndex, allowUnplayable: true, party: P(charId) });
  const p = g.players[0];
  p.level = level;
  if (stats) spendStats(g, p, level - 1);
  spend(g, p, points ?? level, mode);
  g.god = true;
  const node = g.floor.nodes.find(n => n.depth > 1 && n.template && n.kind !== 'shrine');
  if (!node) return null;
  g._travelTo(node.id);
  return { g, p };
}

// A throughput reading against a ring of immortal dummies — the same shape
// tree_dps uses, so the numbers are comparable to that gate.
function throughput(charId, { level, points, regionIndex = 2, secs = 20, seed = 771, mode = 'spread', stats = true } = {}) {
  const r = room(charId, { level, points, regionIndex, seed, mode, stats });
  if (!r) return null;
  const { g, p } = r;
  for (const e of g.enemyPool) if (e.active) g.enemyPool.release(e);
  g.wave = { done: true, n: 0 }; g.spawnQueue.length = 0;
  const ring = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const e = g.spawnEnemyById(REGIONS[0].enemies[0], p.x + Math.cos(a) * 95, p.y + Math.sin(a) * 95, { noMats: true });
    if (e) { e.maxHp = e.hp = 1e9; e.spd = 0; ring.push(e); }
  }
  if (!ring.length) return null;
  const before = p.damageDealt || 0;
  for (let i = 0; i < 60 * secs; i++) {
    for (const e of ring) { e.hp = e.maxHp; }
    for (const q of g.enemyPool) if (q.active && !ring.includes(q)) g.enemyPool.release(q);
    p.hp = p.stats.vitality;
    g.tick(); pump(g, p);
  }
  const nRanks = Object.values(p.skillRanks || {}).reduce((a, b) => a + b, 0);
  return {
    dps: ((p.damageDealt || 0) - before) / secs,
    nodes: Object.keys(p.skillRanks || {}).length, ranks: nRanks,
    slots: slotsAtLevel(level),
    slotted: (p.loadout || []).filter(Boolean).length,
  };
}

// ---------------------------------------------------------------- 1. levels
if (want(1)) {
H('1. WHERE A RUN ACTUALLY ENDS — level, points, and the 8x10 arithmetic');

  console.log(`\n  Skill points per level: 1 (grantSkillPoint, one call per level-up).`);
  console.log(`  XP to next level: ${CONFIG.XP_BASE} + ${CONFIG.XP_PER_LEVEL} x level.`);
  let lvl = 1, cum = 0; const need = l => CONFIG.XP_BASE + CONFIG.XP_PER_LEVEL * l;
  const cumTo = {};
  while (lvl < 130) { cum += need(lvl); lvl++; cumTo[lvl] = cum; }
  console.log(`  Cumulative XP to reach: L40 ${cumTo[40]}, L60 ${cumTo[60]}, L80 ${cumTo[80]}, L100 ${cumTo[100]}.`);

  // MEASURED: xp earned clearing one representative combat room, per region.
  console.log('\n  XP earned clearing one representative combat room, measured per region:');
  const perRegion = [];
  for (let ri = 1; ri <= TOTAL_REGIONS; ri++) {
    const r = room('toh_blacksmith', { level: 20, points: 20, regionIndex: ri });
    if (!r) { perRegion.push(null); continue; }
    const { g, p } = r;
    const x0 = p.xpEarned || 0;
    let t = 0;
    while (!g.over && !g.cleared && t < 60 * 240) { p.hp = p.stats.vitality; g.tick(); pump(g, p); t++; }
    perRegion.push({ ri, xp: (p.xpEarned || 0) - x0, secs: t / 60, cleared: !!g.cleared });
    const q = perRegion[perRegion.length - 1];
    console.log(`    region ${ri}: ${q.xp.toFixed(0)} xp in ${q.secs.toFixed(0)}s${q.cleared ? '' : ' (NOT cleared — capped)'}`);
  }
  const got = perRegion.filter(Boolean);
  // How many fights does a path through one region actually contain?
  const g0 = new Sim({ seed: 771, regionIndex: 1, allowUnplayable: true, party: P('toh_blacksmith') });
  const depths = [...new Set(g0.floor.nodes.map(n => n.depth).filter(Boolean))];
  const fightsPerRegion = depths.length;      // one node picked per depth
  console.log(`\n  A region's tree offers ${g0.floor.nodes.length} nodes across ${fightsPerRegion} depths;`);
  console.log(`  a player picks ONE per depth, so ~${fightsPerRegion} fights per region plus the boss.`);
  const totalXp = got.reduce((s, q) => s + q.xp * (fightsPerRegion + 1), 0);
  let lv = 1, acc = 0;
  while (lv < 130 && acc + need(lv) <= totalXp) { acc += need(lv); lv++; }
  console.log(`\n  DERIVED: ~${totalXp.toFixed(0)} xp across all ${TOTAL_REGIONS} regions`);
  console.log(`           -> a run ends around LEVEL ${lv}, i.e. ~${lv} skill points.`);
  console.log(`  The design target is level 80 / 80 points (8 slots x rank 10).`);
  console.log(`  EXTRAPOLATION, not a played run: one room measured per region, multiplied by`);
  console.log(`  path length. It ignores elite/objective rooms paying more and a player skipping`);
  console.log(`  fights, so treat it as the order of magnitude rather than the figure.`);
}

// ---------------------------------------------------------------- 2. plateau
if (want(2)) {
H('2. WHERE OUTPUT STOPS GROWING — the plateau, all 14 classes');

  const LEVELS = QUICK ? [20, 40, 60, 80] : [20, 30, 40, 50, 55, 60, 64, 70, 80, 90, 100];
  console.log(`\n  DPS against an immortal ring, level = points spent. ${LEVELS.join('/')}.`);
  console.log('  "ceiling" is the first level at or after which no later level gains >3%.\n');
  console.log(`  ${'class'.padEnd(13)} ${LEVELS.map(l => String(l).padStart(7)).join('')}   ceiling`);
  const ceilings = [];
  for (const cid of CLASSES) {
    const row = [];
    for (const L of LEVELS) {
      const t = throughput(cid, { level: L, points: L });
      row.push(t ? t.dps : NaN);
    }
    let ceil = LEVELS[LEVELS.length - 1];
    for (let i = 0; i < row.length; i++) {
      const best = Math.max(...row.slice(i));
      if (row[i] > 0 && best <= row[i] * 1.03) { ceil = LEVELS[i]; break; }
    }
    ceilings.push({ cid, ceil, row });
    console.log(`  ${cid.replace('toh_', '').padEnd(13)} ${row.map(v => (isNaN(v) ? '   n/a' : v.toFixed(0).padStart(7))).join('')}   ${ceil}`);
  }
  const at = L => ceilings.filter(c => c.ceil <= L).length;
  console.log(`\n  classes whose output has stopped by level 60: ${at(60)}/${CLASSES.length}`);
  console.log(`  classes whose output has stopped by level 70: ${at(70)}/${CLASSES.length}`);
  console.log(`  classes still gaining at the last level sampled: ${CLASSES.length - at(LEVELS[LEVELS.length - 1])}`);
  const med = [...ceilings.map(c => c.ceil)].sort((a, b) => a - b)[ceilings.length >> 1];
  console.log(`  median ceiling: level ${med}`);
}

// ---------------------------------------------------------------- 3. rank
if (want(3)) {
H('3. WHAT RANK ADDS TODAY');

  const all = Object.values(TREES).flatMap(t => t.skills);
  const withDmg = all.filter(s => s.ranks && s.ranks.damage > 0);
  const rates = [...new Set(withDmg.map(s => s.ranks.damage))].sort((a, b) => a - b);
  console.log(`\n  rankedDamage(base, skill, rank) = base * (1 + ranks.damage * rank)   [js/compose.js]`);
  console.log(`  rankCooldown(base, rank)         = base * ${1 - CONFIG.SKILL_RANK_CD_RATE}^(rank-1), floored at ${CONFIG.SKILL_RANK_CD_FLOOR} of base`);
  console.log(`\n  skills declaring ranks.damage: ${withDmg.length}/${all.length} (${(100 * withDmg.length / all.length).toFixed(0)}%)`);
  console.log(`  rates in use: ${rates.map(r => r.toFixed(3)).join(', ')}`);
  const byRate = new Map();
  for (const s of withDmg) byRate.set(s.ranks.damage, (byRate.get(s.ranks.damage) || 0) + 1);
  for (const [r, n] of [...byRate].sort((a, b) => a[0] - b[0])) {
    console.log(`    ${r.toFixed(3)} per rank  x${String(n).padStart(3)}  ->  rank 1 = x${(1 + r).toFixed(2)}, rank 10 = x${(1 + r * 10).toFixed(2)}, rank 20 = x${(1 + r * 20).toFixed(2)}`);
  }
  const mean = withDmg.reduce((s, x) => s + x.ranks.damage, 0) / Math.max(1, withDmg.length);
  console.log(`\n  mean rate ${mean.toFixed(4)}: rank 1 -> 10 is x${((1 + mean * 10) / (1 + mean)).toFixed(2)} damage`);
  console.log(`  cooldown over the same span: x${(Math.pow(1 - CONFIG.SKILL_RANK_CD_RATE, 9)).toFixed(3)} (${((1 - Math.pow(1 - CONFIG.SKILL_RANK_CD_RATE, 9)) * 100).toFixed(0)}% faster)`);
  console.log(`  combined, rank 1 -> 10: x${(((1 + mean * 10) / (1 + mean)) / Math.pow(1 - CONFIG.SKILL_RANK_CD_RATE, 9)).toFixed(2)} output`);

  // MEASURED, not derived: one class, same slots, ranks forced.
  console.log('\n  MEASURED — same build, ranks forced, DPS against the immortal ring:');
  console.log(`  ${'class'.padEnd(13)} ${'r1'.padStart(8)} ${'r5'.padStart(8)} ${'r10'.padStart(8)} ${'r20'.padStart(8)}   r1->r10`);
  for (const cid of (QUICK ? ['toh_blacksmith', 'toh_wizard'] : CLASSES)) {
    const vals = [];
    for (const R of [1, 5, 10, 20]) {
      const g = new Sim({ seed: 771, regionIndex: 2, allowUnplayable: true, party: P(cid) });
      const p = g.players[0]; p.level = 100;
      // learn every node once, then force every learned node to rank R
      for (let i = 0; i < 60; i++) {
        const l = SKILLSIM.learnableSkills(p);
        if (!l.length) break;
        p.skillPoints++;
        if (!SKILLSIM.spendSkillPoint(g, p, l.sort((a, b) => b.tier - a.tier)[0].id)) { p.skillPoints--; break; }
      }
      for (const id of Object.keys(p.skillRanks)) {
        let guard = 0;
        while (skillRank(p, id) < R && guard++ < 60) { p.skillPoints++; if (!SKILLSIM.spendSkillPoint(g, p, id)) { p.skillPoints--; break; } }
      }
      g._recomputeStats(p); g.god = true;
      const node = g.floor.nodes.find(n => n.depth > 1 && n.template && n.kind !== 'shrine');
      g._travelTo(node.id);
      for (const e of g.enemyPool) if (e.active) g.enemyPool.release(e);
      g.wave = { done: true, n: 0 }; g.spawnQueue.length = 0;
      const ring = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const e = g.spawnEnemyById(REGIONS[0].enemies[0], p.x + Math.cos(a) * 95, p.y + Math.sin(a) * 95, { noMats: true });
        if (e) { e.maxHp = e.hp = 1e9; e.spd = 0; ring.push(e); }
      }
      const d0 = p.damageDealt || 0;
      for (let i = 0; i < 60 * 20; i++) {
        for (const e of ring) e.hp = e.maxHp;
        for (const q of g.enemyPool) if (q.active && !ring.includes(q)) g.enemyPool.release(q);
        p.hp = p.stats.vitality; g.tick(); pump(g, p);
      }
      vals.push(((p.damageDealt || 0) - d0) / 20);
    }
    console.log(`  ${cid.replace('toh_', '').padEnd(13)} ${vals.map(v => v.toFixed(0).padStart(8)).join(' ')}   x${(vals[2] / Math.max(1e-9, vals[0])).toFixed(2)}`);
  }
}

// ---------------------------------------------------------------- 4. enemies
if (want(4)) {
H('4. ENDGAME ENEMY COUNT AND HP, AGAINST ENDGAME THROUGHPUT');

  console.log('\n  Enemies alive and composed HP, one representative combat room per region:');
  console.log(`  ${'region'.padStart(6)} ${'peak alive'.padStart(11)} ${'total spawned'.padStart(14)} ${'mean HP'.padStart(9)} ${'hpMult'.padStart(7)} ${'dmgMult'.padStart(8)}`);
  const perRegion = [];
  for (let ri = 1; ri <= TOTAL_REGIONS; ri++) {
    const r = room('toh_blacksmith', { level: 80, points: 80, regionIndex: ri });
    if (!r) continue;
    const { g, p } = r;
    let peak = 0, ids = new Set(), hpSum = 0, hpN = 0;
    for (let i = 0; i < 60 * 90 && !g.cleared && !g.over; i++) {
      p.hp = p.stats.vitality; g.tick(); pump(g, p);
      const live = [...g.enemyPool].filter(e => e.active);
      peak = Math.max(peak, live.length);
      for (const e of live) if (!ids.has(e.id)) { ids.add(e.id); hpSum += e.maxHp; hpN++; }
    }
    perRegion.push({ ri, peak, total: ids.size, meanHp: hpSum / Math.max(1, hpN) });
    const q = perRegion[perRegion.length - 1];
    console.log(`  ${String(ri).padStart(6)} ${String(q.peak).padStart(11)} ${String(q.total).padStart(14)} ${q.meanHp.toFixed(1).padStart(9)} ${regionHpMult(ri).toFixed(2).padStart(7)} ${regionDmgMult(ri).toFixed(2).padStart(8)}`);
  }
  const r8 = perRegion.find(q => q.ri === 8);
  if (r8) {
    console.log('\n  Against an 8-slot build at level 80 (80 points), per class:');
    console.log(`  ${'class'.padEnd(13)} ${'dps'.padStart(8)} ${'kills/s'.padStart(8)} ${'time to clear'.padStart(14)}`);
    const kps = [];
    for (const cid of (QUICK ? ['toh_blacksmith', 'toh_wizard', 'toh_hunter'] : CLASSES)) {
      const t = throughput(cid, { level: 80, points: 80, regionIndex: 8 });
      if (!t) continue;
      const k = t.dps / Math.max(1e-9, r8.meanHp);
      kps.push(k);
      console.log(`  ${cid.replace('toh_', '').padEnd(13)} ${t.dps.toFixed(0).padStart(8)} ${k.toFixed(2).padStart(8)} ${(r8.total / Math.max(1e-9, k)).toFixed(0).padStart(13)}s`);
    }
    const mk = kps.reduce((a, b) => a + b, 0) / Math.max(1, kps.length);
    console.log(`\n  mean ${mk.toFixed(2)} kills/sec against region 8's ${r8.meanHp.toFixed(1)} mean HP;`);
    console.log(`  a region-8 room fields ${r8.total} enemies, so ~${(r8.total / Math.max(1e-9, mk)).toFixed(0)}s of killing.`);
    console.log(`  A single rank-10 projectile would have to deal ~${r8.meanHp.toFixed(0)} to one-shot the mean body.`);
  }
}

// ---------------------------------------------------------------- 5. sustain
if (want(5)) {
H('5. SUSTAIN AGAINST INCOMING — and the crossover');

  // Sustain lives under `it.hooks`, which is an OBJECT keyed by hook name —
  // not an array, and not on the item root. The first version of this read
  // `it.regen` and reported every item as `{}` with a total of 0, which is the
  // shape of a survey measuring its own accessor (§13 rule 82).
  const SUS = ['regen', 'killHeal', 'lifesteal', 'roomClearHeal', 'critHeal', 'materialHeal', 'secondWind'];
  const sustain = ITEMS.filter(it => it.hooks && SUS.some(k => it.hooks[k]));
  console.log(`\n  ${sustain.length} sustain items in the catalog. Every one is FLAT — none scales with max HP:`);
  for (const it of sustain) {
    const h = Object.fromEntries(SUS.filter(k => it.hooks[k]).map(k => [k, it.hooks[k]]));
    console.log(`    ${it.id.padEnd(26)} ${it.rarity.padEnd(9)} ${JSON.stringify(h)}`);
  }
  const hpsTotal = sustain.reduce((a, it) => a + ((it.hooks.regen && it.hooks.regen.hps) || 0), 0);
  const killTotal = sustain.reduce((a, it) => a + ((it.hooks.killHeal && it.hooks.killHeal.amount) || 0), 0);
  console.log(`\n  If a build carried every regen item: ${hpsTotal} HP/sec flat.`);
  console.log(`  If it carried every per-kill item:   ${killTotal} HP per kill.`);

  console.log('\n  Incoming DPS on a NON-fighting character, per region (god off, HP restored each frame):');
  console.log(`  ${'region'.padStart(6)} ${'incoming/s'.padStart(11)} ${'vitality'.padStart(9)} ${'2 HP/s as % of max'.padStart(20)} ${'kills/s'.padStart(9)}`);
  for (let ri = 1; ri <= TOTAL_REGIONS; ri++) {
    const g = new Sim({ seed: 771, regionIndex: ri, allowUnplayable: true, party: P('toh_blacksmith') });
    const p = g.players[0]; p.level = 80; spend(g, p, 80);
    const node = g.floor.nodes.find(n => n.depth > 1 && n.template && n.kind !== 'shrine');
    g._travelTo(node.id);
    for (let i = 0; i < 60 * 15; i++) { g.tick(); pump(g, p); p.hp = p.stats.vitality; }
    let taken = 0; const secs = 30;
    const k0 = p.kills;
    for (let i = 0; i < 60 * secs; i++) {
      const h = p.hp; g.tick(); pump(g, p);
      if (p.hp < h) taken += h - p.hp;
      p.hp = p.stats.vitality;
    }
    const vit = p.stats.vitality;
    const kps = (p.kills - k0) / secs;
    console.log(`  ${String(ri).padStart(6)} ${(taken / secs).toFixed(1).padStart(11)} ${String(vit).padStart(9)} ${(100 * 2 / vit).toFixed(1).padStart(19)}% ${kps.toFixed(2).padStart(9)}`);
    if (ri === TOTAL_REGIONS) {
      const inc = taken / secs;
      // THE CROSSOVER IS THE SUM, and per-kill is the term that moves. Regen is
      // flat; per-kill healing rides the kill rate, which is exactly the axis
      // phase 2 proposes to raise.
      const perKill = killTotal * kps;
      const total = hpsTotal + perKill;
      console.log(`\n  Region ${ri} incoming on a character that does not fight back: ${inc.toFixed(1)} HP/sec.`);
      console.log(`  Sustain available from the catalog at that kill rate (${kps.toFixed(2)} kills/sec):`);
      console.log(`    regen   ${hpsTotal.toFixed(1).padStart(6)} HP/sec  (flat, does not scale with anything)`);
      console.log(`    per-kill ${perKill.toFixed(1).padStart(5)} HP/sec  (${killTotal} HP/kill x ${kps.toFixed(2)} kills/sec)`);
      console.log(`    total   ${total.toFixed(1).padStart(6)} HP/sec  vs ${inc.toFixed(1)} incoming  ->  ${total >= inc ? 'SUSTAIN WINS' : 'incoming wins'} (ratio ${(total / Math.max(1e-9, inc)).toFixed(2)}x)`);
      console.log(`\n  CROSSOVER: at ${killTotal} HP/kill, sustain covers region-${ri} incoming from`);
      console.log(`  ${((inc - hpsTotal) / Math.max(1e-9, killTotal)).toFixed(2)} kills/sec upward — this fixture measured ${kps.toFixed(2)}, so it sits just under.`);
      console.log(`  Two things push it over in play and neither is modelled here: a fighting`);
      console.log(`  character takes LESS than this (it removes the bodies that are hitting it),`);
      console.log(`  and lifesteal/crit/room-clear healing are on top of the two terms above.`);
      console.log(`\n  NOTE vitality reads ${vit} at level 80 because a harness never spends banked`);
      console.log(`  stat picks — a played character carries more, so "2 HP/s as % of max" above`);
      console.log(`  is an UPPER bound on how much a flat trickle is worth.`);
    }
  }
}

// ---------------------------------------------------------------- 6. overkill
if (want(6)) {
H('6. OVERKILL WASTE — does the efficiency tension exist today?');

  console.log('\n  Every damageEnemy call, split into what landed on a live body and what');
  console.log('  exceeded its remaining HP. If waste is near zero, spreading vs concentrating');
  console.log('  is not currently a real choice.\n');
  console.log(`  ${'class'.padEnd(13)} ${'landed'.padStart(10)} ${'wasted'.padStart(10)} ${'waste %'.padStart(8)} ${'kills'.padStart(7)}`);
  const rows = [];
  for (const cid of (QUICK ? ['toh_blacksmith', 'toh_wizard', 'toh_hunter'] : CLASSES)) {
    const r = room(cid, { level: 80, points: 80, regionIndex: 8 });
    if (!r) continue;
    const { g, p } = r;
    let landed = 0, wasted = 0;
    const proto = Object.getPrototypeOf(g);
    const orig = proto.damageEnemy;
    proto.damageEnemy = function (e, amount, opts = {}) {
      if (e && e.active && opts.owner === p) {
        const hp = e.hp;
        if (amount > hp) { landed += hp; wasted += amount - hp; } else landed += amount;
      }
      return orig.call(this, e, amount, opts);
    };
    try {
      for (let i = 0; i < 60 * 60 && !g.cleared && !g.over; i++) { p.hp = p.stats.vitality; g.tick(); pump(g, p); }
    } finally { proto.damageEnemy = orig; }
    const tot = landed + wasted;
    rows.push({ cid, landed, wasted, pct: 100 * wasted / Math.max(1e-9, tot), kills: p.kills });
    const q = rows[rows.length - 1];
    console.log(`  ${cid.replace('toh_', '').padEnd(13)} ${q.landed.toFixed(0).padStart(10)} ${q.wasted.toFixed(0).padStart(10)} ${q.pct.toFixed(1).padStart(7)}% ${String(q.kills).padStart(7)}`);
  }
  if (rows.length) {
    const mp = rows.reduce((s, r) => s + r.pct, 0) / rows.length;
    console.log(`\n  mean overkill waste, SPREAD build: ${mp.toFixed(1)}% of all damage a player deals.`);
  }

  // THE OTHER HALF OF THE TENSION. The design says concentration should waste
  // damage against numerous enemies while spreading should not. That is a
  // COMPARISON, and reporting only the spread build would leave the claim
  // untested — the same shape as asserting a ratio from one side of it.
  console.log('\n  Same rooms, same points, all spare points in ONE slotted skill:');
  console.log(`  ${'class'.padEnd(13)} ${'spread %'.padStart(9)} ${'concentrated %'.padStart(15)} ${'top rank'.padStart(9)}`);
  const conc = [];
  for (const cid of (QUICK ? ['toh_blacksmith', 'toh_wizard', 'toh_hunter'] : CLASSES)) {
    const r = room(cid, { level: 80, points: 80, regionIndex: 8, mode: 'concentrated' });
    if (!r) continue;
    const { g, p } = r;
    let landed = 0, wasted = 0;
    const proto = Object.getPrototypeOf(g);
    const orig = proto.damageEnemy;
    proto.damageEnemy = function (e, amount, opts = {}) {
      if (e && e.active && opts.owner === p) {
        const hp = e.hp;
        if (amount > hp) { landed += hp; wasted += amount - hp; } else landed += amount;
      }
      return orig.call(this, e, amount, opts);
    };
    try {
      for (let i = 0; i < 60 * 60 && !g.cleared && !g.over; i++) { p.hp = p.stats.vitality; g.tick(); pump(g, p); }
    } finally { proto.damageEnemy = orig; }
    const pct = 100 * wasted / Math.max(1e-9, landed + wasted);
    const was = rows.find(x => x.cid === cid);
    const top = Math.max(...Object.values(p.skillRanks || { x: 0 }));
    conc.push({ cid, pct, spread: was ? was.pct : NaN });
    console.log(`  ${cid.replace('toh_', '').padEnd(13)} ${(was ? was.pct.toFixed(1) : 'n/a').padStart(8)}% ${pct.toFixed(1).padStart(14)}% ${String(top).padStart(9)}`);
  }
  if (conc.length) {
    const ms = conc.reduce((a, r) => a + r.spread, 0) / conc.length;
    const mc = conc.reduce((a, r) => a + r.pct, 0) / conc.length;
    console.log(`\n  mean waste: spread ${ms.toFixed(1)}%  ->  concentrated ${mc.toFixed(1)}%   (delta ${(mc - ms >= 0 ? '+' : '') + (mc - ms).toFixed(1)} pts)`);
    console.log('  The tension is real only if concentrating costs materially more waste.');
  }
}

console.log('\n' + '='.repeat(92));
console.log('PHASE 1 COMPLETE — nothing was tuned. See docs/power-curve-phase1.md.');
console.log('='.repeat(92));

// ------------------------------------------------- 7. the spend spectrum
//
// 8 x rank-10 is ONE POINT on a spectrum, not the target, and reaching it at
// 100 points is the accepted cost of not diversifying. The question this
// section asks is the one that matters for tuning: at the SAME budget, what
// does each end of the spectrum have that the other does not?
//
//   shallow — stop learning once the loadout is full, everything else on rank.
//             Eight actives from the early tiers, at rank ~10.
//   deep    — learn every node in all three trees, reaching the tier-10
//             capstones, then rank what is slotted. Lands nearer rank 7.
//
// If the deep build's only difference is lower damage, breadth is buying
// nothing and that is a finding about the TREES, not about tuning.
if (want(7)) {
H('7. THE SPEND SPECTRUM — shallow vs deep at the same budget');

  const BUDGET = 82;          // measured end-of-run points, section 1
  const RIDERS = ['slow', 'stun', 'root', 'knockback', 'splash', 'mark', 'taunt',
                  'weakenDamage', 'weakenDefense', 'defenseDown', 'drench', 'mend',
                  'healPerHit', 'impactDot', 'multiPulse', 'windUp', 'doll', 'sluice'];

  // What a build IS, beyond its damage: the capabilities it can bring to bear.
  function profile(g, p) {
    const learned = Object.keys(p.skillRanks || {});
    const byId = Object.fromEntries(Object.values(TREES).flatMap(t => t.skills).map(s => [s.id, s]));
    const slotted = (p.loadout || []).filter(Boolean);
    const slottedSk = slotted.map(id => byId[id]).filter(Boolean);
    const learnedSk = learned.map(id => byId[id]).filter(Boolean);
    // passives are ALWAYS ON and need no slot — the one thing breadth buys
    // that does not compete for the eight
    const passives = learnedSk.filter(s => s.type === 'passive');
    const effects = new Set(slottedSk.flatMap(s => (s.compose || []).map(c => c.kind)));
    const riders = new Set(slottedSk.flatMap(s => (s.compose || []).flatMap(c => Object.keys(c.riders || {})))
      .filter(k => RIDERS.includes(k)));
    const domains = new Set(slottedSk.map(s => s.domain).filter(Boolean));
    const selectors = new Set(slottedSk.map(s => s.select).filter(Boolean));
    const maxTierPerTree = {};
    for (const s of learnedSk) maxTierPerTree[s.tree] = Math.max(maxTierPerTree[s.tree] || 0, s.tier);
    const slotRanks = slotted.map(id => p.skillRanks[id]);
    return {
      learned: learned.length, passives: passives.length, passiveIds: passives.map(s => s.id),
      slotted: slotted.length, slottedIds: slotted,
      meanSlotRank: slotRanks.reduce((a, b) => a + b, 0) / Math.max(1, slotRanks.length),
      minSlotRank: Math.min(...slotRanks), maxSlotRank: Math.max(...slotRanks),
      effects, riders, domains, selectors,
      treeTiers: Object.values(maxTierPerTree), maxTier: Math.max(0, ...learnedSk.map(s => s.tier)),
      vitality: p.stats.vitality,
    };
  }

  // Does it CLEAR region 8, and how fast? This is the tuning question — both
  // ends of the spectrum have to be able to finish the game.
  function clearRun(cid, mode, { regionIndex = 8, cap = 180 } = {}) {
    const r = room(cid, { level: BUDGET, points: BUDGET, regionIndex, mode });
    if (!r) return null;
    const { g, p } = r;
    const prof = profile(g, p);
    let t = 0, taken = 0;
    g.god = false;                       // survival counts here
    while (!g.over && !g.cleared && t < 60 * cap) {
      const h = p.hp;
      g.tick(); pump(g, p);
      if (p.hp < h) taken += h - p.hp;
      t++;
    }
    return { prof, cleared: !!g.cleared, died: !!g.over, secs: t / 60, kills: p.kills, taken };
  }

  console.log(`\n  Both builds at ${BUDGET} points (the measured end-of-run budget), region 8, god OFF.`);
  console.log(`  "cleared" means the room ended with the character alive.\n`);
  console.log(`  ${'class'.padEnd(13)} ${'build'.padEnd(8)} ${'nodes'.padStart(6)} ${'psv'.padStart(4)} ${'slot rank'.padStart(10)} ${'maxTier/tree'.padStart(13)} ${'dps'.padStart(7)} ${'result'.padStart(9)} ${'secs'.padStart(6)}`);
  const out = [];
  for (const cid of (QUICK ? ['toh_blacksmith', 'toh_wizard', 'toh_hunter'] : CLASSES)) {
    const rec = { cid };
    for (const mode of ['shallow', 'deep']) {
      const t = throughput(cid, { level: BUDGET, points: BUDGET, regionIndex: 8, mode });
      const c = clearRun(cid, mode);
      if (!c) continue;
      rec[mode] = { ...c, dps: t ? t.dps : NaN };
      const pr = c.prof;
      console.log(`  ${(mode === 'shallow' ? cid.replace('toh_', '') : '').padEnd(13)} ${mode.padEnd(8)}`
        + ` ${String(pr.learned).padStart(6)} ${String(pr.passives).padStart(4)}`
        + ` ${(pr.minSlotRank + '-' + pr.maxSlotRank).padStart(10)} ${pr.treeTiers.join('/').padStart(13)}`
        + ` ${(t ? t.dps.toFixed(0) : 'n/a').padStart(7)} ${(c.cleared ? 'CLEARED' : c.died ? 'DIED' : 'timeout').padStart(9)} ${c.secs.toFixed(0).padStart(6)}`);
    }
    out.push(rec);
  }

  // THE DIFF. What does each end have that the other does not?
  console.log('\n  WHAT EACH BUILD HAS THAT THE OTHER DOES NOT');
  const diffCount = { effects: 0, riders: 0, domains: 0, selectors: 0, passives: 0 };
  const deepOnlyAll = new Map(), shallowOnlyAll = new Map();
  for (const rec of out) {
    if (!rec.shallow || !rec.deep) continue;
    const a = rec.shallow.prof, b = rec.deep.prof;
    const only = (x, y) => [...x].filter(v => !y.has(v));
    const dEff = only(b.effects, a.effects), sEff = only(a.effects, b.effects);
    const dRid = only(b.riders, a.riders), sRid = only(a.riders, b.riders);
    const dDom = only(b.domains, a.domains), sDom = only(a.domains, b.domains);
    const dSel = only(b.selectors, a.selectors), sSel = only(a.selectors, b.selectors);
    for (const v of dEff) deepOnlyAll.set('effect:' + v, (deepOnlyAll.get('effect:' + v) || 0) + 1);
    for (const v of dRid) deepOnlyAll.set('rider:' + v, (deepOnlyAll.get('rider:' + v) || 0) + 1);
    for (const v of sEff) shallowOnlyAll.set('effect:' + v, (shallowOnlyAll.get('effect:' + v) || 0) + 1);
    for (const v of sRid) shallowOnlyAll.set('rider:' + v, (shallowOnlyAll.get('rider:' + v) || 0) + 1);
    if (dEff.length || dRid.length || dDom.length || dSel.length) diffCount.effects++;
    const pd = b.passives - a.passives;
    if (pd > 0) diffCount.passives++;
    console.log(`\n  ${rec.cid.replace('toh_', '')}`);
    console.log(`    deep-only    effects [${dEff.join(', ') || '—'}]  riders [${dRid.join(', ') || '—'}]  domains [${dDom.join(', ') || '—'}]  selectors [${dSel.join(', ') || '—'}]`);
    console.log(`    shallow-only effects [${sEff.join(', ') || '—'}]  riders [${sRid.join(', ') || '—'}]  domains [${sDom.join(', ') || '—'}]  selectors [${sSel.join(', ') || '—'}]`);
    console.log(`    passives always-on: shallow ${a.passives}, deep ${b.passives}  (deep +${pd})`);
    console.log(`    dps ${rec.shallow.dps.toFixed(0)} -> ${rec.deep.dps.toFixed(0)}  (${(100 * (rec.deep.dps / Math.max(1e-9, rec.shallow.dps) - 1)).toFixed(0)}%),`
      + ` damage taken ${rec.shallow.taken.toFixed(0)} -> ${rec.deep.taken.toFixed(0)}`);
  }

  const n = out.filter(r => r.shallow && r.deep).length;
  console.log('\n  ' + '-'.repeat(88));
  console.log(`  classes where the deep build brings a capability the shallow one lacks: ${diffCount.effects}/${n}`);
  console.log(`  classes where the deep build carries more always-on passives:           ${diffCount.passives}/${n}`);
  if (deepOnlyAll.size) {
    console.log('\n  capabilities only the DEEP build has, across classes:');
    for (const [k, v] of [...deepOnlyAll].sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(28)} x${v}`);
  } else {
    console.log('\n  capabilities only the DEEP build has: NONE.');
  }
  if (shallowOnlyAll.size) {
    console.log('\n  capabilities only the SHALLOW build has, across classes:');
    for (const [k, v] of [...shallowOnlyAll].sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(28)} x${v}`);
  }
  const sc = out.filter(r => r.shallow && r.shallow.cleared).length;
  const dc = out.filter(r => r.deep && r.deep.cleared).length;
  console.log(`\n  region 8 cleared: shallow ${sc}/${n}, deep ${dc}/${n}`);
  console.log('  BOTH ends of the spectrum have to clear region 8 for the spectrum to be a choice.');
}
