// WHY A CLASS PUTS OUT WHAT IT DOES — a class at a level, taken apart.
//
// `region_curve` says the Necromancer deals 6.8× the roster median at level
// 68. That is a verdict with no cause attached, and a class cannot be tuned
// against a verdict. This takes one class on region_curve's own ring
// (tools/lib/dummy_ring.mjs) and answers, in order:
//
//   1. THE BODY.     The statline the build ends with, and how many cards
//                    went into each stat.
//   2. THE CARDS.    The same skills on a body with no cards spent — how much
//                    of the number is the statline.
//   3. THE SKILLS.   Every learned active, slotted ALONE: what one slot of it
//                    is worth, and its share of the class's best slotting.
//   4. THE ROSTER.   The same single-slot figure for every class's best skill,
//                    so "is this skill too strong" has a denominator.
//
// Usage: node tools/class_breakdown.mjs <class> [--level=68] [--picks=sensible]
//        node tools/class_breakdown.mjs --roster [--level=68]
//        (class is 'necromancer', 'toh_necromancer', …)
import { TREES, TREES_BY_CLASS, slotsAtLevel } from '../js/skills.js';
import { measureRing } from './lib/dummy_ring.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const LEVEL = +arg('level', 68);
const PICKS = arg('picks', 'sensible');
const ROSTER = process.argv.includes('--roster');
const named = process.argv.slice(2).find(a => !a.startsWith('--'));
const CLASSES = Object.keys(TREES_BY_CLASS);
const resolve = n => CLASSES.find(c => c === n || c === `toh_${n}`);
const SKILL = Object.fromEntries(Object.values(TREES).flatMap(t => t.skills.map(s => [s.id, { ...s, tree: t.id }])));
const pad = (v, n) => String(v).padStart(n);
const median = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return !s.length ? 0 : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// The best of the three windows region_curve sweeps — "what the class is worth".
function best(classId, level, picks) {
  let top = null;
  for (let w = 0; w < 3; w++) {
    const m = measureRing(classId, level, { picks, window: w });
    if (m && (!top || m.dps > top.dps)) top = { ...m, window: w };
  }
  return top;
}
// One skill, alone in slot 0.
function alone(classId, level, picks, id) {
  const m = measureRing(classId, level, { picks, loadout: [id] });
  return m ? m.dps : 0;
}

function singles(classId, level, picks) {
  const m = measureRing(classId, level, { picks, window: 0, seconds: 1 });
  if (!m) return [];
  return m.learned.map(id => ({ id, dps: alone(classId, level, picks, id), rank: m.p.skillRanks[id] || 0 }))
    .sort((a, b) => b.dps - a.dps);
}

if (ROSTER) {
  console.log(`ONE SLOT OF EACH CLASS'S STRONGEST SKILLS — level ${LEVEL}, stat cards '${PICKS}', the dummy ring\n`);
  const rows = [];
  for (const c of CLASSES) {
    const s = singles(c, LEVEL, PICKS);
    const b = best(c, LEVEL, PICKS);
    rows.push({ c, s, total: b ? b.dps : 0 });
  }
  const medTop = median(rows.map(r => (r.s[0] || {}).dps || 0));
  const medTotal = median(rows.map(r => r.total));
  console.log('class            best slotting   ×median   top single skill                 alone   ×median   2nd                              alone');
  for (const r of rows) {
    const [a, b] = r.s;
    console.log(`${r.c.replace('toh_', '').padEnd(14)} ${pad(r.total.toFixed(1), 13)}   ${pad((r.total / medTotal).toFixed(2), 6)}   ${(a ? a.id : '-').padEnd(30)} ${pad(a ? a.dps.toFixed(1) : '-', 8)}   ${pad(a ? (a.dps / medTop).toFixed(2) : '-', 6)}   ${(b ? b.id : '-').padEnd(30)} ${pad(b ? b.dps.toFixed(1) : '-', 8)}`);
  }
  console.log(`\nmedian best slotting ${medTotal.toFixed(1)} · median top single skill ${medTop.toFixed(1)}`);
  process.exit(0);
}

const classId = resolve(named || '');
if (!classId) { console.error(`usage: node tools/class_breakdown.mjs <class> [--level=N] [--picks=sensible|damage|tank|none]\nclasses: ${CLASSES.map(c => c.replace('toh_', '')).join(', ')}`); process.exit(2); }

const top = best(classId, LEVEL, PICKS);
if (!top) { console.error('the fixture could not be staged'); process.exit(1); }
const p = top.p;
console.log(`${classId} at level ${LEVEL}, stat cards '${PICKS}' — ${top.dps.toFixed(1)} on the dummy ring (best of 3 windows: #${top.window}), ${slotsAtLevel(LEVEL)} slots\n`);

console.log('1. THE BODY');
const stats = ['ferocity', 'vitality', 'grit', 'tempo', 'reflex', 'recovery', 'attunement', 'ingenuity', 'reach', 'greed'];
console.log('   ' + stats.map(s => `${s} ${Math.round((p.stats[s] || 0) * 100) / 100}`).join(' · '));
console.log(`   ${top.cards} stat cards spent`);

console.log('\n2. THE CARDS');
const bare = best(classId, LEVEL, 'none');
const dmg = best(classId, LEVEL, 'damage');
console.log(`   no cards spent     ${pad(bare.dps.toFixed(1), 9)}`);
console.log(`   '${PICKS}'${' '.repeat(Math.max(1, 16 - PICKS.length))}${pad(top.dps.toFixed(1), 9)}   ×${(top.dps / bare.dps).toFixed(2)} from the statline`);
console.log(`   'damage'           ${pad(dmg.dps.toFixed(1), 9)}   ×${(dmg.dps / bare.dps).toFixed(2)}`);

console.log('\n3. THE SKILLS — each learned active alone in one slot');
const s = singles(classId, LEVEL, PICKS);
const slotted = new Set(p.loadout.filter(Boolean));
const sum = s.filter(x => slotted.has(x.id)).reduce((a, x) => a + x.dps, 0);
console.log('   skill                            tree                  tier rank    alone   share of best   in best');
for (const x of s) {
  const k = SKILL[x.id] || {};
  console.log(`   ${x.id.padEnd(32)} ${String(k.tree || '').padEnd(21)} ${pad(k.tier ?? '', 3)} ${pad(x.rank, 4)} ${pad(x.dps.toFixed(1), 9)}   ${pad((100 * x.dps / top.dps).toFixed(0) + '%', 9)}       ${slotted.has(x.id) ? 'yes' : ''}`);
}
console.log(`\n   the slotted skills alone sum to ${sum.toFixed(1)}; together they measure ${top.dps.toFixed(1)} (×${(top.dps / (sum || 1)).toFixed(2)} — above 1 is synergy, below 1 is overlap)`);
