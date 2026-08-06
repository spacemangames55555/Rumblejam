// SKILL REGISTRY, PROGRESSION, LOADOUT — and the assertions that run at load.
//
// The source project shipped 19 skill kinds wired to nothing, plus stance
// multipliers and a resource generator that were never read. All silently, all
// passing whatever tests existed. With 420 skills eventually, that failure mode
// is guaranteed unless it is engineered against from the first patch, so the
// checks here run at import time and throw rather than warn.

import { NECRO_DARK_MATTER, TUNING as NECRO_TUNING } from './content/skills/necro_dark_matter.js';
import { SAMURAI_ARMOR, TUNING as SAMURAI_TUNING } from './content/skills/samurai_armor.js';
import { NECRO_MARROW, TUNING as MARROW_TUNING } from './content/skills/necro_marrow.js';
import { SAMURAI_TACTICS, TUNING as TACTICS_TUNING } from './content/skills/samurai_tactics.js';
import { TRIGGER_KINDS, TRIGGER_PARAMS } from './triggers.js';
import { PRIMITIVE_KINDS, RIDERS_BY_PRIMITIVE } from './compose.js';
import { isDomain } from './domains.js';

export const TREES = {
  necro_dark_matter: { id: 'necro_dark_matter', name: 'Dark Matter', classId: 'toh_necromancer', skills: NECRO_DARK_MATTER, tuning: NECRO_TUNING },
  samurai_armor: { id: 'samurai_armor', name: 'Armor', classId: 'toh_samurai', skills: SAMURAI_ARMOR, tuning: SAMURAI_TUNING },
  necro_marrow: { id: 'necro_marrow', name: 'Marrow', classId: 'toh_necromancer', skills: NECRO_MARROW, tuning: MARROW_TUNING },
  samurai_tactics: { id: 'samurai_tactics', name: 'Tactics', classId: 'toh_samurai', skills: SAMURAI_TACTICS, tuning: TACTICS_TUNING },
};

export const ALL_SKILLS = Object.values(TREES).flatMap(t => t.skills);
export const SKILL_BY_ID = Object.fromEntries(ALL_SKILLS.map(s => [s.id, s]));

// Which trees a class can spend into. One per class in this patch — but the
// lookup is a list on purpose, because "points are spendable freely across a
// character's trees" must not become a one-tree assumption baked into callers.
export const TREES_BY_CLASS = {};
for (const t of Object.values(TREES)) (TREES_BY_CLASS[t.classId] ||= []).push(t.id);

// WHAT EACH PASSIVE KEY ACTUALLY BUYS. Declared, not inferred, because the
// rank-1 ruling (§1.3) turns on it: a passive granting neither damage nor
// duration is an unlock and must declare maxRank: 1.
//
// Every value in a `passive` block is multiplied by rank in passiveSum(), so
// "does ranking this buy anything" is exactly "is this key damage or duration".
// A key absent from this table fails the load assertion rather than defaulting,
// so adding a passive forces the author to answer the question once.
export const PASSIVE_EFFECT = {
  // scale damage — genuine investments, rankable
  footingDamageBonus: 'damage',   // Held Edge: more damage per Footing stack
  reflectPerGrit: 'damage',       // Quill: reflected damage scaled by Grit
  // everything else — unlocks, rank-1
  footingAccrualPct: 'other',     // Set Stance / Measured Breath: settle faster
  footingGritBonus: 'other',      // Weight: more Grit per stack
  armorGrit: 'other',             // Calcify
  armorVit: 'other',              // Calcify
};

// A skill is "damaging" if any step deals damage. Used by the tier-1 assertion
// and by the anti-softlock floor, so both read the same definition.
const DAMAGING_KINDS = new Set(['strike', 'bolt', 'cone', 'line', 'hazard', 'drain', 'plague']);
export function isDamaging(skill) {
  return skill.type === 'active' && (skill.compose || []).some(s => DAMAGING_KINDS.has(s.kind) && s.damage > 0);
}

// ---------------------------------------------------------------- loadout

// Slot unlocks by level. 8 is the hard ceiling.
export const SLOT_LEVELS = [1, 5, 12, 21, 31, 42, 54, 66];
export function slotsAtLevel(level) {
  let n = 0;
  for (const lv of SLOT_LEVELS) if (level >= lv) n++;
  return n;
}

// ---------------------------------------------------------------- ranks

// Rank is the number of points spent. Note this means rank 1 already carries
// one increment (base x 1.04), because the spec's formula is `1 + inc * rank`
// rather than `1 + inc * (rank - 1)`. Followed as written; flagged in the
// report because it means base damage is a number no rank ever deals.
export function skillRank(p, id) { return (p.skillRanks && p.skillRanks[id]) || 0; }

export function canLearn(p, skill) {
  if (!skill) return false;
  if (!(TREES_BY_CLASS[p.charId] || []).includes(skill.tree)) return false;
  // maxRank ENFORCED HERE, not merely declared. A cap that only exists in a
  // data file and a load assertion is a label; the spend path is where it has
  // to bite, or a rank-1-only passive is still rankable at a level-up screen.
  // Same lesson as the Footing stack cap: the clamp belongs in the engine.
  if (skill.maxRank !== undefined && skillRank(p, skill.id) >= skill.maxRank) return false;
  if (!skill.prereq) return true;
  return skillRank(p, skill.prereq) >= 1;
}

// ---------------------------------------------------------------- assertions
//
// These run once, at import. They throw — a tree that violates one of them is
// not a warning to be triaged later, it is a build that cannot answer the gate
// question, and it should fail before a fight starts rather than during one.

