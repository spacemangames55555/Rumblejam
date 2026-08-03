// Turn a generator's per-direction output into the grid the renderer wants,
// and refuse to commit anything that is subtly wrong.
//
//   node tools/process_sprite.mjs <spriteId> <inputDir> [options]
//
//   --recenter=row|cell|sheet|none   default: row (see below)
//   --frames=N                       override the detected frame count
//   --fps=N                          animation rate to record in the manifest
//   --out=<path>                     default: the manifest's own file path
//   --autocrop                       crop away transparent padding first (hand-supplied art)
//   --dry-run                        report, write nothing
//   --allow-matte                    downgrade the opaque-background check to a warning
//
// Input layout — any of these, detected and reported:
//   inputDir/{0..7}.png              one file per direction, row index
//   inputDir/{e,se,s,sw,w,nw,n,ne}.png
//   inputDir/{east,south_east,...}.png
//   inputDir/<direction>/*.png       a folder per direction, frames sorted by name
// A per-direction file that is a multiple of the cell width is treated as a
// horizontal strip of frames.
//
// Row order is E SE S SW W NW N NE, fixed by patch-directional-sprites and
// documented in docs/SPRITES.md. Do not hand-assemble grids: a row-order error
// looks almost right in motion, which is exactly how it survives review.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { decodePng, encodePng, blankImage, blit, subImage, opaqueBounds } from './pngkit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'assets', 'assets.json');
const OVERRIDES = join(ROOT, 'assets', 'sprite-overrides.json');

// row index -> the names a generator might have used for it
const DIR_NAMES = [
  ['0', 'e', 'east'],
  ['1', 'se', 'south_east', 'south-east', 'southeast'],
  ['2', 's', 'south'],
  ['3', 'sw', 'south_west', 'south-west', 'southwest'],
  ['4', 'w', 'west'],
  ['5', 'nw', 'north_west', 'north-west', 'northwest'],
  ['6', 'n', 'north'],
  ['7', 'ne', 'north_east', 'north-east', 'northeast'],
];
const ROW_LABEL = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--'))
  .map(a => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : v]; }));
const [spriteId, inputDir] = args.filter(a => !a.startsWith('--'));

const die = msg => { console.error(`✗ ${msg}`); process.exit(1); };

if (!spriteId || !inputDir) die('usage: node tools/process_sprite.mjs <spriteId> <inputDir> [--recenter=row] [--dry-run]');

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const spec = manifest.sprites[spriteId];
if (!spec) die(`"${spriteId}" is not in assets/assets.json — the manifest is the art inventory, so an id not in it is a typo`);

const cellW = spec.w, cellH = spec.h;
const directions = spec.directions > 1 ? spec.directions : 1;
const anchor = spec.anchor === 'bottom' ? 'bottom' : 'center';
const recenter = flags.recenter || 'row';
if (!['row', 'cell', 'sheet', 'none'].includes(recenter)) die(`--recenter=${recenter} is not one of row|cell|sheet|none`);

// ---------------- 1. gather the source frames, per direction ----------------

const listPngs = d => readdirSync(d).filter(f => /\.png$/i.test(f)).sort();

// Row index -> compass index. The 8 compass points are fixed, but a sheet with
// fewer directions samples them evenly: directions:4 is rows E S W N, which is
// compass 0, 2, 4, 6 — NOT 0, 1, 2, 3. Getting this wrong files a south view
// into the south-east row and the error is invisible until something walks.
const compassFor = rowIdx => rowIdx * (8 / directions);

function loadFramesFor(rowIdx) {
  const names = DIR_NAMES[compassFor(rowIdx)] || [String(rowIdx)];
  // a folder per direction
  for (const n of names) {
    const sub = join(inputDir, n);
    if (existsSync(sub) && statSync(sub).isDirectory()) {
      const files = listPngs(sub);
      if (!files.length) die(`${sub} has no PNGs`);
      return { how: `folder ${n}/`, images: files.map(f => decodePng(readFileSync(join(sub, f)))) };
    }
  }
  // a single file per direction, possibly a horizontal strip
  for (const n of names) {
    const f = join(inputDir, `${n}.png`);
    if (existsSync(f)) {
      const img = decodePng(readFileSync(f));
      if (img.width % cellW === 0 && img.width > cellW) {
        const n2 = img.width / cellW;
        const images = [];
        for (let k = 0; k < n2; k++) {
          const cut = blankImage(cellW, img.height);
          blit(cut, img, k * cellW, 0, cellW, img.height, 0, 0);
          images.push(cut);
        }
        return { how: `${n}.png (strip of ${n2})`, images };
      }
      return { how: `${n}.png`, images: [img] };
    }
  }
  return null;
}

if (!existsSync(inputDir)) die(`input directory ${inputDir} does not exist`);

