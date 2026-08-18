// POWER CURVE — PHASE 2 MEASUREMENT. Measures, changes nothing.
//
//   node tools/power_curve_phase2.mjs [--only=N,N] [--quick]
//
// Phase 1 asked whether the curve was flat. It is not: both sides rise. The
// question this pass exists to answer is narrower — do they rise TOGETHER, band
// by band, and where do they not.
//
// Everything here builds on tools/fixture_build.mjs, and the reason that module
// exists is that three phase-1 surveys published confident numbers about
// characters missing a power source. Items, MOVEMENT staging and a bounded
// target are preconditions, not refinements: an un-itemised reading is low by
// 13-46% depending on the CLASS, which is exactly the kind of error a
// band-by-band ratio cannot absorb.
//
// THE MEASUREMENT RULES, stated once:
//
//   NODE KIND. Every threat figure is taken on a plain `combat` node with a
//   template, in every region, and the node's id is printed. §13 rule 85: a
//   fixture that picks a room by predicate picks a DIFFERENT room in each
//   region, and phase 1's headline finding died of exactly that.
//
//   LEVEL. Each region is measured at its own §4.3 anchor (REGION_ANCHOR_LEVEL,
//   1/10/19/28/37/46/55/64), which is what the world axis was derived against.
//
//   ITEMS. `regionsReached` = the region index, so a region-3 character carries
//   three regions' worth of shopping rather than eight.
//
//   WINDOW. MEASURE_SECONDS, the same for every class, because `cascade` is
//   uncapped and a savage's number is a function of run length.
//
//   TARGET. Player output is measured against a FIXED 900 HP mortal ring, not
//   against region-composed bodies. Folding the enemy curve into the player
//   reading would make the ratio compare a number to itself.
import { FixtureSim as Sim } from './fixture_sim.mjs';
import * as FB from './fixture_build.mjs';
import { SELECTABLE } from '../js/content/characters.js';
import { REGION_ANCHOR_LEVEL, TOTAL_REGIONS, regionHpMult, regionDmgMult } from '../js/regions.js';
import { slotsAtLevel } from '../js/skills.js';

const QUICK = process.argv.includes('--quick');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean).map(Number);
const want = n => !ONLY.length || ONLY.includes(n);
const H = t => { console.log('\n' + '='.repeat(94)); console.log(t); console.log('='.repeat(94)); };
const P = charId => [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }];
const ALL = SELECTABLE.map(c => c.id);
// A quick pass keeps the ends and the middle of the output spread so the median
// still means something; the full pass uses the whole roster.
const CLASSES = QUICK ? ['toh_hunter', 'toh_wizard', 'toh_monk', 'toh_priest', 'toh_blacksmith'] : ALL;
const med = xs => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const f1 = x => x.toFixed(1);
const pct = x => (x >= 0 ? '+' : '') + (x * 100).toFixed(0) + '%';

// ---------------------------------------------------------------- threat
//
// Warm up 15 s so the room is at steady state, then measure 30 s. `p.hp` is
// restored every tick, so "incoming" is damage the room DELIVERED rather than
// damage a corpse stopped receiving.
function threat(regionIndex, { warm = 15, secs = 30 } = {}) {
  const g = new Sim({ seed: 771, regionIndex, allowUnplayable: true, party: P('toh_blacksmith') });
  const p = g.players[0];
  p.level = 82; FB.spendStats(g, p, 81);
  const node = g.floor.nodes.find(n => n.kind === 'combat' && n.template);
  if (!node) return null;
  g._travelTo(node.id);
  for (let i = 0; i < 60 * warm; i++) { g.tick(); p.hp = p.stats.vitality; }
  let taken = 0, peak = 0, hpSum = 0;
  const seen = new Set();
  for (let i = 0; i < 60 * secs; i++) {
    const h = p.hp;
    g.tick();
    let k = 0;
    while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
    if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
    if (p.hp < h) taken += h - p.hp;
    p.hp = p.stats.vitality;
    const live = [...g.enemyPool].filter(e => e.active);
    peak = Math.max(peak, live.length);
    for (const e of live) if (!seen.has(e.id)) { seen.add(e.id); hpSum += e.maxHp; }
  }
  return {
    node: node.id, template: node.template, profile: node.profile,
    meanHp: hpSum / Math.max(1, seen.size),
    incoming: taken / secs,
    peak, spawned: seen.size,
    roomHp: hpSum,                       // total HP the room fielded in 30 s
  };
}

