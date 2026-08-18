// THE FIXTURE HAS TO BE GATED TOO. Three phase-1 surveys published confident
// numbers about characters that were missing a power source, and each time the
// number looked plausible enough to build a conclusion on:
//
//   `learnableSkills()` returns already-learned nodes  -> a fake level-20 plateau
//   `p.level = 82` spends no stat picks                -> ferocity 0 at level 82
//   a node picked by predicate is a DIFFERENT node     -> a withdrawn headline
//
// All three were caught by asking what the number would have to be if the
// fixture were right (§13 rule 82). This gate asks that question on every run
// instead of when somebody remembers to. It measures nothing about the game —
// every assertion here is about whether `tools/fixture_build.mjs` stages what
// it claims to stage.
//
//   node tools/fixture_gate.mjs
import { FixtureSim as Sim } from './fixture_sim.mjs';
import * as FB from './fixture_build.mjs';
import * as SKILLSIM from '../js/skillsim.js';
import { TREES, levelForSlots, slotsAtLevel, SLOT_LEVELS } from '../js/skills.js';

let failures = 0;
const fail = (m, e) => { failures++; console.error(`✗ ${m}`, e ? (e.stack || e) : ''); };
const ok = m => console.log(`✓ ${m}`);

const P = charId => [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }];
function boot(charId, seed = 7) {
  const g = new Sim({ seed, allowUnplayable: true, party: P(charId) });
  g.god = true;
  const fight = g.floor.nodes.find(n => n.kind === 'combat');
  fight.template = 'open_expanse';
  g._travelTo(fight.id);
  g.wave.done = true; g.spawnQueue.length = 0;
  for (const e of [...g.enemyPool]) g.enemyPool.release(e);
  const p = g.players[0];
  p.x = g.W / 2; p.y = g.H / 2;
  return g;
}

// Output against a ring, in one movement window. `immortal` swaps the mortal
// ring for the never-dying kind the old fixtures used, which is the whole
// point of assertion 3.
function output(charId, { window = 'still', secs = 20, immortal = false, treeId = null,
                          items = false, marks = null } = {}) {
  const g = boot(charId);
  const p = g.players[0];
  if (treeId) {
    p.level = 82; FB.spendStats(g, p, 81);
    for (const sk of [...TREES[treeId].skills].sort((a, b) => a.tier - b.tier)) { p.skillPoints++; SKILLSIM.spendSkillPoint(g, p, sk.id); }
    for (const id of Object.keys(p.skillRanks)) for (let r = 1; r < 5; r++) { p.skillPoints++; SKILLSIM.spendSkillPoint(g, p, id); }
    g._recomputeStats(p);
  } else {
    FB.buildCharacter(g, p, { level: 82, mode: 'spread', items });
  }
  let ring = null, dummies = null;
  if (immortal) {
    dummies = [];
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI * 2 / 8;
      const e = g.spawnEnemyById('slabjaw', p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90, { noMats: true });
      if (e) { e.hp = 1e9; e.maxHp = 2e9; e.spd = 0; e.dmg = 0; dummies.push({ e, x: e.x, y: e.y }); }
    }
  } else {
    ring = FB.mortalRing(g, p, 'slabjaw', { n: 8, radius: 90, hp: 900 });
  }
  const at = {};
  for (let t = 0; t < secs * 60; t++) {
    if (window === 'moving') FB.driveMoving(g, p, t); else FB.driveStill(g, p);
    if (dummies) for (const d of dummies) { d.e.x = d.x; d.e.y = d.y; d.e.knockX = d.e.knockY = 0; d.e.hp = 1e9; }
    if (ring) ring.refresh();
    g.tick();
    if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
    const s = (t + 1) / 60;
    if (marks) for (const m of marks) if (Math.abs(s - m) < 1e-9) at[m] = p.damageDealt;
  }
  return { dps: p.damageDealt / secs, p, at, deaths: ring ? ring.deaths() : 0 };
}
const windows = at => {
  const ks = Object.keys(at).map(Number).sort((a, b) => a - b);
  let pv = 0, pt = 0; const out = [];
  for (const k of ks) { out.push((at[k] - pv) / (k - pt)); pv = at[k]; pt = k; }
  return out;
};

// ---- 1. the slot pin -------------------------------------------------------
// PREDICTION: levelForSlots is the exact inverse of slotsAtLevel, and the two
// re-pinned fixtures land on 3 slots rather than the 4 that level 12 silently
// became.
{
  let bad = 0;
  for (let n = 1; n <= SLOT_LEVELS.length; n++) {
    const lv = levelForSlots(n);
    if (slotsAtLevel(lv) !== n) { bad++; fail(`levelForSlots(${n}) = ${lv} grants ${slotsAtLevel(lv)} slots`); }
  }
  if (!bad) ok(`levelForSlots inverts slotsAtLevel across all ${SLOT_LEVELS.length} gates (3 slots = level ${levelForSlots(3)}, which is what sim_test's ARM_SLOTS/DPS_SLOTS now ask for)`);
}

