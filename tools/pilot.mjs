// THE PILOT — one bot that can actually finish a room, shared.
//
// Lifted VERBATIM out of tools/balance_probe.mjs and parameterised on
// (sim, player) so two tools cannot drift into two different ideas of how a
// room is played. It was the only driver in the repo that steers all eight
// objective kinds — zone, storm, breach, payload, relic, nest, bounty and the
// plain elite arena — and `run_continuity` needs every one of them, because a
// region route runs through whichever the generator rolled.
//
// It kites at ring distance, avoids walls and obstacles, dodges telegraphs,
// contests the hold circle, and sweeps pickups once spawning stops. It is a
// "mediocre human", not an optimum: numbers taken through it are a FLOOR.
//
// `driveEngage` in fixture_build.mjs is the other driver and stays: it is a
// deliberately dumb advance-and-hold used where the measurement wants no
// tactical skill in it at all. This one is used where a room has to be
// FINISHED.
import { dist2 } from '../js/util.js';
import { SKILL_BY_ID } from '../js/skills.js';

// KITE AT A DISTANCE THE KIT CAN ACTUALLY REACH.
//
// This read `p.weapons[0]` and fell through to a flat 200 for everyone, because
// weapons were retired and `p.weapons` has been empty on every character since.
// A samurai whose skills reach 90-110 was therefore piloted at 200 and landed
// nothing: measured, it sat on an elite arena with one enemy alive for 500
// simulated seconds. §13 rule 81 — the rule that only ran inside a removed
// subsystem left with it, and nothing failed loudly.
//
// Derived from the LOADOUT now, which is where reach lives today. Cached on the
// player and rebuilt when the loadout changes, because this runs every tick.
function kiteRing(p, mopUp) {
  const key = (p.loadout || []).filter(Boolean).join('|');
  if (p._ringKey !== key) {
    p._ringKey = key;
    let reach = 0;
    for (const id of (p.loadout || []).filter(Boolean)) {
      const sk = SKILL_BY_ID[id];
      if (!sk) continue;
      for (const c of (sk.compose || [])) {
        reach = Math.max(reach, c.reach ?? 0, c.range ?? 0, c.length ?? 0);
      }
    }
    p._ringReach = reach;
  }
  const reach = p._ringReach || 0;
  if (!reach) return 200;                       // nothing slotted yet: the old default
  // stand INSIDE the kit's reach with margin, and close further to mop up
  return mopUp ? Math.max(60, reach * 0.5) : Math.max(70, reach * 0.72);
}

export function steerTo(sim, p, x, y) {
  const d = Math.hypot(x - p.x, y - p.y) || 1;
  sim.setInput(0, { mx: (x - p.x) / d, my: (y - p.y) / d });
}

