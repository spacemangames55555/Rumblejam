// UNDERVAULT — global tuning constants and palette. All numbers referenced by the
// simulation live here or in js/content/ data modules.

export const DEV = true; // enables F1–F7 debug keys (host only; see README). Set false for clean runs.

export const CONFIG = {
  TICK_RATE: 60,
  DT: 1 / 60,
  SNAPSHOT_HZ: 15,
  INPUT_HZ: 30,
  INTERP_DELAY_MS: 120,

  ROOM_W: 1280,
  ROOM_H: 720,
  WALL: 36,            // wall thickness
  DOOR_W: 120,         // door gap width

  FLOORS: 4,
  ROOMS_MIN: 10,
  ROOMS_MAX: 13,

  BASE_SPEED: 300,     // u/s at Speed 0%
  PLAYER_RADIUS: 16,
  PICKUP_RADIUS: 60,
  MAGNET_SPEED: 900,
  CONTACT_COOLDOWN: 0.8,   // s between contact hits from one enemy
  INVULN_AFTER_HIT: 0.35,  // brief player i-frames after any hit

  // ---- skill-era summons (js/minions.js) ----
  // Engine-wide limits and shared kinematics, matching GDD §8.5. Per-summon
  // magnitudes — hp, damage, duration, counts — are NOT here: they live in each
  // tree's TUNING block and arrive on the compose step, so a Necromancer
  // skeleton and a Druid wolf differ as data.
  //
  // THERE IS NO SUMMON SLOT POOL. §8.5 gives the Druid a pack size equal to how
  // many animal skills it took, and the Necromancer capacity from rank alone.
  // SUMMON_SLOTS_BASE and SUMMON_SLOT_CAP lived here and are deleted: they were
  // invented to fix a problem the design does not have, and a shared pool
  // silently couples two engines the section keeps deliberately opposite. If a
  // future class needs standing capacity, it belongs to that class's engine.
  MINION_CAP_PER_PLAYER: 64,   // runaway backstop only — §8.5 caps nothing by design
  MINION_SPEED: 250,           // u/s; below BASE_SPEED so a pack cannot outrun its owner
  MINION_AGGRO_RANGE: 420,     // how far a chaser will look for something to fight
  MINION_HEEL_RANGE: 70,       // with nothing to fight, this close to the owner is close enough
  MINION_ORBIT_RATE: 1.6,      // rad/s for orbiters
  MINION_ORBIT_LERP: 8,        // how hard an orbiter corrects toward its station
  MINION_CONTACT_CD: 1,        // s between contact hits from one enemy onto one minion

  // ---- soul tokens ----
  // A world resource read by the ON_TOKEN trigger. Not a Necromancer field: any
  // enemy death can leave one and any class's skill may read one.
  //
  // EVERY enemy death drops one, and there is no cap and no roll (§8.5). The
  // Necromancer's cost is the cold start — a room begins with no tokens because
  // nothing has died in it yet — not scarcity within the fight.
  SOUL_TOKEN_TTL: 30,          // s before it fades

  // ---- structure relocation (turrets/drones follow their owner) ----
  // "Off the owner's screen" is judged against a box GENEROUSLY larger than
  // any real viewport (the renderer shows ROOM_W×ROOM_H of world at the
  // narrow axis and more on wide monitors, up to ~21:9). Erring large means
  // a structure the owner can actually see never packs itself up.
  STRUCT_OFFSCREEN_W: 2100,
  STRUCT_OFFSCREEN_H: 1180,
  STRUCT_CHANNEL_S: 3,      // stand still this long to recall off-screen structures
  STRUCT_REDEPLOY_S: 0.5,   // packed → back online near the owner
  STRUCT_SCATTER: 46,       // ring radius so multiple structures don't stack

  // solo difficulty: a lone player faces +15% count and +15% enemy HP on top
  // of every other scaling knob (co-op curves, floor, patch multipliers)
  SOLO_SPAWN_MULT: 1.15,
  SOLO_HP_MULT: 1.15,

  REVIVE_TIME: 3,
  REVIVE_RADIUS: 70,
  REVIVE_HP: 0.5,          // revived at 50% max HP
  DOOR_COUNTDOWN: 3,

  DODGE_CAP: 60,
  ARMOR_K: 15,             // damage taken = raw * K / (K + armor)
  NEG_ARMOR_MAX_BONUS: 0.5,

  XP_BASE: 10, XP_PER_LEVEL: 4,       // next level cost = 10 + 4*level
  QUOTA_BASE: 12, QUOTA_PER_FLOOR: 4, // room quota = (12+4*floor) * playerScale
  SPAWN_PULSES: 3,

  // co-op scaling — linear through 4 players, softened above (the Warband):
  // count ×(1+0.5(n−1)) to ×2.5 at 4p, then +0.3/player → ×3.7 at 8p;
  // HP ×(1+0.35(n−1)) to ×2.05 at 4p, then +0.2/player → ×2.85 at 8p.
  COOP_SPAWN_SCALE: 0.5,   // per player through COOP_SOFT_AT
  COOP_HP_SCALE: 0.35,
  COOP_SOFT_AT: 4,         // the knee: linear to here, softened beyond
  COOP_SPAWN_SOFT: 0.3,    // per player beyond the knee
  COOP_HP_SOFT: 0.2,
  // hard alive ceiling (enemies on the field + queued). When it binds, the
  // spawn budget BANKS (capped) and flows in as slots free — fights get
  // longer, not laggier. Sized to the render/tick budget, under POOL_ENEMIES.
  ALIVE_CEILING: 300,
  SPAWN_BANK_CAP: 45,      // banked budget units — bounds the post-ceiling flood
  ARENA_CROWD_AT: 5,       // parties this size and up fight in scaled arenas
  ARENA_CROWD_SCALE: 1.25, // bounds ×1.25 (same templates, geometry scaled)
  FLOOR_HP_MULT: 1.35,
  FLOOR_DMG_MULT: 1.2,

  // The two canonical difficulty knobs (patch 8) — all future density/health
  // tuning is a one-line change here.
  spawnBudgetMult: 1.25,   // arena + siege inflow, and the alive-at-once caps
  enemyHpMult: 1.12,       // every enemy: chaff, ranged, specials, elites, bosses

  // The Friction Patch (patch 9)
  PUDDLE_DPS: 8,           // acid puddle from death-puddle chaff (×floor dmg scale)
  PUDDLE_R: 46,
  PUDDLE_DUR: 6,
  PUDDLE_CAP: 14,          // live puddles at once — oldest fades first
  SIEGE_LOOT_WINDOW_S: 8,  // sweep-the-field countdown after the siege boss dies

  // Level-up airhorn (the game's first external asset — see assets/)
  AIRHORN_PATH: 'assets/airhorn.mp3',
  AIRHORN_VOL_OWN: 1.0,    // your own level-up
  AIRHORN_VOL_ALLY: 0.35,  // an ally's level-up (co-op)
  AIRHORN_DEBOUNCE_S: 1.0, // one horn per resolution moment, not per level
  AIRHORN_ALLY_CAP: 2,     // ally horns per debounce window (7 friends ≠ 7 horns)

  ELITE_HP_MULT: 3,
  ELITE_DMG_MULT: 1.5,

  REROLL_BASE: 6, REROLL_PER_FLOOR: 3, REROLL_GROWTH: 1.5,
  SHOP_SLOTS: 4,
  RARITY_WEIGHTS: { common: 62, uncommon: 25, rare: 10, legendary: 3 },
  PRICE_FLOOR_SCALE: 0.25,  // prices *(1+0.25*(floor-1))
  WEAPON_SLOT_MAX: 6,
  // ZERO. Weapons are removed from the game, so the chance a shop slot rolls
  // one is not a tuning knob with a small value — it is a rate that must be
  // nothing. Sim._stocksWeapons() gates every weapon branch on the player's
  // real weaponSlots as well, so the two agree and neither alone is load
  // bearing; this constant is the statement of intent, the predicate is the
  // enforcement that follows the game if slots ever come back.
  SHOP_WEAPON_CHANCE: 0,

  HARVEST_GROWTH: 0.05,    // harvesting grows 5% (floored) per room clear

  // The lobby's repeating channel. In-run state rides the 15Hz snapshot stream,
  // which heals a dropped message on the next frame; the lobby has no snapshot
  // stream at all, so its state travelled only as edges and a peer that missed
  // one sat on a stale lobby forever. 3Hz is fast enough that a missed edge is
  // invisible and slow enough to be free — nothing else is on the wire pre-run.
  LOBBY_HEARTBEAT_HZ: 3,

  // Room registration (defect #9). One attempt with a bare 8s timeout and no
  // retry meant any transient signalling failure — or a room-code collision,
  // which can NEVER succeed on a retry of the same code — cost the whole
  // session. Each attempt draws a fresh code; the backoff is per-attempt.
  //
  // THE BUDGET IS THE REAL CEILING, and it exists because the retry is not
  // free. Attempts x timeout is 15s of a player watching "registering room…",
  // and it is 15s the co-op suite has to be told to wait for. The retry earns
  // its keep on FAST failures — a taken code errors immediately, so all three
  // attempts finish inside a second. It earns nothing on slow ones: if the
  // relay did not answer in 5s it will not answer in 5s more. The budget stops
  // the sequence on wall clock so the collision case keeps its retries and the
  // dead-relay case still gives up promptly.
  ROOM_REGISTER_ATTEMPTS: 3,
  ROOM_REGISTER_TIMEOUT_MS: 5000,
  ROOM_REGISTER_BACKOFF_MS: 400,
  ROOM_REGISTER_BUDGET_MS: 11000,

  // Client -> host input delivery (defect #8). Character pick, ready, node tap,
  // buy and stance all leave by one method and used to leave exactly once; if
  // the channel was not open at that instant the action was simply gone.
  //
  // The heartbeat pattern does not transfer here. Host state repeats because
  // repeating it is idempotent — the same roster applied twice is the same
  // roster. Input is not: `ready` TOGGLES, so a second delivery of one press
  // un-readies the player. So the client repeats until acknowledged and the
  // host applies each sequence number once, which is repetition without
  // re-firing.
  //
  // Resend is 4 Hz against a 30 Hz pump, so a lost action costs a quarter
  // second rather than the session. Giving up is loud, not silent.
  UI_ACK_RESEND_MS: 250,
  UI_ACK_GIVEUP_MS: 8000,
  UI_ACK_MAX_PENDING: 64,

  // WEAPONS ARE GONE (patch-trigger-core). Skills replace them entirely. This
  // is the single place that says so: js/game.js forces weaponSlots to 0 from
  // it, and tools/browser_test.mjs skips the checks that cannot pass because
  // of it. It was previously an unconditional assignment buried in game.js,
  // which left a dozen suite checks asserting on content that no longer
  // existed — dead code failing live, and throwing hard enough to end whole
  // suite phases (§15 defect #10). Flipping this back is the phase-4 economy
  // work; the checks come back with it.
  WEAPONS_ENABLED: false,

  DISCONNECT_TIMEOUT: 5,   // s of silence before a client is dropped
  MAX_PLAYERS: 8,

  // snapshot pacing and interest culling (the Warband netcode)
  SNAPSHOT_HZ_CROWD: 12,   // rate at CROWD_AT+ players (interp adjusts itself)
  SNAPSHOT_CROWD_AT: 6,
  SNAP_CULL_R: 1400,       // chaff farther than this from EVERY player is not
                           // sent — off every screen, radar shows elites only

  // performance
  POOL_ENEMIES: 320, POOL_PROJECTILES: 700, POOL_PARTICLES: 900,
  GRID_CELL: 72,       // spatial-hash bucket for collision — NOT the floor grid

  // The floor grid, in world units. One tile source cell draws to exactly one
  // of these, so a tile is square in world units and every tile boundary lands
  // on a grid line. That is what keeps the 2.18 roster scale valid: a character
  // standing on a tile covers the same fraction of it that it covered of a grid
  // square before there were tiles.
  //
  // This was four hardcoded `64`s in Renderer._drawArena() until the tiled
  // floor needed the renderer and the atlas to agree on one number.
  FLOOR_TILE: 64,

  // The F6 telegraph pit — a playtest room, not a level. Density high enough
  // that the hold-or-break decision comes up every few seconds instead of
  // roughly twice a minute, which is what a normal room produces.
  TELEGRAPH_PIT_COUNT: 8,
  TELEGRAPH_PIT_RING: 190,
  TELEGRAPH_PIT_STAGGER: 70,
};

