// Five solo Standard map-1 fights. No god mode.
//
// The default bot is the balance_probe kite (tools/balance_probe.mjs): same
// telegraph dodge, same level-up pick (the first card), same
// opening (left for the arena floor, which grants that same first card).
// `--chase` walks onto the nearest enemy instead of holding the ring, with a
// small sidestep so a reach strike and a movement strike both connect. It
// does not dodge shots; the kite does. The kite run is the reference.
// `--class` picks who walks in. The default is the samurai.
//
// THE KITE RING FOLLOWS THE OPENER'S HIT, not the distance that merely lets
// it fire. With no weapon the ring used to be a flat 200, outside both Rip
// and Headbutt, so those openers never connected. It is min(200, hit × 0.85).
// The hit is the compose step's reach (the same number the card prints as
// Range). A proximity trigger can be wider than the swing — Headbutt fires
// at 116 and the swing connects at its reach — and standing on the fire gate
// whiffs. A step with no reach of its own falls back to the trigger. A
// telegraph is dodged only when the body — grown by its radius and by the
// distance this input would walk before the strike lands — is inside the
// real shape, or the segment between those two points crosses it. Inside,
// the step is the shortest way out. Already outside, only the part of the
// kite vector that would enter the shape is removed, and the rest is kept.
// A warning does not make the bot stand still. The step-in past ring+30
// and the chase path are unchanged. A weapon still uses the weapon ring.
//
// SKILL POINTS. By default the bot spends them, including points that arrive
// mid-fight, with `{kind:'learnSkill'}` — the action a player sends. It draws
// no RNG. The choice walks the class's trees in registry order and each tree's
// skills in authored order:
//   1. the first still-unlearned tier-2 skill `canLearn` accepts (opens at level 3)
//   2. the first still-unlearned tier-3 skill `canLearn` accepts (opens at level 5)
//   3. otherwise a rank on the tier-1 skill already known
// A prereq the bot has not bought is skipped, so Necromancer's Dark Matter Bomb
// waits until Blip is owned. Newly learned actives ride the engine's auto-slot.
//
// With no `--opener`, step 1's tier-1 is the class's first tier-1 in that same
// registry order. The run prints that default for every class before the seeds.
// On the classes this probe is usually run for, the chain that falls out is:
//   toh_necromancer  Dark Energy Blip → Dark Matter Bomb → Tainted Dark Matter
//   toh_bard         Opening Note → Quickstep → Counterpoint
//   toh_sundian      Spindrift → Souse → Rip Current
//   toh_samurai      Cross Guard Cut → Set Stance (a passive, max rank 1).
//                    Armor has no tier-3 node, so further points rank the cut.
//
// `--opener <skillId>` spends the level-1 point on that tier-1 skill instead.
// Tier 2 is then the first purchasable skill that lists it as `prereq`, and
// tier 3 is the first purchasable skill that lists that tier-2 node as
// `prereq`. A chain with no such node falls back to the registry walk above.
// The id has to be a tier-1 skill of the class being run. It spends a point,
// so it is not combined with `--no-learn`.
//
// `--no-learn` spends nothing. The floor still grants the opening skill, and
// the earlier chase tables stay reproducible.
//
// Usage: node tools/map1_bot.mjs [--chase] [--no-learn] [--opener <skillId>] [--class <id>] [charId] [seed ...]
// Default class: toh_samurai. Default seeds: 777, 0xa11ce, 424242, 20260728, 99.

import { Sim } from '../js/game.js';
import { dist2 } from '../js/util.js';
import { angleDelta, inZone } from '../js/compose.js';
import { WEAPON_BY_ID } from '../js/content/weapons.js';
import { CHAR_BY_ID } from '../js/content/characters.js';
import { isOnboardingNode, ONBOARDING_LEVEL_FLOOR } from '../js/arenas.js';
import { CONFIG } from '../js/config.js';
import { TREES, TREES_BY_CLASS, SKILL_BY_ID, canLearn } from '../js/skills.js';
import { rangeOfStep } from '../js/skilltext.js';

