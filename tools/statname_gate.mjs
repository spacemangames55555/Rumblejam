// NO RETIRED STAT WORD REACHES A PLAYER.
//
// Six stats were renamed at the display layer. The KEYS did not move —
// `ferocity` is still `ferocity` in every save, every item tag, every gate that
// matches the GDD's mechanical tables and every byte on the wire. Only the
// label changed, and it changed in exactly one place: `STATS[].name` in
// js/config.js, from which `STAT_NAME` is derived and every piece of UI reads.
//
// THE FAILURE THIS EXISTS TO CATCH is the one that makes a rename worthless: a
// string somewhere that spells the old word out. There were 154 of them across
// eight content files — item descriptions, skill descriptions, the glossary
// itself — and every one would have rendered "Ferocity" next to a character
// sheet reading "Damage". They are now template literals interpolating
// STAT_NAME, so the next rename cannot strand them either.
//
// WHAT IS CHECKED, AND WHERE. Anything a player can read: content tables
// (item/skill/trait descriptions, the glossary), the UI layer, the renderer —
// and, since the vocabulary pass, `docs/`. Engine internals are NOT checked — a
// comment in skillsim.js explaining why Ferocity works is documentation, and
// rewriting prose about the history of a mechanic to match a new label would
// make the history unreadable.
//
// DOCS WERE OUTSIDE THE NET AND THAT IS EXACTLY WHERE THE DRIFT WENT. This gate
// scoped itself to content, UI and renderer; `docs/` was in none of those sets,
// so nothing watched it and 356 lines across 12 files went on spelling retired
// names — including a player-facing compendium whose stat table was also wrong
// on mechanics. A gate that covers the code and not the document that rules the
// code is watching the half that already had an owner.
//
// Usage: node tools/statname_gate.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { STATS, STAT_NAME } from '../js/config.js';
import { STAT_GLOSS } from '../js/content/glossary.js';
import { TREES } from '../js/skills.js';
import { ITEMS } from '../js/content/items.js';

const RETIRED = {
  Attunement: 'attunement', Ferocity: 'ferocity', Tempo: 'tempo',
  Grit: 'grit', Reflex: 'reflex', Ingenuity: 'ingenuity',
};
const RE = new RegExp(`\\b(${Object.keys(RETIRED).join('|')})\\b`);

// Proper nouns that are NOT stat references and keep their names. Each needs a
// reason; an entry with no reason is an entry somebody added to silence this.
const FILED = {
  'wizard_attunement': 'The Wizard\'s SKILL TREE is named Attunement, and it is about shifting '
    + 'damage domains rather than about the stat. Renaming a tree is content churn with its own '
    + 'ruling; the collision is cosmetic and named here rather than fixed silently.',
};

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };

console.log('STAT LABELS — nothing a player reads may spell a retired name\n');

// ---- 1. the map itself is the only place the new names are authored ----
{
  const want = { ferocity: 'Damage', tempo: 'Speed', grit: 'Defense', reflex: 'Dodge',
    recovery: 'Recovery', ingenuity: 'Summons', attunement: 'Elemental Damage' };
  const wrong = Object.entries(want).filter(([k, v]) => STAT_NAME[k] !== v);
  if (!wrong.length) ok(`all ${Object.keys(want).length} renamed stats read from STAT_NAME: `
    + Object.entries(want).map(([k, v]) => `${k}→${v}`).join(', '));
  else bad(`${wrong.length} stat(s) do not carry the ruled display name: `
    + wrong.map(([k, v]) => `${k} is "${STAT_NAME[k]}", want "${v}"`).join('; '));

  // and the KEYS did not move, which is the half that would break saves
  checks++;
  const keys = STATS.map(s => s.key).join(',');
  const expect = 'vitality,ferocity,tempo,grit,reflex,recovery,ingenuity,attunement,greed,reach';
  if (keys === expect) console.log('✓ every internal key is unchanged — saves, item tags, doc_gate and the wire all still match');
  else { fails++; console.log(`✗ stat KEYS changed: ${keys}\n  want: ${expect} — this breaks every save in existence`); }
}

// ---- 2. no rendered content string spells a retired name ----
{
  const offenders = [];
  for (const [k, g] of Object.entries(STAT_GLOSS)) {
    for (const f of ['short', 'detail']) if (RE.test(g[f] || '')) offenders.push(`glossary.${k}.${f}`);
  }
  for (const it of ITEMS) if (RE.test(it.desc || '')) offenders.push(`item ${it.id}`);
  for (const [tid, t] of Object.entries(TREES)) {
    if (RE.test(t.name) && !FILED[tid]) offenders.push(`tree ${tid} name`);
    for (const s of t.skills) {
      if (RE.test(s.desc || '')) offenders.push(`skill ${s.id} desc`);
      if (RE.test(s.name || '')) offenders.push(`skill ${s.id} name`);
    }
  }
  if (!offenders.length) ok(`no rendered string in the glossary, ${ITEMS.length} items or ${Object.keys(TREES).length} trees spells a retired stat name`);
  else bad(`${offenders.length} rendered string(s) still spell a retired stat name: ${offenders.slice(0, 8).join(', ')}`);
}

// ---- 3. the render layer has no hardcoded stat word at all ----
{
  const files = [];
  const J = new URL('../js/', import.meta.url);
  for (const f of readdirSync(new URL('ui/', J))) if (f.endsWith('.js')) files.push(['js/ui/' + f, readFileSync(new URL('ui/' + f, J), 'utf8')]);
  files.push(['js/render.js', readFileSync(new URL('render.js', J), 'utf8')]);
  const hits = files.filter(([, src]) => RE.test(src)).map(([n]) => n);
  if (!hits.length) ok(`the ${files.length} render-layer files hold no stat word at all — every label goes through STAT_NAME`);
  else bad(`${hits.length} render-layer file(s) hardcode a stat name: ${hits.join(', ')} — route them through STAT_NAME`);
}

