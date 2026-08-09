// COMPOSED ACTIONS — ten primitives and their riders.
//
// This is the piece that decides whether ~420 skills are content or code. A
// skill is a list of steps; a step names a primitive and hands it parameters.
// There is no dispatcher branching on skill id anywhere, and adding a skill
// must never mean editing this file.
//
// THE HARD RULE: every number lives in its tree's TUNING block. Nothing in here
// invents a magnitude. The only literals below are structural — array indices,
// the two radians in a full turn, a division by 1000 to read milliseconds — and
// each one is marked. A magnitude literal in this file is a bug.

import { domainMult } from './domains.js';
import { selectTarget, selectTargets } from './selectors.js';

// Rank scaling. LINEAR against base, never compounding: `damage *= 1.04` per
// rank is 4.8x at rank 40 and is the single most likely way to break the patch.
// The increments themselves are data — they live on the skill's `ranks` block.
export function rankedDamage(base, skill, rank) {
  const inc = (skill.ranks && skill.ranks.damage) || 0;
  return base * (1 + inc * rank);
}
export function rankedDuration(base, skill, rank) {
  const inc = (skill.ranks && skill.ranks.duration) || 0;
  return base * (1 + inc * rank);
}

// ENGINE SCALING. A step may declare `scaleWith: '<engine>'` and `scalePer`,
// and its magnitude then rides that engine's current value. It arrived in phase
// 1 on `shield` alone (Iron Sleeve, absorb scaled by Footing); the Samurai's
// Tactics tree needs it on `strike` across ten skills, so it is a shared hook
// rather than a per-primitive special case.
//
// It reads p.engines[name], which is the generic readable-resource bag — NOT a
// Footing field. Every remaining class engine (cascade, drench, crystallize,
// Chi, judgment marks, killbox, two bodies) exposes its state the same way and
// gets this for free.
export function engineScale(step, p) {
  if (!step.scaleWith) return 1;
  // Passives may raise what a stack is WORTH without touching the step. Held
  // Edge does exactly that for Footing; the bonus is keyed by engine name so a
  // future tree can do it for any other engine with no code here.
  const bonus = (p.engineScaleBonus && p.engineScaleBonus[step.scaleWith]) || 0;
  return 1 + ((p.engines && p.engines[step.scaleWith]) || 0) * (step.scalePer + bonus);
}

// Magnitude for a step: base, ranked, then scaled by whatever engine it rides.
// One function so a primitive cannot accidentally apply one and not the other.
export function stepDamage(step, skill, rank, p) {
  // `ingMult` is present only on a minion's actor facade — Ingenuity (§9.5)
  // applies to a summon's swing, never to the summoner's own skills, and this
  // is the one place the two can be told apart. A player has no such field, so
  // the term is exactly 1 for every non-minion caster.
  // `_atkBuff` is the post-dodge one-shot buff (§9.2), set and cleared around a
  // single fire in `fireSkill`. A minion's facade does not carry it, which is
  // correct — the player dodged, not the skeleton.
  return rankedDamage(step.damage, skill, rank) * engineScale(step, p)
    * (p.ingMult || 1) * (p.summonMult || 1) * (p._atkBuff || 1);
}

// §9.2 magnitude: item-granted knockback scaling. A player with no such item
// has `knockMult === 1`, and a minion reads its owner's by reference.
export function knockMult(p) { return (p && p.hookAgg && p.hookAgg.knockMult) || 1; }

const TAU = Math.PI * 2;          // structural
const MS = 1000;                  // structural: step params are milliseconds

// ---------------------------------------------------------------- geometry
//
// The three zone shapes, extracted so an enemy telegraph and a player skill ask
// the SAME question of the same shape. Two implementations of "is this point in
// the cone" would drift, and the drift would show up as an attack that looks
// dodged and lands anyway — which is the one bug that would make telegraphs
// worse than no telegraphs.

export function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

// `pad` is the target's own radius: a body is not a point, and an attack that
// clips your edge has hit you.
export function inCircle(z, x, y, pad = 0) {
  const dx = x - z.x, dy = y - z.y;
  return dx * dx + dy * dy <= (z.radius + pad) * (z.radius + pad);
}

export function inCone(z, x, y, pad = 0) {
  const dx = x - z.x, dy = y - z.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > (z.range + pad) * (z.range + pad)) return false;
  if (d2 < 1) return true;                       // standing on the origin
  return Math.abs(angleDelta(Math.atan2(dy, dx), z.angle0)) <= z.angle / 2;
}

