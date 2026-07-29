// Touch controls: a floating joystick for movement (the game's only combat
// input — weapons auto-aim) plus touch-mode detection with a user override.
// Mode 'auto' enables touch UI only on devices that report touch hardware;
// 'on'/'off' force it either way (settings panel). Desktop mouse input never
// anchors the joystick — only pointers of type 'touch' do.

const JOY_RADIUS = 64;   // CSS px — full-deflection distance
const DEADZONE = 8;      // CSS px — ignore micro-jitters

let mode = 'auto';
try { mode = localStorage.getItem('uv_touch') || 'auto'; } catch { /* private mode */ }

// single preallocated state object — handlers only mutate numbers (no GC churn)
export const joy = {
  active: false, pointerId: -1,
  anchorX: 0, anchorY: 0, curX: 0, curY: 0,
  mx: 0, my: 0,
};

function hasTouchHW() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
}

export function touchEnabled() {
  return mode === 'on' || (mode === 'auto' && hasTouchHW());
}

export function getTouchMode() { return mode; }

export function setTouchMode(m) {
  if (m !== 'auto' && m !== 'on' && m !== 'off') m = 'auto';
  mode = m;
  try { localStorage.setItem('uv_touch', m); } catch { /* ignore */ }
  applyTouchClass();
  if (!touchEnabled()) resetJoy();
}

// body.touch-on drives all touch-only CSS (rotate overlay, bigger targets)
export function applyTouchClass() {
  document.body.classList.toggle('touch-on', touchEnabled());
}

function resetJoy() {
  joy.active = false;
  joy.pointerId = -1;
  joy.mx = 0;
  joy.my = 0;
}

function updateVector() {
  let dx = joy.curX - joy.anchorX;
  let dy = joy.curY - joy.anchorY;
  const len = Math.hypot(dx, dy);
  if (len < DEADZONE) { joy.mx = 0; joy.my = 0; return; }
  const mag = Math.min(1, len / JOY_RADIUS);
  joy.mx = (dx / len) * mag;
  joy.my = (dy / len) * mag;
}

export function initTouch(canvas) {
  applyTouchClass();
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || !touchEnabled()) return;
    if (joy.active) return; // first finger owns the joystick
    joy.active = true;
    joy.pointerId = e.pointerId;
    joy.anchorX = joy.curX = e.clientX;
    joy.anchorY = joy.curY = e.clientY;
    joy.mx = joy.my = 0;
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!joy.active || e.pointerId !== joy.pointerId) return;
    joy.curX = e.clientX;
    joy.curY = e.clientY;
    updateVector();
    e.preventDefault();
  });
  const end = e => {
    if (!joy.active || e.pointerId !== joy.pointerId) return;
    resetJoy();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  // no long-press menu / selection on the game surface
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

// merged into the movement input path (keyboard wins when joystick is idle)
export function getTouchMove() {
  return joy; // read .active/.mx/.my — same object every call, zero garbage
}
