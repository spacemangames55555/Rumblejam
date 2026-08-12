// Assemble docs/prompts.json — the exact prompt for every sprite id, keyed by
// id, so regenerating one sprite in six weeks reproduces its neighbours rather
// than a near-miss.
//
//   node tools/gen_prompts.mjs                # write docs/prompts.json
//   node tools/gen_prompts.mjs --check        # fail if it is stale
//   node tools/gen_prompts.mjs --allow-pending  # preview before the anchor exists
//
// The style clause is READ FROM docs/STYLE_ANCHOR.md and pasted in byte for
// byte. That is the whole point: "never paraphrase the style clause" is a rule
// someone forgets on sprite 90, so it is mechanical here instead. Editing a
// prompt's style wording means editing the anchor, which is a visible,
// reviewable change to one file.
//
// While the anchor reads PENDING this tool refuses to emit — batch 0 is a gate,
// not a suggestion.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ALL_CHARS } from '../js/content/characters.js';
import { ALL_ENEMY_DEFS } from '../js/content/enemies.js';
import { ALL_BOSS_DEFS } from '../js/content/bosses.js';
import { REGION_ENEMIES } from '../js/content/regions-enemies.js';
import { REGION_BY_ID } from '../js/regions.js';
import { PYLON_SPRITE, BEAST_SPRITE } from '../js/content/sprites.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANCHOR = join(ROOT, 'docs', 'STYLE_ANCHOR.md');
const SIL = join(ROOT, 'docs', 'silhouettes.json');
const OUT = join(ROOT, 'docs', 'prompts.json');

const flags = new Set(process.argv.slice(2));

// ---- the style clause, verbatim, from the anchor ----
const anchorText = readFileSync(ANCHOR, 'utf8');
const m = anchorText.match(/<!-- STYLE-CLAUSE-START -->\n([\s\S]*?)\n<!-- STYLE-CLAUSE-END -->/);
if (!m) { console.error('✗ docs/STYLE_ANCHOR.md has no STYLE-CLAUSE-START/END block'); process.exit(1); }
const styleClause = m[1].trim();
const pending = styleClause === 'PENDING' || !styleClause;
if (pending && !flags.has('--allow-pending')) {
  console.error(`✗ the style anchor is still PENDING — generate and approve ${STYLE_ANCHOR_ID} (batch 0) before any other prompt.`);
  console.error('  docs/ART-GENERATION.md §2. Pass --allow-pending to preview the assembled prompts anyway.');
  process.exit(1);
}

const silhouettes = JSON.parse(readFileSync(SIL, 'utf8'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'assets', 'assets.json'), 'utf8'));

// ---- subjects, from the live content tables ----
//
// ALL_ENEMY_DEFS / ALL_BOSS_DEFS rather than the base tables: the region
// populations are units with sheets to draw, and reading the narrow tables is
// what left fourteen of them with no prompt at all.
//
// A region unit names its REGION in its subject. "Sapling, a chaser dungeon
// monster" is a true sentence that throws away the entire premise — the
// Pacific Northwest and Xibalba are the visual identity of their populations,
// and a generator told only the behaviour will draw the same monster twice in
// two regions that are supposed to look nothing alike.
const regionOf = {};
for (const [regionId, pop] of Object.entries(REGION_ENEMIES)) {
  const name = REGION_BY_ID[regionId]?.name || regionId;
  for (const e of pop.enemies) regionOf[e.id] = name;
  regionOf[pop.boss.id] = name;
}

const subject = {};
const roleWords = c => (c.roles || []).join(' ');
for (const c of ALL_CHARS) subject[c.spriteId] = `${c.name}, a ${roleWords(c)} dungeon adventurer`;
// The region goes in as an apposition rather than "of the {name}" — region
// names take different articles ("the Pacific Northwest", "Central America")
// and the alternative is authoring a second, prompt-only name per region.
for (const e of ALL_ENEMY_DEFS) {
  subject[e.spriteId] = regionOf[e.id]
    ? `${e.name}, a ${e.behavior} monster, ${regionOf[e.id]} region`
    : `${e.name}, a ${e.behavior} dungeon monster`;
}
subject[PYLON_SPRITE] = 'Ward Pylon, an immobile arcane siege structure';
for (const b of ALL_BOSS_DEFS) {
  subject[b.spriteId] = regionOf[b.id]
    ? `${b.name}, a two-phase region boss, ${regionOf[b.id]} region`
    : `${b.name}, a floor-${b.floor} dungeon boss`;
}
// Combat pets are units with eight facings like any other; `beast.bear` was
// manifested, silhouetted by nobody and skipped here as if it were an icon.
for (const id of Object.values(BEAST_SPRITE)) subject[id] = 'Bear, a hunter\'s bonded combat beast, quadruped';

