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

import { escapeHtml } from './screens.js';
import { sfx } from '../audio.js';
import { worldMapState } from '../worldmap.js';
import { biomeCoverage } from '../biomes.js';
import { bossForRegion, regionsWithAuthoredBoss, REGION_ANCHOR_LEVEL } from '../regions.js';

const $ = id => document.getElementById(id);
let A = null;

export function initWorldMap(actions) { A = actions; }

export function hideWorldMap() { $('screen-world').classList.add('hidden'); }
export function isWorldMapOpen() { return !$('screen-world').classList.contains('hidden'); }

// A card's look is its state. `enterable` is the only thing that decides
// whether it can be clicked, and it comes from `worldMapState` rather than
// being recomputed here — a screen that re-derives a rule is a second copy of
// the rule.
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

  const cards = st.rows.map(r => {
    const biome = biomes[r.index - 1];
    const boss = withBoss.has(r.index) ? bossForRegion(r.index) : null;
    const anchor = REGION_ANCHOR_LEVEL[r.index - 1];
    return `
      <div class="world-card wc-${r.state} ${r.enterable ? 'enterable' : ''}"
           data-region="${r.index}" ${r.enterable ? '' : 'aria-disabled="true"'}>
        <div class="wc-head">
          <span class="wc-num">${r.index}</span>
          <span class="wc-name">${escapeHtml(r.name)}</span>
        </div>
        <div class="wc-state">${STATE_LABEL[r.state] || r.state}</div>
        <div class="wc-reason">${escapeHtml(r.reason)}</div>
        <div class="wc-facts">
          <span>expected level ${anchor}</span>
          ${r.nativeClass ? `<span>${r.unlocked ? '✔' : '🔒'} ${escapeHtml(r.nativeClass)}</span>` : ''}
          ${r.parked ? '<span class="wc-parked">◧ parked</span>' : ''}
        </div>
        <div class="wc-content small dim">
          ${boss ? `boss: ${escapeHtml(boss.name)}` : 'boss: <i>not authored</i>'}
          · ground: ${biome.defined ? escapeHtml(biome.biome) : '<i>flat</i>'}
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="panel world-panel">
      <div class="row spread">
        <div>
          <div class="ov-title">THE WORLD — ${st.built} of ${st.total} REGIONS BUILT</div>
          <div class="ov-sub">Eight regions, in order. Clearing a region's boss advances your frontier and unlocks its native class for your NEXT character.</div>
        </div>
        ${opts.canLeave ? '<button id="world-back">Back</button>' : ''}
      </div>
      <div class="world-grid">${cards}</div>
      <div class="world-foot dim small">
        Frontier: region ${st.frontier}. A region below it replays for loot and levels but no world progress; a region above it cannot be entered.
      </div>
    </div>`;

  el.querySelectorAll('.world-card').forEach(card => {
    const idx = parseInt(card.dataset.region, 10);
    const row = st.rows[idx - 1];
    if (!row || !row.enterable) return;   // inert, and the card says why
    card.onclick = () => { sfx.click(); A.enterRegion(idx); };
  });
  const back = $('world-back');
  if (back) back.onclick = () => { sfx.click(); A.back(); };
}
