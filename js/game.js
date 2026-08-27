// Host-authoritative simulation. Runs at a fixed 60 Hz, fully separate from
// rendering. Clients only ever send inputs/UI intents; everything here is the
// single source of truth. Solo play runs this exact code with one player.

import { CONFIG, DEV, TIER_MULT, TIER_PRICE_MULT, weaponBasePrice, sellValue, STATS, STAT_BASE, STAT_IS_PCT, ROLL_TABLE } from './config.js';
import { Rng, subRng, hashString } from './rng.js';
import { Pool, SpatialHash, clamp, dist, dist2, angleTo, segHitsRect, segRectEntryT } from './util.js';
import { generateTree, serializeMap } from './nodetree.js';
import { buildArena, waveConfig, PROFILES, isOnboardingNode, onboardingXpMult } from './arenas.js';
import {
  IS_OBJECTIVE, OBJECTIVE_KINDS, initObjective, tickObjective,
  serializeObjective, objectiveKillPays, objectiveSpawnMult, objectiveEndless,
  objectiveSpawnX,
} from './objectives.js';
import { CHAR_BY_ID, isSelectable, unselectableReason } from './content/characters.js';
import { WEAPONS, WEAPON_BY_ID } from './content/weapons.js';
import * as SK from './skillsim.js';
import * as MIN from './minions.js';
import { EnemyGrid } from './triggers.js';
import { tickTelegraphs, initTelegraph, cancelTelegraph, liveZones } from './telegraphs.js';
import { ITEMS, ITEM_BY_ID } from './content/items.js';
import { ENEMIES, ENEMY_BY_ID, ENEMY_INDEX, ELITE_MODS, FLOOR_TABLES, ONBOARDING_TABLE } from './content/enemies.js';
import { REGION_ENEMIES, telegraphWeight } from './content/regions-enemies.js';
import { nodePopulation, nodeModifiers, shrineOffer, applyShrine } from './nodebehaviour.js';
import { REGION_BY_INDEX, depthMult, regionHpMult, regionDmgMult, bossForRegion, TOTAL_REGIONS } from './regions.js';
import { difficultyOf, DEFAULT_DIFFICULTY } from './worldmap.js';

import { STAT_BOOSTS } from './content/statboosts.js';
import { updateEnemy } from './entities/enemies.js';
import { BEAST, initBeast, updateBeast, beastUp, beastBlocks, beastAbsorbs, hurtBeast } from './entities/beast.js';
import {
  tohInitPlayer, tohStartingGear, tohStartFight, tohStats, tohTick, tohOnFire,
  tohHitDamage, tohOnHit, tohOnWallHit, tohOnHurt, tohOnDodge, tohOnHeal, tohOnKill, tohEnemyDied,
  tohClearFight, tohTakeBoon, tohBoonPermanent, tohSnapshot, tohMarks, tohMeter,
  tohState, tohSwapStance, coralBlocks,
} from './traits-toh.js';

const { WALL, DT } = CONFIG;
// Alive-at-once caps. Ranged and special types are capped so long sieges can't
// pile one type into a degenerate wall (a low-DPS build vs 60 lobbers is a
// stalemate, not a fight); melee chaff stays uncapped — swarms are the point,
// and capped spawn rolls redirect into chaff.
const SPAWN_CAPS = {
  wombden: 2, aegimand: 3, stitcher: 3, deadeye: 4, slabjaw: 6,
  lobber: 22, gemmite: 18, gyre: 16, fusehead: 10, lancerfish: 14,
};
// The two profile levers, as ROLES rather than as ids. `gyre` and `lancerfish`
// are the base roster's orbiter and dasher; `lobber` is its spitter. Naming the
// behaviour is what lets a region supply its own.
const FLANKER_BEHAVIORS = new Set(['orbiter', 'dasher', 'sprinter']);
const ARTILLERY_BEHAVIORS = new Set(['spitter', 'sniper']);
const ING_SCALE = 0.1; // +10% summon damage & HP per Ingenuity point
const VOTE_TIME = 4;   // consent countdown (node picks and extraction)
// How long a body commits to one way round an obstacle before trying the other,
// and the ceiling that search grows to. See _steerAround.
const SLIDE_PATIENCE = 1.6;
const SLIDE_PATIENCE_MAX = 8;
// the Siege's ward pylon — a destructible structure, not a roster enemy
const PYLON_DEF = { id: '_pylon', name: 'Ward Pylon', domain: 'mental', behavior: 'pylon', hp: 260, spd: 0, dmg: 0, radius: 26, mats: 6, shape: 'square', color: '#c05eff' };
// SHOP TIER WEIGHTS PER REGION — chance out of 100 for tiers I–IV, eight rows.
//
// The four-row version was floors 1–4 and its ENDPOINTS are the design: tier I
// is nearly all a starting party can use, tier IV is an endgame shelf. Those
// two rows are kept exactly (region 1 = old floor 1, region 8 = old floor 4)
// and the six between them are authored rather than interpolated, so tier IV
// arrives at region 4 rather than at region 2.5 — a fractional row is not a
// thing a shop can stock.
const TIER_WEIGHTS = [
  [80, 20, 0, 0],   // 1  the starting shelf, unchanged
  [62, 32, 6, 0],   // 2
  [48, 38, 14, 0],  // 3
  [34, 42, 21, 3],  // 4  tier IV first appears
  [24, 43, 27, 6],  // 5
  [16, 41, 33, 10], // 6
  [9, 38, 38, 15],  // 7
  [5, 35, 40, 20],  // 8  the endgame shelf, unchanged
];

export class Sim {
  constructor({ seed, party, allowUnplayable = false, difficulty = DEFAULT_DIFFICULTY, regionIndex = 1, objectiveHistory = [], tree = null, cleared = [] }) {
    // see _makePlayer: an explicit, named opt-out for tests that measure a
    // class's TRAIT rather than whether it can win a fight
    this.allowUnplayable = allowUnplayable;
    // §4.1. THIS FIELD WAS READ AND NEVER WRITTEN. `_spawnEnemy` has called
    // `difficultyOf(this.difficulty)` since phase 2 and no constructor ever set
    // it, so it was `undefined` on every Sim in the game's history and the
    // lookup fell through to Standard. The gate that owns §4.1 was green
    // throughout, because it constructed its own Sims and assigned the field by
    // hand — a fixture provisioning what the product does not (§13 rule 17).
    this.difficulty = difficulty;
    this.seed = seed >>> 0;

    // THE SIM STREAM. Every incidental roll the simulation makes — spawn
    // jitter, cooldown scatter, proc chances, dodge rolls, material scatter,
    // wander points — comes from HERE, not from this.rng.float().
    //
    // KNOWN-DEFECTS #1 named rushMove() as the one offender. It was 43 of them
    // across game.js, entities/enemies.js, telegraphs.js and traits-toh.js, and
    // the consequence was not academic: every A/B comparison in this patch
    // needed three runs to say anything, because two runs of the same seed
    // stopped matching partway through the first fight. "It happened on seed
    // ABCDEFG" was not a reproduction.
    //
    // One stream rather than named sub-streams on purpose. Sub-streams keep
    // systems from perturbing each other, which matters for CONTENT rolls
    // (layout, shop stock, offers) and those keep theirs. These are per-tick
    // incidentals whose order is already fully determined by the tick order;
    // a shared stream is both simpler and exactly as reproducible.
    this.rng = new Rng(hashString(`sim:${this.seed}`));
    // CRIT ROLLS GET THEIR OWN SEEDED STREAM, for two reasons that both matter.
    // Determinism: same seed, same crits, so a gate comparing two runs sees
    // exact numbers instead of averaging variance out over samples. And
    // isolation: crit rolls do not consume from `rng`, so adding crit to the
    // game does not shift the sequence every existing balance measurement was
    // taken against — §4.2's sweep moved once already when a gold multiplier
    // started drawing from the shared stream, and once was enough.
    this.critRng = subRng(this.seed, 'crit');
    // THE ECONOMY'S OWN STREAM, for the same two reasons crit has one: the
    // penalty roll must be reproducible from a seed, and it must not consume
    // from `rng` — §9.2's roll fires on every stat-item grant, which would
    // otherwise reprice every balance number ever measured against a run that
    // bought something. See §13 rule 27.
    this.econRng = subRng(this.seed, 'econ');
    this.W = 1280; this.H = 720; // placeholder until the first arena sets real dims
    this.tickNum = 0;
    this.time = 0;
    this.events = [];
    this.over = false;
    this.result = null;
    this.god = false;

    this.enemyPool = new Pool(CONFIG.POOL_ENEMIES, () => ({}));
    this.projPool = new Pool(CONFIG.POOL_PROJECTILES, () => ({}));
    this.grid = new SpatialHash(CONFIG.GRID_CELL);
    this.pickups = [];
    this.summons = [];        // weapon-era structures; phase 4, untouched
    // THE ASSASSIN'S KILLBOX. Inert placed objects, written by the `trap`
    // primitive and consumed by `detonateTraps` when their owner casts nearby.
    // Its own array rather than a flag on `zones` because a zone ticks and this
    // does not, and because the detonation check runs on EVERY cast in the game
    // — scanning every zone in the world to find one class's traps would be a
    // permanent cost on every other class. See §5.7.
    this.traps = [];
    MIN.initTokens(this);     // skill-era soul-token pool + its counters
    this.telegraphs = [];
    this.zones = [];
    this.vortexes = [];
    this.activeBeams = [];
    this.fx = this._emptyFx();
    // trigger-core state. The grid is rebuilt once per trigger tick and every
    // proximity query in the game goes through it — no trigger ever scans the
    // full enemy array.
    this.trigGrid = new EnemyGrid();
    this.trigAcc = 0;
    this.trigCursor = 0;
    this.trigStats = { evals: 0, fires: 0, capped: false, queries: 0, cells: 0, enemies: 0, ms: 0, cappedCount: 0, ticks: 0 };
    // The fastest read on whether telegraphs are working at all: dodges near
    // zero means wind-ups are too short or zones unreadable; resolves near zero
    // means they are too long.
    this.telStats = { committed: 0, resolved: 0, dodged: 0, interrupted: 0 };
    this.telDodgeLog = [];
    this.spawnCounter = 0;
    this.shake = 0;

    this.decoys = [];   // Mirage afterimages — taunt targets that burst on expiry

    this.players = party.map((m, i) => this._makePlayer(m, i));
    // party-wide curse (Tollkeeper's Toll Road: double mats, +25% enemy HP)
    this.greedHp = this.players.some(p => p.char.trait.key === 'toll_road') ? 1.25 : 1;
    this.greedMats = this.players.some(p => p.char.trait.key === 'toll_road') ? 2 : 1;
    this.coopHp = coopCurve(this.players.length, CONFIG.COOP_HP_SCALE, CONFIG.COOP_HP_SOFT);
    this.coopSpawn = coopCurve(this.players.length, CONFIG.COOP_SPAWN_SCALE, CONFIG.COOP_SPAWN_SOFT);
    // solo bite: one player gets +15% count and +15% enemy HP on top of the
    // co-op curve (which is ×1 at n=1), so playing alone isn't the easy mode
    if (this.players.length === 1) {
      this.coopSpawn *= CONFIG.SOLO_SPAWN_MULT;
      this.coopHp *= CONFIG.SOLO_HP_MULT;
    }
    // round curses (cursed shop items) — enemy-side effects are shared by the
    // whole party for one round; player-side effects live on the buyer
    this.curseEnemyHp = 1; this.curseEnemySpd = 1; this.curseBarrage = 0;

    // ---- THE REGION. Assigned at construction, from the world map. ----
    //
    // These three fields were READ AT SIX SITES AND WRITTEN AT NONE for the
    // whole life of the region layer: `_spawnTable` fell through to the floor
    // tables, `_regionPick` returned null, `regionFightMods` looked up
    // `REGION_BY_INDEX[undefined]`, and the nest's wall multiplier resolved to
    // 1. Every one of those was a working code path taking its default branch
    // forever, which is why nothing ever failed.
    this.regionIndex = Math.max(1, Math.min(TOTAL_REGIONS, regionIndex | 0));
    const reg = REGION_BY_INDEX[this.regionIndex] || null;
    this.region = reg ? reg.id : null;   // the id — `REGION_ENEMIES` is keyed by it
    this.regionColumn = 1;               // the fight's depth, 1..COLUMNS
    // Objectives dealt in EARLIER regions of this run, one array per region.
    // The tree's draw biases against what the player has seen lately, and this
    // is the only thing it reads that is not the seed — see nodetree.js.
    this.objectiveHistory = objectiveHistory.map(x => [...x]);
    // §11.3 — A PARKED REGION IS RESUMED, NOT RE-ROLLED. A character partway
    // through a region carries its tree and its cleared nodes in the save; a
    // regenerated tree would be a different region wearing the same name, and
    // the cleared list would point at nodes that moved.
    this._parkedTree = tree;
    this._parkedCleared = cleared;
    this.pendingEnd = 0;
    // ---- Gauntlet flow state ----
    this.phase = 'map';       // 'map' (node screen) | 'arena' (fighting)
    this.currentNode = null;  // node id we're on (null before the first pick)
    this.visited = new Set();
    this.nodeVote = null;     // {nodeId, byIdx, t, redirected} — consent countdown
    this.arenaNode = null;    // the node object while phase === 'arena'
    this.wave = null;         // budget-curve spawn state
    this.cleared = false;     // arena fight finished (portal up)
    this.obstacles = [];      // axis-aligned rects
    // Thrones of Heaven world entities (empty on the classic roster)
    this.corals = [];         // Sundian nodes
    this.coralWalls = [];     // links between them — stop enemies, never allies
    this.singularities = [];  // Mage collapses
    this.walls = [];          // DESTRUCTIBLE rects (Nest Purge rings) — a
                              // subset of obstacles, so movement/LoS/cover
                              // all work on them for free
    this.hatch = null;        // the extraction portal (fights) / descent (post-siege)
    this.extract = null;      // {t} — countdown while someone stands on the portal
    this.afterSiege = false;  // portal descends instead of returning to the map
    this.mutations = null; this.mutIdx = 0; this.siegeT = 0; this.bossAt = Infinity;
    this.bossSpawned = false; this.bossT = 0; this.siegeCfg = null;
    this.profile = null; this.fronts = [0, 2]; this.fightLoot = 0; this.lootT = null;
    // What this fight PAID, separated by axis, because gold and XP no longer
    // move together (§4.1). `gold` is materials dropped after every multiplier;
    // `xp` is the experience-bearing subset of them.
    this.payout = { kills: 0, gold: 0, xp: 0 };
    this.holdCircle = null;   // {x,y,r,held} — spawn-choke sub-objective
    this.pylonId = null; this.enemyBuff = 1;
    this._startRegion();
    for (const p of this.players) this._initStartingGear(p);
  }

  _emptyFx() { return { hits: [], deaths: [], booms: [], beams: [], swings: [], blocks: [], skillFires: [], telResolve: [] }; }
  pushEvent(ev) { this.events.push(ev); }
  livePlayers() { return this.players.filter(p => !p.gone); }

  // ---------------- player construction & stats ----------------

  // The skill path calls this; see fireSkill() in skillsim.js. Exposed on the
  // Sim rather than imported there because traits-toh.js already imports from
  // the sim side and a second edge would close a cycle.
  tohOnFire(p, ctx) { tohOnFire(this, p, ctx); }

  // PER-TARGET DAMAGE ATTRIBUTION, opt-in. "The player is armed and firing and
  // the mark's HP does not move" has three causes that want three different
  // fixes — the selector chose something else, the selector chose the mark and
  // the projectile missed, or the mark absorbed the hit — and a total-damage
  // counter cannot tell them apart. A harness sets sim.dmgLog = new Map() and
  // reads it at teardown; nothing is recorded when it is absent, so live play
  // pays one property check.
  _dmgLedger(e, owner, amount, outcome) {
    if (!this.dmgLog || !owner || !owner.stats) return;
    const k = e.id;
    let r = this.dmgLog.get(k);
    if (!r) { r = { id: k, tag: e.bounty ? 'MARK' : e.isNest ? 'nest' : e.boss ? 'boss' : e.elite ? 'elite' : 'chaff', landed: 0, hits: 0, blocked: 0 }; this.dmgLog.set(k, r); }
    if (outcome === 'landed') { r.landed += amount; r.hits++; } else r.blocked++;
  }

  // What each skill fire SELECTED, before anything travelled. A projectile that
  // misses and a target never chosen look identical downstream.
  // WHAT THE SELECTOR CHOSE, AND WHETHER IT HAD THE CHOICE.
  //
  // `available` says a mark was inside this fire's range. Without it the ledger
  // cannot separate "the selector picked chaff over a mark" — a real defect —
  // from "there was no mark in range, so it correctly picked the best thing
  // present". The ratio of MARK to everything silently measures how much time
  // the party spends near the mark, which moves whenever throughput changes:
  // it read 93% and then 83% across a patch in which the selector did not
  // change at all.
  _selLedger(skillId, target, available = null) {
    if (!this.selLog) return;
    const k = target ? (target.bounty ? 'MARK' : target.isNest ? 'nest' : target.boss ? 'boss' : target.elite ? 'elite' : 'chaff') : 'none';
    const key = `${skillId}->${k}${available === true ? '|markInRange' : ''}`;
    this.selLog.set(key, (this.selLog.get(key) || 0) + 1);
  }

  _makePlayer(member, idx) {
    // NO SILENT SUBSTITUTION. This used to be
    //   CHAR_BY_ID[member.charId] || CHAR_BY_ID.bulwark
    // and that single `||` is most of why §15 defect #11 survived a patch: an
    // id from the other roster resolved to bulwark with the right stats and the
    // WRONG charId, treesFor(p) keys off charId, and the player got a character
    // with no skill trees and no way to attack — silently.
    //
    // There is one roster now, so there is nothing to fall back FROM. An
    // unknown id is a bug in whoever built the party, and it throws.
    const char = CHAR_BY_ID[member.charId];
    if (!char) {
      throw new Error(`[sim] unknown character "${member.charId}". There is one roster and this is not in it. `
        + `Known: ${Object.keys(CHAR_BY_ID).join(', ')}`);
    }
    // SELECTABILITY IS ABOUT STARTING A RUN. A class with no tree cannot fight,
    // so a lobby must not offer it and a client must not be able to force it.
    // But its TRAIT may be fully implemented and worth testing, and refusing to
    // construct a Sim at all would block those tests — so the escape hatch is
    // explicit and named, never a default. `allowUnplayable` says: I know this
    // class cannot win a fight, I am measuring something else.
    if (!isSelectable(char.id) && !this.allowUnplayable) {
      throw new Error(`[sim] "${char.id}" has no skill tree, so it has no way to deal damage — `
        + `${unselectableReason(char.id)} A run started with it could never clear a fight. `
        + `If you are testing something other than whether it can fight, pass allowUnplayable: true.`);
    }
    const p = {
      idx, name: member.name || `Player ${idx + 1}`, charId: char.id, char,
      color: member.color, gone: false,
      // HONOURED BY PRESENCE, not by trait name. This read
      //   char.trait.key === 'immovable' ? char.trait.hitbox : 1
      // and `immovable` was a RETIRED classic trait, so the Blacksmith's
      // crystal_infusion carried a hitbox of 1.4 that the sim ignored entirely
      // — a bigger target that was only bigger on screen. js/main.js already
      // special-cased both names; a data field should not need the engine to
      // know who owns it.
      x: 0, y: 0, radius: CONFIG.PLAYER_RADIUS * (char.trait.hitbox || 1),
      mx: 0, my: 0, interact: false, moving: false, aimA: 0, stillT: 0,
      hp: 1, shield: 0, downed: false, reviveP: 0, invuln: 0, pullX: 0, pullY: 0,
      // `xp` is the bar and RESETS on every level-up; `xpEarned` never does, so
      // anything measuring experience over a run reads the second one. Reading
      // the bar reports a smaller number the better the player did.
      level: 1, xp: 0, xpEarned: 0, xpNext: CONFIG.XP_BASE + CONFIG.XP_PER_LEVEL * 1,
      materials: 0, matsCollected: 0, banked: 0,
      // PER-INSTANCE ITEM STATE, beside `items` rather than inside it, because
      // `items` is a flat id array on the meta packet and every reader expects
      // that shape. id -> { pen, lvl }: `pen` is the stat §9.2's penalty rolled
      // into on the grant that created it, `lvl` is how many copies have been
      // bought into it (§9.3 item upgrades).
      itemState: {}, respecs: 0,
      weapons: [], items: [],
      boosts: {}, permStats: {}, tempStats: {},
      stats: null, hookAgg: null,
      weaponSlots: CONFIG.WEAPON_SLOT_MAX,
      reflexCap: CONFIG.DODGE_CAP, critMult: CONFIG.CRIT_MULT_BASE,
      firstHitUsed: false, nextCrit: false,
      tempoBuffT: 0, dmgBuffT: 0, dmgBuffAmt: 0,
      frenzy: [], secondWindUsed: false, blockT: 0,
      vitKillGained: 0,
      contactAuraAcc: 0, regenAcc: 0, healAcc: 0,
      damageDealt: 0, kills: 0,
      pendingOffer: null, treasureOffer: null,
      shop: null, shopLocksCarry: [], shopVisit: 0, rerollFlat: false, shrineOffer: null, shrineRerolls: 0,
      // rebalance trait state
      meter: 0,            // Onrush movement meter 0..1
      resonCharge: 0,      // Resonant hit charge
      lastFireT: -10,      // Overwatch cadence (sim time of last weapon fire)
      lastKillT: -10, roomFirstKillT: -10,
      critCounter: 0, critArmed: false, jesterOdds: 0,
      boonCounts: {}, boonOffer: null, boonTemp: null, openingOffer: null,
      spendOffer: 0,       // §5.5 map-end spend step: points waiting when the room cleared
      // ToH per-player state is stamped on by tohInitPlayer below
      roomVitGain: 0,      // Vesper per-room overheal→Vitality cap tracker
      carrying: null, channelT: 0, // Overseer turret carry/redeploy
      novaT: 0, heat: 0, heatDropT: 0, novaDamage: 0, // Pulsar's nova core
      relocT: 0,           // structure-recall channel (stand still to call them in)
      curses: [], pendingCurses: [], // cursed-item effects: next round, then gone
      metaDirty: true,
    };
    const t = char.trait;
    if (t.key === 'insider') { p.weaponSlots = t.slots; p.rerollFlat = true; }
    if (t.key === 'structures_fast') p.weaponSlots = t.slotCap;
    if (t.key === 'overseer') p.weaponSlots = t.mounts;
    if (t.key === 'nova_core') p.weaponSlots = t.slots;
    if (t.key === 'reflex_master') p.reflexCap = t.cap;
    if (t.key === 'executioner' || t.key === 'contract') p.critMult = t.openerCritMult || 3;
    // patch-trigger-core: weapons are gone. Skills replace them entirely, with
    // no toggle and no compatibility layer — a half-migrated combat model would
    // not answer the gate question, and this branch is disposable if it fails.
    //
    // The CONDITION moved to CONFIG so it is stated once. It used to be this
    // bare assignment, which meant nothing outside the engine could ask whether
    // weapons existed — and the browser suite went on asserting they did.
    if (!CONFIG.WEAPONS_ENABLED) p.weaponSlots = 0;
    SK.initSkillPlayer(this, p);
    this._recomputeItems(p);
    this._recomputeStats(p);
    p.hp = p.stats.vitality;
    tohInitPlayer(this, p);
    return p;
  }

  _initStartingGear(p) {
    // No starting weapon: the character's first skill point IS their opening
    // ability, chosen from the tier-1 nodes. Trait summons still spawn — they
    // are not weapons and are out of this patch's scope.
    const t = p.char.trait;
    if (true) {
      if (t.key === 'mirror_drone') this._spawnSummon(p, null, 1, 'mirror');
      if (t.key === 'free_drone_floor') this._spawnSummon(p, 'guard_drone', 1);
      if (t.key === 'pack_tactics') this._spawnSummon(p, 'guard_drone', 1, 'beast');
      return;
    }
    if (tohStartingGear(this, p)) { /* Necromancer: mounts, no weapons */ }
    else if (t.key === 'overseer') {
      // turrets ARE weapons for the Overseer: combinable, sellable, four mounts.
      // One to start — full inheritance makes each mount count.
      this._addWeapon(p, 'bolt_turret', 1);
    } else if (p.char.weapon) {
      this._addWeapon(p, p.char.weapon, 1);
    }
    if (t.key === 'mirror_drone') this._spawnSummon(p, null, 1, 'mirror');
    if (t.key === 'free_drone_floor') this._spawnSummon(p, 'guard_drone', 1);
    if (t.key === 'pack_tactics') this._spawnSummon(p, 'guard_drone', 1, 'beast');   // the first beast
  }

  _recomputeItems(p) {
    // aggregate item hooks once per inventory change (rebalance registry)
    const agg = {
      // healing sources (all amplified by Recovery)
      regen: 0, lifesteal: 0, killHeal: 0, materialHeal: [], roomClearHeal: 0, critHeal: 0,
      reviveSpeed: 0, secondWind: null, blockShield: null,
      // conditional stats + timed attack bonuses
      condStats: [], nextAttackAfterDodge: 0,
      // crit grants (crit is not a stat)
      critAfterKill: false, critEveryN: 0, critVsChilled: false, critVsBurning: false,
      critVsFullHp: false, firstHitCrit: false,
      // The two crit TERMS, as opposed to the six conditional GRANTS above.
      // §9.5: chance is Reflex plus items, multiplier is CONFIG.CRIT_MULT_BASE
      // plus items. No item in the catalog grants either yet — they are the
      // sites phase 4's magnitude tier writes into, and `item_gate` carries a
      // probe for each so the site is proven before an item is priced.
      critChance: 0, critMult: 0,
      // §9.2's last two tiers. Both are ADDITIVE by design and the field names
      // say so: `selectorAdd` makes a skill ALSO strike what a second selector
      // picks, `domainAdd` lets a skill resolve the triangle as the BEST of its
      // own domain and the granted one. "The rule for every modifier tier: an
      // item may add, never take away" — an item that rewrote a selector or a
      // domain outright could invalidate forty points of build with one shop
      // roll, which is exactly why trigger-swap items were deleted.
      selectorAdd: [], domainAdd: [],
      // pickup procs
      pickupBlast: [], pickupTempo: [], pickupBonusChance: 0,
      // status spreaders (attuned)
      burnOnHit: [], chillOnHit: [], chainOnHit: [], statusBoost: 0,
      // combat misc
      killExplode: [], thorns: 0, contactAura: [], onHurtRetaliate: [],
      killTempo: [], eliteBossDamage: 0, extraPierce: 0, extraProjectiles: 0, knockMult: 1,
      // party
      allyAura: [],
      // economy / growth
      doubleMaterials: 0, interest: [], freeRerolls: 0, shopDiscount: 0, xpBonus: 0,
      extraChoice: 0, levelStats: [], floorStats: [], vitalityOnKill: [],
      summonDmg: 0, summonHp: 0,
    };
    // HOOK BLOCKS, NOT ITEMS. An upgraded item applies its `perLevel.hooks`
    // block once per level past the first. Levels are NOT a blanket multiplier
    // over hook payloads: "stronger" is not the same direction for every field
    // — a lower `critEveryN` is stronger, a lower `chillOnHit.mult` is stronger
    // — and a generic ×1.5 would have quietly weakened three of them. An
    // explicit per-level block has no direction to get wrong.
    const blocks = [];
    for (const id of p.items) {
      const it = ITEM_BY_ID[id];
      if (!it) continue;
      if (it.hooks) blocks.push(it.hooks);
      const lvl = (p.itemState[id] && p.itemState[id].lvl) || 1;
      if (it.perLevel && it.perLevel.hooks) for (let i = 1; i < lvl; i++) blocks.push(it.perLevel.hooks);
    }
    for (const h of blocks) {
      if (h.regen) agg.regen += h.regen.hps;
      if (h.lifesteal) agg.lifesteal += h.lifesteal.pct;
      if (h.killHeal) agg.killHeal += h.killHeal.amount;
      if (h.materialHeal) agg.materialHeal.push(h.materialHeal);
      if (h.roomClearHeal) agg.roomClearHeal += h.roomClearHeal.amount;
      if (h.critHeal) agg.critHeal += h.critHeal.amount;
      if (h.reviveSpeed) agg.reviveSpeed += h.reviveSpeed.mult;
      if (h.secondWind && (!agg.secondWind || h.secondWind.healPercent > agg.secondWind)) agg.secondWind = h.secondWind.healPercent;
      if (h.blockShield && (!agg.blockShield || h.blockShield.cooldown < agg.blockShield)) agg.blockShield = h.blockShield.cooldown;
      if (h.condStats) agg.condStats.push(h.condStats);
      if (h.nextAttackAfterDodge) agg.nextAttackAfterDodge += h.nextAttackAfterDodge.bonus;
      if (h.critAfterKill) agg.critAfterKill = true;
      if (h.critEveryN) agg.critEveryN = agg.critEveryN ? Math.min(agg.critEveryN, h.critEveryN.n) : h.critEveryN.n;
      if (h.critVsChilled) agg.critVsChilled = true;
      if (h.critVsBurning) agg.critVsBurning = true;
      if (h.critVsFullHp) agg.critVsFullHp = true;
      if (h.firstHitCrit) agg.firstHitCrit = true;
      if (h.critChance) agg.critChance += h.critChance.percent;
      if (h.critMult) agg.critMult += h.critMult.add;
      if (h.selectorAdd) agg.selectorAdd.push(h.selectorAdd.select);
      if (h.domainAdd) agg.domainAdd.push(h.domainAdd.domain);
      if (h.pickupBlast) agg.pickupBlast.push(h.pickupBlast);
      if (h.pickupTempo) agg.pickupTempo.push(h.pickupTempo);
      if (h.pickupBonusChance) agg.pickupBonusChance = Math.min(1, agg.pickupBonusChance + h.pickupBonusChance.chance);
      if (h.burnOnHit) agg.burnOnHit.push(h.burnOnHit);
      if (h.chillOnHit) agg.chillOnHit.push(h.chillOnHit);
      if (h.chainOnHit) agg.chainOnHit.push(h.chainOnHit);
      if (h.statusBoost) agg.statusBoost += h.statusBoost.pct;
      if (h.killExplode) agg.killExplode.push(h.killExplode);
      if (h.thorns) agg.thorns += h.thorns.damage;
      if (h.contactAura) agg.contactAura.push(h.contactAura);
      if (h.onHurtRetaliate) agg.onHurtRetaliate.push(h.onHurtRetaliate);
      if (h.killTempo) agg.killTempo.push(h.killTempo);
      if (h.eliteBossDamage) agg.eliteBossDamage += h.eliteBossDamage.bonus;
      if (h.extraPierce) agg.extraPierce += h.extraPierce.add;
      if (h.extraProjectiles) agg.extraProjectiles += h.extraProjectiles.add;
      if (h.knockbackBoost) agg.knockMult *= (1 + h.knockbackBoost.mult);
      if (h.allyAura) agg.allyAura.push(h.allyAura);
      if (h.doubleMaterials) agg.doubleMaterials = Math.min(1, agg.doubleMaterials + h.doubleMaterials.chance);
      if (h.interest) agg.interest.push(h.interest);
      if (h.freeRerolls) agg.freeRerolls += h.freeRerolls.count;
      if (h.shopDiscount) agg.shopDiscount += h.shopDiscount.percent;
      if (h.xpBonus) agg.xpBonus += h.xpBonus.percent;
      if (h.extraChoice) agg.extraChoice += h.extraChoice.n;
      if (h.levelStats) agg.levelStats.push(h.levelStats);
      if (h.floorStats) agg.floorStats.push(h.floorStats);
      if (h.vitalityOnKill) agg.vitalityOnKill.push(h.vitalityOnKill);
      if (h.summonBoost) { agg.summonDmg += h.summonBoost.damage; agg.summonHp += h.summonBoost.hp; }
    }
    p.hookAgg = agg;
  }

  // Evaluate a conditional-item condition for player p (cheap; runs on the
  // 0.25s recompute cadence, so timed windows use sim time stamps).
  _condMet(p, cond) {
    switch (cond.kind) {
      // "Near" means near AND reachable. An item that arms itself because a
      // body stands on the far side of a pillar is arming on a fight the
      // player is not in — and `noEnemyNear` had the same hole inverted,
      // refusing to arm while safely behind cover.
      case 'enemyNear': {
        const e = this._nearestVisibleEnemy(p.x, p.y, cond.r || 60);
        return !!e;
      }
      case 'noEnemyNear': return !this._nearestVisibleEnemy(p.x, p.y, cond.r || 150);
      case 'hpAbove': return p.hp >= (p.stats ? p.stats.vitality : 80) * (cond.pct / 100);
      case 'hpBelow': return p.hp < (p.stats ? p.stats.vitality : 80) * (cond.pct / 100);
      case 'afterKill': return this.time - p.lastKillT < (cond.dur || 3);
      case 'firstKill': return p.roomFirstKillT >= 0 && this.time - p.roomFirstKillT < (cond.dur || 3);
      case 'moving': return p.moving;
      case 'still': return !p.moving;
      case 'roomEntry': return this.time - (this.roomEnteredT || 0) < (cond.dur || 10);
      case 'bossRoom': return !!this.boss;
      case 'allyNear': {
        for (const q of this.players) {
          if (q !== p && !q.gone && !q.downed && dist2(p.x, p.y, q.x, q.y) < (cond.r || 150) ** 2) return true;
        }
        return false;
      }
      case 'onMaterials': return true; // handled as per-stack in recompute
      default: return false;
    }
  }

