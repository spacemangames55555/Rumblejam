// THE RIDER GATE — does a rider a skill DECLARES actually land?
//
// §13 rule 25, made checkable. `RIDER_TABLE` declared `cone: [...IMPACT_RIDERS]`
// and `line: [...IMPACT_RIDERS]` while neither primitive ever called
// `applyImpactRiders`, so Bone Nova's knockback 300, Wrecking Ball's knockback
// and stun, Stampede's knockback, and the Banshee's and Dread Howl's
// weakenDamage were authored, validated against the table, and dropped at the
// moment of impact. Five skills across two classes, silently doing less than
// they said, for as long as the table has existed.
//
// It was found by an item gate measuring something else — `knockbackBoost` had
// no live knockback to scale — which is luck, not process. This is the process:
// every rider on every skill, staged and asserted by effect.
//
// THE GATE REJECTS; IT NEVER RANKS. It has no opinion about whether a stun of
// 800ms is the right number. It asks only whether the stun arrives.
//
// COVERAGE IS PART OF THE ASSERTION. A rider declared in content with no probe
// here is a HOLE, failed by name — the same layer-1 rule the item gate uses. A
// gate that silently skips what it cannot measure is how the original defect
// survived validation in the first place.
//
// Usage: node tools/rider_gate.mjs [--verbose]

// FixtureSim, not Sim: the harness answers its own §5.6 opening card instead
// of tripping the anti-softlock floor at every arena door. Same skill, same
// tick, no defect line — see tools/fixture_sim.mjs.
import { FixtureSim as Sim } from './fixture_sim.mjs';
import { SELECTABLE } from '../js/content/characters.js';
import { TREES, SKILL_BY_ID, TREES_BY_CLASS, ALL_SKILLS } from '../js/skills.js';
import { spendSkillPoint } from '../js/skillsim.js';
import { spawnMinions } from '../js/minions.js';
import { ENEMIES } from '../js/content/enemies.js';
import { IMPACT_RIDERS, SHAPE_RIDERS, BOLT_RIDERS } from '../js/compose.js';
import { CONFIG } from '../js/config.js';

const VERBOSE = process.argv.includes('--verbose');
let failures = 0;
const fail = m => { failures++; console.error(`✗ ${m}`); };
const ok = m => console.log(`✓ ${m}`);

const SEED = 4711;
const RANK = 6;              // high enough that a scaled rider is unmistakable
const DUMMY_ID = ENEMIES[0].id;
const SECONDS = 6;

// A skill staged ALONE. The loadout holds exactly the skill under test, because
// a rider landing is only attributable if nothing else in the loadout could
// have landed it — §13 rule 20's other half: the fixture must also not contain
// what it is not measuring.
// SOME WRITE PATHS BELONG TO A TRAIT, NOT TO A SKILL, and then the class in the
// chair decides the result. `doll` writes `p.voodooId`, which only `voodoo_link`
// reads — so a synthetic doll hosted on a Wizard skill designates an enemy that
// nothing will ever mirror into, and the gate reported DROPPED about a rider
// that works. That is §13 rule 26 again: the probe staged the wrong
// precondition, and it failed in the direction that looks like a finding.
//
// `charOverride` puts the right class in the chair. The class it names has no
// trees of its own yet — which is the entire reason the write path is being
// gated BEFORE its trees are authored (§5.7 condition 3) — so the host's tree is
// lent to it for the fixture and taken back afterwards.
function stage(skillId, twoPlayer = false, charOverride = null) {
  const sk = SKILL_BY_ID[skillId];
  const tree = Object.values(TREES).find(t => t.skills.some(s => s.id === skillId));
  const charId = charOverride || tree.classId;
  const lent = charOverride && !(TREES_BY_CLASS[charOverride] || []).includes(tree.id);
  if (lent) TREES_BY_CLASS[charOverride] = [...(TREES_BY_CLASS[charOverride] || []), tree.id];
  const party = [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }];
  if (twoPlayer) party.push({ idx: 1, key: 'k2', name: 'Q', charId, color: '#0ff' });
  const g = new Sim({ seed: SEED, party, allowUnplayable: true });
  const p = g.players[0];
  p.level = 40;
  // Learn the prerequisite chain, then rank the subject up.
  const chain = [];
  let cur = sk;
  while (cur) { chain.unshift(cur); cur = tree.skills.find(s => s.id === cur.prereq); }
  for (const s of chain) { p.skillPoints++; spendSkillPoint(g, p, s.id); }
  for (let i = 1; i < RANK; i++) { p.skillPoints++; spendSkillPoint(g, p, skillId); }
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);
  for (const e of [...g.enemyPool]) if (e.active) { e.hp = 0; e.active = false; }
  p.loadout = new Array(8).fill(null);
  p.loadout[0] = skillId;
  p.hp = p.stats.vitality;
  if (lent) TREES_BY_CLASS[charOverride] = TREES_BY_CLASS[charOverride].filter(x => x !== tree.id);
  return { g, p, sk };
}

