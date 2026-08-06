// Entry point & orchestrator. Owns the screen state machine, the fixed-timestep
// host loop, the client interpolation/prediction loop, and all glue between
// sim events and UI/audio. Simulation (game.js) never touches the DOM.

import { CONFIG, DEV, PALETTE } from './config.js';
import { BIOMES, tileVariant } from './biomes.js';
import { randomRunSeed } from './rng.js';
import { Sim } from './game.js';
import { BEAST, hurtBeast } from './entities/beast.js';
import { HostTransport, ClientTransport } from './net.js';
import { encodeSnap, decodeSnap, wireSize } from './netcodec.js';
import { serializeObjective } from './objectives.js';
import { OBJECTIVE_META } from './objectives.js';
import { Renderer } from './render.js';
import { initInput, sampleInput, takeDebugKey, pressInteract, pressStance } from './input.js';
import { initTouch, joy, touchEnabled } from './touch.js';
import { ensureAudio, sfx, preloadAirhorn, levelupHorn, audioStats, getCtxState, getMasterGainValue, setVolume, getVolume } from './audio.js';
import { initScreens, showTitle, showLobby, showResults, hideScreens, currentName, setTitleError, setNetStatus, isShakeEnabled } from './ui/screens.js';
import { initGloss } from './ui/gloss.js';
import { initMapScreen, showMapScreen, hideMapScreen, updateMapScreen, isMapScreenOpen } from './ui/mapscreen.js';
import { showHud, updateHud, toast, banner } from './ui/hud.js';
import { initOverlays, closeAllOverlays, showShop, closeShop, isShopOpen, updateShopMeta, showLevelup, closeLevelup, showTreasure, closeTreasure, showSheet, closeSheet, isSheetOpen, updateSheetMeta, showBoon, closeBoon } from './ui/overlays.js';
import { CHARACTERS, CHAR_BY_ID, ROSTER_ID, ROSTERS, ROSTER_IDS } from './content/characters.js';
import { resolveInitialRoster, chooseRoster, applyHostRoster } from './roster.js';
import { tohSnapshot, tohMarks, tohState, TOH_STANCE_NAMES } from './traits-toh.js';
import { ITEMS } from './content/items.js';
import { WEAPONS } from './content/weapons.js';
import { ENEMIES } from './content/enemies.js';
import { BOSSES } from './content/bosses.js';
import { Assets, SPRITE_MODE, drawSprite } from './assets.js';
import { projSpriteFor, PYLON_SPRITE } from './content/sprites.js';
import { clamp } from './util.js';

const { WALL } = CONFIG;

// ---------------- boot ----------------

console.log(`%cUNDERVAULT%c content loaded — characters: ${CHARACTERS.length}, items: ${ITEMS.length}, weapons: ${WEAPONS.length}, enemy types: ${ENEMIES.length}, bosses: ${BOSSES.length}, sprites: ${SPRITE_MODE}`,
  'color:#ffd45e;font-weight:bold;font-size:16px', 'color:inherit');
console.assert(CHARACTERS.length === 33, 'need exactly 33 characters');
console.assert(ITEMS.length >= 100, 'need ≥100 items');
console.assert(WEAPONS.length === 26, 'need exactly 26 weapons');
console.assert(ENEMIES.length === 12 && BOSSES.length === 4, 'need 12 enemy types + 4 bosses');

const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
window.uvRenderer = renderer;
renderer.shakeEnabled = isShakeEnabled();
initInput();
initTouch(canvas);
renderer.joy = joy; // renderer draws the joystick from the live touch state

const app = {
  mode: 'title',          // title | lobby | run | results
  role: null,             // 'host' | 'client'
  hostT: null, clientT: null,
  lobby: null,            // {code, codePending, players:[{key,name,color,charId,ready,isHost}]}
  sim: null,              // host only
  party: null,            // [{idx,name,charId,color}] once started
  myIdx: 0,
  myKey: '_local',
  meta: null,             // my latest private meta
  metas: {},              // host: last metas per idx (for HUD)
  floorNum: 1,
  map: null,              // latest 'map' event (node layout + reachable)
  arena: null,            // latest 'arena' event (dims + obstacles)
  runMode: 'map',         // 'map' | 'arena'
  bossInfo: null,
  // client interpolation state
  snaps: [], predicted: null, lastSnapAt: 0, inputTimer: null, seqNo: 0,
  fps: { frames: 0, t: 0, value: 60, show: false },
};

const actions = {
  host: hostGame,
  join: joinGame,
  leave: leaveToTitle,
  backToLobby: hostReturnToLobby,
  pickChar: charId => sendUi({ kind: 'pick', charId }),
  toggleReady: () => sendUi({ kind: 'ready' }),
  startGame: hostStartRun,
  pickRoster: hostPickRoster,
};
// Sprites start loading NOW, at page load, while the player is still reading
// the title and picking a character — not at game start, where a stall would
// be a stall in the run. Nothing waits on this: with no art on disk every
// request 404s in milliseconds and the game draws its primitives, which is the
// state the project ships in today.
Assets.load('assets/assets.json');

// Roster first: every screen that lists characters reads the active roster,
// so this has to settle before the first render.
resolveInitialRoster();
initScreens(actions);
initGloss(); // stat-glossary popover + document-level term handling
initMapScreen({
  pickNode: nodeId => sendUi({ kind: 'pickNode', nodeId }),
  reopenShop: () => sendUi({ kind: 'reopenShop' }),
});
initOverlays({
  buy: slot => sendUi({ kind: 'buy', slot }),
  swapBuy: (slot, sell, sellId, sellTier) => sendUi({ kind: 'swapBuy', slot, sell, sellId, sellTier }),
  reroll: () => sendUi({ kind: 'reroll' }),
  lock: slot => sendUi({ kind: 'lock', slot }),
  closeShop: () => sendUi({ kind: 'closeShop' }),
  pickLevelup: id => sendUi({ kind: 'levelup', id }),
  pickTreasure: id => sendUi({ kind: 'treasure', id }),
  pickBoon: id => sendUi({ kind: 'boon', id }),
  combine: (a, b, id, tier) => sendUi({ kind: 'combine', a, b, id, tier }),
  sellWeapon: (slot, id, tier) => sendUi({ kind: 'sellWeapon', slot, id, tier }),
  sellItem: id => sendUi({ kind: 'sellItem', id }),
  openSheet: () => toggleSheet(true),
});
window.addEventListener('pointerdown', ensureAudio, { once: false });
window.addEventListener('keydown', ensureAudio, { once: false });
window.addEventListener('touchstart', ensureAudio, { once: false }); // iOS Safari gesture unlock
window.uv = app; // debug/testing handle (read-only use)
window.uvContent = { ITEMS, WEAPONS, CHARACTERS }; // content tables for debug/tests
window.uvAudio = { stats: audioStats, ctxState: getCtxState, masterGain: getMasterGainValue, setVolume, getVolume }; // audio introspection for tests
window.uvAssets = Assets;            // sprite registry introspection for tests
window.uvDrawSprite = drawSprite;    // so a test can prove every id falls back
window.uvSpriteMode = SPRITE_MODE;
window.uvBeast = { BEAST, hurtBeast };   // beast constants + knockdown, for tests
// biome/floor introspection: the tiled floor is a pixel claim, so the browser
// suite needs the one number the grid and the atlas must agree on
window.uvBiome = { FLOOR_TILE: CONFIG.FLOOR_TILE, BIOMES, tileVariant };
preloadAirhorn(); // fire-and-forget: a missing asset falls back to the synth blip
initLeaveButton();
document.getElementById('interact-btn').onclick = () => { sfx.click(); pressInteract(); };
document.getElementById('stance-btn').onclick = () => { sfx.click(); pressStance(); };
document.getElementById('sheet-btn').onclick = () => { sfx.click(); toggleSheet(); };
window.addEventListener('keydown', e => {
  if (document.activeElement.tagName === 'INPUT') return;
  if (e.code === 'KeyC' && app.mode === 'run') toggleSheet();
  // The trigger-core debug overlay. Not optional: without it the gate cannot be
  // evaluated — "it felt bad" is not actionable, and a trigger budget problem
  // is invisible until it is structural.
  if (e.code === 'KeyT' && app.mode === 'run') renderer.debugTrig = !renderer.debugTrig;
});
showTitle();

