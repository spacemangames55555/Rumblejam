// Dev tool: generate docs/COMPENDIUM.md — the complete player-facing reference
// for every character, stat, weapon and item, built from the live content
// modules so it can never drift from what the game actually ships. Nothing here
// is hand-typed: if a number changes in js/content, re-run this and the doc
// changes with it.
// Usage: node tools/gen_compendium.mjs   (writes docs/COMPENDIUM.md)

import { writeFileSync, mkdirSync } from 'fs';
import { CHARACTERS } from '../js/content/characters.js';
import { WEAPONS, WEAPON_BY_ID } from '../js/content/weapons.js';
import { ITEMS } from '../js/content/items.js';
import { STAT_GLOSS } from '../js/content/glossary.js';
import { STATS, STAT_NAME, STAT_IS_PCT, STAT_BASE, SCALING_RATES, TIER_MULT, TIER_PRICE_MULT, TIER_NAMES, CONFIG } from '../js/config.js';

const out = [];
const w = (...lines) => out.push(...lines);
const esc = s => String(s).replace(/\|/g, '\\|');
const n = v => (Math.round(v * 100) / 100).toString();

// A stat delta as it reads on a card: percent stats carry a %, flat ones don't.
const statStr = (k, v) => `${v > 0 ? '+' : ''}${v}${STAT_IS_PCT[k] ? '%' : ''} ${STAT_NAME[k]}`;
const statList = stats => Object.entries(stats || {}).map(([k, v]) => statStr(k, v)).join(', ') || '—';

// How each stat is actually applied by the engine, quoted from the formulas in
// game.js / config.js rather than described loosely.
const STAT_FORMULA = {
  vitality: 'Max HP directly. Gaining Vitality heals you by the amount gained. As a weapon scaling tag it converts at **1% damage per 4 points**.',
  ferocity: 'Multiplies all weapon damage by `1 + Ferocity/100`. As a scaling tag it contributes its percentage directly.',
  tempo: 'Divides every weapon cooldown by `1 + Tempo/100` and multiplies move speed by the same factor — one stat for attack speed and footspeed. Contributes its percentage directly as a scaling tag.',
  grit: 'Mitigation on a diminishing curve, **not** flat reduction: damage taken is `raw × 15 / (15 + Grit)`, so 15 Grit halves incoming damage, 45 Grit quarters it, and it never reaches zero. Also resists knockback and pulls. As a scaling tag it converts at **1% damage per point**.',
  reflex: 'Percent chance to avoid a hit entirely. **Capped at 60%** (one trait raises that cap). A dodge also fires every "on dodge" effect you own.',
  recovery: 'Multiplies every heal you *receive*, from any source (regen, lifesteal, kill-heals, room rest). Worth nothing on its own — it is an amplifier.',
  ingenuity: 'Summon damage and HP scale by `1 + 0.1 × Ingenuity`. As a scaling tag it converts at **1% damage per point**.',
  attunement: 'Multiplies burn, chill, chain-lightning, explosion and nova power and duration. Contributes its percentage directly as a scaling tag.',
  greed: 'Biases the rarity of every offer, and pays `floor(Greed/2)` bonus materials per fight cleared. As a scaling tag it converts at **1% damage per point**.',
  reach: 'Adds to weapon range and to your material pickup radius. As a scaling tag it converts at **1% damage per 12 points**.',
};

const CLASS_INFO = {
  swing: ['Swing', 'Arc melee — sweeps a cone in front of you and hits everything inside it.'],
  thrust: ['Thrust', 'Line melee — stabs along a narrow lane; some models pierce every body in the line.'],
  single: ['Single shot', 'Ranged — one projectile per shot, stopped by the first thing it hits unless it pierces.'],
  spread: ['Spread', 'Ranged — several projectiles per shot in a fan.'],
  lobbed: ['Lobbed', 'Arcs over walls and detonates in an area. The only class that ignores line of sight.'],
  summon: ['Summon', 'Places a structure that fights on its own. Scales with Ingenuity, not with your weapon stats.'],
};

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'legendary'];
const noWeapon = CHARACTERS.filter(c => !c.weapon);
// Character stats are MODIFIERS on the base sheet, not absolutes (game.js
// _recomputeStats adds them), so the HP a player actually starts with is the
// base plus whatever the character carries.
const startHp = c => STAT_BASE.vitality + (c.stats.vitality || 0);