// ---------------------------------------------------------------- output
//
// One class, one region, one spend shape. Run every MOVEMENT window the slotted
// kit asks for and keep the best — a class is measured playing its kit, not
// playing the fixture's convenience.
function outputOf(charId, regionIndex, mode) {
  const level = REGION_ANCHOR_LEVEL[regionIndex - 1];
  const run = window => {
    const g = new Sim({ seed: 7, allowUnplayable: true, party: P(charId) });
    g.god = true;
    const fight = g.floor.nodes.find(n => n.kind === 'combat');
    fight.template = 'open_expanse';
    g._travelTo(fight.id);
    g.wave.done = true; g.spawnQueue.length = 0;
    for (const e of [...g.enemyPool]) g.enemyPool.release(e);
    const p = g.players[0];
    p.x = g.W / 2; p.y = g.H / 2;
    FB.buildCharacter(g, p, { level, mode, items: true, regionsReached: regionIndex });
    const ring = FB.mortalRing(g, p, 'slabjaw', { n: 8, radius: 90, hp: 900 });
    for (let t = 0; t < FB.MEASURE_SECONDS * 60; t++) {
      if (window === 'moving') FB.driveMoving(g, p, t); else FB.driveStill(g, p);
      ring.refresh();
      g.tick();
      if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
    }
    return { dps: p.damageDealt / FB.MEASURE_SECONDS, vit: p.stats.vitality };
  };
  // movementWindows needs a built character to read the loadout off, so build a
  // throwaway one first rather than guessing from the class id.
  const probe = new Sim({ seed: 7, allowUnplayable: true, party: P(charId) });
  FB.buildCharacter(probe, probe.players[0], { level, mode, items: false });
  const wins = FB.movementWindows(probe.players[0]);
  let best = null;
  for (const w of wins) { const r = run(w); if (!best || r.dps > best.dps) best = { ...r, window: w }; }
  return best;
}

// ---- 1. enemy threat, per region, plain combat node -------------------------
const T = [];
if (want(1)) {
  H('1. COMPOSED ENEMY THREAT — plain `combat` node with a template, per region (§13 rule 85)');
  console.log(`  ${'rgn'.padStart(4)} ${'node'.padStart(6)} ${'template'.padStart(14)} ${'profile'.padStart(11)} ${'meanHP'.padStart(8)} ${'in HP/s'.padStart(9)} ${'peak'.padStart(6)} ${'spawned'.padStart(8)} ${'axis'.padStart(6)}`);
  for (let r = 1; r <= TOTAL_REGIONS; r++) {
    const t = threat(r);
    T[r] = t;
    if (!t) { console.log(`  ${String(r).padStart(4)} (no combat node)`); continue; }
    console.log(`  ${String(r).padStart(4)} ${String(t.node).padStart(6)} ${String(t.template).padStart(14)} ${String(t.profile).padStart(11)} ${f1(t.meanHp).padStart(8)} ${f1(t.incoming).padStart(9)} ${String(t.peak).padStart(6)} ${String(t.spawned).padStart(8)} ${('x' + regionHpMult(r).toFixed(2)).padStart(6)}`);
  }
  console.log('\n  Every row is the same node KIND. Templates and profiles still differ —');
  console.log('  that is the generator, and naming them is what stops the next reader');
  console.log('  treating a template difference as a curve finding.');
}

// ---- 2. player output, per region, shallow and deep -------------------------
const OUT = { shallow: [], deep: [] };
if (want(2)) {
  H(`2. PLAYER OUTPUT — itemised, at each region's §4.3 anchor level, median of ${CLASSES.length} classes`);
  console.log(`  window ${FB.MEASURE_SECONDS}s, fixed 900 HP mortal ring, items = ${FB.ITEMS_PER_REGION}/region reached`);
  console.log(`\n  ${'rgn'.padStart(4)} ${'lvl'.padStart(4)} ${'slots'.padStart(6)} ${'shallow'.padStart(10)} ${'deep'.padStart(10)} ${'deep/shal'.padStart(10)} ${'medVit'.padStart(8)}`);
  for (let r = 1; r <= TOTAL_REGIONS; r++) {
    const level = REGION_ANCHOR_LEVEL[r - 1];
    const sh = [], dp = [], vits = [];
    for (const c of CLASSES) {
      const a = outputOf(c, r, 'shallow');
      const b = outputOf(c, r, 'deep');
      sh.push(a.dps); dp.push(b.dps); vits.push(a.vit);
    }
    const S = med(sh), D = med(dp);
    OUT.shallow[r] = S; OUT.deep[r] = D;
    OUT[`vit${r}`] = med(vits);
    const slots = slotsAtLevel(level);
    console.log(`  ${String(r).padStart(4)} ${String(level).padStart(4)} ${String(slots).padStart(6)} ${f1(S).padStart(10)} ${f1(D).padStart(10)} ${(D / S).toFixed(2).padStart(10)} ${f1(med(vits)).padStart(8)}`);
  }
}

