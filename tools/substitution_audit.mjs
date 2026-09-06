// WHAT SHIPPED, AGAINST WHAT THE DOCUMENT ASKED FOR.
//
// A SUBSTITUTION is a skill that was built as something else. Not a gap — a gap
// is visible, because nothing got built. A substitution ships, works, passes
// every gate, and delivers the wrong thing under the right name. Three were
// found by hand across four classes: Vanish's stealth became a plain shield,
// Caltrops' persistent field became a one-shot trap, Thick Hide's always-on
// passive became an active ward on a health trigger.
//
// Found by hand is the problem. This walks all fourteen documents against all
// 420 built skills so the count is a measurement rather than however many
// somebody happened to notice.
//
// READ THE COVERAGE LINE BEFORE QUOTING THE TALLY. This matches a document
// block to a built skill BY NAME, and only 36 of 417 blocks share a name with
// the skill that shipped. The other 381 are not unbuilt — every class is
// exactly thirty documented skills against exactly thirty built ones, so the
// roster is complete. They were RENAMED. Ten of the fourteen classes have zero
// name overlap at all. So this tool speaks for 8.6% of the roster, and for the
// part of it that stayed closest to its document: a skill that kept its name is
// a skill nobody rewrote. The renamed 91% is where substitutions would hide,
// and a name match cannot see into it.
//
// Matching by POSITION instead would cover everything — every class is three
// trees of ten, in both the documents and the code — but it needs a doc-tree to
// built-tree mapping, three pairs per class, and that is a ruling rather than a
// measurement. Sundian's own document calls two of its three a coin toss.
//
// THREE CHECKS, WEAKEST CLAIM FIRST, because a substitution audit that cries
// wolf gets ignored and then the real ones ship anyway:
//
//   TYPE. The document says passive and the code built an active, or the
//   reverse. Exact, no interpretation — a passive is always on and costs no
//   slot, an active fires on a trigger and occupies one. They are not
//   substitutes for each other and no reading makes them so.
//
//   DAMAGE. The document says it deals none and the build damages, or the
//   document gives a damage tier and the build deals nothing. Also exact.
//
//   CONCEPT. The document's own words name a mechanic — stealth, a persistent
//   field, a reflect, a root — and nothing in the built compose can deliver it.
//   This one is a heuristic and is reported separately, because a false
//   positive here is a wasted afternoon rather than a bug.
//
//   node tools/substitution_audit.mjs [--verbose] [--class <name>]

import { readFileSync, readdirSync } from 'node:fs';
import { TREES, TREES_BY_CLASS } from '../js/skills.js';
import { RIDERS_BY_PRIMITIVE } from '../js/compose.js';
import { CLASS_DOCS } from './class_doc_gate.mjs';

const VERBOSE = process.argv.includes('--verbose');
const ONLY = (() => { const i = process.argv.indexOf('--class'); return i > 0 ? process.argv[i + 1] : null; })();
const DIR = new URL('../docs/design/classes/', import.meta.url);

