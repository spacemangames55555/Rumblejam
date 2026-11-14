// EVERY REGION BOSS IS A FIGHT, AND EVERY MECHANIC IT DECLARES HAPPENS.
//
// A region boss is data: a committed zone, a lane charge, a phase 2 that
// changes the zone's shape, and since regions 4–8 a set of SIGNATURE BLOCKS
// (js/entities/enemies.js). Data that declares a mechanic and a sim that never
// runs it is the defect this project has met most often — the Cedar Mother
// stood where it spawned for a whole patch because the boss switch had no
// default case, and every load assertion passed, because every load assertion
// read the def.
//
// So nothing here reads the def to decide whether a mechanic works. A
// character at the region's anchor level fights the boss in its real siege
// room, in god mode, and the gate watches the WORLD:
//
//   it moves                        distance travelled
//   it commits its zone             a live telegraph zone of the phase's shape
//   phase 2 changes the read        a zone of the OTHER shape after half health
//   adds                            bodies of adds.id that pay no materials
//   ring / volley                   enemy projectiles in a room with no spitter
//   pools                           a players-hurting zone in the boss's colour
//   vortex                          a live vortex
//   beams                           active beam lanes
//   ward                            a pylon, and the boss's damage taken with
//                                   and without it standing
//   it can be killed                bossDown inside the cap
//
// Siege adds are culled every tick (as tools/boss_ttk_probe.mjs does), which
// is what makes "an enemy projectile exists" evidence of the BOSS: nothing
// else is alive long enough to fire one.
//
// Usage: node tools/boss_gate.mjs [regionIndex ...] [--verbose]
import { Sim } from '../js/game.js';
import { REGIONS, expectedLevelAt } from '../js/regions.js';
import { buildCharacter } from './lib/build_char.mjs';
import { REGION_ENEMIES, BOSS_BLOCK_PARAMS } from '../js/content/regions-enemies.js';
import { BOSS_BLOCKS } from '../js/entities/enemies.js';

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };
const VERBOSE = process.argv.includes('--verbose');
const only = process.argv.slice(2).map(Number).filter(n => n > 0);
const CAP_S = 420;
// A MEDIAN class, so the fight lasts long enough to be a fight. This was the
// Necromancer, chosen for "dependable single-target output" — and with its
// stat cards actually spent it killed the Drowned King's first phase in under
// nine seconds, before the vortex that phase declares had come off cooldown
// once. The gate then reported a boss missing its mechanic; what it had found
// was a class putting out six to eight times the roster median (see
// tools/region_curve.mjs), which is the balance pass's problem and must not
// be allowed to decide whether a boss works. The Wizard sits at the median
// of the fourteen on every boss (tools/boss_ttk_probe.mjs).
const CLASS = 'toh_wizard';

console.log('REGION BOSSES, FOUGHT\n');

// ---- 0. the two lists of block names are one list ----
{
  const a = [...BOSS_BLOCKS].sort().join(','), b = Object.keys(BOSS_BLOCK_PARAMS).sort().join(',');
  if (a === b) ok(`the sim's BOSS_BLOCKS and content's BOSS_BLOCK_PARAMS name the same ${BOSS_BLOCKS.length} blocks: ${a}`);
  else bad(`block lists differ — sim runs [${a}], content validates [${b}]. A block in one and not the other is either unvalidated or unreachable`);
}

// Built by tools/lib/build_char.mjs at the level a player MEETS the boss —
// the sixth fight of the region (expectedLevelAt) — with its stat cards
// spent. The first version assigned `p.level` at the region's ARRIVAL level
// and spent no cards, so "it can be killed" was being asked of a character
// seven levels and thirty cards short of the one in the room.
function build(regionIndex, seed) {
  const sim = new Sim({ seed, regionIndex, party: [{ idx: 0, key: 'k', name: 'C', charId: CLASS, color: '#fff' }] });
  sim.god = true;
  const { p } = buildCharacter(sim, { level: bossLevel(regionIndex) });
  return { sim, p };
}
const bossLevel = (regionIndex) => Math.floor(expectedLevelAt(regionIndex, 5));

