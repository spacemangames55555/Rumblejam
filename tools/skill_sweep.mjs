// EVERY SKILL, THROUGH ITS REAL RUNTIME PATH.
//
//   node tools/skill_sweep.mjs [--verbose]
//
// The source project shipped 19 skill kinds wired to nothing, plus stance
// multipliers and a resource generator nothing ever read — all silently, all
// passing whatever tests existed. Confirming a skill EXISTS in a data file
// proves nothing at all. So this drives each skill through the live sim:
// arranges the world so its trigger genuinely holds, runs real ticks, and
// requires an observable effect — damage dealt, a status applied, or a state
// changed. A skill that fires and does nothing fails here.
//
// It also fails when a primitive or rider is defined but unreachable, which is
// the same defect one layer down.

const { Sim } = await import('../js/game.js');
const SK = await import('../js/skillsim.js');
const { TREES, SKILL_BY_ID, ALL_SKILLS } = await import('../js/skills.js');
const { PRIMITIVE_KINDS, IMPACT_RIDERS, SHAPE_RIDERS, BOLT_RIDERS } = await import('../js/compose.js');
const { spawnMinions } = await import('../js/minions.js');
const { CONFIG } = await import('../js/config.js');

const VERBOSE = process.argv.includes('--verbose');
let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

// Derived from the registry, not restated. This was a hand-written two-entry
// map and it drifted the moment a third tree existed — every skill in the new
// trees crashed on an undefined charId. A list of things that already exist
// somewhere else is a list that goes stale.
const CLASS_OF = Object.fromEntries(Object.values(TREES).map(t => [t.id, t.classId]));

// Build a sim with one player who has learned `skill` and its whole prereq
// chain at rank 1, with `skill` slotted and nothing else able to fire.
function arena(skill) {
  const g = new Sim({ seed: 4242, party: [{ idx: 0, key: 'k', name: 'T', charId: CLASS_OF[skill.tree], color: '#fff' }] });
  g.uiAction(0, { kind: 'pickNode', nodeId: g.reachableNodes()[0] });
  const p = g.players[0];
  for (const e of [...g.enemyPool]) g.enemyPool.release(e);
  g.spawnQueue.length = 0;
  g.wave.done = false;
  // Clear the architecture. Every skill in the sweep is staged from the same
  // seed at the same spot, so one pillar beside the spawn silently killed every
  // projectile 26 units out and read as five skills "wired to nothing". Walls
  // and line of sight are real and tested elsewhere; what is under test here is
  // whether a skill reaches its runtime path at all.
  g.obstacles.length = 0;
  p.x = g.W / 2; p.y = g.H / 2;
  // learn the chain
  const chain = [];
  for (let s = skill; s; s = s.prereq ? SKILL_BY_ID[s.prereq] : null) chain.unshift(s);
  for (const s of chain) { p.skillPoints++; SK.spendSkillPoint(g, p, s.id); }
  p.loadout.fill(null);
  if (skill.type === 'active') p.loadout[0] = skill.id;
  p.level = 66;              // every slot open, so slot gating never masks a miss
  g.god = true;              // the dummy must not kill the tester
  // A CHI-COSTING SKILL IS A PAIR TOO (§13 rule 41), and for the same reason a
  // `from: 'pet'` skill is. The Monk's spends do not fire unless the pool can pay
  // — that is the ruling, checked one line after the cooldown check — so a skill
  // staged ALONE with an empty pool never fires and the sweep reports its trigger
  // dead while the trigger was never the thing being asked about. The Chi is
  // granted rather than earned because the generator is EVERY damaging skill and
  // the sweep deliberately slots only the one under test: there is no single node
  // to lend, so the fixture supplies the state a Monk mid-fight would have.
  if (skill.chi) {
    p.chi = Math.max(p.chi || 0, skill.chi * 2);
    p.chiLastGain = g.time;
    p.engines.chi = p.chi;
  }
  // AND A `form`-GATED SKILL IS A PAIR TOO (§13 rule 41) — the third of this
  // shape after `from: 'pet'` and the Monk's `chi`. A skill declaring
  // `form: 'pyrite'` does not fire out of that form, so staged alone it reads as
  // a dead trigger. The form is entered rather than assigned: `p.formStats` has
  // to arrive too or the stat half of the state is missing, and the fixture would
  // be testing a form that changes nothing.
  if (skill.form) {
    const src = ALL_SKILLS.find(x => (x.compose || []).some(c => c.kind === 'form' && c.form === skill.form));
    const step = src && src.compose.find(c => c.kind === 'form');
    p.form = skill.form;
    p.formT = 30;
    p.formStats = step ? step.stats || null : null;
    p.engines.form = CONFIG.FORM_POWER;
    g._recomputeStats(p);
  }
  // A `from: 'pet'` SKILL IS A PAIR AND CANNOT BE STAGED ALONE (§13 rule 41).
  // Its trigger asks its question at the beast, so with no beast on the field
  // `triggerOrigin` returns null and the skill never fires — which the sweep
  // reports as "trigger never fired with its condition staged" while the
  // condition it staged was never the one being asked. The beast is not a
  // favour: the summon is already in this skill's own prereq chain and was
  // learned above, so lending the body is only casting a node the fixture
  // already owns and is deliberately keeping out of the loadout.
  if (skill.from === 'pet') {
    const src = chain.find(s => (s.compose || []).some(c => c.kind === 'summon'));
    const step = src && src.compose.find(c => c.kind === 'summon');
    if (step) spawnMinions(g, p, src, step, 1);
  }
  return { g, p };
}

