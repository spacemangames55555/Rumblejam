// Host-authoritative simulation. Runs at a fixed 60 Hz, fully separate from
// rendering. Clients only ever send inputs/UI intents; everything here is the
// single source of truth. Solo play runs this exact code with one player.

import { CONFIG, TIER_MULT, TIER_PRICE_MULT, weaponBasePrice, sellValue, STATS, STAT_BASE, STAT_IS_PCT, SCALING_RATES } from './config.js';
import { Rng, subRng } from './rng.js';
import { Pool, SpatialHash, clamp, dist, dist2, angleTo, segHitsRect, segRectEntryT } from './util.js';
import { generateFloorMap, serializeMap } from './dungeon.js';
import { buildArena, waveConfig, PROFILES } from './arenas.js';
import { CHAR_BY_ID } from './content/characters.js';
import { WEAPONS, WEAPON_BY_ID } from './content/weapons.js';
import { ITEMS, ITEM_BY_ID } from './content/items.js';
import { ENEMIES, ENEMY_BY_ID, ENEMY_INDEX, ELITE_MODS, FLOOR_TABLES } from './content/enemies.js';
import { BOSS_BY_FLOOR } from './content/bosses.js';
import { STAT_BOOSTS } from './content/statboosts.js';
import { updateEnemy } from './entities/enemies.js';

const { WALL, DT } = CONFIG;
// Alive-at-once caps. Ranged and special types are capped so long sieges can't
// pile one type into a degenerate wall (a low-DPS build vs 60 lobbers is a
// stalemate, not a fight); melee chaff stays uncapped — swarms are the point,
// and capped spawn rolls redirect into chaff.
const SPAWN_CAPS = {
  wombden: 2, aegimand: 3, stitcher: 3, deadeye: 4, slabjaw: 6,
  lobber: 22, gemmite: 18, gyre: 16, fusehead: 10, lancerfish: 14,
};
const ING_SCALE = 0.1; // +10% summon damage & HP per Ingenuity point
const VOTE_TIME = 4;   // consent countdown (node picks and extraction)
// the Siege's ward pylon — a destructible structure, not a roster enemy
const PYLON_DEF = { id: '_pylon', name: 'Ward Pylon', behavior: 'pylon', hp: 260, spd: 0, dmg: 0, radius: 26, mats: 6, shape: 'square', color: '#c05eff' };
// shop tier weights per floor (chance out of 100 for tiers I–IV)
const TIER_WEIGHTS = [[80, 20, 0, 0], [50, 35, 15, 0], [20, 45, 30, 5], [5, 35, 40, 20]];

export class Sim {
  constructor({ seed, party }) {
    this.seed = seed >>> 0;
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
    this.summons = [];
    this.telegraphs = [];
    this.zones = [];
    this.vortexes = [];
    this.activeBeams = [];
    this.fx = this._emptyFx();
    this.spawnCounter = 0;
    this.shake = 0;

    this.decoys = [];   // Mirage afterimages — taunt targets that burst on expiry

    this.players = party.map((m, i) => this._makePlayer(m, i));
    // party-wide curse (Tollkeeper's Toll Road: double mats, +25% enemy HP)
    this.greedHp = this.players.some(p => p.char.trait.key === 'toll_road') ? 1.25 : 1;
    this.greedMats = this.players.some(p => p.char.trait.key === 'toll_road') ? 2 : 1;
    this.coopHp = 1 + CONFIG.COOP_HP_SCALE * (this.players.length - 1);
    this.coopSpawn = 1 + CONFIG.COOP_SPAWN_SCALE * (this.players.length - 1);

    this.floorNum = 0;
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
    this.hatch = null;        // the extraction portal (fights) / descent (post-siege)
    this.extract = null;      // {t} — countdown while someone stands on the portal
    this.afterSiege = false;  // portal descends instead of returning to the map
    this.mutations = null; this.mutIdx = 0; this.siegeT = 0; this.bossAt = Infinity;
    this.bossSpawned = false; this.bossT = 0; this.siegeCfg = null;
    this.profile = null; this.fronts = [0, 2]; this.fightLoot = 0; this.lootT = null;
    this.holdCircle = null;   // {x,y,r,held} — spawn-choke sub-objective
    this.pylonId = null; this.enemyBuff = 1;
    this._startFloor(1);
    for (const p of this.players) this._initStartingGear(p);
  }

  _emptyFx() { return { hits: [], deaths: [], booms: [], beams: [], swings: [], blocks: [] }; }
  pushEvent(ev) { this.events.push(ev); }
  livePlayers() { return this.players.filter(p => !p.gone); }

  // ---------------- player construction & stats ----------------

