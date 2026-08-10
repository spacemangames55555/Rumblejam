// The Gauntlet's stages — arena templates and per-floor siege definitions.
// Pure config objects (plus small deterministic builders) so a later theming
// patch can attach skins per floor without touching the simulation.
//
// Coordinates: world units; obstacles are axis-aligned rects {x,y,w,h}
// (top-left origin). Hazards reuse the existing vocabulary: spike strips
// (periodic bands) and lava pools. Every builder takes a seeded rng so
// layouts are deterministic per run.

import { subRng } from './rng.js';
import { CONFIG } from './config.js';
import { biomeFor } from './biomes.js';

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

// ---------------- pressure profiles (patch 9) ----------------
// A profile is the fight's recipe: spawn geometry, enemy-role mix, and lever
// intensities. Levers: ring (spawns assemble around the players vs streaming
// from arena-edge fronts), artillery (chance a spawn is a mortar Lobber),
// puddle (chance chaff leaves an acid puddle on death), flankers (share of
// spawns replaced by Gyres/Lancerfish). No profile maxes every lever;
// Bastion is the sanctioned camping fight and rolls ~1 in 4 combat nodes.
export const PROFILES = {
  // Bastion streams from ONE front at a gentler rate: a stream is a queue,
  // which is exactly what a hold-your-ground build's auto-aim can handle.
  // Bombers are banned from its mix — a telegraphed blast at your feet is
  // the definitional stillness-punisher, and this fight sanctions stillness.
  // Bastion's stream is MELEE-ONLY: everything walks into your kill zone,
  // which is the whole hold-your-ground fantasy. Banned: bombers (telegraphed
  // blasts at your feet), lobbers/deadeyes (outrange a standing kit and plink
  // it from beyond answer), nests (force you to leave your spot), and the
  // flanker pair. Camping pays in safety, not money — fewer levers, less loot.
  bastion:   { ring: false, artillery: 0,    puddle: 0,    flankers: 0,    rateMult: 0.65,
    ban: ['fusehead', 'lobber', 'deadeye', 'wombden', 'lancerfish', 'gyre'] },
  artillery: { ring: true,  artillery: 0.28, puddle: 0.05, flankers: 0.08, rateMult: 1 },
  flanker:   { ring: true,  artillery: 0.05, puddle: 0.05, flankers: 0.32, rateMult: 1 },
  puddle:    { ring: true,  artillery: 0.05, puddle: 0.35, flankers: 0.08, rateMult: 1 },
  swarm:     { ring: true,  artillery: 0.04, puddle: 0.08, flankers: 0.08, rateMult: 1.18 },
  mixed:     { ring: true,  artillery: 0.14, puddle: 0.14, flankers: 0.16, rateMult: 1 },
  // the climax never lets you sit down — but it's already a boss gauntlet
  // with mutations, so its levers sit below the dedicated profiles'
  siege:     { ring: true,  artillery: 0.10, puddle: 0.08, flankers: 0.12, rateMult: 1 },
};
export const COMBAT_PROFILE_KEYS = ['artillery', 'flanker', 'puddle', 'swarm', 'mixed'];

// ---------------- the wave budget curve ----------------
// Fights are continuous escalating sieges in miniature: a spawn-rate ramp for
// dur seconds, then silence; the fight ends when the field is cleared.
// rate(t) = r0 → r1 (enemies/sec, pre-co-op-scaling), linear.

// THE ONBOARDING RAMP. Region 1's first maps carry a fraction of the normal
// spawn rate, indexed by node column — 50% on map 1, 75% on map 2, full from
// map 3.
//
// WHY A RAMP AND NOT A ONE-MAP DISCOUNT. Measured on the live build, a character
// finishes map 1 at LEVEL 6 with two slots open and five unspent points, having
// entered it at level 1 with one slot and one skill. So map 1 is the only map in
// the game played at a single slot, and the cliff a flat discount would create
// lands exactly where the player has the slots but has not yet spent the points
// or learned what any of them do. The half-step at map 2 is for the build being
// ASSEMBLED rather than for the slots being open.
//
// Depth is `node.col`, which `waveConfig` already receives — this is arithmetic
// inside an existing parameter, not a new channel.
export const ONBOARDING_RATE = [0.5, 0.75, 1];
export function onboardingMult(floorNum, depth) {
  if (floorNum !== 1) return 1;
  return ONBOARDING_RATE[Math.min(depth, ONBOARDING_RATE.length - 1)];
}

// IS THIS THE TUTORIAL ROOM? Lives here, beside the rate it governs, because
// two very different things need the same answer: the sim, to pick the reduced
// archetype table, and the tuning gates, to stay OUT of a room that is
// deliberately unrepresentative.
//
// difficulty_gate is the reason this is exported rather than private to the
// sim. It fights "the first non-shop node" and measures how much enemy each
// setting puts in front of the player — and that node is floor 1 column 0, the
// one room in the game now built to field half the enemies and three of the
// archetypes. It did not fail because difficulty stopped working; it failed
// because its sample moved into the tutorial. A gate that cannot ask whether it
// is standing in the exception will silently measure the exception, and this is
// the second caller that makes the question a function instead of a comment.
export function isOnboardingNode(floorNum, node) {
  return floorNum === 1 && !!node && node.col === 0 && node.kind !== 'siege';
}

