// THE SIM SIDE OF SKILLS — trigger tick, engines, statuses, progression.
//
// Kept out of game.js so the gate is removable: if auto-triggered combat does
// not feel as good as the shooter, this module and its two content files are
// what get deleted, and js/game.js goes back to calling _tickWeapons.
//
// Everything here runs on the HOST. Clients receive fire events in the fx
// stream and render them; they never evaluate a trigger.

import { EnemyGrid, triggerHolds, TRIGGER_TICK_MS, MAX_TRIGGER_EVALS_PER_TICK } from './triggers.js';
import { runCompose, applyBoltRiders, applyImpactRiders, rankedDamage } from './compose.js';
import { SKILL_BY_ID, TREES, TREES_BY_CLASS, isDamaging, slotsAtLevel, skillRank, canLearn } from './skills.js';
import { domainMult } from './domains.js';
import { TUNING as SAM } from './content/skills/samurai_armor.js';

const S = TRIGGER_TICK_MS / 1000;

// ---------------------------------------------------------------- per-player

export function initSkillPlayer(sim, p) {
  p.skillRanks = {};                 // id -> points spent
  p.skillPoints = 0;                 // unspent
  p.loadout = new Array(8).fill(null);
  p.skillCd = {};                    // id -> seconds remaining
  p.trigState = {};                  // id -> per-trigger memory (edge arming)
  p.trigEvents = { kill: 0, hitTaken: 0, dodgeT: -999, lastFired: null };
  p.engines = { footing: 0 };        // readable resource state for other trees
  p.footingAcc = 0;
  p.movingT = 0;
  p.shieldT = 0; p.ward = 0; p.wardT = 0; p.wardReflect = 0; p.wardDomain = null;
  p.queuedSteps = [];
  p.fireLog = [];                    // debug overlay: last fires
  // Level 1 already grants the opening pick, so a character is never weaponless
  // AND pointless at the same time — with weapons gone that would be a player
  // standing in a fight with no way to affect it.
  p.skillPoints = 1;
}

export function treesFor(p) { return TREES_BY_CLASS[p.charId] || []; }

export function learnableSkills(p) {
  return treesFor(p).flatMap(t => TREES[t].skills).filter(s => canLearn(p, s));
}

// ---------------------------------------------------------------- progression

export function spendSkillPoint(sim, p, id) {
  const sk = SKILL_BY_ID[id];
  if (!sk || p.skillPoints <= 0 || !canLearn(p, sk)) return false;
  p.skillPoints--;
  p.skillRanks[id] = (p.skillRanks[id] || 0) + 1;
  // First active learned auto-slots: the anti-softlock floor is load-bearing
  // from the first minute with a 1-slot start, and a player who has just made
  // their opening pick should not have to also discover a loadout screen.
  if (sk.type === 'active' && !p.loadout.some(x => x === id)) {
    const free = p.loadout.findIndex((x, i) => x === null && i < slotsAtLevel(p.level));
    if (free >= 0) p.loadout[free] = id;
  }
  sim._recomputeStats(p);
  sim.pushEvent({ k: 'skillLearned', idx: p.idx, id, rank: p.skillRanks[id] });
  return true;
}

// Loadout changes are permitted between rooms only, never mid-fight.
export function setLoadout(sim, p, slot, id) {
  if (sim.phase === 'arena' && !sim.cleared) return { ok: false, reason: 'not during a fight' };
  if (slot < 0 || slot >= slotsAtLevel(p.level)) return { ok: false, reason: 'slot locked' };
  const sk = id ? SKILL_BY_ID[id] : null;
  if (id && (!sk || sk.type !== 'active' || skillRank(p, id) < 1)) return { ok: false, reason: 'not a learned active' };
  const next = [...p.loadout];
  next[slot] = id;
  // THE ANTI-SOFTLOCK FLOOR: never leave a player with no way to deal damage.
  const anyDamage = next.some(x => x && isDamaging(SKILL_BY_ID[x]));
  const ownsDamage = Object.keys(p.skillRanks).some(x => isDamaging(SKILL_BY_ID[x]));
  if (ownsDamage && !anyDamage) return { ok: false, reason: 'at least one damaging active must stay slotted' };
  p.loadout = next;
  return { ok: true };
}

