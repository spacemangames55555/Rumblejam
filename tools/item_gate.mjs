// THE ITEM GATE — does an item the shop SELLS actually do anything?
//
// This is the third gate in the same family and it exists for the same reason
// as the first two. `offence_test.mjs` was written after a green suite hid a
// party that could not deal damage. `stat_gate.mjs` was written after a green
// suite hid three stats that were offered at every level-up and multiplied
// nothing. Both failures had the same shape: a check on the DECLARATION passed
// for months while the EFFECT was absent.
//
// Phase 4 is about to author four new item tiers — magnitude, rider, domain
// swap, selector-add — and every one of them is a modifier declared on an item
// and read by the engine. An item granting a modifier nothing reads is exactly
// Ferocity with a price tag. So the gate comes BEFORE the pool.
//
// WHAT IT CHECKS, IN THREE LAYERS
//
//   1. Every claim key in the catalog has a probe. A key with no probe is a
//      HOLE in the gate, reported as such and failed — never silently passed.
//   2. Every claim key moves an observable. Staged the way stat_gate stages a
//      stat: the situation the claim says it matters in, set up directly, with
//      the magnitude amplified far past rounding.
//   3. Every item reaches the sheet or the aggregate. A per-item structural
//      diff, which is what catches a typo'd key or a payload that aggregates to
//      nothing — neither of which a per-key probe can see.
//
// STAT CLAIMS ARE CHECKED AT LAYER 3 ONLY, AND THAT IS DELIBERATE. `stat_gate`
// already proves all ten stats move an observable; duplicating those ten sims
// here would be a second definition waiting to drift. What this gate adds for a
// stat claim is the half stat_gate cannot see: that the ITEM's grant reaches
// the sheet. The two compose — sheet→effect there, item→sheet here — and BOTH
// must be green for a stat item to be sellable.
//
// THE GATE REJECTS; IT NEVER RANKS. A weak-but-live hook passes. There is no
// scoring, no ordering, and no opinion about whether a magnitude is correct.
//
// Usage: node tools/item_gate.mjs [--verbose]

import { Sim } from '../js/game.js';
import { ITEMS, ITEM_BY_ID } from '../js/content/items.js';
import { STATS } from '../js/config.js';
import { SELECTABLE } from '../js/content/characters.js';
import { TREES, SKILL_BY_ID } from '../js/skills.js';
import { spendSkillPoint } from '../js/skillsim.js';
import { ENEMIES } from '../js/content/enemies.js';

const VERBOSE = process.argv.includes('--verbose');
let failures = 0;
const fail = (m) => { failures++; console.error(`✗ ${m}`); };
const ok = (m) => console.log(`✓ ${m}`);

const ARRIVE_LEVEL = 12;          // §13 rule 20 — the state a player arrives in
const SEED = 4711;
const PROBE_ID = '__item_gate_probe__';

const NECRO = (SELECTABLE.find(c => c.id === 'toh_necromancer') || SELECTABLE[0]).id;
const DEFAULT_CHAR = SELECTABLE[0].id;
const DUMMY_ID = ENEMIES[0].id;   // read from the live table, never written down

// ------------------------------------------------------------------ staging

// A synthetic item is injected into the live catalog rather than poked into
// `hookAgg` directly, because the path from an item's declaration to the
// aggregate IS part of what is under test. Writing the aggregate by hand would
// prove the engine reads a field while leaving the item that grants it unproven.
function probeItem(claim) {
  ITEM_BY_ID[PROBE_ID] = { id: PROBE_ID, name: 'Gate Probe', rarity: 'common', price: 0, ...claim };
  return PROBE_ID;
}

