// NECROMANCER — Dark Matter tree. Ranged output and ground control.
//
// CONVERTED FROM docs/design/classes/necromancer.md, the second tree of the
// class, and the one that exists to make the three conversion tables real:
// every trigger here comes from `DOC_TRIGGER` and every rank from `rankPer`, so
// the thirteen classes after this one transcribe against a table instead of
// re-deciding. See ../doc_conversion.js.
//
// TWO NODES DIVERGE FROM THE CLASSIFICATION PASS, and both for the same reason:
// Hex of Entropy and Dark Energy Rift were classified `mortar`, and `mortar` is
// not one of the seventeen primitives. Their documents say `CAST:
// instant-at-range` with a circle at a remote point, which is not a lobbed shot
// with a telegraph — it is a single-tick `hazard`, which exists. Built that way
// and reported; an eighteenth primitive is a stage of its own.

import { docTrigger, rankPer, RANK_NONE, pctRemaining, pctToFraction } from '../doc_conversion.js';

export const TUNING = {
  // tier_code 0 — Dark Energy Blip
  blipDamage: 18, blipSpeed: 520, blipRange: 480, blipCd: 600,
  // tier_code 1 — Dark Matter Bomb
  bombDamage: 30, bombSpeed: 500, bombRange: 420, bombCd: 1200,
  bombSplash: 12, bombSplashRadius: 60,
  // tier_code 2 — Tainted Dark Matter
  taintDamage: 22, taintSpeed: 500, taintRange: 460, taintCd: 2000,
  taintVulnPct: 20, taintVulnDur: 1400,
  // tier_code 3 — Hex of Entropy
  hexDamage: 4, hexRadius: 70, hexRange: 360, hexCd: 2000, hexTick: 400,
  hexSlowPct: 50, hexWeakenPct: 40, hexDur: 1400,
  // tier_code 4 — Abyssal Blast
  abyssDamage: 34, abyssAngle: 1.22, abyssRange: 200, abyssCd: 2000,   // 70° total
  // tier_code 5 — Dark Energy Rift
  riftDamage: 30, riftRadius: 90, riftRange: 300, riftCd: 2000, riftTick: 400,
  // tier_code 6 — Blight (aura, pulsed — ruling 7)
  blightRadius: 120, blightRadiusPerRank: 12,
  blightPulseMs: 4200, blightPulseDamage: 30,
  blightSlowMult: 0.7, blightSlowDur: 800,
  // tier_code 7 — Internal Collapse
  collapseDamage: 10, collapseTick: 600, collapseDur: 3000, collapseRange: 360, collapseCd: 1200,
  // tier_code 8 — Dark Energy Beam
  beamDamage: 16, beamTick: 500, beamDur: 10000, beamRange: 360, beamCd: 4000,
  // tier_code 9 — Singularity
  singDamage: 22, singRadius: 200, singRange: 200, singPulses: 8, singTick: 400,
  singPull: 14, singCd: 25000, singCrowdRadius: 250, singCrowdCount: 8,
};

const T = TUNING;
// The field's lifetime is its pulse count times its cadence — 8 x 400ms of
// hazard beside 8 pulses of pull, so the two steps end together.
const SING_DUR = T.singPulses * T.singTick;

