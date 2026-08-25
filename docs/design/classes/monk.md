# MONK — RUMBLEJAM CONVERSION (30 skills)

Mechanical fields carried from the code export unchanged. Eight judgment
fields authored. Class-wide rulings stated once here.


---

## ROSTER RULING APPLIED

**Engine — RULED: Chi (doc, as an oscillator).**

**Tree names — built names win.** Iron Palm→Empty Hand, Chi→Chi, Spirit→Stone Garden


**Tree contents — the document wins**, per the standing rule. Applied without
further asking; divergences from the built tree are what this file already
describes.

**Pace (ruling 1).** Every timed active rebucketed to the fixed values, then
brought into the bucket-mix rule — at least **3** nodes fast-or-better per tree,
at most 1 very fast, at most 2 very slow. All three trees comply.

**Rate: 6.67/sec on a spread build — IN BAND.**

**Ruling 6 (rider duration under cooldown) — APPLIED.** 6 rider durations cut across 6 skills, each to ~70% of its skill's new cooldown and each annotated inline with what it
was. Nothing fell under the 500ms floor, so no rider was deleted outright.

**Outstanding:** none.

---

## CLASS ENGINE — CHI (an oscillator, not a bank)

Every engine so far is one of two shapes: build upward and spend (Heat,
Conviction, Kinship, Resolve, Tempo, Shadow) or start full and deplete
(Mana, Energy). The Monk should be neither, because the class is about
balance and a meter that only goes one way cannot express that.

**CHI, 0–100.** Starts each run at 50.

**Iron Palm skills SPEND Chi. Chi and Spirit skills GENERATE it.**

Generates:
- Healing delivered, to anyone: **+1 per 10 HP**
- Blocking a hit: **+4**
- Any Chi-tree or Spirit-tree skill firing: **+6**
- Prayer Wheel, per pulse: **+1**

Spends:
- Every Iron Palm strike: **6**
- Hundred Hands **50** · Chi Explosion **50** · Enlightenment **60**

No passive regeneration at all, in either direction.

A pure Iron Palm Monk runs dry in about twenty seconds and stops punching. A
pure Chi Monk sits at a hundred with nothing to spend it on. **The Monk is
the only class in the roster whose eight slots must span at least two trees
to function** — not as a soft incentive but as a hard mechanical
requirement. That is the most thematically earned engine in the project and
it came out of the tree structure rather than being imposed on it.

---

## PORT RULINGS

**1. Prayer Wheel is the roster's only mobile aura and stays that way.** The
export is explicit: r130, follows the caster. Every other aura in the game
is anchored, which in a movement game means most of them are wasted. This
one is not, and it is the single best-adapted skill in ToH for RumbleJam.
Ranks buy radius and pulse rate.

**2. Divine Connection is a redirect, not a summon buff.** 30% of damage
meant for the player is split evenly across live summons, *before* block and
shield. Ruling: kept exactly, and it means the Monk's summons are a
mitigation layer rather than a damage layer — the only class that tanks
through other bodies without those bodies needing to hold aggro.

**3. Astral Projection is a decoy.** Timed magnet summon that does not
attack, same shape as the Wizard's Ice Golem. Ranks buy HP, lifespan and
magnet radius, never damage.

**4. Deflect is authored.** Zero damage, `CAST: projectile`, 6s cooldown,
no rider — an empty node whose name is unambiguous. Ruling: it destroys the
nearest incoming enemy projectile and returns it for the Monk's own damage.

**5. Empowered Strikes is authored.** Zero damage, 14s cooldown, line
movement path, no rider. Ruling: it arms the next 3 Iron Palm strikes to
deal +80% and cost no Chi.

**6. Tranquil State's 40 energy** has no referent, same as the Samurai's
Disciplined Breath. Redirected to Chi.

**7. Movement, allies, stealth, confusion, hazards** carry from earlier
classes. Silent Step uses the Assassin's flicker ruling.

---

## TREE: EMPTY HAND  (was Iron Palm in the source conversion)

Role read: **the melee DPS, and the tree that spends.** Nine strikes and a
stealth. It has the class's only sustained damage and it cannot run on its
own — every skill here costs Chi that this tree does not produce.

---

