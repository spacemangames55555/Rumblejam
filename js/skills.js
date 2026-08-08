// SKILL REGISTRY, PROGRESSION, LOADOUT — and the assertions that run at load.
//
// The source project shipped 19 skill kinds wired to nothing, plus stance
// multipliers and a resource generator that were never read. All silently, all
// passing whatever tests existed. With 420 skills eventually, that failure mode
// is guaranteed unless it is engineered against from the first patch, so the
// checks here run at import time and throw rather than warn.

import { NECRO_DARK_MATTER, TUNING as NECRO_TUNING } from './content/skills/necro_dark_matter.js';
import { WIZARD_ATTUNEMENT, TUNING as WIZ_ATT_TUNING } from './content/skills/wizard_attunement.js';
import { WIZARD_ARCANA, TUNING as WIZ_ARC_TUNING } from './content/skills/wizard_arcana.js';
import { PRIEST_JUDGMENT, TUNING as PRI_JUD_TUNING } from './content/skills/priest_judgment.js';
import { PRIEST_GRACE, TUNING as PRI_GRA_TUNING } from './content/skills/priest_grace.js';
import { SAMURAI_ARMOR, TUNING as SAMURAI_TUNING } from './content/skills/samurai_armor.js';
import { NECRO_MARROW, TUNING as MARROW_TUNING } from './content/skills/necro_marrow.js';
import { SAMURAI_TACTICS, TUNING as TACTICS_TUNING } from './content/skills/samurai_tactics.js';
import { NECRO_SUMMONS, TUNING as SUMMONS_TUNING } from './content/skills/necro_summons.js';
import { DRUID_BEASTS, TUNING as BEASTS_TUNING } from './content/skills/druid_beasts.js';
import { TRIGGER_KINDS, TRIGGER_PARAMS } from './triggers.js';
import { PRIMITIVE_KINDS, RIDERS_BY_PRIMITIVE } from './compose.js';
import { isDomain } from './domains.js';
import { SELECT_KINDS } from './selectors.js';
import { MOVE_KINDS } from './minions.js';

export const TREES = {
  necro_dark_matter: { id: 'necro_dark_matter', name: 'Dark Matter', classId: 'toh_necromancer', skills: NECRO_DARK_MATTER, tuning: NECRO_TUNING },
  wizard_attunement: { id: 'wizard_attunement', name: 'Attunement', classId: 'toh_wizard', skills: WIZARD_ATTUNEMENT, tuning: WIZ_ATT_TUNING },
  wizard_arcana: { id: 'wizard_arcana', name: 'Arcana', classId: 'toh_wizard', skills: WIZARD_ARCANA, tuning: WIZ_ARC_TUNING },
  priest_judgment: { id: 'priest_judgment', name: 'Judgment', classId: 'toh_priest', skills: PRIEST_JUDGMENT, tuning: PRI_JUD_TUNING },
  priest_grace: { id: 'priest_grace', name: 'Grace', classId: 'toh_priest', skills: PRIEST_GRACE, tuning: PRI_GRA_TUNING },
  samurai_armor: { id: 'samurai_armor', name: 'Armor', classId: 'toh_samurai', skills: SAMURAI_ARMOR, tuning: SAMURAI_TUNING },
  necro_marrow: { id: 'necro_marrow', name: 'Marrow', classId: 'toh_necromancer', skills: NECRO_MARROW, tuning: MARROW_TUNING },
  samurai_tactics: { id: 'samurai_tactics', name: 'Tactics', classId: 'toh_samurai', skills: SAMURAI_TACTICS, tuning: TACTICS_TUNING },
  necro_summons: { id: 'necro_summons', name: 'Summons', classId: 'toh_necromancer', skills: NECRO_SUMMONS, tuning: SUMMONS_TUNING },
  druid_beasts: { id: 'druid_beasts', name: 'Tapestry of Beasts', classId: 'toh_druid', skills: DRUID_BEASTS, tuning: BEASTS_TUNING },
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
  armorGrit: 'other',             // Calcify, Bone Plate
  armorVit: 'other',              // Calcify, Bone Plate
  packDamageBonus: 'damage',      // Pack Bond: more damage per standing animal
  shiftDamageBonus: 'damage',     // Sympathetic Resonance: more per attunement banked
  marksDamageBonus: 'damage',     // Attend the Fallen: more per mark standing
};

