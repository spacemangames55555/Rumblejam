// SUNDIAN — Tidewrack tree.
//
// THE CLASS ENGINE, EXPRESSED AS CONTENT. §8.3 gives the Sundian "drench stacks"
// and rules them a status of the class's OWN rather than a fifth member of
// `ON_STATUS`'s four — `dot`, `slow`, `plague` and `weakened` are effects, each
// describing something happening to the enemy right now, and drench is a counter
// that does nothing while it sits there. Folding it in would have made every
// `ON_STATUS` skill in the game fire on drench and coupled this engine to the
// whole taxonomy in both directions, forever.
//
// SO THE WRITE PATH IS A PAIR, AND THE PAIR IS THE MECHANIC. `drench` puts
// stacks on; `sluice` takes them off and turns them into damage. A counter with
// no payout is a number and a payout with no counter is a multiplier — which is
// why both were ruled and gated together before this file existed.
//
// WHAT THE TREE IS AUTHORED AGAINST: SPREAD VERSUS CASH. `p.engines.drench`
// counts STACKS standing across the whole room, not enemies, so a Sundian who
// has soaked six bodies three times over is carrying eighteen and every
// `scaleWith: 'drench'` skill in the build is reading it. Sluicing pays that out
// as burst on one target and REMOVES it from the count. The class is therefore
// always choosing between a wetter room and a bigger cheque, and it is the only
// engine whose loss condition is the player's own best move — the Bard drops
// rhythm by playing badly, the Sundian spends drench by playing well.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING.