// SOME RIDERS ARE ONLY EXERCISABLE IN PAIRS. The synthetic probe adds one rider
// at a time, which is right for every rider that stands alone and wrong for a
// payout: `sluice` cashes drench stacks, so hosted by itself it finds an empty
// counter and reads DROPPED about a rider that works. `SYNTH_WITH` names the
// companions a rider needs on the same step. The rider under test is still the
// only one being ASSERTED — the companion is staging, not the claim.
const SYNTH_WITH = { sluice: ['drench'] };

// Riders whose write path is owned by a TRAIT rather than by the skill. The
// synthetic probe has to put that trait in the chair or it measures nothing.
const SYNTH_HOST_CLASS = { doll: 'toh_witch_doctor' };

function target(g, x, y) {
  const e = g.spawnEnemyById(DUMMY_ID, x, y);
  if (!e) return null;
  e.maxHp = e.hp = 1e9; e.speed = 0; e.spawnX = x; e.spawnY = y;
  return e;
}

// THE FIXTURE MUST SATISFY THE TRIGGER UNDER TEST, and the triggers in this
// game want opposite rooms. A crowd of six full-HP dummies satisfies PROXIMITY
// and NEAREST and DEFEATS ISOLATED — which is `countWithin < count` — while
// never dipping under a TARGET_THRESHOLD and never letting the player dodge.
// The gate's first run reported twelve riders DROPPED on that one room; ten of
// them were this. Staging is per-trigger, and `arm` runs each tick for the
// triggers that need an event rather than a shape.
function stageFor(g, p, sk) {
  const t = sk.trigger;
  const es = [];
  // A `form`-GATED SKILL IS A PAIR (§13 rule 41), the same shape as the
  // Sundian's sluice needing drench and the Hunter's `from: 'pet'` needing a
  // beast. `smith_anvil_strike` declares `knockback` and fires only in Iron
  // Pyrite; staged out of form it never fires, and the gate reported a working
  // rider DROPPED. The form is entered with the stats the authoring step gives
  // it, so the fixture is the state the skill is actually played in.
  // `form: 'none'` IS THE OPPOSITE STAGING, and the naive read of this block
  // gets it exactly backwards. `sk.form` used to mean "enter this form"; smith
  // _anvil's Cold Iron branch declares 'none', meaning it fires only while NO
  // form holds — so entering one here made three working skills read as dead
  // triggers. The staging has to answer the declaration rather than assume its
  // shape.
  if (sk.form === 'none') {
    p.form = null; p.formT = 0; p.formStats = null;
    if (p.engines) p.engines.form = 0;
  } else if (sk.form) {
    const src = ALL_SKILLS.find(x => (x.compose || []).some(c => c.kind === 'form' && c.form === sk.form));
    const step = src && src.compose.find(c => c.kind === 'form');
    p.form = sk.form;
    p.formT = 60;
    p.formStats = step ? step.stats || null : null;
    p.engines.form = CONFIG.FORM_POWER;
    g._recomputeStats(p);
  }
  const put = (n, r) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const e = target(g, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      if (e) es.push(e);
    }
  };
  let arm = null;
  switch (t.kind) {
    case 'ISOLATED':
      // "fewer than count within radius". One body, and it stands outside the
      // isolation radius so the trigger holds while the compose step still has
      // something to hit.
      put(1, Math.max((t.radius || 200) + 60, 140));
      break;
    case 'TARGET_THRESHOLD':
      // A target under `pct` of its max HP, which a 1e9-HP dummy never is.
      put(3, 60);
      for (const e of es) { e.maxHp = 1000; e.hp = 1000 * Math.max(0.05, (t.pct / 100) * 0.5); }
      break;
    case 'ON_DODGE':
      // A REFLEX DODGE IS DELIBERATELY NOT AN `ON_DODGE` (§6.5). Reflex avoiding
      // a hit with a dice roll is a defensive stat paying out; ON_DODGE means
      // the player physically left a telegraphed zone, and `telegraphs.js` is
      // the only thing that arms it. The gate's first attempt raised Reflex and
      // hit the player until a dodge landed, which armed nothing and reported
      // two working riders dead — a probe staging the wrong event is a probe
      // measuring a different game.
      //
      // The event is staged directly, the way ON_KILL's counter is. The
      // telegraph-to-dodge path itself is `telegraph_test`'s and
      // `footing_grace_test`'s job; duplicating it here would be a second
      // definition waiting to drift.
      put(3, 60);
      arm = () => { p.trigEvents.dodgeT = g.time; };
      break;
    case 'ON_KILL':
      put(4, 60);
      arm = () => { p.trigEvents.kill++; };
      break;
    case 'ON_HIT_TAKEN':
      put(4, 60);
      arm = () => { p.invuln = 0; p.hp = p.stats.vitality; g.hurtPlayer(p, 1, null, { shared: true }); };
      break;
    case 'SELF_THRESHOLD':
      put(4, 60);
      arm = () => { p.hp = Math.max(1, p.stats.vitality * 0.05); };
      break;
    case 'ON_TOKEN':
      put(4, 60);
      arm = () => { if (es[0]) g.dropToken(es[0].x, es[0].y); };
      break;
    default:
      put(6, 55);        // PROXIMITY, NEAREST, ON_STATUS, MOVEMENT
  }
  return { es, arm };
}

