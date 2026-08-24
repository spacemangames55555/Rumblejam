# BLACKSMITH — RUMBLEJAM CONVERSION (30 skills)

Mechanical fields carried over from the code export unchanged. The eight
judgment fields are authored below. Rulings that apply across the class are
stated once here rather than repeated in thirty blocks.

---

## CLASS ENGINE — FORGE HEAT

The Blacksmith has no engine in Thrones of Heaven; a human pressed buttons and
that was the engine. RumbleJam needs one, because "melee bruiser" in a game
where touching enemies kills you is a contradiction unless the class is *paid*
for standing in it.

**FORGE HEAT, 0–100.** Starts each run at 0.

Feeds:
- Taking a hit: **+8**
- Blocking a hit: **+6** (so block-chance passives are heat generators, not just mitigation)
- Any melee-CAST skill firing: **+4** (per cast, not per target)
- Counter Attack proccing: **+3**

Consumes:
- The three Crystals will not fire below **50 heat**, and zero it on use
- Execute's finisher multiplier requires **20 heat**, and spends it
- Crazed converts heat to duration: **+1s per 10 heat held**, spends all of it

Decays **3/sec** when no enemy is within 200px. So heat is not a slow bank —
it is a reading of how bad the last few seconds were. The Blacksmith's power
spikes arrive exactly when he is losing, which is the whole class.

This makes the tank tree feed the offense tree instead of competing with it
for slots, and it gives every one of the eight judgment fields something
concrete to point at.

---

## PORT RULINGS (proposed — overrule any of these)

**1. `basicHitCount` has no referent.** Double Swing (2), Triple Swing (3),
and Prism Quartz (4) all modify a basic attack RumbleJam does not have.
Ruling: they become **multi-strike** — every melee-CAST skill fires N times
per activation, ~120ms apart, each swing rolling its own hits. This preserves
what they meant (the smith swings more) and makes them the melee build's
scaling spine rather than dead nodes. They do not stack additively; the
highest owned value wins, so Triple Swing supersedes Double Swing. If you'd
rather they stack to 5, say so — I built the numbers assuming they don't.

**2. Auras occupy a slot and are always-on.** Dominance and Calcite's pulse
are the two aura-bearing Blacksmith skills. Ruling: an aura passive costs one
of the eight slots, has no trigger, and ranks into **radius** rather than
magnitude, since radius is what the player can feel while moving.

**3. Transformations auto-fire; no toggles.** All three Crystals become
trigger-fired timed forms. They keep the 12s duration and 60s cooldown, and
they gate on heat (ruling 1 above), which means they read as earned rather
than as a timer expiring. Stance exclusivity is preserved: only one Crystal
form can be active, and a second will not fire while another runs.

**4. Zero-damage actives keep their slot cost and pay for it in control.**
Intimidate deals nothing. Ruling: it stays as-is and ranks into duration and
radius. In a game where survival is the player's only job, a five-second
half-speed field is not a weak skill, and it should not be apologised for by
grafting damage onto it.

**5. Scene-keyed passives are authored from their declared text, flagged.**
Counter Attack, Iron Will, and Dominance have empty stats blocks; their real
behavior lives in MainScene. I've authored against the declared descriptions
and marked each one, so RumbleJam can verify against the derived behavior in
`01-actions` before shipping.

**6. Rank scaling baseline.** Damage skills add roughly **15% of base per
rank**. Riders (stun, slow, knockback) add duration every third rank, so a
rank-9 stun is meaningfully longer than rank-1 without becoming permanent
crowd control by rank 20. Where a skill's identity is breadth rather than
punch, ranks buy targets or radius instead — noted per skill.

---

## TREE: TANK

Role read: **the threat sink.** In co-op this tree is what a WoW tank is —
it takes the hits so the ranged classes don't. Solo, it is what lets the
Blacksmith stand in the swarm long enough for Forge Heat to matter. Every
skill here either generates heat or spends it on staying alive.

---

