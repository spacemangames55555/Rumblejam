// CODE-DRAWN MONSTERS. Purely cosmetic: nothing here is read by the sim, the
// snapshot or the wire.
//
// Every enemy and boss has a sprite id and, as of November 2026, none has a
// sprite: the renderer fell through to `def.shape`, so forty-eight monsters in
// eight regions were six kinds of coloured polygon. A Sphinx and a Sapling were
// told apart by hue alone, at a density where docs/silhouettes.json says
// outline "is all a player actually resolves".
//
// So each unit gets a GLYPH: a silhouette built from a handful of vector parts,
// drawn once into the renderer's cached cell exactly where the polygon was
// (render.js `_primitiveCell`), so a glyph costs what a polygon cost per frame.
// A painted sprite still wins the moment one is installed — the glyph is the
// fallback, not the art. The shapes follow the one-clause notes in
// docs/silhouettes.json, which are also the brief the painted sprites are
// generated from, so what is on screen today and what replaces it describe
// the same creature.
//
// COORDINATES. One unit is the body's radius. +x is the way the creature
// FACES, +y is down. A glyph should sit inside about ±1.3. The renderer mirrors
// it for a body moving left.
//
// A PART is [tone, kind, ...numbers]:
//   'e'  cx, cy, rx, ry, rot      an ellipse
//   'p'  x, y, x, y, …            a closed polygon
//   'a'  cx, cy, r, a0, a1, w     a ring segment, degrees clockwise from +x,
//                                 `w` thick — the hole is a real hole
// TONES are derived from the unit's own colour, so a glyph needs no palette:
//   B body · D shade · L light · A accent (eyes, embers, a lamp)
//
// The outline is drawn around the UNION of the parts (stroke everything, then
// fill everything), so overlapping parts read as one body rather than as a
// diagram of how it was built.

const B = 0, D = 1, L = 2, A = 3;
const e = (t, cx, cy, rx, ry, rot = 0) => [t, 'e', cx, cy, rx, ry, rot];
const p = (t, ...pts) => [t, 'p', ...pts];
const a = (t, cx, cy, r, a0, a1, w) => [t, 'a', cx, cy, r, a0, a1, w];
// mirror a polygon across the vertical axis — most bodies are symmetric
const mp = (t, ...pts) => [t, 'p', ...pts.map((v, i) => (i % 2 === 0 ? -v : v))];
const eyes = (x, y, s = 0.08, gap = 0.2) => [e(A, x - gap / 2, y, s, s), e(A, x + gap / 2, y, s, s)];
const eye = (x, y, s = 0.085) => e(A, x, y, s, s);
// a tapered spoke from a hub: `deg` clockwise from +x, from radius r0 (where it
// is `half` degrees wide each side) out to a point at r1
const spoke = (t, deg, r0, r1, half = 16) => {
  const k = Math.PI / 180, q = v => Math.round(v * 100) / 100;
  return p(t,
    q(Math.cos((deg - half) * k) * r0), q(Math.sin((deg - half) * k) * r0),
    q(Math.cos(deg * k) * r1), q(Math.sin(deg * k) * r1),
    q(Math.cos((deg + half) * k) * r0), q(Math.sin((deg + half) * k) * r0));
};
// four legs under a quadruped: x positions, top y, bottom y, half-width
const legs = (xs, y0, y1, hw = 0.07) => xs.map(x => p(D, x - hw, y0, x + hw, y0, x + hw, y1, x - hw, y1));

// How a glyph moves. One transform on the whole body, eight frames a cycle.
//   bob     a walker's step            sway    a rooted thing leaning
//   float   something with no legs     scuttle a low body stretching
//   pulse   something swelling         slither a long body weaving
export const GLYPH_FRAMES = 8;
export const GLYPH_HZ = 1.6;
// A glyph overhangs its radius — antlers, a tail, a spear — and leans a little
// as it animates. The renderer's cached cell is this many radii from centre to
// edge, and tools/glyph_gate.mjs holds every glyph, in every frame, inside it:
// a part drawn past it would be sliced off square at the cell's edge.
export const GLYPH_CELL_REACH = 1.55;

