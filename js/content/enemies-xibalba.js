// REGION 2 — CENTRAL AMERICA (the xibalba tileset). Six types and a boss.
//
// Same density rule as region 1 and for the same reason: every committing
// behaviour telegraphs, chaff does not, and the telegraphing share is at least
// half the population by encounter weight. See enemies-pnw.js for why.
//
// THE NUMBERS ARE NOT HIGHER. That sentence used to read "it sits ten levels
// above region 1 — so the numbers are higher", and that was the defect in one
// line. `REGION_HP_MULT` already multiplies this region by ×2.13, measured
// against player output at §4.3's level anchors; a roster that ALSO carries
// band scaling multiplies the axis a second time. Authored at ×3.3 the floor-1
// table and then multiplied, Central America arrived at **7.02× floor 1** for a
// player roughly 2.1× stronger than at region 1.
//
// EVERY REGION'S ROSTER IS AUTHORED AT FLOOR-1 PARITY. The world axis is the
// sole difficulty multiplier, and a region's identity is COMPOSITION — which
// behaviours it fields, what shapes its telegraphs draw, how its slabs and its
// lights are distributed. Never weight. Two regions with identical weighted
// means can play nothing alike; two differing only in weight are the same
// region twice, with one of them wrong.
//
// WHAT MAKES THIS REGION ITSELF, then, is the SHAPES. Region 1 teaches circle,
// cone and line separately and its light telegraphs are small and close — a
// 70° cone at 105 range, a 260-long lane. Region 2 overlaps them: the Howler's
// cone is wider and the Lancer's lane is longer, so two commonplace units cover
// ground that intersects, and the sidestep becomes a choice of direction rather
// than a reflex. It also fields an ORBITER, which region 1 has no equivalent
// of, and keeps three chaff archetypes where region 1 has two.
//
// REWEIGHTING ALONE COULD NOT REACH THE BAND, and that is arithmetic rather
// than judgement: the lightest unit on the old roster was the Ashmoth at 10 HP,
// and the band's ceiling is 9.09, so even a roster that spawned nothing but its
// lightest unit missed. Re-authoring was forced, and it went to the roster's
// MID and its COMMONEST unit — never to the two landmarks.