// Character sheet: per-player overlay, live numbers from app.meta. In solo the
// sim pauses while it's open (advanceHostSim checks); in co-op it never pauses
// and never touches anyone else's screen.
function toggleSheet(forceOpen = false) {
  if (isSheetOpen() && !forceOpen) { closeSheet(); return; }
  if (app.mode !== 'run' || !app.meta) return;
  const me = app.party && app.party.find(m => m.idx === app.myIdx);
  showSheet(app.meta, me ? me.charId : null);
}

function soloSheetPaused() {
  return isSheetOpen() && (!app.hostT || app.hostT.conns.size === 0);
}

// ---------------- leave run (corner button + confirmation) ----------------

function initLeaveButton() {
  document.getElementById('leave-btn').onclick = () => {
    if (app.mode !== 'run') return;
    sfx.click();
    const el = document.getElementById('leave-confirm');
    const isHost = app.role === 'host';
    el.innerHTML = `
      <div class="panel">
        <div class="ov-title">${isHost ? 'ABANDON RUN?' : 'LEAVE RUN?'}</div>
        <p class="dim">${isHost
          ? 'The run ends for the whole party. Everyone returns to the lobby to pick characters for a fresh run.'
          : 'You leave the session and return to the title screen. The rest of the party plays on without you.'}</p>
        <div class="row">
          <button id="leave-yes" class="primary">${isHost ? 'Abandon run' : 'Leave'}</button>
          <button id="leave-no">Keep playing</button>
        </div>
      </div>`;
    el.classList.remove('hidden');
    el.querySelector('#leave-yes').onclick = () => {
      sfx.click();
      el.classList.add('hidden');
      if (isHost) hostAbandonRun();
      else leaveToTitle();
    };
    el.querySelector('#leave-no').onclick = () => { sfx.click(); el.classList.add('hidden'); };
  };
}

// Host (or solo): end the run for everyone and return the whole party to the
// lobby — connections and room code intact, ready for a fresh run/seed.
function hostAbandonRun() {
  if (app.role !== 'host' || !app.sim) return;
  hostReturnToLobby(false); // abandoning keeps your picks; a defeat clears them
}

// A run ending is not the end of the session. The whole party goes back to
// character select in the SAME room: code, peer connections and host role all
// persist, everyone re-picks, the host starts the next run. Used by the
// results screen and by the mid-run abandon button alike.
function hostReturnToLobby(clearChars = true) {
  if (app.role !== 'host') return;
  const seen = new Set();
  const players = [];
  // rebuild from the party that started the run, minus anyone who left, then
  // add any peer that joined/reconnected since (belt and braces for a
  // disconnect landing exactly on this transition)
  for (const mem of app.party || []) {
    const sp = app.sim && app.sim.players[mem.idx];
    if (sp && sp.gone) continue;
    if (mem.key !== '_local' && app.hostT && !app.hostT.conns.has(mem.key)) continue; // dropped
    if (seen.has(mem.key)) continue;
    seen.add(mem.key);
    players.push({
      key: mem.key, name: mem.name, color: mem.color,
      charId: clearChars ? null : mem.charId,
      ready: mem.key === '_local', isHost: mem.key === '_local',
    });
  }
  if (!players.some(p => p.isHost)) {
    players.unshift({ key: '_local', name: currentName(), color: PALETTE.players[0], charId: null, ready: true, isHost: true });
  }
  app.sim = null;
  app.mode = 'lobby';
  app.party = null;
  app.snaps = [];
  app.meta = null;
  app.predicted = null;
  app.lobby = { code: app.hostT ? app.hostT.code : null, codePending: false, players };
  showHud(false);
  closeAllOverlays();
  hideMapScreen();
  if (app.hostT) app.hostT.broadcast({ t: 'abandon', lobby: publicLobby() });
  refreshLobby();
}

// ---------------- lobby: host ----------------

function hostGame() {
  app.role = 'host';
  app.mode = 'lobby';
  app.myKey = '_local';
  app.lobby = {
    code: null, codePending: true,
    players: [{ key: '_local', name: currentName(), color: PALETTE.players[0], charId: null, ready: true, isHost: true }],
  };
  refreshLobby();
  const t = new HostTransport();
  app.hostT = t;
  t.onPeerJoin = key => { /* wait for hello to add */ };
  t.onPeerLeave = key => hostDropPeer(key);
  t.onMessage = (key, msg) => hostOnMessage(key, msg);
  t.createRoom().then(code => {
    if (app.role !== 'host' || app.hostT !== t) return; // stale transport (re-hosted meanwhile)
    app.lobby.code = code;
    app.lobby.codePending = false;
    refreshLobby();
  }).catch(err => {
    console.warn('PeerJS room registration failed — offline solo mode', err);
    if (app.role !== 'host' || app.hostT !== t || !app.lobby) return;
    app.lobby.codePending = false;
    app.lobby.code = null;
    refreshLobby();
  });
  // watchdog: drop silent clients (5 s)
  t.lastSeen = new Map();
  t.watch = setInterval(() => {
    if (!app.hostT) return;
    const now = performance.now();
    for (const [key, seen] of t.lastSeen) {
      if (now - seen > CONFIG.DISCONNECT_TIMEOUT * 1000) {
        t.lastSeen.delete(key);
        t.kick(key);
        hostDropPeer(key);
      }
    }
  }, 1000);
}

