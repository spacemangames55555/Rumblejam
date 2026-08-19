// HUNTER — Pincer. The third tree, and the answer to a gap the second tree's
// own header states and neither tree does anything about.
//
// WHAT THE FIRST TWO LEAVE UNANSWERED. Houndmaster says it outright: Pack
// Tactics pays **ALPHA** for two or more beasts within 120 and **MARKSMAN** for
// no beast within 250, and "it pays at both ends and nothing in between."
// Longshot sends one body away and scales off the span; Houndmaster keeps the
// pack underfoot and is paid flat. Both trees are built for one of the two ends.
//
// So the Hunter has a **dead middle**, and it is not a small one: 120 to 250 is
// the band a chasing beast spends most of its time in, because `move: 'chase'`
// means the distance is set by whatever the beast is running at rather than by
// anything the Hunter chose. The class's trait pays nothing there, and
// `p.engines.spread` — `min(SPREAD_CAP, floor(d / SPREAD_UNIT))` at 90 per step
// — reads 1 or 2. A Hunter in the middle is a Hunter with neither bonus and
// almost no engine.
//
// Pincer is that band, and it treats the two positions as a SHAPE rather than a
// distance. In the middle the Hunter and the beast are far enough apart to have
// different enemies near them and close enough that those sets overlap, which is
// the one geometry neither existing tree has a word for:
//
//   CROSSFIRE (branch A) fires from the Hunter into the space between. Cones
//     and lines, aimed at the cluster, sized by the span — the Hunter's half of
//     the jaw.
//   WHISTLE (branch B) fires `from: 'pet'`: the trigger asks its question at
//     the beast and the compose steps still resolve from the Hunter, so the
//     beast decides WHEN and the Hunter decides WHERE. That is the other half,
//     and it is why the branch is worth taking in the middle specifically —
//     too close and both halves are one position, too far and the beast's
//     targets are not yours.
//
// THE TIER-1 NODE PUTS THE SECOND BODY UP, and it has to. Longshot's tier-2
// comment is exact: "a Hunter without one has no engine and no `from: 'pet'`
// skill that can fire." A pincer needs two jaws before it means anything, so
// the root of this tree summons as well as strikes — one `summon` step beside
// the damage step, which `compose` has always allowed and which keeps the tree
// playable on its own rather than depending on a sibling for its premise.
//
// PAIRED WITH sav_aftermath ON PURPOSE: `spread` is an integer recomputed every
// tick from the DISTANCE between two entities; `cascade` is a float on the
// caster with a decay tick, an idle timer and a total-reset rule. Different
// fields, different write paths, nothing shared.
//
// THE SHAPE (§8.1): ten nodes, tiers 1/2/4/6/8/10, one branch at tier 2, two
// capstones, symmetric.

