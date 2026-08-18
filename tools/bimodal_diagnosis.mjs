// WHY DO SOME CLASSES DIE IN A REGION-8 ROOM AND OTHERS NOT NOTICE?
// Diagnosis only, changes nothing.
//
//   node tools/bimodal_diagnosis.mjs [--seeds=N] [--quick]
//
// The phase-2 measurement reported 10 of 14 itemised level-82 builds dying, the
// 4 survivors never below 66% health, and no middle. THE "NO MIDDLE" PART WAS A
// SINGLE-SEED ARTIFACT — §13 rule 94 applied to that report's own headline.
// Across three seeds the population is a gradient (23.1 s to 113.8 s) with one
// class that always lives, five that sometimes do, and eight that never do. That
// is why every group comparison here is printed beside a rank correlation over
// the whole roster: with one always-survivor, a two-group mean is a sample of
// one wearing a category's name.
//
// This does not assume the answer. Sustain is the hypothesis, so mitigation,
// output, mobility and pet screening are measured beside it and given the chance
// to be the real story. Measured, sustain is NOT the cause: it explains two
// classes and nothing else.
//
// TWO QUESTIONS THAT NEED OPPOSITE FIXES, so both are asked:
//
//   BURST     health is fine and then it is not. A build that spends its life
//             above 90% and dies out of one bad second needs mitigation or a
//             telegraph it can react to.
//   ATTRITION health grinds down and never comes back. That one needs sustain
//             or throughput, and capping healing would make it strictly worse.
//
// The discriminator is the HP trace, not the outcome: `worst second` as a share
// of max HP separates them, and `share of life above 90%` confirms it. Measured,
// it is attrition in 8 cases out of 8.
//
// EVERY NUMBER IS PER MODE, NEVER AVERAGED ACROSS BOTH. Averaging a population
// that contains "died at 20 s" and "never below 66%" is what produced three
// consecutive wrong headlines.
import { FixtureSim as Sim } from './fixture_sim.mjs';
import * as FB from './fixture_build.mjs';
import { SELECTABLE } from '../js/content/characters.js';
import { CONFIG } from '../js/config.js';

const QUICK = process.argv.includes('--quick');
const SEEDS_N = Number((process.argv.find(a => a.startsWith('--seeds=')) || '=3').split('=')[1]) || 3;
const SEEDS = [771, 4242, 99, 31337, 5].slice(0, QUICK ? 1 : SEEDS_N);
const ALL = SELECTABLE.map(c => c.id);
const CLASSES = QUICK ? ['toh_hunter', 'toh_priest', 'toh_savage', 'toh_monk'] : ALL;
const P = charId => [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }];
const H = t => { console.log('\n' + '='.repeat(100)); console.log(t); console.log('='.repeat(100)); };
const f1 = x => (Number.isFinite(x) ? x.toFixed(1) : '-');
const f2 = x => (Number.isFinite(x) ? x.toFixed(2) : '-');
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

