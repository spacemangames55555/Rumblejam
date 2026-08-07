// The Thrones of Heaven trait engine.
//
// The classic roster's traits live inline in game.js because they grew there
// one at a time. This roster is fourteen at once, several of them stateful, so
// they get their own module with an explicit hook contract — game.js calls in
// at a handful of named points and nothing else changes:
//
//   tohInitPlayer(sim, p)            once, when a player is built
//   tohStartFight(sim, p)            entering an arena (per-fight state resets)
//   tohStats(sim, p, s)              inside _recomputeStats, after the raw adds
//   tohTick(sim, dt)                 once per sim tick, after players move
//   tohOnFire(sim, p, ctx)           a weapon fired: {def, a, tx, ty, dmg}
//   tohHitDamage(sim, p, e, dmg)     → adjusted damage, before it lands
//   tohOnHit(sim, p, e, dmg, ctx)    after a hit resolved on a live-or-dead enemy
//   tohOnHurt(sim, p, raw, mitigated) damage taken, post-Grit
//   tohOnDodge(sim, p)               a dodge fired
//   tohOnHeal(sim, p, amt, target)   healing this player CAUSED
//   tohOnKill(sim, p, e)             this player killed something
//   tohEnemyDied(sim, e, killer)     ANY enemy died, killer may be null
//   tohClearFight(sim, p)            the fight was won
//   tohSnapshot(sim)                 world entities for the wire
//   tohMeter(sim, p)                 the 0..1 HUD bar, or -1
//   tohState(sim, p)                 one small int of per-player trait state
//
// Everything here is host-authoritative; clients read the snapshot.

import { CONFIG } from './config.js';
import { clamp, dist2, angleTo } from './util.js';

const D2 = (ax, ay, bx, by) => dist2(ax, ay, bx, by);
const has = (p, key) => p.char.trait.key === key;

// ---------------------------------------------------------------- init

export function tohInitPlayer(sim, p) {
  const t = p.char.trait;
  // Blacksmith — run-long, survives fights and floors
  p.infusions = { pyrite: 0, quartz: 0, calcite: 0 };
  p.infuseOffer = null;
  p.detonate = false;
  // per-fight / per-moment state (all reset in tohStartFight)
  p.decreeT = 0; p.decreeIsCalamity = true;
  p.tohAtk = 0;                 // nth-attack counter (Mage, Sundian)
  p.rhythm = 0; p.rhythmT = 0;
  p.stance = 0; p.stanceCd = 0; p.ironBank = 0; p.flowStacks = 0; p.flowLast = -1;
  p.karma = 0; p.spirit = null;
  p.contractId = null; p.contractsDone = 0; p.contractT = 0; p.vanishT = 0;
  p.grace = 0;
  p.voodooId = null; p.voodooDmg = 0; p.stitch = null;
  p.bloodHeat = 0; p.bloodHeatT = 0;   // NOT p.heat — Pulsar owns that name
  p.packMode = 0;                      // 0 none, 1 alpha, 2 marksman
  // The Bonelord's four mounts USED to be weapon slots. They are not any more:
  // patch-trigger-core zeroes weaponSlots for the whole roster in _makePlayer,
  // and this line ran afterwards and handed four of them back — the one hole in
  // an otherwise total removal. Nothing depended on it. _startingGear is
  // short-circuited so tohStartingGear never runs and the Necromancer starts
  // with no weapon; the Marrownaut payoff reads sim.summons for a fused tier-IV
  // summon, not a mount. The only surviving effect was that shops offered the
  // Necromancer weapons that contribute nothing to a kit which is now two skill
  // trees — 48 of 2256 sampled shops, all of them this class.
  //
  // Removing it makes "weapons are removed from the game" true for 47 of 47
  // characters, which is what makes Sim._stocksWeapons() a reliable predicate
  // rather than one with an exception nobody remembers.
  if (t.key === 'crystal_infusion') p.radius = CONFIG.PLAYER_RADIUS * t.hitbox;
}

// The Necromancer's starting kit is the Overseer's: one mount, no weapons.
export function tohStartingGear(sim, p) {
  if (has(p, 'bonelord')) { sim._addWeapon(p, 'bolt_turret', 1); return true; }
  return false;
}

export function tohStartFight(sim, p) {
  const t = p.char.trait;
  p.decreeT = t.key === 'decree' ? t.intervalSec : 0;
  p.decreeIsCalamity = true;
  p.tohAtk = 0;
  p.rhythm = 0; p.rhythmT = 0;
  p.ironBank = 0; p.flowStacks = 0; p.flowLast = -1;
  p.karma = 0; p.spirit = null;
  p.contractId = null; p.contractT = t.key === 'contract' ? 1.5 : 0;
  p.contractsDone = 0; p.vanishT = 0;
  p.grace = 0;
  p.voodooId = null; p.voodooDmg = 0; p.stitch = null;
  p.bloodHeat = 0; p.bloodHeatT = 0;
}

