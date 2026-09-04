// NO STAT TERM MAY BE ITS OWN INPUT.
//
// `_recomputeStats` builds a fresh sheet from the character's base, the level,
// the items, the form and the trait layer, and assigns it to `p.stats` at the
// end. A trait term that READS `p.stats` — last pass's finished sheet — and adds
// to the sheet it is building has closed a loop: this pass's output is next
// pass's input, and the value climbs by its own size every recompute.
//
// THAT IS WHAT `bonelord` DID. Its fused-mount term read `p.stats.grit` and
// added it back to `s.grit`, so Defence went 20 → 40 → 60 → 80 → … with no
// ceiling. It multiplied zero for as long as nothing put Defence on that
// character's sheet, which is exactly why nobody found it: the bug was correct
// arithmetic on a zero. Marrownaut becoming a permanent form put +20 there and
// the loop went live.
//
// SO THE MEASUREMENT IS NOT "IS THE NUMBER RIGHT". It is "does the number stop
// moving". Recompute many times with nothing else changing and every stat must
// be identical from the second pass on: the first pass may legitimately differ
// (entering a form recomputes), but a sheet built from unchanged inputs must be
// the same sheet every time. Anything that grows, shrinks or oscillates is a
// term reading its own output.
//
// Two halves, and the second is the one that would have caught the original:
//
//   EVERY CHARACTER, IDLE. Cheap, and it covers the whole roster.
//
//   EVERY CHARACTER, LOADED UP. The bonelord loop was invisible on an idle
//   sheet because the term multiplied zero. So each character is also measured
//   with its own persistent actives slotted and a summon standing beside it,
//   which is the state that made the dormant loop live.
//
//   node tools/statloop_gate.mjs [--verbose] [--passes N]

import { Sim } from '../js/game.js';
import { CHARACTERS_TOH } from '../js/content/characters-toh.js';
import { SKILL_BY_ID, TREES } from '../js/skills.js';
import { spendSkillPoint, setLoadout, applyPersistents } from '../js/skillsim.js';

const VERBOSE = process.argv.includes('--verbose');
const PASSES = (() => {
  const i = process.argv.indexOf('--passes');
  return i > 0 ? Math.max(3, parseInt(process.argv[i + 1], 10) || 12) : 12;
})();

let checks = 0, fails = 0;
const ok = m => { checks++; console.log(`✓ ${m}`); };
const bad = m => { checks++; fails++; console.log(`✗ ${m}`); };

const STATS = ['grit', 'vitality', 'ferocity', 'tempo', 'reflex', 'recovery', 'ingenuity', 'attunement'];

// The prereq chain up to and including a skill, cheapest first.
function chainTo(id) {
  const out = [];
  let cur = SKILL_BY_ID[id];
  while (cur) { out.unshift(cur.id); cur = cur.prereq ? SKILL_BY_ID[cur.prereq] : null; }
  return out;
}