export const GLYPHS = {
  // ------------------------------------------------ in every region
  // Three bodies no region authors and every region fields: a Nest Purge
  // borrows the nest and its brood (GDD §3.7), and a siege or a warded boss
  // stands a pylon.
  'enemy.flit': { anim: 'float', parts: [
    p(B, 1.22, 0, -0.9, -0.95, -0.38, 0, -0.9, 0.95),
    p(D, 0.35, 0, -0.72, -0.3, -0.5, 0, -0.72, 0.3),
    eye(0.6, 0, 0.1),
  ] },
  'enemy.wombden': { anim: 'pulse', parts: [
    ...[0, 60, 120, 180, 240, 300].map(d => spoke(D, d + 30, 0.5, 1.28, 20)),
    ...[0, 60, 120, 180, 240, 300].map(d => spoke(B, d, 0.5, 1.12, 22)),
    e(B, 0, 0, 0.7, 0.66),
    e(D, 0, 0.02, 0.4, 0.36),
    e(A, 0, 0.02, 0.17, 0.15),
  ] },
  'enemy.ward_pylon': { anim: 'pulse', parts: [
    p(D, -0.82, 1.1, 0.82, 1.1, 0.55, 0.72, -0.55, 0.72),
    p(B, -0.42, 0.75, 0.42, 0.75, 0.5, -0.5, 0, -1.3, -0.5, -0.5),
    p(L, 0, -1.3, 0.5, -0.5, 0.42, 0.75, 0, 0.75),
    e(A, 0, -0.08, 0.16, 0.27),
  ] },

  // ------------------------------------------------ region 1 · Pacific Northwest
  'enemy.pnw_sapling': { anim: 'sway', parts: [
    p(D, -0.42, 1.08, 0.42, 1.08, 0.13, 0.72, -0.13, 0.72),
    p(B, -0.14, 1.0, 0.14, 1.0, 0.1, -0.95, -0.1, -0.95),
    p(L, -0.06, -0.55, -0.85, -0.25, -1.0, 0.4, -0.55, -0.02, -0.08, -0.2),
    mp(L, -0.06, -0.55, -0.85, -0.25, -1.0, 0.4, -0.55, -0.02, -0.08, -0.2),
    p(L, -0.22, -0.88, 0.22, -0.88, 0, -1.28),
  ] },
  'enemy.pnw_cedar_warden': { anim: 'bob', parts: [
    p(D, -0.3, -0.08, -1.28, -0.4, -1.28, -0.08, -0.3, 0.32),
    p(D, -0.2, 0.55, 0, 0.6, -0.1, 1.12, -0.34, 1.12), p(D, 0.2, 0.62, 0.42, 0.55, 0.56, 1.12, 0.32, 1.12),
    p(B, 1.15, 0.05, 0.1, -0.78, -0.38, -0.36, -0.38, 0.58, 0.3, 0.82),
    p(L, -0.1, -0.52, 0.02, -0.98, 0.2, -0.62), p(L, 0.3, -0.5, 0.48, -0.9, 0.58, -0.36),
    eye(0.5, -0.12),
  ] },
  'enemy.pnw_thornhound': { anim: 'scuttle', parts: [
    ...legs([-0.6, -0.32, 0.3, 0.55], 0.3, 1.0),
    e(B, 0, 0.1, 0.85, 0.36),
    e(B, 0.85, -0.02, 0.32, 0.26),
    p(B, 1.0, -0.14, 1.32, 0.04, 1.0, 0.2),
    p(L, -0.55, -0.18, -0.3, -0.24, -0.85, -0.8),
    p(L, -0.2, -0.24, 0.05, -0.26, -0.45, -0.88),
    p(L, 0.15, -0.26, 0.4, -0.24, -0.05, -0.85),
    eye(0.92, -0.08, 0.07),
  ] },
  'enemy.pnw_mistwalker': { anim: 'float', parts: [
    p(B, -0.42, -0.5, 0.42, -0.5, 0.52, 0.3, 0.32, 1.0, 0.18, 0.5, 0, 1.18, -0.18, 0.5, -0.32, 1.0, -0.52, 0.3),
    e(B, 0, -0.62, 0.44, 0.52),
    e(D, 0.08, -0.62, 0.24, 0.28),
    ...eyes(0.1, -0.66, 0.055, 0.2),
  ] },
  'enemy.pnw_bark_hulk': { anim: 'bob', parts: [
    e(D, -0.95, 0.4, 0.36, 0.62), e(D, 0.95, 0.4, 0.36, 0.62),
    p(B, -0.58, -0.75, 0.58, -0.75, 0.66, 0.9, -0.66, 0.9),
    p(B, -0.58, -0.72, -0.32, -1.12, -0.1, -0.8, 0.15, -1.18, 0.36, -0.8, 0.58, -1.02, 0.58, -0.72),
    e(L, -0.95, 0.98, 0.32, 0.17), e(L, 0.95, 0.98, 0.32, 0.17),
    ...eyes(0.05, -0.28, 0.09, 0.42),
  ] },
  'enemy.pnw_elk': { anim: 'bob', parts: [
    ...legs([-0.22, 0.22], 0.85, 1.2, 0.09),
    e(B, 0, 0.45, 0.42, 0.55),
    e(B, 0.14, -0.2, 0.22, 0.27),
    p(L, -0.05, -0.4, -0.5, -0.7, -1.15, -0.6, -1.22, -0.76, -0.7, -0.9, -0.95, -1.26, -0.8, -1.28, -0.45, -0.9, -0.15, -0.55),
    mp(L, -0.05, -0.4, -0.5, -0.7, -1.15, -0.6, -1.22, -0.76, -0.7, -0.9, -0.95, -1.26, -0.8, -1.28, -0.45, -0.9, -0.15, -0.55),
    eye(0.2, -0.24, 0.06),
  ] },
  'boss.pnw_boss': { anim: 'sway', parts: [
    p(D, -0.45, 1.0, -0.95, 1.18, -0.3, 0.72), mp(D, -0.45, 1.0, -0.95, 1.18, -0.3, 0.72),
    e(L, 0, -0.62, 1.02, 0.42),
    p(B, 0, -0.1, -1.28, -0.62, -0.7, -0.5, -0.78, -1.18, -0.32, -0.7, 0, -1.32, 0.32, -0.7, 0.78, -1.18, 0.7, -0.5, 1.28, -0.62),
    p(B, -0.45, 1.02, 0.45, 1.02, 0.62, -0.12, -0.62, -0.12),
    ...eyes(0, 0.25, 0.1, 0.38),
  ] },

  // ------------------------------------------------ region 2 · Central America
  'enemy.xib_howler': { anim: 'bob', parts: [
    p(D, -0.42, 0.8, -0.15, 0.8, -0.2, 1.18, -0.52, 1.18), p(D, 0.05, 0.8, 0.3, 0.8, 0.36, 1.18, 0.05, 1.18),
    e(B, -0.15, 0.35, 0.5, 0.6, -0.3),
    e(B, 0.35, -0.38, 0.56, 0.5),
    p(D, 0.22, -0.3, 1.02, -0.62, 1.02, 0.14),
    eye(0.28, -0.62),
  ] },
  'enemy.xib_obsidian_lancer': { anim: 'scuttle', parts: [
    p(D, -0.3, 0.4, -0.05, 0.45, -0.55, 1.18, -0.76, 1.12), p(D, -0.05, 0.45, 0.15, 0.4, 0.62, 1.12, 0.42, 1.18),
    p(B, -0.25, -0.5, 0.25, -0.35, 0.1, 0.45, -0.3, 0.4),
    p(B, 0.05, -0.96, 0.42, -0.7, 0.1, -0.45, -0.15, -0.6),
    p(L, -0.9, -0.12, 1.32, -0.22, 1.32, -0.1, -0.9, 0.02),
    eye(0.16, -0.72, 0.06),
  ] },
  'enemy.xib_ashmoth': { anim: 'float', parts: [
    p(B, 0, 0.1, -1.22, -0.72, -0.95, -0.15, -1.16, 0.1, -0.7, 0.2, -0.76, 0.56, -0.3, 0.35),
    mp(B, 0, 0.1, -1.22, -0.72, -0.95, -0.15, -1.16, 0.1, -0.7, 0.2, -0.76, 0.56, -0.3, 0.35),
    e(D, 0, 0.15, 0.2, 0.44),
    ...eyes(0, -0.16, 0.06, 0.17),
  ] },
  'enemy.xib_censer': { anim: 'bob', parts: [
    p(B, -0.52, 1.12, 0.3, 1.12, 0.25, -0.2, -0.1, -0.6, -0.56, -0.3),
    e(B, 0.05, -0.76, 0.28, 0.28),
    p(B, 0.1, -0.32, 1.02, -0.46, 1.02, -0.3, 0.15, -0.1),
    p(D, 0.93, -0.4, 1.03, -0.4, 1.03, 0.52, 0.93, 0.52),
    e(L, 0.98, 0.72, 0.21, 0.23), e(A, 0.98, 0.72, 0.09, 0.1),
    eye(0.14, -0.78, 0.06),
  ] },
  'enemy.xib_jade_colossus': { anim: 'bob', parts: [
    p(D, -1.22, 0.2, -0.95, 0.2, -0.95, 0.98, -1.22, 0.98), mp(D, -1.22, 0.2, -0.95, 0.2, -0.95, 0.98, -1.22, 0.98),
    p(B, -0.96, 1.12, 0.96, 1.12, 0.96, 0.35, -0.96, 0.35),
    p(L, -0.7, 0.36, 0.7, 0.36, 0.7, -0.36, -0.7, -0.36),
    p(B, -0.46, -0.35, 0.46, -0.35, 0.46, -1.02, -0.46, -1.02),
    p(A, -0.26, -0.76, -0.08, -0.76, -0.08, -0.62, -0.26, -0.62), p(A, 0.08, -0.76, 0.26, -0.76, 0.26, -0.62, 0.08, -0.62),
  ] },
  'enemy.xib_bloodpriest': { anim: 'bob', parts: [
    p(L, 0, -0.35, -1.02, -0.76, -0.76, -1.22, -0.36, -1.06, 0, -1.32, 0.36, -1.06, 0.76, -1.22, 1.02, -0.76),
    p(D, -0.05, -0.4, 0.05, -0.4, 0.04, -1.22, -0.04, -1.22),
    p(B, -0.4, 1.12, 0.4, 1.12, 0.28, -0.1, -0.28, -0.1),
    e(B, 0, -0.3, 0.24, 0.24),
    ...eyes(0, -0.32, 0.055, 0.2),
  ] },
  'boss.xib_boss': { anim: 'float', parts: [
    a(L, 0, 0, 0.98, 150, 244, 0.18), a(L, 0, 0, 0.98, 262, 390, 0.18),
    p(B, -0.22, -0.26, -0.62, -0.78, -0.5, -0.86, -0.12, -0.4), mp(B, -0.22, -0.26, -0.62, -0.78, -0.5, -0.86, -0.12, -0.4),
    p(B, -0.52, 1.12, 0.52, 1.12, 0.24, -0.38, -0.24, -0.38),
    p(D, -0.07, 1.12, 0.07, 1.12, 0.04, -0.1, -0.04, -0.1),
    e(B, 0, -0.6, 0.22, 0.26),
    ...eyes(0, -0.62, 0.05, 0.17),
  ] },

  // ------------------------------------------------ region 3 · Great Britain
  'enemy.gb_redcap': { anim: 'bob', parts: [
    p(D, -0.4, 0.92, -0.1, 0.92, -0.1, 1.18, -0.48, 1.18), p(D, 0.1, 0.92, 0.4, 0.92, 0.48, 1.18, 0.1, 1.18),
    e(D, -0.05, 0.5, 0.6, 0.55),
    e(L, 0.2, -0.05, 0.36, 0.32),
    p(B, -0.22, -0.18, 0.62, -0.25, 1.02, -1.22),
    eye(0.34, -0.06, 0.07),
  ] },
  'enemy.gb_hunt_rider': { anim: 'scuttle', parts: [
    p(D, 0.55, 0.4, 0.7, 0.4, 1.06, 1.08, 0.9, 1.08), p(D, 0.3, 0.45, 0.45, 0.45, 0.25, 1.12, 0.1, 1.12),
    p(D, -0.6, 0.4, -0.45, 0.4, -0.86, 1.08, -1.02, 1.08), p(D, -0.35, 0.45, -0.2, 0.45, -0.3, 1.12, -0.45, 1.12),
    p(D, -0.85, 0.15, -1.32, 0, -1.26, 0.32),
    e(B, 0, 0.25, 0.9, 0.3),
    p(B, 0.6, 0.1, 1.26, -0.36, 1.32, -0.1, 0.85, 0.36),
    p(D, -0.2, 0, 0.35, -0.05, 0.5, -0.56, 0.05, -0.6),
    e(D, 0.45, -0.7, 0.17, 0.17),
    p(L, 0.4, -0.82, 0.25, -1.22, 0.5, -0.9), p(L, 0.55, -0.82, 0.82, -1.16, 0.6, -0.72),
  ] },
  'enemy.gb_sprite': { anim: 'float', parts: [
    e(L, -0.55, -0.5, 0.7, 0.16, 0.7), e(L, 0.55, -0.5, 0.7, 0.16, -0.7),
    e(L, -0.55, 0.45, 0.6, 0.14, -0.6), e(L, 0.55, 0.45, 0.6, 0.14, 0.6),
    e(B, 0, 0, 0.2, 0.42),
    e(B, 0, -0.45, 0.17, 0.17),
    ...eyes(0, -0.46, 0.045, 0.14),
  ] },
  'enemy.gb_banshee': { anim: 'float', parts: [
    p(L, -0.3, -0.4, -0.56, -1.26, -0.2, -0.9, 0, -1.32, 0.2, -0.9, 0.5, -1.22, 0.3, -0.4),
    p(B, -0.25, -0.1, -0.92, -0.72, -0.8, -0.82, -0.15, -0.26), mp(B, -0.25, -0.1, -0.92, -0.72, -0.8, -0.82, -0.15, -0.26),
    p(B, -0.3, -0.2, 0.3, -0.2, 0.56, 0.6, 0.3, 1.12, 0.1, 0.75, -0.1, 1.18, -0.3, 0.75, -0.56, 0.6),
    e(B, 0, -0.35, 0.25, 0.27),
    e(D, 0, -0.24, 0.08, 0.12),
    ...eyes(0, -0.42, 0.05, 0.2),
  ] },
  'enemy.gb_stone_giant': { anim: 'bob', parts: [
    p(L, -1.32, 0.4, -0.95, 0.3, -0.85, 1.22, -1.32, 1.22),
    p(D, -0.95, -0.1, -0.7, -0.1, -0.85, 0.82, -1.06, 0.82),
    p(D, -0.46, 0.85, -0.1, 0.85, -0.1, 1.22, -0.5, 1.22), mp(D, -0.46, 0.85, -0.1, 0.85, -0.1, 1.22, -0.5, 1.22),
    p(B, -0.6, 0, 0.6, 0, 0.46, 0.92, -0.46, 0.92),
    e(B, 0, -0.2, 1.0, 0.55),
    e(L, 0.1, -0.82, 0.18, 0.17),
    ...eyes(0.12, -0.84, 0.04, 0.13),
  ] },
  'enemy.gb_sidhe_knight': { anim: 'bob', parts: [
    ...legs([-0.1, 0.1], 0.58, 1.18, 0.08),
    p(B, -0.25, -0.45, 0.25, -0.45, 0.2, 0.62, -0.2, 0.62),
    p(L, -0.1, -0.9, -0.5, -1.32, -0.4, -1.0, -0.66, -1.06, -0.2, -0.8), mp(L, -0.1, -0.9, -0.5, -1.32, -0.4, -1.0, -0.66, -1.06, -0.2, -0.8),
    e(B, 0, -0.7, 0.22, 0.24),
    p(L, 0.35, -0.52, 0.78, -0.1, 0.42, 0.98, 0.2, -0.1),
    eye(0.08, -0.72, 0.05),
  ] },
  'boss.gb_boss': { anim: 'float', parts: [
    p(B, -0.25, 0.2, 0.25, 0.2, 1.02, 1.18, -1.02, 1.18),
    a(B, 0, -0.26, 0.52, 0, 360, 0.2),
    e(B, 0, -0.98, 0.2, 0.22),
    p(L, -0.22, -1.1, -0.22, -1.32, -0.1, -1.18, 0, -1.34, 0.1, -1.18, 0.22, -1.32, 0.22, -1.1),
    ...eyes(0, -0.98, 0.05, 0.17),
  ] },

  // ------------------------------------------------ region 4 · Egypt
  'enemy.eg_ushabti': { anim: 'bob', parts: [
    p(L, -0.44, -0.96, 0.44, -0.96, 0.52, -0.15, 0.3, -0.3, -0.3, -0.3, -0.52, -0.15),
    p(B, -0.32, -0.3, 0.32, -0.3, 0.26, 1.12, -0.26, 1.12),
    e(B, 0, -0.6, 0.22, 0.24),
    p(D, -0.3, 0.05, 0.3, 0.3, 0.3, 0.43, -0.3, 0.18), mp(D, -0.3, 0.05, 0.3, 0.3, 0.3, 0.43, -0.3, 0.18),
    ...eyes(0, -0.62, 0.05, 0.18),
  ] },
  'enemy.eg_mummy': { anim: 'bob', parts: [
    p(L, -0.25, -0.2, -1.12, 0.1, -0.7, 0.05, -1.22, 0.52, -0.3, 0.2),
    p(D, -0.25, 0.5, 0, 0.5, -0.05, 1.18, -0.36, 1.18), p(D, 0.02, 0.5, 0.28, 0.5, 0.36, 1.18, 0.08, 1.18),
    p(B, -0.3, -0.45, 0.2, -0.5, 0.3, 0.52, -0.25, 0.56),
    e(B, 0.15, -0.75, 0.26, 0.26),
    p(B, 0.15, -0.42, 1.18, -0.52, 1.18, -0.37, 0.15, -0.2), p(B, 0.15, -0.15, 1.12, -0.2, 1.12, -0.06, 0.15, 0.04),
    eye(0.24, -0.78, 0.06),
  ] },
  'enemy.eg_jackal': { anim: 'scuttle', parts: [
    ...legs([-0.55, -0.32, 0.3, 0.5], 0.2, 1.18, 0.06),
    a(B, -0.72, -0.34, 0.26, 80, 330, 0.11),
    e(B, 0, 0.05, 0.7, 0.26),
    p(B, 0.55, -0.3, 1.28, -0.15, 1.22, 0.02, 0.6, 0.12),
    p(B, 0.58, -0.28, 0.54, -1.05, 0.76, -0.33), p(B, 0.78, -0.3, 0.86, -1.0, 0.97, -0.24),
    eye(0.86, -0.14, 0.055),
  ] },
  'enemy.eg_eye': { anim: 'float', parts: [
    p(B, -1.06, -0.55, 0, -1.02, 1.06, -0.55, 1.0, -0.42, 0, -0.86, -1.0, -0.42),
    p(B, 0.15, 0.4, 0.3, 0.4, 0.2, 1.02, 0.05, 1.02),
    a(B, -0.2, 0.9, 0.24, 0, 210, 0.1),
    p(B, -0.5, 0.3, -0.38, 0.3, -0.6, 0.96, -0.72, 0.9),
    p(L, -1.0, -0.1, -0.5, -0.56, 0, -0.68, 0.5, -0.56, 1.0, -0.1, 0.5, 0.3, 0, 0.42, -0.5, 0.3),
    e(B, 0, -0.12, 0.36, 0.38),
    e(D, 0, -0.12, 0.17, 0.19),
    e(A, 0.1, -0.22, 0.07, 0.07),
  ] },
  'enemy.eg_sphinx': { anim: 'bob', parts: [
    e(D, -0.78, 0.4, 0.4, 0.5),
    e(B, -0.2, 0.46, 0.95, 0.42),
    p(B, 0.4, 0.6, 1.28, 0.7, 1.28, 0.96, 0.4, 0.96),
    p(B, 0.25, -0.3, 0.85, -0.3, 0.9, 0.62, 0.2, 0.62),
    p(L, 0.15, -1.06, 0.95, -1.06, 1.16, -0.1, 0.85, -0.3, 0.25, -0.3, -0.05, -0.1),
    e(B, 0.58, -0.65, 0.26, 0.3),
    ...eyes(0.62, -0.68, 0.05, 0.2),
  ] },
  'enemy.eg_sobek_guard': { anim: 'bob', parts: [
    p(L, 0.44, -1.26, 0.52, -1.26, 0.52, 1.18, 0.44, 1.18),
    p(D, -0.2, 0.3, -1.22, 0.92, -1.0, 1.08, -0.2, 0.62),
    ...legs([-0.12, 0.1], 0.52, 1.18, 0.09),
    p(B, -0.25, -0.35, 0.25, -0.35, 0.2, 0.56, -0.25, 0.56),
    p(B, -0.2, -0.86, 0.2, -0.92, 1.18, -0.73, 1.18, -0.55, 0.25, -0.45, -0.2, -0.45),
    p(L, 0.5, -0.52, 0.6, -0.38, 0.7, -0.55), p(L, 0.85, -0.57, 0.93, -0.43, 1.02, -0.59),
    eye(0.12, -0.74, 0.06),
  ] },
  'boss.eg_boss': { anim: 'sway', parts: [
    e(D, 0, 0.96, 1.02, 0.3), e(B, 0, 0.6, 0.8, 0.28), e(D, 0, 0.28, 0.6, 0.26),
    p(B, -0.22, 0.3, 0.22, 0.3, 0.3, -0.6, -0.15, -0.6),
    e(L, 0.05, -0.66, 0.64, 0.5),
    e(B, 0.2, -0.86, 0.34, 0.3),
    p(D, 0.3, -0.82, 0.98, -1.08, 0.92, -0.56),
    p(L, 0.5, -0.9, 0.58, -0.76, 0.66, -0.94),
    ...eyes(0.18, -0.96, 0.06, 0.2),
  ] },

  // ------------------------------------------------ region 5 · Central Africa
  'enemy.caf_mire_lunger': { anim: 'scuttle', parts: [
    p(D, 0.25, 0.2, 0.42, 0.2, 0.56, 0.6, 0.3, 0.6), p(D, -0.4, 0.2, -0.22, 0.2, -0.3, 0.62, -0.56, 0.62),
    p(B, -0.55, -0.12, -1.32, 0.16, -0.55, 0.26),
    e(B, -0.05, 0.05, 0.62, 0.27),
    p(B, 0.45, -0.12, 1.32, 0, 1.32, 0.15, 0.45, 0.28),
    p(L, -0.3, -0.17, -0.2, -0.38, -0.1, -0.19), p(L, 0, -0.2, 0.1, -0.4, 0.2, -0.19),
    eye(0.5, -0.1, 0.06),
  ] },
  'enemy.caf_mire_shade': { anim: 'bob', parts: [
    e(D, 0, 1.02, 0.96, 0.2),
    p(B, -0.35, -0.2, -0.6, -0.1, -0.76, 0.96, -0.6, 0.96),
    p(B, -0.4, 1.0, 0.3, 1.0, 0.4, -0.1, 0.1, -0.6, -0.4, -0.4),
    p(B, 0.3, -0.3, 0.65, -0.2, 0.76, 0.96, 0.6, 0.96),
    e(B, 0.25, -0.7, 0.27, 0.26),
    ...eyes(0.3, -0.72, 0.05, 0.18),
  ] },
  'enemy.caf_bloat_toad': { anim: 'pulse', parts: [
    p(D, -0.9, 0.75, -0.4, 0.6, -0.55, 1.08, -1.16, 1.08), mp(D, -0.9, 0.75, -0.4, 0.6, -0.55, 1.08, -1.16, 1.08),
    e(B, -0.4, -0.82, 0.2, 0.2), e(B, 0.4, -0.82, 0.2, 0.2),
    e(B, 0, 0.05, 0.96, 0.93),
    e(L, 0, 0.32, 0.6, 0.5),
    p(D, -0.5, -0.26, 0.5, -0.26, 0.5, -0.18, -0.5, -0.18),
    e(A, -0.4, -0.84, 0.09, 0.09), e(A, 0.4, -0.84, 0.09, 0.09),
  ] },
  'enemy.caf_mask_bearer': { anim: 'bob', parts: [
    p(D, 0.25, -0.2, 0.34, -0.2, 0.34, 1.12, 0.25, 1.12),
    p(B, -0.56, -0.1, -0.25, -0.1, -0.2, 1.12, -0.62, 1.12),
    e(B, -0.4, -0.35, 0.2, 0.2),
    p(B, -0.3, 0.1, 0.3, 0.2, 0.3, 0.33, -0.3, 0.26),
    e(L, 0.3, -0.6, 0.42, 0.64),
    e(D, 0.15, -0.76, 0.09, 0.12), e(D, 0.45, -0.76, 0.09, 0.12), e(D, 0.3, -0.3, 0.12, 0.08),
  ] },
  'enemy.caf_rot_hippo': { anim: 'bob', parts: [
    ...legs([-0.85, -0.42, 0.05, 0.42], 0.55, 1.12, 0.16),
    e(B, -0.25, 0.1, 0.9, 0.6),
    p(D, 0.5, 0, 1.28, -0.2, 1.28, 0.36, 0.45, 0.15),
    p(B, 0.4, -0.6, 1.28, -0.56, 1.28, -0.2, 0.5, 0),
    p(B, 0.45, 0.15, 1.28, 0.36, 1.28, 0.63, 0.4, 0.5),
    p(L, 1.0, 0.3, 1.1, 0.05, 1.18, 0.33), p(L, 1.0, -0.2, 1.08, 0.03, 1.18, -0.2),
    e(B, 0.35, -0.65, 0.1, 0.1),
    eye(0.62, -0.4, 0.06),
  ] },
  'enemy.caf_elder_mask': { anim: 'bob', parts: [
    p(B, -0.7, 1.12, 0.7, 1.12, 0.5, -0.1, -0.5, -0.1),
    p(D, -0.76, -0.35, 0.76, -0.35, 0.82, 0.4, 0.55, 0.25, 0.3, 0.46, 0, 0.25, -0.3, 0.46, -0.55, 0.25, -0.82, 0.4),
    p(L, -0.7, -0.95, -1.12, -1.32, -0.5, -0.95), mp(L, -0.7, -0.95, -1.12, -1.32, -0.5, -0.95),
    p(L, -0.72, -0.96, 0.72, -0.96, 0.62, -0.3, -0.62, -0.3),
    p(D, -0.42, -0.74, -0.14, -0.74, -0.14, -0.62, -0.42, -0.62), p(D, 0.14, -0.74, 0.42, -0.74, 0.42, -0.62, 0.14, -0.62),
    e(D, 0, -0.44, 0.14, 0.07),
  ] },
  'boss.caf_boss': { anim: 'bob', parts: [
    ...legs([-0.7, -0.3, 0.15, 0.5], 0.6, 1.18, 0.14),
    p(B, -0.8, 0.2, -1.32, 1.02, -1.26, 1.14, -0.6, 0.66),
    e(B, -0.1, 0.35, 0.86, 0.48),
    p(B, 0.45, 0.1, 0.86, 0.2, 1.06, -0.96, 0.8, -1.02),
    e(B, 1.06, -1.06, 0.24, 0.17),
    p(L, -0.5, -0.1, -0.38, -0.3, -0.26, -0.12), p(L, -0.1, -0.13, 0.02, -0.33, 0.14, -0.12),
    eye(1.12, -1.08, 0.05),
  ] },

  // ------------------------------------------------ region 6 · Northern Russia
  'enemy.ru_shieldbearer': { anim: 'bob', parts: [
    p(D, -0.36, 0.7, 0.1, 0.7, 0.15, 1.18, -0.46, 1.18),
    p(D, -0.5, -0.2, 0, -0.3, 0, 0.82, -0.5, 0.82),
    e(D, -0.2, -0.4, 0.22, 0.2),
    p(L, -0.44, -0.45, 0.04, -0.45, -0.2, -1.18),
    p(B, -0.06, -0.7, 0.35, -0.92, 0.76, -0.7, 0.82, -0.1, 0.38, 1.18, -0.1, -0.1),
    e(L, 0.36, -0.2, 0.14, 0.14),
  ] },
  'enemy.ru_frozen_dead': { anim: 'bob', parts: [
    ...legs([-0.1, 0.1], 0.58, 1.18, 0.09),
    p(B, -0.36, -0.4, -0.22, -0.4, -0.25, 0.42, -0.4, 0.42),
    p(B, -0.25, -0.5, 0.25, -0.5, 0.2, 0.62, -0.2, 0.62),
    e(B, 0, -0.78, 0.24, 0.26),
    p(B, 0.2, -0.4, 1.18, -0.4, 1.18, -0.24, 0.2, -0.2),
    p(L, 0.4, -0.24, 0.52, -0.24, 0.46, 0.16), p(L, 0.65, -0.24, 0.77, -0.24, 0.71, 0.32), p(L, 0.9, -0.24, 1.02, -0.24, 0.96, 0.1),
    ...eyes(0.04, -0.8, 0.05, 0.18),
  ] },
  'enemy.ru_blizzard_wraith': { anim: 'float', parts: [
    p(B, -0.5, -0.5, 0.35, -0.6, 0.5, 0, 0.2, 0.56, 0.05, 1.22, -0.15, 0.5, -0.56, 0.1),
    e(B, 0.1, -0.75, 0.3, 0.28),
    p(L, 0.3, -0.35, 1.22, -0.56, 1.28, -0.42, 0.35, -0.15), p(L, 0.3, -0.05, 1.12, 0, 1.14, 0.14, 0.3, 0.16),
    ...eyes(0.16, -0.77, 0.05, 0.19),
  ] },
  'enemy.ru_rusalka': { anim: 'bob', parts: [
    e(D, 0, 0.86, 1.02, 0.3),
    p(B, -0.3, 0.1, -0.86, 0.7, -0.7, 0.82, -0.2, 0.3), mp(B, -0.3, 0.1, -0.86, 0.7, -0.7, 0.82, -0.2, 0.3),
    p(B, -0.3, 0.86, 0.3, 0.86, 0.28, -0.2, -0.28, -0.2),
    e(B, 0, -0.5, 0.3, 0.32),
    p(D, -0.42, -0.76, 0.42, -0.76, 0.5, 0.5, 0.25, 0.1, 0.1, 0.56, -0.15, 0.1, -0.35, 0.6, -0.5, 0.3),
    eye(0.18, -0.34, 0.055),
  ] },
  'enemy.ru_leshy': { anim: 'sway', parts: [
    p(D, -0.35, -0.4, -0.9, -0.2, -1.02, 1.12, -0.8, 1.12, -0.65, 0), mp(D, -0.35, -0.4, -0.9, -0.2, -1.02, 1.12, -0.8, 1.12, -0.65, 0),
    p(L, -0.15, -0.5, -0.75, -0.9, -1.0, -1.32, -0.75, -1.06, -0.55, -1.32, -0.45, -0.96, -0.05, -0.6),
    mp(L, -0.15, -0.5, -0.75, -0.9, -1.0, -1.32, -0.75, -1.06, -0.55, -1.32, -0.45, -0.96, -0.05, -0.6),
    p(L, -0.08, -0.5, 0.08, -0.5, 0, -1.22),
    p(B, -0.36, -0.5, 0.36, -0.5, 0.46, 1.18, -0.46, 1.18),
    ...eyes(0, -0.2, 0.07, 0.28),
  ] },
  'enemy.ru_upyr': { anim: 'bob', parts: [
    p(D, -0.5, -0.3, -0.76, -1.06, -0.2, -0.55), p(D, 0.25, -0.35, 0.62, -1.02, 0, -0.55),
    p(B, -0.46, 1.12, 0.36, 1.12, 0.3, -0.2, -0.05, -0.45, -0.5, -0.2),
    e(L, -0.02, -0.72, 0.22, 0.25),
    p(B, 0.25, -0.1, 0.96, 0.1, 0.9, 0.26, 0.25, 0.1),
    p(L, 0.9, 0.1, 1.32, -0.1, 0.98, 0.18), p(L, 0.92, 0.18, 1.34, 0.2, 0.95, 0.27), p(L, 0.9, 0.24, 1.26, 0.5, 0.88, 0.33),
    ...eyes(0.02, -0.74, 0.05, 0.17),
  ] },
  'boss.ru_boss': { anim: 'float', parts: [
    p(B, -0.56, -0.4, 0.46, -0.4, 0.76, 0.7, 0.5, 1.18, 0.3, 0.8, 0.1, 1.22, -0.15, 0.8, -0.4, 1.18, -0.82, 0.7),
    p(D, -0.2, -0.3, 0.2, -0.3, 0.15, 0.32, -0.15, 0.32),
    e(L, 0, -0.72, 0.25, 0.27),
    p(L, -0.26, -0.9, -0.26, -1.22, -0.12, -1.02, 0, -1.28, 0.12, -1.02, 0.26, -1.22, 0.26, -0.9),
    p(L, 0.55, -0.75, 0.65, -0.75, 0.65, 1.0, 0.6, 1.22, 0.55, 1.0), p(L, 0.4, -0.5, 0.8, -0.5, 0.8, -0.42, 0.4, -0.42),
    e(D, -0.09, -0.74, 0.07, 0.08), e(D, 0.09, -0.74, 0.07, 0.08),
    e(A, -0.09, -0.74, 0.03, 0.035), e(A, 0.09, -0.74, 0.03, 0.035),
  ] },

  // ------------------------------------------------ region 7 · Off Indonesia
  'enemy.ind_spearfish': { anim: 'scuttle', parts: [
    p(B, -0.8, 0.1, -1.28, -0.32, -1.06, 0.1, -1.28, 0.52),
    p(L, -0.6, -0.05, -0.4, -0.88, -0.1, -0.6, 0.1, -0.82, 0.25, -0.05),
    p(D, -0.1, 0.25, 0.05, 0.62, 0.15, 0.25),
    e(B, -0.25, 0.1, 0.6, 0.2),
    p(L, 0.3, 0.04, 1.32, 0.1, 0.3, 0.18),
    eye(0.14, 0.05, 0.055),
  ] },
  'enemy.ind_tide_eel': { anim: 'slither', parts: [
    p(B, -1.16, 0.5, -0.6, 0.08, -0.1, 0.42, 0.35, -0.02, 0.8, -0.5, 0.96, -0.25, 0.45, 0.24, -0.1, 0.68, -0.6, 0.34, -1.06, 0.72),
    e(B, 0.95, -0.42, 0.26, 0.24),
    e(D, 1.08, -0.42, 0.13, 0.15),
    eye(0.88, -0.52, 0.05),
  ] },
  'enemy.ind_drowned_sentinel': { anim: 'bob', parts: [
    p(D, 0.52, -1.22, 0.6, -1.22, 0.6, 1.18, 0.52, 1.18),
    p(L, 0.6, -1.16, 0.96, -0.95, 0.6, -0.65),
    ...legs([-0.12, 0.12], 0.58, 1.18, 0.1),
    p(B, -0.3, -0.35, 0.3, -0.35, 0.28, 0.62, -0.28, 0.62),
    p(L, -0.32, -0.5, 0.32, -0.5, 0.22, -0.7, -0.22, -0.7), p(L, -0.22, -0.7, 0.22, -0.7, 0.12, -0.92, -0.12, -0.92), p(L, -0.1, -0.92, 0.1, -0.92, 0, -1.32),
    p(D, -0.2, -0.5, 0.2, -0.5, 0.2, -0.36, -0.2, -0.36),
    ...eyes(0, -0.43, 0.04, 0.16),
  ] },
  'enemy.ind_lantern_lure': { anim: 'float', parts: [
    p(D, 0.15, -0.4, 0.25, -0.45, 0.76, -1.0, 0.68, -1.06),
    p(B, -0.8, 0.2, -1.28, -0.16, -1.28, 0.62),
    e(B, -0.1, 0.2, 0.76, 0.66),
    p(D, 0.1, 0.3, 0.96, 0.1, 1.02, 0.5, 0.5, 0.76, 0.1, 0.6),
    p(L, 0.45, 0.22, 0.55, -0.06, 0.63, 0.2), p(L, 0.7, 0.16, 0.8, -0.1, 0.88, 0.13),
    e(L, 0.2, -0.05, 0.1, 0.1),
    e(A, 0.8, -1.06, 0.18, 0.18),
  ] },
  'enemy.ind_coral_colossus': { anim: 'bob', parts: [
    p(L, -0.2, -0.2, -0.5, -0.6, -1.12, -0.7, -1.22, -0.9, -0.65, -0.86, -0.85, -1.28, -0.65, -1.32, -0.4, -0.86, -0.25, -1.22, -0.1, -1.16, -0.1, -0.25),
    mp(L, -0.2, -0.2, -0.5, -0.6, -1.12, -0.7, -1.22, -0.9, -0.65, -0.86, -0.85, -1.28, -0.65, -1.32, -0.4, -0.86, -0.25, -1.22, -0.1, -1.16, -0.1, -0.25),
    p(D, -0.92, -0.1, -0.6, -0.15, -0.6, 0.82, -0.96, 0.76), mp(D, -0.92, -0.1, -0.6, -0.15, -0.6, 0.82, -0.96, 0.76),
    ...legs([-0.25, 0.25], 0.85, 1.2, 0.16),
    p(B, -0.6, -0.2, 0.6, -0.2, 0.5, 0.92, -0.5, 0.92),
    e(B, 0, -0.3, 0.2, 0.18),
    ...eyes(0, -0.32, 0.05, 0.17),
  ] },
  'enemy.ind_tide_caller': { anim: 'bob', parts: [
    p(L, -0.96, -0.6, 0.96, -0.6, 0.7, -0.96, 0, -1.12, -0.7, -0.96),
    p(B, 0.2, -0.05, 0.76, -0.46, 0.86, -0.35, 0.28, 0.1),
    p(B, -0.42, 1.12, 0.42, 1.12, 0.26, -0.15, -0.26, -0.15),
    e(B, 0, -0.38, 0.22, 0.22),
    e(L, 0.94, -0.54, 0.2, 0.17), e(D, 0.96, -0.54, 0.07, 0.06),
    ...eyes(0, -0.4, 0.05, 0.18),
  ] },
  'boss.ind_boss': { anim: 'float', parts: [
    p(D, -0.76, -0.9, -0.45, -1.16, -0.3, -0.7, 0.3, -0.76, 0.56, -1.02, 0.76, -0.5, 0.76, 0.6, -0.76, 0.6),
    p(B, -0.5, -0.3, 0.5, -0.3, 0.86, 0.75, 1.12, 0.96, 0.75, 1.12, 0.4, 0.96, 0.1, 1.18, -0.2, 0.96, -0.55, 1.18, -0.86, 0.96, -1.12, 1.06, -0.86, 0.7),
    e(L, 0.05, -0.5, 0.22, 0.24),
    p(L, -0.2, -0.68, 0.3, -0.68, 0.22, -0.9, -0.12, -0.9), p(L, -0.1, -0.9, 0.2, -0.9, 0.13, -1.1, -0.03, -1.1), p(L, -0.02, -1.1, 0.12, -1.1, 0.05, -1.32),
    ...eyes(0.07, -0.52, 0.05, 0.17),
  ] },

  // ------------------------------------------------ region 8 · Australian Outback
  'enemy.aus_thylacoleo': { anim: 'scuttle', parts: [
    p(B, -0.8, -0.05, -1.32, -0.2, -1.32, 0.05, -0.8, 0.25),
    p(D, 0.25, 0.3, 0.6, 0.3, 0.66, 1.12, 0.25, 1.12), p(D, -0.7, 0.3, -0.4, 0.3, -0.45, 1.12, -0.82, 1.12),
    e(B, -0.1, 0.1, 0.76, 0.4),
    p(B, 0.5, -0.4, 1.06, -0.36, 1.18, 0, 1.06, 0.26, 0.5, 0.3),
    p(B, 0.55, -0.4, 0.6, -0.68, 0.76, -0.4),
    eye(0.86, -0.14, 0.06),
  ] },
  'enemy.aus_dust_dingo': { anim: 'scuttle', parts: [
    p(D, 0.4, 0.1, 0.55, 0.1, 1.16, 0.76, 1.0, 0.82), p(D, 0.25, 0.15, 0.4, 0.15, 0.76, 0.92, 0.6, 0.92),
    p(D, -0.5, 0.1, -0.35, 0.1, -1.0, 0.82, -1.16, 0.76), p(D, -0.3, 0.15, -0.15, 0.15, -0.6, 0.92, -0.76, 0.92),
    e(B, -0.95, -0.15, 0.36, 0.14),
    e(B, 0, 0, 0.7, 0.22),
    p(B, 0.55, -0.25, 1.28, -0.05, 1.22, 0.1, 0.6, 0.15),
    p(B, 0.6, -0.25, 0.8, -0.62, 0.86, -0.2),
    eye(0.86, -0.1, 0.055),
  ] },
  'enemy.aus_mirage': { anim: 'float', parts: [
    p(L, -0.56, -1.0, -0.15, -1.12, -0.05, -0.3, -0.25, 0.4, -0.1, 1.12, -0.5, 1.02, -0.66, 0.3, -0.45, -0.3),
    p(B, 0.05, -0.9, 0.45, -1.02, 0.6, -0.2, 0.4, 0.5, 0.56, 1.18, 0.15, 1.06, 0, 0.35, 0.2, -0.3),
    ...eyes(0.34, -0.62, 0.05, 0.17),
  ] },
  'enemy.aus_cinder': { anim: 'pulse', parts: [
    e(L, -0.8, 0.1, 0.12, 0.12), e(L, -1.12, -0.2, 0.08, 0.08), e(L, -0.96, 0.56, 0.07, 0.07),
    p(B, -0.3, 0, 0, -1.22, 0.25, -0.4, 0.5, -0.72, 0.56, 0.1),
    e(B, 0.1, 0.3, 0.6, 0.6),
    e(L, 0.1, 0.36, 0.36, 0.37),
    e(A, 0.12, 0.4, 0.17, 0.18),
  ] },
  'enemy.aus_diprotodon': { anim: 'bob', parts: [
    ...legs([-0.78, -0.22, 0.32], 0.5, 1.14, 0.18),
    e(B, -0.3, 0, 0.86, 0.62),
    p(B, 0.3, -0.25, 1.16, -0.1, 1.28, 0.46, 0.96, 0.76, 0.3, 0.6),
    p(B, 0.4, -0.25, 0.45, -0.52, 0.62, -0.22),
    e(D, 1.16, 0.4, 0.1, 0.12),
    eye(0.76, 0.06, 0.06),
  ] },
  'enemy.aus_genyornis': { anim: 'bob', parts: [
    p(D, -0.2, 0.45, 0, 0.45, 0.05, 1.18, -0.2, 1.18), p(D, 0.1, 0.45, 0.3, 0.45, 0.4, 1.18, 0.15, 1.18),
    p(B, -0.55, -0.1, -1.02, -0.32, -0.92, 0.1),
    e(B, -0.1, 0.05, 0.56, 0.48),
    e(D, -0.25, 0, 0.3, 0.2),
    p(B, 0.1, -0.25, 0.4, -0.2, 0.5, -0.86, 0.25, -0.92),
    e(B, 0.42, -0.96, 0.22, 0.2),
    p(L, 0.55, -1.14, 1.12, -0.96, 1.06, -0.75, 0.55, -0.78),
    eye(0.44, -1.0, 0.055),
  ] },
  // Seen from above, unlike everything else in the game: a body this low has
  // no side view that fills a 56-unit hitbox, and from above the tail — longer
  // than the animal — wraps the disc the party is shooting at.
  'boss.aus_boss': { anim: 'slither', parts: [
    p(B, -0.5, -0.12, -1.02, -0.5, -1.3, 0.05, -1.12, 0.72, -0.55, 1.12, 0.2, 1.18, 0.62, 1.02, 0.15, 0.98, -0.5, 0.9, -0.92, 0.55, -1.02, 0.08, -0.85, -0.2, -0.5, 0.18),
    p(D, 0.3, -0.3, 0.5, -0.34, 0.86, -0.86, 1.06, -0.9, 0.98, -0.7, 0.72, -0.62, 0.56, -0.2),
    p(D, 0.3, 0.3, 0.5, 0.34, 0.8, 0.8, 1.0, 0.86, 0.9, 0.62, 0.68, 0.56, 0.56, 0.2),
    p(D, -0.3, -0.32, -0.5, -0.3, -0.72, -0.9, -0.52, -1.0, -0.56, -0.76, -0.4, -0.7),
    p(D, -0.28, 0.32, -0.46, 0.3, -0.62, 0.66, -0.4, 0.72),
    e(B, -0.05, 0, 0.7, 0.4),
    p(B, 0.5, -0.24, 0.92, -0.3, 1.2, -0.14, 1.3, 0, 1.2, 0.14, 0.92, 0.3, 0.5, 0.24),
    p(A, 1.26, -0.03, 1.42, -0.11, 1.35, 0, 1.42, 0.11, 1.26, 0.03),
    p(L, -0.5, 0, -0.38, -0.1, -0.26, 0, -0.38, 0.1), p(L, -0.14, 0, -0.02, -0.11, 0.1, 0, -0.02, 0.11), p(L, 0.22, 0, 0.34, -0.1, 0.46, 0, 0.34, 0.1),
    e(A, 0.98, -0.17, 0.055, 0.055), e(A, 0.98, 0.17, 0.055, 0.055),
  ] },
};