// ---------------------------------------------------------------- one run
//
// A real region-8 room, driven by `driveEngage`, with every channel that could
// plausibly explain survival instrumented at its source rather than inferred.
function probe(charId, seed, { mode = 'shallow', secs = 120 } = {}) {
  const g = new Sim({ seed, regionIndex: 8, allowUnplayable: true, party: P(charId) });
  const p = g.players[0];
  FB.buildCharacter(g, p, { level: 82, mode, items: true, regionsReached: 8 });
  const node = g.floor.nodes.find(n => n.kind === 'combat' && n.template);
  g._travelTo(node.id);

  // --- instrument the three doors damage and healing actually pass through ---
  let rawIn = 0, netIn = 0, absorbed = 0, hits = 0;
  const origHurt = g.hurtPlayer.bind(g);
  g.hurtPlayer = (who, raw, src, opts) => {
    if (who !== p) return origHurt(who, raw, src, opts);
    const before = p.hp, sh = (p.shield || 0) + (p.footingShield || 0);
    const r = origHurt(who, raw, src, opts);
    const lost = Math.max(0, before - p.hp);
    rawIn += raw; netIn += lost; hits++;
    absorbed += Math.max(0, (sh - ((p.shield || 0) + (p.footingShield || 0))));
    return r;
  };
  let healGross = 0, healEff = 0;
  const origHeal = g._heal.bind(g);
  const origCurse = g._curse.bind(g);
  g._heal = (who, amount, opts) => {
    if (who !== p || !(amount > 0)) return origHeal(who, amount, opts);
    let a = amount * (1 + Math.max(-80, p.stats.recovery) / 100);
    if (origCurse(p, 'healHalf') > 0) a *= 0.5;
    healGross += a;
    const before = p.hp;
    const r = origHeal(who, amount, opts);
    healEff += Math.max(0, p.hp - before);
    return r;
  };

  // --- per-second HP trace, which is what tells burst from attrition ---
  const trace = [];
  let t = 0, minFrac = 1, dist = 0, minionTicks = 0, minionPeak = 0;
  let secHp = p.hp, worstSec = 0, aboveHi = 0, firstHurtT = null;
  let px = p.x, py = p.y;
  const CAP = secs * 60;
  const skillHeal0 = () => healEff;
  let effTotal = 0, fromLevels = 0;
  while (!g.over && g.phase === 'arena' && !g.cleared && t < CAP) {
    const h0 = p.hp, v0 = p.stats.vitality;
    FB.driveEngage(g, p);
    g.tick(); t++;
    let k = 0; while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
    if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
    const grew = Math.max(0, p.stats.vitality - v0);
    fromLevels += grew;
    const rise = p.hp - h0;
    if (rise > 0) effTotal += Math.max(0, rise - grew);
    if (rise < 0 && firstHurtT === null) firstHurtT = t / 60;
    dist += Math.hypot(p.x - px, p.y - py); px = p.x; py = p.y;
    const live = p.minions.filter(m => !m.downed).length;
    minionPeak = Math.max(minionPeak, live);
    minionTicks += live;
    const frac = p.hp / Math.max(1, p.stats.vitality);
    minFrac = Math.min(minFrac, frac);
    if (frac > 0.9) aboveHi++;
    if (t % 60 === 0) {
      const drop = (secHp - p.hp) / Math.max(1, p.stats.vitality);
      worstSec = Math.max(worstSec, drop);
      trace.push(+frac.toFixed(3));
      secHp = p.hp;
    }
  }
  // a death mid-second still counts as that second's drop
  worstSec = Math.max(worstSec, (secHp - p.hp) / Math.max(1, p.stats.vitality));
  const secsRun = t / 60;
  return {
    charId, seed, mode,
    outcome: g.over ? 'died' : (g.cleared ? 'cleared' : 'timeout'),
    secs: secsRun, kills: p.kills || 0, minFrac, trace,
    dps: (p.damageDealt || 0) / secsRun,
    killRate: (p.kills || 0) / secsRun,
    rawIn: rawIn / secsRun, netIn: netIn / secsRun, absorbed: absorbed / secsRun,
    mitigation: rawIn > 0 ? 1 - netIn / rawIn : 0,
    grit: p.stats.grit, vit: p.stats.vitality,
    healGross: healGross / secsRun,
    healSkill: Math.max(0, effTotal - healEff) / secsRun,
    healTotalEff: effTotal / secsRun,
    speed: dist / secsRun,
    minionMean: minionTicks / Math.max(1, t), minionPeak,
    worstSec, aboveHi: aboveHi / Math.max(1, t),
    firstHurtT, fromLevels,
  };
}

// ---- run everything ---------------------------------------------------------
H(`BIMODAL SPLIT — level-82 itemised builds in a region-8 room, ${SEEDS.length} seed(s), shallow spend`);
console.log('  driveEngage: advance on nearest, hold at 110. A floor on real play.\n');
const runs = [];
for (const c of CLASSES) for (const s of SEEDS) runs.push(probe(c, s));

// A class is "survivor" if it never died on any seed; "dies" if it died on all.
// Anything in between is the middle the measurement said does not exist, and if
// it turns up it is the most interesting row in the table.
const byClass = new Map();
for (const r of runs) { if (!byClass.has(r.charId)) byClass.set(r.charId, []); byClass.get(r.charId).push(r); }
const groups = { survivor: [], mixed: [], dies: [] };
for (const [c, rs] of byClass) {
  const d = rs.filter(r => r.outcome === 'died').length;
  groups[d === 0 ? 'survivor' : d === rs.length ? 'dies' : 'mixed'].push(c);
}

