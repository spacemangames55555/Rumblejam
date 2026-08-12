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

// The two Group E rows that do not go through `uiAction` at all. Named
// individually because they are not a pattern — each is one exported function
// that nothing calls, and a generic "unused export" scan over this codebase
// would drown in legitimate internals.
for (const [what, fn, where] of [
  ['the Shrine\'s choice (§2.4)', 'shrineOffer', 'js/nodebehaviour.js'],
  ['world map region selection (§3)', 'worldMapState', 'js/worldmap.js'],
]) {
  checks++;
  // callers are references OUTSIDE the file that defines it
  const callers = files.filter(([n, src]) => n !== where && new RegExp(`\\b${fn}\\b`).test(src)).map(([n]) => n);
  if (!callers.length) {
    console.log(`✓ ${what}: still filed — \`${fn}\` is exported from ${where} and called by nothing in js/`);
  } else {
    fails++;
    console.log(`✗ ${what}: \`${fn}\` now has caller(s) (${callers.join(', ')}) — it is reachable, so remove the row from §15 Group E`);
  }
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A PLAYER CANNOT REACH SOMETHING THE SIM ACCEPTS' : 'EVERY PLAYER DECISION HAS A PATH, OR IS FILED WITH A REASON');
process.exit(fails ? 1 : 0);
