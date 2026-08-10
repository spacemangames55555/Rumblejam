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
import { BARD_CADENCE, TUNING as BARD_CAD_TUNING } from './content/skills/bard_cadence.js';
import { BARD_ENSEMBLE, TUNING as BARD_ENS_TUNING } from './content/skills/bard_ensemble.js';
import { MAGE_CRYSTALBLADE, TUNING as MAGE_CRY_TUNING } from './content/skills/mage_crystalblade.js';
import { MAGE_COLLAPSE, TUNING as MAGE_COL_TUNING } from './content/skills/mage_collapse.js';
import { WD_EFFIGY, TUNING as WD_EFF_TUNING } from './content/skills/wd_effigy.js';
import { WD_BLIGHT, TUNING as WD_BLI_TUNING } from './content/skills/wd_blight.js';
import { SUN_TIDEWRACK, TUNING as SUN_TID_TUNING } from './content/skills/sun_tidewrack.js';
import { SUN_REEF, TUNING as SUN_REEF_TUNING } from './content/skills/sun_reef.js';
import { ASN_KILLBOX, TUNING as ASN_KB_TUNING } from './content/skills/asn_killbox.js';
import { ASN_SHADOW, TUNING as ASN_SH_TUNING } from './content/skills/asn_shadow.js';
import { HUN_LONGSHOT, TUNING as HUN_LS_TUNING } from './content/skills/hun_longshot.js';
import { HUN_HOUNDMASTER, TUNING as HUN_HM_TUNING } from './content/skills/hun_houndmaster.js';
import { MONK_CHI, TUNING as MONK_CHI_TUNING } from './content/skills/monk_chi.js';
import { MONK_STONEGARDEN, TUNING as MONK_SG_TUNING } from './content/skills/monk_stonegarden.js';
import { SAV_PRIMAL_FURY, TUNING as SAV_PF_TUNING } from './content/skills/sav_primal_fury.js';
import { SAV_BLOODBOUND, TUNING as SAV_BB_TUNING } from './content/skills/sav_bloodbound.js';
import { SMITH_CRYSTAL, TUNING as SMITH_CR_TUNING } from './content/skills/smith_crystal.js';
import { SMITH_FORGE, TUNING as SMITH_FG_TUNING } from './content/skills/smith_forge.js';
import { SAMURAI_ARMOR, TUNING as SAMURAI_TUNING } from './content/skills/samurai_armor.js';
import { NECRO_MARROW, TUNING as MARROW_TUNING } from './content/skills/necro_marrow.js';
import { SAMURAI_TACTICS, TUNING as TACTICS_TUNING } from './content/skills/samurai_tactics.js';
import { SAMURAI_AGILITY, TUNING as AGILITY_TUNING } from './content/skills/samurai_agility.js';
import { BARD_REQUIEM, TUNING as BARD_REQ_TUNING } from './content/skills/bard_requiem.js';
import { MAGE_REFRACTION, TUNING as MAGE_REF_TUNING } from './content/skills/mage_refraction.js';
import { DRUID_WILDKIN, TUNING as DRUID_WK_TUNING } from './content/skills/druid_wildkin.js';
import { ASN_RANGE, TUNING as ASN_RANGE_TUNING } from './content/skills/asn_range.js';
import { NECRO_SUMMONS, TUNING as SUMMONS_TUNING } from './content/skills/necro_summons.js';
import { DRUID_BEASTS, TUNING as BEASTS_TUNING } from './content/skills/druid_beasts.js';
import { TRIGGER_KINDS, TRIGGER_PARAMS, SPATIAL_TRIGGERS, TRIGGER_FROM } from './triggers.js';
import { PRIMITIVE_KINDS, RIDERS_BY_PRIMITIVE, PRIMITIVE_SELECTS, stepPicksTarget } from './compose.js';
import { isDomain } from './domains.js';
import { SELECT_KINDS } from './selectors.js';
import { MOVE_KINDS } from './minions.js';

