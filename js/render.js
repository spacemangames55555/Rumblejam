// Canvas renderer. Consumes a plain "view" object (built by main.js from the
// live Sim on the host, or from interpolated snapshots on clients) so the same
// draw code serves both.
//
// Every entity draws in two layers: a sprite if there is art for it, and the
// Canvas primitive it has always had if there is not. The primitives are the
// game — they are never removed, and with an empty assets/ directory this file
// behaves exactly as it did before the sprite pipeline landed. See js/assets.js.

import { CONFIG, PALETTE } from './config.js';
import { WEAPON_BY_ID } from './content/weapons.js';
import { Assets, drawSprite, spriteScaleFor, DEFAULT_FACING } from './assets.js';
import { PROP, FX, BEAST_SPRITE, MINION_SPRITE } from './content/sprites.js';
import { BIOMES, tileSpriteIds, tileVariant } from './biomes.js';
import { DOMAIN_COLOR } from './domains.js';
import { clamp, angDiff } from './util.js';
import { fxSpec, SHAPE } from './content/skillfx.js';

// Minion and soul-token presentation. Rule 14: no inline constants in
// behaviour code, and a renderer is behaviour code that happens to draw.
// Radii are per-archetype so a bear does not read as a wolf; a family missing
// from the table falls back rather than throwing, because a new archetype is
// supposed to be a data change and must not need this file edited to appear.
const MINION_ART = {
  radius: { skeleton: 9, golem: 15, risen: 10, wisp: 7, wolf: 11, bear: 15, hawk: 8 },
  // How hard the owner's colour is pushed into a minion's sprite. THE NUMBER IS
  // MEASURED AGAINST THE ART IT TINTS, which is the part that is easy to get
  // wrong: 0.35 was picked on `beast.bear`, which is brown and saturated, and
  // on the skeleton — bone and steel, nearly desaturated — the same alpha
  // buries it. Rendered and measured across a ladder, as share of the art's
  // luminance contrast that survives:
  //
  //     none 100%   0.12 88%   0.18 82%   0.25 75%   0.35 65%   0.50 50%
  //
  // At 0.35 a yellow or green owner reads as a coloured figure rather than as a
  // skeleton, which is the failure the ruling names. At 0.18 the skull still
  // reads bone, the armour steel and the sash red, and the owner colour is
  // still unmistakable — helped by the hp bar and the down-ring, which carry
  // the same colour and are not competing with the art for it.
  //
  // One number, deliberately easy to find. Re-judge it against NEW art rather
  // than inheriting it: a dark or already-saturated minion will want less.
  tint: 0.18,
  radiusDefault: 10,
  diamond: ['wisp', 'hawk'],       // flyers
  fallbackColor: '#9aa0bd',
  outline: 2,
  downAlpha: 0.4,
  ringWidth: 2,
  ringGap: 4,
  hpBarBelow: 0.99,
  hpBarGap: 6,
  hpBarH: 3,
  tokenR: 5,
  tokenFill: '#c9a6ff',
  tokenPulse: 0.15,
  tokenAlphaMin: 0.25,
};

// The debug grid. Default OFF — it is the reference the 2.18 roster scale was
// tuned against, and it will be needed again the moment biome enemy sheets
// arrive, so it is a flag rather than a deletion.
//
//   ?grid=1   draw the floor grid over whatever the floor is
const GRID_DEBUG = (() => {
  try { return new URLSearchParams(location.search).get('grid') === '1'; }
  catch { return false; }   // non-browser (headless harnesses)
})();

// The camera viewport is one "screen" of world units (the old room size);
// arenas are several screens wide and the camera follows your character.
const { ROOM_W: VIEW_W, ROOM_H: VIEW_H, WALL } = CONFIG;