console.log(`  ${'class'.padStart(17)} ${'died'.padStart(6)} ${'secs'.padStart(7)} ${'minHP%'.padStart(7)} ${'group'.padStart(9)}`);
for (const [c, rs] of byClass) {
  const d = rs.filter(r => r.outcome === 'died').length;
  const grp = d === 0 ? 'SURVIVOR' : d === rs.length ? 'dies' : 'MIXED';
  console.log(`  ${c.padStart(17)} ${(d + '/' + rs.length).padStart(6)} ${f1(mean(rs.map(r => r.secs))).padStart(7)} ${f1(mean(rs.map(r => r.minFrac)) * 100).padStart(7)} ${grp.padStart(9)}`);
}
console.log(`\n  survivors (${groups.survivor.length}): ${groups.survivor.join(', ') || '-'}`);
console.log(`  mixed     (${groups.mixed.length}): ${groups.mixed.join(', ') || '-'}`);
console.log(`  dies      (${groups.dies.length}): ${groups.dies.join(', ') || '-'}`);

// ---- what separates them ----------------------------------------------------
//
// TWO WAYS OF ASKING, because the group comparison is fragile here. Across three
// seeds only ONE class survives every time, so "survivors vs dies" is a
// comparison against a sample of one and would report whatever that one class
// happens to be unusual about. The rank correlation over all 14 classes is the
// load-bearing analysis; the group means are printed under it as a check.
//
// Spearman on mean seconds survived. Survivors are censored at the run cap, so
// the correlation understates rather than overstates — the safe direction.
function spearman(xs, ys) {
  const rank = v => {
    const s = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    for (let i = 0; i < s.length;) {
      let j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[s[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const a = rank(xs), b = rank(ys), n = xs.length;
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return num / Math.sqrt(da * db || 1);
}
H('WHAT SEPARATES THEM — every channel that could plausibly explain survival');
const chan = [
  ['sustain gross HP/s', r => r.healGross + r.healSkill],
  ['  of which _heal', r => r.healGross],
  ['  of which compose.js', r => r.healSkill],
  ['mitigation (1-net/raw)', r => r.mitigation],
  ['grit', r => r.grit],
  ['vitality', r => r.vit],
  ['shield absorbed HP/s', r => r.absorbed],
  ['raw incoming HP/s', r => r.rawIn],
  ['output DPS', r => r.dps],
  ['kills/s', r => r.killRate],
  ['speed px/s', r => r.speed],
  ['mean live minions', r => r.minionMean],
];
// per-class means, which is the unit the correlation runs over
const perClass = [...byClass.entries()].map(([c, rs]) => ({ c, rs, secs: mean(rs.map(r => r.secs)) }));
const life = perClass.map(x => x.secs);
console.log(`  Spearman rho against mean seconds survived, over all ${perClass.length} classes.`);
console.log(`  |rho| >= 0.6 is treated as explaining the split; below 0.3 as ruled out.\n`);
console.log(`  ${'channel'.padStart(24)} ${'rho'.padStart(7)} ${'lived-most 4'.padStart(13)} ${'died-most 4'.padStart(12)} ${'verdict'}`);
const ordered = [...perClass].sort((a, b) => b.secs - a.secs);
const top4 = ordered.slice(0, 4), bot4 = ordered.slice(-4);
const chanRows = [];
for (const [name, f] of chan) {
  const vals = perClass.map(x => mean(x.rs.map(f)));
  const rho = spearman(vals, life);
  const a = mean(top4.map(x => mean(x.rs.map(f)))), b = mean(bot4.map(x => mean(x.rs.map(f))));
  const v = Math.abs(rho) >= 0.6 ? (rho > 0 ? 'EXPLAINS' : 'EXPLAINS (inverted)') : Math.abs(rho) < 0.3 ? 'ruled out' : 'weak';
  chanRows.push({ name, rho, a, b, v });
  console.log(`  ${name.padStart(24)} ${f2(rho).padStart(7)} ${f2(a).padStart(13)} ${f2(b).padStart(12)}  ${v}`);
}
console.log('\n  A channel is only a cause if it moves WITH survival across the whole');
console.log('  roster. One that matches at both ends is ruled out, which is as useful');
console.log('  a result as finding the cause.');

// ---- burst or attrition -----------------------------------------------------
H('BURST OR ATTRITION — the ten deaths, read off the HP trace');
console.log('  worst second = largest 1s HP loss as a share of max HP');
console.log('  above 90%    = share of the run spent near full health');
console.log('  A build that dies from a high `above 90%` with a large `worst second`');
console.log('  died to BURST. One that grinds down has a small worst second and a low');
console.log('  share above 90%. They need opposite fixes, so this is the load-bearing');
console.log(`  column of the whole diagnosis.\n`);
console.log(`  ${'class'.padStart(17)} ${'secs'.padStart(6)} ${'1st hurt'.padStart(9)} ${'worst sec'.padStart(10)} ${'above 90%'.padStart(10)} ${'verdict'.padStart(11)}`);
const deaths = runs.filter(r => r.outcome === 'died');
const verdicts = { burst: 0, attrition: 0 };
for (const c of groups.dies) {
  const rs = deaths.filter(r => r.charId === c);
  if (!rs.length) continue;
  const ws = mean(rs.map(r => r.worstSec)), ah = mean(rs.map(r => r.aboveHi));
  const v = ws >= 0.5 ? 'BURST' : ws <= 0.25 ? 'attrition' : 'mixed';
  if (v === 'BURST') verdicts.burst++; else if (v === 'attrition') verdicts.attrition++;
  console.log(`  ${c.padStart(17)} ${f1(mean(rs.map(r => r.secs))).padStart(6)} ${f1(mean(rs.map(r => r.firstHurtT))).padStart(9)} ${(f1(ws * 100) + '%').padStart(10)} ${(f1(ah * 100) + '%').padStart(10)} ${v.padStart(11)}`);
}
console.log(`\n  ${verdicts.burst} burst, ${verdicts.attrition} attrition, ${groups.dies.length - verdicts.burst - verdicts.attrition} mixed`);
console.log('  Sample HP traces (per second, fraction of max) for the first three deaths:');
for (const r of deaths.slice(0, 3)) console.log(`    ${r.charId.padEnd(17)} [${r.trace.slice(0, 40).join(' ')}]`);

// ---- does the split correlate with anything already known? ------------------
H('CORRELATION WITH KNOWN SPREADS — is this a new axis or an old one wearing a hat?');
console.log('  Three candidates the brief names. Each is measured per class and the');
console.log('  survivor/dies groups compared; a spread that does not separate them is');
console.log('  ruled out rather than left hanging.\n');

// (a) capstone variance: deep/shallow output ratio
// (b) item lift: DPS with items over DPS without
const ring = (charId, mode, items) => {
  const g = new Sim({ seed: 7, allowUnplayable: true, party: P(charId) });
  g.god = true;
  const fight = g.floor.nodes.find(n => n.kind === 'combat');
  fight.template = 'open_expanse';
  g._travelTo(fight.id);
  g.wave.done = true; g.spawnQueue.length = 0;
  for (const e of [...g.enemyPool]) g.enemyPool.release(e);
  const p = g.players[0];
  p.x = g.W / 2; p.y = g.H / 2;
  FB.buildCharacter(g, p, { level: 82, mode, items, regionsReached: 8 });
  const r = FB.mortalRing(g, p, 'slabjaw', { n: 8, radius: 90, hp: 900 });
  for (let t = 0; t < FB.MEASURE_SECONDS * 60; t++) {
    FB.driveStill(g, p); r.refresh(); g.tick();
    if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  }
  return p.damageDealt / FB.MEASURE_SECONDS;
};
console.log(`  ${'class'.padStart(17)} ${'group'.padStart(9)} ${'deep/shallow'.padStart(13)} ${'item lift'.padStart(10)} ${'known gap'.padStart(11)}`);
const corr = [];
for (const c of CLASSES) {
  const grp = groups.survivor.includes(c) ? 'SURVIVOR' : groups.dies.includes(c) ? 'dies' : 'MIXED';
  const sh = ring(c, 'shallow', true), dp = ring(c, 'deep', true), bare = ring(c, 'shallow', false);
  const gap = FB.WINDOW_DEPENDENT.has(c) ? 'cascade' : (FB.DOT_COMPOUNDS.has(c) ? 'dot' : '');
  corr.push({ c, grp, capstone: dp / Math.max(1e-9, sh), lift: sh / Math.max(1e-9, bare) - 1 });
  console.log(`  ${c.padStart(17)} ${grp.padStart(9)} ${f2(dp / Math.max(1e-9, sh)).padStart(13)} ${((f1((sh / Math.max(1e-9, bare) - 1) * 100)) + '%').padStart(10)} ${gap.padStart(11)}`);
}
const lifeByClass = Object.fromEntries(perClass.map(x => [x.c, x.secs]));
const order = corr.map(x => lifeByClass[x.c] ?? 0);
console.log(`\n  Spearman against survival:  capstone ratio ${f2(spearman(corr.map(x => x.capstone), order))}   item lift ${f2(spearman(corr.map(x => x.lift), order))}`);
console.log('\n  A candidate only counts if the two groups differ on it. Anything where');
console.log('  they match is ruled OUT as the cause of the split, which is as useful a');
console.log('  result as finding the cause.');

// ---- robustness: is the answer an outlier, or a window artifact? -----------
//
// Two ways the headline could be wrong, both checked rather than argued.
//
// (1) ONE CLASS CARRYING A CORRELATION. The savage's sustain is x13.8 gross and
//     cascade-fed; if `_heal` only correlates because of it, then sustain does
//     not explain the roster and item 2 does not fix the split.
// (2) A CENSORED WINDOW. Kill rate is measured over each run's own length, and
//     a room ramps its spawn rate — so a class that lives longer meets more
//     bodies and could post a higher rate for no causal reason. Re-measured
//     over a FIXED first-15s window, identical for every class.
H('ROBUSTNESS — is the answer an outlier or a window artifact?');
{
  const drop = 'toh_savage';
  const kept = perClass.filter(x => x.c !== drop);
  const l2 = kept.map(x => x.secs);
  console.log(`  (1) same correlations with ${drop} removed (n=${kept.length}):\n`);
  console.log(`  ${'channel'.padStart(24)} ${'rho (all)'.padStart(10)} ${('rho (no ' + drop.slice(4) + ')').padStart(16)}  verdict`);
  for (const [name, f] of chan) {
    const rAll = spearman(perClass.map(x => mean(x.rs.map(f))), life);
    const rNo = spearman(kept.map(x => mean(x.rs.map(f))), l2);
    const v = Math.abs(rAll) >= 0.6 && Math.abs(rNo) < 0.6 ? 'WAS THE OUTLIER'
      : Math.abs(rNo) >= 0.6 ? 'holds' : '';
    console.log(`  ${name.padStart(24)} ${f2(rAll).padStart(10)} ${f2(rNo).padStart(16)}  ${v}`);
  }

  // (2) fixed early window, same for everyone
  console.log(`\n  (2) output and kill rate over a FIXED first 15s, every class alive:\n`);
  const early = [];
  for (const x of perClass) {
    const g = new Sim({ seed: SEEDS[0], regionIndex: 8, allowUnplayable: true, party: P(x.c) });
    const p = g.players[0];
    FB.buildCharacter(g, p, { level: 82, mode: 'shallow', items: true, regionsReached: 8 });
    const node = g.floor.nodes.find(n => n.kind === 'combat' && n.template);
    g._travelTo(node.id);
    for (let t = 0; t < 15 * 60 && !g.over && g.phase === 'arena'; t++) {
      FB.driveEngage(g, p); g.tick();
      let k = 0; while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
      if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
    }
    early.push({ c: x.c, secs: x.secs, dps: (p.damageDealt || 0) / 15, kps: (p.kills || 0) / 15 });
  }
  early.sort((a, b) => b.secs - a.secs);
  console.log(`  ${'class'.padStart(17)} ${'lived (s)'.padStart(10)} ${'DPS@15s'.padStart(9)} ${'kills/s@15s'.padStart(12)}`);
  for (const e of early) console.log(`  ${e.c.padStart(17)} ${f1(e.secs).padStart(10)} ${f1(e.dps).padStart(9)} ${f2(e.kps).padStart(12)}`);
  console.log(`\n  rho against survival — DPS ${f2(spearman(early.map(e => e.dps), early.map(e => e.secs)))}, kills/s ${f2(spearman(early.map(e => e.kps), early.map(e => e.secs)))}`);
  console.log('  If these hold at the uncensored window, throughput is not an artifact of');
  console.log('  having lived longer to earn it.');
}

// ---- the clock ---------------------------------------------------------
//
// Nothing above explains the gradient on its own once the censoring is removed,
// and the deaths are unanimously attrition. That combination points at a
// mechanism rather than a stat: if the roster is defensively UNIFORM, every
// class dies on the same arithmetic — max HP divided by net incoming — and the
// only ways to beat it are to heal, or to thin the room before it runs out.
//
// Predicted life = vitality / net incoming, measured over the same fixed 15 s
// window for every class. If prediction tracks reality, the clock is the story
// and any fix has to change one of its two terms.
H('THE CLOCK — is the roster defensively uniform?');
{
  const rows = [];
  for (const x of perClass) {
    const g = new Sim({ seed: SEEDS[0], regionIndex: 8, allowUnplayable: true, party: P(x.c) });
    const p = g.players[0];
    FB.buildCharacter(g, p, { level: 82, mode: 'shallow', items: true, regionsReached: 8 });
    const node = g.floor.nodes.find(n => n.kind === 'combat' && n.template);
    g._travelTo(node.id);
    let raw = 0, net = 0, healEff = 0;
    const origHurt = g.hurtPlayer.bind(g);
    g.hurtPlayer = (who, r_, src, opts) => {
      if (who !== p) return origHurt(who, r_, src, opts);
      const b = p.hp; const out = origHurt(who, r_, src, opts);
      raw += r_; net += Math.max(0, b - p.hp); return out;
    };
    for (let t = 0; t < 15 * 60 && !g.over && g.phase === 'arena'; t++) {
      const h0 = p.hp, v0 = p.stats.vitality;
      FB.driveEngage(g, p); g.tick();
      let k = 0; while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
      if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
      const grew = Math.max(0, p.stats.vitality - v0);
      if (p.hp > h0) healEff += Math.max(0, p.hp - h0 - grew);
    }
    const netS = net / 15, healS = healEff / 15;
    const drain = Math.max(0.01, netS - healS);
    rows.push({ c: x.c, lived: x.secs, vit: p.stats.vitality, mit: raw > 0 ? 1 - net / raw : 0,
                netS, healS, drain, predicted: p.stats.vitality / drain });
  }
  rows.sort((a, b) => b.lived - a.lived);
  console.log(`  ${'class'.padStart(17)} ${'lived (s)'.padStart(10)} ${'vit'.padStart(5)} ${'mitig'.padStart(7)} ${'net in/s'.padStart(9)} ${'heal/s'.padStart(8)} ${'drain/s'.padStart(8)} ${'predicted'.padStart(10)}`);
  for (const r of rows) {
    console.log(`  ${r.c.padStart(17)} ${f1(r.lived).padStart(10)} ${String(r.vit).padStart(5)} ${f2(r.mit).padStart(7)} ${f1(r.netS).padStart(9)} ${f1(r.healS).padStart(8)} ${f1(r.drain).padStart(8)} ${(r.predicted > 900 ? 'never' : f1(r.predicted)).padStart(10)}`);
  }
  const mits = rows.map(r => r.mit), vits = rows.map(r => r.vit);
  console.log(`\n  mitigation spread across the roster: ${f2(Math.min(...mits))} .. ${f2(Math.max(...mits))}  (x${f2(Math.max(...mits) / Math.max(0.001, Math.min(...mits)))})`);
  console.log(`  vitality spread:                     ${Math.min(...vits)} .. ${Math.max(...vits)}  (x${f2(Math.max(...vits) / Math.min(...vits))})`);
  const fin = rows.filter(r => r.predicted <= 900);
  console.log(`  rho(predicted life, actual life) over the ${fin.length} classes the clock finishes: ${f2(spearman(fin.map(r => r.predicted), fin.map(r => r.lived)))}`);
  console.log('\n  A tight mitigation and vitality spread with a wide survival spread means');
  console.log('  the roster shares one defensive clock and differs only in what it does');
  console.log('  about it. `drain` is the term a sustain change moves; `lived` is what a');
  console.log('  throughput change moves, by emptying the room before the clock expires.');
}

console.log('\n' + '-'.repeat(100));
console.log('Diagnosis only. Nothing here changes the game.');