function stage(charId, claim, opts = {}) {
  const party = [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }];
  if (opts.twoPlayer) party.push({ idx: 1, key: 'k2', name: 'Q', charId, color: '#0ff' });
  const g = new Sim({ seed: SEED, party });
  const p = g.players[0];
  for (const q of g.players) {
    q.level = ARRIVE_LEVEL;
    for (const tid of Object.keys(TREES).filter(t => TREES[t].classId === charId)) {
      for (const s of [...TREES[tid].skills].sort((a, b) => a.tier - b.tier)) { q.skillPoints++; spendSkillPoint(g, q, s.id); }
    }
  }
  if (claim) g._grantItem(p, probeItem(claim));
  // LEARNED IS NOT SLOTTED (§13 rule 20). `spendSkillPoint` auto-slots only into
  // an already-unlocked slot, and a level-12 character has three — so a fixture
  // that learns thirty skills still fights with the first three it bought. A
  // probe whose claim rides a specific skill must SLOT that skill, the way the
  // player who wanted it would. `knockbackBoost` read DEAD for exactly this: no
  // skill in the default loadout carries a knockback rider.
  if (opts.slot) {
    p.loadout = new Array(8).fill(null);
    opts.slot.forEach((id, i) => { p.loadout[i] = id; });
  }
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);
  // Every probe stages its own targets; ambient spawns would add noise the
  // comparison cannot attribute.
  for (const e of [...g.enemyPool]) if (e.active) { e.hp = 0; e.active = false; }
  for (const q of g.players) { q.hp = q.stats.vitality; q.invuln = 0; }
  return { g, p, q: g.players[1] };
}

// A target spawned through the real path, then pinned so movement cannot change
// what a probe measures.
function target(g, x, y, mods = {}) {
  const e = g.spawnEnemyById(DUMMY_ID, x, y);
  if (!e) return null;
  e.maxHp = e.hp = mods.hp ?? 1e9;
  e.speed = 0; e.spawnX = x; e.spawnY = y;
  if (mods.elite) e.elite = true;
  return e;
}
const repin = (...es) => { for (const e of es) if (e) { e.x = e.spawnX; e.y = e.spawnY; e.knockX = 0; e.knockY = 0; } };

function tickFor(g, seconds, pins = []) {
  for (let i = 0; i < Math.round(60 * seconds); i++) {
    for (const q of g.players) g.setInput(q.idx, { mx: 0, my: 0 });
    g.tick();
    repin(...pins);
  }
}

// THE SPATIAL GRID IS REBUILT EVERY TICK. An enemy spawned this instant is not
// in it, and `_areaDamageEnemies` queries the grid — so a blast fired before the
// first tick lands on nobody. The first run of this gate reported `killExplode`
// and `onHurtRetaliate` DEAD for exactly that reason, and both are read in live
// code. One frame of settling is the difference between measuring the game and
// measuring the fixture.
function settle(g, pins = []) { tickFor(g, 0.2, pins); }

// Bench the player's own skills. Used wherever the observable must be somebody
// else's damage — a minion's, an aura's, a retaliation's — so the number is not
// the player's own output with a rounding error on top.
const benchSkills = p => { p.loadout = new Array(8).fill(null); };

// Kill `n` staged enemies through the real kill path.
function killN(g, p, n, at = null) {
  for (let i = 0; i < n; i++) {
    const e = target(g, at ? at.x : p.x + 70, at ? at.y : p.y + (i % 7) * 4, { hp: 1 });
    if (!e) break;
    g.damageEnemy(e, 50, { owner: p });
  }
}

// ------------------------------------------------------------------- probes
//
// Each entry: the amplified payload to grant, and a `run` returning a NUMBER.
// The gate runs it twice — without the item and with it — and the claim is live
// if the two numbers differ. `what` names the observable so a row reads as a
// finding rather than a boolean.
//
// Payloads are written out at full amplitude rather than scaled by a factor,
// because "stronger" is not the same direction for every field: a lower
// `critEveryN` is stronger, a lower `chillOnHit.mult` is stronger, and a
// blanket ×20 would have quietly weakened three of them.