  _makePlayer(member, idx) {
    const char = CHAR_BY_ID[member.charId] || CHAR_BY_ID.bulwark;
    const p = {
      idx, name: member.name || `Player ${idx + 1}`, charId: char.id, char,
      color: member.color, gone: false,
      x: 0, y: 0, radius: CONFIG.PLAYER_RADIUS * (char.trait.key === 'immovable' ? char.trait.hitbox : 1),
      mx: 0, my: 0, interact: false, moving: false, aimA: 0, stillT: 0,
      hp: 1, shield: 0, downed: false, reviveP: 0, invuln: 0, pullX: 0, pullY: 0,
      level: 1, xp: 0, xpNext: CONFIG.XP_BASE + CONFIG.XP_PER_LEVEL * 1,
      materials: 0, matsCollected: 0, banked: 0,
      weapons: [], items: [],
      boosts: {}, permStats: {}, tempStats: {},
      stats: null, hookAgg: null,
      weaponSlots: CONFIG.WEAPON_SLOT_MAX,
      reflexCap: CONFIG.DODGE_CAP, critMult: 2,
      firstHitUsed: false, nextCrit: false,
      tempoBuffT: 0, dmgBuffT: 0, dmgBuffAmt: 0,
      frenzy: [], secondWindUsed: false, blockT: 0,
      vitKillGained: 0,
      contactAuraAcc: 0, regenAcc: 0, healAcc: 0,
      damageDealt: 0, kills: 0,
      pendingOffer: null, treasureOffer: null,
      shop: null, shopLocksCarry: [], shopVisit: 0, rerollFlat: false,
      // rebalance trait state
      meter: 0,            // Onrush movement meter 0..1
      resonCharge: 0,      // Resonant hit charge
      lastFireT: -10,      // Overwatch cadence (sim time of last weapon fire)
      lastKillT: -10, roomFirstKillT: -10,
      critCounter: 0, critArmed: false, jesterOdds: 0,
      boonCounts: {}, boonOffer: null, boonTemp: null,
      roomVitGain: 0,      // Vesper per-room overheal→Vitality cap tracker
      carrying: null, channelT: 0, // Overseer turret carry/redeploy
      metaDirty: true,
    };
    const t = char.trait;
    if (t.key === 'insider') { p.weaponSlots = t.slots; p.rerollFlat = true; }
    if (t.key === 'structures_fast') p.weaponSlots = t.slotCap;
    if (t.key === 'overseer') p.weaponSlots = t.mounts;
    if (t.key === 'reflex_master') p.reflexCap = t.cap;
    if (t.key === 'executioner') p.critMult = 3;
    this._recomputeItems(p);
    this._recomputeStats(p);
    p.hp = p.stats.vitality;
    return p;
  }

