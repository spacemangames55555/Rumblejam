// The eight objective node types. Each is a level with a win condition that
// is NOT "kill everything that spawned" — the horde arena still exists, but
// most of a floor is now built out of these.
//
// Contract with game.js:
//   initObjective(sim, node)  → sim.obj = {...} (or null for a horde arena)
//   tickObjective(sim, dt)    → advances state, sets sim.obj.done when clear
//   serializeObjective(sim)   → the compact blob the HUD/renderer read; it
//                               rides the snapshot so clients show the same
//                               progress bar and world markers as the host
//
// Everything here is host-authoritative and deterministic per (seed, node):
// clients never run this, they read the serialized state. All objective
// geometry lives in world units so it renders through the normal camera.

import { CONFIG } from './config.js';
import { clamp, dist2 } from './util.js';
import { BOSS_BY_FLOOR } from './content/bosses.js';
import { FLOOR_TABLES } from './content/enemies.js';

const { WALL } = CONFIG;

// The node kinds this module owns. `combat`/`elite`/`siege` stay with game.js.
export const OBJECTIVE_KINDS = [
  'zone', 'elite_arena', 'nest', 'bounty', 'breach', 'relic', 'storm', 'payload',
];
export const IS_OBJECTIVE = Object.fromEntries(OBJECTIVE_KINDS.map(k => [k, true]));

// Node-map presentation (icon + label + one-line brief on the map screen).
export const OBJECTIVE_META = {
  zone:        { sym: '◎', name: 'Zone Control', hint: 'hold the marked ground — 6 captures' },
  elite_arena: { sym: '☠', name: 'Elite Arena',  hint: 'a handful of monsters, all of them huge' },
  nest:        { sym: '⁂', name: 'Nest Purge',   hint: 'destroy every spawner' },
  bounty:      { sym: '✦', name: 'Bounty Hunt',  hint: '5 marked champions, one at a time' },
  breach:      { sym: '⇥', name: 'Breach',       hint: 'the wall is coming — run the corridor' },
  relic:       { sym: '⚱', name: 'Relic Run',    hint: 'carry 5 relics to the altar' },
  storm:       { sym: '❄', name: 'Storm Survival', hint: 'stay in the circle for 90s' },
  payload:     { sym: '⛏', name: 'Payload',      hint: 'escort the drill to the gate' },
};

// Arena shape overrides — Breach wants a corridor, Storm/Zone want space.
export function arenaShapeFor(kind, w, h) {
  if (kind === 'breach') return { w: Math.round(w * 1.7), h: Math.round(h * 0.62) };
  if (kind === 'storm' || kind === 'zone') return { w: Math.round(w * 1.1), h: Math.round(h * 1.1) };
  return { w, h };
}

// ---------------------------------------------------------------- helpers

function rnd(sim) { return sim.waveRng.float(); }
function spot(sim, x, y, r = 60) {
  const [sx, sy] = sim._clearSpot(
    clamp(x, WALL + 90, sim.W - WALL - 90),
    clamp(y, WALL + 90, sim.H - WALL - 90), r);
  return { x: sx, y: sy };
}
function anyPlayerWithin(sim, x, y, r) {
  for (const p of sim.livePlayers()) {
    if (p.downed) continue;
    if (dist2(p.x, p.y, x, y) < r * r) return true;
  }
  return false;
}
function floorTable(sim) { return FLOOR_TABLES[sim.floorNum - 1]; }

// Bounty champions are priced off the floor boss's REAL spawn HP (post-patch,
// i.e. already doubled), using the same formula _spawnBoss uses so the
// comparison is apples-to-apples.
function bossHp(sim) {
  const b = BOSS_BY_FLOOR[sim.floorNum] || BOSS_BY_FLOOR[1];
  return b.hp * sim.coopHp * sim.greedHp * CONFIG.enemyHpMult;
}

// The brief prices each mark at ~60–70% of the floor boss. Five of those is
// >3 bosses of HP in one level, which floor 1 cannot pay: a solo player with
// a good floor-1 build (4 weapons at tier II) killed 2/5 in eight minutes in
// the harness. So the FRACTION ramps by floor — floor 4 is the briefed
// 60–70%, floor 1 opens at ~45% — while the anchor, the count and the
// sequence are exactly as specified. Floors 2+ measured at 28–37s per level.
function bountyFraction(sim, roll) {
  const top = 0.60 + 0.10 * roll;                  // the briefed band
  const ramp = [0.70, 0.85, 0.95, 1][Math.min(3, sim.floorNum - 1)];
  return top * ramp;
}

