// THE CLASS CONVERSION DOCUMENTS, CHECKED AGAINST THE CODE.
//
// `docs/design/classes/` holds fourteen conversion documents, one per class,
// each a run of skill blocks in a fixed field template. They are design source:
// numbers get read out of them and typed into `js/`. So the failure mode is the
// one `doc_gate` was written for (§13 rule 70) — a document nobody checks
// drifts faster than the code it governs, and here the drift arrives as a wrong
// number rather than a wrong sentence.
//
// TWO CHECKS, AND THEY FAIL FOR DIFFERENT REASONS.
//
// 1. THE TEMPLATE. Every block carries the same 27 fields in the same order.
//    Names and order only — this gate never reads a value, so it cannot be
//    fooled by a plausible figure in the right slot. A missing or misspelled
//    field name is what turns into a wrong number later: whoever transcribes
//    `THREAT` from under `--- growth ---` has already lost the guarantee that
//    it means what the template says it means.
//
// 2. THE CLASS-ID BRIDGE. The docs and the code do not agree on names, and they
//    are not supposed to: docs are named for a reader (`witchdoctor.md`), ids
//    are named for a namespace (`toh_witch_doctor`). That gap is fine as long
//    as it is WRITTEN DOWN and CHECKED. `CLASS_DOCS` below is where it is
//    written down, and this gate is what stops a rename on either side from
//    drifting the two apart in silence. It is an arity check in both
//    directions, which is the shape that matters: a doc naming a class the code
//    does not have, and a class the code has that no doc covers, are the same
//    defect seen from opposite ends, and checking only one direction catches
//    only half of any rename.
//
// Usage: node tools/class_doc_gate.mjs [--verbose]
import { readdirSync, readFileSync } from 'node:fs';
import { TREES, TREES_BY_CLASS } from '../js/skills.js';

const DIR = new URL('../docs/design/classes/', import.meta.url);

// Files in the directory that are NOT class documents. Listed explicitly rather
// than pattern-matched: the whole point of the coverage check is that an
// unrecognised file is a failure, so the exemption has to be a decision someone
// made rather than a filename that happened to sort differently.
const NOT_A_CLASS = new Set([
  'roster-ruling-pace-damage-engines.md',   // the ruling the class files revise against
  'engines-doc-vs-built.md',                // engine decision document, all 14 side by side
]);

// ---------------------------------------------------------------- the bridge

// DOC BASENAME → CODE CLASS ID. Hand-written on purpose, and small enough to
// read in one go: a derivation rule (`'toh_' + basename`) would cover twelve of
// the fourteen and then need an exception table for the other two anyway, and
// an exception table that only lists exceptions cannot tell you when a NEW one
// appears — it just silently stops matching. Listing all fourteen means the
// arity checks below cover every row, so nothing is exempt from the count.
//
// The mismatches are deliberate and both are spelling, not identity:
//   witchdoctor → toh_witch_doctor   (the id separates the two words)
//   sundian     → toh_sundian        (the doc's own header capitalises Sundian
//                                     as a display name; the id is lowercase)
export const CLASS_DOCS = {
  assassin: 'toh_assassin',
  bard: 'toh_bard',
  blacksmith: 'toh_blacksmith',
  druid: 'toh_druid',
  hunter: 'toh_hunter',
  mage: 'toh_mage',
  monk: 'toh_monk',
  necromancer: 'toh_necromancer',
  priest: 'toh_priest',
  samurai: 'toh_samurai',
  savage: 'toh_savage',
  sundian: 'toh_sundian',
  witchdoctor: 'toh_witch_doctor',
  wizard: 'toh_wizard',
};

// ---------------------------------------------------------------- the template

// In order. The `--- section ---` markers are fields too: a block that loses one
// still parses as a block, which is exactly how a field ends up filed under the
// wrong heading without anything noticing. Savage's Endless Slaughter shipped
// with THREAT under `--- growth ---` for that reason.
export const TEMPLATE = [
  'SKILL NAME', 'CLASS / TREE / TIER', 'TYPE', 'AXIS POSITION',
  '--- delivery ---', 'CAST', 'SHAPE', 'RANGE', 'TARGETS',
  '--- output ---', 'DAMAGE TIER', 'PACE', 'DOMAIN',
  '--- effects ---', 'RIDERS', 'DOT', 'AFFECTS',
  '--- automation ---', 'TRIGGER', 'THREAT',
  '--- growth ---', 'RANK ADDS',
  '--- identity ---', 'ENGINE', 'COST', 'VISUAL', 'FLAVOR',
];
const TEMPLATE_SET = new Set(TEMPLATE);

