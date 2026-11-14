// THE CURSES DO WHAT THEY SAY, IN PLAY — KNOWN-DEFECTS #40.
//
// Every claim here is measured from a real `new Sim({ seed, party,
// regionIndex })` that travels into a real cursed node, never from the
// CURSED_MODIFIERS table alone. A curse declared in data and read by nothing
// is a gold bonus with a scary name, and that is what all three were until
// this gate existed.
//
//   1. Bloodprice (region 2, `noRoomHeal`): entering a cursed node does NOT
//      restore HP. Controls: a plain fight in region 2 does, and a cursed node
//      in region 1 (Gloom, no noRoomHeal) does.
//   2. Glamour (region 3, `telegraphRevealMs: 150`): a committed zone draws
//      the neutral tint while more than 150ms remain and its domain tint from
//      150ms on. Control: a plain fight in region 3 tints from commit.
//   3. Co-op: the curse id rides `st.arena` and the committed zones ride the
//      snapshot, through encodeSnap/decodeSnap, so a guest computes the same
//      tint as the host.
//   4. Render-only: computing tints and packing zones every tick leaves the
//      sim byte-identical to one that never did (no Sim.rng draw).
//
// Usage: node tools/curse_gate.mjs
import { Sim } from '../js/game.js';
import { CURSED_MODIFIERS, CURSE_EFFECT_FIELDS, telegraphRevealMsFor, playerSpdMultFor } from '../js/nodebehaviour.js';
import { waveConfig } from '../js/arenas.js';
import { REGION_ENEMIES, enemyRole } from '../js/content/regions-enemies.js';
import { REGIONS } from '../js/regions.js';
import { unpackTelZones, packTelZones } from '../js/telegraphs.js';
import { encodeSnap, decodeSnap } from '../js/netcodec.js';
import { DOMAIN_COLOR } from '../js/domains.js';
const R = await import('../js/render.js');

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };
const party = () => [{ idx: 0, key: 'k', name: 'P', charId: 'toh_samurai', color: '#fff' }];
const make = (seed, regionIndex) => {
  const g = new Sim({ seed, party: party(), regionIndex });
  const p = g.players[0];
  if (p.openingOffer) g.uiAction(0, { kind: 'opening', id: p.openingOffer[0].id });
  return g;
};
const nodeOf = (g, kind) => g.floor.nodes.find(n => n.kind === kind && n.depth && n.depth > 1)
  || g.floor.nodes.find(n => n.kind === kind);

console.log('CURSES, MEASURED IN PLAY\n');

// ---- 0. data: every region curse resolves and declares a live effect ----
{
  const dead = Object.values(CURSED_MODIFIERS).filter(m => m.stationaryDps !== undefined);
  if (dead.length) bad(`${dead.map(m => m.id).join(', ')} still declare stationaryDps, which nothing reads`);
  else ok('no curse declares the retired stationaryDps field');
  const want = { pacific_northwest: 'pnw_gloom', central_america: 'bloodprice', great_britain: 'glamour',
    egypt: 'sandglass', central_africa: 'fever', northern_russia: 'deep_winter',
    off_indonesia: 'undertow', australian_outback: 'big_country' };
  const wrong = REGIONS.filter(r => want[r.id] && r.cursedModifier !== want[r.id]);
  if (wrong.length) bad(`region curse ids drifted: ${wrong.map(r => `${r.id}=${r.cursedModifier}`).join(', ')}`);
  else ok(`region curses: ${REGIONS.map(r => `${r.index}=${r.cursedModifier}`).join(', ')}`);
  if (CURSED_MODIFIERS.bloodprice && CURSED_MODIFIERS.bloodprice.noRoomHeal === true) ok('bloodprice declares noRoomHeal');
  else bad('bloodprice does not declare noRoomHeal: true');
}

