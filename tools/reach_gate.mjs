// CAN A PLAYER GET TO IT? — the rule 71 sweep, made permanent.
//
// Three defects in a row had one shape: a sim-side system that worked, a gate
// that was green because it provisioned what the game never does, and no path
// from a real browser to it. The §5.6 opening card, unspent skill points and
// §4.1's difficulty ladder were each found by somebody PLAYING rather than by
// a check, and the ladder had been unreachable for five phases.
//
// The audit that found the next three was a one-off grep. This is that grep as
// an instrument, because the twentieth `uiAction` kind will ship unreachable
// exactly the way the first nineteen did unless something asks.
//
// WHAT IT CHECKS, AND WHY IT IS AN ARITY CHECK. Every branch of the sim's
// `uiAction` switch is a decision the game is willing to accept from a player.
// If nothing in `js/` ever sends that kind, the branch is unreachable — the
// handler works, every sim test that calls `uiAction` directly passes, and no
// player can do it. That is exactly the shape `doc_gate` checks for the
// document: a declared thing with no counterpart.
//
// IT DOES NOT PROVE THE CONTROL IS VISIBLE. A sender in `js/` means the code
// can produce the action; it does not mean a button exists, is on screen, or is
// clickable. Only a browser can answer that, which is why `difficulty_gate`,
// `skillscreen_test` and `uiack_test` drive real pages. This gate is the cheap
// half — it catches the case where there is no path at all, which is what all
// three of the known instances were.
//
// KNOWN-UNREACHABLE IS AN ALLOWLIST WITH REASONS, AND IT IS ASSERTED BOTH WAYS.
// §15's Group E holds three rows that are built, working and unreachable, each
// waiting on a decision about where the control lives rather than on wiring.
// Listing them keeps this gate GREEN on the known state, so a NEW one is a red
// line rather than one more entry in a list nobody reads. And an allowlisted
// row that becomes reachable ALSO fails: a stale exemption is how a fixed thing
// stays filed as broken.
//
// Usage: node tools/reach_gate.mjs
import { readFileSync, readdirSync } from 'node:fs';

const J = new URL('../js/', import.meta.url);
const files = [];
for (const f of readdirSync(J)) if (f.endsWith('.js')) files.push(['js/' + f, readFileSync(new URL(f, J), 'utf8')]);
for (const f of readdirSync(new URL('ui/', J))) if (f.endsWith('.js')) files.push(['js/ui/' + f, readFileSync(new URL('ui/' + f, J), 'utf8')]);
const ALL = files.map(([, src]) => src).join('\n');
const GAME = files.find(([n]) => n === 'js/game.js')[1];

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };

// §15 Group E. Each entry names WHY it has no sender; an entry with no reason
// is an entry somebody added to silence this gate.
const FILED = {
  respec: '§15 Group E — the 1000-gold respec (§9.4). Handler lives in game.js and econ_gate '
        + 'proves the ladder works; nothing can ask for it. Waiting on where the control lives '
        + '(the shop screen, or §5.5\'s map-end step).',
};

// The `uiAction` switch, sliced at the function rather than the file: `case '…'`
// appears all over game.js and a whole-file scan would invent kinds.
function uiActionKinds() {
  const i = GAME.indexOf('uiAction(');
  if (i < 0) return null;
  const sw = GAME.indexOf('switch', i);
  // to the end of the enclosing method — the next line that starts a sibling
  const end = GAME.indexOf('\n  // ---', i + 100);
  return [...new Set([...GAME.slice(sw, end > 0 ? end : GAME.length).matchAll(/case '(\w+)':/g)].map(m => m[1]))];
}

console.log('REACHABILITY — every decision the sim accepts, against what js/ can send\n');

