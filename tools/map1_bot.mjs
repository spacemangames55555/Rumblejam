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
// `--clumsy` is a weak human, off unless asked. It does three things and
// nothing else: new warnings and new threats are ignored for `--react`
// seconds (default 2.5), the input is snapped to the nearest of 8 directions,
// and no skill point is spent after the opener. `--opener` still buys that
// one level-1 skill, because that is the build being measured. `--react`
// without `--clumsy` is refused. The kite, the dodge and the learner are
// unchanged when the flag is absent.
//
// `--difficulty <id>` picks the party's difficulty. The default is standard,
// which is what every earlier table used. Gentle is the half-HP floor.
//
// `--prefer <skillId>` forces the learner to buy that skill and every prereq
// on the path to it before anything else. For Druid Call Wolf that is
// `druid_thorn_lash` then `druid_call_wolf`. The prefer skill must belong to
// the class. Its tier-1 root becomes the kite opener for the run (same ring
// rule as `--opener`). Combining `--prefer` with `--opener` is allowed only
// when the opener is that same root. Absent the flag, the learner is unchanged.
//
// `--god` refills HP every tick (Designer map-3 god-mode harness). `--depth=N`
// travels to a combat node at that depth instead of map 1 (`_travelTo`).
// `--start-level=N` grants level N and N skill points before the opening spend
// (map-3 §12/§13 harness starts at 8). All three default off / depth 1 /
// level 1, so existing map-1 tables and gate results are untouched.
//
// Usage: node tools/map1_bot.mjs [--chase] [--no-learn] [--clumsy] [--react <seconds>] [--difficulty <id>] [--opener <skillId>] [--prefer <skillId>] [--god] [--depth=N] [--start-level=N] [--class <id>] [charId] [seed ...]
// Default class: toh_samurai. Default seeds: 777, 0xa11ce, 424242, 20260728, 99.
// Default difficulty: standard.

import { Sim } from '../js/game.js';
import { dist2 } from '../js/util.js';
import { angleDelta, inZone } from '../js/compose.js';
import { WEAPON_BY_ID } from '../js/content/weapons.js';
import { CHAR_BY_ID } from '../js/content/characters.js';
import { isOnboardingNode, ONBOARDING_LEVEL_FLOOR } from '../js/arenas.js';
import { CONFIG } from '../js/config.js';
import { TREES, TREES_BY_CLASS, SKILL_BY_ID, canLearn } from '../js/skills.js';
import { rangeOfStep } from '../js/skilltext.js';
import { DIFFICULTY_BY_ID } from '../js/worldmap.js';

const DEFAULT_SEEDS = [777, 0xa11ce, 424242, 20260728, 99];
const FIGHT_CAP_S = 200;

function parseArgs(argv) {
  let chase = false;
  let learn = true;
  let clumsy = false;
  let reactS = 2.5;
  let reactSet = false;
  let difficulty = 'standard';
  let charId = 'toh_samurai';
  let openerId = null;
  let preferId = null;
  let god = false;
  let depth = 1;
  let startLevel = 1;
  const seeds = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--chase') { chase = true; continue; }
    if (a === '--god') { god = true; continue; }
    if (a === '--depth' || a.startsWith('--depth=')) {
      const raw = a === '--depth' ? argv[++i] : a.slice('--depth='.length);
      const v = Number(raw);
      if (!Number.isInteger(v) || v < 1) {
        console.error('map1_bot: --depth needs a positive integer');
        process.exit(1);
      }
      depth = v;
      continue;
    }
    if (a === '--start-level' || a.startsWith('--start-level=')) {
      const raw = a === '--start-level' ? argv[++i] : a.slice('--start-level='.length);
      const v = Number(raw);
      if (!Number.isInteger(v) || v < 1) {
        console.error('map1_bot: --start-level needs a positive integer');
        process.exit(1);
      }
      startLevel = v;
      continue;
    }
    if (a === '--no-learn') { learn = false; continue; }
    if (a === '--clumsy') { clumsy = true; continue; }
    if (a === '--react' || a.startsWith('--react=')) {
      const raw = a === '--react' ? argv[++i] : a.slice('--react='.length);
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 0) {
        console.error('map1_bot: --react needs a non-negative number of seconds');
        process.exit(1);
      }
      reactS = v;
      reactSet = true;
      continue;
    }
    if (a === '--difficulty' || a.startsWith('--difficulty=')) {
      const raw = a === '--difficulty' ? argv[++i] : a.slice('--difficulty='.length);
      if (!raw || raw.startsWith('--') || !DIFFICULTY_BY_ID[raw]) {
        const known = Object.keys(DIFFICULTY_BY_ID).join(', ');
        console.error(`map1_bot: --difficulty needs one of: ${known}`);
        process.exit(1);
      }
      difficulty = raw;
      continue;
    }
    if (a === '--opener') {
      openerId = argv[++i];
      if (!openerId || openerId.startsWith('--')) {
        console.error('map1_bot: --opener needs a tier-1 skill id');
        process.exit(1);
      }
      continue;
    }
    if (a.startsWith('--opener=')) { openerId = a.slice('--opener='.length); continue; }
    if (a === '--prefer') {
      preferId = argv[++i];
      if (!preferId || preferId.startsWith('--')) {
        console.error('map1_bot: --prefer needs a skill id');
        process.exit(1);
      }
      continue;
    }
    if (a.startsWith('--prefer=')) { preferId = a.slice('--prefer='.length); continue; }
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
  return { chase, learn, clumsy, reactS, reactSet, difficulty, charId, openerId, preferId, god, depth, startLevel, seeds: seeds.length ? seeds : DEFAULT_SEEDS };
}

