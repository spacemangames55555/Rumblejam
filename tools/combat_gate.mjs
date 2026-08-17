// COMBAT GATE — the five playtest defects of patch-combat-defects, each
// asserted BY EFFECT rather than by implementation.
//
// Every check here failed on the commit this gate was written against, and the
// numbers in the failure messages are the measured "before". That is the point:
// a check whose subject can be deleted and still pass is not a check (§13 rule
// 79), and four of these five defects lived for months behind gates that were
// green because they were asking a different question.
//
// The five:
//   1  a skill selected and struck a target with a wall in the way, and the
//      MIRROR of that — an enemy's committed zone resolved through the wall
//   2  minions were the one mobile family with no obstacle collision
//   3  a body whose straight line to the player crossed a pillar never arrived
//   4  a summoned pack stacked into one body
//   5  the region bosses ran no code at all
import { FixtureSim as Sim } from './fixture_sim.mjs';
import * as SKILLSIM from '../js/skillsim.js';
import { TREES, TREES_BY_CLASS } from '../js/skills.js';
import { selectTarget } from '../js/selectors.js';
import { bossForRegion } from '../js/regions.js';
import { ALL_BOSS_DEFS } from '../js/content/bosses.js';

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { console.log(`✗ ${m}`); failures++; };

const P = c => [{ idx: 0, key: 'k', name: 'P', charId: c, color: '#fff' }];
const pump = (g, p) => {
  let k = 0;
  while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
  if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
};
function armTree(charId, treeId, { ranks = 4, level = 31, seed = 771, regionIndex = 1 } = {}) {
  const g = new Sim({ seed, regionIndex, party: P(charId), allowUnplayable: true });
  const p = g.players[0]; p.level = level;
  const sk = [...TREES[treeId].skills].sort((a, b) => a.tier - b.tier);
  for (let r = 0; r < ranks; r++) for (const s of sk) { p.skillPoints++; if (!SKILLSIM.spendSkillPoint(g, p, s.id)) p.skillPoints--; }
  g.god = true; g._recomputeStats(p);
  g._travelTo(g.floor.nodes.find(n => n.depth > 1 && n.template && n.kind !== 'shrine').id);
  return { g, p };
}
function armAll(g, p, ranks = 3, level = 12) {
  p.level = level;
  const sk = (TREES_BY_CLASS[p.charId] || []).flatMap(t => TREES[t].skills).sort((a, b) => a.tier - b.tier);
  for (let r = 0; r < ranks; r++) for (const s of sk) { p.skillPoints++; if (!SKILLSIM.spendSkillPoint(g, p, s.id)) p.skillPoints--; }
  g._recomputeStats(p);
}
function room(charId = 'toh_blacksmith', { regionIndex = 1, seed = 771, template = null } = {}) {
  const g = new Sim({ seed, regionIndex, party: P(charId), allowUnplayable: true });
  armAll(g, g.players[0]);
  const node = g.floor.nodes.find(n => n.depth > 1 && n.template && n.kind !== 'shrine');
  if (template) node.template = template;
  g._travelTo(node.id);
  return { g, p: g.players[0] };
}
const bigBlock = g => g.obstacles.filter(q => q.w > 60 && q.h > 60).sort((a, b) => b.w * b.h - a.w * a.h)[0];

