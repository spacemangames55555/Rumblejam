// A CHARACTER SURVIVES A REGION BOUNDARY — asserted by effect, through the
// real save API and a real boss kill.
//
//   node tools/run_continuity_gate.mjs [--verbose]
//
// THE DEFECT THIS EXISTS TO CATCH. Everything in js/saves.js has been
// per-character and correct since the region shell — `frontier` on the
// character, `onRegionCleared` advancing that character's own, `canEnter`
// gating on it. What no code did was move a character's LEVEL, SKILLS, STAT
// PICKS or ITEMS across the boundary in either direction: `new Sim(...)` built
// every player at level 1, and the only writes back were `frontier` and
// `parked`. So the eight-region progression the whole power curve is specified
// against had never once been played, and nothing was red about it. Same shape
// as the eight-slot finding and the region layer before it: rule present, store
// present, wire missing.
//
// Every assertion below goes through `carryInto` / `recordRun` / `worldMapState`
// rather than reading fields, because a gate that asserts the fields exist is
// the gate that was already passing.
import { FixtureSim as Sim } from './fixture_sim.mjs';
import { pilot, steerToAvoiding } from './pilot.mjs';
import * as SK from '../js/skillsim.js';
import { newCharacter, newPlayerStore, carryInto, recordRun, onRegionCleared, canEnter } from '../js/saves.js';
import { worldMapState, partyCanEnter } from '../js/worldmap.js';
import { CONFIG } from '../js/config.js';
import { TOTAL_REGIONS } from '../js/regions.js';

const VERBOSE = process.argv.includes('--verbose');
let fails = 0, checks = 0;
const ok = m => { checks++; console.log(`✓ ${m}`); };
const bad = m => { checks++; fails++; console.log(`✗ ${m}`); };
const P = c => [{ idx: 0, key: 'k', name: 'P', charId: c, color: '#fff' }];

function resolve(g, p) {
  let k = 0; while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
  if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  if (p.treasureOffer) g.uiAction(0, { kind: 'treasure', id: p.treasureOffer.picks[0] });
  let s = 0; while (p.skillPoints > 0 && s++ < 40) {
    const l = SK.learnableSkills(p);
    if (!l.length) break;
    if (!SK.spendSkillPoint(g, p, l.sort((a, b) => a.tier - b.tier)[0].id)) break;
  }
  if (p.shop) g.uiAction(0, { kind: 'closeShop' });
}

// Walk into the region's boss room and finish it, through the sim's own path:
// the boss dies, `_tickLoot` fires `regionCleared`, extraction ends the run.
// The boss's HP is cut because this asserts the CLEAR PATH, not damage output —
// a gate that also had to win the DPS race would fail for reasons that are not
// about run continuity.
function clearRegionBoss(regionIndex, character, { charId = 'toh_samurai', seed = 1234, secs = 400 } = {}) {
  const g = new Sim({ seed, regionIndex, allowUnplayable: true, party: P(charId), carry: carryInto(character) });
  const p = g.players[0];
  g.god = true;                       // survival is not what this gate is about
  const siege = g.floor.nodes.find(n => n.kind === 'siege');
  if (!siege) return { g, p, cleared: false, why: 'no siege node' };
  g._travelTo(siege.id);
  let t = 0;
  while (!g.over && !g.regionCleared && t++ < 60 * secs) {
    if (g.boss && g.boss.hp > 200) g.boss.hp = 200;
    if (!g.cleared) pilot(g, p);
    else if (g.hatch) steerToAvoiding(g, p, g.hatch.x, g.hatch.y);
    g.tick();
    resolve(g, p);
  }
  return { g, p, cleared: !!g.regionCleared, secs: t / 60 };
}

console.log('RUN CONTINUITY — one character, eight regions\n');

// ---- 1. clearing region 1 puts THAT character into region 2, at its level ----
{
  const c = newCharacter('c_carry', 'toh_samurai', { name: 'Carrier' });
  const r1 = clearRegionBoss(1, c);
  if (!r1.cleared) bad(`could not clear region 1's boss in ${r1.secs || 0}s (${r1.why || 'timeout'}) — the rest of this gate cannot run`);
  else {
    const finished = r1.p.level;
    recordRun(c, r1.p);
    const moved = onRegionCleared(c, 1);
    if (finished > 1) ok(`a character finishes region 1 at level ${finished} (${r1.secs.toFixed(0)}s of boss room)`);
    else bad(`the character finished region 1 at level ${finished}`);

    if (c.level === finished) ok(`the SAVE holds level ${c.level} after the clear — before this patch it held 1 forever`);
    else bad(`the save holds level ${c.level}, the run finished at ${finished}`);

    if (moved.after === 2) ok(`its frontier advanced ${moved.before} → ${moved.after} (${moved.outcome})`);
    else bad(`frontier went ${moved.before} → ${moved.after}`);

    // and now the same character walks into region 2 as itself
    const g2 = new Sim({ seed: 77, regionIndex: 2, allowUnplayable: true, party: P('toh_samurai'), carry: carryInto(c) });
    const p2 = g2.players[0];
    if (p2.level === finished) ok(`it ARRIVES IN REGION 2 at level ${p2.level}, not level 1 — the defect this patch exists for`);
    else bad(`it arrived in region 2 at level ${p2.level}, having finished region 1 at ${finished}`);
    if (p2.xpNext === CONFIG.XP_BASE + CONFIG.XP_PER_LEVEL * p2.level) {
      ok(`and its XP threshold is re-derived for level ${p2.level} (${p2.xpNext}) rather than still owing level 2's`);
    } else bad(`xpNext ${p2.xpNext} does not match level ${p2.level}`);
  }
}

