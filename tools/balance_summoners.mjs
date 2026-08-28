// BALANCE PASS — the two summoner trees, measured against the trees that were
// already tuned.
//
// Every hp, damage and cooldown in necro_summons and druid_beasts was a first
// guess written before GDD §8.5 existed. This measures them, and it measures
// them against the Samurai and the Necromancer's other two trees rather than
// against an absolute, because "is 12 damage right" has no answer and "does a
// summoner clear a room in the same time as the classes we already tuned" does.
//
// THE FIXTURE ARRIVES AS A PLAYER ARRIVES (§13 rule 20): level 12, which is
// four loadout slots (SLOT_LEVELS = [1, 3, 5, 11, …]) and sits just past region
// 2's expectedLevel of 10 — a party a couple of maps into the second region,
// not one that has just pressed START and not an artificial level-40 god.
//
// Usage: node tools/balance_summoners.mjs [--verbose]

import { Sim } from '../js/game.js';
import { TREES } from '../js/skills.js';
import { spendSkillPoint } from '../js/skillsim.js';

const VERBOSE = process.argv.includes('--verbose');

// TWO ANCHORS, because a depth-versus-breadth ratio measured at one level is
// measured at one point on a curve that moves. At level 12 a rank-11 skill is
// 92% of every point the character owns; at level 70 — §4.2's end-of-run figure
// and the region-8 anchor — the same rank is 16%. Reading "depth dominates" off
// the first and setting a cap from it would cap the endgame using the tutorial.
const ANCHORS = [
  { level: 12, why: 'three slots; region 2 expects 10' },
  { level: 70, why: 'region-8 anchor; §4.2 puts a full run in the low 70s' },
];
const SECONDS = 90;
const SEEDS = [4711, 90210, 1337];

// The trees that were already tuned and shipped. They are the band a new tree
// has to land inside — not a target to hit exactly, since a summoner is
// supposed to feel different, but a range it should not sit outside.
const REFERENCE = ['samurai_armor', 'samurai_tactics', 'necro_marrow', 'necro_dark_matter'];
const UNDER_TEST = ['necro_summons', 'druid_beasts'];

// TWO BUILD SHAPES, because §8.5 frames both summoner engines as a
// depth-versus-breadth decision and one shape cannot see it. "Six animal
// skills at rank 1 is six weak pets on a 35s revive; one animal at rank 20 is a
// single strong pet back in 15s. Neither is obviously correct, which is the
// test." A harness that only spends one point per skill measures the wide build
// and reports the deep one as missing.
//
// The point budget is the level, not infinity: a level-12 character has spent
// twelve points, and a build that assumes more is not a build anyone has.


function spendWide(g, p, treeId, POINTS) {
  let left = POINTS;
  for (const s of [...TREES[treeId].skills].sort((a, b) => a.tier - b.tier)) {
    if (left <= 0) break;
    p.skillPoints++; left--;
    spendSkillPoint(g, p, s.id);
  }
}

// Unlock the signature skill by the cheapest chain, then pour everything else
// into it. For the Necromancer that buys skeletons; for the Druid §8.5 says
// ranks make an animal stronger rather than more numerous, so it buys a bigger
// wolf. Both are the same shape of decision.
function spendDeep(g, p, treeId, signatureId, POINTS) {
  const chain = [];
  let cur = TREES[treeId].skills.find(s => s.id === signatureId);
  while (cur) { chain.unshift(cur); cur = TREES[treeId].skills.find(s => s.id === cur.prereq); }
  let left = POINTS;
  for (const s of chain) { if (left <= 0) break; p.skillPoints++; left--; spendSkillPoint(g, p, s.id); }
  while (left > 0) { p.skillPoints++; left--; if (!spendSkillPoint(g, p, signatureId)) break; }
}

const SIGNATURE = { necro_summons: 'necro_summon_skeleton', druid_beasts: 'druid_call_wolf' };