export const TREES = {
  necro_dark_matter: { id: 'necro_dark_matter', name: 'Dark Matter', classId: 'toh_necromancer', skills: NECRO_DARK_MATTER, tuning: NECRO_TUNING },
  wizard_attunement: { id: 'wizard_attunement', name: 'Attunement', classId: 'toh_wizard', skills: WIZARD_ATTUNEMENT, tuning: WIZ_ATT_TUNING },
  wizard_arcana: { id: 'wizard_arcana', name: 'Arcana', classId: 'toh_wizard', skills: WIZARD_ARCANA, tuning: WIZ_ARC_TUNING },
  priest_judgment: { id: 'priest_judgment', name: 'Judgment', classId: 'toh_priest', skills: PRIEST_JUDGMENT, tuning: PRI_JUD_TUNING },
  priest_grace: { id: 'priest_grace', name: 'Grace', classId: 'toh_priest', skills: PRIEST_GRACE, tuning: PRI_GRA_TUNING },
  bard_cadence: { id: 'bard_cadence', name: 'Cadence', classId: 'toh_bard', skills: BARD_CADENCE, tuning: BARD_CAD_TUNING },
  bard_ensemble: { id: 'bard_ensemble', name: 'Ensemble', classId: 'toh_bard', skills: BARD_ENSEMBLE, tuning: BARD_ENS_TUNING },
  mage_crystalblade: { id: 'mage_crystalblade', name: 'Crystalblade', classId: 'toh_mage', skills: MAGE_CRYSTALBLADE, tuning: MAGE_CRY_TUNING },
  mage_collapse: { id: 'mage_collapse', name: 'Collapse', classId: 'toh_mage', skills: MAGE_COLLAPSE, tuning: MAGE_COL_TUNING },
  wd_effigy: { id: 'wd_effigy', name: 'Effigy', classId: 'toh_witch_doctor', skills: WD_EFFIGY, tuning: WD_EFF_TUNING },
  wd_blight: { id: 'wd_blight', name: 'Blight', classId: 'toh_witch_doctor', skills: WD_BLIGHT, tuning: WD_BLI_TUNING },
  sun_tidewrack: { id: 'sun_tidewrack', name: 'Tidewrack', classId: 'toh_sundian', skills: SUN_TIDEWRACK, tuning: SUN_TID_TUNING },
  sun_reef: { id: 'sun_reef', name: 'Reef', classId: 'toh_sundian', skills: SUN_REEF, tuning: SUN_REEF_TUNING },
  asn_killbox: { id: 'asn_killbox', name: 'Killbox', classId: 'toh_assassin', skills: ASN_KILLBOX, tuning: ASN_KB_TUNING },
  asn_shadow: { id: 'asn_shadow', name: 'Shadow', classId: 'toh_assassin', skills: ASN_SHADOW, tuning: ASN_SH_TUNING },
  hun_longshot: { id: 'hun_longshot', name: 'Longshot', classId: 'toh_hunter', skills: HUN_LONGSHOT, tuning: HUN_LS_TUNING },
  hun_houndmaster: { id: 'hun_houndmaster', name: 'Houndmaster', classId: 'toh_hunter', skills: HUN_HOUNDMASTER, tuning: HUN_HM_TUNING },
  monk_chi: { id: 'monk_chi', name: 'Chi', classId: 'toh_monk', skills: MONK_CHI, tuning: MONK_CHI_TUNING },
  monk_stonegarden: { id: 'monk_stonegarden', name: 'Stone Garden', classId: 'toh_monk', skills: MONK_STONEGARDEN, tuning: MONK_SG_TUNING },
  sav_primal_fury: { id: 'sav_primal_fury', name: 'Primal Fury', classId: 'toh_savage', skills: SAV_PRIMAL_FURY, tuning: SAV_PF_TUNING },
  sav_bloodbound: { id: 'sav_bloodbound', name: 'Bloodbound', classId: 'toh_savage', skills: SAV_BLOODBOUND, tuning: SAV_BB_TUNING },
  smith_crystal: { id: 'smith_crystal', name: 'Crystal', classId: 'toh_blacksmith', skills: SMITH_CRYSTAL, tuning: SMITH_CR_TUNING },
  smith_forge: { id: 'smith_forge', name: 'Forge', classId: 'toh_blacksmith', skills: SMITH_FORGE, tuning: SMITH_FG_TUNING },
  samurai_armor: { id: 'samurai_armor', name: 'Armor', classId: 'toh_samurai', skills: SAMURAI_ARMOR, tuning: SAMURAI_TUNING },
  necro_marrow: { id: 'necro_marrow', name: 'Marrow', classId: 'toh_necromancer', skills: NECRO_MARROW, tuning: MARROW_TUNING },
  samurai_tactics: { id: 'samurai_tactics', name: 'Tactics', classId: 'toh_samurai', skills: SAMURAI_TACTICS, tuning: TACTICS_TUNING },
  samurai_agility: { id: 'samurai_agility', name: 'Agility', classId: 'toh_samurai', skills: SAMURAI_AGILITY, tuning: AGILITY_TUNING },
  bard_requiem: { id: 'bard_requiem', name: 'Requiem', classId: 'toh_bard', skills: BARD_REQUIEM, tuning: BARD_REQ_TUNING },
  mage_refraction: { id: 'mage_refraction', name: 'Refraction', classId: 'toh_mage', skills: MAGE_REFRACTION, tuning: MAGE_REF_TUNING },
  druid_wildkin: { id: 'druid_wildkin', name: 'Wild Kin', classId: 'toh_druid', skills: DRUID_WILDKIN, tuning: DRUID_WK_TUNING },
  asn_range: { id: 'asn_range', name: 'Range', classId: 'toh_assassin', skills: ASN_RANGE, tuning: ASN_RANGE_TUNING },
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
  rhythmDamageBonus: 'damage',    // Perfect Time: more per stack held
  crystalDamageBonus: 'damage',   // Lattice: more per crystal carried
  dollDamageBonus: 'damage',      // Sympathetic Binding: more per point banked in the doll
  drenchDamageBonus: 'damage',    // Tidemark: more per drench stack standing
  killboxDamageBonus: 'damage',   // Dead Ground: more per trap set
  spreadDamageBonus: 'damage',    // Long Leash: more per span between you and the beast
  chiDamageBonus: 'damage',       // Still Water: more per point of Chi held
  cascadeDamageBonus: 'damage',   // Red Memory: more per rank banked in the cascade
  formDamageBonus: 'damage',      // Facet: more while a crystal form holds
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
// §8.1's shape spec. Ten nodes per tree, thirty across a character's three,
// against a run's measured ~69 skill points — see the assertion in
// assertTrees() for why this is a budget and not a house style.
export const TREE_NODES = 10;

// §8.1.1 — WHAT CHARACTER LEVEL EACH TIER UNLOCKS AT.
//
// The Diablo 2 model, ruled in: tiers unlock by LEVEL, nodes unlock by
// PREREQUISITE, and points spread freely across a character's three trees.
// There is deliberately no points-spent-in-tree requirement — that is WoW's
// mechanism and it exists to force specialisation, which this game does not
// want.
//
// Measured, not guessed: full runs to victory for all fourteen classes end at
// level 68-70, passing ~21 at the end of floor 1, ~35 at floor 2 and ~52 at
// floor 3. The first six gates land within a level or two of D2's own shape
// (its 6/12/18/24/30 of 99 is 6-30% of the cap, which against 69 is
// 4/8/12/17/21); the top four depart from it on purpose so the capstone lands
// in floor 4 rather than at the halfway point.
//
// TIER IS A GATE, NOT A DEPTH. A tree may skip tiers — see samurai_agility,
// which spends ten nodes on six of these ten gates so two branches can run in
// parallel. Ten nodes across ten DENSE tiers is one node per tier, which is a
// chain: sparse tiers are what make the shape spec and this table compatible.
export const TIER_LEVELS = [1, 3, 6, 10, 15, 21, 28, 36, 48, 60];
export function tierLevel(tier) { return TIER_LEVELS[tier - 1]; }

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
  // §8.1.1's TIER GATE, enforced here rather than merely tabled. Diablo 2's
  // model has two locks and this is the first: a tier opens at a character
  // level. The second is the prereq below. There is no third — no points-spent
  // requirement — so a player may spread across all three trees freely.
  //
  // Ranking a skill you already own is NOT re-gated: the tier bought the node,
  // and a rank is an investment in something already unlocked.
  if (skillRank(p, skill.id) < 1 && (p.level || 1) < tierLevel(skill.tier)) return false;
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

  // The derived selector table must not be empty or all-true: either would mean
  // `Function.prototype.toString` stopped returning source (a minifier in the
  // chain) and every `self` assertion below would be classifying blind.
  {
    const yes = Object.values(PRIMITIVE_SELECTS).filter(Boolean).length;
    if (yes === 0 || yes === PRIMITIVE_KINDS.length) {
      problems.push(`PRIMITIVE_SELECTS classified ${yes}/${PRIMITIVE_KINDS.length} primitives as target-picking — it is derived from function source, so an all-or-nothing split means the source is no longer readable and the "self" rule is unenforced`);
    }
  }

  // IDS ARE UNIQUE ACROSS EVERY TREE, and nothing checked it until a class had
  // three trees to collide within.
  //
  // `SKILL_BY_ID` is built with Object.fromEntries, so a repeated id silently
  // KEEPS THE LAST and drops the first — and that map is what resolves every
  // prereq, every loadout slot and every fire. A duplicate does not throw
  // anywhere: it shadows a real skill, so one node's prereq chain quietly points
  // at a different tree's node and the shadowed skill can never be fired.
  //
  // It was found by authoring two third trees at once: `bard_finale` collided
  // with bard_ensemble and `mage_inclusion` with mage_crystalblade, because a
  // third tree draws on the same vocabulary the first two already used.
  // `ALL_SKILLS` read 310 while `SKILL_BY_ID` held 308 — the count of the defect
  // was visible and nothing was looking at it. With eleven more trees to author
  // against the same class vocabularies, this is a certainty rather than a risk.
  {
    const owner = {};
    for (const tree of Object.values(TREES)) {
      for (const s of tree.skills) {
        if (owner[s.id]) problems.push(`duplicate skill id "${s.id}" in ${owner[s.id]} and ${tree.id} — SKILL_BY_ID keeps the LAST, so the other is shadowed: unreachable by prereq, by loadout and by fire`);
        else owner[s.id] = tree.id;
      }
    }
    if (ALL_SKILLS.length !== Object.keys(SKILL_BY_ID).length) {
      problems.push(`${ALL_SKILLS.length} skills but ${Object.keys(SKILL_BY_ID).length} unique ids — the difference is silently shadowed content`);
    }
  }

  // Every form name any `form` step enters, DERIVED rather than restated — a
  // hand-written list here would go stale the moment a fourth form is authored,
  // which is §13 rule 12 and the same reason CLASS_OF in skill_sweep is derived.
  const FORM_NAMES = new Set();
  for (const tree of Object.values(TREES)) {
    for (const s of tree.skills) {
      for (const c of s.compose || []) if (c.kind === 'form' && c.form) FORM_NAMES.add(c.form);
    }
  }

  for (const tree of Object.values(TREES)) {
    const byTier = [...tree.skills].sort((a, b) => a.tier - b.tier);

    // §8.1's SHAPE SPEC: ten nodes, and the number is a budget rather than a
    // preference. A run banks ~69 skill points (measured, all fourteen classes,
    // full runs to victory). Three trees at ten nodes costs 30 points to unlock
    // everything and leaves 39 for ranks — which is the two-skills-at-twenty
    // shape the design wants, since 270 of 280 skills are rank-uncapped and
    // ranks are the only real sink.
    //
    // The arithmetic is why this is asserted rather than left to taste. At
    // FOURTEEN nodes a tree, unlocks cost 42 of 69 and the rank budget drops to
    // 27 — the build stops being a choice about depth and becomes a checklist.
    // Branching makes a wider tree cheap to author and there is nothing else in
    // the codebase that would notice, so the ceiling has to be stated where a
    // tree is loaded.
    if (tree.skills.length !== TREE_NODES) {
      problems.push(`${tree.id}: ${tree.skills.length} nodes, want exactly ${TREE_NODES} — §8.1's shape spec is a POINT BUDGET, `
        + `not a house style: three trees at ${TREE_NODES} spend ${TREE_NODES * 3} of a run's ~69 points on unlocks and leave the rest for ranks`);
    }

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

      // `self` MEANS THE SKILL PICKS NOTHING, AND IT IS CHECKED BOTH WAYS.
      //
      // §5.3: `select` is what a skill hits. Six of the fourteen primitives
      // never consult it — shield, ward, form, shift, heal and summon write the
      // caster, the party or the field and have no target to choose. Those
      // skills used to declare `nearest` and ignore it, which read as a real
      // targeting rule in the data and was not one.
      //
      // With `self` in the vocabulary the rule becomes assertable in both
      // directions, which is the point of adding it: a skill that picks nothing
      // must SAY it picks nothing, and a skill that picks something must not
      // claim otherwise. The second half is the one that catches real damage —
      // a `self` on a strike would make `facing()` aim at nobody.
      if (s.type === 'active' && Array.isArray(s.compose)) {
        const picks = s.compose.filter(c => stepPicksTarget(c.kind));
        if (picks.length && s.select === 'self') {
          problems.push(`${s.id}: declares select "self" but its ${picks.map(c => c.kind).join('/')} step(s) DO consult a selector — a self selector resolves to no enemy, so those steps would aim at nothing`);
        }
        if (!picks.length && s.compose.length && s.select !== 'self') {
          problems.push(`${s.id}: declares select ${JSON.stringify(s.select)} but every step (${s.compose.map(c => c.kind).join('/')}) ignores the selector — it hits the caster, so it must declare "self" rather than name a targeting rule it does not use`);
        }
      }

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
          // §8.3, the Hunter's two bodies: a skill may declare where its trigger
          // LOOKS FROM. Refused on the five event-shaped kinds, which read player
          // state — a kill counter, a hit counter, a dodge timestamp, own HP, own
          // movement — and have no position for a pet to stand in. A `from` that
          // silently did nothing would read as a skill behaving normally.
          if (s.from !== undefined) {
            if (!TRIGGER_FROM.includes(s.from)) problems.push(`${s.id}: from ${JSON.stringify(s.from)} is not one of ${TRIGGER_FROM.join('/')}`);
            else if (s.from === 'pet' && !SPATIAL_TRIGGERS.includes(tg.kind)) {
              problems.push(`${s.id}: from "pet" on ${tg.kind}, which asks no spatial question — only ${SPATIAL_TRIGGERS.join('/')} have an origin to move`);
            }
          }
        }
        // §8.3, the Monk's Chi loop: a skill may declare what it COSTS. Refused
        // on a damaging skill, because Chi is generated BY damage — a damage
        // skill that also spent it would be a loop that funds and drains itself
        // in the same cast, and its net rate would be an accident of tuning
        // rather than a decision. Refused on any class that cannot generate it,
        // because a cost nothing can pay is a skill that never fires, which is
        // the wired-to-nothing shape this file exists to catch.
        if (s.chi !== undefined) {
          if (!(typeof s.chi === 'number' && s.chi > 0)) {
            problems.push(`${s.id}: chi cost ${JSON.stringify(s.chi)} is not a positive number`);
          }
          if (isDamaging(s)) {
            problems.push(`${s.id}: declares a chi cost AND deals damage — damage GENERATES chi (§8.3), so a skill doing both funds and drains the same loop in one cast`);
          }
          const cls = TREES[s.tree] && TREES[s.tree].classId;
          const owns = (TREES_BY_CLASS[cls] || []).includes('monk_chi');
          if (!owns) problems.push(`${s.id}: declares a chi cost but ${cls} has no monk_chi tree to generate any — a cost nothing can pay is a skill that never fires`);
        }
        // §8.3, the Blacksmith's Crystal Forms: a skill may declare the FORM it
        // fires in. Refused when no `form` step anywhere declares that name,
        // because a skill gated on a form nothing enters is a skill that never
        // fires — the wired-to-nothing shape, one layer up from a dead primitive.
        if (s.form !== undefined) {
          if (typeof s.form !== 'string' || !s.form) problems.push(`${s.id}: form ${JSON.stringify(s.form)} is not a form name`);
          else if (!FORM_NAMES.has(s.form)) {
            problems.push(`${s.id}: gated on form "${s.form}", which no \`form\` step anywhere enters — known forms: ${[...FORM_NAMES].join('/') || '(none)'}`);
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

    // STRICT LAYERING — which is NOT the same as a linear chain, and this
    // comment said "linear prerequisite chain" for four phases while enforcing
    // something weaker.
    //
    // What is actually required is that a prereq sit exactly one tier below.
    // That forbids a skill skipping a tier; it has never forbidden two skills
    // at tier 3 sharing a tier-2 parent, which is what BRANCHING is. Tested
    // rather than assumed: a second tier-3 node added to samurai_tactics under
    // the same parent loaded clean and swept 0-red.
    //
    // So every tree being a 1-per-tier chain today is an authoring convention,
    // not a constraint — and §8.1's move to branching trees needs no change
    // here. Layering is what keeps a tree RENDERABLE (tier is the column the
    // screen lays out on), so it stays. A skill still has exactly one parent:
    // convergence is ruled out of v1, and `prereq` is a single id everywhere.
    //
    for (const s of byTier) {
      // EVERY TIER MUST HAVE A GATE. Tier is a level gate now, so a node above
      // the table would be unlockable at no level at all — content that loads,
      // renders and can never be bought. This is the assertion the relaxation
      // below makes necessary: while a prereq had to sit exactly one tier down,
      // tier 11 was unreachable by construction.
      if (!(s.tier >= 1 && s.tier <= TIER_LEVELS.length)) {
        problems.push(`${s.id}: tier ${s.tier} has no entry in TIER_LEVELS (1..${TIER_LEVELS.length}) — no character level would ever unlock it`);
      }
      if (s.tier === 1) continue;
      const pre = SKILL_BY_ID[s.prereq];
      if (!pre) problems.push(`${s.id}: tier ${s.tier} with no prerequisite`);
      // STRICTLY LOWER, NOT EXACTLY ONE BELOW — the relaxation §8.1 needs, and
      // the one the reachability walk below was written in advance of.
      //
      // The old rule forced a prereq one tier down, which made tiers dense and
      // therefore made every tree a chain: ten nodes over ten tiers is one node
      // per tier. Branching needs parallel paths through the SAME gates, so a
      // tree skips tiers and its branches sit side by side — samurai_agility
      // spends ten nodes on tiers 1/2/4/6/8/10 with two branches running through
      // the last four together.
      //
      // What still holds, and is what keeps a tree renderable and finite: tier
      // strictly decreases along every prereq edge. The screen lays out on tier,
      // so a parent is always to the left of its children.
      else if (!(pre.tier < s.tier)) {
        problems.push(`${s.id}: prereq ${pre.id} is tier ${pre.tier}, which is not below tier ${s.tier} — `
          + `tier must strictly decrease along a prereq edge or the tree is not layered and cannot be drawn`);
      }
    }

    // REACHABILITY — and an honest account of when it can actually fire.
    //
    // TODAY IT CANNOT. Given the three rules above — exactly one tier-1 node, a
    // prereq that is in this tree, and a prereq exactly one tier below — every
    // node is reachable by induction, so this walk can never find a stranded
    // one. Tiers strictly decrease along prereq edges, which rules out cycles,
    // and a tier-N node's parent is a tier-(N−1) node that is reachable by the
    // same argument. Writing this as though it were catching something would be
    // the exact defect this file keeps finding elsewhere — and specifically the
    // one twenty lines up, where a comment saying "linear prerequisite chain"
    // sat over an assertion that never enforced linearity and survived 28 trees
    // because nobody re-read it against the code. A comment that overstates a
    // check is how that happens, so this one understates nothing: **today this
    // is a guard against a rule that will be relaxed, not a check against a
    // defect that exists.**
    //
    // IT IS HERE BECAUSE LAYERING IS THE RULE THAT WILL BE RELAXED. The first
    // author who wants a long branch — a tier-5 node hanging off a tier-3 one,
    // which is an ordinary shape in a Diablo 2 tree — will hit
    // `pre.tier !== s.tier - 1` and the natural fix is to loosen it. The moment
    // that happens the induction collapses and cycles become expressible.
    // Verified rather than argued: with layering relaxed and two nodes made each
    // other's prereq, every other assertion in this file passes and only this
    // one fires.
    //
    // Nothing downstream would notice either. `canLearn` answers about one node
    // at a time and correctly says "no", the screen renders it greyed, and the
    // sweep never fires it because it can never be learned — a stranded node
    // looks exactly like content the player has not got to yet. So the closure
    // is walked from the root, and anything left over is content that has been
    // authored, ranked, balanced and shipped that no player can ever buy.
    const reached = new Set(t1.map(s => s.id));
    for (let pass = 0; pass < byTier.length; pass++) {
      let grew = false;
      for (const s of byTier) {
        if (reached.has(s.id) || !s.prereq || !reached.has(s.prereq)) continue;
        reached.add(s.id); grew = true;
      }
      if (!grew) break;
    }
    const stranded = tree.skills.filter(s => !reached.has(s.id));
    if (stranded.length) {
      problems.push(`${tree.id}: ${stranded.length} node(s) cannot be reached from the tier-1 root by spending points — `
        + stranded.map(s => `${s.id} (tier ${s.tier}, prereq ${JSON.stringify(s.prereq)})`).join(', ')
        + `. Every other check passes on a stranded node: it renders, it validates, and it is unbuyable`);
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
