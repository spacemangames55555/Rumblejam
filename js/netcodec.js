// Snapshot wire codec (the Warband netcode). The sim's getSnapshot() keeps
// its readable array-of-arrays shape; this module packs the heavy lists
// (enemies, projectiles, pickups, zones, telegraphs, fx) into typed buffers
// for the wire and unpacks them back into the exact same shape on the
// client, so the interpolation path never knows the wire changed.
//
// PeerJS's default BinaryPack serialization passes ArrayBuffers through as
// raw bytes; every number in a plain JS array costs 3–9 bytes there, so
// packing a 300-enemy crest is the difference between ~12 KB and ~4 KB per
// snapshot. Colors travel once per snapshot in a small string LUT (`cols`)
// and everything spatial quantizes to whole units (u16) — invisible at
// render scale, and the arenas cap out around 4000 u.

// ---- per-record byte layouts (DataView, little-endian) ----
const EN_STRIDE = 9;    // u16 id | i8 typeIdx | u8 flags | u16 x | u16 y | u8 hp%
const PR_STRIDE = 13;   // u16 id | u16 x | u16 y | i16 vx | i16 vy | u8 flags | u8 radius | u8 col
const PK_STRIDE = 4;    // u16 x | u16 y
const ZN_STRIDE = 8;    // u16 x | u16 y | u16 r | u8 col | u8 hostile
const TG_STRIDE = 12;   // u8 kind | u16 x | u16 y | u16 r/w | u16 len | i16 a×1000 | u8 prog×200 | u8 spawn
const FX_HIT = 7;       // u16 x | i16 y | u16 amount | u8 c
const FX_DEATH = 6;     // u16 x | u16 y | u8 col | u8 r
const FX_BOOM = 5;      // u16 x | u16 y | u8 r
const FX_BLOCK = 4;     // u16 x | u16 y
const FX_SWING = 10;    // u16 x | u16 y | i16 a×1000 | u16 r | u8 arc×100 | u8 col
const FX_BEAM = 10;     // u16 x1 | u16 y1 | u16 x2 | u16 y2 | u8 col | u8 w

const cU16 = v => Math.max(0, Math.min(65535, Math.round(v)));
const cI16 = v => Math.max(-32768, Math.min(32767, Math.round(v)));
const cU8 = v => Math.max(0, Math.min(255, Math.round(v)));

class ColorLut {
  constructor() { this.list = []; this.map = new Map(); }
  idx(color) {
    const c = String(color);
    let i = this.map.get(c);
    if (i === undefined) { i = Math.min(255, this.list.length); if (this.list.length < 256) { this.map.set(c, i); this.list.push(c); } }
    return i;
  }
}

