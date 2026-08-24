# MAGE — RUMBLEJAM CONVERSION (30 skills)

Mechanical fields carried from the code export unchanged. Eight judgment
fields authored. Class-wide rulings stated once here.


---

## ROSTER RULING APPLIED

**Engine — RULED: `crystal` (built). Energy is CUT.**

**Tree names — built names win.** Spacetime→Collapse, Arcane→Refraction, Crystalblade→Crystalblade


**Tree contents — the document wins**, per the standing rule. Applied without
further asking; divergences from the built tree are what this file already
describes.

**Pace (ruling 1).** Every timed active rebucketed to the fixed values, then
brought into the bucket-mix rule — at least **3** nodes fast-or-better per tree,
at most 1 very fast, at most 2 very slow. All three trees comply.

**Rate: 6.67/sec on a spread build — IN BAND.**

**Ruling 6 (rider duration under cooldown) is NOT yet applied to this file.**
Cooldowns moved; rider durations did not. Any rider now longer than its skill's
cooldown is a permanent effect until that sweep runs.

**Outstanding:** every `consumes N energy` line is void; crystal stacks stay as the Crystalblade tree mechanic.

---

## CLASS ENGINE — ENERGY (derived from three nodes, not inferred)

The Wizard's Mana was my inference off a single skill name. The Mage's
resource is properly in the code, three times over:

- **Arcane Absorption** (passive): *"+4 energy/sec regeneration"*
- **Arcane Leech Shot**: restores 6 energy per enemy, max 4
- **Mana Surge**: restores 40 energy instantly

Three nodes across one tree that manage a resource the shipped game does not
otherwise use. The Mage is where the energy economy actually lives.

**ENERGY, 0–100. Starts each run FULL.**

Costs by PACE bucket: very fast **4** · fast **6** · medium **10** ·
slow **15** · very slow **25**.

Regenerates **+3/sec** baseline — *lower* than the Wizard's 4, deliberately —
plus everything the three derived nodes above restore, plus:

- **+2 per enemy pulled** by any gravity skill

That last line is the class. The Mage owns five pull effects — Contraction,
Graviton Surge, Black Hole, Singularity Collapse, and Wormhole Rift's
displacement — more than the rest of the roster combined. **He harvests
energy by compacting the swarm.** The Wizard survives on a budget; the Mage
runs a supply chain, and the raw material is enemies standing too close
together.

It also makes him the precise inverse of the Blacksmith's Sludge problem.
Where most classes scatter crowds to survive, the Mage gathers them to eat,
and every gather is a bet that he can kill the pile before it reaches him.

---

## PORT RULINGS

**1. Crystal stacks, defined.** Crystal Shatter "detonates banked stacks"
with no banking mechanic anywhere in the export. Ruling: **every
Crystalblade skill that damages an enemy applies one crystal stack to it,
max 5 per enemy.** Shatter consumes every stack in r200 for 12 damage each.
A fully stacked pack of eight is 480 damage from one cast. Authored, and it
is what makes Crystalblade a combo tree rather than six melee swings.

**2. Encapsulation becomes a passive.** It is a toggle with no duration, no
stance group, and no drawback — +35% damage, permanently, once switched on.
That is a passive with extra steps, and in an auto-fire game the toggle is
purely vestigial. Ruling: converted to a passive occupying a slot. No
invention, just an honest read of what it already is.

**3. `basicHitCount` → multi-strike**, carried from Blacksmith ruling 1.
Perfect Edge's `basicHitCount: 2` makes every melee-CAST skill fire twice
for the form's duration.

**4. Photon Beam does not break on movement** (channel ruling from
Necromancer); 60% tick rate while moving. Note the code also cancels it when
*any other skill fires*, which in auto-fire would mean it never completes —
so in RumbleJam it also survives other casts.

**5. Entangled Chains' share mechanic, defined.** The export gives "damage
share + control share" on 4 bound targets with no numbers. Ruling: **40% of
damage dealt to any bound enemy is dealt to all other bound enemies, and any
stun, slow, or root applied to one applies to all four.** The binding lasts
8s.

**6. Movement, allies, hazards** carry from earlier classes. Wormhole Rift's
teleport uses Blink's rule — safest reachable point, not simply away.

---

## TREE: COLLAPSE  (was Spacetime in the source conversion)

Role read: **the controller, and the roster's best crowd-gatherer.** Pulls,
slows, a stun, a teleport and a 50-second collapse. Almost nothing here does
respectable damage on its own; the tree's output is *arrangement*, and the
Mage's other two trees are what he arranges things for.