export function inLine(z, x, y, pad = 0) {
  const ca = Math.cos(z.angle0), sa = Math.sin(z.angle0);
  const dx = x - z.x, dy = y - z.y;
  const along = dx * ca + dy * sa;
  if (along < -pad || along > z.length + pad) return false;
  return Math.abs(-dx * sa + dy * ca) <= z.width / 2 + pad;
}

export function inZone(z, x, y, pad = 0) {
  if (!z) return false;
  if (z.kind === 'circle') return inCircle(z, x, y, pad);
  if (z.kind === 'cone') return inCone(z, x, y, pad);
  if (z.kind === 'line') return inLine(z, x, y, pad);
  return false;
}

// ---------------------------------------------------------------- targeting
//
// Triggers decide WHETHER a skill fires. The primitive decides WHAT it hits.
// A PROXIMITY trigger firing a bolt shoots the nearest enemy in its radius; the
// same trigger firing a cone points at the densest cluster. That split is why
// trigger kinds and primitives compose freely instead of multiplying.

function aimAt(p, e) { return Math.atan2(e.y - p.y, e.x - p.x); }

// The aim direction follows the SKILL'S OWN selector. It used to be
// grid.nearest() unconditionally, which meant a reach build's cone still
// pointed at whatever was standing on the player (§15 defect #13).
function facing(sim, p, grid, range, select) {
  const t = selectTarget(select, grid, p.x, p.y, range);
  if (t) return aimAt(p, t);
  const d = grid.densestAngle(p.x, p.y, range);
  return d !== null ? d : p.aimA;
}

// A SWEEP CHEWS BARRICADES. `game.js` has always stated the rule — "every
// splash, nova and blast chews barricades as well as bodies" — and enforced it
// on the weapon paths: melee arcs called `_sweepWalls`, blasts went through
// `_areaDamageEnemies`, and a straight shot damaged the wall that absorbed it.
// Composed primitives inherited none of that, and weapons are gone, so in the
// skill era `strike`, `cone` and `line` passed through a Nest Purge barricade
// without scratching it.
//
// THE GATE SAID THE LEVEL WAS COMPLETABLE BECAUSE ONE CLASS STOOD IN IT.
// `bolt` reaches walls through the projectile tick and `hazard` through the
// zone tick, so the Necromancer and the Druid cleared Nest Purge and the gate
// was green. Measured across the built five, a melee class made ZERO progress
// on twenty-four barricades in six minutes. That is §13 rule 28's shape a third
// time: a claim about a LEVEL, decided by whichever class the fixture happened
// to be holding.
//
// `drain` is deliberately not here. It is single-target on a living thing and
// pays the caster back out of what it took; there is nothing to drain from a
// barricade, and giving it one would be inventing a behaviour rather than
// restoring one.
//
// A BARRICADE IN REACH IS STRUCK REGARDLESS OF WHICH WAY THE SWING AIMED, and
// that is a ruling, not a shortcut. A weapon arc tested facing against walls
// because the PLAYER aimed it — `p.aimA` pointed wherever they were looking.
// A composed skill aims itself: `facing()` follows the skill's own selector to
// an ENEMY (§15 defect #13, fixed deliberately). Keeping the arc test would
// therefore mean the skill era quietly removed the player's ability to choose
// to hit a wall, and the measurement says exactly that — a Samurai standing
// against a barricade for six minutes took 24 of them down to 22.
//
// A barricade is not a body. It does not dodge, it fills the space it occupies,
// and a person swinging a sword inside arm's reach of one hits it. So the sweep
// passes the full circle: range still matters, facing does not.
function chewWalls(sim, p, range, dmg) {
  if (!sim.walls.length) return;
  sim._sweepWalls(p.x, p.y, 0, range, Math.PI * 2, dmg, p);
}

// ---------------------------------------------------------------- primitives