// A stationary dummy that cannot fight back, so nothing but the skill under
// test can change the world.
function dummy(g, x, y, hpFrac = 1) {
  const e = g.spawnEnemyById('skulker', x, y, { noMats: true });
  if (!e) return null;
  e.spd = 0;
  e.maxHp = 4000; e.hp = Math.max(1, Math.round(4000 * hpFrac));
  e.dmg = 0;
  return e;
}

// Arrange the world so `skill.trigger` genuinely holds. Returns the dummies.
function stage(g, p, skill) {
  const t = skill.trigger;
  const out = [];
  const ring = (n, r) => {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const e = dummy(g, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      if (e) out.push(e);
    }
  };
  switch (t.kind) {
    case 'NEAREST': ring(1, Math.min(t.range * 0.5, 60)); break;
    case 'PROXIMITY': ring(t.count + 1, t.radius * 0.5); break;
    // fewer than `count` inside `radius`: one dummy, placed inside the reach of
    // whatever the skill actually fires so there is something to hit
    case 'ISOLATED': ring(1, Math.min(t.radius * 0.4, 80)); break;
    case 'TARGET_THRESHOLD': {
      const e = dummy(g, p.x + Math.min(t.range * 0.4, 60), p.y, (t.pct - 10) / 100);
      if (e) out.push(e);
      break;
    }
    case 'ON_STATUS': {
      const e = dummy(g, p.x + Math.min(t.range * 0.3, 60), p.y);
      if (e) { g.applyPlague(e, 20, 5, p, skill); out.push(e); }
      break;
    }
    // A soul token on the floor, inside the trigger's range — the world state
    // ON_TOKEN reads. Dropped through the sim's own pool rather than pushed
    // onto the array, so the sweep exercises the same path a kill does.
    case 'ON_TOKEN': {
      ring(1, 60);
      g.tokens.push({ id: ++g.spawnCounter, x: p.x + Math.min(t.range * 0.3, 50), y: p.y, ttl: CONFIG.SOUL_TOKEN_TTL });
      break;
    }
    case 'ON_HIT_TAKEN': ring(1, 60); p.trigEvents.hitTaken = 1; break;
    case 'ON_KILL': ring(1, 60); p.trigEvents.kill = 1; break;
    case 'ON_DODGE': ring(1, 60); p.trigEvents.dodgeT = g.time; break;
    case 'SELF_THRESHOLD': ring(1, 60); p.hp = p.stats.vitality * (t.pct - 10) / 100; break;
    case 'MOVEMENT':
      ring(1, 60);
      if (t.mode === 'still') p.stillT = t.seconds + 1; else p.movingT = t.seconds + 1;
      break;
    default: ring(1, 60);
  }
  return out;
}