function hostOnMessage(key, msg) {
  if (!msg || typeof msg !== 'object') return;
  app.hostT.lastSeen.set(key, performance.now());
  switch (msg.t) {
    case 'hello': {
      if (app.mode !== 'lobby') { app.hostT.send(key, { t: 'refused', reason: 'Run already in progress' }); app.hostT.kick(key); return; }
      if (app.lobby.players.length >= CONFIG.MAX_PLAYERS) { app.hostT.send(key, { t: 'refused', reason: 'Room is full' }); app.hostT.kick(key); return; }
      if (!app.lobby.players.some(p => p.key === key)) {
        const used = new Set(app.lobby.players.map(p => p.color));
        const color = PALETTE.players.find(c => !used.has(c)) || PALETTE.players[app.lobby.players.length % PALETTE.players.length];
        app.lobby.players.push({ key, name: String(msg.name || 'ANON').slice(0, 12), color, charId: null, ready: false, isHost: false });
      }
      refreshLobby(); broadcastLobby();
      break;
    }
    case 'ui': hostHandleUi(key, msg); break;
    case 'in': {
      if (app.sim) {
        const idx = keyToIdx(key);
        if (idx >= 0) app.sim.setInput(idx, { mx: msg.mx, my: msg.my, interact: !!msg.e });
      }
      break;
    }
    case 'ping': break;
  }
}

function hostHandleUi(key, msg) {
  if (app.mode === 'lobby') {
    const p = app.lobby.players.find(q => q.key === key);
    if (!p) return;
    if (msg.kind === 'pick' && CHAR_BY_ID[msg.charId]) p.charId = msg.charId;
    if (msg.kind === 'ready') p.ready = !p.ready;
    refreshLobby(); broadcastLobby();
  } else if (app.sim) {
    const idx = keyToIdx(key);
    if (idx >= 0) app.sim.uiAction(idx, msg);
  }
}

function hostDropPeer(key) {
  if (app.role !== 'host') return;
  if (app.mode === 'lobby' && app.lobby) {
    const i = app.lobby.players.findIndex(p => p.key === key);
    if (i > 0) { app.lobby.players.splice(i, 1); refreshLobby(); broadcastLobby(); }
  } else if (app.sim && app.party) {
    const idx = keyToIdx(key);
    if (idx >= 0) app.sim.removePlayer(idx);
  }
}

function keyToIdx(key) {
  if (!app.party) return -1;
  const m = app.party.find(p => p.key === key);
  return m ? m.idx : -1;
}

function broadcastLobby() {
  if (app.hostT) app.hostT.broadcast({ t: 'lobby', lobby: publicLobby() });
}
function publicLobby() {
  // `roster` is host-authoritative: it rides every lobby broadcast so a client
  // is on the host's roster before it ever renders a character grid.
  return {
    code: app.lobby.code, codePending: app.lobby.codePending, roster: ROSTER_ID,
    players: app.lobby.players.map(p => ({ ...p })),
  };
}

// Host-only. Switching rosters clears everyone's character pick, because the
// ids in the old roster do not exist in the new one.
function hostPickRoster(id) {
  if (app.role === 'client' || !app.lobby || !ROSTERS[id] || id === ROSTER_ID) return;
  chooseRoster(id);
  for (const p of app.lobby.players) { p.charId = null; p.ready = false; }
  if (app.hostT) app.hostT.broadcast({ t: 'lobby', lobby: publicLobby() });
  refreshLobby();
}
function refreshLobby() {
  if (app.mode === 'lobby') showLobby(app.lobby, app.role === 'host', app.myKey);
}

function hostStartRun() {
  const l = app.lobby;
  if (!l.players.every(p => p.charId && (p.ready || p.isHost))) return;
  gateOnAssets(() => {
    if (app.mode !== 'lobby' || !app.lobby) return;   // left the lobby while we waited
    const seed = randomRunSeed();
    app.party = app.lobby.players.map((p, i) => ({ idx: i, key: p.key, name: p.name, charId: p.charId, color: p.color }));
    app.myIdx = 0;
    if (app.hostT) app.hostT.broadcast({ t: 'start', seed, roster: ROSTER_ID, party: app.party });
    startRunCommon();
    app.sim = new Sim({ seed, party: app.party });
    drainSimOutputs(true); // deliver initial floor/room events
  });
}

// Starting a run waits for the sprite load to settle so art does not pop in
// mid-fight — but only for so long. A hung image request is not a reason to
// keep anyone out of the game, so after ASSET_GATE_MS we go anyway and the
// sprites appear whenever they appear. Missing art is never an error path.
const ASSET_GATE_MS = 10000;
function gateOnAssets(then) {
  if (Assets.ready) { then(); return; }
  setNetStatus('Loading assets…');
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    setNetStatus('');
    then();
  };
  Assets.load().then(go);
  setTimeout(go, ASSET_GATE_MS);
}

function startRunCommon() {
  app.mode = 'run';
  hideScreens();
  closeAllOverlays();
  showHud(true);
  app.map = null;      // latest 'map' event (layout + visited/reachable)
  app.arena = null;    // latest 'arena' event (dims + obstacles + kind)
  app.runMode = 'map'; // 'map' | 'arena'
  app.bossInfo = null;
  hideMapScreen();
  app.meta = null;
  app.metas = {};
  app.snaps = [];
  app.lastSnapAt = performance.now(); // grace window before the no-snapshot watchdog may fire
  banner('THE UNDERVAULT', 'Floor 1', 2000);
}

// ---------------- lobby: client ----------------

let joinPending = false;
function joinGame(code) {
  if (joinPending) return; // one attempt at a time
  joinPending = true;
  const t = new ClientTransport();
  setTitleError('Connecting…');
  t.join(code).then(() => {
    joinPending = false;
    // stale resolve: the user moved on (hosted a game / left the title) meanwhile
    if (app.mode !== 'title' || app.role) { t.close(); return; }
    app.role = 'client';
    app.clientT = t;
    app.mode = 'lobby';
    app.myKey = t.peer.id;
    t.onMessage = msg => clientOnMessage(msg);
    t.onDisconnect = () => clientLostHost();
    t.send({ t: 'hello', name: currentName() });
    setTitleError('');
    // keepalive so the host's 5 s watchdog only fires on true silence
    app.inputTimer = setInterval(() => clientPump(), 33);
  }).catch(err => {
    joinPending = false;
    t.close();
    if (app.mode === 'title') setTitleError(err && err.message ? err.message : 'Could not join');
  });
}

function clientPump() {
  if (!app.clientT) return;
  if (app.mode === 'run') {
    const inp = sampleInput();
    app.clientT.send({ t: 'in', seq: ++app.seqNo, mx: +inp.mx.toFixed(3), my: +inp.my.toFixed(3), e: inp.interact ? 1 : 0 });
    if (inp.stance) sendUi({ kind: 'stance' });   // Samurai: Q, host-authoritative like every other action
    if (app.lastSnapAt && performance.now() - app.lastSnapAt > CONFIG.DISCONNECT_TIMEOUT * 1000) clientLostHost();
  } else {
    app.clientT.send({ t: 'ping' });
  }
}

