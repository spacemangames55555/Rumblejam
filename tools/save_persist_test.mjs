// A CHARACTER'S BUILD IS SAVED WITH ITS REGION PROGRESS — in the real page.
//
//   PEERJS_LOCAL=… node --experimental-websocket tools/save_persist_test.mjs
//
// Reported 18 Nov 2026: a Necromancer with a region-3 frontier loaded at level
// 1. The frontier was written to localStorage at every boss kill; the level,
// skills and gear lived only in the session, so closing the tab (or going back
// to character select) kept the map and threw away the character.
//
// tools/carry_gate.mjs holds the save functions headless. This holds the
// WIRING, which is where the original defect lived: js/main.js has to write
// the build when it should, read it back when a region starts, and offer a
// reset. So the page is played, left, RELOADED, and played again:
//
//   1. host a Necromancer, enter region 1, take the opening pick, enter a fight
//   2. build the character up (level 12, points spent), then Abandon Run
//   3. the save in localStorage holds that level, ranks and loadout
//   4. RELOAD the page; host the Necromancer again: the world map says level 12,
//      and the region starts with the same level, ranks, loadout and no
//      opening pick
//   5. Reset character (two clicks): the save is back to region 1, level 1, no
//      build; the next region starts at level 1 with the opening pick
const REPO = process.cwd();
const { Page, bootHttpd, bootRelay, startRun, sleep, loadPeerjs } = await import(REPO + '/tools/cdp_harness.mjs');
const { CONFIG } = await import(REPO + '/js/config.js');

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.log(`✗ ${m}`); };

const PORT = 8781;
bootHttpd(PORT); await sleep(800);
const relay = await bootRelay(9991);
const P = await new Page('save', 9511, loadPeerjs()).open();
const URL = `http://localhost:${PORT}/index.html?peerhost=localhost&peerport=${relay.port}&peersecure=0&seed=777`;
const CLASS = 'toh_necromancer';
const readSave = () => P.exec(`const a = JSON.parse(localStorage.getItem('rj.characters.v1') || '[]'); return a.find(c => c.class === '${CLASS}') || null;`);

async function hostWithClass() {
  await P.goto(URL);
  await P.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden') ? 1 : 0`, 10000, 'title');
  await P.exec(`document.getElementById('name-input').value='P'; document.getElementById('btn-host').click(); return 1;`);
  await P.waitFor(`return (window.uv.lobby && window.uv.lobby.code) || ''`, CONFIG.ROOM_REGISTER_BUDGET_MS + 3000, 'room');
  await P.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden') ? 1 : 0`, 5000, 'lobby');
  await P.exec(`document.querySelector('.char-card[data-char="${CLASS}"]').click(); return 1;`);
  await sleep(300);
}
const meNow = () => P.exec(`const s = window.uv.sim, p = s.players[window.uv.myIdx];
  return { level: p.level, ranks: p.skillRanks, loadout: p.loadout, points: p.skillPoints, opening: !!p.openingOffer, items: p.items.length };`);