// ------------------------------------------------------------------ 1: sight
//
// The live attack path is `tickSkills` -> compose.js PRIMITIVES. `_fireWeapon`
// — the only caller that ever tested sight — stopped running when weapons were
// removed, so the sight rule survived in a function nothing called. Measured
// before the fix: 16 damage landed on an enemy across a 143x143 block with the
// player having zero frames of clear sight in fifteen seconds.
console.log('\n--- 1. line of sight, player -> enemy ---');
{
  const { g, p } = armTree('toh_wizard', 'wizard_dissonance', { ranks: 3 });
  for (let i = 0; i < 60 * 20; i++) { g.tick(); pump(g, p); }
  const o = bigBlock(g);
  const live = [...g.enemyPool].filter(e => e.active);
  if (!o || !live.length) fail('sight fixture never staged: no block or no live enemy — restage it');
  else {
    const cy = o.y + o.h / 2, px = o.x - 80, ex = o.x + o.w + 80;
    const victim = live[0];
    p.x = px; p.y = cy; victim.x = ex; victim.y = cy;
    if (!g.losBlocked(p.x, p.y, victim.x, victim.y)) fail('the fixture does not actually have a wall between them — restage it');
    else {
      if (selectTarget('nearest', g.trigGrid, p.x, p.y, 900, e => !g.losBlocked(p.x, p.y, e.x, e.y)) !== victim) {
        ok('selectTarget refuses an occluded enemy when given the sight predicate');
      } else fail('selectTarget returned an enemy with no line of sight');
      if (o.destructible) { fail('the block chosen is a destructible barricade — that is a target, not cover; restage it'); }
      else {
        // MEASURE THE SKILL, NOT THE BURN TAIL. Raw HP delta reported 16
        // damage after the fix and it was not a targeting leak at all: the
        // twenty-second warm-up sets the victim alight while sight is clear,
        // and the burn keeps ticking once positions are pinned. `skillDamage`
        // is the path every primitive's damage takes, so hooking it asks
        // exactly "did a skill land on something it cannot see".
        const proto = Object.getPrototypeOf(g);
        const orig = proto.skillDamage;
        let landed = 0;
        proto.skillDamage = function (e, dmg, pl, sk) { if (e === victim) landed += dmg; return orig.call(this, e, dmg, pl, sk); };
        let clearFrames = 0;
        try {
          for (let i = 0; i < 60 * 15; i++) {
            p.x = px; p.y = cy; victim.x = ex; victim.y = cy;
            for (const e of g.enemyPool) if (e.active && e !== victim) { e.x = 60; e.y = 60; }
            if (!g.losBlocked(p.x, p.y, victim.x, victim.y)) clearFrames++;
            g.tick(); pump(g, p);
          }
        } finally { proto.skillDamage = orig; }
        if (clearFrames > 0) fail(`the fixture leaked ${clearFrames} frames of clear sight — restage it`);
        else if (landed <= 0) ok('15s of live skill ticks put 0 skill damage through a solid block (was 16)');
        else fail(`${landed.toFixed(0)} skill damage landed through a permanent wall in 15s with no frame of clear sight`);
      }
    }
  }
}

// ---------------------------------------------------------- 1b: the mirror
//
// The same question asked the other way, and the answer was worse: a committed
// telegraph zone tested geometry and not sight, so region 1's Sapling landed 12
// of 12 wind-ups on a player behind a 143-unit block for 150 damage. The fix
// tests sight from the zone's FROZEN origin, so it costs the commit rule
// nothing — the zone still does not move, follow or reaim.
console.log('\n--- 1b. line of sight, enemy -> player (the mirror) ---');
{
  const { g, p } = room();
  for (let i = 0; i < 60 * 20; i++) { g.tick(); pump(g, p); p.hp = p.stats.vitality; }
  const o = bigBlock(g);
  if (!o) fail('mirror fixture never staged: no block — restage it');
  else {
    const cy = o.y + o.h / 2;
    let commits = 0, occluded = 0, resolved = 0, was = new Map();
    for (let i = 0; i < 60 * 40; i++) {
      p.x = o.x - 40; p.y = cy;
      for (const e of g.enemyPool) { if (!e.active || e.telState === 1) continue; e.x = o.x + o.w + 40; e.y = cy; }
      for (const e of g.enemyPool) if (e.active) was.set(e.id, e.telState);
      g.tick(); pump(g, p);
      p.hp = p.stats.vitality;
      for (const e of g.enemyPool) {
        if (!e.active) continue;
        if (was.get(e.id) === 0 && e.telState === 1) { commits++; if (g.losBlocked(e.x, e.y, p.x, p.y)) occluded++; }
        if (was.get(e.id) === 1 && e.telState !== 1) resolved++;
      }
    }
    if (occluded === 0) ok(`40s of enemies pinned behind a block: ${commits} commits, 0 of them through the wall (was 12 of 12, all resolved)`);
    else fail(`${occluded} of ${commits} telegraph commits had no line of sight, ${resolved} resolved`);
  }
}