export const XIB_ENEMIES = [
  // ---- light telegraphers: they commit, and they die ----
  {
    // THE COMMONEST UNIT, and now the one that teaches. Region 1 taught a
    // player to read a wind-up against a 7 HP Sapling; region 2 is where that
    // skill is first APPLIED, and before this there was nothing in it to apply
    // the skill to — every telegraph was attached to something that survived
    // the read. The lesson landed one region and had no follow-through.
    //
    // 14 → 7 HP, and `chaser` → `warden`, because only a COMMITTING behaviour
    // may telegraph (rule 1) and a slow advance is what a hunched howling thing
    // does before it lunges. It carries no `shieldR`: the Bloodpriest's 50%
    // ally aura is a landmark's privilege, and this region now has two wardens
    // precisely to make that distinction visible.
    //
    // Its cone is WIDER than region 1's Sapling (80° at 115 against 70° at 105)
    // and that is the region's signature: two commonplace units whose zones
    // intersect, so leaving one can put you inside the other.
    id: 'xib_howler', domain: 'spiritual', name: 'Howler', behavior: 'warden',
    hp: 7, spd: 112, dmg: 3, radius: 14, mats: 1, w: 2.9,
    shape: 'circle', color: '#8e4a7a',
    telegraph: {
      windupMs: 400, recoverMs: 280, cooldownMs: 3000, retryFrac: 0.3, recoverFrozen: true,
      shape: { kind: 'cone', angle: 80, range: 115 }, damage: 6, domain: 'spiritual',
    },
  },
  {
    // THE ROSTER'S MID, lightened. 22 → 7 HP, zone 24 → 7, on a longer cycle.
    // A dasher's lane is the read that most rewards direction over distance,
    // and at 250 long it still crosses the Howler's cone — the overlap this
    // region exists to teach. It was never a landmark; the 52 and the 36 are,
    // and both keep every number they had.
    //
    // PUNISH IS SIZED TO THE LEVEL THE UNIT IS MET AT. Seven damage is 8.1% of
    // the 86 vitality a level-10 character carries at region 2's anchor, against
    // region 1's Cedar Warden at 7.5% of 80. Slightly steeper, because a lane is
    // easier to leave than a cone you are already standing in — and because the
    // player has had a region to learn the read.
    id: 'xib_obsidian_lancer', domain: 'physical', name: 'Obsidian Lancer', behavior: 'dasher',
    hp: 7, spd: 150, dmg: 3, radius: 16, mats: 3, w: 2.5,
    shape: 'triangle', color: '#3a3a4d',
    dash: { windup: 0.48, speed: 600, dur: 0.45, cd: 2.3 },
    telegraph: {
      windupMs: 400, recoverMs: 360, cooldownMs: 3200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'line', width: 78, length: 250 }, damage: 7, domain: 'physical',
    },
  },

  // ---- chaff: no telegraph, and deliberately so ----
  //
  // Three of them, where region 1 has two — and one is an ORBITER, a behaviour
  // region 1 does not field at all. Undodgeable pressure is 4.0 of 9.83
  // encounter weight, 41% of the room, which is what keeps rule 3's trade
  // alive: if everything committed, holding stance would always be punished.
  {
    id: 'xib_ashmoth', domain: 'mental', name: 'Ashmoth', behavior: 'orbiter',
    hp: 6, spd: 170, dmg: 4, radius: 12, mats: 2, w: 2.4,
    shape: 'diamond', color: '#c98b3a', orbitR: 185, diveCd: 2.5, diveWindup: 0.35,
  },
  {
    id: 'xib_censer', domain: 'spiritual', name: 'Censer Bearer', behavior: 'spitter',
    hp: 9, spd: 90, dmg: 3, radius: 15, mats: 2, w: 1.6,
    shape: 'pentagon', color: '#6a9a7a',
    proj: { dmg: 5, speed: 315, radius: 6 }, keepDist: 265, fireCd: 2.1,
  },

  // ---- the landmarks: every stat untouched, seen rarely ----
  //
  // 2.4 → 0.18 and 2.2 → 0.25. Rarer than region 1's pair, and deliberately so:
  // a landmark's frequency goes as the inverse of its weight, or the heaviest
  // region ends up the one you meet slabs in most often. At ~55 spawns in a map
  // that is about one Colossus and one Bloodpriest per room.
  {
    id: 'xib_jade_colossus', domain: 'physical', name: 'Jade Colossus', behavior: 'brute',
    hp: 52, spd: 62, dmg: 15, radius: 27, mats: 4, w: 0.18,
    shape: 'square', color: '#2f7d6a',
    telegraph: {
      windupMs: 700, recoverMs: 540, cooldownMs: 3200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'circle', radius: 135 }, damage: 38, domain: 'physical',
    },
  },
  {
    id: 'xib_bloodpriest', domain: 'spiritual', name: 'Bloodpriest', behavior: 'warden',
    hp: 36, spd: 82, dmg: 8, radius: 20, mats: 4, w: 0.25,
    shape: 'hex', color: '#9c2f3a', shieldR: 155, shieldReduce: 0.5,
    telegraph: {
      windupMs: 500, recoverMs: 440, cooldownMs: 2800, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'cone', angle: 110, range: 190 }, damage: 26, domain: 'spiritual',
    },
  },
];

export const XIB_BOSS = {
  id: 'xib_boss', name: 'Ixkik, the Blood Moon', domain: 'spiritual',
  hp: 1600, spd: 64, dmg: 20, radius: 48, mats: 45,
  shape: 'hex', color: '#6d1f3d',
  telegraph: {
    windupMs: 640, recoverMs: 520, cooldownMs: 2800, retryFrac: 0.25, recoverFrozen: true,
    shape: { kind: 'cone', angle: 120, range: 300 }, damage: 44, domain: 'spiritual',
  },
  p2: {
    atFrac: 0.5, spdMult: 1.2,
    telegraph: {
      windupMs: 470, recoverMs: 400, cooldownMs: 2200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'line', width: 95, length: 460 }, damage: 40, domain: 'spiritual',
    },
  },
};
