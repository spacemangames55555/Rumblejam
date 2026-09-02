// The node map — the between-fights home screen. Pure view: taps forward
// to actions. With a regional atlas the tree is laid on a campaign trail
// across that plate (start on the coast, boss at the far landmark, dotted
// roads between floors). Without one it is the column layout it has always
// been. Missing art is a no-op.
//
// THE CAMPAIGN LAYOUT IS CONDITIONAL, AND THE CONDITION IS A FIT TEST RATHER
// THAN A WIDTH. `campaignPlace` positions nodes in percent along a fixed
// polyline with no collision avoidance, so on a small enough surface two
// buttons land on top of each other — measured at 1280x720 (one pair, every
// seed of region 2), and up to ten pairs at 844x390 with 41% of a button
// covered and `elementFromPoint` at one node's own centre returning its
// neighbour. That is a tap that picks the wrong map, not a cosmetic overlap.
//
// A width threshold would be a number tuned against today's path data and
// today's node CSS, and would drift the moment either moved. Instead the
// placement is run against the real surface before anything is written, every
// node given the box the stylesheet actually gives it, and the campaign layout
// is used only when no two boxes intersect. Below that the screen is the
// column layout unchanged — the one that measures zero overlaps at every
// viewport because flexbox spaces it by construction.
//
// `tools/mapscreen_gate.mjs` asserts the outcome in a real browser.

import { escapeHtml } from './screens.js';
import { sfx } from '../audio.js';
import { OBJECTIVE_META } from '../objectives.js';
import { geoFor, campaignPlace } from '../content/mapgeo.js';

const $ = id => document.getElementById(id);
let A = null;
let lastDigest = '';
let resizeObs = null;
let lastState = null;
let lastCampaignFit = null;

// Gutter between two node boxes, in css pixels. Boxes that merely touch are
// not an overlap, but they read as one blob and leave no aim margin on a
// thumb, so the fit test wants daylight rather than tangency.
const NODE_GUTTER_PX = 6;

// The node box, read from the stylesheet that draws it. These four numbers
// exist once, in `:root`, and both the CSS and this test follow them.
function nodeBox() {
  const cs = getComputedStyle(document.documentElement);
  const px = (name, fallback) => {
    const v = parseFloat(cs.getPropertyValue(name));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return {
    w: px('--map-node-max', 78), h: px('--map-node-box', 56),
    bossW: px('--map-node-boss-max', 96), bossH: px('--map-node-boss-box', 84),
  };
}

// Would the campaign placement put two node buttons on top of each other on a
// surface this size? Percent positions are node CENTRES (the stylesheet
// translates each button by -50%,-50%), so each box is centred on its point.
// Exported for the gate, which asserts it agrees with the rendered DOM.
export function campaignFits(campaign, nodes, byCol, cols, w, h, box) {
  if (!campaign || !(w > 0) || !(h > 0)) return false;
  const b = box || nodeBox();
  const maxCol = cols - 1;
  const rects = nodes.map(n => {
    const p = campaignPlace(campaign, n.col, maxCol, n.row, byCol[n.col].length);
    const bw = (n.kind === 'siege' ? b.bossW : b.w) + NODE_GUTTER_PX;
    const bh = (n.kind === 'siege' ? b.bossH : b.h) + NODE_GUTTER_PX;
    return { cx: (p.x / 100) * w, cy: (p.y / 100) * h, hw: bw / 2, hh: bh / 2 };
  });
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], c = rects[j];
      if (Math.abs(a.cx - c.cx) < a.hw + c.hw && Math.abs(a.cy - c.cy) < a.hh + c.hh) return false;
    }
  }
  return true;
}

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
  // Observe the SCREEN, not the stage. `#screen-map` is inset:0 — its size is
  // the viewport's and nothing this module writes can change it, so a re-render
  // from inside the callback cannot feed back into another notification. The
  // observer is created once per open and outlives every re-render, which is
  // why `bindEdges` no longer re-subscribes.
  if (!resizeObs) {
    resizeObs = new ResizeObserver(() => onSurfaceChange());
    resizeObs.observe(el);
  }
}

export function hideMapScreen() {
  const el = $('screen-map');
  el.classList.add('hidden');
  el.classList.remove('has-atlas');
  el.style.backgroundImage = '';
  lastDigest = '';
  lastState = null;
  lastCampaignFit = null;
  if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
}

// A resize changes whether the campaign placement still fits. When the answer
// flips — a phone rotating, a desktop window dragged narrow — the screen has to
// be rebuilt in the other layout; when it does not, only the edges move.
function onSurfaceChange() {
  if (!lastState || !isMapScreenOpen()) return;
  if (campaignFitNow(lastState) !== lastCampaignFit) renderMap(lastState);
  else repaintEdges();
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

// The three things every render and every fit test derive from one state.
function shapeOf(state) {
  const { layout } = state;
  const cols = Math.max(...layout.nodes.map(n => n.col)) + 1;
  const byCol = Array.from({ length: cols }, () => []);
  for (const n of layout.nodes) byCol[n.col].push(n);
  const geo = geoFor(state.regionIndex);
  return { layout, cols, byCol, geo, campaign: (geo && geo.regionMap && geo.campaign) || null };
}

function campaignFitNow(state, shape) {
  const { layout, cols, byCol, campaign } = shape || shapeOf(state);
  if (!campaign) return false;
  const r = $('screen-map').getBoundingClientRect();
  return campaignFits(campaign, layout.nodes, byCol, cols, r.width, r.height);
}

function renderMap(state) {
  const el = $('screen-map');
  const shape = shapeOf(state);
  const { layout, cols, byCol, geo, campaign } = shape;
  lastDigest = JSON.stringify([state.current, state.visited, state.reachable,
    state.vote && [state.vote.nodeId, Math.ceil(state.vote.t * 10)], state.onShop, state.regionIndex]);
  const visited = new Set(state.visited);
  const reachable = new Set(state.reachable);
  // The plate and the trail are one decision: the atlas styling turns nodes
  // into absolutely-placed pins, so it may only be worn by a surface the
  // placement actually fits. Below that this is the pre-atlas screen exactly.
  const useCampaign = !!campaign && campaignFitNow(state, shape);
  lastState = state;
  lastCampaignFit = useCampaign;
  if (useCampaign) {
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

  if (useCampaign) {
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
  // Edges read the buttons' real boxes, so they are painted after layout.
  requestAnimationFrame(repaintEdges);
}

// Repaint the edge underlay from whatever is currently on screen. Reads the
// live DOM rather than a closure, so a resize repaints the render that is
// actually up instead of the one that was up when it was bound.
function repaintEdges() {
  if (!lastState || !isMapScreenOpen()) return;
  const el = $('screen-map');
  const host = el.querySelector('#map-stage') || el.querySelector('#map-flow');
  const svg = el.querySelector('#map-edges');
  if (!host || !svg) return;
  const { layout, campaign } = shapeOf(lastState);
  drawEdges(host, svg, layout, new Set(lastState.visited), new Set(lastState.reachable),
    lastState, lastCampaignFit ? campaign : null);
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