export const TUNING = {
  // shared drench shape — one cap and one duration for the whole class, so the
  // counter reads the same wherever it came from
  drenchCap: 12, drenchDur: 9000,
  // tier 1 — Spindrift
  spinDamage: 6, spinSpeed: 520, spinRange: 250, spinCd: 1150,
  // tier 2 — Souse
  souseDamage: 7, souseAngle: 1.7, souseRange: 215, souseRadius: 165,
  souseCount: 2, souseCd: 2600, souseStacks: 2,
  // tier 3 — Rip Current
  ripDamage: 8, ripWidth: 34, ripLength: 350, ripRadius: 200,
  ripCount: 2, ripCd: 3400, ripStacks: 2, ripWeight: 0.86,
  // tier 4 — Sluicegate
  sluiceDamage: 9, sluiceSpeed: 530, sluiceRange: 255, sluiceCd: 3800, sluicePer: 8,
  // tier 5 — Tidemark (passive)
  tidemarkWeight: 0.23,
  // tier 6 — Undertow
  underDamage: 9, underReach: 112, underArc: 2.0, underRadius: 142,
  underCount: 2, underCd: 3600, underStacks: 3, underSlowMult: 0.76, underSlowDur: 1300,
  // tier 7 — Millrace
  millDamage: 8, millAngle: 2.1, millRange: 225, millRadius: 185,
  millCount: 3, millCd: 4400, millStacks: 2,
  // tier 8 — Breakwater
  breakAmount: 26, breakDuration: 4800, breakCd: 7600, breakWeight: 1.14,
  // tier 9 — Flood Tide
  floodDamage: 10, floodAngle: 2.4, floodRange: 235, floodRadius: 200,
  floodCount: 3, floodCd: 5600, floodStacks: 3, floodWeight: 1.14,
  // tier 10 — The Whole Sea
  seaDamage: 13, seaAngle: 2.8, seaRange: 250, seaRadius: 215,
  seaCount: 4, seaCd: 9500, seaWeight: 1.43, seaSluicePer: 11, seaStun: 600,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
// One shape for the counter wherever it is applied.
const soak = stacks => ({ drench: { stacks, cap: T.drenchCap, dur: T.drenchDur } });

export const SUN_TIDEWRACK = [
  {
    id: 'sun_spindrift', tree: 'sun_tidewrack', tier: 1, name: 'Spindrift',
    flavor: 'A lash of spray at the nearest thing.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'nearest',
    trigger: { kind: 'NEAREST', range: T.spinRange },
    cooldown: T.spinCd,
    compose: [{ kind: 'bolt', damage: T.spinDamage, speed: T.spinSpeed, range: T.spinRange, riders: {} }],
    ranks: R,
  },
  {
    // THE ENGINE, TIER 2 — the same placement as shift, mark, Quickstep, Facet
    // Strike and Pin. A class should not spend a third of a run being a worse
    // version of another one.
    id: 'sun_souse', tree: 'sun_tidewrack', tier: 2, name: 'Souse',
    flavor: 'A fan of seawater.',
    type: 'active', domain: 'physical', prereq: 'sun_spindrift',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.souseRadius, count: T.souseCount },
    cooldown: T.souseCd,
    compose: [{
      kind: 'cone', damage: T.souseDamage, angle: T.souseAngle, range: T.souseRange,
      riders: soak(T.souseStacks),
    }],
    ranks: R,
  },
  {
    id: 'sun_rip_current', tree: 'sun_tidewrack', tier: 3, name: 'Rip Current',
    flavor: 'A channel of water.',
    type: 'active', domain: 'mental', prereq: 'sun_souse',
    select: 'farthest',
    trigger: { kind: 'PROXIMITY', radius: T.ripRadius, count: T.ripCount },
    cooldown: T.ripCd,
    compose: [{
      kind: 'line', damage: T.ripDamage, width: T.ripWidth, length: T.ripLength,
      scaleWith: 'drench', scaleWeight: T.ripWeight,
      riders: soak(T.ripStacks),
    }],
    ranks: R,
  },
  {
    // THE PAYOUT, AND IT ARRIVES EARLY ON PURPOSE. A Sundian that could only
    // soak for six tiers would spend a third of a run watching a number grow
    // with no way to cash it, which is the same complaint that puts every other
    // class's engine at tier 2.
    id: 'sun_sluicegate', tree: 'sun_tidewrack', tier: 4, name: 'Sluicegate',
    flavor: 'Opens the gate on one target.',
    type: 'active', domain: 'physical', prereq: 'sun_rip_current',
    select: 'highest_hp',
    trigger: { kind: 'NEAREST', range: T.sluiceRange },
    cooldown: T.sluiceCd,
    compose: [{
      kind: 'bolt', damage: T.sluiceDamage, speed: T.sluiceSpeed, range: T.sluiceRange,
      riders: { sluice: { per: T.sluicePer } },
    }],
    ranks: R,
  },
  {
    id: 'sun_tidemark', tree: 'sun_tidewrack', tier: 5, name: 'Tidemark',
    type: 'passive', domain: 'spiritual', prereq: 'sun_sluicegate',
    trigger: null, cooldown: 0, compose: [],
    passive: { drenchScaleWeight: T.tidemarkWeight },
    // Classified 'damage' in PASSIVE_EFFECT, so it is an INVESTMENT and ranks.
    // The per-stack number is the smallest of any engine passive because the
    // engine it reads is a room-wide COUNT rather than a per-player cap — twelve
    // stacks on six bodies is seventy-two, and a Held-Edge-sized increment on
    // that would be a different game.
    ranks: { damage: T.rankDamage },
  },
  {
    id: 'sun_undertow', tree: 'sun_tidewrack', tier: 6, name: 'Undertow',
    flavor: 'A close drag.',
    type: 'active', domain: 'physical', prereq: 'sun_tidemark',
    select: 'nearest',
    trigger: { kind: 'PROXIMITY', radius: T.underRadius, count: T.underCount },
    cooldown: T.underCd,
    compose: [{
      kind: 'strike', damage: T.underDamage, reach: T.underReach, arc: T.underArc,
      scaleWith: 'drench',
      riders: { ...soak(T.underStacks), slow: { mult: T.underSlowMult, dur: T.underSlowDur } },
    }],
    ranks: R,
  },
  {
    id: 'sun_millrace', tree: 'sun_tidewrack', tier: 7, name: 'Millrace',
    flavor: 'A wide sheet.',
    type: 'active', domain: 'mental', prereq: 'sun_undertow',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.millRadius, count: T.millCount },
    cooldown: T.millCd,
    compose: [{
      kind: 'cone', damage: T.millDamage, angle: T.millAngle, range: T.millRange,
      scaleWith: 'drench',
      riders: soak(T.millStacks),
    }],
    ranks: R,
  },
  {
    id: 'sun_breakwater', tree: 'sun_tidewrack', tier: 8, name: 'Breakwater',
    flavor: 'A wall of standing water.',
    type: 'active', domain: 'spiritual', prereq: 'sun_millrace',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: 55 },
    cooldown: T.breakCd,
    compose: [{
      kind: 'shield', amount: T.breakAmount, duration: T.breakDuration,
      scaleWith: 'drench', scaleWeight: T.breakWeight,
    }],
    ranks: R,
  },
  {
    id: 'sun_flood_tide', tree: 'sun_tidewrack', tier: 9, name: 'Flood Tide',
    flavor: 'The water comes in.',
    type: 'active', domain: 'physical', prereq: 'sun_breakwater',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.floodRadius, count: T.floodCount },
    cooldown: T.floodCd,
    compose: [{
      kind: 'cone', damage: T.floodDamage, angle: T.floodAngle, range: T.floodRange,
      scaleWith: 'drench', scaleWeight: T.floodWeight,
      riders: soak(T.floodStacks),
    }],
    ranks: R,
  },
  {
    // THE CAPSTONE CASHES THE WHOLE ROOM, and that is the one place the two
    // halves of the engine meet on a single cast: it reads the room-wide count
    // to size its own damage, then sluices every body it touches. Spend it on a
    // dry room and it is a mediocre cone.
    id: 'sun_the_whole_sea', tree: 'sun_tidewrack', tier: 10, name: 'The Whole Sea',
    flavor: 'Everything you have soaked, called in at once.',
    type: 'active', domain: 'spiritual', prereq: 'sun_flood_tide',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.seaRadius, count: T.seaCount },
    cooldown: T.seaCd,
    compose: [{
      kind: 'cone', damage: T.seaDamage, angle: T.seaAngle, range: T.seaRange,
      scaleWith: 'drench', scaleWeight: T.seaWeight,
      riders: { sluice: { per: T.seaSluicePer }, stun: T.seaStun },
    }],
    ranks: R,
  },
];
