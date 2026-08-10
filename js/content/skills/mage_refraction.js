// MAGE — Refraction. The third tree, and the answer to the question
// Crystallize poses.
//
// WHAT THE FIRST TWO LEAVE UNANSWERED. §8.3 calls Crystallize "the only engine
// filled by the enemy rather than by the player's own action, and the only one
// Grit fights". Crystalblade converts crystal into melee output; Collapse
// converts it into area damage. Both trees SPEND the engine. Neither has
// anything to say about the state the engine's own definition produces: a Mage
// that is winning — killing at range, untouched, Grit high — has no crystal and
// therefore no build. The class's power supply is switched off by playing well,
// and that is a question, not a flaw.
//
// Refraction answers it two ways, both of which mean "get hit on purpose":
//
//   INVITE (branch A) makes the enemy come. Every skill carries `taunt`, so
//     the tree buys the one thing that reliably fills a damage-taken engine —
//     something willing to hit you.
//   TEMPER (branch B) makes the hit cheap. Every skill fires on
//     SELF_THRESHOLD, so it pays out once the crystal is already flowing and
//     the question becomes surviving the supply rather than finding it.
//
// Invite starts the engine; Temper keeps you alive inside it. A Mage that takes
// neither has two trees that spend a resource it cannot reliably earn.
//
// PAIRED WITH bard_requiem ON PURPOSE. Rhythm is a timing counter on the
// player's own attacks; Crystallize is an accumulator filled by damage taken.
// The two engines share no state and no code path, so a defect in the shared
// machinery below them surfaces as TWO failures rather than one — which is the
// whole reason these two were authored together.
//
// THE SHAPE (§8.1): ten nodes, tiers 1/2/4/6/8/10, one branch point at tier 2,
// two capstones, symmetric.
//
//        T1  Splinter
//         |
//        T2  Flaw                  <- the branch point
//           /            \
//        T4  Provoke          Anneal
//        T6  Attractor        Hardness (passives)
//        T8  Draw Fire        Quench
//        T10 Caustic          Adamant

export const TUNING = {
  // tier 1 — Splinter
  splinterDamage: 11, splinterRange: 240, splinterSpeed: 430, splinterRadius: 7, splinterCd: 1150,
  // tier 2 — Inclusion (passive, the branch point)
  inclusionWeight: 0.15,

  // ---- branch A: Invite (taunt — make something come and hit you) ----
  provokeDamage: 13, provokeRange: 250, provokeSpeed: 420, provokeRadius: 7, provokeCd: 2300,
  provokeTaunt: 2400,
  attractorWeight: 0.18,
  drawDamage: 17, drawArc: 2.2, drawRange: 260, drawCd: 4300, drawTaunt: 2800,
  causticDamage: 27, causticArc: 3.0, causticRange: 300, causticCd: 7800,
  causticTaunt: 3200, causticWeaken: { mult: 0.7, dur: 3000 },

  // ---- branch B: Temper (SELF_THRESHOLD — survive the supply) ----
  annealAmount: 26, annealDuration: 4200, annealPct: 70, annealCd: 5200,
  hardnessWeight: 0.18,
  quenchDamage: 19, quenchReach: 120, quenchArc: 2.5, quenchPct: 55, quenchCd: 4800,
  adamantAmount: 46, adamantDuration: 5200, adamantReflect: 35, adamantPct: 40, adamantCd: 9200,

  rankDamage: 0.04, rankDuration: 0.03,
};

const T = TUNING;
const R = { damage: T.rankDamage, duration: T.rankDuration };
// Refraction reads the engine the other two spend. A tree about keeping the
// supply on would be incoherent if it did not scale on the supply.
const CRY = { scaleWith: 'crystal'};

