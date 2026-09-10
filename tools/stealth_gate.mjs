// DOES CONCEALMENT ACTUALLY CONCEAL?
//
// No shipped skill uses `stealth` yet — which skills get it is Casey's separate
// ruling — so this gate drives the primitive directly through the real sim
// rather than through a loadout. That is the only way to test a mechanism the
// content has not reached, and it is worth doing now: a primitive that ships
// broken and unused stays broken until the day somebody builds ten nodes on it.
//
// Five claims, each measured against the running game rather than by reading
// the source:
//
//   1. The window OPENS  — a stealth step sets concealT.
//   2. It CLOSES         — the timer runs it down and the player is visible again.
//   3. It BLOCKS DAMAGE  — hurtPlayer refuses while the window is open.
//   4. It DROPS THREAT   — an enemy asking who to attack does not get this player.
//   5. It CYCLES         — enemies far away open nothing; the gate is real.
//
// Plus the case the ruling makes reachable for the first time: an entire party
// concealed at once. Enemies must still have something to walk toward, or the
// field freezes and the room can never be finished.
//
//   node tools/stealth_gate.mjs

import { Sim } from '../js/game.js';
import { runCompose } from '../js/compose.js';

let checks = 0, fails = 0;
const ok = m => { checks++; console.log('  ✓ ' + m); };
const bad = m => { checks++; fails++; console.log('  ✗ ' + m); };

const STEP = { kind: 'stealth', windowMs: 2000, radius: 150 };
const SKILL = { id: 'gate_stealth', compose: [STEP], ranks: {} };

function fixture(n = 1) {
  const g = new Sim({ seed: 4242, party: Array.from({ length: n }, (_, i) => (
    { idx: i, key: 'k' + i, name: 'P' + i, charId: 'toh_assassin', color: '#fff' })) });
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);
  // LET THE ROOM ACTUALLY SPAWN, AND REFUSE TO PROCEED IF IT DOES NOT. The pool
  // starts empty and fills over seconds — a solo party had nothing on the field
  // for the first two — and this gate's whole subject is proximity to an enemy.
  // A fixture with none would quietly measure the empty-room branch every time
  // and report it as concealment working.
  for (let i = 0; i < 60 * 20 && !live(g).length; i++) g.tick(1 / 60);
  if (!live(g).length) { console.log(`  ✗ FIXTURE: no enemy spawned for a ${n}-player party in 20s — nothing below would mean anything`); process.exit(1); }
  return g;
}
// `enemyPool` is a Pool, not an Array — iterable, but with no .find on it.
const live = g => { const out = []; for (const e of g.enemyPool) if (e.active) out.push(e); return out; };
// An enemy parked ON the player, so the proximity gate is unambiguously met.
function enemyOn(g, p, dx = 40) {
  const e = live(g)[0];
  if (e) { e.x = p.x + dx; e.y = p.y; }
  return e;
}
const conceal = (g, p) => runCompose(g, p, SKILL, 1, g.trigGrid);

console.log('STEALTH — the concealment window, driven through the real sim\n');

// ---- 1. the window opens ----
{
  const g = fixture(); const p = g.players[0];
  enemyOn(g, p);
  p.concealT = 0;
  conceal(g, p);
  if (p.concealT > 1.9 && p.concealT <= 2.0) ok(`the window OPENS — a 2000ms step set concealT to ${p.concealT.toFixed(2)}s`);
  else bad(`the window did not open: concealT is ${p.concealT}`);
}

// ---- 2. and it closes on its own timer ----
{
  const g = fixture(); const p = g.players[0];
  enemyOn(g, p);
  conceal(g, p);
  const opened = p.concealT;
  let visibleAfter = null;
  for (let i = 0; i < 60 * 4; i++) {
    g.tick(1 / 60);
    if (visibleAfter === null && !(p.concealT > 0)) visibleAfter = (i + 1) / 60;
  }
  if (visibleAfter !== null && Math.abs(visibleAfter - 2) < 0.25) {
    ok(`it CLOSES on its own timer — opened ${opened.toFixed(2)}s, visible again after ${visibleAfter.toFixed(2)}s`);
  } else bad(`the window did not close on time: visible again after ${visibleAfter}`);
}

// ---- 3. it blocks damage ----
{
  const g = fixture(); const p = g.players[0];
  const e = enemyOn(g, p);
  p.hp = p.stats.vitality;
  // CONTROL FIRST. A damage test that never lands the control hit proves
  // nothing — it would pass identically if hurtPlayer were broken outright.
  p.invuln = 0; g.hurtPlayer(p, 40, e);
  const tookIt = p.stats.vitality - p.hp;
  p.hp = p.stats.vitality; p.invuln = 0;
  conceal(g, p);
  for (let i = 0; i < 5; i++) { p.invuln = 0; g.hurtPlayer(p, 40, e); }
  const tookConcealed = p.stats.vitality - p.hp;
  if (tookIt > 0 && tookConcealed === 0) ok(`it BLOCKS DAMAGE — ${tookIt} taken while visible, 0 across five hits while concealed`);
  else bad(`damage block wrong: visible took ${tookIt}, concealed took ${tookConcealed}`);
}

// ---- 4. it drops threat ----
{
  const g = fixture(2);
  const [a, b] = g.players;
  b.x = a.x + 600; b.y = a.y;             // B is far; A is the obvious target
  enemyOn(g, a);
  const before = g.tauntTarget(a.x + 20, a.y);
  conceal(g, a);
  const after = g.tauntTarget(a.x + 20, a.y);
  if (before === a && after === b) ok('it DROPS THREAT — an enemy standing on the concealed player targets the distant one instead');
  else bad(`threat did not move: before=${before && before.name}, after=${after && after.name}`);
}

// ---- 5. the proximity gate is real ----
{
  const g = fixture(); const p = g.players[0];
  for (const e of live(g)) { e.x = p.x + 5000; e.y = p.y + 5000; }
  p.concealT = 0;
  conceal(g, p);
  const empty = p.concealT;
  enemyOn(g, p, 40);
  conceal(g, p);
  if (!(empty > 0) && p.concealT > 0) ok('the PROXIMITY GATE holds — no window with the room empty, a window with an enemy at 40');
  else bad(`gate wrong: empty room gave ${empty}, enemy present gave ${p.concealT}`);
}

// ---- 6. a whole party concealed still leaves enemies something to walk at ----
{
  const g = fixture(8);
  for (const p of g.players) { enemyOn(g, p); conceal(g, p); }
  const hidden = g.players.filter(p => p.concealT > 0).length;
  const t = g.tauntTarget(g.players[0].x + 30, g.players[0].y);
  const n = g.nearestLivingPlayer(g.players[0].x + 30, g.players[0].y);
  if (hidden === 8 && t && n) ok(`ALL EIGHT CONCEALED and enemies still have a target (${t.name}) — the field does not freeze`);
  else bad(`all-concealed case broken: ${hidden} hidden, tauntTarget=${t && t.name}, nearest=${n && n.name}`);
}

// ---- 7. it deals no damage, and cannot be given any ----
{
  const g = fixture(); const p = g.players[0];
  enemyOn(g, p);
  const out = conceal(g, p);
  if (out.damage === 0 && out.hits === 0) ok('it DEALS NOTHING — no damage, no hits, so a concealed statue clears nothing');
  else bad(`stealth reported damage ${out.damage} / hits ${out.hits}`);
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'CONCEALMENT IS BROKEN' : 'THE WINDOW OPENS, CLOSES, HIDES AND PROTECTS');
process.exit(fails ? 1 : 0);
