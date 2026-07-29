// Per-player overlays: shop, level-up, treasure. These never pause the sim;
// each player interacts at their own pace (movement keys still work).

import { ITEM_BY_ID } from '../content/items.js';
import { WEAPON_BY_ID, WEAPON_CLASS_NAMES } from '../content/weapons.js';
import { CHAR_BY_ID } from '../content/characters.js';
import { STATS, STAT_NAME, STAT_IS_PCT, TIER_MULT, TIER_NAMES, weaponBasePrice, sellValue } from '../config.js';
import { escapeHtml } from './screens.js';
import { sfx } from '../audio.js';

const $ = id => document.getElementById(id);
let A = null;

export function initOverlays(actions) { A = actions; }

export function closeAllOverlays() {
  for (const id of ['overlay-shop', 'overlay-levelup', 'overlay-treasure', 'overlay-sheet']) $(id).classList.add('hidden');
}

// ---------------- tooltips ----------------

export function statLines(stats) {
  if (!stats) return '';
  return Object.entries(stats).map(([k, v]) => {
    const cls = v >= 0 ? 'stat-line' : 'stat-line stat-neg';
    return `<span class="${cls}">${v > 0 ? '+' : ''}${v}${STAT_IS_PCT[k] ? '%' : ''} ${STAT_NAME[k] || k}</span>`;
  }).join('');
}

function itemCardHtml(it, opts = {}) {
  return `
    <div class="oname">${escapeHtml(it.name)}</div>
    <div class="orarity">${it.rarity}${opts.owned ? ` · owned ×${opts.owned}` : ''}</div>
    <div class="odesc">${statLines(it.stats)}${it.desc ? `<div style="margin-top:4px;">${escapeHtml(it.desc)}</div>` : ''}</div>`;
}

function weaponCardHtml(def, tier, meta) {
  const dmg = Math.round(def.dmg * TIER_MULT[tier - 1]);
  const owned = meta ? meta.weapons.filter(w => w.id === def.id && w.tier === tier).length : 0;
  const combines = owned > 0 && tier < 4;
  const bits = [];
  if (def.summon) {
    bits.push(`turret dmg ${Math.round(def.summon.dmg * TIER_MULT[tier - 1])} · every ${def.summon.cd}s · range ${def.summon.range}`);
    bits.push(`structure HP ${Math.round(def.summon.hp * TIER_MULT[tier - 1])}`);
  } else {
    bits.push(`dmg ${dmg} · cooldown ${def.cd}s · range ${def.range}`);
  }
  if (def.count) bits.push(`${def.count} projectiles`);
  if (def.pierce) bits.push(`pierce ${def.pierce}`);
  if (def.aoe) bits.push(`blast radius ${def.aoe}`);
  if (def.burn) bits.push(`burns ${def.burn.dps}/s for ${def.burn.dur}s`);
  if (def.slow) bits.push(`slows ${Math.round((1 - def.slow.mult) * 100)}%`);
  if (def.chainHit) bits.push(`chains to ${def.chainHit.count} at ${Math.round(def.chainHit.factor * 100)}%`);
  if (def.critBonus) bits.push(`+${def.critBonus}% crit`);
  return `
    <div class="oname">${def.sym} ${escapeHtml(def.name)} <span style="color:var(--gold)">${TIER_NAMES[tier - 1]}</span></div>
    <div class="orarity">${WEAPON_CLASS_NAMES[def.cls]}</div>
    <div class="odesc">${bits.join('<br>')}<br><span class="dim">scales with: ${def.tags.map(t => STAT_NAME[t] || t).join(', ')}</span>
    ${combines ? '<br><span class="wpn-note">▲ you own a copy — buy it and combine the pair below (free)</span>' : ''}</div>`;
}

// ---------------- shop ----------------

let shopState = null;
let lastShopMeta = null;
let armedSell = null;   // 'w<slot>' | 'i<itemId>' — two-step sell confirmation
let combineSel = null;  // selected weapon slot awaiting its match

