// HOW LONG DOES A SUMMON LIVE, NOW THAT ENEMIES CAN BE MADE TO SWING AT IT?
//
// #127 wired threat: a taunt now redirects the enemy that received it, and
// `_tickContact` gained an enemy-side swing at a taunted minion through
// `hurtMinion`. Before that a minion was a damage source that could not be
// answered. The one reading anybody has of the consequence is `druid_beasts`
// collapsing to -88% in `tools/tree_dps.mjs` with its `pack` engine at zero —
// one tree, one fixture, one number. This measures the shape across all four
// summoning classes before anyone tunes anything.
//
//   node tools/summon_survival.mjs [--level N] [--seconds N] [--verbose]
//
// WHAT IT REPORTS, AND WHY THESE FIELDS. A summon ends in one of three ways and
// they mean different things: `died` is violence, `expired` is a timer running
// out, and a Druid animal goes DOWN and revives rather than doing either. A
// tree whose summons expire is a tree with an uptime problem; a tree whose
// summons die is a tree the threat wiring is now taxing. Reading one death
// counter without the other two cannot tell those apart.
//
// `dupArchetype`, `noSlot` and `atCap` are the three refusals — a summon the
// build asked for and the rules declined. They are printed because a tree can
// look like it is surviving simply by never fielding the body in question.
//
// NOTHING HERE IS A TUNING TARGET. It is a measurement of six trees against
// each other, and against the same six run on the commit before the threat
// wiring landed. Run it in a worktree at 612ebc1 for that side.
//
// WHAT IT FOUND, so the next reader does not re-derive it. #127 opened TWO
// doors to minion damage, and the taunt is the smaller one:
//
//   A. the taunt-gated enemy contact swing (`_tickContact`, js/game.js). Only
//      three summons in the game taunt on their OWN attack — the Necromancer's
//      skeleton and Monster, and the Druid's bear — because `tauntBy` is set to
//      `p.minion`, which is populated only when the taunting attack is the
//      minion's. Every other taunt rider sits on `compose.0`, the OWNER's cast,
//      and points enemies at the player instead.
//
//   B. the telegraph resolve loop (`resolveTelegraph`, js/telegraphs.js), which
//      is NOT gated on a taunt: any minion standing in any telegraphed zone now
//      takes the full blast. Minions used to be absent from that loop entirely.
//
// Isolated by removing B and re-running: for five of the six trees, B accounts
// for 100% of the increase in deaths. Only the Druid is touched by A at all.
// Survival post-#127 is therefore decided by a summon's HP against telegraph
// damage, not by whether it taunts — and that spread is 30x across the roster.

import { Sim } from '../js/game.js';
import { TREES, SKILL_BY_ID } from '../js/skills.js';
import { spendSkillPoint } from '../js/skillsim.js';

// WHICH SUMMONS CAN BE TARGETED AT ALL. The enemy-side swing added by #127
// (`_tickContact`, js/game.js) fires only on `e.tauntT > 0` with `e.tauntBy`
// holding a MINION, and `tauntBy` is set to `p.minion` — which is populated
// only when the taunting attack is the minion's own. A taunt rider on
// `compose.0` is the OWNER's cast and marks the owner instead, which pulls
// enemies onto the player rather than onto the pet. Derived, so a rider added
// later is picked up without editing this.
const SELF_TAUNTING = (() => {
  const out = new Map();
  const walk = (o, path, hits) => {
    if (!o || typeof o !== 'object') return;
    if (o.riders && o.riders.taunt) hits.push({ path, ms: o.riders.taunt });
    for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') walk(v, path ? `${path}.${k}` : k, hits);
  };
  for (const sk of Object.values(SKILL_BY_ID)) {
    const hits = [];
    walk(sk.compose, '', hits);
    for (const h of hits) {
      // `<n>.attack` is the summoned unit's own strike; anything else is a cast.
      if (!/\.attack(\.|$)/.test(h.path)) continue;
      const step = (sk.compose || [])[parseInt(h.path, 10) || 0];
      const arch = step && step.archetype;
      if (!arch) continue;
      const t = out.get(sk.tree) || new Map();
      t.set(arch, h.ms);
      out.set(sk.tree, t);
    }
  }
  return out;
})();

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? (parseInt(process.argv[i + 1], 10) || dflt) : dflt;
};
const LEVEL = arg('--level', 12);
const SECONDS = arg('--seconds', 90);
// WHICH ROOM. Enemy hp and damage scale on the node's DEPTH (`depthMult`,
// js/regions.js), not on the player's level, so a level-70 character in the
// first combat node measures an empty threat. Depth 5 is the last ordinary
// fight before the boss and is where a summon is actually shot at.
const DEPTH = arg('--depth', 5);
const VERBOSE = process.argv.includes('--verbose');
// Seed count is a POWER question, not a taste one: a tree fields two to four
// bodies in a window, so three seeds is six data points and a one-death
// difference reads as a 30% swing. `--seeds N` takes the first N.
const ALL_SEEDS = [4711, 90210, 1337, 20260901, 77, 5150, 31337, 8675309, 424242, 101, 60606, 999];
const SEEDS = ALL_SEEDS.slice(0, arg('--seeds', 3));

