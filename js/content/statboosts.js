// Level-up stat boost pool: small/medium/large per stat, rarity-weighted.
// Generated from a magnitude table so all ten stats are always offerable.
// Percent stats (Ferocity/Tempo/Reflex/Recovery/Attunement) are in %; flat
// stats in points. Crit is not a stat and never appears here.

const T = [
  // key         small  med  large
  ['vitality',     6,   12,   22],
  ['ferocity',     4,    7,   12],
  ['tempo',        4,    7,   12],
  ['grit',         1,    2,    4],
  ['reflex',       3,    5,    8],
  ['recovery',     6,   10,   18],
  ['ingenuity',    1,    2,    4],
  ['attunement',   5,    9,   15],
  ['greed',        2,    4,    7],
  ['reach',        8,   15,   28],
];

const SIZES = [
  { tag: 'small', idx: 1, rarity: 'common' },
  { tag: 'medium', idx: 2, rarity: 'uncommon' },
  { tag: 'large', idx: 3, rarity: 'rare' },
];

export const STAT_BOOSTS = [];
for (const row of T) {
  for (const s of SIZES) {
    STAT_BOOSTS.push({
      id: `${row[0]}_${s.tag}`,
      stat: row[0],
      amount: row[s.idx],
      rarity: s.rarity,
    });
  }
}
