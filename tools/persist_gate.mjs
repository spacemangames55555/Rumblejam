// A PERSISTENT ACTIVE HOLDS WHILE SLOTTED, AND ONLY WHILE SLOTTED.
//
// Marrownaut is the first skill in the game that is neither a passive nor a
// firing active: it occupies one of the eight slots, never fires, and holds a
// form, a pull field and a shield for as long as it is in the bar. Three
// separate things can go wrong with that and none of them is visible from a
// declaration, so each is measured against a live sim rather than read.
//
//   THE FORM CAN OUTLIVE THE SLOT. `formT` is a countdown and a persistent form
//   sits in it, so an un-slot that clears the form in one place and not another
//   leaves a player permanently buffed by a skill they dropped. The teardown
//   has to clear every piece, not the piece its author remembered.
//
//   THE FIELD CAN DOUBLE. `addAura` is idempotent via `auraFor`, and a teardown
//   that misses the zone would make re-slotting register a second one — two
//   pulls on one player, twice the marker writes, and nothing on screen saying
//   so.
//
//   THE PULL CAN OUTRANK A CAST TAUNT. This is the ruling the whole design
//   turns on: the field sits BELOW a deliberate taunt. If the aura wrote
//   `e.tauntT` it would become a step-1 live taunt and silently beat the Mage's
//   entire Invite branch. That is asserted here against a real taunt rather
//   than trusted to a comment.
//
// AND ZERO DAMAGE, which is what keeps a permanent aggro field on the right
// side of the statue test. Asserted by standing a Marrownaut in a full room and
// letting the clock run: if the pull is honest, the enemies arrive and nothing
// dies.
//
//   node tools/persist_gate.mjs [--verbose]

import { Sim } from '../js/game.js';
import { SKILL_BY_ID, TREES, TIER_LEVELS } from '../js/skills.js';
import { spendSkillPoint, setLoadout, applyPersistents } from '../js/skillsim.js';
import { PERSIST_T, CONFIG as CFG, TANK_PULL } from '../js/config.js';
import { engineScale } from '../js/compose.js';

const VERBOSE = process.argv.includes('--verbose');
let checks = 0, fails = 0;
const ok = m => { checks++; console.log(`✓ ${m}`); };
const bad = m => { checks++; fails++; console.log(`✗ ${m}`); };

// Derived: every persistent active in the game, so a second one is measured
// without editing this.
const PERSISTENT = Object.values(SKILL_BY_ID).filter(s => s.persist);

// THE LEVEL IS DERIVED FROM THE DEEPEST NODE UNDER TEST, not fixed at 20.
// It was 20 while Marrownaut — tier 2, unlock level 3 — was the only persistent
// node. The Blacksmith's Celestial Calcite is tier 8, unlock level 24, so a
// level-20 fixture could not learn it: `spendSkillPoint` no-opped, the rank
// stayed 0, `applyPersistents` skipped it, and the gate reported the form as
// simply absent. A fixture that cannot reach its subject reports the subject
// broken, which is the most expensive kind of green-to-red there is.
function levelFor(ids) {
  const deepest = Math.max(...ids.map(id => (SKILL_BY_ID[id] || {}).tier || 1));
  return Math.max(20, TIER_LEVELS[deepest - 1] || 36);
}

