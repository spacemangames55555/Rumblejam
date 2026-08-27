// NECROMANCER — Dark Matter tree.
//
// Ranged direct damage and debuffs. Chosen as the phase-1 control case: every
// node is direct damage with no summon machinery, so it tests the trigger
// system without an engine layered on top. The Necromancer's summon engine
// lives in a tree that is out of scope.
//
// EVERY NUMBER IN THIS FILE LIVES IN TUNING. Skill definitions reference it;
// behaviour code reads from the definitions. A literal magnitude in a behaviour
// function is a bug — that rule is what makes a 420-skill export tractable.

export const TUNING = {
  // tier 1 — Dark Energy Blip
  blipDamage: 6, blipSpeed: 520, blipRange: 260, blipCd: 900,
  // tier 2 — Blight
  blightDamage: 4, blightRadius: 120, blightCount: 2, blightDuration: 3000,
  blightTickMs: 400, blightCd: 4200, blightSlowMult: 0.7, blightSlowDur: 800,
  // THE PULSE. `blightCd` was the cooldown of the cast this node no longer has,
  // and it is now the gap between the field's own pulses — the rate the player
  // used to be able to fire it is the rate it fires itself. `blightPulseDamage`
  // is what ONE cast used to deliver: 4 per 400ms across a 3000ms patch, which
  // is 30 to a body that stood in it for the whole thing.
  blightPulseMs: 4200, blightPulseDamage: 30, blightRadiusPerRank: 12,
  // tier 3 — Dark Energy Rift
  riftDamage: 7, riftSpeed: 480, riftRadius: 200, riftCount: 3,
  riftTargets: 3,          // EXACT (source project): target plus two nearby
  riftCd: 3000,
  // tier 4 — Hex of Entropy
  hexDamage: 5, hexSpeed: 500, hexRange: 240, hexCd: 5000,
  hexWeakenMult: 0.75, hexDuration: 2000,   // EXACT (source project): 2s
  hexSlowMult: 0.75,
  // tier 5 — Dark Energy Burr
  burrDamage: 8, burrSpeed: 460, burrRange: 280, burrPct: 60, burrCd: 4500,
  burrDotDamage: 10, burrDotDur: 1600,
  // tier 6 — Internal Collapse
  collapseDamage: 9, collapseRange: 300, collapseSpread: 140,
  collapseDuration: 3000,  // EXACT (source project): 3s, stacking
  collapseCd: 6000,
  // tier 7 — Tainted Dark Matter
  taintDamage: 7, taintSpeed: 520, taintRange: 260, taintCd: 3600,
  taintDefMult: 0.8, taintDefDur: 2500,
  // tier 8 — Abyssal Blast
  abyssDamage: 11, abyssAngle: 1.4, abyssRange: 240, abyssRadius: 180,
  abyssCount: 4, abyssCd: 7000,
  // tier 9 — Dark Energy Beam
  beamDamage: 6, beamWidth: 34, beamLength: 420, beamPulses: 3,
  beamRadius: 200, beamCount: 2, beamCd: 6500,
  // tier 10 — Dark Matter Bomb
  bombDamage: 16, bombSpeed: 400, bombRadius: 220, bombCount: 5, bombCd: 9000,
  bombSplashDamage: 12, bombSplashRadius: 130,
  // rank increments — linear, never compounding
  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };

export const NECRO_DARK_MATTER = [
  {
    id: 'necro_blip', tree: 'necro_dark_matter', tier: 1, name: 'Dark Energy Blip',
    flavor: 'Direct a small amount of dark energy onto your target.',
    type: 'active', domain: 'spiritual', prereq: null,
    select: 'objective_target',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'NEAREST', range: T.blipRange },
    cooldown: T.blipCd,
    compose: [{ kind: 'bolt', damage: T.blipDamage, speed: T.blipSpeed, range: T.blipRange, riders: {} }],
    ranks: R,
  },
  {
    // BLIGHT IS AN AURA, and it was a hazard because there was no aura.
    //
    // The conversion doc declares it `TYPE: passive (aura)`, `SHAPE: ground area
    // (circle on caster, always active)`, `TRIGGER: always-on (no trigger;
    // occupies a slot)`. `hazard` could express a patch on the floor and
    // nothing else, so a patch is what shipped.
    //
    // AND IT PULSES, because a continuous one cannot exist. Built as a field
    // that damaged every 400ms it let a NEVER-MOVING Necromancer clear 20 of 25
    // rooms, and at 1 dps it still broke 12 — time did the work, so no
    // magnitude fixed it. The ruling is in §5.7 of the GDD and in the roster
    // ruling file: an always-on damaging aura must pulse with gaps, because the
    // gap is the thing a statue cannot convert into damage.
    //
    // THE GAP IS THE NODE'S OWN OLD COOLDOWN. 4200ms was how often the player
    // could cast this; it is now how often the field fires itself. Measured
    // across all 25 statue rooms it is also the best of the cadences tried at
    // rewarding play: a moving player earns 1.74x what a stationary one does at
    // 4200ms, against 1.14x at 3000ms and 0.79x at 6000ms — slower is not
    // better, because a rare pulse pays whoever happens to be surrounded and a
    // statue always is.
    //
    // 30 IS WHAT ONE CAST USED TO DELIVER: 4 damage per 400ms tick across a
    // 3000ms patch. The throughput is preserved and the cast is gone.
    //
    // The rank buys RADIUS and only radius — `field`, the third PASSIVE_EFFECT
    // class, exists so the rank-1 rule does not take the only growth it has.
    id: 'necro_blight', tree: 'necro_dark_matter', tier: 2, name: 'Blight',
    flavor: 'A chilling field of dark matter surrounds you, damaging and slowing what comes near.',
    type: 'passive', domain: 'spiritual', prereq: 'necro_blip',
    passive: {
      aura: {
        radius: T.blightRadius, radiusPerRank: T.blightRadiusPerRank,
        damage: T.blightPulseDamage, pulseMs: T.blightPulseMs,
        slow: { mult: T.blightSlowMult, dur: T.blightSlowDur },
      },
    },
    ranks: R,
  },
  {
    id: 'necro_rift', tree: 'necro_dark_matter', tier: 3, name: 'Dark Energy Rift',
    flavor: 'A rift tears open, striking your target and two others beside it.',
    type: 'active', domain: 'spiritual', prereq: 'necro_blight',
    select: 'densest_cluster',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'PROXIMITY', radius: T.riftRadius, count: T.riftCount },
    cooldown: T.riftCd,
    compose: [{
      kind: 'bolt', damage: T.riftDamage, speed: T.riftSpeed,
      range: T.riftRadius, count: T.riftTargets, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'necro_hex', tree: 'necro_dark_matter', tier: 4, name: 'Hex of Entropy',
    flavor: 'A hex of decay saps the strength from what it touches.',
    type: 'active', domain: 'mental', prereq: 'necro_rift',
    select: 'highest_hp',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'NEAREST', range: T.hexRange },
    cooldown: T.hexCd,
    compose: [{
      kind: 'bolt', damage: T.hexDamage, speed: T.hexSpeed, range: T.hexRange,
      riders: {
        weakenDamage: { mult: T.hexWeakenMult, dur: T.hexDuration },
        slow: { mult: T.hexSlowMult, dur: T.hexDuration },
      },
    }],
    ranks: R,
  },
  {
    id: 'necro_burr', tree: 'necro_dark_matter', tier: 5, name: 'Dark Energy Burr',
    flavor: 'A burr lodges in a wounded target and detonates a moment later.',
    type: 'active', domain: 'spiritual', prereq: 'necro_hex',
    select: 'lowest_hp',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'TARGET_THRESHOLD', pct: T.burrPct, range: T.burrRange },
    cooldown: T.burrCd,
    compose: [{
      kind: 'bolt', damage: T.burrDamage, speed: T.burrSpeed, range: T.burrRange,
      riders: { impactDot: { damage: T.burrDotDamage, dur: T.burrDotDur } },
    }],
    ranks: R,
  },
  {
    id: 'necro_collapse', tree: 'necro_dark_matter', tier: 6, name: 'Internal Collapse',
    flavor: 'Rot already in the body is turned inward, and spreads.',
    type: 'active', domain: 'spiritual', prereq: 'necro_burr',
    select: 'highest_hp',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'ON_STATUS', status: 'dot', range: T.collapseRange },
    cooldown: T.collapseCd,
    compose: [{
      kind: 'plague', damage: T.collapseDamage,
      duration: T.collapseDuration, spreadRadius: T.collapseSpread,
    }],
    ranks: R,
  },
  {
    id: 'necro_taint', tree: 'necro_dark_matter', tier: 7, name: 'Tainted Dark Matter',
    flavor: 'Matter fouled beyond repair; whatever it strikes guards itself poorly after.',
    type: 'active', domain: 'mental', prereq: 'necro_collapse',
    select: 'highest_hp',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'NEAREST', range: T.taintRange },
    cooldown: T.taintCd,
    compose: [{
      kind: 'bolt', damage: T.taintDamage, speed: T.taintSpeed, range: T.taintRange,
      riders: { defenseDown: { mult: T.taintDefMult, dur: T.taintDefDur } },
    }],
    ranks: R,
  },
  {
    id: 'necro_abyssal', tree: 'necro_dark_matter', tier: 8, name: 'Abyssal Blast',
    flavor: 'The abyss opens in a wide arc before you.',
    type: 'active', domain: 'spiritual', prereq: 'necro_taint',
    select: 'densest_cluster',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'PROXIMITY', radius: T.abyssRadius, count: T.abyssCount },
    cooldown: T.abyssCd,
    compose: [{ kind: 'cone', damage: T.abyssDamage, angle: T.abyssAngle, range: T.abyssRange }],
    ranks: R,
  },
  {
    id: 'necro_beam', tree: 'necro_dark_matter', tier: 9, name: 'Dark Energy Beam',
    flavor: 'A sustained lance of dark energy. It wants room to work.',
    type: 'active', domain: 'spiritual', prereq: 'necro_abyssal',
    select: 'farthest',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'ISOLATED', radius: T.beamRadius, count: T.beamCount },
    cooldown: T.beamCd,
    compose: [{
      kind: 'line', damage: T.beamDamage, width: T.beamWidth, length: T.beamLength,
      riders: { multiPulse: T.beamPulses },
    }],
    ranks: R,
  },
  {
    id: 'necro_bomb', tree: 'necro_dark_matter', tier: 10, name: 'Dark Matter Bomb',
    flavor: 'Everything the tree has been building toward, delivered at once.',
    type: 'active', domain: 'spiritual', prereq: 'necro_beam',
    select: 'densest_cluster',   // what it hits; the trigger above is only WHEN
    trigger: { kind: 'PROXIMITY', radius: T.bombRadius, count: T.bombCount },
    cooldown: T.bombCd,
    compose: [{
      kind: 'bolt', damage: T.bombDamage, speed: T.bombSpeed, range: T.bombRadius,
      riders: { splash: { damage: T.bombSplashDamage, radius: T.bombSplashRadius } },
    }],
    ranks: R,
  },
];
