// TELEGRAPHS, THROUGH THEIR REAL RUNTIME PATH.
//
//   node tools/telegraph_test.mjs
//
// Six claims from the spec, each driven through live ticks rather than by
// calling the state machine directly. Every case is staged from FOUR seeds and
// four positions: phase 1's sweep read five skills as "wired to nothing"
// because every case ran from one seed at one spot, next to a pillar that ate
// the projectile, and one arena is not a sample.

import { readFileSync } from 'node:fs';
// FixtureSim, not Sim: the harness answers its own §5.6 opening card instead
// of tripping the anti-softlock floor at every arena door. Same skill, same
// tick, no defect line — see tools/fixture_sim.mjs.
const { FixtureSim: Sim } = await import('./fixture_sim.mjs');
const SK = await import('../js/skillsim.js');
const { TELEGRAPH_STATES, TELEGRAPH_MIN_WINDUP_MS, TELEGRAPHED_IDS, telegraphBusy } = await import('../js/telegraphs.js');
const { inZone } = await import('../js/compose.js');
const { ENEMY_BY_ID } = await import('../js/content/enemies.js');
const { REGION_ENEMIES, REGION_ENEMY_BY_ID, telegraphWeight, MIN_TELEGRAPH_WEIGHT } = await import('../js/content/regions-enemies.js');
const { CONFIG } = await import('../js/config.js');
const { REGIONS } = await import('../js/regions.js');

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
// On the log, like the others. HP is not an instrument here: Footing's absorb
// pool eats the hit, so a player can take a full slam with their health bar
// unchanged — which is the pool doing its job, not the attack missing.
run('an enemy knocked back during wind-up still resolves at the committed spot', 'slabjaw', (g, p, e) => {
  const zx = e.telZone.x, zy = e.telZone.y;
  e.knockX = 900; e.knockY = 0;              // shove it well clear of its own zone
  const logFrom = g.telDodgeLog.length;
  for (let i = 0; i < 120; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); e.hp = e.maxHp; if (e.telState === TELEGRAPH_STATES.RECOVER) break; }
  const moved = Math.hypot(e.x - zx, e.y - zy);
  if (moved < 60) return `the enemy did not actually move (${moved.toFixed(0)}u)`;
  const mine = g.telDodgeLog.slice(logFrom).filter(d => d.p === 0);
  if (!mine.length) return 'the attack never resolved on the player at all';
  if (mine.every(d => d.dodged)) return 'the zone followed the body — the player on the committed spot was scored as having dodged';
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

// ---------------------------------------------------------------- Footing

// Footing grants an ABSORB POOL, never max HP. The first version granted
// vitality per stack, which meant breaking stance lowered max Vitality and
// clamped current HP with it — a Samurai lost health for dodging, by an amount
// unrelated to the attack, and it landed hardest exactly when they did the
// thing the mechanic exists to reward.
{
  const g = new Sim({ seed: 4242, party: [{ idx: 0, key: 'k', name: 'S', charId: 'toh_samurai', color: '#fff' }] });
  g.uiAction(0, { kind: 'pickNode', nodeId: g.reachableNodes()[0] });
  const p = g.players[0];
  for (const e of [...g.enemyPool]) g.enemyPool.release(e);
  g.spawnQueue.length = 0; g.wave.done = false; g.obstacles.length = 0;
  p.x = g.W / 2; p.y = g.H / 2;

  const vit0 = p.stats.vitality, hp0 = p.hp;
  for (let i = 0; i < 60 * 8; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); }
  const stacks = p.engines.footing, pool = p.footingShield, vitUp = p.stats.vitality;
  if (stacks > 0) ok(`Footing accrues while still — ${stacks} stacks`);
  else fail('Footing never accrued');
  if (pool > 0) ok(`...and carries an absorb pool of ${Math.round(pool)}`);
  else fail('Footing granted no absorb pool');
  if (vitUp === vit0) ok(`...without touching max Vitality (${vit0} before, ${vitUp} at full stance)`);
  else fail(`Footing moved max Vitality ${vit0} -> ${vitUp} — it must not`);
  if (p.stats.grit > 0) ok(`...and grit is still on the stack (grit ${p.stats.grit})`);
  else fail('Footing no longer grants grit');

  const hpAtFull = p.hp;
  for (let i = 0; i < 30; i++) { g.setInput(0, { mx: 1, my: 0 }); g.tick(); }
  if (p.engines.footing === 0 && p.footingShield === 0) ok('moving drops the whole stack and the whole pool');
  else fail(`stance survived movement: ${p.engines.footing} stacks, ${p.footingShield} pool`);
  if (p.hp === hpAtFull && p.hp === hp0) ok(`breaking stance costs NO current HP (${hp0} throughout) — this is the regression the pool exists to prevent`);
  else fail(`breaking stance moved HP ${hpAtFull} -> ${p.hp}`);
}

