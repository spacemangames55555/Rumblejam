// THE SIM SIDE OF SKILLS — trigger tick, engines, statuses, progression.
//
// Kept out of game.js so the gate is removable: if auto-triggered combat does
// not feel as good as the shooter, this module and its two content files are
// what get deleted, and js/game.js goes back to calling _tickWeapons.
//
// Everything here runs on the HOST. Clients receive fire events in the fx
// stream and render them; they never evaluate a trigger.

import { EnemyGrid, triggerHolds, triggerConsume, triggerOrigin, TRIGGER_TICK_MS, MAX_TRIGGER_EVALS_PER_TICK } from './triggers.js';
import { selectTarget } from './selectors.js';
import { runCompose, applyBoltRiders, applyImpactRiders, rankedDamage, stepDamage } from './compose.js';
import { SKILL_BY_ID, TREES, TREES_BY_CLASS, isDamaging, slotsAtLevel, skillRank, canLearn, rankCooldown } from './skills.js';
import { mechanicalLine } from './skilltext.js';
import { initMinionPlayer, summonSlotsFor, tickMinions, resetMinionsForRoom, spawnMinions } from './minions.js';
import { domainMult } from './domains.js';
import { CONFIG } from './config.js';
import { tohHitDamage, tohOnHit } from './traits-toh.js';
import { passiveBonusPer } from './enginescale.js';
import { ENGINE_TICKS, engineStats, footingShieldFor, resetEnginesForRoom, initEnginePlayer, gainChi, spendChi, chiCostOf, cascadeAdvance, cascadeCooldown, formHolds } from './engines.js';

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
  p.engines = { footing: 0, armor: 0, pack: 0, shift: 0, marks: 0, rhythm: 0, crystal: 0, doll: 0, drench: 0, killbox: 0, spread: 0, chi: 0, cascade: 0, form: 0 };
  p.engineScaleBonus = { footing: 0, armor: 0, pack: 0, shift: 0, marks: 0, rhythm: 0, crystal: 0, doll: 0, drench: 0, killbox: 0, spread: 0, chi: 0, cascade: 0, form: 0 };   // passives that raise a stack's worth
  initMinionPlayer(p);
  // Every registered accumulator's own fields, in the module that owns them.
  initEnginePlayer(p);
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

// A CHANNEL TICK IS AN IMPACT, so it carries the impact riders — a target and a
// moment is the whole test, and a tick has both. Forwarded from here rather
// than imported into game.js directly, because the arrow runs one way:
// game.js -> skillsim.js -> compose.js, and game.js owns the facade
// (`skillDamage` is the same shape one file over).
//
// Note for authors: a channel re-applies its riders on EVERY tick. A `stun`
// on a 400ms cadence is a permanent stun, which is legal and is almost never
// what the block meant. `slow`, `weakenDamage`, `mark` and `impactDot` are the
// ones that read as intended under repetition.
export function channelTickRiders(sim, p, skill, riders, e, rank, angle) {
  applyImpactRiders(sim, p, skill, riders, e, rank, angle, { hits: 0, damage: 0, statuses: 0, states: 0, pulled: 0 });
}
export { slotsAtLevel };

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
  p.domainShift = null; p.domainShifts = 0;
  // AND NEITHER DOES CRYSTAL. Same reason and the same shape: the Mage's engine
  // ramps inside a room and is banked by nothing across the door, which is what
  // lets it avoid a decay tick of its own. Damage taken in the last fight is not
  // credit in the next one.
  p.crystal = 0;
  // AND NEITHER DO TRAPS. A killbox is set for the room it is set in; carrying
  // one through a door would let an Assassin walk into every fight with a field
  // already prepared, which is the decision the class is built on handed out for
  // free. Cleared here for the same reason the shift and the crystal are.
  sim.traps = sim.traps.filter(t => t.owner !== p.idx);
  // AND NEITHER DOES CHI. Same rule, now applied through the registry rather
  // than by another hand-written line here — an accumulator that needs a door
  // reset declares it in engines.js, so the fourth one costs nothing here.
  resetEnginesForRoom(p);
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
    // ALWAYS-ON AURAS, AND THE SECOND DOOR ONTO THE SAME MECHANISM.
    //
    // An always-on aura has no cast, and none of the eleven TRIGGER_KINDS is
    // "always" — every one of them is reactive. So it cannot arrive through the
    // trigger loop, and it does not need to: it is a property of OWNING the
    // node, which is what a passive already is. Registered here, at the one
    // function the sim runs per player per door, beside the persistent summons
    // that are restored for exactly the same reason.
    //
    // The FIELD does not fork — `sim.addAura` is the same call the `aura`
    // primitive makes for a cast. Only the door differs, which is the shape
    // `gravityPull` already has (a primitive and a trait calling one mover).
    if (sk.type === 'passive' && sk.passive && sk.passive.aura) {
      const a = sk.passive.aura;
      if (!sim.auraFor(p, id)) {
        sim.addAura(p, {
          key: id, domain: sk.domain,
          // Radius is the rankable term, and for these nodes it is the ONLY
          // one — "+12px radius per rank (not damage, not magnitude)".
          radius: a.radius + (a.radiusPerRank || 0) * (rank - 1),
          // `damage` + `pulseMs` is the pulsed form and the one an always-on
          // DAMAGING aura must use; `dps` remains for a field that is
          // continuous because it does no damage at all.
          damage: a.damage || 0, pulseMs: a.pulseMs || 400,
          dps: a.dps || 0, ampPct: a.ampPct || 0, slow: a.slow || null,
          dur: Infinity,
        });
      }
    }
  }
}

