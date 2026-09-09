// PAIR EVERY DOCUMENT NODE TO THE BUILT SKILL THAT REPLACED IT.
//
// The forty-two tree pairs say which built tree a document tree became. They do
// NOT say which built skill a document skill became, and the two are not the
// same question — node order diverges. Measured on the Necromancer, the one
// class whose thirty blocks all match by name and were hand-verified during the
// merge: AXIS POSITION equals the built index only 77% of the time, and the
// misses are not noise. Entropy Cascade moved from axis 1 to index 9 and slid
// six consecutive nodes down by one. A positional audit would have called all
// seven substitutions. Across 420 skills that is roughly ninety-five false
// positives, reported with a straight face.
//
// So this aligns each tree's ten document blocks to its ten built skills by
// BEST MATCH rather than by position, scoring on what a conversion actually
// preserves, and greedily taking the strongest pair first. An exact name is
// worth more than everything else combined, because a kept name is near-proof;
// the content terms carry the rest.
//
// It reports its own confidence. A pairing forced through by elimination — the
// last two nodes in a tree, neither resembling the other — is marked WEAK, and
// a substitution claim resting on a weak pairing is worth nothing.
//
//   node tools/tree_align.mjs [--class <name>] [--pairs]

import { readFileSync } from 'node:fs';
import { TREES } from '../js/skills.js';

// Casey's ruled pairs, decisions record 2026-09-05. Only the classes whose
// FULL three-tree mapping is stated are here. Monk, Sundian and Wizard have
// partial mappings in the record and are left out rather than guessed at, and
// the Blacksmith is excluded because Casey ruled it has no valid pairing.
export const RULED_PAIRS = {
  necromancer:  { 'Dark Matter': 'necro_dark_matter', 'Marrow': 'necro_marrow', 'Summons': 'necro_summons' },
  bard:         { 'Songs': 'bard_ensemble', 'Battle': 'bard_requiem', 'Sonic Chaos': 'bard_cadence' },
  druid:        { 'Wild Kin': 'druid_beasts', 'Tapestry of Beasts': 'druid_wildkin', "Nature's Restoration": 'druid_restoration' },
  mage:         { 'Collapse': 'mage_collapse', 'Crystalblade': 'mage_crystalblade', 'Refraction': 'mage_refraction' },
  priest:       { 'Judgment': 'priest_judgment', 'Grace': 'priest_grace', 'Reckoning': 'priest_reckoning' },
  savage:       { 'Primal Fury': 'sav_primal_fury', 'Bloodbound': 'sav_bloodbound', 'Aftermath': 'sav_aftermath' },
  witchdoctor:  { 'Effigy': 'wd_effigy', 'Blight': 'wd_blight', 'Swarm': 'wd_swarm' },
};

const ONLY = (() => { const i = process.argv.indexOf('--class'); return i > 0 ? process.argv[i + 1] : null; })();
const SHOW_PAIRS = process.argv.includes('--pairs');

