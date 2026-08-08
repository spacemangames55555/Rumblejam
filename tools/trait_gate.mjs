// TRAIT GATE — every character trait must be reachable from the live path and
// produce an observable.
//
// WHY THIS FILE EXISTS. D-28: `tohHitDamage` and `tohOnHit` were called from
// `_fireWeapon` and nothing else, and `_fireWeapon` has not run since weapons
// were removed. Four traits went dead with them — including all three of the
// Samurai's stances, on a class the project had shipped as BUILT and balanced.
// Nothing noticed for an entire era, because every check the project had asks
// whether a function EXISTS. Each of those hooks existed, was exported, was
// imported, and was referenced in `game.js`. What it did not have was a caller
// that still runs.
//
// So the shape here is stat_gate's and engine_gate's, applied to traits:
//
//   1. COVERAGE — every trait key on the roster has a probe. A trait with no
//      probe fails by name rather than being quietly skipped.
//   2. REACHED  — staged in the situation the trait is FOR, does its observable
//      move at all?
//   3. EFFECT   — measured against a control that is identical except that the
//      trait is switched off. "It moved" is not evidence on its own; a Savage's
//      Heat and a room full of dummies both raise damage dealt.
//
// THE CONTROL IS THE TRAIT KEY ITSELF. Every branch in `traits-toh.js` is
// guarded by `t.key === '<name>'`, so a probe run with the key swapped for a
// sentinel is the same character, the same tree, the same room and the same
// seed, with exactly one thing removed. That is the cleanest starve this
// codebase offers, and it needs no per-trait teardown.
//
// FIXTURES LEND TREES. Eight of the fourteen classes have no skill tree yet, and
// a class that cannot attack cannot exercise a trait that keys off attacking.
// The gate lends one — the trait is what is under test, not the content — which
// is the same thing `rider_gate` does for a write path gated before its trees.
// §13 rule 26: a probe that stages the wrong precondition measures the staging.

import { Sim } from '../js/game.js';
import { ALL_CHARS } from '../js/content/characters.js';
import { TREES, TREES_BY_CLASS } from '../js/skills.js';
import { spendSkillPoint, learnableSkills } from '../js/skillsim.js';
import * as SKROOM from '../js/skillsim.js';
import { tohSwapStance } from '../js/traits-toh.js';
import { ENEMIES } from '../js/content/enemies.js';

let failures = 0;
const fail = m => { failures++; console.error(`✗ ${m}`); };
const ok = m => console.log(`✓ ${m}`);

const SEED = 8123;
const DUMMY = ENEMIES[0].id;
const LEND = 'necro_dark_matter';        // a plain damage tree any class can hold
const SECONDS = 12;

// ---------------------------------------------------------------- the fixture

function stage(charId, { lend = true, lendTree = LEND } = {}) {
  const lent = lend && !(TREES_BY_CLASS[charId] || []).includes(lendTree);
  if (lent) TREES_BY_CLASS[charId] = [...(TREES_BY_CLASS[charId] || []), lendTree];
  const g = new Sim({ seed: SEED, allowUnplayable: true, party: [{ idx: 0, key: 'k', name: 'T', charId, color: '#fff' }] });
  const p = g.players[0];
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  node.kind = 'combat';
  g._travelTo(node.id);
  for (const e of [...g.enemyPool]) if (e.active) { e.hp = 0; e.active = false; }
  // §13 rule 20: arrive the way a player arrives — levelled, tree spent, slots
  // filled. A bot that never attacks cannot exercise a trait that observes
  // attacks, which is exactly how D-28 stayed invisible.
  // LEVEL 20, not 12. Twelve gives three loadout slots, and a summoner with
  // three slots may never carry a summon skill at all — measured, the
  // Necromancer learned ten skills and fielded zero minions, which reads as
  // "bone dust is dead" about a trait that repairs minions. Twenty is the level
  // `measureDps` uses for the same reason.
  p.level = Math.max(p.level, 20);
  // A LENT TREE MUST BE SPENT FIRST, or a class that already has trees never
  // reaches it. Measured: with `druid_beasts` lent, the Necromancer spent all
  // sixty points climbing its own three trees and learned ZERO summon skills,
  // so the fixture had no minions and the gate reported bone dust dead. The
  // Hunter, which has no trees of its own, fielded three beasts from the same
  // loan. The tree is lent because the trait needs what it provides; spending it
  // last is the same as not lending it.
  const lentFirst = (a, b2) => {
    const ka = lent && a.tree === lendTree ? 0 : 1, kb = lent && b2.tree === lendTree ? 0 : 1;
    return ka !== kb ? ka - kb : b2.tier - a.tier;
  };
  for (let i = 0; i < 60; i++) {
    const l = learnableSkills(p);
    if (!l.length) break;
    p.skillPoints++;
    spendSkillPoint(g, p, l.sort(lentFirst)[0].id);
  }
  // AND A SUMMONER ARRIVES WITH ITS PACK. `_travelTo` runs before the points are
  // spent, so the room started with no summon skills learned and the fixture had
  // no minions at all — which reads as "bone dust is dead" about a trait that
  // repairs minions. §8.5 row 5 gives `startRoomMinions` exactly this job; the
  // fixture just has to call it after the tree exists.
  SKROOM.startRoomMinions(g, p);
  p.hp = p.stats.vitality;
  if (lent) TREES_BY_CLASS[charId] = TREES_BY_CLASS[charId].filter(x => x !== lendTree);
  return { g, p };
}

