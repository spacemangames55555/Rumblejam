// THE SIM SIDE OF SKILLS — trigger tick, engines, statuses, progression.
//
// Kept out of game.js so the gate is removable: if auto-triggered combat does
// not feel as good as the shooter, this module and its two content files are
// what get deleted, and js/game.js goes back to calling _tickWeapons.
//
// Everything here runs on the HOST. Clients receive fire events in the fx
// stream and render them; they never evaluate a trigger.

import { EnemyGrid, triggerHolds, triggerConsume, TRIGGER_TICK_MS, MAX_TRIGGER_EVALS_PER_TICK } from './triggers.js';
import { selectTarget } from './selectors.js';
import { runCompose, applyBoltRiders, applyImpactRiders, rankedDamage, stepDamage } from './compose.js';
import { SKILL_BY_ID, TREES, TREES_BY_CLASS, isDamaging, slotsAtLevel, skillRank, canLearn } from './skills.js';
import { initMinionPlayer, summonSlotsFor, tickMinions, resetMinionsForRoom, spawnMinions } from './minions.js';
import { domainMult } from './domains.js';
import { CONFIG } from './config.js';
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
  // The Wizard's domain shift: null until a `shift` step writes one, then it
  // persists until the next shift or the end of the room. `domainShifts` counts
  // them, which is what a future `scaleWith: 'shift'` engine would read.
  p.domainShift = null; p.domainShifts = 0;
  // Readable resource state. Every engine in the game publishes here, and
  // compose.js's engineScale() reads here — it knows no engine by name.
  p.engines = { footing: 0, armor: 0, pack: 0 };
  p.engineScaleBonus = { footing: 0, armor: 0, pack: 0 };   // passives that raise a stack's worth
  initMinionPlayer(p);
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

// ROOM START, §8.5 rows 5 and 7. Lives here rather than in minions.js because
// it needs the skill registry, and minions.js cannot import it — js/skills.js
// imports MOVE_KINDS from minions.js, so the dependency only runs one way.
//
// Two halves of one rule. resetMinionsForRoom wipes what does not revive and
// restores what does; this then fills in any animal the player has PAID FOR but
// does not currently have standing. A Druid arrives with its pack, rather than
// spending the opening seconds of every fight re-summoning what its points
// already bought.
export function startRoomMinions(sim, p) {
  // A DOMAIN SHIFT DOES NOT SURVIVE A DOOR. It persists until the next shift or
  // the end of the room, which is what lets the `shift` primitive avoid a decay
  // tick — but "until the end of the room" only means something if something
  // ends it. Reset here rather than in a new room hook, so the one function the
  // sim already calls per room start owns both per-room resets a class needs.
  p.domainShift = null;
  resetMinionsForRoom(sim, p);
  for (const [id, rank] of Object.entries(p.skillRanks || {})) {
    if (!(rank > 0)) continue;
    const sk = SKILL_BY_ID[id];
    if (!sk) continue;
    for (const step of sk.compose || []) {
      // Only persistent summons are restored. A timed extra is bought by firing
      // its skill, and handing one out free at every door would make it a
      // permanent that happens to expire.
      if (step.kind !== 'summon' || !step.revives) continue;
      const have = p.minions.filter(m => m.arch === step.archetype).length;
      const want = step.maxAlive || 1;
      for (let i = have; i < want; i++) spawnMinions(sim, p, sk, step, rank);
    }
  }
}

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
    p.engineScaleBonus.pack = passiveSum(p, 'packDamageBonus');
    // Slots are recomputed from ranks every tick rather than incremented on
    // spend, so respecs, save loads and rank rollbacks cannot leave a player
    // holding slots no skill still pays for.
    p.summonSlots = summonSlotsFor(p, p.skillRanks, SKILL_BY_ID);
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

  tickMinions(sim, dt);

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
  // What the fire SPENDS, before what it does. A token is taken off the floor
  // by the skill that read it — the same shape as ON_KILL's counter being
  // cleared by the tick that saw it. Keyed by trigger kind in triggers.js.
  triggerConsume(sim, p, sk);
  // §9.2 magnitude, timed: the post-dodge damage buff is armed in `hurtPlayer`
  // and was CONSUMED in `_fireWeapon`, which stopped running with weapons — so
  // dodging armed a bonus that nothing ever spent (D-25). It is consumed here,
  // once per fire and for the whole fire, exactly as the weapon path spent it:
  // "next attack" means the next skill, not the next enemy in an arc.
  p._atkBuff = 1;
  if (p.dmgBuffT > 0 && p.dmgBuffAmt > 0) { p._atkBuff = 1 + p.dmgBuffAmt / 100; p.dmgBuffT = 0; }
  const out = runCompose(sim, p, sk, rank, sim.trigGrid);
  p._atkBuff = 1;
  // THE ToH TRAIT LAYER OBSERVES ATTACKS, and this is what an attack is now.
  // tohOnFire() was called from _tickWeapons() and nothing else — and
  // _tickWeapons has not run since weapons were removed. So Rhythm never built
  // a stack, the Mage's every-Nth singularity never counted, and the Sundian
  // never planted coral: the hook was orphaned, not broken. It needs only a
  // target position, so it takes the one this skill's own selector chose.
  const range = sk.trigger.range || sk.trigger.radius || 0;
  const tgt = range ? selectTarget(sk.select, sim.trigGrid, p.x, p.y, range) : null;
  // Only computed when the ledger is on — this is a diagnostic scan, and a
  // per-fire grid walk has no business in a normal run.
  let markInRange = null;
  if (sim.selLog && range) {
    markInRange = false;
    for (const e of sim.trigGrid.near(p.x, p.y, range)) {
      if (!e.bounty) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy <= range * range) { markInRange = true; break; }
    }
  }
  sim._selLedger(sk.id, tgt, markInRange);
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
// FEROCITY — the general offence stat (§9.5). Applied HERE, at the single
// damage path every composed action routes through, because "multiplies all
// composed damage" has to mean all of it: a strike, a bolt's impact, a cone, a
// hazard tick, a splash and a minion's swing are the same call.
//
// It was weapon damage in the weapon era and was left behind when the damage
// path moved to skills — §9.5's ruling is that this is the same job
// generalised, not a new stat. The floor at -100% keeps a heavy penalty roll
// from inverting damage into healing.
export function ferocityMult(p) {
  return Math.max(0, 1 + (p && p.stats ? p.stats.ferocity : 0) / 100);
}

