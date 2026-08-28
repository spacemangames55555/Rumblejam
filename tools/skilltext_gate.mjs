// EVERY SKILL STATES ITS MECHANICS, AND NO SKILL STATES THEM BY HAND.
//
//   node tools/skilltext_gate.mjs [--verbose]
//
// Two failures this exists to catch, and they are opposites.
//
//   FLAVOUR-ONLY. A skill shipped with a sentence of prose and no numbers. A
//   player cannot compare it to anything, which is the defect the whole patch
//   addresses. Caught by requiring a mechanical line with the fields that apply.
//
//   HAND-TYPED NUMBERS. A number in a `flavor` string is correct until the next
//   tuning edit and silently wrong afterwards. 216 of 420 descriptions carried
//   one before this patch. Same shape as `statname_gate`: the value comes from
//   the def or it is not shown.
//
// Plus the live-rank claim, asserted BY EFFECT rather than by reading the
// formula: a rank-1 and a rank-10 view of the same skill must display different
// damage. A generator that ignored its rank argument would pass every structural
// check above and fail this one.
import { readFileSync, readdirSync } from 'node:fs';
import { TREES } from '../js/skills.js';
import { mechanics, mechanicalLine, passiveText, SHAPES, SHAPE_ADDED, RIDER_KINDS } from '../js/skilltext.js';

const VERBOSE = process.argv.includes('--verbose');
let fails = 0, checks = 0;
const ok = m => { checks++; console.log(`✓ ${m}`); };
const bad = m => { checks++; fails++; console.log(`✗ ${m}`); };

const ALL = Object.values(TREES).flatMap(t => t.skills);
const ACTIVES = ALL.filter(s => s.type === 'active');
const PASSIVES = ALL.filter(s => s.type === 'passive');

console.log(`SKILL TEXT — ${ALL.length} skills, ${ACTIVES.length} active, ${PASSIVES.length} passive\n`);

// ---- 1. every active produces a mechanical line ------------------------------
{
  const empty = ACTIVES.filter(s => !mechanics(s, 1).fields.length);
  if (empty.length) bad(`${empty.length} active(s) produce an EMPTY mechanical line — flavour-only content: ${empty.map(s => s.id).slice(0, 8).join(', ')}`);
  else ok(`all ${ACTIVES.length} actives produce a non-empty mechanical line`);
}

// ---- 2. the required fields, on the skills they apply to --------------------
//
// Damage and shape are required of DAMAGING actives only. 77 actives are pure
// support — ward, shield, heal, shift, form and the summons — and a gate that
// demanded a damage figure from a ward would be demanding a number that does
// not exist. Those are checked for what they DO state instead, so "it has no
// damage" can never be the reason a skill states nothing.
{
  const damaging = ACTIVES.filter(s => (s.compose || []).some(c => (c.damage || 0) > 0));
  const support = ACTIVES.filter(s => !(s.compose || []).some(c => (c.damage || 0) > 0));
  const missing = { damage: [], cooldown: [], range: [], shape: [] };
  for (const s of damaging) {
    const keys = new Set(mechanics(s, 1).fields.map(f => f.key));
    for (const k of ['damage', 'cooldown', 'range', 'shape']) if (!keys.has(k)) missing[k].push(s.id);
  }
  let anyMissing = 0;
  for (const [k, ids] of Object.entries(missing)) {
    if (!ids.length) continue;
    anyMissing += ids.length;
    bad(`${ids.length} damaging active(s) state no ${k}: ${ids.slice(0, 8).join(', ')}`);
  }
  if (!anyMissing) ok(`all ${damaging.length} damaging actives state damage, cooldown, range and shape`);

  const silent = support.filter(s => !mechanics(s, 1).fields.some(f => ['amount', 'summon', 'shift', 'form', 'duration'].includes(f.key)));
  if (silent.length) bad(`${silent.length} support active(s) state no effect magnitude: ${silent.map(s => s.id).slice(0, 8).join(', ')}`);
  else ok(`all ${support.length} non-damaging actives state their own magnitude (absorb, heal, summon, form or shift)`);
}

// ---- 3. no mechanical value is hardcoded in a flavour string ----------------
//
// A DIGIT is the test, deliberately blunt. "Deals 7 damage" and "slows to 76%"
// are both drift waiting to happen, and any softer rule ("only flag numbers
// next to a unit") would have let half of the 216 through.
{
  const withDigits = ALL.filter(s => /\d/.test(s.flavor || ''));
  if (withDigits.length) {
    bad(`${withDigits.length} flavour string(s) contain a digit — mechanical values must come from the def:`);
    for (const s of withDigits.slice(0, 10)) console.log(`    ${s.id}: ${JSON.stringify(s.flavor)}`);
  } else ok(`no flavour string in ${ALL.length} skills contains a digit`);

  // and the retired field name cannot come back carrying prose
  const stillDesc = ALL.filter(s => s.desc !== undefined);
  if (stillDesc.length) bad(`${stillDesc.length} skill(s) still declare \`desc\` — the field is \`flavor\`, and the mechanical half is generated: ${stillDesc.map(s => s.id).slice(0, 6).join(', ')}`);
  else ok('no skill declares `desc`; flavour lives in `flavor` and mechanics are generated');
}

