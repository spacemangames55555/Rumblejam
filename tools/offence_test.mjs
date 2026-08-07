// Can a player kill anything? (§15 defect #11)
//
// WHY THIS DID NOT ALREADY EXIST. tools/sim_test.mjs clears every fight with
// nuke() — `sim.damageEnemy(e, 900, {owner: p})` on every enemy, every 240
// ticks. That is a debug kill standing in for the player, so the whole suite
// passes with a party that has no offence whatsoever, and it did: browser runs
// reported `damageDealt 0` and fights that never cleared while sim_test was
// green. A harness that kills the enemies for you cannot answer whether the
// player can.
//
// So this one never calls damageEnemy on the player's behalf. It puts a
// character in an arena, ticks real seconds, and reads what the PLAYER dealt.
//
// It walks EVERY SELECTABLE CLASS, never a sample. Selectability is derived
// from tree data, so a class becoming selectable enters this sweep with no edit
// here — and if it arrives without offence, this fails the moment it does. A
// sample would have covered the two that work and missed the one that broke.
//
// TWENTY SECONDS, NOT TWELVE. At 12 the two characters that CAN fight scored
// zero and this tool declared an engine failure — a threshold short enough to
// make a working thing look broken is the same defect as a missing counter,
// and it nearly sent the fix at the trigger core. A first-fight arena needs
// roughly this long for enemies to close and a cooldown-gated skill to fire
// more than once.
//
// Usage: node tools/offence_test.mjs [seconds]     (default 20)

import { Sim } from '../js/game.js';
import { CHARACTERS, SELECTABLE, isSelectable, unselectableReason } from '../js/content/characters.js';
import { SKILL_BY_ID, TREES_BY_CLASS, canLearn } from '../js/skills.js';

const SECONDS = parseInt(process.argv[2] || '20', 10);

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

// The opening pick a real player makes at level 1: the first ACTIVE their own
// trees allow, chosen with canLearn() — the same predicate the level-up screen
// uses, so this is the real choice set rather than a guess at one.
function openingPick(p) {
  const own = TREES_BY_CLASS[p.charId] || [];
  return Object.values(SKILL_BY_ID)
    .find(s => s.type === 'active' && own.includes(s.tree) && canLearn(p, s)) || null;
}

function fight(charId, { arm } = {}) {
  const sim = new Sim({ seed: 424242, party: [{ idx: 0, key: 'k', name: 'OFF', charId, color: '#fff' }] });
  const p = sim.players[0];
  const substituted = p.charId !== charId;
  let learned = null;
  if (arm) {
    const pick = openingPick(p);
    if (pick) { sim.uiAction(0, { kind: 'learnSkill', id: pick.id }); learned = pick.id; }
  }
  sim.uiAction(0, { kind: 'pickNode', nodeId: sim.reachableNodes()[0] });
  if (sim.phase !== 'arena') return { charId, substituted, err: 'never entered the arena' };
  let t = 0;
  while (sim.phase === 'arena' && !sim.over && t++ < SECONDS * 60) {
    sim.tick();
    // survivability is not the question — a corpse deals no damage either way
    for (const q of sim.players) if (!q.downed && !q.gone) q.hp = q.stats.vitality;
  }
  return {
    charId, substituted, learned,
    trees: (TREES_BY_CLASS[p.charId] || []).length,
    armed: p.loadout.filter(Boolean).join(',') || 'nothing',
    dealt: Math.round(p.damageDealt), kills: p.kills, cleared: sim.cleared,
  };
}

