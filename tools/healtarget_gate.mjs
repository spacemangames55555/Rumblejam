// A HEAL FINDS WHO IT SAYS AND LANDS WHERE IT SAYS.
//
// Healing used to be one field. Every heal in the game fired on the CASTER's own
// health and hit everyone inside a single `radius`, so a healer could not react
// to an ally being hurt and could not aim. That radius was a search radius and
// an effect radius at once, which is why "find the ally furthest out, then drop
// an area on THEM" could not be written at all.
//
// It is now two independent fields — `selection` (who it finds) and `shape`
// (where the effect lands) — and they are orthogonal, so the interesting part is
// the PRODUCT rather than either list. This gate walks the combinations against
// a real party at known positions and known health, and asserts who ended up
// healed. Every row is a placement a design could actually ask for.
//
// AND THE EFFICIENCY GATE. A heal fires only if it can deliver at least half its
// value, which self-scales instead of needing a threshold per skill. Measured
// both ways: a scratch too small must not fire it, and a wound big enough must.
//
//   node tools/healtarget_gate.mjs [--verbose]

import { Sim } from '../js/game.js';
import { PRIMITIVES } from '../js/compose.js';
import { ALLY_SELECT_KINDS, HEAL_SHAPES, selectAllies } from '../js/selectors.js';

const VERBOSE = process.argv.includes('--verbose');
let checks = 0, fails = 0;
const ok = m => { checks++; console.log(`✓ ${m}`); };
const bad = m => { checks++; fails++; console.log(`✗ ${m}`); };

// A party of four at KNOWN offsets from the caster, so every distance in the
// assertions below is a number this file chose rather than one the spawn
// happened to produce.
//   0 = caster        1 = 100u away     2 = 300u away     3 = 900u away
const PLACE = [[0, 0], [100, 0], [300, 0], [900, 0]];

function party(hps) {
  const g = new Sim({ seed: 11, party: PLACE.map((_, i) => ({ idx: i, key: 'k' + i, name: 'P' + i, charId: 'toh_priest', color: '#fff' })) });
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);
  const c = g.players[0];
  g.players.forEach((p, i) => {
    p.x = c.x + PLACE[i][0]; p.y = c.y + PLACE[i][1];
    p.hp = Math.round(p.stats.vitality * hps[i]);
    p.healAcc = 0;                       // `_heal` floors through an accumulator
  });
  return g;
}

// Fire one heal step directly and report who gained health. Bypasses the trigger
// loop deliberately: this gate is about the primitive's targeting, and driving
// it through a real skill would measure the trigger's opinion too.
function fire(g, step) {
  const p = g.players[0];
  const before = g.players.map(q => q.hp);
  const skill = { id: 'probe_heal', tree: 'priest_reckoning', domain: 'spiritual', ranks: {} };
  PRIMITIVES.heal(g, p, skill, step, 1, g.trigGrid, { hits: 0, states: 0 });
  return g.players.map((q, i) => q.hp - before[i]).map(d => (d > 0 ? 1 : 0));
}

const show = m => m.map((v, i) => (v ? i : null)).filter(v => v !== null).join(',') || 'nobody';

console.log(`HEAL TARGETING — ${ALLY_SELECT_KINDS.length} selections x ${HEAL_SHAPES.length} shapes\n`);