// §5.6, THE OPENING ABILITY. The tier-1 nodes of this character's own trees,
// filtered by the same `canLearn` predicate every other spend uses — so this is
// the real choice set rather than a second opinion about one. Every tree's
// tier-1 node is asserted at load to be a damaging active, which is what makes
// this list safe to offer and safe to fall back on.
export function openingPicks(p) {
  return treesFor(p)
    .map(t => TREES[t].skills.find(s => s.tier === 1))
    .filter(s => s && canLearn(p, s))
    .map(s => ({ id: s.id, name: s.name, mech: mechanicalLine(s, 1), flavor: s.flavor || '', tree: TREES[s.tree].name, domain: s.domain }));
}

// Whether anything in the loadout can actually kill something. The same question
// `setLoadout`'s anti-softlock floor asks, asked from outside.
export function hasDamagingSlotted(p) {
  return (p.loadout || []).some(id => id && isDamaging(SKILL_BY_ID[id]));
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
  // THE §5.6 OFFER IS SERVED BY ANY SPEND, not only by clicking its card. The
  // skill screen can spend the same point, and the map refuses to travel while
  // an offer is outstanding — so an offer left standing after the point was
  // spent elsewhere is a player stuck on the map screen with nothing to answer.
  p.openingOffer = null;
  sim._recomputeStats(p);
  p.metaDirty = true;         // the build changed; the skill screen reads it off meta
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
  p.metaDirty = true;
  return { ok: true };
}

// ANSWER THE §5.6 CARD THE WAY A PLAYER DOES — for harnesses.
//
// The anti-softlock floor is loud on purpose: if it fires, a real player was
// offered an opening ability and never got to answer it, which is a defect.
// That signal is worthless if fixtures trip it constantly, and they do — a
// harness that constructs a character, travels into an arena and only THEN
// spends its points arrives unprovisioned for exactly one frame, which is all
// the floor needs. §13 rule 17: a fixture arriving unprovisioned is the
// fixture's bug, and the fix is to provision it rather than to quieten the
// alarm. Call this before travelling.
export function answerOpening(sim, p) {
  if (!p || !p.openingOffer || !p.openingOffer.length) return false;
  sim.uiAction(p.idx, { kind: 'opening', id: p.openingOffer[0].id });
  return true;
}

export function grantSkillPoint(sim, p) {
  p.skillPoints++;
  p.metaDirty = true;
  sim.pushEvent({ k: 'skillPoint', idx: p.idx, points: p.skillPoints });
}

// ---------------------------------------------------------------- the engines

