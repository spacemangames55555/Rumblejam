// Dev tool: generate docs/design-audit.md from the live content data.
// Every roster row, stat census, and axis count is computed from the actual
// data modules — if the doc would disagree with the data, the data wins by
// construction. Judgment columns (pick appeal) live in an explicit map keyed
// by character id; the script fails if that map and the roster ever diverge.
// Usage: node tools/gen_design_audit.mjs   (writes docs/design-audit.md)

import { writeFileSync, mkdirSync } from 'fs';
import { CHARACTERS } from '../js/content/characters.js';
import { ITEMS } from '../js/content/items.js';
import { WEAPONS, WEAPON_BY_ID } from '../js/content/weapons.js';
import { STATS, STAT_IS_PCT } from '../js/config.js';

// ---------- verification against the boot-log counts ----------
const EXPECT = { characters: 36, items: 110, weapons: 26 };
if (CHARACTERS.length !== EXPECT.characters) throw new Error(`characters ${CHARACTERS.length} != ${EXPECT.characters}`);
if (ITEMS.length !== EXPECT.items) throw new Error(`items ${ITEMS.length} != ${EXPECT.items}`);
if (WEAPONS.length !== EXPECT.weapons) throw new Error(`weapons ${WEAPONS.length} != ${EXPECT.weapons}`);
{
  const seen = new Set();
  for (const c of CHARACTERS) {
    if (seen.has(c.id)) throw new Error(`duplicate character id ${c.id}`);
    seen.add(c.id);
  }
}

// ---------- section 1: stat glossary ----------
// What each stat does + its formula as implemented (game.js/config.js).
const STAT_DOC = {
  maxHp: ['Your hit point pool. Downed at 0.', 'Base 80 + modifiers (min 1). Gaining Max HP also grants the difference as current HP.'],
  hpRegen: ['Passive healing over time.', 'Heals `HP Regen / 5` HP per second (whole points, accumulated). Lamprey\'s trait disables it.'],
  lifeSteal: ['Heal a cut of the damage you deal.', 'Heal `damage dealt × LifeSteal%` (accumulated to whole HP). Hemomancer turns overheal into a shield (cap 20).'],
  damage: ['The universal damage multiplier.', 'Hit = weapon base × tier mult × `(1 + Damage%/100)` × matching class bonus, ×2 on crit (×3 for Duskblade).'],
  meleeDamage: ['Multiplier for melee-tagged weapons.', 'Extra `×(1 + Melee%/100)` on swing/thrust weapons (stacks multiplicatively with Damage%).'],
  rangedDamage: ['Multiplier for ranged-tagged weapons.', 'Extra `×(1 + Ranged%/100)` on shot/spread (and Kegbomb) weapons.'],
  elementalDamage: ['Multiplier for elemental-tagged weapons and effects.', 'Extra `×(1 + Elem%/100)` on elemental weapons; also scales burn DPS (weapons, traits, summons) and Bogflask puddles.'],
  attackSpeed: ['Attack rate for all weapons.', 'Cooldown = `base / max(0.25, 1 + AS%/100)` — floored so stacked penalties can\'t invert it.'],
  critChance: ['Chance a hit is critical.', 'Rolled per fire: `random(100) < CritChance + weapon bonus`. Crits deal ×2 (×3 Duskblade). Several traits/items guarantee crits.'],
  engineering: ['Power source for summons/structures.', 'Summon damage AND HP `×(1 + 0.1 × Engineering)` — +10% each per point.'],
  range: ['Flat reach added to weapons.', 'Ranged/lobbed gain 100% of Range; melee gains 30%; weapon range floors at 40.'],
  armor: ['Flat damage mitigation.', 'Damage taken = `raw × 15 / (15 + Armor)`. Negative armor allowed, capped at +50% extra damage.'],
  dodge: ['Chance to ignore a hit entirely.', 'Percent roll per hit, capped at 60 (Wisp raises to 90, Bastion lowers to 30). Dodging triggers several traits/items.'],
  speed: ['Movement rate.', 'Move speed = `300 × (1 + Speed%/100)` u/s, floored at 60.'],
  luck: ['Rarity bias everywhere rarity is rolled.', 'Uncommon+ weights `×(1 + Luck/100)`, renormalized — shop stock, treasure, elite rewards, level-up boost sizes.'],
  harvesting: ['Self-growing per-room income.', 'Grants `floor(Harvesting)` materials at each room clear, then grows by `floor(5%)` of itself (+item bonuses).'],
};

