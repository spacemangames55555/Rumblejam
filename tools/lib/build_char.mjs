// A CHARACTER AT A LEVEL, BUILT THE WAY THE GAME BUILDS ONE.
//
// Every harness in tools/ that wants "a level-28 Wizard" has done it the same
// way: `p.level = 28`, then `p.skillPoints++` in a loop. That makes a
// character with level 28's SKILLS and level 1's BODY. A level is not only a
// skill point — `Sim._grantLevel` also banks a stat card, and by level 28
// that is twenty-seven of them: the whole of a character's vitality growth and
// most of its damage growth. `roster_weight_gate` says so in its own output
// ("vitality grows from BANKED STAT PICKS, which a harness never spends, so
// every anchor resolves to 80") and so does the boss probe.
//
// It was survivable while the harnesses only asked about OUTPUT in god mode.
// It is not survivable for any question about whether a class LIVES, and the
// balance pass is that question fourteen times over. Two of the harnesses
// also sent `{kind: 'levelUp'}` to spend the cards; the action is `levelup`,
// so they spent nothing and reported it as a build.
//
// So: levels are granted through `_grantLevel`, which is the pickup's own
// path; skill points are spent through `spendSkillPoint`; and the banked cards
// are resolved through `_maybeOffer` and the real `levelup` action, chosen by
// a stated POLICY rather than "the first card".
//
//   import { buildCharacter } from './lib/build_char.mjs';
//   const { p } = buildCharacter(sim, { level: 28 });
//
// POLICIES for the stat cards (the offer is four cards, one per stat):
//   'sensible'  what a player who wants to live and kill takes: damage and
//               vitality first, then defence and speed; a summoner values
//               Summons, a status class Elemental Damage. THE DEFAULT.
//   'damage'    always the most offensive card on offer
//   'tank'      always the most defensive card on offer
//   'none'      bank them all and spend nothing — the old harness body, kept
//               so an old number can be reproduced on purpose
//
// SKILL SPEND:
//   'breadth'   points spent breadth-first in tier order, the build
//               REGION_HP_MULT was measured against. THE DEFAULT.
//   'depth'     the class's first tree to the bottom before the next
import { TREES, TREES_BY_CLASS, slotsAtLevel } from '../../js/skills.js';
import * as SKILLSIM from '../../js/skillsim.js';

const BASE_W = { ferocity: 3, vitality: 3, grit: 2, tempo: 1.5, reflex: 1.2, recovery: 1, attunement: 1, ingenuity: 0.6, reach: 0.4, greed: 0.3 };
const DAMAGE_W = { ferocity: 5, attunement: 2, ingenuity: 2, tempo: 1, reflex: 0.8, vitality: 0.5, grit: 0.4, recovery: 0.3, reach: 0.2, greed: 0.1 };
const TANK_W = { vitality: 5, grit: 4, recovery: 2.5, reflex: 2, tempo: 1, ferocity: 0.6, attunement: 0.3, ingenuity: 0.3, reach: 0.2, greed: 0.1 };
// Classes whose output is delivered by a body they summon, or by a status.
const SUMMONERS = new Set(['toh_necromancer', 'toh_druid', 'toh_hunter']);
const STATUS = new Set(['toh_witch_doctor', 'toh_wizard', 'toh_sundian', 'toh_mage']);

function weightsFor(classId, policy) {
  if (policy === 'damage') return DAMAGE_W;
  if (policy === 'tank') return TANK_W;
  const w = { ...BASE_W };
  if (SUMMONERS.has(classId)) w.ingenuity = 2.6;
  if (STATUS.has(classId)) w.attunement = 2.2;
  return w;
}

export function resolveStatPicks(sim, p, policy = 'sensible') {
  if (policy === 'none') return 0;
  const w = weightsFor(p.charId, policy);
  let spent = 0, guard = 0;
  while (p.banked > 0 && guard++ < 400) {
    if (!p.pendingOffer) sim._maybeOffer(p);
    if (!p.pendingOffer || !p.pendingOffer.length) break;
    // Highest weight wins; a bigger card of the same stat is never on the
    // same offer (one card per stat), so rarity only breaks exact ties.
    const pick = [...p.pendingOffer].sort((a, b) => (w[b.stat] || 0) - (w[a.stat] || 0) || b.amount - a.amount)[0];
    sim.uiAction(p.idx, { kind: 'levelup', id: pick.id });
    spent++;
  }
  return spent;
}

export function spendSkills(sim, p, spend = 'breadth') {
  const trees = TREES_BY_CLASS[p.charId] || [];
  const all = trees.flatMap(t => TREES[t].skills);
  const order = spend === 'depth'
    ? trees.flatMap(t => [...TREES[t].skills].sort((a, b) => a.tier - b.tier))
    : [...all].sort((a, b) => a.tier - b.tier);
  for (let pass = 0; pass < 40 && p.skillPoints > 0; pass++) {
    let spent = 0;
    for (const sk of order) {
      if (p.skillPoints <= 0) break;
      if (SKILLSIM.spendSkillPoint(sim, p, sk.id)) spent++;
    }
    if (!spent) break;
  }
  return order;
}

// `sim` must have been created with this character in `party`. Returns the
// player and what was done to it, so a harness can print the build it measured.
export function buildCharacter(sim, { idx = 0, level = 1, picks = 'sensible', spend = 'breadth', loadout = 'tier' } = {}) {
  const p = sim.players[idx];
  if (p.openingOffer) sim.uiAction(idx, { kind: 'opening', id: p.openingOffer[0].id });
  while (p.level < level) sim._grantLevel(p);
  const order = spendSkills(sim, p, spend);
  const cards = resolveStatPicks(sim, p, picks);
  if (loadout === 'tier') {
    // Fill the slots in tier order with everything learned — the same rule the
    // boss probe and region_curve use, so numbers stay comparable with theirs.
    const slots = slotsAtLevel(p.level);
    const learned = order.filter(s => s.type === 'active' && (p.skillRanks[s.id] || 0) >= 1).map(s => s.id);
    if (learned.length) { p.loadout = new Array(8).fill(null); for (let i = 0; i < slots && i < learned.length; i++) p.loadout[i] = learned[i]; }
  }
  sim._recomputeStats(p);
  p.hp = p.stats.vitality;
  return { p, cards, slots: p.loadout.filter(Boolean).length, unspent: p.skillPoints };
}
