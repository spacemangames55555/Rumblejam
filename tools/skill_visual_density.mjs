// THE MEASUREMENT HALF of the skill visual audit. Survey only.
//
// Two numbers, over the same window, in the same room:
//   A. how many skill activations occurred
//   B. how many player-originated visual elements were on screen at once
//
// If those disagree the gap is the answer, and it is a rendering gap rather
// than a fire-rate one.
//
// B MODELS THE RENDERER'S OWN DECAY. `sim.fx` is cleared every tick, so
// counting pushes would say "3 things this frame" about effects the player sees
// for a sixth of a second. js/render.js holds each ingested effect in its own
// list for a fixed duration — arcs and beam flashes 0.16s, rings 0.25-0.35s,
// floaters 0.8s — and entities (projectiles, zones, minions) live until they
// expire. This keeps the same clocks, so B is what is actually visible.
import { FixtureSim as Sim } from './fixture_sim.mjs';
import * as SKILLSIM from '../js/skillsim.js';
import { TREES, TREES_BY_CLASS, slotsAtLevel } from '../js/skills.js';
import { SELECTABLE } from '../js/content/characters.js';

// render.js lifetimes, named so a change there is findable from here.
const LIFE = { arc: 0.16, beam: 0.16, ring: 0.35, block: 0.25, floater: 0.8, particle: 0.4 };
const DT = 1 / 60;

function armFull(g, p, level, ranks) {
  p.level = level;
  const sk = (TREES_BY_CLASS[p.charId] || []).flatMap(t => TREES[t].skills).sort((a, b) => a.tier - b.tier);
  for (let r = 0; r < ranks; r++) for (const s of sk) { p.skillPoints++; if (!SKILLSIM.spendSkillPoint(g, p, s.id)) p.skillPoints--; }
  g._recomputeStats(p);
}