// Host-sent payloads are untrusted: colors/codes/charIds land in innerHTML or
// inline styles, so normalize them before they touch the DOM.
const SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$/;
function sanitizeMember(p, i) {
  return {
    ...p,
    name: String(p.name || 'ANON').slice(0, 12),
    color: SAFE_COLOR.test(String(p.color)) ? p.color : PALETTE.players[i % PALETTE.players.length],
    charId: p.charId && CHAR_BY_ID[p.charId] ? p.charId : null,
  };
}
function sanitizeLobby(lobby) {
  if (!lobby || !Array.isArray(lobby.players)) return { code: null, codePending: false, roster: ROSTER_ID, players: [] };
  return {
    code: /^[A-Z2-9]{5}$/.test(String(lobby.code)) ? lobby.code : null,
    codePending: !!lobby.codePending,
    roster: ROSTER_IDS.includes(lobby.roster) ? lobby.roster : ROSTER_ID,
    players: lobby.players.slice(0, CONFIG.MAX_PLAYERS).map(sanitizeMember),
  };
}

function clientOnMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.t) {
    case 'lobby':
      // the host's roster wins, always — before sanitizeLobby resolves charIds
      applyHostRoster(msg.lobby && msg.lobby.roster, msg.lobby && msg.lobby.players);
      app.lobby = sanitizeLobby(msg.lobby);
      if (app.mode === 'lobby') showLobby(app.lobby, false, app.myKey);
      break;
    case 'refused':
      clientCleanup();
      app.mode = 'title';
      showHud(false);
      closeAllOverlays();
      hideMapScreen();
      showTitle(msg.reason || 'Refused');
      break;
    case 'start': {
      if (!Array.isArray(msg.party)) break;
      applyHostRoster(msg.roster, msg.party);   // again: sanitizeMember drops unknown charIds
      const party = msg.party.slice(0, CONFIG.MAX_PLAYERS).map(sanitizeMember);
      const me = party.find(p => p.key === app.myKey);
      if (!me || !me.charId) { // raced the host's START before our hello landed — bail cleanly
        clientCleanup();
        app.mode = 'title';
        showTitle('Run already started without you — try the next one');
        break;
      }
      app.party = party;
      app.myIdx = me.idx;
      gateOnAssets(() => {
        if (app.role !== 'client') return;   // dropped while we waited
        startRunCommon();
        app.predicted = null;
      });
      break;
    }
    case 'snap': {
      const snap = decodeSnap(msg); // unpack the wire buffers once, at ingest
      app.lastSnapAt = performance.now();
      app.snaps.push({ rt: app.lastSnapAt, s: snap });
      if (app.snaps.length > 30) app.snaps.splice(0, app.snaps.length - 30);
      renderer.ingestFx(snap.fx);
      break;
    }
    case 'ev': for (const ev of msg.list) handleEvent(ev); break;
    case 'meta': if (msg.idx === app.myIdx) { app.meta = msg; updateShopMeta(app.meta); updateSheetMeta(app.meta); } break;
    case 'abandon': // host ended the run for everyone — back to the lobby together
      applyHostRoster(msg.lobby && msg.lobby.roster, msg.lobby && msg.lobby.players);
      app.lobby = sanitizeLobby(msg.lobby);
      app.mode = 'lobby';
      app.snaps = [];
      app.meta = null;
      app.predicted = null;
      showHud(false);
      closeAllOverlays();
      hideMapScreen();
      showLobby(app.lobby, false, app.myKey);
      break;
  }
}

function clientLostHost() {
  if (app.role !== 'client') return;
  if (app.mode === 'results') { clientCleanup(); return; } // keep reading the results screen
  clientCleanup();
  showTitle('Host disconnected');
  showHud(false);
  closeAllOverlays();
  hideMapScreen();
  app.mode = 'title';
}

function clientCleanup() {
  if (app.inputTimer) { clearInterval(app.inputTimer); app.inputTimer = null; }
  if (app.clientT) { app.clientT.close(); app.clientT = null; }
  app.role = null;
  app.snaps = [];
}

// ---------------- shared plumbing ----------------

function sendUi(msg) {
  if (app.role === 'host') hostHandleUi('_local', { t: 'ui', ...msg });
  else if (app.clientT) app.clientT.send({ t: 'ui', ...msg });
}

function leaveToTitle() {
  if (app.hostT) { clearInterval(app.hostT.watch); app.hostT.close(); app.hostT = null; }
  clientCleanup();
  app.sim = null;
  app.mode = 'title';
  app.lobby = null;
  app.party = null;
  showHud(false);
  closeAllOverlays();
  hideMapScreen();
  setNetStatus('');
  showTitle();
}

