// MAP GEOGRAPHY — presentation only.
//
// Pins, atlas plates, campaign trails and the *intended* ground of unbuilt
// regions live here so the Earth map and the regional zoom can be painted
// without touching `js/regions.js` or `REGION_BIOMES`. Those two remain the
// simulation's source of truth: a region is playable when `contentReady`, and
// it wears a floor when `REGIONS[].tileset` names a biome.
//
// Equirectangular pin math matches `assets/maps/world.jpg` (2:1, restyled
// from a NASA plate). If the art is replaced, keep that projection.
//
// `campaign` is the regional node map: a polyline across the atlas plate, in
// percent. Column 0 is the start, the last column is the boss. Two-row combat
// columns sit either side of the spine; the reliquary, the shop and the boss
// sit on it. The tree's edges are still the tree — this only says WHERE they
// are drawn.

export const WORLD_MAP = 'assets/maps/world.jpg';

export const MAP_GEO = [
  {
    index: 1,
    id: 'pacific_northwest',
    where: 'Cascadia',
    lat: 47.6, lng: -122.3,
    tileset: 'pnw',
    regionMap: 'assets/maps/regions/pacific_northwest.jpg',
    ground: 'old-growth forest floor',
    startAt: 'the coast',
    bossAt: 'the Cascades',
    campaign: {
      branch: 12,
      path: [
        { x: 26, y: 58 },
        { x: 42, y: 50 },
        { x: 58, y: 42 },
        { x: 74, y: 34 },
        { x: 88, y: 28 },
      ],
    },
  },
  {
    index: 2,
    id: 'central_america',
    where: 'Yucatán to the isthmus',
    lat: 15.5, lng: -90.3,
    tileset: 'xibalba',
    regionMap: 'assets/maps/regions/central_america.jpg',
    ground: 'jungle temple earth',
    startAt: 'the Yucatán',
    bossAt: 'the isthmus',
    campaign: {
      branch: 10,
      path: [
        { x: 50, y: 24 },
        { x: 46, y: 40 },
        { x: 50, y: 56 },
        { x: 56, y: 70 },
        { x: 60, y: 80 },
      ],
    },
  },
  {
    index: 3,
    id: 'sahel',
    where: 'the Sahel belt',
    lat: 14.5, lng: 1.5,
    tileset: 'sahel',
    regionMap: 'assets/maps/regions/sahel.jpg',
    ground: 'packed sand and cactus scrub',
    startAt: 'the Atlantic edge',
    bossAt: 'Lake Chad',
    campaign: {
      branch: 9,
      path: [
        { x: 14, y: 54 },
        { x: 32, y: 48 },
        { x: 50, y: 50 },
        { x: 68, y: 52 },
        { x: 86, y: 50 },
      ],
    },
  },
  {
    index: 4,
    id: 'norse_reach',
    where: 'the Norse North',
    lat: 63.4, lng: -19.0,
    tileset: 'norse',
    regionMap: 'assets/maps/regions/norse_reach.jpg',
    ground: 'packed snow and basalt',
    startAt: 'Iceland',
    bossAt: 'the fjords',
    campaign: {
      branch: 9,
      path: [
        { x: 16, y: 48 },
        { x: 34, y: 54 },
        { x: 54, y: 42 },
        { x: 72, y: 36 },
        { x: 88, y: 32 },
      ],
    },
  },
  {
    index: 5,
    id: 'steppe',
    where: 'the Kazakh steppe',
    lat: 48.0, lng: 67.0,
    tileset: 'steppe',
    regionMap: 'assets/maps/regions/steppe.jpg',
    ground: 'dry grassland',
    startAt: 'the Caspian',
    bossAt: 'the Altai',
    campaign: {
      branch: 9,
      path: [
        { x: 14, y: 58 },
        { x: 32, y: 50 },
        { x: 50, y: 46 },
        { x: 68, y: 44 },
        { x: 86, y: 40 },
      ],
    },
  },
  {
    index: 6,
    id: 'indus_delta',
    where: 'the Indus fan',
    lat: 24.5, lng: 67.8,
    tileset: 'delta',
    regionMap: 'assets/maps/regions/indus_delta.jpg',
    ground: 'muddy wetland silt',
    startAt: 'the upper Indus',
    bossAt: 'the fan',
    campaign: {
      branch: 10,
      path: [
        { x: 50, y: 24 },
        { x: 46, y: 38 },
        { x: 44, y: 52 },
        { x: 48, y: 66 },
        { x: 54, y: 80 },
      ],
    },
  },
  {
    index: 7,
    id: 'abyssal_trench',
    where: 'the Sunda trench',
    lat: -9.0, lng: 114.0,
    tileset: 'abyss',
    regionMap: 'assets/maps/regions/abyssal_trench.jpg',
    ground: 'abyssal silt',
    startAt: 'Sumatra',
    bossAt: 'the trench',
    campaign: {
      branch: 9,
      path: [
        { x: 14, y: 40 },
        { x: 32, y: 48 },
        { x: 50, y: 50 },
        { x: 68, y: 52 },
        { x: 86, y: 48 },
      ],
    },
  },
  {
    index: 8,
    id: 'vault',
    where: 'the Australian outback',
    lat: -25.3, lng: 131.0,
    tileset: 'outback',
    regionMap: 'assets/maps/regions/vault.jpg',
    ground: 'red earth and spinifex',
    startAt: 'the west coast',
    bossAt: 'the red centre',
    campaign: {
      branch: 9,
      path: [
        { x: 16, y: 54 },
        { x: 34, y: 50 },
        { x: 52, y: 48 },
        { x: 68, y: 46 },
        { x: 84, y: 44 },
      ],
    },
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

// Sample a campaign polyline at t in [0,1] by arc length. Returns percent
// coords plus a unit perpendicular (nx, ny) so a two-row column can sit on
// either side of the road without the view inventing a second path.
export function campaignAt(path, t) {
  const pts = path && path.length ? path : [{ x: 12, y: 50 }, { x: 88, y: 50 }];
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, nx: 0, ny: -1 };
  const last = pts.length - 1;
  const segs = [];
  let total = 0;
  for (let i = 0; i < last; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const len = Math.hypot(dx, dy) || 1;
    segs.push({ a: pts[i], b: pts[i + 1], dx, dy, len });
    total += len;
  }
  const end = segs[segs.length - 1];
  const endN = { x: end.b.x, y: end.b.y, nx: -end.dy / end.len, ny: end.dx / end.len };
  if (!(total > 0) || t >= 1) return endN;
  if (t <= 0) return { x: pts[0].x, y: pts[0].y, nx: -segs[0].dy / segs[0].len, ny: segs[0].dx / segs[0].len };
  let dist = t * total;
  for (const s of segs) {
    if (dist <= s.len) {
      const u = dist / s.len;
      return {
        x: s.a.x + s.dx * u,
        y: s.a.y + s.dy * u,
        nx: -s.dy / s.len,
        ny: s.dx / s.len,
      };
    }
    dist -= s.len;
  }
  return endN;
}

// Place one node. `t` is column progress 0..1. A lone node in a column (the
// two stops, the boss) sits on the spine; a two-row fight sits `branch`
// percent off it, row 0 north-west of the road, row 1 south-east.
export function campaignPlace(campaign, col, maxCol, row, rowsInCol) {
  const path = campaign && campaign.path;
  const branch = (campaign && campaign.branch) || 9;
  const t = maxCol > 0 ? col / maxCol : 0;
  const p = campaignAt(path, t);
  const side = rowsInCol > 1 ? (row === 0 ? -1 : 1) : 0;
  const x = clampPct(p.x + p.nx * branch * side, 8, 92);
  const y = clampPct(p.y + p.ny * branch * side, 20, 80);
  return { x, y };
}

function clampPct(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
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
    const c = g.campaign;
    if (!c || !Array.isArray(c.path) || c.path.length < 3) problems.push(`${g.id}: campaign.path needs ≥3 points`);
    else {
      for (const p of c.path) {
        if (!(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100)) {
          problems.push(`${g.id}: campaign point ${p.x},${p.y} is off the plate`);
        }
      }
    }
    if (c && !(c.branch >= 4 && c.branch <= 16)) problems.push(`${g.id}: campaign.branch ${c && c.branch} should be 4..16`);
  }
  if (!WORLD_MAP.startsWith('assets/maps/')) problems.push('WORLD_MAP must be site-relative');
  if (problems.length) throw new Error(`mapgeo failed ${problems.length} assertion(s):\n  - ${problems.join('\n  - ')}`);
}
assertMapGeo();
