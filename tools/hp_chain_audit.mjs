// WHERE DOES AN ENEMY'S HP ACTUALLY COME FROM? Survey only, changes nothing.
//
//   node tools/hp_chain_audit.mjs
//
// Region 2's roster is authored at a weighted mean of 8.6 HP and its world axis
// is x2.13, which composes to ~18. A survey measured 171 mean HP in a region-2
// room. This walks every multiplier between the authored number and the number
// an enemy spawns with, in the order `spawnEnemyById` applies them, and reports
// each one's value and source.
//
// The question behind it is whether `roster_weight_gate` — which asserts the
// AUTHORED weighted mean — is gating the figure that reaches play.
import { FixtureSim as Sim } from './fixture_sim.mjs';
import { CONFIG } from '../js/config.js';
import { REGIONS, regionHpMult, TOTAL_REGIONS } from '../js/regions.js';
import { REGION_ENEMIES } from '../js/content/regions-enemies.js';
import { ENEMY_BY_ID } from '../js/content/enemies.js';

const P = c => [{ idx: 0, key: 'k', name: 'P', charId: c, color: '#fff' }];
const H = t => { console.log('\n' + '='.repeat(94)); console.log(t); console.log('='.repeat(94)); };

// ------------------------------------------------------- the authored figure
H('THE AUTHORED FIGURE — what roster_weight_gate asserts');
{
  for (const ri of [1, 2]) {
    const reg = REGIONS.find(r => r.index === ri);
    const pop = REGION_ENEMIES[reg.id];
    if (!pop) { console.log(`  region ${ri}: no population`); continue; }
    const units = pop.enemies || pop.units || [];
    const tw = units.reduce((s, u) => s + (u.w ?? 1), 0);
    const mean = units.reduce((s, u) => s + u.hp * (u.w ?? 1), 0) / tw;
    console.log(`\n  region ${ri} (${reg.id}) — ${units.length} units, total draw weight ${tw.toFixed(2)}`);
    for (const u of units) console.log(`    ${u.id.padEnd(22)} hp ${String(u.hp).padStart(3)}  weight ${String(u.w ?? 1).padStart(5)}`);
    console.log(`    weighted mean hp = ${mean.toFixed(2)}   <- the number the gate asserts (band 7.9 +/-15%)`);
    console.log(`    x world axis ${regionHpMult(ri).toFixed(2)} = ${(mean * regionHpMult(ri)).toFixed(1)} composed`);
  }
}

// ------------------------------------------------------------- the real chain
H('THE CHAIN — every multiplier spawnEnemyById applies, in order');
console.log(`
  js/game.js spawnEnemyById():

    hp  = def.hp                        1. authored, js/content/enemies-<region>.js
        * regionHpMult(regionIndex)     2. REGION_HP_MULT, js/regions.js
        * this.coopHp                   3. party-size scaling, js/game.js
        * this.greedHp                  4. Tollkeeper's Toll Road curse (x1.25)
        * CONFIG.enemyHpMult            5. global knob, js/config.js
        * (elite ? ELITE_HP_MULT : 1)   6. js/config.js, per-enemy elite flag
        * (fightMods.hp || 1)           7. §2.4 node modifier, per NODE
        * curseEnemyHp                  8. cursed round, per NODE
        * (opts.hpMult || 1)            9. objective variant (elite arena, bounty)
        * (noObjHp ? 1 : objHpMult)    10. objective level dial (Nest Purge +50%)
        * (mini ? 0.35 : 1)            11. splitter spawn
`);

