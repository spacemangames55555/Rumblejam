# WIZARD — RUMBLEJAM CONVERSION (30 skills)

Mechanical fields carried from the code export unchanged. Eight judgment
fields authored. Class-wide rulings stated once here.


---

## ROSTER RULING APPLIED

**Engine — RULED: `shift` (built). Mana is CUT.**

**Tree names — RULED: this document's names are KEPT.** The standing rule is
"built names win unless the doc's is clearly better", and here the built name is
not merely worse — it is wrong. **Attunement** holds all three `shift` nodes, so under the `shift` ruling it is the engine tree — but this document has no engine tree; its three are elemental domains. Mapping domains onto Attunement/Arcana/Dissonance has no role evidence either way.

**Tree contents — the document wins**, per the standing rule. Applied without
further asking; divergences from the built tree are what this file already
describes.

**Pace (ruling 1).** Every timed active rebucketed to the fixed values, then
brought into the bucket-mix rule — at least **3** nodes fast-or-better per tree,
at most 1 very fast, at most 2 very slow. All three trees comply.

**Rate: 8.33/sec on a spread build — IN BAND.**

**Ruling 6 (rider duration under cooldown) — APPLIED.** 6 rider durations cut across 5 skills, each to ~70% of its skill's new cooldown and each annotated inline with what it
was. Nothing fell under the 500ms floor, so no rider was deleted outright.

**Exempt:** Toxic Bolt held — its `RIDERS` line restates the poison DoT already in `DOT:`, so the two fields are one statement and not two. Cutting one copy and leaving the other would make the block contradict itself; a stacking DoT is rationed by its stack ceiling rather than by the clock.

**Outstanding:** every `consumes N mana` line is void; and the duplicate tier-0 openers are now LOAD-BEARING — `shift` pays for rotating domains and three near-identical bolts give nothing to rotate between.

---

## CLASS ENGINE — MANA (the only depleting engine in the roster)

Four engines so far all build upward: Heat, Conviction, Kinship, Resolve.
The Wizard should be the inverse, because he is the one class where a
spend-down economy is genre-native and where the code already names it —
Mana Shield sits at tier 4 of Ethereal referring to a resource that does not
exist.

**MANA, 0–100. Starts each run FULL.**

Costs, by the skill's own PACE bucket:
- very fast **4** · fast **6** · medium **10** · slow **15** · very slow **25**

Regenerates:
- **+4 per second**, always
- **+6 per enemy killed within 300px**

A skill will not fire below its cost. It does not queue; it simply waits.

This is the only engine that can leave a character doing nothing. Eight
actives on a Wizard, all auto-firing, will empty a hundred mana in roughly
twelve seconds, and then he is a man in a robe walking backwards. **The
Wizard is the class where the eight-slot budget is self-limiting** — he
cannot afford eight attacks, so his build is a question of which four or
five to run and what to fill the rest with. No other class in the roster has
that pressure and I think it is the right one for him to own.

It also makes kills feel different for him than for anyone else: every
enemy that drops nearby is fuel, so a Wizard clearing a swarm accelerates,
and a Wizard failing to clear one strangles.

---

## PORT RULINGS

**1. The Ice Golem is the Wizard's tank and it does not fight.** The export
is explicit: MAGNET aggro at r220, never attacks. Ruling: kept exactly as
is. It is a wall that walks, it holds position near where it was cast, and
its only job is to be the thing enemies choose instead of him. Ranks buy HP
and magnet radius — never damage.

**2. Soul Siphon's drain is per enemy *present*, not per enemy struck.**
The export flagged this as a code/description disagreement. I kept the code
behavior: it heals off the crowd, not off the hits. That makes it a
deliberately different skill from every other drain in the game and a
genuinely good reason for a squishy caster to stand in a mob for one second.

**3. Blink is the one movement skill that should NOT resolve away from the
cluster.** Every other dash in the roster runs from danger. Blink is a
teleport with no travel — it should go to the *safest reachable point*
within 240px, which is a different computation and usually a different
direction. Flagged because it breaks the standing movement ruling on
purpose.

**4. Ankh is a death-save.** The export gives only "ward (see action
notes)" on a 90-second cooldown — the longest in the class by 30 seconds.
Ninety seconds and a name meaning *life* points at one thing. Ruling: it
prevents the killing blow once, restoring 35% HP and granting 2s immunity,
then goes on cooldown. Authored, flagged.

**5. Plague spreads and I have given the spread numbers.** The export says
"spreads (see action notes)" with base 0. Ruling: applies a DoT that jumps
to a new enemy within 120px each time it ticks on an infected target,
capped at 6 simultaneous infections.

