// BIOMES — per-floor ground theming. Cosmetic only.
//
// A biome is a tile set and the numbers needed to check that the tile set is
// what it claims to be. It does not touch the simulation: no movement
// modifiers, no ambient damage, no hitbox or radius anywhere in this file.
// Adding biome two is adding an entry to BIOMES and a name to FLOOR_BIOMES.
//
// A floor with no biome, or a biome whose atlas will not load, draws the flat
// `fallbackFill` it has always drawn. Missing art is a normal state here for
// the same reason it is in js/assets.js: the art inventory exists before the
// art does, and the game has to run the whole way through with none of it.

export const BIOMES = {
  tundra: {
    id: 'tundra',
    atlas: 'assets/tiles/tundra/',
    variants: 5,
    // Mean luminance of the tile set, 0–1. Checked against the real art by
    // tools/readability_check.mjs — a config that lies about its own art is
    // worse than no config, because every later value decision trusts it.
    //
    // 0.60 is deliberate and it is NOT the intuitive choice. Bright white snow
    // is, and it is wrong here: a necromancer biome wants bone, frost and pale
    // undead in its enemy set, and those vanish against white. Mid-value ground
    // keeps headroom ABOVE for pale enemies and BELOW for the earth-toned
    // roster, which reads dark-on-light. Grey-blue packed snow, not powder.
    groundValue: 0.60,
    fallbackFill: '#14161f',
  },
};

// Which floor wears which biome. The spec asks for a per-map field; the map in
// this game is a floor of nodes sharing one theme, so the assignment lives at
// floor granularity and `buildArena()` resolves it onto every arena.
//
// Index 0 is floor 1. `null` means no biome: flat fill, exactly as today.
export const FLOOR_BIOMES = ['tundra', null, null, null];

export function biomeFor(floorNum) {
  const id = FLOOR_BIOMES[(floorNum | 0) - 1] || null;
  return id && BIOMES[id] ? BIOMES[id] : null;
}

// Sprite ids for one biome's tiles, in variant order. The manifest generator
// and the renderer both derive from this, so the two cannot drift.
export function tileSpriteIds(biome) {
  if (!biome) return [];
  return Array.from({ length: biome.variants }, (_, i) => `tile.${biome.id}_${String(i).padStart(2, '0')}`);
}

// File path for one variant, relative to the site root.
export function tileFile(biome, i) {
  return `${biome.atlas}tile-${String(i).padStart(2, '0')}.png`;
}

// Which variant a tile coordinate shows. A hash of the integer world
// coordinates — same coordinates, same tile, every run, every client, forever.
//
// NOT Math.random(). docs/KNOWN-DEFECTS.md #1 is an open defect where
// rushMove() draws from Math.random() and breaks same-seed reproduction from
// ~tick 402; a floor that reshuffled itself every run would be the same defect
// a second time, in the one layer where it would be visible on every frame.
// It does not take the run seed either: the floor is not part of the
// simulation, and two clients in one room must see the same ground.
export function tileVariant(tx, ty, count) {
  if (!(count > 1)) return 0;
  let h = (Math.imul(tx | 0, 73856093) ^ Math.imul(ty | 0, 19349663)) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return h % count;
}