// ---------------------------------------------------------------- unification

{
  // Comments stripped first. The dasher case now EXPLAINS why followAim is
  // gone, and a check that cannot tell the prohibition from the violation is
  // noise — the biome gate learned this the same way.
  const decomment = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
  const src = decomment(readFileSync(new URL('../js/entities/enemies.js', import.meta.url), 'utf8'));
  const dash = src.slice(src.indexOf("case 'dasher'"), src.indexOf("case 'sniper'"));
  if (dash.length > 200 && !/followAim/.test(dash)) ok("the lancerfish dash no longer reaims during its wind-up — both of its attacks now promise a piece of ground");
  else fail('the lancerfish dash still carries followAim: a tracking attack in the same body undermines its committed telegraph');
  const stillTracks = /followAim:\s*true/.test(src);
  console.log(stillTracks
    ? '  (deadeye\'s beam still tracks at <=0.5 rad/s during its own wind-up — left alone deliberately, per the brief)'
    : '  (no reaiming wind-up remains anywhere in the enemy file)');
}

// ---------------------------------------------------------------- the pit

{
  const g = new Sim({ seed: 4242, party: [{ idx: 0, key: 'k', name: 'S', charId: 'toh_samurai', color: '#fff' }] });
  g.uiAction(0, { kind: 'pickNode', nodeId: g.reachableNodes()[0] });
  g.debug('F7');
  const ids = [...g.enemyPool].filter(e => e.active).map(e => e.def.id);
  const kinds = [...new Set(ids)].sort();
  // The pit used to be 8 slabjaw/aegimand — 100% telegraphing, which flatters a
  // dodging bot exactly as the base roster's 21% flatters a holder. It now
  // draws a weighted sample from a REGION population, so what it measures is
  // the density the regions actually ship at.
  const tel = ids.filter(id => ENEMY_BY_ID[id] && ENEMY_BY_ID[id].telegraph).length;
  const share = ids.length ? tel / ids.length : 0;
  if (ids.length === CONFIG.TELEGRAPH_PIT_COUNT && share >= 0.4 && share <= 0.7) {
    ok(`F7 telegraph pit: ${ids.length} enemies from a region population, ${tel} telegraphing (${(100 * share).toFixed(0)}%) — representative density, not an all-heavy room (${kinds.join(', ')})`);
  } else {
    fail(`F7 pit seeded ${ids.length} enemies at ${(100 * share).toFixed(0)}% telegraphing, want ${CONFIG.TELEGRAPH_PIT_COUNT} at 40-70%: ${kinds.join(', ')}`);
  }
  if (g.telStats.committed === 0) ok('...and the pit resets the telegraph counters, so a sitting measures itself');
  else fail('the pit did not reset the counters');
  // and it must not have quietly given anything else a telegraph
  // Not a hardcoded count any more — the number grows with every region, and a
  // gate that pins it just gets bumped. What must hold is the RULE: every heavy
  // archetype in a region commits, and each region clears the density floor.
  const base = TELEGRAPHED_IDS.filter(id => !REGION_ENEMY_BY_ID[id]);
  if (base.length === 3) ok(`the base roster still telegraphs on exactly 3 of 12 (${base.join(', ')}) — regions raise density, they do not change the base mix`);
  else fail(`base telegraph count drifted to ${base.length}: ${base.join(', ')}`);
  // ITERATE THE REGION TABLE, NOT THE POPULATIONS THAT HAPPEN TO EXIST.
  //
  // This walked `REGION_ENEMIES` and checked the density of every population it
  // found — which is every population somebody wrote. A region declared in
  // `js/regions.js` with no enemies yet contributed no entry, so it was not
  // under the floor, it was not measured at all, and the check went green.
  // Regions 3 through 8 could each have shipped that way one at a time.
  //
  // `js/regions.js` is the authoritative list of what the game claims to have,
  // so it is the list the floor is enforced over. A region with no population
  // is now a NAMED failure rather than a silent absence — which is the whole
  // difference between "not built yet" and "built wrong", and phase 5 needs to
  // be told which one it is looking at.
  const bad = [], empty = [];
  for (const r of REGIONS) {
    const pop = REGION_ENEMIES[r.id];
    if (!pop || !pop.enemies || !pop.enemies.length) { empty.push(r.id); continue; }
    const { share } = telegraphWeight(pop.enemies);
    if (share < MIN_TELEGRAPH_WEIGHT) bad.push(`${r.id} ${(100 * share).toFixed(0)}%`);
  }
  const built = REGIONS.filter(r => REGION_ENEMIES[r.id] && REGION_ENEMIES[r.id].enemies && REGION_ENEMIES[r.id].enemies.length);
  if (!bad.length && !empty.length) {
    ok(`all ${REGIONS.length} regions in the table clear the ${(100 * MIN_TELEGRAPH_WEIGHT).toFixed(0)}% telegraph-density floor: ${built.map(r => `${r.id} ${(100 * telegraphWeight(REGION_ENEMIES[r.id].enemies).share).toFixed(0)}%`).join(', ')}`);
  } else {
    if (bad.length) fail(`under the density floor: ${bad.join(', ')}`);
    if (empty.length) fail(`${empty.length} region(s) declared in js/regions.js with NO enemy population: ${empty.join(', ')} — a region the density floor cannot measure is a region that can ship unchecked`);
  }
}

