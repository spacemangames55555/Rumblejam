// REGION POPULATIONS, AND THE TELEGRAPH-DENSITY RULE THEY MUST SATISFY.
//
// Every region's roster is registered here and checked at import. The rule is
// not a guideline: at the base roster's 21.4% telegraphing weight, roughly
// three quarters of incoming damage is undodgeable, and that settles the
// hold-or-break question arithmetically before any tuning enters it. Criterion
// 13 measured a holder beating a sidestepper on both axes in a pit that was
// 100% telegraphing — the real rooms are the thing that has never been measured
// at intended density, because intended density did not exist.
//
// THE RULE
//   1. Every HEAVY or ELITE archetype telegraphs. Heavies are the behaviours
//      that are supposed to be read rather than out-run: brute, warden, dasher.
//   2. The telegraphing share is at least MIN_TELEGRAPH_WEIGHT of the region's
//      population by encounter weight.
//   3. Chaff does NOT telegraph. Undodgeable contact damage is the other half
//      of the trade — it is what Footing's grit and vitality answer, and a
//      roster where everything commits collapses Footing into "always break".

import { PNW_ENEMIES, PNW_BOSS } from './enemies-pnw.js';
import { XIB_ENEMIES, XIB_BOSS } from './enemies-xibalba.js';
import { isDomain } from '../domains.js';

// Half the population, by encounter weight.
export const MIN_TELEGRAPH_WEIGHT = 0.5;

// The behaviours that must commit. A "heavy" is anything whose answer is
// positioning rather than kiting; if a new behaviour belongs in that set it
// goes here, and the assertion below then requires a telegraph for it.
export const HEAVY_BEHAVIORS = new Set(['brute', 'warden', 'dasher']);

export const REGION_ENEMIES = {
  pacific_northwest: { enemies: PNW_ENEMIES, boss: PNW_BOSS },
  central_america: { enemies: XIB_ENEMIES, boss: XIB_BOSS },
};

export const ALL_REGION_ENEMIES = Object.values(REGION_ENEMIES).flatMap(r => r.enemies);
export const ALL_REGION_BOSSES = Object.values(REGION_ENEMIES).map(r => r.boss);
export const REGION_ENEMY_BY_ID = Object.fromEntries(ALL_REGION_ENEMIES.map(e => [e.id, e]));
export const REGION_BOSS_BY_ID = Object.fromEntries(ALL_REGION_BOSSES.map(b => [b.id, b]));

// Telegraphing share of a population, by encounter weight. Exported so the
// gate and the report read the same number rather than two implementations.
export function telegraphWeight(enemies) {
  let total = 0, tel = 0;
  for (const e of enemies) { total += e.w; if (e.telegraph) tel += e.w; }
  return { total, tel, share: total ? tel / total : 0 };
}

const SHAPE_PARAMS = { circle: ['radius'], cone: ['angle', 'range'], line: ['width', 'length'] };

// WHAT EACH BEHAVIOUR NEEDS ON ITS DEF, read from what updateEnemy() actually
// dereferences. A missing block here is not a soft failure: `dasher` without a
// `dash` block throws `Cannot read properties of undefined (reading 'cd')` on
// the first tick that enemy exists — which is exactly what the first version of
// this file shipped, and it surfaced only when the pit spawned one. Content
// that cannot tick is content that does not exist, and it should say so at
// import rather than mid-fight.
export const BEHAVIOR_PARAMS = {
  chaser: [], sprinter: [], brute: [], splitter: [],
  // warden's aura is applied in sim.damageEnemy's shieldedBy scan, not in
  // updateEnemy — it walks and nothing else, so it needs no per-tick block.
  warden: [],
  spitter: ['keepDist', 'fireCd', 'proj'],
  orbiter: ['orbitR', 'diveCd', 'diveWindup'],
  bomber: ['boom', 'triggerDist'],
  medic: ['healR', 'healPs'],
  nest: ['spawnCd', 'maxBrood', 'broodId'],
  dasher: ['dash'],
  sniper: ['beam'],
};

function checkTelegraph(id, t, problems, label = 'telegraph') {
  if (!(t.windupMs >= 350)) problems.push(`${id}: ${label} windupMs ${t.windupMs} is below the 350ms reaction floor`);
  if (!(t.recoverMs >= 0)) problems.push(`${id}: ${label} recoverMs is not a duration`);
  if (typeof t.recoverFrozen !== 'boolean') problems.push(`${id}: ${label} must declare recoverFrozen — it is the punish window, not a default`);
  if (!(t.cooldownMs > 0)) problems.push(`${id}: ${label} needs a cooldownMs`);
  if (!(t.retryFrac > 0 && t.retryFrac <= 1)) problems.push(`${id}: ${label} retryFrac must be in (0,1]`);
  if (!t.shape || !SHAPE_PARAMS[t.shape.kind]) problems.push(`${id}: ${label} shape ${JSON.stringify(t.shape && t.shape.kind)} is not circle/cone/line`);
  else for (const k of SHAPE_PARAMS[t.shape.kind]) if (!(t.shape[k] > 0)) problems.push(`${id}: ${label} ${t.shape.kind} needs "${k}" > 0`);
  if (!(t.damage > 0)) problems.push(`${id}: ${label} with no damage`);
  if (!isDomain(t.domain)) problems.push(`${id}: ${label} domain ${JSON.stringify(t.domain)} is not physical/mental/spiritual`);
}

