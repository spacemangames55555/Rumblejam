// The Hunter's melee beast — the occupant of a Pack Tactics slot.
//
// A leashed pet that meanders near its owner, pursues nearby enemies, bites on
// a cooldown, body-blocks enemies and enemy fire, and gets back up 15 seconds
// after being knocked down.
//
// It runs on the HOST ONLY, like every other entity behaviour. Clients render
// what the snapshot tells them and run none of this. Two consequences the rest
// of this file is built around:
//
//   1. Every range below is in WORLD UNITS. The renderer always shows exactly
//      1280x720 world units regardless of the viewport, so "about a quarter of
//      the screen" is a fixed world quantity. A screen-derived range would make
//      the beast behave differently per peer the moment two players sat at
//      different window sizes, and the divergence would be invisible until it
//      mattered. Nothing in this module may read a canvas, a viewport or a
//      device pixel ratio.
//
//   2. Wander points come from the SEEDED sim RNG, never Math.random(). Same
//      seed, same path, on every peer and in the test suite.

import { dist2, angleTo, clamp } from '../util.js';
import { subRng } from '../rng.js';
import { CONFIG } from '../config.js';

const { WALL } = CONFIG;

export const BEAST = {
  // --- geometry, world units ---
  RADIUS: 14,          // matches the enemy->summon contact check in game.js
  MEANDER_R: 320,      // 5 floor-grid squares from the owner
  AGGRO_R: 320,        // from the BEAST, not the owner
  LEASH_R: 640,        // 10 grid squares, about half the visible width
  // --- movement ---
  SPEED: 330,          // slightly above the player's 300 so it can catch up
  LUNGE: 0.25,         // fraction of SPEED kept while biting, so it stays glued
  ARRIVE: 26,          // wander point counts as reached inside this
  WANDER_S: 2.2,       // ...or after this long, whichever comes first
  // --- targeting ---
  // A new target must be meaningfully closer than the committed one before the
  // beast will switch. Without this it oscillates between two enemies at
  // similar distance and reaches neither.
  RETARGET: 0.85,      // 15% closer
  // --- knockdown ---
  DOWN_S: 15,          // a hiccup, not a stakes moment (~a tenth of a round)
};

export const BEAST_STATES = ['meander', 'pursue', 'attack', 'downed'];

// Fresh behaviour fields. Called once, at spawn, before the first tick.
//
// This also RE-PLACES the beast, overwriting the Math.random() scatter that
// Sim._spawnSummon gives every summon. A seeded state machine started from an
// unseeded position is not deterministic, and the scatter is the first thing
// every later position derives from. Only beasts are re-placed; drones,
// turrets and rams keep the existing scatter untouched.
export function initBeast(sim, s) {
  sim.beastCounter = (sim.beastCounter || 0) + 1;
  s.bid = sim.beastCounter;   // stable per-beast id, for its RNG stream
  const p = sim.players[s.owner];
  const rng = subRng(sim.seed, 'beastspawn', s.bid);
  const a = rng.float() * Math.PI * 2;
  const r = 30 + rng.float() * 30;
  s.x = clamp(p.x + Math.cos(a) * r, WALL + BEAST.RADIUS, sim.W - WALL - BEAST.RADIUS);
  s.y = clamp(p.y + Math.sin(a) * r, WALL + BEAST.RADIUS, sim.H - WALL - BEAST.RADIUS);
  s.state = 'meander';
  s.targetId = null;
  s.wanderN = 0;              // how many wander points this beast has drawn
  s.wanderT = 0;
  s.wx = s.x; s.wy = s.y;
  s.down = false;
  s.downT = 0;
}

// A beast that is up: collides, bites, can be hurt, counts as a live beast.
export function beastUp(s) {
  return s.type === 'beast' && !s.dead && !s.down;
}

// ---------------------------------------------------------------- per tick