// ---------------------------------------------------------------- 2: minions
//
// Scope, decided by measurement: ALL minions, not necromancer summons and not
// every spawned entity. `moveMinion` is the single mover for every summon in
// the game and it clamped to the room and nothing else — no `_inObstacle`, no
// `_pushOut`. Players get `_pushOut` in `_tickPlayer`, enemies get it via
// `clampToRoom`, the Hunter's beast gets it directly. Minions got nothing.
console.log('\n--- 2. minions collide with obstacles ---');
for (const [charId, treeId, label] of [
  ['toh_necromancer', 'necro_summons', 'necromancer skeletons'],
  ['toh_druid', 'druid_beasts', 'druid pack'],
  ['toh_hunter', 'hun_houndmaster', 'hunter hounds'],
]) {
  const { g, p } = armTree(charId, treeId, { ranks: 4 });
  for (let i = 0; i < 60 * 25; i++) { g.tick(); pump(g, p); }
  const o = bigBlock(g);
  const m = p.minions.find(x => !x.down);
  if (!o || !m) { fail(`${label}: fixture never staged (block ${!!o}, minion ${!!m}) — restage it`); continue; }
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  m.x = cx; m.y = cy;
  let insideAfter = 0;
  for (let i = 0; i < 40; i++) { g.tick(); pump(g, p); if (g._inObstacle(m.x, m.y, m.radius * 0.5)) insideAfter++; }
  if (insideAfter === 0) ok(`${label}: a minion dropped inside a ${o.w.toFixed(0)}x${o.h.toFixed(0)} block is ejected, 0/40 frames inside`);
  else fail(`${label}: still inside the block for ${insideAfter}/40 frames after being dropped in it`);
}

// ---------------------------------------------------------------- 3: arrival
//
// THE CHECK THAT NAMES THE DEFECT. Not "does it retarget" — `tauntTarget` was
// re-read every frame by every behaviour and always had been, so a periodic
// retarget would have fixed nothing. The cause was that `walk` was a straight
// line: a body whose line crossed a pillar walked into it, `_pushOut` ejected
// it along the shortest axis out of the rect — perpendicular to the approach,
// with no idea where the player was — and it slid along the face forever.
//
// Measured before the fix: 0 of 9 staged runs arrived. Bodies stalled 168-248
// units short and stayed there for the full 40s.
console.log('\n--- 3. a body that wants to reach the player arrives ---');
{
  const CLOSERS = new Set(['chaser', 'brute', 'warden', 'sprinter', 'splitter', 'dasher', 'bomber']);
  let arrived = 0, staged = 0;
  const worst = [];
  for (const tmpl of ['pillared_field', 'broken_ground', 'long_hall']) {
    for (const seed of [4242, 771, 99]) {
      const { g, p } = room('toh_blacksmith', { seed, template: tmpl });
      g.god = true;
      for (let i = 0; i < 60 * 15; i++) { g.tick(); p.hp = p.stats.vitality; }
      const o = bigBlock(g);
      // A spitter holding keepDist and a mortar in its stand-off band are not
      // failing to arrive — arriving is not what they do.
      const live = [...g.enemyPool].filter(e => e.active && e.def && CLOSERS.has(e.def.behavior) && !e.mortar);
      if (!o || !live.length) continue;
      staged++;
      const e = live[0];
      g.wave = { done: false, n: 0 }; g.spawnQueue.length = 0;
      const cy = o.y + o.h / 2;
      const px = Math.max(60, o.x - 90), ex = Math.min(g.W - 60, o.x + o.w + 90);
      p.x = px; p.y = cy; e.x = ex; e.y = cy;
      const CONTACT = p.radius + e.radius + 14;
      let got = null;
      for (let i = 0; i < 60 * 40; i++) {
        p.x = px; p.y = cy; p.hp = p.stats.vitality;
        for (const q of g.enemyPool) if (q.active && q !== e) g.enemyPool.release(q);
        g.tick();
        if (!e.active) { got = 'died'; break; }
        if (Math.hypot(e.x - p.x, e.y - p.y) <= CONTACT) { got = i / 60; break; }
      }
      if (typeof got === 'number' || got === 'died') arrived++;
      else worst.push(`${tmpl}/${seed} (${e.def.id}, stalled ${Math.hypot(e.x - p.x, e.y - p.y).toFixed(0)}u short)`);
    }
  }
  if (staged < 6) fail(`only ${staged} arrival runs staged — the fixture is not exercising the check`);
  else if (arrived === staged) ok(`${arrived}/${staged} closers reach a player standing behind a block (was 0/9 — none of them ever arrived)`);
  else fail(`${arrived}/${staged} arrived; still stalling: ${worst.join('; ')}`);
}

