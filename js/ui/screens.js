// Title, lobby, results and settings screens (DOM). Pure view layer — all
// state lives in main.js / the sim; this module renders and forwards clicks.

import { CHARACTERS, CHAR_BY_ID } from '../content/characters.js';
import { PALETTE, STAT_IS_PCT } from '../config.js';
import { ITEM_BY_ID } from '../content/items.js';
import { WEAPON_BY_ID } from '../content/weapons.js';
import { TIER_NAMES } from '../config.js';
import { glossify, glossName } from './gloss.js';
import { getVolume, setVolume, sfx } from '../audio.js';
import { getTouchMode, setTouchMode } from '../touch.js';

const $ = id => document.getElementById(id);
let A = null; // actions

export function initScreens(actions) {
  A = actions;
  initSettings();
}

export function hideScreens() {
  for (const id of ['screen-title', 'screen-lobby', 'screen-results']) $(id).classList.add('hidden');
}

function playerName() {
  let n = '';
  try { n = localStorage.getItem('uv_name') || ''; } catch { /* ignore */ }
  return n;
}

export function showTitle(err = '') {
  hideScreens();
  const el = $('screen-title');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="panel">
      <h1 class="logo">UNDERVAULT</h1>
      <div class="tagline">a co-op dungeon arena roguelite · 1–8 players</div>
      <div class="row" style="gap:24px; align-items:flex-start;">
        <div class="menu-col">
          <label class="dim small">Your name</label>
          <input type="text" id="name-input" maxlength="12" style="letter-spacing:2px; text-transform:none;" value="${escapeHtml(playerName())}" placeholder="ANON">
          <button class="big primary" id="btn-host">HOST GAME</button>
          <div class="row">
            <input type="text" id="join-code" maxlength="5" placeholder="CODE" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="join">
            <button class="big" id="btn-join" style="width:auto;">JOIN</button>
          </div>
          <button id="btn-howto">How to play</button>
          <div class="err" id="title-err">${escapeHtml(err)}</div>
        </div>
        <div class="howto hidden" id="howto-box">
          <h3>Goal</h3>
          Fight room to room through a 4-floor dungeon. Beat each floor's boss, descend, and destroy the Vault Regent on floor 4. If the whole party goes down, the run is over.
          <h3>Controls</h3>
          <b>WASD / arrows</b> move · weapons attack on their own · <b>E</b> opens the shop when you're in a shop room · mouse for menus.
          <h3>Materials</h3>
          Enemies drop materials: they are both money and XP. Level-ups are banked during combat and picked when the room is clear.
          <h3>Co-op</h3>
          Host a room, send friends the code — up to 8 play together. Downed friends revive if you stand next to them for 3s. Big rooms want the host on solid wifi (see the README's host guidance).
        </div>
      </div>
    </div>`;
  $('btn-host').onclick = () => { saveName(); sfx.click(); A.host(); };
  $('btn-join').onclick = () => { saveName(); sfx.click(); tryJoin(); };
  $('join-code').onkeydown = e => { if (e.key === 'Enter') { saveName(); tryJoin(); } };
  $('btn-howto').onclick = () => { sfx.click(); $('howto-box').classList.toggle('hidden'); };
}

function tryJoin() {
  const code = $('join-code').value.trim().toUpperCase();
  if (code.length !== 5) { $('title-err').textContent = 'Room codes are 5 letters.'; return; }
  A.join(code);
}

function saveName() {
  const v = $('name-input').value.trim().slice(0, 12);
  try { localStorage.setItem('uv_name', v); } catch { /* ignore */ }
}

export function currentName() {
  const el = $('name-input');
  const v = (el ? el.value.trim() : playerName()) || 'ANON';
  return v.slice(0, 12);
}

export function setTitleError(msg) {
  const el = $('title-err');
  if (el) el.textContent = msg;
}

// ---------------- lobby ----------------

export function showLobby(lobby, isHost, myKey) {
  hideScreens();
  const el = $('screen-lobby');
  el.classList.remove('hidden');
  const me = lobby.players.find(p => p.key === myKey);
  const allReady = lobby.players.length > 0 && lobby.players.every(p => p.charId && (p.ready || p.isHost));
  const codeHtml = lobby.code
    ? `room code: <span class="room-code">${escapeHtml(lobby.code)}</span>`
    : (lobby.codePending ? `<span class="dim">registering room…</span>` : `<span class="dim">OFFLINE — solo only (couldn't reach the relay)</span>`);
  el.innerHTML = `
    <div class="panel">
      <div class="lobby-head">
        <div style="font-size:24px; letter-spacing:3px; color:var(--gold);">LOBBY</div>
        <div>${codeHtml}</div>
      </div>
      <div class="lobby-players">${lobby.players.map(p => `
        <div class="lobby-player ${p.ready || p.isHost ? 'ready' : ''}">
          <div class="dot" style="background:${p.color}"></div>
          <div>
            <div><b>${escapeHtml(p.name)}</b> ${p.isHost ? '👑' : ''} ${p.key === myKey ? '(you)' : ''}</div>
            <div class="small dim">${p.charId ? CHAR_BY_ID[p.charId].name : 'picking…'} · ${p.isHost ? 'host' : (p.ready ? 'ready' : 'not ready')}</div>
          </div>
        </div>`).join('')}
      </div>
      <div class="char-grid" id="char-grid">${CHARACTERS.map(c => {
        const takenBy = lobby.players.filter(p => p.charId === c.id).map(p => p.name);
        const mine = me && me.charId === c.id;
        return `
        <div class="char-card ${mine ? 'selected' : ''} ${takenBy.length && !mine ? 'taken' : ''}" data-char="${c.id}" title="${escapeHtml(c.desc)}">
          <svg class="cicon" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="${me ? me.color : PALETTE.players[0]}" stroke="#0b0c12" stroke-width="3"/><text x="20" y="26" text-anchor="middle" font-size="17" fill="#0b0c12" font-weight="bold">${c.sym}</text></svg>
          <div class="cname">${c.name}</div>
          <div class="ctrait">${glossify(c.desc)}</div>
          <div class="cstats">${statSummary(c.stats)}</div>
          ${takenBy.length ? `<div class="towner">✔ ${escapeHtml(takenBy.join(','))}</div>` : ''}
        </div>`;
      }).join('')}
      </div>
      <div class="row spread" style="margin-top:14px;">
        <button id="btn-leave">Leave</button>
        <div class="row">
          ${!isHost ? `<button id="btn-ready" class="${me && me.ready ? 'primary' : ''}">${me && me.ready ? 'READY ✔' : 'READY?'}</button>` : ''}
          ${isHost ? `<button id="btn-start" class="primary big" style="width:auto;" ${allReady ? '' : 'disabled'}>START RUN ▶</button>` : '<span class="dim small">waiting for host…</span>'}
        </div>
      </div>
    </div>`;
  el.querySelectorAll('.char-card').forEach(card => {
    card.onclick = () => { sfx.click(); A.pickChar(card.dataset.char); };
  });
  $('btn-leave').onclick = () => { sfx.click(); A.leave(); };
  const rb = $('btn-ready');
  if (rb) rb.onclick = () => { sfx.click(); A.toggleReady(); };
  const sb = $('btn-start');
  if (sb) sb.onclick = () => { sfx.click(); A.startGame(); };
}

function statSummary(stats) {
  const parts = [];
  for (const [k, v] of Object.entries(stats)) {
    parts.push(`${v > 0 ? '+' : ''}${v}${STAT_IS_PCT[k] ? '%' : ''} ${glossName(k)}`);
  }
  return parts.slice(0, 3).join(' · ');
}

// ---------------- results ----------------

export function showResults(result, myIdx) {
  hideScreens();
  const el = $('screen-results');
  el.classList.remove('hidden');
  const title = result.win ? '<span class="result-title-win">VAULT CONQUERED</span>' : '<span class="result-title-loss">THE PARTY HAS FALLEN</span>';
  el.innerHTML = `
    <div class="panel">
      <h2 class="rt">${title}</h2>
      <div style="text-align:center;" class="dim">${result.win ? 'The Vault Regent lies in pieces.' : `Wiped on floor ${result.floor}.`}</div>
      <div class="results-grid">${result.players.map(p => `
        <div class="result-card" style="border-top:4px solid ${p.color}">
          <h4>${escapeHtml(p.name)} ${p.idx === myIdx ? '(you)' : ''} — ${CHAR_BY_ID[p.charId] ? CHAR_BY_ID[p.charId].name : ''} ${p.gone ? '(left)' : ''}</h4>
          <div class="stat"><span>Damage dealt</span><b>${p.damage.toLocaleString()}</b></div>
          <div class="stat"><span>Kills</span><b>${p.kills}</b></div>
          <div class="stat"><span>Level</span><b>${p.level}</b></div>
          <div class="stat"><span>Materials gathered</span><b>${p.mats}</b></div>
          <div class="items-mini"><b>Build:</b> ${p.weapons.map(w => `${WEAPON_BY_ID[w.id].name} ${TIER_NAMES[w.tier - 1]}`).join(', ') || '(no weapons)'}<br>
          <b>Items (${p.items.length}):</b> ${summarizeItems(p.items)}</div>
        </div>`).join('')}
      </div>
      <div class="row spread">
        <div class="seed-line">run seed: <b>${result.seed >>> 0}</b></div>
        <button class="primary" id="btn-title">Return to Title</button>
      </div>
    </div>`;
  $('btn-title').onclick = () => { sfx.click(); A.leave(); };
}

function summarizeItems(ids) {
  const count = new Map();
  for (const id of ids) count.set(id, (count.get(id) || 0) + 1);
  const parts = [];
  for (const [id, n] of count) {
    const it = ITEM_BY_ID[id];
    if (it) parts.push(n > 1 ? `${it.name} ×${n}` : it.name);
  }
  return parts.length ? parts.join(', ') : 'none';
}

// ---------------- settings ----------------

let shakeEnabled = true;
export function isShakeEnabled() { return shakeEnabled; }

function initSettings() {
  try { shakeEnabled = localStorage.getItem('uv_shake') !== '0'; } catch { /* ignore */ }
  const btn = $('settings-btn');
  const panel = $('settings-panel');
  btn.classList.remove('hidden');
  btn.onclick = () => {
    if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    const tm = getTouchMode();
    panel.innerHTML = `
      <label>SFX volume <input type="range" id="set-vol" min="0" max="100" value="${Math.round(getVolume() * 100)}"></label>
      <label><input type="checkbox" id="set-shake" ${shakeEnabled ? 'checked' : ''}> Screen shake</label>
      <label>Touch controls
        <select id="set-touch" style="width:100%; font:inherit; padding:6px; background:#12141f; color:var(--ink); border:2px solid var(--line); border-radius:6px;">
          <option value="auto" ${tm === 'auto' ? 'selected' : ''}>Auto (detect)</option>
          <option value="on" ${tm === 'on' ? 'selected' : ''}>On</option>
          <option value="off" ${tm === 'off' ? 'selected' : ''}>Off</option>
        </select>
      </label>
      <button id="set-close" style="width:100%;">Close</button>`;
    panel.querySelector('#set-vol').oninput = e => { setVolume(e.target.value / 100); sfx.click(); };
    panel.querySelector('#set-shake').onchange = e => {
      shakeEnabled = e.target.checked;
      try { localStorage.setItem('uv_shake', shakeEnabled ? '1' : '0'); } catch { /* ignore */ }
      if (window.uvRenderer) window.uvRenderer.shakeEnabled = shakeEnabled;
    };
    panel.querySelector('#set-touch').onchange = e => { setTouchMode(e.target.value); sfx.click(); };
    panel.querySelector('#set-close').onclick = () => panel.classList.add('hidden');
  };
}

export function setNetStatus(text) {
  const el = $('net-status');
  if (!text) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.textContent = text;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
