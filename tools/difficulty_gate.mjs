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
import { DIFFICULTIES, DEFAULT_DIFFICULTY, difficultyOf } from '../js/worldmap.js';
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
  // `shrine` joins the list of things that are not a room: §2.4's shrine has no
  // combat and no arena template, so treating it as a fight builds nothing.
  const eligible = g.floor.nodes.filter(x => !['shop', 'treasure', 'shrine', 'siege'].includes(x.kind));
  return eligible.find(x => !isOnboardingNode(g.regionIndex, x)) || null;
}

// THE WINDOW IS A PARAMETER, AND THE TWO QUESTIONS NEED DIFFERENT ONES.
//
// The LADDER axes — enemies fielded, HP, damage — are cumulative counts, so
// they are only comparable across settings on an IDENTICAL window. The XP
// RATIO is a per-kill quantity, and it needs a big enough denominator to mean
// anything: XP per kill is quantised by the integer XP a material carries, so
// on a short window a soft setting lands cents away from flat by rounding.
//
// Running one window for both is what broke this. At Gentle's half density the
// shared 60s window produced **12 kills against Standard's 50**, and the
// flatness check reported a 20.5% spread with nothing scaling XP at all — the
// sample had collapsed (§13 rule 66: out of band under one reading is the
// instrument). Scaling the window per setting fixed the ratio and immediately
// broke all four ladder checks, because a longer run fields more enemies.
//
// So: the ladder runs the fixed window, and the XP pass runs a long one that is
// the SAME for every setting. Different questions, different fixtures.
function room(difficultyId, seed, seconds = SECONDS) {
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
  for (let t = 0; t < 60 * seconds; t++) {
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

// The floor is on the FIELDED count, not on the kill count. What the ratios
// below need is a room with enemies in it; how many of them one bot with a
// fixed loadout can kill in 60s is a statement about the bot, and region 1's
// roster is tougher than the base chaff the number was set against — 20 kills
// of 55 fielded, where floor 1's skulkers and flits gave more. Asserting the
// bot's throughput here made a difficulty gate fail for a reason that has
// nothing to do with difficulty.
if (base.count > 20 && base.kills > 5) ok(`baseline room fielded ${base.count} enemies at ${base.hp.toFixed(1)} HP and the fixture killed ${base.kills} — the payout ratios below have a sample`);
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
  // A 10% band, not exact equality: the settings field different densities and
  // therefore slightly different enemy MIXES, and enemy types carry different
  // base material values. What must not appear is a multiplier's worth of
  // difference tracking the ladder.
  // THE SAMPLE GROWS ACROSS ROOMS, NOT ACROSS TIME — and the advice this gate
  // used to give itself was wrong for the structure it measures.
  //
  // "Lengthen the window" assumes a room keeps producing enemies. It does not:
  // a horde arena is a TIMED WAVE with a fixed total, so past the wave's
  // duration every extra second adds zero kills. Measured, ×4 and ×6 windows
  // both returned Gentle 22-23 kills — the window was never the binding
  // constraint, and quadrupling it only made the gate slower at being wrong.
  //
  // Rooms are what add enemies. Each seed rolls a different arena from the same
  // setting, so summing over ROOMS grows the denominator without changing what
  // is being asked.
  const XP_ROOMS = 5;
  const xpRows = DIFFICULTIES.map(d => {
    const runs = Array.from({ length: XP_ROOMS }, (_, i) => room(d.id, SEED + i * 7919, SECONDS * 2))
      .filter(r => !r.noRoom);
    if (!runs.length) return { d, r: { noRoom: true } };
    const kills = runs.reduce((a, r) => a + r.kills, 0);
    const xp = runs.reduce((a, r) => a + r.xpPerKill * r.kills, 0);
    return { d, r: { kills, xpPerKill: kills ? xp / kills : 0, rooms: runs.length } };
  }).filter(x => !x.r.noRoom);
  const rates = xpRows.map(({ d, r }) => [d.name, r.xpPerKill]);
  const lo = Math.min(...rates.map(x => x[1])), hi = Math.max(...rates.map(x => x[1]));
  const spread = hi > 0 ? (hi - lo) / hi : 0;
  const thin = xpRows.filter(({ r }) => r.kills < 25).map(({ d, r }) => `${d.name} ${r.kills}`);
  if (thin.length) fail(`too few kills to read a ratio on: ${thin.join(', ')} — XP per kill is quantised by the `
    + `integer XP a material carries, so a thin row lands cents away from flat and reads as a defect. `
    + `Lengthen the window before believing the number`);
  else ok(`every setting fielded a readable sample over ${XP_ROOMS} rooms (${xpRows.map(({ d, r }) => `${d.name} ${r.kills}`).join(', ')} kills)`);
  if (spread <= 0.10) ok(`XP per kill is flat across all settings (${rates.map(([n, v]) => `${n} ${v.toFixed(2)}`).join(', ')}) — §4.1's exclusion holds in the fight, not just in the table`);
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

// ---- REACHABLE BY A PLAYER (§13 rule 54) ----------------------------------
//
// Everything above proves the ladder WORKS. None of it proves anybody can
// choose a rung, and for five phases nobody could: `DIFFICULTIES` was a table,
// `difficultyOf` read it, and **`app.lobby.difficulty` was assigned by nothing
// in the codebase.** Every run ever played resolved to Standard through the
// fallback, and a player looking for an easier setting found a lobby with two
// buttons on it. Reported from play, and this gate had been green throughout —
// the third time a working system has surfaced nowhere, after the §5.6 opening
// card and unspent skill points.
//
// So the last leg drives a real page. Three claims, and the first two can pass
// while the setting still does nothing: that the control EXISTS, that clicking
// it MOVES THE FIELD, and that the field reaches the SIM and changes the fight.
try {
  const { Page, bootHttpd, loadPeerjs, sleep, startRun } = await import('./cdp_harness.mjs');
  const peer = loadPeerjs();
  if (!peer) {
    console.warn('⚠ reachability leg SKIPPED — no local peerjs (set PEERJS_LOCAL).');
  } else {
    const PORT = 8600 + (process.pid % 97);
    bootHttpd(PORT);
    const P = await new Page('diff', 9791, peer).open();
    try {
      await P.goto(`http://localhost:${PORT}/index.html`);
      await P.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden')?1:0`, 10000, 'title');
      await P.exec(`document.getElementById('name-input').value='D'; document.getElementById('btn-host').click(); return 1;`);
      await P.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden')?1:0`, 8000, 'lobby');
      await sleep(400);

      const picks = await P.exec(`
        const b = [...document.querySelectorAll('#screen-lobby .diff-pick')];
        return { n: b.length, ids: b.map(x => x.dataset.diff),
                 on: b.filter(x => x.classList.contains('on')).map(x => x.dataset.diff),
                 // visible pixels, not just present in the DOM
                 area: b.reduce((a, x) => a + Math.round(x.getBoundingClientRect().width * x.getBoundingClientRect().height), 0) };`);
      if (picks.n === DIFFICULTIES.length && picks.area > 500) {
        ok(`the lobby offers all ${picks.n} settings (${picks.ids.join(', ')}), ${picks.area}px of them, with ${picks.on.join('/') || 'none'} selected`);
      } else fail(`the difficulty picker is not reachable in the lobby: ${JSON.stringify(picks)}`);

      // CLICK THE SOFTEST ONE, through the real handler.
      await P.exec(`const b = document.querySelector('#screen-lobby .diff-pick[data-diff="gentle"]'); if (b) b.click(); return 1;`);
      await sleep(400);
      const after = await P.exec(`return { field: String(window.uv.lobby && window.uv.lobby.difficulty),
        on: [...document.querySelectorAll('#screen-lobby .diff-pick.on')].map(x => x.dataset.diff).join(',') };`);
      if (after.field === 'gentle' && after.on === 'gentle') ok('clicking it moves the field AND the selection — app.lobby.difficulty = "gentle"');
      else fail(`clicking the picker did not take: ${JSON.stringify(after)} — the field this writes was unassigned for five phases, so an unwired button here is the same defect again`);

      // AND IT HAS TO REACH THE FIGHT. A lobby field that the run ignores is
      // the same class of defect one layer further on.
      await P.exec(`document.querySelector('.char-card:not([data-locked])').click(); return 1;`);
      await sleep(300);
      await startRun(P);
      await P.waitFor(`return window.uv.mode==='run' && !!window.uv.sim ?1:0`, 8000, 'run');
      await sleep(600);
      const inRun = await P.exec(`return String(window.uv.sim.difficulty);`);
      if (inRun === 'gentle') ok('and the run starts on it — sim.difficulty = "gentle", so the choice survives the lobby');
      else fail(`the lobby said gentle and the sim says "${inRun}" — the setting is chosen and discarded`);
    } finally { await P.close(); }
  }
} catch (e) { fail(`reachability leg could not run: ${e.message}`); }

console.log(failures ? `\n${failures} DIFFICULTY GATE FAILURE(S)` : '\nEVERY DIFFICULTY SETTING CHANGES THE FIGHT, AND NONE OF THEM CHANGES XP');
process.exit(failures ? 1 : 0);
