// Generate tools/contact_sheet.html — the batch review artefact.
//
//   node tools/gen_contact_sheet.mjs            # everything
//   node tools/gen_contact_sheet.mjs char       # one batch
//   node tools/gen_contact_sheet.mjs char enemy
//
// The point of this page is to be UNFLATTERING. Sprites are shown at the size
// they are actually drawn in play — which for a 48px character sheet is about
// 36 CSS px — on the arena's own background colour, over the arena's own grid,
// packed at the density of a fight. Approving art at 4x on a white page and
// then discovering it is mud at 1x on a dark floor is the most common art
// mistake there is, so 1:1 is the default and the zoom is opt-in.
//
// Directional sheets show the S row (facing the camera) by default, with a
// control to cycle all eight.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ALL_CHARS } from '../js/content/characters.js';
import { ENEMIES } from '../js/content/enemies.js';
import { BOSSES } from '../js/content/bosses.js';
import { CONFIG, PALETTE } from '../js/config.js';
import { PROP, FX, PYLON_SPRITE } from '../js/content/sprites.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'contact_sheet.html');
const manifest = JSON.parse(readFileSync(join(ROOT, 'assets', 'assets.json'), 'utf8'));

// The reference viewport the "1:1" scale is computed for. The renderer always
// shows exactly ROOM_W x ROOM_H world units, so world-units-per-CSS-pixel falls
// out of the window size and nothing else.
const REF_W = 1440, REF_H = 900;
const PX_PER_UNIT = Math.min(REF_W / CONFIG.ROOM_W, REF_H / CONFIG.ROOM_H);

const selectors = process.argv.slice(2).filter(a => !a.startsWith('--'));

// ---- how big is each sprite actually drawn, in world units? ----
// Mirrors the call sites in js/render.js. Where the renderer scales art to an
// entity radius, that radius is the truth and the sheet size is irrelevant.
const drawSize = {};
for (const c of ALL_CHARS) {
  const big = c.trait.key === 'immovable' || c.trait.key === 'crystal_infusion';
  drawSize[c.spriteId] = 2 * 16 * (big ? c.trait.hitbox : 1);
}
for (const e of ENEMIES) drawSize[e.spriteId] = 2 * e.radius;
drawSize[PYLON_SPRITE] = 2 * 26;
for (const b of BOSSES) drawSize[b.spriteId] = 2 * b.radius;
Object.assign(drawSize, {
  [PROP.hatchExtract]: 104, [PROP.hatchDescend]: 104,
  [PROP.altar]: 168, [PROP.relic]: 26, [PROP.drill]: 64,
  [PROP.nest]: 64, [PROP.nestWalled]: 64,
  [PROP.gateOpen]: 148, [PROP.gateSealed]: 148,
  [PROP.turret]: 26, [PROP.drone]: 26, [PROP.ram]: 26,
  [PROP.spirit]: 34, [PROP.decoy]: 32,
  [PROP.coralNode]: 120, [PROP.singularity]: 220,
  [FX.material]: 16,
});
// projectiles are drawn at radius x 3 (render.js); the common shot radius is 5
const PROJ_DRAW = 15;

function unitsFor(id, spec) {
  if (drawSize[id]) return drawSize[id];
  const ns = id.slice(0, id.indexOf('.'));
  if (ns === 'proj') return PROJ_DRAW;
  if (ns === 'prop') return 64;
  if (ns === 'fx') return 16;
  return spec.w;   // item icons and UI chrome are DOM, drawn at native size
}

const ids = Object.keys(manifest.sprites)
  .filter(id => !selectors.length || selectors.some(s => id === s || id.startsWith(`${s}.`)));

const groups = {};
for (const id of ids) {
  const ns = id.slice(0, id.indexOf('.'));
  (groups[ns] = groups[ns] || []).push(id);
}

const NS_TITLE = {
  char: 'Player characters', enemy: 'Enemies', boss: 'Bosses',
  proj: 'Projectiles', fx: 'World FX and pickups', item: 'Item and weapon icons',
  prop: 'Props and structures', ui: 'UI chrome',
};
const ROWS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

let present = 0, absent = 0;
const cells = [];
for (const ns of Object.keys(groups).sort()) {
  const items = groups[ns].sort();
  const tiles = [];
  for (const id of items) {
    const spec = manifest.sprites[id];
    const rel = `../${manifest.basePath}${spec.file}`;
    const have = existsSync(join(ROOT, manifest.basePath, spec.file));
    have ? present++ : absent++;
    const units = unitsFor(id, spec);
    const cssW = units * PX_PER_UNIT;                  // on-screen size at 1:1
    const k = cssW / spec.w;                           // sheet scale factor
    const frames = spec.frames > 0 ? spec.frames : 1;
    const dirs = spec.directions > 1 ? spec.directions : 1;
    const cssH = spec.h * k;
    const short = id.slice(ns.length + 1);
    tiles.push(`<figure class="t${have ? '' : ' gone'}" data-dirs="${dirs}"
      style="--w:${cssW.toFixed(2)}px;--h:${cssH.toFixed(2)}px;--sw:${(spec.w * frames * k).toFixed(2)}px;--sh:${(spec.h * dirs * k).toFixed(2)}px;--cw:${(spec.w * k).toFixed(2)}px;--ch:${(spec.h * k).toFixed(2)}px"
      title="${id} — sheet ${spec.w}x${spec.h}${dirs > 1 ? ` x${dirs} dirs` : ''}${frames > 1 ? ` x${frames} frames` : ''}, drawn ${units}u">
      <span class="s" style="${have ? `background-image:url('${rel}')` : ''}"></span>
      <figcaption>${short}</figcaption></figure>`);
  }
  cells.push(`<section><h2>${NS_TITLE[ns] || ns} <em>${items.length}</em></h2>
    <div class="grid">${tiles.join('\n')}</div></section>`);
}

