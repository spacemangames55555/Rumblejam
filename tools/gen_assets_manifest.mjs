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
import { ENEMIES } from '../js/content/enemies.js';
import { BOSSES } from '../js/content/bosses.js';
import { WEAPONS } from '../js/content/weapons.js';
import { ITEMS } from '../js/content/items.js';
import {
  SPRITE_SIZE, PROP, PROP_BOTTOM_ANCHORED, FX, UI, PYLON_SPRITE, allProjSpriteIds,
} from '../js/content/sprites.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'assets.json');
const VERSION = 1;
const BASE_PATH = 'assets/sprites/';   // relative, no leading slash — GitHub Pages serves from /Rumblejam/

const sprites = {};

// Every entry is a single horizontal strip. `frames` and `fps` are omitted,
// which means one static frame at 8fps — bump them in this generator when a
// category actually ships animated, so a plain PNG keeps working until then.
function add(id, extra = {}) {
  const ns = id.slice(0, id.indexOf('.'));
  const [w, h] = SPRITE_SIZE[ns];
  if (sprites[id]) throw new Error(`duplicate sprite id: ${id}`);
  sprites[id] = { file: `${ns}/${id.slice(ns.length + 1)}.png`, w, h, ...extra };
}

// ---- characters: both rosters, one sheet each ----
for (const c of ALL_CHARS) add(c.spriteId);

// ---- enemies, plus the pylon whose def is inline in the engine ----
for (const e of ENEMIES) add(e.spriteId);
add(PYLON_SPRITE);

// ---- bosses (96x96) ----
for (const b of BOSSES) add(b.spriteId);

// ---- projectiles: every id projSpriteFor() can return ----
for (const id of allProjSpriteIds()) add(id);

// ---- icons: the item catalog and the weapon catalog share the namespace ----
for (const w of WEAPONS) add(w.spriteId);
for (const it of ITEMS) add(it.spriteId);

// ---- props and structures ----
for (const id of Object.values(PROP)) {
  add(id, PROP_BOTTOM_ANCHORED.has(id) ? { anchor: 'bottom' } : {});
}

// ---- world FX and UI chrome ----
for (const id of Object.values(FX)) add(id);
for (const id of Object.values(UI)) add(id);

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
