// THE STAT GATE — does a stat the game SELLS actually do anything?
//
// This is the stat-system counterpart of tools/offence_test.mjs, and it exists
// for the same reason. offence_test was written after a green sim suite hid a
// party that could not deal damage, because every check measured something
// other than the thing that mattered. The same gap existed on stats: Ferocity
// is offered at every level-up as "universal damage %" and multiplies no
// composed damage anywhere in the game.
//
// WHY A GREP CANNOT DO THIS JOB. `p.stats.ferocity` IS read — in `_fireWeapon`,
// which nothing has called since weapons were removed, and in trait branches
// keyed to archetypes archived with the classic roster. Searching for the
// identifier finds those and reports the stat live. Existence is not the
// question; EFFECT is.
//
// WHY EACH STAT IS STAGED RATHER THAN FOUGHT FOR. The first three versions of
// this gate ran a real fight and diffed the outcome. That works for a stat the
// fight happens to exercise and silently fails for every other: an arena ramps
// from three enemies, a circling bot takes few hits, and a three-slot loadout
// cannot hold a heal, a summon, a status skill and an attack at once. Those
// runs reported Recovery, Attunement and Ingenuity as "not exercised" — which
// is honest, and useless. So each stat now gets the situation it would matter
// in, staged directly, the way tools/skill_sweep.mjs stages a trigger.
//
// It presupposes nothing about what a stat SHOULD do. §9.5 has no recorded
// intent yet, and encoding a guess here would make this gate an opinion. It
// asks only the question that has an answer today: is this stat connected to
// anything a player can observe?
//
// Usage: node tools/stat_gate.mjs [--verbose]

import { Sim } from '../js/game.js';
import { SELECTABLE } from '../js/content/characters.js';
import { STATS } from '../js/config.js';
import { STAT_BOOSTS } from '../js/content/statboosts.js';
import { TREES, SKILL_BY_ID } from '../js/skills.js';
import { spendSkillPoint } from '../js/skillsim.js';
import { ENEMIES } from '../js/content/enemies.js';

const VERBOSE = process.argv.includes('--verbose');
let failures = 0;
const fail = (m) => { failures++; console.error(`✗ ${m}`); };
const ok = (m) => console.log(`✓ ${m}`);

// §13 rule 20 — the fixture is the state a player would arrive in.
const ARRIVE_LEVEL = 12;
// Big enough that a live stat cannot hide in rounding. Percent stats are %,
// flat stats are points.
const BUMP = 120;
const TRIALS = 400;        // for probes that ride an RNG roll

