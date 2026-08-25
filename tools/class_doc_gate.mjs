// THE CLASS CONVERSION DOCUMENTS, CHECKED AGAINST THE CODE.
//
// `docs/design/classes/` holds fourteen conversion documents, one per class,
// each a run of skill blocks in a fixed field template. They are design source:
// numbers get read out of them and typed into `js/`. So the failure mode is the
// one `doc_gate` was written for (§13 rule 70) — a document nobody checks
// drifts faster than the code it governs, and here the drift arrives as a wrong
// number rather than a wrong sentence.
//
// FIVE CHECKS, AND THEY FAIL FOR DIFFERENT REASONS.
//
// 1. THE TEMPLATE. Every block carries the same 27 fields in the same order.
//    Names and order only. A missing or misspelled field name is what turns
//    into a wrong number later: whoever transcribes `THREAT` from under
//    `--- growth ---` has already lost the guarantee that it means what the
//    template says it means.
//
// THIS GATE USED TO READ NO VALUES AT ALL, AND SAID SO HERE AS A GUARANTEE:
// names and order only, "so it cannot be fooled by a plausible figure in the
// right slot." THAT PREMISE IS RETIRED, because it was answering the wrong
// question. It is true that a value-blind gate cannot be fooled by a plausible
// figure. It is also true that it cannot NOTICE one, and a plausible figure in
// the right slot is precisely what went wrong.
//
// WHAT HAPPENED. A sweep cut sixty-eight rider durations across the fourteen
// documents. Five of the cuts were category errors and were reverted by hand
// after a human read the diff. Every one of the five — before and after the
// revert — passed all 46 checks this gate then had, because each wrong number
// sat in a correctly-spelled field in the correct template position. Well-formed
// is not the same as true, and a gate that only measures well-formedness is
// green for both.
//
// SO THE FAILURE SHAPE IS CROSS-FIELD CONTRADICTION, and that is what checks 3
// 4 and 5 test. None of them ranks a number or has an opinion about whether 840ms
// is the right stun: that judgment stays out of this file, exactly as before.
// What they assert is INTERNAL CONSISTENCY — that a block which states the same
// quantity twice states it the same way both times, and that an annotation
// which shows its own arithmetic can have that arithmetic checked. A document
// can still be wrong about the game. It can no longer disagree with itself in
// silence.
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
// 3. CROSS-FIELD DURATION AGREEMENT. See `dotSignature` below.
// 4. ANNOTATION ARITHMETIC. See `PCT_OF_CD` below.
// 5. ROSTER RULING 6 ITSELF. See `ruling6` below — and note that its exemption
//    list is read out of the class files, never written down in here.
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

// ------------------------------------------------- values, and reading them

// THE FIELD'S VALUE, joined across its continuation lines.
//
// `blocksOf` records where each field STARTS. A value runs from there to the
// line before the next field in the same block, and continuation lines are
// indented, so this is a slice rather than a parse — the same column-0
// discriminator the template check already trusts.
function valuesOf(block, lines) {
  const out = {};
  for (let i = 0; i < block.seen.length; i++) {
    const f = block.seen[i];
    if (f.name.startsWith('---')) continue;
    const start = f.line - 1;
    let end = i + 1 < block.seen.length ? block.seen[i + 1].line - 1 : start + 1;
    // The last field in a block has no successor to stop at, so walk its own
    // indented continuations instead of truncating it to one line.
    if (i + 1 >= block.seen.length) {
      while (end < lines.length && /^\s+\S/.test(lines[end])) end++;
    }
    const head = lines[start].slice(lines[start].indexOf(':') + 1).trim();
    const tail = lines.slice(start + 1, end).map(l => l.trim()).filter(Boolean);
    out[f.name] = [head, ...tail].join(' ').trim();
  }
  return out;
}

// AN ANNOTATION RESTATES THE VALUE IT REPLACED, so a reader that takes every
// number in a field reads the old one as if it were live. `2500ms→1400ms` and
// "cut from an authored 4000ms" both carry a number that is deliberately no
// longer true, and both are labelled as such — which is what makes them
// strippable rather than guessable.
const HISTORY = [
  /—\s*roster ruling \d+.*$/s,
  /\bcut from (?:an authored )?[\d.]+\s*m?s\b/gi,
  /\bwas\s+\+?[\d.]+\s*m?s\b/gi,
];
function stripHistory(text) {
  let t = text || '';
  for (const re of HISTORY) t = t.replace(re, ' ');
  return t;
}

// ---------------------------------------------- 3. cross-field duration

// A DAMAGE-OVER-TIME'S TWO NUMBERS: the tick period and the total duration.
//
// `5 per 1000ms for 6000ms` and `a pool lasting 4000ms, 5 damage per 500ms` are
// the same statement in two orders, so each number is found by its own
// preposition rather than by its position.
//
// WHY THE SIGNATURE IS BOTH NUMBERS AND NOT JUST THE DURATION. A field can
// mention a duration for any reason; a field carrying a tick period AND a
// duration is stating a DoT. Requiring both is what makes this a comparison of
// the same effect rather than of two numbers that happen to share a unit — and
// it is incidentally annotation-proof, because no annotation carries a `per`.
function dotSignature(text) {
  const t = stripHistory(text);
  const tick = /\bper\s+(\d+)\s*ms/i.exec(t);
  const dur = /\b(?:for|lasting)\s+(?:up to\s+)?(\d+)\s*ms/i.exec(t);
  return tick && dur ? { tick: +tick[1], dur: +dur[1] } : null;
}

