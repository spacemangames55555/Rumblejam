// Does a biome's config tell the truth about its own art, and does the roster
// read against it?
//
//   node tools/readability_check.mjs [biomeId]
//
// TWO OUTPUTS, and they answer different questions:
//
//   1. A number the machine can check. Mean luminance of the loaded tile set,
//      against the biome's configured `groundValue`, tolerance +/-0.05. A
//      config that lies about its own art is worse than no config, because
//      every later value decision — enemy palettes, telegraph colours, the
//      next biome's contrast budget — is taken against that number.
//
//   2. A picture only a person can judge. Every character sheet's S-facing
//      idle frame composited over a real tile, written to a gitignored scratch
//      path. Whether the roster READS is not a number, and it is not this
//      script's call.
//
// THIS IS A CHECK, NOT A GATE. It reports and exits 0 even when the luminance
// is out of tolerance. It is deliberately not wired into either suite: the
// aesthetic gates were retired because they blocked good art over arithmetic,
// and reintroducing one for tiles would be the same mistake with a new subject.
// Judgement stays with Casey, from the contact sheet.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decodePng, encodePng, blankImage, blit, subImage } from './pngkit.mjs';
import { BIOMES, tileSpriteIds, tileFile } from '../js/biomes.js';
import { ALL_CHARS } from '../js/content/characters.js';
import { DIRECTION_ROWS_8 } from '../js/assets.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'docs/art-review/scratch');
const TOL = 0.05;

const biomeId = process.argv[2] || 'tundra';
const B = BIOMES[biomeId];
if (!B) { console.error(`no biome "${biomeId}" — have: ${Object.keys(BIOMES).join(', ')}`); process.exit(1); }

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// ---------------- 1. the number ----------------

console.log(`${B.id} — configured groundValue ${B.groundValue.toFixed(2)}, tolerance +/-${TOL}\n`);

const tiles = [];
let missing = 0;
for (let i = 0; i < B.variants; i++) {
  const rel = tileFile(B, i);
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) { console.log(`  ${rel.padEnd(34)} MISSING`); missing++; continue; }
  let img;
  try { img = decodePng(readFileSync(abs)); }
  catch (err) { console.log(`  ${rel.padEnd(34)} UNDECODABLE — ${err.message}`); missing++; continue; }
  // the structural checks the browser loader also runs, run here so a bad tile
  // is caught before anyone opens the game
  if (img.width !== 64 || img.height !== 64) { console.log(`  ${rel.padEnd(34)} WRONG SIZE ${img.width}x${img.height}, want 64x64`); missing++; continue; }
  let sum = 0, n = 0, opaque = 0;
  for (let o = 0; o < img.data.length; o += 4) {
    if (img.data[o + 3] === 0) continue;
    opaque++;
    sum += lum(img.data[o], img.data[o + 1], img.data[o + 2]); n++;
  }
  if (!opaque) { console.log(`  ${rel.padEnd(34)} FULLY TRANSPARENT`); missing++; continue; }
  const mean = sum / n;
  tiles.push({ rel, img, mean });
  console.log(`  ${rel.padEnd(34)} mean ${mean.toFixed(3)}`);
}

if (!tiles.length) {
  console.log(`\nno loadable tiles for ${B.id} — nothing to check, and the game draws the flat ${B.fallbackFill} floor`);
  process.exit(0);
}

const setMean = tiles.reduce((a, t) => a + t.mean, 0) / tiles.length;
const delta = setMean - B.groundValue;
const spread = Math.max(...tiles.map(t => t.mean)) - Math.min(...tiles.map(t => t.mean));
console.log(`\nset mean ${setMean.toFixed(3)} vs configured ${B.groundValue.toFixed(2)} — delta ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`);
if (Math.abs(delta) <= TOL) console.log(`  OK: the config describes the art it points at`);
else console.log(`  OUT OF TOLERANCE: set groundValue to ${setMean.toFixed(2)} in js/biomes.js, or re-value the tiles`);
console.log(`variant spread ${spread.toFixed(3)} — tiles should read as one surface; a large spread is a checkerboard`);
if (missing) console.log(`${missing} of ${B.variants} variant(s) unusable — the renderer draws the ones it has`);

// ---------------- 2. the picture ----------------
//
// Every character's S-facing idle over a real tile. S is row 2 of the eight
// direction rows and it is the frame a unit shows before it has ever moved —
// what you actually see when you look at a stationary roster.

const S_ROW = DIRECTION_ROWS_8.indexOf('S');
const man = JSON.parse(readFileSync(join(ROOT, 'assets/assets.json'), 'utf8'));
const CELL = 96, PAD = 6, COLS = 8;

const shots = [];
for (const c of ALL_CHARS) {
  const spec = man.sprites[c.spriteId];
  if (!spec) continue;
  const abs = join(ROOT, spec.file.startsWith('assets/') ? spec.file : man.basePath + spec.file);
  if (!existsSync(abs)) continue;
  let sheet;
  try { sheet = decodePng(readFileSync(abs)); } catch { continue; }
  const cw = spec.w, ch = spec.h;
  if (sheet.width < cw || sheet.height < ch * (S_ROW + 1)) continue;
  shots.push({ id: c.id, cell: subImage(sheet, 0, S_ROW * ch, cw, ch) });
}

if (!shots.length) {
  console.log('\nno character sheets on disk yet — no contact sheet to write');
  process.exit(0);
}

const rows = Math.ceil(shots.length / COLS);
const W = COLS * (CELL + PAD) + PAD, H = rows * (CELL + PAD) + PAD;
const sheetImg = blankImage(W, H);
// ground first: the same tiles, at the same 1 tile = 1 grid cell relationship
for (let y = 0; y < H; y += 64) {
  for (let x = 0; x < W; x += 64) {
    const t = tiles[((x / 64) * 3 + (y / 64) * 7) % tiles.length];
    blit(sheetImg, t.img, 0, 0, Math.min(64, W - x), Math.min(64, H - y), x, y);
  }
}
// then the roster, each cell centred in its slot, alpha-composited
shots.forEach((s, i) => {
  const cx = PAD + (i % COLS) * (CELL + PAD) + Math.round((CELL - s.cell.width) / 2);
  const cy = PAD + Math.floor(i / COLS) * (CELL + PAD) + Math.round((CELL - s.cell.height) / 2);
  for (let y = 0; y < s.cell.height; y++) {
    for (let x = 0; x < s.cell.width; x++) {
      const so = (y * s.cell.width + x) * 4;
      const a = s.cell.data[so + 3] / 255;
      if (a === 0) continue;
      const dx = cx + x, dy = cy + y;
      if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
      const doff = (dy * W + dx) * 4;
      for (let k = 0; k < 3; k++) {
        sheetImg.data[doff + k] = Math.round(s.cell.data[so + k] * a + sheetImg.data[doff + k] * (1 - a));
      }
      sheetImg.data[doff + 3] = 255;
    }
  }
});

mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, `${B.id}-readability.png`);
writeFileSync(outPath, encodePng(sheetImg));
console.log(`\ncontact sheet: ${outPath.replace(ROOT + '/', '')} — ${shots.length} characters, S-facing idle, over real ${B.id} tiles`);
console.log('  gitignored on purpose: it is a review artifact, regenerated from the art, not a source of truth');
console.log('  the verdict on whether the roster reads is Casey\'s, from this image, not this script\'s');
