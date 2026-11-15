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
import { TREES_BY_CLASS } from '../js/skills.js';
import { REGION_ANCHOR_LEVEL } from '../js/regions.js';
import { measureRing, RING_SECONDS } from './lib/dummy_ring.mjs';

const VERBOSE = process.argv.includes('--verbose');
// Points the trees could not absorb. A level whose extra points are unspendable
// is a level that buys nothing, and the curve has to say so rather than quietly
// flattening and leaving the reader to guess whether the fixture broke.
const unspent = {};
// The fixture itself — the ring, the staging, the twenty-second window — lives
// in tools/lib/dummy_ring.mjs, shared with class_breakdown.
const SECONDS = RING_SECONDS;

// ALL FOURTEEN, and the median of them. This read four — the classes sim_test
// drove through a full run when only four could finish one — and a world axis
// that is "the median class's output" has to be taken over the classes that
// exist. `--classes=ref` reproduces the old four.
const REF = ['toh_blacksmith', 'toh_wizard', 'toh_necromancer', 'toh_druid'];
const CLASSES = process.argv.includes('--classes=ref') ? REF : Object.keys(TREES_BY_CLASS);
// `--picks=none` reproduces the body the axis was FIRST measured against: a
// character with its level's skills and level 1's statline, because the
// fixture assigned `p.level` and a level-up's stat card is banked by the
// level-up path, not by the number. By region 8 that is sixty-seven cards —
// most of a character's damage stat — missing from the denominator.
const PICKS = (process.argv.find(a => a.startsWith('--picks=')) || '--picks=sensible').split('=')[1];

function measure(classId, level, window) {
  const m = measureRing(classId, level, { picks: PICKS, window });
  if (!m) return null;
  unspent[`${classId}@${level}`] = m.unspent;
  return m.dps;
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
console.log(`${CLASSES.length} classes, ${SECONDS}s window, stat cards '${PICKS}', median across classes\n`);
console.log('region  level   ' + CLASSES.map(c => c.replace('toh_', '').slice(0, 8).padStart(9)).join('') + '     median   HP×    dmg×');

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