function run(treeId, seed, shape, LEVEL) {
  const charId = TREES[treeId].classId;
  const g = new Sim({ seed, party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const p = g.players[0];
  p.level = LEVEL;
  const sig = SIGNATURE[treeId] || [...TREES[treeId].skills].sort((a, b) => a.tier - b.tier)[0].id;
  if (shape === 'deep') spendDeep(g, p, treeId, sig, LEVEL); else spendWide(g, p, treeId, LEVEL);
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);

  let minionTicks = 0, ticks = 0, downT = 0;
  const t0 = 0;
  let clearedAt = null;
  for (let t = 0; t < 60 * SECONDS; t++) {
    // Steer at the nearest enemy: a bot that stands still measures the arena's
    // patience, not the build's throughput.
    const e = g.trigGrid && g.trigGrid.nearest ? g.trigGrid.nearest(p.x, p.y, 900) : null;
    if (e) {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
      g.setInput(0, d > 120 ? { mx: dx / d, my: dy / d } : { mx: 0, my: 0 });
    } else g.setInput(0, { mx: 0, my: 0 });
    g.tick();
    ticks++;
    minionTicks += (p.minions || []).filter(m => !m.down).length;
    if ((p.minions || []).some(m => m.down)) downT++;
    if (p.downed) { p.hp = p.stats.vitality; p.downed = false; }   // measuring output, not survival
    if (g.cleared && clearedAt === null) clearedAt = t / 60;
  }
  return {
    tree: treeId, shape,
    sigRank: p.skillRanks[sig] || 0, slots: p.summonSlots || 0,
    dps: p.damageDealt / SECONDS,
    kills: p.kills,
    minionAvg: minionTicks / Math.max(1, ticks),
    downFrac: downT / Math.max(1, ticks),
    cleared: clearedAt,
  };
}

const rows = [];
for (const anchor of ANCHORS) {
for (const tree of [...REFERENCE, ...UNDER_TEST]) {
  for (const shape of ['wide', 'deep']) {
    const rs = SEEDS.map(s => run(tree, s, shape, anchor.level));
    const avg = k => rs.reduce((a, r) => a + r[k], 0) / rs.length;
    rows.push({
      tree, shape, level: anchor.level, under: UNDER_TEST.includes(tree),
      dps: avg('dps'), kills: avg('kills'), minionAvg: avg('minionAvg'), downFrac: avg('downFrac'),
      sigRank: rs[0].sigRank, slots: rs[0].slots,
    });
    if (VERBOSE) for (const r of rs) console.log(`    L${anchor.level} ${tree}/${shape}: dps ${r.dps.toFixed(1)} minions ${r.minionAvg.toFixed(2)} sigRank ${r.sigRank}`);
  }
}
}

for (const anchor of ANCHORS) {
  console.log(`\nbalance — LEVEL ${anchor.level} (${anchor.why}), ${SECONDS}s, ${SEEDS.length} seeds\n`);
  console.log('  tree                shape    dps   kills  avg minions  sig rank  slots');
  console.log('  ----                -----    ---   -----  -----------  --------  -----');
  for (const r of rows.filter(x => x.level === anchor.level)) {
    console.log(`  ${(r.under ? '* ' : '  ') + r.tree.padEnd(18)}${r.shape.padEnd(7)}${r.dps.toFixed(1).padStart(6)}  ${r.kills.toFixed(0).padStart(6)}  ${r.minionAvg.toFixed(2).padStart(11)}  ${String(r.sigRank).padStart(8)}  ${String(r.slots).padStart(5)}`);
  }
  const at = rows.filter(x => x.level === anchor.level);
  const ref = at.filter(r => !r.under).map(r => r.dps).sort((a, b) => a - b);
  const lo = ref[0], hi = ref[ref.length - 1];
  console.log(`\n  reference band: ${lo.toFixed(1)} – ${hi.toFixed(1)} dps`);
  for (const r of at.filter(x => x.under)) {
    const where = r.dps < lo ? `${((1 - r.dps / lo) * 100).toFixed(0)}% BELOW` : r.dps > hi ? `${((r.dps / hi - 1) * 100).toFixed(0)}% ABOVE` : 'inside the band';
    console.log(`  ${r.tree}/${r.shape}: ${r.dps.toFixed(1)} dps — ${where}`);
  }
  // §8.5's own test: neither shape should dominate. A ratio at ONE level is a
  // point on a curve, which is why both anchors are printed side by side.
  for (const tree of UNDER_TEST) {
    const w = at.find(r => r.tree === tree && r.shape === 'wide');
    const d = at.find(r => r.tree === tree && r.shape === 'deep');
    const ratio = d.dps / Math.max(0.01, w.dps);
    const verdict = ratio > 1.5 ? 'DEPTH DOMINATES' : ratio < 0.67 ? 'BREADTH DOMINATES' : 'live decision';
    console.log(`  ${tree}: deep/wide = ${ratio.toFixed(2)} (sig rank ${d.sigRank} = ${(100 * d.sigRank / anchor.level).toFixed(0)}% of points) — ${verdict}`);
  }
}
console.log('');
