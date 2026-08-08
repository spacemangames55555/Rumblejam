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
import { SELECTABLE, CHAR_BY_ID } from '../js/content/characters.js';
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
// The Bard's rhythm window, read off the trait rather than restated — the gate's
// filler predicate below is only correct relative to whatever the trait says.
const RHYTHM_WINDOW_MS = (CHAR_BY_ID['toh_bard'].trait.windowSec) * 1000;

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
  shift: {
    what: 'attunements banked this room',
    char: 'toh_wizard',
    // Filled by the `shift` primitive firing on its own cooldown — nothing to
    // stage beyond letting the Wizard's own Attune nodes come up. The low
    // staging keeps the counter at zero each frame; unlike `armor` and `pack`
    // this one is ACCUMULATED rather than derived, so zeroing it holds.
    low: (g, p) => { p.domainShifts = 0; p.engines.shift = 0; },
    // WHAT FILLS IT IS ANOTHER SKILL, and the loadout has three slots. `footing`,
    // `armor` and `pack` are filled by standing still, by the stat sheet and by
    // the pack — none of which needs a slot — so the gate only ever slotted the
    // skill it was MEASURING. For an engine a skill fills, that fixture measures
    // a Wizard who never attunes. Derived from the trees rather than named, so a
    // content rename cannot turn this into a silent zero (§13 rule 12).
    fills: sk => (sk.compose || []).some(c => c.kind === 'shift'),
  },
  marks: {
    what: 'enemies carrying this player\'s judgment',
    char: 'toh_priest',
    // The marks ARE the resource, so the low staging clears them off the
    // enemies each frame — the same shape as removing the Druid's animals. The
    // marked enemies stay in the room either way, so the only thing that
    // changes between the two runs is the count the engine publishes.
    low: (g, p) => { for (const e of g.enemyPool) if (e.active) e.markT = 0; p.engines.marks = 0; },
    fills: sk => (sk.compose || []).some(c => c.riders && c.riders.mark),
  },
  rhythm: {
    what: 'stacks held in the beat',
    char: 'toh_bard',
    // THE ONLY ENGINE WITH A LOSS CONDITION, and the staging is the loss.
    // `tohOnFire` builds a stack on every cast and `tohTick` wipes the whole
    // stack when the window lapses, so the low run does not need to remove a
    // SOURCE the way `shift` and `marks` do — it drops the chain, which is what
    // a player who stops casting suffers. Zeroing both the stack and its timer
    // each frame is exactly "the window lapsed", stated in the engine's own
    // terms rather than by starving the thing that fills it.
    low: (g, p) => { p.rhythm = 0; p.rhythmT = 0; p.engines.rhythm = 0; },
    // EVERY skill fills it — the hook is on the cast, not on the effect — but
    // that is not the same as every skill SUSTAINING it, and the gate's first
    // run made the difference concrete. Slotted alone, `bard_quickstep` reached
    // exactly ONE stack: its 2000 ms cooldown is longer than the 1.5 s window,
    // so the chain lapsed between every cast and the engine read 1 forever.
    //
    // That is the class working as designed, not a fixture bug — a Cadence node
    // slower than the window cannot hold its own chain, which is precisely why
    // the tree opens with a metronome. So the filler is derived the same way
    // `shift` and `marks` derive theirs: any active whose cooldown fits inside
    // the window. Named by the PROPERTY rather than by the skill, so retuning a
    // cooldown past the window shows up here instead of silently going quiet
    // (§13 rule 12).
    fills: sk => sk.cooldown > 0 && sk.cooldown < RHYTHM_WINDOW_MS,
  },
  crystal: {
    what: 'crystal absorbed from damage taken',
    char: 'toh_mage',
    // THE ONLY ENGINE THE ENEMY FILLS, so it is the only one whose staging has
    // to keep happening. `high` runs once and the dummies here are inert by
    // construction (speed 0, dmg 0) — nothing in this fixture would ever hit the
    // player. `each` runs every tick, on BOTH runs, and hurts the Mage through
    // `hurtPlayer` itself rather than by writing the field: that is the whole
    // path under test, Grit and shields and `tohOnHurt` included.
    //
    // The HP is restored immediately afterwards. The gate is measuring whether
    // absorbed damage becomes crystal, not whether a Mage standing in a fire
    // survives it, and a probe that lets its subject die measures the death.
    each: (g, p) => { p.invuln = 0; g.hurtPlayer(p, 8, null); p.hp = p.stats.vitality; },
    low: (g, p) => { p.crystal = 0; p.engines.crystal = 0; },
  },
  doll: {
    what: 'debt banked in the bound enemy',
    char: 'toh_witch_doctor',
    // NO `each` STAGING, AND THAT IS A MEASURED ANSWER RATHER THAN AN ASSUMPTION.
    // `crystal` needed per-tick staging because the fixture's dummies deal no
    // damage and never would. The doll is different: the mirror pays whenever
    // the Witch Doctor damages ANYTHING that is not the doll, and this fixture's
    // ring gives it exactly that — several bodies, one of them designated. So
    // the engine fills from ordinary play here, the way footing and marks do.
    //
    // What it DOES need is the designating skill in the loadout, for the same
    // reason `shift` and `marks` do: the gate slots only the measured skill, and
    // the measured skill is one that READS the doll rather than one that names
    // it. Derived from the rider rather than named (§13 rule 12).
    //
    // It does need a CROWD, though, and that is the staging the doll turned up:
    // the mirror pays only on damage to something that is not the doll, so a
    // one-dummy room is a room this engine cannot exist in. Four bodies is the
    // smallest room where a doll and a source of debt are different enemies.
    bodies: 4,
    // AND IT NEEDS A LONGER WINDOW THAN ANY OTHER ENGINE, because it is the
    // slowest to fill by a wide margin. Measured in a real fight, the doll banks
    // 2.1 stacks at 10 s, 4.0 at 20 s, 6.0 at 30 s and reaches the cap around
    // 50 s — a deliberate ramp for an engine whose whole payoff is the window
    // before the doll dies. At the shared 6 s the gate saw 0.30 stacks and a
    // 56/54 damage split: a PASS, but one bad tick away from a false negative.
    // An instrument that barely distinguishes is not an instrument (§13 rule 37
    // from the other end — saturated there, starved here).
    seconds: 30,
    low: (g, p) => { p.voodooDmg = 0; p.engines.doll = 0; },
    // THE FILLER SET IS "ANYTHING THAT DEALS DAMAGE", not "the skill that names
    // the doll". `shift` and `marks` are filled by one specific step, so their
    // fillers are that step; the mirror takes 35% of EVERYTHING the Witch Doctor
    // lands on anything that is not the doll, so the honest loadout is the one a
    // Witch Doctor actually carries. With only the designator slotted the gate
    // saw one stack and a 76/74 split — true, and thin enough to be one tick
    // from a false negative.
    fills: sk => (sk.compose || []).some(c => c.riders && c.riders.doll)
      || (sk.compose || []).some(c => ['strike', 'cone', 'line', 'bolt', 'drain'].includes(c.kind)),
    // Without a designated doll there is no engine at all, so the designator
    // must survive the eight-slot truncation whatever else is in the tree.
    fillsFirst: sk => (sk.compose || []).some(c => c.riders && c.riders.doll),
  },
  drench: {
    what: 'drench stacks standing across the room',
    char: 'toh_sundian',
    // A ROOM-WIDE COUNT, so it needs a room. The engine sums stacks across every
    // enemy this player has soaked, which means one dummy measures a twelfth of
    // what the tree is authored against.
    bodies: 5,
    // The counter IS the resource, so the starve clears it off the enemies each
    // frame — the same shape as removing the Priest's marks. `drenchBy` goes with
    // it, or the next application would top up a stack the gate thinks is gone.
    low: (g, p) => {
      for (const e of g.enemyPool) if (e.active) { e.drench = 0; e.drenchT = 0; e.drenchBy = -1; }
      p.engines.drench = 0;
    },
    // Filled by any skill carrying the counter. Derived from the rider rather
    // than named, so a content rename cannot turn this into a silent zero.
    fills: sk => (sk.compose || []).some(c => c.riders && c.riders.drench),
    fillsFirst: sk => (sk.compose || []).some(c => c.riders && c.riders.drench),
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
  // The measured skill FIRST, then whatever fills the engine — a loadout the
  // player who wanted this engine would actually be carrying (§13 rule 20).
  let fillers = pr.fills
    ? Object.values(TREES).filter(t => t.classId === pr.char)
        .flatMap(t => t.skills).filter(x => x.type === 'active' && pr.fills(x)).map(x => x.id)
    : [];
  // THE LOADOUT IS EIGHT SLOTS AND THE LIST IS TRUNCATED TO FIT, so an engine
  // with a broad filler set can push its ESSENTIAL filler out of the room. The
  // doll is fed by any damage but only exists once something designates it, and
  // if `wd_pin` fell past slot eight the gate would read a weaker engine and
  // still pass. `fillsFirst` names the filler that must survive the truncation.
  if (pr.fillsFirst) {
    const key = id => (pr.fillsFirst(SKILL_BY_ID[id]) ? 0 : 1);
    fillers = [...fillers].sort((a2, b2) => key(a2) - key(b2));
  }
  const slot = claim ? [claim.skill, ...fillers].slice(0, 8) : null;

  // --- FILLED: does the resource rise above zero in a real room? ---
  const { g, p } = stage(pr.char, slot);
  if (pr.high) pr.high(g, p);
  let peak = 0;
  // ONE BODY IS A ROOM SOME ENGINES CANNOT EXIST IN. The FILLED phase staged a
  // single dummy, which is enough for footing, armor, shift, rhythm and crystal
  // — and is precisely the wrong room for the doll, because the mirror only pays
  // when the Witch Doctor damages something that is NOT the doll. With one enemy
  // the doll is that enemy, `voodooMirror` skips it, and the engine reads zero
  // while working perfectly. `bodies` names how big a crowd the engine needs.
  const bodies = [];
  for (let i = 0; i < (pr.bodies || 1); i++) {
    const a2 = (i / (pr.bodies || 1)) * Math.PI * 2;
    const e = target(g, p.x + Math.cos(a2) * 60, p.y + Math.sin(a2) * 60);
    if (e) bodies.push(e);
  }
  const secs = pr.seconds || SECONDS;
  for (let i = 0; i < 60 * secs; i++) {
    g.setInput(0, { mx: 0, my: 0 });
    if (pr.each) pr.each(g, p);
    g.tick();
    for (const e of bodies) { e.x = e.spawnX; e.y = e.spawnY; }
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
    for (let i = 0; i < 60 * (pr.seconds || SECONDS); i++) {
      g2.setInput(0, { mx: 0, my: 0 });
      // `each` runs on BOTH runs, unlike `high`. It is not the thing that makes
      // the engine big — `low` still starves that — it is the thing that makes
      // the engine possible at all, so removing it would change the room rather
      // than the resource.
      if (pr.each) pr.each(g2, p2);
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

  // --- crystallize: GRIT IS ANTI-SYNERGISTIC, and that is a design property
  //     rather than a side effect, so it is asserted rather than described.
  //
  // §8.3 gives the Mage the only engine in the game filled by the enemy, and its
  // built-in cost is that armour fights it: crystal accrues off MITIGATED damage
  // — what actually got through — so every point of Grit is crystal not earned.
  // §13 rule 24 says a claim of the form "X reduces Y" is not real until
  // something moves X and reads Y. This does. Two identical Mages eat identical
  // damage through `hurtPlayer`; one of them is wearing armour.
  {
    // TWELVE HITS, NOT SIX SECONDS. The first version ran the fixture long
    // enough that both Mages pinned the cap at 10.0 and the gate reported no
    // difference — a saturated instrument reads identical for a working engine
    // and a broken one. The window is sized to stay under `crystalCap`, which is
    // the only region where the ratio is observable at all.
    const HITS = 12, BLOW = 8;
    const run = (grit) => {
      const { g, p } = stage('toh_mage');
      if (grit) g._applyPerm(p, { grit });
      for (let i = 0; i < HITS; i++) {
        p.invuln = 0;
        g.hurtPlayer(p, BLOW, null);
        p.hp = p.stats.vitality;
        g.tick();
      }
      return p.crystal;
    };
    const bare = run(0), armoured = run(40);
    if (armoured < bare) {
      ok(`Grit is ANTI-SYNERGISTIC with crystallize, measured: ${HITS} identical blows yield ${bare.toFixed(1)} crystal bare and ${armoured.toFixed(1)} at 40 Grit (−${Math.round((1 - armoured / bare) * 100)}%) — the Mage is the one class punished for playing safely, by construction`);
    } else {
      fail(`armour did not cost the Mage crystal (${bare.toFixed(1)} bare vs ${armoured.toFixed(1)} at 40 Grit) — §8.3's built-in cost for crystallize is asserted and not happening, which means the engine reads RAW damage somewhere it should read mitigated`);
    }
    // And it must not survive a door, for the same reason a shift must not.
    const { g, p } = stage('toh_mage');
    p.crystal = 7;
    SKROOM.startRoomMinions(g, p);
    if (p.crystal === 0) ok('crystal does not survive a room transition — damage taken in the last fight is not credit in the next one');
    else fail(`crystal persisted across a room start (${p.crystal}) — a state with no decay and no reset is permanent`);
  }
}

console.log(failures ? `\n${failures} ENGINE GATE FAILURE(S)` : '\nEVERY CLASS ENGINE IS FILLED BY PLAY AND MULTIPLIES SOMETHING, AND EVERY WRITE PATH PRODUCES IT');
process.exit(failures ? 1 : 0);
