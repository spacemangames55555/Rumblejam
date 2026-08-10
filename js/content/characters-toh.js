// The THRONES OF HEAVEN roster — 14 warriors, an alternate cast for the same
// game. Same schema as the classic roster: a stat spread on top of the base
// sheet (80 Vitality, everything else 0), one starting weapon, one signature
// trait implemented in game.js by `trait.key`.
//
// Every trait key here is new — no key in this file appears in
// characters-classic.js, so the two rosters can never collide in the engine's
// trait dispatch. Weapons, items, stats, maps and objectives are SHARED with
// the classic roster and are not forked.
//
// Several traits deliberately reuse an existing engine system rather than
// growing a parallel one:
//   crystal_infusion → the post-fight choice UI Facet's `prism` already drives
//   bonelord         → Cogsmith's `overseer` mounts/inheritance/carry logic
//   wildshape        → `prism` wholesale, reskinned, plus Greed per fusion
//   pack_tactics     → the per-floor free drone `free_drone_floor` grants

export const CHARACTERS_TOH = [
  { id: 'toh_blacksmith', name: 'Blacksmith', sym: '⛨', roles: ['tank', 'melee'],
    stats: { vitality: 70, grit: 8, tempo: -20 }, weapon: 'gravemaul',
    trait: {
      key: 'crystal_infusion', contactBase: 3, gritPct: 0.25, vitPct: 0.05, hitbox: 1.4,
      pyriteGrit: 2, quartzAtt: 4, calciteRec: 5, detonateEvery: 3, detonateRadius: 90,
    },
    desc: 'Crystal Infusion: cannot be pushed, but a far bigger target (hitbox ×1.4). Enemies touching you take 3 + 25% of Grit + 5% of Vitality contact damage. After every fight, infuse one crystal permanently — Iron Pyrite (+2 Grit), Prism Quartz (+4% Attunement) or Celestial Calcite (+5% Recovery). Infusions never cap. Every third Prism Quartz makes your contact damage detonate for attuned damage in a 90 radius.' },

  { id: 'toh_wizard', name: 'Wizard', sym: '♨', roles: ['status', 'support'],
    stats: { attunement: 15, reach: 20, ferocity: -10 }, weapon: 'magmalob',
    trait: {
      key: 'decree', intervalSec: 7, calamityBase: 14, plagueDps: 4, plagueDur: 3,
      plagueRadius: 120, miracleHeal: 8, miracleFer: 10, miracleDur: 4, miracleRadius: 220,
    },
    desc: 'Decree: every 7s (faster with Tempo) a Decree fires, alternating, starting with Calamity. Calamity deals 14 attuned damage to every enemy on screen and anything it kills spreads a plague — 4 attuned damage per second for 3s to enemies within 120. Miracle heals 8 and grants +10% Ferocity for 4s to every ally within 220 + half your Reach.' },

  { id: 'toh_necromancer', name: 'Necromancer', sym: '⚙', roles: ['summons'],
    stats: { ingenuity: 10 }, weapon: null,
    trait: {
      key: 'bonelord', mounts: 4, boneDustRadius: 200, boneDustRepair: 6,
      marrownautGritShare: 1.0, marrownautVitShare: 0.5,
    },
    desc: 'Bonelord: no weapons — 4 summon mounts instead. Summons inherit 100% of your stats on top of Ingenuity, combine in the shop, and can be picked up (E) and redeployed. Enemies dying within 200 drop bone-dust that repairs your most damaged summon by 6 HP. Combine all four mounts into one and it becomes the Marrownaut: while it stands you gain 100% of its Grit and 50% of its Vitality.' },

  { id: 'toh_druid', name: 'Druid', sym: '◐', roles: ['economy', 'summons'],
    stats: { greed: 5 }, weapon: 'fanblade',
    trait: {
      key: 'wildshape', offers: 3, permanentAt: 3, boonMult: 2,
      greedPerFusion: 1, qualityGreedScale: 1.5,
    },
    desc: 'Wildshape: entering every fight, pick 1 of 3 splices for that battle — better offers the more Greed you carry. Any splice taken 3 times fuses permanently, and every permanent fusion also grants +1 Greed.' },

  { id: 'toh_mage', name: 'Mage', sym: '◈', roles: ['ranged', 'control'],
    stats: { attunement: 8, reach: 30 }, weapon: 'coilgun',
    trait: {
      key: 'singularity', everyNth: 9, pullDur: 1.5, pullRadius: 110, pullSpd: 200,
      burstBase: 16, vulnPct: 25, vulnDur: 1.5, crystalRange: 90, crystalGrit: 5,
      // CRYSTALLIZE (§8.3): damage TAKEN accumulates crystal, capped like every
      // other engine, and reset at the door. `crystalPer` is crystal per point
      // of post-mitigation damage — 0.06 puts a Mage near the cap after eating
      // roughly 170, which is about a room's worth of standing in it.
      crystalPer: 0.06, crystalCap: 10,
    },
    desc: 'Singularity: every 9th attack collapses a singularity where it lands — enemies within 110 + half your Reach are dragged in for 1.5s, then it bursts for 16 attuned damage. Anything caught inside takes +25% damage from every source, allies included. Crystalblade: while an enemy is within 90 you gain +5 Grit and singularities form on you instead of on the target.' },

  { id: 'toh_bard', name: 'Bard', sym: '➶', roles: ['speed', 'support'],
    stats: { tempo: 15, vitality: -10 }, weapon: 'twinlash',
    trait: {
      key: 'rhythm', windowSec: 1.5, maxStacks: 10, tempoPer: 4, ferPer: 3,
      ensembleRadius: 160, ensembleShare: 0.5, soloMult: 2,
    },
    desc: 'Rhythm: keep attacking with no gap longer than 1.5s and stacks build to 10, each worth +4% Tempo and +3% Ferocity. Miss the window and every stack drops at once. Ensemble: with an ally within 160 + half your Reach they receive half your stack bonuses. Alone, your own bonuses are doubled instead.' },

  { id: 'toh_witch_doctor', name: 'Witch Doctor', sym: '〜', roles: ['sustain', 'status'],
    stats: { recovery: 6, attunement: 5 }, weapon: 'bogflask',
    trait: {
      key: 'voodoo_link', mirrorPct: 0.35, bindRange: 900, stitchTargets: 2,
      stitchRadius: 150, stitchDur: 3, deathHealPct: 0.05,
      // THE DOLL ENGINE (§8.3): the debt banked in the doll, expressed as capped
      // stacks so a `scaleWith` step reads a legible number instead of raw
      // damage. `dollPer` is stacks per point mirrored in; the cap matches every
      // other engine's. `p.voodooDmg` already accumulated this — it was only ever
      // read by the death heal.
      dollPer: 0.05, dollCap: 10,
    },
    desc: 'Voodoo Link: the nearest enemy is bound to your doll and rebound whenever it dies or drifts away. 35% of all damage you deal to anything is mirrored onto the bound enemy through walls and across the map. When it dies the link stitches to 2 more enemies within 150 for 3s, and you heal for 5% of everything that enemy took while bound.' },

  { id: 'toh_samurai', name: 'Samurai', sym: '⚔', roles: ['melee'],
    stats: { ferocity: 8, vitality: 10 }, weapon: 'rustcleaver',
    trait: {
      key: 'three_stances', ironGrit: 6, ironRefundPct: 0.2, precisionBleedDur: 4,
      precisionBleedFerScale: 0.15, flowTempoPer: 8, flowMax: 5, swapCooldown: 0.5,
    },
    desc: 'Three Stances: swap freely (Q, or the stance button on touch) with a half-second cooldown. IRON — +6 Grit, and a fifth of everything your Grit absorbs is banked onto your next attack. PRECISION — your first hit on any enemy crits and bleeds it for 4s at 15% of your Ferocity per second. FLOW — every consecutive hit on a NEW enemy grants +8% Tempo up to 5 stacks; hitting the same enemy twice in a row resets it.' },

  { id: 'toh_monk', name: 'Monk', sym: '𖤓', roles: ['dodge', 'sustain'],
    stats: { reflex: 12, recovery: 6, grit: 2 }, weapon: 'twinlash',
    trait: {
      key: 'karma', karmaCap: 40, karmaPct: 1.0, spiritDur: 3, spiritFactor: 0.5, spiritRegen: 2,
    },
    desc: 'Karma: damage you take is stored, up to 40, and your next attack releases all of it as bonus damage. Astral Projection: dodging leaves a spirit at your feet for 3s that copies every attack you make at half damage and regenerates 2 HP per second while it stands. Dodging again refreshes it rather than spawning a second.' },

  { id: 'toh_assassin', name: 'Assassin', sym: '☽', roles: ['crit', 'economy'],
    stats: { ferocity: 12, greed: 8, vitality: -25 }, weapon: 'vaultspike',
    trait: {
      key: 'contract', payoutBase: 5, payoutGreedScale: 1.0, ferPerContract: 15,
      // D-34: how many closures PAY per room. The mark still re-arms without
      // limit — this caps the money, not the Ferocity ramp. See tohOnKill.
      payoutsPerRoom: 3,
      openerCritMult: 3, vanishDur: 1.2, remarkDelay: 3,
    },
    desc: 'Contract: one enemy per fight is marked — an elite or boss if there is one, otherwise the healthiest thing alive. Killing it pays 5 + your Greed in materials and grants +15% Ferocity for the rest of the fight, stacking with every contract closed. A new mark appears 3s later. You also never crit at random: granted crits deal ×3, your first hit on any full-health enemy is always a crit, and every kill makes you untargetable for 1.2s.' },

  { id: 'toh_priest', name: 'Priest', sym: '✚', roles: ['support', 'sustain'],
    stats: { recovery: 8, vitality: 10 }, weapon: 'sparkbolt',
    trait: {
      key: 'grace_and_judgment', graceThreshold: 25, shieldBase: 12, shieldRecScale: 1.0,
      reflectPct: 0.3, reviveBoost: 0.5, partyVitPerRevive: 3, targetRadius: 200,
    },
    desc: 'Grace and Judgment: every point of healing you cause, to anyone, becomes Grace. At 25 it spends itself — shielding the most injured ally within 200 + half your Reach (or you, alone) for 12 scaled by Recovery, and smiting the nearest enemy for attuned damage equal to that shield. Shields reflect 30% of what they absorb back at the attacker. You revive 50% faster, and every revive grants the whole party +3 permanent Vitality.' },

  { id: 'toh_savage', name: 'Savage', sym: '⽕', roles: ['melee'],
    stats: { ferocity: 10, vitality: 10 }, weapon: 'gravemaul',
    trait: {
      key: 'blood_dance', heatPer: 8, heatMax: 120, heatDecaySec: 3,
      bloodPerMissing: 0.8, leechPct: 0.08, heavyBonus: 0.15, heavyCd: 1.5,
    },
    desc: 'Blood Dance: every attack that connects grants +8% Ferocity up to +120%, and all of it falls off 3s after your last connecting hit. On top of that: +0.8% Ferocity for every 1% of health you are missing, 8% of all damage you deal comes back as healing, and any weapon with a base cooldown of 1.5s or longer hits 15% harder.' },

  { id: 'toh_hunter', name: 'Hunter', sym: '⬡', roles: ['summons', 'ranged'],
    stats: { ingenuity: 5, reach: 20 }, weapon: 'pebbleshot',
    trait: {
      key: 'pack_tactics', freeBeastPerFloor: 1, maxBeasts: 4, alphaRadius: 120,
      // The beast's own bite, sized for a unit the class is GIVEN — four of
      // them by floor 4, at no cost in points, gold or slots. It borrowed the
      // Guard Drone's 6-on-0.55s until now, which made the free half of the
      // class out-damage the paid half.
      beastDmg: 4, beastCd: 1.2,
      alphaMinBeasts: 2, alphaFer: 20, alphaTempo: 10,
      marksmanRadius: 250, marksmanPierce: 1, marksmanDmgPerBeast: 8,
    },
    desc: 'Pack Tactics: a free beast joins you at the start of every floor, up to four. ALPHA — with 2 or more beasts within 120 of you, you and every beast gain +20% Ferocity and +10% Tempo. MARKSMAN — with no beast within 250 of you, your shots pierce one more target and hit 8% harder per living beast. A beast combined in the shop counts as two.' },

  { id: 'toh_sundian', name: 'Sundian', sym: '≋', roles: ['status', 'speed'],
    stats: { attunement: 10, tempo: 8, vitality: -10 }, weapon: 'pikefang',
    trait: {
      key: 'coral_growth', everyNth: 4, nodeDur: 8, nodeRadius: 60, nodeSlowPct: 35,
      nodeDps: 5, nodeCap: 8, linkRange: 100, wallHp: 40,
      dashRefreshTempo: 15, dashRefreshDur: 2,
    },
    desc: 'Coral Growth: every 4th attack plants a coral node where it lands, for 8s. Nodes slow enemies within 60 by 35% and burn them for 5 attuned damage a second. Two nodes within 100 of each other grow a coral wall with 40 HP that stops enemies and their shots — but never yours. Walking through your own node refreshes it and grants +15% Tempo for 2s. Eight nodes at once, no more.' },
];

export const TOH_BY_ID = Object.fromEntries(CHARACTERS_TOH.map(c => [c.id, c]));

// Sprite ids — see characters-classic.js. Cosmetic, never networked.
for (const c of CHARACTERS_TOH) c.spriteId = `char.${c.id}`;
