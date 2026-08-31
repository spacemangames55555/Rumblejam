// THE CARRY GATE — does progression survive a region boundary and a wipe?
//
//   node tools/carry_gate.mjs
//
// THIS EXISTS BECAUSE THE DEFECT IT CATCHES SHIPPED. Run continuity (#120) was
// written with a comment asserting that "levels, xp, skills, passives and the
// frontier are all on the character and the party" and therefore survived a
// wipe. Only the frontier did. The character save DECLARES `level` and `points`
// and nothing has ever written them; `_makePlayer` builds every player at level
// 1 and `initSkillPlayer` wipes the tree. So clearing region 1 and walking to
// region 2 handed the player a level-1 character with the opening pick offered
// again — and so did retrying after a wipe.
//
// It was reasoned about rather than measured, so this gate MEASURES: it plays a
// region until the character has really levelled, crosses the boundary the way
// `js/main.js` crosses it, and reads the values back off the new Sim.
//
// It asserts the FULL carry list rather than a sample, because the failure mode
// is a single field nobody owns.

import { Sim } from '../js/game.js';

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

const PARTY = carry => [{ idx: 0, key: 'k', name: 'P', charId: 'toh_necromancer', color: '#fff', carry }];

// Play a region hard enough that progression is unmistakably non-default.
function play(regionIndex, seed, carry, { run = true } = {}) {
  const sim = new Sim({ seed, party: PARTY(carry), regionIndex, allowUnplayable: true });
  const p = sim.players[0];
  // THE SNAPSHOT THAT MATTERS IS TAKEN BEFORE A TICK RUNS. Reading these after
  // playing would compare region 2's own earnings, not what crossed the border.
  const entered = {};
  for (const k of FIELDS) entered[k] = JSON.parse(JSON.stringify(p[k] ?? null));
  entered.openingOffered = !!p.openingOffer;
  if (!run) return { sim, p, entered };

  if (p.openingOffer) sim.uiAction(0, { kind: 'opening', id: p.openingOffer[0].id });
  sim.god = true;
  const d1 = sim.floor.nodes.filter(n => n.depth === 1);
  sim.uiAction(0, { kind: 'pickNode', nodeId: (d1.find(n => n.mix === 'horde') || d1[0]).id });
  let lx = p.x, ly = p.y, stuck = 0, detour = 0, side = 1;
  for (let t = 0; t < 200 * 60 && sim.phase === 'arena' && !sim.over; t++) {
    sim.tick();
    for (const e of sim.enemyPool.items) if (e.active) sim.damageEnemy(e, 900, { owner: p });
    let g = 0; while (p.pendingOffer && g++ < 60) sim.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
    // Walk the loot: XP banks on PICKUP, so a stationary probe measures the drop
    // path and reports no progression at all. The sidestep is KNOWN-DEFECTS #24
    // — straight-line movement parks against map 1's obstacle walls.
    let best = null, bd = 1e18;
    for (const m of sim.pickups) { const d = (m.x - p.x) ** 2 + (m.y - p.y) ** 2; if (d < bd) { bd = d; best = m; } }
    if (best) {
      const dx = best.x - p.x, dy = best.y - p.y, l = Math.hypot(dx, dy) || 1;
      const moved = Math.hypot(p.x - lx, p.y - ly); lx = p.x; ly = p.y;
      if (moved < 0.4) stuck++; else stuck = Math.max(0, stuck - 2);
      if (stuck > 12 && detour <= 0) { detour = 48; side = -side; stuck = 0; }
      if (detour > 0) { detour--; sim.setInput(0, { mx: -dy / l * side, my: dx / l * side }); }
      else sim.setInput(0, { mx: dx / l, my: dy / l });
    } else sim.setInput(0, { mx: 0, my: 0 });
    if (!p.downed) p.hp = p.stats.vitality;
  }
  return { sim, p, entered };
}

// The carry list, read off the engine rather than restated here — a field added
// to CARRY_FIELDS is asserted by this gate without anyone remembering to.
const PROBE = new Sim({ seed: 1, party: PARTY(null), regionIndex: 1, allowUnplayable: true });
const FIELDS = Object.keys(PROBE.carryState()[0]);