export const NECRO_DARK_MATTER = [
  {
    id: 'necro_dark_energy_blip', tree: 'necro_dark_matter', tier: 1, name: 'Dark Energy Blip',
    flavor: 'Direct a small amount of dark energy onto your target.',
    type: 'active', domain: 'spiritual', prereq: null,
    select: 'nearest',
    trigger: docTrigger('NEAREST_IN_RANGE', { range: T.blipRange }),
    cooldown: T.blipCd,
    compose: [{ kind: 'bolt', damage: T.blipDamage, speed: T.blipSpeed, range: T.blipRange, riders: {} }],
    ranks: rankPer(3, T.blipDamage),
  },
  {
    id: 'necro_dark_matter_bomb', tree: 'necro_dark_matter', tier: 2, name: 'Dark Matter Bomb',
    flavor: 'It arrives, and then the place it arrived at arrives.',
    type: 'active', domain: 'spiritual', prereq: 'necro_dark_energy_blip',
    select: 'lowest_hp',   // "LOWEST_HP_ENEMY" is a target, not a moment
    trigger: docTrigger('LOWEST_HP_ENEMY', { range: T.bombRange }),
    cooldown: T.bombCd,
    // THE SPLASH CARRIES FROM RANK 1, as a `splash` rider on the bolt. The
    // document says "at rank 8 the impact splashes r60" — a rank that turns a
    // rider on, which is the rank-gated shape that is not allowed. Of the two
    // permitted readings this is the one the engine expresses without
    // inventing anything: `splash` is already a BOLT_RIDER with a radius and a
    // damage of its own, so it needs no new machinery and no new dial. Carrying
    // it from rank 1 also keeps the node's identity legible at the tier it is
    // bought at rather than seven ranks later.
    compose: [{ kind: 'bolt', damage: T.bombDamage, speed: T.bombSpeed, range: T.bombRange,
      riders: { splash: { damage: T.bombSplash, radius: T.bombSplashRadius } } }],
    ranks: rankPer(5, T.bombDamage),
  },
  {
    id: 'necro_tainted_dark_matter', tree: 'necro_dark_matter', tier: 3, name: 'Tainted Dark Matter',
    flavor: 'Matter fouled beyond repair; whatever it strikes guards itself poorly after.',
    type: 'active', domain: 'spiritual', prereq: 'necro_dark_matter_bomb',
    select: 'nearest',
    // "TARGET_UNAFFECTED — fires only at an enemy not already tainted" has no
    // engine predicate. `NEAREST` is the honest approximation and the
    // divergence is real: the debuff refreshes where the document wanted it to
    // spread. Recorded in DOC_TRIGGER rather than glossed here.
    trigger: docTrigger('TARGET_UNAFFECTED', { range: T.taintRange }),
    cooldown: T.taintCd,
    // "+20% damage taken" is a vulnerability, and `defenseDown` is the rider
    // that expresses it: `skillDamage` divides by the multiplier, so taking
    // 20% more is a multiplier of 1/1.2.
    compose: [{ kind: 'bolt', damage: T.taintDamage, speed: T.taintSpeed, range: T.taintRange,
      riders: { defenseDown: { mult: +(1 / (1 + T.taintVulnPct / 100)).toFixed(4), dur: T.taintVulnDur } } }],
    ranks: rankPer(3, T.taintDamage),
  },
  {
    id: 'necro_hex_of_entropy', tree: 'necro_dark_matter', tier: 4, name: 'Hex of Entropy',
    flavor: 'A hex of decay saps the strength from what it touches.',
    type: 'active', domain: 'mental', prereq: 'necro_tainted_dark_matter',
    select: 'densest_cluster',
    trigger: docTrigger('DENSEST_CLUSTER', { range: T.hexRange }),
    cooldown: T.hexCd,
    // A SINGLE-TICK `hazard`, not a `mortar`. See the file header: the
    // classification said mortar, mortar is not a primitive, and the document
    // says instant-at-range rather than lobbed. A zone whose duration is one
    // tick is an instant circle at a remote point, which is what the block
    // describes. `slow` is the only rider a zone can hold, so the weaken half
    // of this block does not land — reported.
    compose: [{ kind: 'hazard', damage: T.hexDamage, radius: T.hexRadius,
      duration: T.hexTick, tickMs: T.hexTick,
      riders: { slow: { mult: pctToFraction(T.hexSlowPct), dur: T.hexDur } } }],
    // AN UNLOCK, NOT AN INVESTMENT, and the document forced it. It says "+200ms
    // duration and +8px radius per rank; not damage — four damage is the joke
    // and it should stay the joke." Neither of the two things it does rank is
    // expressible: `hazard` passes its slow duration through unscaled, and
    // radius is not a rank dial at all. So a second point buys nothing visible,
    // which is what `maxRank: 1` says — the same answer the passive rule gives
    // a node in this position. `skilltext_gate` caught it, by noticing the view
    // rendered the same magnitude at rank 1 and rank 10.
    maxRank: 1,
    ranks: rankPer(0, T.hexDamage),
  },
  {
    id: 'necro_abyssal_blast', tree: 'necro_dark_matter', tier: 5, name: 'Abyssal Blast',
    flavor: 'A cone of the place underneath everything.',
    type: 'active', domain: 'spiritual', prereq: 'necro_hex_of_entropy',
    select: 'densest_cluster',
    trigger: docTrigger('DENSEST_CLUSTER', { range: T.abyssRange }),
    cooldown: T.abyssCd,
    compose: [{ kind: 'cone', damage: T.abyssDamage, angle: T.abyssAngle, range: T.abyssRange, riders: {} }],
    ranks: rankPer(5, T.abyssDamage),
  },
  {
    id: 'necro_dark_energy_rift', tree: 'necro_dark_matter', tier: 6, name: 'Dark Energy Rift',
    flavor: 'A rift tears open where the crowd is thickest.',
    type: 'active', domain: 'spiritual', prereq: 'necro_abyssal_blast',
    select: 'densest_cluster',
    trigger: docTrigger('DENSEST_CLUSTER', { range: T.riftRange }),
    cooldown: T.riftCd,
    // The same single-tick `hazard` as Hex, and the same divergence.
    compose: [{ kind: 'hazard', damage: T.riftDamage, radius: T.riftRadius,
      duration: T.riftTick, tickMs: T.riftTick, riders: {} }],
    ranks: rankPer(5, T.riftDamage),
  },
  {
    id: 'necro_blight', tree: 'necro_dark_matter', tier: 7, name: 'Blight',
    flavor: 'A chilling field of dark matter surrounds you, damaging and slowing what comes near.',
    type: 'passive', domain: 'spiritual', prereq: 'necro_dark_energy_rift',
    trigger: docTrigger('ALWAYS_ON'), cooldown: 0, compose: [],
    // RULING 7: an always-on damaging aura must pulse with gaps. 4200ms is this
    // node's own former cooldown — the rate the player could cast it is the rate
    // it fires itself — and 30 is what one cast used to deliver.
    passive: {
      aura: {
        radius: T.blightRadius, radiusPerRank: T.blightRadiusPerRank,
        damage: T.blightPulseDamage, pulseMs: T.blightPulseMs,
        slow: { mult: T.blightSlowMult, dur: T.blightSlowDur },
      },
    },
    ranks: RANK_NONE,
  },
  {
    id: 'necro_internal_collapse', tree: 'necro_dark_matter', tier: 8, name: 'Internal Collapse',
    flavor: 'Rot already in the body is turned inward, and spreads.',
    type: 'active', domain: 'spiritual', prereq: 'necro_blight',
    select: 'nearest',
    trigger: docTrigger('TARGET_UNAFFECTED', { range: T.collapseRange }),
    cooldown: T.collapseCd,
    // A STACKING DOT WITH NO SPREAD, per the classification: `plague` with no
    // `spreadRadius` lands on the seed alone. The document's "stacks to 5" is
    // not expressible — `applyPlague` refreshes rather than stacking — so this
    // is a refreshing DoT and the stack count is reported, not faked.
    compose: [{ kind: 'plague', damage: T.collapseDamage, duration: T.collapseDur,
      tick: T.collapseTick, range: T.collapseRange, spreadRadius: 0 }],
    ranks: rankPer(2, T.collapseDamage),
  },
  {
    id: 'necro_dark_energy_beam', tree: 'necro_dark_matter', tier: 9, name: 'Dark Energy Beam',
    flavor: 'Not a beam of anything. A sustained argument that the target should stop.',
    type: 'active', domain: 'spiritual', prereq: 'necro_internal_collapse',
    select: 'lowest_hp',
    trigger: docTrigger('LOWEST_HP_ENEMY', { range: T.beamRange }),
    cooldown: T.beamCd,
    // `cdFromEnd`, as Death Channel's does. No Essence per tick: the Summons
    // tree pays for channelling and this one just does damage.
    compose: [{ kind: 'channel', damage: T.beamDamage, range: T.beamRange,
      tickMs: T.beamTick, duration: T.beamDur, cdFromEnd: true }],
    ranks: rankPer(3, T.beamDamage),
  },
  {
    id: 'necro_singularity', tree: 'necro_dark_matter', tier: 10, name: 'Singularity',
    flavor: 'Everything nearby agrees, briefly, on where to be.',
    type: 'active', domain: 'spiritual', prereq: 'necro_dark_energy_beam',
    select: 'densest_cluster',
    trigger: docTrigger('CROWD_THRESHOLD', { radius: T.singCrowdRadius, count: T.singCrowdCount }),
    cooldown: T.singCd,
    // `hazard + gravity_pull`, and the two steps are one field: eight 400ms
    // slices of damage beside eight pulses of a 14px drag toward the same
    // centre. Both steps resolve their own `densest_cluster`, which is
    // deterministic within a tick, so they place together.
    //
    // The document's "gated on 40 Essence" is not expressible — Essence is not
    // one of the engines a skill can declare a cost against. Reported.
    compose: [
      { kind: 'hazard', damage: T.singDamage, radius: T.singRadius,
        duration: SING_DUR, tickMs: T.singTick, riders: {} },
      { kind: 'gravity_pull', radius: T.singRadius, distance: T.singPull,
        range: T.singRange, duration: SING_DUR },
    ],
    ranks: rankPer(4, T.singDamage),
  },
];
