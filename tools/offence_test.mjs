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
import * as SK_UI from '../js/skillsim.js';
import { learnableSkills, spendSkillPoint } from '../js/skillsim.js';

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

  // ------------------------------------------------------------------------
  // THE CHECK THAT WAS MISSING SINCE WEAPONS WERE REMOVED.
  //
  // Every assertion above spends the opening point first, because `fight()` is
  // called with `arm: true`. That models a player who has ALREADY made their
  // §5.6 choice, and it is the right fixture for "is the tree any good". It is
  // the wrong fixture for "can somebody play this game", and for as long as it
  // was the only one, the suite reported a healthy roster while a real new
  // character arrived on map 1 with nothing.
  //
  // §13 rule 17 is written about harnesses being UNDER-provisioned — a fixture
  // too poor to reach the thing it measures. This is the inverse and it is
  // strictly more dangerous, because under-provisioning fails loudly and
  // OVER-provisioning passes. `armBot` and every gate like it hands the fixture
  // a state the game never hands a player, and the gap between the two is
  // invisible by construction: nothing in the suite was measuring the
  // provisioning itself.
  //
  // So this runs the identical fixture with `arm: false` — no learned skill, no
  // lent tree, no point spent by the harness — and requires damage on map 1
  // from what THE GAME grants. It is deliberately the last word in this file.
  {
    // FIRST: IS THE CHOICE OFFERED AT ALL? §5.6 says the first point spent is
    // the opening ability, CHOSEN at character start. The floor below would make
    // the damage assertion pass even if no panel ever appeared, so the offer is
    // asserted separately — otherwise this gate would prove the safety net works
    // and say nothing about the mechanic it is a net for.
    const offered = [];
    for (const id of ids) {
      const sim = new Sim({ seed: 909, party: [{ idx: 0, key: 'k', name: 'N', charId: id, color: '#fff' }] });
      const p = sim.players[0];
      offered.push({ id, picks: (p.openingOffer || []).length, pts: p.skillPoints, ranks: Object.keys(p.skillRanks || {}).length });
    }
    const unoffered = offered.filter(o => o.picks === 0);
    if (!unoffered.length) {
      ok(`every class is OFFERED its §5.6 opening ability at character start — ${offered.map(o => `${o.id.replace('toh_', '')}:${o.picks}`).join(' ')} tier-1 picks, each holding ${offered[0].pts} unspent point and no learned ranks`);
    } else {
      fail(`${unoffered.length}/${offered.length} class(es) are never offered an opening ability: ${unoffered.map(o => o.id).join(', ')}. `
        + `The point is granted and nothing presents the choice, so it cannot be spent`);
    }

    // AND THEN: DOES THE PROVISIONING ACTUALLY ARM THEM? No pick answered by the
    // harness — this is the state a player reaches by doing nothing at all.
    const raw = ids.map(id => fight(id, { arm: false }));
    const silent = raw.filter(r => !r.err && r.dealt === 0);
    console.log(`  as the game provisions them (nothing spent): ${raw.map(r => `${r.charId.replace('toh_', '')}:${r.err ? 'ERR' : r.dealt}`).join('  ')}`);
    if (!silent.length) {
      ok(`and all ${raw.length} deal damage on map 1 AS THE GAME PROVISIONS THEM — no armBot, no lent tree, no point the harness spent. A player who answers nothing still arrives armed`);
    } else {
      fail(`${silent.length}/${raw.length} class(es) deal ZERO damage on map 1 as a real player receives them: ${silent.map(r => r.charId).join(', ')}. `
        + `Any class still dealing damage here is doing it on TRAIT damage rather than a skill`);
    }
  }

  // ------------------------------------------------------------------------
  // THE SKILL SCREEN'S DATA REACHES A CLIENT, and §5.5 is enforced by the SIM.
  //
  // The screen is PULL: a player opens it whenever they like, so unlike a boon
  // it cannot be handed its contents in the event that opens it — it renders
  // `getMeta`. A field missing there is a screen that renders a blank build, and
  // nothing else in the suite reads that payload.
  {
    const sim = new Sim({ seed: 5150, party: [{ idx: 0, key: 'k', name: 'S', charId: ids[0], color: '#fff' }] });
    const p = sim.players[0];
    const m = sim.getMeta(p);
    const need = ['skillPoints', 'skillRanks', 'loadout', 'skillSlots', 'canSlot'];
    const absent = need.filter(k => m[k] === undefined);
    if (!absent.length) {
      ok(`the build rides the meta channel: ${need.join(', ')} — ${m.skillPoints} point(s), ${m.skillSlots} slot(s), canSlot=${m.canSlot}. A pull-open screen renders what is already on the client, so a field missing here is a blank tree`);
    } else fail(`getMeta omits ${absent.join(', ')} — the skill screen has no way to render them, and no other check reads this payload`);

    // §5.5, ASSERTED ON THE HOST. The screen greys the slot row mid-fight, but a
    // client can send anything; the rule has to bite in `setLoadout` or it is
    // decoration. Both directions, because "always refuses" would pass a
    // one-sided check and break the game.
    sim.uiAction(0, { kind: 'pickNode', nodeId: sim.reachableNodes()[0] });
    const learned = Object.keys(p.skillRanks).find(k => p.skillRanks[k] > 0);
    const inFight = SK_UI.setLoadout(sim, p, 0, learned || null);
    sim.cleared = true;
    const afterFight = SK_UI.setLoadout(sim, p, 0, learned || null);
    if (!inFight.ok && afterFight.ok) {
      ok(`§5.5 is enforced by the sim, not the screen: a slot change is refused mid-fight ("${inFight.reason}") and accepted once the room is cleared`);
    } else fail(`§5.5 slot gating is wrong: mid-fight ok=${inFight.ok} (want false), cleared ok=${afterFight.ok} (want true)`);

    // And the host's own answer to "may I slot right now" must agree with it —
    // the screen reads `canSlot` off meta rather than re-deriving the rule, so a
    // disagreement is a screen that lies in one direction or the other.
    sim.cleared = false;
    const saysNo = sim.getMeta(p).canSlot;
    sim.cleared = true;
    const saysYes = sim.getMeta(p).canSlot;
    if (saysNo === false && saysYes === true) ok('and `meta.canSlot` agrees with it in both directions — the screen is told the answer rather than computing a second copy of the rule');
    else fail(`meta.canSlot disagrees with setLoadout: mid-fight ${saysNo} (want false), cleared ${saysYes} (want true)`);
  }

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