// WALKING AT A POINT IS NOT REACHING IT. `steerTo` pushes straight at the
// target and a straight line can end in a wall: measured, a bot cleared an
// elite arena, was handed a hatch 148px due north, held `my = -1` for nine
// simulated MINUTES and never moved a pixel, because an obstacle sat between
// the two. Enemies have had `_steerAround` since patch-combat-defects; the bot
// never did, and nothing failed loudly — the room was cleared, so no assertion
// was watching.
//
// Sidles around obstacles and unpins from arena edges. Used wherever the bot
// has somewhere it MUST arrive: the extraction hatch, a pickup, an objective.
export function avoidVector(sim, p, x, y) {
  const dx = x - p.x, dy = y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  let vx = dx / d * 3, vy = dy / d * 3;
  // REPULSION FROM THE NEAREST POINT ON THE RECT, not from its centre. The
  // arena's dividing walls are long and thin — one measured 1127x60 — and a
  // centre-based normal points along such a wall rather than away from it. The
  // bot jammed under exactly that wall for nine simulated minutes with the
  // hatch on the far side: the pull north and a sideways "repulsion" summed to
  // a vector straight into the face, forever.
  //
  // The tangential term is what actually finds the doorway: it slides along the
  // wall, and its sign is chosen toward the side the target is on so the bot
  // rounds the near end rather than wandering off the far one.
  for (const o of sim.obstacles || []) {
    const nx = Math.max(o.x, Math.min(p.x, o.x + o.w));
    const ny = Math.max(o.y, Math.min(p.y, o.y + o.h));
    let ax = p.x - nx, ay = p.y - ny;
    let od = Math.hypot(ax, ay);
    if (od > 110) continue;
    if (od < 1e-3) { ax = 0; ay = -1; od = 1; }        // inside: pick a way out
    const px = ax / od, py = ay / od;
    const w = (110 - od) / 110 * 4.5;
    vx += px * w; vy += py * w;
    // TANGENT, AND IT HAS TO COMMIT. Signing it by "whichever way points at the
    // target right now" flips every tick once the bot is square to the wall,
    // and the measured result is a bot sliding 5px left, 5px right, forever.
    // Same failure and same fix as `_steerAround` for enemies: choose a side,
    // hold it, and only reverse when it has stopped making progress. Progress
    // is measured against the TARGET, so rounding a long wall the slow way
    // still counts as progress and is not abandoned halfway.
    const tx = -py, ty = px;
    if (p._sideT === undefined || p._sideGoal !== (x | 0) * 4096 + (y | 0)) {
      p._sideGoal = (x | 0) * 4096 + (y | 0);
      p._side = (tx * dx + ty * dy) >= 0 ? 1 : -1;
      p._sideT = sim.time; p._sideD = d;
    } else if (sim.time - p._sideT > 1.5) {
      if (d >= p._sideD - 6) p._side = -p._side;      // no progress: try the other way
      p._sideT = sim.time; p._sideD = d;
    }
    vx += tx * p._side * w * 1.6; vy += ty * p._side * w * 1.6;
  }
  const edge = Math.min(p.x, sim.W - p.x, p.y, sim.H - p.y);
  if (edge < 120) {
    const cx = sim.W / 2 - p.x, cy = sim.H / 2 - p.y, cl = Math.hypot(cx, cy) || 1;
    vx += cx / cl * 2; vy += cy / cl * 2;
  }
  const len = Math.hypot(vx, vy) || 1;
  return { vx: vx / len, vy: vy / len };
}

// The same routing, driving the input directly. Used where the bot has nothing
// to do but arrive: the extraction hatch, a swept pickup.
export function steerToAvoiding(sim, p, x, y) {
  const v = avoidVector(sim, p, x, y);
  sim.setInput(0, { mx: v.vx, my: v.vy });
}

// A single number that changes whenever an objective advances. Used only to
// notice that it has NOT.
function objProgress(o) {
  return `${o.banked ?? ''}|${o.captured ?? ''}|${o.killed ?? ''}|${o.survived ?? ''}|${o.leg ?? ''}|`
    + `${(o.relics || []).map(r => r.carrier).join(',')}|${(o.nests || []).length}|${o.done ? 1 : 0}`;
}

