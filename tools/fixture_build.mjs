// A CHARACTER THE WAY A RUN PRODUCES ONE — the shared fixture every power-curve
// measurement builds on. Nothing here is a game change; it exists because three
// separate surveys have now reported confident numbers about characters that
// were missing a power source (§13 rule 82, three times).
//
// A played character at level N carries FOUR things. A fixture that assigns
// `p.level` and spends skill points carries one and a half:
//
//   1. skill nodes and ranks     — fixtures did this
//   2. N-1 spent stat picks      — fixtures did NOT; `banked` is incremented by
//                                  the level-up path, not by the level number,
//                                  so an assigned level-82 read vitality 150
//                                  and FEROCITY 0
//   3. shop items                — fixtures did NOT, at all
//   4. trait/boon state          — out of scope here, stated so it is not
//                                  mistaken for modelled
//
// Everything below is deterministic from the seed.
import * as SKILLSIM from '../js/skillsim.js';
import { TREES, TREES_BY_CLASS, slotsAtLevel, skillRank } from '../js/skills.js';
import { ITEMS } from '../js/content/items.js';
import { CONFIG } from '../js/config.js';
import { TOTAL_REGIONS } from '../js/regions.js';

// ---------------------------------------------------------------- stat picks
//
// Driven through `_maybeOffer` + the same `uiAction` a player clicks, rather
// than by writing `permStats` directly, so the fixture cannot drift from the
// rule the game applies.
export function spendStats(g, p, n) {
  p.banked = n;
  let guard = 0;
  while (p.banked > 0 && guard++ < 800) {
    g._maybeOffer(p);
    if (!p.pendingOffer) break;
    g.uiAction(0, { kind: 'levelup', id: p.pendingOffer[0].id });
  }
  p.banked = 0;
  g._recomputeStats(p);
}

// ---------------------------------------------------------------- skill spend
//
// `learnableSkills()` returns everything a point can be spent on INCLUDING
// already-learned nodes, because ranking up is a spend. "Take the deepest
// learnable" therefore returns the same node forever — that bug produced a
// fake level-20 plateau in the first phase-1 pass.
//
//   'shallow' — stop learning once the loadout is full; rank those eight.
//   'deep'    — learn every node, then equip the eight deepest actives.
//   'spread'  — learn every node, keep whatever auto-slotted.
export function spendSkills(g, p, points, mode = 'spread') {
  let left = points;
  const slotCap = slotsAtLevel(p.level);
  for (let pass = 0; pass < 12 && left > 0; pass++) {
    if (mode === 'shallow' && (p.loadout || []).filter(Boolean).length >= slotCap) break;
    const fresh = SKILLSIM.learnableSkills(p).filter(s => skillRank(p, s.id) < 1).sort((a, b) => a.tier - b.tier);
    if (!fresh.length) break;
    for (const s of fresh) {
      if (left <= 0) break;
      if (mode === 'shallow' && (p.loadout || []).filter(Boolean).length >= slotCap) break;
      p.skillPoints++;
      if (SKILLSIM.spendSkillPoint(g, p, s.id)) left--; else p.skillPoints--;
    }
  }
  if (mode === 'deep') {
    const byId = Object.fromEntries(Object.values(TREES).flatMap(t => t.skills).map(x => [x.id, x]));
    const owned = Object.keys(p.skillRanks || {}).map(id => byId[id]).filter(x => x && x.type === 'active');
    const best = owned.sort((a, b) => b.tier - a.tier).slice(0, slotCap).map(x => x.id);
    for (let i = 0; i < p.loadout.length; i++) p.loadout[i] = best[i] || null;
  }
  const slotted = () => (p.loadout || []).filter(Boolean);
  let guard = 0;
  while (left > 0 && guard++ < 8000) {
    const pool = slotted().length ? slotted() : Object.keys(p.skillRanks);
    if (!pool.length) break;
    const targets = mode === 'concentrated' ? [pool[0]] : pool;
    let any = false;
    for (const id of targets) {
      if (left <= 0) break;
      p.skillPoints++;
      if (SKILLSIM.spendSkillPoint(g, p, id)) { left--; any = true; } else p.skillPoints--;
    }
    if (!any) break;
  }
  g._recomputeStats(p);
  return points - left;
}