const HOOKS = {
  // ---- healing sources ----
  regen: {
    what: 'HP regained in 6 s standing still at 1 HP',
    payload: { hps: 20 },
    run: ({ g, p }) => { p.hp = 1; tickFor(g, 6); return Math.round(p.hp); },
  },
  lifesteal: {
    what: 'HP regained while dealing skill damage from 1 HP',
    payload: { pct: 400 },
    run: ({ g, p }) => { const e = target(g, p.x + 60, p.y); if (!e) return NaN; p.hp = 1; tickFor(g, 6, [e]); return Math.round(p.hp); },
  },
  killHeal: {
    what: 'HP regained across 30 kills from 1 HP',
    payload: { amount: 20 },
    run: ({ g, p }) => { p.hp = 1; killN(g, p, 30); return Math.round(p.hp); },
  },
  materialHeal: {
    what: 'HP regained collecting 60 materials from 1 HP',
    payload: { chance: 1, amount: 15 },
    run: ({ g, p }) => { p.hp = 1; for (let i = 0; i < 60; i++) g._dropMaterial(p.x + 6, p.y + 6); tickFor(g, 3); return Math.round(p.hp); },
  },
  roomClearHeal: {
    what: 'HP regained on fight clear from 1 HP',
    payload: { amount: 60 },
    run: ({ g, p }) => { p.hp = 1; g._clearRewards(p); return Math.round(p.hp); },
  },
  critHeal: {
    what: 'HP regained from crits while firing skills for 8 s at 1 HP',
    // A guaranteed crit source in BOTH runs. Without it the fixture's Reflex is
    // near zero, no crit ever lands, and a working heal reads dead — the same
    // shape as Ingenuity's probe measuring a field with no minion on it.
    with: { critEveryN: { n: 1 } },
    payload: { amount: 40 },
    run: ({ g, p }) => { const e = target(g, p.x + 60, p.y); if (!e) return NaN; p.hp = 1; tickFor(g, 8, [e]); return Math.round(p.hp); },
  },
  secondWind: {
    what: 'HP left after a hit that would otherwise down the player',
    payload: { healPercent: 0.9 },
    run: ({ g, p }) => { g.hurtPlayer(p, 99999, null, { shared: true }); return Math.round(p.hp) + (p.downed ? 0 : 100000); },
  },
  blockShield: {
    what: 'HP lost across 30 hits spaced 4 s apart',
    payload: { cooldown: 0.05 },
    run: ({ g, p }) => {
      let lost = 0;
      for (let i = 0; i < 30; i++) {
        p.hp = p.stats.vitality; p.invuln = 0;
        const b = p.hp; g.hurtPlayer(p, 25, null, { shared: true }); lost += b - p.hp;
        tickFor(g, 0.2);
      }
      return Math.round(lost);
    },
  },
  reviveSpeed: {
    what: 'revive progress on a downed ally after 1 s',
    payload: { mult: 30 },
    two: true,
    run: ({ g, p, q }) => {
      if (!q) return NaN;
      q.downed = true; q.reviveP = 0; q.x = p.x + 10; q.y = p.y;
      tickFor(g, 1);
      return Math.round((q.downed ? q.reviveP : 1) * 10000);
    },
  },
  vitalityOnKill: {
    what: 'max HP after 30 kills',
    payload: { amount: 8, cap: 400 },
    run: ({ g, p }) => { killN(g, p, 30); return Math.round(p.stats.vitality); },
  },

  // ---- conditional and timed stat grants ----
  condStats: {
    what: 'Ferocity on the sheet with an enemy standing 30 units away',
    payload: { cond: { kind: 'enemyNear', r: 200 }, stats: { ferocity: 300 } },
    run: ({ g, p }) => { const e = target(g, p.x + 30, p.y); if (!e) return NaN; tickFor(g, 1.5, [e]); return Math.round(p.stats.ferocity); },
  },
  nextAttackAfterDodge: {
    what: 'damage to a pinned target over 6 s after a forced dodge',
    payload: { bonus: 900 },
    run: ({ g, p }) => {
      const e = target(g, p.x + 60, p.y); if (!e) return NaN;
      // Reflex decides whether a hit is dodged at all, so the probe raises it
      // until a dodge is certain — in BOTH runs, so the comparison is unchanged.
      g._applyPerm(p, { reflex: 500 });
      p.dmgBuffT = 0;
      let dodged = false;
      for (let i = 0; i < 200; i++) { p.hp = p.stats.vitality; p.invuln = 0; const h = p.hp; g.hurtPlayer(p, 1, null, {}); if (p.hp === h) dodged = true; if (dodged) break; }
      // §13 rule 3 — the probe verifies its own instrument. No dodge means the
      // situation was never staged, which is BROKEN, not DEAD.
      if (!dodged) return NaN;
      const before = e.hp; tickFor(g, 6, [e]); return Math.round(before - e.hp);
    },
  },
  levelStats: {
    what: 'max HP after one level-up',
    payload: { stats: { vitality: 400 } },
    run: ({ g, p }) => { p.xpNext = 1; g._collectMaterial(p, 5); return Math.round(p.stats.vitality); },
  },
  floorStats: {
    what: 'Greed on the sheet after advancing a floor',
    payload: { stats: { greed: 300 } },
    run: ({ g, p }) => { g._startFloor(g.floorNum + 1); return Math.round(p.stats.greed); },
  },
  allyAura: {
    what: "an ally's Ferocity while standing inside the aura",
    payload: { radius: 400, stats: { ferocity: 300 } },
    two: true,
    run: ({ g, p, q }) => { if (!q) return NaN; q.x = p.x + 20; q.y = p.y; tickFor(g, 1.5); return Math.round(q.stats.ferocity); },
  },

  // ---- crit grants (crit is not a stat) ----
  critAfterKill: {
    what: 'damage to a pinned target over 8 s with a kill banked first',
    payload: true,
    run: ({ g, p }) => { killN(g, p, 1); const e = target(g, p.x + 60, p.y); if (!e) return NaN; const b = e.hp; tickFor(g, 8, [e]); return Math.round(b - e.hp); },
  },
  critEveryN: {
    what: 'damage to a pinned target over 8 s with every hit critting',
    payload: { n: 1 },
    run: ({ g, p }) => { const e = target(g, p.x + 60, p.y); if (!e) return NaN; const b = e.hp; tickFor(g, 8, [e]); return Math.round(b - e.hp); },
  },
  critVsChilled: {
    what: 'damage to a chilled pinned target over 8 s',
    payload: true,
    run: ({ g, p }) => { const e = target(g, p.x + 60, p.y); if (!e) return NaN; g.applySlow(e, 0.5, 30); const b = e.hp; tickFor(g, 8, [e]); return Math.round(b - e.hp); },
  },
  critVsBurning: {
    what: 'damage to a burning pinned target over 8 s',
    payload: true,
    run: ({ g, p }) => { const e = target(g, p.x + 60, p.y); if (!e) return NaN; g._applyBurn(e, 1, 30, p); const b = e.hp; tickFor(g, 8, [e]); return Math.round(b - e.hp); },
  },
  critVsFullHp: {
    what: 'damage to a full-HP pinned target over 8 s',
    payload: true,
    run: ({ g, p }) => { const e = target(g, p.x + 60, p.y); if (!e) return NaN; const b = e.hp; tickFor(g, 8, [e]); return Math.round(b - e.hp); },
  },
  firstHitCrit: {
    what: 'damage to a pinned target over 8 s from a fresh room',
    payload: true,
    run: ({ g, p }) => { p.firstHitUsed = false; const e = target(g, p.x + 60, p.y); if (!e) return NaN; const b = e.hp; tickFor(g, 8, [e]); return Math.round(b - e.hp); },
  },

  // ---- on-hit status payloads ----
  burnOnHit: {
    what: 'burn damage on a pinned target while the player fires for 8 s',
    payload: { chance: 1, dps: 200, duration: 8 },
    run: ({ g, p }) => { const e = target(g, p.x + 60, p.y); if (!e) return NaN; const b = e.hp; tickFor(g, 8, [e]); return Math.round(b - e.hp); },
  },
  chillOnHit: {
    what: 'chill depth on a pinned target after 8 s of skill fire',
    payload: { chance: 1, mult: 0.05, duration: 8 },
    run: ({ g, p }) => { const e = target(g, p.x + 60, p.y); if (!e) return NaN; tickFor(g, 8, [e]); return Math.round((1 - (e.slowMult ?? 1)) * 1000 + (e.slowT || 0) * 10); },
  },
  chainOnHit: {
    what: 'damage on a SECOND target the player never targets',
    payload: { chance: 1, damage: 200, range: 300 },
    run: ({ g, p }) => {
      const a = target(g, p.x + 60, p.y), b = target(g, p.x + 140, p.y);
      if (!a || !b) return NaN;
      const before = b.hp; tickFor(g, 8, [a, b]); return Math.round(before - b.hp);
    },
  },
  statusBoost: {
    what: 'chill depth and plague rate applied through the skill path',
    payload: { pct: 400 },
    run: ({ g, p }) => {
      const e = target(g, p.x + 60, p.y); if (!e) return NaN;
      g.applySlow(e, 0.5, 3, p);
      g.applyPlague(e, 40, 4, p, { id: 'probe', domain: 'spiritual' });
      return Math.round((1 - (e.slowMult ?? 1)) * 1000 + (e.slowT || 0) * 100 + (e.plagueDps || 0) * 10);
    },
  },

  // ---- combat misc ----
  killExplode: {
    what: 'damage to a bystander when a neighbour dies',
    payload: { chance: 1, damage: 400, radius: 300 },
    run: ({ g, p }) => {
      benchSkills(p);
      const by = target(g, p.x + 90, p.y); if (!by) return NaN;
      settle(g, [by]);
      const before = by.hp;
      killN(g, p, 12, { x: p.x + 100, y: p.y });
      return Math.round(before - by.hp);
    },
  },
  thorns: {
    what: 'damage dealt back to the enemy that hurt the player',
    payload: { damage: 400 },
    run: ({ g, p }) => {
      benchSkills(p);
      const e = target(g, p.x + 40, p.y); if (!e) return NaN;
      settle(g, [e]);
      const before = e.hp;
      for (let i = 0; i < 10; i++) { p.hp = p.stats.vitality; p.invuln = 0; g.hurtPlayer(p, 5, e, { shared: true }); }
      return Math.round(before - e.hp);
    },
  },
  contactAura: {
    what: 'damage to an enemy standing next to a player who never attacks',
    payload: { dps: 400, radius: 300 },
    run: ({ g, p }) => {
      benchSkills(p);
      const e = target(g, p.x + 40, p.y); if (!e) return NaN;
      const before = e.hp; tickFor(g, 4, [e]); return Math.round(before - e.hp);
    },
  },
  onHurtRetaliate: {
    what: 'damage to nearby enemies when the player is hurt',
    payload: { damage: 400, radius: 300 },
    run: ({ g, p }) => {
      benchSkills(p);
      const e = target(g, p.x + 60, p.y); if (!e) return NaN;
      settle(g, [e]);
      const before = e.hp;
      for (let i = 0; i < 10; i++) { p.hp = p.stats.vitality; p.invuln = 0; g.hurtPlayer(p, 5, null, { shared: true }); }
      return Math.round(before - e.hp);
    },
  },
  killTempo: {
    what: 'move speed on the sheet after 5 kills',
    payload: { tempo: 200, duration: 30, maxStacks: 5 },
    run: ({ g, p }) => { killN(g, p, 5); tickFor(g, 1.5); return Math.round(p.stats.tempo); },
  },
  eliteBossDamage: {
    what: 'damage to a pinned ELITE target over 8 s',
    payload: { bonus: 900 },
    run: ({ g, p }) => { const e = target(g, p.x + 60, p.y, { elite: true }); if (!e) return NaN; const b = e.hp; tickFor(g, 8, [e]); return Math.round(b - e.hp); },
  },
  extraPierce: {
    // ONLY THE NECROMANCER HAS `bolt` SKILLS. A samurai fixture would measure a
    // pierce item in a class with no projectile and report a working item dead
    // — the same shape as Ingenuity's probe measuring the player's own damage.
    what: 'total damage across three targets standing in a line',
    char: NECRO,
    payload: { add: 6 },
    run: ({ g, p }) => {
      const es = [target(g, p.x + 60, p.y), target(g, p.x + 120, p.y), target(g, p.x + 180, p.y)];
      if (es.some(e => !e)) return NaN;
      const before = es.reduce((a, e) => a + e.hp, 0);
      tickFor(g, 8, es);
      return Math.round(before - es.reduce((a, e) => a + e.hp, 0));
    },
  },
  extraProjectiles: {
    // THREE TARGETS, NOT ONE. Extra projectiles fan across a target LIST, so a
    // probe with a single pinned dummy measures a fan that has nowhere to go and
    // reports the same number either way. The claim is "hits more things", and
    // the observable has to contain more things.
    what: 'total damage across three separated targets over 8 s',
    char: NECRO,
    payload: { add: 8 },
    run: ({ g, p }) => {
      const es = [target(g, p.x + 70, p.y - 70), target(g, p.x + 90, p.y), target(g, p.x + 70, p.y + 70)];
      if (es.some(e => !e)) return NaN;
      const before = es.reduce((a, e) => a + e.hp, 0);
      tickFor(g, 8, es);
      return Math.round(before - es.reduce((a, e) => a + e.hp, 0));
    },
  },
  knockbackBoost: {
    what: 'how far a cluster of four is pushed over 6 s of fire',
    // THE PROBE MUST SATISFY THE TRIGGER, not just slot the skill. `necro_bone_nova`
    // is PROXIMITY radius 140 count 4 — it does not fire until FOUR enemies are
    // inside 140 units. A single pinned dummy never armed it, the skill never
    // swung, and the 58 units of drift the probe was reading was collision
    // separation from the player's own body. Staging the loadout was necessary
    // and not sufficient; staging the CONDITION is the rest of §13 rule 20.
    slot: ['necro_bone_nova'],
    payload: { mult: 30 },
    run: ({ g, p }) => {
      const es = [];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const e = target(g, p.x + Math.cos(a) * 60, p.y + Math.sin(a) * 60);
        if (!e) return NaN;
        es.push(e);
      }
      const from = es.map(e => ({ x: e.x, y: e.y }));
      tickFor(g, 6);                       // NOT pinned — displacement is the point
      return Math.round(es.reduce((a, e, i) => a + Math.hypot(e.x - from[i].x, e.y - from[i].y), 0));
    },
  },

  summonBoost: {
    what: 'damage a summoned minion deals, and its max HP',
    payload: { damage: 900, hp: 900 },
    char: NECRO,
    run: ({ g, p }) => {
      const sk = SKILL_BY_ID['necro_raise_skeleton']; if (!sk) return NaN;
      const e = target(g, p.x + 50, p.y); if (!e) return NaN;
      g.tick();                       // slots resolve on the skill tick
      benchSkills(p);                 // every point landing is the minion's
      g.spawnMinions(p, sk, sk.compose[0], 5);
      if (!p.minions.length) return NaN;   // §13 rule 3: BROKEN, not DEAD
      const hp = Math.round(p.minions.reduce((a, m) => a + (m.maxHp || 0), 0));
      const before = e.hp;
      tickFor(g, 8, [e]);
      return Math.round(before - e.hp) + hp * 100000;
    },
  },

  // ---- the two crit TERMS (§9.5) ----
  //
  // No item grants either yet. They are probed anyway, because these are the
  // sites phase 4's magnitude tier writes into and rule 24 says a declared
  // capability is worth less than nothing until something measures it. An item
  // priced against an unproven site is the shop version of Ferocity.
  critChance: {
    what: 'damage to a pinned target over 8 s with crit chance forced to 100%',
    char: NECRO,
    payload: { percent: 100 },
    run: ({ g, p }) => { const e = target(g, p.x + 60, p.y); if (!e) return NaN; const b = e.hp; tickFor(g, 8, [e]); return Math.round(b - e.hp); },
  },
  critMult: {
    what: 'damage to a pinned target over 8 s with every hit critting',
    char: NECRO,
    with: { critEveryN: { n: 1 } },
    payload: { add: 20 },
    run: ({ g, p }) => { const e = target(g, p.x + 60, p.y); if (!e) return NaN; const b = e.hp; tickFor(g, 8, [e]); return Math.round(b - e.hp); },
  },

  // ---- the two remaining §9.2 tiers ----
  domainAdd: {
    // The triangle, not a damage number. A `physical` grant must beat a
    // SPIRITUAL target, and the fixture's own skills must not already beat it —
    // otherwise the probe measures a matchup the player already had and the
    // grant looks dead. The target's domain is set explicitly for that reason.
    what: 'damage to a target the skill\'s own domain does NOT beat',
    char: NECRO,
    payload: { domain: 'physical' },
    run: ({ g, p }) => {
      const e = target(g, p.x + 60, p.y);
      if (!e) return NaN;
      e.domain = 'spiritual';           // physical beats spiritual; spiritual does not
      const b = e.hp;
      tickFor(g, 8, [e]);
      return Math.round(b - e.hp);
    },
  },
  selectorAdd: {
    // TWO TARGETS, AND THE OBSERVABLE IS THE ONE THE SKILL WOULD NOT PICK.
    // Measuring total damage would pass on a selector that added nothing, since
    // the bolts still land somewhere. The claim is "it ALSO strikes what a
    // second selector picks", so the probe watches the target the skill's own
    // selector ranks last and the added one ranks first.
    what: 'damage to the target the skill\'s own selector would not choose',
    char: NECRO,
    payload: { select: 'highest_hp' },
    run: ({ g, p }) => {
      // PERPENDICULAR, NOT COLLINEAR. §5.9: selection is not delivery. Placed on
      // one ray, the bolt aimed at the far target is intercepted by the near one
      // — `bolt` stops at the first body it meets — and the probe reads zero on
      // a selector that chose correctly. The gate spent a run reporting that as
      // a dead item.
      const near = target(g, p.x + 50, p.y, { hp: 4000 });
      const fat = target(g, p.x, p.y + 150);          // 1e9 HP: highest_hp picks this
      if (!near || !fat) return NaN;
      const before = fat.hp;
      tickFor(g, 8, [near, fat]);
      return Math.round(before - fat.hp);
    },
  },

  // ---- pickups ----
  pickupBlast: {
    what: 'damage to an enemy standing where materials are collected',
    payload: { damage: 400, radius: 300 },
    run: ({ g, p }) => {
      benchSkills(p);
      const e = target(g, p.x + 40, p.y); if (!e) return NaN;
      const before = e.hp;
      for (let i = 0; i < 30; i++) g._dropMaterial(p.x + 6, p.y + 6);
      tickFor(g, 3, [e]);
      return Math.round(before - e.hp);
    },
  },
  pickupTempo: {
    what: 'move speed on the sheet after collecting materials',
    payload: { tempo: 200, duration: 30, maxStacks: 5 },
    run: ({ g, p }) => { for (let i = 0; i < 10; i++) g._dropMaterial(p.x + 6, p.y + 6); tickFor(g, 2); return Math.round(p.stats.tempo); },
  },
  pickupBonusChance: {
    what: 'materials banked from 200 pickups',
    payload: { chance: 1 },
    run: ({ g, p }) => { const b = p.matsCollected; for (let i = 0; i < 200; i++) g._collectMaterial(p, 1); return p.matsCollected - b; },
  },

  // ---- economy and growth ----
  doubleMaterials: {
    what: 'materials paid out across 200 kills',
    payload: { chance: 1 },
    run: ({ g, p }) => { killN(g, p, 200); return g.payout.gold; },
  },
  interest: {
    what: 'materials banked at fight clear holding 400',
    payload: { rate: 90, cap: 100000 },
    run: ({ g, p }) => { p.materials = 400; const b = p.matsCollected; g._clearRewards(p); return p.matsCollected - b; },
  },
  freeRerolls: {
    what: 'cost of the first shop reroll',
    payload: { count: 4 },
    run: ({ g, p }) => { g._openShop(p); return g._rerollCost(p); },
  },
  shopDiscount: {
    what: 'total price of the shop stock',
    payload: { percent: 80 },
    run: ({ g, p }) => { g._openShop(p); return p.shop.stock.reduce((a, s) => a + s.price, 0); },
  },
  xpBonus: {
    what: 'XP earned collecting 100 materials',
    payload: { percent: 900 },
    run: ({ g, p }) => { const b = p.xpEarned; g._collectMaterial(p, 100); return Math.round((p.xpEarned - b) * 100); },
  },
  extraChoice: {
    what: 'number of level-up boons offered',
    payload: { n: 4 },
    run: ({ g, p }) => { p.banked = 1; p.pendingOffer = null; g._maybeOffer(p); return (p.pendingOffer || []).length; },
  },
};