// ------------------------------------------------------------------- crit
//
// §9.5: CRIT IS A ROLL INSIDE `skillDamage`. One roll, one path — the same
// single site that made Ferocity work, so every composed source inherits crit
// without a per-primitive decision and phase 5's twelve classes get it free.
// Before this it existed only in `_fireWeapon`: six items sold it and no skill
// in the game could crit (D-25).
//
// TWO TERMS IN ONE FORMULA, not two definitions of one thing:
//   chance     = Reflex × CRIT_CHANCE_PER_REFLEX + item chance
//   multiplier = the player's base (CONFIG.CRIT_MULT_BASE, or a trait's) + item
// Splitting a mechanic across two sources is what rule 25 warns about; splitting
// one formula across two terms is arithmetic.

export function critChance(p) {
  const stat = (p && p.stats ? p.stats.reflex : 0) * CONFIG.CRIT_CHANCE_PER_REFLEX;
  const item = (p && p.hookAgg ? p.hookAgg.critChance : 0) || 0;
  return Math.max(0, stat + item);
}

export function critMultOf(p) {
  const base = (p && p.critMult) || CONFIG.CRIT_MULT_BASE;
  return base + ((p && p.hookAgg ? p.hookAgg.critMult : 0) || 0);
}

// The six conditional GRANTS resolve before the roll and do not consume it: an
// item promising "every 10th hit crits" must deliver on the 10th hit whether or
// not the dice agreed. Order matters only in that a guarantee should not burn a
// one-shot flag the roll would have covered — `firstHitCrit` and `critAfterKill`
// are one-shot, so they are tested first and spent when they fire.
export function rollCrit(sim, p, e) {
  const agg = p && p.hookAgg;
  if (!agg) return false;
  let crit = false;
  if (p.nextCrit) { p.nextCrit = false; crit = true; }                  // Slipstream
  else if (agg.firstHitCrit && !p.firstHitUsed) crit = true;
  else if (agg.critAfterKill && p.critArmed) { p.critArmed = false; crit = true; }
  else if (agg.critEveryN > 0 && ++p.critCounter >= agg.critEveryN) { p.critCounter = 0; crit = true; }
  else if (agg.critVsChilled && e.slowT > 0) crit = true;
  else if (agg.critVsBurning && e.burnT > 0) crit = true;
  else if (agg.critVsFullHp && e.hp >= e.maxHp) crit = true;
  // SEEDED STREAM, not `sim.rng` — see the note where `critRng` is built.
  else crit = sim.critRng.float() * 100 < critChance(p);
  p.firstHitUsed = true;
  return crit;
}