// event → UI/audio. Runs on host (own events) and on clients (broadcast).
function handleEvent(ev) {
  switch (ev.k) {
    case 'sfx': if (sfx[ev.s]) sfx[ev.s](); break;
    case 'map': {
      const newFloor = !app.map || app.map.floorNum !== ev.floorNum;
      app.map = ev;
      app.arena = null;
      app.runMode = 'map';
      app.bossInfo = null;
      if (newFloor) {
        app.floorNum = ev.floorNum;
        closeAllOverlays();
        if (ev.floorNum > 1) banner(`FLOOR ${ev.floorNum}`, ['', 'The walls weep rust.', 'Something hums below.', 'The Vault is awake.'][ev.floorNum - 1] || '', 2200);
      }
      if (app.mode === 'run') showMapScreen(mapScreenState());
      break;
    }
    case 'arena':
      app.arena = ev;
      app.runMode = 'arena';
      app.bossInfo = null;
      hideMapScreen();
      if (ev.kind === 'siege') banner(ev.name || 'THE SIEGE', 'survive the shifting vault', 2600);
      else if (OBJECTIVE_META[ev.kind]) banner(OBJECTIVE_META[ev.kind].name.toUpperCase(), OBJECTIVE_META[ev.kind].hint, 2600);
      else if (ev.kind === 'elite') banner(ev.name || '', 'CHAMPION HUNT', 1600);
      break;
    case 'nodeVote': {
      const m = app.party && app.party.find(x => x.idx === ev.byIdx);
      if (ev.byIdx !== app.myIdx) toast(`${m ? m.name : 'A player'} ${ev.redirected ? 'redirected the path' : 'chose a path'}`);
      break;
    }
    case 'obstacles': // siege collapse: walls changed
      if (app.arena) app.arena.obstacles = ev.obstacles;
      break;
    case 'mutation':
      banner(ev.text || 'THE VAULT SHIFTS', '', 2200);
      sfx.roar();
      break;
    case 'roomClear':
      banner('FIELD CLEAR', `◆ ${ev.collected || 0} collected${ev.lost ? ` · <b style="color:var(--danger)">◆ ${ev.lost} lost to the dark</b>` : ' · nothing wasted'}`, 2200);
      break;
    case 'lootOver':
      banner('THE SPOILS SETTLE', `◆ ${ev.collected || 0} collected${ev.lost ? ` · ◆ ${ev.lost} lost` : ''} — shop, then descend`, 2400);
      break;
    case 'levelUp':
      levelupHorn(ev.idx === app.myIdx); // own = loud, ally = quiet, debounced
      if (ev.idx === app.myIdx) toast('Level up! (pick at room clear)');
      break;
    case 'offer': if (ev.idx === app.myIdx) showLevelup(ev); break;
    case 'offerDone': if (ev.idx === app.myIdx) closeLevelup(); break;
    case 'treasure': if (ev.idx === app.myIdx) showTreasure(ev); break;
    case 'treasureDone': if (ev.idx === app.myIdx) closeTreasure(); break;
    case 'boon': if (ev.idx === app.myIdx) showBoon(ev); break;
    case 'boonDone': if (ev.idx === app.myIdx) closeBoon(); break;
    case 'shop': if (ev.idx === app.myIdx) {
      const me = app.party && app.party.find(m => m.idx === app.myIdx);
      showShop(ev, app.meta, me ? me.charId : null);
    } break;
    case 'buyResult': if (ev.idx === app.myIdx && !ev.ok && ev.reason) toast(`Can't buy: ${ev.reason}`); break;
    case 'mgmtResult': if (ev.idx === app.myIdx && !ev.ok && ev.reason) toast(`Can't do that: ${ev.reason}`); break;
    case 'toast': if (ev.idx === app.myIdx || ev.idx === -1) toast(ev.text); break;
    case 'downed': {
      const m = app.party && app.party.find(p => p.idx === ev.idx);
      banner(ev.idx === app.myIdx ? 'YOU ARE DOWN' : `${m ? m.name : 'ALLY'} IS DOWN`, ev.idx === app.myIdx ? 'an ally can revive you' : 'stand close to revive', 1800);
      break;
    }
    case 'revived': if (ev.idx === app.myIdx) banner('REVIVED', '', 1200); break;
    case 'left': toast(`${ev.name} left the run`); break;
    case 'bossSpawn': app.bossInfo = { name: ev.name }; banner(ev.name, 'FLOOR BOSS', 2600); sfx.roar(); break;
    case 'bossPhase': banner('ENRAGED', '', 1200); sfx.roar(); break;
    case 'bossDown': banner('BOSS DEFEATED', 'sweep the field — the spoils fizzle when the count hits zero', 2600); break;
    case 'end': {
      app.mode = 'results';
      showHud(false);
      closeAllOverlays();
      hideMapScreen();
      showResults(ev.result, app.myIdx, app.role !== 'client');
      break;
    }
  }
}

// ---------------- host loop ----------------

let acc = 0, lastFrame = performance.now(), snapCounter = 0;
let lastSimTime = performance.now();

// Fixed-timestep host stepping on its own clock. Called from the rAF loop and
// from a background interval, so a hidden host tab (rAF suspended) keeps the
// simulation and snapshots alive instead of tripping clients' 5 s watchdogs.
function advanceHostSim() {
  if (app.role !== 'host' || app.mode !== 'run' || !app.sim || soloSheetPaused()) { lastSimTime = performance.now(); return; }
  const now = performance.now();
  acc += Math.min(0.25, (now - lastSimTime) / 1000);
  lastSimTime = now;
  const step = CONFIG.DT;
  let guard = 0;
  while (acc >= step && guard++ < 16) {
    acc -= step;
    if (!app.sim.over) hostTick();
    else { drainSimOutputs(); acc = 0; break; }
  }
  if (acc >= step) acc = 0; // spiral-of-death guard
}
setInterval(() => { if (document.hidden) advanceHostSim(); }, 40);

function drainSimOutputs(initial = false) {
  const sim = app.sim;
  if (!sim) return;
  if (sim.events.length) {
    const list = sim.events.splice(0);
    if (app.hostT) app.hostT.broadcast({ t: 'ev', list });
    for (const ev of list) handleEvent(ev);
  }
  // metas
  for (const p of sim.players) {
    if (p.metaDirty || initial) {
      const meta = sim.getMeta(p);
      app.metas[p.idx] = meta;
      if (p.idx === app.myIdx) { app.meta = meta; updateShopMeta(meta); updateSheetMeta(meta); }
      else if (app.hostT) {
        const member = app.party.find(m => m.idx === p.idx);
        if (member && member.key !== '_local') app.hostT.send(member.key, meta);
      }
    }
  }
}

// Host bandwidth ledger (window.uvNet): what the snapshot stream costs,
// per peer and in total — the README's host guidance quotes these numbers.
const uvNet = { snaps: 0, snapBytes: 0, lastSnapBytes: 0, bytesOut: 0, hz: CONFIG.SNAPSHOT_HZ };
window.uvNet = uvNet;

function snapshotDivisor() {
  // 8-player rooms trade snapshot rate for headroom: 12/s at 6+ players.
  // The client interpolates on receive timestamps, so nothing else changes.
  const n = app.sim ? app.sim.players.filter(p => !p.gone).length : 1;
  uvNet.hz = n >= CONFIG.SNAPSHOT_CROWD_AT ? CONFIG.SNAPSHOT_HZ_CROWD : CONFIG.SNAPSHOT_HZ;
  return Math.round(CONFIG.TICK_RATE / uvNet.hz);
}

function hostTick() {
  const sim = app.sim;
  const inp = sampleInput();
  sim.setInput(0, { mx: inp.mx, my: inp.my, interact: inp.interact });
  if (inp.stance) sim.uiAction(0, { kind: 'stance' });   // Samurai: Q
  sim.tick();
  renderer.ingestFx(sim.fx);
  drainSimOutputs();
  if (++snapCounter >= snapshotDivisor()) {
    snapCounter = 0;
    if (app.hostT && app.hostT.conns.size) {
      const wire = encodeSnap(sim.getSnapshot());
      const sz = wireSize(wire);
      uvNet.snaps++;
      uvNet.snapBytes += sz;
      uvNet.lastSnapBytes = sz;
      uvNet.bytesOut += sz * app.hostT.conns.size;
      app.hostT.broadcast(wire);
    }
  }
}

// ---------------- view building ----------------

// state for the node-map DOM screen (host reads the sim; clients the events + snaps)
function mapScreenState() {
  const m = app.map;
  const sim = app.sim;
  let vote = null;
  if (sim && sim.nodeVote) vote = { nodeId: sim.nodeVote.nodeId, t: sim.nodeVote.t, byIdx: sim.nodeVote.byIdx };
  else if (!sim && app.snaps.length) {
    const last = app.snaps[app.snaps.length - 1].s;
    if (last.vote) vote = last.vote;
  }
  const voter = vote && app.party ? app.party.find(x => x.idx === vote.byIdx) : null;
  const curNode = m.layout.nodes[m.current];
  return {
    layout: m.layout, floorNum: m.floorNum,
    current: m.current, visited: m.visited, reachable: m.reachable,
    vote, voteName: voter ? voter.name : null,
    onShop: !!(curNode && curNode.kind === 'shop'),
  };
}

