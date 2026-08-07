// DEEP VERSUS WIDE, ACROSS ENCOUNTER SHAPES — not in one arena.
//
// §4.2 claims "the optimum sits in the middle". The first measurement of that
// used a single encounter shape at the level-70 anchor and found depth winning
// in three trees of four. But §2.4 gives node types deliberately opposite
// shapes — an Elite node is ×0.55 count and ×2.4 HP against a Horde's baseline
// — and few-fat versus many-thin should favour opposite builds. A ratio
// measured in one arena cannot see that, so this measures four.
//
// WHAT THIS FOUND FIRST, AND WHY THERE ARE FOUR SHAPES RATHER THAN THREE:
// §2.4's Elite modifiers are not implemented. `regionFightMods()` is the only
// consumer of `nodeModifiers()`, and it appears exactly once in the codebase —
// its own definition. Nothing calls it. `this.nodeType` is never assigned
// either, so even a wired call would compute 'horde'. What an elite node
// actually does is waveConfig's rate bump (+0.2/+0.5) and periodic injections:
// MORE enemies at the SAME health, which is backwards on count and absent on
// HP. So the sweep runs BOTH — elite as shipped, and elite reconstructed to
// §2.4 — because the design question needs the spec and the game needs the
// truth about itself.
//
// Usage: node tools/shape_by_node.mjs [--verbose]

import { Sim } from '../js/game.js';
import { TREES } from '../js/skills.js';
import { spendSkillPoint } from '../js/skillsim.js';

const VERBOSE = process.argv.includes('--verbose');

const LEVEL = 70;                 // the region-8 anchor; §4.2 puts a run in the low 70s
const SECONDS = 90;   // matches balance_summoners, so only the node shape differs
const SEEDS = [4711, 90210];
const TREE_IDS = ['samurai_armor', 'samurai_tactics', 'necro_marrow', 'necro_dark_matter', 'necro_summons', 'druid_beasts'];
const SIGNATURE = { necro_summons: 'necro_raise_skeleton', druid_beasts: 'druid_call_wolf' };

// §2.4's numbers, reconstructed here because the game does not apply them.
const ELITE_COUNT = 0.55, ELITE_HP = 2.4;

const SHAPES = [
  { id: 'horde', kind: 'combat', spec: false, why: '§2.4 baseline: many, thin' },
  { id: 'elite-shipped', kind: 'elite', spec: false, why: 'what a player actually gets today' },
  { id: 'elite-spec', kind: 'combat', spec: true, why: `§2.4 as written: x${ELITE_COUNT} count, x${ELITE_HP} HP` },
  { id: 'objective', kind: 'nest', spec: false, why: 'a structure to reach, not a crowd to clear' },
];

function spendWide(g, p, treeId, points) {
  let left = points;
  for (const s of [...TREES[treeId].skills].sort((a, b) => a.tier - b.tier)) {
    if (left <= 0) break;
    p.skillPoints++; left--;
    spendSkillPoint(g, p, s.id);
  }
}
function spendDeep(g, p, treeId, sigId, points) {
  const chain = [];
  let cur = TREES[treeId].skills.find(s => s.id === sigId);
  while (cur) { chain.unshift(cur); cur = TREES[treeId].skills.find(s => s.id === cur.prereq); }
  let left = points;
  for (const s of chain) { if (left <= 0) break; p.skillPoints++; left--; spendSkillPoint(g, p, s.id); }
  while (left > 0) { p.skillPoints++; left--; if (!spendSkillPoint(g, p, sigId)) break; }
}

