// A HEAL REACHES AS FAR AS IT SAYS, AND AN ABSORB REACHES WHO IT SAYS.
//
// WHY THIS EXISTS. The heal range check is `dx*dx + dy*dy > radius*radius`, and
// a heal that never declared a radius made the right-hand side NaN. Every
// comparison against NaN is false, so the check skipped nobody: measured,
// `monk_mend` healed an ally three thousand units away — several screens off,
// invisible to the caster — exactly as well as one standing next to them, while
// `druid_rejuvenate`'s declared 260 correctly stopped between 250 and 600. Ten
// of the thirteen heals in the game were in that state, which is the healer role
// not existing: positioning is what a healer's skill IS, and none of it was
// being asked for.
//
// So this gate asserts the two halves of the fix separately, because they fail
// separately. The LOAD ASSERTION stops a new heal from shipping without a
// radius. The RUNTIME GUARD catches a radius that goes non-finite somewhere the
// assertion cannot see, and it fails CLOSED — an unusable radius becomes zero
// reach rather than infinite reach.
//
// And it asserts the ratchet: ten named heals are allowed to load while they
// wait for values Casey has to choose. This gate is RED while any remain, so
// the exemption cannot quietly become permanent.
//
//   node tools/heal_gate.mjs [--verbose]

import { Sim } from '../js/game.js';
import { SKILL_BY_ID, TREES, HEAL_RADIUS_PENDING } from '../js/skills.js';
import { reachOf, PRIMITIVES } from '../js/compose.js';
import { spendSkillPoint } from '../js/skillsim.js';

const VERBOSE = process.argv.includes('--verbose');
let checks = 0, fails = 0;
const ok = m => { checks++; console.log(`✓ ${m}`); };
const bad = m => { checks++; fails++; console.log(`✗ ${m}`); };

const healSteps = [];
for (const s of Object.values(SKILL_BY_ID)) {
  for (const c of s.compose || []) if (c.kind === 'heal') healSteps.push({ s, c });
}

// ---- 1. the guard, in isolation ----
{
  const cases = [
    [undefined, 0, 'undefined'], [NaN, 0, 'NaN'], [null, 0, 'null'],
    [-40, 0, 'negative'], [0, 0, 'zero'], [Infinity, 0, 'Infinity'],
    [260, 260, 'a real radius'],
  ];
  const wrong = cases.filter(([input, want]) => reachOf(input) !== want);
  if (!wrong.length) ok(`reachOf() fails closed on every unusable radius (${cases.length} cases) and passes a real one through`);
  else bad(`reachOf() wrong for: ${wrong.map(([i, w]) => `${i} → ${reachOf(i)}, want ${w}`).join('; ')}`);
}

// ---- 2. every heal either declares its targeting or is a named exemption ----
//
// `radius` IS SPLIT. A heal now declares who it finds (`selection`, with a
// `searchRadius` for everything but `self`) and where the effect lands (`shape`,
// with an `effectRadius` for an area). "Declared" therefore means a selection
// and a shape, not a single number — a `self` x `point` heal is fully declared
// and correctly carries no radius at all.
{
  const undeclared = healSteps.filter(({ c }) => !c.selection || !c.shape);
  const unnamed = undeclared.filter(({ s }) => !HEAL_RADIUS_PENDING.has(s.id));
  if (!unnamed.length) ok(`every heal without declared targeting is a named exemption — ${healSteps.length} heal step(s), ${undeclared.length} pending`);
  else bad(`${unnamed.length} heal(s) declare no selection or shape and are not exempt: ${unnamed.map(x => x.s.id).join(', ')}`);

  const stale = [...HEAL_RADIUS_PENDING].filter(id => {
    const sk = SKILL_BY_ID[id];
    return !sk || (sk.compose || []).some(c => c.kind === 'heal' && c.radius > 0);
  });
  if (!stale.length) ok('no stale entries in HEAL_RADIUS_PENDING');
  else bad(`HEAL_RADIUS_PENDING names ${stale.length} skill(s) that no longer need it: ${stale.join(', ')}`);
}

