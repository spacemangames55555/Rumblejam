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
import { hordeTotalSpawns } from './arenas.js';

import { FLOOR_TABLES } from './content/enemies.js';
import { REGION_BY_INDEX, regionHpMult, bossForRegion } from './regions.js';
import { REGION_ENEMIES } from './content/regions-enemies.js';

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
  relic:       { sym: '⚱', name: 'Relic Run',    hint: 'five relics, one at a time, to the altar' },
  storm:       { sym: '❄', name: 'Storm Survival', hint: 'stay in the circle for 90s' },
  payload:     { sym: '⛏', name: 'Payload',      hint: 'escort the drill to the gate' },
};

// ---------------------------------------------------------------- helpers

function rnd(sim) { return sim.waveRng.float(); }
// Objective furniture is always placed in the arena's MAIN open region: a
// template can seal off a chamber, and a relic or an altar behind that wall is
// a level nobody can finish.
function spot(sim, x, y, r = 60) {
  const [mx, my] = sim.mainRegionSpot(
    clamp(x, WALL + 90, sim.W - WALL - 90),
    clamp(y, WALL + 90, sim.H - WALL - 90));
  const [sx, sy] = sim._clearSpot(mx, my, r);
  return { x: sx, y: sy };
}
function anyPlayerWithin(sim, x, y, r) {
  for (const p of sim.livePlayers()) {
    if (p.downed) continue;
    if (dist2(p.x, p.y, x, y) < r * r) return true;
  }
  return false;
}
function floorTable(sim) { return sim._spawnTable(true); }


// Bounty champions are priced off the floor boss's REAL spawn HP (post-patch,
// i.e. already doubled), using the same formula _spawnBoss uses so the
// comparison is apples-to-apples.
function bossHp(sim) {
  const b = bossForRegion(sim.regionIndex);
  return (b.bountyAnchor || b.hp) * sim.coopHp * sim.greedHp * CONFIG.enemyHpMult;
}

