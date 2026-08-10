// PER-CLASS ENGINE TICKS — the registry, and the one module allowed to know a
// class by name.
//
// WHY THIS EXISTS. Eleven of the game's twelve engines are a PUBLISH LINE: one
// statement in `tickSkills` copying a number something else already produced
// into `p.engines`. Those cost nothing and belong where they are. A minority are
// ACCUMULATORS — they have their own state, their own accrual rate and their own
// decay, and none of that is a derivation of an existing field. Footing was the
// first; Chi is the second; §8.3's sort names cascade and Crystal Forms as the
// third and fourth.
//
// Footing was written as a function in `js/skillsim.js` with a hardcoded
// `treesFor(p).includes('samurai_armor')` guard and a hardcoded
// `import { TUNING as SAM } from './content/skills/samurai_armor.js'`. §16 has
// flagged that as the only per-class hardcode in shared code since phase 2, and
// the flag was right about the shape but understated the cost: the dependency
// runs BACKWARDS. Shared engine code importing a content file is the one arrow
// the whole architecture is built to avoid, and left alone it would have been
// drawn four times.
//
// So the accumulators move here and register themselves in a table, and
// `tickSkills` iterates the table knowing no class:
//
//     for (const e of ENGINE_TICKS) if (trees.includes(e.tree)) e.tick(sim, p, dt);
//
// That is the same shape as `PRIMITIVES`, `IMPACT_RIDERS` and `PASSIVE_EFFECT` —
// a table keyed by name, populated by data, iterated generically.
//
// WHERE THE NUMBERS LIVE IS NOT UNIFORM, DELIBERATELY. Footing's still live in
// the Armor tree's TUNING and are imported here, because every one of them is
// documented in place against the measurements that produced it and detaching a
// number from its rationale is worse than an import. Chi's live in CONFIG,
// beside the killbox's, because the engine ships and gates BEFORE the tree that
// spends it and its constants cannot live in a file that does not exist yet.
// The import that remains is legitimate in this module in a way it was not in
// `skillsim.js`: per-class accumulators are this file's declared subject, so the
// arrow points at what the module is for rather than out of shared code.
//
// AND THE TABLE IS GATEABLE, which the hardcode was not. Every registration
// names the engine key it writes, so `engine_gate` can assert that each
// registered tick is reached by the live path and moves its own key — the same
// coverage/reached/effect shape as `trait_gate`. A tick written and never called
// returns a silent 1.0 through `engineScale`; that is the exact failure mode
// §8.3 says this group is prone to, and a registry is what makes it visible.

import { CONFIG } from './config.js';
import { TREES_BY_CLASS } from './skills.js';
import { TUNING as SAM } from './content/skills/samurai_armor.js';

// ---------------------------------------------------------------- footing

// FOOTING. One stack per half-second stationary. Movement inside the grace
// window (footingGraceMs) holds the stance without growing it; movement past it
// drops the whole stack at once. No gradual decay — a falloff would let the
// Samurai drift and keep most of the payoff, which erases the decision.
//
// `passives` and `recompute` arrive as arguments rather than as imports: this
// module must not import `skillsim.js`, which imports it. The two functions it
// needs are `passiveSum` and `sim._recomputeStats`, and both are handed in.
function tickFooting(sim, p, dt, passives) {
  // THE GRACE BUDGET. Movement time accumulates here and decays while standing
  // still; the stance drops when the budget is spent, not the moment a key goes
  // down. See footingGraceMs in the Armor tree's TUNING for why.
  const grace = SAM.footingGraceMs / 1000;
  if (p.moving) p.footingMove = (p.footingMove || 0) + dt;
  else p.footingMove = Math.max(0, (p.footingMove || 0) - dt * SAM.footingGraceRefill);

  if (p.moving) {
    // Inside the window: the stance HOLDS but does not grow. A sidestep out of
    // a committed zone keeps what you had; it does not pay you for moving.
    if (p.footingMove < grace) { p.footingAcc = 0; return; }
    // Past the window: the whole stack, at once. No partial falloff — a
    // gradual decay would let the Samurai drift across a room and keep most of
    // the payoff, which erases the decision. The absorb pool goes with it.
    //
    // WHY THE WINDOW EXISTS. Before it, criterion 13 at 50% telegraph density
    // put the holder at x0.37-x0.40 damage taken against a correct sidestepper,
    // and that ratio did not move for any dial tried. The insensitivity was the
    // evidence: it was never the size of a stack, it was that a 200ms sidestep
    // cost the entire stance and the rebuild is slower than the next commit
    // arrives, so a bot that dodged correctly lived permanently at 0-3 stacks
    // and never had a stance to make a decision about.
    if (p.engines.footing) { p.engines.footing = 0; p.footingShield = 0; sim._recomputeStats(p); }
    p.footingAcc = 0;
    return;
  }
  // THE CAP IS THE ENGINE'S, AND NOTHING RAISES IT. This read
  // `SAM.footingMaxStacks + passiveSum(p, 'footingMaxBonus')`, so Set Stance's
  // rankable +1 pushed a designed ten to a measured seventeen and inflated
  // every per-stack term with it. `footingMaxBonus` is deliberately not summed
  // here any more: if a future skill declares one it does nothing, which is the
  // correct outcome for a passive trying to raise a hard cap.
  const maxStacks = SAM.FOOTING_MAX_STACKS;
  const rate = 1 + passives(p, 'footingAccrualPct');
  p.footingAcc += dt * rate;
  const per = SAM.footingTickMs / 1000;
  while (p.footingAcc >= per && p.engines.footing < maxStacks) {
    p.footingAcc -= per;
    p.engines.footing++;
    p.footingShield = footingShieldFor(p, passives);
    sim._recomputeStats(p);
  }
  if (p.engines.footing >= maxStacks) p.footingAcc = 0;
}