// ---------------------------------------------------------------- init

export function initObjective(sim, node) {
  const k = node.kind;
  if (!IS_OBJECTIVE[k]) { sim.obj = null; return; }
  const o = { type: k, done: false, label: OBJECTIVE_META[k].name };
  sim.obj = o;
  switch (k) {
    case 'zone': {
      o.captured = 0; o.need = 6; o.meter = 0; o.fillNeed = 20; o.kills = 0; o.killCap = 150;
      o.zone = newZone(sim);
      break;
    }
    case 'elite_arena': {
      o.spawned = false; o.total = 0;
      break;
    }
    case 'nest': {
      o.total = 6 + Math.floor(rnd(sim) * 3); // 6–8
      o.alive = o.total; o.nests = [];
      break;
    }
    case 'bounty': {
      o.killed = 0; o.need = 5; o.markId = null; o.markX = 0; o.markY = 0; o.spawnT = 1.5;
      break;
    }
    case 'breach': {
      // the collapse eats the corridor from the entry edge at a steady crawl
      o.wallX = WALL - 40;
      o.speed = 26 + sim.floorNum * 3;
      o.gateX = sim.W - WALL - 140;
      o.gate = spot(sim, sim.W - WALL - 140, sim.H / 2, 70);
      break;
    }
    case 'relic': {
      o.banked = 0; o.need = 5;
      o.altar = spot(sim, sim.W / 2, sim.H / 2, 80);
      o.relics = [];
      for (let i = 0; i < 3; i++) o.relics.push(newRelic(sim, i));
      o.nextId = 3;
      break;
    }
    case 'storm': {
      o.survived = 0; o.need = 90;
      o.cycle = 20; o.t = 0;
      o.c = spot(sim, sim.W / 2, sim.H / 2, 100);
      const span = Math.min(sim.W, sim.H);
      o.r0 = span * 0.42;
      // the circle has to hold the whole party: a radius tuned for one player
      // packs eight of them into a blender with the entire inflow on top
      const crowd = Math.max(0, sim.players.filter(p => !p.gone).length - 1);
      o.r = o.r0; o.rMin = span * (0.16 + 0.013 * crowd); o.grace = 0;
      break;
    }
    case 'payload': {
      o.path = payloadPath(sim);
      o.leg = 0; o.moved = 0;
      o.x = o.path[0].x; o.y = o.path[0].y;
      o.hp = 220 + sim.floorNum * 60; o.maxHp = o.hp;
      o.escortR = 260; o.speed = 42 + sim.floorNum * 2;
      o.stall = 0; o.escorted = false;
      o.gate = o.path[o.path.length - 1];
      break;
    }
  }
  return o;
}

function newZone(sim) {
  // 10–25% of the arena's area, as a circle
  const frac = 0.10 + rnd(sim) * 0.15;
  const r = Math.sqrt((sim.W * sim.H * frac) / Math.PI);
  const rr = clamp(r, 150, Math.min(sim.W, sim.H) * 0.42);
  const p = spot(sim, WALL + rr + rnd(sim) * (sim.W - 2 * WALL - 2 * rr),
    WALL + rr + rnd(sim) * (sim.H - 2 * WALL - 2 * rr), 40);
  return { x: p.x, y: p.y, r: Math.round(rr) };
}

function newRelic(sim, id) {
  const p = spot(sim, WALL + 160 + rnd(sim) * (sim.W - 2 * WALL - 320),
    WALL + 160 + rnd(sim) * (sim.H - 2 * WALL - 320), 40);
  return { id, x: p.x, y: p.y, carrier: -1 };
}

// A preset lane from the entry side to the gate, with a couple of doglegs so
// the escort has to actually move around the arena.
function payloadPath(sim) {
  const y0 = sim.H / 2;
  const pts = [
    { x: WALL + 120, y: y0 },
    { x: sim.W * 0.34, y: y0 + (rnd(sim) > 0.5 ? -1 : 1) * sim.H * 0.22 },
    { x: sim.W * 0.62, y: y0 + (rnd(sim) > 0.5 ? -1 : 1) * sim.H * 0.2 },
    { x: sim.W - WALL - 150, y: y0 },
  ];
  return pts.map(p => spot(sim, p.x, p.y, 46));
}

// ---------------------------------------------------------------- tick