const DEFAULT_SEEDS = [777, 0xa11ce, 424242, 20260728, 99];
const FIGHT_CAP_S = 200;

function parseArgs(argv) {
  let chase = false;
  let learn = true;
  let charId = 'toh_samurai';
  let openerId = null;
  const seeds = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--chase') { chase = true; continue; }
    if (a === '--no-learn') { learn = false; continue; }
    if (a === '--opener') {
      openerId = argv[++i];
      if (!openerId || openerId.startsWith('--')) {
        console.error('map1_bot: --opener needs a tier-1 skill id');
        process.exit(1);
      }
      continue;
    }
    if (a.startsWith('--opener=')) { openerId = a.slice('--opener='.length); continue; }
    if (a === '--class') {
      const id = argv[++i];
      if (!id) {
        console.error('map1_bot: --class needs a character id');
        process.exit(1);
      }
      charId = id;
      continue;
    }
    if (a.startsWith('--class=')) { charId = a.slice('--class='.length); continue; }
    if (a.startsWith('--')) {
      console.error(`map1_bot: unknown option ${a}`);
      process.exit(1);
    }
    const n = Number(a);
    if (Number.isFinite(n) && a !== '') seeds.push(n);
    else charId = a;
  }
  if (!CHAR_BY_ID[charId]) {
    console.error(`map1_bot: unknown class ${charId}`);
    process.exit(1);
  }
  return { chase, learn, charId, openerId, seeds: seeds.length ? seeds : DEFAULT_SEEDS };
}

const { chase, learn, charId, openerId, seeds: list } = parseArgs(process.argv);

// Distance at which the opener's hit connects. A strike's `reach` and a
// bolt's `range` are that distance — the card's Range field reads the same
// helper. The trigger's radius is only the fire gate, and on Headbutt it is
// wider than the swing, so the ring uses the shorter of the two. A step with
// no reach of its own (a plague) keeps the trigger.

// Move speed the sim will apply to a full input, Tempo included. The dodge
// predicts with this rather than with a pad around the paint.
function moveSpeed(p) {
  return Math.max(60, CONFIG.BASE_SPEED * (1 + ((p.stats && p.stats.tempo) || 0) / 100));
}

// A player telegraph and an enemy zone do not share field names. `inZone`
// wants the enemy-zone shape, which is also what the hit test uses.
function asZone(tg) {
  if (!tg) return null;
  if (tg.kind === 'line' || tg.kind === 'circle' || tg.kind === 'cone') return tg;
  const kind = tg.shape;
  if (kind === 'circle' || kind === 'c') return { kind: 'circle', x: tg.x, y: tg.y, radius: tg.radius ?? tg.r ?? 0 };
  if (kind === 'beam' || kind === 'line') {
    return {
      kind: 'line', x: tg.x, y: tg.y, angle0: tg.angle0 ?? tg.angle ?? 0,
      length: tg.length ?? tg.len ?? 0, width: tg.width ?? tg.w ?? 0,
    };
  }
  if (kind === 'cone') {
    return { kind: 'cone', x: tg.x, y: tg.y, angle0: tg.angle0 ?? 0, angle: tg.angle || 0, range: tg.range || 0 };
  }
  return null;
}

