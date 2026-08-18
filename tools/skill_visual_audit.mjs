// SKILL VISUAL AUDIT — survey only, changes nothing.
//
//   node tools/skill_visual_audit.mjs            table + measurement
//   node tools/skill_visual_audit.mjs --csv      the full 420-row table as CSV
//
// THE QUESTION. In endgame play far fewer projectiles appear than the number of
// skills firing would suggest, and that has two possible causes which need
// separating before anyone draws anything: skills firing with no visual, or
// skills not firing often enough. This answers the first and produces the
// density number the second needs.
//
// THE PRIMITIVE -> VISUAL MAP IS DERIVED FROM SOURCE, NOT HAND-WRITTEN. A hand
// list would be correct on the day it was typed and wrong the first time
// somebody adds an fx push to a primitive (§13 rule 12). This slices each
// primitive's body out of js/compose.js and looks for the calls that actually
// put something on screen, so the table re-derives itself every run.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TREES, TREES_BY_CLASS } from '../js/skills.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = process.argv.includes('--csv');

// ---------------------------------------------------------------- the map
//
// What each call puts in front of a player, and how the renderer treats it.
// The right-hand side is a claim about js/render.js and is checked below.
const EMITTERS = [
  { call: 'fx.swings.push', visual: 'shape: melee arc', channel: 'swings', life: 0.16 },
  { call: 'fx.beams.push', visual: 'shape: beam flash', channel: 'beams', life: 0.16 },
  { call: 'fx.booms.push', visual: 'shape+particles: ring', channel: 'booms', life: 0.35 },
  { call: 'fx.hits.push', visual: 'damage number only', channel: 'hits', life: 0.8 },
  { call: 'fx.blocks.push', visual: 'shape: block ring', channel: 'blocks', life: 0.25 },
  { call: 'spawnSkillProj', visual: 'entity: projectile', channel: 'projs', life: null },
  { call: 'addZone', visual: 'entity: ground zone', channel: 'zones', life: null },
  { call: 'spawnMinions', visual: 'entity: minion body', channel: 'minions', life: null },
  { call: 'addTrap', visual: 'NOTHING — traps are not in any view', channel: 'traps', life: null },
];

// Which fx channels the renderer actually consumes. Read off render.js rather
// than asserted, because a channel that is written and never read is exactly
// the failure this audit is looking for.
const RENDER_SRC = readFileSync(join(ROOT, 'js/render.js'), 'utf8');
const MAIN_SRC = readFileSync(join(ROOT, 'js/main.js'), 'utf8');
const GAME_SRC = readFileSync(join(ROOT, 'js/game.js'), 'utf8');
const CHANNELS = ['hits', 'deaths', 'booms', 'beams', 'swings', 'blocks', 'skillFires', 'telResolve'];
const channelRead = {};
for (const c of CHANNELS) channelRead[c] = new RegExp(`fx\\.${c}\\b`).test(RENDER_SRC);
// entity lists reach the renderer through the view, not through fx
const viewRead = k => new RegExp(`view\\.${k}\\b`).test(RENDER_SRC) && new RegExp(`\\b${k}:`).test(MAIN_SRC + GAME_SRC);

// ---------------------------------------------------------------- parsing
const COMPOSE_SRC = readFileSync(join(ROOT, 'js/compose.js'), 'utf8');

