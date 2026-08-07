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
// It also walks BOTH rosters. Weapons are gone, so skills are the only damage
// source; skills come from trees; trees are keyed by charId — and a charId from
// the wrong roster used to resolve silently to `bulwark`, giving a player the
// right stats with no trees and no way to notice. Testing one roster would have
// measured the substitution rather than the character.
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
import { CHARACTERS, ROSTER_IDS, setRoster } from '../js/content/characters.js';
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

function sweep(rosterId) {
  setRoster(rosterId);
  const ids = CHARACTERS.map(c => c.id);
  console.log(`\n--- roster "${rosterId}": ${ids.length} characters, ${SECONDS}s each, opening pick spent ---`);
  const rows = ids.map(id => fight(id, { arm: true }));

  const subbed = rows.filter(r => r.substituted);
  if (subbed.length) fail(`${subbed.length} id(s) in this roster did not resolve to themselves: ${subbed.map(r => r.charId).join(', ')}`);

  const treeless = rows.filter(r => !r.trees);
  const armedOk = rows.filter(r => r.learned);
  // A character with no tree can still show a nonzero number — reflect wards,
  // traits, hazards. That is damage the player did not AIM, and counting it as
  // offence would let a roster that cannot attack look half-functional. So the
  // offence check is scoped to characters that actually armed something.
  const mute = armedOk.filter(r => !r.err && r.dealt === 0);

  console.log('  ' + rows.map(r => `${r.charId}:${r.err ? 'ERR' : r.dealt}`).join('  '));
  console.log(`  ${armedOk.length}/${rows.length} could learn an active; ${rows.length - treeless.length}/${rows.length} have any tree at all`);

  if (treeless.length === rows.length) {
    fail(`roster "${rosterId}": NOT ONE of its ${rows.length} characters has a skill tree. Weapons are removed `
      + `(CONFIG.WEAPONS_ENABLED false, weaponSlots 0), so skills are the only damage source — this roster cannot fight at all.`);
  } else if (treeless.length) {
    fail(`roster "${rosterId}": ${treeless.length}/${rows.length} characters have no skill tree, so they have no damage source: `
      + treeless.map(r => r.charId).join(', '));
  } else ok(`roster "${rosterId}": every character has at least one tree`);

  if (!armedOk.length) {
    fail(`roster "${rosterId}": not one character could learn an active, so none of them has an attack. `
      + `Any nonzero number above is incidental — reflect, traits, hazards — not something the player aimed.`);
  } else if (mute.length) {
    fail(`roster "${rosterId}": ${mute.length}/${armedOk.length} armed characters still deal zero in ${SECONDS}s: `
      + mute.map(r => `${r.charId} (${r.learned})`).join(', '));
  } else ok(`roster "${rosterId}": all ${armedOk.length} character(s) that could arm themselves deal damage`);

  return rows;
}

// ---------- 1: can anyone in either roster fight ----------
const all = [];
for (const id of ROSTER_IDS) all.push(...sweep(id));

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

// ---------- 3: a wrong-roster id announces itself ----------
// The substitution is how #11 stayed invisible: a party member from the other
// roster silently became `bulwark`, keeping its stats and losing its trees.
console.log('\n--- an id from the wrong roster is not silently substituted ---');
{
  setRoster('classic');
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...a) => { warnings.push(a.join(' ')); };
  try { new Sim({ seed: 1, party: [{ idx: 0, key: 'k', name: 'X', charId: 'toh_samurai', color: '#fff' }] }); }
  finally { console.warn = realWarn; }
  const named = warnings.find(w => /not in the active roster/.test(w));
  if (!named) fail('a charId from the other roster was substituted with no warning — the player gets a character with no trees and nothing says so');
  else if (!/skill trees do NOT follow/i.test(named)) fail(`the warning fires but does not say the trees are lost: "${named}"`);
  else ok('a wrong-roster id warns, and says the trees do not follow');
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall offence checks passed');
process.exit(failures ? 1 : 0);
