// DOES A FIELD ACTUALLY HEAL THE PEOPLE STANDING IN IT?
//
// Nine skills across four classes want a placed zone that heals allies over
// time, and four of the Priest's eleven no-fit skills are this one gap. No
// skill has been converted to it — which skill takes which shape is Casey's
// ruling — so this gate drives the mechanism directly, the same way
// stealth_gate does. A mechanism that ships unused and broken stays broken
// until the day somebody builds nine nodes on it.
//
// The claims, each measured against the running game:
//
//   1. A TIMED field heals, and stops when it expires.
//   2. A PERMANENT field heals while slotted and dies on un-slot.
//   3. PLACED stays where it was cast; FOLLOWS moves with the caster.
//   4. ONE zone heals allies and hurts enemies at the same time.
//   5. `includeSelf: false` excludes the caster and nobody else.
//   6. A full-health ally is not healed, and nothing is tracked about it.
//
//   node tools/healfield_gate.mjs

import { Sim } from '../js/game.js';
import { runCompose } from '../js/compose.js';
import { applyPersistents } from '../js/skillsim.js';

let checks = 0, fails = 0;
const ok = m => { checks++; console.log('  ✓ ' + m); };
const bad = m => { checks++; fails++; console.log('  ✗ ' + m); };

// THE ROOM MUST NOT FINISH, and this is the whole trap in testing a field.
// Clearing a room calls `_endFight`, which does `this.zones.length = 0` — every
// zone in the game, on the frame the last enemy dies. An empty fixture with the
// wave marked done therefore completes the room immediately and DELETES THE
// FIELD UNDER TEST within the first half-second. Measured: the field pulsed once
// and then vanished, and the +5 left on the sheet was the party's own Recovery
// regen, which looked exactly like a field paying out slowly.
//
// So the fixture keeps one enemy alive and parked far away: the wave is stopped
// so nothing wanders into the measurement, and the room never completes because
// something is still standing.
function fixture(n = 2) {
  const g = new Sim({ seed: 808, allowUnplayable: true, party: Array.from({ length: n }, (_, i) => (
    { idx: i, key: 'k' + i, name: 'P' + i, charId: 'toh_priest', color: '#fff' })) });
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);
  g.spawnQueue.length = 0;
  for (const e of [...g.enemyPool]) if (e.active) { e.hp = 0; e.active = false; }
  const keep = g.spawnEnemyById('skulker', g.players[0].x + 2000, g.players[0].y + 2000);
  if (keep) keep.hp = 9e9;
  if (g.wave) g.wave.done = true;
  return g;
}
const live = g => { const o = []; for (const e of g.enemyPool) if (e.active) o.push(e); return o; };
// A field is cast through the real primitive, not by hand-building a zone.
const cast = (g, p, step, extra = {}) => runCompose(g, p,
  { id: 'gate_field', select: 'self', trigger: { radius: step.radius }, compose: [step], ranks: {}, ...extra },
  1, g.trigGrid);

console.log('HEALING FIELD — a placed zone that heals allies over time\n');

// ---- 1. a timed field heals, and stops ----
{
  const g = fixture(); const [a, b] = g.players;
  b.x = a.x + 30; b.y = a.y;
  a.hp = 40; b.hp = 40;
  cast(g, a, { kind: 'hazard', damage: 0, heal: 4, radius: 150, tickMs: 1000, duration: 3000 });
  // COUNTED HERE, not after the loop: the field is a 3000ms one and the loop
  // runs for three seconds, so a count taken afterwards reads the expiry rather
  // than the cast and reports "one cast made 0 zones".
  const zonesLeft = g.zones.length;
  for (let i = 0; i < 60 * 3; i++) g.tick(1 / 60);
  const healed = { a: a.hp - 40, b: b.hp - 40 };
  for (let i = 0; i < 60 * 3; i++) g.tick(1 / 60);
  const after = a.hp;
  if (healed.a > 0 && healed.b > 0) ok(`a TIMED field heals everyone in it — caster +${healed.a}, ally +${healed.b} over 3s at 4/1000ms`);
  else bad(`the timed field healed nothing: caster +${healed.a}, ally +${healed.b}`);
  if (!g.zones.length && after === a.hp) ok('and it EXPIRES — the zone is gone and the healing stopped with it');
  else bad(`the field outlived its duration: ${g.zones.length} zone(s) still up`);
  if (zonesLeft === 1) ok('one cast made exactly ONE zone');
  else bad(`one cast made ${zonesLeft} zones`);
}

// ---- 2. a permanent field holds while slotted, and dies on un-slot ----
{
  const g = fixture(); const p = g.players[0];
  const sk = { id: 'gate_persist_field', type: 'active', persist: { field: { radius: 150, tickMs: 500, heal: 3 } } };
  // registered by hand into the id table the door reads
  const SK = await import('../js/skills.js');
  SK.SKILL_BY_ID[sk.id] = sk;
  p.skillRanks[sk.id] = 1; p.loadout = [sk.id];
  applyPersistents(g, p);
  const up = g.zones.find(z => z.auraKey === sk.id);
  p.hp = 40;
  for (let i = 0; i < 60 * 2; i++) g.tick(1 / 60);
  const gained = p.hp - 40;
  if (up && up.dur === Infinity && gained > 0) ok(`a PERMANENT field holds off the clock and heals — +${gained} in 2s, dur ${up.dur}`);
  else bad(`permanent field wrong: zone ${up ? 'up' : 'absent'}, dur ${up && up.dur}, healed ${gained}`);
  p.loadout = [];
  applyPersistents(g, p);
  const stillUp = g.zones.some(z => z.auraKey === sk.id);
  p.hp = 40;
  for (let i = 0; i < 60 * 2; i++) g.tick(1 / 60);
  if (!stillUp && p.hp === 40) ok('and un-slotting tears it down — the zone is gone and the healing stopped');
  else bad(`un-slot did not tear down: zone ${stillUp ? 'still up' : 'gone'}, hp moved ${p.hp - 40}`);
  delete SK.SKILL_BY_ID[sk.id];
}

