// Floor generation: random-walk room grid, Isaac-style. Deterministic from the
// run seed via a per-floor sub-stream. Every floor gets exactly one start,
// shop, treasure, elite (dead-end), and boss room (farthest from start);
// 1-2 combat rooms get hazard variants.

import { CONFIG } from './config.js';
import { subRng } from './rng.js';

const DIRS = [ [0, -1, 'n', 's'], [1, 0, 'e', 'w'], [0, 1, 's', 'n'], [-1, 0, 'w', 'e'] ];

export function generateFloor(seed, floorNum) {
  const rng = subRng(seed, 'floor', floorNum);
  const target = rng.int(CONFIG.ROOMS_MIN, CONFIG.ROOMS_MAX);
  // one retry loop: layouts can rarely fail to place the elite dead-end
  for (let attempt = 0; attempt < 24; attempt++) {
    const floor = tryGenerate(rng, target, floorNum);
    if (floor) return floor;
  }
  // fallback never expected; tryGenerate with relaxed elite requirement
  return tryGenerate(rng, target, floorNum, true);
}

function key(x, y) { return `${x},${y}`; }

function tryGenerate(rng, target, floorNum, relaxed = false) {
  const cells = new Map(); // "x,y" -> room
  const add = (x, y) => {
    const r = { id: cells.size, gx: x, gy: y, kind: 'combat', hazard: null, doors: {} };
    cells.set(key(x, y), r);
    return r;
  };
  add(0, 0);
  let guard = 0;
  while (cells.size < target && guard++ < 500) {
    const rooms = [...cells.values()];
    const from = rng.pick(rooms);
    const [dx, dy] = rng.pick(DIRS);
    const nx = from.gx + dx, ny = from.gy + dy;
    if (cells.has(key(nx, ny))) continue;
    // avoid 2x2 clumps for a more corridor-like layout (soft rule)
    let neighbors = 0;
    for (const [ax, ay] of DIRS) if (cells.has(key(nx + ax, ny + ay))) neighbors++;
    if (neighbors > 1 && rng.chance(0.7)) continue;
    add(nx, ny);
  }
  const rooms = [...cells.values()];
  // connect doors between adjacent rooms
  for (const r of rooms) {
    for (const [dx, dy, dir] of DIRS) {
      const n = cells.get(key(r.gx + dx, r.gy + dy));
      if (n) r.doors[dir] = n.id;
    }
  }
  // BFS distance from start
  const dist = new Array(rooms.length).fill(-1);
  dist[0] = 0;
  const q = [rooms[0]];
  while (q.length) {
    const r = q.shift();
    for (const nid of Object.values(r.doors)) {
      if (dist[nid] === -1) { dist[nid] = dist[r.id] + 1; q.push(rooms[nid]); }
    }
  }
  rooms[0].kind = 'start';
  // boss: farthest room
  let bossId = 1;
  for (let i = 1; i < rooms.length; i++) if (dist[i] > dist[bossId]) bossId = i;
  rooms[bossId].kind = 'boss';
  // candidates for shop/treasure: not start/boss, prefer dead ends
  const isLeaf = r => Object.keys(r.doors).length === 1;
  const others = rooms.filter(r => r.kind === 'combat');
  const sorted = [...others].sort((a, b) => (isLeaf(b) - isLeaf(a)) || (dist[b.id] - dist[a.id]));
  if (sorted.length < 3) return null;
  sorted[0].kind = 'shop';
  sorted[1].kind = 'treasure';
  // elite: attach a NEW dead-end room adjacent to some mid-distance room
  let elite = null;
  const anchors = rng.shuffle(rooms.filter(r => r.kind === 'combat' && dist[r.id] >= 1));
  outer:
  for (const a of anchors) {
    for (const [dx, dy, dir, opp] of rng.shuffle([...DIRS])) {
      const nx = a.gx + dx, ny = a.gy + dy;
      if (cells.has(key(nx, ny))) continue;
      elite = add(nx, ny);
      elite.kind = 'elite';
      elite.doors[opp] = a.id;
      a.doors[dir] = elite.id;
      rooms.push(elite); // rooms[] was snapshotted before the elite was carved
      break outer;
    }
  }
  if (!elite && !relaxed) return null;
  if (!elite) { // relaxed fallback: convert a leaf combat room
    const leaf = sorted.find(r => r.kind === 'combat');
    if (!leaf) return null;
    leaf.kind = 'elite';
  }
  // hazards on 1-2 combat rooms
  const combats = rng.shuffle(rooms.filter(r => r.kind === 'combat'));
  const hazardCount = Math.min(combats.length, rng.int(1, 2));
  for (let i = 0; i < hazardCount; i++) {
    combats[i].hazard = rng.chance(0.5) ? 'spikes' : 'lava';
  }
  if (rooms.filter(r => r.kind === 'combat').length < 3) return null;
  return { floorNum, rooms, startId: 0, bossId, dist };
}

// Serializable layout for clients (minimap + room rendering)
export function serializeFloor(floor) {
  return {
    floorNum: floor.floorNum,
    startId: floor.startId,
    bossId: floor.bossId,
    rooms: floor.rooms.map(r => ({ id: r.id, gx: r.gx, gy: r.gy, kind: r.kind, hazard: r.hazard, doors: r.doors })),
  };
}
