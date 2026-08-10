// ENGINE SCALING, DERIVED — what one point of an engine is worth, computed
// from what that engine publishes rather than chosen per tree.
//
// THE DEFECT THIS REPLACES. A compose step used to declare `scalePer` directly:
// a per-point multiplier, in units of "fraction of base damage per engine
// point". That number is only meaningful against the engine's ceiling, and the
// ceilings are three orders of magnitude apart — `form` publishes 1, `chi`
// publishes 45. Nine third trees were authored with a flat `scalePer: 0.05`
// copied between them, which is +5% on `form` and **+225% on `chi`**. The
// per-tree DPS gate measured the Monk's Empty Hand at ×4.64 engine scaling
// against its own class's ×1.52–1.66, and 625 DPS against a class median of 60.
//
// The older trees were never following a `0.05` convention. Read against their
// engines' ceilings they agree closely: rhythm +40%, crystal +40%, killbox
// +36%, chi +54%, form +24%, doll +60% — every one of them an author who did
// the arithmetic. §13 rule 60 exactly: the convention that was actually being
// followed was invisible, so what got copied was the *number*, which was the
// one part of it that does not travel between engines.
//
// SO THE NUMBER IS GONE. A step declares which engine it rides and, optionally,
// how heavily relative to that engine's standard — a DIMENSIONLESS weight whose
// default is 1. Copying `1` from a chi tree to a form tree is correct, which is
// the property `scalePer` could never have. `scalePer` is now rejected at load
// rather than merely audited: the error is unmakeable, not detectable.
//
//   { kind: 'strike', damage: 11, scaleWith: 'chi' }                  standard
//   { kind: 'strike', damage: 11, scaleWith: 'chi', scaleWeight: 1.25 }  heavier
//
// TWO NUMBERS PER ENGINE, AND THEY MEAN DIFFERENT THINGS.
//
//   `max`  — what the engine publishes when it is full. For eight engines this
//            is an enforced ceiling and `hard: true`; for six there is no cap in
//            the code at all and the number is a DESIGN REFERENCE — the value
//            the engine is intended to reach in a hard room. A reference maximum
//            is still a published number, and a tree scaling on `cascade` needs
//            one just as much; what it is not is a guarantee, and `hard: false`
//            says so rather than letting a reader assume a clamp exists.
//   `contribution` — how much of a skill's damage that full engine is worth.
//            `+54%` means a Monk at 45 Chi deals 1.54× what the tuning block
//            says. This is the design decision; `scalePer` is its consequence.
//
// The initial contributions are the median of what the older trees' authors had
// already converged on for each engine, so landing this re-scales nothing that
// was authored with the arithmetic done — the nine that copied a number are the
// only content it moves. From here the contribution is the published figure and
// the per-point value is nobody's decision.
import { CONFIG } from './config.js';

// `max` sources are named because a table that drifts from its engine is worse
// than no table; `tools/engine_gate.mjs` asserts each one against the constant
// it quotes, so a cap changed in one place cannot leave this stale.
export const ENGINE_SCALE = {
  // ---- enforced ceilings ------------------------------------------------
  rhythm:  { max: 10, hard: true, contribution: 0.40, src: "bard trait maxStacks (characters-toh.js)" },
  doll:    { max: 10, hard: true, contribution: 0.60, src: "voodoo trait dollCap (characters-toh.js)" },
  crystal: { max: 10, hard: true, contribution: 0.40, src: "singularity trait crystalCap (characters-toh.js)" },
  killbox: { max: CONFIG.TRAP_CAP,   hard: true, contribution: 0.36, src: "CONFIG.TRAP_CAP" },
  spread:  { max: CONFIG.SPREAD_CAP, hard: true, contribution: 0.36, src: "CONFIG.SPREAD_CAP" },
  // The step is part of the ceiling: `chiPublished` returns 0 at zero Chi and
  // `min(CHI_CAP, chi) + CHI_FOCUS_STEP` above it, so a full pool publishes 45.
  chi:     { max: CONFIG.CHI_CAP + CONFIG.CHI_FOCUS_STEP, hard: true, contribution: 0.54, src: "CONFIG.CHI_CAP + CONFIG.CHI_FOCUS_STEP" },
  footing: { max: 10, hard: true, contribution: 0.90, src: "FOOTING_MAX_STACKS (samurai_armor.js)" },
  // Binary by ruling: in a form or not. A `max` of 1 is why a copied 0.05 was
  // worth +5% here and +225% on chi.
  form:    { max: CONFIG.FORM_POWER, hard: true, contribution: 0.24, src: "CONFIG.FORM_POWER" },

  // ---- design references, NOT enforced ----------------------------------
  // Nothing in the code clamps these. Each figure is what the engine is meant
  // to reach in a hard room, back-calculated from the scaling the older trees
  // were authored to; `cascade` in particular is uncapped on purpose (§8.3) and
  // a room that runs long will exceed it.
  cascade: { max: 18, hard: false, contribution: 0.50, src: "uncapped by §8.3 — reference is a long varied chain" },
  drench:  { max: 14, hard: false, contribution: 0.49, src: "12 per enemy, uncapped room-wide sum" },
  shift:   { max: 8,  hard: false, contribution: 0.48, src: "domainShifts per room, no clamp" },
  marks:   { max: 7,  hard: false, contribution: 0.49, src: "one per marked enemy, no clamp" },
  pack:    { max: 6,  hard: false, contribution: 0.48, src: "live minions; MINION_CAP_PER_PLAYER 64 is a runaway backstop, not a design cap" },
  armor:   { max: 25, hard: false, contribution: 0.50, src: "max(0, Grit); Grit has no ceiling" },
};

export const ENGINE_KEYS = Object.keys(ENGINE_SCALE);

// What one point of an engine is worth at the standard weight.
export function standardPer(engine) {
  const e = ENGINE_SCALE[engine];
  return e ? e.contribution / e.max : 0;
}

// What one point is worth for a specific step. `scaleWeight` is dimensionless
// and defaults to 1 — a step that says nothing gets the engine's standard,
// which is the answer that is right for every engine.
export function scalePerFor(step) {
  return standardPer(step.scaleWith) * (step.scaleWeight === undefined ? 1 : step.scaleWeight);
}

// A passive may raise what a point is WORTH (Held Edge does it for Footing).
// Same units problem, same fix: the passive declares a weight, not a per-point
// number, and this converts. The field is `<engine>ScaleWeight`; the old
// `<engine>DamageBonus` name is rejected at load precisely so an author cannot
// carry a per-point value across under a name that still reads.
export function passiveBonusPer(engine, weight) {
  return standardPer(engine) * (weight || 0);
}