// ---------------------------------------------------------------- items
//
// HOW THE LOADOUT IS CHOSEN, and why this rule rather than another.
//
// There is no item cap: `p.items` is an unbounded array. So the question is not
// "how many can a character hold" but "how many does a run hand one", and that
// has two candidate bounds — gold, and shop offers.
//
//   GOLD is not binding. Measured, one plain combat room per region across the
//   eight pays ~2,500 gold; a region's path is ~5 fights, so a run banks on the
//   order of 12,500. The shop's own rarity mix (62/26/12/0, Greed-biased)
//   averages ~22 gold an item. That is several hundred items' worth.
//
//   OFFERS are binding. A shop opens on every arena clear, at every shop node
//   and after every boss — roughly 7 visits a region — and `CONFIG.SHOP_SLOTS`
//   is 4, of which the weapon guarantee eats 1-2 with cards nobody can buy.
//
// So the rule is: **one item per shop visit per region reached**, drawn with
// the shop's own Greed-biased rarity roll. That is deliberately CONSERVATIVE —
// it assumes a player buys one card a visit rather than clearing the rack, and
// it is a floor on what a real character carries rather than a ceiling. A
// tuning pass calibrated against it will under-estimate player power, which is
// the safe direction to be wrong in.
//
// Stated as a number so it can be argued with: a level-82 character reaching
// region 8 carries ITEMS_PER_REGION x 8 items.
export const ITEMS_PER_REGION = 7;      // shop visits a region, measured above

// The shop's own roll, reproduced rather than imported — `_rollRarity` is a
// private method on Sim and takes a shop rng this fixture does not have.
// Weights are the shop's defaults; Greed biases them in game and is ignored
// here, which again errs low.
const RARITY_W = [['common', 62], ['uncommon', 26], ['rare', 12], ['legendary', 0]];

function pickRarity(rand) {
  const total = RARITY_W.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [name, w] of RARITY_W) { r -= w; if (r <= 0) return name; }
  return 'common';
}

// Deterministic PRNG so a fixture is reproducible without touching sim.rng
// (which the sim itself is consuming).
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// `regionsReached` is what bounds the count. A level-82 character has been
// through all eight.
export function giveItems(g, p, { regionsReached = TOTAL_REGIONS, seed = 12345, perRegion = ITEMS_PER_REGION } = {}) {
  const rand = lcg(seed + p.idx * 7919);
  const want = Math.max(0, Math.round(regionsReached * perRegion));
  const owned = new Set(p.items || []);
  let added = 0;
  let guard = 0;
  while (added < want && guard++ < want * 40) {
    const rar = pickRarity(rand);
    const pool = ITEMS.filter(it => it.rarity === rar && !owned.has(it.id));
    if (!pool.length) continue;
    const it = pool[Math.floor(rand() * pool.length)];
    p.items.push(it.id);
    owned.add(it.id);
    added++;
  }
  g._recomputeStats(p);
  return { added, want, distinct: owned.size };
}

// ---------------------------------------------------------------- the whole
export function buildCharacter(g, p, { level, points = null, mode = 'spread', items = true,
                                       regionsReached = TOTAL_REGIONS, seed = 12345 } = {}) {
  p.level = level;
  spendStats(g, p, level - 1);
  const spent = spendSkills(g, p, points ?? level, mode);
  const itemInfo = items ? giveItems(g, p, { regionsReached, seed }) : { added: 0 };
  return {
    level, spent, mode,
    items: itemInfo.added,
    vitality: p.stats.vitality, ferocity: p.stats.ferocity,
    slots: slotsAtLevel(level),
    slotted: (p.loadout || []).filter(Boolean).length,
    nodes: Object.keys(p.skillRanks || {}).length,
    slotRanks: (p.loadout || []).filter(Boolean).map(id => p.skillRanks[id]),
  };
}

