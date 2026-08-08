// Dev tool: validate an item content module against the engine contract
// (Great Rebalance edition — ten stats, new hook registry, category minimums).
// Usage: node tools/validate_items.mjs js/content/items.js
import { pathToFileURL } from 'url';
import path from 'path';
import { STAT_KEYS } from '../js/config.js';

const RARITIES = ['common', 'uncommon', 'rare', 'legendary'];
const PRICE_RANGE = { common: [8, 20], uncommon: [18, 40], rare: [40, 80], legendary: [80, 150] };

// value-hooks take a params object; flag-hooks are the literal `true`
const HOOKS = {
  regen: ['hps'], lifesteal: ['pct'], killHeal: ['amount'],
  materialHeal: ['chance', 'amount'], roomClearHeal: ['amount'], critHeal: ['amount'],
  reviveSpeed: ['mult'], secondWind: ['healPercent'], blockShield: ['cooldown'],
  condStats: ['cond', 'stats'], nextAttackAfterDodge: ['bonus'],
  critEveryN: ['n'],
  pickupBlast: ['damage', 'radius'], pickupTempo: ['tempo', 'duration', 'maxStacks'],
  pickupBonusChance: ['chance'],
  burnOnHit: ['chance', 'dps', 'duration'], chillOnHit: ['chance', 'mult', 'duration'],
  chainOnHit: ['chance', 'damage', 'range'], statusBoost: ['pct'],
  killExplode: ['chance', 'damage', 'radius'], thorns: ['damage'],
  contactAura: ['dps', 'radius'], onHurtRetaliate: ['damage', 'radius'],
  killTempo: ['tempo', 'duration', 'maxStacks'], eliteBossDamage: ['bonus'],
  extraPierce: ['add'], extraProjectiles: ['add'], knockbackBoost: ['mult'],
  allyAura: ['radius', 'stats'], doubleMaterials: ['chance'],
  interest: ['rate', 'cap'], freeRerolls: ['count'], shopDiscount: ['percent'],
  xpBonus: ['percent'], extraChoice: ['n'],
  levelStats: ['stats'], floorStats: ['stats'], vitalityOnKill: ['amount', 'cap'],
  summonBoost: ['damage', 'hp'],
  // ---- phase 4: the four modifier tiers (§9.2) ----
  critChance: ['percent'], critMult: ['add'],
  selectorAdd: ['select'], domainAdd: ['domain'],
};
// §9.2's tier assignment, enforced rather than described. `radius` lives in
// magnitude EXCLUSIVELY (ranks no longer grant it), and the rider tier is the
// one that adds an effect a skill did not have.
const MAGNITUDE_HOOKS = new Set(['extraPierce', 'extraProjectiles', 'knockbackBoost',
  'eliteBossDamage', 'critChance', 'critMult', 'summonBoost']);
const RIDER_HOOKS = new Set(['burnOnHit', 'chillOnHit', 'chainOnHit']);
const SELECTORS = new Set(['nearest', 'farthest', 'highest_hp', 'lowest_hp', 'densest_cluster', 'objective_target']);
const DOMAINS = new Set(['physical', 'mental', 'spiritual']);
// NO COOLDOWN REDUCTION ON ANY ITEM (§9.2), and no reaching one by proxy. This
// is a name check on top of the effect check in `econ_gate` — cheap, and it
// fails at authoring time rather than at measurement time.
const COOLDOWN_WORDS = /cooldown|cd_|_cd\b|recharge|haste|attackspeed|attack_speed|fire_rate|firerate/i;
const FLAG_HOOKS = new Set(['critAfterKill', 'critVsChilled', 'critVsBurning', 'critVsFullHp', 'firstHitCrit']);
const COND_KINDS = new Set(['enemyNear', 'noEnemyNear', 'hpAbove', 'hpBelow', 'afterKill',
  'firstKill', 'moving', 'still', 'roomEntry', 'bossRoom', 'allyNear', 'onMaterials']);

