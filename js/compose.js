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
  return rankedDamage(step.damage, skill, rank) * engineScale(step, p);
}

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
    }
    sim.fx.swings.push({ x: p.x, y: p.y, a: a0, r: reach, color: p.color });
  },

  // Travelling projectile. Riders ride the projectile and resolve on impact.
  bolt(sim, p, skill, step, rank, grid, out) {
    const range = step.range || skill.trigger.range || skill.trigger.radius;
    const count = step.count || 1;
    const targets = count > 1
      ? selectTargets(skill.select, grid, p.x, p.y, range, count)
      : [selectTarget(skill.select, grid, p.x, p.y, range)].filter(Boolean);
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
    const a0 = grid.densestAngle(p.x, p.y, step.range) ?? facing(sim, p, grid, step.range, skill.select);
    for (const e of grid.near(p.x, p.y, step.range)) {
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy > step.range * step.range) continue;
      if (Math.abs(angleDelta(Math.atan2(dy, dx), a0)) > step.angle / 2) continue;
      if (sim.losBlocked(p.x, p.y, e.x, e.y)) continue;
      sim.skillDamage(e, dmg, p, skill);
      out.hits++;
    }
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
        out.hits++;
      }
    }
    sim.fx.beams.push({ x1: p.x, y1: p.y, x2: p.x + ca * len, y2: p.y + sa * len, color: p.color, w: step.width });
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

  // A spreading damage-over-time. Stacks rather than refreshing, which is what
  // makes Internal Collapse a payoff for a tree that already applies dots.
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
  if (r.knockback) { e.knockX += Math.cos(angle) * r.knockback; e.knockY += Math.sin(angle) * r.knockback; out.statuses++; }
  if (r.slow) { sim.applySlow(e, r.slow.mult, r.slow.dur / MS); out.statuses++; }
  if (r.weakenDamage) { e.weakDmgT = r.weakenDamage.dur / MS; e.weakDmgMult = r.weakenDamage.mult; out.statuses++; }
  if (r.weakenDefense) { e.defDownT = r.weakenDefense.dur / MS; e.defDownMult = r.weakenDefense.mult; out.statuses++; }
  if (r.healPerHit) { p.hp = Math.min(p.stats.vitality, p.hp + r.healPerHit); out.states++; }
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
export const IMPACT_RIDERS = ['stun', 'taunt', 'root', 'knockback', 'slow', 'weakenDamage', 'weakenDefense', 'healPerHit'];
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
  heal: [], shield: [], ward: [], drain: [], plague: [],
};