// A staged sim: one armed player of `charId`, standing in a real arena, with
// every skill in its trees learned so a probe can fire whichever it needs.
function stage(charId, statKey, bump, seed = 4711) {
  const g = new Sim({ seed, party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const p = g.players[0];
  p.level = ARRIVE_LEVEL;
  for (const tid of Object.keys(TREES).filter(t => TREES[t].classId === charId)) {
    for (const s of [...TREES[tid].skills].sort((a, b) => a.tier - b.tier)) {
      p.skillPoints++;
      spendSkillPoint(g, p, s.id);
    }
  }
  if (bump) g._applyPerm(p, { [statKey]: bump });
  p.hp = p.stats.vitality;
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);
  // Clear whatever the arena spawned: every probe stages its own targets, and
  // ambient enemies would add noise the comparison cannot attribute.
  for (const e of [...g.enemyPool]) if (e.active) { e.hp = 0; e.active = false; }
  return { g, p };
}

// A target that sits still and absorbs: spawned through the real path, then
// pinned so movement cannot change what a probe measures. The id is read from
// the live table rather than written down here, so a content rename cannot turn
// every probe into a silent NaN (§13 rule 12).
const DUMMY_ID = ENEMIES[0].id;
function target(g, x, y) {
  const e = g.spawnEnemyById(DUMMY_ID, x, y);
  if (e) { e.maxHp = e.hp = 1e9; e.speed = 0; e.spawnX = x; e.spawnY = y; }
  return e;
}

const NECRO = SELECTABLE.find(c => c.id === 'toh_necromancer') || SELECTABLE[0];
const DRUID = SELECTABLE.find(c => c.id === 'toh_druid') || SELECTABLE[0];

// ---------------------------------------------------------------- the probes
//
// Each returns a NUMBER. The gate runs it twice — unbumped and bumped — and the
// stat is live if the two numbers differ. `what` names the observable so a
// result reads as a finding rather than a boolean.

const PROBES = {
  vitality: {
    what: 'max HP',
    run: ({ p }) => p.stats.vitality,
  },

  ferocity: {
    what: 'damage a skill deals to a pinned target',
    char: () => NECRO.id,
    run: ({ g, p }) => {
      const e = target(g, p.x + 60, p.y);
      if (!e) return NaN;
      const before = e.hp;
      // Fire through the real composed path, not a direct damage call.
      for (let i = 0; i < 60 * 6; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); e.x = e.spawnX; e.y = e.spawnY; }
      return Math.round(before - e.hp);
    },
  },

  tempo: {
    what: 'distance covered in 2 s',
    run: ({ g, p }) => {
      const x0 = p.x, y0 = p.y;
      let d = 0;
      for (let i = 0; i < 120; i++) {
        const px = p.x, py = p.y;
        g.setInput(0, { mx: 1, my: 0 });
        g.tick();
        d += Math.hypot(p.x - px, p.y - py);
      }
      return Math.round(d);
    },
  },

  grit: {
    what: 'HP lost to a fixed 40-damage hit',
    run: ({ g, p }) => {
      const before = p.hp;
      g.hurtPlayer(p, 40, null, { shared: true });   // shared = skip the dodge roll
      return Math.round(before - p.hp);
    },
  },

  reflex: {
    what: `HP lost across ${TRIALS} unshared hits (dodges reduce it)`,
    run: ({ g, p }) => {
      let lost = 0;
      for (let i = 0; i < TRIALS; i++) {
        p.hp = p.stats.vitality;
        p.invuln = 0;
        const before = p.hp;
        g.hurtPlayer(p, 10, null, {});
        lost += before - p.hp;
      }
      return Math.round(lost);
    },
  },

  recovery: {
    what: 'HP restored by a 50-point heal',
    run: ({ g, p }) => {
      p.hp = 1;
      g._heal(p, 50);
      return Math.round(p.hp);
    },
  },

  ingenuity: {
    what: 'damage a summoned minion deals',
    char: () => NECRO.id,
    run: ({ g, p }) => {
      const sk = SKILL_BY_ID['necro_raise_skeleton'];
      if (!sk) return NaN;
      const e = target(g, p.x + 50, p.y);
      if (!e) return NaN;
      // Put a minion on the field through the real primitive, then let it work.
      g.spawnMinions(p, sk, sk.compose[0], 5);
      const before = e.hp;
      for (let i = 0; i < 60 * 8; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); e.x = e.spawnX; e.y = e.spawnY; }
      return Math.round(before - e.hp);
    },
  },

  attunement: {
    what: 'chill depth + plague damage applied through the SKILL path',
    char: () => NECRO.id,
    run: ({ g, p }) => {
      const e = target(g, p.x + 60, p.y);
      if (!e) return NaN;
      const skill = { id: 'probe', domain: 'spiritual' };
      g.applySlow(e, 0.5, 3);
      g.applyPlague(e, 40, 4, p, skill);
      // Both are read back as magnitudes, so an amplifier would show up in
      // either the depth of the chill or the rate of the dot.
      return Math.round((1 - (e.slowMult ?? 1)) * 1000 + (e.slowT || 0) * 100 + (e.plagueDps || 0) * 10);
    },
  },

  greed: {
    // TWO CHANNELS, because Greed has two declared jobs and testing one would
    // have libelled it. The first version of this probe killed 400 enemies and
    // reported Greed dead — but the tithe fires from _clearRewards on FIGHT
    // CLEAR, not per kill, so the probe had simply never run the code it was
    // judging. Rarity bias is the other half and rides its own function.
    what: 'tithe on fight clear + rarity bias over rolls',
    run: ({ g, p }) => {
      const before = p.matsCollected;
      g._clearRewards(p);
      const tithe = p.matsCollected - before;
      let better = 0;
      for (let i = 0; i < TRIALS; i++) {
        if (g._rollRarity(g.rng, p.stats.greed) !== 'common') better++;
      }
      return tithe * 10000 + better;
    },
  },

  reach: {
    what: 'materials magnetised from 100 units away',
    run: ({ g, p }) => {
      const before = p.matsCollected;
      for (let i = 0; i < 40; i++) g._dropMaterial(p.x + 100, p.y + (i - 20));
      for (let i = 0; i < 180; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); }
      return p.matsCollected - before;
    },
  },
};