export const PRIMITIVES = {

  // Melee arc in front of the player. The workhorse of the Samurai tree.
  strike(sim, p, skill, step, rank, grid, out) {
    const reach = step.reach;
    const arc = step.arc;
    const dmg = stepDamage(step, skill, rank, p);
    const r = step.riders || {};
    const pulses = r.multiPulse || 1;
    const a0 = facing(sim, p, grid, reach, skill.select);
    // windUp delays the whole step; the sim re-enters it when the timer expires
    if (r.windUp && !step._wound) {
      sim.queueSkillStep(p, skill, { ...step, _wound: true }, rank, r.windUp / MS);
      out.states++;
      return;
    }
    for (let i = 0; i < pulses; i++) {
      // pulses land on the same tick; multiPulse is a damage shape, not a
      // channel — a channel would need its own primitive and does not exist yet
      for (const e of grid.near(p.x, p.y, reach + p.radius)) {
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy > (reach + e.radius) * (reach + e.radius)) continue;
        if (Math.abs(angleDelta(Math.atan2(dy, dx), a0)) > arc / 2) continue;
        sim.skillDamage(e, dmg, p, skill);
        applyImpactRiders(sim, p, skill, r, e, rank, Math.atan2(dy, dx), out);
        out.hits++;
      }
      chewWalls(sim, p, reach, dmg);
    }
    sim.fx.swings.push({ x: p.x, y: p.y, a: a0, r: reach, color: p.color });
  },

  // Travelling projectile. Riders ride the projectile and resolve on impact.
  bolt(sim, p, skill, step, rank, grid, out) {
    const range = step.range || skill.trigger.range || skill.trigger.radius;
    // §9.2 magnitude: projectile count. This is the tier's headline shape —
    // "hit the nearest two targets instead of one" — and it needs no new
    // machinery because `bolt` already fans to a target list. Read only in
    // `_fireWeapon` until D-25.
    const count = (step.count || 1) + ((p.hookAgg && p.hookAgg.extraProjectiles) || 0);
    const targets = count > 1
      ? selectTargets(skill.select, grid, p.x, p.y, range, count)
      : [selectTarget(skill.select, grid, p.x, p.y, range)].filter(Boolean);
    // §9.2 SELECTOR-ADD. The skill ALSO strikes what a second selector picks —
    // it does not stop striking what its own picked. A crowd-clearing build
    // that finds one gains an elite-killer without losing its crowd clear and
    // without spending a point.
    //
    // Range is the SKILL'S, not the selector's: §5.3 rule 1 says a selector
    // re-ranks only what the skill's own range already returns, and a selector
    // arriving on an item must obey that too or every shop roll would be a
    // silent range upgrade.
    const adds = (p.hookAgg && p.hookAgg.selectorAdd) || [];
    for (const sel of adds) {
      const extra = selectTarget(sel, grid, p.x, p.y, range);
      if (extra && !targets.includes(extra)) targets.push(extra);
    }
    if (!targets.length) return;
    for (const t of targets) {
      sim.spawnSkillProj(p, skill, step, rank, aimAt(p, t), range);
      out.states++;
    }
  },

  // Fan of damage. Points at the densest cluster, which is what makes it the
  // crowd answer rather than a wide single-target hit.
  cone(sim, p, skill, step, rank, grid, out) {
    const dmg = stepDamage(step, skill, rank, p);
    const r = step.riders || {};
    const a0 = grid.densestAngle(p.x, p.y, step.range) ?? facing(sim, p, grid, step.range, skill.select);
    for (const e of grid.near(p.x, p.y, step.range)) {
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy > step.range * step.range) continue;
      if (Math.abs(angleDelta(Math.atan2(dy, dx), a0)) > step.angle / 2) continue;
      if (sim.losBlocked(p.x, p.y, e.x, e.y)) continue;
      sim.skillDamage(e, dmg, p, skill);
      // RIDER_TABLE has always said `cone: [...IMPACT_RIDERS]` and this
      // primitive applied none of them. Bone Nova's knockback 300, and the
      // Banshee's and Dread Howl's weakenDamage, were declared and dropped.
      // Found while measuring `knockbackBoost` — the item had nothing to scale
      // because the rider it scales was never applied.
      applyImpactRiders(sim, p, skill, r, e, rank, Math.atan2(dy, dx), out);
      out.hits++;
    }
    chewWalls(sim, p, step.range, dmg);
    sim.fx.swings.push({ x: p.x, y: p.y, a: a0, r: step.range, color: p.color });
  },

  // Straight beam, clipped by walls like every other beam in the game.
  line(sim, p, skill, step, rank, grid, out) {
    const dmg = stepDamage(step, skill, rank, p);
    const r = step.riders || {};
    const pulses = r.multiPulse || 1;
    const a0 = facing(sim, p, grid, step.length, skill.select);
    const len = sim.losClipLen(p.x, p.y, a0, step.length);
    const half = step.width / 2;
    const ca = Math.cos(a0), sa = Math.sin(a0);
    for (let i = 0; i < pulses; i++) {
      for (const e of grid.near(p.x, p.y, len)) {
        const dx = e.x - p.x, dy = e.y - p.y;
        const along = dx * ca + dy * sa;
        if (along < 0 || along > len) continue;
        const off = Math.abs(-dx * sa + dy * ca);
        if (off > half + e.radius) continue;
        sim.skillDamage(e, dmg, p, skill);
        // Same gap as `cone`: Wrecking Ball's knockback and stun, and
        // Stampede's knockback, were declared on a primitive that applied
        // nothing. A beam knocks along its own axis, not away from the caster.
        applyImpactRiders(sim, p, skill, r, e, rank, a0, out);
        out.hits++;
      }
      // The beam STOPS at a barricade (losClipLen above), so the barricade is
      // what it stopped on and takes the hit — the same rule the friendly
      // projectile tick states as "a DESTRUCTIBLE wall takes the hit rather
      // than merely eating the shot". Measured at the clipped end, half-width
      // plus the sweep's own slack, so a beam grazing a corner still bites.
      if (sim.walls.length) sim._areaDamageWalls(p.x + ca * len, p.y + sa * len, half + 12, dmg, p);
    }
    sim.fx.beams.push({ x1: p.x, y1: p.y, x2: p.x + ca * len, y2: p.y + sa * len, color: p.color, w: step.width });
  },

  // AN INERT PLACED OBJECT. The THIRTEENTH primitive (§5.7), and the two
  // questions §5.7 asks were both answered against the cheaper option.
  //
  // COULD `hazard` CARRY IT WITH A DORMANT FLAG? No, and the demonstration is
  // what a zone IS rather than what it looks like. `addZone` makes
  // `{t, acc, x, y, r, dps, dur, hurts}` and the zone tick advances a clock,
  // accumulates against a cadence, damages everything inside every 0.4s, applies
  // the slow rider, and splices the zone when `t >= dur`. A trap does NONE of
  // that: no cadence, no damage while it sits there, and it ends by being
  // CONSUMED rather than by expiring. Carrying it on `hazard` would mean a
  // dormant flag, a branch in the tick that skips every single thing the tick
  // does, a stored payload the tick must ignore, and a consumption path — at
  // which point the object shares its geometry with a zone and not one of its
  // behaviours. That is §5.7's "a distinctive verb is a list of existing steps"
  // failing in the other direction: not one verb with different parameters, but
  // two verbs that happen to be circles.
  //
  // And there is a cost that is not aesthetic. `fireSkill` runs on EVERY cast in
  // the game, and the detonation check runs with it; scanning `sim.zones` —
  // which holds enemy hazards, objective hazards and every player's ground — to
  // find one class's traps would be O(all zones) on every cast forever. Its own
  // array is O(traps).
  //
  // IS DETONATION A RIDER ON THE TRIGGERING SKILL? No, and §5.7 condition 2 is
  // the test: riders resolve on a TARGET at the moment of impact. A detonation
  // has neither. The skill that sets it off might be a heal, a shield, a ward or
  // a shift — none of which touches an enemy — so there is no impact to hang it
  // on. What the moment has is a CAST at a POSITION, which is caster state, so
  // by the same condition that made the Wizard's shift a primitive rather than a
  // rider, this is a property of the OBJECT, checked where casts are already
  // observed. See `detonateTraps` in skillsim.js.
  trap(sim, p, skill, step, rank, grid, out) {
    // Placed where the skill's own selector is looking, so a trap goes where the
    // Assassin is aiming rather than where it is standing — the difference
    // between setting a killbox ahead of a fight and dropping one on your feet.
    const target = selectTarget(skill.select, grid, p.x, p.y, skill.trigger.range || skill.trigger.radius || step.radius);
    const x = target ? target.x : p.x, y = target ? target.y : p.y;
    sim.addTrap({
      x, y, owner: p.idx,
      radius: step.radius,
      damage: stepDamage(step, skill, rank, p),
      ttl: rankedDuration(step.duration, skill, rank) / MS,
      domain: skill.domain,
      skill,
    });
    out.states++;
  },

  // Ground pool that ticks. Routed through the triangle like everything else —
  // hazard ticks are exactly the kind of damage that quietly escapes a rule.
  hazard(sim, p, skill, step, rank, grid, out) {
    const target = selectTarget(skill.select, grid, p.x, p.y, skill.trigger.radius || skill.trigger.range || step.radius);
    const x = target ? target.x : p.x, y = target ? target.y : p.y;
    const r = step.riders || {};
    sim.addZone({
      x, y, r: step.radius,
      dps: stepDamage(step, skill, rank, p) / (step.tickMs / MS),
      dur: rankedDuration(step.duration, skill, rank) / MS,
      hurts: 'enemies', color: p.color,
      skillDomain: skill.domain, ownerIdx: p.idx,
      slowMult: r.slow ? r.slow.mult : 0, slowDur: r.slow ? r.slow.dur / MS : 0,
    });
    out.states++;
  },

  // Restores HP to the caster and nearby allies. No phase-1 skill uses it; the
  // behaviour is real so phase 2 does not reopen this file.
  heal(sim, p, skill, step, rank, grid, out) {
    const amt = rankedDamage(step.amount, skill, rank) * engineScale(step, p);
    for (const q of sim.livePlayers()) {
      const dx = q.x - p.x, dy = q.y - p.y;
      if (dx * dx + dy * dy > step.radius * step.radius) continue;
      q.hp = Math.min(q.stats.vitality, q.hp + amt);
      sim.fx.hits.push({ x: Math.round(q.x), y: Math.round(q.y - 20), a: Math.round(amt), c: 0 });
      out.states++;
    }
  },

  // Flat absorb pool with a lifetime.
  shield(sim, p, skill, step, rank, grid, out) {
    // `amount` rather than `damage`, so it cannot use stepDamage — but it rides
    // the same engine hook, through the same function.
    const amt = rankedDamage(step.amount, skill, rank) * engineScale(step, p);
    p.shield = Math.max(p.shield, amt);
    p.shieldT = Math.max(p.shieldT || 0, rankedDuration(step.duration, skill, rank) / MS);
    out.states++;
  },

  // Absorb that also returns a fraction of what it eats.
  ward(sim, p, skill, step, rank, grid, out) {
    p.ward = Math.max(p.ward || 0, rankedDamage(step.amount, skill, rank) * engineScale(step, p));
    p.wardT = Math.max(p.wardT || 0, rankedDuration(step.duration, skill, rank) / MS);
    p.wardReflect = Math.max(p.wardReflect || 0, step.reflectPct || 0);
    p.wardDomain = skill.domain;
    out.states++;
  },

  // Damage that returns a fraction as healing. Unused in phase 1.
  drain(sim, p, skill, step, rank, grid, out) {
    const dmg = stepDamage(step, skill, rank, p);
    const t = selectTarget(skill.select, grid, p.x, p.y, step.range);
    if (!t) return;
    const dealt = sim.skillDamage(t, dmg, p, skill);
    p.hp = Math.min(p.stats.vitality, p.hp + dealt * step.healPct);
    out.hits++;
  },

  // Puts a minion on the field. The ELEVENTH primitive, and the one that
  // decides whether this table generalises: summons were the largest bespoke
  // category in the source project, and every one of them had its own spawn,
  // attack and death code.
  //
  // Everything that made them bespoke is data here. `archetype` names a row,
  // `move` names one of MOVE_KINDS, and `attack` is ITSELF A COMPOSE STEP that
  // the minion runs through this same table — so a skeleton's cleave is the
  // `strike` above, not a copy of it. This function does not know what a
  // skeleton is, and js/minions.js does not either.
  summon(sim, p, skill, step, rank, grid, out) {
    // DELIVERED SUMMONS. §8.5: Raise Skeleton throws at a soul token and the
    // skeleton rises WHERE IT LANDS. `deliver` makes that a property of the
    // step rather than of the skill, so any future summon can be thrown and
    // this function still does not know what a skeleton is.
    //
    // It is what turns the token from a counter into a place: the position
    // comes from the trigger that spent it, and a Necromancer's positioning
    // stops being only about where enemies are.
    if (step.deliver) {
      const at = p.tokenClaimAt;
      if (!at) return;                     // nothing was spent, nothing lands
      sim.spawnSummonSeed(p, skill, step, rank, at);
      out.states++;
      return;
    }
    out.states += sim.spawnMinions(p, skill, step, rank);
  },

  // A spreading damage-over-time. Stacks rather than refreshing, which is what
  // makes Internal Collapse a payoff for a tree that already applies dots.
  // THE TWELFTH PRIMITIVE, and the first addition to a set closed since phase 1.
  //
  // It is here because the Wizard's engine — "the only class that changes its
  // own damage domain mid-fight" (§8.3) — needs a write path no existing
  // primitive provides. `bestDomainMult` read `p.hookAgg.domainAdd` and nothing
  // else, which is an ITEM aggregate no skill can reach, and the only primitive
  // that wrote a domain at all was `ward`, which writes `p.wardDomain` for the
  // ward's reflect. See §5.7 for what admits a twelfth: a class engine needing
  // a write path nothing provides, ruled before the tree and never during.
  //
  // NO DURATION, DELIBERATELY. A shift persists until the next shift or the end
  // of the room, so this primitive needs no decay and therefore no tick. A timed
  // shift would have made the Wizard tick-shaped, which is a heavier class of
  // change for a difference the design does not ask for: §8.3 says the Wizard
  // changes domain mid-fight, not that it holds one briefly.
  shift(sim, p, skill, step, rank, grid, out) {
    p.domainShift = step.domain;
    p.domainShifts = (p.domainShifts || 0) + 1;
    sim.pushEvent({ k: 'toast', idx: p.idx, text: `Attuned: ${step.domain}` });
    out.states++;
  },

  plague(sim, p, skill, step, rank, grid, out) {
    const seed = selectTarget(skill.select, grid, p.x, p.y, skill.trigger.range || skill.trigger.radius || step.spreadRadius);
    if (!seed) return;
    sim.applyPlague(seed, rankedDamage(step.damage, skill, rank), rankedDuration(step.duration, skill, rank) / MS, p, skill);
    out.statuses++;
    for (const e of grid.near(seed.x, seed.y, step.spreadRadius)) {
      if (e === seed) continue;
      const dx = e.x - seed.x, dy = e.y - seed.y;
      if (dx * dx + dy * dy > step.spreadRadius * step.spreadRadius) continue;
      sim.applyPlague(e, rankedDamage(step.damage, skill, rank), rankedDuration(step.duration, skill, rank) / MS, p, skill);
      out.statuses++;
    }
  },
};

