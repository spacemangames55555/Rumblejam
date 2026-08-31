// THE THREAT GATE — does anything actually REDIRECT an enemy?
//
//   node tools/threat_gate.mjs
//
// WRITTEN BEFORE THE FIX, DELIBERATELY. `rider_gate` already claimed to cover
// `taunt`, and its probe reads `e.tauntT` — the field the rider writes. A rider
// that writes a timer nobody consults passes that check forever, which is
// exactly what happened: `e.tauntT` is written at compose.js and decremented in
// skillsim.js and READ BY NOTHING, while seven skills across four classes print
// "Also taunt X.Xs" to the player.
//
// So this gate asserts the CONSEQUENCE — that `tauntTarget` returns someone
// different — and it proves it can see one before it asks for one:
//
//   1. THE CONTROL. The Mirage decoy is a real, working redirect that predates
//      this work. If the gate cannot detect the decoy, the gate is broken and
//      every other result here is worthless.
//   2. THE NEGATIVE CONTROL. With nothing taunting, the nearest player wins.
//      Without this a gate that always reported "redirected" would pass (1).
//   3. THE ASSERTION. A taunt must redirect. This FAILS before the fix.
//
// A marker check cannot be strengthened into an effect check by trying harder:
// it has to ask a different question, and the question is "who does the enemy
// aim at now".

import { FixtureSim } from './fixture_sim.mjs';
import { spawnMinions, summonSlotsFor } from '../js/minions.js';
import { SKILL_BY_ID } from '../js/skills.js';

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

