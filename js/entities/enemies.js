// Enemy behavior implementations, keyed by def.behavior. Each runs on the host
// sim only. Enemies use sim helper methods for movement, projectiles,
// telegraphs and damage so behaviors stay declarative.

import { dist, dist2, angleTo, clamp } from '../util.js';
import { telegraphBusy } from '../telegraphs.js';

// The gyre's stoop, named rather than inlined: the telegraph's length has to be
// derived from the same two numbers the dive uses, or the warning stops
// matching the attack the first time either is tuned.
const GYRE_DIVE_DUR = 0.55;
const GYRE_DIVE_MULT = 2.6;

// wave-end rush: dash THROUGH the player's position and overshoot — the
// fight ends in chaos, not a queue politely settling at melee range.
// Stall detection re-rolls the waypoint randomly: an enemy wedged in a
// concave wall pocket (there is no pathfinding) escapes stochastically
// instead of grinding into the wall forever — with line of sight live,
// a wall-stuck straggler would otherwise make the fight unfinishable.
function rushMove(sim, e, p, spd, dt) {
  e.stuckT = (e.stuckT || 0) + dt;
  if (e.stuckT >= 1.2) {
    const moved = dist2(e.x, e.y, e.stuckX || 0, e.stuckY || 0);
    e.stuckX = e.x; e.stuckY = e.y; e.stuckT = 0;
    if (moved < 24 * 24) { // barely moved: detour somewhere open at random
      const a = sim.rng.float() * Math.PI * 2;
      e.rushX = clamp(e.x + Math.cos(a) * 420, 40, sim.W - 40);
      e.rushY = clamp(e.y + Math.sin(a) * 420, 40, sim.H - 40);
      e.rushSet = true;
    }
  }
  if (!e.rushSet || dist2(e.x, e.y, e.rushX, e.rushY) < 40 * 40) {
    const a = angleTo(e.x, e.y, p.x, p.y);
    e.rushX = clamp(p.x + Math.cos(a) * 240, 40, sim.W - 40);
    e.rushY = clamp(p.y + Math.sin(a) * 240, 40, sim.H - 40);
    e.rushSet = true;
  }
  sim.walk(e, e.rushX, e.rushY, spd * 1.3, dt);
}