// ---- 3. THE RATCHET IS RED WHILE IT HOLDS ANYTHING ----
{
  if (!HEAL_RADIUS_PENDING.size) ok('HEAL_RADIUS_PENDING is empty — every heal in the game declares its reach');
  else {
    bad(`${HEAL_RADIUS_PENDING.size} heal(s) still have no radius and reach only the caster until one is set:`);
    for (const id of [...HEAL_RADIUS_PENDING].sort()) {
      const sk = SKILL_BY_ID[id];
      console.log(`      ${id.padEnd(24)}${sk ? TREES[sk.tree].classId.replace('toh_', '') : '?'}`);
    }
    console.log('      These are AWAITING A DESIGN DECISION, not a bug to patch here.');
  }
}

// ---- 4. the guard in the running game ----
//
// A heal with no radius must now reach the caster and nobody else. Measured
// against a real sim rather than reasoned about, because the whole defect was a
// comparison behaving differently from how it reads.
{
  const pending = [...HEAL_RADIUS_PENDING][0];
  const declared = healSteps.find(({ c }) => c.radius > 0);
  const chain = id => { const o = []; let c = SKILL_BY_ID[id]; while (c) { o.unshift(c.id); c = c.prereq ? SKILL_BY_ID[c.prereq] : null; } return o; };

  // MEASURED AS A DIFFERENCE, NOT AGAINST ZERO. A level-40 character's health
  // drifts upward on its own — the stat sheet recomputes and the fixture's
  // clamp reads that as healing — so a bare room already scores about 8 over
  // 25 seconds. Asserting "zero at 3000 units" would be asserting that the rest
  // of the game does not exist. The control is the same class, same seed, same
  // room, with NOTHING learned; the skill's reach is whatever it adds on top.
  const reach = (id, dist, learnNothing) => {
    const cls = TREES[SKILL_BY_ID[id].tree].classId;
    const g = new Sim({ seed: 99, party: [
      { idx: 0, key: 'a', name: 'A', charId: cls, color: '#fff' },
      { idx: 1, key: 'b', name: 'B', charId: cls, color: '#f00' }] });
    const [a, b] = g.players; a.level = b.level = 40;
    if (!learnNothing) for (const x of chain(id)) { a.skillPoints++; spendSkillPoint(g, a, x); }
    g._travelTo(g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind)).id);
    // THE RECIPIENT MUST OWN NOTHING. Both players are the same class here, and
    // the opening-ability offer hands player two a skill of its own — which for
    // a Wizard is a self-heal. The first version of this check read that as
    // "the caster healed an ally at 3000 units" and reported the guard broken
    // on correct code. A measurement of one player's reach cannot leave a second
    // healer standing in the room.
    b.skillRanks = {}; b.loadout = new Array(8).fill(null);
    let healed = 0;
    for (let i = 0; i < 60 * 25; i++) {
      b.skillRanks = {}; b.loadout = new Array(8).fill(null);
      b.x = a.x + dist; b.y = a.y; b.downed = false; b.gone = false;
      const h0 = b.hp = Math.min(b.hp, b.stats.vitality * 0.5);
      a.hp = Math.min(a.hp, a.stats.vitality * 0.5);   // arm the SELF_THRESHOLD trigger
      g.tick();
      if (b.hp > h0) healed += b.hp - h0;
    }
    return Math.round(healed);
  };

  if (pending) {
    const far = reach(pending, 3000) - reach(pending, 3000, true);
    if (far <= 0) ok(`${pending} has no radius and adds nothing at 3000u over a character who learned nothing — the guard fails closed`);
    else bad(`${pending} healed an ally ${far} beyond the baseline at 3000u with no radius declared — the guard is not holding`);
  }
  if (declared) {
    const id = declared.s.id, r = declared.c.radius;
    const near = Math.round(r * 0.6), far = Math.round(r * 3);
    const inside = reach(id, near) - reach(id, near, true);
    const outside = reach(id, far) - reach(id, far, true);
    if (inside > 0 && outside <= 0) ok(`${id} (radius ${r}) heals inside its radius and not outside — +${inside} at ${near}u, ${outside} at ${far}u, over baseline`);
    else bad(`${id} (radius ${r}) read ${inside} inside and ${outside} outside, over baseline — the radius is not being honoured`);
  }
}