// ---- 1. Bloodprice: a cursed room starts with the HP you brought ----
{
  const enterWith = (regionIndex, kind, frac) => {
    for (let s = 0; s < 20; s++) {
      const g = make(3100 + s * 211, regionIndex);
      const node = nodeOf(g, kind);
      if (!node) continue;
      const p = g.players[0];
      p.hp = Math.round(p.stats.vitality * frac);
      const before = p.hp;
      g._travelTo(node.id);
      return { before, after: p.hp, max: p.stats.vitality, curse: g._arena && g._arena.curse, kind: g.nodeType };
    }
    return null;
  };
  const cursed = enterWith(2, 'cursed', 0.3);
  const plain = enterWith(2, 'combat', 0.3);
  const gloom = enterWith(1, 'cursed', 0.3);
  if (!cursed || !plain || !gloom) bad('could not find a cursed and a plain node to stage — restage it');
  else {
    if (cursed.curse === 'bloodprice' && cursed.after === cursed.before && cursed.after < cursed.max)
      ok(`region 2 cursed node (bloodprice): entered at ${cursed.before}/${cursed.max} HP and the room started at ${cursed.after} — no restore`);
    else bad(`region 2 cursed node: curse ${cursed.curse}, HP ${cursed.before} → ${cursed.after} of ${cursed.max} — Bloodprice should keep ${cursed.before}`);
    if (plain.after === plain.max) ok(`control: region 2 plain fight restores ${plain.before} → ${plain.after}/${plain.max}`);
    else bad(`control: region 2 plain fight left HP at ${plain.after}/${plain.max}`);
    if (gloom.curse === 'pnw_gloom' && gloom.after === gloom.max) ok(`control: region 1 cursed node (gloom, no noRoomHeal) still restores to ${gloom.after}/${gloom.max}`);
    else bad(`control: region 1 cursed node curse ${gloom.curse}, HP ${gloom.after}/${gloom.max}`);
  }
}

// ---- 2 + 3 + 4. Glamour, host and guest, and rng neutrality ----
{
  // Run a region-3 fight until a light or heavy unit commits a zone, sampling
  // the tint the HOST view and the GUEST view (snapshot → wire → unpack) would
  // draw at every tick of its wind-up.
  const stage = (kind) => {
    for (let s = 0; s < 30; s++) {
      const g = make(7700 + s * 389, 3);
      const node = nodeOf(g, kind);
      if (!node) continue;
      g._travelTo(node.id);
      g.god = true;
      return g;
    }
    return null;
  };
  const sample = (g, ticks) => {
    const hostReveal = telegraphRevealMsFor(g._arena && g._arena.curse);
    const rows = [];
    let guestReveal = null, mismatch = 0, curseOnWire = null;
    for (let i = 0; i < ticks && g.phase === 'arena'; i++) {
      g.tick();
      const host = g.telegraphZones();
      if (!host.length) continue;
      const snap = decodeSnap(encodeSnap(g.getSnapshot()));
      curseOnWire = snap.st && snap.st.arena ? snap.st.arena.curse : undefined;
      guestReveal = telegraphRevealMsFor(curseOnWire);
      const guest = unpackTelZones(snap.telZones);
      if (guest.length !== host.length) { mismatch++; continue; }
      for (let k = 0; k < host.length; k++) {
        const h = host[k], q = guest[k];
        const hc = R.zoneTint(h.z.domain, h.msLeft, hostReveal);
        const qc = R.zoneTint(q.z.domain, q.msLeft, guestReveal);
        if (hc !== qc || h.z.kind !== q.z.kind) mismatch++;
        rows.push({ msLeft: h.msLeft, col: hc, dom: DOMAIN_COLOR[h.z.domain] || '#ff5d6c', kind: h.z.kind });
      }
      if (rows.length > 400) break;
    }
    return { hostReveal, guestReveal, curseOnWire, rows, mismatch };
  };

  const cg = stage('cursed');
  const pg = stage('combat');
  if (!cg || !pg) bad('could not stage region-3 cursed and plain fights');
  else {
    const c = sample(cg, 60 * 40);
    const early = c.rows.filter(r => r.msLeft > 150), late = c.rows.filter(r => r.msLeft <= 150);
    if (c.hostReveal === 150 && c.curseOnWire === 'glamour') ok('region 3 cursed node arms glamour: telegraphRevealMs 150, and the curse id rides st.arena through the wire codec');
    else bad(`region 3 cursed node: host reveal ${c.hostReveal}, curse on the wire ${JSON.stringify(c.curseOnWire)}`);
    if (!early.length || !late.length) bad(`glamour: sampled ${early.length} early and ${late.length} late zone frames — nothing to judge`);
    else {
      const earlyHidden = early.every(r => r.col === R.GLAMOUR_HIDDEN_TINT);
      const lateShown = late.every(r => r.col === r.dom);
      const kinds = [...new Set(c.rows.map(r => r.kind))].join('/');
      if (earlyHidden && lateShown) ok(`glamour: ${early.length} zone frame(s) with >150ms left drew the neutral tint, ${late.length} with ≤150ms drew their domain tint (${kinds})`);
      else bad(`glamour: early hidden ${earlyHidden}, late shown ${lateShown}`);
    }
    if (c.mismatch === 0 && c.guestReveal === c.hostReveal) ok(`co-op: the guest's unpacked zones and tint match the host's on every sampled frame (${c.rows.length})`);
    else bad(`co-op: ${c.mismatch} host/guest zone or tint mismatch(es); guest reveal ${c.guestReveal}`);

    const pl = sample(pg, 60 * 40);
    if (pl.hostReveal === 0 && pl.rows.length && pl.rows.every(r => r.col === r.dom)) ok(`control: a plain region-3 fight tints every zone from commit (${pl.rows.length} frames)`);
    else bad(`control: plain region-3 fight reveal ${pl.hostReveal}, ${pl.rows.filter(r => r.col !== r.dom).length} untinted frame(s)`);
  }

  // Render-only: the same fight with and without the view work every tick.
  const runOnce = (viewWork) => {
    const g = stage('cursed');
    for (let i = 0; i < 60 * 20 && g.phase === 'arena'; i++) {
      g.tick();
      if (viewWork) {
        const zs = g.telegraphZones();
        const rv = telegraphRevealMsFor(g._arena.curse);
        for (const t of zs) R.zoneTint(t.z.domain, t.msLeft, rv);
        unpackTelZones(packTelZones(zs));
      }
    }
    const s = g.getSnapshot(); delete s.t;
    return JSON.stringify(s);
  };
  const a = runOnce(false), b = runOnce(true);
  if (a === b) ok(`render-only: 20s of a glamour fight is byte-identical with and without per-tick tint and zone packing (${(a.length / 1024).toFixed(0)} KB compared)`);
  else bad('the glamour view work changed the simulation — something in the tint path reaches Sim state or Sim.rng');
}