let shopDigest = '';
function shopMetaDigest(meta) {
  return meta ? JSON.stringify([meta.materials, meta.weapons, meta.items, meta.weaponSlots]) : '';
}

export function showShop(ev, meta) {
  shopState = ev;
  armedSell = null;
  combineSel = null;
  shopDigest = shopMetaDigest(meta);
  renderShop(meta);
  $('overlay-shop').classList.remove('hidden');
}

export function isShopOpen() { return !$('overlay-shop').classList.contains('hidden'); }

// re-render only when displayed data changed — metas arrive ~4×/s and a
// rebuild resets panel scroll (miserable on phones, races synthetic taps)
export function updateShopMeta(meta) {
  if (!isShopOpen() || !shopState) return;
  const d = shopMetaDigest(meta);
  if (d === shopDigest) return;
  shopDigest = d;
  renderShop(meta);
}

// ---- owned-build section (arsenal + items with combine/sell) ----

function ownedHtml(meta, floor) {
  if (!meta) return '';
  const full = meta.weapons.length >= meta.weaponSlots;
  const pairExists = meta.weapons.some((w, i) => w.tier < 4
    && meta.weapons.some((v, j) => j !== i && v.id === w.id && v.tier === w.tier));
  const sel = combineSel !== null ? meta.weapons[combineSel] : null;
  const wchips = meta.weapons.map((w, i) => {
    const def = WEAPON_BY_ID[w.id];
    const val = sellValue(weaponBasePrice(def, w.tier), floor);
    const isSel = i === combineSel;
    const isMatch = sel && !isSel && w.id === sel.id && w.tier === sel.tier && w.tier < 4;
    const armKey = `w${i}`;
    return `
      <div class="wchip ${isSel ? 'selected' : ''} ${isMatch ? 'combinable' : ''}" data-wchip="${i}" data-keep="1">
        <span class="wsym" style="color:${def.color}">${def.sym}</span>
        <span><b>${escapeHtml(def.name)}</b> <span style="color:var(--gold)">${TIER_NAMES[w.tier - 1]}</span>
        <span class="dim small">· ${def.tags.map(t => STAT_NAME[t] || t).join(', ')}</span></span>
        ${isMatch ? `<button class="chip-btn combine-btn" data-combine="${i}" data-keep="1">⇑ COMBINE</button>` : ''}
        <button class="chip-btn sell-btn ${armedSell === armKey ? 'armed' : ''}" data-sellw="${i}" data-arm="${armKey}" data-keep="1">
          ${armedSell === armKey ? `⟡${val} — tap again` : `Sell ⟡${val}`}</button>
      </div>`;
  }).join('');
  const counts = new Map();
  for (const id of meta.items) counts.set(id, (counts.get(id) || 0) + 1);
  const ichips = [...counts.entries()].map(([id, n]) => {
    const it = ITEM_BY_ID[id];
    if (!it) return '';
    const val = sellValue(it.price, floor);
    const armKey = `i${id}`;
    return `
      <div class="wchip r-${it.rarity}" data-keep="1">
        <span><b>${escapeHtml(it.name)}</b>${n > 1 ? ` <span class="dim">×${n}</span>` : ''}</span>
        <button class="chip-btn sell-btn ${armedSell === armKey ? 'armed' : ''}" data-selli="${escapeHtml(id)}" data-arm="${armKey}" data-keep="1">
          ${armedSell === armKey ? `⟡${val} — tap again` : `Sell ⟡${val}`}</button>
      </div>`;
  }).join('');
  return `
    <div class="owned-head">Your weapons ${meta.weapons.length}/${meta.weaponSlots}
      ${full ? '<span style="color:var(--danger)"> — sell or combine to make room</span>' : ''}
      ${pairExists && combineSel === null ? '<span class="dim small"> · you own a pair — tap one, then tap its match to combine (free)</span>' : ''}
      ${combineSel !== null ? '<span style="color:var(--xp)"> · now tap the highlighted match to combine</span>' : ''}
    </div>
    <div class="owned-row">${wchips || '<span class="dim small">no weapons</span>'}</div>
    <div class="owned-head">Your items (${meta.items.length})</div>
    <div class="owned-row">${ichips || '<span class="dim small">no items yet</span>'}</div>`;
}