export function skillDamage(sim, e, amount, p, skill) {
  let amt = amount * bestDomainMult(p, skill.domain, e.domain) * ferocityMult(p);
  if (e.defDownT > 0) amt /= e.defDownMult;         // defense down = takes more
  amt *= eliteBossMult(p, e);                       // §9.2 magnitude, item-granted
  // Crit multiplies LAST, on top of every other term, so "×2 on a crit" means
  // twice the hit the player would otherwise have landed.
  const crit = rollCrit(sim, p, e);
  if (crit) amt *= critMultOf(p);
  const before = e.hp;
  sim.damageEnemy(e, amt, { owner: p, crit });
  const dealt = before - e.hp;
  p.damageDealt += Math.max(0, dealt);
  // §9.2 RIDER TIER — "adds an effect the skill did not have". This is the one
  // path every composed impact takes, which is the same reason Ferocity works
  // here and nowhere else: no primitive has to know a rider exists.
  //
  // ONLY IMPACTS, NEVER TICKS. Zones, burn and plague damage through
  // `_areaDamageEnemies` and direct HP subtraction, not through this function —
  // so a 15%-chance proc rolls on hits and not sixty times a second inside a
  // hazard. That is a property of the call graph, and `item_gate` measures it
  // rather than trusting it.
  if (dealt > 0) applyOnHitRiders(sim, p, skill, e);
  // `critHeal` is a healing SOURCE, so it goes through `_heal` and Recovery
  // amplifies it like every other. It was the seventh hook blocked on this
  // ruling and the one whose name hid the dependency: it grants no crit, it
  // only fires on one.
  if (crit && p.hookAgg && p.hookAgg.critHeal) sim._heal(p, p.hookAgg.critHeal);
  return Math.max(0, dealt);
}

// §9.2 magnitude: bonus damage to elites and bosses. Read here rather than in
// `_hitEnemy`, where it lived and where nothing has called it since weapons were
// removed (D-25).
// §9.2 DOMAIN SWAP, implemented as a domain ADD. The tier is named "swap" in
// the table and the section's governing rule is "an item may add, never take
// away", so the two have to be reconciled: this resolves the triangle as the
// BEST of the skill's own domain and any the player's items grant. A crowd
// build that finds a spiritual grant gains the matchup it lacked and keeps
// every matchup it had.
//
// RULED, not assumed. §9.2's table now reads "domain add" rather than "domain
// swap": the governing rule — an item may add, never take away — wins over the
// label the tier was drafted with. A literal replacement would let one shop roll
// invert a build's whole triangle position, which is the failure that deleted
// trigger-swap items from the design.
export function bestDomainMult(p, atk, def) {
  let best = domainMult(atk, def);
  // THE WIZARD'S SHIFT (§8.3), written by the `shift` primitive. It is the
  // player's own state rather than an item aggregate, and it composes with the
  // item grants the same way: best of everything available, never worse than
  // the skill's own domain. A shift that could make a matchup WORSE would let a
  // mistimed cast punish a build, and §9.2's governing rule — add, never take
  // away — is the right shape here too even though this arrives from a skill.
  if (p && p.domainShift) best = Math.max(best, domainMult(p.domainShift, def));
  const adds = p && p.hookAgg ? p.hookAgg.domainAdd : null;
  if (adds && adds.length) for (const d of adds) best = Math.max(best, domainMult(d, def));
  return best;
}