// ---------------------------------------------------------------- stats

// Called from _recomputeStats after every raw modifier is in, before the
// clamps. `s` is the sheet being built.
export function tohStats(sim, p, s) {
  const t = p.char.trait;
  switch (t.key) {
    case 'crystal_infusion': {
      const inf = p.infusions || { pyrite: 0, quartz: 0, calcite: 0 };
      s.grit += inf.pyrite * t.pyriteGrit;
      s.attunement += inf.quartz * t.quartzAtt;
      s.recovery += inf.calcite * t.calciteRec;
      break;
    }
    case 'rhythm': {
      // Ensemble halves your own bonus into every nearby ally (applied on THEIR
      // sheet below); solo doubles your own. The window timer deliberately does
      // NOT read this — see tohTick — or Tempo would compound into itself.
      const mult = rhythmSolo(sim, p, t) ? t.soloMult : 1;
      s.tempo += p.rhythm * t.tempoPer * mult;
      s.ferocity += p.rhythm * t.ferPer * mult;
      break;
    }
    case 'singularity':
      // Crystalblade: an enemy in your face is worth armour
      if (nearestEnemyWithin(sim, p.x, p.y, t.crystalRange)) s.grit += t.crystalGrit;
      break;
    case 'three_stances':
      if (p.stance === 0) s.grit += t.ironGrit;
      if (p.stance === 2) s.tempo += p.flowStacks * t.flowTempoPer;
      break;
    case 'blood_dance':
      s.ferocity += p.bloodHeat;
      // Blood: Ferocity per 1% of max HP missing. p.stats is the PREVIOUS sheet
      // here, which is the only max we have mid-recompute; it settles in a tick.
      if (p.stats) {
        const missPct = clamp(1 - p.hp / Math.max(1, p.stats.vitality), 0, 1) * 100;
        s.ferocity += missPct * t.bloodPerMissing;
      }
      break;
    case 'contract':
      s.ferocity += p.contractsDone * t.ferPerContract;
      break;
    case 'bonelord': {
      // Marrownaut: all four mounts fused into one, and it lends you its bulk
      const m = marrownaut(sim, p);
      if (m) {
        s.grit += Math.round((m.grit || 0) * t.marrownautGritShare);
        s.vitality += Math.round((m.maxHp || 0) * t.marrownautVitShare);
      }
      break;
    }
    case 'pack_tactics': {
      const beasts = beastsOf(sim, p);
      const near = beasts.filter(b => D2(b.x, b.y, p.x, p.y) <= t.alphaRadius * t.alphaRadius)
        .reduce((a, b) => a + beastWeight(b), 0);
      if (near >= t.alphaMinBeasts) { s.ferocity += t.alphaFer; s.tempo += t.alphaTempo; }
      break;
    }
  }
  // Ensemble is an ALLY aura: a Bard elsewhere in the party feeds this sheet.
  for (const q of sim.players || []) {
    if (q === p || q.gone || q.downed || !has(q, 'rhythm') || !q.rhythm) continue;
    const qt = q.char.trait;
    const radius = qt.ensembleRadius + 0.5 * (q.stats ? q.stats.reach : 0);
    if (D2(p.x, p.y, q.x, q.y) > radius * radius) continue;
    s.tempo += q.rhythm * qt.tempoPer * qt.ensembleShare;
    s.ferocity += q.rhythm * qt.ferPer * qt.ensembleShare;
  }
}

function rhythmSolo(sim, p, t) {
  const radius = t.ensembleRadius + 0.5 * (p.stats ? p.stats.reach : 0);
  for (const q of sim.players || []) {
    if (q === p || q.gone || q.downed) continue;
    if (D2(p.x, p.y, q.x, q.y) <= radius * radius) return false;
  }
  return true;
}

// ---------------------------------------------------------------- per tick

