// SKILL-ERA SUMMONS — the minion engine, and the soul-token pool.
//
// THE QUESTION THIS FILE EXISTS TO ANSWER. Summons were the largest bespoke
// category in the source project: every summon carried its own spawn code, its
// own attack code and its own death code, and adding one meant editing the
// engine. The composed-action schema reached 40 skills with zero bespoke
// handlers WITHOUT summons in the set, so summons are the case that decides
// whether the schema generalises or merely survived an easy sample.
//
// The answer here is that a minion is an ACTOR, not a behaviour. It borrows the
// same ten primitives a player uses — a skeleton's cleave IS `strike`, a
// wolf's lunge IS `strike`, a wisp's bolt IS `bolt` — through the same
// PRIMITIVES table, with the minion standing in for the player. So a new
// archetype is a row of data, and this file does not grow.
//
// WHAT IS DELIBERATELY NOT HERE: no switch on skill id, no switch on archetype
// name, and no per-summon attack code. If any of those three ever appear, the
// schema did not hold and that is the finding, not a thing to work around.
//
// This is separate from the weapon-era `sim.summons` (drones, mirrors, rams,
// the Hunter's beast), which is phase-4 economy territory and untouched. Two
// systems is the correct number while one of them is scheduled for deletion.

import { CONFIG } from './config.js';
import { PRIMITIVES, rankedDuration } from './compose.js';
import { clamp, dist2 } from './util.js';

const MS = 1000;                  // structural: step params are milliseconds

// HOW A MINION MOVES. A declared taxonomy, exactly like TRIGGER_KINDS and
// SELECT_KINDS — enumerable, asserted at load, and closed. A new archetype
// picks one of these; it does not bring its own.
//
//   chase  — walks down the nearest enemy. The pack animal and the skeleton.
//   orbit  — circles its owner at a fixed radius. The wisp and the hawk.
//
// A THIRD KIND, `guard` (hold the ground you were summoned on), was written and
// then removed before this shipped, because no skill in either tree uses one.
// An enum entry wired to nothing is the exact defect this project keeps
// finding — the source project shipped nineteen of them — and "a totem will
// want it later" is how all nineteen got in. sim_test asserts every kind here
// is claimed by a real skill, so the next one has to arrive with its user.
export const MOVE_KINDS = ['chase', 'orbit'];

// ---------------------------------------------------------------- per-player

export function initMinionPlayer(p) {
  p.minions = [];                     // live AND downed — see totalAnimals()
  p.summonSlots = 0;                  // granted by rankGrants: 'summonSlots'
  // REFUSALS ARE SPLIT BY CAUSE, because one number could not tell "the player
  // has no room for this" from "the player already has one of these", and those
  // want opposite responses. The first is a build constraint worth surfacing;
  // the second is a summon skill idling on cooldown next to the animal it
  // already called, which is normal operation. Lumped together, a healthy Druid
  // read as 15 refusals in 60 seconds.
  p.minionStats = { spawned: 0, expired: 0, died: 0, revived: 0, noSlot: 0, dupArchetype: 0, atCap: 0 };
  // Revive durations, one row per death, each stamped with the pack size that
  // produced it. §13.2: this is read by sim_test's revive-cost table — an
  // instrument with no consumer is not an instrument.
  p.reviveLog = [];
}