export const PALETTE = {
  bg: '#14161f', grid: '#1b1e2b', wall: '#2b2f45', wallEdge: '#454b6e',
  floorSafe: '#181b28', doorOpen: '#5ee0a8', doorLocked: '#ff5d6c',
  // 8 seats — chosen against the enemy reds, elite purple and material gold
  players: ['#4fd8eb', '#ffab4f', '#7dee6a', '#ff7ad9', '#6a8dff', '#eef75e', '#b993ff', '#f0f0f0'],
  material: '#ffd45e', materialEdge: '#a87f14',
  hpBar: '#ff5d6c', xpBar: '#5ee0a8',
  outline: '#0b0c12',
  hit: '#ffffff', crit: '#ffd45e',
  telegraph: 'rgba(255,93,108,0.28)', telegraphEdge: '#ff5d6c',
  hazardSpike: '#c8cde8', hazardLava: '#ff7b3a',
  rarity: { common: '#b8bdd4', uncommon: '#5ee0a8', rare: '#5ea8ff', legendary: '#ffd45e' },
  elite: '#c05eff',
  boss: '#ff4560',
};

// Stat registry — the ten player stats (the Great Rebalance sheet).
// `pct` controls tooltip formatting; `base` is the pre-modifier value.
export const STATS = [
  { key: 'vitality',   name: 'Vitality',   pct: false, base: 80 }, // hit points
  { key: 'ferocity',   name: 'Ferocity',   pct: true,  base: 0 },  // universal damage %
  { key: 'tempo',      name: 'Tempo',      pct: true,  base: 0 },  // attack + move speed
  { key: 'grit',       name: 'Grit',       pct: false, base: 0 },  // mitigation + knockback resist
  { key: 'reflex',     name: 'Reflex',     pct: true,  base: 0 },  // dodge (cap 60)
  { key: 'recovery',   name: 'Recovery',   pct: true,  base: 0 },  // amplifies ALL healing received
  { key: 'ingenuity',  name: 'Ingenuity',  pct: false, base: 0 },  // summon dmg+HP ×(1+0.1×I)
  { key: 'attunement', name: 'Attunement', pct: true,  base: 0 },  // burn/chill/chain/nova power
  { key: 'greed',      name: 'Greed',      pct: false, base: 0 },  // rarity bias + floor(G/2) mats per clear
  { key: 'reach',      name: 'Reach',      pct: false, base: 0 },  // weapon reach + pickup radius
];
export const STAT_KEYS = STATS.map(s => s.key);
export const STAT_NAME = Object.fromEntries(STATS.map(s => [s.key, s.name]));
export const STAT_IS_PCT = Object.fromEntries(STATS.map(s => [s.key, s.pct]));
export const STAT_BASE = Object.fromEntries(STATS.map(s => [s.key, s.base]));

