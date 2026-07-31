// Dev tool: generate docs/design-audit.md from the live content data
// (Great Rebalance edition — ten stats, weapon scaling tags, 32 characters).
// Every roster row, stat census, and axis count is computed from the actual
// data modules — if the doc would disagree with the data, the data wins by
// construction. Judgment columns (pick appeal) live in an explicit map keyed
// by character id; the script fails if that map and the roster ever diverge.
// It also enforces the dead-stat gate: every stat must appear on ≥2 weapons,
// ≥5 items, and ≥1 character statline.
// Usage: node tools/gen_design_audit.mjs   (writes docs/design-audit.md)

import { writeFileSync, mkdirSync } from 'fs';
import { CHARACTERS } from '../js/content/characters.js';
import { ITEMS } from '../js/content/items.js';
import { WEAPONS, WEAPON_BY_ID } from '../js/content/weapons.js';
import { STATS, STAT_IS_PCT } from '../js/config.js';

// ---------- verification against the boot-log counts ----------
if (CHARACTERS.length !== 32) throw new Error(`characters ${CHARACTERS.length} != 32`);
if (ITEMS.length < 100) throw new Error(`items ${ITEMS.length} < 100`);
if (WEAPONS.length !== 26) throw new Error(`weapons ${WEAPONS.length} != 26`);
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
  vitality: ['Your hit point pool. Downed at 0.', 'Base 80 + modifiers (min 1). Gaining Vitality also grants the difference as current HP. Scaling rate: 1% weapon damage per 4 points.'],
  ferocity: ['The universal damage multiplier.', 'Hit = weapon base × tier mult × `(1 + Ferocity%/100)` × `(1 + scaling-tag bonus/100)`. Crits are granted-only, ×2 (×3 Duskblade).'],
  tempo: ['One stat for all speed.', 'Attack cooldown = `base / max(0.25, 1 + Tempo%/100)`; move speed = `300 × (1 + Tempo%/100)`, floored at 60.'],
  grit: ['Mitigation and stubbornness.', 'Damage taken = `raw × 15 / (15 + Grit)` (negative capped at +50% extra); pulls/knockback resisted by the same ratio. Scaling rate: 1%/point.'],
  reflex: ['Chance to ignore a hit entirely.', 'Percent roll per hit, capped at 60 (Wisp raises to 90). Every on-dodge effect (Slipstream, Afterimage, items) keys off this.'],
  recovery: ['Amplifies ALL healing received.', 'Every healing source (regen, lifesteal, kill-heals, fight-clear breathers, floor heals) lands at `×(1 + Recovery%/100)`.'],
  ingenuity: ['Power source for summons/structures.', 'Summon damage AND HP `×(1 + 0.1 × Ingenuity)`. Scaling rate: 1%/point on summon-tagged weapons.'],
  attunement: ['Elemental/status amplifier.', 'Burns, chills (strength and duration), chains, novas, blasts and echoes all scale `×(1 + Attunement%/100)`.'],
  greed: ['Fortune unified.', 'Rarity weights for uncommon+ `×(1 + Greed/100)` everywhere rarity rolls, AND `floor(Greed/2)` materials at every fight clear. No self-growth. Scaling rate: 1%/point.'],
  reach: ['Weapon reach and magnetism.', 'Ranged/lobbed weapons +100% of Reach, melee +30% (floor 40); pickup radius = `60 + Reach × 0.5`. Scaling rate: 1% per 12 points.'],
};

function statCensus(key) {
  const chars = CHARACTERS.filter(c => c.stats && (c.stats[key] || 0) > 0).length;
  const items = ITEMS.filter(it => {
    if (it.stats && it.stats[key] !== undefined) return true;
    const h = it.hooks || {};
    if (h.condStats && h.condStats.stats[key] !== undefined) return true;
    if (h.allyAura && h.allyAura.stats[key] !== undefined) return true;
    if (h.levelStats && h.levelStats.stats[key] !== undefined) return true;
    if (h.floorStats && h.floorStats.stats[key] !== undefined) return true;
    return false;
  }).length;
  const weapons = WEAPONS.filter(w => w.scaling.includes(key)).length;
  return { chars, items, weapons };
}

// dead-stat gate (tuning gate 5): hard failure, not a doc footnote
for (const s of STATS) {
  const c = statCensus(s.key);
  if (c.weapons < 2) throw new Error(`dead stat: ${s.key} on ${c.weapons} weapons (<2)`);
  if (c.items < 5) throw new Error(`dead stat: ${s.key} on ${c.items} items (<5)`);
  if (c.chars < 1) throw new Error(`dead stat: ${s.key} on ${c.chars} character statlines (<1)`);
}

