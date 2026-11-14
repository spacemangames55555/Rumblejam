// EVERY FIGHT PAYS ONE TO TWO LEVELS — GDD §4.2, asserted in every region.
//
// The rule has been in the design since the first draft and was only ever
// checked on one map: `region_test` asserts region 1's map 1 leaves a
// character at level 6–7. Everything after it rode whatever the material
// economy happened to pay. Measured on main at 22419eb, that was five to seven
// levels a map in region 1 and a level 23 character arriving at a region
// anchored — and tuned — for level 10.
//
// So this plays the game's fights and reads the level off the character:
//
//   every region × every map   a PLAIN combat room, entered at the level §4.3
//                              expects there, must pay 1.0–2.0 levels
//                              (region 1's map 1 is the onboarding room and
//                              must pay 5–6.5, landing in its 6–7 window)
//   every region's boss        the same band — it is the sixth fight
//   the curve joins            a region's six fights carry a character from
//                              its anchor to within 1.5 levels of the next
//
// The other node kinds (elite, cursed, objective) are PRINTED, not gated: they
// pay more or less on purpose (§2.4) and a route is a choice among them.
//
//   node tools/level_curve_gate.mjs              the gate
//   node tools/level_curve_gate.mjs --measure    print the XP each room credits
//                                                at ×1 and the multiplier that
//                                                lands it on 1.5 levels — paste
//                                                into MAP_XP_MULT (js/arenas.js)
//   node tools/level_curve_gate.mjs --regions=4,5 --seeds=3 --verbose
import { Sim } from '../js/game.js';
import { REGIONS, REGION_ANCHOR_LEVEL, LEVELS_PER_FIGHT, FIGHTS_PER_REGION, expectedLevelAt } from '../js/regions.js';
import * as ARENAS from '../js/arenas.js';
import { buildCharacter } from './lib/build_char.mjs';
import { ringFor, botInput, answerOffers, enterNode, xpForLevels } from './lib/room_bot.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const MEASURE = !!args.measure, VERBOSE = !!args.verbose;
const regions = (typeof args.regions === 'string' ? args.regions.split(',').map(Number) : REGIONS.map(r => r.index));
const NSEEDS = Number(args.seeds || 2);
// XP is the room's, not the build's — the wave ends on the timer and culled
// fodder pays — so four classes are a median, not a sweep. A melee, a caster,
// a summoner and a tank, because the boss room has no timer and its yield
// does ride kill speed.
const CLASSES = ['toh_samurai', 'toh_wizard', 'toh_necromancer', 'toh_blacksmith'];
const BOSS = 5;
const median = xs => { const s = [...xs].filter(Number.isFinite).sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN; };

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };

if (MEASURE) for (const row of ARENAS.MAP_XP_MULT) row.fill(1);          // read the rooms at ×1

// One fight. Returns the XP it credited and the levels that bought.
function fight(regionIndex, depth, kind, classId, seed0) {
  for (let k = 0; k < 24; k++) {
    const seed = seed0 + k * 6151;
    const sim = new Sim({ seed, regionIndex, party: [{ idx: 0, key: 'k', name: 'BOT', charId: classId, color: '#fff' }] });
    sim.god = true;
    const want = expectedLevelAt(regionIndex, depth);
    const { p } = buildCharacter(sim, { level: Math.floor(want) });
    if (depth === BOSS) sim._travelTo(sim.floor.bossId);          // the WHOLE siege: its crowd is most of what it pays
    else if (!enterNode(sim, depth, kind)) continue;
    if (sim.phase !== 'arena') continue;
    if (kind === 'combat' && depth !== BOSS && sim.obj) continue;      // a PLAIN room
    const ring = ringFor(p);
    const lv0 = p.level, xp0 = p.xpEarned, frac0 = p.xpNext > 0 ? p.xp / p.xpNext : 0;
    const cap = depth === BOSS ? 900 : 200;
    let quiet = 0, secs = 0;
    for (let i = 0; i < cap * 60 && sim.phase === 'arena'; i++) {
      botInput(sim, p, ring);
      sim.tick();
      answerOffers(sim, p);
      secs = i / 60;
      // Over when nothing is alive, nothing is coming and the field is picked
      // clean — or a few seconds after that, for whatever is still in flight.
      const done = sim.cleared || (sim.wave && sim.wave.done && sim.enemyPool.count === 0 && !sim.boss && depth !== BOSS);
      if (done && (!sim.pickups || !sim.pickups.length)) { if (++quiet > 90) break; }
      else if (done) { if (++quiet > 900) break; }
      else quiet = 0;
    }
    const levels = (p.level - lv0) + (p.xpNext > 0 ? p.xp / p.xpNext : 0) - frac0;
    return { xp: p.xpEarned - xp0, levels, level: lv0, cleared: !!sim.cleared, secs, dropped: sim.payout ? sim.payout.xp : NaN };
  }
  return null;
}

