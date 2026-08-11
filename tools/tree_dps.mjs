// PER-TREE DPS — what one tree's own actives are worth, measured in isolation.
//
// THE BLIND SPOT THIS EXISTS FOR. `sim_test`'s `measureDps` levels a character
// to 12 and lets the auto-slotter fill the loadout from every tree the class
// owns. Level 12 is three slots (SLOT_LEVELS), and a class's two older trees
// reach them first, so **no third tree's actives have ever been measured — on
// any of the fourteen.** Every third tree authored so far was scored on its
// tier-2 passive alone, because a passive is always on and needs no slot. That
// is the crystal blind spot again in a different costume: a gate that passes
// while measuring a world the content does not live in (§13 rule 24).
//
// It is not a flaw in `measureDps`. That gate answers "is this CLASS in band",
// and a class is what a player at level 12 actually fields. This one answers a
// different question — "is this TREE in band" — and the two need different
// fixtures rather than one fixture stretched over both.
//
// THREE THINGS MAKE THE NUMBER READABLE.
//
// 1. LEVEL 60, NOT 12. Tier 10 unlocks at 60 (§8.1.1 TIER_LEVELS), so this is
//    the lowest level at which all ten nodes of a tree are learnable. Below it
//    the capstones are unmeasurable by construction.
//
// 2. SLOTS PINNED TO THE TREE. Seven slots at level 60, filled with that tree's
//    own actives in tier order and nothing else. A tree with fewer than seven
//    actives fields fewer, which is honest — that IS the tree.
//
// 3. THE BAND IS WITHIN-CLASS, NOT ACROSS THE ROSTER. A summon tree and a
//    strike tree are not comparable and never were; a roster median would be
//    §13 rule 28 again, an anchor derived from the population it measures. What
//    is comparable is a class's three trees against each other, because a
//    player picks among exactly those three and the class's own median is the
//    only thing "in band" can honestly mean here.
//
// AND THE STAGING ANSWERS DECLARATIONS RATHER THAN ASSUMING THEM (§13 rule 61).
// A tree whose actives fire on ON_DODGE, SELF_THRESHOLD or MOVEMENT produces
// zero in an unstaged run, and a zero that means "never triggered" reads
// identically to a zero that means "deals no damage". Every condition this
// fixture could not arrange is NAMED in the output, so an unstaged trigger is
// visible as a gap rather than hiding inside a low number.
//
// Usage: node tools/tree_dps.mjs [--verbose]
import { FixtureSim as Sim } from './fixture_sim.mjs';
import { TREES, TREES_BY_CLASS, slotsAtLevel } from '../js/skills.js';
import { CONFIG } from '../js/config.js';
import * as SKILLSIM from '../js/skillsim.js';

const VERBOSE = process.argv.includes('--verbose');
const LEVEL = 60;            // tier 10 unlocks here; every node learnable
const SECONDS = 30;          // long enough for a 9s capstone to come round thrice
const TICKS = SECONDS * 60;
// §13 rule 28: the band is the CLASS's own median, and it is wide because
// three trees of one class are allowed to be different — a utility tree that
// deals half what the class's damage tree deals is a design, not a defect. It
// is a gate against a tree that does effectively nothing or that doubles the
// class, which is the failure mode content authoring actually produces.
const BAND = 0.6;

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };

// ---------------------------------------------------------------- staging
//
// What a tree needs arranged for its own triggers to hold, read off the
// declarations. Returns a plan the tick loop applies, plus whatever it could
// not honour — a tree that wants to be both still and moving is a real finding
// about the tree, not something to silently resolve.
function stagingPlan(tree) {
  const plan = { walk: false, still: false, dodge: false, hurt: false,
                 hitTaken: false, kill: false, form: undefined, pet: false,
                 staged: [], unstageable: [] };
  const want = (k) => { if (!plan.staged.includes(k)) plan.staged.push(k); };

  for (const s of tree.skills) {
    // `form` is read as the VALUE it declares, never as "present therefore
    // enter one" — `form: 'none'` means the opposite of `form: 'pyrite'` and
    // staging it by shape inverts three skills (§13 rule 61).
    if (s.form !== undefined) {
      if (plan.form !== undefined && plan.form !== s.form) {
        plan.unstageable.push(`form: this tree declares both '${plan.form}' and '${s.form}' — one run cannot hold both`);
      } else {
        plan.form = s.form;
        want(s.form === 'none' ? 'out of form' : `in form '${s.form}'`);
      }
    }
    if (s.from === 'pet') { plan.pet = true; want('a beast on the field'); }

    const t = s.trigger;
    if (!t) continue;
    switch (t.kind) {
      case 'MOVEMENT':
        // mode is the declaration; 'still' is not a variant of 'moving'
        if (t.mode === 'still') { plan.still = true; want('standing still'); }
        else { plan.walk = true; want('walking'); }
        break;
      case 'ON_DODGE': plan.dodge = true; want('dodging'); break;
      case 'SELF_THRESHOLD': plan.hurt = Math.max(plan.hurt || 0, 0); plan.hurtPct = Math.min(plan.hurtPct ?? 100, t.pct); want('below the HP threshold'); break;
      case 'ON_HIT_TAKEN': plan.hitTaken = true; want('being hit'); break;
      case 'ON_KILL': plan.kill = true; want('kills landing'); break;
      // These hold on their own against a ring of live dummies — nothing to
      // arrange beyond the enemies this fixture already fields.
      case 'NEAREST': case 'PROXIMITY': case 'ISOLATED': case 'PASSIVE': break;
      case 'TARGET_THRESHOLD':
        plan.wounded = true; want('a wounded target'); break;
      case 'ON_STATUS':
        // applyPlague reads the source skill's domain, so the status has to be
        // applied BY something — a null source throws. Any node of this tree
        // carries the right domain for the class asking the question.
        plan.status = plan.status || s; want('a target under a status'); break;
      case 'ON_TOKEN':
        plan.unstageable.push(`ON_TOKEN (${s.id}): soul tokens need real kills, and this fixture's dummies are immortal`);
        break;
      default:
        plan.unstageable.push(`${t.kind} (${s.id}): no staging written for this trigger kind`);
    }
  }
  if (plan.walk && plan.still) {
    plan.unstageable.push('MOVEMENT: this tree wants both moving and still — the walking half is staged, the still half is not');
    plan.still = false;
  }
  return plan;
}

