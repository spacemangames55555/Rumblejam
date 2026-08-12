// NO CREDENTIAL IS IN THE REPO, AND NONE IS ABOUT TO BE.
//
// `PIXELLAB_API_KEY` lives in the environment and `tools/pixellab.mjs` is
// careful with it: read from `process.env`, handed to curl on STDIN as a config
// (`-K -`) so it is not in argv or `ps`, request bodies written to a temp dir
// outside the working tree and removed in a `finally`. Nothing logs it.
//
// That is all discipline inside one file, and discipline is not the failure
// mode. The failure mode is somebody pasting the key into a scratch file to get
// past an error, then running `git add -A` — the same reflex that committed the
// browser suite's sprite fixtures TWICE. `.gitignore` now covers the usual
// shapes of a credentials file, which handles the untracked case. This gate
// handles the two cases .gitignore cannot:
//
//   1. A file that is ALREADY TRACKED. `.gitignore` has no effect on those, so
//      a key pasted into an existing tool, test or doc sails straight through.
//   2. The key arriving under a name nobody predicted.
//
// WHAT IT ACTUALLY CHECKS, and what it cannot.
//
//   A. If the key is in this environment, its LITERAL BYTES must appear in no
//      tracked file and in no staged change. This is exact — no pattern
//      matching, no guessing the vendor's key format.
//   B. Regardless of whether the key is present, no tracked file may ASSIGN a
//      value to a credential-shaped name. `export PIXELLAB_API_KEY=...` in a
//      doc comment is fine and must stay fine — placeholders are how you
//      document a variable. The same name followed by an actual token is not.
//
//      THIS GATE CAUGHT ITS OWN COMMENT on the first staged run: the line above
//      used to spell out a fake token to illustrate the bad case, and a fake
//      token is indistinguishable from a real one to anything but a human. That
//      is the gate's standing cost — a file that DOCUMENTS the forbidden shape
//      trips on it — and the fix is to reword, never to exempt the file, because
//      an exemption is exactly where somebody would then paste a real key.
//   C. The .gitignore block is still there. A gate whose sibling protection can
//      be deleted silently is half a gate.
//
// IT CANNOT UNDO HISTORY. Once a secret is committed and pushed, rotating it is
// the only fix — scrubbing history does not recall what was already fetched.
// This runs at the last point where prevention is still possible: the working
// tree and the index. `--history` scans every commit as well, which is slow and
// answers a different question ("was one ever committed?"), so it is opt-in.
//
// Usage: node tools/secret_gate.mjs [--history]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };

// The names worth guarding. PIXELLAB_API_KEY is the one this repo actually
// uses; the rest are here because the next credential will not file a ticket
// first, and a list that only holds today's secret is a list that is wrong the
// day a second one arrives.
const SECRET_NAMES = [
  'PIXELLAB_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GITHUB_TOKEN',
  'AWS_SECRET_ACCESS_KEY', 'NPM_TOKEN', 'SLACK_TOKEN',
];

