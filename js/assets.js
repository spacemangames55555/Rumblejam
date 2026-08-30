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
//   ?spritescale=N   paint every sprite N times larger (see below)
//   ?playerscale=N   paint player sprites N times larger
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

// ---------------- live size tuning ----------------
//
//   ?spritescale=N   multiply EVERY sprite's painted size by N
//   ?playerscale=N   multiply player sprites only — they compose, so
//                    ?spritescale=1.2&playerscale=1.5 paints a player at 1.8x
//                    and everything else at 1.2x
//
// This exists so the right size can be found BY EYE, in a real arena, at a real
// viewport, instead of by argument over a number in a manifest. It is the same
// cosmetic multiplier the manifest carries and it obeys the same rule: painted
// size only. No radius, no hitbox, no collision, nothing on the wire. Two
// clients with different flags disagree about how big a druid looks and agree
// exactly about where he is and what he hits.
//
// Read once, at module load, like SPRITE_MODE. Absent means 1, so a URL with
// neither flag is bit-identical to one from before they existed.
//
// "Player sprites" means the `char.` namespace, which is exactly the character
// sheets — both rosters, and the decoy ghost that borrows one. Enemies, bosses,
// props and icons live in their own namespaces and are untouched by
// ?playerscale.
const MAX_TUNE = 8;
function readScaleFlag(name) {
  let v = null;
  try { v = new URLSearchParams(location.search).get(name); }
  catch { return 1; }                       // non-browser (headless harnesses)
  if (v === null || v === '') return 1;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_TUNE) {
    console.warn(`[sprites] ?${name}=${v} is not a positive number <= ${MAX_TUNE} — ignoring it and painting at 1`);
    return 1;
  }
  return n;
}
export const SPRITE_SCALE = readScaleFlag('spritescale');
export const PLAYER_SCALE = readScaleFlag('playerscale');
// Folded once, here, rather than two multiplies at every draw site.
const TUNE_ALL = SPRITE_SCALE;
const TUNE_PLAYER = SPRITE_SCALE * PLAYER_SCALE;
if (TUNE_ALL !== 1 || TUNE_PLAYER !== 1) {
  console.log(`[sprites] size tuning active — all sprites x${TUNE_ALL}, player sprites x${TUNE_PLAYER}. Cosmetic only: hitboxes, collision and the wire are unchanged.`);
}

// THE LOADER'S NAMESPACE WHITELIST. An id outside it is a typo, not a new
// category — the loader drops it loudly rather than silently registering
// something no call site will ever ask for.
//
// This list is separate from the one tools/gen_assets_manifest.mjs works from,
// and they must agree. They drifted once: `beast` was added to the generator
// and to the sim gate and NOT here, so beast.bear was written into the manifest
// and then ignored at load. Nothing caught it, because with no file on disk yet
// the symptom — "no sprite, draw the primitive" — was also the correct
// behaviour, and it only surfaced when real art landed and did not appear.
// tools/sim_test.mjs now asserts the two lists agree.
export const SPRITE_NAMESPACES = ['char', 'enemy', 'boss', 'proj', 'fx', 'item', 'prop', 'ui', 'beast', 'tile'];
const NS_RE = new RegExp(`^(${SPRITE_NAMESPACES.join('|')})\\.[a-z0-9_]+$`);

const DEFAULT_BASE = 'assets/sprites/';
const DEFAULT_FPS = 8;
const DEFAULT_FRAMES = 1;
const DEFAULT_ANCHOR = 'center';

// ---------------- the cosmetic size multiplier ----------------
//
// `scale` in the manifest multiplies how large a sprite is PAINTED and nothing
// else. It is not a radius, not a hitbox, not a collision size, and it is not
// on the wire — two clients with different manifests would disagree about how
// big a druid looks and agree exactly about where he is and what he hits.
//
// It exists because art arrives at whatever size its author drew it, and a
// figure that reads small next to the rest of the roster is a LOOK problem. The
// tempting fix — nudge the entity's radius until the art looks right — is a
// simulation change: radius is hitbox, is collision, is knockback distance, is
// how far a melee swing reaches. This key is the version of that fix that
// cannot touch any of them.
//
// Absent means 1, so every sprite that does not opt in is bit-identical to
// before this key existed, fast path included.
const DEFAULT_SCALE = 1;
// A typo'd 15 where 1.5 was meant would paint one sprite across the whole
// arena and look like a renderer bug rather than a bad number. Refuse it out
// loud, and draw at 1 — the same "a silently wrong sprite is worse than no
// sprite" rule the grid validation follows. Exported, with the check itself,
// so the harnesses can test the real rule instead of a copy of it.
export const MAX_SCALE = 8;

