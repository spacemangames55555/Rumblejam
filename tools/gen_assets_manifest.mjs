// Regenerate assets/assets.json — the sprite manifest, which doubles as the
// art inventory: every id the game will ever ask for, pointing at a file that
// may or may not exist yet. Files land one at a time; the game runs the whole
// way through with none of them.
//
//   node tools/gen_assets_manifest.mjs          # write assets/assets.json
//   node tools/gen_assets_manifest.mjs --check  # fail if it is out of date
//
// Generated rather than hand-written for the same reason the compendium is:
// the catalogs move, and a hand-typed inventory would be wrong within a patch.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ALL_CHARS } from '../js/content/characters.js';
// ALL_ENEMY_DEFS, not ENEMIES: the base twelve PLUS every region population.
// This import was `ENEMIES` and that is why fourteen region units — twelve
// enemies and two bosses across the two built regions — were not in the
// inventory this file exists to be. Nothing downstream could ask for art that
// the manifest does not list.
import { ALL_ENEMY_DEFS } from '../js/content/enemies.js';
import { ALL_BOSS_DEFS } from '../js/content/bosses.js';
import { WEAPONS } from '../js/content/weapons.js';
import { ITEMS } from '../js/content/items.js';
import {
  SPRITE_SIZE, PROP, PROP_BOTTOM_ANCHORED, FX, UI, PYLON_SPRITE, BEAST_SPRITE, allProjSpriteIds,
  UNIT_DIRECTIONS, DIRECTIONAL_NAMESPACES,
} from '../js/content/sprites.js';
import { BIOMES, tileSpriteIds, tileFile } from '../js/biomes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'assets.json');
// Per-sprite deviations from the category defaults — a unit that ships with 4
// animation frames, an enemy dropped to 4 directions. Written by
// tools/process_sprite.mjs as art lands, and merged here, because assets.json
// itself is generated and would lose anything hand-edited into it.
const OVERRIDES = join(ROOT, 'assets', 'sprite-overrides.json');
const VERSION = 1;
const BASE_PATH = 'assets/sprites/';   // relative, no leading slash — GitHub Pages serves from /Rumblejam/

const sprites = {};

// `frames` and `fps` are omitted, which means one static frame at 8fps — bump
// them in this generator when a category actually ships animated, so a plain
// PNG keeps working until then.
//
// Units (char/enemy/boss) carry `directions`, which makes them a GRID: the
// file must be exactly `w * frames` wide and `h * directions` tall, rows in
// the order E SE S SW W NW N NE. The loader rejects a grid that is not, rather
// than drawing a plausible-looking wrong facing.
function add(id, extra = {}) {
  const ns = id.slice(0, id.indexOf('.'));
  const [w, h] = SPRITE_SIZE[ns];
  if (sprites[id]) throw new Error(`duplicate sprite id: ${id}`);
  const dir = DIRECTIONAL_NAMESPACES.has(ns) ? { directions: UNIT_DIRECTIONS } : {};
  sprites[id] = { file: `${ns}/${id.slice(ns.length + 1)}.png`, w, h, ...dir, ...extra };
}

// ---- characters: both rosters, one sheet each ----
for (const c of ALL_CHARS) add(c.spriteId);

// ---- enemies (base roster + every region), plus the pylon whose def is
//      inline in the engine ----
for (const e of ALL_ENEMY_DEFS) add(e.spriteId);
add(PYLON_SPRITE);

// ---- bosses: the four floor bosses and one two-phase boss per region ----
for (const b of ALL_BOSS_DEFS) add(b.spriteId);

// ---- projectiles: every id projSpriteFor() can return ----
for (const id of allProjSpriteIds()) add(id);

// ---- icons: the item catalog and the weapon catalog share the namespace ----
for (const w of WEAPONS) add(w.spriteId);
for (const it of ITEMS) add(it.spriteId);

// ---- props and structures ----
for (const id of Object.values(PROP)) {
  add(id, PROP_BOTTOM_ANCHORED.has(id) ? { anchor: 'bottom' } : {});
}

// ---- combat pets: eight facings, like any other unit ----
for (const id of Object.values(BEAST_SPRITE)) add(id);

// ---- world FX and UI chrome ----
for (const id of Object.values(FX)) add(id);
for (const id of Object.values(UI)) add(id);

// ---- floor tiles: one entry per biome variant ----
// These are the one category that does NOT live under basePath — they sit at
// assets/tiles/<biome>/ — so they carry a rooted `file` the loader takes as
// written. `strict` makes the loader check the size exactly and reject a blank
// PNG: a tile is drawn edge to edge across the whole room, so a wrong one is a
// seam on every cell rather than one odd-looking sprite.
for (const biome of Object.values(BIOMES)) {
  tileSpriteIds(biome).forEach((id, i) => add(id, { file: tileFile(biome, i), strict: true }));
}

// ---- per-sprite overrides, applied last ----
// `w`/`h` are overridable because hand-supplied art does not always arrive at
// the category's canonical canvas, and the manifest must describe what is
// actually on disk or the loader refuses the file.
//
// `scale` is the cosmetic render-size multiplier (js/assets.js). It is only
// ever an override, never a category default, so a sprite that does not name
// it here is drawn at exactly 1 — which is also the only way the fast path in
// drawSprite stays intact for the other 297 ids.
//
// `content` is the measured opaque bounds of the tallest cell, written by
// tools/process_sprite.mjs. The loader divides its height out so `scale` means
// the same thing on every sheet regardless of how the art was padded.
const OVERRIDABLE = new Set(['frames', 'fps', 'directions', 'anchor', 'w', 'h', 'scale', 'content']);
let overrides = {};
if (existsSync(OVERRIDES)) {
  overrides = JSON.parse(readFileSync(OVERRIDES, 'utf8'));
  for (const [id, patch] of Object.entries(overrides)) {
    if (!sprites[id]) throw new Error(`sprite-overrides.json names "${id}", which is not a sprite id`);
    for (const [k, v] of Object.entries(patch)) {
      if (!OVERRIDABLE.has(k)) throw new Error(`sprite-overrides.json ${id}: "${k}" is not overridable (${[...OVERRIDABLE].join(', ')})`);
      sprites[id][k] = v;
    }
  }
}

const manifest = {
  version: VERSION,
  basePath: BASE_PATH,
  // Sorted so a regeneration produces a stable diff rather than a reshuffle.
  sprites: Object.fromEntries(Object.keys(sprites).sort().map(k => [k, sprites[k]])),
};

const json = JSON.stringify(manifest, null, 2) + '\n';

const counts = {};
for (const id of Object.keys(manifest.sprites)) {
  const ns = id.slice(0, id.indexOf('.'));
  counts[ns] = (counts[ns] || 0) + 1;
}

if (process.argv.includes('--check')) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (cur !== json) {
    console.error('assets/assets.json is stale — run: node tools/gen_assets_manifest.mjs');
    process.exit(1);
  }
  console.log(`assets/assets.json up to date — ${Object.keys(manifest.sprites).length} ids`);
} else {
  writeFileSync(OUT, json);
  console.log(`wrote ${OUT} — ${Object.keys(manifest.sprites).length} sprite ids`);
  for (const ns of Object.keys(counts).sort()) console.log(`  ${ns.padEnd(6)} ${counts[ns]}`);
}