// Shortest step that puts the body centre outside the shape. Null when it
// is already outside. Lanes may leave off either side or either end; the
// near edge wins, so a body at the mouth of a lane backs out instead of
// running the length.
function shortestExit(z, x, y, radius) {
  if (!inZone(z, x, y, radius)) return null;
  if (z.kind === 'line') {
    const ang = z.angle0 || 0;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const dx = x - z.x, dy = y - z.y;
    const along = dx * ca + dy * sa;
    const across = -dx * sa + dy * ca;
    const side = across >= 0 ? 1 : -1;
    const dSide = (z.width || 0) / 2 + radius - Math.abs(across);
    const dBack = along + radius;
    const dFwd = (z.length || 0) + radius - along;
    let best = dSide, bx = -sa * side, by = ca * side;
    if (dBack < best) { best = dBack; bx = -ca; by = -sa; }
    if (dFwd < best) { best = dFwd; bx = ca; by = sa; }
    const n = Math.hypot(bx, by) || 1;
    return { x: bx / n, y: by / n, dist: Math.max(0, best) };
  }
  if (z.kind === 'circle') {
    const dx = x - z.x, dy = y - z.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d, dist: Math.max(0, (z.radius || 0) + radius - d) };
  }
  if (z.kind === 'cone') {
    const dx = x - z.x, dy = y - z.y;
    const d = Math.hypot(dx, dy) || 1;
    const delta = angleDelta(Math.atan2(dy, dx), z.angle0 || 0);
    const half = (z.angle || 0) / 2;
    const side = delta >= 0 ? 1 : -1;
    const dSide = d * Math.sin(Math.max(0, half - Math.abs(delta)));
    const sx = side >= 0 ? -dy / d : dy / d;
    const sy = side >= 0 ? dx / d : -dx / d;
    const dOut = Math.max(0, (z.range || 0) + radius - d);
    if (d < 1 || dOut <= dSide) return { x: dx / d, y: dy / d, dist: d < 1 ? (z.range || 0) + radius : dOut };
    return { x: sx, y: sy, dist: dSide };
  }
  return null;
}

// The body now, the body where this input will have carried it when the
// strike lands, and the segment between them. A strike hits at resolve, so
// a shape the bot is walking past without entering is not a dodge.
function pathInside(z, x, y, mx, my, travel, radius) {
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = travel * (i / n);
    const px = x + mx * t, py = y + my * t;
    if (inZone(z, px, py, radius)) return { x: px, y: py };
  }
  return null;
}

// HP actually lost, split by what landed it. Contact is a body touch.
// Lanes and cones are the committed telegraph. A hostile projectile in
// reach at the moment of the hit is a shot; anything else with no attacker
// (a ground hazard, a beam) is other.
function attachDamageLedger(sim, p) {
  const dmg = { contact: 0, lanes: 0, cones: 0, projectiles: 0, other: 0 };
  const orig = sim.hurtPlayer.bind(sim);
  sim.hurtPlayer = (target, raw, from, opts = {}) => {
    const before = target.hp;
    const wasDown = !!target.downed;
    orig(target, raw, from, opts);
    if (target !== p || wasDown) return;
    const lost = Math.max(0, before - Math.max(0, target.hp));
    if (lost <= 0) return;
    let bucket = 'other';
    if (opts.telegraph && from && from.telZone) {
      const k = from.telZone.kind;
      bucket = k === 'line' ? 'lanes' : k === 'cone' ? 'cones' : 'other';
    } else if (from && from.def) {
      bucket = 'contact';
    } else if (!from) {
      let shot = false;
      for (const pr of sim.projPool) {
        if (pr.friendly) continue;
        if (Math.hypot(pr.x - target.x, pr.y - target.y) < (pr.radius || 8) + (target.radius || 0) + 12) {
          shot = true;
          break;
        }
      }
      bucket = shot ? 'projectiles' : 'other';
    }
    dmg[bucket] += lost;
  };
  return dmg;
}

function openerReach(skill) {
  if (!skill) return 0;
  let hit = 0;
  for (const step of skill.compose || []) {
    const r = rangeOfStep(step);
    if (r > hit) hit = r;
  }
  const t = skill.trigger || {};
  const gate = t.range || t.radius || 0;
  if (hit > 0 && gate > 0) return Math.min(hit, gate);
  return hit || gate || 0;
}

// The class's registry opener: first tier-1 of the first tree.
function defaultOpener(id) {
  for (const tid of TREES_BY_CLASS[id] || []) {
    const sk = TREES[tid].skills.find(s => s.tier === 1);
    if (sk) return sk;
  }
  return null;
}