// The pool itself. It reuses the shield mechanism — same absorb-then-carry path
// in hurtPlayer — but lives in its own field rather than in p.shield, because
// breaking stance must drop exactly the Footing part and not eat an Iron Sleeve
// proc that happens to be running. Recomputed whenever the stack changes, so it
// tracks the stack exactly in both directions.
export function footingShieldFor(p) {
  const f = (p.engines && p.engines.footing) || 0;
  return f * SAM.footingShieldPerStack;
}

// Footing's contribution to the stat sheet.
//
// NOT vitality. Footing used to grant max HP per stack, which meant breaking
// stance lowered max Vitality and CLAMPED current HP down with it: a Samurai
// lost health for dodging, by an amount unrelated to the attack, and the loss
// landed hardest exactly when they did the thing the mechanic exists to reward.
// The stack carries the absorb pool above instead, which costs the same to break
// and takes nothing the player already had.
//
// NO REFLEX either — see the note in the Armor tree's TUNING. The Samurai has
// surrendered the ability to dodge anything telegraphed; paying him dodge chance
// for standing still was the opposite of that, and most of why holding beat
// dodging on both axes.
function footingStats(p, passives) {
  const f = (p.engines && p.engines.footing) || 0;
  return { grit: f * (SAM.footingGritPerStack + passives(p, 'footingGritBonus')) };
}

// ---------------------------------------------------------------- chi

// CHI. The second accumulator, and the first engine that runs in TWO
// DIRECTIONS: damage skills put Chi in, heals and traps take it out. Every
// engine before it only accumulates — footing, marks, drench, crystal and the
// rest all move one way and are reset by a door or a mistake, never by the
// player choosing to spend them.
//
// THE TICK ITSELF IS ONLY THE DECAY. Chi is filled in `skillDamage` (dealing
// damage) and spent in `runTriggerTick` (a skill declaring a `chi` cost), so
// what is left for a per-frame tick is the leak: Chi bleeds away out of combat,
// which is what stops a Monk banking a full pool in a corridor and arriving at
// the next fight with the whole engine already paid for. It decays only when the
// Monk has not dealt damage recently, so the leak never fights the loop while
// the loop is running.
//
// AND THE PUBLISHED VALUE IS NOT THE RESOURCE. `p.chi` is what a skill spends.
// `p.engines.chi` is what `scaleWith: 'chi'` reads, and it carries the STEP that
// makes zero Chi a cliff rather than a slope — see the ruling in §8.3. Deriving
// it here rather than in a publish line keeps the two numbers in one place, the
// same way the Witch Doctor's doll derives its published value from `voodooDmg`.
function tickChi(sim, p, dt) {
  const idle = sim.time - (p.chiLastGain ?? -999);
  if (idle >= CONFIG.CHI_IDLE_SECONDS && p.chi > 0) {
    p.chi = Math.max(0, p.chi - CONFIG.CHI_DECAY_PER_SEC * dt);
  }
  p.engines.chi = chiPublished(p);
}

