// The Gauntlet's stages — arena templates and per-floor siege definitions.
// Pure config objects (plus small deterministic builders) so a later theming
// patch can attach skins per floor without touching the simulation.
//
// Coordinates: world units; obstacles are axis-aligned rects {x,y,w,h}
// (top-left origin). Hazards reuse the existing vocabulary: spike strips
// (periodic bands) and lava pools. Every builder takes a seeded rng so
// layouts are deterministic per run.

import { subRng } from './rng.js';

// ---------------- the five arena shapes ----------------
// Each is a spotlight for a different build family; every floor's fight
// nodes draw from all five.

export const ARENA_TEMPLATES = {
  long_hall: {
    name: 'Long Hall', // sniper country
    w: 3200, h: 1100,
    obstacles(rng) {
      // ribs jutting from the long walls — lanes without full cover
      const out = [];
      for (let i = 0; i < 4; i++) {
        const x = 560 + i * 560 + rng.range(-60, 60);
        const len = rng.range(260, 380);
        if (i % 2 === 0) out.push({ x, y: 36, w: 70, h: len });
        else out.push({ x, y: 1100 - 36 - len, w: 70, h: len });
      }
      return out;
    },
    hazards() { return []; },
  },
  pillared_field: {
    name: 'Pillared Field', // turret geometry
    w: 2800, h: 1800,
    obstacles(rng) {
      const out = [];
      for (let gx = 0; gx < 5; gx++) {
        for (let gy = 0; gy < 3; gy++) {
          if (gx === 2 && gy === 1) continue; // clear center for the drop-in
          const s = rng.range(90, 140);
          out.push({
            x: 330 + gx * 520 + rng.range(-70, 70) - s / 2,
            y: 330 + gy * 570 + rng.range(-70, 70) - s / 2,
            w: s, h: s,
          });
        }
      }
      return out;
    },
    hazards() { return []; },
  },
  cramped_crypt: {
    name: 'Cramped Crypt', // choke lanes; melee and thorns
    w: 2400, h: 1600,
    obstacles(rng) {
      // two vertical dividers with door gaps + a broken horizontal spine
      const out = [];
      for (const fx of [0.34, 0.66]) {
        const x = 2400 * fx - 30;
        const gapY = rng.range(500, 1000);
        out.push({ x, y: 36, w: 60, h: gapY - 130 - 36 });
        out.push({ x, y: gapY + 130, w: 60, h: 1600 - 36 - (gapY + 130) });
      }
      const gapX = rng.range(700, 1500);
      out.push({ x: 260, y: 770, w: gapX - 150 - 260, h: 60 });
      out.push({ x: gapX + 150, y: 770, w: 2400 - 260 - (gapX + 150), h: 60 });
      return out;
    },
    hazards() { return []; },
  },
  open_expanse: {
    name: 'Open Expanse', // pure kiting space
    w: 3000, h: 2000,
    obstacles() { return []; },
    hazards() { return []; },
  },
  broken_ground: {
    name: 'Broken Ground', // hazard pockets
    w: 2600, h: 1700,
    obstacles(rng) {
      const out = [];
      for (let i = 0; i < 3; i++) {
        const s = rng.range(100, 150);
        out.push({ x: rng.range(500, 2000), y: rng.range(400, 1200), w: s, h: s });
      }
      return out;
    },
    hazards(rng) {
      const out = [];
      // two spike strips (banded rects on the old spike cycle)
      for (let i = 0; i < 2; i++) {
        out.push({
          type: 'spikes', x: rng.range(400, 1600), y: rng.range(300, 1250),
          w: rng.range(420, 700), h: 52,
          period: 4, safe: 2, warn: 0.8, offset: i * 1.3, dmg: 8, state: 0,
        });
      }
      // lava pockets clear of the center drop-in
      for (let i = 0; i < 4; i++) {
        for (let tries = 0; tries < 12; tries++) {
          const x = rng.range(360, 2240), y = rng.range(320, 1380), r = rng.range(60, 95);
          if (Math.hypot(x - 1300, y - 850) < 420) continue;
          out.push({ type: 'lava', x, y, r, dps: 7, acc: 0 });
          break;
        }
      }
      return out;
    },
  },
};
export const TEMPLATE_KEYS = Object.keys(ARENA_TEMPLATES);

// ---------------- the wave budget curve ----------------
// Fights are continuous escalating sieges in miniature: a spawn-rate ramp for
// dur seconds, then silence; the fight ends when the field is cleared.
// rate(t) = r0 → r1 (enemies/sec, pre-co-op-scaling), linear.

export function waveConfig(floorNum, depth, kind) {
  const elite = kind === 'elite';
  const siege = kind === 'siege';
  const dur = siege ? Infinity : Math.round(60 + depth * 5 + floorNum * 5); // 60–90s
  const r0 = 0.7 + 0.22 * floorNum + (elite ? 0.2 : 0);
  const r1 = 1.7 + 0.45 * floorNum + 0.16 * depth + (elite ? 0.5 : 0);
  return {
    t: 0, acc: 0, dur, r0, r1,
    rampT: siege ? 150 : dur,          // sieges plateau at 150s and hold
    eliteEvery: elite ? 16 : (siege ? 22 : 0), // periodic elite injections
    eliteT: 8,
    done: false,
  };
}

// ---------------- per-floor siege arenas (bespoke) ----------------
// Each mutation: { at: seconds, kind, ...params, text } — telegraphed with
// the existing danger-zone language, and every mutation revives downed
// players at 25% (the vault shifts and the fallen stir).
// Obstacles may carry `group: n` — collapse mutations remove that group.
// The floor boss enters bossDelay seconds after the final mutation.

