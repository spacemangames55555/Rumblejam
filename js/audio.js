// Game SFX. Most sounds are WebAudio-synthesized; owner-added asset files
// (assets/) load through loadSample/playSample below and share the same
// master gain, so the volume slider and mute govern everything alike.
// The context is created suspended at preload time and resumed on the first
// user gesture (browser autoplay policy) — ensureAudio handles the unlock.
// Master volume persisted in localStorage.

import { CONFIG } from './config.js';

let ctx = null;
let master = null;
let volume = 0.6;
const throttle = new Map(); // sound key -> last play time (avoid 250-enemy noise walls)

try { volume = parseFloat(localStorage.getItem('uv_volume') ?? '0.6'); } catch { /* private mode */ }

export function getVolume() { return volume; }
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = volume * volume;
  try { localStorage.setItem('uv_volume', String(volume)); } catch { /* ignore */ }
}

// create the context WITHOUT a gesture (it starts suspended — that's fine for
// decoding); ensureAudio resumes it on the first real interaction as before
function initCtx() {
  if (ctx) return true;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume * volume;
  master.connect(ctx.destination);
  return true;
}

export function ensureAudio() {
  if (!initCtx()) return;
  if (ctx.state === 'suspended') ctx.resume();
}

// test/diagnostic introspection (harmless in production)
export const audioStats = { samplesLoaded: 0, horns: 0, blips: 0, hornLog: [], warnings: 0 };
export function getCtxState() { return ctx ? ctx.state : 'none'; }
export function getMasterGainValue() { return master ? master.gain.value : -1; }

// ---------------- external samples (the asset pipeline) ----------------
// loadSample(path) → decoded AudioBuffer, cached per path. playSample routes
// through the master gain like every synthesized sound. See README:
// "Adding a sound asset".

const samples = new Map(); // path -> AudioBuffer

export async function loadSample(path) {
  if (samples.has(path)) return samples.get(path);
  if (!initCtx()) throw new Error('WebAudio unavailable');
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const raw = await res.arrayBuffer();
  const buf = await ctx.decodeAudioData(raw);
  samples.set(path, buf);
  audioStats.samplesLoaded++;
  return buf;
}

export function playSample(buffer, vol = 1) {
  if (!ctx || !buffer) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g); g.connect(master);
  src.start();
}

// ---------------- the level-up airhorn ----------------
// Replaces the synth blip when the asset is present; a missing/undecodable
// asset falls back to the blip with one console warning — level-ups never
// depend on an asset existing.

let airhornBuf = null;
let hornWinStart = -Infinity; // debounce window anchor
let hornOwnPlayed = false;    // own horn: once per window
let hornAllyCount = 0;        // ally horns: capped per window (the Warband rule)

export async function preloadAirhorn() {
  try {
    airhornBuf = await loadSample(CONFIG.AIRHORN_PATH);
  } catch (err) {
    audioStats.warnings++;
    console.warn(`airhorn preload failed (${err && err.message}) — level-ups fall back to the synth blip`);
  }
}

// test hook (also lets a future skin swap the buffer)
export function setAirhornBuffer(buf) { airhornBuf = buf; }

// One horn per resolution moment, per source: within each debounce window
// your own level-ups play at most once (loud) and ally level-ups at most
// AIRHORN_ALLY_CAP times (quiet) — with 7 friends leveling at an extraction,
// the room celebrates without becoming a traffic jam. Numbers in config.
export function levelupHorn(own, nowMs = performance.now()) {
  if (nowMs - hornWinStart >= CONFIG.AIRHORN_DEBOUNCE_S * 1000) {
    hornWinStart = nowMs;
    hornOwnPlayed = false;
    hornAllyCount = 0;
  }
  if (own) {
    if (hornOwnPlayed) return;
    hornOwnPlayed = true;
  } else {
    if (hornAllyCount >= CONFIG.AIRHORN_ALLY_CAP) return;
    hornAllyCount++;
  }
  const vol = own ? CONFIG.AIRHORN_VOL_OWN : CONFIG.AIRHORN_VOL_ALLY;
  if (audioStats.hornLog.length < 50) audioStats.hornLog.push(vol);
  if (airhornBuf) {
    audioStats.horns++;
    playSample(airhornBuf, vol);
  } else {
    audioStats.blips++;
    sfx.levelup();
  }
}