// ---------- section 2: pick-appeal judgments (per character id) ----------
const APPEAL = {
  bulwark: ['H', 'Huge HP plus touch-me-and-suffer; the obvious first pick'],
  cogsmith: ['H', 'Four carryable turret mounts is irresistible novelty'],
  zephyr: ['H', 'Dodge-crits plus tempo bursts feel amazing'],
  tollkeeper: ['M', 'Party-wide tradeoff sparks table arguments'],
  duskblade: ['H', 'Triple crits with a clear first-hit rule'],
  rampart: ['M', 'Ever-growing Grit that feeds damage back'],
  onrush: ['H', 'A visible meter you charge by playing well'],
  vesper: ['M', 'Overheal into permanent HP rewards sustain builds'],
  broker: ['M', 'Cheap shopping with a slot squeeze'],
  resonant: ['M', 'The charge-ring shockwave is readable and rhythmic'],
  facet: ['H', 'A draft pick at every door; collection subgame'],
  stillness: ['M', 'Hold-fire charge shots reward deliberate play'],
  powderkeg: ['M', 'Pickup explosions that scale with Greed and Reach'],
  quartermaster: ['M', 'Weapons-only economy with full-refund selling'],
  mirage: ['M', 'Decoys turn dodges into crowd control'],
  banneret: ['M', 'The party wants to stand near you — solo it still works'],
  sawbones: ['M', 'Medic fantasy with permanent party growth'],
  lodestone: ['M', 'A visible lifeline to your ally; co-op signature'],
  voltaic: ['M', 'Flashy chains with Attunement scaling'],
  wisp: ['M', 'Thrilling 30-HP evasion build for veterans'],
  gilded_one: ['M', 'Legendary-only shop is a fun lottery'],
  redmaw: ['M', 'Simple readable berserker fantasy'],
  glasswing: ['M', 'Double-edged risk appeals to gamblers'],
  twinsoul: ['M', 'Mirror drone doubles your favorite weapon'],
  hemomancer: ['M', 'Innate lifesteal with an overheal shield'],
  jester: ['M', 'Crit odds you can watch ramp on the meter'],
  cindermage: ['M', 'Everything burns; clean Attunement identity'],
  frostcaller: ['M', 'Universal chill is strong utility'],
  longshot: ['M', 'Distance bonus suits natural snipers'],
  threader: ['M', 'Universal pierce is quietly excellent'],
  tinker: ['M', 'Faster turrets with a tight slot puzzle'],
  hivewright: ['M', 'Free drone per floor compounds nicely'],
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
const AXES = ['melee', 'ranged', 'tank', 'dodge', 'speed', 'crit', 'status', 'summons', 'sustain', 'support', 'economy'];
const axisMembers = Object.fromEntries(AXES.map(a => [a,
  CHARACTERS.filter(c => (c.roles || []).includes(a)).map(c => c.name)]));

// ---------- emit ----------
const L = [];
L.push('# Undervault — design audit (post-Great-Rebalance)');
L.push('');
L.push('> Generated from the live content data by `node tools/gen_design_audit.mjs` —');
L.push('> regenerate after any content change; do not hand-edit the computed tables.');
L.push(`> Counts verified against boot log: **${CHARACTERS.length} characters / ${ITEMS.length} items / ${WEAPONS.length} weapons**.`);
L.push('> The generator enforces the dead-stat gate: every stat on ≥2 weapons, ≥5 items, ≥1 statline.');
L.push('');

// -- 1 --
L.push('## 1. Stat glossary (the ten-stat sheet)');
L.push('');
L.push('Census: how many **characters** have the stat positive in their base statline, how');
L.push('many **items** grant it (directly or inside a conditional/aura/per-level/per-floor');
L.push('hook), and how many **weapons** list it as a scaling tag. Crit is not a stat —');
L.push('critical hits exist only as granted effects (default ×2).');
L.push('');
L.push('| Stat | What it does | Formula (as implemented) | Chars | Items | Weapons |');
L.push('|---|---|---|---:|---:|---:|');
for (const s of STATS) {
  const [what, formula] = STAT_DOC[s.key];
  const c = statCensus(s.key);
  L.push(`| **${s.name}** | ${esc(what)} | ${esc(formula)} | ${c.chars} | ${c.items} | ${c.weapons} |`);
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
L.push('### What the rebalance resolved');
L.push('');
L.push('- The 36-character near-duplicate clusters were merged: Bastion+Ironclad → **Rampart**,');
L.push('  Duskblade+Lancer → **Duskblade** (Executioner), Lamprey+Bloodpetal → **Vesper**,');
L.push('  Magnate+Highroller → **The Broker**. Fleetfoot/Skirmisher/Courier\'s "speed becomes value"');
L.push('  triplet collapsed into **Onrush**\'s visible momentum meter.');
L.push('- The invisible-passive traits (Echo, Skirmisher, Chameleon, Lancer, Archivist) were cut or');
L.push('  rebuilt around on-screen artifacts: charge rings, meters, decoys, auras, tethers, boons.');
L.push('- Archivist\'s extra level-up choice survives as the **Archivist\'s Folio** Greed item.');
L.push('');
L.push('### Watch items for playtesting');
L.push('');
L.push(`- Support (${n('support')}) is new and co-op-shaped: Banneret/Sawbones/Lodestone solo modes work but are`);
L.push('  deliberately weaker halves — watch solo pick rates.');
L.push(`- Economy (${n('economy')}) remains the widest axis; the Toll Road party curse and Prism boons make it`);
L.push('  more interactive, but shop-time still concentrates there.');
L.push('- Attunement is the most common weapon scaling tag (by design — every status weapon carries');
L.push('  it), so status builds have the smoothest gearing curve. Ferocity is the safe generalist tag.');
L.push('');

// -- 4 --
L.push('## 4. Brotato-resemblance inventory');
L.push('');
L.push('What already diverges: the Isaac-style room dungeon, door countdowns, bosses,');
L.push('co-op with downs/revives, elite/treasure/shop rooms, the sell/combine arsenal UI —');
L.push('and, after the Great Rebalance, the stat system itself: a ten-stat sheet where any');
L.push('stat can be a weapon\'s damage stat, granted-only crits, source×Recovery healing,');
L.push('and traits that live on visible artifacts. What follows is the list of mechanics');
L.push('that still trace back to Brotato, each with what changing it would ripple into.');
L.push('');
L.push('| # | Mechanic (Brotato-shaped) | Ripple if changed |');
L.push('|---:|---|---|');
const BROTATO = [
  ['Materials double as currency AND XP in one pickup', 'Splitting them changes drop tables, Greed\'s tithe, interest items, level pacing, the HUD, and both economy traits (Tollkeeper, Powderkeg).'],
  ['Banked level-ups → pick 1-of-4 rarity-weighted stat boosts', 'Touches the statboost pool, the offer overlay, Greed\'s rarity bias, and the Archivist\'s Folio item.'],
  ['Weapon tiers I–IV with duplicate-combining into the next tier', 'Touches shop pricing (tier multipliers), the arsenal combine UI, sell values, invested-materials lineage, and turret tier scaling.'],
  ['Reroll/lock shop: 4 slots, escalating reroll cost, rarity weights 62/25/10/3', 'The whole shop economy plus four traits (Broker, Gilded One, Quartermaster, Overseer stock) and lock carryover.'],
  ['Six auto-attacking weapon slots, no aiming', 'Core combat identity; slot-altering traits (Broker, Tinker, Cogsmith) and the aim-free touch scheme depend on it.'],
  ['Rarity bias multiplying uncommon+ weights (now Greed)', 'Shop, treasure, elite rewards, level-up boost sizes, and Prism boon quality all roll through the same function.'],
  ['Summons/structures as a parallel damage class (now Ingenuity)', 'Four summon weapons, four summons characters, and summon-boost items.'],
  ['Character = statline + one rule-breaking trait, huge roster', 'The roster\'s entire design language — though this is the genre hook you likely want to keep.'],
  ['Elites as stat-multiplied base enemies with a modifier', 'Elite room rewards and floor pacing; a light resemblance, cheap to restyle.'],
  ['Four-rarity item pool', 'Item catalog structure, shop card styling, Greed, and treasure/elite reward pools.'],
  ['Wave-style spawn pulses inside a locked room', 'Room pacing, quota scaling, spawn telegraphs, and the co-op spawn multiplier.'],
  ['Percent-stat tooltips and additive statline math', 'The sheet UI, boost pool, item stat blocks, and every trait that reads a stat.'],
];
BROTATO.forEach(([m, r], i) => L.push(`| ${i + 1} | ${esc(m)} | ${esc(r)} |`));
L.push('');

mkdirSync('docs', { recursive: true });
writeFileSync('docs/design-audit.md', L.join('\n') + '\n');
console.log(`docs/design-audit.md written — ${CHARACTERS.length} characters / ${ITEMS.length} items / ${WEAPONS.length} weapons, ${L.length} lines`);
