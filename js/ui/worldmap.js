// THE WORLD MAP SCREEN (DOM) — the file `js/worldmap.js` has named in its own
// header since the region shell landed, and which did not exist.
//
// That absence is the whole reason the region layer never ran. `worldMapState`
// was a complete, correct, tested projection of all eight regions with
// `enterable` flags and a stated reason on every locked card — and nothing
// called it, because the thing that would call it was the screen. The frontier,
// the unlocks, the parked trees and `partyCanEnter` were all reachable code
// with no entry point, and 165 commits went past without a single gate noticing,
// because every gate constructed its own fixture and asked the module directly.
//
// Pure view, like every other screen: state lives in js/worldmap.js and the
// sim, this renders and forwards clicks. SELECTION IS ALL IT DOES — it picks a
// region index and hands it back. It does not start a run, own a character, or
// know what a Sim is.
//
// The Earth plate is decoration on top of that rule. Pins read `enterable`
// from `worldMapState`; a missing JPEG falls back to the eight-card grid the
// screen shipped with.

import { escapeHtml } from './screens.js';
import { sfx } from '../audio.js';
import { worldMapState } from '../worldmap.js';
import { biomeCoverage, BIOMES } from '../biomes.js';
import { bossForRegion, regionsWithAuthoredBoss, REGION_ANCHOR_LEVEL } from '../regions.js';
import { WORLD_MAP, geoFor, pinPct } from '../content/mapgeo.js';

const $ = id => document.getElementById(id);
let A = null;

export function initWorldMap(actions) { A = actions; }

export function hideWorldMap() { $('screen-world').classList.add('hidden'); }
export function isWorldMapOpen() { return !$('screen-world').classList.contains('hidden'); }

const STATE_LABEL = {
  frontier: 'YOUR FRONTIER',
  cleared: 'CLEARED',
  locked: 'LOCKED',
  unbuilt: 'NOT BUILT',
};

export function showWorldMap(character, playerStore, opts = {}) {
  const el = $('screen-world');
  el.classList.remove('hidden');
  const st = worldMapState(character, playerStore);
  const biomes = biomeCoverage();
  const withBoss = new Set(regionsWithAuthoredBoss());
  const frontier = st.rows.find(r => r.state === 'frontier') || st.rows.find(r => r.enterable) || st.rows[0];

  const pins = st.rows.map(r => {
    const geo = geoFor(r.index);
    if (!geo) return '';
    const p = pinPct(geo.lat, geo.lng);
    return `<button type="button" class="world-pin wp-${r.state} ${r.enterable ? 'enterable' : ''}"
              data-region="${r.index}" style="left:${p.x.toFixed(2)}%; top:${p.y.toFixed(2)}%;"
              ${r.enterable ? '' : 'aria-disabled="true"'}
              title="${escapeHtml(r.name)} — ${escapeHtml(STATE_LABEL[r.state] || r.state)}">
        <span class="wp-num">${r.index}</span>
        <span class="wp-label">${escapeHtml(r.name)}</span>
      </button>`;
  }).join('');

  el.innerHTML = `
    <div class="panel world-panel world-atlas">
      <div class="row spread world-head">
        <div>
          <div class="ov-title">THE WORLD</div>
          <div class="ov-sub">${st.built} of ${st.total} regions built · frontier ${st.frontier} · pick the next region on the Earth</div>
        </div>
        ${opts.canLeave ? '<button id="world-back">Back</button>' : ''}
      </div>
      <div class="world-earth" id="world-earth">
        <img class="world-plate" src="${WORLD_MAP}" alt="Earth" onerror="this.style.display='none'">
        ${pins}
      </div>
      <div class="world-dossier" id="world-dossier"></div>
      <div class="world-foot dim small">
        Frontier: region ${st.frontier}. A region below it replays for loot and levels but no
        world progress; a region above it cannot be entered. Clearing a region's boss advances
        your frontier and unlocks its native class for your NEXT character.
      </div>
    </div>`;

  const dossier = $('world-dossier');
  const paintDossier = (idx) => {
    const row = st.rows[idx - 1];
    if (!row) return;
    const geo = geoFor(idx);
    const biome = biomes[idx - 1];
    const boss = withBoss.has(idx) ? bossForRegion(idx) : null;
    const anchor = REGION_ANCHOR_LEVEL[idx - 1];
    const tileset = (biome && biome.defined) ? biome.biome : (geo && geo.tileset) || null;
    const ground = tileset && BIOMES[tileset]
      ? (geo && geo.ground) || tileset
      : 'flat fill';
    dossier.innerHTML = `
      <div class="wd-main">
        <div class="wd-kicker">${STATE_LABEL[row.state] || row.state}${geo ? ` · ${escapeHtml(geo.where)}` : ''}</div>
        <div class="wd-name">${escapeHtml(row.name)}</div>
        <div class="wd-reason">${escapeHtml(row.reason)}</div>
        <div class="wd-facts">
          <span>expected level ${anchor}</span>
          ${row.nativeClass ? `<span>${row.unlocked ? 'open' : 'locked'} ${escapeHtml(row.nativeClass)}</span>` : ''}
          ${row.parked ? '<span class="wc-parked">parked</span>' : ''}
          <span>ground: ${escapeHtml(ground)}</span>
          <span>${boss ? `boss: ${escapeHtml(boss.name)}` : 'boss: not authored'}</span>
        </div>
      </div>
      <div class="wd-act">
        ${row.enterable
          ? `<button class="primary big" id="world-enter">Enter ${escapeHtml(row.name)}</button>`
          : '<button class="big" disabled>Cannot enter</button>'}
      </div>`;
    el.querySelectorAll('.world-pin').forEach(p => {
      p.classList.toggle('selected', parseInt(p.dataset.region, 10) === idx);
    });
    const enter = $('world-enter');
    if (enter) enter.onclick = () => { sfx.click(); A.enterRegion(idx); };
  };

  el.querySelectorAll('.world-pin').forEach(pin => {
    const idx = parseInt(pin.dataset.region, 10);
    const row = st.rows[idx - 1];
    pin.onclick = () => {
      sfx.click();
      paintDossier(idx);
      if (row && row.enterable) {
        // first click selects; a selected enterable pin clicked again enters,
        // matching the old "the card is the button" feel without surprise jumps
        if (pin.classList.contains('armed')) A.enterRegion(idx);
        else {
          el.querySelectorAll('.world-pin').forEach(p => p.classList.remove('armed'));
          pin.classList.add('armed');
        }
      }
    };
  });
  const back = $('world-back');
  if (back) back.onclick = () => { sfx.click(); A.back(); };
  paintDossier(frontier.index);
}