// THE EIGHT REGION NESTS (ruling R-21) share one drawing, in their own
// region's colour, until each is painted: a low mound, rooted at its foot,
// split at the crown, with a lit mouth — a place things come OUT of, where the
// Wombden is a creature. (They first borrowed the Wombden's star outright,
// and glyph_gate found it 63% the shape of Central Africa's Elder Mask.)
// Listed by sprite id rather than imported, because this module must not
// import content; glyph_gate checks the list against the content.
const NEST_GLYPH = { anim: 'pulse', parts: [
  spoke(D, 62, 0.55, 1.3, 13), spoke(D, 90, 0.6, 1.36, 12), spoke(D, 118, 0.55, 1.3, 13),
  spoke(D, 25, 0.6, 1.18, 11), spoke(D, 155, 0.6, 1.18, 11),
  e(B, 0, 0.18, 1.12, 0.74),
  spoke(L, 245, 0.45, 1.05, 16), spoke(L, 270, 0.45, 1.18, 14), spoke(L, 295, 0.45, 1.05, 16),
  e(D, 0, 0.26, 0.42, 0.3),
  e(A, 0, 0.3, 0.2, 0.13),
] };
export const NEST_GLYPHS = ['enemy.pnw_burl', 'enemy.xib_cave_mouth', 'enemy.gb_fairy_mound', 'enemy.eg_sealed_tomb', 'enemy.caf_mire_spring', 'enemy.ru_kurgan', 'enemy.ind_spawning_reef', 'enemy.aus_dingo_den'];
for (const id of NEST_GLYPHS) GLYPHS[id] = NEST_GLYPH;