export const SIEGES = [
  { // Floor 1 — The Underhall: a walled yard that breaks open
    name: 'The Underhall',
    w: 2800, h: 1800,
    obstacles: [
      // inner keep walls (group 1 collapses)
      { x: 900, y: 560, w: 60, h: 300, group: 1 },
      { x: 900, y: 940, w: 60, h: 300, group: 1 },
      { x: 1840, y: 560, w: 60, h: 300, group: 1 },
      { x: 1840, y: 940, w: 60, h: 300, group: 1 },
      { x: 960, y: 560, w: 300, h: 60, group: 1 },
      { x: 1540, y: 560, w: 300, h: 60, group: 1 },
      { x: 960, y: 1180, w: 300, h: 60, group: 1 },
      { x: 1540, y: 1180, w: 300, h: 60, group: 1 },
    ],
    hazards: [],
    mutations: [
      { at: 50, kind: 'collapse', group: 1, text: 'THE KEEP WALLS COLLAPSE' },
      { at: 105, kind: 'pylon', x: 1400, y: 500, text: 'A WARD PYLON RISES — DESTROY IT' },
    ],
    bossDelay: 14, addRate: 0.35,
  },
  { // Floor 2 — The Drowning Cross: a cross of cover, then the flood
    name: 'The Drowning Cross',
    w: 3000, h: 1900,
    obstacles: [
      { x: 1440, y: 340, w: 120, h: 460, group: 1 },
      { x: 1440, y: 1100, w: 120, h: 460, group: 1 },
      { x: 620, y: 890, w: 500, h: 120, group: 2 },
      { x: 1880, y: 890, w: 500, h: 120, group: 2 },
    ],
    hazards: [],
    mutations: [
      { at: 48, kind: 'collapse', group: 1, text: 'THE CROSS SHATTERS' },
      { at: 100, kind: 'hazard_field', from: { x: 300, y: 950 }, to: { x: 2700, y: 950 }, r: 300, dps: 9, travel: 45, text: 'MOLTEN FLOOD — IT MOVES' },
      { at: 155, kind: 'collapse', group: 2, text: 'THE LAST COVER FALLS' },
    ],
    bossDelay: 12, addRate: 0.35,
  },
  { // Floor 3 — The Choir Pit: hold the circle, then the walls go
    name: 'The Choir Pit',
    w: 2600, h: 2000,
    obstacles: [
      { x: 500, y: 500, w: 320, h: 70, group: 1 },
      { x: 1780, y: 500, w: 320, h: 70, group: 1 },
      { x: 500, y: 1430, w: 320, h: 70, group: 1 },
      { x: 1780, y: 1430, w: 320, h: 70, group: 1 },
      { x: 1230, y: 830, w: 140, h: 340, group: 2 },
    ],
    hazards: [],
    mutations: [
      { at: 45, kind: 'circle', x: 1300, y: 1000, r: 240, text: 'HOLD THE SIGIL — IT CHOKES THE SPAWNING' },
      { at: 100, kind: 'collapse', group: 2, text: 'THE ALTAR CRUMBLES' },
      { at: 150, kind: 'pylon', x: 1300, y: 420, text: 'A WARD PYLON RISES — DESTROY IT' },
    ],
    bossDelay: 12, addRate: 0.35,
  },
  { // Floor 4 — The Regent's Court: everything, in sequence
    name: "The Regent's Court",
    w: 3200, h: 2000,
    obstacles: [
      { x: 760, y: 620, w: 70, h: 760, group: 1 },
      { x: 2370, y: 620, w: 70, h: 760, group: 1 },
      { x: 1200, y: 420, w: 800, h: 70, group: 2 },
      { x: 1200, y: 1510, w: 800, h: 70, group: 2 },
    ],
    hazards: [
      { type: 'spikes', x: 400, y: 960, w: 600, h: 52, period: 4, safe: 2, warn: 0.8, offset: 0, dmg: 10, state: 0 },
      { type: 'spikes', x: 2200, y: 960, w: 600, h: 52, period: 4, safe: 2, warn: 0.8, offset: 1.6, dmg: 10, state: 0 },
    ],
    mutations: [
      { at: 45, kind: 'collapse', group: 1, text: 'THE COURT WALLS FALL' },
      { at: 95, kind: 'hazard_field', from: { x: 1600, y: 200 }, to: { x: 1600, y: 1800 }, r: 320, dps: 11, travel: 50, text: 'THE REGENT’S FIRE SWEEPS THE COURT' },
      { at: 150, kind: 'collapse', group: 2, text: 'NOTHING LEFT TO HIDE BEHIND' },
    ],
    bossDelay: 12, addRate: 0.35,
  },
];

// Build the runtime obstacle/hazard lists for a node's arena.
export function buildArena(seed, floorNum, node) {
  if (node.kind === 'siege') {
    const s = SIEGES[floorNum - 1];
    return {
      w: s.w, h: s.h, name: s.name,
      obstacles: s.obstacles.map(o => ({ ...o })),
      hazards: s.hazards.map(h => ({ ...h })),
      mutations: s.mutations, bossDelay: s.bossDelay, addRate: s.addRate,
    };
  }
  const t = ARENA_TEMPLATES[node.template];
  const rng = subRng(seed, 'arena', floorNum, node.id);
  return {
    w: t.w, h: t.h, name: t.name,
    obstacles: t.obstacles(rng),
    hazards: t.hazards(rng),
    mutations: null,
  };
}
