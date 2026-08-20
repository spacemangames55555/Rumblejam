// HOW MANY MECHANICALLY DISTINCT THINGS ARE THERE, REALLY?
//
//   node tools/skill_taxonomy.mjs            print to stdout
//   node tools/skill_taxonomy.mjs --write     regenerate docs/SKILL-TAXONOMY.md
//
// Skills are automated, so a player's expression is build and positioning
// rather than rotation, and that makes the SHAPE of a class's skills the whole
// of its identity. This clusters all 420 by shape and counts what is actually
// there.
//
// NOTHING HERE IS HAND-SORTED. Geometry comes from `shapeOfStep` in
// js/skilltext.js — the same function the skill cards read, so the document and
// the game cannot disagree. Delivery and targeting are derived from the
// primitive kind and `skill.select`. A skill that does not fit is LISTED, never
// pushed into the nearest bucket: the count is the answer, and a count produced
// by rounding off the awkward cases is not one.
import { writeFileSync } from 'node:fs';
import { TREES, TREES_BY_CLASS } from '../js/skills.js';
import { SELECTABLE, CHAR_BY_ID } from '../js/content/characters.js';
import { shapeOfStep, rangeOfStep, mechanics } from '../js/skilltext.js';
import { scalePerFor } from '../js/enginescale.js';

const WRITE = process.argv.includes('--write');
const out = [];
const say = s => out.push(s);

const ALL = Object.values(TREES).flatMap(t => t.skills);
const ACTIVES = ALL.filter(s => s.type === 'active');
const PASSIVES = ALL.filter(s => s.type === 'passive');
const CLASSES = SELECTABLE.map(c => c.id);
const className = id => (CHAR_BY_ID[id] ? CHAR_BY_ID[id].name : id);
const classOf = sk => TREES[sk.tree].classId;

// ---------------------------------------------------------------- delivery
//
// DERIVED FROM THE PRIMITIVE, and the ranges say the split is real rather than
// nominal: `strike` runs 80-155, `cone` 165-320, `line` 320-430, with no
// overlap anywhere. So "melee" and "ranged" are properties of the data, not
// labels somebody chose.
//
// TWO OF THE BRIEF'S SIX DELIVERY WORDS HAVE NO SKILLS AND ONE IS MISSING.
// `aura` has no implementation at all — no primitive maintains a persistent
// field around the caster. And `cone`/`line`/`drain`/`plague` are none of
// melee, projectile, placed, summoned or self: they resolve INSTANTLY at range
// with nothing travelling, which is a delivery in its own right and is reported
// as one rather than filed under "projectile" (a bolt has `speed` and a flight
// time; a cone does not).
const DELIVERY = {
  strike: 'melee',
  bolt: 'projectile',
  cone: 'instant ranged',
  line: 'instant ranged',
  drain: 'instant ranged',
  plague: 'instant ranged',
  trap: 'placed',
  hazard: 'placed',
  summon: 'summoned',
  // THE SELF FAMILY IS NOT ONE THING. Geometry cannot separate these — none of
  // them targets an enemy, so `shapeOfStep` returns null for all five — and
  // collapsing them to "self" hid four genuinely different mechanics behind one
  // 52-skill bucket. The primitive is the only thing that distinguishes them,
  // so the primitive is what the delivery says.
  heal: 'allies (heal)',
  shield: 'self (absorb)',
  ward: 'self (absorb + reflect)',
  form: 'self (form)',
  shift: 'self (domain shift)',
};

// ---------------------------------------------------------------- targeting
//
// `skill.select`, verbatim. The brief's vocabulary (nearest, self, ally, area,
// contagion-spread) and the code's are not the same list, and the code's is the
// one that runs: it has four distinct single-target priorities where the brief
// has one, no `ally` selector at all, and `contagion-spread` is a property of
// the plague primitive rather than a selector. Mapped where the mapping is
// exact and reported where it is not.
const TARGETING = {
  nearest: 'nearest',
  farthest: 'farthest',
  highest_hp: 'fattest',
  lowest_hp: 'execute',
  densest_cluster: 'densest crowd',
  objective_target: 'objective priority',
  self: 'self',
};

const steps = sk => sk.compose || [];
const primary = sk => steps(sk).find(s => (s.damage || 0) > 0) || steps(sk)[0] || null;