// ---- 3. the ratio, band by band ---------------------------------------------
if (want(3) && T[1] && OUT.shallow[1]) {
  H('3. THE RATIO, BAND BY BAND — where does player growth outpace enemy growth?');
  console.log('\n  Two ratios, because "commensurate" is two questions:');
  console.log('    OFFENCE  player DPS / mean enemy HP   = bodies deleted per second');
  console.log('    DEFENCE  player vitality / incoming   = seconds to die standing still');
  console.log(`\n  ${'rgn'.padStart(4)} ${'offence(sh)'.padStart(12)} ${'offence(dp)'.padStart(12)} ${'defence'.padStart(9)}  | ${'band'.padStart(6)} ${'player x'.padStart(9)} ${'enemyHP x'.padStart(10)} ${'incoming x'.padStart(11)} ${'verdict'}`);
  for (let r = 1; r <= TOTAL_REGIONS; r++) {
    if (!T[r]) continue;
    const offS = OUT.shallow[r] / T[r].meanHp;
    const offD = OUT.deep[r] / T[r].meanHp;
    const def = OUT[`vit${r}`] / Math.max(0.01, T[r].incoming);
    let band = '', pg = '', eg = '', ig = '', verdict = '';
    if (r > 1 && T[r - 1]) {
      const pGrow = OUT.shallow[r] / OUT.shallow[r - 1];
      const eGrow = T[r].meanHp / T[r - 1].meanHp;
      const iGrow = T[r].incoming / Math.max(0.01, T[r - 1].incoming);
      band = `${r - 1}->${r}`; pg = 'x' + pGrow.toFixed(2); eg = 'x' + eGrow.toFixed(2); ig = 'x' + iGrow.toFixed(2);
      verdict = pGrow > eGrow * 1.25 ? 'PLAYER OUTPACES' : (eGrow > pGrow * 1.25 ? 'enemy outpaces' : 'tracks');
    }
    console.log(`  ${String(r).padStart(4)} ${f1(offS).padStart(12)} ${f1(offD).padStart(12)} ${f1(def).padStart(9)}  | ${band.padStart(6)} ${pg.padStart(9)} ${eg.padStart(10)} ${ig.padStart(11)} ${verdict}`);
  }
  console.log('\n  A flat OFFENCE column is what T1 asks for. A rising one means the');
  console.log('  player is pulling ahead of the bodies; a falling one means the reverse.');
}