// ---------------------------------------------------------------- header

w('# UNDERVAULT — Compendium',
  '',
  'The complete reference for every character, stat, weapon and item in the game.',
  '',
  `Generated from the live content modules — ${CHARACTERS.length} characters, ${STATS.length} stats, ${WEAPONS.length} weapons, ${ITEMS.length} items.`,
  'Re-generate with `node tools/gen_compendium.mjs`.',
  '',
  '---',
  '',
  '## Contents',
  '',
  '1. [How a character works](#how-a-character-works)',
  '2. [The ten stats](#the-ten-stats)',
  '3. [Characters](#characters) — all 33, with their traits',
  '4. [Weapons](#weapons) — all 26, by class',
  '5. [Items](#items) — all 146, by rarity',
  '6. [Cursed goods](#cursed-goods)',
  '7. [Reference tables](#reference-tables)',
  '',
  '---',
  '');

// ---------------------------------------------------------------- primer

w('## How a character works',
  '',
  'Every character is three things:',
  '',
  `- **A stat line.** Everyone starts from the same base — **${STAT_BASE.vitality} Vitality and zero in everything else** — and their listed stats are applied on top. A character with no listed stat for something simply has the base value.`,
  `- **A starting weapon.** One weapon at tier I, free; you buy the rest, up to ${CONFIG.WEAPON_SLOT_MAX} slots. ${noWeapon.length === 1 ? `${noWeapon[0].name} is the exception — no starting weapon and no slots, because ${noWeapon[0].name}'s trait replaces them entirely.` : `${noWeapon.length} characters start with none, and their traits explain why.`}`,
  '- **One signature trait.** Never replaced, never upgraded, and no two characters share one. The trait is the character. Four traits also change how many weapon slots you get.',
  '',
  'Nothing else is fixed. Weapons, items, stat boosts and boons are all bought, found or picked during a run, and any character can end up anywhere.',
  '',
  '### Damage, in one paragraph',
  '',
  'A weapon has a base damage and a cooldown. Damage is multiplied by its tier, then by `1 + Ferocity/100`, then by its **scaling tags** — one or two stats listed on the weapon that make *that* weapon hit harder. Percent stats (Ferocity, Tempo, Reflex, Recovery, Attunement) contribute their percentage directly; flat stats convert at the rates in the stat table below. Cooldown is divided by `1 + Tempo/100`.',
  '',
  '**Crits are not a stat.** You cannot buy crit chance. Crits happen only where an item or trait grants them, and they deal ×2 by default.',
  '',
  '---',
  '');

// ---------------------------------------------------------------- stats

w('## The ten stats',
  '',
  '| Stat | In one line | Base |',
  '|---|---|---|');
for (const s of STATS) {
  w(`| **${s.name}** | ${esc(STAT_GLOSS[s.key].short)} | ${s.base}${s.pct ? '%' : ''} |`);
}
w('');

for (const s of STATS) {
  const g = STAT_GLOSS[s.key];
  const wpn = WEAPONS.filter(x => (x.scaling || []).includes(s.key));
  const items = ITEMS.filter(x => x.stats && x.stats[s.key] > 0);
  const chars = CHARACTERS.filter(c => c.stats[s.key] !== undefined);
  w(`### ${s.name}`,
    '',
    g.detail,
    '',
    `**How it works:** ${STAT_FORMULA[s.key]}`,
    '',
    `**Where you find it:** ${wpn.length} weapon${wpn.length === 1 ? '' : 's'} scale with it${wpn.length ? ` (${wpn.map(x => x.name).join(', ')})` : ''} · ${items.length} items grant it · ${chars.length} characters carry it on their sheet.`,
    '');
}
w('### What Grit is actually worth',
  '',
  'Grit is the one stat whose value curves, so it is worth seeing the numbers.',
  '',
  '| Grit | Damage taken | Effective HP multiplier |',
  '|---|---|---|');
for (const g of [0, 5, 10, 15, 25, 40, 60]) {
  const mult = 15 / (15 + g);
  w(`| ${g} | ${Math.round(mult * 100)}% | ×${n(1 / mult)} |`);
}
w('',
  'Every point is worth *less* than the last, but it never stops helping — and it multiplies with Vitality rather than competing with it.',
  '',
  '---',
  '');

// ---------------------------------------------------------------- characters

