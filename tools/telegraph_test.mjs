// TELEGRAPHS, THROUGH THEIR REAL RUNTIME PATH.
//
//   node tools/telegraph_test.mjs
//
// Six claims from the spec, each driven through live ticks rather than by
// calling the state machine directly. Every case is staged from FOUR seeds and
// four positions: phase 1's sweep read five skills as "wired to nothing"
// because every case ran from one seed at one spot, next to a pillar that ate
// the projectile, and one arena is not a sample.

import * as CH from '../js/content/characters.js';
CH.setRoster('toh');
const { Sim } = await import('../js/game.js');
const SK = await import('../js/skillsim.js');
const { TELEGRAPH_STATES, TELEGRAPH_MIN_WINDUP_MS, TELEGRAPHED_IDS } = await import('../js/telegraphs.js');
const { inZone } = await import('../js/compose.js');
const { ENEMY_BY_ID } = await import('../js/content/enemies.js');

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

const SEEDS = [4242, 90210, 13337, 55555];
const SPOTS = [[0.5, 0.5], [0.32, 0.6], [0.68, 0.4], [0.45, 0.28]];

// A clean room: no architecture, no reinforcements, one attacker, one player.
function arena(seed, spot, enemyId, opts = {}) {
  const g = new Sim({ seed, party: [{ idx: 0, key: 'k', name: 'T', charId: 'toh_samurai', color: '#fff' }] });
  g.uiAction(0, { kind: 'pickNode', nodeId: g.reachableNodes()[0] });
  const p = g.players[0];
  for (const e of [...g.enemyPool]) g.enemyPool.release(e);
  g.spawnQueue.length = 0; g.wave.done = false;
  g.obstacles.length = 0;
  p.level = 66;
  p.x = g.W * spot[0]; p.y = g.H * spot[1];
  p.stats.reflex = 0;               // the Reflex roll is a separate mechanic; keep it out of the way
  const def = ENEMY_BY_ID[enemyId];
  const reach = def.telegraph.shape.radius || def.telegraph.shape.range || def.telegraph.shape.length;
  const e = g.spawnEnemyById(enemyId, p.x + reach * 0.35, p.y, { noMats: true });
  e.spd = 0; e.dmg = 0; e.maxHp = 9000; e.hp = 9000;
  if (opts.skills) for (const id of opts.skills) { for (let i = 0; i < 8; i++) { p.skillPoints++; SK.spendSkillPoint(g, p, id); } }
  p.loadout.fill(null);
  if (opts.slot) p.loadout[0] = opts.slot;
  return { g, p, e };
}

// Tick until the enemy commits, then hand control back.
function tickToCommit(g, p, e, hold) {
  for (let i = 0; i < 60 * 12; i++) {
    g.setInput(0, { mx: 0, my: 0 });
    if (hold) hold(i);
    g.tick();
    e.hp = e.maxHp;
    if (e.telState === TELEGRAPH_STATES.WINDUP) return true;
  }
  return false;
}

function run(label, enemyId, fn) {
  let pass = 0, staged = 0;
  const notes = [];
  for (let i = 0; i < SEEDS.length; i++) {
    const { g, p, e } = arena(SEEDS[i], SPOTS[i], enemyId, fn.opts || {});
    if (!tickToCommit(g, p, e)) { notes.push(`seed ${SEEDS[i]}: never committed`); continue; }
    staged++;
    const r = fn(g, p, e);
    if (r === true) pass++;
    else notes.push(`seed ${SEEDS[i]}: ${r}`);
  }
  if (!staged) { fail(`${label}: no seed produced a commit — the case never ran`); return; }
  if (pass === staged) ok(`${label} — ${pass}/${staged} seeds`);
  else fail(`${label}: ${pass}/${staged} seeds — ${notes.join(' | ')}`);
}

// ---------------------------------------------------------------- load gate

{
  const bad = TELEGRAPHED_IDS.filter(id => ENEMY_BY_ID[id].telegraph.windupMs < TELEGRAPH_MIN_WINDUP_MS);
  if (!bad.length) ok(`${TELEGRAPHED_IDS.length} telegraphed enemies, all at or above the ${TELEGRAPH_MIN_WINDUP_MS} ms floor: ${TELEGRAPHED_IDS.map(id => `${id} ${ENEMY_BY_ID[id].telegraph.windupMs}ms`).join(', ')}`);
  else fail(`below the reaction floor: ${bad.join(', ')}`);
}

// ---------------------------------------------------------------- the six