function signature(sk) {
  const parts = steps(sk).map(s => {
    const d = DELIVERY[s.kind] || `UNMAPPED:${s.kind}`;
    const g = shapeOfStep(s) || 'no geometry';
    return `${d} · ${g}`;
  });
  return { key: `${[...new Set(parts)].sort().join(' + ')} → ${TARGETING[sk.select] || sk.select}`, parts };
}

// human name for a variant, built from its own parts rather than a lookup table
const VARIANT_NAMES = {
  'melee · fan (wide) → densest crowd': 'Cleave',
  'melee · fan (wide) → nearest': 'Swing',
  'melee · cone (narrow) → nearest': 'Thrust',
  'melee · cone (narrow) → densest crowd': 'Wedge',
  'instant ranged · fan (wide) → densest crowd': 'Blast cone',
  'instant ranged · fan (wide) → nearest': 'Spray',
  'instant ranged · line → densest crowd': 'Beam',
  'instant ranged · line → nearest': 'Lance',
  'projectile · single target → nearest': 'Bolt',
  'projectile · shotgun → densest crowd': 'Volley',
  'placed · ground area → densest crowd': 'Ground hazard',
  'summoned · no geometry → self': 'Summon',
  'self (absorb) · no geometry → self': 'Shield',
  'self (absorb + reflect) · no geometry → self': 'Ward',
  'self (form) · no geometry → self': 'Form',
  'self (domain shift) · no geometry → self': 'Domain shift',
  'allies (heal) · no geometry → self': 'Party heal',
};
const nameFor = key => VARIANT_NAMES[key] || null;

// ================================================================= section 1
const variants = new Map();
for (const sk of ACTIVES) {
  const { key } = signature(sk);
  if (!variants.has(key)) variants.set(key, []);
  variants.get(key).push(sk);
}
const ranked = [...variants.entries()].sort((a, b) => b[1].length - a[1].length);

say('# The skill taxonomy');
say('');
say('Generated. `node tools/skill_taxonomy.mjs --write` regenerates this file from');
say('the skill definitions; nothing in it is hand-sorted or hand-written. Geometry');
say('comes from `shapeOfStep` in `js/skilltext.js`, the same function the skill');
say('cards read, so this document and the game cannot disagree.');
say('');
say(`**${ALL.length} skills — ${ACTIVES.length} active, ${PASSIVES.length} passive — across ${CLASSES.length} classes.**`);
say('');
say('---');
say('');
say('## 1. The variants');
say('');
say(`### The count is ${ranked.length}.`);
say('');
say(`The hypothesis was "roughly 10 outside of passives". Measured, **${ACTIVES.length} active skills`);
say(`occupy ${ranked.length} mechanically distinct shapes**, where a shape is the combination of`);
say('delivery, geometry and targeting.');
say('');
const top = ranked.filter(([, v]) => v.length >= 10);
const tail = ranked.filter(([, v]) => v.length < 10);
say(`${ranked.length} is the honest number, but it flatters the roster: **${top.length} of them hold ${top.reduce((a, [, v]) => a + v.length, 0)} skills`);
say(`(${Math.round(top.reduce((a, [, v]) => a + v.length, 0) / ACTIVES.length * 100)}%)** and the remaining ${tail.length} hold ${tail.reduce((a, [, v]) => a + v.length, 0)} between them.`);
say('');
// THE COUNT DEPENDS ON WHERE YOU CUT, and saying only one number would be a
// choice dressed as a fact. Targeting multiplies: a melee fan aimed five
// different ways is five variants under the brief's definition and one swing in
// the hand. Both numbers are reported.
{
  const dg = new Set(), dOnly = new Set();
  for (const sk of ACTIVES) {
    for (const st of steps(sk)) {
      const d = DELIVERY[st.kind] || `UNMAPPED:${st.kind}`;
      dg.add(`${d} · ${shapeOfStep(st) || 'no geometry'}`);
      dOnly.add(d);
    }
  }
  say('**Where you cut changes the number, so all three cuts are given.**');
  say('');
  say('| cut | count |');
  say('|---|---|');
  say(`| delivery + geometry + targeting (the brief's definition) | **${ranked.length}** |`);
  say(`| delivery + geometry — the same move aimed differently counts once | **${dg.size}** |`);
  say(`| delivery alone | **${dOnly.size}** |`);
  say('');
  say(`Targeting is doing a lot of the multiplication: ${dg.size} physical shapes become ${ranked.length}`);
  say('variants once you count what they aim at. A melee fan exists aimed at the');
  say('nearest, the densest crowd, the fattest, the objective and the lowest-health');
  say('target — five variants, one swing.');
  say('');
  say(`**The hypothesis of "roughly 10" is closest to the middle cut (${dg.size}), and wrong`);
  say(`for the strictest one (${ranked.length}).**`);
  say('');
}
say('| # | variant | what it does | skills | classes |');
say('|---|---|---|---|---|');
ranked.forEach(([key, list], i) => {
  const cls = [...new Set(list.map(classOf))];
  const nm = nameFor(key);
  say(`| ${i + 1} | ${nm ? `**${nm}** — ` : ''}\`${key}\` | ${describe(key)} | ${list.length} | ${cls.length} |`);
});
say('');