function measureTree(treeId) {
  const tree = TREES[treeId];
  const plan = stagingPlan(tree);
  const sim = new Sim({ seed: 4242, allowUnplayable: true,
    party: [{ idx: 0, key: 'k', name: 'T', charId: tree.classId, color: '#fff' }] });
  sim.god = true;
  const fight = sim.floor.nodes.find(n => n.kind === 'combat');
  fight.template = 'open_expanse';
  sim._travelTo(fight.id);
  sim.wave.done = true; sim.spawnQueue.length = 0;
  for (const e of [...sim.enemyPool]) sim.enemyPool.release(e);

  const p = sim.players[0];
  p.level = LEVEL;
  // Spend this tree and only this tree, in tier order so prereqs are satisfied.
  for (const sk of [...tree.skills].sort((a, b) => a.tier - b.tier)) {
    p.skillPoints++;
    if (!SKILLSIM.spendSkillPoint(sim, p, sk.id)) {
      bad(`${treeId}: could not learn ${sk.id} at level ${LEVEL} — the tree is unreachable, not slow`);
      p.skillPoints--;
    }
  }
  // PIN THE LOADOUT. The auto-slotter is what hides third trees; this replaces
  // it wholesale so the measurement is of the tree rather than of slot luck.
  const slots = slotsAtLevel(LEVEL);
  const actives = [...tree.skills].sort((a, b) => a.tier - b.tier)
    .filter(s => s.type === 'active').map(s => s.id);
  p.loadout = new Array(8).fill(null);
  actives.slice(0, slots).forEach((id, i) => { p.loadout[i] = id; });

  // The two engines a harness cannot fill by playing: the crystal trait's pool
  // is granted by the trait rather than earned, and a form has to be entered.
  if (p.char.trait.key === 'singularity') p.crystal = p.char.trait.crystalCap;
  if (plan.form !== undefined) {
    if (plan.form === 'none') {
      p.form = null; p.formT = 0; p.formStats = null;
      if (p.engines) p.engines.form = 0;
    } else {
      const src = Object.values(TREES).flatMap(t => t.skills)
        .find(x => (x.compose || []).some(c => c.kind === 'form' && c.form === plan.form));
      const step = src && src.compose.find(c => c.kind === 'form');
      p.form = plan.form; p.formT = 1e9; p.formStats = step ? step.stats || null : null;
      if (p.engines) p.engines.form = CONFIG.FORM_POWER;
      sim._recomputeStats(p);
    }
  }
  if (plan.pet) {
    const src = tree.skills.find(s => (s.compose || []).some(c => c.kind === 'summon'))
      || Object.values(TREES).flatMap(t => t.skills).find(x => x.classId === tree.classId && (x.compose || []).some(c => c.kind === 'summon'));
    const step = src && src.compose.find(c => c.kind === 'summon');
    if (step) SKILLSIM.spawnMinions ? SKILLSIM.spawnMinions(sim, p, src, step, 1) : null;
  }

  // A ring of immortal, motionless, harmless dummies. Immortal because a tree
  // that kills the room in ten seconds would otherwise measure its own kill
  // speed rather than its output; harmless because the fixture controls the HP
  // axis itself for SELF_THRESHOLD.
  const cx = sim.W / 2, cy = sim.H / 2;
  const dummies = [];
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const e = sim.spawnEnemyById('slabjaw', cx + Math.cos(a) * 95, cy + Math.sin(a) * 95, { noMats: true });
    if (!e) continue;
    e.spd = 0; e.dmg = 0;
    dummies.push({ e, x: e.x, y: e.y });
  }
  if (!dummies.length) { bad(`${treeId}: no dummies spawned — nothing was measured`); return null; }

  // ENGINE SUPPLY, WATCHED THROUGH THE RUN (§13 rule 29, content side).
  //
  // A `scaleWith` declaration is a READ. Nothing anywhere guarantees a WRITE,
  // and this cannot be checked at load: whether a tree's own play reaches its
  // engine is a property of the call graph and the room, not of the data. Two
  // shipped trees declared an engine they structurally could not supply and
  // every load assertion passed on both.
  //
  // So it is measured. The engine's peak over the whole window is recorded, and
  // a peak of zero means the declaration multiplied by exactly 1 for the entire
  // fight — a scaling clause that is decoration.
  const declared = new Set();
  for (const sk of tree.skills) for (const c of (sk.compose || [])) if (c.scaleWith) declared.add(c.scaleWith);
  const peak = {};
  for (const k of declared) peak[k] = 0;

  for (let i = 0; i < TICKS; i++) {
    // Hold every staged condition true for the whole window rather than once:
    // these are triggers on cooldowns from 1.1s to 9s, and a condition set on
    // tick 0 has stopped holding long before the capstone comes round.
    if (plan.walk) sim.setInput(0, { mx: (i % 2 ? 1 : -1), my: 0 });
    else { sim.setInput(0, { mx: 0, my: 0 }); if (plan.still) p.stillT = 99; }
    p.x = cx; p.y = cy;                      // walking without leaving the ring
    if (plan.dodge) p.trigEvents.dodgeT = sim.time;
    if (plan.hitTaken) p.trigEvents.hitTaken = 1;
    if (plan.kill) p.trigEvents.kill = 1;
    if (plan.hurtPct !== undefined) p.hp = Math.max(1, p.stats.vitality * (plan.hurtPct - 10) / 100);
    for (const d of dummies) {
      d.e.x = d.x; d.e.y = d.y; d.e.knockX = d.e.knockY = 0;
      d.e.maxHp = 2e9;
      // A wounded target for TARGET_THRESHOLD; full otherwise. Held rather
      // than set once, for the same reason as the conditions above.
      d.e.hp = plan.wounded ? 2e8 : 1e9;
    }
    if (plan.status) for (const d of dummies) if (!(d.e.plagueT > 0)) sim.applyPlague(d.e, 20, 5, p, plan.status);
    sim.tick();
    for (const k of declared) peak[k] = Math.max(peak[k], (p.engines && p.engines[k]) || 0);
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  }
  // novaDamage is the trait's, not the tree's — same subtraction measureDps makes.
  const dps = (p.damageDealt - (p.novaDamage || 0)) / SECONDS;
  return { treeId, classId: tree.classId, dps, actives: actives.length,
           slotted: Math.min(actives.length, slots), plan, peak, declared: [...declared] };
}