function viewFromSim(sim) {
  if (sim.phase === 'map') {
    return {
      myIdx: app.myIdx, mode: 'map', shake: 0,
      players: sim.players.map(p => ({
        idx: p.idx, name: p.name, color: p.color, charId: p.charId, sym: p.char.sym,
        x: 0, y: 0, hp: Math.ceil(p.hp), maxHp: p.stats.vitality, shield: Math.round(p.shield),
        downed: p.downed, reviveP: 0, gone: p.gone, meter: -1,
      })),
      boss: null,
    };
  }
  return {
    myIdx: app.myIdx,
    mode: 'arena',
    aw: sim.W, ah: sim.H,
    arenaKey: `${sim.floorNum}:${sim.currentNode}`,
    biome: sim.biome || null,
    kind: sim.arenaNode ? sim.arenaNode.kind : null,
    afterSiege: sim.afterSiege,
    obstacles: sim._snapObstacles(),
    cleared: sim.cleared, locked: !sim.cleared,
    shake: sim.shake,
    extract: sim.extract ? sim.extract.t : null,
    ec: sim.enemyPool.count,
    obj: sim.obj ? serializeObjective(sim) : null,
    inc: sim.phase === 'arena' && sim.wave && !sim.wave.done ? 1 : 0,
    loot: sim.lootT !== null && sim.lootT !== undefined ? sim.lootT : null,
    hold: sim.holdCircle ? [sim.holdCircle.x, sim.holdCircle.y, sim.holdCircle.r, sim.holdCircle.held ? 1 : 0] : null,
    hatch: sim.hatch ? [sim.hatch.x, sim.hatch.y] : null,
    players: sim.players.map(p => ({
      idx: p.idx, name: p.name, color: p.color, charId: p.charId, sym: p.char.sym,
      x: p.x, y: p.y, hp: Math.ceil(p.hp), maxHp: p.stats.vitality, shield: Math.round(p.shield),
      downed: p.downed, reviveP: p.reviveP, gone: p.gone, radius: p.radius, aimA: p.aimA,
      meter: sim._displayMeter(p), carrying: !!p.carrying,
      reloc: Math.min(1, p.relocT / CONFIG.STRUCT_CHANNEL_S),
      ts: tohState(sim, p),
      trait: p.char.trait.key,
      spriteId: p.char.spriteId,   // cosmetic; resolved from the def, never networked
    })),
    // Thrones of Heaven world layer (null/empty on the classic roster)
    toh: tohSnapshot(sim),
    tohMarks: tohMarks(sim),
    spirits: sim.players.filter(q => !q.gone && q.spirit)
      .map(q => [Math.round(q.spirit.x), Math.round(q.spirit.y), q.spirit.t / q.spirit.dur, q.idx]),
    colors: Object.fromEntries(sim.players.map(q => [q.idx, q.color])),
    auras: sim._snapAuras().map(a => ({ idx: a[0], r: a[1] })),
    tethers: sim._snapTethers().map(t => ({ x1: t[0], y1: t[1], x2: t[2], y2: t[3] })),
    decoys: sim.decoys.map(d => ({ x: d.x, y: d.y, frac: d.t / d.dur, owner: d.owner })),
    enemies: [...sim.enemyPool].map(e => ({
      id: e.id, x: e.x, y: e.y, radius: e.radius, shape: e.shape, color: e.color,
      hpFrac: e.hp / e.maxHp, elite: e.elite, boss: e.boss, mini: e.mini,
      flash: e.hitFlash > 0, fusing: e.fusing, pylon: e.typeIdx === -2,
      // sprite id from the definition table, exactly as shape/color are — the
      // client resolves the same id from the type index on the wire
      spriteId: e.boss ? e.bossDef.spriteId : (e.typeIdx === -2 ? PYLON_SPRITE : (e.def && e.def.spriteId)),
    })),
    projs: [...sim.projPool].map(pr => ({
      x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, radius: pr.radius, color: pr.color, friendly: pr.friendly,
      spriteId: projSpriteFor(pr.color, pr.friendly, pr.radius),
    })),
    pickups: sim.pickups,
    summons: sim.summons.filter(s => !s.dead).map(s => ({ owner: s.owner, type: s.type, x: s.x, y: s.y, aimA: s.aimA, packed: s.deployT > 0,
      down: !!s.down, downP: s.down ? s.downT / BEAST.DOWN_S : 0 })),
    tele: sim.telegraphs.map(tg => tg.shape === 'circle'
      ? { shape: 'c', x: tg.x, y: tg.y, r: tg.r, prog: tg.t / tg.dur, spawnMark: !!tg.spawnMark }
      : { shape: 'b', x: tg.x, y: tg.y, a: tg.angle, w: tg.w, len: tg.len, prog: tg.t / tg.dur }),
    zones: [
      ...sim.zones.map(z => ({ x: z.x, y: z.y, r: z.r, color: z.color, hostile: z.hurts === 'players' })),
      ...sim.vortexes.map(v => ({ x: v.x, y: v.y, r: v.coreR, color: '#a86ae8', hostile: true })),
    ],
    beams: sim.activeBeams,
    hazards: sim.hazards || [],
    boss: sim.boss ? { name: sim.boss.bossDef.name, hp: sim.boss.hp, max: sim.boss.maxHp } : null,
  };
}