function assertTrees() {
  const problems = [];

  for (const tree of Object.values(TREES)) {
    const byTier = [...tree.skills].sort((a, b) => a.tier - b.tier);

    // 6.3: every tree's tier-1 node is a damaging active — the opening pick
    const t1 = byTier.filter(s => s.tier === 1);
    if (t1.length !== 1) problems.push(`${tree.id}: ${t1.length} tier-1 nodes, want exactly 1`);
    else if (!isDamaging(t1[0])) problems.push(`${tree.id}: tier-1 node ${t1[0].id} is not a damaging active — a character's first point must buy something that kills`);

    const ids = new Set(tree.skills.map(s => s.id));
    for (const s of tree.skills) {
      if (!isDomain(s.domain)) problems.push(`${s.id}: domain ${JSON.stringify(s.domain)} is not one of physical/mental/spiritual`);
      if (s.prereq && !ids.has(s.prereq)) problems.push(`${s.id}: prereq ${s.prereq} is not in tree ${tree.id} — cross-tree prerequisites are not allowed`);
      if (s.prereq === s.id) problems.push(`${s.id}: prereq points at itself`);

      if (s.type === 'active') {
        const tg = s.trigger;
        if (!tg || !TRIGGER_KINDS.includes(tg.kind)) {
          problems.push(`${s.id}: trigger kind ${JSON.stringify(tg && tg.kind)} is not one of ${TRIGGER_KINDS.join('/')}`);
        } else {
          // a missing param reads as undefined and the skill silently never
          // fires — exactly the "wired to nothing" failure this file exists for
          for (const k of TRIGGER_PARAMS[tg.kind]) {
            if (tg[k] === undefined || tg[k] === null) problems.push(`${s.id}: ${tg.kind} needs param "${k}"`);
          }
        }
        if (!(s.cooldown > 0)) problems.push(`${s.id}: active with no cooldown`);
        if (!s.compose || !s.compose.length) problems.push(`${s.id}: active with an empty compose`);
        for (const step of s.compose || []) {
          if (!PRIMITIVE_KINDS.includes(step.kind)) problems.push(`${s.id}: unknown primitive "${step.kind}"`);
          const allowed = RIDERS_BY_PRIMITIVE[step.kind] || [];
          for (const r of Object.keys(step.riders || {})) {
            if (!allowed.includes(r)) problems.push(`${s.id}: rider "${r}" is not valid on ${step.kind}`);
          }
        }
      } else if (s.type !== 'passive') {
        problems.push(`${s.id}: type ${JSON.stringify(s.type)} is neither active nor passive`);
      }

      // A PASSIVE THAT GRANTS NEITHER DAMAGE NOR DURATION IS AN UNLOCK, NOT AN
      // INVESTMENT — a design ruling for the whole game, not a Samurai patch.
      // Such a passive must declare `maxRank: 1`.
      //
      // Classified by PASSIVE KEY, from the registry above. The first version
      // of this check read s.compose, which is empty for every passive by
      // definition, so it flagged all six — including Held Edge, whose whole
      // purpose is to scale damage. A check that cannot distinguish the case it
      // exists to permit is a check that will be deleted the first time it is
      // inconvenient.
      if (s.type === 'passive') {
        const keys = Object.keys(s.passive || {});
        if (!keys.length) problems.push(`${s.id}: passive with no passive block — it grants nothing at any rank`);
        const unknown = keys.filter(k => !(k in PASSIVE_EFFECT));
        if (unknown.length) {
          problems.push(`${s.id}: passive key(s) ${unknown.join(', ')} are not in PASSIVE_EFFECT — classify them as 'damage', 'duration' or 'other' so the rank-1 rule can be applied rather than guessed`);
        }
        const buysScaling = keys.some(k => PASSIVE_EFFECT[k] === 'damage' || PASSIVE_EFFECT[k] === 'duration');
        if (!buysScaling && s.maxRank !== 1) {
          problems.push(`${s.id}: passive grants only ${keys.map(k => `${k} (${PASSIVE_EFFECT[k] || '?'})`).join(', ')} — neither damage nor duration, so a second point buys nothing. Declare maxRank: 1; it is an unlock, not an investment`);
        }
        if (buysScaling && s.maxRank === 1) {
          problems.push(`${s.id}: passive grants damage/duration scaling but is capped at maxRank 1 — either it is an investment or it is not`);
        }
      }
      if (s.maxRank !== undefined && !(s.maxRank >= 1 && Number.isInteger(s.maxRank))) {
        problems.push(`${s.id}: maxRank ${s.maxRank} must be a positive integer`);
      }

      // 6.1: ranks are linear. A skill declaring a multiplicative rank block
      // would compound, which is explosive at rank 40.
      if (s.ranks) {
        for (const [k, v] of Object.entries(s.ranks)) {
          if (!(typeof v === 'number' && v >= 0 && v < 1)) problems.push(`${s.id}: rank increment ${k}=${v} must be a fraction of base in [0,1) — a value >= 1 reads as a multiplier and would compound`);
        }
        for (const k of Object.keys(s.ranks)) {
          if (k !== 'damage' && k !== 'duration') problems.push(`${s.id}: ranks may scale damage and duration only, not "${k}"`);
        }
      }
    }

    // linear prerequisite chain: every tier above 1 hangs off the one below
    for (const s of byTier) {
      if (s.tier === 1) continue;
      const pre = SKILL_BY_ID[s.prereq];
      if (!pre) problems.push(`${s.id}: tier ${s.tier} with no prerequisite`);
      else if (pre.tier !== s.tier - 1) problems.push(`${s.id}: prereq ${pre.id} is tier ${pre.tier}, want ${s.tier - 1}`);
    }
  }

  if (problems.length) {
    throw new Error(`skill definitions failed ${problems.length} load assertion(s):\n  - ${problems.join('\n  - ')}`);
  }
}

assertTrees();

export const SKILL_LOAD_OK = true;
