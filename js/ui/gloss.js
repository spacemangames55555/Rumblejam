// Stat-glossary UI: the one mechanism that explains stats everywhere.
// - glossName(key) renders a stat name as the universal tappable/hoverable
//   term (dotted underline). Used in item stat lines, weapon scaling lists,
//   the character grid, and the sheet.
// - A single floating popover (created here) shows the glossary detail on
//   hover (desktop) or tap (everywhere). The tap handler runs in the CAPTURE
//   phase so a stat name inside a clickable card (shop offer, treasure pick,
//   character card) opens the glossary instead of triggering the card.
// - The character sheet's inline expansion is separate (see overlays.js);
//   it reuses glossDetail() so the wording is identical.

import { STAT_GLOSS } from '../content/glossary.js';
import { STAT_NAME, STAT_KEYS } from '../config.js';

// tiny local escaper — screens.js exports one, but importing it here would
// create a screens↔gloss cycle
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function glossShort(key) { return STAT_GLOSS[key] ? STAT_GLOSS[key].short : ''; }
export function glossDetail(key) { return STAT_GLOSS[key] ? STAT_GLOSS[key].detail : ''; }

// A stat name as an interactive glossary term.
export function glossName(key) {
  const name = STAT_NAME[key] || key;
  if (!STAT_GLOSS[key]) return esc(name);
  return `<span class="gloss-term" data-gloss="${key}">${esc(name)}</span>`;
}

// Wrap every stat name that appears inside a plain-language sentence (trait
// descriptions on the character grid) as a glossary term. Escapes the text.
const NAME_TO_KEY = Object.fromEntries(STAT_KEYS.map(k => [STAT_NAME[k], k]));
const NAME_RE = new RegExp(`\\b(${STAT_KEYS.map(k => STAT_NAME[k]).join('|')})\\b`, 'g');
export function glossify(text) {
  return esc(text).replace(NAME_RE, name => `<span class="gloss-term" data-gloss="${NAME_TO_KEY[name]}">${name}</span>`);
}

// ---------------- the floating popover ----------------

let pop = null;
let popKey = null; // key currently shown (tap on the same term closes it)

function ensurePop() {
  if (pop) return pop;
  pop = document.createElement('div');
  pop.id = 'gloss-pop';
  pop.className = 'hidden';
  document.body.appendChild(pop);
  return pop;
}

export function showGlossPop(target, key) {
  const g = STAT_GLOSS[key];
  if (!g) return;
  const el = ensurePop();
  el.innerHTML = `<b>${esc(STAT_NAME[key] || key)}</b> — ${esc(g.detail)}`;
  el.classList.remove('hidden');
  popKey = key;
  // position near the term, clamped to the viewport
  const r = target.getBoundingClientRect();
  el.style.left = '0px'; el.style.top = '0px'; // reset before measuring
  const w = Math.min(300, window.innerWidth - 16);
  el.style.width = w + 'px';
  const h = el.offsetHeight;
  let x = r.left + r.width / 2 - w / 2;
  x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
  let y = r.top - h - 8;             // prefer above the term…
  if (y < 8) y = r.bottom + 8;       // …fall below if there's no room
  y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
  el.style.left = x + 'px';
  el.style.top = y + 'px';
}

export function hideGlossPop() {
  if (pop) pop.classList.add('hidden');
  popKey = null;
}

export function isGlossPopOpen() { return !!(pop && !pop.classList.contains('hidden')); }

export function initGloss() {
  ensurePop();
  // Tap/click: CAPTURE phase, so terms inside buy/pick cards never trigger
  // the card. Any other click closes the popover (and propagates normally).
  document.addEventListener('click', e => {
    const term = e.target && e.target.closest ? e.target.closest('.gloss-term') : null;
    if (term) {
      e.stopPropagation();
      e.preventDefault();
      const key = term.dataset.gloss;
      if (isGlossPopOpen() && popKey === key) hideGlossPop();
      else showGlossPop(term, key);
      return;
    }
    hideGlossPop();
  }, true);
  // Hover: desktop only (the touch UI uses taps; emulated taps also emit
  // mouseover, which the touch-on check filters out)
  document.addEventListener('mouseover', e => {
    if (document.body.classList.contains('touch-on')) return;
    const term = e.target && e.target.closest ? e.target.closest('.gloss-term, [data-glossrow]') : null;
    if (!term) return;
    showGlossPop(term, term.dataset.gloss || term.dataset.glossrow);
  });
  document.addEventListener('mouseout', e => {
    if (document.body.classList.contains('touch-on')) return;
    const term = e.target && e.target.closest ? e.target.closest('.gloss-term, [data-glossrow]') : null;
    if (term) hideGlossPop();
  });
}