// ---------------------------------------------------------------- slots
//
// THE ONLY PLACE IN THE GAME WHERE A RANK BUYS SOMETHING OTHER THAN DAMAGE OR
// DURATION. Guarded by the RANK_GRANTS registry in js/skills.js, which asserts
// at load that exactly one skill claims `summonSlots` and that no second skill
// can quietly join it.
//
// The guard exists because the unstated version of this rule already breached a
// hard cap once: Set Stance declared a rankable `footingMaxBonus`, nothing
// asserted that a passive may not raise an engine's cap, and a designed ten
// Footing stacks measured as seventeen — inflating every per-stack term with
// it. A rank that buys a STRUCTURAL quantity has to be declared and unique, or
// the next one arrives the same silent way.
// CAPACITY IS RANK, AND NOTHING ELSE (§8.5). No base allowance and no ceiling:
// a rank-20 Raise Skeleton means twenty skeletons, each one still earned by a
// kill. Deliberately uncapped for first playtest.
//
// The earlier version added CONFIG.SUMMON_SLOTS_BASE and clamped to a cap of 8.
// Both are gone. The base existed to give the Druid somewhere to put an animal,
// which §8.5 solves differently — a Druid's pack size is how many animal skills
// it took, so its animals are not slotted at all — and the cap silently
// contradicted "no cap beyond rank" at exactly the ranks a summoner build is
// aiming for.
export function summonSlotsFor(p, skillRanks, SKILL_BY_ID) {
  let n = 0;
  for (const [id, rank] of Object.entries(skillRanks || {})) {
    const sk = SKILL_BY_ID[id];
    if (!sk || sk.rankGrants !== 'summonSlots') continue;
    n += (sk.rankGrantPer || 0) * rank;
  }
  return Math.floor(n);
}

// Slotted minions occupy a slot whether they are standing or waiting to be
// revived. A downed animal is still YOURS — freeing its slot the moment it fell
// would let a player farm deaths for a bigger pack, which inverts the cost.
export function slotsFilled(p) {
  return p.minions.filter(m => m.slotted).length;
}

// The pack size the revive formula reads. OWNED, NOT ALIVE — see reviveSeconds.
export function totalAnimals(p) {
  return p.minions.filter(m => m.revives).length;
}

// THE REVIVE COST, AND THE ONE THING TO GET RIGHT IN THE DRUID.
//
// `total` is animals OWNED — alive plus downed — never animals alive.
//
// Counting the living inverts the cost curve exactly where it must not. With a
// full pack of four, one death would be measured against four and revive
// slowly; with the pack wiped, the last death would be measured against zero
// and revive FASTEST. The player is punished hardest and rewarded most by the
// same event. A Druid would learn to let the pack die.
//
// Owned-count makes the pack a commitment: a bigger pack is a better pack and a
// slower one to repair, and a wipe is the most expensive thing that can happen
// rather than the cheapest. sim_test asserts this directly by wiping a pack and
// reading the duration back — the failure mode is silent otherwise, because
// both versions produce a plausible number.
// §8.5: reviveMs = reviveBase + revivePerAnimal x (totalAnimals - 1). The
// FIRST animal costs the base alone; each one after it adds the step. A pack of
// one is 15 s, a pack of six is 35 s.
//
// The (total - 1) matters as much as the owned-not-alive rule above it: without
// it a solo Druid paid the per-animal term for a pack it does not have, and the
// curve started one step too high everywhere.
export function reviveSeconds(step, total) {
  return (step.reviveBase + step.revivePerAnimal * Math.max(0, total - 1)) / MS;
}

// INGENUITY — the summoner stat (§9.5): minion damage and minion HP. It was
// read only by `_summonStats`, the weapon-era structure path, in a game that
// then had no skill-era summons; the class that gained summons was ignoring the
// summon stat. Same per-point rate the weapon era used, so the number means the
// same thing it always did.
const ING_PER_POINT = 0.1;
export function ingenuityMult(p) {
  return Math.max(0.2, 1 + (p && p.stats ? Math.max(-8, p.stats.ingenuity) : 0) * ING_PER_POINT);
}

// §9.2 magnitude, the summoner's half: `summonBoost` items. Ingenuity is the
// STAT that scales a minion and this is the ITEM that does, and they are kept
// as separate terms rather than folded together so a report can say which one
// moved. Both were read only by `_summonStats` — the weapon-era structure path
// — so an item promising stronger summons did nothing for a skill-era summon
// (D-25).
export function summonDmgMult(p) { return 1 + ((p && p.hookAgg ? p.hookAgg.summonDmg : 0) || 0) / 100; }
export function summonHpMult(p) { return 1 + ((p && p.hookAgg ? p.hookAgg.summonHp : 0) || 0) / 100; }

