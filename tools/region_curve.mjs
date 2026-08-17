// THE WORLD AXIS, MEASURED — what an enemy has to be worth at each of §4.3's
// eight level anchors.
//
// `CONFIG.FLOOR_HP_MULT = 1.35` was a geometric ramp over four floors. Eight
// regions is not four floors with more of them: the anchors are 1, 10, 19, 28,
// 37, 46, 55, 64, and a character's output does not grow the same amount
// between each pair. Rescaling the old exponent to eight points preserves the
// two endpoints — which were never the tuned part — and puts the wrong number
// on all six fights in between.
//
// So it is measured rather than rescaled. For each anchor level: level a
// character, spend its trees in tier order, pin its loadout to the slots that
// level actually opens, and fire it at a ring of immortal dummies for the same
// window `tree_dps` uses. The result is composed output at that level, which is
// what an enemy's HP has to be priced against.
//
// TIME TO KILL IS THE TARGET, not "some growth". A region-8 enemy at ×N HP
// facing a character with ×N output is the same fight as a region-1 enemy at
// ×1 facing a level-1 character — which is the point. The difficulty a player
// feels across a run should come from the fights getting stranger, not from
// arithmetic slipping.
//
// MEDIAN ACROSS CLASSES, not mean. `tree_dps`'s own red set is fourteen trees
// outside ±60% of their class median, so the spread here is real and a mean
// would let one outlier author the world curve.
//
// Usage: node tools/region_curve.mjs [--verbose]
import { Sim } from '../js/game.js';
import { TREES, TREES_BY_CLASS, slotsAtLevel } from '../js/skills.js';
import * as SKILLSIM from '../js/skillsim.js';
import { REGION_ANCHOR_LEVEL } from '../js/regions.js';

const VERBOSE = process.argv.includes('--verbose');
// Points the trees could not absorb. A level whose extra points are unspendable
// is a level that buys nothing, and the curve has to say so rather than quietly
// flattening and leaving the reader to guess whether the fixture broke.
const unspent = {};
const SECONDS = 20;
const TICKS = SECONDS * 60;
// THE RING HAS TO BE INSIDE MELEE REACH. At `tree_dps`'s 110 the Druid measured
// 0.0 at level 1 with `druid_rake` slotted at rank 1 — a melee strike whose
// reach does not span 110 units never fires, and a class holding exactly one
// skill therefore read as dealing no damage at all. `tree_dps` gets away with
// 110 because it stages one tree at a time and its melee trees are measured
// against a 95 ring; this probe measures every class at every level, so the
// ring goes inside the shortest reach in the game rather than near it.
const DUMMY_R = 70;

// The four classes sim_test drives through a full run, so the curve is derived
// from builds that are known to be able to finish the game.
const CLASSES = ['toh_blacksmith', 'toh_wizard', 'toh_necromancer', 'toh_druid'];

// STAGED GENEROUSLY, on purpose — the same ruling `tree_dps`'s supply pass
// makes. The question here is what a character at this level CAN put out, so
// every trigger condition is held true every tick: a level-46 build is mostly
// later-tier skills, later-tier skills are mostly conditional, and a fixture
// that only walks in a circle measures none of them. The first version did
// exactly that and reported levels 19, 28 and 37 as the SAME NUMBER for two of
// the four classes — not because the builds were identical but because
// everything the extra points bought was waiting for a kill, a dodge or a
// status that never came.
function measure(classId, level, window) {
  const sim = new Sim({
    seed: 4242, allowUnplayable: true,
    party: [{ idx: 0, key: 'k', name: 'C', charId: classId, color: '#fff' }],
  });
  sim.god = true;
  // ANSWER THE §5.6 OPENING CARD FIRST, before travelling. It is offered in the
  // constructor and `_enterArena` is where the sim reports it unanswered, so an
  // answer after the travel is an answer after the damage: the Druid entered
  // the fixture with NO SKILL and measured 0.0 dps at level 1 across all three
  // windows, dragging the level-1 median down and inflating every multiplier
  // above it. Every other class hid it, because at level ≥ 10 the spend loop
  // clears the offer as a side effect of its first point.
  if (sim.players[0].openingOffer) sim.uiAction(0, { kind: 'opening', id: sim.players[0].openingOffer[0].id });
  const fight = sim.floor.nodes.find(n => n.kind === 'combat');
  if (!fight) return null;
  fight.template = 'open_expanse';
  sim._travelTo(fight.id);
  sim.wave.done = true; sim.spawnQueue.length = 0;
  for (const e of [...sim.enemyPool]) sim.enemyPool.release(e);

  const p = sim.players[0];
  p.level = level;
  // (level - 1) points, spent breadth-first across the class's trees in tier
  // order — the shape a player who levelled naturally would have, rather than
  // one tree taken to its capstone and the rest empty.
  const skills = (TREES_BY_CLASS[classId] || [])
    .flatMap(t => TREES[t].skills)
    .sort((a, b) => a.tier - b.tier);
  let budget = level - 1;
  for (let pass = 0; pass < 12 && budget > 0; pass++) {
    let spentThisPass = 0;
    for (const sk of skills) {
      if (budget <= 0) break;
      p.skillPoints++;
      if (SKILLSIM.spendSkillPoint(sim, p, sk.id)) { budget--; spentThisPass++; }
      else p.skillPoints--;
    }
    if (!spentThisPass) break;   // nothing else is learnable; the rest is unspendable
  }
  unspent[`${classId}@${level}`] = budget;

  // PIN THE LOADOUT TO WHAT WAS ACTUALLY LEARNED, one WINDOW of it at a time.
  // The ranks live in `p.skillRanks`; the first version filtered on `p.spent`,
  // which is not a field. Windows rather than "the first N" for the reason
  // `tree_dps` gives: a level-64 build owns far more actives than it has slots,
  // and judging it on whichever seven sorted first measures the sort.
  const slots = slotsAtLevel(level);
  const learned = skills.filter(s => s.type === 'active' && (p.skillRanks[s.id] || 0) >= 1).map(s => s.id);
  if (learned.length) {
    p.loadout = new Array(8).fill(null);
    for (let i = 0; i < slots; i++) {
      const id = learned[(window * slots + i) % learned.length];
      if (id) p.loadout[i] = id;
    }
  }
  sim._recomputeStats(p);

  const cx = sim.W / 2, cy = sim.H / 2;
  const dummies = [];
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6;
    const e = sim.spawnEnemyById('slabjaw', cx + Math.cos(a) * DUMMY_R, cy + Math.sin(a) * DUMMY_R, { noMats: true });
    if (!e) continue;
    e.spd = 0; e.dmg = 0;
    dummies.push({ e, x: e.x, y: e.y });
  }
  if (!dummies.length) return null;

  for (let i = 0; i < TICKS; i++) {
    // both halves of every either/or condition, alternating
    const walking = Math.floor(i / 180) % 2 === 1;
    sim.setInput(0, walking ? { mx: (i % 2 ? 1 : -1), my: 0 } : { mx: 0, my: 0 });
    if (!walking) p.stillT = 99;
    const side = Math.floor(i / 200) % 2 ? 1 : -1;
    p.x = cx + side * 320; p.y = cy;
    p.trigEvents.dodgeT = sim.time; p.trigEvents.hitTaken = 1; p.trigEvents.kill = 1;
    p.hp = i % 300 < 150 ? Math.max(1, p.stats.vitality * 0.25) : p.stats.vitality;
    for (let j = 0; j < dummies.length; j++) {
      const a = j * Math.PI * 2 / dummies.length;
      const d = dummies[j];
      d.e.x = p.x + Math.cos(a) * DUMMY_R; d.e.y = p.y + Math.sin(a) * DUMMY_R;
      d.e.knockX = d.e.knockY = 0;
      d.e.maxHp = 2e9; d.e.hp = 1e9;
      if (!(d.e.plagueT > 0)) sim.applyPlague(d.e, 0, 5, p, 'bleed');
    }
    sim.tick();
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  }
  return (p.damageDealt - (p.novaDamage || 0)) / SECONDS;
}