// ------------------------------------------------------- layer 1: coverage

console.log(`item gate — ${ITEMS.length} items, three layers: coverage, effect, grant\n`);

const statKeys = new Set(STATS.map(s => s.key));
const usedStats = new Map(), usedHooks = new Map();
for (const it of ITEMS) {
  for (const k of Object.keys(it.stats || {})) usedStats.set(k, (usedStats.get(k) || 0) + 1);
  for (const k of Object.keys(it.hooks || {})) usedHooks.set(k, (usedHooks.get(k) || 0) + 1);
}

const unknownStats = [...usedStats.keys()].filter(k => !statKeys.has(k));
if (!unknownStats.length) ok(`every stat key in the catalog is one of the ${STATS.length} real stats — no misspelling grants nothing`);
else fail(`catalog grants stats that do not exist: ${unknownStats.join(', ')} — an item paying into a key nothing reads`);

const holes = [...usedHooks.keys()].filter(k => !HOOKS[k]);
if (!holes.length) ok(`all ${usedHooks.size} hook kinds in the catalog have a probe — the gate has no blind spot to hide in`);
else fail(`${holes.length} hook kind(s) have NO PROBE (${holes.join(', ')}) — a claim with no gate is exactly the hole this file exists to close`);

const unused = Object.keys(HOOKS).filter(k => !usedHooks.has(k));
if (unused.length) console.log(`  note: ${unused.length} probe(s) for hooks no item currently grants (${unused.join(', ')}) — kept, phase 4 will use them`);

