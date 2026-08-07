// THE SIM SIDE OF SKILLS — trigger tick, engines, statuses, progression.
//
// Kept out of game.js so the gate is removable: if auto-triggered combat does
// not feel as good as the shooter, this module and its two content files are
// what get deleted, and js/game.js goes back to calling _tickWeapons.
//
// Everything here runs on the HOST. Clients receive fire events in the fx
// stream and render them; they never evaluate a trigger.

import { EnemyGrid, triggerHolds, TRIGGER_TICK_MS, MAX_TRIGGER_EVALS_PER_TICK } from './triggers.js';
import { selectTarget } from './selectors.js';
import { runCompose, applyBoltRiders, applyImpactRiders, rankedDamage, stepDamage } from './compose.js';
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
  // Readable resource state. Every engine in the game publishes here, and
  // compose.js's engineScale() reads here — it knows no engine by name.
  p.engines = { footing: 0, armor: 0 };
  p.engineScaleBonus = { footing: 0, armor: 0 };   // passives that raise a stack's worth
  p.footingAcc = 0;
  p.footingMove = 0;                  // grace budget: movement time, decays while still
  p.footingShield = 0;               // the stance's absorb pool (see engineStatBonus)
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

// FOOTING. One stack per half-second stationary. Movement inside the grace
// window (footingGraceMs) holds the stance without growing it; movement past it
// drops the whole stack at once. No gradual decay — a falloff would let the
// Samurai drift and keep most of the payoff, which erases the decision.
function tickFooting(sim, p, dt) {
  if (!treesFor(p).includes('samurai_armor')) return;
  // THE GRACE BUDGET. Movement time accumulates here and decays while standing
  // still; the stance drops when the budget is spent, not the moment a key goes
  // down. See footingGraceMs in the Armor tree's TUNING for why.
  const grace = SAM.footingGraceMs / 1000;
  if (p.moving) p.footingMove = (p.footingMove || 0) + dt;
  else p.footingMove = Math.max(0, (p.footingMove || 0) - dt * SAM.footingGraceRefill);

  if (p.moving) {
    // Inside the window: the stance HOLDS but does not grow. A sidestep out of
    // a committed zone keeps what you had; it does not pay you for moving.
    if (p.footingMove < grace) { p.footingAcc = 0; return; }
    // Past the window: the whole stack, at once. No partial falloff — a
    // gradual decay would let the Samurai drift across a room and keep most of
    // the payoff, which erases the decision. The absorb pool goes with it.
    //
    // WHY THE WINDOW EXISTS. Before it, criterion 13 at 50% telegraph density
    // put the holder at x0.37-x0.40 damage taken against a correct sidestepper,
    // and that ratio did not move for any dial tried. The insensitivity was the
    // evidence: it was never the size of a stack, it was that a 200ms sidestep
    // cost the entire stance and the rebuild is slower than the next commit
    // arrives, so a bot that dodged correctly lived permanently at 0-3 stacks
    // and never had a stance to make a decision about.
    if (p.engines.footing) { p.engines.footing = 0; p.footingShield = 0; sim._recomputeStats(p); }
    p.footingAcc = 0;
    return;
  }
  // THE CAP IS THE ENGINE'S, AND NOTHING RAISES IT. This read
  // `SAM.footingMaxStacks + passiveSum(p, 'footingMaxBonus')`, so Set Stance's
  // rankable +1 pushed a designed ten to a measured seventeen and inflated
  // every per-stack term with it. `footingMaxBonus` is deliberately not summed
  // here any more: if a future skill declares one it does nothing, which is the
  // correct outcome for a passive trying to raise a hard cap.
  const maxStacks = SAM.FOOTING_MAX_STACKS;
  const rate = 1 + passiveSum(p, 'footingAccrualPct');
  p.footingAcc += dt * rate;
  const per = SAM.footingTickMs / 1000;
  while (p.footingAcc >= per && p.engines.footing < maxStacks) {
    p.footingAcc -= per;
    p.engines.footing++;
    p.footingShield = footingShieldFor(p);
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
//
// NOT vitality. Footing used to grant max HP per stack, which meant breaking
// stance lowered max Vitality and CLAMPED current HP down with it: a Samurai
// lost health for dodging, by an amount unrelated to the attack, and the loss
// landed hardest exactly when they did the thing the mechanic exists to reward.
// The stack now carries an absorb pool instead (footingShield below), which
// costs the same to break and takes nothing the player already had.
export function engineStatBonus(p) {
  const f = (p.engines && p.engines.footing) || 0;
  // Marrow's Calcify is a flat passive rather than an engine, but it lands in
  // the same place so the two compose rather than racing.
  const grit = f * (SAM.footingGritPerStack + passiveSum(p, 'footingGritBonus')) + passiveSum(p, 'armorGrit');
  const vit = passiveSum(p, 'armorVit');
  // NO REFLEX. Footing grants vitality and grit only — see the note in the
  // Armor tree's TUNING. The Samurai has surrendered the ability to dodge
  // anything telegraphed; paying him dodge chance for standing still was the
  // opposite of that, and most of why holding beat dodging on both axes.
  if (!grit && !vit) return null;
  return { grit, vitality: vit };
}

// The pool itself. It reuses the shield mechanism — same absorb-then-carry
// path in hurtPlayer — but lives in its own field rather than in p.shield,
// because breaking stance must drop exactly the Footing part and not eat an
// Iron Sleeve proc that happens to be running. Recomputed whenever the stack
// changes, so it tracks the stack exactly in both directions.
export function footingShieldFor(p) {
  const f = (p.engines && p.engines.footing) || 0;
  return f * SAM.footingShieldPerStack;
}

// ---------------------------------------------------------------- the tick

export function tickSkills(sim, dt) {
  for (const p of sim.players) {
    if (p.gone) continue;
    // publish the engines other trees read
    p.engines.armor = Math.max(0, p.stats.grit);
    p.engineScaleBonus.footing = passiveSum(p, 'footingDamageBonus');
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
  // THE ToH TRAIT LAYER OBSERVES ATTACKS, and this is what an attack is now.
  // tohOnFire() was called from _tickWeapons() and nothing else — and
  // _tickWeapons has not run since weapons were removed. So Rhythm never built
  // a stack, the Mage's every-Nth singularity never counted, and the Sundian
  // never planted coral: the hook was orphaned, not broken. It needs only a
  // target position, so it takes the one this skill's own selector chose.
  const range = sk.trigger.range || sk.trigger.radius || 0;
  const tgt = range ? selectTarget(sk.select, sim.trigGrid, p.x, p.y, range) : null;
  sim._selLedger(sk.id, tgt);
  sim.tohOnFire(p, { def: null, a: p.aimA, tx: tgt ? tgt.x : p.x, ty: tgt ? tgt.y : p.y });
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

// The render radius a skill bolt carries. js/content/sprites.js mirrors this as
// PROJ_R_SHOT and buckets sprites off it, so the two must agree — they were two
// unlinked literals that happened to both be 5, and a change to either would
// have silently picked the wrong projectile sprite. sim_test asserts they
// match by observing a real skill fire.
export const SKILL_PROJ_R = 5;

export function spawnSkillProj(sim, p, skill, step, rank, angle, range) {
  const pr = sim.projPool.alloc();
  if (!pr) return;
  const r = step.riders || {};
  Object.assign(pr, {
    id: ++sim.spawnCounter, x: p.x + Math.cos(angle) * 6, y: p.y + Math.sin(angle) * 6,
    vx: Math.cos(angle) * step.speed, vy: Math.sin(angle) * step.speed,
    dmg: stepDamage(step, skill, rank, p), crit: false, friendly: true, lob: false,   // engine scaling rides the projectile
    ttl: (range + 60) / step.speed, radius: step.radius || SKILL_PROJ_R, color: p.color, owner: p.idx,
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
  // Marrow's Quill: reflect scales with armour. Applied here rather than at
  // cast, so it tracks grit as it moves rather than freezing at cast time.
  const quill = passiveSum(p, 'reflectPerGrit') * Math.max(0, p.stats.grit);
  if (quill > 0) p.wardReflect = Math.min(1, (p.wardReflect || 0) + quill);
  if (p.wardReflect > 0 && source && source.active) {
    sim.damageEnemy(source, eaten * p.wardReflect * domainMult(p.wardDomain, source.domain), { owner: p });
  }
  return amount - eaten;
}