// ---- 5. ally-facing absorb: opt-in, and nothing opted in yet ----
{
  const absorbs = [];
  for (const s of Object.values(SKILL_BY_ID)) {
    for (const c of s.compose || []) if (c.kind === 'shield' || c.kind === 'ward') absorbs.push({ s, c });
  }
  const ally = absorbs.filter(({ c }) => c.allies !== undefined);
  if (!ally.length) ok(`ally-facing absorb is available and unused — all ${absorbs.length} existing shield/ward step(s) remain caster-only`);
  else {
    ok(`${ally.length} ally-facing absorb step(s): ${ally.map(x => x.s.id).join(', ')}`);
    const noSelf = ally.filter(({ c }) => typeof c.includeSelf !== 'boolean');
    if (!noSelf.length) ok('every ally-facing absorb declares includeSelf explicitly');
    else bad(`${noSelf.length} ally absorb(s) do not declare includeSelf: ${noSelf.map(x => x.s.id).join(', ')}`);
    const scaled = ally.filter(({ c }) => c.scaleWith);
    if (!scaled.length) ok('no ally-facing absorb rides an engine — the whose-stat question is still open and still refused');
    else bad(`${scaled.length} ally absorb(s) declare scaleWith before the ruling: ${scaled.map(x => x.s.id).join(', ')}`);
  }
  if (VERBOSE) console.log(`      ${absorbs.filter(x => x.c.scaleWith).length} of ${absorbs.length} absorb steps ride an engine today`);
}

// ---- 6. the ally-facing absorb actually works ----
//
// Nothing in the shipped roster declares `allies` yet, so without this the gate
// would report a mechanism that has never run. Exercised on a SYNTHETIC step
// against a live sim: no content is converted, and the code path is proven.
{
  const mk = () => {
    const g = new Sim({ seed: 7, party: [
      { idx: 0, key: 'a', name: 'A', charId: 'toh_priest', color: '#fff' },
      { idx: 1, key: 'b', name: 'B', charId: 'toh_priest', color: '#f00' },
      { idx: 2, key: 'c', name: 'C', charId: 'toh_priest', color: '#00f' }] });
    g.players.forEach(q => { q.level = 20; q.shield = 0; q.shieldT = 0; });
    g._travelTo(g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind)).id);
    const [a, b, c] = g.players;
    b.x = a.x + 100; b.y = a.y;      // inside
    c.x = a.x + 900; c.y = a.y;      // outside
    return { g, a, b, c };
  };
  const skill = { id: 'synthetic', domain: 'physical', ranks: {} };
  const fire = (step) => {
    const { g, a, b, c } = mk();
    PRIMITIVES.shield(g, a, skill, step, 1, g.trigGrid, { states: 0 });
    return { self: Math.round(a.shield), inside: Math.round(b.shield), outside: Math.round(c.shield) };
  };

  const caster = fire({ kind: 'shield', amount: 30, duration: 5000 });
  if (caster.self > 0 && !caster.inside && !caster.outside) ok(`a step with no "allies" still shields only the caster — self ${caster.self}, ally 0`);
  else bad(`caster-only absorb leaked: ${JSON.stringify(caster)}`);

  const shared = fire({ kind: 'shield', amount: 30, duration: 5000, allies: 300, includeSelf: true });
  if (shared.self > 0 && shared.inside > 0 && !shared.outside) ok(`allies:300 includeSelf:true — caster ${shared.self}, ally at 100u ${shared.inside}, ally at 900u ${shared.outside}`);
  else bad(`ally absorb wrong: ${JSON.stringify(shared)}`);

  const given = fire({ kind: 'shield', amount: 30, duration: 5000, allies: 300, includeSelf: false });
  if (!given.self && given.inside > 0 && !given.outside) ok(`allies:300 includeSelf:false — the caster keeps nothing, the ally gets ${given.inside}`);
  else bad(`includeSelf:false wrong: ${JSON.stringify(given)}`);

  // The stacking rule is inherited, not reinvented: bigger wins, smaller is ignored.
  {
    const { g, a, b } = mk();
    PRIMITIVES.shield(g, a, skill, { kind: 'shield', amount: 40, duration: 5000, allies: 300, includeSelf: false }, 1, g.trigGrid, { states: 0 });
    const first = Math.round(b.shield);
    PRIMITIVES.shield(g, a, skill, { kind: 'shield', amount: 10, duration: 5000, allies: 300, includeSelf: false }, 1, g.trigGrid, { states: 0 });
    const after = Math.round(b.shield);
    if (first === 40 && after === 40) ok('two ally shields on one target keep the bigger — the existing rule, unchanged');
    else bad(`ally shield stacking drifted from the caster-only rule: ${first} then ${after}, want 40 then 40`);
  }
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
if (!fails) console.log('EVERY HEAL REACHES AS FAR AS IT SAYS');
process.exit(fails ? 1 : 0);