  _materialsUnder(p, r = 30) {
    let n = 0;
    for (const m of this.pickups) if (dist2(p.x, p.y, m.x, m.y) < r * r) n++;
    return n;
  }

  _recomputeStats(p) {
    const s = {};
    for (const st of STATS) s[st.key] = STAT_BASE[st.key];
    const add = mods => { for (const k in mods) if (k in s) s[k] += mods[k]; };
    add(p.char.stats);
    // §9.2: an item's contribution is per-instance now — its level scales the
    // bonus and the rolled penalty rides with it — so the sheet asks the player
    // what the item is worth rather than asking the catalog what it says.
    for (const id of p.items) { const m = this._itemStats(p, id); if (m) add(m); }
    add(p.boosts);
    add(p.permStats);
    // Engines are readable resources that feed stats — Footing's per-stack
    // vitality/grit/dodge lands here so it composes with everything else rather
    // than being applied at the point of use.
    { const eb = SK.engineStatBonus(p); if (eb) add(eb); }
    const t = p.char.trait;
    const vitNow = p.stats ? p.stats.vitality : s.vitality;
    const hpFrac = p.stats ? clamp(p.hp / Math.max(1, vitNow), 0, 1) : 1;
    // Arsenal Doctrine: every held weapon feeds you the stats it scales with
    if (t.key === 'arsenal_doctrine') {
      for (const w of p.weapons) {
        const def = WEAPON_BY_ID[w.id];
        for (const key of def.scaling) {
          if (STAT_IS_PCT[key]) s[key] += 4 * w.tier;                 // percent tags: +4%/tier
          else s[key] += (key === 'vitality' ? 8 : key === 'reach' ? 12 : 2) * w.tier; // flat per tier
        }
      }
    }
    // cursed round: the player-side curses ride the sheet like any modifier
    if (p.curses && p.curses.length) {
      s.tempo += this._curse(p, 'tempo');
      s.reflex += this._curse(p, 'reflex');
    }
    // temporary/situational
    if (t.key === 'berserk_missing') s.ferocity += Math.round((1 - hpFrac) * 100) * t.perMissing;
    for (const f of p.frenzy) s.tempo += f.tempo;                      // killTempo stacks + pickup surges
    if (p.tempoBuffT > 0 && t.key === 'slipstream') s.tempo += t.tempo;
    if (p.boonTemp) add(p.boonTemp);                                   // Facet's room boon
    // conditional items
    if (p.hookAgg) {
      for (const c of p.hookAgg.condStats) {
        if (c.cond.kind === 'onMaterials') {
          const n = Math.min(c.cond.cap || 10, this._materialsUnder ? this._materialsUnder(p, c.cond.r || 30) : 0);
          for (const k in c.stats) if (k in s) s[k] += c.stats[k] * n;
        } else if (this._condMet(p, c.cond)) add(c.stats);
      }
    }
    // ally auras from items, and the Banneret standard
    for (const q of this.players || []) {
      if (q.gone || q.downed || !q.hookAgg) continue;
      if (q !== p) {
        for (const aura of q.hookAgg.allyAura) {
          if (dist2(p.x, p.y, q.x, q.y) <= aura.radius * aura.radius) add(aura.stats);
        }
      }
      const qt = q.char.trait;
      if (qt.key === 'standard_high') {
        const qVit = q.stats ? q.stats.vitality : 80;
        const radius = qt.radius + 0.5 * (q.stats ? q.stats.reach : 0);
        const power = (1 + qVit / 1000) * (q === p ? 0.5 : 1); // self at half effect
        if (dist2(p.x, p.y, q.x, q.y) <= radius * radius) {
          s.ferocity += qt.fer * power;
          s.recovery += qt.rec * power;
        }
      }
    }
    // conversions (after all raw adds)
    if (t.key === 'reflex_master') {
      s.vitality = Math.min(s.vitality, t.hpCap);
      s.ferocity += Math.min(s.reflex, t.cap) * t.ferPerReflex;
    }
    if (t.key === 'living_fortress') {
      s.ferocity += Math.max(0, s.grit - (p.char.stats.grit || 0)); // +1% Ferocity per bonus Grit
    }
    tohStats(this, p, s);   // the Thrones of Heaven sheet layer (no-op on classic)
    s.reflex = clamp(s.reflex, 0, p.reflexCap);
    s.vitality = Math.max(1, Math.round(s.vitality));
    const oldMax = p.stats ? p.stats.vitality : s.vitality;
    p.stats = s;
    if (s.vitality > oldMax) p.hp += s.vitality - oldMax; // growing Vitality grants the difference
    p.hp = Math.min(p.hp, s.vitality);
    p.metaDirty = true;
  }

  // Attuned damage: everything tagged elemental/status scales with Attunement
  // (+ any statusBoost items).
  _attuned(p, base) {
    return base * (1 + (p.stats.attunement + p.hookAgg.statusBoost) / 100);
  }

  // ---------------- the region & its rooms ----------------

  // A RUN IS ONE REGION. `_startFloor(n)` used to roll a fresh 14-node floor
  // map and be called again on extraction, four times; a region is entered
  // once, its tree is walked once, and the run ends at its boss. Advancing to
  // the next region is the WORLD MAP's job, not the sim's — the party leaves,
  // the frontier moves, and the next region is a new Sim with a new tree.
  _startRegion() {
    // The opening pick is offered once, before any node is chosen — §5.6 says
    // "at character start", and the map screen is the first thing a character
    // sees.
    for (const p of this.players) if (!p.gone) this._offerOpening(p);
    const reg = REGION_BY_INDEX[this.regionIndex];
    this.floor = this._parkedTree
      || generateTree(this.seed, reg || { id: `region_${this.regionIndex}`, index: this.regionIndex },
        0, { recent: this.objectiveHistory });
    this.phase = 'map';
    this.currentNode = null;
    this.visited = new Set();
    // A resumed region re-enters at the deepest node already cleared, so the
    // route continues rather than restarting.
    if (this._parkedCleared && this._parkedCleared.length) {
      const byKey = new Map(this.floor.nodes.map(n => [n.key, n]));
      let last = null;
      for (const key of this._parkedCleared) {
        const nd = byKey.get(key);
        if (!nd) continue;
        this.visited.add(nd.id);
        if (!last || nd.col > last.col) last = nd;
      }
      if (last) this.currentNode = last.id;
    }
    this.nodeVote = null;
    this.arenaNode = null;
    this.cleared = false;
    this.hatch = null; this.extract = null; this.afterSiege = false;
    this.boss = null;
    this.holdCircle = null; this.pylonId = null; this.enemyBuff = 1;
    for (const p of this.players) {
      if (p.gone) continue;
      if (p.pendingOffer) this.pushEvent({ k: 'offer', idx: p.idx, picks: p.pendingOffer, banked: p.banked });
      if (p.treasureOffer) this.pushEvent({ k: 'treasure', idx: p.idx, kind: p.treasureOffer.kind, picks: p.treasureOffer.picks });
      p.secondWindUsed = false;
    }
    this._mapEvent();
  }

  // THE BETWEEN-MAPS BEAT, which used to be the between-floors beat. A region
  // has five maps where the run had four floors, so the half-heal and the
  // per-floor trait grants move here — to the node transition — rather than
  // being lost with `_startFloor`. `free_drone_floor` and `pack_tactics` were
  // authored as "once per floor"; once per map is the same cadence in the
  // structure that replaced it, and it is the only reading that keeps them
  // firing at all.
  _betweenMaps() {
    for (const p of this.players) {
      if (p.gone) continue;
      this._heal(p, Math.ceil((p.stats.vitality - p.hp) * 0.5));
      for (const fs of p.hookAgg.floorStats) this._applyPerm(p, fs.stats);
      if (p.char.trait.key === 'free_drone_floor') this._spawnSummon(p, 'guard_drone', 1);
      if (p.char.trait.key === 'pack_tactics') {
        const t2 = p.char.trait;
        const alive = this.summons.filter(sm => sm.owner === p.idx && !sm.dead).length;
        if (alive < t2.maxBeasts) this._spawnSummon(p, 'guard_drone', 1, 'beast');
      }
    }
  }

  // ---------------- the node map (between fights) ----------------

  reachableNodes() {
    if (this.phase !== 'map') return [];
    if (this.currentNode === null) return [...this.floor.startIds];
    return [...this.floor.nodes[this.currentNode].edges];
  }

  // THE MAP IS STATE, NOT AN ANNOUNCEMENT. Built here and read by BOTH the
  // event (which still fires, for the floor banner and the overlay-closing that
  // are genuinely one-shot) and every snapshot while the party is on the map.
  //
  // The standing rule: if losing it breaks the game, it is state and rides the
  // snapshot; if losing it is cosmetic, it is an event and may be dropped. This
  // was delivered only as an event, so a client whose channel was not open at
  // that instant sat on a blank screen forever — receiving 30 map-mode
  // snapshots, with a clean console, while the host played on.
  _mapState() {
    return {
      layout: serializeMap(this.floor), regionIndex: this.regionIndex,
      regionName: (REGION_BY_INDEX[this.regionIndex] || {}).name || `Region ${this.regionIndex}`,
      current: this.currentNode, visited: [...this.visited], reachable: this.reachableNodes(),
    };
  }

  _mapEvent() {
    this.pushEvent({ k: 'map', ...this._mapState() });
  }

  // Any player taps a reachable node → 4s consent countdown on every screen.
  // A DIFFERENT player tapping a DIFFERENT node redirects it once, then the
  // selection locks. Solo taps travel immediately.
  _pickNode(idx, nodeId) {
    if (this.phase !== 'map' || this.over) return;
    if (!this.reachableNodes().includes(nodeId)) return;
    if (this.livePlayers().length <= 1) { this._travelTo(nodeId); return; }
    const v = this.nodeVote;
    if (!v) {
      this.nodeVote = { nodeId, byIdx: idx, t: VOTE_TIME, redirected: false };
      this.pushEvent({ k: 'nodeVote', nodeId, byIdx: idx, redirected: false });
      this.pushEvent({ k: 'sfx', s: 'door' });
    } else if (!v.redirected && v.byIdx !== idx && v.nodeId !== nodeId) {
      this.nodeVote = { nodeId, byIdx: idx, t: VOTE_TIME, redirected: true };
      this.pushEvent({ k: 'nodeVote', nodeId, byIdx: idx, redirected: true });
      this.pushEvent({ k: 'sfx', s: 'door' });
    } // redirected once → locked; further taps are ignored
  }

  _tickVote(dt) {
    if (!this.nodeVote) return;
    this.nodeVote.t -= dt;
    if (this.nodeVote.t <= 0) {
      const id = this.nodeVote.nodeId;
      this.nodeVote = null;
      this._travelTo(id);
    }
  }

  _travelTo(nodeId) {
    const node = this.floor.nodes[nodeId];
    this.currentNode = nodeId;
    this.visited.add(nodeId);
    this.nodeVote = null;
    if (node.kind === 'combat' || node.kind === 'elite' || node.kind === 'cursed' || node.kind === 'siege' || IS_OBJECTIVE[node.kind]) {
      this._enterArena(node);
      return;
    }
    // full-screen stops: the map stays the home screen underneath
    if (node.kind === 'shop') {
      for (const p of this.livePlayers()) this._openShop(p, `node${nodeId}`);
    } else if (node.kind === 'treasure') {
      for (const p of this.livePlayers()) this._offerTreasure(p, 'treasure');
    } else if (node.kind === 'shrine') {
      // §2.4's shrine: no combat, one choice, never both and never rolled.
      for (const p of this.livePlayers()) this._offerShrine(p);
    }
    this._mapEvent(); // next choices open immediately behind the stop
  }

  // ---------------- arenas (the stage) ----------------

  _enterArena(node) {
    for (const p of this.livePlayers()) this._floorOpeningAbility(p);
    const arena = buildArena(this.seed, this.regionIndex, node, this.players.length);
    this.phase = 'arena';
    this.arenaNode = node;
    this.W = arena.w; this.H = arena.h;
    this.biome = arena.biome || null;   // cosmetic: the renderer's only input
    this.obstacles = arena.obstacles;
    this.hazards = arena.hazards.map(h => ({ ...h }));
    this.cleared = false;
    this.hatch = null; this.extract = null;
    this.afterSiege = node.kind === 'siege';
    this.telegraphs.length = 0; this.zones.length = 0; this.vortexes.length = 0;
    this.activeBeams.length = 0;
    this.corals.length = 0; this.coralWalls.length = 0; this.singularities.length = 0;
    this.enemyPool.clear();
    this.projPool.clear();
    this.pickups.length = 0;
    this.spawnQueue = [];
    this.decoys.length = 0;
    this.boss = null;
    this.roomEnteredT = this.time;
    this.waveRng = subRng(this.seed, 'wave', this.regionIndex, node.id);
    // D-24. `nodeType` was read in two places and assigned in none, so every
    // fight in the game computed 'horde' and §2.4's node modifiers were
    // unreachable. Assigned here, at the one moment the node is known.
    this.nodeType = node.kind;
    // Resolved ONCE per fight rather than per spawn: the modifiers cannot
    // change mid-room, and a per-spawn call would put a region lookup inside
    // the spawn loop.
    this.fightMods = this.regionFightMods();
    // MAP INDEX, ZERO-BASED — the same parameter the floor map passed as
    // `node.col`. A tree node's `depth` is 1..5 where a floor column was 0..5,
    // so the −1 is what keeps map 1 sitting on exactly the numbers column 0
    // sat on: the onboarding ramp's 50%, and `waveConfig`'s shortest duration.
    // Passing `depth` raw would silently move every wave in the game by one
    // column's worth of rate and duration.
    this.regionColumn = node.depth || 1;
    const mapIdx = (node.depth || 1) - 1;
    this.wave = waveConfig(this.regionIndex, mapIdx, node.kind);
    // the fight's pressure profile: sieges are always high-friction; stops
    // have none; combat/elite carry the recipe rolled at map generation
    this.profile = node.kind === 'siege' ? PROFILES.siege : (PROFILES[node.profile] || PROFILES.mixed);
    // objective state (null on a plain horde arena) — set up before the first
    // tick so its scripted spawns and spawn-rate multiplier apply from t=0
    this.nestChoke = 1;
    this.walls = [];
    this.objHpMult = 1;
    this._buildRegion();
    initObjective(this, node);
    if (this.obj && objectiveEndless(node.kind)) this.wave.dur = Infinity;
    // Bastion streams from ONE arena edge (0=n 1=e 2=s 3=w) — a single front
    // is a queue, and holding ground against a queue is the sanctioned play
    this.fronts = [this.waveRng.int(0, 3)];
    this.fightLoot = 0;  // materials actually picked up this fight
    this.payout = { kills: 0, gold: 0, xp: 0 };  // and what the fight paid out
    this._goldAcc = 0;   // the difficulty multiplier's carried fraction, per fight
    this.lootT = null;   // the siege's post-boss looting countdown
    this.safe = false;   // the room is live again
    this._armCurses();   // last round's curses expire; this round's bite
    // siege script
    if (node.kind === 'siege') {
      this.mutations = arena.mutations;
      this.mutIdx = 0;
      this.siegeT = 0;
      this.bossSpawned = false;
      this.bossT = 0;
      this.siegeCfg = arena;
      const last = arena.mutations[arena.mutations.length - 1];
      this.bossAt = last.at + arena.bossDelay;
      this.pushEvent({ k: 'toast', idx: -1, text: arena.name });
    } else {
      this.mutations = null;
      this.bossAt = Infinity;
      this.siegeCfg = null;
      this.bossT = 0;
    }
    // drop the party in at the arena center — nudged off any obstacle that
    // covers it (cramped layouts can run walls through the exact midpoint).
    // Breach is the exception: you start at the mouth of the corridor with
    // the collapse behind you, or the level is a footrace you've already won.
    const dropX = node.kind === 'breach' ? WALL + 190 : arena.w / 2;
    const [rx, ry] = this.mainRegionSpot(dropX, arena.h / 2);
    const [cx, cy] = this._clearSpot(rx, ry, 40);
    this.players.forEach((p, i) => {
      if (p.gone) return;
      const [sx, sy] = this._clearSpot(
        cx + (i % 2 ? -1 : 1) * (30 + 20 * Math.floor(i / 2)),
        cy + (i < 2 ? -1 : 1) * 26, p.radius + 6);
      p.x = sx; p.y = sy;
      p.firstHitUsed = false;
      p.pullX = p.pullY = 0;
      p.hp = p.stats.vitality;   // every room starts at full health
      // §8.5, rows 5 and 7, and they are one moment because they are two halves
      // of the same rule: the Necromancer's summons WIPE and the Druid's pack
      // PERSISTS. Skeletons leave, so every fight ramps from zero and capacity
      // never compounds across a map; animals are restored, so the pack is a
      // standing commitment rather than something re-earned each room.
      SK.startRoomMinions(this, p);
      // per-FIGHT trait state (the old per-room triggers)
      p.roomVitGain = 0;        // Vesper's overheal→Vitality cap
      p.roomFirstKillT = -10;
      p.boonTemp = null;        // Facet's boon expires with the fight
      p.boonOffer = null;
      tohStartFight(this, p);
      if (p.char.trait.key === 'prism' && !p.downed) this._offerBoon(p);
      if (p.char.trait.key === 'wildshape' && !p.downed) this._offerBoon(p);
    });
    // every structure rides along on a room change: revived, unpacked, and
    // scattered around its owner so a stack of turrets doesn't fuse into one
    for (const s of this.summons) {
      if (s.dead) { s.dead = false; s.hp = s.maxHp; }
      s.deployT = 0; s.carried = false;
    }
    for (const p of this.players) {
      if (p.gone) continue;
      p.relocT = 0; p.carrying = null;
      this.relocateStructures(p, { all: true, instant: true });
    }
    // Same rule as the map: the room a client is standing in is state. The
    // event still fires for its banner; the geometry rides every snapshot.
    // `obstacles` is rebuilt each call rather than cached, so the siege
    // collapse — which used to need its own one-shot `obstacles` event to
    // mutate the client's copy — is simply carried by the next snapshot.
    // `biome` is deliberately NOT in this block. The block rides every snapshot;
    // the biome is a static per-floor cosmetic, and by the standing rule — if
    // losing it breaks the game it is state, if losing it is cosmetic it is an
    // event — it is an event. A client that misses it draws the flat floor,
    // which is degraded, not broken. Putting it in `st` cost per-frame
    // bandwidth for a string that never changes, and sim_test caught it.
    this._arena = {
      nodeId: node.id, kind: node.kind, template: node.template,
      name: arena.name, w: arena.w, h: arena.h,
      hazards: this._serializeHazardDefs(),
    };
    this.pushEvent({ k: 'arena', ...this._arena, biome: this.biome, obstacles: this._snapObstacles() });
  }

  // The arena block for the snapshot. Obstacles are read live so a wall that
  // changes mid-siege reaches every client on the next snapshot whether or not
  // the `obstacles` event survived.
  _arenaState() {
    if (this.phase !== 'arena' || !this._arena) return null;
    return { ...this._arena, obstacles: this._snapObstacles() };
  }

  _serializeHazardDefs() {
    return (this.hazards || []).map(h => h.type === 'spikes'
      ? { type: 'spikes', x: h.x, y: h.y, w: h.w, h: h.h }
      : { type: 'lava', x: h.x, y: h.y, r: h.r });
  }

  // Budget-curve spawning: rate ramps r0→r1 over rampT, runs for dur seconds
  // (forever in sieges), then stops; the fight ends when the field is cleared.
  _tickWave(dt) {
    const w = this.wave;
    if (!w || w.done) return;
    w.t += dt;
    if (w.t >= w.dur) { w.done = true; return; }
    let rate = (w.r0 + (w.r1 - w.r0) * Math.min(1, w.t / w.rampT)) * this.coopSpawn * CONFIG.spawnBudgetMult
      * ((this.profile && this.profile.rateMult) || 1)
      * ((this.fightMods && this.fightMods.count) || 1)   // §2.4: an Elite node fields FEWER
      * objectiveSpawnMult(this);
    if (this.boss) {
      // "reduced add spawns" while the boss is up — and tapering to silence,
      // so a siege is never an unwinnable DPS race against infinite inflow:
      // once the taper runs out the fight is finite (boss + standing field)
      this.bossT += dt;
      const taper = Math.max(0, 1 - this.bossT / 75);
      rate *= (this.siegeCfg ? this.siegeCfg.addRate : 0.35) * taper;
      if (taper === 0) { w.done = true; return; } // survivors rush (enemies.js)
    }
    if (this.holdCircle && this.holdCircle.held) rate *= 0.3; // the sigil chokes the spawning
    // the accumulator IS the bank: when the alive ceiling binds below, budget
    // pools here (capped) and flows in as slots free — longer, never laggier
    w.acc = Math.min(CONFIG.SPAWN_BANK_CAP, w.acc + rate * dt);
    // elite injections (elite nodes and sieges)
    if (w.eliteEvery > 0) {
      w.eliteT -= dt;
      if (w.eliteT <= 0) {
        if (this.enemyPool.count + this.spawnQueue.length >= Math.min(CONFIG.ALIVE_CEILING, CONFIG.POOL_ENEMIES - 10)) {
          w.eliteT = 2; // ceiling bound — the champion waits for a slot
        } else {
          w.eliteT = w.eliteEvery;
          const table = this._spawnTable(true);
          const id = this.waveRng.pick(table.filter(t => t !== 'wombden'));
          const pos = this._spawnWavePos();
          this.spawnQueue.push({ t: 0.7, id, elite: true, mod: this.waveRng.pick(ELITE_MODS), x: pos.x, y: pos.y });
          this.addTelegraph({ shape: 'circle', x: pos.x, y: pos.y, r: 34, dur: 0.7, spawnMark: true });
        }
      }
    }
    let guard = 0;
    while (w.acc >= 1 && guard++ < 20) {
      // ceiling check BEFORE spending the unit: a bound ceiling banks the
      // budget in w.acc instead of discarding it
      if (this.enemyPool.count + this.spawnQueue.length >= Math.min(CONFIG.ALIVE_CEILING, CONFIG.POOL_ENEMIES - 10)) break;
      w.acc -= 1;
      const prof = this.profile || {};
      // REGION POPULATIONS OVERRIDE THE FLOOR TABLE. `this.region` is the
      // region id the party entered from the world map; when it is set, waves
      // draw from that region's weighted population — and from its HEAVY half
      // on an elite node — instead of the base twelve. That is what makes a
      // region a place rather than a skin, and it is what carries the 50%
      // telegraph density into real rooms rather than only into the F7 pit.
      // `table` stays in scope: the profile levers and the per-type spawn caps
      // below both fall back to it. Scoping it inside the `if` compiled fine
      // and threw `table is not defined` on the first capped spawn — caught by
      // the telegraph suite, not by node --check, which is the whole argument
      // for running the suites rather than the parser.
      const regionPop = this._regionPick();
      const table = this._spawnTable(regionPop);
      let id = regionPop || table[Math.floor(this.waveRng.float() * table.length)];
      let mortar = false, puddle = false;
      // profile levers shape the roll: flankers become wave citizens,
      // artillery turns Lobbers into mortars, chaff picks up death-puddles
      // THE FLANKER LEVER BYPASSES THE TABLE, and on map 1 that is the whole
      // problem. `gyre` and `lancerfish` are in NO floor-1 table, yet measured on
      // the live build they were two of the SEVEN archetypes a level-1 character
      // met — the profile injects them regardless of what the table says. An
      // onboarding table that did not also close this door would have cut five
      // archetypes to three and still delivered five.
      //
      // AND THE SAME DOOR IS OPEN AT THE REGION. Wiring regions made this the
      // third instance: both levers name BASE-ROSTER ids, so a Pacific
      // Northwest fight fielded `gyre` and `lancerfish` beside its saplings and
      // a Xibalba fight fielded `lobber` — measured, both showed up in the
      // wiring gate's own sample. The onboarding fix closed the door for one
      // room; the levers were still a hole in every region.
      //
      // The lever's INTENT survives: it asks for a flanker-shaped or
      // artillery-shaped spawn, which is a role rather than an id. Resolved
      // against the region's own roster by `behavior`, a region keeps its
      // pressure and stops borrowing somebody else's monsters. `_leverPick`
      // returns null when there is no region or no match, and the base ids are
      // then exactly what they always were.
      if (!this._onboarding() && prof.flankers && this.waveRng.chance(prof.flankers)) {
        id = this._leverPick(FLANKER_BEHAVIORS) || (this.waveRng.chance(0.5) ? 'gyre' : 'lancerfish');
      } else if (!this._onboarding() && prof.artillery && this.waveRng.chance(prof.artillery)) {
        // AND THE ARTILLERY LEVER IS THE SAME DOOR. It hard-assigns `lobber`
        // regardless of the table, so closing only the flanker one cut seven
        // archetypes to four rather than three — measured, `lobber` was still
        // 9-12 of every 39 spawns. Every lever that names an id instead of
        // drawing from the table has to be closed, and these are both of them.
        id = this._leverPick(ARTILLERY_BEHAVIORS) || 'lobber'; mortar = true;
      }
      if (prof.ban && prof.ban.includes(id)) { id = table[0] === id ? table[1] : table[0]; mortar = false; }
      const cap = SPAWN_CAPS[id] && Math.round(SPAWN_CAPS[id] * CONFIG.spawnBudgetMult);
      if (cap && this._aliveOfType(id) >= cap) { id = table[0] === id ? table[1] : table[0]; mortar = false; }
      if (prof.puddle && (id === 'skulker' || id === 'flit') && this.waveRng.chance(prof.puddle)) puddle = true;
      const pos = this._spawnWavePos();
      const bx = objectiveSpawnX(this); // Breach: both ends of the live segment
      if (bx !== null) pos.x = bx;
      this.spawnQueue.push({ t: 0.7, id, x: pos.x, y: pos.y, mortar, puddle });
      this.addTelegraph({ shape: 'circle', x: pos.x, y: pos.y, r: 26, dur: 0.7, spawnMark: true });
    }
  }

  _aliveOfType(id) {
    let n = 0;
    for (const e of this.enemyPool) if (!e.boss && e.def.id === id) n++;
    return n;
  }

  // Spawn geometry is the profile's first lever:
  //  - ring (default outside Bastion): the swarm assembles around the players'
  //    CURRENT positions, just off-screen, biased toward backs and flanks.
  //    Co-op merges per-player rings (anchor rotates; never on anyone's screen).
  //  - fronts (Bastion): enemies stream in from two arena edges — the
  //    hold-your-ground fight.
  _spawnWavePos() {
    const rng = this.waveRng;
    const live = this.livePlayers().filter(p => !p.downed);
    if (this.profile && this.profile.ring && live.length) {
      for (let tries = 0; tries < 24; tries++) {
        const anchor = live[Math.floor(rng.float() * live.length)];
        let a = rng.float() * Math.PI * 2;
        if (anchor.moving) {
          // bias behind and beside the runner — the swarm cuts off retreat
          const back = Math.atan2(-anchor.my, -anchor.mx);
          a = back + (rng.float() - 0.5) * Math.PI * 1.5;
        }
        const R = 640 + rng.float() * 180;
        const x = clamp(anchor.x + Math.cos(a) * R, WALL + 40, this.W - WALL - 40);
        const y = clamp(anchor.y + Math.sin(a) * R, WALL + 40, this.H - WALL - 40);
        if (this._inObstacle(x, y, 24)) continue;
        let ok = true;
        for (const p of live) if (dist2(x, y, p.x, p.y) < 520 * 520) { ok = false; break; }
        if (ok) return { x, y };
      }
    }
    if (this.profile && !this.profile.ring) {
      // Bastion fronts: stream along the fight's two designated edges
      for (let tries = 0; tries < 24; tries++) {
        const edge = this.fronts[Math.floor(rng.float() * this.fronts.length)];
        const along = rng.float();
        const inset = WALL + 50 + rng.float() * 60;
        const x = edge === 1 ? this.W - inset : edge === 3 ? inset : WALL + 60 + along * (this.W - 2 * WALL - 120);
        const y = edge === 0 ? inset : edge === 2 ? this.H - inset : WALL + 60 + along * (this.H - 2 * WALL - 120);
        if (this._inObstacle(x, y, 24)) continue;
        let ok = true;
        for (const p of live) if (dist2(x, y, p.x, p.y) < 300 * 300) { ok = false; break; }
        if (ok) return { x, y };
      }
    }
    for (let tries = 0; tries < 24; tries++) {
      const x = WALL + 60 + rng.float() * (this.W - 2 * WALL - 120);
      const y = WALL + 60 + rng.float() * (this.H - 2 * WALL - 120);
      if (this._inObstacle(x, y, 24)) continue;
      let ok = true;
      for (const p of live) if (dist2(x, y, p.x, p.y) < 300 * 300) { ok = false; break; }
      if (ok) return { x, y };
    }
    return { x: clamp(this.W / 2 + (rng.float() - 0.5) * this.W * 0.8, WALL + 60, this.W - WALL - 60), y: WALL + 80 };
  }

  // fight over when the budget is spent and the field is empty
  _checkFightClear() {
    if (this.phase !== 'arena' || this.cleared || this.over) return;
    if (this.arenaNode.kind === 'siege') return; // sieges end on the boss, not on empty
    // objective levels clear on their own win condition, not on an empty field
    if (this.obj) { if (this.obj.done) this._clearFight(); return; }
    if (!this.wave.done || this.spawnQueue.length > 0 || this.enemyPool.count > 0) return;
    this._clearFight();
  }

  // The instant a fight's win condition is met — before ANY popup appears —
  // the room becomes inert. Nothing may damage a player who is reading a
  // level-up card: no enemies, no projectiles in flight, no spawning, and no
  // level mechanic (storm burn, the Breach collapse, cursed artillery, death
  // puddles, zone damage, spikes, lava, telegraphed impacts).
  _sanitizeArena() {
    for (const e of [...this.enemyPool]) { e.mats = 0; this._killEnemy(e, null); }
    this.enemyPool.clear();
    this.projPool.clear();            // both sides' projectiles
    this.spawnQueue.length = 0;
    if (this.wave) this.wave.done = true;
    this.telegraphs.length = 0;       // nothing lands after the fight ends
    this.zones.length = 0;            // acid puddles, lava fields, zone damage
    this.vortexes.length = 0;
    this.activeBeams.length = 0;
    this.hazards = [];                // spike strips and lava pockets go quiet
    this.holdCircle = null;
    this.barrageT = Infinity;         // no cursed salvo lands on a shop screen
    this.curseBarrage = 0;
    this.decoys.length = 0;
    this.safe = true;                 // asserted by the suites
  }

  _clearFight() {
    this.cleared = true;
    this._sanitizeArena();   // safety first, popups second
    // money doesn't wait: no end-of-fight vacuum — whatever wasn't collected
    // during the fight fizzles the moment the last enemy dies, and the banner
    // reports both numbers so the rule teaches itself
    const lost = this._fizzleLoot();
    this.pushEvent({ k: 'roomClear', collected: this.fightLoot, lost });
    this.pushEvent({ k: 'sfx', s: 'door' });
    for (const p of this.livePlayers()) this._clearRewards(p);
    if (this.arenaNode.kind === 'elite' || this.arenaNode.kind === 'elite_arena' || this.arenaNode.kind === 'bounty') {
      for (const p of this.livePlayers()) this._offerTreasure(p, 'elite');
    }
    // the valley after every peak: extraction includes a shop browse
    for (const p of this.livePlayers()) tohClearFight(this, p);   // Blacksmith: infuse a crystal
    // POINTS, THEN ITEMS. Both are opened here; the ordering is the client's
    // stacking rather than a host-side gate — see _offerSpend.
    for (const p of this.livePlayers()) this._offerSpend(p);
    for (const p of this.livePlayers()) this._openShop(p, 'clear');
    // The extraction portal — leave via the same consent countdown. Breach is
    // the exception: its far gate IS the portal, so there is no mid-map hatch
    // to walk back to. You spent the whole corridor earning that door; opening
    // a second exit behind you would undo the point of the level.
    this.hatch = this.obj && this.obj.type === 'breach' && this.obj.gate
      ? { x: this.obj.gate.x, y: this.obj.gate.y }
      : this._openSpot(this.W / 2, this.H / 2);
  }

  // What a save parks: the STABLE KEYS of the nodes already walked, not their
  // ids. Ids are indices into a generated array and a regeneration renumbers
  // them; `1A` is `1A` forever.
  clearedKeys() {
    return [...this.visited].map(id => this.floor.nodes[id]).filter(Boolean).map(n => n.key);
  }