// interpolate client snapshots at ~now-120ms
function viewFromSnaps(dtFrame) {
  const buf = app.snaps;
  if (!buf.length) return null;
  const targetRt = performance.now() - CONFIG.INTERP_DELAY_MS;
  let i = buf.length - 1;
  while (i > 0 && buf[i - 1].rt > targetRt) i--;
  const b = buf[i];
  const a = buf[i - 1] || b;
  const span = Math.max(1, b.rt - a.rt);
  const alpha = clamp((targetRt - a.rt) / span, 0, 1);
  const s0 = a.s, s1 = b.s;
  const L = (x, y) => x + (y - x) * alpha;

  const emap = new Map();
  for (const e of s1.enemies) emap.set(e[0], e);
  const enemies = [];
  for (const e of s0.enemies) {
    const n = emap.get(e[0]) || e;
    const flags = n[5];
    const pylon = !!(flags & 32);
    let shape, color, radius, spriteId;
    if (flags & 2) { const bd = BOSSES[app.floorNum - 1]; shape = bd.shape; color = bd.color; radius = bd.radius; spriteId = bd.spriteId; }
    else if (pylon) { shape = 'square'; color = '#c05eff'; radius = 26; spriteId = PYLON_SPRITE; }
    else {
      const def = ENEMIES[n[1]];
      shape = def ? def.shape : 'circle'; color = def ? def.color : '#e2504c';
      spriteId = def ? def.spriteId : null;   // same derivation as shape/color
      // radius derived, not sent: base × elite/mini scaling
      radius = (def ? def.radius : 14) * ((flags & 1) ? 1.45 : 1) * ((flags & 4) ? 0.6 : 1);
    }
    enemies.push({
      id: e[0], x: L(e[2], n[2]), y: L(e[3], n[3]), hpFrac: L(e[4], n[4]), radius,
      elite: !!(flags & 1), boss: !!(flags & 2), mini: !!(flags & 4), flash: !!(flags & 8), fusing: !!(flags & 16),
      pylon, shape, color, spriteId,
    });
  }
  const pmap = new Map();
  for (const p of s1.players) pmap.set(p[0], p);
  const players = [];
  for (const p of s0.players) {
    const n = pmap.get(p[0]) || p;
    const idx = p[0];
    const member = app.party ? app.party.find(m => m.idx === idx) : null;
    const chr = member ? CHAR_BY_ID[member.charId] : null;
    let x = L(p[1], n[1]), y = L(p[2], n[2]);
    // own player: predict from local input, softly reconciled to server
    if (idx === app.myIdx && !n[5]) {
      const pred = predictSelf(dtFrame, n, chr);
      x = pred.x; y = pred.y;
    }
    players.push({
      idx, x, y, hp: n[3], maxHp: n[4], downed: !!n[5], reviveP: n[6], shield: n[7], gone: !!n[8], aimA: n[9],
      meter: n[10] !== undefined ? n[10] : -1, carrying: !!n[11], reloc: n[12] || 0,
      ts: n[13] || 0,   // ToH trait state: stance / stacks / contracts / pack mode
      trait: chr ? chr.trait.key : null,
      name: member ? member.name : '?', color: member ? member.color : '#fff', charId: member ? member.charId : null,
      sym: chr ? chr.sym : '●',
      spriteId: chr ? chr.spriteId : null,   // cosmetic; from the def, never on the wire
      radius: chr && (chr.trait.key === 'immovable' || chr.trait.key === 'crystal_infusion') ? 16 * chr.trait.hitbox : 16,
    });
  }
  // projectiles ride the same delayed timeline as enemies (bounded extrapolation)
  const projDt = clamp((targetRt - b.rt) / 1000, -0.2, 0.15);
  const projs = s1.projs.map(pr => ({
    x: pr[1] + pr[3] * projDt, y: pr[2] + pr[4] * projDt, vx: pr[3], vy: pr[4],
    friendly: !!pr[5], radius: pr[6], color: pr[7],
    spriteId: projSpriteFor(pr[7], !!pr[5], pr[6]),
  }));
  return {
    myIdx: app.myIdx,
    mode: s1.mode === 0 ? 'map' : 'arena',
    aw: app.arena ? app.arena.w : undefined,
    ah: app.arena ? app.arena.h : undefined,
    arenaKey: `${app.floorNum}:${s1.node}`,
    // from the 'arena' event, not a snapshot — the floor is cosmetic and never
    // goes on the wire per frame. A client that missed the event draws flat.
    biome: app.arena ? app.arena.biome || null : null,
    kind: app.arena ? app.arena.kind : null,
    afterSiege: app.arena ? app.arena.kind === 'siege' : false,
    obstacles: app.arena ? app.arena.obstacles : [],
    cleared: !!s1.cleared, locked: !s1.cleared,
    shake: s1.shake,
    extract: s1.extract !== undefined ? s1.extract : null,
    ec: s1.ec !== undefined ? s1.ec : null,
    obj: s1.obj || null,
    inc: s1.inc || 0,
    loot: s1.loot !== undefined ? s1.loot : null,
    hold: s1.hold || null,
    hatch: s1.hatch,
    players, enemies, projs,
    pickups: s1.pickups.map(m => ({ x: m[0], y: m[1] })),
    summons: s1.summons.map(sm => ({ owner: sm[0], type: sm[1], x: sm[2], y: sm[3], aimA: sm[5], packed: !!sm[6],
      down: (sm[7] || 0) > 0, downP: sm[7] || 0 })),
    tele: s1.tele.map(tg => tg[0] === 'c'
      ? { shape: 'c', x: tg[1], y: tg[2], r: tg[3], prog: tg[4], spawnMark: !!tg[5] }
      : { shape: 'b', x: tg[1], y: tg[2], a: tg[3], w: tg[4], len: tg[5], prog: tg[6] }),
    zones: s1.zones.map(z => ({ x: z[0], y: z[1], r: z[2], color: z[3], hostile: !!z[4] })),
    beams: (s1.beams || []).map(bm => ({ x: bm.x, y: bm.y, a: bm.a, len: bm.len, w: bm.w })),
    hazards: (s1.hazards || []).map(hz => hz[0] === 's'
      ? { type: 'spikes', x: hz[1], y: hz[2], w: hz[3], h: hz[4], state: hz[5] }
      : { type: 'lava', x: hz[1], y: hz[2], r: hz[3] }),
    boss: s1.boss,
    auras: (s1.auras || []).map(a => ({ idx: a[0], r: a[1] })),
    tethers: (s1.tethers || []).map(t => ({ x1: t[0], y1: t[1], x2: t[2], y2: t[3] })),
    decoys: (s1.decoys || []).map(d => ({ x: d[0], y: d[1], frac: d[2], owner: d[3] })),
    // Thrones of Heaven: coral, singularities, spirits and the two marks whose
    // traits are invisible without them. Taken from the newest snapshot rather
    // than interpolated — they are slow, and a stale tether is worse than a
    // one-frame-late one.
    toh: s1.toh || null,
    tohMarks: s1.tohMarks || [],
    spirits: s1.spirits || [],
    colors: Object.fromEntries((app.party || []).map(m => [m.idx, m.color])),
  };
}

function predictSelf(dtFrame, serverP, chr) {
  const radius = chr && (chr.trait.key === 'immovable' || chr.trait.key === 'crystal_infusion') ? 16 * chr.trait.hitbox : 16;
  if (!app.predicted) app.predicted = { x: serverP[1], y: serverP[2] };
  const pr = app.predicted;
  const tempo = app.meta ? app.meta.stats.tempo : 0;
  const spd = Math.max(60, CONFIG.BASE_SPEED * (1 + tempo / 100));
  pr.x += lastMove.mx * spd * dtFrame;
  pr.y += lastMove.my * spd * dtFrame;
  // clamp to the CURRENT arena's bounds (obstacles reconcile via the server)
  const aw = app.arena ? app.arena.w : 1280, ah = app.arena ? app.arena.h : 720;
  pr.x = clamp(pr.x, WALL + radius, aw - WALL - radius);
  pr.y = clamp(pr.y, WALL + radius, ah - WALL - radius);
  // soft reconciliation
  const ex = serverP[1] - pr.x, ey = serverP[2] - pr.y;
  const err = Math.hypot(ex, ey);
  if (err > 140) { pr.x = serverP[1]; pr.y = serverP[2]; }
  else { const k = Math.min(1, dtFrame * 4); pr.x += ex * k; pr.y += ey * k; }
  return pr;
}

