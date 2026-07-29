// In-run HUD: ally HP bars, materials/XP, weapon slots, minimap, toasts,
// center banners, boss bar. DOM + one small minimap canvas.

import { CHAR_BY_ID } from '../content/characters.js';
import { WEAPON_BY_ID } from '../content/weapons.js';
import { TIER_NAMES, PALETTE } from '../config.js';
import { escapeHtml } from './screens.js';

const $ = id => document.getElementById(id);
let bannerTimer = null;

export function showHud(on) {
  $('hud').classList.toggle('hidden', !on);
  $('leave-btn').classList.toggle('hidden', !on);
  $('sheet-btn').classList.toggle('hidden', !on);
  if (!on) {
    $('hud-players').innerHTML = '';
    $('hud-toasts').innerHTML = '';
    $('leave-confirm').classList.add('hidden');
    $('interact-btn').classList.add('hidden');
  }
}

// meta: my private meta; view: interpolated/live view; ctx: {floorNum, layout, visited, curRoom, boss}
export function updateHud(meta, view, hctx) {
  // party bars
  const wrap = $('hud-players');
  const rows = [];
  for (const p of view.players || []) {
    if (p.gone) continue;
    const mine = p.idx === view.myIdx;
    const chr = CHAR_BY_ID[p.charId];
    rows.push(`
      <div class="php ${p.downed ? 'downed' : ''}" style="border-left:4px solid ${p.color}; ${mine ? '' : 'width:190px; opacity:.92;'}">
        <div class="nm"><span><b>${escapeHtml(p.name)}</b> <span class="dim">${chr ? chr.name : ''}</span></span>
        <span>${p.downed ? `<span class="status">DOWN ${p.reviveP > 0 ? Math.round(p.reviveP * 100) + '%' : ''}</span>` : `${p.hp}/${p.maxHp}${p.shield > 0 ? ' +' + p.shield + '🛡' : ''}`}</span></div>
        <div class="bar"><i style="width:${Math.round(100 * p.hp / Math.max(1, p.maxHp))}%"></i></div>
        ${mine && meta ? `<div class="xpbar"><i style="width:${Math.round(100 * meta.xp / meta.xpNext)}%"></i></div>` : ''}
      </div>`);
  }
  wrap.innerHTML = rows.join('');
  // top: floor & materials
  const room = hctx.curRoomDef;
  const roomName = room ? ({ start: 'Vault Entry', combat: 'Chamber', shop: 'Trader Alcove', treasure: 'Reliquary', elite: 'Champion Den', boss: 'Sanctum' })[room.kind] : '';
  const hzd = room && room.hazard ? (room.hazard === 'spikes' ? ' · spikes!' : ' · lava!') : '';
  let top = `FLOOR ${hctx.floorNum} / 4 — ${roomName}${hzd}`;
  if (hctx.boss) {
    top += ` — <b style="color:var(--danger)">${escapeHtml(hctx.boss.name)}</b> ${bossBar(hctx.boss)}`;
  }
  $('hud-floor').innerHTML = top;
  $('hud-materials').innerHTML = meta ? `◆ ${meta.materials} <span class="dim" style="font-size:13px">· lvl ${meta.level}${meta.banked > 0 ? ` · <b style="color:var(--xp)">+${meta.banked} level-up${meta.banked > 1 ? 's' : ''} banked</b>` : ''}</span>` : '';
  // weapons
  if (meta) {
    const slots = [];
    for (let i = 0; i < meta.weaponSlots; i++) {
      const w = meta.weapons[i];
      if (w) {
        const def = WEAPON_BY_ID[w.id];
        slots.push(`<div class="wslot" title="${def.name} ${TIER_NAMES[w.tier - 1]}"><span class="wsym" style="color:${def.color}">${def.sym}</span><span class="wtier">${TIER_NAMES[w.tier - 1]}</span></div>`);
      } else slots.push('<div class="wslot dim">·</div>');
    }
    $('hud-weapons').innerHTML = slots.join('');
  }
  drawMinimap(hctx);
}

function bossBar(boss) {
  const pct = Math.round(100 * boss.hp / boss.max);
  return `<span style="display:inline-block; width:140px; height:10px; background:#26192a; border-radius:3px; vertical-align:middle; margin-left:6px;"><span style="display:block; height:100%; width:${pct}%; background:var(--danger); border-radius:3px;"></span></span>`;
}

export function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  $('hud-toasts').appendChild(el);
  setTimeout(() => el.remove(), 3800);
  while ($('hud-toasts').children.length > 6) $('hud-toasts').firstChild.remove();
}

export function banner(text, sub = '', dur = 2200) {
  const el = $('hud-banner');
  el.innerHTML = `${escapeHtml(text)}${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ''}`;
  el.classList.remove('hidden');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.add('hidden'), dur);
}

// ---------------- minimap ----------------

const KIND_ICON = { shop: '$', treasure: '★', elite: '!', boss: '☠', start: '' };

function drawMinimap(hctx) {
  const cv = $('minimap');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const layout = hctx.layout;
  if (!layout) return;
  const cell = 24, gap = 4;
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  const known = layout.rooms.filter(r => hctx.visited.has(r.id) || isAdjacentToVisited(r, layout, hctx.visited));
  for (const r of known) {
    minx = Math.min(minx, r.gx); maxx = Math.max(maxx, r.gx);
    miny = Math.min(miny, r.gy); maxy = Math.max(maxy, r.gy);
  }
  if (!known.length) return;
  const w = (maxx - minx + 1) * (cell + gap), h = (maxy - miny + 1) * (cell + gap);
  const ox = (cv.width - w) / 2, oy = (cv.height - h) / 2;
  for (const r of known) {
    const x = ox + (r.gx - minx) * (cell + gap), y = oy + (r.gy - miny) * (cell + gap);
    const visited = hctx.visited.has(r.id);
    ctx.fillStyle = r.id === hctx.curRoom ? '#7a5cff' : visited ? '#3a3f5c' : '#22253a';
    ctx.fillRect(x, y, cell, cell);
    if (r.id === hctx.curRoom) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2); }
    const icon = KIND_ICON[r.kind];
    if (icon && (visited || true)) {
      ctx.fillStyle = r.kind === 'boss' ? '#ff5d6c' : PALETTE.material;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, x + cell / 2, y + cell / 2 + 1);
    }
  }
}

function isAdjacentToVisited(r, layout, visited) {
  return Object.values(r.doors).some(id => visited.has(id));
}
