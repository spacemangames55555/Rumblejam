// PENALTY ROLL — measuring the free-roll rate before ruling on weighting.
//
// GDD §9.5 leaves one question open: §9.2's stat items grant a bonus and roll
// their penalty randomly against another stat, and fully random still lets a
// penalty land on a stat the build does not care about. The proposal was light
// weighting toward stats the build uses. This measures whether that is needed.
//
// §9.5 ALREADY FORBIDS THE MAIN FREE-ROLL CASE: "a penalty may not roll into a
// stat the character has none of", because reducing a zero is free. So the
// question is narrower than it first looks — of the stats a character actually
// HAS, how many can be reduced without the build noticing?
//
// "The build does not care" is measured, not assumed. It means: apply the
// penalty, run the same fight from the same seed, and nothing observable
// changes. That is the stat gate's method (§13 rule 21) narrowed from "does
// this stat do anything at all" to "does this stat do anything FOR THIS BUILD"
// — a live stat can still be inert in a build that never touches it, and that
// is exactly the free roll being hunted.
//
// Usage: node tools/penalty_roll.mjs [--verbose]

import { Sim } from '../js/game.js';
import { SELECTABLE } from '../js/content/characters.js';
import { STATS, STAT_KEYS } from '../js/config.js';
import { STAT_BOOSTS } from '../js/content/statboosts.js';
import { TREES, SKILL_BY_ID as SK_ALL } from '../js/skills.js';
import { spendSkillPoint } from '../js/skillsim.js';

const VERBOSE = process.argv.includes('--verbose');

// Two anchors, for the same reason the balance pass uses two: a starting
// character has almost no nonzero stats and a finished one has many, so the
// eligible pool — and therefore the free-roll rate — moves across a run.
const ANCHORS = [12, 70];
const SECONDS = 45;
const ROLLS = 400;                 // simulated rolls per build, for the headline rate
const SEED = 20260807;

// The penalty magnitude. Taken from the game's own boost table at the MEDIUM
// size, so it is the size of thing a real item would move rather than a number
// invented here.
const PENALTY = Object.fromEntries(
  STATS.map(s => [s.key, -(STAT_BOOSTS.find(b => b.stat === s.key && b.rarity === 'uncommon') || { amount: 5 }).amount]));

