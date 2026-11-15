// EVERY MONSTER IS A CREATURE, NOT A POLYGON — and the picture tells the truth.
//
// Until November 2026 no enemy had a sprite on disk, so the renderer fell
// through to `def.shape`: forty-eight monsters in eight regions drawn as six
// kinds of coloured polygon. js/glyphs.js gives each one a code-drawn
// silhouette. This gate holds what that is worth:
//
//   1. COVERAGE. Every region enemy, every region boss, and the three bodies
//      every region borrows (the nest, its brood, the ward pylon) has a glyph;
//      no glyph is keyed to an id nothing spawns; every glyph has a silhouette
//      note in docs/silhouettes.json — the note the painted sprite is briefed
//      from, so the placeholder and its replacement describe the same creature.
//   2. WELL-FORMED. Every part is a tone, a kind and the right count of finite
//      numbers; every animation is one glyphPose() knows.
//   3. INSIDE THE CELL. In every frame of its animation, every glyph stays
//      within GLYPH_CELL_REACH radii of its centre. The renderer's cached cell
//      is exactly that large: a horn drawn past it is sliced off square.
//   4. THE PICTURE IS WHERE THE HITBOX IS. The radius is the truth — it is what
//      gets hit — so a glyph's mass must sit on it: centred near the origin,
//      covering a real share of the disc, not standing mostly outside it.
//   5. TOLD APART BY OUTLINE. docs/silhouettes.json: outline "is all a player
//      actually resolves" in a horde. Every glyph is rasterised and compared
//      with every other in its region; two that overlap too closely are one
//      shape in two colours, which is what this file replaced.
//   6. THE RENDERER DRAWS THEM. Renderer._primitiveCell is called with a
//      recording canvas: a body with a glyph is painted from its parts into a
//      GLYPH_CELL_REACH cell, with its domain ring UNDER it; a body without
//      one is still the polygon. (In a browser, tools/render_parity_test.mjs
//      holds the same fact against real pixels.)
//
// Usage: node tools/glyph_gate.mjs [--verbose]
import { readFileSync } from 'fs';
import { GLYPHS, GLYPH_FRAMES, GLYPH_CELL_REACH, GLYPH_ANIMS, glyphPose, glyphFrame, hasGlyph } from '../js/glyphs.js';
import { REGION_ENEMIES } from '../js/content/regions-enemies.js';
import { ENEMY_BY_ID } from '../js/content/enemies.js';
import { PYLON_SPRITE } from '../js/content/sprites.js';
import { REGIONS } from '../js/regions.js';
import { DOMAIN_COLOR } from '../js/domains.js';

const VERBOSE = process.argv.includes('--verbose');
let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };

// ---- who must have one --------------------------------------------------
const SHARED = [
  { id: 'flit', spriteId: ENEMY_BY_ID.flit.spriteId },
  { id: 'wombden', spriteId: ENEMY_BY_ID.wombden.spriteId },
  { id: 'ward_pylon', spriteId: PYLON_SPRITE },
];
const groups = Object.entries(REGION_ENEMIES).map(([key, pop], i) => ({
  name: (REGIONS[i] && REGIONS[i].name) || key,
  units: [...pop.enemies, pop.boss].map(d => ({ id: d.id, spriteId: d.spriteId, def: d })),
}));
groups.push({ name: 'in every region', units: SHARED });
const wanted = new Map();
for (const g of groups) for (const u of g.units) wanted.set(u.spriteId, u);