if (openerId && !learn) {
  console.error('--opener spends the level-1 point, so it cannot be combined with --no-learn');
  process.exit(1);
}
if (openerId) {
  const sk = SKILL_BY_ID[openerId];
  const trees = TREES_BY_CLASS[charId] || [];
  if (!sk || sk.tier !== 1 || !trees.includes(sk.tree)) {
    console.error(`--opener ${openerId} is not a tier-1 skill of ${charId}`);
    process.exit(1);
  }
}

// No weapon: hold inside the opener's hit. 0.85 of that reach, and never
// past the old 200. A ranged opener whose hit is past 200/0.85 stays at 200.
const OPENER_SKILL = openerId ? SKILL_BY_ID[openerId] : defaultOpener(charId);
const OPENER_REACH = openerReach(OPENER_SKILL);
const KITE_RING = OPENER_REACH > 0 ? Math.min(200, OPENER_REACH * 0.85) : 200;

function classSkills(id) {
  const out = [];
  for (const tid of TREES_BY_CLASS[id] || []) {
    for (const sk of TREES[tid].skills) out.push(sk);
  }
  return out;
}

// First skill at `tier` the engine will sell right now and the bot does not own.
function unlearnedAtTier(p, tier) {
  for (const sk of classSkills(p.charId)) {
    if (sk.tier !== tier) continue;
    if ((p.skillRanks[sk.id] || 0) >= 1) continue;
    if (canLearn(p, sk)) return sk;
  }
  return null;
}

function tierOne(p) {
  const skills = classSkills(p.charId);
  return skills.find(s => s.tier === 1 && (p.skillRanks[s.id] || 0) >= 1)
    || skills.find(s => s.tier === 1 && canLearn(p, s))
    || null;
}

// The tier-1 this run is building from. `--opener` wins once it is owned;
// otherwise the tier-1 already known, which is the registry opener.
function ownedOpener(p) {
  if (openerId && (p.skillRanks[openerId] || 0) >= 1) return SKILL_BY_ID[openerId];
  return classSkills(p.charId).find(s => s.tier === 1 && (p.skillRanks[s.id] || 0) >= 1) || null;
}

// First still-unlearned skill at `tier` whose prereq is `prereqId` and that
// `canLearn` will sell. Registry order, so two children of the same node
// resolve the same way every run.
function firstChain(p, tier, prereqId) {
  if (!prereqId) return null;
  for (const sk of classSkills(p.charId)) {
    if (sk.tier !== tier || sk.prereq !== prereqId) continue;
    if ((p.skillRanks[sk.id] || 0) >= 1) continue;
    if (canLearn(p, sk)) return sk;
  }
  return null;
}

// The chain node itself, learned or not, so tier 3 can name its prerequisite
// before that tier-2 point is spent.
function chainNode(p, tier, prereqId) {
  if (!prereqId) return null;
  for (const sk of classSkills(p.charId)) {
    if (sk.tier === tier && sk.prereq === prereqId) return sk;
  }
  return null;
}

function nextSkill(p) {
  if (openerId && (p.skillRanks[openerId] || 0) < 1) {
    const op = SKILL_BY_ID[openerId];
    if (canLearn(p, op)) return op;
  }
  const owned = ownedOpener(p);
  const rootId = owned ? owned.id : null;
  const t2 = firstChain(p, 2, rootId) || unlearnedAtTier(p, 2);
  const t2node = chainNode(p, 2, rootId);
  const t3 = firstChain(p, 3, t2node && t2node.id) || unlearnedAtTier(p, 3);
  return t2 || t3 || tierOne(p);
}

