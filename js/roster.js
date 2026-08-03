// Roster resolution for a browser session — the only place that reads the URL
// and localStorage. The content module (content/characters.js) stays pure so
// the headless harnesses can import it.
//
// Selection order, highest first:
//   1. ?roster=toh / ?roster=classic on the URL
//   2. localStorage['undervault.roster']
//   3. 'classic'
//
// A URL choice is persisted, so a link shared once keeps working after a
// refresh without the query string.

import { setRoster, ROSTERS, ROSTER_IDS, DEFAULT_ROSTER, ROSTER_ID, rosterOf } from './content/characters.js';

export const ROSTER_STORE_KEY = 'undervault.roster';

function readStored() {
  try { return localStorage.getItem(ROSTER_STORE_KEY); } catch { return null; }
}
function writeStored(id) {
  try { localStorage.setItem(ROSTER_STORE_KEY, id); } catch { /* private mode: fine, this session only */ }
}

// Run once at boot, before anything renders a character grid.
export function resolveInitialRoster() {
  let fromUrl = null;
  try { fromUrl = new URLSearchParams(location.search).get('roster'); } catch { /* non-browser */ }
  const stored = readStored();
  const wanted = ROSTERS[fromUrl] ? fromUrl : (ROSTERS[stored] ? stored : DEFAULT_ROSTER);
  const applied = setRoster(wanted);
  if (fromUrl && ROSTERS[fromUrl]) writeStored(applied);
  return applied;
}

// The host picking a roster in the lobby. Persists, so the next run opens the
// same way.
export function chooseRoster(id) {
  const applied = setRoster(id);
  writeStored(applied);
  return applied;
}

// THE CO-OP GUARD. A client on a different roster than the host would look up
// the host's character ids in the wrong table and desync every trait in the
// party — silently, because CHAR_BY_ID[missing] is just undefined. So a client
// force-corrects to whatever the host says, loudly, whatever its own URL or
// localStorage said. Returns true if it had to move.
export function applyHostRoster(hostRosterId, party) {
  // Older hosts (and any message that loses the field) send nothing. Infer the
  // roster from the character ids actually in the party rather than assuming.
  let want = ROSTERS[hostRosterId] ? hostRosterId : null;
  if (!want && Array.isArray(party)) {
    for (const m of party) { const r = m && rosterOf(m.charId); if (r) { want = r; break; } }
  }
  if (!want) want = DEFAULT_ROSTER;
  if (want === ROSTER_ID) return false;
  console.warn(`[roster] host is on "${want}", this client was on "${ROSTER_ID}" — switching to the host's roster. `
    + 'The host owns this choice; a mismatch would desync every character trait in the party.');
  setRoster(want);
  return true;
}

export { ROSTERS, ROSTER_IDS };
