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
import { CURSED_MODIFIERS, telegraphRevealMsFor } from '../js/nodebehaviour.js';
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
  const want = { pacific_northwest: 'pnw_gloom', central_america: 'bloodprice', great_britain: 'glamour' };
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

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'A CURSE IS STILL DECORATION' : 'EVERY CURSE CHANGES THE ROOM IT IS CAST ON');
process.exit(fails ? 1 : 0);