// ---- 2. items and learned skills survive the transition ---------------------
{
  const g = new Sim({ seed: 5, regionIndex: 1, allowUnplayable: true, party: P('toh_monk') });
  const p = g.players[0];
  p.level = 14;
  for (let i = 0; i < 10; i++) {
    const l = SK.learnableSkills(p);
    if (!l.length) break;
    p.skillPoints++;
    SK.spendSkillPoint(g, p, l.sort((a, b) => a.tier - b.tier)[Math.min(i, l.length - 1)].id);
  }
  g._applyPerm(p, { vitality: 12, ferocity: 7 });
  p.items.push('brass_knuckles', 'brass_knuckles');
  const ranksBefore = JSON.stringify(p.skillRanks);
  const itemsBefore = [...p.items].sort().join(',');

  const c = newCharacter('c_round', 'toh_monk', { name: 'Round' });
  recordRun(c, p);
  const g2 = new Sim({ seed: 6, regionIndex: 2, allowUnplayable: true, party: P('toh_monk'), carry: carryInto(c) });
  const p2 = g2.players[0];

  if (JSON.stringify(p2.skillRanks) === ranksBefore) ok(`learned skills survive the boundary (${Object.keys(p2.skillRanks).length} node(s), ranks identical)`);
  else bad(`skill ranks changed across the boundary: ${ranksBefore} → ${JSON.stringify(p2.skillRanks)}`);

  if ([...p2.items].sort().join(',') === itemsBefore) ok(`items survive the boundary (${p2.items.length}, including the duplicate)`);
  else bad(`items changed: "${itemsBefore}" → "${[...p2.items].sort().join(',')}"`);

  if (p2.permStats.vitality >= 12 && p2.permStats.ferocity >= 7) ok(`stat picks survive: +${p2.permStats.vitality} vitality, +${p2.permStats.ferocity} ferocity`);
  else bad(`stat picks lost: ${JSON.stringify(p2.permStats)}`);

  // the loadout has to be rebuilt too, or a carried character arrives unable to fire
  if ((p2.loadout || []).filter(Boolean).length === (p.loadout || []).filter(Boolean).length) {
    ok(`the loadout is rebuilt on arrival (${(p2.loadout || []).filter(Boolean).length} slotted) — ranks are spent through the real path, not written in`);
  } else bad(`loadout differs: ${(p.loadout || []).filter(Boolean).length} → ${(p2.loadout || []).filter(Boolean).length}`);
}

// ---- 3. region access is PER CHARACTER ---------------------------------------
{
  const store = newPlayerStore();
  const veteran = newCharacter('c_vet', 'toh_samurai', { name: 'Veteran' });
  veteran.frontier = 5;                       // has cleared 1-4
  const fresh = newCharacter('c_new', 'toh_monk', { name: 'Fresh' });

  const fs = worldMapState(fresh, store);
  const offered = fs.rows.filter(r => r.enterable).map(r => r.index);
  if (offered.length === 1 && offered[0] === 1) ok('a newly created character is offered region 1 and nothing else, on a save where another character has cleared region 4');
  else bad(`the fresh character is offered regions ${offered.join(', ')} — want [1] only`);

  const vs = worldMapState(veteran, store);
  const vOffered = vs.rows.filter(r => r.enterable).map(r => r.index);
  const wantV = [1, 2, 3, 4, 5].filter(i => vs.rows[i - 1].contentReady);
  if (JSON.stringify(vOffered) === JSON.stringify(wantV)) ok(`the veteran is offered its cleared regions plus its frontier: ${vOffered.join(', ')} (replay allowed, no world progress)`);
  else bad(`the veteran is offered ${vOffered.join(', ')}, want ${wantV.join(', ')}`);

  if (!canEnter(fresh, 2) && canEnter(veteran, 2)) ok('two characters on the same save disagree about region 2, which is the whole claim');
  else bad('region access is not per character');

  // and a replay does not advance anything
  const before = veteran.frontier;
  const rep = onRegionCleared(veteran, 2);
  if (rep.outcome === 'replay' && veteran.frontier === before) ok(`replaying a cleared region grants no world progress (frontier held at ${before})`);
  else bad(`replaying region 2 moved the frontier to ${veteran.frontier}`);
}