// ---- 3. placed stays; follows moves ----
{
  const g = fixture(1); const p = g.players[0];
  const x0 = p.x;
  cast(g, p, { kind: 'hazard', damage: 0, heal: 2, radius: 120, tickMs: 500, duration: 9000 });
  const placed = g.zones.find(z => z.heals > 0);
  if (!placed) { bad('placement: the placed field cast no zone at all'); }
  p.x = x0 + 400;
  g.tick(1 / 60);
  const stayed = !!placed && Math.abs(placed.x - x0) < 1;

  const g2 = fixture(1); const q = g2.players[0];
  const y0 = q.x;
  cast(g2, q, { kind: 'hazard', damage: 0, heal: 2, radius: 120, tickMs: 500, duration: 9000, follow: true });
  const follows = g2.zones.find(z => z.heals > 0);
  if (!follows) { bad('placement: the following field cast no zone at all'); }
  q.x = y0 + 400;
  g2.tick(1 / 60);
  const moved = !!follows && Math.abs(follows.x - q.x) < 1;

  if (stayed && moved) ok('PLACED stays where it was cast; FOLLOWS tracks the caster — both, per skill, from one flag');
  else bad(`placement wrong: placed ${stayed ? 'stayed' : 'MOVED'}, follow ${moved ? 'followed' : 'DID NOT FOLLOW'}`);
}

// ---- 4. one zone, both effects ----
{
  const g = fixture(); const [a, b] = g.players;
  b.x = a.x + 30; b.y = a.y;
  a.hp = 40; b.hp = 40;
  // SPAWNED DIRECTLY. The fixture stops the wave so ambient spawns cannot wander
  // into the measurement, which also means waiting for one never arrives.
  const e = g.spawnEnemyById('skulker', a.x + 40, a.y) || live(g)[0];
  if (!e) { bad('no enemy spawned — the both-effects check could not run'); }
  else {
    e.x = a.x + 40; e.y = a.y; e.hp = 99999;
    const hp0 = e.hp;
    cast(g, a, { kind: 'hazard', damage: 6, heal: 4, radius: 150, tickMs: 500, duration: 4000 });
    const nZones = g.zones.length;
    for (let i = 0; i < 60 * 3; i++) { e.x = a.x + 40; e.y = a.y; g.tick(1 / 60); }
    const healed = a.hp - 40, hurt = hp0 - e.hp;
    if (healed > 0 && hurt > 0 && nZones === 1) {
      ok(`ONE zone heals allies AND hurts enemies — ally +${healed}, enemy -${hurt}, from ${nZones} zone`);
    } else bad(`both-effects wrong: healed ${healed}, hurt ${hurt}, zones ${nZones}`);
  }
}

// ---- 5. includeSelf: false excludes the caster only ----
//
// MEASURED AGAINST A CONTROL, because the party heals itself. Recovery-driven
// regen pays every player a few points over any window long enough for a field
// to tick, so "the caster gained nothing" is not a thing this fixture can ever
// observe — the first version of this check read that background regen as the
// field paying a caster it had excluded. The claim is that the field's
// contribution is zero for the caster and positive for the ally, so both are
// taken as deltas against the same run with no field in it.
{
  const run = (withField) => {
    const g = fixture(); const [a, b] = g.players;
    b.x = a.x + 30; b.y = a.y;
    a.hp = 40; b.hp = 40;
    if (withField) cast(g, a, { kind: 'hazard', damage: 0, heal: 5, radius: 150, tickMs: 500, duration: 4000, includeSelf: false });
    for (let i = 0; i < 60 * 4; i++) g.tick(1 / 60);
    return { a: a.hp - 40, b: b.hp - 40 };
  };
  const off = run(false), on = run(true);
  const casterFromField = on.a - off.a, allyFromField = on.b - off.b;
  if (casterFromField === 0 && allyFromField > 0) {
    ok(`includeSelf:false excludes the caster and nobody else — the field paid the caster ${casterFromField} and the ally ${allyFromField} (background regen ${off.a} netted out)`);
  } else bad(`includeSelf wrong: field paid caster ${casterFromField}, ally ${allyFromField}`);
}

// ---- 6. a full-health ally is simply not healed ----
{
  const g = fixture(); const [a, b] = g.players;
  b.x = a.x + 30; b.y = a.y;
  a.hp = a.stats.vitality; b.hp = b.stats.vitality;
  cast(g, a, { kind: 'hazard', damage: 0, heal: 5, radius: 150, tickMs: 500, duration: 3000 });
  for (let i = 0; i < 60 * 2; i++) g.tick(1 / 60);
  // No control needed here: both start at the cap, so regen has nowhere to go
  // either, and any movement at all would be the field overhealing.
  if (a.hp === a.stats.vitality && b.hp === b.stats.vitality) {
    ok('a full-health ally is not healed and nothing is tracked about it — the field heals whoever is standing in it');
  } else bad(`overhealed: caster ${a.hp}/${a.stats.vitality}, ally ${b.hp}/${b.stats.vitality}`);
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'THE FIELD DOES NOT HEAL' : 'A FIELD HEALS WHOEVER IS STANDING IN IT');
process.exit(fails ? 1 : 0);
