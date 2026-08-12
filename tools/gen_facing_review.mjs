// SOUTH BESIDE NORTH, AT A SIZE YOU CAN JUDGE. The back-view check that is not
// a number.
//
// `verify_art_batch.mjs` asks whether a sheet's eight cells are DISTINCT. It
// cannot ask whether they FACE THE RIGHT WAY, and one attempt to make it —
// head-region detail, south over north — was measured against all fourteen
// hand-supplied character sheets and does not separate: the known-bad Bark Hulk
// scored 1.26 inside a known-good range of 1.10 to 2.07, above three sheets
// that are correct. The note beside MIN_FACING_RATIO records that in full.
//
// So this is the replacement, and it is deliberately not a gate. The eye read
// the Bark Hulk's frontal north correctly on first look and a ratio of 2.58
// talked it down; what the eye needed was not a better metric but the two cells
// next to each other instead of eight in a row. This makes that arrangement a
// command rather than something to remember.
//
//   node tools/gen_facing_review.mjs <sheet.png> [more.png…] [--out=FILE]
//
// Every unit gets one row: S, N, then the other six for context. Judged by
// asking one question per row — CAN YOU SEE ITS FACE IN THE NORTH CELL? If you
// can, the rotation did not turn it round, whatever the ratio says.
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePng, encodePng, blankImage, subImage } from './pngkit.mjs';

const ROW = ['east', 'south_east', 'south', 'south_west', 'west', 'north_west', 'north', 'north_east'];
const S = ROW.indexOf('south'), N = ROW.indexOf('north');
// S and N first and adjacent, because that is the comparison being made. The
// rest follow in compass order for context.
const ORDER = [S, N, 0, 1, 3, 4, 5, 7];

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--'))
  .map(a => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
const files = args.filter(a => !a.startsWith('--'));
if (!files.length) { console.error('usage: node tools/gen_facing_review.mjs <sheet.png>… [--out=FILE]'); process.exit(1); }

const BG = [0x0c, 0x0d, 0x13];        // the arena floor, so this is judged on the ground it is seen on
const GAP = [0x2a, 0x2c, 0x3a];       // the divider between the S|N pair and the context cells
const Z = Number(flags.zoom || 3), PAD = 10;

function nn(img, f) {
  const o = blankImage(img.width * f, img.height * f);
  for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) {
    const s = (((y / f) | 0) * img.width + ((x / f) | 0)) * 4, d = (y * o.width + x) * 4;
    for (let k = 0; k < 4; k++) o.data[d + k] = img.data[s + k];
  }
  return o;
}
function over(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const s = (y * src.width + x) * 4, a = src.data[s + 3] / 255;
    if (!a) continue;
    const X = dx + x, Y = dy + y;
    if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
    const d = (Y * dst.width + X) * 4;
    for (let k = 0; k < 3; k++) dst.data[d + k] = Math.round(src.data[s + k] * a + dst.data[d + k] * (1 - a));
    dst.data[d + 3] = 255;
  }
}

const sheets = files.map(f => {
  const img = decodePng(readFileSync(f));
  if (img.height % 8) { console.error(`✗ ${f}: ${img.width}x${img.height} is not eight rows`); process.exit(1); }
  return { f, img, w: img.width, h: img.height / 8 };
});

const cw = Math.max(...sheets.map(s => s.w)) * Z, ch = Math.max(...sheets.map(s => s.h)) * Z;
const W = PAD + ORDER.length * (cw + PAD) + PAD * 2;   // the extra gap after the S|N pair
const H = PAD + sheets.length * (ch + PAD);
const out = blankImage(W, H);
for (let i = 0; i < out.data.length; i += 4) {
  out.data[i] = BG[0]; out.data[i + 1] = BG[1]; out.data[i + 2] = BG[2]; out.data[i + 3] = 255;
}

sheets.forEach((s, r) => {
  const y = PAD + r * (ch + PAD);
  ORDER.forEach((row, i) => {
    const x = PAD + i * (cw + PAD) + (i >= 2 ? PAD * 2 : 0);
    over(out, nn(subImage(s.img, 0, row * s.h, s.w, s.h), Z), x, y);
  });
  // a rule after the S|N pair, so the comparison is visually separated from context
  const gx = PAD + 2 * (cw + PAD) + PAD;
  for (let yy = y; yy < y + ch; yy++) {
    const d = (yy * W + gx) * 4;
    out.data[d] = GAP[0]; out.data[d + 1] = GAP[1]; out.data[d + 2] = GAP[2]; out.data[d + 3] = 255;
  }
});

const dest = flags.out || 'facing-review.png';
writeFileSync(dest, encodePng(out));
console.log(`wrote ${dest} — ${sheets.length} sheet(s), columns: SOUTH | NORTH ‖ ${ORDER.slice(2).map(i => ROW[i]).join(' ')}`);
console.log('  One question per row: CAN YOU SEE ITS FACE IN THE NORTH CELL? If yes, the rotation did not turn it round.');
sheets.forEach(s => console.log(`    ${s.f}`));