export function waveConfig(floorNum, depth, kind) {
  const elite = kind === 'elite';
  const siege = kind === 'siege';
  const dur = siege ? Infinity : Math.round(60 + depth * 5 + floorNum * 5); // 60–90s
  // floor 1 is the baseline a one-weapon starting kit can chew through
  // (~0.6 kills/sec organic); later floors outpace it and force build growth
  // AN ELITE NODE NO LONGER BUMPS ITS SPAWN RATE (D-24). It used to add +0.2
  // and +0.5 here, which made an elite node field MORE enemies at the same
  // health — the opposite of §2.4, and the exact shape nodebehaviour.js's own
  // validator rejects ("same count with more HP is a slog, not an elite
  // fight"). §2.4 is now the single definition of what an elite node is, and
  // it arrives through nodeModifiers(); leaving this bump in place would have
  // multiplied against it rather than agreeing with it.
  const onb = onboardingMult(floorNum, depth);
  const r0 = (0.5 + 0.25 * (floorNum - 1)) * onb;
  const r1 = (1.2 + 0.55 * (floorNum - 1) + 0.18 * depth) * onb;
  return {
    t: 0, acc: 0, dur, r0, r1,
    rampT: siege ? 150 : dur,          // sieges plateau at 150s and hold
    // Periodic elite injections belong to SIEGES only, for the same reason: an
    // elite node's identity is fewer-and-fatter, and sprinkling extra
    // ELITE_HP_MULT champions on top of that is a third definition nobody
    // specified.
    eliteEvery: siege ? 22 : 0,
    eliteT: 8,
    done: false,
  };
}

// How many enemies a STANDARD horde arena spends over its whole life, for a
// given party size and floor. The wave is a linear ramp r0→r1 over dur, so
// the integral is the mean rate × duration × the party/patch multipliers.
// Elite Arena prices its roster against this.
export function hordeTotalSpawns(floorNum, depth, coopSpawn) {
  const w = waveConfig(floorNum, depth, 'combat');
  return ((w.r0 + w.r1) / 2) * w.dur * coopSpawn * CONFIG.spawnBudgetMult;
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
// Parties of ARENA_CROWD_AT+ fight in the same templates scaled up
// ~25% in bounds — 8 spread players need somewhere to spread to.
export function buildArena(seed, floorNum, node, playerCount = 1) {
  const crowd = playerCount >= CONFIG.ARENA_CROWD_AT ? CONFIG.ARENA_CROWD_SCALE : 1;
  // Objective levels can reshape the room (Breach is a corridor). That scale
  // has to reach the obstacles and hazards too, NOT just the bounds — scaling
  // only the bounds leaves template architecture hanging outside the room,
  // and _pushOut then shoves players through the wall to escape it.
  const shape = objectiveShape(node.kind);
  const kx = crowd * shape.x, ky = crowd * shape.y;
  // The floor's theme. Cosmetic: the renderer is the only consumer, and a
  // floor with no biome renders exactly as it did before this existed.
  const b = biomeFor(floorNum);
  const biomeId = b ? b.id : null;
  if (node.kind === 'siege') {
    const s = SIEGES[floorNum - 1];
    return {
      w: Math.round(s.w * kx), h: Math.round(s.h * ky), name: s.name,
      obstacles: s.obstacles.map(o => scaleRect(o, kx, ky)),
      hazards: s.hazards.map(h => scaleHazard(h, kx, ky)),
      mutations: (kx === 1 && ky === 1) ? s.mutations : s.mutations.map(m => scaleMutation(m, kx, ky)),
      bossDelay: s.bossDelay, addRate: s.addRate,
      biome: biomeId,
    };
  }
  const t = ARENA_TEMPLATES[node.template];
  const rng = subRng(seed, 'arena', floorNum, node.id);
  return {
    w: Math.round(t.w * kx), h: Math.round(t.h * ky), name: t.name,
    obstacles: t.obstacles(rng).map(o => scaleRect(o, kx, ky)),
    hazards: t.hazards(rng).map(h => scaleHazard(h, kx, ky)),
    mutations: null,
    biome: biomeId,
  };
}

// Per-axis room reshaping by objective. Breach wants a long corridor;
// Storm and Zone Control want room to run.
export function objectiveShape(kind) {
  if (kind === 'breach') return { x: 1.7, y: 0.62 };
  if (kind === 'storm' || kind === 'zone') return { x: 1.1, y: 1.1 };
  return { x: 1, y: 1 };
}

// geometric scaling: positions and extents alike, per axis, so a reshaped
// room keeps its architecture inside its own bounds
function scaleRect(o, kx, ky = kx) {
  if (kx === 1 && ky === 1) return { ...o };
  return { ...o, x: Math.round(o.x * kx), y: Math.round(o.y * ky), w: Math.round(o.w * kx), h: Math.round(o.h * ky) };
}
function scaleHazard(h, kx, ky = kx) {
  if (kx === 1 && ky === 1) return { ...h };
  const out = { ...h, x: Math.round(h.x * kx), y: Math.round(h.y * ky) };
  if (h.w !== undefined) { out.w = Math.round(h.w * kx); out.h = Math.round(h.h * ky); }
  if (h.r !== undefined) out.r = Math.round(h.r * Math.min(kx, ky)); // circles stay circles
  return out;
}
function scaleMutation(m, kx, ky = kx) {
  const out = { ...m };
  if (m.x !== undefined) { out.x = Math.round(m.x * kx); out.y = Math.round(m.y * ky); }
  if (m.r !== undefined) out.r = Math.round(m.r * Math.min(kx, ky));
  if (m.from) out.from = { x: Math.round(m.from.x * kx), y: Math.round(m.from.y * ky) };
  if (m.to) out.to = { x: Math.round(m.to.x * kx), y: Math.round(m.to.y * ky) };
  return out;
}