// Instrument a real room and record each factor at the moment of spawn.
function audit(ri, kind, { seed = 771, secs = 90 } = {}) {
  const g = new Sim({ seed, regionIndex: ri, allowUnplayable: true, party: P('toh_blacksmith') });
  const p = g.players[0];
  p.level = 82;
  p.banked = 81;
  let gd = 0;
  while (p.banked > 0 && gd++ < 600) { g._maybeOffer(p); if (!p.pendingOffer) break; g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id }); }
  p.banked = 0; g._recomputeStats(p);
  g.god = true;
  const node = kind === 'any'
    ? g.floor.nodes.find(n => n.depth > 1 && n.template && n.kind !== 'shrine')
    : g.floor.nodes.find(n => n.kind === kind && n.template);
  if (!node) return null;
  g._travelTo(node.id);

  const rows = [];
  const proto = Object.getPrototypeOf(g);
  const orig = proto.spawnEnemyById;
  proto.spawnEnemyById = function (id, x, y, opts = {}) {
    const def = ENEMY_BY_ID[id];
    const before = {
      id, base: def ? def.hp : NaN,
      region: regionHpMult(this.regionIndex),
      coop: this.coopHp, greed: this.greedHp, cfg: CONFIG.enemyHpMult,
      elite: opts.elite ? CONFIG.ELITE_HP_MULT : 1,
      fight: (this.fightMods && this.fightMods.hp) || 1,
      curse: this.curseEnemyHp,
      objVariant: opts.hpMult || 1,
      objLevel: opts.noObjHp ? 1 : (this.objHpMult || 1),
      mini: opts.mini ? 0.35 : 1,
    };
    const e = orig.call(this, id, x, y, opts);
    if (e) rows.push({ ...before, out: e.maxHp });
    return e;
  };
  let boss = null;
  const ob = proto._spawnSiegeBoss;
  proto._spawnSiegeBoss = function () { const r = ob.call(this); boss = this.boss ? this.boss.maxHp : null; return r; };
  try {
    for (let i = 0; i < 60 * secs && !g.cleared && !g.over; i++) {
      p.hp = p.stats.vitality;
      g.tick();
      let k = 0;
      while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
      if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
    }
  } finally { proto.spawnEnemyById = orig; proto._spawnSiegeBoss = ob; }
  return { node, rows, boss, profile: node.profile, kind: node.kind };
}

H('MEASURED — region 2, the node a "representative" search actually picks');
const KEYS = ['region', 'coop', 'greed', 'cfg', 'elite', 'fight', 'curse', 'objVariant', 'objLevel', 'mini'];
function report(tag, a) {
  if (!a) { console.log(`  ${tag}: no node`); return null; }
  const { rows } = a;
  if (!rows.length) { console.log(`  ${tag}: nothing spawned`); return null; }
  const meanBase = rows.reduce((s, r) => s + r.base, 0) / rows.length;
  const meanOut = rows.reduce((s, r) => s + r.out, 0) / rows.length;
  console.log(`\n  ${tag}`);
  console.log(`    node kind '${a.kind}' profile '${a.profile}'   ${rows.length} spawns`);
  console.log(`    ${'factor'.padEnd(12)} ${'min'.padStart(7)} ${'mean'.padStart(8)} ${'max'.padStart(7)}   source`);
  const SRC = {
    region: 'REGION_HP_MULT (js/regions.js)', coop: 'party size (js/game.js)',
    greed: 'Toll Road curse', cfg: 'CONFIG.enemyHpMult', elite: 'CONFIG.ELITE_HP_MULT',
    fight: '§2.4 node modifier', curse: 'cursed round', objVariant: 'objective variant hpMult',
    objLevel: 'objective level dial', mini: 'splitter mini',
  };
  for (const k of KEYS) {
    const vs = rows.map(r => r[k]);
    const mn = Math.min(...vs), mx = Math.max(...vs);
    const mean = vs.reduce((s, v) => s + v, 0) / vs.length;
    const flag = (mn === 1 && mx === 1) ? '' : '  <-- non-unity';
    console.log(`    ${k.padEnd(12)} ${mn.toFixed(2).padStart(7)} ${mean.toFixed(2).padStart(8)} ${mx.toFixed(2).padStart(7)}   ${SRC[k]}${flag}`);
  }
  console.log(`    ${'def.hp'.padEnd(12)} ${Math.min(...rows.map(r => r.base)).toFixed(2).padStart(7)} ${meanBase.toFixed(2).padStart(8)} ${Math.max(...rows.map(r => r.base)).toFixed(2).padStart(7)}   authored`);
  console.log(`    ${'-> maxHp'.padEnd(12)} ${Math.min(...rows.map(r => r.out)).toFixed(0).padStart(7)} ${meanOut.toFixed(1).padStart(8)} ${Math.max(...rows.map(r => r.out)).toFixed(0).padStart(7)}`);
  console.log(`    composed multiplier, spawn-weighted: x${(meanOut / meanBase).toFixed(2)}`);
  if (a.boss) console.log(`    siege boss maxHp ${a.boss} — NOT in the rows above (its own def, no roster parity)`);
  // the spawn-weighted authored mean is the honest comparison to the gate's
  // draw-weighted one: what actually came out of the bag, not what the table says
  console.log(`    spawn-weighted authored mean def.hp = ${meanBase.toFixed(2)}  (gate asserts the DRAW-weighted mean)`);
  return { meanBase, meanOut, rows };
}