export function grantSkillPoint(sim, p) {
  p.skillPoints++;
  sim.pushEvent({ k: 'skillPoint', idx: p.idx, points: p.skillPoints });
}

// ---------------------------------------------------------------- the engines

// FOOTING. One stack per half-second stationary; the whole stack drops the
// instant the player moves. No decay — a gradual falloff would let the Samurai
// drift and keep the payoff, which erases the decision the engine exists for.
function tickFooting(sim, p, dt) {
  if (!treesFor(p).includes('samurai_armor')) return;
  if (p.moving) {
    if (p.engines.footing) { p.engines.footing = 0; sim._recomputeStats(p); }
    p.footingAcc = 0;
    return;
  }
  const maxStacks = SAM.footingMaxStacks + passiveSum(p, 'footingMaxBonus');
  const rate = 1 + passiveSum(p, 'footingAccrualPct');
  p.footingAcc += dt * rate;
  const per = SAM.footingTickMs / 1000;
  while (p.footingAcc >= per && p.engines.footing < maxStacks) {
    p.footingAcc -= per;
    p.engines.footing++;
    sim._recomputeStats(p);
  }
  if (p.engines.footing >= maxStacks) p.footingAcc = 0;
}

// A passive's contribution, summed over its ranks. Passives are always on and
// never slotted, so this reads ranks directly.
export function passiveSum(p, key) {
  let n = 0;
  for (const [id, rank] of Object.entries(p.skillRanks || {})) {
    const sk = SKILL_BY_ID[id];
    if (!sk || sk.type !== 'passive' || !sk.passive || sk.passive[key] === undefined) continue;
    n += sk.passive[key] * rank;
  }
  return n;
}

// Stat contribution from engines, folded into _recomputeStats.
export function engineStatBonus(p) {
  const f = (p.engines && p.engines.footing) || 0;
  if (!f) return null;
  return {
    vitality: f * SAM.footingVitPerStack,
    grit: f * (SAM.footingGritPerStack + passiveSum(p, 'footingGritBonus')),
    reflex: f * SAM.footingDodgePerStack,
  };
}

// ---------------------------------------------------------------- the tick

export function tickSkills(sim, dt) {
  for (const p of sim.players) {
    if (p.gone) continue;
    p.movingT = p.moving ? (p.movingT || 0) + dt : 0;
    tickFooting(sim, p, dt);
    for (const id of Object.keys(p.skillCd)) {
      if ((p.skillCd[id] -= dt) <= 0) delete p.skillCd[id];
    }
    if (p.shieldT > 0 && (p.shieldT -= dt) <= 0) { p.shield = 0; p.shieldT = 0; }
    if (p.wardT > 0 && (p.wardT -= dt) <= 0) { p.ward = 0; p.wardT = 0; p.wardReflect = 0; }
    for (let i = p.queuedSteps.length - 1; i >= 0; i--) {
      const q = p.queuedSteps[i];
      if ((q.t -= dt) > 0) continue;
      p.queuedSteps.splice(i, 1);
      runCompose(sim, p, { ...q.skill, compose: [q.step] }, q.rank, sim.trigGrid);
    }
  }

  sim.trigAcc += dt;
  if (sim.trigAcc < S) return;
  sim.trigAcc -= S;
  runTriggerTick(sim);
}