function env(gain, t0, attack, peak, decay) {
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function tone({ type = 'square', f0 = 440, f1 = null, dur = 0.1, peak = 0.25, attack = 0.005, detune = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  o.detune.value = detune;
  env(g, t0, attack, peak, dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + attack + dur + 0.05);
}

function noise({ dur = 0.15, peak = 0.2, f = 800, q = 1, attack = 0.003 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, (dur + 0.1) * ctx.sampleRate) | 0;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass'; filt.frequency.value = f; filt.Q.value = q;
  const g = ctx.createGain();
  env(g, t0, attack, peak, dur);
  src.connect(filt); filt.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.1);
}

function throttled(key, ms) {
  const now = performance.now();
  const last = throttle.get(key) || 0;
  if (now - last < ms) return true;
  throttle.set(key, now);
  return false;
}

export const sfx = {
  pickup() { if (throttled('pickup', 40)) return; tone({ type: 'sine', f0: 880 + Math.random() * 300, f1: 1500, dur: 0.07, peak: 0.12 }); },
  hit() { if (throttled('hit', 50)) return; noise({ dur: 0.06, peak: 0.1, f: 1600, q: 0.8 }); },
  crit() { if (throttled('crit', 80)) return; tone({ type: 'square', f0: 500, f1: 200, dur: 0.1, peak: 0.15 }); noise({ dur: 0.08, peak: 0.12, f: 2200 }); },
  shoot() { if (throttled('shoot', 70)) return; tone({ type: 'triangle', f0: 300, f1: 120, dur: 0.05, peak: 0.06 }); },
  swing() { if (throttled('swing', 70)) return; noise({ dur: 0.07, peak: 0.05, f: 900, q: 2 }); },
  hurt() { if (throttled('hurt', 150)) return; tone({ type: 'sawtooth', f0: 220, f1: 70, dur: 0.18, peak: 0.3 }); },
  enemyDie() { if (throttled('die', 60)) return; noise({ dur: 0.12, peak: 0.12, f: 500, q: 0.7 }); tone({ type: 'triangle', f0: 300, f1: 80, dur: 0.12, peak: 0.1 }); },
  levelup() { tone({ type: 'sine', f0: 520, f1: 1040, dur: 0.25, peak: 0.25 }); setTimeout(() => tone({ type: 'sine', f0: 780, f1: 1560, dur: 0.3, peak: 0.2 }), 90); },
  buy() { tone({ type: 'sine', f0: 700, dur: 0.06, peak: 0.2 }); setTimeout(() => tone({ type: 'sine', f0: 1050, dur: 0.1, peak: 0.2 }), 60); },
  deny() { tone({ type: 'square', f0: 180, f1: 120, dur: 0.15, peak: 0.15 }); },
  reroll() { noise({ dur: 0.08, peak: 0.12, f: 3000, q: 2 }); },
  door() { tone({ type: 'triangle', f0: 240, f1: 480, dur: 0.3, peak: 0.2 }); },
  roar() { tone({ type: 'sawtooth', f0: 90, f1: 45, dur: 0.9, peak: 0.4 }); noise({ dur: 0.7, peak: 0.25, f: 220, q: 0.5 }); },
  boom() { if (throttled('boom', 90)) return; noise({ dur: 0.35, peak: 0.35, f: 180, q: 0.4 }); tone({ type: 'sine', f0: 120, f1: 40, dur: 0.3, peak: 0.3 }); },
  downed() { tone({ type: 'sawtooth', f0: 300, f1: 60, dur: 0.6, peak: 0.35 }); },
  revive() { tone({ type: 'sine', f0: 400, f1: 900, dur: 0.4, peak: 0.25 }); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone({ type: 'sine', f0: f, dur: 0.35, peak: 0.22 }), i * 130)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone({ type: 'sawtooth', f0: f, dur: 0.4, peak: 0.18 }), i * 160)); },
  click() { tone({ type: 'sine', f0: 600, dur: 0.04, peak: 0.1 }); },
};