// live movement intent for prediction (client render loop reads this; the
// 30 Hz sender consumes the latched E press separately)
const lastMove = { mx: 0, my: 0 };

// ---------------- frame loop ----------------

let hudTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dtFrame = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  app.fps.frames++;
  app.fps.t += dtFrame;
  if (app.fps.t >= 0.5) { app.fps.value = Math.round(app.fps.frames / app.fps.t); app.fps.frames = 0; app.fps.t = 0; updateFpsBadge(); }

  if (app.mode !== 'run') { renderer.draw(null, dtFrame); return; }

  handleDebugKeys();

  let view = null;
  if (app.role === 'host') {
    advanceHostSim();
    if (app.sim) view = viewFromSim(app.sim);
  } else {
    const mv = readMoveKeys();
    lastMove.mx = mv.mx; lastMove.my = mv.my;
    view = viewFromSnaps(dtFrame);
  }

  // Overlay state is read straight off the host sim. On a client it stays null,
  // which is correct — a client has no trigger state to show because it never
  // evaluates one.
  renderer.trigDebug = app.sim ? {
    stats: app.sim.trigStats,
    players: app.sim.players.filter(q => !q.gone).map(q => ({
      idx: q.idx, name: q.name, footing: q.engines ? q.engines.footing : 0,
      cds: (q.loadout || []).filter(Boolean).map(id => ({ id, cd: +(q.skillCd[id] || 0).toFixed(1) })),
      last: q.trigEvents ? q.trigEvents.lastFired : null,
    })),
    log: (app.sim.players[app.myIdx] && app.sim.players[app.myIdx].fireLog) || [],
    enemies: app.sim.enemyPool.count,
  } : null;
  renderer.draw(view, dtFrame);

  // node-map screen follows the run mode (host and client alike)
  const inMap = view && view.mode === 'map';
  if (inMap && app.map) {
    if (!isMapScreenOpen()) showMapScreen(mapScreenState());
    else updateMapScreen(mapScreenState());
  } else if (!inMap && isMapScreenOpen()) {
    hideMapScreen();
  }

  hudTimer += dtFrame;
  if (view && hudTimer >= 0.1) {
    hudTimer = 0;
    updateHud(app.meta, view, {
      floorNum: app.floorNum,
      arenaName: app.arena && view.mode === 'arena' ? app.arena.name : null,
      kind: view.mode === 'arena' ? view.kind : null,
      boss: view.boss,
    });
    // contextual touch button for the E action (Overseer turret carry in
    // arenas; the post-siege shop at the descent portal)
    const me = app.party && app.party.find(m => m.idx === app.myIdx);
    const isOverseer = me && CHAR_BY_ID[me.charId] && CHAR_BY_ID[me.charId].trait.key === 'overseer';
    const wantInteract = touchEnabled() && !isShopOpen() && view.mode === 'arena'
      && (isOverseer || (view.afterSiege && view.cleared && !!view.hatch));
    document.getElementById('interact-btn').classList.toggle('hidden', !wantInteract);
    const meNow = (view.players || []).find(q => q.idx === app.myIdx);
    document.getElementById('stance-btn').classList.toggle('hidden', !(meNow && meNow.trait === 'three_stances'));
    if (meNow && meNow.trait === 'three_stances') document.getElementById('stance-btn').textContent = TOH_STANCE_NAMES[meNow.ts] || 'STANCE';
  }
}
requestAnimationFrame(frame);

// client-side movement key reading for prediction (mirrors input.js mapping,
// but without consuming the E latch that the 30 Hz sender needs)
const liveKeys = new Set();
window.addEventListener('keydown', e => liveKeys.add(e.code));
window.addEventListener('keyup', e => liveKeys.delete(e.code));
window.addEventListener('blur', () => liveKeys.clear());
function readMoveKeys() {
  let mx = 0, my = 0;
  if (liveKeys.has('KeyA') || liveKeys.has('ArrowLeft')) mx -= 1;
  if (liveKeys.has('KeyD') || liveKeys.has('ArrowRight')) mx += 1;
  if (liveKeys.has('KeyW') || liveKeys.has('ArrowUp')) my -= 1;
  if (liveKeys.has('KeyS') || liveKeys.has('ArrowDown')) my += 1;
  if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
  if (joy.active && touchEnabled()) { mx = joy.mx; my = joy.my; }
  return { mx, my };
}

// ---------------- debug (DEV) ----------------

let fpsBadge = null;
function updateFpsBadge() {
  if (!app.fps.show) return;
  if (!fpsBadge) {
    fpsBadge = document.createElement('div');
    fpsBadge.style.cssText = 'position:absolute;left:10px;top:50%;background:#000a;color:#0f0;font:bold 13px monospace;padding:3px 8px;border-radius:4px;z-index:50;';
    document.getElementById('ui-root').appendChild(fpsBadge);
  }
  const extra = app.sim ? ` E:${app.sim.enemyPool.count} P:${app.sim.projPool.count}` : '';
  fpsBadge.textContent = `${app.fps.value} fps${extra}`;
}

function handleDebugKeys() {
  if (!DEV) return;
  const k = takeDebugKey();
  if (!k) return;
  if (k === 'F6') {
    app.fps.show = !app.fps.show;
    renderer.showHitboxes = app.fps.show;
    if (!app.fps.show && fpsBadge) { fpsBadge.remove(); fpsBadge = null; }
    return;
  }
  if (app.role === 'host' && app.sim) app.sim.debug(k);
}

// ---------------- character smoke test (DoD #4) ----------------

window.uvSmoke = function () {
  const failures = [];
  for (const c of CHARACTERS) {
    try {
      const sim = new Sim({ seed: 123456789, party: [{ idx: 0, key: '_local', name: 'SMOKE', charId: c.id, color: '#fff' }] });
      sim.uiAction(0, { kind: 'pickNode', nodeId: sim.reachableNodes()[0] }); // into the first arena
      sim.debug('F1');
      for (let i = 0; i < 180; i++) sim.tick();
      sim.getSnapshot();
      sim.debug('F3');
      for (let i = 0; i < 60; i++) sim.tick();
    } catch (err) {
      failures.push({ char: c.id, err: String(err && err.stack || err) });
    }
  }
  if (failures.length) console.error('SMOKE FAILURES', failures);
  else console.log(`SMOKE OK — all ${CHARACTERS.length} characters spawn and fight cleanly`);
  return failures;
};