// ---------------------------------------------------------------- riders
//
// Riders are optional keys on a step's `riders` object. Absent means off. They
// are deliberately NOT primitives: `strike + stun` is one action with a rider,
// and modelling it as two steps would make every combination a new entry.

export function applyImpactRiders(sim, p, skill, r, e, rank, angle, out) {
  if (r.stun) {
    e.stunT = Math.max(e.stunT || 0, r.stun / MS);
    // A stun during a wind-up cancels the attack outright. This is what turns
    // Rebuke into a counter-attack LOOP rather than a one-off payout: break
    // stance, dodge, stun, and the NEXT wind-up dies too, which is the time to
    // rebuild the stack.
    if (sim.cancelTelegraph) sim.cancelTelegraph(e);
    out.statuses++;
  }
  if (r.root) { e.rootT = Math.max(e.rootT || 0, r.root / MS); out.statuses++; }
  if (r.taunt) { e.tauntT = Math.max(e.tauntT || 0, r.taunt / MS); e.tauntIdx = p.idx; out.statuses++; }
  if (r.knockback) {
    const k = r.knockback * knockMult(p);           // §9.2 magnitude (D-25)
    e.knockX += Math.cos(angle) * k; e.knockY += Math.sin(angle) * k; out.statuses++;
  }
  if (r.slow) { sim.applySlow(e, r.slow.mult, r.slow.dur / MS, p); out.statuses++; }
  if (r.weakenDamage) { e.weakDmgT = r.weakenDamage.dur / MS; e.weakDmgMult = r.weakenDamage.mult; out.statuses++; }
  if (r.weakenDefense) { e.defDownT = r.weakenDefense.dur / MS; e.defDownMult = r.weakenDefense.mult; out.statuses++; }
  if (r.healPerHit) { p.hp = Math.min(p.stats.vitality, p.hp + r.healPerHit); out.states++; }
  // JUDGMENT MARK. The mark is state on the ENEMY and it names its owner, its
  // payout and its reach, because the thing that reads it is `_killEnemy` —
  // which runs long after this step, possibly from somebody else's killing blow.
  // Carrying the numbers on the mark rather than looking them back up means a
  // mark detonates as the skill that placed it specified, even if the Priest is
  // dead by then.
  if (r.mark) {
    e.markT = Math.max(e.markT || 0, r.mark.dur / MS);
    e.markBy = p.idx;
    e.markHeal = r.mark.heal;
    e.markRadius = r.mark.radius;
    out.statuses++;
  }
  // THE VOODOO DOLL. §8.3's Witch Doctor engine, and the smallest write path in
  // the game — because the MIRROR ALREADY EXISTS. `voodooMirror` has always sent
  // 35% of everything the Witch Doctor deals onto `p.voodooId`, through walls and
  // across the map. What did not exist was the DESIGNATION: `tickVoodoo` binds
  // the NEAREST enemy and rebinds on death or drift, so the doll was whatever
  // trash happened to be closest, and the class's whole fantasy — pour damage
  // into a doll and have it come out of something that matters — was unreachable.
  //
  // This rider is that choice. It writes `p.voodooId` on the caster rather than
  // state on the enemy, which is unusual for an impact rider and is exactly
  // right: the doll IS an enemy identity, so the moment of impact is when the
  // game knows which one. §5.7 condition 2 — a rider will do, because there is
  // an impact to resolve on — so this is a rider and not a thirteenth primitive.
  //
  // Rebinding CLEARS THE BANKED DEBT, the same way `tickVoodoo` does on an
  // auto-rebind. Carrying `voodooDmg` across a designation would let a Witch
  // Doctor load a trash mob, re-designate onto a boss, and arrive with a full
  // engine it never paid for.
  // DESIGNATION IS STICKY, and that is the load-bearing half of the rule.
  // `p.voodooDmg` is per-doll and `tickVoodoo` zeroes it on every auto-rebind,
  // so a rider that re-designated on every hit would reset the bank on every
  // cast — a cone touching four bodies would end each swing with a fresh doll
  // and an empty engine, and the class would never accumulate anything. So the
  // rider binds only when the slot is OPEN: no doll, or a doll that has died.
  //
  // The choice is still the player's, and it is expressed through the skill's
  // own SELECTOR — a designating skill that picks `highest_hp` pins the elite
  // the moment the last doll dies, which is the whole class fantasy. What it
  // cannot do is thrash.
  // DRENCH — the Sundian's engine, and §8.3 rules it a status of its own rather
  // than a fifth member of `ON_STATUS`'s four. The reason is a category error,
  // not a tuning one: `dot`, `slow`, `plague` and `weakened` are EFFECTS, each
  // describing something happening to the enemy right now. Drench is a COUNTER
  // that pays out in burst — it does nothing while it sits there. Folding it in
  // would make every `ON_STATUS` skill in the game fire on drench and couple the
  // Sundian's engine to the whole taxonomy in both directions, forever.
  //
  // So it is two riders, not one. `drench` puts stacks on; `sluice` takes them
  // off and turns them into damage. A counter with no payout is a number, and a
  // payout with no counter is a multiplier — the pair IS the mechanic, which is
  // why both are ruled and gated together before a single Sundian tree exists.
  if (r.drench) {
    // Capped, and the cap is data. An uncapped counter that any AoE refreshes is
    // an unbounded multiplier on the burst, which is the one shape §4.2 will not
    // survive.
    if (e.drenchBy !== p.idx) { e.drench = 0; e.drenchBy = p.idx; }
    e.drench = Math.min(r.drench.cap, (e.drench || 0) + r.drench.stacks);
    e.drenchT = Math.max(e.drenchT || 0, r.drench.dur / MS);
    out.statuses++;
  }
  if (r.sluice) {
    // THE PAYOUT, AND IT SPENDS WHAT IT PAYS. Damage already landed above at the
    // step's own magnitude; this is the burst on top, sized by what the target
    // was carrying, and the stacks are cleared in the same breath. Clearing
    // BEFORE the damage lands is deliberate — the same ordering the Priest's
    // mark needs, because `damageEnemy` can kill, and a death that re-entered a
    // rider still holding its stacks would pay twice.
    const stacks = e.drenchBy === p.idx ? (e.drench || 0) : 0;
    if (stacks > 0) {
      e.drench = 0; e.drenchT = 0; e.drenchBy = -1;
      const burst = Math.max(1, Math.round(stacks * r.sluice.per));
      sim.damageEnemy(e, burst, { owner: p, silent: true });
      sim.fx.booms.push({ x: Math.round(e.x), y: Math.round(e.y), r: r.sluice.radius || 24 });
      out.statuses++;
    }
  }
  if (r.doll) {
    const live = p.voodooId !== null ? sim.enemyById(p.voodooId) : null;
    if (!live || !live.active) {
      p.voodooId = e.id;
      p.voodooDmg = 0;
      sim.pushEvent({ k: 'toast', idx: p.idx, text: 'The doll has a name' });
      out.states++;
    }
  }
}

