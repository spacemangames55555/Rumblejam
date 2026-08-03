// THE SPRITE LAYER — a manifest-driven image registry and one draw helper.
//
// This module is purely cosmetic. Every entity in the game keeps the
// Canvas-primitive draw it has always had; `drawSprite()` is an addition that
// returns true when it painted a sprite and false when it did not, and every
// call site falls back to its primitive on false:
//
//   if (!drawSprite(ctx, e.spriteId, e.x, e.y, { rot: e.angle })) {
//     drawGruntPrimitive(ctx, e);   // existing code, unchanged
//   }
//
// With no art on disk at all — the state this file ships in — every call
// returns false and the game looks exactly as it did before. A missing asset
// is a normal, expected state, never an error path: the manifest itself is the
// art inventory, listing every id the game will ever ask for, and the files
// arrive later, one at a time.
//
// Nothing here is simulation. Animation frames are derived from
// performance.now(), are client-local, and never touch a snapshot, an entity,
// or the wire. Two clients may be on different frames of the same walk cycle;
// that is fine and intended.
//
// All paths are relative with no leading slash, because the game is served
// from a project subpath on GitHub Pages (…/Rumblejam/).

// ---------------- debug flags ----------------
//
//   ?sprites=off     force every fallback — the pre-sprite renderer, exactly
//   ?sprites=debug   log every missing id once, and outline a magenta box
//                    wherever a sprite was requested but absent
//
// Read once, at module load. `off` short-circuits before anything else runs.
function readMode() {
  try {
    const v = new URLSearchParams(location.search).get('sprites');
    if (v === 'off' || v === 'debug') return v;
  } catch { /* non-browser (headless harnesses): default */ }
  return 'on';
}
export const SPRITE_MODE = readMode();

// The eight id namespaces. An id outside them is a typo, not a new category —
// the loader drops it loudly rather than silently registering something no
// call site will ever ask for.
export const SPRITE_NAMESPACES = ['char', 'enemy', 'boss', 'proj', 'fx', 'item', 'prop', 'ui'];
const NS_RE = new RegExp(`^(${SPRITE_NAMESPACES.join('|')})\\.[a-z0-9_]+$`);

const DEFAULT_BASE = 'assets/sprites/';
const DEFAULT_FPS = 8;
const DEFAULT_FRAMES = 1;
const DEFAULT_ANCHOR = 'center';

// registry: id -> { img, w, h, frames, fps, anchor, file }
// `img` is null while loading and stays null forever if the file is not there.
const registry = new Map();
const missing = new Set();
let loadPromise = null;
let warnedManifest = false;

// Strip any leading slash so a hand-edited manifest cannot break the Pages
// deploy, and collapse '..' so a manifest can only reach inside the site.
function relPath(p) {
  return String(p || '').replace(/^\/+/, '').replace(/\.\.\//g, '');
}

// One Image per unique file, however many sprite ids point at it.
const fileCache = new Map();
function loadImage(url) {
  if (fileCache.has(url)) return fileCache.get(url);
  const p = new Promise(resolve => {
    if (typeof Image === 'undefined') { resolve(null); return; }   // headless
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);   // absent art is normal — never reject
    img.src = url;
  });
  fileCache.set(url, p);
  return p;
}