const rows = [];
for (let d = 0; d < directions; d++) {
  const got = loadFramesFor(d);
  if (!got) {
    const tried = (DIR_NAMES[compassFor(d)] || []).join(', ');
    die(`no source found for row ${d} (${ROW_LABEL[compassFor(d)] || d}) — looked for: ${tried}`);
  }
  rows.push(got);
}

const frameCounts = [...new Set(rows.map(r => r.images.length))];
if (frameCounts.length > 1) {
  die(`directions disagree on frame count (${rows.map((r, i) => `${ROW_LABEL[compassFor(i)] || i}:${r.images.length}`).join(' ')}) — every direction must animate over the same number of frames`);
}
const frames = flags.frames ? Number(flags.frames) : frameCounts[0];
if (!(frames > 0)) die(`bad frame count ${frames}`);
if (flags.frames && Number(flags.frames) !== frameCounts[0]) {
  console.warn(`! --frames=${frames} overrides the ${frameCounts[0]} found on disk`);
}

console.log(`${spriteId}: ${directions} direction(s) x ${frames} frame(s), cell ${cellW}x${cellH}, anchor ${anchor}`);
for (let d = 0; d < directions; d++) console.log(`    row ${d} ${(ROW_LABEL[compassFor(d)] || '').padEnd(2)} <- ${rows[d].how}`);

// --autocrop. The renderer scales the whole SHEET to twice the entity radius,
// so transparent padding is not free: a figure occupying a third of its canvas
// renders at a third the size of everything else. Cropping to the union of all
// content, before anything else, makes a hand-supplied canvas behave like a
// generated one. The union is used rather than a per-image box so the figures
// stay in register with each other.
if (flags.autocrop) {
  let u = null;
  for (const r of rows) {
    for (const img of r.images) {
      const b = opaqueBounds(img);
      if (!b) continue;
      if (!u) { u = { ...b }; continue; }
      const x2 = Math.max(u.x + u.w, b.x + b.w), y2 = Math.max(u.y + u.h, b.y + b.h);
      u.x = Math.min(u.x, b.x); u.y = Math.min(u.y, b.y); u.w = x2 - u.x; u.h = y2 - u.y;
    }
  }
  if (!u) die('--autocrop: every source is fully transparent');
  const before = `${rows[0].images[0].width}x${rows[0].images[0].height}`;
  for (const r of rows) r.images = r.images.map(img => subImage(img, u.x, u.y, u.w, u.h));
  console.log(`  autocrop: ${before} -> ${u.w}x${u.h} (union of all content)`);
}

for (let d = 0; d < directions; d++) {
  for (const img of rows[d].images) {
    if (img.width > cellW || img.height > cellH) {
      die(`row ${ROW_LABEL[compassFor(d)] || d} has a ${img.width}x${img.height} source but the cell is ${cellW}x${cellH} — regenerate at the cell size, or pass --autocrop if it is mostly transparent padding`);
    }
  }
}

// ---------------- 2/3. assemble, trimming and re-centring ----------------
//
// Why `row` is the default rather than the literal per-cell trim: a walk cycle
// legitimately moves the body up and down, and re-centring every cell
// independently flattens that motion out. Padding inconsistency, the thing the
// trim exists to fix, comes from directions being generated separately — so
// normalise per direction, using the union of that row's frames, and the
// animation inside a row keeps its own movement.

function boundsOf(img) { return opaqueBounds(img); }
function unionBounds(list) {
  let u = null;
  for (const b of list) {
    if (!b) continue;
    if (!u) { u = { ...b }; continue; }
    const x2 = Math.max(u.x + u.w, b.x + b.w), y2 = Math.max(u.y + u.h, b.y + b.h);
    u.x = Math.min(u.x, b.x); u.y = Math.min(u.y, b.y);
    u.w = x2 - u.x; u.h = y2 - u.y;
  }
  return u;
}

const rowBounds = rows.map(r => r.images.map(boundsOf));
const sheetBB = unionBounds(rowBounds.flat());

function offsetFor(bb) {
  if (!bb) return { dx: 0, dy: 0 };
  const dx = Math.round((cellW - bb.w) / 2) - bb.x;
  const dy = anchor === 'bottom' ? cellH - (bb.y + bb.h) : Math.round((cellH - bb.h) / 2) - bb.y;
  return { dx, dy };
}