export function eliteBossMult(p, e) {
  if (!p || !p.hookAgg || !p.hookAgg.eliteBossDamage) return 1;
  if (!(e.elite || e.boss)) return 1;
  return 1 + p.hookAgg.eliteBossDamage / 100;
}

// The rider tier, applied where damage actually lands.
//
// A MINION'S HIT PROCS ITS OWNER'S RIDERS, and that is deliberate: §13 rule 23
// makes `hookAgg` the owner's field by reference on the actor facade, so a
// skeleton carrying its summoner's burn is the same statement as a skeleton's
// kill being its summoner's kill. Attribution never has to be forwarded because
// it never diverged.
export function applyOnHitRiders(sim, p, skill, e) {
  const agg = p && p.hookAgg;
  if (!agg || !e.active) return;
  for (const b of agg.burnOnHit) {
    if (sim.rng.float() < b.chance) sim._applyBurn(e, sim._attuned(p, b.dps), b.duration, p);
  }
  for (const s of agg.chillOnHit) {
    if (sim.rng.float() < s.chance) applySlow(sim, e, s.mult, s.duration, p);
  }
  for (const c of agg.chainOnHit) {
    if (sim.rng.float() >= c.chance) continue;
    const near = sim._nearestEnemyExcept(e.x, e.y, c.range, e);
    if (!near) continue;
    sim.fx.beams.push({ x1: e.x, y1: e.y, x2: near.x, y2: near.y, color: '#4fd8eb' });
    // The chain damages DIRECTLY, not through skillDamage — a chain that
    // re-entered the rider path would chain off its own chain, and three items
    // stacked would recurse until the pool emptied.
    sim.damageEnemy(near, Math.max(1, Math.round(sim._attuned(p, c.damage))), { owner: p });
  }
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
    // §9.2 magnitude: PIERCE IS AN ITEM, NOT A SKILL PROPERTY. No skill in the
    // game declares a `pierce` rider, so this term is the whole of it — §5.9
    // names pierce as the answer to escorted targets and puts it deliberately
    // in the shop rather than in a tree, so buying it is a build decision with
    // a cost. It was read only in `_fireWeapon` until D-25.
    pierce: (r.pierce || 0) + ((p.hookAgg && p.hookAgg.extraPierce) || 0), hitIds: new Set(),
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

// ATTUNEMENT — status potency (§9.5). This is the function every composed
// skill calls, and it applied nothing: `_applySlow` in game.js took an owner
// and amplified, `applySlow` here took none and did not. Two functions one
// character apart, one silently dropping the stat, and that single fork is
// most of why Attunement measured dead.
//
// A deeper slow AND a longer one, matching _applySlow so the two paths cannot
// drift again. The clamp at 0.15 keeps a chill from becoming a stun.
export function statusMult(p) {
  return 1 + ((p && p.stats ? p.stats.attunement : 0) + (p && p.hookAgg ? p.hookAgg.statusBoost : 0)) / 100;
}

export function applySlow(sim, e, mult, dur, owner = null) {
  const att = statusMult(owner);
  const m = Math.max(0.15, 1 - (1 - mult) * att);
  e.slowT = Math.max(e.slowT || 0, dur * Math.max(0.25, att));
  e.slowMult = Math.min(e.slowMult || 1, m);
}

// Plague STACKS rather than refreshing — that is what makes Internal Collapse a
// payoff for a tree that already applies dots, and it is marked EXACT in the
// spec for a reason.
export function applyPlague(sim, e, damage, dur, p, skill) {
  // Attunement rides the magnitude at APPLICATION, so the stored dps already
  // carries it and the tick loop stays a plain subtraction. Ferocity does not:
  // a dot is a status, and §9.5 gives status potency to Attunement.
  const amt = damage * statusMult(p);
  e.plagueT = Math.max(e.plagueT || 0, dur);
  e.plagueDps = (e.plagueDps || 0) + amt / Math.max(0.1, dur);
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
    // The judgment mark expires on the same block every other rider-applied
    // status does. One line in an existing loop rather than a decay function of
    // its own, which is what keeps the Priest content-shaped from here on.
    if (e.markT > 0) e.markT -= dt;
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