function primitiveBody(name) {
  const start = COMPOSE_SRC.indexOf(`\n  ${name}(sim, p, skill, step, rank, grid, out) {`);
  if (start < 0) return null;
  const end = COMPOSE_SRC.indexOf('\n  },', start);
  return COMPOSE_SRC.slice(start, end < 0 ? COMPOSE_SRC.length : end);
}
const PRIM_NAMES = [...COMPOSE_SRC.matchAll(/\n {2}([a-z][a-zA-Z]*)\(sim, p, skill, step, rank, grid, out\) \{/g)].map(m => m[1]);

// Effect category, as a player would name it. Derived from what the primitive
// emits, with the two that emit nothing visible named for what they DO.
const EFFECT_OF = {
  strike: 'melee arc', cone: 'melee arc', line: 'beam',
  bolt: 'projectile', trap: 'trap', hazard: 'zone', summon: 'summon',
  heal: 'buff (heal)', shield: 'buff (absorb)', ward: 'buff (absorb)',
  drain: 'single-target damage', shift: 'movement', form: 'stance', plague: 'damage-over-time',
};

const primInfo = {};
for (const name of PRIM_NAMES) {
  const body = primitiveBody(name) || '';
  const emits = EMITTERS.filter(e => body.includes(e.call));
  primInfo[name] = {
    effect: EFFECT_OF[name] || 'unclassified',
    emits,
    // "readable from damage numbers" — it lands damage but draws nothing of
    // its own, so the only feedback is the floating number.
    damages: /skillDamage|spawnSkillProj|addZone|applyPlague/.test(body),
  };
}

function verdictFor(emits, damages) {
  const drawn = emits.filter(e => e.channel === 'traps' ? false
    : (['projs', 'zones', 'minions'].includes(e.channel) ? viewRead(e.channel) : channelRead[e.channel]));
  const real = drawn.filter(e => e.channel !== 'hits');
  if (real.length) return { kind: real.map(e => e.visual).join(' + '), state: 'visual' };
  if (drawn.some(e => e.channel === 'hits')) return { kind: 'damage number only', state: 'numbers-only' };
  if (emits.length) return { kind: `${emits.map(e => e.visual).join(' + ')}`, state: 'written-never-drawn' };
  return { kind: 'nothing', state: damages ? 'numbers-only' : 'invisible' };
}

// ---------------------------------------------------------------- the table
const CLASS_OF = {};
for (const [cid, trees] of Object.entries(TREES_BY_CLASS)) for (const t of trees) CLASS_OF[t] = cid;

const rows = [];
for (const [tid, tree] of Object.entries(TREES)) {
  for (const s of tree.skills) {
    const steps = (s.compose || []).map(c => c.kind);
    const infos = steps.map(k => primInfo[k]).filter(Boolean);
    const effects = [...new Set(infos.map(i => i.effect))];
    const emits = infos.flatMap(i => i.emits);
    const damages = infos.some(i => i.damages);
    const v = steps.length ? verdictFor(emits, damages)
      : { kind: 'nothing', state: 'passive' };
    rows.push({
      id: s.id, cls: (CLASS_OF[tid] || '?').replace('toh_', ''), tree: tid, tier: s.tier,
      type: s.type, steps: steps.join('+') || '(none)',
      effect: effects.join('+') || 'passive', visual: v.kind, state: v.state,
    });
  }
}

if (CSV) {
  console.log('id,class,tree,tier,type,steps,effect,visual,state');
  for (const r of rows) console.log([r.id, r.cls, r.tree, r.tier, r.type, r.steps, r.effect, r.visual, r.state].map(x => `"${x}"`).join(','));
  process.exit(0);
}

console.log('='.repeat(96));
console.log(`SKILL VISUAL AUDIT — ${rows.length} skills, ${Object.keys(TREES_BY_CLASS).length} classes, ${Object.keys(TREES).length} trees`);
console.log('='.repeat(96));

console.log('\nFX CHANNELS — written by the sim, read by the renderer?');
for (const c of CHANNELS) {
  const writes = (readFileSync(join(ROOT, 'js/game.js'), 'utf8') + readFileSync(join(ROOT, 'js/compose.js'), 'utf8')
    + readFileSync(join(ROOT, 'js/skillsim.js'), 'utf8') + readFileSync(join(ROOT, 'js/telegraphs.js'), 'utf8')
    + readFileSync(join(ROOT, 'js/minions.js'), 'utf8') + readFileSync(join(ROOT, 'js/traits-toh.js'), 'utf8'))
    .split(`fx.${c}.push`).length - 1;
  console.log(`  ${c.padEnd(12)} ${String(writes).padStart(3)} write site(s)   render.js reads: ${channelRead[c] ? 'YES' : 'NO   <-- written and never drawn'}`);
}
console.log('\nENTITY LISTS — reach the renderer through the view rather than fx');
for (const k of ['projs', 'zones', 'minions', 'summons', 'traps']) {
  console.log(`  ${k.padEnd(12)} in a view and drawn: ${viewRead(k) ? 'YES' : 'NO   <-- exists in the sim, never on screen'}`);
}

console.log('\nPRIMITIVE -> VISUAL (derived from js/compose.js)');
console.log(`  ${'primitive'.padEnd(10)} ${'effect'.padEnd(22)} visual`);
for (const name of PRIM_NAMES) {
  const i = primInfo[name];
  const v = verdictFor(i.emits, i.damages);
  const flag = v.state === 'visual' ? ' ' : v.state === 'numbers-only' ? '~' : '!';
  console.log(`  ${flag} ${name.padEnd(8)} ${i.effect.padEnd(22)} ${v.kind}`);
}

console.log('\nSKILLS BY VISUAL STATE');
const byState = new Map();
for (const r of rows) { if (!byState.has(r.state)) byState.set(r.state, []); byState.get(r.state).push(r); }
const ORDER = ['visual', 'numbers-only', 'written-never-drawn', 'invisible', 'passive'];
for (const st of ORDER) {
  const g = byState.get(st) || [];
  if (!g.length) continue;
  console.log(`  ${st.padEnd(22)} ${String(g.length).padStart(3)}  (${(100 * g.length / rows.length).toFixed(0)}%)`);
}

console.log('\nNO-VISUAL ENTRIES, GROUPED BY EFFECT TYPE');
console.log('  (a passive with no visual is fine; a projectile with no visual is a defect)');
const noVis = rows.filter(r => r.state !== 'visual');
const byEffect = new Map();
for (const r of noVis) { if (!byEffect.has(r.effect)) byEffect.set(r.effect, []); byEffect.get(r.effect).push(r); }
for (const [eff, g] of [...byEffect].sort((a, b) => b[1].length - a[1].length)) {
  const states = [...new Set(g.map(r => r.state))].join(', ');
  const verdict = /projectile|beam|melee arc|zone/.test(eff) ? '  <-- DEFECT: a damage shape with no visual'
    : eff === 'trap' ? '  <-- DEFECT: placed object, never drawn'
      : /passive|stance|buff|movement/.test(eff) ? '  (acceptable)' : '';
  console.log(`\n  ${eff}  x${g.length}  [${states}]${verdict}`);
  const show = g.slice(0, 8).map(r => `${r.cls}/${r.id}`);
  console.log(`    ${show.join(', ')}${g.length > 8 ? `, +${g.length - 8} more` : ''}`);
}

console.log('\nPER-CLASS: how many of a class\'s skills draw something');
console.log(`  ${'class'.padEnd(14)} skills  visual  numbers-only  invisible/passive`);
for (const cid of Object.keys(TREES_BY_CLASS)) {
  const g = rows.filter(r => r.cls === cid.replace('toh_', ''));
  const v = g.filter(r => r.state === 'visual').length;
  const n = g.filter(r => r.state === 'numbers-only').length;
  const i = g.length - v - n;
  console.log(`  ${cid.replace('toh_', '').padEnd(14)} ${String(g.length).padStart(6)} ${String(v).padStart(7)} ${String(n).padStart(13)} ${String(i).padStart(18)}`);
}

// ------------------------------------------------------------ measurement
console.log('\n' + '='.repeat(96));
console.log('THE TWO NUMBERS — activations vs on-screen player visuals');
console.log('='.repeat(96));
const STATE_OF = new Map(rows.map(r => [r.id, r.state]));
const EFFECT_MAP = new Map(rows.map(r => [r.id, r.effect]));
await (await import('./skill_visual_density.mjs')).run(id => STATE_OF.get(id), id => EFFECT_MAP.get(id));