function fight(region) {
  const def = REGION_ENEMIES[region.id].boss;
  const { sim, p } = build(region.index, 4100 + region.index * 17);
  sim._travelTo(sim.floor.bossId);
  sim.siegeT = sim.bossAt;
  for (let i = 0; i < 900 && !sim.boss; i++) sim.tick();
  const b = sim.boss;
  if (!b) return { def, spawned: false };
  const seen = {
    travelled: 0, zones: { 1: new Set(), 2: new Set() }, charges: 0,
    addBodies: { 1: 0, 2: 0 }, projs: { 1: 0, 2: 0 }, pools: { 1: 0, 2: 0 }, vortex: { 1: 0, 2: 0 }, beams: { 1: 0, 2: 0 },
    pylon: false, wardRatio: null, p2At: null,
  };
  let lx = b.x, ly = b.y;
  const t0 = sim.time;
  const addIdsSeen = new Set(), projSeen = new Set();
  const addId = (ph) => { const blk = ph === 2 && def.p2 && 'adds' in def.p2 ? def.p2.adds : def.adds; return blk && blk.id; };
  for (let i = 0; i < CAP_S * 60 && b.active && b.hp > 0; i++) {
    const ph = b.bs && b.bs.phase2 ? 2 : 1;
    // Cull the siege's own bodies BEFORE the tick, so anything alive after it
    // was put there this tick. The boss's adds are identified first: they are
    // the only bodies of that id that pay nothing.
    for (const e of sim.enemyPool) {
      if (!e.active || e.boss || e === b) continue;
      if (b.bs && b.bs.wardId && e.id === b.bs.wardId) continue;          // the ward is the fight
      if (e.def && e.def.id === addId(ph) && e.mats === 0 && !e.mini && !addIdsSeen.has(e.id)) { addIdsSeen.add(e.id); seen.addBodies[ph]++; }
      e.hp = 0; sim.enemyPool.release(e);
    }
    sim.tick();
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
    // A warded boss is fought AT THE WARD: where the character stands is its
    // only input, so the gate's fighter walks there as a player would.
    { const wd = b.bs && b.bs.wardId ? sim.enemyById(b.bs.wardId) : null;
      if (wd) { const dd = Math.hypot(wd.x - p.x, wd.y - p.y) || 1; sim.setInput(0, dd > 90 ? { mx: (wd.x - p.x) / dd, my: (wd.y - p.y) / dd } : { mx: 0, my: 0 }); }
      else sim.setInput(0, { mx: 0, my: 0 }); }
    seen.travelled += Math.hypot(b.x - lx, b.y - ly); lx = b.x; ly = b.y;
    const ph2 = b.bs && b.bs.phase2 ? 2 : 1;
    if (ph2 === 2 && seen.p2At === null) seen.p2At = sim.time - t0;
    for (const z of sim.telegraphZones()) if (z.e === b || z.owner === b || (z.z && z.src === b)) seen.zones[ph2].add(z.z.kind);
    if (b.telZone && b.telZone.kind) seen.zones[ph2].add(b.telZone.kind);
    if (b.bs && b.bs.charging) seen.charges++;
    for (const pr of sim.projPool) if (pr.active !== false && pr.kind === 'eshot' && !projSeen.has(pr.id)) { projSeen.add(pr.id); seen.projs[ph2]++; }
    if (sim.zones.some(z => z.hurts === 'players' && z.color === def.color)) seen.pools[ph2]++;
    if (sim.vortexes.length) seen.vortex[ph2]++;
    if (sim.activeBeams.length) seen.beams[ph2]++;
    // THE WARD, measured the moment it exists: the same blow with it standing
    // and with it gone. Restores the boss's health afterwards so the
    // measurement is not part of the fight.
    if (b.bs && b.bs.wardId && seen.wardRatio === null) {
      const pyl = sim.enemyById(b.bs.wardId);
      if (pyl) {
        seen.pylon = true;
        const hp0 = b.hp;
        sim.damageEnemy(b, 200, {}); const withWard = hp0 - b.hp; b.hp = hp0;
        const pid = b.bs.wardId; b.bs.wardId = null;
        sim.damageEnemy(b, 200, {}); const without = hp0 - b.hp; b.hp = hp0;
        b.bs.wardId = pid;
        seen.wardRatio = without > 0 ? withWard / without : null;
        seen.pylonHp = pyl.maxHp;
      }
    }
  }
  return { def, spawned: true, dead: !(b.active && b.hp > 0), ttk: sim.time - t0, seen, maxHp: b.maxHp };
}

const declared = (def, ph, name) => {
  if (ph === 2 && def.p2 && Object.prototype.hasOwnProperty.call(def.p2, name)) return def.p2[name];
  return def[name];
};