// ---- the documents, parsed into blocks keyed by skill name ----
function docBlocks(file) {
  const lines = readFileSync(new URL(file, DIR), 'utf8').split('\n');
  const starts = [];
  lines.forEach((l, i) => { if (l.startsWith('SKILL NAME:')) starts.push(i); });
  return starts.map((s, n) => {
    const body = lines.slice(s, n + 1 < starts.length ? starts[n + 1] : lines.length);
    const field = (name) => {
      const i = body.findIndex(l => l.startsWith(name + ':'));
      if (i < 0) return '';
      // a field's value continues onto indented lines
      let v = body[i].slice(body[i].indexOf(':') + 1).trim();
      for (let k = i + 1; k < body.length && /^\s{4,}\S/.test(body[k]); k++) v += ' ' + body[k].trim();
      return v;
    };
    return {
      name: field('SKILL NAME').replace(/\s*\[.*$/, '').trim(),
      type: field('TYPE').toLowerCase(),
      dmg: field('DAMAGE TIER').toLowerCase(),
      cast: field('CAST').toLowerCase(),
      riderText: (field('RIDERS') + ' ' + field('DOT')).toLowerCase(),
      riders: (field('RIDERS') + ' ' + field('DOT') + ' ' + field('CAST') + ' ' + field('SHAPE')).toLowerCase(),
    };
  });
}

// ---- what a built skill actually is ----
function built(sk) {
  const steps = sk.compose || [];
  return {
    type: sk.type,
    persist: !!sk.persist,
    kinds: steps.map(s => s.kind),
    // A SUMMON'S OWN SWING IS NOT THE CAST'S DAMAGE. Every summon document says
    // "DAMAGE TIER: none — the skeleton deals the damage, not the cast", and
    // counting the minion's attack here reported three correct summons as
    // substitutions. The cast places a body; the body hits.
    damage: steps.reduce((a, s) => a + (s.kind === 'summon' ? 0 : (s.damage || 0)), 0),
    riders: steps.flatMap(s => Object.keys(s.riders || {})),
    passiveKeys: Object.keys(sk.passive || {}),
  };
}

// A doc TYPE is one of six words; the engine has two (plus `persist`). Only the
// passive/active split is a real disagreement — buff, transformation,
// stacking_dot and channel are all actives that fire on a trigger.
const DOC_IS_PASSIVE = t => t.startsWith('passive');
const DOC_SAYS_NO_DAMAGE = d => /^(none|n\/a)\b/.test(d);

// CONCEPT CHECKS. Each names a phrase the document uses and what the build must
// carry for that phrase to be true. Deliberately few, and each one has a
// confirmed instance behind it — a list of everything a document might say
// would report the whole roster.
const CONCEPTS = [
  { re: /\bstealth|conceal|unseen|untargetable\b/, needs: b => b.riders.includes('stealth') || b.kinds.includes('shift'),
    say: 'stealth/concealment' },
  { re: /persistent (field|hazard|zone)|lingering|leaves a .*(field|pool|cloud)/, needs: b => b.kinds.includes('hazard') || b.kinds.includes('aura'),
    say: 'a persistent field' },
  { re: /\breflect/, needs: b => b.kinds.includes('ward') || b.passiveKeys.some(k => /reflect/i.test(k)),
    say: 'a reflect' },
  { re: /\broot\b/, needs: b => b.riders.includes('root'), say: 'a root' },
  { re: /\bconfus/, needs: b => b.riders.includes('confusion'), say: 'confusion' },
  { re: /\btaunt|magnet aggro\b/, needs: b => b.riders.includes('taunt') || b.kinds.includes('summon'), say: 'a taunt' },
];

// DELIVERY. The document's CAST field is a closed vocabulary — self, melee,
// projectile, instant-at-range, placed, summoned — and each word rules some
// primitives in and the rest out. Only the three unambiguous directions are
// checked, because "instant-at-range built as a bolt" is a travel-time quibble
// and this tool is worthless the moment it starts making those.
//
// This is the check that would have caught Smite. Its document says melee, a
// 72px circle and a breach-ring trigger; what shipped is a projectile at range
// picking the highest-HP enemy. Type agreed (both active), damage agreed (both
// 20-ish), concept found no keyword to grab — so the first three checks all
// passed a skill that was rebuilt from the ground up.
const PLACED = ['hazard', 'trap', 'summon', 'gravity_pull'];
const MELEE = ['strike', 'cone', 'line'];
const DELIVERY = [
  { when: c => c.startsWith('melee'), bad: b => b.kinds.includes('bolt') && !b.kinds.some(k => MELEE.includes(k)),
    say: 'melee', got: 'a projectile at range' },
  { when: c => c.startsWith('placed'), bad: b => b.kinds.length && !b.kinds.some(k => PLACED.includes(k)),
    say: 'placed on the ground', got: 'nothing that is placed' },
  { when: c => c.startsWith('projectile'), bad: b => b.kinds.length && !b.kinds.includes('bolt'),
    say: 'a projectile', got: 'no projectile' },
];

// RIDERS. A document naming a rider the build does not carry splits two ways,
// and the split is the whole point: if the engine HAS that rider, dropping it
// was a substitution; if the engine does not, it is one of the gaps §2 of the
// ledger is already counting. Reporting them together would let a real omission
// hide inside a known engine limitation.
const RIDER_WORDS = [
  [/\bweaken|damage down\b/, ['weakenDamage', 'weakenDefense'], 'weaken'],
  [/\bslow\b/, ['slow'], 'slow'],
  [/\bstun\b/, ['stun'], 'stun'],
  // KNOCKDOWN IS NOT KNOCKBACK, and conflating them reported a faithful skill.
  // The Necromancer's Wrecking Ball says "knockdown — stun 1500ms per enemy hit;
  // caster displaced 320px" and ships as `stun` plus `carry`, which is that
  // sentence exactly. The documents spell displacement "knockback" and spell a
  // floor-stun "knockdown"; only the first is the engine's `knockback`.
  [/\bknockback|knocks? back\b/, ['knockback'], 'knockback'],
  [/\bknockdown\b/, ['stun'], 'knockdown (a stun)'],
  [/\broot\b/, ['root'], 'root'],
  [/\btaunt\b/, ['taunt'], 'taunt'],
  [/\bpierce|pierces\b/, ['pierce'], 'pierce'],
  [/\bsplash\b/, ['splash'], 'splash'],
];
// Named by documents, absent from IMPACT_RIDERS/SHAPE_RIDERS/BOLT_RIDERS. These
// are gaps, and listing them here is what keeps them out of the substitution
// column — the audit must not report a missing `confusion` as somebody's slip.
const RIDER_GAPS = [
  [/\bconfus/, 'confusion'], [/\bfear|flee\b/, 'fear'], [/\bstealth|conceal/, 'stealth'],
  [/\bcleanse|immunity\b/, 'cleanse'],
];

let typeMismatch = [], dmgMismatch = [], conceptMiss = [], deliveryMiss = [], riderMiss = [], riderGap = [], unmatched = 0, compared = 0;

for (const [docName, classId] of Object.entries(CLASS_DOCS)) {
  if (ONLY && docName !== ONLY) continue;
  const file = `${docName}.md`;
  if (!readdirSync(DIR).includes(file)) continue;
  // TREES_BY_CLASS maps a classId to TREE IDS, not tree objects.
  const treeIds = TREES_BY_CLASS[classId] || [];
  const byName = new Map();
  for (const id of treeIds) for (const sk of (TREES[id] ? TREES[id].skills : [])) byName.set(sk.name.toLowerCase(), sk);

  for (const d of docBlocks(file)) {
    const sk = byName.get(d.name.toLowerCase());
    if (!sk) { unmatched++; continue; }
    compared++;
    const b = built(sk);

    if (DOC_IS_PASSIVE(d.type) !== (b.type === 'passive')) {
      typeMismatch.push({ cls: docName, name: d.name, id: sk.id,
        doc: d.type.split(' ')[0], code: b.persist ? 'active (persist)' : b.type });
    }
    const docNone = DOC_SAYS_NO_DAMAGE(d.dmg);
    if (docNone && b.damage > 0) {
      dmgMismatch.push({ cls: docName, name: d.name, id: sk.id, doc: 'no damage', code: `damage ${b.damage}` });
    } else if (!docNone && d.dmg && b.damage === 0 && b.type === 'active' && !b.persist && b.kinds.length) {
      dmgMismatch.push({ cls: docName, name: d.name, id: sk.id, doc: d.dmg.split(' ')[0], code: 'deals nothing' });
    }
    for (const d2 of DELIVERY) {
      if (d2.when(d.cast) && d2.bad(b)) {
        deliveryMiss.push({ cls: docName, name: d.name, id: sk.id, doc: d2.say,
          code: `${d2.got} (${b.kinds.join('+')})` });
      }
    }
    // "DOES THE ENGINE HAVE THIS RIDER" IS THE WRONG QUESTION. The right one is
    // whether the engine has it ON THIS PRIMITIVE, because RIDERS_BY_PRIMITIVE
    // is where the real restriction lives: `hazard` and `aura` take `slow` and
    // nothing else, `trap` and `summon` take none at all. Asked globally, the
    // Necromancer's Hex of Entropy reads as somebody dropping a weaken; asked
    // per-primitive, it is a hazard, and a hazard cannot hold a weaken — which
    // is the ledger's §2 gap rather than anyone's slip. A missing rider only
    // counts against the author when the author could have written it.
    const legal = new Set(b.kinds.flatMap(k => RIDERS_BY_PRIMITIVE[k] || []));
    for (const [re, keys, word] of RIDER_WORDS) {
      if (!re.test(d.riderText) || keys.some(k => b.riders.includes(k))) continue;
      if (keys.some(k => legal.has(k))) {
        riderMiss.push({ cls: docName, name: d.name, id: sk.id, doc: `a ${word} rider`,
          code: b.riders.length ? `riders ${b.riders.join(', ')}` : 'no riders at all' });
      } else {
        riderGap.push({ cls: docName, name: d.name, id: sk.id, doc: word,
          code: `${b.kinds.join('+') || b.type} cannot carry it` });
      }
    }
    for (const [re, word] of RIDER_GAPS) {
      if (re.test(d.riderText)) riderGap.push({ cls: docName, name: d.name, id: sk.id, doc: word, code: 'no such rider in the engine at all' });
    }
    for (const c of CONCEPTS) {
      if (c.re.test(d.riders) && !c.needs(b)) {
        conceptMiss.push({ cls: docName, name: d.name, id: sk.id, want: c.say, code: b.kinds.join('+') || b.type });
      }
    }
  }
}

const row = r => `  ${r.cls.padEnd(12)} ${r.name.padEnd(24)} doc says ${String(r.doc ?? r.want).padEnd(18)} built as ${r.code}`;

console.log(`SUBSTITUTION AUDIT — ${compared} skills compared across ${ONLY || Object.keys(CLASS_DOCS).length} class document(s)`);
console.log(`(${unmatched} document blocks were renamed on the way in and cannot be matched by name — `
  + `not gaps: the roster is fully built. This tally covers ${Math.round(compared / (compared + unmatched) * 100)}% of it.)\n`);

console.log(`## TYPE — the document and the build disagree about passive vs active  (${typeMismatch.length})`);
typeMismatch.forEach(r => console.log(row(r)));
console.log(`\n## DAMAGE — one says it hurts and the other does not  (${dmgMismatch.length})`);
dmgMismatch.forEach(r => console.log(row(r)));
console.log(`\n## DELIVERY — the document and the build disagree about how it reaches  (${deliveryMiss.length})`);
deliveryMiss.forEach(r => console.log(row(r)));
console.log(`\n## RIDERS DROPPED — the document names a rider the engine HAS and the build omits  (${riderMiss.length})`);
riderMiss.forEach(r => console.log(row(r)));
console.log(`\n## CONCEPT — the document names a mechanic the build cannot deliver  (${conceptMiss.length})  [heuristic]`);
conceptMiss.forEach(r => console.log(row(r)));

console.log(`\n## RIDERS WITH NO FORM — the document names a rider that has no legal place on what shipped  (${riderGap.length})  [a gap, not a slip]`);
riderGap.forEach(r => console.log(row(r)));

const hard = typeMismatch.length + dmgMismatch.length + deliveryMiss.length + riderMiss.length;
console.log(`\n${hard} exact mismatch(es), ${conceptMiss.length} heuristic flag(s), `
  + `${riderGap.length} engine gap(s), over ${compared} comparable skills.`);

// The skills that tripped more than one check are the rebuilds rather than the
// slips — Smite disagrees on delivery AND riders, Undertow on damage AND
// delivery AND concept. A one-check flag is usually a detail; three is a
// different skill wearing the same name.
const byId = new Map();
for (const [label, list] of [['type', typeMismatch], ['damage', dmgMismatch], ['delivery', deliveryMiss],
                             ['riders', riderMiss], ['concept', conceptMiss]])
  for (const r of list) byId.set(r.id, [...(byId.get(r.id) || []), label]);
const deep = [...byId].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
if (deep.length) {
  console.log(`\n## REBUILT, NOT ADJUSTED — skills that fail more than one check  (${deep.length})`);
  deep.forEach(([id, v]) => console.log(`  ${id.padEnd(22)} ${v.length} checks: ${v.join(', ')}`));
}
