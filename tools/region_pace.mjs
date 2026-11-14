// HOW FULL IS THE ROOM, IN EVERY REGION — a measurement, not a gate.
//
// tools/map1_bot.mjs and tools/pace_measure.mjs answer this for region 1's
// first map and are wired to it (`regionIndex: 1`, the onboarding node). The
// world has eight regions and five maps in each, and §4.3 takes fodder off the
// HP axis — so past region 1 the ONLY thing that keeps a room full is the
// spawn rate, and that number has to be measured per region or guessed.
//
// A character is built by tools/lib/build_char.mjs — levels granted through
// the game's own `_grantLevel`, points spent breadth-first in tier order (the
// build the world axis was measured against), and the banked stat cards
// actually spent — at the level a player has on that map (the region's anchor
// plus 1.5 per map cleared, §4.2). It walks into a PLAIN combat node at the
// asked depth and kites at the reach of what it has slotted.
//
// GOD MODE BY DEFAULT. This measures what the spawn curve makes of a room,
// not whether a build survives it; survival is the balance probe's question
// and mixing them makes both numbers a function of the bot's dodging.
// `--mortal` turns it off.
//
// What it prints, per region × map × class, median across seeds:
//   spawned   bodies the wave fielded
//   kills/s   over the timed part of the wave
//   alive     median alive after t = 3 s while the timer runs
//   ≤2        share of those ticks with two or fewer alive  (§2.6: ≤ 5%)
//   peak      most alive at once                              (§2.6: ≤ the cap)
//   tail      seconds from the timer to the room clearing     (§2.6: ≤ 5 s)
//   +lvl      levels the room paid                             (§4.2: 1–2 per map)
//   mats      materials the room paid
//
// Usage:
//   node tools/region_pace.mjs                       all regions, map 3, four classes
//   node tools/region_pace.mjs --regions=4,5 --depths=0,2,4 --classes=all --seeds=5
//   node tools/region_pace.mjs --horde=all           force every region onto the horde curve
//   node tools/region_pace.mjs --rate=4:1.8,5:2.2    try a per-region rate multiplier
//   node tools/region_pace.mjs --picks=none          the old harness body: no stat cards spent
//   node tools/region_pace.mjs --json=FILE           write the rows
import { writeFileSync } from 'node:fs';
import { Sim } from '../js/game.js';
import { CONFIG } from '../js/config.js';
import { TREES_BY_CLASS } from '../js/skills.js';
import { buildCharacter } from './lib/build_char.mjs';
import { ringFor, botInput, answerOffers } from './lib/room_bot.mjs';
import { REGIONS, anchorLevel } from '../js/regions.js';
import * as ARENAS from '../js/arenas.js';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const list = (v, d) => (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : d);
const REF = ['toh_blacksmith', 'toh_wizard', 'toh_necromancer', 'toh_druid'];
const regions = list(args.regions, REGIONS.map(r => String(r.index))).map(Number);
const depths = list(args.depths, ['2']).map(Number);
const classes = args.classes === 'all' ? Object.keys(TREES_BY_CLASS) : list(args.classes, REF);
const NSEEDS = Number(args.seeds || 3);
const GOD = !args.mortal;
const PICKS = typeof args.picks === 'string' ? args.picks : 'sensible';
if (args.horde === 'all') CONFIG.HORDE_REGIONS = REGIONS.map(r => r.index);
else if (typeof args.horde === 'string') CONFIG.HORDE_REGIONS = args.horde.split(',').map(Number);
// `--rate=4:1.8,5:2.2` — a trial multiplier on a region's horde rate, applied
// through the same table the game reads (arenas.HORDE_REGION_RATE), so what is
// measured is what would ship.
if (typeof args.rate === 'string' && ARENAS.HORDE_REGION_RATE) {
  for (const kv of args.rate.split(',')) { const [r, v] = kv.split(':').map(Number); ARENAS.HORDE_REGION_RATE[r - 1] = v; }
}

const LEVELS_PER_MAP = 1.5;
const median = xs => { const s = [...xs].filter(Number.isFinite).sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN; };

function stage(regionIndex, depth, classId, seed) {
  const sim = new Sim({ seed, regionIndex, party: [{ idx: 0, key: 'k', name: 'BOT', charId: classId, color: '#fff' }] });
  sim.god = GOD;
  const level = Math.round(anchorLevel(regionIndex) + LEVELS_PER_MAP * depth);
  const { p } = buildCharacter(sim, { level, picks: PICKS });
  // A PLAIN combat node at this depth: no objective, no curse, no elite. The
  // objective rooms run their own streams and would be a different question.
  for (const node of sim.floor.nodes.filter(n => n.kind === 'combat' && (n.depth || 1) === depth + 1)) {
    sim._travelTo(node.id);
    if (sim.phase === 'arena' && !sim.obj) return { sim, p, level };
    return null;                       // one travel per sim: a second would be a second room's state
  }
  return null;
}