  _openSpot(x, y) {
    // nudge a point out of any obstacle
    for (let tries = 0; tries < 20 && this._inObstacle(x, y, 60); tries++) {
      x += (this.rng.float() - 0.5) * 300; y += (this.rng.float() - 0.5) * 300;
      x = clamp(x, WALL + 80, this.W - WALL - 80); y = clamp(y, WALL + 80, this.H - WALL - 80);
    }
    return { x, y };
  }

  // uncollected materials vanish — visibly (little pops where they sat)
  _fizzleLoot() {
    let lost = 0;
    for (let i = 0; i < this.pickups.length; i++) {
      lost += this.pickups[i].v;
      if (i < 14) this.fx.booms.push({ x: Math.round(this.pickups[i].x), y: Math.round(this.pickups[i].y), r: 12 });
    }
    this.pickups.length = 0;
    return Math.round(lost);
  }

  // the Siege's looting window: after the boss dies, a visible countdown to
  // sweep the field before the spoils fizzle and extraction opens
  _tickLoot(dt) {
    if (this.lootT === null || this.lootT === undefined || this.over) return;
    this.lootT -= dt;
    if (this.lootT > 0) return;
    this.lootT = null;
    const lost = this._fizzleLoot();
    this.pushEvent({ k: 'lootOver', collected: this.fightLoot, lost });
    // THE REGION BOSS ENDS THE RUN. There is no floor 2 to descend to: a run is
    // one region, and what follows is the world map, the frontier advance and
    // the class unlock — none of which the sim owns. The post-boss shop still
    // opens, because the spoils of the boss are spent before leaving.
    this.regionCleared = true;
    this.pushEvent({ k: 'regionCleared', regionIndex: this.regionIndex,
      regionId: this.region, objectives: this.floor.objectives || [] });
    // The post-boss shop still opens and the portal still appears — the spoils
    // of the boss are spent before leaving, exactly as they were between
    // floors. What changed is where the portal GOES: out of the region, to the
    // world map, rather than down to a floor that no longer exists.
    this.hatch = this._openSpot(this.W / 2, this.H / 2);
    for (const p of this.livePlayers()) this._offerSpend(p);   // points, then items
    for (const p of this.livePlayers()) this._openShop(p, 'boss');
  }

  // Extraction: any live player standing on the portal runs the 4s countdown
  // (shown on every screen); stepping off cancels it.
  _tickExtract(dt) {
    if (!this.hatch || this.over) return;
    let on = false;
    for (const p of this.livePlayers()) {
      if (!p.downed && dist2(p.x, p.y, this.hatch.x, this.hatch.y) < 70 * 70) { on = true; break; }
    }
    if (!on) { this.extract = null; return; }
    if (!this.extract) {
      this.extract = { t: VOTE_TIME };
      this.pushEvent({ k: 'sfx', s: 'door' });
    } else {
      this.extract.t -= dt;
      if (this.extract.t <= 0) {
        this.extract = null;
        // Leaving the boss room leaves the REGION. The run is over and it is a
        // win; the frontier advance, the class unlock and the next region are
        // the world map's business.
        if (this.afterSiege) this._finish(true);
        else this._finishNode();
      }
    }
  }

  _finishNode() {
    const node = this.arenaNode;
    this.phase = 'map';
    this.arenaNode = null;
    this.wave = null;
    this.hatch = null; this.extract = null;
    this.enemyPool.clear(); this.projPool.clear();
    this.pickups.length = 0; this.decoys.length = 0;
    this.telegraphs.length = 0; this.zones.length = 0; this.vortexes.length = 0;
    this.hazards = [];
    // boons expire with the fight, and so does the map-end spend step — the
    // moment has passed, and the ◆ badge is what carries unspent points forward
    for (const p of this.players) { p.boonTemp = null; p.boonOffer = null; p.spendOffer = 0; }
    for (const p of this.livePlayers()) this._recomputeStats(p);
    // The between-maps beat: half of missing HP back, the per-map trait grants.
    // Between FLOORS is where these used to live, and a region has no floors —
    // dropping them would have quietly retired `free_drone_floor`,
    // `pack_tactics` and every `floorStats` item in the catalogue.
    this._betweenMaps();
    this._mapEvent();
  }

  // §2.4's SHRINE. No combat. The party chooses one: a skill point, or one
  // guaranteed shop reroll. Never both, never rolled — the two options are
  // fixed, which is what makes it a decision rather than a drop.
  //
  // `shrineOffer()` has existed in nodebehaviour.js since the region shell and
  // had no caller, because no structure in the game could place a shrine node.
  // The tree places one per region.
  _offerShrine(p) {
    if (p.shrineOffer) return;
    p.shrineOffer = shrineOffer();
    this.pushEvent({ k: 'shrine', idx: p.idx, choices: p.shrineOffer.choices });
  }

  _takeShrine(p, id) {
    if (!p.shrineOffer) return;
    const grant = applyShrine(id);
    if (!grant) return;                 // not one of the two — ignore, keep the offer
    p.shrineOffer = null;
    for (let i = 0; i < grant.skillPoints; i++) SK.grantSkillPoint(this, p);
    // NOT `p.hookAgg.freeRerolls` — that field is recomputed from items on
    // every stat pass and anything added to it is erased at the next one. The
    // shrine's reroll is a granted resource, so it gets its own counter and the
    // shop adds the two together.
    p.shrineRerolls = (p.shrineRerolls || 0) + grant.rerolls;
    this.pushEvent({ k: 'toast', idx: p.idx,
      text: grant.skillPoints ? `+${grant.skillPoints} skill point` : `+${grant.rerolls} free reroll` });
  }

  // ---------------- the Siege (mutations, sub-objectives, the boss) ----------------

  _tickSiege(dt) {
    if (this.phase !== 'arena' || this.arenaNode.kind !== 'siege' || this.over || this.cleared) return;
    this.siegeT += dt;
    // scripted mutations
    while (this.mutIdx < this.mutations.length && this.siegeT >= this.mutations[this.mutIdx].at) {
      this._applyMutation(this.mutations[this.mutIdx++]);
    }
    // hold-circle contest state
    if (this.holdCircle) {
      const c = this.holdCircle;
      c.held = this.livePlayers().some(p => !p.downed && dist2(p.x, p.y, c.x, c.y) < c.r * c.r);
    }
    // the floor boss enters (once) after the final mutation
    if (!this.bossSpawned && this.siegeT >= this.bossAt) {
      this.bossSpawned = true;
      this._spawnSiegeBoss();
    }
  }

  _applyMutation(m) {
    this.shake = Math.max(this.shake, 7);
    this.pushEvent({ k: 'mutation', kind: m.kind, text: m.text });
    this.pushEvent({ k: 'sfx', s: 'boom' });
    // the vault shifts and the fallen stir — every mutation revives at 25%
    for (const p of this.livePlayers()) if (p.downed) this._revive(p, 0.25);
    if (m.kind === 'collapse') {
      for (const o of this.obstacles) {
        if (o.group === m.group) this.fx.booms.push({ x: o.x + o.w / 2, y: o.y + o.h / 2, r: Math.max(o.w, o.h) });
      }
      this.obstacles = this.obstacles.filter(o => o.group !== m.group);
      this.pushEvent({ k: 'obstacles', obstacles: this._snapObstacles() });
    } else if (m.kind === 'hazard_field') {
      this.hazards.push({
        type: 'lava', x: m.from.x, y: m.from.y, r: m.r, dps: m.dps, acc: 0,
        vx: (m.to.x - m.from.x) / m.travel, vy: (m.to.y - m.from.y) / m.travel, travelT: m.travel,
      });
      this.addTelegraph({ shape: 'circle', x: m.from.x, y: m.from.y, r: m.r, dur: 2 });
    } else if (m.kind === 'pylon') {
      this._spawnPylon(m.x, m.y);
    } else if (m.kind === 'circle') {
      this.holdCircle = { x: m.x, y: m.y, r: m.r, held: false };
    }
  }

  _spawnPylon(x, y) {
    const e = this.enemyPool.alloc();
    if (!e) return;
    const hp = Math.round(PYLON_DEF.hp * regionHpMult(this.regionIndex) * this.coopHp * CONFIG.enemyHpMult);
    Object.assign(e, {
      id: ++this.spawnCounter, def: PYLON_DEF, typeIdx: -2, boss: false, bossDef: null,
      x, y, hp, maxHp: hp, radius: PYLON_DEF.radius, spd: 0, dmg: 0, dmgScale: 1,
      mats: PYLON_DEF.mats, mini: false, elite: false, eliteMod: null,
      domain: PYLON_DEF.domain,
      t: 0, phase: 0, slowT: 0, slowMult: 1, burnT: 0, burnDps: 0, burnOwner: null,
      markT: 0, markBy: -1, markHeal: 0, markRadius: 0,   // §13 rule 8: pooled slots inherit nothing
      drench: 0, drenchT: 0, drenchBy: -1,
      hitFlash: 0, knockX: 0, knockY: 0, contactCd: 0, fusing: false, blockT: 0,
      fireT: 0, healTarget: null, brood: null, shape: PYLON_DEF.shape, color: PYLON_DEF.color,
      hitStamps: {}, echoCd: 0, bulwarkCd: 0,
      slideSide: 0,   // pooled slots must not inherit a half-rounded corner
    });
    this.pylonId = e.id;
    this.enemyBuff = 1.3; // while the pylon stands, everything hits harder
    this.addTelegraph({ shape: 'circle', x, y, r: 90, dur: 1.2 });
  }

  _spawnSiegeBoss() {
    const def = bossForRegion(this.regionIndex);
    const e = this.enemyPool.alloc();
    if (!e) return;
    // enter away from the party's centroid
    const live = this.livePlayers();
    const cx = live.reduce((s, p) => s + p.x, 0) / Math.max(1, live.length);
    const x = cx < this.W / 2 ? this.W * 0.8 : this.W * 0.2;
    Object.assign(e, {
      id: ++this.spawnCounter, def: null, typeIdx: -1, boss: true, bossDef: def, bs: {},
      x, y: this.H * 0.3, hp: Math.round(def.hp * this.coopHp * this.greedHp * CONFIG.enemyHpMult),
      maxHp: Math.round(def.hp * this.coopHp * this.greedHp * CONFIG.enemyHpMult),
      radius: def.radius, spd: def.spd, dmg: def.dmg, dmgScale: 1, mats: def.mats,
      domain: def.domain || null,
      telState: 0, telT: 0, telZone: null, telCaught: null,   // pooled slots must not inherit a wind-up
      telCd: def.telegraph ? def.telegraph.cooldownMs / 1000 * this.rng.float() : 0,
      elite: false, eliteMod: null, t: 0, phase: 0, slowT: 0, slowMult: 1,
      markT: 0, markBy: -1, markHeal: 0, markRadius: 0,
      drench: 0, drenchT: 0, drenchBy: -1,
      burnT: 0, hitFlash: 0, knockX: 0, knockY: 0, contactCd: 0, shape: def.shape, color: def.color,
      hitStamps: {}, echoCd: 0, bulwarkCd: 0,
      slideSide: 0,   // pooled slots must not inherit a half-rounded corner
    });
    this.boss = e;
    this.addTelegraph({ shape: 'circle', x, y: this.H * 0.3, r: def.radius + 60, dur: 1.5 });
    this.pushEvent({ k: 'bossSpawn', name: def.name });
  }

  // ---------------- obstacles ----------------