function runTriggerTick(sim) {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  sim.trigGrid.queries = 0;
  sim.trigGrid.rebuild(sim.enemyPool);

  let evals = 0, fires = 0, capped = false;
  const live = sim.players.filter(q => !q.gone && !q.downed);
  // Round-robin start so an exhausted budget never starves the same player
  // twice running. If this fires during normal 8p play that is a finding, not
  // a bug to hide — the overlay counts it.
  const n = live.length;
  for (let k = 0; k < n; k++) {
    const p = live[(sim.trigCursor + k) % n];
    const slots = slotsAtLevel(p.level);
    for (let i = 0; i < slots; i++) {
      const id = p.loadout[i];
      if (!id) continue;
      const sk = SKILL_BY_ID[id];
      if (!sk) continue;
      // COOLDOWN FIRST, before any spatial query. This ordering is most of the
      // performance win: a skill on cooldown costs one number comparison.
      if (p.skillCd[id] > 0) continue;
      if (evals >= MAX_TRIGGER_EVALS_PER_TICK) { capped = true; break; }
      evals++;
      const st = (p.trigState[id] ||= { armed: true });
      if (!triggerHolds(sim, p, sk, st, sim.trigGrid)) continue;
      fireSkill(sim, p, sk);
      fires++;
    }
    if (capped) { sim.trigCursor = (sim.trigCursor + k) % n; break; }
  }
  if (!capped) sim.trigCursor = (sim.trigCursor + 1) % Math.max(1, n);

  // one-shot trigger events are consumed by the tick that saw them
  for (const p of sim.players) { p.trigEvents.kill = 0; p.trigEvents.hitTaken = 0; }

  const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  sim.trigStats = {
    evals, fires, capped, queries: sim.trigGrid.queries,
    cells: sim.trigGrid.buckets.size, enemies: sim.trigGrid.count,
    ms: t1 - t0,
    cappedCount: sim.trigStats.cappedCount + (capped ? 1 : 0),
    ticks: sim.trigStats.ticks + 1,
  };
}

// ONE FIRE PER TICK PER SKILL, regardless of how many enemies satisfied it.
function fireSkill(sim, p, sk) {
  const rank = skillRank(p, sk.id);
  p.skillCd[sk.id] = sk.cooldown / 1000;
  const out = runCompose(sim, p, sk, rank, sim.trigGrid);
  p.trigEvents.lastFired = sk.id;
  p.fireLog.push({ id: sk.id, trigger: sk.trigger.kind, t: sim.time, hits: out.hits });
  if (p.fireLog.length > 20) p.fireLog.shift();
  // Broadcast: clients render the fire, they never originate it.
  sim.fx.skillFires.push({ idx: p.idx, x: Math.round(p.x), y: Math.round(p.y), id: sk.id, d: sk.domain });
  return out;
}

// ---------------------------------------------------------------- damage

// THE one damage path for skills. Everything routes through the triangle —
// hazard ticks and plague ticks included. There is no unrouted path, because
// the moment one exists a build is strong for reasons the rim colour cannot
// explain.
export function skillDamage(sim, e, amount, p, skill) {
  let amt = amount * domainMult(skill.domain, e.domain);
  if (e.defDownT > 0) amt /= e.defDownMult;         // defense down = takes more
  const before = e.hp;
  sim.damageEnemy(e, amt, { owner: p });
  const dealt = before - e.hp;
  p.damageDealt += Math.max(0, dealt);
  return Math.max(0, dealt);
}

export function skillSplash(sim, p, skill, x, y, radius, damage, exclude) {
  for (const e of sim.trigGrid.near(x, y, radius)) {
    if (e === exclude) continue;
    const dx = e.x - x, dy = e.y - y;
    if (dx * dx + dy * dy > radius * radius) continue;
    skillDamage(sim, e, damage, p, skill);
  }
}

export function spawnSkillProj(sim, p, skill, step, rank, angle, range) {
  const pr = sim.projPool.alloc();
  if (!pr) return;
  const r = step.riders || {};
  Object.assign(pr, {
    id: ++sim.spawnCounter, x: p.x + Math.cos(angle) * 6, y: p.y + Math.sin(angle) * 6,
    vx: Math.cos(angle) * step.speed, vy: Math.sin(angle) * step.speed,
    dmg: rankedDamage(step.damage, skill, rank), crit: false, friendly: true, lob: false,
    ttl: (range + 60) / step.speed, radius: 5, color: p.color, owner: p.idx,
    pierce: r.pierce || 0, hitIds: new Set(),
    weaponId: null, kind: 'skill', summonBurn: null, summonKnock: 0, fromSummon: false,
    skill: { id: skill.id, rank },
  });
}

