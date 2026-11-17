// REGION GROUND HAZARDS — GDD §2.2 rule 3: every region has "one
// environmental hazard that changes how players move" (ruling R-20).
//
// Eight hazards from five primitives. A patch is a circle of floor; a front is
// a band that sweeps the room. All of it is the PLAYER's problem: enemies
// cross hazards untouched, so a hazard changes where you stand and how you
// route, and never how fast the horde arrives or how the pace gates measure.
//
//   spdMult   your speed inside is multiplied by this     undergrowth, fae ring, quicksand, rot pool
//   dps       damage a second inside, × the region's        bloodmire, fae ring, rot pool, bushfire
//             damage multiplier (so it costs the same
//             share of health in every region)
//   drift     a current: units a second along the patch's  riptide
//             heading, resisted by Grit like any pull
//   ice       you cannot stop: with no input you keep        black ice
//             moving the way you last moved
//   front     a band that sweeps the room edge to edge,     bushfire
//             rests off-room, and comes again
//
// THE MOVEMENT HALF IS ONE FUNCTION. `hazardMoveAt` is read by the host's
// movement step and by a guest's own prediction, from the same patch list
// (the guest has it from st.arena), for the reason Deep Winter's multiplier
// is: a guest that predicts at full speed through brush is pulled back on
// every snapshot.
//
// PLACEMENT DRAWS NO SIM RNG. Patches come from their own named sub-stream
// (`subRng(seed, 'hazard', region, node)`), so adding them moved no spawn,
// no drop and no card in any measurement taken before they existed.
import { subRng } from './rng.js';
import { CONFIG } from './config.js';

export const REGION_HAZARDS = {
  undergrowth: { name: 'Undergrowth', spdMult: 0.7, count: [3, 4], r: [85, 115], color: '#1f3519', edge: '#4f7a3a' },
  bloodmire: { name: 'Bloodmire', dps: 5, count: [3, 4], r: [70, 100], color: '#3f0c16', edge: '#a3243b' },
  fae_ring: { name: 'Fae Ring', spdMult: 0.45, dps: 2, count: [2, 3], r: [75, 95], color: '#231a35', edge: '#c9a6ff' },
  quicksand: { name: 'Quicksand', spdMult: 0.5, count: [3, 4], r: [80, 110], color: '#5c4c2a', edge: '#c9a86a' },
  rot_pool: { name: 'Rot Pool', spdMult: 0.85, dps: 6, count: [2, 3], r: [95, 130], color: '#25310f', edge: '#8fb33a' },
  black_ice: { name: 'Black Ice', ice: true, count: [3, 4], r: [90, 130], color: '#17222e', edge: '#9fd6ff' },
  riptide: { name: 'Riptide', drift: 120, count: [2, 3], r: [110, 150], color: '#0d2638', edge: '#4fb3e8' },
  bushfire: { name: 'Bushfire', dps: 8, front: { width: 90, sweepS: 14, restS: 6, warnS: 2 }, color: '#4a1804', edge: '#ff8a2a' },
};
export const HAZARD_IDS = Object.keys(REGION_HAZARDS);

// Which rooms carry one. Plain fights only — a combat, elite or cursed room.
// Objective rooms already ask the player to stand somewhere (a zone, a relic,
// a payload), and the onboarding room (region 1, map 1) teaches the wind-up
// alone.
const HAZARD_ROOM_KINDS = new Set(['combat', 'elite', 'cursed']);
export function roomHasHazard(regionIndex, node) {
  if (!node || !HAZARD_ROOM_KINDS.has(node.kind)) return false;
  if (regionIndex === 1 && node.col === 0) return false;
  return true;
}

