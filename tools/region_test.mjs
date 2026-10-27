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
      // RE-KEYED TO THE TREE THAT SHIPS. `type` is `mix`, `next` is `edges`,
      // and `col` is now the GRAPH column — which counts the two stop bands —
      // so every placement rule reads `depth`, the fight index, instead. The
      // rules themselves are unchanged; they were always about which FIGHT a
      // node is, and `col` only happened to equal that while nothing sat
      // between the columns.
      const fights = t.nodes.filter(n => n.depth !== null);
      for (const n of fights) {
        types[n.mix] = (types[n.mix] || 0) + 1;
        if (n.mix === 'shrine' || n.mix === 'cursed') shrineCursedCols[n.depth] = (shrineCursedCols[n.depth] || 0) + 1;
        // Only combat→combat edges carry the cross-link roll. Edges into and
        // out of a stop band are FORCED — a band is on every route by
        // construction — so counting them would drag the measured rate toward
        // zero and read as the roll being broken.
        if (n.depth < NT.COLUMNS && !NT.STOP_BANDS.some(b => b.after === n.depth)) {
          crossLinks.push(n.edges.length === 2 ? 1 : 0);
        }
      }
      routes.add(fights.map(n => n.mix[0]).join(''));
    }
  }
  if (!bad) ok(`${trees} node trees generated across 2 regions x 500 seeds x 4 rerolls — every distribution assertion holds`);
  else fail(`${bad}/${trees} trees failed their assertions`);

  const per = Object.fromEntries(Object.entries(types).map(([k, v]) => [k, v / trees]));
  const wantMix = NT.NODE_MIX;
  const mixOk = Object.entries(wantMix).every(([k, v]) => Math.abs(per[k] - v) < 1e-9);
  if (mixOk) ok(`the mix is exact on every tree, not on average: ${Object.entries(wantMix).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  else fail(`mix drifted: ${JSON.stringify(per)}`);

  if (!shrineCursedCols[1]) ok(`shrine and cursed never land at map 1 (${trees * 2} placements, depths ${Object.keys(shrineCursedCols).sort().join('/')})`);
  else fail(`${shrineCursedCols[1]} shrine/cursed nodes at map 1`);

  const crossRate = crossLinks.reduce((a, b) => a + b, 0) / crossLinks.length;
  const want = RG.CROSS_LINK_CHANCE;
  if (Math.abs(crossRate - want) < 0.03) ok(`cross-link rate ${(crossRate * 100).toFixed(1)}% against the configured ${(want * 100).toFixed(0)}% — routes diverge and reconverge`);
  else fail(`cross-link rate ${(crossRate * 100).toFixed(1)}%, want ~${(want * 100).toFixed(0)}%`);

  if (routes.size > 100) ok(`${routes.size} distinct type-layouts across ${trees} trees — a failed region does not replay identically`);
  else fail(`only ${routes.size} distinct layouts — trees are too samey`);

  // depth scaling escalates and resets per region
  const t = NT.generateTree(4242, RG.REGIONS[0], 0);
  const byCol = [1, 2, 3, 4, 5].map(c => t.nodes.find(n => n.depth === c).depthMult);
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
  // §8.2 rules THREE trees per class. The literal was 2 because that is what had
  // been authored, not because two was the design — the Samurai is the first
  // class to reach the real number, and the rest follow.
  if (trees.length === 3) ok(`a Samurai now has ${trees.length} trees: ${trees.join(', ')}`);
  else fail(`treesFor returned ${JSON.stringify(trees)} — §8.2 gives every class three`);

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
  if (!SK.spendSkillPoint(g, p, 'necro_dark_energy_blip')) ok('a Samurai still cannot buy a Necromancer skill — free spending is across YOUR trees, not all trees');
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
      // A LIVE ID OF ANOTHER CLASS, AND IT HAS TO STAY LIVE. A save claiming
      // points on an id that no longer exists is also refused — for the wrong
      // reason. This case is named "another class's skill", so it must fail on
      // OWNERSHIP; a dead id would turn it into the unknown-id case below
      // without saying so, and the Necromancer's id rule will retire this exact
      // id when its Dark Matter tree converts. The two reasons are separated
      // here so that rename cannot quietly hollow the case out.
      ['points on another class\'s skill', JSON.stringify({ v: SV.SAVE_VERSION, characters: [{ ...c, points: { spent: { necro_dark_energy_blip: 3 }, unspent: 0 } }], player: store })],
      ['points on a skill that does not exist', JSON.stringify({ v: SV.SAVE_VERSION, characters: [{ ...c, points: { spent: { necro_not_a_skill: 3 }, unspent: 0 } }], player: store })],
      ['frontier out of range', JSON.stringify({ v: SV.SAVE_VERSION, characters: [{ ...c, frontier: 99 }], player: store })],
    ];
    const refused = bad.filter(([, text]) => !SV.importBundle(text).ok);
    if (refused.length === bad.length) ok(`import refuses all ${bad.length} malformed bundles by name rather than half-loading: ${bad.map(b => b[0]).join(', ')}`);
    else fail(`import ACCEPTED: ${bad.filter(([, t]) => SV.importBundle(t).ok).map(b => b[0]).join(', ')}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ------------------------------------------- the onboarding ramp's XP debt
//
// WHAT THIS DEFENDS. Region 1's ramp used to halve map 1's spawns and still
// cuts its table to three archetypes. Materials fell with them and XP rides
// materials, so the ramp also halved PROGRESSION — measured either side of
// the original change on one harness, a character left map 1 at level 3 with
// 1 slot where it had left at level 6. `ONBOARDING_XP_MULT` paid that back.
// Map 1's rate multiplier is 1 again (map 2 stays at 0.75), and the map-1 XP
// multiplier is 1.7 rather than 3.4 so the removed density cut is not paid
// twice. The poorer table is what 1.7 is still for.
//
// THE CONSTANT IS MEASURED, SO THE OUTCOME IS WHAT GETS ASSERTED. A
// splitter's second body is a runtime quantity, not a table mean, so the
// multiplier cannot be derived from the tables and checked against itself.
// Asserting 1.7 would only prove someone typed 1.7. This plays the map and
// reads the character, so ANY change to the rate, the table or the drop path
// that moves onboarding pacing lands here by name.
//
// THE WINDOW IS LEVELS 6 TO 7, ON BOTH MEASUREMENT SEEDS. The arenas.js note
// names seed 777 and seed a11ce. `a11ce` is the hex literal 0xa11ce (659918),
// the same spelling as KNOWN-DEFECTS #24's seed `cafe` (0xcafe). It is not a
// seed code — that alphabet has no `1` — and not hashString('a11ce').
//
// The note's "64 materials, level 8" does not reproduce on this probe.
// 0xa11ce banks 38 materials. At the live 1.7 multiplier the drops alone leave
// it at level 4 (64.6 XP, 2 slots). Seed 777 banks 71 and the drops leave it
// at level 6 (120.7 XP, 3 slots). No multiplier from 1.5 to 3.4 puts both
// seeds inside 6–7, so ONBOARDING_XP_MULT[0] stays 1.7. Clearing the room
// grants the missing levels: anyone under ONBOARDING_LEVEL_FLOOR lands on it,
// and both seeds below are inside the window because of that grant.
//
// SLOTS stay 3. SLOT_LEVELS opens slot 2 at level 3 and slot 3 at level 5,
// so levels 6 and 7 both grant 3. Asserting 2 would reject a correct exit.
// Asserting slotsAtLevel(level) would be true whenever the level is, and
// would not notice a ladder edit. The grant crosses level 5, so the short
// seed picks up the third slot with the level.
//
// It nukes rather than fights, deliberately: the question is what the ROOM
// pays, not whether a level-1 build can beat it — offence_test owns that one.
{
  const AR = await import('../js/arenas.js');
  // the mechanism, separately from the outcome (§13 rule 52) — a compensation
  // that leaked onto floor 2 would still pass the level check below by
  // arriving early, and nothing else would notice
  const shape = [
    ['region 1 map 1', AR.onboardingXpMult(1, 0), v => v > 1],
    ['region 1 map 3', AR.onboardingXpMult(1, 2), v => v === 1],
    ['region 2 map 1', AR.onboardingXpMult(2, 0), v => v === 1],
  ];
  const wrong = shape.filter(([, v, ok]) => !ok(v));
  if (!wrong.length) ok(`XP compensation is scoped to the ramp: ${shape.map(([n, v]) => `${n} x${v}`).join(', ')}`);
  else fail(`XP compensation is mis-scoped: ${wrong.map(([n, v]) => `${n} x${v}`).join(', ')} — it must pay back exactly where the ramp took, and nowhere else`);

  // MAP 1 DAMAGE IS NEUTRAL. The triangle comes back on map 2. A live hit,
  // not only the flag: spiritual into a physical body is ×0.80 later and ×1
  // here, and mental into that body is ×1.25 later and ×1 here. Bard has no
  // Ferocity, so the packet is the amount itself.
  {
    const probe = { id: 'probe', domain: 'spiritual', ranks: {} };
    const mental = { id: 'probe', domain: 'mental', ranks: {} };
    function hit(regionIndex, onboarding, skill, amount) {
      const sim = new Sim({ seed: 7, difficulty: 'standard', regionIndex, party: [{ idx: 0, key: 'k', name: 'P', charId: 'toh_bard', color: '#fff' }] });
      const node = sim.floor.nodes.find(n => n.kind === 'combat' && AR.isOnboardingNode(sim.regionIndex, n) === onboarding);
      // Map 2 is not reachable from the opening card, and a pick of an
      // unreachable node is ignored. The probe is the room's damage rule,
      // so it travels straight there.
      sim._travelTo(node.id);
      const e = sim.spawnEnemyById('pnw_thornhound', sim.players[0].x + 30, sim.players[0].y);
      const before = e.hp;
      sim.skillDamage(e, amount, sim.players[0], skill);
      const snap = sim.getSnapshot();
      const flag = snap.st.arena ? snap.st.arena.domainNeutral : null;
      return { dealt: before - e.hp, neutral: flag };
    }
    const disadvantage = hit(1, true, probe, 10);
    const advantage = hit(1, true, mental, 10);
    const laterDis = hit(1, false, probe, 10);
    const laterAdv = hit(1, false, mental, 10);
    if (disadvantage.dealt === 10 && advantage.dealt === 10 && disadvantage.neutral === 1 && advantage.neutral === 1
        && laterDis.dealt === 8 && laterAdv.dealt === 13 && laterDis.neutral === 0 && laterAdv.neutral === 0) {
      ok('map 1 enemies take ×1 from every damage type; map 2 keeps ×0.80 and ×1.25, and the snapshot carries domainNeutral');
    } else {
      fail(`map 1 domain rule drifted: map1 spiritual ${disadvantage.dealt} (flag ${disadvantage.neutral}), map1 mental ${advantage.dealt} (flag ${advantage.neutral}), map2 spiritual ${laterDis.dealt} (flag ${laterDis.neutral}), map2 mental ${laterAdv.dealt} (flag ${laterAdv.neutral})`);
    }
  }

  // MAP 1'S CEDAR LANE WARNS FOR 1.5×. The authored wind-up is 420 ms. Map 2
  // keeps it. A sapling on the same room does not inherit it. A live commit,
  // not only the function: the timer the enemy actually starts is the number.
  {
    const room = (col, kind = 'combat') => ({ col, kind });
    const fnOk = AR.onboardingCedarWindupMs(1, room(0), 'pnw_cedar_warden', 420) === 630
      && AR.onboardingCedarWindupMs(1, room(1), 'pnw_cedar_warden', 420) === 420
      && AR.onboardingCedarWindupMs(2, room(0), 'pnw_cedar_warden', 420) === 420
      && AR.onboardingCedarWindupMs(1, room(0), 'pnw_sapling', 380) === 380
      && AR.onboardingCedarWindupMs(1, room(0, 'siege'), 'pnw_cedar_warden', 420) === 420;
    function liveWindup(onboarding) {
      const sim = new Sim({ seed: 11, difficulty: 'standard', regionIndex: 1, party: [{ idx: 0, key: 'k', name: 'P', charId: 'toh_bard', color: '#fff' }] });
      const node = sim.floor.nodes.find(n => n.kind === 'combat' && AR.isOnboardingNode(sim.regionIndex, n) === onboarding);
      sim._travelTo(node.id);
      sim.wave.done = true;
      sim.spawnQueue.length = 0;
      for (const e of [...sim.enemyPool]) sim.enemyPool.release(e);
      const p = sim.players[0];
      // The lane is what is being measured. A 7 HP cedar dies to the opening
      // swing before it can commit, which would report "no wind-up" for a
      // timer that never got to start.
      p.hp = p.stats.vitality = 5000;
      const e = sim.spawnEnemyById('pnw_cedar_warden', p.x + 40, p.y);
      e.hp = e.maxHp = 5000;
      for (let i = 0; i < 20 * 60; i++) {
        sim.tick();
        if (e.active && e.telState === 1 && e.telWindup > 0) return e.telWindup;
      }
      return null;
    }
    const map1 = liveWindup(true);
    const map2 = liveWindup(false);
    if (fnOk && Math.abs(map1 - 0.63) < 1e-9 && Math.abs(map2 - 0.42) < 1e-9) {
      ok('map 1 Cedar Warden lane warning is 630 ms; map 2 keeps the authored 420 ms');
    } else {
      fail(`cedar wind-up drifted: map1 ${map1}s, map2 ${map2}s (function ${fnOk}) — map 1 is 0.63, map 2 is 0.42`);
    }
  }

  // Levels 6 and 7 inclusive. Overshoot past 7 fails the same way undershoot
  // below 6 does. 3 is the slot count both of those levels grant today.
  const WANT_LO = 6, WANT_HI = 7, WANT_SLOTS = 3;
  const seeds = [
    { name: '777', seed: 777 },
    { name: 'a11ce', seed: 0xa11ce },
  ];
  const m1 = AR.waveConfig(1, 0, 'combat');
  const m2 = AR.waveConfig(1, 1, 'combat');
  const later = AR.waveConfig(2, 0, 'combat');
  if (m1.dur === 65 && Math.abs(m1.r0 - 0.3) < 1e-9 && Math.abs(m1.r1 - 0.72) < 1e-9
      && Math.abs(m2.r0 - 0.375) < 1e-9 && Math.abs(later.r0 - 0.75) < 1e-9
      && AR.ONBOARDING_WAVE_SCALE === 0.6 && Math.abs(AR.ONBOARDING_DROP_SCALE - (1 / 0.6)) < 1e-12) {
    ok('map 1 rolls a 0.6 wave inside the same 65s window; map 2 and region 2 are not scaled, and each map 1 drop is worth 1/0.6');
  } else {
    fail(`map 1 wave scale drifted: r0 ${m1.r0} r1 ${m1.r1} dur ${m1.dur}, map2 r0 ${m2.r0}, region2 r0 ${later.r0}, drop ${AR.ONBOARDING_DROP_SCALE}`);
  }

  for (const { name, seed } of seeds) {
    const sim = new Sim({ seed, party: [{ idx: 0, key: 'k', name: 'P', charId: 'toh_samurai', color: '#fff' }] });
    const p = sim.players[0];
    if (p.openingOffer) sim.uiAction(0, { kind: 'opening', id: p.openingOffer[0].id });
    sim.god = true;
    sim.uiAction(0, { kind: 'pickNode', nodeId: sim.reachableNodes()[0] });
    let spawned = 0;
    const origSpawn = sim.spawnEnemyById.bind(sim);
    sim.spawnEnemyById = (...args) => { const e = origSpawn(...args); if (e) spawned++; return e; };
    let t = 0;
    while (sim.phase === 'arena' && !sim.over && t++ < 200 * 60) {
      sim.tick();
      for (const e of sim.enemyPool.items) if (e.active) sim.damageEnemy(e, 900, { owner: p });
      let g = 0;
      while (p.pendingOffer && g++ < 60) sim.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
      if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
      // XP is banked on PICKUP, so the probe has to walk the loot — standing
      // still measures the drop path and reports zero progression.
      let best = null, bd = 1e18;
      for (const m of sim.pickups) { const d = (m.x - p.x) ** 2 + (m.y - p.y) ** 2; if (d < bd) { bd = d; best = m; } }
      if (best) { const dx = best.x - p.x, dy = best.y - p.y, l = Math.hypot(dx, dy) || 1; sim.setInput(0, { mx: dx / l, my: dy / l }); }
      else sim.setInput(0, { mx: 0, my: 0 });
      if (!p.downed) p.hp = p.stats.vitality;
    }
    const slots = SK.slotsAtLevel(p.level);
    if (p.level >= WANT_LO && p.level <= WANT_HI && slots === WANT_SLOTS) {
      ok(`seed ${name} leaves map 1 at level ${p.level} with ${p.skillPoints} unspent point(s) and ${slots} slots — inside the level ${WANT_LO}–${WANT_HI} onboarding window`);
    } else {
      fail(`seed ${name} leaves map 1 at level ${p.level} with ${slots} slot(s), want level ${WANT_LO}–${WANT_HI} and ${WANT_SLOTS} slots — `
        + `overshoot and undershoot both fail; map 2 must be entered inside this window`);
    }
    // 0.6 of the old ~79-enemy solo wave, rolled by the time the 65s window
    // ends. A swarm profile can sit a body or two higher; these two seeds
    // are not swarm.
    const rolled = sim.wave && sim.wave.done && sim.wave.t <= 66 && (sim.wave.held || 0) === 0 && sim.wave.acc < 1;
    if (spawned >= 47 && spawned <= 55 && rolled) {
      ok(`seed ${name} rolls the smaller map 1 wave inside 65s (${spawned} enemies, wave t ${sim.wave.t.toFixed(1)})`);
    } else {
      fail(`seed ${name} map 1 wave: spawned ${spawned}, done ${sim.wave && sim.wave.done}, t ${sim.wave && sim.wave.t}, held ${sim.wave && sim.wave.held}, acc ${sim.wave && sim.wave.acc}`);
    }
    // The old full wave paid 95 materials on 777 and 90 on a11ce. 0.6 of the
    // bodies at 1/0.6 the value lands on that number, give or take the mix of
    // the shorter sample (one cedar is 3.33 materials).
    const wantGold = name === '777' ? 95 : 90;
    const paid = sim.payout.gold;
    if (Math.abs(paid - wantGold) <= 4 && Math.abs(sim.payout.xp - paid) < 1e-6) {
      ok(`seed ${name} map 1 still pays about ${wantGold} materials and the same XP base (gold ${paid.toFixed(2)})`);
    } else {
      fail(`seed ${name} map 1 payout gold ${paid} xp ${sim.payout.xp}, want about ${wantGold}`);
    }
  }

  // THE GUARANTEE, APART FROM THE DROP ROLL. Four players in one room: two
  // short of the floor (one of them downed), one sitting on it with a partial
  // bar, one past it. The clear path is the one _clearFight uses, so a downed
  // ally is revived and then granted with everyone else. The card, the
  // levelUp event and the skill points are what a pickup's level-up produces.
  // Materials and xpEarned stay, and none of the three RNG streams move.
  {
    const party = [0, 1, 2, 3].map(idx => ({ idx, key: 'k' + idx, name: 'P' + idx, charId: 'toh_samurai', color: '#fff' }));
    const sim = new Sim({ seed: 777, party });
    for (const p of sim.players) if (p.openingOffer) sim.uiAction(p.idx, { kind: 'opening', id: p.openingOffer[0].id });
    sim.uiAction(0, { kind: 'pickNode', nodeId: sim.reachableNodes()[0] });
    // Co-op does not travel on the tap. The 4s consent countdown does, which
    // is the path a real party takes into map 1.
    let wait = 0;
    while (sim.phase !== 'arena' && wait++ < 300) sim.tick();
    const floor = AR.ONBOARDING_LEVEL_FLOOR;
    const specs = [
      { level: 2, xp: 4 },
      { level: 5, xp: 9, downed: true },
      { level: 6, xp: 11 },
      { level: 9, xp: 3 },
    ];
    if (!AR.isOnboardingNode(sim.regionIndex, sim.arenaNode)) fail('the catch-up fixture did not enter map 1');
    for (let i = 0; i < specs.length; i++) {
      const p = sim.players[i];
      p.level = specs[i].level;
      p.xp = specs[i].xp;
      p.xpEarned = 40 + i;
      p.materials = 17 + i;
      p.banked = 0;
      p.pendingOffer = null;
      if (specs[i].downed) { p.downed = true; p.hp = 0; }
    }
    const pointsBefore = sim.players.map(p => p.skillPoints);
    let draws = 0;
    for (const rng of [sim.rng, sim.critRng, sim.econRng]) {
      for (const name of ['float', 'range', 'int', 'pick', 'chance', 'shuffle', 'weighted']) {
        const orig = rng[name].bind(rng);
        rng[name] = (...args) => { draws++; return orig(...args); };
      }
    }
    const evAt = sim.events.length;
    for (const p of sim.livePlayers()) sim._clearRewards(p);
    const problems = [];
    if (draws) problems.push(`${draws} rng draw(s)`);
    for (let i = 0; i < specs.length; i++) {
      const p = sim.players[i];
      const spec = specs[i];
      const granted = Math.max(0, floor - spec.level);
      const ups = sim.events.slice(evAt).filter(e => e.k === 'levelUp' && e.idx === i);
      const offers = sim.events.slice(evAt).filter(e => e.k === 'offer' && e.idx === i);
      if (p.materials !== 17 + i) problems.push(`p${i} materials ${p.materials}`);
      if (p.xpEarned !== 40 + i) problems.push(`p${i} xpEarned ${p.xpEarned}`);
      if (spec.level < floor) {
        if (p.level !== floor || p.xp !== 0) problems.push(`p${i} landed at level ${p.level} xp ${p.xp}`);
        if (p.skillPoints !== pointsBefore[i] + granted) problems.push(`p${i} points ${p.skillPoints}, want ${pointsBefore[i] + granted}`);
        if (p.banked !== granted) problems.push(`p${i} banked ${p.banked}, want ${granted}`);
        if (!p.pendingOffer || !offers.length) problems.push(`p${i} has no level-up card`);
        if (ups.length !== granted) problems.push(`p${i} levelUp events ${ups.length}, want ${granted}`);
        if (SK.slotsAtLevel(p.level) !== WANT_SLOTS) problems.push(`p${i} slots ${SK.slotsAtLevel(p.level)}`);
        if (spec.downed && p.downed) problems.push(`p${i} is still downed`);
      } else {
        if (p.level !== spec.level || p.xp !== spec.xp) problems.push(`p${i} was moved to level ${p.level} xp ${p.xp}`);
        if (p.skillPoints !== pointsBefore[i] || p.banked !== 0 || p.pendingOffer) problems.push(`p${i} was granted a level it already had`);
        if (ups.length) problems.push(`p${i} got a levelUp event at level ${spec.level}`);
      }
    }
    if (!problems.length) ok(`map 1 catch-up raises every short player to level ${floor} with points, slots and a level-up card, and leaves level ${floor}+ alone`);
    else fail(`map 1 catch-up: ${problems.join('; ')}`);

    // The next fight is map 2. The same shortfall is not topped up there.
    sim._finishNode();
    sim._travelTo(sim.reachableNodes()[0]);
    const map2 = sim.players[0];
    if (AR.isOnboardingNode(sim.regionIndex, sim.arenaNode)) fail('map 2 fixture is still the onboarding node');
    else {
      map2.level = 3; map2.xp = 8; map2.banked = 0; map2.pendingOffer = null;
      const pts = map2.skillPoints;
      sim._onboardingCatchUp(map2);
      if (map2.level === 3 && map2.xp === 8 && map2.skillPoints === pts && map2.banked === 0) ok('map 2 does not catch a character up to the map 1 floor');
      else fail(`map 2 catch-up moved a level-3 character to level ${map2.level} xp ${map2.xp}`);
    }
  }

  // Region 2's first fight is a different room. The floor does not travel with it.
  {
    const sim = new Sim({ seed: 777, regionIndex: 2, party: [{ idx: 0, key: 'k', name: 'P', charId: 'toh_samurai', color: '#fff' }] });
    const p = sim.players[0];
    if (p.openingOffer) sim.uiAction(0, { kind: 'opening', id: p.openingOffer[0].id });
    sim.uiAction(0, { kind: 'pickNode', nodeId: sim.reachableNodes()[0] });
    if (AR.isOnboardingNode(sim.regionIndex, sim.arenaNode)) fail('region 2 map 1 was treated as the onboarding node');
    p.level = 2; p.xp = 5; p.banked = 0;
    const pts = p.skillPoints;
    sim._onboardingCatchUp(p);
    if (p.level === 2 && p.xp === 5 && p.skillPoints === pts) ok('region 2 does not catch a character up to the map 1 floor');
    else fail(`region 2 catch-up moved a level-2 character to level ${p.level}`);
  }
}

// ------------------------------------------- map 1 cedar weight and alive caps
//
// Cedar Warden stays at roster weight 2.6. Map 1's pick is the only reader of
// 1.5, and it still spends one waveRng float. The alive caps are 8 cedar
// wardens and 25 enemies for solo; a party scales by coopSpawn relative to a
// solo coopSpawn (the rate multiplier, solo bite included). A tick that is
// already at the cap draws nothing from waveRng. Map 2 is not capped.
{
  const AR = await import('../js/arenas.js');
  const { ENEMY_BY_ID } = await import('../js/content/enemies.js');
  const cedar = ENEMY_BY_ID.pnw_cedar_warden;
  if (cedar && cedar.w === 2.6 && AR.ONBOARDING_CEDAR_WEIGHT === 1.5) {
    ok('Cedar Warden roster weight stays 2.6; map 1 overrides it to 1.5');
  } else fail(`cedar weight drifted: roster ${cedar && cedar.w}, map 1 ${AR.ONBOARDING_CEDAR_WEIGHT}`);

  const partyOf = n => Array.from({ length: n }, (_, i) => ({ idx: i, key: 'k' + i, name: 'P' + i, charId: 'toh_samurai', color: '#fff' }));
  const enter = sim => {
    const id = sim.reachableNodes()[0];
    sim.uiAction(0, { kind: 'pickNode', nodeId: id });
    let k = 0;
    while (sim.phase !== 'arena' && k++ < 400) sim.tick();
    sim.god = true;
    for (const p of sim.players) p.loadout = (p.loadout || []).map(() => null);
  };
  const pressure = (sim, ticks) => {
    let draws = 0, blockedDraws = 0, maxAlive = 0, maxWardens = 0, hitCap = 0;
    const float = sim.waveRng.float.bind(sim.waveRng);
    sim.waveRng.float = function () { draws++; return float(); };
    const scale = sim._onboardingCapScale();
    const aliveCap = AR.ONBOARDING_ALIVE_CAP * scale;
    const wardenCap = AR.ONBOARDING_WARDEN_CAP * scale;
    for (let t = 0; t < ticks; t++) {
      const blocked = sim._onboardingSpawnBlocked();
      const before = draws;
      sim.tick();
      if (blocked && draws !== before) blockedDraws++;
      const nowAlive = sim.enemyPool.count + sim.spawnQueue.length;
      let nowWardens = 0;
      for (const e of sim.enemyPool) if (e.def && e.def.id === 'pnw_cedar_warden') nowWardens++;
      for (const s of sim.spawnQueue) if (s.id === 'pnw_cedar_warden') nowWardens++;
      maxAlive = Math.max(maxAlive, nowAlive);
      maxWardens = Math.max(maxWardens, nowWardens);
      if (nowAlive + 1 > aliveCap || nowWardens + 1 > wardenCap) hitCap++;
    }
    return { draws, blockedDraws, maxAlive, maxWardens, hitCap, aliveCap, wardenCap };
  };

  const solo = new Sim({ seed: 777, party: partyOf(1) });
  enter(solo);
  if (!solo._onboarding()) fail('cap fixture did not enter map 1');
  else {
    // A float of 0.60 lands on Cedar Warden under the old uniform index and
    // under weight 2.6. Under weight 1.5 it lands on the next archetype.
    const saved = solo.waveRng.float.bind(solo.waveRng);
    solo.waveRng.float = () => 0.60;
    solo.wave.acc = 1;
    solo._tickWave(0);
    const spawned = solo.spawnQueue.map(s => s.id);
    solo.waveRng.float = saved;
    if (spawned.length && spawned.every(id => id === 'pnw_sapling')) ok(`map 1 roll 0.60 spawns a sapling, not a cedar warden (${spawned.length})`);
    else fail(`map 1 roll 0.60 spawned ${spawned.join(',') || 'nothing'} — cedar weight is not 1.5`);
    solo.spawnQueue.length = 0;

    const held = pressure(solo, 80 * 60);
    const aliveOver = held.maxAlive > held.aliveCap + 1e-6;
    const wardenOver = held.maxWardens > held.wardenCap + 1e-6;
    if (!aliveOver && !wardenOver && held.hitCap > 0 && held.blockedDraws === 0) {
      ok(`solo map 1 stayed within ${held.aliveCap} alive and ${held.wardenCap} cedar wardens (peak ${held.maxAlive} / ${held.maxWardens}); capped ticks drew no waveRng`);
    } else {
      fail(`solo map 1 cap: peak alive ${held.maxAlive}/${held.aliveCap}, wardens ${held.maxWardens}/${held.wardenCap}, capped ticks that drew ${held.blockedDraws}, ticks at cap ${held.hitCap}`);
    }
  }

  const four = new Sim({ seed: 777, party: partyOf(4) });
  enter(four);
  const fourHeld = pressure(four, 50 * 60);
  const fourAliveOver = fourHeld.maxAlive > fourHeld.aliveCap + 1e-6;
  const fourWardenOver = fourHeld.maxWardens > fourHeld.wardenCap + 1e-6;
  if (four._onboarding() && !fourAliveOver && !fourWardenOver && fourHeld.hitCap > 0 && fourHeld.blockedDraws === 0 && fourHeld.aliveCap > AR.ONBOARDING_ALIVE_CAP) {
    ok(`4p map 1 scales the caps with coopSpawn (alive ${fourHeld.aliveCap.toFixed(2)}, wardens ${fourHeld.wardenCap.toFixed(2)}, peak ${fourHeld.maxAlive} / ${fourHeld.maxWardens})`);
  } else {
    fail(`4p map 1 cap: peak alive ${fourHeld.maxAlive}/${fourHeld.aliveCap}, wardens ${fourHeld.maxWardens}/${fourHeld.wardenCap}, draws while capped ${fourHeld.blockedDraws}`);
  }

  const map2 = new Sim({ seed: 777, party: partyOf(1) });
  enter(map2);
  map2._finishNode();
  const next = map2.floor.nodes.find(n => !AR.isOnboardingNode(map2.regionIndex, n)
    && (n.kind === 'combat' || n.kind === 'elite'));
  map2._travelTo(next.id);
  map2.god = true;
  for (const p of map2.players) p.loadout = (p.loadout || []).map(() => null);
  if (map2._onboarding()) fail('map 2 cap fixture is still the onboarding node');
  else {
    let maxAlive = 0;
    for (let t = 0; t < 50 * 60 && map2.phase === 'arena'; t++) {
      map2.tick();
      maxAlive = Math.max(maxAlive, map2.enemyPool.count + map2.spawnQueue.length);
    }
    if (maxAlive > AR.ONBOARDING_ALIVE_CAP) ok(`map 2 is not under the map 1 alive cap (peak ${maxAlive})`);
    else fail(`map 2 peak alive ${maxAlive} never passed ${AR.ONBOARDING_ALIVE_CAP} — the cap may have leaked`);
  }
}

console.log(failures ? `\n${failures} REGION-SHELL FAILURE(S)` : '\nALL REGION-SHELL PATHS VERIFIED');
process.exit(failures ? 1 : 0);
