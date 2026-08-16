import { STAT_NAME } from '../config.js';
// Stat glossary — the single source of truth for what each stat MEANS, in
// plain language for regular people. Every piece of UI that explains a stat
// (character sheet, level-up cards, character select, weapon/item tooltips)
// reads from this table so wording can never drift.
//   short:  one line, ≤ 12 words — shown where there's no room to tap
//   detail: 1–2 plain sentences — what it does and what scales with it.
//           No formulas here; exact numbers live on the character sheet.

export const STAT_GLOSS = {
  vitality: {
    short: 'Your hit points — how much damage you can take.',
    detail: 'Your health pool — at zero you go down. Gaining Vitality also heals you by the amount gained, and some heavy weapons hit harder the more you have.',
  },
  ferocity: {
    short: 'Raises all the damage you deal.',
    detail: 'A straight boost to every hit from every weapon. The most common damage stat — many weapons also scale with it directly.',
  },
  tempo: {
    short: 'How fast you move.',
    detail: `Makes you run faster, and nothing else. It does NOT make your skills fire faster — the only thing that shortens a skill's cooldown is ranking up that skill. Positioning is what ${STAT_NAME.tempo} buys.`,
  },
  grit: {
    short: 'Toughness — shrug off damage and knockback.',
    detail: `Reduces every hit you take and makes you harder to push around. A few heavy weapons hit harder the more ${STAT_NAME.grit} you have.`,
  },
  reflex: {
    short: 'Your chance to dodge a hit completely.',
    detail: 'The higher it is, the more often enemy hits simply miss you. Dodging also sets off anything that says "on dodge".',
  },
  recovery: {
    short: 'Makes all healing you receive stronger.',
    detail: 'Every heal — regeneration, life-drain, kill-heals, the rest you catch between rooms — is increased by your Recovery. It does nothing alone; it amplifies the healing your items and traits provide.',
  },
  ingenuity: {
    short: 'Makes your turrets and drones stronger.',
    detail: 'Summons and structures deal more damage and survive longer for every point. Only matters if you field turrets, drones or other helpers.',
  },
  attunement: {
    short: 'Empowers burns, chills, lightning and blasts.',
    detail: 'Everything elemental — fire, frost, chain lightning, explosions and shockwaves — hits harder and lingers longer. The stat for status-effect builds.',
  },
  greed: {
    short: 'Better loot rarity, plus bonus materials each fight.',
    detail: 'Fortune. Improves the rarity of everything the game offers you, and pays bonus materials every fight you clear. Some weapons and blasts scale with it.',
  },
  reach: {
    short: 'Longer weapon range and a bigger pickup magnet.',
    detail: 'Extends how far your weapons reach and pulls dropped materials to you from further away. Snipers and pickup builds want it.',
  },
};
