// Sprite id tables for everything that has no def of its own to hang a
// `spriteId` on — projectiles, props, structures, world FX and UI chrome.
//
// Characters, enemies, bosses, weapons and items carry `spriteId` on their own
// definition objects (stamped at the bottom of each content module, so the
// field exists the instant the table does). This file covers the rest, and is
// the single place where a visual that used to be hard-coded inline in
// render.js now has a name.
//
// Canonical authored sizes (one number per category, so an artist never has to
// ask): players and enemies 48x48, bosses 96x96, projectiles / pickups / FX
// 16x16, item icons 24x24, props and structures 64x64. UI chrome is 32x32.
//
// Nothing here is simulation state. These are strings a renderer looks up.

import { WEAPONS } from './weapons.js';
import { ENEMIES } from './enemies.js';
import { BOSSES } from './bosses.js';

export const SPRITE_SIZE = {
  char: [48, 48],
  enemy: [48, 48],
  boss: [96, 96],
  proj: [16, 16],
  fx: [16, 16],
  item: [24, 24],
  prop: [64, 64],
  ui: [32, 32],
};

// ---------------- projectiles ----------------
//
// Projectiles are the one entity whose type is NOT on the wire. A snapshot
// carries a projectile's position, velocity, radius, colour and allegiance and
// nothing else, and adding a type byte would be a netcode change this patch is
// forbidden to make. So the sprite is resolved from exactly the fields the
// renderer already uses to tell projectiles apart today — colour and size
// class — which means the host and every client resolve the same sprite from
// the same bytes, and the sprite layer differentiates precisely as much as the
// primitives it replaces. No more, no less.
//
// The size classes are the three radii game.js spawns friendly projectiles at.
// A test asserts these still match the engine.
export const PROJ_R_SUMMON = 4;   // structure shots  (game.js _fireSummons)
export const PROJ_R_SHOT = 5;     // single / spread  (game.js _firePlayer)
export const PROJ_R_LOB = 7;      // lobbed AoE       (game.js _firePlayer)

export function projSizeClass(radius) {
  if (radius >= PROJ_R_LOB) return 'lob';
  if (radius <= PROJ_R_SUMMON) return 'summon';
  return 'shot';
}

const projKey = (color, cls) => `${String(color).toLowerCase()}|${cls}`;

export const PROJ_FALLBACK_FRIENDLY = 'proj.bolt';
export const PROJ_FALLBACK_HOSTILE = 'proj.enemy_shot';

// friendly: built from the weapon table, so it can never drift from it.
const FRIENDLY_PROJ = {};
for (const w of WEAPONS) {
  if (!w.projSpriteId) continue;
  const cls = w.summon ? 'summon' : (w.aoe ? 'lob' : 'shot');
  FRIENDLY_PROJ[projKey(w.color, cls)] = w.projSpriteId;
}

// hostile: enemies and bosses fire in their own body colour, so a hostile
// projectile carries its shooter's colour and nothing else. Naming these after
// the shooter would be a lie — the Lobber and the Choir of Eyes are the SAME
// violet at the SAME radius, and they share arenas on floor 2 — so hostile
// projectile art is named for what it actually is: a colour. Four bolts cover
// every shot an enemy or a boss can put in the air.
export const HOSTILE_PROJ_BY_COLOR = {
  '#a86ae8': 'proj.hostile_violet',   // Lobber spit; Choir ring + volley (identical on the wire)
  '#ffd45e': 'proj.hostile_gold',     // Vault Regent burst
  '#ff7ad9': 'proj.hostile_rose',     // Choir phase-two spiral (enemies.js hand-picks this one)
  '#ff5d6c': 'proj.enemy_shot',       // game.js spawnEnemyProj default
};
const HOSTILE_PROJ = HOSTILE_PROJ_BY_COLOR;

// Which shooters land on which hostile bolt — the inverse map, so a test can
// assert the sharing above is a decision and not an accident.
export const HOSTILE_PROJ_SHOOTERS = {
  ...Object.fromEntries(ENEMIES.filter(e => e.proj || e.mortar)
    .map(e => [e.id, HOSTILE_PROJ[String(e.color).toLowerCase()] || PROJ_FALLBACK_HOSTILE])),
  ...Object.fromEntries(BOSSES.filter(b => b.ring || b.volley || b.burst)
    .map(b => [b.id, HOSTILE_PROJ[String(b.color).toLowerCase()] || PROJ_FALLBACK_HOSTILE])),
};

export function projSpriteFor(color, friendly, radius) {
  if (!friendly) return HOSTILE_PROJ[String(color).toLowerCase()] || PROJ_FALLBACK_HOSTILE;
  return FRIENDLY_PROJ[projKey(color, projSizeClass(radius))] || PROJ_FALLBACK_FRIENDLY;
}

// Everything the two maps can ever return — the manifest generator needs the
// full inventory, not just the ids a given frame happened to ask for.
export function allProjSpriteIds() {
  return [...new Set([
    ...Object.values(FRIENDLY_PROJ), ...Object.values(HOSTILE_PROJ),
    PROJ_FALLBACK_FRIENDLY, PROJ_FALLBACK_HOSTILE,
  ])].sort();
}

// ---------------- props and structures ----------------
//
// World furniture: the things render.js used to draw as an inline circle or
// rounded rect with a colour literal beside it. Anchored bottom where the art
// should sit ON the floor rather than be centred on its own footprint.
export const PROP = {
  hatchExtract: 'prop.hatch_extract',
  hatchDescend: 'prop.hatch_descend',
  altar: 'prop.altar',
  relic: 'prop.relic',
  drill: 'prop.drill',
  nest: 'prop.nest',
  nestWalled: 'prop.nest_walled',
  gateOpen: 'prop.gate_open',
  gateSealed: 'prop.gate_sealed',
  breachDoor: 'prop.breach_door',
  barricade: 'prop.barricade',
  pillar: 'prop.pillar',
  wallTile: 'prop.wall_tile',
  turret: 'prop.turret',
  drone: 'prop.drone',
  ram: 'prop.ram',
  lava: 'prop.lava',
  spikesArmed: 'prop.spikes_armed',
  spikesIdle: 'prop.spikes_idle',
  coralNode: 'prop.coral_node',
  coralWall: 'prop.coral_wall',
  singularity: 'prop.singularity',
  spirit: 'prop.spirit',
  decoy: 'prop.decoy',
};

// Anchored to the floor rather than centred. Everything else is centre-anchored.
export const PROP_BOTTOM_ANCHORED = new Set([
  PROP.altar, PROP.drill, PROP.nest, PROP.turret, PROP.pillar,
]);

// The Ward Pylon lives in the enemy pool (it has HP and dies), so it takes an
// enemy id even though it reads as a structure. Its def is inline in game.js,
// which this patch does not touch — hence the constant here.
export const PYLON_SPRITE = 'enemy.ward_pylon';

// ---------------- world FX and pickups ----------------
export const FX = {
  material: 'fx.material',
  spark: 'fx.spark',
  smoke: 'fx.smoke',
  blood: 'fx.blood',
  boom: 'fx.boom',
  block: 'fx.block',
  heal: 'fx.heal',
  telegraphMark: 'fx.telegraph_mark',
  bonedust: 'fx.bonedust',
};

// ---------------- UI chrome ----------------
export const UI = {
  joystickBase: 'ui.joystick_base',
  joystickNub: 'ui.joystick_nub',
  edgeArrow: 'ui.edge_arrow',
  heart: 'ui.heart',
  shield: 'ui.shield',
  material: 'ui.material',
  cursor: 'ui.cursor',
  lock: 'ui.lock',
};