// Spend every banked point. New nodes are recorded; rank-ups are returned so
// the map-1 catch-up can say where its points went. A rejected spend stops the
// loop rather than spinning.
function spendSkills(sim, p, learned) {
  const spent = [];
  let guard = 0;
  while (p.skillPoints > 0 && guard++ < 40) {
    const before = p.skillPoints;
    const target = nextSkill(p);
    if (!target) break;
    const rankBefore = p.skillRanks[target.id] || 0;
    sim.uiAction(p.idx, { kind: 'learnSkill', id: target.id });
    if ((p.skillPoints | 0) >= before) break;
    const fresh = rankBefore < 1;
    if (fresh) {
      learned.push({
        id: target.id,
        level: p.level,
        t: sim.time,
        active: target.type === 'active',
        slotted: target.type !== 'active' || (p.loadout || []).includes(target.id),
      });
    }
    spent.push({ id: target.id, rank: p.skillRanks[target.id], fresh, level: p.level, t: sim.time });
  }
  return spent;
}

function waveTotal(sim) {
  const w = sim.wave;
  if (!w || !Number.isFinite(w.dur)) return 0;
  const rateMult = (sim.profile && sim.profile.rateMult) || 1;
  const countMult = (sim.fightMods && sim.fightMods.count) || 1;
  const expected = ((w.r0 + w.r1) / 2) * w.dur * sim.coopSpawn * CONFIG.spawnBudgetMult * rateMult * countMult;
  return Math.floor(expected + 1e-6);
}