// ---------------------------------------------------------- layer 2: effect

const results = [];
for (const key of Object.keys(HOOKS).filter(k => usedHooks.has(k)).sort()) {
  const h = HOOKS[key];
  const charId = h.char || DEFAULT_CHAR;
  const claim = { hooks: { [key]: h.payload } };
  let base, granted, err = null;
  try {
    const so = { twoPlayer: !!h.two, slot: h.slot };
    // `with` is a PRECONDITION, not a claim: hooks granted in both runs so a
    // probe can stage the situation its own hook needs without the comparison
    // crediting the precondition. `critHeal` fires only on a crit, so measuring
    // it requires a crit source present on both sides of the diff.
    const pre = h.with ? { hooks: { ...h.with } } : null;
    base = h.run(stage(charId, pre, so));
    granted = h.run(stage(charId, h.with ? { hooks: { ...h.with, [key]: h.payload } } : claim, so));
  } catch (e) { err = e; }
  const usable = !err && Number.isFinite(base) && Number.isFinite(granted);
  results.push({ key, what: h.what, base, granted, usable, err, live: usable && base !== granted, items: usedHooks.get(key) });
  if (VERBOSE) console.log(`    ${key}: ${base} -> ${granted}${err ? '  ERR ' + err.message : ''}`);
}

