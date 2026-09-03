// PRIMITIVE SURVEY — what the engine can deliver, and what content actually uses.
//
// Two halves, and they are deliberately measured separately:
//
//   WHAT THE ENGINE READS. Every `step.<name>` a primitive's own body touches,
//   scraped from `js/compose.js`. This is the parameter list as the code sees
//   it, not as a document claims.
//
//   WHAT CONTENT DECLARES. Every compose step in every shipped skill, bucketed
//   by `kind`, so each parameter gets a real observed range and a real example
//   cited by skill id. A parameter the engine reads and no skill sets is an
//   optional with a default; a key content sets and the engine never reads is
//   dead weight.
//
// The gap between the two halves is the interesting part, and it is printed.
//
//   node tools/primitive_survey.mjs [--json]

import { readFileSync } from 'node:fs';
import { SKILL_BY_ID } from '../js/skills.js';
import { PRIMITIVES, RIDERS_BY_PRIMITIVE } from '../js/compose.js';

const JSON_OUT = process.argv.includes('--json');
const SRC = readFileSync(new URL('../js/compose.js', import.meta.url), 'utf8');

const NAMES = Object.keys(PRIMITIVES).sort();

// ---- 1. the parameters each primitive's body reads off its step ----
//
// Slice the file at each primitive's own function header and read to the next
// one, so a `step.x` in a neighbour is not attributed here.
function bodyOf(name) {
  const start = SRC.indexOf(`\n  ${name}(sim, p, skill, step, rank, grid, out) {`);
  if (start < 0) return '';
  let end = SRC.length;
  for (const other of NAMES) {
    if (other === name) continue;
    const i = SRC.indexOf(`\n  ${other}(sim, p, skill, step, rank, grid, out) {`);
    if (i > start && i < end) end = i;
  }
  return SRC.slice(start, end);
}

// Primitives that hand the WHOLE step to a helper outside this file. Their
// parameter list is not visible in the body, so a "the engine never reads this"
// claim scraped from the body alone would be wrong about every one of them.
const DELEGATES = {
  summon: 'sim.spawnMinions() / sim.spawnSummonSeed() in js/game.js',
  bolt: 'the projectile spawn in js/game.js (speed, damage, riders travel with the shot)',
};

const reads = {};
for (const name of NAMES) {
  const body = bodyOf(name);
  const found = new Set();
  for (const m of body.matchAll(/\bstep\.([A-Za-z_][A-Za-z0-9_]*)/g)) found.add(m[1]);
  // `stepDamage(step, ...)` and `rankedDuration(step.duration, ...)` are the two
  // helpers that read the step on a primitive's behalf; credit them to it.
  if (/stepDamage\(step/.test(body)) { found.add('damage'); found.add('damagePct'); }
  reads[name] = [...found].filter(k => k !== 'riders' && !k.startsWith('_')).sort();
}

// ---- 2. what shipped content actually declares, per kind ----
const seen = {};                       // kind -> param -> { values:[], skills:Set }
const usedBy = {};                     // kind -> Set(skill id)
const walk = (steps, id) => {
  for (const st of steps || []) {
    if (!st || !st.kind) continue;
    const k = st.kind;
    (usedBy[k] ||= new Set()).add(id);
    seen[k] ||= {};
    for (const [key, val] of Object.entries(st)) {
      if (key === 'kind') continue;
      const slot = (seen[k][key] ||= { values: [], skills: new Set() });
      slot.skills.add(id);
      if (typeof val === 'number') slot.values.push(val);
      else slot.values.push(val);
    }
    if (st.attack) walk([st.attack], id);      // a summon's attack is a step
  }
};
for (const s of Object.values(SKILL_BY_ID)) walk(s.compose, s.id);

const num = a => a.filter(v => typeof v === 'number');
const range = a => {
  const n = num(a);
  if (!n.length) return null;
  const lo = Math.min(...n), hi = Math.max(...n);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
};

if (JSON_OUT) {
  const out = {};
  for (const name of NAMES) {
    out[name] = {
      engineReads: reads[name],
      riders: RIDERS_BY_PRIMITIVE[name] || [],
      usedBy: [...(usedBy[name] || [])],
      params: Object.fromEntries(Object.entries(seen[name] || {}).map(([k, v]) => [k, {
        range: range(v.values), n: v.skills.size, example: [...v.skills][0],
        nonNumeric: num(v.values).length !== v.values.length,
      }])),
    };
  }
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

console.log(`PRIMITIVE SURVEY — ${NAMES.length} primitives, ${Object.keys(SKILL_BY_ID).length} skills\n`);
for (const name of NAMES) {
  const users = usedBy[name] || new Set();
  console.log(`## ${name}   — ${users.size} shipped skill(s)${users.size ? `, e.g. ${[...users][0]}` : '   *** UNUSED ***'}`);
  console.log(`   engine reads: ${reads[name].join(', ') || '(none)'}`);
  console.log(`   riders allowed: ${(RIDERS_BY_PRIMITIVE[name] || []).join(', ') || '(none)'}`);
  if (DELEGATES[name]) console.log(`   hands the whole step to: ${DELEGATES[name]}`);
  const params = seen[name] || {};
  const keys = Object.keys(params).sort();
  if (keys.length) {
    console.log(`     ${'param'.padEnd(16)} ${'observed'.padEnd(14)} ${'used by'.padEnd(9)} required?`);
    for (const k of keys) {
      const v = params[k];
      const r = range(v.values);
      // Required IN PRACTICE: every shipped skill of this kind declares it.
      // That is a stronger claim than "the engine would crash without it" and a
      // weaker one than "the loader rejects a step that omits it" — it is what
      // the content actually does, which is what a doc reader needs.
      const req = v.skills.size === users.size ? 'always set' : `${v.skills.size}/${users.size}`;
      console.log(`     ${k.padEnd(16)} ${String(r ?? 'non-numeric').padEnd(14)} ${String(v.skills.size).padStart(3)}       ${req}`);
    }
  }
  const declaredNever = reads[name].filter(k => !keys.includes(k));
  if (declaredNever.length) console.log(`     read by the primitive, set by no shipped skill: ${declaredNever.join(', ')}`);
  console.log();
}

const unused = NAMES.filter(n => !(usedBy[n] || new Set()).size);
console.log(`UNUSED PRIMITIVES: ${unused.length ? unused.join(', ') : 'none — every primitive has at least one shipped skill'}`);
