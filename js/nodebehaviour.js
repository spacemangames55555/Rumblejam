// WHAT EACH NODE TYPE ACTUALLY DOES WHEN YOU ENTER IT.
//
// nodetree.js generates a ten-node tree with five types, and until now three of
// them were labels: Shrine, Cursed and Elite were placed, drawn and picked, and
// entering one did exactly what entering a Horde did. A node type that changes
// nothing is not a choice — it is decoration on a corridor, and the whole point
// of picking five of ten is that the five differ.
//
// Everything here is data plus one pure function per type, so the runtime can
// be tested without a sim and the sim has one entry point (applyNodeEntry).

import { REGION_ENEMIES, telegraphWeight } from './content/regions-enemies.js';

export const NODE_TUNING = {
  // ---- Shrine: a free skill point OR a guaranteed reroll, chosen by the party
  shrineSkillPoints: 1,
  shrineRerolls: 1,

  // ---- Cursed: a region modifier for this node only, paid for in gold
  cursedGoldMult: 1.6,          // materials from this node
  cursedEnemyHpMult: 1.25,
  cursedEnemyDmgMult: 1.15,

  // ---- Elite: fewer enemies, each far more dangerous
  eliteCountMult: 0.55,
  eliteHpMult: 2.4,
  eliteDmgMult: 1.35,
  eliteGoldMult: 1.35,
  // An elite node's population is drawn from the HEAVY half of the region, so
  // "elite" means more telegraphed attacks rather than the same fight with
  // bigger numbers. That is also what keeps the density rule meaningful at the
  // node level rather than only across a whole region.
  eliteHeavyShare: 0.75,
};

export const SHRINE_CHOICES = ['skillPoint', 'reroll'];

// The cursed modifiers a region can roll. Each region names one in regions.js;
// this is what that name means.
export const CURSED_MODIFIERS = {
  pnw_gloom: {
    id: 'pnw_gloom', name: 'Gloom',
    desc: 'Sight closes to arm’s length. The wind-ups are still there; you get less of them.',
    sightMult: 0.55,
  },
  bloodmire: {
    id: 'bloodmire', name: 'Bloodmire',
    desc: 'The ground drinks. Standing still costs you, and standing still is the whole plan.',
    // Deliberately aimed at Footing: a cursed node is where the stance is a
    // liability rather than free, which is the decision the engine exists for.
    stationaryDps: 3,
  },
};

// ---------------------------------------------------------------- shrine

// A Shrine grants ONE of two things, and the party picks. Not both, and not a
// random one: a node whose payout is rolled is a node you cannot plan a route
// around, and routing is the choice the tree is made of.
export function shrineOffer() {
  return {
    kind: 'shrine',
    choices: [
      { id: 'skillPoint', label: `+${NODE_TUNING.shrineSkillPoints} skill point`, points: NODE_TUNING.shrineSkillPoints },
      { id: 'reroll', label: `${NODE_TUNING.shrineRerolls} guaranteed reroll`, rerolls: NODE_TUNING.shrineRerolls },
    ],
  };
}

export function applyShrine(choiceId) {
  if (!SHRINE_CHOICES.includes(choiceId)) return null;
  return choiceId === 'skillPoint'
    ? { skillPoints: NODE_TUNING.shrineSkillPoints, rerolls: 0 }
    : { skillPoints: 0, rerolls: NODE_TUNING.shrineRerolls };
}

// ---------------------------------------------------------------- cursed

export function cursedModifierFor(region) {
  const id = region && region.cursedModifier;
  return CURSED_MODIFIERS[id] || null;
}

// ---------------------------------------------------------------- population