// ---- batches, from docs/ART-GENERATION.md §5 ----
//
// STYLE_ANCHOR_ID names the one unit generated and approved before anything
// else — batch 0 is a gate, not an ordering. It was `char.pulsar`, a character
// retired with the classic roster, so batch 0 quietly became EMPTY and the gate
// it exists to be stopped gating. Named as a constant because which unit
// carries the style is a decision someone should be able to find and change.
export const STYLE_ANCHOR_ID = 'char.toh_assassin';
function batchOf(id) {
  if (id === STYLE_ANCHOR_ID) return 0;
  const ns = id.slice(0, id.indexOf('.'));
  // `beast` rides with batch 1: a combat pet is a character's unit and is
  // reviewed next to the character it belongs to, not on its own.
  return { char: 1, beast: 1, boss: 2, enemy: 3, proj: 5, fx: 5, prop: 6, item: 7, ui: 8 }[ns];
}

const out = {
  _: 'GENERATED by tools/gen_prompts.mjs. Edit docs/silhouettes.json or docs/STYLE_ANCHOR.md, not this file.',
  styleAnchorPending: pending,
  styleClause,
  template: '{subject}, {silhouette}, {STYLE CLAUSE}, {view}, {w}px, transparent background, no ground shadow, no outline glow',
  prompts: {},
};

const noSubject = [], noSilhouette = [], noUnitSubject = [];
for (const [id, spec] of Object.entries(manifest.sprites)) {
  const batch = batchOf(id);
  const sub = subject[id];
  const sil = silhouettes[id];
  const dirs = spec.directions > 1 ? spec.directions : 1;
  const view = dirs > 1 ? `${dirs}-directional` : 'single view';
  // Non-units have no prompt yet, by design — they need a generator PixelLab
  // does not cover. But a DIRECTIONAL id is a unit sheet, and a unit sheet with
  // no subject is a sheet this pipeline cannot generate; skipping it silently
  // is how `beast.bear` sat in the manifest as an eight-facing grid with no
  // prompt while this tool reported success. Loud, not skipped (§13 rule 17).
  if (!sub) { (dirs > 1 ? noUnitSubject : noSubject).push(id); continue; }
  if (!sil) noSilhouette.push(id);
  out.prompts[id] = {
    batch,
    subject: sub,
    silhouette: sil || null,
    directions: dirs,
    frames: spec.frames > 0 ? spec.frames : 1,
    size: [spec.w, spec.h],
    prompt: [sub, sil, styleClause, view, `${spec.w}px`, 'transparent background', 'no ground shadow', 'no outline glow']
      .filter(Boolean).join(', '),
  };
}

if (noUnitSubject.length) {
  console.error(`✗ ${noUnitSubject.length} DIRECTIONAL sprite id(s) have no subject — they are unit sheets this pipeline cannot generate: ${noUnitSubject.join(', ')}`);
  console.error('  Add them to the subject map above from whatever content table defines them.');
  process.exit(1);
}
if (noSilhouette.length) {
  console.error(`✗ ${noSilhouette.length} unit(s) have no silhouette note in docs/silhouettes.json: ${noSilhouette.slice(0, 6).join(', ')}`);
  process.exit(1);
}

// Every silhouette must be unique as written — two units described the same way
// will be drawn the same way, which is the failure this file exists to prevent.
const seen = new Map();
const dupes = [];
for (const [id, s] of Object.entries(silhouettes)) {
  if (id === '_') continue;
  const key = s.toLowerCase().replace(/[^a-z ]/g, '');
  if (seen.has(key)) dupes.push(`${id} and ${seen.get(key)}`);
  seen.set(key, id);
}
if (dupes.length) { console.error(`✗ duplicate silhouette notes: ${dupes.join(', ')}`); process.exit(1); }

const json = JSON.stringify(out, null, 2) + '\n';

if (flags.has('--check')) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (cur !== json) { console.error('✗ docs/prompts.json is stale — run: node tools/gen_prompts.mjs'); process.exit(1); }
  console.log(`docs/prompts.json up to date — ${Object.keys(out.prompts).length} prompts`);
} else {
  writeFileSync(OUT, json);
  const n = Object.keys(out.prompts).length;
  console.log(`wrote ${OUT} — ${n} unit prompts${pending ? ' (style anchor PENDING — preview only)' : ''}`);
  const byBatch = {};
  for (const p of Object.values(out.prompts)) byBatch[p.batch] = (byBatch[p.batch] || 0) + 1;
  for (const b of Object.keys(byBatch).sort()) console.log(`  batch ${b}: ${byBatch[b]}`);
  console.log(`  ${noSubject.length} non-unit id(s) have no prompt yet — they need a generator PixelLab does not cover`);
}
