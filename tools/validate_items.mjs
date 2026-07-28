// Dev tool: validate an item content module against the engine contract.
// Usage: node tools/validate_items.mjs js/content/items_pack_a.js  (or items.js)
import { pathToFileURL } from 'url';
import path from 'path';

const STAT_KEYS = ['maxHp','hpRegen','lifeSteal','damage','meleeDamage','rangedDamage',
  'elementalDamage','attackSpeed','critChance','engineering','range','armor','dodge',
  'speed','luck','harvesting'];
const RARITIES = ['common','uncommon','rare','legendary'];
const PRICE_RANGE = { common:[8,20], uncommon:[18,40], rare:[40,80], legendary:[80,150] };

const HOOKS = {
  firstHitCrit: [], killExplode: ['chance','damage','radius'], thorns: ['damage'],
  reviveSpeed: ['mult'], allyAura: ['radius','stats'], pickupRadius: ['add'],
  roomClearHeal: ['amount'], lowHpBonus: ['threshold','stats'], critHeal: ['amount'],
  burnOnHit: ['chance','dps','duration'], chainOnHit: ['chance','damage','range'],
  slowOnHit: ['chance','mult','duration'], blockShield: ['cooldown'],
  secondWind: ['healPercent'], doubleMaterials: ['chance'], eliteBossDamage: ['bonus'],
  interest: ['rate','cap'], freeRerolls: ['count'], shopDiscount: ['percent'],
  xpBonus: ['percent'], extraPierce: ['add'], extraProjectiles: ['add'],
  killFrenzy: ['attackSpeed','duration','maxStacks'], contactAura: ['dps','radius'],
  onHurtRetaliate: ['damage','radius'], dodgeToDamage: ['bonus','duration'],
  harvestGrowth: ['percent'], levelStats: ['stats'], floorStats: ['stats'],
  maxHpOnKill: ['amount','cap'], summonBoost: ['damage','hp'], knockbackBoost: ['mult'],
  materialHeal: ['chance','amount'],
};

function checkStats(stats, where, errs) {
  if (typeof stats !== 'object' || !stats) { errs.push(`${where}: stats must be object`); return; }
  for (const [k, v] of Object.entries(stats)) {
    if (!STAT_KEYS.includes(k)) errs.push(`${where}: unknown stat '${k}'`);
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v)) errs.push(`${where}: stat ${k}=${v} must be integer`);
  }
  if (!Object.keys(stats).length) errs.push(`${where}: empty stats object`);
}

const file = process.argv[2];
if (!file) { console.error('usage: node tools/validate_items.mjs <module.js>'); process.exit(2); }
const mod = await import(pathToFileURL(path.resolve(file)).href);
const items = mod.ITEMS || mod.PART;
if (!Array.isArray(items)) { console.error('FAIL: module must export PART or ITEMS array'); process.exit(1); }

const errs = [], warns = [];
const ids = new Set(), names = new Set();
let mechCount = 0;
const rarityCount = { common:0, uncommon:0, rare:0, legendary:0 };

items.forEach((it, i) => {
  const w = `item[${i}] ${it && it.id || '?'}`;
  if (!it || typeof it !== 'object') { errs.push(`${w}: not an object`); return; }
  if (!it.id || !/^[a-z][a-z0-9_]*$/.test(it.id)) errs.push(`${w}: bad id`);
  if (ids.has(it.id)) errs.push(`${w}: duplicate id`); ids.add(it.id);
  if (!it.name || typeof it.name !== 'string' || it.name.length > 26) errs.push(`${w}: bad name`);
  const lower = (it.name || '').toLowerCase();
  if (names.has(lower)) errs.push(`${w}: duplicate name '${it.name}'`); names.add(lower);
  if (!RARITIES.includes(it.rarity)) errs.push(`${w}: bad rarity`);
  else {
    rarityCount[it.rarity]++;
    const [lo, hi] = PRICE_RANGE[it.rarity];
    if (typeof it.price !== 'number' || it.price < lo || it.price > hi) errs.push(`${w}: price ${it.price} outside ${lo}-${hi} for ${it.rarity}`);
  }
  const hasStats = it.stats && Object.keys(it.stats).length > 0;
  const hasHooks = it.hooks && Object.keys(it.hooks).length > 0;
  if (!hasStats && !hasHooks) errs.push(`${w}: needs stats or hooks`);
  if (hasStats) checkStats(it.stats, w, errs);
  if (hasHooks) {
    mechCount++;
    const keys = Object.keys(it.hooks);
    if (keys.length > 2) errs.push(`${w}: more than 2 hooks`);
    for (const [hk, hv] of Object.entries(it.hooks)) {
      const spec = HOOKS[hk];
      if (!spec) { errs.push(`${w}: unknown hook '${hk}'`); continue; }
      if (typeof hv !== 'object' || !hv) { errs.push(`${w}: hook ${hk} params must be object`); continue; }
      for (const p of spec) {
        if (!(p in hv)) errs.push(`${w}: hook ${hk} missing param '${p}'`);
        else if (p === 'stats') checkStats(hv[p], `${w}.${hk}`, errs);
        else if (typeof hv[p] !== 'number' || !Number.isFinite(hv[p])) errs.push(`${w}: hook ${hk}.${p} must be number`);
      }
      for (const p of Object.keys(hv)) if (!spec.includes(p)) errs.push(`${w}: hook ${hk} unknown param '${p}'`);
      if (hk === 'extraProjectiles' && it.rarity !== 'legendary') errs.push(`${w}: extraProjectiles must be legendary`);
      for (const p of ['chance','mult','threshold','healPercent']) {
        if (p in hv && (hv[p] <= 0 || hv[p] > 1)) errs.push(`${w}: hook ${hk}.${p}=${hv[p]} must be in (0,1]`);
      }
    }
    if (!it.desc || it.desc.length < 12) errs.push(`${w}: hooks require exact desc`);
    else if (!/\d/.test(it.desc) && !('firstHitCrit' in (it.hooks||{}))) warns.push(`${w}: desc has no numbers — must state effect exactly`);
  }
  if ((it.rarity === 'rare' || it.rarity === 'legendary') && hasStats && !hasHooks) {
    if (!Object.values(it.stats).some(v => v < 0)) errs.push(`${w}: rare+ stat-only item needs a negative stat tradeoff`);
  }
});

console.log(`items: ${items.length}, mechanical: ${mechCount}, rarities:`, rarityCount);
if (warns.length) console.log('WARNINGS:\n' + warns.map(e => '  ' + e).join('\n'));
if (errs.length) { console.log('ERRORS:\n' + errs.map(e => '  ' + e).join('\n')); console.log('FAIL'); process.exit(1); }
console.log('OK');
