// Dependency-free PNG read/write. Node's zlib does the compression; everything
// else is here, because the project takes no npm dependencies and has no build
// step, and the art pipeline needs to open a generated sprite, look at its
// pixels and write a new one.
//
// Reads 8-bit greyscale, truecolour, indexed, greyscale+alpha and RGBA, with
// all five scanline filters. Rejects 16-bit and interlaced files with a clear
// message rather than producing quiet garbage — a generator that hands back
// either is a problem to fix at the source.
//
// Writes 8-bit RGBA, filter 0. Sprites are small and flat; there is nothing to
// gain from filter heuristics here.

import zlib from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

// buf -> { width, height, data } with data as tightly packed RGBA bytes.
export function decodePng(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG (bad signature)');

  let width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
  let palette = null, trns = null;
  const idat = [];

  let o = 8;
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    o += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'PLTE') palette = Buffer.from(data);
    else if (type === 'tRNS') trns = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
  }
  if (!width || !height) throw new Error('PNG has no IHDR');
  if (depth !== 8) throw new Error(`PNG bit depth ${depth} is not supported — re-export as 8-bit`);
  if (interlace) throw new Error('interlaced PNG is not supported — re-export without Adam7 interlacing');
  const ch = CHANNELS[colorType];
  if (!ch) throw new Error(`PNG colour type ${colorType} is not supported`);
  if (colorType === 3 && !palette) throw new Error('indexed PNG with no PLTE chunk');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  if (raw.length < height * (stride + 1)) throw new Error('PNG data is truncated');

  // undo the per-scanline filters in place
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const up = dst - stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i];
      const a = i >= ch ? px[dst + i - ch] : 0;
      const b = y > 0 ? px[up + i] : 0;
      const c = y > 0 && i >= ch ? px[up + i - ch] : 0;
      let v;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`unknown PNG filter ${filter} on row ${y}`);
      }
      px[dst + i] = v & 0xff;
    }
  }

  // widen whatever colour type it was into RGBA
  const out = new Uint8Array(width * height * 4);
  for (let i = 0, n = width * height; i < n; i++) {
    const s = i * ch, d = i * 4;
    if (colorType === 6) { out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2]; out[d + 3] = px[s + 3]; }
    else if (colorType === 2) {
      out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2];
      out[d + 3] = (trns && trns.length >= 6 && px[s] === trns[1] && px[s + 1] === trns[3] && px[s + 2] === trns[5]) ? 0 : 255;
    } else if (colorType === 0) {
      const g = px[s];
      out[d] = out[d + 1] = out[d + 2] = g;
      out[d + 3] = (trns && trns.length >= 2 && g === trns[1]) ? 0 : 255;
    } else if (colorType === 4) {
      const g = px[s];
      out[d] = out[d + 1] = out[d + 2] = g; out[d + 3] = px[s + 1];
    } else {
      const idx = px[s], p = idx * 3;
      out[d] = palette[p]; out[d + 1] = palette[p + 1]; out[d + 2] = palette[p + 2];
      out[d + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }
  return { width, height, data: out };
}

// { width, height, data } (RGBA) -> Buffer
export function encodePng({ width, height, data }) {
  if (data.length !== width * height * 4) throw new Error(`encodePng: ${data.length} bytes for ${width}x${height} RGBA`);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------- small raster helpers ----------------

export function blankImage(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

// Copy a w x h rect from src at (sx, sy) into dst at (dx, dy). Clipped.
export function blit(dst, src, sx, sy, w, h, dx, dy) {
  for (let y = 0; y < h; y++) {
    const syy = sy + y, dyy = dy + y;
    if (syy < 0 || syy >= src.height || dyy < 0 || dyy >= dst.height) continue;
    for (let x = 0; x < w; x++) {
      const sxx = sx + x, dxx = dx + x;
      if (sxx < 0 || sxx >= src.width || dxx < 0 || dxx >= dst.width) continue;
      const s = (syy * src.width + sxx) * 4, d = (dyy * dst.width + dxx) * 4;
      dst.data[d] = src.data[s]; dst.data[d + 1] = src.data[s + 1];
      dst.data[d + 2] = src.data[s + 2]; dst.data[d + 3] = src.data[s + 3];
    }
  }
}

export function subImage(src, sx, sy, w, h) {
  const out = blankImage(w, h);
  blit(out, src, sx, sy, w, h, 0, 0);
  return out;
}

// Area-average (box filter) resize, alpha-weighted.
//
// Needed because nearest-neighbour is only honest when UPSCALING. A 256px sheet
// shown at 72 device pixels via nearest-neighbour throws away roughly seven of
// every eight pixels and picks the survivors arbitrarily, which is aliasing, not
// downscaling — thin limbs flicker in and out and a rim light can vanish
// entirely. Colour is averaged weighted by alpha so transparent pixels do not
// drag the edges toward black.
export function resizeBox(src, dw, dh) {
  const out = blankImage(dw, dh);
  const sx = src.width / dw, sy = src.height / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.ceil((y + 1) * sy));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.ceil((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < src.height; yy++) {
        for (let xx = x0; xx < x1 && xx < src.width; xx++) {
          const i = (yy * src.width + xx) * 4;
          const al = src.data[i + 3];
          r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al;
          a += al; n++;
        }
      }
      const o = (y * dw + x) * 4;
      if (a > 0) {
        out.data[o] = Math.round(r / a); out.data[o + 1] = Math.round(g / a); out.data[o + 2] = Math.round(b / a);
        out.data[o + 3] = Math.round(a / n);
      }
    }
  }
  return out;
}

// Bounding box of everything at least `alphaMin` opaque, or null if the region
// is entirely transparent.
export function opaqueBounds(img, x0 = 0, y0 = 0, w = img.width, h = img.height, alphaMin = 1) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] >= alphaMin) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