// Derived, never restated: every tree holding a `summon` step, and the
// archetypes it can field. A tree added later is measured without editing this.
const SUMMON_TREES = (() => {
  const byTree = new Map();
  for (const sk of Object.values(SKILL_BY_ID)) {
    for (const c of sk.compose || []) {
      if (c.kind !== 'summon') continue;
      const t = byTree.get(sk.tree) || { tree: sk.tree, classId: TREES[sk.tree].classId, archs: new Set(), skills: [] };
      if (c.archetype) t.archs.add(c.archetype);
      t.skills.push(sk.id);
      byTree.set(sk.tree, t);
    }
  }
  return [...byTree.values()].sort((a, b) => a.classId.localeCompare(b.classId) || a.tree.localeCompare(b.tree));
})();

// The wide spend, as `tools/balance_summoners.mjs` builds it: a point per skill
// in tier order, budget equal to the level. A survival question wants the most
// bodies on the field, and wide is the shape that fields them.
function spendWide(g, p, treeId, points) {
  let left = points;
  for (const s of [...TREES[treeId].skills].sort((a, b) => a.tier - b.tier)) {
    if (left <= 0) break;
    p.skillPoints++; left--;
    spendSkillPoint(g, p, s.id);
  }
}

function run(treeId, seed) {
  const g = new Sim({ seed, party: [{ idx: 0, key: 'k', name: 'P', charId: TREES[treeId].classId, color: '#fff' }] });
  const p = g.players[0];
  p.level = LEVEL;
  spendWide(g, p, treeId, LEVEL);
  const fights = g.floor.nodes.filter(x => !['shop', 'treasure', 'siege'].includes(x.kind) && x.depth);
  const node = fights.filter(x => x.depth <= DEPTH).sort((a, b) => b.depth - a.depth)[0] || fights[0];
  g._travelTo(node.id);

  // Ticks each archetype spent on the field, and the HP it was carrying when it
  // got there — a body that dies having absorbed 12 and one that dies having
  // absorbed 300 are not the same event.
  const aliveTicks = new Map(), maxHpSeen = new Map(), everSeen = new Set();
  let ticks = 0, playerDowns = 0, downTicks = 0;
  // The redirect itself: enemy-ticks spent taunted onto a MINION versus onto
  // the OWNER. A summon that never appears here was never targeted, and its
  // survival number says nothing about the threat wiring.
  let tauntOnMinion = 0, tauntOnOwner = 0, enemyTicks = 0;
  // RAW APPLICATIONS, beside the per-frame means. A taunt that lands twice in
  // 90 seconds averages to 0.00 enemies-on-pet and is indistinguishable from
  // one that never lands at all, which is the difference the whole question
  // turns on. Counted by watching an enemy's taunt clock RISE.
  let tauntApplied = 0, tauntAppliedOnMinion = 0;
  const lastTaunt = new WeakMap();

  for (let t = 0; t < 60 * SECONDS; t++) {
    const e = g.trigGrid && g.trigGrid.nearest ? g.trigGrid.nearest(p.x, p.y, 900) : null;
    if (e) {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
      g.setInput(0, d > 120 ? { mx: dx / d, my: dy / d } : { mx: 0, my: 0 });
    } else g.setInput(0, { mx: 0, my: 0 });
    g.tick();
    ticks++;
    for (const e of g.enemyPool) {
      if (!e || e.dead) continue;
      enemyTicks++;
      const prev = lastTaunt.get(e) || 0;
      lastTaunt.set(e, e.tauntT || 0);
      if (!(e.tauntT > 0) || !e.tauntBy) continue;
      if (e.tauntT > prev) { tauntApplied++; if (e.tauntBy.arch !== undefined) tauntAppliedOnMinion++; }
      if (e.tauntBy.arch !== undefined) tauntOnMinion++; else tauntOnOwner++;
    }
    for (const m of p.minions || []) {
      everSeen.add(m.arch);
      if (m.down || m.dead) { downTicks++; continue; }
      aliveTicks.set(m.arch, (aliveTicks.get(m.arch) || 0) + 1);
      maxHpSeen.set(m.arch, Math.max(maxHpSeen.get(m.arch) || 0, m.maxHp || m.hp || 0));
    }
    // The player is kept up ON PURPOSE, so every tree gets the same window.
    // A tree whose owner dies at 20s would otherwise report its summons as
    // long-lived by measuring a shorter fight.
    if (p.downed) { p.hp = p.stats.vitality; p.downed = false; playerDowns++; }
  }

  const s = p.minionStats;
  return {
    tree: treeId, seed,
    spawned: s.spawned, died: s.died, expired: s.expired, revived: s.revived,
    noSlot: s.noSlot, dupArchetype: s.dupArchetype, atCap: s.atCap,
    aliveTicks: [...aliveTicks.entries()], maxHp: [...maxHpSeen.entries()],
    archsFielded: [...everSeen],
    ticks, downTicks, playerDowns, kills: p.kills, dmg: p.damageDealt,
    tauntOnMinion, tauntOnOwner, enemyTicks, tauntApplied, tauntAppliedOnMinion,
  };
}