const html = `<!doctype html>
<meta charset="utf-8">
<title>UNDERVAULT — sprite contact sheet</title>
<style>
  :root { --bg:${PALETTE.bg}; --grid:${PALETTE.grid}; --ink:#c8cde8; --dim:#9aa0bd; --row:2; --zoom:1; }
  * { box-sizing: border-box; }
  body { margin:0; padding:0 0 60px; font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
         color:var(--ink); background:var(--bg); }
  header { position:sticky; top:0; z-index:5; padding:10px 16px; background:#0c0d13ee;
           border-bottom:1px solid #2b2f45; display:flex; gap:18px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:14px; margin:0; letter-spacing:2px; color:#ffd45e; }
  .meta { color:var(--dim); }
  button { font:inherit; color:var(--ink); background:#1b1e2b; border:1px solid #454b6e;
           border-radius:4px; padding:4px 9px; cursor:pointer; }
  button[aria-pressed="true"] { background:#454b6e; color:#fff; }
  section { padding:18px 16px 4px; }
  h2 { font-size:12px; letter-spacing:2px; color:var(--dim); margin:0 0 10px;
       text-transform:uppercase; font-weight:normal; }
  h2 em { color:#454b6e; font-style:normal; }
  /* the arena's own floor grid, at the arena's own 64-unit pitch, so density
     and contrast read the way they will in play */
  .grid { display:flex; flex-wrap:wrap; align-items:flex-end; gap:2px;
          padding:10px; border:1px solid #2b2f45;
          background-color:var(--bg);
          background-image:linear-gradient(var(--grid) 1px,transparent 1px),
                           linear-gradient(90deg,var(--grid) 1px,transparent 1px);
          background-size:${(64 * PX_PER_UNIT).toFixed(2)}px ${(64 * PX_PER_UNIT).toFixed(2)}px; }
  figure { margin:0; display:flex; flex-direction:column; align-items:center; gap:2px; }
  .t .s { display:block;
          width:calc(var(--w) * var(--zoom)); height:calc(var(--h) * var(--zoom));
          background-repeat:no-repeat;
          background-size:calc(var(--sw) * var(--zoom)) calc(var(--sh) * var(--zoom));
          background-position:0 calc(var(--ch) * var(--row) * var(--zoom) * -1);
          image-rendering:pixelated; }
  /* a sheet with fewer rows than the selected one pins to its only row */
  .t[data-dirs="1"] .s { background-position:0 0; }
  .gone .s { border:1px dashed #ff00ff88; background:#ff00ff11; }
  figcaption { color:#5c6180; font-size:9px; max-width:96px; overflow:hidden;
               text-overflow:ellipsis; white-space:nowrap; }
  body.labels-off figcaption { display:none; }
  body.dense .grid { gap:0; }
  body.dense figcaption { display:none; }
</style>
<header>
  <h1>UNDERVAULT</h1>
  <span class="meta">${present} drawn / ${present + absent} ids${selectors.length ? ` — ${selectors.join(' ')}` : ''}</span>
  <span class="meta">1:1 = ${PX_PER_UNIT.toFixed(3)} css px per world unit (${REF_W}x${REF_H} window)</span>
  <span>facing <span id="rowname">S</span>: <span id="rowbtns"></span></span>
  <button id="zoom" aria-pressed="false">4x</button>
  <button id="dense" aria-pressed="false">crowd</button>
  <button id="labels" aria-pressed="true">labels</button>
</header>
${cells.join('\n')}
<script>
  const rows = ${JSON.stringify(ROWS)};
  const root = document.documentElement;
  const btns = document.getElementById('rowbtns');
  rows.forEach((r, i) => {
    const b = document.createElement('button');
    b.textContent = r; b.setAttribute('aria-pressed', String(i === 2));
    b.onclick = () => {
      root.style.setProperty('--row', i);
      document.getElementById('rowname').textContent = r;
      [...btns.children].forEach((c, j) => c.setAttribute('aria-pressed', String(i === j)));
    };
    btns.appendChild(b);
  });
  const toggle = (id, on, off) => {
    const b = document.getElementById(id);
    b.onclick = () => {
      const next = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(next));
      (next ? on : off)();
    };
  };
  toggle('zoom', () => root.style.setProperty('--zoom', 4), () => root.style.setProperty('--zoom', 1));
  toggle('dense', () => document.body.classList.add('dense'), () => document.body.classList.remove('dense'));
  toggle('labels', () => document.body.classList.remove('labels-off'), () => document.body.classList.add('labels-off'));
  document.getElementById('labels').setAttribute('aria-pressed', 'true');
</script>
`;

writeFileSync(OUT, html);
console.log(`wrote ${OUT} — ${present} drawn / ${present + absent} ids, 1:1 = ${PX_PER_UNIT.toFixed(3)} px/unit`);
if (absent) console.log(`  ${absent} id(s) show as a magenta dashed box (no art yet)`);
