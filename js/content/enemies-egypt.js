// REGION 4 — EGYPT (the necropolis, animal-headed gods, tomb constructs). Six
// types and a boss. Native class: the Wizard. Spiritual, with mental second.
//
// Authored to the horde role bands of GDD §4.3: fodder 3 HP, one light special
// at 8, two landmarks. No band scaling inside the roster — `enemyHpAxis` puts
// fodder on the opener packet and everything else on the world axis.
//
// WHAT MAKES THIS REGION ITSELF: the dead do not stay down, and something is
// watching from range.
//
//   Regions 1–3 teach a player to read the thing in front of them. Egypt is
//   the first region where the kill is not the end of the body and the threat
//   is not where the crowd is. It introduces the two behaviours no earlier
//   roster fields:
//
//   SPLITTER, as the commonest body. A mummy that dies releases two scarabs,
//   so the crowd GROWS when it is mown and area damage is worth more here
//   than anywhere before it — a single-target build clears a mummy and is
//   handed two more bodies for it.
//
//   SNIPER. The Eye keeps its distance and draws a long lane across the whole
//   fight. It is fodder — one hit kills it — so the question it asks is never
//   "can you kill it" but "did you look up from the crowd".
//
// The light special draws a CONE, which no earlier region gives its light
// unit: region 1 and 2 teach the lane, region 3 the circle.
//
// Domain share by encounter weight: spiritual 44.5%, mental 27.5%, physical
// 26.4% — spiritual leads, mental second, inside the 60% cap.

export const EG_ENEMIES = [
  // ---- the special: it commits, and it is rare enough to find ----
  {
    // A tomb servant: a small statue that walks and sweeps. Region 4's
    // teachable read, and the first light cone.
    id: 'eg_ushabti', domain: 'mental', name: 'Ushabti', behavior: 'warden',
    hp: 8, spd: 105, dmg: 3, radius: 14, mats: 2, w: 0.9,
    shape: 'square', color: '#3f8f8a',
    telegraph: {
      windupMs: 420, recoverMs: 300, cooldownMs: 3000, retryFrac: 0.3, recoverFrozen: true,
      shape: { kind: 'cone', angle: 80, range: 135 }, damage: 6, domain: 'mental',
    },
  },

  // ---- fodder: no telegraph, one opener hit ----
  {
    // The commonest body, and it is two bodies. `splitInto: 2` releases a pair
    // of scarabs on death (the sim spawns them as `mini`: ×0.35 HP, faster,
    // smaller). Slower than any earlier region's chaser on purpose — the
    // pressure is the count, not the pace.
    id: 'eg_mummy', domain: 'spiritual', name: 'Shambling Mummy', behavior: 'splitter',
    hp: 3, spd: 150, dmg: 3, radius: 15, mats: 1, w: 3.8, splitInto: 2,
    shape: 'circle', color: '#c9b98a',
  },
  {
    // Fast fodder: the pack that arrives while you are counting scarabs.
    id: 'eg_jackal', domain: 'physical', name: 'Tomb Jackal', behavior: 'sprinter',
    hp: 3, spd: 240, dmg: 4, radius: 12, mats: 1, w: 2.4,
    shape: 'triangle', color: '#2f2a33',
  },
  {
    // The watcher. Keeps its distance, tracks slowly through a 1.3 s wind-up
    // and fires a lane 900 long; it locks on faster against a target standing
    // still (the sniper behaviour's own rule), so the answer is to keep moving.
    // Authored damage 6 is 7.5% of the 80-vitality baseline — a light unit's
    // punish, because it is one.
    id: 'eg_eye', domain: 'mental', name: 'Eye of the Horizon', behavior: 'sniper',
    hp: 3, spd: 80, dmg: 3, radius: 13, mats: 2, w: 1.4,
    shape: 'thindiamond', color: '#e0b23c',
    beam: { windup: 1.3, dmg: 6, width: 16, len: 900, cd: 3.6 },
  },

  // ---- the landmarks: heavy, and seen rarely ----
  {
    id: 'eg_sphinx', domain: 'mental', name: 'Sphinx', behavior: 'brute',
    hp: 54, spd: 60, dmg: 14, radius: 27, mats: 4, w: 0.20,
    shape: 'hex', color: '#b08a4a',
    telegraph: {
      windupMs: 700, recoverMs: 540, cooldownMs: 3200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'circle', radius: 135 }, damage: 38, domain: 'mental',
    },
  },
  {
    // A crocodile-headed temple guard that commits to a lane. The region's
    // third shape, and the one that reaches a player who is kiting the Sphinx.
    id: 'eg_sobek_guard', domain: 'spiritual', name: 'Sobek Guard', behavior: 'dasher',
    hp: 38, spd: 84, dmg: 9, radius: 20, mats: 4, w: 0.25,
    shape: 'arrow', color: '#4f7a4a',
    dash: { windup: 0.6, speed: 560, dur: 0.5, cd: 3.0 },
    telegraph: {
      windupMs: 520, recoverMs: 440, cooldownMs: 3000, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'line', width: 80, length: 320 }, damage: 28, domain: 'spiritual',
    },
  },
];

// APEP, THE UNMAKING COIL — the serpent of chaos, the enemy of the sun.
//
// Phase 1 is a LANE: the lunge, 110 wide and 480 long, the longest committed
// lane in the game so far. Phase 2 takes the direction away — the coils close
// into a circle of 200 around him — so the sidestep that answered phase 1
// walks a player into the middle of phase 2.
//
// SIGNATURE — THE DEAD RISE FOR HIM (`adds`). Every nine seconds he raises
// four mummies, and each mummy is two scarabs. A boss fight in the necropolis
// is fought inside a crowd, and the crowd is fodder: it dies to one hit, it
// feeds every on-kill engine, and it punishes a build that brought no area
// damage. Capped, so a party that ignores them is pressed, not buried.
//
// HP continues the 900 → 1600 → 2300 line against measured output at the
// anchor (62.5 against region 3's 55.5). Provisional until the boss probe
// runs against it on the balance pass.
export const EG_BOSS = {
  id: 'eg_boss', name: 'Apep, the Unmaking Coil', domain: 'spiritual',
  hp: 2600, spd: 66, dmg: 22, radius: 50, mats: 75,
  shape: 'hex', color: '#5a2d6b',
  telegraph: {
    windupMs: 660, recoverMs: 520, cooldownMs: 2800, retryFrac: 0.25, recoverFrozen: true,
    shape: { kind: 'line', width: 110, length: 480 }, damage: 46, domain: 'spiritual',
  },
  charge: { cd: 5.0, windup: 0.85, dur: 0.75, speed: 680, width: 88, dmg: 46, minDist: 300 },
  adds: { cd: 9, count: 4, id: 'eg_mummy', cap: 10 },
  p2: {
    atFrac: 0.5, spdMult: 1.2,
    chargeCd: 3.8,
    adds: { cd: 6.5, count: 5, id: 'eg_mummy', cap: 14 },
    telegraph: {
      windupMs: 480, recoverMs: 400, cooldownMs: 2200, retryFrac: 0.25, recoverFrozen: true,
      shape: { kind: 'circle', radius: 200 }, damage: 42, domain: 'spiritual',
    },
  },
};