function runSeed(seed) {
  const sim = new Sim({
    seed, difficulty: 'standard', regionIndex: 1,
    party: [{ idx: 0, key: 'k', name: 'BOT', charId, color: '#fff' }],
  });
  const p = sim.players[0];
  const dmg = attachDamageLedger(sim, p);

  let dodgeTicks = 0;

  function botInput() {
    const mopUp = sim.wave && sim.wave.done && sim.enemyPool.count <= 12;
    const wdef = p.weapons[0] ? WEAPON_BY_ID[p.weapons[0].id] : null;
    const melee = wdef && (wdef.cls === 'swing' || wdef.cls === 'thrust');
    const ring = wdef ? (melee ? Math.max(70, wdef.range * 0.75) : (mopUp ? 110 : 230)) : KITE_RING;
    let vx = 0, vy = 0;
    let nearest = null, nd = Infinity, count = 0;
    for (const e of sim.enemyPool) {
      const d2 = dist2(p.x, p.y, e.x, e.y);
      if (d2 < nd) { nd = d2; nearest = e; }
      count++;
      if (chase) continue;
      const d = Math.sqrt(d2) || 1;
      if (d < ring) {
        const w = (ring - d) / ring;
        vx += (p.x - e.x) / d * w * 3;
        vy += (p.y - e.y) / d * w * 3;
      }
    }
    if (chase && nearest) {
      const d = Math.sqrt(nd) || 1;
      vx += (nearest.x - p.x) / d * 4;
      vy += (nearest.y - p.y) / d * 4;
      // Stay on the body and keep moving, so a reach strike and a
      // movement strike both connect. The sidestep is smaller than the chase.
      vx += (-(nearest.y - p.y)) / d * 0.7;
      vy += ((nearest.x - p.x)) / d * 0.7;
    }
    if (!chase) for (const pr of sim.projPool) {
      if (pr.friendly) continue;
      const d = Math.hypot(p.x - pr.x, p.y - pr.y) || 1;
      if (d < 110) { vx += (p.x - pr.x) / d * 2.5; vy += (p.y - pr.y) / d * 2.5; }
    }
    if (!chase && nearest && nd > (ring + 30) * (ring + 30)) {
      const d = Math.sqrt(nd);
      vx += (nearest.x - p.x) / d * 1.6;
      vy += (nearest.y - p.y) / d * 1.6;
    }
    if (mopUp && melee && nearest) {
      const d = Math.sqrt(nd) || 1;
      vx = (nearest.x - p.x) / d * 4;
      vy = (nearest.y - p.y) / d * 4;
    }
    const cx = sim.W / 2 - p.x, cy = sim.H / 2 - p.y;
    const edge = Math.min(p.x, sim.W - p.x, p.y, sim.H - p.y);
    if (edge < 150) { const cl = Math.hypot(cx, cy) || 1; vx += cx / cl * 2.2; vy += cy / cl * 2.2; }
    for (const o of sim.obstacles) {
      const ox = o.x + o.w / 2, oy = o.y + o.h / 2;
      const d = Math.hypot(p.x - ox, p.y - oy) || 1;
      if (d < Math.max(o.w, o.h) / 2 + 60) { vx += (p.x - ox) / d * 1.8; vy += (p.y - oy) / d * 1.8; }
    }
    for (const hz of sim.hazards || []) {
      if (hz.type === 'lava') {
        const d = Math.hypot(p.x - hz.x, p.y - hz.y) || 1;
        if (d < hz.r + 50) { vx += (p.x - hz.x) / d * 4; vy += (p.y - hz.y) / d * 4; }
      } else if (p.x > hz.x - 30 && p.x < hz.x + hz.w + 30 && p.y > hz.y - 30 && p.y < hz.y + hz.h + 30) {
        const ox = hz.x + hz.w / 2, oy = hz.y + hz.h / 2;
        const d = Math.hypot(p.x - ox, p.y - oy) || 1;
        vx += (p.x - ox) / d * 4; vy += (p.y - oy) / d * 4;
      }
    }
    if (sim.pickups.length) {
      let nd2 = Infinity, mx = 0, my = 0;
      for (const m of sim.pickups) {
        const d2 = (m.x - p.x) * (m.x - p.x) + (m.y - p.y) * (m.y - p.y);
        if (d2 < nd2) { nd2 = d2; mx = m.x; my = m.y; }
      }
      const sweep = sim.wave && sim.wave.done && sim.enemyPool.count <= 8;
      if (sweep) {
        const d = Math.sqrt(nd2) || 1;
        vx += (mx - p.x) / d * 3; vy += (my - p.y) / d * 3;
      } else if (nd2 < 300 * 300) {
        const d = Math.sqrt(nd2) || 1;
        vx += (mx - p.x) / d * 0.8; vy += (my - p.y) / d * 0.8;
      }
    }
    // Inside a live shape, step out the short way. Outside, keep kiting away
    // from melee. A path that would enter loses only its into-shape part;
    // whatever is left is still walked. If that part is nothing, the nearest
    // heading to the kite that stays out is used. The input is never zeroed
    // by a warning.
    const ilen = Math.hypot(vx, vy);
    const imx = ilen > 0 ? vx / ilen : 0;
    const imy = ilen > 0 ? vy / ilen : 0;
    const speed = moveSpeed(p);
    const radius = p.radius || 0;
    let step = null;
    const threats = [];
    const consider = (z, timeLeft) => {
      if (!z || !(timeLeft > 0)) return;
      if (inZone(z, p.x, p.y, radius)) {
        const exit = shortestExit(z, p.x, p.y, radius);
        if (!exit) return;
        if (!step || timeLeft < step.timeLeft || (timeLeft === step.timeLeft && exit.dist < step.dist)) {
          step = { x: exit.x, y: exit.y, timeLeft, dist: exit.dist };
        }
        return;
      }
      if (ilen > 0 && pathInside(z, p.x, p.y, imx, imy, speed * timeLeft, radius)) {
        threats.push({ z, timeLeft });
      }
    };
    for (const tg of sim.telegraphs) {
      if (tg.spawnMark) continue;
      consider(asZone(tg), (tg.dur || 0) - (tg.t || 0));
    }
    for (const tz of sim.telegraphZones()) consider(tz.z, (tz.msLeft || 0) / 1000);
    const staysOut = (mx, my) => {
      for (const t of threats) {
        if (pathInside(t.z, p.x, p.y, mx, my, speed * t.timeLeft, radius)) return false;
      }
      return true;
    };
    if (step) {
      sim.setInput(0, { mx: step.x, my: step.y });
      dodgeTicks++;
    } else if (threats.length) {
      const ordered = threats.slice().sort((a, b) => a.timeLeft - b.timeLeft);
      let mx = imx, my = imy;
      for (const t of ordered) {
        const hit = pathInside(t.z, p.x, p.y, mx, my, speed * t.timeLeft, radius);
        if (!hit) continue;
        const exit = shortestExit(t.z, hit.x, hit.y, radius);
        if (!exit) continue;
        const inward = -(mx * exit.x + my * exit.y);
        if (inward > 0) { mx += inward * exit.x; my += inward * exit.y; }
      }
      const keep = Math.hypot(mx, my);
      let chosen = null;
      if (keep > 1e-3 && staysOut(mx / keep, my / keep)) chosen = { mx: mx / keep, my: my / keep };
      if (!chosen) {
        const base = Math.atan2(imy, imx);
        for (let deg = 0; deg <= 180 && !chosen; deg += 8) {
          const signs = deg === 0 || deg === 180 ? [1] : [1, -1];
          for (const sign of signs) {
            const a = base + sign * deg * Math.PI / 180;
            const cx = Math.cos(a), cy = Math.sin(a);
            if (staysOut(cx, cy)) { chosen = { mx: cx, my: cy }; break; }
          }
        }
      }
      if (!chosen) {
        const soon = ordered[0];
        const hit = pathInside(soon.z, p.x, p.y, imx, imy, speed * soon.timeLeft, radius);
        const exit = hit && shortestExit(soon.z, hit.x, hit.y, radius);
        if (exit) {
          const tx = -exit.y, ty = exit.x;
          const s = (imx * tx + imy * ty) >= 0 ? 1 : -1;
          chosen = { mx: tx * s, my: ty * s };
        } else chosen = { mx: imx || 1, my: imy };
      }
      sim.setInput(0, { mx: chosen.mx, my: chosen.my });
      dodgeTicks++;
    } else {
      const len = ilen || 1;
      sim.setInput(0, { mx: vx / len, my: vy / len });
    }
  }

  function resolveUi() {
    let g = 0;
    while (p.pendingOffer && g++ < 30) sim.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  }

  const learned = [];
  if (learn) spendSkills(sim, p, learned);

  const starts = sim.reachableNodes();
  const nodeId = starts.find(id => isOnboardingNode(sim.regionIndex, sim.floor.nodes[id])) ?? starts[0];
  const node = sim.floor.nodes[nodeId];
  sim.uiAction(0, { kind: 'pickNode', nodeId });
  if (sim.phase !== 'arena' || !isOnboardingNode(sim.regionIndex, sim.arenaNode)) {
    return { seed, outcome: 'error', dodgeTicks: 0, detail: `did not enter map 1 (phase ${sim.phase}, node ${node && node.kind})` };
  }

  let spawned = 0;
  const origSpawn = sim.spawnEnemyById.bind(sim);
  sim.spawnEnemyById = (...args) => { const e = origSpawn(...args); if (e) spawned++; return e; };

  const cap = FIGHT_CAP_S * 60;
  let ticks = 0, peak = 0;
  const casts = {};
  let topUp = null;
  while (sim.phase === 'arena' && !sim.over && !sim.cleared && ticks++ < cap) {
    botInput();
    const lvl0 = p.level;
    sim.tick();
    for (const f of sim.fx.skillFires) {
      if (f.idx !== 0) continue;
      casts[f.id] = (casts[f.id] || 0) + 1;
    }
    const spent = learn ? spendSkills(sim, p, learned) : [];
    if (topUp === null && sim.cleared && lvl0 < ONBOARDING_LEVEL_FLOOR
        && p.level >= ONBOARDING_LEVEL_FLOOR && p.xp === 0) {
      topUp = { from: lvl0, to: p.level, spends: spent };
    }
    peak = Math.max(peak, sim.enemyPool.count);
    if (ticks % 30 === 0) resolveUi();
  }

  const left = {};
  for (const e of sim.enemyPool) {
    const k = e.def ? e.def.id : '?';
    left[k] = (left[k] || 0) + 1;
  }
  let outcome = 'stall';
  if (sim.cleared || sim.phase === 'map') outcome = 'clear';
  else if (sim.over) outcome = 'death';
  return {
    seed,
    outcome,
    secs: +(ticks / 60).toFixed(1),
    peak,
    kills: sim.payout.kills,
    total: (sim.wave && sim.wave.done && sim.spawnQueue.length === 0 && (sim.wave.held || 0) === 0 && sim.wave.acc < 1)
      ? spawned : waveTotal(sim),
    alive: sim.enemyPool.count,
    queue: sim.spawnQueue.length,
    waveDone: !!(sim.wave && sim.wave.done),
    hp: Math.round(p.hp),
    maxHp: p.stats.vitality,
    level: p.level,
    left,
    node: `${node.kind}/${node.template}`,
    learned,
    casts,
    dmg,
    dodgeTicks,
    topUp,
    unspent: p.skillPoints,
    loadout: (p.loadout || []).filter(Boolean),
  };
}