// ---------------- content normalisation ----------------
//
// A sheet's figure fills whatever fraction of its cell the artist or the
// generator happened to leave it. Measured across the sheets on hand that
// fraction ran from 75% to 97% of cell height — a 1.29x spread in apparent size
// for the same `scale` value, from art produced by ONE generator on ONE prompt
// family. Left uncorrected, every unit needs its own hand-calibration and the
// number in the manifest means nothing you can compare between characters.
//
// So the manifest records `content: [w, h]` — the opaque bounds of the tallest
// cell, MEASURED at install by tools/process_sprite.mjs, never typed — and the
// loader divides it out:
//
//   fit = h / content[1]
//
// HEIGHT, not width, and not area. A character's height is what reads as its
// size; widths legitimately differ between a cloaked figure and a spear-carrier,
// and normalising those to each other would squash the difference the art is
// making on purpose. Normalising on the wrong axis is the same class of mistake
// as scaling the cell instead of the figure, which is what this fixes.
//
// With it, `scale: 1` means one concrete art-independent thing — THIS SPRITE'S
// SILHOUETTE IS EXACTLY AS TALL AS THE ENTITY'S DIAMETER — and any other value
// is a deliberate design choice about that character rather than a correction
// for how its PNG was cropped.
//
// Absent means fit 1, which is the old behaviour exactly. That fallback is also
// the way this regresses silently, so it is announced: see contentWarning().
// Exported so the harnesses can test the real rule rather than a copy of it,
// the same reason manifestScale is.
export function contentFit(id, content, cellH) {
  if (content === undefined || content === null) return 1;
  const h = Array.isArray(content) ? Number(content[1]) : NaN;
  if (!Number.isFinite(h) || h <= 0 || h > cellH) {
    console.warn(`[sprites] ${id}: content ${JSON.stringify(content)} is not [w, h] with 0 < h <= ${cellH} — normalising on the cell instead, so this sprite's size depends on its padding`);
    return 1;
  }
  return cellH / h;
}

export function manifestScale(id, v) {
  if (v === undefined || v === null) return DEFAULT_SCALE;
  const n = +v;
  if (!Number.isFinite(n) || n <= 0 || n > MAX_SCALE) {
    console.warn(`[sprites] ${id}: scale ${JSON.stringify(v)} is not a positive number <= ${MAX_SCALE} — painting at ${DEFAULT_SCALE}`);
    return DEFAULT_SCALE;
  }
  return n;
}

// ---------------- directions ----------------
//
// A sprite with `directions > 1` is a GRID, not a strip: rows are facings,
// columns are animation frames, and the cell for (frame, dir) sits at
// (frame * w, dir * h). Row order is fixed and starts at screen-space east,
// then goes clockwise — canvas Y points down, so clockwise on screen is
// increasing angle, and the row index falls straight out of atan2 with no
// offset term:
//
//   0 E    1 SE    2 S    3 SW    4 W    5 NW    6 N    7 NE
//
// For `directions: 4` the same rule yields E, S, W, N.
//
// A directional sprite is NEVER rotated and never mirrored. The row is the
// facing; rotating it as well would rotate the art's internal up-vector.
const TAU = Math.PI * 2;
export const DIRECTION_ROWS_8 = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
export const DIRECTION_ROWS_4 = ['E', 'S', 'W', 'N'];

// South — facing the camera. What a unit shows before it has ever moved, so
// an idle arena does not snap east on the first frame.
export const DEFAULT_FACING = Math.PI / 2;

// The row for an angle. Total: any finite angle, any winding, any sign.
export function dirIndex(angle, directions) {
  if (!(directions > 1)) return 0;
  if (!Number.isFinite(angle)) return dirIndex(DEFAULT_FACING, directions);
  const step = TAU / directions;
  return ((Math.round(angle / step) % directions) + directions) % directions;
}