function sweep() {
  const ids = SELECTABLE.map(c => c.id);
  console.log(`--- every selectable class: ${ids.length} of ${CHARACTERS.length}, ${SECONDS}s each, opening pick spent ---`);
  if (!ids.length) { fail('no class is selectable — nobody can start a run at all'); return []; }
  const rows = ids.map(id => fight(id, { arm: true }));

  const subbed = rows.filter(r => r.substituted);
  if (subbed.length) fail(`${subbed.length} id(s) did not resolve to themselves: ${subbed.map(r => r.charId).join(', ')}`);

  const errored = rows.filter(r => r.err);
  const unarmed = rows.filter(r => !r.err && !r.learned);
  const mute = rows.filter(r => !r.err && r.learned && r.dealt === 0);

  console.log('  ' + rows.map(r => `${r.charId}:${r.err ? 'ERR' : r.dealt}`).join('  '));

  if (errored.length) fail(`${errored.length} selectable class(es) could not even reach a fight: `
    + errored.map(r => `${r.charId} (${r.err})`).join(', '));

  // SELECTABLE MEANS PLAYABLE. A class is offered because it has a tree; if that
  // tree cannot arm a level-1 character, the class is offered and unplayable —
  // exactly the state §15 defect #11 described, one class at a time instead of
  // a whole roster.
  if (unarmed.length) {
    fail(`${unarmed.length}/${rows.length} SELECTABLE class(es) cannot learn a tier-1 active, so a level-1 player `
      + `of them cannot attack: ${unarmed.map(r => r.charId).join(', ')}`);
  } else ok(`all ${rows.length} selectable class(es) can learn and auto-slot an opening active`);

  if (mute.length) {
    fail(`${mute.length}/${rows.length} armed class(es) still deal ZERO in ${SECONDS}s: `
      + mute.map(r => `${r.charId} (${r.learned})`).join(', '));
  } else ok(`all ${rows.length} selectable class(es) deal damage once armed`);

  // And the ones NOT yet selectable are named, so the gap is a number in the
  // log rather than something you notice when a player asks where the classes
  // went.
  const locked = CHARACTERS.filter(c => !isSelectable(c.id));
  if (locked.length) {
    console.log(`  ${locked.length} class(es) not yet selectable: ${locked.map(c => c.id).join(', ')}`);
    console.log(`  reason: ${unselectableReason(locked[0].id)}`);
  } else ok('every class in the roster is selectable');

  return rows;
}

// ---------- 1: can every selectable class fight ----------
const all = sweep();

// ---------- 2: the two that do work, prove the ENGINE is fine ----------
// Without this the result reads as "combat is broken", which would send the fix
// at the trigger core. It is not broken: where a tree exists, a character
// learns from it, auto-slots it, and kills things. What is missing is content.
console.log('\n--- where a tree exists, does the engine deliver ---');
{
  const armed = all.filter(r => r.learned && r.dealt > 0);
  if (!armed.length) {
    fail('NOT ONE character anywhere learns a skill and deals damage — this is an engine failure, not missing content');
  } else {
    for (const r of armed) console.log(`  ${r.charId}: learned ${r.learned}, armed with ${r.armed}, dealt ${r.dealt}, ${r.kills} kill(s)`);
    ok(`${armed.length} character(s) learn an active, auto-slot it and kill with it — the skill engine works, the trees are missing`);
  }
}

// ---------- 3: a retired or unplayable id throws, never substitutes ----------
// `CHAR_BY_ID[id] || CHAR_BY_ID.bulwark` is most of why #11 survived a patch:
// an id the roster did not have became bulwark, keeping the stats and losing
// the trees, silently. There is one roster now and nothing to fall back from.
console.log('\n--- an unknown or unplayable character throws instead of becoming someone else ---');
{
  const cases = [
    ['bulwark', /unknown character/, 'a retired classic id'],
    ['not_a_character', /unknown character/, 'a nonsense id'],
  ];
  const locked = CHARACTERS.find(c => !isSelectable(c.id));
  if (locked) cases.push([locked.id, /no skill tree/, 'a real but unplayable class']);
  for (const [id, pattern, what] of cases) {
    let threw = null;
    try { new Sim({ seed: 1, party: [{ idx: 0, key: 'k', name: 'X', charId: id, color: '#fff' }] }); }
    catch (e) { threw = e.message; }
    if (!threw) fail(`${what} ("${id}") started a run instead of throwing — silent substitution is how #11 stayed invisible`);
    else if (!pattern.test(threw)) fail(`${what} ("${id}") threw the wrong thing: ${threw.slice(0, 90)}`);
    else ok(`${what} ("${id}") is refused: ${threw.split('.')[0]}`);
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall offence checks passed');
process.exit(failures ? 1 : 0);
