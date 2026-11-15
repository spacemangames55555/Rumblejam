// THE DUMMY RING — one character, a ring of immortal dummies, twenty seconds.
//
// The fixture `region_curve` prices the world axis against, lifted out so the
// tools that ask WHY a class puts out what it does (class_breakdown) measure
// on exactly the ring the axis was measured on. A second copy of a fixture is
// how two tools come to disagree about the same character.
//
//   measureRing(classId, level, { picks, window })       region_curve's call
//   measureRing(classId, level, { picks, loadout: [...] }) a chosen slotting
//
// Returns { dps, p, sim, learned } or null if the fixture could not be staged.
import { Sim } from '../../js/game.js';
import { TREES, TREES_BY_CLASS, slotsAtLevel } from '../../js/skills.js';
import { buildCharacter } from './build_char.mjs';

export const RING_SECONDS = 20;
// THE RING HAS TO BE INSIDE MELEE REACH. At `tree_dps`'s 110 the Druid measured
// 0.0 at level 1 with `druid_rake` slotted at rank 1 — a melee strike whose
// reach does not span 110 units never fires, and a class holding exactly one
// skill therefore read as dealing no damage at all. `tree_dps` gets away with
// 110 because it stages one tree at a time and its melee trees are measured
// against a 95 ring; this fixture measures every class at every level, so the
// ring goes inside the shortest reach in the game rather than near it.
export const DUMMY_R = 70;

// STAGED GENEROUSLY, on purpose — the same ruling `tree_dps`'s supply pass
// makes. The question here is what a character at this level CAN put out, so
// every trigger condition is held true every tick: a level-46 build is mostly
// later-tier skills, later-tier skills are mostly conditional, and a fixture
// that only walks in a circle measures none of them. The first version did
// exactly that and reported levels 19, 28 and 37 as the SAME NUMBER for two of
// the four classes — not because the builds were identical but because
// everything the extra points bought was waiting for a kill, a dodge or a
// status that never came.
export function measureRing(classId, level, { picks = 'sensible', window = 0, loadout = null, spend = 'breadth', seconds = RING_SECONDS, onBuilt = null } = {}) {
  const TICKS = seconds * 60;
  const sim = new Sim({
    seed: 4242, allowUnplayable: true,
    party: [{ idx: 0, key: 'k', name: 'C', charId: classId, color: '#fff' }],
  });
  sim.god = true;
  // ANSWER THE §5.6 OPENING CARD FIRST, before travelling. It is offered in the
  // constructor and `_enterArena` is where the sim reports it unanswered, so an
  // answer after the travel is an answer after the damage: the Druid entered
  // the fixture with NO SKILL and measured 0.0 dps at level 1 across all three
  // windows, dragging the level-1 median down and inflating every multiplier
  // above it. Every other class hid it, because at level ≥ 10 the spend loop
  // clears the offer as a side effect of its first point.
  if (sim.players[0].openingOffer) sim.uiAction(0, { kind: 'opening', id: sim.players[0].openingOffer[0].id });
  const fight = sim.floor.nodes.find(n => n.kind === 'combat');
  if (!fight) return null;
  fight.template = 'open_expanse';
  sim._travelTo(fight.id);
  sim.wave.done = true; sim.spawnQueue.length = 0;
  for (const e of [...sim.enemyPool]) sim.enemyPool.release(e);

  // BUILT THE WAY THE GAME BUILDS ONE (tools/lib/build_char.mjs): levels
  // through `_grantLevel`, points spent breadth-first across the class's trees
  // in tier order — the shape a player who levelled naturally would have — and
  // the banked stat cards actually spent. `loadout: 'none'` because the
  // windows below pin it.
  const skills = (TREES_BY_CLASS[classId] || [])
    .flatMap(t => TREES[t].skills)
    .sort((a, b) => a.tier - b.tier);
  const built = buildCharacter(sim, { level, picks, spend, loadout: 'none' });
  const p = built.p;

  // PIN THE LOADOUT TO WHAT WAS ACTUALLY LEARNED, one WINDOW of it at a time.
  // The ranks live in `p.skillRanks`; the first version filtered on `p.spent`,
  // which is not a field. Windows rather than "the first N" for the reason
  // `tree_dps` gives: a level-64 build owns far more actives than it has slots,
  // and judging it on whichever seven sorted first measures the sort.
  const slots = slotsAtLevel(level);
  const learned = skills.filter(s => s.type === 'active' && (p.skillRanks[s.id] || 0) >= 1).map(s => s.id);
  if (loadout) {
    // a chosen slotting: exactly these, in this order, nothing else
    p.loadout = new Array(8).fill(null);
    loadout.slice(0, 8).forEach((id, i) => { p.loadout[i] = id; });
  } else if (learned.length) {
    p.loadout = new Array(8).fill(null);
    for (let i = 0; i < slots; i++) {
      const id = learned[(window * slots + i) % learned.length];
      if (id) p.loadout[i] = id;
    }
  }
  sim._recomputeStats(p);
  if (onBuilt) onBuilt(sim, p);

  const cx = sim.W / 2, cy = sim.H / 2;
  const dummies = [];
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6;
    const e = sim.spawnEnemyById('slabjaw', cx + Math.cos(a) * DUMMY_R, cy + Math.sin(a) * DUMMY_R, { noMats: true });
    if (!e) continue;
    e.spd = 0; e.dmg = 0;
    dummies.push({ e, x: e.x, y: e.y });
  }
  if (!dummies.length) return null;

  for (let i = 0; i < TICKS; i++) {
    // both halves of every either/or condition, alternating
    const walking = Math.floor(i / 180) % 2 === 1;
    sim.setInput(0, walking ? { mx: (i % 2 ? 1 : -1), my: 0 } : { mx: 0, my: 0 });
    if (!walking) p.stillT = 99;
    const side = Math.floor(i / 200) % 2 ? 1 : -1;
    p.x = cx + side * 320; p.y = cy;
    p.trigEvents.dodgeT = sim.time; p.trigEvents.hitTaken = 1; p.trigEvents.kill = 1;
    p.hp = i % 300 < 150 ? Math.max(1, p.stats.vitality * 0.25) : p.stats.vitality;
    for (let j = 0; j < dummies.length; j++) {
      const a = j * Math.PI * 2 / dummies.length;
      const d = dummies[j];
      d.e.x = p.x + Math.cos(a) * DUMMY_R; d.e.y = p.y + Math.sin(a) * DUMMY_R;
      d.e.knockX = d.e.knockY = 0;
      d.e.maxHp = 2e9; d.e.hp = 1e9;
      if (!(d.e.plagueT > 0)) sim.applyPlague(d.e, 0, 5, p, 'bleed');
    }
    sim.tick();
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  }
  return { dps: (p.damageDealt - (p.novaDamage || 0)) / seconds, p, sim, learned, unspent: built.unspent, cards: built.cards };
}