// Spread animation phase across entities so forty grunts do not breathe in
// lockstep. A stable integer hash of the entity id — offset only, no state.
function phaseOf(seed) {
  if (!seed) return 0;
  let h = Math.imul(seed | 0, 2654435761) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

// registry: id -> { img, w, h, frames, fps, anchor, scale, file }
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

// Where a manifest entry's file actually lives. Almost everything sits under
// the manifest's basePath (assets/sprites/) and gives a path relative to it.
// Floor tiles do not — they live at assets/tiles/<biome>/ — so an entry whose
// file is already rooted at 'assets/' is taken as written.
//
// This is a path rule, deliberately NOT a second loader: tiles go through the
// same registry, the same loadImage(), the same structural checks and the same
// missing-art bookkeeping as every sheet. One image path, two directories.
function assetUrl(file) {
  const rel = relPath(file);
  return rel.startsWith('assets/') ? rel : Assets.basePath + rel;
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

// Did anything at all survive the decode? A PNG can load cleanly and still be
// entirely transparent — a failed export, a wrong layer, a blank canvas — and
// as a floor tile that reads as a hole in the world rather than as missing art.
// Guarded for headless harnesses, which have neither Image nor canvas; there
// the check is skipped and tools/readability_check.mjs does it offline instead.
function isBlank(img) {
  try {
    if (typeof document === 'undefined') return false;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return false;
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) return false;
    return true;
  } catch { return false; }   // tainted canvas or no 2d context: not a verdict
}

// A sheet that loaded WITHOUT `content` falls back to fit 1 and is sized by its
// padding again — the exact bug content normalisation exists to remove, back
// with no symptom except a character that looks a bit off next to the others.
//
// That is the same shape as a stale loader meeting a newer manifest: two halves
// disagreeing, a wrong picture, and zero diagnostics. So it says so. Named ids,
// once, at load, listing what to run to fix it.
export const missingContent = new Set();
function contentWarning() {
  missingContent.clear();
  for (const [id, e] of registry) if (e.img && !e.content) missingContent.add(id);
  if (!missingContent.size) return;
  const ids = [...missingContent].sort();
  console.warn(`[sprites] ${ids.length} loaded sheet(s) have no "content" and are normalised on the CELL, so their apparent size depends on how their PNG was padded: `
    + `${ids.join(' ')} — fix with: node tools/process_sprite.mjs --record-content <id>`);
}

export const Assets = {
  ready: false,
  missing,
  missingContent,
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
          file: assetUrl(spec.file),
          w: spec.w > 0 ? spec.w : 16,
          h: spec.h > 0 ? spec.h : 16,
          frames: spec.frames > 0 ? spec.frames | 0 : DEFAULT_FRAMES,
          fps: spec.fps > 0 ? spec.fps : DEFAULT_FPS,
          anchor: spec.anchor === 'bottom' ? 'bottom' : DEFAULT_ANCHOR,
          directions: spec.directions > 1 ? spec.directions | 0 : 1,
          scale: manifestScale(id, spec.scale),
          content: Array.isArray(spec.content) ? spec.content : null,
          strict: !!spec.strict,         // exact dimensions + non-empty (floor tiles)
          fit: 1,                        // set below, once the cell height is known
          // which tuning flag this id answers to, decided once at load
          player: id.startsWith('char.'),
        };
        entry.fit = contentFit(id, spec.content, entry.h);
        registry.set(id, entry);
        jobs.push(loadImage(entry.file).then(img => {
          if (!img) { missing.add(id); return; }
          if (entry.directions > 1) {
            // A directional grid is validated STRICTLY and rejected on
            // mismatch. Every other kind of error here shows up as a visible
            // glitch you can chase; a grid off by one row shows up as units
            // facing subtly wrong, which reads as "the art is a bit off"
            // and can survive a whole playtest. A silently wrong grid is
            // worse than no sprite, so a wrong one is simply no sprite.
            const wantW = entry.w * entry.frames, wantH = entry.h * entry.directions;
            if (img.width !== wantW || img.height !== wantH) {
              console.warn(`[sprites] ${id}: grid must be exactly ${wantW}x${wantH} `
                + `(${entry.frames} frame(s) across x ${entry.directions} direction(s) down), `
                + `but ${entry.file} is ${img.width}x${img.height} — falling back to the primitive`);
              missing.add(id);
              return;
            }
          } else if (entry.strict) {
            // A floor tile is tiled edge to edge across the whole room, so a
            // wrong size is not "slightly off" — it is a seam or an overlap on
            // every cell, everywhere, for the whole level. Checked exactly, and
            // the offending path is named, because "the floor looks wrong" is
            // not something you can chase back to one PNG by eye.
            const wantW = entry.w * entry.frames;
            if (img.width !== wantW || img.height !== entry.h) {
              console.warn(`[sprites] ${id}: tile must be exactly ${wantW}x${entry.h}, but ${entry.file} is ${img.width}x${img.height} — dropping it`);
              missing.add(id);
              return;
            }
            if (isBlank(img)) {
              console.warn(`[sprites] ${id}: ${entry.file} decoded but is fully transparent — dropping it`);
              missing.add(id);
              return;
            }
          } else {
            // Non-directional strips keep the lenient behaviour they shipped
            // with: clamp to what is really there rather than drawing blank
            // frames off the end of the image.
            const have = Math.max(1, Math.floor(img.width / entry.w));
            if (entry.frames > have) {
              console.warn(`[sprites] ${id}: manifest says ${entry.frames} frames, ${entry.file} holds ${have} — using ${have}`);
              entry.frames = have;
            }
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
      contentWarning();
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

// ---------------- owner tinting ----------------
//
// A minion is drawn in its OWNER's colour so a four-Necromancer party can tell
// whose skeleton is whose (see MINION_ART in js/render.js). Giving it a sprite
// would throw that signal away, so the sprite carries the colour instead.
//
// THE SHEET IS TINTED ONCE PER COLOUR, NOT ONCE PER DRAW. `source-atop` needs
// its own canvas — composited onto the live context it would tint whatever is
// already painted under the sprite as well — and a scratch canvas per entity
// per frame is real cost for ten skeletons times eight players. Tinting the
// whole sheet once and caching it is the same picture for one composite per
// colour for the life of the run.
//
// Returns null on a headless harness or a tainted canvas, and the caller then
// draws the sprite untinted: losing the owner tint is a worse picture, losing
// the sprite is a missing one.
const tintCache = new Map();
function tintedSheet(s, color, strength) {
  const key = `${s.file}|${color}|${strength}`;
  if (tintCache.has(key)) return tintCache.get(key);
  let out = null;
  try {
    if (typeof document !== 'undefined') {
      const cv = document.createElement('canvas');
      cv.width = s.img.width; cv.height = s.img.height;
      const g = cv.getContext('2d');
      if (g) {
        g.drawImage(s.img, 0, 0);
        g.globalCompositeOperation = 'source-atop';   // paints only where the art already is
        g.globalAlpha = strength;
        g.fillStyle = color;
        g.fillRect(0, 0, cv.width, cv.height);
        out = cv;
      }
    }
  } catch { out = null; }
  tintCache.set(key, out);
  return out;
}

// ---------------- the draw helper ----------------

// Frame column. A sheet is a horizontal strip of frames; a directional sheet
// is that strip repeated down the rows, one row per facing.
function frameOf(s, frame, seed) {
  if (s.frames <= 1) return 0;
  const f = frame === undefined || frame === null
    ? Math.floor(performance.now() / 1000 * s.fps) + phaseOf(seed)
    : Math.floor(frame);
  return ((f % s.frames) + s.frames) % s.frames;
}

// Paint `id` at world position (x, y). Returns true if it drew, false if the
// caller should fall back to its primitive.
//
// opts: { rot, facing, scale, flipX, frame, alpha, seed }
//
// Two modes, chosen by the manifest, not the caller:
//
//   directions <= 1  the sprite is ROTATED by `rot` and mirrored by `flipX`,
//                    exactly as it always has been. Correct for projectiles,
//                    which genuinely point along their velocity, and for
//                    props, which mostly pass rot 0.
//   directions > 1   the sprite is DIRECTIONAL: `facing` (or `rot`, so the
//                    documented `{ rot: e.angle }` call works unchanged)
//                    selects a row, and the sprite is neither rotated nor
//                    mirrored — the row already encodes the facing, and doing
//                    both would turn the art's own up-vector.
//
// `facing` exists so a unit can hand over its heading without that heading
// rotating a single-direction sheet: units pass `facing`, projectiles pass
// `rot`, and a `directions: 1` entry behaves precisely as it did before
// directional support existed.
//
// `opts.scale` is the caller's sizing — normally spriteScaleFor(), which maps
// the entity's world size onto the sheet. The manifest's own `scale` and the
// ?spritescale / ?playerscale URL flags are separate cosmetic multipliers
// composed on top of it below; the caller neither knows nor needs to know that
// a given sprite carries any of them.
export function drawSprite(ctx, id, x, y, opts) {
  if (SPRITE_MODE === 'off' || !id) return false;
  const s = Assets.get(id);
  if (!s) {
    if (SPRITE_MODE === 'debug') debugBox(ctx, id, x, y);
    return false;
  }
  const callerScale = opts && opts.scale !== undefined ? opts.scale : 1;
  const alpha = opts && opts.alpha !== undefined ? opts.alpha : 1;
  const w = s.w, h = s.h;
  const directional = s.directions > 1;

  let rot = 0, flipX = false, row = 0;
  if (directional) {
    let face = DEFAULT_FACING;
    if (opts) {
      if (opts.facing !== undefined && opts.facing !== null) face = opts.facing;
      else if (opts.rot !== undefined && opts.rot !== null) face = opts.rot;
    }
    row = dirIndex(face, s.directions);
  } else {
    rot = (opts && opts.rot) || 0;
    flipX = !!(opts && opts.flipX);
  }
  const sx = frameOf(s, opts && opts.frame, opts && opts.seed) * w;
  const sy = row * h;
  const ay = s.anchor === 'bottom' ? h : h / 2;

  // Everything that sizes this sprite, composed on top of what the caller asked
  // for — AFTER the row and the frame are chosen, because these change the size
  // the cell is painted at and never which cell. Anchoring is unaffected in
  // kind: a centred sprite still grows about the entity's centre and a
  // bottom-anchored one still grows upward from its feet, because the scale is
  // applied around the same origin the draw already used.
  //
  //   s.fit    divides out the sheet's padding so `scale` is comparable
  //            between characters. 1 when the sheet has no `content`.
  //   s.scale  the deliberate per-character size choice.
  //   TUNE_*   the ?spritescale / ?playerscale flags, 1 unless on the URL.
  const scale = callerScale * s.fit * s.scale * (s.player ? TUNE_PLAYER : TUNE_ALL);

  // The tint changes WHICH image is sampled, never the cell, the transform or
  // the fast-path test — so a tinted sprite stays on whichever path it earned.
  const img = (opts && opts.tint && tintedSheet(s, opts.tint, opts.tintStrength ?? 0.35)) || s.img;

  // Fast path: an unrotated, unscaled, opaque sprite. save()/restore() around
  // every one of a few hundred entities is real cost for nothing. Every
  // directional sprite qualifies on the rotation half of the test by
  // construction, so the directional path is the cheaper of the two.
  //
  // A manifest `scale` other than 1 takes the sprite OFF this path, by
  // construction — it is a real transform and there is no way to express it in
  // a bare drawImage. That is the cost of the key and it is per-sprite, not
  // global: an entry without `scale` composes to exactly 1 and stays on the
  // fast path, bit-identical to before the key existed.
  if (rot === 0 && !flipX && scale === 1 && alpha === 1) {
    ctx.drawImage(img, sx, sy, w, h, x - w / 2, y - ay, w, h);
    if (directional && SPRITE_MODE === 'debug') debugDir(ctx, row, s, x, y);
    return true;
  }

  ctx.save();
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (scale !== 1 || flipX) ctx.scale(scale * (flipX ? -1 : 1), scale);
  ctx.drawImage(img, sx, sy, w, h, -w / 2, -ay, w, h);
  ctx.restore();
  if (directional && SPRITE_MODE === 'debug') debugDir(ctx, row, s, x, y);
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

// ?sprites=debug — the resolved row, printed on the unit. The two ways a
// direction grid goes wrong are an off-by-one and a mirrored row order, and
// both look ALMOST right in motion: units face subtly wrong and nobody can
// say why. A number on screen turns that into a five-second check.
function debugDir(ctx, row, s, x, y) {
  const rows = s.directions === 4 ? DIRECTION_ROWS_4 : DIRECTION_ROWS_8;
  ctx.save();
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ff00ff';
  ctx.strokeStyle = '#0b0c12';
  ctx.lineWidth = 3;
  const label = `${row}${rows[row] ? ' ' + rows[row] : ''}`;
  const ty = y - (s.anchor === 'bottom' ? s.h : s.h / 2) - 3;
  ctx.strokeText(label, x, ty);
  ctx.fillText(label, x, ty);
  ctx.restore();
}

// How much to scale a sprite so it covers `targetPx` across. Entities size
// themselves in world units (an enemy radius, a boss radius), and the art is
// authored at the canonical sizes in §6 — this is the bridge. Returns 1 when
// there is no art, which the caller never uses.
//
// This deliberately does NOT fold in the manifest's cosmetic `scale`. Callers
// pass the result straight to drawSprite, which composes the two; applying it
// here as well would square it, and a 1.5 would silently become 2.25.
export function spriteScaleFor(id, targetPx) {
  const s = Assets.get(id);
  if (!s || !s.w) return 1;
  return targetPx / s.w;
}