export function tickObjective(sim, dt) {
  const o = sim.obj;
  if (!o || o.done || sim.over) return;
  switch (o.type) {
    case 'zone': tickZone(sim, o, dt); break;
    case 'elite_arena': tickEliteArena(sim, o, dt); break;
    case 'nest': tickNest(sim, o, dt); break;
    case 'bounty': tickBounty(sim, o, dt); break;
    case 'breach': tickBreach(sim, o, dt); break;
    case 'relic': tickRelic(sim, o, dt); break;
    case 'storm': tickStorm(sim, o, dt); break;
    case 'payload': tickPayload(sim, o, dt); break;
  }
}

// --- a. ZONE CONTROL ---------------------------------------------------
// Occupied time, not presence: the meter pauses (never resets) when the zone
// empties, so a wipe-and-return doesn't erase the work.
function tickZone(sim, o, dt) {
  const z = o.zone;
  const held = anyPlayerWithin(sim, z.x, z.y, z.r);
  if (held) o.meter = Math.min(o.fillNeed, o.meter + dt);
  if (o.meter >= o.fillNeed) {
    o.captured++;
    o.meter = 0;
    o.kills = 0;                       // the anti-farm budget resets per segment
    sim.pushEvent({ k: 'sfx', s: 'door' });
    if (o.captured >= o.need) { o.done = true; return; }
    o.zone = newZone(sim);
    sim.pushEvent({ k: 'toast', idx: -1, text: `Zone captured — ${o.captured}/${o.need}. It has moved.` });
  }
}

// --- b. ELITE ARENA ----------------------------------------------------
// Four fixed variants, few of them, all slow and enormous: pure kiting.
const ELITE_ARENA_VARIANTS = [
  { key: 'charger', id: 'lancerfish', hp: 16, spd: 0.75, label: 'Charger' },
  { key: 'lobber',  id: 'lobber',     hp: 13, spd: 0.55, label: 'Lobber' },
  { key: 'splitter', id: 'gemmite',   hp: 12, spd: 0.7,  label: 'Splitter' },
  { key: 'enrager', id: 'slabjaw',    hp: 15, spd: 0.6,  label: 'Enrager' },
];

function tickEliteArena(sim, o, dt) {
  if (!o.spawned) {
    o.spawned = true;
    const count = 4 + Math.min(4, sim.floorNum); // 5–8, one of each variant at least
    for (let i = 0; i < count; i++) {
      const v = ELITE_ARENA_VARIANTS[i % ELITE_ARENA_VARIANTS.length];
      const a = (i / count) * Math.PI * 2;
      const p = spot(sim, sim.W / 2 + Math.cos(a) * sim.W * 0.32,
        sim.H / 2 + Math.sin(a) * sim.H * 0.32, 40);
      const e = sim.spawnEnemyById(v.id, p.x, p.y, { hpMult: v.hp, spdMult: v.spd });
      if (!e) continue;
      e.arenaVariant = v.key;
      e.radius *= 1.7;
      e.mats = Math.round(e.mats * 6);        // few enemies, so each pays like many
      e.dmg *= 1.25;
      if (v.key === 'enrager') { e.enrageRate = 0.055; e.baseSpd = e.spd; }
      o.total++;
    }
  }
  // kill them all
  if (sim.enemyPool.count === 0 && sim.spawnQueue.length === 0) o.done = true;
}

// --- c. NEST PURGE -----------------------------------------------------
// Destructible spawners. Each one alive keeps the global inflow up; the
// arena's own wave budget scales by the share still standing.
function tickNest(sim, o, dt) {
  if (!o.nests.length) {
    for (let i = 0; i < o.total; i++) {
      const a = (i / o.total) * Math.PI * 2 + rnd(sim);
      const p = spot(sim, sim.W / 2 + Math.cos(a) * sim.W * 0.34,
        sim.H / 2 + Math.sin(a) * sim.H * 0.34, 50);
      const e = sim.spawnEnemyById('wombden', p.x, p.y, { hpMult: 2.2 });
      if (!e) continue;
      e.isNest = true;
      e.radius *= 1.5;
      e.mats = Math.round(e.mats * 4);
      e.maxBroodCap = 2;                       // each nest holds a small brood
      o.nests.push(e.id);
    }
  }
  let alive = 0;
  o.at = [];
  for (const id of o.nests) {
    const e = sim.enemyById(id);
    if (!e) continue;
    alive++;
    o.at.push([Math.round(e.x), Math.round(e.y), +(e.hp / e.maxHp).toFixed(2)]);
  }
  o.alive = alive;
  // the inflow drops with every nest destroyed (read by _tickWave)
  sim.nestChoke = o.total ? alive / o.total : 1;
  if (alive === 0 && o.nests.length) o.done = true;
}