// ---------------------------------------------------------------- drawing

const toneCache = new Map();
function tones(hex, accent) {
  const k = hex + '|' + (accent || '');
  let t = toneCache.get(k);
  if (t) return t;
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || '');
  const c = m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [200, 200, 200];
  const mix = (to, f) => '#' + c.map((v, i) => Math.round(v + (to[i] - v) * f).toString(16).padStart(2, '0')).join('');
  // shade toward a cold near-black and light toward a warm white, so the two
  // tones separate in value on any hue rather than merely in saturation
  t = [hex, mix([14, 14, 26], 0.5), mix([255, 250, 236], 0.46), accent || '#fff2b8'];
  toneCache.set(k, t);
  return t;
}

// Every polygon is wound the way the canvas winds an ellipse (clockwise on
// screen), once, at load. The outline, the status tint and the hit-flash are
// each laid on the WHOLE silhouette as one path, and under the canvas's
// non-zero fill rule two overlapping parts wound opposite ways would cancel
// into a hole exactly where a limb crosses the body.
for (const g of Object.values(GLYPHS)) {
  for (const part of g.parts) {
    if (part[1] !== 'p') continue;
    let area = 0;
    for (let i = 2, n = part.length; i < n; i += 2) {
      const k = i + 2 < n ? i + 2 : 2;
      area += part[i] * part[k + 1] - part[k] * part[i + 1];
    }
    if (area >= 0) continue;
    const pts = part.slice(2);
    for (let i = 0, k = pts.length - 2; i < pts.length; i += 2, k -= 2) { part[2 + i] = pts[k]; part[3 + i] = pts[k + 1]; }
  }
}