// ---------------------------------------------------------------- the sweep

console.log(`stat gate — ${STATS.length} stats, each staged in the situation it would matter in\n`);

const offered = new Set(STAT_BOOSTS.map(b => b.stat));
const notOffered = STATS.filter(s => !offered.has(s.key));
if (!notOffered.length) ok(`all ${STATS.length} stats are offered to players at level-up — the whole set is under test`);
else console.log(`  note: ${notOffered.map(s => s.key).join(', ')} are never offered`);

const results = [];
for (const stat of STATS) {
  const probe = PROBES[stat.key];
  if (!probe) { fail(`${stat.key} has no probe — a stat with no gate is exactly the hole this file exists to close`); continue; }
  const charId = probe.char ? probe.char() : SELECTABLE[0].id;
  let base, bumped, err = null;
  try {
    base = probe.run(stage(charId, stat.key, 0));
    bumped = probe.run(stage(charId, stat.key, BUMP));
  } catch (e) { err = e; }
  const usable = !err && Number.isFinite(base) && Number.isFinite(bumped);
  results.push({ stat, probe, base, bumped, usable, err, live: usable && base !== bumped, charId });
  if (VERBOSE) console.log(`    ${stat.key} (${charId}): ${base} -> ${bumped}${err ? ' ERR ' + err.message : ''}`);
}

// §13 rule 4 — the gate proves it can see a live stat before reporting a dead
// one. Vitality is unambiguously connected; if its probe does not move, nothing
// below means anything.
const vit = results.find(r => r.stat.key === 'vitality');
if (vit && vit.live) ok(`control: Vitality moves its probe (${vit.base} -> ${vit.bumped} ${vit.probe.what}) — the gate can see a live stat`);
else fail('control failed: Vitality did not move its own probe, so no result below can be trusted');

console.log('\n  stat         verdict   observable                                        base -> +' + BUMP);
console.log('  ----         -------   ----------                                        ---------------');
for (const r of results) {
  const verdict = !r.usable ? 'BROKEN' : (r.live ? 'live' : 'DEAD');
  console.log(`  ${r.stat.key.padEnd(12)} ${verdict.padEnd(9)} ${r.probe.what.slice(0, 48).padEnd(50)} ${r.base} -> ${r.bumped}`);
}
console.log('');

for (const r of results) {
  if (!r.usable) { fail(`${r.stat.key}: probe could not run (${r.err ? r.err.message : `base ${r.base}, bumped ${r.bumped}`}) — a probe that cannot measure is not a pass`); continue; }
  if (!r.live) {
    fail(`${r.stat.key} ("${r.stat.name}") is SOLD TO PLAYERS AND CHANGES NOTHING — +${BUMP} left ${r.probe.what} at ${r.base}`);
  }
}
const liveN = results.filter(r => r.live).length;
if (liveN === results.length) ok(`every stat the game sells is read by the live path — all ${results.length} moved their probe`);
else console.log(`  ${liveN}/${results.length} stats are connected to anything.`);

console.log(failures ? `\n${failures} STAT GATE FAILURE(S)` : '\nEVERY STAT THE GAME SELLS DOES SOMETHING');
process.exit(failures ? 1 : 0);