// ---- a NEW character must still start clean ------------------------------
const fresh = play(1, 777, null, { run: false });
if (fresh.entered.level === 1 && fresh.entered.openingOffered && fresh.entered.skillPoints === 1
    && Object.keys(fresh.entered.skillRanks).length === 0) {
  ok('a NEW character still starts clean: level 1, one point, empty tree, opening pick offered');
} else {
  fail(`a new character did not start clean: level ${fresh.entered.level}, ${fresh.entered.skillPoints} point(s), `
    + `opening ${fresh.entered.openingOffered} — carry must not leak into a fresh run`);
}

// ---- region 1, played until the character is unmistakably not a default ---
const r1 = play(1, 777, null);
const left = r1.p;
if (!(left.level > 3 && Object.keys(left.skillRanks).length > 0)) {
  fail(`region 1 did not produce a levelled character (level ${left.level}, `
    + `${Object.keys(left.skillRanks).length} ranked) — this gate cannot tell a carried value from a default one unless they differ`);
  console.log(`\n${failures} CARRY GATE FAILURE(S)`);
  process.exit(1);
}
ok(`region 1 leaves a character worth carrying: level ${left.level}, ${left.skillPoints} unspent, `
  + `${Object.keys(left.skillRanks).length} node(s) ranked, ${Math.round(left.xpEarned)} xp, `
  + `${left.materials} materials`);

// The snapshot js/main.js takes at the results screen — the same call, and it
// serves BOTH exits.
const carry = r1.sim.carryState()[0];

// ---- EVERY carried field, not a sample -----------------------------------
function checkAll(label, entered) {
  const bad = [];
  for (const k of FIELDS) {
    if (JSON.stringify(entered[k]) !== JSON.stringify(carry[k])) {
      bad.push(`${k} ${JSON.stringify(entered[k])} != ${JSON.stringify(carry[k])}`);
    }
  }
  if (bad.length) fail(`${label}: ${bad.length}/${FIELDS.length} carried field(s) wrong — ${bad.slice(0, 3).join(' | ')}`);
  else ok(`${label}: all ${FIELDS.length} carried fields match exactly`);
  return bad.length === 0;
}

// ---- PATH 1: world map -> the next region --------------------------------
const toR2 = play(2, 999, carry, { run: false });
checkAll('region 1 -> region 2', toR2.entered);
if (!toR2.entered.openingOffered) ok('region 2 does NOT re-offer the opening pick');
else fail('region 2 re-offered the opening pick — a carried character is being asked to choose its first ability again');

// ---- PATH 2: wipe -> retry the SAME region -------------------------------
// hostRetryRegion() rebuilds the region from the stored seed; the carry rides
// the party exactly as it does for a boundary crossing.
const retry = play(1, 777, carry, { run: false });
checkAll('wipe -> retry same region', retry.entered);
if (!retry.entered.openingOffered) ok('a retry does NOT re-offer the opening pick');
else fail('a retry re-offered the opening pick');

// ---- THE OPENING GUARD, checked rather than assumed ----------------------
// `_offerOpening` returns early on `p.openingOffer || p.skillPoints <= 0`. A
// carried player with points to spend is the case that guard cannot see, so it
// is constructed deliberately instead of hoped against.
{
  const withPoints = { ...carry, skillPoints: 5 };
  const e = play(1, 777, withPoints, { run: false }).entered;
  if (e.skillPoints !== 5) {
    fail(`a carried player with unspent points did not keep them (${e.skillPoints})`);
  } else if (e.openingOffered) {
    fail('a carried player with 5 unspent points was offered the OPENING pick — `_offerOpening` guards on '
      + '`skillPoints <= 0`, which cannot tell "new character" from "has points to spend". The guard needs to '
      + 'distinguish them (an empty `skillRanks` is the honest test), or a returning player is asked to pick '
      + 'a first ability they already have');
  } else {
    ok('a carried player with 5 unspent points is NOT offered the opening pick — the guard distinguishes it');
  }
}

console.log(failures ? `\n${failures} CARRY GATE FAILURE(S)` : '\nPROGRESSION SURVIVES A REGION BOUNDARY AND A WIPE');
process.exit(failures ? 1 : 0);