// The accumulators live in `js/engines.js` and register themselves in a table
// there; this module iterates the table and knows no class by name. See that
// file's header for why — and note that `passiveSum` is handed IN rather than
// imported, because engines.js must not import this module back.
// A passive's contribution, summed over its ranks. Passives are always on and
// never slotted, so this reads ranks directly.
export function passiveSum(p, key) {
  let n = 0;
  for (const [id, rank] of Object.entries(p.skillRanks || {})) {
    const sk = SKILL_BY_ID[id];
    if (!sk || sk.type !== 'passive' || !sk.passive || sk.passive[key] === undefined) continue;
    // Not every passive value is a number any more: `aura` is a record, and
    // summing it would hand every caller NaN rather than failing where the
    // mistake is. Scaling weights are numbers; a structural grant is not.
    if (typeof sk.passive[key] !== 'number') continue;
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
  // Every registered engine's stat contribution, plus the two flat passives that
  // land in the same place. Marrow's Calcify is a passive rather than an engine
  // but belongs here so the two compose rather than racing.
  const out = engineStats(p, passiveSum);
  const grit = passiveSum(p, 'armorGrit'), vit = passiveSum(p, 'armorVit');
  if (grit) out.grit = (out.grit || 0) + grit;
  if (vit) out.vitality = (out.vitality || 0) + vit;
  for (const k in out) if (out[k]) return out;
  return null;
}

export { footingShieldFor };

// ---------------------------------------------------------------- the tick

export function tickSkills(sim, dt) {
  for (const p of sim.players) {
    if (p.gone) continue;
    // publish the engines other trees read
    p.engines.armor = Math.max(0, p.stats.grit);
  // SUMMON-STAT PASSIVES, STASHED FOR js/minions.js. That module cannot import
  // this one — the arrow runs minions -> compose and game owns the facade — so
  // the totals are written onto the player instead, beside the engines, and
  // `summonDmgMult`/`summonHpMult` add them to the item aggregate they already
  // read. Five Necromancer passives depend on it.
  p.summonPassive = { dmg: passiveSum(p, 'summonDmg'), hp: passiveSum(p, 'summonHp') };
    // THE WIZARD'S SHIFT ENGINE (§8.3): attunements banked this room, written by
    // the `shift` primitive and reset at every door. One publish line, beside
    // armor's, which is what "content-shaped" was supposed to mean.
    p.engines.shift = p.domainShifts || 0;
    // THE PRIEST'S MARK ENGINE: how many enemies are currently carrying THIS
    // player's judgment. A count of standing debt rather than a rate — a Priest
    // who has marked the room is at their strongest in the moment before it
    // breaks, and killing the marks spends the power along with the heal.
    let marked = 0;
    // THE SUNDIAN'S DRENCH ENGINE (§8.3), counted in the same sweep as the
    // Priest's marks because it is the same question asked of a different field:
    // how much of THIS player's status is standing in the room. Marks count
    // ENEMIES; drench counts STACKS, because a Sundian who has soaked one enemy
    // four times has four times the payout waiting, and a counter that measured
    // bodies would price that the same as four enemies at one stack each.
    let drenched = 0;
    for (const e of sim.enemyPool) {
      if (!e.active) continue;
      if (e.markT > 0 && e.markBy === p.idx) marked++;
      if (e.drenchT > 0 && e.drenchBy === p.idx) drenched += e.drench || 0;
    }
    p.engines.marks = marked;
    p.engines.drench = drenched;
    // THE ASSASSIN'S KILLBOX ENGINE (§8.3): traps currently set. A count of
    // POTENTIAL rather than of debt or of damage taken — the Assassin is
    // strongest standing in a field it prepared, and every detonation spends
    // part of that field.
    p.engines.killbox = sim.traps.reduce((a, t) => a + (t.owner === p.idx ? 1 : 0), 0);
    // THE HUNTER'S SPREAD ENGINE (§8.3): how far apart the two bodies are, in
    // bands. Every other engine measures a quantity — time, casts, stacks,
    // objects, damage. This one measures a RELATIONSHIP between two things the
    // player owns, which is the only reading of "two bodies" that is about both
    // of them. A Hunter standing on its beast has no engine at all.
    let spread = 0;
    for (const m of p.minions) {
      if (m.dead || m.down) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      spread = Math.max(spread, Math.min(CONFIG.SPREAD_CAP, Math.floor(d / CONFIG.SPREAD_UNIT)));
    }
    p.engines.spread = spread;
    // THE BARD'S RHYTHM ENGINE (§8.3): stacks held right now. Unlike every other
    // engine here this one can be DROPPED — `tohOnFire` builds it on each cast
    // and `tohTick` wipes the whole stack the moment the window lapses. Both
    // halves were already live, so the Bard is the cheapest engine in the game:
    // this line and nothing else.
    p.engines.rhythm = p.rhythm || 0;
    // THE MAGE'S CRYSTAL ENGINE (§8.3): crystal accumulated from damage TAKEN,
    // written in `tohOnHurt` off the amount that actually got through. The only
    // engine in the game the enemy fills — every other one is paid for in the
    // player's own initiative.
    p.engines.crystal = p.crystal || 0;
    // THE WITCH DOCTOR'S DOLL ENGINE (§8.3): the debt banked in the bound enemy,
    // as capped stacks. `p.voodooDmg` is written by `voodooMirror`, which has
    // been live since the trait era; the only thing this patch added was the
    // DESIGNATION that decides which enemy it goes into.
    //
    // AND THIS IS THE ONE ENGINE YOU CAN DESTROY BY WINNING. Every point in it
    // arrived as damage to the doll, so the class is always killing the thing it
    // is loading — and `tickVoodoo` zeroes the bank on rebind. Marks pay out on
    // death; the doll pays out by STAYING ALIVE.
    const dt_ = p.char.trait;
    p.engines.doll = dt_.key === 'voodoo_link' && p.voodooId !== null
      ? Math.min(dt_.dollCap, (p.voodooDmg || 0) * dt_.dollPer) : 0;
    // WEIGHTS, NOT PER-POINT NUMBERS. A passive that raises what an engine
    // point is worth had exactly the units problem `scalePer` had — the same
    // 0.010 was +45% on chi and +1% on form, and the Monk's Empty Hand was
    // retuned by hand for precisely that before the cause was named. The
    // declaration is now a dimensionless multiple of the engine's standard
    // contribution and `passiveBonusPer` converts it; the old
    // `<engine>DamageBonus` field is rejected at load so a per-point value
    // cannot be carried across under a name that still reads.
    p.engineScaleBonus.footing = passiveBonusPer('footing', passiveSum(p, 'footingScaleWeight'));
    // `armor` was the one engine initialised in engineScaleBonus and never
    // assigned — a declared-with-no-writer field of exactly the shape this
    // codebase keeps finding. samurai_agility is the first content to need it.
    p.engineScaleBonus.armor = passiveBonusPer('armor', passiveSum(p, 'armorScaleWeight'));
    p.engineScaleBonus.pack = passiveBonusPer('pack', passiveSum(p, 'packScaleWeight'));
    p.engineScaleBonus.shift = passiveBonusPer('shift', passiveSum(p, 'shiftScaleWeight'));
    p.engineScaleBonus.marks = passiveBonusPer('marks', passiveSum(p, 'marksScaleWeight'));
    p.engineScaleBonus.rhythm = passiveBonusPer('rhythm', passiveSum(p, 'rhythmScaleWeight'));
    p.engineScaleBonus.crystal = passiveBonusPer('crystal', passiveSum(p, 'crystalScaleWeight'));
    p.engineScaleBonus.drench = passiveBonusPer('drench', passiveSum(p, 'drenchScaleWeight'));
    p.engineScaleBonus.killbox = passiveBonusPer('killbox', passiveSum(p, 'killboxScaleWeight'));
    p.engineScaleBonus.spread = passiveBonusPer('spread', passiveSum(p, 'spreadScaleWeight'));
    p.engineScaleBonus.doll = passiveBonusPer('doll', passiveSum(p, 'dollScaleWeight'));
    p.engineScaleBonus.chi = passiveBonusPer('chi', passiveSum(p, 'chiScaleWeight'));
    p.engineScaleBonus.cascade = passiveBonusPer('cascade', passiveSum(p, 'cascadeScaleWeight'));
    p.engineScaleBonus.form = passiveBonusPer('form', passiveSum(p, 'formScaleWeight'));
    // Slots are recomputed from ranks every tick rather than incremented on
    // spend, so respecs, save loads and rank rollbacks cannot leave a player
    // holding slots no skill still pays for.
    p.summonSlots = summonSlotsFor(p, p.skillRanks, SKILL_BY_ID);
    p.movingT = p.moving ? (p.movingT || 0) + dt : 0;
    // EVERY REGISTERED ACCUMULATOR, gated by the tree that pays for it. This
    // was one hardcoded `tickFooting(sim, p, dt)` call and a hardcoded content
    // import; §16 flagged it in phase 2 and the Monk is the second of four that
    // would have widened it.
    const trees = treesFor(p);
    for (const e of ENGINE_TICKS) if (trees.includes(e.tree)) e.tick(sim, p, dt, passiveSum);
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
      // AND THE CHI COST SECOND, for the same reason and in the same shape: a
      // skill that cannot pay costs one number comparison and does not fire.
      //
      // SPENDING IS CONDITIONAL, not automatic — the ruling is in §8.3. The
      // alternative was letting the spend go through and clamping at zero, which
      // makes a heal FREE exactly when the Monk is broke, or letting Chi go
      // negative, which invents a state no other engine has. Refusing is neither:
      // it is structurally the cooldown check, one line up, and it leaves the
      // cost the ruling actually wanted intact — a heal near a hurt ally still
      // fires on its own trigger and still takes the Chi with it.
      if (chiCostOf(sk) > p.chi) continue;
      // AND THE FORM THIRD, same place and same shape. A skill declaring
      // `form: 'pyrite'` fires only while that form holds — the skill stays
      // slotted and visible, and what the form changes is whether its condition
      // can hold. §5.5 forbids mid-fight loadout changes, so a form that swapped
      // slotted skills would be the trigger-swap item §9.2 deleted, pointed at
      // the player by their own class.
      if (!formHolds(p, sk)) continue;
      if (evals >= MAX_TRIGGER_EVALS_PER_TICK) { capped = true; break; }
      evals++;
      const st = (p.trigState[id] ||= { armed: true });
      if (!triggerHolds(sim, p, sk, st, sim.trigGrid)) continue;
      // Paid at the moment of firing, after the trigger holds — a skill whose
      // condition is not met has not spent anything.
      if (!spendChi(sim, p, chiCostOf(sk))) continue;
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
  // THE CASCADE ADVANCES BEFORE THE COOLDOWN IS WRITTEN, so the cast that
  // extends the chain is itself shortened by the extension. See engines.js for
  // why that ordering is the engine's built-in cost rather than a generosity.
  cascadeAdvance(sim, p, sk.id);
  // AND THIS IS THE ONLY PLACE IN THE GAME A COOLDOWN IS EVER SHORTENED. Items
  // may not (§9.2); RANKS NOW MAY, per skill and bounded, which is the §4.2
  // rewrite — see CONFIG.SKILL_RANK_CD_RATE for why that is safe where a global
  // fire-rate stat would not be. No other engine touches it. The
  // Savage is the single exemption and `cascadeCooldown` is a no-op for every
  // other class, which is what keeps the exemption from leaking.
  // Rank first, then the cascade: both are multiplicative so the order does not
  // change the product, but reading it this way says what it is — the skill's
  // own cooldown, then the Savage's exemption applied to it.
  p.skillCd[sk.id] = cascadeCooldown(p, { ...sk, cooldown: rankCooldown(sk.cooldown, rank) }) / 1000;
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
  // THE KILLBOX GOES OFF HERE, and here is the only place it could. §8.3 gives
  // the Assassin "traps placed inert, detonating when other skills fire nearby",
  // and "a skill fired" is this line — the same event the trait layer observes.
  // It is deliberately NOT a rider: a rider resolves on a target at the moment of
  // impact, and the skill that sets a trap off may be a heal, a shield, a ward or
  // a shift, none of which touches an enemy (§5.7 condition 2).
  //
  // A TRAP DOES NOT SET OFF ITS OWN PLACEMENT. `trap` steps are excluded, or an
  // Assassin laying a second trap inside a killbox would cash the first one on
  // the way down and never hold more than one.
  if (sim.traps.length && !(sk.compose || []).some(c => c.kind === 'trap')) detonateTraps(sim, p);

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

// A gate surface for the trigger layer. `triggerHolds` needs the spatial grid,
// which only the tick owns; this hands a probe the same question against the
// live grid so the two-bodies write path can be asserted without reproducing
// the tick. Exported for `engine_gate`, used nowhere in play.
export function triggerHoldsAt(sim, p, skill) {
  return triggerHolds(sim, p, skill, p.trigState[skill.id] || {}, sim.trigGrid);
}

// DETONATION IS A PROPERTY OF THE OBJECT, checked where casts are observed.
// Every trap this player owns within `TRAP_DETONATE_RANGE` of where they are
// standing goes off at once and is removed — the Assassin's decision is
// POSITIONAL and predictive: place the killbox where the fight will be, then
// fight there. Nothing about the triggering skill is read except that it
// happened, which is what keeps this out of the rider table.
export function detonateTraps(sim, p) {
  const R = CONFIG.TRAP_DETONATE_RANGE;
  let fired = 0;
  for (let i = sim.traps.length - 1; i >= 0; i--) {
    const t = sim.traps[i];
    if (t.owner !== p.idx) continue;
    const dx = t.x - p.x, dy = t.y - p.y;
    if (dx * dx + dy * dy > R * R) continue;
    sim.traps.splice(i, 1);
    fired++;
    // Routed through `skillSplash` so the damage takes the domain triangle,
    // Ferocity, crit and every item hook the rest of the game takes — a
    // detonation is a composed hit, not a special number.
    sim.skillSplash(p, t.skill, t.x, t.y, t.radius, t.damage, null);
    sim.fx.booms.push({ x: Math.round(t.x), y: Math.round(t.y), r: Math.round(t.radius) });
  }
  if (fired) sim.pushEvent({ k: 'sfx', s: 'boom' });
  return fired;
}

export function skillDamage(sim, e, amount, p, skill) {
  let amt = amount * bestDomainMult(p, skill.domain, e.domain) * ferocityMult(p);
  if (e.defDownT > 0) amt /= e.defDownMult;         // defense down = takes more
  // THE AURA AMP, and the one line in this chain that asks WHO is hitting.
  // Every other term here is a property of the attacker or of the target;
  // this one is a property of the PAIR. Osteo Aura reads "+25% damage from
  // you", so an enemy standing in a Necromancer's field takes more from that
  // Necromancer and nothing extra from anybody else's shot.
  //
  // `p.idx` is the owner's index even when `p` is the minion facade, which is
  // what makes a summoner's skeletons count as "you" — ruled, and the free
  // reading, because the facade was built to erase that distinction.
  if (e.ampT > 0 && e.ampBy === p.idx) amt *= 1 + e.ampPct;
  amt *= eliteBossMult(p, e);                       // §9.2 magnitude, item-granted
  // Crit multiplies LAST, on top of every other term, so "×2 on a crit" means
  // twice the hit the player would otherwise have landed.
  const crit = rollCrit(sim, p, e);
  if (crit) amt *= critMultOf(p);
  // THE TRAIT LAYER OBSERVES HITS, AND THIS IS WHAT A HIT IS NOW.
  //
  // `tohHitDamage` and `tohOnHit` were called from `_fireWeapon` and nothing
  // else — and `_fireWeapon` has not run since weapons were removed. Same
  // orphaning as `tohOnFire`, on the two sibling hooks, and it took FOUR traits
  // down with it across three classes:
  //
  //   voodoo_link   the mirror never fired — the Witch Doctor's entire engine
  //   three_stances Precision's bleed and crit, Flow's stacks, Iron's bank
  //                 payout: three of the Samurai's three stances, on a BUILT class
  //   blood_dance   the Savage's Heat and leech
  //   karma         the Monk's spirit echo, and the karma release
  //
  // plus the singularity VULNERABILITY, which is a property of the enemy and so
  // applies to every source including allies — the Mage's burst debuff was doing
  // nothing to anyone's skills.
  //
  // Ordering follows the weapon path exactly: `tohHitDamage` adjusts the number
  // before mitigation, `tohOnHit` observes after the hit resolved and BEFORE any
  // dead-enemy bail, because a killing blow is still a hit.
  amt = tohHitDamage(sim, p, e, amt);
  const before = e.hp;
  sim.damageEnemy(e, amt, { owner: p, crit });
  const dealt = before - e.hp;
  p.damageDealt += Math.max(0, dealt);
  // `ctx.mirrored` is absent here on purpose: this is an original hit, and the
  // mirror's own follow-up goes through `damageEnemy` rather than this function,
  // so the bounce cannot re-enter.
  tohOnHit(sim, p, e, dealt, { crit });
  // CHI IN. The Monk's engine is filled by damage the player's own skill landed,
  // which is this function and nowhere else — a minion's bite reaches here too
  // and that is correct, because the facade forwards the owner's identity and a
  // pet's hit is the Monk's hit (§13 rule 23). `gainChi` is a no-op for every
  // class that has not spent a point in the Chi tree, so this costs one array
  // lookup on the ten classes that are not the Monk.
  gainChi(sim, p, dealt);
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
    // The aura amp lapses here like the rest. Its field refreshes it every 400ms
    // while the enemy is inside, so an enemy that walks out stops being
    // amplified within a tick rather than carrying the bonus away with it.
    if (e.ampT > 0) e.ampT -= dt;
    // The judgment mark expires on the same block every other rider-applied
    // status does. One line in an existing loop rather than a decay function of
    // its own, which is what keeps the Priest content-shaped from here on.
    if (e.markT > 0) e.markT -= dt;
    // DRENCH IS A COUNTER WITH A CLOCK, and when the clock runs out the counter
    // goes with it. Decaying the timer while leaving the stacks would let a
    // Sundian bank drench across a whole room and cash it minutes later, which
    // is the unbounded-multiplier shape the cap exists to prevent.
    if (e.drenchT > 0) { e.drenchT -= dt; if (e.drenchT <= 0) { e.drench = 0; e.drenchBy = -1; } }
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
