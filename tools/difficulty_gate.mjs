// THE DIFFICULTY GATE — do the four settings do anything?
//
// §4.1 has described four difficulty settings since phase 2b, the UI has
// offered them, and until D-24 wired `regionFightMods()` NONE OF THEM DID
// ANYTHING: `difficultyOf()` was called from exactly one function, and that
// function had no callers. The monotonic-ladder assertion passed the whole
// time because it checked the TABLE — that 1.3 is bigger than 1.0 — which was
// true of a table nothing read.
//
// That is the third instance of the same defect class in this project:
// Ferocity sold at every level-up and multiplying nothing, §2.4's Elite node
// modifiers unreachable, and now four difficulty settings scaling a fight
// nobody was running through them. Each was found by measuring an EFFECT after
// a check on the DECLARATION had passed for months.
//
// So this gate measures a fight. §4.1 promises four axes move and one does not,
// and the one that does not is the interesting half: **XP is never scaled by
// difficulty**, because a hardest setting that paid more XP would stop being a
// preference and become the only correct choice. That has been asserted at load
// and never observed.
//
// Usage: node tools/difficulty_gate.mjs [--verbose]

import { Sim } from '../js/game.js';
import { SELECTABLE } from '../js/content/characters.js';
import { TREES } from '../js/skills.js';
import { spendSkillPoint } from '../js/skillsim.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY } from '../js/worldmap.js';
import { isOnboardingNode } from '../js/arenas.js';

const VERBOSE = process.argv.includes('--verbose');
let failures = 0;
const fail = m => { failures++; console.error(`✗ ${m}`); };
const ok = m => console.log(`✓ ${m}`);

const SECONDS = 60;
const SEED = 31337;
const LEVEL = 30;    // enough tree to kill at a rate that makes a payout sample

