// ENEMY TELEGRAPHS — committed attacks with a queryable danger zone.
//
// This exists so a positional dodge is a thing that can happen. Phase 1 bound
// ON_DODGE to the Reflex stat roll because there was nothing else to bind to,
// which made Rebuke reward a stat instead of movement and left gate criterion 5
// — the Footing hold-or-break decision — unanswerable. A player holding stance
// against invisible damage is not making a decision.
//
//   IDLE -> WINDUP -> RESOLVE -> RECOVER -> IDLE
//
// THE COMMIT IS BINDING. The zone is computed once, at the start of WINDUP, and
// never updates. The enemy does not track you through the wind-up. That is the
// whole mechanism: a committed attack is a promise about a piece of ground, and
// stepping off that ground is a skill rather than a stat. An enemy that reaims
// during wind-up produces an undodgeable attack and defeats the patch.

import { inZone } from './compose.js';
import { domainMult } from './domains.js';
// ALL_ENEMY_DEFS, not ENEMIES: region populations are registered in the same
// table and must be covered by the same assertions. Reading the base twelve
// here would have let a region enemy ship with a 200ms wind-up unchecked.
import { ALL_ENEMY_DEFS } from './content/enemies.js';

// Below this a wind-up is not something a person can react to on a phone, with
// a thumb, on a small screen. Asserted at load rather than trusted.
export const TELEGRAPH_MIN_WINDUP_MS = 350;

export const TELEGRAPH_STATES = { IDLE: 0, WINDUP: 1, RESOLVE: 2, RECOVER: 3 };

const SHAPE_PARAMS = {
  circle: ['radius'],
  cone: ['angle', 'range'],
  line: ['width', 'length'],
};

// ---------------------------------------------------------------- assertions

export function assertTelegraphs() {
  const problems = [];
  for (const def of ALL_ENEMY_DEFS) {
    const t = def.telegraph;
    if (!t) continue;
    if (!(t.windupMs >= TELEGRAPH_MIN_WINDUP_MS)) {
      problems.push(`${def.id}: windupMs ${t.windupMs} is below TELEGRAPH_MIN_WINDUP_MS (${TELEGRAPH_MIN_WINDUP_MS}) — not dodgeable`);
    }
    if (!(t.recoverMs >= 0)) problems.push(`${def.id}: recoverMs ${t.recoverMs} is not a duration`);
    // Declared explicitly either way. A telegraph that leaves it undefined is
    // one where nobody decided, and the punish window is too load-bearing for
    // that — it is the entire payoff for having dodged.
    if (typeof t.recoverFrozen !== 'boolean') problems.push(`${def.id}: recoverFrozen must be declared true or false — it is the punish window, not a default`);
    if (!(t.cooldownMs > 0)) problems.push(`${def.id}: telegraph needs a cooldownMs or it fires every tick it can`);
    if (!(t.retryFrac > 0 && t.retryFrac <= 1)) problems.push(`${def.id}: retryFrac ${t.retryFrac} must be in (0,1] — it is how soon a balked commit tries again`);
    if (!t.shape || !SHAPE_PARAMS[t.shape.kind]) {
      problems.push(`${def.id}: shape ${JSON.stringify(t.shape && t.shape.kind)} is not one of ${Object.keys(SHAPE_PARAMS).join('/')}`);
    } else {
      for (const k of SHAPE_PARAMS[t.shape.kind]) {
        // a missing param reads as undefined, the zone contains nothing, and
        // the attack silently never lands — the same "wired to nothing" shape
        // the skill assertions exist for
        if (!(t.shape[k] > 0)) problems.push(`${def.id}: ${t.shape.kind} needs param "${k}" > 0`);
      }
    }
    if (!(t.damage > 0)) problems.push(`${def.id}: telegraphed attack with no damage`);
    if (!t.domain) problems.push(`${def.id}: telegraphed attack with no domain — it would bypass the triangle`);
  }
  if (problems.length) {
    throw new Error(`telegraph definitions failed ${problems.length} load assertion(s):\n  - ${problems.join('\n  - ')}`);
  }
}

assertTelegraphs();

export const TELEGRAPHED_IDS = ALL_ENEMY_DEFS.filter(e => e.telegraph).map(e => e.id);

// ---------------------------------------------------------------- the zone