// 1. Stand in it and it hurts.
run('a player standing in a committed zone at RESOLVE takes damage', 'slabjaw', (g, p, e) => {
  // On the log, not on HP: standing still ACCRUES Footing, which raises max
  // Vitality, which can mask the hit entirely. HP is not a clean instrument
  // here in either direction.
  const logFrom = g.telDodgeLog.length;
  for (let i = 0; i < 120; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); e.hp = e.maxHp; if (e.telState === TELEGRAPH_STATES.RECOVER) break; }
  const mine = g.telDodgeLog.slice(logFrom).filter(d => d.p === 0);
  if (!mine.length) return 'the attack never resolved on this player at all';
  if (mine.every(d => d.dodged)) return 'counted as a dodge for a player who never moved';
  return true;
});

// 2. Leave it and you take none AND it counts as a dodge.
// NOT asserted on HP. Breaking stance drops the whole Footing stack, Footing
// carries max Vitality, and current HP is clamped to the new max — so a Samurai
// who dodges "loses HP" by an amount that has nothing to do with the attack.
// The telegraph log is the only honest record of whether the ATTACK landed.
run('leaving the zone during wind-up takes no damage and fires ON_DODGE', 'slabjaw', (g, p, e) => {
  const before = g.telStats.dodged;
  const logFrom = g.telDodgeLog.length;
  for (let i = 0; i < 120; i++) {
    g.setInput(0, { mx: -1, my: 0 });
    g.tick();
    e.hp = e.maxHp;
    if (e.telState === TELEGRAPH_STATES.RECOVER) break;
  }
  const mine = g.telDodgeLog.slice(logFrom).filter(d => d.p === 0);
  if (mine.some(d => !d.dodged)) return 'the attack landed on a player who left the zone';
  if (g.telStats.dodged <= before) return 'no dodge recorded';
  if (!(g.time - p.trigEvents.dodgeT < 1)) return 'ON_DODGE window never opened';
  return true;
});

// 3. Never in it: no damage, and NOT a dodge. Standing somewhere safe is not a
// skill and must not pay like one.
//
// This needs TWO players. A zone aims at whoever drew the commit, so the target
// is inside it by construction and cannot be staged as "never in it" — the
// honest version of the case is the ally standing across the room, who should
// get neither the damage nor the credit. My first attempt teleported the lone
// player out after the commit, which is a DODGE by the rule and correctly
// counted as one.
{
  let pass = 0, staged = 0;
  const notes = [];
  for (let i = 0; i < SEEDS.length; i++) {
    const g = new Sim({ seed: SEEDS[i], party: [
      { idx: 0, key: 'a', name: 'Bait', charId: 'toh_samurai', color: '#fff' },
      { idx: 1, key: 'b', name: 'Away', charId: 'toh_samurai', color: '#fff' }] });
    g.uiAction(0, { kind: 'pickNode', nodeId: g.reachableNodes()[0] });
    // a second player turns a node pick into a consent countdown; tick it out
    for (let k = 0; k < 60 * 6 && g.phase === 'map'; k++) g.tick();
    const [bait, away] = g.players;
    for (const x of [...g.enemyPool]) g.enemyPool.release(x);
    g.spawnQueue.length = 0; g.wave.done = false; g.obstacles.length = 0;
    bait.x = g.W * SPOTS[i][0]; bait.y = g.H * SPOTS[i][1];
    away.x = bait.x; away.y = bait.y + 600;          // well outside any zone here
    const e = g.spawnEnemyById('aegimand', bait.x + 52, bait.y, { noMats: true });
    e.spd = 0; e.dmg = 0; e.maxHp = 9000; e.hp = 9000;
    let committed = false;
    for (let k = 0; k < 60 * 12 && !committed; k++) {
      g.setInput(0, { mx: 0, my: 0 }); g.setInput(1, { mx: 0, my: 0 });
      g.tick(); e.hp = e.maxHp;
      committed = e.telState === TELEGRAPH_STATES.WINDUP;
    }
    if (!committed) { notes.push(`seed ${SEEDS[i]}: never committed`); continue; }
    staged++;
    const logFrom = g.telDodgeLog.length, dodges0 = g.telStats.dodged;
    for (let k = 0; k < 120; k++) {
      g.setInput(0, { mx: 0, my: 0 }); g.setInput(1, { mx: 0, my: 0 });
      g.tick(); e.hp = e.maxHp;
      if (e.telState === TELEGRAPH_STATES.RECOVER) break;
    }
    const awayLog = g.telDodgeLog.slice(logFrom).filter(d => d.p === 1);
    if (awayLog.length) notes.push(`seed ${SEEDS[i]}: the distant ally appeared in the resolve log`);
    else if (g.telStats.dodged > dodges0) notes.push(`seed ${SEEDS[i]}: a dodge was credited with nobody having left`);
    else pass++;
  }
  if (!staged) fail('a player never in the zone: no seed produced a commit');
  else if (pass === staged) ok(`a player never in the zone takes no damage and does NOT fire ON_DODGE — ${pass}/${staged} seeds (two-player staging)`);
  else fail(`a player never in the zone: ${pass}/${staged} seeds — ${notes.join(' | ')}`);
}

