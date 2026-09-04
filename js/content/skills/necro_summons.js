// NECROMANCER — Summons tree. The commander: bodies, a threat ladder, Essence.
//
// CONVERTED FROM docs/design/classes/necromancer.md, and the tree the document
// says supersedes its built counterpart outright — it shared exactly one node
// with what shipped. Built through the three tables in ../doc_conversion.js.
//
// THE THREAT LADDER (port ruling 1) is Monster > Skeletons > Necromancer, and
// it is expressed by REACH rather than by a ladder field the engine does not
// have: the Monster carries the widest taunt, the skeletons a narrower one, and
// the caster none. Summons are already targetable, aggro-taking and mortal.
//
// ALL FOUR SUMMONS DECLARE `attackCd` IN MILLISECONDS. Every value below is
// four digits for a reason — and the reason is no longer a warning to the next
// reader: the four summons that declared seconds are converted, and the loader
// now refuses any `attackCd` under 50 outright. A comment could only tell
// somebody who read it.

import { docTrigger, rankPer, RANK_NONE } from '../doc_conversion.js';

export const TUNING = {
  // tier_code 0 — Summon Skeleton
  skelHp: 60, skelRadius: 13, skelSpawnRadius: 44, skelCd: 1200, skelCap: 3,
  skelDamage: 9, skelArc: 1.4, skelReach: 46, skelAtkCd: 1100,   // ms
  skelTaunt: 1600,
  // ON_TOKEN: the reach for a soul token, and the flight of the throw that
  // reaches it. §8.5 row 4.
  skelTokenRange: 320, skelSeedSpeed: 620, skelSeedRadius: 6,
  // tier_code 1 — Unleash the Monster
  monsterHp: 220, monsterRadius: 22, monsterSpawnRadius: 54, monsterCd: 8000,
  monsterDamage: 26, monsterArc: 1.6, monsterReach: 70, monsterAtkCd: 1100,   // ms
  monsterTaunt: 3000,                 // the widest on the ladder — MAGNET aggro r300
  // tier_code 2 — Unyielding Beast (passive)
  beastHp: 50,
  // tier_code 3 — Necrotic Presence (passive)
  presenceDmg: 20, presenceHp: 20,
  // tier_code 5a — Blood Skeleton (passive)
  bloodDmg: 50,
  // tier_code 5b — Marrow Skeleton (passive)
  marrowSkelHp: 40,
  // tier_code 6 — Tentacles of Dark Matter (passive)
  tentacleReach: 24,
  // tier_code 7 — Death Channel
  channelDamage: 14, channelTick: 500, channelDur: 10000, channelRange: 360, channelCd: 1200,
  // tier_code 8 — Entropy Cascade
  cascadeDamage: 8, cascadeTick: 600, cascadeDur: 5000, cascadeRange: 300, cascadeCd: 600,
  // tier_code 9 — Army of the Dead
  armyHp: 45, armyRadius: 13, armySpawnRadius: 66, armyCount: 6,
  armyDuration: 20000, armyCd: 25000, armyCrowdRadius: 400, armyCrowdCount: 10,
  armyDamage: 8, armyArc: 1.4, armyReach: 44, armyAtkCd: 1000,   // ms
};

const T = TUNING;

