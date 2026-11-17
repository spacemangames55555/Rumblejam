// EVERY REGION'S GROUND DOES WHAT IT SAYS — measured on a running Sim.
//
// js/hazards.js gives each region one hazard built from five primitives
// (ruling R-20). Nothing here reads a def to decide whether a hazard works: a
// character is stood on the real floor of a real room, with the wave stopped,
// and the gate watches what happens to it.
//
//   placement     a plain fight in every region carries its region's ground;
//                 region 1's map 1, an objective room and a siege do not
//   spdMult       ten ticks of walking inside a patch cover spdMult of what
//                 the same ten ticks cover on open floor
//   dps           two seconds stood in a patch cost health; on open floor none
//   drift         stood still in a current, the body is carried along the
//                 patch's heading at drift × the body's pull resistance
//   ice           a body that walks onto ice and lets go keeps going; on open
//                 floor it stops
//   front         over one full cycle the band sweeps the room, burns a body
//                 it crosses, and burns nothing while it rests
//   guest         a guest's copy of the room (snapshot → wire codec → decode)
//                 answers hazardMoveAt exactly as the host's does, so a guest
//                 predicts the same slowdown, current and slide
//
// Usage: node tools/hazard_gate.mjs [regionIndex ...]
import { Sim } from '../js/game.js';
import { REGIONS } from '../js/regions.js';
import { REGION_HAZARDS, hazardMoveAt, pullResistFor } from '../js/hazards.js';
import { encodeSnap, decodeSnap } from '../js/netcodec.js';

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };
const only = process.argv.slice(2).map(Number).filter(n => n > 0);

const make = (seed, regionIndex) => {
  const g = new Sim({ seed, regionIndex, party: [{ idx: 0, key: 'k', name: 'H', charId: 'toh_samurai', color: '#fff' }] });
  const p = g.players[0];
  if (p.openingOffer) g.uiAction(0, { kind: 'opening', id: p.openingOffer[0].id });
  return g;
};
// A room of `kind` (col ≥ minCol), entered, with the wave stopped and the
// field cleared, so nothing but the floor touches the character.
function stage(regionIndex, kinds, minCol = 0) {
  for (let s = 0; s < 30; s++) {
    const g = make(6100 + s * 337, regionIndex);
    const node = g.floor.nodes.find(n => kinds.includes(n.kind) && n.col >= minCol);
    if (!node) continue;
    g._travelTo(node.id);
    if (g.phase !== 'arena') continue;
    quiet(g);
    return g;
  }
  return null;
}
function quiet(g) {
  for (const e of [...g.enemyPool]) g.enemyPool.release(e);
  g.spawnQueue.length = 0;
  if (g.wave) Object.assign(g.wave, { r0: 0, r1: 0, acc: 0, dur: 1e9, done: false });
}
const regionPatches = (g) => g.hazards.filter(h => h.type === 'region');
function settle(g, ticks = 120) { for (let i = 0; i < ticks; i++) { quiet(g); g.setInput(0, { mx: 0, my: 0 }); g.tick(); } }
// Ticks with input, re-placing nothing; returns the displacement.
function walk(g, p, mx, my, ticks) {
  const x0 = p.x, y0 = p.y;
  for (let i = 0; i < ticks; i++) { quiet(g); g.setInput(0, { mx, my }); g.tick(); }
  return { dx: p.x - x0, dy: p.y - y0, d: Math.hypot(p.x - x0, p.y - y0) };
}
const at = (p, x, y) => { p.x = x; p.y = y; p.pullX = p.pullY = 0; p.slideX = p.slideY = 0; };
// The MEDIAN step of ten, from a standstill. A total would be at the mercy of
// the class's own movement skills — the Samurai's fire on sustained walking,
// and one such dash inflated the first version's open-floor sample by half.
function stepMedian(g, p, x, y) {
  at(p, x, y); settle(g, 30); at(p, x, y);
  const steps = [];
  for (let i = 0; i < 10; i++) { const x0 = p.x, y0 = p.y; quiet(g); g.setInput(0, { mx: 1, my: 0 }); g.tick(); steps.push(Math.hypot(p.x - x0, p.y - y0)); }
  steps.sort((a, b) => a - b);
  return steps[5];
}
// Damage the floor deals over `ticks`, counted as it lands and given back, so
// the body never dies and a clamp to max health cannot hide anything.
function damageOver(g, p, ticks, each = null) {
  let sum = 0;
  const orig = g.hurtPlayer;
  g.hurtPlayer = function (pl, raw, src, opts) {
    const h0 = pl.hp; const r = orig.call(this, pl, raw, src, opts);
    if (pl === p) { sum += Math.max(0, h0 - pl.hp); pl.hp = h0; pl.downed = false; }
    return r;
  };
  try {
    for (let i = 0; i < ticks; i++) { const s0 = sum; quiet(g); g.setInput(0, { mx: 0, my: 0 }); g.tick(); if (each) each(sum - s0); }
  } finally { g.hurtPlayer = orig; }
  return sum;
}
const open = (g) => ({ x: g.W / 2, y: g.H / 2 });   // the drop point; js/hazards.js keeps patches off it