function wireOwned(el, meta) {
  el.querySelectorAll('[data-wchip]').forEach(chip => {
    chip.addEventListener('click', e => {
      if (e.target.closest('button')) return; // buttons handle themselves
      const i = parseInt(chip.dataset.wchip, 10);
      const w = meta.weapons[i];
      const hasMatch = w && w.tier < 4 && meta.weapons.some((v, j) => j !== i && v.id === w.id && v.tier === w.tier);
      combineSel = (combineSel === i || !hasMatch) ? null : i;
      armedSell = null;
      sfx.click();
      renderShop(meta);
    });
  });
  el.querySelectorAll('[data-combine]').forEach(btn => {
    btn.addEventListener('click', () => {
      const j = parseInt(btn.dataset.combine, 10);
      const w = meta.weapons[combineSel];
      if (combineSel === null || !w) return;
      A.combine(combineSel, j, w.id, w.tier);
      combineSel = null;
      armedSell = null;
    });
  });
  el.querySelectorAll('[data-sellw]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.sellw, 10);
      const key = `w${i}`;
      if (armedSell === key) {
        const w = meta.weapons[i];
        if (w) A.sellWeapon(i, w.id, w.tier);
        armedSell = null;
      } else {
        armedSell = key;
        combineSel = null;
        sfx.click();
        renderShop(meta);
      }
    });
  });
  el.querySelectorAll('[data-selli]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.selli;
      const key = `i${id}`;
      if (armedSell === key) {
        A.sellItem(id);
        armedSell = null;
      } else {
        armedSell = key;
        combineSel = null;
        sfx.click();
        renderShop(meta);
      }
    });
  });
  // tapping anywhere that isn't a build-management control disarms/deselects
  // (assignment, not addEventListener — renderShop runs often and must not stack listeners)
  el.onclick = e => {
    if (e.target.closest('[data-keep]')) return;
    if (armedSell !== null || combineSel !== null) {
      armedSell = null;
      combineSel = null;
      renderShop(meta);
    }
  };
}

function renderShop(meta) {
  const ev = shopState;
  const el = $('overlay-shop');
  lastShopMeta = meta;
  const mats = meta ? meta.materials : 0;
  el.innerHTML = `
    <div class="panel">
      <div class="row spread">
        <div>
          <div class="ov-title">TRADER</div>
          <div class="ov-sub">your stock — others shop their own · you have <b style="color:var(--gold)">◆ ${mats}</b></div>
        </div>
        <button id="shop-close">Close (walk away)</button>
      </div>
      <div class="offer-row">${ev.stock.map((s, i) => {
        if (!s) return '';
        const data = s.kind === 'item' ? ITEM_BY_ID[s.id] : WEAPON_BY_ID[s.id];
        if (!data) return '';
        const rarity = s.kind === 'item' ? data.rarity : ['common', 'uncommon', 'rare', 'legendary'][s.tier - 1];
        const afford = mats >= s.price;
        const ownedCount = s.kind === 'item' && meta ? meta.items.filter(id => id === s.id).length : 0;
        return `
        <div class="offer-card r-${rarity} ${s.sold ? 'sold' : ''} ${afford ? '' : 'cantafford'} ${s.locked ? 'locked' : ''}" data-slot="${i}">
          <button class="lockbtn" data-lock="${i}">${s.locked ? '🔒' : '🔓'}</button>
          ${s.kind === 'item' ? itemCardHtml(data, { owned: ownedCount }) : weaponCardHtml(data, s.tier, meta)}
          <div class="oprice">${s.sold ? 'SOLD' : `◆ ${s.price}`}</div>
        </div>`;
      }).join('')}</div>
      ${ownedHtml(meta, ev.floor || 1)}
      <div class="shop-foot">
        <div class="row">
          <button id="shop-reroll">Reroll ◆ ${ev.rerollCost}</button>
          <button id="shop-sheet" data-keep="1">☰ Character</button>
        </div>
        <span class="dim small">${ev.weaponsOnly ? 'This trader only deals in weapons for you. · ' : ''}lock 🔒 keeps an offer through rerolls and into the next shop</span>
      </div>
    </div>`;
  el.querySelectorAll('.offer-card').forEach(card => {
    card.onclick = e => {
      if (e.target.dataset.lock !== undefined) return;
      A.buy(parseInt(card.dataset.slot, 10));
    };
  });
  el.querySelectorAll('.lockbtn').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); sfx.click(); A.lock(parseInt(btn.dataset.lock, 10)); };
  });
  el.querySelector('#shop-reroll').onclick = () => A.reroll();
  el.querySelector('#shop-sheet').onclick = () => { sfx.click(); A.openSheet(); };
  el.querySelector('#shop-close').onclick = () => { sfx.click(); closeShop(); };
  if (meta) wireOwned(el, meta);
}