// ---------------------------------------------------------------- the actor
//
// A minion presented in the shape the primitives read. Identity fields (idx,
// stats, hookAgg, char) are the OWNER'S BY REFERENCE, so a skeleton's kill is
// the necromancer's kill, its lifesteal heals the necromancer, and the damage
// ledger attributes to the necromancer — without one line of special-casing in
// damageEnemy or skillDamage. Only the spatial fields are the minion's own.
//
// Built once at spawn and mutated in place: one object per minion, not one per
// swing, because this runs inside the attack loop.
function makeActor(sim, m) {
  const p = sim.players[m.ownerIdx];
  const a = {
    minion: m,
    // Read by stepDamage(). A getter rather than a snapshot so a mid-fight
    // Ingenuity change reaches a minion already standing, the same way the
    // owner's stats do.
    get ingMult() { return ingenuityMult(p); },
    // The item term, beside the stat term rather than inside it (§9.2).
    get summonMult() { return summonDmgMult(p); },
    x: m.x, y: m.y, radius: m.radius, color: m.color, aimA: 0,
    idx: p.idx, stats: p.stats, hookAgg: p.hookAgg, char: p.char,
    engines: p.engines, engineScaleBonus: p.engineScaleBonus,
    // `curses` and the healing accumulator are identity too (§13 rule 23), and
    // they were missing until a summoner bought a lifesteal item: the minion
    // hit something, the hit healed the OWNER through `_heal`, and `_heal` read
    // `p.curses` off a facade that had none. The facade is an ALLOWLIST, so
    // every owner field a new engine path touches has to arrive here — which is
    // the standing cost of the pattern and worth paying, because the
    // alternative is a minion with its own copy of the owner's state.
    curses: p.curses, downed: false, gone: false,
    get healAcc() { return p.healAcc; }, set healAcc(v) { p.healAcc = v; },
    get roomVitGain() { return p.roomVitGain; }, set roomVitGain(v) { p.roomVitGain = v; },
    // The engine writes these through the actor during a swing; they must land
    // on the owner, not on a copy that is discarded when the swing ends.
    get hp() { return p.hp; }, set hp(v) { p.hp = v; },
    get damageDealt() { return p.damageDealt; }, set damageDealt(v) { p.damageDealt = v; },
    get shield() { return p.shield; }, set shield(v) { p.shield = v; },
    get ward() { return p.ward; }, set ward(v) { p.ward = v; },
  };
  // KILL CREDIT AND THE CRIT STREAM ARE THE OWNER'S TOO (D-30). A minion's swing
  // runs `skillDamage`, which rolls a crit and can kill — and both of those
  // paths write COUNTERS back onto whatever object dealt the blow, which is this
  // facade. None of these fields were on the allowlist, so `killer.kills++` was
  // NaN written to an object discarded at the end of the swing: every kill a
  // summon made went uncredited, `critEveryN` never advanced behind a pet, and
  // `firstHitCrit` re-armed on every single swing. All of it silent — `frenzy`
  // is the one that is an ARRAY, so `.length` on absent threw and the family got
  // found. Forwarded rather than copied: the counter has to land on the owner.
  for (const k of ['kills', 'lastKillT', 'roomFirstKillT', 'vitKillGained', 'frenzy',
                   'nextCrit', 'firstHitUsed', 'critCounter', 'critArmed', 'critMult']) {
    Object.defineProperty(a, k, {
      enumerable: true,
      get: () => p[k],
      set: v => { p[k] = v; },
    });
  }
  return a;
}

// ---------------------------------------------------------------- spawning