const grid = blankImage(cellW * frames, cellH * directions);
let shifted = 0;
for (let d = 0; d < directions; d++) {
  const rowBB = unionBounds(rowBounds[d]);
  for (let f = 0; f < frames; f++) {
    const img = rows[d].images[Math.min(f, rows[d].images.length - 1)];
    let off = { dx: 0, dy: 0 };
    if (recenter === 'row') off = offsetFor(rowBB);
    else if (recenter === 'cell') off = offsetFor(rowBounds[d][f]);
    else if (recenter === 'sheet') off = offsetFor(sheetBB);
    else off = { dx: Math.round((cellW - img.width) / 2), dy: Math.round((cellH - img.height) / 2) };
    if (off.dx || off.dy) shifted++;
    blit(grid, img, 0, 0, img.width, img.height, f * cellW + off.dx, d * cellH + off.dy);
  }
}
console.log(`  assembled ${grid.width}x${grid.height} (${recenter} re-centring; ${shifted}/${directions * frames} cells shifted)`);

// ---------------- 2. verify the dimensions the loader will demand ----------

const wantW = cellW * frames, wantH = cellH * directions;
if (grid.width !== wantW || grid.height !== wantH) die(`assembled ${grid.width}x${grid.height}, manifest wants ${wantW}x${wantH}`);

// ---------------- 4. true transparency, not a baked matte ----------------

let transparent = 0, opaque = 0;
for (let i = 3; i < grid.data.length; i += 4) (grid.data[i] < 255 ? transparent++ : opaque++);
if (transparent === 0) {
  const msg = `${spriteId}: not one transparent pixel — the background was baked in. `
    + 'A near-black matte is invisible on a dark arena floor in review and obvious in play.';
  if (flags['allow-matte']) console.warn(`! ${msg}`);
  else die(`${msg}\n  Re-export with a real alpha channel, or pass --allow-matte if you are certain.`);
}
// a border ring that is almost entirely opaque is the same problem, cell by cell
const matted = [];
for (let d = 0; d < directions; d++) {
  for (let f = 0; f < frames; f++) {
    let ring = 0, ringOpaque = 0;
    const colors = new Map();
    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cellW; x++) {
        if (x !== 0 && y !== 0 && x !== cellW - 1 && y !== cellH - 1) continue;
        const i = ((d * cellH + y) * grid.width + (f * cellW + x)) * 4;
        ring++;
        if (grid.data[i + 3] === 255) {
          ringOpaque++;
          const key = `${grid.data[i]},${grid.data[i + 1]},${grid.data[i + 2]}`;
          colors.set(key, (colors.get(key) || 0) + 1);
        }
      }
    }
    if (ringOpaque / ring > 0.9) {
      const [color] = [...colors.entries()].sort((a, b) => b[1] - a[1])[0] || ['?'];
      matted.push(`${ROW_LABEL[compassFor(d)] || d}/f${f} rgb(${color})`);
    }
  }
}
if (matted.length) console.warn(`! ${matted.length} cell(s) have an almost fully opaque border — likely a matte: ${matted.slice(0, 4).join(', ')}`);
else console.log(`  transparency: ${transparent} transparent px, no matted cells`);

const bb = opaqueBounds(grid);
if (bb) {
  const fill = ((bb.w / grid.width) * 100).toFixed(0);
  console.log(`  content fills ${fill}% of the sheet width (bbox ${bb.w}x${bb.h})`);
}

// ---------------- 5. write, and record frames/fps in the manifest ----------

const outPath = flags.out ? resolve(flags.out) : join(ROOT, manifest.basePath, spec.file);

if (flags['dry-run']) {
  console.log(`  --dry-run: would write ${outPath}`);
  process.exit(0);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, encodePng(grid));
console.log(`✓ wrote ${outPath}`);

// --out means "render this somewhere else" — a comparison, a scratch check, a
// look at what a different --recenter does. That is not the shipped asset, so
// it must not rewrite the shipped manifest.
if (flags.out) {
  console.log('  (--out given: manifest not touched — re-run without it to record this as the asset)');
  process.exit(0);
}

// assets.json is GENERATED, so anything hand-written into it is lost on the
// next regeneration. Per-sprite deviations from the category default live in
// this side file, which the generator merges.
const over = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, 'utf8')) : {};
// Only touch the keys this tool OWNS. It used to delete the whole entry when it
// had nothing of its own to record, which silently destroyed a hand-set w/h or
// directions override and dropped the sprite back to its category defaults —
// where the loader then rejected the file for being the wrong size.
const mine = { ...(over[spriteId] || {}) };
if (frames > 1) mine.frames = frames; else delete mine.frames;
if (flags.fps) mine.fps = Number(flags.fps);
if (Object.keys(mine).length) over[spriteId] = mine;
else delete over[spriteId];
writeFileSync(OVERRIDES, JSON.stringify(Object.fromEntries(Object.keys(over).sort().map(k => [k, over[k]])), null, 2) + '\n');

try {
  execFileSync(process.execPath, [join(ROOT, 'tools', 'gen_assets_manifest.mjs')], { stdio: 'pipe' });
  console.log('✓ manifest regenerated');
} catch (err) {
  die(`manifest regeneration failed: ${err.message}`);
}
