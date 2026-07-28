// Host-authoritative simulation. Runs at a fixed 60 Hz, fully separate from
// rendering. Clients only ever send inputs/UI intents; everything here is the
// single source of truth. Solo play runs this exact code with one player.

import { CONFIG, TIER_MULT, TIER_PRICE_MULT } from './config.js';
import { Rng, subRng } from './rng.js';
import { Pool, SpatialHash, clamp, dist, dist2, angleTo } from './util.js';
import { generateFloor, serializeFloor } from './dungeon.js';
import { CHAR_BY_ID } from './content/characters.js';
import { WEAPONS, WEAPON_BY_ID } from './content/weapons.js';
import { ITEMS, ITEM_BY_ID } from './content/items.js';
import { ENEMIES, ENEMY_BY_ID, ENEMY_INDEX, ELITE_MODS, FLOOR_TABLES } from './content/enemies.js';
import { BOSS_BY_FLOOR } from './content/bosses.js';
import { STAT_BOOSTS } from './content/statboosts.js';
import { updateEnemy } from './entities/enemies.js';

const { ROOM_W: W, ROOM_H: H, WALL, DOOR_W, DT } = CONFIG;
const SPAWN_CAPS = { wombden: 2, aegimand: 2, stitcher: 2, deadeye: 2, slabjaw: 3 };
const ENG_SCALE = 0.1; // +10% summon damage & HP per Engineering point