function build(charId) {
  const g = new Sim({ seed: 4711, party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const p = g.players[0];
  p.level = 20;
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);
  return { g, p };
}

// Recompute with NOTHING else changing, and report the first stat that moves
// after the settling pass.
function drift(g, p) {
  g._recomputeStats(p);                       // settle
  const base = { ...p.stats };
  const moved = new Map();
  for (let i = 0; i < PASSES; i++) {
    g._recomputeStats(p);
    for (const k of STATS) {
      const now = p.stats[k], was = base[k];
      if (typeof now !== 'number' || typeof was !== 'number') continue;
      if (Math.abs(now - was) > 1e-9 && !moved.has(k)) moved.set(k, { from: was, to: now, pass: i + 1 });
    }
  }
  // report the FINAL value too, so a slow drift is as visible as a fast one
  for (const [k, v] of moved) v.final = p.stats[k];
  return moved;
}

console.log(`SELF-FEEDING STAT TERMS — ${CHARACTERS_TOH.length} characters × ${PASSES} recomputes\n`);

// ---- 1. every character, idle ----
{
  const broken = [];
  for (const c of CHARACTERS_TOH) {
    const { g, p } = build(c.id);
    const moved = drift(g, p);
    if (moved.size) broken.push(`${c.id}: ${[...moved].map(([k, v]) => `${k} ${v.from}→${v.final}`).join(', ')}`);
  }
  if (!broken.length) ok(`idle: all ${CHARACTERS_TOH.length} characters hold a stable sheet across ${PASSES} recomputes`);
  else bad(`idle: ${broken.length} character(s) drift — ${broken.slice(0, 4).join(' | ')}`);
}

// ---- 2. every character, with its persistents slotted and a summon standing ----
//
// THE STATE THAT MADE THE DORMANT LOOP LIVE. A term that multiplies zero is
// invisible on an idle sheet; this half puts a real number on the sheet first.
// The summon is injected at the highest tier any trait gates on, because the
// bonelord term is reached only by a fused tier-IV mount and no other path
// produces one.
{
  const broken = [];
  for (const c of CHARACTERS_TOH) {
    const { g, p } = build(c.id);
    // slot every persistent active this character can reach
    const persists = Object.values(SKILL_BY_ID)
      .filter(s => s.persist && TREES[s.tree] && TREES[s.tree].classId === c.id);
    for (const sk of persists) {
      for (const id of chainTo(sk.id)) { p.skillPoints++; spendSkillPoint(g, p, id); }
    }
    p.loadout = new Array(8).fill(null);
    const dmg = Object.values(SKILL_BY_ID).find(x => TREES[x.tree] && TREES[x.tree].classId === c.id
      && x.type === 'active' && !x.persist && p.skillRanks[x.id] > 0);
    if (dmg) p.loadout[1] = dmg.id;
    g.cleared = true;
    persists.forEach((sk, i) => { if (i < 1) setLoadout(g, p, 0, sk.id); });
    applyPersistents(g, p);
    // a standing summon at the tier trait terms gate on
    g.summons = [{ owner: p.idx, dead: false, tier: 4, maxHp: 220, hp: 220, x: p.x, y: p.y }];
    const moved = drift(g, p);
    if (moved.size) {
      broken.push(`${c.id}: ${[...moved].map(([k, v]) => `${k} ${v.from}→${v.final} (moving by pass ${v.pass})`).join(', ')}`);
    }
  }
  if (!broken.length) ok(`loaded: all ${CHARACTERS_TOH.length} characters hold a stable sheet with persistents slotted and a tier-IV summon standing`);
  else bad(`loaded: ${broken.length} character(s) drift — ${broken.slice(0, 4).join(' | ')}`);
}

// ---- 3. and the sheet is a pure function of its inputs ----
//
// A weaker claim than "it converges" and a different failure: two players built
// identically must produce identical sheets. A term reading shared or stale
// state fails here even when it happens to settle.
{
  const a = build('toh_necromancer'), b = build('toh_necromancer');
  for (const { g, p } of [a, b]) {
    g.summons = [{ owner: p.idx, dead: false, tier: 4, maxHp: 220, hp: 220, x: p.x, y: p.y }];
    for (let i = 0; i < 5; i++) g._recomputeStats(p);
  }
  const diff = STATS.filter(k => a.p.stats[k] !== b.p.stats[k]);
  if (!diff.length) ok('two identically-built Necromancers produce identical sheets');
  else bad(`two identically-built Necromancers differ on: ${diff.map(k => `${k} ${a.p.stats[k]} vs ${b.p.stats[k]}`).join(', ')}`);
}

if (VERBOSE) {
  const { g, p } = build('toh_necromancer');
  g.summons = [{ owner: p.idx, dead: false, tier: 4, maxHp: 220, hp: 220, x: p.x, y: p.y }];
  const row = [];
  for (let i = 0; i < 8; i++) { g._recomputeStats(p); row.push(p.stats.grit); }
  console.log(`\nbonelord, fused mount standing — Defence per recompute: ${row.join(' → ')}`);
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A STAT TERM IS FEEDING ITSELF' : 'NO STAT TERM IS ITS OWN INPUT');
process.exit(fails ? 1 : 0);