export function encodeSnap(snap) {
  const lut = new ColorLut();
  const out = { ...snap };

  // enemies
  {
    const src = snap.enemies;
    const buf = new ArrayBuffer(src.length * EN_STRIDE);
    const dv = new DataView(buf);
    for (let i = 0, o = 0; i < src.length; i++, o += EN_STRIDE) {
      const e = src[i];
      dv.setUint16(o, e[0] & 0xffff, true);
      dv.setInt8(o + 2, e[1]);
      dv.setUint8(o + 3, e[5]);
      dv.setUint16(o + 4, cU16(e[2]), true);
      dv.setUint16(o + 6, cU16(e[3]), true);
      dv.setUint8(o + 8, cU8(e[4] * 255));
    }
    out.eb = buf; delete out.enemies;
  }
  // projectiles
  {
    const src = snap.projs;
    const buf = new ArrayBuffer(src.length * PR_STRIDE);
    const dv = new DataView(buf);
    for (let i = 0, o = 0; i < src.length; i++, o += PR_STRIDE) {
      const p = src[i];
      dv.setUint16(o, p[0] & 0xffff, true);
      dv.setUint16(o + 2, cU16(p[1]), true);
      dv.setUint16(o + 4, cU16(p[2]), true);
      dv.setInt16(o + 6, cI16(p[3]), true);
      dv.setInt16(o + 8, cI16(p[4]), true);
      dv.setUint8(o + 10, p[5] ? 1 : 0);
      dv.setUint8(o + 11, cU8(p[6]));
      dv.setUint8(o + 12, lut.idx(p[7]));
    }
    out.pb = buf; delete out.projs;
  }
  // pickups
  {
    const src = snap.pickups;
    const buf = new ArrayBuffer(src.length * PK_STRIDE);
    const dv = new DataView(buf);
    for (let i = 0, o = 0; i < src.length; i++, o += PK_STRIDE) {
      dv.setUint16(o, cU16(src[i][0]), true);
      dv.setUint16(o + 2, cU16(src[i][1]), true);
    }
    out.kb = buf; delete out.pickups;
  }
  // zones
  {
    const src = snap.zones;
    const buf = new ArrayBuffer(src.length * ZN_STRIDE);
    const dv = new DataView(buf);
    for (let i = 0, o = 0; i < src.length; i++, o += ZN_STRIDE) {
      const z = src[i];
      dv.setUint16(o, cU16(z[0]), true);
      dv.setUint16(o + 2, cU16(z[1]), true);
      dv.setUint16(o + 4, cU16(z[2]), true);
      dv.setUint8(o + 6, lut.idx(z[3]));
      dv.setUint8(o + 7, z[4] ? 1 : 0);
    }
    out.zb = buf; delete out.zones;
  }
  // telegraphs
  {
    const src = snap.tele;
    const buf = new ArrayBuffer(src.length * TG_STRIDE);
    const dv = new DataView(buf);
    for (let i = 0, o = 0; i < src.length; i++, o += TG_STRIDE) {
      const t = src[i];
      const circle = t[0] === 'c';
      dv.setUint8(o, circle ? 0 : 1);
      dv.setUint16(o + 1, cU16(t[1]), true);
      dv.setUint16(o + 3, cU16(t[2]), true);
      if (circle) { // ['c',x,y,r,prog,spawn] — spawn flag rides the unused len slot
        dv.setUint16(o + 5, cU16(t[3]), true);
        dv.setUint16(o + 7, 0, true);
        dv.setUint8(o + 8, t[5] ? 1 : 0);
        dv.setInt16(o + 9, 0, true);
        dv.setUint8(o + 11, cU8(t[4] * 200));
      } else {      // ['b',x,y,a,w,len,prog]
        dv.setUint16(o + 5, cU16(t[4]), true);          // w
        dv.setUint16(o + 7, cU16(t[5]), true);          // len
        dv.setInt16(o + 9, cI16(t[3] * 1000), true);    // angle
        dv.setUint8(o + 11, cU8(t[6] * 200));           // prog
      }
    }
    out.tb = buf; delete out.tele;
  }
  // fx
  {
    const fx = snap.fx || {};
    const pack = (list, stride, fill) => {
      const buf = new ArrayBuffer((list || []).length * stride);
      const dv = new DataView(buf);
      (list || []).forEach((e, i) => fill(dv, i * stride, e));
      return buf;
    };
    out.fxb = {
      h: pack(fx.hits, FX_HIT, (dv, o, e) => {
        dv.setUint16(o, cU16(e.x), true); dv.setInt16(o + 2, cI16(e.y), true);
        dv.setUint16(o + 4, cU16(e.a), true); dv.setUint8(o + 6, cU8(e.c));
      }),
      d: pack(fx.deaths, FX_DEATH, (dv, o, e) => {
        dv.setUint16(o, cU16(e.x), true); dv.setUint16(o + 2, cU16(e.y), true);
        dv.setUint8(o + 4, lut.idx(e.c)); dv.setUint8(o + 5, cU8(e.r));
      }),
      m: pack(fx.booms, FX_BOOM, (dv, o, e) => {
        dv.setUint16(o, cU16(e.x), true); dv.setUint16(o + 2, cU16(e.y), true);
        dv.setUint8(o + 4, cU8(e.r));
      }),
      k: pack(fx.blocks, FX_BLOCK, (dv, o, e) => {
        dv.setUint16(o, cU16(e.x), true); dv.setUint16(o + 2, cU16(e.y), true);
      }),
      s: pack(fx.swings, FX_SWING, (dv, o, e) => {
        dv.setUint16(o, cU16(e.x), true); dv.setUint16(o + 2, cU16(e.y), true);
        dv.setInt16(o + 4, cI16(e.a * 1000), true); dv.setUint16(o + 6, cU16(e.r), true);
        dv.setUint8(o + 8, cU8((e.arc || 0) * 100)); dv.setUint8(o + 9, lut.idx(e.color));
      }),
      b: pack(fx.beams, FX_BEAM, (dv, o, e) => {
        dv.setUint16(o, cU16(e.x1), true); dv.setUint16(o + 2, cU16(e.y1), true);
        dv.setUint16(o + 4, cU16(e.x2), true); dv.setUint16(o + 6, cU16(e.y2), true);
        dv.setUint8(o + 8, lut.idx(e.color)); dv.setUint8(o + 9, cU8(e.w || 0));
      }),
    };
    delete out.fx;
  }
  out.cols = lut.list;
  return out;
}

