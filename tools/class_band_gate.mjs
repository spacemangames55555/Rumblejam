// NO CLASS IS A DIFFERENT GAME — the roster holds a band, and holds it over time.
//
// The world is priced against "the median class" (tools/region_curve.mjs →
// REGION_HP_MULT). That only means something if the classes are near each
// other. On 15 Nov 2026 they were not, and nothing was red:
//
//   · the NECROMANCER dealt 6.8× the roster median. Its trees were transcribed
//     from a conversion document whose damage, cadence and rank growth were
//     never reconciled with the other thirteen classes. One tier-1 skill,
//     alone in one slot, out-damaged every other class's full loadout.
//   · the SAVAGE dealt 2.5–4× the median and it depended on how long you
//     looked: its cascade chain is uncapped, never breaks in an eight-slot
//     loadout, and was paid linearly — 428 ranks in a 60 s room against a
//     design reference of 18. §13 rule 90 had named the hazard. Nothing acted.
//
// Rulings R-10 and R-11 fixed both. This gate is what keeps a fifteenth class,
// or a retuned one, from doing it again. All on the dummy ring the world axis
// itself is measured on (tools/lib/dummy_ring.mjs):
//
//   A. THE BAND. At every level anchor from region 2 on, every class's best
//      slotting is within BAND of the roster median. (Level 1 is one skill at
//      rank 1 — reported, not gated.)
//   B. NO SKILL IS A LOADOUT. No single skill, alone in one slot at level 68,
//      is worth more than SOLO_CAP of the median class's whole loadout.
//   C. OUTPUT DOES NOT GROW WITH THE CLOCK. For every class, the second ten
//      seconds on the ring pay no more than RAMP times the first ten. An
//      engine warming up is a ramp; an engine with no ceiling is a slope.
//   D. THE CASCADE'S DAMAGE TERM STOPS. The Savage's chain runs past
//      CASCADE_SCALE_CAP (so the cap is the thing binding) and the number a
//      `scaleWith` step reads never exceeds it.
//   E. ONE RANK MODEL. No damaging active in any class ranks above
//      RANK_CAP a rank. The roster ranks at 4–4.5%; the Necromancer's nodes
//      ranked at 13–50%.
//
// Usage: node tools/class_band_gate.mjs [--verbose]
import { TREES, TREES_BY_CLASS } from '../js/skills.js';
import { REGION_ANCHOR_LEVEL } from '../js/regions.js';
import { CONFIG } from '../js/config.js';
import { measureRing } from './lib/dummy_ring.mjs';

const VERBOSE = process.argv.includes('--verbose');
// BAND, placed by measurement (15 Nov 2026, after R-10 and R-11): the widest
// class at any gated anchor is the Druid at ×1.91 (level 14) and the narrowest
// the Priest at ×0.68 (level 68). Before the rulings the Necromancer sat at
// ×5.7–6.8 and the Savage at ×2.2–4.7; after, ×1.09–1.28 and ×1.05–1.35. So 0.5–2.0 holds everything that is merely a strong
// or a weak class and fails anything that is a different game. It is a
// backstop, not a target: tightening it is the next class pass's job.
const BAND = [0.5, 2.0];
const SOLO_CAP = 0.75;      // strongest shipped: 0.52 (the Druid's Thornbark); the old Spiked Punch: 2.9
const RAMP = 2.5;           // strongest shipped: 1.93 (Blacksmith, level 41); the uncapped cascade: 4.9
const RANK_CAP = 0.06;      // roster: 0.04 and 0.045

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };
const CLASSES = Object.keys(TREES_BY_CLASS);
const short = c => c.replace('toh_', '');
const median = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return !s.length ? 0 : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const best = (c, level) => Math.max(...[0, 1, 2].map(w => { const m = measureRing(c, level, { window: w }); return m ? m.dps : 0; }));

// ---- A. the band ------------------------------------------------------------
const medianAt = {};
for (let r = 0; r < REGION_ANCHOR_LEVEL.length; r++) {
  const level = REGION_ANCHOR_LEVEL[r];
  const per = CLASSES.map(c => ({ c, v: best(c, level) }));
  const med = median(per.map(x => x.v));
  medianAt[level] = med;
  const sorted = [...per].sort((a, b) => b.v - a.v);
  const hi = sorted[0], lo = sorted[sorted.length - 1];
  const out = per.filter(x => x.v > med * BAND[1] || x.v < med * BAND[0]);
  const line = `level ${String(level).padStart(2)} (region ${r + 1}): median ${med.toFixed(0)}, highest ${short(hi.c)} ×${(hi.v / med).toFixed(2)}, lowest ${short(lo.c)} ×${(lo.v / med).toFixed(2)}`;
  if (VERBOSE) console.log('    ' + per.map(x => `${short(x.c).slice(0, 8)} ${(x.v / med).toFixed(2)}`).join('  '));
  if (r === 0) { console.log(`    ${line} — one skill at rank 1, reported not gated`); continue; }
  if (!out.length) ok(line);
  else bad(`${line} — OUTSIDE ×${BAND[0]}–${BAND[1]}: ${out.map(x => `${short(x.c)} ×${(x.v / med).toFixed(2)}`).join(', ')}`);
}