// THE CLIFF, IN ONE PLACE. At zero Chi the engine publishes zero and every
// `scaleWith: 'chi'` step resolves at its authored base — which IS the winded
// number, because the tree is authored at the floor (§8.3). The first point of
// Chi is worth `chiFocusStep` extra points on top of itself, so crossing zero
// upward is a step and every point after it is a slope. Nothing anywhere
// multiplies a damage number by less than one.
export function chiPublished(p) {
  if (!(p.chi > 0)) return 0;
  return Math.min(CONFIG.CHI_CAP, p.chi) + CONFIG.CHI_FOCUS_STEP;
}

// Chi in, from dealing damage. Called from `skillDamage` — the one place the
// game knows a player's own skill connected — and capped, so a Monk cannot bank
// an unbounded pool against a boss and spend it for the rest of the floor.
export function gainChi(sim, p, dealt) {
  if (!(dealt > 0)) return;
  if (!TREES_BY_CLASS[p.charId] || !TREES_BY_CLASS[p.charId].includes('monk_chi')) return;
  const before = p.chi;
  p.chi = Math.min(CONFIG.CHI_CAP, p.chi + dealt * CONFIG.CHI_PER_DAMAGE);
  p.chiLastGain = sim.time;
  p.engines.chi = chiPublished(p);
  // THE CLIFF IS LEGIBLE, in both directions. A step this large that nothing
  // announces is a number the player is expected to infer from their own damage
  // output, which is exactly the kind of invisible state §13 rule 33 rejects.
  if (before <= 0 && p.chi > 0) sim.pushEvent({ k: 'toast', idx: p.idx, text: 'Centred' });
}

// Chi out. Returns false when the Monk cannot pay, and the CALLER declines to
// fire — see the ruling on conditional spending in §8.3.
export function spendChi(sim, p, cost) {
  if (!(cost > 0)) return true;
  if (p.chi < cost) return false;
  p.chi -= cost;
  p.engines.chi = chiPublished(p);
  if (p.chi <= 0) {
    p.chi = 0;
    p.engines.chi = 0;
    sim.pushEvent({ k: 'toast', idx: p.idx, text: 'Winded' });
  }
  return true;
}

export function chiCostOf(sk) { return sk && sk.chi ? sk.chi : 0; }

// ---------------------------------------------------------------- cascade

// CASCADE. The third accumulator, and the one whose specification did not
// survive contact with the combat model.
//
// §8.3 specified "an ordered 3-skill sequence". MEASURED, THAT CANNOT BE A
// DECISION IN THIS GAME. Nothing is manually cast, so fire order is decided by
// cooldown arithmetic and by which triggers happen to hold — and the fixture
// showed both ends of the range are useless: as authored, a deliberate A>B>C
// appears in 2% of windows, and with all three skills forced to identical
// cooldowns and identical always-holding triggers it appears in 100% of them,
// perfectly, forever, because `runTriggerTick` walks the loadout ARRAY IN INDEX
// ORDER. At that point the "sequence" is a for-loop and the player's only input
// was arranging three slots once, between rooms.
//
// So cascade counts VARIETY rather than ORDER. A fire by a skill other than the
// one before it banks a rank; the same skill twice running resets to zero. The
// full ruling, and why this is the closest thing auto-triggered combat can
// actually express, is in §8.3.
//
// AND IT HAS ITS OWN MEMORY. `p.trigEvents.lastFired` already holds exactly the
// id this needs — and its only readers are the debug overlay and four test
// harnesses. Reading it here would make a diagnostic load-bearing, which is how
// `sim.summons` became D-29; `p.cascadeLast` is one field and owes nothing to an
// instrument.
function tickCascade(sim, p, dt) {
  const idle = sim.time - (p.cascadeLastT ?? -999);
  if (idle >= CONFIG.CASCADE_IDLE_SECONDS && p.cascade > 0) {
    p.cascade = Math.max(0, p.cascade - CONFIG.CASCADE_DECAY_PER_SEC * dt);
    if (p.cascade === 0) p.cascadeLast = null;
  }
  p.engines.cascade = Math.floor(p.cascade);
}