// PeerJS may deliver ArrayBuffer or a TypedArray view depending on transport
function asView(b) {
  if (!b) return new DataView(new ArrayBuffer(0));
  if (b instanceof ArrayBuffer) return new DataView(b);
  return new DataView(b.buffer, b.byteOffset, b.byteLength);
}

export function decodeSnap(wire) {
  const cols = wire.cols || [];
  const col = i => cols[i] || '#ffffff';
  const out = { ...wire };
  delete out.eb; delete out.pb; delete out.kb; delete out.zb; delete out.tb; delete out.fxb; delete out.cols;

  {
    const dv = asView(wire.eb);
    const n = Math.floor(dv.byteLength / EN_STRIDE);
    const enemies = new Array(n);
    for (let i = 0, o = 0; i < n; i++, o += EN_STRIDE) {
      enemies[i] = [dv.getUint16(o, true), dv.getInt8(o + 2), dv.getUint16(o + 4, true),
        dv.getUint16(o + 6, true), dv.getUint8(o + 8) / 255, dv.getUint8(o + 3)];
    }
    out.enemies = enemies;
  }
  {
    const dv = asView(wire.pb);
    const n = Math.floor(dv.byteLength / PR_STRIDE);
    const projs = new Array(n);
    for (let i = 0, o = 0; i < n; i++, o += PR_STRIDE) {
      projs[i] = [dv.getUint16(o, true), dv.getUint16(o + 2, true), dv.getUint16(o + 4, true),
        dv.getInt16(o + 6, true), dv.getInt16(o + 8, true), dv.getUint8(o + 10),
        dv.getUint8(o + 11), col(dv.getUint8(o + 12))];
    }
    out.projs = projs;
  }
  {
    const dv = asView(wire.kb);
    const n = Math.floor(dv.byteLength / PK_STRIDE);
    const pickups = new Array(n);
    for (let i = 0, o = 0; i < n; i++, o += PK_STRIDE) pickups[i] = [dv.getUint16(o, true), dv.getUint16(o + 2, true)];
    out.pickups = pickups;
  }
  {
    const dv = asView(wire.zb);
    const n = Math.floor(dv.byteLength / ZN_STRIDE);
    const zones = new Array(n);
    for (let i = 0, o = 0; i < n; i++, o += ZN_STRIDE) {
      zones[i] = [dv.getUint16(o, true), dv.getUint16(o + 2, true), dv.getUint16(o + 4, true),
        col(dv.getUint8(o + 6)), dv.getUint8(o + 7)];
    }
    out.zones = zones;
  }
  {
    const dv = asView(wire.tb);
    const n = Math.floor(dv.byteLength / TG_STRIDE);
    const tele = new Array(n);
    for (let i = 0, o = 0; i < n; i++, o += TG_STRIDE) {
      if (dv.getUint8(o) === 0) {
        tele[i] = ['c', dv.getUint16(o + 1, true), dv.getUint16(o + 3, true), dv.getUint16(o + 5, true),
          Math.min(1, dv.getUint8(o + 11) / 200), dv.getUint8(o + 8)];
      } else {
        tele[i] = ['b', dv.getUint16(o + 1, true), dv.getUint16(o + 3, true), dv.getInt16(o + 9, true) / 1000,
          dv.getUint16(o + 5, true), dv.getUint16(o + 7, true), Math.min(1, dv.getUint8(o + 11) / 200)];
      }
    }
    out.tele = tele;
  }
  {
    const fb = wire.fxb || {};
    const un = (b, stride, read) => {
      const dv = asView(b);
      const n = Math.floor(dv.byteLength / stride);
      const list = new Array(n);
      for (let i = 0; i < n; i++) list[i] = read(dv, i * stride);
      return list;
    };
    out.fx = {
      hits: un(fb.h, FX_HIT, (dv, o) => ({ x: dv.getUint16(o, true), y: dv.getInt16(o + 2, true), a: dv.getUint16(o + 4, true), c: dv.getUint8(o + 6) })),
      deaths: un(fb.d, FX_DEATH, (dv, o) => ({ x: dv.getUint16(o, true), y: dv.getUint16(o + 2, true), c: col(dv.getUint8(o + 4)), r: dv.getUint8(o + 5) })),
      booms: un(fb.m, FX_BOOM, (dv, o) => ({ x: dv.getUint16(o, true), y: dv.getUint16(o + 2, true), r: dv.getUint8(o + 4) })),
      blocks: un(fb.k, FX_BLOCK, (dv, o) => ({ x: dv.getUint16(o, true), y: dv.getUint16(o + 2, true) })),
      swings: un(fb.s, FX_SWING, (dv, o) => ({ x: dv.getUint16(o, true), y: dv.getUint16(o + 2, true), a: dv.getInt16(o + 4, true) / 1000, r: dv.getUint16(o + 6, true), arc: dv.getUint8(o + 8) / 100, color: col(dv.getUint8(o + 9)) })),
      beams: un(fb.b, FX_BEAM, (dv, o) => ({ x1: dv.getUint16(o, true), y1: dv.getUint16(o + 2, true), x2: dv.getUint16(o + 4, true), y2: dv.getUint16(o + 6, true), color: col(dv.getUint8(o + 8)), w: dv.getUint8(o + 9) })),
    };
  }
  return out;
}

// Approximate BinaryPack wire size of a message — used for the host's
// bandwidth ledger and the sim-side size gate. Rules mirror binarypack:
// small ints are 1–5 bytes, doubles 9, strings utf8+header, buffers raw.
export function wireSize(v) {
  if (v === null || v === undefined || typeof v === 'boolean') return 1;
  if (typeof v === 'number') {
    if (Number.isInteger(v)) {
      const a = Math.abs(v);
      if (a < 128) return 1;
      if (a < 32768) return 3;
      return 5;
    }
    return 9;
  }
  if (typeof v === 'string') return 2 + utf8Len(v);
  if (v instanceof ArrayBuffer) return 5 + v.byteLength;
  if (ArrayBuffer.isView(v)) return 5 + v.byteLength;
  if (Array.isArray(v)) { let s = 3; for (const e of v) s += wireSize(e); return s; }
  if (typeof v === 'object') {
    let s = 3;
    for (const k in v) { if (v[k] === undefined) continue; s += 2 + utf8Len(k) + wireSize(v[k]); }
    return s;
  }
  return 1;
}
function utf8Len(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); n += c < 0x80 ? 1 : c < 0x800 ? 2 : 3; }
  return n;
}