// ---- 1. coverage ----------------------------------------------------------
for (const g of groups) {
  const missing = g.units.filter(u => !hasGlyph(u.spriteId)).map(u => u.id);
  if (!missing.length) ok(`${g.name}: all ${g.units.length} bodies are code-drawn`);
  else bad(`${g.name}: NO GLYPH for ${missing.join(', ')} — drawn as a bare polygon`);
}
{
  const orphans = Object.keys(GLYPHS).filter(k => !wanted.has(k));
  if (!orphans.length) ok(`no glyph is keyed to an id nothing spawns (${Object.keys(GLYPHS).length} glyphs)`);
  else bad(`glyph(s) for no unit: ${orphans.join(', ')}`);
  const notes = JSON.parse(readFileSync(new URL('../docs/silhouettes.json', import.meta.url), 'utf8'));
  const unbriefed = Object.keys(GLYPHS).filter(k => typeof notes[k] !== 'string' || !notes[k].trim());
  if (!unbriefed.length) ok('every glyph has a silhouette note for the painted sprite that will replace it');
  else bad(`glyph(s) with no silhouette note in docs/silhouettes.json: ${unbriefed.join(', ')}`);
}

// ---- 2. well-formed -------------------------------------------------------
{
  const errs = [];
  for (const [id, g] of Object.entries(GLYPHS)) {
    if (!GLYPH_ANIMS.includes(g.anim)) errs.push(`${id}: unknown anim '${g.anim}'`);
    if (!Array.isArray(g.parts) || g.parts.length < 3) { errs.push(`${id}: fewer than 3 parts is a polygon again`); continue; }
    if (g.parts.length > 24) errs.push(`${id}: ${g.parts.length} parts (budget 24 — a cell is built per frame, per facing, per tint)`);
    g.parts.forEach((part, i) => {
      const [tone, kind, ...n] = part;
      if (!(tone >= 0 && tone <= 3)) errs.push(`${id} part ${i}: tone ${tone}`);
      if (n.some(v => typeof v !== 'number' || !Number.isFinite(v))) errs.push(`${id} part ${i}: a non-finite number`);
      if (kind === 'e') { if (n.length !== 5 || !(n[2] > 0) || !(n[3] > 0)) errs.push(`${id} part ${i}: ellipse wants cx, cy, rx>0, ry>0, rot`); }
      else if (kind === 'p') { if (n.length < 6 || n.length % 2) errs.push(`${id} part ${i}: polygon wants ≥3 x,y pairs`); }
      else if (kind === 'a') { if (n.length !== 6 || !(n[2] > 0) || !(n[5] > 0) || !(n[4] > n[3])) errs.push(`${id} part ${i}: arc wants cx, cy, r>0, a0<a1, w>0`); }
      else errs.push(`${id} part ${i}: unknown kind '${kind}'`);
    });
  }
  if (!errs.length) ok('every part of every glyph is well-formed, and every animation is known');
  else for (const m of errs) bad(m);
}

