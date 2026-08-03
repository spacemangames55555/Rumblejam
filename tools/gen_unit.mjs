// Generate one unit's eight facings, ready for tools/process_sprite.mjs.
//
//   export PIXELLAB_API_KEY=...
//   node tools/gen_unit.mjs char.pulsar --out=/tmp/pulsar
//   node tools/process_sprite.mjs char.pulsar /tmp/pulsar
//
//   --out=DIR        where to write the per-direction PNGs (required)
//   --style=FILE     an approved sheet to use as the style reference. Switches
//                    to bitforge and is how every unit after the anchor is kept
//                    consistent.
//   --style-strength=N   0-100, default 50
//   --seed=N         determinism knob, recorded so a run can be reproduced
//   --view=V         side | low top-down | high top-down (default: low top-down)
//   --prompt="..."   override the assembled prompt entirely
//   --base=DIR       reuse an already-generated south view from DIR instead of
//                    paying for it again (useful when only the rotations failed)
//
// How directions are actually made: this API has no n_directions parameter.
// One base view is generated, then /rotate turns it to each of the other seven,
// conditioned on that base image — which is what keeps a character recognisably
// the same unit from every angle. The base is SOUTH, because south is the
// facing a unit shows before it has ever moved (docs/SPRITES.md) and therefore
// the one a reviewer sees most.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { post, balance, b64, fromB64, ROW_DIRECTIONS, ROW_FILENAMES } from './pixellab.mjs';
import { decodePng } from './pngkit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--'))
  .map(a => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
const [spriteId] = args.filter(a => !a.startsWith('--'));

const die = m => { console.error(`✗ ${m}`); process.exit(1); };
if (!spriteId) die('usage: node tools/gen_unit.mjs <spriteId> --out=<dir> [--style=<png>] [--seed=N]');
if (!flags.out) die('--out=<dir> is required');

const manifest = JSON.parse(readFileSync(join(ROOT, 'assets', 'assets.json'), 'utf8'));
const spec = manifest.sprites[spriteId];
if (!spec) die(`"${spriteId}" is not in assets/assets.json`);
const dirs = spec.directions > 1 ? spec.directions : 1;
if (dirs !== 8) die(`${spriteId} declares ${dirs} direction(s); this tool generates the 8-way set`);

// ---- the prompt ----
let prompt = flags.prompt;
if (!prompt) {
  const prompts = JSON.parse(readFileSync(join(ROOT, 'docs', 'prompts.json'), 'utf8'));
  const p = prompts.prompts[spriteId];
  if (!p) die(`${spriteId} has no entry in docs/prompts.json`);
  prompt = p.prompt;
  if (prompts.styleAnchorPending) {
    // The anchor has not been approved yet, so there is no style clause to
    // carry. Strip the placeholder rather than sending the literal word.
    prompt = prompt.replace(/,\s*PENDING\s*,/, ', ');
    console.log('! style anchor is PENDING — this is the anchor run (batch 0). Approve it, record it in docs/STYLE_ANCHOR.md, then use --style for everything after.');
  }
  // The API takes the facing as a parameter, so the words would only fight it.
  prompt = prompt.replace(/,\s*8-directional\s*,/, ', ');
}

const view = flags.view || 'low top-down';
const seed = flags.seed ? Number(flags.seed) : undefined;
const styleFile = flags.style;
const styleImage = styleFile ? b64(readFileSync(styleFile)) : null;

const outDir = flags.out;
mkdirSync(outDir, { recursive: true });

console.log(`${spriteId} — ${spec.w}x${spec.h}, 8 facings, view "${view}"${seed !== undefined ? `, seed ${seed}` : ''}`);
console.log(`  prompt: ${prompt}`);
if (styleImage) console.log(`  style reference: ${styleFile} (strength ${flags['style-strength'] || 50})`);
console.log(`  balance before: ${JSON.stringify(await balance())}`);

const common = { image_size: { width: spec.w, height: spec.h }, no_background: true };
if (seed !== undefined) common.seed = seed;

let generations = 0;
const t0 = Date.now();

// ---- 1. the base south view ----
const SOUTH = ROW_DIRECTIONS.indexOf('south');
const baseFile = join(outDir, `${ROW_FILENAMES[SOUTH]}.png`);
let basePng;
if (flags.base && existsSync(join(flags.base, `${ROW_FILENAMES[SOUTH]}.png`))) {
  basePng = readFileSync(join(flags.base, `${ROW_FILENAMES[SOUTH]}.png`));
  console.log('  base: reused from --base, not regenerated');
} else {
  process.stdout.write('  [1/8] south (base) … ');
  const body = { ...common, description: prompt, view, direction: 'south' };
  let res;
  if (styleImage) {
    res = await post('/generate-image-bitforge', {
      ...body, style_image: styleImage, style_strength: Number(flags['style-strength'] || 50),
    });
  } else {
    res = await post('/generate-image-pixflux', body);
  }
  generations += res.usage?.generations || 0;
  basePng = fromB64(res.image);
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
writeFileSync(baseFile, basePng);

// ---- 2. rotate to the other seven ----
const baseB64 = b64(basePng);
let n = 1;
for (let row = 0; row < 8; row++) {
  if (row === SOUTH) continue;
  n++;
  const to = ROW_DIRECTIONS[row];
  process.stdout.write(`  [${n}/8] ${to} … `);
  const res = await post('/rotate', {
    ...common,
    from_image: baseB64,
    from_view: view, to_view: view,
    from_direction: 'south', to_direction: to,
  });
  generations += res.usage?.generations || 0;
  writeFileSync(join(outDir, `${ROW_FILENAMES[row]}.png`), fromB64(res.image));
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

// ---- 3. sanity, before anyone spends time reviewing it ----
const problems = [];
for (let row = 0; row < 8; row++) {
  const f = join(outDir, `${ROW_FILENAMES[row]}.png`);
  const img = decodePng(readFileSync(f));
  if (img.width !== spec.w || img.height !== spec.h) problems.push(`${ROW_FILENAMES[row]}: ${img.width}x${img.height}`);
  let transparent = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 255) transparent++;
  if (!transparent) problems.push(`${ROW_FILENAMES[row]}: fully opaque (matte)`);
}

console.log(`\n${problems.length ? '!' : '✓'} ${outDir} — 8 files, ${generations} generation(s), ${((Date.now() - t0) / 1000).toFixed(0)}s total`);
if (problems.length) console.log(`  problems: ${problems.join(', ')}`);
console.log(`  next: node tools/process_sprite.mjs ${spriteId} ${outDir}`);
if (seed !== undefined) console.log(`  seed ${seed} — record it in docs/STYLE_ANCHOR.md if this run is approved`);