// The enemy mix a node draws from, given its type. This is where Elite stops
// being a multiplier and becomes a different fight.
export function nodePopulation(regionId, nodeType) {
  const pop = REGION_ENEMIES[regionId];
  if (!pop) return null;
  // "THE REGION'S HEAVY HALF" — and an elite node has to satisfy TWO rules at
  // once, which only became visible when light telegraphers arrived.
  //
  // It used to read `e.telegraph`, which was the same predicate as "heavy" only
  // while every telegrapher was also a slab. Splitting on HP alone is wrong the
  // other way: region 1's Mistwalker is above the median and does not commit, so
  // an HP-only split put an unreadable unit into the champion draw and dropped
  // the elite room to 37% telegraphing against a 58% baseline — caught by the
  // load assertion below, which says an elite node must be MORE readable rather
  // than the same fight with bigger numbers.
  //
  // A champion is heavy AND it commits. Both, not either.
  const median = (xs) => {
    const a = [...xs].sort((x, y) => x - y);
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };
  const med = median(pop.enemies.map(e => e.hp));
  const isChampion = e => !!e.telegraph && e.hp >= med;
  let heavies = pop.enemies.filter(isChampion);
  // A roster whose telegraphers are all light has no champions by that test.
  // Fall back to every telegrapher rather than to nothing: readability is the
  // rule an elite node exists to raise, and weight is the one it can miss.
  if (!heavies.length) heavies = pop.enemies.filter(e => e.telegraph);
  const chaff = pop.enemies.filter(e => !heavies.includes(e));
  if (nodeType !== 'elite') return pop.enemies.map(e => ({ def: e, w: e.w }));
  // Elite: reweight toward the heavies rather than swapping the roster, so the
  // room still reads as this region.
  const hShare = NODE_TUNING.eliteHeavyShare;
  const hTotal = heavies.reduce((a, e) => a + e.w, 0) || 1;
  const cTotal = chaff.reduce((a, e) => a + e.w, 0) || 1;
  return [
    ...heavies.map(e => ({ def: e, w: (e.w / hTotal) * hShare })),
    ...chaff.map(e => ({ def: e, w: (e.w / cTotal) * (1 - hShare) })),
  ];
}

// The multipliers a node type applies to the fight it spawns.
export function nodeModifiers(nodeType, region) {
  const m = { count: 1, hp: 1, dmg: 1, gold: 1, cursed: null };
  if (nodeType === 'elite') {
    m.count = NODE_TUNING.eliteCountMult;
    m.hp = NODE_TUNING.eliteHpMult;
    m.dmg = NODE_TUNING.eliteDmgMult;
    m.gold = NODE_TUNING.eliteGoldMult;
  } else if (nodeType === 'cursed') {
    m.hp = NODE_TUNING.cursedEnemyHpMult;
    m.dmg = NODE_TUNING.cursedEnemyDmgMult;
    m.gold = NODE_TUNING.cursedGoldMult;
    m.cursed = cursedModifierFor(region);
  }
  return m;
}

// ---------------------------------------------------------------- assertions

function assertNodeBehaviour() {
  const problems = [];

  // Every node type the tree can place must have behaviour here, or it is a
  // label again. Checked against nodetree's NODE_MIX by the caller's test
  // rather than imported, to keep this module free of a cycle.
  for (const [id, m] of Object.entries(CURSED_MODIFIERS)) {
    if (!m.name || !m.desc) problems.push(`cursed modifier ${id}: needs a name and a description — it is shown to the player before they commit to the node`);
    const effects = ['sightMult', 'stationaryDps'].filter(k => m[k] !== undefined);
    if (!effects.length) problems.push(`cursed modifier ${id}: has no effect field — a curse that does nothing is a gold bonus with a scary name`);
  }

  // A cursed node must pay more than a horde or nobody takes it; an elite must
  // pay more than a horde or nobody takes it either. These are the two nodes a
  // player accepts extra risk for.
  if (!(NODE_TUNING.cursedGoldMult > 1)) problems.push('cursed nodes must pay more than a plain horde or the curse is a pure downside');
  if (!(NODE_TUNING.eliteGoldMult > 1)) problems.push('elite nodes must pay more than a plain horde');
  if (!(NODE_TUNING.eliteCountMult < 1)) problems.push('elite nodes must field FEWER enemies — same count with more HP is a slog, not an elite fight');
  if (!(NODE_TUNING.eliteHpMult > 1)) problems.push('elite enemies must be tougher than chaff');

  // An elite node has to be MORE telegraphed than the region average, or
  // "elite" is just a stat multiplier wearing a different icon.
  for (const [regionId, pop] of Object.entries(REGION_ENEMIES)) {
    const base = telegraphWeight(pop.enemies).share;
    const elite = nodePopulation(regionId, 'elite');
    const eTotal = elite.reduce((a, x) => a + x.w, 0);
    const eTel = elite.filter(x => x.def.telegraph).reduce((a, x) => a + x.w, 0);
    const eShare = eTotal ? eTel / eTotal : 0;
    if (!(eShare > base)) {
      problems.push(`${regionId}: elite population is ${(100 * eShare).toFixed(0)}% telegraphing against a region baseline of ${(100 * base).toFixed(0)}% — an elite node must be MORE readable, not the same fight with bigger numbers`);
    }
  }

  if (problems.length) {
    throw new Error(`node behaviour failed ${problems.length} load assertion(s):\n  - ${problems.join('\n  - ')}`);
  }
}

assertNodeBehaviour();