function arena(charId = 'toh_necromancer') {
  const sim = new FixtureSim({ seed: 7, regionIndex: 1, allowUnplayable: true,
    party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const d1 = sim.floor.nodes.filter(n => n.depth === 1);
  sim._travelTo((d1.find(n => n.mix === 'horde') || d1[0]).id);
  for (let i = 0; i < 600 && sim.enemyPool.count === 0; i++) sim.tick();
  return { sim, p: sim.players[0], e: [...sim.enemyPool][0] };
}
// Names whatever tauntTarget returned, so a failure says WHO rather than [object].
const who = (t, p) => t === null || t === undefined ? 'nothing'
  : t === p ? 'the player' : t.minion || t.arch ? `a minion (${t.arch || '?'})` : t.tauntR !== undefined ? 'a decoy' : 'something else';

// ---- 1. THE CONTROL: a decoy redirects, and this gate can see it ----------
{
  const { sim, p, e } = arena();
  if (!e) { fail('no enemy spawned — the gate cannot measure targeting without one'); }
  else {
    p.x = 200; p.y = 200; e.x = 1400; e.y = 900;
    const before = sim.tauntTarget(e.x, e.y, e);
    sim.decoys.push({ x: e.x + 30, y: e.y + 30, t: 5, dur: 5, tauntR: 300, owner: p.idx, burst: 0, radius: 12 });
    const after = sim.tauntTarget(e.x, e.y, e);
    if (before === p && after !== p && after !== null) {
      ok(`CONTROL: a Mirage decoy redirects the enemy — ${who(before, p)} -> ${who(after, p)}. This gate can detect a real redirect.`);
    } else {
      fail(`CONTROL FAILED: decoy did not redirect (${who(before, p)} -> ${who(after, p)}). `
        + 'Every other result in this gate is worthless until this passes — it is the proof the check works.');
    }
  }
}

// ---- 2. THE NEGATIVE CONTROL: nothing taunting, nearest player wins -------
{
  const { sim, p, e } = arena();
  if (e) {
    p.x = 500; p.y = 500; e.x = 520; e.y = 520;
    const t = sim.tauntTarget(e.x, e.y, e);
    if (t === p) ok('NEGATIVE CONTROL: with nothing taunting, the enemy aims at the nearest player');
    else fail(`NEGATIVE CONTROL: an untaunted enemy aimed at ${who(t, p)}, not the player — `
      + 'this gate would report "redirected" for everything');
  }
}

// ---- 3. THE ASSERTION: a taunt on the enemy must redirect it --------------
// Written the way compose.js writes it, through the real rider path.
{
  const { sim, p, e } = arena();
  if (e) {
    p.x = 200; p.y = 200; e.x = 1400; e.y = 900;
    const SKEL = 'necro_summon_skeleton';
    p.skillRanks = { [SKEL]: 3 };
    p.summonSlots = summonSlotsFor(p, p.skillRanks, SKILL_BY_ID);
    spawnMinions(sim, p, SKILL_BY_ID[SKEL], SKILL_BY_ID[SKEL].compose[0], 3);
    const m = p.minions[0];
    if (!m) { fail('no skeleton spawned — cannot test a minion taunt'); }
    else {
      m.x = e.x + 20; m.y = e.y + 20;                 // the skeleton is right there
      const before = sim.tauntTarget(e.x, e.y, e);
      applyTaunt(sim, e, m, 2.5);
      const after = sim.tauntTarget(e.x, e.y, e);
      if (after === m) ok(`a taunting SKELETON pulls the enemy off the player — ${who(before, p)} -> ${who(after, p)}`);
      else fail(`the taunt rider does not redirect: enemy still aims at ${who(after, p)}. `
        + `\`e.tauntT\` is set (${e.tauntT}) and nothing reads it — the seven skills printing "Also taunt X.Xs" are describing a mechanic that does not run`);

      // and it must LAPSE
      e.tauntT = 0; e.tauntBy = null;
      const lapsed = sim.tauntTarget(e.x, e.y, e);
      if (lapsed === p) ok('the taunt lapses — the enemy returns to the player when it expires');
      else fail(`a lapsed taunt still holds the enemy on ${who(lapsed, p)}`);
    }
  }
}

// ---- 4. a taunt pointing at a DEAD minion must not strand the enemy -------
{
  const { sim, p, e } = arena();
  if (e) {
    p.x = 300; p.y = 300; e.x = 1400; e.y = 900;
    const SKEL = 'necro_summon_skeleton';
    p.skillRanks = { [SKEL]: 2 };
    p.summonSlots = summonSlotsFor(p, p.skillRanks, SKILL_BY_ID);
    spawnMinions(sim, p, SKILL_BY_ID[SKEL], SKILL_BY_ID[SKEL].compose[0], 2);
    const m = p.minions[0];
    if (m) {
      m.x = e.x + 20; m.y = e.y + 20;
      applyTaunt(sim, e, m, 5);
      p.minions.length = 0;                            // it died
      const t = sim.tauntTarget(e.x, e.y, e);
      if (t === p) ok('a taunt held by a dead minion falls through to the player rather than stranding the enemy');
      else fail(`an enemy taunted by a dead minion aims at ${who(t, p)} — a dangling reference holds it forever`);
    }
  }
}

// ---- 5. END TO END: the enemy walks over, hurts it, and kills it ---------
// The redirect is only half the feature. This drives real ticks and checks that
// a taunted enemy CLOSES on the skeleton and that the skeleton bleeds for it.
{
  const { sim, p, e } = arena();
  if (e) {
    const SKEL = 'necro_summon_skeleton';
    p.skillRanks = { [SKEL]: 3 };
    p.summonSlots = summonSlotsFor(p, p.skillRanks, SKILL_BY_ID);
    spawnMinions(sim, p, SKILL_BY_ID[SKEL], SKILL_BY_ID[SKEL].compose[0], 3);
    const m = p.minions[0];
    if (!m) { fail('no skeleton for the end-to-end check'); }
    else {
      // player far away, skeleton between the enemy and nothing
      p.x = 120; p.y = 120;
      e.x = 1500; e.y = 900;
      m.x = 1300; m.y = 900;
      const d0 = Math.hypot(e.x - m.x, e.y - m.y);
      const hp0 = m.hp;
      let closest = d0;
      for (let t = 0; t < 60 * 30; t++) {
        e.tauntT = 5; e.tauntBy = m;              // held, as a skeleton swinging would
        // PINNED. The skeleton is `move: 'chase'` and walks off on its own, so
        // an unpinned "distance closed" measures the MINION approaching the
        // enemy — the opposite of what this check claims to prove.
        m.x = 1300; m.y = 900;
        if (!e.active) break;
        sim.tick();
        closest = Math.min(closest, Math.hypot(e.x - m.x, e.y - m.y));
        if (m.dead || m.hp < hp0) break;
      }
      const d1 = closest;
      if (d1 < d0) ok(`the taunted enemy CLOSES on a pinned skeleton: ${Math.round(d0)}u -> ${Math.round(d1)}u at nearest`);
      else fail(`the taunted enemy did not approach the skeleton (${Math.round(d0)}u -> ${Math.round(d1)}u) — the redirect changes aim but not movement`);
      if (m.hp < hp0 || m.dead) ok(`the skeleton takes the hit: ${Math.round(hp0)} HP -> ${m.dead ? 'dead' : Math.round(m.hp)}`);
      else fail(`the skeleton stood in contact and lost nothing (${Math.round(hp0)} HP) — enemies still cannot hurt a minion`);
      if (Math.round(p.hp) === Math.round(p.stats.vitality)) ok('and the player, far away, was never touched');
      else console.log(`  (note: player hp ${Math.round(p.hp)}/${Math.round(p.stats.vitality)} — something else in the room reached them)`);
    }
  }
}

// ---- 6. KILL ATTRIBUTION still flows to the owner ------------------------
// Breaking the owner-aliasing for DEFENCE must not break it for offence.
{
  const { sim, p, e } = arena();
  if (e) {
    const SKEL = 'necro_summon_skeleton';
    p.skillRanks = { [SKEL]: 2 };
    p.summonSlots = summonSlotsFor(p, p.skillRanks, SKILL_BY_ID);
    spawnMinions(sim, p, SKILL_BY_ID[SKEL], SKILL_BY_ID[SKEL].compose[0], 2);
    const m = p.minions[0];
    if (m) {
      const kills0 = p.kills, dealt0 = p.damageDealt;
      for (let t = 0; t < 60 * 25 && sim.enemyPool.count; t++) {
        const tgt = [...sim.enemyPool][0];
        if (tgt) { m.x = tgt.x; m.y = tgt.y; }
        sim.tick();
        if (p.kills > kills0) break;
      }
      if (p.damageDealt > dealt0) ok(`a skeleton's damage is still credited to its owner (+${Math.round(p.damageDealt - dealt0)})`);
      else fail('the skeleton dealt no damage the owner was credited for — the offensive facade broke');
    }
  }
}

// How compose.js's `taunt` rider marks an enemy. Kept here so the gate does not
// depend on the shape of the write — if the engine changes how it records a
// taunt, this is the one line to update.
function applyTaunt(sim, e, src, secs) {
  e.tauntT = Math.max(e.tauntT || 0, secs);
  e.tauntBy = src;
  e.tauntIdx = src && src.idx !== undefined ? src.idx : undefined;
}

console.log(failures ? `\n${failures} THREAT GATE FAILURE(S)` : '\nA TAUNT REDIRECTS THE ENEMY THAT RECEIVED IT');
process.exit(failures ? 1 : 0);