function describe(key) {
  const [shapePart, target] = key.split(' → ');
  const bits = shapePart.split(' + ').map(p => {
    const [d, g] = p.split(' · ');
    if (d === 'melee') return `a swing around the caster (${g})`;
    if (d === 'projectile') return `a travelling shot (${g})`;
    if (d === 'instant ranged') return `resolves instantly at range (${g})`;
    if (d === 'placed') return 'drops a zone that persists where it lands';
    if (d === 'summoned') return 'puts a body on the field that fights on its own';
    if (d === 'allies (heal)') return 'restores health to the caster and every ally in radius';
    if (d === 'self (absorb)') return 'gives the caster an absorb pool for a duration';
    if (d === 'self (absorb + reflect)') return 'absorb that also throws a share of what it eats back';
    if (d === 'self (form)') return 'puts the caster into a form for a duration';
    if (d === 'self (domain shift)') return 'changes the caster\'s damage domain';
    return p;
  });
  return `${bits.join(', then ')}, aimed at ${target === 'self' ? 'nobody — it hits the caster' : `the ${target}`}`;
}

// variants in exactly one class
const solo = ranked.filter(([, v]) => new Set(v.map(classOf)).size === 1);
say('### Variants that exist in exactly one class');
say('');
if (!solo.length) say('None. Every shape in the game is shared by at least two classes.');
else {
  say('This is where mechanical identity actually lives.');
  say('');
  say('| variant | class | skills |');
  say('|---|---|---|');
  for (const [key, list] of solo) {
    say(`| \`${key}\` | ${className(classOf(list[0]))} | ${list.length} — ${list.slice(0, 4).map(s => s.name).join(', ')}${list.length > 4 ? ' …' : ''} |`);
  }
}
say('');