**6. Movement, allies, channels, hazards** carry from earlier classes.

---

## TREE: FIRE/WIND

Role read: **the burst DPS.** The highest single-cast numbers in the class
and the highest mana burn. Fireball at 1200ms is the most mana-expensive
skill per minute in the roster, and Elemental Storm is the only capstone
that makes the Wizard briefly stop caring about the budget.

---

SKILL NAME:           Fireball
CLASS / TREE / TIER:  wizard / Fire/Wind / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (360px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 very fast (600ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (360px)
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; at rank 8 the impact splashes r50, +10px
                      every 5 ranks thereafter
--- identity ---
ENGINE:               consumes 4 mana — but at 1200ms that is 200 mana a
                      minute against 240 regen. Fireball alone eats 83% of
                      the Wizard's entire income, and it is the tier-1 node
COST:                 it is the best damage-per-second in the class and it
                      will starve every other skill you own. A Wizard who
                      slots Fireball has, in practice, four slots left rather
                      than seven, and the tree does not warn him
VISUAL:               a compact orange sphere with a hard leading edge, no
                      trail, a flat crack on impact
FLAVOR:               Every apprentice learns this one first and every master
                      still uses it, and there is a lesson in that which
                      nobody has ever managed to phrase without sounding trite.

SKILL NAME:           Flicker
CLASS / TREE / TIER:  wizard / Fire/Wind / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (320px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (12 per bolt)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (320px)
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage; +1 bolt every 4th rank, each seeking a
                      separate target
--- identity ---
ENGINE:               consumes 10 mana
COST:                 twelve damage for ten mana is the worst efficiency
                      ratio in the class at rank 1, and it only becomes
                      reasonable once the extra bolts arrive at ranks 4, 8,
                      12. It is a node that punishes spreading points and
                      rewards committing
VISUAL:               a small pale flame that arrives in stutters rather than
                      a line, as though it is being repeatedly re-decided
FLAVOR:               A candle in a draught does not go out. It argues. What
                      he has learned to do is to be the draught.

SKILL NAME:           Combust
CLASS / TREE / TIER:  wizard / Fire/Wind / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (340px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 medium (2000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               AUTHORED — detonates on death: an enemy killed while
                      carrying Combust explodes for 24 in r80
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 340px — so the detonation
                      actually fires
THREAT:               some
--- growth ---
RANK ADDS:            +4 impact damage; +8px detonation radius every 3rd rank
--- identity ---
ENGINE:               consumes 10 mana
COST:                 as a plain bolt it is strictly worse than Fireball two
                      tiers below it — less damage, five times the cooldown.
                      All of its value is in the detonation, and the
                      detonation requires the target to die soon
VISUAL:               the bolt goes in and stays visible under the skin,
                      brightening; when it goes, it goes outward
FLAVOR:               He does not set them on fire. He locates the fire that
                      is already in them — all of it, at once, in one place —
                      and declines to keep it a secret.

> **AUTHORED:** ToH's Combust has no rider and is dominated by Fireball. The
> name means "to burn up suddenly"; I gave it a death detonation, which also
> gives the Fire tree its one crowd-scaling mechanic.

SKILL NAME:           Dust Devil
CLASS / TREE / TIER:  wizard / Fire/Wind / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                cone (narrow) (70° total)
RANGE:                melee long (135px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 135px
THREAT:               some
--- growth ---
RANK ADDS:            +5 damage; +4° cone width every 4th rank
--- identity ---
ENGINE:               consumes 10 mana
COST:                 135px on a class with 60% of the Blacksmith's health.
                      It is the highest damage in the tree's first half and
                      it requires the Wizard to be somewhere no Wizard should
                      be
VISUAL:               a narrow rising spiral of grit and heat that scours
                      forward rather than staying put
FLAVOR:               Cairo in the afternoon. They come up out of nothing in
                      the middle of an empty road and they are gone before
                      you have finished deciding whether to be alarmed.

SKILL NAME:           Gust
CLASS / TREE / TIER:  wizard / Fire/Wind / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                line (movement path)
RANGE:                range medium (260px)
TARGETS:              each enemy in path once, uncapped
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 medium (2000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               caster displaced 260px along the path
DOT:                  none
AFFECTS:              enemies, self (movement)
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (90px) — direction resolved away
                      from the densest cluster per the movement ruling
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +20px distance every 4th rank
--- identity ---
ENGINE:               consumes 10 mana
COST:                 it is an escape that costs mana and deals damage on the
                      way out, which sounds ideal and means it competes with
                      Blink for the same slot function at more than double
                      the mana and no control over the destination
VISUAL:               the air behind him closes with a snap; he arrives
                      before the sound of leaving does
FLAVOR:               Wind is the only element that does not care what it
                      is moving. He finds that restful.

SKILL NAME:           Lava
CLASS / TREE / TIER:  wizard / Fire/Wind / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r82, persistent hazard 3000ms)
RANGE:                melee short (70px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 12 per 480ms tick
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  ground tick 12 per 480ms for 3000ms — 72 to anything
                      that stays
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (82px) — placed under the things
                      that got close
THREAT:               none
--- growth ---
RANK ADDS:            +3 damage per tick; +1s duration every 4th rank; +6px
                      radius every 3rd rank
--- identity ---
ENGINE:               consumes 15 mana
COST:                 an 82px pool placed at 70px, which means it is
                      essentially under the Wizard's own feet, and he cannot
                      stand in it to defend it. Three seconds is barely long
                      enough for a pursuing enemy to take two ticks
VISUAL:               the floor goes soft and orange in a small hard-edged
                      patch and stays lit from underneath
FLAVOR:               Stone remembers being liquid. It is not a long memory
                      and it does not take much to prompt.

SKILL NAME:           Immolation
CLASS / TREE / TIER:  wizard / Fire/Wind / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r120 on caster)
RANGE:                melee long (120px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (34)
PACE:                 medium (2000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 120px)
THREAT:               high
--- growth ---
RANK ADDS:            +6 damage; +6px radius every 3rd rank
--- identity ---
ENGINE:               consumes 10 mana
COST:                 the best mana-to-damage ratio in the class and it only
                      pays out when four enemies have already reached him.
                      Immolation rewards the exact positional failure the
                      game punishes, which makes it the Wizard's most
                      dangerous good skill
VISUAL:               everything within four paces catches at once, with no
                      travel and no warning — the fire simply is where it was
                      not
FLAVOR:               Not thrown. Not directed. He stops holding it in and
                      the room finds out what he had been carrying.

SKILL NAME:           Jet Stream
CLASS / TREE / TIER:  wizard / Fire/Wind / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                line
RANGE:                range medium (320px)
TARGETS:              uncapped along line (identity skill — breadth is the
                      point)
--- output ---
DAMAGE TIER:          high (40)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 320px — aims along the axis that
                      lines up the most bodies
THREAT:               some
--- growth ---
RANK ADDS:            +7 damage; +20px length every 4th rank
--- identity ---
ENGINE:               consumes 15 mana
COST:                 forty damage to everything in a line, at range, with no
                      drawback — this is the single best skill in the Fire
                      tree and its only cost is that it needs enemies
                      arranged in a row, and the Wizard has Sludge and
                      Freezing Rain to disarrange them
VISUAL:               a flat white-blue rip through the air at head height,
                      the edges of it visibly pulling dust inward afterward
FLAVOR:               Nine miles up there is a river of air moving at three
                      hundred miles an hour and it has been doing so the
                      entire time, quite indifferent to whether anyone below
                      finds this alarming. He simply lowered a piece of it.

SKILL NAME:           Tornado
CLASS / TREE / TIER:  wizard / Fire/Wind / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r180 on caster)
RANGE:                range short (180px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (26 × 3 pulses = 78)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               3 pulses 320ms apart, each rolling its own hits
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 180px)
THREAT:               high
--- growth ---
RANK ADDS:            +4 damage per pulse; +1 pulse every 6th rank; +8px
                      radius every 3rd rank
--- identity ---
ENGINE:               consumes 15 mana
COST:                 the pulses land over 960ms and the Wizard is moving
                      through all of it, but the circle is anchored where he
                      cast it. Run and you catch one pulse; stand and you
                      catch all three and everything else in the room catches
                      you
VISUAL:               a broad low rotation that lifts loose debris in a ring
                      and drops it three times
FLAVOR:               The middle is famously calm. This is true and it is the
                      least useful true thing anyone has ever told him.

SKILL NAME:           Elemental Storm
CLASS / TREE / TIER:  wizard / Fire/Wind / tier_code 9
TYPE:                 transformation
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none (aura while active — circle r150 on caster)
RANGE:                n/a
TARGETS:              aura: uncapped in r150
--- output ---
DAMAGE TIER:          low (7 per 500ms aura pulse)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               form 12000ms — damageMult +0.50, attackSpeedMult +0.50;
                      aura 7 damage / r150 / 500ms pulse
DOT:                  none
AFFECTS:              self + enemies (aura)
--- automation ---
TRIGGER:              CROWD_THRESHOLD (8+ within 300px), gated on 60 mana
THREAT:               high
--- growth ---
RANK ADDS:            +2 aura damage per rank; +10px aura radius every 2nd
                      rank; +500ms duration every 4th rank
--- identity ---
ENGINE:               consumes 25 mana to cast — and then the +50% attack
                      speed means every other skill fires half again as often,
                      so the twelve seconds of Storm are the twelve seconds
                      the Wizard's mana bar empties fastest. It is a
                      capstone that eats the engine
COST:                 sixty seconds, and it will bankrupt him. A Wizard who
                      fires Storm with a full bar spends it all inside the
                      window and comes out the other side silent for ten
                      seconds. The correct play is to fire it near-empty and
                      accept less, which no automation will ever feel good
                      about
VISUAL:               all three elements at once and none of them stable —
                      frost forming and flashing off, small fires starting on
                      nothing, the air moving in three directions
FLAVOR:               There is a state in which he stops choosing which one.
                      It is not mastery and he would like that understood.
                      It is the opposite, and it works, and he has stopped
                      pretending the distinction matters to anyone but him.

---

## TREE: ICE/POISON

Role read: **the controller.** Five hazards, three slows, a spreading DoT,
and the class's only summon. This is the tree that decides where the swarm
is allowed to be, and it is where a Wizard who wants to survive past the
first minute actually lives.

---

SKILL NAME:           Icicle
CLASS / TREE / TIER:  wizard / Ice/Poison / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (380px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (380px)
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; at rank 6 it applies a stacking chill
                      (−8% move speed, stacks to 4), +1 stack every 6 ranks
--- identity ---
ENGINE:               consumes 6 mana — 240 a minute, which is exactly the
                      Wizard's entire baseline regen. Icicle alone breaks
                      even and nothing else can fire
COST:                 it is Fireball with less damage and a longer cooldown,
                      and the only argument for it over Fireball is that the
                      chill at rank 6 makes it a control skill. Below rank 6
                      it is a worse Fireball in a better tree
VISUAL:               a long clean spike that shatters white on impact and
                      leaves frost where the pieces land
FLAVOR:               Cairo has no ice. He learned this one from a book, in a
                      language he read badly, in a room that was forty-one
                      degrees, and it worked on the first attempt, and that
                      frightened him more than failing would have.

SKILL NAME:           Toxic Bolt
CLASS / TREE / TIER:  wizard / Ice/Poison / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (340px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (16)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — poison DoT, 5 per 1000ms for 6000ms
DOT:                  5 per 1000ms for 6000ms
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — nearest enemy not already poisoned
THREAT:               none
--- growth ---
RANK ADDS:            +2 impact damage; +1 poison per tick every 2nd rank;
                      +1s duration every 5th rank
--- identity ---
ENGINE:               consumes 10 mana
COST:                 forty-six total damage delivered over six seconds, all
                      into one enemy, for ten mana. It is efficient and it is
                      slow, and against swarm enemies that die to something
                      else first, most of the poison is never collected
VISUAL:               a dull green bolt that leaves the target's outline
                      wrong — a slight sag that gets worse
FLAVOR:               Toxic is a dosage word, not a substance word. He has
                      met people who did not understand that and he has
                      generally not had to meet them twice.

> **AUTHORED:** no rider in ToH — 16 damage, single target, 4s cooldown,
> nothing else. A bolt called Toxic with no poison is a naming failure; I
> added the DoT.

SKILL NAME:           Black Ice
CLASS / TREE / TIER:  wizard / Ice/Poison / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r95, persistent field 5000ms)
RANGE:                melee short (70px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0) — deals literally zero, tick damage is 0
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               slow ×0.45 to everything standing in the field
DOT:                  none — the tick is 0 damage, checked every 250ms purely
                      to re-apply the slow
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (95px) — laid between him and the
                      approach
THREAT:               none
--- growth ---
RANK ADDS:            +1s duration and +6px radius per rank; the slow
                      magnitude does not scale (not damage — this skill never
                      deals any and should not start)
--- identity ---
ENGINE:               consumes 15 mana
COST:                 zero damage for fifteen mana on an eight-second
                      cooldown. It is the purest control node in the game and
                      it will read as broken to any player who does not
                      understand that a 55% slow on the approach lane is
                      worth more than any number it could have printed
VISUAL:               a barely-visible sheen on the floor; enemies crossing
                      it lose their footing rather than their health
FLAVOR:               The dangerous ice is the ice you cannot see. Everyone
                      knows this and everyone walks on it anyway, every
                      winter, forever.

SKILL NAME:           Frostbite
CLASS / TREE / TIER:  wizard / Ice/Poison / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r80)
RANGE:                melee long (80px)
TARGETS:              cap 4
--- output ---
DAMAGE TIER:          low (14)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               slow ×0.5 for 840ms; weaken 30% for 840ms
                      — roster ruling 6: 4000ms→840ms, 4000ms→840ms (70% of the 1200ms cooldown)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (80px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage; +400ms on both riders every 3rd rank; +2%
                      weaken every 2nd rank
--- identity ---
ENGINE:               consumes 10 mana
COST:                 two strong debuffs at eighty pixels, which is inside
                      the radius at which a Wizard is already losing. It is
                      the panic layer and it fires because things have gone
                      wrong, not to stop them going wrong
VISUAL:               a white bloom outward at knee height; enemies caught in
                      it move as though the air has thickened
FLAVOR:               Cold does not slow things down. Cold removes the
                      surplus that was making them quick, and there is
                      always less surplus than anyone assumes.

SKILL NAME:           Sludge
CLASS / TREE / TIER:  wizard / Ice/Poison / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                cone (narrow) (76° total)
RANGE:                melee long (140px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (16)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               knockback 150px; knockback-stun 200ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (3+ within 140px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage; +20px knockback every 3rd rank; +4° cone
                      width every 4th rank
--- identity ---
ENGINE:               consumes 15 mana
COST:                 a hundred and fifty pixels of knockback is the largest
                      in the class, and it scatters the cluster that Jet
                      Stream and Tornado both need. Sludge and the Fire tree
                      are working against each other and nothing in the
                      interface says so
VISUAL:               a wide low spray of something dark and viscous; enemies
                      go over backward and get up slowly
FLAVOR:               He is faintly embarrassed by this one. It is not
                      elegant, it is not difficult, and it has saved his life
                      more times than any spell he is proud of.

SKILL NAME:           Freezing Rain
CLASS / TREE / TIER:  wizard / Ice/Poison / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (r160, persistent field 5000ms)
RANGE:                range short (160px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 9 per 500ms tick
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               slow ×0.55 to everything inside
DOT:                  ground tick 9 per 500ms for 5000ms — 90 to anything
                      that stays
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 160px)
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per tick; +1s duration every 4th rank; +8px
                      radius every 3rd rank
--- identity ---
ENGINE:               consumes 15 mana
COST:                 it is Black Ice with damage attached and a wider
                      radius, three tiers later, for the same mana. Taking
                      both is redundant unless the build genuinely needs two
                      slow fields, and most do not
VISUAL:               a hissing grey curtain in a wide circle, the floor
                      inside going pale and slick
FLAVOR:               It is not the falling that does it. It is that
                      everything the rain lands on stops being able to
                      participate in whatever it was doing.

SKILL NAME:           Biohazard
CLASS / TREE / TIER:  wizard / Ice/Poison / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r110, persistent hazard 5000ms)
RANGE:                range short (220px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 11 per 500ms tick
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  ground tick 11 per 500ms for 5000ms — 110 to anything
                      that stays
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 220px
THREAT:               none
--- growth ---
RANK ADDS:            +3 damage per tick; +1s duration every 4th rank; +8px
                      radius every 3rd rank
--- identity ---
ENGINE:               consumes 15 mana
COST:                 the only hazard in the tree with no control component
                      at all, and the only one placed at real range. It is
                      pure damage in a control tree, which makes it the node
                      a damage-focused Wizard reaches across for and the node
                      a control Wizard skips
VISUAL:               a spreading stain rather than a cloud, dull yellow,
                      with things visibly wrong about the geometry inside it
FLAVOR:               He is not sure this one is magic. He is fairly sure it
                      is chemistry that he learned in a place where the
                      distinction was not being carefully policed.

SKILL NAME:           Plague
CLASS / TREE / TIER:  wizard / Ice/Poison / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (spreading)
RANGE:                range medium (300px to the first target)
TARGETS:              spreads to a new enemy within 120px on each tick, cap
                      6 simultaneous infections (ruling 5)
--- output ---
DAMAGE TIER:          none (0 direct) — 8 per 1000ms per infection
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               each infected enemy that dies while infected passes the
                      plague on immediately rather than losing it
DOT:                  8 per 1000ms for 8000ms per infected enemy
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 300px — spread wants bodies
                      close together
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per tick; +1 simultaneous infection cap every
                      4th rank; +15px spread radius every 3rd rank
--- identity ---
ENGINE:               consumes 15 mana — and at six infections it is the
                      best mana-to-damage ratio in the entire class, which
                      is the whole reason to build around it
COST:                 it takes eight seconds to reach full spread and it
                      needs a dense, long-lived crowd to get there. Against
                      six enemies that die in two seconds it is a fifteen-mana
                      cough. It is the single most build-dependent node in
                      the class
VISUAL:               nothing at the moment of casting. Then one enemy
                      staggers, and then two, and the pattern of who is
                      staggering starts to have a shape to it
FLAVOR:               He did not invent it and he would like that on the
                      record. He found it, in a sealed jar, in a room under a
                      library, and the jar had a name on it in a hand he
                      recognised.

> **Ruling applied:** the export gives "spreads (see action notes)" with
> base 0 and no numbers. Spread radius, infection cap, and pass-on-death are
> mine.

SKILL NAME:           Summon Ice Golem
CLASS / TREE / TIER:  wizard / Ice/Poison / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                melee short (spawns at 40px)
TARGETS:              n/a — cap 1
--- output ---
DAMAGE TIER:          none (0) — it never attacks anything, ever
PACE:                 very slow (8000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               MAGNET aggro r220 — actively pulls enemy targeting onto
                      itself. Holds position near where it was cast. Persists
                      until killed
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on the golem being dead or
                      unspawned
THREAT:               high (delegated — this is the Wizard's entire tanking
                      answer)
--- growth ---
RANK ADDS:            +20% golem HP per rank; +15px magnet radius every 3rd
                      rank (never damage — it does not have any and should
                      not be given any)
--- identity ---
ENGINE:               consumes 25 mana
COST:                 it deals nothing. Twenty-five mana and a slot for a
                      wall that walks, on a class whose mana is already the
                      tightest budget in the roster. What it buys is the
                      difference between a Wizard who can stand still to cast
                      and one who cannot, and that difference is the class
VISUAL:               it comes up out of the floor in plates and does not
                      raise a hand for the rest of its life; enemies pile
                      against it and it simply continues standing
FLAVOR:               It has no instructions. He has never given it any and
                      would not know how. It is simply in the way, on purpose,
                      and it has never once stepped aside.

SKILL NAME:           Pestilence
CLASS / TREE / TIER:  wizard / Ice/Poison / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (r240, persistent field 8000ms)
RANGE:                range short (240px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 16 per 500ms tick
PACE:                 capstone (25000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               slow ×0.5 and weaken 35% to everything inside, for as
                      long as they remain
DOT:                  ground tick 16 per 500ms for 8000ms — 256 to anything
                      that stays the full duration
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (8+ within 240px), gated on 60 mana
THREAT:               none
--- growth ---
RANK ADDS:            +4 damage per tick; +1s duration every 4th rank; +12px
                      radius every 3rd rank
--- identity ---
ENGINE:               consumes 25 mana
COST:                 sixty seconds for a 240px field the Wizard has to stand
                      near to benefit from, on a class that dies if it stands
                      near anything. It is the largest single block of damage
                      the Wizard can produce and collecting it requires him
                      to defend a circle for eight seconds
VISUAL:               the whole area goes wrong at once — the colour drops
                      out of it, the air thickens visibly, and everything
                      inside slows and hunches and keeps taking damage
FLAVOR:               Cairo remembers. Not the city — cities do not remember
                      — but the ground under it does, in layers, and one of
                      the layers is nothing but this, and he has learned
                      exactly how deep to reach.

---

## TREE: ETHEREAL

Role read: **the survival kit, and the reason a Wizard reaches minute
three.** Nine of ten skills here are defensive or self-sustaining, and the
tree costs almost no mana by design — it is the ballast that lets the other
two trees spend. In co-op it contributes nothing to anyone else, which is
worth knowing before you build it.

---

SKILL NAME:           Ethereal Bolt
CLASS / TREE / TIER:  wizard / Ethereal / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (360px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 very fast (600ms)
DOMAIN:               mental
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (360px)
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; at rank 7 it pierces 1 additional enemy,
                      +1 every 7 ranks thereafter
--- identity ---
ENGINE:               consumes 4 mana — the same as Fireball, for the same
                      damage, on a slightly longer cooldown
COST:                 it is Fireball. Genuinely — same damage, same range,
                      100ms slower, different tree. Its only distinction is
                      the rank-7 pierce and the fact that it sits in the tree
                      a defensive Wizard has already committed to
VISUAL:               a bolt with no colour to it, visible mostly as a
                      distortion in what is behind it
FLAVOR:               The plainest thing he knows how to do. He suspects it
                      is also the only one that is entirely his.

SKILL NAME:           Mend
CLASS / TREE / TIER:  wizard / Ethereal / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               heals 35 to self
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (65%)
THREAT:               none
--- growth ---
RANK ADDS:            +9 heal per rank
--- identity ---
ENGINE:               consumes 15 mana — an expensive heal on a tight budget,
                      and one of the few places the Wizard must choose
                      between staying alive and staying loud
COST:                 thirty-five on a nine-second cooldown, and every cast
                      is fifteen mana that was going to be a Jet Stream. The
                      Wizard is the only class in the roster where healing
                      directly reduces damage output
VISUAL:               a brief closing motion of both hands; the damage does
                      not visibly heal so much as get filed away
FLAVOR:               It does not put anything back. It relocates the problem
                      into a category he has more room in, and he has never
                      been entirely comfortable about where that room is
                      coming from.

SKILL NAME:           Regeneration
CLASS / TREE / TIER:  wizard / Ethereal / tier_code 2
TYPE:                 buff
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               timed 2800ms — regenPerSec 8
                      — roster ruling 6: 8000ms→2800ms (70% of the 4000ms cooldown)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (75%)
THREAT:               none
--- growth ---
RANK ADDS:            +2 regen per second per rank; +400ms duration every
                      4th rank
--- identity ---
ENGINE:               consumes 25 mana
COST:                 sixty-four health for twenty-five mana, delivered over
                      eight seconds. It is the most mana-efficient healing in
                      the class per point and the slowest, and against burst
                      damage it arrives having already been irrelevant
VISUAL:               a low steady glow at the sternum that dims tick by tick
FLAVOR:               The body is already doing this. All he does is remove
                      one or two of the objections it usually raises about
                      the pace.

SKILL NAME:           Mana Shield
CLASS / TREE / TIER:  wizard / Ethereal / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               absorb shield 60 for 2800ms
                      — roster ruling 6: 8000ms→2800ms (70% of the 4000ms cooldown)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (150px)
THREAT:               none
--- growth ---
RANK ADDS:            +15 absorb per rank; +500ms duration every 4th rank
--- identity ---
ENGINE:               consumes 15 mana — and this node is where the mana
                      engine got its name. It is the one skill in the class
                      that makes the resource legible to the player
COST:                 sixty absorb for fifteen mana, and the absorb expires
                      whether or not it is used. Fired on a breach that turns
                      out to be nothing, it is fifteen mana thrown away, and
                      the automation will do exactly that several times a
                      minute
VISUAL:               a close-fitting hexagonal lattice that lights only
                      where it is struck and darkens as it is spent
FLAVOR:               He does not think of it as armour. He thinks of it as
                      a small quantity of the world that has been persuaded
                      to be his, temporarily, on the outside.

SKILL NAME:           Blink
CLASS / TREE / TIER:  wizard / Ethereal / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                range short (240px)
TARGETS:              self (teleport)
--- output ---
DAMAGE TIER:          none (0)
PACE:                 fast (1200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               instantaneous — no travel, no collision along the way
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (80px) — destination is the SAFEST
                      reachable point within 240px, not simply the direction
                      away from the cluster (ruling 3)
THREAT:               none
--- growth ---
RANK ADDS:            −400ms cooldown per rank, floor 3000ms; +15px range
                      every 4th rank (not damage)
--- identity ---
ENGINE:               consumes 10 mana
COST:                 it is the best defensive skill in the class and it
                      leaves everything behind — the hazards he placed, the
                      golem he summoned, the Pestilence field he was standing
                      in to defend. Every Blink is a Wizard abandoning his
                      own board
VISUAL:               he is not there. There is no effect at the origin and a
                      soft displacement of air at the destination
FLAVOR:               The distance is not travelled. He has tried several
                      times to explain what is done with it instead and each
                      explanation has been worse than the last.

SKILL NAME:           Reflect
CLASS / TREE / TIER:  wizard / Ethereal / tier_code 5
TYPE:                 buff
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               timed 2800ms — reflectPct 0.50
                      — roster ruling 6: 6000ms→2800ms (70% of the 4000ms cooldown)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 150px)
THREAT:               none
--- growth ---
RANK ADDS:            +5% reflect per rank; +400ms duration every 4th rank
--- identity ---
ENGINE:               consumes 15 mana; the reflect kills count as his, so it
                      is also mana income at +6 each
COST:                 fifty percent of incoming damage returned is enormous,
                      and collecting it requires taking the other fifty
                      percent on a body that has the second-lowest health in
                      the roster. Reflect is a skill for a Wizard who has
                      already decided to lose the positioning battle
VISUAL:               a mirrored sheen with a visible seam; blows arrive and
                      the same blow leaves along the reversed vector
FLAVOR:               Symmetry is not justice and he knows better than to
                      pretend otherwise. It is simply the cheapest available
                      arrangement and it happens to look like justice from
                      certain angles.

SKILL NAME:           Ethereal Form
CLASS / TREE / TIER:  wizard / Ethereal / tier_code 6
TYPE:                 buff
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               timed 6000ms — damageReduction +0.60
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (40%)
THREAT:               none
--- growth ---
RANK ADDS:            +3% damage reduction per rank, ceiling 85%; +400ms
                      duration every 4th rank
--- identity ---
ENGINE:               consumes 25 mana
COST:                 sixty percent reduction is the largest defensive number
                      in the class, for six seconds, once every eighteen. The
                      twelve seconds it is down are the twelve seconds the
                      Wizard actually dies in, and twenty-five mana means
                      firing it costs him a Pestilence
VISUAL:               he goes half-transparent and slightly out of register
                      with his own shadow; attacks visibly pass through parts
                      of him
FLAVOR:               Less here. That is the entire technique. There is a
                      quantity of him that is required to be present and he
                      has spent years finding out how small it is.

SKILL NAME:           Soul Siphon
CLASS / TREE / TIER:  wizard / Ethereal / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r115)
RANGE:                melee long (115px)
TARGETS:              cap 6
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 fast (1200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               heals the Wizard per enemy PRESENT in r115, not per
                      enemy struck (ruling 2 — code behavior kept over the
                      description)
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 115px) — the heal scales
                      with headcount, so it should fire on headcount
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +3 heal per enemy present every 2nd rank
--- identity ---
ENGINE:               consumes 10 mana
COST:                 the heal scales with how many enemies are within
                      115px, which is a direct instruction to stand in the
                      worst place on the board. It is the only skill in the
                      Ethereal tree that asks the Wizard to move toward
                      danger, and it is the best heal he has
VISUAL:               threads of grey pull inward from everything nearby at
                      once, whether or not it was hit
FLAVOR:               Proximity is sufficient. He does not need to touch
                      them and has stopped explaining that part when asked
                      how it works.

SKILL NAME:           Sanctuary
CLASS / TREE / TIER:  wizard / Ethereal / tier_code 8
TYPE:                 buff
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               timed 5600ms — regenPerSec 12, damageReduction +0.30
                      — roster ruling 6: 8000ms→5600ms (70% of the 8000ms cooldown)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (50%)
THREAT:               none
--- growth ---
RANK ADDS:            +3 regen per second and +2% damage reduction per rank;
                      +500ms duration every 4th rank
--- identity ---
ENGINE:               consumes 25 mana
COST:                 ninety-six health and thirty percent mitigation for
                      eight seconds is the best defensive value in the class
                      per cast, and it costs a quarter of his bar. Sanctuary
                      and Ethereal Form will both want to fire in the same
                      emergency and together they are fifty mana, which is
                      most of everything
VISUAL:               a still, warm, faintly golden volume around him that
                      does not move when he does — it re-forms rather than
                      travels
FLAVOR:               A sanctuary is a legal fiction that everyone has agreed
                      to honour. He has found, to his considerable surprise,
                      that the agreement extends further than the people who
                      made it.

SKILL NAME:           Ankh
CLASS / TREE / TIER:  wizard / Ethereal / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               AUTHORED — ward: the next blow that would kill him
                      does not. He is restored to 35% HP and is immune to all
                      harm for 2000ms. The ward persists indefinitely until
                      consumed
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              COOLDOWN_READY — placed the moment it is available and
                      then simply held
THREAT:               none
--- growth ---
RANK ADDS:            +4% restored HP per rank; +200ms immunity every 3rd
                      rank; −5s cooldown every 4th rank, floor 60s
--- identity ---
ENGINE:               consumes 40 mana to place
COST:                 ninety seconds and forty mana for one mistake. It does
                      nothing until the moment it does everything, and a
                      Wizard who never dies has spent a permanent slot on
                      nothing at all. It is also the only capstone in the
                      roster that produces no damage at any rank
VISUAL:               a small looped cross that hangs behind his shoulder,
                      turning slowly. When it goes, it goes silently and it
                      does not leave anything behind
FLAVOR:               The sign predates every language that has a word for
                      it. He learned it in Cairo from a stone that had been
                      standing for four thousand years, and the stone did not
                      explain and did not need to. It is a loop and a cross.
                      A thing that ends and a thing that comes back around.

> **AUTHORED:** the export gives only "ward (see action notes)" with base 0
> on a 90-second cooldown. I read the name and the cooldown as a death-save
> and wrote it that way. Verify against MainScene before shipping — if the
> ward does something else, this block needs replacing rather than adjusting.
