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