// ---- 5. Regions 4–8: one lever each, read off a real cursed room ----
//
// Five curses, five different levers, and the same question of each: does the
// room it is cast on DIFFER from the plain fight beside it, by the amount the
// table says, on the thing the table names — and on nothing else. Every check
// stages a cursed node and a plain combat node in the same region and reads
// the lever from the running Sim. The control half matters as much as the
// effect half: a multiplier applied to every room is not a curse.
{
  const stageIn = (regionIndex, kind) => {
    for (let s = 0; s < 40; s++) {
      const g = make(7300 + s * 173, regionIndex);
      const node = nodeOf(g, kind);
      if (!node) continue;
      g._travelTo(node.id);
      if (g.phase !== 'arena') continue;
      return { g, node };
    }
    return null;
  };
  const pair = (regionIndex) => ({ c: stageIn(regionIndex, 'cursed'), p: stageIn(regionIndex, 'combat') });
  const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const curseOf = (st) => st.g.fightMods && st.g.fightMods.cursed && st.g.fightMods.cursed.id;
  const popOf = (regionIndex) => REGION_ENEMIES[REGIONS.find(r => r.index === regionIndex).id].enemies;
  const spawn = (st, def) => st.g.spawnEnemyById(def.id, st.g.W / 2, st.g.H / 2, { noObjHp: true });

  // SANDGLASS — the wave runs ×1.3, and the ramp with it.
  {
    const { c, p } = pair(4);
    if (!c || !p) bad('sandglass: could not stage a cursed and a plain node in region 4');
    else {
      const base = (st) => waveConfig(st.g.regionIndex, (st.node.depth || 1) - 1, st.node.kind);
      const bc = base(c), bp = base(p);
      const m = CURSED_MODIFIERS.sandglass.waveDurMult;
      if (curseOf(c) === 'sandglass' && c.g.wave.dur === Math.round(bc.dur * m) && c.g.wave.rampT === Math.round(bc.rampT * m))
        ok(`sandglass: region 4 cursed room runs ${c.g.wave.dur}s against ${bc.dur}s uncursed (×${m}), ramp ${bc.rampT}s → ${c.g.wave.rampT}s`);
      else bad(`sandglass: curse ${curseOf(c)}, wave ${c.g.wave.dur}s (want ${Math.round(bc.dur * m)}), ramp ${c.g.wave.rampT}s (want ${Math.round(bc.rampT * m)})`);
      if (p.g.wave.dur === bp.dur) ok(`control: region 4 plain fight runs its ${bp.dur}s unchanged`);
      else bad(`control: region 4 plain fight runs ${p.g.wave.dur}s, waveConfig says ${bp.dur}s`);
    }
  }

  // FEVER — fodder's touch ×1.5; a special's touch and every HP unchanged.
  {
    const { c, p } = pair(5);
    if (!c || !p) bad('fever: could not stage a cursed and a plain node in region 5');
    else {
      const pop = popOf(5);
      const fod = pop.find(e => enemyRole(e) === 'fodder'), spec = pop.find(e => enemyRole(e) === 'special');
      const fc = spawn(c, fod), fp = spawn(p, fod), sc = spawn(c, spec), sp = spawn(p, spec);
      const m = CURSED_MODIFIERS.fever.fodderDmgMult;
      // A CURSED NODE ALSO CARRIES ITS OWN ×DAMAGE (§2.4), on every body or on
      // champions only depending on the region's pace. That is the node, not
      // the curse, so it is divided out of both halves — the first version of
      // this check did so for the special and not for the fodder, and read the
      // node's ×1.15 as the curse overshooting to ×1.72.
      const nodeDmg = (st, def) => (!(st.g.fightMods && st.g.fightMods.championOnly) || def.telegraph) ? ((st.g.fightMods && st.g.fightMods.dmg) || 1) : 1;
      const fr = (fc.dmg / nodeDmg(c, fod)) / (fp.dmg / nodeDmg(p, fod));
      if (curseOf(c) === 'fever' && near(fr, m))
        ok(`fever: region 5 cursed room spawns ${fod.id} touching for ${fc.dmg.toFixed(2)} against ${fp.dmg.toFixed(2)} plain — ×${fr.toFixed(2)} from the curse once the node's own ×${nodeDmg(c, fod).toFixed(2)} is divided out`);
      else bad(`fever: curse ${curseOf(c)}, fodder touch ${fc.dmg} vs ${fp.dmg}, ×${fr.toFixed(2)} net of the node, want ×${m}`);
      if (near(sc.dmg / nodeDmg(c, spec), sp.dmg / nodeDmg(p, spec)))
        ok(`control: the special ${spec.id} touches for the same ${ (sp.dmg / nodeDmg(p, spec)).toFixed(2)} in both rooms once the node's own modifier is divided out — fever is fodder's alone`);
      else bad(`control: fever reached the special — ${sc.dmg / nodeDmg(c, spec)} cursed vs ${sp.dmg / nodeDmg(p, spec)} plain`);
    }
  }

  // DEEP WINTER — the player covers 85% of the ground, host and guest alike.
  {
    const { c, p } = pair(6);
    if (!c || !p) bad('deep winter: could not stage a cursed and a plain node in region 6');
    else {
      const walk = (st) => {
        const g = st.g, pl = g.players[0];
        g.god = true;
        // Walk toward the roomier side so no wall shortens either run.
        const dir = pl.x < g.W / 2 ? 1 : -1;
        const x0 = pl.x, y0 = pl.y;
        for (let i = 0; i < 30; i++) { g.setInput(0, { mx: dir, my: 0 }); g.tick(); }
        return Math.hypot(pl.x - x0, pl.y - y0);
      };
      const dc = walk(c), dp = walk(p);
      const m = CURSED_MODIFIERS.deep_winter.playerSpdMult;
      if (curseOf(c) === 'deep_winter' && near(dc / dp, m, 0.03))
        ok(`deep winter: half a second of walking covers ${dc.toFixed(0)} units cursed against ${dp.toFixed(0)} plain (×${(dc / dp).toFixed(2)})`);
      else bad(`deep winter: curse ${curseOf(c)}, walked ${dc.toFixed(1)} vs ${dp.toFixed(1)} = ×${(dc / dp).toFixed(3)}, want ×${m}`);
      const onWire = c.g._arena && c.g._arena.curse;
      if (playerSpdMultFor(onWire) === m && playerSpdMultFor(p.g._arena && p.g._arena.curse) === 1)
        ok(`co-op: the curse id on st.arena ("${onWire}") resolves to ×${m} for a guest's own prediction, and a plain room to ×1`);
      else bad(`co-op: a guest would predict at ×${playerSpdMultFor(onWire)} in the cursed room and ×${playerSpdMultFor(p.g._arena && p.g._arena.curse)} in the plain one`);
    }
  }

  // UNDERTOW — every body is ×1.2 faster.
  {
    const { c, p } = pair(7);
    if (!c || !p) bad('undertow: could not stage a cursed and a plain node in region 7');
    else {
      const pop = popOf(7);
      const rows = pop.map(def => ({ id: def.id, r: spawn(c, def).spd / spawn(p, def).spd }));
      const m = CURSED_MODIFIERS.undertow.enemySpdMult;
      const off = rows.filter(x => !near(x.r, m));
      if (curseOf(c) === 'undertow' && !off.length) ok(`undertow: all ${rows.length} of region 7's bodies spawn ×${m} faster in the cursed room`);
      else bad(`undertow: curse ${curseOf(c)}; off the multiplier: ${off.map(x => `${x.id} ×${x.r.toFixed(2)}`).join(', ')}`);
    }
  }

  // BIG COUNTRY — telegraphing units are drawn twice as often, from the same
  // number of rolls.
  {
    const { c, p } = pair(8);
    if (!c || !p) bad('big country: could not stage a cursed and a plain node in region 8');
    else {
      const tel = new Set(popOf(8).filter(e => e.telegraph).map(e => e.id));
      const share = (st) => { let n = 0; const N = 6000; for (let i = 0; i < N; i++) if (tel.has(st.g._regionPick())) n++; return n / N; };
      const sc = share(c), sp = share(p);
      const m = CURSED_MODIFIERS.big_country.specialWeightMult;
      // Doubling a 13% share does not give 26%: the total grows too. Expected
      // is m·t / (1 + (m−1)·t) for a plain share t.
      const want = m * sp / (1 + (m - 1) * sp);
      if (curseOf(c) === 'big_country' && near(sc, want, 0.12))
        ok(`big country: ${(100 * sc).toFixed(1)}% of region 8's cursed-room draws telegraph against ${(100 * sp).toFixed(1)}% plain — weight ×${m} predicts ${(100 * want).toFixed(1)}%`);
      else bad(`big country: curse ${curseOf(c)}, telegraphing share ${(100 * sc).toFixed(1)}% cursed vs ${(100 * sp).toFixed(1)}% plain, weight ×${m} predicts ${(100 * want).toFixed(1)}%`);
    }
  }

  // And the table itself: every curse a region names declares an effect field
  // the sim has a reader for. A field outside CURSE_EFFECT_FIELDS is one no
  // check above knows how to look for.
  const unread = Object.values(CURSED_MODIFIERS).filter(mod => !CURSE_EFFECT_FIELDS.some(k => mod[k] !== undefined));
  if (!unread.length) ok(`all ${Object.keys(CURSED_MODIFIERS).length} curses declare a field from CURSE_EFFECT_FIELDS`);
  else bad(`curse(s) with no known effect field: ${unread.map(x => x.id).join(', ')}`);
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A CURSE IS STILL DECORATION'  : 'EVERY CURSE CHANGES THE ROOM IT IS CAST ON');
process.exit(fails ? 1 : 0);