// Built once, at commit. `angle0` is frozen here and nothing reads the enemy's
// facing again — which is what makes the zone a promise rather than a guess.
function buildZone(sim, e, t) {
  const target = sim.tauntTarget(e.x, e.y);
  const angle0 = target ? Math.atan2(target.y - e.y, target.x - e.x) : (e.aimA || 0);
  const z = { kind: t.shape.kind, x: e.x, y: e.y, angle0, domain: t.domain, enemyId: e.id };
  if (t.shape.kind === 'circle') z.radius = t.shape.radius;
  if (t.shape.kind === 'cone') { z.angle = t.shape.angle * Math.PI / 180; z.range = t.shape.range; }
  if (t.shape.kind === 'line') { z.width = t.shape.width; z.length = t.shape.length; }
  return z;
}

// ---------------------------------------------------------------- the machine

// THE SIEGE BOSS HAS NO `def`. _spawnSiegeBoss builds its enemy slot with
// `def: null` and a `bossDef` instead, so every `e.def.telegraph` in this file
// is a null dereference the moment a siege boss exists — which is every siege
// on every floor. It reached the branch because the legacy sim suite was
// hanging before it got to the siege runs, so the only evidence was a shorter
// partial run. This helper is now the single place that answers the question,
// and nothing below reads e.def directly.
function telegraphOf(e) {
  return (e && e.def && e.def.telegraph) || null;
}

// `sim` is required, not optional: the initial cooldown scatter is a seeded
// roll like every other, and defaulting it to Math.random() when a caller
// forgets is how KNOWN-DEFECTS #1 stayed alive across four patches.
export function initTelegraph(sim, e) {
  const t = telegraphOf(e);
  e.telState = TELEGRAPH_STATES.IDLE;
  e.telT = 0;
  e.telZone = null;
  e.telCd = (t ? t.cooldownMs / 1000 : 0) * sim.rng.float();
  e.telCaught = null;
}

// True while the enemy is committed — the caller skips its behaviour, so it
// neither moves nor reaims.
//
// WINDUP is not negotiable: an enemy that moves or reaims mid-wind-up produces
// an undodgeable attack and the patch is pointless.
//
// RECOVER is a DELIBERATE DESIGN CHOICE and is now a dial rather than a side
// effect of this function. Freezing after the swing is the punish window — it
// is what a player who dodged gets in exchange for breaking stance, and without
// it dodging buys distance and nothing else. It shipped as an accident of
// lumping both states together; `recoverFrozen: true` in the enemy's telegraph
// block makes it a decision somebody has to actively reverse rather than a bug
// somebody tidies away.
export function telegraphBusy(e) {
  const t = telegraphOf(e);
  if (!t) return false;   // bosses (def: null) and every non-telegraphing type
  if (e.telState === TELEGRAPH_STATES.WINDUP) return true;
  if (e.telState === TELEGRAPH_STATES.RECOVER) return !!t.recoverFrozen;
  return false;
}

// A stun landing during WINDUP cancels the attack outright: no damage, straight
// to RECOVER. This is what makes Rebuke a counter-attack LOOP rather than a
// one-off payout — break stance, dodge, stun, and the next wind-up dies too.
export function cancelTelegraph(sim, e) {
  // Guarded for two reasons at once: the boss has no def at all, and enemy
  // slots are POOLED, so a recycled slot can still carry telState from whatever
  // occupied it last. The caller is a stun rider that lands on ANY enemy and
  // has no way to know whether that enemy telegraphs.
  const t = telegraphOf(e);
  if (!t) return false;
  if (e.telState !== TELEGRAPH_STATES.WINDUP) return false;
  e.telState = TELEGRAPH_STATES.RECOVER;
  e.telT = (t.recoverMs / 1000);
  e.telZone = null;
  e.telCaught = null;
  sim.telStats.interrupted++;
  return true;
}