// ---- geometry: the outline of a part as points, in radius units -----------
function outline(part) {
  const [, kind, ...n] = part, pts = [];
  if (kind === 'p') { for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]); }
  else if (kind === 'e') {
    const [cx, cy, rx, ry, rot] = n, cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i < 32; i++) {
      const t = i / 32 * Math.PI * 2, x = Math.cos(t) * rx, y = Math.sin(t) * ry;
      pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
    }
  } else if (kind === 'a') {
    const [cx, cy, r, a0, a1, w] = n;
    const steps = Math.max(8, Math.ceil((a1 - a0) / 8));
    for (let i = 0; i <= steps; i++) {
      const t = (a0 + (a1 - a0) * i / steps) * Math.PI / 180;
      pts.push([cx + Math.cos(t) * (r + w / 2), cy + Math.sin(t) * (r + w / 2)]);
    }
  }
  return pts;
}
function inside(part, x, y) {
  const [, kind, ...n] = part;
  if (kind === 'e') {
    const [cx, cy, rx, ry, rot] = n, cr = Math.cos(-rot), sr = Math.sin(-rot);
    const dx = x - cx, dy = y - cy, u = dx * cr - dy * sr, v = dx * sr + dy * cr;
    return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1;
  }
  if (kind === 'a') {
    const [cx, cy, r, a0, a1, w] = n;
    const d = Math.hypot(x - cx, y - cy);
    if (d < r - w / 2 || d > r + w / 2) return false;
    if (a1 - a0 >= 360) return true;
    let t = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
    while (t < a0) t += 360;
    return t <= a1;
  }
  let c = false;                                   // even-odd, as the canvas fills it
  for (let i = 0, j = n.length - 2; i < n.length; j = i, i += 2) {
    const xi = n[i], yi = n[i + 1], xj = n[j], yj = n[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ---- 3. inside the cell, in every frame -----------------------------------
let worst = { reach: 0, id: '', frame: 0 };
{
  const over = [];
  for (const [id, g] of Object.entries(GLYPHS)) {
    let reach = 0, at = 0;
    for (let f = 0; f < GLYPH_FRAMES; f++) {
      const m = glyphPose(g.anim, f);
      for (const part of g.parts) for (const [x, y] of outline(part)) {
        const r = Math.max(Math.abs(m[0] * x + m[2] * y + m[4]), Math.abs(m[1] * x + m[3] * y + m[5]));
        if (r > reach) { reach = r; at = f; }
      }
    }
    if (reach > worst.reach) worst = { reach, id, frame: at };
    if (reach > GLYPH_CELL_REACH) over.push(`${id} reaches ${reach.toFixed(3)} radii in frame ${at}`);
    if (VERBOSE) console.log(`    ${id.padEnd(30)} reach ${reach.toFixed(3)}`);
  }
  if (!over.length) ok(`every glyph stays inside the ${GLYPH_CELL_REACH}-radius cell in all ${GLYPH_FRAMES} frames (furthest: ${worst.id} at ${worst.reach.toFixed(3)})`);
  else for (const m of over) bad(`${m} — past the ${GLYPH_CELL_REACH}-radius cell, it will be cut off square`);
}

// ---- rasterise: what a player resolves ------------------------------------
const N = 64, SPAN = GLYPH_CELL_REACH;                 // N×N cells over ±SPAN radii
function raster(g) {
  const bits = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = ((i + 0.5) / N * 2 - 1) * SPAN, y = ((j + 0.5) / N * 2 - 1) * SPAN;
    for (const part of g.parts) if (inside(part, x, y)) { bits[j * N + i] = 1; break; }
  }
  return bits;
}
const rasters = new Map(Object.entries(GLYPHS).map(([id, g]) => [id, raster(g)]));
const cellArea = (2 * SPAN / N) ** 2;

// ---- 4. the picture is where the hitbox is --------------------------------
// MIN_DISC: the thinnest honest body in the game is a fish seen side-on. Below
// about a tenth of the disc the hitbox is mostly empty floor.
// MAX_OFF: how far the picture's centre of mass may sit from the hitbox centre.
// MIN_IN: the share of the picture that must lie inside 1.15 radii — a glyph is
// allowed antlers and a tail, not to stand beside its own hitbox.
const MIN_DISC = 0.10, MAX_OFF = 0.45, MIN_IN = 0.60;
{
  const errs = [];
  let thin = { v: 1, id: '' }, off = { v: 0, id: '' }, out = { v: 1, id: '' };
  for (const [id, bits] of rasters) {
    let area = 0, inDisc = 0, inNear = 0, sx = 0, sy = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (bits[j * N + i]) {
      const x = ((i + 0.5) / N * 2 - 1) * SPAN, y = ((j + 0.5) / N * 2 - 1) * SPAN, d = Math.hypot(x, y);
      area++; sx += x; sy += y;
      if (d <= 1) inDisc++;
      if (d <= 1.15) inNear++;
    }
    const disc = inDisc * cellArea / Math.PI, cOff = Math.hypot(sx / area, sy / area), share = inNear / area;
    if (disc < thin.v) thin = { v: disc, id };
    if (cOff > off.v) off = { v: cOff, id };
    if (share < out.v) out = { v: share, id };
    if (disc < MIN_DISC) errs.push(`${id} covers ${(disc * 100).toFixed(0)}% of its hitbox disc (floor ${MIN_DISC * 100}%) — what gets hit is mostly empty floor`);
    if (cOff > MAX_OFF) errs.push(`${id} is centred ${cOff.toFixed(2)} radii off its hitbox (cap ${MAX_OFF})`);
    if (share < MIN_IN) errs.push(`${id} has only ${(share * 100).toFixed(0)}% of its picture within 1.15 radii (floor ${MIN_IN * 100}%)`);
    if (VERBOSE) console.log(`    ${id.padEnd(30)} disc ${(disc * 100).toFixed(0).padStart(3)}%  off ${cOff.toFixed(2)}  within ${(share * 100).toFixed(0)}%`);
  }
  if (!errs.length) ok(`every picture sits on its hitbox (thinnest: ${thin.id} ${(thin.v * 100).toFixed(0)}% of the disc; furthest off-centre: ${off.id} ${off.v.toFixed(2)}; most outside: ${out.id} ${(out.v * 100).toFixed(0)}% within)`);
  else for (const m of errs) bad(m);
}

// ---- 5. told apart by outline, within a region ----------------------------
// Overlap is intersection over union of the two silhouettes, each scaled to
// the unit's own radius as it is in play — a Sapling and a Bark Hulk are not
// confusable however alike their drawings, because one is twice the size.
// MAX_ALIKE 0.62, placed by measurement: the closest pair shipped overlaps 58%
// (printed below). Planted as a defect, a monster given another's drawing with
// the headdress removed overlaps 67%, and given the drawing whole — on a body
// of a different radius — 85%. So 0.62 passes everything that was drawn as a
// different creature and fails "the same body with a different hat".
const MAX_ALIKE = 0.62;
function alike(a, b) {
  const ra = a.def ? a.def.radius : 1, rb = b.def ? b.def.radius : 1, R = Math.max(ra, rb);
  const ga = GLYPHS[a.spriteId], gb = GLYPHS[b.spriteId];
  let inter = 0, union = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const X = ((i + 0.5) / N * 2 - 1) * SPAN * R, Y = ((j + 0.5) / N * 2 - 1) * SPAN * R;
    let ia = false, ib = false;
    for (const part of ga.parts) if (inside(part, X / ra, Y / ra)) { ia = true; break; }
    for (const part of gb.parts) if (inside(part, X / rb, Y / rb)) { ib = true; break; }
    if (ia && ib) inter++;
    if (ia || ib) union++;
  }
  return union ? inter / union : 0;
}
{
  let closest = { v: 0, pair: '' };
  for (const g of groups) {
    const us = g.units.filter(u => hasGlyph(u.spriteId));
    let top = { v: 0, pair: '' };
    for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
      const v = alike(us[i], us[j]);
      if (v > top.v) top = { v, pair: `${us[i].id} / ${us[j].id}` };
    }
    if (top.v > closest.v) closest = top;
    if (top.v <= MAX_ALIKE) ok(`${g.name}: no two bodies share a silhouette (closest: ${top.pair} at ${(top.v * 100).toFixed(0)}% overlap)`);
    else bad(`${g.name}: ${top.pair} overlap ${(top.v * 100).toFixed(0)}% (cap ${MAX_ALIKE * 100}%) — the same shape in two colours`);
  }
  console.log(`    closest pair in the game: ${closest.pair} at ${(closest.v * 100).toFixed(0)}%`);
}