// Each observer answers one question: after firing, does the rider's effect
// exist anywhere in the room? `peak` is taken across the whole run rather than
// sampled at the end, because a 400ms stun on a 6-second window is gone long
// before the last tick.
const OBSERVERS = {
  stun:          { what: 'an enemy is stunned',            peak: es => Math.max(0, ...es.map(e => e.stunT || 0)) },
  root:          { what: 'an enemy is rooted',             peak: es => Math.max(0, ...es.map(e => e.rootT || 0)) },
  taunt:         { what: 'an enemy is taunted',            peak: es => Math.max(0, ...es.map(e => e.tauntT || 0)) },
  slow:          { what: 'an enemy is chilled',            peak: es => Math.max(0, ...es.map(e => 1 - (e.slowMult ?? 1))) },
  weakenDamage:  { what: 'an enemy deals less damage',     peak: es => Math.max(0, ...es.map(e => e.weakDmgT || 0)) },
  weakenDefense: { what: 'an enemy takes more damage',     peak: es => Math.max(0, ...es.map(e => e.defDownT || 0)) },
  defenseDown:   { what: 'an enemy takes more damage',     peak: es => Math.max(0, ...es.map(e => e.defDownT || 0)) },
  // `impactDot` routes through `applyPlague`, not `_applyBurn`. Watching
  // `burnDps` reported two working riders dead — a probe reading the wrong field
  // is indistinguishable from a rider that never fired, which is why an observer
  // names the mechanism and not the flavour.
  impactDot:     { what: 'an enemy is plagued',            peak: es => Math.max(0, ...es.map(e => e.plagueDps || 0)) },
  // Displacement alone is NOT evidence: bodies packed around a player separate
  // by collision, and every knockback row would have passed on that drift with
  // the rider deleted. Measured against the same skill stripped of the rider.
  knockback:     { what: 'an enemy is pushed further than collision alone',
                   displacement: true, stripped: true },
  splash:        { what: 'a bystander takes damage',       bystander: true },
  // THE JUDGMENT MARK IS TWO CLAIMS, and the second is the one that matters.
  // "An enemy carries a mark" is a flag; "the mark detonates on death and heals
  // nearby allies" is the mechanic. Watching only the flag would be the trap
  // this gate exists to avoid, so the observer is the ALLY'S HP after the marked
  // enemy dies — the mark's whole purpose, measured where it lands.
  mark:          { what: 'an ally is healed when the marked enemy dies', markHeal: true },
  healPerHit:    { what: 'the player heals on hit',        player: (g, p) => p.hp, hurtSelf: true },
  // §5.7's newest write path. The observable is TOTAL LIVE PACK HP: `mend`
  // heals every standing minion, so a pack staged below full and left alone is
  // measurably higher with the rider than without it. Staged hurt ONCE rather
  // than re-soaked every tick the way `drench` is — re-applying the damage
  // would undo exactly the effect being measured.
  mend:          { what: "the caster's live pack heals", needsHurtPack: true,
                   player: (g, p) => (p.minions || []).reduce((a, m) => a + (m.dead ? 0 : m.hp), 0) },
  pierce:        { what: 'total damage across three targets in a line', pierceLine: true },
  // THE DOLL IS TWO CLAIMS, and this gate can only honestly measure one of them.
  // "An enemy is designated" is a flag; "the mirror then pays into the one the
  // player chose rather than the one that happened to be nearest" is the
  // mechanic — and that needs a room with a near enemy and a far one, which this
  // gate's ring fixture is not. The distinguishing assertion therefore lives in
  // `engine_gate`'s write-path section beside the `shift` triangle, where the
  // staging can be built for it. What is measured HERE is that the rider fires
  // and the engine it feeds comes off zero.
  doll:          { what: 'the doll bank fills for the designated enemy', player: (g, p) => p.engines.doll },
  // DRENCH IS MEASURED AS THE COUNTER STANDING, which is what the engine reads
  // and what the payout spends.
  drench:        { what: 'drench stacks stand on an enemy', peak: es => Math.max(0, ...es.map(e => e.drench || 0)) },
  // AND SLUICE IS MEASURED AS DAMAGE THE STEP DID NOT DECLARE. The burst is
  // extra damage on top of the step's own magnitude, so the observable is total
  // damage against the same skill with the rider stripped — watching `e.drench`
  // fall to zero would pass on the decay timer alone.
  sluice:        { what: 'a drenched enemy takes burst damage the step never declared', stripped: true, needsDrench: true },
  // multiPulse and windUp are SHAPE riders read inside the primitive rather than
  // applied to an enemy: multiPulse repeats the hit loop, windUp defers the step
  // by a timer. Both are measured as damage against the same skill with the
  // rider stripped, which is the only observable they have.
  multiPulse:    { what: 'the step lands more damage than without it', stripped: true },
  windUp:        { what: 'the step is delayed before it lands',        stripped: true, timing: true },
};