// ------------------------------------------------------ MOVEMENT staging
//
// THE BRIEF'S PREMISE, CORRECTED BY MEASUREMENT. It said samurai's "movement
// and footing triggers read 0 at every rank" on a stationary fixture. Half of
// that is right and the half that is wrong matters:
//
//   `p.stillT` accrues on its own the moment nobody presses a direction
//   (js/game.js:1830), so `MOVEMENT mode:'still'` fires FOR FREE on a
//   stationary fixture. `p.movingT` (js/game.js:1840) resets to 0 every tick
//   the player is not moving, so `mode:'moving'` is the half that reads 0.
//
// Measured on a level-82 samurai against a mortal ring, one tree at a time,
// staged the way this module ships (see below):
//
//   samurai_agility   still 174.9   moving 682.4    <- x3.9, the real gap
//   samurai_armor     still 322.2   moving 166.1    <- wants 'still'
//   samurai_tactics   still 692.3   moving 270.8    <- wants 'still'
//
// So no tree reads zero, and NO SINGLE WINDOW MEASURES THE CLASS. Each of
// samurai's three trees peaks in a different one. A fixture that picks one
// window and reports one number is wrong for two trees whichever it picks.
//
// HOW TO MOVE, and why not the obvious way. The first version drove a slow
// circle — real travel, `mx/my` rotating. It stages the trigger and it also
// walks the character away from its own kit: measured, a level-82 hunter went
// 8114 DPS standing to 417 circling, a 19x collapse that is about pets and
// placed effects being left behind, not about movement triggers. Staging must
// not cost the thing being staged.
//
// `tree_dps` already answered this (tools/tree_dps.mjs:248) by flipping the
// input axis every frame: `p.moving` stays true so `movingT` accrues, net
// displacement is ~0, so a positional kit is undisturbed. Reused verbatim
// rather than reinvented, so the two fixtures cannot disagree about what
// "moving" means.
export function driveMoving(g, p, i) { g.setInput(p.idx, { mx: (i % 2 ? 1 : -1), my: 0 }); }
export function driveStill(g, p) { g.setInput(p.idx, { mx: 0, my: 0 }); }

// ENGAGE: walk at the nearest enemy, hold at standoff. This is the driver
// `difficulty_gate` already calibrates against (tools/difficulty_gate.mjs:117),
// reused for the same reason `driveMoving` reuses tree_dps's.
//
// It is needed wherever a room has to be CLEARED rather than survived, because
// a fixture that never presses a direction is a statue — and a statue cannot
// finish a fight it is not standing in the middle of. Measured: a level-82
// itemised hunter left stationary in a region-8 room dies in 17.8 s, and a
// priest survives 180 s without ever clearing it. Neither number is about the
// build.
//
// It is a FLOOR on real play, deliberately: it advances and holds, it never
// kites, retreats or repositions. So survival read through it under-estimates a
// real player and clear time over-estimates one.
export function driveEngage(g, p, { standoff = 110, range = 900 } = {}) {
  const tgt = g.trigGrid && g.trigGrid.nearest ? g.trigGrid.nearest(p.x, p.y, range) : null;
  if (!tgt) { g.setInput(p.idx, { mx: 0, my: 0 }); return null; }
  const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy) || 1;
  g.setInput(p.idx, d > standoff ? { mx: dx / d, my: dy / d } : { mx: 0, my: 0 });
  return tgt;
}

// Which windows a character's SLOTTED kit actually needs. Derived from the
// triggers rather than from a list of class ids, so a class that gains a
// movement node later is staged without anyone remembering to edit a set.
export function movementWindows(p) {
  const byId = Object.fromEntries(Object.values(TREES).flatMap(t => t.skills).map(x => [x.id, x]));
  const out = new Set();
  for (const id of (p.loadout || []).filter(Boolean)) {
    const t = byId[id] && byId[id].trigger;
    if (t && t.kind === 'MOVEMENT') out.add(t.mode === 'still' ? 'still' : 'moving');
  }
  if (!out.size) out.add('still');
  return [...out];
}

// Run `fn(window)` in every window the kit needs and keep the BEST. A class is
// measured playing its kit rather than playing the fixture's convenience; a
// class with no MOVEMENT node runs one window and pays nothing.
export function bestOverWindows(p, fn) {
  const wins = movementWindows(p);
  const rows = wins.map(w => ({ window: w, value: fn(w) }));
  const best = rows.reduce((a, b) => (b.value > a.value ? b : a));
  return { ...best, windows: rows };
}

