// Entry point & orchestrator. Owns the screen state machine, the fixed-timestep
// host loop, the client interpolation/prediction loop, and all glue between
// sim events and UI/audio. Simulation (game.js) never touches the DOM.

import { CONFIG, DEV, PALETTE } from './config.js';
import { readsTokens, TREES as TREES_UI, TREES_BY_CLASS as TREES_BY_CLASS_UI } from './skills.js';
// A player row's class, host-side. `char` is the def object; charId is the id.
const myCharId = p => (p && p.char ? p.char.id : null);
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
import { DEFAULT_DIFFICULTY } from './worldmap.js';
import { initOverlays, closeAllOverlays, showShop, closeShop, isShopOpen, updateShopMeta, showLevelup, closeLevelup, showTreasure, closeTreasure, showSheet, closeSheet, isSheetOpen, updateSheetMeta, showBoon, closeBoon, showOpening, closeOpening, showSkills, closeSkills, isSkillsOpen, updateSkillsMeta } from './ui/overlays.js';
import { CHARACTERS, CHAR_BY_ID, isSelectable } from './content/characters.js';
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
  // defect #8: client input is resent until acked, and applied once per
  // sequence number. uiSeq/uiPending are the client's; uiSeen is the host's
  // per-peer high-water mark. `seqNo` above is the movement stream's and is
  // deliberately separate — movement is lossy on purpose, it repeats at 30 Hz.
  uiSeq: 0, uiPending: new Map(), uiSeen: new Map(),
  fps: { frames: 0, t: 0, value: 60, show: false },
};