function checkStats(stats, where, errs) {
  if (typeof stats !== 'object' || !stats) { errs.push(`${where}: stats must be object`); return; }
  for (const [k, v] of Object.entries(stats)) {
    if (!STAT_KEYS.includes(k)) errs.push(`${where}: unknown stat '${k}'`);
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v)) errs.push(`${where}: stat ${k}=${v} must be integer`);
  }
  if (!Object.keys(stats).length) errs.push(`${where}: empty stats object`);
}

const file = process.argv[2] || 'js/content/items.js';
const mod = await import(pathToFileURL(path.resolve(file)).href);
const items = mod.ITEMS || mod.PART;
if (!Array.isArray(items)) { console.error('FAIL: module must export ITEMS array'); process.exit(1); }

const errs = [], warns = [];
const ids = new Set(), names = new Set();
let mechCount = 0;
const rarityCount = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
const cats = { cond: 0, crit: 0, pickup: 0, status: 0, aura: 0, source: 0 };
const statCover = Object.fromEntries(STAT_KEYS.map(k => [k, 0]));

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
  // ---- phase 4 item fields ----
  if (COOLDOWN_WORDS.test(it.id) || COOLDOWN_WORDS.test(it.name || '')) {
    errs.push(`${w}: names a cooldown. §9.2 bans cooldown reduction on every item — no item may reach one, directly or by proxy`);
  }
  if ('penalty' in it) {
    if (!Number.isInteger(it.penalty) || it.penalty <= 0) errs.push(`${w}: penalty must be a positive integer (the magnitude; the STAT is rolled)`);
    if (!it.stats || !Object.keys(it.stats).length) errs.push(`${w}: penalty without stats — §9.2's stat items are "flat + with a randomly rolled −", so there must be a + to trade against`);
    if (Object.values(it.stats || {}).some(v => v < 0)) errs.push(`${w}: a rolled-penalty item must not also hard-code a negative stat — one trade-off per item, and the roll is the trade-off`);
  }
  if ('lateWeight' in it && (typeof it.lateWeight !== 'number' || it.lateWeight < 0 || it.lateWeight > 1)) {
    errs.push(`${w}: lateWeight must be 0..1 (0 = as likely in region 1 as region 8)`);
  }
  if (it.perLevel && !it.perLevel.hooks && !it.stats) {
    errs.push(`${w}: perLevel with neither hooks nor stats — an upgrade that changes nothing is the shop version of a dead stat`);
  }

  const hasStats = it.stats && Object.keys(it.stats).length > 0;
  const hasHooks = it.hooks && Object.keys(it.hooks).length > 0;
  if (!hasStats && !hasHooks) errs.push(`${w}: needs stats or hooks`);
  if (hasStats) checkStats(it.stats, w, errs);

  // stat coverage: plain stats, conditional stats, and aura stats all count
  const covered = new Set(Object.keys(it.stats || {}));
  const h = it.hooks || {};
  if (h.condStats && h.condStats.stats) for (const k of Object.keys(h.condStats.stats)) covered.add(k);
  if (h.allyAura && h.allyAura.stats) for (const k of Object.keys(h.allyAura.stats)) covered.add(k);
  for (const k of covered) if (k in statCover) statCover[k]++;

  if (hasHooks) {
    mechCount++;
    const keys = Object.keys(it.hooks);
    if (keys.length > 2) errs.push(`${w}: more than 2 hooks`);
    for (const [hk, hv] of Object.entries(it.hooks)) {
      if (FLAG_HOOKS.has(hk)) {
        if (hv !== true) errs.push(`${w}: flag hook ${hk} must be literal true`);
        continue;
      }
      const spec = HOOKS[hk];
      if (!spec) { errs.push(`${w}: unknown hook '${hk}'`); continue; }
      if (typeof hv !== 'object' || !hv) { errs.push(`${w}: hook ${hk} params must be object`); continue; }
      for (const p of spec) {
        if (!(p in hv)) errs.push(`${w}: hook ${hk} missing param '${p}'`);
        else if (p === 'stats') checkStats(hv[p], `${w}.${hk}`, errs);
        else if (p === 'cond') {
          if (!hv.cond || !COND_KINDS.has(hv.cond.kind)) errs.push(`${w}: condStats.cond.kind '${hv.cond && hv.cond.kind}' unknown`);
        // `select` and `domain` are enumerated STRINGS, not magnitudes — they
        // are checked against the live §5.3 and triangle lists further down.
        } else if (p === 'select' || p === 'domain') {
          if (typeof hv[p] !== 'string') errs.push(`${w}: hook ${hk}.${p} must be a string`);
        } else if (typeof hv[p] !== 'number' || !Number.isFinite(hv[p])) errs.push(`${w}: hook ${hk}.${p} must be number`);
      }
      for (const p of Object.keys(hv)) if (!spec.includes(p)) errs.push(`${w}: hook ${hk} unknown param '${p}'`);
      if (hk === 'extraProjectiles' && it.rarity !== 'legendary') errs.push(`${w}: extraProjectiles must be legendary`);
      if (hk === 'selectorAdd' && !SELECTORS.has(hv.select)) errs.push(`${w}: selectorAdd.select '${hv.select}' is not a §5.3 selector`);
      if (hk === 'domainAdd' && !DOMAINS.has(hv.domain)) errs.push(`${w}: domainAdd.domain '${hv.domain}' is not a domain`);
      // §9.2: radius lives in magnitude only, since ranks no longer grant it.
      if ('radius' in hv && !MAGNITUDE_HOOKS.has(hk) && !RIDER_HOOKS.has(hk) && hk !== 'pickupBlast' && hk !== 'contactAura' && hk !== 'onHurtRetaliate' && hk !== 'killExplode' && hk !== 'allyAura') {
        errs.push(`${w}: hook ${hk} carries a radius, and radius lives in magnitude items only (§9.2)`);
      }
      for (const p of ['chance', 'mult', 'healPercent']) {
        if (p in hv && (hv[p] <= 0 || hv[p] > 1)) errs.push(`${w}: hook ${hk}.${p}=${hv[p]} must be in (0,1]`);
      }
    }
    if (h.condStats) cats.cond++;
    if (h.critAfterKill || h.critEveryN || h.critVsChilled || h.critVsBurning || h.critVsFullHp || h.firstHitCrit) cats.crit++;
    if (h.pickupBlast || h.pickupTempo || h.pickupBonusChance) cats.pickup++;
    if (h.burnOnHit || h.chillOnHit || h.chainOnHit || h.statusBoost) cats.status++;
    if (h.allyAura) cats.aura++;
    if (h.regen || h.lifesteal || h.killHeal || h.materialHeal || h.roomClearHeal || h.critHeal) cats.source++;
    if (!it.desc || it.desc.length < 12) errs.push(`${w}: hooks require exact desc`);
    else if (!/\d/.test(it.desc) && ![...FLAG_HOOKS].some(k => k in h)) warns.push(`${w}: desc has no numbers — must state effect exactly`);
  }
});

// catalog-level requirements (the Great Rebalance gates)
if (items.length < 100) errs.push(`catalog has ${items.length} items (<100)`);
if (cats.cond < 30) errs.push(`conditional items: ${cats.cond} (<30)`);
if (cats.crit < 6) errs.push(`crit-granting items: ${cats.crit} (<6)`);
if (cats.pickup < 4) errs.push(`per-pickup proc items: ${cats.pickup} (<4)`);
if (cats.status < 6) errs.push(`status spreader items: ${cats.status} (<6)`);
if (cats.aura < 4) errs.push(`aura/party items: ${cats.aura} (<4)`);
for (const [k, n] of Object.entries(statCover)) if (n < 5) errs.push(`stat '${k}' appears on ${n} items (<5)`);

console.log(`items: ${items.length}, mechanical: ${mechCount}, rarities:`, rarityCount);
console.log('categories:', cats);
console.log('stat coverage:', statCover);
if (warns.length) console.log('WARNINGS:\n' + warns.map(e => '  ' + e).join('\n'));
if (errs.length) { console.log('ERRORS:\n' + errs.map(e => '  ' + e).join('\n')); console.log('FAIL'); process.exit(1); }
console.log('OK');