// KNOWN LIMIT, AND IT IS STRUCTURAL: this cannot catch a block with no second
// field to compare against. `sundian/Moonstone Ward` states an 8000ms refresh
// cadence and a 10000ms proc cooldown in RIDERS against `DOT: none`, and is
// invisible here no matter how wrong those numbers become. A check that
// compares two statements is silent whenever there is only one, and the answer
// to that is a different check, not a looser version of this one.
function durationAgreement(doc, blocks, lines) {
  const bad = [];
  let compared = 0;
  for (const b of blocks) {
    const v = valuesOf(b, lines);
    const r = dotSignature(v['RIDERS'] || '');
    const d = dotSignature(v['DOT'] || '');
    if (!r || !d) continue;
    compared++;
    if (r.tick !== d.tick || r.dur !== d.dur) {
      bad.push(`${b.name} (line ${b.line}): RIDERS says ${r.tick}ms/${r.dur}ms, DOT says ${d.tick}ms/${d.dur}ms`);
    }
  }
  return { compared, bad };
}

// ---------------------------------------------- 4. annotation arithmetic

// `(70% of the 1.2s cooldown)` / `(70% of the 1200ms cooldown)` — an annotation
// that shows its working. Both units appear in the corpus, so both are read.
const PCT_OF_CD = /(\d+)%\s+of\s+the\s+([\d.]+)\s*(ms|s)\b\s*cooldown/i;
// `2800ms→840ms` — the cut it recorded, right-hand side being what now stands.
const CUT_ARROW = /(\d+)\s*ms\s*→\s*(\d+)\s*ms/g;
// `PACE: fast (1200ms)`
const PACE_MS = /\((\d+)\s*ms\)/;

// AN ANNOTATION THAT NAMES ITS OWN COOLDOWN CAN BE CHECKED AGAINST THE BLOCK'S.
//
// This is the more general of the two checks, because it does not depend on the
// document repeating itself. `samurai/Hamstring Shot` reads
// "cut ... by roster ruling 6 (70% of the 2s cooldown)" on a block whose PACE
// field says fast (1200ms): the annotation names a cooldown the block does not
// carry, and the 1400ms rider it justifies therefore outlives the cooldown it
// was supposed to fit inside. Nothing about that is malformed and nothing about
// it is unusual-looking. It is only visible if something multiplies it out.
function annotationArithmetic(doc, blocks, lines) {
  const bad = [];
  let verified = 0;
  for (const b of blocks) {
    const v = valuesOf(b, lines);
    const riders = v['RIDERS'] || '';
    const m = PCT_OF_CD.exec(riders);
    if (!m) continue;
    const paceM = PACE_MS.exec(v['PACE'] || '');
    if (!paceM) {
      bad.push(`${b.name} (line ${b.line}): annotation cites a cooldown but PACE carries none ("${(v['PACE'] || '').slice(0, 40)}")`);
      continue;
    }
    const pace = +paceM[1];
    const pct = +m[1];
    const declared = m[3].toLowerCase() === 's' ? Math.round(parseFloat(m[2]) * 1000) : +m[2];
    verified++;

    // (a) the cooldown the annotation names must be the block's own.
    if (declared !== pace) {
      bad.push(`${b.name} (line ${b.line}): annotation says ${pct}% of a ${declared}ms cooldown, PACE says ${pace}ms`);
    }
    // (b) and where it recorded the cut, the result must be that percentage of
    //     the REAL cooldown — not of the one the annotation claimed.
    const want = Math.round(pace * pct / 100);
    for (const a of riders.matchAll(CUT_ARROW)) {
      if (+a[2] !== want) {
        bad.push(`${b.name} (line ${b.line}): annotation cuts ${a[1]}ms→${a[2]}ms, but ${pct}% of the ${pace}ms cooldown is ${want}ms`);
      }
    }
  }
  return { verified, bad };
}

// ---------------------------------------------- 5. ruling 6, asserted directly

// THE RULE THE WHOLE SWEEP WAS ABOUT, AND THE ONE THAT HAD NO INSTRUMENT.
//
// Roster ruling 6: a rider's duration may not exceed its skill's cooldown, and
// where it did, the cut was to ~70% of that cooldown. Checks 3 and 4 each catch
// a way of getting this wrong, but both need something extra to compare
// against — 3 needs the block to state the duration twice, 4 needs an
// annotation that shows its own arithmetic. `necromancer/Tainted Dark Matter`
// has neither: `DOT: none`, no annotation, and a 4000ms vulnerability on a
// 2000ms cooldown. Nothing looked at it because nothing was asking the rule's
// own question.
//
// So this asks it. Rider duration against the block's own PACE, directly.