// --- d. BOUNTY HUNT ----------------------------------------------------
// Five champions in sequence, each with an escort pack. Killing one marks
// the next; the map/HUD always pings exactly one target.
function tickBounty(sim, o, dt) {
  if (o.markId !== null) {
    const e = sim.enemyById(o.markId);
    if (e) { o.markX = Math.round(e.x); o.markY = Math.round(e.y); o.markHp = e.hp / e.maxHp; return; }
    // the mark died
    o.markId = null;
    o.killed++;
    if (o.killed >= o.need) { o.done = true; return; }
    o.spawnT = 3;
    sim.pushEvent({ k: 'toast', idx: -1, text: `Bounty down — ${o.killed}/${o.need}. Another stirs.` });
    return;
  }
  o.spawnT -= dt;
  if (o.spawnT > 0) return;
  // spawn the next champion far from the party, with an escort
  const table = floorTable(sim);
  const a = rnd(sim) * Math.PI * 2;
  const p = spot(sim, sim.W / 2 + Math.cos(a) * sim.W * 0.36,
    sim.H / 2 + Math.sin(a) * sim.H * 0.36, 46);
  // ~60–70% of a (doubled) floor boss, eased on the early floors (see above)
  const target = bossHp(sim) * bountyFraction(sim, rnd(sim));
  const base = sim.spawnEnemyById(table[Math.floor(rnd(sim) * table.length)], p.x, p.y,
    { elite: true, mod: sim.waveRng.pick(sim.eliteMods()) });
  if (!base) { o.spawnT = 1; return; }
  base.hp = base.maxHp = Math.round(target);
  base.radius *= 1.55;
  base.bounty = true;
  base.mats = Math.round(base.mats * 10);
  base.spd *= 0.9;
  o.markId = base.id;
  o.markX = Math.round(base.x); o.markY = Math.round(base.y); o.markHp = 1;
  sim.addTelegraph({ shape: 'circle', x: p.x, y: p.y, r: 90, dur: 1.2, spawnMark: true });
  for (let i = 0; i < 4; i++) {                    // the escort pack
    const ea = a + (i - 1.5) * 0.4;
    const ep = spot(sim, p.x + Math.cos(ea) * 120, p.y + Math.sin(ea) * 120, 30);
    sim.spawnEnemyById(table[Math.floor(rnd(sim) * table.length)], ep.x, ep.y, {});
  }
  sim.pushEvent({ k: 'toast', idx: -1, text: `Bounty ${o.killed + 1}/${o.need} marked` });
}

// --- e. BREACH ---------------------------------------------------------
// A lethal wall crawls in from the entry edge. Everything left of it dies;
// reaching the gate at the far end clears the level.
function tickBreach(sim, o, dt) {
  o.wallX += o.speed * dt;
  for (const p of sim.livePlayers()) {
    if (p.downed) continue;
    if (p.x < o.wallX) sim.hurtPlayer(p, 45 * dt, null, { trueDamage: true });
    if (dist2(p.x, p.y, o.gate.x, o.gate.y) < 90 * 90) { o.done = true; return; }
  }
  // enemies caught by the collapse die with it
  for (const e of [...sim.enemyPool]) {
    if (e.x < o.wallX - 30) sim._killEnemy(e, null);
  }
  if (o.wallX > sim.W) o.wallX = sim.W;
}

// --- f. RELIC RUN ------------------------------------------------------
// Pick a relic up by walking over it; carrying is slow and loud; bank it at
// the altar. Going down drops it where you fell.
function tickRelic(sim, o, dt) {
  for (const rl of o.relics) {
    if (rl.carrier >= 0) {
      const p = sim.players[rl.carrier];
      if (!p || p.gone || p.downed) {              // dropped on death/down
        if (p) { rl.x = p.x; rl.y = p.y; }
        rl.carrier = -1;
        sim.pushEvent({ k: 'toast', idx: -1, text: 'Relic dropped!' });
        continue;
      }
      rl.x = p.x; rl.y = p.y;
      if (dist2(p.x, p.y, o.altar.x, o.altar.y) < 90 * 90) {
        rl.carrier = -1;
        o.banked++;
        sim.pushEvent({ k: 'sfx', s: 'buy' });
        sim.pushEvent({ k: 'toast', idx: -1, text: `Relic banked — ${o.banked}/${o.need}` });
        if (o.banked >= o.need) { o.done = true; return; }
        Object.assign(rl, newRelic(sim, o.nextId++));  // a fresh one elsewhere
      }
      continue;
    }
    for (const p of sim.livePlayers()) {
      if (p.downed) continue;
      if (o.relics.some(r2 => r2.carrier === p.idx)) continue; // one at a time
      if (dist2(p.x, p.y, rl.x, rl.y) < 64 * 64) {
        rl.carrier = p.idx;
        sim.pushEvent({ k: 'toast', idx: p.idx, text: 'Relic taken — slow and loud. Get to the altar.' });
        break;
      }
    }
  }
}

