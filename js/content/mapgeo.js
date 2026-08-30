// MAP GEOGRAPHY — presentation only.
//
// Pins, atlas plates and the *intended* ground of unbuilt regions live here so
// the Earth map and the regional zoom can be painted without touching
// `js/regions.js` or `REGION_BIOMES`. Those two remain the simulation's
// source of truth: a region is playable when `contentReady`, and it wears a
// floor when `REGIONS[].tileset` names a biome.
//
// Equirectangular pin math matches `assets/maps/world.jpg` (2:1, restyled
// from a NASA plate). If the art is replaced, keep that projection.

export const WORLD_MAP = 'assets/maps/world.jpg';

// One row per region index 1..8. `name` is not re-authored — the screen reads
// the live name from `worldMapState` so locked placeholders and later region
// entries cannot drift. `where` is the geographic gloss shown on the pin.
export const MAP_GEO = [
  {
    index: 1,
    id: 'pacific_northwest',
    where: 'Cascadia',
    lat: 47.6, lng: -122.3,
    tileset: 'pnw',
    regionMap: 'assets/maps/regions/pacific_northwest.jpg',
    ground: 'old-growth forest floor',
  },
  {
    index: 2,
    id: 'central_america',
    where: 'Yucatán to the isthmus',
    lat: 15.5, lng: -90.3,
    tileset: 'xibalba',
    regionMap: 'assets/maps/regions/central_america.jpg',
    ground: 'jungle temple earth',
  },
  {
    index: 3,
    id: 'sahel',
    where: 'the Sahel belt',
    lat: 14.5, lng: 1.5,
    tileset: 'sahel',
    regionMap: 'assets/maps/regions/sahel.jpg',
    ground: 'packed sand and cactus scrub',
  },
  {
    index: 4,
    id: 'norse_reach',
    where: 'the Norse North',
    lat: 63.4, lng: -19.0,
    tileset: 'norse',
    regionMap: 'assets/maps/regions/norse_reach.jpg',
    ground: 'packed snow and basalt',
  },
  {
    index: 5,
    id: 'steppe',
    where: 'the Kazakh steppe',
    lat: 48.0, lng: 67.0,
    tileset: 'steppe',
    regionMap: 'assets/maps/regions/steppe.jpg',
    ground: 'dry grassland',
  },
  {
    index: 6,
    id: 'indus_delta',
    where: 'the Indus fan',
    lat: 24.5, lng: 67.8,
    tileset: 'delta',
    regionMap: 'assets/maps/regions/indus_delta.jpg',
    ground: 'muddy wetland silt',
  },
  {
    index: 7,
    id: 'abyssal_trench',
    where: 'the Sunda trench',
    lat: -9.0, lng: 114.0,
    tileset: 'abyss',
    regionMap: 'assets/maps/regions/abyssal_trench.jpg',
    ground: 'abyssal silt',
  },
  {
    index: 8,
    id: 'vault',
    where: 'the Australian outback',
    lat: -25.3, lng: 131.0,
    tileset: 'outback',
    regionMap: 'assets/maps/regions/vault.jpg',
    ground: 'red earth and spinifex',
  },
];

export const MAP_GEO_BY_INDEX = Object.fromEntries(MAP_GEO.map(g => [g.index, g]));

export function geoFor(regionIndex) {
  return MAP_GEO_BY_INDEX[regionIndex | 0] || null;
}

// Equirectangular: x = (lng+180)/360, y = (90-lat)/180.
export function pinPct(lat, lng) {
  return {
    x: ((lng + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  };
}

function assertMapGeo() {
  const problems = [];
  if (MAP_GEO.length !== 8) problems.push(`MAP_GEO has ${MAP_GEO.length} rows, want 8`);
  const seen = new Set();
  for (const g of MAP_GEO) {
    if (seen.has(g.index)) problems.push(`duplicate index ${g.index}`);
    seen.add(g.index);
    if (!(g.index >= 1 && g.index <= 8)) problems.push(`${g.id}: index ${g.index}`);
    if (!(g.lat >= -90 && g.lat <= 90)) problems.push(`${g.id}: lat ${g.lat}`);
    if (!(g.lng >= -180 && g.lng <= 180)) problems.push(`${g.id}: lng ${g.lng}`);
    if (!g.regionMap || !g.regionMap.startsWith('assets/maps/')) problems.push(`${g.id}: regionMap must be site-relative`);
    if (!g.tileset) problems.push(`${g.id}: no intended tileset`);
  }
  if (!WORLD_MAP.startsWith('assets/maps/')) problems.push('WORLD_MAP must be site-relative');
  if (problems.length) throw new Error(`mapgeo failed ${problems.length} assertion(s):\n  - ${problems.join('\n  - ')}`);
}
assertMapGeo();