// Returns how many were actually spawned. A refusal is counted, never silent:
// "the skill fired and nothing appeared" is the exact shape of a wired-to-
// nothing bug, so a full slot bar has to be visible in the instrument.
// A thrown summon in flight. It carries the payload rather than damage: on
// landing it plants the minion at the point it reached, which is what makes the
// soul token a PLACE (§8.5). Its ttl is the flight time to the claimed spot, so
// "where it lands" is the token's position and not an arbitrary range limit.
export function spawnSummonSeed(sim, p, skill, step, rank, at) {
  const pr = sim.projPool.alloc();
  if (!pr) return false;
  const dx = at.x - p.x, dy = at.y - p.y;
  const dist = Math.hypot(dx, dy) || 1;
  const speed = step.deliver.speed;
  Object.assign(pr, {
    id: ++sim.spawnCounter, x: p.x, y: p.y,
    vx: dx / dist * speed, vy: dy / dist * speed,
    dmg: 0, crit: false, friendly: true, lob: false,
    ttl: dist / speed, radius: step.deliver.radius, color: p.color, owner: p.idx,
    pierce: 0, hitIds: new Set(),
    weaponId: null, kind: 'summonSeed', summonBurn: null, summonKnock: 0, fromSummon: false,
    // The payload. The projectile tick plants this and knows nothing else
    // about it — no archetype name reaches that code.
    seed: { skillId: skill.id, step, rank, ranks: skill.ranks, domain: skill.domain },
    skill: null,
  });
  return true;
}

// Called by the projectile tick when a seed reaches its spot.
export function plantSeed(sim, pr) {
  const p = sim.players[pr.owner];
  if (!p || p.gone || !pr.seed) return;
  const { step, rank, skillId, ranks, domain } = pr.seed;
  // Rebuilt rather than looked up: js/skills.js imports MOVE_KINDS from this
  // file, so importing it back would be circular. The seed carries the two
  // fields a minion's attack actually needs — its rank block and its domain —
  // which is also what keeps a stale registry from changing a skeleton already
  // in flight.
  spawnMinions(sim, p, { id: skillId, ranks, domain }, step, rank, { x: pr.x, y: pr.y });
}

export function spawnMinions(sim, p, skill, step, rank, origin = null) {
  const count = step.count || 1;
  let made = 0;
  for (let i = 0; i < count; i++) {
    if (step.slotted && slotsFilled(p) >= p.summonSlots) { p.minionStats.noSlot++; continue; }
    if (p.minions.length >= CONFIG.MINION_CAP_PER_PLAYER) { p.minionStats.atCap++; continue; }
    // PER-ARCHETYPE CEILING. Without it the cheapest-triggering summon takes
    // every slot: the first armed Druid fielded three wolves and never once a
    // bear or a hawk, because Call Wolf fires on a lower bar and got there
    // first. A pack tree that can only ever field its tier-2 animal is not the
    // tree. Declared per step, so a skeleton — whose rank BUYS more of itself —
    // simply omits it.
    if (step.maxAlive && p.minions.filter(m => m.arch === step.archetype).length >= step.maxAlive) {
      p.minionStats.dupArchetype++; continue;
    }
    const ang = sim.rng.float() * Math.PI * 2;
    const m = {
      id: ++sim.spawnCounter,
      ownerIdx: p.idx,
      arch: step.archetype,
      move: step.move,
      // The owning skill's identity travels with the minion so its attack runs
      // as that skill: same domain for the damage triangle, same rank block, so
      // a point spent on the summon raises what the summon hits for.
      skillId: skill.id, rank, ranks: skill.ranks, domain: skill.domain,
      // A delivered summon rises exactly where its seed landed; an ordinary
      // one scatters around its caster.
      x: clamp((origin ? origin.x : p.x + Math.cos(ang) * step.spawnRadius), CONFIG.WALL + step.radius, sim.W - CONFIG.WALL - step.radius),
      y: clamp((origin ? origin.y : p.y + Math.sin(ang) * step.spawnRadius), CONFIG.WALL + step.radius, sim.H - CONFIG.WALL - step.radius),
      radius: step.radius, color: p.color,
      // MINION HP IS THE DURATION TERM (§9.5). §4.2 says a rank raises damage
      // and duration; for an actor with a body those are its attack and how
      // long it survives, so a rank buys both. Raising HP as a flat constant
      // instead moved the number and not the shape — a rank-11 wolf still died
      // as fast as a rank-1 one, which is what made depth strictly worse than
      // breadth for the Druid. Ingenuity multiplies the same term.
      hp: rankedDuration(step.hp, skill, rank) * ingenuityMult(p) * summonHpMult(p),
      maxHp: rankedDuration(step.hp, skill, rank) * ingenuityMult(p) * summonHpMult(p),
      ttl: step.duration ? step.duration / MS : 0,     // 0 = permanent
      slotted: !!step.slotted,
      revives: !!step.revives,
      down: false, downT: 0,
      attack: step.attack, attackCd: step.attackCd / MS, cd: 0,
      orbitA: ang, orbitR: step.orbitRadius || step.spawnRadius,
      reviveBase: step.reviveBase || 0, revivePerAnimal: step.revivePerAnimal || 0,
      contactCd: 0,
    };
    m.actor = makeActor(sim, m);
    // The skill object the primitives see when this minion swings. Built once,
    // not per swing. `select` comes off the attack step because it is the
    // MINION'S targeting rule, not the summoner's — the summoner picked where
    // to put it, the minion picks what to bite.
    m.skillView = {
      id: skill.id, domain: skill.domain, select: step.attack.select,
      compose: [step.attack], trigger: { range: step.attack.reach || step.attack.range || step.attack.length || 0 },
      ranks: skill.ranks,
    };
    p.minions.push(m);
    p.minionStats.spawned++;
    made++;
  }
  return made;
}