// One part as a closed subpath of the CURRENT path — no beginPath, so several
// parts can be traced into one path and painted as their union.
function sub(ctx, part, r) {
  const kind = part[1];
  if (kind === 'e') {
    const cx = part[2] * r, cy = part[3] * r, rx = part[4] * r, ry = part[5] * r, rot = part[6] || 0;
    ctx.moveTo(cx + Math.cos(rot) * rx, cy + Math.sin(rot) * rx);    // or ellipse() draws a line in from the last part
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    ctx.closePath();
  } else if (kind === 'p') {
    ctx.moveTo(part[2] * r, part[3] * r);
    for (let i = 4; i < part.length; i += 2) ctx.lineTo(part[i] * r, part[i + 1] * r);
    ctx.closePath();
  } else if (kind === 'a') {
    const cx = part[2] * r, cy = part[3] * r, rad = part[4] * r, w = part[7] * r;
    const out = rad + w / 2, inn = Math.max(0.01, rad - w / 2);
    if (part[6] - part[5] >= 360) {
      // a whole ring: two circles wound opposite ways, so the hole is a hole
      ctx.moveTo(cx + out, cy);
      ctx.arc(cx, cy, out, 0, Math.PI * 2, false);
      ctx.closePath();
      ctx.moveTo(cx + inn, cy);
      ctx.arc(cx, cy, inn, 0, Math.PI * 2, true);
      ctx.closePath();
    } else {
      const a0 = part[5] * Math.PI / 180, a1 = part[6] * Math.PI / 180;
      ctx.moveTo(cx + Math.cos(a0) * out, cy + Math.sin(a0) * out);
      ctx.arc(cx, cy, out, a0, a1, false);
      ctx.arc(cx, cy, inn, a1, a0, true);
      ctx.closePath();
    }
  }
}
// The whole silhouette as one path.
function union(ctx, g, r) {
  ctx.beginPath();
  for (const part of g.parts) sub(ctx, part, r);
}

