// The per-batch acceptance gate for art. Run it before a batch PR; run it in
// CI if there ever is one.
//
//   node tools/verify_art_batch.mjs                 # everything on disk
//   node tools/verify_art_batch.mjs char            # one namespace
//   node tools/verify_art_batch.mjs char.pulsar ... # named ids
//   node tools/verify_art_batch.mjs char --require-all   # also fail on ids with no art yet
//   node tools/verify_art_batch.mjs --diff-base=main    # assert the batch touched art only
//
// Checks, per file present on disk:
//   1. it decodes at all
//   2. its dimensions are EXACTLY w*frames x h*directions — the same rule the
//      loader applies at runtime, caught here where the message can name the
//      file and the expected size
//   3. it has real transparency, not a baked matte
//   4. no cell is entirely empty (a blank row is how a mis-assembled grid hides)
//
// And across the run: which ids in the namespace still have no art, so "batch
// 1 is done" is a number rather than a feeling.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decodePng, opaqueBounds } from './pngkit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'assets', 'assets.json'), 'utf8'));

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--'))
  .map(a => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : v]; }));
const selectors = args.filter(a => !a.startsWith('--'));

const ids = Object.keys(manifest.sprites).filter(id => {
  if (!selectors.length) return true;
  return selectors.some(s => id === s || id.startsWith(`${s}.`));
});
if (!ids.length) { console.error(`✗ nothing matches ${selectors.join(' ')}`); process.exit(1); }

// ---------------- the value gate ----------------
//
// Two of the four anchor candidates failed review for the same reason: the body
// sat too close in value to the arena floor, so at 36 css px they were dark
// blobs. One of them had a brilliant accent, which is precisely how a sprite
// passes a naive brightness check and still vanishes in play — the accent
// carries the average and the body carries none of it.
//
// So the brightest pixels are EXCLUDED before the body is measured. What is
// left has to clear the floor colour by a margin.
const FLOOR_RGB = [0x14, 0x16, 0x1f];             // PALETTE.bg, the arena floor
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
export const FLOOR_LUMA = luma(...FLOOR_RGB);      // ~21
const ACCENT_FRACTION = 0.25;                      // brightest quarter is "accent"
// Calibrated on candidate B, the known-good reference: its non-accent body
// measures ~96, about 75 above the floor. The threshold sits well below that so
// a darker-but-still-readable design is not rejected, and comfortably above the
// candidates that failed review (A ~38, C ~46).
const MIN_CONTRAST = 45;
const MIN_BODY_LUMA = FLOOR_LUMA + MIN_CONTRAST;
const MIN_FACING_RATIO = 0.85;

function bodyValue(img, spec) {
  const lums = [];
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 128) continue;
    lums.push(luma(img.data[i], img.data[i + 1], img.data[i + 2]));
  }
  if (!lums.length) return { bodyLuma: 0, bodyPx: 0, accentFrac: 0 };
  lums.sort((a, b) => a - b);
  const keep = Math.max(1, Math.floor(lums.length * (1 - ACCENT_FRACTION)));
  const body = lums.slice(0, keep);
  return {
    bodyLuma: body.reduce((s, v) => s + v, 0) / body.length,
    bodyPx: body.length,
    accentFrac: ACCENT_FRACTION,
  };
}

// Mean per-pixel difference between two cells, counting a pixel present in one
// and absent in the other as maximally different.
function cellDiff(img, w, h, rowA, rowB) {
  let n = 0, s = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = ((rowA * h + y) * img.width + x) * 4;
      const b = ((rowB * h + y) * img.width + x) * 4;
      const oa = img.data[a + 3] > 0, ob = img.data[b + 3] > 0;
      if (!oa && !ob) continue;
      n++;
      if (oa !== ob) { s += 255; continue; }
      s += (Math.abs(img.data[a] - img.data[b]) + Math.abs(img.data[a + 1] - img.data[b + 1])
        + Math.abs(img.data[a + 2] - img.data[b + 2])) / 3;
    }
  }
  return n ? s / n : 0;
}

function facingSeparation(img, spec) {
  const w = spec.w, h = spec.h;
  const opp = [[0, 4], [1, 5], [2, 6], [3, 7]];
  const adj = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]];
  const avg = p => p.reduce((s, [a, b]) => s + cellDiff(img, w, h, a, b), 0) / p.length;
  const opposite = avg(opp), adjacent = avg(adj);
  return { opposite, adjacent, ratio: adjacent ? opposite / adjacent : 0 };
}

let failures = 0, present = 0, bytes = 0, decoded = 0;
const fail = m => { failures++; console.error(`✗ ${m}`); };
const missing = [];

