// Level-up stat boost pool: small/medium/large per stat, rarity-weighted.
// Generated from a magnitude table so all sixteen stats are always offerable.

const T = [
  // key            small  med  large
  ['maxHp',           4,    8,   16],
  ['hpRegen',         1,    2,    4],
  ['lifeSteal',       1,    2,    4],
  ['damage',          4,    7,   12],
  ['meleeDamage',     5,    9,   15],
  ['rangedDamage',    5,    9,   15],
  ['elementalDamage', 5,    9,   15],
  ['attackSpeed',     4,    7,   12],
  ['critChance',      3,    5,    9],
  ['engineering',     1,    3,    5],
  ['range',           8,   15,   28],
  ['armor',           1,    2,    4],
  ['dodge',           3,    5,    8],
  ['speed',           3,    5,    8],
  ['luck',            3,    6,   10],
  ['harvesting',      2,    4,    7],
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