  _initStartingGear(p) {
    const t = p.char.trait;
    if (t.key === 'overseer') {
      // turrets ARE weapons for the Overseer: combinable, sellable, four mounts.
      // One to start — full inheritance makes each mount count.
      this._addWeapon(p, 'bolt_turret', 1);
    } else if (p.char.weapon) {
      this._addWeapon(p, p.char.weapon, 1);
    }
    if (t.key === 'mirror_drone') this._spawnSummon(p, null, 1, 'mirror');
    if (t.key === 'free_drone_floor') this._spawnSummon(p, 'guard_drone', 1);
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
    for (const id of p.items) {
      const it = ITEM_BY_ID[id];
      if (!it || !it.hooks) continue;
      const h = it.hooks;
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
      case 'enemyNear': {
        const e = this._nearestEnemy(p.x, p.y, cond.r || 60);
        return !!e;
      }
      case 'noEnemyNear': return !this._nearestEnemy(p.x, p.y, cond.r || 150);
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
    for (const id of p.items) { const it = ITEM_BY_ID[id]; if (it && it.stats) add(it.stats); }
    add(p.boosts);
    add(p.permStats);
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

  // ---------------- floors & rooms ----------------

  _startFloor(n) {
    this.floorNum = n;
    this.floor = generateFloorMap(this.seed, n);
    this.phase = 'map';
    this.currentNode = null;
    this.visited = new Set();
    this.nodeVote = null;
    this.arenaNode = null;
    this.cleared = false;
    this.hatch = null; this.extract = null; this.afterSiege = false;
    this.boss = null;
    this.holdCircle = null; this.pylonId = null; this.enemyBuff = 1;
    for (const p of this.players) {
      if (p.gone) continue;
      // overlays close on floor transition — re-surface any unresolved offers
      if (p.pendingOffer) this.pushEvent({ k: 'offer', idx: p.idx, picks: p.pendingOffer, banked: p.banked });
      if (p.treasureOffer) this.pushEvent({ k: 'treasure', idx: p.idx, kind: p.treasureOffer.kind, picks: p.treasureOffer.picks });
      p.secondWindUsed = false;
      if (n > 1) {
        // heal half of missing HP between floors (a source — Recovery applies)
        this._heal(p, Math.ceil((p.stats.vitality - p.hp) * 0.5));
        for (const fs of p.hookAgg.floorStats) this._applyPerm(p, fs.stats);
        if (p.char.trait.key === 'free_drone_floor') this._spawnSummon(p, 'guard_drone', 1);
      }
    }
    this._mapEvent();
  }

  // ---------------- the node map (between fights) ----------------

  reachableNodes() {
    if (this.phase !== 'map') return [];
    if (this.currentNode === null) return [...this.floor.startIds];
    return [...this.floor.nodes[this.currentNode].edges];
  }

  _mapEvent() {
    this.pushEvent({
      k: 'map', layout: serializeMap(this.floor), floorNum: this.floorNum,
      current: this.currentNode, visited: [...this.visited], reachable: this.reachableNodes(),
    });
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
    if (node.kind === 'combat' || node.kind === 'elite' || node.kind === 'siege') {
      this._enterArena(node);
      return;
    }
    // full-screen stops: the map stays the home screen underneath
    if (node.kind === 'shop') {
      for (const p of this.livePlayers()) this._openShop(p, `node${nodeId}`);
    } else if (node.kind === 'treasure') {
      for (const p of this.livePlayers()) this._offerTreasure(p, 'treasure');
    }
    this._mapEvent(); // next choices open immediately behind the stop
  }

  // ---------------- arenas (the stage) ----------------

  _enterArena(node) {
    const arena = buildArena(this.seed, this.floorNum, node);
    this.phase = 'arena';
    this.arenaNode = node;
    this.W = arena.w; this.H = arena.h;
    this.obstacles = arena.obstacles;
    this.hazards = arena.hazards.map(h => ({ ...h }));
    this.cleared = false;
    this.hatch = null; this.extract = null;
    this.afterSiege = node.kind === 'siege';
    this.telegraphs.length = 0; this.zones.length = 0; this.vortexes.length = 0;
    this.activeBeams.length = 0;
    this.enemyPool.clear();
    this.projPool.clear();
    this.pickups.length = 0;
    this.spawnQueue = [];
    this.decoys.length = 0;
    this.boss = null;
    this.roomEnteredT = this.time;
    this.waveRng = subRng(this.seed, 'wave', this.floorNum, node.id);
    this.wave = waveConfig(this.floorNum, node.col, node.kind);
    // the fight's pressure profile: sieges are always high-friction; stops
    // have none; combat/elite carry the recipe rolled at map generation
    this.profile = node.kind === 'siege' ? PROFILES.siege : (PROFILES[node.profile] || PROFILES.mixed);
    // Bastion streams from ONE arena edge (0=n 1=e 2=s 3=w) — a single front
    // is a queue, and holding ground against a queue is the sanctioned play
    this.fronts = [this.waveRng.int(0, 3)];
    this.fightLoot = 0;  // materials actually picked up this fight
    this.lootT = null;   // the siege's post-boss looting countdown
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
    // covers it (cramped layouts can run walls through the exact midpoint)
    const [cx, cy] = this._clearSpot(arena.w / 2, arena.h / 2, 40);
    this.players.forEach((p, i) => {
      if (p.gone) return;
      const [sx, sy] = this._clearSpot(
        cx + (i % 2 ? -1 : 1) * (30 + 20 * Math.floor(i / 2)),
        cy + (i < 2 ? -1 : 1) * 26, p.radius + 6);
      p.x = sx; p.y = sy;
      p.firstHitUsed = false;
      p.pullX = p.pullY = 0;
      // per-FIGHT trait state (the old per-room triggers)
      p.roomVitGain = 0;        // Vesper's overheal→Vitality cap
      p.roomFirstKillT = -10;
      p.boonTemp = null;        // Facet's boon expires with the fight
      p.boonOffer = null;
      if (p.char.trait.key === 'prism' && !p.downed) this._offerBoon(p);
    });
    // teleport summons along; structures rebuild between fights
    for (const s of this.summons) {
      const owner = this.players[s.owner];
      s.x = owner.x + (Math.random() * 80 - 40); s.y = owner.y + (Math.random() * 80 - 40);
      if (s.dead) { s.dead = false; s.hp = s.maxHp; }
    }
    this.pushEvent({
      k: 'arena', nodeId: node.id, kind: node.kind, template: node.template,
      name: arena.name, w: arena.w, h: arena.h,
      obstacles: this.obstacles.map(o => [o.x, o.y, o.w, o.h]),
      hazards: this._serializeHazardDefs(),
    });
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
      * ((this.profile && this.profile.rateMult) || 1);
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
    w.acc += rate * dt;
    // elite injections (elite nodes and sieges)
    if (w.eliteEvery > 0) {
      w.eliteT -= dt;
      if (w.eliteT <= 0) {
        w.eliteT = w.eliteEvery;
        const table = FLOOR_TABLES[this.floorNum - 1];
        const id = this.waveRng.pick(table.filter(t => t !== 'wombden'));
        const pos = this._spawnWavePos();
        this.spawnQueue.push({ t: 0.7, id, elite: true, mod: this.waveRng.pick(ELITE_MODS), x: pos.x, y: pos.y });
        this.addTelegraph({ shape: 'circle', x: pos.x, y: pos.y, r: 34, dur: 0.7, spawnMark: true });
      }
    }
    let guard = 0;
    while (w.acc >= 1 && guard++ < 20) {
      w.acc -= 1;
      if (this.enemyPool.count + this.spawnQueue.length >= CONFIG.POOL_ENEMIES - 10) break; // pool headroom
      const prof = this.profile || {};
      const table = FLOOR_TABLES[this.floorNum - 1];
      let id = table[Math.floor(this.waveRng.float() * table.length)];
      let mortar = false, puddle = false;
      // profile levers shape the roll: flankers become wave citizens,
      // artillery turns Lobbers into mortars, chaff picks up death-puddles
      if (prof.flankers && this.waveRng.chance(prof.flankers)) {
        id = this.waveRng.chance(0.5) ? 'gyre' : 'lancerfish';
      } else if (prof.artillery && this.waveRng.chance(prof.artillery)) {
        id = 'lobber'; mortar = true;
      }
      if (prof.ban && prof.ban.includes(id)) { id = table[0] === id ? table[1] : table[0]; mortar = false; }
      const cap = SPAWN_CAPS[id] && Math.round(SPAWN_CAPS[id] * CONFIG.spawnBudgetMult);
      if (cap && this._aliveOfType(id) >= cap) { id = table[0] === id ? table[1] : table[0]; mortar = false; }
      if (prof.puddle && (id === 'skulker' || id === 'flit') && this.waveRng.chance(prof.puddle)) puddle = true;
      const pos = this._spawnWavePos();
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
    if (!this.wave.done || this.spawnQueue.length > 0 || this.enemyPool.count > 0) return;
    this._clearFight();
  }

  _clearFight() {
    this.cleared = true;
    // money doesn't wait: no end-of-fight vacuum — whatever wasn't collected
    // during the fight fizzles the moment the last enemy dies, and the banner
    // reports both numbers so the rule teaches itself
    const lost = this._fizzleLoot();
    this.pushEvent({ k: 'roomClear', collected: this.fightLoot, lost });
    this.pushEvent({ k: 'sfx', s: 'door' });
    for (const p of this.livePlayers()) this._clearRewards(p);
    if (this.arenaNode.kind === 'elite') {
      for (const p of this.livePlayers()) this._offerTreasure(p, 'elite');
    }
    // the valley after every peak: extraction includes a shop browse
    for (const p of this.livePlayers()) this._openShop(p, 'clear');
    // the extraction portal — leave via the same consent countdown
    this.hatch = this._openSpot(this.W / 2, this.H / 2);
  }

  _openSpot(x, y) {
    // nudge a point out of any obstacle
    for (let tries = 0; tries < 20 && this._inObstacle(x, y, 60); tries++) {
      x += (Math.random() - 0.5) * 300; y += (Math.random() - 0.5) * 300;
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
    if (this.floorNum >= CONFIG.FLOORS) { this.pendingEnd = 0.8; return; }
    this.hatch = this._openSpot(this.W / 2, this.H / 2); // descend from here
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
        if (this.afterSiege) this._startFloor(this.floorNum + 1);
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
    // boons expire with the fight
    for (const p of this.players) { p.boonTemp = null; p.boonOffer = null; }
    for (const p of this.livePlayers()) this._recomputeStats(p);
    this._mapEvent();
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
      this.pushEvent({ k: 'obstacles', obstacles: this.obstacles.map(o => [o.x, o.y, o.w, o.h]) });
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
    const hp = Math.round(PYLON_DEF.hp * Math.pow(CONFIG.FLOOR_HP_MULT, this.floorNum - 1) * this.coopHp * CONFIG.enemyHpMult);
    Object.assign(e, {
      id: ++this.spawnCounter, def: PYLON_DEF, typeIdx: -2, boss: false, bossDef: null,
      x, y, hp, maxHp: hp, radius: PYLON_DEF.radius, spd: 0, dmg: 0, dmgScale: 1,
      mats: PYLON_DEF.mats, mini: false, elite: false, eliteMod: null,
      t: 0, phase: 0, slowT: 0, slowMult: 1, burnT: 0, burnDps: 0, burnOwner: null,
      hitFlash: 0, knockX: 0, knockY: 0, contactCd: 0, fusing: false, blockT: 0,
      fireT: 0, healTarget: null, brood: null, shape: PYLON_DEF.shape, color: PYLON_DEF.color,
      hitStamps: {}, echoCd: 0, bulwarkCd: 0,
    });
    this.pylonId = e.id;
    this.enemyBuff = 1.3; // while the pylon stands, everything hits harder
    this.addTelegraph({ shape: 'circle', x, y, r: 90, dur: 1.2 });
  }

  _spawnSiegeBoss() {
    const def = BOSS_BY_FLOOR[this.floorNum];
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
      elite: false, eliteMod: null, t: 0, phase: 0, slowT: 0, slowMult: 1,
      burnT: 0, hitFlash: 0, knockX: 0, knockY: 0, contactCd: 0, shape: def.shape, color: def.color,
      hitStamps: {}, echoCd: 0, bulwarkCd: 0,
    });
    this.boss = e;
    this.addTelegraph({ shape: 'circle', x, y: this.H * 0.3, r: def.radius + 60, dur: 1.5 });
    this.pushEvent({ k: 'bossSpawn', name: def.name });
  }

  // ---------------- obstacles ----------------

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
      if (d < range * range) cands.push({ d, e });
    }
    cands.sort((a, b) => a.d - b.d);
    for (const c of cands) if (!this.losBlocked(x, y, c.e.x, c.e.y)) return c.e;
    return null;
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
    const fl = Math.pow(CONFIG.FLOOR_HP_MULT, this.floorNum - 1);
    const dmgScale = Math.pow(CONFIG.FLOOR_DMG_MULT, this.floorNum - 1) * (opts.elite ? CONFIG.ELITE_DMG_MULT : 1);
    let hp = def.hp * fl * this.coopHp * this.greedHp * CONFIG.enemyHpMult * (opts.elite ? CONFIG.ELITE_HP_MULT : 1);
    if (opts.mini) hp *= 0.35;
    Object.assign(e, {
      id: ++this.spawnCounter, def, typeIdx: ENEMY_INDEX[id], boss: false, bossDef: null,
      x: clamp(x, WALL + 20, this.W - WALL - 20), y: clamp(y, WALL + 20, this.H - WALL - 20),
      hp: Math.round(hp), maxHp: Math.round(hp),
      radius: def.radius * (opts.elite ? 1.45 : 1) * (opts.mini ? 0.6 : 1),
      spd: def.spd * (opts.elite ? 1.1 : 1) * (opts.mini ? 1.25 : 1),
      dmg: def.dmg * dmgScale, dmgScale,
      mats: opts.noMats ? 0 : def.mats, mini: !!opts.mini,
      elite: !!opts.elite, eliteMod: opts.elite ? (opts.mod || ELITE_MODS[0]) : null,
      t: Math.random(), phase: 0, slowT: 0, slowMult: 1, burnT: 0, burnDps: 0, burnOwner: null,
      hitFlash: 0, knockX: 0, knockY: 0, contactCd: 0, fusing: false, blockT: 0,
      fireT: 0.8 + Math.random(), healTarget: null, brood: null, shape: def.shape, color: def.color,
      hitStamps: {}, echoCd: 0, bulwarkCd: 0,
      // pressure-profile variants (patch 9)
      mortar: !!opts.mortar,   // Lobber artillery: telegraphed shells on your position
      puddle: !!opts.puddle,   // chaff that leaves an acid puddle on death
      rushSet: false, rushX: 0, rushY: 0, // wave-end rush overshoot target
    });
    return e;
  }

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
    // telegraphs / zones / vortexes
    this._tickAreas(dt);
    // contact damage + hazards
    this._tickContact(dt);
    this._tickHazards(dt);
    // pickups
    this._tickPickups(dt);
    // Mirage decoys (taunt, then burst)
    this._tickDecoys(dt);
    // revives
    this._tickRevive(dt);
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
    const t = p.char.trait;
    let spd = CONFIG.BASE_SPEED * (1 + p.stats.tempo / 100);
    spd = Math.max(60, spd);
    const pullResist = t.key === 'immovable' ? 0 : CONFIG.ARMOR_K / (CONFIG.ARMOR_K + Math.max(0, p.stats.grit));
    p.x += (p.mx * spd + p.pullX * pullResist) * dt;
    p.y += (p.my * spd + p.pullY * pullResist) * dt;
    p.pullX = p.pullY = 0;
    p.x = clamp(p.x, WALL + p.radius, this.W - WALL - p.radius);
    p.y = clamp(p.y, WALL + p.radius, this.H - WALL - p.radius);
    this._pushOut(p, p.radius);

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