for (const region of REGIONS) {
  if (only.length && !only.includes(region.index)) continue;
  const r = fight(region);
  const def = r.def;
  console.log(`── region ${region.index} · ${def.name}`);
  if (!r.spawned) { bad(`${def.id}: no boss spawned in its siege room`); continue; }
  const s = r.seen;
  if (VERBOSE) console.log('   ', JSON.stringify({ ...s, zones: { 1: [...s.zones[1]], 2: [...s.zones[2]] } }));

  if (s.travelled > 200) ok(`${def.id} moves — ${Math.round(s.travelled)} units over the fight`);
  else bad(`${def.id} travelled ${Math.round(s.travelled)} units — a boss that stands where it spawned is inert, whatever its def says`);

  const k1 = def.telegraph.shape.kind, k2 = def.p2.telegraph.shape.kind;
  if (s.zones[1].has(k1)) ok(`${def.id} commits its phase-1 ${k1}`);
  else bad(`${def.id} never committed a ${k1} zone in phase 1 (saw: ${[...s.zones[1]].join(', ') || 'nothing'})`);
  if (s.p2At !== null && s.zones[2].has(k2)) ok(`${def.id} enters phase 2 at ${s.p2At.toFixed(1)}s and commits a ${k2} — the read changes`);
  else bad(`${def.id} phase 2: entered ${s.p2At === null ? 'never' : `at ${s.p2At.toFixed(1)}s`}, ${k2} zone ${s.zones[2].has(k2) ? 'seen' : 'NOT seen'} (saw: ${[...s.zones[2]].join(', ') || 'nothing'})`);

  // Every declared block, in every phase it is declared for, by what it left
  // in the world.
  const evidence = {
    adds: (ph) => [s.addBodies[ph], 'bodies raised'],
    ring: (ph) => [s.projs[ph], 'projectiles'],
    volley: (ph) => [s.projs[ph], 'projectiles'],
    pools: (ph) => [s.pools[ph], 'ticks with a pool down'],
    vortex: (ph) => [s.vortex[ph], 'ticks with a vortex live'],
    beams: (ph) => [s.beams[ph], 'ticks with lanes turning'],
    ward: () => [s.pylon ? 1 : 0, 'ward raised'],
  };
  for (const name of BOSS_BLOCKS) {
    for (const ph of [1, 2]) {
      const blk = declared(def, ph, name);
      if (!blk) continue;
      if (name === 'ward' && ph === 1 && !def.ward) continue;
      const [n, what] = evidence[name](ph);
      if (n > 0) ok(`${def.id} phase ${ph} ${name}: ${n} ${what}`);
      else bad(`${def.id} declares ${name} in phase ${ph} and the world shows nothing — 0 ${what}`);
    }
  }
  // And nothing it does NOT declare: a room with every other body culled has
  // no business holding a projectile, a pool, a vortex or a beam.
  for (const [name, n, what] of [['ring/volley', s.projs[1] + s.projs[2], 'projectiles'], ['pools', s.pools[1] + s.pools[2], 'pool ticks'], ['vortex', s.vortex[1] + s.vortex[2], 'vortex ticks'], ['beams', s.beams[1] + s.beams[2], 'beam ticks']]) {
    const names = name.split('/');
    const any = [1, 2].some(ph => names.some(nm => declared(def, ph, nm)));
    if (!any && n > 0) bad(`${def.id} declares no ${name} and the room showed ${n} ${what} — the evidence is not the boss's, so the checks above prove less than they say`);
  }

  const ward = declared(def, 2, 'ward');
  if (ward) {
    const want = 1 - ward.reduce;
    if (s.wardRatio !== null && Math.abs(s.wardRatio - want) < 0.02) ok(`${def.id} takes ×${s.wardRatio.toFixed(2)} of a blow while the ward stands (reduce ${ward.reduce}); the ward has ${s.pylonHp} HP against the boss's ${r.maxHp}`);
    else bad(`${def.id} ward: a blow lands at ×${s.wardRatio === null ? '?' : s.wardRatio.toFixed(2)} with the ward up, want ×${want.toFixed(2)}`);
  }

  if (r.dead) ok(`${def.id} can be killed — ${r.ttk.toFixed(0)}s by a level-${bossLevel(region.index)} ${CLASS.replace('toh_', '')} in god mode (${r.maxHp} HP)`);
  else bad(`${def.id} was not down after ${CAP_S}s — either it cannot be killed or its mechanic cannot be answered by a build that only attacks`);
  console.log('');
}

console.log(`${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A BOSS DECLARES A FIGHT IT DOES NOT HAVE' : 'EVERY REGION BOSS MOVES, COMMITS, CHANGES AND DOES WHAT IT DECLARES');
process.exit(fails ? 1 : 0);
