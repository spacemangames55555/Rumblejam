// THE GDD, CHECKED AGAINST THE CODE.
//
// Draft 11 was a full reconciliation pass, and every divergence it found had
// the same shape: an edit that added a claim without removing the one it
// replaced. §8.2 said the Druid was the only class short of three trees in one
// sentence and that it had one tree in the next. §5.7's heading asked what
// admits a twelfth primitive above three sections documenting the twelfth,
// thirteenth and fourteenth. §15 declared Group A closed for good and then
// listed four classes it was waiting on.
//
// None of that survives a reader. All of it survived four drafts, because
// **nothing checks the document.** The code has a shelf of instruments; the document
// that rules the code had none, so it drifted faster than the thing it governs
// — which is backwards, since the document is where the rulings live.
//
// WHAT IS MECHANICALLY CHECKABLE, AND WHAT IS NOT. Prose is not assertable and
// this gate does not try. What IS assertable is every COUNT the document
// states, because each one exists in the code as a number: trees, skills,
// classes, primitives, riders, selectors, triggers, engines, tier levels, and
// the instruments in `tools/`. Those are exactly the claims that went stale —
// not one divergence in the Draft 11 report was a matter of judgement, and all
// but three were a number that had moved.
//
// The check is deliberately narrow. It does not parse the document's meaning;
// it looks for the specific sentences that carry a count and compares them to
// the code. A claim it cannot find fails LOUDLY rather than passing, because a
// silently-absent assertion is how §16 lost a whole instrument.
//
// Usage: node tools/doc_gate.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { TRIGGER_KINDS } from '../js/triggers.js';
import { SELECT_KINDS } from '../js/selectors.js';
import { PRIMITIVE_KINDS, IMPACT_RIDERS, SHAPE_RIDERS, BOLT_RIDERS } from '../js/compose.js';
import { TREES, TREES_BY_CLASS, TIER_LEVELS, TREE_NODES } from '../js/skills.js';
import { ENGINE_SCALE } from '../js/enginescale.js';

const DOC = readFileSync(new URL('../docs/GDD.md', import.meta.url), 'utf8');
let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };

const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  nineteen: 19, twenty: 20, twentyone: 21 };

// A claim is a named regex with a capture group holding the count, plus the
// truth. Missing claim = failure: the sentence is what makes the number
// checkable, so deleting it must not quietly disarm the check.
function claim(name, re, truth, { spelled = false } = {}) {
  const m = DOC.match(re);
  if (!m) {
    bad(`${name}: the document no longer contains the sentence this checks — either it was reworded `
      + `(update the pattern) or the claim was deleted (then so should this check be). Truth is ${truth}`);
    return;
  }
  const got = spelled ? NUM[m[1].toLowerCase()] : Number(m[1]);
  if (got === truth) ok(`${name}: document says ${spelled ? m[1] : got}, code says ${truth}`);
  else bad(`${name}: document says ${m[1]}, code says ${truth} — "${m[0].slice(0, 72)}…"`);
}

const nTrees = Object.keys(TREES).length;
const nSkills = Object.values(TREES).reduce((a, t) => a + t.skills.length, 0);
const nClasses = Object.keys(TREES_BY_CLASS).length;

console.log('THE GDD AGAINST THE CODE — counts only; prose is not assertable\n');