const actions = {
  host: hostGame,
  join: joinGame,
  leave: leaveToTitle,
  backToLobby: hostReturnToLobby,
  pickChar: charId => sendUi({ kind: 'pick', charId }),
  toggleReady: () => sendUi({ kind: 'ready' }),
  // §4.1's ladder, finally with a writer. `app.lobby.difficulty` was READ at the
  // lobby heartbeat and assigned nowhere in the codebase, so the field was
  // always undefined and every run resolved to Standard through
  // `difficultyOf`'s fallback. Host-only: the run is host-authoritative and a
  // party plays one difficulty. Guests see the choice on their own lobby
  // through the heartbeat that already carried the field.
  setDifficulty: (id) => {
    if (app.role !== 'host') return;
    app.lobby.difficulty = id;
    refreshLobby();
    broadcastLobby();
  },
  startGame: hostStartRun,
};
// Sprites start loading NOW, at page load, while the player is still reading
// the title and picking a character — not at game start, where a stall would
// be a stall in the run. Nothing waits on this: with no art on disk every
// request 404s in milliseconds and the game draws its primitives, which is the
// state the project ships in today.
Assets.load('assets/assets.json');

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
  pickOpening: id => sendUi({ kind: 'opening', id }),
  learnSkill: id => sendUi({ kind: 'learnSkill', id }),
  // The map-end spend step's only exit (§5.5). Sent on every close of the tree
  // screen, not just the prompted one — the host drops it when no step is open.
  spendDone: () => sendUi({ kind: 'spendDone' }),
  setSlot: (slot, id) => sendUi({ kind: 'setSlot', slot, id }),
  combine: (a, b, id, tier) => sendUi({ kind: 'combine', a, b, id, tier }),
  sellWeapon: (slot, id, tier) => sendUi({ kind: 'sellWeapon', slot, id, tier }),
  sellItem: id => sendUi({ kind: 'sellItem', id }),
  openSheet: () => toggleSheet(true),
  openSkills: () => toggleSkills(true),
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
document.getElementById('skills-btn').onclick = () => { sfx.click(); toggleSkills(); };
window.addEventListener('keydown', e => {
  if (document.activeElement.tagName === 'INPUT') return;
  if (e.code === 'KeyC' && app.mode === 'run') toggleSheet();
  if (e.code === 'KeyK' && app.mode === 'run') toggleSkills();
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

// The skill screen: the same shape as the sheet — opened by the player, closed
// by its own button, no host event on either edge. Its DATA is `app.meta`, which
// now carries skillPoints/skillRanks/loadout; its CONTENT is the tree registry,
// read straight from js/skills.js because trees are static data that ships with
// the build and has no business on the wire.
function skillTrees() {
  const me = app.party && app.party.find(m => m.idx === app.myIdx);
  const charId = me && me.charId;
  const ids = (TREES_BY_CLASS_UI[charId] || []);
  if (!ids.length) return null;
  const byId = {};
  const list = ids.map(t => {
    const skills = [...TREES_UI[t].skills].sort((a, b) => a.tier - b.tier);
    for (const s of skills) byId[s.id] = s;
    return { id: t, name: TREES_UI[t].name, skills };
  });
  return { list, byId };
}

// REOPEN THE §5.6 CARD FROM `pend`, not from the event.
//
// The offer is created while the Sim is being constructed, so the `opening`
// event can be flushed before this client is listening — a browser run showed
// exactly that, with the panel never appearing and only the anti-softlock floor
// saving the run. `pend` carries presence rather than picks, so the picks are
// REBUILT here from the tree registry, which every client already ships: they
// are the tier-1 nodes of this character's own trees, which is the same list
// `openingPicks` produces on the host. No new wire field, and the two lists
// cannot drift because both are derived from the same static content.
function showOpeningFromPend() {
  if (!document.getElementById('overlay-opening').classList.contains('hidden')) return;
  const trees = skillTrees();
  if (!trees || !app.meta) return;
  const ranks = app.meta.skillRanks || {};
  const picks = trees.list
    .map(t => t.skills.find(s => s.tier === 1))
    .filter(s => s && !(s.maxRank !== undefined && (ranks[s.id] || 0) >= s.maxRank))
    .map(s => ({ id: s.id, name: s.name, desc: s.desc, tree: TREES_UI[s.tree].name, domain: s.domain }));
  if (picks.length) showOpening({ picks });
}

function toggleSkills(forceOpen = false) {
  if (isSkillsOpen() && !forceOpen) { closeSkills(); return; }
  if (app.mode !== 'run' || !app.meta) return;
  const trees = skillTrees();
  if (!trees) return;
  const me = app.party && app.party.find(m => m.idx === app.myIdx);
  showSkills(app.meta, me ? me.charId : null, trees);
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
  startLobbyHeartbeat();   // the lobby's repeating channel — see the note on it
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
    // The reason, not just the fact. Defect #9 was "undiagnosed" for a patch
    // because this line said "failed" and threw the cause away.
    const reg = err && err.reg;
    const tried = (t.regFailures || []).map(f => `${f.type}(${f.code || '-'})`).join(', ');
    console.warn(`[net] ROOM REGISTRATION FAILED after ${(t.regFailures || []).length} attempt(s) — offline solo mode. `
      + `last: ${reg ? `${reg.type} — ${reg.detail}` : (err && err.message) || err}. all attempts: ${tried || 'none recorded'}`);
    if (typeof window !== 'undefined') {
      window.uvNet = window.uvNet || {};
      window.uvNet.regFailures = t.regFailures || [];
    }
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

// APPLIED ONCE PER SEQUENCE NUMBER, ACKNOWLEDGED EVERY TIME. The client resends
// until it hears back, so this sees duplicates by design — and `ready` toggles,
// so applying a duplicate would undo the press that caused it.
//
// The ack is sent even for a duplicate, because a duplicate is what a LOST ACK
// looks like from here: the action landed, our reply did not, and the client is
// asking again. Staying quiet would leave it resending until it gave up on an
// action the host had already carried out.
function hostHandleUi(key, msg) {
  if (msg.useq !== undefined && key !== '_local') {
    const seen = app.uiSeen.get(key) || 0;
    if (app.hostT) app.hostT.send(key, { t: 'uiack', useq: msg.useq });
    if (msg.useq <= seen) {
      const led = window.uvNet || (window.uvNet = {});
      led.uiDuplicates = (led.uiDuplicates || 0) + 1;
      return;
    }
    app.uiSeen.set(key, msg.useq);
    // and what the HOST actually applied, in order. Paired with the client's
    // uiLog these two answer the question outright: same length means the
    // handler fired once per press, and a `ready` that appears twice explains
    // a toggle that ended where it started.
    const led = window.uvNet || (window.uvNet = {});
    (led.uiApplied ||= []).push(`${key.slice(-6)}/${msg.useq}:${msg.kind}`);
    if (led.uiApplied.length > 40) led.uiApplied.shift();
  }
  if (app.mode === 'lobby') {
    const p = app.lobby.players.find(q => q.key === key);
    if (!p) return;
    // The host validates the pick. The greyed card in the client's lobby is an
    // affordance; this is the enforcement, and it has to be here because a
    // client can send whatever it likes.
    if (msg.kind === 'pick') {
      if (CHAR_BY_ID[msg.charId] && isSelectable(msg.charId)) p.charId = msg.charId;
      else console.warn(`[lobby] refused pick "${msg.charId}" from ${key} — unknown or not selectable`);
    }
    if (msg.kind === 'ready') p.ready = !p.ready;
    refreshLobby(); broadcastLobby();
  } else if (app.sim) {
    const idx = keyToIdx(key);
    if (idx >= 0) app.sim.uiAction(idx, msg);
  }
}

function hostDropPeer(key) {
  if (app.role !== 'host') return;
  // Forget the sequence high-water mark with the peer. A client that rejoins
  // starts counting from 1 again, and a stale mark would make the host discard
  // its first actions as duplicates — a reconnect that lands in the lobby and
  // then ignores every button the player presses.
  app.uiSeen.delete(key);
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

// THE LOBBY HEARTBEAT. Every screen that can hold co-op state needs a REPEATING
// channel; the lobby had none.
//
// In-run state was moved onto the snapshot stream, which repeats 15 times a
// second and therefore heals a dropped message on the next frame. The lobby has
// no snapshot stream — it is not simulating anything — so lobby state travelled
// only as edges: a `lobby` broadcast on join, on pick and on ready
// switch. A peer whose channel was not open for one of those was left showing a
// stale lobby with no way to notice, which is how a co-op run failed at
// `client ready` with the party visibly assembled on the host's screen.
//
// The full state, on a timer. Not a delta, not a resync request — the same
// payload the edges send, repeated. Pre-run bandwidth is irrelevant: nothing
// else is on the wire, and this is a few hundred bytes at 3Hz.
//
// Self-guarding rather than lifecycle-managed: one interval for the life of the
// page, which does nothing unless this client is a host sitting in a lobby.
// Start/stop pairs around a screen transition are their own class of bug.
function startLobbyHeartbeat() {
  if (app._lobbyBeat) return;
  app._lobbyBeat = setInterval(() => {
    if (app.role === 'host' && app.mode === 'lobby' && app.hostT && app.lobby) broadcastLobby();
  }, 1000 / CONFIG.LOBBY_HEARTBEAT_HZ);
}

function publicLobby() {
  // There is ONE roster now, so nothing about which characters exist has to
  // travel. This used to carry `roster`, and a joining client force-corrected
  // itself onto the host's before rendering a single character grid.
  //
  // players[] carries key, name, colour, charId (the class pick), ready and
  // isHost — so peers, ready flags, picks and which character the host is on
  // are all here. `difficulty` is declared and null: the party-selected
  // difficulty is phase 2 §8 and does not exist yet, and the point of naming it
  // now is that when it does exist it rides this heartbeat rather than being
  // announced once and lost.
  return {
    code: app.lobby.code, codePending: app.lobby.codePending,
    difficulty: app.lobby.difficulty || null,
    players: app.lobby.players.map(p => ({ ...p })),
  };
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
    // The difficulty rides the start message as well as the Sim. Clients do not
    // simulate today — `app.sim` is assigned on the host only — so this is not
    // a desync guard; it is so a client KNOWS what it agreed to play, and so a
    // later client-side predictor inherits the setting rather than defaulting.
    const difficulty = app.lobby.difficulty || DEFAULT_DIFFICULTY;
    if (app.hostT) app.hostT.broadcast({ t: 'start', seed, party: app.party, difficulty });
    startRunCommon();
    app.sim = new Sim({ seed, party: app.party, difficulty });
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
  pumpUiAcks();
  if (app.mode === 'run') {
    const inp = sampleInput();
    app.clientT.send({ t: 'in', seq: ++app.seqNo, mx: +inp.mx.toFixed(3), my: +inp.my.toFixed(3), e: inp.interact ? 1 : 0 });
    if (inp.stance) sendUi({ kind: 'stance' });   // Samurai: Q, host-authoritative like every other action
    if (app.lastSnapAt && performance.now() - app.lastSnapAt > CONFIG.DISCONNECT_TIMEOUT * 1000) clientLostHost();
  } else {
    app.clientT.send({ t: 'ping' });
    // `hello` is the one client message that cannot be acked, because until it
    // lands the host does not know this peer exists to ack to. It is sent from
    // inside conn.on('open'), so the channel is open by definition — but "open"
    // and "delivered" are the distinction this whole defect is about.
    //
    // The lobby heartbeat is the acknowledgement: it repeats the host's PLAYER
    // LIST 3x a second, so a client missing from that list can
    // see that and say hello again. That is self-healing off a channel that
    // already exists, rather than a second ack protocol.
    if (app.mode === 'lobby' && app.lobby && Array.isArray(app.lobby.players) && app.lobby.players.length) {
      const listed = app.lobby.players.some(p => p.key === app.myKey);
      const now = performance.now();
      if (!listed && now - (app.helloAt || 0) > CONFIG.UI_ACK_RESEND_MS * 4) {
        app.helloAt = now;
        console.warn('[net] not in the host\'s player list — re-sending hello (the first one did not land)');
        const led = window.uvNet || (window.uvNet = {});
        led.helloResends = (led.helloResends || 0) + 1;
        app.clientT.send({ t: 'hello', name: currentName() });
      }
    }
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
  if (!lobby || !Array.isArray(lobby.players)) return { code: null, codePending: false, players: [] };
  return {
    code: /^[A-Z2-9]{5}$/.test(String(lobby.code)) ? lobby.code : null,
    codePending: !!lobby.codePending,
    players: lobby.players.slice(0, CONFIG.MAX_PLAYERS).map(sanitizeMember),
  };
}

function clientOnMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.t) {
    case 'uiack':
      // The host has this action. Stop resending it. An ack for a sequence
      // already forgotten is normal and means nothing went wrong: the ack
      // crossed a resend, or arrived twice.
      app.uiPending.delete(msg.useq);
      break;
    case 'lobby': {
      app.lobby = sanitizeLobby(msg.lobby);
      // REDRAW ONLY ON CHANGE. This now arrives as a 3Hz heartbeat rather than
      // only on edges, and re-rendering the lobby three times a second would
      // fight the player's own clicks on the character grid. The heartbeat's
      // job is to make the STATE self-healing, not to repaint.
      const sig = JSON.stringify(app.lobby);
      if (app.mode === 'lobby' && sig !== app._lobbySig) { app._lobbySig = sig; showLobby(app.lobby, false, app.myKey); }
      break;
    }
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
      // `msg.difficulty` is carried for display and for whatever simulates on
      // this side later; a client runs no Sim of its own at present.
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
      applySnapState(snap);   // state first: the screens no longer trust edges
      break;
    }
    case 'ev': for (const ev of msg.list) handleEvent(ev); break;
    case 'meta': if (msg.idx === app.myIdx) { app.meta = msg; updateShopMeta(app.meta); updateSheetMeta(app.meta); updateSkillsMeta(app.meta, skillTrees()); } break;
    case 'abandon': // host ended the run for everyone — back to the lobby together
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
  // Unacked actions belong to the connection that is going away. Carrying them
  // into a later session would replay a node tap from a run that has ended,
  // against sequence numbers a new host has never seen.
  app.uiSeq = 0;
  app.uiPending.clear();
  app.uiSeen.clear();
  app.helloAt = 0;
}

// ---------------- shared plumbing ----------------

// CLIENT INPUT IS RESENT UNTIL THE HOST ACKNOWLEDGES IT (defect #8). Every
// action a client takes — pick, ready, node tap, buy, stance — leaves through
// here, and it used to leave once. `ClientTransport.send` skips a channel that
// is not open, so an action taken in that window was gone with nothing to heal
// it: host state repeats on the snapshot stream and the lobby heartbeat, but
// there is no repeating channel in this direction at all.
//
// Each message carries a sequence number and stays in `app.uiPending` until
// the host acks that number. The host applies each number ONCE — see
// hostHandleUi — so resending is safe for actions that are not idempotent.
// `ready` is the one that proves the point: it toggles, so a plain repeat
// would un-ready the player who pressed it.
//
// The host's own input does not go near any of this. It is applied inline.
function sendUi(msg) {
  if (app.role === 'host') { hostHandleUi('_local', { t: 'ui', ...msg }); return; }
  if (!app.clientT) return;
  // A pending list that grows without bound is a memory leak wearing a
  // reliability costume — if this many actions are unacked the link is gone,
  // and the disconnect path is what should handle it.
  if (app.uiPending.size >= CONFIG.UI_ACK_MAX_PENDING) {
    console.warn(`[net] ${app.uiPending.size} unacknowledged client actions — dropping "${msg.kind}" rather than queueing further`);
    return;
  }
  const useq = ++app.uiSeq;
  const full = { t: 'ui', useq, ...msg };
  app.uiPending.set(useq, { msg: full, firstAt: performance.now(), lastAt: performance.now(), tries: 1 });
  // WHAT WAS SENT, IN ORDER. The ack ledger answers "did it arrive"; it cannot
  // answer "how many times did the player's one click turn into a message",
  // which is the open half of #8: a run ended with the host's high-water mark
  // equal to the client's sequence counter — everything delivered, everything
  // applied — and `ready` still false, meaning it was toggled an even number
  // of times. Counting sends is the only way to tell a double-fired handler
  // from a double-applied message.
  const led = window.uvNet || (window.uvNet = {});
  (led.uiLog ||= []).push(`${useq}:${msg.kind}`);
  if (led.uiLog.length > 40) led.uiLog.shift();
  app.clientT.send(full);
}

// Called from clientPump (30 Hz); resends on its own cadence, not the pump's.
function pumpUiAcks() {
  if (!app.clientT || !app.uiPending.size) return;
  const now = performance.now();
  for (const [useq, rec] of app.uiPending) {
    if (now - rec.firstAt > CONFIG.UI_ACK_GIVEUP_MS) {
      app.uiPending.delete(useq);
      // LOUD. The whole defect was that this case had no sound at all.
      console.warn(`[net] GAVE UP on client action "${rec.msg.kind}" (seq ${useq}) after ${rec.tries} attempts over ${Math.round(now - rec.firstAt)}ms — the host never acknowledged it`);
      const led = window.uvNet || (window.uvNet = {});
      led.uiGaveUp = (led.uiGaveUp || 0) + 1;
      continue;
    }
    if (now - rec.lastAt < CONFIG.UI_ACK_RESEND_MS) continue;
    rec.lastAt = now;
    rec.tries++;
    const led = window.uvNet || (window.uvNet = {});
    led.uiResends = (led.uiResends || 0) + 1;
    app.clientT.send(rec.msg);
  }
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

// SNAPSHOT STATE → CLIENT SCREENS. Runs on every snapshot, before the event
// pump, and is the authority for anything a client cannot play without.
//
// Events are edges: they fire once and are gone. A peer whose data channel was
// not open at that instant loses them permanently, silently — net.js now logs
// every such drop, but logging it does not bring it back. So the load-bearing
// half of what used to arrive by event is now carried by `snap.st`, which
// repeats 15 times a second and therefore heals itself on the very next frame.
//
// The events still fire, and still do their cosmetic half: banners, the floor
// announcement, roars. Losing one of those costs a player a banner. Losing the
// state cost them the game.
function applySnapState(snap) {
  const st = snap && snap.st;
  if (!st) return;

  // ---- the node map ----
  if (st.map) {
    const newFloor = !app.map || app.map.floorNum !== st.map.floorNum;
    app.map = st.map;
    app.arena = null;
    app.runMode = 'map';
    if (newFloor) { app.floorNum = st.map.floorNum; app.bossInfo = null; }
  } else if (st.arena) {
    // ---- the room, including walls that moved mid-siege ----
    app.arena = st.arena;
    app.runMode = 'arena';
  }

  // ---- pending picks: PRESENCE is the truth, not two edges ----
  //
  // Closed defect #4 was a missing `boonDone` leaving a panel open with no
  // exit, which ended the run. Deriving open/closed from state means a lost
  // close event costs nothing: the next snapshot says the offer is gone and the
  // panel goes with it. The OPEN direction still needs the event, because only
  // the event carries the picks themselves — but a lost open is a missed pick,
  // and a lost close was a dead run, so this closes the worse of the two.
  const mine = (st.pend || []).find(r => r[0] === app.myIdx);
  if (mine) {
    if (!mine[1]) closeLevelup();
    if (!mine[2]) closeTreasure();
    if (!mine[3]) closeBoon();
    if (!mine[4]) closeOpening(); else showOpeningFromPend();
    // §5.5's MAP-END SPEND STEP. Presence, like every row above — but unlike
    // the card panels this one OPENS ONCE rather than every snapshot: the tree
    // screen is interactive (slot picker, node clicks) and re-rendering it at
    // 15 Hz would eat every click. `spendSeen` is the edge; the pend row is
    // still what closes it, so a lost close costs nothing.
    if (!mine[5]) { app.spendSeen = false; }
    else if (!app.spendSeen) { app.spendSeen = true; toggleSkills(true); }
  }

  // ---- the run being over ----
  if (st.over && app.mode === 'run') {
    // The results payload only exists on the `end` event; what state can say is
    // that the run has finished, which is enough to stop a client sitting in a
    // dead world forever waiting for a screen that already came and went.
    showHud(false);
    closeAllOverlays();
    hideMapScreen();
  }
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
    case 'opening': if (ev.idx === app.myIdx) showOpening(ev); break;
    case 'skillLearned': if (ev.idx === app.myIdx) closeOpening(); break;
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
      if (p.idx === app.myIdx) { app.meta = meta; updateShopMeta(meta); updateSheetMeta(meta); updateSkillsMeta(meta, skillTrees()); }
      else if (app.hostT) {
        const member = app.party.find(m => m.idx === p.idx);
        if (member && member.key !== '_local') app.hostT.send(member.key, meta);
      }
    }
  }
  // THE HOST NEVER APPLIES `st` TO ITSELF, which is why the §5.6 panel worked
  // for clients and not for the host or for solo. A client derives its open
  // panels from `st.pend` — presence is the truth, closed defect #4 — but the
  // host drains events and metas and never reads the state block it just built.
  // So the `opening` event, pushed while the Sim is still being constructed, is
  // the host's ONLY signal, and it fires before this handler is listening.
  // Driven in a browser: the sim held `openingOffer: 2` with the point unspent
  // and no panel on screen. This is the same presence check the client does, so
  // the two are now symmetric.
  {
    const me = sim.players[app.myIdx];
    if (me && !me.gone) {
      if (me.openingOffer) showOpeningFromPend();
      else closeOpening();
      // AND §5.5's MAP-END SPEND STEP, for exactly the reason written above it.
      // This was shipped in the `st.pend` block alone and the browser suite
      // caught it inside one run: the offer was live with five points and the
      // panel never rendered in solo, because the host reads its own players
      // rather than the state block it just built. That is D-32 verbatim, on a
      // new panel, three paragraphs under a comment describing it — which is
      // why "a thing the player must see needs a browser check" is a rule and
      // not a preference (§13 rule 54).
      if (me.spendOffer) { if (!app.spendSeen) { app.spendSeen = true; toggleSkills(true); } }
      else app.spendSeen = false;
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
    // committed zones ride the view like any other world layer
    telZones: sim.telegraphZones(),
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
    // Thrones of Heaven world layer
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
      winding: e.telState === 1,   // TELEGRAPH_STATES.WINDUP — drives the wind-up pose
      domain: e.domain,
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
    // Skill-era minions and soul tokens. Built the same way on both sides — see
    // the client unpack below — so the renderer cannot tell host from client.
    minions: sim.players.flatMap(p => (p.minions || []).map(m => ({
      owner: p.idx, arch: m.arch, x: m.x, y: m.y,
      hpP: m.maxHp > 0 ? Math.max(0, m.hp / m.maxHp) : 0,
      down: !!m.down, downP: m.down ? m.downT / Math.max(0.01, m.downDur) : 0,
    }))),
    // §8.5 row 2: rendered only for a class that can read them. The list is
    // still ON THE WIRE for everyone — it is state, not a cosmetic — this is a
    // VIEW filter, so a Necromancer joining mid-fight sees the floor correctly.
    // §8.5 row 2: rendered only for a class that can read them. The list is
    // still ON THE WIRE for everyone — it is state, not a cosmetic — so this is
    // a VIEW filter and a Necromancer joining mid-fight sees the floor at once.
    tokens: readsTokens(myCharId(sim.players[app.myIdx]))
      ? sim.tokens.map(t => ({ x: t.x, y: t.y, ttlP: Math.min(1, t.ttl / CONFIG.SOUL_TOKEN_TTL) })) : [],
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
      radius: chr ? 16 * (chr.trait.hitbox || 1) : 16,   // by presence, not by trait name — see _makePlayer
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
    // Must produce the same shape as the host view above, or a summon looks
    // different depending on who is looking at it.
    minions: (s1.minions || []).map(m => ({ owner: m[0], arch: m[1], x: m[2], y: m[3], hpP: m[4],
      down: (m[5] || 0) > 0, downP: m[5] || 0 })),
    tokens: readsTokens((players.find(q => q.idx === app.myIdx) || {}).charId)
      ? (s1.tokens || []).map(t => ({ x: t[0], y: t[1], ttlP: t[2] })) : [],
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
  const radius = chr ? 16 * (chr.trait.hitbox || 1) : 16;   // by presence, not by trait name
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
    tel: app.sim.telStats,
    telZones: app.sim.telegraphZones(),
    dodges: app.sim.telDodgeLog,
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