// A placeholder is not a leak. These are the forms a DOCUMENT uses when it
// tells you the variable exists, and every one of them must pass — otherwise
// the gate's own cost is that nobody may write documentation.
const PLACEHOLDER = /^(\.{3}|<[^>]*>|\$\{?\w+\}?|["'`]?(your|my)[-_ ]?\w*|x{3,}|\*{3,}|changeme|todo|\.\.\.|)$/i;

// `NAME` then `=` or `:` then a value. Deliberately narrow: this is the shape of
// somebody storing a key, not every mention of the word.
const assignRe = new RegExp(`\\b(${SECRET_NAMES.join('|')})\\b\\s*[:=]\\s*["'\`]?([^\\s"'\`,;)]*)`, 'g');

function assignments(text) {
  const hits = [];
  for (const m of text.matchAll(assignRe)) {
    const val = m[2] || '';
    if (PLACEHOLDER.test(val)) continue;
    hits.push({ name: m[1], preview: `${m[1]}=${val.slice(0, 4)}…${val.length} chars` });
  }
  return hits;
}

console.log('CREDENTIALS — the working tree and the index, which is where prevention is still possible\n');

// ---- A. the literal key, if this environment has one ----
{
  const live = Object.entries(process.env).filter(([k, v]) => SECRET_NAMES.includes(k) && v && v.length >= 12);
  if (!live.length) {
    checks++;
    console.log('✓ no credential is set in this environment, so there is no literal value to search for '
      + '(checks B and C below run regardless — this is not a skip that hides a failure)');
  } else {
    const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
    const guilty = [];
    for (const [name, value] of live) {
      for (const f of tracked) {
        let body;
        try { body = readFileSync(ROOT + f, 'utf8'); } catch { continue; }   // binary/unreadable
        if (body.includes(value)) guilty.push(`${name} appears verbatim in ${f}`);
      }
      // and the staged change, which is not yet a tracked file's content
      if (git('diff', '--cached').includes(value)) guilty.push(`${name} appears verbatim in the STAGED diff`);
    }
    if (guilty.length) {
      checks++; fails++;
      console.log(`✗ ${guilty.length} leak(s): ${guilty.join('; ')}`);
      console.log('  Remove it, and ROTATE THE KEY — assume anything written down has been read.');
    } else {
      ok(`the ${live.length} credential(s) set in this environment (${live.map(([k]) => k).join(', ')}) `
        + 'appear verbatim in no tracked file and in no staged change');
    }
  }
}

// ---- B. the SHAPE of an assignment, in tracked files and in the staged diff ----
for (const [what, get] of [
  ['tracked file', () => git('ls-files', '-z').split('\0').filter(Boolean)
    .map(f => { try { return [f, readFileSync(ROOT + f, 'utf8')]; } catch { return null; } }).filter(Boolean)],
  ['staged change', () => [['(staged diff)', git('diff', '--cached')]]],
]) {
  const hits = [];
  for (const [name, body] of get()) for (const h of assignments(body)) hits.push(`${name}: ${h.preview}`);
  if (hits.length) {
    checks++; fails++;
    console.log(`✗ ${hits.length} credential assignment(s) in ${what}(s): ${hits.slice(0, 5).join('; ')}`);
    console.log('  A documented placeholder passes (`export PIXELLAB_API_KEY=...`); a value does not.');
  } else ok(`no ${what} assigns a value to any of the ${SECRET_NAMES.length} guarded credential names`);
}

// ---- C. the .gitignore block is still doing its half ----
{
  const gi = readFileSync(ROOT + '.gitignore', 'utf8');
  const want = ['.env', '*.key', '*.pem', 'secrets.json'];
  const missing = want.filter(p => !gi.split('\n').some(l => l.trim() === p));
  if (missing.length) bad(`.gitignore no longer ignores ${missing.join(', ')} — this gate only covers files that are `
    + 'already tracked, so removing those lines reopens the untracked half of the hole');
  else ok(`.gitignore still ignores the credential-file shapes (${want.join(', ')})`);
}

// ---- optional: was one ever committed? A different question, and slow. ----
if (process.argv.includes('--history')) {
  const revs = git('rev-list', '--all').trim().split('\n').filter(Boolean);
  let hits = 0;
  try {
    const out = execFileSync('git', ['grep', '-I', '-n', '-E', `(${SECRET_NAMES.join('|')})\\s*[:=]\\s*\\S{12,}`, ...revs],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const lines = out.split('\n').filter(Boolean).filter(l => !PLACEHOLDER.test(l.split(/[:=]/).pop().trim()));
    hits = lines.length;
    if (hits) { checks++; fails++; console.log(`✗ ${hits} historical occurrence(s) across ${revs.length} commit(s): ${lines.slice(0, 3).join(' | ')}`);
      console.log('  History cannot be un-fetched. ROTATE the credential; scrubbing is secondary.'); }
  } catch { /* git grep exits 1 when it finds nothing */ }
  if (!hits) ok(`no credential assignment in any of the ${revs.length} commit(s) in history`);
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A CREDENTIAL IS IN THE REPO OR ABOUT TO BE' : 'NO CREDENTIAL IN THE TREE, THE INDEX, OR THE IGNORE RULES');
process.exit(fails ? 1 : 0);
