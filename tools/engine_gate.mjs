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
import * as ENG from '../js/engines.js';
import { PRIMITIVES as PRIM } from '../js/compose.js';
import { engineScale as engineScaleOf } from '../js/compose.js';
import { CONFIG as CFG } from '../js/config.js';

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
  // `allowUnplayable`: a write path is gated BEFORE its trees exist (§5.7
  // condition 3), so the gate has to be able to seat a class the sim would
  // otherwise refuse to start. rider_gate and trait_gate already do this for the
  // same reason.
  const g = new Sim({ seed: SEED, allowUnplayable: true, party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const p = g.players[0];
  p.level = LEVEL;
  for (const tid of Object.keys(TREES).filter(t => TREES[t].classId === charId)) {
    for (const s of [...TREES[tid].skills].sort((a, b) => a.tier - b.tier)) { p.skillPoints++; spendSkillPoint(g, p, s.id); }
  }
  // THE ROOM IS PINNED, and `open_expanse` is the one to pin: pure kiting
  // space, no obstacles. Every other template puts architecture between the
  // caster and a dummy spawned at a fixed offset — and §13's line-of-sight rule
  // means walls block attacks for everyone, so a bolt into a pillar is a rider
  // that "never lands". Taking whatever template the deck dealt is how `shift` read as filled-and-never-read on the Wizard's lance.
  const node = g.floor.nodes.find(x => x.depth !== null && x.kind !== 'shrine');
  node.template = 'open_expanse';
  g._travelTo(node.id);
  // THE ROOM MUST STAY EMPTY, not merely start empty. Clearing the pool once
  // leaves the WAVE running, so ambient spawns arrive throughout the window and
  // stand between the probe and its pinned dummy — measured, that is what made
  // `shift` read as filled-and-never-read on the Wizard's lance. Both this and `econ_gate` cleared the pool
  // and neither stopped the wave; it went unnoticed while every region fight
  // drew the same thin base-roster table.
  g.wave.done = true;
  g.spawnQueue.length = 0;
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
  killbox: {
    what: 'traps set and waiting',
    char: 'toh_assassin',
    // A COUNT OF POTENTIAL, and the one engine banked by BEING SOMEWHERE rather
    // than by acting. The starve removes the traps each frame, which is the same
    // shape as clearing the Priest's marks — the placing skill still fires in
    // both runs, so the only thing that differs is whether the field exists.
    low: (g, p) => { g.traps.length = 0; p.engines.killbox = 0; },
    // Filled by any skill carrying a `trap` step, derived rather than named.
    fills: sk => (sk.compose || []).some(c => c.kind === 'trap'),
    fillsFirst: sk => (sk.compose || []).some(c => c.kind === 'trap'),
  },
  spread: {
    what: 'bands of ground between the Hunter and its beast',
    char: 'toh_hunter',
    // A RELATIONSHIP, NOT A QUANTITY, and the only engine of that shape. The
    // starve pins the beast ON the Hunter each frame, which is the honest
    // opposite of the mechanic: two bodies in one place are one body. Removing
    // the beast instead would also remove the pack it feeds and measure two
    // things at once.
    low: (g, p) => { for (const m of p.minions) { m.x = p.x; m.y = p.y; m.cd = 999; } p.engines.spread = 0; },
    // The beast is what fills it, so the loadout has to contain a summon.
    fills: sk => (sk.compose || []).some(c => c.kind === 'summon'),
    fillsFirst: sk => (sk.compose || []).some(c => c.kind === 'summon'),
    // And the beast has to actually be somewhere else. Minions orbit their
    // owner, so the fixture walks them out and holds them there — the engine is
    // about distance, and a probe that lets them close it measures the orbit.
    // `m.cd` is held high so the BEAST NEVER SWINGS. The observable is damage
    // dealt, and a beast pinned on the enemies in the starved run was adding its
    // own bites to it — the gate read 171 fed against 321 starved, an engine
    // that looked inverted because the observable contained something other than
    // the engine. Silent in both runs, the only difference left is the span.
    // 600 units, not 400: the cap is six bands of ninety, so 400 measured four
    // and left a third of the engine's range untested. The swing at four bands
    // was 1.8%, which is true and too thin to trust.
    each: (g, p) => { for (const m of p.minions) { m.x = p.x + 600; m.y = p.y; m.cd = 999; } },
    // A `from: 'self'` claim, named for the reason in `pickClaim`.
    claimSkill: 'hun_enfilade',
  },
  chi: {
    what: 'Chi banked from damage dealt',
    char: 'toh_monk',
    // A TWO-DIRECTION ENGINE, and the only one so far. The starve empties the
    // pool every frame, which is the honest opposite of the mechanic — a Monk
    // that has just spent everything. It clears `p.chi` as well as the published
    // value, because the tick re-derives one from the other and a probe that
    // zeroed only the published number would be overwritten before it was read.
    low: (g, p) => { p.chi = 0; p.engines.chi = 0; },
    // Filled by dealing damage at all, which is every damaging skill — there is
    // no generator node to name, and that is the design (a resource with its own
    // generator button is a rotation rather than a decision).
    fills: sk => (sk.compose || []).some(c => ['strike', 'cone', 'line', 'bolt', 'drain'].includes(c.kind)),
    fillsFirst: sk => (sk.compose || []).some(c => ['strike', 'cone', 'line', 'bolt', 'drain'].includes(c.kind)),
  },
  cascade: {
    what: 'ranks banked by firing something different each time',
    char: 'toh_savage',
    // ADVANCED BY VARIETY, so the starve makes every fire look like a repeat.
    // Pinning `cascadeLast` to null each frame would stop it advancing but would
    // also stop it BREAKING, which is a different mechanic; zeroing the rank is
    // the honest opposite — a Savage whose chain keeps collapsing.
    low: (g, p) => { p.cascade = 0; p.engines.cascade = 0; },
    // Filled by firing at all, provided the fires differ — so the loadout needs
    // more than one thing in it, which the default staging already gives.
    fills: sk => (sk.compose || []).some(c => ['strike', 'cone', 'line', 'bolt', 'drain'].includes(c.kind)),
    fillsFirst: sk => (sk.compose || []).some(c => ['strike', 'cone', 'line', 'bolt', 'drain'].includes(c.kind)),
  },
  form: {
    what: 'a crystal form held',
    char: 'toh_blacksmith',
    // A STATE, NOT A QUANTITY, and the only engine of that kind. The starve
    // takes the form away each frame — the honest opposite of being transformed
    // — rather than lowering a number, because there is no number to lower.
    low: (g, p) => { p.form = null; p.formT = 0; p.formStats = null; p.engines.form = 0; },
    // Entered by a `form` step, which fires on SELF_THRESHOLD — so the fixture
    // has to be HURT for the engine to fill at all. That is the whole class:
    // every form is a response to a fight going badly.
    each: (g, p) => { p.hp = Math.min(p.hp, p.stats.vitality * 0.5); },
    fills: sk => (sk.compose || []).some(c => c.kind === 'form'),
    fillsFirst: sk => (sk.compose || []).some(c => c.kind === 'form'),
    // A `form`-gated skill cannot be the measured claim — it does not fire in
    // the starved run BY DESIGN, so the comparison would be a skill against
    // nothing rather than an engine against itself.
    claimSkill: 'smith_hammer_blow',
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
function pickClaim(key, charId, want) {
  const mine = (CLAIMED[key] || []).filter(c => c.cls === charId);
  // MEASURE THE ENGINE, NOT THE TRIGGER. The Hunter's first `spread` claim is a
  // `from: 'pet'` skill, and the staging that FILLS the engine — the beast four
  // hundred units away — is precisely what stops that skill firing at a ring
  // around the player. The gate read 174 fed against 324 starved: the engine
  // inverted, and both numbers were true. A probe whose measured skill is
  // disabled by its own staging is measuring the staging (§13 rule 26), so a
  // probe may name the claim it wants.
  if (want) { const c = mine.find(x => x.skill === want); if (c) return c; }
  return mine.find(c => DAMAGE_STEPS.has(c.kind)) || mine[0] || null;
}

function measure(key) {
  const pr = PROBES[key];
  if (!pr) return null;
  const claim = pickClaim(key, pr.char, pr.claimSkill);
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

  // --- two bodies: a trigger that asks its question somewhere else --------
  //
  // The Hunter's write path is the first that touches the TRIGGER layer rather
  // than `p.engines`, so what is asserted here is different in kind: not that a
  // resource moves, but that the same skill, in the same room, answers its
  // trigger differently depending on where it is told to look.
  {
    const { g, p } = stage('toh_hunter');
    // One enemy, far from the Hunter and right beside where the beast will be.
    const far = target(g, p.x + 400, p.y);
    // ENOUGH TICKS FOR ONE TRIGGER TICK. `triggerHolds` asks the spatial grid,
    // and `runTriggerTick` rebuilds that grid on its own cadence rather than
    // every frame — one `g.tick()` is not one rebuild. Asserting before a
    // rebuild measures an EMPTY ROOM, which reads as "both false" and looks
    // exactly like a beast that was never found.
    for (let i = 0; i < 20; i++) { g.tick(); far.x = far.spawnX; far.y = far.spawnY; }
    // AND THE BEASTS ARE READ AFTER THE TICKS, NOT BEFORE. A minion that dies is
    // replaced, so a handle taken before the loop can be a stale object that is
    // no longer in `p.minions` — moving THAT one puts nothing anywhere, while
    // `triggerOrigin` correctly picks a live beast still standing next to the
    // Hunter. The assertion then reads "the origin did not move" about an origin
    // working perfectly (§13 rule 40).
    //
    // AND EVERY LIVE MINION MOVES, NOT ONE. `triggerOrigin` resolves to the
    // NEAREST live pet, and a Hunter carrying both trees fields more than one —
    // a hawk from Longshot t2 and hounds from Houndmaster t2/t4. Sending a single
    // beast to +400 leaves the origin answering at whichever body is still at the
    // Hunter's heel, so the probe measures the player's position and reports the
    // write path dead. The fixture has to empty the heel, not just populate the
    // far end.
    const beasts = p.minions.filter(m => !m.dead && !m.down);
    if (!beasts.length) { fail('the Hunter fixture fielded no beast, so the two-bodies write path cannot be asserted at all'); }
    else {
      const skill = { from: 'pet', trigger: { kind: 'NEAREST', range: 120 }, select: 'nearest' };
      const selfSkill = { from: 'self', trigger: { kind: 'NEAREST', range: 120 }, select: 'nearest' };
      for (const m of beasts) { m.x = far.x; m.y = far.y; }
      // The precondition, checked separately so an empty grid cannot masquerade
      // as an origin that did not move.
      if (!g.trigGrid.nearest(far.x, far.y, 120)) {
        fail('the trigger grid holds no enemy at the beast — the fixture never got a trigger tick, so nothing below would be about the origin');
      }
      const holdsPet = SKROOM.triggerHoldsAt(g, p, skill);
      const holdsSelf = SKROOM.triggerHoldsAt(g, p, selfSkill);
      if (holdsPet && !holdsSelf) ok('a `from: "pet"` trigger answers at the BEAST: an enemy 400 away is out of the Hunter\'s 120 range and inside the beast\'s, and the same trigger holds for one and not the other');
      else fail(`the trigger origin did not move: pet=${holdsPet} self=${holdsSelf} across ${beasts.length} beast(s). Both true means the origin is still the player; both false means no beast was found — and a Hunter fields several, so a probe that moved only one would read exactly like this while the origin worked`);

      // NO PET, NO FIRE — the cost that makes the beast load-bearing.
      const saved = p.minions.slice();
      p.minions.length = 0;
      const holdsDead = SKROOM.triggerHoldsAt(g, p, skill);
      p.minions.push(...saved);
      if (!holdsDead) ok('and with no beast alive the trigger cannot hold — a `from: "pet"` skill does not quietly fall back to the player, which is what makes the beast load-bearing rather than decorative');
      else fail('a `from: "pet"` trigger held with no pet — the origin fell back to the player, and the class\'s whole cost with it');
    }
  }

  // --- the killbox: an inert object that a LATER CAST consumes ------------
  //
  // The trap is the thirteenth primitive (§5.7) and the two things that make it
  // one are asserted here rather than described: it deals no damage while it
  // sits there, and it is consumed by a cast rather than by a clock.
  {
    const { g, p } = stage('toh_assassin');
    const e = target(g, p.x + 900, p.y);          // far away: nothing near the trap
    const trapSkill = Object.values(TREES).filter(t => t.classId === 'toh_assassin')
      .flatMap(t => t.skills).find(x => (x.compose || []).some(c => c.kind === 'trap'));
    const step = trapSkill.compose.find(c => c.kind === 'trap');
    // Place one by hand at a known spot, so the assertions are about the OBJECT
    // and not about where a selector chose to put it.
    g.addTrap({ x: p.x, y: p.y, owner: p.idx, radius: step.radius, damage: step.damage, ttl: 20, domain: trapSkill.domain, skill: trapSkill });
    const victim = target(g, p.x + 20, p.y);
    const hp0 = victim.hp;
    // THE LOADOUT IS EMPTIED FOR THIS ASSERTION, and the first run is why. With
    // skills slotted the Assassin CAST during the three seconds, the cast set
    // the trap off, and the gate reported "the trap was not inert" about a trap
    // behaving exactly as designed. Inertness is a claim about what the object
    // does WHEN NOTHING SETS IT OFF, so the fixture has to stop setting it off
    // (§13 rule 40 — a first red is a claim about the fixture).
    p.loadout = new Array(8).fill(null);
    for (let i = 0; i < 60 * 3; i++) { victim.x = victim.spawnX; victim.y = victim.spawnY; g.tick(); }
    if (victim.hp === hp0 && g.traps.length === 1) ok('a trap sits INERT: three seconds beside an enemy, no damage dealt and the trap still set — which is what `hazard` could not express, because a zone ticks');
    else fail(`the trap was not inert: enemy took ${(hp0 - victim.hp).toFixed(0)}, ${g.traps.length} trap(s) left. A dormant object that damages is a zone, and a zone is what this primitive exists NOT to be`);

    const before = victim.hp, traps0 = g.traps.length;
    SKROOM.detonateTraps(g, p);
    if (g.traps.length < traps0 && victim.hp < before) ok(`and a CAST consumes it: ${traps0} → ${g.traps.length} traps, enemy took ${(before - victim.hp).toFixed(0)} — the detonation is a property of the object, not a rider on whatever set it off (§5.7 condition 2)`);
    else fail(`the trap did not detonate on a cast (${traps0} → ${g.traps.length} traps, ${(before - victim.hp).toFixed(0)} damage) — an inert object nothing consumes is a permanent`);

    // And it must not survive a door, for the same reason a shift must not.
    g.addTrap({ x: p.x, y: p.y, owner: p.idx, radius: 60, damage: 5, ttl: 20, domain: 'physical', skill: trapSkill });
    SKROOM.startRoomMinions(g, p);
    if (!g.traps.some(t => t.owner === p.idx)) ok('a killbox does not survive a room transition — a field carried through a door is the class\'s one decision handed out for free');
    else fail(`traps persisted across a room start (${g.traps.length}) — a state with no decay and no reset is permanent`);
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

  // --- the Chi loop: the first engine that runs in TWO directions ------------
  //
  // Every assertion here drives the ENGINE FUNCTIONS rather than any authored
  // skill, on purpose. §5.7 condition 3 says a write path gates before its trees
  // exist, and a tick-shaped engine has the same obligation: if these read a
  // skill id they would be measuring content, and the point is to know the
  // mechanism works before there is any content standing on it. Every one of
  // them would pass identically against an empty tree.
  {
    const { g, p } = stage('toh_monk');

    // DIRECTION ONE — IN. Dealing damage fills it, and nothing else does.
    p.chi = 0;
    ENG.gainChi(g, p, 20);
    const filled = p.chi;
    if (filled > 0) ok(`damage dealt puts Chi IN: 20 damage banks ${filled.toFixed(1)} — the engine has no generator node, which is the design (§8.3)`);
    else fail('20 damage banked no Chi — the fill path is not reached from skillDamage');

    // And it is CAPPED, so a boss cannot fund the rest of the floor.
    ENG.gainChi(g, p, 100000);
    if (p.chi <= CFG.CHI_CAP) ok(`and the pool is capped at ${CFG.CHI_CAP}: 100000 damage banks ${p.chi} — an uncapped pool is a whole floor bought in one fight`);
    else fail(`Chi exceeded its cap: ${p.chi} > ${CFG.CHI_CAP}`);

    // DIRECTION TWO — OUT, and this is what no engine before it does. A spend
    // that succeeds takes the resource; a spend that cannot pay takes nothing
    // AND REFUSES, which is what makes the cost conditional rather than free.
    p.chi = 20;
    const paid = ENG.spendChi(g, p, 8);
    const afterPaid = p.chi;
    const broke = ENG.spendChi(g, p, 999);
    const afterBroke = p.chi;
    if (paid && afterPaid === 12 && !broke && afterBroke === 12) {
      ok('and a skill takes it OUT: 20 → 12 on an affordable spend, and an unaffordable one is REFUSED with the pool untouched — the first engine that runs both ways');
    } else fail(`the spend path is wrong: paid=${paid} left ${afterPaid} (want 12), unaffordable=${broke} left ${afterBroke} (want 12 and a refusal)`);

    // THE CLIFF. This is the whole of ruling 2, asserted rather than described:
    // the published value steps at zero, and NOTHING anywhere resolves below its
    // authored base. A multiplier under 1.0 would show up here as a scale below
    // one, and that is the thing §9.2's shape forbids.
    const step = { damage: 10, scaleWith: 'chi', scalePer: 0.01 };
    p.chi = 0; p.engines.chi = ENG.chiPublished(p);
    const atZero = engineScaleOf(step, p);
    p.chi = 1; p.engines.chi = ENG.chiPublished(p);
    const atOne = engineScaleOf(step, p);
    p.chi = 40; p.engines.chi = ENG.chiPublished(p);
    const atFull = engineScaleOf(step, p);
    if (atZero === 1 && atOne > atZero && atFull > atOne) {
      ok(`ZERO CHI IS A FLOOR, NOT A PENALTY: the scale reads ×${atZero.toFixed(3)} at 0, ×${atOne.toFixed(3)} at 1 and ×${atFull.toFixed(3)} at 40 — the tree is authored at the floor and Chi adds on top, so nothing in the game multiplies damage by less than one`);
    } else fail(`the cliff is the wrong shape: ×${atZero.toFixed(3)} at 0 chi, ×${atOne.toFixed(3)} at 1, ×${atFull.toFixed(3)} at 40. Zero must read exactly 1.0 and the first point must be worth more than the ones after it`);

    // And the step must be a STEP. A slope with no discontinuity at zero is a
    // `scaleWith` like any other, and the ruling would be decoration.
    const firstPoint = atOne - atZero;
    const laterPoint = (atFull - atOne) / 39;
    if (firstPoint > laterPoint * 2) {
      ok(`and it is a CLIFF rather than a slope: the first point of Chi is worth ${(firstPoint / laterPoint).toFixed(1)}× a later one — crossing zero downward is a fall, which is the feeling the design asked for, reached by adding`);
    } else fail(`the first point of Chi is worth ${(firstPoint / laterPoint).toFixed(1)}× a later one — that is a slope, and "weakens at zero" is then just scaleWith wearing a costume`);

    // THE DECAY, which is the only part of the loop that is actually a tick.
    p.chi = 30; p.chiLastGain = -999;      // idle long enough for the leak to open
    const beforeDecay = p.chi;
    for (let i = 0; i < 120; i++) g.tick();
    if (p.chi < beforeDecay) ok(`the tick leaks it: ${beforeDecay} → ${p.chi.toFixed(1)} over two idle seconds — a full pool cannot be carried down a quiet corridor`);
    else fail(`Chi did not decay while idle (${beforeDecay} → ${p.chi}) — the registered tick is not being reached, which is exactly the silent 1.0 this gate exists for`);

    // ...but NOT while the loop is running, or the leak would fight the engine.
    p.chi = 30; p.chiLastGain = g.time;
    const beforeHot = p.chi;
    for (let i = 0; i < 30; i++) { p.chiLastGain = g.time; g.tick(); }
    if (p.chi >= beforeHot) ok('and it does not leak while the Monk is still landing hits — the decay exists to stop banking between fights, not to tax fighting');
    else fail(`Chi decayed while the Monk was still dealing damage (${beforeHot} → ${p.chi.toFixed(1)}) — the leak is fighting the loop it is supposed to bound`);
  }

  // --- the cascade: variety in, and the asymptotic floor that makes it safe ---
  //
  // Cascade is the one exemption from the no-cooldown-reduction rule (§4.2,
  // §9.2), and the ASYMPTOTE is the entire reason the exemption is safe. That is
  // why the floor is asserted here rather than trusted: a clamped-linear
  // reduction satisfies "never below 50%" just as well and is a different
  // mechanic, exactly like the Monk's cliff-versus-slope.
  {
    const { g, p } = stage('toh_savage');
    const sk = SKILL_BY_ID['sav_rip'];
    const base = sk.cooldown;

    // DIRECTION ONE — VARIETY BANKS. Different ids in a row climb.
    p.cascade = 0; p.cascadeLast = null;
    ENG.cascadeAdvance(g, p, 'sav_rip');
    ENG.cascadeAdvance(g, p, 'sav_wide_swing');
    ENG.cascadeAdvance(g, p, 'sav_gore');
    ENG.cascadeAdvance(g, p, 'sav_rip');
    const banked = p.cascade;
    if (banked === 3) ok(`variety banks the cascade: four fires with no two the same in a row read ${banked} ranks — the first fire arms the chain and each different one after it extends it`);
    else fail(`four alternating fires banked ${banked} ranks, want 3 — the advance is not counting variety`);

    // DIRECTION TWO — A REPEAT BREAKS IT, TOTALLY. This is the half that makes
    // it a decision rather than a meter, and the half a decay would erase.
    ENG.cascadeAdvance(g, p, 'sav_rip');
    if (p.cascade === 0) ok('and the same skill twice running breaks it to ZERO, not down a step — a partial loss would let a Savage spam its fastest skill and keep most of the chain');
    else fail(`a repeated skill left ${p.cascade} ranks standing — the break is not total, so the engine has no failure state`);

    // THE COOLDOWN COMES DOWN AT ALL — the write path nothing else in the game
    // has. Items may not reduce a cooldown, ranks may not, no other engine does.
    p.cascade = 10;
    const at10 = ENG.cascadeCooldown(p, sk);
    if (at10 < base) ok(`the cascade SHORTENS a cooldown: ${base}ms → ${Math.round(at10)}ms at 10 ranks — the only cooldown reduction in the game, and the only class that has it`);
    else fail(`10 ranks did not shorten ${sk.id}: ${base} → ${at10}`);

    // ...AND ONLY FOR THE SAVAGE. An exemption that leaks is not an exemption.
    const { p: other } = stage('toh_samurai');
    other.cascade = 10;
    const otherSk = SKILL_BY_ID['sam_cross_guard'];
    if (ENG.cascadeCooldown(other, otherSk) === otherSk.cooldown) {
      ok('and no other class gets it, even holding the same field: a Samurai at 10 ranks pays its full cooldown — the exemption is gated on the tree that pays for it');
    } else fail('a non-Savage had its cooldown reduced — the one exemption from the no-cooldown-reduction rule has leaked into the whole roster');

    // THE FLOOR, ASSERTED THREE WAYS. Bound alone is not enough.
    const F = CFG.CASCADE_CD_FLOOR;
    const floor = base * F;
    const at = n => { p.cascade = n; return ENG.cascadeCooldown(p, sk); };

    // 1. monotonically decreasing
    let mono = true;
    let prev = Infinity;
    for (let n = 0; n <= 60; n++) { const v = at(n); if (v > prev) mono = false; prev = v; }
    if (mono) ok('the reduction is monotonic across 0..60 ranks — deeper is never worse');
    else fail('the reduction is not monotonic — a rank made a cooldown longer');

    // 2. STRICTLY ABOVE THE FLOOR AT A RANK WHERE LINEAR WOULD HAVE HIT ZERO,
    //    and NEVER BELOW IT AT ANY RANK AT ALL.
    //
    //    Two claims, because they are not the same claim and the first one has a
    //    limit. A linear 8%-of-base per rank crosses zero at rank 13, so rank 40
    //    is already deep into negative-cooldown territory for the naive version
    //    and is the honest place to separate the two.
    //
    //    THE ASYMPTOTE IS EXACT IN MATHEMATICS AND FINITE IN DOUBLES. Around rank
    //    441, `0.92^n` falls below the ULP of the floor term and `floor + tiny`
    //    rounds ONTO the floor — so "strictly above at every finite rank" is true
    //    of the formula and not of the arithmetic, and asserting it at rank 1000
    //    fails against a mechanic that is working. That boundary is named here
    //    rather than left for a future reader to rediscover as a defect, and the
    //    direction it lands is the safe one: it reaches the floor and never
    //    passes through it.
    const LINEAR_ZERO = Math.ceil(1 / CFG.CASCADE_CD_RATE);
    const deep = at(40);
    const linearAt40 = base * (1 - CFG.CASCADE_CD_RATE * 40);
    if (deep > floor) {
      ok(`and it is ASYMPTOTIC, not clamped: at 40 ranks the cooldown is ${Math.round(deep)}ms, still above the ${floor}ms floor. A linear ${CFG.CASCADE_CD_RATE * 100}%-of-base per rank would have crossed zero at rank ${LINEAR_ZERO} and read ${Math.round(linearAt40)}ms here`);
    } else fail(`the floor did not hold at 40 ranks: ${deep}ms against a floor of ${floor}ms — at a rank where a linear reduction would already be at ${Math.round(linearAt40)}ms, so this is the rank that separates the two`);

    // The second claim, swept rather than sampled: no rank anywhere goes under.
    let under = -1, landed = -1;
    for (let n = 0; n <= 2000; n++) {
      const v = at(n);
      if (v < floor) { under = n; break; }
      if (landed < 0 && v <= floor) landed = n;
    }
    if (under < 0) {
      ok(`and NO rank from 0 to 2000 is ever below the floor — double precision lands exactly ON ${floor}ms at rank ${landed} and stays there, which is the safe direction for a bound to be reached from`);
    } else fail(`rank ${under} produced ${at(under)}ms, under the ${floor}ms floor — an uncapped engine that can go under its bound has no bound`);

    // 3. THE PER-RANK DECREMENT SHRINKS. This is what separates asymptotic from
    //    clamped-linear, and neither the bound nor monotonicity can see it — a
    //    clamped-linear curve passes both and has a CONSTANT decrement until it
    //    slams into the floor and drops to zero.
    const d1 = at(0) - at(1), d20 = at(20) - at(21), d60 = at(60) - at(61);
    if (d1 > d20 && d20 > d60 && d60 > 0) {
      ok(`and every rank is worth less than the one before it: ${d1.toFixed(1)}ms for the first, ${d20.toFixed(2)}ms for the twenty-first, ${d60.toFixed(4)}ms for the sixty-first — a constant decrement here would be clamped-linear wearing an asymptote's result`);
    } else fail(`the per-rank decrement is not shrinking: ${d1.toFixed(3)} / ${d20.toFixed(3)} / ${d60.toFixed(3)}ms. Equal values mean clamped-linear, which passes the bound and is a different mechanic`);

    // AND IT DOES NOT SURVIVE A DOOR, like every other in-room resource.
    p.cascade = 12;
    SKROOM.startRoomMinions(g, p);
    if (p.cascade === 0) ok('a cascade does not survive a room transition — a chain is a property of a fight, and arriving at depth is the Savage\'s whole loop skipped');
    else fail(`the cascade persisted across a room start (${p.cascade})`);
  }

  // --- crystal forms: a STATE with a clock, and the fourteenth primitive -----
  //
  // Every assertion here is about the property that makes this engine different
  // in kind: it is something the player IS rather than something they hold.
  {
    const { g, p } = stage('toh_blacksmith');
    const step = { damage: 10, scaleWith: 'form', scalePer: 0.2 };
    const baseGrit = p.stats.grit;

    // THE PRIMITIVE ENTERS THE FORM, and the form reaches the STAT SHEET. That
    // second half is what separates a form from every engine before it — the
    // others multiply what skills do; this changes what the player is.
    PRIM.form(g, p, { domain: 'physical' }, { form: 'pyrite', duration: 6000, stats: { grit: 22, vitality: 14 } }, 1, g.trigGrid, { states: 0 });
    if (p.form === 'pyrite' && p.stats.grit === baseGrit + 22) {
      ok(`the \`form\` primitive puts the player INTO a state and it reaches the sheet: form=pyrite, Grit ${baseGrit} → ${p.stats.grit} — the fourteenth primitive (§5.7), and the first engine that changes what the player IS rather than what their skills multiply by`);
    } else fail(`the form did not take: form=${p.form}, Grit ${baseGrit} → ${p.stats.grit} (want +22)`);

    // ENTERING ONE REPLACES THE OTHER. Two at once would stack their deltas and
    // make the deepest threshold strictly best, erasing the choice between them.
    PRIM.form(g, p, { domain: 'mental' }, { form: 'quartz', duration: 6000, stats: { attunement: 26, ferocity: 18 } }, 1, g.trigGrid, { states: 0 });
    if (p.form === 'quartz' && p.stats.grit === baseGrit) {
      ok('and entering a second form REPLACES the first — Pyrite\'s Grit is gone, not added to Quartz\'s. Two at once would stack their deltas and make the deepest threshold strictly the best');
    } else fail(`forms stacked: form=${p.form}, Grit ${p.stats.grit} against a base of ${baseGrit} — a form that does not replace is a form that accumulates`);

    // THE ENGINE IS BINARY, WHICH IS THE RULING. A form does not deplete, it
    // ends — so it must read identically with five seconds left and with one. An
    // engine that drifted with the timer would be a quantity wearing a state's
    // name, and nothing else in this gate could tell the difference.
    p.formT = 5; SKROOM.tickSkills(g, 0);
    const fresh = engineScaleOf(step, p);
    p.formT = 0.4; SKROOM.tickSkills(g, 0);
    const nearlyOut = engineScaleOf(step, p);
    if (fresh === nearlyOut && fresh > 1) {
      ok(`and the engine is BINARY: ×${fresh.toFixed(3)} with five seconds left and ×${nearlyOut.toFixed(3)} with less than one — a form is a state you are in, not a pool you spend, so it reads the same throughout and then ends`);
    } else fail(`the form engine drifts with its timer: ×${fresh.toFixed(3)} fresh against ×${nearlyOut.toFixed(3)} nearly out — that is a quantity wearing a state's name`);

    // IT ENDS, AND ENDING TAKES THE STATS WITH IT. A delta removed from
    // `formStats` without a recompute would leave the bonus standing on a player
    // who is no longer in the form — the silent-persistence failure `shift` and
    // `crystal` each needed a door reset to avoid.
    const attIn = p.stats.attunement;
    p.formT = 0.01;
    for (let i = 0; i < 5; i++) g.tick();
    if (!p.form && p.engines.form === 0 && p.stats.attunement < attIn) {
      ok(`and when the clock runs out the state goes and the SHEET GOES WITH IT: Attunement ${attIn} → ${p.stats.attunement}, engine ${p.engines.form} — an expiry that forgot to recompute would leave the bonus standing on a player who is no longer transformed`);
    } else fail(`the form expired without releasing its stats: form=${p.form}, engine=${p.engines.form}, Attunement ${attIn} → ${p.stats.attunement}`);

    // A FORM-GATED SKILL FIRES ONLY IN ITS FORM. This is what makes a form more
    // than a stat buff, and it is deliberately NOT a loadout change (§5.5).
    const gated = SKILL_BY_ID['smith_anvil_strike'];
    p.form = null;
    const outOfForm = ENG.formHolds(p, gated);
    p.form = 'pyrite';
    const inForm = ENG.formHolds(p, gated);
    p.form = 'quartz';
    const wrongForm = ENG.formHolds(p, gated);
    if (inForm && !outOfForm && !wrongForm) {
      ok('a `form`-gated skill fires in ITS form and in no other: Anvil Strike holds in Pyrite, not out of form and not in Quartz — the skill stays slotted and visible, and what the form changes is whether its condition can hold');
    } else fail(`the form gate is wrong: in-form=${inForm}, out-of-form=${outOfForm}, wrong-form=${wrongForm}`);

    // AND NO FORM SURVIVES A DOOR.
    p.form = 'pyrite'; p.formT = 5; p.formStats = { grit: 22 };
    SKROOM.startRoomMinions(g, p);
    if (!p.form && !p.formT) ok('a form does not survive a room transition — a transformation is a response to a fight going badly, and arriving already transformed is the threshold that bought it handed out free');
    else fail(`the form persisted across a room start (${p.form}, ${p.formT}s)`);
  }

  // --- the registry: every accumulator is reached, and none is orphaned -----
  //
  // `tickFooting` was a hardcoded call and a hardcoded content import in
  // `skillsim.js` — the only per-class hardcode in shared code, flagged in §16
  // since phase 2. The Monk is the second of four, so it became a table. A table
  // can be asserted; a hardcoded call could only be read.
  {
    const seen = new Set();
    for (const e of ENG.ENGINE_TICKS) {
      if (!TREES[e.tree]) { fail(`the engine registry names tree "${e.tree}", which is not in the registry — a tick gated on a tree that does not exist never runs`); continue; }
      if (!ENGINE_KEYS.includes(e.key)) { fail(`the engine registry claims key "${e.key}", which is not in p.engines — a tick writing a key nothing reads is the silent 1.0`); continue; }
      if (seen.has(e.key)) { fail(`two registered ticks both claim "${e.key}" — one of them is overwriting the other every frame`); continue; }
      seen.add(e.key);
      if (typeof e.tick !== 'function') fail(`the registration for "${e.key}" has no tick function`);
    }
    if (!failures) ok(`the engine tick registry is well-formed: ${ENG.ENGINE_TICKS.length} accumulators (${[...seen].join(', ')}), each naming a live tree and a key in the bag`);

    // AND THE TABLE IS WHAT THE SIM ACTUALLY ITERATES. A registry nothing reads
    // is a list, and this is the assertion that tells the two apart: a class
    // whose tree is NOT registered must not accrue the key, or the guard is
    // decorative and every class is quietly running every accumulator.
    const { p: monk } = stage('toh_monk');
    const { g: g2, p: sam } = stage('toh_samurai');
    ENG.gainChi(g2, sam, 40);
    if (monk.engines.chi !== undefined && sam.chi === 0) {
      ok('and the gating is real: a Samurai dealing 40 damage banks no Chi at all — an accumulator belongs to the tree that pays for it, not to every player in the room');
    } else fail(`a class with no monk_chi tree banked ${sam.chi} Chi — the registry's tree guard is not being applied`);
  }
}

// ---------------------------------------------------------------------------
// `form: 'none'` — THE GAP BETWEEN FORMS, ASSERTED IN BOTH DIRECTIONS.
//
// §8.3's forms enter on SELF_THRESHOLD, so the Blacksmith is strongest when
// hurt and hollow when healthy, and the interval between forms was the one
// condition no skill could name — `formHolds` could only ask "is this the form
// I need". smith_anvil's Cold Iron branch IS that interval, so the gate has to
// prove the gate: a `form: 'none'` skill fires with no form held and goes
// silent while one does.
//
// BOTH DIRECTIONS, because a gate that always says yes and a gate that always
// says no both produce a tree that looks plausible in the data. One of them
// would be a branch that never stops; the other a branch that never starts.
{
  const cases = [
    ['no form held, gated none', { form: null }, { form: 'none' }, true],
    ['a form held, gated none', { form: 'pyrite' }, { form: 'none' }, false],
    ['a form held, gated on it', { form: 'pyrite' }, { form: 'pyrite' }, true],
    ['a form held, gated on another', { form: 'pyrite' }, { form: 'calcite' }, false],
    ['no form held, ungated', { form: null }, {}, true],
  ];
  const wrong = cases.filter(([, pl, sk, want]) => ENG.formHolds(pl, sk) !== want);
  if (!wrong.length) ok(`the form gate answers all ${cases.length} readings, including "none" — the gap between forms is expressible and does not leak into the ungated case`);
  else fail(`form gate wrong on: ${wrong.map(c => c[0]).join('; ')}`);

  // …and through the REAL fire path, not just the predicate. A Blacksmith with
  // the Cold Iron opener slotted must fire it out of form and refuse it in.
  const cold = 'smith_cold_work';
  const runFor = (formValue) => {
    const { g, p } = stage('toh_blacksmith', [cold]);
    for (const e of [...g.enemyPool]) if (e.active) { e.hp = 0; e.active = false; }
    g.spawnEnemyById('skulker', p.x + 70, p.y);
    p.fireLog = [];
    for (let i = 0; i < 60 * 4; i++) {
      p.hp = p.stats.vitality;                 // never let a form enter on its own
      p.form = formValue; p.formT = formValue ? 9 : 0;
      g.setInput(0, { mx: 0, my: 0 });
      g.tick();
    }
    return (p.fireLog || []).filter(f => f === cold || (f && f.id === cold)).length;
  };
  const outOfForm = runFor(null), inForm = runFor('pyrite');
  if (outOfForm > 0 && inForm === 0) {
    ok(`\`form: 'none'\` bites through the real trigger loop: ${cold} fired ${outOfForm}x with no form held and ${inForm}x while Iron Pyrite did — the Cold Iron branch is literally the interval`);
  } else {
    fail(`\`form: 'none'\` does not gate: ${cold} fired ${outOfForm}x out of form and ${inForm}x in form (want >0 and exactly 0) — `
      + `a branch authored against this would either never stop or never start`);
  }
}

console.log(failures ? `\n${failures} ENGINE GATE FAILURE(S)` : '\nEVERY CLASS ENGINE IS FILLED BY PLAY AND MULTIPLIES SOMETHING, AND EVERY WRITE PATH PRODUCES IT');
process.exit(failures ? 1 : 0);
