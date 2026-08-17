// TELEGRAPH DENSITY AND ROSTER WEIGHT, ASSERTED TOGETHER.
//
// Either one alone is satisfiable by breaking the other, and that is how the
// Pacific Northwest got to ×2.14 the HP of the floor-1 table it replaced.
//
// The region rosters were authored to a readability goal: at least half the
// population, by encounter weight, must telegraph, so the hold-or-break
// decision is a read rather than arithmetic. Nothing was authored to a weight
// goal — and `HEAVY_BEHAVIORS` quietly supplied one, because the only
// behaviours allowed to telegraph were the three the roster had authored as
// slabs. **A readability goal imported a weight goal through a set named for
// mass.** Meeting the density floor meant putting more heavy units in the room.
//
// Telegraph is an ANIMATION AND TIMING property. It has no necessary
// relationship to HP: a unit that winds up visibly and dies in two hits is a
// perfectly good teacher, and region 1 — where a player learns to read wind-ups
// at all — wants exactly that. So this gate asserts both halves at once:
//
//   A. Telegraph density ≥ the declared floor, by encounter weight.
//   B. Weighted mean HP and damage within a band of the table the region
//      replaces, at the region's own world multiplier.
//   C. At least two telegraphers BELOW the roster's median HP, so the read can
//      be learned against something that dies before the lesson is punishing.
//      A and B together are still satisfiable by one 4-HP telegrapher carrying
//      the density while every other committing unit is a slab.
//
// WHY A BAND AND NOT A NUMBER. `FLOOR_TABLES[0]` is the roster region 1
// replaced, and region 1 sits at ×1.00 on the world axis, so parity is the
// target rather than an aspiration. Later regions carry their own multiplier
// and are REPORTED rather than gated — the composed figure is what matters
// there, and deciding it is a separate patch.
//
// Usage: node tools/roster_weight_gate.mjs [--verbose]
import { REGION_ENEMIES, telegraphWeight, MIN_TELEGRAPH_WEIGHT } from '../js/content/regions-enemies.js';
import { ENEMY_BY_ID, FLOOR_TABLES } from '../js/content/enemies.js';
import { REGIONS, regionHpMult, regionDmgMult, TOTAL_REGIONS } from '../js/regions.js';

const VERBOSE = process.argv.includes('--verbose');
let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };

// Weighted by encounter weight, which is the only average that describes what a
// player actually meets. An unweighted mean counts the Bark Hulk exactly as
// often as the Sapling, and the whole lever this patch used was the weights.
const weightedMean = (units, f) => {
  let n = 0, d = 0;
  for (const e of units) { n += e.w * f(e); d += e.w; }
  return d ? n / d : 0;
};
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// The roster region 1 replaces. Floor 1's table, at ×1.00, is the yardstick.
const FLOOR1 = FLOOR_TABLES[0].map(id => ENEMY_BY_ID[id]);
const REF_HP = weightedMean(FLOOR1, e => e.hp);
const REF_DMG = weightedMean(FLOOR1, e => e.dmg);
const BAND = 0.15;

// GATED REGIONS are the ones whose reference is known. Region 1 replaces floor
// 1 at ×1.00; every later region multiplies, and what its parity target should
// be is an open design question rather than something this gate may invent.
const GATED = new Set([1]);

console.log('ROSTER WEIGHT AND TELEGRAPH DENSITY — the two halves of one coupling\n');
console.log(`reference: floor-1 table (${FLOOR_TABLES[0].join(', ')}) — weighted mean HP ${REF_HP.toFixed(1)}, damage ${REF_DMG.toFixed(2)}`);
console.log(`band: ±${(BAND * 100).toFixed(0)}% → HP [${(REF_HP * (1 - BAND)).toFixed(1)}, ${(REF_HP * (1 + BAND)).toFixed(1)}], damage [${(REF_DMG * (1 - BAND)).toFixed(2)}, ${(REF_DMG * (1 + BAND)).toFixed(2)}]\n`);

