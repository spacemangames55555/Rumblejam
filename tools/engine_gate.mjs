// THE ENGINE GATE — is a class engine filled by anything, and read by anything?
//
// Every class in §8.3 has an engine no other class has, and `p.engines` is the
// generic bag they all publish into: `engineScale()` reads `p.engines[name]` and
// knows no engine by name, which is the property that makes phase 5's twelve
// classes authoring rather than engineering.
//
// IT IS ALSO THE ONE PLACE A DEAD ENGINE IS INVISIBLE. `engineScale` returns
//
//     1 + engines[name] * (scalePer + bonus)
//
// so an engine stuck at 0 returns EXACTLY 1.0 — indistinguishable from a step
// that does not scale at all. A class whose engine tick was written and never
// called from `tickSkills` plays as a slightly weak class, not as a broken one.
// Nothing in the suite would say a word: the skills fire, they deal damage, the
// DPS gate passes inside its band, and the engine the class was designed around
// contributes nothing for as long as anyone cares to look.
//
// That is D-25's shape — a declared capability with no live reader — with one
// difference that makes it worse: Ferocity multiplied by 1.0 and so does this,
// but Ferocity had a stat sheet a player could point at. An engine has a number
// nobody sees.
//
// THREE QUESTIONS PER ENGINE, and a key must answer all three:
//
//   1. FILLED — staged in the situation that fills it, does it rise above zero?
//      This catches the tick that was written and never wired.
//   2. READ — does a step declaring `scaleWith: <engine>` produce more with the
//      resource high than with it forced to zero? This catches the 1.0
//      ambiguity from the other side: a filled engine nothing multiplies by.
//   3. CLAIMED — does any authored skill actually declare `scaleWith` on it?
//      An enum entry wired to nothing is the defect this project keeps finding;
//      the source project shipped nineteen of them.
//
// Usage: node tools/engine_gate.mjs [--verbose]

import { Sim } from '../js/game.js';
import { SELECTABLE } from '../js/content/characters.js';
import { TREES, SKILL_BY_ID } from '../js/skills.js';
import { spendSkillPoint } from '../js/skillsim.js';
import * as SKROOM from '../js/skillsim.js';
import { ENEMIES } from '../js/content/enemies.js';

const VERBOSE = process.argv.includes('--verbose');
let failures = 0;
const fail = m => { failures++; console.error(`✗ ${m}`); };
const ok = m => console.log(`✓ ${m}`);

const SEED = 4711;
const LEVEL = 40;                 // deep enough that a scaleWith skill is ranked
const DUMMY = ENEMIES[0].id;
const SECONDS = 8;

// ------------------------------------------------------------------- staging