const out = [];
for (const t of SUMMON_TREES) {
  const rs = SEEDS.map(s => run(t.tree, s));
  const sum = k => rs.reduce((a, r) => a + r[k], 0);
  const totalAlive = rs.reduce((a, r) => a + r.aliveTicks.reduce((x, [, v]) => x + v, 0), 0);
  const perArch = new Map();
  for (const r of rs) for (const [k, v] of r.aliveTicks) perArch.set(k, (perArch.get(k) || 0) + v);
  const hp = new Map();
  for (const r of rs) for (const [k, v] of r.maxHp) hp.set(k, Math.max(hp.get(k) || 0, v));
  const spawned = sum('spawned'), died = sum('died'), expired = sum('expired');
  const frames = sum('ticks') || 1;
  const window = rs.length * SECONDS;
  out.push({
    ...t, archs: [...t.archs],
    spawned, died, expired, revived: sum('revived'),
    noSlot: sum('noSlot'), dup: sum('dupArchetype'), atCap: sum('atCap'),
    // Mean concurrent bodies on the field, and mean seconds a spawn lasted.
    concurrent: totalAlive / 60 / window,
    lifeS: spawned ? (totalAlive / 60) / spawned : 0,
    // Of the endings that happened, what share was violent.
    violentShare: (died + expired) ? died / (died + expired) : null,
    deathsPerMin: died / (window / 60),
    perArch: [...perArch.entries()].map(([k, v]) => [k, v / 60 / window, hp.get(k) || 0]),
    playerDowns: sum('playerDowns'), kills: sum('kills'),
    // Mean number of enemies swinging at a MINION at any instant, and at the
    // owner. A share of enemy-ticks would divide by a room's population and
    // report every reading as 0.x%; the question is how many bodies are on the
    // pet, which is a count.
    tauntMinionPct: sum('tauntOnMinion') / frames,
    tauntOwnerPct: sum('tauntOnOwner') / frames,
    selfTaunters: [...(SELF_TAUNTING.get(t.tree) || new Map()).keys()],
    applied: sum('tauntApplied'), appliedOnMinion: sum('tauntAppliedOnMinion'),
    unfielded: [...t.archs].filter(a => !rs.some(r => r.archsFielded.includes(a))),
  });
  if (VERBOSE) for (const r of rs) {
    console.log(`    ${t.tree} seed ${r.seed}: spawned ${r.spawned} died ${r.died} expired ${r.expired} revived ${r.revived} dup ${r.dupArchetype}`);
  }
}