for (const id of ids) {
  const spec = manifest.sprites[id];
  const file = join(ROOT, manifest.basePath, spec.file);
  if (!existsSync(file)) { missing.push(id); continue; }
  present++;
  bytes += statSync(file).size;

  const frames = spec.frames > 0 ? spec.frames : 1;
  const directions = spec.directions > 1 ? spec.directions : 1;
  const wantW = spec.w * frames, wantH = spec.h * directions;

  let img;
  try { img = decodePng(readFileSync(file)); }
  catch (err) { fail(`${id}: ${spec.file} will not decode — ${err.message}`); continue; }

  decoded += img.width * img.height * 4;

  if (img.width !== wantW || img.height !== wantH) {
    fail(`${id}: ${spec.file} is ${img.width}x${img.height}, manifest wants ${wantW}x${wantH} `
      + `(${frames} frame(s) across x ${directions} direction(s) down) — the loader will reject this and fall back`);
    continue;
  }

  let transparent = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 255) transparent++;
  if (!transparent) fail(`${id}: no transparent pixels — the background is baked in`);

  const blank = [];
  for (let d = 0; d < directions; d++) {
    for (let f = 0; f < frames; f++) {
      if (!opaqueBounds(img, f * spec.w, d * spec.h, spec.w, spec.h)) blank.push(`r${d}f${f}`);
    }
  }
  if (blank.length) fail(`${id}: ${blank.length} empty cell(s) (${blank.slice(0, 6).join(' ')}) — a mis-assembled grid usually shows up as a blank row`);

  // ---- value gate ----
  const v = bodyValue(img, spec);
  if (v.bodyPx < 8) fail(`${id}: only ${v.bodyPx} non-accent body pixel(s) — nothing to read as a shape`);
  else if (v.bodyLuma < MIN_BODY_LUMA) {
    fail(`${id}: body luminance ${v.bodyLuma.toFixed(0)} vs floor ${FLOOR_LUMA.toFixed(0)} — needs ${MIN_BODY_LUMA.toFixed(0)} `
      + `(contrast ${(v.bodyLuma - FLOOR_LUMA).toFixed(0)}, need ${MIN_CONTRAST}). `
      + `The brightest ${(v.accentFrac * 100).toFixed(0)}% was excluded as accent: a bright accent must not mask a dark body, `
      + 'which is exactly how a sprite passes review and disappears in play.');
  }

  // ---- facing separation ----
  // Eight rows that are not eight distinct drawings is the failure that looks
  // almost right in motion. Opposite facings (front/back) must differ MORE than
  // neighbouring ones; when a rotation collapses, they differ less.
  if (directions === 8 && frames >= 1) {
    const sep = facingSeparation(img, spec);
    if (sep.ratio < MIN_FACING_RATIO) {
      fail(`${id}: opposite facings differ by ${sep.opposite.toFixed(0)} but neighbours by ${sep.adjacent.toFixed(0)} `
        + `(ratio ${sep.ratio.toFixed(2)}, need ${MIN_FACING_RATIO}) — front and back are near-duplicates, so this is not really eight facings. `
        + 'Rotate in 45-degree hops rather than one turn from the base view.');
    }
  }
}

// ---- coverage ----
const byNs = {};
for (const id of ids) {
  const ns = id.slice(0, id.indexOf('.'));
  byNs[ns] = byNs[ns] || { total: 0, have: 0 };
  byNs[ns].total++;
  if (!missing.includes(id)) byNs[ns].have++;
}
console.log(`checked ${ids.length} id(s): ${present} with art, ${missing.length} still to draw`);
for (const ns of Object.keys(byNs).sort()) {
  const { total, have } = byNs[ns];
  console.log(`  ${ns.padEnd(6)} ${String(have).padStart(3)}/${total}`);
}
if (present) {
  console.log(`  on disk ${(bytes / 1024).toFixed(0)} KB, decoded ${(decoded / 1048576).toFixed(2)} MB in memory`);
}
if (flags['require-all'] && missing.length) {
  fail(`${missing.length} id(s) have no art: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}`);
}

// ---- acceptance 4: an art batch touches art only ----
if (flags['diff-base']) {
  const base = flags['diff-base'];
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: ROOT, encoding: 'utf8' });
    const changed = out.split('\n').filter(Boolean);
    const strays = changed.filter(f => !/^assets\//.test(f) && !/^docs\//.test(f));
    if (strays.length) fail(`an art batch should touch assets/ and docs/ only, but also changed: ${strays.join(', ')}`);
    else console.log(`✓ diff vs ${base} touches ${changed.length} path(s), all under assets/ or docs/ — no simulation change`);
  } catch (err) {
    fail(`could not diff against ${base}: ${err.message}`);
  }
}

console.log(failures ? `\n${failures} PROBLEM(S)` : '\nART BATCH OK');
process.exit(failures ? 1 : 0);