console.log('REGION GROUND, MEASURED\n');

// ---- 0. every region names its hazard, and the names are these ----
{
  const want = ['undergrowth', 'bloodmire', 'fae_ring', 'quicksand', 'rot_pool', 'black_ice', 'riptide', 'bushfire'];
  const got = REGIONS.map(r => r.hazard);
  if (JSON.stringify(got) === JSON.stringify(want) && got.every(id => REGION_HAZARDS[id])) ok(`region hazards: ${got.map((h, i) => `${i + 1}=${h}`).join(', ')}`);
  else bad(`region hazards drifted: ${got.join(', ')}`);
}

// ---- 1. the rooms that carry none ----
{
  const onb = stage(1, ['combat'], 0);
  const onbNode = onb && onb.arenaNode;
  if (onb && onbNode.col === 0 && regionPatches(onb).length === 0) ok('region 1 map 1 (the onboarding room) carries no ground hazard');
  else bad(`region 1 map 1: ${onb ? regionPatches(onb).length : '?'} patch(es) at col ${onbNode && onbNode.col}`);
  const obj = stage(2, ['zone', 'nest', 'bounty', 'breach', 'relic', 'storm', 'payload', 'elite_arena'], 0);
  if (obj && regionPatches(obj).length === 0) ok(`an objective room (${obj.arenaNode.kind}, region 2) carries none — the objective already says where to stand`);
  else bad(`objective room: ${obj ? regionPatches(obj).length + ' patch(es)' : 'not staged'}`);
  const sg = make(6100, 2); sg._travelTo(sg.floor.bossId);
  if (regionPatches(sg).length === 0) ok('a siege carries none');
  else bad(`siege carries ${regionPatches(sg).length} patch(es)`);
}