// A skill projectile landing. Impact riders first (they are shared with strike),
// then the projectile-only ones.
export function hitSkillProj(sim, pr, e) {
  const p = sim.players[pr.owner];
  const sk = SKILL_BY_ID[pr.skill.id];
  if (!p || !sk) return;
  const step = sk.compose.find(c => c.kind === 'bolt') || {};
  const r = step.riders || {};
  const angle = Math.atan2(pr.vy, pr.vx);
  skillDamage(sim, e, pr.dmg, p, sk);
  applyImpactRiders(sim, p, sk, r, e, pr.skill.rank, angle, { hits: 0, statuses: 0, states: 0 });
  applyBoltRiders(sim, p, sk, r, e, pr.skill.rank, null);
}

// ---------------------------------------------------------------- statuses

export function applySlow(sim, e, mult, dur) {
  e.slowT = Math.max(e.slowT || 0, dur);
  e.slowMult = Math.min(e.slowMult || 1, mult);
}

// Plague STACKS rather than refreshing — that is what makes Internal Collapse a
// payoff for a tree that already applies dots, and it is marked EXACT in the
// spec for a reason.
export function applyPlague(sim, e, damage, dur, p, skill) {
  e.plagueT = Math.max(e.plagueT || 0, dur);
  e.plagueDps = (e.plagueDps || 0) + damage / Math.max(0.1, dur);
  e.plagueOwner = p.idx;
  e.plagueDomain = skill.domain;
}

export function tickSkillStatuses(sim, dt) {
  for (const e of sim.enemyPool) {
    if (!e.active) continue;
    if (e.stunT > 0) e.stunT -= dt;
    if (e.rootT > 0) e.rootT -= dt;
    if (e.tauntT > 0) e.tauntT -= dt;
    if (e.weakDmgT > 0) e.weakDmgT -= dt;
    if (e.defDownT > 0) e.defDownT -= dt;
    if (e.plagueT > 0) {
      e.plagueT -= dt;
      e.plagueAcc = (e.plagueAcc || 0) + e.plagueDps * dt;
      if (e.plagueAcc >= 1) {
        const d = Math.floor(e.plagueAcc);
        e.plagueAcc -= d;
        const owner = sim.players[e.plagueOwner];
        // routed through the triangle like every other damage source
        sim.damageEnemy(e, d * domainMult(e.plagueDomain, e.domain), { owner, silent: true, noEffects: true });
      }
      if (e.plagueT <= 0) { e.plagueDps = 0; e.plagueAcc = 0; }
    }
  }
}

export function queueSkillStep(sim, p, skill, step, rank, delay) {
  p.queuedSteps.push({ skill, step, rank, t: delay });
}

// ---------------------------------------------------------------- events

export function onSkillKill(sim, p) { if (p && p.trigEvents) p.trigEvents.kill++; }
export function onSkillHitTaken(sim, p) { if (p && p.trigEvents) p.trigEvents.hitTaken++; }
export function onSkillDodge(sim, p) { if (p && p.trigEvents) p.trigEvents.dodgeT = sim.time; }

// The ward's absorb-and-return, called from the player damage path.
export function wardAbsorb(sim, p, amount, source) {
  if (!(p.ward > 0)) return amount;
  const eaten = Math.min(p.ward, amount);
  p.ward -= eaten;
  if (p.wardReflect > 0 && source && source.active) {
    sim.damageEnemy(source, eaten * p.wardReflect * domainMult(p.wardDomain, source.domain), { owner: p });
  }
  return amount - eaten;
}