// A build a player would actually be holding: skills spent down its trees, and
// stat boosts accumulated the way the game hands them out — drawn from
// STAT_BOOSTS through the sim's own seeded rng, not hand-picked. Hand-picking
// the boosts would decide the answer in advance, since the question is exactly
// "does the roll land on something the build cares about".
function build(charId, level, seed, penalty = null) {
  const g = new Sim({ seed, party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const p = g.players[0];
  p.level = level;
  for (const tid of Object.keys(TREES).filter(t => TREES[t].classId === charId)) {
    for (const s of [...TREES[tid].skills].sort((a, b) => a.tier - b.tier)) {
      p.skillPoints++;
      spendSkillPoint(g, p, s.id);
    }
  }
  // one level-up boost every other level, which is the shape of a real run
  const draws = Math.max(1, Math.floor(level / 2));
  const picks = [];
  for (let i = 0; i < draws; i++) {
    const b = STAT_BOOSTS[Math.floor(g.rng.float() * STAT_BOOSTS.length)];
    picks.push(b.stat);
    g._applyPerm(p, { [b.stat]: b.amount });
  }
  if (penalty) g._applyPerm(p, { [penalty]: PENALTY[penalty] });
  p.hp = p.stats.vitality;
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);
  return { g, p, picks };
}

// Everything a player could notice. Identical vectors from one seed mean the
// penalty changed nothing they could observe.
// CHANNELS. A stat can read FREE for two different reasons and they are not
// the same finding: the build genuinely has no use for it (a Samurai and
// Recovery — a real free roll, and the case weighting was proposed for), or the
// run never reached the situation the stat feeds (a fixture gap, which must
// never be counted as free). This tracks which, per run.
function play(g, p) {
  let minionTicks = 0, hpLost = 0, dist = 0, healed = 0;
  const ch = { healed: 0, hits: 0, statuses: 0, minions: 0, mats: 0, cleared: 0 };
  let last = p.hp;
  for (let t = 0; t < 60 * SECONDS; t++) {
    const e = g.trigGrid && g.trigGrid.nearest ? g.trigGrid.nearest(p.x, p.y, 900) : null;
    const px = p.x, py = p.y;
    if (e) {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
      g.setInput(0, d > 120 ? { mx: dx / d, my: dy / d } : { mx: 0, my: 0 });
    } else g.setInput(0, { mx: 0, my: 0 });
    g.tick();
    dist += Math.hypot(p.x - px, p.y - py);
    if (p.hp < last) { hpLost += last - p.hp; ch.hits++; }
    else if (p.hp > last) { healed += p.hp - last; ch.healed++; }
    last = p.hp;
    const alive = (p.minions || []).filter(m => !m.down).length;
    minionTicks += alive;
    if (alive) ch.minions++;
    for (const e of g.enemyPool) {
      if (!e.active) continue;
      if (e.slowT > 0 || e.burnT > 0 || (e.plagueT || 0) > 0) { ch.statuses++; break; }
    }
    // NOT restoring HP here. The earlier version healed the player to full on
    // every down, which is a healing source the fixture invented — it masked
    // every Recovery difference and made Recovery read FREE in all six builds.
    if (p.downed) { p.downed = false; p.hp = 1; }
  }
  // Greed's tithe fires on FIGHT CLEAR, not per kill (the stat gate learned this
  // the hard way). Without running it, Greed is free in every build by
  // construction rather than by measurement.
  const matsBefore = p.matsCollected;
  g._clearRewards(p);
  ch.mats = p.matsCollected - matsBefore;
  ch.cleared = 1;
  return {
    vec: [
      Math.round(p.damageDealt), p.kills, Math.round(hpLost), Math.round(dist),
      Math.round(minionTicks), p.matsCollected, Math.round(p.stats.vitality), Math.round(healed),
      g.enemyPool.count,
    ].join('|'),
    ch,
  };
}

// Which channel each stat needs, and whether the BUILD even owns a source for
// it. The distinction decides the whole measurement:
//
//   owns no source        -> a genuine FREE ROLL. A Samurai with no heal in any
//                            of its trees does not care about Recovery, ever,
//                            in any fight. This is precisely the case weighting
//                            was proposed for and it must be counted.
//   owns one, never fired -> a FIXTURE GAP. Reported as untested and counted as
//                            neither, because the honest answer is not known.
const STATUS_RIDERS = ['slow', 'impactDot', 'stun', 'root', 'weakenDamage', 'weakenDefense', 'defenseDown'];
const ownsKind = (p, SK, pred) => Object.keys(p.skillRanks || {})
  .some(id => SK[id] && (SK[id].compose || []).some(pred));
const CHANNEL = {
  vitality: ['took a hit', c => c.hits > 0, () => true],
  ferocity: ['dealt damage', () => true, () => true],
  tempo: ['moved', () => true, () => true],
  grit: ['took a hit', c => c.hits > 0, () => true],
  reflex: ['took a hit', c => c.hits > 0, () => true],
  recovery: ['healed', c => c.healed > 0,
    (p, SK) => ownsKind(p, SK, x => x.kind === 'heal') || (p.hookAgg && (p.hookAgg.lifesteal > 0 || p.hookAgg.regen > 0))],
  ingenuity: ['had a minion', c => c.minions > 0, (p, SK) => ownsKind(p, SK, x => x.kind === 'summon')],
  attunement: ['applied a status', c => c.statuses > 0,
    (p, SK) => ownsKind(p, SK, x => ['plague', 'hazard'].includes(x.kind)
      || Object.keys(x.riders || {}).some(r => STATUS_RIDERS.includes(r)))],
  greed: ['cleared a fight', c => c.cleared > 0, () => true],
  reach: ['collected materials', () => true, () => true],
};

console.log(`penalty roll — free-roll rate under §9.5's existing constraint`);
console.log(`  penalty size = the medium boost, negated: ${STATS.map(s => `${s.key} ${PENALTY[s.key]}`).join(', ')}\n`);

const summary = [];
for (const level of ANCHORS) {
  for (const c of SELECTABLE) {
    const base = build(c.id, level, SEED);
    const b = play(base.g, base.p);
    const baseline = b.vec;
    // §9.5's constraint: only stats the character actually HAS are eligible.
    const eligible = STAT_KEYS.filter(k => (base.p.stats[k] || 0) > 0);
    const ineligible = STAT_KEYS.filter(k => !eligible.includes(k));

    const free = [], felt = [], untested = [];
    for (const k of eligible) {
      const t = build(c.id, level, SEED, k);
      const out = play(t.g, t.p);
      const [why, met, owns] = CHANNEL[k];
      const hasSource = owns(base.p, SK_ALL);
      if (out.vec !== baseline) felt.push(k);
      else if (!hasSource) free.push(k);                       // free BY ABSENCE — real
      else if (!met(b.ch)) untested.push(`${k}(owns one, no ${why})`);
      else free.push(k);
      if (VERBOSE) console.log(`    ${c.id} L${level} ${k}: ${out.vec !== baseline ? 'felt' : !hasSource ? 'FREE(absent)' : met(b.ch) ? 'FREE' : 'untested'}`);
    }
    // The headline number the brief asks for: simulate real rolls against the
    // eligible pool and count how many land somewhere the build cannot feel.
    let freeRolls = 0;
    const rng = new Sim({ seed: SEED + level, party: [{ idx: 0, key: 'k', name: 'P', charId: c.id, color: '#fff' }] }).rng;
    for (let i = 0; i < ROLLS; i++) {
      const pick = eligible[Math.floor(rng.float() * eligible.length)];
      if (free.includes(pick)) freeRolls++;
    }
    const rate = eligible.length ? freeRolls / ROLLS : 0;
    summary.push({ charId: c.id, level, eligible, ineligible, free, felt, untested, rate });
    console.log(`  ${c.id.padEnd(18)} L${String(level).padEnd(3)} eligible ${String(eligible.length).padStart(2)}/10   free-roll ${(rate * 100).toFixed(1).padStart(5)}%   free: ${free.join(',') || '—'}${untested.length ? `   UNTESTED: ${untested.join(',')}` : ''}`);
  }
}

console.log('');
const rates = summary.map(s => s.rate);
const worst = Math.max(...rates), mean = rates.reduce((a, b) => a + b, 0) / rates.length;
console.log(`  mean free-roll rate ${(mean * 100).toFixed(1)}%, worst build ${(worst * 100).toFixed(1)}%`);
console.log(`  §9.5's zero-stat constraint alone removes ${(summary.reduce((a, s) => a + s.ineligible.length, 0) / summary.length).toFixed(1)} of 10 stats from the pool on average`);
console.log('');