export const TUNING = {
  loosedDamage: 13, loosedRange: 250, loosedSpeed: 450, loosedRadius: 7, loosedCd: 1250,
  loosedHp: 30, loosedRadiusBody: 12, loosedSpawnRadius: 60,
  loosedAttackCd: 1.1, loosedBeastDamage: 8, loosedBeastArc: 1.5, loosedBeastReach: 58,
  jawsWeight: 0.15,

  // ---- branch A: Crossfire (the Hunter's half of the jaw) ----
  crossDamage: 19, crossArc: 1.7, crossRange: 285, crossCd: 2600,
  bracketWeight: 0.18,
  raakeDamage: 23, raakeLength: 320, raakeWidth: 60, raakeCd: 4400,
  closeDamage: 31, closeArc: 2.8, closeRange: 320, closeCd: 7600,
  closeWeaken: { mult: 0.7, dur: 3000 },

  // ---- branch B: Whistle (the beast's half — it decides WHEN) ----
  // EVERY NODE HERE DECLARES `from: 'pet'`. The trigger runs at the beast's
  // position and the compose steps resolve from the Hunter, so these fire when
  // the fight reaches the BEAST and land where the HUNTER is standing. In the
  // middle band that is a genuine pincer; at either end it is one position
  // asking a question about itself, which is the cost the branch is paid for.
  whistleDamage: 18, whistleReach: 122, whistleArc: 1.9, whistleRange: 200, whistleCd: 2500,
  kennelWeight: 0.18,
  bellDamage: 22, bellRange: 270, bellSpeed: 460, bellRadius: 7, bellProxRadius: 210, bellCd: 4300,
  quarryDamage: 30, quarryArc: 2.7, quarryReach: 150, quarryProxRadius: 230, quarryCd: 7800,
  quarryPulses: 2,

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
const SPREAD = { scaleWith: 'spread' };

export const HUN_PINCER = [
  {
    // TWO STEPS, AND THE SECOND ONE IS THE TREE'S PREMISE. A pincer with one
    // jaw is a stick. `maxAlive: 1` so this is the tree's own body rather than
    // a way to inflate Houndmaster's pack, and `move: 'chase'` because a beast
    // that chases is a beast that ends up in the middle distance — which is the
    // band this whole tree is authored for.
    id: 'hun_loosed', tree: 'hun_pincer', tier: 1, name: 'Loosed',
    flavor: 'A shot, and something to go with it. Neither of you is the whole answer.',
    type: 'active', domain: 'physical', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.loosedRange },
    cooldown: T.loosedCd,
    compose: [
      {
        kind: 'bolt', damage: T.loosedDamage, range: T.loosedRange, speed: T.loosedSpeed,
        radius: T.loosedRadius, ...SPREAD, riders: {},
      },
      {
        kind: 'summon', archetype: 'wolf', maxAlive: 1, move: 'chase',
        count: 1, slotted: false, revives: false,
        hp: T.loosedHp, radius: T.loosedRadiusBody, spawnRadius: T.loosedSpawnRadius,
        attackCd: T.loosedAttackCd, duration: 0,
        attack: { kind: 'strike', damage: T.loosedBeastDamage, arc: T.loosedBeastArc,
                  reach: T.loosedBeastReach, select: 'nearest', riders: {} },
      },
    ],
    ranks: R,
  },
  {
    id: 'hun_jaws', tree: 'hun_pincer', tier: 2, name: 'Jaws',
    flavor: 'Neither end of the leash is where the work happens. Both roads out of here are about the middle.',
    type: 'passive', domain: 'mental', prereq: 'hun_loosed',
    trigger: null, cooldown: 0, compose: [],
    passive: { spreadScaleWeight: T.jawsWeight },
    ranks: R,
  },

  // ---------------------------------- branch A: Crossfire (fired by the Hunter)
  {
    id: 'hun_interlock', tree: 'hun_pincer', tier: 4, name: 'Crossfire',
    flavor: 'Crossfire is your half of the jaw: everything between you and the beast, sized by how far apart you are.',
    type: 'active', domain: 'physical', prereq: 'hun_jaws',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.crossRange, count: 2 },
    cooldown: T.crossCd,
    compose: [{ kind: 'cone', damage: T.crossDamage, arc: T.crossArc, range: T.crossRange, ...SPREAD, riders: {} }],
    ranks: R,
  },
  {
    id: 'hun_bracket', tree: 'hun_pincer', tier: 6, name: 'Bracket',
    flavor: 'The angle is the weapon. It only exists because there are two of you.',
    type: 'passive', domain: 'mental', prereq: 'hun_interlock',
    trigger: null, cooldown: 0, compose: [],
    passive: { spreadScaleWeight: T.bracketWeight },
    ranks: R,
  },
  {
    id: 'hun_raking_shot', tree: 'hun_pincer', tier: 8, name: 'Raking Shot',
    flavor: 'Straight down the line the two of you make.',
    type: 'active', domain: 'physical', prereq: 'hun_bracket',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.raakeLength, count: 2 },
    cooldown: T.raakeCd,
    compose: [{ kind: 'line', damage: T.raakeDamage, length: T.raakeLength, width: T.raakeWidth, ...SPREAD, riders: {} }],
    ranks: R,
  },
  {
    id: 'hun_closing', tree: 'hun_pincer', tier: 10, name: 'Closing',
    flavor: 'CAPSTONE — Crossfire. The jaw shuts, and whatever it did not kill is worse at everything.',
    type: 'active', domain: 'physical', prereq: 'hun_raking_shot',
    select: 'densest_cluster',
    trigger: { kind: 'PROXIMITY', radius: T.closeRange, count: 3 },
    cooldown: T.closeCd,
    compose: [{
      kind: 'cone', damage: T.closeDamage, arc: T.closeArc, range: T.closeRange, ...SPREAD,
      riders: { weakenDamage: T.closeWeaken },
    }],
    ranks: R,
  },

  // ------------------------------------- branch B: Whistle (fired by the beast)
  {
    id: 'hun_whistle', tree: 'hun_pincer', tier: 4, name: 'Whistle',
    flavor: 'Whistle is the beast\'s half: it decides when, you decide where. Only worth having when you are not standing in the same place.',
    type: 'active', domain: 'physical', prereq: 'hun_jaws',
    from: 'pet',
    select: 'objective_target',
    trigger: { kind: 'PROXIMITY', radius: T.whistleRange, count: 2 },
    cooldown: T.whistleCd,
    compose: [{ kind: 'strike', damage: T.whistleDamage, arc: T.whistleArc, reach: T.whistleReach, ...SPREAD, riders: {} }],
    ranks: R,
  },
  {
    id: 'hun_kennel', tree: 'hun_pincer', tier: 6, name: 'Kennel',
    flavor: 'It has been reading the room the whole time. Start listening.',
    type: 'passive', domain: 'mental', prereq: 'hun_whistle',
    trigger: null, cooldown: 0, compose: [],
    passive: { spreadScaleWeight: T.kennelWeight },
    ranks: R,
  },
  {
    id: 'hun_bell', tree: 'hun_pincer', tier: 8, name: 'Bell',
    flavor: 'It calls when the crowd reaches it. The shot comes from behind them.',
    type: 'active', domain: 'physical', prereq: 'hun_kennel',
    from: 'pet',
    select: 'objective_target',
    trigger: { kind: 'PROXIMITY', radius: T.bellProxRadius, count: 2 },
    cooldown: T.bellCd,
    compose: [{
      kind: 'bolt', damage: T.bellDamage, range: T.bellRange, speed: T.bellSpeed,
      radius: T.bellRadius, ...SPREAD, riders: {},
    }],
    ranks: R,
  },
  {
    id: 'hun_quarry', tree: 'hun_pincer', tier: 10, name: 'Quarry',
    flavor: 'CAPSTONE — Whistle. It has them. Twice.',
    type: 'active', domain: 'physical', prereq: 'hun_bell',
    from: 'pet',
    select: 'objective_target',
    trigger: { kind: 'PROXIMITY', radius: T.quarryProxRadius, count: 3 },
    cooldown: T.quarryCd,
    compose: [{
      kind: 'strike', damage: T.quarryDamage, arc: T.quarryArc, reach: T.quarryReach, ...SPREAD,
      riders: { multiPulse: T.quarryPulses },
    }],
    ranks: R,
  },
];