// --- g. STORM SURVIVAL -------------------------------------------------
// The safe circle shrinks over ~20s, then jumps somewhere new at full size.
// Outside it you burn a percentage of max HP per second.
function tickStorm(sim, o, dt) {
  o.survived += dt;
  if (o.survived >= o.need) { o.done = true; return; }
  o.t += dt;
  const k = Math.min(1, o.t / o.cycle);
  o.r = o.r0 + (o.rMin - o.r0) * k;
  if (o.t >= o.cycle) {                            // relocate, full size again
    o.t = 0;
    // A BOUNDED hop, not a teleport to anywhere on the map: the arena is
    // thousands of units across and the burn runs the whole way, so a
    // cross-map relocation is a death march rather than a repositioning.
    const a = rnd(sim) * Math.PI * 2;
    const hop = o.r0 * (0.8 + rnd(sim) * 0.7);
    o.c = spot(sim, o.c.x + Math.cos(a) * hop, o.c.y + Math.sin(a) * hop, 90);
    o.r = o.r0;
    o.grace = 1.5;                                 // the storm takes a beat to bite
    sim.pushEvent({ k: 'toast', idx: -1, text: 'THE STORM MOVES' });
  }
  if (o.grace > 0) { o.grace -= dt; return; }
  o.burnAcc = (o.burnAcc || 0) + dt;
  if (o.burnAcc < 0.25) return;
  const mul = o.burnAcc; o.burnAcc = 0;
  for (const p of sim.livePlayers()) {
    if (p.downed) continue;
    if (dist2(p.x, p.y, o.c.x, o.c.y) > o.r * o.r) {
      sim.hurtPlayer(p, p.stats.vitality * 0.05 * mul, null, { trueDamage: true });
    }
  }
}

// --- h. PAYLOAD --------------------------------------------------------
// The drill can't be destroyed — damage only stalls it. It moves while at
// least one player rides along inside the escort radius, and patches itself
// back up while escorted.
function tickPayload(sim, o, dt) {
  const escorted = anyPlayerWithin(sim, o.x, o.y, o.escortR);
  o.escorted = escorted;
  if (o.stall > 0) o.stall -= dt;
  if (escorted) {
    o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.06 * dt); // self-repair
    if (o.stall <= 0) {
      const tgt = o.path[Math.min(o.leg + 1, o.path.length - 1)];
      const dx = tgt.x - o.x, dy = tgt.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      const step = o.speed * dt;
      if (d <= step) {
        o.x = tgt.x; o.y = tgt.y;
        if (o.leg + 1 >= o.path.length - 1) { o.done = true; return; }
        o.leg++;
      } else {
        o.x += dx / d * step; o.y += dy / d * step;
      }
    }
  }
  // enemies chew on it; damage stalls rather than kills
  for (const e of sim.enemyPool) {
    if (dist2(e.x, e.y, o.x, o.y) > 46 * 46) continue;
    e.payloadCd = (e.payloadCd || 0) - dt;
    if (e.payloadCd > 0) continue;
    e.payloadCd = 1;
    o.hp -= e.dmg;
    if (o.hp <= 0) { o.hp = 0; o.stall = 2.5; }    // stalled, never destroyed
  }
}

// ---------------------------------------------------------------- damage hooks

// Zone Control anti-farm: a segment pays for 150 kills, then the taps close
// until the next zone is captured. Returns false if this kill drops nothing.
export function objectiveKillPays(sim) {
  const o = sim.obj;
  if (!o || o.type !== 'zone') return true;
  o.kills++;
  return o.kills <= o.killCap;
}