// One character with EVERY tree of its class spent and a broad loadout — the
// build a player actually reaches, rather than the pinned single tree the band
// needs. Staged loosely on purpose: this asks whether the engine can ever be
// non-zero, so a generous room is the right room.
function supplyRun(classId, keys, w) {
  const treeIds = TREES_BY_CLASS[classId] || [];
  const sim = new Sim({ seed: 4242, allowUnplayable: true,
    party: [{ idx: 0, key: 'k', name: 'S', charId: classId, color: '#fff' }] });
  sim.god = true;
  const fight = sim.floor.nodes.find(n => n.kind === 'combat');
  fight.template = 'open_expanse';
  sim._travelTo(fight.id);
  sim.wave.done = true; sim.spawnQueue.length = 0;
  for (const e of [...sim.enemyPool]) sim.enemyPool.release(e);
  const p = sim.players[0];
  p.level = LEVEL;
  const all = treeIds.flatMap(id => (TREES[id] || {}).skills || []).sort((a, b) => a.tier - b.tier);
  for (const sk of all) { p.skillPoints++; SKILLSIM.spendSkillPoint(sim, p, sk.id); }
  // Slot the class's actives across every tree, widest spread first, so no one
  // tree monopolises the loadout the way the auto-slotter does.
  const slots = slotsAtLevel(LEVEL);
  const acts = treeIds.flatMap(id => ((TREES[id] || {}).skills || []))
    .filter(s => s.type === 'active').sort((a, b) => a.tier - b.tier).map(s => s.id);
  p.loadout = new Array(8).fill(null);
  // WINDOW `w` OF THE CLASS'S ACTIVES, not the first seven. Seven slots against
  // ~28 actives means most of a class never fires, and the first version of
  // this pass reported the Necromancer as unable to produce `pack` and the
  // Hunter as unable to produce `spread` — both false, and both because the
  // summon that makes the minion was never slotted. §13 rule 17: a fixture
  // arriving unprovisioned is the fixture's bug. The caller sweeps every window
  // and takes the best, so a class is judged on what it CAN do rather than on
  // which seven skills happened to sort first.
  for (let i = 0; i < slots; i++) { const id = acts[(w * slots + i) % acts.length]; if (id) p.loadout[i] = id; }
  if (p.char.trait.key === 'singularity') p.crystal = p.char.trait.crystalCap;
  const cx = sim.W / 2, cy = sim.H / 2, dummies = [];
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6;
    const e = sim.spawnEnemyById('slabjaw', cx + Math.cos(a) * 110, cy + Math.sin(a) * 110, { noMats: true });
    if (e) { e.spd = 0; e.dmg = 0; dummies.push({ e, x: e.x, y: e.y }); }
  }
  const peak = {}; for (const k of keys) peak[k] = 0;
  for (let i = 0; i < TICKS; i++) {
    // Both halves of every either/or condition, alternating: a class that needs
    // to move for one engine and stand still for another gets both, because the
    // question is "can this ever be non-zero" rather than "is it now".
    const walking = Math.floor(i / 180) % 2 === 1;
    sim.setInput(0, walking ? { mx: (i % 2 ? 1 : -1), my: 0 } : { mx: 0, my: 0 });
    if (!walking) p.stillT = 99;
    // AND THE PLAYER CHANGES ENDS. `spread` is the DISTANCE between the Hunter
    // and its beast (SPREAD_UNIT 90 per step), and a fixture that pins the
    // player in one spot has the beast standing on them — so the engine reads 0
    // and the class looks unable to produce what it plainly produces. A pinned
    // player cannot stage a distance engine. The beast trails the jump, which
    // is the separation the engine exists to measure.
    const side = Math.floor(i / 200) % 2 ? 1 : -1;
    p.x = cx + side * 320; p.y = cy;
    p.trigEvents.dodgeT = sim.time; p.trigEvents.hitTaken = 1; p.trigEvents.kill = 1;
    if (i % 300 < 150) p.hp = Math.max(1, p.stats.vitality * 0.25); else p.hp = p.stats.vitality;
    // dummies ride with the player: this pass measures supply, and an engine
    // that needs a body in reach must always have one
    for (let j = 0; j < dummies.length; j++) {
      const a = j * Math.PI * 2 / dummies.length;
      const d = dummies[j];
      d.e.x = p.x + Math.cos(a) * 110; d.e.y = p.y + Math.sin(a) * 110;
      d.e.knockX = d.e.knockY = 0; d.e.hp = 5e8; d.e.maxHp = 1e9;
    }
    sim.tick();
    for (const k of keys) peak[k] = Math.max(peak[k], (p.engines && p.engines[k]) || 0);
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  }
  return peak;
}