const statHooksWithStats = it => {
  const blocks = [];
  if (it.hooks) {
    for (const h of Object.values(it.hooks)) if (h && typeof h === 'object' && h.stats) blocks.push(h.stats);
  }
  return blocks;
};

function statCensus(key) {
  const chars = CHARACTERS.filter(c => c.stats && c.stats[key] !== undefined).length;
  const itemsDirect = ITEMS.filter(it => it.stats && it.stats[key] !== undefined).length;
  const itemsHook = ITEMS.filter(it => statHooksWithStats(it).some(b => b[key] !== undefined)).length;
  const weapons = WEAPONS.filter(w => w.tags.includes(key)).length;
  return { chars, items: itemsDirect + itemsHook, weapons };
}

// ---------- section 2: pick-appeal judgments (per character id) ----------
const APPEAL = {
  bulwark: ['H', 'Double HP forgiveness; the obvious first pick'],
  voltaic: ['M', 'Flashy chains, but the melee penalty confuses'],
  magnate: ['M', 'Economy scaling for the optimizers'],
  wisp: ['M', 'Thrilling 20-HP glass build for veterans'],
  cogsmith: ['H', 'No-weapons turret gimmick is irresistible novelty'],
  lamprey: ['M', 'Quietly strong sustain scaler'],
  powderkeg: ['M', 'Pickup explosions feel great early, fade late'],
  echo: ['L', 'Invisible passive; weak fantasy'],
  quartermaster: ['L', 'Item ban reads as pure downside'],
  gilded_one: ['M', 'Legendary-only shop is a fun lottery'],
  chameleon: ['L', 'Random temp stat has no identity'],
  tollkeeper: ['M', 'Party-wide tradeoff sparks table arguments'],
  stillness: ['L', 'Standing still fights the genre\'s motion'],
  redmaw: ['M', 'Simple readable berserker fantasy'],
  glasswing: ['M', 'Double-edged risk appeals to gamblers'],
  twinsoul: ['M', 'Mirror drone doubles your favorite weapon'],
  bastion: ['M', 'Infinite armor for the patient'],
  fleetfoot: ['M', 'Speed-into-damage rewards movement lovers'],
  duskblade: ['H', 'Triple crits: big numbers sell themselves'],
  highroller: ['L', 'Flat reroll cost is invisible mid-run'],
  archivist: ['L', 'A fifth choice is marginal and passive'],
  cindermage: ['M', 'Everything burns; clean elemental identity'],
  frostcaller: ['M', 'Universal chill is strong utility'],
  longshot: ['M', 'Distance bonus suits natural snipers'],
  threader: ['M', 'Universal pierce is quietly excellent'],
  skirmisher: ['L', 'Always-moving bonus is effectively invisible'],
  tinker: ['M', 'Faster turrets with a tight slot puzzle'],
  hivewright: ['M', 'Free drone per floor compounds nicely'],
  ironclad: ['M', 'Armor-into-damage single-stat dream'],
  zephyr: ['H', 'Dodge-crits plus speed bursts feel amazing'],
  mirage: ['L', 'Small uncontrollable retaliate nova'],
  bloodpetal: ['M', 'Kill-heal drip suits aggression'],
  hemomancer: ['M', 'Overheal shield rewards lifesteal stacking'],
  jester: ['M', 'Crit ramp smooths RNG; niche appeal'],
  lancer: ['L', 'One guaranteed crit per room is tiny'],
  courier: ['M', 'Permanent speed snowball, simple pleasure'],
};

{
  const ids = new Set(CHARACTERS.map(c => c.id));
  for (const id of Object.keys(APPEAL)) if (!ids.has(id)) throw new Error(`APPEAL has unknown id ${id}`);
  for (const id of ids) if (!APPEAL[id]) throw new Error(`APPEAL missing ${id}`);
}

const esc = s => String(s).replace(/\|/g, '\\|');
const fmtStats = stats => Object.entries(stats || {})
  .map(([k, v]) => `${v > 0 ? '+' : ''}${v}${STAT_IS_PCT[k] ? '%' : ''} ${k}`)
  .join(', ') || '—';