function ring(g, p, n = 5, r = 70, { immortal = true } = {}) {
  const es = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const e = g.spawnEnemyById(DUMMY, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    if (!e) continue;
    if (immortal) { e.maxHp = e.hp = 1e9; }
    e.speed = 0; e.spawnX = e.x; e.spawnY = e.y;
    es.push(e);
  }
  return es;
}

// Hurt the player through the live path, then restore. Several traits observe
// damage TAKEN, and this fixture's dummies are inert by construction.
const bleed = (amount = 8) => (g, p) => { p.invuln = 0; g.hurtPlayer(p, amount, null); p.hp = p.stats.vitality; };

// ---------------------------------------------------------------- the probes
//
// `what`     — the effect in words, named for the mechanism and not the flavour
// `stage`    — once, before the run
// `each`     — every tick, on BOTH the live and control runs (see engine_gate)
// `observe`  — the number the trait is supposed to move
// `enemies`  — how many bodies the room needs (0 = none)
// `mortal`   — dummies can die (traits that key off kills)
const PROBES = {
  crystal_infusion: {
    what: 'enemies touching the Blacksmith take contact damage',
    enemies: 3, mortal: true, r: 26,
    observe: (g, p, es) => es.reduce((a, e) => a + (e.maxHp - e.hp), 0),
  },
  decree: {
    what: 'the Wizard\'s decree fires on its own timer and damages the room',
    enemies: 4, mortal: true,
    // Decree is the ONE trait that needs no tree: it is a tick, not a reaction.
    lend: false,
    observe: (g, p, es) => es.reduce((a, e) => a + (e.maxHp - e.hp), 0),
  },
  bonelord: {
    what: 'a dying enemy repairs the Necromancer\'s most-hurt summon',
    // THE PRECONDITION IS "OWNS A HURT UNIT", AND WHERE IT CAME FROM IS NOT THE
    // TRAIT'S BUSINESS. The Necromancer's own skeletons arrive through the token
    // loop — a kill drops a token, `ON_TOKEN` raises into it — which this
    // fixture would have to reproduce before the trait under test could run at
    // all. Measured, the Necromancer learned ten skills and fielded zero
    // minions, and the gate said "bone dust is dead" about a working trait. So
    // the pack is lent, the same way the Hunter's is: bone dust repairs the
    // most-hurt unit its owner has, and one is one.
    lendTree: 'druid_beasts', enemies: 6, mortal: true,
    stage: (g, p) => { for (const m of p.minions) m.hp = Math.max(1, m.maxHp * 0.3); },
    observe: (g, p) => p.minions.filter(m => !m.dead).reduce((a, m) => a + m.hp, 0),
  },
  wildshape: {
    what: 'a boon going permanent also grants Greed',
    // `tohBoonPermanent` is reached only from the boon panel, and only on the
    // THIRD pick of the same boon — that is the whole trait. So the probe drives
    // the real `uiAction` path three times rather than calling the hook.
    lend: false, enemies: 0,
    stage: (g, p) => {
      for (let i = 0; i < 3; i++) {
        p.boonOffer = [{ id: 'probe_boon', stat: 'ferocity', amount: 2, rarity: 'common' }];
        g.uiAction(0, { kind: 'boon', id: 'probe_boon' });
      }
    },
    observe: (g, p) => p.perm ? (p.perm.greed || 0) : (p.stats.greed || 0),
  },
  singularity: {
    what: 'every ninth cast collapses a singularity',
    enemies: 4,
    observe: (g, p) => g.singularities.length + (p.tohAtk || 0) * 0,
  },
  rhythm: {
    what: 'casting without a gap builds stacks and raises Ferocity',
    enemies: 4,
    observe: (g, p) => p.stats.ferocity,
  },
  voodoo_link: {
    what: 'damage dealt to anything is mirrored into the bound enemy',
    // THE ONE ROOM THE MIRROR CANNOT PAY IN is a symmetric ring: every selector
    // picks the same dummy, `wd_pin` designates that one too, and `voodooMirror`
    // skips the bound target by design — measured, 10 hits out of 10 landed on
    // the doll and the trait banked nothing while working perfectly. So the doll
    // is staged FAR and FAT (`wd_pin` selects `highest_hp`) and the crowd that
    // pays into it is staged NEAR. §13 rule 26.
    enemies: 5,
    stage: (g, p) => {
      const far = g.spawnEnemyById(DUMMY, p.x + 240, p.y);
      if (far) { far.maxHp = far.hp = 9e9; far.speed = 0; far.spawnX = far.x; far.spawnY = far.y; }
    },
    observe: (g, p) => p.voodooDmg || 0,
  },
  three_stances: {
    what: 'IRON banks absorbed damage onto the next attack',
    enemies: 4,
    // RULE 38'S FIXTURE GAP, CLOSED. The Samurai's stances need a stance and
    // something to react to, and nothing in an ordinary room provides either:
    // `p.stance` starts at IRON but the bank only fills from damage absorbed, so
    // a probe that never gets hit measures an empty stance. Hurt it every tick,
    // in IRON, and the bank is the observable.
    stage: (g, p) => { p.stance = 0; p.stanceCd = 0; },
    each: bleed(10),
    observe: (g, p) => p.ironBank || 0,
  },
  karma: {
    what: 'damage taken is banked and released on the next hit',
    enemies: 4,
    each: bleed(10),
    observe: (g, p) => p.karma || 0,
  },
  contract: {
    what: 'a target is marked under contract, and completing one pays out',
    // Two writes, both the trait's own and neither present with it off:
    // `tickContract` marks, `tohOnKill` banks the completion. Mortal dummies so
    // the second half can happen inside the window.
    enemies: 6, mortal: true,
    observe: (g, p) => (p.contractId !== null ? 1 : 0) + (p.contractsDone || 0),
  },
  grace_and_judgment: {
    what: 'healing done is banked as grace',
    enemies: 4,
    stage: (g, p) => { p.hp = Math.max(1, p.stats.vitality * 0.4); },
    each: (g, p) => { g._heal(p, 4, { by: p }); },
    observe: (g, p) => p.grace || 0,
  },
  blood_dance: {
    what: 'hits build Heat, which is Ferocity',
    enemies: 4,
    observe: (g, p) => p.bloodHeat || 0,
  },
  pack_tactics: {
    what: 'beasts near the Hunter switch it into a pack mode',
    // The Hunter has no tree, so it has no beasts, so `tickPack` reads an empty
    // pack and the trait cannot be exercised at all. That is a CONTENT gap and
    // not an orphaned hook, and the two want opposite fixes — so the gate lends
    // the pack rather than reporting the trait dead. `packMode` is what the
    // trait writes; the stat bonus hangs off it.
    lendTree: 'druid_beasts', enemies: 3,
    // `packMode` ALONE. The first version added the beast count, which the lent
    // tree grants with the trait on OR off — an observable contaminated by the
    // staging reads alive for a dead trait.
    observe: (g, p) => p.packMode || 0,
  },
  coral_growth: {
    what: 'every Nth cast plants a coral node',
    enemies: 4,
    observe: (g, p) => g.corals.length,
  },
};