// Called on every fire, before the cooldown is written — so the cast that
// extends the chain is itself shortened by the extension. That ordering is
// deliberate and it is also where the engine's BUILT-IN COST comes from: a
// deeper cascade shortens the fastest skill most, so the fastest skill comes
// back soonest, so it is likelier to be the one that fires twice running and
// breaks the chain. The engine makes its own maintenance harder as it deepens.
export function cascadeAdvance(sim, p, skillId) {
  if (!hasEngineTree(p, 'sav_primal_fury')) return;
  if (p.cascadeLast === skillId) {
    // THE BREAK IS TOTAL, like the Bard's rhythm and unlike a decay. A partial
    // loss would let a Savage spam its fastest skill and keep most of the chain,
    // which erases the decision the whole engine exists to create.
    if (p.cascade >= 1) sim.pushEvent({ k: 'toast', idx: p.idx, text: 'Cascade broken' });
    p.cascade = 0;
  } else if (p.cascadeLast !== null) {
    p.cascade += 1;                 // UNCAPPED, per §8.3
  }
  p.cascadeLast = skillId;
  p.cascadeLastT = sim.time;
  p.engines.cascade = Math.floor(p.cascade);
}

// §8.3's cooldown term, exactly as specified: each rank removes CASCADE_CD_RATE
// of the REMAINING REDUCIBLE cooldown — the part above the floor — so the
// reduction is asymptotic and approaches the floor without ever arriving.
//
// THIS IS THE ONE EXEMPTION FROM THE NO-COOLDOWN-REDUCTION RULE (§4.2, §9.2),
// and the asymptote is the entire reason it is safe. Ranks are banked by
// in-combat sequencing rather than by point investment, so there is no
// investment cost to price the reduction against; a linear 8%-of-base per rank
// would cross zero at rank 12.5 and hand out free infinite uptime. This one is
// still above half at rank 1000, which `engine_gate` asserts rather than trusts.
export function cascadeCooldown(p, sk) {
  const base = sk.cooldown;
  if (!p || !(p.cascade > 0) || !hasEngineTree(p, 'sav_primal_fury')) return base;
  const F = CONFIG.CASCADE_CD_FLOOR;
  return base * (F + (1 - F) * Math.pow(1 - CONFIG.CASCADE_CD_RATE, Math.floor(p.cascade)));
}

function hasEngineTree(p, tree) {
  const t = TREES_BY_CLASS[p.charId];
  return !!t && t.includes(tree);
}

// ---------------------------------------------------------------- forms

// CRYSTAL FORMS. The fourth accumulator, and the only one that is not an
// accumulator at all — it is a STATE with a clock, which is why the registry
// row carries both a tick and a `stats` function. The tick runs the clock and
// recomputes the sheet on expiry; the `stats` hook is what makes a form change
// what the player IS rather than only what their skills multiply by.
//
// That hook was built for Footing in the Monk patch and had exactly one user
// until now. A form is its second, and the shape it was generalised for.
function tickForm(sim, p, dt) {
  if (p.formT > 0) {
    p.formT -= dt;
    if (p.formT <= 0) {
      // ENDING A FORM IS A SHEET CHANGE, so it must recompute — a stat delta
      // removed from `formStats` and never recomputed would leave the bonus
      // standing on a player who is no longer in the form, which is the exact
      // silent-persistence failure `shift` and `crystal` each needed a door
      // reset to avoid.
      p.formT = 0; p.form = null; p.formStats = null;
      sim._recomputeStats(p);
      sim.pushEvent({ k: 'toast', idx: p.idx, text: 'The crystal dims' });
    }
  }
  // BINARY BY RULING (§8.3). A form is a state, not a pool: it reads the same
  // at one second remaining as at five, because it does not deplete — it ends.
  p.engines.form = p.form ? CONFIG.FORM_POWER : 0;
}

// The form's contribution to the stat sheet, through the same registry hook
// Footing uses. `formStats` arrives from the compose step, so WHAT a form does
// to the sheet is content rather than code — three forms cost three data blocks.
function formStats(p) {
  // Passed straight through. `_recomputeStats`'s `add()` applies any key that
  // exists on the sheet and ignores the rest, so WHAT a form does to a player is
  // a data block on the compose step — three forms cost three data blocks and no
  // code at all. This is the reason the `stats` hook was worth generalising in
  // the Monk patch rather than left as Footing's private arrangement.
  return p.formStats || {};
}