// 4. A stun during wind-up kills the attack.
run('a stun during wind-up cancels the attack with no damage', 'slabjaw', (g, p, e) => {
  const hp0 = p.hp, res0 = g.telStats.resolved, int0 = g.telStats.interrupted;
  e.stunT = 1.5;
  for (let i = 0; i < 180; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); e.hp = e.maxHp; if (i > 90) break; }
  if (p.hp < hp0) return `took ${hp0 - p.hp} damage from a stunned attacker`;
  if (g.telStats.resolved > res0) return 'the attack resolved anyway';
  if (g.telStats.interrupted <= int0) return 'no interrupt recorded';
  return true;
});

// 5. Knockback moves the BODY, not the promise.
run('an enemy knocked back during wind-up still resolves at the committed spot', 'slabjaw', (g, p, e) => {
  const zx = e.telZone.x, zy = e.telZone.y;
  e.knockX = 900; e.knockY = 0;              // shove it well clear of its own zone
  const hp0 = p.hp;
  for (let i = 0; i < 120; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); e.hp = e.maxHp; if (e.telState === TELEGRAPH_STATES.RECOVER) break; }
  const moved = Math.hypot(e.x - zx, e.y - zy);
  if (moved < 60) return `the enemy did not actually move (${moved.toFixed(0)}u)`;
  if (p.hp >= hp0) return `the zone followed the body — the player standing on the committed spot took nothing`;
  return true;
});

// 6. The Reflex stat roll is not a dodge.
run('Reflex-roll avoidance does NOT fire ON_DODGE', 'slabjaw', (g, p, e) => {
  p.stats.reflex = 100;                      // dodge everything, by dice
  const before = g.telStats.dodged;
  const dodgeT0 = p.trigEvents.dodgeT;
  for (let i = 0; i < 120; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); e.hp = e.maxHp; if (e.telState === TELEGRAPH_STATES.RECOVER) break; }
  if (g.telStats.dodged > before) return 'a stat roll was counted as a positional dodge';
  if (p.trigEvents.dodgeT !== dodgeT0) return 'the Reflex roll opened the ON_DODGE window';
  return true;
});

// ---------------------------------------------------------------- Rebuke

// Phase 1 could only test Rebuke with a synthetic dodge event. Now it goes
// through a real committed attack: stand in a slam, step out, and the counter
// should fire off the positional dodge.
{
  let fired = 0, staged = 0;
  for (let i = 0; i < SEEDS.length; i++) {
    const { g, p, e } = arena(SEEDS[i], SPOTS[i], 'slabjaw', { skills: ['sam_cross_guard'], slot: 'sam_rebuke' });
    // learn the chain up to Rebuke
    for (const id of ['sam_set_stance', 'sam_iron_sleeve', 'sam_sweeping_guard', 'sam_immovable', 'sam_rebuke']) {
      p.skillPoints++; SK.spendSkillPoint(g, p, id);
    }
    p.loadout.fill(null); p.loadout[0] = 'sam_rebuke';
    if (!tickToCommit(g, p, e)) continue;
    staged++;
    for (let k = 0; k < 150; k++) {
      g.setInput(0, { mx: -1, my: 0 });
      g.tick();
      e.hp = e.maxHp;
      if (p.fireLog.some(f => f.id === 'sam_rebuke')) { fired++; break; }
    }
  }
  if (staged && fired === staged) ok(`Rebuke fires off a REAL telegraph dodge — ${fired}/${staged} seeds (phase 1 could only test this with a synthetic event)`);
  else fail(`Rebuke fired on ${fired}/${staged} seeds through a real telegraph`);
}

console.log(failures ? `\n${failures} TELEGRAPH FAILURE(S)` : '\nALL TELEGRAPH PATHS VERIFIED');
process.exit(failures ? 1 : 0);