// ---- 4. the regions 4-5 incoming dip ----------------------------------------
//
// Phase 1 measured incoming 22.6 / 17.5 / 10.2 across regions 3/4/5 and called
// it "spawn-budget variance between templates, worth a look". The brief asks for
// a diagnosis BEFORE anything is tuned on top of it. If the dip is the template
// the generator happened to pick, tuning the region would be tuning a coin flip.
if (want(4)) {
  H('4. THE REGIONS 4-5 INCOMING DIP — is it the region, or the room?');
  console.log('  Same region, five different seeds. If incoming swings as much across');
  console.log('  seeds as it does across regions, the dip is the ROOM, not the curve.\n');
  console.log(`  ${'rgn'.padStart(4)} ${'seeds (incoming HP/s)'.padStart(40)} ${'mean'.padStart(7)} ${'spread'.padStart(8)}`);
  const SEEDS = QUICK ? [771, 4242, 99] : [771, 4242, 99, 31337, 5];
  const rows = [];
  for (let r = 3; r <= 6; r++) {
    const vals = [];
    for (const seed of SEEDS) {
      const g = new Sim({ seed, regionIndex: r, allowUnplayable: true, party: P('toh_blacksmith') });
      const p = g.players[0];
      p.level = 82; FB.spendStats(g, p, 81);
      const node = g.floor.nodes.find(n => n.kind === 'combat' && n.template);
      if (!node) { vals.push(NaN); continue; }
      g._travelTo(node.id);
      for (let i = 0; i < 60 * 15; i++) { g.tick(); p.hp = p.stats.vitality; }
      let taken = 0;
      for (let i = 0; i < 60 * 30; i++) {
        const h = p.hp; g.tick();
        let k = 0; while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
        if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
        if (p.hp < h) taken += h - p.hp;
        p.hp = p.stats.vitality;
      }
      vals.push(taken / 30);
    }
    const ok = vals.filter(v => !Number.isNaN(v));
    const mn = Math.min(...ok), mx = Math.max(...ok);
    rows.push({ r, vals, mean: ok.reduce((a, b) => a + b, 0) / ok.length, spread: mx / Math.max(0.01, mn) });
    console.log(`  ${String(r).padStart(4)} ${vals.map(v => f1(v)).join(' ').padStart(40)} ${f1(rows[rows.length - 1].mean).padStart(7)} ${('x' + rows[rows.length - 1].spread.toFixed(1)).padStart(8)}`);
  }
  const worstWithin = Math.max(...rows.map(x => x.spread));
  const across = Math.max(...rows.map(x => x.mean)) / Math.max(0.01, Math.min(...rows.map(x => x.mean)));
  console.log(`\n  worst WITHIN-region spread across seeds: x${worstWithin.toFixed(1)}`);
  console.log(`  spread ACROSS regions 3-6 (of the means): x${across.toFixed(1)}`);
  console.log(worstWithin >= across
    ? '  => the room varies at least as much as the region does. The dip is the\n     GENERATOR picking a lighter room, not a hole in the curve. Tuning\n     region 4-5 bodies on this evidence would be tuning a coin flip.'
    : '  => region-to-region variation survives the seed sweep. The dip is real.');
}

// ---- 5. clear time and threat ------------------------------------------------
if (want(5)) {
  H('5. CLEAR TIME AND THREAT — a real region-8 room, fought for real');
  console.log('  Itemised level-82 build, no god mode, healing and death live, driven by');
  console.log('  `driveEngage` — advance on the nearest enemy, hold at 110. A FLOOR on real');
  console.log('  play: it never kites or retreats, so survival reads low and clear time high.');
  console.log('  Left stationary instead, the same hunter dies at 17.8s and the same priest');
  console.log('  survives 180s without clearing — those are statue numbers, not build ones.');
  console.log(`\n  ${'class'.padStart(17)} ${'spend'.padStart(8)} ${'outcome'.padStart(8)} ${'secs'.padStart(7)} ${'kills'.padStart(6)} ${'spawns end'.padStart(11)} ${'minHP%'.padStart(8)} ${'<50%'.padStart(5)}`);
  const sample = QUICK ? ['toh_hunter', 'toh_priest'] : ['toh_hunter', 'toh_wizard', 'toh_monk', 'toh_priest', 'toh_blacksmith', 'toh_savage', 'toh_druid'];
  let below = 0, died = 0, n = 0; const times = [];
  for (const c of sample) {
    for (const mode of ['shallow', 'deep']) {
      const g = new Sim({ seed: 771, regionIndex: 8, allowUnplayable: true, party: P(c) });
      const p = g.players[0];
      FB.buildCharacter(g, p, { level: 82, mode, items: true, regionsReached: 8 });
      const node = g.floor.nodes.find(nd => nd.kind === 'combat' && nd.template);
      g._travelTo(node.id);
      let t = 0, minFrac = 1, waveEnd = null;
      const CAP = 300 * 60;   // the priest clears at 150s; 300 is headroom, not a limit
      while (!g.over && g.phase === 'arena' && !g.cleared && t < CAP) {
        FB.driveEngage(g, p);
        g.tick(); t++;
        let k = 0; while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
        if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
        minFrac = Math.min(minFrac, p.hp / Math.max(1, p.stats.vitality));
        if (waveEnd === null && g.wave.done && !g.spawnQueue.length) waveEnd = t / 60;
      }
      n++; if (minFrac < 0.5) below++; if (g.over) died++;
      if (g.cleared) times.push(t / 60);
      const outcome = g.over ? 'DIED' : (g.cleared ? 'cleared' : 'timeout');
      console.log(`  ${c.padStart(17)} ${mode.padStart(8)} ${outcome.padStart(8)} ${f1(t / 60).padStart(7)} ${String(p.kills || 0).padStart(6)} ${(waveEnd === null ? '-' : f1(waveEnd) + 's').padStart(11)} ${f1(minFrac * 100).padStart(8)} ${(minFrac < 0.5 ? 'YES' : 'no').padStart(5)}`);
    }
  }
  console.log(`\n  ${died}/${n} runs DIED. ${below}/${n} ever dropped below 50% health.`);
  if (times.length) console.log(`  clear time among survivors: median ${f1(med(times))}s (${times.length}/${n} cleared)`);
  console.log('\n  T2 asks whether the endgame threatens. Read the DIED column before the');
  console.log('  minHP one: a build that dies never records a low-health moment, so');
  console.log('  "never dropped below 50%" and "died at 20s" are the SAME row for');
  console.log('  different classes and must not be averaged together.');
}