    // weapons
    this._tickWeapons(p, dt);

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

  // All healing funnels through here. Recovery amplifies every source; the
  // fractional remainder accumulates so small heals aren't lost. Overheal is
  // routed by trait (shield / permanent Vitality / ally drip / self-shield).
  _heal(p, amount, opts = {}) {
    if (p.downed || amount <= 0 || p.gone) return;
    const t = p.char.trait;
    let amt = amount * (1 + Math.max(-80, p.stats.recovery) / 100);
    p.healAcc += amt;
    amt = Math.floor(p.healAcc);
    p.healAcc -= amt;
    if (amt <= 0) return;
    const before = p.hp;
    p.hp = Math.min(p.stats.vitality, p.hp + amt);
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
        if (ally) this._heal(ally, overflow, { noDrip: true, noShare: true });
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
      if (b && b.player === p) this._heal(q, amt * q.char.trait.healShare, { noShare: true });
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

  // Weapon damage: base × tier × (1 + Ferocity/100) × (1 + scaling-tag bonus/100).
  // Percent scaling tags contribute their value; flat tags convert via SCALING_RATES.
  _scalingBonus(p, def) {
    let bonus = 0;
    for (const key of def.scaling) {
      bonus += STAT_IS_PCT[key] ? p.stats[key] : p.stats[key] * (SCALING_RATES[key] || 1);
    }
    return Math.max(-60, bonus);
  }

  _fireWeapon(p, w, widx, opts = {}) {
    const def = WEAPON_BY_ID[w.id];
    const range = this._weaponRange(p, def);
    // lobbed weapons arc over walls — that's their identity; everything else
    // targets the nearest VISIBLE enemy
    const target = opts.target || (def.cls === 'lobbed'
      ? this._nearestEnemy(p.x, p.y, range)
      : this._nearestVisibleEnemy(p.x, p.y, range));
    if (!target) return;
    const a = angleTo(p.x, p.y, target.x, target.y);
    p.aimA = a;
    const t = p.char.trait;
    const agg = p.hookAgg;

    // damage: base × tier × (1 + Ferocity/100) × (1 + scaling-tag bonus/100)
    let dmg = def.dmg * TIER_MULT[w.tier - 1];
    let mult = (1 + p.stats.ferocity / 100) * (1 + this._scalingBonus(p, def) / 100);
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
    if ((agg.critVsFullHp || t.key === 'executioner') && target.hp >= target.maxHp) crit = true;
    // Jester: trait-internal odds that ramp per attack and reset when a crit lands
    if (t.key === 'crit_ramp') {
      if (!crit && Math.random() * 100 < p.jesterOdds) crit = true;
      p.jesterOdds = crit ? 0 : Math.min(t.max, p.jesterOdds + t.per);
    }
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
    if (t.key === 'chain_attacks' && Math.random() < t.chance) {
      this._chainLightning(e, ctx, { count: 1, range: t.range, factor: t.factor });
    }
    // item payloads
    for (const b of p.hookAgg.burnOnHit) if (Math.random() < b.chance) this._applyBurn(e, this._attuned(p, b.dps), b.duration, p);
    for (const s of p.hookAgg.chillOnHit) if (Math.random() < s.chance) this._applySlow(e, s.mult, s.duration, p);
    for (const c of p.hookAgg.chainOnHit) if (Math.random() < c.chance) {
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

  _nearestEnemy(x, y, range) {
    let best = null, bd = range * range;
    for (const e of this.enemyPool) {
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
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
    return best || this.nearestLivingPlayer(x, y);
  }

  // ---------------- damage plumbing ----------------

  damageEnemy(e, amount, opts = {}) {
    if (!e.active) return;
    // warden allies shield: 50% reduction if a living warden is nearby (not self)
    if (!e.boss && e.def.behavior !== 'warden') {
      for (const w of this.enemyPool) {
        if (w.boss || w.def.behavior !== 'warden' || w === e) continue;
        if (dist2(w.x, w.y, e.x, e.y) < w.def.shieldR * w.def.shieldR) { amount = Math.max(1, Math.round(amount * (1 - w.def.shieldReduce))); break; }
      }
    }
    // shielded elite: eats one hit periodically
    if (e.eliteMod && e.eliteMod.blockCd && !opts.noEffects) {
      if ((e.blockT || 0) <= 0) { e.blockT = e.eliteMod.blockCd; this.fx.blocks.push({ x: e.x, y: e.y }); return; }
    }
    amount = Math.max(1, Math.round(amount));
    e.hp -= amount;
    e.hitFlash = 0.1;
    if (!opts.silent) this.fx.hits.push({ x: Math.round(e.x), y: Math.round(e.y - e.radius), a: amount, c: opts.crit ? 1 : 0 });
    const p = opts.owner;
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
    const { x, y } = e;
    this.fx.deaths.push({ x: Math.round(x), y: Math.round(y), c: e.boss ? e.bossDef.color : e.def.color, r: e.radius });
    this.pushEvent({ k: 'sfx', s: 'enemyDie' });
    // the ward pylon falls: the empowerment ends
    if (e.id === this.pylonId) {
      this.pylonId = null;
      this.enemyBuff = 1;
      this.pushEvent({ k: 'toast', idx: -1, text: 'The ward pylon shatters — the empowerment ends' });
      this.fx.booms.push({ x: Math.round(x), y: Math.round(y), r: 120 });
    }
    // drops
    let mats = e.mats * this.greedMats;
    if (killer && killer.hookAgg && killer.hookAgg.doubleMaterials && Math.random() < killer.hookAgg.doubleMaterials) mats *= 2;
    for (let i = 0; i < mats; i++) this._dropMaterial(x + (Math.random() * 30 - 15), y + (Math.random() * 30 - 15));
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
        if (Math.random() < ke.chance) {
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
          this.spawnEnemyById(e.def.id, x + (i ? 18 : -18), y + (Math.random() * 20 - 10), { mini: true, noMats: false });
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

  _areaDamageEnemies(x, y, radius, dmg, owner, opts = {}) {
    const seen = new Set();
    this.grid.query(x, y, radius + 40, e => {
      if (!e.active || seen.has(e.id) || e === opts.exclude) return;
      seen.add(e.id);
      if (dist2(x, y, e.x, e.y) <= (radius + e.radius) * (radius + e.radius)) {
        if (this.losBlocked(x, y, e.x, e.y)) return; // blasts are clipped by walls
        this.damageEnemy(e, dmg, { owner, silent: opts.silent, crit: false });
      }
    });
  }

  hurtPlayer(p, raw, src, opts = {}) {
    if (this.over || p.gone || p.downed || p.invuln > 0 || this.god) return;
    raw *= this.enemyBuff; // the siege's ward pylon empowers everything
    const t = p.char.trait;
    // Reflex: dodge chance (capped in recompute); every on-dodge effect keys off this
    if (!opts.shared && Math.random() * 100 < p.stats.reflex) {
      this.fx.hits.push({ x: Math.round(p.x), y: Math.round(p.y - 24), a: 0, c: 2 }); // "dodge" popup
      if (t.key === 'slipstream') { p.tempoBuffT = t.dur; p.nextCrit = true; }
      if (t.key === 'afterimage') {
        this.decoys.push({ x: p.x, y: p.y, t: t.dur, dur: t.dur, tauntR: t.tauntR, owner: p.idx, burst: t.burst, radius: t.radius });
      }
      if (p.hookAgg.nextAttackAfterDodge > 0) { p.dmgBuffT = 3; p.dmgBuffAmt = p.hookAgg.nextAttackAfterDodge; }
      return;
    }
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
    // overheal shield absorbs first
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, dmg);
      p.shield -= absorbed; dmg -= absorbed;
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
        // straight shots are absorbed by walls (lobs above arc over)
        if (this.obstacles.length && this._inObstacle(pr.x, pr.y, 0)) { this.projPool.release(pr); continue; }
        if (expired || oob) { this.projPool.release(pr); continue; }
        // vs enemies
        let dead = false;
        this.grid.query(pr.x, pr.y, pr.radius + 40, e => {
          if (dead || !e.active || pr.hitIds.has(e.id)) return;
          if (dist2(pr.x, pr.y, e.x, e.y) <= (pr.radius + e.radius) * (pr.radius + e.radius)) {
            pr.hitIds.add(e.id);
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
        if (expired || oob) { this.projPool.release(pr); continue; }
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
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt; z.acc += dt;
      if (z.acc >= 0.4) {
        const mul = z.acc; z.acc = 0;
        if (z.hurts === 'enemies') {
          const owner = z.owner !== undefined ? this.players[z.owner] : null;
          this._areaDamageEnemies(z.x, z.y, z.r, z.dps * mul, owner, { silent: true });
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
        if (p.char.trait.key === 'immovable' && e.bulwarkCd <= 0) {
          e.bulwarkCd = CONFIG.CONTACT_COOLDOWN;
          const cd = Math.max(1, Math.round(p.char.trait.base + 0.25 * Math.max(0, p.stats.grit) + 0.05 * p.stats.vitality));
          this.damageEnemy(e, cd, { owner: p });
          if (!e.active) break;
        }
        if (e.contactCd <= 0 && p.invuln <= 0) {
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

  _dropMaterial(x, y, value = 1) {
    if (this.pickups.length >= 240) {
      const m = this.pickups[(Math.random() * this.pickups.length) | 0];
      m.v += value;
      return;
    }
    this.pickups.push({ x: clamp(x, WALL + 10, this.W - WALL - 10), y: clamp(y, WALL + 10, this.H - WALL - 10), v: value, vx: 0, vy: 0, target: -1 });
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
          this._collectMaterial(p, m.v);
        }
      }
    }
  }

  _collectMaterial(p, v) {
    this.pushEvent({ k: 'sfx', s: 'pickup' });
    if (p.hookAgg.pickupBonusChance > 0 && Math.random() < p.hookAgg.pickupBonusChance) v += 1;
    p.materials += v;
    p.matsCollected += v;
    const xpGain = v * (1 + p.hookAgg.xpBonus / 100);
    p.xp += xpGain;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.banked++;
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
    for (const mh of p.hookAgg.materialHeal) if (Math.random() < mh.chance) this._heal(p, mh.amount);
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
          const rate = 1 + q.hookAgg.reviveSpeed + (q.char.trait.key === 'field_rites' ? q.char.trait.reviveBoost : 0);
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
    if (reviver && reviver.char.trait.key === 'field_rites') {
      for (const q of this.livePlayers()) this._applyPerm(q, { vitality: reviver.char.trait.partyVit });
      this.pushEvent({ k: 'toast', idx: reviver.idx, text: `Field Rites: party +${reviver.char.trait.partyVit} Vitality` });
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
    const rng = subRng(this.seed, 'offer', this.floorNum, this.currentNode ?? -1, p.idx, p.level, p.banked);
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
    const rng = subRng(this.seed, 'treas', this.floorNum, this.currentNode ?? -1, p.idx);
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
  _offerBoon(p) {
    const t = p.char.trait;
    const rng = subRng(this.seed, 'boon', this.floorNum, this.currentNode ?? -1, p.idx);
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
    this.pushEvent({ k: 'boon', idx: p.idx, picks });
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
    if (!p.shop || p.shop.key !== `${this.floorNum}:${context}:${this.currentNode ?? -1}`) {
      // locked offers survive into the next shop even if the overlay was never
      // explicitly closed (e.g. the party walked out mid-browse)
      if (p.shop) p.shopLocksCarry = p.shop.stock.filter(s => s.locked && !s.sold);
      p.shopVisit++;
      const rng = subRng(this.seed, 'shop', this.floorNum, this.currentNode ?? -1, p.idx, p.shopVisit);
      p.shop = {
        key: `${this.floorNum}:${context}:${this.currentNode ?? -1}`,
        rng, rerolls: 0,
        freeLeft: p.hookAgg.freeRerolls,
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
    const needW = t.key === 'arsenal_doctrine' ? 0 : (shop.black ? 2 : (this.floorNum === 1 ? 2 : 1));
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

  // force: 'weapon' | 'rareplus' — used by the stock guarantees
  _rollStockEntry(p, rng, force = null) {
    const t = p.char.trait;
    const floorScale = 1 + CONFIG.PRICE_FLOOR_SCALE * (this.floorNum - 1);
    let discount = 1 - p.hookAgg.shopDiscount / 100;
    if (t.key === 'insider') discount *= 1 - t.discount / 100;
    // Quartermaster buys only weapons; Gilded One stocks only the finest
    // goods (legendary items, or weapons at the floor's top tier); the
    // Overseer's weapon rolls come from the summon rack (turrets/drones)
    const weaponChance = t.key === 'overseer' ? 0.5 : CONFIG.SHOP_WEAPON_CHANCE;
    const wantWeapon = force === 'weapon' ? true
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
    const it = rng.pick(pool);
    const price = Math.max(1, Math.round(it.price * floorScale * discount));
    return { kind: 'item', id: it.id, price, sold: false, locked: false };
  }

  _rollTier(rng) {
    const T = TIER_WEIGHTS[this.floorNum - 1];
    const roll = rng.float() * 100;
    let acc = 0;
    for (let i = 0; i < 4; i++) { acc += T[i]; if (roll < acc) return i + 1; }
    return 1;
  }

  // the highest tier the current floor can roll at all (Gilded One's shelf)
  _topTier() {
    const T = TIER_WEIGHTS[this.floorNum - 1];
    for (let i = 3; i >= 0; i--) if (T[i] > 0) return i + 1;
    return 1;
  }

  _rerollCost(p) {
    const base = CONFIG.REROLL_BASE + CONFIG.REROLL_PER_FLOOR * (this.floorNum - 1);
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
      weaponsOnly: p.char.trait.key === 'arsenal_doctrine',
      black: !!p.shop.black,
      floor: this.floorNum, // sell values shown in the UI derive from this
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
      : sellValue(weaponBasePrice(WEAPON_BY_ID[id], tier), this.floorNum);
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
    const refund = sellValue(item.price, this.floorNum);
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
      owner: p.idx, weaponId, weaponUid, tier, type: forceType || (sd.type || 'turret'),
      x: p.x + (Math.random() * 60 - 30), y: p.y + (Math.random() * 60 - 30),
      hp: 1, maxHp: 1, cd: 0, orbitA: Math.random() * 6.28, dead: false, aimA: 0,
    });
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
      s.hp = s.maxHp;
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
      case 'reopenShop': {
        // back into a shop stop from the node map
        if (this.phase !== 'map' || this.currentNode === null) return;
        if (this.floor.nodes[this.currentNode].kind !== 'shop') return;
        this._openShop(p, `node${this.currentNode}`);
        break;
      }
      case 'boon': {
        if (!p.boonOffer) return;
        const pick = p.boonOffer.find(o => o.id === msg.id) || p.boonOffer[0];
        p.boonOffer = null;
        p.boonCounts[pick.id] = (p.boonCounts[pick.id] || 0) + 1;
        if (p.boonCounts[pick.id] === 3) {
          this._applyPerm(p, { [pick.stat]: pick.amount });
          this.pushEvent({ k: 'toast', idx, text: `Prism: the ${pick.stat} boon is now PERMANENT` });
        } else {
          p.boonTemp = { [pick.stat]: pick.amount };
          if (p.boonCounts[pick.id] > 3) this.pushEvent({ k: 'toast', idx, text: 'Boon taken (already permanent — stacks this room)' });
        }
        this._recomputeStats(p);
        this.pushEvent({ k: 'boonDone', idx });
        break;
      }
      case 'treasure': {
        if (!p.treasureOffer) return;
        if (msg.id && p.treasureOffer.picks.includes(msg.id)) {
          p.items.push(msg.id);
          this._recomputeItems(p);
          this._recomputeStats(p);
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
        } else {
          p.items.push(s.id);
          this._recomputeItems(p);
          this._recomputeStats(p);
        }
        p.materials -= s.price;
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
          : sellValue(weaponBasePrice(WEAPON_BY_ID[w.id], w.tier), this.floorNum);
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
        if (p.shop.freeLeft > 0) p.shop.freeLeft--;
        else { p.materials -= cost; p.shop.rerolls++; }
        p.shop.stock = p.shop.stock.filter(s => s.locked && !s.sold);
        this._fillStock(p);
        this.pushEvent({ k: 'sfx', s: 'reroll' });
        p.metaDirty = true;
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
      floor: this.floorNum,
      players: this.players.map(p => ({
        idx: p.idx, name: p.name, charId: p.charId, color: p.color,
        damage: Math.round(p.damageDealt), kills: p.kills, level: p.level,
        mats: p.matsCollected, gone: p.gone,
        weapons: p.weapons.map(w => ({ id: w.id, tier: w.tier })),
        items: [...p.items],
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
        const table = FLOOR_TABLES[this.floorNum - 1];
        for (let i = 0; i < 50; i++) {
          const pos = { x: WALL + 40 + Math.random() * (this.W - 2 * WALL - 80), y: WALL + 40 + Math.random() * (this.H - 2 * WALL - 80) };
          if (this._inObstacle(pos.x, pos.y, 20)) continue;
          this.spawnEnemyById(table[(Math.random() * table.length) | 0], pos.x, pos.y, { noMats: false });
        }
        break;
      }
      case 'F2': for (const p of this.livePlayers()) this._collectMaterial(p, 200); break;
      case 'F3': {
        for (const e of [...this.enemyPool]) this._killEnemy(e, null);
        this.spawnQueue.length = 0;
        if (this.wave) this.wave.done = true;
        this._checkFightClear();
        break;
      }
      case 'F4': if (this.floorNum < CONFIG.FLOORS) this._startFloor(this.floorNum + 1); break;
      case 'F5': this.god = !this.god; this.pushEvent({ k: 'toast', idx: 0, text: `God mode ${this.god ? 'ON' : 'OFF'}` }); break;
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
      // the enemy counter's two states + the siege looting countdown
      inc: this.phase === 'arena' && this.wave && !this.wave.done ? 1 : 0,
      loot: this.lootT !== null && this.lootT !== undefined ? +this.lootT.toFixed(2) : null,
      hatch: this.hatch ? [r(this.hatch.x), r(this.hatch.y)] : null,
      hold: this.holdCircle ? [r(this.holdCircle.x), r(this.holdCircle.y), r(this.holdCircle.r), this.holdCircle.held ? 1 : 0] : null,
      players: this.players.map(p => [p.idx, r(p.x), r(p.y), r(p.hp), p.stats.vitality, p.downed ? 1 : 0, +p.reviveP.toFixed(2), r(p.shield), p.gone ? 1 : 0, +p.aimA.toFixed(2), +this._displayMeter(p).toFixed(2), p.carrying ? 1 : 0]),
      enemies: [], projs: [], pickups: [], summons: [], tele: [], zones: [],
      beams: this.activeBeams,
      boss: this.boss ? { name: this.boss.bossDef.name, hp: this.boss.hp, max: this.boss.maxHp } : null,
      fx: this.fxBatch || this._emptyFx(),
      hazards: (this.hazards || []).map(h => h.type === 'spikes'
        ? ['s', r(h.x), r(h.y), r(h.w), r(h.h), h.state]
        : ['l', r(h.x), r(h.y), r(h.r)]),
      // trait visuals — rendered on every screen (visibility is the trait)
      auras: this._snapAuras(),
      tethers: this._snapTethers(),
      decoys: this.decoys.map(d => [r(d.x), r(d.y), +(d.t / d.dur).toFixed(2), d.owner]),
    };
    // radius is derived client-side from type + elite/mini flags — not sent
    for (const e of this.enemyPool) {
      snap.enemies.push([e.id, e.boss ? -1 : e.typeIdx, r(e.x), r(e.y), +(e.hp / e.maxHp).toFixed(2), (e.elite ? 1 : 0) | (e.boss ? 2 : 0) | (e.mini ? 4 : 0) | (e.hitFlash > 0 ? 8 : 0) | (e.fusing ? 16 : 0) | (e.typeIdx === -2 ? 32 : 0)]);
    }
    for (const pr of this.projPool) {
      snap.projs.push([pr.id, r(pr.x), r(pr.y), r(pr.vx), r(pr.vy), pr.friendly ? 1 : 0, pr.radius, pr.color]);
    }
    let np = 0;
    for (const m of this.pickups) { if (np++ > 130) break; snap.pickups.push([r(m.x), r(m.y)]); }
    for (const s of this.summons) {
      if (!s.dead) snap.summons.push([s.owner, s.type, r(s.x), r(s.y), s.weaponId, +s.aimA.toFixed(2)]);
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
    if (t.key === 'momentum_meter') return p.meter;
    if (t.key === 'resonance') return Math.min(1, p.resonCharge / t.hits);
    if (t.key === 'overwatch') {
      const w = p.weapons[0];
      const cdMax = w ? WEAPON_BY_ID[w.id].cd / Math.max(0.25, 1 + p.stats.tempo / 100) : 0;
      return Math.min(1, (this.time - p.lastFireT) / (t.idle + cdMax));
    }
    if (t.key === 'crit_ramp') return Math.min(1, p.jesterOdds / t.max);
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
      stats: { ...p.stats }, weaponSlots: p.weaponSlots,
      boonCounts: p.char.trait.key === 'prism' ? { ...p.boonCounts } : undefined,
    };
  }

  // sim helpers used by behaviors
  walk(e, tx, ty, spd, dt) { this.walkAngle(e, angleTo(e.x, e.y, tx, ty), spd, dt); }
  walkAngle(e, a, spd, dt) {
    e.x += Math.cos(a) * spd * dt;
    e.y += Math.sin(a) * spd * dt;
    this.clampToRoom(e);
  }
  clampToRoom(e) {
    e.x = clamp(e.x, WALL + e.radius * 0.6, this.W - WALL - e.radius * 0.6);
    e.y = clamp(e.y, WALL + e.radius * 0.6, this.H - WALL - e.radius * 0.6);
    this._pushOut(e, e.radius * 0.6);
  }
}

// ---------------- module helpers ----------------

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

