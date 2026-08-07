// Math helpers, object pool, spatial hash grid.

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const angDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const rint = v => Math.round(v);

// Fixed-capacity object pool. Objects carry `active`; iteration walks a dense
// list of live indices maintained on alloc/free.
export class Pool {
  constructor(capacity, factory) {
    this.items = new Array(capacity);
    for (let i = 0; i < capacity; i++) { this.items[i] = factory(); this.items[i]._pi = i; this.items[i].active = false; }
    this.free = [];
    for (let i = capacity - 1; i >= 0; i--) this.free.push(i);
    this.live = new Set();
  }
  // EXHAUSTIVE RESET, not an enumerated one.
  //
  // A recycled slot used to arrive carrying every field its previous occupant
  // left on it, and each spawn path cleared the ones somebody had remembered.
  // That produced two shipped bugs with the same shape and neither surfaced
  // anywhere near its cause:
  //
  //   objective flags — a nest's invulnerability shield leaked onto ordinary
  //     chaff, leaving six unkillable enemies standing in a later horde arena
  //     so the fight could never end;
  //   telegraph fields — a chaff slot inherited telState WINDUP from a slabjaw,
  //     sat in it forever because it had no telegraph block to tick, and threw
  //     when a stun rider called cancelTelegraph on it.
  //
  // Both were fixed by adding fields to a list. A list is the defect: it is
  // correct exactly until the next field is added, and the failure mode is
  // silent. So the slot is now WIPED here, and a spawn path can only produce
  // state it actually sets. Anything forgotten reads `undefined` at the point
  // of use instead of a plausible value from a different entity three rooms
  // ago — a loud, local failure instead of a quiet, distant one.
  //
  // Assigned rather than deleted: `delete` churns the hidden class and would
  // make every pooled object megamorphic. Keys keep their slots, values go.
  alloc() {
    if (!this.free.length) return null; // pool exhausted: caller skips spawn
    const i = this.free.pop();
    const o = this.items[i];
    for (const k in o) { if (k !== '_pi') o[k] = undefined; }
    o.active = true;
    this.live.add(i);
    return o;
  }
  release(o) {
    if (!o.active) return;
    o.active = false;
    this.live.delete(o._pi);
    this.free.push(o._pi);
  }
  clear() { for (const i of [...this.live]) this.release(this.items[i]); }
  *[Symbol.iterator]() { for (const i of this.live) yield this.items[i]; }
  get count() { return this.live.size; }
}

// Spatial hash over entities with x,y,radius. Rebuilt each tick.
export class SpatialHash {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  clear() { this.map.clear(); }
  _key(cx, cy) { return cx * 4096 + cy; }
  insert(e) {
    const c = this.cell;
    const x0 = Math.floor((e.x - e.radius) / c), x1 = Math.floor((e.x + e.radius) / c);
    const y0 = Math.floor((e.y - e.radius) / c), y1 = Math.floor((e.y + e.radius) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const k = this._key(cx, cy);
      let arr = this.map.get(k);
      if (!arr) { arr = []; this.map.set(k, arr); }
      arr.push(e);
    }
  }
  // Calls fn(e) for entities in cells overlapping the circle; may repeat entities
  // that span cells — callers must handle idempotently or dedupe by stamp.
  query(x, y, r, fn) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const arr = this.map.get(this._key(cx, cy));
      if (arr) for (let i = 0; i < arr.length; i++) fn(arr[i]);
    }
  }
}

export function formatStatLine(key, val, STAT_NAME, STAT_IS_PCT) {
  const sign = val > 0 ? '+' : '';
  const pct = STAT_IS_PCT[key] ? '%' : '';
  return `${sign}${val}${pct} ${STAT_NAME[key]}`;
}

// ---------------- segment vs axis-aligned rect (line of sight) ----------------
// Liang-Barsky clip. Returns the entry parameter t in [0,1] along the segment,
// or -1 when the segment misses the rect entirely.
export function segRectEntryT(x0, y0, x1, y1, rx, ry, rw, rh) {
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - rx, rx + rw - x0, y0 - ry, ry + rh - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return -1; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) { if (r > t1) return -1; if (r > t0) t0 = r; }
    else { if (r < t0) return -1; if (r < t1) t1 = r; }
  }
  return t0;
}
export function segHitsRect(x0, y0, x1, y1, rx, ry, rw, rh) {
  return segRectEntryT(x0, y0, x1, y1, rx, ry, rw, rh) >= 0;
}