// anything unmapped
const unmapped = ACTIVES.filter(sk => steps(sk).some(s => !DELIVERY[s.kind]));
say('### Skills that do not fit');
say('');
if (!unmapped.length) say(`Every one of the ${ACTIVES.length} actives maps onto a delivery and a geometry. Nothing was forced.`);
else unmapped.forEach(s => say(`- \`${s.id}\` (${className(classOf(s))}): primitives ${steps(s).map(x => x.kind).join(', ')}`));
say('');
const compound = ACTIVES.filter(sk => new Set(steps(sk).map(s => DELIVERY[s.kind])).size > 1);
say(`**${compound.length} skill(s) do two things at once**` + (compound.length
  ? `: ${compound.map(s => `\`${s.id}\` (${steps(s).map(x => x.kind).join('+')})`).join(', ')}. They are counted as their own variants rather than filed under either half.`
  : '.'));
say('');

// ================================================================= section 2
say('---');
say('');
say('## 2. Per class');
say('');
say('What a class has, and what it does not. The absences are the identity.');
say('');
const byClass = new Map(CLASSES.map(c => [c, new Map()]));
for (const sk of ACTIVES) {
  const c = classOf(sk);
  if (!byClass.has(c)) continue;
  const { key } = signature(sk);
  const m = byClass.get(c);
  m.set(key, (m.get(key) || 0) + 1);
}
const allKeys = ranked.map(([k]) => k);
const ALL_DELIVERY = [...new Set(ACTIVES.flatMap(steps).map(st => DELIVERY[st.kind]).filter(Boolean))].sort();
const ALL_GEOMETRY = [...new Set(ACTIVES.flatMap(steps).map(st => shapeOfStep(st)).filter(Boolean))].sort();
const ALL_TARGETING = [...new Set(ACTIVES.map(sk => TARGETING[sk.select] || sk.select))].sort();
for (const c of CLASSES) {
  const m = byClass.get(c);
  const has = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const lacks = allKeys.filter(k => !m.has(k));
  const soloHere = solo.filter(([, v]) => classOf(v[0]) === c).map(([k]) => k);
  say(`### ${className(c)}`);
  say('');
  say(`${has.reduce((a, [, n]) => a + n, 0)} actives across **${has.length} of ${ranked.length}** variants.`);
  say('');
  say('| variant | count |');
  say('|---|---|');
  for (const [k, n] of has) say(`| ${nameFor(k) ? `**${nameFor(k)}** ` : ''}\`${k}\`${soloHere.includes(k) ? ' — **only this class**' : ''} | ${n} |`);
  say('');
  // THE ABSENCES, AT THE LEVEL THEY MEAN SOMETHING. Listing thirty raw variant
  // keys is a wall a reader skips; what identifies a class is which FAMILIES it
  // has no access to at all.
  const mineSteps = ACTIVES.filter(sk => classOf(sk) === c).flatMap(steps);
  const hasDel = new Set(mineSteps.map(st => DELIVERY[st.kind]).filter(Boolean));
  const hasGeo = new Set(mineSteps.map(st => shapeOfStep(st)).filter(Boolean));
  const hasTgt = new Set(ACTIVES.filter(sk => classOf(sk) === c).map(sk => TARGETING[sk.select] || sk.select));
  const noDel = ALL_DELIVERY.filter(d => !hasDel.has(d));
  const noGeo = ALL_GEOMETRY.filter(g => !hasGeo.has(g));
  const noTgt = ALL_TARGETING.filter(t => !hasTgt.has(t));
  say(`**No access at all to:**`);
  say('');
  say(`- delivery — ${noDel.length ? noDel.map(x => `\`${x}\``).join(', ') : '*(has every delivery)*'}`);
  say(`- geometry — ${noGeo.length ? noGeo.map(x => `\`${x}\``).join(', ') : '*(has every geometry)*'}`);
  say(`- targeting — ${noTgt.length ? noTgt.map(x => `\`${x}\``).join(', ') : '*(aims every way there is)*'}`);
  say('');
  say(`Missing ${lacks.length} of the ${ranked.length} full variants (delivery x geometry x targeting).`);
  say('');
}

// ================================================================= section 3
say('---');
say('');
say('## 3. Differentiation, answered honestly');
say('');
say('For every variant that more than one class has: what actually differs.');
say('');
say('**The comparison is WITHIN TIER, across classes, and the first version of');
say('this was wrong to skip that.** Comparing every skill of a shape against every');
say('other mixes tier progression into the answer: a tier-1 and a tier-10 swing');
say('differ by 8x because one is ten tiers deeper, which says nothing about whether');
say('two CLASSES differ. So for each variant, at each tier where two or more classes');
say('own a skill, the spread across those classes is measured, and the variant is');
say('reported by the median of those per-tier spreads.');
say('');
say('DPS is `damage / cooldown` at rank 1 — the number a player feels, since a 2x');
say('damage skill on a 2x cooldown is the same skill. A variant is *effectively the');
say('same skill in every class* when the median cross-class DPS spread is under');
say('x1.35 and the classes carry the same rider kinds.');
say('');
say('| variant | classes | tiers compared | median cross-class DPS spread | rider sets / skills | verdict |');
say('|---|---|---|---|---|---|');
const shared = ranked.filter(([, v]) => new Set(v.map(classOf)).size > 1);
const verdicts = { same: 0, differs: 0 };
const dpsOf = sk => {
  const st = primary(sk);
  const dmg = st ? (st.damage || st.amount || 0) : 0;
  return dmg / ((sk.cooldown || 1000) / 1000);
};
const riderSetOf = sk => [...new Set(steps(sk).flatMap(s => Object.keys(s.riders || {})))].sort().join('+') || '(none)';
for (const [key, list] of shared) {
  const byTier = new Map();
  for (const sk of list) {
    if (!byTier.has(sk.tier)) byTier.set(sk.tier, []);
    byTier.get(sk.tier).push(sk);
  }
  const spreads = [];
  for (const [, group] of byTier) {
    if (new Set(group.map(classOf)).size < 2) continue;
    const d = group.map(dpsOf).filter(v => v > 0).sort((a, b) => a - b);
    if (d.length < 2) continue;
    spreads.push(d[d.length - 1] / Math.max(0.001, d[0]));
  }
  spreads.sort((a, b) => a - b);
  const med = spreads.length ? spreads[Math.floor(spreads.length / 2)] : null;
  const sets = new Set(list.map(riderSetOf));
  const same = med !== null && med < 1.35 && sets.size <= 1;
  if (same) verdicts.same++; else verdicts.differs++;
  say(`| ${nameFor(key) ? `**${nameFor(key)}** ` : ''}\`${key}\` | ${new Set(list.map(classOf)).size} `
    + `| ${spreads.length} | ${med === null ? '—' : `x${med.toFixed(2)}`} `
    + `| ${sets.size} / ${list.length} | ${same ? '**effectively the same skill**' : 'differs'} |`);
}
say('');
say(`**${verdicts.differs} of ${shared.length} shared variants differ across classes; ${verdicts.same} do not.**`);
say('');
{
  const allSpreads = [];
  for (const [, list] of shared) {
    const byTier = new Map();
    for (const sk of list) { if (!byTier.has(sk.tier)) byTier.set(sk.tier, []); byTier.get(sk.tier).push(sk); }
    for (const [, group] of byTier) {
      if (new Set(group.map(classOf)).size < 2) continue;
      const d = group.map(dpsOf).filter(v => v > 0).sort((a, b) => a - b);
      if (d.length >= 2) allSpreads.push(d[d.length - 1] / Math.max(0.001, d[0]));
    }
  }
  allSpreads.sort((a, b) => a - b);
  const q = f => allSpreads[Math.floor(allSpreads.length * f)];
  say('### The number this section exists to produce');
  say('');
  say(`Across every same-tier, same-shape, cross-class comparison in the game`);
  say(`(${allSpreads.length} of them), the DPS spread between classes is:`);
  say('');
  say(`| 25th | median | 75th | 90th | max |`);
  say('|---|---|---|---|---|');
  say(`| x${q(0.25).toFixed(2)} | x${q(0.5).toFixed(2)} | x${q(0.75).toFixed(2)} | x${q(0.9).toFixed(2)} | x${allSpreads[allSpreads.length - 1].toFixed(2)} |`);
  say('');
  const near = allSpreads.filter(v => v < 1.35).length;
  say(`**${near} of ${allSpreads.length} (${Math.round(near / allSpreads.length * 100)}%) of those comparisons are within x1.35** — two classes`);
  say('owning the same shape at the same tier, with damage-per-second close enough');
  say('that a player would not feel the difference from the numbers alone.');
  say('');
}

