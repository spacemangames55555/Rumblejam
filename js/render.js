// Canvas renderer. Consumes a plain "view" object (built by main.js from the
// live Sim on the host, or from interpolated snapshots on clients) so the same
// draw code serves both. All art is primitives; no assets.

import { CONFIG, PALETTE } from './config.js';
import { WEAPON_BY_ID } from './content/weapons.js';
import { clamp } from './util.js';

// The camera viewport is one "screen" of world units (the old room size);
// arenas are several screens wide and the camera follows your character.
const { ROOM_W: VIEW_W, ROOM_H: VIEW_H, WALL } = CONFIG;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.floaters = [];
    this.arcs = [];
    this.flashBeams = [];
    this.rings = [];
    this.shakeEnabled = true;
    this.showHitboxes = false;
    this.t = 0;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    // cap DPR at 2 — 3x panels on phones cost fill-rate for no visible gain
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * this.dpr;
    this.canvas.height = window.innerHeight * this.dpr;
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
    for (const bm of fx.beams || []) this.flashBeams.push({ ...bm, t: 0, dur: 0.16 });
    for (const s of fx.swings || []) this.arcs.push({ ...s, t: 0, dur: 0.16 });
    for (const bl of fx.blocks || []) this.rings.push({ x: bl.x, y: bl.y, r: 30, t: 0, dur: 0.25, color: '#5ea8ff' });
    if (this.particles.length > CONFIG.POOL_PARTICLES) this.particles.splice(0, this.particles.length - CONFIG.POOL_PARTICLES);
  }

  draw(view, dtFrame) {
    this.t += dtFrame;
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
      diamond(ctx, m.x, m.y + bob, 7);
      ctx.fill(); ctx.stroke();
    }
    for (const d of view.decoys || []) { if (inView(d.x, d.y)) this._drawDecoy(ctx, d, view); }
    for (const s of view.summons || []) { if (inView(s.x, s.y)) this._drawSummon(ctx, s, view); }
    for (const e of view.enemies || []) { if (inView(e.x, e.y, e.radius)) this._drawEnemy(ctx, e); }
    for (const p of view.players || []) if (!p.gone) this._drawPlayer(ctx, p, view);
    // projectiles
    for (const pr of view.projs || []) {
      if (!inView(pr.x, pr.y)) continue;
      ctx.fillStyle = pr.color || (pr.friendly ? '#fff' : '#ff5d6c');
      ctx.strokeStyle = PALETTE.outline;
      ctx.lineWidth = 1.5;
      circle(ctx, pr.x, pr.y, pr.radius || 5);
      ctx.fill(); ctx.stroke();
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
    this._drawJoystick(ctx);
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
    ctx.globalAlpha = 0.25 + 0.35 * d.frac;
    ctx.fillStyle = color;
    circle(ctx, d.x, d.y, 16); ctx.fill();
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

  // The arena: floor grid (visible span only), border walls, and obstacles.
  _drawArena(ctx, view, aw, ah, cl, cr, ct, cb) {
    // floor over the visible region
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(Math.max(0, cl), Math.max(0, ct), Math.min(aw, cr) - Math.max(0, cl), Math.min(ah, cb) - Math.max(0, ct));
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gx0 = Math.max(WALL, Math.floor(cl / 64) * 64), gx1 = Math.min(aw - WALL, cr);
    const gy0 = Math.max(WALL, Math.floor(ct / 64) * 64), gy1 = Math.min(ah - WALL, cb);
    for (let x = gx0; x <= gx1; x += 64) { ctx.moveTo(x, Math.max(WALL, ct)); ctx.lineTo(x, Math.min(ah - WALL, cb)); }
    for (let y = gy0; y <= gy1; y += 64) { ctx.moveTo(Math.max(WALL, cl), y); ctx.lineTo(Math.min(aw - WALL, cr), y); }
    ctx.stroke();
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
        ctx.fillStyle = 'rgba(120,96,72,0.85)';   // repaints the damaged ones on top
        ctx.fillRect(o[0], o[1], o[2], o[3]);
        ctx.strokeStyle = '#a8794e';
        ctx.lineWidth = 3;
        ctx.strokeRect(o[0], o[1], o[2], o[3]);
        continue;
      }
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(o[0], o[1], o[2], o[3]);
      ctx.strokeStyle = PALETTE.wallEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(o[0], o[1], o[2], o[3]);
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
      ctx.fillStyle = 'rgba(255,171,79,0.22)';
      ctx.fillRect(dx - 10, 0, 20, view.ah || 2000);
      ctx.strokeStyle = '#ffab4f';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(dx, 0); ctx.lineTo(dx, view.ah || 2000); ctx.stroke();
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
      ctx.strokeStyle = open ? PALETTE.doorOpen : '#ffab4f';
      ctx.lineWidth = 5;
      ctx.setLineDash([10, 7]);
      circle(ctx, gx, gy, 74 + Math.sin(this.t * 3) * 4); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = open ? PALETTE.doorOpen : '#ffab4f';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(open ? 'GATE' : 'SEALED GATE', gx, gy - 88);
    }
    for (const [wx, wy, ww, wh, frac] of o.walls || []) { // nest barricades
      // Two rings per nest, and they visibly lose the argument: the fill fades
      // and the crack line grows as the barricade comes apart, so "how much
      // more of this wall" reads at a glance without a health bar per segment.
      ctx.fillStyle = `rgba(120,96,72,${0.35 + 0.5 * frac})`;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeStyle = frac > 0.5 ? '#a8794e' : '#ff9d5c';
      ctx.lineWidth = 3;
      ctx.strokeRect(wx, wy, ww, wh);
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
      ctx.strokeStyle = '#ffd45e';
      ctx.lineWidth = 5;
      circle(ctx, ax, ay, 84); ctx.stroke();
      ctx.fillStyle = 'rgba(255,212,94,0.10)';
      circle(ctx, ax, ay, 84); ctx.fill();
      ctx.fillStyle = '#ffd45e';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('ALTAR', ax, ay - 96);
      for (const [rx, ry, carrier] of o.relics || []) {
        ctx.fillStyle = carrier >= 0 ? '#c9a6ff' : '#ffd45e';
        ctx.strokeStyle = PALETTE.outline;
        ctx.lineWidth = 3;
        const bob = Math.sin(this.t * 4 + rx * 0.1) * 3;
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
      ctx.fillStyle = stalled ? '#ff5d6c' : '#c98b4f';
      ctx.strokeStyle = PALETTE.outline;
      ctx.lineWidth = 3;
      rect(ctx, dx - 26, dy - 20, 52, 40, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#12141f';
      rect(ctx, dx - 22, dy + 22, 44, 7, 3); ctx.fill();
      ctx.fillStyle = hpFrac > 0.35 ? PALETTE.doorOpen : '#ff5d6c';
      rect(ctx, dx - 22, dy + 22, 44 * Math.max(0, hpFrac), 7, 3); ctx.fill();
      ctx.fillStyle = stalled ? '#ff5d6c' : (escorted ? PALETTE.doorOpen : '#9aa0bd');
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(stalled ? 'STALLED' : (escorted ? 'DRILLING' : 'ESCORT ME'), dx, dy - 32);
    }
    for (const [nx, ny, hpf, shielded] of o.nests || []) { // nest purge: mark every spawner
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
    ctx.fillStyle = '#0a0b12';
    ctx.strokeStyle = PALETTE.doorOpen;
    ctx.lineWidth = 4;
    circle(ctx, 0, 0, 52); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#1e6e4e';
    ctx.lineWidth = 3;
    circle(ctx, 0, 0, 34 + 7 * Math.sin(this.t * 3)); ctx.stroke();
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
    drawShape(ctx, e.shape, r, this.t + (e.id || 0));
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (e.elite) {
      ctx.strokeStyle = PALETTE.elite;
      ctx.lineWidth = 2.5;
      circle(ctx, 0, 0, r + 6); ctx.stroke();
    }
    if (e.fusing) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 30);
      ctx.fillStyle = '#fff';
      drawShape(ctx, e.shape, r, this.t);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (e.flash) {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#fff';
      drawShape(ctx, e.shape, r, this.t + (e.id || 0));
      ctx.fill();
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
      circle(ctx, 0, 0, r); ctx.fill(); ctx.stroke();
      if (p.shield > 0) {
        ctx.strokeStyle = '#4fd8eb';
        ctx.lineWidth = 3;
        circle(ctx, 0, 0, r + 5); ctx.stroke();
      }
      ctx.fillStyle = '#0b0c12';
      ctx.font = `bold ${Math.round(r * 1.05)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.sym || '●', 0, 1);
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

  _drawSummon(ctx, s, view) {
    ctx.save();
    ctx.translate(s.x, s.y);
    const owner = (view.players || []).find(p => p.idx === s.owner);
    const col = owner ? owner.color : '#4fd8eb';
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = 2.5;
    // just recalled: bolting itself back down, inert and translucent
    if (s.packed) { ctx.globalAlpha = 0.45; ctx.scale(0.8, 0.8); }
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
      const pr = a.t / a.dur;
      ctx.globalAlpha = 0.55 * (1 - pr);
      ctx.fillStyle = a.color || '#fff';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.arc(a.x, a.y, a.r, a.a - a.arc / 2, a.a + a.arc / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = this.flashBeams.length - 1; i >= 0; i--) {
      const b = this.flashBeams[i];
      b.t += dt;
      if (b.t >= b.dur) { this.flashBeams.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - b.t / b.dur;
      ctx.strokeStyle = b.color || '#ff5d6c';
      ctx.lineWidth = (b.w || 4) * (1 - b.t / b.dur) + 1;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
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