// ---- 6. is the 3->4 band real, or the same generator noise? ------------------
//
// Section 3 flags 1->2 and 3->4 as bands where the player outpaces. 3->4 is
// flagged because region 4's mean enemy HP FELL (x0.98) while the world axis
// rose (x4.33 against x3.84). Section 4 showed incoming is seed-noisy; if mean
// HP is too, then 3->4 is the generator and not a hole in the curve, and tuning
// it would be tuning a coin flip for the second time in one report.
if (want(6)) {
  H('6. IS THE 3->4 BAND REAL? — mean enemy HP across seeds');
  console.log(`  ${'rgn'.padStart(4)} ${'axis'.padStart(6)} ${'mean maxHp per seed'.padStart(34)} ${'mean'.padStart(7)} ${'spread'.padStart(8)} ${'/axis'.padStart(7)}`);
  const SEEDS = QUICK ? [771, 4242, 99] : [771, 4242, 99, 31337, 5];
  const means = {};
  for (let r = 3; r <= 6; r++) {
    const vals = [];
    for (const seed of SEEDS) {
      const g = new Sim({ seed, regionIndex: r, allowUnplayable: true, party: P('toh_blacksmith') });
      const p = g.players[0];
      p.level = 82; FB.spendStats(g, p, 81);
      const node = g.floor.nodes.find(n => n.kind === 'combat' && n.template);
      if (!node) { vals.push(NaN); continue; }
      g._travelTo(node.id);
      for (let i = 0; i < 60 * 15; i++) { g.tick(); p.hp = p.stats.vitality; }
      let hpSum = 0; const seen = new Set();
      for (let i = 0; i < 60 * 30; i++) {
        g.tick();
        let k = 0; while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
        if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
        p.hp = p.stats.vitality;
        for (const e of [...g.enemyPool]) if (e.active && !seen.has(e.id)) { seen.add(e.id); hpSum += e.maxHp; }
      }
      vals.push(hpSum / Math.max(1, seen.size));
    }
    const ok = vals.filter(v => !Number.isNaN(v));
    const m = ok.reduce((a, b) => a + b, 0) / ok.length;
    means[r] = m;
    console.log(`  ${String(r).padStart(4)} ${('x' + regionHpMult(r).toFixed(2)).padStart(6)} ${vals.map(v => f1(v)).join(' ').padStart(34)} ${f1(m).padStart(7)} ${('x' + (Math.max(...ok) / Math.min(...ok)).toFixed(2)).padStart(8)} ${f1(m / regionHpMult(r)).padStart(7)}`);
  }
  console.log(`\n  seed-averaged 3->4 band: x${(means[4] / means[3]).toFixed(2)} against the axis's x${(regionHpMult(4) / regionHpMult(3)).toFixed(2)}`);
  console.log('  The `/axis` column is the per-body HP the roster contributes once the world');
  console.log('  axis is divided out. Flat means the axis is doing the work alone, as designed.');
}