// ---------------------------------------------------------------- run
console.log(`PER-TREE DPS — level ${LEVEL}, ${slotsAtLevel(LEVEL)} slots pinned to the tree, ${SECONDS}s window\n`);

const byClass = new Map();
for (const [classId, treeIds] of Object.entries(TREES_BY_CLASS)) {
  const rows = treeIds.map(measureTree).filter(Boolean);
  if (rows.length) byClass.set(classId, rows);
}

let unstaged = 0, starved = 0;
for (const [classId, rows] of byClass) {
  const vals = rows.map(r => r.dps).sort((a, b) => a - b);
  const med = vals[Math.floor(vals.length / 2)];
  console.log(`${classId.replace('toh_', '')}  (${rows.length} trees, class median ${med.toFixed(1)})`);
  for (const r of rows) {
    const dev = med > 0 ? (r.dps - med) / med : 0;
    const tag = `${r.treeId} ${r.dps.toFixed(1).padStart(8)}  ${(dev >= 0 ? '+' : '') + (dev * 100).toFixed(0)}%  ${r.slotted}/${r.actives} actives slotted`;
    if (VERBOSE && r.plan.staged.length) console.log(`      staged: ${r.plan.staged.join(', ')}`);
    for (const u of r.plan.unstageable) { unstaged++; console.log(`      NOT STAGED — ${u}`); }
    // Engine supply is NOT judged here — see the class pass below. In isolation
    // a tree that reads an engine its SIBLING supplies reads as starved, and
    // that is the probe's pinning rather than a defect: `asn_shadow` reads
    // `killbox` because the Assassin sets traps in Killbox, and a player owns
    // all three trees. Judging supply per tree flagged ten trees, of which most
    // were this. Reported as information only.
    // THE ENGINE, AS THE TREE'S OWN PLAY LEAVES IT. Printed always, not under
    // --verbose, because the class pass cannot see this one: an engine the
    // class supplies easily can still be ZERO at the moment these particular
    // skills fire. `samurai_agility` read `footing` while every trigger it owns
    // was MOVEMENT, and movement drops footing to zero in one step — full right
    // up until the instant the tree could use it. A zero here next to a healthy
    // class-level supply is that shape, and it is worth a human looking at.
    for (const k of r.declared) {
      const v = r.peak[k];
      console.log(`      ${k}: peak ${v.toFixed(2)} while this tree plays${v > 0 ? '' : '   <- ZERO: its own triggers may be emptying it'}`);
    }
    // A tree measuring zero is never "in band", however wide the band: it means
    // the tree's actives did nothing, and the unstaged list above says whether
    // that is the tree's fault or the fixture's.
    if (!(r.dps > 0)) bad(`${tag}  — ZERO. ${r.plan.unstageable.length ? 'see NOT STAGED above' : 'its actives fired and dealt nothing'}`);
    else if (med > 0 && Math.abs(dev) > BAND) bad(`${tag}  — outside ±${(BAND * 100).toFixed(0)}% of its own class`);
    else ok(tag);
  }
  console.log('');
}