// ---------- 4: can an armed party finish an objective? (§15 defect #13) ----------
// THE TABLE THAT FOUND IT. An armed necromancer scored 4230 damage and ZERO
// kills in Elite Arena, 311 kills and 0 of 5 marks in Bounty Hunt, and 22 kills
// with 3 of 3 nests untouched — because every trigger selected by position or
// health fraction and chaff is always nearest. `select` is the fix; this is the
// measurement that has to confirm it, in the same shape.
//
// The party is STEERED at the objective, because the harness that found this
// steers and a bot standing still can never bring a nest into range no matter
// what its skills select. Selection and reach are different questions.
console.log('\n--- an armed party against the three objectives that failed ---');
{
  const steer = g => {
    const o = g.obj;
    if (!o) return;
    for (const p of g.players) {
      if (p.gone || p.downed) continue;
      let goal = null;
      if (o.type === 'bounty' && o.markId !== null) { const e = g.enemyById(o.markId); if (e) goal = [e.x, e.y]; }
      else if (o.type === 'nest' && o.at && o.at.length) goal = [o.at[0][0], o.at[0][1]];
      if (!goal) { g.setInput(p.idx, { mx: 0, my: 0 }); continue; }
      const dx = goal[0] - p.x, dy = goal[1] - p.y, d = Math.hypot(dx, dy) || 1;
      g.setInput(p.idx, d < 90 ? { mx: 0, my: 0 } : { mx: dx / d, my: dy / d });
    }
  };
  // BOTH PARTY SIZES. Objectives are co-op content and this table was solo, so
  // "cannot finish in budget" could not be told apart from "cannot finish
  // alone". Nest Purge and Elite Arena clear at 4p; Bounty does not, and the
  // gap is the escort wall that §15 already resolved as design.
  //
  // The party arrives at ARRIVE_LEVEL, not level 1. spendSkillPoint auto-slots
  // only into an already-unlocked slot and setLoadout refuses mid-fight, so a
  // party dropped in at level 1 fights the whole objective with ONE skill. That
  // single detail is what made these read as an HP problem: at three slots,
  // Nest Purge goes from 1/3 to CLEARED and Elite Arena solo from 0 kills to
  // cleared, with no tuning changed anywhere.
  const ARRIVE_LEVEL = 12;   // the third loadout slot; SLOT_LEVELS = [1, 5, 12, …]
  const rows = [];
  for (const [kind, n] of [['nest', 1], ['nest', 4], ['elite_arena', 1], ['elite_arena', 4], ['bounty', 1], ['bounty', 4]]) {
    const ids = SELECTABLE.map(c => c.id);
    const sim = new Sim({ seed: 20250811 + kind.length * 31,
      party: Array.from({ length: n }, (_, i) => ({ idx: i, key: 'k' + i, name: 'P' + i, charId: ids[i % ids.length], color: '#fff' })) });
    const node = sim.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
    node.kind = kind;
    sim.god = true;   // survival is not the question; finishing the level is
    if (kind === 'bounty') sim.selLog = new Map();   // selection is the assertion here
    for (const p of sim.players) {
      p.level = ARRIVE_LEVEL;   // unlock the slots BEFORE spending; see above
      for (let i = 0; i < 60; i++) {
        const learnable = learnableSkills(p);
        if (!learnable.length) break;
        p.skillPoints++;
        spendSkillPoint(sim, p, learnable.sort((a, b) => b.tier - a.tier)[0].id);
      }
      sim._applyPerm(p, { ferocity: 40, tempo: 15, vitality: 30 });
    }
    sim._travelTo(node.id);
    const budget = 60 * 60 * (kind === 'bounty' ? 20 : 6);
    let t = 0;
    while (!sim.cleared && !sim.over && t++ < budget) {
      steer(sim); sim.tick();
      for (const p of sim.players) if (!p.downed) p.hp = p.stats.vitality;
    }
    const o = sim.obj || {};
    // BOUNTY IS ASSERTED ON SELECTION, NOT KILLS — resolved as design (GDD §15).
    // Marks spawn with an escort and escorts are a wall you clear first; that is
    // what makes a mark different from a nest. Punching straight through needs
    // pierce, which is a §9.2 modifier item and does not exist until phase 4.
    // Asserting mark kills here would demand a capability the game has not
    // shipped, and would quietly turn into a retune request on mark HP.
    // SCOPED TO THE SKILLS THAT CLAIM TO TARGET OBJECTIVES. At one loadout slot
    // every fire came from an objective_target skill and a flat ratio worked;
    // at three slots the party also fires densest_cluster skills, which pick
    // chaff BY DESIGN and correctly. Counting those as misses read as an 86%
    // "regression" in a selector that had not changed at all.
    // SCOPED TWICE, and both scopes were learned the hard way. First to skills
    // that actually declare `objective_target` — a densest_cluster skill
    // correctly picking chaff is not a regression. Then to fires where a mark
    // was IN RANGE: a selector cannot choose what it cannot see, and counting
    // those fires made the ratio a measure of party positioning rather than of
    // selection.
    const objFires = [...(sim.selLog || new Map())]
      .filter(([k]) => (SKILL_BY_ID[k.split('->')[0]] || {}).select === 'objective_target')
      .filter(([k]) => k.endsWith('|markInRange'));
    const selMark = objFires.filter(([k]) => /->MARK\|markInRange$/.test(k)).reduce((n, [, v]) => n + v, 0);
    const selTotal = objFires.reduce((n, [, v]) => n + v, 0);
    const progress = kind === 'nest' ? `${(o.total || 0) - (o.alive || 0)}/${o.total || 0} nests down`
      : kind === 'bounty' ? `${selMark}/${selTotal} objective-targeting fires chose the mark (kills: ${o.killed || 0}/${o.need || 0}, needs pierce)`
        // NOT "kills of total": p.kills counts chaff too, and printing it against
        // the elite count read as "78 of 52 elites", which is both impossible and
        // exactly the kind of number a reader would quote back.
        : (sim.cleared ? `all ${o.total || 0} elites` : `${o.total || 0} elites spawned, arena not cleared`);
    const dealt = Math.round(sim.players.reduce((n, p) => n + p.damageDealt, 0));
    const kills = sim.players.reduce((n, p) => n + p.kills, 0);
    const slots = Math.max(...sim.players.map(q => q.loadout.filter(Boolean).length));
    rows.push({ kind, n, dealt, kills, progress, cleared: sim.cleared, selMark, selTotal, slots });
    console.log(`  ${kind.padEnd(12)} ${n}p  dealt ${String(dealt).padStart(6)}  kills ${String(kills).padStart(4)}  `
      + `${slots} slot(s)  ${progress}${sim.cleared ? '  CLEARED' : ''}`);
  }

  // THE ASSERTION IS "SOMETHING GOT TARGETED", not "the level finished". Whether
  // one tier-1 skill can chew through a 3x-HP elite inside six minutes is a
  // question about elite HP, and answering it here would let a throughput
  // change silently satisfy a targeting test.
  // 4p is the target for objectives; solo is not, and saying so is the point of
  // running both.
  for (const kind of ['nest', 'elite_arena']) {
    const four = rows.find(r => r.kind === kind && r.n === 4);
    if (!four) continue;
    if (four.cleared) ok(`${kind}: a 4-player party clears it (${four.slots} slots) — co-op is the target, solo is not`);
    else fail(`${kind}: a 4-player armed party did not clear it — ${four.progress}. That is a throughput question, and the party size it is designed for is now on the table`);
  }
  const bounty = rows.find(r => r.kind === 'bounty' && r.n === 4);
  if (bounty) {
    // Every fire should choose the mark. If that ratio drops, the selector has
    // regressed — which is a real defect, unlike the mark surviving its escort.
    // NOT 100%. Bounty Hunt runs FIVE marks in sequence and each is on a spawn
    // timer, so there are windows with no mark on the field at all — a fire in
    // one of those correctly selects chaff, because there is nothing else. The
    // measured miss count is ~1% and matches the number of fires those gaps can
    // hold. A genuine selector regression does not shave a percent off this; it
    // collapses it, because chaff outnumbers the mark by two orders of
    // magnitude and `nearest` would pick chaff essentially always.
    const MARK_SELECT_FLOOR = 0.9;
    const ratio = bounty.selTotal ? bounty.selMark / bounty.selTotal : 0;
    if (!bounty.selTotal) fail('bounty: nothing fired at all, so selection cannot be judged');
    else if (ratio < MARK_SELECT_FLOOR) {
      fail(`bounty: only ${bounty.selMark}/${bounty.selTotal} objective-targeting fires (${(ratio * 100).toFixed(0)}%) chose the mark — `
        + `objective_target has regressed; below ${MARK_SELECT_FLOOR * 100}% means it is picking by proximity again`);
    } else {
      ok(`bounty: ${bounty.selMark}/${bounty.selTotal} objective-targeting fires (${(ratio * 100).toFixed(1)}%) chose the mark — `
        + `the rest fall in the gaps between the five marks. It survives its escort by design; pierce is a phase-4 item`);
    }
  }
  const others = rows.filter(r => r.kind !== 'bounty' && r.n === 4);
  const untouched = others.filter(r => /^0\//.test(r.progress) || (!r.cleared && r.kind === 'elite_arena' && !r.kills));
  if (untouched.length === others.length) {
    fail('not one objective target was damaged — `select` is not reaching the role-tagged entities at all');
  } else if (untouched.length) {
    fail(`${untouched.length}/${others.length} objective(s) still show zero progress: ${untouched.map(r => r.kind).join(', ')} `
      + '— report whether that is selection or throughput before changing either');
  } else ok(`every objective shows progress: ${others.map(r => `${r.kind} ${r.progress}`).join('; ')}`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall offence checks passed');
process.exit(failures ? 1 : 0);