export function updateEnemy(sim, e, dt) {
  // status effects
  if (e.burnT > 0) {
    e.burnT -= dt;
    e.burnAcc = (e.burnAcc || 0) + e.burnDps * dt;
    if (e.burnAcc >= 1) {
      const d = Math.floor(e.burnAcc);
      e.burnAcc -= d;
      sim.damageEnemy(e, d, { silent: true, owner: e.burnOwner, noEffects: true });
      if (!e.active) return;
    }
  }
  let spd = e.spd;
  // Elite Arena's Enrager: the longer it lives, the faster it comes. Ramps
  // off its own base so slows still bite, and caps at 2.6x so a long fight
  // stays kiteable rather than becoming a coin flip.
  if (e.enrageRate) {
    e.enrage = Math.min(1.6, (e.enrage || 0) + e.enrageRate * dt);
    spd = e.spd * (1 + e.enrage);
  }
  if (e.slowT > 0) { e.slowT -= dt; spd *= e.slowMult; }
  if (e.hitFlash > 0) e.hitFlash -= dt;
  // elite mod ticks
  if (e.eliteMod) {
    // Regeneration is throttled for regenLockS seconds after the last hit.
    // Without that, regen scales with the target's own max HP while player
    // damage does not, so any high-HP elite crosses a threshold beyond which it
    // heals faster than the party can hurt it — measured at 135-151 HP/s on a
    // solo Bounty Hunt mark against 105-110 HP/s landed. That is not a tough
    // fight, it is an unwinnable one, and no amount of extra time fixes it.
    if (e.regenLock > 0) e.regenLock -= dt;
    if (e.eliteMod.regenPct && e.hp < e.maxHp) {
      const throttle = e.regenLock > 0 ? (e.eliteMod.regenLockMult ?? 0) : 1;
      if (throttle > 0) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.eliteMod.regenPct * throttle * dt);
    }
    if (e.eliteMod.blockCd) e.blockT = Math.max(0, (e.blockT || 0) - dt);
    if (e.eliteMod.pullR) {
      for (const p of sim.players) {
        if (p.downed || p.gone) continue; // Grit-based pull resist applies in _tickPlayer; Immovable ignores it entirely
        const d = dist(e.x, e.y, p.x, p.y);
        if (d < e.eliteMod.pullR && d > 10) {
          const a = angleTo(p.x, p.y, e.x, e.y);
          p.pullX = (p.pullX || 0) + Math.cos(a) * e.eliteMod.pullSpd;
          p.pullY = (p.pullY || 0) + Math.sin(a) * e.eliteMod.pullSpd;
        }
      }
    }
  }
  // knockback decay
  if (e.knockX || e.knockY) {
    e.x += e.knockX * dt; e.y += e.knockY * dt;
    e.knockX *= Math.pow(0.0001, dt); e.knockY *= Math.pow(0.0001, dt);
    if (Math.abs(e.knockX) < 5) e.knockX = 0;
    if (Math.abs(e.knockY) < 5) e.knockY = 0;
    sim.clampToRoom(e);
  }
  if (e.boss) {
    // The commit rule is not a mob rule. A boss winding up must not step and
    // must not reaim either — bosses reach updateBoss before the check below,
    // so it is repeated here rather than inherited.
    if (telegraphBusy(e)) return;
    updateBoss(sim, e, dt, spd);
    return;
  }

  // Skill statuses that stop a body moving. Stun halts everything; root allows
  // attacks but not movement, so it is checked inside the movement helpers'
  // caller rather than here.
  if (e.stunT > 0) return;

  // COMMITTED. During a wind-up the enemy runs no behaviour at all: it does not
  // step, and — the part that matters — it does not reaim. The zone was fixed
  // at commit and the body must not drift toward you afterwards, or the attack
  // is undodgeable and the patch is pointless.
  //
  // Whether the RECOVERY also freezes is a per-enemy dial (`recoverFrozen`);
  // telegraphBusy owns that decision. See js/telegraphs.js.
  if (telegraphBusy(e)) return;

  const t = e.def;
  const p = sim.tauntTarget(e.x, e.y, e);
  // once the fight's spawning stops, survivors press the attack instead of
  // kiting — the field must be cleared to end the fight, so nobody hides
  const rush = sim.wave && sim.wave.done;
  e.t += dt;

  // artillery (pressure-profile variant): a mortar Lobber lobs telegraphed
  // shells at the target's CURRENT position — shells land where you WERE,
  // so stillness is the one behavior it punishes. Shells arc over walls.
  if (e.mortar) {
    const M = t.mortar || { cd: 3.4, dmg: 8, radius: 62, windup: 1.35, range: 950 };
    if (p) {
      if (rush) rushMove(sim, e, p, spd, dt);
      else {
        const d0 = dist(e.x, e.y, p.x, p.y);
        if (d0 < 340) sim.walk(e, e.x * 2 - p.x, e.y * 2 - p.y, spd, dt);
        else if (d0 > 640) sim.walk(e, p.x, p.y, spd, dt);
      }
      e.fireT -= dt;
      if (e.fireT <= 0 && dist(e.x, e.y, p.x, p.y) < M.range) {
        e.fireT = M.cd * (0.85 + sim.rng.float() * 0.3);
        sim.addTelegraph({
          shape: 'circle', x: p.x, y: p.y, r: M.radius, dur: M.windup,
          boom: { dmg: Math.round(M.dmg * e.dmgScale), radius: M.radius },
        });
      }
    }
    return;
  }

  switch (t.behavior) {
    case 'pylon': break; // the siege's ward pylon just stands there, humming
    case 'chaser': {
      if (p) { if (rush) rushMove(sim, e, p, spd, dt); else sim.walk(e, p.x, p.y, spd, dt); }
      break;
    }
    case 'sprinter': {
      if (p) {
        if (rush) { rushMove(sim, e, p, spd, dt); break; }
        // weave: sine offset perpendicular to approach.
        //
        // Expressed as a WAYPOINT rather than a raw heading so it goes through
        // `sim.walk` — and therefore through the wall-aware mover — like every
        // other closer. Calling `walkAngle` directly is what left the sprinter
        // out: traced against a 70x317 pillar it pinned itself at 167 units
        // and oscillated in place for the full 40s, because the weave walked
        // it into the face and nothing steered it round. The heading is
        // identical when nothing is in the way (angleTo(e, waypoint) is a+wob
        // by construction), so the weave itself is unchanged.
        const a = angleTo(e.x, e.y, p.x, p.y);
        const wob = Math.sin(e.t * 6 + e.id) * 0.7;
        const reach = Math.max(80, dist(e.x, e.y, p.x, p.y));
        sim.walk(e, e.x + Math.cos(a + wob) * reach, e.y + Math.sin(a + wob) * reach, spd, dt);
      }
      break;
    }
    case 'brute': {
      if (p) { if (rush) rushMove(sim, e, p, spd, dt); else sim.walk(e, p.x, p.y, spd, dt); }
      break;
    }
    case 'spitter': {
      if (!p) break;
      const d = dist(e.x, e.y, p.x, p.y);
      const blocked = sim.losBlocked(e.x, e.y, p.x, p.y);
      if (rush) rushMove(sim, e, p, spd, dt);
      else if (blocked) sim.walk(e, p.x, p.y, spd, dt); // drift toward line of sight
      else if (d < t.keepDist - 30) sim.walk(e, e.x * 2 - p.x, e.y * 2 - p.y, spd, dt);
      else if (d > t.keepDist + 40) sim.walk(e, p.x, p.y, spd, dt);
      e.fireT = (e.fireT || 0) - dt;
      if (e.fireT <= 0 && d < 520) {
        // an occasional shot into the wall is fine (cover WORKING is the
        // point) — but mostly they hold fire and reposition
        if (blocked && sim.rng.float() > 0.25) { e.fireT = t.fireCd * 0.35; break; }
        e.fireT = t.fireCd * (0.8 + sim.rng.float() * 0.4);
        const a = angleTo(e.x, e.y, p.x, p.y);
        sim.spawnEnemyProj(e.x, e.y, a, t.proj.speed, Math.round(t.proj.dmg * e.dmgScale), t.proj.radius, e.def.color);
      }
      break;
    }
    case 'orbiter': {
      // Phases follow the dasher's convention: 1 winding, 2 committed.
      //
      // The windup is new. The dive used to fire on the same tick it was
      // decided — 416 u/s arriving with no warning, the only attack on floor 1
      // with none. A wings-back pose alone could not fix that: it would appear
      // simultaneously with the attack it was meant to announce, which is a
      // state, not a telegraph. A telegraph has to occupy time BEFORE the
      // commitment, so the stoop now costs `diveWindup` seconds first.
      if (!p) break;
      if (e.phase === 1) { // winding up: aimed, wings back, not yet moving
        e.windT -= dt;
        if (e.windT <= 0) {
          e.phase = 2; e.diveT = GYRE_DIVE_DUR;
          e.vx = Math.cos(e.aimA) * spd * GYRE_DIVE_MULT;
          e.vy = Math.sin(e.aimA) * spd * GYRE_DIVE_MULT;
        }
      } else if (e.phase === 2) { // diving
        e.x += e.vx * dt; e.y += e.vy * dt;
        sim.clampToRoom(e);
        e.diveT -= dt;
        if (e.diveT <= 0) e.phase = 0;
      } else {
        if (rush) { rushMove(sim, e, p, spd, dt); break; }
        e.orbitA = (e.orbitA ?? sim.rng.float() * 6.28) + dt * 1.4;
        const tx = p.x + Math.cos(e.orbitA) * t.orbitR;
        const ty = p.y + Math.sin(e.orbitA) * t.orbitR;
        sim.walk(e, tx, ty, spd, dt);
        e.diveCd = (e.diveCd ?? t.diveCd) - dt;
        if (e.diveCd <= 0 && dist(e.x, e.y, p.x, p.y) < t.orbitR * 1.5) {
          e.diveCd = t.diveCd * (0.8 + sim.rng.float() * 0.5);
          e.phase = 1; e.windT = t.diveWindup;
          // Aim LOCKS here and does not track (no followAim, unlike the
          // dasher). A stoop commits — that is what makes sidestepping it a
          // real answer rather than a delay.
          e.aimA = angleTo(e.x, e.y, p.x, p.y);
          sim.addTelegraph({
            shape: 'beam', x: e.x, y: e.y, angle: e.aimA, w: e.radius * 2,
            len: spd * GYRE_DIVE_MULT * GYRE_DIVE_DUR + 60, dur: t.diveWindup, follow: e,
          });
        }
      }
      break;
    }
    case 'splitter': {
      if (p) { if (rush) rushMove(sim, e, p, spd, dt); else sim.walk(e, p.x, p.y, spd, dt); }
      break; // split handled on death in sim
    }
    case 'bomber': {
      if (e.fusing) {
        e.fuseT -= dt;
        if (e.fuseT <= 0) sim.explodeEnemy(e, t.boom);
        break;
      }
      if (p) {
        sim.walk(e, p.x, p.y, spd, dt);
        if (dist(e.x, e.y, p.x, p.y) < t.triggerDist) {
          e.fusing = true; e.fuseT = t.boom.fuse;
          sim.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: t.boom.radius, dur: t.boom.fuse, follow: e });
        }
      }
      break;
    }
    case 'warden': {
      // slow advance; aura applied in sim.damageEnemy via shieldedBy scan
      if (p) sim.walk(e, p.x, p.y, spd, dt);
      break;
    }
    case 'medic': {
      // find hurt ally to heal, else keep distance from players
      e.healScanT = (e.healScanT || 0) - dt;
      if (e.healScanT <= 0) {
        e.healScanT = 0.5;
        e.healTarget = null;
        let best = 0;
        for (const o of sim.enemyPool) {
          if (o === e || o.boss) continue;
          const missing = o.maxHp - o.hp;
          if (missing > best && dist2(e.x, e.y, o.x, o.y) < 600 * 600) { best = missing; e.healTarget = o; }
        }
      }
      const ht = e.healTarget;
      if (ht && ht.active && ht.hp < ht.maxHp) {
        const d = dist(e.x, e.y, ht.x, ht.y);
        if (d > t.healR * 0.8) sim.walk(e, ht.x, ht.y, spd, dt);
        else {
          ht.hp = Math.min(ht.maxHp, ht.hp + t.healPs * dt * e.dmgScale);
          e.healing = ht.id;
        }
      } else if (p) {
        e.healing = 0;
        const d = dist(e.x, e.y, p.x, p.y);
        if (rush) rushMove(sim, e, p, spd, dt);
        else if (d < 300) sim.walk(e, e.x * 2 - p.x, e.y * 2 - p.y, spd, dt);
      }
      break;
    }
    case 'nest': {
      // spawnCdMult lets an objective retune a nest's output (Nest Purge runs
      // its walled nests at 3x rate); the cooldown is the per-nest spawn rate.
      const cd = t.spawnCd * (e.spawnCdMult || 1);
      e.spawnT = (e.spawnT ?? cd * 0.5) - dt;
      e.brood = e.brood || [];
      e.brood = e.brood.filter(id => sim.enemyById(id));
      if (e.spawnT <= 0 && e.brood.length < (e.maxBroodCap || t.maxBrood) && sim.enemyPool.count < 300) {
        e.spawnT = cd;
        const child = sim.spawnEnemyById(t.broodId, e.x + (sim.rng.float() * 40 - 20), e.y + (sim.rng.float() * 40 - 20), { noMats: true });
        if (child) e.brood.push(child.id);
      }
      break;
    }
    case 'dasher': {
      const D = t.dash;
      if (e.phase === 1) { // winding up
        e.windT -= dt;
        if (e.windT <= 0) {
          e.phase = 2; e.dashT = D.dur;
          e.vx = Math.cos(e.aimA) * D.speed; e.vy = Math.sin(e.aimA) * D.speed;
        }
      } else if (e.phase === 2) { // dashing
        e.x += e.vx * dt; e.y += e.vy * dt;
        sim.clampToRoom(e);
        e.dashT -= dt;
        if (e.dashT <= 0) { e.phase = 0; e.dashCd = D.cd * (0.8 + sim.rng.float() * 0.4); }
      } else {
        if (p) { if (rush) rushMove(sim, e, p, spd, dt); else sim.walk(e, p.x, p.y, spd * 0.9, dt); }
        e.dashCd = (e.dashCd ?? D.cd * sim.rng.float()) - dt;
        if (e.dashCd <= 0 && p && dist(e.x, e.y, p.x, p.y) < 420) {
          e.phase = 1; e.windT = D.windup;
          e.aimA = angleTo(e.x, e.y, p.x, p.y);
          // followAim REMOVED. The lancerfish carries a committed telegraph in
          // js/telegraphs.js AND this dash, and a tracking dash in the same body
          // undermined the committed one: the player learns that this enemy's
          // wind-ups can be dodged, then eats a lunge that followed them. Both
          // of its attacks now promise a piece of ground at commit.
          sim.addTelegraph({ shape: 'beam', x: e.x, y: e.y, angle: e.aimA, w: e.radius * 2, len: D.speed * D.dur + 60, dur: D.windup, follow: e });
        }
      }
      break;
    }
    case 'sniper': {
      const B = t.beam;
      if (e.phase === 1) {
        e.windT -= dt;
        // track slowly while winding
        if (p) {
          const want = angleTo(e.x, e.y, p.x, p.y);
          let d = want - e.aimA;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          e.aimA += clamp(d, -0.5 * dt, 0.5 * dt);
        }
        if (e.windT <= 0) {
          e.phase = 0; e.fireCd = B.cd * (0.85 + sim.rng.float() * 0.3);
          sim.fireBeam(e.x, e.y, e.aimA, B.len, B.width, Math.round(B.dmg * e.dmgScale), e);
        }
      } else {
        if (p) {
          const d = dist(e.x, e.y, p.x, p.y);
          if (rush) rushMove(sim, e, p, spd, dt);
          else if (d < 260) sim.walk(e, e.x * 2 - p.x, e.y * 2 - p.y, spd, dt);
          else sim.walk(e, p.x, p.y, spd * 0.5, dt);
        }
        e.fireCd = (e.fireCd ?? B.cd * sim.rng.float()) - dt;
        if (e.fireCd <= 0 && p) {
          // snipers lock on faster against stationary targets
          e.phase = 1; e.windT = B.windup * (p.stillT > 0.8 ? 0.55 : 1);
          e.aimA = angleTo(e.x, e.y, p.x, p.y);
          sim.addTelegraph({ shape: 'beam', x: e.x, y: e.y, angle: e.aimA, w: B.width, len: B.len, dur: e.windT, follow: e, followAim: true });
        }
      }
      break;
    }
  }
}