function run(regionIndex, depth, classId, seed0) {
  // Not every seed's tree has a plain combat node at every depth, so walk
  // seeds until one does. Deterministic: the same arguments find the same room.
  let st = null, seed = seed0;
  for (let k = 0; k < 24 && !st; k++) { seed = seed0 + k * 6151; st = stage(regionIndex, depth, classId, seed); }
  if (!st) return null;
  const { sim, p, level } = st;
  // Bodies the WAVE fields, counted at the one door they come through.
  // `spawnCounter` also numbers projectiles, so it cannot be used for this.
  let spawned = 0;
  const spawnEnemyById = sim.spawnEnemyById.bind(sim);
  sim.spawnEnemyById = (id, x, y, opts) => { const e = spawnEnemyById(id, x, y, opts); if (e && !(opts && opts.mini)) spawned++; return e; };
  const w = sim.wave;
  const dur = w.dur;
  const ring = ringFor(p);
  const xpFrac0 = p.xpNext > 0 ? p.xp / p.xpNext : 0;
  const alive = [];
  let peak = 0, le2 = 0, timed = 0, kills0 = sim.payout ? sim.payout.kills : 0, killsAtTimer = null, tEnd = null;
  const CAP = (Number.isFinite(dur) ? dur : 120) + 60;
  let t = 0;
  for (let i = 0; i < CAP * 60 && sim.phase === 'arena'; i++) {
    botInput(sim, p, ring, { dodge: !GOD });
    sim.tick();
    t += 1 / 60;
    answerOffers(sim, p);
    const n = sim.enemyPool.count;
    if (n > peak) peak = n;
    const timing = sim.wave && !sim.wave.done;
    if (timing && t >= 3) { alive.push(n); timed++; if (n <= 2) le2++; }
    if (!timing && killsAtTimer === null) { killsAtTimer = (sim.payout ? sim.payout.kills : 0) - kills0; tEnd = t; }
    if (!timing && n === 0 && sim.spawnQueue.length === 0) break;
    if (p.downed) break;
  }
  const tail = tEnd === null ? NaN : t - tEnd;
  // Levels the room paid: whole levels crossed plus the fraction of the bar.
  // §4.2 asks for 1–2 per map; a spawn-rate change moves this, and nothing
  // else in the suite reads it past region 1's first map.
  for (let i = 0; i < 240 && sim.phase === 'arena'; i++) { botInput(sim, p, ring); sim.tick(); }   // let the magnet land
  const levels = (p.level - level) + (p.xpNext > 0 ? p.xp / p.xpNext : 0) - xpFrac0;
  return {
    region: regionIndex, depth, classId, seed, level, slots: p.loadout.filter(Boolean).length, horde: !!(w && w.horde), ring,
    dur, spawned, kps: killsAtTimer === null ? NaN : killsAtTimer / Math.max(1, tEnd),
    alive: median(alive), le2: timed ? le2 / timed : NaN, peak, tail, levels, mats: sim.payout ? sim.payout.gold : NaN, died: !!p.downed,
  };
}

const rows = [];
console.log(`REGION PACE — ${GOD ? 'god mode' : 'MORTAL'}, ${NSEEDS} seed(s), stat cards '${PICKS}', horde regions [${CONFIG.HORDE_REGIONS.join(',')}]`
  + (ARENAS.HORDE_REGION_RATE ? `, rate ×[${ARENAS.HORDE_REGION_RATE.map(v => v.toFixed(2)).join(' ')}]` : '') + '\n');
console.log('reg map lvl slots  class         spawned  kills/s  alive   ≤2%   peak  tail  +lvl  mats   curve');
for (const ri of regions) {
  for (const d of depths) {
    const perClass = [];
    for (const c of classes) {
      const rs = [];
      for (let s = 0; s < NSEEDS; s++) { const r = run(ri, d, c, 5200 + s * 977 + ri * 31 + d * 7); if (r) rs.push(r); }
      if (!rs.length) { console.log(`${String(ri).padStart(3)} ${String(d + 1).padStart(3)}            ${c.replace('toh_', '').padEnd(13)} no plain combat node staged`); continue; }
      const m = k => median(rs.map(r => r[k]));
      const row = { region: ri, map: d + 1, classId: c, level: rs[0].level, slots: rs[0].slots, horde: rs[0].horde, dur: rs[0].dur, ring: rs[0].ring,
        spawned: m('spawned'), kps: m('kps'), alive: m('alive'), le2: m('le2'), peak: m('peak'), tail: m('tail'), levels: m('levels'), mats: m('mats'), died: rs.filter(r => r.died).length };
      rows.push(row); perClass.push(row);
      console.log(`${String(ri).padStart(3)} ${String(d + 1).padStart(3)} ${String(row.level).padStart(3)} ${String(row.slots).padStart(5)}  ${c.replace('toh_', '').padEnd(13)} ${String(Math.round(row.spawned)).padStart(7)}  ${row.kps.toFixed(1).padStart(7)}  ${row.alive.toFixed(0).padStart(5)}  ${(100 * row.le2).toFixed(0).padStart(4)}%  ${String(Math.round(row.peak)).padStart(4)}  ${row.tail.toFixed(1).padStart(4)}  ${row.levels.toFixed(2).padStart(4)}  ${String(Math.round(row.mats)).padStart(4)}   ${row.horde ? 'horde' : 'slow'} ${row.dur}s${row.died ? `  DIED ${row.died}/${rs.length}` : ''}`);
    }
    if (perClass.length > 1) {
      const m = k => median(perClass.map(r => r[k]));
      console.log(`${String(ri).padStart(3)} ${String(d + 1).padStart(3)}            ${'— median —'.padEnd(13)} ${String(Math.round(m('spawned'))).padStart(7)}  ${m('kps').toFixed(1).padStart(7)}  ${m('alive').toFixed(0).padStart(5)}  ${(100 * m('le2')).toFixed(0).padStart(4)}%  ${String(Math.round(m('peak'))).padStart(4)}  ${m('tail').toFixed(1).padStart(4)}  ${m('levels').toFixed(2).padStart(4)}  ${String(Math.round(m('mats'))).padStart(4)}`);
    }
  }
  console.log('');
}
if (typeof args.json === 'string') writeFileSync(args.json, JSON.stringify(rows, null, 1));