function build(charId, learn, level = levelFor(learn)) {
  const g = new Sim({ seed: 4711, party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const p = g.players[0];
  p.level = level;
  for (const id of learn) { p.skillPoints++; spendSkillPoint(g, p, id); }
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);
  return { g, p };
}

// The prereq chain up to and including a skill, cheapest first.
function chainTo(id) {
  const out = [];
  let cur = SKILL_BY_ID[id];
  while (cur) { out.unshift(cur.id); cur = cur.prereq ? SKILL_BY_ID[cur.prereq] : null; }
  return out;
}

const pullZone = (g, p, id) => g.zones.find(z => z.follow === p.idx && z.auraKey === id);

console.log(`PERSISTENT ACTIVES — ${PERSISTENT.length} node(s)\n`);
if (!PERSISTENT.length) { console.log('nothing to measure'); process.exit(1); }

for (const sk of PERSISTENT) {
  const classId = TREES[sk.tree].classId;
  const { g, p } = build(classId, chainTo(sk.id));
  const q = sk.persist;
  const label = sk.id;

  // ---- 1. slotted at the door: everything is up ----
  //
  // A DAMAGING ACTIVE SITS BESIDE IT, and that is not fixture convenience: the
  // anti-softlock floor in `setLoadout` refuses any bar with no damage in it,
  // and a persistent node is not damaging. So Marrownaut can never be the only
  // thing slotted, and a test that tried would measure the floor's refusal
  // instead of the teardown.
  const dmgId = Object.values(SKILL_BY_ID).find(x => x.tree === sk.tree && x.type === 'active'
    && !x.persist && p.skillRanks[x.id] > 0);
  // START FROM UNSLOTTED. `spendSkillPoint` auto-slots the first active a
  // player learns, so a persistent node is already ON by the time the fixture
  // reaches the room — and a "before" snapshot taken here would have the form
  // in it and measure nothing.
  p.loadout = new Array(8).fill(null);
  if (dmgId) p.loadout[1] = dmgId.id;
  applyPersistents(g, p);
  // THE BASELINE IS THE SHEET WITH THE NODE OUT OF THE BAR, not the character's
  // declared stats: level, items and passives all contribute, so comparing
  // against `char.stats` would call a level-20 character's Vitality "residue"
  // from a form that never touched it. The claim is that un-slotting RETURNS
  // the sheet to where it was, and that is what gets measured.
  const sheet0 = { ...p.stats };
  g.cleared = true;                      // §5.5: a bar only changes between rooms
  setLoadout(g, p, 0, sk.id);
  const baseTempo = p.char.stats.tempo || 0;
  g.tick();
  if (q.form) {
    if (p.form === q.form && p.formT === PERSIST_T) ok(`${label}: slotted — form "${q.form}" holds, off the clock`);
    else bad(`${label}: slotted — form is ${JSON.stringify(p.form)} formT ${p.formT}, want "${q.form}" at PERSIST_T`);
  }
  if (q.stats) {
    const want = Object.entries(q.stats);
    const wrong = want.filter(([k, v]) => Math.abs((p.stats[k] - (sheet0[k] || 0)) - v) > 0.001);
    if (!wrong.length) ok(`${label}: slotted — ${want.map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')} landed on the sheet exactly`);
    else bad(`${label}: slotted — stat(s) wrong: ${wrong.map(([k, v]) => `${k} moved ${(p.stats[k] - (sheet0[k] || 0)).toFixed(2)}, wanted ${v}`).join('; ')}`);
  }
  let z = q.aura ? pullZone(g, p, sk.id) : null;
  if (q.aura) {
    if (z && z.r === q.aura.radius && Math.abs(z.every - q.aura.pulseMs / 1000) < 1e-9 && z.dur === Infinity) {
      ok(`${label}: slotted — field up, r ${z.r}, pulse ${(z.every * 1000).toFixed(0)}ms, no expiry`);
    } else bad(`${label}: slotted — field wrong or absent: ${z ? `r ${z.r} every ${z.every} dur ${z.dur}` : 'none'}`);
    if (z && !z.dps) ok(`${label}: the field does ZERO damage — dps ${z.dps}`);
    else if (z) bad(`${label}: the field has dps ${z.dps} — a permanent damaging aura is the statue test`);
  }
  if (q.shield) {
    if (p.shield > 0 && p.shieldT === PERSIST_T) ok(`${label}: slotted — shield ${p.shield.toFixed(1)} holds, off the clock`);
    else bad(`${label}: slotted — shield ${p.shield} shieldT ${p.shieldT}, want > 0 at PERSIST_T`);
  }

  // ---- 2. it does not tick away ----
  const shieldBefore = p.shield;
  for (let i = 0; i < 60 * 30; i++) g.tick();
  const stillUp = (!q.form || p.form === q.form) && (!q.aura || !!pullZone(g, p, sk.id));
  if (stillUp) ok(`${label}: still up after 30 s — nothing expired it`);
  else bad(`${label}: expired within 30 s — form ${JSON.stringify(p.form)}, field ${pullZone(g, p, sk.id) ? 'up' : 'gone'}`);

  // ---- 3. UN-SLOT: no residue ----
  //
  // BETWEEN ROOMS, because that is the only time the game allows it: §5.5
  // forbids a mid-fight loadout change and `setLoadout` enforces it. Thirty
  // seconds of ticking left this fixture in an uncleared arena, so the flag is
  // set to put it where a player actually stands when they change their bar.
  g.cleared = true;
  const off = setLoadout(g, p, 0, null);
  if (!off.ok) { bad(`${label}: could not un-slot — ${off.reason}`); continue; }
  const residue = [];
  if (q.form && p.form === q.form) residue.push(`form still "${p.form}"`);
  if (q.form && p.formT) residue.push(`formT ${p.formT}`);
  if (q.form && p.formStats) residue.push('formStats still set');
  for (const k of Object.keys(sheet0)) {
    if (Math.abs((p.stats[k] || 0) - (sheet0[k] || 0)) > 0.001) {
      residue.push(`${k} ${(p.stats[k] || 0).toFixed(2)} != ${(sheet0[k] || 0).toFixed(2)} before slotting`);
    }
  }
  if (q.aura && pullZone(g, p, sk.id)) residue.push('field still registered');
  if (q.shield && (p.shield || p.shieldT)) residue.push(`shield ${p.shield} shieldT ${p.shieldT}`);
  if (!residue.length) ok(`${label}: un-slotted — form, stats, field and shield all cleared`);
  else bad(`${label}: un-slotted — residue: ${residue.join('; ')}`);

  // ---- 4. RE-SLOT: clean re-entry, exactly one field ----
  setLoadout(g, p, 0, sk.id);
  g.tick();
  const fields = g.zones.filter(x => x.follow === p.idx && x.auraKey === sk.id).length;
  if (!q.aura || fields === 1) ok(`${label}: re-slotted — exactly ${fields} field, not doubled`);
  else bad(`${label}: re-slotted — ${fields} fields registered, the teardown left one behind`);
  if (!q.form || p.form === q.form) ok(`${label}: re-slotted — form back`);
  else bad(`${label}: re-slotted — form is ${JSON.stringify(p.form)}`);
  if (VERBOSE) console.log(`      shield ${shieldBefore.toFixed(1)} -> ${p.shield.toFixed(1)}, tempo ${baseTempo} -> ${p.stats.tempo}`);
}

// ---- 5. PRECEDENCE: a cast taunt still wins ----
{
  const mn = PERSISTENT.find(s => s.persist.aura && s.persist.aura.taunt);
  if (!mn) { bad('no persistent node declares a pull field — precedence cannot be measured'); }
  else {
    const { g, p } = build(TREES[mn.tree].classId, chainTo(mn.id));
    if (!p.loadout.includes(mn.id)) setLoadout(g, p, 0, mn.id);
    g.tick();
    for (let i = 0; i < 120 && ![...g.enemyPool].some(x => x.active); i++) g.tick();
    const e = [...g.enemyPool].find(x => x.active);
    if (!e) { bad('precedence: no live enemy in the fixture'); }
    else {
      // Stand the enemy inside the field so the pull genuinely holds it, and
      // make it unkillable for the duration. A dead enemy is recycled by the
      // pool and comes back with its taunt fields cleared, which reads exactly
      // like the field stealing a cast taunt — the first version of this check
      // reported precisely that, on correct code.
      e.x = p.x + 40; e.y = p.y;
      e.maxHp = 1e9; e.hp = 1e9;
      for (let i = 0; i < 60; i++) g.tick();
      const pulled = g.tauntTarget(e.x, e.y, e);
      if (pulled === p) ok('the pull holds an enemy inside the field');
      else bad(`the pull does not hold: tauntTarget returned ${pulled === p ? 'the player' : JSON.stringify(pulled && pulled.idx)}`);

      // Now a DELIBERATE taunt naming someone else, and it must SURVIVE the
      // field's own pulses rather than merely win the frame it was set on. The
      // failure this is aimed at is the aura writing `e.tauntT` — which does
      // not lose to a cast taunt, it OVERWRITES one, and would read as a pass
      // to any check that resolves before the next pulse.
      const other = { idx: 99, x: p.x + 600, y: p.y, gone: false, downed: false };
      const pulses = Math.ceil((mn.persist.aura.pulseMs / 1000) * 60) * 3;
      e.tauntT = 4; e.tauntBy = other; e.tauntIdx = 99;
      let stolen = null;
      for (let i = 0; i < pulses; i++) {
        e.x = p.x + 40; e.y = p.y; e.hp = e.maxHp;    // pinned and alive, or this measures a corpse
        g.tick();
        if (!e.active) break;                         // room ended; nothing left to steal it
        if (e.tauntBy !== other) { stolen = i; break; }
      }
      const aimed = g.tauntTarget(e.x, e.y, e);
      if (stolen === null && aimed === other) {
        ok(`a CAST TAUNT still wins over the pull across ${pulses} ticks (${(pulses / 60).toFixed(1)}s, ${(pulses / 60 / (mn.persist.aura.pulseMs / 1000)).toFixed(0)} pulses)`);
      } else if (stolen !== null) {
        bad(`the field OVERWROTE a cast taunt after ${stolen} tick(s) — writing e.tauntT promotes it to step 1 and silently beats every cast taunt in the game`);
      } else {
        bad(`a cast taunt was overridden by the pull: tauntTarget returned ${aimed === p ? 'the Marrownaut' : JSON.stringify(aimed)}`);
      }

      // And the field does not write the taunt clock at all, on an enemy that
      // holds no taunt. Pinned alive for the same reason.
      e.tauntT = 0; e.tauntBy = null;
      let wrote = 0;
      for (let i = 0; i < pulses; i++) {
        e.x = p.x + 40; e.y = p.y; e.hp = e.maxHp;
        g.tick();
        if (!e.active) break;
        if (e.tauntT > 0) { wrote = e.tauntT; break; }
      }
      if (!wrote) ok('the field never writes e.tauntT — it cannot masquerade as a cast taunt');
      else bad(`the field wrote e.tauntT ${wrote.toFixed(2)} — that promotes it to step 1 and overrides every cast taunt`);
    }
  }
}

// ---- 6. THE STATUE TEST, AS A CONTROLLED COMPARISON ----
//
// "A stationary Marrownaut kills nothing" is the wrong assertion and would fail
// for the wrong reason: a character always has SOMETHING — a weapon, a trait, a
// hazard standing in the room — and a bare fixture already produces a few kills
// with an empty bar. Asserting zero would be asserting that the rest of the
// game does not exist.
//
// What the ruling actually says is that the FIELD is a cost and not a source.
// So the measurement is a difference: the same seed, the same room, the same
// stationary character, once with the persistent node slotted and once with an
// empty bar. If the node contributes no damage the two readings are identical,
// and any drift is the field turning a pull into output.
{
  const mn = PERSISTENT.find(s => s.persist.aura);
  const run = (slot) => {
    const { g, p } = build(TREES[mn.tree].classId, chainTo(mn.id));
    p.loadout = new Array(8).fill(null);
    if (slot) p.loadout[0] = slot;
    for (let i = 0; i < 60 * 45; i++) { g.setInput(0, { mx: 0, my: 0 }); g.tick(); }
    return { kills: p.kills, dmg: Math.round(p.damageDealt) };
  };
  const bare = run(null), held = run(mn.id);
  if (bare.kills === held.kills && bare.dmg === held.dmg) {
    ok(`statue test: 45 s stationary, ${mn.id} slotted vs an empty bar — identical (${held.kills} kills, ${held.dmg} dmg), so the field adds no output`);
  } else {
    bad(`statue test: slotting ${mn.id} changed a stationary character's output — empty bar ${bare.kills}/${bare.dmg}, slotted ${held.kills}/${held.dmg}`);
  }
  if (VERBOSE) console.log(`      baseline is the character's own weapon/trait, not the field`);
}

// ---- ONE FORM AT A TIME, ENFORCED AT THE BAR ----
//
// Slotting a second form used to overwrite in silence: `enterPersistent` guards
// on `p.form !== q.form`, so whichever the loadout iteration reached last won,
// and the loser's teardown never ran because `exitPersistent` guards on
// `p.form === q.form`. The player kept a slot that did nothing.
//
// The rule is measured on DISTINCT FORM NAMES rather than on slot count, and
// the three checks below are the three readings that matters: two different
// forms refused, the same form twice allowed (it is inert), and a swap in one
// edit accepted — a player changing specialisation should not have to unslot
// first.
{
  const forms = PERSISTENT.filter(s => s.persist && s.persist.form);
  const byClass = new Map();
  for (const f of forms) {
    const c = TREES[f.tree].classId;
    byClass.set(c, [...(byClass.get(c) || []), f]);
  }
  const pair = [...byClass.values()].find(v => v.length >= 2);
  if (!pair) {
    console.log('  — only one class has two forms to test the rule with; skipped');
  } else {
    const [A, B] = pair;
    const deepest = A.tier > B.tier ? A : B;
    // LEARN BOTH CHAINS. The two forms used to share a tree; since the tank
    // restructure they anchor different ones, so learning only the deeper
    // form's chain left the other unlearned — and `setLoadout` refused it as
    // "not a learned active", which reads as the one-form rule firing on the
    // FIRST form rather than as a fixture that never taught it.
    const learn = [...new Set([...chainTo(A.id), ...chainTo(B.id)])];
    const { g, p } = build(TREES[deepest.tree].classId, learn);
    g.cleared = true;
    const dmgId = Object.values(SKILL_BY_ID).find(x => x.type === 'active' && !x.persist
      && p.skillRanks[x.id] > 0 && (x.compose || []).some(c => c.damage > 0));
    p.loadout = new Array(8).fill(null);
    if (dmgId) setLoadout(g, p, 0, dmgId.id);

    const first = setLoadout(g, p, 1, A.id);
    if (first.ok) ok(`one form: ${A.id} slots cleanly on its own`);
    else bad(`one form: the FIRST form was refused — ${first.reason}`);

    const second = setLoadout(g, p, 2, B.id);
    if (!second.ok && /one form/i.test(second.reason || '')) {
      ok(`one form: a SECOND, different form is refused — "${second.reason}"`);
    } else bad(`one form: two different forms were accepted (${JSON.stringify(second)}) — the bar allows a state the engine cannot hold`);

    // The same form twice is inert, not an error: the door reads
    // `loadout.includes(id)`, so a second copy adds nothing and removing one
    // leaves the form standing. Refusing it here would be a rule about
    // duplicates, which is a different question.
    const twice = setLoadout(g, p, 3, A.id);
    if (twice.ok) ok('one form: the SAME form in two slots is allowed — inert, and a duplicate rule is a separate question');
    else bad(`one form: a duplicate of the same form was refused (${twice.reason}) — that is a duplicate rule, not this one`);

    // And the swap: B into the slot A occupies. One edit, no un-slot first.
    setLoadout(g, p, 3, null);
    const swap = setLoadout(g, p, 1, B.id);
    if (swap.ok && p.form === B.persist.form) {
      ok(`one form: swapping ${A.id} for ${B.id} in its own slot is ACCEPTED and the form actually changes — p.form is "${p.form}"`);
    } else bad(`one form: the swap failed — ${JSON.stringify(swap)}, p.form is ${JSON.stringify(p.form)}`);
  }
}

// ---- A FORM BOOSTS ONLY ITS OWN TREE ----
//
// Ruled 2026-09-10. `engineScale` returns 1 for a `scaleWith: 'form'` step whose
// owning skill sits outside the held form's tree. A form declaring no tree
// scopes nothing and behaves as it always did, which is what keeps Marrownaut
// and any future class-wide form working with no special case.
//
// THE THIRD CHECK IS THE ONE THAT MATTERS RIGHT NOW. All three crystal forms
// still live in smith_crystal, so every form-scaled Anvil node is at x1.00
// until the layout moves a form into that tree. That is the ruling meeting
// content the restructure has not reached yet, not a defect — and it is written
// down here so the redistribution can be checked against it rather than
// discovered in play.
{
  const scoped = PERSISTENT.filter(s => s.persist && s.persist.form && s.persist.tree);
  if (!scoped.length) console.log('  — no form declares a tree; scoping untested');
  else {
    const f = scoped[0];
    const inTree = [], outTree = [];
    for (const t of Object.values(TREES)) {
      if (TREES[f.tree].classId !== t.classId) continue;
      for (const sk of t.skills) for (const st of (sk.compose || [])) {
        if (st.scaleWith !== 'form') continue;
        (sk.tree === f.persist.tree ? inTree : outTree).push({ sk, st });
      }
    }
    const held = { engines: { form: CFG.FORM_POWER }, formTree: f.persist.tree };
    const free = { engines: { form: CFG.FORM_POWER }, formTree: null };

    const insideOk = inTree.every(({ sk, st }) => engineScale(st, held, sk) > 1);
    if (inTree.length && insideOk) ok(`tree-scoped form: all ${inTree.length} form-scaled skill(s) INSIDE ${f.persist.tree} still scale while ${f.persist.form} is held`);
    else if (!inTree.length) bad(`tree-scoped form: ${f.persist.tree} holds no form-scaled skill at all — the form pays nothing`);
    else bad('tree-scoped form: a skill inside the form\'s own tree lost its boost');

    const outsideOff = outTree.every(({ sk, st }) => engineScale(st, held, sk) === 1);
    if (outsideOff) ok(`tree-scoped form: all ${outTree.length} form-scaled skill(s) OUTSIDE it are at x1.00 — the boost does not reach another tree`);
    else bad('tree-scoped form: a skill outside the form\'s tree still takes the boost — the scope is not holding');

    const unscopedStillWorks = outTree.every(({ sk, st }) => engineScale(st, free, sk) > 1);
    if (!outTree.length || unscopedStillWorks) ok('tree-scoped form: a form declaring NO tree still boosts class-wide — Marrownaut and any future class-wide form are unaffected');
    else bad('tree-scoped form: an unscoped form stopped boosting — scoping leaked into the default');

    if (outTree.length) {
      console.log(`      ${outTree.length} form-scaled node(s) are at x1.00 today because all three forms sit in smith_crystal: `
        + `${[...new Set(outTree.map(x => x.sk.id))].join(', ')}`);
    }
  }
}

// ---- THE BLACKSMITH'S THREE THREAT TOOLS ----
//
// A tank that cannot pull is a durable damage dealer. These three exist to make
// enemies attack the Blacksmith instead of somebody squishier, and the thing
// that keeps them honest is that NONE OF THEM DEALS DAMAGE — the statue test.
// A stationary Blacksmith with the whole room walking at it must clear none of
// it, which is exactly what kept Marrownaut's permanent aggro field legal.
{
  const TOOLS = ['smith_din', 'smith_long_tongs', 'smith_call_the_room'];
  const found = TOOLS.map(id => SKILL_BY_ID[id]).filter(Boolean);
  if (found.length !== TOOLS.length) {
    bad(`threat tools: expected ${TOOLS.length}, found ${found.length} — ${TOOLS.filter(id => !SKILL_BY_ID[id]).join(', ')} missing`);
  } else {
    // 1. every one of them is a taunt and none of them is damage
    const damaging = found.filter(s => (s.compose || []).some(c => (c.damage || 0) > 0));
    if (!damaging.length) ok(`threat tools: all ${found.length} deal ZERO damage — the statue test holds`);
    else bad(`threat tools: ${damaging.map(s => s.id).join(', ')} deal damage — a threat tool that kills is a damage skill wearing a taunt`);

    const taunts = found.filter(s => (s.compose || []).some(c => c.riders && c.riders.taunt)
      || (s.persist && s.persist.aura && s.persist.aura.taunt));
    if (taunts.length === found.length) ok('threat tools: all three actually carry a taunt');
    else bad(`threat tools: ${found.filter(s => !taunts.includes(s)).map(s => s.id).join(', ')} carry no taunt at all`);

    // 2. the pull reads the SHARED constant, not a number of its own
    const din = SKILL_BY_ID['smith_din'];
    if (din.persist.aura.radius === TANK_PULL.radius && din.persist.aura.pulseMs === TANK_PULL.pulseMs) {
      ok(`the pull reads CONFIG.TANK_PULL (r${TANK_PULL.radius}, ${TANK_PULL.pulseMs}ms) — the same constant Marrownaut reads, so no class picks its own tank radius`);
    } else bad(`smith_din does not read TANK_PULL: r${din.persist.aura.radius} vs ${TANK_PULL.radius}`);

    const mn = SKILL_BY_ID['necro_marrownaut'];
    if (mn && mn.persist.aura.radius === TANK_PULL.radius) ok('and Marrownaut reads it too — one number, two tanks');
    else bad(`Marrownaut is at r${mn && mn.persist.aura.radius}, TANK_PULL is r${TANK_PULL.radius} — the constant is not shared after all`);

    // 3. the re-grab is the long-cooldown one
    const reach = SKILL_BY_ID['smith_long_tongs'], room = SKILL_BY_ID['smith_call_the_room'];
    if (room.cooldown > reach.cooldown) ok(`the emergency re-grab sits on a longer cooldown than the reach taunt (${room.cooldown}ms vs ${reach.cooldown}ms) — one is the steady state, the other is losing a lane`);
    else bad(`re-grab cooldown ${room.cooldown}ms is not longer than the reach taunt's ${reach.cooldown}ms`);

    // 4. AND THE PULL ACTUALLY PULLS, through tauntTarget rather than by reading
    // the declaration back. A field that is declared and resolves to nothing is
    // the shape this whole gate exists to catch.
    const { g, p } = build('toh_blacksmith', chainTo('smith_din'));
    g.cleared = true;
    const dmg = Object.values(SKILL_BY_ID).find(x => x.tree === 'smith_forge' && x.type === 'active'
      && !x.persist && p.skillRanks[x.id] > 0 && (x.compose || []).some(c => c.damage > 0));
    p.loadout = new Array(8).fill(null);
    if (dmg) setLoadout(g, p, 0, dmg.id);
    const before = g.tauntTarget(p.x + 40, p.y);
    setLoadout(g, p, 1, 'smith_din');
    g.tick();
    const z = g.zones.find(q => q.follow === p.idx && q.auraKey === 'smith_din');
    if (z && z.dps === 0 && z.r === TANK_PULL.radius) ok(`the pull field is up at r${z.r} with dps ${z.dps} — a real zone, and an unarmed one`);
    else bad(`the pull field is wrong or absent: ${z ? `r ${z.r} dps ${z.dps}` : 'none'}`);
    const after = g.tauntTarget(p.x + 40, p.y);
    if (after === p) ok('and an enemy inside it resolves onto the Blacksmith through tauntTarget()');
    else bad(`tauntTarget did not resolve onto the Blacksmith: before ${before && before.name}, after ${after && after.name}`);
  }
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
if (!fails) console.log('A PERSISTENT ACTIVE HOLDS WHILE SLOTTED, AND ONLY WHILE SLOTTED');
process.exit(fails ? 1 : 0);
