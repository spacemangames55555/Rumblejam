// HUNTER — Longshot tree.
//
// THE CLASS ENGINE, EXPRESSED AS CONTENT. §8.3 gives the Hunter "two bodies —
// skills may trigger off the pet's position", and the write path is `from:
// 'pet'` on the skill plus `p.engines.spread` (ruled and gated before this file
// existed). Nothing here is engine code: `from` is a declared field beside
// `select` and `domain`, and the resource is published in one line.
//
// IT IS THE FIRST WRITE PATH THAT TOUCHES THE TRIGGER LAYER. Every one before it
// wrote a resource — a domain, a mark, a counter, an object. This one changes
// WHERE A QUESTION IS ASKED: a `from: 'pet'` skill runs its trigger at the
// beast's position instead of the Hunter's. The compose steps still resolve from
// the Hunter, so the beast is a remote SENSOR and not a second caster — §13 rule
// 23 already rules that an entity which acts is an actor running compose steps,
// and the minion system is that.
//
// WHICH MAKES THE CLASS A FIRING SOLUTION RATHER THAN A POSITION. A `from: 'pet'`
// skill fires when the fight reaches the BEAST and lands wherever the HUNTER is
// standing, so the two placements have to be chosen together: send the beast
// into the crowd, stand where the crowd will be when the skill goes off. Get it
// wrong and the skill fires at nothing — which is the cost, and it is paid in
// the same currency the engine pays out in.
//
// AND THE ENGINE IS THE SPAN ITSELF. `p.engines.spread` is how far apart the two
// bodies are, in bands. Every other engine in the game measures a quantity —
// time stood still, casts made, stacks, objects, damage taken. This one measures
// a RELATIONSHIP between two things the player owns, which is the only reading
// of "two bodies" that is about both of them. A Hunter standing on its beast has
// no engine at all.
//
// THE BUILT-IN COST IS THE CLASS'S OWN TRAIT. Pack Tactics pays ALPHA for two
// beasts within 120 and MARKSMAN for no beast within 250. Spread agrees with
// Marksman and fights Alpha — so a Hunter deep in this tree has given up the
// Alpha bonus it would otherwise be holding, and Houndmaster is where that other
// half lives. The trait pays at both ends and nothing in between, which is what
// makes the §4.2 decision on this class a real one.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // tier 1 — Sighting Shot
  sightDamage: 5, sightSpeed: 540, sightRange: 260, sightCd: 1100,
  // tier 2 — Falconer (the beast: the engine's other body)
  falconHp: 26, falconRadius: 11, falconSpawn: 60, falconAtkCd: 1150,
  falconDamage: 4, falconArc: 1.5, falconReach: 46,
  falconReviveBase: 6, falconRevivePer: 1.5, falconCd: 4000,
  // tier 3 — Spotter's Call
  callDamage: 7, callSpeed: 530, callRange: 255, callCd: 2600, callWeight: 0.83,
  // tier 4 — Enfilade
  enfDamage: 9, enfWidth: 32, enfLength: 360, enfRadius: 200, enfCount: 2,
  enfCd: 3400, enfWeight: 0.92,
  // tier 5 — Long Leash (passive)
  leashWeight: 0.333,
  // tier 6 — Crossfire
  crossDamage: 10, crossSpeed: 545, crossRange: 265, crossTargets: 2,
  crossCd: 3800,
  // tier 7 — Driven Game
  drivenDamage: 10, drivenAngle: 1.9, drivenRange: 230, drivenRadius: 190,
  drivenCount: 3, drivenCd: 4400, drivenSlowMult: 0.74, drivenSlowDur: 1300,
  // tier 8 — Set and Hold
  holdAmount: 24, holdDuration: 4600, holdCd: 7200, holdWeight: 1.08,
  // tier 9 — Culling Shot
  cullDamage: 12, cullSpeed: 560, cullRange: 270, cullPct: 45, cullCd: 4800, cullWeight: 1.17,
  // tier 10 — Both Barrels
  bothDamage: 16, bothSpeed: 570, bothRange: 275, bothTargets: 3,
  bothCd: 9200, bothWeight: 1.33, bothStun: 600,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const HUN_LONGSHOT = [
  {
    id: 'hun_sighting_shot', tree: 'hun_longshot', tier: 1, name: 'Sighting Shot',
    desc: 'A ranging shot at the nearest thing. Deals 5 damage at 260 range.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.sightRange },
    cooldown: T.sightCd,
    compose: [{ kind: 'bolt', damage: T.sightDamage, speed: T.sightSpeed, range: T.sightRange, riders: {} }],
    ranks: R,
  },
  {
    // THE ENGINE, TIER 2 — and on this class the tier-2 node is the OTHER BODY
    // rather than a way of using it. Every previous engine could be banked from
    // nothing; two bodies needs a second body first, and a Hunter without one
    // has no engine and no `from: 'pet'` skill that can fire.
    //
    // `move: 'chase'` is the engine's own filler: a bird that chases is a bird
    // that leaves, and leaving is what the span measures.
    id: 'hun_falconer', tree: 'hun_longshot', tier: 2, name: 'Falconer',
    desc: 'Puts a bird up. It hunts on its own, and the further it ranges the harder you hit.',
    type: 'active', domain: 'physical', prereq: 'hun_sighting_shot',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'NEAREST', range: T.sightRange },
    cooldown: T.falconCd,
    compose: [{
      kind: 'summon', archetype: 'hawk', maxAlive: 1, move: 'chase',
      count: 1, slotted: false,
      revives: true, reviveBase: T.falconReviveBase, revivePerAnimal: T.falconRevivePer,
      hp: T.falconHp, radius: T.falconRadius, spawnRadius: T.falconSpawn,
      duration: 0,
      attackCd: T.falconAtkCd,
      attack: { kind: 'strike', damage: T.falconDamage, arc: T.falconArc, reach: T.falconReach, select: 'nearest', riders: {} },
    }],
    ranks: R,
  },
  {
    // THE FIRST `from: 'pet'` SKILL, and the tier where the class starts being
    // itself: it fires when something comes near the BIRD, and the shot leaves
    // the HUNTER. Two placements, one decision.
    id: 'hun_spotters_call', tree: 'hun_longshot', tier: 3, name: "Spotter's Call",
    desc: 'Fires when something closes on your beast, not on you. 7 damage, +5% per band between you.',
    type: 'active', domain: 'mental', prereq: 'hun_falconer',
    select: 'nearest', from: 'pet',
    trigger: { kind: 'NEAREST', range: T.callRange },
    cooldown: T.callCd,
    compose: [{
      kind: 'bolt', damage: T.callDamage, speed: T.callSpeed, range: T.callRange,
      scaleWith: 'spread', scaleWeight: T.callWeight, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'hun_enfilade', tree: 'hun_longshot', tier: 4, name: 'Enfilade',
    desc: 'A line down the lane between you. 9 damage, +5.5% per band between you.',
    type: 'active', domain: 'physical', prereq: 'hun_spotters_call',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.enfRadius, count: T.enfCount },
    cooldown: T.enfCd,
    compose: [{
      kind: 'line', damage: T.enfDamage, width: T.enfWidth, length: T.enfLength,
      scaleWith: 'spread', scaleWeight: T.enfWeight, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'hun_long_leash', tree: 'hun_longshot', tier: 5, name: 'Long Leash',
    desc: 'Every band of ground between you and your beast is worth 2% more to every skill that reads it.',
    type: 'passive', domain: 'mental', prereq: 'hun_enfilade',
    trigger: null, cooldown: 0, compose: [],
    passive: { spreadScaleWeight: T.leashWeight },
    // Classified 'damage' in PASSIVE_EFFECT, so it is an INVESTMENT and ranks —
    // the same shape as Held Edge, Sympathetic Resonance, Attend the Fallen,
    // Perfect Time, Lattice, Sympathetic Binding, Tidemark and Dead Ground.
    ranks: { damage: T.rankDamage },
  },
  {
    id: 'hun_crossfire', tree: 'hun_longshot', tier: 6, name: 'Crossfire',
    desc: 'Two shots when the crowd reaches your beast. 10 damage each, +6% per band between you.',
    type: 'active', domain: 'physical', prereq: 'hun_long_leash',
    select: 'nearest', from: 'pet',
    trigger: { kind: 'PROXIMITY', radius: T.enfRadius, count: T.enfCount },
    cooldown: T.crossCd,
    compose: [{
      kind: 'bolt', damage: T.crossDamage, speed: T.crossSpeed, range: T.crossRange,
      count: T.crossTargets, scaleWith: 'spread', riders: {},
    }],
    ranks: R,
  },
  {
    id: 'hun_driven_game', tree: 'hun_longshot', tier: 7, name: 'Driven Game',
    desc: 'A fan that drives them off your bird and onto your line. 10 damage, +6% per band, and they crawl at 74% for 1.3s.',
    type: 'active', domain: 'mental', prereq: 'hun_crossfire',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.drivenRadius, count: T.drivenCount },
    cooldown: T.drivenCd,
    compose: [{
      kind: 'cone', damage: T.drivenDamage, angle: T.drivenAngle, range: T.drivenRange,
      scaleWith: 'spread',
      riders: { slow: { mult: T.drivenSlowMult, dur: T.drivenSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'hun_set_and_hold', tree: 'hun_longshot', tier: 8, name: 'Set and Hold',
    desc: 'Absorbs 24 over 4.6s, +6.5% per band between you, below 50% health.',
    type: 'active', domain: 'spiritual', prereq: 'hun_driven_game',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 50 },
    cooldown: T.holdCd,
    compose: [{
      kind: 'shield', amount: T.holdAmount, duration: T.holdDuration,
      scaleWith: 'spread', scaleWeight: T.holdWeight,
    }],
    ranks: R,
  },
  {
    id: 'hun_culling_shot', tree: 'hun_longshot', tier: 9, name: 'Culling Shot',
    desc: 'Takes the hurt one your beast has found. 12 damage below 45% health, +7% per band between you.',
    type: 'active', domain: 'mental', prereq: 'hun_set_and_hold',
    select: 'lowest_hp', from: 'pet',
    trigger: { kind: 'TARGET_THRESHOLD', pct: T.cullPct, range: T.cullRange },
    cooldown: T.cullCd,
    compose: [{
      kind: 'bolt', damage: T.cullDamage, speed: T.cullSpeed, range: T.cullRange,
      scaleWith: 'spread', scaleWeight: T.cullWeight, riders: {},
    }],
    ranks: R,
  },
  {
    // The capstone is the class's thesis: it looks through the bird, shoots from
    // the Hunter, and is worth most when those are as far apart as they get.
    id: 'hun_both_barrels', tree: 'hun_longshot', tier: 10, name: 'Both Barrels',
    desc: 'Three shots down the whole span. 16 damage each, +8% per band between you, and what they hit is stunned for 0.6s.',
    type: 'active', domain: 'physical', prereq: 'hun_culling_shot',
    select: 'highest_hp', from: 'pet',
    trigger: { kind: 'PROXIMITY', radius: T.enfRadius, count: T.enfCount },
    cooldown: T.bothCd,
    compose: [{
      kind: 'bolt', damage: T.bothDamage, speed: T.bothSpeed, range: T.bothRange,
      count: T.bothTargets, scaleWith: 'spread', scaleWeight: T.bothWeight,
      riders: { stun: T.bothStun },
    }],
    ranks: R,
  },
];