// Fire the staged skill for `SECONDS`, tracking the peak of whatever the
// observer watches.
function run(skillId, obs, strip = null, add = null, charOverride = null) {
  const { g, p, sk } = stage(skillId, !!obs.markHeal, charOverride);
  if (add) {
    const clone = { ...sk, compose: sk.compose.map(c => ({ ...c, riders: { ...(c.riders || {}) } })) };
    for (const c of clone.compose) {
      if (!['strike', 'cone', 'line', 'bolt'].includes(c.kind)) continue;
      for (const companion of SYNTH_WITH[add.rider] || []) c.riders[companion] = SYNTH_PAYLOAD[companion];
      c.riders[add.rider] = add.payload;
    }
    SKILL_BY_ID[skillId] = clone;
    for (const t of Object.values(TREES)) {
      const i = t.skills.findIndex(x => x.id === skillId);
      if (i >= 0) t.skills[i] = clone;
    }
  }
  if (strip) {
    // A per-run copy of the step with one rider removed. The registry object is
    // never mutated — a gate that edited live content would poison every test
    // that ran after it.
    const clone = { ...sk, compose: sk.compose.map(c => ({ ...c, riders: { ...(c.riders || {}) } })) };
    for (const c of clone.compose) delete c.riders[strip];
    SKILL_BY_ID[skillId] = clone;
    for (const t of Object.values(TREES)) {
      const i = t.skills.findIndex(s => s.id === skillId);
      if (i >= 0) t.skills[i] = clone;
    }
  }
  const { es, arm } = stageFor(g, p, sk);
  if (!es.length) return NaN;
  // The mark's observable is an ALLY'S HP after the marked enemy dies, so the
  // ally is placed in reach and hurt first — a heal on a full-HP player moves
  // nothing and would read as a mark that never detonated.
  // `healPerHit` heals the caster, and a heal on a full-HP player moves nothing.
  if (obs.hurtSelf) p.hp = Math.max(1, Math.round(p.stats.vitality * 0.25));
  // A PACK TO MEND. The synthetic host is somebody else's strike skill, so the
  // caster has no minions of its own — one is borrowed from whichever tree
  // declares a summon step, exactly as skill_sweep lends the Hunter its beast.
  if (obs.needsHurtPack) {
    const src = ALL_SKILLS.find(x => (x.compose || []).some(c => c.kind === 'summon'));
    const step = src && src.compose.find(c => c.kind === 'summon');
    if (step) {
      spawnMinions(g, p, src, step, 2);
      for (const m of p.minions || []) m.hp = Math.max(1, Math.round(m.maxHp * 0.4));
    }
  }
  // A PAYOUT NEEDS SOMETHING TO PAY OUT. `sluice` cashes drench stacks and
  // clears them, so a skill staged ALONE — which is this gate's whole idiom,
  // because a rider landing is only attributable when nothing else could have
  // landed it — finds an empty counter and reads DROPPED about a rider that
  // works. The counter is therefore pre-staged ON THE TARGETS rather than by
  // slotting a second skill: the burst stays attributable to the measured skill,
  // and the fixture only supplies the precondition (§13 rule 26).
  //
  // It is re-applied every tick because the rider spends what it finds, and a
  // one-shot soak would measure the first cast and nothing after it.
  if (obs.needsDrench) {
    for (const e of es) { e.drench = 8; e.drenchT = 9; e.drenchBy = p.idx; }
  }
  // `pierce` needs bodies BEHIND the first one: a projectile that stops at the
  // first target is exactly what pierce changes, so the observable has to
  // contain something the first body was shielding.
  const line = obs.pierceLine ? [target(g, p.x + 90, p.y), target(g, p.x + 150, p.y), target(g, p.x + 210, p.y)] : null;
  const lineHp0 = line ? line.reduce((a, e) => a + (e ? e.hp : 0), 0) : 0;
  const ally = obs.markHeal ? g.players[1] : null;
  // THE OBSERVER MUST SURVIVE THE OBSERVATION. The ally stands inside the ring
  // the marks are being placed on, takes contact damage for the whole run, and
  // goes down — and `_heal` returns immediately for a downed player, so the
  // detonation paid out to nobody and five working skills read DROPPED. Its HP
  // is held at 30% through the run and released just before the kills, so the
  // number measured is the mark's and not the room's.
  if (ally) { ally.x = p.x + 40; ally.y = p.y; }
  const holdAlly = () => {
    if (!ally) return;
    ally.x = p.x + 40; ally.y = p.y;
    ally.downed = false;
    ally.hp = Math.max(1, Math.round(ally.stats.vitality * 0.3));
  };
  holdAlly();
  const allyHp0 = ally ? ally.hp : 0;
  const from = es.map(e => ({ x: e.x, y: e.y }));
  const bystander = obs.bystander ? target(g, p.x + 120, p.y) : null;
  let peak = 0, firstDamageT = -1;
  const hp0 = es.reduce((a, e) => a + e.hp, 0);
  for (let i = 0; i < 60 * SECONDS; i++) {
    // A MOVEMENT/`moving` skill has to be WALKED or it never fires, and a
    // rider on a skill that never fires reads as a rider that never LANDS —
    // which is the same sentence this gate prints for a genuinely broken
    // rider. Alternating direction keeps the player inside the ring of
    // dummies, so this stays a rider check rather than a pathing one.
    const tg = (SKILL_BY_ID[skillId] || {}).trigger || {};
    const mv = tg.kind === 'MOVEMENT' && tg.mode !== 'still';
    g.setInput(0, mv ? { mx: (i % 2 ? 1 : -1), my: 0 } : { mx: 0, my: 0 });
    if (tg.kind === 'MOVEMENT' && tg.mode === 'still') p.stillT = tg.seconds + 1;
    if (arm) arm();
    // Re-soak: the rider under test SPENDS the counter, so it has to be there
    // for every cast and not just the first.
    if (obs.needsDrench) for (const e of es) { e.drench = 8; e.drenchT = 9; e.drenchBy = p.idx; }
    g.tick();
    if (obs.peak) peak = Math.max(peak, obs.peak(es));
    if (firstDamageT < 0 && es.reduce((a, e) => a + e.hp, 0) < hp0) firstDamageT = i;
    if (!obs.displacement) for (const e of es) { e.x = e.spawnX; e.y = e.spawnY; e.knockX = 0; e.knockY = 0; }
    if (line) for (const e of line) if (e) { e.x = e.spawnX; e.y = e.spawnY; }
    holdAlly();
  }
  if (obs.displacement) peak = es.reduce((a, e, i) => a + Math.hypot(e.x - from[i].x, e.y - from[i].y), 0);
  if (obs.bystander) peak = bystander ? Math.round(1e9 - bystander.hp) : NaN;
  if (obs.player) peak = obs.player(g, p);
  if (obs.pierceLine) peak = Math.round(lineHp0 - line.reduce((a, e) => a + (e ? e.hp : 0), 0));
  if (obs.markHeal) {
    // Kill the marked enemies through the real path and read what the ally got.
    for (const e of es) if (e.active) g.damageEnemy(e, 1e13, { owner: p });
    peak = Math.round((ally ? ally.hp : 0) - allyHp0);
  }
  if (obs.stripped && !obs.displacement) peak = obs.timing ? firstDamageT : Math.round(hp0 - es.reduce((a, e) => a + e.hp, 0));
  if (strip || add) { SKILL_BY_ID[skillId] = sk; for (const t of Object.values(TREES)) { const i = t.skills.findIndex(s => s.id === skillId); if (i >= 0) t.skills[i] = sk; } }
  return peak;
}