export function pilot(sim, p) {
  // a "mediocre human": kite at ring distance, avoid walls, hunt stragglers.
  // Mop-up stance: once spawning is over and only stragglers remain, stand
  // ground at mid-range instead of kiting to the horizon — hits must land.
  // no HP gate: fleeing forever isn't an option the game offers — the fight
  // must be finished to leave, so a hurt bot fights hurt (and may die honestly)
  const mopUp = sim.wave && sim.wave.done && sim.enemyPool.count <= 12;
  const ring = kiteRing(p, mopUp);
  let vx = 0, vy = 0;
  let nearest = null, nd = Infinity, count = 0;
  for (const e of sim.enemyPool) {
    const d2 = dist2(p.x, p.y, e.x, e.y);
    if (d2 < nd) { nd = d2; nearest = e; }
    count++;
    const d = Math.sqrt(d2) || 1;
    if (d < ring) {
      const w = (ring - d) / ring;
      vx += (p.x - e.x) / d * w * 3;
      vy += (p.y - e.y) / d * w * 3;
    }
  }
  // dodge enemy projectiles
  for (const pr of sim.projPool) {
    if (pr.friendly) continue;
    const d = Math.hypot(p.x - pr.x, p.y - pr.y) || 1;
    if (d < 110) { vx += (p.x - pr.x) / d * 2.5; vy += (p.y - pr.y) / d * 2.5; }
  }
  // hunt when nothing is inside the ring (stragglers like Lobbers)
  if (nearest && nd > (ring + 30) * (ring + 30)) {
    const d = Math.sqrt(nd);
    vx += (nearest.x - p.x) / d * 1.6;
    vy += (nearest.y - p.y) / d * 1.6;
  }
  // melee mop-up: charge the nearest straggler down through its fire —
  // flee-forever against a handful of ranged holdouts is the one thing a
  // human never does (overrides kite + projectile-dodge, keeps telegraphs)
  // `melee` used to come off the equipped weapon's class; with weapons retired
  // the kit's own reach is the only thing that knows, and a short ring IS what
  // melee means.
  if (mopUp && ring <= 140 && nearest) {
    const d = Math.sqrt(nd) || 1;
    vx = (nearest.x - p.x) / d * 4;
    vy = (nearest.y - p.y) / d * 4;
  }
  // objective pull: the levels that don't end by killing need the bot to go
  // somewhere specific. Weighted alongside kiting rather than overriding it,
  // so the probe still reports honest survivability while making progress.
  const obj = sim.obj;
  if (obj && !obj.done) {
    let gx = null, gy = null, weight = 2.6;
    if (obj.type === 'zone') { gx = obj.zone.x; gy = obj.zone.y; }
    else if (obj.type === 'storm') { gx = obj.c.x; gy = obj.c.y; weight = 4.5; }
    else if (obj.type === 'breach') { gx = obj.gate.x; gy = obj.gate.y; weight = 4; }
    else if (obj.type === 'payload') { gx = obj.x; gy = obj.y; }
    else if (obj.type === 'relic') {
      const mine = obj.relics.find(r => r.carrier === 0);
      if (mine) { gx = obj.altar.x; gy = obj.altar.y; weight = 4; }
      else {
        let best = null, bd = Infinity;
        for (const r of obj.relics) {
          if (r.carrier >= 0) continue;
          const d2 = dist2(p.x, p.y, r.x, r.y);
          if (d2 < bd) { bd = d2; best = r; }
        }
        if (best) { gx = best.x; gy = best.y; weight = 3.2; }
      }
    } else if (obj.type === 'nest') {
      let best = null, bd = Infinity;
      for (const id of obj.nests) {
        const e = sim.enemyById(id); if (!e) continue;
        const d2 = dist2(p.x, p.y, e.x, e.y);
        if (d2 < bd) { bd = d2; best = e; }
      }
      if (best) { gx = best.x; gy = best.y; weight = 2.2; }
    } else if (obj.type === 'bounty' && obj.markId !== null) {
      const e = sim.enemyById(obj.markId);
      if (e) { gx = e.x; gy = e.y; weight = 2.2; }
    }
    if (gx !== null) {
      const d = Math.hypot(gx - p.x, gy - p.y) || 1;
      const inPlace = (obj.type === 'zone' && d < obj.zone.r * 0.6)
        || (obj.type === 'storm' && d < obj.r * 0.6);
      // ROUTED, not pulled. A naked pull toward an objective jams against the
      // arena's dividing walls exactly as the hatch walk did — measured, a
      // Relic Run sat unfinished for 45 simulated minutes with the altar on the
      // far side of one. `avoidVector` rounds the wall and commits to a side.
      if (!inPlace) {
        // COMMIT RAMP. The kite term is summed per enemy, so a 30-body room
        // out-votes a weight-3 objective pull by an order of magnitude and the
        // bot orbits forever: measured, a Relic Run sat at 1/5 banked for 36
        // simulated minutes with one relic on the floor and nobody carrying it.
        // A real player shoves through chaff to grab the thing. So the pull
        // grows while the objective makes NO progress and resets the moment it
        // does — pressure that only builds when the room is actually stuck.
        const mark = objProgress(obj);
        if (p._objMark !== mark) { p._objMark = mark; p._objT = sim.time; }
        const stalled = sim.time - (p._objT ?? sim.time);
        const push = weight * Math.min(6, 1 + stalled / 8);
        const v = avoidVector(sim, p, gx, gy);
        vx += v.vx * push; vy += v.vy * push;
      }
    }
  }
  // wall avoidance: strong pull toward center when near arena edges
  const cx = sim.W / 2 - p.x, cy = sim.H / 2 - p.y;
  const edge = Math.min(p.x, sim.W - p.x, p.y, sim.H - p.y);
  if (edge < 150) { const cl = Math.hypot(cx, cy) || 1; vx += cx / cl * 2.2; vy += cy / cl * 2.2; }
  // sidle away from obstacle blocks so kiting doesn't pin against them
  for (const o of sim.obstacles) {
    const ox = o.x + o.w / 2, oy = o.y + o.h / 2;
    const d = Math.hypot(p.x - ox, p.y - oy) || 1;
    if (d < Math.max(o.w, o.h) / 2 + 60) { vx += (p.x - ox) / d * 1.8; vy += (p.y - oy) / d * 1.8; }
  }
  // dodge telegraphs and hazards
  for (const tg of sim.telegraphs) {
    if (tg.spawnMark) continue;
    const d = Math.hypot(p.x - tg.x, p.y - tg.y) || 1;
    if (d < (tg.r || 120) + 40) { vx += (p.x - tg.x) / d * 4; vy += (p.y - tg.y) / d * 4; }
  }
  for (const hz of sim.hazards || []) {
    if (hz.type === 'lava') {
      const d = Math.hypot(p.x - hz.x, p.y - hz.y) || 1;
      if (d < hz.r + 50) { vx += (p.x - hz.x) / d * 4; vy += (p.y - hz.y) / d * 4; }
    } else if (p.x > hz.x - 30 && p.x < hz.x + hz.w + 30 && p.y > hz.y - 30 && p.y < hz.y + hz.h + 30) {
      const ox = hz.x + hz.w / 2, oy = hz.y + hz.h / 2;
      const d = Math.hypot(p.x - ox, p.y - oy) || 1;
      vx += (p.x - ox) / d * 4; vy += (p.y - oy) / d * 4;
    }
  }
  // siege priorities a human reads off the edge arrows: burn the ward pylon
  // (it buffs everything), then focus the boss — weapons hit what you stand near
  let objective = sim.boss;
  for (const e of sim.enemyPool) if (e.def && e.def.behavior === 'pylon') { objective = e; break; }
  // once spawning stops, hunt the SOURCES first — the enemies that keep the
  // rest alive: Wombden nests replenish the field, Aegimand wardens shield
  // it, Stitcher medics out-heal a low-DPS kit. Nearest-target weapons never
  // break those stalemates on their own; a player reads the field and walks.
  const SOURCES = { nest: 1, warden: 1, medic: 1 };
  if (!objective && sim.wave && sim.wave.done) {
    let bestD = Infinity;
    for (const e of sim.enemyPool) {
      if (!e.def || !SOURCES[e.def.behavior]) continue;
      const d2 = dist2(p.x, p.y, e.x, e.y);
      if (d2 < bestD) { bestD = d2; objective = e; }
    }
  }
  if (objective) {
    const d = Math.hypot(objective.x - p.x, objective.y - p.y) || 1;
    // healthy → commit to the dive (shove through chaff like a player) and
    // walk all the way ON TO the objective — hovering at the edge leaves its
    // brood/adds holding the nearest-target slot; hurt → hover and whittle
    const healthy = p.hp > p.stats.vitality * 0.45;
    const pull = d > 60 ? (healthy ? 7 : 2.2) : 1.2;
    vx += (objective.x - p.x) / d * pull; vy += (objective.y - p.y) / d * pull;
  }
  // contest the hold circle when it's safe-ish
  if (sim.holdCircle && count < 12) {
    const c = sim.holdCircle;
    const d = Math.hypot(c.x - p.x, c.y - p.y) || 1;
    vx += (c.x - p.x) / d * 1.2; vy += (c.y - p.y) / d * 1.2;
  }
  // money doesn't wait (patch 9): the counter's lesson — once spawning stops
  // and only stragglers remain, run the field for the money BEFORE the last
  // kill fizzles it; mid-fight, scoop drops that are already close
  if (sim.pickups.length) {
    let nd2 = Infinity, mx = 0, my = 0;
    for (const m of sim.pickups) {
      const d2 = (m.x - p.x) * (m.x - p.x) + (m.y - p.y) * (m.y - p.y);
      if (d2 < nd2) { nd2 = d2; mx = m.x; my = m.y; }
    }
    const sweep = sim.wave && sim.wave.done && sim.enemyPool.count <= 8;
    if (sweep) {
      const d = Math.sqrt(nd2) || 1;
      vx += (mx - p.x) / d * 3; vy += (my - p.y) / d * 3;
    } else if (nd2 < 300 * 300) {
      const d = Math.sqrt(nd2) || 1;
      vx += (mx - p.x) / d * 0.8; vy += (my - p.y) / d * 0.8;
    }
  }
  const len = Math.hypot(vx, vy) || 1;
  sim.setInput(0, { mx: vx / len, my: vy / len });
}