export const NECRO_SUMMONS = [
  {
    id: 'necro_summon_skeleton', tree: 'necro_summons', tier: 2, name: 'Summon Skeleton',
    flavor: 'It remembers how to hold a weapon. It remembers nothing else.',
    type: 'active', domain: 'spiritual', prereq: 'necro_entropy_cascade',
    select: 'self',   // writes the caster's field, picks no target (§5.3)
    // §8.5 ROW 4 OVERRIDES THE DOCUMENT HERE. The block says "COOLDOWN_READY,
    // gated on being under cap" and never mentions soul tokens at all — but the
    // GDD makes the Necromancer's summons rise from tokens the dead leave, and
    // token VISIBILITY is derived from owning an ON_TOKEN skill, so a Summons
    // tree without one blinds the class to its own resource. The document's
    // omission is the finding; the ruling is the GDD's.
    trigger: { kind: 'ON_TOKEN', range: T.skelTokenRange },
    cooldown: T.skelCd,
    // "+1 to the standing cap every 4th rank" — a rank buying a STRUCTURAL
    // quantity, which is the one exception RANK_GRANTS registers. It moved here
    // with the node: the registry named `necro_raise_skeleton`, which this tree
    // no longer contains.
    // ONE PER RANK, not the document's "+1 every 4th". `summonSlotsFor` FLOORS
    // `rankGrantPer x rank` and has no base term, so 0.25 leaves a summoner with
    // zero slots at ranks 1-3 and a skill that silently refuses every spawn.
    // The document's "cap 3 standing, +1 per 4 ranks" is a base-plus-increment
    // shape the engine does not have. Reported.
    rankGrants: 'summonSlots', rankGrantPer: 1,
    compose: [{
      kind: 'summon', archetype: 'skeleton', move: 'chase',
      // NO `maxAlive` — the standing cap IS the summon-slot count, which the
      // rank grant above buys. A second cap on the step fights it and pinned
      // the pack at three however many slots the player had earned.
      count: 1, slotted: true, revives: false,
      hp: T.skelHp, radius: T.skelRadius, spawnRadius: T.skelSpawnRadius,
      duration: 0,                        // permanent: it holds a slot, not a timer
      // THE THROW. `deliver` makes the summon travel to the token and rise
      // there rather than at the caster's feet — §8.5 row 4 again.
      deliver: { speed: T.skelSeedSpeed, radius: T.skelSeedRadius },
      attackCd: T.skelAtkCd,              // MILLISECONDS
      // The middle rung of the threat ladder: a narrower taunt than the
      // Monster's, so aggro settles above the caster and below the Monster.
      attack: { kind: 'strike', damage: T.skelDamage, arc: T.skelArc, reach: T.skelReach,
        select: 'nearest', riders: { taunt: T.skelTaunt } },
    }],
    // "+10% skeleton damage and HP per rank; +1 cap every 4th rank." Ranks buy
    // SUMMON stats, and `ranks` scales the STEP's damage — which is 0 for a
    // summon, because the skeleton deals the damage and not the cast. The
    // step's `hp` does move, through `rankedDuration`. Reported.
    ranks: rankPer(0, 0, { durationAdd: 6, durationBase: T.skelHp }),
  },
  {
    id: 'necro_unleash_the_monster', tree: 'necro_summons', tier: 3, name: 'Unleash the Monster',
    flavor: 'You did not make it. You only let it out.',
    type: 'active', domain: 'spiritual', prereq: 'necro_summon_skeleton',
    select: 'self',
    trigger: docTrigger('COOLDOWN_READY', { radius: 300 }),
    cooldown: T.monsterCd,
    compose: [{
      kind: 'summon', archetype: 'golem', move: 'chase',
      // NOT SLOTTED — TWO INDEPENDENT CAPS, per §8.5's own wording: "Skeletons
      // cap 3 (+1 per 4 ranks). Monster caps 1 (never more — it is a pet, not a
      // swarm)." Two per-skill caps, not one shared pool.
      //
      // It shipped `slotted: true`, and `slotsFilled` counts every slotted
      // minion regardless of archetype, so the Monster spent a currency it does
      // not mint: `summonSlots` is granted by ONE skill in the game — the
      // skeleton, at 1 per rank — and was drawn from by two. Measured, at
      // skeleton rank 1 that made them MUTUALLY EXCLUSIVE IN BOTH DIRECTIONS:
      // Monster first and four skeletons were refused; skeletons first and the
      // Monster was refused. At every higher rank the Monster still cost a
      // skeleton permanently, because both are `duration: 0`.
      //
      // The both-ways symptom is why it survived play: the skeleton fires on
      // ON_TOKEN and the Monster on COOLDOWN_READY, so which one loses depends
      // on which got there first.
      //
      // `maxAlive: 1` is now the whole of its cap, which is what every other
      // summon in the game already does — the Druid's three animals, the
      // Hunter's, the Witch Doctor's, and Army of the Dead are all
      // `slotted: false` with their own ceiling. The slot pool is skeletons-only,
      // which is what the skeleton step's own comment already assumes.
      count: 1, maxAlive: 1, slotted: false, revives: false,
      hp: T.monsterHp, radius: T.monsterRadius, spawnRadius: T.monsterSpawnRadius,
      duration: 0,
      attackCd: T.monsterAtkCd,           // MILLISECONDS
      // TOP OF THE THREAT LADDER. "MAGNET aggro r300" is not a field a summon
      // has; the widest taunt in the class is how the engine says the same
      // thing — every enemy it swings at looks at IT, for longest.
      attack: { kind: 'strike', damage: T.monsterDamage, arc: T.monsterArc, reach: T.monsterReach,
        select: 'nearest', riders: { taunt: T.monsterTaunt } },
    }],
    ranks: rankPer(0, 0, { durationAdd: 26, durationBase: T.monsterHp }),
  },
  {
    id: 'necro_unyielding_beast', tree: 'necro_summons', tier: 4, name: 'Unyielding Beast',
    flavor: 'It has been killed before. It did not take.',
    type: 'passive', domain: 'spiritual', prereq: 'necro_unleash_the_monster',
    trigger: docTrigger('ALWAYS_ON'), cooldown: 0, compose: [],
    // "+50% Monster life and −30% damage taken." `summonHp` reaches every
    // summon rather than the Monster alone — the engine has no per-archetype
    // modifier — and the damage-reduction half has no key at all. Both reported.
    passive: { summonHp: T.beastHp },
    maxRank: 1,
    ranks: RANK_NONE,
  },
  {
    id: 'necro_necrotic_presence', tree: 'necro_summons', tier: 5, name: 'Necrotic Presence',
    flavor: 'Being near you is good for the dead and bad for everyone else.',
    type: 'passive', domain: 'spiritual', prereq: 'necro_unyielding_beast',
    trigger: docTrigger('ALWAYS_ON'), cooldown: 0, compose: [],
    passive: { summonDmg: T.presenceDmg, summonHp: T.presenceHp },
    ranks: rankPer(6, 100),             // "+6% summon damage per rank"
  },
  {
    id: 'necro_blood_skeleton', tree: 'necro_summons', tier: 6, name: 'Blood Skeleton',
    flavor: 'Sharpened rather than reinforced. It will not last, and it does not need to.',
    type: 'passive', domain: 'spiritual', prereq: 'necro_necrotic_presence',
    trigger: docTrigger('ALWAYS_ON'), cooldown: 0, compose: [],
    // HALF THE BRANCH PAIR, and not exclusive — both sit at tier_code 5 in the
    // document and a player may own both. The engine has no exclusivity
    // mechanism, so "not exclusive" costs nothing to honour; what it cannot
    // honour is "SKELETONS deal more", since `summonDmg` reaches every summon.
    passive: { summonDmg: T.bloodDmg },
    ranks: rankPer(12, 100),
  },
  {
    id: 'necro_marrow_skeleton', tree: 'necro_summons', tier: 6, name: 'Marrow Skeleton',
    flavor: 'Reinforced rather than sharpened. It stands where you would rather not.',
    type: 'passive', domain: 'spiritual', prereq: 'necro_necrotic_presence',
    trigger: docTrigger('ALWAYS_ON'), cooldown: 0, compose: [],
    passive: { summonHp: T.marrowSkelHp },
    maxRank: 1,
    ranks: RANK_NONE,
  },
  {
    id: 'necro_tentacles_of_dark_matter', tree: 'necro_summons', tier: 7, name: 'Tentacles of Dark Matter',
    flavor: 'It reaches further than it looks like it can.',
    type: 'passive', domain: 'spiritual', prereq: 'necro_blood_skeleton',
    trigger: docTrigger('ALWAYS_ON'), cooldown: 0, compose: [],
    // "+1 cleave target every 2nd rank; +8px Monster reach per rank." Neither a
    // summon's reach nor its cleave count is a passive key, so this lands as
    // summon damage instead — the closest expressible reading of "the Monster
    // hits more things". Reported.
    passive: { summonDmg: T.tentacleReach },
    ranks: rankPer(8, 100),
  },
  {
    id: 'necro_death_channel', tree: 'necro_summons', tier: 9, name: 'Death Channel',
    flavor: 'Dying is a process with a rate, and the rate can be adjusted.',
    type: 'active', domain: 'spiritual', prereq: 'necro_tentacles_of_dark_matter',
    select: 'lowest_hp',
    trigger: docTrigger('LOWEST_HP_ENEMY', { range: T.channelRange }),
    cooldown: T.channelCd,
    // PACE STAYS `fast (1200ms)` — it matches the current bucket table, and
    // `cdFromEnd` is a RIDERS property, which is where the document declares
    // it. The two are different facts about the same cooldown.
    compose: [{ kind: 'channel', damage: T.channelDamage, range: T.channelRange,
      tickMs: T.channelTick, duration: T.channelDur, cdFromEnd: true }],
    ranks: rankPer(2, T.channelDamage),
  },
  {
    id: 'necro_entropy_cascade', tree: 'necro_summons', tier: 1, name: 'Entropy Cascade',
    flavor: 'It does not spread. It simply keeps arriving.',
    type: 'active', domain: 'spiritual', prereq: null,
    select: 'nearest',
    trigger: docTrigger('TARGET_UNAFFECTED', { range: T.cascadeRange }),
    cooldown: T.cascadeCd,
    // `plague` with NO spread radius, per the classification. "Stacks to 6" is
    // not expressible — `applyPlague` refreshes rather than stacking — so this
    // is a refreshing DoT and the stack count is reported, not faked.
    compose: [{ kind: 'plague', damage: T.cascadeDamage, duration: T.cascadeDur,
      tick: T.cascadeTick, spreadRadius: 0 }],
    ranks: rankPer(2, T.cascadeDamage),
  },
  {
    id: 'necro_army_of_the_dead', tree: 'necro_summons', tier: 10, name: 'Army of the Dead',
    flavor: 'You stop asking. The floor answers anyway.',
    type: 'active', domain: 'spiritual', prereq: 'necro_death_channel',
    select: 'self',
    trigger: docTrigger('CROWD_THRESHOLD', { radius: T.armyCrowdRadius, count: T.armyCrowdCount }),
    cooldown: T.armyCd,
    compose: [{
      kind: 'summon', archetype: 'skeleton', move: 'chase',
      count: T.armyCount, maxAlive: T.armyCount, slotted: false, revives: false,
      hp: T.armyHp, radius: T.armyRadius, spawnRadius: T.armySpawnRadius,
      // TIMED, AND OUTSIDE THE CAP. `slotted: false` is what "do not count
      // against the skeleton cap" means, and the duration is what "when they
      // expire they expire" means. Neither needed a new field.
      duration: T.armyDuration,
      attackCd: T.armyAtkCd,              // MILLISECONDS
      attack: { kind: 'strike', damage: T.armyDamage, arc: T.armyArc, reach: T.armyReach,
        select: 'nearest', riders: {} },
    }],
    ranks: rankPer(0, 0, { durationAdd: 4, durationBase: T.armyHp }),
  },
];
