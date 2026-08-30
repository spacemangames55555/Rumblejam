// The node map — the between-fights home screen. Renders the floor's
// branching shape as tappable node buttons (≥44px), shows visited/current/
// reachable states, the party consent countdown, and a reopen-shop button
// when parked on a shop stop. Pure view: taps forward to actions.
//
// The regional atlas is a backdrop under the same tree. Missing art is a
// no-op: the screen is the panel it has always been.

import { escapeHtml } from './screens.js';
import { sfx } from '../audio.js';
import { OBJECTIVE_META } from '../objectives.js';
import { geoFor } from '../content/mapgeo.js';

const $ = id => document.getElementById(id);
let A = null;

const KIND_META = {
  combat: { sym: '⚔', name: 'Skirmish' },
  elite: { sym: '☠', name: 'Champion' },
  shop: { sym: '◆', name: 'Trader' },
  treasure: { sym: '★', name: 'Reliquary' },
  siege: { sym: '⛨', name: 'BOSS' },
  // §2.4's other two node types, which no structure could place until the tree
  // replaced the floor map
  shrine: { sym: '✦', name: 'Shrine', hint: 'No combat. One skill point, or one guaranteed reroll.' },
  cursed: { sym: '☾', name: 'Cursed', hint: "The region's modifier, active for this map only. ×1.6 materials." },
  // the eight objective levels carry their own icon + name on the map
  ...Object.fromEntries(Object.entries(OBJECTIVE_META).map(([k, v]) => [k, { sym: v.sym, name: v.name, hint: v.hint }])),
};

export function initMapScreen(actions) { A = actions; }

let lastDigest = '';

export function showMapScreen(state) {
  const el = $('screen-map');
  el.classList.remove('hidden');
  renderMap(state);
}

export function hideMapScreen() {
  const el = $('screen-map');
  el.classList.add('hidden');
  el.classList.remove('has-atlas');
  el.style.backgroundImage = '';
  lastDigest = '';
}

export function isMapScreenOpen() { return !$('screen-map').classList.contains('hidden'); }

// state: {layout, regionIndex, regionName, current, visited:[], reachable:[], vote:{nodeId,t,byIdx}|null, onShop:bool}
export function updateMapScreen(state) {
  if (!isMapScreenOpen()) return;
  const d = JSON.stringify([state.current, state.visited, state.reachable,
    state.vote && [state.vote.nodeId, Math.ceil(state.vote.t * 10)], state.onShop, state.regionIndex]);
  if (d === lastDigest) return;
  renderMap(state);
}

