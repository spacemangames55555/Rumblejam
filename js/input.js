// Keyboard input → {moveX, moveY, interact}. WASD + arrows; E latches until
// consumed by the sim (so a tap isn't lost between input samples). When the
// floating touch joystick is engaged it overrides the movement vector; the
// on-screen contextual button feeds the same interact latch as the E key.

import { getTouchMove, touchEnabled } from './touch.js';

const keys = new Set();
let interactLatch = false;
const debugPressed = new Set(); // F1-F6 single-fire

export function initInput() {
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyE') interactLatch = true;
    if (/^F[1-6]$/.test(e.code)) { debugPressed.add(e.code); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}

export function sampleInput() {
  let mx = 0, my = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
  if (mx && my) { const s = Math.SQRT1_2; mx *= s; my *= s; }
  const joy = getTouchMove();
  if (joy.active && touchEnabled()) { mx = joy.mx; my = joy.my; }
  const interact = interactLatch;
  interactLatch = false;
  return { mx, my, interact };
}

// on-screen contextual button → same latch as the E key
export function pressInteract() { interactLatch = true; }

export function takeDebugKey() {
  for (const k of debugPressed) { debugPressed.delete(k); return k; }
  return null;
}