  // The arena's MAIN open region, flood-filled once per room from the coarse
  // free grid. Arena templates can wall off a chamber that nothing reaches:
  // one measured floor-1 layout sealed a 708x730 pocket and dropped the party
  // straight into it, which reads to a player as "the level is broken". So the
  // drop point and every piece of objective furniture is placed HERE, and the
  // sealed corners stay the scenery they were always meant to be.
  _buildRegion() {
    const C = 40;
    const cols = Math.ceil(this.W / C), rows = Math.ceil(this.H / C);
    const free = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * C + C / 2, y = j * C + C / 2;
        const inside = x > WALL + 22 && y > WALL + 22 && x < this.W - WALL - 22 && y < this.H - WALL - 22;
        free[j * cols + i] = (inside && !this._inObstacle(x, y, 22)) ? 1 : 0;
      }
    }
    const seen = new Int32Array(cols * rows).fill(-1);
    let best = -1, bestN = 0;
    for (let start = 0; start < free.length; start++) {
      if (!free[start] || seen[start] >= 0) continue;
      const q = [start];
      seen[start] = start;
      for (let h = 0; h < q.length; h++) {
        const c = q[h], ci = c % cols, cj = (c / cols) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
          const n = nj * cols + ni;
          if (!free[n] || seen[n] >= 0) continue;
          seen[n] = start; q.push(n);
        }
      }
      if (q.length > bestN) { bestN = q.length; best = start; }
    }
    const ok = new Uint8Array(cols * rows);
    for (let i = 0; i < ok.length; i++) ok[i] = seen[i] === best ? 1 : 0;
    this._reg = { C, cols, rows, ok, count: bestN };
  }

  inMainRegion(x, y) {
    const r = this._reg;
    if (!r || !r.count) return true;
    const i = clamp((x / r.C) | 0, 0, r.cols - 1), j = clamp((y / r.C) | 0, 0, r.rows - 1);
    return !!r.ok[j * r.cols + i];
  }

  // Nearest point inside the main region — used for the party's drop point.
  mainRegionSpot(x, y) {
    const r = this._reg;
    if (!r || !r.count || this.inMainRegion(x, y)) return [x, y];
    const pi = clamp((x / r.C) | 0, 0, r.cols - 1), pj = clamp((y / r.C) | 0, 0, r.rows - 1);
    let best = null, bd = Infinity;
    for (let j = 0; j < r.rows; j++) for (let i = 0; i < r.cols; i++) {
      if (!r.ok[j * r.cols + i]) continue;
      const d = (i - pi) ** 2 + (j - pj) ** 2;
      if (d < bd) { bd = d; best = [i, j]; }
    }
    return best ? [best[0] * r.C + r.C / 2, best[1] * r.C + r.C / 2] : [x, y];
  }

  // The wire form: [x, y, w, h, destructible]. The flag lets the renderer draw
  // a barricade as a barricade, and this payload is what client-side movement
  // prediction collides with. Damage state does NOT ride here — it goes in the
  // objective blob, and only for the barricades that are actually damaged.
  _snapObstacles() {
    return this.obstacles.map(o => [o.x, o.y, o.w, o.h, o.destructible ? 1 : 0]);
  }

  // A destructible barricade. It lives in `obstacles` too, so it blocks
  // movement, projectiles and line of sight exactly like arena scenery — the
  // only difference is that it can be taken apart.
  addWall(x, y, w, h, hp, meta = {}) {
    const wall = { x, y, w, h, hp, maxHp: hp, destructible: true, ...meta };
    this.obstacles.push(wall);
    this.walls.push(wall);
    return wall;
  }

  _wallAt(x, y, r = 0) {
    for (const w of this.walls) {
      if (x > w.x - r && x < w.x + w.w + r && y > w.y - r && y < w.y + w.h + r) return w;
    }
    return null;
  }

  damageWall(w, dmg, owner) {
    if (!w || w.hp <= 0) return;
    w.hp -= dmg;
    // A barricade is a landing too. The trait layer observes hits on bodies in
    // skillDamage; this is the same observation for the other thing a skill can
    // legitimately connect with, and it is why a Sundian cutting through a Nest
    // Purge ring grows reef out of it.
    if (owner && owner.char) tohOnWallHit(this, owner, w);
    this.fx.hits.push({ x: Math.round(w.x + w.w / 2), y: Math.round(w.y + w.h / 2), a: Math.round(dmg), c: 0 });
    if (w.hp > 0) return;
    w.hp = 0;
    this.walls = this.walls.filter(q => q !== w);
    this.obstacles = this.obstacles.filter(q => q !== w);
    this.fx.booms.push({ x: Math.round(w.x + w.w / 2), y: Math.round(w.y + w.h / 2), r: Math.max(w.w, w.h) * 0.7 });
    this.pushEvent({ k: 'sfx', s: 'boom' });
    this.pushEvent({ k: 'obstacles', obstacles: this._snapObstacles() });
    if (w.onBreak) w.onBreak(this, w, owner);
  }

  // Every splash, nova and blast chews barricades as well as bodies.
  _areaDamageWalls(x, y, radius, dmg, owner) {
    if (!this.walls.length) return;
    for (const w of [...this.walls]) {
      const cx = clamp(x, w.x, w.x + w.w), cy = clamp(y, w.y, w.y + w.h);
      if (dist2(x, y, cx, cy) <= radius * radius) this.damageWall(w, dmg, owner);
    }
  }

  // Melee reach: the arc/line sweeps sit in the weapon switch, so this only
  // has to answer "which barricade is under this swing".
  _sweepWalls(x, y, a, range, arc, dmg, owner) {
    if (!this.walls.length) return;
    for (const w of [...this.walls]) {
      const cx = clamp(x, w.x, w.x + w.w), cy = clamp(y, w.y, w.y + w.h);
      const d = Math.hypot(cx - x, cy - y);
      if (d > range + 12) continue;
      if (arc < Math.PI * 2 && Math.abs(angDiffLocal(a, Math.atan2(cy - y, cx - x))) > arc / 2) continue;
      this.damageWall(w, dmg, owner);
    }
  }

  _inObstacle(x, y, r = 0) {
    for (const o of this.obstacles) {
      if (x > o.x - r && x < o.x + o.w + r && y > o.y - r && y < o.y + o.h + r) return true;
    }
    return false;
  }

  // ---------------- line of sight (patch 9): walls block attacks ----------------

  losBlocked(x0, y0, x1, y1) {
    for (const o of this.obstacles) {
      // cheap bbox reject before the raycast
      if (Math.max(x0, x1) < o.x || Math.min(x0, x1) > o.x + o.w
        || Math.max(y0, y1) < o.y || Math.min(y0, y1) > o.y + o.h) continue;
      if (segHitsRect(x0, y0, x1, y1, o.x, o.y, o.w, o.h)) return true;
    }
    return false;
  }

  // A DESTRUCTIBLE BARRICADE IS NOT COVER, and that distinction is the whole
  // difference between "walls block targeting" and "Nest Purge is impossible".
  //
  // `addWall` pushes barricades into `this.obstacles`, so `losBlocked` counts
  // them — correct for a swing, a blast and a committed zone, all of which
  // genuinely stop at one. It is wrong for CHOOSING A TARGET. A shot fired at
  // something behind a barricade is not a shot through the barricade: the
  // friendly projectile tick puts it INTO the wall and calls `damageWall`.
  // Refusing to take the shot is what removed every ranged class's only way to
  // break one — `toh_hunter` and `toh_wizard` went to 0 of 135 damage in 150
  // seconds the moment selection started consulting `losBlocked`.
  //
  // So selection asks the narrower question: is something PERMANENT in the
  // way? A pillar, yes — that shot can never land and the player would never
  // take it. A barricade, no — that shot lands on the barricade, which is
  // exactly what a player standing in front of one wants.
  losBlockedPermanent(x0, y0, x1, y1) {
    for (const o of this.obstacles) {
      if (Math.max(x0, x1) < o.x || Math.min(x0, x1) > o.x + o.w
        || Math.max(y0, y1) < o.y || Math.min(y0, y1) > o.y + o.h) continue;
      if (o.destructible) continue;                  // a barricade: shoot it
      if (segHitsRect(x0, y0, x1, y1, o.x, o.y, o.w, o.h)) return true;
    }
    return false;
  }

  // clip a ray to the first wall it hits (sniper beams, etc.)
  losClipLen(x, y, a, len) {
    if (!this.obstacles.length) return len;
    const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
    let best = len;
    for (const o of this.obstacles) {
      const t = segRectEntryT(x, y, x1, y1, o.x, o.y, o.w, o.h);
      if (t >= 0) best = Math.min(best, t * len);
    }
    return best;
  }

  // auto-aim never targets an enemy the shot can't reach: nearest VISIBLE.
  // Walked in distance order — the first raycast that passes wins.
  _nearestVisibleEnemy(x, y, range) {
    if (!this.obstacles.length) return this._nearestEnemy(x, y, range);
    const cands = [];
    for (const e of this.enemyPool) {
      const d = dist2(x, y, e.x, e.y);
      if (d < range * range) cands.push({ d: d * this._aimWeight(e), e });
    }
    cands.sort((a, b) => a.d - b.d);
    // Permanent obstacles only — same rule as compose.js selection. A shot at
    // something behind a BARRICADE lands on the barricade and breaks it, which
    // is the point; refusing to take it is how a summoned pack stopped being
    // able to chew its way into a Nest Purge ring.
    for (const c of cands) if (!this.losBlockedPermanent(x, y, c.e.x, c.e.y)) return c.e;
    return null;
  }

  // The closest point on the closest destructible barricade, if one is in
  // range and in sight. Aim at the face, not the centre, so the shot lands on
  // the near side rather than travelling through half the block.
  _nearestWallPoint(x, y, range) {
    let best = null;
    for (const w of this.walls) {
      const cx = clamp(x, w.x, w.x + w.w), cy = clamp(y, w.y, w.y + w.h);
      const d2 = dist2(x, y, cx, cy);
      if (d2 > range * range || (best && d2 >= best.d2)) continue;
      // sight to just short of the face — the wall itself must not self-block
      const d = Math.sqrt(d2) || 1;
      const bx = cx + (x - cx) / d * 6, by = cy + (y - cy) / d * 6;
      if (this.losBlocked(x, y, bx, by)) continue;
      best = { x: cx, y: cy, d2, wall: w };
    }
    return best;
  }

  // deterministic nearest clear point: rings outward from (x, y)
  _clearSpot(x, y, r) {
    if (!this._inObstacle(x, y, r)) return [x, y];
    for (let ring = 50; ring <= 800; ring += 50) {
      for (let a = 0; a < 16; a++) {
        const qx = clamp(x + Math.cos(a / 16 * Math.PI * 2) * ring, WALL + 40, this.W - WALL - 40);
        const qy = clamp(y + Math.sin(a / 16 * Math.PI * 2) * ring, WALL + 40, this.H - WALL - 40);
        if (!this._inObstacle(qx, qy, r)) return [qx, qy];
      }
    }
    return [x, y];
  }

  // push a circular entity out of any rect it overlaps (smallest axis)
  _pushOut(ent, r) {
    for (const o of this.obstacles) {
      const nx = clamp(ent.x, o.x, o.x + o.w);
      const ny = clamp(ent.y, o.y, o.y + o.h);
      const dx = ent.x - nx, dy = ent.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        ent.x = nx + dx / d * r;
        ent.y = ny + dy / d * r;
      } else {
        // center inside the rect: exit through the nearest face
        const exits = [
          [o.x - r - ent.x, 0], [o.x + o.w + r - ent.x, 0],
          [0, o.y - r - ent.y], [0, o.y + o.h + r - ent.y],
        ];
        let best = exits[0];
        for (const e2 of exits) if (Math.hypot(e2[0], e2[1]) < Math.hypot(best[0], best[1])) best = e2;
        ent.x += best[0]; ent.y += best[1];
      }
    }
  }

  spawnEnemyById(id, x, y, opts = {}) {
    const def = ENEMY_BY_ID[id];
    if (!def) return null;
    const e = this.enemyPool.alloc();
    if (!e) return null;
    const fl = regionHpMult(this.regionIndex);
    const dmgScale = regionDmgMult(this.regionIndex) * (opts.elite ? CONFIG.ELITE_DMG_MULT : 1)
      * ((this.fightMods && this.fightMods.dmg) || 1);      // §2.4 node damage
    let hp = def.hp * fl * this.coopHp * this.greedHp * CONFIG.enemyHpMult * (opts.elite ? CONFIG.ELITE_HP_MULT : 1);
    hp *= (this.fightMods && this.fightMods.hp) || 1;      // §2.4: and each one TOUGHER
    hp *= this.curseEnemyHp;                       // cursed round: tougher enemies
    if (opts.hpMult) hp *= opts.hpMult;            // objective variants (elite arena, bounties)
    // a level-wide toughness dial the objective owns (Nest Purge: +50%);
    // the objective's own furniture (nests) opts out with noObjHp
    if (!opts.noObjHp) hp *= (this.objHpMult || 1);
    if (opts.mini) hp *= 0.35;
    Object.assign(e, {
      id: ++this.spawnCounter, def, typeIdx: ENEMY_INDEX[id], boss: false, bossDef: null,
      x: clamp(x, WALL + 20, this.W - WALL - 20), y: clamp(y, WALL + 20, this.H - WALL - 20),
      hp: Math.round(hp), maxHp: Math.round(hp),
      radius: def.radius * (opts.elite ? 1.45 : 1) * (opts.mini ? 0.6 : 1),
      spd: def.spd * (opts.elite ? 1.1 : 1) * (opts.mini ? 1.25 : 1) * this.curseEnemySpd * (opts.spdMult || 1),
      dmg: def.dmg * dmgScale, dmgScale,
      mats: opts.noMats ? 0 : def.mats, mini: !!opts.mini,
      elite: !!opts.elite, eliteMod: opts.elite ? (opts.mod || ELITE_MODS[0]) : null,
      domain: def.domain || (def.bossDomain || 'physical'),
      t: this.rng.float(), phase: 0, slowT: 0, slowMult: 1, burnT: 0, burnDps: 0, burnOwner: null,
      markT: 0, markBy: -1, markHeal: 0, markRadius: 0,
      drench: 0, drenchT: 0, drenchBy: -1,
      hitFlash: 0, knockX: 0, knockY: 0, contactCd: 0, fusing: false, blockT: 0,
      fireT: 0.8 + this.rng.float(), healTarget: null, brood: null, shape: def.shape, color: def.color,
      hitStamps: {}, echoCd: 0, bulwarkCd: 0,
      slideSide: 0,   // pooled slots must not inherit a half-rounded corner
      // THE TELEGRAPH MACHINE, RESET. Same recycling hazard as the objective
      // flags below, and it shipped: only the siege boss cleared these, so an
      // ordinary chaff slot could inherit telState=WINDUP from the slabjaw that
      // held it last. tickTelegraphs skips it (no def.telegraph) and it sits in
      // WINDUP forever — until a stun rider calls cancelTelegraph on it, which
      // reads e.def.telegraph.recoverMs and throws. Found by Unsheathed's stun
      // landing on a recycled skulker.
      telState: 0, telT: 0, telZone: null, telCaught: null,
      telCd: def.telegraph ? def.telegraph.cooldownMs / 1000 * this.rng.float() : 0,
      // pressure-profile variants (patch 9)
      mortar: !!opts.mortar,   // Lobber artillery: telegraphed shells on your position
      puddle: !!opts.puddle,   // chaff that leaves an acid puddle on death
      rushSet: false, rushX: 0, rushY: 0, // wave-end rush overshoot target
      // Objective-owned flags. The pool RECYCLES enemies, so anything an
      // objective stamps on one must be cleared here or it rides into the next
      // room: a nest's invulnerability shield leaking onto ordinary chaff left
      // six unkillable enemies standing in a later horde arena, and the fight
      // could never end.
      isNest: false, nestShielded: false, bounty: false, arenaVariant: null,
      spawnCdMult: 1, maxBroodCap: 0, enrageRate: 0, baseSpd: 0, payloadCd: 0,
    });
    return e;
  }

  eliteMods() { return ELITE_MODS; }

  enemyById(id) {
    for (const e of this.enemyPool) if (e.id === id) return e;
    return null;
  }

  // ---------------- main tick ----------------

  setInput(idx, inp) {
    const p = this.players[idx];
    if (!p || p.gone) return;
    p.mx = clamp(inp.mx || 0, -1, 1);
    p.my = clamp(inp.my || 0, -1, 1);
    if (inp.interact) p.interact = true;
  }

  tick() {
    if (this.over) return;
    const dt = DT;
    this.tickNum++; this.time += dt;
    // batch this tick's fx for the next 15 Hz snapshot so clients see every
    // hit number/death burst, not just the snapshot-tick's slice
    if (!this.fxBatch) this.fxBatch = this._emptyFx();
    const CAPS = { hits: 70, deaths: 40, booms: 24, beams: 24, swings: 30, blocks: 12 };
    for (const k in this.fx) {
      const dst = this.fxBatch[k], src = this.fx[k], cap = CAPS[k] || 30;
      for (const e of src) { if (dst.length >= cap) break; dst.push(e); }
    }
    this.fx = this._emptyFx();
    this.activeBeams.length = 0;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 18);

    if (this.pendingEnd > 0) {
      this.pendingEnd -= dt;
      if (this.pendingEnd <= 0) { this._finish(true); return; }
    }

    // ---- map phase: the node screen. Just the consent countdown and offers ----
    if (this.phase === 'map') {
      this._tickVote(dt);
      if (this.tickNum % 15 === 0) {
        for (const p of this.players) {
          if (p.gone) continue;
          this._recomputeStats(p);
          if (p.banked > 0) this._maybeOffer(p);
        }
      }
      return;
    }

    // ---- arena phase ----
    this._tickWave(dt);
    this._flushSpawnQueue(dt);
    if (this.arenaNode && this.arenaNode.kind === 'siege') this._tickSiege(dt);
    // players
    for (const p of this.players) { if (!p.gone) this._tickPlayer(p, dt); }
    // periodic stat recompute (auras, low-hp, frenzy expiry); also surface
    // level-ups earned from post-clear scooping (the siege looting window)
    if (this.tickNum % 15 === 0) {
      for (const p of this.players) {
        if (p.gone) continue;
        this._recomputeStats(p);
        if (this.cleared && p.banked > 0) this._maybeOffer(p);
      }
    }
    // summons
    this._tickSummons(dt);
    // enemies (movement + behaviors)
    for (const e of this.enemyPool) updateEnemy(this, e, dt);
    // rebuild spatial hash with post-move positions
    this.grid.clear();
    for (const e of this.enemyPool) this.grid.insert(e);
    // projectiles
    this._tickProjectiles(dt);
    SK.tickSkills(this, dt);            // also ticks minions — they are skill state
    SK.tickSkillStatuses(this, dt);
    MIN.tickTokens(this, dt);
    tickTelegraphs(this, dt);
    // telegraphs / zones / vortexes
    this._tickAreas(dt);
    tohTick(this, dt);   // Thrones of Heaven world entities + per-player meters
    // contact damage + hazards
    this._tickContact(dt);
    this._tickHazards(dt);
    // pickups
    this._tickPickups(dt);
    // Mirage decoys (taunt, then burst)
    this._tickDecoys(dt);
    // revives
    this._tickRevive(dt);
    this._tickCurseBarrage(dt);
    tickObjective(this, dt);
    // fight clear + the siege looting window + extraction portal countdown
    this._checkFightClear();
    this._tickLoot(dt);
    this._tickExtract(dt);
  }

  _flushSpawnQueue(dt) {
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const q = this.spawnQueue[i];
      q.t -= dt;
      if (q.t <= 0) {
        this.spawnQueue.splice(i, 1);
        this.spawnEnemyById(q.id, q.x, q.y, { elite: q.elite, mod: q.mod, mortar: q.mortar, puddle: q.puddle });
      }
    }
  }

  // ---------------- player tick ----------------

  _tickPlayer(p, dt) {
    if (p.invuln > 0) p.invuln -= dt;
    if (p.tempoBuffT > 0) p.tempoBuffT -= dt;
    if (p.dmgBuffT > 0) p.dmgBuffT -= dt;
    p.frenzy = p.frenzy.filter(f => (f.t -= dt) > 0);

    if (p.downed) { p.mx = p.my = 0; p.interact = false; return; }

    // movement — Tempo drives it; Grit shrugs off pulls
    p.moving = (p.mx !== 0 || p.my !== 0);
    p.stillT = p.moving ? 0 : (p.stillT || 0) + dt; // snipers lock faster onto statues
    // ...AND ITS MIRROR, WHICH WAS NEVER MAINTAINED. `triggers.js` has read
    // `p.movingT` for the MOVEMENT trigger's `moving` mode since phase 1, and
    // nothing anywhere ever wrote it — so the branch evaluated `0 >= seconds`
    // and that half of the trigger could not fire, in the game or in a test.
    // It went unnoticed because no authored skill used the mode until
    // samurai_agility, whose Gale branch is built on it. A trigger kind is a
    // PAIR of modes; shipping one of them wired to nothing is the exact failure
    // this project's load assertions exist for, and assertions cannot see it
    // because the declaration was always valid — only the reader was missing.
    p.movingT = p.moving ? (p.movingT || 0) + dt : 0;
    const t = p.char.trait;
    let spd = CONFIG.BASE_SPEED * (1 + p.stats.tempo / 100);
    spd = Math.max(60, spd);
    if (this.carryingRelic(p)) spd *= 0.8; // a relic is heavy: −20% move speed
    const pullResist = (t.key === 'immovable' || t.key === 'crystal_infusion') ? 0 : CONFIG.ARMOR_K / (CONFIG.ARMOR_K + Math.max(0, p.stats.grit));
    p.x += (p.mx * spd + p.pullX * pullResist) * dt;
    p.y += (p.my * spd + p.pullY * pullResist) * dt;
    p.pullX = p.pullY = 0;
    p.x = clamp(p.x, WALL + p.radius, this.W - WALL - p.radius);
    p.y = clamp(p.y, WALL + p.radius, this.H - WALL - p.radius);
    this._pushOut(p, p.radius);
    // _pushOut ejects along the shortest exit from an obstacle, which can
    // land OUTSIDE the room when architecture touches the boundary. The room
    // bounds win: re-clamp after the push, every frame, on every map.
    p.x = clamp(p.x, WALL + p.radius, this.W - WALL - p.radius);
    p.y = clamp(p.y, WALL + p.radius, this.H - WALL - p.radius);

    // Onrush: moving fills the meter; fill rate scales with Tempo
    if (t.key === 'momentum_meter') {
      if (p.moving) p.meter = Math.min(1, p.meter + dt / t.fillSec * (1 + p.stats.tempo / 100));
    }

    // regen sources (items; a source — amplified by Recovery inside _heal)
    if (p.hookAgg.regen > 0 && p.hp < p.stats.vitality) {
      p.regenAcc += p.hookAgg.regen * dt;
      if (p.regenAcc >= 1) { const h = Math.floor(p.regenAcc); p.regenAcc -= h; this._heal(p, h); }
    }
    if (p.blockT > 0) p.blockT -= dt;

    // contact aura items
    if (p.hookAgg.contactAura.length) {
      p.contactAuraAcc += dt;
      if (p.contactAuraAcc >= 0.4) {
        const mul = p.contactAuraAcc; p.contactAuraAcc = 0;
        for (const ca of p.hookAgg.contactAura) {
          this._areaDamageEnemies(p.x, p.y, ca.radius, ca.dps * mul, p, { silent: true });
        }
      }
    }

    // patch-trigger-core: skills replace weapons entirely (see js/skillsim.js)

    // Pulsar's nova core
    if (t.key === 'nova_core') this._tickNova(p, t, dt);

    // structures: stand still to call the ones you can't see back to you
    this._tickStructureRecall(p, dt);

    // Overseer: redeploy channel completes
    if (p.channelT > 0) {
      p.channelT -= dt;
      if (p.channelT <= 0 && p.carrying) {
        p.carrying.x = p.x + Math.cos(p.aimA) * 30;
        p.carrying.y = p.y + Math.sin(p.aimA) * 30;
        p.carrying.carried = false;
        p.carrying = null;
        this.pushEvent({ k: 'toast', idx: p.idx, text: 'Turret deployed' });
      }
    }

    // interact: Overseer turret carry > post-siege shop reopen at the portal
    if (p.interact) {
      p.interact = false;
      if (t.key === 'overseer' && this._overseerInteract(p)) {
        // handled (picked up or began redeploy)
      } else if (this.hatch && this.afterSiege) {
        this._openShop(p, 'boss');
      }
    }
  }

  // E for the Overseer: pick up the nearest own turret, or start the short
  // placement channel when already carrying one.
  _overseerInteract(p) {
    if (p.carrying) {
      if (p.channelT <= 0) p.channelT = 0.8;
      return true;
    }
    let best = null, bd = 60 * 60;
    for (const s of this.summons) {
      if (s.owner !== p.idx || s.dead || s.type !== 'turret' || s.carried) continue;
      const d = dist2(p.x, p.y, s.x, s.y);
      if (d < bd) { bd = d; best = s; }
    }
    if (best) {
      best.carried = true;
      p.carrying = best;
      this.pushEvent({ k: 'toast', idx: p.idx, text: 'Turret picked up — press E to redeploy' });
      return true;
    }
    return false;
  }

  // ---------------- cursed goods ----------------
  // Taking a cursed item queues its curse for the NEXT round. Curses activate
  // when that arena starts and are gone when the next one does — a cursed
  // buy is a loan against exactly one fight.
  _grantItem(p, id) {
    const it = ITEM_BY_ID[id];
    const owned = p.items.includes(id);
    if (owned && this._itemUpgradable(p, id)) {
      // §9.3 ITEM UPGRADES. A second copy deepens the one you have instead of
      // stacking a duplicate — the same shape weapons used, kept because it is
      // the shape players already learned. Level scales the bonus AND the rolled
      // penalty, so an upgrade is never a way to buy the upside alone.
      const st = p.itemState[id];
      st.lvl = Math.min(CONFIG.ITEM_MAX_LEVEL, (st.lvl || 1) + 1);
      this.pushEvent({ k: 'toast', idx: p.idx, text: `${it.name} upgraded to level ${st.lvl}` });
    } else {
      p.items.push(id);
      p.itemState[id] = { lvl: 1, pen: this._rollPenalty(p, it) };
    }
    if (it) {
      for (const c of [it.curse, it.curse2]) {
        if (c) p.pendingCurses.push({ ...c, from: it.name });
      }
    }
    this._recomputeItems(p);
    this._recomputeStats(p);
  }

  // Upgradable means "level does something": a `stats` block to deepen, or an
  // explicit `perLevel.hooks` block. An item with neither would take the money
  // and change nothing, which is the shop version of the defect `item_gate`
  // exists to reject.
  _itemUpgradable(p, id) {
    const it = ITEM_BY_ID[id];
    if (!it || !p.itemState[id]) return false;
    if ((p.itemState[id].lvl || 1) >= CONFIG.ITEM_MAX_LEVEL) return false;
    return !!(it.stats || (it.perLevel && it.perLevel.hooks));
  }

  // §9.2 THE PENALTY ROLL. Returns the stat this instance's penalty landed on,
  // or null for an item that declares no penalty.
  //
  // ELIGIBILITY IS AGAINST THE LIVE SHEET, not the catalog: "a penalty may not
  // roll into a stat the character has none of" is a property of the character
  // buying it. Reducing a stat already at zero is free, and a shop full of free
  // items has no trade-offs left. With nothing eligible the item rolls no
  // penalty at all and is honestly cheaper for it — that case is reported by
  // `econ_gate`, never silently converted into a free bonus at full price.
  _rollPenalty(p, it) {
    if (!it || !it.penalty) return null;
    const granted = Object.keys(it.stats || {});
    const pool = ROLL_TABLE.filter(k => !granted.includes(k) && (p.stats ? p.stats[k] : STAT_BASE[k]) > 0);
    if (!pool.length) return null;
    return pool[Math.floor(this.econRng.float() * pool.length)];
  }

  // What an item is worth to THIS player right now: base times its level, with
  // the rolled penalty folded in at the same scale.
  _itemStats(p, id) {
    const it = ITEM_BY_ID[id];
    if (!it) return null;
    const st = p.itemState[id] || { lvl: 1, pen: null };
    const mult = 1 + CONFIG.ITEM_LEVEL_MULT * ((st.lvl || 1) - 1);
    const out = {};
    for (const k in (it.stats || {})) out[k] = it.stats[k] * mult;
    if (it.penalty && st.pen) out[st.pen] = (out[st.pen] || 0) - it.penalty * mult;
    return out;
  }

  // sum of one curse key across a player's ACTIVE curses (they stack)
  _curse(p, key) {
    let v = 0;
    for (const c of p.curses) if (c.key === key) v += c.value;
    return v;
  }

  // called at every arena entry: last round's curses expire, this round's
  // activate, and the enemy-side ones fold into shared round multipliers
  _armCurses() {
    this.curseEnemyHp = 1; this.curseEnemySpd = 1; this.curseBarrage = 0;
    const named = [];
    for (const p of this.players) {
      if (p.gone) { p.curses = []; continue; }
      p.curses = p.pendingCurses;
      p.pendingCurses = [];
      for (const c of p.curses) {
        if (c.scope !== 'enemy') continue;
        // enemy-side curses are the party's problem, however bought them
        if (c.key === 'enemyHp') this.curseEnemyHp += c.value;
        else if (c.key === 'enemySpd') this.curseEnemySpd += c.value;
        else if (c.key === 'barrage') this.curseBarrage += c.value;
      }
      if (p.curses.length) named.push(p.name);
      this._recomputeStats(p);
    }
    this.barrageT = this.curseBarrage > 0 ? 12 : Infinity; // first cursed shell
    if (named.length) {
      this.pushEvent({ k: 'toast', idx: -1, text: `The vault collects: ${named.join(', ')} carry a curse this round` });
    }
  }

  // the 'barrage' curse: extra artillery walks across the party's positions
  _tickCurseBarrage(dt) {
    if (!(this.barrageT < Infinity) || this.cleared || this.over) return;
    this.barrageT -= dt;
    if (this.barrageT > 0) return;
    this.barrageT = 26; // one salvo per stack, then a long reload
    const live = this.livePlayers().filter(q => !q.downed);
    if (!live.length) return;
    const shells = 3 * this.curseBarrage;
    for (let i = 0; i < shells; i++) {
      const t = live[i % live.length];
      const x = clamp(t.x + (this.rng.float() - 0.5) * 320, WALL + 40, this.W - WALL - 40);
      const y = clamp(t.y + (this.rng.float() - 0.5) * 320, WALL + 40, this.H - WALL - 40);
      this.addTelegraph({
        shape: 'circle', x, y, r: 74, dur: 1.5 + i * 0.12,
        boom: { dmg: Math.round(12 * regionDmgMult(this.regionIndex)), radius: 74 },
      });
    }
    this.pushEvent({ k: 'toast', idx: -1, text: 'CURSED BARRAGE INCOMING' });
  }

  // ---------------- Pulsar: the nova core ----------------
  // A fixed-radius pulse centred on him. The radius is deliberately immune to
  // Reach and every other range modifier — it is the character's leash, not a
  // stat. Damage is attuned (Attunement) and scaled by Ferocity like any
  // other hit, then multiplied by the Overheat stack.
  _tickNova(p, t, dt) {
    if (p.heatDropT > 0) {
      p.heatDropT -= dt;
      if (p.heatDropT <= 0) { p.heat = 0; p.heatDropT = 0; } // the whole stack falls off at once
    }
    p.novaT -= dt;
    if (p.novaT > 0) return;
    p.novaT = t.cd;
    // "while ≥1 enemy is within 120" — no target, no pulse, and the stack
    // starts its 2s decay
    if (!this._nearestEnemy(p.x, p.y, t.radius)) {
      if (p.heat > 0 && p.heatDropT <= 0) p.heatDropT = t.heatDecay;
      return;
    }
    const dmg = Math.max(1, Math.round(
      this._attuned(p, t.base) * (1 + p.stats.ferocity / 100) * (1 + p.heat)));
    const hits = this._areaDamageEnemies(p.x, p.y, t.radius, dmg, p);
    this.fx.booms.push({ x: Math.round(p.x), y: Math.round(p.y), r: t.radius });
    this.pushEvent({ k: 'sfx', s: 'boom' });
    if (hits > 0) {
      p.novaDamage += dmg * hits;              // nova-share bookkeeping (tuning)
      this._heal(p, hits * t.healPer);         // 1 HP per enemy struck, Recovery applies
      p.heat = Math.min(t.heatMax, p.heat + t.heatPer);
      p.heatDropT = 0;
      p.metaDirty = true;
    } else if (p.heat > 0 && p.heatDropT <= 0) {
      p.heatDropT = t.heatDecay;               // in radius but all shots walled off
    }
  }

  // ---------------- structures follow their owner ----------------
  // Turrets and drones you can SEE are yours to place and leave. The ones off
  // your screen are dead weight, so standing still recalls them: a 3s channel
  // (cancelled by moving or taking a hit, paused in menus/downed), then each
  // off-screen structure packs up and redeploys near you half a second later.
  // The owner's ACTUAL camera, mirroring render.js: it follows the player but
  // CLAMPS at the arena edges, so near a wall the player sits off-centre and
  // the visible world extends further to one side. Judging visibility from a
  // player-centred box (the old way) called those structures "off-screen" and
  // recalled turrets the owner was looking straight at — the reported bug.
  // In co-op each owner is judged against their own camera.
  _ownerCamera(p) {
    const hw = CONFIG.STRUCT_OFFSCREEN_W / 2, hh = CONFIG.STRUCT_OFFSCREEN_H / 2;
    return {
      cx: clamp(p.x, Math.min(hw, this.W / 2), Math.max(this.W - hw, this.W / 2)),
      cy: clamp(p.y, Math.min(hh, this.H / 2), Math.max(this.H - hh, this.H / 2)),
      hw, hh,
    };
  }

  _structOffscreen(p, s) {
    const c = this._ownerCamera(p);
    return Math.abs(s.x - c.cx) > c.hw || Math.abs(s.y - c.cy) > c.hh;
  }

  _ownedStructures(p) {
    return this.summons.filter(s => s.owner === p.idx && !s.dead && !s.carried);
  }

  // instant, no channel: every structure rides along to the next room
  relocateStructures(p, opts = {}) {
    const mine = this._ownedStructures(p).filter(s => opts.all || this._structOffscreen(p, s));
    mine.forEach((s, i) => {
      const a = (i / Math.max(1, mine.length)) * Math.PI * 2 + (this.tickNum % 17) * 0.37;
      const [sx, sy] = this._clearSpot(
        p.x + Math.cos(a) * CONFIG.STRUCT_SCATTER,
        p.y + Math.sin(a) * CONFIG.STRUCT_SCATTER, 18);
      s.x = sx; s.y = sy;
      if (!opts.instant) { s.deployT = CONFIG.STRUCT_REDEPLOY_S; s.cd = Math.max(s.cd || 0, CONFIG.STRUCT_REDEPLOY_S); }
    });
    return mine.length;
  }

  // The rule, exactly: a structure relocates ONLY when it is outside its
  // OWNER'S viewport AND that owner has stood still for 3 continuous seconds.
  // Movement or damage cancels; menus and being downed pause. A structure the
  // owner can see NEVER moves on its own.
  _tickStructureRecall(p, dt) {
    // paused, not cancelled, while an overlay owns the player's attention
    const busy = p.downed || p.shop || p.pendingOffer || p.treasureOffer || p.boonOffer || p.openingOffer || p.spendOffer;
    if (busy) return;                       // hold the timer where it is
    if (p.moving) { p.relocT = 0; return; } // any movement cancels outright
    const offscreen = this._ownedStructures(p).some(s => this._structOffscreen(p, s));
    if (!offscreen) { p.relocT = 0; return; } // nothing to recall: no channel
    p.relocT += dt;
    if (p.relocT >= CONFIG.STRUCT_CHANNEL_S) {
      p.relocT = 0;
      const n = this.relocateStructures(p);
      if (n > 0) {
        this.pushEvent({ k: 'sfx', s: 'door' });
        this.pushEvent({ k: 'toast', idx: p.idx, text: n > 1 ? `${n} structures recalled` : 'Structure recalled' });
      }
    }
  }

  // All healing funnels through here. Recovery amplifies every source; the
  // fractional remainder accumulates so small heals aren't lost. Overheal is
  // routed by trait (shield / permanent Vitality / ally drip / self-shield).
  _heal(p, amount, opts = {}) {
    if (p.downed || amount <= 0 || p.gone) return;
    const t = p.char.trait;
    let amt = amount * (1 + Math.max(-80, p.stats.recovery) / 100);
    if (this._curse(p, 'healHalf') > 0) amt *= 0.5; // cursed round: halved healing
    p.healAcc += amt;
    amt = Math.floor(p.healAcc);
    p.healAcc -= amt;
    if (amt <= 0) return;
    const before = p.hp;
    p.hp = Math.min(p.stats.vitality, p.hp + amt);
    // Grace counts healing the PRIEST caused, wherever it landed
    if (opts.by && opts.by !== p) tohOnHeal(this, opts.by, amt);
    else if (t.key === 'grace_and_judgment') tohOnHeal(this, p, amt);
    const overflow = amt - (p.hp - before);
    if (overflow > 0) {
      if (t.key === 'overheal_shield') {
        p.shield = Math.min(t.cap, p.shield + overflow);
      } else if (t.key === 'red_tithe') {
        const room = Math.min(overflow, t.vitCapPerRoom - p.roomVitGain);
        if (room > 0) {
          p.roomVitGain += room;
          this._applyPerm(p, { vitality: room });
          this.pushEvent({ k: 'toast', idx: p.idx, text: `Red Tithe: +${room} Vitality` });
        }
      } else if (t.key === 'field_rites' && !opts.noDrip) {
        // overflow drips to the nearest injured ally; solo → small self-shield
        let ally = null, bd = Infinity;
        for (const q of this.livePlayers()) {
          if (q === p || q.downed || q.hp >= q.stats.vitality) continue;
          const d = dist2(p.x, p.y, q.x, q.y);
          if (d < bd) { bd = d; ally = q; }
        }
        if (ally) this._heal(ally, overflow, { noDrip: true, noShare: true, by: p });
        else p.shield = Math.min(t.shieldCap, p.shield + overflow);
      }
    }
    // Soulbond: the bonded pair receives a cut of each other's healing —
    // whether or not the heal overflowed
    if (t.key === 'soulbond' && !opts.noShare) {
      const bond = this._bondTarget(p);
      if (bond && bond.player) this._heal(bond.player, amt * t.healShare, { noShare: true });
    }
    for (const q of this.livePlayers()) {
      if (q === p || q.char.trait.key !== 'soulbond' || opts.noShare) continue;
      const b = this._bondTarget(q);
      if (b && b.player === p) this._heal(q, amt * q.char.trait.healShare, { noShare: true, by: p });
    }
  }

  // Lodestone's bond: nearest living ally; solo → strongest own summon; else dormant.
  _bondTarget(p) {
    let ally = null, bd = Infinity;
    for (const q of this.livePlayers()) {
      if (q === p || q.downed) continue;
      const d = dist2(p.x, p.y, q.x, q.y);
      if (d < bd) { bd = d; ally = q; }
    }
    if (ally) return { player: ally };
    let sum = null, best = -1;
    for (const s of this.summons) {
      if (s.owner !== p.idx || s.dead) continue;
      if (s.maxHp > best) { best = s.maxHp; sum = s; }
    }
    return sum ? { summon: sum } : null;
  }

  // ---------------- weapons & attacks ----------------

  _tickWeapons(p, dt) {
    for (let i = 0; i < p.weapons.length; i++) {
      const w = p.weapons[i];
      const def = WEAPON_BY_ID[w.id];
      if (def.cls === 'summon') continue; // structures act on their own
      const cdMax = def.cd / Math.max(0.25, 1 + p.stats.tempo / 100);
      w.cd -= dt;
      if (w.cd > 0) continue;
      const range = this._weaponRange(p, def);
      const target = this._nearestEnemy(p.x, p.y, range);
      if (!target) { w.cd = 0.05; continue; }
      w.cd = Math.max(0.08, cdMax);
      this._fireWeapon(p, w, i, { target });
    }
  }

  _weaponRange(p, def) {
    const melee = def.cls === 'swing' || def.cls === 'thrust';
    let r = Math.max(40, def.range + p.stats.reach * (melee ? 0.3 : 1));
    // Overwatch: the charged shot also reaches further
    if (this._overwatchCharged(p, def)) r *= 1 + p.char.trait.reachPct / 100;
    // Pulsar fights inside his own blast radius: the cap lands AFTER every
    // range modifier, so nothing (Reach, Overwatch, items) reaches past it
    if (p.char.trait.key === 'nova_core') r = Math.min(r, p.char.trait.radius);
    return r;
  }

  // Stillness charges by HOLDING fire: the idle window starts after the
  // weapon's own cooldown, so slow weapons don't get the ×2 for free.
  _overwatchCharged(p, def) {
    const t = p.char.trait;
    if (t.key !== 'overwatch') return false;
    const cdMax = def.cd / Math.max(0.25, 1 + p.stats.tempo / 100);
    return this.time - p.lastFireT >= t.idle + cdMax;
  }

  _fireWeapon(p, w, widx, opts = {}) {
    const def = WEAPON_BY_ID[w.id];
    const range = this._weaponRange(p, def);
    // lobbed weapons arc over walls — that's their identity; everything else
    // targets the nearest VISIBLE enemy
    let target = opts.target || (def.cls === 'lobbed'
      ? this._nearestEnemy(p.x, p.y, range)
      : this._nearestVisibleEnemy(p.x, p.y, range));
    // A destructible barricade is a TARGET, not scenery. This game aims for
    // you, so a wall nothing ever shoots at is a wall nobody can break: walk
    // up to one and it becomes the nearest thing, exactly as a body would.
    // Lobbed weapons keep arcing over — that is their whole identity.
    if (!opts.target && def.cls !== 'lobbed' && this.walls.length) {
      const wp = this._nearestWallPoint(p.x, p.y, range);
      // Weighted like a bounty mark, and for the same reason: with a swarm on
      // top of you a barricade is NEVER the literally-nearest thing, so a
      // plain distance test meant nobody ever broke one. At 0.25 on squared
      // distance a wall competes as if half as far — chaff in your face
      // still wins, but standing at a barricade means chewing it.
      if (wp && (!target || wp.d2 * 0.25 < dist2(p.x, p.y, target.x, target.y))) target = wp;
    }
    if (!target) return;
    const a = angleTo(p.x, p.y, target.x, target.y);
    p.aimA = a;
    tohOnFire(this, p, { def, a, tx: target.x, ty: target.y });
    const t = p.char.trait;
    const agg = p.hookAgg;

    // damage: base × tier × (1 + Ferocity/100) × (1 + scaling-tag bonus/100)
    let dmg = def.dmg * TIER_MULT[w.tier - 1];
    // scaling tags are gone with SCALING_RATES; Ferocity is the only multiplier
    // left on this path, which is itself only reachable from a line-of-sight test
    let mult = (1 + p.stats.ferocity / 100);
    if (t.key === 'glass') mult *= t.dealMult;
    // Onrush: consume the movement meter (+60% at full charge)
    if (t.key === 'momentum_meter' && p.meter > 0.05) { mult *= 1 + t.bonus * p.meter; p.meter = 0; }
    // Stillness: holding fire charges this shot (computed BEFORE lastFireT updates)
    if (this._overwatchCharged(p, def)) mult *= t.mult;
    // after-dodge "next attack" item bonus (short window, consumed on fire)
    if (p.dmgBuffT > 0 && p.dmgBuffAmt > 0) { mult *= 1 + p.dmgBuffAmt / 100; p.dmgBuffT = 0; }
    if (opts.factor) mult *= opts.factor;
    dmg = Math.max(1, dmg * mult);

    // Crit is not a stat: crits exist only as granted effects (default ×2,
    // Executioner ×3 and never random). Resolved here where the target is known.
    let crit = false;
    if (p.nextCrit) { crit = true; p.nextCrit = false; }
    if (!p.firstHitUsed && agg.firstHitCrit) crit = true;
    p.firstHitUsed = true;
    if (agg.critAfterKill && p.critArmed) { crit = true; p.critArmed = false; }
    if (agg.critEveryN > 0) {
      p.critCounter++;
      if (p.critCounter >= agg.critEveryN) { crit = true; p.critCounter = 0; }
    }
    if (agg.critVsChilled && target.slowT > 0) crit = true;
    if (agg.critVsBurning && target.burnT > 0) crit = true;
    if ((agg.critVsFullHp || t.key === 'executioner' || t.key === 'contract') && target.hp >= target.maxHp) crit = true;
    // Jester: trait-internal odds that ramp per attack and reset when a crit lands
    if (t.key === 'crit_ramp') {
      if (!crit && this.rng.float() * 100 < p.jesterOdds) crit = true;
      p.jesterOdds = crit ? 0 : Math.min(t.max, p.jesterOdds + t.per);
    }
    // Blood Dance rewards committing to a slow weapon
    if (t.key === 'blood_dance' && def.cd >= t.heavyCd) dmg *= 1 + t.heavyBonus;
    if (crit) dmg *= p.critMult;
    dmg = Math.round(dmg);
    p.lastFireT = this.time;

    const knock = def.knock * agg.knockMult;
    const hitCtx = { owner: p, crit, weaponDef: def, knock, baseDmg: dmg };

    // Resonant: attacks build the charge ring; full → attuned shockwave
    if (t.key === 'resonance') {
      p.resonCharge++;
      if (p.resonCharge >= t.hits) {
        p.resonCharge = 0;
        const nova = Math.max(1, Math.round(this._attuned(p, dmg * t.factor)));
        this.fx.booms.push({ x: p.x, y: p.y, r: t.radius });
        this.pushEvent({ k: 'sfx', s: 'boom' });
        this._areaDamageEnemies(p.x, p.y, t.radius, nova, p);
      }
    }

    switch (def.cls) {
      case 'swing': {
        this.fx.swings.push({ x: p.x, y: p.y, a, r: range, arc: def.arc, color: def.color });
        let hits = 0;
        this.grid.query(p.x, p.y, range + 30, e => {
          if (!e.active || e._swingStamp === this.tickNum + widx * 1000) return;
          const d = dist(p.x, p.y, e.x, e.y);
          if (d > range + e.radius) return;
          const da = Math.abs(angDiffLocal(a, angleTo(p.x, p.y, e.x, e.y)));
          if (da > def.arc / 2) return;
          if (this.losBlocked(p.x, p.y, e.x, e.y)) return; // melee can't hit through walls
          e._swingStamp = this.tickNum + widx * 1000;
          this._hitEnemy(e, dmg, hitCtx, a);
          hits++;
        });
        this._sweepWalls(p.x, p.y, a, range, def.arc, dmg, p);
        if (hits > 0) this.pushEvent({ k: 'sfx', s: crit ? 'crit' : 'hit' });
        else this.pushEvent({ k: 'sfx', s: 'swing' });
        break;
      }
      case 'thrust': {
        this.fx.swings.push({ x: p.x, y: p.y, a, r: range, arc: 0.14, color: def.color });
        const hits = [];
        this.grid.query(p.x + Math.cos(a) * range / 2, p.y + Math.sin(a) * range / 2, range / 2 + 40, e => {
          if (!e.active || hits.includes(e)) return;
          if (this.losBlocked(p.x, p.y, e.x, e.y)) return; // no thrusting through walls
          if (pointToSegDist(e.x, e.y, p.x, p.y, p.x + Math.cos(a) * range, p.y + Math.sin(a) * range) < (def.thrustW / 2 + e.radius)) hits.push(e);
        });
        hits.sort((e1, e2) => dist2(p.x, p.y, e1.x, e1.y) - dist2(p.x, p.y, e2.x, e2.y));
        const n = def.pierceLine ? hits.length : Math.min(1, hits.length);
        for (let i = 0; i < n; i++) this._hitEnemy(hits[i], dmg, hitCtx, a);
        this._sweepWalls(p.x, p.y, a, range, 0.5, dmg, p);
        this.pushEvent({ k: 'sfx', s: n > 0 ? (crit ? 'crit' : 'hit') : 'swing' });
        break;
      }
      case 'single': case 'spread': {
        const count = (def.count || 1) + p.hookAgg.extraProjectiles;
        const spread = (def.spreadDeg || 0) * Math.PI / 180;
        for (let i = 0; i < count; i++) {
          const off = count > 1 ? (i / (count - 1) - 0.5) * spread : 0;
          this._spawnPlayerProj(p, def, w, a + off, dmg, crit, range);
        }
        this.pushEvent({ k: 'sfx', s: 'shoot' });
        break;
      }
      case 'lobbed': {
        const d = Math.min(range, dist(p.x, p.y, target.x, target.y));
        const pr = this.projPool.alloc();
        if (pr) {
          Object.assign(pr, {
            id: ++this.spawnCounter, x: p.x, y: p.y,
            vx: Math.cos(a) * def.projSpeed, vy: Math.sin(a) * def.projSpeed,
            dmg, crit, friendly: true, lob: true, ttl: d / def.projSpeed,
            radius: 7, color: def.color, owner: p.idx, pierce: 0, hitIds: null,
            weaponId: def.id, kind: 'lob', summonBurn: null, summonKnock: 0, fromSummon: false,
          });
        }
        this.pushEvent({ k: 'sfx', s: 'shoot' });
        break;
      }
    }
  }

  _spawnPlayerProj(p, def, w, a, dmg, crit, range) {
    const pr = this.projPool.alloc();
    if (!pr) return;
    let pierce = (def.pierce || 0) + p.hookAgg.extraPierce;
    if (p.char.trait.key === 'pierce_innate') pierce += p.char.trait.add;
    // Marksman: nothing of yours nearby means a cleaner, harder shot
    if (p.char.trait.key === 'pack_tactics' && p.packMode === 2) {
      const t2 = p.char.trait;
      const beasts = this.summons.filter(sm => sm.owner === p.idx && !sm.dead && !sm.carried).length;
      pierce += t2.marksmanPierce;
      dmg = Math.round(dmg * (1 + beasts * t2.marksmanDmgPerBeast / 100));
    }
    Object.assign(pr, {
      // spawn at the muzzle's base (6u), NOT 18u out: an enemy standing on the
      // player's center must be hittable — Bastion sanctions standing still
      id: ++this.spawnCounter, x: p.x + Math.cos(a) * 6, y: p.y + Math.sin(a) * 6,
      vx: Math.cos(a) * def.projSpeed, vy: Math.sin(a) * def.projSpeed,
      dmg, crit, friendly: true, lob: false, ttl: (range + 60) / def.projSpeed,
      radius: 5, color: def.color, owner: p.idx, pierce, hitIds: new Set(),
      weaponId: def.id, kind: 'shot', summonBurn: null, summonKnock: 0, fromSummon: false,
    });
  }

  // A weapon/projectile hit lands on an enemy: apply payloads then damage.
  _hitEnemy(e, dmg, ctx, angle) {
    const p = ctx.owner;
    const def = ctx.weaponDef;
    let finalDmg = dmg;
    if ((e.elite || e.boss) && p.hookAgg.eliteBossDamage) finalDmg = Math.round(finalDmg * (1 + p.hookAgg.eliteBossDamage / 100));
    const t = p.char.trait;
    if (t.key === 'far_bonus' && dist(p.x, p.y, e.x, e.y) > t.dist) finalDmg = Math.round(finalDmg * (1 + t.bonus / 100));
    finalDmg = tohHitDamage(this, p, e, finalDmg);   // Karma release, Iron bank, singularity vuln
    // knockback
    if (ctx.knock && !e.boss) {
      const ka = angle ?? angleTo(p.x, p.y, e.x, e.y);
      e.knockX += Math.cos(ka) * ctx.knock * 3;
      e.knockY += Math.sin(ka) * ctx.knock * 3;
    }
    // Soulbond joint-hit echo: both bonded partners struck this enemy within 1s.
    // Summon hits stamp a separate key so solo (summon-bonded) play works.
    const stampKey = ctx.summon ? 's' + p.idx : p.idx;
    this._soulbondEcho(p, e, finalDmg, stampKey);
    this.damageEnemy(e, finalDmg, { crit: ctx.crit, owner: p });
    if (e.hitStamps) e.hitStamps[stampKey] = this.time;
    // BEFORE the dead-enemy bail: a killing blow is still a hit, and the traits
    // that key off dealing damage (the Voodoo mirror, the Savage's Heat and
    // leech) would silently skip every finisher if this sat below the guard.
    tohOnHit(this, p, e, finalDmg, ctx);
    if (!e.active) return;
    // status payloads from the weapon — all attuned
    if (def) {
      if (def.burn) this._applyBurn(e, this._attuned(p, def.burn.dps), def.burn.dur, p);
      if (def.slow) this._applySlow(e, def.slow.mult, def.slow.dur, p);
      if (def.chainHit) this._chainLightning(e, ctx, def.chainHit);
    }
    // character trait payloads
    if (t.key === 'burn_attacks') this._applyBurn(e, this._attuned(p, t.dps), t.dur, p);
    if (t.key === 'slow_attacks') this._applySlow(e, t.mult, t.dur, p);
    if (t.key === 'chain_attacks' && this.rng.float() < t.chance) {
      this._chainLightning(e, ctx, { count: 1, range: t.range, factor: t.factor });
    }
    // item payloads
    for (const b of p.hookAgg.burnOnHit) if (this.rng.float() < b.chance) this._applyBurn(e, this._attuned(p, b.dps), b.duration, p);
    for (const s of p.hookAgg.chillOnHit) if (this.rng.float() < s.chance) this._applySlow(e, s.mult, s.duration, p);
    for (const c of p.hookAgg.chainOnHit) if (this.rng.float() < c.chance) {
      const near = this._nearestEnemyExcept(e.x, e.y, c.range, e);
      if (near) {
        this.fx.beams.push({ x1: e.x, y1: e.y, x2: near.x, y2: near.y, color: '#4fd8eb' });
        this.damageEnemy(near, Math.max(1, Math.round(this._attuned(p, c.damage))), { owner: p });
      }
    }
    if (ctx.crit && p.hookAgg.critHeal) this._heal(p, p.hookAgg.critHeal);
  }

  // Lodestone: if the bond partner also hit this enemy within the last second,
  // the hit echoes for bonus attuned damage (small per-enemy cooldown).
  _soulbondEcho(p, e, hitDmg, stampKey) {
    if (!e.hitStamps) return;
    let holder = null, partnerKey = null;
    for (const q of this.livePlayers()) {
      if (q.char.trait.key !== 'soulbond' || q.downed) continue;
      const b = this._bondTarget(q);
      if (!b) continue;
      const qKey = q.idx, bKey = b.player ? b.player.idx : 's' + q.idx;
      if (stampKey === qKey) { holder = q; partnerKey = bKey; break; }
      if (stampKey === bKey) { holder = q; partnerKey = qKey; break; }
    }
    if (!holder) return;
    const t = holder.char.trait;
    const last = e.hitStamps[partnerKey];
    if (last === undefined || this.time - last > t.window) return;
    if ((e.echoCd || 0) > this.time) return;
    e.echoCd = this.time + 0.5;
    const echo = Math.max(1, Math.round(this._attuned(holder, hitDmg * t.echoFactor)));
    this.fx.beams.push({ x1: holder.x, y1: holder.y, x2: e.x, y2: e.y, color: '#c9a6ff' });
    this.damageEnemy(e, echo, { owner: holder });
  }

  _chainLightning(e, ctx, chain) {
    const p = ctx.owner;
    let from = e;
    // chain damage: factor of the hit that triggered it, scaling with Attunement
    const base = ctx.baseDmg || (ctx.weaponDef ? ctx.weaponDef.dmg : 5);
    const dmg = Math.max(1, Math.round(this._attuned(p, base * chain.factor)));
    const hit = new Set([e.id]);
    for (let i = 0; i < chain.count; i++) {
      const next = this._nearestEnemyExcept(from.x, from.y, chain.range, from, hit);
      if (!next) break;
      // lightning doesn't bend around corners: each hop needs line of sight
      if (this.losBlocked(from.x, from.y, next.x, next.y)) break;
      hit.add(next.id);
      this.fx.beams.push({ x1: from.x, y1: from.y, x2: next.x, y2: next.y, color: '#4fd8eb' });
      this.damageEnemy(next, dmg, { owner: p });
      from = next;
    }
  }

  _applyBurn(e, dps, dur, owner) {
    if (!e.active) return;
    e.burnDps = Math.max(e.burnDps || 0, dps);
    e.burnT = Math.max(e.burnT || 0, dur);
    e.burnOwner = owner;
  }
  // Chill: Attunement deepens the slow and stretches its duration.
  _applySlow(e, mult, dur, owner) {
    if (!e.active) return;
    if (owner && owner.stats) {
      const att = 1 + (owner.stats.attunement + owner.hookAgg.statusBoost) / 100;
      mult = Math.max(0.15, 1 - (1 - mult) * att);
      dur *= Math.max(0.25, att);
    }
    if (e.boss) mult = 1 - (1 - mult) * 0.5; // bosses shrug off half of any chill
    e.slowMult = Math.min(e.slowMult === undefined || e.slowT <= 0 ? 1 : e.slowMult, mult);
    e.slowT = Math.max(e.slowT || 0, dur);
  }

  // Auto-aim weight. A Bounty Hunt mark is the thing the level is asking you
  // to kill, and a champion whose escort soaks every shot is just a wall — so
  // a mark inside range reads as much closer than it is and wins the lock.
  // Auto-aim strongly prefers a bounty mark: it is the only thing on the
  // level with a health bar worth the name, and its own endless stream is
  // standing between it and every gun. At 0.3 the stream soaked so many
  // shots that a solo player never finished a single mark. The weight
  // multiplies SQUARED distance, so 0.12 means a mark competes as if it
  // were a third as far away — chaff right on top of you still wins.
  _aimWeight(e) { return e.bounty ? 0.12 : 1; }

  // Contract: a kill makes the Assassin untargetable for a beat. Enemies pick
  // someone else; solo, they simply have nothing to chase.
  targetable(p) { return !p.gone && !p.downed && !(p.vanishT > 0); }

  _nearestEnemy(x, y, range) {
    let best = null, bd = range * range;
    for (const e of this.enemyPool) {
      const d = dist2(x, y, e.x, e.y);
      if (d > range * range) continue;
      const w = d * this._aimWeight(e);
      if (w < bd) { bd = w; best = e; }
    }
    return best;
  }
  _nearestEnemyExcept(x, y, range, except, exceptIds) {
    let best = null, bd = range * range;
    for (const e of this.enemyPool) {
      if (e === except || (exceptIds && exceptIds.has(e.id))) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  nearestLivingPlayer(x, y) {
    let best = null, bd = Infinity;
    for (const p of this.players) {
      if (p.gone || p.downed) continue;
      if (p.vanishT > 0) continue;   // Contract: the Assassin just vanished
      const d = dist2(x, y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    // Solo, an untargetable player must still be SOMETHING to walk toward, or
    // the whole field stands still and the fight cannot be finished.
    if (best) return best;
    for (const p of this.players) {
      if (p.gone || p.downed) continue;
      const d = dist2(x, y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  // What enemies aim at: a nearby Mirage decoy wins over real players.
  tauntTarget(x, y) {
    let best = null, bd = Infinity;
    for (const d of this.decoys) {
      const dd = dist2(x, y, d.x, d.y);
      if (dd < d.tauntR * d.tauntR && dd < bd) { bd = dd; best = d; }
    }
    if (best) return best;
    // Relic Run: a relic carrier is loud — enemies weigh them as if they
    // stood much closer, so carrying really does pull the room onto you
    if (this.obj && this.obj.type === 'relic') {
      let pick = null, pd = Infinity;
      for (const p of this.livePlayers()) {
        if (p.downed) continue;
        const w = this.carryingRelic(p) ? 0.35 : 1; // 0.35 ≈ "three times as loud"
        const d = dist2(x, y, p.x, p.y) * w;
        if (d < pd) { pd = d; pick = p; }
      }
      if (pick) return pick;
    }
    return this.nearestLivingPlayer(x, y);
  }

  carryingRelic(p) {
    return !!(this.obj && this.obj.type === 'relic'
      && this.obj.relics.some(r => r.carrier === p.idx));
  }

  // ---------------- damage plumbing ----------------

  damageEnemy(e, amount, opts = {}) {
    if (!e.active) return;
    // A walled nest cannot be hurt until BOTH of its rings are breached.
    // Sight and projectiles already stop at the barricades; this makes the
    // rule absolute, so novas and other line-of-sight-ignoring damage do
    // not quietly skip the part of the level that IS the level.
    if (e.nestShielded) { this.fx.blocks.push({ x: e.x, y: e.y }); this._dmgLedger(e, opts.owner, 0, 'nest-shielded'); return; }
    // warden allies shield: 50% reduction if a living warden is nearby (not self)
    if (!e.boss && e.def.behavior !== 'warden') {
      for (const w of this.enemyPool) {
        if (w.boss || w.def.behavior !== 'warden' || w === e) continue;
        // `shieldR > 0` GUARDED, not assumed. A warden's ally aura is optional —
        // region 1's Sapling is a 7 HP warden with no aura at all — and without
        // this the comparison is `dist2 < NaN`, which is false by accident
        // rather than by intent. An optional field should be checked, not
        // survive on the shape of IEEE 754.
        if (!(w.def.shieldR > 0)) continue;
        if (dist2(w.x, w.y, e.x, e.y) < w.def.shieldR * w.def.shieldR) { amount = Math.max(1, Math.round(amount * (1 - w.def.shieldReduce))); break; }
      }
    }
    // shielded elite: eats one hit periodically
    if (e.eliteMod && e.eliteMod.blockCd && !opts.noEffects) {
      if ((e.blockT || 0) <= 0) {
        e.blockT = e.eliteMod.blockCd; this.fx.blocks.push({ x: e.x, y: e.y });
        this._dmgLedger(e, opts.owner, 0, 'blocked');
        return;
      }
    }
    amount = Math.max(1, Math.round(amount));
    e.hp -= amount;
    e.hitFlash = 0.1;
    // a Regenerating elite stops healing while it is being hit (see ELITE_MODS)
    if (e.eliteMod && e.eliteMod.regenLockS) e.regenLock = e.eliteMod.regenLockS;
    if (!opts.silent) this.fx.hits.push({ x: Math.round(e.x), y: Math.round(e.y - e.radius), a: amount, c: opts.crit ? 1 : 0 });
    const p = opts.owner;
    this._dmgLedger(e, p, amount, 'landed');
    if (p && p.stats) {
      p.damageDealt += amount;
      // lifesteal is a healing SOURCE (items + innate traits), amplified by Recovery in _heal
      const ls = p.hookAgg.lifesteal + (p.char.trait.lifesteal || 0);
      if (ls > 0 && !opts.noLifesteal) {
        p.lsAcc = (p.lsAcc || 0) + amount * ls / 100;
        if (p.lsAcc >= 1) { const h = Math.floor(p.lsAcc); p.lsAcc -= h; this._heal(p, h); }
      }
    }
    if (e.hp <= 0) this._killEnemy(e, p);
  }

  _killEnemy(e, killer) {
    // A Bounty Hunt mark leaves the pool through here whether it was KILLED or
    // merely removed — a bomber's self-detonation calls explodeEnemy at full
    // health, and the objective used to count that as a kill. Stamp which it
    // was, so tickBounty can tell the difference; hp <= 0 is the only thing
    // that means "the party actually brought it down".
    if (e.bounty && this.obj && this.obj.type === 'bounty') this.obj.markDied = e.hp <= 0;
    const { x, y } = e;
    if (killer && killer.trigEvents) SK.onSkillKill(this, killer);
    this.fx.deaths.push({ x: Math.round(x), y: Math.round(y), c: e.boss ? e.bossDef.color : e.def.color, r: e.radius });
    this.pushEvent({ k: 'sfx', s: 'enemyDie' });
    // the ward pylon falls: the empowerment ends
    if (e.id === this.pylonId) {
      this.pylonId = null;
      this.enemyBuff = 1;
      this.pushEvent({ k: 'toast', idx: -1, text: 'The ward pylon shatters — the empowerment ends' });
      this.fx.booms.push({ x: Math.round(x), y: Math.round(y), r: 120 });
    }
    // §8.3 JUDGMENT MARK DETONATION. It fires on the mark, not on the killer:
    // a Priest's mark pays out when the marked thing dies, whoever killed it and
    // whether or not the Priest is still standing. Every other death hook here
    // reads `killer.hookAgg`, which is the item aggregate and is why a
    // skill-placed mark had nowhere to live before this.
    //
    // The heal routes through `_heal`, so Recovery amplifies it like every other
    // source, and it reaches ALLIES — the mark is the Priest's contribution to a
    // party, and a version that healed only the caster would be a lifesteal item.
    if (e.markT > 0 && e.markHeal > 0) {
      // THE MARK IS SPENT BEFORE IT PAYS, and that ordering is load-bearing.
      // The Priest's own `grace_and_judgment` trait turns healing into damage
      // through `tohOnHeal`, so a detonation that healed while still marked went
      // heal -> damage -> kill the same enemy -> detonate -> heal, and blew the
      // stack. Clearing first makes it one bounce, never a loop — the same
      // guarantee `voodooMirror` gets from its `mirrored` flag, and the same
      // class of defect: a payout that re-enters the path that triggered it.
      const heal = e.markHeal, radius = e.markRadius, owner = this.players[e.markBy];
      e.markT = 0; e.markHeal = 0;
      let healed = 0;
      for (const q of this.livePlayers()) {
        if (dist2(x, y, q.x, q.y) > radius * radius) continue;
        this._heal(q, heal, { by: owner });
        healed++;
      }
      if (healed) {
        this.fx.booms.push({ x: Math.round(x), y: Math.round(y), r: radius });
        this.pushEvent({ k: 'sfx', s: 'revive' });
      }
    }
    tohEnemyDied(this, e);              // Necromancer bone-dust — any kill, anywhere
    // A soul token, from ANY death, for ANY party. It is a world resource read
    // by the ON_TOKEN trigger, not a Necromancer counter — so the Wizard's Soul
    // tree reads the same pool later with nothing added here.
    MIN.dropToken(this, x, y);
    if (killer && killer.stats) tohOnKill(this, killer, e);
    // drops
    // GOLD (§2.4 node payout, §4.1 difficulty) MULTIPLIES HERE, NOT AT SPAWN.
    // It was applied to `e.mats` at spawn and rounded, and `def.mats` is 1 or 2
    // — so Math.round(1 × 0.9) is 1 and every sub-1.0 multiplier vanished. The
    // difficulty gate caught it as Measured paying ×1.04 where its table says
    // ×0.9: a multiplier that rounds to identity is not a multiplier.
    //
    // The accumulator carries the fraction across kills so the rate is exact in
    // aggregate rather than truncated on every enemy.
    const goldMult = (this.fightMods && this.fightMods.gold) || 1;
    let mats = objectiveKillPays(this, e) ? e.mats * this.greedMats : 0;
    // XP RIDES THE PRE-MULTIPLIER AMOUNT (§4.1: XP is never scaled by
    // difficulty). XP is earned per material banked, so paying more gold on a
    // harder setting would pay more XP with it through the back door and make
    // the hardest setting the only correct choice — the exact outcome §4.1
    // exists to prevent.
    let xpMats = mats;
    // A PLAYER'S OWN double DOES carry XP, and difficulty's gold does not. The
    // distinction is not "which multiplier came first", it is whose it is:
    // §4.1 excludes XP from the DIFFICULTY axis so the ladder stays a
    // preference. A hook the player built for is a build paying off.
    if (killer && killer.hookAgg && killer.hookAgg.doubleMaterials && this.rng.float() < killer.hookAgg.doubleMaterials) { mats *= 2; xpMats *= 2; }
    if (goldMult !== 1) {
      this._goldAcc = (this._goldAcc || 0) + mats * (goldMult - 1);
      const extra = Math.floor(this._goldAcc);
      this._goldAcc -= extra;
      mats += extra;
    }
    // THE PAYOUT INSTRUMENT (§13: counters on every new mechanic). Gold and XP
    // now diverge on the kill path, so the fight records what it paid on each
    // axis and how many kills it paid for. Measuring the ratio at the pickup
    // instead makes the denominator "materials the bot happened to walk over",
    // which is a fixture property, not a game one.
    this.payout.kills++; this.payout.gold += mats; this.payout.xp += xpMats;
    // A pickup carries its own XP value. The BASE materials carry XP; the
    // extras the gold multiplier added carry NONE, so a harder setting pays
    // more gold and exactly the same XP. That is §4.1's exclusion expressed in
    // the drop rather than trusted to a load assertion.
    for (let i = 0; i < mats; i++) {
      this._dropMaterial(x + (this.rng.float() * 30 - 15), y + (this.rng.float() * 30 - 15), 1, i < xpMats ? 1 : 0);
    }
    // killer hooks & traits
    if (killer && killer.stats) {
      killer.kills++;
      killer.lastKillT = this.time;
      if (killer.roomFirstKillT < 0) killer.roomFirstKillT = this.time;
      const t = killer.char.trait;
      if (t.key === 'kill_heal') this._heal(killer, t.amount);
      if (t.key === 'red_tithe') this._heal(killer, t.healPerKill); // Vesper: a 1 HP source, Recovery-amplified
      if (killer.hookAgg.killHeal > 0) this._heal(killer, killer.hookAgg.killHeal);
      if (killer.hookAgg.critAfterKill) killer.critArmed = true;
      for (const ke of killer.hookAgg.killExplode) {
        if (this.rng.float() < ke.chance) {
          this.fx.booms.push({ x, y, r: ke.radius });
          this._areaDamageEnemies(x, y, ke.radius, Math.max(1, Math.round(this._attuned(killer, ke.damage))), killer, { exclude: e });
          this.pushEvent({ k: 'sfx', s: 'boom' });
        }
      }
      for (const vk of killer.hookAgg.vitalityOnKill) {
        if (killer.vitKillGained < vk.cap) { killer.vitKillGained += vk.amount; this._applyPerm(killer, { vitality: vk.amount }); }
      }
      for (const kt of killer.hookAgg.killTempo) {
        if (killer.frenzy.length < kt.maxStacks) killer.frenzy.push({ tempo: kt.tempo, t: kt.duration });
        else { const oldest = killer.frenzy.reduce((a, b) => a.t < b.t ? a : b); oldest.t = kt.duration; }
      }
    }
    // death behaviors
    if (!e.boss) {
      // death-puddle chaff: campers manufacture their own toxic lake
      if (e.puddle) {
        const puds = this.zones.filter(z => z.acid);
        if (puds.length >= CONFIG.PUDDLE_CAP) {
          // oldest fades first (capped for perf and readability)
          const oldest = puds.reduce((a, b) => (a.t > b.t ? a : b));
          oldest.dur = Math.min(oldest.dur, oldest.t + 0.5);
        }
        this.addZone({
          x, y, r: CONFIG.PUDDLE_R, dps: CONFIG.PUDDLE_DPS * e.dmgScale,
          dur: CONFIG.PUDDLE_DUR, hurts: 'players', color: '#7dee6a', acid: true,
        });
      }
      if (e.def.behavior === 'splitter' && !e.mini) {
        for (let i = 0; i < e.def.splitInto; i++) {
          this.spawnEnemyById(e.def.id, x + (i ? 18 : -18), y + (this.rng.float() * 20 - 10), { mini: true, noMats: false });
        }
      }
      if (e.def.behavior === 'bomber' && !e.fusing) {
        this.addTelegraph({ shape: 'circle', x, y, r: e.def.boom.radius, dur: e.def.boom.fuse, boom: { dmg: e.def.boom.dmg * e.dmgScale, radius: e.def.boom.radius } });
      }
      if (e.eliteMod && e.eliteMod.boom) {
        this.addTelegraph({ shape: 'circle', x, y, r: e.eliteMod.boom.radius, dur: e.eliteMod.boom.fuse, boom: { dmg: e.eliteMod.boom.dmg * e.dmgScale, radius: e.eliteMod.boom.radius } });
      }
    }
    this.enemyPool.release(e);
    if (e.boss) this._bossDown(e);
  }

  explodeEnemy(e, boom) {
    const { x, y } = e;
    this.fx.booms.push({ x, y, r: boom.radius });
    this.pushEvent({ k: 'sfx', s: 'boom' });
    this.shake = Math.max(this.shake, 5);
    for (const p of this.livePlayers()) {
      if (!p.downed && dist2(x, y, p.x, p.y) < (boom.radius + p.radius) * (boom.radius + p.radius)
        && !this.losBlocked(x, y, p.x, p.y)) { // blasts don't reach through walls
        this.hurtPlayer(p, boom.dmg * e.dmgScale, e);
      }
    }
    // keep e.fusing set so _killEnemy skips scheduling a second death-boom
    this._killEnemy(e, null);
  }

  // returns how many enemies the blast actually reached (Pulsar's nova heals
  // per enemy struck, so the count has to come back out of here)
  _areaDamageEnemies(x, y, radius, dmg, owner, opts = {}) {
    const seen = new Set();
    let hits = 0;
    this._areaDamageWalls(x, y, radius, dmg, owner);
    this.grid.query(x, y, radius + 40, e => {
      if (!e.active || seen.has(e.id) || e === opts.exclude) return;
      seen.add(e.id);
      if (dist2(x, y, e.x, e.y) <= (radius + e.radius) * (radius + e.radius)) {
        if (this.losBlocked(x, y, e.x, e.y)) return; // blasts are clipped by walls
        this.damageEnemy(e, dmg, { owner, silent: opts.silent, crit: false });
        hits++;
      }
    });
    return hits;
  }

  // THE ONE ENEMY-PULLING MOVER.
  //
  // Three pulls existed before this and none of them was reusable. The boss
  // vortex (:3241) and the `magnetic` elite mod (js/entities/enemies.js:83)
  // both drive `p.pullX/pullY` — the PLAYER channel, resisted by Grit and
  // cleared every tick. Enemies had no channel at all: the singularity trait
  // wrote `e.x`/`e.y` inline, three lines deep in a loop that also applied
  // vulnerability, counted a lifetime and detonated. So "pull an enemy" was
  // arithmetic somebody had written once, not a thing the engine could do.
  //
  // `distance` IS A DISTANCE, not a speed — what one application drags. A
  // caller integrating over time passes `speed * dt`, which is what the
  // singularity now does. Every doc block that asks for a pull asks in pixels
  // per application, so that is the unit this takes.
  //
  // "UP TO" IS LITERAL. The drag stops at the centre instead of overshooting
  // it, which the inline loop did not do: an enemy inside one step's reach of
  // the middle used to be flung past it and dragged back next tick.
  //
  // Bosses are not dragged, matching the singularity. Distance is measured
  // centre-to-centre, also matching it — a well's radius is the well's radius,
  // not the well's radius plus the body's. `clampToRoom` is the hook no mover
  // slips past (walls, push-out, beast bodies), so this ends there.
  //
  // Returns HOW MANY were moved. The Mage's engine is "+2 energy per enemy
  // pulled" and five of its nodes feed on that count, so the count is the
  // primitive's output and not a side effect somebody has to re-derive.
  // Attribution is the CALLER'S — this moves bodies and counts them.
  //
  // No fx. The tell for a pull is the enemies visibly converging, which is a
  // more direct read than any ring drawn over it, and a field pulsing eight
  // times would otherwise stamp eight explosion rings on a fight nobody
  // exploded in.
  gravityPull(x, y, radius, distance) {
    if (!(distance > 0) || !(radius > 0)) return 0;
    const seen = new Set();
    let pulled = 0;
    this.grid.query(x, y, radius + 40, e => {
      if (!e.active || seen.has(e.id)) return;
      seen.add(e.id);
      if (e.boss) return;                          // bosses are not dragged
      const dx = x - e.x, dy = y - e.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > radius * radius || d2 < 1) return;
      const d = Math.sqrt(d2), step = Math.min(distance, d);
      e.x += dx / d * step;
      e.y += dy / d * step;
      this.clampToRoom(e);
      pulled++;
    });
    return pulled;
  }

  hurtPlayer(p, raw, src, opts = {}) {
    if (this.over || p.gone || p.downed || this.god) return;
    // Objective hazards (the storm's burn, the Breach collapse) are the LEVEL,
    // not an attacker: no i-frames, no dodge, no Grit, no shields. They tick
    // continuously, so anything else would make standing in them survivable.
    if (opts.trueDamage) {
      p.relocT = 0;
      p.hp -= raw;
      if (p.hp <= 0) this._downPlayer(p);
      return;
    }
    if (p.invuln > 0) return;
    p.relocT = 0; // taking a hit breaks the structure-recall channel
    raw *= this.enemyBuff; // the siege's ward pylon empowers everything
    const t = p.char.trait;
    // Reflex: dodge chance (capped in recompute); every on-dodge effect keys off this
    if (!opts.shared && this.rng.float() * 100 < p.stats.reflex) {
      this.fx.hits.push({ x: Math.round(p.x), y: Math.round(p.y - 24), a: 0, c: 2 }); // "dodge" popup
      if (t.key === 'slipstream') { p.tempoBuffT = t.dur; p.nextCrit = true; }
      if (t.key === 'afterimage') {
        this.decoys.push({ x: p.x, y: p.y, t: t.dur, dur: t.dur, tauntR: t.tauntR, owner: p.idx, burst: t.burst, radius: t.radius });
      }
      if (p.hookAgg.nextAttackAfterDodge > 0) { p.dmgBuffT = 3; p.dmgBuffAmt = p.hookAgg.nextAttackAfterDodge; }
      tohOnDodge(this, p);   // Monk: leave a spirit behind
      // NOT an ON_DODGE. Reflex remains a defensive stat and still avoids the
      // damage — but avoiding a hit with a dice roll is not a positional dodge,
      // and treating it as one is exactly what made Rebuke reward Reflex
      // instead of movement. ON_DODGE now comes only from telegraphs.js, where
      // it means "was inside the committed zone, left it before it resolved".
      return;
    }
    SK.onSkillHitTaken(this, p);
    // the ward eats damage and returns a share of it to whatever landed the hit
    raw = SK.wardAbsorb(this, p, raw, src);
    if (raw <= 0) return;
    // auto-block shield item
    if (p.hookAgg.blockShield !== null && p.blockT <= 0) {
      p.blockT = p.hookAgg.blockShield;
      this.fx.blocks.push({ x: p.x, y: p.y });
      return;
    }
    // Grit: raw × 15/(15+Grit); negative capped at +50% extra damage
    // (denominator guarded so Grit ≤ −15 can't flip the multiplier negative)
    const grit = p.stats.grit;
    let mult = grit >= 0
      ? CONFIG.ARMOR_K / (CONFIG.ARMOR_K + grit)
      : Math.min(1 + CONFIG.NEG_ARMOR_MAX_BONUS, CONFIG.ARMOR_K / Math.max(0.001, CONFIG.ARMOR_K + grit));
    if (t.key === 'glass') mult *= t.takeMult;
    let dmg = Math.max(1, Math.round(raw * mult));
    // Soulbond: 30% of post-mitigation damage flows across the tether
    if (!opts.shared) dmg = this._soulbondShare(p, dmg);
    tohOnHurt(this, p, raw, dmg);   // Karma bank, Iron stance refund
    // The stance absorbs before anything else: it is the thing the player is
    // standing still to maintain, and it should be what breaks first.
    if (p.footingShield > 0) {
      const eaten = Math.min(p.footingShield, dmg);
      p.footingShield -= eaten; dmg -= eaten;
    }
    // overheal shield absorbs first
    if (dmg > 0 && p.shield > 0) {
      const absorbed = Math.min(p.shield, dmg);
      p.shield -= absorbed; dmg -= absorbed;
      // Grace shields throw a share of what they eat back at the attacker
      if (p.shieldReflect > 0 && src && src.active) {
        this.damageEnemy(src, Math.max(1, Math.round(absorbed * p.shieldReflect)), { owner: p, noLifesteal: true });
      }
      if (p.shield <= 0) p.shieldReflect = 0;
    }
    p.hp -= dmg;
    p.invuln = CONFIG.INVULN_AFTER_HIT;
    this.shake = Math.max(this.shake, 3);
    this.pushEvent({ k: 'sfx', s: 'hurt' });
    this.fx.hits.push({ x: Math.round(p.x), y: Math.round(p.y - 24), a: dmg, c: 3 }); // red popup
    // thorns need an attacker to reflect at; the retaliate nova fires on ANY hit
    if (src && src.active && p.hookAgg.thorns > 0) {
      this.damageEnemy(src, p.hookAgg.thorns, { owner: p, noLifesteal: true });
    }
    for (const rt of p.hookAgg.onHurtRetaliate) {
      this.fx.booms.push({ x: p.x, y: p.y, r: rt.radius });
      this._areaDamageEnemies(p.x, p.y, rt.radius, Math.max(1, Math.round(this._attuned(p, rt.damage))), p);
    }
    if (p.hp <= 0) {
      // second wind item: cheat death once per floor
      if (p.hookAgg.secondWind !== null && !p.secondWindUsed) {
        p.secondWindUsed = true;
        p.hp = Math.max(1, Math.round(p.stats.vitality * p.hookAgg.secondWind));
        p.invuln = 1.5;
        this.pushEvent({ k: 'toast', idx: p.idx, text: 'Second wind! Death refused.' });
        return;
      }
      this._downPlayer(p);
    } else if (t.key === 'berserk_missing') {
      this._recomputeStats(p);
    }
  }

  _downPlayer(p) {
    p.hp = 0;
    p.downed = true;
    p.reviveP = 0;
    this.pushEvent({ k: 'downed', idx: p.idx });
    this.pushEvent({ k: 'sfx', s: 'downed' });
    if (this.livePlayers().every(q => q.downed)) this._finish(false);
  }

  // Lodestone: whoever stands in the tether — the holder or their bond target —
  // hands 30% of incoming (post-mitigation) damage to the other end. The
  // transfer lands directly (no second dodge/Grit roll) and CAN down them.
  _soulbondShare(p, dmg) {
    let partner = null, share = 0;
    if (p.char.trait.key === 'soulbond') {
      const b = this._bondTarget(p);
      share = p.char.trait.dmgShare;
      if (b && b.player) partner = b.player;
      else if (b && b.summon) partner = b.summon;
    } else {
      for (const q of this.livePlayers()) {
        if (q === p || q.downed || q.char.trait.key !== 'soulbond') continue;
        const b = this._bondTarget(q);
        if (b && b.player === p) { partner = q; share = q.char.trait.dmgShare; break; }
      }
    }
    if (!partner) return dmg;
    const moved = Math.floor(dmg * share);
    if (moved <= 0) return dmg;
    if (partner.stats) { // a player
      if (partner.downed || partner.gone) return dmg;
      let rest = moved;
      if (partner.shield > 0) { const ab = Math.min(partner.shield, rest); partner.shield -= ab; rest -= ab; }
      partner.hp -= rest;
      this.fx.hits.push({ x: Math.round(partner.x), y: Math.round(partner.y - 24), a: rest, c: 3 });
      if (partner.hp <= 0) this._downPlayer(partner);
    } else { // the solo bond: a summon soaks it
      partner.hp -= moved;
      if (partner.hp <= 0) { partner.dead = true; this.fx.deaths.push({ x: partner.x, y: partner.y, c: '#9aa0bd', r: 12 }); }
    }
    return dmg - moved;
  }

  // ---------------- projectiles / areas / contact ----------------

  _tickProjectiles(dt) {
    for (const pr of this.projPool) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.ttl -= dt;
      const expired = pr.ttl <= 0;
      const oob = pr.x < WALL - 10 || pr.x > this.W - WALL + 10 || pr.y < WALL - 10 || pr.y > this.H - WALL + 10;
      if (pr.friendly) {
        if (pr.lob) {
          if (expired || oob) { this._lobExplode(pr); this.projPool.release(pr); }
          continue;
        }
        // straight shots are absorbed by walls (lobs above arc over) — and a
        // DESTRUCTIBLE wall takes the hit rather than merely eating the shot
        if (this.obstacles.length && this._inObstacle(pr.x, pr.y, 0)) {
          const hitWall = this._wallAt(pr.x, pr.y, 0);
          if (hitWall) this.damageWall(hitWall, pr.dmg, this.players[pr.owner]);
          this.projPool.release(pr); continue;
        }
        // A summon seed is a delivery, not a shot: it passes through everything
        // and plants its payload where it stops. Handled here rather than in a
        // per-skill branch — this code knows a seed carries something, never
        // what. See §8.5, "the token is a place".
        if (pr.kind === 'summonSeed') {
          if (expired || oob) { MIN.plantSeed(this, pr); this.projPool.release(pr); }
          continue;
        }
        if (expired || oob) { this.projPool.release(pr); continue; }
        // vs enemies
        let dead = false;
        this.grid.query(pr.x, pr.y, pr.radius + 40, e => {
          if (dead || !e.active || pr.hitIds.has(e.id)) return;
          if (dist2(pr.x, pr.y, e.x, e.y) <= (pr.radius + e.radius) * (pr.radius + e.radius)) {
            pr.hitIds.add(e.id);
            if (pr.skill) {
              SK.hitSkillProj(this, pr, e);
              if (pr.pierce > 0) pr.pierce--; else { dead = true; }
              return;
            }
            const owner = this.players[pr.owner];
            const def = WEAPON_BY_ID[pr.weaponId];
            const knock = ((def && def.knock) || pr.summonKnock || 0) * owner.hookAgg.knockMult;
            this._hitEnemy(e, pr.dmg, { owner, crit: pr.crit, weaponDef: def, knock, baseDmg: pr.dmg, summon: pr.fromSummon }, Math.atan2(pr.vy, pr.vx));
            if (pr.summonBurn && e.active) this._applyBurn(e, this._attuned(owner, pr.summonBurn.dps), pr.summonBurn.dur, owner);
            if (pr.pierce > 0) pr.pierce--; else { dead = true; }
          }
        });
        if (dead) this.projPool.release(pr);
      } else {
        // enemy shots are absorbed by walls too — cover is symmetric and real
        if (this.obstacles.length && this._inObstacle(pr.x, pr.y, 0)) { this.projPool.release(pr); continue; }
        // ...and by coral, which is the one wall that is NOT symmetric: it
        // stops enemy fire and lets the party shoot straight through it.
        if (this.coralWalls.length) {
          const wl = coralBlocks(this, pr.x - pr.vx * DT, pr.y - pr.vy * DT, pr.x, pr.y);
          if (wl) { wl.hp -= 4; this.projPool.release(pr); continue; }
        }
        if (expired || oob) { this.projPool.release(pr); continue; }
        // ...and by a Hunter's beast, which is a shield as well as a weapon.
        // Checked BEFORE players: standing behind the bear is the point.
        const guard = beastAbsorbs(this, pr);
        if (guard) {
          hurtBeast(this, guard, pr.dmg);
          this.projPool.release(pr);
          continue;
        }
        for (const p of this.livePlayers()) {
          if (p.downed) continue;
          if (dist2(pr.x, pr.y, p.x, p.y) <= (pr.radius + p.radius) * (pr.radius + p.radius)) {
            this.hurtPlayer(p, pr.dmg, null);
            this.projPool.release(pr);
            break;
          }
        }
      }
    }
  }

  _lobExplode(pr) {
    const def = WEAPON_BY_ID[pr.weaponId];
    const owner = this.players[pr.owner];
    this.fx.booms.push({ x: pr.x, y: pr.y, r: def.aoe });
    this.pushEvent({ k: 'sfx', s: 'boom' });
    const seen = new Set();
    this.grid.query(pr.x, pr.y, def.aoe + 50, e => {
      if (!e.active || seen.has(e.id)) return;
      seen.add(e.id);
      if (dist2(pr.x, pr.y, e.x, e.y) <= (def.aoe + e.radius) * (def.aoe + e.radius)) {
        if (this.losBlocked(pr.x, pr.y, e.x, e.y)) return; // the shell arcs over, the blast doesn't
        this._hitEnemy(e, pr.dmg, { owner, crit: pr.crit, weaponDef: def, knock: def.knock * owner.hookAgg.knockMult, baseDmg: pr.dmg });
      }
    });
    if (def.puddle) {
      this.addZone({ x: pr.x, y: pr.y, r: def.aoe * 0.9, dps: this._attuned(owner, def.puddle.dps), dur: def.puddle.dur, hurts: 'enemies', color: def.color, owner: pr.owner });
    }
  }

  spawnEnemyProj(x, y, a, speed, dmg, radius, color) {
    const pr = this.projPool.alloc();
    if (!pr) return;
    Object.assign(pr, {
      id: ++this.spawnCounter, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      dmg, crit: false, friendly: false, lob: false, ttl: 4, radius, color: color || '#ff5d6c',
      owner: -1, pierce: 0, hitIds: null, weaponId: null, kind: 'eshot', summonBurn: null, summonKnock: 0,
    });
  }

  addTelegraph(tg) {
    const entry = { t: 0, ...tg };
    if (entry.follow) entry.followId = entry.follow.id; // pooled slots get reused
    this.telegraphs.push(entry);
  }
  addZone(z) { this.zones.push({ t: 0, acc: 0, ...z }); }
  // Capped, and the cap is a CONFIG constant rather than a tree number: a trap
  // is a world entity on every tick and an uncapped placer is a perf problem
  // before it is a balance one — the same reason the Sundian's coral is capped.
  addTrap(t) {
    const mine = this.traps.filter(x => x.owner === t.owner);
    if (mine.length >= CONFIG.TRAP_CAP) this.traps.splice(this.traps.indexOf(mine[0]), 1);
    this.traps.push({ t: 0, ...t });
  }

  // A POSITIONAL dodge: inside the committed zone at commit, outside it at
  // resolve. This is the only thing that sets the ON_DODGE window now — the
  // Reflex stat roll no longer does, because avoiding damage with a stat is not
  // a dodge and conflating them made Rebuke reward Reflex instead of movement.
  onTelegraphDodge(p, e) { SK.onSkillDodge(this, p); }
  cancelTelegraph(e) { return cancelTelegraph(this, e); }
  telegraphZones() { return liveZones(this); }

  // ---- composed-action surface (js/compose.js calls these) ----
  skillDamage(e, amount, p, skill) { return SK.skillDamage(this, e, amount, p, skill); }
  skillSplash(p, skill, x, y, r, dmg, exclude) { return SK.skillSplash(this, p, skill, x, y, r, dmg, exclude); }
  spawnSkillProj(p, skill, step, rank, angle, range) { return SK.spawnSkillProj(this, p, skill, step, rank, angle, range); }
  // §5.7's `mend` rider: heal this player's live pack. Forwarded rather than
  // imported into compose.js, which minions.js already depends on.
  healMinions(p, amount) { return MIN.healMinions(p, amount); }
  applyPlague(e, dmg, dur, p, skill) { return SK.applyPlague(this, e, dmg, dur, p, skill); }
  applySlow(e, mult, dur, owner = null) { return SK.applySlow(this, e, mult, dur, owner); }
  queueSkillStep(p, skill, step, rank, delay) { return SK.queueSkillStep(this, p, skill, step, rank, delay); }
  // ---- summon surface (js/compose.js's `summon` primitive and ON_TOKEN) ----
  spawnMinions(p, skill, step, rank) { return MIN.spawnMinions(this, p, skill, step, rank); }
  spawnSummonSeed(p, skill, step, rank, at) { return MIN.spawnSummonSeed(this, p, skill, step, rank, at); }
  tokenWithin(x, y, range) { return MIN.tokenWithin(this, x, y, range); }
  claimToken(x, y, range) { return MIN.claimToken(this, x, y, range); }
  addVortex(x, y, v, scale) { this.vortexes.push({ x, y, t: v.dur, pullR: v.pullR, pullSpd: v.pullSpd, dps: v.dps * scale, coreR: v.coreR, acc: 0 }); }

  fireBeam(x, y, a, len, width, dmg, src) {
    len = this.losClipLen(x, y, a, len); // beams stop at the first wall
    this.fx.beams.push({ x1: x, y1: y, x2: x + Math.cos(a) * len, y2: y + Math.sin(a) * len, color: '#ff5d6c', w: width });
    for (const p of this.livePlayers()) {
      if (p.downed) continue;
      if (pointToSegDist(p.x, p.y, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len) < width / 2 + p.radius) {
        this.hurtPlayer(p, dmg, src);
      }
    }
  }

  beamDamageTick(x, y, a, len, width, dps, dt) {
    len = this.losClipLen(x, y, a, len); // beams stop at the first wall
    this.activeBeams.push({ x: Math.round(x), y: Math.round(y), a: +a.toFixed(3), len, w: width });
    for (const p of this.livePlayers()) {
      if (p.downed) continue;
      if (pointToSegDist(p.x, p.y, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len) < width / 2 + p.radius) {
        this.hurtPlayer(p, dps * 0.35, null); // invuln window paces the beam's ticks
      }
    }
  }

  _tickAreas(dt) {
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const tg = this.telegraphs[i];
      tg.t += dt;
      if (tg.follow) {
        if (!tg.follow.active || tg.follow.id !== tg.followId) { this.telegraphs.splice(i, 1); continue; }
        tg.x = tg.follow.x; tg.y = tg.follow.y;
        if (tg.followAim) tg.angle = tg.follow.aimA;
      }
      if (tg.t >= tg.dur) {
        this.telegraphs.splice(i, 1);
        if (tg.boom) {
          this.fx.booms.push({ x: tg.x, y: tg.y, r: tg.boom.radius });
          this.pushEvent({ k: 'sfx', s: 'boom' });
          this.shake = Math.max(this.shake, 4);
          for (const p of this.livePlayers()) {
            if (!p.downed && dist2(tg.x, tg.y, p.x, p.y) <= (tg.boom.radius + p.radius) * (tg.boom.radius + p.radius)
              && !this.losBlocked(tg.x, tg.y, p.x, p.y)) { // blasts don't reach through walls
              this.hurtPlayer(p, tg.boom.dmg, null);
            }
          }
        }
        if (tg.onFire) tg.onFire();
      }
    }
    // Traps age out. An inert object with no clock is a permanent, and a room
    // full of permanents is a killbox the Assassin never has to re-earn.
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const tr = this.traps[i];
      tr.t += dt;
      if (tr.t >= tr.ttl) this.traps.splice(i, 1);
    }
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt; z.acc += dt;
      if (z.acc >= 0.4) {
        const mul = z.acc; z.acc = 0;
        if (z.hurts === 'enemies') {
          const owner = z.owner !== undefined ? this.players[z.owner] : null;
          this._areaDamageEnemies(z.x, z.y, z.r, z.dps * mul, owner, { silent: true });
          // THE HAZARD'S `slow` RIDER, which was carried here and dropped.
          // `PRIMITIVES.hazard` has always passed `slowMult`/`slowDur` into the
          // zone and this loop read only `z.dps`, so Blight, Gravechill and
          // Bramble declared a chill that never once landed. Same shape as the
          // cone/line gap (§13 rule 25): a value plumbed to a consumer that
          // ignores it, validated by a table that only checks the declaration.
          // THE PULL FIELD. `gravity_pull` with a duration registers a zone
          // that does no damage and drags instead, so a repeated pull needs no
          // second list, no second lifetime and no second room-reset — the
          // three places that clear `this.zones` clear it too. `mul` is the
          // elapsed slice this tick covers, so a field declares pixels per
          // 400ms slice, and the slice count is `dur / 0.4` however the frame
          // rate wanders — so a field declaring 14px over eight pulses drags
          // 112px on any machine. Pulse-locked, deliberately: `mul` scaling
          // would make "up to 14px" mean 14.7 on a long frame.
          if (z.pull) this.gravityPull(z.x, z.y, z.r, z.pull);
          if (z.slowMult && z.slowDur) {
            const src = z.ownerIdx !== undefined ? this.players[z.ownerIdx] : owner;
            const seen = new Set();
            this.grid.query(z.x, z.y, z.r + 40, e => {
              if (!e.active || seen.has(e.id)) return;
              seen.add(e.id);
              if (dist2(z.x, z.y, e.x, e.y) > (z.r + e.radius) * (z.r + e.radius)) return;
              this.applySlow(e, z.slowMult, z.slowDur, src);
            });
          }
        } else {
          for (const p of this.livePlayers()) {
            if (!p.downed && dist2(z.x, z.y, p.x, p.y) <= z.r * z.r) this.hurtPlayer(p, z.dps * mul, null);
          }
        }
      }
      if (z.t >= z.dur) this.zones.splice(i, 1);
    }
    for (let i = this.vortexes.length - 1; i >= 0; i--) {
      const v = this.vortexes[i];
      v.t -= dt; v.acc += dt;
      for (const p of this.livePlayers()) {
        if (p.downed) continue;
        const d = dist(v.x, v.y, p.x, p.y);
        if (d < v.pullR && d > 8) { // Grit pull-resist / Immovable applied in _tickPlayer
          const a = angleTo(p.x, p.y, v.x, v.y);
          p.pullX += Math.cos(a) * v.pullSpd;
          p.pullY += Math.sin(a) * v.pullSpd;
        }
        if (v.acc >= 0.5 && d < v.coreR) this.hurtPlayer(p, v.dps * 0.5, null);
      }
      if (v.acc >= 0.5) v.acc = 0;
      if (v.t <= 0) this.vortexes.splice(i, 1);
    }
  }

  _tickContact(dt) {
    for (const e of this.enemyPool) {
      if (e.contactCd > 0) e.contactCd -= dt;
      if (e.bulwarkCd > 0) e.bulwarkCd -= dt;
      for (const p of this.livePlayers()) {
        if (p.downed) continue;
        const rr = e.radius + p.radius;
        if (dist2(e.x, e.y, p.x, p.y) > rr * rr) continue;
        // Immovable: whatever touches the Bulwark regrets it (own cadence,
        // fires even during the player's i-frames)
        const pt = p.char.trait;
        const contact = pt.key === 'immovable' || pt.key === 'crystal_infusion';
        if (contact && e.bulwarkCd <= 0) {
          e.bulwarkCd = CONFIG.CONTACT_COOLDOWN;
          const base = pt.contactBase ?? pt.base;
          const gp = pt.gritPct ?? 0.25, vp = pt.vitPct ?? 0.05;
          const cd = Math.max(1, Math.round(base + gp * Math.max(0, p.stats.grit) + vp * p.stats.vitality));
          this.damageEnemy(e, cd, { owner: p });
          // every third Prism Quartz turns the touch into a blast
          if (p.detonate) {
            this._areaDamageEnemies(e.x, e.y, pt.detonateRadius, Math.max(1, Math.round(this._attuned(p, cd))), p, { exclude: e });
            this.fx.booms.push({ x: Math.round(e.x), y: Math.round(e.y), r: pt.detonateRadius });
          }
          if (!e.active) break;
        }
        if (e.contactCd <= 0 && p.invuln <= 0 && !(p.vanishT > 0)) {
          e.contactCd = CONFIG.CONTACT_COOLDOWN;
          this.hurtPlayer(p, e.dmg, e);
        }
        break;
      }
    }
  }

  _tickHazards(dt) {
    if (!this.hazards) return;
    for (const hz of this.hazards) {
      if (hz.type === 'spikes') {
        // spike STRIPS: banded rects on the old safe/warn/fire cycle
        const cyc = (this.time + hz.offset) % hz.period;
        hz.state = cyc < hz.safe ? 0 : cyc < hz.safe + hz.warn ? 1 : 2;
        if (hz.state === 2) {
          for (const p of this.livePlayers()) {
            if (p.downed || p.invuln > 0) continue;
            if (p.x > hz.x && p.x < hz.x + hz.w && p.y > hz.y && p.y < hz.y + hz.h) this.hurtPlayer(p, hz.dmg, null);
          }
        }
      } else if (hz.type === 'lava') {
        // a migrating field (siege mutation) moves toward its target, then stays
        if (hz.vx !== undefined && hz.travelT > 0) {
          hz.x += hz.vx * dt; hz.y += hz.vy * dt;
          hz.travelT -= dt;
        }
        hz.acc = (hz.acc || 0) + dt;
        if (hz.acc >= 0.5) {
          hz.acc = 0;
          for (const p of this.livePlayers()) {
            if (p.downed) continue;
            if (dist2(hz.x, hz.y, p.x, p.y) < hz.r * hz.r) this.hurtPlayer(p, hz.dps * 0.5, null);
          }
        }
      }
    }
  }

  // ---------------- pickups ----------------

  // `xpValue` defaults to the material's value, so every existing caller keeps
  // paying XP exactly as before. Only the gold multiplier's extra materials
  // pass 0 — see _killEnemy.
  _dropMaterial(x, y, value = 1, xpValue = value) {
    if (this.pickups.length >= 240) {
      const m = this.pickups[(this.rng.float() * this.pickups.length) | 0];
      m.v += value; m.xp = (m.xp === undefined ? m.v - value : m.xp) + xpValue;
      return;
    }
    this.pickups.push({ x: clamp(x, WALL + 10, this.W - WALL - 10), y: clamp(y, WALL + 10, this.H - WALL - 10), v: value, xp: xpValue, vx: 0, vy: 0, target: -1 });
  }

  _tickPickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const m = this.pickups[i];
      if (m.target === -1) {
        // find a puller
        for (const p of this.livePlayers()) {
          if (p.downed) continue;
          const r = CONFIG.PICKUP_RADIUS + Math.max(0, p.stats.reach) * 0.5; // Reach magnetism
          if (dist2(m.x, m.y, p.x, p.y) < r * r) { m.target = p.idx; break; }
        }
      }
      if (m.target !== -1) {
        const p = this.players[m.target];
        if (!p || p.gone || p.downed) { m.target = -1; continue; }
        const a = angleTo(m.x, m.y, p.x, p.y);
        m.spd = Math.min(CONFIG.MAGNET_SPEED, (m.spd || 200) + 1800 * dt);
        m.x += Math.cos(a) * m.spd * dt;
        m.y += Math.sin(a) * m.spd * dt;
        if (dist2(m.x, m.y, p.x, p.y) < (p.radius + 8) * (p.radius + 8)) {
          this.pickups.splice(i, 1);
          this.fightLoot += m.v; // the fight's "collected" tally for the clear banner
          this._collectMaterial(p, m.v, m.xp);
        }
      }
    }
  }

  _collectMaterial(p, v, xpV) {
    this.pushEvent({ k: 'sfx', s: 'pickup' });
    if (p.hookAgg.pickupBonusChance > 0 && this.rng.float() < p.hookAgg.pickupBonusChance) v += 1;
    p.materials += v;
    p.matsCollected += v;
    // XP rides the pickup's OWN xp value where it has one — a difficulty's gold
    // multiplier adds materials that are worth money and no experience (§4.1).
    // Every other caller (tithe, interest, debug) passes nothing and keeps the
    // old behaviour of one XP per material.
    // …and the onboarding ramp's XP compensation rides here, at the single
    // point XP is credited, so it touches experience and nothing else. `mats`
    // above is already banked — the ramp costs the player money and does not
    // cost them levels.
    const onbXp = this.arenaNode ? onboardingXpMult(this.regionIndex, (this.arenaNode.depth || 1) - 1) : 1;
    const xpGain = (xpV === undefined ? v : xpV) * (1 + p.hookAgg.xpBonus / 100) * onbXp;
    p.xp += xpGain;
    p.xpEarned += xpGain;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.banked++;
      SK.grantSkillPoint(this, p);
      p.xpNext = CONFIG.XP_BASE + CONFIG.XP_PER_LEVEL * p.level;
      for (const ls of p.hookAgg.levelStats) this._applyPerm(p, ls.stats);
      // the level-up sound is idx-aware and debounced client-side (airhorn) —
      // the levelUp event is its sole trigger, no generic sfx broadcast
      this.pushEvent({ k: 'levelUp', idx: p.idx });
    }
    const t = p.char.trait;
    // Powderkeg: pickups detonate — 4 + 40% of Greed attuned, radius 40 + 50% of Reach
    if (t.key === 'volatile_greed') {
      const dmg = Math.max(1, Math.round(this._attuned(p, t.base + 0.4 * Math.max(0, p.stats.greed))));
      const r = t.radius + 0.5 * Math.max(0, p.stats.reach);
      this._areaDamageEnemies(p.x, p.y, r, dmg, p, { silent: true });
      this.fx.booms.push({ x: p.x, y: p.y, r: r * 0.6 });
    }
    for (const pb of p.hookAgg.pickupBlast) {
      this._areaDamageEnemies(p.x, p.y, pb.radius, Math.max(1, Math.round(this._attuned(p, pb.damage))), p, { silent: true });
      this.fx.booms.push({ x: p.x, y: p.y, r: pb.radius * 0.6 });
    }
    for (const pt of p.hookAgg.pickupTempo) {
      if (p.frenzy.length < (pt.maxStacks || 5)) p.frenzy.push({ tempo: pt.tempo, t: pt.duration });
    }
    for (const mh of p.hookAgg.materialHeal) if (this.rng.float() < mh.chance) this._heal(p, mh.amount);
    p.metaDirty = true;
  }

  _applyPerm(p, stats) {
    for (const k in stats) p.permStats[k] = (p.permStats[k] || 0) + stats[k];
    this._recomputeStats(p);
  }

  // ---------------- revive / clear / doors ----------------

  // Mirage afterimages: hold aggro for their lifetime, then burst attuned.
  _tickDecoys(dt) {
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i];
      d.t -= dt;
      if (d.t > 0) continue;
      this.decoys.splice(i, 1);
      const owner = this.players[d.owner];
      if (!owner || owner.gone) continue;
      const dmg = Math.max(1, Math.round(this._attuned(owner, d.burst)));
      this.fx.booms.push({ x: Math.round(d.x), y: Math.round(d.y), r: d.radius });
      this.pushEvent({ k: 'sfx', s: 'boom' });
      this._areaDamageEnemies(d.x, d.y, d.radius, dmg, owner);
    }
  }

  _tickRevive(dt) {
    for (const p of this.players) {
      if (p.gone || !p.downed) continue;
      let bestRate = 0, reviver = null;
      for (const q of this.livePlayers()) {
        if (q.downed || q === p) continue;
        if (dist2(p.x, p.y, q.x, q.y) < CONFIG.REVIVE_RADIUS * CONFIG.REVIVE_RADIUS) {
          const qt = q.char.trait;
          const traitBoost = (qt.key === 'field_rites' || qt.key === 'grace_and_judgment') ? qt.reviveBoost : 0;
          const rate = 1 + q.hookAgg.reviveSpeed + traitBoost;
          if (rate > bestRate) { bestRate = rate; reviver = q; }
        }
      }
      if (bestRate > 0) {
        p.reviveP += dt * bestRate / CONFIG.REVIVE_TIME;
        if (p.reviveP >= 1) this._revive(p, CONFIG.REVIVE_HP, reviver);
      } else {
        p.reviveP = Math.max(0, p.reviveP - dt / CONFIG.REVIVE_TIME);
      }
    }
  }

  _revive(p, frac, reviver) {
    p.downed = false;
    p.reviveP = 0;
    p.hp = Math.max(1, Math.round(p.stats.vitality * frac));
    p.invuln = 1.2;
    this.pushEvent({ k: 'revived', idx: p.idx });
    this.pushEvent({ k: 'sfx', s: 'revive' });
    // Sawbones: every revive he performs toughens the whole party
    const rt = reviver && reviver.char.trait;
    if (rt && (rt.key === 'field_rites' || rt.key === 'grace_and_judgment')) {
      const amt = rt.partyVit ?? rt.partyVitPerRevive;
      for (const q of this.livePlayers()) this._applyPerm(q, { vitality: amt });
      this.pushEvent({ k: 'toast', idx: reviver.idx, text: `party +${amt} Vitality` });
    }
  }

  // Per-player fight-clear resolution — used by arena clears AND the siege's
  // boss kill so Greed tithe/interest/heals/trait growths never skip a fight.
  _clearRewards(p) {
    // auto-revive downed at 50%
    if (p.downed) this._revive(p, CONFIG.REVIVE_HP);
    // Greed: floor(G/2) bonus materials at every fight clear (no self-growth)
    const tithe = Math.floor(Math.max(0, p.stats.greed) / 2);
    if (tithe > 0) {
      this._collectMaterial(p, tithe);
      this.pushEvent({ k: 'toast', idx: p.idx, text: `Greed +${tithe}` });
    }
    // interest
    for (const it of p.hookAgg.interest) {
      const gain = Math.min(it.cap, Math.floor(p.materials * it.rate / 100));
      if (gain > 0) { this._collectMaterial(p, gain); this.pushEvent({ k: 'toast', idx: p.idx, text: `Interest +${gain}` }); }
    }
    // baseline breather: recover 10% of missing HP at each clear (+item heals)
    this._heal(p, Math.ceil((p.stats.vitality - p.hp) * 0.1));
    if (p.hookAgg.roomClearHeal > 0) this._heal(p, p.hookAgg.roomClearHeal);
    // Rampart: the fortress keeps growing
    const t = p.char.trait;
    if (t.key === 'living_fortress') this._applyPerm(p, { grit: t.perRoom });
    // banked level-ups resolve now
    this._maybeOffer(p);
  }

  // Boss death ends the siege: sweep, full payout, post-boss shop, and the
  // descent portal (victory on floor 4).
  _bossDown(e) {
    // capture before the add-sweep: a splitter dying there can spawn minis
    // that reuse (and overwrite) the boss's just-released pool slot
    const bossName = e.bossDef.name;
    this.boss = null;
    this.cleared = true;
    this._sanitizeArena();   // the field is inert before any payout screen
    if (this.wave) this.wave.done = true;
    this.shake = 8;
    this.holdCircle = null;
    this.enemyBuff = 1;
    // sweep the battlefield: leftover adds/hazards must not harass the
    // post-boss shop or flip a floor-4 victory into a wipe during pendingEnd
    for (const add of [...this.enemyPool]) if (!add.boss) this._killEnemy(add, null);
    this.spawnQueue.length = 0;
    this.telegraphs = this.telegraphs.filter(tg => !tg.boom);
    this.zones = this.zones.filter(z => z.hurts !== 'players');
    this.vortexes.length = 0;
    this.hazards = this.hazards.filter(h => !h.vx); // the migrating field burns out
    for (const pr of this.projPool) if (!pr.friendly) this.projPool.release(pr);
    this.pushEvent({ k: 'bossDown', name: bossName });
    this.pushEvent({ k: 'sfx', s: 'boom' });
    for (const p of this.livePlayers()) this._clearRewards(p); // the siege is a fight clear too
    // the looting window: the boss's payout just dropped and nobody could
    // safely sweep during phases — 8 s to run the field, THEN extraction
    this.lootT = CONFIG.SIEGE_LOOT_WINDOW_S;
  }

  // ---------------- offers: level-ups & treasure ----------------

  _maybeOffer(p) {
    if (p.gone || p.banked <= 0 || p.pendingOffer) return;
    const n = 4 + (p.hookAgg.extraChoice || 0);
    const rng = subRng(this.seed, 'offer', this.regionIndex, this.currentNode ?? -1, p.idx, p.level, p.banked);
    const picks = [];
    const used = new Set();
    let guard = 0;
    while (picks.length < n && guard++ < 80) {
      const rarity = this._rollRarity(rng, p.stats.greed, { common: 62, uncommon: 26, rare: 12, legendary: 0 });
      const pool = STAT_BOOSTS.filter(b => b.rarity === rarity && !used.has(b.stat));
      if (!pool.length) continue;
      const b = rng.pick(pool);
      used.add(b.stat);
      picks.push({ id: b.id, stat: b.stat, amount: b.amount, rarity: b.rarity });
    }
    p.pendingOffer = picks;
    this.pushEvent({ k: 'offer', idx: p.idx, picks, banked: p.banked });
  }

  _offerTreasure(p, kind) {
    const rng = subRng(this.seed, 'treas', this.regionIndex, this.currentNode ?? -1, p.idx);
    const picks = [];
    const used = new Set();
    let guard = 0;
    while (picks.length < 3 && guard++ < 120) {
      let rarity = this._rollRarity(rng, p.stats.greed);
      if (kind === 'elite' && (rarity === 'common' || rarity === 'uncommon')) rarity = rng.chance(0.75) ? 'rare' : 'legendary';
      const pool = ITEMS.filter(it => it.rarity === rarity && !used.has(it.id));
      if (!pool.length) continue;
      const it = rng.pick(pool);
      used.add(it.id);
      picks.push(it.id);
    }
    p.treasureOffer = { kind, picks };
    this.pushEvent({ k: 'treasure', idx: p.idx, kind, picks });
  }

  // Facet's Prism: 1 of 3 temporary boons at each room's entry door. Offer
  // quality rides the same Greed-biased rarity roll; picks are non-blocking
  // (the room plays on while the overlay is up). A boon chosen 3 times total
  // becomes permanent.
  // §5.6 THE OPENING ABILITY. "Characters start with no abilities at all. The
  // first point spent is the character's opening ability, chosen from the tier-1
  // nodes of their trees."
  //
  // THE CHOICE WAS NEVER OFFERED. `initSkillPlayer` grants the point and the sim
  // has accepted `{kind:'learnSkill'}` since the trigger-core patch — but that
  // message has exactly two senders in the repository, and one of them is
  // `tools/offence_test.mjs`. Nothing in any client ever sent it, so with weapons
  // removed a real character arrived on map 1 at level 1 with one unspent point,
  // one open slot, an empty loadout and no way to deal damage. Eleven of the
  // fourteen classes dealt literally zero; the three that did not were running on
  // TRAIT damage — the Blacksmith's contact damage, the Wizard's Decree and the
  // Hunter's free beast — and none of them was using a skill.
  //
  // Offered through the boon machinery rather than a new screen: `boonOffer` is
  // already presented, already resolved by `uiAction`, and already handled on
  // every client. A tier-1 pick is the same shape of decision.
  _offerOpening(p) {
    if (p.openingOffer || p.skillPoints <= 0) return;
    const picks = SK.openingPicks(p);
    if (!picks.length) return;
    p.openingOffer = picks;
    this.pushEvent({ k: 'opening', idx: p.idx, picks });
  }

  // §5.5's MAP-END SPEND STEP — points before purchases.
  //
  // The tree screen has existed since phase 1 and nothing in the run ever
  // pointed at it. Reported from play: level 7 after map 1 of region 1, six
  // unspent points, never once prompted. A build system the player has to
  // remember to open is a build system most players never use.
  //
  // The moment is the post-clear lull, which already hosts the shop — and the
  // ORDER matters rather than merely the presence: what you slot changes what
  // you want to buy, so the spend comes first and the shop opens behind it.
  //
  // THIS DOES NOT GATE THE SHOP, and that is the §5.6 lesson rather than
  // timidity. D-32 was a live offer whose panel never rendered; had the shop
  // been held behind it, a client that misses this panel would lose the shop
  // too. The host offers both, `pend` carries presence, and the client stacks
  // skills above the shop (`#overlay-skills` z-index 26 against the shop's 10).
  // Worst case is a missed prompt, never a stalled run — and `tools/
  // skillscreen_test.mjs` drives it in a browser, because a thing the player
  // must SEE is not proven by a sim assertion that the offer exists (rule 54).
  _offerSpend(p) {
    if (p.gone || p.skillPoints <= 0) return;
    p.spendOffer = p.skillPoints;
    this.pushEvent({ k: 'spend', idx: p.idx, points: p.skillPoints });
  }

  // THE ANTI-SOFTLOCK FLOOR, and it is the same rule `setLoadout` already
  // enforces one layer up: never leave a player with no way to deal damage.
  // A panel is a thing a client can miss — dismissed, disconnected, never
  // rendered because a peer is on an old build — and the cost of missing it was
  // an unplayable run. The choice is still OFFERED first and is still the
  // player's; this only catches the case where nothing answered by the time the
  // fighting starts.
  // AND WHEN IT FIRES, IT IS LOUD. A net that rescues silently is a net that
  // hides the thing it caught: this fired on every single run — the §5.6 card
  // was unreachable behind the map screen's z-index — and the only symptom was a
  // toast that read like a normal part of starting a run. Nothing was red,
  // because the run was playable.
  //
  // So it now records itself. `openingFloored` is a run-long counter that
  // `offence_test` asserts stays at ZERO on the normal path, the event is a
  // `defect` rather than a toast, and DEV builds warn to the console. The floor
  // still rescues — a bricked run is worse than a loud one — but it can no
  // longer do it quietly.
  _floorOpeningAbility(p) {
    if (p.gone || p.skillPoints <= 0) return;
    if (SK.hasDamagingSlotted(p)) return;
    const picks = SK.openingPicks(p);
    if (!picks.length) return;
    const wasOffered = !!p.openingOffer;
    p.openingOffer = null;
    SK.spendSkillPoint(this, p, picks[0].id);
    this.openingFloored = (this.openingFloored || 0) + 1;
    const why = wasOffered
      ? 'the §5.6 card was presented and never answered — check that it is REACHABLE, not merely visible'
      : 'no §5.6 card was ever offered to this player';
    this.pushEvent({ k: 'defect', idx: p.idx, code: 'opening-floor',
      text: `Opening ability auto-granted (${picks[0].name}) — ${why}` });
    if (DEV) console.warn(`[DEFECT] opening-floor: p${p.idx} ${p.charId} — ${why}`);
  }

  _offerBoon(p) {
    const t = p.char.trait;
    const rng = subRng(this.seed, 'boon', this.regionIndex, this.currentNode ?? -1, p.idx);
    const picks = [];
    const used = new Set();
    let guard = 0;
    while (picks.length < 3 && guard++ < 60) {
      const rarity = this._rollRarity(rng, p.stats.greed, { common: 50, uncommon: 32, rare: 14, legendary: 4 });
      const pool = STAT_BOOSTS.filter(b => b.rarity === rarity && !used.has(b.stat));
      if (!pool.length) continue;
      const b = rng.pick(pool);
      used.add(b.stat);
      picks.push({
        id: b.id, stat: b.stat,
        amount: Math.round(b.amount * t.boonMult), // room-length, so beefier than a level-up
        rarity: b.rarity,
        n: p.boonCounts[b.id] || 0,                // shown as pips toward permanence
      });
    }
    p.boonOffer = picks;
    // trait rides along so the panel names itself — Facet and the Druid share
    // this overlay, and the Blacksmith sets `crystal` on its own offer instead
    this.pushEvent({ k: 'boon', idx: p.idx, picks, trait: t.key });
  }

  // Greed biases every rarity roll: uncommon+ weights ×(1 + Greed/100)
  _rollRarity(rng, greed, weights = CONFIG.RARITY_WEIGHTS) {
    const lf = 1 + Math.max(-50, greed) / 100;
    const entries = [
      { r: 'common', w: weights.common },
      { r: 'uncommon', w: weights.uncommon * lf },
      { r: 'rare', w: weights.rare * lf },
      { r: 'legendary', w: weights.legendary * lf },
    ].filter(e => e.w > 0);
    return rng.weighted(entries).r;
  }

  // ---------------- shop ----------------

  _openShop(p, context = 'shop') {
    if (p.gone) return;
    if (!p.shop || p.shop.key !== `${this.regionIndex}:${context}:${this.currentNode ?? -1}`) {
      // locked offers survive into the next shop even if the overlay was never
      // explicitly closed (e.g. the party walked out mid-browse)
      if (p.shop) p.shopLocksCarry = p.shop.stock.filter(s => s.locked && !s.sold);
      p.shopVisit++;
      const rng = subRng(this.seed, 'shop', this.regionIndex, this.currentNode ?? -1, p.idx, p.shopVisit);
      p.shop = {
        key: `${this.regionIndex}:${context}:${this.currentNode ?? -1}`,
        rng, rerolls: 0,
        freeLeft: p.hookAgg.freeRerolls + (p.shrineRerolls || 0),
        stock: [],
        // Trader NODES are the Black Market: 6 slots, cheaper rerolls, and
        // richer guarantees — a destination, now that every extraction shops
        black: /^node/.test(context),
      };
      this._fillStock(p);
    }
    this._sendShop(p);
  }

  _fillStock(p) {
    const t = p.char.trait;
    const shop = p.shop;
    // Gilded One's finest-goods rack: 2 slots (3 at the Black Market)
    const slots = t.key === 'legendary_shop' ? t.slots + (shop.black ? 1 : 0)
      : shop.black ? 6 : CONFIG.SHOP_SLOTS;
    const keep = shop.stock.filter(s => s.locked && !s.sold);
    const carry = p.shopLocksCarry.splice(0);
    shop.stock = [...keep, ...carry];
    while (shop.stock.length < slots) shop.stock.push(this._rollStockEntry(p, shop.rng));
    shop.stock.length = Math.min(shop.stock.length, slots);
    // Stock guarantees — rerolls re-run this, so they hold there too:
    // standard shops ≥1 weapon (≥2 on floor 1, where kits are hungriest);
    // the Black Market ≥2 weapons and ≥1 rare-or-better item. Trait shops
    // keep their own rules (Gilded One's finest-goods rack IS its stock
    // rule, Quartermaster is all-weapon). Locked slots are never replaced.
    if (t.key === 'legendary_shop') return;
    const swappable = s => !s.locked && !s.sold;
    // A GUARANTEE OF SOMETHING UNBUYABLE IS NOT A GUARANTEE. These minimums
    // exist so a kit is never starved of weapons; with no weapon slots on the
    // roster they instead forced 1-2 dead cards into every shop and 2 into
    // every Black Market, which is how 400 of 400 measured shops ended up
    // stocking at least one card nobody could buy.
    const needW = !this._stocksWeapons(p) ? 0
      : t.key === 'arsenal_doctrine' ? 0
      : (shop.black ? 2 : (this.regionIndex === 1 ? 2 : 1));
    let weapons = shop.stock.filter(s => s.kind === 'weapon').length;
    for (let i = shop.stock.length - 1; i >= 0 && weapons < needW; i--) {
      const s = shop.stock[i];
      if (s.kind === 'item' && swappable(s)) { shop.stock[i] = this._rollStockEntry(p, shop.rng, 'weapon'); weapons++; }
    }
    if (shop.black && t.key !== 'arsenal_doctrine') {
      const rarePlus = s => s.kind === 'item' && ITEM_BY_ID[s.id]
        && (ITEM_BY_ID[s.id].rarity === 'rare' || ITEM_BY_ID[s.id].rarity === 'legendary');
      if (!shop.stock.some(rarePlus)) {
        for (let i = shop.stock.length - 1; i >= 0; i--) {
          const s = shop.stock[i];
          if (s.kind === 'item' && swappable(s)) { shop.stock[i] = this._rollStockEntry(p, shop.rng, 'rareplus'); break; }
        }
      }
    }
  }

  // Weighted pick from the current region's population, honouring the node
  // type. Returns null when the party is not in a region, so the base floor
  // tables still drive everything that is not region play.
  // REGION 1, MAP 1 — the onboarding fight. Keyed on node COLUMN, the same
  // parameter `waveConfig` already uses for its rate ramp, so the density cut and
  // the archetype cut are indexed by one thing rather than two.
  _onboarding() {
    return isOnboardingNode(this.regionIndex, this.arenaNode);
  }

  // Which ids this fight may draw from. The onboarding table is a HARD
  // restriction rather than a weighting: three archetypes means three, or the
  // composition stops teaching and becomes a thinner version of the same noise.
  _spawnTable(regionPop) {
    if (this._onboarding()) return this._onboardingTable();
    if (regionPop && REGION_ENEMIES[this.region]) return REGION_ENEMIES[this.region].enemies.map(e => e.id);
    // THE FALLBACK FOR A REGION WITH NO POPULATION. Regions 3-8 have no roster
    // yet; the four legacy floor tables are real, tuned enemy sets and they
    // spread across the first four regions, with the hardest repeating beyond.
    // A region that reaches this line is unfinished content, and drawing the
    // deepest legacy table is the right way to be wrong — a level-64 party
    // meeting floor-1 trash would read as a bug, not as a gap.
    return FLOOR_TABLES[Math.min(FLOOR_TABLES.length, Math.max(1, this.regionIndex)) - 1];
  }

  // A profile lever's ROLE, resolved from the region's own population. Null
  // when the party is not in a region or the region has nothing of that shape,
  // which is what keeps the base-roster fallback honest rather than silent.
  _leverPick(behaviors) {
    if (!this.region) return null;
    const pop = REGION_ENEMIES[this.region];
    if (!pop) return null;
    const matches = pop.enemies.filter(e => behaviors.has(e.behavior));
    if (!matches.length) return null;
    return matches[Math.floor(this.waveRng.float() * matches.length)].id;
  }

  // MAP 1'S THREE ARCHETYPES, DRAWN FROM THE REGION.
  //
  // `ONBOARDING_TABLE` is the base roster's three — skulker, flit, fusehead:
  // trash, a mover, and the floor's telegraphed threat. Region 1's map 1 should
  // be three of the SAME SHAPE from the Pacific Northwest, not three creatures
  // from a dungeon the player is not in.
  //
  // Derived, not authored, so region 3 gets one by existing: THE REGION'S THREE
  // LIGHTEST ARCHETYPES.
  //
  // This read "the region's chaff" — every unit that does not telegraph — which
  // was the same predicate as "the light ones" only while telegraphing implied
  // slab HP. Once region 1 gained two 7 HP telegraphers the two stopped
  // agreeing, and the chaff reading broke twice over: it returned only two ids
  // (so map 1 fell back to the base roster's dungeon creatures in a cedar
  // forest), and it excluded the very units map 1 exists to teach.
  //
  // Lightness is what the trio was ever about. `skulker`, `flit`, `fusehead`
  // are floor 1's three lightest at 8/4/6 HP — the tutorial's composition is
  // "three things that die", not "three things you cannot read". The Pacific
  // Northwest's three are thornhound (6, a mover), sapling (7, a light
  // telegrapher) and cedar warden (7, another) — so map 1 now contains the
  // wind-up it is supposed to teach, which the old trio did not.
  //
  // Ties broken by id so the table is stable across runs; two units at 7 HP
  // must not reorder because a sort was unspecified.
  _onboardingTable() {
    const pop = this.region && REGION_ENEMIES[this.region];
    if (!pop || pop.enemies.length < ONBOARDING_TABLE.length) return ONBOARDING_TABLE;
    return [...pop.enemies]
      .sort((a, b) => a.hp - b.hp || (a.id < b.id ? -1 : 1))
      .slice(0, ONBOARDING_TABLE.length)
      .map(e => e.id);
  }

  _regionPick() {
    // THE ONBOARDING TABLE IS A HARD RESTRICTION AND THE REGION PICK BYPASSED
    // IT. `_spawnTable` returned the three-archetype table correctly and
    // `id = regionPop || table[…]` then threw it away, because the region pick
    // is evaluated first and always wins. Measured: region 1's map 1 — the
    // tutorial, built to field three archetypes at half density — fielded all
    // SIX, Bark Hulk and Cedar Warden included, and killed a Bastion camper
    // that survives the base roster indefinitely.
    //
    // This is the third lever to name enemies past the table (`js/arenas.js`
    // names the other two) and the largest: the other two inject one archetype,
    // this one replaced the whole table.
    if (this._onboarding()) return null;
    if (!this.region) return null;
    const pop = nodePopulation(this.region, this.nodeType || 'horde');
    if (!pop || !pop.length) return null;
    const total = pop.reduce((a, x) => a + x.w, 0);
    let roll = this.waveRng.float() * total;
    for (const x of pop) { roll -= x.w; if (roll <= 0) return x.def.id; }
    return pop[pop.length - 1].def.id;
  }

  // The combined multipliers for the room being fought: node type first, then
  // the party's difficulty. Difficulty does NOT touch XP — see worldmap.js.
  regionFightMods() {
    const region = REGION_BY_INDEX[this.regionIndex] || null;
    const n = nodeModifiers(this.nodeType || 'horde', region);
    const d = difficultyOf(this.difficulty);
    return {
      count: n.count * d.density,
      hp: n.hp * d.hp,
      dmg: n.dmg * d.dmg,
      gold: n.gold * d.gold,
      cursed: n.cursed,
      depth: depthMult(this.regionColumn || 1),
    };
  }

  // CAN THIS PLAYER STOCK A WEAPON AT ALL? Derived from the player, never from
  // a parallel flag. patch-trigger-core sets weaponSlots to 0 for everybody, so
  // this is false for the whole roster today — and a shop offering a card that
  // nobody can buy is a bug, not a design question. Reading the real number
  // rather than a WEAPONS_REMOVED constant means the shop is automatically
  // right again the day anything grants a slot back, with no second place to
  // remember to update.
  //
  // Every weapon branch below consults this. Trait shops built entirely around
  // weapons — the Quartermaster's all-weapon rack, the Overseer's summon rack,
  // the Gilded One's top-tier shelf — fall through to items from the same pool.
  // No new item category: the stat/modifier split is phase 4 and is not being
  // pulled forward to paper over this.
  _stocksWeapons(p) { return p.weaponSlots > 0; }

  // force: 'weapon' | 'rareplus' — used by the stock guarantees
  _rollStockEntry(p, rng, force = null) {
    const t = p.char.trait;
    const floorScale = 1 + CONFIG.PRICE_REGION_SCALE * (this.regionIndex - 1);
    let discount = 1 - p.hookAgg.shopDiscount / 100;
    if (t.key === 'insider') discount *= 1 - t.discount / 100;
    // Quartermaster buys only weapons; Gilded One stocks only the finest
    // goods (legendary items, or weapons at the floor's top tier); the
    // Overseer's weapon rolls come from the summon rack (turrets/drones)
    const weaponChance = t.key === 'overseer' ? 0.5 : CONFIG.SHOP_WEAPON_CHANCE;
    const wantWeapon = !this._stocksWeapons(p) ? false
      : force === 'weapon' ? true
      : force === 'rareplus' ? false
      : t.key === 'arsenal_doctrine' ? true
      : rng.chance(weaponChance);
    if (wantWeapon) {
      const pool = t.key === 'overseer' ? WEAPONS.filter(wd => wd.cls === 'summon') : WEAPONS;
      const def = rng.pick(pool);
      const tier = t.key === 'legendary_shop' ? this._topTier() : this._rollTier(rng);
      const price = Math.round(def.price * TIER_PRICE_MULT[tier - 1] * floorScale * discount);
      return { kind: 'weapon', id: def.id, tier, price: Math.max(1, price), sold: false, locked: false };
    }
    let rarity = t.key === 'legendary_shop' ? 'legendary' : this._rollRarity(rng, p.stats.greed);
    if (force === 'rareplus' && rarity !== 'rare' && rarity !== 'legendary') rarity = 'rare';
    const pool = ITEMS.filter(it => it.rarity === rarity);
    const it = this._pickWeighted(rng, pool);
    const price = Math.max(1, Math.round(it.price * floorScale * discount));
    return { kind: 'item', id: it.id, price, sold: false, locked: false };
  }

  // §9.2 LATE-GAME WEIGHTING, AND THE COUPLING IT COSTS.
  //
  // The weighting lives on the ITEM: `lateWeight` is 0 for "as likely in region
  // 1 as region 8" and 1 for "strongly a late find". The shop does not know
  // which items belong to which region and holds no region table — it passes
  // ONE normalised scalar it already has, and the item's own data decides.
  //
  // That one number is the whole coupling, and it is worth naming rather than
  // pretending it is zero: weighting is a function of the item AND the position
  // in the run, so something has to know the position. The choice is whether
  // the shop knows *region semantics* — which items appear where, a table that
  // grows with every region and every item — or a single progress float. It is
  // the float. Adding region 5 changes no shop code.
  _runProgress() {
    // POSITION IN THE RUN, and the run is eight regions. It used to be
    // `(region + (floorNum-1)/FLOORS) / 8` with `region` permanently 0, so it
    // returned 0.000 to 0.094 across an entire game and the eighteen items
    // carrying `lateWeight` were effectively unreachable. Region 1 now reads
    // 0.125 and region 8 reads 1.000.
    return Math.min(1, Math.max(0, this.regionIndex / TOTAL_REGIONS));
  }

  _pickWeighted(rng, pool) {
    const prog = this._runProgress();
    let total = 0;
    const w = pool.map(it => {
      const lw = it.lateWeight || 0;
      const v = 1 + lw * prog * CONFIG.LATE_WEIGHT_MAX;
      total += v;
      return v;
    });
    let roll = rng.float() * total;
    for (let i = 0; i < pool.length; i++) { roll -= w[i]; if (roll <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  _rollTier(rng) {
    const T = TIER_WEIGHTS[Math.min(TIER_WEIGHTS.length, Math.max(1, this.regionIndex)) - 1];
    const roll = rng.float() * 100;
    let acc = 0;
    for (let i = 0; i < 4; i++) { acc += T[i]; if (roll < acc) return i + 1; }
    return 1;
  }

  // the highest tier the current floor can roll at all (Gilded One's shelf)
  _topTier() {
    const T = TIER_WEIGHTS[Math.min(TIER_WEIGHTS.length, Math.max(1, this.regionIndex)) - 1];
    for (let i = 3; i >= 0; i--) if (T[i] > 0) return i + 1;
    return 1;
  }

  // §9.3 RESPEC. 1000 gold base, ×2.5 per use, NEVER RESETTING — not per floor,
  // not per region, not per run-restart of the same character. The cost is the
  // whole mechanic: one correction mid-run is affordable, a habit of rebuilding
  // at every region is not.
  _respecCost(p) {
    return Math.round(CONFIG.RESPEC_BASE * Math.pow(CONFIG.RESPEC_GROWTH, p.respecs || 0));
  }

  // ALL POINTS AT ONCE. Per-point respec would let a player micro-optimise
  // between every map, which is the opposite of committing to a build.
  _respec(p) {
    const cost = this._respecCost(p);
    if (p.materials < cost) return { ok: false, reason: 'not enough gold' };
    const spent = Object.values(p.skillRanks || {}).reduce((a, b) => a + b, 0);
    if (spent <= 0) return { ok: false, reason: 'nothing to refund' };
    p.materials -= cost;
    p.respecs = (p.respecs || 0) + 1;
    p.skillPoints += spent;
    p.skillRanks = {};
    p.loadout = new Array(8).fill(null);
    this._recomputeStats(p);
    this.pushEvent({ k: 'toast', idx: p.idx, text: `Respec — ${spent} points refunded. Next costs ${this._respecCost(p)}` });
    p.metaDirty = true;
    return { ok: true, refunded: spent };
  }

  _rerollCost(p) {
    const base = CONFIG.REROLL_BASE + CONFIG.REROLL_PER_REGION * (this.regionIndex - 1);
    if (p.shop.freeLeft > 0) return 0;
    let cost = p.rerollFlat ? base : Math.round(base * Math.pow(CONFIG.REROLL_GROWTH, p.shop.rerolls));
    if (p.shop.black) cost = Math.round(cost * 0.75); // Black Market: rerolls −25%
    return cost;
  }

  _sendShop(p) {
    if (!p.shop) return;
    this.pushEvent({
      k: 'shop', idx: p.idx,
      stock: p.shop.stock.map(s => ({ kind: s.kind, id: s.id, tier: s.tier, price: s.price, sold: s.sold, locked: s.locked })),
      rerollCost: this._rerollCost(p),
      respecCost: this._respecCost(p),
      // Per-slot: is buying this an UPGRADE of something owned, and what does
      // that cost? Surfaced so the shop UI can say so before the money moves.
      upgrades: p.shop.stock.map(s2 => (s2.kind === 'item' && this._itemUpgradable(p, s2.id))
        ? { lvl: (p.itemState[s2.id] || {}).lvl || 1, price: Math.round(s2.price * CONFIG.ITEM_UPGRADE_PRICE_MULT) } : null),
      weaponsOnly: p.char.trait.key === 'arsenal_doctrine',
      black: !!p.shop.black,
      region: this.regionIndex, // sell values shown in the UI derive from this
    });
  }

  // Combining is always an explicit player action in the arsenal UI — buying a
  // duplicate simply adds a second copy (holding pairs vs. merging for a free
  // slot is a real decision).
  // invested: materials actually paid (Quartermaster's sell lineage). Starting
  // gear counts its base price as invested.
  _addWeapon(p, id, tier, invested) {
    if (p.weapons.length >= p.weaponSlots) return false;
    const uid = ++this.spawnCounter;
    const def = WEAPON_BY_ID[id];
    p.weapons.push({
      id, tier, cd: 0.3, uid,
      invested: invested !== undefined ? invested : Math.round(weaponBasePrice(def, tier)),
    });
    if (def.cls === 'summon') this._spawnSummon(p, id, tier, null, uid);
    if (p.char.trait.key === 'arsenal_doctrine') this._recomputeStats(p);
    p.metaDirty = true;
    return true;
  }

  // merge two identical same-tier weapons into one of the next tier (free);
  // invested materials carry through the combine
  _combineWeapons(p, a, b, id, tier) {
    const wa = p.weapons[a], wb = p.weapons[b];
    if (a === b || !wa || !wb) return 'invalid pair';
    if (wa.id !== id || wb.id !== id || wa.tier !== tier || wb.tier !== tier) return 'stale selection';
    if (tier >= 4) return 'already tier IV';
    p.weapons.splice(b, 1);
    wa.tier++;
    wa.invested = (wa.invested || 0) + (wb.invested || 0);
    this._removeSummonByUid(p, wb.uid);
    this._refreshSummonsFor(p, id);
    if (p.char.trait.key === 'arsenal_doctrine') this._recomputeStats(p);
    p.metaDirty = true;
    this.pushEvent({ k: 'toast', idx: p.idx, text: `Combined into ${WEAPON_BY_ID[id].name} ${['I', 'II', 'III', 'IV'][wa.tier - 1]}!` });
    return null;
  }

  _sellWeapon(p, slot, id, tier) {
    const w = p.weapons[slot];
    if (!w || w.id !== id || w.tier !== tier) return 'stale selection';
    // Quartermaster recovers exactly what went in; everyone else gets 30%
    const refund = p.char.trait.key === 'arsenal_doctrine'
      ? (w.invested || 0)
      : sellValue(weaponBasePrice(WEAPON_BY_ID[id], tier), this.regionIndex);
    p.weapons.splice(slot, 1);
    this._removeSummonByUid(p, w.uid);
    p.materials += refund;
    if (p.char.trait.key === 'arsenal_doctrine') this._recomputeStats(p);
    p.metaDirty = true;
    this.pushEvent({ k: 'toast', idx: p.idx, text: `Sold ${WEAPON_BY_ID[id].name} for ${refund}` });
    return null;
  }

  _sellItem(p, id) {
    const i = p.items.indexOf(id);
    const item = ITEM_BY_ID[id];
    if (i < 0 || !item) return 'not owned';
    const refund = sellValue(item.price, this.regionIndex);
    p.items.splice(i, 1); // one instance; stacks sell one at a time
    this._recomputeItems(p);   // hookAgg rebuilt — sold mechanical effects can never fire again
    this._recomputeStats(p);
    p.materials += refund;
    p.metaDirty = true;
    this.pushEvent({ k: 'toast', idx: p.idx, text: `Sold ${item.name} for ${refund}` });
    return null;
  }

  _removeSummonByUid(p, uid) {
    if (uid === undefined) return;
    const i = this.summons.findIndex(s => s.owner === p.idx && s.weaponUid === uid);
    if (i >= 0) this.summons.splice(i, 1);
  }

  // ---------------- summons ----------------

  _spawnSummon(p, weaponId, tier, forceType, weaponUid) {
    const def = weaponId ? WEAPON_BY_ID[weaponId] : null;
    const sd = def ? def.summon : { hp: 25, dmg: 0, cd: 1, range: 0 };
    this.summons.push({
      owner: p.idx, weaponId, weaponUid, tier, deployT: 0, type: forceType || (sd.type || 'turret'),
      x: p.x + (this.rng.float() * 60 - 30), y: p.y + (this.rng.float() * 60 - 30),
      hp: 1, maxHp: 1, cd: 0, orbitA: this.rng.float() * 6.28, dead: false, aimA: 0,
    });
    const s = this.summons[this.summons.length - 1];
    if (s.type === 'beast') initBeast(this, s);
    this._refreshSummonsFor(p, weaponId);
  }

  // Summon damage/HP scale with Ingenuity ×(1 + 0.1×I). The Overseer's turrets
  // additionally inherit the pilot's stats: Ferocity on damage, Tempo on rate,
  // Reach on range (Attunement already rides along on their burns). The weapon
  // scaling-tag bonus is NOT applied to summon damage — Ingenuity's 10%/point
  // already covers it and would double-dip.
  _summonStats(s) {
    const p = this.players[s.owner];
    const def = s.weaponId ? WEAPON_BY_ID[s.weaponId] : null;
    const t = p.char.trait;
    const ing = 1 + Math.max(-8, p.stats.ingenuity) * ING_SCALE;
    const dmgBoost = 1 + p.hookAgg.summonDmg / 100;
    const hpBoost = 1 + p.hookAgg.summonHp / 100;
    if (s.type === 'mirror') {
      const w0 = p.weapons[0];
      const wdef = w0 ? WEAPON_BY_ID[w0.id] : null;
      return {
        def: wdef, dmg: wdef ? wdef.dmg * TIER_MULT[w0.tier - 1] * t.factor * ing * dmgBoost : 0,
        cd: wdef ? Math.max(0.3, wdef.cd) : 1, range: wdef ? wdef.range + 120 : 0,
        hp: 35 * ing * hpBoost,
        projSpeed: wdef && wdef.projSpeed || 650, knock: 10,
      };
    }
    const sd = def.summon;
    let dmg = sd.dmg * TIER_MULT[s.tier - 1] * ing * dmgBoost;
    let cd = sd.cd;
    let range = sd.range;
    // THE HUNTER'S BEAST IS STATTED BY THE HUNTER, not by a shop weapon. It is
    // spawned as `guard_drone` because that gave it a body cheaply, and it kept
    // the drone's numbers with it — 6 damage on a 0.55s cycle, the fastest bite
    // in the game, written for an item somebody buys once and never for a unit
    // the class is given free on every floor up to four times. Measured, the
    // free beast alone was 16.2 DPS — 55% of the anchor class's ENTIRE output,
    // from one body, at floor 1, and the trees were being asked to pay for it.
    // §13 rule 35: a cast rate is a damage number, and this one had no author.
    if (s.type === 'beast' && t.beastDmg !== undefined) {
      dmg = t.beastDmg * TIER_MULT[s.tier - 1] * ing * dmgBoost;
      cd = t.beastCd;
    }
    if (t.key === 'overseer') {
      dmg *= 1 + p.stats.ferocity / 100;
      cd /= Math.max(0.25, 1 + p.stats.tempo / 100);
      range += Math.max(0, p.stats.reach);
    }
    if (t.key === 'structures_fast') cd /= t.rate;
    const hp = sd.hp * TIER_MULT[s.tier - 1] * ing * hpBoost;
    return { def, dmg, cd: Math.max(0.15, cd), range, hp, projSpeed: sd.projSpeed || 650, knock: sd.knock || 0, burn: sd.burn, orbit: sd.orbit, speed: sd.speed };
  }

  _refreshSummonsFor(p, weaponId) {
    for (const s of this.summons) {
      if (s.owner !== p.idx) continue;
      if (weaponId && s.weaponId === weaponId) {
        // prefer the exact owning weapon instance (uid); trait summons have none
        const w = (s.weaponUid !== undefined && p.weapons.find(w2 => w2.uid === s.weaponUid))
          || p.weapons.find(w2 => w2.id === weaponId);
        if (w) s.tier = w.tier;
      }
      const st = this._summonStats(s);
      s.maxHp = Math.max(1, Math.round(st.hp));
      // A knocked-down beast keeps hp 0 until its timer revives it — buying a
      // weapon must not quietly heal a body on the floor.
      s.hp = s.down ? 0 : s.maxHp;
    }
  }

  _tickSummons(dt) {
    for (const s of this.summons) {
      if (s.dead) continue;
      const p = this.players[s.owner];
      if (!p || p.gone) { s.dead = true; continue; }
      const st = this._summonStats(s);
      if (!st.def && s.type === 'mirror') continue;
      if (s.maxHp <= 1 && st.hp > 1) { s.maxHp = Math.round(st.hp); s.hp = s.maxHp; }
      // carried turret (Overseer): rides on the carrier's shoulder, inert
      if (s.carried) {
        s.x = p.x; s.y = p.y - 26;
        continue;
      }
      // just recalled: packed up and bolting itself back down (inert, ~0.5s)
      if (s.deployT > 0) { s.deployT -= dt; continue; }
      // the Hunter's beast owns its whole tick: contact damage in, then the
      // state machine (movement, leash, bite) in entities/beast.js
      if (s.type === 'beast') {
        if (beastUp(s)) {
          for (const e of this.enemyPool) {
            if ((e.summonCd || 0) > 0) continue;
            if (dist2(e.x, e.y, s.x, s.y) < (e.radius + BEAST.RADIUS) * (e.radius + BEAST.RADIUS)) {
              e.summonCd = 1;
              hurtBeast(this, s, e.dmg);
              if (!beastUp(s)) break;
            }
          }
        }
        updateBeast(this, s, st, dt);
        continue;
      }
      // structures obey the room bounds too — nothing lives outside the map
      s.x = clamp(s.x, WALL + 12, this.W - WALL - 12);
      s.y = clamp(s.y, WALL + 12, this.H - WALL - 12);
      // positioning
      if (s.type === 'drone' || s.type === 'mirror') {
        s.orbitA += dt * 1.6;
        const R = st.orbit || 70;
        const tx = p.x + Math.cos(s.orbitA) * R, ty = p.y + Math.sin(s.orbitA) * R;
        s.x += (tx - s.x) * Math.min(1, dt * 8);
        s.y += (ty - s.y) * Math.min(1, dt * 8);
      } else if (s.type === 'ram') {
        const target = this._nearestVisibleEnemy(s.x, s.y, st.range + 100); // turrets/summons are LoS-aware too
        if (target) {
          const a = angleTo(s.x, s.y, target.x, target.y);
          s.x += Math.cos(a) * (st.speed || 300) * dt;
          s.y += Math.sin(a) * (st.speed || 300) * dt;
        } else {
          const a = angleTo(s.x, s.y, p.x, p.y);
          if (dist2(s.x, s.y, p.x, p.y) > 90 * 90) { s.x += Math.cos(a) * 260 * dt; s.y += Math.sin(a) * 260 * dt; }
        }
        s.x = clamp(s.x, WALL + 12, this.W - WALL - 12);
        s.y = clamp(s.y, WALL + 12, this.H - WALL - 12);
      }
      // contact damage from enemies to structures
      for (const e of this.enemyPool) {
        if ((e.summonCd || 0) > 0) continue;
        if (dist2(e.x, e.y, s.x, s.y) < (e.radius + 14) * (e.radius + 14)) {
          e.summonCd = 1;
          s.hp -= e.dmg;
          if (s.hp <= 0) { s.dead = true; this.fx.deaths.push({ x: s.x, y: s.y, c: '#9aa0bd', r: 12 }); break; }
        }
      }
      if (s.dead) continue;
      // attack
      s.cd -= dt;
      if (s.cd > 0) continue;
      if (s.type === 'ram') {
        const seen = new Set();
        let hit = false;
        this.grid.query(s.x, s.y, 40, e => {
          if (hit || !e.active || seen.has(e.id)) return;
          seen.add(e.id);
          if (dist2(s.x, s.y, e.x, e.y) < (e.radius + 16) * (e.radius + 16)) {
            this.damageEnemy(e, Math.round(st.dmg), { owner: p });
            hit = true;
          }
        });
        if (hit) s.cd = st.cd;
        continue;
      }
      const target = this._nearestVisibleEnemy(s.x, s.y, st.range); // turrets/summons are LoS-aware too
      if (!target) { s.cd = 0.1; continue; }
      s.cd = st.cd;
      const a = angleTo(s.x, s.y, target.x, target.y);
      s.aimA = a;
      const pr = this.projPool.alloc();
      if (pr) {
        Object.assign(pr, {
          id: ++this.spawnCounter, x: s.x, y: s.y,
          vx: Math.cos(a) * st.projSpeed, vy: Math.sin(a) * st.projSpeed,
          dmg: Math.max(1, Math.round(st.dmg)), crit: false, friendly: true, lob: false,
          ttl: (st.range + 80) / st.projSpeed, radius: 4,
          color: st.def ? st.def.color : '#4fd8eb', owner: p.idx, pierce: 0, hitIds: new Set(),
          weaponId: s.weaponId || (st.def ? st.def.id : null), kind: 'shot',
          summonBurn: st.burn || null, summonKnock: st.knock || 0, fromSummon: true,
        });
      }
    }
    // decay enemy vs summon cds
    for (const e of this.enemyPool) if (e.summonCd > 0) e.summonCd -= dt;
  }

  // ---------------- UI actions (from local player or clients) ----------------

  uiAction(idx, msg) {
    const p = this.players[idx];
    if (!p || p.gone || this.over) return;
    // slots arrive over the network — accept only small non-negative integers
    if ('slot' in msg && (!Number.isInteger(msg.slot) || msg.slot < 0 || msg.slot > 15)) return;
    switch (msg.kind) {
      // ---- trigger-core: spend a point, change a slot ----
      case 'learnSkill': {
        SK.spendSkillPoint(this, p, msg.id);
        break;
      }
      case 'setSlot': {
        const r = SK.setLoadout(this, p, msg.slot | 0, msg.id || null);
        if (!r.ok) this.pushEvent({ k: 'slotResult', idx, ok: false, reason: r.reason });
        else this.pushEvent({ k: 'slotResult', idx, ok: true, loadout: [...p.loadout] });
        break;
      }
      case 'shrine': {
        this._takeShrine(p, msg.id);
        break;
      }
      case 'levelup': {
        if (!p.pendingOffer) return;
        const pick = p.pendingOffer.find(o => o.id === msg.id) || p.pendingOffer[0];
        p.boosts[pick.stat] = (p.boosts[pick.stat] || 0) + pick.amount;
        p.banked--;
        p.pendingOffer = null;
        this._recomputeStats(p);
        this.pushEvent({ k: 'offerDone', idx });
        this._maybeOffer(p);
        break;
      }
      case 'pickNode': {
        if (!Number.isInteger(msg.nodeId) || msg.nodeId < 0 || msg.nodeId > 63) return;
        this._pickNode(idx, msg.nodeId);
        break;
      }
      case 'stance': {   // Samurai: Q on a keyboard, the stance button on touch
        tohSwapStance(this, p);
        break;
      }
      case 'reopenShop': {
        // back into a shop stop from the node map
        if (this.phase !== 'map' || this.currentNode === null) return;
        if (this.floor.nodes[this.currentNode].kind !== 'shop') return;
        this._openShop(p, `node${this.currentNode}`);
        break;
      }
      case 'opening': {
        if (!p.openingOffer) return;
        const pick = p.openingOffer.find(o => o.id === msg.id) || p.openingOffer[0];
        p.openingOffer = null;      // consumed before the spend, so a double tap is dropped
        SK.spendSkillPoint(this, p, pick.id);
        break;
      }
      // The spend step's only exit. Unlike the boon card there is nothing to
      // consume — the points are spent through `learn`, one at a time, and this
      // just says the player is done looking. A player who closes it with
      // points still unspent is making a choice, and the ◆ badge keeps saying so.
      case 'spendDone': { p.spendOffer = 0; break; }
      case 'boon': {
        if (!p.boonOffer) return;
        const pick = p.boonOffer.find(o => o.id === msg.id) || p.boonOffer[0];
        p.boonOffer = null;
        // `boonDone` is the panel's ONLY exit — nothing else closes it, and the
        // offer is already consumed above, so every later tap is dropped by the
        // guard. Any early return between here and the push is a softlock, not
        // a missing toast. Keep the branches inside the if; never around it.
        if (!tohTakeBoon(this, p, pick)) {   // Blacksmith crystal consumes its own pick
          p.boonCounts[pick.id] = (p.boonCounts[pick.id] || 0) + 1;
          if (p.boonCounts[pick.id] === 3) {
            this._applyPerm(p, { [pick.stat]: pick.amount });
            tohBoonPermanent(this, p);   // Druid: every fusion is also +1 Greed
            this.pushEvent({ k: 'toast', idx, text: `${p.char.trait.key === 'wildshape' ? 'The shape' : 'Prism'}: the ${pick.stat} boon is now PERMANENT` });
          } else {
            p.boonTemp = { [pick.stat]: pick.amount };
            if (p.boonCounts[pick.id] > 3) this.pushEvent({ k: 'toast', idx, text: 'Boon taken (already permanent — stacks this room)' });
          }
          this._recomputeStats(p);   // tohTakeBoon already recomputes on its path
        }
        this.pushEvent({ k: 'boonDone', idx });
        break;
      }
      case 'treasure': {
        if (!p.treasureOffer) return;
        if (msg.id && p.treasureOffer.picks.includes(msg.id)) {
          this._grantItem(p, msg.id);
          this.pushEvent({ k: 'toast', idx, text: `Took ${ITEM_BY_ID[msg.id].name}` });
        }
        p.treasureOffer = null;
        this.pushEvent({ k: 'treasureDone', idx });
        break;
      }
      case 'buy': {
        if (!p.shop) return;
        const s = p.shop.stock[msg.slot];
        if (!s || s.sold) return this._buyResult(p, msg.slot, false, 'gone');
        if (p.materials < s.price) return this._buyResult(p, msg.slot, false, 'poor');
        if (s.kind === 'item' && p.char.trait.key === 'arsenal_doctrine') return this._buyResult(p, msg.slot, false, 'weapons only — Arsenal Doctrine');
        if (s.kind === 'weapon' && p.char.trait.key === 'overseer' && WEAPON_BY_ID[s.id].cls !== 'summon') return this._buyResult(p, msg.slot, false, 'turret mounts only');
        if (s.kind === 'weapon') {
          if (p.weaponSlots === 0) return this._buyResult(p, msg.slot, false, 'no weapon slots');
          if (p.weapons.length >= p.weaponSlots) {
            // at max slots a matching owned copy absorbs the purchase — the
            // auto-combine (same type, same tier, below IV; first match wins)
            const mi = p.weapons.findIndex(w => w.id === s.id && w.tier === s.tier);
            if (mi < 0) return this._buyResult(p, msg.slot, false, 'weapons full — swap or combine');
            if (s.tier >= 4) return this._buyResult(p, msg.slot, false, 'your copy is tier IV — nothing higher to combine into');
            const w = p.weapons[mi];
            w.tier++;
            w.invested = (w.invested || 0) + s.price;
            this._refreshSummonsFor(p, s.id);
            if (p.char.trait.key === 'arsenal_doctrine') this._recomputeStats(p);
            this.pushEvent({ k: 'toast', idx: p.idx, text: `Combined into ${WEAPON_BY_ID[s.id].name} ${['I', 'II', 'III', 'IV'][w.tier - 1]}!` });
          } else {
            const ok = this._addWeapon(p, s.id, s.tier, s.price);
            if (!ok) return this._buyResult(p, msg.slot, false, 'weapons full — sell or combine');
          }
        }
        // §9.3: a copy of something you own is an UPGRADE, and it is priced as
        // one. Charged before the grant, because `_grantItem` is what decides
        // whether this purchase deepened an item or added one, and asking after
        // the fact would read the state the grant just changed.
        let paid = s.price;
        if (s.kind === 'item') {
          if (this._itemUpgradable(p, s.id)) {
            paid = Math.round(s.price * CONFIG.ITEM_UPGRADE_PRICE_MULT);
            if (p.materials < paid) return this._buyResult(p, msg.slot, false, 'not enough for the upgrade');
          } else if (p.items.includes(s.id)) {
            return this._buyResult(p, msg.slot, false, 'already owned at max level');
          }
          this._grantItem(p, s.id);
        }
        p.materials -= paid;
        s.sold = true;
        p.metaDirty = true;
        this.pushEvent({ k: 'sfx', s: 'buy' });
        this._buyResult(p, msg.slot, true);
        this._sendShop(p);
        break;
      }
      case 'swapBuy': {
        // one-step "make room": sell an owned weapon and buy a stock weapon as
        // a single transaction — both legs succeed or neither does
        if (!p.shop) return;
        if (!intIn(msg.slot, 8) || !intIn(msg.sell, 8)) return;
        const s = p.shop.stock[msg.slot];
        if (!s || s.sold || s.kind !== 'weapon') return this._buyResult(p, msg.slot, false, 'gone');
        const w = p.weapons[msg.sell];
        if (!w || w.id !== msg.sellId || w.tier !== msg.sellTier) return this._buyResult(p, msg.slot, false, 'stale selection');
        if (p.char.trait.key === 'overseer' && WEAPON_BY_ID[s.id].cls !== 'summon') return this._buyResult(p, msg.slot, false, 'turret mounts only');
        const refund = p.char.trait.key === 'arsenal_doctrine'
          ? (w.invested || 0)
          : sellValue(weaponBasePrice(WEAPON_BY_ID[w.id], w.tier), this.regionIndex);
        if (p.materials + refund < s.price) return this._buyResult(p, msg.slot, false, 'poor');
        // every check passed — commit both legs
        this._sellWeapon(p, msg.sell, w.id, w.tier);
        this._addWeapon(p, s.id, s.tier, s.price);
        p.materials -= s.price;
        s.sold = true;
        p.metaDirty = true;
        this.pushEvent({ k: 'sfx', s: 'buy' });
        this._buyResult(p, msg.slot, true);
        this._sendShop(p);
        break;
      }
      case 'reroll': {
        if (!p.shop) return;
        const cost = this._rerollCost(p);
        if (cost > p.materials) return;
        if (p.shop.freeLeft > 0) {
          p.shop.freeLeft--;
          // Spend the SHRINE's stock first and spend it for real. `freeLeft` is
          // rebuilt from `hookAgg.freeRerolls + shrineRerolls` at every shop, so
          // decrementing only the shop's copy would make one shrine reroll a
          // free reroll in every shop for the rest of the run.
          if (p.shrineRerolls > 0) p.shrineRerolls--;
        } else { p.materials -= cost; p.shop.rerolls++; }
        p.shop.stock = p.shop.stock.filter(s => s.locked && !s.sold);
        this._fillStock(p);
        this.pushEvent({ k: 'sfx', s: 'reroll' });
        p.metaDirty = true;
        this._sendShop(p);
        break;
      }
      case 'respec': {
        // Between rooms only, for the same reason a loadout change is: a build
        // rewritten mid-fight is a different party than the one that entered.
        if (this.phase === 'arena' && !this.cleared) return;
        this._respec(p);
        this._sendShop(p);
        break;
      }
      case 'lock': {
        if (!p.shop) return;
        const s = p.shop.stock[msg.slot];
        if (s && !s.sold) { s.locked = !s.locked; this._sendShop(p); }
        break;
      }
      case 'closeShop':
        break; // lock carryover happens when the next shop session opens
      // ---- build management (host-validated, free-form client input) ----
      case 'combine': {
        if (!intIn(msg.a, 8) || !intIn(msg.b, 8)) return;
        const err = this._combineWeapons(p, msg.a, msg.b, msg.id, msg.tier);
        this.pushEvent({ k: 'mgmtResult', idx, action: 'combine', ok: !err, reason: err || null });
        if (!err) this.pushEvent({ k: 'sfx', s: 'buy' }); else this.pushEvent({ k: 'sfx', s: 'deny' });
        break;
      }
      case 'sellWeapon': {
        if (!intIn(msg.slot, 8)) return;
        const err = this._sellWeapon(p, msg.slot, msg.id, msg.tier);
        this.pushEvent({ k: 'mgmtResult', idx, action: 'sellWeapon', ok: !err, reason: err || null });
        if (!err) this.pushEvent({ k: 'sfx', s: 'buy' }); else this.pushEvent({ k: 'sfx', s: 'deny' });
        break;
      }
      case 'sellItem': {
        if (typeof msg.id !== 'string') return;
        const err = this._sellItem(p, msg.id);
        this.pushEvent({ k: 'mgmtResult', idx, action: 'sellItem', ok: !err, reason: err || null });
        if (!err) this.pushEvent({ k: 'sfx', s: 'buy' }); else this.pushEvent({ k: 'sfx', s: 'deny' });
        break;
      }

    }
  }

  _buyResult(p, slot, ok, reason) {
    this.pushEvent({ k: 'buyResult', idx: p.idx, slot, ok, reason: reason || null });
    if (!ok) this.pushEvent({ k: 'sfx', s: 'deny' });
  }

  // ---------------- lifecycle ----------------

  removePlayer(idx) {
    const p = this.players[idx];
    if (!p || p.gone) return;
    p.gone = true;
    this.summons = this.summons.filter(s => s.owner !== idx);
    this.pushEvent({ k: 'left', idx, name: p.name });
    const alive = this.livePlayers();
    if (!alive.length) { this.over = true; return; }
    if (alive.every(q => q.downed)) this._finish(false);
  }

  _finish(win) {
    if (this.over) return;
    this.over = true;
    this.result = {
      win,
      seed: this.seed,
      region: this.regionIndex,
      regionId: this.region,
      regionName: (REGION_BY_INDEX[this.regionIndex] || {}).name || `Region ${this.regionIndex}`,
      // What the world map needs to advance a frontier and to bias the NEXT
      // region's objective draw away from what this one just dealt.
      regionCleared: !!this.regionCleared,
      objectives: (this.floor && this.floor.objectives) || [],
      players: this.players.map(p => ({
        idx: p.idx, name: p.name, charId: p.charId, color: p.color,
        damage: Math.round(p.damageDealt), kills: p.kills, level: p.level,
        mats: p.matsCollected, gone: p.gone,
        weapons: p.weapons.map(w => ({ id: w.id, tier: w.tier })),
        items: [...p.items],
      itemState: JSON.parse(JSON.stringify(p.itemState || {})),
      })),
    };
    this.pushEvent({ k: 'end', result: this.result });
    this.pushEvent({ k: 'sfx', s: win ? 'win' : 'lose' });
  }

  // ---------------- debug (DEV builds) ----------------

  debug(cmd) {
    switch (cmd) {
      case 'F1': {
        if (this.phase !== 'arena') break;
        const table = this._spawnTable(true);
        for (let i = 0; i < 50; i++) {
          const pos = { x: WALL + 40 + this.rng.float() * (this.W - 2 * WALL - 80), y: WALL + 40 + this.rng.float() * (this.H - 2 * WALL - 80) };
          if (this._inObstacle(pos.x, pos.y, 20)) continue;
          this.spawnEnemyById(table[(this.rng.float() * table.length) | 0], pos.x, pos.y, { noMats: false });
        }
        break;
      }
      case 'F2': for (const p of this.livePlayers()) this._collectMaterial(p, 200); break;
      case 'F3': {
        for (const e of [...this.enemyPool]) this._killEnemy(e, null);
        this.spawnQueue.length = 0;
        if (this.wave) this.wave.done = true;
        // objective levels don't end on an empty field — F3 means "end this
        // fight", so it satisfies the objective too (dev key + test harnesses)
        if (this.obj) this.obj.done = true;
        this._checkFightClear();
        break;
      }
      // F4 used to descend a floor. There is nowhere to descend to, so the
      // dev key now does the thing it was really for: get me to the boss.
      case 'F4': if (this.phase === 'map' && this.floor) this._travelTo(this.floor.bossId); break;
      case 'F5': this.god = !this.god; this.pushEvent({ k: 'toast', idx: 0, text: `God mode ${this.god ? 'ON' : 'OFF'}` }); break;
      // F7 — THE TELEGRAPH PIT. (F6 is the hitbox/fps overlay, client-side.) Clears the field and reseeds it with slabjaws
      // and aegimands only, ringed around the party at their commit distance.
      //
      // This exists because telegraph density in a normal room is too low to
      // judge: 3 of 12 enemy types telegraph, and a 90s four-player fight
      // produced only ~14 commits. Deciding whether hold-or-break is a live
      // decision needs the decision to come up repeatedly in a short sitting.
      // It deliberately does NOT give more enemy types a telegraph — the mix in
      // a real room is the thing being judged, and changing it to make judging
      // easier would judge something else.
      case 'F7': {
        for (const e of [...this.enemyPool]) { e.mats = 0; this.enemyPool.release(e); }
        this.spawnQueue.length = 0;
        const live = this.livePlayers();
        if (!live.length) break;
        const cx = live.reduce((a, q) => a + q.x, 0) / live.length;
        const cy = live.reduce((a, q) => a + q.y, 0) / live.length;
        const N = CONFIG.TELEGRAPH_PIT_COUNT;
        // The pit draws from a REGION population now, weighted by encounter
        // weight, rather than being all-heavies. All-heavies made every point of
        // incoming damage dodgeable, which is as unrepresentative as the base
        // roster's 21% is in the other direction — and criterion 13 was measured
        // in it. `this.pitRegion` selects which; default region 1.
        const pop = REGION_ENEMIES[this.pitRegion || 'pacific_northwest'];
        const pool = pop ? pop.enemies : null;
        const wTotal = pool ? pool.reduce((a, e) => a + e.w, 0) : 0;
        for (let i = 0; i < N; i++) {
          const a = i / N * Math.PI * 2;
          const r = CONFIG.TELEGRAPH_PIT_RING + (i % 2) * CONFIG.TELEGRAPH_PIT_STAGGER;
          // deterministic stratified pick: walk the weighted population so the
          // realised mix matches the designed weights rather than sampling it
          let id = 'slabjaw';
          if (pool) {
            let acc = 0; const target = ((i + 0.5) / N) * wTotal;
            for (const e of pool) { acc += e.w; if (target <= acc) { id = e.id; break; } }
          }
          this.spawnEnemyById(id, clamp(cx + Math.cos(a) * r, WALL + 40, this.W - WALL - 40),
            clamp(cy + Math.sin(a) * r, WALL + 40, this.H - WALL - 40), { noMats: true });
        }
        this.telStats = { committed: 0, resolved: 0, dodged: 0, interrupted: 0 };
        this.telDodgeLog.length = 0;
        this.pushEvent({ k: 'toast', idx: 0, text: `Telegraph pit: ${N} heavies, counters reset` });
        break;
      }
    }
  }

  // ---------------- snapshot for network clients ----------------

  getSnapshot() {
    const r = Math.round;
    const snap = {
      t: 'snap', tick: this.tickNum,
      mode: this.phase === 'map' ? 0 : 1,
      node: this.currentNode,
      cleared: this.cleared ? 1 : 0,
      shake: +this.shake.toFixed(1),
      // consent countdowns: node vote (map) and extraction (arena)
      vote: this.nodeVote ? { nodeId: this.nodeVote.nodeId, t: +this.nodeVote.t.toFixed(2), byIdx: this.nodeVote.byIdx } : null,
      extract: this.extract ? +this.extract.t.toFixed(2) : null,
      // the enemy counter's two states + the siege looting countdown.
      // ec is the AUTHORITATIVE alive count — with interest culling below,
      // enemies.length on the wire can be smaller than the real field
      ec: this.enemyPool.count,
      obj: serializeObjective(this),
      inc: this.phase === 'arena' && this.wave && !this.wave.done ? 1 : 0,
      loot: this.lootT !== null && this.lootT !== undefined ? +this.lootT.toFixed(2) : null,
      hatch: this.hatch ? [r(this.hatch.x), r(this.hatch.y)] : null,
      hold: this.holdCircle ? [r(this.holdCircle.x), r(this.holdCircle.y), r(this.holdCircle.r), this.holdCircle.held ? 1 : 0] : null,
      players: this.players.map(p => [p.idx, r(p.x), r(p.y), r(p.hp), p.stats.vitality, p.downed ? 1 : 0, +p.reviveP.toFixed(2), r(p.shield), p.gone ? 1 : 0, +p.aimA.toFixed(2), +this._displayMeter(p).toFixed(2), p.carrying ? 1 : 0,
        +Math.min(1, p.relocT / CONFIG.STRUCT_CHANNEL_S).toFixed(2),
        // one small int of trait state — Samurai stance, Bard/Flow stacks,
        // contracts closed, Hunter pack mode, Blacksmith infusions
        tohState(this, p)]),
      enemies: [], projs: [], pickups: [], summons: [], tele: [], zones: [],
      // SKILL-ERA SUMMONS AND SOUL TOKENS RIDE THE SNAPSHOT (§12.1: if losing
      // it breaks the game it is state). A client that missed a skeleton would
      // see enemies dying to nothing; a client that missed the tokens would see
      // a Necromancer's ON_TOKEN skills fire for no visible reason.
      //
      // Like `summons`, neither list is packed by js/netcodec.js — it spreads
      // the snapshot and repacks only enemies, projs, pickups, zones,
      // telegraphs and fx. So these are a VIEW addition, not a wire-format
      // change: no stride, no delta compression, no version handshake.
      // Field 5 is the down fraction, in the same 0..1 idiom decoys, telegraphs
      // and the Hunter's beast already use — one number carries both "it is
      // down" and "how long until it is back".
      minions: this.players.flatMap(p => (p.minions || []).map(m => [
        p.idx, m.arch, r(m.x), r(m.y),
        m.maxHp > 0 ? +Math.max(0, m.hp / m.maxHp).toFixed(2) : 0,
        m.down ? Math.max(0.01, +(m.downT / Math.max(0.01, m.downDur)).toFixed(2)) : 0,
      ])),
      tokens: this.tokens.map(tk => [r(tk.x), r(tk.y), +Math.min(1, tk.ttl / CONFIG.SOUL_TOKEN_TTL).toFixed(2)]),
      beams: this.activeBeams,
      // `phase2` rides here rather than only in the one-shot `bossPhase` event.
      // The event still fires for the ENRAGED banner and the roar; the FACT of
      // the enrage is state, and a client that missed it was fighting a boss it
      // believed was still in phase 1.
      boss: this.boss ? { name: this.boss.bossDef.name, hp: this.boss.hp, max: this.boss.maxHp, phase2: !!(this.boss.bs && this.boss.bs.phase2) } : null,

      // ---- STATE THAT USED TO TRAVEL ONLY AS A ONE-SHOT EVENT ----
      //
      // The rule: if losing it breaks the game it is state and rides the
      // snapshot; if losing it is cosmetic it is an event and may be dropped.
      // Everything in `st` failed that test as an event — a peer whose channel
      // was not open at the moment it fired lost it permanently, silently.
      //
      // Only the block for the CURRENT PHASE is carried, so the map costs
      // nothing during a fight and the arena costs nothing on the map screen.
      st: {
        map: this.phase === 'map' ? this._mapState() : null,
        arena: this._arenaState(),
        // Pending picks. A lost `boon`/`offer`/`treasure` costs a player their
        // progression; a lost `boonDone`/`offerDone`/`treasureDone` SOFTLOCKS
        // them behind a panel with no exit — that is closed defect #4, and it
        // was one dropped event away from happening again by a different route.
        // Presence here is the truth: the client opens when a pick appears and
        // closes when it goes away, instead of trusting two edges to arrive.
        pend: this.players.filter(p => !p.gone).map(p => [
          p.idx,
          p.pendingOffer ? 1 : 0,
          p.treasureOffer ? 1 : 0,
          p.boonOffer ? 1 : 0,
          // AND THE OPENING ABILITY. Shipped as an event alone, and a browser
          // run showed exactly why that is not enough: the offer is created
          // while the Sim is being constructed, so the `opening` event can be
          // flushed before a client is listening and the panel never appears.
          // That is closed defect #4's shape — a lost open — reached by a new
          // route. Presence here is the truth for this panel too.
          p.openingOffer ? 1 : 0,
          // AND THE MAP-END SPEND STEP, for the same reason as every row above
          // it: presence is the truth, so a lost close costs nothing and a lost
          // open is recovered by the next snapshot rather than being permanent.
          p.spendOffer ? 1 : 0,
        ]),
        // The run being over is the most load-bearing edge there is: a client
        // that missed `end` sits in a dead run with no results and no way out.
        over: this.over ? 1 : 0,
        // `ld`/`ldk` LIVED HERE AS A STUB and are deleted. The comment was
        // right that the loadout was on no channel; the placeholder was never
        // filled, so it was a third declared-with-no-writer field in a codebase
        // that keeps finding them. The build now rides `getMeta` instead, which
        // is the correct home: a loadout is PRIVATE to one player, the meta
        // channel is already per-player and sent when dirty, and the snapshot is
        // a 15 Hz broadcast every peer receives.
      },
      fx: this.fxBatch || this._emptyFx(),
      hazards: (this.hazards || []).map(h => h.type === 'spikes'
        ? ['s', r(h.x), r(h.y), r(h.w), r(h.h), h.state]
        : ['l', r(h.x), r(h.y), r(h.r)]),
      // trait visuals — rendered on every screen (visibility is the trait)
      auras: this._snapAuras(),
      tethers: this._snapTethers(),
      decoys: this.decoys.map(d => [r(d.x), r(d.y), +(d.t / d.dur).toFixed(2), d.owner]),
      // Thrones of Heaven world entities and per-player marks (null on classic)
      toh: tohSnapshot(this),
      tohMarks: tohMarks(this),
      spirits: this.players.filter(q => !q.gone && q.spirit)
        .map(q => [r(q.spirit.x), r(q.spirit.y), +(q.spirit.t / q.spirit.dur).toFixed(2), q.idx]),
    };
    // Loadout, interned. `ldk` is the id table for this snapshot; `ld` is one
    // row per live player of [idx, unspentPoints, ...slotIndices], with -1 for
    // an empty slot. Eight Samurai running the same opener pay for the string
    // once. Measured cost of the whole `st` block is in the README.
    {
      const keys = [], byKey = new Map();
      const intern = id => {
        if (id == null) return -1;
        let i = byKey.get(id);
        if (i === undefined) { i = keys.length; byKey.set(id, i); keys.push(id); }
        return i;
      };
      snap.st.ld = this.players.filter(p => !p.gone).map(p =>
        [p.idx, p.skillPoints || 0, ...(p.loadout || []).map(intern)]);
      snap.st.ldk = keys;
    }
    // radius is derived client-side from type + elite/mini flags — not sent.
    // Interest culling: chaff farther than SNAP_CULL_R from EVERY live player
    // is off every screen (radar and edge arrows only track elites/bosses/
    // pylons, which always ship) — skipping it is visually lossless and cuts
    // the 8-player siege-crest snapshot hard. The HUD counter reads ec above.
    const live = this.players.filter(p => !p.gone && !p.downed);
    const cullR2 = CONFIG.SNAP_CULL_R * CONFIG.SNAP_CULL_R;
    for (const e of this.enemyPool) {
      if (!e.boss && !e.elite && e.typeIdx !== -2 && live.length) {
        let seen = false;
        for (const p of live) { if (dist2(e.x, e.y, p.x, p.y) < cullR2) { seen = true; break; } }
        if (!seen) continue;
      }
      snap.enemies.push([e.id, e.boss ? -1 : e.typeIdx, r(e.x), r(e.y), +(e.hp / e.maxHp).toFixed(2), (e.elite ? 1 : 0) | (e.boss ? 2 : 0) | (e.mini ? 4 : 0) | (e.hitFlash > 0 ? 8 : 0) | (e.fusing ? 16 : 0) | (e.typeIdx === -2 ? 32 : 0)]);
    }
    for (const pr of this.projPool) {
      snap.projs.push([pr.id, r(pr.x), r(pr.y), r(pr.vx), r(pr.vy), pr.friendly ? 1 : 0, pr.radius, pr.color]);
    }
    let np = 0;
    for (const m of this.pickups) { if (np++ > 130) break; snap.pickups.push([r(m.x), r(m.y)]); }
    for (const s of this.summons) {
      // Field 7 is the beast's knockdown: 0 when it is up, otherwise the
      // FRACTION of its revive timer still to run. One number carries both the
      // state and the countdown, in the same 0..1 idiom decoys and telegraphs
      // already use, and the renderer draws the countdown from it — so nothing
      // here is sent that nothing reads.
      //
      // Summons are NOT packed by netcodec.js: it spreads the snapshot and
      // only repacks enemies, projs, pickups, zones, telegraphs and fx. So
      // widening this tuple is a VIEW change, not a wire-format change — no
      // stride, no delta compression and no version handshake is involved.
      if (!s.dead) snap.summons.push([s.owner, s.type, r(s.x), r(s.y), s.weaponId, +s.aimA.toFixed(2), s.deployT > 0 ? 1 : 0,
        s.down ? Math.max(0.01, +(s.downT / BEAST.DOWN_S).toFixed(2)) : 0]);
    }
    for (const tg of this.telegraphs) {
      if (tg.shape === 'circle') snap.tele.push(['c', r(tg.x), r(tg.y), r(tg.r), +(tg.t / tg.dur).toFixed(2), tg.spawnMark ? 1 : 0]);
      else snap.tele.push(['b', r(tg.x), r(tg.y), +tg.angle.toFixed(3), r(tg.w), r(tg.len), +(tg.t / tg.dur).toFixed(2)]);
    }
    for (const z of this.zones) snap.zones.push([r(z.x), r(z.y), r(z.r), z.color, z.hurts === 'players' ? 1 : 0]);
    for (const v of this.vortexes) snap.zones.push([r(v.x), r(v.y), r(v.coreR), '#a86ae8', 1]);
    this.fxBatch = this._emptyFx(); // snapshot consumed the batch
    return snap;
  }

  // The HUD meter each trait exposes (−1 = no meter for this character)
  _displayMeter(p) {
    const t = p.char.trait;
    const toh = tohMeter(this, p);
    if (toh >= 0) return Math.min(1, toh);
    if (t.key === 'momentum_meter') return p.meter;
    if (t.key === 'resonance') return Math.min(1, p.resonCharge / t.hits);
    if (t.key === 'overwatch') {
      const w = p.weapons[0];
      const cdMax = w ? WEAPON_BY_ID[w.id].cd / Math.max(0.25, 1 + p.stats.tempo / 100) : 0;
      return Math.min(1, (this.time - p.lastFireT) / (t.idle + cdMax));
    }
    if (t.key === 'crit_ramp') return Math.min(1, p.jesterOdds / t.max);
    if (t.key === 'nova_core') return Math.min(1, p.heat / t.heatMax); // Overheat stack
    return -1;
  }

  _snapAuras() {
    const r = Math.round;
    const out = [];
    for (const q of this.players) {
      if (q.gone || q.downed) continue;
      const qt = q.char.trait;
      if (qt.key === 'standard_high') out.push([q.idx, r(qt.radius + 0.5 * Math.max(0, q.stats.reach))]);
      for (const aura of q.hookAgg.allyAura) out.push([q.idx, r(aura.radius)]);
    }
    return out;
  }

  _snapTethers() {
    const r = Math.round;
    const out = [];
    for (const q of this.players) {
      if (q.gone || q.downed || q.char.trait.key !== 'soulbond') continue;
      const b = this._bondTarget(q);
      if (!b) continue;
      const end = b.player || b.summon;
      out.push([r(q.x), r(q.y), r(end.x), r(end.y)]);
    }
    return out;
  }

  // per-player private meta (stats, inventory) — sent when dirty
  getMeta(p) {
    p.metaDirty = false;
    return {
      t: 'meta', idx: p.idx, level: p.level, xp: r2(p.xp), xpNext: p.xpNext,
      materials: p.materials, banked: p.banked,
      weapons: p.weapons.map(w => ({ id: w.id, tier: w.tier, invested: w.invested })),
      items: [...p.items],
      itemState: JSON.parse(JSON.stringify(p.itemState || {})),
      stats: { ...p.stats }, weaponSlots: p.weaponSlots,
      // THE BUILD, for the skill screen. The meta channel is the right home for
      // it and the only one: a tree screen is opened by the PLAYER at a moment
      // the host did not choose, so unlike a boon it cannot be handed its
      // contents in the event that opens it — it has to render state that is
      // already on the client. Run-long, changes a few times a floor, sent when
      // dirty. Exactly the shape of everything else in this payload.
      skillPoints: p.skillPoints, skillRanks: { ...p.skillRanks }, loadout: [...p.loadout],
      // How many slots are OPEN and whether they may be changed right now. Both
      // are the host's answers to questions the client would otherwise have to
      // re-derive — §5.5's "never mid-fight" is enforced in `setLoadout`, and a
      // second copy of that rule in the UI is a second thing to keep in step.
      // The screen renders what it is told and the host re-checks every action.
      skillSlots: SK.slotsAtLevel(p.level),
      canSlot: !(this.phase === 'arena' && !this.cleared),
      boonCounts: ['prism', 'wildshape'].includes(p.char.trait.key) ? { ...p.boonCounts } : undefined,
      // run-long, changes a few times a floor — the meta channel, not the 15Hz snapshot
      infusions: p.char.trait.key === 'crystal_infusion' ? { ...p.infusions, detonate: p.detonate } : undefined,
    };
  }

  // sim helpers used by behaviors
  //
  // WHY A BODY APPEARED TO LOSE THE PLAYER. There is no stale target anywhere
  // in the enemy tick — `tauntTarget` is re-read every frame by every
  // behaviour, so a periodic retarget would have fixed nothing and hidden
  // this. The cause is that `walk` was a straight line and nothing else: an
  // enemy whose line to the player crossed a pillar walked into it, and
  // `_pushOut` ejected it along the SHORTEST axis out of the rect — which is
  // perpendicular to the approach and has no idea where the player is. The
  // body then slid along the face in whichever direction the geometry
  // happened to favour, which is what reads as wandering off.
  //
  // This is local avoidance, NOT pathfinding, and the distinction is load
  // bearing: there is still no graph, no route and no memory of the room. A
  // body probes a short distance along its heading, and if that is solid it
  // sweeps outward for the first heading that is not, committing to one side
  // so it does not oscillate at a corner. A concave pocket can still trap it —
  // `rushMove`'s stall detector remains the answer for that, unchanged.
  walk(e, tx, ty, spd, dt) {
    this.walkAngle(e, this._steerAround(e, tx, ty), spd, dt);
  }

  // The heading to actually use, given where the body wants to go.
  _steerAround(e, tx, ty) {
    const a = angleTo(e.x, e.y, tx, ty);
    if (!this.obstacles.length) return a;
    // WHAT ENDS THE DETOUR IS THE LINE, NOT THE NEXT STEP. Keying the reset to
    // a short forward probe was the first version and it stalled 3 of 9 runs:
    // a body sliding along a face reaches the corner, its next step reads
    // clear, it turns back toward the player, and walks straight into the same
    // wall a few units further along. Holding the detour until the whole line
    // to the target is open is what actually gets a body round a pillar.
    if (!this.losBlocked(e.x, e.y, tx, ty)) { e.slideSide = 0; return a; }
    const probe = e.radius + 34;
    const r = e.radius * 0.6;                       // the radius _pushOut uses
    const clear = ang => !this._inObstacle(e.x + Math.cos(ang) * probe, e.y + Math.sin(ang) * probe, r);
    const d = Math.hypot(tx - e.x, ty - e.y);
    // Pick a side once and keep it: the SHORTER way round, then commit.
    // Re-deciding every frame is what makes a body jitter at a corner.
    if (!e.slideSide) {
      let cw = 0, ccw = 0;
      for (let k = 1; k <= 8; k++) if (clear(a + k * 0.32)) { cw = k; break; }
      for (let k = 1; k <= 8; k++) if (clear(a - k * 0.32)) { ccw = k; break; }
      e.slideSide = (cw && (!ccw || cw <= ccw)) ? 1 : (ccw ? -1 : 1);
      e.slideT0 = this.time; e.slideD = d; e.slidePatience = SLIDE_PATIENCE;
    } else if (this.time - e.slideT0 > (e.slidePatience || SLIDE_PATIENCE)) {
      // THE CHOSEN SIDE CAN BE A DEAD END and looking one step ahead cannot
      // see that. An arena template put a 70x377 pillar flush against the top
      // wall; a Bark Hulk rounded it upward, reached the corner and stopped,
      // because every heading on that side stayed walkable and none of them
      // made progress. Committing to a side is right; committing to it
      // forever is not.
      //
      // PATIENCE GROWS ON EACH FLIP, and that is the part that makes it work
      // rather than merely move. A fixed window turned the stall into a
      // patrol: at 66 u/s a 1.6s window buys 106 units, the pillar was 377
      // tall, so the body reversed before it could clear either end and slid
      // up and down the same face for the full 40s. Doubling means the search
      // widens until it is longer than whatever is in the way.
      if (d >= e.slideD - 8) {
        e.slideSide = -e.slideSide;
        e.slidePatience = Math.min(SLIDE_PATIENCE_MAX, (e.slidePatience || SLIDE_PATIENCE) * 2);
      }
      e.slideT0 = this.time; e.slideD = d;
    }
    for (let k = 0; k <= 8; k++) { const off = k * 0.32 * e.slideSide; if (clear(a + off)) return a + off; }
    // that side is walled too — try the other before walking into it anyway
    for (let k = 1; k <= 8; k++) { const off = -k * 0.32 * e.slideSide; if (clear(a + off)) return a + off; }
    e.slideSide = 0;
    return a;
  }
  walkAngle(e, a, spd, dt) {
    const x0 = e.x, y0 = e.y;
    e.x += Math.cos(a) * spd * dt;
    e.y += Math.sin(a) * spd * dt;
    // Sundian coral: a wall the party can walk straight through and enemies
    // cannot. Deliberately NOT an obstacle — `_inObstacle` is shared by
    // players, sight and every projectile and cannot express "enemies only".
    if (this.coralWalls.length) {
      const wl = coralBlocks(this, x0, y0, e.x, e.y);
      if (wl) { e.x = x0; e.y = y0; wl.hp -= spd * dt * 0.05; }
    }
    this.clampToRoom(e);
  }
  clampToRoom(e) {
    e.x = clamp(e.x, WALL + e.radius * 0.6, this.W - WALL - e.radius * 0.6);
    e.y = clamp(e.y, WALL + e.radius * 0.6, this.H - WALL - e.radius * 0.6);
    this._pushOut(e, e.radius * 0.6);
    // A Hunter's beast is a body. Every enemy movement path in the game ends
    // in clampToRoom, so this is the one hook that no mover can slip past.
    beastBlocks(this, e);
  }
}

// ---------------- module helpers ----------------

// Co-op difficulty curve: linear per-player through the knee (4 players),
// softened beyond — a party of 8 is a warband, not a ×4.5 enemy flood.
export function coopCurve(n, scale, soft) {
  const knee = CONFIG.COOP_SOFT_AT;
  if (n <= knee) return 1 + scale * (n - 1);
  return 1 + scale * (knee - 1) + soft * (n - knee);
}

function r2(v) { return Math.round(v * 10) / 10; }

// network-supplied index guard: small non-negative integer
function intIn(v, max) { return Number.isInteger(v) && v >= 0 && v <= max; }

function angDiffLocal(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function pointToSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return dist(px, py, x1 + dx * t, y1 + dy * t);
}

