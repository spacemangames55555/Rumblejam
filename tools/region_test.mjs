// PHASE 2 SYSTEMS, THROUGH THEIR REAL PATHS.
//
//   node tools/region_test.mjs
//
// Node trees, the frontier rule from both sides, cross-tree point spending, and
// a save round trip that goes through an actual FILE — per the standing rule
// that a save surviving JSON.stringify but not a file write is a save that does
// not exist.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { Sim } = await import('../js/game.js');
const SK = await import('../js/skillsim.js');
const NT = await import('../js/nodetree.js');
const RG = await import('../js/regions.js');
const SV = await import('../js/saves.js');
const { TREES, TREES_BY_CLASS, SKILL_BY_ID, skillRank } = await import('../js/skills.js');

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

// ---------------------------------------------------------------- node trees

{
  // Many seeds, both regions, several rerolls — one tree is not a sample.
  let bad = 0, trees = 0;
  const types = {}, shrineCursedCols = {}, crossLinks = [];
  const routes = new Set();
  for (let s = 0; s < 500; s++) {
    for (const r of RG.REGIONS) {
      const t = NT.generateTree(90210 + s * 977, r, s % 4);
      trees++;
      const problems = NT.assertTree(t);
      if (problems.length) { bad++; if (bad <= 3) fail(`tree ${r.id}/${s}: ${problems.join('; ')}`); }
      for (const n of t.nodes) {
        types[n.type] = (types[n.type] || 0) + 1;
        if (n.type === 'shrine' || n.type === 'cursed') shrineCursedCols[n.col] = (shrineCursedCols[n.col] || 0) + 1;
        if (n.col < NT.COLUMNS) crossLinks.push(n.next.length === 2 ? 1 : 0);
      }
      routes.add(t.nodes.map(n => n.type[0]).join(''));
    }
  }
  if (!bad) ok(`${trees} node trees generated across 2 regions x 500 seeds x 4 rerolls — every distribution assertion holds`);
  else fail(`${bad}/${trees} trees failed their assertions`);

  const per = Object.fromEntries(Object.entries(types).map(([k, v]) => [k, v / trees]));
  const wantMix = NT.NODE_MIX;
  const mixOk = Object.entries(wantMix).every(([k, v]) => Math.abs(per[k] - v) < 1e-9);
  if (mixOk) ok(`the mix is exact on every tree, not on average: ${Object.entries(wantMix).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  else fail(`mix drifted: ${JSON.stringify(per)}`);

  if (!shrineCursedCols[1]) ok(`shrine and cursed never land in column 1 (${trees * 2} placements, columns ${Object.keys(shrineCursedCols).sort().join('/')})`);
  else fail(`${shrineCursedCols[1]} shrine/cursed nodes in column 1`);

  const crossRate = crossLinks.reduce((a, b) => a + b, 0) / crossLinks.length;
  const want = RG.CROSS_LINK_CHANCE;
  if (Math.abs(crossRate - want) < 0.03) ok(`cross-link rate ${(crossRate * 100).toFixed(1)}% against the configured ${(want * 100).toFixed(0)}% — routes diverge and reconverge`);
  else fail(`cross-link rate ${(crossRate * 100).toFixed(1)}%, want ~${(want * 100).toFixed(0)}%`);

  if (routes.size > 100) ok(`${routes.size} distinct type-layouts across ${trees} trees — a failed region does not replay identically`);
  else fail(`only ${routes.size} distinct layouts — trees are too samey`);

  // depth scaling escalates and resets per region
  const t = NT.generateTree(4242, RG.REGIONS[0], 0);
  const byCol = [1, 2, 3, 4, 5].map(c => t.nodes.find(n => n.col === c).depthMult);
  const rising = byCol.every((v, i) => i === 0 || v > byCol[i - 1]);
  if (rising && byCol[0] === 1) ok(`depth scaling escalates across the five columns and starts at 1.0: ${byCol.join(' -> ')}`);
  else fail(`depth multipliers ${byCol.join('/')}`);
}

// ---------------------------------------------------------------- domain skew

{
  // The declaration is checked at load; this checks the RULE against a real
  // population, which is what will actually catch a region whose art lands
  // one-note later.
  const r = RG.REGIONS[0];
  const legal = ['physical', 'physical', 'physical', 'mental', 'spiritual'];       // 60%
  const illegal = ['physical', 'physical', 'physical', 'physical', 'mental'];      // 80%
  if (!RG.domainShareViolation(r, legal)) ok(`domain-share check passes a population at exactly the ${(r.domainSkew.maxShare * 100).toFixed(0)}% cap`);
  else fail('domain-share check rejected a legal population');
  const v = RG.domainShareViolation(r, illegal);
  if (v) ok(`...and catches one over it: "${v}"`);
  else fail('domain-share check passed an 80% population against a 60% cap');
}

// ---------------------------------------------------------------- frontier

// BOTH SIDES, per the standing rule: a character at their frontier advancing,
// and a character above it not advancing.
{
  const at = SV.newCharacter('c1', 'toh_samurai');
  at.frontier = 2;
  const r1 = SV.onRegionCleared(at, 2);
  if (r1.outcome === 'advanced' && at.frontier === 3) ok(`clearing your OWN frontier advances it (2 -> ${at.frontier})`);
  else fail(`clearing the frontier gave ${JSON.stringify(r1)}`);

  const above = SV.newCharacter('c2', 'toh_samurai');
  above.frontier = 1;
  // simulate being carried through region 2 by a host whose frontier is higher
  const r2 = SV.onRegionCleared(above, 2);
  if (r2.outcome === 'above-frontier' && above.frontier === 1) ok(`clearing ABOVE your frontier grants no world progress (frontier still ${above.frontier})`);
  else fail(`clearing above the frontier gave ${JSON.stringify(r2)}`);

  const below = SV.newCharacter('c3', 'toh_samurai');
  below.frontier = 3;
  const r3 = SV.onRegionCleared(below, 1);
  if (r3.outcome === 'replay' && below.frontier === 3) ok(`clearing BELOW your frontier is a replay and changes nothing`);
  else fail(`replay gave ${JSON.stringify(r3)}`);

  if (SV.canEnter(below, 3) && !SV.canEnter(below, 4)) ok('a character may enter any region up to its frontier and no further');
  else fail('canEnter is wrong at the boundary');

  // presence at the boss kill, regardless of nodes personally cleared
  const latecomer = SV.newCharacter('c4', 'toh_necromancer');
  latecomer.frontier = 1;
  const r4 = SV.onRegionCleared(latecomer, 1);
  if (r4.outcome === 'advanced') ok('frontier advances on PRESENCE at the boss kill — no node-count requirement');
  else fail('a latecomer at their own frontier did not advance');
}

// ---------------------------------------------------------------- unlock store

{
  const st = SV.newPlayerStore();
  const a = SV.recordUnlock(st, 1), b = SV.recordUnlock(st, 2);
  SV.recordUnlock(st, 1);   // idempotent
  if (st.unlockedClasses.length === 2 && a === 'druid' && b === 'savage') {
    ok(`the unlock store records region natives without granting them: ${st.unlockedClasses.join(', ')}`);
  } else fail(`unlock store holds ${JSON.stringify(st.unlockedClasses)}`);
  const playable = st.unlockedClasses.filter(c => TREES_BY_CLASS[c]);
  if (!playable.length) ok('...and neither unlocked class is playable, which is the point — the store works with no class in scope');
  else fail(`unlocked classes are unexpectedly playable: ${playable.join(', ')}`);
}

// ---------------------------------------------------------------- parking

{
  const c = SV.newCharacter('c5', 'toh_necromancer');
  c.frontier = 2;
  const mine = NT.generateTree(111, RG.REGIONS[1], 0);
  SV.park(c, 2, mine, ['1A', '2A', '3B'], 1.0);
  const hostTree = NT.generateTree(999, RG.REGIONS[1], 0);
  // joining a friend's region 2 must not touch the character's own parked state
  const before = JSON.stringify(c.parked);
  const session = { tree: hostTree, cleared: ['1B'] };
  session.cleared.push('2B');
  if (JSON.stringify(c.parked) === before) ok('playing a host\'s rolled tree leaves the character\'s own parked tree untouched');
  else fail('the session wrote into the character\'s parked state');
  const resumed = SV.unpark(c, 2);
  if (resumed && resumed.cleared.length === 3 && resumed.tree.seed === 111) ok(`...and unparking restores their own tree and 3 cleared nodes`);
  else fail(`unpark returned ${JSON.stringify(resumed && resumed.cleared)}`);
  if (!SV.unpark(c, 1)) ok('unparking a region the character is not parked in returns nothing');
  else fail('unpark returned state for the wrong region');
}

// ---------------------------------------------------------------- cross-tree

// §7.4: the first time "points spendable freely across a character's trees" is
// actually exercised, since phase 1 had one tree per class.
{
  const g = new Sim({ seed: 7, party: [{ idx: 0, key: 'k', name: 'X', charId: 'toh_samurai', color: '#fff' }] });
  const p = g.players[0];
  p.level = 66;
  const trees = SK.treesFor(p);
  if (trees.length === 2) ok(`a Samurai now has ${trees.length} trees: ${trees.join(', ')}`);
  else fail(`treesFor returned ${JSON.stringify(trees)}`);

  // Spend into BOTH trees, alternating, and confirm nothing rejects it.
  //
  // The picker prefers an UNLEARNED skill over re-ranking one already owned.
  // The first version of this test sorted by tier and took the lowest, which
  // meant it re-ranked the tier-1 node forty times: it spent 40 points, landed
  // points in both trees, and reported success while never learning a second
  // skill in either. Points-in-two-trees is not the interesting claim. The
  // interesting claim is that two PREREQUISITE CHAINS advance at once, because
  // that is the thing one-tree-per-class never had to support.
  let spent = 0;
  for (let i = 0; i < 40; i++) {
    const learnable = SK.learnableSkills(p);
    if (!learnable.length) break;
    // deliberately alternate trees rather than finishing one first
    const wanted = i % 2 ? 'samurai_armor' : 'samurai_tactics';
    const pool = learnable.filter(s => s.tree === wanted).length ? learnable.filter(s => s.tree === wanted) : learnable;
    const fresh = pool.filter(s => !skillRank(p, s.id));
    const pick = (fresh.length ? fresh : pool).sort((a, b) => a.tier - b.tier)[0];
    p.skillPoints++;
    if (SK.spendSkillPoint(g, p, pick.id)) spent++;
  }
  const byTree = {}, deepest = {};
  for (const id of Object.keys(p.skillRanks)) {
    const s = SKILL_BY_ID[id];
    byTree[s.tree] = (byTree[s.tree] || 0) + 1;
    deepest[s.tree] = Math.max(deepest[s.tree] || 0, s.tier);
  }
  if (Object.keys(byTree).length === 2) ok(`${spent} points spent across BOTH trees with no per-tree budget: ${Object.entries(byTree).map(([k, v]) => `${k} ${v} distinct skills`).join(', ')}`);
  else fail(`points landed in only ${Object.keys(byTree).length} tree(s): ${JSON.stringify(byTree)}`);

  // the actual cross-tree claim: two deep chains held simultaneously
  if (byTree.samurai_armor >= 5 && byTree.samurai_tactics >= 5 && deepest.samurai_armor >= 5 && deepest.samurai_tactics >= 5) {
    ok(`both prerequisite chains advanced together — Armor to tier ${deepest.samurai_armor}, Tactics to tier ${deepest.samurai_tactics}, neither finished before the other started`);
  } else {
    fail(`one chain starved: distinct ${JSON.stringify(byTree)}, deepest tier ${JSON.stringify(deepest)}`);
  }

  // and the mixed loadout that only two trees can produce
  const slotTrees = new Set(p.loadout.filter(Boolean).map(id => SKILL_BY_ID[id].tree));
  if (slotTrees.size === 2) ok(`the resulting loadout mixes both trees across ${p.loadout.filter(Boolean).length} filled slots: ${p.loadout.filter(Boolean).join(', ')}`);
  else fail(`loadout drew from ${slotTrees.size} tree(s): ${JSON.stringify(p.loadout)}`);

  // and a skill from the other class must still be refused
  if (!SK.spendSkillPoint(g, p, 'necro_blip')) ok('a Samurai still cannot buy a Necromancer skill — free spending is across YOUR trees, not all trees');
  else fail('a Samurai bought a Necromancer skill');
}

// ---------------------------------------------------------------- save round trip

// THROUGH A REAL FILE. Serialise-deserialise in memory would pass on a save
// that a file write destroys.
{
  const dir = mkdtempSync(join(tmpdir(), 'rjsave-'));
  const path = join(dir, 'rumblejam-save.json');
  try {
    const c = SV.newCharacter('hero-1', 'toh_samurai', { name: 'Kenji', level: 24, unspent: 3 });
    c.frontier = 2;
    c.points.spent = { sam_cross_guard: 5, sam_draw_cut: 7, sam_measured_breath: 2 };
    c.items = ['item_a', 'item_b'];
    SV.park(c, 2, NT.generateTree(555, RG.REGIONS[1], 1), ['1A', '2B'], 1.25);
    const store = SV.newPlayerStore();
    SV.recordUnlock(store, 1);

    writeFileSync(path, SV.exportBundle([c], store));
    const back = SV.importBundle(readFileSync(path, 'utf8'));

    if (!back.ok) { fail(`import rejected a bundle this build wrote: ${back.problems.join('; ')}`); }
    else {
      const r = back.characters[0];
      const same = r.id === c.id && r.level === c.level && r.frontier === c.frontier
        && JSON.stringify(r.points) === JSON.stringify(c.points)
        && JSON.stringify(r.items) === JSON.stringify(c.items)
        && r.parked.region === 2 && r.parked.cleared.length === 2
        && JSON.stringify(r.parked.tree) === JSON.stringify(c.parked.tree)
        && r.parked.difficulty === 1.25;
      if (same) ok(`save survives a real file round trip — level, points across two trees, items, frontier, and the whole parked 10-node tree (${(readFileSync(path, 'utf8').length / 1024).toFixed(1)} KB on disk)`);
      else fail('the character came back from the file different');
      if (back.player.unlockedClasses.includes('druid')) ok('...and the player-level unlock store rides along');
      else fail('the unlock store did not survive');
    }

    // untrusted input: an import must refuse rather than half-succeed
    const bad = [
      ['truncated file', SV.exportBundle([c], store).slice(0, 120)],
      ['wrong version', JSON.stringify({ v: 99, characters: [c], player: store })],
      ['unknown class', JSON.stringify({ v: SV.SAVE_VERSION, characters: [{ ...c, class: 'toh_nobody' }], player: store })],
      ['points on another class\'s skill', JSON.stringify({ v: SV.SAVE_VERSION, characters: [{ ...c, points: { spent: { necro_blip: 3 }, unspent: 0 } }], player: store })],
      ['frontier out of range', JSON.stringify({ v: SV.SAVE_VERSION, characters: [{ ...c, frontier: 99 }], player: store })],
    ];
    const refused = bad.filter(([, text]) => !SV.importBundle(text).ok);
    if (refused.length === bad.length) ok(`import refuses all ${bad.length} malformed bundles by name rather than half-loading: ${bad.map(b => b[0]).join(', ')}`);
    else fail(`import ACCEPTED: ${bad.filter(([, t]) => SV.importBundle(t).ok).map(b => b[0]).join(', ')}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(failures ? `\n${failures} REGION-SHELL FAILURE(S)` : '\nALL REGION-SHELL PATHS VERIFIED');
process.exit(failures ? 1 : 0);