function docBlocks(cls) {
  const lines = readFileSync(new URL(`../docs/design/classes/${cls}.md`, import.meta.url), 'utf8').split('\n');
  const starts = []; lines.forEach((l, i) => { if (l.startsWith('SKILL NAME:')) starts.push(i); });
  return starts.map((s, n) => {
    const body = lines.slice(s, n + 1 < starts.length ? starts[n + 1] : lines.length);
    const f = name => {
      const i = body.findIndex(l => l.startsWith(name + ':'));
      if (i < 0) return '';
      let v = body[i].slice(body[i].indexOf(':') + 1).trim();
      for (let k = i + 1; k < body.length && /^\s{4,}\S/.test(body[k]); k++) v += ' ' + body[k].trim();
      return v;
    };
    const treeRaw = f('CLASS / TREE / TIER');
    const tree = treeRaw.split('/')[1] ? treeRaw.split('/')[1].trim() : '';
    const dmgTxt = f('DAMAGE TIER');
    const dmgNum = (dmgTxt.match(/\((\d+)/) || [])[1];
    return {
      name: f('SKILL NAME').replace(/\s*\[.*$/, '').trim(),
      tree, axis: parseInt(f('AXIS POSITION')) || 0,
      passive: /^passive/i.test(f('TYPE')),
      noDamage: /^(none|n\/a)\b/i.test(dmgTxt),
      dmg: dmgNum ? Number(dmgNum) : 0,
      cast: f('CAST').toLowerCase(),
    };
  });
}

function builtOf(sk, idx) {
  const steps = sk.compose || [];
  return {
    id: sk.id, name: sk.name, idx: idx + 1,
    passive: sk.type === 'passive',
    dmg: steps.reduce((a, s) => a + (s.kind === 'summon' ? 0 : (s.damage || 0)), 0),
    kinds: steps.map(s => s.kind),
  };
}

const PLACED = ['hazard', 'trap', 'summon', 'gravity_pull'];
const MELEE = ['strike', 'cone'];

// What a conversion preserves, weighted by how strongly it survives one.
function score(d, b) {
  let s = 0;
  if (d.name.toLowerCase() === b.name.toLowerCase()) s += 100;   // near-proof on its own
  if (d.passive === b.passive) s += 12; else s -= 12;
  if (d.noDamage === (b.dmg === 0)) s += 10; else s -= 10;
  if (!d.noDamage && b.dmg > 0) {
    const r = Math.min(d.dmg, b.dmg) / Math.max(d.dmg, b.dmg);
    s += 10 * r;                                                 // similar damage tier
  }
  if (d.cast.startsWith('melee') && b.kinds.some(k => MELEE.includes(k))) s += 6;
  if (d.cast.startsWith('projectile') && b.kinds.includes('bolt')) s += 6;
  if (d.cast.startsWith('placed') && b.kinds.some(k => PLACED.includes(k))) s += 6;
  if (d.cast.startsWith('summoned') && b.kinds.includes('summon')) s += 8;
  if (d.cast.startsWith('self') && b.kinds.some(k => ['shield', 'ward', 'form', 'shift', 'heal'].includes(k))) s += 6;
  // Position is a weak signal — 77% on ground truth — so it breaks ties and
  // never decides a pairing on its own.
  if (d.axis && b.idx) s += Math.max(0, 3 - Math.abs(d.axis - b.idx));
  return s;
}

// Greedy assignment: strongest pair first, both sides then consumed.
function align(docs, builts) {
  const cand = [];
  for (const d of docs) for (const b of builts) cand.push({ d, b, s: score(d, b) });
  cand.sort((x, y) => y.s - x.s);
  const usedD = new Set(), usedB = new Set(), out = [];
  for (const c of cand) {
    if (usedD.has(c.d) || usedB.has(c.b)) continue;
    usedD.add(c.d); usedB.add(c.b); out.push(c);
  }
  return out;
}

let totalPairs = 0, weak = 0, nameKept = 0, crossTree = 0;
const results = [];

for (const [cls, pairs] of Object.entries(RULED_PAIRS)) {
  if (ONLY && cls !== ONLY) continue;
  const blocks = docBlocks(cls);

  // A SKILL CAN CHANGE TREES, AND THE ONES THAT DO ARE THE INTERESTING ONES.
  // Aligning strictly inside a ruled tree pair cannot pair a skill with itself
  // once it has moved, so it silently misses exactly the cases worth finding.
  // Smite is the proof: its document puts it in Judgment, it was built in
  // priest_grace, and a per-tree aligner paired doc Smite with Day of Accounts
  // and built Smite with Divine Benediction — two wrong answers from one move.
  //
  // Only TWO of the thirty-two name-matched skills in these seven classes moved
  // tree, and both of them — Smite and Thick Hide — are already-confirmed
  // substitutions. Rare, and a strong signal when it happens. So exact names are
  // anchored across the whole class first, and per-tree alignment fills the rest.
  const claimedDoc = new Set(), claimedBuilt = new Set();
  const builtIndex = new Map();
  for (const [docTree, builtId] of Object.entries(pairs)) {
    const tr = TREES[builtId];
    if (tr) tr.skills.forEach((sk, i) => builtIndex.set(sk.name.toLowerCase(), { b: builtOf(sk, i), builtId, docTree }));
  }
  for (const d of blocks) {
    const hit = builtIndex.get(d.name.toLowerCase());
    if (!hit || claimedBuilt.has(hit.b.id)) continue;
    const expected = pairs[d.tree];
    if (!expected || expected === hit.builtId) continue;   // same tree: the normal path handles it
    claimedDoc.add(d); claimedBuilt.add(hit.b.id);
    crossTree++; totalPairs++; nameKept++;
    results.push({ cls, docTree: d.tree, builtId: hit.builtId, d, b: hit.b, s: score(d, hit.b),
      exact: true, isWeak: false, moved: `${expected} -> ${hit.builtId}` });
  }

  for (const [docTree, builtId] of Object.entries(pairs)) {
    const docs = blocks.filter(b => b.tree === docTree && !claimedDoc.has(b));
    const tree = TREES[builtId];
    if (!tree || !docs.length) { console.log(`  ! ${cls} ${docTree} -> ${builtId}: ${docs.length} doc blocks, tree ${tree ? 'found' : 'MISSING'}`); continue; }
    const builts = tree.skills.map(builtOf).filter(b => !claimedBuilt.has(b.id));
    for (const p of align(docs, builts)) {
      totalPairs++;
      const exact = p.d.name.toLowerCase() === p.b.name.toLowerCase();
      if (exact) nameKept++;
      // A pairing is WEAK when nothing but elimination put it together.
      const isWeak = !exact && p.s < 14;
      if (isWeak) weak++;
      results.push({ cls, docTree, builtId, ...p, exact, isWeak });
    }
  }
}

console.log(`TREE ALIGNMENT — ${totalPairs} document nodes paired to built skills across ${ONLY || Object.keys(RULED_PAIRS).length} class(es)\n`);
console.log(`  kept its name      ${String(nameKept).padStart(3)}  (${Math.round(nameKept / totalPairs * 100)}%)  — the pairing is near-certain`);
console.log(`  renamed, confident ${String(totalPairs - nameKept - weak).padStart(3)}  (${Math.round((totalPairs - nameKept - weak) / totalPairs * 100)}%)  — content agrees`);
console.log(`  WEAK               ${String(weak).padStart(3)}  (${Math.round(weak / totalPairs * 100)}%)  — elimination only; claims resting on these are worthless`);
console.log(`  of which MOVED TREE ${String(crossTree).padStart(2)}  — anchored by name across the class, not inside one pair`);

// ---- THE SUBSTITUTION COUNT, over pairs rather than over shared names ----
//
// Only NON-WEAK pairings are audited. A weak pairing is two nodes that ended up
// together because nothing else was left, and a substitution claim on top of
// that is a claim about an alignment, not about the game.
if (process.argv.includes('--audit')) {
  const PLACED2 = ['hazard', 'trap', 'summon', 'gravity_pull'];
  const MELEE2 = ['strike', 'cone', 'line'];
  const rows = { type: [], damage: [], delivery: [] };
  let audited = 0;
  for (const r of results) {
    if (r.isWeak) continue;
    audited++;
    const d = r.d, b = r.b;
    if (d.passive !== b.passive) {
      rows.type.push([r.cls, d.name, b.name, d.passive ? 'passive' : 'active', b.passive ? 'passive' : 'active']);
    }
    if (d.noDamage && b.dmg > 0) rows.damage.push([r.cls, d.name, b.name, 'no damage', `damage ${b.dmg}`]);
    else if (!d.noDamage && d.dmg && b.dmg === 0 && !b.passive && b.kinds.length) rows.damage.push([r.cls, d.name, b.name, `damage ${d.dmg}`, 'deals nothing']);
    if (r.moved) rows.tree = rows.tree || [];
    if (r.moved) rows.tree.push([r.cls, d.name, b.name, 'its own tree', r.moved]);
    if (b.kinds.length) {
      if (d.cast.startsWith('melee') && b.kinds.includes('bolt') && !b.kinds.some(k => MELEE2.includes(k)))
        rows.delivery.push([r.cls, d.name, b.name, 'melee', 'a projectile']);
      else if (d.cast.startsWith('placed') && !b.kinds.some(k => PLACED2.includes(k)))
        rows.delivery.push([r.cls, d.name, b.name, 'placed', b.kinds.join('+')]);
      else if (d.cast.startsWith('projectile') && !b.kinds.includes('bolt'))
        rows.delivery.push([r.cls, d.name, b.name, 'a projectile', b.kinds.join('+')]);
    }
  }
  const show = (label, rs) => {
    console.log(`\n## ${label}  (${rs.length})`);
    for (const [c, dn, bn, dv, bv] of rs)
      console.log(`  ${c.padEnd(13)}${dn.padEnd(26)}-> ${bn.padEnd(24)} doc ${String(dv).padEnd(14)} built ${bv}`);
  };
  console.log(`\n\nSUBSTITUTION AUDIT over ${audited} confident pairings (${weak} weak pairings excluded)`);
  show('TYPE — passive vs active', rows.type);
  show('DAMAGE — one hurts and the other does not', rows.damage);
  show('DELIVERY — how it reaches', rows.delivery);
  if (rows.tree && rows.tree.length) show('TREE — built somewhere its document did not put it', rows.tree);
  const n = rows.type.length + rows.damage.length + rows.delivery.length + ((rows.tree || []).length);
  console.log(`\n${n} exact mismatch(es) over ${audited} confident pairings — ${(n / audited * 100).toFixed(1)}%.`);
}

if (SHOW_PAIRS) {
  let cur = '';
  for (const r of results) {
    const k = `${r.cls} / ${r.docTree} -> ${r.builtId}`;
    if (k !== cur) { console.log(`\n--- ${k} ---`); cur = k; }
    const mark = r.exact ? '=' : r.isWeak ? '?' : '~';
    console.log(`  ${mark} ${r.d.name.padEnd(26)} -> ${r.b.name.padEnd(24)} ${String(Math.round(r.s)).padStart(4)}  ${r.b.id}`);
  }
}