// Wave-budget multiplier the objective imposes (nests choking inflow, elite
// arenas and bounty hunts running on their own scripted spawns instead).
//
// Party-size note: a horde arena spends a FINITE budget, so co-op scaling
// just makes the same fight denser. An endless level has no budget to spend,
// so the same multiplier means an 8-player party fights ×3.7 inflow for as
// long as the objective takes — minutes, not seconds. Endless levels
// therefore take the square root of the co-op multiplier: still much heavier
// with a full party, but a war of attrition the party can actually win.
export function objectiveSpawnMult(sim) {
  const o = sim.obj;
  if (!o) return 1;
  const endless = objectiveEndless(o.type) ? Math.sqrt(sim.coopSpawn) / sim.coopSpawn : 1;
  return endless * objectiveBaseMult(o, sim);
}

function objectiveBaseMult(o, sim) {
  if (o.type === 'elite_arena') return 0;          // the variants ARE the fight
  if (o.type === 'bounty') return 0.35;            // escorts plus a light trickle
  if (o.type === 'nest') return 0.15 + 0.5 * (sim.nestChoke === undefined ? 1 : sim.nestChoke);
  if (o.type === 'breach') return 0.8;
  if (o.type === 'payload') return 0.9;
  // The endless levels have no wave timer, so the ramp would otherwise sit at
  // full rate forever — harsher than any 60–90s horde arena ever gets. These
  // trims keep the pressure constant-but-survivable while you work the
  // objective (Relic Run is the harshest: you fight while carrying).
  if (o.type === 'relic') return 0.65;
  if (o.type === 'zone') return 0.8;
  if (o.type === 'storm') return 0.7;
  return 1;
}

// Objectives that never stop spawning on their own budget (no wave timer).
export function objectiveEndless(kind) {
  return kind === 'zone' || kind === 'storm' || kind === 'nest'
    || kind === 'relic' || kind === 'payload' || kind === 'breach' || kind === 'bounty';
}

// ---------------------------------------------------------------- snapshot

// Compact per-objective blob: the HUD line, a 0..1 progress bar, an optional
// timer, and whatever world markers the renderer needs to draw.
export function serializeObjective(sim) {
  const o = sim.obj;
  if (!o) return null;
  const r = Math.round;
  const base = { t: o.type, label: o.label, done: o.done ? 1 : 0 };
  switch (o.type) {
    case 'zone':
      return { ...base,
        text: `${o.captured}/${o.need} captured`,
        prog: (o.captured + o.meter / o.fillNeed) / o.need,
        sub: o.meter > 0 ? `holding ${Math.ceil(o.fillNeed - o.meter)}s` : 'stand in the zone',
        zone: [r(o.zone.x), r(o.zone.y), r(o.zone.r), o.meter / o.fillNeed] };
    case 'elite_arena':
      return { ...base, text: `${sim.enemyPool.count} left`, prog: o.total ? 1 - sim.enemyPool.count / o.total : 0 };
    case 'nest':
      return { ...base, text: `${o.alive}/${o.total} nests standing`, prog: o.total ? 1 - o.alive / o.total : 0,
        sub: 'destroy the spawners', nests: o.at || [] };
    case 'bounty':
      return { ...base, text: `${o.killed}/${o.need} bounties`, prog: o.killed / o.need,
        mark: o.markId !== null ? [o.markX, o.markY, +(o.markHp || 1).toFixed(2)] : null };
    case 'breach':
      return { ...base, text: 'reach the gate', prog: clamp((o.gate.x - (sim.W - o.gateX)) / Math.max(1, o.gate.x), 0, 1),
        sub: 'the collapse is behind you',
        wall: r(o.wallX), gate: [r(o.gate.x), r(o.gate.y)] };
    case 'relic':
      return { ...base, text: `${o.banked}/${o.need} banked`, prog: o.banked / o.need,
        altar: [r(o.altar.x), r(o.altar.y)],
        relics: o.relics.map(rl => [r(rl.x), r(rl.y), rl.carrier]) };
    case 'storm':
      return { ...base, text: `${Math.ceil(Math.max(0, o.need - o.survived))}s left`,
        prog: o.survived / o.need, sub: 'stay inside the circle',
        circle: [r(o.c.x), r(o.c.y), r(o.r)] };
    case 'payload':
      return { ...base, text: `${Math.round(100 * o.leg / Math.max(1, o.path.length - 1))}% escorted`,
        prog: o.leg / Math.max(1, o.path.length - 1),
        sub: o.stall > 0 ? 'DRILL STALLED — clear it' : (o.escorted ? 'drilling' : 'stand near the drill'),
        drill: [r(o.x), r(o.y), +(o.hp / o.maxHp).toFixed(2), o.escorted ? 1 : 0, o.stall > 0 ? 1 : 0],
        gate: [r(o.gate.x), r(o.gate.y)], escortR: o.escortR };
  }
  return base;
}