// The whole-body motion for a frame, as one affine transform [a, b, c, d, e, f]
// in units of the radius (x' = a·x + c·y + e, y' = b·x + d·y + f). One
// transform, so a frame is one cached cell and the horde's per-frame cost does
// not depend on the art; and data rather than canvas calls, so the gate
// measures the same motion the renderer draws.
export const GLYPH_ANIMS = ['bob', 'sway', 'float', 'scuttle', 'pulse', 'slither'];
export function glyphPose(anim, frame) {
  const ph = (frame / GLYPH_FRAMES) * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
  switch (anim) {
    case 'float': return [1, 0, 0, 1, 0, s * 0.09];
    case 'sway': {                       // lean about the feet, at (0, 1)
      const q = s * 0.06, cs = Math.cos(q), sn = Math.sin(q);
      return [cs, sn, -sn, cs, sn, 1 - cs];
    }
    case 'scuttle': return [1 + c * 0.04, 0, 0, 1 - c * 0.04, 0, Math.abs(s) * -0.05];
    case 'pulse': return [1 + s * 0.05, 0, 0, 1 + s * 0.05, 0, 0];
    case 'slither': {
      const q = s * 0.05, cs = Math.cos(q), sn = Math.sin(q), tx = c * 0.04;
      return [cs, sn, -sn, cs, cs * tx, sn * tx];
    }
    default: return [1, 0, 0, 1, 0, Math.abs(s) * -0.06];      // bob
  }
}
function animate(ctx, anim, frame, r) {
  const m = glyphPose(anim, frame);
  ctx.transform(m[0], m[1], m[2], m[3], m[4] * r, m[5] * r);
}