export const MAGE_REFRACTION = [
  {
    id: 'mage_splinter', tree: 'mage_refraction', tier: 1, name: 'Splinter',
    desc: 'A shard thrown off the lattice. Small, and it does not care whether anything has hit you yet.',
    type: 'active', domain: 'spiritual', prereq: null,
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.splinterRange },
    cooldown: T.splinterCd,
    compose: [{ kind: 'bolt', damage: T.splinterDamage, range: T.splinterRange, speed: T.splinterSpeed, radius: T.splinterRadius, ...CRY, riders: {} }],
    ranks: R,
  },
  {
    id: 'mage_flaw', tree: 'mage_refraction', tier: 2, name: 'Inclusion',
    desc: 'The flaw inside the stone is what makes it catch the light. Both roads out of here are about being hit on purpose.',
    type: 'passive', domain: 'spiritual', prereq: 'mage_splinter',
    trigger: null, cooldown: 0, compose: [],
    passive: { crystalScaleWeight: T.inclusionWeight },
    ranks: R,
  },

  // ------------------------------------------------ branch A: Invite (taunt)
  {
    id: 'mage_provoke', tree: 'mage_refraction', tier: 4, name: 'Provoke',
    desc: 'An insult with a range. Invite buys the one thing that reliably fills a damage-taken engine — something willing to close.',
    type: 'active', domain: 'spiritual', prereq: 'mage_flaw',
    select: 'objective_target',
    trigger: { kind: 'NEAREST', range: T.provokeRange },
    cooldown: T.provokeCd,
    compose: [{
      kind: 'bolt', damage: T.provokeDamage, range: T.provokeRange, speed: T.provokeSpeed, radius: T.provokeRadius, ...CRY,
      riders: { taunt: T.provokeTaunt },
    }],
    ranks: R,
  },
  {
    id: 'mage_attractor', tree: 'mage_refraction', tier: 6, name: 'Attractor',
    desc: 'Every inclusion in the lattice pulls a little harder.',
    type: 'passive', domain: 'spiritual', prereq: 'mage_provoke',
    trigger: null, cooldown: 0, compose: [],
    passive: { crystalScaleWeight: T.attractorWeight },
    ranks: R,
  },
  {
    id: 'mage_draw_fire', tree: 'mage_refraction', tier: 8, name: 'Draw Fire',
    desc: 'A wide, deliberately rude gesture.',
    type: 'active', domain: 'spiritual', prereq: 'mage_attractor',
    select: 'objective_target',
    trigger: { kind: 'PROXIMITY', radius: T.drawRange, count: 2 },
    cooldown: T.drawCd,
    compose: [{
      kind: 'cone', damage: T.drawDamage, arc: T.drawArc, range: T.drawRange, ...CRY,
      riders: { taunt: T.drawTaunt },
    }],
    ranks: R,
  },
  {
    id: 'mage_caustic', tree: 'mage_refraction', tier: 10, name: 'Caustic',
    desc: 'CAPSTONE — Invite. The light focuses through you. Everything in the cone comes, and hits softer for having come.',
    type: 'active', domain: 'spiritual', prereq: 'mage_draw_fire',
    select: 'objective_target',
    trigger: { kind: 'PROXIMITY', radius: T.causticRange, count: 3 },
    cooldown: T.causticCd,
    compose: [{
      kind: 'cone', damage: T.causticDamage, arc: T.causticArc, range: T.causticRange, ...CRY,
      riders: { taunt: T.causticTaunt, weakenDamage: T.causticWeaken },
    }],
    ranks: R,
  },

  // --------------------------------------- branch B: Temper (SELF_THRESHOLD)
  {
    id: 'mage_anneal', tree: 'mage_refraction', tier: 4, name: 'Anneal',
    desc: 'Heat, then cool slowly. Temper pays out once the crystal is already flowing and the question is surviving the supply.',
    type: 'active', domain: 'spiritual', prereq: 'mage_flaw',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.annealPct },
    cooldown: T.annealCd,
    compose: [{ kind: 'shield', amount: T.annealAmount, duration: T.annealDuration, ...CRY }],
    ranks: R,
  },
  {
    id: 'mage_hardness', tree: 'mage_refraction', tier: 6, name: 'Hardness',
    desc: 'What survived the last blow is denser than what went into it.',
    type: 'passive', domain: 'spiritual', prereq: 'mage_anneal',
    trigger: null, cooldown: 0, compose: [],
    passive: { crystalScaleWeight: T.hardnessWeight },
    ranks: R,
  },
  {
    id: 'mage_quench', tree: 'mage_refraction', tier: 8, name: 'Quench',
    desc: 'The stored heat leaves all at once, into whatever is closest.',
    type: 'active', domain: 'spiritual', prereq: 'mage_hardness',
    select: 'objective_target',
    trigger: { kind: 'SELF_THRESHOLD', pct: T.quenchPct },
    cooldown: T.quenchCd,
    compose: [{ kind: 'strike', damage: T.quenchDamage, arc: T.quenchArc, reach: T.quenchReach, ...CRY, riders: {} }],
    ranks: R,
  },
  {
    id: 'mage_adamant', tree: 'mage_refraction', tier: 10, name: 'Adamant',
    desc: 'CAPSTONE — Temper. At the bottom of the health bar the lattice finishes forming, and what hits it is hit back.',
    type: 'active', domain: 'spiritual', prereq: 'mage_quench',
    select: 'self',   // writes the caster, picks no target (§5.3)
    trigger: { kind: 'SELF_THRESHOLD', pct: T.adamantPct },
    cooldown: T.adamantCd,
    compose: [{ kind: 'ward', amount: T.adamantAmount, duration: T.adamantDuration, reflectPct: T.adamantReflect, ...CRY }],
    ranks: R,
  },
];