export function tickTelegraphs(sim, dt) {
  for (const e of sim.enemyPool) {
    if (!e.active) continue;
    const t = telegraphOf(e);
    if (!t) continue;
    if (e.telState === undefined) initTelegraph(sim, e);

    // a stun at any point during the wind-up kills the attack
    if (e.stunT > 0 && e.telState === TELEGRAPH_STATES.WINDUP) { cancelTelegraph(sim, e); continue; }

    switch (e.telState) {
      case TELEGRAPH_STATES.IDLE: {
        if (e.stunT > 0) break;
        e.telCd -= dt;
        if (e.telCd > 0) break;
        // only commit when there is someone to commit AT, and only when they
        // are close enough that the attack is about them rather than ambient
        const target = sim.tauntTarget(e.x, e.y);
        if (!target) break;
        const zone = buildZone(sim, e, t);
        // WHO IS INSIDE AT COMMIT. The dodge check compares this set against
        // who is inside at RESOLVE — being outside the whole time is not a
        // dodge, and neither is being inside the whole time.
        const caught = new Set();
        for (const p of sim.livePlayers()) {
          if (p.downed) continue;
          if (inZone(zone, p.x, p.y, p.radius)) caught.add(p.idx);
        }
        // AN ENEMY DOES NOT WIND UP A SLAM AT NOBODY. The first version gated
        // the commit on "a target within reach + commitSlack", which let it
        // commit while the target was already outside the zone it was about to
        // build: 14 commits and 14 resolves in a 90s fight produced ZERO dodges,
        // because nobody was ever caught to begin with and there was nothing to
        // escape. The zone has to contain someone at commit or the whole
        // dodge/hit distinction is meaningless.
        if (!caught.size) { e.telCd = t.cooldownMs / 1000 * t.retryFrac; break; }
        e.telState = TELEGRAPH_STATES.WINDUP;
        e.telT = t.windupMs / 1000;
        e.telZone = zone;
        e.telCaught = caught;
        sim.telStats.committed++;
        break;
      }

      case TELEGRAPH_STATES.WINDUP: {
        // Note what is NOT here: no position update, no reaim. The enemy may be
        // knocked back — the knockback code moves e.x — but e.telZone is a
        // separate object and stays exactly where it was committed.
        e.telT -= dt;
        if (e.telT > 0) break;
        e.telState = TELEGRAPH_STATES.RESOLVE;
        break;
      }

      case TELEGRAPH_STATES.RESOLVE: {
        resolveTelegraph(sim, e, t);
        e.telState = TELEGRAPH_STATES.RECOVER;
        e.telT = t.recoverMs / 1000;
        e.telZone = null;
        e.telCaught = null;
        break;
      }

      case TELEGRAPH_STATES.RECOVER: {
        e.telT -= dt;
        if (e.telT > 0) break;
        e.telState = TELEGRAPH_STATES.IDLE;
        e.telCd = t.cooldownMs / 1000;
        break;
      }
    }
  }
}

// One tick. Damage lands on whoever is inside the committed zone NOW; anyone
// who was inside at commit and is outside now has dodged.
function resolveTelegraph(sim, e, t) {
  const z = e.telZone;
  if (!z) return;
  sim.telStats.resolved++;
  sim.fx.telResolve.push({ x: Math.round(z.x), y: Math.round(z.y), kind: z.kind, domain: z.domain });
  for (const p of sim.livePlayers()) {
    if (p.downed) continue;
    const inside = inZone(z, p.x, p.y, p.radius);
    const wasCaught = e.telCaught && e.telCaught.has(p.idx);
    if (inside) {
      // routed through the triangle like every other damage source
      sim.hurtPlayer(p, t.damage * domainMult(z.domain, null), e, { telegraph: true });
      sim.telDodgeLog.push({ p: p.idx, e: e.id, kind: z.kind, dodged: false, wasCaught: !!wasCaught, t: sim.time });
    } else if (wasCaught) {
      // INSIDE at commit, OUTSIDE at resolve. That is the whole rule: it is
      // positional, it required moving, and no stat can produce it.
      sim.telStats.dodged++;
      sim.onTelegraphDodge(p, e);
      sim.telDodgeLog.push({ p: p.idx, e: e.id, kind: z.kind, dodged: true, wasCaught: true, t: sim.time });
    }
  }
  if (sim.telDodgeLog.length > 10) sim.telDodgeLog.splice(0, sim.telDodgeLog.length - 10);
}

// Every live committed zone, for rendering and for the debug overlay.
export function liveZones(sim) {
  const out = [];
  for (const e of sim.enemyPool) {
    // Guarded: enemy slots are POOLED, so a recycled slot can still carry
    // telState from whatever occupied it last, and the boss has no def at all.
    // The state machine resets it on spawn now; this is the second line.
    const t = telegraphOf(e);
    if (!e.active || e.telState !== TELEGRAPH_STATES.WINDUP || !e.telZone || !t) continue;
    out.push({ z: e.telZone, fill: 1 - e.telT / (t.windupMs / 1000), msLeft: Math.round(e.telT * 1000), id: e.id });
  }
  return out;
}