console.log(`\nSUMMON SURVIVAL — level ${LEVEL}, depth ${DEPTH}, ${SECONDS}s, ${SEEDS.length} seeds, wide spend\n`);
console.log('  class        tree               spawned  died  expired  revived   life s  concurrent  violent%  deaths/min');
console.log('  -----        ----               -------  ----  -------  -------   ------  ----------  --------  ----------');
for (const r of out) {
  console.log('  ' + r.classId.replace('toh_', '').padEnd(13) + r.tree.padEnd(19)
    + String(r.spawned).padStart(7) + String(r.died).padStart(6) + String(r.expired).padStart(9)
    + String(r.revived).padStart(9) + r.lifeS.toFixed(1).padStart(9) + r.concurrent.toFixed(2).padStart(12)
    + (r.violentShare === null ? '     n/a' : (r.violentShare * 100).toFixed(0).padStart(8) + '%')
    + r.deathsPerMin.toFixed(1).padStart(11));
}

console.log('\n  per archetype — mean bodies on the field, and the HP each carries');
for (const r of out) {
  const cells = r.perArch.sort((a, b) => b[1] - a[1])
    .map(([a, c, h]) => `${a} ${c.toFixed(2)} @${Math.round(h)}hp`).join('   ');
  console.log(`  ${r.tree.padEnd(19)}${cells || '(none fielded)'}`);
}

console.log('\n  the redirect — how many enemies were actually pointed at a summon');
console.log('  tree                 taunts landed  of those on a minion  mean enemies on a pet  self-taunting summons');
for (const r of out) {
  console.log(`  ${r.tree.padEnd(21)}${String(r.applied).padStart(13)}${String(r.appliedOnMinion).padStart(22)}${r.tauntMinionPct.toFixed(2).padStart(23)}  ${r.selfTaunters.join(', ') || 'NONE — no taunt reaches this tree'}`);
}

console.log('\n  refusals — a body the build asked for and the rules declined');
console.log('  tree                 noSlot  dupArchetype  atCap  never fielded');
for (const r of out) {
  console.log(`  ${r.tree.padEnd(21)}${String(r.noSlot).padStart(6)}${String(r.dup).padStart(14)}${String(r.atCap).padStart(7)}  ${r.unfielded.join(', ') || '—'}`);
}

// One machine-readable line, so the pre-threat worktree run and this one can be
// diffed without re-reading two tables by eye.
console.log('\nJSON ' + JSON.stringify(out.map(r => ({
  tree: r.tree, spawned: r.spawned, died: r.died, expired: r.expired, revived: r.revived,
  lifeS: +r.lifeS.toFixed(2), concurrent: +r.concurrent.toFixed(3),
  violentShare: r.violentShare === null ? null : +r.violentShare.toFixed(3),
  deathsPerMin: +r.deathsPerMin.toFixed(2), dup: r.dup, noSlot: r.noSlot,
  playerDowns: r.playerDowns, kills: r.kills,
  applied: r.applied, appliedOnMinion: r.appliedOnMinion,
  tauntMinionPct: +r.tauntMinionPct.toFixed(2), tauntOwnerPct: +r.tauntOwnerPct.toFixed(2),
}))));