// ---------------------------------------------------------------- supply
//
// CAN THE CLASS SUPPLY WHAT ITS TREES READ? (§13 rule 29, from the content side.)
//
// A `scaleWith` declaration is a READ. Nothing guarantees a WRITE, and this
// cannot be asked at load: whether a class's own play reaches its engine is a
// property of the call graph and the room, not of the data.
//
// THE UNIT IS THE CLASS, NOT THE TREE, and getting that wrong is instructive.
// Asked per tree — with the loadout pinned, as the band requires — ten trees
// looked starved, and most were reading an engine a SIBLING tree supplies:
// `asn_shadow` reads `killbox` because the Assassin's traps live in Killbox,
// `priest_grace` reads `marks` because the marks live in Judgment. A player
// owns all three trees and spreads freely (§8.1), so cross-tree supply is the
// design rather than a defect. Pinning is right for measuring output and wrong
// for measuring supply, and one fixture cannot answer both questions.
//
// What survives is the real thing: an engine NO tree of the class can produce.
console.log('ENGINE SUPPLY — every `scaleWith` a class declares, against what the whole class can produce\n');
for (const [classId, treeIds] of Object.entries(TREES_BY_CLASS)) {
  const want = new Map();          // engine -> trees that read it
  for (const id of treeIds) for (const sk of (TREES[id] || {}).skills || [])
    for (const c of (sk.compose || [])) if (c.scaleWith) (want.get(c.scaleWith) || want.set(c.scaleWith, []).get(c.scaleWith)).push(id);
  if (!want.size) continue;
  // Sweep every slot window and take the peak: the question is whether the
  // class can EVER produce the engine, so the best window is the answer.
  const nActs = treeIds.flatMap(id => ((TREES[id] || {}).skills || [])).filter(s => s.type === 'active').length;
  const windows = Math.max(1, Math.ceil(nActs / slotsAtLevel(LEVEL)));
  const peak = {};
  for (const k of want.keys()) peak[k] = 0;
  for (let w = 0; w < windows; w++) {
    const r = supplyRun(classId, [...want.keys()], w);
    for (const k of want.keys()) peak[k] = Math.max(peak[k], r[k]);
  }
  const short = [...want.keys()].filter(k => !(peak[k] > 0));
  if (!short.length) {
    ok(`${classId.replace('toh_', '').padEnd(13)} supplies all ${want.size}: ` +
       [...want.keys()].map(k => `${k} ${peak[k].toFixed(1)}`).join(', '));
  } else for (const k of short) {
    starved++;
    bad(`${classId.replace('toh_', '')} reads scaleWith: '${k}' in ${[...new Set(want.get(k))].join(', ')} and NOTHING the class owns produces it — `
      + `peak 0 with every tree of the class spent and slotted. The clause multiplies by exactly 1 forever (§13 rule 29)`);
  }
}
console.log('');

if (starved) {
  console.log(`${starved} tree(s) scale on an engine their own play never produces. That is not a tuning`);
  console.log(`error — the clause is inert, and the tree reads as scaling while it does not.\n`);
}
if (unstaged) {
  console.log(`${unstaged} trigger condition(s) this fixture cannot arrange. A tree carrying one is measured`);
  console.log(`on its remaining actives only, and the reading is a FLOOR rather than the tree's output.\n`);
}
console.log(`${checks} check(s), ${fails} failure(s)`);
process.exit(fails ? 1 : 0);