claim('§5.2 trigger count', /Trigger system, (\d+) kinds/, TRIGGER_KINDS.length);
claim('§5.3 selector count', /Selectors, (\d+) rules/, SELECT_KINDS.length);
claim('§5.7 primitive count', /an ordered list of steps from \*\*(\w+)\*\* primitives/, PRIMITIVE_KINDS.length, { spelled: true });
claim('§5.7 impact riders', /\*\*Impact riders\*\* \((\d+),/, IMPACT_RIDERS.length);
claim('§5.7 shape riders', /\*\*Shape riders\*\* \((\d+),/, SHAPE_RIDERS.length);
claim('§5.7 projectile riders', /\*\*Projectile riders\*\* \((\d+)\)/, BOLT_RIDERS.length);
claim('§5.7 result skills', /\*\*Result:\*\* (\d+) skills across \d+ trees/, nSkills);
claim('§5.7 result trees', /\*\*Result:\*\* \d+ skills across (\d+) trees/, nTrees);
claim('§8.1 shape spec nodes', /\| \*\*Nodes\*\* \| \*\*(\d+)\*\* \|/, TREE_NODES);
claim('§8.2 built trees', /\*\*Built: \d+ of \d+ — (\d+) trees/, nTrees);
claim('§8.2 built skills', /\*\*Built: \d+ of \d+ — \d+ trees, (\d+) skills/, nSkills);
claim('§8.2 built classes', /\*\*Built: (\d+) of \d+ —/, nClasses);
claim('§16 class trees', /\*\*COMPLETE — \d+ of \d+ built\*\* \((\d+) trees/, nTrees);
claim('§16 class skills', /\*\*COMPLETE — \d+ of \d+ built\*\* \(\d+ trees, (\d+) skills/, nSkills);
claim('§16 engine count', /Built across \*\*(\d+) engines\*\*/, Object.keys(ENGINE_SCALE).length);
claim('§16 engine gate', /`engine_gate\.mjs`: every key in `p\.engines`[^|]*?\*\*(\d+) of \d+\*\*/, Object.keys(ENGINE_SCALE).length);

// §8.1.1's tier table is ten rows of two numbers and both sides are data.
{
  checks++;
  const rows = [...DOC.matchAll(/^\| (\d+) \| (\d+) \| .*\|$/gm)]
    .map(m => [Number(m[1]), Number(m[2])]).filter(([t]) => t >= 1 && t <= 10);
  const doc = new Map(rows);
  const wrong = TIER_LEVELS.map((lv, i) => [i + 1, lv]).filter(([t, lv]) => doc.get(t) !== lv);
  if (doc.size === TIER_LEVELS.length && !wrong.length) ok(`§8.1.1 tier gates: all ${TIER_LEVELS.length} rows match TIER_LEVELS`);
  else { fails++; console.log(`✗ §8.1.1 tier gates: ${wrong.length} row(s) disagree with TIER_LEVELS `
    + `(${wrong.map(([t, lv]) => `tier ${t} should be level ${lv}, document says ${doc.get(t)}`).join('; ')})`); }
}

// THE INSTRUMENT COUNT, which is the claim that lost `tree_dps` for a draft.
//
// The truth is NOT a literal here. "Focused instrument" is a curated set — the
// twenty-odd gates, not every `.mjs` in `tools/` — so there is no expression in
// the code that yields it, and a hardcoded 20 in this file would be one more
// authored number that drifts (§13 rule 63). Instead the sentence is checked
// against ITSELF: the spelled count must equal the number of instruments the
// same sentence names, and every one of those must exist on disk. That makes
// the claim self-consistent and code-verified without inventing an authority.
{
  checks++;
  const m = DOC.match(/all (\w+) focused instruments are green — ([^.]*?)\.\s/s);
  if (!m) { fails++; console.log('✗ §15 instrument count: the sentence this checks is gone'); }
  else {
    const spelled = NUM[m[1].toLowerCase()];
    const named = [...m[2].matchAll(/`(\w+)`/g)].map(x => x[1]);
    const files = readdirSync(new URL('../tools/', import.meta.url));
    const missing = named.filter(n => !files.includes(n + '.mjs'));
    if (spelled === undefined) { fails++; console.log(`✗ §15 instrument count: "${m[1]}" is not a number this gate can read`); }
    else if (spelled !== named.length) { fails++; console.log(`✗ §15 says ${m[1]} (${spelled}) focused instruments and then names ${named.length}`); }
    else if (missing.length) { fails++; console.log(`✗ §15 names instruments that do not exist in tools/: ${missing.join(', ')}`); }
    else ok(`§15 says ${m[1]} focused instruments, names ${named.length}, and every one exists in tools/`);
  }
}

// Every tree in the registry must be named somewhere in the document. This is
// the check that would have caught §8.2 listing nine third trees while fourteen
// were built — a count alone cannot, because a count can be right about a set
// that has the wrong members. §13 rule 43: a count is not a set.
{
  checks++;
  const unnamed = Object.keys(TREES).filter(id => !DOC.includes(TREES[id].name));
  if (!unnamed.length) ok(`every one of the ${nTrees} trees is named in the document`);
  else { fails++; console.log(`✗ ${unnamed.length} tree(s) exist in code and appear nowhere in the GDD: `
    + `${unnamed.join(', ')} — a count can be right about a set with the wrong members (§13 rule 43)`); }
}

// And no primitive or engine may exist unmentioned.
for (const [what, list] of [['primitive', PRIMITIVE_KINDS], ['engine', Object.keys(ENGINE_SCALE)]]) {
  checks++;
  const missing = list.filter(k => !DOC.includes('`' + k + '`'));
  if (!missing.length) ok(`every ${what} (${list.length}) is mentioned in the document`);
  else { fails++; console.log(`✗ ${missing.length} ${what}(s) exist in code and are never mentioned: ${missing.join(', ')}`); }
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'THE DOCUMENT DISAGREES WITH THE CODE' : 'THE GDD\'S COUNTS MATCH THE CODE');
process.exit(fails ? 1 : 0);