// ---- 2. items are carried and they move the statline ------------------------
// PREDICTION: a level-82 character reaching region 8 buys 7 x 8 = 56 items, and
// carrying them is worth tens of percent — if it were worth ~0 the loadout rule
// would be modelling nothing and phase 1's omission would not have mattered.
{
  const g = boot('toh_hunter'); const p = g.players[0];
  const bare = FB.buildCharacter(g, p, { level: 82, mode: 'spread', items: false });
  const g2 = boot('toh_hunter'); const p2 = g2.players[0];
  const kit = FB.buildCharacter(g2, p2, { level: 82, mode: 'spread', items: true });

  if (kit.items !== FB.ITEMS_PER_REGION * 8) fail(`itemised build carries ${kit.items} items, want ${FB.ITEMS_PER_REGION * 8} (${FB.ITEMS_PER_REGION}/region x 8 regions)`);
  else ok(`itemised build carries ${kit.items} items (${FB.ITEMS_PER_REGION} per region reached x 8), bare build carries ${bare.items}`);

  if (bare.ferocity <= 0) fail(`bare level-82 build has ferocity ${bare.ferocity} — stat picks are not being spent`);
  else if (kit.vitality <= bare.vitality || kit.ferocity <= bare.ferocity) {
    fail(`items did not move the statline: vit ${bare.vitality}->${kit.vitality}, fer ${bare.ferocity}->${kit.ferocity}`);
  } else {
    ok(`items move the statline: vitality ${bare.vitality}->${kit.vitality}, ferocity ${bare.ferocity}->${kit.ferocity}`);
  }

  const a = output('toh_hunter', { items: false }).dps;
  const b = output('toh_hunter', { items: true }).dps;
  const lift = (b / Math.max(1e-9, a) - 1) * 100;
  if (lift < 5) fail(`items are worth ${lift.toFixed(0)}% of output — either the loadout is not reaching _recomputeStats or the catalog is inert`);
  else ok(`items are worth ${lift.toFixed(0)}% of a level-82 hunter's output (${a.toFixed(0)} -> ${b.toFixed(0)} DPS) — a survey that omits them under-reads player power by about that`);
}

// ---- 3. MOVEMENT windows ---------------------------------------------------
// PREDICTION: `mode:'still'` fires for free on a stationary fixture because
// `stillT` accrues on its own, so the tree that reads low is the MOVING one.
// samurai_agility should be several times higher when driven; samurai_armor and
// samurai_tactics should be higher standing. If agility came out flat, the
// staging is not reaching `movingT` and this is a fixture bug, not a finding.
{
  const agiStill = output('toh_samurai', { treeId: 'samurai_agility', window: 'still' }).dps;
  const agiMove = output('toh_samurai', { treeId: 'samurai_agility', window: 'moving' }).dps;
  const armStill = output('toh_samurai', { treeId: 'samurai_armor', window: 'still' }).dps;
  const armMove = output('toh_samurai', { treeId: 'samurai_armor', window: 'moving' }).dps;

  if (!(agiMove > agiStill * 2)) fail(`samurai_agility reads ${agiStill.toFixed(0)} still / ${agiMove.toFixed(0)} moving — driveMoving is not reaching movingT`);
  else ok(`samurai_agility reads ${agiMove.toFixed(0)} moving against ${agiStill.toFixed(0)} still (x${(agiMove / agiStill).toFixed(1)}) — the window a stationary fixture never opened`);

  if (!(armStill > armMove)) fail(`samurai_armor reads ${armStill.toFixed(0)} still / ${armMove.toFixed(0)} moving — the 'still' half should not need staging`);
  else ok(`samurai_armor reads ${armStill.toFixed(0)} still against ${armMove.toFixed(0)} moving — no single window measures this class, which is why it is reported as a pair`);

  // and the window set is derived from the kit, not from a list of class ids
  const g = boot('toh_samurai'); const p = g.players[0];
  FB.buildCharacter(g, p, { level: 82, mode: 'spread' });
  const w = FB.movementWindows(p);
  if (!w.length) fail('movementWindows returned nothing');
  else ok(`movementWindows(level-82 samurai) = [${w.join(', ')}] — read off the slotted triggers`);

  // STAGING MUST NOT COST THE THING IT STAGES. The first version drove a real
  // circle and a hunter's output fell 19x because its pets and placed effects
  // were left behind. Jittering the axis keeps `p.moving` true at ~0 net
  // displacement; a class with no movement node should barely notice.
  const hs = output('toh_hunter', { window: 'still' }).dps;
  const hm = output('toh_hunter', { window: 'moving' }).dps;
  const drift = Math.abs(hm - hs) / Math.max(1e-9, hs) * 100;
  if (drift > 25) fail(`a hunter (no MOVEMENT node) reads ${hs.toFixed(0)} still / ${hm.toFixed(0)} moving — ${drift.toFixed(0)}% drift means the staging is displacing the character away from its own kit`);
  else ok(`staging is output-neutral for a kit that does not ask for it: hunter ${hs.toFixed(0)} still / ${hm.toFixed(0)} moving (${drift.toFixed(0)}% drift)`);
}

