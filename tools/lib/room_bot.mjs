// A BOT THAT PLAYS ONE ROOM, shared by every tool that needs one.
//
// tools/map1_bot.mjs and tools/pace_measure.mjs each carry their own kite and
// are wired to region 1's first map. Everything measured past that map needs
// the same three things — a character standing where its skills connect, a
// room walked into the way the game walks into it, and a loop that answers
// the offers a fight raises — and writing them a third and fourth time is how
// two tools come to disagree about what "a fight" is.
import { SKILL_BY_ID } from '../../js/skills.js';
import { rangeOfStep } from '../../js/skilltext.js';

// WHERE THE BOT STANDS IS PART OF THE BUILD. A flat 190-unit ring for every
// class reported the five melee classes getting WORSE with level — Samurai
// 5.4 kills/s in region 1 and 3.0 in region 8. They were not worse: a sword
// reaches about 100, so the bot stood outside every strike it had slotted.
// tools/map1_bot.mjs learned the same about Rip and Headbutt ("the ring
// follows the opener's hit, not the distance that merely lets it fire").
//
// So the ring is the SHORTEST reach among the slotted skills that deal damage,
// times 0.85 — a player stands where everything they slotted connects —
// clamped to [60, 200].
const DAMAGING = new Set(['strike', 'bolt', 'cone', 'line', 'drain', 'channel', 'plague', 'hazard', 'trap']);
export function reachOf(skill) {
  if (!skill) return 0;
  let hit = 0, damaging = false;
  for (const step of skill.compose || []) {
    if (DAMAGING.has(step.kind)) damaging = true;
    const r = rangeOfStep(step);
    if (r > hit) hit = r;
  }
  if (!damaging) return 0;
  const t = skill.trigger || {};
  const gate = t.range || t.radius || 0;
  if (hit > 0 && gate > 0) return Math.min(hit, gate);
  return hit || gate || 0;
}
export function ringFor(p) {
  const reaches = p.loadout.filter(Boolean).map(id => reachOf(SKILL_BY_ID[id])).filter(r => r > 0);
  if (!reaches.length) return 190;
  return Math.max(60, Math.min(200, Math.min(...reaches) * 0.85));
}

// The balance_probe kite, reduced to its three rules: hold a ring off the
// crowd, close on the nearest body when nothing is inside it, stay off the
// walls. `dodge` adds the two a mortal needs — step out of a committed zone
// and away from an incoming shot.
export function botInput(sim, p, ring, { dodge = false, loot = true } = {}) {
  let vx = 0, vy = 0, nearest = null, nd = Infinity;
  // LOOT. A player picks things up; a bot that does not under-reports every
  // yield it measures, and reported a boss room paying 0.02 levels because it
  // stood still beside the boss's whole drop. With nothing alive it walks the
  // field; in a fight it leans toward what is close, as a player does.
  if (loot && sim.pickups && sim.pickups.length) {
    let best = null, bd = Infinity;
    for (const k of sim.pickups) { const d2 = (k.x - p.x) ** 2 + (k.y - p.y) ** 2; if (d2 < bd) { bd = d2; best = k; } }
    if (best) {
      const d = Math.sqrt(bd) || 1;
      const quiet = sim.enemyPool.count === 0;
      if (quiet) { sim.setInput(p.idx, { mx: (best.x - p.x) / d, my: (best.y - p.y) / d }); return; }
      if (d < 220) { vx += (best.x - p.x) / d * 1.1; vy += (best.y - p.y) / d * 1.1; }
    }
  }
  for (const e of sim.enemyPool) {
    const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
    if (d2 < nd) { nd = d2; nearest = e; }
    const d = Math.sqrt(d2) || 1;
    if (d < ring) { const w = (ring - d) / ring; vx += dx / d * w * 3; vy += dy / d * w * 3; }
  }
  if (nearest && nd > (ring + 30) * (ring + 30)) { const d = Math.sqrt(nd); vx += (nearest.x - p.x) / d * 1.6; vy += (nearest.y - p.y) / d * 1.6; }
  if (dodge) {
    for (const pr of sim.projPool) {
      if (pr.friendly) continue;
      const d = Math.hypot(p.x - pr.x, p.y - pr.y) || 1;
      if (d < 110) { vx += (p.x - pr.x) / d * 2.5; vy += (p.y - pr.y) / d * 2.5; }
    }
    // Committed enemy zones: leave by the shortest way. Circles push straight
    // out; lanes and cones push across their axis, which is the sidestep.
    for (const t of sim.telegraphZones()) {
      const z = t.z; if (!z) continue;
      if (z.kind === 'circle') {
        const d = Math.hypot(p.x - z.x, p.y - z.y) || 1;
        if (d < z.radius + 30) { vx += (p.x - z.x) / d * 5; vy += (p.y - z.y) / d * 5; }
      } else {
        const ax = Math.cos(z.angle || 0), ay = Math.sin(z.angle || 0);
        const rx = p.x - z.x, ry = p.y - z.y;
        const along = rx * ax + ry * ay, across = -rx * ay + ry * ax;
        const len = z.length || z.range || 0;
        const half = z.kind === 'line' ? (z.width || 0) / 2 + 26 : Math.tan(((z.angleDeg || z.arc || 90) * Math.PI / 180) / 2) * Math.max(0, along) + 26;
        if (along > -20 && along < len + 30 && Math.abs(across) < half) {
          const s = across >= 0 ? 1 : -1;
          vx += -ay * s * 5; vy += ax * s * 5;
        }
      }
    }
    for (const tg of sim.telegraphs || []) {
      if (tg.shape === 'circle' && !tg.spawnMark) {
        const d = Math.hypot(p.x - tg.x, p.y - tg.y) || 1;
        if (d < tg.r + 24) { vx += (p.x - tg.x) / d * 4; vy += (p.y - tg.y) / d * 4; }
      }
    }
  }
  const m = 140;
  if (p.x < m) vx += (m - p.x) / m * 3; if (p.x > sim.W - m) vx -= (p.x - (sim.W - m)) / m * 3;
  if (p.y < m) vy += (m - p.y) / m * 3; if (p.y > sim.H - m) vy -= (p.y - (sim.H - m)) / m * 3;
  const l = Math.hypot(vx, vy);
  sim.setInput(p.idx, l > 0.05 ? { mx: vx / l, my: vy / l } : { mx: 0, my: 0 });
}

// Answer whatever the fight raises, so a room never stalls on a modal. Stat
// cards are left BANKED: a harness that wants them spent says so through
// tools/lib/build_char.mjs, with a stated policy.
export function answerOffers(sim, p) {
  if (p.boonOffer) sim.uiAction(p.idx, { kind: 'boon', id: p.boonOffer[0].id });
}

// Walk a sim into the first node at `depth` (0-based) of the given kind.
// One travel per sim — a second would carry the first room's state.
export function enterNode(sim, depth, kind = 'combat') {
  const node = sim.floor.nodes.find(n => n.kind === kind && (n.depth || 1) === depth + 1);
  if (!node) return null;
  sim._travelTo(node.id);
  return sim.phase === 'arena' ? node : null;
}

// XP a character needs to go from level `from` to `from + n` (both may be
// fractional), on the game's own cost: level L → L+1 costs base + per × L.
export function xpForLevels(from, n, base = 10, per = 4) {
  let need = 0, at = from, left = n;
  while (left > 1e-9) {
    const L = Math.floor(at + 1e-9);
    const span = Math.min(left, L + 1 - at);
    need += span * (base + per * L);
    at += span; left -= span;
  }
  return need;
}
