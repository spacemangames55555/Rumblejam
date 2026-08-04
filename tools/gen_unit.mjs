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

// Style parameters. These are part of the anchor as much as the words are —
// two runs with the same prompt and different `shading` are two different
// styles — so they are explicit flags and get recorded in STYLE_ANCHOR.md.
// They apply to the base generation only; /rotate takes none of them and
// inherits the style from the image it is given.
const styleParams = {};
for (const k of ['outline', 'shading', 'detail']) if (flags[k]) styleParams[k] = flags[k];
if (flags.guidance) styleParams.text_guidance_scale = Number(flags.guidance);
if (flags.negative) styleParams.negative_description = flags.negative;

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
  const body = { ...common, ...styleParams, description: prompt, view, direction: 'south' };
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

// ---- 2. rotate to the other seven, in 45-degree hops ----
//
// NOT one big turn from south to each target. Asking /rotate for 180 degrees in
// a single hop makes it preserve far too much of the source: the "back" view
// comes out looking like the front. Measured on a real unit, opposite facings
// ended up MORE similar to each other than neighbouring ones — a ratio of 0.55
// where anything under 1.0 means the eight facings are not really eight.
//
// Walking round the compass 45 degrees at a time, each hop conditioned on the
// previous hop's output, turns that ratio to 1.03 and gives a back view that is
// actually a back view. Lower image guidance helps for the same reason: the
// reference should inform the drawing, not dominate it.
const ROTATE_GUIDANCE = Number(flags['rotate-guidance'] || 1.5);
const CHAINS = flags['no-chain']
  ? [[2, 0], [2, 1], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7]].map(p => [p])   // legacy: all from south
  : [
    [[2, 1], [1, 0], [0, 7], [7, 6]],   // south -> SE -> E -> NE -> N
    [[2, 3], [3, 4], [4, 5]],           // south -> SW -> W -> NW
  ];
let n = 1;
for (const chain of CHAINS) {
  for (const [fromRow, toRow] of chain) {
    n++;
    process.stdout.write(`  [${n}/8] ${ROW_DIRECTIONS[fromRow]} -> ${ROW_DIRECTIONS[toRow]} … `);
    const fromPng = readFileSync(join(outDir, `${ROW_FILENAMES[fromRow]}.png`));
    const res = await post('/rotate', {
      ...common,
      from_image: b64(fromPng),
      from_view: view, to_view: view,
      from_direction: ROW_DIRECTIONS[fromRow], to_direction: ROW_DIRECTIONS[toRow],
      image_guidance_scale: ROTATE_GUIDANCE,
    });
    generations += res.usage?.generations || 0;
    writeFileSync(join(outDir, `${ROW_FILENAMES[toRow]}.png`), fromB64(res.image));
    console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
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