const { chase, learn, clumsy, reactS, reactSet, difficulty, charId, openerId, preferId, god, depth, startLevel, seeds: list } = parseArgs(process.argv);
if (reactSet && !clumsy) {
  console.error('map1_bot: --react sets the clumsy-mode delay, so it needs --clumsy');
  process.exit(1);
}

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

if ((openerId || preferId) && !learn && !clumsy) {
  console.error('--opener/--prefer spend skill points, so they cannot be combined with --no-learn');
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

// Prefer chain: root tier-1 … target. Walks `prereq` links. Empty if unknown.
function preferChain(id) {
  const out = [];
  const seen = new Set();
  let cur = SKILL_BY_ID[id];
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.prereq ? SKILL_BY_ID[cur.prereq] : null;
  }
  return out;
}

let preferRootId = null;
if (preferId) {
  const sk = SKILL_BY_ID[preferId];
  const trees = TREES_BY_CLASS[charId] || [];
  if (!sk || !trees.includes(sk.tree)) {
    console.error(`--prefer ${preferId} is not a skill of ${charId}`);
    process.exit(1);
  }
  const chain = preferChain(preferId);
  if (!chain.length || chain[0].tier !== 1) {
    console.error(`--prefer ${preferId} has no tier-1 root on its prereq chain`);
    process.exit(1);
  }
  preferRootId = chain[0].id;
  if (openerId && openerId !== preferRootId) {
    console.error(`--opener ${openerId} conflicts with --prefer root ${preferRootId}`);
    process.exit(1);
  }
}

// Effective opener for the kite ring and the learner's chain root. Prefer's
// tier-1 root wins when set; otherwise `--opener`; otherwise the registry first.
const effectiveOpenerId = preferRootId || openerId || null;

// No weapon: hold inside the opener's hit. 0.85 of that reach, and never
// past the old 200. A ranged opener whose hit is past 200/0.85 stays at 200.
const OPENER_SKILL = effectiveOpenerId ? SKILL_BY_ID[effectiveOpenerId] : defaultOpener(charId);
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

