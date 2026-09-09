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

import { TREES } from '../js/skills.js';

let checks = 0, fails = 0;
const ok = m => { checks++; console.log('  ✓ ' + m); };
const bad = m => { checks++; fails++; console.log('  ✗ ' + m); };

const wards = [];
for (const t of Object.values(TREES)) for (const s of t.skills) for (const step of (s.compose || [])) {
  if (step.kind === 'ward' && step.reflectPct !== undefined) wards.push({ s, step });
}

console.log(`REFLECT UNITS — ${wards.length} wards declare a reflectPct\n`);

// ---- 1. every reflect is a fraction ----
const rogue = wards.filter(({ step }) => step.reflectPct > 1);
if (!rogue.length) ok(`every one is a fraction — none above 1`);
else bad(`${rogue.length} ward(s) declare a reflect above 1, a percentage in a fraction field: `
  + rogue.map(({ s, step }) => `${s.id} ${step.reflectPct}`).join(', '));

// ---- 2. nobody sits where a typo would be invisible ----
// The clamp at skillsim.js:1043 guards only the quill path; a value arriving
// through `compose` is not clamped anywhere, which is why this is load-bearing
// rather than cosmetic. Between 1 and 1.5 is the dangerous band: too small to
// read as a percentage at a glance, too large to be a fraction.
const near = wards.filter(({ step }) => step.reflectPct > 1 && step.reflectPct <= 1.5);
if (!near.length) ok('none sits between 1 and 1.5, where a unit error would read as plausible');
else bad(`${near.length} ward(s) between 1 and 1.5: ${near.map(({ s }) => s.id).join(', ')}`);

// ---- 3. the eight converted skills stayed converted ----
// Named individually because a revert would otherwise pass check 1 silently if
// somebody restored one file from an older revision.
const CONVERTED = { mage_adamant: 0.35, sav_ashfield: 0.34, monk_one_breath: 0.34, wiz_reversal: 0.32,
  dru_bramblehide: 0.32, pri_vespers: 0.30, smith_forge_weld: 0.30, druid_stoneskin: 0.25 };
const byId = new Map(wards.map(({ s, step }) => [s.id, step.reflectPct]));
const reverted = Object.entries(CONVERTED).filter(([id, v]) => {
  const got = byId.get(id);
  return got === undefined || Math.abs(got - v) > 1e-9;
});
if (!reverted.length) ok(`all ${Object.keys(CONVERTED).length} converted wards still carry their fraction`);
else bad(`${reverted.length} converted ward(s) no longer match: `
  + reverted.map(([id, v]) => `${id} wants ${v}, has ${byId.get(id)}`).join('; '));

// ---- 4. the spread is sane ----
const vals = wards.map(({ step }) => step.reflectPct).filter(v => v > 0);
const hi = Math.max(...vals), lo = Math.min(...vals);
if (hi <= 1 && lo > 0) ok(`the roster's reflects span ${lo} to ${hi} — all fractions`);
else bad(`reflect spread is ${lo} to ${hi}`);

// ---- what the offenders would print to a player right now ----
if (rogue.length) {
  console.log('\nwhat the description generator tells the player for each:');
  for (const { s: sk, step } of rogue)
    console.log(`  ${sk.id.padEnd(20)} "Reflects ${Math.round(step.reflectPct * 100)}%"   (means ${step.reflectPct}x absorbed)`);
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A REFLECT IS A FRACTION AND SOME OF THEM ARE NOT' : 'EVERY REFLECT IS A FRACTION');
process.exit(fails ? 1 : 0);