function run(treeId, shape, seed, deep) {
  const charId = TREES[treeId].classId;
  const g = new Sim({ seed, party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const p = g.players[0];
  p.level = LEVEL;
  const sig = SIGNATURE[treeId] || [...TREES[treeId].skills].sort((a, b) => a.tier - b.tier)[0].id;
  if (deep) spendDeep(g, p, treeId, sig, LEVEL); else spendWide(g, p, treeId, LEVEL);
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  node.kind = shape.kind;
  g._travelTo(node.id);
  // §2.4 reconstructed: fewer of them, each much fatter. The rate scaling is
  // applied to the live wave and the HP to each enemy as it arrives, which is
  // where a wired regionFightMods() would have put them.
  if (shape.spec && g.wave) { g.wave.r0 *= ELITE_COUNT; g.wave.r1 *= ELITE_COUNT; }

  let dealt0 = p.damageDealt, spawned = 0, hpSum = 0;
  for (let t = 0; t < 60 * SECONDS; t++) {
    if (shape.spec) {
      for (const e of g.enemyPool) {
        if (!e.active || e._specScaled) continue;
        e._specScaled = true; e.maxHp *= ELITE_HP; e.hp *= ELITE_HP;
      }
    }
    for (const e of g.enemyPool) { if (e.active && !e._counted) { e._counted = true; spawned++; hpSum += e.maxHp; } }
    const tgt = g.trigGrid && g.trigGrid.nearest ? g.trigGrid.nearest(p.x, p.y, 900) : null;
    if (tgt) {
      const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy) || 1;
      g.setInput(0, d > 120 ? { mx: dx / d, my: dy / d } : { mx: 0, my: 0 });
    } else g.setInput(0, { mx: 0, my: 0 });
    g.tick();
    // SURVIVAL MODEL MATCHED TO balance_summoners: revive on down, and nothing
    // else. The first version topped the player up EVERY TICK, which made the
    // player immortal and reported druid_beasts at 1.46 where the other harness
    // said 0.69 — the same tree, the same level, two answers. Two harnesses
    // disagreeing means one is measuring something else, and it was this one.
    if (p.downed) { p.hp = p.stats.vitality; p.downed = false; }
  }
  return { dps: (p.damageDealt - dealt0) / SECONDS, kills: p.kills, spawned, avgHp: spawned ? hpSum / spawned : 0 };
}

console.log(`deep vs wide by encounter shape — level ${LEVEL}, ${SECONDS}s, ${SEEDS.length} seeds\n`);

const table = {};
for (const shape of SHAPES) {
  table[shape.id] = [];
  for (const tree of TREE_IDS) {
    const avg = deep => SEEDS.map(s => run(tree, shape, s, deep)).reduce((a, r, _, arr) => a + r.dps / arr.length, 0);
    const w = avg(false), d = avg(true);
    table[shape.id].push({ tree, wide: w, deep: d, ratio: d / Math.max(0.01, w) });
    if (VERBOSE) console.log(`    ${shape.id}/${tree}: wide ${w.toFixed(1)} deep ${d.toFixed(1)}`);
  }
}

// A sample of what each shape actually fielded, so "elite" can be checked to be
// an elite rather than asserted to be one.
console.log('  shape          fielded (count / avg HP)   what it is');
console.log('  -----          ------------------------   ----------');
for (const shape of SHAPES) {
  const probe = run(TREE_IDS[0], shape, SEEDS[0], false);
  console.log(`  ${shape.id.padEnd(14)} ${String(probe.spawned).padStart(4)} enemies / ${probe.avgHp.toFixed(0).padStart(5)} HP      ${shape.why}`);
}

console.log('\n  deep/wide ratio — >1 means depth wins, <1 means breadth wins\n');
console.log(`  tree                ${SHAPES.map(s => s.id.padEnd(15)).join('')}`);
console.log(`  ----                ${SHAPES.map(() => '---------------').join('')}`);
for (let i = 0; i < TREE_IDS.length; i++) {
  const cells = SHAPES.map(s => {
    const r = table[s.id][i];
    return `${r.ratio.toFixed(2)} ${r.ratio > 1 ? 'deep ' : 'BREADTH'}`.padEnd(15);
  });
  console.log(`  ${TREE_IDS[i].padEnd(20)}${cells.join('')}`);
}

console.log('');
const means = {};
for (const shape of SHAPES) {
  const rs = table[shape.id];
  const deepWins = rs.filter(r => r.ratio > 1).length;
  means[shape.id] = rs.reduce((a, r) => a + r.ratio, 0) / rs.length;
  console.log(`  ${shape.id.padEnd(14)} depth wins ${deepWins}/${rs.length} trees, mean ratio ${means[shape.id].toFixed(2)}`);
}

// THE NUMBER THE DESIGN QUESTION ACTUALLY TURNS ON. §2.4 distributes a region
// as 4 Horde, 2 Elite, 2 Objective, 1 Shrine, 1 Cursed — and a player clears
// FIVE of the ten. So the shape a build is optimised against is not any single
// encounter, it is that mixture. Weighting by the combat node counts:
const MIX = { horde: 4, 'elite-shipped': 2, objective: 2 };
const MIX_SPEC = { horde: 4, 'elite-spec': 2, objective: 2 };
const weighted = mix => {
  const tot = Object.values(mix).reduce((a, b) => a + b, 0);
  return Object.entries(mix).reduce((a, [k, w]) => a + means[k] * w, 0) / tot;
};
console.log(`\n  REGION-WEIGHTED (§2.4 mix: 4 horde / 2 elite / 2 objective)`);
console.log(`    as shipped:   ${weighted(MIX).toFixed(2)}`);
console.log(`    with §2.4 elite: ${weighted(MIX_SPEC).toFixed(2)}`);
console.log(`  A region-weighted ratio near 1.0 means the optimum sits in the middle ACROSS a region,`);
console.log(`  even where it sits at depth within a single horde fight.`);
console.log('');