// §13 rule 4 — the gate proves it can see a live hook before reporting a dead
// one. `regen` is unambiguously connected; if its probe does not move, nothing
// below means anything.
const ctrl = results.find(r => r.key === 'regen');
if (ctrl && ctrl.live) ok(`control: regen moves its probe (${ctrl.base} -> ${ctrl.granted} HP) — the gate can see a live hook`);
else fail('control failed: regen did not move its own probe, so no verdict below can be trusted');

console.log('\n  hook                   verdict   items   observable');
console.log('  ----                   -------   -----   ----------');
for (const r of results) {
  const verdict = !r.usable ? 'BROKEN' : (r.live ? 'live' : 'DEAD');
  console.log(`  ${r.key.padEnd(22)} ${verdict.padEnd(9)} ${String(r.items).padStart(5)}   ${r.what}`);
}
console.log('');

const dead = results.filter(r => r.usable && !r.live);
const broken = results.filter(r => !r.usable);
for (const r of broken) fail(`${r.key}: probe could not run (${r.err ? r.err.message : `base ${r.base}, granted ${r.granted}`}) — a probe that cannot measure is not a pass`);
if (dead.length) {
  const items = new Set();
  for (const it of ITEMS) for (const k of Object.keys(it.hooks || {})) if (dead.some(d => d.key === k)) items.add(it.id);
  fail(`${dead.length} hook kind(s) are SOLD AND DO NOTHING — ${dead.map(d => d.key).join(', ')} — across ${items.size} item(s). An item granting a modifier nothing reads is Ferocity with a price tag`);
}