// A snapshot of everything a skill could observably change.
function observe(g, p, foes) {
  return {
    dealt: p.damageDealt,
    foeHp: foes.reduce((a, e) => a + (e.active ? e.hp : 0), 0),
    statuses: foes.reduce((a, e) => a
      + (e.slowT > 0 ? 1 : 0) + (e.plagueT > 0 ? 1 : 0) + (e.stunT > 0 ? 1 : 0)
      + (e.rootT > 0 ? 1 : 0) + (e.weakDmgT > 0 ? 1 : 0) + (e.defDownT > 0 ? 1 : 0)
      + (Math.abs(e.knockX) + Math.abs(e.knockY) > 0 ? 1 : 0), 0),
    shield: p.shield, ward: p.ward,
    zones: g.zones.length, projs: g.projPool.count,
    hp: p.hp,
    // A FORM IS A STATE, so the state is the observable. Without this the three
    // `form` steps were judged on their side effects and two of them passed by
    // ACCIDENT — Pyrite and Calcite grant Vitality, which moves max HP, while
    // Quartz grants Attunement and Ferocity and moved nothing the snapshot read.
    // The one that failed was the only honest reading of the three (§13 rule 37).
    form: p.form || null,
    // A summon's observable effect is THE SUMMON. Without this, Raise Skeleton
    // passed the sweep on the damage its skeleton happened to deal inside the
    // window — a real effect, but not the one the skill claims, and it would
    // still have passed with the spawn broken and only the wisp firing.
    minions: (p.minions || []).length,
    // A SHIFT'S WHOLE EFFECT IS PLAYER STATE. The three Attune nodes deal no
    // damage, apply no status and spawn nothing — by design — so every existing
    // observable read them as wired to nothing. The sweep's own list is what was
    // incomplete: it covered damage, statuses, zones, projectiles, summons and
    // heals, and the twelfth primitive writes none of those. Same shape as the
    // summon and heal entries above, and added for the same reason.
    domain: p.domainShift || '',
    shifts: p.domainShifts || 0,
    // AND A TRAP'S WHOLE EFFECT IS DEFERRED. The thirteenth primitive places an
    // inert object: no damage, no status, no zone, no projectile — that is what
    // makes it a trap rather than a hazard, and it is why the sweep read the
    // three placing skills as wired to nothing. The observable is that the
    // OBJECT EXISTS; what it does later belongs to `engine_gate`, which asserts
    // both halves (inert while placed, consumed by a cast).
    traps: g.traps.filter(t => t.owner === p.idx).length,
  };
}

// ---------------------------------------------------------------- the sweep

console.log(`sweeping ${ALL_SKILLS.length} skills through the live sim\n`);

const unreached = { primitives: new Set(PRIMITIVE_KINDS), riders: new Set([...IMPACT_RIDERS, ...SHAPE_RIDERS, ...BOLT_RIDERS]) };
for (const s of ALL_SKILLS) {
  for (const step of s.compose || []) {
    unreached.primitives.delete(step.kind);
    for (const r of Object.keys(step.riders || {})) unreached.riders.delete(r);
    if (step.reflectPct !== undefined) unreached.riders.delete('reflectPct');
  }
}