---

SKILL NAME:           Quantum Blast
CLASS / TREE / TIER:  mage / Collapse / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (360px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 fast (1200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (360px)
THREAT:               some
--- growth ---
RANK ADDS:            +5 damage; at rank 7 it pierces 1 additional enemy,
                      +1 every 7 ranks thereafter
--- identity ---
ENGINE:               consumes 6 energy — 200/minute against a 180 baseline
                      regen, so Quantum Blast alone runs the Mage slightly
                      negative and every pull he lands is what covers it
COST:                 it is the highest tier-1 damage in the roster and it
                      is single-target, which means the Mage's opening node
                      is the one that scales worst into the swarms he will
                      face at minute four
VISUAL:               a compact white distortion that arrives without
                      traversing the space between — the target simply
                      registers it
FLAVOR:               He does not think of it as a projectile. A projectile
                      is a thing with a history of positions. This is closer
                      to a statement about probability that has been made
                      unusually firmly.

SKILL NAME:           Contraction
CLASS / TREE / TIER:  mage / Collapse / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r140 on caster)
RANGE:                melee long (140px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (10)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               pull — every enemy within 140px dragged up to 120px
                      TOWARD the Mage
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 300px) — fires to gather
                      the outer ring inward, not when they are already close
THREAT:               high
--- growth ---
RANK ADDS:            +2 damage; +15px pull distance and +6px radius per rank
--- identity ---
ENGINE:               feeds — +2 energy per enemy pulled. Eight enemies is
                      +16, which is more than the cast cost, so a
                      well-triggered Contraction is free
COST:                 it drags the swarm onto a caster with the second-lowest
                      health in the roster. Ten damage and a pile of enemies
                      now standing where he is. Every other class would call
                      this a mistake; the Mage calls it stock
VISUAL:               the floor pattern visibly compresses inward in rings
                      and everything standing on it slides with the pattern
FLAVOR:               Space is not a container. It is a relationship, and
                      relationships can be renegotiated by anyone rude enough
                      to try.

SKILL NAME:           Time Dilation
CLASS / TREE / TIER:  mage / Collapse / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (r150, persistent field 5000ms)
RANGE:                range short (150px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0) — the tick is 0 damage, purely a slow re-apply
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               slow ×0.5 to everything inside the field
DOT:                  none — 0 damage per 250ms tick for 5000ms
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 150px)
THREAT:               none
--- growth ---
RANK ADDS:            +1s duration and +6px radius per rank; the slow
                      magnitude does not scale (not damage — this skill
                      deals none at any rank)
--- identity ---
ENGINE:               consumes 15 energy
COST:                 zero damage for fifteen energy, and it is the Mage's
                      only pure-defensive field. It pairs with Contraction to
                      make a pile that cannot leave, which is the single most
                      dangerous thing this class can build and also the most
                      necessary
VISUAL:               a disc where everything is running at half speed —
                      including particles, dust, and the enemies' own attack
                      animations, which visibly stretch
FLAVOR:               Moscow winters taught him that time is not uniform. He
                      later found the mathematics and was unsurprised by it.

SKILL NAME:           Photon Beam
CLASS / TREE / TIER:  mage / Collapse / tier_code 3
TYPE:                 channel
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                beam
RANGE:                range medium (340px)
TARGETS:              1 (locks nearest)
--- output ---
DAMAGE TIER:          low (12 per tick)
PACE:                 fast (1200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               does NOT break on movement or on other skills firing
                      (ruling 4); 60% tick rate while moving; breaks on
                      target death or leaving range
DOT:                  12 per 400ms for up to 8000ms — 240 total
AFFECTS:              enemies
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 340px
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage per tick; +1s maximum duration every 4th rank
--- identity ---
ENGINE:               consumes 15 energy for up to 240 damage — by far the
                      best energy-to-damage ratio in the class, and the
                      reason a Mage can afford anything else
COST:                 eight seconds locked on one enemy. It is enormous
                      single-target throughput on a class whose entire
                      Spacetime tree exists to create crowds, and the two
                      halves of that sentence do not want the same fight
VISUAL:               a hairline of white that does not widen or waver; the
                      point where it lands is too bright to resolve
FLAVOR:               Light does not accumulate. It arrives, entirely, and
                      then arrives again, and the only thing he has changed
                      is how often.

SKILL NAME:           Temporal Acceleration
CLASS / TREE / TIER:  mage / Collapse / tier_code 4
TYPE:                 buff
AXIS POSITION:        5 (of 10)
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
RIDERS:               timed 8000ms — attackSpeedMult +0.40, moveSpeedMult
                      +0.20
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 300px)
THREAT:               none
--- growth ---
RANK ADDS:            +6% attack speed and +3% move speed per rank; +400ms
                      duration every 4th rank