// The patches for one room. `obstacles` are rects {x,y,w,h}; a patch's centre
// keeps clear of them, of the drop point at the room's centre, and of the
// other patches. Returns [] for a region with no hazard or a room without one.
const DROP_CLEAR = 260;
export function placeHazards(seed, regionIndex, node, hazardId, w, h, obstacles = []) {
  const def = REGION_HAZARDS[hazardId];
  if (!def || !roomHasHazard(regionIndex, node)) return [];
  const rng = subRng(seed, 'hazard', regionIndex, node.id);
  if (def.front) {
    // one front per room; which edge it starts from is the room's
    const dir = rng.float() < 0.5 ? 1 : -1;
    return [{ type: 'region', id: hazardId, front: 1, dir, x: dir > 0 ? -def.front.width : w + def.front.width, w: def.front.width, on: 0, phase: Math.floor(rng.float() * def.front.restS) }];
  }
  const n = def.count[0] + Math.floor(rng.float() * (def.count[1] - def.count[0] + 1));
  const W = CONFIG.WALL;
  const out = [];
  for (let tries = 0; out.length < n && tries < 60; tries++) {
    const r = def.r[0] + rng.float() * (def.r[1] - def.r[0]);
    const x = W + r + rng.float() * Math.max(1, w - 2 * (W + r));
    const y = W + r + rng.float() * Math.max(1, h - 2 * (W + r));
    // Heading in whole DEGREES: the arena block is rounded to integers on the
    // wire (netcodec), and radians would arrive as 0–6.
    const a = Math.floor(rng.float() * 360);              // drawn for every patch, read by riptide
    if (Math.hypot(x - w / 2, y - h / 2) < DROP_CLEAR + r) continue;
    if (out.some(q => Math.hypot(q.x - x, q.y - y) < q.r + r + 40)) continue;
    // the whole circle clears every wall, so a patch never lies across one
    if (obstacles.some(o => Math.hypot(x - Math.max(o.x, Math.min(x, o.x + o.w)), y - Math.max(o.y, Math.min(y, o.y + o.h))) < r + 12)) continue;
    out.push({ type: 'region', id: hazardId, x: Math.round(x), y: Math.round(y), r: Math.round(r), a });
  }
  return out;
}

// Where a sweeping front stands `t` seconds into the room. Pure: the host
// ticks it and a guest's renderer can be handed the same answer.
export function frontAt(hz, t, roomW) {
  const f = REGION_HAZARDS[hz.id].front;
  const cycle = f.sweepS + f.restS;
  const ph = ((t + hz.phase) % cycle + cycle) % cycle;
  if (ph >= f.sweepS) return { on: 0, warn: ph >= cycle - f.warnS ? 1 : 0, x: hz.dir > 0 ? -f.width : roomW + f.width };
  const k = ph / f.sweepS;
  const span = roomW + 2 * f.width;
  const x = hz.dir > 0 ? -f.width + span * k : roomW + f.width - span * k;
  return { on: 1, warn: 0, x };
}

const inside = (hz, x, y) => {
  if (hz.front) return hz.on && Math.abs(x - hz.x) < hz.w / 2;
  const dx = x - hz.x, dy = y - hz.y;
  return dx * dx + dy * dy <= hz.r * hz.r;
};

// What the floor under (x, y) does to a body's movement. The host's movement
// step and a guest's prediction both call this.
export function hazardMoveAt(hazards, x, y) {
  let spd = 1, dx = 0, dy = 0, ice = false;
  if (!hazards) return { spd, dx, dy, ice };
  for (const hz of hazards) {
    if (hz.type !== 'region' || hz.front) continue;
    const def = REGION_HAZARDS[hz.id];
    if (!def || !inside(hz, x, y)) continue;
    if (def.spdMult) spd = Math.min(spd, def.spdMult);
    if (def.drift) { const ar = hz.a * Math.PI / 180; dx += Math.cos(ar) * def.drift; dy += Math.sin(ar) * def.drift; }
    if (def.ice) ice = true;
  }
  return { spd, dx, dy, ice };
}

// Damage a second the floor under (x, y) deals, before the region's
// multiplier. Read by the host only (damage is never predicted).
export function hazardDpsAt(hazards, x, y) {
  let dps = 0;
  if (!hazards) return 0;
  for (const hz of hazards) {
    if (hz.type !== 'region') continue;
    const def = REGION_HAZARDS[hz.id];
    if (def && def.dps && inside(hz, x, y)) dps = Math.max(dps, def.dps);
  }
  return dps;
}

// How much of a pull — and of a current — a body feels. The host's movement
// step had this inline; a guest's prediction needs the same number.
export function pullResistFor(traitKey, grit) {
  if (traitKey === 'immovable' || traitKey === 'crystal_infusion') return 0;
  return CONFIG.ARMOR_K / (CONFIG.ARMOR_K + Math.max(0, grit || 0));
}

// Load assertion: every hazard a region names exists here, and declares a
// movement effect (spdMult, drift, ice) or damage a player routes around (dps).
export function assertHazards(regions) {
  const problems = [];
  for (const r of regions) {
    const d = REGION_HAZARDS[r.hazard];
    if (!d) { problems.push(`${r.id}: hazard ${JSON.stringify(r.hazard)} is not in REGION_HAZARDS`); continue; }
    if (!(d.spdMult > 0 && d.spdMult < 1) && !(d.drift > 0) && !d.ice && !(d.dps > 0)) problems.push(`${r.hazard}: declares no effect`);
    if (!d.front && !(d.count && d.r)) problems.push(`${r.hazard}: a patch hazard needs count and r`);
  }
  if (problems.length) throw new Error('REGION HAZARDS:\n  ' + problems.join('\n  '));
}
