// DRUID — Tapestry of Beasts. The pack tree.
//
// The Necromancer's summons are DISPOSABLE: a skeleton dies and you raise
// another. The Druid's are NOT — an animal that falls is revived, not replaced,
// and the pack is a standing commitment rather than a resource. That difference
// is the whole reason both classes ship in one patch: if the schema only fit
// disposable summons it would have fit half the category.
//
// THE ONE THING TO GET RIGHT IN THIS TREE is the revive cost, and it is a
// single word. `totalAnimals` in reviveSeconds() counts animals OWNED, not
// animals ALIVE. Counting the living inverts the cost exactly where it must
// not: a wiped pack would have zero alive and therefore the FASTEST revives,
// so the worst thing that can happen to a Druid would also be the cheapest to
// repair, and the correct play would be to let the pack die. Owned-count makes
// a bigger pack a slower one to rebuild and a wipe the most expensive event in
// the tree. sim_test asserts it by wiping a pack and reading the duration back,
// because both versions produce a plausible number and only one is right.
//
// Tier 1 is a direct attack for the same reason as the Necromancer's: §6.3 asks
// the opening pick to kill something now, and a summon defers that behind a
// spawn, a walk and an attack cooldown.

export const TUNING = {
  // tier 1 — Thorn Lash
  lashDamage: 8, lashReach: 92, lashArc: 1.5, lashCd: 1000,
  // HP IS THE RANK'S DURATION TERM (§9.5), so these are BASE values that a rank
  // raises. They were briefly inflated as a flat balance patch when a rank-11
  // wolf was dying as fast as a rank-1 one; that moved the number (0.53 to 0.84
  // animals standing) without moving the shape, because the missing thing was
  // the rank rule and not the constant. Reverted to the first guesses now that
  // rankedDuration scales them.
  // tier 2 — Call Wolf (the first animal)
  wolfHp: 34, wolfRadius: 11, wolfDamage: 7, wolfReach: 48, wolfArc: 1.5,
  wolfAtkCd: 950, wolfSpawnRadius: 48, wolfCd: 3000,
  wolfTrigRadius: 320, wolfTrigCount: 1,
  // THE REVIVE CURVE, from §8.5: 15000 + 4000 x (totalAnimals - 1), measured
  // against animals OWNED. One animal is 15 s; three is 23 s; six is 35 s.
  // Going wide has a price at the moment it matters.
  reviveBase: 15000, revivePerAnimal: 4000,
  // tier 3 — Bramble
  brambleDamage: 5, brambleRadius: 130, brambleDuration: 4500, brambleTickMs: 500,
  brambleSlowMult: 0.6, brambleSlowDur: 1400, brambleCd: 6500, brambleTrigCount: 3,
  // tier 4 — Pack Bond (passive)
  bondPerPack: 0.05,
  // tier 5 — Call Bear
  bearHp: 78, bearRadius: 15, bearDamage: 12, bearReach: 60, bearArc: 1.8,
  bearAtkCd: 1500, bearSpawnRadius: 56, bearCd: 7000, bearTaunt: 2200,
  bearTrigRadius: 240, bearTrigCount: 3,
  // tier 6 — Maul
  maulDamage: 15, maulReach: 100, maulArc: 1.7, maulCd: 4000, maulKnock: 220,
  // tier 7 — Rejuvenate
  rejuvAmount: 16, rejuvRadius: 260, rejuvCd: 9000, rejuvPct: 55,
  // tier 8 — Call Hawk
  hawkHp: 20, hawkRadius: 8, hawkDamage: 9, hawkSpeed: 520, hawkRange: 280,
  hawkAtkCd: 1000, hawkOrbit: 74, hawkCd: 6000, hawkTrigRange: 300,
  // tier 9 — Stampede
  stampedeDamage: 19, stampedeWidth: 66, stampedeLength: 340, stampedeCd: 8500,
  stampedeKnock: 300, stampedeRadius: 190, stampedeCount: 2,
  // tier 10 — Wild Synergy
  synergyDamage: 17, synergyAngle: 2.9, synergyRange: 215, synergyCd: 12000,
  synergyPerPack: 0.08, synergyTrigRadius: 200, synergyTrigCount: 4,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

// Every animal shares the revive curve. Spread into each summon step so the
// numbers still arrive as data on the step rather than being looked up by
// archetype name inside the engine.
//
// ANIMALS ARE NOT SLOTTED (§8.5). The Druid's pack size is how many animal
// skills it took — one wolf, one bear, one hawk — bounded by `maxAlive: 1` on
// each, not by a shared capacity pool. The pool existed only in the earlier
// implementation and is deleted; a Druid competing with a Necromancer for the
// same slots would have coupled two engines the design keeps opposite.
const REVIVES = { revives: true, reviveBase: T.reviveBase, revivePerAnimal: T.revivePerAnimal };

export const DRUID_BEASTS = [
  {
    id: 'druid_thorn_lash', tree: 'druid_beasts', tier: 1, name: 'Thorn Lash',
    desc: 'The undergrowth answers before anything with legs does.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.lashReach },
    cooldown: T.lashCd,
    compose: [{ kind: 'strike', damage: T.lashDamage, arc: T.lashArc, reach: T.lashReach, riders: {} }],
    ranks: R,
  },
  {
    id: 'druid_call_wolf', tree: 'druid_beasts', tier: 2, name: 'Call Wolf',
    desc: 'It was already nearby. It usually is.',
    type: 'active', domain: 'physical', prereq: 'druid_thorn_lash',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'PROXIMITY', radius: T.wolfTrigRadius, count: T.wolfTrigCount },
    cooldown: T.wolfCd,
    compose: [{
      kind: 'summon', archetype: 'wolf', maxAlive: 1, move: 'chase',
      count: 1, slotted: false, ...REVIVES,
      hp: T.wolfHp, radius: T.wolfRadius, spawnRadius: T.wolfSpawnRadius,
      duration: 0,
      attackCd: T.wolfAtkCd,
      attack: { kind: 'strike', damage: T.wolfDamage, arc: T.wolfArc, reach: T.wolfReach, select: 'nearest', riders: {} },
    }],
    ranks: R,
  },
  {
    id: 'druid_bramble', tree: 'druid_beasts', tier: 3, name: 'Bramble',
    desc: 'Ground that would rather they did not cross it.',
    type: 'active', domain: 'physical', prereq: 'druid_call_wolf',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.brambleRadius, count: T.brambleTrigCount },
    cooldown: T.brambleCd,
    compose: [{
      kind: 'hazard', damage: T.brambleDamage, radius: T.brambleRadius,
      duration: T.brambleDuration, tickMs: T.brambleTickMs,
      riders: { slow: { mult: T.brambleSlowMult, dur: T.brambleSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'druid_pack_bond', tree: 'druid_beasts', tier: 4, name: 'Pack Bond',
    desc: 'They hunt better because you are there, and so do you.',
    type: 'passive', domain: 'spiritual', prereq: 'druid_bramble',
    trigger: null, cooldown: 0, compose: [],
    // Raises what a pack member is WORTH without touching any step — the same
    // shape as Held Edge for Footing, keyed by engine name, no engine code.
    passive: { packDamageBonus: T.bondPerPack },
    ranks: R,
  },
  {
    id: 'druid_call_bear', tree: 'druid_beasts', tier: 5, name: 'Call Bear',
    desc: 'Slower to arrive. Considerably harder to remove.',
    type: 'active', domain: 'physical', prereq: 'druid_pack_bond',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'PROXIMITY', radius: T.bearTrigRadius, count: T.bearTrigCount },
    cooldown: T.bearCd,
    compose: [{
      kind: 'summon', archetype: 'bear', maxAlive: 1, move: 'chase',
      count: 1, slotted: false, ...REVIVES,
      hp: T.bearHp, radius: T.bearRadius, spawnRadius: T.bearSpawnRadius,
      duration: 0,
      attackCd: T.bearAtkCd,
      attack: { kind: 'strike', damage: T.bearDamage, arc: T.bearArc, reach: T.bearReach,
        select: 'densest_cluster', riders: { taunt: T.bearTaunt } },
    }],
    ranks: R,
  },
  {
    id: 'druid_maul', tree: 'druid_beasts', tier: 6, name: 'Maul',
    desc: 'You have picked up some of their habits.',
    type: 'active', domain: 'physical', prereq: 'druid_call_bear',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.maulReach },
    cooldown: T.maulCd,
    compose: [{
      kind: 'strike', damage: T.maulDamage, arc: T.maulArc, reach: T.maulReach,
      riders: { knockback: T.maulKnock },
    }],
    ranks: R,
  },
  {
    id: 'druid_rejuvenate', tree: 'druid_beasts', tier: 7, name: 'Rejuvenate',
    desc: 'Green comes back into things.',
    type: 'active', domain: 'spiritual', prereq: 'druid_maul',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.rejuvPct },
    cooldown: T.rejuvCd,
    compose: [{ kind: 'heal', amount: T.rejuvAmount, radius: T.rejuvRadius }],
    ranks: R,
  },
  {
    id: 'druid_call_hawk', tree: 'druid_beasts', tier: 8, name: 'Call Hawk',
    desc: 'It stays high and picks its moment.',
    type: 'active', domain: 'physical', prereq: 'druid_rejuvenate',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'NEAREST', range: T.hawkTrigRange },
    cooldown: T.hawkCd,
    compose: [{
      kind: 'summon', archetype: 'hawk', maxAlive: 1, move: 'orbit',
      count: 1, slotted: false, ...REVIVES,
      hp: T.hawkHp, radius: T.hawkRadius, spawnRadius: T.hawkOrbit, orbitRadius: T.hawkOrbit,
      duration: 0,
      attackCd: T.hawkAtkCd,
      attack: { kind: 'bolt', damage: T.hawkDamage, speed: T.hawkSpeed, range: T.hawkRange, select: 'farthest', riders: {} },
    }],
    ranks: R,
  },
  {
    id: 'druid_stampede', tree: 'druid_beasts', tier: 9, name: 'Stampede',
    desc: 'Everything with hooves, in one direction, at once.',
    type: 'active', domain: 'physical', prereq: 'druid_call_hawk',
    select: 'farthest',
    trigger: { kind: 'ISOLATED', radius: T.stampedeRadius, count: T.stampedeCount },
    cooldown: T.stampedeCd,
    compose: [{
      kind: 'line', damage: T.stampedeDamage, width: T.stampedeWidth, length: T.stampedeLength,
      riders: { knockback: T.stampedeKnock },
    }],
    ranks: R,
  },
  {
    id: 'druid_wild_synergy', tree: 'druid_beasts', tier: 10, name: 'Wild Synergy',
    desc: 'For a moment there is no telling where you stop.',
    type: 'active', domain: 'spiritual', prereq: 'druid_stampede',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.synergyTrigRadius, count: T.synergyTrigCount },
    cooldown: T.synergyCd,
    // Rides the standing pack through engineScale(), exactly as the
    // Necromancer's capstone does. Two classes reading the same engine hook
    // with no engine change between them is the point.
    compose: [{
      kind: 'cone', damage: T.synergyDamage, angle: T.synergyAngle, range: T.synergyRange,
      scaleWith: 'pack', scalePer: T.synergyPerPack, riders: {},
    }],
    ranks: R,
  },
];
