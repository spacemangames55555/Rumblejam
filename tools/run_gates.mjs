// RUN EVERY GATE, AND SAY WHICH ONES ARE RED.
//
//   node tools/run_gates.mjs                 every headless gate
//   node tools/run_gates.mjs --browser       also the ones that boot Chromium
//   node tools/run_gates.mjs --only=region   only gates whose name contains "region"
//   node tools/run_gates.mjs --baseline=FILE compare against a saved run and
//                                            report only what CHANGED
//   node tools/run_gates.mjs --save=FILE     write this run's result for --baseline
//
// WHY THIS EXISTS. The project has about sixty instruments and no single place
// that runs them. `sim_test` is the suite, but the focused gates are run by
// hand, one at a time, by whoever remembers which ones a change could reach —
// which is how `region_test` came to be red on main while the suite was green
// and the document above it said every instrument passed. "Green" has to mean
// all of them, and it has to be one command, or it means "the ones I ran".
//
// A gate is anything in tools/ named *_gate.mjs or *_test.mjs, plus the few
// instruments that gate without the suffix. Generators, probes, benches and
// one-off diagnostics are not gates: they measure and print, and exit 0 either
// way. The lists below are explicit so a new file is classified on purpose —
// an unclassified *_gate/*_test file FAILS this runner rather than being
// silently skipped.

import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));

// Gates that do not carry the suffix.
const ALSO = ['skill_sweep.mjs', 'phase2_gates.mjs', 'tree_dps.mjs'];
// Need a real browser (Chromium via Playwright) — run with --browser.
const BROWSER = new Set([
  'browser_test.mjs', 'skillscreen_test.mjs', 'coop_guest_view_test.mjs',
  'mapscreen_gate.mjs', 'render_parity_test.mjs',
]);
// Need arguments to mean anything; listed with the arguments that make them a gate.
const WITH_ARGS = { 'validate_items.mjs': ['js/content/items.js'] };
// Named like a gate, deliberately not run here, each with its reason.
const NOT_A_GATE = {
  'fixture_gate.mjs': 'measures the measuring fixtures; minutes long, run before a power-curve survey',
};

const all = readdirSync(HERE).filter(f => f.endsWith('.mjs'));
const named = all.filter(f => /_(gate|test)\.mjs$/.test(f));
let gates = [...new Set([...named, ...ALSO, ...Object.keys(WITH_ARGS)])]
  .filter(f => all.includes(f) && !(f in NOT_A_GATE) && f !== 'run_gates.mjs');
if (!args.browser) gates = gates.filter(f => !BROWSER.has(f));
if (typeof args.only === 'string') gates = gates.filter(f => f.includes(args.only));
gates.sort();

const CONC = Math.max(2, Math.min(6, (os.cpus().length || 4) - 1));
const TIMEOUT_MS = 15 * 60 * 1000;

function run(file) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [join(HERE, file), ...(WITH_ARGS[file] || [])], { cwd: join(HERE, '..') });
    let out = '';
    const cap = d => { out += d; if (out.length > 4e6) out = out.slice(-2e6); };
    child.stdout.on('data', cap); child.stderr.on('data', cap);
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.on('close', (code, sig) => {
      clearTimeout(timer);
      const lines = out.split('\n').map(l => l.trimEnd()).filter(Boolean);
      const fails = lines.filter(l => /^\s*(✗|FAIL\b)/.test(l));
      resolve({ file, code: sig ? `killed:${sig}` : code, secs: (Date.now() - t0) / 1000, last: lines[lines.length - 1] || '', fails });
    });
  });
}

const results = [];
const queue = [...gates];
await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) {
    const f = queue.shift();
    const r = await run(f);
    results.push(r);
    process.stdout.write(`${r.code === 0 ? '✓' : '✗'} ${f.replace('.mjs', '').padEnd(26)} ${String(r.secs.toFixed(0)).padStart(4)}s  ${r.last.slice(0, 96)}\n`);
  }
}));
results.sort((a, b) => a.file.localeCompare(b.file));

const red = results.filter(r => r.code !== 0);
const summary = Object.fromEntries(results.map(r => [r.file, { code: r.code, fails: r.fails.map(l => l.trim().slice(0, 240)) }]));
if (typeof args.save === 'string') writeFileSync(args.save, JSON.stringify(summary, null, 1));

console.log(`\n${results.length} gate(s), ${red.length} red${args.browser ? '' : ` (headless only — ${[...BROWSER].filter(f => all.includes(f)).length} browser gate(s) need --browser)`}`);
for (const r of red) {
  console.log(`\n── ${r.file} (exit ${r.code})`);
  for (const l of r.fails.slice(0, 12)) console.log('   ' + l.trim().slice(0, 220));
  if (!r.fails.length) console.log('   ' + r.last.slice(0, 220));
}

let exit = red.length ? 1 : 0;
if (typeof args.baseline === 'string') {
  // A CHANGE IS JUDGED AGAINST WHAT WAS ALREADY THERE. Main is allowed to carry
  // a known red; a patch is not allowed to add one, and is not allowed to hide
  // behind one either — so the comparison is per failing LINE, not per file.
  const base = JSON.parse(readFileSync(args.baseline, 'utf8'));
  const norm = l => l.replace(/[0-9]+(\.[0-9]+)?/g, '#');
  const added = [], fixed = [];
  for (const [f, cur] of Object.entries(summary)) {
    const was = base[f];
    if (!was) { if (cur.code !== 0) added.push(`${f}: new gate, red`); continue; }
    const before = new Set(was.fails.map(norm)), now = new Set(cur.fails.map(norm));
    for (const l of cur.fails) if (!before.has(norm(l))) added.push(`${f}: ${l}`);
    for (const l of was.fails) if (!now.has(norm(l))) fixed.push(`${f}: ${l}`);
    if (cur.code !== 0 && was.code === 0 && !cur.fails.length) added.push(`${f}: exit ${cur.code} with no ✗ line — crashed? ${''}`);
  }
  console.log(`\nAGAINST BASELINE ${args.baseline}: ${added.length} new failure(s), ${fixed.length} fixed`);
  for (const l of added) console.log('  NEW   ' + l.slice(0, 230));
  for (const l of fixed) console.log('  FIXED ' + l.slice(0, 230));
  exit = added.length ? 1 : 0;
}
process.exit(exit);