// Departures from 30, each for a stated reason, so that losing a block is a red
// check rather than a quiet 30.
//
//   necromancer 31 — `necro_skeleton_branch`, an exclusive pair (Blood Skeleton
//                    / Marrow Skeleton) both at tier_code 5.
//   samurai     26 — Water, Stone and Fire Stance left the tree by ruling: the
//                    stance machine is the built `three_stances` trait, not
//                    three slotted nodes, so they are a trait spec in the
//                    document's prose and no longer skill blocks. Five of the
//                    remaining seven moved into Armor; Disciplined Breath was
//                    deleted, its whole function having been a Resolve restore.
export const EXPECTED_BLOCKS = { necromancer: 31, samurai: 26 };
const DEFAULT_BLOCKS = 30;

// A field line: a caps name at column 0 followed by a colon. Continuation lines
// are indented, so column 0 is the entire discriminator and no value can
// masquerade as a field.
const FIELD = /^([A-Z][A-Z0-9 '/]*[A-Z])\s*:/;
const MARKER = /^---\s*([a-z]+)\s*---\s*$/;

function blocksOf(text) {
  const lines = text.split('\n');
  const starts = [];
  lines.forEach((l, i) => { if (l.startsWith('SKILL NAME:')) starts.push(i); });
  return starts.map((start, n) => {
    const end = n + 1 < starts.length ? starts[n + 1] : lines.length;
    const seen = [];
    for (let i = start; i < end; i++) {
      const m = MARKER.exec(lines[i]);
      if (m) { seen.push({ name: `--- ${m[1]} ---`, line: i + 1 }); continue; }
      const f = FIELD.exec(lines[i]);
      if (f) seen.push({ name: f[1], line: i + 1 });
    }
    return { name: lines[start].slice('SKILL NAME:'.length).trim(), line: start + 1, seen };
  });
}

// `CLASS / TREE / TIER: <class> / <tree> / tier_code N` split into its three
// parts.
//
// NOT a plain split on '/': the Wizard's trees are named `Fire/Wind` and
// `Ice/Poison`, so his line carries four segments where everyone else's carries
// three, and a naive split silently reports his trees as "Fire" and "Ice". The
// class is the first segment and the tier is the last; the tree is everything
// between, rejoined. That holds for a tree name containing any number of
// slashes and needs no exception for the Wizard.
function partsOf(block, lines) {
  const f = block.seen.find(s => s.name === 'CLASS / TREE / TIER');
  if (!f) return null;
  const segs = lines[f.line - 1].split(':').slice(1).join(':').split('/').map(s => s.trim());
  if (segs.length < 3) return null;
  return { cls: segs[0].toLowerCase(), tree: segs.slice(1, -1).join('/'), tier: segs[segs.length - 1] };
}
// Lower-cased, because the doc that capitalises the class is naming a character
// and the code that does not is naming a key.
function classTokenOf(block, lines) {
  const p = partsOf(block, lines);
  return p ? p.cls || null : null;
}

function problemsOf(b) {
  const problems = [];
  const names = b.seen.map(s => s.name);
  const counts = new Map();
  for (const n of names) counts.set(n, (counts.get(n) || 0) + 1);

  for (const want of TEMPLATE) if (!counts.has(want)) problems.push(`missing field "${want}"`);
  for (const [n, c] of counts) {
    if (!TEMPLATE_SET.has(n)) problems.push(`unknown field "${n}" (line ${b.seen.find(s => s.name === n).line})`);
    else if (c > 1) problems.push(`field "${n}" appears ${c} times`);
  }
  // Order. Walk the template-known fields and flag the one that goes backwards,
  // not every field after it — one displaced field should read as one problem.
  let cursor = -1;
  for (const n of names.filter(x => TEMPLATE_SET.has(x))) {
    const idx = TEMPLATE.indexOf(n);
    if (idx < cursor) problems.push(`field "${n}" out of template order (line ${b.seen.find(s => s.name === n).line}) — follows "${TEMPLATE[cursor]}"`);
    else cursor = idx;
  }
  return problems;
}

// ---------------------------------------------------------------- the gate

// Returns { checks: [{ ok, msg }], fails } so a caller can report through its
// own harness. Nothing here prints, so `sim_test` owns its own output format.
export function checkClassDocs() {
  const checks = [];
  const ok = (msg) => checks.push({ ok: true, msg });
  const bad = (msg) => checks.push({ ok: false, msg });

  let files;
  try { files = readdirSync(DIR).filter(f => f.endsWith('.md')).sort(); }
  catch (e) { bad(`docs/design/classes/ is unreadable: ${e.message}`); return { checks, fails: 1 }; }

  const docs = files.filter(f => !NOT_A_CLASS.has(f)).map(f => f.replace(/\.md$/, ''));

  // -- the bridge, both directions --
  //
  // Three arities, because a rename can break any one of them independently:
  // the mapping against the docs on disk, the mapping against the code, and —
  // the one that catches a class added to the code and never documented — the
  // code against the mapping.
  const mapped = Object.keys(CLASS_DOCS);
  const live = Object.keys(TREES_BY_CLASS);

  const undocumented = mapped.filter(d => !docs.includes(d));
  const unmapped = docs.filter(d => !mapped.includes(d));
  if (!undocumented.length && !unmapped.length) ok(`every class doc is in CLASS_DOCS and vice versa (${docs.length})`);
  if (undocumented.length) bad(`CLASS_DOCS names ${undocumented.join(', ')} — no such file in docs/design/classes/`);
  if (unmapped.length) bad(`docs/design/classes/ carries ${unmapped.join(', ')}.md — absent from CLASS_DOCS`);

  const dangling = mapped.filter(d => !TREES_BY_CLASS[CLASS_DOCS[d]]);
  if (!dangling.length) ok(`every CLASS_DOCS id resolves to a live class in TREES_BY_CLASS (${mapped.length})`);
  for (const d of dangling) bad(`${d}.md maps to "${CLASS_DOCS[d]}", which is not a class in TREES_BY_CLASS — a rename on the code side`);

  const uncovered = live.filter(id => !Object.values(CLASS_DOCS).includes(id));
  if (!uncovered.length) ok(`every class in TREES_BY_CLASS is covered by a doc (${live.length})`);
  for (const id of uncovered) bad(`the code has class "${id}" and no document covers it`);

  // -- per file --
  for (const f of files) {
    if (NOT_A_CLASS.has(f)) continue;
    const doc = f.replace(/\.md$/, '');
    const text = readFileSync(new URL(f, DIR), 'utf8');
    const lines = text.split('\n');
    const blocks = blocksOf(text);

    const want = EXPECTED_BLOCKS[doc] ?? DEFAULT_BLOCKS;
    if (blocks.length === want) ok(`${doc}: ${blocks.length} skill blocks`);
    else bad(`${doc}: ${blocks.length} skill blocks, expected ${want}`);

    // Every block's own class token, not just the file's name — a block copied
    // between documents keeps the class it was written for, and that is the
    // transcription error this catches.
    const wrong = [];
    for (const b of blocks) {
      const tok = classTokenOf(b, lines);
      if (tok !== doc) wrong.push(`${b.name} (line ${b.line}) says "${tok}"`);
    }
    if (!wrong.length) ok(`${doc}: every block's class token reads "${doc}" → ${CLASS_DOCS[doc] || '(unmapped)'}`);
    else bad(`${doc}: ${wrong.length} block(s) name another class — ${wrong.slice(0, 3).join('; ')}${wrong.length > 3 ? ` (+${wrong.length - 3})` : ''}`);

    const broken = blocks.map(b => ({ b, problems: problemsOf(b) })).filter(x => x.problems.length);
    if (!broken.length) ok(`${doc}: all ${blocks.length} blocks parse against the template's ${TEMPLATE.length} fields`);
    // Capped at three. One lost `SKILL NAME:` header merges two blocks and
    // reports every field in the second as a duplicate AND out of order — fifty
    // lines describing one deletion. The first three name the defect; the rest
    // is the same defect counted again.
    for (const { b, problems } of broken) bad(`${doc} / ${b.name} (line ${b.line}): ${problems.slice(0, 3).join('; ')}${problems.length > 3 ? ` (+${problems.length - 3} more)` : ''}`);
  }

  const missingCompanions = [...NOT_A_CLASS].filter(f => !files.includes(f));
  if (!missingCompanions.length) ok(`the ${NOT_A_CLASS.size} companion documents are filed alongside them`);
  for (const f of missingCompanions) bad(`${f} is missing from docs/design/classes/`);

  return { checks, fails: checks.filter(c => !c.ok).length };
}

// ------------------------------------------------------- the tree inventory

// REPORTED, NEVER CHECKED — and deliberately not part of `checkClassDocs`, so
// there is no route by which it can reach a failure count.
//
// The class-id bridge is a gate because there is exactly one right answer: an
// id either resolves or it does not. Tree names are not that. These documents
// are CONVERSION PROPOSALS carrying Thrones of Heaven's tree structure, and the
// built trees are what the code settled on; where they disagree, the resolution
// is a design call per class — adopt the doc's names, keep the built ones, or
// decide the doc describes a tree that was never built. A gate would be
// asserting an answer that has not been given yet, and a red check nobody can
// action is how a suite stops being read.
//
// So this counts and prints and returns, and that is all.
export function treeInventory() {
  const rows = [];
  for (const doc of Object.keys(CLASS_DOCS)) {
    let text;
    try { text = readFileSync(new URL(`${doc}.md`, DIR), 'utf8'); } catch { continue; }
    const lines = text.split('\n');

    // In order of first appearance, which is tree order in the document.
    const docTrees = [];
    for (const b of blocksOf(text)) {
      const p = partsOf(b, lines);
      if (p && p.tree && !docTrees.includes(p.tree)) docTrees.push(p.tree);
    }
    const codeTrees = (TREES_BY_CLASS[CLASS_DOCS[doc]] || []).map(id => TREES[id]?.name || id);

    // Exact is case-insensitive equality and nothing cleverer. "Related" is one
    // name containing the other — the Druid's `Nature's Restoration` against the
    // built `Restoration`, the Savage's `Blood` against `Bloodbound`. Kept in
    // its own column rather than folded into the match count, because whether
    // those are the same tree under two names or two different trees is exactly
    // the judgement this inventory refuses to make.
    const lc = (s) => s.toLowerCase();
    const exact = docTrees.filter(t => codeTrees.some(c => lc(c) === lc(t)));
    const related = docTrees.filter(t => !exact.includes(t)
      && codeTrees.some(c => lc(c).includes(lc(t)) || lc(t).includes(lc(c))));
    rows.push({ doc, docTrees, codeTrees, exact, related });
  }
  return rows;
}

// ---------------------------------------------------------------- CLI

if (import.meta.url === `file://${process.argv[1]}`) {
  const verbose = process.argv.includes('--verbose');
  const { checks, fails } = checkClassDocs();
  console.log('THE CLASS CONVERSION DOCUMENTS, AGAINST THE CODE\n');
  for (const c of checks) if (!c.ok || verbose) console.log(`${c.ok ? '✓' : '✗'} ${c.msg}`);
  if (!verbose) console.log(`(${checks.length - fails} passing checks not shown — --verbose for all)`);

  // The inventory prints after the verdict and takes no part in it.
  const rows = treeInventory();
  const tot = rows.reduce((n, r) => n + r.exact.length, 0);
  console.log('\n\nTREE NAMES — REPORTED, NOT CHECKED');
  console.log('These documents are conversion proposals; the built trees are what the code');
  console.log('settled on. Divergence is expected and each class is a design call.\n');
  const w = Math.max(...rows.map(r => r.docTrees.join(' / ').length));
  const v = Math.max(...rows.map(r => r.codeTrees.join(' / ').length));
  console.log(`  ${'class'.padEnd(13)}${'doc trees'.padEnd(w + 3)}${'built trees'.padEnd(v + 3)}match`);
  for (const r of rows) {
    const mark = r.exact.length === 3 ? 'all 3' : r.exact.length ? `${r.exact.length} of 3` : 'none';
    console.log(`  ${r.doc.padEnd(13)}${r.docTrees.join(' / ').padEnd(w + 3)}${r.codeTrees.join(' / ').padEnd(v + 3)}${mark}`);
    if (r.related.length) console.log(`  ${''.padEnd(13)}└ related, not identical: ${r.related.map(t => `"${t}"`).join(', ')}`);
  }
  console.log(`\n  ${tot} of 42 tree names match exactly; ${rows.filter(r => !r.exact.length).length} of 14 classes match none.`);

  console.log(fails ? `\n${fails} FAILURE(S)` : `\nALL ${checks.length} CLASS-DOC CHECKS PASSED`);
  process.exit(fails ? 1 : 0);
}