--- identity ---
ENGINE:               consumes 25 energy — and then the +40% attack speed
                      makes everything else fire 40% more often, which drains
                      the bar 40% faster. Like the Wizard's Storm, this is a
                      buff that eats the engine
COST:                 it is the only movement-speed buff the Mage owns and
                      the only thing in the class that makes him harder to
                      catch. It also guarantees he will be out of energy by
                      the end of the window
VISUAL:               everything else slows fractionally rather than him
                      speeding up — the frame rate of the world drops around
                      him and snaps back when it ends
FLAVOR:               He is not faster. He would like people to stop saying
                      that. The rate at which the rest of it is permitted to
                      happen has been adjusted, which is a different claim
                      and a much larger one.

SKILL NAME:           Graviton Surge
CLASS / TREE / TIER:  mage / Collapse / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r180)
RANGE:                range short (180px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (8)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               pull up to 90px toward the well centre; stun 900ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 180px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage; +100ms stun every 3rd rank; +10px pull every
                      2nd rank
--- identity ---
ENGINE:               feeds — +2 energy per enemy pulled, and the stun means
                      the pile stays piled long enough to be worth something
COST:                 eight damage on a twelve-second cooldown. It is
                      genuinely not an attack; it is a setup skill that the
                      interface will present as a bad one, and a player who
                      does not have Crystal Shatter or Antimatter Burst
                      slotted has spent twelve seconds arranging furniture
VISUAL:               a point of visible density that everything leans toward
                      before it slides, and then a hard lock as the stun lands
FLAVOR:               Mass is not the thing that pulls. Mass is what happens
                      to be nearby when the pulling occurs, and he has found
                      the distinction useful.

SKILL NAME:           Antimatter Burst
CLASS / TREE / TIER:  mage / Collapse / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (circle r130 at 200px)
RANGE:                range short (200px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (34)
PACE:                 fast (1200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 200px — preferring clusters that
                      are currently stunned or slowed
THREAT:               none
--- growth ---
RANK ADDS:            +6 damage; +8px radius every 3rd rank
--- identity ---
ENGINE:               consumes 15 energy
COST:                 it is the Spacetime tree's only real damage and it
                      arrives at tier 7, which means six tiers of the tree
                      have been asking the player to trust that the payoff
                      exists. Placed at range with no lingering field, it
                      resolves where the cluster was
VISUAL:               a sphere of absolute black that expands for one frame
                      and is gone, taking the light in the radius with it
FLAVOR:               There is nothing dramatic about the reaction itself.
                      Two things that should not both exist stop both
                      existing, very quickly, and the drama is entirely in
                      the quantity of energy that had been holding the
                      disagreement in check.

SKILL NAME:           Spatial Distortion
CLASS / TREE / TIER:  mage / Collapse / tier_code 7
TYPE:                 buff
AXIS POSITION:        8 (of 10)
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
RIDERS:               timed 8000ms — damageReduction +0.25, blockChance
                      +0.25, blockReduction 1.00 (a successful block negates
                      the hit ENTIRELY)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (55%)
THREAT:               none
--- growth ---
RANK ADDS:            +4% block chance per rank; +400ms duration every 4th
                      rank. The 100% block reduction does not scale — it is
                      already total
--- identity ---
ENGINE:               consumes 25 energy
COST:                 blockReduction 1.00 means a quarter of incoming hits
                      simply do not happen, which is the strongest defensive
                      line in the class, and it is a coin flip. Eight seconds
                      of good variance or eight seconds of bad, and no way
                      to tell which until afterward
VISUAL:               the space immediately around him is subtly wrong —
                      attacks that should land arrive at a position he is not
                      quite occupying and stop
FLAVOR:               He is exactly where you are looking. The difficulty is
                      that where you are looking and where he is have been
                      allowed to disagree slightly.

SKILL NAME:           Wormhole Rift
CLASS / TREE / TIER:  mage / Collapse / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (r90, persistent hazard 3000ms) + teleport
RANGE:                melee long (90px hazard; 240px teleport)
TARGETS:              uncapped in the hazard (identity skill — breadth is the
                      point)
--- output ---
DAMAGE TIER:          none (0 direct) — 10 per 400ms tick
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               the Mage teleports 240px as part of the cast, leaving
                      the hazard behind at the origin. Destination is the
                      safest reachable point (ruling 6)
DOT:                  ground tick 10 per 400ms for 3000ms — 80 to anything
                      that stays
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (90px) — leaves the rift where the
                      breach happened
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per tick; +1s duration every 4th rank; +20px
                      teleport range every 4th rank
--- identity ---
ENGINE:               consumes 15 energy
COST:                 it is the only skill in the class that escapes and
                      damages in the same cast, and it does both at half
                      strength. Eighty damage requires the pursuing enemies
                      to stand in the hole he just left, which the ones
                      chasing him will do and the ones that were not, will not
VISUAL:               he steps into a fold that closes behind him; where he
                      was, the floor stays open and unpleasant for three
                      seconds
FLAVOR:               The hole does not lead anywhere. That is the part
                      people find hardest. It is not a passage; it is the
                      absence of the requirement to travel, and it does not
                      tidy up after itself.

SKILL NAME:           Singularity Collapse
CLASS / TREE / TIER:  mage / Collapse / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r200, pulsing)
RANGE:                range short (200px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (20 per pulse)
PACE:                 capstone (25000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               pull up to 12px per pulse toward the centre — a slow,
                      relentless gather rather than a single drag
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (8+ within 250px), gated on 60 energy
THREAT:               none
--- growth ---
RANK ADDS:            +4 damage per pulse; +2px pull per pulse every 3rd
                      rank; +1 pulse every 5th rank
--- identity ---
ENGINE:               consumes 25 energy and then refunds heavily — every
                      pulse pulls every enemy, and every pull is +2. A
                      Singularity landing in a pack of ten refills the bar
                      outright. It is the class's economic reset
COST:                 fifty seconds, and it assembles the largest possible
                      pile of enemies at a fixed point 200px across with the
                      Mage inside it. If the pile survives the collapse, the
                      pile is now on him and his best escape is on cooldown
                      because he used Wormhole to set this up
VISUAL:               a fixed dark point that does not grow; everything
                      leans, then slides, then queues, and the floor texture
                      streams inward in visible lines the entire time
FLAVOR:               Collapse is the wrong word and he uses it because the
                      right one takes a page. Nothing falls. A set of
                      relationships that had been holding at arm's length
                      simply stops being able to justify the distance.

---

## TREE: REFRACTION  (was Arcane in the source conversion)

Role read: **the resource tree and the roster's only damage-share
mechanic.** Three of the ten nodes exist to manage energy, which makes this
the tree that lets the other two run. Its damage is mediocre by design;
Entangled Chains at tier 10 is the payoff and it is unlike anything else in
the game.

---

SKILL NAME:           Arcane Orb
CLASS / TREE / TIER:  mage / Refraction / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (340px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (340px)
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage
--- identity ---
ENGINE:               consumes 6 energy — 240/minute, which is more than the
                      Mage's entire baseline regen. Arcane Orb by itself puts
                      him underwater
COST:                 it is Quantum Blast with less damage on a shorter
                      cooldown, in a different tree. Running both is the
                      fastest way to bankrupt a Mage, and the tree gives no
                      indication that they are the same skill
VISUAL:               a slow-turning violet sphere with visible internal
                      structure, unhurried, arriving anyway
FLAVOR:               The oldest thing in the curriculum. Every school in
                      every century has taught some version of it and every
                      one of them has claimed to have refined it.

SKILL NAME:           Arcane Blast
CLASS / TREE / TIER:  mage / Refraction / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (300px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (12)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               AUTHORED — splash r70 on impact for 60% of the hit
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 300px — aims at the enemy with
                      the most neighbours, so the splash is worth something
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage; +6px splash radius every 3rd rank
--- identity ---
ENGINE:               consumes 10 energy
COST:                 twelve damage for ten energy is the worst ratio in the
                      class, and even with the splash it sits one tier below
                      an Orb that does more than twice as much for less. It
                      is the node to skip
VISUAL:               a compact detonation rather than a projectile impact —
                      the bolt arrives and then the space around it does
FLAVOR:               Blast is an aspiration. He has never been satisfied
                      with this one and has kept it in the rotation out of
                      something between habit and stubbornness.

> **AUTHORED:** ToH's Arcane Blast is single-target with no rider, strictly
> dominated by Arcane Orb one tier below. I gave it splash so the tree has a
> low-tier area option. Even with it, the node is weak — flagged as a
> candidate for cutting rather than saving.

SKILL NAME:           Arcane Infusion
CLASS / TREE / TIER:  mage / Refraction / tier_code 2
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               timed 8000ms — damageMult +0.25
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 300px)
THREAT:               none
--- growth ---
RANK ADDS:            +5% damage multiplier per rank; +400ms duration every
                      4th rank
--- identity ---
ENGINE:               consumes 25 energy
COST:                 eight seconds in sixteen, for twenty-five energy — a
                      quarter of the bar to make the other half of the bar
                      hit harder. On a class this tight, a pure multiplier
                      buff has to compete against simply casting another
                      spell with the same energy
VISUAL:               the violet in everything he casts deepens and takes on
                      a harder edge for the duration
FLAVOR:               There is a quantity of it in the room at all times and
                      most practitioners take what arrives. Taking more than
                      arrives is a separate skill and not a polite one.

SKILL NAME:           Quantum Shielding
CLASS / TREE / TIER:  mage / Refraction / tier_code 3
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               absorb shield 60 for 8000ms
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (150px)
THREAT:               none
--- growth ---
RANK ADDS:            +15 absorb per rank; +500ms duration every 4th rank
--- identity ---
ENGINE:               consumes 15 energy
COST:                 identical to the Wizard's Mana Shield in every number.
                      Sixty absorb that expires whether used or not, and the
                      breach trigger will spend it on false alarms several
                      times a minute
VISUAL:               a shell of overlapping probability outlines, each one
                      slightly offset, collapsing to one as it is struck
FLAVOR:               It is not that the blow misses. It is that of the
                      several ways the next moment could go, he has quietly
                      removed the ones he objected to.

SKILL NAME:           Arcane Missiles
CLASS / TREE / TIER:  mage / Refraction / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                multi-target (volley)
RANGE:                range long (420px)
TARGETS:              4 missiles, each seeking a separate target where
                      available (port change — see COST)
--- output ---
DAMAGE TIER:          low (9 per missile)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (3+ within 420px)
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per missile; +1 missile every 4th rank
--- identity ---
ENGINE:               consumes 10 energy
COST:                 thirty-six damage split four ways means it kills
                      nothing on its own and finishes several things at once.
                      Against high-health enemies it is the worst skill in
                      the class; against a wave of chaff it is the best
VISUAL:               four separate darts leaving at four separate moments,
                      each correcting mid-flight
FLAVOR:               Missiles, plural, and the plural is the whole design.
                      One of anything can be avoided. He stopped finding that
                      interesting some time ago.

> **Port change flagged:** ToH's Arcane Missiles is single-target for 9
> damage — the lowest number in the class, and the name is plural. I made it
> a four-missile volley. Flagged.

SKILL NAME:           Arcane Leech Shot
CLASS / TREE / TIER:  mage / Refraction / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range short (160px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (20)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               restores 6 energy per enemy, maximum 4 enemies — 24
                      energy at best (code value, unchanged)
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              COOLDOWN_READY when energy is below 50 and 2+ enemies
                      are within 160px
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +1 energy per enemy every 3rd rank
--- identity ---
ENGINE:               feeds — one of the three derived energy nodes. At full
                      value it returns 24 for a cast that cost 15, which is
                      the only profitable attack in the class
COST:                 a hundred and sixty pixels. The Mage's energy refill
                      requires him to be near four enemies, which is where
                      he dies. Every one of this class's economic skills asks
                      him to close, and that is either elegant or cruel
                      depending on how the run is going
VISUAL:               a thin dark bolt with a return thread; the thread stays
                      attached for a beat and reels something back
FLAVOR:               He is not stealing anything they were using. Most of
                      what is in a living thing is being wasted continuously
                      and he has simply set up downstream of it.

SKILL NAME:           Arcane Absorption
CLASS / TREE / TIER:  mage / Refraction / tier_code 6
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               scene-keyed [declared, not derived] — "ambient arcana
                      seeps back into you: +4 energy/sec regeneration"
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +1 energy per second per rank (not damage)
--- identity ---
ENGINE:               feeds, and it more than doubles the class baseline —
                      3/sec becomes 7/sec. This single node is the difference
                      between a Mage who can run five actives and one who can
                      run three
COST:                 it produces no damage, no control, and nothing visible.
                      A player who has not understood the energy economy will
                      look at this node, see no number they recognise, and
                      skip it — and then wonder why their character keeps
                      going quiet
VISUAL:               nothing on the character. The energy bar refills
                      visibly faster and that is the entire effect
FLAVOR:               The room is full of it. It has always been full of it.
                      What most people call talent is a slightly reduced
                      resistance to noticing.

SKILL NAME:           Mana Surge
CLASS / TREE / TIER:  mage / Refraction / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               restores 40 energy instantly (code value, unchanged)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              COOLDOWN_READY when energy is below 25
THREAT:               none
--- growth ---
RANK ADDS:            +8 energy restored per rank; −1s cooldown every 5th
                      rank, floor 12s
--- identity ---
ENGINE:               feeds — costs nothing, returns 40. It is the class's
                      panic button for the resource rather than for the
                      health bar, which no other class in the roster has
COST:                 a slot that never deals damage, never prevents damage,
                      and does nothing at all if the build is not
                      energy-starved. On a lean three-active Mage it is a
                      wasted slot; on an eight-active Mage it is the only
                      reason the build functions
VISUAL:               a sharp inhale and a brief violet bloom at the chest;
                      the bar jumps
FLAVOR:               There is a reserve. There has always been a reserve.
                      He has never found out what it is a reserve of and has
                      developed a policy of not investigating.

SKILL NAME:           Black Hole
CLASS / TREE / TIER:  mage / Refraction / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r180, pulsing)
RANGE:                range short (180px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (10 per pulse)
PACE:                 very slow (8000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               pull up to 10px per pulse toward the centre
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (6+ within 250px)
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per pulse; +2px pull per pulse every 3rd
                      rank; +1 pulse every 5th rank
--- identity ---
ENGINE:               feeds — repeated pulls at +2 each make this the
                      steadiest energy income in the class, better than the
                      leech and without the 160px requirement
COST:                 it is Singularity Collapse two tiers early with half
                      the numbers, and it will frequently be the reason the
                      Mage's capstone has nothing left to gather. Running
                      both means two of eight slots doing the same job
VISUAL:               a small dense absence that everything drifts toward in
                      increments — it never grabs, it just never stops
FLAVOR:               Nothing dramatic about it. It is simply that leaving
                      has become slightly more expensive than staying, and
                      the difference compounds.

SKILL NAME:           Entangled Chains
CLASS / TREE / TIER:  mage / Refraction / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (area at target)
RANGE:                range medium (300px)
TARGETS:              4 bound
--- output ---
DAMAGE TIER:          none (0)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               binds 4 enemies for 8000ms. 40% of damage dealt to any
                      bound enemy is dealt to all others, and any stun, slow
                      or root applied to one applies to all four (ruling 5)
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 300px, preferring clusters
                      containing the highest-health enemies
THREAT:               none
--- growth ---
RANK ADDS:            +5% share ratio per rank; +1 bound target every 4th
                      rank; +1s duration every 4th rank
--- identity ---
ENGINE:               consumes 25 energy
COST:                 zero damage at tier 10. It is a force multiplier with
                      no force of its own — bound to four enemies the Mage
                      then fails to hit, it is thirty seconds of nothing. It
                      is also the only skill in the roster that turns a
                      single-target build into an area build, and Photon Beam
                      through four chained enemies is the highest damage this
                      class can produce
VISUAL:               four lines of violet light between four enemies,
                      taut, and every wound appearing simultaneously on all
                      of them in miniature
FLAVOR:               Two things that have interacted are never entirely
                      separate afterward. This is not mysticism; it is
                      bookkeeping, and he has simply started presenting the
                      invoice.

---

## TREE: CRYSTALBLADE

Role read: **the melee bruiser, and the reason a Mage might survive contact.**
Ten skills, seven of them inside 150px, built around a stacking mechanic that
pays off in one enormous detonation. It is the strangest tree the class has —
a caster who has decided the answer is to be holding something.

---

SKILL NAME:           Crystal Shard
CLASS / TREE / TIER:  mage / Crystalblade / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (circle r40 at nearest)
RANGE:                range medium (300px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          medium (22)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               slow ×0.6 for 2500ms; applies 1 crystal stack (ruling 1)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (300px)
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +300ms slow every 3rd rank
--- identity ---
ENGINE:               consumes 6 energy
COST:                 it is the only ranged skill in the tree, which means a
                      Crystalblade Mage's one safe option is his tier-1 node
                      and everything he unlocks afterward asks him to walk
                      forward
VISUAL:               a shard that does not travel — it forms at the target
                      and breaks, leaving glittering fragments embedded
FLAVOR:               The lattice wants to be a certain shape. All he does is
                      stop apologising for where it decides to grow.

SKILL NAME:           Encapsulation
CLASS / TREE / TIER:  mage / Crystalblade / tier_code 1
TYPE:                 passive (converted from an ungrouped toggle — ruling 2)
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
RIDERS:               stat mods: damageMult +0.35
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +7% damage multiplier per rank — global, applies to
                      every tree
--- identity ---
ENGINE:               neutral
COST:                 there is not one, and that is the problem. A +35%
                      global damage multiplier at tier 2 with no drawback and
                      no rank cap is the strongest node in the class and
                      possibly the roster — see note
VISUAL:               a thin crystalline sheath over the hands and forearms
                      that catches the light differently as it thickens with
                      rank
FLAVOR:               He encased his own hands. It was not, he insists, the
                      first thing he tried, and he declines to say what was.

> **Balance flag:** +35% global damage at tier 2, always on, no drawback,
> unlimited ranks. At rank 20 it is +168% on everything the character owns.
> This is the same problem as Blacksmith's Berserker's Edge but larger and
> five tiers earlier. Cap the rank scaling, add a drawback, or narrow it to
> Crystalblade skills only. My numbers assume it stays global.

SKILL NAME:           Crystal Strike
CLASS / TREE / TIER:  mage / Crystalblade / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r70)
RANGE:                melee short (70px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               applies 1 crystal stack (ruling 1)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (70px)
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +1 target every 5th rank
--- identity ---
ENGINE:               consumes 6 energy
COST:                 seventy pixels on a Mage. It is the tree's stack engine
                      and the reason Shatter works, and paying for it means
                      standing where a Blacksmith stands with a Mage's
                      health bar
VISUAL:               a short hard strike with a crystalline edge that leaves
                      fragments in the wound
FLAVOR:               A blade is a lattice arranged to have one very
                      committed opinion about direction. He grows his and
                      does not sharpen them.

SKILL NAME:           Crystal Empowerment
CLASS / TREE / TIER:  mage / Crystalblade / tier_code 3
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
RIDERS:               stat mods: damageMult +0.15
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +4% damage multiplier per rank
--- identity ---
ENGINE:               neutral
COST:                 it is Encapsulation with less than half the magnitude,
                      two tiers later, in the same tree. There is no reason
                      to take this before that one is maxed, and the tree
                      does not say so
VISUAL:               the crystal growths extend past the forearm to the
                      shoulder
FLAVOR:               More of it. He has been asked whether there is a limit
                      and has said that he expects to find out.

SKILL NAME:           Crystal Flurry
CLASS / TREE / TIER:  mage / Crystalblade / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r66)
RANGE:                melee short (66px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          low (9 × 3 pulses = 27)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               3 pulses 130ms apart, each rolling its own hits and
                      each applying a crystal stack — 3 stacks in one cast
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (66px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage per pulse; +1 pulse every 6th rank
--- identity ---
ENGINE:               consumes 10 energy
COST:                 twenty-seven damage is poor for the tier. What it
                      actually is, is the fastest stack applicator in the
                      class — three stacks per cast — which means its value
                      is entirely contingent on Crystal Shatter being slotted
                      four tiers later
VISUAL:               three quick strikes at different angles, each leaving
                      a different colour of fragment
FLAVOR:               Not faster. More often, in less space, with less
                      returning between. There is a difference and it took
                      him a decade to feel it.

SKILL NAME:           Facet Cleave
CLASS / TREE / TIER:  mage / Crystalblade / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r150)
RANGE:                range short (150px)
TARGETS:              cap 6
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 medium (2000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               weaken 15% for 4000ms; applies 1 crystal stack to every
                      target hit
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 150px)
THREAT:               some
--- growth ---
RANK ADDS:            +5 damage; +2% weaken every 2nd rank; +1 target every
                      4th rank
--- identity ---
ENGINE:               consumes 10 energy
COST:                 a 15% weaken is the smallest debuff magnitude in the
                      roster and will not be felt. The skill's real job is
                      applying stacks to six enemies at once, and nothing in
                      its presentation says so
VISUAL:               a wide arc that splits into several planes as it
                      travels, each catching a different target
FLAVOR:               One cut, refracted. He is fairly sure that is not what
                      is happening and has not found a better description.

SKILL NAME:           Crystal Pulse
CLASS / TREE / TIER:  mage / Crystalblade / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r130 on caster)
RANGE:                melee long (130px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               knockback 130px; knockback-stun 200ms; applies 1 crystal
                      stack before the knockback resolves
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (130px)
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +15px knockback every 3rd rank
--- identity ---
ENGINE:               consumes 15 energy
COST:                 it scatters, and the Spacetime tree spent five nodes
                      gathering. In a Spacetime/Crystalblade hybrid this
                      skill is actively undoing the other half of the build,
                      and it is the only survival tool the melee tree has
VISUAL:               a hard outward ring of forming and breaking crystal at
                      chest height; enemies go back and leave fragments
                      hanging in the air
FLAVOR:               A lattice under stress does not bend. It holds, and
                      holds, and then distributes the entire disagreement at
                      once in every direction.

SKILL NAME:           Crystal Shatter
CLASS / TREE / TIER:  mage / Crystalblade / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (r200 on caster; detonates banked stacks)
RANGE:                range short (200px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (12 per banked stack)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               consumes every crystal stack on every enemy within
                      200px, dealing 12 per stack (ruling 1). A pack of eight
                      at 5 stacks each is 480 damage from one cast
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              COOLDOWN_READY when total banked stacks within 200px
                      exceeds 12 — it waits for the bank to be worth breaking
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage per stack; +1 to the per-enemy stack ceiling
                      every 5th rank; +10px radius every 3rd rank
--- identity ---
ENGINE:               consumes 15 energy
COST:                 it deals nothing on its own. Every point of its damage
                      was paid for earlier by a melee skill landing at 70px,
                      and if the stacked enemies die before it fires, the
                      whole investment evaporates with them. It is the
                      highest-ceiling and highest-variance skill in the class
VISUAL:               every fragment embedded in every enemy in the radius
                      goes off at once, outward, and the air is briefly full
                      of glass
FLAVOR:               He does not break them. He put something in them some
                      time ago and it has been waiting, patiently, for
                      permission that he was always going to give.

> **AUTHORED:** the export gives "detonates banked stacks" with no banking
> mechanic anywhere in the code. Stack application, the 5-per-enemy ceiling,
> and the 12-per-stack payout are mine (ruling 1). This is the largest
> invention in the class and the whole tree now depends on it — review it
> first.

SKILL NAME:           Crystal Nova
CLASS / TREE / TIER:  mage / Crystalblade / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r180 on caster)
RANGE:                range short (180px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               applies 2 crystal stacks to everything hit
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 180px)
THREAT:               high
--- growth ---
RANK ADDS:            +6 damage; +8px radius every 3rd rank
--- identity ---
ENGINE:               consumes 15 energy
COST:                 it is Crystal Pulse without the knockback and with
                      more damage, two tiers later, on the same cooldown.
                      The absence of the knockback is the point — Nova stacks
                      the pack and leaves it standing where Shatter can reach
                      it, where Pulse would have scattered it
VISUAL:               a full outward bloom of crystal from the caster's feet
                      in every direction, growing and breaking in the same
                      motion
FLAVOR:               Everything he has learned about the lattice, expressed
                      all at once, in a shape that does not require anyone
                      to be standing in a particular direction.

SKILL NAME:           Perfect Edge
CLASS / TREE / TIER:  mage / Crystalblade / tier_code 9
TYPE:                 transformation
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 capstone (25000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               form 12000ms — attackSpeedMult +0.50, lifestealPct
                      0.15, multi-strike 2 (converted from basicHitCount: 2,
                      Blacksmith ruling 1)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (6+ within 150px), gated on 50 energy
THREAT:               none
--- growth ---
RANK ADDS:            +8% attack speed and +3% lifesteal per rank; +500ms
                      duration every 4th rank
--- identity ---
ENGINE:               consumes 25 energy — and multi-strike 2 with +50%
                      attack speed means every melee skill fires three times
                      as often for twelve seconds, which triples the energy
                      burn and triples the stack application. It is the
                      Shatter setup window
COST:                 it is the only sustain the class has and it is
                      available once a minute for twelve seconds, and it only
                      works while he is in melee range of six enemies. The
                      Mage's answer to being overwhelmed is to become better
                      at being overwhelmed
VISUAL:               the crystal reaches the face and the movement becomes
                      too clean — no wasted return, every strike ending
                      exactly where the next one begins
FLAVOR:               There is a configuration the lattice arrives at when
                      nothing is obstructing it. It is not something he
                      makes. It is what is there when he has finally stopped
                      interfering.