function measure(charId, { level = 60, ranks = 4, seed = 771, regionIndex = 2, secs = 30, warm = 12, stateOf = null, effectOf = null } = {}) {
  const g = new Sim({ seed, regionIndex, allowUnplayable: true,
    party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const p = g.players[0];
  armFull(g, p, level, ranks);
  g.god = true;
  const node = g.floor.nodes.find(n => n.depth > 1 && n.template && n.kind !== 'shrine');
  if (!node) return null;
  g._travelTo(node.id);
  const pump = () => {
    let k = 0;
    while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
    if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  };
  for (let i = 0; i < 60 * warm; i++) { g.tick(); pump(); p.hp = p.stats.vitality; }

  // the renderer's transient lists, same clocks
  let arcs = [], beams = [], rings = [];
  let fires = 0, frames = 0;
  let sumTransient = 0, sumEntities = 0, sumTotal = 0, peak = 0;
  const perSkill = new Map();
  const byVisualState = new Map();
  const byEffect = new Map();
  let framesWithAny = 0, framesWithProj = 0;
  // PROJECTILE LIFETIME, measured rather than inferred. A bolt's ttl is
  // (range+60)/speed — around 0.6s for a typical one — but a projectile that
  // hits a body is released on impact, and in a crowded room the first body is
  // a few tens of units away. This records how long each one is actually on
  // screen, which is the difference between "no visual" and "a visual nobody
  // has time to see".
  const alive = new Map();
  const lives = [], dists = [];

  for (let i = 0; i < 60 * secs; i++) {
    p.hp = p.stats.vitality;
    g.tick(); pump();

    // A — activations this tick, off the channel the sim already records
    for (const f of g.fx.skillFires || []) {
      if (f.idx !== p.idx) continue;
      fires++;
      perSkill.set(f.id, (perSkill.get(f.id) || 0) + 1);
      // THE AUDIT'S ACTUAL QUESTION, counted at the moment of firing: did this
      // activation put anything on screen?
      if (stateOf) { const st = stateOf(f.id) || 'unknown'; byVisualState.set(st, (byVisualState.get(st) || 0) + 1); }
      if (effectOf) { const ef = effectOf(f.id) || 'unknown'; byEffect.set(ef, (byEffect.get(ef) || 0) + 1); }
    }
    // ingest, exactly as render.js does
    for (const s of g.fx.swings || []) arcs.push(0);
    for (const b of g.fx.beams || []) beams.push(0);
    for (const b of g.fx.booms || []) rings.push(0);
    for (const b of g.fx.blocks || []) rings.push(0);
    // age
    arcs = arcs.map(t => t + DT).filter(t => t < LIFE.arc);
    beams = beams.map(t => t + DT).filter(t => t < LIFE.beam);
    rings = rings.map(t => t + DT).filter(t => t < LIFE.ring);

    // B — player-originated things a viewer can see right now
    const mine = [...g.projPool].filter(pr => pr.active && pr.friendly && pr.owner === p.idx);
    const seen = new Set();
    for (const pr of mine) {
      seen.add(pr.id);
      if (!alive.has(pr.id)) alive.set(pr.id, { f: i, x: pr.x, y: pr.y });
    }
    for (const [id, rec] of [...alive]) {
      if (seen.has(id)) continue;
      lives.push((i - rec.f) * DT);
      alive.delete(id);
    }
    const projs = mine.length;
    const zones = (g.zones || []).filter(z => z.hurts === 'enemies').length;
    const minions = (p.minions || []).filter(m => !m.down).length;
    const summons = (g.summons || []).filter(s => !s.dead && s.owner === p.idx).length;
    const transient = arcs.length + beams.length + rings.length;
    const entities = projs + zones + minions + summons;

    frames++;
    sumTransient += transient; sumEntities += entities; sumTotal += transient + entities;
    peak = Math.max(peak, transient + entities);
    if (transient + entities > 0) framesWithAny++;
    if (projs > 0) framesWithProj++;
  }
  const acts = [...new Set((TREES_BY_CLASS[charId] || []).flatMap(t => TREES[t].skills).filter(s => s.type === 'active').map(s => s.id))];
  return {
    charId, secs, fires, firesPerSec: fires / secs,
    slots: slotsAtLevel(60), actives: acts.length, distinctFired: perSkill.size,
    meanTransient: sumTransient / frames, meanEntities: sumEntities / frames,
    meanTotal: sumTotal / frames, peak,
    pctFramesAny: 100 * framesWithAny / frames, pctFramesProj: 100 * framesWithProj / frames,
    perSkill, byVisualState, byEffect,
    projLife: lives.length ? lives.reduce((a, b) => a + b, 0) / lives.length : NaN,
    projCount: lives.length,
  };
}

export async function run(stateOf = null, effectOf = null) {
  const CLASSES = SELECTABLE.map(c => c.id);
  console.log('\nRoom: region 2, representative node (depth>1), level 60, every tree ranked to 4,');
  console.log('8 loadout slots, 30s window after a 12s warm-up. HP pinned — the question is');
  console.log('throughput and visibility, not survival.\n');
  console.log(`  ${'class'.padEnd(13)} ${'fires'.padStart(6)} ${'/sec'.padStart(6)} ${'distinct'.padStart(8)} ${'visuals'.padStart(8)} ${'transient'.padStart(9)} ${'entities'.padStart(8)} ${'peak'.padStart(5)} ${'%frames'.padStart(8)} ${'%proj'.padStart(6)}`);
  const all = [];
  for (const cid of CLASSES) {
    const r = measure(cid, { stateOf, effectOf });
    if (!r) { console.log(`  ${cid.replace('toh_', '').padEnd(13)} (no node staged)`); continue; }
    all.push(r);
    console.log(`  ${cid.replace('toh_', '').padEnd(13)} ${String(r.fires).padStart(6)} ${r.firesPerSec.toFixed(1).padStart(6)} ${String(r.distinctFired).padStart(8)}`
      + ` ${r.meanTotal.toFixed(1).padStart(8)} ${r.meanTransient.toFixed(2).padStart(9)} ${r.meanEntities.toFixed(1).padStart(8)}`
      + ` ${String(r.peak).padStart(5)} ${r.pctFramesAny.toFixed(0).padStart(7)}% ${r.pctFramesProj.toFixed(0).padStart(5)}%`);
  }
  if (!all.length) return;
  const mean = k => all.reduce((s, r) => s + r[k], 0) / all.length;
  console.log('\n  ' + '-'.repeat(88));
  console.log(`  A. skill activations           ${mean('firesPerSec').toFixed(1)} per second (${mean('fires').toFixed(0)} in 30s), mean over ${all.length} classes`);
  console.log(`  B. player visuals on screen    ${mean('meanTotal').toFixed(1)} elements at any instant`);
  console.log(`     of which transient fx       ${mean('meanTransient').toFixed(2)}  (arcs, beam flashes, rings — 0.16-0.35s each)`);
  console.log(`     of which entities           ${mean('meanEntities').toFixed(1)}  (projectiles, zones, minions, summons)`);
  console.log(`  frames showing ANY player visual: ${mean('pctFramesAny').toFixed(0)}%`);
  console.log(`  frames showing a player PROJECTILE: ${mean('pctFramesProj').toFixed(0)}%`);
  const withProj = all.filter(r => r.projCount > 0);
  if (withProj.length) {
    const ml = withProj.reduce((s2, r) => s2 + r.projLife, 0) / withProj.length;
    const tot = withProj.reduce((s2, r) => s2 + r.projCount, 0);
    console.log(`\n  PROJECTILE LIFETIME — ${tot} player projectiles observed spawn-to-release`);
    console.log(`     mean time on screen: ${(ml * 1000).toFixed(0)} ms  (${(ml * 60).toFixed(1)} frames at 60fps)`);
    console.log('     a bolt\'s declared ttl is (range+60)/speed, ~590ms for a 260-range 540-speed shot,');
    console.log('     so a projectile that lives far less than that is being consumed on impact, not failing to render.');
    console.log(`     per class: ${withProj.map(r => `${r.charId.replace('toh_', '')} ${(r.projLife * 1000).toFixed(0)}ms`).join(', ')}`);
  }
  const perFire = mean('meanTransient') / Math.max(1e-9, mean('firesPerSec'));
  if (stateOf) {
    const agg = new Map();
    for (const r of all) for (const [k, v] of r.byVisualState) agg.set(k, (agg.get(k) || 0) + v);
    const total = [...agg.values()].reduce((a, b) => a + b, 0);
    console.log('\n  ACTIVATIONS BY WHAT THEY DREW — the audit\'s question, counted at fire time');
    for (const [k, v] of [...agg].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(22)} ${String(v).padStart(5)}  ${(100 * v / total).toFixed(0).padStart(3)}%`);
    }
    const drew = agg.get('visual') || 0;
    console.log(`    -> ${(100 * drew / total).toFixed(0)}% of activations drew something; ${(100 - 100 * drew / total).toFixed(0)}% drew nothing or a number.`);
  }
  if (effectOf) {
    const agg = new Map();
    for (const r of all) for (const [k, v] of r.byEffect) agg.set(k, (agg.get(k) || 0) + v);
    const total = [...agg.values()].reduce((a, b) => a + b, 0);
    console.log('\n  ACTIVATIONS BY EFFECT TYPE — what the 4.1/sec are actually made of');
    for (const [k, v] of [...agg].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(26)} ${String(v).padStart(5)}  ${(100 * v / total).toFixed(0).padStart(3)}%`);
    }
  }
  console.log(`\n  Transient fx alive per activation-per-second: ${perFire.toFixed(3)}`);
  console.log('  A fire that drew an arc would hold it for 0.16s, so N fires/sec sustains');
  console.log(`  ~0.16N arcs. At ${mean('firesPerSec').toFixed(1)} fires/sec that would be ${(0.16 * mean('firesPerSec')).toFixed(2)}; measured ${mean('meanTransient').toFixed(2)}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