const kinds = uiActionKinds();
if (!kinds || kinds.length < 5) {
  bad(`could not find the uiAction switch (got ${kinds ? kinds.length : 0} kinds) — this gate is reading the wrong thing, which is worse than not running`);
} else {
  ok(`the sim accepts ${kinds.length} player action kinds`);
  const dead = [], revived = [];
  for (const k of kinds) {
    // a sender is anything in js/ that builds a message of this kind
    const sent = new RegExp(`kind: ['"]${k}['"]`).test(ALL);
    if (!sent && !(k in FILED)) dead.push(k);
    if (sent && (k in FILED)) revived.push(k);
  }
  if (!dead.length) ok(`every kind has a sender in js/ (or is filed in §15 Group E: ${Object.keys(FILED).join(', ') || 'none'})`);
  else bad(`${dead.length} action kind(s) the sim accepts and NOTHING in js/ sends: ${dead.join(', ')} — `
    + `the handler works, every sim test that calls uiAction directly passes, and no player can do it (§13 rule 71). `
    + `Wire it, or file it in §15 Group E with the decision it is waiting on and add it to FILED here`);

  if (revived.length) bad(`${revived.length} kind(s) are filed as unreachable and now HAVE a sender: ${revived.join(', ')} — `
    + `remove them from FILED and from §15 Group E. A stale exemption keeps a fixed thing filed as broken`);
  else if (Object.keys(FILED).length) ok(`all ${Object.keys(FILED).length} filed exemption(s) are still genuinely unreachable`);
}

// The two Group E rows that do not go through `uiAction` at all. Both are now
// WIRED, so the assertion is inverted: they must keep having a caller.
for (const [what, fn, where] of [
  ['the Shrine\'s choice (§2.4)', 'shrineOffer', 'js/nodebehaviour.js'],
  ['world map region selection (§3)', 'worldMapState', 'js/worldmap.js'],
]) {
  checks++;
  const callers = files.filter(([n, src]) => n !== where && new RegExp(`\\b${fn}\\b`).test(src)).map(([n]) => n);
  if (callers.length) {
    console.log(`✓ ${what}: \`${fn}\` is called from ${callers.join(', ')}`);
  } else {
    fails++;
    console.log(`✗ ${what}: \`${fn}\` is exported from ${where} and called by NOTHING in js/ — it was wired once and has come loose`);
  }
}

// ---------------------------------------------------------------------------
// THE WHOLE PROGRESSION LAYER, NOT TWO NAMED FUNCTIONS.
//
// The two rows above were filed individually, and that framing is what let the
// problem hide: `worldMapState` was the only name anybody wrote down, so the
// gate stayed green about ONE function while the entire module behind it —
// `partyCanEnter`, and through it every export of `js/saves.js`: `park`,
// `unpark`, `onRegionCleared`, `canEnter`, `recordUnlock`, `loadAll`,
// `saveAll` — sat equally dead. Module reachability said 92 of 93 files were
// live, because `worldmap.js` WAS imported: for `DIFFICULTIES`, and for
// nothing else. A file can be imported and still be a graveyard.
//
// So this asks the whole surface. Both files are progression, both are
// per-character state that a run has to read and write, and an export of
// either with no caller in `js/` is a promise the game does not keep.
const SURFACE = ['js/worldmap.js', 'js/saves.js'];
// Constants a UI reads by name rather than calling. Listed, because a gate that
// silently skips half its subject is the exact defect this section exists for.
const NON_CALLABLE = new Set(['SAVE_VERSION', 'DIFFICULTY_BY_ID', 'EXPORT_PROMPT_AFTER_REGION_CLEAR', 'STORAGE_WARNING']);

for (const where of SURFACE) {
  const entry = files.find(([n]) => n === where);
  checks++;
  if (!entry) { fails++; console.log(`✗ ${where} is missing — this gate is reading the wrong thing`); continue; }
  const [, src] = entry;
  const names = [...new Set([...src.matchAll(/^export (?:const|function|class)\s+(\w+)/gm)].map(m => m[1]))];
  const dead = names.filter(n => !NON_CALLABLE.has(n)
    && !files.some(([f, s2]) => f !== where && new RegExp(`\\b${n}\\b`).test(s2)));
  if (dead.length) {
    fails++;
    console.log(`✗ ${where}: ${dead.length} of ${names.length} export(s) have no caller anywhere in js/: ${dead.join(', ')}`);
    console.log('  A progression rule nothing calls is a rule the game does not have. This is the check whose '
      + 'absence let the world map, the frontier, the unlocks and the parked trees sit green and dead for 165 commits.');
  } else {
    console.log(`✓ ${where}: all ${names.length - names.filter(n => NON_CALLABLE.has(n)).length} callable export(s) have a caller in js/`
      + (names.some(n => NON_CALLABLE.has(n)) ? ` (${names.filter(n => NON_CALLABLE.has(n)).length} read as data, listed in NON_CALLABLE)` : ''));
  }
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A PLAYER CANNOT REACH SOMETHING THE SIM ACCEPTS' : 'EVERY PLAYER DECISION HAS A PATH, OR IS FILED WITH A REASON');
process.exit(fails ? 1 : 0);
