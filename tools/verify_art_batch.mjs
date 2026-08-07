// The per-batch acceptance gate for art. Run it before a batch PR; run it in
// CI if there ever is one.
//
//   node tools/verify_art_batch.mjs                 # everything on disk
//   node tools/verify_art_batch.mjs char            # one namespace
//   node tools/verify_art_batch.mjs char.toh_assassin ... # named ids
//   node tools/verify_art_batch.mjs char --require-all   # also fail on ids with no art yet
//   node tools/verify_art_batch.mjs --diff-base=main    # assert the batch touched art only
//
// THIS GATE CHECKS STRUCTURE, NOT TASTE. Every check below is a thing that is
// either true of the file or not, with no judgement in it:
//
//   1. it decodes at all
//   2. its dimensions are EXACTLY w*frames x h*directions — the same rule the
//      loader applies at runtime, caught here where the message can name the
//      file and the expected size
//   3. it has real transparency, not a baked matte
//   4. no cell is entirely empty (a blank row is how a mis-assembled grid hides)
//   5. it declares measured `content`, without which it is sized by its padding
//   6. facing separation, for 8-direction sheets — a collapsed rotation is a
//      broken sheet, not an unattractive one
//
// The aesthetic bands that used to live here — body contrast, accent spread,
// body saturation — were RETIRED on 2026-08-04. See docs/SPRITES.md,
// "Why there are no aesthetic gates". Short version: they were calibrated on an
// art direction the project abandoned, they disagreed with each other once
// there was more than one character to compare, the contrast axis was
// measurably wrong (signed, so it inverted on lighter floors), and they were
// least reliable at exactly the size the art is actually seen. Thirteen
// consecutive waivers is not a gate. Do not re-add them without reading that
// section first.
//
// Consistency judgement lives in the contact sheet
// (docs/art-review/batch1/00-toh-installed.png), which is where it was actually
// happening the whole time.
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
// Sheets knowingly installed with unusual facing separation. That is now the
// ONLY waivable check — never a structural failure.
const EXC_PATH = join(ROOT, 'assets', 'gate-exceptions.json');
const exceptions = existsSync(EXC_PATH) ? JSON.parse(readFileSync(EXC_PATH, 'utf8')) : {};
const excepted = id => id !== '_' && typeof exceptions[id] === 'string';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--'))
  .map(a => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : v]; }));
const selectors = args.filter(a => !a.startsWith('--'));

const ids = Object.keys(manifest.sprites).filter(id => {
  if (!selectors.length) return true;
  return selectors.some(s => id === s || id.startsWith(`${s}.`));
});
if (!ids.length) { console.error(`✗ nothing matches ${selectors.join(' ')}`); process.exit(1); }

// ---------------- structural helpers ----------------
//
// No luminance, saturation or contrast maths lives here any more. What remains
// measures whether the FILE is well formed, which is a question with an answer.

// Eight rows that are not eight distinct drawings. Calibrated on the chained-
// rotation experiment, not on any art direction — a single-hop rotation
// measured 0.55 and a chained one 1.03, so this band separates a working method
// from a broken one and does not express a preference about how art looks. It
// survives the retirement of the aesthetic bands for that reason.
const MIN_FACING_RATIO = 0.85;

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

let failures = 0, present = 0, bytes = 0, decoded = 0, waived = 0;
const fail = m => { failures++; console.error(`✗ ${m}`); };
const missing = [];
// The ONE remaining waivable check is facing separation, for a sheet whose
// eight facings are genuinely unusual. Reported in full, with its numbers, and
// does not fail the run. Everything else here is structural and never waivable.
const judge = (id, m) => {
  if (excepted(id)) { waived++; console.warn(`! ${m}`); }
  else fail(m);
};

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

  // ---- content must be declared and must match the file ----
  // Without `content` the loader normalises on the CELL, so the sprite's
  // apparent size is decided by how its PNG happened to be padded. That is
  // silent: it looks like a character who is a bit wrong next to the others.
  if (!Array.isArray(spec.content)) {
    fail(`${id}: no "content" — the loader will normalise on the cell, so this sprite's size depends on its padding. `
      + `Run: node tools/process_sprite.mjs --record-content ${id}`);
  } else {
    // and it must be the truth about the file, not a number typed once and
    // left behind when the art was replaced
    let bw = 0, bh = 0;
    for (let d = 0; d < directions; d++) {
      for (let f = 0; f < frames; f++) {
        const b = opaqueBounds(img, f * spec.w, d * spec.h, spec.w, spec.h);
        if (b) { bw = Math.max(bw, b.w); bh = Math.max(bh, b.h); }
      }
    }
    if (bw !== spec.content[0] || bh !== spec.content[1]) {
      fail(`${id}: declares content [${spec.content}] but the file measures [${bw}, ${bh}] — stale after an art change. `
        + `Run: node tools/process_sprite.mjs --record-content ${id}`);
    }
  }

  // ---- facing separation ----
  // Eight rows that are not eight distinct drawings is the failure that looks
  // almost right in motion. Opposite facings (front/back) must differ MORE than
  // neighbouring ones; when a rotation collapses, they differ less.
  if (directions === 8 && frames >= 1) {
    const sep = facingSeparation(img, spec);
    if (sep.ratio < MIN_FACING_RATIO) {
      judge(id, `${id}: opposite facings differ by ${sep.opposite.toFixed(0)} but neighbours by ${sep.adjacent.toFixed(0)} `
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

if (waived) console.log(`\n${waived} facing-separation failure(s) waived by assets/gate-exceptions.json — reported above, not enforced`);
console.log(failures ? `\n${failures} PROBLEM(S)` : '\nART BATCH OK');
process.exit(failures ? 1 : 0);