// ---------------------------------------------------------------- room reset
//
// §8.5 rows 5 and 7. Called from the room-start restore, which is where the
// section puts it ("alongside the room-start HP restore in §10").
//
// The two engines part company here, and it is the sharpest expression of why
// they are opposite:
//
//   Skeletons WIPE. They do not persist, so a Necromancer's count never
//   compounds across a map and every fight ramps from zero. That is what makes
//   the cold start a real cost rather than a one-off.
//
//   Animals PERSIST and are RESTORED — standing again, at full HP, with any
//   revive timer cancelled. A Druid arrives with the pack it paid points for.
//   Re-summoning them per room would make breadth free.
//
// The test is a ROOM TRANSITION, never a timer: a wipe that happened to look
// right because a duration expired would pass a timer-based check and fail a
// player walking through a door.
export function resetMinionsForRoom(sim, p) {
  if (!p.minions) return;
  // Anything that does not revive is disposable and does not survive the room.
  const wiped = p.minions.filter(m => !m.revives).length;
  p.minions = p.minions.filter(m => m.revives);
  p.minionStats.roomWiped = (p.minionStats.roomWiped || 0) + wiped;
  for (const m of p.minions) {
    m.down = false; m.downT = 0; m.downDur = 0;
    m.hp = m.maxHp;
    m.x = p.x; m.y = p.y;
    m.cd = 0; m.contactCd = 0;
    if (m.actor) { m.actor.x = m.x; m.actor.y = m.y; }
  }
  p.minionStats.roomRestored = (p.minionStats.roomRestored || 0) + p.minions.length;
}

// ---------------------------------------------------------------- the tick

export function tickMinions(sim, dt) {
  for (const p of sim.players) {
    if (p.gone) continue;
    for (let i = p.minions.length - 1; i >= 0; i--) {
      const m = p.minions[i];

      // A downed animal is not a corpse — it is a slot with a timer on it.
      if (m.down) {
        if ((m.downT -= dt) <= 0) {
          m.down = false;
          m.hp = m.maxHp;
          m.x = p.x; m.y = p.y;
          p.minionStats.revived++;
        }
        continue;
      }

      // Temporary summons expire. Permanent ones (ttl 0) never do.
      if (m.ttl > 0 && (m.ttl -= dt) <= 0) {
        p.minions.splice(i, 1);
        p.minionStats.expired++;
        continue;
      }

      if (m.contactCd > 0) m.contactCd -= dt;
      moveMinion(sim, p, m, dt);
      attackMinion(sim, p, m, dt);
      contactDamage(sim, p, m, i);
    }
    // Published for engineScale(): a Druid capstone can `scaleWith: 'pack'`
    // through exactly the hook Footing and armour already use. Counting the
    // STANDING pack here is right — this scales output, not cost.
    p.engines.pack = p.minions.filter(x => !x.down).length;
  }
}

