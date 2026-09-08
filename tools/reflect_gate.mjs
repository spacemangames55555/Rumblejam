// IS A REFLECT A FRACTION OR A PERCENTAGE?
//
// It is a fraction, and the engine says so itself. `skillsim.js:1045` throws
// back `eaten * p.wardReflect`, and `skillsim.js:1043` — the one place the
// engine does arithmetic on the field instead of storing it — clamps to 1.
// `skilltext.js:287` renders it to the player as `× 100`.
//
// Eight wards across seven classes were authored as whole numbers, so they
// currently reflect twenty-five to thirty-five TIMES the damage they absorb and
// describe themselves to the player as reflecting three thousand percent. This
// is the same shape as the summon `attackCd` error, where four skills wrote
// seconds into a milliseconds field, and it went unnoticed the same way: every
// value is individually plausible and nothing compares them.
//
// The eight are on a ratchet rather than corrected here, because choosing the
// fraction for somebody is retuning eight skills across seven classes. What
// this gate guarantees is that a ninth cannot appear.
//
//   node tools/reflect_gate.mjs

import { TREES, REFLECT_UNIT_PENDING } from '../js/skills.js';

let checks = 0, fails = 0;
const ok = m => { checks++; console.log('  ✓ ' + m); };
const bad = m => { checks++; fails++; console.log('  ✗ ' + m); };

const wards = [];
for (const t of Object.values(TREES)) for (const s of t.skills) for (const step of (s.compose || [])) {
  if (step.kind === 'ward' && step.reflectPct !== undefined) wards.push({ s, step });
}

console.log(`REFLECT UNITS — ${wards.length} wards declare a reflectPct\n`);

// ---- 1. nothing outside the ratchet is a percentage ----
const rogue = wards.filter(({ s, step }) => step.reflectPct > 1 && !REFLECT_UNIT_PENDING.has(s.id));
if (!rogue.length) ok('every reflect outside the ratchet is a fraction');
else bad(`${rogue.length} ward(s) declare a reflect above 1 and are NOT on the ratchet — a percentage in a fraction field: `
  + rogue.map(({ s, step }) => `${s.id} ${step.reflectPct}`).join(', '));

// ---- 2. the ratchet only ever shrinks ----
const EXPECTED = new Set(['mage_adamant', 'sav_ashfield', 'monk_one_breath', 'wiz_reversal',
  'dru_bramblehide', 'pri_vespers', 'smith_forge_weld', 'druid_stoneskin']);
const added = [...REFLECT_UNIT_PENDING].filter(id => !EXPECTED.has(id));
if (added.length) bad(`${added.length} ward(s) JOINED the ratchet — it only ever shrinks: ${added.join(', ')}`);
else if (!REFLECT_UNIT_PENDING.size) ok(`the ratchet is EMPTY — all ${EXPECTED.size} it opened with have been ruled and corrected`);
else bad(`${REFLECT_UNIT_PENDING.size} of ${EXPECTED.size} still carry a percentage where a fraction belongs — `
  + `this gate stays red until Casey rules them: ${[...REFLECT_UNIT_PENDING].join(', ')}`);

// ---- 3. a listed skill still actually has the defect ----
const byId = new Map(wards.map(({ s, step }) => [s.id, step.reflectPct]));
const stale = [...REFLECT_UNIT_PENDING].filter(id => !(byId.get(id) > 1));
if (!stale.length) ok(`all ${REFLECT_UNIT_PENDING.size} listed ward(s) still carry the defect they were listed for`);
else bad(`${stale.length} listed ward(s) no longer have the defect — remove them from the list: ${stale.join(', ')}`);

// ---- 4. nobody reflects more than they absorb ----
// The clamp at skillsim.js:1043 only guards the quill path. A fraction above 1
// arriving through `compose` is not clamped anywhere, which is why the value
// being a fraction is load-bearing rather than cosmetic.
const over = wards.filter(({ step }) => step.reflectPct > 1 && step.reflectPct <= 1.5);
if (!over.length) ok('no ward sits just above 1, where a typo would be invisible to the eye');
else bad(`${over.length} ward(s) between 1 and 1.5 — too small to read as a percentage, too large to be a fraction`);

// ---- what the offenders would print to a player right now ----
if (REFLECT_UNIT_PENDING.size) {
  console.log('\nwhat the description generator tells the player today:');
  for (const id of [...REFLECT_UNIT_PENDING].sort()) {
    const v = byId.get(id);
    if (v !== undefined) console.log(`  ${id.padEnd(20)} "Reflects ${Math.round(v * 100)}%"   (means ${v}x absorbed)`);
  }
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A REFLECT IS A FRACTION AND SOME OF THEM ARE NOT' : 'EVERY REFLECT IS A FRACTION');
process.exit(fails ? 1 : 0);