// ---------------------------------------------------------------- 1. coverage

const KEYS = [...new Set(ALL_CHARS.filter(c => c.trait).map(c => c.trait.key))];
const CLASS_OF = {};
for (const c of ALL_CHARS) if (c.trait && !CLASS_OF[c.trait.key]) CLASS_OF[c.trait.key] = c.id;

console.log(`trait gate — ${KEYS.length} traits on the roster, each asked whether it is REACHED by the live path and whether it has an EFFECT\n`);

const holes = KEYS.filter(k => !PROBES[k]);
if (!holes.length) ok(`every trait on the roster has a probe (${KEYS.length}) — the gate has no blind spot to hide in`);
else fail(`${holes.length} trait(s) have NO PROBE (${holes.join(', ')}) — an untested trait is how three Samurai stances stayed dead for an era`);

const orphans = Object.keys(PROBES).filter(k => !KEYS.includes(k));
if (orphans.length) fail(`probe(s) for traits no character carries: ${orphans.join(', ')} — a probe measuring a deleted trait passes forever`);

// ------------------------------------------------------- 2 & 3. reached, effect

// THE CONTROL: the same everything, with the trait key swapped for a sentinel so
// every `t.key === '<name>'` guard in traits-toh.js misses.
const NONE = '__trait_off__';