export const Assets = {
  ready: false,
  missing,
  basePath: DEFAULT_BASE,
  version: 0,

  // Resolves when every image referenced by the manifest has settled — loaded
  // or failed. NEVER rejects. A missing manifest resolves with an empty
  // registry after one console line.
  load(manifestUrl = 'assets/assets.json') {
    if (loadPromise) return loadPromise;
    if (SPRITE_MODE === 'off') {
      Assets.ready = true;
      loadPromise = Promise.resolve();
      return loadPromise;
    }
    loadPromise = (async () => {
      let man = null;
      try {
        const res = await fetch(relPath(manifestUrl), { cache: 'no-cache' });
        if (res.ok) man = await res.json();
        else if (!warnedManifest) { warnedManifest = true; console.log(`[sprites] no manifest at ${manifestUrl} (${res.status}) — running on primitives`); }
      } catch (err) {
        if (!warnedManifest) { warnedManifest = true; console.log(`[sprites] manifest unreadable (${err && err.message}) — running on primitives`); }
      }
      if (!man || typeof man !== 'object' || !man.sprites) { Assets.ready = true; return; }

      Assets.version = man.version || 0;
      Assets.basePath = relPath(man.basePath || DEFAULT_BASE);
      const jobs = [];
      for (const [id, spec] of Object.entries(man.sprites)) {
        if (!NS_RE.test(id)) { console.warn(`[sprites] ignoring "${id}" — not one of ${SPRITE_NAMESPACES.join('/')}.<name>`); continue; }
        if (!spec || !spec.file) { console.warn(`[sprites] ignoring "${id}" — no file`); continue; }
        const entry = {
          img: null,
          file: Assets.basePath + relPath(spec.file),
          w: spec.w > 0 ? spec.w : 16,
          h: spec.h > 0 ? spec.h : 16,
          frames: spec.frames > 0 ? spec.frames | 0 : DEFAULT_FRAMES,
          fps: spec.fps > 0 ? spec.fps : DEFAULT_FPS,
          anchor: spec.anchor === 'bottom' ? 'bottom' : DEFAULT_ANCHOR,
        };
        registry.set(id, entry);
        jobs.push(loadImage(entry.file).then(img => {
          if (!img) { missing.add(id); return; }
          // Self-heal a manifest that promises more frames than the strip
          // actually holds: drawing frame 3 of a one-frame sheet reads outside
          // the image and paints nothing, which looks like a flicker bug
          // rather than the bookkeeping mistake it is.
          const have = Math.max(1, Math.floor(img.width / entry.w));
          if (entry.frames > have) {
            console.warn(`[sprites] ${id}: manifest says ${entry.frames} frames, ${entry.file} holds ${have} — using ${have}`);
            entry.frames = have;
          }
          entry.img = img;
        }));
      }
      await Promise.all(jobs);
      Assets.ready = true;
      if (missing.size) {
        // One line, at info level. Art landing incrementally means this list is
        // long and shrinking, which is the normal state of the project — it is
        // not a warning and it is definitely not an error.
        console.log(`[sprites] ${registry.size - missing.size}/${registry.size} loaded, ${missing.size} still to be drawn`);
        if (SPRITE_MODE === 'debug') console.log('[sprites] missing:', [...missing].sort().join(' '));
      } else if (registry.size) {
        console.log(`[sprites] ${registry.size}/${registry.size} loaded`);
      }
    })();
    return loadPromise;
  },

  // The drawable record, or null when there is no art for this id — because
  // the file is absent, because the id is not in the manifest, or because
  // sprites are switched off.
  get(id) {
    if (SPRITE_MODE === 'off') return null;
    const e = registry.get(id);
    return e && e.img ? e : null;
  },

  // What the manifest SAYS an id is, whether or not the file exists. Used by
  // the debug outline, which has to size a box for art that is not there yet.
  declared(id) { return registry.get(id) || null; },

  ids() { return [...registry.keys()]; },
  size() { return registry.size; },
};

// ---------------- the draw helper ----------------

// Sprite sheets are single horizontal strips: frame N lives at x = N * w.
function frameOf(s, frame) {
  if (s.frames <= 1) return 0;
  const f = frame === undefined || frame === null
    ? Math.floor(performance.now() / 1000 * s.fps)
    : Math.floor(frame);
  return ((f % s.frames) + s.frames) % s.frames;
}

// Paint `id` at world position (x, y). Returns true if it drew, false if the
// caller should fall back to its primitive.
//
// opts: { rot, scale, flipX, frame, alpha }
export function drawSprite(ctx, id, x, y, opts) {
  if (SPRITE_MODE === 'off' || !id) return false;
  const s = Assets.get(id);
  if (!s) {
    if (SPRITE_MODE === 'debug') debugBox(ctx, id, x, y);
    return false;
  }
  const rot = (opts && opts.rot) || 0;
  const scale = opts && opts.scale !== undefined ? opts.scale : 1;
  const flipX = !!(opts && opts.flipX);
  const alpha = opts && opts.alpha !== undefined ? opts.alpha : 1;
  const w = s.w, h = s.h;
  const sx = frameOf(s, opts && opts.frame) * w;
  const ay = s.anchor === 'bottom' ? h : h / 2;

  // Fast path: the overwhelmingly common case is an unrotated, unscaled,
  // opaque sprite. save()/restore() around every one of a few hundred entities
  // is real cost for nothing, so skip the whole transform stack.
  if (rot === 0 && !flipX && scale === 1 && alpha === 1) {
    ctx.drawImage(s.img, sx, 0, w, h, x - w / 2, y - ay, w, h);
    return true;
  }

  ctx.save();
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (scale !== 1 || flipX) ctx.scale(scale * (flipX ? -1 : 1), scale);
  ctx.drawImage(s.img, sx, 0, w, h, -w / 2, -ay, w, h);
  ctx.restore();
  return true;
}

// ?sprites=debug — a magenta outline exactly where art is expected, sized from
// the manifest when it knows, so a half-finished sheet is obvious on screen.
const debugSeen = new Set();
function debugBox(ctx, id, x, y) {
  const d = Assets.declared(id);
  const w = d ? d.w : 32, h = d ? d.h : 32;
  const ay = d && d.anchor === 'bottom' ? h : h / 2;
  if (!debugSeen.has(id)) { debugSeen.add(id); console.log(`[sprites] missing at draw time: ${id}`); }
  ctx.save();
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(x - w / 2, y - ay, w, h);
  ctx.restore();
}

// How much to scale a sprite so it covers `targetPx` across. Entities size
// themselves in world units (an enemy radius, a boss radius), and the art is
// authored at the canonical sizes in §6 — this is the bridge. Returns 1 when
// there is no art, which the caller never uses.
export function spriteScaleFor(id, targetPx) {
  const s = Assets.get(id);
  if (!s || !s.w) return 1;
  return targetPx / s.w;
}
