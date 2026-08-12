// Minimal PixelLab API client. No dependencies; Node's fetch does the work.
//
// THE KEY LIVES IN THE ENVIRONMENT, NEVER IN THE REPO:
//
//   export PIXELLAB_API_KEY=...
//
// Nothing here writes it to disk, logs it, or puts it in a filename. If you
// find yourself pasting it into a file, stop.
//
// Endpoint shapes were read from the live https://api.pixellab.ai/v1/openapi.json,
// not from any README — the documented MCP tool set (create_character,
// animate_character, create_tileset, create_isometric_tile) does not exist on
// this API at all. What does exist:
//
//   POST /generate-image-pixflux    text -> pixel art
//   POST /generate-image-bitforge   text -> pixel art, WITH a style reference image
//   POST /rotate                    turn an existing subject to another facing
//   POST /animate-with-text         animate a subject from a text action
//   POST /animate-with-skeleton     animate from skeleton keypoints
//   POST /inpaint, /estimate-skeleton
//   GET  /balance
//
// Usage is metered in "generations" (1.0 per call) OR in USD, per account:
// every response's `usage` is `{type: "usd"|"generations", usd, generations}`
// with the unused field null, and `GET /balance` returns `{type, usd}`. Count
// with `newSpend`/`spend`/`spendReport` below rather than reading one field —
// see the note there for why.

import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'https://api.pixellab.ai/v1';

// Requests go through curl, not fetch. Node 22's fetch (undici) ignores
// HTTPS_PROXY, so it leaves the sandbox by a direct path that the egress
// gateway refuses — "Host not in allowlist" — even for a host the proxy itself
// allows. curl honours HTTPS_PROXY and already trusts the proxy CA bundle.
//
// The key is passed in a curl config on STDIN rather than as an argument, so it
// never appears in the process list, and the request body goes to a temp file
// outside the repo.
function curlJson(url, bodyObj, timeoutSec) {
  const dir = mkdtempSync(join(tmpdir(), 'plab-'));
  const bodyFile = join(dir, 'body.json');
  try {
    writeFileSync(bodyFile, JSON.stringify(bodyObj));
    const out = execFileSync('curl', [
      '-sS', '--max-time', String(timeoutSec), '-X', 'POST', url,
      '-H', 'Content-Type: application/json',
      '--data-binary', `@${bodyFile}`,
      '-w', '\n%{http_code}',
      '-K', '-',
    ], { input: `header = "Authorization: Bearer ${apiKey()}"\n`, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const cut = out.lastIndexOf('\n');
    return { status: Number(out.slice(cut + 1).trim()), text: out.slice(0, cut) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

export function apiKey() {
  const k = process.env.PIXELLAB_API_KEY;
  if (!k) {
    console.error('✗ PIXELLAB_API_KEY is not set.\n'
      + '  export PIXELLAB_API_KEY=... in your shell. Never commit it, and never write it to a file in this repo.');
    process.exit(1);
  }
  return k;
}

// The subject facings the API understands, in OUR row order. Row index is the
// position in this array, which is the order fixed by patch-directional-sprites
// and asserted in docs/SPRITES.md: E SE S SW W NW N NE.
export const ROW_DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
// what tools/process_sprite.mjs expects on disk
export const ROW_FILENAMES = ['east', 'south_east', 'south', 'south_west', 'west', 'north_west', 'north', 'north_east'];

// Generation is slow (~25-40s for a small canvas) and occasionally 5xxs. Retry
// on transport and server errors; never retry a 4xx, which is a request we got
// wrong and would get wrong again.
export async function post(path, body, { retries = 3, timeoutMs = 300000 } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) {
      const wait = 2000 * 2 ** (attempt - 1);
      console.log(`    retry ${attempt}/${retries} in ${wait / 1000}s — ${lastErr}`);
      await new Promise(r => setTimeout(r, wait));
    }
    try {
      const { status, text } = curlJson(`${BASE}${path}`, body, Math.round(timeoutMs / 1000));
      if (status >= 200 && status < 300) return JSON.parse(text);
      if (status >= 400 && status < 500 && status !== 429) {
        throw new Error(`HTTP ${status}: ${text.slice(0, 400)}`);   // our fault, not worth retrying
      }
      lastErr = `HTTP ${status}: ${text.slice(0, 160)}`;
    } catch (err) {
      if (/HTTP 4/.test(err.message)) throw err;
      lastErr = err.message.slice(0, 160);
    }
  }
  throw new Error(`${path} failed after ${retries} retries — ${lastErr}`);
}

export async function balance() {
  const out = execFileSync('curl', ['-sS', '--max-time', '30', `${BASE}/balance`, '-K', '-'],
    { input: `header = "Authorization: Bearer ${apiKey()}"\n`, encoding: 'utf8' });
  try { return JSON.parse(out); } catch { return { raw: out.slice(0, 120) }; }
}

export const b64 = buf => ({ type: 'base64', base64: Buffer.from(buf).toString('base64') });
export const fromB64 = img => Buffer.from(img.base64, 'base64');

// ---------------------------------------------------------------- the meter
//
// A COST INSTRUMENT THAT READS ZERO ON A METERED ACCOUNT IS A GATE LYING ABOUT
// MONEY. The live `Usage` schema is `{ type: "usd" | "generations", usd,
// generations }` — the account decides which meter it is on, and the OTHER
// field comes back null. Callers counted `res.usage?.generations || 0`, so on a
// usd-metered account every run reported `0 generation(s)` while spending real
// money, and the number that would have stopped a runaway batch was the number
// that could never move.
//
// `spend()` accumulates both fields and remembers which one the API actually
// used, so the report says what was spent in the unit the account is billed in
// and admits when the API told it nothing.
export function newSpend() {
  return { generations: 0, usd: 0, calls: 0, seen: new Set(), silent: 0 };
}

export function spend(acc, res) {
  acc.calls++;
  const u = res && res.usage;
  if (!u) { acc.silent++; return acc; }
  if (typeof u.generations === 'number') acc.generations += u.generations;
  if (typeof u.usd === 'number') acc.usd += u.usd;
  if (u.type) acc.seen.add(u.type);
  // A response carrying a usage block with neither number is not "free" — it is
  // the API declining to say, and that must read differently from zero.
  if (typeof u.generations !== 'number' && typeof u.usd !== 'number') acc.silent++;
  return acc;
}

export function spendReport(acc) {
  const parts = [];
  if (acc.generations) parts.push(`${acc.generations} generation(s)`);
  if (acc.usd) parts.push(`$${acc.usd.toFixed(4)}`);
  if (!parts.length) parts.push('no cost reported by the API');
  let s = `${acc.calls} call(s), ${parts.join(' + ')}`;
  if (acc.seen.size) s += ` [meter: ${[...acc.seen].join('/')}]`;
  if (acc.silent) s += ` — ! ${acc.silent} call(s) returned no usable usage figure, so this total is a FLOOR, not the bill`;
  return s;
}
