// BIOMES — per-REGION ground theming. Cosmetic only.
//
// A biome is a tile set and the numbers needed to check that the tile set is
// what it claims to be. It does not touch the simulation: no movement
// modifiers, no ambient damage, no hitbox or radius anywhere in this file.
//
// A region with no biome, or a biome whose atlas will not load, draws the flat
// `fallbackFill` it has always drawn. Missing art is a normal state here for
// the same reason it is in js/assets.js: the art inventory exists before the
// art does, and the game has to run the whole way through with none of it.
//
// WHICH REGION WEARS WHICH IS NOT DECIDED HERE. `regions.js` already carries a
// `tileset` field per region, and a second table naming the same thing is two
// sources of truth that drift — which is exactly how `FLOOR_BIOMES` came to
// dress the Pacific Northwest in tundra. The mapping is DERIVED from `REGIONS`
// below, so a region changes its ground by editing the region.

import { REGIONS, TOTAL_REGIONS } from './regions.js';

export const BIOMES = {
  // REGION 1 — the Pacific Northwest. Old-growth forest floor: moss over
  // needle duff over wet earth, under a closed canopy.
  //
  // 0.50 rather than the tundra's 0.60, and the reasoning is the same
  // reasoning reaching a different answer. Region 1's roster is bark, cedar,
  // thorn and elk — earth tones that read DARK — with one pale exception in
  // the mistwalker. A bright moss lawn would lose five of the six; a deep
  // forest black would lose the same five the other way. Mid-shade keeps the
  // dark majority legible as silhouettes and still leaves the mistwalker
  // somewhere to be pale.
  pnw: {
    id: 'pnw',
    atlas: 'assets/tiles/pnw/',
    variants: 5,
    groundValue: 0.50,
    fallbackFill: '#131a14',
  },
  // REGION 2 — Xibalba. Declared, no atlas yet: the flat fill is what it draws
  // and that is a normal state, not a missing dependency.
  xibalba: {
    id: 'xibalba',
    atlas: 'assets/tiles/xibalba/',
    variants: 5,
    groundValue: 0.34,
    fallbackFill: '#1b1013',
  },
  // DECLARED AND UNASSIGNED. The tundra tiles and their atlas are real art from
  // `patch-tiled-floors` and they belong to the Russian / necromancer region,
  // whose index is not decided. Keeping the entry with no region pointing at it
  // is the honest state: deleting it throws away shipped art, and guessing a
  // slot puts snow somewhere the design has not put snow.
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

// Which REGION wears which biome. This was `FLOOR_BIOMES = ['tundra', ...]`,
// four entries keyed to four floors, and it is not re-indexed — it is
// discarded, because its one populated slot was wrong the moment regions
// replaced floors. Region 1 is the Pacific Northwest. Nothing about the
// Pacific Northwest is tundra.
//
// Index 0 is region 1. `null` means no biome: flat fill, exactly as before.
// Derived, never authored — see the header.
export const REGION_BIOMES = Array.from({ length: TOTAL_REGIONS }, (_, i) => {
  const r = REGIONS.find(x => x.index === i + 1);
  return r && r.tileset && BIOMES[r.tileset] ? r.tileset : null;
});

export function biomeFor(regionIndex) {
  const id = REGION_BIOMES[(regionIndex | 0) - 1] || null;
  return id && BIOMES[id] ? BIOMES[id] : null;
}

// Which regions have a tileset and which are still flat fill. The world map and
// the gates both want to say "2 of 8" rather than imply eight.
export function biomeCoverage() {
  return REGION_BIOMES.map((id, i) => ({ region: i + 1, biome: id, defined: !!(id && BIOMES[id]) }));
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