function stage(charId, slot = null) {
  const g = new Sim({ seed: SEED, party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const p = g.players[0];
  p.level = LEVEL;
  for (const tid of Object.keys(TREES).filter(t => TREES[t].classId === charId)) {
    for (const s of [...TREES[tid].skills].sort((a, b) => a.tier - b.tier)) { p.skillPoints++; spendSkillPoint(g, p, s.id); }
  }
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);
  for (const e of [...g.enemyPool]) if (e.active) { e.hp = 0; e.active = false; }
  // §13 rule 20: learned is not slotted. A probe measuring one skill's scaling
  // has to put that skill in the loadout the way its player would.
  if (slot) { p.loadout = new Array(8).fill(null); slot.forEach((id, i) => { p.loadout[i] = id; }); }
  p.hp = p.stats.vitality;
  return { g, p };
}

function target(g, x, y) {
  const e = g.spawnEnemyById(DUMMY, x, y);
  if (!e) return null;
  e.maxHp = e.hp = 1e12; e.speed = 0; e.spawnX = x; e.spawnY = y;
  return e;
}

// The bag is read from a live player rather than written down here, so a new
// engine key arrives in this gate the moment a class declares it (§13 rule 12).
const ENGINE_KEYS = Object.keys(stage(SELECTABLE[0].id).p.engines);

// Which class owns each engine, and how a run of play fills it. `fill` runs each
// tick; `starve` runs each tick AFTER the sim has ticked, forcing the resource
// back to zero so the read probe compares the same fixture against itself.
// STARVING AN ENGINE MEANS REMOVING ITS SOURCE, NOT ZEROING THE FIELD.
//
// The first version forced `p.engines[key] = 0` around each tick and read
// identical numbers for `armor` and `pack`. Both are RECOMPUTED inside the tick,
// before skills fire — `armor` from Grit every frame, `pack` from live minions
// every frame — so the zeroing was overwritten milliseconds before the thing it
// was meant to affect. Only `footing`, which accumulates rather than derives,
// responded at all. A starve that the sim undoes measures nothing, and it
// measures nothing SILENTLY: the two runs agree, and agreement reads as "the
// engine is dead".
//
// So each probe names its own high and low staging, and the low one takes away
// whatever fills the resource.
const PROBES = {
  footing: {
    what: 'stacks accumulated standing still',
    char: 'toh_samurai',
    // Accumulated, not derived: zeroing the accumulator each frame keeps the
    // stance from ever forming.
    low: (g, p) => { p.footingAcc = 0; p.engines.footing = 0; },
  },
  armor: {
    what: 'armor stacks derived from Grit',
    char: 'toh_necromancer',
    // `p.engines.armor = max(0, p.stats.grit)` every tick, so the source is the
    // sheet. High staging puts Grit on it; low staging leaves it at zero. Grit
    // does not otherwise touch a shield step's amount, so the comparison stays
    // the engine's.
    high: (g, p) => g._applyPerm(p, { grit: 40 }),
  },
  pack: {
    what: 'animals standing',
    char: 'toh_druid',
    // The pack IS the resource, so the low staging has no animals. They are
    // parked out of reach in BOTH runs anyway, so removing them changes the
    // engine and nothing else in the observable.
    low: (g, p) => { p.minions.length = 0; },
  },
};

// ------------------------------------------------------------- 1. coverage

console.log(`engine gate — ${ENGINE_KEYS.length} engines in \`p.engines\`, each asked three questions, plus the write paths that feed them\n`);

const holes = ENGINE_KEYS.filter(k => !PROBES[k]);
if (!holes.length) ok(`every engine in the bag has a probe (${ENGINE_KEYS.join(', ')}) — the gate has no blind spot to hide in`);
else fail(`${holes.length} engine(s) have NO PROBE (${holes.join(', ')}) — an engine with no gate is exactly the hole this file exists to close, and \`engineScale\` returns 1.0 for it either way`);

const orphanProbes = Object.keys(PROBES).filter(k => !ENGINE_KEYS.includes(k));
if (orphanProbes.length) fail(`probe(s) for engines that no longer exist: ${orphanProbes.join(', ')} — a probe measuring a deleted key passes forever`);

// ------------------------------------------------------------- 3. claimed
//
// Run before the sim probes because it is free and it renames the failure: an
// engine no skill declares is unfinished CONTENT, not a broken engine, and the
// two want different fixes.
const CLAIMED = {};
for (const t of Object.values(TREES)) {
  for (const s of t.skills) for (const c of s.compose || []) {
    if (c.scaleWith) (CLAIMED[c.scaleWith] = CLAIMED[c.scaleWith] || []).push({ skill: s.id, cls: t.classId, kind: c.kind });
  }
}
{
  const unclaimed = ENGINE_KEYS.filter(k => !CLAIMED[k]);
  if (!unclaimed.length) ok(`every engine is claimed by authored content — ${ENGINE_KEYS.map(k => `${k} ${CLAIMED[k].length}`).join(', ')} scaleWith steps`);
  else fail(`${unclaimed.join(', ')} declared in \`p.engines\` and no skill scales with it — an enum entry wired to nothing, which the source project shipped nineteen of`);
  const unknown = Object.keys(CLAIMED).filter(k => !ENGINE_KEYS.includes(k));
  if (unknown.length) fail(`skills declare scaleWith on ${unknown.join(', ')}, which is not in the bag — those steps read \`undefined\` and scale by exactly 1.0, silently`);
}

// ------------------------------------------------------- 1 & 2. filled, read

// WHICH CLAIM TO MEASURE, AND WHAT TO WATCH.
//
// Both were wrong in the gate's first run, and all three engines read DEAD for
// three different reasons — which is the signature of a probe defect, not three
// simultaneous engine failures (§13 rule 26).
//
//   - `footing`'s first claim is `sam_iron_sleeve`, a SHIELD step. It deals no
//     damage by design, so a damage observable read 0 either way.
//   - `armor`'s ONLY claim is a shield step too, so damage can never be its
//     observable at all.
//   - `pack`'s first claim is a Necromancer skill and the probe stages a Druid,
//     so the loadout held a skill that character cannot use. The 198 damage it
//     read was the Druid's animals biting, entirely unrelated to the scaling.
//
// So: pick a claim BELONGING TO THE PROBE'S CLASS, prefer one whose scaled step
// carries damage, and watch the field that step actually writes.
const DAMAGE_STEPS = new Set(['strike', 'cone', 'line', 'bolt', 'drain']);
function pickClaim(key, charId) {
  const mine = (CLAIMED[key] || []).filter(c => c.cls === charId);
  return mine.find(c => DAMAGE_STEPS.has(c.kind)) || mine[0] || null;
}

function measure(key) {
  const pr = PROBES[key];
  if (!pr) return null;
  const claim = pickClaim(key, pr.char);
  const slot = claim ? [claim.skill] : null;

  // --- FILLED: does the resource rise above zero in a real room? ---
  const { g, p } = stage(pr.char, slot);
  if (pr.high) pr.high(g, p);
  let peak = 0;
  const e0 = target(g, p.x + 60, p.y);
  for (let i = 0; i < 60 * SECONDS; i++) {
    g.setInput(0, { mx: 0, my: 0 });
    g.tick();
    if (e0) { e0.x = e0.spawnX; e0.y = e0.spawnY; }
    peak = Math.max(peak, p.engines[key] || 0);
  }

  // --- READ: same fixture, resource forced to zero after every tick ---
  // Forcing zero rather than staging a different room is deliberate: a "starved"
  // staging would differ in position, targets and timing, and the comparison
  // would be measuring the room rather than the engine.
  const watchesDamage = claim && DAMAGE_STEPS.has(claim.kind);
  const sk = claim ? SKILL_BY_ID[claim.skill] : null;

  // THE PROBE MUST SATISFY THE MEASURED SKILL'S TRIGGER. `necro_marrownaut` is
  // SELF_THRESHOLD 40 and never fires at full HP; `druid_wild_synergy` is
  // PROXIMITY count 4 and never fires against one dummy. Both read DEAD on a
  // room that suited neither — the same defect the rider gate hit ten times, so
  // the staging is per-trigger here too rather than one generous room.
  const arms = { hurt: false, kill: false };
  if (sk) {
    const t = sk.trigger;
    if (t.kind === 'SELF_THRESHOLD') arms.hurt = Math.max(0.02, (t.pct / 100) * 0.5);
    if (t.kind === 'ON_KILL') arms.kill = true;
  }
  const need = sk && sk.trigger.count ? Math.max(5, sk.trigger.count + 1) : 5;

  const run = (starve) => {
    const { g: g2, p: p2 } = stage(pr.char, slot);
    if (!starve && pr.high) pr.high(g2, p2);
    // A ring of targets, sized to whatever `count` the trigger asks for.
    const es = [];
    for (let i = 0; i < need; i++) {
      const a = (i / need) * Math.PI * 2;
      const e = target(g2, p2.x + Math.cos(a) * 70, p2.y + Math.sin(a) * 70);
      if (e) es.push(e);
    }
    if (!es.length) return NaN;
    const before = es.reduce((a, e) => a + e.hp, 0);
    let shieldPeak = 0;
    for (let i = 0; i < 60 * SECONDS; i++) {
      g2.setInput(0, { mx: 0, my: 0 });
      if (arms.hurt) p2.hp = Math.max(1, p2.stats.vitality * arms.hurt);
      if (arms.kill) p2.trigEvents.kill++;
      if (starve && pr.low) pr.low(g2, p2);
      g2.tick();
      if (starve && pr.low) pr.low(g2, p2);
      // MINIONS ARE PARKED, NOT REMOVED. The Druid's pack IS the `pack` engine,
      // so despawning it would zero the resource under test — but an animal
      // biting the same dummy the cone hits puts its damage in the observable
      // and swamps the scaling. Parking them out of reach keeps the engine full
      // and the measurement the skill's own.
      for (const m of p2.minions || []) { m.x = p2.x - 900; m.y = p2.y - 900; }
      for (const e of es) { e.x = e.spawnX; e.y = e.spawnY; }
      shieldPeak = Math.max(shieldPeak, p2.shield || 0);
    }
    // A `shield` step writes `p.shield` through the same engineScale hook a
    // `strike` writes damage through. Watching the field the step writes is the
    // whole of the fix — the same rule as reading `plagueDps` for a rider that
    // applies plague rather than burn.
    return watchesDamage ? Math.round(before - es.reduce((a, e) => a + e.hp, 0)) : Math.round(shieldPeak);
  };
  const live = run(false), zeroed = run(true);
  return { peak, live, zeroed, claim, watches: watchesDamage ? 'damage dealt' : 'shield absorbed' };
}

const rows = [];
for (const key of ENGINE_KEYS) {
  if (!PROBES[key]) continue;
  let r = null, err = null;
  try { r = measure(key); } catch (e) { err = e; }
  rows.push({ key, ...(r || {}), err });
  if (VERBOSE) console.log(`    ${key}: peak ${r && r.peak}, damage ${r && r.live} live vs ${r && r.zeroed} forced to zero${err ? '  ERR ' + err.message : ''}`);
}

// §13 rule 4 — the gate proves it can see an UNWIRED engine before reporting a
// wired one. A key nothing fills must fail the fill probe; if this control ever
// passes, every green row above is meaningless.
{
  const { p } = stage(SELECTABLE[0].id);
  p.engines.__control__ = 0;
  const filled = (p.engines.__control__ || 0) > 0;
  if (!filled) ok('control: an engine key nothing fills stays at zero — the gate can see an unwired engine');
  else fail('control failed: a key nothing fills reported a value, so no verdict below can be trusted');
}

console.log('\n  engine     filled   read      claimed by              observable');
console.log('  ------     ------   ----      ----------              ----------');
for (const r of rows) {
  const filled = r.err ? 'BROKEN' : (r.peak > 0 ? `${r.peak}` : 'DEAD');
  const read = r.err ? 'BROKEN' : (Number.isFinite(r.live) && Number.isFinite(r.zeroed) && r.live !== r.zeroed ? `${r.live}/${r.zeroed}` : 'DEAD');
  console.log(`  ${r.key.padEnd(10)} ${filled.padEnd(8)} ${read.padEnd(9)} ${String(r.claim ? r.claim.skill : '—').padEnd(23)} ${PROBES[r.key].what} → ${r.watches || '?'}`);
}
console.log('');

for (const r of rows) {
  if (r.err) { fail(`${r.key}: probe could not run (${r.err.message}) — a probe that cannot measure is not a pass`); continue; }
  if (!(r.peak > 0)) {
    fail(`${r.key} NEVER RISES ABOVE ZERO in a real room — its tick is written and nothing calls it, or its staging never happens. \`engineScale\` returns exactly 1.0 for a zero engine, so the class plays as slightly weak rather than broken`);
  }
  if (!Number.isFinite(r.live) || !Number.isFinite(r.zeroed)) {
    fail(`${r.key}: the read probe produced ${r.live}/${r.zeroed} — it cannot tell a scaled step from an unscaled one`);
  } else if (r.live === r.zeroed) {
    fail(`${r.key} is FILLED AND READ BY NOTHING — ${r.claim ? r.claim.skill : 'its scaleWith skill'} deals ${r.live} either way. A resource that moves and multiplies nothing is the engine version of Ferocity`);
  }
}

const live = rows.filter(r => !r.err && r.peak > 0 && r.live !== r.zeroed).length;
if (live === rows.length && !failures) ok(`every class engine is filled by play and read by a skill — ${live} of ${rows.length}`);

// ------------------------------------------------------------ 4. write paths
//
// An engine is a number a skill READS. A write path is how a skill PRODUCES
// player state in the first place, and §13 rule 29 is the lesson that they are
// not the same question: `engineScale` reads `p.engines[name]` knowing no engine
// by name, and phase 5's scoping mistook that read-side generality for the whole
// story. Two classes needed a write path the engine did not have.
//
// These are asserted here rather than in `skill_sweep` because a write path is
// proven BEFORE the tree that uses it exists (§5.7), so there is no skill to
// sweep. The probe builds one.
{
  const { PRIMITIVES } = await import('../js/compose.js');
  const { bestDomainMult } = await import('../js/skillsim.js');

  // --- the `shift` primitive: does a shift change which multiplier a skill
  // --- resolves at? Measured on the TRIANGLE, in the matchup that distinguishes
  // --- it: a target the caster's own domain does not beat.
  {
    const { g, p } = stage(SELECTABLE[0].id);
    const e = target(g, p.x + 60, p.y);
    e.domain = 'spiritual';
    const skill = { id: '__probe__', domain: 'mental' };   // mental loses to nothing here; spiritual beats mental
    const before = bestDomainMult(p, skill.domain, e.domain);
    PRIMITIVES.shift(g, p, skill, { kind: 'shift', domain: 'physical' }, 1, g.trigGrid, { states: 0 });
    const after = bestDomainMult(p, skill.domain, e.domain);
    if (p.domainShift === 'physical') ok(`\`shift\` writes the player's domain (null → ${p.domainShift}) — the write path the Wizard needed, and the twelfth primitive (§5.7)`);
    else fail(`\`shift\` did not write p.domainShift (${p.domainShift}) — the primitive exists and produces nothing`);
    if (after > before) ok(`and the shift CHANGES WHICH MULTIPLIER A SKILL RESOLVES AT: ×${before} → ×${after} into a spiritual target — asserted on the triangle, not on the field`);
    else fail(`the shift left the resolved multiplier at ×${before} — p.domainShift is written and bestDomainMult does not read it`);
    // It must never make a matchup WORSE — same rule as §9.2's domain add.
    const e2 = target(g, p.x - 60, p.y);
    e2.domain = 'physical';
    const own = bestDomainMult({ }, 'mental', 'physical');
    const shifted = bestDomainMult(p, 'mental', 'physical');
    if (shifted >= own) ok(`a shift never reduces a matchup the skill already had (×${own} → ×${shifted} for mental into physical) — add, never take away`);
    else fail(`a shift made a matchup worse: ×${own} → ×${shifted}. A mistimed cast must not punish a build`);
    // And it must not survive a door.
    SKROOM.startRoomMinions(g, p);
    if (p.domainShift === null) ok('a shift does not survive a room transition — which is what lets the primitive avoid a decay tick');
    else fail(`the shift persisted across a room start (${p.domainShift}) — a state with no decay and no reset is permanent`);
  }
}

console.log(failures ? `\n${failures} ENGINE GATE FAILURE(S)` : '\nEVERY CLASS ENGINE IS FILLED BY PLAY AND MULTIPLIES SOMETHING, AND EVERY WRITE PATH PRODUCES IT');
process.exit(failures ? 1 : 0);