// Which frame a body shows. Offset by id so a pack does not step in unison.
export function glyphFrame(t, id) {
  const f = ((t * GLYPH_HZ + (id || 0) * 0.37) % 1 + 1) % 1;
  return Math.floor(f * GLYPH_FRAMES) % GLYPH_FRAMES;
}

export function hasGlyph(spriteId) { return !!GLYPHS[spriteId]; }

// Draw a glyph centred on the current origin. Returns false, having drawn
// nothing, when the id has none — the caller falls back to `def.shape`.
//   color     the unit's colour            outline   the outline colour
//   lw        outline width in pixels      frame     0..GLYPH_FRAMES-1
//   dir       +1 facing right, -1 left     tint      an overlay colour
//   tintStrength 0..1                      alpha     whole-body alpha
//   flat      one colour for the whole silhouette (the white hit-flash)
//
// Three passes. The outline is stroked around every part and then buried by
// the fills, so what survives is the outline of the union. The parts are
// filled in order, later over earlier. The tint (and `flat`) is one fill of
// the union, so a body is tinted evenly — filled part by part, wherever two
// parts overlap would take the tint twice.
//
// `alpha` below 1 is only even when the caller composites a finished glyph
// (the renderer's cached cell does); drawn directly, overlapping parts show
// through each other. The renderer takes the cell whenever it can make one.
export function drawGlyph(ctx, spriteId, r, o = {}) {
  const g = GLYPHS[spriteId];
  if (!g) return false;
  const alpha = o.alpha == null ? 1 : o.alpha;
  ctx.save();
  if (o.dir < 0) ctx.scale(-1, 1);
  animate(ctx, g.anim, o.frame || 0, r);
  ctx.lineJoin = 'round';
  ctx.globalAlpha = alpha;
  if (o.flat) {
    ctx.fillStyle = o.flat;
    union(ctx, g, r);
    ctx.fill();
    ctx.restore();
    return true;
  }
  if (o.lw > 0) {
    ctx.strokeStyle = o.outline || '#101018';
    ctx.lineWidth = o.lw * 2;
    union(ctx, g, r);
    ctx.stroke();
  }
  const tn = tones(o.color || '#cccccc', g.accent);
  for (const part of g.parts) {
    ctx.fillStyle = tn[part[0]];
    ctx.beginPath();
    sub(ctx, part, r);
    ctx.fill();
  }
  if (o.tint && o.tintStrength > 0) {
    ctx.globalAlpha = alpha * o.tintStrength;
    ctx.fillStyle = o.tint;
    union(ctx, g, r);
    ctx.fill();
  }
  ctx.restore();
  return true;
}