export function closeShop() {
  $('overlay-shop').classList.add('hidden');
  shopState = null;
  A.closeShop();
}

// ---------------- level up ----------------

export function showLevelup(ev) {
  const el = $('overlay-levelup');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="panel" style="min-width:min(92vw,760px);">
      <div class="ov-title">LEVEL UP!</div>
      <div class="ov-sub">choose a boost${ev.banked > 1 ? ` — ${ev.banked} banked` : ''}</div>
      <div class="offer-row">${ev.picks.map(p => `
        <div class="offer-card r-${p.rarity}" data-id="${p.id}">
          <div class="oname">+${p.amount}${STAT_IS_PCT[p.stat] ? '%' : ''} ${STAT_NAME[p.stat]}</div>
          <div class="orarity">${p.rarity === 'common' ? 'small' : p.rarity === 'uncommon' ? 'medium' : 'large'}</div>
        </div>`).join('')}</div>
    </div>`;
  el.querySelectorAll('.offer-card').forEach(card => {
    card.onclick = () => { A.pickLevelup(card.dataset.id); };
  });
}

export function closeLevelup() { $('overlay-levelup').classList.add('hidden'); }

// ---------------- treasure / elite reward ----------------

export function showTreasure(ev) {
  const el = $('overlay-treasure');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="panel" style="min-width:min(92vw,760px);">
      <div class="ov-title">${ev.kind === 'elite' ? 'CHAMPION SPOILS' : 'RELIQUARY'}</div>
      <div class="ov-sub">take one — it's free</div>
      <div class="offer-row">${ev.picks.map(id => {
        const it = ITEM_BY_ID[id];
        return `<div class="offer-card r-${it.rarity}" data-id="${id}">${itemCardHtml(it)}</div>`;
      }).join('')}
      </div>
      <div style="margin-top:10px; text-align:right;"><button id="treasure-skip">Leave it</button></div>
    </div>`;
  el.querySelectorAll('.offer-card').forEach(card => {
    card.onclick = () => { A.pickTreasure(card.dataset.id); };
  });
  el.querySelector('#treasure-skip').onclick = () => { sfx.click(); A.pickTreasure(null); };
}

export function closeTreasure() { $('overlay-treasure').classList.add('hidden'); }

// ---------------- character sheet ----------------
// Live view of one player's build: all sixteen stats (base shown where it
// differs), weapons with tier/tags, items stacked by rarity. Per-player DOM —
// never blocks anyone else's game.

let sheetCharId = null;
let sheetDigest = '';
function sheetMetaDigest(meta) {
  return meta ? JSON.stringify([meta.stats, meta.weapons, meta.items, meta.level, meta.materials]) : '';
}