// ----------------------------------------------------------------- 4: spread
//
// Every minion ran the same query from nearly the same spot, so the pack walked
// one line and arrived as one body. Measured before the fix: at least one pair
// overlapping in 66-82% of frames across pack sizes 6, 8 and 11.
console.log('\n--- 4. a summoned pack spreads ---');
{
  for (const ranks of [3, 5, 8]) {
    const { g, p } = armTree('toh_necromancer', 'necro_summons', { ranks, level: 40 });
    let peak = 0, frames = 0, overlapping = 0;
    for (let i = 0; i < 60 * 60; i++) {
      g.tick(); pump(g, p);
      const ms = p.minions.filter(m => !m.down);
      peak = Math.max(peak, ms.length);
      if (ms.length < 2) continue;
      frames++;
      let tight = 0;
      for (let a = 0; a < ms.length; a++) {
        for (let b = a + 1; b < ms.length; b++) {
          if (Math.hypot(ms[a].x - ms[b].x, ms[a].y - ms[b].y) < ms[a].radius * 2) tight++;
        }
      }
      if (tight) overlapping++;
    }
    const pct = 100 * overlapping / Math.max(1, frames);
    if (frames < 60) fail(`ranks ${ranks}: pack never reached 2 standing minions — restage it`);
    else if (pct <= 15) ok(`ranks ${ranks}: peak pack ${peak}, overlapping pair in ${pct.toFixed(1)}% of frames (was 66-82%)`);
    else fail(`ranks ${ranks}: peak pack ${peak} still stacks — overlapping pair in ${pct.toFixed(1)}% of frames`);
  }
}

// ------------------------------------------------------------------ 5: boss
//
// `updateBoss` switches on `b.kit`. Both region bosses declare `telegraph` and
// `p2` and NO kit, and the switch had no default — so The Cedar Mother matched
// no case and ran no code. Parked a player 700 units away for 60s and the boss
// travelled 0 units, spent 0 frames winding up and dealt 0 damage.
//
// Two assertions, and the second is the guardrail. Threatening a player who
// stands off is the fix; a player who MOVES must still be able to dodge, or the
// fix has produced an undodgeable attack and defeated the whole telegraph
// system.
console.log('\n--- 5. region bosses fight, and are still dodgeable ---');
function stageBoss(regionIndex, { range, strafe, secs = 60 }) {
  const g = new Sim({ seed: 771, regionIndex, party: P('toh_blacksmith'), allowUnplayable: true });
  armAll(g, g.players[0]);
  g._travelTo(g.floor.nodes.find(n => n.depth > 1 && n.template && n.kind !== 'shrine').id);
  const p = g.players[0];
  g.wave = { done: true, n: 0 }; g.spawnQueue.length = 0;
  for (const e of g.enemyPool) if (e.active) g.enemyPool.release(e);
  g._spawnSiegeBoss();
  const b = g.boss;
  if (!b) return null;
  b.hp = 1e9; b.maxHp = 1e9;                   // the question is the boss's OUTPUT
  let dmg = 0, moved = 0, commits = 0, was = 0, lx = b.x, ly = b.y;
  for (let i = 0; i < 60 * secs; i++) {
    const ang = strafe ? i / 60 * 1.15 : 0;
    p.x = Math.max(60, Math.min(g.W - 60, b.x + Math.cos(ang) * range));
    p.y = Math.max(60, Math.min(g.H - 60, b.y + Math.sin(ang) * range));
    const h = p.hp;
    for (const e of g.enemyPool) if (e.active && e !== b) g.enemyPool.release(e);
    g.tick();
    if (p.hp < h) dmg += h - p.hp;
    p.hp = p.stats.vitality;
    moved += Math.hypot(b.x - lx, b.y - ly); lx = b.x; ly = b.y;
    if (was !== 1 && b.telState === 1) commits++;
    was = b.telState;
  }
  return { dmg, moved, commits };
}
for (const ri of [1, 2]) {
  const name = bossForRegion(ri).name;
  const still = stageBoss(ri, { range: 700, strafe: false });
  if (!still) { fail(`region ${ri}: no boss staged — restage it`); continue; }
  if (still.moved > 200 && still.commits > 0 && still.dmg > 0) {
    ok(`region ${ri}: ${name} at 700u vs a standing player — ${still.moved.toFixed(0)}u travelled, ${still.commits} commits, ${still.dmg.toFixed(0)} damage (was 0/0/0)`);
  } else {
    fail(`region ${ri}: ${name} is still a free kill at 700u — travelled ${still.moved.toFixed(0)}u, ${still.commits} commits, ${still.dmg.toFixed(0)} damage`);
  }
  const moving = stageBoss(ri, { range: 700, strafe: true });
  const ratio = still.dmg > 0 ? moving.dmg / still.dmg : 1;
  if (ratio <= 0.35) ok(`region ${ri}: ...and a player who keeps moving takes ${(ratio * 100).toFixed(0)}% of that — the commit still pays off`);
  else fail(`region ${ri}: moving barely helps (${(ratio * 100).toFixed(0)}% of standing damage) — this reads as an undodgeable attack`);
}
{
  // The commit rule, stated as a check rather than as a comment: the charge's
  // bearing is taken once and the boss travels THAT bearing, so a beam that
  // re-homed mid-wind-up would show up here as a moving zone.
  const g = new Sim({ seed: 771, regionIndex: 1, party: P('toh_blacksmith'), allowUnplayable: true });
  armAll(g, g.players[0]);
  g._travelTo(g.floor.nodes.find(n => n.depth > 1 && n.template && n.kind !== 'shrine').id);
  const p = g.players[0];
  g.wave = { done: true, n: 0 }; g.spawnQueue.length = 0;
  for (const e of g.enemyPool) if (e.active) g.enemyPool.release(e);
  g._spawnSiegeBoss();
  const b = g.boss;
  b.hp = 1e9; b.maxHp = 1e9;
  let drift = 0, samples = 0;
  for (let i = 0; i < 60 * 60; i++) {
    // Orbit the player HARD, so a tracking zone would visibly follow — and
    // INSIDE the phase-1 circle (radius 165), because a commit requires
    // somebody caught in the zone. Orbiting at 380 staged a boss that
    // correctly never committed and a check that proved nothing.
    const ang = i / 60 * 2.4;
    p.x = Math.max(60, Math.min(g.W - 60, b.x + Math.cos(ang) * 110));
    p.y = Math.max(60, Math.min(g.H - 60, b.y + Math.sin(ang) * 110));
    g.tick(); p.hp = p.stats.vitality;
    if (b.telState === 1 && b.telZone) {
      if (b._zAng === undefined) b._zAng = b.telZone.angle0;
      drift += Math.abs(b.telZone.angle0 - b._zAng); samples++;
    } else b._zAng = undefined;
  }
  if (samples === 0) fail('the boss never held a zone in 60s of orbiting — restage it');
  else if (drift === 0) ok(`the boss's committed zone never reaims: 0 rad of drift across ${samples} wind-up frames while the player orbited`);
  else fail(`the boss's zone drifted ${drift.toFixed(3)} rad during wind-up — it is tracking, and the commit rule is broken`);
}

