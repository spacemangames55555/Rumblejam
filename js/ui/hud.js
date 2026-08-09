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
  $('skills-btn').classList.toggle('hidden', !on);
  if (!on) {
    $('hud-players').innerHTML = '';
    $('hud-toasts').innerHTML = '';
    $('leave-confirm').classList.add('hidden');
    $('interact-btn').classList.add('hidden');
  }
}

// meta: my private meta; view: interpolated/live view; ctx: {floorNum, layout, visited, curRoom, boss}
export function updateHud(meta, view, hctx) {
  // party bars — 5+ players compact into a two-column strip (own row stays
  // full width and detailed; allies condense to name + bar)
  const wrap = $('hud-players');
  const present = (view.players || []).filter(p => !p.gone);
  const crowd = present.length >= 5;
  wrap.classList.toggle('crowd', crowd);
  const rows = [];
  for (const p of present) {
    const mine = p.idx === view.myIdx;
    const chr = CHAR_BY_ID[p.charId];
    if (crowd && !mine) {
      rows.push(`
      <div class="php mini ${p.downed ? 'downed' : ''}" style="border-left:4px solid ${p.color};">
        <div class="nm"><span><b>${escapeHtml(p.name)}</b></span>
        <span>${p.downed ? `<span class="status">DOWN${p.reviveP > 0 ? ' ' + Math.round(p.reviveP * 100) + '%' : ''}</span>` : `${p.hp}${p.shield > 0 ? '+' + p.shield : ''}`}</span></div>
        <div class="bar"><i style="width:${Math.round(100 * p.hp / Math.max(1, p.maxHp))}%"></i></div>
      </div>`);
      continue;
    }
    rows.push(`
      <div class="php ${p.downed ? 'downed' : ''} ${mine && crowd ? 'own-row' : ''}" style="border-left:4px solid ${p.color}; ${mine || crowd ? '' : 'width:190px; opacity:.92;'}">
        <div class="nm"><span><b>${escapeHtml(p.name)}</b> <span class="dim">${chr ? chr.name : ''}</span></span>
        <span>${p.downed ? `<span class="status">DOWN ${p.reviveP > 0 ? Math.round(p.reviveP * 100) + '%' : ''}</span>` : `${p.hp}/${p.maxHp}${p.shield > 0 ? ' +' + p.shield + '🛡' : ''}`}</span></div>
        <div class="bar"><i style="width:${Math.round(100 * p.hp / Math.max(1, p.maxHp))}%"></i></div>
        ${mine && meta ? `<div class="xpbar"><i style="width:${Math.round(100 * meta.xp / meta.xpNext)}%"></i></div>` : ''}
        ${mine && p.meter >= 0 ? `<div class="meterbar ${p.meter >= 1 ? 'full' : ''}"><i style="width:${Math.round(100 * Math.min(1, p.meter))}%"></i></div>` : ''}
        ${mine ? tohBadge(p) : ''}
      </div>`);
  }
  wrap.innerHTML = rows.join('');
  // top: floor & arena
  const kindName = ({ combat: 'Skirmish', elite: 'Champion Hunt', siege: 'SIEGE' })[hctx.kind] || '';
  let top = `FLOOR ${hctx.floorNum} / 4${hctx.arenaName ? ` — ${escapeHtml(hctx.arenaName)}` : ''}${kindName ? ` · ${kindName}` : ''}`;
  if (hctx.boss) {
    top += ` — <b style="color:var(--danger)">${escapeHtml(hctx.boss.name)}</b> ${bossBar(hctx.boss)}`;
  }
  $('hud-floor').innerHTML = top;
  $('hud-materials').innerHTML = meta ? `◆ ${meta.materials} <span class="dim" style="font-size:13px">· lvl ${meta.level}${meta.banked > 0 ? ` · <b style="color:var(--xp)">+${meta.banked} level-up${meta.banked > 1 ? 's' : ''} banked</b>` : ''}</span>` : '';
  // the enemy counter: "incoming" while the spawn budget flows, then the exact
  // number alive — the switch is the sweep signal (leave stragglers, run for money)
  const ec = $('enemy-counter');
  const looting = view.loot !== null && view.loot !== undefined;
  // ec is the authoritative count — the enemy list may be interest-culled
  const alive = view.ec !== undefined && view.ec !== null ? view.ec : (view.enemies ? view.enemies.length : 0);
  if (view.mode === 'arena' && (view.inc || looting || alive)) {
    ec.classList.remove('hidden');
    const n = alive;
    if (looting) {
      ec.innerHTML = `<b class="ec-loot">◆ sweep! ${Math.ceil(view.loot)}s</b>`;
    } else if (view.inc) {
      ec.innerHTML = `<span class="ec-inc">〰 incoming</span><span class="ec-n">${n}</span>`;
    } else {
      ec.innerHTML = `<b class="ec-n exact">⚔ ${n}</b>`;
    }
  } else ec.classList.add('hidden');
  // objective banner: what this level actually wants from you, plus a bar.
  // Same markup on host and client — it reads from the synced objective blob.
  const ob = $('objective-hud');
  if (view.mode === 'arena' && view.obj) {
    const o = view.obj;
    ob.classList.remove('hidden');
    const pct = Math.round(100 * Math.max(0, Math.min(1, o.prog || 0)));
    ob.innerHTML = `<div class="obj-line"><b>${escapeHtml(o.label || '')}</b>
        <span class="obj-text">${escapeHtml(o.text || '')}</span></div>
      <div class="obj-bar"><i style="width:${pct}%"></i></div>
      ${o.sub ? `<div class="obj-sub">${escapeHtml(o.sub)}</div>` : ''}`;
  } else ob.classList.add('hidden');
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
  drawRadar(view);
}

