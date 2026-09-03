// BONELORD × MARROWNAUT — what the fused mount actually does to the sheet.
//
// The trait's own description says: "Combine all four mounts into one and it
// becomes the Marrownaut: while it stands you gain 100% of its Grit and 50% of
// its Vitality." `tohStats` runs inside `_recomputeStats`, and the helper it
// reads returns `{ grit: p.stats.grit }` — the PLAYER's grit off the PREVIOUS
// sheet, not the summon's. So the term feeds its own output back in.
//
// Measured rather than argued: build a Necromancer, stand one tier-4 summon
// next to it, recompute the sheet repeatedly and print grit each time.
//
//   node tools/bonelord_probe.mjs

import { Sim } from '../js/game.js';

const g = new Sim({ seed: 4711, party: [{ idx: 0, key: 'k', name: 'P', charId: 'toh_necromancer', color: '#fff' }] });
const p = g.players[0];
p.level = 20;
const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
g._travelTo(node.id);

const trait = p.char.trait;
console.log(`trait ${trait.key} — marrownautGritShare ${trait.marrownautGritShare}, marrownautVitShare ${trait.marrownautVitShare}`);
console.log(`base grit ${p.char.stats.grit}, base vitality ${p.char.stats.vitality}\n`);

// ---- control: no fused mount ----
g.summons = [];
for (let i = 0; i < 3; i++) g._recomputeStats(p);
const control = { grit: p.stats.grit, vitality: p.stats.vitality };
console.log(`CONTROL (no mount)      grit ${control.grit}  vitality ${control.vitality}`);

// ---- one tier-4 summon standing, exactly as `marrownaut()` requires ----
g.summons = [{ owner: p.idx, dead: false, tier: 4, maxHp: 200, hp: 200, x: p.x, y: p.y }];

const rows = [];
for (let i = 1; i <= 8; i++) {
  g._recomputeStats(p);
  rows.push({ n: i, grit: p.stats.grit, vitality: p.stats.vitality });
}
console.log('\nFUSED MOUNT STANDING — one _recomputeStats per row');
console.log('  n   grit   Δgrit   vitality   Δvit');
let pg = control.grit, pv = control.vitality;
for (const r of rows) {
  console.log(`  ${String(r.n).padStart(2)}  ${String(r.grit).padStart(5)}  ${String(r.grit - pg).padStart(6)}   ${String(r.vitality).padStart(6)}   ${String(r.vitality - pv).padStart(5)}`);
  pg = r.grit; pv = r.vitality;
}

const growing = rows[rows.length - 1].grit > rows[0].grit;
console.log(`\ngrit ${growing ? 'GROWS with every recompute — the term feeds itself' : 'is stable across recomputes'}`);
console.log(`vitality ${rows[rows.length - 1].vitality > rows[0].vitality ? 'GROWS' : 'is stable'} (its input is the summon\'s maxHp, not the sheet)`);

// ---- the question the spec actually asks: what does the +20 Grit FORM do to it? ----
//
// The grit term reads the PLAYER's grit. At base that is 0, so the term is
// inert. Marrownaut-the-skill puts +20 Grit on the sheet. If the term then
// reads 20 and adds it back, the loop stops multiplying zero.
const { spendSkillPoint, setLoadout, applyPersistents } = await import('../js/skillsim.js');
const { SKILL_BY_ID } = await import('../js/skills.js');

for (const id of ['necro_spiked_punch', 'necro_marrownaut']) { p.skillPoints++; spendSkillPoint(g, p, id); }
p.loadout = new Array(8).fill(null);
p.loadout[1] = 'necro_spiked_punch';           // the anti-softlock floor needs damage in the bar
g.summons = [];
applyPersistents(g, p);
g._recomputeStats(p);
const noForm = p.stats.grit;

g.cleared = true;
setLoadout(g, p, 0, 'necro_marrownaut');
g.tick();
const formOnly = p.stats.grit;

g.summons = [{ owner: p.idx, dead: false, tier: 4, maxHp: 200, hp: 200, x: p.x, y: p.y }];
const both = [];
for (let i = 1; i <= 8; i++) { g._recomputeStats(p); both.push(p.stats.grit); }

console.log('\n--- WITH THE MARROWNAUT FORM SLOTTED ---');
console.log(`form out of the bar, no mount : grit ${noForm}`);
console.log(`form slotted, no mount        : grit ${formOnly}   (the form is +${SKILL_BY_ID.necro_marrownaut.persist.stats.grit})`);
console.log(`form slotted + fused mount    : grit ${both.join(' → ')}`);
const compounds = both[both.length - 1] > both[0];
console.log(`\n${compounds ? 'COMPOUNDS — every recompute adds the sheet\'s grit back to itself'
  : 'stable — the term is applied once per recompute against a fixed input'}`);