// ----------------------------------------------------------- layer 3: grant
//
// Per item, and structural: does the grant reach the sheet or the aggregate at
// all? A per-key probe cannot see an item whose payload aggregates to nothing —
// a zero chance, an empty stats object, a key spelled right on a hook the item
// does not actually carry.

function fingerprint(p) {
  const s = {};
  for (const k of statKeys) s[k] = p.stats[k];
  return JSON.stringify([s, p.hookAgg]);
}
const bare = stage(DEFAULT_CHAR, null);
const bareFp = fingerprint(bare.p);
const inert = [];
for (const it of ITEMS) {
  const g2 = new Sim({ seed: SEED, party: [{ idx: 0, key: 'k', name: 'P', charId: DEFAULT_CHAR, color: '#fff' }] });
  const p2 = g2.players[0];
  g2._grantItem(p2, it.id);
  if (fingerprint(p2) === bareFp) inert.push(it.id);
}
if (!inert.length) ok(`all ${ITEMS.length} items change the sheet or the aggregate when granted — no item is inert on arrival`);
else fail(`${inert.length} item(s) change NOTHING when granted: ${inert.slice(0, 12).join(', ')}${inert.length > 12 ? ` (+${inert.length - 12} more)` : ''}`);

// And the composition this gate depends on, stated rather than assumed.
const statOnly = ITEMS.filter(it => it.stats && !it.hooks).length;
ok(`${statOnly} of ${ITEMS.length} items are stat-only: their claims are proved sheet→effect by stat_gate and item→sheet here. Both gates must be green for those to be sellable`);

const liveN = results.filter(r => r.live).length;
console.log(`\n  ${liveN}/${results.length} hook kinds in the catalog are connected to anything.`);
console.log(failures ? `\n${failures} ITEM GATE FAILURE(S)` : '\nEVERY ITEM THE SHOP SELLS DOES SOMETHING');
process.exit(failures ? 1 : 0);
