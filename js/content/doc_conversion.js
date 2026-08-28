// THE CONVERSION TABLES — doc vocabulary to engine vocabulary.
//
// The fourteen class conversion documents were authored against the source
// project and say things the engine has no word for. Marrow, the first tree
// converted from one, measured 3.8 decisions per node and needed judgment on
// seven of nine — but three of those seven were the SAME judgment made ten
// times, because the answer never varied and nothing wrote it down.
//
// This file writes them down. Each is the single place a document's word
// becomes an engine value, so the thirteen classes after the Necromancer are
// transcription against a table rather than thirteen design sessions. A rule
// with hand-kept exceptions is not a rule: if a document says something this
// file cannot express, that is a finding to report, not a value to inline at
// the call site.

// ---------------------------------------------------------------- 1. triggers
//
// NOT ONE DOCUMENT TRIGGER NAME IS A `TRIGGER_KINDS` VALUE. The documents were
// written before the eleven kinds existed and use descriptive names; every
// active node needs the translation, and the translation never varies.
//
// Each entry takes the parameters the document states and returns the trigger
// object the engine reads. Where a document name carries information the
// trigger cannot hold — `LOWEST_HP_ENEMY` and `DENSEST_CLUSTER` name a TARGET,
// not a moment — the entry says so and the information goes to `select`, which
// is where it belongs.
export const DOC_TRIGGER = {
  // "fires at the nearest enemy inside R"
  NEAREST_IN_RANGE:    ({ range })              => ({ kind: 'NEAREST', range }),
  // "fires when something comes within R" — a ring breach is proximity with a
  // count of one, which is the same predicate said twice.
  ENEMY_BREACHES_RING: ({ radius, count = 1 })  => ({ kind: 'PROXIMITY', radius, count }),
  // "fires when N or more are within R"
  CROWD_THRESHOLD:     ({ radius, count })      => ({ kind: 'PROXIMITY', radius, count }),
  // "fires when the caster drops below P%"
  SELF_HP_BELOW_X:     ({ pct })                => ({ kind: 'SELF_THRESHOLD', pct }),
  // "fires when the caster is hit"
  ON_DAMAGE_TAKEN:     ()                       => ({ kind: 'ON_HIT_TAKEN' }),
  // "fires at a target below P%"
  TARGET_HP_BELOW_X:   ({ pct, range })         => ({ kind: 'TARGET_THRESHOLD', pct, range }),
  // THREE NAMES THAT CARRY A CONDITION, AND THE CONDITION IS THE HALF THAT
  // MATTERS. The first version of this table read all three as "a selector
  // wearing a trigger's clothes" and mapped them to a plain `NEAREST` range
  // check, on the reasoning that they name WHICH enemy rather than WHEN. That
  // threw away the WHEN, and the whole Dark Matter tree became nine skills that
  // fire at anything within a few hundred pixels: a never-moving Necromancer
  // cleared 20 of 25 statue rooms, at BUILT damage and BUILT cooldowns, because
  // no number was the problem. Ruling 7's lesson arriving through the trigger
  // table instead of through an aura.
  //
  // So each keeps its condition, and `select` still carries the target half.
  // "the weakest thing in range" is a wounded target, which is the predicate
  // TARGET_THRESHOLD holds.
  LOWEST_HP_ENEMY:     ({ range, pct = 85 })    => ({ kind: 'TARGET_THRESHOLD', pct, range }),
  // "where the crowd is thickest" presupposes a crowd.
  DENSEST_CLUSTER:     ({ range, count = 3 })   => ({ kind: 'PROXIMITY', radius: range, count }),
  // "fires only at an enemy that does not already carry this effect" — the
  // engine has no such predicate, and the nearest one that is still a CONDITION
  // rather than a constant is a wounded target. The divergence is real and
  // reported: a skill written to spread a debuff will refresh it instead.
  TARGET_UNAFFECTED:   ({ range, pct = 95 })    => ({ kind: 'TARGET_THRESHOLD', pct, range }),
  // "COOLDOWN_READY, gated on being under cap" — the engine has no
  // unconditional trigger, and it should not: a skill that fires with nothing
  // to fight is a skill that fires into an empty room. The honest reading of
  // "whenever it is ready" is "whenever there is something to be ready FOR",
  // which is proximity with a count of one. The cap gate is enforced by the
  // summon primitive's own `maxAlive`, not by the trigger.
  COOLDOWN_READY:      ({ radius = 260, count = 1 }) => ({ kind: 'PROXIMITY', radius, count }),
  // "always-on (no trigger; occupies a slot)" — a passive, which is the shape
  // of a node that has no moment because it is simply true.
  ALWAYS_ON:           ()                       => null,
};

export function docTrigger(name, args = {}) {
  const f = DOC_TRIGGER[name];
  if (!f) throw new Error(`no conversion for document trigger "${name}" — add it to DOC_TRIGGER rather than inlining it`);
  return f(args);
}

// ---------------------------------------------------------------- 2. ranks
//
// EVERY `RANK ADDS` LINE IS A FLAT ADDITION AND `ranks` IS A FRACTION OF THE
// BASE. "+4 damage" on a base of 26 is 0.1538, and the same "+4" against a
// different base is a different fraction — so this cannot be a constant and was
// being computed by hand once per node.
//
// `duration` defaults to the roster's standard increment because most documents
// state a damage rank and leave duration alone.
export const RANK_DURATION_DEFAULT = 0.03;

export function rankPer(damageAdd, damageBase, opts = {}) {
  const out = { duration: opts.duration ?? RANK_DURATION_DEFAULT };
  out.damage = damageBase > 0 ? +(damageAdd / damageBase).toFixed(4) : 0;
  if (opts.durationAdd !== undefined && opts.durationBase > 0) {
    out.duration = +(opts.durationAdd / opts.durationBase).toFixed(4);
  }
  return out;
}

// A rank that adds nothing to damage or duration — the document's "+8px radius
// per rank" shape. `ranks` has exactly two dials, so a third quantity has no
// home: the node keeps the standard rank and the growth is reported as
// unexpressible rather than folded into one of the two.
export const RANK_NONE = { damage: 0, duration: RANK_DURATION_DEFAULT };

// ---------------------------------------------------------------- 3. units
//
// THE DOCUMENTS SPEAK IN PERCENTAGES AND THE ENGINE IN THREE DIFFERENT UNITS.
// Marrow needed this twice with no policy and got two inconsistent answers.
// The policy, stated once:
//
//   A MULTIPLIER a rider already takes  -> pass the fraction the rider wants.
//     `slow x0.5` is `mult: 0.5`; `weaken 40%` is `mult: 0.6`, because these
//     riders multiply what is left rather than what is removed.
//   A PERCENTAGE OF A STAT the engine holds as POINTS -> there is no key, and
//     the value is NOT invented. Keep the magnitude the tree shipped with and
//     report the gap. `damageReduction +0.12` has no percentage key to land on.
//   A DURATION or a DISTANCE -> milliseconds and pixels, as written.
export const pctRemaining = pctRemoved => +(1 - pctRemoved / 100).toFixed(4);
export const pctToFraction = pct => +(pct / 100).toFixed(4);