// `st` is the summon stat block from Sim._summonStats — hp/dmg/cd come from
// the weapon def and the owner's Ingenuity exactly as the drone's did.
export function updateBeast(sim, s, st, dt) {
  const p = sim.players[s.owner];

  if (s.down) {
    s.downT -= dt;
    if (s.downT <= 0) {
      // Revive ON THE OWNER, not where it fell — respawning in place drops it
      // straight back into the pack that put it down.
      s.x = p.x; s.y = p.y;
      s.hp = s.maxHp;
      s.down = false; s.downT = 0;
      s.state = 'meander';
      s.targetId = null;
      s.wanderT = 0;
      pickWander(sim, s, p);
    }
    return;   // inert: no movement, no collision, no attack, not targetable
  }

  const target = chooseTarget(sim, s, p);
  s.targetId = target ? target.id : null;

  if (!target) {
    s.state = 'meander';
    meander(sim, s, p, dt);
  } else {
    const reach = BEAST.RADIUS + target.radius;
    const inContact = dist2(s.x, s.y, target.x, target.y) <= reach * reach;
    s.state = inContact ? 'attack' : 'pursue';
    const a = angleTo(s.x, s.y, target.x, target.y);
    s.aimA = a;
    // Attacking still creeps forward at a quarter speed so a shuffling enemy
    // does not walk out of the bite, but it does not drift off the target.
    const spd = BEAST.SPEED * (inContact ? BEAST.LUNGE : 1);
    step(sim, s, a, spd, dt);
  }

  place(sim, s, p);

  // bite
  s.cd -= dt;
  if (s.state === 'attack' && s.cd <= 0 && target && target.active) {
    s.cd = st.cd;
    sim._hitEnemy(target, Math.max(1, Math.round(st.dmg)), {
      owner: p, crit: false, weaponDef: st.def,
      knock: (st.knock || 0) * p.hookAgg.knockMult,
      baseDmg: st.dmg, summon: true,
    }, angleTo(s.x, s.y, target.x, target.y));
    if (st.burn && target.active) sim._applyBurn(target, sim._attuned(p, st.burn.dps), st.burn.dur, p);
  } else if (s.cd < 0) {
    s.cd = 0;
  }
}

// Nearest enemy inside BOTH the beast's aggro radius and the owner's leash.
// An enemy 300 from the beast but 700 from the owner is not a valid target —
// chasing it would only end at the leash boundary.
//
// The committed target is kept until it dies or leaves the leash, even if it
// wanders past the aggro radius; that is what makes the commitment mean
// anything. It is dropped early only for something RETARGET-times closer.
function chooseTarget(sim, s, p) {
  const leash2 = BEAST.LEASH_R * BEAST.LEASH_R;
  const aggro2 = BEAST.AGGRO_R * BEAST.AGGRO_R;

  let held = null;
  if (s.targetId !== null) {
    for (const e of sim.enemyPool) {
      if (e.id !== s.targetId) continue;
      if (e.active && dist2(e.x, e.y, p.x, p.y) <= leash2) held = e;
      break;
    }
  }

  let best = null, bd = Infinity;
  for (const e of sim.enemyPool) {
    if (!e.active) continue;
    if (dist2(e.x, e.y, p.x, p.y) > leash2) continue;      // outside the leash
    const d = dist2(s.x, s.y, e.x, e.y);
    if (d > aggro2) continue;                              // outside aggro
    if (d < bd) { bd = d; best = e; }
  }

  if (!held) return best;
  if (!best || best === held) return held;
  const hd = dist2(s.x, s.y, held.x, held.y);
  // compare in squared space: 15% closer in distance is RETARGET^2 in d2
  return bd < hd * BEAST.RETARGET * BEAST.RETARGET ? best : held;
}

// No valid target: drift around the owner. Deliberately NOT pacing at the
// leash boundary when a target sits outside it — a beast pacing an edge is
// still a near-stationary target for a ranged enemy, and a beast near the
// owner is both harder to hit and somewhere the owner can help.
function meander(sim, s, p, dt) {
  s.wanderT -= dt;
  const stale = dist2(s.wx, s.wy, p.x, p.y) > BEAST.MEANDER_R * BEAST.MEANDER_R;
  if (s.wanderT <= 0 || stale || dist2(s.x, s.y, s.wx, s.wy) <= BEAST.ARRIVE * BEAST.ARRIVE) {
    pickWander(sim, s, p);
  }
  const a = angleTo(s.x, s.y, s.wx, s.wy);
  s.aimA = a;
  step(sim, s, a, BEAST.SPEED * 0.55, dt);   // an amble, not a sprint
}