// One room, fought identically, with only the difficulty differing.
//
// TWO FIXTURE CHOICES, BOTH FORCED BY EARLIER WRONG ANSWERS.
//
// `god` is on because this measures THE ROOM — how much enemy the setting puts
// in front of the player — and a player dying at Unmade would truncate the
// sample and flatter the hardest setting.
//
// The bot CHASES and the player is LEVELLED because the first version stood a
// level-1 character still and then divided by what it had banked: 0.02 to 0.06
// materials per enemy, from which it computed a gold ratio of ×0.58 against a
// table saying ×0.9 and called the game wrong. The game was not wrong; the
// denominator was a bot's walking pattern.
//
// AND THE ROOM IS REPRESENTATIVE ON PURPOSE — a third fixture choice, forced by
// a third wrong answer. This used to take "the first non-shop node", which is
// floor 1 column 0. When the onboarding ramp made that node field half the
// enemies from three archetypes, this gate went red on two axes at once: mean
// HP inverted (×1.06 against a table saying ×0.85) and the ladder stopped being
// monotonic. Neither was true of difficulty. The sample had moved into the
// tutorial, where a 3-archetype mix over ~30 enemies lets one heavy swing the
// mean harder than the ×0.85 the setting applies, and where halving the count
// squeezes four settings into a range too narrow to order.
//
// So the node is chosen for representativeness rather than for being first, and
// the choice is ASSERTED rather than assumed: `isOnboardingNode` is the sim's
// own predicate, so if the exception's definition ever grows, this fails
// pointing at itself instead of accusing the difficulty table.
function pickRepresentativeNode(g) {
  const eligible = g.floor.nodes.filter(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  return eligible.find(x => !isOnboardingNode(g.floorNum, x)) || null;
}

function room(difficultyId, seed) {
  const charId = SELECTABLE[0].id;
  const g = new Sim({ seed, party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  g.difficulty = difficultyId;
  const p = g.players[0];
  p.level = LEVEL;
  const tree = Object.values(TREES).find(t => t.classId === charId);
  if (tree) for (const s of [...tree.skills].sort((a, b) => a.tier - b.tier)) { p.skillPoints++; spendSkillPoint(g, p, s.id); }
  const node = pickRepresentativeNode(g);
  if (!node) return { noRoom: true };
  node.kind = 'combat';
  g.god = true;
  g._travelTo(node.id);
  const onboarding = g._onboarding();

  let n = 0, hp = 0, dmg = 0;
  const xp0 = p.xpEarned, matsC0 = p.matsCollected;
  for (let t = 0; t < 60 * SECONDS; t++) {
    for (const e of g.enemyPool) {
      if (!e.active || e._dg) continue;
      e._dg = 1; n++; hp += e.maxHp; dmg += e.dmg;
    }
    const tgt = g.trigGrid && g.trigGrid.nearest ? g.trigGrid.nearest(p.x, p.y, 900) : null;
    if (tgt) {
      const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy) || 1;
      g.setInput(0, d > 110 ? { mx: dx / d, my: dy / d } : { mx: 0, my: 0 });
    } else g.setInput(0, { mx: 0, my: 0 });
    g.tick();
  }
  // GOLD AND XP ARE READ FROM THE PAYOUT, NOT FROM THE POCKET. `payout` records
  // what the kill path paid on each axis and how many kills it paid for, so the
  // denominator is enemies killed — a game quantity — rather than materials the
  // bot happened to walk over. The banked numbers below are kept as the
  // end-to-end check that the split survives the pickup path.
  const k = Math.max(1, g.payout.kills);
  return {
    onboarding, count: n,
    hp: hp / Math.max(1, n),
    dmg: dmg / Math.max(1, n),
    kills: g.payout.kills,
    gold: g.payout.gold / k,            // materials dropped per enemy killed
    xpPerKill: g.payout.xp / k,         // experience-bearing materials per kill
    banked: p.matsCollected - matsC0,
    bankedXp: p.xpEarned - xp0,
  };
}

console.log(`difficulty gate — ${DIFFICULTIES.length} settings, one room each, ${SECONDS}s\n`);

const base = room(DEFAULT_DIFFICULTY, SEED);
if (base.noRoom) {
  fail('no representative combat node exists on floor 1 — every eligible node is the onboarding room, so this gate has nowhere to measure');
} else if (base.onboarding) {
  // The fixture asked for a representative room and got the tutorial anyway.
  // Say so BEFORE the ratios, because every number below would then be a
  // property of the onboarding ramp wearing the difficulty table's name.
  fail('the fixture landed on the ONBOARDING node despite selecting against it — the ratios below measure the tutorial ramp, not difficulty');
} else ok('the fixture is measuring a representative room, not the onboarding node');

if (base.count > 0 && base.kills > 20) ok(`baseline room fielded ${base.count} enemies at ${base.hp.toFixed(1)} HP and the fixture killed ${base.kills} — the payout ratios below have a sample`);
else fail(`baseline fielded ${base.count} enemies and killed ${base.kills}; every ratio below would be noise`);

console.log('\n  setting     fielded  avg HP  avg dmg   kills   gold/kill   xp/kill   banked');
console.log('  -------     -------  ------  -------   -----   ---------   -------   ------');
const rows = [];
for (const d of DIFFICULTIES) {
  const r = d.id === DEFAULT_DIFFICULTY ? base : room(d.id, SEED);
  rows.push({ d, r });
  console.log(`  ${d.name.padEnd(11)} ${String(r.count).padStart(7)}  ${r.hp.toFixed(1).padStart(6)}  ${r.dmg.toFixed(2).padStart(7)}  ${String(r.kills).padStart(6)}   ${r.gold.toFixed(3).padStart(9)}   ${r.xpPerKill.toFixed(3).padStart(7)}   ${String(r.banked).padStart(6)}`);
}
console.log('');

// ---- the four axes that MUST move, and in the declared direction ----
for (const { d, r } of rows) {
  if (d.id === DEFAULT_DIFFICULTY) {
    const flat = Math.abs(r.hp / base.hp - 1) < 1e-9 && Math.abs(r.count / base.count - 1) < 1e-9;
    if (flat) ok(`${d.name} is exactly 1.0 on every axis, as §4.1 requires of the baseline`);
    else fail(`${d.name} is the baseline and does not equal itself — the fixture is not deterministic`);
    continue;
  }
  for (const [axis, got, want] of [
    ['density', r.count / base.count, d.density],
    ['HP', r.hp / base.hp, d.hp],
    ['damage', r.dmg / base.dmg, d.dmg],
    ['gold', r.gold / base.gold, d.gold],
  ]) {
    // Direction is absolute; magnitude gets a band, because spawn tables and
    // integer rounding sit between a multiplier and a measurement.
    const rightSide = want > 1 ? got > 1 : got < 1;
    const close = Math.abs(got - want) / want <= 0.25;
    if (rightSide && close) ok(`${d.name}: ${axis} ×${got.toFixed(2)} (table says ×${want})`);
    else if (!rightSide) fail(`${d.name}: ${axis} ×${got.toFixed(2)} moved the WRONG WAY — the table says ×${want}. A setting that does not change the fight is not a setting`);
    else fail(`${d.name}: ${axis} ×${got.toFixed(2)} is more than 25% off the table's ×${want}`);
  }
}

// ---- the axis that must NOT move ----
//
// §4.1: "XP is never scaled by difficulty." Asserted at load against the table
// and never once observed in a fight.
//
// THE DENOMINATOR IS THE WHOLE ARGUMENT. A harder setting legitimately fields
// more enemies and therefore pays more total XP — that is density, not an XP
// multiplier, and §4.1 permits it. And XP per material banked is NOT the
// invariant either: the gold multiplier now adds materials that carry no XP, so
// that rate falls on harder settings BY DESIGN and an assertion on it fails on
// a working game. The quantity §4.1 fixes is experience per enemy killed.
{
  const rates = rows.map(({ d, r }) => [d.name, r.xpPerKill]);
  const lo = Math.min(...rates.map(x => x[1])), hi = Math.max(...rates.map(x => x[1]));
  const spread = hi / Math.max(1e-9, lo) - 1;
  // A 10% band, not exact equality: the settings field different densities and
  // therefore slightly different enemy MIXES, and enemy types carry different
  // base material values. What must not appear is a multiplier's worth of
  // difference tracking the ladder.
  if (spread <= 0.10) ok(`XP per kill is flat across all four settings (${rates.map(([n, v]) => `${n} ${v.toFixed(2)}`).join(', ')}) — §4.1's exclusion holds in the fight, not just in the table`);
  else fail(`XP per kill varies by ${(spread * 100).toFixed(1)}% across settings (${rates.map(([n, v]) => `${n} ${v.toFixed(2)}`).join(', ')}) — difficulty is paying XP, and the hardest setting becomes the only correct choice`);

  // And the same claim once more, end to end: does the split survive the pickup
  // path? The kill path can label a material zero-XP and the pickup can still
  // pay for it. Harder settings must bank MORE materials per point of XP.
  const perXp = rows.map(({ d, r }) => [d.name, r.bankedXp > 0 ? r.banked / r.bankedXp : 0]);
  const hard = rows.find(({ d }) => d.gold > 1.2);
  const bse = rows.find(({ d }) => d.id === DEFAULT_DIFFICULTY);
  if (!rows.every(({ r }) => r.banked > 0 && r.bankedXp > 0)) {
    fail(`a setting banked nothing (${rows.map(({ d, r }) => `${d.name} ${r.banked}/${r.bankedXp.toFixed(0)}`).join(', ')}) — the end-to-end check cannot run`);
  } else if (hard && bse) {
    const hr = hard.r.banked / hard.r.bankedXp, br = bse.r.banked / bse.r.bankedXp;
    if (hr > br * 1.02) ok(`${hard.d.name} banks ${hr.toFixed(2)} materials per XP against ${bse.d.name}'s ${br.toFixed(2)} — the zero-XP extras are real in the player's pocket, not just in the drop`);
    else fail(`${hard.d.name} banks ${hr.toFixed(2)} materials per XP and ${bse.d.name} banks ${br.toFixed(2)} — the pickup path is paying XP for the gold multiplier's extras`);
  }
  if (VERBOSE) console.log(`    banked materials per XP: ${perXp.map(([n, v]) => `${n} ${v.toFixed(3)}`).join(', ')}`);
}

// ---- the ladder is monotonic IN THE FIGHT, not in the table ----
{
  const ordered = DIFFICULTIES.map(d => rows.find(r => r.d.id === d.id));
  let mono = true;
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].r.hp < ordered[i - 1].r.hp || ordered[i].r.count < ordered[i - 1].r.count) mono = false;
  }
  if (mono) ok(`the ladder is monotonic in the FIGHT: ${ordered.map(o => `${o.d.name} ${o.r.count}@${o.r.hp.toFixed(0)}`).join(' → ')}`);
  else fail(`the ladder is not monotonic in the fight: ${ordered.map(o => `${o.d.name} ${o.r.count}@${o.r.hp.toFixed(0)}`).join(' → ')} — two settings are the same choice`);
}

console.log(failures ? `\n${failures} DIFFICULTY GATE FAILURE(S)` : '\nEVERY DIFFICULTY SETTING CHANGES THE FIGHT, AND NONE OF THEM CHANGES XP');
process.exit(failures ? 1 : 0);
