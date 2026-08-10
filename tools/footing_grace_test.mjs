// THE FOOTING MOVEMENT GRACE WINDOW.
//
//   node tools/footing_grace_test.mjs
//
// Movement shorter than footingGraceMs holds the stance; movement longer than
// it drops all of it. The window exists because criterion 13 put the holder at
// x0.37-x0.40 damage taken against a correct sidestepper and that ratio did not
// move for ANY dial tried — per-stack grit, Reflex removal, telegraph density.
// The insensitivity was the evidence: the problem was never the size of a
// stack, it was that a 200ms sidestep cost the whole stance and the rebuild is
// slower than the next commit arrives.
//
// Five behaviours, not one. A window that only protects the sidestep is a
// window that also hands out free room crossings.

// FixtureSim, not Sim: the harness answers its own §5.6 opening card instead
// of tripping the anti-softlock floor at every arena door. Same skill, same
// tick, no defect line — see tools/fixture_sim.mjs.
const { FixtureSim: Sim } = await import('./fixture_sim.mjs');
const SK = await import('../js/skillsim.js');
const { TUNING: SAM } = await import('../js/content/skills/samurai_armor.js');

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

function samurai() {
  const g = new Sim({ seed: 4242, party: [{ idx: 0, key: 'k', name: 'S', charId: 'toh_samurai', color: '#fff' }] });
  g.uiAction(0, { kind: 'pickNode', nodeId: g.reachableNodes()[0] });
  const p = g.players[0]; p.level = 66;
  for (const id of ['sam_cross_guard', 'sam_set_stance']) { p.skillPoints++; SK.spendSkillPoint(g, p, id); }
  g.god = true;
  const cap = () => { for (let i = 0; i < 60 * 20 && p.engines.footing < SAM.FOOTING_MAX_STACKS; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); } };
  const move = ms => { for (let i = 0; i < Math.round(ms / 1000 * 60); i++) { g.setInput(0, { mx: 1, my: 0 }); g.tick(); } };
  const still = ms => { for (let i = 0; i < Math.round(ms / 1000 * 60); i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); } };
  return { g, p, cap, move, still };
}

console.log(`  footingGraceMs=${SAM.footingGraceMs}  refill x${SAM.footingGraceRefill}  cap ${SAM.FOOTING_MAX_STACKS}\n`);

// 1. The case the window exists for.
{
  const { p, cap, move } = samurai();
  cap();
  const before = p.engines.footing;
  move(250);
  if (before === SAM.FOOTING_MAX_STACKS && p.engines.footing === before) ok(`a 250ms sidestep keeps the whole stance (${before} -> ${p.engines.footing})`);
  else fail(`sidestep: ${before} -> ${p.engines.footing}`);
}

// 2. The case it must NOT cover.
{
  const { p, cap, move } = samurai();
  cap();
  const before = p.engines.footing;
  move(1200);
  if (p.engines.footing === 0) ok(`a 1200ms reposition still drops everything (${before} -> 0) — the window protects a step, not a walk`);
  else fail(`reposition kept ${p.engines.footing} stacks`);
}

// 3. THE EXPLOIT. Under a naive timer reset by standing still, "move 300ms,
//    stop one frame, repeat" crosses the whole map at full stance — the instant
//    drop's purpose defeated by a different route. The budget must DECAY, not
//    reset.
{
  const { p, cap, move, still } = samurai();
  cap();
  let moved = 0;
  for (let i = 0; i < 8; i++) { move(300); moved += 300; still(17); }
  if (p.engines.footing === 0) ok(`wiggling (8 x 300ms with one frame of rest between) still drops the stance after ${moved}ms of travel — the grace is a budget that decays, not a timer`);
  else fail(`wiggle kept ${p.engines.footing} stacks across ${moved}ms of movement — that is a free room crossing`);
}

// 4. ...but it must recharge, or it is a once-per-fight resource and a player
//    can only dodge the first commit of a room.
{
  const { p, cap, move, still } = samurai();
  cap();
  move(250); still(600);
  const mid = p.engines.footing;
  move(250);
  if (mid === SAM.FOOTING_MAX_STACKS && p.engines.footing === SAM.FOOTING_MAX_STACKS) ok('after settling 600ms the window is available again — every commit can be sidestepped, not just the first');
  else fail(`second sidestep: ${mid} -> ${p.engines.footing}`);
}

// 5. Holding is not the same as growing. Moving must never PAY.
{
  const { p, move, still } = samurai();
  still(1200);
  const before = p.engines.footing;
  move(300);
  if (p.engines.footing === before && before > 0 && before < SAM.FOOTING_MAX_STACKS) ok(`inside the window the stance holds without growing (${before} stacks, still ${p.engines.footing})`);
  else fail(`hold-not-grow: ${before} -> ${p.engines.footing}`);
}

console.log(failures ? `\n${failures} GRACE-WINDOW FAILURE(S)` : '\nTHE GRACE WINDOW BEHAVES');
process.exit(failures ? 1 : 0);