// ---- B. no skill is a loadout ----------------------------------------------
{
  const level = REGION_ANCHOR_LEVEL[REGION_ANCHOR_LEVEL.length - 1];
  const med = medianAt[level];
  const all = [];
  for (const c of CLASSES) {
    const m = measureRing(c, level, { window: 0, seconds: 1 });
    for (const id of (m ? m.learned : [])) {
      const one = measureRing(c, level, { loadout: [id] });
      all.push({ c, id, v: one ? one.dps : 0 });
    }
  }
  all.sort((a, b) => b.v - a.v);
  const over = all.filter(x => x.v > med * SOLO_CAP);
  const top = all.slice(0, 3).map(x => `${x.id} ${(x.v / med).toFixed(2)}`).join(', ');
  if (!over.length) ok(`no single skill is worth a loadout: the strongest, alone in one slot at level ${level}, are ${top} of the median class's ${med.toFixed(0)} (cap ${SOLO_CAP})`);
  else bad(`a single skill out-damages most of a class: ${over.slice(0, 5).map(x => `${x.id} ×${(x.v / med).toFixed(2)}`).join(', ')} of the median class's whole loadout (cap ${SOLO_CAP})`);
}

// ---- C. output does not grow with the clock ---------------------------------
for (const level of [REGION_ANCHOR_LEVEL[4], REGION_ANCHOR_LEVEL[7]]) {
  const rows = [];
  for (const c of CLASSES) {
    let worst = 0;
    for (const w of [0, 1, 2]) {
      const a = measureRing(c, level, { window: w, seconds: 10 }), b = measureRing(c, level, { window: w, seconds: 20 });
      if (!a || !b) continue;
      const first = a.dps * 10, second = b.dps * 20 - first;
      worst = Math.max(worst, second / Math.max(1, first));
    }
    rows.push({ c, worst });
  }
  rows.sort((a, b) => b.worst - a.worst);
  const over = rows.filter(x => x.worst > RAMP);
  if (VERBOSE) console.log('    ' + rows.map(x => `${short(x.c).slice(0, 8)} ${x.worst.toFixed(2)}`).join('  '));
  if (!over.length) ok(`level ${level}: no class's second ten seconds pay more than ×${RAMP} its first ten (steepest: ${short(rows[0].c)} ×${rows[0].worst.toFixed(2)})`);
  else bad(`level ${level}: output grows with the clock — ${over.map(x => `${short(x.c)} ×${x.worst.toFixed(2)}`).join(', ')} second ten seconds over first (cap ×${RAMP}). An engine with no ceiling.`);
}

// ---- D. the cascade's damage term stops -------------------------------------
{
  const level = REGION_ANCHOR_LEVEL[4];
  let chain = 0, published = 0;
  for (const w of [0, 1, 2]) {
    const m = measureRing('toh_savage', level, { window: w });
    if (m && m.p.cascade > chain) { chain = m.p.cascade; published = m.p.engines.cascade; }
  }
  if (chain > CONFIG.CASCADE_SCALE_CAP) ok(`the Savage's chain still runs uncapped: ${Math.floor(chain)} ranks after 20 s, past the ${CONFIG.CASCADE_SCALE_CAP} a skill is paid for`);
  else bad(`the Savage's chain only reached ${Math.floor(chain)} — the cap (${CONFIG.CASCADE_SCALE_CAP}) was never the thing binding, so this gate proves nothing about it`);
  if (published === CONFIG.CASCADE_SCALE_CAP) ok(`and what a \`scaleWith: 'cascade'\` step reads stopped at ${published}`);
  else bad(`a \`scaleWith: 'cascade'\` step reads ${published} with the chain at ${Math.floor(chain)} (cap ${CONFIG.CASCADE_SCALE_CAP}) — the damage term is unbounded again`);
}

// ---- E. one rank model -------------------------------------------------------
{
  const steep = [];
  for (const c of CLASSES) for (const t of TREES_BY_CLASS[c]) for (const s of TREES[t].skills) {
    if (s.type !== 'active' || !(s.compose || []).some(st => st.damage > 0 || st.dps > 0)) continue;
    const r = (s.ranks && s.ranks.damage) || 0;
    if (r > RANK_CAP) steep.push(`${s.id} ${(r * 100).toFixed(1)}%`);
  }
  if (!steep.length) ok(`every damaging active ranks at ${RANK_CAP * 100}% a rank or under — one rank model across the roster`);
  else bad(`${steep.length} damaging active(s) rank above ${RANK_CAP * 100}% a rank: ${steep.slice(0, 6).join(', ')}${steep.length > 6 ? ', …' : ''}`);
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A CLASS IS PLAYING A DIFFERENT GAME' : 'THE ROSTER HOLDS ITS BAND, AND HOLDS IT OVER TIME');
process.exit(fails ? 1 : 0);