console.log('OPENERS\tdefault tier-1, registry order');
for (const id of Object.keys(TREES_BY_CLASS)) {
  const sk = defaultOpener(id);
  console.log(`OPENER\t${id}\t${sk ? sk.id : '?'}\t${sk ? sk.name : ''}`);
}
if (openerId) {
  const sk = SKILL_BY_ID[openerId];
  console.log(`CHOSEN\t${charId}\t${sk.id}\t${sk.name}`);
}

const rows = list.map(runSeed);
let clears = 0, deaths = 0, stalls = 0;
for (const r of rows) {
  if (r.outcome === 'clear') clears++;
  else if (r.outcome === 'death') deaths++;
  else stalls++;
  const tag = r.seed === 0xa11ce ? '0xa11ce' : String(r.seed);
  console.log(`${tag}\t${r.outcome}\t${r.secs}s\tkills ${r.kills}/${r.total}\tpeak ${r.peak}\thp ${r.hp}/${r.maxHp}\tlvl ${r.level}\talive ${r.alive} waveDone ${r.waveDone} ${r.node || ''} ${r.left ? JSON.stringify(r.left) : r.detail || ''}`);
  if (r.dmg) {
    const d = r.dmg;
    console.log(`DMG\t${tag}\tcontact ${d.contact}\tlanes ${d.lanes}\tcones ${d.cones}\tprojectiles ${d.projectiles}\tother ${d.other}`);
  }
  console.log(`DODGE\t${tag}\t${((r.dodgeTicks || 0) / 60).toFixed(1)}s`);
  if (learn && r.learned) {
    for (const L of r.learned) {
      const slotted = L.active ? ((r.loadout || []).includes(L.id) ? 'slotted' : 'NOT SLOTTED') : 'passive';
      const n = (r.casts && r.casts[L.id]) || 0;
      const cast = L.active ? (n > 0 ? `casts ${n}` : 'NO CAST') : 'no cast';
      console.log(`LEARN\t${tag}\t${L.id}\tlvl ${L.level}\tt ${L.t.toFixed(2)}s\t${slotted}\t${cast}`);
    }
    const castLine = Object.entries(r.casts || {}).map(([id, n]) => `${id} ${n}`).join('  ');
    console.log(`CASTS\t${tag}\t${castLine || '(none)'}`);
    if (r.topUp) {
      const use = r.topUp.spends.map(s => `${s.id} r${s.rank}`).join(', ') || 'unspent';
      console.log(`TOPUP\t${tag}\tfrom ${r.topUp.from} to ${r.topUp.to}\t${use}`);
    } else {
      console.log(`TOPUP\t${tag}\tnone`);
    }
    if (r.unspent > 0) console.log(`UNSPENT\t${tag}\t${r.unspent}`);
  }
}
console.log(`MODE\t${chase ? 'chase' : 'kite'}\t${charId}\t${learn ? 'learn' : 'no-learn'}\t${openerId || 'default-opener'}\tring ${KITE_RING.toFixed(1)}`);
console.log(`TOTAL\tclears ${clears}/${rows.length}\tdeaths ${deaths}\tstalls ${stalls}`);
