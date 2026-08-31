// The node map — the between-fights home screen. Pure view: taps forward
// to actions. With a regional atlas the tree is laid on a campaign trail
// across that plate (start on the coast, boss at the far landmark, dotted
// roads between floors). Without one it is the column layout it has always
// been. Missing art is a no-op.

import { escapeHtml } from './screens.js';
import { sfx } from '../audio.js';
import { OBJECTIVE_META } from '../objectives.js';
import { geoFor, campaignPlace } from '../content/mapgeo.js';

const $ = id => document.getElementById(id);
let A = null;
let lastDigest = '';
let resizeObs = null;

const KIND_META = {
  combat: { sym: '⚔', name: 'Skirmish' },
  elite: { sym: '☠', name: 'Champion' },
  shop: { sym: '◆', name: 'Trader' },
  treasure: { sym: '★', name: 'Reliquary' },
  siege: { sym: '⛨', name: 'BOSS' },
  shrine: { sym: '✦', name: 'Shrine', hint: 'No combat. One skill point, or one guaranteed reroll.' },
  cursed: { sym: '☾', name: 'Cursed', hint: "The region's modifier, active for this map only. ×1.6 materials." },
  ...Object.fromEntries(Object.entries(OBJECTIVE_META).map(([k, v]) => [k, { sym: v.sym, name: v.name, hint: v.hint }])),
};

export function initMapScreen(actions) { A = actions; }

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
  if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
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

function nodeButton(n, state, visited, reachable, extraAttr = '') {
  const meta = KIND_META[n.kind];
  const cls = [
    'map-node', `mn-${n.kind}`,
    n.id === state.current ? 'current' : '',
    visited.has(n.id) ? 'visited' : '',
    reachable.has(n.id) ? 'reachable' : '',
    state.vote && state.vote.nodeId === n.id ? 'voted' : '',
  ].join(' ');
  return `<button class="${cls}" data-node="${n.id}" ${reachable.has(n.id) ? '' : 'disabled'} title="${escapeHtml(meta.hint || meta.name)}" ${extraAttr}>
    <span class="mn-sym">${meta.sym}</span>
    <span class="mn-name">${meta.name}</span>
    ${n.profile === 'bastion' ? '<span class="mn-bastion" title="Bastion — hold-your-ground fight">⛊</span>' : ''}
    ${state.vote && state.vote.nodeId === n.id ? `<span class="mn-count">${Math.ceil(state.vote.t)}</span>` : ''}
  </button>`;
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
  const campaign = geo && geo.regionMap && geo.campaign;
  if (geo && geo.regionMap) {
    el.classList.add('has-atlas');
    el.style.backgroundImage = `url("${geo.regionMap}")`;
  } else {
    el.classList.remove('has-atlas');
    el.style.backgroundImage = '';
  }

  const march = geo && geo.startAt && geo.bossAt
    ? `${geo.startAt} → ${geo.bossAt}`
    : 'five maps, then the boss';
  const sub = state.vote
    ? `${escapeHtml(state.voteName || 'A player')} chose a path — ${Math.ceil(state.vote.t)}s to redirect (once)`
    : `pick the party's next map · ${escapeHtml(march)}`;

  const hud = `
    <div class="row spread map-hud">
      <div>
        <div class="ov-title">${escapeHtml(state.regionName || `REGION ${state.regionIndex}`).toUpperCase()} — REGION ${state.regionIndex} / 8</div>
        <div class="ov-sub">${sub}</div>
      </div>
      ${state.onShop ? '<button id="map-reopen-shop">◆ Reopen shop</button>' : ''}
    </div>`;
  const legend = `
    <div class="map-legend">
      <div>⚔ Skirmish · ☠ Champion · ✦ Shrine · ☾ Cursed · ◆ Trader · ★ Reliquary · ⛨ Boss · <span class="mn-bastion-inline">⛊</span> Bastion: hold-your-ground</div>
      <div class="legend-obj">${Object.values(OBJECTIVE_META).map(o => `${o.sym} ${o.name}`).join(' · ')}</div>
    </div>`;

  if (campaign) {
    const maxCol = cols - 1;
    const placed = layout.nodes.map(n => {
      const pos = campaignPlace(campaign, n.col, maxCol, n.row, byCol[n.col].length);
      return { n, pos };
    });
    const nodesHtml = placed.map(({ n, pos }) =>
      nodeButton(n, state, visited, reachable, `style="left:${pos.x.toFixed(2)}%;top:${pos.y.toFixed(2)}%"`)
    ).join('');
    el.innerHTML = `
      <div class="map-campaign">
        ${hud}
        <div class="map-stage" id="map-stage">
          <svg class="map-edges" id="map-edges"></svg>
          ${nodesHtml}
        </div>
        ${legend}
      </div>`;
  } else {
    const colHtml = byCol.map(col => `
      <div class="map-col">${col.map(n => nodeButton(n, state, visited, reachable)).join('')}</div>`).join('');
    el.innerHTML = `
      <div class="panel map-panel">
        ${hud}
        <div class="map-flow" id="map-flow">
          <svg class="map-edges" id="map-edges"></svg>
          ${colHtml}
        </div>
        ${legend}
      </div>`;
  }

  el.querySelectorAll('.map-node').forEach(btn => {
    btn.onclick = () => { sfx.click(); A.pickNode(parseInt(btn.dataset.node, 10)); };
  });
  const rb = el.querySelector('#map-reopen-shop');
  if (rb) rb.onclick = () => { sfx.click(); A.reopenShop(); };
  bindEdges(el, layout, visited, reachable, state, campaign);
}

function bindEdges(el, layout, visited, reachable, state, campaign) {
  const host = el.querySelector('#map-stage') || el.querySelector('#map-flow');
  const svg = el.querySelector('#map-edges');
  if (!host || !svg) return;
  const paint = () => drawEdges(host, svg, layout, visited, reachable, state, campaign);
  if (resizeObs) resizeObs.disconnect();
  resizeObs = new ResizeObserver(paint);
  resizeObs.observe(host);
  requestAnimationFrame(paint);
}

function drawEdges(host, svg, layout, visited, reachable, state, campaign) {
  const fr = host.getBoundingClientRect();
  if (!fr.width) return;
  svg.setAttribute('viewBox', `0 0 ${fr.width} ${fr.height}`);
  const pos = {};
  host.querySelectorAll('.map-node').forEach(btn => {
    const r = btn.getBoundingClientRect();
    pos[btn.dataset.node] = {
      x: r.x - fr.x + r.width / 2,
      y: r.y - fr.y + r.height / 2,
    };
  });

  let marks = '';
  if (campaign && campaign.path) {
    const spine = campaign.path.map(p => `${(p.x / 100) * fr.width},${(p.y / 100) * fr.height}`).join(' ');
    marks += `<polyline points="${spine}" fill="none" stroke="#ffd45e88" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 12" />`;
  }

  let lines = '';
  for (const n of layout.nodes) {
    for (const to of n.edges) {
      const a = pos[n.id], b = pos[to];
      if (!a || !b) continue;
      const active = (n.id === state.current || (state.current === null && layout.startIds.includes(n.id)))
        && reachable.has(to);
      const walked = visited.has(n.id) && visited.has(to);
      const stroke = active ? '#5ee0a8' : walked ? '#e0c36a' : '#d0d5ee';
      const width = active ? 3 : walked ? 2.5 : 2.2;
      const dash = '2 9';
      const op = active ? 1 : walked ? 0.95 : 0.78;
      lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
        stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"
        stroke-dasharray="${dash}" opacity="${op}" />`;
    }
  }
  svg.innerHTML = marks + lines;
}