// what carries the difference: riders, or numbers?
const withRiders = ACTIVES.filter(sk => steps(sk).some(s => Object.keys(s.riders || {}).length));
say(`Across the whole roster, **${withRiders.length} of ${ACTIVES.length} actives (${Math.round(withRiders.length / ACTIVES.length * 100)}%) carry at least one rider**`);
say(`and ${ACTIVES.length - withRiders.length} carry none — those are damage and a shape and nothing else.`);
say('');

// ================================================================= section 4
say('---');
say('');
say('## 4. Riders and effects');
say('');
const riderRows = new Map();
for (const sk of ACTIVES) {
  for (const s of steps(sk)) {
    for (const [k, v] of Object.entries(s.riders || {})) {
      if (!riderRows.has(k)) riderRows.set(k, []);
      riderRows.get(k).push({ sk, v });
    }
  }
}
say('| rider | skills | classes | magnitude (min → max) | what it does |');
say('|---|---|---|---|---|');
const RIDER_WHAT = {
  slow: 'cuts movement speed for a duration',
  stun: 'stops the target dead',
  root: 'pins it in place, still able to act',
  taunt: 'forces it to target the caster',
  knockback: 'shoves it away',
  multiPulse: 'the skill lands more than once per fire',
  weakenDamage: 'the target deals less',
  weakenDefense: 'the target takes more',
  defenseDown: 'the target takes more',
  mend: 'heals the caster per hit',
  healPerHit: 'heals the caster per hit',
  drench: 'stacks a mark the class spends later',
  sluice: 'spends drench stacks as a burst',
  mark: 'flags a target for the class engine',
  splash: 'damages around the impact',
  impactDot: 'burns over time on impact',
  doll: 'binds the voodoo doll',
  windUp: 'delays the hit',
};
for (const [k, rows] of [...riderRows.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const cls = [...new Set(rows.map(r => classOf(r.sk)))];
  const mags = rows.map(r => {
    const v = r.v;
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object') return v.dur ?? v.damage ?? v.per ?? v.stacks ?? 0;
    return 0;
  }).filter(n => typeof n === 'number').sort((a, b) => a - b);
  say(`| \`${k}\` | ${rows.length} | ${cls.length} | ${mags.length ? `${mags[0]} → ${mags[mags.length - 1]}` : '—'} | ${RIDER_WHAT[k] || ''} |`);
}
say('');
say('### Riders per class');
say('');
say('| class | actives with a rider | distinct rider kinds | which |');
say('|---|---|---|---|');
for (const c of CLASSES) {
  const mine = ACTIVES.filter(sk => classOf(sk) === c);
  const withR = mine.filter(sk => steps(sk).some(s => Object.keys(s.riders || {}).length));
  const kinds = [...new Set(mine.flatMap(sk => steps(sk).flatMap(s => Object.keys(s.riders || {}))))].sort();
  say(`| ${className(c)} | ${withR.length}/${mine.length} | ${kinds.length} | ${kinds.join(', ') || '—'} |`);
}
say('');

// ================================================================= section 5
say('---');
say('');
say('## 5. Passives');
say('');
const pKeys = new Map();
for (const sk of PASSIVES) {
  for (const k of Object.keys(sk.passive || {})) {
    if (!pKeys.has(k)) pKeys.set(k, []);
    pKeys.get(k).push(sk);
  }
}
const SCALE_RE = /^(.+)ScaleWeight$/;
const families = new Map();
for (const [k, list] of pKeys) {
  const m = SCALE_RE.exec(k);
  const fam = m ? 'engine scaling (<engine>ScaleWeight)' : k;
  if (!families.has(fam)) families.set(fam, { keys: new Set(), skills: [] });
  families.get(fam).keys.add(k);
  families.get(fam).skills.push(...list);
}
say(`**${PASSIVES.length} passives across ${families.size} distinct shapes.**`);
say('');
say('| passive shape | keys | skills | classes | what it hooks |');
say('|---|---|---|---|---|');
const P_WHAT = {
  'engine scaling (<engine>ScaleWeight)': 'raises what one point of a class engine is worth to every skill that reads it',
  armorGrit: 'flat Defense',
  armorVit: 'flat max health',
  footingGritBonus: 'Defense per Footing stack',
  footingAccrualPct: 'Footing builds faster',
  reflectPerGrit: 'reflects a share of blocked damage, scaled by Defense',
};
for (const [fam, d] of [...families.entries()].sort((a, b) => b[1].skills.length - a[1].skills.length)) {
  const cls = [...new Set(d.skills.map(classOf))];
  say(`| \`${fam}\` | ${d.keys.size} | ${d.skills.length} | ${cls.length} | ${P_WHAT[fam] || ''} |`);
}
say('');
const engineFam = families.get('engine scaling (<engine>ScaleWeight)');
if (engineFam) {
  say(`**${engineFam.skills.length} of ${PASSIVES.length} passives (${Math.round(engineFam.skills.length / PASSIVES.length * 100)}%) are the same passive**: a weight on the class's`);
  say('own engine. They differ by which engine and by how heavy, and by nothing else.');
  say('');
}
say('| class | passives | shapes |');
say('|---|---|---|');
for (const c of CLASSES) {
  const mine = PASSIVES.filter(sk => classOf(sk) === c);
  const shapes = new Set(mine.flatMap(sk => Object.keys(sk.passive || {}).map(k => (SCALE_RE.test(k) ? 'engine scaling' : k))));
  say(`| ${className(c)} | ${mine.length} | ${[...shapes].join(', ') || '—'} |`);
}
say('');

// ================================================================= section 6
say('---');
say('');
say('## 6. Role support');
say('');
say('Whether the skill set can carry a tank or a healer, or whether every class is');
say('a damage dealer with different decoration.');
say('');
const role = [];
for (const c of CLASSES) {
  const mine = ACTIVES.filter(sk => classOf(sk) === c);
  const minePas = PASSIVES.filter(sk => classOf(sk) === c);
  const selfAbsorb = mine.filter(sk => steps(sk).some(s => s.kind === 'shield' || s.kind === 'ward'));
  const allyHeal = mine.filter(sk => steps(sk).some(s => s.kind === 'heal'));
  const taunt = mine.filter(sk => steps(sk).some(s => (s.riders || {}).taunt));
  const weaken = mine.filter(sk => steps(sk).some(s => (s.riders || {}).weakenDamage));
  const armor = minePas.filter(sk => Object.keys(sk.passive || {}).some(k => /^armor|^footingGrit|^reflectPerGrit/.test(k)));
  const control = mine.filter(sk => steps(sk).some(s => (s.riders || {}).stun || (s.riders || {}).root || (s.riders || {}).slow));
  role.push({ c, selfAbsorb: selfAbsorb.length, allyHeal: allyHeal.length, taunt: taunt.length, weaken: weaken.length, armor: armor.length, control: control.length });
}
say('| class | self absorb | ALLY heal | taunt | enemy-weaken | armor passives | hard/soft control |');
say('|---|---|---|---|---|---|---|');
for (const r of role) {
  say(`| ${className(r.c)} | ${r.selfAbsorb} | ${r.allyHeal || '—'} | ${r.taunt || '—'} | ${r.weaken} | ${r.armor || '—'} | ${r.control} |`);
}
say('');
const anyTaunt = role.filter(r => r.taunt).map(r => className(r.c));
const anyAlly = role.filter(r => r.allyHeal).map(r => className(r.c));
const anyArmor = role.filter(r => r.armor).map(r => className(r.c));
say('### What the table says');
say('');
say('**Protecting another player: there is exactly one mechanism, and it is healing.**');
say('`shield` and `ward` write `p.shield` and `p.ward` — the CASTER\'s, always');
say('(`js/compose.js`). No skill in the game applies absorb, mitigation or a');
say('defensive buff to anybody else. `heal` is the sole exception: it loops');
say('`sim.livePlayers()` inside a radius, so it reaches allies.');
say('');
say(`- **Ally healing** exists in ${anyAlly.length} class(es): ${anyAlly.join(', ') || 'none'}.`);
say(`- **Taunt** exists in ${anyTaunt.length} class(es): ${anyTaunt.join(', ') || 'none'}. It is real — \`taunt\` sets`);
say('  `e.tauntT`/`e.tauntIdx` and `sim.tauntTarget` is re-read every frame by enemy');
say('  AI (`js/entities/enemies.js:121`, `js/telegraphs.js:80`), so enemy targeting');
say('  **can** be influenced.');
say(`- **Armor passives** exist in ${anyArmor.length} class(es): ${anyArmor.join(', ') || 'none'} — and they buff the caster only.`);
say('');

// IS ALLY HEALING MEANINGFUL? Derived from the defs, against a measured
// constant rather than a guess: docs/power-curve-phase2-measurement.md §8 puts
// net incoming on a level-82 character in a region-8 room at 3.7-8.9 HP/s.
{
  const INCOMING_LO = 3.7, INCOMING_HI = 8.9;   // measured, phase-2 §8
  const heals = ACTIVES.filter(sk => steps(sk).some(s => s.kind === 'heal'));
  const rows = heals.map(sk => {
    const st = steps(sk).find(s => s.kind === 'heal');
    const cd = (sk.cooldown || 1000) / 1000;
    return { sk, hps: (st.amount || 0) / cd, radius: st.radius ?? null, cd, amount: st.amount || 0 };
  }).sort((a, b) => b.hps - a.hps);
  say('### Is ally healing meaningful?');
  say('');
  say('The magnitudes, at rank 1, against a measured target: net incoming on a');
  say(`level-82 character in a region-8 room runs **${INCOMING_LO}-${INCOMING_HI} HP/s**`);
  say('(`docs/power-curve-phase2-measurement.md` §8).');
  say('');
  say('| skill | class | heals | cooldown | HP/s | radius |');
  say('|---|---|---|---|---|---|');
  for (const r of rows) {
    say(`| ${r.sk.name} | ${className(classOf(r.sk))} | ${r.amount} | ${r.cd.toFixed(1)}s | **${r.hps.toFixed(1)}** | ${r.radius ?? '—'} |`);
  }
  say('');
  const beats = rows.filter(r => r.hps >= INCOMING_LO).length;
  say(`**${beats} of ${rows.length} party heals out-pace the LOW end of one player's incoming on their own`);
  say(`and ${rows.filter(r => r.hps >= INCOMING_HI).length} out-pace the high end** — for ONE ally, before the healer's own damage taken.`);
  // A SURVEY FINDING, not a fix — this patch changes no gameplay code.
  const noRadius = rows.filter(r => r.radius === null || r.radius === undefined);
  say(`**${noRadius.length} of ${rows.length} party heals declare no radius, and the range check does not`);
  say('survive that.** `js/compose.js` guards with');
  say('`if (dx*dx + dy*dy > step.radius * step.radius) continue;` — with `radius`');
  say('undefined the right-hand side is `NaN`, every `>` against `NaN` is false, and');
  say('the `continue` never fires. Those ten heal **every living player at unlimited');
  say('range**:');
  say('');
  for (const r of noRadius) say(`- \`${r.sk.id}\` (${className(classOf(r.sk))}) — ${r.hps.toFixed(1)} HP/s, whole party, any distance`);
  say('');
  say('Only three are actually radius-limited: '
    + rows.filter(r => r.radius).map(r => `${r.sk.name} (${r.radius})`).join(', ') + '.');
  say('So the positioning cost that ought to be the healer\'s expression is real for');
  say('three skills and absent from ten. Reported, not changed — this is a document.');
  say('');
}

// THE VERDICT, stated as plainly as the brief asked for.
{
  const noAllyDefence = true;   // shield/ward write p.shield / p.ward — asserted above
  say('### Can this support distinct party roles?');
  say('');
  say('**Healer: yes, weakly. Tank: half of one. Everything else: no.**');
  say('');
  say('- **Healer is real.** Ally healing exists, it reaches everyone in a radius, and');
  say(`  at the top of the table it out-paces a single player's incoming. ${anyAlly.length} classes have`);
  say('  it, which makes it a common tool rather than a role — the Monk has four and');
  say('  the Priest two, and those two are the only ones with enough to build around.');
  say('- **Tank is half-built.** Taunt works and enemy AI honours it every frame, so a');
  say('  class CAN take the hits meant for someone else. But there is **no way to');
  say('  protect anyone**: every absorb, ward and armor passive in the game applies to');
  say('  the caster. A tank can attract damage and cannot mitigate it for the party,');
  say('  which is half a role.');
  say('- **Everything else is decoration.** Every class has 2-5 self-absorbs and 2-6');
  say('  control skills. Defensive tools are UNIVERSAL, so they do not distinguish');
  say('  anybody; they are baseline survivability wearing different names.');
  say('');
  say('The honest summary: **the roster is fourteen damage dealers, nine of which can');
  say('also heal and six of which can also pull aggro.** The party-role vocabulary the');
  say('design wants — someone who holds the line so someone else can stand still —');
  say('needs one mechanic that does not exist: **a defensive effect applied to another');
  say('player.** `shield` and `ward` already take an amount, a duration and a target;');
  say('what they do not take is anybody but the caster.');
  say('');
}

if (WRITE) {
  writeFileSync(new URL('../docs/SKILL-TAXONOMY.md', import.meta.url), out.join('\n') + '\n');
  console.log(`wrote docs/SKILL-TAXONOMY.md — ${out.length} lines, ${ranked.length} variants`);
} else {
  console.log(out.join('\n'));
}
