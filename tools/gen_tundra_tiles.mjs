// PLACEHOLDER tundra tiles, so the tiled-floor renderer can be verified before
// the real art exists.
//
//   node tools/gen_tundra_tiles.mjs
//
// These are NOT the shipping tiles. They are flat-value noise fields built to
// the brief's numbers — grey-blue packed snow at groundValue 0.60, five
// variants that differ in texture rather than in value — so that everything
// downstream of the art can be checked for real: the loader's structural
// gates, the variant hash, the seam behaviour at viewport edges, the frame
// cost of ~400 drawImage calls, and whether the roster actually reads against
// a 0.60 ground. Casey's tiles drop into the same five paths and replace them.
//
// Deterministic by construction: a fixed integer hash per pixel, no
// Math.random(), so regenerating produces byte-identical PNGs and a rerun is
// an empty diff rather than a reshuffle. Same reasoning as tileVariant() in
// js/biomes.js and docs/KNOWN-DEFECTS.md #1.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { encodePng } from './pngkit.mjs';
import { BIOMES, tileFile } from '../js/biomes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const B = BIOMES.tundra;
const SIZE = 64;

// sRGB relative luminance, the same weights tools/readability_check.mjs uses.
const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// A stable value hash per pixel — the tile equivalent of tileVariant().
function noise(x, y, salt) {
  let h = (Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(salt + 1, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Grey-blue, never neutral: snow under a cold sky picks up blue in shadow, and
// a neutral grey floor reads as concrete. Blue rises as value falls.
function tint(v) {
  const b = Math.min(1, v + 0.055);
  const r = Math.max(0, v - 0.030);
  return [Math.round(r * 255), Math.round(v * 255), Math.round(b * 255)];
}

// The five variants. `amp` is how much the texture deviates from the biome's
// mean, and it is small on purpose: tiles must read as ONE surface, not as a
// checkerboard. `bias` is the variant's own offset from the mean, smaller
// still — the set averages to groundValue, no single tile drags it.
const VARIANTS = [
  { name: 'packed snow',       amp: 0.030, bias: +0.010, grain: 'fine' },
  { name: 'wind-scoured',      amp: 0.045, bias: +0.020, grain: 'streak' },
  { name: 'blue-grey drift',   amp: 0.035, bias: -0.030, grain: 'soft' },
  { name: 'exposed rock',      amp: 0.060, bias: -0.045, grain: 'blotch' },
  { name: 'cracked ice',       amp: 0.040, bias: +0.045, grain: 'crack' },
];

function texel(g, x, y, i) {
  const n = noise(x, y, i);
  switch (g) {
    case 'fine':   return n - 0.5;
    // wind runs east-west: sample coarsely across, finely along
    case 'streak': return (noise(Math.floor(x / 9), y, i) - 0.5) * 1.2 + (n - 0.5) * 0.3;
    case 'soft':   return (noise(Math.floor(x / 6), Math.floor(y / 6), i) - 0.5) * 1.3;
    case 'blotch': {
      const c = noise(Math.floor(x / 11), Math.floor(y / 11), i);
      return (c > 0.62 ? 0.5 : c < 0.30 ? -0.45 : 0) + (n - 0.5) * 0.35;
    }
    case 'crack': {
      // thin dark fractures on a bright plate
      const d = Math.abs(noise(Math.floor((x + y * 0.6) / 7), Math.floor((y - x * 0.4) / 9), i) - 0.5);
      return (d < 0.06 ? -0.9 : 0.18) + (n - 0.5) * 0.2;
    }
    default: return 0;
  }
}

mkdirSync(join(ROOT, B.atlas), { recursive: true });
console.log(`tundra placeholders — target groundValue ${B.groundValue.toFixed(2)} (brief: 0.55-0.65)\n`);

let setSum = 0, setN = 0;
for (let i = 0; i < B.variants; i++) {
  const v = VARIANTS[i];
  const data = Buffer.alloc(SIZE * SIZE * 4);
  let sum = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const val = Math.max(0, Math.min(1, B.groundValue + v.bias + texel(v.grain, x, y, i) * v.amp));
      const [r, g, b] = tint(val);
      const o = (y * SIZE + x) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
      sum += lum(r, g, b);
    }
  }
  const mean = sum / (SIZE * SIZE);
  setSum += sum; setN += SIZE * SIZE;
  const rel = join(ROOT, tileFile(B, i));
  writeFileSync(rel, encodePng({ width: SIZE, height: SIZE, data }));
  console.log(`  ${tileFile(B, i).padEnd(34)} ${v.name.padEnd(16)} mean luminance ${mean.toFixed(3)}`);
}
const setMean = setSum / setN;
console.log(`\nset mean luminance ${setMean.toFixed(3)} vs configured groundValue ${B.groundValue.toFixed(2)} `
  + `(delta ${(setMean - B.groundValue >= 0 ? '+' : '')}${(setMean - B.groundValue).toFixed(3)})`);
console.log('\nThese are PLACEHOLDERS. Real tundra art replaces the same five paths.');