export function tohTick(sim, dt) {
  tickCorals(sim, dt);
  tickSingularities(sim, dt);
  for (const p of sim.players) {
    if (p.gone) continue;
    const t = p.char.trait;
    if (p.stanceCd > 0) p.stanceCd -= dt;
    if (p.vanishT > 0) p.vanishT -= dt;
    if (p.downed) continue;
    switch (t.key) {
      case 'decree': tickDecree(sim, p, t, dt); break;
      case 'rhythm':
        if (p.rhythm > 0) { p.rhythmT -= dt; if (p.rhythmT <= 0) { p.rhythm = 0; sim._recomputeStats(p); } }
        break;
      case 'karma': tickSpirit(sim, p, t, dt); break;
      case 'contract': tickContract(sim, p, t, dt); break;
      case 'voodoo_link': tickVoodoo(sim, p, t, dt); break;
      case 'blood_dance':
        if (p.bloodHeat > 0) { p.bloodHeatT -= dt; if (p.bloodHeatT <= 0) { p.bloodHeat = 0; sim._recomputeStats(p); } }
        break;
      case 'coral_growth': tickCoralWalk(sim, p, t, dt); break;
      case 'pack_tactics': tickPack(sim, p, t); break;
      case 'bonelord': case 'singularity': case 'three_stances':
        // stat-layer only; _recomputeStats runs on its own cadence
        break;
    }
  }
}

// --- Wizard: Decree -----------------------------------------------------
function tickDecree(sim, p, t, dt) {
  // Tempo shortens the interval; the alternation is fixed, Calamity first.
  p.decreeT -= dt * (1 + Math.max(-75, p.stats.tempo) / 100);
  if (p.decreeT > 0) return;
  p.decreeT = t.intervalSec;
  if (p.decreeIsCalamity) {
    const dmg = Math.max(1, Math.round(sim._attuned(p, t.calamityBase)));
    // "every enemy on screen" — the camera box the renderer actually shows
    const hw = CONFIG.STRUCT_OFFSCREEN_W / 2, hh = CONFIG.STRUCT_OFFSCREEN_H / 2;
    const struck = [];
    for (const e of [...sim.enemyPool]) {
      if (Math.abs(e.x - p.x) > hw || Math.abs(e.y - p.y) > hh) continue;
      struck.push({ x: e.x, y: e.y });
      sim.damageEnemy(e, dmg, { owner: p });
      if (!e.active) plague(sim, p, t, e.x, e.y);
    }
    if (struck.length) sim.fx.booms.push({ x: Math.round(p.x), y: Math.round(p.y), r: 140 });
    sim.pushEvent({ k: 'toast', idx: p.idx, text: `CALAMITY — ${struck.length} struck` });
  } else {
    const radius = t.miracleRadius + 0.5 * Math.max(0, p.stats.reach);
    let n = 0;
    for (const q of sim.livePlayers()) {
      if (q.downed) continue;
      if (q !== p && D2(q.x, q.y, p.x, p.y) > radius * radius) continue;
      sim._heal(q, t.miracleHeal, { by: p });
      q.frenzy.push({ tempo: 0, fer: t.miracleFer, t: t.miracleDur, miracle: true });
      sim._recomputeStats(q);
      n++;
    }
    sim.fx.booms.push({ x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius) });
    sim.pushEvent({ k: 'toast', idx: p.idx, text: `MIRACLE — ${n} blessed` });
  }
  p.decreeIsCalamity = !p.decreeIsCalamity;
  sim.pushEvent({ k: 'sfx', s: 'boom' });
}

function plague(sim, p, t, x, y) {
  const dps = sim._attuned(p, t.plagueDps);
  for (const q of sim.enemyPool) {
    if (D2(q.x, q.y, x, y) > t.plagueRadius * t.plagueRadius) continue;
    sim._applyBurn(q, dps, t.plagueDur, p);
  }
}

// --- Monk: Astral Projection --------------------------------------------
function tickSpirit(sim, p, t, dt) {
  if (!p.spirit) return;
  p.spirit.t -= dt;
  if (p.spirit.t <= 0) { p.spirit = null; return; }
  p.spirit.regenAcc = (p.spirit.regenAcc || 0) + dt;
  if (p.spirit.regenAcc >= 1) { p.spirit.regenAcc -= 1; sim._heal(p, t.spiritRegen); }
}