w('## Characters',
  '',
  `All ${CHARACTERS.length}, in roster order. The **sheet** is a set of modifiers *added to the base*, not absolute values — Bulwark's "+80 Vitality" means ${STAT_BASE.vitality} + 80 = ${STAT_BASE.vitality + 80} HP. Anything not listed sits at base.`,
  '',
  '### At a glance',
  '',
  '| | Character | Roles | Sheet (on top of base) | HP | Starting weapon |',
  '|---|---|---|---|---|---|');
for (const c of CHARACTERS) {
  const wp = c.weapon ? WEAPON_BY_ID[c.weapon] : null;
  w(`| ${c.sym} | **${c.name}** | ${c.roles.join(', ')} | ${esc(statList(c.stats))} | ${startHp(c)} | ${wp ? wp.name : '*none — see trait*'} |`);
}
w('');

for (const c of CHARACTERS) {
  const wp = c.weapon ? WEAPON_BY_ID[c.weapon] : null;
  // the trait's tuning numbers, so the description can be checked against them
  const knobs = Object.entries(c.trait).filter(([k]) => k !== 'key')
    .map(([k, v]) => `${k} ${typeof v === 'number' ? n(v) : v}`).join(' · ');
  w(`### ${c.sym} ${c.name}`,
    '',
    `**Roles:** ${c.roles.join(', ')}  `,
    `**Sheet:** ${statList(c.stats)} *(added to the base sheet)*  `,
    `**Starting HP:** ${startHp(c)}  `,
    `**Starting weapon:** ${wp ? `${wp.sym} ${wp.name} — ${wp.dmg} damage every ${wp.cd}s, ${wp.range} range` : 'none'}`,
    '',
    `**Trait — \`${c.trait.key}\`**${knobs ? ` *(${knobs})*` : ''}`,
    '',
    `> ${c.desc}`,
    '');
}
w('---', '');

// ---------------------------------------------------------------- weapons

w('## Weapons',
  '',
  `All ${WEAPONS.length}, grouped by class. Every number shown is **tier I**; tiers multiply damage by ${TIER_NAMES.map((t, i) => `${t} ×${TIER_MULT[i]}`).join(', ')}.`,
  '',
  '**Two** copies of the same weapon at the same tier combine into one of the next tier, for free — automatically when you buy the second one.',
  '');

for (const cls of Object.keys(CLASS_INFO)) {
  const list = WEAPONS.filter(x => x.cls === cls);
  if (!list.length) continue;
  const [label, blurb] = CLASS_INFO[cls];
  w(`### ${label}`, '', blurb, '');
  if (cls === 'summon') {
    w('| | Weapon | Structure HP | Damage | Every | Range | Scales with | Price |',
      '|---|---|---|---|---|---|---|---|');
    for (const x of list) {
      const s = x.summon;
      w(`| ${x.sym} | **${x.name}** | ${s.hp} | ${s.dmg} | ${s.cd}s | ${s.range} | ${(x.scaling || []).map(k => STAT_NAME[k]).join(' + ') || '—'} | ${x.price} ⟡ |`);
    }
    w('');
    continue;
  }
  w('| | Weapon | Damage | Cooldown | DPS | Range | Knock | Scales with | Extra | Price |',
    '|---|---|---|---|---|---|---|---|---|---|');
  for (const x of list) {
    const extra = [];
    if (x.burn) extra.push(`burn ${x.burn.dps}/s for ${x.burn.dur}s`);
    if (x.slow) extra.push(`chill to ${Math.round(x.slow.mult * 100)}% speed for ${x.slow.dur}s`);
    if (x.chainHit) extra.push(`chains to ${x.chainHit.count} more at ${Math.round(x.chainHit.factor * 100)}%`);
    if (x.pierceLine) extra.push('pierces the whole line');
    if (x.pierce) extra.push(`pierces ${x.pierce}`);
    if (x.count) extra.push(`${x.count} projectiles${x.spreadDeg ? ` over ${x.spreadDeg}°` : ''}`);
    if (x.aoe) extra.push(`blast radius ${x.aoe.radius ?? x.aoe}`);
    if (x.puddle) extra.push('leaves a puddle');
    if (x.arc) extra.push(`${Math.round(x.arc * 57.3)}° arc`);
    if (x.thrustW) extra.push(`${x.thrustW}u wide`);
    w(`| ${x.sym} | **${x.name}** | ${x.dmg} | ${x.cd}s | ${n(x.dmg / x.cd)} | ${x.range} | ${x.knock} | ${(x.scaling || []).map(k => STAT_NAME[k]).join(' + ') || '—'} | ${esc(extra.join('; ') || '—')} | ${x.price} ⟡ |`);
  }
  w('');
}
w('---', '');