function renderMap(state) {
  const el = $('screen-map');
  const { layout } = state;
  lastDigest = JSON.stringify([state.current, state.visited, state.reachable,
    state.vote && [state.vote.nodeId, Math.ceil(state.vote.t * 10)], state.onShop, state.regionIndex]);
  const cols = Math.max(...layout.nodes.map(n => n.col)) + 1;
  const byCol = Array.from({ length: cols }, () => []);
  for (const n of layout.nodes) byCol[n.col].push(n);
  const visited = new Set(state.visited);
  const reachable = new Set(state.reachable);
  const geo = geoFor(state.regionIndex);
  if (geo && geo.regionMap) {
    el.classList.add('has-atlas');
    el.style.backgroundImage = `url("${geo.regionMap}")`;
  } else {
    el.classList.remove('has-atlas');
    el.style.backgroundImage = '';
  }

  // node buttons per column; edges drawn in an SVG underlay
  const colHtml = byCol.map(col => `
    <div class="map-col">${col.map(n => {
      const meta = KIND_META[n.kind];
      const cls = [
        'map-node', `mn-${n.kind}`,
        n.id === state.current ? 'current' : '',
        visited.has(n.id) ? 'visited' : '',
        reachable.has(n.id) ? 'reachable' : '',
        state.vote && state.vote.nodeId === n.id ? 'voted' : '',
      ].join(' ');
      return `<button class="${cls}" data-node="${n.id}" ${reachable.has(n.id) ? '' : 'disabled'} title="${escapeHtml(meta.hint || meta.name)}">
        <span class="mn-sym">${meta.sym}</span>
        <span class="mn-name">${meta.name}</span>
        ${n.profile === 'bastion' ? '<span class="mn-bastion" title="Bastion — hold-your-ground fight">⛊</span>' : ''}
        ${state.vote && state.vote.nodeId === n.id ? `<span class="mn-count">${Math.ceil(state.vote.t)}</span>` : ''}
      </button>`;
    }).join('')}</div>`).join('');

  const where = geo && geo.where ? ` · ${geo.where}` : '';
  el.innerHTML = `
    <div class="panel map-panel">
      <div class="row spread">
        <div>
          <div class="ov-title">${escapeHtml(state.regionName || `REGION ${state.regionIndex}`).toUpperCase()} — REGION ${state.regionIndex} / 8</div>
          <div class="ov-sub">${state.vote
            ? `${escapeHtml(state.voteName || 'A player')} chose a path — ${Math.ceil(state.vote.t)}s to redirect (once)`
            : `pick the party's next map · five maps, then the boss${where}`}</div>
        </div>
        ${state.onShop ? '<button id="map-reopen-shop">◆ Reopen shop</button>' : ''}
      </div>
      <div class="map-flow" id="map-flow">
        <svg class="map-edges" id="map-edges"></svg>
        ${colHtml}
      </div>
      <div class="map-legend">
        <div>⚔ Skirmish · ☠ Champion · ✦ Shrine · ☾ Cursed · ◆ Trader · ★ Reliquary · ⛨ Boss · <span class="mn-bastion-inline">⛊</span> Bastion: hold-your-ground</div>
        <div class="legend-obj">${Object.values(OBJECTIVE_META).map(o => `${o.sym} ${o.name}`).join(' · ')}</div>
      </div>
    </div>`;
  el.querySelectorAll('.map-node').forEach(btn => {
    btn.onclick = () => { sfx.click(); A.pickNode(parseInt(btn.dataset.node, 10)); };
  });
  const rb = el.querySelector('#map-reopen-shop');
  if (rb) rb.onclick = () => { sfx.click(); A.reopenShop(); };
  drawEdges(el, layout, visited, reachable, state);
}

// connect node buttons with lines (drawn after layout so positions are real)
function drawEdges(el, layout, visited, reachable, state) {
  const svg = el.querySelector('#map-edges');
  const flow = el.querySelector('#map-flow');
  if (!svg || !flow) return;
  requestAnimationFrame(() => {
    const fr = flow.getBoundingClientRect();
    if (!fr.width) return;
    svg.setAttribute('viewBox', `0 0 ${fr.width} ${fr.height}`);
    const pos = {};
    el.querySelectorAll('.map-node').forEach(btn => {
      const r = btn.getBoundingClientRect();
      pos[btn.dataset.node] = { x: r.x - fr.x + r.width / 2, y: r.y - fr.y + r.height / 2, w: r.width };
    });
    let lines = '';
    for (const n of layout.nodes) {
      for (const to of n.edges) {
        const a = pos[n.id], b = pos[to];
        if (!a || !b) continue;
        const active = (n.id === state.current || (state.current === null && layout.startIds.includes(n.id)))
          && reachable.has(to);
        const walked = visited.has(n.id) && visited.has(to);
        lines += `<line x1="${a.x + a.w / 2 - 6}" y1="${a.y}" x2="${b.x - b.w / 2 + 6}" y2="${b.y}"
          stroke="${active ? '#5ee0a8' : walked ? '#454b6e' : '#2b2f45'}" stroke-width="${active ? 3 : 2}"
          ${active ? '' : 'stroke-dasharray="6 5"'} />`;
      }
    }
    svg.innerHTML = lines;
  });
}