// ------------------------------------------------------------------ the sweep

const CASES = [];
for (const t of Object.values(TREES)) {
  for (const s of t.skills) {
    for (const c of s.compose || []) {
      for (const r of Object.keys(c.riders || {})) CASES.push({ skill: s.id, kind: c.kind, rider: r, cls: t.classId });
    }
  }
}

// A RIDER NO CONTENT DECLARES YET IS STILL A RIDER THE ENGINE PROMISES.
//
// The gate walked authored content only, so a rider added to `IMPACT_RIDERS`
// ahead of the tree that will use it went untested — which is exactly the
// window a write path lives in: the Priest's `mark` exists before the Priest's
// trees, on purpose, because §5.7 says the write path is ruled and proven
// BEFORE the tree is authored against it.
//
// So an unclaimed rider is probed on a SYNTHETIC skill: a real one of a
// compatible primitive, cloned with the rider added. Same machinery the
// `stripped` observers already use in reverse, and the registry is restored
// afterwards — a gate that left a mutated skill behind would poison every test
// that ran after it.
const DECLARED = new Set(CASES.map(c => c.rider));
const ALL_RIDERS = [...new Set([...IMPACT_RIDERS, ...SHAPE_RIDERS, ...BOLT_RIDERS])];
const SYNTH_PAYLOAD = {
  mark: { dur: 8000, heal: 25, radius: 300 },
  // Two more the coverage layer turned up the moment it started asking: both
  // have been in the rider tables since phase 1 with no skill declaring either.
  // `pierce` is §5.9's answer to escorted targets and reaches the game only
  // through a §9.2 magnitude ITEM today; `healPerHit` has simply never been
  // authored. Neither is a defect — a rider the engine offers and content has
  // not taken up yet is a capability, not a corpse — but an unexercised one is
  // how the cone/line gap survived three patches.
  pierce: 6,
  healPerHit: 25,
  // The Witch Doctor's designation. A truthy payload is all it needs — the
  // rider names an enemy, it does not carry a magnitude.
  doll: true,
  // The Sundian's pair. `drench` puts the counter on, `sluice` cashes it — and
  // they are probed together because a counter with no payout is a number and a
  // payout with no counter is a multiplier. The synthetic host carries BOTH, so
  // the observable below sees the burst that only exists when both landed.
  // `mend` heals the pack per landing hit; 9 is large enough to read against a
  // pack staged at 40% and small enough not to top them off in one landing.
  mend: 9,
  drench: { stacks: 3, cap: 12, dur: 9000 },
  sluice: { per: 9, radius: 30 },
};
const UNCLAIMED = ALL_RIDERS.filter(r => !DECLARED.has(r));