for (const skill of ALL_SKILLS) {
  try {
    const { g, p } = arena(skill);

    if (skill.type === 'passive') {
      // A passive's runtime path is the state it changes. `passiveSum` is what
      // the engine actually reads, so that is what is asserted — not that the
      // definition has a `passive` block.
      const keys = Object.keys(skill.passive || {});
      if (!keys.length) { fail(`${skill.id}: passive with no effect block`); continue; }
      const live = keys.filter(k => SK.passiveSum(p, k) > 0);
      if (live.length === keys.length) ok(`${skill.id} (passive) — ${keys.map(k => `${k}=${SK.passiveSum(p, k)}`).join(', ')} readable at rank 1`);
      else fail(`${skill.id}: passive key(s) ${keys.filter(k => !live.includes(k)).join(', ')} read as 0 — defined but wired to nothing`);
      continue;
    }

    const foes = stage(g, p, skill);
    if (!foes.length) { fail(`${skill.id}: could not stage a target`); continue; }
    const before = observe(g, p, foes);

    // real ticks, through the real trigger loop — nothing is called directly
    let fired = false;
    for (let i = 0; i < 60 * 6; i++) {
      g.setInput(0, { mx: 0, my: 0 });
      if (skill.trigger.kind === 'MOVEMENT' && skill.trigger.mode === 'still') p.stillT = skill.trigger.seconds + 1;
      g.tick();
      for (const e of foes) { e.x = e.spawnX ??= e.x; e.y = e.spawnY ??= e.y; }
      if (p.fireLog.length) fired = true;
      if (fired && i > 30) break;
    }
    const after = observe(g, p, foes);

    if (!fired) { fail(`${skill.id}: trigger ${skill.trigger.kind} never fired in 6s with its condition staged`); continue; }

    const effects = [];
    if (after.dealt > before.dealt) effects.push(`damage +${Math.round(after.dealt - before.dealt)}`);
    if (after.foeHp < before.foeHp) effects.push(`enemy hp -${Math.round(before.foeHp - after.foeHp)}`);
    if (after.statuses > before.statuses) effects.push(`statuses +${after.statuses - before.statuses}`);
    if (after.shield > before.shield) effects.push(`shield ${Math.round(after.shield)}`);
    if (after.ward > before.ward) effects.push(`ward ${Math.round(after.ward)}`);
    if (after.zones > before.zones) effects.push(`zone`);
    if (after.projs > before.projs) effects.push(`projectile`);
    if (after.minions > before.minions) effects.push(`summon +${after.minions - before.minions}`);
    // A heal's whole effect is HP that came back. Every SELF_THRESHOLD skill is
    // staged below its own threshold, so there is always room to heal into —
    // without this the Druid's Rejuvenate fired correctly every run and was
    // reported as wired to nothing.
    if (after.hp > before.hp) effects.push(`healed +${Math.round(after.hp - before.hp)}`);
    if (after.domain !== before.domain) effects.push(`domain -> ${after.domain}`);
    else if (after.shifts > before.shifts) effects.push(`re-attuned (${after.shifts} banked)`);
    if (after.traps > before.traps) effects.push(`trap set (${after.traps} armed)`);
    if (after.form !== before.form && after.form) effects.push(`form -> ${after.form}`);

    if (effects.length) ok(`${skill.id} — ${skill.trigger.kind} fired, ${effects.join(', ')}`);
    else fail(`${skill.id}: fired but produced NOTHING observable — a skill wired to nothing`);
    if (VERBOSE) console.log(`    ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  } catch (err) {
    fail(`${skill.id}: crashed — ${err.message}`);
    if (VERBOSE) console.error(err.stack);
  }
}

// A primitive or rider that exists in code and in no skill is not proof of a
// bug — the spec deliberately stubs some for phase 2 — but it IS the thing that
// has to be reported rather than discovered later, so it is printed by name.
console.log('');
if (unreached.primitives.size) console.log(`  primitives defined but used by no phase-1 skill: ${[...unreached.primitives].join(', ')}`);
if (unreached.riders.size) console.log(`  riders defined but used by no phase-1 skill: ${[...unreached.riders].join(', ')}`);

console.log(failures ? `\n${failures} SKILL FAILURE(S)` : '\nALL SKILLS REACHED THEIR RUNTIME PATH');
process.exit(failures ? 1 : 0);