// ---- 7. T5: is concentration less efficient than spread? --------------------
//
// The brief asks for this as CLEAR TIME on a region-8 room, not as overkill
// percentage — overkill is a proxy and phase 1 measured it flat (16.4%) across
// build shapes, which told us nothing about whether the fight went better.
if (want(7)) {
  H('7. T5 — CONCENTRATION AGAINST SPREAD, measured as clear time on a region-8 room');
  console.log('  `concentrated` pours every point past the breadth pass into ONE slotted');
  console.log('  skill; `spread` divides them across all eight. Same level, same items.');
  console.log(`\n  ${'class'.padStart(17)} ${'shape'.padStart(14)} ${'outcome'.padStart(8)} ${'secs'.padStart(7)} ${'kills'.padStart(6)} ${'minHP%'.padStart(8)}`);
  const sample = QUICK ? ['toh_priest', 'toh_savage'] : ['toh_priest', 'toh_savage', 'toh_hunter', 'toh_monk'];
  const byShape = { concentrated: [], spread: [] };
  for (const c of sample) {
    for (const mode of ['concentrated', 'spread']) {
      const g = new Sim({ seed: 771, regionIndex: 8, allowUnplayable: true, party: P(c) });
      const p = g.players[0];
      FB.buildCharacter(g, p, { level: 82, mode, items: true, regionsReached: 8 });
      const node = g.floor.nodes.find(nd => nd.kind === 'combat' && nd.template);
      g._travelTo(node.id);
      let t = 0, minFrac = 1;
      const CAP = 300 * 60;
      while (!g.over && g.phase === 'arena' && !g.cleared && t < CAP) {
        FB.driveEngage(g, p);
        g.tick(); t++;
        let k = 0; while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
        if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
        minFrac = Math.min(minFrac, p.hp / Math.max(1, p.stats.vitality));
      }
      const outcome = g.over ? 'DIED' : (g.cleared ? 'cleared' : 'timeout');
      byShape[mode].push({ c, outcome, secs: t / 60, kills: p.kills || 0 });
      console.log(`  ${c.padStart(17)} ${mode.padStart(14)} ${outcome.padStart(8)} ${f1(t / 60).padStart(7)} ${String(p.kills || 0).padStart(6)} ${f1(minFrac * 100).padStart(8)}`);
    }
  }
  const score = rows => rows.filter(r => r.outcome === 'cleared').length;
  console.log(`\n  cleared: concentrated ${score(byShape.concentrated)}/${byShape.concentrated.length}, spread ${score(byShape.spread)}/${byShape.spread.length}`);
  console.log('  T5 wants concentration to be the WORSE choice. If the two are');
  console.log('  indistinguishable here, no mechanism currently punishes it and one');
  console.log('  would have to be added rather than tuned.');
}

