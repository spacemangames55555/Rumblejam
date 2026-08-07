// THE STATE/EVENT RULE, ENFORCED.
//
//   node tools/snapstate_test.mjs
//
// The rule: if losing it breaks the game, it is STATE and rides the snapshot.
// If losing it is cosmetic, it is an EVENT and may be dropped.
//
// Events are edges — they fire once and are gone, and a peer whose data channel
// was not open at that instant loses them permanently. That is open defect #8,
// and it cost seven suite runs across two branches to find because the drop was
// silent on both ends. net.js now logs every skipped send, but logging a loss
// does not undo it; the fix is that nothing load-bearing travels that way.
//
// So every case here runs with `pushEvent` REPLACED BY A SINK. Not "events
// arrive late", not "one event is dropped" — no event is ever delivered at all.
// Anything a client still needs must therefore be in the snapshot, because
// snapshots repeat 15 times a second and heal on the next frame.

import * as CH from '../js/content/characters.js';
const { Sim } = await import('../js/game.js');
const SK = await import('../js/skillsim.js');
const { encodeSnap, decodeSnap, wireSize } = await import('../js/netcodec.js');
const { CONFIG } = await import('../js/config.js');

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

// A sim whose events go nowhere, exactly as a never-open channel sees it.
function deafSim(seed, party) {
  const g = new Sim({ seed, party });
  g._eventsDropped = [];
  g.pushEvent = ev => { g._eventsDropped.push(ev.k); };
  return g;
}
const duo = [
  { idx: 0, key: 'a', name: 'A', charId: 'bulwark', color: '#fff' },
  { idx: 1, key: 'b', name: 'B', charId: 'onrush', color: '#fff' }];

// ---------------------------------------------------------------- the map

{
  const g = deafSim(4242, duo);
  const s = g.getSnapshot();
  const m = s.st && s.st.map;
  if (m && m.layout && m.layout.nodes.length) ok(`the node map rides the snapshot — ${m.layout.nodes.length} nodes, floor ${m.floorNum}, with every event discarded`);
  else fail(`no map in the snapshot: ${JSON.stringify(m)}`);
  if (m && m.reachable && m.reachable.length) ok(`...with the reachable set (${m.reachable.length}), so a client can actually pick`);
  else fail('reachable set missing — the client could draw the map but not use it');
  if (m && Array.isArray(m.visited)) ok('...and the visited set, so the map it draws matches the host\'s');
  else fail('visited set missing');
  if (!s.st.arena) ok('and NO arena block on the map screen — each phase pays only for its own state');
  else fail('the arena block is sent during map phase');
}

// ---------------------------------------------------------------- the room

{
  const g = deafSim(4242, duo);
  g.uiAction(0, { kind: 'pickNode', nodeId: g.reachableNodes()[0] });
  for (let i = 0; i < 60 * 10 && g.phase === 'map'; i++) g.tick();
  if (g.phase !== 'arena') { fail('could not reach an arena — the rest of this section proves nothing'); }
  else {
    const s = g.getSnapshot();
    const a = s.st.arena;
    if (a && a.w > 0 && a.h > 0 && Array.isArray(a.obstacles)) ok(`the room rides the snapshot — ${a.kind} ${a.w}x${a.h}, ${a.obstacles.length} obstacles`);
    else fail(`no arena in the snapshot: ${JSON.stringify(a)}`);
    if (!s.st.map) ok('...and the map block is absent during a fight');
    else fail('the map is still sent during a fight');

    // The siege collapse used to need its own one-shot `obstacles` event to
    // mutate the client's copy of the walls. A dropped one left a client
    // colliding with geometry that no longer existed.
    const before = g.getSnapshot().st.arena.obstacles.length;
    g.obstacles.push({ x: 400, y: 400, w: 60, h: 60 });
    const after = g.getSnapshot().st.arena.obstacles.length;
    if (after === before + 1) ok(`a wall that moves mid-siege is on the wire immediately (${before} -> ${after}) — the 'obstacles' event is no longer load-bearing`);
    else fail(`a mid-fight obstacle change did not reach the snapshot: ${before} -> ${after}`);
  }
}

// ---------------------------------------------------------------- pending picks

// Closed defect #4 was a missing `boonDone`: the panel's ONLY exit, so the run
// ended behind a panel that would not close. Presence-in-state means a lost
// close event costs nothing — the next snapshot says the offer is gone.
{
  const g = deafSim(4242, duo);
  const p = g.players[0];
  const row = () => g.getSnapshot().st.pend.find(r => r[0] === 0);
  const cases = [['pendingOffer', 1, 'level-up'], ['treasureOffer', 2, 'treasure'], ['boonOffer', 3, 'boon']];
  for (const [field, col, label] of cases) {
    p[field] = [{ id: 'x' }];
    const on = row();
    p[field] = null;
    const off = row();
    if (on && on[col] === 1 && off && off[col] === 0) ok(`a pending ${label} is visible in the snapshot AND so is its absence — a lost *Done can no longer softlock the panel open`);
    else fail(`${label} presence/absence not both visible: ${JSON.stringify(on)} / ${JSON.stringify(off)}`);
  }
}