SKILL NAME:           Shield Bash
CLASS / TREE / TIER:  blacksmith / Tank / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r70)
RANGE:                melee short (70px)
TARGETS:              cap 4 (was uncapped)
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 medium (7000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               stun 1000ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (70px)
THREAT:               high
--- growth ---
RANK ADDS:            +4 damage; +150ms stun every 3rd rank
--- identity ---
ENGINE:               feeds — +4 heat on cast, +2 per enemy stunned
COST:                 fires only when something is already on top of you; a
                      player who kites perfectly never sees it go off
VISUAL:               shield drives forward, dust ring at the rim, struck
                      enemies flash white and lock rigid
FLAVOR:               The first thing he learned was not the hammer. It was
                      that a shield is a tool with a working face, and that
                      the working face goes outward.

SKILL NAME:           Grit
CLASS / TREE / TIER:  blacksmith / Tank / tier_code 1
TYPE:                 passive
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                n/a
RANGE:                n/a
TARGETS:              n/a
--- output ---
DAMAGE TIER:          n/a
PACE:                 n/a
DOMAIN:               physical
--- effects ---
RIDERS:               stat mods: maxHPMult +0.20
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +8% max HP per rank (not damage)
--- identity ---
ENGINE:               feeds indirectly — more HP is more hits survived, and
                      every hit is +8 heat
COST:                 a slot that kills nothing; pure survivability in a game
                      where the clock is enemies killed per second
VISUAL:               heavier silhouette, apron doubled at the chest
FLAVOR:               Forge work is mostly standing. Standing near heat,
                      standing under weight, standing when the sensible thing
                      would be to step back. He is very good at standing.

SKILL NAME:           Iron Hide
CLASS / TREE / TIER:  blacksmith / Tank / tier_code 2
TYPE:                 passive
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                n/a
RANGE:                n/a
TARGETS:              n/a
--- output ---
DAMAGE TIER:          n/a
PACE:                 n/a
DOMAIN:               physical
--- effects ---
RIDERS:               stat mods: damageReduction +0.15
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +3% damage reduction per rank, diminishing above 60%
                      (not damage)
--- identity ---
ENGINE:               neutral — reduces damage taken, which also reduces the
                      +8 heat events; deliberately in tension with the engine
COST:                 the more of it you take, the less heat you build; a
                      pure-mitigation Blacksmith never reaches his Crystals
VISUAL:               skin takes a dull grey sheen at the forearms, spreading
                      with rank
FLAVOR:               Quench a blade wrong and it shatters. Quench a man
                      wrong, often enough, over years, and he does not.

SKILL NAME:           Shove
CLASS / TREE / TIER:  blacksmith / Tank / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r130 on caster)
RANGE:                melee long (130px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (6)
PACE:                 slow (9000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               knockback 130px; knockback-stun 250ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ enemies within 130px)
THREAT:               some
--- growth ---
RANK ADDS:            +20px knockback distance and +1px radius per rank
                      (not damage — this is the panic button, not a weapon)
--- identity ---
ENGINE:               feeds — +4 heat on cast
COST:                 six damage. It buys a second and a half of floor space
                      and nothing else; against a single large enemy it is a
                      wasted slot
VISUAL:               a low outward shockwave at ankle height, enemies
                      skidding back on their heels
FLAVOR:               Room to work. That is all he has ever asked for and
                      rarely been given.

SKILL NAME:           Double Block
CLASS / TREE / TIER:  blacksmith / Tank / tier_code 4
TYPE:                 passive
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                n/a
RANGE:                n/a
TARGETS:              n/a
--- output ---
DAMAGE TIER:          n/a
PACE:                 n/a
DOMAIN:               physical
--- effects ---
RIDERS:               stat mods: blockChance +0.25, blockReduction 0.80
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +4% block chance per rank (not damage)
--- identity ---
ENGINE:               feeds strongly — every block is +6 heat, so this is the
                      single best heat generator in the class
COST:                 variance. Block is a roll; a bad string of rolls kills
                      you in a way that flat damage reduction never would
VISUAL:               brief flare of sparks off the shield face on each block
FLAVOR:               Two shields is not twice as much shield. It is one
                      shield and one answer to the question of what happens
                      when the first one is busy.

SKILL NAME:           Shield Swing
CLASS / TREE / TIER:  blacksmith / Tank / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r150)
RANGE:                range short (150px)
TARGETS:              cap 6, +1 per 4 ranks
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 medium (6000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (3+ enemies within 150px)
THREAT:               high
--- growth ---
RANK ADDS:            +5 damage; +1 target every 4th rank
--- identity ---
ENGINE:               feeds — +4 heat on cast
COST:                 no rider at all. It is damage and nothing else, which
                      in a tank tree means it competes with skills that
                      actually keep you alive
VISUAL:               a full-body turn, shield edge sweeping wide at hip
                      height
FLAVOR:               The shield weighs what it weighs whether he is hiding
                      behind it or not. Might as well spend the weight.

SKILL NAME:           War Chant
CLASS / TREE / TIER:  blacksmith / Tank / tier_code 6
TYPE:                 buff
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (16000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               timed 8000ms — damageReduction +0.20, regenPerSec 6
DOT:                  none
AFFECTS:              self (co-op: allies within 200px receive the
                      regenPerSec component at half value — see note)
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (60%)
THREAT:               none
--- growth ---
RANK ADDS:            +1 regen/sec and +400ms duration per rank (not damage)
--- identity ---
ENGINE:               neutral
COST:                 a sixteen-second cooldown for eight seconds of value;
                      if it fires at 59% and the real danger comes at 20%,
                      it is not there
VISUAL:               a low sustained note, dust vibrating off the ground in
                      rings, the character's outline steadying
FLAVOR:               Not a song. A working rhythm, the kind that keeps a
                      hammer landing in the same place for six hours. It
                      happens to also keep a man upright.

> **Co-op note:** War Chant is the only Blacksmith skill I extended to
> allies. ToH has no party support on this class, so this is invented, not
> derived. It gives the tank one reason to position near the group, which
> the role needs and the tree otherwise lacks. Cut it if you'd rather
> Blacksmith stay purely selfish.

SKILL NAME:           Plow
CLASS / TREE / TIER:  blacksmith / Tank / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                line (movement path)
RANGE:                range medium (320px)
TARGETS:              each enemy in path once, uncapped
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 slow (10000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               knockback 110px (continuous shove-aside along the dash);
                      caster is displaced 320px — see COST
DOT:                  none
AFFECTS:              enemies, self (movement)
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (90px) — fires away from the
                      densest cluster, not toward it
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +25px dash distance every 3rd rank
--- identity ---
ENGINE:               feeds — +4 heat on cast, +2 per enemy plowed
COST:                 it moves you 320px whether you wanted to go there or
                      not. In a small room that is most of the floor, and an
                      auto-fired dash into a wall is a wasted cooldown
VISUAL:               head down, shoulder first, bodies folding aside off the
                      shield rim, a straight furrow of disturbed ground
FLAVOR:               He does not charge so much as decide to be somewhere
                      else and refuse to negotiate about the route.

> **Ruling on auto-fired movement:** Plow, Charge, and every dash in the
> game move the player, and the player's only job in RumbleJam is moving.
> An auto-fired dash that yanks you into a wall or a swarm is the single
> most likely thing to make this port feel bad. My ruling: **movement
> skills resolve their direction away from the densest enemy cluster**,
> never toward it, and suppress entirely if the destination is inside a
> wall. Flagging it loudly because it applies to eight classes and it is
> the one conversion I'd most want playtested early.

SKILL NAME:           Dual Shield
CLASS / TREE / TIER:  blacksmith / Tank / tier_code 8
TYPE:                 passive
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                n/a
RANGE:                n/a
TARGETS:              n/a
--- output ---
DAMAGE TIER:          n/a
PACE:                 n/a
DOMAIN:               physical
--- effects ---
RIDERS:               stat mods: damageReduction +0.12, blockChance +0.15
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2% damage reduction and +2% block chance per rank
                      (not damage)
--- identity ---
ENGINE:               feeds — the block component is +6 heat per proc
COST:                 the ninth-tier slot of the survival tree, competing
                      directly with the Crystal one tier above it
VISUAL:               a second shield strapped at the off arm, both faces
                      scarred differently
FLAVOR:               One for the thing in front of him. One for the thing
                      he has not turned around to look at yet.

SKILL NAME:           Crystal of Celestial Calcite
CLASS / TREE / TIER:  blacksmith / Tank / tier_code 9
TYPE:                 transformation
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none (aura while active — circle r150 on caster)
RANGE:                n/a
TARGETS:              aura: uncapped in r150
--- output ---
DAMAGE TIER:          low (8 per pulse, 500ms pulses)
PACE:                 very slow (60000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               form 12000ms — damageReduction +0.85, maxHPMult +0.50;
                      aura 8 damage / r150 / 500ms pulse
DOT:                  none
AFFECTS:              self + enemies (aura)
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (35%) — gated on 50 Forge Heat
THREAT:               high
--- growth ---
RANK ADDS:            +2 aura damage per rank; +10px aura radius every 2nd
                      rank; +500ms duration every 4th rank
--- identity ---
ENGINE:               consumes — requires 50 heat, zeroes it on use
COST:                 twelve seconds out of sixty, and the heat gate means a
                      Blacksmith who has been playing safely cannot fire it
                      at all. It is a reward for having had a bad minute
VISUAL:               the body sheathes in pale banded crystal, movement
                      slows visibly, a soft white pulse washing outward twice
                      a second
FLAVOR:               There is a kind of stone that grows in the dark, one
                      patient layer at a time, and cannot be hurried. He has
                      always understood it better than he understood people.

---

## TREE: OFFENSE

Role read: **the DPS conversion.** This tree is where Forge Heat gets spent
and where the multi-strike passives turn every melee skill in the other two
trees into a bigger number. It is also the tree that will kill you — Crazed
carries negative damage reduction and Prism Quartz has no defensive component
at all.

---

SKILL NAME:           Bash
CLASS / TREE / TIER:  blacksmith / Offense / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r64)
RANGE:                melee short (64px)
TARGETS:              cap 3, +1 per 5 ranks
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 fast (2500ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (64px)
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +1 target every 5th rank
--- identity ---
ENGINE:               feeds — +4 heat on cast; at 2.5s this is the class's
                      primary heat pump
COST:                 64px is nothing. This skill requires the player to be
                      in the worst position in the game, constantly, and it
                      is the tier-1 node, so it teaches that lesson early
VISUAL:               a short flat hammer stroke, no wind-up, sparks off the
                      point of contact
FLAVOR:               Not a technique. A habit, worn into the shoulder over
                      twenty thousand repetitions, that happens to work on
                      things that are not iron.

SKILL NAME:           Berserker's Edge
CLASS / TREE / TIER:  blacksmith / Offense / tier_code 1
TYPE:                 passive
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                n/a
RANGE:                n/a
TARGETS:              n/a
--- output ---
DAMAGE TIER:          n/a
PACE:                 n/a
DOMAIN:               physical
--- effects ---
RIDERS:               stat mods: damageMult +0.20
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +6% damage multiplier per rank — applies to every
                      damage source the character has
--- identity ---
ENGINE:               neutral
COST:                 none, honestly. This is the most efficient slot in the
                      class and every Blacksmith build should take it, which
                      is a design smell worth watching — see note
VISUAL:               the hammer head glows faintly orange between swings and
                      never fully cools
FLAVOR:               The edge is not on the hammer. There is no edge on a
                      hammer. He means something else and does not explain it.

> **Flag:** a flat global damage multiplier with unlimited ranks is the one
> Blacksmith node that could invalidate the rest of the tree — at rank 30 it
> is +200% on everything. If you want the slot economy to stay interesting,
> either cap its rank scaling or make it multiply melee only. My numbers
> assume it stays global; say the word and I'll narrow it.

SKILL NAME:           Overswing
CLASS / TREE / TIER:  blacksmith / Offense / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r84)
RANGE:                melee long (84px)
TARGETS:              cap 5
--- output ---
DAMAGE TIER:          high (70)
PACE:                 slow (8000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               wind-up 600ms telegraph
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (3+ within 84px)
THREAT:               high
--- growth ---
RANK ADDS:            +10 damage
--- identity ---
ENGINE:               feeds — +4 heat on cast
COST:                 600ms of wind-up during which the player is committed
                      and the swarm is moving. Auto-fired, that wind-up
                      resolves wherever the enemies were, not where they are
VISUAL:               hammer goes fully overhead, a beat of stillness, then
                      the ground cracks white on impact
FLAVOR:               Everything he knows about killing is contained in the
                      pause before this swing, and the pause is the part he
                      had to be taught.

SKILL NAME:           Double Swing
CLASS / TREE / TIER:  blacksmith / Offense / tier_code 3
TYPE:                 passive
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                n/a
RANGE:                n/a
TARGETS:              n/a
--- output ---
DAMAGE TIER:          n/a
PACE:                 n/a
DOMAIN:               physical
--- effects ---
RIDERS:               multi-strike 2 — every melee-CAST skill fires twice per
                      activation, 120ms apart, each swing rolling its own
                      hits (converted from basicHitCount: 2 — see ruling 1)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            −8ms between swings per rank, floor 60ms (not damage;
                      tighter swings mean fewer enemies walk out between them)
--- identity ---
ENGINE:               feeds heavily — each swing counts as a melee connect,
                      so multi-strike doubles the heat pump
COST:                 worthless in a build with no melee skills slotted. It
                      is the node that decides whether your Blacksmith is
                      melee or not, and there is no partial commitment
VISUAL:               the swing has a second beat to it, a returning stroke
                      on the backhand
FLAVOR:               One to set the shape. One to mean it.

SKILL NAME:           Crazed
CLASS / TREE / TIER:  blacksmith / Offense / tier_code 4
TYPE:                 buff
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (18000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               timed 8000ms — attackSpeedMult +0.60, damageMult +0.40,
                      damageReduction −0.30
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (6+ within 200px)
THREAT:               none
--- growth ---
RANK ADDS:            +8% attack speed per rank; the −30% damage reduction
                      penalty does NOT scale down with rank
--- identity ---
ENGINE:               consumes — spends all held heat, +1s duration per 10
                      heat. At 100 heat this is an 18s window on an 18s
                      cooldown, which is the class's ceiling and should be
                      hard to reach
COST:                 thirty percent more incoming damage for eight seconds,
                      auto-fired, in a game where one contact can end a run.
                      This is the most dangerous node in the class and it
                      should stay that way
VISUAL:               vision edges redden, the character's movement animation
                      loses its economy, swings overshoot and get dragged back
FLAVOR:               There is a temperature past which the metal stops
                      arguing. He has found the equivalent in himself and
                      does not like what it costs to get there.

SKILL NAME:           Windmill
CLASS / TREE / TIER:  blacksmith / Offense / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r135 on caster)
RANGE:                melee long (135px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 medium (6000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 135px)
THREAT:               high
--- growth ---
RANK ADDS:            +4 damage; +5px radius every 3rd rank
--- identity ---
ENGINE:               feeds — +4 heat on cast
COST:                 no control component whatsoever. It hits everything
                      around you and then everything around you is still
                      around you
VISUAL:               a full rotation, hammer at full extension, a flat ring
                      of displaced dust at the radius edge
FLAVOR:               The simplest answer to being surrounded, and the one
                      that requires the least thinking, which is why he
                      reaches for it when there is no time to think.

SKILL NAME:           Hammer Throw
CLASS / TREE / TIER:  blacksmith / Offense / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (380px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (38)
PACE:                 medium (7000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 380px
THREAT:               some
--- growth ---
RANK ADDS:            +6 damage; at rank 5 the hammer pierces 1 additional
                      enemy, +1 pierce every 5 ranks thereafter
--- identity ---
ENGINE:               neutral — not a melee connect, generates no heat
COST:                 the only ranged skill in the class, and it does not
                      feed the engine. A Blacksmith who leans on it is a
                      worse Blacksmith with a longer reach
VISUAL:               the hammer leaves his hand end over end and returns to
                      it on a hard snap
FLAVOR:               He hates throwing it. A tool that is not in your hand
                      is a tool you do not have, and for the second and a
                      half it is in the air he is simply a man in an apron.

SKILL NAME:           Triple Swing
CLASS / TREE / TIER:  blacksmith / Offense / tier_code 7
TYPE:                 passive
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                n/a
RANGE:                n/a
TARGETS:              n/a
--- output ---
DAMAGE TIER:          n/a
PACE:                 n/a
DOMAIN:               physical
--- effects ---
RIDERS:               multi-strike 3 — every melee-CAST skill fires three
                      times per activation, 120ms apart (converted from
                      basicHitCount: 3). Supersedes Double Swing; does not
                      stack with it
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            −8ms between swings per rank, floor 60ms (not damage)
--- identity ---
ENGINE:               feeds heavily — triples the melee heat pump
COST:                 it makes Double Swing a dead slot the moment you take
                      it, so the tree quietly asks you to respec a node you
                      already paid for. Deliberate: that is the tier-8
                      upgrade tax
VISUAL:               three beats, the third landing heavier than the first two
FLAVOR:               Set the shape. Mean it. Finish it.

SKILL NAME:           Bloodlust
CLASS / TREE / TIER:  blacksmith / Offense / tier_code 8
TYPE:                 passive
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                n/a
RANGE:                n/a
TARGETS:              n/a
--- output ---
DAMAGE TIER:          n/a
PACE:                 n/a
DOMAIN:               physical
--- effects ---
RIDERS:               stat mods: lifestealPct 0.12
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2% lifesteal per rank (not damage)
--- identity ---
ENGINE:               neutral, but strongly synergistic — multi-strike turns
                      12% lifesteal into 36% effective sustain per activation
COST:                 scales off damage dealt, so it is worth nothing in the
                      moment you most need healing: when you are not hitting
                      anything
VISUAL:               a thin red draw from struck enemies toward the hammer
                      haft
FLAVOR:               Azazel taught the making of blades and taught, in the
                      same breath, what blades are for. The second lesson
                      took longer to sink in and has never fully left.

SKILL NAME:           Crystal of Prism Quartz
CLASS / TREE / TIER:  blacksmith / Offense / tier_code 9
TYPE:                 transformation
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (60000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               form 12000ms — damageMult +0.60, attackSpeedMult +0.60,
                      multi-strike 4 (converted from basicHitCount: 4;
                      supersedes Triple Swing for the duration)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (8+ within 250px) — gated on 50 Forge Heat
THREAT:               none
--- growth ---
RANK ADDS:            +8% damage multiplier per rank; +500ms duration every
                      4th rank
--- identity ---
ENGINE:               consumes — requires 50 heat, zeroes it on use
COST:                 no defensive component at all. Twelve seconds of the
                      highest damage in the class while being exactly as
                      fragile as you were, in the middle of the biggest
                      crowd you have seen
VISUAL:               the body facets into clear refracting quartz, each
                      swing throwing split light in four directions
FLAVOR:               Light does not bend because it wants to. It bends
                      because the stone gives it no other route, and by then
                      it is going very fast in a direction it did not choose.

---

## TREE: CONTROL

Role read: **the off-tank / debuffer.** This is where the Blacksmith stops
being a bruiser and becomes the reason the swarm is slow, weak, and looking
at him. In co-op it is the peel tree. Solo it is what buys the seconds the
other two trees spend.

---

SKILL NAME:           Charge
CLASS / TREE / TIER:  blacksmith / Control / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                line (movement path)
RANGE:                range medium (300px)
TARGETS:              each enemy in path once, uncapped
--- output ---
DAMAGE TIER:          medium (22)
PACE:                 slow (9000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               knockdown — stun 1200ms per enemy hit; caster displaced
                      300px
DOT:                  none
AFFECTS:              enemies, self (movement)
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (100px) — direction resolved away
                      from the densest cluster per the movement ruling
THREAT:               high
--- growth ---
RANK ADDS:            +3 damage; +150ms knockdown every 3rd rank
--- identity ---
ENGINE:               feeds — +4 heat on cast, +2 per enemy knocked down
COST:                 same displacement problem as Plow, at tier 1, where a
                      new player has the fewest slots and the least room to
                      work around it
VISUAL:               a hard shoulder-first sprint, bodies going flat and
                      staying flat
FLAVOR:               Three hundred paces is not a tactic. It is the distance
                      at which he stops being able to talk himself out of it.

SKILL NAME:           Toughness
CLASS / TREE / TIER:  blacksmith / Control / tier_code 1
TYPE:                 passive
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                n/a
RANGE:                n/a
TARGETS:              n/a
--- output ---
DAMAGE TIER:          n/a
PACE:                 n/a
DOMAIN:               physical
--- effects ---
RIDERS:               stat mods: maxHPMult +0.15
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +6% max HP per rank (not damage)
--- identity ---
ENGINE:               feeds indirectly — more HP is more +8 heat events
COST:                 a strictly worse Grit sitting in a different tree. It
                      exists so a Control-only build is not made of paper,
                      and a player who has taken Grit should never take this
VISUAL:               nothing visible; the health bar is longer
FLAVOR:               He does not think of himself as strong. He thinks of
                      himself as expensive to remove.

SKILL NAME:           Disarm
CLASS / TREE / TIER:  blacksmith / Control / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r70)
RANGE:                melee short (70px)
TARGETS:              cap 4
--- output ---
DAMAGE TIER:          low (18)
PACE:                 slow (8000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               stun 3000ms — the longest single stun in the game
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (70px)
THREAT:               high
--- growth ---
RANK ADDS:            +3 damage; +1 target every 4th rank (NOT stun duration
                      — three seconds is already the ceiling and ranking it
                      would produce permanent lockdown)
--- identity ---
ENGINE:               feeds — +4 heat on cast
COST:                 eighteen damage on an eight-second cooldown. Everything
                      this skill is worth is in the three seconds, and
                      against enemies that resist stun it is worth nothing
VISUAL:               a short upward strike at the weapon hand, the enemy's
                      arms going wide and staying wide
FLAVOR:               He knows how every weapon in the world is joined,
                      because he has joined most of them. Knowing where a
                      thing is glued is knowing where it comes apart.

SKILL NAME:           Intimidate
CLASS / TREE / TIER:  blacksmith / Control / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r180 on caster)
RANGE:                range short (180px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (12000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               slow ×0.5 for 5000ms; weaken 30% for 5000ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 180px)
THREAT:               high
--- growth ---
RANK ADDS:            +400ms duration and +6px radius per rank (not damage —
                      see ruling 4; this skill never deals damage at any rank)
--- identity ---
ENGINE:               neutral
COST:                 zero damage on a twelve-second cooldown. It is a pure
                      slot tax that pays out entirely in the player's ability
                      to walk away from things, which is either the best
                      skill in the class or a wasted slot depending on how
                      well the player moves
VISUAL:               no impact — a spreading stillness, enemies flinching
                      backward a half step and then coming on slower, heads
                      lower
FLAVOR:               Some men are frightening because of what they might do.
                      He is frightening because of what he has visibly
                      already survived, which is a harder thing to argue with.

SKILL NAME:           Counter Attack
CLASS / TREE / TIER:  blacksmith / Control / tier_code 4
TYPE:                 passive
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 n/a (resolves as a melee strike on the attacker)
SHAPE:                n/a
RANGE:                n/a
TARGETS:              1 (the attacker)
--- output ---
DAMAGE TIER:          low (20 per proc)
PACE:                 very fast (1200ms internal cooldown)
DOMAIN:               physical
--- effects ---
RIDERS:               scene-keyed [declared, not derived] — "when you are
                      struck, automatically strike back for 20 damage, every
                      1.2s at most"
DOT:                  none
AFFECTS:              enemies, self
--- automation ---
TRIGGER:              ON_DAMAGE_TAKEN
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage per rank; −60ms internal cooldown every 4th
                      rank, floor 600ms
--- identity ---
ENGINE:               feeds — +3 heat per proc, stacking on the +8 from the
                      hit that caused it. This is the purest expression of
                      Forge Heat in the class
COST:                 it requires being hit. Every point in this node is a
                      bet that you will fail at the only job RumbleJam gives
                      you, and a player who plays perfectly gets nothing
VISUAL:               a snapped-back elbow strike with no wind-up, almost
                      reflexive, faster than his other animations
FLAVOR:               Twenty years of sparks landing on his forearms taught
                      him not to flinch. It did not teach him not to answer.

SKILL NAME:           Cripple
CLASS / TREE / TIER:  blacksmith / Control / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r72)
RANGE:                melee short (72px)
TARGETS:              cap 4
--- output ---
DAMAGE TIER:          medium (28)
PACE:                 slow (9000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               slow ×0.35 for 4000ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — only fires at an enemy not already
                      slowed, so it never overwrites Intimidate's field
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +300ms slow duration every 3rd rank
--- identity ---
ENGINE:               feeds — +4 heat on cast
COST:                 the trigger that makes it smart also makes it silent —
                      in a build already running Intimidate it will often
                      find nothing to fire at
VISUAL:               a low strike at the knee, the enemy's gait breaking and
                      not recovering
FLAVOR:               A leg is a joint and a lever, same as anything else on
                      the bench. He is not cruel about it. He is just
                      unhesitating, which reads worse.

SKILL NAME:           Iron Will
CLASS / TREE / TIER:  blacksmith / Control / tier_code 6
TYPE:                 passive
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                n/a
RANGE:                n/a
TARGETS:              n/a
--- output ---
DAMAGE TIER:          n/a
PACE:                 n/a
DOMAIN:               mental
--- effects ---
RIDERS:               scene-keyed [declared, not derived] — "immune to stun,
                      knockback and knockdown; debuffs on you last half as
                      long; you take −10% damage"
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2% damage reduction per rank; debuff duration
                      reduction improves 3% per rank, floor 25% of original
                      (not damage — the CC immunity is binary and does not
                      scale)
--- identity ---
ENGINE:               neutral
COST:                 a large part of its value is binary and fully delivered
                      at rank 1, so it is a poor place to keep spending. It
                      is also worth close to nothing in rooms with no
                      crowd-control enemies
VISUAL:               incoming stun effects visibly break apart on contact —
                      a small shatter at the point of impact
FLAVOR:               There is a difference between a man who cannot be moved
                      and a man who has decided not to be. From the outside
                      the two look identical, and he has never bothered to
                      correct anyone.

SKILL NAME:           Execute
CLASS / TREE / TIER:  blacksmith / Control / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r72)
RANGE:                melee short (72px)
TARGETS:              cap 4
--- output ---
DAMAGE TIER:          medium (30) — 120 on the finisher
PACE:                 slow (8000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               finisher — if any enemy in the circle is below 30% HP,
                      ALL enemies in the circle take ×4 (30 → 120). Requires
                      and spends 20 Forge Heat; without the heat it deals the
                      base 30 regardless. Port change — see note
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 72px, gated to fire only when
                      that enemy is below 30%
THREAT:               some
--- growth ---
RANK ADDS:            +5 base damage (the ×4 multiplier does not scale, so a
                      rank-10 Execute finishes for 300)
--- identity ---
ENGINE:               consumes — 20 heat per finisher; feeds +4 on any cast
COST:                 the heat gate means Execute is at its worst in the
                      situation it looks built for: cleaning up a nearly-dead
                      pack after an easy fight, when heat is at zero
VISUAL:               a two-handed overhead drop; on the finisher the impact
                      goes white and every enemy in the ring comes apart at
                      once
FLAVOR:               He does not think of it as mercy and would be annoyed
                      if you called it that. A thing that is failing should
                      be taken off the bench before it fails in a way that
                      costs someone a hand.

> **Port change flagged:** ToH's `some()` check upgrades the hit on
> *everyone* in the ring if *any* enemy is below 30% — an inconsistency the
> export caught, since every later finisher in the codebase judges
> per-target. I kept the ring-wide behavior rather than fixing it, because
> in a swarm game the ring-wide version is a legitimately exciting mechanic
> and the per-target version is just a damage skill. The heat gate is what
> keeps it honest. Overrule if you'd rather it match the rest of the game.

SKILL NAME:           Dominance
CLASS / TREE / TIER:  blacksmith / Control / tier_code 8
TYPE:                 passive (aura)
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 n/a
SHAPE:                ground area (circle on caster, always active)
RANGE:                range short (180px — see note)
TARGETS:              uncapped in radius
--- output ---
DAMAGE TIER:          none (0)
PACE:                 n/a (continuous)
DOMAIN:               mental
--- effects ---
RIDERS:               scene-keyed [declared, not derived] — "enemies near you
                      deal −25% damage and move slower"
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot — see ruling 2)
THREAT:               none
--- growth ---
RANK ADDS:            +12px radius per rank (not damage, not magnitude — see
                      ruling 2; radius is what the player can feel)
--- identity ---
ENGINE:               neutral
COST:                 it does nothing at all to anything outside the radius,
                      which in a mobile swarm is most of the room most of the
                      time. It rewards a Blacksmith who stands still, and
                      standing still is how you die
VISUAL:               a faint darkened ring on the ground that follows him,
                      enemies inside it visibly hunched
FLAVOR:               The apprentices used to know, without looking up, when
                      he had come into the shop. Something about the room got
                      quieter and more careful. Whatever that was, he never
                      lost it.

> **Radius flagged:** the declared text says "near you" with no number, and
> the derived aura registry gives radii for the timed forms but this one is
> a scene-keyed always-on. I used 180px to match Intimidate. Confirm against
> the MainScene value before shipping.

SKILL NAME:           Crystal of Iron Pyrite
CLASS / TREE / TIER:  blacksmith / Control / tier_code 9
TYPE:                 transformation
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (60000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               form 12000ms — maxHPMult +0.40, damageMult +0.40
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (50%) — gated on 50 Forge Heat
THREAT:               some
--- growth ---
RANK ADDS:            +6% damage multiplier and +6% max HP per rank; +500ms
                      duration every 4th rank
--- identity ---
ENGINE:               consumes — requires 50 heat, zeroes it on use
COST:                 the middle Crystal, and the least dramatic of the
                      three. Calcite saves you, Prism kills the room, Pyrite
                      just makes you moderately better at both. Its argument
                      is that it fires more reliably than either
VISUAL:               a brassy gold shell with a hard metallic edge, cubic
                      rather than faceted — it looks more valuable than it is
FLAVOR:               Fool's gold. He kept a piece of it on the bench for
                      thirty years, not as a warning about greed but as a
                      reminder that a thing does not have to be the real
                      article to strike a very good spark.