// Projectile-only riders — the ones that need a flight or an impact point.
// The debuff riders a bolt shares with a strike go through applyImpactRiders,
// which the sim calls first. Section 4.3 lists riders per primitive as if the
// two sets were disjoint, but the spec's own Hex of Entropy is a bolt carrying
// weakenDamage and slow, so they are not: a debuff is a debuff wherever it
// lands, and only pierce/splash/impactDot/defenseDown are actually bolt-shaped.
export function applyBoltRiders(sim, p, skill, r, e, rank, out) {
  if (r.impactDot) {
    sim.applyPlague(e, rankedDamage(r.impactDot.damage, skill, rank), r.impactDot.dur / MS, p, skill);
    out && out.statuses++;
  }
  if (r.defenseDown) {
    e.defDownT = r.defenseDown.dur / MS; e.defDownMult = r.defenseDown.mult;
    out && out.statuses++;
  }
  if (r.splash) {
    sim.skillSplash(p, skill, e.x, e.y, r.splash.radius, rankedDamage(r.splash.damage, skill, rank), e);
    out && out.hits++;
  }
}

// ---------------------------------------------------------------- entry point

export function runCompose(sim, p, skill, rank, grid) {
  const out = { hits: 0, damage: 0, statuses: 0, states: 0 };
  for (const step of skill.compose) {
    const prim = PRIMITIVES[step.kind];
    if (!prim) continue;      // load assertions reject unknown kinds; belt and braces
    prim(sim, p, skill, step, rank, grid, out);
  }
  return out;
}