// ------------------------------------------------- accumulation, both kinds
//
// THE BRIEF CALLED THIS ONE GAP. IT IS TWO, AND A MORTAL RING FIXES ONE.
//
// (1) PER-TARGET DOT COMPOUNDING. `applyPlague` does `plagueDps += amt / dur`
// and only refreshes `plagueT`, so a dot re-applied to a body that never dies
// grows without limit. The class that shows it is the WITCH DOCTOR, not the
// savage — peak `plagueDps` on the target, sampled at 15/30/45/60 s:
//
//   witch doctor   immortal dummies   18 -> 32 -> 50 -> 64   climbing
//   witch doctor   mortal ring        18 -> 11 -> 14 -> 28   bounded
//
// That is what `mortalRing` is for, and it works: a body that dies takes its
// accrued dot with it.
//
// (2) `cascade`, WHICH NO TARGET ARRANGEMENT FIXES. It is uncapped ON PURPOSE
// (§8.3; see CASCADE_CD_RATE in js/config.js), it is fed by firing VARIETY
// rather than by kills, and it decays only after CASCADE_IDLE_SECONDS of no
// fires at all — so it ramps in any continuous fight against anything. Twelve
// savage steps carry `scaleWith: 'cascade'`, and js/compose.js:54 turns an
// engine into a LINEAR damage multiplier with no ceiling. Measured on a mortal
// ring, 20 s windows, level-82 savage:
//
//   4325 -> 5663 -> 8981 -> 12303 -> 16674 -> 19896     x4.6 over 120 s, still rising
//   (hunter, control, same fixture:  8114 -> 8136        flat)
//
// The design's safety argument for leaving cascade uncapped is about the
// COOLDOWN term, which is asymptotic to CASCADE_CD_FLOOR and genuinely bounded.
// It does not cover the damage term, and the damage term is the one that runs.
// Reported rather than changed — this module does not tune the game.
//
// SO THE FIXTURE RULE IS: a savage number is only meaningful WITH ITS WINDOW
// attached, and every measurement in this survey uses the same one. Phase 1
// measured a level-82 build clearing a region-8 room in ~45 s, so a room-length
// window is the representative one and 120 s is not a longer look at the same
// thing — it is a different question.
export const MEASURE_SECONDS = 20;
export const WINDOW_DEPENDENT = new Set(['toh_savage']);   // cascade, above
export const DOT_COMPOUNDS = new Set(['toh_witch_doctor']); // needs mortalRing

// A ring that DIES and comes back, so accumulating effects cannot compound
// forever. `hp` is fixed rather than region-composed on purpose: this measures
// output, and a target whose HP moves per region would fold the enemy curve
// into the player reading.
//
// Stations are ABSOLUTE, captured once. A ring that follows the player would
// hide exactly the failure the circling fixture hit above — a kit that
// displaces itself out of its own range would keep reading full output.
export function mortalRing(g, p, spawnId, { n = 8, radius = 95, hp = 900 } = {}) {
  const ring = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = p.x + Math.cos(a) * radius, y = p.y + Math.sin(a) * radius;
    const e = g.spawnEnemyById(spawnId, x, y, { noMats: true });
    if (e) { e.maxHp = e.hp = hp; e.spd = 0; ring.push({ e, x, y }); }
  }
  let deaths = 0;
  return {
    ring,
    deaths: () => deaths,
    // call once per tick: pin the living back on station, respawn the dead
    refresh() {
      for (const slot of ring) {
        if (slot.e.active) { slot.e.x = slot.x; slot.e.y = slot.y; slot.e.knockX = slot.e.knockY = 0; continue; }
        deaths++;
        const e = g.spawnEnemyById(spawnId, slot.x, slot.y, { noMats: true });
        if (e) { e.maxHp = e.hp = hp; e.spd = 0; slot.e = e; }
      }
    },
    ids: () => new Set(ring.map(s => s.e.id)),
  };
}