// The brief prices each mark at ~60–70% of the floor boss. Five of those is
// >3 bosses of HP in one level, which floor 1 cannot pay: a solo player with
// a good floor-1 build (4 weapons at tier II) killed 2/5 in eight minutes in
// the harness. So the FRACTION ramps by floor — floor 4 is the briefed
// 60–70%, floor 1 opens at ~45% — while the anchor, the count and the
// sequence are exactly as specified. Floors 2+ measured at 28–37s per level.
function bountyFraction(sim, roll) {
  const top = 0.60 + 0.10 * roll;                  // the briefed band
  // RE-KEYED TO REGIONS, and extended rather than stretched. The ramp existed
  // because region 1 cannot pay three bosses of HP in one level; that is a
  // statement about the FIRST region, so the first four entries are unchanged
  // and regions 5-8 simply stay at the briefed band. Rescaling the four steps
  // across eight would have made region 4 easier than floor 4 was.
  const ramp = [0.70, 0.85, 0.95, 1, 1, 1, 1, 1][Math.min(7, Math.max(0, sim.regionIndex - 1))];
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
      // The roster is priced off the horde arena this node replaces: HALF of
      // what a standard fight would spend, all of it standing on the field at
      // t=0. Total threat goes up, per-unit HP comes down (see spawnEliteArena)
      // so the match still lands at 2–3 minutes.
      o.total = Math.max(6, Math.round(hordeTotalSpawns(sim.regionIndex, (node.depth || 1) - 1, sim.coopSpawn) / 2));
      o.spawnedCount = 0;
      break;
    }
    case 'nest': {
      // Every spawner is now a small fortress: ten times the health, three
      // times the inflow, and two concentric barricade rings that stop
      // movement, projectiles AND sight. You cannot plink a nest from across
      // the room any more — you have to get in, and getting in means taking
      // the walls apart while the level pushes back. Everything on this map
      // also carries +50% health, so cutting through is real work.
      o.total = 6 + Math.floor(rnd(sim) * 3); // 6–8
      o.alive = o.total; o.nests = [];
      sim.objHpMult = 1.5;
      buildNests(sim, o);
      break;
    }
    case 'bounty': {
      o.killed = 0; o.need = 5; o.markId = null; o.markX = 0; o.markY = 0; o.spawnT = 1.5;
      break;
    }
    case 'breach': {
      // A corridor cut into 3–4 segments by sealed doors. Each door is on a
      // CLOCK, not a kill quota: killing faster no longer buys ground, so the
      // level cannot be played as a lap of the room with a coin magnet on.
      // The collapse is paced AGAINST that clock — when a door's timer runs
      // out the wall has squeezed the party into a narrow slit right against
      // it. The door opens, the map releases, and it starts again. That
      // squeeze is the level's identity, so it is computed, not hoped for.
      o.segs = 3 + (sim.regionIndex >= 3 ? 1 : 0);
      o.seg = 0;
      o.doors = [];
      const usable = sim.W - 2 * WALL - 260;             // leave room for the gate
      for (let i = 1; i <= o.segs; i++) {
        o.doors.push(Math.round(WALL + 130 + (usable * i) / (o.segs + 1)));
      }
      o.wallX = WALL - 30;
      o.dps = 55;
      // The gate at the far end IS the extraction portal (see _clearFight):
      // there is no mid-map hatch on this level, you leave through the door
      // you spent the whole corridor earning.
      o.gate = spot(sim, sim.W - WALL - 120, sim.H / 2, 70);
      beginBreachLeg(sim, o);
      break;
    }
    case 'relic': {
      // ONE relic at a time, on the rim, as far from the central altar as the
      // room allows: every relic is a full cross-map round trip out and back.
      // There is no ambient wave (see objectiveBaseMult) — the level's ENTIRE
      // enemy budget is split five ways and each share lands around its relic
      // the moment that relic appears. The map is quiet between trips and a
      // war zone at the far end of each one.
      o.banked = 0; o.need = 5;
      o.altar = spot(sim, sim.W / 2, sim.H / 2, 80);
      o.pack = Math.max(4, Math.round(hordeTotalSpawns(sim.regionIndex, (node.depth || 1) - 1, sim.coopSpawn) / 5));
      o.relics = [];
      o.nextId = 0;
      spawnNextRelic(sim, o);
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
      o.hp = 220 + sim.regionIndex * 60; o.maxHp = o.hp;
      o.escortR = 260; o.speed = 42 + sim.regionIndex * 2;
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

// A rim position: pick a direction from the altar and walk it all the way out
// to the wall, so the relic sits at the greatest distance the room allows in
// that direction. Consecutive relics come from different quadrants (≥90° of
// separation) so the level never asks for the same walk twice in a row.
const RELIC_INSET = 150;
function relicSpot(sim, o) {
  const cx = o.altar.x, cy = o.altar.y;
  const hx = Math.max(120, (sim.W - 2 * WALL) / 2 - RELIC_INSET);
  const hy = Math.max(120, (sim.H - 2 * WALL) / 2 - RELIC_INSET);
  // Every candidate is already ON the rim; the score picks the rim point that
  // is FARTHEST from the altar, which in any non-square room means the corners.
  let best = null, bestD = -1;
  for (let tries = 0; tries < 48; tries++) {
    const a = rnd(sim) * Math.PI * 2;
    if (o.lastAngle !== undefined && tries < 32) {
      const d = Math.abs(((a - o.lastAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < Math.PI / 2) continue;              // too close to the last trip
    }
    const ca = Math.cos(a), sa = Math.sin(a);
    const t = Math.min(hx / Math.max(1e-6, Math.abs(ca)), hy / Math.max(1e-6, Math.abs(sa)));
    const p = spot(sim, cx + ca * t, cy + sa * t, 44);
    const d2 = dist2(p.x, p.y, cx, cy);
    if (d2 > bestD) { bestD = d2; best = { x: p.x, y: p.y, a }; }
  }
  o.lastAngle = best.a;
  return best;
}

// The relic plus its share of the level's enemy budget, dropped around it.
function spawnNextRelic(sim, o) {
  const p = relicSpot(sim, o);
  const rl = { id: o.nextId++, x: p.x, y: p.y, carrier: -1 };
  o.relics = [rl];
  const table = floorTable(sim);
  for (let i = 0; i < o.pack; i++) {
    const a = rnd(sim) * Math.PI * 2;
    const r = 90 + rnd(sim) * 300;
    const ep = spot(sim, rl.x + Math.cos(a) * r, rl.y + Math.sin(a) * r, 30);
    sim.spawnEnemyById(table[Math.floor(rnd(sim) * table.length)], ep.x, ep.y, {});
  }
  sim.addTelegraph({ shape: 'circle', x: rl.x, y: rl.y, r: 110, dur: 1.2, spawnMark: true });
  sim.pushEvent({ k: 'toast', idx: -1,
    text: `Relic ${o.banked + 1}/${o.need} surfaced — and it is not alone` });
  return rl;
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
// HP multipliers are on the BASE enemy's hp, so they look large: a Charger is
// a Lancerfish with 55× the health. Sized so a geared party spends ~10–15s per
// champion and the match runs 2–3 minutes rather than the 20–30s the first
// numbers produced.
const ELITE_ARENA_VARIANTS = [
  { key: 'charger', id: 'lancerfish', hp: 82, spd: 0.75, label: 'Charger' },
  { key: 'lobber',  id: 'lobber',     hp: 70, spd: 0.55, label: 'Lobber' },
  { key: 'splitter', id: 'gemmite',   hp: 62, spd: 0.7,  label: 'Splitter' },
  { key: 'enrager', id: 'slabjaw',    hp: 33, spd: 0.6,  label: 'Enrager' },
];
const ELITE_BY_KEY = Object.fromEntries(ELITE_ARENA_VARIANTS.map(v => [v.key, v]));

function tickEliteArena(sim, o, dt) {
  if (!o.spawned) { o.spawned = true; spawnEliteArena(sim, o); }
  // every champion spawned and every one dead
  if (o.spawnedCount > 0 && sim.enemyPool.count === 0 && sim.spawnQueue.length === 0) o.done = true;
}

// The whole roster lands at once, scattered across the room and never within
// ELITE_SAFE of a player: you open surrounded, and the fight is about carving
// lanes rather than kiting one blob around the outside.
const ELITE_SAFE = 400;
function spawnEliteArena(sim, o) {
  // Per-unit HP falls as the count rises. The reference point is the previous
  // roster (~13 champions at these multipliers); the 1.6 lifts TOTAL threat
  // above it while every individual gets far softer — the brief's "total
  // threat up, per-unit HP down". The floor is loose enough not to bind at
  // the largest rosters, where it would silently cap the fight's difficulty.
  const REF = 13 * 1.6;
  const shrink = clamp(REF / Math.max(1, o.total), 0.07, 1);
  // Was `1 + 0.5*(floorNum-1)`, reaching 2.5 at floor 4. Held to the same
  // ceiling across eight regions rather than reaching 4.5 at region 8: this
  // hardens INDIVIDUAL champions on top of the world axis, which already
  // multiplies their HP by 7.36 there, and the two compounding was never the
  // intent.
  const floorHarden = 1 + 0.5 * Math.min(3, sim.regionIndex - 1);
  // Lobbers are the projectile pressure and hold 25–30% of the roster; the
  // rest split evenly across Charger / Splitter / Enrager.
  const lobbers = Math.round(o.total * 0.27);
  const bag = [];
  for (let i = 0; i < lobbers; i++) bag.push(ELITE_BY_KEY.lobber);
  const others = ['charger', 'splitter', 'enrager'];
  for (let i = 0; bag.length < o.total; i++) bag.push(ELITE_BY_KEY[others[i % others.length]]);
  shuffleWith(sim, bag);

  for (const v of bag) {
    const p = eliteSpot(sim);
    const e = sim.spawnEnemyById(v.id, p.x, p.y, { hpMult: v.hp * shrink * floorHarden, spdMult: v.spd });
    if (!e) continue;
    e.arenaVariant = v.key;
    e.radius *= 1.35;
    e.mats = Math.round(e.mats * 6 * shrink);
    e.dmg *= 1.15;
    if (v.key === 'enrager') { e.enrageRate = 0.055; e.baseSpd = e.spd; }
    o.spawnedCount++;
  }
  sim.pushEvent({ k: 'toast', idx: -1, text: `${o.spawnedCount} champions — they are already all around you` });
}

// a scattered spot at least ELITE_SAFE from every live player
function eliteSpot(sim) {
  const live = sim.livePlayers().filter(p => !p.downed);
  for (let tries = 0; tries < 40; tries++) {
    const x = WALL + 80 + rnd(sim) * (sim.W - 2 * WALL - 160);
    const y = WALL + 80 + rnd(sim) * (sim.H - 2 * WALL - 160);
    if (sim._inObstacle(x, y, 30)) continue;
    let ok = true;
    for (const p of live) if (dist2(x, y, p.x, p.y) < ELITE_SAFE * ELITE_SAFE) { ok = false; break; }
    if (ok) return { x, y };
  }
  // fall back to the farthest corner from the party rather than on top of it
  const cx = sim.W / 2, cy = sim.H / 2;
  const away = live.length ? live[0] : { x: cx, y: cy };
  return spot(sim, away.x > cx ? WALL + 120 : sim.W - WALL - 120,
    away.y > cy ? WALL + 120 : sim.H - WALL - 120, 40);
}

function shuffleWith(sim, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(sim) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// --- c. NEST PURGE -----------------------------------------------------
// Destructible spawners behind destructible walls. Each one alive keeps the
// global inflow up; the arena's own wave budget scales by the share still
// standing. A nest is invulnerable until BOTH of its rings are breached.
const NEST_RING_IN = 100;      // half-side of the inner box
const NEST_RING_OUT = 178;     // half-side of the outer box
const NEST_WALL_T = 26;        // barricade thickness

// Where the fortresses can stand. A ring is a CLOSED box, so two of them
// overlapping — or one touching arena scenery or the border — welds a sealed
// pocket into the map. Measured on a real seed before this existed: the party
// spawned in a 414-cell island and six of seven nests were unreachable, which
// is not a hard level, it is a broken one. Every ring therefore gets clear air
// around it, and the drop point is never inside one.
function nestSpots(sim, want) {
  const pad = NEST_RING_OUT + 58;
  const minX = WALL + pad, maxX = sim.W - WALL - pad;
  const minY = WALL + pad, maxY = sim.H - WALL - pad;
  const pts = [];
  if (maxX <= minX || maxY <= minY) return pts;
  const cx = sim.W / 2, cy = sim.H / 2;
  for (let tries = 0; tries < 1200 && pts.length < want; tries++) {
    const x = minX + rnd(sim) * (maxX - minX);
    const y = minY + rnd(sim) * (maxY - minY);
    if (Math.abs(x - cx) < pad && Math.abs(y - cy) < pad) continue;   // not on the party
    if (!sim.inMainRegion(x, y)) continue;                            // never behind a sealed wall
    let clear = true;
    for (const ob of sim.obstacles) {                                  // arena scenery
      if (x - pad < ob.x + ob.w && x + pad > ob.x && y - pad < ob.y + ob.h && y + pad > ob.y) { clear = false; break; }
    }
    if (!clear) continue;
    if (pts.some(q => Math.abs(q.x - x) < pad * 2 && Math.abs(q.y - y) < pad * 2)) continue;
    pts.push({ x, y });
  }
  return pts;
}

// WHICH CREATURE IS THE NEST. Nest Purge needs a spawner to besiege, and
// `wombden` was hard-named — so a Pacific Northwest Nest Purge put a base-roster
// star-shaped Wombden and its Flit brood in the middle of a cedar forest. Same
// shape as the profile levers: an objective that NAMES an id instead of asking
// the region is a hole the region cannot fill.
//
// Resolved by behaviour, so a region supplies its own nest by authoring an
// enemy with `behavior: 'nest'` and nothing else. NEITHER REGION DOES YET —
// this falls back to `wombden` today, every time, and that is a content gap
// (six archetypes, none of them a spawner) rather than a wiring one.
// `region_wire_gate` reports which regions are still borrowing it.
export function nestIdFor(sim) {
  const pop = sim.region && REGION_ENEMIES[sim.region];
  const own = pop && pop.enemies.find(e => e.behavior === 'nest');
  return own ? own.id : 'wombden';
}

function buildNests(sim, o) {
  const floorHp = regionHpMult(sim.regionIndex);
  // A barricade has to be worth swinging at: two of them (one per ring) is
  // the toll for reaching a nest, and that toll is comparable to the nest.
  // REGION TUNING, read here rather than baked into the wall. Region 1 halves
  // it (regions.js): Nest Purge is where a party first meets a barricade, and
  // the toll for reaching a nest should teach the mechanic before it tests it.
  // Regions with no multiplier are unchanged, which is every other one.
  const region = REGION_BY_INDEX[sim.regionIndex] || null;
  const wallMult = (region && region.tuning && region.tuning.nestWallHpMult) || 1;
  const wallHp = Math.round(210 * floorHp * sim.coopHp * CONFIG.enemyHpMult * wallMult);
  const spots = nestSpots(sim, o.total);
  o.total = Math.max(1, spots.length);   // a cramped arena fits fewer fortresses
  o.alive = o.total;
  for (const p of spots) {
    // noObjHp: the +50% map-wide toughness is for the garrison, not the keep —
    // the nest's own number is the briefed ×10 and nothing else.
    const e = sim.spawnEnemyById(nestIdFor(sim), p.x, p.y, { hpMult: 22, noObjHp: true });
    if (!e) continue;
    e.isNest = true;
    e.radius *= 1.5;
    e.mats = Math.round(e.mats * 4);
    // Per-nest spawn rate x3, and a brood cap that lets that rate actually
    // land. While the rings hold, the brood piles up INSIDE them — breaching a
    // nest opens the wall and everything it has been hoarding at the same time.
    e.spawnCdMult = 1 / 3;
    e.maxBroodCap = 6;
    e.nestShielded = true;                   // until both rings are breached
    o.nests.push(e.id);
    for (const [ring, half] of [[0, NEST_RING_OUT], [1, NEST_RING_IN]]) {
      nestRing(sim, o, e.id, ring, p.x, p.y, half, wallHp);
    }
  }
  o.breached = {};                           // nestId → {0: bool, 1: bool}
}

// A closed box of four barricades. Four sides rather than a mosaic of little
// blocks: taking one down opens a whole face, which reads instantly at a
// glance on a phone and keeps the obstacle count (and its per-frame cost)
// sane with eight nests on the field.
function nestRing(sim, o, nestId, ring, cx, cy, half, hp) {
  const T = NEST_WALL_T, S = half * 2;
  const meta = { nestId, ring, onBreak: onWallBreak };
  sim.addWall(cx - half, cy - half, S, T, hp, { ...meta });
  sim.addWall(cx - half, cy + half - T, S, T, hp, { ...meta });
  sim.addWall(cx - half, cy - half, T, S, hp, { ...meta });
  sim.addWall(cx + half - T, cy - half, T, S, hp, { ...meta });
}

function onWallBreak(sim, w) {
  const o = sim.obj;
  if (!o || o.type !== 'nest' || !o.breached) return;
  const b = o.breached[w.nestId] || (o.breached[w.nestId] = {});
  if (b[w.ring]) return;
  b[w.ring] = true;
  if (!(b[0] && b[1])) {
    sim.pushEvent({ k: 'toast', idx: -1, text: `Outer wall down — one more layer` });
    return;
  }
  const e = sim.enemyById(w.nestId);
  if (e) e.nestShielded = false;
  sim.pushEvent({ k: 'sfx', s: 'door' });
  sim.pushEvent({ k: 'toast', idx: -1, text: 'BREACHED — the nest is exposed' });
}

function tickNest(sim, o, dt) {
  let alive = 0;
  o.at = [];
  for (const id of o.nests) {
    const e = sim.enemyById(id);
    if (!e) continue;
    alive++;
    o.at.push([Math.round(e.x), Math.round(e.y), +(e.hp / e.maxHp).toFixed(2), e.nestShielded ? 1 : 0]);
  }
  o.alive = alive;
  // the inflow drops with every nest destroyed (read by _tickWave)
  sim.nestChoke = o.total ? alive / o.total : 1;
  if (alive === 0 && o.nests.length) o.done = true;
}

// --- d. BOUNTY HUNT ----------------------------------------------------
// Five champions in sequence, each with an escort pack. Killing one marks
// the next; the map/HUD always pings exactly one target.
//
// A mark is a SLOW STALKER with a boss's worth of health: it cannot chase
// anyone down, so the fight is entirely on the party's terms — except that
// the mark never stops calling reinforcements to its own position, so
// standing off and plinking it means fighting the stream the whole time.
// THE MARK'S MULTIPLIER, AND IT IS ONE TERM. Was 10, which measured as too
// much: the open Bounty Hunt balance question, now closed at 4. Replaced rather
// than layered — a x10 with a x0.4 correction bolted on top reads as two
// decisions and hides which one is the ruling (§13 rule 43's cousin: a number
// arrived at by cancellation is a number nobody can check). Flat at every party
// size; the stream already scales with the party and the mark is meant to be
// the same wall for everyone.
export const BOUNTY_HP_MULT = 4;   // on top of the floor-ramped boss fraction
const BOUNTY_SPD_CAP = 55;      // slower than anything else on the floor
const BOUNTY_STREAM = 1.5;      // stream spawns/second at solo, party-scaled
const BOUNTY_PAY_CAP = 100;     // stream kills that pay materials, per mark

function tickBounty(sim, o, dt) {
  if (o.markId !== null) {
    const e = sim.enemyById(o.markId);
    if (e) {
      o.markX = Math.round(e.x); o.markY = Math.round(e.y); o.markHp = e.hp / e.maxHp;
      bountyStream(sim, o, e, dt);
      return;
    }
    // The mark left the pool — but only a real death counts. Sim._killEnemy
    // stamps o.markDied, because a mark can also be REMOVED at full health: a
    // Fusehead rolled as a mark walks at the nearest player and self-detonates
    // at 94-98% HP, and an arena sweep removes everything. Counting either as a
    // kill hands out free objective progress for a hunt that never happened —
    // and it was also masking the regen defect below, by skipping past marks
    // nobody could kill.
    //
    // Guarded here rather than by filtering bombers out of the mark roll: the
    // roll is not the defect, the accounting is, and a filter would leave this
    // wrong for every other way an entity can leave the pool.
    o.markId = null;
    const died = o.markDied === true;
    o.markDied = undefined;
    if (!died) {
      o.spawnT = 3;
      sim.pushEvent({ k: 'toast', idx: -1, text: 'The mark slipped away — another stirs.' });
      return;
    }
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
  // ~60–70% of a (doubled) floor boss, eased on the early floors (see above),
  // and then BOUNTY_HP_MULT times that: a mark is not a big elite, it is a
  // fight of its own. The floor ramp still scales off this base.
  const target = bossHp(sim) * bountyFraction(sim, rnd(sim)) * BOUNTY_HP_MULT;
  const base = sim.spawnEnemyById(table[Math.floor(rnd(sim) * table.length)], p.x, p.y,
    { elite: true, mod: sim.waveRng.pick(sim.eliteMods()) });
  if (!base) { o.spawnT = 1; return; }
  base.hp = base.maxHp = Math.round(target);
  base.radius *= 1.55;
  base.bounty = true;
  base.mats = Math.round(base.mats * 10);
  base.spd = Math.min(base.spd, BOUNTY_SPD_CAP);   // a stalker, never a chaser
  base.baseSpd = base.spd;
  o.streamKills = 0;                               // the anti-farm budget is per mark
  o.streamT = 0;
  o.markId = base.id;
  o.markX = Math.round(base.x); o.markY = Math.round(base.y); o.markHp = 1;
  sim.addTelegraph({ shape: 'circle', x: p.x, y: p.y, r: 90, dur: 1.2, spawnMark: true });
  for (let i = 0; i < 4; i++) {                    // the escort pack
    const ea = a + (i - 1.5) * 0.4;
    const ep = spot(sim, p.x + Math.cos(ea) * 120, p.y + Math.sin(ea) * 120, 30);
    sim.spawnEnemyById(table[Math.floor(rnd(sim) * table.length)], ep.x, ep.y, {});
  }
  sim.pushEvent({ k: 'toast', idx: -1, text: `Bounty ${o.killed + 1}/${o.need} marked — it calls for help` });
}

// The mark's own inflow: a steady stream out of its position for as long as it
// lives. Scaled by party size, and it dies with the mark — there is no wave to
// mop up afterwards, which is what makes the gap between marks feel like air.
function bountyStream(sim, o, e, dt) {
  o.streamT = (o.streamT || 0) + dt * BOUNTY_STREAM * sim.coopSpawn;
  const ceiling = Math.min(CONFIG.ALIVE_CEILING, CONFIG.POOL_ENEMIES - 10);
  // A mark now lives for minutes, so an uncapped stream is not pressure, it is
  // an accumulating wall: at 4 players it pinned the 300-alive ceiling and the
  // level became unwinnable — every projectile stopped in chaff and the mark
  // never took a scratch. The stream holds a live population instead, so it
  // keeps coming forever without ever burying the fight.
  const alive = Math.max(0, sim.enemyPool.count - 1);   // the mark isn't chaff
  const players = Math.max(1, sim.players.filter(p => !p.gone).length);
  const streamCap = 14 + 7 * (players - 1);
  const table = floorTable(sim);
  let guard = 0;
  while (o.streamT >= 1 && guard++ < 8) {
    o.streamT -= 1;
    if (alive + guard > streamCap) { o.streamT = 0; return; }
    if (sim.enemyPool.count + sim.spawnQueue.length >= ceiling) { o.streamT = 0; return; }
    // A RING around the mark, not a pile on top of it. Spawned at arm's length
    // the stream became a literal shield: projectiles stop at the first body,
    // so 89% of a solo player's damage went into chaff and the mark barely
    // moved. From 260–420 out it walks in as pressure instead of armour.
    const a = rnd(sim) * Math.PI * 2;
    const r = 260 + rnd(sim) * 160;
    const sp = spot(sim, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 26);
    sim.spawnEnemyById(table[Math.floor(rnd(sim) * table.length)], sp.x, sp.y, {});
  }
}

// --- e. BREACH ---------------------------------------------------------
// A lethal wall crawls in from the entry edge and NEVER stops. Ahead of the
// party, sealed doors gate each segment, each one on its own clock. You do
// not earn the door — you SURVIVE it, in a space that keeps shrinking until
// there is a sliver of corridor left, and then it opens.

// How thin the corridor gets at the end of every leg. Roughly a fifth of a
// phone-width viewport: enough to fight in, not enough to run away in.
const BREACH_SLIT = 240;

// Set up the current leg: how long its door holds, and the exact collapse
// speed that lands the wall one slit-width short of that door as the clock
// hits zero. Pacing is derived, not guessed, so the squeeze always happens.
function beginBreachLeg(sim, o) {
  const targetX = o.seg < o.doors.length ? o.doors[o.seg] : o.gate.x;
  const len = Math.max(240, targetX - o.wallX);
  o.segDur = clamp(len / 30, 25, 40);          // ~25–40s, longer legs hold longer
  o.segT = o.segDur;
  o.speed = Math.max(6, (len - BREACH_SLIT) / o.segDur);
  o.wallStop = targetX - BREACH_SLIT;          // the slit, and no further
}

function tickBreach(sim, o, dt) {
  const doorX = o.seg < o.doors.length ? o.doors[o.seg] : null;
  o.wallX = Math.min(o.wallStop, o.wallX + o.speed * dt);
  o.segT -= dt;
  if (o.segT <= 0 && doorX !== null) {
    o.seg++;
    beginBreachLeg(sim, o);
    sim.pushEvent({ k: 'sfx', s: 'door' });
    sim.pushEvent({
      k: 'toast', idx: -1,
      text: o.seg >= o.doors.length ? 'THE LAST DOOR OPENS — RUN FOR THE GATE' : `DOOR ${o.seg}/${o.doors.length} OPEN — PUSH ON`,
    });
    return;
  }
  // the sealed door is a hard barrier until its clock runs out
  for (const p of sim.livePlayers()) {
    if (p.downed) continue;
    if (doorX !== null && p.x > doorX - 26) { p.x = doorX - 26; }
    if (p.x < o.wallX) sim.hurtPlayer(p, o.dps * dt, null, { trueDamage: true });
    if (doorX === null && dist2(p.x, p.y, o.gate.x, o.gate.y) < 100 * 100) { o.done = true; return; }
  }
  // enemies swallowed by the collapse die with it, and nothing lives past the
  // sealed door either (spawns are constrained to the active segment)
  for (const e of [...sim.enemyPool]) {
    if (e.x < o.wallX - 30) sim._killEnemy(e, null);
    else if (doorX !== null && e.x > doorX - 20) e.x = doorX - 20;
  }
  if (o.wallX > sim.W) o.wallX = sim.W;
}

// Breach spawns belong to the ACTIVE segment and arrive from BOTH ENDS of it:
// out of the collapse behind the party and through the sealed door ahead of
// them. There is no safe side of the fight to back into.
export function objectiveSpawnX(sim) {
  const o = sim.obj;
  if (!o || o.type !== 'breach' || o.done) return null;
  const doorX = o.seg < o.doors.length ? o.doors[o.seg] : sim.W - WALL - 60;
  const lo = Math.max(WALL + 60, o.wallX + 60);
  const hi = Math.max(lo + 120, doorX - 40);
  const depth = Math.min(220, (hi - lo) * 0.35);
  return rnd(sim) < 0.5
    ? lo + rnd(sim) * depth                    // pouring out of the collapse
    : hi - rnd(sim) * depth;                   // pouring in through the door
}

// --- f. RELIC RUN ------------------------------------------------------
// Pick the relic up by walking over it; carrying is slow and loud; bank it at
// the altar. Going down drops it where you fell — and a dropped relic still
// has to be banked before the next one surfaces, so a wipe on the way home
// costs the whole walk back. Only ever one relic in the world.
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
        spawnNextRelic(sim, o);   // the next one, with its own share of the level
        return;                   // o.relics was replaced — restart the walk
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

// Anti-farm hooks. Returns false if this kill drops nothing.
//   Zone Control — a segment pays for 150 kills, then the taps close until
//                  the next zone is captured.
//   Bounty Hunt  — a mark's stream is infinite, so it pays for 100 kills and
//                  then stops; the mark itself always pays, and the budget
//                  resets when the next one is marked.
export function objectiveKillPays(sim, e) {
  const o = sim.obj;
  if (!o) return true;
  if (o.type === 'zone') {
    o.kills++;
    return o.kills <= o.killCap;
  }
  if (o.type === 'bounty') {
    if (e && e.bounty) return true;
    o.streamKills = (o.streamKills || 0) + 1;
    return o.streamKills <= BOUNTY_PAY_CAP;
  }
  return true;
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
  // The mark's own stream (see bountyStream) is this level's inflow now, and
  // it is heavy; the ambient wave drops to a whisper so the pause between
  // marks stays a pause rather than another wave arriving from the edges.
  if (o.type === 'bounty') return 0.15;
  // The nests themselves now run at 3x (spawnCdMult below); the global
  // reduction per destroyed nest is untouched — it is the same nestChoke
  // fraction it always was. The AMBIENT term had to come down, though: a nest
  // with ten times the health keeps the choke near 1.0 ten times longer, so
  // the old trickle ran at full rate for the whole (much longer) level and
  // simply accumulated to the 300-alive ceiling. The nests are the threat on
  // this map now; the arena's own wave is a background hum.
  if (o.type === 'nest') return 0.07 + 0.22 * (sim.nestChoke === undefined ? 1 : sim.nestChoke);
  // Breach doubles down: the corridor is meant to be shoulder-to-shoulder with
  // things trying to kill you, from both ends of a shrinking box. At 0.8 the
  // level played as a lap of the room collecting money between doors.
  //
  // The multiplier tapers by floor because the underlying wave rate does NOT:
  // a flat 2.6 pins floors 3–4 against the 300-alive ceiling for the whole
  // back half of the level, which is neither a fight nor legible on a phone.
  // Tapered, every floor gets the same felt escalation — the slit fills up as
  // the clock runs down instead of being full from the first door onward.
  // TAPERED, AND FLOORED. `2.6 - 0.4*(n-1)` reaches 0.2 at region 7 and goes
  // NEGATIVE at region 8 — a negative spawn multiplier is not a gentler
  // Breach, it is a Breach with no enemies in it and no way to fail. The taper
  // was authored across four floors and the floor of 1.0 is what stops it
  // running off the end of its own axis.
  if (o.type === 'breach') return Math.max(1.0, 2.6 - 0.4 * (sim.regionIndex - 1));
  if (o.type === 'payload') return 0.9;
  // Relic Run has NO ambient inflow at all: its whole budget is pre-spent as
  // the five packs that land with the five relics (see spawnNextRelic). The
  // quiet walk home is the level's shape — a trickle would erase it.
  if (o.type === 'relic') return 0;
  // The other endless levels have no wave timer, so the ramp would otherwise
  // sit at full rate forever — harsher than any 60–90s horde arena ever gets.
  // These trims keep the pressure constant-but-survivable.
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
    case 'elite_arena': {
      const done = Math.max(0, o.spawnedCount - sim.enemyPool.count);
      return { ...base, text: `${done}/${o.spawnedCount || o.total} champions down`,
        prog: o.spawnedCount ? done / o.spawnedCount : 0,
        sub: `${sim.enemyPool.count} still standing` };
    }
    case 'nest': {
      const shielded = (o.at || []).filter(n => n[3]).length;
      return { ...base, text: `${o.alive}/${o.total} nests standing`, prog: o.total ? 1 - o.alive / o.total : 0,
        sub: shielded ? `${shielded} still walled in — breach both rings` : 'destroy the spawners',
        nests: o.at || [],
        // Only the DAMAGED barricades ride the snapshot: intact ones are
        // already drawn from the (once-per-room) obstacle payload, and
        // shipping all 56 of them 12 times a second cost a kilobyte per
        // snapshot for geometry that never moves.
        walls: sim.walls.filter(w => w.hp < w.maxHp)
          .map(w => [r(w.x), r(w.y), r(w.w), r(w.h), +(w.hp / w.maxHp).toFixed(2)]) };
    }
    case 'bounty':
      return { ...base, text: `${o.killed}/${o.need} bounties`, prog: o.killed / o.need,
        mark: o.markId !== null ? [o.markX, o.markY, +(o.markHp || 1).toFixed(2)] : null };
    case 'breach': {
      const last = o.seg >= o.doors.length;
      const left = Math.max(0, Math.ceil(o.segT));
      return { ...base,
        text: last ? 'reach the gate — it is the way out' : `door ${o.seg + 1}/${o.doors.length} — ${left}s`,
        prog: (o.seg + (1 - Math.max(0, o.segT) / o.segDur)) / (o.doors.length + 1),
        sub: last ? 'the gate IS the extraction — GO' : 'survive until it opens · the collapse is closing',
        wall: r(o.wallX), gate: [r(o.gate.x), r(o.gate.y)],
        doors: o.doors.slice(o.seg).map(d => r(d)),
        timer: left };
    }
    case 'relic': {
      const held = o.relics.some(rl => rl.carrier >= 0);
      return { ...base, text: `${o.banked}/${o.need} banked`, prog: o.banked / o.need,
        sub: held ? 'carry it to the altar' : 'one relic out there — go and get it',
        altar: [r(o.altar.x), r(o.altar.y)],
        relics: o.relics.map(rl => [r(rl.x), r(rl.y), rl.carrier]) };
    }
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