// --- Assassin: Contract --------------------------------------------------
function tickContract(sim, p, t, dt) {
  if (p.contractId !== null) {
    if (sim.enemyById(p.contractId)) return;
    p.contractId = null;
    p.contractT = t.remarkDelay;
    return;
  }
  p.contractT -= dt;
  if (p.contractT > 0) return;
  // elites and bosses first, then whatever is healthiest
  let best = null, bestScore = -1;
  for (const e of sim.enemyPool) {
    if (e.isNest || e.wall) continue;
    const score = (e.boss ? 1e9 : e.elite ? 1e6 : 0) + e.maxHp;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  if (!best) { p.contractT = 0.5; return; }
  p.contractId = best.id;
  best.contractOf = p.idx;
  sim.pushEvent({ k: 'toast', idx: p.idx, text: 'CONTRACT MARKED' });
}

// --- Witch Doctor: Voodoo Link ------------------------------------------
function tickVoodoo(sim, p, t, dt) {
  if (p.stitch) { p.stitch.t -= dt; if (p.stitch.t <= 0) p.stitch = null; }
  const bound = p.voodooId !== null ? sim.enemyById(p.voodooId) : null;
  if (bound && D2(bound.x, bound.y, p.x, p.y) <= t.bindRange * t.bindRange) return;
  // rebind: nearest live enemy, ignoring line of sight (the doll does not care)
  let best = null, bd = Infinity;
  for (const e of sim.enemyPool) {
    if (e.wall) continue;
    const d = D2(e.x, e.y, p.x, p.y);
    if (d < bd) { bd = d; best = e; }
  }
  p.voodooId = best ? best.id : null;
  p.voodooDmg = 0;
}

// --- Sundian: walking your own coral ------------------------------------
function tickCoralWalk(sim, p, t, dt) {
  for (const c of sim.corals) {
    if (c.owner !== p.idx) continue;
    if (D2(c.x, c.y, p.x, p.y) > t.nodeRadius * t.nodeRadius) continue;
    c.t = c.dur;                                  // refresh
    if (p.coralBuffT === undefined || p.coralBuffT <= 0) {
      p.frenzy.push({ tempo: t.dashRefreshTempo, t: t.dashRefreshDur });
      sim._recomputeStats(p);
    }
    p.coralBuffT = t.dashRefreshDur;
    break;
  }
  if (p.coralBuffT > 0) p.coralBuffT -= dt;
}

// --- Hunter: which mode is live -----------------------------------------
function tickPack(sim, p, t) {
  const beasts = beastsOf(sim, p);
  const nearAlpha = beasts.filter(b => D2(b.x, b.y, p.x, p.y) <= t.alphaRadius * t.alphaRadius)
    .reduce((a, b) => a + beastWeight(b), 0);
  const anyNearMarks = beasts.some(b => D2(b.x, b.y, p.x, p.y) <= t.marksmanRadius * t.marksmanRadius);
  const mode = nearAlpha >= t.alphaMinBeasts ? 1 : (!anyNearMarks && beasts.length ? 2 : 0);
  if (mode !== p.packMode) { p.packMode = mode; sim._recomputeStats(p); }
}

// A beast combined in the shop counts as two for both proximity checks.
function beastWeight(b) { return Math.max(1, b.tier || 1) >= 2 ? 2 : 1; }
// A knocked-down beast is inert for the whole 15s, so it is not a beast "within
// 120 of you" for Alpha, and Marksman's own wording is already "per LIVING
// beast". It DOES keep its Pack Tactics slot — that count is taken from
// sim.summons directly in game.js and reads `dead`, not `down`, so a knockdown
// never earns the Hunter a replacement.
function beastsOf(sim, p) { return sim.summons.filter(s => s.owner === p.idx && !s.dead && !s.carried && !s.down); }

function marrownaut(sim, p) {
  const mine = sim.summons.filter(s => s.owner === p.idx && !s.dead);
  if (mine.length !== 1) return null;
  const s = mine[0];
  // one summon holding every mount: tier IV is four mounts fused
  if ((s.tier || 1) < 4) return null;
  return { grit: p.stats ? p.stats.grit : 0, maxHp: s.maxHp };
}

function nearestEnemyWithin(sim, x, y, r) {
  for (const e of sim.enemyPool) if (D2(e.x, e.y, x, y) <= r * r) return e;
  return null;
}

// ---------------------------------------------------------------- coral

function tickCorals(sim, dt) {
  if (!sim.corals.length) return;
  for (const c of sim.corals) {
    c.t -= dt;
    c.acc = (c.acc || 0) + dt;
    if (c.acc < 0.25) continue;
    const mul = c.acc; c.acc = 0;
    const owner = sim.players[c.owner];
    if (!owner) continue;
    const dps = sim._attuned(owner, c.dps);
    for (const e of sim.enemyPool) {
      if (D2(e.x, e.y, c.x, c.y) > c.r * c.r) continue;
      sim.damageEnemy(e, Math.max(1, Math.round(dps * mul)), { owner, silent: true });
      if (e.active) sim._applySlow(e, 1 - c.slow, 0.4, owner);
    }
  }
  sim.corals = sim.corals.filter(c => c.t > 0);
  rebuildCoralWalls(sim);
}

// Two nodes within linkRange grow a wall between them. Walls are NOT arena
// obstacles: they block enemies and enemy shots only, which `_inObstacle`
// (shared by players, sight and every projectile) cannot express. Keeping them
// in their own list also keeps the hot obstacle loops the size they were.
function rebuildCoralWalls(sim) {
  sim.coralWalls = sim.coralWalls.filter(wl =>
    wl.hp > 0 && sim.corals.includes(wl.a) && sim.corals.includes(wl.b));
  const linked = new Set(sim.coralWalls.flatMap(wl => [wl.a, wl.b]));
  for (let i = 0; i < sim.corals.length; i++) {
    for (let j = i + 1; j < sim.corals.length; j++) {
      const a = sim.corals[i], b = sim.corals[j];
      if (a.owner !== b.owner || linked.has(a) || linked.has(b)) continue;
      if (D2(a.x, a.y, b.x, b.y) > a.link * a.link) continue;
      sim.coralWalls.push({ a, b, hp: a.wallHp, maxHp: a.wallHp, owner: a.owner });
      linked.add(a); linked.add(b);
    }
  }
}

// Enemies are stopped by a coral wall; players and allies walk straight
// through. Called from the enemy move path.
export function coralBlocks(sim, x0, y0, x1, y1) {
  for (const wl of sim.coralWalls) {
    if (segsCross(x0, y0, x1, y1, wl.a.x, wl.a.y, wl.b.x, wl.b.y)) return wl;
  }
  return null;
}

function segsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// ---------------------------------------------------------------- singularity

function tickSingularities(sim, dt) {
  if (!sim.singularities.length) return;
  for (const g of sim.singularities) {
    g.t -= dt;
    const owner = sim.players[g.owner];
    for (const e of sim.enemyPool) {
      if (D2(e.x, e.y, g.x, g.y) > g.r * g.r) continue;
      e.vulnT = Math.max(e.vulnT || 0, g.vulnDur);
      e.vulnPct = g.vulnPct;
      if (e.boss) continue;                      // bosses are not dragged
      const a = angleTo(e.x, e.y, g.x, g.y);
      e.x += Math.cos(a) * g.pullSpd * dt;
      e.y += Math.sin(a) * g.pullSpd * dt;
      sim.clampToRoom(e);
    }
    if (g.t <= 0 && owner) {
      const dmg = Math.max(1, Math.round(sim._attuned(owner, g.burst)));
      sim._areaDamageEnemies(g.x, g.y, g.r, dmg, owner);
      sim.fx.booms.push({ x: Math.round(g.x), y: Math.round(g.y), r: Math.round(g.r) });
      sim.pushEvent({ k: 'sfx', s: 'boom' });
    }
  }
  sim.singularities = sim.singularities.filter(g => g.t > 0);
}

// ---------------------------------------------------------------- combat hooks

// A weapon fired. ctx: {def, a, tx, ty}
export function tohOnFire(sim, p, ctx) {
  const t = p.char.trait;
  if (t.key === 'rhythm') {
    // The window is measured on BASE Tempo only: reading the live sheet would
    // let the stacks' own Tempo widen the window that grants them.
    if (p.rhythm < t.maxStacks) p.rhythm++;
    p.rhythmT = t.windowSec;
    sim._recomputeStats(p);
    return;
  }
  if (t.key === 'singularity') {
    p.tohAtk++;
    if (p.tohAtk % t.everyNth !== 0) return;
    const crystal = !!nearestEnemyWithin(sim, p.x, p.y, t.crystalRange);
    const x = crystal ? p.x : ctx.tx, y = crystal ? p.y : ctx.ty;
    sim.singularities.push({
      x, y, owner: p.idx, t: t.pullDur, dur: t.pullDur,
      r: t.pullRadius + 0.5 * Math.max(0, p.stats.reach),
      pullSpd: t.pullSpd, burst: t.burstBase, vulnPct: t.vulnPct, vulnDur: t.vulnDur,
    });
    sim.addTelegraph({ shape: 'circle', x, y, r: t.pullRadius, dur: t.pullDur });
    return;
  }
  if (t.key === 'coral_growth') {
    p.tohAtk++;
    if (p.tohAtk % t.everyNth !== 0) return;
    // Hard cap on live nodes: they are world entities on every snapshot, and
    // an uncapped planter at high Tempo is both a perf and a bandwidth problem.
    if (sim.corals.length >= t.nodeCap) sim.corals.shift();
    sim.corals.push({
      x: ctx.tx, y: ctx.ty, owner: p.idx, t: t.nodeDur, dur: t.nodeDur,
      r: t.nodeRadius, slow: t.nodeSlowPct / 100, dps: t.nodeDps,
      link: t.linkRange, wallHp: t.wallHp,
    });
  }
}

// Damage about to land, before mitigation on the enemy. Returns the new number.
export function tohHitDamage(sim, p, e, dmg) {
  const t = p.char.trait;
  let out = dmg;
  if (t.key === 'karma' && p.karma > 0) {
    out += Math.round(p.karma * t.karmaPct);
    p.karma = 0;
  }
  if (t.key === 'three_stances') {
    if (p.stance === 0 && p.ironBank > 0) { out += Math.round(p.ironBank); p.ironBank = 0; }
    if (p.stance === 1 && !e.tohPrecisionHit) out = Math.round(out * (p.critMult || 2));
  }
  // Singularity vulnerability is a property of the ENEMY, so it applies to
  // every source including allies — that is the point of the trait.
  if (e.vulnT > 0) out = Math.round(out * (1 + (e.vulnPct || 0) / 100));
  return Math.max(1, out);
}

// After a hit resolved. `dmg` is what actually landed.
export function tohOnHit(sim, p, e, dmg, ctx) {
  const t = p.char.trait;
  switch (t.key) {
    case 'three_stances':
      if (p.stance === 1 && !e.tohPrecisionHit) {
        e.tohPrecisionHit = true;
        sim._applyBurn(e, Math.max(1, p.stats.ferocity * t.precisionBleedFerScale), t.precisionBleedDur, p);
      }
      if (p.stance === 2) {
        if (p.flowLast === e.id) p.flowStacks = 0;
        else if (p.flowStacks < t.flowMax) p.flowStacks++;
        p.flowLast = e.id;
        sim._recomputeStats(p);
      }
      break;
    case 'blood_dance':
      p.bloodHeat = Math.min(t.heatMax, p.bloodHeat + t.heatPer);
      p.bloodHeatT = t.heatDecaySec;
      sim._heal(p, dmg * t.leechPct);
      sim._recomputeStats(p);
      break;
    case 'voodoo_link': voodooMirror(sim, p, e, dmg, t, ctx); break;
    case 'karma': if (p.spirit) spiritEcho(sim, p, e, dmg, t); break;
  }
}

// 35% of everything you deal lands on the doll's target too. Mirrored damage
// carries a flag so it can never mirror again — one bounce, never a loop.
function voodooMirror(sim, p, e, dmg, t, ctx) {
  if (ctx && ctx.mirrored) return;
  const targets = [];
  const bound = p.voodooId !== null ? sim.enemyById(p.voodooId) : null;
  if (bound && bound !== e) targets.push(bound);
  if (p.stitch) for (const id of p.stitch.ids) { const q = sim.enemyById(id); if (q && q !== e) targets.push(q); }
  if (!targets.length) return;
  const share = Math.max(1, Math.round(dmg * t.mirrorPct));
  for (const q of targets) {
    if (q === bound) p.voodooDmg += share;
    sim.damageEnemy(q, share, { owner: p, mirrored: true, silent: true });
  }
}

function spiritEcho(sim, p, e, dmg, t) {
  const echo = Math.max(1, Math.round(dmg * t.spiritFactor));
  sim.damageEnemy(e, echo, { owner: p, spirit: true, silent: true });
  sim.fx.beams.push({ x1: p.spirit.x, y1: p.spirit.y, x2: e.x, y2: e.y, color: '#b993ff' });
}

// Damage taken, after Grit.
export function tohOnHurt(sim, p, raw, mitigated) {
  const t = p.char.trait;
  if (t.key === 'karma') p.karma = Math.min(t.karmaCap, p.karma + mitigated);
  if (t.key === 'three_stances' && p.stance === 0) {
    p.ironBank += Math.max(0, raw - mitigated) * t.ironRefundPct;
  }
  if (t.key === 'grace_and_judgment') return;   // shields handled in _heal path
}

export function tohOnDodge(sim, p) {
  const t = p.char.trait;
  if (t.key !== 'karma') return;
  // refresh rather than stack — two spirits would double the echo
  if (p.spirit) p.spirit.t = t.spiritDur;
  else p.spirit = { x: p.x, y: p.y, t: t.spiritDur, dur: t.spiritDur, regenAcc: 0 };
}

// Healing this player CAUSED — to anyone, including themselves.
export function tohOnHeal(sim, p, amt) {
  const t = p.char.trait;
  if (t.key !== 'grace_and_judgment' || amt <= 0) return;
  p.grace += amt;
  if (p.grace < t.graceThreshold) return;
  p.grace -= t.graceThreshold;
  const radius = t.targetRadius + 0.5 * Math.max(0, p.stats.reach);
  let target = p, worst = p.hp / Math.max(1, p.stats.vitality);
  for (const q of sim.livePlayers()) {
    if (q === p || q.downed) continue;
    if (D2(q.x, q.y, p.x, p.y) > radius * radius) continue;
    const frac = q.hp / Math.max(1, q.stats.vitality);
    if (frac < worst) { worst = frac; target = q; }
  }
  const shield = Math.round(t.shieldBase * (1 + Math.max(-80, p.stats.recovery) / 100 * t.shieldRecScale));
  target.shield += shield;
  target.shieldReflect = t.reflectPct;           // read by hurtPlayer
  const foe = sim._nearestEnemy(p.x, p.y, 900);
  if (foe) {
    sim.damageEnemy(foe, Math.max(1, Math.round(sim._attuned(p, shield))), { owner: p });
    sim.fx.beams.push({ x1: p.x, y1: p.y, x2: foe.x, y2: foe.y, color: '#ffd45e' });
  }
  sim.pushEvent({ k: 'sfx', s: 'buy' });
}

export function tohOnKill(sim, p, e) {
  const t = p.char.trait;
  if (t.key === 'contract') {
    p.vanishT = t.vanishDur;                     // every kill, not just the mark
    if (p.contractId !== null && e.id === p.contractId) {
      p.contractId = null;
      p.contractT = t.remarkDelay;
      p.contractsDone++;
      const pay = Math.round(t.payoutBase + Math.max(0, p.stats.greed) * t.payoutGreedScale);
      for (let i = 0; i < pay; i++) sim._dropMaterial(e.x + (sim.rng.float() * 30 - 15), e.y + (sim.rng.float() * 30 - 15));
      sim._recomputeStats(p);
      sim.pushEvent({ k: 'toast', idx: p.idx, text: `CONTRACT CLOSED — +${pay} ⟡, +${t.ferPerContract}% Ferocity` });
    }
  }
  if (t.key === 'voodoo_link' && p.voodooId !== null && e.id === p.voodooId) {
    // the link stitches outward, and the doll pays out what it absorbed
    const ids = [];
    for (const q of sim.enemyPool) {
      if (ids.length >= t.stitchTargets) break;
      if (D2(q.x, q.y, e.x, e.y) <= t.stitchRadius * t.stitchRadius) ids.push(q.id);
    }
    p.stitch = ids.length ? { ids, t: t.stitchDur } : null;
    if (p.voodooDmg > 0) sim._heal(p, p.voodooDmg * t.deathHealPct);
    p.voodooId = null; p.voodooDmg = 0;
  }
}

// ANY enemy died — the Necromancer's bone-dust does not care who killed it.
export function tohEnemyDied(sim, e) {
  for (const p of sim.livePlayers()) {
    if (!has(p, 'bonelord') || p.downed) continue;
    const t = p.char.trait;
    if (D2(e.x, e.y, p.x, p.y) > t.boneDustRadius * t.boneDustRadius) continue;
    let hurt = null, worst = 1;
    for (const s of sim.summons) {
      if (s.owner !== p.idx || s.dead) continue;
      const frac = s.hp / Math.max(1, s.maxHp);
      if (frac < worst) { worst = frac; hurt = s; }
    }
    if (hurt) {
      hurt.hp = Math.min(hurt.maxHp, hurt.hp + t.boneDustRepair);
      sim.fx.hits.push({ x: Math.round(hurt.x), y: Math.round(hurt.y - 20), a: t.boneDustRepair, c: 0 });
    }
  }
}

// ---------------------------------------------------------------- post-fight

// The Blacksmith's infusion choice reuses the boon overlay: three fixed
// options, not a randomised roll, offered the moment the room is won.
export const CRYSTALS = [
  { id: 'crystal_pyrite', key: 'pyrite', stat: 'grit', name: 'Iron Pyrite', rarity: 'uncommon' },
  { id: 'crystal_quartz', key: 'quartz', stat: 'attunement', name: 'Prism Quartz', rarity: 'rare' },
  { id: 'crystal_calcite', key: 'calcite', stat: 'recovery', name: 'Celestial Calcite', rarity: 'rare' },
];

export function tohClearFight(sim, p) {
  if (!has(p, 'crystal_infusion') || p.downed) return false;
  const t = p.char.trait;
  p.boonOffer = CRYSTALS.map(c => ({
    id: c.id, stat: c.stat, rarity: c.rarity, crystal: c.key, n: p.infusions[c.key] || 0,
    amount: c.key === 'pyrite' ? t.pyriteGrit : c.key === 'quartz' ? t.quartzAtt : t.calciteRec,
    // the panel needs these to say what an infusion actually does: it is
    // permanent on the spot, and quartz arms detonation every `every` picks
    name: c.name, every: c.key === 'quartz' ? t.detonateEvery : 0,
  }));
  sim.pushEvent({ k: 'boon', idx: p.idx, picks: p.boonOffer, crystal: true });
  return true;
}

// The pick coming back. Returns true if this module consumed it.
export function tohTakeBoon(sim, p, pick) {
  if (!has(p, 'crystal_infusion') || !pick || !pick.crystal) return false;
  const t = p.char.trait;
  p.infusions[pick.crystal] = (p.infusions[pick.crystal] || 0) + 1;
  if (pick.crystal === 'quartz' && p.infusions.quartz % t.detonateEvery === 0) {
    p.detonate = true;
    sim.pushEvent({ k: 'toast', idx: p.idx, text: 'The quartz sings — your touch detonates' });
  }
  sim._recomputeStats(p);
  return true;
}

// The Druid's fusion bonus, applied when a splice goes permanent.
export function tohBoonPermanent(sim, p) {
  if (!has(p, 'wildshape')) return;
  sim._applyPerm(p, { greed: p.char.trait.greedPerFusion });
  sim.pushEvent({ k: 'toast', idx: p.idx, text: `The shape sticks — +${p.char.trait.greedPerFusion} Greed` });
}

// ---------------------------------------------------------------- wire

export function tohSnapshot(sim) {
  const r = Math.round;
  if (!sim.corals.length && !sim.singularities.length && !sim.coralWalls.length) return null;
  return {
    coral: sim.corals.map(c => [r(c.x), r(c.y), r(c.r), +(c.t / c.dur).toFixed(2)]),
    walls: sim.coralWalls.map(wl => [r(wl.a.x), r(wl.a.y), r(wl.b.x), r(wl.b.y), +(wl.hp / wl.maxHp).toFixed(2)]),
    sing: sim.singularities.map(g => [r(g.x), r(g.y), r(g.r), +(g.t / g.dur).toFixed(2)]),
  };
}

// Per-player marks the renderer draws and the edge arrows track.
export function tohMarks(sim) {
  const out = [];
  for (const p of sim.players) {
    if (p.gone || !has(p, 'contract') || p.contractId === null) continue;
    const e = sim.enemyById(p.contractId);
    if (e) out.push([p.idx, Math.round(e.x), Math.round(e.y)]);
  }
  for (const p of sim.players) {
    if (p.gone || !has(p, 'voodoo_link') || p.voodooId === null) continue;
    const e = sim.enemyById(p.voodooId);
    if (e) out.push([p.idx, Math.round(e.x), Math.round(e.y), 1]); // 1 = doll tether
  }
  return out;
}

// The 0..1 HUD bar. -1 hides it.
export function tohMeter(sim, p) {
  const t = p.char.trait;
  switch (t.key) {
    case 'rhythm': return p.rhythm / t.maxStacks;
    case 'karma': return p.karma / t.karmaCap;
    case 'blood_dance': return p.bloodHeat / t.heatMax;
    case 'grace_and_judgment': return p.grace / t.graceThreshold;
    case 'decree': return 1 - clamp(p.decreeT / t.intervalSec, 0, 1);
    case 'singularity': return (p.tohAtk % t.everyNth) / t.everyNth;
    case 'coral_growth': return (p.tohAtk % t.everyNth) / t.everyNth;
    case 'three_stances': return p.stance === 2 ? p.flowStacks / t.flowMax : -1;
    default: return -1;
  }
}

// One small integer of trait state, meaning defined per trait. Rides the player
// row so a client's HUD can show stance / stacks / mode without a second
// channel: Samurai stance (0-2), Bard stacks, Samurai flow, Assassin contracts
// closed, Hunter pack mode, Blacksmith total infusions.
export function tohState(sim, p) {
  const t = p.char.trait;
  switch (t.key) {
    case 'three_stances': return p.stance;
    case 'rhythm': return p.rhythm;
    case 'contract': return p.contractsDone;
    case 'pack_tactics': return p.packMode;
    case 'crystal_infusion':
      return (p.infusions.pyrite || 0) + (p.infusions.quartz || 0) + (p.infusions.calcite || 0)
        + (p.detonate ? 100 : 0);
    default: return 0;
  }
}

export const TOH_STANCE_NAMES = ['IRON', 'PRECISION', 'FLOW'];

// The stance swap, from the keyboard or the touch button.
export function tohSwapStance(sim, p) {
  if (!has(p, 'three_stances') || p.stanceCd > 0) return false;
  const t = p.char.trait;
  p.stance = (p.stance + 1) % 3;
  p.stanceCd = t.swapCooldown;
  p.flowStacks = 0; p.flowLast = -1; p.ironBank = 0;
  sim._recomputeStats(p);
  sim.pushEvent({ k: 'toast', idx: p.idx, text: TOH_STANCE_NAMES[p.stance] });
  sim.pushEvent({ k: 'sfx', s: 'click' });
  return true;
}