export const PRIMITIVE_KINDS = Object.keys(PRIMITIVES);

// Riders that resolve on a hit enemy — valid anywhere damage lands.
// `mark` is the Priest's write path (§8.3 judgment marks). A rider could write
// exactly eight enemy fields before it and none of them was a mark, so a
// skill-placed mark had nowhere to live and no detonation site — every death
// hook in `_killEnemy` read `killer.hookAgg`, the ITEM aggregate.
export const IMPACT_RIDERS = ['stun', 'taunt', 'root', 'knockback', 'slow', 'weakenDamage', 'weakenDefense', 'healPerHit', 'mark', 'doll', 'drench', 'sluice'];
// Riders that shape the swing itself rather than the target.
export const SHAPE_RIDERS = ['windUp', 'multiPulse'];
// Riders that need a projectile: a flight to pierce, an impact point to splash.
export const BOLT_RIDERS = ['pierce', 'splash', 'impactDot', 'defenseDown'];

export const RIDERS_BY_PRIMITIVE = {
  strike: [...IMPACT_RIDERS, ...SHAPE_RIDERS],
  line: [...IMPACT_RIDERS, ...SHAPE_RIDERS],
  cone: [...IMPACT_RIDERS],
  bolt: [...IMPACT_RIDERS, ...BOLT_RIDERS],
  hazard: ['slow'],
  // A summon takes no riders. Riders resolve on a target at the moment of
  // impact; a summon has no impact. What the MINION'S attack carries is
  // declared on the attack step, and is validated against that step's own
  // primitive — see assertTrees().
  summon: [],
  // `trap` takes no riders for the same reason `summon` and `shift` take none:
  // riders resolve on a target at the moment of impact, and placing an inert
  // object has no impact. What the DETONATION carries is declared on the trap
  // step and read when it goes off.
  trap: [],
  // `shift` takes no riders for the same reason `summon` takes none: riders
  // resolve on a target at the moment of impact, and a shift has no target.
  heal: [], shield: [], ward: [], drain: [], plague: [], shift: [],
};