function run(key, off) {
  const pr = PROBES[key];
  const charId = CLASS_OF[key];
  const { g, p } = stage(charId, { lend: pr.lend !== false, lendTree: pr.lendTree || LEND });
  if (off) p.char = { ...p.char, trait: { ...p.char.trait, key: NONE } };
  g._recomputeStats(p);
  const es = pr.enemies ? ring(g, p, pr.enemies, pr.r || 70, { immortal: !pr.mortal }) : [];
  if (pr.stage) pr.stage(g, p, es);
  let peak = pr.observe(g, p, es);
  for (let i = 0; i < 60 * SECONDS; i++) {
    g.setInput(0, { mx: 0, my: 0 });
    if (pr.each) pr.each(g, p, es);
    g.tick();
    if (!p.downed) p.hp = Math.max(p.hp, 1);
    for (const e of es) { e.x = e.spawnX; e.y = e.spawnY; }
    const v = pr.observe(g, p, es);
    if (v > peak) peak = v;
  }
  return peak;
}

const rows = [];
for (const key of KEYS) {
  if (!PROBES[key]) continue;
  let live = NaN, ctrl = NaN, err = null;
  try { live = run(key, false); ctrl = run(key, true); }
  catch (e) { err = e; }
  rows.push({ key, cls: CLASS_OF[key], live, ctrl, err, what: PROBES[key].what });
}

const w = Math.max(...rows.map(r => r.key.length));
console.log('');
let dead = 0;
for (const r of rows) {
  const verdict = r.err ? 'ERROR' : !(r.live > r.ctrl) ? 'DEAD' : 'alive';
  if (verdict !== 'alive') dead++;
  console.log(`  ${r.key.padEnd(w)}  ${verdict.padEnd(6)} ${String(Number.isFinite(r.live) ? r.live.toFixed(1) : '—').padStart(9)} / ${String(Number.isFinite(r.ctrl) ? r.ctrl.toFixed(1) : '—').padEnd(9)} ${r.cls.replace('toh_', '').padEnd(14)} ${r.what}`);
  if (r.err) console.log(`      ${String(r.err.message || r.err).slice(0, 160)}`);
}
console.log('');

for (const r of rows) {
  if (r.err) { fail(`${r.key}: the probe could not run — ${String(r.err.message || r.err).slice(0, 140)}`); continue; }
  if (r.live > r.ctrl) continue;
  fail(`${r.key} (${r.cls}) is REACHED BY NOTHING: ${r.what} reads ${r.live.toFixed(1)} with the trait on and ${r.ctrl.toFixed(1)} with it off. Either its hook has no caller that still runs — D-28's shape — or this probe stages the wrong situation (§13 rule 26). Check the caller before the trait.`);
}
if (!dead) ok(`every trait is reached by the live path and moves its own observable — ${rows.length} of ${rows.length}`);

console.log(failures ? `\n${failures} TRAIT GATE FAILURE(S)` : '\nEVERY TRAIT ON THE ROSTER IS REACHABLE AND DOES SOMETHING');
process.exit(failures ? 1 : 0);