// SCALING_RATES USED TO LIVE HERE and is deleted, not deprecated.
//
// It converted a flat stat into a weapon-damage percentage for the weapon's
// scaling tags. Weapons were removed in patch-trigger-core: _tickWeapons is
// never called, so _fireWeapon -> _scalingBonus -> SCALING_RATES was reachable
// only from a test that calls _fireWeapon directly to check line of sight.
//
// A dead constant that LOOKS live is how the README drifted — it documented
// weapon scaling as a live rule for four patches after the rule stopped
// existing. The fix for that is removal, not a comment saying "unused".

// Weapon tier multipliers (I–IV): damage etc. scale, price scales.
export const TIER_MULT = [1, 1.6, 2.5, 3.9];
export const TIER_PRICE_MULT = [1, 2.1, 4.4, 9];
export const TIER_NAMES = ['I', 'II', 'III', 'IV'];

export const NET_PREFIX = 'sg-dungeon-';

// Shared pricing helpers — the sim and the shop UI must agree on sell values.
export function weaponBasePrice(def, tier) {
  return def.price * TIER_PRICE_MULT[tier - 1];
}
export function sellValue(basePrice, floorNum) {
  return Math.floor(basePrice * (1 + CONFIG.PRICE_FLOOR_SCALE * (floorNum - 1)) * 0.3);
}
