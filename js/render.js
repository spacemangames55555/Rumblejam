// Canvas renderer. Consumes a plain "view" object (built by main.js from the
// live Sim on the host, or from interpolated snapshots on clients) so the same
// draw code serves both. All art is primitives; no assets.

import { CONFIG, PALETTE } from './config.js';
import { WEAPON_BY_ID } from './content/weapons.js';
import { clamp } from './util.js';

const { ROOM_W: W, ROOM_H: H, WALL, DOOR_W } = CONFIG;

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
    if (!view) return;

    const scale = Math.min(cw / W, ch / H);
    let ox = (cw - W * scale) / 2, oy = (ch - H * scale) / 2;
    if (this.shakeEnabled && view.shake > 0) {
      ox += (Math.random() * 2 - 1) * view.shake * scale;
      oy += (Math.random() * 2 - 1) * view.shake * scale;
    }
    ctx.setTransform(scale, 0, 0, scale, ox, oy);

    this._drawRoom(ctx, view);
    this._drawHazards(ctx, view);
    for (const z of view.zones || []) {
      ctx.globalAlpha = 0.3 + 0.08 * Math.sin(this.t * 6);
      ctx.fillStyle = z.color || '#ff7b3a';
      circle(ctx, z.x, z.y, z.r); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = z.color; ctx.lineWidth = 2;
      circle(ctx, z.x, z.y, z.r); ctx.stroke();
    }
    if (view.hatch) this._drawHatch(ctx, view.hatch[0], view.hatch[1]);
    this._drawTelegraphs(ctx, view);
    // pickups
    ctx.fillStyle = PALETTE.material;
    ctx.strokeStyle = PALETTE.materialEdge;
    ctx.lineWidth = 2;
    for (const m of view.pickups || []) {
      const bob = Math.sin(this.t * 5 + m.x * 0.13) * 2;
      diamond(ctx, m.x, m.y + bob, 7);
      ctx.fill(); ctx.stroke();
    }
    for (const s of view.summons || []) this._drawSummon(ctx, s, view);
    for (const e of view.enemies || []) this._drawEnemy(ctx, e);
    for (const p of view.players || []) if (!p.gone) this._drawPlayer(ctx, p, view);
    // projectiles
    for (const pr of view.projs || []) {
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
    this._drawDoorCountdown(ctx, view);
    if (this.showHitboxes) this._drawHitboxes(ctx, view);
    this._drawJoystick(ctx);
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

  _drawRoom(ctx, view) {
    // floor
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = WALL; x <= W - WALL; x += 64) { ctx.moveTo(x, WALL); ctx.lineTo(x, H - WALL); }
    for (let y = WALL; y <= H - WALL; y += 64) { ctx.moveTo(WALL, y); ctx.lineTo(W - WALL, y); }
    ctx.stroke();
    // walls
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(0, 0, W, WALL); ctx.fillRect(0, H - WALL, W, WALL);
    ctx.fillRect(0, 0, WALL, H); ctx.fillRect(W - WALL, 0, WALL, H);
    ctx.strokeStyle = PALETTE.wallEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(WALL, WALL, W - 2 * WALL, H - 2 * WALL);
    // doors
    const doors = view.room ? view.room.doors : {};
    const open = view.room && view.cleared && !view.locked;
    const col = open ? PALETTE.doorOpen : PALETTE.doorLocked;
    ctx.fillStyle = col;
    const g = DOOR_W;
    if (doors.n !== undefined) ctx.fillRect(W / 2 - g / 2, 6, g, WALL - 12);
    if (doors.s !== undefined) ctx.fillRect(W / 2 - g / 2, H - WALL + 6, g, WALL - 12);
    if (doors.w !== undefined) ctx.fillRect(6, H / 2 - g / 2, WALL - 12, g);
    if (doors.e !== undefined) ctx.fillRect(W - WALL + 6, H / 2 - g / 2, WALL - 12, g);
    if (open) {
      ctx.fillStyle = '#0c2a1e';
      if (doors.n !== undefined) ctx.fillRect(W / 2 - g / 2 + 8, 10, g - 16, WALL - 20);
      if (doors.s !== undefined) ctx.fillRect(W / 2 - g / 2 + 8, H - WALL + 10, g - 16, WALL - 20);
      if (doors.w !== undefined) ctx.fillRect(10, H / 2 - g / 2 + 8, WALL - 20, g - 16);
      if (doors.e !== undefined) ctx.fillRect(W - WALL + 10, H / 2 - g / 2 + 8, WALL - 20, g - 16);
    }
  }

  _drawHazards(ctx, view) {
    for (const hz of view.hazards || []) {
      if (hz.type === 'lava') {
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
        const y = hz.y, h = hz.h;
        if (hz.state === 0) {
          ctx.fillStyle = 'rgba(200,205,232,0.08)';
          ctx.fillRect(WALL, y - h / 2, W - 2 * WALL, h);
        } else if (hz.state === 1) {
          ctx.fillStyle = 'rgba(255,93,108,0.25)';
          ctx.fillRect(WALL, y - h / 2, W - 2 * WALL, h);
        } else {
          ctx.fillStyle = 'rgba(200,205,232,0.25)';
          ctx.fillRect(WALL, y - h / 2, W - 2 * WALL, h);
          ctx.fillStyle = PALETTE.hazardSpike;
          ctx.strokeStyle = PALETTE.outline;
          ctx.lineWidth = 1.5;
          for (let x = WALL + 12; x < W - WALL - 12; x += 26) {
            ctx.beginPath();
            ctx.moveTo(x, y + h / 2 - 4);
            ctx.lineTo(x + 9, y - h / 2 + 4);
            ctx.lineTo(x + 18, y + h / 2 - 4);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
          }
        }
      }
    }
  }

  _drawHatch(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#0a0b12';
    ctx.strokeStyle = PALETTE.doorOpen;
    ctx.lineWidth = 4;
    circle(ctx, 0, 0, 46); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#1e6e4e';
    ctx.lineWidth = 3;
    circle(ctx, 0, 0, 30 + 6 * Math.sin(this.t * 3)); ctx.stroke();
    ctx.fillStyle = PALETTE.doorOpen;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DESCEND', 0, 4);
    ctx.restore();
  }

  _drawTelegraphs(ctx, view) {
    for (const tg of view.tele || []) {
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

  _drawDoorCountdown(ctx, view) {
    if (!view.door) return;
    const t = Math.max(0, view.door.t);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = 6;
    const label = view.door.kind === 'hatch' ? `Descending in ${t.toFixed(1)}` : `Moving on in ${t.toFixed(1)}`;
    ctx.strokeText(label, W / 2, 120);
    ctx.fillText(label, W / 2, 120);
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