// ---- 3b. and the source files carry no hand-typed mechanics ------------------
//
// The check above reads the loaded objects; this one reads the FILES, so a
// number smuggled in through a template literal is caught too.
{
  const dir = new URL('../js/content/skills/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js'));
  const offenders = [];
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    src.split('\n').forEach((ln, i) => {
      const m = /^\s*flavor:\s*(.*),\s*$/.exec(ln);
      if (m && /\d/.test(m[1])) offenders.push(`${f}:${i + 1} ${m[1].trim()}`);
    });
  }
  if (offenders.length) {
    bad(`${offenders.length} \`flavor:\` line(s) in source carry a digit:`);
    offenders.slice(0, 8).forEach(o => console.log(`    ${o}`));
  } else ok(`no \`flavor:\` line in ${files.length} content files carries a digit`);
}

// ---- 4. rank is live, asserted by effect ------------------------------------
{
  const flat = [];
  for (const s of ACTIVES) {
    // A SKILL CAPPED AT ONE RANK CANNOT BE AT RANK 10, so comparing its two
    // renders compares a state the game will not produce. `maxRank: 1` is the
    // codebase's own word for "an unlock, not an investment" — the passive rule
    // has said so since phase 1 — and Hex of Entropy is the first ACTIVE to
    // need it: its document ranks a radius and a zone's slow duration, and
    // neither is a dial `ranks` has. Skipped rather than exempted by id.
    if (s.maxRank === 1) continue;
    const a = mechanics(s, 1).fields.find(f => f.key === 'damage' || f.key === 'amount');
    const b = mechanics(s, 10).fields.find(f => f.key === 'damage' || f.key === 'amount');
    if (a && b && a.now === b.now) flat.push(s.id);
  }
  if (flat.length) bad(`${flat.length} skill(s) render the same magnitude at rank 1 and rank 10 — the view is not reading its rank: ${flat.slice(0, 8).join(', ')}`);
  else ok(`every active renders a different magnitude at rank 1 and rank 10 (${ACTIVES.length} checked)`);

  // and the next-rank preview is actually a preview
  const noArrow = ACTIVES.filter(s => !mechanics(s, 4).fields.some(f => f.next !== undefined));
  if (noArrow.length) bad(`${noArrow.length} active(s) show no next-rank value at all: ${noArrow.slice(0, 6).map(x => x.id).join(', ')}`);
  else ok('every active previews at least one next-rank value, so the cost of a point is visible before it is spent');

  // a figure that does NOT move with rank must not sprout an arrow
  const falseArrow = [];
  for (const s of ACTIVES) {
    for (const f of mechanics(s, 1).fields) if (f.next !== undefined && f.next === f.now) falseArrow.push(`${s.id}/${f.key}`);
  }
  if (falseArrow.length) bad(`${falseArrow.length} field(s) show an arrow to an identical value: ${falseArrow.slice(0, 6).join(', ')}`);
  else ok('no field previews a next-rank value identical to its current one');
}

// ---- 5. the vocabulary covers what the roster actually does ------------------
{
  const named = new Set(Object.values(SHAPES).filter(Boolean));
  const used = new Set();
  for (const s of ACTIVES) for (const sh of mechanics(s, 1).shapes) used.add(sh);
  const unnamed = [...used].filter(x => !named.has(x));
  if (unnamed.length) bad(`${unnamed.length} shape(s) rendered that the vocabulary does not name: ${unnamed.join(', ')}`);
  else ok(`every rendered shape is in the vocabulary (${[...used].length} in use of ${named.size} named; ${SHAPE_ADDED.length} added by this patch: ${SHAPE_ADDED.join(', ')})`);
}

// ---- 6. nothing a skill does goes undescribed -------------------------------
//
// A rider or passive key with no description rule is a mechanic the player
// cannot see. The generator reports these rather than dropping them silently.
{
  const warns = new Map();
  for (const s of ACTIVES) for (const w of mechanics(s, 1).warnings) warns.set(w, (warns.get(w) || 0) + 1);
  for (const s of PASSIVES) for (const w of passiveText(s).warnings) warns.set(w, (warns.get(w) || 0) + 1);
  if (warns.size) {
    bad(`${warns.size} undescribed mechanic(s):`);
    for (const [w, n] of warns) console.log(`    ${w} (${n} skills)`);
  } else ok(`every rider (${RIDER_KINDS.length} kinds) and every passive key has a description rule`);
}

// ---- 7. passives say something ----------------------------------------------
{
  const silent = PASSIVES.filter(s => !passiveText(s).text && !s.flavor);
  if (silent.length) bad(`${silent.length} passive(s) state neither an effect nor flavour: ${silent.map(s => s.id).slice(0, 8).join(', ')}`);
  else ok(`all ${PASSIVES.length} passives state an effect or carry flavour`);
}

if (VERBOSE) {
  console.log('\n--- every active, at rank 1 ---');
  for (const s of ACTIVES) console.log(`  ${s.id.padEnd(26)} ${mechanicalLine(s, 1)}`);
}

console.log(`\n${checks} checks, ${fails} failure(s)`);
process.exit(fails ? 1 : 0);