// ---- 4. multiplayer entry ------------------------------------------------------
{
  const a = newCharacter('a', 'toh_samurai'); a.frontier = 3;
  const b = newCharacter('b', 'toh_monk'); b.frontier = 1;
  const both = partyCanEnter([a, b], 2);
  const low = partyCanEnter([a, b], 1);
  if (!both.ok && both.blocked && both.blocked.length === 1) ok(`a party is blocked from a region a member has not reached: ${both.reason}`);
  else bad(`partyCanEnter allowed region 2 for a frontier-1 member: ${JSON.stringify(both)}`);
  if (low.ok) ok('and it enters a region every member has reached, carrying the one who is above it');
  else bad(`partyCanEnter refused region 1 for a party that has all reached it: ${low.reason}`);
}

// ---- 5. what a run is worth, carried ------------------------------------------
//
// REPORTED, NOT ASSERTED. The brief asks whether the XP curve still lands near
// level 82 at the end of region 8 when a character carries through. A full
// eight-region play-through is not something this gate can run in its budget,
// so what is measured is ONE region's boss room per band, carried, and the
// per-region gain is reported for the tuning pass to argue with.
// Two measurements, because they answer different halves and the second is
// expensive. `--verbose` walks BOSS ROOMS only, one per region, carried — cheap,
// and it proves the carry survives eight boundaries. `--survey` walks FULL
// ROUTES, which is what the XP question actually needs, and gets through as many
// regions as its budget allows rather than pretending to eight.
function playRoute(regionIndex, character, { charId = 'toh_samurai', seed = 1234, secs = 2400 } = {}) {
  const g = new Sim({ seed, regionIndex, allowUnplayable: true, party: P(charId), carry: carryInto(character) });
  const p = g.players[0];
  g.god = true;
  let t = 0, rooms = 0, stuck = 0;
  while (!g.over && !g.regionCleared && t < 60 * secs) {
    if (g.phase === 'map') {
      const r = g.reachableNodes();
      if (!r.length) break;
      const id = r.find(n => g.floor.nodes[n].kind !== 'siege') ?? r[0];
      g.uiAction(0, { kind: 'pickNode', nodeId: id });
      rooms++; stuck = t;
      continue;
    }
    if (!g.cleared) pilot(g, p);
    else if (!g.hatch && g.pickups.length) {
      let b = null, bd = Infinity;
      for (const m of g.pickups) { const d2 = (m.x - p.x) ** 2 + (m.y - p.y) ** 2; if (d2 < bd) { bd = d2; b = m; } }
      steerToAvoiding(g, p, b.x, b.y);
    } else if (g.hatch) steerToAvoiding(g, p, g.hatch.x, g.hatch.y);
    g.tick(); t++;
    resolve(g, p);
    // a room the pilot cannot finish is reported, never silently waited out
    if (t - stuck > 60 * 600) return { p, rooms, secs: t / 60, cleared: false, why: 'a room ran 600s without finishing' };
  }
  return { p, rooms, secs: t / 60, cleared: !!g.regionCleared, why: g.over ? 'died' : (g.regionCleared ? null : 'budget') };
}

if (VERBOSE) {
  console.log('\n--- carried level after each region\'s BOSS ROOM (boss HP cut; a floor, not a run) ---');
  const c = newCharacter('c_run', 'toh_samurai', { name: 'Runner' });
  for (let r = 1; r <= TOTAL_REGIONS; r++) {
    const res = clearRegionBoss(r, c, { seed: 900 + r, secs: 240 });
    if (!res.cleared) { console.log(`  region ${r}: boss room not finished in budget`); continue; }
    const before = c.level;
    recordRun(c, res.p);
    onRegionCleared(c, r);
    console.log(`  region ${r}: level ${before} → ${c.level}, frontier now ${c.frontier}, ${c.items.length} item(s)`);
  }
  console.log(`  final: level ${c.level} against the §4.3 anchor of 64 and the power-curve model's ~82`);
}

if (process.argv.includes('--survey')) {
  console.log('\n--- carried level after each FULL ROUTE (every room the pilot can finish) ---');
  const c = newCharacter('c_full', 'toh_samurai', { name: 'Full' });
  for (let r = 1; r <= TOTAL_REGIONS; r++) {
    const before = c.level;
    const res = playRoute(r, c, { seed: 1234 + r * 7 });
    recordRun(c, res.p);
    if (res.cleared) onRegionCleared(c, r);
    console.log(`  region ${r}: ${res.rooms} room(s), ${res.secs.toFixed(0)}s, level ${before} → ${c.level}`
      + `, frontier ${c.frontier}${res.cleared ? '' : `  [NOT CLEARED: ${res.why}]`}`);
  }
  console.log(`  final: level ${c.level}`);
}

console.log(`\n${checks} checks, ${fails} failure(s)`);
process.exit(fails ? 1 : 0);
