// A CONTAGION SPREADS AS FAR AS IT SAYS, OR IT IS NOT A CONTAGION.
//
// Nine skills use the `plague` primitive and every one of them is rendered to
// the player as "Shape contagion". Three spread. Five are named as spreading
// and seed nobody, and one deliberately does not spread and is correct.
//
// THE LOADER ALREADY REFUSES the shapes that caused this — a `range` on a
// plague step, or a missing `spreadRadius` on a skill nobody has filed. What it
// cannot refuse is the five that are already broken, because refusing them
// would not start the game. So they sit on a RATCHET, and this gate is the
// thing that stays red while they do.
//
// It goes green when PLAGUE_SPREAD_PENDING is empty. Nothing may be added to
// that set — the load assertion sees to that — so the only way to green is to
// give each of the five a radius.
//
//   node tools/contagion_gate.mjs

import { SKILL_BY_ID, PLAGUE_SPREAD_PENDING, PLAGUE_SINGLE_TARGET } from '../js/skills.js';

let checks = 0, fails = 0;
const ok = m => { checks++; console.log(`✓ ${m}`); };
const bad = m => { checks++; fails++; console.log(`✗ ${m}`); };

const plagues = [];
for (const s of Object.values(SKILL_BY_ID)) {
  for (const step of s.compose || []) if (step.kind === 'plague') plagues.push({ s, step });
}

console.log(`CONTAGIONS — ${plagues.length} skills use the plague primitive\n`);

// ---- 1. the ratchet is empty ----
if (!PLAGUE_SPREAD_PENDING.size) {
  ok('no contagion is waiting for a spread radius');
} else {
  bad(`${PLAGUE_SPREAD_PENDING.size} contagion(s) are named as spreading and seed nobody, waiting on a radius: `
    + [...PLAGUE_SPREAD_PENDING].join(', '));
}

// ---- 2. nothing joined the ratchet ----
//
// The load assertion enforces this, so a failure here means the assertion was
// weakened rather than that content drifted.
const EXPECTED = new Set(['wd_contagion', 'wd_pandemic', 'sav_bleed_them', 'smith_sparks', 'necro_internal_collapse']);
const added = [...PLAGUE_SPREAD_PENDING].filter(id => !EXPECTED.has(id));
// REPORT THE LIVE SET, NOT THE FROZEN ONE. Printing EXPECTED.size said "five"
// on the day the last of them was cleared, which reads as five still pending.
// A ratchet's whole point is that it ends empty; the gate should say when it has.
if (added.length) bad(`${added.length} contagion(s) JOINED the ratchet — it only ever shrinks: ${added.join(', ')}`);
else if (!PLAGUE_SPREAD_PENDING.size) ok(`the ratchet is EMPTY — all ${EXPECTED.size} it opened with have been ruled and cleared`);
else ok(`${PLAGUE_SPREAD_PENDING.size} of the ${EXPECTED.size} still pending, and nothing joined`);

// ---- 3. every plague is accounted for, one way or the other ----
const unaccounted = plagues.filter(({ s, step }) =>
  !(step.spreadRadius > 0) && !PLAGUE_SPREAD_PENDING.has(s.id) && !PLAGUE_SINGLE_TARGET.has(s.id));
if (!unaccounted.length) ok('every plague either spreads, is filed as deliberately single-target, or is on the ratchet');
else bad(`${unaccounted.length} plague(s) in none of the three states: ${unaccounted.map(x => x.s.id).join(', ')}`);

// ---- 4. a filed single-target plague still has a reason ----
const noReason = [...PLAGUE_SINGLE_TARGET].filter(([, why]) => !why || why.length < 20);
if (!noReason.length) ok(`all ${PLAGUE_SINGLE_TARGET.size} deliberately single-target plague(s) carry a reason`);
else bad(`${noReason.length} filed with no reason — an entry with no reason is one somebody added to silence this: ${noReason.map(([id]) => id).join(', ')}`);

// ---- 5. the working radii, for whoever sets the five ----
const working = plagues.filter(({ step }) => step.spreadRadius > 0)
  .map(({ s, step }) => `${s.id} r${step.spreadRadius}`);
console.log(`\nthe ${working.length} contagions that do spread: ${working.join(', ')}`);

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A SKILL CALLED A CONTAGION DOES NOT SPREAD' : 'EVERY CONTAGION SPREADS');
process.exit(fails ? 1 : 0);