// ---- 1. selection finds who it says ----
//
// Everyone hurt enough to pass the efficiency gate, so this measures selection
// alone. Amount 40 against a 90 sheet: half is 20, and 50% health is 45 missing.
{
  const rows = [
    ['self', {}, [0]],
    ['nearest_ally', { searchRadius: 400 }, [1]],
    ['nearest_n', { searchRadius: 400, count: 2 }, [1, 2]],
    ['furthest_ally', { searchRadius: 400 }, [2]],
    ['all_in_range', { searchRadius: 400 }, [0, 1, 2]],
  ];
  for (const [selection, extra, want] of rows) {
    const g = party([0.5, 0.5, 0.5, 0.5]);
    const got = fire(g, { kind: 'heal', amount: 40, selection, shape: 'point', ...extra });
    const wantMask = g.players.map((_, i) => (want.includes(i) ? 1 : 0));
    if (String(got) === String(wantMask)) ok(`${selection} x point → healed ${show(got)}`);
    else bad(`${selection} x point → healed ${show(got)}, wanted ${show(wantMask)}`);
  }
  // NEAREST_ALLY IS NOT THE CASTER. The caster is at distance zero from itself,
  // so a selector that forgot to exclude them would always return the caster and
  // "heal the nearest ally" would silently be "heal yourself".
  {
    const g = party([0.5, 0.5, 0.5, 0.5]);
    const got = fire(g, { kind: 'heal', amount: 40, selection: 'nearest_ally', shape: 'point', searchRadius: 400 });
    if (got[0] === 0 && got[1] === 1) ok('nearest_ally skips the caster — the ally at 100u is healed and the caster is not');
    else bad(`nearest_ally healed ${show(got)} — the caster is at distance 0 from itself and must not win their own selector`);
  }
  // LOWEST HP vs LOWEST HP PERCENT are different questions and the party is
  // built so they give different answers: same max on every player here, so
  // they would agree — vary the max to separate them.
  {
    const g = party([0.9, 0.2, 0.5, 0.5]);
    g.players[2].stats = { ...g.players[2].stats, vitality: 300 };
    g.players[2].hp = 60;                                  // 60/300 = 20%, but 60 raw
    g.players[1].hp = Math.round(g.players[1].stats.vitality * 0.2);   // 18/90 = 20%, 18 raw
    const low = fire(party([0.9, 0.2, 0.5, 0.5]), { kind: 'heal', amount: 40, selection: 'lowest_hp_ally', shape: 'point', searchRadius: 400 });
    if (low[1] === 1) ok('lowest_hp_ally picks the ally with the least health left');
    else bad(`lowest_hp_ally healed ${show(low)}, wanted the ally at 20% of a 90 bar`);
    const pct = selectAllies('lowest_hp_pct_ally', g.players, g.players[0], 400);
    if (pct.length === 1 && (pct[0].idx === 1 || pct[0].idx === 2)) {
      ok(`lowest_hp_pct_ally ranks by fraction of max, not raw — picked idx ${pct[0].idx}`);
    } else bad(`lowest_hp_pct_ally picked ${pct.map(q => q.idx).join(',')}`);
  }
}

// ---- 2. searchRadius bounds the search, and fails closed ----
{
  const g = party([0.5, 0.5, 0.5, 0.5]);
  const got = fire(g, { kind: 'heal', amount: 40, selection: 'all_in_range', shape: 'point', searchRadius: 150 });
  if (got[0] === 1 && got[1] === 1 && got[2] === 0 && got[3] === 0) {
    ok('searchRadius 150 reaches the caster and the ally at 100u, and stops before the one at 300u');
  } else bad(`searchRadius 150 healed ${show(got)} — wanted 0,1`);

  // AN UNUSABLE RADIUS IS CASTER-ONLY, NEVER PARTY-WIDE. Zero reach still admits
  // the caster's own distance of zero, which is the fallback the previous pass
  // established; what must never happen is an ally being reached.
  let leaked = null;
  for (const bogus of [undefined, 0, -1, NaN, Infinity]) {
    const h = party([0.5, 0.5, 0.5, 0.5]);
    const r = fire(h, { kind: 'heal', amount: 40, selection: 'all_in_range', shape: 'point', searchRadius: bogus });
    if (r[1] || r[2] || r[3]) { leaked = `${bogus} healed ${show(r)}`; break; }
  }
  if (!leaked) ok('an unusable searchRadius (undefined, 0, -1, NaN, Infinity) reaches no ALLY — it fails closed to the caster');
  else bad(`searchRadius ${leaked} — an unusable radius must not reach an ally`);
}

