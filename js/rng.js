// Seeded RNG (mulberry32) + helpers. The host generates a run seed; dungeon
// layout, spawn composition, shop stock and offers all derive from it through
// named sub-streams so systems can't perturb each other.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  constructor(seed) { this.next = mulberry32(seed >>> 0); }
  float() { return this.next(); }
  range(min, max) { return min + this.next() * (max - min); }
  int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); } // inclusive
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  // entries: [{w: weight, ...}] -> one entry
  weighted(entries) {
    let total = 0;
    for (const e of entries) total += e.w;
    let r = this.next() * total;
    for (const e of entries) { r -= e.w; if (r <= 0) return e; }
    return entries[entries.length - 1];
  }
}

// Derive a named sub-stream from a run seed, e.g. subRng(seed,'floor',2)
export function subRng(seed, ...parts) {
  return new Rng((seed >>> 0) ^ hashString(parts.join(':')));
}

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous
export function randomRunSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
export function seedToCode(seed) {
  let s = seed >>> 0, out = '';
  for (let i = 0; i < 7; i++) { out += SEED_ALPHABET[s % 32]; s = Math.floor(s / 32); }
  return out;
}
export function randomRoomCode() {
  let out = '';
  for (let i = 0; i < 5; i++) out += SEED_ALPHABET[(Math.random() * 24) | 0]; // letters only
  return out;
}