// A class at a level is worth what its BEST slotting is worth, so the windows
// are swept and the maximum taken.
const WINDOWS = 3;
function best(classId, level) {
  let top = 0;
  for (let w = 0; w < WINDOWS; w++) top = Math.max(top, measure(classId, level, w) || 0);
  return top;
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// The one number inherited from the four-point curve, and the only thing worth
// inheriting from it: ln(1.20)/ln(1.35). It says how hard an enemy should hit
// relative to how long it lives, which is a claim about combat rather than
// about how many regions there are.
const DMG_EXP = Math.log(1.20) / Math.log(1.35);

console.log(`THE WORLD AXIS — composed output at each of §4.3's ${REGION_ANCHOR_LEVEL.length} level anchors`);
console.log(`${CLASSES.length} classes, ${SECONDS}s window, median across classes\n`);
console.log('region  level   ' + CLASSES.map(c => c.replace('toh_', '').padStart(9)).join('') + '     median   HP×    dmg×');

const rows = [];
for (let r = 0; r < REGION_ANCHOR_LEVEL.length; r++) {
  const level = REGION_ANCHOR_LEVEL[r];
  const per = CLASSES.map(c => best(c, level));
  rows.push({ region: r + 1, level, per, dps: median(per) });
}
const base = rows[0].dps || 1;
for (const row of rows) {
  row.hp = row.dps / base;
  row.dmg = Math.pow(row.hp, DMG_EXP);
  console.log(`  ${String(row.region).padStart(2)}   ${String(row.level).padStart(5)}   `
    + row.per.map(v => v.toFixed(1).padStart(9)).join('')
    + `  ${row.dps.toFixed(1).padStart(9)}  ${row.hp.toFixed(2).padStart(5)}  ${row.dmg.toFixed(2).padStart(5)}`);
}

console.log('\nREGION_HP_MULT  = [' + rows.map(r => r.hp.toFixed(2)).join(', ') + '];');
console.log('REGION_DMG_MULT = [' + rows.map(r => r.dmg.toFixed(2)).join(', ') + '];');
console.log(`\ndamage exponent ${DMG_EXP.toFixed(3)} = ln(FLOOR_DMG_MULT 1.20)/ln(FLOOR_HP_MULT 1.35)`);

// THE CEILING, NAMED. Past a point the trees stop absorbing points — maxRank
// caps every node — and the extra levels buy nothing. Where that happens is a
// fact about the skill catalogue, and the world curve must not invent growth
// the player cannot actually reach.
console.log('\nunspendable points at each anchor (trees full):');
for (const row of rows) {
  const stuck = CLASSES.map(c => `${c.replace('toh_', '')}=${unspent[`${c}@${row.level}`] ?? '?'}`);
  console.log(`  region ${String(row.region).padStart(2)} (level ${String(row.level).padStart(2)}): ${stuck.join(' ')}`);
}
if (VERBOSE) for (const row of rows) console.log(`  region ${row.region}: ` + CLASSES.map((c, i) => `${c}=${row.per[i].toFixed(1)}`).join(' '));