export function showSheet(meta, charId) {
  sheetCharId = charId;
  sheetDigest = sheetMetaDigest(meta);
  renderSheet(meta);
  $('overlay-sheet').classList.remove('hidden');
}

export function closeSheet() { $('overlay-sheet').classList.add('hidden'); }
export function isSheetOpen() { return !$('overlay-sheet').classList.contains('hidden'); }
export function updateSheetMeta(meta) {
  if (!isSheetOpen() || !meta) return;
  const d = sheetMetaDigest(meta);
  if (d === sheetDigest) return; // live numbers, but no wasteful rebuilds
  sheetDigest = d;
  renderSheet(meta);
}

const RARITY_ORDER = ['legendary', 'rare', 'uncommon', 'common'];

function renderSheet(meta) {
  const el = $('overlay-sheet');
  if (!meta) { el.innerHTML = ''; return; }
  const chr = CHAR_BY_ID[sheetCharId];
  const statRows = STATS.map(s => {
    const cur = Math.round((meta.stats[s.key] || 0) * 10) / 10;
    const base = (s.key === 'maxHp' ? 80 : 0) + ((chr && chr.stats[s.key]) || 0);
    const pct = STAT_IS_PCT[s.key] ? '%' : '';
    return `<div class="sheet-stat"><span class="dim">${s.name}</span>
      <span><b>${cur}${pct}</b>${cur !== base ? ` <span class="dim small">(base ${base}${pct})</span>` : ''}</span></div>`;
  }).join('');
  const wRows = meta.weapons.map(w => {
    const def = WEAPON_BY_ID[w.id];
    return `<div class="sheet-stat"><span><span class="wsym" style="color:${def.color}">${def.sym}</span> <b>${escapeHtml(def.name)}</b> <span style="color:var(--gold)">${TIER_NAMES[w.tier - 1]}</span></span>
      <span class="dim small">${def.tags.map(t => STAT_NAME[t] || t).join(', ')}</span></div>`;
  }).join('') || '<div class="dim small">no weapons</div>';
  const counts = new Map();
  for (const id of meta.items) counts.set(id, (counts.get(id) || 0) + 1);
  const grouped = RARITY_ORDER.map(r => {
    const rows = [...counts.entries()].filter(([id]) => ITEM_BY_ID[id] && ITEM_BY_ID[id].rarity === r);
    if (!rows.length) return '';
    return `<div class="sheet-rarity" style="color:var(--c-${r})">${r}</div>` + rows.map(([id, n]) =>
      `<div class="sheet-stat"><span class="r-${r}"><b>${escapeHtml(ITEM_BY_ID[id].name)}</b>${n > 1 ? ` ×${n}` : ''}</span>
       <span class="dim small">${ITEM_BY_ID[id].desc ? escapeHtml(ITEM_BY_ID[id].desc) : ''}</span></div>`).join('');
  }).join('') || '<div class="dim small">no items yet</div>';
  el.innerHTML = `
    <div class="panel sheet-panel">
      <div class="row spread">
        <div>
          <div class="ov-title">${chr ? escapeHtml(chr.name).toUpperCase() : 'CHARACTER'}</div>
          <div class="ov-sub">level ${meta.level} · ◆ ${meta.materials} · ${chr ? escapeHtml(chr.desc) : ''}</div>
        </div>
        <button id="sheet-close">Close</button>
      </div>
      <div class="sheet-cols">
        <div>
          <div class="owned-head">Stats</div>
          <div class="sheet-stats">${statRows}</div>
        </div>
        <div>
          <div class="owned-head">Weapons ${meta.weapons.length}/${meta.weaponSlots}</div>
          ${wRows}
          <div class="owned-head" style="margin-top:10px;">Items (${meta.items.length})</div>
          ${grouped}
        </div>
      </div>
    </div>`;
  el.querySelector('#sheet-close').onclick = () => { sfx.click(); closeSheet(); };
}