// ---------------- Bosses ----------------
// Two phases each; phase 2 below 50% HP. All heavy attacks are telegraphed.

function updateBoss(sim, e, dt, spd) {
  const b = e.bossDef;
  const s = e.bs; // boss state bag
  const p = sim.tauntTarget(e.x, e.y, e);
  const p2 = e.hp < e.maxHp * 0.5;
  if (p2 && !s.phase2) {
    s.phase2 = true;
    sim.pushEvent({ k: 'bossPhase' });
    sim.fx.booms.push({ x: e.x, y: e.y, r: 140 });
  }
  const mult = s.phase2 && b.p2.spdMult ? b.p2.spdMult : 1;
  e.t += dt;
  s.busyT = Math.max(0, (s.busyT || 0) - dt);

  switch (b.kit) {
    case 'hulk': {
      if (s.charging) {
        e.x += e.vx * dt; e.y += e.vy * dt;
        sim.clampToRoom(e);
        s.chargeT -= dt;
        for (const pl of sim.players) {
          if (!pl.downed && dist(e.x, e.y, pl.x, pl.y) < e.radius + pl.radius + 6) sim.hurtPlayer(pl, b.charge.dmg * e.dmgScale, e);
        }
        if (s.chargeT <= 0) s.charging = false;
        return;
      }
      if (p && !s.busyT) sim.walk(e, p.x, p.y, spd * mult, dt);
      s.slamCd = (s.slamCd ?? 2) - dt;
      s.chargeCd = (s.chargeCd ?? 4) - dt;
      if (s.slamCd <= 0 && p && dist(e.x, e.y, p.x, p.y) < 340) {
        s.slamCd = b.slam.cd; s.busyT = b.slam.windup;
        sim.addTelegraph({ shape: 'circle', x: p.x, y: p.y, r: b.slam.radius, dur: b.slam.windup, boom: { dmg: b.slam.dmg * e.dmgScale, radius: b.slam.radius } });
      } else if (s.chargeCd <= 0 && p) {
        s.chargeCd = b.charge.cd; s.busyT = b.charge.windup;
        const a = angleTo(e.x, e.y, p.x, p.y);
        sim.addTelegraph({ shape: 'beam', x: e.x, y: e.y, angle: a, w: b.charge.width, len: 900, dur: b.charge.windup, follow: e,
          onFire: () => { s.charging = true; s.chargeT = 0.9; e.vx = Math.cos(a) * b.charge.speed; e.vy = Math.sin(a) * b.charge.speed; } });
      }
      if (s.phase2) {
        s.addCd = (s.addCd ?? b.p2.addCd) - dt;
        if (s.addCd <= 0) {
          s.addCd = b.p2.addCd;
          for (let i = 0; i < b.p2.addCount; i++) sim.spawnEnemyById(b.p2.addId, e.x + Math.cos(i * 2.1) * 70, e.y + Math.sin(i * 2.1) * 70, { noMats: true });
        }
      }
      break;
    }
    case 'choir': {
      if (p) {
        const d = dist(e.x, e.y, p.x, p.y);
        if (d < 240) sim.walk(e, e.x * 2 - p.x, e.y * 2 - p.y, spd * mult, dt);
        else if (d > 420) sim.walk(e, p.x, p.y, spd * mult, dt);
        else sim.walkAngle(e, angleTo(p.x, p.y, e.x, e.y) + Math.PI / 2, spd * 0.7 * mult, dt);
      }
      s.ringCd = (s.ringCd ?? 2) - dt;
      s.volleyCd = (s.volleyCd ?? 1) - dt;
      if (s.ringCd <= 0) {
        s.ringCd = b.ring.cd;
        for (let i = 0; i < b.ring.count; i++) {
          const a = (i / b.ring.count) * Math.PI * 2 + e.t;
          sim.spawnEnemyProj(e.x, e.y, a, b.ring.speed, Math.round(b.ring.dmg * e.dmgScale), 7, b.color);
        }
      }
      if (s.volleyCd <= 0 && p) {
        s.volleyCd = b.volley.cd;
        const base = angleTo(e.x, e.y, p.x, p.y);
        for (let i = 0; i < b.volley.count; i++) {
          const a = base + ((i - (b.volley.count - 1) / 2) * b.volley.spreadDeg * Math.PI / 180) / (b.volley.count - 1) * 2;
          sim.spawnEnemyProj(e.x, e.y, a, b.volley.speed, Math.round(b.volley.dmg * e.dmgScale), 6, b.color);
        }
      }
      if (s.phase2) {
        s.spiralT = (s.spiralT || 0) - dt;
        if (s.spiralT <= 0) {
          s.spiralT = b.p2.spiral.rate;
          s.spiralA = (s.spiralA || 0) + 0.6;
          sim.spawnEnemyProj(e.x, e.y, s.spiralA, b.p2.spiral.speed, Math.round(b.p2.spiral.dmg * e.dmgScale), 6, '#ff7ad9');
        }
        s.addCd = (s.addCd ?? b.p2.addCd) - dt;
        if (s.addCd <= 0) {
          s.addCd = b.p2.addCd;
          for (let i = 0; i < b.p2.addCount; i++) sim.spawnEnemyById(b.p2.addId, e.x + Math.cos(i * 3) * 80, e.y + Math.sin(i * 3) * 80, { noMats: true });
        }
      }
      break;
    }
    case 'brood': {
      if (p) sim.walk(e, p.x, p.y, spd * mult * 0.8, dt);
      const spawnCd = s.phase2 ? b.p2.spawnCd : b.spawn.cd;
      s.spawnCd = (s.spawnCd ?? 2) - dt;
      if (s.spawnCd <= 0) {
        s.spawnCd = spawnCd;
        for (let i = 0; i < b.spawn.count; i++) {
          const id = b.spawn.ids[i % b.spawn.ids.length];
          sim.spawnEnemyById(id, e.x + Math.cos(i * 2.3) * 60, e.y + Math.sin(i * 2.3) * 60, { noMats: true });
        }
      }
      s.vortexCd = (s.vortexCd ?? 4) - dt;
      if (s.vortexCd <= 0 && p) {
        s.vortexCd = b.vortex.cd;
        const vx = p.x, vy = p.y;
        sim.addTelegraph({ shape: 'circle', x: vx, y: vy, r: b.vortex.coreR, dur: b.vortex.windup,
          onFire: () => sim.addVortex(vx, vy, b.vortex, e.dmgScale) });
      }
      s.poolCd = (s.poolCd ?? 3) - dt;
      if (s.poolCd <= 0) {
        s.poolCd = b.pools.cd;
        for (let i = 0; i < b.pools.count; i++) {
          const px = 80 + sim.rng.float() * (sim.W - 160), py = 80 + sim.rng.float() * (sim.H - 160);
          sim.addTelegraph({ shape: 'circle', x: px, y: py, r: b.pools.radius, dur: b.pools.windup,
            onFire: () => sim.addZone({ x: px, y: py, r: b.pools.radius, dps: b.pools.dps * e.dmgScale, dur: b.pools.dur, hurts: 'players', color: '#ff7b3a' }) });
        }
      }
      break;
    }
    case 'regent': {
      if (s.beamT > 0) {
        s.beamT -= dt;
        s.beamA += b.beams.spin * dt;
        for (let i = 0; i < b.beams.count; i++) {
          const a = s.beamA + (i / b.beams.count) * Math.PI * 2;
          sim.beamDamageTick(e.x, e.y, a, 900, b.beams.width, b.beams.dmg * e.dmgScale, dt);
        }
      } else if (p && !s.busyT) sim.walk(e, p.x, p.y, spd * mult * 0.7, dt);
      s.beamCd = (s.beamCd ?? 5) - dt;
      s.burstCd = (s.burstCd ?? 2) - dt;
      s.slamCd = (s.slamCd ?? 3) - dt;
      if (s.beamCd <= 0 && s.beamT <= 0) {
        s.beamCd = b.beams.cd; s.busyT = b.beams.windup;
        const startA = sim.rng.float() * Math.PI * 2;
        for (let i = 0; i < b.beams.count; i++) {
          sim.addTelegraph({ shape: 'beam', x: e.x, y: e.y, angle: startA + (i / b.beams.count) * Math.PI * 2, w: b.beams.width, len: 900, dur: b.beams.windup, follow: e });
        }
        s.pendingBeam = startA;
        sim.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: e.radius + 20, dur: b.beams.windup, follow: e,
          onFire: () => { s.beamT = b.beams.dur; s.beamA = s.pendingBeam; } });
      }
      const burstCd = s.phase2 ? b.p2.burstCd : b.burst.cd;
      if (s.burstCd <= 0) {
        s.burstCd = burstCd;
        for (let i = 0; i < b.burst.count; i++) {
          const a = (i / b.burst.count) * Math.PI * 2 + e.t * 0.7;
          sim.spawnEnemyProj(e.x, e.y, a, b.burst.speed, Math.round(b.burst.dmg * e.dmgScale), 7, b.color);
        }
      }
      if (s.slamCd <= 0 && p && dist(e.x, e.y, p.x, p.y) < 320) {
        s.slamCd = b.slam.cd; s.busyT = b.slam.windup;
        sim.addTelegraph({ shape: 'circle', x: p.x, y: p.y, r: b.slam.radius, dur: b.slam.windup, boom: { dmg: b.slam.dmg * e.dmgScale, radius: b.slam.radius } });
      }
      if (s.phase2) {
        s.addCd = (s.addCd ?? b.p2.addCd) - dt;
        if (s.addCd <= 0) {
          s.addCd = b.p2.addCd;
          for (let i = 0; i < b.p2.addCount; i++) sim.spawnEnemyById(b.p2.addId, e.x + Math.cos(i * 2.6) * 90, e.y + Math.sin(i * 2.6) * 90, { noMats: true });
        }
      }
      break;
    }

    // THE REGION BOSSES. Both of them declared `telegraph` and `p2` and no
    // `kit`, and this switch had no default — so The Cedar Mother matched no
    // case, ran no code, and stood exactly where it spawned. Measured before
    // the fix: parked a player 700 units away for 60 seconds and the boss
    // travelled 0 units, spent 0 frames winding up and dealt 0 damage. It was
    // not "beatable from out of reach"; it was beatable from anywhere, by
    // anything, because it was inert.
    //
    // Two halves, and the second is the one the defect is actually about.
    //
    // THE COMMITTED ZONE is now driven by `tickTelegraphs` (see telegraphOf) —
    // the authored circle, and the cone it becomes at half HP. That threatens
    // a player who comes into reach and nobody else.
    //
    // THE CHARGE is what threatens a player who does not. A boss that only
    // walks cannot answer kiting: at 58 u/s it never closes on anyone, so
    // standing at range was a winning strategy no matter how hard the slam
    // hit. The charge commits to a LANE — the bearing is taken once, when the
    // beam appears, and the boss travels that same fixed bearing when it
    // fires. It does not steer, it does not re-home, and a player who moves
    // off the line is not hit. That is region 1's own lesson (read the zone,
    // leave the zone) asked at a distance instead of in melee, which is the
    // only way to threaten a kiter without breaking the rule the whole
    // telegraph system exists to enforce.
    default: {
      const c = b.charge;
      if (s.charging) {
        e.x += e.vx * dt; e.y += e.vy * dt;
        sim.clampToRoom(e);
        s.chargeT -= dt;
        for (const pl of sim.players) {
          if (pl.downed || pl.gone) continue;
          if (dist(e.x, e.y, pl.x, pl.y) < e.radius + pl.radius + 6) sim.hurtPlayer(pl, c.dmg * e.dmgScale, e);
        }
        if (s.chargeT <= 0) s.charging = false;
        return;
      }
      if (!c) { if (p && !s.busyT) sim.walk(e, p.x, p.y, spd * mult, dt); break; }
      const cd = (s.phase2 && b.p2 && b.p2.chargeCd) ? b.p2.chargeCd : c.cd;
      s.chargeCd = (s.chargeCd ?? cd * 0.6) - dt;
      // Only worth committing a lane at someone out past melee — inside that,
      // the slam is the right answer and a charge would be a second way to do
      // the same job.
      if (s.chargeCd <= 0 && p && dist(e.x, e.y, p.x, p.y) > c.minDist) {
        s.chargeCd = cd; s.busyT = c.windup;
        const a = angleTo(e.x, e.y, p.x, p.y);   // FIXED HERE. Never read again.
        sim.addTelegraph({
          shape: 'beam', x: e.x, y: e.y, angle: a, w: c.width, len: c.speed * c.dur + 60,
          dur: c.windup, follow: e,
          onFire: () => { s.charging = true; s.chargeT = c.dur; e.vx = Math.cos(a) * c.speed; e.vy = Math.sin(a) * c.speed; },
        });
        break;
      }
      if (p && !s.busyT) sim.walk(e, p.x, p.y, spd * mult, dt);
      break;
    }
  }
}