// WHAT A RANK MAY BUY BESIDES DAMAGE AND DURATION — the whole list, and the
// skill allowed to claim each entry.
//
// Ranks buy damage or duration. That is the rule everywhere else in the game,
// and `ranks` is asserted below to contain nothing but those two keys. Raise
// Skeleton is the single exception: its rank buys a SUMMON SLOT, which is a
// structural quantity rather than a magnitude.
//
// The registry is a two-way lock. A skill declaring `rankGrants` must be the
// registered owner of that grant, and a registered grant must be claimed by a
// skill that exists — so a second skill cannot pick up `summonSlots` by
// copy-paste, and the owner cannot quietly drop it either. Adding a third
// exception means editing this table on purpose.
//
// It exists because the UNSTATED version of this rule has already failed once.
// Set Stance declared a rankable `footingMaxBonus`; nothing asserted that a
// rank may not raise a hard cap; and a designed ten Footing stacks measured as
// seventeen, inflating every per-stack term derived from it. That was a rank
// buying a structural quantity with no registry to stop it.
export const RANK_GRANTS = {
  summonSlots: 'necro_raise_skeleton',
};

// WHO CAN SEE A SOUL TOKEN (§8.5 row 2). Tokens are state and ride the
// snapshot for everyone — losing one would desync a Necromancer's fire — but
// they RENDER per-player, and only for a class that can actually read them.
//
// Derived from tree data rather than named, exactly like selectability: any
// class with an ON_TOKEN skill sees them. §8.5 says "visible only to
// Necromancers" because the Necromancer is the only such class today; when the
// Wizard's Soul tree lands it inherits the visibility with no code change,
// which a hardcoded class id would not have given it.
const TOKEN_READERS = new Set(
  ALL_SKILLS.filter(s => s.trigger && s.trigger.kind === 'ON_TOKEN')
    .map(s => TREES[s.tree] && TREES[s.tree].classId).filter(Boolean));
export function readsTokens(charId) { return TOKEN_READERS.has(charId); }

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