// ---- 2. every region's ground, on its own floor ----
for (const R of REGIONS) {
  if (only.length && !only.includes(R.index)) continue;
  const def = REGION_HAZARDS[R.hazard];
  const g = stage(R.index, ['combat'], 1);
  console.log(`── region ${R.index} · ${def.name}`);
  if (!g) { bad(`region ${R.index}: no plain fight staged`); continue; }
  const ps = regionPatches(g);
  const p = g.players[0];
  g.god = true;
  settle(g, 90);                                              // spawn grace runs out
  if (def.front ? ps.length === 1 : ps.length >= def.count[0]) ok(`a plain fight carries ${def.front ? 'one front' : `${ps.length} patch(es) of ${R.hazard}`}`);
  else { bad(`a plain fight carries ${ps.length} ${R.hazard} patch(es)`); continue; }
  const hz = ps[0], o = open(g);

  if (def.spdMult) {
    const inside = stepMedian(g, p, hz.x - 20, hz.y), out = stepMedian(g, p, o.x, o.y);
    const ratio = inside / out;
    if (Math.abs(ratio - def.spdMult) < 0.03) ok(`speed inside ×${ratio.toFixed(2)} of open floor (declares ×${def.spdMult})`);
    else bad(`speed inside ×${ratio.toFixed(2)} of open floor, declares ×${def.spdMult}`);
  }
  if (def.dps && !def.front) {
    g.god = false;
    at(p, hz.x, hz.y); p.invuln = 0;
    let iframes = 0;
    const lostIn = damageOver(g, p, 120, () => { if (p.invuln > 0) iframes++; });
    at(p, o.x, o.y); const lostOut = damageOver(g, p, 120);
    g.god = true;
    // The floor is the LEVEL, not an attacker: a tick that granted i-frames
    // would make a body stood in it immune to the horde.
    if (iframes === 0) ok('standing in it grants no i-frames — the horde can still hit a body stood in it');
    else bad(`standing in it granted i-frames on ${iframes} of 120 ticks — the floor is shielding the player from the horde`);
    if (lostIn > 0 && lostOut === 0) ok(`two seconds stood in it cost ${lostIn.toFixed(0)} health; on open floor nothing`);
    else bad(`two seconds in it cost ${lostIn.toFixed(1)}, on open floor ${lostOut.toFixed(1)}`);
  }
  if (def.drift) {
    at(p, hz.x, hz.y); const m = walk(g, p, 0, 0, 15);
    const want = def.drift * pullResistFor(p.char.trait.key, p.stats.grit) * 15 / 60;
    const head = Math.atan2(m.dy, m.dx) * 180 / Math.PI, off = Math.abs(((head - hz.a) % 360 + 540) % 360 - 180);
    if (Math.abs(m.d - want) / want < 0.1 && off < 3) ok(`stood still in it, carried ${m.d.toFixed(1)} units along its ${hz.a}° heading in a quarter second (want ${want.toFixed(1)})`);
    else bad(`stood still in it, carried ${m.d.toFixed(1)} (want ${want.toFixed(1)}) at ${head.toFixed(0)}° (heading ${hz.a}°)`);
  }
  if (def.ice) {
    at(p, hz.x - 30, hz.y); walk(g, p, 1, 0, 3); const onIce = walk(g, p, 0, 0, 6).d;
    at(p, o.x, o.y); walk(g, p, 1, 0, 3); const offIce = walk(g, p, 0, 0, 6).d;
    if (onIce > 20 && offIce === 0) ok(`let go on the ice and it kept going ${onIce.toFixed(0)} units in a tenth of a second; on open floor it stopped`);
    else bad(`let go on ice: moved ${onIce.toFixed(1)}; on open floor ${offIce.toFixed(1)}`);
  }
  if (def.front) {
    g.god = false;
    at(p, g.W / 2, g.H / 2 - 60);
    const f = def.front, ticks = Math.round((f.sweepS + f.restS) * 60) + 30;
    let onT = 0, offT = 0, lostOn = 0, lostOff = 0, lastX = null, mono = true, crossed = false;
    for (let i = 0; i < ticks; i++) {
      let lost = 0;
      damageOver(g, p, 1, (d) => { lost = d; });
      if (hz.on) {
        onT++; lostOn += lost;
        if (lastX !== null && Math.sign(hz.x - lastX) !== hz.dir && hz.x !== lastX) mono = false;
        lastX = hz.x;
        if (Math.abs(hz.x - p.x) < hz.w / 2) crossed = true;
      } else { offT++; lostOff += lost; lastX = null; }
    }
    g.god = true;
    if (onT > 0 && offT > 0 && mono && crossed) ok(`over one cycle it swept the room for ${(onT / 60).toFixed(1)} s, always the same way, and rested ${(offT / 60).toFixed(1)} s`);
    else bad(`front: on ${onT} ticks, off ${offT}, monotone ${mono}, crossed the body ${crossed}`);
    if (lostOn > 0 && lostOff === 0) ok(`it burned the body it crossed (${lostOn.toFixed(0)} health) and nothing while it rested`);
    else bad(`front burn: ${lostOn.toFixed(1)} while sweeping, ${lostOff.toFixed(1)} while resting`);
  }

  // A guest's copy, through the codec, answers the movement question alike.
  const snap = decodeSnap(encodeSnap(g.getSnapshot()));
  const guest = snap.st && snap.st.arena ? snap.st.arena.hazards : null;
  const pts = [];
  for (const h of ps) if (!h.front) pts.push([h.x, h.y], [h.x + h.r * 0.9, h.y], [h.x, h.y - h.r * 0.95], [h.x + h.r + 5, h.y]);
  pts.push([o.x, o.y]);
  const differ = pts.filter(([x, y]) => JSON.stringify(hazardMoveAt(g.hazards, x, y)) !== JSON.stringify(hazardMoveAt(guest, x, y)));
  if (guest && differ.length === 0) ok(`a guest's room, through the wire codec, moves a body exactly as the host's at ${pts.length} points`);
  else bad(`guest/host movement differs at ${differ.length} of ${pts.length} points${guest ? '' : ' (no hazards on st.arena)'}`);
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
if (fails) { console.log('A REGION\'S GROUND DOES NOT DO WHAT IT SAYS'); process.exit(1); }
console.log('EVERY REGION\'S GROUND DOES WHAT IT SAYS, FOR HOST AND GUEST ALIKE');