for (const region of REGIONS) {
  const units = REGION_ENEMIES[region.id].enemies;
  const { total, tel, share } = telegraphWeight(units);
  const hp = weightedMean(units, e => e.hp);
  const dmg = weightedMean(units, e => e.dmg);
  const med = median(units.map(e => e.hp));
  const lightTel = units.filter(e => e.telegraph && e.hp < med);
  const gated = GATED.has(region.index);

  console.log(`── region ${region.index} · ${region.name}${gated ? '' : '  (reported, not gated)'}`);
  if (VERBOSE) {
    for (const e of [...units].sort((a, b) => a.hp - b.hp)) {
      console.log(`     ${e.id.padEnd(20)} hp ${String(e.hp).padStart(3)}  dmg ${String(e.dmg).padStart(2)}`
        + `  w ${e.w.toFixed(2)}  ${e.telegraph ? `telegraph ${String(e.telegraph.damage).padStart(2)} @ ${e.telegraph.windupMs}ms` : 'chaff'}`);
    }
  }

  // ---- A. the readability floor ----
  if (share >= MIN_TELEGRAPH_WEIGHT) {
    ok(`region ${region.index} telegraph density ${(share * 100).toFixed(1)}% by encounter weight (${tel.toFixed(2)}/${total.toFixed(2)}), at or over the ${(MIN_TELEGRAPH_WEIGHT * 100).toFixed(0)}% floor`);
  } else {
    bad(`region ${region.index} telegraph density ${(share * 100).toFixed(1)}%, under the ${(MIN_TELEGRAPH_WEIGHT * 100).toFixed(0)}% floor — `
      + 'weight relief must not be bought by removing telegraphs');
  }

  // ---- B. the weight band ----
  const composedHp = hp * regionHpMult(region.index);
  const composedDmg = dmg * regionDmgMult(region.index);
  if (gated) {
    const hpOff = (hp - REF_HP) / REF_HP, dmgOff = (dmg - REF_DMG) / REF_DMG;
    if (Math.abs(hpOff) <= BAND) ok(`region ${region.index} weighted mean HP ${hp.toFixed(1)} — ${(hpOff * 100 >= 0 ? '+' : '')}${(hpOff * 100).toFixed(1)}% against the floor-1 table it replaces`);
    else bad(`region ${region.index} weighted mean HP ${hp.toFixed(1)} is ${(hpOff * 100 >= 0 ? '+' : '')}${(hpOff * 100).toFixed(1)}% against the floor-1 table's ${REF_HP.toFixed(1)} — `
      + `region ${region.index} sits at ×${regionHpMult(region.index).toFixed(2)} on the world axis, so the weight is in the units themselves`);

    if (Math.abs(dmgOff) <= BAND) ok(`region ${region.index} weighted mean contact damage ${dmg.toFixed(2)} — ${(dmgOff * 100 >= 0 ? '+' : '')}${(dmgOff * 100).toFixed(1)}%`);
    else bad(`region ${region.index} weighted mean contact damage ${dmg.toFixed(2)} is ${(dmgOff * 100 >= 0 ? '+' : '')}${(dmgOff * 100).toFixed(1)}% against ${REF_DMG.toFixed(2)}`);

    // ---- C. the coupling, broken and asserted broken ----
    if (lightTel.length >= 2) {
      ok(`region ${region.index} has ${lightTel.length} telegrapher(s) below its median HP of ${med} (${lightTel.map(e => `${e.id} ${e.hp}`).join(', ')}) — the read can be learned on something that dies`);
    } else {
      bad(`region ${region.index} has ${lightTel.length} telegrapher(s) below its median HP of ${med} — want at least 2. `
        + 'Density and mean weight can BOTH be satisfied while every committing unit is a slab and one 4-HP outlier carries the average; '
        + 'this is the check that says the coupling is actually broken rather than averaged around');
    }
  } else {
    checks++;
    console.log(`✓ REPORTED, not gated: region ${region.index} weighted mean HP ${hp.toFixed(1)} (×${regionHpMult(region.index).toFixed(2)} world axis = **${composedHp.toFixed(1)} composed**, `
      + `${(composedHp / REF_HP).toFixed(2)}× the floor-1 table), damage ${dmg.toFixed(2)} (composed ${composedDmg.toFixed(2)}, ${(composedDmg / REF_DMG).toFixed(2)}×). `
      + `${lightTel.length} telegrapher(s) below its median HP of ${med}.`);
  }
  console.log('');
}

// ---- and the coupling itself, named where it lives ----
{
  const src = await import('node:fs').then(fs => fs.readFileSync(new URL('../js/content/regions-enemies.js', import.meta.url), 'utf8'));
  checks++;
  // The EXPORTED IDENTIFIER, not a mention. The file has to be able to name the
  // old one in prose to explain what changed — `secret_gate` learned the same
  // lesson catching its own header, and the answer there was to be precise
  // about what is actually forbidden rather than to exempt the file.
  const exportsCommitting = /export const COMMITTING_BEHAVIORS\s*=/.test(src);
  const exportsHeavy = /export const HEAVY_BEHAVIORS\s*=/.test(src);
  if (exportsCommitting && !exportsHeavy) {
    console.log('✓ the behaviour set is named for COMMITMENT rather than for mass — `COMMITTING_BEHAVIORS`. '
      + 'The old name is the coupling in one word: it made "may telegraph" and "is a slab" the same predicate, '
      + 'so meeting a readability floor meant adding weight.');
  } else {
    fails++;
    console.log('✗ `HEAVY_BEHAVIORS` is back. The set governs which units may TELEGRAPH, which is a timing property; '
      + 'naming it for mass is what made a readability goal import a weight goal.');
  }
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A REGION IS BUYING READABILITY WITH WEIGHT' : 'READABILITY AND WEIGHT ARE INDEPENDENT, AND BOTH HOLD');
process.exit(fails ? 1 : 0);