// A skill may declare `form: 'pyrite'` and then fires ONLY while that form
// holds. This is deliberately not a loadout change: §5.5 forbids those mid-fight,
// and a form that swapped slotted skills would be the trigger-swap item §9.2
// deleted, aimed at the player by their own class. The skill stays slotted and
// visible; what the form changes is whether its condition can hold — the same
// shape as the Monk's `chi` cost and `from: 'pet'`'s need for a live beast.
// `form: 'none'` — THE GAP BETWEEN FORMS, made expressible.
//
// This gate could only ever say "fires while Iron Pyrite holds". §8.3's forms
// enter on SELF_THRESHOLD, so the Blacksmith is strongest when hurt and hollow
// when healthy, and the interval between forms — cooldown up, health high, no
// state — was the one condition no skill could name. A tree about that gap
// could not be written, which is why smith_anvil needed this before it needed
// content.
//
// 'none' is deliberately a VALUE of the existing field rather than a new
// `noForm` flag: the question "which form does this need" now has an answer
// meaning "none of them, and that is the point", so one declaration covers both
// directions and one gate covers both readings. Asserted against FORM_NAMES at
// load, so a typo'd form name still fails rather than silently reading as this.
export const FORM_NONE = 'none';

export function formHolds(p, sk) {
  if (!sk || !sk.form) return true;
  if (sk.form === FORM_NONE) return !p.form;
  return p.form === sk.form;
}

// ---------------------------------------------------------------- the table

// One row per accumulator. `tree` is what gates it — an engine belongs to the
// tree that pays for it, not to the class, so a Monk who never spends a point in
// Chi never accrues any. `key` is the engine it writes, and it is here so
// `engine_gate` can assert the registry rather than trusting it.
export const ENGINE_TICKS = [
  { tree: 'samurai_armor', key: 'footing', tick: tickFooting, stats: footingStats },
  { tree: 'monk_chi', key: 'chi', tick: tickChi },
  { tree: 'sav_primal_fury', key: 'cascade', tick: tickCascade },
  { tree: 'smith_crystal', key: 'form', tick: tickForm, stats: formStats },
];

// The stat half of the same table. An accumulator that feeds the sheet declares
// a `stats` function; one that does not, does not. Chi does not — it is read by
// `scaleWith` and spent by skills, and a resource that also silently moved the
// stat sheet would be two engines wearing one name.
//
// This exists so `js/skillsim.js` imports NO content file: `engineStatBonus`
// used to read the Samurai's TUNING directly, which meant the registry would
// have moved the tick out and left the arrow pointing backwards anyway.
export function engineStats(p, passives) {
  const trees = TREES_BY_CLASS[p.charId] || [];
  const out = {};
  for (const e of ENGINE_TICKS) {
    if (!e.stats || !trees.includes(e.tree)) continue;
    const s = e.stats(p, passives) || {};
    for (const k in s) out[k] = (out[k] || 0) + s[k];
  }
  return out;
}

// Per-room reset for every registered accumulator that has one. Called from
// `startRoomMinions`, which is the one function the sim already runs at a door.
export function resetEnginesForRoom(p) {
  // CHI DOES NOT SURVIVE A DOOR, for the same reason crystal and the killbox do
  // not: a resource banked in the last fight is this fight's decision made for
  // free. The Monk arrives winded and has to earn its way back out, which is the
  // loop the class is built on, run once per room rather than once per run.
  p.chi = 0;
  p.chiLastGain = -999;
  // AND NEITHER DOES THE CASCADE. A chain is a property of a fight, and carrying
  // one through a door would mean arriving at the next room already at depth —
  // the Savage's whole loop is rebuilding it, once per room.
  p.cascade = 0;
  p.cascadeLast = null;
  p.cascadeLastT = -999;
  // AND NO FORM SURVIVES A DOOR EITHER. A transformation is a response to a
  // fight going badly, and carrying one into the next room would mean arriving
  // already transformed with the threshold that bought it long since healed past.
  p.form = null; p.formT = 0; p.formStats = null;
  if (p.engines) { p.engines.chi = 0; p.engines.cascade = 0; p.engines.form = 0; }
}

export function initEnginePlayer(p) {
  p.chi = 0;
  p.chiLastGain = -999;
  p.cascade = 0;
  p.cascadeLast = null;
  p.cascadeLastT = -999;
  p.form = null;
  p.formT = 0;
  p.formStats = null;
  p.footingAcc = 0;
  p.footingMove = 0;
  p.footingShield = 0;
}