// ---------- section 3: axis counts from the roles data ----------
const AXES = ['melee', 'ranged', 'elemental', 'engineering', 'tank', 'dodge', 'lifesteal', 'crit', 'economy', 'luck', 'speed'];
const axisMembers = Object.fromEntries(AXES.map(a => [a,
  CHARACTERS.filter(c => (c.roles || []).includes(a)).map(c => c.name)]));

// ---------- emit ----------
const L = [];
L.push('# Undervault — design audit');
L.push('');
L.push('> Generated from the live content data by `node tools/gen_design_audit.mjs` —');
L.push('> regenerate after any content change; do not hand-edit the computed tables.');
L.push(`> Counts verified against boot log: **${CHARACTERS.length} characters / ${ITEMS.length} items / ${WEAPONS.length} weapons**.`);
L.push('');

// -- 1 --
L.push('## 1. Stat glossary');
L.push('');
L.push('Census: how many **characters** modify the stat in their base statline, how many');
L.push('**items** grant it (directly or inside an aura/low-HP/per-level/per-floor hook),');
L.push('and how many **weapons** list it as a scaling tag. Defensive/economy stats have no');
L.push('weapon tags by design — only the ⚠ flag marks genuinely thin usage.');
L.push('');
L.push('| Stat | What it does | Formula (as implemented) | Chars | Items | Weapons | Flag |');
L.push('|---|---|---|---:|---:|---:|---|');
for (const s of STATS) {
  const [what, formula] = STAT_DOC[s.key];
  const c = statCensus(s.key);
  const offensive = ['damage', 'meleeDamage', 'rangedDamage', 'elementalDamage', 'attackSpeed', 'critChance', 'engineering', 'range'].includes(s.key);
  const low = (c.chars + c.items) < 9 || (offensive && c.weapons <= 1);
  L.push(`| **${s.name}** | ${esc(what)} | ${esc(formula)} | ${c.chars} | ${c.items} | ${c.weapons} | ${low ? '⚠ low usage' : ''} |`);
}
L.push('');

// -- 2 --
L.push('## 2. Full character roster');
L.push('');
L.push('Pick appeal is an honest pre-playtest guess (H/M/L). Verdict and Notes are for the owner.');
L.push('');
L.push('| # | Character | Stat modifiers | Weapon | Signature trait | Pick appeal | Verdict | Notes |');
L.push('|---:|---|---|---|---|---|---|---|');
CHARACTERS.forEach((c, i) => {
  const [grade, why] = APPEAL[c.id];
  const weapon = c.weapon ? WEAPON_BY_ID[c.weapon].name : '—';
  L.push(`| ${i + 1} | **${esc(c.name)}** | ${esc(fmtStats(c.stats))} | ${esc(weapon)} | ${esc(c.desc)} | **${grade}** — ${esc(why)} | | |`);
});
L.push('');

// -- 3 --
L.push('## 3. Roster analysis');
L.push('');
L.push('### Build-axis coverage (from the `roles` data)');
L.push('');
L.push('| Axis | Count | Characters |');
L.push('|---|---:|---|');
for (const a of AXES) L.push(`| ${a} | ${axisMembers[a].length} | ${esc(axisMembers[a].join(', '))} |`);
L.push('');
const n = a => axisMembers[a].length;
L.push(`**Over-served:** economy (${n('economy')}) is the widest axis and several of its members overlap`);
L.push('(Magnate/Highroller both discount the shop loop; Powderkeg and Courier are economy');
L.push(`in name only). Speed (${n('speed')}) has three separate "speed becomes value" designs.`);
L.push('');
L.push(`**Under-served:** tank (${n('tank')}) and lifesteal (${n('lifesteal')}) sit at the spec minimum, and all three`);
L.push('tanks lean on the same Armor stat rather than distinct survival mechanics (block,');
L.push(`shields, retaliation tanking are unexplored). Ranged (${n('ranged')}) is broad but shallow —`);
L.push('nothing there changes *how* shooting works the way Cogsmith changes summons.');
L.push('');
L.push('### Near-duplicates');
L.push('');
L.push('- **Bastion / Ironclad** — both are melee-adjacent Armor engines; one grows Armor, the other converts it. Same pick fantasy, one shop plan.');
L.push('- **Fleetfoot / Courier** (and half of Skirmisher) — three flavors of "Speed becomes damage/value"; Courier\'s growth and Fleetfoot\'s conversion collapse into the same run.');
L.push('- **Duskblade / Lancer** — crit-melee pair where Lancer\'s once-per-room crit is strictly less exciting than ×3 crits.');
L.push('- **Lamprey / Bloodpetal** — per-room vs per-kill sustain drips; numbers differ, feel doesn\'t.');
L.push('- **Magnate / Highroller** — both are "shop is cheaper" characters; Magnate\'s version is visible, Highroller\'s isn\'t.');
L.push('');
L.push('### Cool on paper, passive in play');
L.push('');
L.push('- **Echo** (every 4th attack echoes) — no cue, no decision; players can\'t tell it\'s happening.');
L.push('- **Skirmisher** (+ranged while moving) — you are always moving in this genre; it\'s a hidden flat bonus.');
L.push('- **Highroller** (rerolls never compound) — only matters on the 3rd+ reroll of one shop; invisible until late.');
L.push('- **Archivist** (5 level-up choices) — a marginal EV bump with zero moment-to-moment presence.');
L.push('- **Lancer** (first hit each room crits) — one bonus hit per ~30-second room.');
L.push('- **Mirage** (nova on dodge) — fires on RNG the player neither sees coming nor aims.');
L.push('- **Chameleon** (random temp stat per room) — variance without agency; nothing to build around.');
L.push('');