const r2any = audit(2, 'any');
const a2 = report('region 2, node picked by "depth>1 && template && !shrine"', r2any);
const r2c = audit(2, 'combat');
const b2 = report('region 2, a plain COMBAT node', r2c);
const r8c = audit(8, 'combat');
const c8 = report('region 8, a plain COMBAT node', r8c);
const r8any = audit(8, 'any');
report('region 8, node picked by "depth>1 && template && !shrine"', r8any);

H('ACROSS EVERY REGION — plain combat node, spawn-weighted');
console.log(`  ${'region'.padStart(6)} ${'authored'.padStart(9)} ${'chain x'.padStart(8)} ${'-> maxHp'.padStart(9)} ${'axis'.padStart(6)} ${'non-axis x'.padStart(11)}`);
for (let ri = 1; ri <= TOTAL_REGIONS; ri++) {
  const a = audit(ri, 'combat');
  if (!a || !a.rows.length) { console.log(`  ${String(ri).padStart(6)} (none)`); continue; }
  const mb = a.rows.reduce((s, r) => s + r.base, 0) / a.rows.length;
  const mo = a.rows.reduce((s, r) => s + r.out, 0) / a.rows.length;
  const axis = regionHpMult(ri);
  console.log(`  ${String(ri).padStart(6)} ${mb.toFixed(2).padStart(9)} ${(mo / mb).toFixed(2).padStart(8)} ${mo.toFixed(1).padStart(9)} ${axis.toFixed(2).padStart(6)} ${((mo / mb) / axis).toFixed(2).padStart(11)}`);
}
console.log('\n  "non-axis x" is the composed multiplier divided by the world axis — everything');
console.log('  the axis is NOT accounting for. The design says the axis is the sole difficulty');
console.log('  multiplier, so this column should read 1.00 everywhere it is not an elite room.');

// ------------------------------------------------- does incoming rise too?
//
// The phase-1 survey reported that incoming damage does NOT rise across the
// run — region 2 the most dangerous room in the game at 36.7 HP/sec, region 8
// at 28.6. That was measured with the same "depth>1 && template && !shrine"
// selector that turned out to pick an ELITE node in region 2 and a RELIC node
// in region 8. Re-measured on a plain combat node in every region.
H('INCOMING DPS — plain combat node, like for like');
console.log(`  ${'region'.padStart(6)} ${'incoming/s'.padStart(11)} ${'peak alive'.padStart(11)} ${'mean maxHp'.padStart(11)}`);
for (let ri = 1; ri <= TOTAL_REGIONS; ri++) {
  const g = new Sim({ seed: 771, regionIndex: ri, allowUnplayable: true, party: P('toh_blacksmith') });
  const p = g.players[0];
  p.level = 82; p.banked = 81;
  let gd = 0;
  while (p.banked > 0 && gd++ < 600) { g._maybeOffer(p); if (!p.pendingOffer) break; g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id }); }
  p.banked = 0; g._recomputeStats(p);
  const node = g.floor.nodes.find(n => n.kind === 'combat' && n.template);
  if (!node) { console.log(`  ${String(ri).padStart(6)} (no combat node)`); continue; }
  g._travelTo(node.id);
  for (let i = 0; i < 60 * 15; i++) { g.tick(); p.hp = p.stats.vitality; }
  let taken = 0, peak = 0, hpSum = 0, hpN = 0;
  const seen = new Set();
  const secs = 30;
  for (let i = 0; i < 60 * secs; i++) {
    const h = p.hp;
    g.tick();
    let k = 0;
    while (p.pendingOffer && k++ < 30) g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
    if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
    if (p.hp < h) taken += h - p.hp;
    p.hp = p.stats.vitality;
    const live = [...g.enemyPool].filter(e => e.active);
    peak = Math.max(peak, live.length);
    for (const e of live) if (!seen.has(e.id)) { seen.add(e.id); hpSum += e.maxHp; hpN++; }
  }
  console.log(`  ${String(ri).padStart(6)} ${(taken / secs).toFixed(1).padStart(11)} ${String(peak).padStart(11)} ${(hpSum / Math.max(1, hpN)).toFixed(1).padStart(11)}`);
}