// Facing thresholds. MOVE_EPS2 is a SQUARED per-frame displacement: 0.5 world
// units a frame is 30 u/s, comfortably under the slowest thing that walks
// (the Deadeye, at 62) and comfortably over interpolation jitter on a client.
// AIM_HOLD is how long a shot keeps a unit looking at what it shot.
const FACE_MOVE_EPS2 = 0.25;
const FACE_AIM_HOLD_S = 0.6;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.floaters = [];
    this.arcs = [];
    this.flashBeams = [];
    this.rings = [];
    this.casts = [];
    this.impacts = [];
    this.muzzles = [];
    this.shakeEnabled = true;
    this.showHitboxes = false;
    this.t = 0;
    // Which way each unit is facing, for directional sprites. Render-local and
    // keyed by entity id ON PURPOSE: facing is a client-side presentation
    // detail, so it must not be attached to a live entity, a snapshot or the
    // wire — the sim suite asserts exactly that. Swept periodically, and
    // cleared outright when the arena changes.
    this._facing = new Map();
    this._facingGen = 0;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    // cap DPR at 2 — 3x panels on phones cost fill-rate for no visible gain
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * this.dpr;
    this.canvas.height = window.innerHeight * this.dpr;
    // Resizing a canvas resets EVERY piece of context state, this flag
    // included. It has to be re-applied here, after every resize, or pixel art
    // comes back blurry the first time someone rotates a phone.
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
  }

  // Fill an arbitrary rect by repeating a sprite, clipped to the rect. Walls,
  // barricades and spike strips are authored at whatever size the level wants
  // them, so stretching one image across them would smear it — tiling keeps
  // the texel density constant however long the wall is. Returns false (and
  // draws nothing) when there is no art, exactly like drawSprite.
  _tileSprite(ctx, id, x, y, w, h, alpha = 1) {
    const s = Assets.get(id);
    if (!s) { drawSprite(ctx, id, x + w / 2, y + h / 2); return false; }  // debug outline, if enabled
    ctx.save();
    if (alpha !== 1) ctx.globalAlpha *= alpha;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (let ty = y; ty < y + h; ty += s.h) {
      for (let tx = x; tx < x + w; tx += s.w) ctx.drawImage(s.img, 0, 0, s.w, s.h, tx, ty, s.w, s.h);
    }
    ctx.restore();
    return true;
  }

  // ---- facing, for directional sprites ----
  //
  // Nothing on the wire says which way anything is looking, and nothing should:
  // a facing byte would be a snapshot change for a purely cosmetic detail. So
  // the renderer works it out from what it already draws.
  //
  // An idle unit has no heading at all, and a naive atan2 of a zero delta
  // returns 0 — which would snap every stationary thing in the arena to face
  // east on the same frame. So the last MEANINGFUL heading is remembered and
  // reused, and a unit never yet seen faces south, towards the camera.
  //
  // For players, a fresh auto-aim beats movement for a moment: shooting at
  // something while backing away should look like shooting at it. `aimA` only
  // moves when a weapon actually fires, so "fresh" is a real signal here and
  // not a per-frame flicker.
  _faceAngle(key, x, y, aim) {
    let f = this._facing.get(key);
    if (!f) {
      f = { x, y, a: DEFAULT_FACING, aim: aim === null || aim === undefined ? null : aim, aimT: -1e9, gen: this._facingGen };
      // joining mid-run: adopt an aim that has clearly already been used
      if (f.aim !== null && f.aim !== 0) { f.a = f.aim; f.aimT = this.t; }
      this._facing.set(key, f);
      return f.a;
    }
    f.gen = this._facingGen;
    const dx = x - f.x, dy = y - f.y;
    f.x = x; f.y = y;
    if (aim !== null && aim !== undefined && aim !== f.aim) { f.aim = aim; f.aimT = this.t; }
    if (f.aim !== null && this.t - f.aimT < FACE_AIM_HOLD_S) { f.a = f.aim; return f.a; }
    if (dx * dx + dy * dy >= FACE_MOVE_EPS2) f.a = Math.atan2(dy, dx);
    return f.a;
  }

  // Entities die; their ids never come back. Drop stale rows every few hundred
  // frames rather than growing a map for the length of a run.
  _sweepFacing() {
    if ((this._facingGen & 255) !== 0) return;
    const cutoff = this._facingGen - 600;   // ~10s at 60fps: survives being culled off-screen
    for (const [k, f] of this._facing) if (f.gen < cutoff) this._facing.delete(k);
  }

  // fx from one sim tick / snapshot → visual effects (idempotent per call)
  ingestFx(fx) {
    if (!fx) return;
    for (const h of fx.hits || []) {
      const kind = h.c;
      const text = kind === 2 ? 'DODGE' : String(h.a);
      const color = kind === 1 ? PALETTE.crit : kind === 2 ? '#9aa0bd' : kind === 3 ? '#ff5d6c' : '#ffffff';
      this.floaters.push({ x: h.x + (Math.random() * 16 - 8), y: h.y, vy: -60, t: 0, dur: 0.8, text, color, scale: kind === 1 ? 1.4 : 1 });
      if (this.floaters.length > 90) this.floaters.splice(0, this.floaters.length - 90);
      // impact linger — the hit spark that used to vanish with the projectile
      if (kind !== 2) {
        this.impacts.push({ x: h.x, y: h.y, t: 0, dur: 0.45, color: kind === 3 ? '#ff5d6c' : '#fff6e8' });
        if (this.impacts.length > 48) this.impacts.splice(0, this.impacts.length - 48);
      }
    }
    for (const d of fx.deaths || []) {
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160;
        this.particles.push({ x: d.x, y: d.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, dur: 0.4 + Math.random() * 0.3, color: d.c, size: 2 + Math.random() * 3 });
      }
    }
    for (const b of fx.booms || []) {
      this.rings.push({ x: b.x, y: b.y, r: b.r, t: 0, dur: 0.35, color: '#ffab4f' });
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, s = 100 + Math.random() * 220;
        this.particles.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, dur: 0.35, color: i % 2 ? '#ffab4f' : '#ff5d3a', size: 2 + Math.random() * 3 });
      }
    }
    for (const bm of fx.beams || []) {
      const spec = bm.sid ? fxSpec(bm.sid) : null;
      this.flashBeams.push({ ...bm, t: 0, dur: spec ? spec.dur : 0.42, spec, color: spec ? spec.color : bm.color });
    }
    for (const s of fx.swings || []) this._ingestSwing(s);
    for (const bl of fx.blocks || []) this.rings.push({ x: bl.x, y: bl.y, r: 30, t: 0, dur: 0.25, color: '#5ea8ff' });
    for (const f of fx.skillFires || []) this._spawnSkillFire(f);
    if (this.particles.length > CONFIG.POOL_PARTICLES) this.particles.splice(0, this.particles.length - CONFIG.POOL_PARTICLES);
    if (this.arcs.length > 56) this.arcs.splice(0, this.arcs.length - 56);
    if (this.casts.length > 40) this.casts.splice(0, this.casts.length - 40);
    if (this.flashBeams.length > 32) this.flashBeams.splice(0, this.flashBeams.length - 32);
  }

  // Overlapping swipes of the same cut stack width/alpha instead of spawning
  // a second pie that reads as flicker. Weapon swings (no sid) still stack
  // with each other if they share origin and heading.
  _ingestSwing(s) {
    const spec = s.sid ? fxSpec(s.sid) : null;
    const arc = (s.arc > 0 ? s.arc : (spec ? spec.arc : 1.5));
    const dur = spec ? spec.dur : 0.34;
    const color = spec ? spec.color : (s.color || '#fff');
    const shape = spec ? spec.shape : SHAPE.slash;
    const lw0 = shape === SHAPE.cleave ? 11 : shape === SHAPE.thrust ? 5 : 7;
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      if (a.t > a.dur * 0.72) continue;
      if (Math.abs(a.x - s.x) > 10 || Math.abs(a.y - s.y) > 10) continue;
      if (Math.abs(a.r - s.r) > 22) continue;
      if (Math.abs(angDiff(a.a, s.a)) > 0.4) continue;
      a.stack = Math.min(5, (a.stack || 1) + 1);
      a.lw = Math.min(22, (a.lw || lw0) + 3.2);
      a.t = Math.min(a.t, a.dur * 0.12);
      a.color = color;
      return;
    }
    this.arcs.push({
      x: s.x, y: s.y, a: s.a, r: s.r, arc, color, spec, shape,
      t: 0, dur, stack: 1, lw: lw0,
    });
  }

  _spawnSkillFire(f) {
    const spec = fxSpec(f.id);
    if (!spec) return;
    const a = (f.a !== undefined && f.a !== null) ? f.a : 0;
    const x = f.x, y = f.y;
    const tx = f.tx !== undefined ? f.tx : x + Math.cos(a) * spec.reach;
    const ty = f.ty !== undefined ? f.ty : y + Math.sin(a) * spec.reach;
    // Geometry channels already draw slash/cleave/thrust/beam. The fire still
    // drops a muzzle spark so a 4-skill auto-fire loadout has a beat at the
    // caster even when the arc is stacked into a neighbour.
    if (spec.role === 'arc' || spec.role === 'beam') {
      this._burst(x, y, spec, 4, 50);
      return;
    }
    if (spec.role === 'bolt') {
      this.muzzles.push({ x, y, a, t: 0, dur: spec.dur, spec });
      this._burst(x + Math.cos(a) * 12, y + Math.sin(a) * 12, spec, 5, 90);
      if (this.muzzles.length > 24) this.muzzles.splice(0, this.muzzles.length - 24);
      return;
    }
    this.casts.push({ x, y, tx, ty, a, t: 0, dur: spec.dur, spec, reach: spec.reach, arc: spec.arc });
    this._burst(spec.role === 'cast' ? tx : x, spec.role === 'cast' ? ty : y, spec, 6, 70);
  }

  _burst(x, y, spec, n, speed) {
    const kit = spec.kit;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random());
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        t: 0, dur: 0.22 + Math.random() * 0.18,
        color: i % 2 ? spec.color : kit.core,
        size: 1.5 + Math.random() * 2.2,
      });
    }
  }

  draw(view, dtFrame) {
    const _t0 = (typeof performance !== 'undefined' ? performance.now() : 0);
    this.t += dtFrame;
    this._facingGen++;
    this._sweepFacing();
    const ctx = this.ctx;
    const cw = this.canvas.width, ch = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c0d13';
    ctx.fillRect(0, 0, cw, ch);
    if (!view || view.mode === 'map') { this._drawJoystick(ctx); return; } // the node map is a DOM screen

    const aw = view.aw || VIEW_W, ah = view.ah || VIEW_H;
    const scale = Math.min(cw / VIEW_W, ch / VIEW_H); // fixed zoom: one room-screen of world
    const vw = cw / scale, vh = ch / scale;           // visible world units

    // ---- camera: smooth follow of MY character with velocity lookahead ----
    const me = (view.players || []).find(p => p.idx === view.myIdx && !p.gone);
    if (this._camKey !== view.arenaKey) { // new arena: snap, no glide across the map
      this._camKey = view.arenaKey;
      this.camX = me ? me.x : aw / 2; this.camY = me ? me.y : ah / 2;
      this.lookX = 0; this.lookY = 0;
      this._prevMe = null;
      this._facing.clear();   // new arena, new entities — no facing carries over
    }
    if (me) {
      if (this._prevMe) {
        const vx = (me.x - this._prevMe.x) / Math.max(dtFrame, 0.001);
        const vy = (me.y - this._prevMe.y) / Math.max(dtFrame, 0.001);
        const k = Math.min(1, dtFrame * 3.2);
        this.lookX += (clamp(vx * 0.3, -130, 130) - this.lookX) * k;
        this.lookY += (clamp(vy * 0.3, -130, 130) - this.lookY) * k;
      }
      this._prevMe = { x: me.x, y: me.y };
      const k = Math.min(1, dtFrame * 6);
      this.camX += (me.x + this.lookX - this.camX) * k;
      this.camY += (me.y + this.lookY - this.camY) * k;
    }
    this.camX = clamp(this.camX, Math.min(vw / 2, aw / 2), Math.max(aw - vw / 2, aw / 2));
    this.camY = clamp(this.camY, Math.min(vh / 2, ah / 2), Math.max(ah - vh / 2, ah / 2));
    let ox = cw / 2 - this.camX * scale, oy = ch / 2 - this.camY * scale;
    if (this.shakeEnabled && view.shake > 0) {
      ox += (Math.random() * 2 - 1) * view.shake * scale;
      oy += (Math.random() * 2 - 1) * view.shake * scale;
    }
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    // culling bounds (world coords, with margin for radii/bars)
    const cl = this.camX - vw / 2 - 90, cr = this.camX + vw / 2 + 90;
    const ct = this.camY - vh / 2 - 90, cb = this.camY + vh / 2 + 90;
    const inView = (x, y, m = 0) => x > cl - m && x < cr + m && y > ct - m && y < cb + m;
    this._screen = { scale, cw, ch, vw, vh };

    this._drawArena(ctx, view, aw, ah, cl, cr, ct, cb);
    // under everything else: the ground is where the promise is made
    if (view.telZones && view.telZones.length) this._drawTelegraphZones(ctx, view.telZones);
    this._drawHazards(ctx, view, inView);
    for (const z of view.zones || []) {
      if (!inView(z.x, z.y, z.r)) continue;
      ctx.globalAlpha = 0.3 + 0.08 * Math.sin(this.t * 6);
      ctx.fillStyle = z.color || '#ff7b3a';
      circle(ctx, z.x, z.y, z.r); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = z.color; ctx.lineWidth = 2;
      circle(ctx, z.x, z.y, z.r); ctx.stroke();
    }
    for (const tr of view.traps || []) {
      if (!inView(tr.x, tr.y, tr.r || 24)) continue;
      const pulse = 0.55 + 0.45 * Math.sin(this.t * 7 + tr.x * 0.05);
      ctx.globalAlpha = 0.22 * pulse;
      ctx.fillStyle = tr.color || '#a3e635';
      diamond(ctx, tr.x, tr.y, (tr.r || 22) * 0.55);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = tr.color || '#a3e635';
      ctx.lineWidth = 2;
      diamond(ctx, tr.x, tr.y, (tr.r || 22) * 0.55);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // the hold-the-circle sub-objective (siege)
    if (view.hold) {
      const [hx, hy, hr, held] = view.hold;
      ctx.globalAlpha = held ? 0.16 : 0.08;
      ctx.fillStyle = held ? '#ffd45e' : '#ff5d6c';
      circle(ctx, hx, hy, hr); ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = held ? '#ffd45e' : '#ff5d6c';
      ctx.lineWidth = 4;
      ctx.setLineDash([16, 10]);
      circle(ctx, hx, hy, hr + 3 * Math.sin(this.t * 2.5)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = held ? '#ffd45e' : '#ff5d6c';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(held ? 'HELD — SPAWNS CHOKED' : 'HOLD THE SIGIL', hx, hy - hr - 12);
    }
    if (view.hatch) this._drawHatch(ctx, view.hatch[0], view.hatch[1], view.afterSiege);
    if (view.obj) this._drawObjective(ctx, view);
    this._drawToh(ctx, view);
    this._drawAuras(ctx, view);
    this._drawTethers(ctx, view);
    this._drawTelegraphs(ctx, view, inView);
    // pickups
    ctx.fillStyle = PALETTE.material;
    ctx.strokeStyle = PALETTE.materialEdge;
    ctx.lineWidth = 2;
    for (const m of view.pickups || []) {
      if (!inView(m.x, m.y)) continue;
      const bob = Math.sin(this.t * 5 + m.x * 0.13) * 2;
      if (drawSprite(ctx, FX.material, m.x, m.y + bob, { scale: spriteScaleFor(FX.material, 16) })) continue;
      diamond(ctx, m.x, m.y + bob, 7);
      ctx.fill(); ctx.stroke();
    }
    for (const d of view.decoys || []) { if (inView(d.x, d.y)) this._drawDecoy(ctx, d, view); }
    for (const s of view.summons || []) { if (inView(s.x, s.y)) this._drawSummon(ctx, s, view); }
    for (const tk of view.tokens || []) { if (inView(tk.x, tk.y)) this._drawSoulToken(ctx, tk); }
    (view.minions || []).forEach((m, i) => { if (inView(m.x, m.y)) this._drawMinion(ctx, m, view, i); });
    for (const e of view.enemies || []) { if (inView(e.x, e.y, e.radius)) this._drawEnemy(ctx, e); }
    for (const p of view.players || []) if (!p.gone) this._drawPlayer(ctx, p, view);
    // projectiles
    for (const pr of view.projs || []) {
      if (!inView(pr.x, pr.y)) continue;
      const heading = pr.vx !== undefined ? Math.atan2(pr.vy, pr.vx) : 0;
      const spec = pr.skillId ? fxSpec(pr.skillId) : null;
      // Skill shots are radius 5 on purpose (hitbox). The art is a dagger, not
      // a spark — painted size is cosmetic and does not change collision.
      const paint = spec ? 32 : Math.max(12, (pr.radius || 5) * 3);
      if (pr.friendly && (pr.vx || pr.vy)) {
        const spd = Math.hypot(pr.vx || 0, pr.vy || 0) || 1;
        const ux = (pr.vx || 0) / spd, uy = (pr.vy || 0) / spd;
        const col = spec ? spec.boltColor : (pr.color || '#fff');
        const tr = spec ? 4.5 : Math.max(1.4, (pr.radius || 5) * 0.55);
        for (let k = 1; k <= 4; k++) {
          ctx.globalAlpha = 0.32 / k;
          ctx.fillStyle = col;
          circle(ctx, pr.x - ux * k * 9, pr.y - uy * k * 9, tr * (1 - k * 0.14));
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // Canvas first: a sprite is an overlay, never a replacement. A 32px
      // stamp drawn at 15 world units was why wizard bolts read as dots.
      this._drawBoltPrimitive(ctx, pr, spec, heading, paint / 3);
      if (pr.spriteId) {
        drawSprite(ctx, pr.spriteId, pr.x, pr.y, {
          scale: spriteScaleFor(pr.spriteId, paint),
          rot: heading,
          alpha: 0.92,
        });
      }
    }
    // persistent boss beams
    for (const bm of view.beams || []) {
      ctx.save();
      ctx.translate(bm.x, bm.y); ctx.rotate(bm.a);
      ctx.fillStyle = 'rgba(255,80,100,0.75)';
      ctx.fillRect(0, -bm.w / 2, bm.len, bm.w);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, -bm.w / 6, bm.len, bm.w / 3);
      ctx.restore();
    }
    this._drawFx(ctx, dtFrame);
    this._drawEdgeArrows(ctx, view);
    this._drawExtract(ctx, view);
    if (this.showHitboxes) this._drawHitboxes(ctx, view);
    if (this.debugTrig) this._drawTrigDebug(ctx, this._screen);
    this._drawJoystick(ctx);
    // frame time measured over the whole draw, reported beside the trigger-tick
    // time as a SEPARATE number: one rising without the other tells you which
    // half of the design is the problem
    this.frameMs = (typeof performance !== 'undefined' ? performance.now() : 0) - _t0;
  }

  // Off-screen indicators: allies always (downed ones scream for help),
  // elites/bosses when present, plus the extraction portal and siege
  // objectives. Screen-space triangles clamped to the viewport edge.
  // Warband declutter: alive allies just past the screen edge fade — you know
  // roughly where they are — while distant ones stay solid; downed allies are
  // always full-strength, pulsing, and drawn on top of everything.
  _drawEdgeArrows(ctx, view) {
    const s = this._screen;
    if (!s) return;
    const margin = 34;
    const targets = [];
    const me = (view.players || []).find(q => q.idx === view.myIdx);
    for (const p of view.players || []) {
      if (p.gone || p.idx === view.myIdx) continue;
      let fade = 1;
      if (!p.downed && me) {
        const d = Math.hypot(p.x - me.x, p.y - me.y);
        fade = clamp((d - 700) / 600, 0.3, 1); // near = ghosted, far = solid
      }
      targets.push({ x: p.x, y: p.y, color: p.color, downed: p.downed, label: p.downed ? '✚' : null, fade, late: p.downed });
    }
    targets.sort((a, b) => (a.late ? 1 : 0) - (b.late ? 1 : 0)); // downed drawn last (on top)
    for (const e of view.enemies || []) {
      if (e.boss) targets.push({ x: e.x, y: e.y, color: PALETTE.boss, big: true });
      else if (e.elite) targets.push({ x: e.x, y: e.y, color: PALETTE.elite });
      else if (e.pylon) targets.push({ x: e.x, y: e.y, color: '#c05eff', label: '⌖' });
    }
    if (view.hatch) targets.push({ x: view.hatch[0], y: view.hatch[1], color: PALETTE.doorOpen, label: '➤' });
    if (view.hold) targets.push({ x: view.hold[0], y: view.hold[1], color: '#ffd45e', label: '◎' });
    // objective markers get arrows too — the whole level is about reaching them
    const ob = view.obj;
    if (ob) {
      if (ob.zone) targets.push({ x: ob.zone[0], y: ob.zone[1], color: '#5ee0a8', label: '◎' });
      if (ob.altar) targets.push({ x: ob.altar[0], y: ob.altar[1], color: '#ffd45e', label: '⚱' });
      if (ob.gate) targets.push({ x: ob.gate[0], y: ob.gate[1], color: '#ffab4f', label: '⇥' });
      if (ob.drill) targets.push({ x: ob.drill[0], y: ob.drill[1], color: '#c98b4f', label: '⛏', big: true });
      if (ob.mark) targets.push({ x: ob.mark[0], y: ob.mark[1], color: '#ff7ad9', label: '✦', big: true });
      if (ob.circle) targets.push({ x: ob.circle[0], y: ob.circle[1], color: '#5ea8ff', label: '❄' });
      for (const [rx, ry, carrier] of ob.relics || []) {
        if (carrier < 0) targets.push({ x: rx, y: ry, color: '#ffd45e', label: '⚱' });
      }
      for (const [nx, ny] of ob.nests || []) targets.push({ x: nx, y: ny, color: '#c98b4f', label: '⁂' });
    }
    for (const [mi, mx2, my2, doll] of view.tohMarks || []) {   // Assassin's contract
      if (!doll && mi === view.myIdx) targets.push({ x: mx2, y: my2, color: '#ff7ad9', label: '✦' });
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const cwCss = s.cw / this.dpr, chCss = s.ch / this.dpr;
    for (const tg of targets) {
      // world → screen (css px)
      const sx = ((tg.x - this.camX) * s.scale + s.cw / 2) / this.dpr;
      const sy = ((tg.y - this.camY) * s.scale + s.ch / 2) / this.dpr;
      if (sx > margin && sx < cwCss - margin && sy > margin && sy < chCss - margin) continue; // on screen
      const cx = clamp(sx, margin, cwCss - margin), cy = clamp(sy, margin, chCss - margin);
      const a = Math.atan2(sy - chCss / 2, sx - cwCss / 2);
      const pulse = tg.downed ? 0.55 + 0.45 * Math.sin(this.t * 8) : 1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.globalAlpha = 0.9 * pulse * (tg.fade !== undefined ? tg.fade : 1);
      ctx.fillStyle = tg.color;
      ctx.strokeStyle = '#0b0c12';
      ctx.lineWidth = 2;
      const sz = tg.big ? 15 : 11;
      ctx.beginPath();
      ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.7, -sz * 0.7); ctx.lineTo(-sz * 0.7, sz * 0.7);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.rotate(-a);
      if (tg.label) {
        ctx.fillStyle = tg.color;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(tg.label, 0, -14);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // extraction countdown banner (any player standing on the portal)
  _drawExtract(ctx, view) {
    if (view.extract === null || view.extract === undefined) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const cw = this.canvas.width / this.dpr;
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = PALETTE.doorOpen;
    ctx.strokeStyle = '#0b0c12';
    ctx.lineWidth = 5;
    const label = `${view.afterSiege ? 'DESCENDING' : 'EXTRACTING'} in ${Math.ceil(view.extract)}`;
    ctx.strokeText(label, cw / 2, 84);
    ctx.fillText(label, cw / 2, 84);
  }

  // Banneret's standard (and item auras): a soft banner-colored ring centered
  // on the caster — drawn on every screen so the buff zone is always readable.
  _drawAuras(ctx, view) {
    for (const a of view.auras || []) {
      const p = (view.players || []).find(q => q.idx === a.idx);
      if (!p || p.gone || p.downed) continue;
      const pulse = 1 + 0.015 * Math.sin(this.t * 2.2);
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = p.color;
      circle(ctx, p.x, p.y, a.r * pulse); ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      circle(ctx, p.x, p.y, a.r * pulse); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  // Lodestone's soulbond tether: a living line between the bonded pair.
  _drawTethers(ctx, view) {
    for (const t of view.tethers || []) {
      const wob = Math.sin(this.t * 5) * 3;
      const mx = (t.x1 + t.x2) / 2, my = (t.y1 + t.y2) / 2 + wob;
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#c9a6ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.quadraticCurveTo(mx, my + 14, t.x2, t.y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#c9a6ff';
      circle(ctx, mx, my + 7, 4); ctx.fill();
    }
  }

  // Mirage's afterimage: a fading ghost that enemies chase, with a burst ring
  // telegraphing its detonation.
  _drawDecoy(ctx, d, view) {
    const member = (view.players || []).find(q => q.idx === d.owner);
    const color = member ? member.color : '#c8cde8';
    // the ghost wears the owner's sprite when there is one — that is the whole
    // point of an afterimage — and its own silhouette otherwise
    const ghostId = (member && member.spriteId) || PROP.decoy;
    if (!drawSprite(ctx, ghostId, d.x, d.y, { scale: spriteScaleFor(ghostId, 32), alpha: 0.25 + 0.35 * d.frac })) {
      ctx.globalAlpha = 0.25 + 0.35 * d.frac;
      ctx.fillStyle = color;
      circle(ctx, d.x, d.y, 16); ctx.fill();
    }
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    circle(ctx, d.x, d.y, 20 + 8 * (1 - d.frac)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // floating touch joystick (screen space, CSS px coords from touch.js)
  _drawJoystick(ctx) {
    const j = this.joy;
    if (!j || !j.active) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#c8cde8';
    circle(ctx, j.anchorX, j.anchorY, 56); ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#e8e9f2';
    ctx.lineWidth = 2;
    circle(ctx, j.anchorX, j.anchorY, 56); ctx.stroke();
    // thumb nub clamped to the base radius
    const dx = j.curX - j.anchorX, dy = j.curY - j.anchorY;
    const len = Math.hypot(dx, dy) || 1;
    const c = Math.min(len, 52);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#e8e9f2';
    circle(ctx, j.anchorX + dx / len * c, j.anchorY + dy / len * c, 24); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // THE TRIGGER-CORE DEBUG OVERLAY (toggle: T).
  //
  // Not optional, and not decoration. The gate this patch exists to answer is
  // "does auto-triggered combat feel good", and "it felt bad" is not an
  // actionable finding — you need to see WHICH trigger fired and when. The
  // performance half is worse: a trigger budget being exhausted is completely
  // invisible from inside a fight until it is structural.
  _drawTrigDebug(ctx, s) {
    const d = this.trigDebug;
    if (!d) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const W = s.cw / this.dpr, H = s.ch / this.dpr;
    const x = 12, w = 330;
    let y = 96;
    const line = (t, c) => { ctx.fillStyle = c || '#c8cde8'; ctx.fillText(t, x + 10, y); y += 14; };

    const rows = 22 + d.players.length * 2 + Math.min(8, d.log.length) + Math.min(4, (d.telZones || []).length) + Math.min(5, (d.dodges || []).length);
    ctx.fillStyle = 'rgba(10,11,18,0.86)';
    ctx.fillRect(x, y - 16, w, rows * 14 + 18);
    ctx.strokeStyle = '#454b6e'; ctx.lineWidth = 1;
    ctx.strokeRect(x, y - 16, w, rows * 14 + 18);
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';

    const st = d.stats || {};
    line('TRIGGER CORE  [T to hide]', '#ffd45e');
    // frame time and trigger-tick time are SEPARATE numbers on purpose: one
    // rising without the other says which half of the design is the problem
    line(`frame ${(this.frameMs || 0).toFixed(2)} ms   trigger tick ${(st.ms || 0).toFixed(3)} ms`);
    line(`evals ${st.evals || 0}/tick   fires ${st.fires || 0}   budget hits ${st.cappedCount || 0}/${st.ticks || 0}`,
      st.capped ? '#ff5d6c' : '#c8cde8');
    line(`grid ${st.cells || 0} cells / ${st.enemies || 0} enemies   ${st.queries || 0} queries/tick`);
    line(`live enemies ${d.enemies}`);
    y += 4;
    for (const q of d.players) {
      line(`P${q.idx} ${q.name}${q.footing ? `  footing ${q.footing}` : ''}`, '#8fa3c8');
      const cds = q.cds.map(c => `${c.id.replace(/^(necro|sam)_/, '')}${c.cd > 0 ? `:${c.cd}` : ''}`).join(' ');
      line(`  ${cds || '(no actives slotted)'}`, q.last ? '#5ee0a8' : '#9aa0bd');
    }
    y += 4;
    // THE fastest read on whether telegraphs are working: dodges near zero
    // means wind-ups are too short or the zones unreadable; resolves near zero
    // means they are too long.
    const T = d.tel || {};
    line(`telegraphs  committed ${T.committed || 0}  resolved ${T.resolved || 0}  dodged ${T.dodged || 0}  stunned ${T.interrupted || 0}`, '#ffd45e');
    for (const z of (d.telZones || []).slice(0, 4)) {
      line(`  e${z.id} ${z.z.kind.padEnd(6)} ${String(z.msLeft).padStart(4)} ms  ${'#'.repeat(Math.round(z.fill * 10)).padEnd(10)}`);
    }
    y += 4;
    line('last dodges (player / enemy / passed)', '#8fa3c8');
    for (const dg of (d.dodges || []).slice(-5).reverse()) {
      line(`  P${dg.p} e${dg.e} ${dg.kind.padEnd(6)} ${dg.dodged ? 'DODGED' : dg.wasCaught ? 'hit (stayed)' : 'hit'}`,
        dg.dodged ? '#5ee0a8' : '#ff5d6c');
    }
    y += 4;
    line('last fires', '#8fa3c8');
    for (const f of d.log.slice(-8).reverse()) {
      line(`  ${f.id.replace(/^(necro|sam)_/, '').padEnd(14)} ${f.trigger.padEnd(17)} ${f.hits} hit`);
    }
    ctx.textAlign = 'start';
  }

  // The floor: a biome's tile set if one is loaded, the flat fill otherwise.
  //
  // Drawn in WORLD coordinates, inside the transform draw() already set from
  // the camera — there is deliberately no second offset here. The floor scrolls
  // because the entity layer's transform scrolls, so the two cannot drift.
  _drawFloor(ctx, view, aw, ah, cl, cr, ct, cb) {
    const x0 = Math.max(0, cl), y0 = Math.max(0, ct);
    const x1 = Math.min(aw, cr), y1 = Math.min(ah, cb);
    if (x1 <= x0 || y1 <= y0) return;
    const biome = view.biome && BIOMES[view.biome] ? BIOMES[view.biome] : null;
    const T = CONFIG.FLOOR_TILE;

    // The flat fill goes down first either way. With tiles it is what shows
    // through if a variant is missing; without them it IS the floor.
    ctx.fillStyle = biome ? biome.fallbackFill : PALETTE.bg;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    const tiles = biome ? this._tileSet(biome) : null;
    if (tiles) {
      // One row and column of margin on each side, so a tile only partly on
      // screen is still drawn and the viewport edge can never show a gap.
      const tx0 = Math.floor(x0 / T) - 1, tx1 = Math.floor((x1 - 1) / T) + 1;
      const ty0 = Math.floor(y0 / T) - 1, ty1 = Math.floor((y1 - 1) / T) + 1;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.clip();
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const s = tiles[tileVariant(tx, ty, tiles.length)];
          ctx.drawImage(s.img, 0, 0, s.w, s.h, tx * T, ty * T, T, T);
        }
      }
      ctx.restore();
    }

    if (!GRID_DEBUG) return;
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gx0 = Math.max(WALL, Math.floor(cl / T) * T), gx1 = Math.min(aw - WALL, cr);
    const gy0 = Math.max(WALL, Math.floor(ct / T) * T), gy1 = Math.min(ah - WALL, cb);
    for (let x = gx0; x <= gx1; x += T) { ctx.moveTo(x, Math.max(WALL, ct)); ctx.lineTo(x, Math.min(ah - WALL, cb)); }
    for (let y = gy0; y <= gy1; y += T) { ctx.moveTo(Math.max(WALL, cl), y); ctx.lineTo(Math.min(aw - WALL, cr), y); }
    ctx.stroke();
  }

  // The loaded tiles for a biome, or null if none of them are there. Cached
  // against the registry's version so a floor draw is not a map lookup per
  // tile — at 64u tiles a 1440x900 viewport asks for this ~400 times a frame.
  //
  // A biome whose atlas did not load is not an error and never a black screen:
  // one log line, and the flat fill stands in. Art arriving later, or not at
  // all, is the normal state of this project.
  _tileSet(biome) {
    const c = this._tileCache;
    if (c && c.id === biome.id && c.v === Assets.version && c.ready === Assets.ready) return c.ids;
    const found = tileSpriteIds(biome).map(id => Assets.get(id)).filter(s => s && s.img);
    const ids = found.length ? found : null;
    if (!ids && Assets.ready && this._warnedBiome !== biome.id) {
      this._warnedBiome = biome.id;
      console.log(`[biome] ${biome.id}: no tiles loaded from ${biome.atlas} — drawing the flat ${biome.fallbackFill} floor`);
    }
    this._tileCache = { id: biome.id, v: Assets.version, ready: Assets.ready, ids };
    return ids;
  }

  // COMMITTED DANGER ZONES, drawn on the ground under everything else.
  //
  // The fill IS the timer: it sweeps 0 -> 100% over the wind-up, so time to
  // impact is read from how full the shape is, with no numbers and no separate
  // UI. Colour is domain-tinted from the triangle palette, so the same shape
  // also says what kind of damage is coming.
  //
  // EVERY ZONE IS OUTLINED, not just filled. Overlapping translucent fills turn
  // to mud, and mud at 8 players is the failure mode this whole patch would die
  // of — the outline is what keeps two overlapping slams legible as two.
  _drawTelegraphZones(ctx, zones) {
    for (const t of zones) {
      const z = t.z;
      const col = DOMAIN_COLOR[z.domain] || '#ff5d6c';
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.beginPath();
      if (z.kind === 'circle') {
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
      } else if (z.kind === 'cone') {
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, z.range, z.angle0 - z.angle / 2, z.angle0 + z.angle / 2);
        ctx.closePath();
      } else {
        ctx.rotate(z.angle0);
        ctx.rect(0, -z.width / 2, z.length, z.width);
      }
      // the sweep: a low base wash the whole time so the shape is visible from
      // commit, brightening toward impact
      ctx.globalAlpha = 0.14 + 0.34 * t.fill;
      ctx.fillStyle = col;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  // The arena: floor, border walls, and obstacles.
  _drawArena(ctx, view, aw, ah, cl, cr, ct, cb) {
    this._drawFloor(ctx, view, aw, ah, cl, cr, ct, cb);
    // border walls
    ctx.fillStyle = PALETTE.wall;
    if (ct < WALL) ctx.fillRect(0, 0, aw, WALL);
    if (cb > ah - WALL) ctx.fillRect(0, ah - WALL, aw, WALL);
    if (cl < WALL) ctx.fillRect(0, 0, WALL, ah);
    if (cr > aw - WALL) ctx.fillRect(aw - WALL, 0, WALL, ah);
    ctx.strokeStyle = PALETTE.wallEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(WALL, WALL, aw - 2 * WALL, ah - 2 * WALL);
    // obstacles (pillars / internal walls)
    for (const o of view.obstacles || []) {
      if (o[0] + o[2] < cl || o[0] > cr || o[1] + o[3] < ct || o[1] > cb) continue;
      if (o[4]) {   // a destructible barricade, drawn intact; the objective layer
        if (this._tileSprite(ctx, PROP.barricade, o[0], o[1], o[2], o[3])) continue;
        ctx.fillStyle = 'rgba(120,96,72,0.85)';   // repaints the damaged ones on top
        ctx.fillRect(o[0], o[1], o[2], o[3]);
        ctx.strokeStyle = '#a8794e';
        ctx.lineWidth = 3;
        ctx.strokeRect(o[0], o[1], o[2], o[3]);
        continue;
      }
      if (this._tileSprite(ctx, PROP.wallTile, o[0], o[1], o[2], o[3])) continue;
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(o[0], o[1], o[2], o[3]);
      ctx.strokeStyle = PALETTE.wallEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(o[0], o[1], o[2], o[3]);
    }
  }

  // Thrones of Heaven world layer: coral nodes and the walls they grow, Mage
  // singularities, Monk spirits, and the two markers whose traits are invisible
  // without them — the Assassin's contract and the Witch Doctor's doll tether.
  _drawToh(ctx, view) {
    const t = view.toh;
    if (t) {
      for (const [x, y, r, frac] of t.coral || []) {
        if (drawSprite(ctx, PROP.coralNode, x, y, { scale: spriteScaleFor(PROP.coralNode, r * 2), alpha: 0.35 + 0.65 * frac })) continue;
        ctx.strokeStyle = '#5ee0a8';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.35 + 0.45 * frac;
        circle(ctx, x, y, r); ctx.stroke();
        ctx.fillStyle = 'rgba(94,224,168,0.12)';
        circle(ctx, x, y, r); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#5ee0a8';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + this.t * 0.6;
          circle(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, 4); ctx.fill();
        }
      }
      for (const [x1, y1, x2, y2, hp] of t.walls || []) {
        ctx.strokeStyle = hp > 0.5 ? '#5ee0a8' : '#ffab4f';
        ctx.lineWidth = 8 * Math.max(0.25, hp);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      for (const [x, y, r, frac] of t.sing || []) {
        if (drawSprite(ctx, PROP.singularity, x, y, { scale: spriteScaleFor(PROP.singularity, r * 2), rot: this.t * 2 })) continue;
        ctx.strokeStyle = '#b993ff';
        ctx.lineWidth = 4;
        circle(ctx, x, y, r * (0.25 + 0.75 * frac)); ctx.stroke();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#b993ff';
        circle(ctx, x, y, r); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    for (const [x, y, frac, idx] of view.spirits || []) {   // Monk astral copy
      if (drawSprite(ctx, PROP.spirit, x, y, { scale: spriteScaleFor(PROP.spirit, 34), alpha: 0.35 + 0.5 * frac })) continue;
      ctx.globalAlpha = 0.25 + 0.4 * frac;
      ctx.fillStyle = (view.colors && view.colors[idx]) || PALETTE.players[idx % PALETTE.players.length];
      circle(ctx, x, y, 13); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#b993ff'; ctx.lineWidth = 2;
      circle(ctx, x, y, 17); ctx.stroke();
    }
    for (const m of view.tohMarks || []) {
      const [idx, x, y, doll] = m;
      const me = (view.players || []).find(q => q.idx === idx);
      if (doll) {   // Witch Doctor: the link IS the trait, so it has to be visible
        if (!me) continue;
        ctx.strokeStyle = 'rgba(125,238,106,0.65)';
        ctx.lineWidth = 3;
        ctx.setLineDash([9, 7]);
        ctx.lineDashOffset = -this.t * 22;
        ctx.beginPath(); ctx.moveTo(me.x, me.y); ctx.lineTo(x, y); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
        ctx.fillStyle = '#7dee6a';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BOUND', x, y - 34);
      } else {      // Assassin: the mark, and an edge arrow when it is off screen
        ctx.strokeStyle = '#ff7ad9';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = this.t * 18;
        circle(ctx, x, y, 34 + Math.sin(this.t * 4) * 4); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
        ctx.fillStyle = '#ff7ad9';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CONTRACT', x, y - 44);
      }
    }
  }

  // Objective world markers. Everything here is drawn from the synced
  // objective blob, so the host and every client see the same thing.
  _drawObjective(ctx, view) {
    const o = view.obj;
    ctx.save();
    ctx.textAlign = 'center';
    if (o.zone) {
      const [zx, zy, zr, fill] = o.zone;
      ctx.fillStyle = `rgba(94,224,168,${0.06 + 0.1 * fill})`;
      circle(ctx, zx, zy, zr); ctx.fill();
      ctx.strokeStyle = '#5ee0a8';
      ctx.lineWidth = 4;
      ctx.setLineDash([18, 12]);
      ctx.lineDashOffset = -this.t * 22;
      circle(ctx, zx, zy, zr); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      // capture arc
      ctx.strokeStyle = '#ffd45e';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(zx, zy, zr - 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, fill));
      ctx.stroke();
    }
    if (o.circle) { // storm: the safe ring, everything outside burns
      const [cx, cy, cr] = o.circle;
      ctx.strokeStyle = '#5ea8ff';
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.9;
      circle(ctx, cx, cy, cr); ctx.stroke();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#5ea8ff';
      circle(ctx, cx, cy, cr); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (o.wall !== undefined) { // breach: the collapse eating the corridor
      const w = o.wall;
      const g = ctx.createLinearGradient(w - 420, 0, w, 0);
      g.addColorStop(0, 'rgba(255,93,108,0)');
      g.addColorStop(1, 'rgba(255,93,108,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(w - 420, 0, 420, view.ah || 2000);
      ctx.fillStyle = '#2b2f45';
      ctx.fillRect(0, 0, w, view.ah || 2000);
      ctx.strokeStyle = '#ff5d6c';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w, view.ah || 2000); ctx.stroke();
    }
    for (const dx of o.doors || []) { // breach: the sealed doors ahead
      if (!this._tileSprite(ctx, PROP.breachDoor, dx - 10, 0, 20, view.ah || 2000)) {
        ctx.fillStyle = 'rgba(255,171,79,0.22)';
        ctx.fillRect(dx - 10, 0, 20, view.ah || 2000);
        ctx.strokeStyle = '#ffab4f';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(dx, 0); ctx.lineTo(dx, view.ah || 2000); ctx.stroke();
      }
      ctx.fillStyle = '#ffab4f';
      ctx.font = 'bold 22px sans-serif';
      const me = (view.players || []).find(q => q.idx === view.myIdx);
      const ly = me ? clamp(me.y, 80, (view.ah || 2000) - 40) : (view.ah || 2000) / 2;
      if (dx === o.doors[0]) ctx.fillText(`SEALED · ${o.timer}s`, dx - 70, ly - 60);
      break; // only the next door is worth labelling
    }
    if (o.gate) { // breach/payload exit
      const [gx, gy] = o.gate;
      const open = o.t === 'breach' || (o.prog >= 1);
      const gateId = open ? PROP.gateOpen : PROP.gateSealed;
      if (!drawSprite(ctx, gateId, gx, gy, { scale: spriteScaleFor(gateId, 148) })) {
        ctx.strokeStyle = open ? PALETTE.doorOpen : '#ffab4f';
        ctx.lineWidth = 5;
        ctx.setLineDash([10, 7]);
        circle(ctx, gx, gy, 74 + Math.sin(this.t * 3) * 4); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = open ? PALETTE.doorOpen : '#ffab4f';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(open ? 'GATE' : 'SEALED GATE', gx, gy - 88);
    }
    for (const [wx, wy, ww, wh, frac] of o.walls || []) { // nest barricades
      // Two rings per nest, and they visibly lose the argument: the fill fades
      // and the crack line grows as the barricade comes apart, so "how much
      // more of this wall" reads at a glance without a health bar per segment.
      if (!this._tileSprite(ctx, PROP.barricade, wx, wy, ww, wh, 0.45 + 0.55 * frac)) {
        ctx.fillStyle = `rgba(120,96,72,${0.35 + 0.5 * frac})`;
        ctx.fillRect(wx, wy, ww, wh);
        ctx.strokeStyle = frac > 0.5 ? '#a8794e' : '#ff9d5c';
        ctx.lineWidth = 3;
        ctx.strokeRect(wx, wy, ww, wh);
      }
      if (frac < 0.85) {
        ctx.strokeStyle = `rgba(255,120,90,${0.9 - frac * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const hz = ww > wh;
        const len = (hz ? ww : wh) * (1 - frac);
        if (hz) { ctx.moveTo(wx + ww / 2 - len / 2, wy + wh / 2); ctx.lineTo(wx + ww / 2 + len / 2, wy + wh / 2); }
        else { ctx.moveTo(wx + ww / 2, wy + wh / 2 - len / 2); ctx.lineTo(wx + ww / 2, wy + wh / 2 + len / 2); }
        ctx.stroke();
      }
    }
    if (o.altar) { // relic run
      const [ax, ay] = o.altar;
      if (!drawSprite(ctx, PROP.altar, ax, ay, { scale: spriteScaleFor(PROP.altar, 168) })) {
        ctx.strokeStyle = '#ffd45e';
        ctx.lineWidth = 5;
        circle(ctx, ax, ay, 84); ctx.stroke();
        ctx.fillStyle = 'rgba(255,212,94,0.10)';
        circle(ctx, ax, ay, 84); ctx.fill();
      }
      ctx.fillStyle = '#ffd45e';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('ALTAR', ax, ay - 96);
      for (const [rx, ry, carrier] of o.relics || []) {
        const bob = Math.sin(this.t * 4 + rx * 0.1) * 3;
        if (drawSprite(ctx, PROP.relic, rx, ry - 26 + bob, { scale: spriteScaleFor(PROP.relic, 26) })) continue;
        ctx.fillStyle = carrier >= 0 ? '#c9a6ff' : '#ffd45e';
        ctx.strokeStyle = PALETTE.outline;
        ctx.lineWidth = 3;
        diamond(ctx, rx, ry - 26 + bob, 11);
        ctx.fill(); ctx.stroke();
      }
    }
    if (o.drill) { // payload
      const [dx, dy, hpFrac, escorted, stalled] = o.drill;
      ctx.strokeStyle = escorted ? PALETTE.doorOpen : '#9aa0bd';
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      circle(ctx, dx, dy, o.escortR || 260); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      if (!drawSprite(ctx, PROP.drill, dx, dy + 20, { scale: spriteScaleFor(PROP.drill, 64) })) {
        ctx.fillStyle = stalled ? '#ff5d6c' : '#c98b4f';
        ctx.strokeStyle = PALETTE.outline;
        ctx.lineWidth = 3;
        rect(ctx, dx - 26, dy - 20, 52, 40, 6); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#12141f';
      rect(ctx, dx - 22, dy + 22, 44, 7, 3); ctx.fill();
      ctx.fillStyle = hpFrac > 0.35 ? PALETTE.doorOpen : '#ff5d6c';
      rect(ctx, dx - 22, dy + 22, 44 * Math.max(0, hpFrac), 7, 3); ctx.fill();
      ctx.fillStyle = stalled ? '#ff5d6c' : (escorted ? PALETTE.doorOpen : '#9aa0bd');
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(stalled ? 'STALLED' : (escorted ? 'DRILLING' : 'ESCORT ME'), dx, dy - 32);
    }
    for (const [nx, ny, hpf, shielded] of o.nests || []) { // nest purge: mark every spawner
      const nestId = shielded ? PROP.nestWalled : PROP.nest;
      drawSprite(ctx, nestId, nx, ny + 22, { scale: spriteScaleFor(nestId, 64) });
      if (shielded) {   // walled in: the health bar is not the thing to shoot yet
        ctx.strokeStyle = '#5ea8ff';
        ctx.lineWidth = 3;
        circle(ctx, nx, ny, 58 + Math.sin(this.t * 2.6) * 4); ctx.stroke();
        ctx.fillStyle = '#5ea8ff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('WALLED IN', nx, ny - 66);
      }
      ctx.strokeStyle = '#c98b4f';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -this.t * 14;
      circle(ctx, nx, ny, 46 + Math.sin(this.t * 3 + nx * 0.05) * 3); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      ctx.fillStyle = '#12141f';
      rect(ctx, nx - 24, ny - 44, 48, 6, 3); ctx.fill();
      ctx.fillStyle = '#c98b4f';
      rect(ctx, nx - 24, ny - 44, 48 * Math.max(0, hpf), 6, 3); ctx.fill();
    }
    if (o.mark) { // bounty: a ping on the current champion
      const [mx, my] = o.mark;
      ctx.strokeStyle = '#ff7ad9';
      ctx.lineWidth = 4;
      const pr = 60 + Math.sin(this.t * 4) * 10;
      circle(ctx, mx, my, pr); ctx.stroke();
      ctx.fillStyle = '#ff7ad9';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('BOUNTY', mx, my - pr - 10);
    }
    ctx.restore();
  }

  _drawHazards(ctx, view, inView) {
    for (const hz of view.hazards || []) {
      if (hz.type === 'lava') {
        if (!inView(hz.x, hz.y, hz.r + 10)) continue;
        if (drawSprite(ctx, PROP.lava, hz.x, hz.y, { scale: spriteScaleFor(PROP.lava, (hz.r + 4) * 2) })) continue;
        ctx.fillStyle = '#7a2c10';
        circle(ctx, hz.x, hz.y, hz.r + 4); ctx.fill();
        ctx.fillStyle = PALETTE.hazardLava;
        circle(ctx, hz.x, hz.y, hz.r); ctx.fill();
        ctx.fillStyle = '#ffc94f';
        for (let i = 0; i < 3; i++) {
          const a = this.t * 1.2 + i * 2.1, rr = hz.r * 0.5;
          circle(ctx, hz.x + Math.cos(a) * rr, hz.y + Math.sin(a) * rr * 0.6, 6 + 2 * Math.sin(this.t * 3 + i));
          ctx.fill();
        }
      } else if (hz.type === 'spikes') {
        // spike STRIP: a banded rect {x,y,w,h}
        if (!inView(hz.x + hz.w / 2, hz.y + hz.h / 2, Math.max(hz.w, hz.h))) continue;
        // a strip tiles its sprite along its length rather than stretching one
        const spikeId = hz.state === 2 ? PROP.spikesArmed : PROP.spikesIdle;
        if (this._tileSprite(ctx, spikeId, hz.x, hz.y, hz.w, hz.h, hz.state === 1 ? 0.6 : 1)) continue;
        if (hz.state === 0) {
          ctx.fillStyle = 'rgba(200,205,232,0.08)';
          ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
        } else if (hz.state === 1) {
          ctx.fillStyle = 'rgba(255,93,108,0.25)';
          ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
        } else {
          ctx.fillStyle = 'rgba(200,205,232,0.25)';
          ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
          ctx.fillStyle = PALETTE.hazardSpike;
          ctx.strokeStyle = PALETTE.outline;
          ctx.lineWidth = 1.5;
          for (let x = hz.x + 6; x < hz.x + hz.w - 18; x += 26) {
            ctx.beginPath();
            ctx.moveTo(x, hz.y + hz.h - 4);
            ctx.lineTo(x + 9, hz.y + 4);
            ctx.lineTo(x + 18, hz.y + hz.h - 4);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
          }
        }
      }
    }
  }

  // the extraction portal (fights) / descent portal (post-siege)
  _drawHatch(ctx, x, y, afterSiege) {
    ctx.save();
    ctx.translate(x, y);
    const hatchId = afterSiege ? PROP.hatchDescend : PROP.hatchExtract;
    if (!drawSprite(ctx, hatchId, 0, 0, { scale: spriteScaleFor(hatchId, 104) })) {
      ctx.fillStyle = '#0a0b12';
      ctx.strokeStyle = PALETTE.doorOpen;
      ctx.lineWidth = 4;
      circle(ctx, 0, 0, 52); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#1e6e4e';
      ctx.lineWidth = 3;
      circle(ctx, 0, 0, 34 + 7 * Math.sin(this.t * 3)); ctx.stroke();
    }
    ctx.fillStyle = PALETTE.doorOpen;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(afterSiege ? 'DESCEND' : 'EXTRACT', 0, 4);
    ctx.restore();
  }

  _drawTelegraphs(ctx, view, inView = () => true) {
    for (const tg of view.tele || []) {
      if (tg.shape === 'c' && !inView(tg.x, tg.y, tg.r)) continue;
      if (tg.shape === 'c') {
        if (tg.spawnMark) {
          ctx.strokeStyle = '#a86ae8';
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = 0.9;
          circle(ctx, tg.x, tg.y, tg.r * (1 - tg.prog * 0.5)); ctx.stroke();
          ctx.globalAlpha = 1;
          continue;
        }
        ctx.fillStyle = PALETTE.telegraph;
        circle(ctx, tg.x, tg.y, tg.r); ctx.fill();
        ctx.fillStyle = 'rgba(255,93,108,0.45)';
        circle(ctx, tg.x, tg.y, tg.r * clamp(tg.prog, 0, 1)); ctx.fill();
        ctx.strokeStyle = PALETTE.telegraphEdge;
        ctx.lineWidth = 2;
        circle(ctx, tg.x, tg.y, tg.r); ctx.stroke();
      } else {
        ctx.save();
        ctx.translate(tg.x, tg.y); ctx.rotate(tg.a);
        ctx.fillStyle = PALETTE.telegraph;
        ctx.fillRect(0, -tg.w / 2, tg.len, tg.w);
        ctx.fillStyle = 'rgba(255,93,108,0.45)';
        ctx.fillRect(0, -tg.w / 2, tg.len * clamp(tg.prog, 0, 1), tg.w);
        ctx.strokeStyle = PALETTE.telegraphEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(0, -tg.w / 2, tg.len, tg.w);
        ctx.restore();
      }
    }
  }

  _drawEnemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const r = e.radius;
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.strokeStyle = PALETTE.outline;
    ctx.fillStyle = e.color;
    if (e.elite) {
      ctx.shadowColor = PALETTE.elite;
      ctx.shadowBlur = 14;
    }
    // Radius is the truth — it is what the hitbox and the elite/mini scaling
    // use — so the art is scaled to cover it rather than the other way round.
    const sc = spriteScaleFor(e.spriteId, r * 2);
    // `facing` picks a row on a directional sheet and is ignored on a
    // single-direction one — an enemy is never rotated either way.
    const opt = { scale: sc, facing: this._faceAngle(`e${e.id}`, e.x, e.y, null), seed: e.id };
    const drew = drawSprite(ctx, e.spriteId, 0, 0, opt);
    if (!drew) {
      drawShape(ctx, e.shape, r, this.t + (e.id || 0));
      ctx.fill();
      ctx.stroke();
    }
    // THE DAMAGE TRIANGLE, always visible. A 4px ring in the enemy's domain
    // colour: the triangle is only a decision a player can act on if they can
    // see which way it points without inspecting anything.
    // WINDING UP: a bright ring that pulses on the body, so with three zones on
    // the floor you can still tell which enemy owns which.
    if (e.winding) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(this.t * 22);
      ctx.beginPath();
      ctx.arc(0, 0, r + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.domain && DOMAIN_COLOR[e.domain]) {
      ctx.strokeStyle = DOMAIN_COLOR[e.domain];
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    if (e.elite) {
      ctx.strokeStyle = PALETTE.elite;
      ctx.lineWidth = 2.5;
      circle(ctx, 0, 0, r + 6); ctx.stroke();
    }
    if (e.fusing || e.flash) {
      const a = e.fusing ? 0.5 + 0.5 * Math.sin(this.t * 30) : 0.75;
      ctx.globalAlpha = a;
      if (drew) {
        // brighten the sprite rather than blank it out with a white silhouette
        ctx.globalCompositeOperation = 'lighter';
        drawSprite(ctx, e.spriteId, 0, 0, opt);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.fillStyle = '#fff';
        drawShape(ctx, e.shape, r, e.fusing ? this.t : this.t + (e.id || 0));
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // small hp bar when damaged
    if (e.hpFrac < 1) {
      const bw = r * 2;
      ctx.fillStyle = '#0008';
      ctx.fillRect(-bw / 2, -r - 10, bw, 5);
      ctx.fillStyle = e.boss ? PALETTE.boss : '#e2504c';
      ctx.fillRect(-bw / 2, -r - 10, bw * clamp(e.hpFrac, 0, 1), 5);
    }
    ctx.restore();
  }

  _drawPlayer(ctx, p, view) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const r = p.radius || 16;
    if (p.downed) {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#3a3f5c';
      ctx.strokeStyle = PALETTE.outline;
      ctx.lineWidth = 3;
      circle(ctx, 0, 0, r); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ff5d6c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.5); ctx.lineTo(r * 0.5, r * 0.5);
      ctx.moveTo(r * 0.5, -r * 0.5); ctx.lineTo(-r * 0.5, r * 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (p.reviveP > 0) {
        ctx.strokeStyle = PALETTE.xpBar;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.reviveP);
        ctx.stroke();
      }
      // marker arrow
      ctx.fillStyle = '#ff5d6c';
      const bob = Math.sin(this.t * 6) * 4;
      ctx.beginPath();
      ctx.moveTo(0, -r - 26 + bob); ctx.lineTo(-8, -r - 38 + bob); ctx.lineTo(8, -r - 38 + bob);
      ctx.closePath(); ctx.fill();
    } else {
      // aim tick
      ctx.strokeStyle = '#ffffff55';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(p.aimA) * r, Math.sin(p.aimA) * r);
      ctx.lineTo(Math.cos(p.aimA) * (r + 8), Math.sin(p.aimA) * (r + 8));
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.strokeStyle = PALETTE.outline;
      ctx.lineWidth = 3;
      // The sprite stands in for the coloured disc AND the character glyph —
      // both, or neither. A half-replaced player reads as a bug.
      // On a directional sheet `facing` picks the row and flipX is ignored;
      // on a single-direction one flipX still mirrors, as it always did.
      const drew = drawSprite(ctx, p.spriteId, 0, 0, {
        scale: spriteScaleFor(p.spriteId, r * 2),
        facing: this._faceAngle(`p${p.idx}`, p.x, p.y, p.aimA),
        flipX: Math.cos(p.aimA) < 0,
        seed: p.idx + 1,
      });
      if (!drew) { circle(ctx, 0, 0, r); ctx.fill(); ctx.stroke(); }
      if (p.shield > 0) {
        ctx.strokeStyle = '#4fd8eb';
        ctx.lineWidth = 3;
        circle(ctx, 0, 0, r + 5); ctx.stroke();
      }
      if (!drew) {
        ctx.fillStyle = '#0b0c12';
        ctx.font = `bold ${Math.round(r * 1.05)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.sym || '●', 0, 1);
      }
      // trait charge ring (Onrush/Resonant/Stillness/Jester) — golden when full
      if (p.meter !== undefined && p.meter >= 0) {
        const full = p.meter >= 1;
        ctx.strokeStyle = full ? '#ffd45e' : '#c9a6ff';
        ctx.globalAlpha = full ? 0.95 : 0.7;
        ctx.lineWidth = full ? 4 : 3;
        ctx.beginPath();
        ctx.arc(0, 0, r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.meter));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // carried turret marker (Overseer)
      if (p.carrying) {
        ctx.fillStyle = '#4fd8eb';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('⌖', 0, -r - 20);
      }
      // structure-recall channel: a ring closing around you while you hold
      // still with structures off your screen (breaks on movement or a hit)
      if (p.reloc > 0) {
        ctx.strokeStyle = '#4fd8eb';
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 4;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, r + 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.reloc));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = p.idx === view.myIdx ? '#fff' : '#c8cde8';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(p.name, 0, -r - 8);
    ctx.restore();
  }

  // A soul token on the floor. It fades as it expires rather than vanishing on
  // a timer nobody can see — the ttl fraction rides the wire so this can read
  // it, which is the only reason that field exists.
  _drawSoulToken(ctx, tk) {
    ctx.save();
    ctx.translate(tk.x, tk.y);
    const pulse = 1 + Math.sin(this.t * 4 + tk.x * 0.11) * MINION_ART.tokenPulse;
    ctx.globalAlpha = MINION_ART.tokenAlphaMin + (1 - MINION_ART.tokenAlphaMin) * clamp(tk.ttlP, 0, 1);
    ctx.fillStyle = MINION_ART.tokenFill;
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = MINION_ART.outline;
    ctx.beginPath();
    ctx.arc(0, 0, MINION_ART.tokenR * pulse, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // A skill-era minion. Drawn in its owner's colour so a four-Druid party can
  // tell whose bear is whose, with a shape per archetype family and — for the
  // Druid's animals — the same revive ring the Hunter's beast already uses, so
  // "down and coming back" reads identically wherever it appears.
  _drawMinion(ctx, m, view, mi) {
    const owner = (view.players || []).find(p => p.idx === m.owner);
    const col = owner ? owner.color : MINION_ART.fallbackColor;
    const r = MINION_ART.radius[m.arch] || MINION_ART.radiusDefault;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = MINION_ART.outline;
    if (m.down) {
      // waiting on a revive: inert, translucent, with the countdown as a ring
      ctx.globalAlpha = MINION_ART.downAlpha;
      ctx.strokeStyle = col;
      ctx.lineWidth = MINION_ART.ringWidth;
      ctx.beginPath();
      ctx.arc(0, 0, r + MINION_ART.ringGap, -Math.PI / 2, -Math.PI / 2 + (1 - clamp(m.downP, 0, 1)) * Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.outline;
      ctx.lineWidth = MINION_ART.outline;
    }
    // SPRITE FIRST, SHAPE IF THERE IS NONE — the same order and the same
    // fallback `_drawBeast` uses, so a missing or unbuilt sheet costs the art
    // and never the unit. An archetype absent from MINION_SPRITE skips straight
    // to the circle it has always drawn.
    const sid = MINION_SPRITE[m.arch];
    if (sid) {
      // FACING IS DERIVED FROM MOVEMENT, and the key is ARRAY-POSITIONAL —
      // minions carry no id in the snapshot, so a minion that dies re-indexes
      // the ones after it and they inherit each other's heading for a frame.
      // Ruled as acceptable; see KNOWN-DEFECTS #25, which names the fix.
      const drew = drawSprite(ctx, sid, 0, 0, {
        scale: spriteScaleFor(sid, r * 2),
        facing: m.down ? DEFAULT_FACING : this._faceAngle(`m${m.owner}:${m.arch}:${mi}`, m.x, m.y, null),
        tint: col,
        tintStrength: MINION_ART.tint,
        seed: (m.owner + 1) * 31 + mi,
      });
      if (drew) {
        this._minionHpBar(ctx, m, col, r);
        ctx.restore();
        return;
      }
    }
    ctx.fillStyle = col;
    ctx.beginPath();
    if (MINION_ART.diamond.includes(m.arch)) {
      // flyers read as a diamond so they are never mistaken for a ground unit
      ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
    } else {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.fill(); ctx.stroke();
    this._minionHpBar(ctx, m, col, r);
    ctx.restore();
  }

  // Health, only once it matters — a full bar over every minion is noise. Drawn
  // from both the sprite and the shape path, so it is one function rather than
  // two copies that drift.
  _minionHpBar(ctx, m, col, r) {
    if (m.down || m.hpP >= MINION_ART.hpBarBelow) return;
    ctx.fillStyle = PALETTE.outline;
    ctx.fillRect(-r, -r - MINION_ART.hpBarGap, r * 2, MINION_ART.hpBarH);
    ctx.fillStyle = col;
    ctx.fillRect(-r, -r - MINION_ART.hpBarGap, r * 2 * clamp(m.hpP, 0, 1), MINION_ART.hpBarH);
  }

  _drawSummon(ctx, s, view) {
    ctx.save();
    ctx.translate(s.x, s.y);
    const owner = (view.players || []).find(p => p.idx === s.owner);
    const col = owner ? owner.color : '#4fd8eb';
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = 2.5;
    // just recalled: bolting itself back down, inert and translucent
    if (s.packed) { ctx.globalAlpha = 0.45; ctx.scale(0.8, 0.8); }
    // A Hunter's beast is a unit, not a structure: eight facings, and a
    // distinct read while it is knocked down so a downed pet never looks like
    // a live one. The sprite is a separate upload — until it lands, drawSprite
    // returns false and the primitive below carries the mechanic.
    if (s.type === 'beast') {
      if (s.down) {
        // the revive countdown, drawn from the wire's own progress fraction —
        // the field exists because this reads it, not the other way round
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 17, -Math.PI / 2, -Math.PI / 2 + (1 - (s.downP || 0)) * Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = PALETTE.outline;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.4;
        ctx.rotate(Math.PI / 2);
      }
      const bid = BEAST_SPRITE.bear;
      if (drawSprite(ctx, bid, 0, 0, {
        scale: spriteScaleFor(bid, 30),
        facing: s.down ? DEFAULT_FACING : (s.aimA || 0),
        flipX: Math.cos(s.aimA || 0) < 0,
        seed: s.owner + 1,
      })) { ctx.restore(); return; }
      ctx.fillStyle = s.down ? '#5a4634' : '#c98a4b';
      circle(ctx, 0, 0, 13); ctx.fill(); ctx.stroke();
      if (!s.down) {
        ctx.fillStyle = col;
        circle(ctx, Math.cos(s.aimA || 0) * 9, Math.sin(s.aimA || 0) * 9, 5); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      return;
    }
    const propId = s.type === 'turret' ? PROP.turret : s.type === 'ram' ? PROP.ram : PROP.drone;
    if (drawSprite(ctx, propId, 0, 0, { scale: spriteScaleFor(propId, 26), rot: s.type === 'ram' ? this.t * 9 : 0 })) {
      // a turret still has to show where it is pointing — the barrel is the
      // only part of a structure that carries information
      if (s.type === 'turret') {
        ctx.strokeStyle = col;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(s.aimA) * 14, Math.sin(s.aimA) * 14);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (s.type === 'turret') {
      ctx.fillStyle = '#2b2f45';
      rect(ctx, -11, -11, 22, 22, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col;
      circle(ctx, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(Math.cos(s.aimA) * 14, Math.sin(s.aimA) * 14);
      ctx.stroke();
    } else if (s.type === 'ram') {
      ctx.fillStyle = col;
      ctx.rotate(this.t * 9);
      star(ctx, 0, 0, 13, 6, 5); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = col;
      diamond(ctx, 0, 0, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      circle(ctx, 0, 0, 3); ctx.fill();
    }
    ctx.restore();
  }

  _drawFx(ctx, dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.t += dt;
      if (pt.t >= pt.dur) { this.particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.92; pt.vy *= 0.92;
      ctx.globalAlpha = 1 - pt.t / pt.dur;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const rg = this.rings[i];
      rg.t += dt;
      if (rg.t >= rg.dur) { this.rings.splice(i, 1); continue; }
      const pr = rg.t / rg.dur;
      ctx.globalAlpha = 1 - pr;
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = 4 * (1 - pr) + 1;
      circle(ctx, rg.x, rg.y, rg.r * (0.4 + 0.6 * pr)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.t += dt;
      if (a.t >= a.dur) { this.arcs.splice(i, 1); continue; }
      this._drawArc(ctx, a);
    }
    ctx.globalAlpha = 1;
    for (let i = this.flashBeams.length - 1; i >= 0; i--) {
      const b = this.flashBeams[i];
      b.t += dt;
      if (b.t >= b.dur) { this.flashBeams.splice(i, 1); continue; }
      this._drawBeam(ctx, b);
    }
    ctx.globalAlpha = 1;
    for (let i = this.muzzles.length - 1; i >= 0; i--) {
      const m = this.muzzles[i];
      m.t += dt;
      if (m.t >= m.dur) { this.muzzles.splice(i, 1); continue; }
      this._drawMuzzle(ctx, m);
    }
    ctx.globalAlpha = 1;
    for (let i = this.casts.length - 1; i >= 0; i--) {
      const c = this.casts[i];
      c.t += dt;
      if (c.t >= c.dur) { this.casts.splice(i, 1); continue; }
      this._drawCast(ctx, c);
    }
    ctx.globalAlpha = 1;
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const im = this.impacts[i];
      im.t += dt;
      if (im.t >= im.dur) { this.impacts.splice(i, 1); continue; }
      this._drawImpact(ctx, im);
    }
    ctx.globalAlpha = 1;
    // damage numbers
    ctx.textAlign = 'center';
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t >= f.dur) { this.floaters.splice(i, 1); continue; }
      f.y += f.vy * dt;
      f.vy *= 0.95;
      ctx.globalAlpha = 1 - Math.pow(f.t / f.dur, 2);
      ctx.font = `bold ${Math.round(15 * f.scale)}px sans-serif`;
      ctx.strokeStyle = PALETTE.outline;
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  _drawArc(ctx, a) {
    const pr = a.t / a.dur;
    const fade = 1 - pr;
    const stack = a.stack || 1;
    const spec = a.spec;
    const kit = spec && spec.kit;
    const edge = kit ? kit.edge : PALETTE.outline;
    const core = kit ? kit.core : '#ffffff';
    const shape = a.shape || SHAPE.slash;
    const r = a.r * (0.82 + 0.18 * fade);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (shape === SHAPE.thrust) {
      const ca = Math.cos(a.a), sa = Math.sin(a.a);
      const half = Math.max(6, (a.arc || 1.2) * 10);
      ctx.globalAlpha = 0.55 * fade;
      ctx.strokeStyle = edge;
      ctx.lineWidth = (a.lw || 5) + 2;
      ctx.beginPath();
      ctx.moveTo(a.x + ca * 8, a.y + sa * 8);
      ctx.lineTo(a.x + ca * r, a.y + sa * r);
      ctx.stroke();
      ctx.globalAlpha = (0.7 + 0.08 * stack) * fade;
      ctx.strokeStyle = a.color;
      ctx.lineWidth = a.lw || 5;
      ctx.beginPath();
      ctx.moveTo(a.x + ca * 10 - sa * half * 0.15, a.y + sa * 10 + ca * half * 0.15);
      ctx.lineTo(a.x + ca * r, a.y + sa * r);
      ctx.lineTo(a.x + ca * 10 + sa * half * 0.15, a.y + sa * 10 - ca * half * 0.15);
      ctx.stroke();
      ctx.strokeStyle = core;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.85 * fade;
      ctx.beginPath();
      ctx.moveTo(a.x + ca * 12, a.y + sa * 12);
      ctx.lineTo(a.x + ca * r, a.y + sa * r);
      ctx.stroke();
    } else {
      // Crescent that WIPES along the swing, then holds and fades. A static
      // pie of the reach reads as a range wedge; a growing stroke reads as a cut.
      const a0 = a.a - a.arc / 2;
      const wipe = Math.max(0.14, Math.min(1, pr / 0.38));
      const a1 = a0 + a.arc * wipe;
      ctx.globalAlpha = 0.55 * fade;
      ctx.strokeStyle = edge;
      ctx.lineWidth = (a.lw || 7) + 3;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, a0, a1);
      ctx.stroke();
      ctx.globalAlpha = Math.min(0.95, (0.62 + 0.1 * stack) * fade);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = a.lw || 7;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, a0, a1);
      ctx.stroke();
      ctx.strokeStyle = core;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.75 * fade;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r * 0.92, a0 + 0.04, a1 - 0.04);
      ctx.stroke();
      if (shape === SHAPE.cleave) {
        ctx.globalAlpha = 0.35 * fade;
        ctx.strokeStyle = a.color;
        ctx.lineWidth = (a.lw || 7) * 0.45;
        ctx.beginPath();
        ctx.arc(a.x, a.y, r * 0.62, a0, a1);
        ctx.stroke();
      }
      // class particle ticks along the live edge
      const particle = kit && kit.particle;
      if (particle && wipe > 0.2) {
        const n = shape === SHAPE.cleave ? 5 : 3;
        ctx.globalAlpha = 0.8 * fade;
        ctx.fillStyle = core;
        for (let i = 0; i < n; i++) {
          const t = a0 + (a1 - a0) * ((i + 1) / (n + 1));
          const px = a.x + Math.cos(t) * r, py = a.y + Math.sin(t) * r;
          if (particle === 'blood' || particle === 'spark') {
            ctx.beginPath(); ctx.moveTo(px + 4, py); ctx.lineTo(px - 2, py - 3); ctx.lineTo(px - 2, py + 3); ctx.closePath(); ctx.fill();
          } else if (particle === 'leaf' || particle === 'note') {
            diamond(ctx, px, py, 3.2); ctx.fill();
          } else if (particle === 'dust' || particle === 'glint') {
            circle(ctx, px, py, 2.2); ctx.fill();
          } else {
            circle(ctx, px, py, 1.8); ctx.fill();
          }
        }
      }
    }
    if (spec && spec.spriteId) {
      const mid = r * 0.72;
      drawSprite(ctx, spec.spriteId, a.x + Math.cos(a.a) * mid, a.y + Math.sin(a.a) * mid, {
        scale: spriteScaleFor(spec.spriteId, 28 + stack * 4),
        rot: a.a,
        alpha: 0.85 * fade,
      });
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawBeam(ctx, b) {
    const pr = b.t / b.dur;
    const fade = 1 - pr;
    const spec = b.spec;
    const kit = spec && spec.kit;
    const w = (b.w || 4) * (0.55 + 0.45 * fade) + 1;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5 * fade;
    ctx.strokeStyle = kit ? kit.edge : PALETTE.outline;
    ctx.lineWidth = w + 4;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.globalAlpha = 0.85 * fade;
    ctx.strokeStyle = b.color || '#ff5d6c';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.strokeStyle = kit ? kit.core : '#ffffff';
    ctx.lineWidth = Math.max(1.4, w * 0.35);
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    if (spec && spec.spriteId) {
      const mx = (b.x1 + b.x2) / 2, my = (b.y1 + b.y2) / 2;
      drawSprite(ctx, spec.spriteId, mx, my, {
        scale: spriteScaleFor(spec.spriteId, 20),
        rot: Math.atan2(b.y2 - b.y1, b.x2 - b.x1),
        alpha: fade,
      });
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawMuzzle(ctx, m) {
    const pr = m.t / m.dur;
    const fade = 1 - pr;
    const spec = m.spec;
    const kit = spec.kit;
    const ca = Math.cos(m.a), sa = Math.sin(m.a);
    const x = m.x + ca * 14, y = m.y + sa * 14;
    if (drawSprite(ctx, 'fx.muzzle', x, y, {
      scale: spriteScaleFor('fx.muzzle', 16 + 10 * fade),
      rot: m.a, alpha: fade,
    })) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(m.a);
    ctx.globalAlpha = fade;
    ctx.fillStyle = spec.boltColor || spec.color;
    ctx.strokeStyle = kit.edge;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(10, 0); ctx.lineTo(-4, -5); ctx.lineTo(-1, 0); ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = kit.core;
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-1, -2.2); ctx.lineTo(-1, 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawImpact(ctx, im) {
    const pr = im.t / im.dur;
    const fade = 1 - pr;
    const r = 4 + 10 * pr;
    if (drawSprite(ctx, 'fx.impact', im.x, im.y, {
      scale: spriteScaleFor('fx.impact', 12 + 10 * fade),
      alpha: fade,
    })) return;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = im.color;
    ctx.lineWidth = 2.2 * fade + 0.6;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + pr * 0.6;
      ctx.moveTo(im.x + Math.cos(a) * r * 0.35, im.y + Math.sin(a) * r * 0.35);
      ctx.lineTo(im.x + Math.cos(a) * r, im.y + Math.sin(a) * r);
    }
    ctx.stroke();
    ctx.fillStyle = im.color;
    ctx.globalAlpha = 0.55 * fade;
    circle(ctx, im.x, im.y, 2.4 * fade + 0.8); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawCast(ctx, c) {
    const spec = c.spec;
    const kit = spec.kit;
    const pr = c.t / c.dur;
    const fade = 1 - pr;
    const shape = spec.shape;
    const x = c.x, y = c.y, tx = c.tx, ty = c.ty;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    switch (shape) {
      case SHAPE.smite: {
        const h = 28 + 40 * fade;
        ctx.globalAlpha = 0.35 * fade;
        ctx.fillStyle = spec.color;
        ctx.fillRect(tx - 6, ty - h, 12, h);
        ctx.globalAlpha = fade;
        ctx.strokeStyle = kit.edge;
        ctx.lineWidth = 3;
        ctx.strokeRect(tx - 6, ty - h, 12, h);
        ctx.strokeStyle = kit.core;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(tx, ty - h); ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.fillStyle = spec.color;
        circle(ctx, tx, ty, 5 + 4 * pr); ctx.fill();
        ctx.strokeStyle = kit.edge; ctx.lineWidth = 1.8; ctx.stroke();
        break;
      }
      case SHAPE.shockwave:
      case SHAPE.ring: {
        const R = (c.reach || 80) * (0.35 + 0.65 * pr);
        ctx.globalAlpha = 0.7 * fade;
        ctx.strokeStyle = kit.edge;
        ctx.lineWidth = 5;
        circle(ctx, x, y, R); ctx.stroke();
        ctx.strokeStyle = spec.color;
        ctx.lineWidth = 2.6;
        circle(ctx, x, y, R); ctx.stroke();
        ctx.strokeStyle = kit.core;
        ctx.lineWidth = 1.2;
        circle(ctx, x, y, R * 0.86); ctx.stroke();
        break;
      }
      case SHAPE.healPulse: {
        const R = 22 + 28 * pr;
        ctx.globalAlpha = 0.28 * fade;
        ctx.fillStyle = spec.color;
        circle(ctx, x, y, R); ctx.fill();
        ctx.globalAlpha = fade;
        ctx.strokeStyle = kit.edge; ctx.lineWidth = 3;
        circle(ctx, x, y, R); ctx.stroke();
        ctx.strokeStyle = spec.color; ctx.lineWidth = 2;
        circle(ctx, x, y, R * 0.7); ctx.stroke();
        ctx.fillStyle = kit.core;
        const arm = 7 + 3 * fade;
        ctx.fillRect(x - 2, y - arm, 4, arm * 2);
        ctx.fillRect(x - arm, y - 2, arm * 2, 4);
        break;
      }
      case SHAPE.wardShell: {
        const R = 22 + 6 * Math.sin(pr * Math.PI);
        ctx.globalAlpha = 0.22 * fade;
        ctx.fillStyle = spec.color;
        poly(ctx, x, y, R, 6, this.t * 0.4); ctx.fill();
        ctx.globalAlpha = fade;
        ctx.strokeStyle = kit.edge; ctx.lineWidth = 3;
        poly(ctx, x, y, R, 6, this.t * 0.4); ctx.stroke();
        ctx.strokeStyle = kit.core; ctx.lineWidth = 1.4;
        poly(ctx, x, y, R * 0.78, 6, this.t * 0.4); ctx.stroke();
        break;
      }
      case SHAPE.puddle: {
        const R = (c.reach || 40) * (0.45 + 0.2 * fade);
        ctx.globalAlpha = 0.4 * fade;
        ctx.fillStyle = spec.color;
        circle(ctx, tx, ty, R); ctx.fill();
        ctx.globalAlpha = fade;
        ctx.strokeStyle = kit.edge; ctx.lineWidth = 2.4;
        circle(ctx, tx, ty, R); ctx.stroke();
        ctx.strokeStyle = kit.core; ctx.lineWidth = 1.2;
        circle(ctx, tx, ty, R * 0.55); ctx.stroke();
        break;
      }
      case SHAPE.trap: {
        const s = 10 + 4 * fade;
        ctx.globalAlpha = fade;
        ctx.fillStyle = spec.color;
        diamond(ctx, tx, ty, s); ctx.fill();
        ctx.strokeStyle = kit.edge; ctx.lineWidth = 2;
        diamond(ctx, tx, ty, s); ctx.stroke();
        ctx.strokeStyle = kit.core; ctx.lineWidth = 1.2;
        diamond(ctx, tx, ty, s * 0.5); ctx.stroke();
        break;
      }
      case SHAPE.detonate: {
        const R = 10 + 22 * pr;
        ctx.globalAlpha = fade;
        ctx.strokeStyle = kit.edge; ctx.lineWidth = 3;
        star(ctx, tx, ty, R, R * 0.45, 6); ctx.stroke();
        ctx.fillStyle = spec.color;
        ctx.globalAlpha = 0.45 * fade;
        star(ctx, tx, ty, R * 0.8, R * 0.35, 6); ctx.fill();
        break;
      }
      case SHAPE.tether: {
        ctx.globalAlpha = fade;
        ctx.strokeStyle = kit.edge; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = spec.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = kit.core;
        circle(ctx, tx, ty, 4); ctx.fill();
        break;
      }
      case SHAPE.blight: {
        const R = (c.reach || 50) * (0.4 + 0.35 * pr);
        ctx.globalAlpha = 0.3 * fade;
        ctx.fillStyle = spec.color;
        circle(ctx, tx, ty, R); ctx.fill();
        ctx.globalAlpha = fade;
        ctx.strokeStyle = kit.edge; ctx.lineWidth = 2;
        circle(ctx, tx, ty, R); ctx.stroke();
        ctx.strokeStyle = spec.color;
        ctx.setLineDash([5, 4]);
        circle(ctx, tx, ty, R * (0.55 + 0.2 * Math.sin(this.t * 8))); ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case SHAPE.summonBurst: {
        ctx.globalAlpha = fade;
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2 + pr * 1.2;
          const rr = 10 + 16 * pr;
          ctx.fillStyle = i % 2 ? spec.color : kit.core;
          diamond(ctx, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr - 8 * pr, 4);
          ctx.fill();
        }
        ctx.strokeStyle = kit.edge; ctx.lineWidth = 2;
        circle(ctx, x, y, 8 + 10 * pr); ctx.stroke();
        break;
      }
      default: {
        const R = 16 + 10 * fade;
        ctx.globalAlpha = fade;
        ctx.fillStyle = spec.color;
        circle(ctx, tx, ty, R * 0.45); ctx.fill();
        ctx.strokeStyle = kit.edge; ctx.lineWidth = 2.2;
        circle(ctx, tx, ty, R); ctx.stroke();
      }
    }
    if (spec.spriteId) {
      const atx = (shape === SHAPE.shockwave || shape === SHAPE.ring || shape === SHAPE.healPulse
        || shape === SHAPE.wardShell || shape === SHAPE.summonBurst) ? x : tx;
      const aty = atx === x ? y : ty;
      drawSprite(ctx, spec.spriteId, atx, aty, {
        scale: spriteScaleFor(spec.spriteId, 28),
        rot: c.a,
        alpha: fade,
      });
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawBoltPrimitive(ctx, pr, spec, heading, visR) {
    const r = visR || (spec ? 10 : (pr.radius || 5));
    const col = spec ? spec.boltColor : (pr.color || (pr.friendly ? '#fff' : '#ff5d6c'));
    const edge = spec ? spec.kit.edge : PALETTE.outline;
    const core = spec ? spec.kit.core : '#fff';
    const particle = spec ? spec.kit.particle : 'spark';
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(heading);
    ctx.fillStyle = col;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    if (!pr.friendly) {
      circle(ctx, 0, 0, r); ctx.fill(); ctx.stroke();
      ctx.restore();
      return;
    }
    switch (particle) {
      case 'shard': // samurai — long cream blade
        ctx.beginPath();
        ctx.moveTo(r * 2.1, 0);
        ctx.lineTo(-r * 1.1, -r * 0.55);
        ctx.lineTo(-r * 0.4, 0);
        ctx.lineTo(-r * 1.1, r * 0.55);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.moveTo(r * 1.4, 0); ctx.lineTo(-r * 0.2, -r * 0.18); ctx.lineTo(-r * 0.2, r * 0.18);
        ctx.closePath(); ctx.fill();
        break;
      case 'fletch': // hunter — arrow
        ctx.beginPath();
        ctx.moveTo(r * 2.2, 0);
        ctx.lineTo(-r * 0.6, -r * 0.7);
        ctx.lineTo(-r * 0.1, 0);
        ctx.lineTo(-r * 0.6, r * 0.7);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = core; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(r * 1.6, 0); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 1.3, -r * 0.55); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(-r * 1.3, r * 0.55);
        ctx.stroke();
        break;
      case 'crystal': // mage
        diamond(ctx, 0, 0, r * 1.35); ctx.fill(); ctx.stroke();
        ctx.fillStyle = core;
        diamond(ctx, 0, 0, r * 0.5); ctx.fill();
        break;
      case 'spark': // wizard / smith
        ctx.beginPath();
        ctx.moveTo(r * 1.8, 0);
        ctx.lineTo(-r * 0.7, -r * 0.85);
        ctx.lineTo(-r * 0.15, 0);
        ctx.lineTo(-r * 0.7, r * 0.85);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = core;
        diamond(ctx, r * 0.2, 0, r * 0.4); ctx.fill();
        break;
      case 'ray': // priest
        ctx.beginPath();
        ctx.moveTo(r * 2.0, 0);
        ctx.lineTo(-r * 0.9, -r * 0.4);
        ctx.lineTo(-r * 0.9, r * 0.4);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = core;
        circle(ctx, r * 0.3, 0, r * 0.35); ctx.fill();
        break;
      case 'note': // bard
        circle(ctx, r * 0.4, r * 0.15, r * 0.7); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(r * 1.05, r * 0.15); ctx.lineTo(r * 1.05, -r * 1.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 1.05, -r * 1.3); ctx.lineTo(r * 0.15, -r * 1.0); ctx.stroke();
        break;
      case 'bone': // necro
        ctx.beginPath();
        ctx.moveTo(r * 1.7, 0);
        ctx.lineTo(r * 0.9, -r * 0.45);
        ctx.lineTo(-r * 1.1, -r * 0.35);
        ctx.lineTo(-r * 1.5, 0);
        ctx.lineTo(-r * 1.1, r * 0.35);
        ctx.lineTo(r * 0.9, r * 0.45);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = core;
        circle(ctx, r * 1.15, 0, r * 0.28); ctx.fill();
        break;
      case 'thread': // witch doctor
        ctx.beginPath();
        ctx.moveTo(r * 1.6, 0);
        ctx.quadraticCurveTo(0, -r * 1.1, -r * 1.4, 0);
        ctx.quadraticCurveTo(0, r * 1.1, r * 1.6, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'spray': // sundian
        ctx.beginPath();
        ctx.moveTo(r * 1.9, 0);
        ctx.lineTo(-r * 0.4, -r * 0.95);
        ctx.lineTo(-r * 0.9, 0);
        ctx.lineTo(-r * 0.4, r * 0.95);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = core;
        circle(ctx, r * 0.5, 0, r * 0.3); ctx.fill();
        break;
      case 'leaf': // druid
        ctx.beginPath();
        ctx.moveTo(r * 1.8, 0);
        ctx.quadraticCurveTo(r * 0.2, -r * 1.0, -r * 1.3, 0);
        ctx.quadraticCurveTo(r * 0.2, r * 1.0, r * 1.8, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = core; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(r * 1.2, 0); ctx.stroke();
        break;
      case 'blood': // savage
        ctx.beginPath();
        ctx.moveTo(r * 1.7, 0);
        ctx.lineTo(-r * 0.5, -r * 0.9);
        ctx.lineTo(-r * 1.2, -r * 0.2);
        ctx.lineTo(-r * 0.5, r * 0.9);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'dust': // monk
        diamond(ctx, 0, 0, r * 1.15); ctx.fill(); ctx.stroke();
        ctx.fillStyle = core;
        circle(ctx, r * 0.15, 0, r * 0.35); ctx.fill();
        break;
      case 'glint': // assassin
        ctx.beginPath();
        ctx.moveTo(r * 2.0, 0);
        ctx.lineTo(-r * 0.3, -r * 0.35);
        ctx.lineTo(-r * 1.4, 0);
        ctx.lineTo(-r * 0.3, r * 0.35);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      default:
        diamond(ctx, 0, 0, r * 1.15); ctx.fill(); ctx.stroke();
        ctx.fillStyle = core;
        diamond(ctx, 0, 0, r * 0.4); ctx.fill();
    }
    ctx.restore();
  }

  _drawHitboxes(ctx, view) {
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 1;
    for (const e of view.enemies || []) { circle(ctx, e.x, e.y, e.radius); ctx.stroke(); }
    for (const p of view.players || []) { if (!p.gone) { circle(ctx, p.x, p.y, p.radius || 16); ctx.stroke(); } }
    for (const pr of view.projs || []) { circle(ctx, pr.x, pr.y, pr.radius || 5); ctx.stroke(); }
  }
}

// ---------------- shape helpers ----------------

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); }
function diamond(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
  ctx.closePath();
}
function rect(ctx, x, y, w, h, rad) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, rad) : ctx.rect(x, y, w, h);
}
function poly(ctx, x, y, r, n, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
function star(ctx, x, y, r1, r2, n) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function drawShape(ctx, shape, r, t) {
  switch (shape) {
    case 'triangle': poly(ctx, 0, 0, r, 3, t * 0.8); break;
    case 'square': poly(ctx, 0, 0, r, 4, Math.PI / 4); break;
    case 'diamond': diamond(ctx, 0, 0, r); break;
    case 'pentagon': poly(ctx, 0, 0, r, 5); break;
    case 'hex': poly(ctx, 0, 0, r, 6); break;
    case 'star': star(ctx, 0, 0, r, r * 0.5, 5); break;
    case 'cross': {
      const w = r * 0.42;
      ctx.beginPath();
      ctx.moveTo(-w, -r); ctx.lineTo(w, -r); ctx.lineTo(w, -w); ctx.lineTo(r, -w);
      ctx.lineTo(r, w); ctx.lineTo(w, w); ctx.lineTo(w, r); ctx.lineTo(-w, r);
      ctx.lineTo(-w, w); ctx.lineTo(-r, w); ctx.lineTo(-r, -w); ctx.lineTo(-w, -w);
      ctx.closePath();
      break;
    }
    case 'arrow': {
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.lineTo(-r * 0.7, -r * 0.7); ctx.lineTo(-r * 0.3, 0); ctx.lineTo(-r * 0.7, r * 0.7);
      ctx.closePath();
      break;
    }
    case 'thindiamond': {
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.45, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.45, 0);
      ctx.closePath();
      break;
    }
    default: circle(ctx, 0, 0, r);
  }
}