// -- 4 --
L.push('## 4. Brotato-resemblance inventory');
L.push('');
L.push('What already diverges: the Isaac-style room dungeon, door countdowns, bosses,');
L.push('co-op with downs/revives, elite/treasure/shop rooms, and the sell/combine arsenal');
L.push('UI are not Brotato mechanics. What follows is the list of mechanics that still');
L.push('*are*, each with what changing it would ripple into.');
L.push('');
L.push('| # | Mechanic (Brotato-shaped) | Ripple if changed |');
L.push('|---:|---|---|');
const BROTATO = [
  ['The sixteen-stat sheet — names and semantics near-mirror Brotato\'s (Max HP…Harvesting)', 'Everything keys off these: ~70 stat items, the 48-boost level-up pool, tooltips, character statlines, the sheet UI. Renaming is cosmetic; merging/removing stats forces an item+boost+UI redesign.'],
  ['Materials double as currency AND XP in one pickup', 'Splitting them changes drop tables, Harvesting, interest items, level pacing, the HUD, and both economy traits (Tollkeeper, Powderkeg).'],
  ['Banked level-ups → pick 1-of-4 rarity-weighted stat boosts', 'Touches the statboost pool, the offer overlay, Luck, and Archivist\'s trait.'],
  ['Weapon tiers I–IV with duplicate-combining into the next tier', 'Touches shop pricing (tier multipliers), the arsenal combine UI, sell values, and turret tier scaling.'],
  ['Reroll/lock shop: 4 slots, escalating reroll cost, rarity weights 62/25/10/3', 'The whole shop economy plus four traits (Magnate, Highroller, Gilded One, Quartermaster) and lock carryover.'],
  ['Six auto-attacking weapon slots, no aiming', 'Core combat identity; slot-altering traits (Magnate, Tinker, Cogsmith) and the aim-free touch scheme depend on it.'],
  ['Harvesting as a self-growing income stat (5%/round growth)', 'Room-clear resolution, growth items, and the economy characters\' scaling curves.'],
  ['Luck multiplying uncommon+ rarity weights', 'Shop, treasure, elite rewards, and level-up boost sizes all roll through the same function.'],
  ['Engineering/structures as a parallel damage class', 'Four summon weapons, three engineering characters, and summon-boost items.'],
  ['Character = statline + one rule-breaking trait, huge roster', 'The roster\'s entire design language — though this is the genre hook you likely want to keep.'],
  ['Elites as stat-multiplied base enemies with a modifier', 'Elite room rewards and floor pacing; a light resemblance, cheap to restyle.'],
  ['Four-rarity item pool where rare+ stat items carry tradeoffs', 'Item catalog structure, shop card styling, Luck, and treasure/elite reward pools.'],
];
BROTATO.forEach(([m, r], i) => L.push(`| ${i + 1} | ${esc(m)} | ${esc(r)} |`));
L.push('');

mkdirSync('docs', { recursive: true });
writeFileSync('docs/design-audit.md', L.join('\n') + '\n');
console.log(`docs/design-audit.md written — ${CHARACTERS.length} characters / ${ITEMS.length} items / ${WEAPONS.length} weapons, ${L.length} lines`);