function assertRegionEnemies() {
  const problems = [];
  const seen = new Set();

  for (const [regionId, { enemies, boss }] of Object.entries(REGION_ENEMIES)) {
    if (!enemies.length) { problems.push(`${regionId}: no enemies`); continue; }

    for (const e of enemies) {
      if (seen.has(e.id)) problems.push(`${e.id}: duplicate enemy id across regions`);
      seen.add(e.id);
      if (!isDomain(e.domain)) problems.push(`${e.id}: domain ${JSON.stringify(e.domain)} is not physical/mental/spiritual`);
      if (!(e.w > 0)) problems.push(`${e.id}: encounter weight must be > 0 — a zero-weight type never spawns`);
      if (!(e.hp > 0) || !(e.radius > 0)) problems.push(`${e.id}: hp and radius must be positive`);

      // Behaviour params — see BEHAVIOR_PARAMS.
      const need = BEHAVIOR_PARAMS[e.behavior];
      if (!need) problems.push(`${e.id}: behaviour "${e.behavior}" is not in BEHAVIOR_PARAMS — either it is a typo or its required params are undeclared, and an undeclared behaviour throws on its first tick`);
      else for (const k of need) {
        if (e[k] === undefined || e[k] === null) problems.push(`${e.id}: behaviour "${e.behavior}" reads def.${k} every tick and it is missing — this crashes the sim the moment one spawns`);
      }

      // RULE 1: every heavy commits.
      if (HEAVY_BEHAVIORS.has(e.behavior) && !e.telegraph) {
        problems.push(`${e.id}: behaviour "${e.behavior}" is a heavy and must telegraph — a heavy that cannot be read is undodgeable damage wearing a big silhouette`);
      }
      // RULE 3: chaff does not.
      if (!HEAVY_BEHAVIORS.has(e.behavior) && e.telegraph) {
        problems.push(`${e.id}: behaviour "${e.behavior}" is chaff and must NOT telegraph — if everything commits, holding stance is always punished and Footing collapses into "always break"`);
      }
      if (e.telegraph) checkTelegraph(e.id, e.telegraph, problems);
    }

    // RULE 2: at least half the population, by encounter weight.
    const { total, tel, share } = telegraphWeight(enemies);
    if (share < MIN_TELEGRAPH_WEIGHT) {
      problems.push(`${regionId}: telegraphing weight ${tel.toFixed(1)}/${total.toFixed(1)} = ${(100 * share).toFixed(1)}%, under the ${(100 * MIN_TELEGRAPH_WEIGHT).toFixed(0)}% floor — most incoming damage would be undodgeable and the hold-or-break decision is settled by arithmetic rather than by play`);
    }

    // The boss, and its second phase, are both telegraphed attacks.
    if (!boss) { problems.push(`${regionId}: no boss`); continue; }
    if (!boss.telegraph) problems.push(`${boss.id}: a region boss must telegraph`);
    else checkTelegraph(boss.id, boss.telegraph, problems);
    if (!boss.p2) problems.push(`${boss.id}: no phase 2 — a region boss is two-phase`);
    else {
      if (!(boss.p2.atFrac > 0 && boss.p2.atFrac < 1)) problems.push(`${boss.id}: p2.atFrac must be a fraction in (0,1)`);
      if (!boss.p2.telegraph) problems.push(`${boss.id}: phase 2 must telegraph too — an enrage that stops committing is an enrage that stops being dodgeable`);
      else {
        checkTelegraph(boss.id, boss.p2.telegraph, problems, 'p2 telegraph');
        // Phase 2 must CHANGE THE READ, not just the numbers. A phase 2 with
        // the same zone shape is a stat multiplier wearing a phase change.
        if (boss.p2.telegraph.shape.kind === boss.telegraph.shape.kind) {
          problems.push(`${boss.id}: phase 2 reuses the ${boss.telegraph.shape.kind} zone — a second phase must change the SHAPE, or the read a player learned in phase 1 stays correct and nothing happened`);
        }
      }
    }
  }

  if (problems.length) {
    throw new Error(`region enemy definitions failed ${problems.length} load assertion(s):\n  - ${problems.join('\n  - ')}`);
  }
}

assertRegionEnemies();