// ---- 6. the renderer draws them --------------------------------------------
{
  // A canvas that records what was painted on it, in order.
  let made = [];
  const fakeCanvas = () => {
    const calls = [];
    const ctx = new Proxy({}, {
      get: (t, k) => (k in t ? t[k] : (...args) => { calls.push([k, ...args]); }),
      set: (t, k, v) => { t[k] = v; if (k === 'strokeStyle') calls.push(['strokeStyle=', v]); return true; },
    });
    const cv = { width: 0, height: 0, getContext: () => ctx, calls };
    made.push(cv);
    return cv;
  };
  const hadDoc = 'document' in globalThis, prevDoc = globalThis.document;
  globalThis.document = { createElement: fakeCanvas };
  try {
    const { Renderer } = await import('../js/render.js');
    const self = Object.create(Renderer.prototype);
    Object.assign(self, { t: 0, _facing: new Map(), _eKeys: new Map() });
    const sap = REGION_ENEMIES[Object.keys(REGION_ENEMIES)[0]].enemies[0];
    const ringCol = DOMAIN_COLOR[sap.domain];
    const view = (d, id) => ({ id, shape: d.shape, color: d.color, radius: d.radius, spriteId: d.spriteId, x: 0, y: 0 });

    made = [];
    const cell = self._primitiveCell(view(sap, 1), sap.radius, null, 1, 1, { color: ringCol });
    const cv = made[0];
    const lw = Math.max(2, sap.radius * 0.14);
    const wantHalf = Math.ceil(sap.radius * GLYPH_CELL_REACH + lw) + 2;
    const fills = cv ? cv.calls.filter(c => c[0] === 'fill').length : 0;
    if (cell && fills >= GLYPHS[sap.spriteId].parts.length) ok(`a ${sap.name} is painted from its ${GLYPHS[sap.spriteId].parts.length} parts, not as a '${sap.shape}'`);
    else bad(`a ${sap.name} was painted with ${fills} fill(s) — the renderer is not drawing its glyph`);
    if (cell && cell.half === wantHalf) ok(`its cached cell is ${GLYPH_CELL_REACH} radii to the edge (${cell.half}px half-width at radius ${sap.radius})`);
    else bad(`its cached cell is ${cell && cell.half}px half-width; ${GLYPH_CELL_REACH} radii wants ${wantHalf}px`);
    // the ring is stroked in the domain colour BEFORE the first body part is filled
    const iRing = cv ? cv.calls.findIndex(c => c[0] === 'strokeStyle=' && c[1] === ringCol) : -1;
    const iFill = cv ? cv.calls.findIndex(c => c[0] === 'fill') : -1;
    if (iRing >= 0 && iFill > iRing) ok('its domain ring is painted under the body, so nothing has to draw between them');
    else bad('its domain ring is not painted before the body');

    // every frame and both facings are distinct cells; the same frame is one
    made = [];
    for (let f = 0; f < GLYPH_FRAMES * 2; f++) self._primitiveCell(view(sap, 1), sap.radius, null, 1, 1, null, f);
    const again = made.length;
    for (let f = 0; f < GLYPH_FRAMES * 2; f++) self._primitiveCell(view(sap, 1), sap.radius, null, 1, 1, null, f);
    if (again === GLYPH_FRAMES * 2 && made.length === again) ok(`${GLYPH_FRAMES} frames × 2 facings are ${again} cached cells, each painted once`);
    else bad(`${GLYPH_FRAMES} frames × 2 facings built ${again} cells, then ${made.length - again} more on the second pass`);

    // control: a body with no glyph is still the polygon it was
    const legacy = Object.values(ENEMY_BY_ID).find(d => !hasGlyph(d.spriteId));
    if (legacy) {
      made = [];
      self._primitiveCell(view(legacy, 2), legacy.radius, null, 1, 1, null);
      const f2 = made[0] ? made[0].calls.filter(c => c[0] === 'fill').length : -1;
      if (f2 === 1) ok(`control: ${legacy.name}, which has no glyph, is still one filled '${legacy.shape}'`);
      else bad(`control: ${legacy.name} has no glyph and was painted with ${f2} fills (want 1)`);
    }

    // the animation is phased by id, so a pack does not step in unison
    const phases = new Set();
    for (let id = 1; id <= 24; id++) phases.add(glyphFrame(0.5, id));
    if (phases.size >= GLYPH_FRAMES - 2) ok(`24 bodies at one instant show ${phases.size} of ${GLYPH_FRAMES} frames — a pack does not step in unison`);
    else bad(`24 bodies at one instant show only ${phases.size} of ${GLYPH_FRAMES} frames`);
  } finally {
    if (hadDoc) globalThis.document = prevDoc; else delete globalThis.document;
  }
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A MONSTER IS STILL A POLYGON, OR ITS PICTURE LIES' : 'EVERY MONSTER IS A CREATURE, AND ITS PICTURE IS WHERE ITS HITBOX IS');
process.exit(fails ? 1 : 0);