// The tier-1 this run is building from. `--prefer`'s root / `--opener` wins
// once owned; otherwise the tier-1 already known, which is the registry opener.
function ownedOpener(p) {
  if (effectiveOpenerId && (p.skillRanks[effectiveOpenerId] || 0) >= 1) return SKILL_BY_ID[effectiveOpenerId];
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
  // Prefer chain first: buy every still-missing node on the path to `--prefer`
  // before the ordinary tier walk. Default behaviour is unchanged when unset.
  if (preferId) {
    for (const sk of preferChain(preferId)) {
      if ((p.skillRanks[sk.id] || 0) < 1 && canLearn(p, sk)) return sk;
    }
  }
  if (effectiveOpenerId && (p.skillRanks[effectiveOpenerId] || 0) < 1) {
    const op = SKILL_BY_ID[effectiveOpenerId];
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

// Eight compass directions, unit length, so a diagonal is not slower than a
// cardinal. Zero stays zero: a clumsy player who has no heading does not
// invent one.
function snap8(mx, my) {
  if (Math.hypot(mx, my) < 1e-6) return { mx: 0, my: 0 };
  const i = Math.round(Math.atan2(my, mx) / (Math.PI / 4));
  const a = (((i % 8) + 8) % 8) * (Math.PI / 4);
  return { mx: Math.cos(a), my: Math.sin(a) };
}

function runSeed(seed) {
  const sim = new Sim({
    seed, difficulty, regionIndex: 1,
    party: [{ idx: 0, key: 'k', name: 'BOT', charId, color: '#fff' }],
  });
  const p = sim.players[0];
  // §12/§13 map-3 harness: grant level N and N skill points before the opening
  // spend. Level 1 (default) leaves the character exactly as constructed.
  if (startLevel > 1) {
    p.level = startLevel;
    p.skillPoints = startLevel;
    sim._recomputeStats(p);
    p.hp = p.stats.vitality;
  }
  const dmg = attachDamageLedger(sim, p);

  let dodgeTicks = 0;
  // First moment a warning or a threat was seen. A clumsy player does not
  // react until `reactS` later. Absent when the flag is off, so the default
  // kite never consults it.
  const seenAt = clumsy ? new Map() : null;
  const reactReady = (key) => {
    let t0 = seenAt.get(key);
    if (t0 === undefined) { seenAt.set(key, sim.time); t0 = sim.time; }
    return sim.time - t0 >= reactS;
  };

  function steer(mx, my, dodging) {
    if (clumsy) {
      const s = snap8(mx, my);
      mx = s.mx;
      my = s.my;
    }
    sim.setInput(0, { mx, my });
    if (dodging) dodgeTicks++;
  }

  function botInput() {
    const mopUp = sim.wave && sim.wave.done && sim.enemyPool.count <= 12;
    const wdef = p.weapons[0] ? WEAPON_BY_ID[p.weapons[0].id] : null;
    const melee = wdef && (wdef.cls === 'swing' || wdef.cls === 'thrust');
    const ring = wdef ? (melee ? Math.max(70, wdef.range * 0.75) : (mopUp ? 110 : 230)) : KITE_RING;
    let vx = 0, vy = 0;
    let nearest = null, nd = Infinity, count = 0;
    for (const e of sim.enemyPool) {
      if (clumsy && !reactReady('e' + e.id)) continue;
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
      if (clumsy && !reactReady('p' + pr.id)) continue;
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
    const liveTg = clumsy ? new Set() : null;
    for (const tg of sim.telegraphs) {
      if (tg.spawnMark) continue;
      if (clumsy) {
        liveTg.add(tg);
        if (!reactReady(tg)) continue;
      }
      consider(asZone(tg), (tg.dur || 0) - (tg.t || 0));
    }
    const liveZones = clumsy ? new Set() : null;
    for (const tz of sim.telegraphZones()) {
      if (clumsy) {
        const key = 'z' + tz.id;
        liveZones.add(key);
        if (!reactReady(key)) continue;
      }
      consider(tz.z, (tz.msLeft || 0) / 1000);
    }
    if (clumsy) {
      for (const key of seenAt.keys()) {
        if (typeof key === 'object' && !liveTg.has(key)) seenAt.delete(key);
        else if (typeof key === 'string' && key.startsWith('z') && !liveZones.has(key)) seenAt.delete(key);
      }
    }
    const staysOut = (mx, my) => {
      for (const t of threats) {
        if (pathInside(t.z, p.x, p.y, mx, my, speed * t.timeLeft, radius)) return false;
      }
      return true;
    };
    if (step) {
      steer(step.x, step.y, true);
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
      steer(chosen.mx, chosen.my, true);
    } else {
      const len = ilen || 1;
      steer(vx / len, vy / len, false);
    }
  }

  function resolveUi() {
    let g = 0;
    while (p.pendingOffer && g++ < 30) sim.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  }

  const learned = [];
  // Clumsy buys the named opener and then stops. Further points stay unspent.
  const learnFight = learn && !clumsy;
  if (learnFight) spendSkills(sim, p, learned);
  else if (clumsy && effectiveOpenerId && (p.skillRanks[effectiveOpenerId] || 0) < 1 && canLearn(p, SKILL_BY_ID[effectiveOpenerId])) {
    sim.uiAction(p.idx, { kind: 'learnSkill', id: effectiveOpenerId });
  }

  let nodeId, node;
  if (depth === 1) {
    const starts = sim.reachableNodes();
    nodeId = starts.find(id => isOnboardingNode(sim.regionIndex, sim.floor.nodes[id])) ?? starts[0];
    node = sim.floor.nodes[nodeId];
    sim.uiAction(0, { kind: 'pickNode', nodeId });
    if (sim.phase !== 'arena' || !isOnboardingNode(sim.regionIndex, sim.arenaNode)) {
      return { seed, outcome: 'error', dodgeTicks: 0, detail: `did not enter map 1 (phase ${sim.phase}, node ${node && node.kind})` };
    }
  } else {
    node = sim.floor.nodes.find(n => n.depth === depth && n.kind === 'combat');
    if (!node) return { seed, outcome: 'error', dodgeTicks: 0, detail: `no combat node at depth ${depth}` };
    nodeId = node.id;
    sim._travelTo(nodeId);
    if (sim.phase !== 'arena') {
      return { seed, outcome: 'error', dodgeTicks: 0, detail: `did not enter depth ${depth} (phase ${sim.phase})` };
    }
  }

  let spawned = 0;
  const origSpawn = sim.spawnEnemyById.bind(sim);
  sim.spawnEnemyById = (...args) => { const e = origSpawn(...args); if (e) spawned++; return e; };

  const cap = FIGHT_CAP_S * 60;
  let ticks = 0, peak = 0;
  // HORDE PACE SAMPLING (pace-spec.md §7 bars). Alive is sampled every tick
  // while the wave timer runs, from t = 3 s.
  const aliveSamples = [];
  // ON SCREEN: bodies inside the camera's ~1280 × 720 view around player 0
  // (CONFIG.ROOM_W/ROOM_H — the spec's assumed viewport), sampled like alive.
  const screenSamples = [];
  const VW = (CONFIG.ROOM_W || 1280) / 2, VH = (CONFIG.ROOM_H || 720) / 2;
  let firstKillT = null, firstSpawnT = null, timerEndT = null;
  const casts = {};
  let topUp = null;
  let killsAtTimer = null;
  let wolfAliveTicks = 0, wolfPeak = 0, wolfSummonsSeen = 0;
  const seenWolfIds = new Set();
  while (sim.phase === 'arena' && !sim.over && !sim.cleared && ticks++ < cap) {
    botInput();
    const lvl0 = p.level;
    sim.tick();
    for (const f of sim.fx.skillFires) {
      if (f.idx !== 0) continue;
      casts[f.id] = (casts[f.id] || 0) + 1;
    }
    const spent = learnFight ? spendSkills(sim, p, learned) : [];
    if (topUp === null && sim.cleared && lvl0 < ONBOARDING_LEVEL_FLOOR
        && p.level >= ONBOARDING_LEVEL_FLOOR && p.xp === 0) {
      topUp = { from: lvl0, to: p.level, spends: spent };
    }
    peak = Math.max(peak, sim.enemyPool.count);
    const wt = sim.wave ? sim.wave.t : 0;
    if (firstSpawnT === null && spawned > 0) firstSpawnT = ticks / 60;
    if (firstKillT === null && sim.payout.kills > 0) firstKillT = ticks / 60;
    if (sim.wave && !sim.wave.done && wt >= 3) {
      aliveSamples.push(sim.enemyPool.count);
      let on = 0;
      for (const e of sim.enemyPool) if (Math.abs(e.x - p.x) <= VW && Math.abs(e.y - p.y) <= VH) on++;
      screenSamples.push(on);
    }
    if (timerEndT === null && sim.wave && sim.wave.done) {
      timerEndT = ticks / 60;
      killsAtTimer = sim.payout.kills;
    }
    // Wolf fielding (Druid Call Wolf / any `arch === 'wolf'` minion).
    let wolves = 0;
    for (const m of p.minions || []) {
      if (m.arch !== 'wolf') continue;
      wolves++;
      if (!seenWolfIds.has(m.id)) { seenWolfIds.add(m.id); wolfSummonsSeen++; }
    }
    if (wolves > 0) wolfAliveTicks++;
    if (wolves > wolfPeak) wolfPeak = wolves;
    if (god) p.hp = p.stats.vitality;
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
  const sorted = [...aliveSamples].sort((a, b) => a - b);
  const pace = {
    median: sorted.length ? sorted[sorted.length >> 1] : 0,
    onScreen: screenSamples.length ? [...screenSamples].sort((a, b) => a - b)[screenSamples.length >> 1] : 0,
    onScreenMax: screenSamples.length ? Math.max(...screenSamples) : 0,
    le2: sorted.length ? aliveSamples.filter(n => n <= 2).length / sorted.length : 1,
    firstSpawnT, firstKillT,
    dur: sim.wave ? sim.wave.dur : null,
    tail: timerEndT === null ? null : +(ticks / 60 - timerEndT).toFixed(1),
    culled: sim.hordeCulled || 0,
    cap: typeof sim._hordeAliveCap === 'function' ? sim._hordeAliveCap() : null,
    // The room's pressure profile: Bastion streams at ×0.65 by design (the
    // sanctioned camping fight), so its kills/s ceiling sits below the bar.
    rateMult: (sim.profile && sim.profile.rateMult) || 1,
  };
  pace.killsPerS = +((sim.payout.kills - pace.culled) / Math.max(1, ticks / 60)).toFixed(2);
  // §12/§13 map-3 figure: kills inside the timer ÷ wave duration (tail excluded).
  const waveDur = (sim.wave && Number.isFinite(sim.wave.dur)) ? sim.wave.dur : null;
  const timerKills = killsAtTimer === null ? sim.payout.kills : killsAtTimer;
  const killsPerSTimer = waveDur ? +(timerKills / waveDur).toFixed(2) : null;
  const ranks = { ...p.skillRanks };
  return {
    seed,
    outcome,
    pace,
    secs: +(ticks / 60).toFixed(1),
    peak,
    kills: sim.payout.kills,
    timerKills,
    killsPerSTimer,
    waveDur,
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
    ranks,
    dmg,
    dodgeTicks,
    topUp,
    unspent: p.skillPoints,
    loadout: (p.loadout || []).filter(Boolean),
    openerRank: effectiveOpenerId ? (p.skillRanks[effectiveOpenerId] || 0) : null,
    wolf: {
      casts: casts.druid_call_wolf || 0,
      summons: wolfSummonsSeen,
      peak: wolfPeak,
      uptime: +(wolfAliveTicks / Math.max(1, ticks)).toFixed(3),
      aliveTicks: wolfAliveTicks,
    },
  };
}

console.log('OPENERS\tdefault tier-1, registry order');
for (const id of Object.keys(TREES_BY_CLASS)) {
  const sk = defaultOpener(id);
  console.log(`OPENER\t${id}\t${sk ? sk.id : '?'}\t${sk ? sk.name : ''}`);
}
if (effectiveOpenerId) {
  const sk = SKILL_BY_ID[effectiveOpenerId];
  console.log(`CHOSEN\t${charId}\t${sk.id}\t${sk.name}${preferId ? `\tprefer ${preferId}` : ''}`);
}

const rows = list.map(runSeed);
let clears = 0, deaths = 0, stalls = 0;
for (const r of rows) {
  if (r.outcome === 'clear') clears++;
  else if (r.outcome === 'death') deaths++;
  else stalls++;
  const tag = r.seed === 0xa11ce ? '0xa11ce' : String(r.seed);
  console.log(`${tag}\t${r.outcome}\t${r.secs}s\tkills ${r.kills}/${r.total}\tpeak ${r.peak}\thp ${r.hp}/${r.maxHp}\tlvl ${r.level}\talive ${r.alive} waveDone ${r.waveDone} ${r.node || ''} ${r.left ? JSON.stringify(r.left) : r.detail || ''}`);
  if (r.pace) {
    const P = r.pace;
    console.log(`PACE\t${tag}\tmedianAlive ${P.median}\tonScreen ${P.onScreen} (max ${P.onScreenMax})\tle2 ${(100 * P.le2).toFixed(1)}%\tpeak ${r.peak}/${P.cap}\tfirstSpawn ${P.firstSpawnT === null ? '-' : P.firstSpawnT.toFixed(2)}s\tfirstKill ${P.firstKillT === null ? '-' : P.firstKillT.toFixed(2)}s\tdur ${P.dur}s\ttail ${P.tail}s\tkills/s ${P.killsPerS}\tculled ${P.culled}\tprofile x${P.rateMult}\tlvl ${r.level}`);
  }
  if (r.dmg) {
    const d = r.dmg;
    console.log(`DMG\t${tag}\tcontact ${d.contact}\tlanes ${d.lanes}\tcones ${d.cones}\tprojectiles ${d.projectiles}\tother ${d.other}`);
  }
  console.log(`DODGE\t${tag}\t${((r.dodgeTicks || 0) / 60).toFixed(1)}s`);
  if (effectiveOpenerId) console.log(`OPENER_RANK\t${tag}\t${r.openerRank}`);
  if (r.wolf) console.log(`WOLF\t${tag}\tcasts ${r.wolf.casts}\tsummons ${r.wolf.summons}\tpeak ${r.wolf.peak}\tuptime ${(100 * r.wolf.uptime).toFixed(1)}%`);
  if (r.killsPerSTimer !== null) console.log(`TIMER_KILLS\t${tag}\t${r.timerKills}\t/ ${r.waveDur}s\t= ${r.killsPerSTimer}/s`);
  if (learn && !clumsy && r.learned) {
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
console.log(`MODE\t${chase ? 'chase' : 'kite'}\t${difficulty}\t${charId}\t${clumsy ? `clumsy react ${reactS}s 8-dir no-learn` : (learn ? 'learn' : 'no-learn')}\t${preferId ? `prefer ${preferId}` : (effectiveOpenerId || 'default-opener')}\tring ${KITE_RING.toFixed(1)}\tdepth ${depth}\tgod ${god ? 1 : 0}\tstartLevel ${startLevel}`);
console.log(`TOTAL\tclears ${clears}/${rows.length}\tdeaths ${deaths}\tstalls ${stalls}`);
{
  // pace-spec.md §7 map-1 bars, over every seed that entered the fight.
  const ps = rows.filter(r => r.pace);
  const bar = (name, ok, val) => console.log(`BAR\t${ok ? 'PASS' : 'FAIL'}\t${name}\t${val}`);
  const worst = (f, cmp) => ps.reduce((a, r) => (a === null || cmp(f(r), a) ? f(r) : a), null);
  bar('le2 alive <= 5% of ticks after 3 s', ps.every(r => r.pace.le2 <= 0.05), `worst ${(100 * worst(r => r.pace.le2, (a, b) => a > b)).toFixed(1)}%`);
  bar('median alive >= 10', ps.every(r => r.pace.median >= 10), `min ${worst(r => r.pace.median, (a, b) => a < b)}`);
  bar('peak <= cap', ps.every(r => r.peak <= r.pace.cap), `max ${worst(r => r.peak, (a, b) => a > b)}`);
  bar('first pack <= 1.2 s', ps.every(r => r.pace.firstSpawnT !== null && r.pace.firstSpawnT <= 1.2), `max ${worst(r => r.pace.firstSpawnT ?? 99, (a, b) => a > b)}`);
  bar('first kill <= 4 s', ps.every(r => r.pace.firstKillT !== null && r.pace.firstKillT <= 4), `max ${worst(r => r.pace.firstKillT ?? 99, (a, b) => a > b)?.toFixed(2)}`);
  bar('ends <= 5 s after timer', ps.every(r => r.outcome !== 'clear' || (r.pace.tail !== null && r.pace.tail <= 5)), `max ${worst(r => r.pace.tail ?? 0, (a, b) => a > b)}`);
  bar('kills/s >= 2.5', ps.every(r => r.outcome !== 'clear' || r.pace.killsPerS >= 2.5), `min ${worst(r => r.pace.killsPerS, (a, b) => a < b)}`);
  {
    // The same bar with Bastion rooms (rate ×0.65 by design) set aside — the
    // budget there tops out near 2 kills/s whoever is playing.
    const nb = ps.filter(r => r.pace.rateMult >= 1 && r.outcome === 'clear');
    const mn = nb.reduce((a, r) => Math.min(a, r.pace.killsPerS), Infinity);
    bar('kills/s >= 2.5 (non-Bastion rooms)', nb.every(r => r.pace.killsPerS >= 2.5), `min ${nb.length ? mn : '-'} over ${nb.length}`);
  }
}