function room(regionIndex, depth, kind = 'combat') {
  const rs = [];
  for (const c of CLASSES) for (let s = 0; s < NSEEDS; s++) {
    const r = fight(regionIndex, depth, kind, c, 8100 + regionIndex * 131 + depth * 17 + s * 977);
    if (r) rs.push(r);
  }
  return rs.length ? { n: rs.length, xp: median(rs.map(r => r.xp)), levels: median(rs.map(r => r.levels)), level: rs[0].level, lo: Math.min(...rs.map(r => r.levels)), hi: Math.max(...rs.map(r => r.levels)), secs: median(rs.map(r => r.secs)), dropped: median(rs.map(r => r.dropped)), uncleared: rs.filter(r => !r.cleared).length } : null;
}

console.log(MEASURE ? 'THE LEVEL CURVE — measuring what each room credits at ×1\n' : 'THE LEVEL CURVE, PLAYED\n');
const table = [];
for (const ri of regions) {
  const region = REGIONS.find(r => r.index === ri);
  const mults = [];
  let carried = REGION_ANCHOR_LEVEL[ri - 1];
  console.log(`── region ${ri} · ${region.name} · arrives at level ${REGION_ANCHOR_LEVEL[ri - 1]}`);
  for (let d = 0; d <= BOSS; d++) {
    const r = room(ri, d);
    const label = d === BOSS ? 'boss ' : `map ${d + 1}`;
    if (!r) { bad(`region ${ri} ${label}: no room could be staged`); mults.push(1); continue; }
    const onboarding = ri === 1 && d === 0;
    const wantLv = onboarding ? expectedLevelAt(1, 1) - 1 : LEVELS_PER_FIGHT;
    const from = expectedLevelAt(ri, d);
    const needXp = xpForLevels(Math.floor(from), wantLv);
    if (MEASURE) {
      const m = r.xp > 0 ? needXp / r.xp : 1;
      mults.push(onboarding ? ARENAS.ONBOARDING_XP_MULT[0] : +m.toFixed(2));
      console.log(`   ${label}  level ${String(r.level).padStart(2)}  credits ${String(Math.round(r.xp)).padStart(4)} XP at ×1 (${Math.round(100 * r.xp / Math.max(1, r.dropped))}% of what dropped, ${Math.round(r.secs)}s) = ${r.levels.toFixed(2)} levels; ${wantLv} levels cost ${Math.round(needXp)} → ×${m.toFixed(2)}`);
    } else {
      const [lo, hi] = onboarding ? [5.0, 6.5] : [1.0, 2.0];
      const line = `region ${ri} ${label} pays ${r.levels.toFixed(2)} levels at level ${r.level} (×${ARENAS.mapXpMult(ri, d)}; ${r.n} fights, ${r.lo.toFixed(2)}–${r.hi.toFixed(2)})`;
      if (r.levels >= lo && r.levels <= hi) ok(`${line} — inside ${lo}–${hi}`);
      else bad(`${line} — outside ${lo}–${hi}`);
      carried += r.levels;
    }
  }
  if (MEASURE) table.push(mults);
  else if (ri < REGIONS.length) {
    const next = REGION_ANCHOR_LEVEL[ri];
    if (Math.abs(carried - next) <= 1.5) ok(`region ${ri}'s six fights carry level ${REGION_ANCHOR_LEVEL[ri - 1]} to ${carried.toFixed(1)} — region ${ri + 1} expects ${next}`);
    else bad(`region ${ri}'s six fights carry level ${REGION_ANCHOR_LEVEL[ri - 1]} to ${carried.toFixed(1)} and region ${ri + 1} is tuned for ${next} — the curve does not join`);
  } else {
    console.log(`  · the run ends at about level ${carried.toFixed(0)}`);
  }
  if (!MEASURE && VERBOSE) {
    for (const kind of ['elite', 'cursed']) for (const d of [1, 3]) {
      const r = room(ri, d, kind);
      if (r) console.log(`  · ${kind} at map ${d + 1} pays ${r.levels.toFixed(2)} levels (not gated)`);
    }
  }
  console.log('');
}

if (MEASURE) {
  console.log('export const MAP_XP_MULT = [');
  for (const row of table) console.log(`  [${row.map(v => String(v)).join(', ')}],`);
  console.log('];');
  process.exit(0);
}
console.log(`${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'THE GAME DOES NOT PAY THE LEVEL CURVE IT IS TUNED AGAINST' : 'EVERY FIGHT PAYS ONE TO TWO LEVELS, AND THE REGIONS JOIN');
process.exit(fails ? 1 : 0);