export class Sim {
  constructor({ seed, party }) {
    this.seed = seed >>> 0;
    this.W = W; this.H = H;
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

    this.players = party.map((m, i) => this._makePlayer(m, i));
    // party-wide curses (Tollkeeper)
    this.greedHp = this.players.some(p => p.char.trait.key === 'greed_curse') ? 1.25 : 1;
    this.greedMats = this.players.some(p => p.char.trait.key === 'greed_curse') ? 2 : 1;
    this.coopHp = 1 + CONFIG.COOP_HP_SCALE * (this.players.length - 1);
    this.coopSpawn = 1 + CONFIG.COOP_SPAWN_SCALE * (this.players.length - 1);

    this.floorNum = 0;
    this.doorCd = null;     // {kind:'door'|'hatch', target, t}
    this.pendingEnd = 0;
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
      x: W / 2, y: H / 2, radius: CONFIG.PLAYER_RADIUS * (char.trait.key === 'kb_immune_big' ? char.trait.hitbox : 1),
      mx: 0, my: 0, interact: false, moving: false, aimA: 0,
      hp: 1, shield: 0, downed: false, reviveP: 0, invuln: 0, pullX: 0, pullY: 0,
      level: 1, xp: 0, xpNext: CONFIG.XP_BASE + CONFIG.XP_PER_LEVEL * 1,
      materials: 0, matsCollected: 0, banked: 0,
      weapons: [], items: [],
      boosts: {}, permStats: {}, tempStats: {},
      stats: null, hookAgg: null,
      weaponSlots: CONFIG.WEAPON_SLOT_MAX,
      dodgeCap: CONFIG.DODGE_CAP, critMult: 2,
      attackCounter: 0, stillT: 0, critRamp: 0, firstHitUsed: false,
      nextCrit: false, speedBuffT: 0, dmgBuffT: 0, dmgBuffAmt: 0,
      frenzy: [], pendingEchoes: [], secondWindUsed: false, blockT: 0,
      hpKillGained: 0, levelStatsBase: {},
      chamStat: null, contactAuraAcc: 0, regenAcc: 0, zoneAcc: 0,
      damageDealt: 0, kills: 0,
      pendingOffer: null, treasureOffer: null,
      shop: null, shopLocksCarry: [], shopVisit: 0, rerollFlat: false,
      metaDirty: true,
    };
    const t = char.trait;
    if (t.key === 'shop_broker') p.weaponSlots = t.slots;
    if (t.key === 'structures_fast') p.weaponSlots = t.slotCap;
    if (t.key === 'no_weapons_turrets') p.weaponSlots = 0;
    if (t.key === 'dodge_master') p.dodgeCap = t.cap;
    if (t.key === 'armor_growth') p.dodgeCap = t.dodgeCap;
    if (t.key === 'crit_x3') p.critMult = 3;
    if (t.key === 'no_compound_reroll') p.rerollFlat = true;
    this._recomputeItems(p);
    this._recomputeStats(p);
    p.hp = p.stats.maxHp;
    return p;
  }

  _initStartingGear(p) {
    const t = p.char.trait;
    if (t.key === 'no_weapons_turrets') {
      for (let i = 0; i < t.turrets; i++) this._spawnSummon(p, 'bolt_turret', 1);
    } else if (p.char.weapon) {
      this._addWeapon(p, p.char.weapon, 1, { silent: true });
    }
    if (t.key === 'mirror_drone') this._spawnSummon(p, null, 1, 'mirror');
    if (t.key === 'free_drone_floor') this._spawnSummon(p, 'guard_drone', 1);
  }

  _recomputeItems(p) {
    // aggregate item hooks once per inventory change
    const agg = {
      firstHitCrit: false, killExplode: [], thorns: 0, reviveSpeed: 0, allyAura: [],
      pickupRadius: 0, roomClearHeal: 0, lowHpBonus: [], critHeal: 0,
      burnOnHit: [], chainOnHit: [], slowOnHit: [], blockShield: null,
      secondWind: null, doubleMaterials: 0, eliteBossDamage: 0, interest: [],
      freeRerolls: 0, shopDiscount: 0, xpBonus: 0, extraPierce: 0, extraProjectiles: 0,
      killFrenzy: [], contactAura: [], onHurtRetaliate: [], dodgeToDamage: [],
      harvestGrowth: 0, levelStats: [], floorStats: [], maxHpOnKill: [],
      summonDmg: 0, summonHp: 0, knockMult: 1, materialHeal: [],
    };
    for (const id of p.items) {
      const it = ITEM_BY_ID[id];
      if (!it || !it.hooks) continue;
      const h = it.hooks;
      if (h.firstHitCrit) agg.firstHitCrit = true;
      if (h.killExplode) agg.killExplode.push(h.killExplode);
      if (h.thorns) agg.thorns += h.thorns.damage;
      if (h.reviveSpeed) agg.reviveSpeed += h.reviveSpeed.mult;
      if (h.allyAura) agg.allyAura.push(h.allyAura);
      if (h.pickupRadius) agg.pickupRadius += h.pickupRadius.add;
      if (h.roomClearHeal) agg.roomClearHeal += h.roomClearHeal.amount;
      if (h.lowHpBonus) agg.lowHpBonus.push(h.lowHpBonus);
      if (h.critHeal) agg.critHeal += h.critHeal.amount;
      if (h.burnOnHit) agg.burnOnHit.push(h.burnOnHit);
      if (h.chainOnHit) agg.chainOnHit.push(h.chainOnHit);
      if (h.slowOnHit) agg.slowOnHit.push(h.slowOnHit);
      if (h.blockShield && (!agg.blockShield || h.blockShield.cooldown < agg.blockShield)) agg.blockShield = h.blockShield.cooldown;
      if (h.secondWind && (!agg.secondWind || h.secondWind.healPercent > agg.secondWind)) agg.secondWind = h.secondWind.healPercent;
      if (h.doubleMaterials) agg.doubleMaterials = Math.min(1, agg.doubleMaterials + h.doubleMaterials.chance);
      if (h.eliteBossDamage) agg.eliteBossDamage += h.eliteBossDamage.bonus;
      if (h.interest) agg.interest.push(h.interest);
      if (h.freeRerolls) agg.freeRerolls += h.freeRerolls.count;
      if (h.shopDiscount) agg.shopDiscount += h.shopDiscount.percent;
      if (h.xpBonus) agg.xpBonus += h.xpBonus.percent;
      if (h.extraPierce) agg.extraPierce += h.extraPierce.add;
      if (h.extraProjectiles) agg.extraProjectiles += h.extraProjectiles.add;
      if (h.killFrenzy) agg.killFrenzy.push(h.killFrenzy);
      if (h.contactAura) agg.contactAura.push(h.contactAura);
      if (h.onHurtRetaliate) agg.onHurtRetaliate.push(h.onHurtRetaliate);
      if (h.dodgeToDamage) agg.dodgeToDamage.push(h.dodgeToDamage);
      if (h.harvestGrowth) agg.harvestGrowth += h.harvestGrowth.percent;
      if (h.levelStats) agg.levelStats.push(h.levelStats);
      if (h.floorStats) agg.floorStats.push(h.floorStats);
      if (h.maxHpOnKill) agg.maxHpOnKill.push(h.maxHpOnKill);
      if (h.summonBoost) { agg.summonDmg += h.summonBoost.damage; agg.summonHp += h.summonBoost.hp; }
      if (h.knockbackBoost) agg.knockMult *= (1 + h.knockbackBoost.mult);
      if (h.materialHeal) agg.materialHeal.push(h.materialHeal);
    }
    p.hookAgg = agg;
  }

  _recomputeStats(p) {
    const s = {
      maxHp: 80, hpRegen: 0, lifeSteal: 0, damage: 0, meleeDamage: 0, rangedDamage: 0,
      elementalDamage: 0, attackSpeed: 0, critChance: 0, engineering: 0, range: 0,
      armor: 0, dodge: 0, speed: 0, luck: 0, harvesting: 0,
    };
    const add = mods => { for (const k in mods) if (k in s) s[k] += mods[k]; };
    add(p.char.stats);
    for (const id of p.items) { const it = ITEM_BY_ID[id]; if (it && it.stats) add(it.stats); }
    add(p.boosts);
    add(p.permStats);
    // temporary/situational stats
    const t = p.char.trait, hpFrac = p.stats ? clamp(p.hp / Math.max(1, p.stats.maxHp), 0, 1) : 1;
    const temp = {};
    const tadd = (k, v) => { temp[k] = (temp[k] || 0) + v; };
    if (t.key === 'berserk_missing') tadd('damage', Math.round((1 - hpFrac) * 100) * t.perMissing);
    if (t.key === 'move_ranged_bonus' && p.moving) tadd('rangedDamage', t.bonus);
    if (t.key === 'crit_ramp') tadd('critChance', p.critRamp);
    if (p.chamStat) tadd(p.chamStat.stat, p.chamStat.amount);
    for (const f of p.frenzy) tadd('attackSpeed', f.as);
    if (p.speedBuffT > 0 && t.key === 'dodge_burst') tadd('speed', t.speed);
    if (p.dmgBuffT > 0) tadd('damage', p.dmgBuffAmt);
    if (p.hookAgg) {
      for (const lh of p.hookAgg.lowHpBonus) if (hpFrac < lh.threshold) add(lh.stats);
    }
    // ally auras from other players (players array absent mid-construction)
    for (const q of this.players || []) {
      if (q === p || q.gone || q.downed || !q.hookAgg) continue;
      for (const aura of q.hookAgg.allyAura) {
        if (dist2(p.x, p.y, q.x, q.y) <= aura.radius * aura.radius) add(aura.stats);
      }
    }
    for (const k in temp) s[k] += temp[k];
    // derived conversions (order matters: after all raw adds)
    if (t.key === 'dodge_master') {
      s.maxHp = Math.min(s.maxHp, t.hpCap);
      tempSafe(s, 'damage', Math.min(s.dodge, t.cap) * t.dmgPerDodge);
    }
    if (t.key === 'armor_to_damage') tempSafe(s, 'damage', Math.max(0, s.armor) * t.perArmor);
    if (t.key === 'speed_to_damage') tempSafe(s, 'damage', Math.floor(Math.max(0, s.speed) / t.per));
    if (t.key === 'no_regen_growth') s.hpRegen = 0;
    s.dodge = clamp(s.dodge, 0, p.dodgeCap);
    s.maxHp = Math.max(1, Math.round(s.maxHp));
    const oldMax = p.stats ? p.stats.maxHp : s.maxHp;
    p.stats = s;
    if (s.maxHp > oldMax) p.hp += s.maxHp - oldMax; // growing max HP grants the difference
    p.hp = Math.min(p.hp, s.maxHp);
    p.metaDirty = true;
  }

  // ---------------- floors & rooms ----------------

  _startFloor(n) {
    this.floorNum = n;
    this.floor = generateFloor(this.seed, n);
    this.roomStates = new Map();
    for (const r of this.floor.rooms) {
      this.roomStates.set(r.id, { cleared: r.kind === 'start', visited: false, treasureDone: false, shopStocked: false });
    }
    this.pushEvent({ k: 'floor', layout: serializeFloor(this.floor), floorNum: n });
    for (const p of this.players) {
      if (p.gone) continue;
      // overlays close on floor transition — re-surface any unresolved offers
      if (p.pendingOffer) this.pushEvent({ k: 'offer', idx: p.idx, picks: p.pendingOffer, banked: p.banked });
      if (p.treasureOffer) this.pushEvent({ k: 'treasure', idx: p.idx, kind: p.treasureOffer.kind, picks: p.treasureOffer.picks });
      p.secondWindUsed = false;
      if (n > 1) {
        // heal half of missing HP between floors
        p.hp = Math.min(p.stats.maxHp, p.hp + Math.ceil((p.stats.maxHp - p.hp) * 0.5));
        for (const fs of p.hookAgg.floorStats) this._applyPerm(p, fs.stats);
        if (p.char.trait.key === 'free_drone_floor') this._spawnSummon(p, 'guard_drone', 1);
      }
    }
    this._enterRoom(this.floor.startId, null);
  }

  _room() { return this.floor.rooms[this.roomId]; }
  _rs() { return this.roomStates.get(this.roomId); }

  _enterRoom(roomId, fromDir) {
    this.roomId = roomId;
    const room = this._room();
    const rs = this._rs();
    this.doorCd = null;
    this.telegraphs.length = 0; this.zones.length = 0; this.vortexes.length = 0;
    this.activeBeams.length = 0;
    this.enemyPool.clear();
    this.projPool.clear();
    this.pickups.length = 0;
    this.hatch = null;
    this.spawnQueue = [];
    this.pulses = [];
    this.roomLocked = false;
    this.boss = null;

    // position players at the entry door (or center for floor start)
    const entry = fromDir ? OPP[fromDir] : null;
    const base = entry ? doorAnchor(entry) : { x: W / 2, y: H / 2 };
    this.players.forEach((p, i) => {
      if (p.gone) return;
      p.x = clamp(base.x + (i % 2 ? -1 : 1) * (26 + 18 * Math.floor(i / 2)), WALL + p.radius, W - WALL - p.radius);
      p.y = clamp(base.y + (i < 2 ? -1 : 1) * 22, WALL + p.radius, H - WALL - p.radius);
      p.firstHitUsed = false;
      p.pullX = p.pullY = 0;
      if (p.char.trait.key === 'random_room_stat') {
        const r = subRng(this.seed, 'cham', this.floorNum, roomId, p.idx);
        const opts = ['damage', 'attackSpeed', 'critChance', 'speed', 'dodge', 'armor', 'maxHp', 'elementalDamage', 'meleeDamage', 'rangedDamage', 'luck'];
        p.chamStat = { stat: r.pick(opts), amount: r.int(8, 20) };
        this.pushEvent({ k: 'toast', idx: p.idx, text: `Chameleon: +${p.chamStat.amount} ${p.chamStat.stat} this room` });
        this._recomputeStats(p);
      }
    });
    // teleport summons along
    for (const s of this.summons) {
      const owner = this.players[s.owner];
      s.x = owner.x + (Math.random() * 80 - 40); s.y = owner.y + (Math.random() * 80 - 40);
      if (s.dead) { s.dead = false; s.hp = s.maxHp; } // structures rebuild between rooms
    }
    // hazards
    this.hazards = buildHazards(room, this.seed, this.floorNum);
    rs.visited = true;

    if (!rs.cleared && (room.kind === 'combat' || room.kind === 'elite')) {
      this._beginCombat(room, rs);
    } else if (!rs.cleared && room.kind === 'boss') {
      this._beginBoss(room);
    } else if (room.kind === 'treasure' && !rs.treasureDone) {
      rs.treasureDone = true;
      for (const p of this.livePlayers()) this._offerTreasure(p, 'treasure');
      rs.cleared = true;
    } else if (room.kind === 'shop') {
      rs.cleared = true;
      for (const p of this.livePlayers()) this._openShop(p);
    }
    if (room.kind === 'treasure') rs.cleared = true;
    // returning to a beaten boss room: the hatch is still there
    if (room.kind === 'boss' && rs.cleared && this.floorNum < CONFIG.FLOORS) {
      this.hatch = { x: W / 2, y: H / 2 };
    }
    this.doorGrace = 1.0; // no countdown until entrants step out of the doorway zone
    this.pushEvent({
      k: 'room', roomId, kind: room.kind, hazard: room.hazard, cleared: rs.cleared,
      locked: this.roomLocked, doors: room.doors, fromDir: fromDir || null,
    });
  }

  _beginCombat(room, rs) {
    this.roomLocked = true;
    const rng = subRng(this.seed, 'spawn', this.floorNum, room.id);
    const isElite = room.kind === 'elite';
    let quota = Math.round((CONFIG.QUOTA_BASE + CONFIG.QUOTA_PER_FLOOR * this.floorNum) * this.coopSpawn);
    if (isElite) quota = Math.round(quota * 0.5);
    const table = FLOOR_TABLES[this.floorNum - 1];
    const counts = {};
    const comp = [];
    for (let i = 0; i < quota; i++) {
      let id = table[Math.floor(rng.float() * table.length)];
      const cap = SPAWN_CAPS[id];
      if (cap && (counts[id] || 0) >= cap) id = table[0] === id ? table[1] : table[0];
      counts[id] = (counts[id] || 0) + 1;
      comp.push({ id, elite: false });
    }
    if (isElite) {
      const eliteCount = this.floorNum >= 3 ? 2 : 1;
      for (let i = 0; i < eliteCount; i++) {
        comp.push({ id: rng.pick(table.filter(t => t !== 'wombden')), elite: true, mod: rng.pick(ELITE_MODS) });
      }
    }
    // 3 pulses: 40/30/30
    const p1 = Math.ceil(comp.length * 0.4), p2 = Math.ceil(comp.length * 0.3);
    this.pulses = [comp.slice(0, p1), comp.slice(p1, p1 + p2), comp.slice(p1 + p2)];
    this.pulseTimer = 0.6;
    this.pulseIdx = 0;
    this.pulseRng = rng;
    this.pushEvent({ k: 'locked' });
  }

  _beginBoss(room) {
    this.roomLocked = true;
    const def = BOSS_BY_FLOOR[this.floorNum];
    const e = this.enemyPool.alloc();
    if (!e) return;
    const id = ++this.spawnCounter;
    Object.assign(e, {
      id, def: null, typeIdx: -1, boss: true, bossDef: def, bs: {},
      x: W / 2, y: H * 0.3, hp: Math.round(def.hp * this.coopHp * this.greedHp),
      maxHp: Math.round(def.hp * this.coopHp * this.greedHp),
      radius: def.radius, spd: def.spd, dmg: def.dmg, dmgScale: 1, mats: def.mats,
      elite: false, eliteMod: null, t: 0, phase: 0, slowT: 0, slowMult: 1,
      burnT: 0, hitFlash: 0, knockX: 0, knockY: 0, contactCd: 0, shape: def.shape, color: def.color,
    });
    this.boss = e;
    this.pushEvent({ k: 'bossSpawn', name: def.name });
  }

  spawnEnemyById(id, x, y, opts = {}) {
    const def = ENEMY_BY_ID[id];
    if (!def) return null;
    const e = this.enemyPool.alloc();
    if (!e) return null;
    const fl = Math.pow(CONFIG.FLOOR_HP_MULT, this.floorNum - 1);
    const dmgScale = Math.pow(CONFIG.FLOOR_DMG_MULT, this.floorNum - 1) * (opts.elite ? CONFIG.ELITE_DMG_MULT : 1);
    let hp = def.hp * fl * this.coopHp * this.greedHp * (opts.elite ? CONFIG.ELITE_HP_MULT : 1);
    if (opts.mini) hp *= 0.35;
    Object.assign(e, {
      id: ++this.spawnCounter, def, typeIdx: ENEMY_INDEX[id], boss: false, bossDef: null,
      x: clamp(x, WALL + 20, W - WALL - 20), y: clamp(y, WALL + 20, H - WALL - 20),
      hp: Math.round(hp), maxHp: Math.round(hp),
      radius: def.radius * (opts.elite ? 1.45 : 1) * (opts.mini ? 0.6 : 1),
      spd: def.spd * (opts.elite ? 1.1 : 1) * (opts.mini ? 1.25 : 1),
      dmg: def.dmg * dmgScale, dmgScale,
      mats: opts.noMats ? 0 : def.mats, mini: !!opts.mini,
      elite: !!opts.elite, eliteMod: opts.elite ? (opts.mod || ELITE_MODS[0]) : null,
      t: Math.random(), phase: 0, slowT: 0, slowMult: 1, burnT: 0, burnDps: 0, burnOwner: null,
      hitFlash: 0, knockX: 0, knockY: 0, contactCd: 0, fusing: false, blockT: 0,
      fireT: 0.8 + Math.random(), healTarget: null, brood: null, shape: def.shape, color: def.color,
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

    // spawn pulses
    this._tickSpawning(dt);
    // players
    for (const p of this.players) { if (!p.gone) this._tickPlayer(p, dt); }
    // periodic stat recompute (auras, low-hp, frenzy expiry); also surface
    // level-ups earned from post-clear pickup vacuuming without a new clear
    if (this.tickNum % 15 === 0) {
      for (const p of this.players) {
        if (p.gone) continue;
        this._recomputeStats(p);
        if (!this.roomLocked && this._rs().cleared && p.banked > 0) this._maybeOffer(p);
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
    // revives
    this._tickRevive(dt);
    // room clear check
    this._checkClear();
    // door countdown
    this._tickDoors(dt);
  }

  _tickSpawning(dt) {
    if (!this.roomLocked || this.boss) { this._flushSpawnQueue(dt); return; }
    if (this.pulseIdx < this.pulses.length) {
      this.pulseTimer -= dt;
      const aliveCount = this.enemyPool.count + this.spawnQueue.length;
      const trigger = this.pulseTimer <= 0 || (this.pulseIdx > 0 && aliveCount <= 3);
      if (trigger) {
        const batch = this.pulses[this.pulseIdx++];
        this.pulseTimer = 9;
        for (const spec of batch) {
          const pos = this._spawnPos();
          this.spawnQueue.push({ t: 0.7, ...spec, x: pos.x, y: pos.y });
          this.addTelegraph({ shape: 'circle', x: pos.x, y: pos.y, r: 26, dur: 0.7, spawnMark: true });
        }
      }
    }
    this._flushSpawnQueue(dt);
  }

  _flushSpawnQueue(dt) {
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const q = this.spawnQueue[i];
      q.t -= dt;
      if (q.t <= 0) {
        this.spawnQueue.splice(i, 1);
        this.spawnEnemyById(q.id, q.x, q.y, { elite: q.elite, mod: q.mod });
      }
    }
  }

  _spawnPos() {
    const rng = this.pulseRng;
    for (let tries = 0; tries < 20; tries++) {
      const x = WALL + 40 + rng.float() * (W - 2 * WALL - 80);
      const y = WALL + 40 + rng.float() * (H - 2 * WALL - 80);
      let ok = true;
      for (const p of this.livePlayers()) if (dist2(x, y, p.x, p.y) < 220 * 220) { ok = false; break; }
      if (ok) return { x, y };
    }
    return { x: W / 2, y: WALL + 60 };
  }

  // ---------------- player tick ----------------

  _tickPlayer(p, dt) {
    if (p.invuln > 0) p.invuln -= dt;
    if (p.speedBuffT > 0) p.speedBuffT -= dt;
    if (p.dmgBuffT > 0) p.dmgBuffT -= dt;
    p.frenzy = p.frenzy.filter(f => (f.t -= dt) > 0);

    if (p.downed) { p.mx = p.my = 0; p.interact = false; return; }

    // movement
    p.moving = (p.mx !== 0 || p.my !== 0);
    if (p.moving) p.stillT = 0; else p.stillT += dt;
    let spd = CONFIG.BASE_SPEED * (1 + p.stats.speed / 100);
    spd = Math.max(60, spd);
    p.x += (p.mx * spd + p.pullX) * dt;
    p.y += (p.my * spd + p.pullY) * dt;
    p.pullX = p.pullY = 0;
    p.x = clamp(p.x, WALL + p.radius, W - WALL - p.radius);
    p.y = clamp(p.y, WALL + p.radius, H - WALL - p.radius);

    // regen (per 5s)
    if (p.stats.hpRegen > 0 && p.hp < p.stats.maxHp) {
      p.regenAcc += p.stats.hpRegen * dt / 5;
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
    // pending echo attacks (Echo trait)
    for (let i = p.pendingEchoes.length - 1; i >= 0; i--) {
      const ec = p.pendingEchoes[i];
      ec.t -= dt;
      if (ec.t <= 0) {
        p.pendingEchoes.splice(i, 1);
        const w = p.weapons[ec.widx];
        if (w) this._fireWeapon(p, w, ec.widx, { factor: ec.factor, noEcho: true });
      }
    }

    // interact: reopen shop while in shop room / post-boss
    if (p.interact) {
      p.interact = false;
      const room = this._room();
      if ((room.kind === 'shop' && this._rs().cleared) || this.hatch) {
        this._openShop(p, this.hatch ? 'boss' : 'shop');
      }
    }
  }

  _heal(p, amount) {
    if (p.downed || amount <= 0) return;
    const t = p.char.trait;
    const before = p.hp;
    p.hp = Math.min(p.stats.maxHp, p.hp + amount);
    const overflow = amount - (p.hp - before);
    if (overflow > 0 && t.key === 'overheal_shield') p.shield = Math.min(t.cap, p.shield + overflow);
  }

  // ---------------- weapons & attacks ----------------

  _tickWeapons(p, dt) {
    for (let i = 0; i < p.weapons.length; i++) {
      const w = p.weapons[i];
      const def = WEAPON_BY_ID[w.id];
      if (def.cls === 'summon') continue; // structures act on their own
      const cdMax = def.cd / Math.max(0.25, 1 + p.stats.attackSpeed / 100);
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
    return Math.max(40, def.range + p.stats.range * (melee ? 0.3 : 1));
  }

  _fireWeapon(p, w, widx, opts = {}) {
    const def = WEAPON_BY_ID[w.id];
    const range = this._weaponRange(p, def);
    const target = opts.target || this._nearestEnemy(p.x, p.y, range);
    if (!target) return;
    const a = angleTo(p.x, p.y, target.x, target.y);
    p.aimA = a;

    // damage roll
    let dmg = def.dmg * TIER_MULT[w.tier - 1];
    let mult = 1 + p.stats.damage / 100;
    for (const tag of def.tags) {
      if (tag === 'meleeDamage') mult *= 1 + p.stats.meleeDamage / 100;
      if (tag === 'rangedDamage') mult *= 1 + p.stats.rangedDamage / 100;
      if (tag === 'elementalDamage') mult *= 1 + p.stats.elementalDamage / 100;
    }
    const t = p.char.trait;
    if (t.key === 'glass') mult *= t.dealMult;
    if (t.key === 'still_charge') {
      const bonus = Math.min(t.max, t.ratePerSec * p.stillT);
      if (bonus > 0) { mult *= 1 + bonus / 100; p.stillT = 0; }
    }
    if (opts.factor) mult *= opts.factor;
    dmg = Math.max(1, dmg * mult);

    // crit determination (rolled per fire; guaranteed-crit flags consume here)
    let critChance = p.stats.critChance + (def.critBonus || 0);
    let guaranteed = false;
    if (p.nextCrit) { guaranteed = true; p.nextCrit = false; }
    if (!p.firstHitUsed && (p.hookAgg.firstHitCrit || t.key === 'first_hit_crit_innate')) {
      guaranteed = true;
    }
    p.firstHitUsed = true;
    const crit = guaranteed || Math.random() * 100 < critChance;
    if (t.key === 'crit_ramp') { if (crit) p.critRamp = 0; else p.critRamp += t.per; }
    if (crit) dmg *= p.critMult;
    dmg = Math.round(dmg);

    const knock = def.knock * p.hookAgg.knockMult;
    const hitCtx = { owner: p, crit, weaponDef: def, knock, baseDmg: dmg };

    // echo trait: every 4th attack echoes
    if (!opts.noEcho && t.key === 'echo_4th') {
      p.attackCounter++;
      if (p.attackCounter % 4 === 0) {
        for (let n = 1; n <= t.echoes; n++) p.pendingEchoes.push({ t: 0.14 * n, widx, factor: t.factor });
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
            weaponId: def.id, kind: 'lob', summonBurn: null, summonKnock: 0,
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
      id: ++this.spawnCounter, x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18,
      vx: Math.cos(a) * def.projSpeed, vy: Math.sin(a) * def.projSpeed,
      dmg, crit, friendly: true, lob: false, ttl: (range + 60) / def.projSpeed,
      radius: 5, color: def.color, owner: p.idx, pierce, hitIds: new Set(),
      weaponId: def.id, kind: 'shot', summonBurn: null, summonKnock: 0,
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
    this.damageEnemy(e, finalDmg, { crit: ctx.crit, owner: p });
    if (!e.active) return;
    // elemental payloads from weapon
    if (def) {
      if (def.burn) this._applyBurn(e, def.burn.dps * (1 + p.stats.elementalDamage / 100), def.burn.dur, p);
      if (def.slow) this._applySlow(e, def.slow.mult, def.slow.dur);
      if (def.chainHit) this._chainLightning(e, ctx, def.chainHit);
    }
    // character trait payloads
    if (t.key === 'burn_attacks') this._applyBurn(e, t.dps * (1 + p.stats.elementalDamage / 100), t.dur, p);
    if (t.key === 'slow_attacks') this._applySlow(e, t.mult, t.dur);
    if (t.key === 'chain_attacks' && Math.random() < t.chance) {
      this._chainLightning(e, ctx, { count: 1, range: t.range, factor: t.factor });
    }
    // item payloads
    for (const b of p.hookAgg.burnOnHit) if (Math.random() < b.chance) this._applyBurn(e, b.dps, b.duration, p);
    for (const s of p.hookAgg.slowOnHit) if (Math.random() < s.chance) this._applySlow(e, s.mult, s.duration);
    for (const c of p.hookAgg.chainOnHit) if (Math.random() < c.chance) {
      const near = this._nearestEnemyExcept(e.x, e.y, c.range, e);
      if (near) { this.fx.beams.push({ x1: e.x, y1: e.y, x2: near.x, y2: near.y, color: '#4fd8eb' }); this.damageEnemy(near, c.damage, { owner: p, elementalFx: true }); }
    }
    if (ctx.crit && p.hookAgg.critHeal) this._heal(p, p.hookAgg.critHeal);
  }

  _chainLightning(e, ctx, chain) {
    const p = ctx.owner;
    let from = e;
    // chain damage: factor of the hit that triggered it
    const base = ctx.baseDmg || (ctx.weaponDef ? ctx.weaponDef.dmg : 5);
    const dmg = Math.max(1, Math.round(base * chain.factor));
    const hit = new Set([e.id]);
    for (let i = 0; i < chain.count; i++) {
      const next = this._nearestEnemyExcept(from.x, from.y, chain.range, from, hit);
      if (!next) break;
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
  _applySlow(e, mult, dur) {
    if (!e.active) return;
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
      if (p.stats.lifeSteal > 0 && !opts.noLifesteal) {
        p.lsAcc = (p.lsAcc || 0) + amount * p.stats.lifeSteal / 100;
        if (p.lsAcc >= 1) { const h = Math.floor(p.lsAcc); p.lsAcc -= h; this._heal(p, h); }
      }
    }
    if (e.hp <= 0) this._killEnemy(e, p);
  }

  _killEnemy(e, killer) {
    const { x, y } = e;
    this.fx.deaths.push({ x: Math.round(x), y: Math.round(y), c: e.boss ? e.bossDef.color : e.def.color, r: e.radius });
    this.pushEvent({ k: 'sfx', s: 'enemyDie' });
    // drops
    let mats = e.mats * this.greedMats;
    if (killer && killer.hookAgg && killer.hookAgg.doubleMaterials && Math.random() < killer.hookAgg.doubleMaterials) mats *= 2;
    for (let i = 0; i < mats; i++) this._dropMaterial(x + (Math.random() * 30 - 15), y + (Math.random() * 30 - 15));
    // killer hooks & traits
    if (killer && killer.stats) {
      killer.kills++;
      const t = killer.char.trait;
      if (t.key === 'kill_heal') this._heal(killer, t.amount);
      for (const ke of killer.hookAgg.killExplode) {
        if (Math.random() < ke.chance) {
          this.fx.booms.push({ x, y, r: ke.radius });
          this._areaDamageEnemies(x, y, ke.radius, ke.damage, killer, { exclude: e });
          this.pushEvent({ k: 'sfx', s: 'boom' });
        }
      }
      for (const mk of killer.hookAgg.maxHpOnKill) {
        if (killer.hpKillGained < mk.cap) { killer.hpKillGained += mk.amount; this._applyPerm(killer, { maxHp: mk.amount }); }
      }
      for (const kf of killer.hookAgg.killFrenzy) {
        if (killer.frenzy.length < kf.maxStacks) killer.frenzy.push({ as: kf.attackSpeed, t: kf.duration });
        else { const oldest = killer.frenzy.reduce((a, b) => a.t < b.t ? a : b); oldest.t = kf.duration; }
      }
    }
    // death behaviors
    if (!e.boss) {
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
      if (!p.downed && dist2(x, y, p.x, p.y) < (boom.radius + p.radius) * (boom.radius + p.radius)) {
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
        this.damageEnemy(e, dmg, { owner, silent: opts.silent, crit: false });
      }
    });
  }

  hurtPlayer(p, raw, src) {
    if (this.over || p.gone || p.downed || p.invuln > 0 || this.god) return;
    const t = p.char.trait;
    // dodge
    const dodge = Math.min(p.stats.dodge, p.dodgeCap);
    if (Math.random() * 100 < dodge) {
      this.fx.hits.push({ x: Math.round(p.x), y: Math.round(p.y - 24), a: 0, c: 2 }); // "dodge" popup
      if (t.key === 'dodge_burst') { p.speedBuffT = t.dur; p.nextCrit = true; }
      if (t.key === 'dodge_retaliate') {
        this.fx.booms.push({ x: p.x, y: p.y, r: t.radius });
        this._areaDamageEnemies(p.x, p.y, t.radius, t.dmg, p);
      }
      for (const dd of p.hookAgg.dodgeToDamage) { p.dmgBuffT = dd.duration; p.dmgBuffAmt = dd.bonus; }
      return;
    }
    // auto-block shield item
    if (p.hookAgg.blockShield !== null && p.blockT <= 0) {
      p.blockT = p.hookAgg.blockShield;
      this.fx.blocks.push({ x: p.x, y: p.y });
      return;
    }
    // armor: raw × 15/(15+armor); negative armor capped at +50% extra damage
    // (denominator guarded so armor ≤ −15 can't flip the multiplier negative)
    const armor = p.stats.armor;
    let mult = armor >= 0
      ? CONFIG.ARMOR_K / (CONFIG.ARMOR_K + armor)
      : Math.min(1 + CONFIG.NEG_ARMOR_MAX_BONUS, CONFIG.ARMOR_K / Math.max(0.001, CONFIG.ARMOR_K + armor));
    if (t.key === 'glass') mult *= t.takeMult;
    let dmg = Math.max(1, Math.round(raw * mult));
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
      this._areaDamageEnemies(p.x, p.y, rt.radius, rt.damage, p);
    }
    if (p.hp <= 0) {
      // second wind item: cheat death once per floor
      if (p.hookAgg.secondWind !== null && !p.secondWindUsed) {
        p.secondWindUsed = true;
        p.hp = Math.max(1, Math.round(p.stats.maxHp * p.hookAgg.secondWind));
        p.invuln = 1.5;
        this.pushEvent({ k: 'toast', idx: p.idx, text: 'Second wind! Death refused.' });
        return;
      }
      p.hp = 0;
      p.downed = true;
      p.reviveP = 0;
      this.pushEvent({ k: 'downed', idx: p.idx });
      this.pushEvent({ k: 'sfx', s: 'downed' });
      if (this.livePlayers().every(q => q.downed)) this._finish(false);
    } else if (t.key === 'berserk_missing') {
      this._recomputeStats(p);
    }
  }

  // ---------------- projectiles / areas / contact ----------------

  _tickProjectiles(dt) {
    for (const pr of this.projPool) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.ttl -= dt;
      const expired = pr.ttl <= 0;
      const oob = pr.x < WALL - 10 || pr.x > W - WALL + 10 || pr.y < WALL - 10 || pr.y > H - WALL + 10;
      if (pr.friendly) {
        if (pr.lob) {
          if (expired || oob) { this._lobExplode(pr); this.projPool.release(pr); }
          continue;
        }
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
            this._hitEnemy(e, pr.dmg, { owner, crit: pr.crit, weaponDef: def, knock, baseDmg: pr.dmg }, Math.atan2(pr.vy, pr.vx));
            if (pr.summonBurn && e.active) this._applyBurn(e, pr.summonBurn.dps * (1 + owner.stats.elementalDamage / 100), pr.summonBurn.dur, owner);
            if (pr.pierce > 0) pr.pierce--; else { dead = true; }
          }
        });
        if (dead) this.projPool.release(pr);
      } else {
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
        this._hitEnemy(e, pr.dmg, { owner, crit: pr.crit, weaponDef: def, knock: def.knock * owner.hookAgg.knockMult, baseDmg: pr.dmg });
      }
    });
    if (def.puddle) {
      this.addZone({ x: pr.x, y: pr.y, r: def.aoe * 0.9, dps: def.puddle.dps * (1 + owner.stats.elementalDamage / 100), dur: def.puddle.dur, hurts: 'enemies', color: def.color, owner: pr.owner });
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
    this.fx.beams.push({ x1: x, y1: y, x2: x + Math.cos(a) * len, y2: y + Math.sin(a) * len, color: '#ff5d6c', w: width });
    for (const p of this.livePlayers()) {
      if (p.downed) continue;
      if (pointToSegDist(p.x, p.y, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len) < width / 2 + p.radius) {
        this.hurtPlayer(p, dmg, src);
      }
    }
  }

  beamDamageTick(x, y, a, len, width, dps, dt) {
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
            if (!p.downed && dist2(tg.x, tg.y, p.x, p.y) <= (tg.boom.radius + p.radius) * (tg.boom.radius + p.radius)) {
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
        if (d < v.pullR && d > 8 && p.char.trait.key !== 'kb_immune_big') { // Bulwark stands firm
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
      if (e.contactCd > 0) { e.contactCd -= dt; continue; }
      for (const p of this.livePlayers()) {
        if (p.downed || p.invuln > 0) continue;
        const rr = e.radius + p.radius;
        if (dist2(e.x, e.y, p.x, p.y) <= rr * rr) {
          e.contactCd = CONFIG.CONTACT_COOLDOWN;
          this.hurtPlayer(p, e.dmg, e);
          break;
        }
      }
    }
  }

  _tickHazards(dt) {
    if (!this.hazards) return;
    for (const hz of this.hazards) {
      if (hz.type === 'spikes') {
        const cyc = (this.time + hz.offset) % hz.period;
        hz.state = cyc < hz.safe ? 0 : cyc < hz.safe + hz.warn ? 1 : 2;
        if (hz.state === 2) {
          for (const p of this.livePlayers()) {
            if (p.downed || p.invuln > 0) continue;
            if (p.y > hz.y - hz.h / 2 && p.y < hz.y + hz.h / 2) this.hurtPlayer(p, hz.dmg, null);
          }
        }
      } else if (hz.type === 'lava') {
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
    this.pickups.push({ x: clamp(x, WALL + 10, W - WALL - 10), y: clamp(y, WALL + 10, H - WALL - 10), v: value, vx: 0, vy: 0, target: -1 });
  }

  _tickPickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const m = this.pickups[i];
      if (m.target === -1) {
        // find a puller
        for (const p of this.livePlayers()) {
          if (p.downed) continue;
          const r = CONFIG.PICKUP_RADIUS + p.hookAgg.pickupRadius;
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
          this._collectMaterial(p, m.v);
        }
      }
    }
  }

  _collectMaterial(p, v) {
    this.pushEvent({ k: 'sfx', s: 'pickup' });
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
      this.pushEvent({ k: 'levelUp', idx: p.idx });
      this.pushEvent({ k: 'sfx', s: 'levelup' });
    }
    const t = p.char.trait;
    if (t.key === 'mat_detonate') {
      this._areaDamageEnemies(p.x, p.y, t.radius, t.dmg, p, { silent: true });
      this.fx.booms.push({ x: p.x, y: p.y, r: t.radius * 0.6 });
    }
    for (const mh of p.hookAgg.materialHeal) if (Math.random() < mh.chance) this._heal(p, mh.amount);
    p.metaDirty = true;
  }

  _applyPerm(p, stats) {
    for (const k in stats) p.permStats[k] = (p.permStats[k] || 0) + stats[k];
    this._recomputeStats(p);
  }

  // ---------------- revive / clear / doors ----------------

  _tickRevive(dt) {
    for (const p of this.players) {
      if (p.gone || !p.downed) continue;
      let bestRate = 0;
      for (const q of this.livePlayers()) {
        if (q.downed || q === p) continue;
        if (dist2(p.x, p.y, q.x, q.y) < CONFIG.REVIVE_RADIUS * CONFIG.REVIVE_RADIUS) {
          bestRate = Math.max(bestRate, 1 + q.hookAgg.reviveSpeed);
        }
      }
      if (bestRate > 0) {
        p.reviveP += dt * bestRate / CONFIG.REVIVE_TIME;
        if (p.reviveP >= 1) this._revive(p, CONFIG.REVIVE_HP);
      } else {
        p.reviveP = Math.max(0, p.reviveP - dt / CONFIG.REVIVE_TIME);
      }
    }
  }

  _revive(p, frac) {
    p.downed = false;
    p.reviveP = 0;
    p.hp = Math.max(1, Math.round(p.stats.maxHp * frac));
    p.invuln = 1.2;
    this.pushEvent({ k: 'revived', idx: p.idx });
    this.pushEvent({ k: 'sfx', s: 'revive' });
  }

  _checkClear() {
    if (!this.roomLocked || this.over) return;
    if (this.boss) return; // boss clear handled in _bossDown
    if (this.pulseIdx < this.pulses.length) return;
    if (this.spawnQueue.length > 0 || this.enemyPool.count > 0) return;
    this._clearRoom();
  }

  _clearRoom() {
    this.roomLocked = false;
    const rs = this._rs();
    rs.cleared = true;
    this.pushEvent({ k: 'roomClear' });
    this.pushEvent({ k: 'sfx', s: 'door' });
    // magnet all materials to nearest players
    for (const m of this.pickups) {
      const p = this.nearestLivingPlayer(m.x, m.y);
      if (p) m.target = p.idx;
    }
    for (const p of this.livePlayers()) this._clearRewards(p);
    // elite room reward: rare+ pick for everyone
    if (this._room().kind === 'elite') {
      for (const p of this.livePlayers()) this._offerTreasure(p, 'elite');
    }
  }

  // Per-player room-clear resolution — used by combat clears AND boss kills so
  // harvesting/interest/heals/trait growths never skip a room.
  _clearRewards(p) {
    // auto-revive downed at 50%
    if (p.downed) this._revive(p, CONFIG.REVIVE_HP);
    // harvesting payout, then 5% (+bonus) growth
    const harv = Math.floor(p.stats.harvesting);
    if (harv > 0) {
      this._collectMaterial(p, harv);
      this.pushEvent({ k: 'toast', idx: p.idx, text: `Harvest +${harv}` });
    }
    const growth = Math.floor(harv * (CONFIG.HARVEST_GROWTH + p.hookAgg.harvestGrowth / 100));
    if (growth > 0) this._applyPerm(p, { harvesting: growth });
    // interest
    for (const it of p.hookAgg.interest) {
      const gain = Math.min(it.cap, Math.floor(p.materials * it.rate / 100));
      if (gain > 0) { this._collectMaterial(p, gain); this.pushEvent({ k: 'toast', idx: p.idx, text: `Interest +${gain}` }); }
    }
    // baseline breather: recover 10% of missing HP at each clear (+item heals)
    this._heal(p, Math.ceil((p.stats.maxHp - p.hp) * 0.1));
    if (p.hookAgg.roomClearHeal > 0) this._heal(p, p.hookAgg.roomClearHeal);
    // trait growths
    const t = p.char.trait;
    if (t.key === 'no_regen_growth') this._applyPerm(p, { maxHp: t.hpPerRoom });
    if (t.key === 'armor_growth') this._applyPerm(p, { armor: t.perRoom });
    if (t.key === 'momentum') this._applyPerm(p, { speed: t.speedPerRoom });
    // banked level-ups resolve now
    this._maybeOffer(p);
  }

  _bossDown(e) {
    this.boss = null;
    this.roomLocked = false;
    const rs = this._rs();
    rs.cleared = true;
    this.shake = 8;
    // sweep the battlefield: leftover adds/hazards must not harass the
    // post-boss shop or flip a floor-4 victory into a wipe during pendingEnd
    for (const add of [...this.enemyPool]) if (!add.boss) this._killEnemy(add, null);
    this.spawnQueue.length = 0;
    this.telegraphs = this.telegraphs.filter(tg => !tg.boom);
    this.zones = this.zones.filter(z => z.hurts !== 'players');
    this.vortexes.length = 0;
    for (const pr of this.projPool) if (!pr.friendly) this.projPool.release(pr);
    this.pushEvent({ k: 'bossDown', name: e.bossDef.name });
    this.pushEvent({ k: 'sfx', s: 'boom' });
    for (const m of this.pickups) { const p = this.nearestLivingPlayer(m.x, m.y); if (p) m.target = p.idx; }
    for (const p of this.livePlayers()) this._clearRewards(p); // boss rooms are room clears too
    if (this.floorNum >= CONFIG.FLOORS) {
      this.pendingEnd = 2.5; // brief beat to vacuum materials, then victory
    } else {
      this.hatch = { x: W / 2, y: H / 2 };
      for (const p of this.livePlayers()) this._openShop(p, 'boss');
    }
  }

  _tickDoors(dt) {
    if (this.roomLocked || this.over) return;
    if (this.doorGrace > 0) { this.doorGrace -= dt; this.doorCd = null; return; }
    const room = this._room();
    let want = null;
    if (this.hatch) {
      for (const p of this.livePlayers()) {
        if (!p.downed && dist2(p.x, p.y, this.hatch.x, this.hatch.y) < 60 * 60) { want = { kind: 'hatch' }; break; }
      }
    }
    if (!want && this._rs().cleared) {
      for (const p of this.livePlayers()) {
        if (p.downed) continue;
        const dir = doorwayAt(p, room);
        if (dir) { want = { kind: 'door', dir, target: room.doors[dir] }; break; }
      }
    }
    if (want) {
      if (!this.doorCd || this.doorCd.kind !== want.kind || this.doorCd.dir !== want.dir) {
        this.doorCd = { ...want, t: CONFIG.DOOR_COUNTDOWN };
        this.pushEvent({ k: 'sfx', s: 'door' });
      } else {
        this.doorCd.t -= dt;
        if (this.doorCd.t <= 0) {
          const cd = this.doorCd;
          this.doorCd = null;
          if (cd.kind === 'hatch') this._startFloor(this.floorNum + 1);
          else this._enterRoom(cd.target, cd.dir);
        }
      }
    } else this.doorCd = null;
  }

  // ---------------- offers: level-ups & treasure ----------------

  _maybeOffer(p) {
    if (p.gone || p.banked <= 0 || p.pendingOffer) return;
    const t = p.char.trait;
    const n = t.key === 'five_choices' ? t.choices : 4;
    const rng = subRng(this.seed, 'offer', this.floorNum, this.roomId, p.idx, p.level, p.banked);
    const picks = [];
    const used = new Set();
    let guard = 0;
    while (picks.length < n && guard++ < 80) {
      const rarity = this._rollRarity(rng, p.stats.luck, { common: 62, uncommon: 26, rare: 12, legendary: 0 });
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
    const rng = subRng(this.seed, 'treas', this.floorNum, this.roomId, p.idx);
    const picks = [];
    const used = new Set();
    let guard = 0;
    while (picks.length < 3 && guard++ < 120) {
      let rarity = this._rollRarity(rng, p.stats.luck);
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

  _rollRarity(rng, luck, weights = CONFIG.RARITY_WEIGHTS) {
    const lf = 1 + Math.max(-50, luck) / 100;
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
    if (!p.shop || p.shop.key !== `${this.floorNum}:${context}:${this.roomId}`) {
      // locked offers survive into the next shop even if the overlay was never
      // explicitly closed (e.g. the party walked out mid-browse)
      if (p.shop) p.shopLocksCarry = p.shop.stock.filter(s => s.locked && !s.sold);
      p.shopVisit++;
      const rng = subRng(this.seed, 'shop', this.floorNum, this.roomId, p.idx, p.shopVisit);
      p.shop = {
        key: `${this.floorNum}:${context}:${this.roomId}`,
        rng, rerolls: 0,
        freeLeft: (p.char.trait.key === 'shop_broker' ? 1 : 0) + p.hookAgg.freeRerolls,
        stock: [],
      };
      this._fillStock(p);
    }
    this._sendShop(p);
  }

  _fillStock(p) {
    const t = p.char.trait;
    const slots = t.key === 'legendary_shop' ? t.slots : CONFIG.SHOP_SLOTS;
    const shop = p.shop;
    const keep = shop.stock.filter(s => s.locked && !s.sold);
    const carry = p.shopLocksCarry.splice(0);
    shop.stock = [...keep, ...carry];
    while (shop.stock.length < slots) shop.stock.push(this._rollStockEntry(p, shop.rng));
    shop.stock.length = Math.min(shop.stock.length, slots);
  }

  _rollStockEntry(p, rng) {
    const t = p.char.trait;
    const floorScale = 1 + CONFIG.PRICE_FLOOR_SCALE * (this.floorNum - 1);
    let discount = 1 - p.hookAgg.shopDiscount / 100;
    if (t.key === 'shop_broker') discount *= 1 - t.discount / 100;
    const wantWeapon = t.key === 'weapons_only_shop' ? true
      : t.key === 'legendary_shop' ? false
      : rng.chance(CONFIG.SHOP_WEAPON_CHANCE);
    if (wantWeapon) {
      const def = rng.pick(WEAPONS);
      const tier = this._rollTier(rng);
      let price = Math.round(def.price * TIER_PRICE_MULT[tier - 1] * floorScale * discount * (t.key === 'weapons_only_shop' ? 1 - t.discountWeapons / 100 : 1));
      return { kind: 'weapon', id: def.id, tier, price: Math.max(1, price), sold: false, locked: false };
    }
    const rarity = t.key === 'legendary_shop' ? 'legendary' : this._rollRarity(rng, p.stats.luck);
    const pool = ITEMS.filter(it => it.rarity === rarity);
    const it = rng.pick(pool);
    const price = Math.max(1, Math.round(it.price * floorScale * discount));
    return { kind: 'item', id: it.id, price, sold: false, locked: false };
  }

  _rollTier(rng) {
    const T = [[80, 20, 0, 0], [50, 35, 15, 0], [20, 45, 30, 5], [5, 35, 40, 20]][this.floorNum - 1];
    const roll = rng.float() * 100;
    let acc = 0;
    for (let i = 0; i < 4; i++) { acc += T[i]; if (roll < acc) return i + 1; }
    return 1;
  }

  _rerollCost(p) {
    const base = CONFIG.REROLL_BASE + CONFIG.REROLL_PER_FLOOR * (this.floorNum - 1);
    if (p.shop.freeLeft > 0) return 0;
    if (p.rerollFlat) return base;
    return Math.round(base * Math.pow(CONFIG.REROLL_GROWTH, p.shop.rerolls));
  }

  _sendShop(p) {
    if (!p.shop) return;
    this.pushEvent({
      k: 'shop', idx: p.idx,
      stock: p.shop.stock.map(s => ({ kind: s.kind, id: s.id, tier: s.tier, price: s.price, sold: s.sold, locked: s.locked })),
      rerollCost: this._rerollCost(p),
      weaponsOnly: p.char.trait.key === 'weapons_only_shop',
    });
  }

  _addWeapon(p, id, tier, opts = {}) {
    const existing = p.weapons.find(w => w.id === id && w.tier === tier);
    if (existing && tier < 4) {
      existing.tier++;
      this.pushEvent({ k: 'toast', idx: p.idx, text: `Combined into ${WEAPON_BY_ID[id].name} ${['I', 'II', 'III', 'IV'][existing.tier - 1]}!` });
      this._refreshSummonsFor(p, id);
      p.metaDirty = true;
      return true;
    }
    if (p.weapons.length >= p.weaponSlots) return false;
    p.weapons.push({ id, tier, cd: 0.3 });
    const def = WEAPON_BY_ID[id];
    if (def.cls === 'summon') this._spawnSummon(p, id, tier);
    p.metaDirty = true;
    return true;
  }

  // ---------------- summons ----------------

  _spawnSummon(p, weaponId, tier, forceType) {
    const def = weaponId ? WEAPON_BY_ID[weaponId] : null;
    const sd = def ? def.summon : { hp: 25, dmg: 0, cd: 1, range: 0 };
    this.summons.push({
      owner: p.idx, weaponId, tier, type: forceType || (sd.type || 'turret'),
      x: p.x + (Math.random() * 60 - 30), y: p.y + (Math.random() * 60 - 30),
      hp: 1, maxHp: 1, cd: 0, orbitA: Math.random() * 6.28, dead: false, aimA: 0,
    });
    this._refreshSummonsFor(p, weaponId);
  }

  _summonStats(s) {
    const p = this.players[s.owner];
    const def = s.weaponId ? WEAPON_BY_ID[s.weaponId] : null;
    const t = p.char.trait;
    if (s.type === 'mirror') {
      const w0 = p.weapons[0];
      const wdef = w0 ? WEAPON_BY_ID[w0.id] : null;
      const eng0 = 1 + Math.max(-5, p.stats.engineering) * ENG_SCALE;
      const boost0 = 1 + p.hookAgg.summonDmg / 100;
      return {
        def: wdef, dmg: wdef ? wdef.dmg * TIER_MULT[w0.tier - 1] * t.factor * eng0 * boost0 : 0,
        cd: wdef ? Math.max(0.3, wdef.cd) : 1, range: wdef ? wdef.range + 120 : 0,
        hp: 35 * eng0 * (1 + p.hookAgg.summonHp / 100),
        projSpeed: wdef && wdef.projSpeed || 650, knock: 10,
      };
    }
    const sd = def.summon;
    const eng = 1 + Math.max(-5, p.stats.engineering) * ENG_SCALE;
    const boost = 1 + p.hookAgg.summonDmg / 100;
    let dmg = sd.dmg * TIER_MULT[s.tier - 1] * eng * boost;
    if (t.key === 'no_weapons_turrets') dmg *= 1 + (p.stats.damage / 100) * t.inheritDmg;
    let cd = sd.cd;
    if (t.key === 'structures_fast') cd /= t.rate;
    const hp = sd.hp * TIER_MULT[s.tier - 1] * eng * (1 + p.hookAgg.summonHp / 100);
    return { def, dmg, cd, range: sd.range, hp, projSpeed: sd.projSpeed || 650, knock: sd.knock || 0, burn: sd.burn, orbit: sd.orbit, speed: sd.speed };
  }

  _refreshSummonsFor(p, weaponId) {
    for (const s of this.summons) {
      if (s.owner !== p.idx) continue;
      if (weaponId && s.weaponId === weaponId) {
        const w = p.weapons.find(w2 => w2.id === weaponId);
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
      // positioning
      if (s.type === 'drone' || s.type === 'mirror') {
        s.orbitA += dt * 1.6;
        const R = st.orbit || 70;
        const tx = p.x + Math.cos(s.orbitA) * R, ty = p.y + Math.sin(s.orbitA) * R;
        s.x += (tx - s.x) * Math.min(1, dt * 8);
        s.y += (ty - s.y) * Math.min(1, dt * 8);
      } else if (s.type === 'ram') {
        const target = this._nearestEnemy(s.x, s.y, st.range + 100);
        if (target) {
          const a = angleTo(s.x, s.y, target.x, target.y);
          s.x += Math.cos(a) * (st.speed || 300) * dt;
          s.y += Math.sin(a) * (st.speed || 300) * dt;
        } else {
          const a = angleTo(s.x, s.y, p.x, p.y);
          if (dist2(s.x, s.y, p.x, p.y) > 90 * 90) { s.x += Math.cos(a) * 260 * dt; s.y += Math.sin(a) * 260 * dt; }
        }
        s.x = clamp(s.x, WALL + 12, W - WALL - 12);
        s.y = clamp(s.y, WALL + 12, H - WALL - 12);
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
      const target = this._nearestEnemy(s.x, s.y, st.range);
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
          summonBurn: st.burn || null, summonKnock: st.knock || 0,
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
        if (s.kind === 'item' && p.char.trait.key === 'weapons_only_shop') return this._buyResult(p, msg.slot, false, 'weapons only');
        if (s.kind === 'weapon') {
          if (p.weaponSlots === 0) return this._buyResult(p, msg.slot, false, 'no weapon slots');
          const ok = this._addWeapon(p, s.id, s.tier);
          if (!ok) return this._buyResult(p, msg.slot, false, 'slots full');
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
        const table = FLOOR_TABLES[this.floorNum - 1];
        for (let i = 0; i < 50; i++) {
          const pos = { x: WALL + 40 + Math.random() * (W - 2 * WALL - 80), y: WALL + 40 + Math.random() * (H - 2 * WALL - 80) };
          this.spawnEnemyById(table[(Math.random() * table.length) | 0], pos.x, pos.y, { noMats: false });
        }
        break;
      }
      case 'F2': for (const p of this.livePlayers()) this._collectMaterial(p, 200); break;
      case 'F3': {
        for (const e of [...this.enemyPool]) this._killEnemy(e, null);
        this.spawnQueue.length = 0;
        this.pulseIdx = this.pulses.length;
        if (this.roomLocked && !this.boss) this._clearRoom();
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
      t: 'snap', tick: this.tickNum, roomId: this.roomId,
      locked: this.roomLocked ? 1 : 0,
      cleared: this._rs().cleared ? 1 : 0,
      shake: +this.shake.toFixed(1),
      door: this.doorCd ? { kind: this.doorCd.kind, dir: this.doorCd.dir || null, t: +this.doorCd.t.toFixed(2) } : null,
      hatch: this.hatch ? [r(this.hatch.x), r(this.hatch.y)] : null,
      players: this.players.map(p => [p.idx, r(p.x), r(p.y), r(p.hp), p.stats.maxHp, p.downed ? 1 : 0, +p.reviveP.toFixed(2), r(p.shield), p.gone ? 1 : 0, +p.aimA.toFixed(2)]),
      enemies: [], projs: [], pickups: [], summons: [], tele: [], zones: [],
      beams: this.activeBeams,
      boss: this.boss ? { name: this.boss.bossDef.name, hp: this.boss.hp, max: this.boss.maxHp } : null,
      fx: this.fxBatch || this._emptyFx(),
      hazards: (this.hazards || []).map(h => h.type === 'spikes' ? ['s', r(h.y), r(h.h), h.state] : ['l', r(h.x), r(h.y), r(h.r)]),
    };
    for (const e of this.enemyPool) {
      snap.enemies.push([e.id, e.boss ? -1 : e.typeIdx, r(e.x), r(e.y), +(e.hp / e.maxHp).toFixed(2), (e.elite ? 1 : 0) | (e.boss ? 2 : 0) | (e.mini ? 4 : 0) | (e.hitFlash > 0 ? 8 : 0) | (e.fusing ? 16 : 0), r(e.radius)]);
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

  // per-player private meta (stats, inventory) — sent when dirty
  getMeta(p) {
    p.metaDirty = false;
    return {
      t: 'meta', idx: p.idx, level: p.level, xp: r2(p.xp), xpNext: p.xpNext,
      materials: p.materials, banked: p.banked,
      weapons: p.weapons.map(w => ({ id: w.id, tier: w.tier })),
      items: [...p.items],
      stats: { ...p.stats }, speed: p.stats.speed, weaponSlots: p.weaponSlots,
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
    e.x = clamp(e.x, WALL + e.radius * 0.6, W - WALL - e.radius * 0.6);
    e.y = clamp(e.y, WALL + e.radius * 0.6, H - WALL - e.radius * 0.6);
  }
}

// ---------------- module helpers ----------------

const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };

function r2(v) { return Math.round(v * 10) / 10; }

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

function doorAnchor(dir) {
  // far enough inside the room that no entry formation lands in the doorway
  // trigger zone (largest hitbox + wall + margin)
  switch (dir) {
    case 'n': return { x: W / 2, y: WALL + 110 };
    case 's': return { x: W / 2, y: H - WALL - 110 };
    case 'w': return { x: WALL + 110, y: H / 2 };
    case 'e': return { x: W - WALL - 110, y: H / 2 };
  }
  return { x: W / 2, y: H / 2 };
}

// player p standing in a doorway of room? returns dir or null
export function doorwayAt(p, room) {
  const gap = DOOR_W / 2;
  const m = 16; // how close to the wall counts as "in the doorway"
  if (room.doors.n && Math.abs(p.x - W / 2) < gap && p.y < WALL + p.radius + m) return 'n';
  if (room.doors.s && Math.abs(p.x - W / 2) < gap && p.y > H - WALL - p.radius - m) return 's';
  if (room.doors.w && Math.abs(p.y - H / 2) < gap && p.x < WALL + p.radius + m) return 'w';
  if (room.doors.e && Math.abs(p.y - H / 2) < gap && p.x > W - WALL - p.radius - m) return 'e';
  return null;
}

function buildHazards(room, seed, floorNum) {
  if (!room.hazard) return [];
  const rng = subRng(seed, 'haz', floorNum, room.id);
  const out = [];
  if (room.hazard === 'spikes') {
    const rows = rng.int(2, 3);
    for (let i = 0; i < rows; i++) {
      out.push({
        type: 'spikes', y: H * (0.28 + 0.44 * (i / Math.max(1, rows - 1))), h: 46,
        period: 4, safe: 2, warn: 0.8, offset: i * 1.3, dmg: 8, state: 0,
      });
    }
  } else {
    const n = rng.int(3, 5);
    const anchors = ['n', 's', 'w', 'e'].map(doorAnchor);
    for (let i = 0; i < n; i++) {
      // keep pools clear of the door entry formations
      for (let tries = 0; tries < 12; tries++) {
        const x = rng.range(WALL + 120, W - WALL - 120);
        const y = rng.range(WALL + 100, H - WALL - 100);
        const r = rng.range(55, 85);
        if (anchors.some(a => dist(a.x, a.y, x, y) < r + 90)) continue;
        out.push({ type: 'lava', x, y, r, dps: 7, acc: 0 });
        break;
      }
    }
  }
  return out;
}

function tempSafe(s, key, v) { s[key] += v; }