// ---------------------------------------------------------------- no def

// THE SIEGE BOSS HAS NO `def`. _spawnSiegeBoss builds its slot with def: null
// and a bossDef instead, and every e.def.telegraph in telegraphs.js was an
// unguarded dereference — so the host sim threw the instant a boss existed, on
// every siege on every floor. It survived review because the legacy sim suite
// was hanging before it reached the siege runs; the only evidence anyone had
// was a partial log. This drives a real siege to a real boss spawn.
{
  const g = new Sim({ seed: 5, regionIndex: 4, party: [{ idx: 0, key: 'k', name: 'T', charId: 'toh_samurai', color: '#fff' }] });
  g.god = true;
  g._travelTo(g.floor.bossId);
  let spawned = false, crash = null;
  try {
    for (let i = 0; i < 60 * 400 && !spawned; i++) { g.tick(); spawned = !!g.boss; }
    for (let i = 0; i < 240; i++) g.tick();          // and keep ticking WITH it alive
  } catch (err) { crash = err; }
  if (crash) fail(`a siege boss crashed the tick: ${crash.constructor.name}: ${crash.message}`);
  else if (!spawned) fail('no siege boss spawned, so this proves nothing — restage it');
  else {
    ok(`a siege boss (def: null, bossDef set) ticks for 4s alongside the telegraph machine without throwing`);
    // and it is genuinely outside the system rather than accidentally inside it
    if (!telegraphBusy(g.boss) && g.telegraphZones().every(z => z.id !== g.boss.id)) {
      ok('...and it is outside the telegraph system entirely — never busy, never a zone');
    } else {
      fail('the boss ended up inside the telegraph machine');
    }
  }
}

console.log(failures ? `\n${failures} TELEGRAPH FAILURE(S)` : '\nALL TELEGRAPH PATHS VERIFIED');
process.exit(failures ? 1 : 0);