// A wander point inside the meander radius around the owner, drawn from the
// seeded sim RNG. sqrt on the radius keeps the points uniform over the disc
// rather than bunched at the centre.
function pickWander(sim, s, p) {
  const rng = subRng(sim.seed, 'beast', s.bid, s.wanderN++);
  const a = rng.float() * Math.PI * 2;
  const r = Math.sqrt(rng.float()) * BEAST.MEANDER_R;
  s.wx = clamp(p.x + Math.cos(a) * r, 40, sim.W - 40);
  s.wy = clamp(p.y + Math.sin(a) * r, 40, sim.H - 40);
  s.wanderT = BEAST.WANDER_S;
}

function step(sim, s, a, spd, dt) {
  s.x += Math.cos(a) * spd * dt;
  s.y += Math.sin(a) * spd * dt;
}

// Walls, room bounds, and the hard leash clamp — applied in every state so no
// code path can leave the beast outside its leash, including the one where the
// owner runs away mid-pursuit.
function place(sim, s, p) {
  s.x = clamp(s.x, WALL + BEAST.RADIUS, sim.W - WALL - BEAST.RADIUS);
  s.y = clamp(s.y, WALL + BEAST.RADIUS, sim.H - WALL - BEAST.RADIUS);
  sim._pushOut(s, BEAST.RADIUS);
  clampLeash(s, p);
}

export function clampLeash(s, p) {
  const dx = s.x - p.x, dy = s.y - p.y;
  const d2 = dx * dx + dy * dy;
  const L2 = BEAST.LEASH_R * BEAST.LEASH_R;
  if (d2 <= L2 || d2 < 0.0001) return;
  const d = Math.sqrt(d2);
  s.x = p.x + dx / d * BEAST.LEASH_R;
  s.y = p.y + dy / d * BEAST.LEASH_R;
}

// ---------------------------------------------------------------- collision

// Body-block: push an enemy out of any live beast it has walked into. Called
// from Sim.clampToRoom, which every enemy movement path already ends in, so
// there is no mover that can slip past it.
//
// The push moves the ENEMY, never the beast: a beast shoved by the crowd would
// be squeezed off its owner and the leash clamp would fight the push every
// tick.
//
// BOSSES ARE EXEMPT, and this is a balance rule rather than a physics one. A
// beast costs nothing to lose: it is knocked down rather than killed, it holds
// its Pack Tactics slot while it is down, and it comes back on the owner at
// full HP 15 seconds later. So a 45 HP pet parked in a boss's path would be a
// free wall on a 15-second cycle with no resource behind it — park, lose
// nothing, repeat. Every other enemy can walk around a beast or kill it for
// good value; a boss fight is the one place where "block it and pay nothing"
// is the whole encounter.
export function beastBlocks(sim, e) {
  if (!sim.summons.length || e.boss) return;
  const er = e.radius;
  for (const s of sim.summons) {
    if (!beastUp(s)) continue;
    const r = er + BEAST.RADIUS;
    const dx = e.x - s.x, dy = e.y - s.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      e.x = s.x + dx / d * r;
      e.y = s.y + dy / d * r;
    } else {
      e.x = s.x + r;   // exactly concentric: any direction will do, pick one
    }
  }
}

// Enemy fire stops at a beast. Returns the beast that ate the shot, or null.
// Friendly fire passes through — a pet that blocks its owner's shots would be
// worse than no pet.
export function beastAbsorbs(sim, pr) {
  for (const s of sim.summons) {
    if (!beastUp(s)) continue;
    const r = pr.radius + BEAST.RADIUS;
    if (dist2(pr.x, pr.y, s.x, s.y) <= r * r) return s;
  }
  return null;
}

// One place that decides a beast has been knocked down, so the contact-damage
// path and the projectile path cannot disagree about what "downed" means.
export function hurtBeast(sim, s, amount) {
  if (!beastUp(s)) return;
  s.hp -= amount;
  if (s.hp > 0) return;
  s.hp = 0;
  s.down = true;
  s.downT = BEAST.DOWN_S;
  s.state = 'downed';
  s.targetId = null;
  sim.fx.deaths.push({ x: s.x, y: s.y, c: '#c98a4b', r: 14 });
}