function moveMinion(sim, p, m, dt) {
  const spd = CONFIG.MINION_SPEED;
  if (m.move === 'orbit') {
    m.orbitA += dt * CONFIG.MINION_ORBIT_RATE;
    const tx = p.x + Math.cos(m.orbitA) * m.orbitR, ty = p.y + Math.sin(m.orbitA) * m.orbitR;
    m.x += (tx - m.x) * Math.min(1, dt * CONFIG.MINION_ORBIT_LERP);
    m.y += (ty - m.y) * Math.min(1, dt * CONFIG.MINION_ORBIT_LERP);
  } else if (m.move === 'chase') {
    const e = sim.trigGrid.nearest(m.x, m.y, CONFIG.MINION_AGGRO_RANGE);
    // Nothing to chase: heel, so a pack does not strand itself across the room.
    const tx = e ? e.x : p.x, ty = e ? e.y : p.y;
    const d = Math.hypot(tx - m.x, ty - m.y) || 1;
    const stop = e ? m.radius + e.radius : CONFIG.MINION_HEEL_RANGE;
    if (d > stop) { m.x += (tx - m.x) / d * spd * dt; m.y += (ty - m.y) / d * spd * dt; }
  }
  // Every kind still obeys the room.
  m.x = clamp(m.x, CONFIG.WALL + m.radius, sim.W - CONFIG.WALL - m.radius);
  m.y = clamp(m.y, CONFIG.WALL + m.radius, sim.H - CONFIG.WALL - m.radius);
  m.actor.x = m.x; m.actor.y = m.y;
}

// THE WHOLE REASON THERE IS NO BESPOKE SUMMON CODE. A minion's attack is a
// compose step, run through the same PRIMITIVES table a player's skill uses,
// with the minion as the actor. `strike`, `bolt`, `cone` — all of them work
// here for free, and so will any primitive added later.
function attackMinion(sim, p, m, dt) {
  if (!m.attack) return;
  if ((m.cd -= dt) > 0) return;
  const reach = m.attack.reach || m.attack.range || m.attack.length || 0;
  const target = sim.trigGrid.nearest(m.x, m.y, reach);
  if (!target) return;
  m.cd = m.attackCd;
  m.actor.aimA = Math.atan2(target.y - m.y, target.x - m.x);
  const prim = PRIMITIVES[m.attack.kind];
  if (!prim) return;              // load assertions reject unknown kinds
  prim(sim, m.actor, m.skillView, m.attack, m.rank, sim.trigGrid, { hits: 0, damage: 0, statuses: 0, states: 0 });
}

function contactDamage(sim, p, m, i) {
  if (m.contactCd > 0) return;
  for (const e of sim.enemyPool) {
    if (!e.active) continue;
    if (dist2(e.x, e.y, m.x, m.y) >= (e.radius + m.radius) * (e.radius + m.radius)) continue;
    m.contactCd = CONFIG.MINION_CONTACT_CD;
    m.hp -= e.dmg;
    if (m.hp <= 0) { killMinion(sim, p, m, i); }
    return;
  }
}