// ---- 4a. a dot on a body that never dies compounds --------------------------
// PREDICTION: `applyPlague` adds to `plagueDps` and only refreshes the timer, so
// on an immortal target the dot climbs every sample and never settles; on a ring
// that dies it does not. The class that shows this is the WITCH DOCTOR — the
// brief named the savage, and the savage's problem turns out to be 4b instead.
// If the immortal arm came out flat, the compounding has been fixed in the game
// and this arm should be DELETED rather than loosened.
{
  const peak = (charId, immortal) => {
    const marks = [15, 30, 45, 60];
    const g = boot(charId); const p = g.players[0];
    FB.buildCharacter(g, p, { level: 82, mode: 'spread' });
    let ring = null; const ds = [];
    if (immortal) {
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI * 2 / 8;
        const e = g.spawnEnemyById('slabjaw', p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90, { noMats: true });
        if (e) { e.hp = 1e9; e.maxHp = 2e9; e.spd = 0; e.dmg = 0; ds.push({ e, x: e.x, y: e.y }); }
      }
    } else ring = FB.mortalRing(g, p, 'slabjaw', { n: 8, radius: 90, hp: 900 });
    const rec = [];
    for (let t = 0; t < 60 * 60; t++) {
      FB.driveStill(g, p);
      for (const d of ds) { d.e.x = d.x; d.e.y = d.y; d.e.knockX = d.e.knockY = 0; d.e.hp = 1e9; }
      if (ring) ring.refresh();
      g.tick();
      if (p.boonOffer) g.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
      const s = (t + 1) / 60;
      if (marks.includes(s)) {
        const bodies = immortal ? ds.map(d => d.e) : ring.ring.map(r => r.e);
        rec.push(Math.round(Math.max(0, ...bodies.map(e => e.plagueDps || 0))));
      }
    }
    return rec;
  };
  const wd = [...FB.DOT_COMPOUNDS][0];
  const imm = peak(wd, true), mort = peak(wd, false);
  const mono = imm.every((v, i) => i === 0 || v >= imm[i - 1]);
  if (!(mono && imm[3] > imm[0] * 2)) fail(`${wd} dot on immortal targets reads [${imm}] — expected unbounded compounding`);
  else ok(`${wd} dot compounds on immortal targets: peak plagueDps [${imm}] at 15/30/45/60s`);
  if (mort[3] >= imm[3]) fail(`the mortal ring did not bound the dot: [${mort}] against [${imm}]`);
  else ok(`the mortal ring bounds it: [${mort}] against [${imm}] — a body that dies takes its accrued dot with it`);
}

// ---- 4b. cascade, which no target arrangement fixes -------------------------
// PREDICTION: `cascade` is uncapped by design, fed by firing VARIETY rather than
// by kills, and 12 savage steps scale damage linearly with it through
// compose.js:54. So the savage ramps against ANYTHING, mortal ring included, and
// its DPS is a function of window length. A control class must not.
//
// This arm asserts a PROPERTY OF THE GAME that the fixture cannot fix, so that
// no survey quotes a savage number without stating its window. If cascade ever
// gains a cap this goes red, and the right response is to delete it.
{
  const MARKS = [20, 40, 60, 80, 100, 120];
  const rise = w => w[w.length - 1] / Math.max(1e-9, w[0]);
  const sav = windows(output('toh_savage', { secs: 120, marks: MARKS }).at);
  const con = windows(output('toh_hunter', { secs: 120, marks: MARKS }).at);
  const savCasc = output('toh_savage', { secs: 120 }).p.engines.cascade;

  if (!(rise(sav) > 2)) fail(`savage on a mortal ring reads [${sav.map(v => v.toFixed(0))}] — expected the cascade ramp; if cascade is now capped, delete this arm`);
  else ok(`savage ramps on MORTAL targets too: [${sav.map(v => v.toFixed(0))}] (x${rise(sav).toFixed(1)} over 120s, cascade ${savCasc}) — cascade is uncapped by design and 12 of its steps scale damage linearly with it`);
  if (rise(con) > 1.5) fail(`the control class also ramps ([${con.map(v => v.toFixed(0))}]) — the ramp is the fixture, not the engine`);
  else ok(`control (hunter) is flat over the same 120s: [${con.map(v => v.toFixed(0))}] (x${rise(con).toFixed(2)})`);
  if (!FB.MEASURE_SECONDS || FB.MEASURE_SECONDS > 60) fail(`MEASURE_SECONDS is ${FB.MEASURE_SECONDS} — a window-dependent class needs a room-length window, not an endurance test`);
  else ok(`every measurement is pinned to MEASURE_SECONDS = ${FB.MEASURE_SECONDS}s, against a ~45s region-8 room — a savage figure is only meaningful with its window attached`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nfixture gate: all green');
process.exit(failures ? 1 : 0);
