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
    if (p.boonOffer) sim.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  }
  // novaDamage is the trait's, not the tree's — same subtraction measureDps makes.
  const dps = (p.damageDealt - (p.novaDamage || 0)) / SECONDS;
  return { treeId, classId: tree.classId, dps, actives: actives.length, slotted: Math.min(actives.length, slots), plan };
}

// ---------------------------------------------------------------- run
console.log(`PER-TREE DPS — level ${LEVEL}, ${slotsAtLevel(LEVEL)} slots pinned to the tree, ${SECONDS}s window\n`);

const byClass = new Map();
for (const [classId, treeIds] of Object.entries(TREES_BY_CLASS)) {
  const rows = treeIds.map(measureTree).filter(Boolean);
  if (rows.length) byClass.set(classId, rows);
}

let unstaged = 0;
for (const [classId, rows] of byClass) {
  const vals = rows.map(r => r.dps).sort((a, b) => a - b);
  const med = vals[Math.floor(vals.length / 2)];
  console.log(`${classId.replace('toh_', '')}  (${rows.length} trees, class median ${med.toFixed(1)})`);
  for (const r of rows) {
    const dev = med > 0 ? (r.dps - med) / med : 0;
    const tag = `${r.treeId} ${r.dps.toFixed(1).padStart(8)}  ${(dev >= 0 ? '+' : '') + (dev * 100).toFixed(0)}%  ${r.slotted}/${r.actives} actives slotted`;
    if (VERBOSE && r.plan.staged.length) console.log(`      staged: ${r.plan.staged.join(', ')}`);
    for (const u of r.plan.unstageable) { unstaged++; console.log(`      NOT STAGED — ${u}`); }
    // A tree measuring zero is never "in band", however wide the band: it means
    // the tree's actives did nothing, and the unstaged list above says whether
    // that is the tree's fault or the fixture's.
    if (!(r.dps > 0)) bad(`${tag}  — ZERO. ${r.plan.unstageable.length ? 'see NOT STAGED above' : 'its actives fired and dealt nothing'}`);
    else if (med > 0 && Math.abs(dev) > BAND) bad(`${tag}  — outside ±${(BAND * 100).toFixed(0)}% of its own class`);
    else ok(tag);
  }
  console.log('');
}

if (unstaged) {
  console.log(`${unstaged} trigger condition(s) this fixture cannot arrange. A tree carrying one is measured`);
  console.log(`on its remaining actives only, and the reading is a FLOOR rather than the tree's output.\n`);
}
console.log(`${checks} check(s), ${fails} failure(s)`);
process.exit(fails ? 1 : 0);