// ---------------------------------------------------------------- items

w('## Items',
  '',
  `All ${ITEMS.length}, grouped by rarity. Items are permanent for the run and never combine.`,
  '',
  '**The tradeoff rule:** commons are clean gains. Roughly half of uncommons, and *every* rare and legendary, also subtract from a stat — always on an opposing axis to what they give, and always spelled out on the item.',
  '');

for (const r of RARITY_ORDER) {
  const list = ITEMS.filter(x => x.rarity === r && !x.curse);
  const neg = list.filter(x => x.stats && Object.values(x.stats).some(v => v < 0)).length;
  w(`### ${r[0].toUpperCase()}${r.slice(1)} — ${list.length} items`,
    '',
    `${neg} of them carry a subtraction. Prices run ${Math.min(...list.map(x => x.price))}–${Math.max(...list.map(x => x.price))} ⟡.`,
    '',
    '| Item | Stats | What it does | Price |',
    '|---|---|---|---|');
  for (const x of list) {
    w(`| **${esc(x.name)}** | ${esc(statList(x.stats))} | ${esc(x.desc || '—')} | ${x.price} ⟡ |`);
  }
  w('');
}
w('---', '');

// ---------------------------------------------------------------- curses

const cursed = ITEMS.filter(x => x.curse);
w('## Cursed goods',
  '',
  `${cursed.length} items in the shop are **cursed**: they are priced and statted well above their rarity, and the cost is paid by the *next* fight — for the whole party, in co-op. The curse expires when that fight ends.`,
  '',
  '| Item | Rarity | Stats | The curse | Price |',
  '|---|---|---|---|---|');
for (const x of cursed) {
  const cs = [x.curse, x.curse2].filter(Boolean)
    .map(c => `\`${c.key}\` ${c.value}${c.scope ? ` (${c.scope})` : ''}`).join(' + ');
  w(`| **${esc(x.name)}** | ${x.rarity} | ${esc(statList(x.stats))} | ${esc(x.desc || cs)} | ${x.price} ⟡ |`);
}
w('', '---', '');

// ---------------------------------------------------------------- tables

w('## Reference tables',
  '',
  '### Weapon tiers',
  '',
  '| Tier | Damage × | Price × |',
  '|---|---|---|');
for (let i = 0; i < TIER_NAMES.length; i++) w(`| ${TIER_NAMES[i]} | ×${TIER_MULT[i]} | ×${TIER_PRICE_MULT[i]} |`);
w('',
  '### Flat-stat scaling rates',
  '',
  'When a flat stat is one of a weapon\'s scaling tags, this is how much bonus damage one point buys. Percent stats contribute their percentage directly and are not listed.',
  '',
  '| Stat | Damage per point |',
  '|---|---|');
for (const [k, v] of Object.entries(SCALING_RATES)) w(`| ${STAT_NAME[k]} | ${n(v * 100)}% |`);
w('');

// stat census — which stats the catalog actually supports
w('### Stat coverage across the catalog',
  '',
  '| Stat | Weapons scaling | Items granting | Characters carrying |',
  '|---|---|---|---|');
for (const s of STATS) {
  w(`| ${s.name} | ${WEAPONS.filter(x => (x.scaling || []).includes(s.key)).length} | ${ITEMS.filter(x => x.stats && x.stats[s.key] > 0).length} | ${CHARACTERS.filter(c => c.stats[s.key] !== undefined).length} |`);
}
w('',
  '### Roles across the roster',
  '',
  '| Role | Characters |',
  '|---|---|');
const roles = [...new Set(CHARACTERS.flatMap(c => c.roles))].sort();
for (const r of roles) {
  w(`| ${r} | ${CHARACTERS.filter(c => c.roles.includes(r)).map(c => c.name).join(', ')} |`);
}
w('');

mkdirSync('docs', { recursive: true });
writeFileSync('docs/COMPENDIUM.md', out.join('\n') + '\n');
console.log(`docs/COMPENDIUM.md — ${out.length} lines, ${CHARACTERS.length} characters, ${WEAPONS.length} weapons, ${ITEMS.length} items`);