function bossBar(boss) {
  const pct = Math.round(100 * boss.hp / boss.max);
  return `<span style="display:inline-block; width:140px; height:10px; background:#26192a; border-radius:3px; vertical-align:middle; margin-left:6px;"><span style="display:block; height:100%; width:${pct}%; background:var(--danger); border-radius:3px;"></span></span>`;
}

// Thrones of Heaven states that are a MODE, not a meter: the Samurai's stance
// and the Hunter's pack mode change how you play and have to be readable at a
// glance, so they get a word rather than a bar.
const STANCES = ['IRON', 'PRECISION', 'FLOW'];
const PACK = ['', 'ALPHA', 'MARKSMAN'];
function tohBadge(p) {
  if (p.trait === 'three_stances') return `<div class="toh-badge s${p.ts}">${STANCES[p.ts] || ''}</div>`;
  if (p.trait === 'pack_tactics' && p.ts) return `<div class="toh-badge s${p.ts}">${PACK[p.ts]}</div>`;
  if (p.trait === 'contract' && p.ts) return `<div class="toh-badge s1">${p.ts} CLOSED</div>`;
  if (p.trait === 'crystal_infusion' && p.ts) return `<div class="toh-badge s0">${p.ts % 100} INFUSED${p.ts >= 100 ? ' \u2726' : ''}</div>`;
  return '';
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

// ---------------- arena radar ----------------
// A simple radar of the whole arena: allies (their colors), elites (purple),
// the boss and pylon, the extraction portal, and the hold-circle objective.
// In map phase the canvas clears — the node map screen is the navigation.

function drawRadar(view) {
  const cv = $('minimap');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (!view || view.mode === 'map' || !view.aw) return;
  const pad = 6;
  const sc = Math.min((cv.width - pad * 2) / view.aw, (cv.height - pad * 2) / view.ah);
  const w = view.aw * sc, h = view.ah * sc;
  const ox = (cv.width - w) / 2, oy = (cv.height - h) / 2;
  ctx.fillStyle = '#12141fdd';
  ctx.fillRect(ox, oy, w, h);
  ctx.strokeStyle = '#454b6e';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ox, oy, w, h);
  const dot = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(ox + x * sc, oy + y * sc, r, 0, Math.PI * 2); ctx.fill();
  };
  for (const o of view.obstacles || []) {
    ctx.fillStyle = '#2b2f45';
    ctx.fillRect(ox + o[0] * sc, oy + o[1] * sc, Math.max(1, o[2] * sc), Math.max(1, o[3] * sc));
  }
  if (view.hold) {
    ctx.strokeStyle = view.hold[3] ? '#ffd45e' : '#ff5d6c';
    ctx.beginPath(); ctx.arc(ox + view.hold[0] * sc, oy + view.hold[1] * sc, Math.max(3, view.hold[2] * sc), 0, Math.PI * 2); ctx.stroke();
  }
  // objective markers on the radar — on an elongated map (Breach) the radar
  // is the only way to read where the collapse and the next door are
  const ob = view.obj;
  if (ob) {
    if (ob.wall !== undefined) {                       // the collapse, filled in
      ctx.fillStyle = 'rgba(255,93,108,0.35)';
      ctx.fillRect(ox, oy, Math.max(0, ob.wall * sc), h);
      ctx.strokeStyle = '#ff5d6c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox + ob.wall * sc, oy); ctx.lineTo(ox + ob.wall * sc, oy + h); ctx.stroke();
    }
    for (const dx of ob.doors || []) {                 // sealed doors ahead
      ctx.strokeStyle = '#ffab4f';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(ox + dx * sc, oy); ctx.lineTo(ox + dx * sc, oy + h); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (ob.gate) dot(ob.gate[0], ob.gate[1], 4, PALETTE.doorOpen);
    if (ob.zone) {
      ctx.strokeStyle = '#5ee0a8'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ox + ob.zone[0] * sc, oy + ob.zone[1] * sc, Math.max(3, ob.zone[2] * sc), 0, Math.PI * 2); ctx.stroke();
    }
    if (ob.circle) {
      ctx.strokeStyle = '#5ea8ff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ox + ob.circle[0] * sc, oy + ob.circle[1] * sc, Math.max(3, ob.circle[2] * sc), 0, Math.PI * 2); ctx.stroke();
    }
    if (ob.altar) dot(ob.altar[0], ob.altar[1], 3.5, '#ffd45e');
    for (const [rx, ry, carrier] of ob.relics || []) if (carrier < 0) dot(rx, ry, 2.5, '#ffd45e');
    for (const [nx, ny] of ob.nests || []) dot(nx, ny, 3, '#c98b4f');
    if (ob.drill) dot(ob.drill[0], ob.drill[1], 4, '#c98b4f');
    if (ob.mark) dot(ob.mark[0], ob.mark[1], 4, '#ff7ad9');
  }
  if (view.hatch) dot(view.hatch[0], view.hatch[1], 4, PALETTE.doorOpen);
  for (const e of view.enemies || []) {
    if (e.boss) dot(e.x, e.y, 4.5, '#ff5d6c');
    else if (e.pylon) dot(e.x, e.y, 3.5, '#c05eff');
    else if (e.elite) dot(e.x, e.y, 3, PALETTE.elite);
  }
  for (const p of view.players || []) {
    if (p.gone) continue;
    dot(p.x, p.y, p.idx === view.myIdx ? 3.5 : 2.8, p.downed ? '#ff5d6c' : p.color);
    if (p.downed) { ctx.strokeStyle = '#ff5d6c'; ctx.beginPath(); ctx.arc(ox + p.x * sc, oy + p.y * sc, 6, 0, Math.PI * 2); ctx.stroke(); }
  }
}
