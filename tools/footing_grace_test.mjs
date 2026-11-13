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

// FLAT DEFENCE (Game Designer ruling, 2 Nov 2026). Grit, the Footing absorb
// pool and Iron Sleeve's footing scaling stop at footingDefenseCapStacks; the
// stack keeps climbing (it sizes the step-off burst) but standing longer buys
// no more armour.
{
  const { g, p, still } = samurai();
  const { engineScale } = await import('../js/compose.js');
  const { SKILL_BY_ID } = await import('../js/skills.js');
  const sleeve = SKILL_BY_ID && SKILL_BY_ID.sam_iron_sleeve;
  const sleeveStep = sleeve && sleeve.compose.find(c => c.kind === 'shield');
  const read = () => ({ n: p.engines.footing, grit: p.stats.grit || 0, shield: p.footingShield || 0, sleeve: sleeveStep ? engineScale(sleeveStep, p, sleeve) : null });
  const cap = SAM.footingDefenseCapStacks;
  const bare = read();
  for (let i = 0; i < 60 * 20 && p.engines.footing < 1; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); }
  const one = read();
  if (bare.n === 0 && one.n === 1 && one.shield === SAM.footingShieldFlat && one.grit - bare.grit === SAM.footingGritFlat) {
    ok(`Footing grants a flat shield ${SAM.footingShieldFlat} and grit +${SAM.footingGritFlat} from its first stack`);
  } else fail(`flat Footing values: 0 stacks ${JSON.stringify(bare)}, 1 stack ${JSON.stringify(one)}, want shield ${SAM.footingShieldFlat} grit +${SAM.footingGritFlat}`);
  for (let i = 0; i < 60 * 20 && p.engines.footing < cap; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); }
  const atCap = read();
  if (atCap.grit !== one.grit || atCap.shield !== one.shield) fail(`defence moved between 1 and ${cap} stacks: ${JSON.stringify(one)} -> ${JSON.stringify(atCap)}`);
  for (let i = 0; i < 60 * 20 && p.engines.footing < SAM.FOOTING_MAX_STACKS; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); }
  still(3000);
  const full = read();
  if (atCap.n === cap && full.n > cap && full.grit === atCap.grit && full.shield === atCap.shield && atCap.grit > 0 && atCap.shield > 0) {
    ok(`standing longer adds no defence: ${atCap.n} stacks grit ${atCap.grit} / absorb ${atCap.shield}, ${full.n} stacks (3 s more) grit ${full.grit} / absorb ${full.shield}`);
  } else fail(`defence grew with standing: ${JSON.stringify(atCap)} -> ${JSON.stringify(full)}`);
  if (!sleeveStep) fail('Iron Sleeve shield step not found — the cap assertion cannot see it');
  else if (Math.abs(full.sleeve - atCap.sleeve) < 1e-9 && atCap.sleeve > 1) ok(`Iron Sleeve's footing scaling is flat past ${cap} stacks (×${atCap.sleeve.toFixed(3)} at ${atCap.n} and at ${full.n})`);
  else fail(`Iron Sleeve scaling ${atCap.sleeve} at ${atCap.n} -> ${full.sleeve} at ${full.n}`);
}

// THE STEP-OFF BURST (user ruling 2 Nov 2026, pace-spec §6.1b). A full
// stance broken by a real step (past the grace window) releases one ring of
// damage around the Samurai; a sidestep inside the window releases nothing;
// a stance under footingBurstMinStacks releases nothing.
{
  const { g, p, cap, move, still } = samurai();
  for (const e of [...g.enemyPool]) g.enemyPool.release(e);
  g.spawnQueue.length = 0;
  if (g.wave) Object.assign(g.wave, { r0: 0, r1: 0, acc: 0, firstPack: true, dur: Infinity });
  p.loadout.fill(null);                                     // only the burst may hit
  cap();
  const stacks = p.engines.footing;
  const r = SAM.footingBurstBaseR + SAM.footingBurstRPerStack * stacks;
  const ring = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const e = g.spawnEnemyById('pnw_thornhound', p.x + Math.cos(a) * (r - 30), p.y + Math.sin(a) * (r - 30), {});
    e.spd = 0; e.dmg = 0; ring.push(e);
  }
  const far = g.spawnEnemyById('pnw_thornhound', p.x, p.y + r + 200, {}); far.spd = 0; far.dmg = 0;
  const bursts0 = p.footingBursts || 0;
  move(150);                                               // inside the window: holds, no burst
  const early = (p.footingBursts || 0) - bursts0;
  move(SAM.footingGraceMs + 100);                          // past it: the stance breaks
  // The Samurai walked ~0.5 s before the break, so the burst lands where the
  // step broke the stance: score the ring bodies inside r of THAT point.
  const sw = (g.fxBatch.swings || []).filter(x => Math.abs(x.arc - Math.PI * 2) < 1e-6).pop();
  const inR = sw ? ring.filter(e => Math.hypot(e.x - sw.x, e.y - sw.y) <= r + e.radius) : [];
  const dead = inR.filter(e => !e.active).length;
  const outsideAlive = ring.filter(e => !inR.includes(e)).every(e => e.active) && far.active;
  if (early === 0 && (p.footingBursts || 0) === bursts0 + 1 && p.engines.footing === 0 && inR.length >= 2 && dead === inR.length && outsideAlive) {
    ok(`step-off burst: ${stacks} stacks released ${Math.round(SAM.footingBurstPerStack * stacks)} damage in r${r} — ${dead}/${inR.length} fodder inside it died, every body outside lived, the sidestep inside the window fired nothing`);
  } else fail(`step-off burst: early ${early}, bursts ${(p.footingBursts || 0) - bursts0}, stacks after ${p.engines.footing}, ring dead ${dead}/${inR.length} in range, outside alive ${outsideAlive}, swing ${!!sw}`);
  // under the minimum, breaking costs the stance and pays nothing
  still(SAM.footingTickMs * (SAM.footingBurstMinStacks - 1) + 50);
  const small = p.engines.footing, b1 = p.footingBursts || 0;
  move(SAM.footingGraceMs + 300);
  if (small < SAM.footingBurstMinStacks && (p.footingBursts || 0) === b1) ok(`a ${small}-stack stance (under ${SAM.footingBurstMinStacks}) breaks without a burst`);
  else fail(`small stance ${small} fired ${(p.footingBursts || 0) - b1} burst(s)`);
}

console.log(failures ? `\n${failures} GRACE-WINDOW FAILURE(S)` : '\nTHE GRACE WINDOW BEHAVES');
process.exit(failures ? 1 : 0);
