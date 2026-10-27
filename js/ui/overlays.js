// Per-player overlays: shop, level-up, treasure. These never pause the sim;
// each player interacts at their own pace (movement keys still work).

import { ITEM_BY_ID } from '../content/items.js';
import { CHAR_BY_ID } from '../content/characters.js';
import { STATS, STAT_NAME, STAT_IS_PCT, STAT_BASE, sellValue } from '../config.js';
import { escapeHtml } from './screens.js';
import { fmtCount } from './format.js';
import { glossName, glossShort, glossDetail, glossify } from './gloss.js';
import { SLOT_LEVELS, TIER_LEVELS, tierLevel } from '../skills.js';
import { mechanics, passiveText } from '../skilltext.js';
import { sfx } from '../audio.js';

const $ = id => document.getElementById(id);
let A = null;

export function initOverlays(actions) { A = actions; }

export function closeAllOverlays() {
  for (const id of ['overlay-shop', 'overlay-levelup', 'overlay-treasure', 'overlay-sheet', 'overlay-boon', 'overlay-opening', 'overlay-skills']) $(id).classList.add('hidden');
}

// ---------------- tooltips ----------------

export function statLines(stats) {
  if (!stats) return '';
  return Object.entries(stats).map(([k, v]) => {
    const cls = v >= 0 ? 'stat-line' : 'stat-line stat-neg';
    return `<span class="${cls}">${v > 0 ? '+' : ''}${v}${STAT_IS_PCT[k] ? '%' : ''} ${glossName(k)}</span>`;
  }).join('');
}

function itemCardHtml(it, opts = {}) {
  return `
    <div class="oname">${escapeHtml(it.name)}</div>
    <div class="orarity">${it.rarity}${opts.owned ? ` · owned ×${opts.owned}` : ''}</div>
    <div class="odesc">${statLines(it.stats)}${it.desc ? `<div style="margin-top:4px;">${escapeHtml(it.desc)}</div>` : ''}</div>`;
}

// ---------------- shop ----------------

let shopState = null;
let lastShopMeta = null;
let armedSell = null;   // item id awaiting its confirming tap

// stats are in the digest so a bought item re-renders the moment the sheet moves
let shopDigest = '';
function shopMetaDigest(meta) {
  return meta ? JSON.stringify([meta.materials, meta.items, meta.stats]) : '';
}