// HEALING A LIVE MINION — the one thing nothing in the game could do.
//
// Minion HP was written in exactly three places before this, all of them
// structural: full at spawn, full at revive, zero at death. No primitive
// touched it — `heal` iterates `sim.livePlayers()`, `drain` heals the caster,
// `plague` writes the enemy — so a pack could be worn down and there was no
// answer in the vocabulary. That is §5.7 condition 1, demonstrated rather than
// asserted, and it is what admits the `mend` rider.
//
// It lives here rather than in compose.js because a minion's fields belong to
// this module; compose asks for an effect and does not reach into the pack.
// Returns HP actually restored, so the rider can report a real number and a
// gate can measure one — overhealing a full pack returns 0 and says so.
export function healMinions(p, amount) {
  if (!(amount > 0)) return 0;
  let healed = 0;
  for (const m of p.minions || []) {
    if (m.dead || !(m.hp > 0) || !(m.maxHp > 0)) continue;
    const before = m.hp;
    m.hp = Math.min(m.maxHp, m.hp + amount);
    healed += m.hp - before;
  }
  return healed;
}

export function killMinion(sim, p, m, i) {
  sim.fx.deaths.push({ x: Math.round(m.x), y: Math.round(m.y), c: m.color, r: m.radius });
  p.minionStats.died++;
  if (!m.revives) { p.minions.splice(i, 1); return; }
  // It stays in the array — which is what makes totalAnimals() count it, and
  // what keeps its slot occupied while it is down.
  m.down = true;
  m.downT = reviveSeconds(m, totalAnimals(p));
  // The duration it was SENTENCED to, kept so the renderer can show a fraction
  // that actually reaches 1. Recomputing it at render time from the current
  // pack would give a fraction that jumps whenever another animal falls.
  m.downDur = m.downT;
  m.hp = 0;
  p.reviveLog.push({ pack: totalAnimals(p), seconds: m.downT, t: sim.time });
}

// ---------------------------------------------------------------- soul tokens
//
// A world resource, NOT a Necromancer field. Any enemy death can leave one and
// any skill may read one through the ON_TOKEN trigger — which is why it lives
// in the trigger taxonomy rather than in a class. The Wizard's Soul tree (§8.2)
// reads the same pool with no code added here, and that is the test of whether
// it was put in the right place.

export function initTokens(sim) {
  sim.tokens = [];
  sim.tokenStats = { dropped: 0, expired: 0, claimed: 0 };
}

// EVERY enemy death leaves one, with no roll and no cap (§8.5). The
// Necromancer's cost is the cold start, not scarcity: a room begins with no
// tokens because nothing has died in it yet, so a build with capacity and no
// offence fills none of its slots.
export function dropToken(sim, x, y) {
  sim.tokens.push({ id: ++sim.spawnCounter, x, y, ttl: CONFIG.SOUL_TOKEN_TTL });
  sim.tokenStats.dropped++;
  return true;
}

export function tickTokens(sim, dt) {
  for (let i = sim.tokens.length - 1; i >= 0; i--) {
    if ((sim.tokens[i].ttl -= dt) <= 0) { sim.tokens.splice(i, 1); sim.tokenStats.expired++; }
  }
}

export function tokenWithin(sim, x, y, range) {
  const r2 = range * range;
  for (const t of sim.tokens) if (dist2(t.x, t.y, x, y) <= r2) return true;
  return false;
}

// Consumed when the skill that read it fires — the same shape as ON_KILL and
// ON_HIT_TAKEN, whose events are cleared by the tick that saw them.
//
// RETURNS THE POSITION, NOT A BOOLEAN. §8.5 makes the token a PLACE: Raise
// Skeleton throws at the token and the skeleton rises where it lands, so the
// spot the token occupied is the whole payload. A boolean would reduce it back
// to a counter, which is the thing the section is deliberately not.
export function claimToken(sim, x, y, range) {
  const r2 = range * range;
  let bi = -1, bd = Infinity;
  for (let i = 0; i < sim.tokens.length; i++) {
    const d = dist2(sim.tokens[i].x, sim.tokens[i].y, x, y);
    if (d <= r2 && d < bd) { bd = d; bi = i; }
  }
  if (bi < 0) return null;
  const t = sim.tokens[bi];
  sim.tokens.splice(bi, 1);
  sim.tokenStats.claimed++;
  return { x: t.x, y: t.y };
}