// ------------------------------------------------------- audit, not a fix
//
// The brief asks which OTHER bosses can be beaten from out of reach. Answer:
// none, and the reason is worth writing down — the four legacy kit bosses all
// carry an attack with no range bound at all (projectile rings, volleys, adds,
// randomly-placed pools), so standing off was never a strategy against them.
// The defect was specific to the two region bosses and its cause was the
// missing switch default, not a short reach. Reported, not changed.
console.log('\n--- audit: reach of every boss (reported, not fixed) ---');
for (const b of ALL_BOSS_DEFS) {
  const parts = []; let max = 0;
  const note = (r, w) => { if (r > 0) { parts.push(`${w} ${r === Infinity ? '∞' : Math.round(r)}`); max = Math.max(max, r); } };
  if (b.charge) note(b.charge.speed * b.charge.dur, 'charge');
  if (b.slam) note(b.slam.radius, 'slam');
  if (b.beams) note(900, 'beams');
  for (const k of ['ring', 'volley', 'burst', 'vortex', 'pools', 'spawn']) if (b[k]) note(Infinity, k);
  if (b.p2 && b.p2.addId) note(Infinity, 'p2 adds');
  if (b.p2 && b.p2.spiral) note(Infinity, 'p2 spiral');
  if (b.telegraph) { const s = b.telegraph.shape; note(s.radius || s.range || s.length || 0, `zone(${s.kind})`); }
  console.log(`  ${b.id.padEnd(16)} ${(b.kit || '(telegraph)').padEnd(12)} reach ${max === Infinity ? 'unbounded' : `${max}u`}   [${parts.join(', ')}]`);
}

console.log(failures ? `\n${failures} COMBAT FAILURE(S)` : '\nALL FIVE COMBAT DEFECTS HELD SHUT');
process.exit(failures ? 1 : 0);