// ---------------------------------------------------------------- boss phase

{
  const g = deafSim(4242, duo);
  g.boss = { bossDef: { name: 'X' }, hp: 5, maxHp: 10, bs: {} };
  const before = g.getSnapshot().boss.phase2;
  g.boss.bs.phase2 = true;
  const after = g.getSnapshot().boss.phase2;
  if (before === false && after === true) ok('a boss enrage is state on the wire, not only an ENRAGED banner — a client that missed it was fighting a phase it did not know had changed');
  else fail(`boss phase2 did not travel: ${before} -> ${after}`);
}

// ---------------------------------------------------------------- run over

{
  const g = deafSim(4242, duo);
  if (g.getSnapshot().st.over === 0) ok('a live run reports over: 0');
  else fail('over flag set on a live run');
  g.over = true;
  if (g.getSnapshot().st.over === 1) ok('...and the run being over reaches the snapshot — a client that missed `end` is not stranded in a dead world');
  else fail('over flag never set');
}

// ---------------------------------------------------------------- loadout

// This was on NO channel at all. getMeta still ships `weapons`;
// patch-trigger-core replaced weapons with skills and never put the loadout on
// the wire, so a client could not see what it had slotted — and a player who
// cannot see their skills cannot spend a point on one.
{
  CH.setRoster('toh');
  const g = deafSim(31337, Array.from({ length: 8 }, (_, i) => ({
    idx: i, key: 'k' + i, name: 'P' + i, color: '#fff',
    charId: i % 2 ? 'toh_necromancer' : 'toh_samurai' })));
  for (const p of g.players) {
    p.level = 66;
    for (let i = 0; i < 12; i++) {
      const learnable = SK.learnableSkills(p);
      if (!learnable.length) break;
      p.skillPoints++;
      SK.spendSkillPoint(g, p, learnable.sort((a, b) => a.tier - b.tier)[0].id);
    }
    p.skillPoints = 3;
  }
  const s = g.getSnapshot();
  const ld = s.st.ld, keys = s.st.ldk;
  if (ld && ld.length === 8) ok(`every player's loadout rides the snapshot (${ld.length} rows)`);
  else fail(`loadout rows: ${ld && ld.length}`);
  const mine = ld && ld.find(r => r[0] === 0);
  if (mine && mine[1] === 3) ok(`...with unspent points (${mine[1]}), so a client can see it has a point to spend`);
  else fail(`unspent points not carried: ${JSON.stringify(mine)}`);
  const slots = mine ? mine.slice(2).filter(i => i >= 0).map(i => keys[i]) : [];
  if (slots.length && slots.every(x => typeof x === 'string')) ok(`...and slot ids resolve through the intern table: ${slots.join(', ')}`);
  else fail(`slot ids did not resolve: ${JSON.stringify(mine)} keys ${JSON.stringify(keys)}`);
  if (keys.length < ld.length * 2) ok(`interning holds — ${keys.length} unique ids across ${ld.length} players, not one copy each`);
  else fail(`intern table did not dedupe: ${keys.length} keys for ${ld.length} players`);

  // and it survives the real wire codec, not just the object
  const back = decodeSnap(encodeSnap(s));
  if (back.st && back.st.ld && back.st.ldk && back.st.map !== undefined) ok('the whole st block survives encodeSnap/decodeSnap — it is on the real wire, not only in the object');
  else fail('st did not survive the codec');
  CH.setRoster('classic');
}

// ---------------------------------------------------------------- the price

// Stated, not hidden. Carrying state costs bandwidth; the alternative cost a
// player their run.
{
  const g = deafSim(31337, Array.from({ length: 8 }, (_, i) => ({
    idx: i, key: 'k' + i, name: 'P' + i, charId: 'bulwark', color: '#fff' })));
  const s = g.getSnapshot();
  const full = wireSize(encodeSnap(s));
  const bare = wireSize(encodeSnap({ ...s, st: null }));
  const perSec = (full - bare) * CONFIG.SNAPSHOT_HZ / 1024;
  console.log(`  map-phase snapshot: ${(full / 1024).toFixed(2)} KB with state, ${(bare / 1024).toFixed(2)} KB without — the st block costs ${((full - bare) / 1024).toFixed(2)} KB/snap = ${perSec.toFixed(1)} KB/s at ${CONFIG.SNAPSHOT_HZ}Hz`);
  if (perSec < 40) ok(`the price of correctness is ${perSec.toFixed(1)} KB/s on the map screen, where nothing else is moving`);
  else fail(`state costs ${perSec.toFixed(1)} KB/s — too much to carry every snapshot, needs a smaller encoding`);
}

console.log(failures ? `\n${failures} SNAPSHOT-STATE FAILURE(S)` : '\nEVERY LOAD-BEARING STATE SURVIVES WITH ALL EVENTS DROPPED');
process.exit(failures ? 1 : 0);
