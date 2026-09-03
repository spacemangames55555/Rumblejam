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
import { SKILL_BY_ID, TREES } from '../js/skills.js';
import { spendSkillPoint, setLoadout, applyPersistents } from '../js/skillsim.js';
import { PERSIST_T } from '../js/config.js';

const VERBOSE = process.argv.includes('--verbose');
let checks = 0, fails = 0;
const ok = m => { checks++; console.log(`✓ ${m}`); };
const bad = m => { checks++; fails++; console.log(`✗ ${m}`); };

// Derived: every persistent active in the game, so a second one is measured
// without editing this.
const PERSISTENT = Object.values(SKILL_BY_ID).filter(s => s.persist);

function build(charId, learn, level = 20) {
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

console.log(`\n${checks} check(s), ${fails} failure(s)`);
if (!fails) console.log('A PERSISTENT ACTIVE HOLDS WHILE SLOTTED, AND ONLY WHILE SLOTTED');
process.exit(fails ? 1 : 0);
