// TRIGGER EVALUATION — host only, fixed interval, spatial-grid backed.
//
// Clients never evaluate a trigger, never decide a skill fired, and never
// predict a fire locally. A fire is resolved host-side and its visual is
// broadcast as an fx event like any other. Client-side evaluation would desync
// builds within seconds, because two peers would disagree about which enemy was
// nearest on which tick.
//
// Evaluation is on a FIXED INTERVAL, not per frame. At 8 players x up to 8
// slotted actives x a dense enemy population, per-frame evaluation is the most
// likely performance failure in the whole design. At 10 Hz a skill fires at
// most 100 ms after its condition became true, which is nothing against
// cooldowns measured in seconds.

import { CONFIG } from './config.js';

export const TRIGGER_TICK_MS = 100;              // 10 Hz
export const GRID_CELL_PX = 128;
export const MAX_TRIGGER_EVALS_PER_TICK = 256;

export const TRIGGER_KINDS = [
  'PROXIMITY', 'NEAREST', 'ISOLATED', 'ON_KILL', 'ON_HIT_TAKEN', 'ON_DODGE',
  'SELF_THRESHOLD', 'TARGET_THRESHOLD', 'ON_STATUS', 'MOVEMENT',
];

// Which params each kind requires. Checked at load — a trigger missing a param
// would otherwise read `undefined` as a radius and quietly never fire, which is
// the exact failure mode section 11 exists to prevent.
export const TRIGGER_PARAMS = {
  PROXIMITY: ['radius', 'count'],
  NEAREST: ['range'],
  ISOLATED: ['radius', 'count'],
  ON_KILL: [],
  ON_HIT_TAKEN: [],
  ON_DODGE: ['window'],
  SELF_THRESHOLD: ['pct'],
  TARGET_THRESHOLD: ['pct', 'range'],
  ON_STATUS: ['status', 'range'],
  MOVEMENT: ['mode', 'seconds'],
};

// ---------------------------------------------------------------- spatial grid
//
// Uniform hash over enemies, rebuilt once per trigger tick. EVERY proximity,
// nearest and isolation query goes through this. No trigger performs a linear
// scan over the full enemy array — at 300 enemies x 64 slots that is 19,200
// distance checks per tick, and it is the difference between this design
// running on a phone and not.

export class EnemyGrid {
  constructor(cell = GRID_CELL_PX) {
    this.cell = cell;
    this.buckets = new Map();
    this.queries = 0;
    this.count = 0;
  }

  rebuild(enemies) {
    this.buckets.clear();
    this.count = 0;
    for (const e of enemies) {
      if (!e.active) continue;
      const k = this._key(e.x, e.y);
      let b = this.buckets.get(k);
      if (!b) { b = []; this.buckets.set(k, b); }
      b.push(e);
      this.count++;
    }
  }

  _key(x, y) {
    return ((Math.floor(x / this.cell) | 0) * 73856093 ^ (Math.floor(y / this.cell) | 0) * 19349663) >>> 0;
  }

  // Every enemy in the cells overlapping a circle. Callers still range-check —
  // the grid narrows the candidate set, it does not answer the question.
  *near(x, y, r) {
    this.queries++;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const b = this.buckets.get(((gx | 0) * 73856093 ^ (gy | 0) * 19349663) >>> 0);
        if (!b) continue;
        for (const e of b) if (e.active) yield e;
      }
    }
  }

  countWithin(x, y, r) {
    const r2 = r * r;
    let n = 0;
    for (const e of this.near(x, y, r)) {
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= r2) n++;
    }
    return n;
  }

  nearest(x, y, r) {
    const r2 = r * r;
    let best = null, bd = Infinity;
    for (const e of this.near(x, y, r)) {
      const dx = e.x - x, dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d <= r2 && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // Up to `n` nearest, sorted. Used by multi-target composes (Dark Energy Rift).
  nearestN(x, y, r, n) {
    const r2 = r * r, out = [];
    for (const e of this.near(x, y, r)) {
      const dx = e.x - x, dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d <= r2) out.push([d, e]);
    }
    out.sort((a, b) => a[0] - b[0]);
    return out.slice(0, n).map(v => v[1]);
  }

  // The direction with the most enemies in it, for cones. Eight buckets is
  // enough resolution for a cone measured in tens of degrees.
  densestAngle(x, y, r) {
    const bins = new Float64Array(8);
    let any = false;
    const r2 = r * r;
    for (const e of this.near(x, y, r)) {
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy > r2) continue;
      any = true;
      const a = Math.atan2(dy, dx);
      bins[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]++;
    }
    if (!any) return null;
    let bi = 0;
    for (let i = 1; i < 8; i++) if (bins[i] > bins[bi]) bi = i;
    return bi * (Math.PI / 4);
  }
}

// ---------------------------------------------------------------- evaluation

// Does one trigger's condition hold right now?
//
// COOLDOWN IS TESTED BY THE CALLER, BEFORE THIS IS REACHED. That ordering is
// most of the performance win: a skill on cooldown costs a number comparison,
// not a spatial query.
export function triggerHolds(sim, p, skill, st, grid) {
  const t = skill.trigger;
  switch (t.kind) {
    case 'NEAREST':
      return !!grid.nearest(p.x, p.y, t.range);

    case 'PROXIMITY':
      return grid.countWithin(p.x, p.y, t.radius) >= t.count;

    case 'ISOLATED':
      // "fewer than count within radius" is true in an empty room too, which is
      // correct: a skill that rewards breaking away should not also require
      // company. Skills that need a target get one from their compose step.
      return grid.countWithin(p.x, p.y, t.radius) < t.count;

    case 'ON_KILL':
      return p.trigEvents.kill > 0;

    case 'ON_HIT_TAKEN':
      return p.trigEvents.hitTaken > 0;

    case 'ON_DODGE':
      // set by the sim when a telegraph resolves and the player was outside it
      return sim.time - (p.trigEvents.dodgeT ?? -999) <= t.window / 1000;

    case 'SELF_THRESHOLD': {
      // EDGE-triggered: fires on the crossing, not continuously while below.
      // Re-arms when HP comes back above the line.
      const frac = p.hp / Math.max(1, p.stats.vitality);
      const below = frac < t.pct / 100;
      if (!below) { st.armed = true; return false; }
      if (st.armed) { st.armed = false; return true; }
      return false;
    }

    case 'TARGET_THRESHOLD': {
      for (const e of grid.near(p.x, p.y, t.range)) {
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy > t.range * t.range) continue;
        if (e.hp / Math.max(1, e.maxHp) < t.pct / 100) return true;
      }
      return false;
    }

    case 'ON_STATUS': {
      for (const e of grid.near(p.x, p.y, t.range)) {
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy > t.range * t.range) continue;
        if (hasStatus(e, t.status)) return true;
      }
      return false;
    }

    case 'MOVEMENT':
      return t.mode === 'still'
        ? p.stillT >= t.seconds
        : (p.movingT || 0) >= t.seconds;

    default:
      return false;
  }
}

// The status vocabulary a trigger can ask about, mapped onto the fields the
// existing sim already keeps. Named here rather than inline so ON_STATUS has
// one place to grow.
export function hasStatus(e, status) {
  switch (status) {
    case 'dot': return e.burnT > 0 || (e.plagueT || 0) > 0;
    case 'slow': return e.slowT > 0;
    case 'plague': return (e.plagueT || 0) > 0;
    case 'weakened': return (e.weakDmgT || 0) > 0 || (e.defDownT || 0) > 0;
    default: return false;
  }
}