try {
  // ---- a clean device ----
  await P.goto(URL);
  await P.exec(`localStorage.clear(); return 1;`);

  // ---- 1-2. play, build, abandon ----
  await hostWithClass();
  await startRun(P, 1);
  await P.waitFor(`return document.querySelector('#overlay-opening .offer-card') ? 1 : 0`, 8000, 'opening');
  await P.exec(`document.querySelector('#overlay-opening .offer-card').click(); return 1;`);
  await sleep(400);
  await P.exec(`document.querySelector('.map-node.reachable').click(); return 1;`);
  await P.waitFor(`return window.uv.sim.phase==='arena' ? 1 : 0`, 12000, 'arena');
  const built = await P.exec(`
    const s = window.uv.sim; s.god = true;
    const { buildCharacter } = await import('/tools/lib/build_char.mjs');
    buildCharacter(s, { idx: window.uv.myIdx, level: 12 });
    const p = s.players[window.uv.myIdx];
    return { level: p.level, ranks: p.skillRanks, loadout: p.loadout, points: p.skillPoints };`);
  await P.exec(`document.getElementById('leave-btn').click(); return 1;`);
  await P.waitFor(`return document.getElementById('leave-yes') ? 1 : 0`, 3000, 'leave confirm');
  await P.exec(`document.getElementById('leave-yes').click(); return 1;`);
  await P.waitFor(`return window.uv.mode === 'lobby' ? 1 : 0`, 5000, 'back in the lobby');

  // ---- 3. what is on disk ----
  const saved = await readSave();
  const savedRanks = saved && saved.carry ? saved.carry.skillRanks : null;
  if (saved && saved.level === built.level && saved.carry && saved.carry.level === built.level
      && JSON.stringify(savedRanks) === JSON.stringify(built.ranks) && JSON.stringify(saved.carry.loadout) === JSON.stringify(built.loadout)) {
    ok(`Abandon Run wrote the build to localStorage: level ${saved.level}, ${Object.keys(savedRanks).length} skill(s) ranked, the loadout`);
  } else fail(`the save after Abandon Run: level ${saved && saved.level} (built ${built.level}), carry ${saved && saved.carry ? 'present' : 'MISSING'}`);

  // ---- 4. RELOAD, and come back ----
  await hostWithClass();
  await P.exec(`document.getElementById('btn-start').click(); return 1;`);
  await P.waitFor(`return !document.getElementById('screen-world').classList.contains('hidden') ? 1 : 0`, 8000, 'world map');
  const line = await P.exec(`return document.getElementById('world-char') ? document.getElementById('world-char').textContent : '';`);
  if (line.includes(`level ${built.level}`)) ok(`after a page reload the world map shows the character at level ${built.level} ("${line}")`);
  else fail(`after a page reload the world map shows "${line}", not level ${built.level}`);
  await P.exec(`document.getElementById('world-enter').click(); return 1;`);
  await P.waitFor(`return window.uv.mode==='run' && window.uv.sim ? 1 : 0`, 12000, 'run after reload');
  const back = await meNow();
  if (back.level === built.level && JSON.stringify(back.ranks) === JSON.stringify(built.ranks)
      && JSON.stringify(back.loadout) === JSON.stringify(built.loadout) && back.points === built.points && !back.opening) {
    ok(`after a page reload the region starts with the same character: level ${back.level}, the same ranks, loadout and ${back.points} unspent point(s), and no opening pick`);
  } else fail(`after a reload the region started at level ${back.level} (want ${built.level}), ranks ${JSON.stringify(back.ranks) === JSON.stringify(built.ranks) ? 'same' : 'DIFFERENT'}, loadout ${JSON.stringify(back.loadout) === JSON.stringify(built.loadout) ? 'same' : 'DIFFERENT'}, opening offered ${back.opening}`);

  // ---- 5. RESET ----
  await P.exec(`document.getElementById('leave-btn').click(); return 1;`);
  await P.waitFor(`return document.getElementById('leave-yes') ? 1 : 0`, 3000, 'leave confirm 2');
  await P.exec(`document.getElementById('leave-yes').click(); return 1;`);
  await P.waitFor(`return window.uv.mode === 'lobby' ? 1 : 0`, 5000, 'lobby 2');
  await P.exec(`document.querySelector('.char-card[data-char="${CLASS}"]').click(); return 1;`);
  await sleep(200);
  await P.exec(`document.getElementById('btn-start').click(); return 1;`);
  await P.waitFor(`return !document.getElementById('screen-world').classList.contains('hidden') ? 1 : 0`, 8000, 'world map 2');
  await P.exec(`document.getElementById('world-reset').click(); return 1;`);
  const armed = await P.exec(`return document.getElementById('world-reset').textContent;`);
  const afterOne = await readSave();
  if (afterOne && afterOne.level === built.level && /again/i.test(armed)) ok(`one click on Reset only arms it ("${armed}") — the save is untouched`);
  else fail(`one click on Reset: button "${armed}", saved level ${afterOne && afterOne.level}`);
  await P.exec(`document.getElementById('world-reset').click(); return 1;`);
  await sleep(200);
  const reset = await readSave();
  if (reset && reset.level === 1 && reset.frontier === 1 && reset.carry === null && reset.parked === null) ok('the second click resets the save: region 1, level 1, no build, no parked region');
  else fail(`after Reset the save holds level ${reset && reset.level}, frontier ${reset && reset.frontier}, carry ${reset && JSON.stringify(reset.carry)}`);
  await P.exec(`document.getElementById('world-enter').click(); return 1;`);
  await P.waitFor(`return window.uv.mode==='run' && window.uv.sim ? 1 : 0`, 12000, 'run after reset');
  const fresh = await meNow();
  if (fresh.level === 1 && fresh.opening && Object.keys(fresh.ranks).length === 0) ok('and the next region starts at level 1 with the opening pick');
  else fail(`after Reset the region started at level ${fresh.level}, opening ${fresh.opening}, ${Object.keys(fresh.ranks).length} rank(s)`);
} catch (err) {
  fail(`crashed: ${err.message.slice(0, 300)}`);
}

P.close(); relay.proc.kill();
console.log(failures ? `\n${failures} SAVE PERSISTENCE FAILURE(S)` : '\nA CHARACTER\'S LEVEL, SKILLS AND GEAR ARE SAVED WITH ITS REGION PROGRESS, AND RESET CLEARS BOTH');
process.exit(failures ? 1 : 0);