const RIDER_MAX_RATIO = 0.7;
// The ruling's floor: a rider cut below 500ms is deleted rather than shortened,
// so anything at or under it is not a candidate for this rule at all.
const RIDER_FLOOR_MS = 500;

// `(70% of the 1200ms cooldown)` survives `stripHistory` whenever the
// annotation is not introduced by an em-dash. It states a COOLDOWN, and check 4
// already owns it — read here it would look like a rider the length of the
// cooldown, which is the false positive most likely to discredit this check.
const PCT_CLAUSE = /\(\s*\d+%\s+of\s+the\s+[\d.]+\s*m?s\s+cooldown\s*\)/gi;

// MILLISECONDS ONLY, DELIBERATELY. Every rider duration in the corpus is
// written in ms; a bare `Ns` inside RIDERS is prose about a cooldown or a
// bucket, not a rider — "the slow bucket's 3s sits under a 10s channel" is a
// sentence about pacing. Reading those would flag the sentence rather than the
// rider.
//
// THE COST OF THAT IS NAMED: `necromancer/Death Channel` states its numbers
// only in prose seconds, so this check cannot see it. Its contradiction is
// PACE against prose in RIDERS and COST, which is a fourth check and not a
// looser version of this one.
//
// A TICK PERIOD IS NOT A DURATION either. "6 per 1000ms for 2800ms" is one
// rider lasting 2800ms that ticks every second; reading the 1000ms as a rider
// would flag every damage-over-time in the roster against its own tick rate.
function riderDurations(text) {
  const t = stripHistory(text)
    .replace(PCT_CLAUSE, ' ')
    .replace(/\bper\s+\d+\s*ms/gi, ' ');
  return [...t.matchAll(/(\d+)\s*ms/g)].map(m => +m[1]);
}

// THE EXEMPTION IS READ FROM THE DOCUMENT, NEVER FROM A LIST IN HERE.
//
// Five skills are held out of ruling 6, and each says so in its own file:
//
//     **Exempt:** Toxic Bolt held — its `RIDERS` line restates the poison DoT
//     in `DOT:`, and stacking DoTs are exempt.
//
// Hardcoding those five names here would put the judgment in the tool instead
// of the document, and a reader of `wizard.md` would have no way to know the
// skill was exempt. The declaration lives where the decision was made; this
// only obeys it.
//
// IT IS A FILE-LEVEL LINE NAMING A SKILL, not a marker inside the block, so the
// link between the two is a name match and a name match can rot. An `**Exempt:**`
// line naming a skill this file does not contain is therefore a failure in its
// own right — otherwise renaming a block silently revokes its exemption and the
// gate goes red for a reason nobody wrote down.
const EXEMPT_LINE = /^\*\*Exempt:\*\*\s+(.+?)\s+held\b/;

function ruling6(doc, blocks, lines) {
  const bad = [];
  const declared = [];
  for (const l of lines) {
    const m = EXEMPT_LINE.exec(l);
    if (m) declared.push(m[1].trim());
  }
  const names = new Set(blocks.map(b => b.name));
  for (const d of declared) {
    if (!names.has(d)) bad.push(`**Exempt:** names "${d}", which is not a skill block in this file`);
  }
  const exempt = new Set(declared);

  let checked = 0;
  for (const b of blocks) {
    if (exempt.has(b.name)) continue;
    const v = valuesOf(b, lines);
    const paceM = PACE_MS.exec(v['PACE'] || '');
    if (!paceM) continue;                 // passives and n/a carry no cooldown
    const pace = +paceM[1];
    const limit = pace * RIDER_MAX_RATIO;
    for (const d of riderDurations(v['RIDERS'] || '')) {
      checked++;
      if (d <= RIDER_FLOOR_MS) continue;
      if (d > limit) {
        bad.push(`${b.name} (line ${b.line}): rider ${d}ms is ${Math.round(100 * d / pace)}% of its ${pace}ms cooldown, over the 70% ruling 6 allows`);
      }
    }
  }
  return { checked, exempt: declared.length, bad };
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

    // -- 3. the same duration, stated twice, must agree --
    const dur = durationAgreement(doc, blocks, lines);
    if (!dur.bad.length) ok(`${doc}: ${dur.compared} block(s) state a DoT in both RIDERS and DOT, and agree`);
    for (const m of dur.bad) bad(`${doc} / ${m}`);

    // -- 4. an annotation that shows its arithmetic must be right --
    const ann = annotationArithmetic(doc, blocks, lines);
    if (!ann.bad.length) ok(`${doc}: ${ann.verified} annotation(s) cite a cooldown, and it matches PACE`);
    for (const m of ann.bad) bad(`${doc} / ${m}`);

    // -- 5. ruling 6 itself: no rider longer than 70% of its own cooldown --
    const r6 = ruling6(doc, blocks, lines);
    if (!r6.bad.length) ok(`${doc}: ${r6.checked} rider duration(s) under 70% of their cooldown, ${r6.exempt} held exempt by the file`);
    for (const m of r6.bad) bad(`${doc} / ${m}`);
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
