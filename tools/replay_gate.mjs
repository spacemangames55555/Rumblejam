// THE REPLAY GATE — does the same seed actually replay the same region?
//
// Run continuity rests on one promise: a party that wipes gets the SAME region
// back, so the layout is learnable. `hostRetryRegion()` keeps that promise by
// passing `app.regionSeed` to `hostStartRun(seed)` instead of re-rolling — but
// reusing the input only guarantees the output when nothing else feeds the
// generator, and this project has already been burned by exactly that.
// KNOWN-DEFECTS #1 was `Math.random()` in the sim: named as one call in
// `rushMove()`, actually 43 across four files, and it made every A/B
// comparison need three runs to say anything.
//
// THE SEED IS NOT THE ONLY INPUT. `generateTree(seed, region, reroll, {recent})`
// takes `objectiveHistory` as well, and `drawObjectives` weights the pool by
// how recently each objective was dealt. Same seed plus different history is a
// different region. Replay identity therefore depends on a guard nowhere near
// the seed: `js/main.js` appends to `objectiveHistory` only under
// `win && regionCleared`, so a wipe leaves it alone.
//
// CHECK 4 IS THE POINT OF THIS FILE. It is the only thing standing between
// that guard and a silent regression — ungate the append and every other check
// here still passes while replay identity is quietly gone.
//
// Usage: node tools/replay_gate.mjs

import { readFileSync } from 'node:fs';

const { Sim } = await import('../js/game.js');

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };
const say = (pass, m) => (pass ? ok : fail)(m);

const SEED = 0xC0FFEE;
const PARTY = [{ idx: 0, key: 'k0', name: 'A', charId: 'toh_necromancer', color: '#fff' }];

function build(seed, objectiveHistory) {
  return new Sim({ seed, party: PARTY.map(p => ({ ...p })), regionIndex: 1,
    objectiveHistory, allowUnplayable: true });
}

// The whole layout, not a summary of it: every node, every edge, the objectives
// in order. A fingerprint that drops a field is a fingerprint that passes on a
// difference in that field.
function layout(sim) {
  const f = sim.floor;
  return JSON.stringify({
    objectives: f.objectives,
    nodes: f.nodes.map(n => ({ id: n.id, key: n.key, mix: n.mix, depth: n.depth,
      col: n.col, row: n.row, objective: n.objective ?? null, edges: n.edges })),
  });
}

// ---- 1. the retry pair: what a wipe actually produces --------------------
const hist = [];
say(layout(build(SEED, hist)) === layout(build(SEED, hist)),
  'same seed + same history → byte-identical layout (nodes, edges, objectives)');

// ---- 2. many seeds, because one match is luck ----------------------------
let mismatch = 0;
for (let s = 0; s < 200; s++) {
  const sd = (1000 + s * 7919) >>> 0;
  if (layout(build(sd, [])) !== layout(build(sd, []))) mismatch++;
}
say(mismatch === 0, `200 seeds regenerated twice → ${mismatch} layout mismatches`);

// ---- 3. and different seeds must DIFFER, or check 1 proves nothing -------
const distinct = new Set();
for (let s = 0; s < 200; s++) distinct.add(layout(build((1000 + s * 7919) >>> 0, [])));
say(distinct.size > 150,
  `those 200 seeds produced ${distinct.size} distinct layouts (a constant generator would pass check 1 too)`);

// ---- 4. THE GUARD. History is a real input, so the win-gate is load-bearing.
const withHistory = build(SEED, [['zone', 'nest', 'bounty', 'breach', 'relic', 'storm']]);
say(layout(withHistory) !== layout(build(SEED, [])),
  'same seed + DIFFERENT history → different objectives, so the `win && regionCleared` '
  + 'gate on objectiveHistory in js/main.js is load-bearing for replay identity');

// ---- 4b. THE GUARD ITSELF, read from the source --------------------------
// Check 4 proves history is a real input. It does NOT notice if someone
// ungates the append — history would still change the layout and check 4 would
// still pass, while every wipe silently started replaying a different region.
// So this reads the call site. A source assertion is the only kind available:
// `js/main.js` reaches for the DOM at import and cannot be loaded here.
const mainSrc = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