SKILL NAME:           Palm Strike
CLASS / TREE / TIER:  monk / Empty Hand / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r68)
RANGE:                melee short (68px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          low (19)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (68px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +1 target every 5th rank
--- identity ---
ENGINE:               spends 6 Chi per cast — at 2000ms that is 180 Chi a
                      minute, and nothing in this tree replaces it
COST:                 nineteen damage is the lowest tier-1 number in the
                      roster, and it is the Monk's metronome, and it drains
                      him. Palm Strike alone will empty a full bar in
                      seventeen seconds
VISUAL:               an open hand, planted rather than swung; the impact
                      travels through the target rather than into it
FLAVOR:               The hand is not hard. Hardness is what breaks. What he
                      has spent thirty years arranging is that nothing in the
                      arm objects to the arrival.

SKILL NAME:           Flurry of Blows
CLASS / TREE / TIER:  monk / Empty Hand / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
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
RIDERS:               3 pulses 130ms apart, each rolling its own hits
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (66px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage per pulse; +1 pulse every 6th rank
--- identity ---
ENGINE:               spends 6 Chi per cast, not per pulse — which makes it
                      the most Chi-efficient attack in the tree
COST:                 three pulses over 390ms against a swarm that keeps
                      moving, at sixty-six pixels. The second and third
                      frequently find nothing, and the skill's stated
                      twenty-seven is closer to eighteen in practice
VISUAL:               three strikes at three heights, the last one arriving
                      before the first has visibly finished
FLAVOR:               Not fast. Consecutive. There is nothing between them,
                      which is different from them being quick and much
                      harder to achieve.

SKILL NAME:           Sweeping Kick
CLASS / TREE / TIER:  monk / Empty Hand / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                fan (wide) (120° total)
RANGE:                melee long (90px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (18)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               slow ×0.6 for 840ms
                      — roster ruling 6: 2000ms→840ms (70% of the 1200ms cooldown)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 90px
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +300ms slow every 3rd rank; +6° cone width
                      every 4th rank
--- identity ---
ENGINE:               spends 6 Chi
COST:                 a two-second slow on a six-second cooldown means the
                      enemies it slowed are at full speed for four seconds
                      out of every six. It is the tree's only control and it
                      is barely one
VISUAL:               a low turning kick at ankle height across a wide arc;
                      everything caught stumbles rather than falls
FLAVOR:               The legs are longer and heavier and nobody watches
                      them. Three facts, in order of importance, and the
                      third is the one that matters.

SKILL NAME:           Flowing Movement
CLASS / TREE / TIER:  monk / Empty Hand / tier_code 3
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
RIDERS:               stat mods: moveSpeedMult +0.10, blockChance +0.12,
                      blockReduction 0.60
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2% move speed and +3% block chance per rank (not
                      damage)
--- identity ---
ENGINE:               generates indirectly — every block is +4 Chi, so
                      block chance is a Chi stat on this class and on no other
COST:                 it is the Assassin's Evasive Maneuvers with slightly
                      better numbers, and like that node it will read as
                      negligible on a tooltip. Ten percent movement is
                      quietly one of the strongest lines in the game
VISUAL:               he stops changing direction and starts curving; the
                      idle animation never fully settles
FLAVOR:               Stillness is a kind of movement that has agreed to
                      stay in one place. He was told this at nineteen, found
                      it insufferable, and has since found it accurate.

SKILL NAME:           Deflect
CLASS / TREE / TIER:  monk / Empty Hand / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 projectile (returned)
SHAPE:                single target
RANGE:                n/a — resolves on the incoming projectile
TARGETS:              1 incoming projectile, returned at its sender
--- output ---
DAMAGE TIER:          none (0) — the returned projectile carries the Monk's
                      damage
PACE:                 medium (2000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — destroys the nearest incoming enemy
                      projectile and returns it at the enemy that fired it,
                      dealing 30
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ON_DAMAGE_TAKEN from a projectile, or pre-emptively
                      when a projectile is within 60px of the Monk
THREAT:               some
--- growth ---
RANK ADDS:            +6 returned damage per rank; at rank 6 it deflects 2
                      projectiles per cast, +1 every 6 ranks
--- identity ---
ENGINE:               spends 6 Chi
COST:                 it does absolutely nothing in a room whose enemies do
                      not shoot, and the player cannot know which rooms those
                      are in advance. Highest-variance slot in the class
VISUAL:               one hand, moving late and arriving early; the
                      projectile leaves in the direction it came from and
                      slightly faster
FLAVOR:               He is not fast enough to catch it. Nobody is. What he
                      does is arrive at the place it is going to be and let
                      it make its own arrangements.

> **AUTHORED:** ToH's Deflect deals 0 damage with no rider on a 6s
> cooldown — an empty node. The name is unambiguous and the roster has no
> projectile counter, so I built one.

SKILL NAME:           Pressure Points
CLASS / TREE / TIER:  monk / Empty Hand / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r70)
RANGE:                melee short (70px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          low (14)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               weaken 30% for 2800ms
                      — roster ruling 6: 5000ms→2800ms (70% of the 4000ms cooldown)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — nearest enemy not already weakened
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage; +2% weaken every 2nd rank; +400ms duration
                      every 3rd rank
--- identity ---
ENGINE:               spends 6 Chi
COST:                 fourteen damage. A thirty percent weaken for five
                      seconds is real mitigation and it is entirely
                      invisible — nothing on screen tells the player it
                      worked, and the damage number attached to it is the
                      second-lowest in the tree
VISUAL:               two fingers, placed rather than struck, at three points
                      in quick succession; the enemy's next swing arrives
                      without conviction
FLAVOR:               There is a map. It is very old and mostly correct and
                      the parts that are wrong have been wrong for so long
                      that nobody is willing to fix them.

SKILL NAME:           Rising Dragon
CLASS / TREE / TIER:  monk / Empty Hand / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                line (movement path)
RANGE:                range short (180px)
TARGETS:              each enemy in path once, uncapped
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               knockdown — stun 400ms per enemy hit; caster displaced
                      180px
DOT:                  none
AFFECTS:              enemies, self (movement)
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (80px) — direction resolved away
                      from the densest cluster per the movement ruling
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +100ms knockdown every 3rd rank; +15px
                      distance every 4th rank
--- identity ---
ENGINE:               spends 6 Chi
COST:                 four hundred milliseconds of knockdown is the shortest
                      stun in the roster — barely a stagger. The dash is the
                      real function and it is the shortest dash too, at
                      180px, which makes it the least useful escape of the
                      nine in the game
VISUAL:               a rising strike that carries him forward and up; the
                      enemies caught go over rather than back
FLAVOR:               Up is not a direction anyone expects a fight to go.
                      That has been true in every country he has fought in
                      and he has stopped expecting it to stop being true.

SKILL NAME:           Empowered Strikes
CLASS / TREE / TIER:  monk / Empty Hand / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none (arms the next 3 Iron Palm strikes)
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0) at cast
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — the next 3 Iron Palm strikes deal +80% and
                      cost NO Chi
DOT:                  none
AFFECTS:              self + enemies (deferred)
--- automation ---
TRIGGER:              COOLDOWN_READY when Chi is below 40 — it is as much a
                      resource skill as a damage skill
THREAT:               none
--- growth ---
RANK ADDS:            +10% to the bonus per rank; +1 armed strike every 5th
                      rank
--- identity ---
ENGINE:               spends nothing and saves 18 Chi across the three free
                      strikes — it is the Iron Palm tree's only concession to
                      its own resource problem
COST:                 it does nothing by itself, and in an auto-fire game the
                      player does not choose which three strikes get armed.
                      Fourteen seconds spent making whatever fires next
                      slightly better
VISUAL:               the forearms take a faint heat-shimmer; each of the
                      next three impacts lands with a deeper sound than it
                      should
FLAVOR:               Nothing is added. He simply stops holding back three
                      of them, and the holding back was never anything he
                      had chosen to be doing.

> **AUTHORED:** ToH's Empowered Strikes deals 0 damage with no rider on a
> 14s cooldown. Empty node. I made it an armed-state that also solves the
> tree's Chi starvation, which is the more interesting of the two things it
> could have been.

SKILL NAME:           Silent Step
CLASS / TREE / TIER:  monk / Empty Hand / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               stealth 4500ms, flickering per the Assassin's ruling —
                      attacking drops concealment for 2000ms and it re-enters
                      while the buff runs
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (40%)
THREAT:               none — a threat dump
--- growth ---
RANK ADDS:            +400ms stealth per rank; −150ms re-entry delay every
                      4th rank
--- identity ---
ENGINE:               spends 6 Chi
COST:                 four and a half seconds of intermittent concealment
                      with no damage bonus attached — the Monk has no
                      stealthBonus, so unlike the Assassin he gets nothing
                      out of hiding except not being hit. It is an escape
                      and only an escape
VISUAL:               he does not fade; he simply stops registering as
                      something worth turning toward, and the enemies' heads
                      track past
FLAVOR:               Lhasa is very quiet at altitude. He learned to walk
                      there and did not realise until much later that
                      everyone else had learned somewhere louder.

SKILL NAME:           Hundred Hands
CLASS / TREE / TIER:  monk / Empty Hand / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                chain (auto-cascading strikes)
RANGE:                melee long (140px per link)
TARGETS:              cascades from target to target for 6000ms
--- output ---
DAMAGE TIER:          low (11 per strike)
PACE:                 capstone (25000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               auto-casts a chain of strikes over the duration, each
                      finding the nearest enemy to the last
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (8+ within 200px), gated on 50 Chi
THREAT:               high
--- growth ---
RANK ADDS:            +2 damage per strike; +500ms cascade duration every
                      4th rank
--- identity ---
ENGINE:               spends 50 Chi — half the bar, on a class that can only
                      refill it by casting from the other two trees. A
                      Hundred Hands Monk is silent for the ten seconds
                      afterward unless his Chi tree is slotted
COST:                 fifty-five seconds for eleven damage a strike. It is
                      the weakest capstone number in the class and its case
                      is volume — but the volume arrives in a class that
                      cannot afford the Chi to pay for it
VISUAL:               he stops being resolvable. The strikes are visible as
                      the afterimages of a great many arms and he is standing
                      exactly where he started when it ends
FLAVOR:               A hundred is not a count. It is the number the
                      language reaches for when it has stopped attempting to
                      be accurate and started attempting to be true.

---

## TREE: CHI

Role read: **the generator, and the class's healer half.** Heals, a cleanse,
a shield, and the game's only skill that damages and heals in the same cone.
Nothing here spends; everything here fills the bar the Iron Palm tree
empties. It is not optional — it is the other half of one machine.

---

SKILL NAME:           Chi Wave
CLASS / TREE / TIER:  monk / Chi / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                cone (narrow) (60° total)
RANGE:                range short (210px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (18)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               heals 10 to the Monk, his summons and any ally within
                      the 210px cone, in the same cast
DOT:                  none
AFFECTS:              enemies + own summons + self
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (210px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage and +3 heal per rank
--- identity ---
ENGINE:               generates +6 as a Chi-tree skill, plus +1 per 10 healed
                      — roughly +7 a cast at rank 1, and at 2800ms it is the
                      class's primary income. Chi Wave is what pays for Palm
                      Strike
COST:                 a sixty-degree wedge that has to be pointed at enemies
                      to damage and at friendlies to heal, and those are
                      rarely the same direction. The heal half will
                      frequently land on nobody
VISUAL:               a widening band of pale light; where it crosses an
                      enemy it darkens, where it crosses a friend it warms
FLAVOR:               The same motion. He has never made a separate gesture
                      for helping and one for harming and finds the idea that
                      one should slightly embarrassing.

SKILL NAME:           Inner Focus
CLASS / TREE / TIER:  monk / Chi / tier_code 1
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               stat mods: damageMult +0.12
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +3% damage multiplier per rank — global
--- identity ---
ENGINE:               neutral
COST:                 the fifth uncapped global damage multiplier in the
                      roster. Same shape as Berserker's Edge, Encapsulation,
                      Perfect Pitch and Throwing Mastery, and it wants the
                      same rule
VISUAL:               nothing visible
FLAVOR:               Focus is subtraction. Everyone assumes it is
                      concentration, which is addition, and gets tired.

SKILL NAME:           Soothing Palm
CLASS / TREE / TIER:  monk / Chi / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               heals 30 to self
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (70%)
THREAT:               none
--- growth ---
RANK ADDS:            +8 heal per rank
--- identity ---
ENGINE:               generates +6 plus +3 for the healing — one of the
                      cheapest ways to refill the bar
COST:                 thirty health on a ten-second cooldown, which is a
                      good rate and a poor burst. Against the spike damage
                      that actually kills in this game it arrives having
                      already been too late
VISUAL:               one hand placed flat against the sternum for a
                      half-beat; nothing else changes
FLAVOR:               He is not repairing anything. He is declining to
                      continue an argument the body had been losing.

SKILL NAME:           Tranquil State
CLASS / TREE / TIER:  monk / Chi / tier_code 3
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
RIDERS:               restores 40 Chi instantly (the code's 40 energy,
                      redirected — ruling 6)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              COOLDOWN_READY when Chi is below 25
THREAT:               none
--- growth ---
RANK ADDS:            +8 Chi restored per rank; −1s cooldown every 5th rank,
                      floor 9s
--- identity ---
ENGINE:               generates +6 as a Chi skill *plus* the 40 restore — by
                      a wide margin the largest single Chi event in the class
COST:                 a slot that deals nothing, prevents nothing and heals
                      nothing. On a Chi-heavy build it is redundant, because
                      that build is already full. On an Iron Palm build it is
                      mandatory, because that build is always empty. It is
                      the node that tells you which Monk you are
VISUAL:               he stops entirely for one beat and everything about the
                      posture resets to neutral
FLAVOR:               Not calm. Calm is a mood and moods are weather. This is
                      the deliberate business of returning to the position
                      from which any of the options are still available.

SKILL NAME:           Restorative Touch
CLASS / TREE / TIER:  monk / Chi / tier_code 4
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               stat mods: lifestealPct 0.08
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2% lifesteal per rank
--- identity ---
ENGINE:               generates — lifesteal is healing, and healing is
                      +1 per 10. An Iron Palm Monk running this converts his
                      own damage back into Chi, which is the only way the
                      aggressive build closes its own loop
COST:                 eight percent is the smallest lifesteal in the roster
                      and it scales off damage dealt, so it gives him nothing
                      in the moment he most needs it: when he is not landing
                      anything
VISUAL:               a faint pale return along the arm on each connecting
                      strike
FLAVOR:               Nothing is taken. He would insist on this. Something
                      that was going to be lost anyway is instead directed
                      somewhere it can still be of use.

SKILL NAME:           Revitalizing Aura
CLASS / TREE / TIER:  monk / Chi / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r120 at caster, persistent 15000ms)
RANGE:                melee long (120px)
TARGETS:              every ally and summon in the field
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  heals 4 per 1000ms for 15000ms — 60 per friendly who
                      stays in it
AFFECTS:              allies + own summons
--- automation ---
TRIGGER:              COOLDOWN_READY when 2+ friendlies are below 75% within
                      120px
THREAT:               none
--- growth ---
RANK ADDS:            +1 heal per tick per rank; +3s duration every 4th rank;
                      +8px radius every 3rd rank
--- identity ---
ENGINE:               generates steadily — fifteen seconds of ticking heals
                      across several bodies is a large slow Chi block
COST:                 anchored. It is Prayer Wheel's opposite in the same
                      class — one tree over sits a mobile aura that follows
                      him, and this one does not, and the comparison is not
                      kind
VISUAL:               a soft green-gold disc with slow radial motion in it
FLAVOR:               A place where the work of staying alive is briefly
                      subsidised. He has never been able to make one that
                      travels and it has bothered him for years.

SKILL NAME:           Acupuncture
CLASS / TREE / TIER:  monk / Chi / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
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
RIDERS:               strips ONE harmful effect, in the code's own priority
                      order — DoT stack, then slow, then weaken, then poison
                      weaken — and heals 20. Returns "nothing to strip" if
                      clean
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              ON_DAMAGE_TAKEN, gated to fire only when carrying at
                      least one affliction — otherwise it wastes itself on
                      the heal
THREAT:               none
--- growth ---
RANK ADDS:            +6 heal per rank; at rank 5 it strips a second effect,
                      +1 every 5 ranks
--- identity ---
ENGINE:               generates +6 plus +2 for the heal
COST:                 one affliction at rank 1, which against a stacked DoT
                      is a rounding error. It is a scalpel in a class that
                      keeps getting hit with several things at once, and it
                      does not become a real cleanse until rank 5
VISUAL:               three needles, placed without looking, and whatever was
                      clinging to him detaches at one specific point
FLAVOR:               The needle does not do anything. That is the part
                      nobody believes. The needle is a very precise way of
                      drawing attention to a place, and the body does the
                      rest because it had simply not been looking.

SKILL NAME:           Life Infusion
CLASS / TREE / TIER:  monk / Chi / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range long (400px)
TARGETS:              1 — the most-injured ally (co-op) or summon (solo)
--- output ---
DAMAGE TIER:          none (0)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               heals 30 to the target; COSTS the Monk 15 HP, bypassing
                      shields. Refused at ≤15 HP in code; the Priest's 35%
                      floor applies here too
DOT:                  none
AFFECTS:              allies + own summons
--- automation ---
TRIGGER:              ALLY_HP_BELOW_X (50%)
THREAT:               none
--- growth ---
RANK ADDS:            +8 heal per rank. The 15 HP cost does not scale
--- identity ---
ENGINE:               generates +6 plus +3 for the healing, and the HP spend
                      is not Chi — unlike the Priest, the Monk gets no engine
                      credit for bleeding
COST:                 fifteen of his for thirty of theirs. In a Divine
                      Connection build his summons are already absorbing 30%
                      of everything aimed at him, so keeping them alive is
                      keeping himself alive — which makes this a self-heal
                      with extra steps and a worse ratio
VISUAL:               a line of pale gold that runs from his chest to the
                      target; he loses colour for the beat it takes
FLAVOR:               There is only so much of it in the room at any moment.
                      He has never accepted this and has spent his life
                      moving it around as though the total were negotiable.

SKILL NAME:           Chi Barrier
CLASS / TREE / TIER:  monk / Chi / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
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
RIDERS:               absorb shield 50 for 2800ms
                      — roster ruling 6: 5000ms→2800ms (70% of the 4000ms cooldown)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (140px)
THREAT:               none
--- growth ---
RANK ADDS:            +12 absorb per rank; +400ms duration every 4th rank
--- identity ---
ENGINE:               generates +6
COST:                 fifty absorb for five seconds is the smallest shield in
                      the roster, tied with the Bard's, and it sits at tier 9
                      where the player expects something substantial. Its
                      real argument is that it is Chi income that happens to
                      also stop damage
VISUAL:               a translucent shell with visible circulation in it,
                      thinning as it is spent
FLAVOR:               Not a wall. Walls are somebody else's idea. This is a
                      quantity of intention, arranged just outside the skin,
                      and it lasts exactly as long as the intention does.

SKILL NAME:           Chi Explosion
CLASS / TREE / TIER:  monk / Chi / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r170 on caster)
RANGE:                range short (170px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (36)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               heals 26 to the Monk, his summons and every ally in the
                      same 170px radius
DOT:                  none
AFFECTS:              enemies + own summons + self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (7+ within 170px), gated on 50 Chi
THREAT:               high
--- growth ---
RANK ADDS:            +6 damage and +5 heal per rank; +8px radius every 3rd
                      rank
--- identity ---
ENGINE:               spends 50 Chi — the only skill in this tree that
                      spends. It is the moment the Monk cashes the bar in
COST:                 fifty seconds and half the bar, and it wants enemies
                      and allies in the same 170px circle simultaneously. It
                      is the class's biggest number and it requires the exact
                      crowded position the Monk's whole kit is trying to
                      survive
VISUAL:               everything within a wide radius takes it at once, and
                      the same light that breaks the enemies visibly closes
                      the wounds on everyone else
FLAVOR:               He does not divide it into a healing part and a harming
                      part. It arrives entire and each thing standing in it
                      receives the portion its own arrangement permits, which
                      is the closest thing to a moral position he holds.

---

## TREE: STONE GARDEN  (was Spirit in the source conversion)

Role read: **the tank spec, via other bodies.** A damage redirect, a decoy
summon, a mobile aura, a reflect and two control fields. It is where the
Monk stops being a martial artist and becomes the roster's strangest
mitigation class — one that survives by distributing damage rather than
reducing it.

---

SKILL NAME:           Force Palm
CLASS / TREE / TIER:  monk / Stone Garden / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range short (220px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (18)
PACE:                 fast (1200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (220px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; at rank 7 it pierces 1 additional enemy
--- identity ---
ENGINE:               generates +6 as a Spirit-tree skill — which makes it
                      the only *attack* in the class that fills the bar
                      instead of draining it
COST:                 eighteen damage at 220px. It is strictly worse than
                      Palm Strike on raw output and strictly better on
                      resource, and choosing between them is choosing which
                      Monk you are playing
VISUAL:               the strike is thrown rather than landed — the hand does
                      not travel and the impact does
FLAVOR:               The distance is not an obstacle he has overcome. It is
                      simply not information he considers relevant to the
                      transaction.

SKILL NAME:           Enigmatic Presence
CLASS / TREE / TIER:  monk / Stone Garden / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range medium (300px)
TARGETS:              1 (nearest)
--- output ---
DAMAGE TIER:          none (0) — chip 8 per 600ms during the confusion
PACE:                 fast (1200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               CONFUSION 80% for 840ms — the target attacks other
                      enemies and its threat on the Monk drops to zero
                      — roster ruling 6: 3500ms→840ms (70% of the 1200ms cooldown)
DOT:                  8 per 600ms for the confusion's duration
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (120px), preferring the
                      highest-health enemy in range
THREAT:               none — a threat removal
--- growth ---
RANK ADDS:            +2 chip damage per tick; +400ms confusion per rank
--- identity ---
ENGINE:               generates +6
COST:                 one target for three and a half seconds. In a swarm of
                      thirty it removes one, temporarily, and the one it
                      removes comes back. Against a single large enemy it is
                      the best skill the Monk owns
VISUAL:               he simply looks at it. The enemy stops, reconsiders,
                      and turns on whatever is nearest that is not him
FLAVOR:               He is not doing anything. He would like this stated
                      plainly and does not expect to be believed. Some
                      creatures, looked at steadily enough, arrive at their
                      own conclusions.

SKILL NAME:           Divine Connection
CLASS / TREE / TIER:  monk / Stone Garden / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns adjacent)
TARGETS:              n/a — cap 1
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               while any summon lives, 30% of all damage meant for the
                      Monk is redirected onto live summons, split evenly,
                      BEFORE block and shield apply (ruling 2)
DOT:                  none
AFFECTS:              allies + own summons
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on being under cap
THREAT:               none — the redirect is not aggro; enemies keep
                      attacking him and the damage simply arrives elsewhere
--- growth ---
RANK ADDS:            +2% redirect per rank, ceiling 60%; +15% summon HP per
                      rank
--- identity ---
ENGINE:               generates +6
COST:                 it is mitigation that kills his own summons. Every
                      point of damage he does not take is a point one of his
                      bodies did, and when they run out the redirect stops
                      with them. It is the only defensive skill in the game
                      that has a supply problem
VISUAL:               a thin thread of light from the Monk to each living
                      summon; hits on him flash along the threads
FLAVOR:               Shared is the wrong word and he uses it anyway. Nothing
                      is halved. It is moved, in full, onto something that
                      agreed to be there.

SKILL NAME:           Enlightened Mind
CLASS / TREE / TIER:  monk / Stone Garden / tier_code 3
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
DOMAIN:               mental
--- effects ---
RIDERS:               stat mods: blockChance +0.15, blockReduction 0.50
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +3% block chance and +2% block reduction per rank,
                      ceiling 80% (not damage)
--- identity ---
ENGINE:               generates — every block is +4 Chi, which makes block
                      chance the Monk's only passive income source and this
                      node the best version of it
COST:                 fifteen percent of half the damage is a small number,
                      and it is variance. On any other class this would be a
                      weak defensive passive; on the Monk it is a resource
                      node wearing a defensive passive's clothes
VISUAL:               blows arrive and are turned aside at the forearm
                      without any visible decision preceding it
FLAVOR:               He does not see it coming. Seeing it coming would be
                      too slow. Something rather further back than seeing has
                      already made arrangements.

SKILL NAME:           Astral Projection
CLASS / TREE / TIER:  monk / Stone Garden / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns adjacent)
TARGETS:              n/a — 1 decoy, timed
--- output ---
DAMAGE TIER:          none (0) — it never attacks
PACE:                 very slow (8000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               MAGNET aggro decoy — pulls enemy targeting onto itself
                      and does nothing else. Counts as a live summon for
                      Divine Connection's redirect (ruling 3)
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 250px), gated on the decoy
                      being expired
THREAT:               high (delegated — this is the Monk's taunt)
--- growth ---
RANK ADDS:            +20% decoy HP per rank; +2s lifespan every 3rd rank;
                      +15px magnet radius every 3rd rank (never damage)
--- identity ---
ENGINE:               generates +6
COST:                 it deals nothing and it expires. Twenty-two seconds for
                      a temporary wall that is also a temporary Divine
                      Connection battery, and when it goes both jobs stop at
                      once
VISUAL:               a second Monk, translucent and slightly out of step,
                      standing calmly while things attack it
FLAVOR:               It is not a copy and it is not a trick and he has
                      stopped attempting the third explanation. It is where
                      the rest of him is, and the rest of him is very
                      difficult to injure.

SKILL NAME:           Karma's Embrace
CLASS / TREE / TIER:  monk / Stone Garden / tier_code 5
TYPE:                 buff
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 fast (1200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               timed 840ms — reflectPct 0.30
                      — roster ruling 6: 8000ms→840ms (70% of the 1200ms cooldown)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 150px)
THREAT:               none
--- growth ---
RANK ADDS:            +4% reflect per rank; +400ms duration every 4th rank
--- identity ---
ENGINE:               generates +6
COST:                 thirty percent returned requires taking the other
                      seventy, and it interacts badly with Divine Connection
                      — damage redirected onto a summon is damage the Monk
                      did not take and therefore cannot reflect. The class's
                      two signature defensive skills quietly cancel each other
VISUAL:               a faint mirrored quality to the air at contact points;
                      the blow lands and something identical leaves
FLAVOR:               Not punishment. He has been very clear about this on
                      the several occasions anyone asked. It is only that
                      actions are the sort of thing that continue, and he has
                      declined to interrupt one.

SKILL NAME:           Prayer Wheel
CLASS / TREE / TIER:  monk / Stone Garden / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (r130 — MOBILE, anchored to the caster and
                      follows him)
RANGE:                melee long (130px)
TARGETS:              uncapped per pulse (identity skill — breadth is the
                      point)
--- output ---
DAMAGE TIER:          low (8 per pulse)
PACE:                 very slow (8000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               the only aura in the game that travels with the player
                      (ruling 1)
DOT:                  pulses for the duration
AFFECTS:              enemies
--- automation ---
TRIGGER:              COOLDOWN_READY — it is uptime, not a reaction
THREAT:               some — it damages continuously, so it accrues attention
--- growth ---
RANK ADDS:            +2 damage per pulse; +10px radius every 2nd rank;
                      −40ms pulse interval every 4th rank
--- identity ---
ENGINE:               generates +1 per pulse — a slow constant drip that
                      continues while the Monk does nothing else, which makes
                      it the only income he has during pure evasion
COST:                 eight damage a pulse is small, and it draws aggro
                      continuously onto a class whose Spirit tree is built
                      around getting enemies to attack something else. Prayer
                      Wheel and Astral Projection are working against each
                      other
VISUAL:               a slowly turning ring of script at waist height,
                      centred on him wherever he goes, brightening at each
                      pulse
FLAVOR:               The turning is the prayer. Not what is written on it —
                      the written part is for people who need something to
                      look at. The turning is the whole of it and it does not
                      stop because he happens to be moving.

> **Best-adapted skill in ToH.** Every other aura in the game is anchored to
> a spot, which in a game about constant movement means most of them are
> mostly wasted. This one follows him. If you want a model for converting
> the other seven auras, it is this node.

SKILL NAME:           Mantra of Stillness
CLASS / TREE / TIER:  monk / Stone Garden / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (r150, persistent field 5000ms)
RANGE:                range short (150px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0) — the tick is 0 damage, purely a re-apply
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               slow ×0.6 and weaken 20% to everything inside
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 150px)
THREAT:               none
--- growth ---
RANK ADDS:            +1s duration and +6px radius per rank; +2% weaken every
                      3rd rank (not damage — it deals none at any rank)
--- identity ---
ENGINE:               generates +6
COST:                 zero damage on a sixteen-second cooldown for a
                      five-second field, which means it is off for eleven
                      seconds out of every sixteen. Both of its effects are
                      modest and neither is visible
VISUAL:               a circle in which everything is happening more slowly
                      and more quietly, including the ambient sound
FLAVOR:               He says it once. It is not long and it is not in a
                      language anyone present speaks, and the effect is not
                      on the meaning.

SKILL NAME:           Meditation
CLASS / TREE / TIER:  monk / Stone Garden / tier_code 8
TYPE:                 buff
AXIS POSITION:        9 (of 10)
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
RIDERS:               timed 2800ms — regenPerSec 20, the highest regeneration
                      rate in the roster
                      — roster ruling 6: 6000ms→2800ms (70% of the 4000ms cooldown)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (45%)
THREAT:               none
--- growth ---
RANK ADDS:            +4 regen per second per rank; +400ms duration every
                      4th rank
--- identity ---
ENGINE:               generates +6 plus +12 for the 120 health restored —
                      the second-largest Chi event in the class after
                      Tranquil State
COST:                 a hundred and twenty health over six seconds is
                      enormous, and it arrives at a fixed rate that cannot be
                      hurried. Against anything that deals more than twenty
                      damage a second, Meditation is a Monk losing more
                      slowly rather than recovering
VISUAL:               he keeps moving — the animation does not change at all
                      — and the health bar climbs steadily anyway
FLAVOR:               He was taught to sit for this. He no longer sits. His
                      teacher would have had a great deal to say about that
                      and is not available to say it.

SKILL NAME:           Enlightenment
CLASS / TREE / TIER:  monk / Stone Garden / tier_code 9
TYPE:                 buff
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 capstone (25000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               timed 10000ms — damageMult +0.25, attackSpeedMult
                      +0.20, moveSpeedMult +0.15, damageReduction +0.20
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (8+ within 300px), gated on 60 Chi
THREAT:               none
--- growth ---
RANK ADDS:            +5% damage and +4% damage reduction per rank; +500ms
                      duration every 4th rank
--- identity ---
ENGINE:               spends 60 Chi — and the +20% attack speed then makes
                      every Iron Palm strike fire more often, draining the
                      remainder faster. Fired at 60 Chi exactly, the Monk is
                      empty before the window closes
COST:                 sixty seconds and sixty Chi for ten seconds of being
                      better at everything. It is the roster's most
                      straightforward capstone and the least surprising, and
                      on this class the resource gate is what makes it a
                      decision rather than a formality
VISUAL:               nothing dramatic — the movement simply stops having any
                      preparation in it. Every action begins at its own
                      beginning
FLAVOR:               Ten seconds. He has been asked whether it is worth
                      forty years for ten seconds and has said that the
                      question contains an error he does not have time to
                      explain.