console.log(`rider gate — ${CASES.length} declared riders across ${new Set(CASES.map(c => c.skill)).size} skills, plus ${UNCLAIMED.length} declared by the engine and not yet by content\n`);
if (UNCLAIMED.length) {
  const noPayload = UNCLAIMED.filter(r => !SYNTH_PAYLOAD[r]);
  if (!noPayload.length) ok(`${UNCLAIMED.join(', ')} — in the rider tables with no content using them yet, each probed on a synthetic skill so the write path is proven before a tree is authored against it (§5.7)`);
  else fail(`${noPayload.join(', ')} are in the rider tables with no content and no synthetic payload — a rider the engine promises and the gate cannot exercise`);
}

const holes = [...new Set(CASES.filter(c => !OBSERVERS[c.rider]).map(c => c.rider))];
if (!holes.length) ok(`every rider kind declared in content has an observer — the gate has no blind spot to hide in`);
else fail(`${holes.length} rider kind(s) have NO OBSERVER (${holes.join(', ')}) — a declared capability with no gate is how five skills went three patches doing less than they said`);

const rows = [];
for (const u of UNCLAIMED) {
  if (SYNTH_PAYLOAD[u]) CASES.push({ skill: null, kind: 'synthetic', rider: u, cls: '(engine)', synth: true });
}
for (const c of CASES) {
  const obs = OBSERVERS[c.rider];
  if (!obs) continue;
  let got = NaN, without = null, err = null;
  try {
    if (c.synth) {
      // A real strike skill of a class that has one, cloned with the rider on.
      // The host primitive follows the rider's own table: a BOLT rider needs a
      // projectile to ride, and hanging one on a strike would test nothing.
      const wantKind = BOLT_RIDERS.includes(c.rider) ? 'bolt' : 'strike';
      const host = Object.values(TREES).flatMap(t => t.skills)
        .find(x => (x.compose || []).some(y => y.kind === wantKind) && x.trigger.kind === 'PROXIMITY')
        || Object.values(TREES).flatMap(t => t.skills).find(x => (x.compose || []).some(y => y.kind === wantKind));
      if (!host) throw new Error(`no ${wantKind} skill to host a synthetic ${c.rider} on`);
      c.skill = host.id;
      got = run(host.id, obs, null, { rider: c.rider, payload: SYNTH_PAYLOAD[c.rider] }, SYNTH_HOST_CLASS[c.rider] || null);
      without = run(host.id, obs, null, null);
    } else {
      got = run(c.skill, obs);
      if (obs.stripped) without = run(c.skill, obs, c.rider);
    }
  } catch (e) { err = e; }
  const lands = (obs.stripped || c.synth)
    ? Number.isFinite(got) && Number.isFinite(without) && got !== without
    : Number.isFinite(got) && got > 0;
  rows.push({ ...c, obs, got, without, err, lands });
  if (VERBOSE) console.log(`    ${c.skill}/${c.kind}/${c.rider}: ${got}${without !== null ? ` (without: ${without})` : ''}${err ? ' ERR ' + err.message : ''}`);
}

console.log('\n  skill                  primitive  rider           verdict   observable');
console.log('  -----                  ---------  -----           -------   ----------');
for (const r of rows) {
  const v = r.err ? 'BROKEN' : (r.lands ? 'lands' : 'DROPPED');
  console.log(`  ${r.skill.padEnd(22)} ${r.kind.padEnd(10)} ${r.rider.padEnd(15)} ${v.padEnd(9)} ${r.obs.what}`);
}
console.log('');

for (const r of rows) {
  if (r.err) { fail(`${r.skill}/${r.rider}: probe could not run (${r.err.message}) — a probe that cannot measure is not a pass`); continue; }
  if (!r.lands) fail(`${r.skill} declares \`${r.rider}\` on a \`${r.kind}\` and it NEVER LANDS — the skill does less than it says, and the rider table validated it anyway`);
}

const landed = rows.filter(r => r.lands).length;
if (landed === rows.length) ok(`every declared rider lands: ${landed}/${rows.length} across ${new Set(rows.map(r => r.cls)).size} classes`);

console.log(failures ? `\n${failures} RIDER GATE FAILURE(S)` : '\nEVERY RIDER A SKILL DECLARES ARRIVES');
process.exit(failures ? 1 : 0);