// A summon step, checked to the same standard as a trigger's params. A minion
// with an undefined `move` or a malformed attack is the summon-shaped version
// of "wired to nothing": it spawns, stands there, and looks like a balance
// problem rather than a missing field.
//
// The attack is validated as what it is — a compose step in its own right —
// against the same primitive and rider tables the outer step uses. That is the
// check that keeps a minion's attack inside the schema instead of beside it.
function summonStepProblems(s, step) {
  const out = [];
  if (!step.archetype) out.push(`${s.id}: summon step with no archetype name`);
  if (!MOVE_KINDS.includes(step.move)) {
    out.push(`${s.id}: summon move ${JSON.stringify(step.move)} is not one of ${MOVE_KINDS.join('/')}`);
  }
  for (const k of ['hp', 'radius', 'spawnRadius', 'attackCd']) {
    if (!(step[k] > 0)) out.push(`${s.id}: summon step needs a positive "${k}"`);
  }
  if (step.slotted === undefined) out.push(`${s.id}: summon step must declare "slotted" — whether it occupies a summon slot or is a timed extra`);
  // EVERY SUMMON MUST BE BOUNDED BY SOMETHING. Three bounds are legitimate and
  // they express three different engines: a slot (Necromancer capacity, bought
  // by rank), a `maxAlive` ceiling (Druid pack, one per animal skill), or a
  // duration (a timed extra). A summon with none of them accumulates for the
  // length of the run.
  if (!step.slotted && !(step.maxAlive > 0) && !(step.duration > 0)) {
    out.push(`${s.id}: summon step is unbounded — it needs a slot, a maxAlive ceiling or a duration, or it accumulates without limit`);
  }
  // A DELIVERED SUMMON NEEDS A PLACE TO BE DELIVERED TO, and the only thing
  // that produces one is the ON_TOKEN trigger spending a token. Declaring
  // `deliver` on a summon with any other trigger would give the primitive a
  // null position and it would silently never spawn — the wired-to-nothing
  // shape, in the one skill whose whole point is that the token is a place.
  if (step.deliver) {
    if (!(step.deliver.speed > 0)) out.push(`${s.id}: deliver needs a positive speed`);
    if (!(step.deliver.radius > 0)) out.push(`${s.id}: deliver needs a positive radius`);
    if (!s.trigger || s.trigger.kind !== 'ON_TOKEN') {
      out.push(`${s.id}: summon declares "deliver" but its trigger is ${JSON.stringify(s.trigger && s.trigger.kind)} — only ON_TOKEN produces a place to deliver to, so this would spawn nothing, ever`);
    }
  }
  if (step.maxAlive !== undefined && !(step.maxAlive >= 1 && Number.isInteger(step.maxAlive))) {
    out.push(`${s.id}: summon maxAlive ${step.maxAlive} must be a positive integer — omit it for "as many as slots allow"`);
  }
  if (step.revives && !(step.reviveBase > 0)) {
    out.push(`${s.id}: summon revives but declares no reviveBase — the revive would be instant`);
  }
  const a = step.attack;
  if (!a) { out.push(`${s.id}: summon step has no attack — it would stand on the field and do nothing`); return out; }
  if (!PRIMITIVE_KINDS.includes(a.kind)) out.push(`${s.id}: summon attack uses unknown primitive "${a.kind}"`);
  if (a.kind === 'summon') out.push(`${s.id}: a summon's attack may not be another summon — minions do not raise minions`);
  if (!SELECT_KINDS.includes(a.select)) {
    out.push(`${s.id}: summon attack select ${JSON.stringify(a.select)} is not one of ${SELECT_KINDS.join('/')} — the minion picks its own target and needs its own rule`);
  }
  if (!(a.damage > 0)) out.push(`${s.id}: summon attack deals no damage`);
  const allowed = RIDERS_BY_PRIMITIVE[a.kind] || [];
  for (const r of Object.keys(a.riders || {})) {
    if (!allowed.includes(r)) out.push(`${s.id}: summon attack rider "${r}" is not valid on ${a.kind}`);
  }
  return out;
}

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
      if (s.type !== 'active' && s.select) problems.push(`${s.id}: passive declares select ${JSON.stringify(s.select)} — a passive hits nothing`);

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
        // REQUIRED, NEVER DEFAULTED. `select` is what the skill hits; the
        // trigger is only when it fires. Defaulting a missing one to 'nearest'
        // would silently reproduce §15 defect #13 on every skill anyone forgot
        // — which is precisely how the bug existed in the first place, as an
        // unwritten universal default nobody had to opt into.
        if (!s.select) {
          problems.push(`${s.id}: active with no "select" — declare what it hits, one of ${SELECT_KINDS.join('/')}. `
            + 'There is no default: "nearest" is a choice like any other and has to be made.');
        } else if (!SELECT_KINDS.includes(s.select)) {
          problems.push(`${s.id}: select ${JSON.stringify(s.select)} is not one of ${SELECT_KINDS.join('/')}`);
        }
        if (!(s.cooldown > 0)) problems.push(`${s.id}: active with no cooldown`);
        if (!s.compose || !s.compose.length) problems.push(`${s.id}: active with an empty compose`);
        for (const step of s.compose || []) {
          if (!PRIMITIVE_KINDS.includes(step.kind)) problems.push(`${s.id}: unknown primitive "${step.kind}"`);
          const allowed = RIDERS_BY_PRIMITIVE[step.kind] || [];
          for (const r of Object.keys(step.riders || {})) {
            if (!allowed.includes(r)) problems.push(`${s.id}: rider "${r}" is not valid on ${step.kind}`);
          }
          if (step.kind === 'summon') problems.push(...summonStepProblems(s, step));
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

      // THE rankGrants LOCK. See RANK_GRANTS above for why this is a registry
      // rather than a rule: a rank that buys a structural quantity has already
      // breached a hard cap once when it was merely a convention.
      if (s.rankGrants !== undefined) {
        if (!(s.rankGrants in RANK_GRANTS)) {
          problems.push(`${s.id}: rankGrants ${JSON.stringify(s.rankGrants)} is not in RANK_GRANTS — a rank buys damage or duration unless this table says otherwise, and adding an entry is a design decision, not a data change`);
        } else if (RANK_GRANTS[s.rankGrants] !== s.id) {
          problems.push(`${s.id}: rankGrants "${s.rankGrants}" is registered to ${RANK_GRANTS[s.rankGrants]}, not to this skill — exactly one skill may grant it`);
        }
        if (!(s.rankGrantPer > 0)) problems.push(`${s.id}: declares rankGrants but no positive rankGrantPer — a rank would grant nothing`);
        if (s.type !== 'active') problems.push(`${s.id}: rankGrants on a ${s.type} — a grant this structural belongs on the skill that uses it`);
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

  // The other half of the lock: every registered grant must be claimed. A
  // registry entry pointing at a skill that no longer declares it would leave
  // the exception open with nothing standing in it.
  for (const [grant, ownerId] of Object.entries(RANK_GRANTS)) {
    const owner = ALL_SKILLS.find(s => s.id === ownerId);
    if (!owner) problems.push(`RANK_GRANTS.${grant} names ${ownerId}, which is not a skill in any tree`);
    else if (owner.rankGrants !== grant) problems.push(`RANK_GRANTS.${grant} names ${ownerId}, but that skill declares rankGrants ${JSON.stringify(owner.rankGrants)} — the registry and the skill must agree`);
  }
  const claimants = ALL_SKILLS.filter(s => s.rankGrants !== undefined).map(s => s.id);
  if (claimants.length > Object.keys(RANK_GRANTS).length) {
    problems.push(`${claimants.length} skills declare rankGrants (${claimants.join(', ')}) but RANK_GRANTS has ${Object.keys(RANK_GRANTS).length} entries`);
  }

  if (problems.length) {
    throw new Error(`skill definitions failed ${problems.length} load assertion(s):\n  - ${problems.join('\n  - ')}`);
  }
}

assertTrees();

export const SKILL_LOAD_OK = true;
