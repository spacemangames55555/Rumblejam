// Per-player overlays: shop, level-up, treasure. These never pause the sim;
// each player interacts at their own pace (movement keys still work).

import { ITEM_BY_ID } from '../content/items.js';
import { WEAPON_BY_ID, WEAPON_CLASS_NAMES } from '../content/weapons.js';
import { STAT_NAME, STAT_IS_PCT, TIER_MULT, TIER_NAMES } from '../config.js';
import { escapeHtml } from './screens.js';
import { sfx } from '../audio.js';

const $ = id => document.getElementById(id);
let A = null;

export function initOverlays(actions) { A = actions; }

export function closeAllOverlays() {
  for (const id of ['overlay-shop', 'overlay-levelup', 'overlay-treasure']) $(id).classList.add('hidden');
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
    ${combines ? '<br><span class="wpn-note">▲ combines with your copy → next tier!</span>' : ''}</div>`;
}

// ---------------- shop ----------------

let shopState = null;

export function showShop(ev, meta) {
  shopState = ev;
  renderShop(meta);
  $('overlay-shop').classList.remove('hidden');
}

export function isShopOpen() { return !$('overlay-shop').classList.contains('hidden'); }

export function updateShopMeta(meta) {
  if (isShopOpen() && shopState) renderShop(meta);
}

function renderShop(meta) {
  const ev = shopState;
  const el = $('overlay-shop');
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
      <div class="shop-foot">
        <button id="shop-reroll">Reroll ◆ ${ev.rerollCost}</button>
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
  el.querySelector('#shop-close').onclick = () => { sfx.click(); closeShop(); };
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