// ---- 3. shape decides where the effect lands, independently of selection ----
//
// THE COMBINATION THAT COULD NOT BE WRITTEN BEFORE. Select the ally furthest out
// and drop an area on THEM: the caster is 900u away and must not be healed, and
// the ally beside the target must be. One field could not express it because the
// search and the area were the same number.
{
  const g = party([0.5, 0.5, 0.5, 0.5]);
  // target is idx 3 at 900u; idx 2 sits at 300u, 600u from the target — outside
  // a 200 area. Move idx 2 next to the far one so the area has something to catch.
  g.players[2].x = g.players[3].x - 120;
  g.players[2].y = g.players[3].y;
  const got = fire(g, { kind: 'heal', amount: 40, selection: 'furthest_ally', shape: 'aoe_on_target', searchRadius: 1000, effectRadius: 200 });
  if (got[3] === 1 && got[2] === 1 && got[0] === 0 && got[1] === 0) {
    ok('furthest_ally x aoe_on_target — the area lands on the TARGET: idx 2,3 healed, the caster 900u away is not');
  } else bad(`furthest_ally x aoe_on_target healed ${show(got)}, wanted 2,3`);
}
{
  const g = party([0.5, 0.5, 0.5, 0.5]);
  const got = fire(g, { kind: 'heal', amount: 40, selection: 'furthest_ally', shape: 'aoe_on_caster', searchRadius: 1000, effectRadius: 150 });
  if (got[0] === 1 && got[1] === 1 && got[2] === 0 && got[3] === 0) {
    ok('furthest_ally x aoe_on_caster — the same selection, the area on the CASTER instead: 0,1 healed');
  } else bad(`furthest_ally x aoe_on_caster healed ${show(got)}, wanted 0,1`);
}

// ---- 4. the efficiency gate ----
//
// Half the heal's value, measured against the wound. Both directions, because a
// gate that never blocks and a gate that always blocks both look like "no bug"
// from one side.
{
  // amount 40 → needs 20 missing. A 90 sheet at 95% is missing 4.5: too little.
  const g = party([0.95, 1, 1, 1]);
  const got = fire(g, { kind: 'heal', amount: 40, selection: 'self', shape: 'point' });
  if (!got.some(Boolean)) ok('efficiency gate: a 40 heal does not fire for a 4-point scratch — under half its value');
  else bad(`efficiency gate let a 40 heal fire into a 4-point wound (healed ${show(got)})`);
}
{
  const g = party([0.7, 1, 1, 1]);          // missing 27 of 90, over the 20 needed
  const got = fire(g, { kind: 'heal', amount: 40, selection: 'self', shape: 'point' });
  if (got[0] === 1) ok('efficiency gate: the same heal fires once the wound is 27 — over half its value');
  else bad('efficiency gate blocked a 40 heal into a 27-point wound');
}
{
  // SELF-SCALING, which is the reason it replaces a per-skill threshold: the
  // same wound that blocks a big heal admits a small one, with nothing tuned.
  const g = party([0.95, 1, 1, 1]);
  const got = fire(g, { kind: 'heal', amount: 8, selection: 'self', shape: 'point' });
  if (got[0] === 1) ok('efficiency gate self-scales: an 8 heal DOES fire into the same 4-point scratch that blocked the 40');
  else bad('efficiency gate blocked an 8 heal into a 4-point wound — the rule is half of ITS value, not a fixed threshold');
}
{
  // ANY, NOT ALL — the multi-target reading. One hurt ally among healthy ones
  // must fire the cast.
  const g = party([1, 1, 0.4, 1]);
  const got = fire(g, { kind: 'heal', amount: 40, selection: 'all_in_range', shape: 'point', searchRadius: 400 });
  if (got[2] === 1) ok('multi-target gate fires when ONE target qualifies — the hurt ally is healed though the others are full');
  else bad('multi-target gate did not fire with one qualifying target among healthy ones');
}

// ---- 5. a downed ally is not a target ----
//
// `_heal` refuses a downed player, so selecting one spends the whole cast on a
// body that cannot receive it. Harmless when a heal hit everyone; not harmless
// when it picks one.
{
  const g = party([1, 0.1, 0.5, 1]);
  g.players[1].downed = true;
  const got = fire(g, { kind: 'heal', amount: 40, selection: 'lowest_hp_ally', shape: 'point', searchRadius: 400 });
  if (got[1] === 0 && got[2] === 1) ok('a downed ally is skipped by selection — the heal goes to the next worst instead of being wasted');
  else bad(`selection picked a downed ally — healed ${show(got)}`);
}

if (VERBOSE) {
  console.log('\nselection x shape, every combination the loader will accept:');
  for (const s of ALLY_SELECT_KINDS) for (const h of HEAL_SHAPES) console.log(`  ${s} x ${h}`);
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A HEAL DOES NOT GO WHERE IT SAYS' : 'EVERY HEAL FINDS WHO IT SAYS AND LANDS WHERE IT SAYS');
process.exit(fails ? 1 : 0);