// ---- 8. T3: sustain against incoming, in the room ---------------------------
//
// Section 5's result is not "the endgame is soft" — it is BIMODAL: 10 of 14 runs
// died inside 33 s and the survivors were the same two classes twice. This
// measures the thing that separates them, because T3's lever ("cap per-kill
// healing per second") should not be pulled before the number is known.
//
// EFFECTIVE healing, read as `p.hp` rising tick to tick. Overheal is invisible
// to this and that is the right choice: a heal that lands on a full bar does not
// keep anyone alive, and T3 is about survival rather than about throughput.
// Fixed 15 s window from the room's start so classes that die later are still
// measured over the same interval as ones that do not.
if (want(8)) {
  H('8. T3 — SUSTAIN AGAINST INCOMING, in a real region-8 room (first 15s, all classes)');
  console.log('  `effective` is p.hp rising — what kept the class alive. `gross` is every');
  console.log('  HP the kit ASKED _heal for, overheal included, which is the quantity a cap');
  console.log('  would apply to. A class pinned at full bar reads effective == taken by');
  console.log('  construction, so 1.00 there is a FLOOR on its sustain, not an equality.\n');
  console.log(`  ${'class'.padStart(17)} ${'_heal gross'.padStart(12)} ${'_heal eff'.padStart(10)} ${'skill eff'.padStart(10)} ${'taken/s'.padStart(8)} ${'eff/taken'.padStart(10)} ${'gross/taken'.padStart(12)}`);
  const rows = [];
  for (const c of (QUICK ? ['toh_priest', 'toh_savage', 'toh_hunter'] : ALL)) {
    const g = new Sim({ seed: 771, regionIndex: 8, allowUnplayable: true, party: P(c) });
    const p = g.players[0];
    FB.buildCharacter(g, p, { level: 82, mode: 'shallow', items: true, regionsReached: 8 });
    const node = g.floor.nodes.find(nd => nd.kind === 'combat' && nd.template);
    g._travelTo(node.id);
    // GROSS HEALING, read at the door of `_heal` so overheal is counted. The
    // amount passed in is PRE-recovery — `_heal` scales it by `recovery` before
    // it reaches the bar (js/game.js:2162) — so the first version of this read
    // `gross 3.1` against `effective 5.1` for the priest, which is impossible
    // and was the multiplier missing. Mirrored here rather than approximated.
    //
    // AND `_heal` IS NOT THE ONLY DOOR. js/compose.js writes `p.hp` directly in
    // three places — the `heal` primitive (:452), `drain`'s lifesteal (:483) and
    // the `healPerHit` rider (:609) — so every skill-composed heal skips
    // `_heal` entirely, along with the `recovery` multiplier, the `healHalf`
    // curse and the Priest's Grace hook. Measured, a level-82 bard takes ZERO
    // `_heal` calls in 15 s and still gains 31.8 HP. So the two paths are
    // counted separately: a cap written against `_heal` would not touch the
    // second one at all, which is the lever T3 names.
    let gross = 0, effHeal = 0;
    const origHeal = g._heal.bind(g);
    const origCurse = g._curse.bind(g);
    g._heal = (who, amount, opts) => {
      if (who !== p || !(amount > 0)) return origHeal(who, amount, opts);
      let a = amount * (1 + Math.max(-80, p.stats.recovery) / 100);
      if (origCurse(p, 'healHalf') > 0) a *= 0.5;
      gross += a;
      const before = p.hp;
      const r = origHeal(who, amount, opts);
      effHeal += Math.max(0, p.hp - before);
      return r;
    };
    let healed = 0, taken = 0, alive = true, fromLevels = 0;
    for (let t = 0; t < 15 * 60; t++) {
      const h = p.hp, v = p.stats.vitality;
      FB.driveEngage(g, p);
      g.tick();
      let k = 0; while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
      if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
      // NOT ALL HP THAT ARRIVES IS SUSTAIN. `_recomputeStats` grants the
      // difference when Vitality grows (js/game.js:631), and a room hands out
      // enough XP to level mid-fight — so the first version of this credited
      // the bard with 2.1 HP/s of "healing" while its gross read 0.0. Level-up
      // grants are subtracted here; what remains came from `_heal`.
      const grew = Math.max(0, p.stats.vitality - v);
      fromLevels += grew;
      const rise = p.hp - h;
      if (rise > 0) healed += Math.max(0, rise - grew); else if (rise < 0) taken += -rise;
      if (g.over) { alive = false; break; }
    }
    const G = gross / 15, H15 = healed / 15, T15 = taken / 15;
    const EH = effHeal / 15, ES = Math.max(0, H15 - EH);   // the two doors, split
    rows.push({ c, G, H15, T15, EH, ES, alive });
    console.log(`  ${c.padStart(17)} ${f1(G).padStart(12)} ${f1(EH).padStart(10)} ${f1(ES).padStart(10)} ${f1(T15).padStart(8)} ${(H15 / Math.max(0.01, T15)).toFixed(2).padStart(10)} ${(G / Math.max(0.01, T15)).toFixed(2).padStart(12)}`);
  }
  const unkillable = rows.filter(r => r.G >= r.T15);
  console.log(`\n  ${unkillable.length}/${rows.length} classes ask _heal for at least as much as the room deals:`);
  for (const r of unkillable) console.log(`    ${r.c.padEnd(18)} gross ${f1(r.G)} HP/s against ${f1(r.T15)} taken  (x${(r.G / Math.max(0.01, r.T15)).toFixed(1)})`);
  const skillOnly = rows.filter(r => r.ES > 0.5 && r.EH < 0.05);
  console.log(`\n  ${skillOnly.length}/${rows.length} classes heal ONLY through js/compose.js, never through _heal:`);
  for (const r of skillOnly) console.log(`    ${r.c.padEnd(18)} ${f1(r.ES)} HP/s of effective healing, 0 _heal calls — a cap on _heal misses it entirely`);
  console.log('\n  T3 says sustain must not outrun incoming. The `gross/taken` column is');
  console.log('  what a per-second cap would bite on; the `eff/taken` column is what the');
  console.log('  room actually experienced. Where gross far exceeds 1.00, the margin is');
  console.log('  headroom the class never has to spend — which is what makes the endgame');
  console.log('  bimodal rather than hard.');
}

console.log('\n' + '-'.repeat(94));
console.log('Measured, not tuned. Regions 3-8 have NO authored rosters and fall back to');
console.log('the base 12-enemy table, so every per-body figure for them is PROVISIONAL');
console.log('and must be re-checked when real rosters land.');