// Comments and strings are blanked to equal length first, so brace matching
// sees code braces only and every index still points at the real source. An
// earlier version of this check took the nearest preceding `if (` instead —
// which is the block that just CLOSED, not the enclosing one, and it passed
// happily when the push was moved out of the guard altogether.
function blankNonCode(src) {
  const out = src.split('');
  let i = 0;
  const blank = (from, to) => { for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '; };
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); const to = e === -1 ? src.length : e; blank(i, to); i = to; }
    else if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const to = e === -1 ? src.length : e + 2; blank(i, to); i = to; }
    else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      blank(i, j + 1); i = j + 1;
    } else i++;
  }
  return out.join('');
}

// The condition of the `if` that opens the block this index sits inside, or
// null when the enclosing block is not an `if`.
function enclosingIfCondition(code, at) {
  let depth = 0;
  for (let i = at - 1; i >= 0; i--) {
    const ch = code[i];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) {
        const head = code.slice(Math.max(0, i - 400), i).trimEnd();
        if (!head.endsWith(')')) return null;
        let d = 0, j = head.length - 1;
        for (; j >= 0; j--) {
          if (head[j] === ')') d++;
          else if (head[j] === '(') { d--; if (d === 0) break; }
        }
        if (j < 0) return null;
        return /\bif\s*$/.test(head.slice(0, j)) ? head.slice(j + 1, head.length - 1) : null;
      }
      depth--;
    }
  }
  return null;
}

const code = blankNonCode(mainSrc);
const pushes = [...code.matchAll(/objectiveHistory\.push/g)];
if (pushes.length !== 1) {
  fail(`js/main.js has ${pushes.length} \`objectiveHistory.push\` sites in live code, expected exactly 1 `
    + '— this check reads the guard on the one it knows about');
} else {
  const cond = enclosingIfCondition(code, pushes[0].index);
  const guarded = !!cond && /\bwin\b/.test(cond) && /\bregionCleared\b/.test(cond);
  say(guarded,
    'the one `objectiveHistory.push` sits inside an `if` testing BOTH `win` and `regionCleared`, so a wipe '
    + 'leaves history untouched and the retry regenerates the same region — enclosing guard: '
    + (cond ? cond.replace(/\s+/g, ' ').trim() : 'NONE (the push is not inside an `if` at all)'));
}

// ---- 5. beyond layout: the sim stream itself -----------------------------
// Both sims are driven through the same node with the same inputs, so any
// difference in the fingerprint is the sim's own rolls, not the driving.
function fingerprint(sim, ticks) {
  for (const p of sim.players) {
    if (p.openingOffer) sim.uiAction(p.idx, { kind: 'opening', id: p.openingOffer[0].id });
  }
  sim.uiAction(0, { kind: 'pickNode', nodeId: sim.floor.nodes.find(n => n.depth === 1).id });
  for (let i = 0; i < 60 * 6 && sim.phase === 'map'; i++) sim.tick();
  const fp = [];
  for (let i = 0; i < ticks; i++) {
    sim.setInput(0, { mx: Math.cos(i / 37), my: Math.sin(i / 53) });  // aim + attack are automatic
    sim.tick();
    if (i % 25 === 0) fp.push([...sim.enemyPool].map(e => `${e.x.toFixed(4)},${e.y.toFixed(4)},${e.hp}`).join('|'));
  }
  return { fp: fp.join('#'), alive: sim.enemyPool.count, phase: sim.phase };
}
const a = fingerprint(build(SEED, []), 900);
const b = fingerprint(build(SEED, []), 900);
say(a.fp === b.fp,
  `900 ticks in a real fight from one seed → ${a.fp === b.fp ? 'identical' : 'DIVERGED'} enemy positions/hp `
  + `(defect #1's failure showed at ~tick 402)`);

// ---- 6. and the fingerprint has to have measured something ---------------
say(a.fp.length > 200,
  `the fingerprint is non-empty (${a.fp.length} chars, phase=${a.phase}, ${a.alive} enemies alive) `
  + '— an empty fight matches trivially and would pass check 5 while measuring nothing');

console.log(failures ? `\n${failures} REPLAY GATE FAILURE(S)` : '\nTHE SAME SEED REPLAYS THE SAME REGION');
process.exit(failures ? 1 : 0);