// ---- 5. docs/ spells no retired stat name ----
//
// THREE THINGS LEGITIMATELY KEEP A RETIRED WORD, and lumping them in would make
// this gate unpassable and then ignored:
//
//   PROPER NOUNS. `Jeweler's Attunement` and `Relentless Tempo` are SKILL names
//   and `Grit` is a Blacksmith skill. The Wizard's tree is named Attunement —
//   already filed above for the code side, and filed again here for the doc.
//
//   PROPOSED CLASS ENGINES. The conversion documents propose engines of their
//   own, and one of them is called Tempo — 0-100, scales song radius, "consumes
//   60 Tempo". Renaming it to Speed would name a proposed engine after a stat it
//   is not.
//
//   QUOTED HISTORY. The rename table in the GDD has a "Was shown as" column, and
//   that column IS the retired name. Rewriting it deletes the record of the
//   rename.
//
// Each entry below names its file, what it matches and why. An entry that stops
// matching anything is itself a failure — the same rule check 4 applies to tree
// collisions, and for the same reason: a stale exemption keeps a fixed thing
// filed as broken.
const DOC_FILED = [
  ['docs/design/classes/bard.md', /Tempo/,
    'the Bard conversion doc proposes a class ENGINE named Tempo (0-100, scales song radius) — not the stat'],
  ['docs/design/classes/monk.md', /Conviction, Kinship, Resolve, Tempo/,
    'a list of engines the conversion documents propose, by their doc names'],
  ['docs/design/classes/engines-doc-vs-built.md', /Doc: Tempo/,
    'names the Bard doc\'s proposed engine while comparing it against the built one'],
  ['docs/design/classes/sundian.md', /Jeweler's Attunement/, 'skill name'],
  ['docs/design/classes/samurai.md', /Relentless Tempo/, 'skill name'],
  ['docs/design/classes/blacksmith.md', /Grit/, 'skill name — the Blacksmith has a node called Grit'],
  ['docs/design/classes/wizard.md', /\*\*Attunement\*\* holds all three/, 'the Wizard TREE named Attunement, filed for the code side too'],
  ['docs/GDD.md', /^\| `(attunement|ferocity|tempo|grit|reflex|recovery|ingenuity)` \|/,
    'the rename table: its "Was shown as" column is the retired name and is the record of the rename'],
  ['docs/GDD.md', /skill tree is \*named\*/, 'the filed Wizard tree collision, restated in the GDD'],
  ['docs/GDD.md', /Attunement, Arcana/, 'the Wizard\'s three TREE names'],
  ['docs/GDD.md', /Tank \/ DPS \/ Runes/, 'retired aspirational tree names, quoted as history'],
  ['docs/design-audit.md', /./,
    'a FROZEN generated snapshot: its header says do not hand-edit the computed tables, and `gen_design_audit.mjs` cannot run — it asserts 33 characters against a 14-character roster. Its STAT_DOC is corrected, so a regenerated audit will be clean; until the generator runs the file is a dead artifact, not a document anyone maintains'],
];

{
  const DOCS = new URL('../docs/', import.meta.url);
  const walk = (dir, base) => {
    const out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) out.push(...walk(new URL(e.name + '/', dir), base + e.name + '/'));
      else if (e.name.endsWith('.md')) out.push([base + e.name, readFileSync(new URL(e.name, dir), 'utf8')]);
    }
    return out;
  };
  const files = walk(DOCS, 'docs/');
  const offenders = [];
  const used = new Set();
  for (const [name, src] of files) {
    let fenced = false;
    src.split('\n').forEach((line, i) => {
      if (/^\s*```/.test(line)) { fenced = !fenced; return; }
      if (fenced) return;                       // code samples carry KEYS, not labels
      if (!RE.test(line)) return;
      const filed = DOC_FILED.findIndex(([f, rx]) => f === name && rx.test(line));
      if (filed >= 0) { used.add(filed); return; }
      offenders.push(`${name}:${i + 1}`);
    });
  }
  checks++;
  if (!offenders.length) console.log(`✓ none of the ${files.length} documents in docs/ spells a retired stat name outside a filed exemption`);
  else { fails++; console.log(`✗ ${offenders.length} line(s) in docs/ spell a retired stat name: ${offenders.slice(0, 10).join(', ')}${offenders.length > 10 ? ` (+${offenders.length - 10})` : ''}`); }

  // ---- 6. and no filed doc exemption has gone stale ----
  checks++;
  const dead = DOC_FILED.map((e, i) => [e, i]).filter(([, i]) => !used.has(i));
  if (!dead.length) console.log(`✓ all ${DOC_FILED.length} filed doc exemptions still match a real line`);
  else { fails++; console.log(`✗ ${dead.length} doc exemption(s) match nothing any more — remove them: ${dead.map(([e]) => e[0] + ' ' + e[1]).join(', ')}`); }
}

// ---- 4. filed collisions are still genuinely collisions ----
for (const [id, why] of Object.entries(FILED)) {
  checks++;
  const t = TREES[id];
  if (!t) { fails++; console.log(`✗ ${id} is filed here and no longer exists — remove the exemption`); }
  else if (!RE.test(t.name)) { fails++; console.log(`✗ ${id} is filed as a name collision and its name is now "${t.name}" — remove the exemption, a stale one keeps a fixed thing filed as broken`); }
  else console.log(`✓ "${t.name}" (${id}) is filed as a proper noun — ${why}`);
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A RETIRED STAT NAME IS STILL REACHABLE BY A PLAYER' : 'EVERY STAT LABEL COMES FROM STAT_NAME');
process.exit(fails ? 1 : 0);