export function showShop(ev, meta) {
  shopState = ev;
  armedSell = null;
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

// ---- owned items (sell). Weapons are not a slot anymore, so the shop does
// not render an arsenal line. ----

function ownedHtml(meta, floor) {
  if (!meta) return '';
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
    <div class="owned-head">Your items (${meta.items.length})</div>
    <div class="owned-row">${ichips || '<span class="dim small">no items yet</span>'}</div>`;
}

function wireOwned(el, meta) {
  el.querySelectorAll('[data-selli]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.selli;
      const key = `i${id}`;
      if (armedSell === key) {
        A.sellItem(id);
        armedSell = null;
      } else {
        armedSell = key;
        sfx.click();
        renderShop(meta);
      }
    });
  });
  // tapping anywhere that isn't a sell control disarms the confirmation
  // (assignment, not addEventListener — renderShop runs often and must not stack listeners)
  el.onclick = e => {
    if (e.target.closest('[data-keep]')) return;
    if (armedSell !== null) {
      armedSell = null;
      renderShop(meta);
    }
  };
}

function renderShop(meta) {
  const ev = shopState;
  if (!ev) return; // a bubbling close click can reach stale handlers after closeShop()
  const el = $('overlay-shop');
  lastShopMeta = meta;
  const mats = meta ? meta.materials : 0;
  el.innerHTML = `
    <div class="panel">
      <div class="row spread">
        <div>
          <div class="ov-title">${ev.black ? 'BLACK MARKET' : 'TRADER'}</div>
          <div class="ov-sub">${ev.black ? '6 slots · cheaper rerolls · richer stock · ' : ''}your stock — others shop their own · you have <b style="color:var(--gold)">◆ ${fmtCount(mats)}</b></div>
        </div>
        <button id="shop-close">Close (walk away)</button>
      </div>
      <div class="offer-row">${ev.stock.map((s, i) => {
        if (!s || s.kind !== 'item') return '';
        const data = ITEM_BY_ID[s.id];
        if (!data) return '';
        const afford = mats >= s.price;
        const ownedCount = meta ? meta.items.filter(id => id === s.id).length : 0;
        return `
        <div class="offer-card r-${data.rarity} ${s.sold ? 'sold' : ''} ${afford ? '' : 'cantafford'} ${s.locked ? 'locked' : ''}" data-slot="${i}">
          <button class="lockbtn" data-lock="${i}">${s.locked ? '🔒' : '🔓'}</button>
          ${itemCardHtml(data, { owned: ownedCount })}
          <div class="oprice">${s.sold ? 'SOLD' : `◆ ${s.price}`}</div>
        </div>`;
      }).join('')}</div>
      ${ownedHtml(meta, ev.floor || ev.region || 1)}
      <div class="shop-foot">
        <div class="row">
          <button id="shop-reroll">Reroll ◆ ${ev.rerollCost}</button>
          <button id="shop-sheet" data-keep="1">☰ Character</button>
        </div>
        <span class="dim small">lock 🔒 keeps an offer through rerolls and into the next shop</span>
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
  armedSell = null;
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
          <div class="gloss-short">${escapeHtml(glossShort(p.stat))}</div>
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

// ---------------- Facet's Prism boon picker ----------------
// Per-player and non-blocking: a compact bottom-center strip. The room plays
// on while it's up (movement still works; it never appears for other players).

// Three traits share this panel and they do NOT share its rules: Facet and the
// Druid roll a room-length boon that needs three takes to stick, the Blacksmith
// picks a fixed crystal that is permanent the moment it lands. Hardcoding one
// trait's copy told two thirds of the players the wrong thing about their pick.
function boonTitle(ev) {
  if (ev.crystal) return 'BLACKSMITH — infuse a crystal';
  if (ev.trait === 'wildshape') return 'THE SHAPE — pick a boon for this room';
  return 'PRISM — pick a boon for this room';
}

// The second line of a card: what this pick is worth beyond the stat number.
function boonProgress(p) {
  if (!p.crystal) {
    return `${'◆'.repeat(Math.min(3, p.n))}${'◇'.repeat(Math.max(0, 3 - p.n))} ${p.n >= 3 ? 'permanent!' : `${p.n}/3 to keep`}`;
  }
  const n = p.n + 1;   // infusions count the pick you are about to take
  const det = p.every
    ? n % p.every === 0 ? ' · arms detonation!' : ` · ${n % p.every}/${p.every} to detonation`
    : '';
  return `${escapeHtml(p.name || 'crystal')} · #${n} — permanent${det}`;
}

export function showBoon(ev) {
  const el = $('overlay-boon');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="panel boon-panel">
      <div class="ov-title" style="font-size:15px;">${boonTitle(ev)}</div>
      <div class="offer-row boon-row">${ev.picks.map(p => `
        <div class="offer-card r-${p.rarity} boon-card" data-id="${p.id}">
          <div class="oname">+${p.amount}${STAT_IS_PCT[p.stat] ? '%' : ''} ${STAT_NAME[p.stat]}</div>
          <div class="orarity">${boonProgress(p)}</div>
          <div class="gloss-short">${escapeHtml(glossShort(p.stat))}</div>
        </div>`).join('')}</div>
    </div>`;
  el.querySelectorAll('.boon-card').forEach(card => {
    card.onclick = () => { sfx.click(); A.pickBoon(card.dataset.id); };
  });
}

export function closeBoon() { $('overlay-boon').classList.add('hidden'); }

// ---------------- §5.6 the opening ability ----------------
// The first point a character spends, chosen from the tier-1 nodes of their own
// trees. Characters start with NO abilities at all, so until this is answered
// the player has no way to deal damage — which is exactly what shipped, because
// this panel did not exist and nothing else ever sent `learnSkill`.
//
// Deliberately built on the boon panel's markup rather than a new screen: it is
// the same kind of moment (a small set of cards, one click, no dismiss) and
// reusing it means one styling path rather than two that drift.
export function showOpening(ev) {
  const el = $('overlay-opening');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="panel boon-panel">
      <div class="ov-title" style="font-size:15px;">YOUR OPENING ABILITY — this is your first and only attack</div>
      <div class="offer-row boon-row">${ev.picks.map(p => `
        <div class="offer-card boon-card" data-id="${escapeHtml(p.id)}">
          <div class="oname">${escapeHtml(p.name)}</div>
          <div class="orarity">${escapeHtml(p.tree)} · ${escapeHtml(p.domain)}</div>
          <div class="sk-mech">${escapeHtml(p.mech || '')}</div>
          ${p.flavor ? `<div class="sk-flavor">${escapeHtml(p.flavor)}</div>` : ''}
        </div>`).join('')}</div>
    </div>`;
  el.querySelectorAll('.boon-card').forEach(card => {
    card.onclick = () => { sfx.click(); A.pickOpening(card.dataset.id); };
  });
}

export function closeOpening() { $('overlay-opening').classList.add('hidden'); }

// ---------------- the skill screen ----------------
//
// The player-facing half of the skill system: every tier of every tree the
// character owns, with prerequisites, ranks, costs and the loadout.
//
// PULL, NOT PUSH — and that is the whole reason it is built differently from
// the boon and opening panels beside it. Those are HOST-PUSHED: the sim decides
// a moment has arrived and hands the client the exact picks to render, so the
// client never needs state it was not given. This screen is opened by the
// PLAYER, at a moment the host did not choose, and has to render a whole build.
// So it reads `app.meta` — the per-player private channel that already carries
// level, stats, items and weapons, and now carries `skillPoints`, `skillRanks`
// and `loadout` too.
//
// THE SIM IS THE ENFORCEMENT, NOT THIS FILE. Every affordance below is a
// courtesy: `canLearn` is mirrored here so a node that cannot be bought looks
// like it, and the slot row is disabled mid-fight per §5.5 — but `spendSkillPoint`
// and `setLoadout` re-check both on the host, because a client can send anything.
// Where the two disagree the host wins and the screen redraws from the meta it
// gets back.
let SKILLS_STATE = { meta: null, charId: null, pickSlot: null };

function canLearnLocal(meta, sk) {
  if (!sk) return false;
  const rank = (meta.skillRanks || {})[sk.id] || 0;
  if (sk.maxRank !== undefined && rank >= sk.maxRank) return false;
  // §8.1.1's tier gate, mirrored from canLearn(). The HOST owns the rule — this
  // is a look, not a gate — but a screen that offers a node the sim will refuse
  // teaches the player the wrong thing about their own build.
  if (rank < 1 && (meta.level || 1) < tierLevel(sk.tier)) return false;
  if (!sk.prereq) return true;
  return ((meta.skillRanks || {})[sk.prereq] || 0) >= 1;
}

// LANES — what turns a prereq graph into something you can look at.
//
// A branching tree drawn as a row of cards sorted by tier says "these come in
// this order", which is the one thing branching does NOT mean. The layout has
// to say "here the road forks and both sides go somewhere".
//
// Tier is the column (the load assertion guarantees tier strictly decreases
// along every prereq edge, so a parent is always left of its children). The lane
// is the row: walking down from the root, a node's FIRST child inherits its
// lane and each further child takes a fresh one, so a branch visibly separates
// and then runs in parallel. Nothing here reads a class or a tree id.
function layoutTree(skills) {
  const byId = {}; for (const s of skills) byId[s.id] = s;
  const kids = {}; for (const s of skills) if (s.prereq) (kids[s.prereq] ||= []).push(s.id);
  const tiers = [...new Set(skills.map(s => s.tier))].sort((a, b) => a - b);
  const col = {}; tiers.forEach((t, i) => { col[t] = i; });
  const lane = {};
  let next = 0;
  const root = skills.find(s => !s.prereq);
  const walk = (id, myLane) => {
    lane[id] = myLane;
    const cs = (kids[id] || []).slice().sort((a, b) => byId[a].tier - byId[b].tier);
    cs.forEach((c, i) => walk(c, i === 0 ? myLane : ++next));
  };
  if (root) walk(root.id, 0);
  // anything the walk never reached would be a stranded node; the load
  // assertion refuses those, so this is belt-and-braces rather than a fallback
  for (const s of skills) if (lane[s.id] === undefined) lane[s.id] = ++next;
  return { col, lane, lanes: next + 1, tiers, kids, byId };
}

function skillCard(meta, sk, spendable) {
  const rank = (meta.skillRanks || {})[sk.id] || 0;
  const cap = sk.maxRank !== undefined ? sk.maxRank : null;
  const learnable = spendable && canLearnLocal(meta, sk);
  const locked = !rank && sk.prereq && !((meta.skillRanks || {})[sk.prereq] || 0);
  const cls = ['skill-node', rank ? 'known' : '', learnable ? 'buyable' : '', locked ? 'locked' : ''].filter(Boolean).join(' ');
  const rankText = cap === 1 ? (rank ? 'taken' : 'unlock') : `rank ${rank}${cap ? `/${cap}` : ''}`;
  return `<div class="${cls}" data-id="${escapeHtml(sk.id)}" data-buy="${learnable ? 1 : 0}">
    <div class="sk-tier">T${sk.tier}</div>
    <div class="sk-name">${escapeHtml(sk.name)}${sk.type === 'passive' ? ' <span class="sk-tag">passive</span>' : ''}</div>
    <div class="sk-rank">${rankText}${learnable ? ' · <b>1 pt</b>' : ''}</div>
    ${mechBlock(sk, rank)}
    ${sk.flavor ? `<div class="sk-flavor">${escapeHtml(sk.flavor)}</div>` : ''}
  </div>`;
}

// THE MECHANICAL LINE, ABOVE THE FLAVOR AND STYLED APART FROM IT.
//
// Generated from the def at the rank being displayed, never authored — see
// js/skilltext.js. A figure that moves with rank shows `now → next` so the cost
// of a point is visible before it is spent; one that does not shows a single
// number, which makes the arrow itself the signal.
//
// Rank 0 renders rank 1, because rank 0 never fires and what a player wants
// before spending is what the point buys.
function mechBlock(sk, rank) {
  if (sk.type === 'passive') {
    const p = passiveText(sk);
    return p.text ? `<div class="sk-mech"><span class="sk-mv">${escapeHtml(p.text)}</span></div>` : '';
  }
  const m = mechanics(sk, rank);
  if (!m.fields.length) return '';
  const rows = m.fields.map(f => `<span class="sk-mf">${escapeHtml(f.label)}</span> `
    + `<span class="sk-mv">${escapeHtml(String(f.now))}</span>`
    + (f.next !== undefined ? ` <span class="sk-mn">→ ${escapeHtml(String(f.next))}</span>` : ''));
  return `<div class="sk-mech">${rows.join('<br>')}</div>`;
}

// Fixed cell geometry so edge positions are ARITHMETIC rather than measured —
// nothing here waits for layout, so the panel draws correctly the first frame
// and inside a hidden container.
// GROWN FOR THE MECHANICAL LINE. 132x104 held a name, a rank and two lines of
// prose; a generated block runs to seven fields on 111 of 356 actives and the
// longest single field ("Over time 20.8 a tick every 0.42s for 6.6s → ...") is
// 77 characters. Numbers a player cannot see are the defect this patch exists
// to fix, so the card fits them rather than clipping them.
const CELL_W = 196, CELL_H = 188, GAP_X = 38, GAP_Y = 14;

function treeGraph(meta, t, spendable) {
  const L = layoutTree(t.skills);
  const w = L.tiers.length * CELL_W + Math.max(0, L.tiers.length - 1) * GAP_X;
  const h = L.lanes * CELL_H + Math.max(0, L.lanes - 1) * GAP_Y;
  const xOf = sk => L.col[sk.tier] * (CELL_W + GAP_X);
  const yOf = sk => L.lane[sk.id] * (CELL_H + GAP_Y);

  // one polyline per prereq edge: out of the parent's right face, across the
  // gutter, into the child's left face
  const edges = t.skills.filter(sk => sk.prereq && L.byId[sk.prereq]).map(sk => {
    const pa = L.byId[sk.prereq];
    const x1 = xOf(pa) + CELL_W, y1 = yOf(pa) + CELL_H / 2;
    const x2 = xOf(sk), y2 = yOf(sk) + CELL_H / 2;
    const mx = x1 + (x2 - x1) / 2;
    const known = ((meta.skillRanks || {})[pa.id] || 0) >= 1;
    return `<polyline class="edge ${known ? 'live' : ''}" points="${x1},${y1} ${mx},${y1} ${mx},${y2} ${x2},${y2}" />`;
  }).join('');

  const cards = t.skills.map(sk =>
    `<div class="node-at" style="left:${xOf(sk)}px; top:${yOf(sk)}px; width:${CELL_W}px; height:${CELL_H}px;">${skillCard(meta, sk, spendable)}</div>`
  ).join('');

  // the tier ruler: which gate each column is, and the level that opens it
  const ruler = L.tiers.map(tr =>
    `<div class="tier-head" style="left:${L.col[tr] * (CELL_W + GAP_X)}px; width:${CELL_W}px;">T${tr} · lvl ${tierLevel(tr)}</div>`
  ).join('');

  const branches = Object.values(L.kids).filter(k => k.length > 1).length;
  return `<div class="tree-block">
    <div class="tree-name">${escapeHtml(t.name)}${branches ? ` <span class="tree-branchy">${branches} branch point${branches === 1 ? '' : 's'}</span>` : ''}</div>
    <div class="tree-scroll">
    <div class="tier-ruler" style="width:${w}px;">${ruler}</div>
    <div class="tree-graph" style="width:${w}px; height:${h}px;">
      <svg class="tree-edges" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${edges}</svg>
      ${cards}
    </div>
    </div>
  </div>`;
}

export function showSkills(meta, charId, trees) {
  if (!meta || !trees) return;
  SKILLS_STATE = { meta, charId, pickSlot: SKILLS_STATE.pickSlot };
  const el = $('overlay-skills');
  // SCROLL POSITION SURVIVES THE RE-RENDER.
  //
  // This function replaces the panel's whole innerHTML, and `updateSkillsMeta`
  // calls it on every meta update — which in an arena is many times a second.
  // Each rebuild destroyed the scrolled element, so `scrollTop` went back to 0
  // before the player's thumb had left the glass. Reported from playtest as
  // "won't scroll — snaps back to the top", and the lower tiers of every tree
  // were unreachable: measured 578px of panel against 817px of content, so a
  // third of every tree was permanently off-screen and unclickable.
  //
  // Captured from the OLD panel and reapplied to the NEW one, because the
  // element the browser was scrolling does not exist after the assignment.
  const prevScroll = (el.querySelector('.skills-panel') || {}).scrollTop || 0;
  el.classList.remove('hidden');
  const pts = meta.skillPoints || 0;
  const slots = meta.skillSlots || 0;
  // §5.5, as answered by the HOST. Not re-derived here: `setLoadout` owns the
  // rule and re-checks every action, so this is a look rather than a gate.
  const canSlot = meta.canSlot !== false;
  const loadout = meta.loadout || [];
  const known = Object.entries(meta.skillRanks || {}).filter(([, r]) => r > 0).map(([id]) => id);
  const actives = known.filter(id => { const s = trees.byId[id]; return s && s.type === 'active'; });

  el.innerHTML = `
    <div class="panel skills-panel">
      <div class="ov-title">SKILLS — <span class="${pts ? 'pts-have' : ''}">${pts} point${pts === 1 ? '' : 's'}</span> unspent</div>

      <div class="slot-row">
        <div class="slot-label">LOADOUT ${canSlot ? '' : '<span class="slot-locked">— locked during a fight (§5.5)</span>'}</div>
        <div class="slots">${Array.from({ length: 8 }, (_, i) => {
          const open = i < slots;
          const id = loadout[i];
          const sk = id ? trees.byId[id] : null;
          const sel = SKILLS_STATE.pickSlot === i;
          return `<div class="slot ${open ? '' : 'shut'} ${sel ? 'picking' : ''}" data-slot="${i}">
            <div class="slot-n">${i + 1}</div>
            <div class="slot-name">${open ? (sk ? escapeHtml(sk.name) : '—') : 'lvl ' + SLOT_LEVELS[i]}</div>
          </div>`;
        }).join('')}</div>
        ${SKILLS_STATE.pickSlot !== null && canSlot ? `<div class="slot-pick">
          <div class="slot-label">put in slot ${SKILLS_STATE.pickSlot + 1}:</div>
          <div class="slot-choices">
            <button class="slot-choice" data-put="">clear</button>
            ${actives.map(id => `<button class="slot-choice" data-put="${escapeHtml(id)}">${escapeHtml(trees.byId[id].name)}</button>`).join('')}
          </div></div>` : ''}
      </div>

      ${trees.list.map(t => treeGraph(meta, t, pts > 0)).join('')}

      <button id="skills-close">Close</button>
    </div>`;

  // Reapplied after the DOM exists. Clamped by the browser, so a shorter tree
  // after a re-render lands at the bottom rather than out of range.
  const panelEl = el.querySelector('.skills-panel');
  if (panelEl && prevScroll) panelEl.scrollTop = prevScroll;

  el.querySelectorAll('.skill-node[data-buy="1"]').forEach(n => {
    n.onclick = () => { sfx.click(); A.learnSkill(n.dataset.id); };
  });
  if (canSlot) {
    el.querySelectorAll('.slot:not(.shut)').forEach(n => {
      n.onclick = () => {
        sfx.click();
        const i = +n.dataset.slot;
        SKILLS_STATE.pickSlot = SKILLS_STATE.pickSlot === i ? null : i;
        showSkills(SKILLS_STATE.meta, SKILLS_STATE.charId, trees);
      };
    });
    el.querySelectorAll('.slot-choice').forEach(n => {
      n.onclick = () => {
        sfx.click();
        A.setSlot(SKILLS_STATE.pickSlot, n.dataset.put || null);
        SKILLS_STATE.pickSlot = null;
      };
    });
  }
  el.querySelector('#skills-close').onclick = () => { sfx.click(); closeSkills(); };
}

// Redraw in place when the host sends a new meta — a spend or a slot change is
// answered by the sim, so the screen must show what the HOST agreed to rather
// than what the click hoped for.
// AND THE RE-RENDER ONLY HAPPENS WHEN THIS SCREEN'S OWN INPUTS CHANGE.
//
// Preserving `scrollTop` fixes the reported bug on its own, but rebuilding the
// entire panel at meta cadence is what created it — and a full innerHTML swap
// many times a second also drops hover, focus and any in-flight tap. The meta
// channel carries the whole player: materials tick, HP ticks, engines tick, and
// none of that is on this screen.
//
// So the panel redraws when one of the six fields it actually displays moves.
// Cheap and total: a signature over exactly what `showSkills` reads.
let SKILLS_SIG = null;
function skillsSignature(meta) {
  return JSON.stringify([meta.skillPoints, meta.skillSlots, meta.level,
    meta.materials, meta.canSlot, meta.loadout, meta.skillRanks]);
}
export function updateSkillsMeta(meta, trees) {
  if ($('overlay-skills').classList.contains('hidden')) { SKILLS_SIG = null; return; }
  if (!meta) return;
  const sig = skillsSignature(meta);
  if (sig === SKILLS_SIG) { SKILLS_STATE.meta = meta; return; }
  SKILLS_SIG = sig;
  showSkills(meta, SKILLS_STATE.charId, trees);
}

export function isSkillsOpen() { return !$('overlay-skills').classList.contains('hidden'); }
// Closing the tree screen is the map-end spend step's exit (§5.5) once the
// clear announcement is over. The action decides: a close while banners or
// level-up cards are still up only hides this panel and leaves the step
// pending, and the close after the cards is the one the host hears. Both the
// button and the K toggle come through here, so there is still one close.
export function closeSkills() {
  const el = $('overlay-skills');
  el.classList.add('hidden');
  el.classList.remove('above-banners');
  el.classList.remove('above-cards');
  delete el.dataset.heldBanner;
  SKILLS_STATE.pickSlot = null;
  if (A && A.spendDone) A.spendDone();
}

// ---------------- character sheet ----------------
// Live view of one player's build: all sixteen stats (base shown where it
// differs) and items stacked by rarity. Weapons are not a slot, so the sheet
// does not render an arsenal. Per-player DOM — never blocks anyone else's game.

let sheetCharId = null;
let sheetDigest = '';
const sheetGlossOpen = new Set(); // stat keys with their inline detail expanded
function sheetMetaDigest(meta) {
  return meta ? JSON.stringify([meta.stats, meta.items, meta.level, meta.materials]) : '';
}

export function showSheet(meta, charId) {
  sheetCharId = charId;
  sheetDigest = sheetMetaDigest(meta);
  sheetGlossOpen.clear();
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
  // every stat row is tappable/hoverable: hover shows the glossary popover
  // (desktop); tapping toggles the plain-language detail inline beneath the
  // row (the mobile path — works on desktop too)
  const statRows = STATS.map((s, i) => {
    const cur = Math.round((meta.stats[s.key] || 0) * 10) / 10;
    const base = (STAT_BASE[s.key] || 0) + ((chr && chr.stats[s.key]) || 0);
    const pct = STAT_IS_PCT[s.key] ? '%' : '';
    const open = sheetGlossOpen.has(s.key);
    return `<div class="sheet-stat gloss-row ${i % 2 ? '' : 'alt'}" data-glossrow="${s.key}"><span class="dim">${s.name} <span class="dim small">${open ? '▾' : '▸'}</span></span>
      <span><b>${cur}${pct}</b>${cur !== base ? ` <span class="dim small">(base ${base}${pct})</span>` : ''}</span></div>
      ${open ? `<div class="gloss-detail">${escapeHtml(glossDetail(s.key))}</div>` : ''}`;
  }).join('');
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
          <div class="ov-sub">level ${meta.level} · ◆ ${fmtCount(meta.materials)} · ${chr ? glossify(chr.desc) : ''}</div>
        </div>
        <button id="sheet-close">Close</button>
      </div>
      <div class="sheet-cols">
        <div>
          <div class="owned-head">Stats</div>
          <div class="sheet-stats">${statRows}</div>
        </div>
        <div>
          <div class="owned-head">Items (${meta.items.length})</div>
          ${grouped}
        </div>
      </div>
    </div>`;
  el.querySelector('#sheet-close').onclick = () => { sfx.click(); closeSheet(); };
  // tap a stat row → toggle its inline glossary detail (never pauses anything
  // beyond what the sheet itself already does)
  el.querySelectorAll('[data-glossrow]').forEach(row => {
    row.onclick = () => {
      const key = row.dataset.glossrow;
      if (sheetGlossOpen.has(key)) sheetGlossOpen.delete(key);
      else sheetGlossOpen.add(key);
      sfx.click();
      renderSheet(meta);
    };
  });
}
