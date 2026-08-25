# SAVAGE — RUMBLEJAM CONVERSION (30 skills)

Mechanical fields carried from the code export unchanged. Eight judgment
fields authored. Class-wide rulings stated once here.


---

## ROSTER RULING APPLIED

**Engine — RULED: Momentum (doc) — which is what the built `blood_dance` trait already does.**

**Tree names — built names win.** Obsidian→Primal Fury, Blood→Bloodbound, Jaguar→Aftermath


**Tree contents — the document wins**, per the standing rule. Applied without
further asking; divergences from the built tree are what this file already
describes.

**Pace (ruling 1).** Every timed active rebucketed to the fixed values, then
brought into the bucket-mix rule — at least **3** nodes fast-or-better per tree,
at most 1 very fast, at most 2 very slow. All three trees comply.

**Rate: 6.67/sec on a spread build — IN BAND.**

**Ruling 6 (rider duration under cooldown) — APPLIED.** 5 rider durations cut across 5 skills, each to ~70% of its skill's new cooldown and each annotated inline with what it
was. Nothing fell under the 500ms floor, so no rider was deleted outright. 1 form took the exception instead: cooldown moved to
the capstone bucket at 30s, duration held at a third of it.

**Grandfathered:** Blood Ward — rider 7000ms is 88% of its 8000ms cooldown, over roster ruling 6's 70% target and under the cooldown. Accepted pending playtest, not a defect.

**Outstanding:** thirty skills read `cascade` instead of the trait — KNOWN-DEFECTS #19.

---

## CLASS ENGINE — MOMENTUM (derived, and already named in code)

Warrior's Momentum, tier 3 of Obsidian, declared text: *"blood feeds fury —
every hit you land builds momentum (+6% damage a stack, up to 5); go quiet
and it all drains away."*

That is a complete engine sitting in a passive. Like the Samurai's Resolve,
I built the class on it rather than inventing anything.

**MOMENTUM, 0–5 stacks.** Starts each run at 0.

Feeds:
- **+1 stack per hit landed**, cap 5
- Each stack is **+6% damage** to everything

Decays: **1 stack per 2000ms with no hit landed.** Five seconds of not
connecting and the Savage is back to nothing.

Consumes — three capstones spend the whole bar for a scaling payoff:
- **Endless Slaughter**, **Blood God's Hunger**, **Avatar of the Jaguar**
  each consume all stacks and gain **+15% effect per stack spent**

Every other engine in this project is a bar that holds. Momentum is five
stacks and a five-second fuse — **the only engine that cannot be banked at
all.** The Savage has no economy, no reserve, and no way to prepare. He is
either currently hitting something or he is a normal person, and the
transition takes ten seconds in one direction and one hit in the other.

That also makes him the class most punished by RumbleJam's core loop: the
player's job is to *not* be near enemies, and Momentum only exists while he
is. Every other class can play the game correctly. This one has to keep
choosing not to.

---

## PORT RULINGS

**1. Three empty or underspecified nodes authored.** Sacrificial Might (0
damage, 20s cooldown, no rider at all), Open Veins (spreading, base 0, no
numbers — same shape as the Wizard's Plague), and Headtaker (20 damage at
60px, no rider, a name that unambiguously promises an execute). Each flagged
on its block.

**2. Blood Scent is the class's hidden combo.** Declared: bleeding enemies
take 20% more from the Savage. The Savage has three bleed sources — Jagged
Wound, Hemorrhage and Blood Mire — so this passive quietly converts the
Blood tree into a damage amplifier for the Obsidian tree. Ranks buy the
percentage.

**3. Blood God's Hunger uses the Soul Siphon machinery** — heals 12 per
enemy *present*, max 5, counted before the hit lands. Same as the Wizard's,
kept as coded.

**4. Movement, allies, confusion, hazards** carry from earlier classes.
Savage Leap is a leap rather than a dash, so it resolves *toward* the
densest cluster — it is an attack that happens to travel, not an escape.

**5. On the class name.** Savage is rooted in Mexico City and draws on
Mexica religious material — the obsidian edge, the blood offering, the
jaguar. That material is handled respectfully in what I have written; the
word *Savage* as a class name is doing something the material itself does
not. Worth a decision before this ships, and it is a naming question rather
than a design one — the tree contents are fine.

---

## TREE: PRIMAL FURY  (was Obsidian in the source conversion)

Role read: **the melee DPS and the engine tree.** Nine strikes, almost all
inside 100px, and the Momentum passive that pays for the whole class. It is
the tree that has to keep swinging, and it contains the reason to.

---

SKILL NAME:           Obsidian Slash
CLASS / TREE / TIER:  savage / Primal Fury / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r74)
RANGE:                melee short (74px)
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
TRIGGER:              NEAREST_IN_RANGE (74px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +1 target every 5th rank
--- identity ---
ENGINE:               feeds +1 stack per hit — at 2000ms it is the only skill
                      in the class fast enough to hold five stacks by itself,
                      which makes it mandatory rather than optional
COST:                 nineteen damage, no rider, seventy-four pixels. It is
                      the plainest node in the roster and every Savage build
                      runs it forever, because Momentum decays in five
                      seconds and nothing else fires often enough to stop that
VISUAL:               a short flat cut with a black glassy edge; the wound
                      is cleaner than the weapon looks capable of
FLAVOR:               Volcanic glass takes an edge three molecules across.
                      Nothing forged has ever come close and nothing forged
                      ever shatters the way it does, either.

SKILL NAME:           Jagged Wound
CLASS / TREE / TIER:  savage / Primal Fury / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r72)
RANGE:                melee short (72px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          low (14) — plus 30 over the bleed
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none beyond the bleed
DOT:                  5 per 500ms for 3000ms, applied at the strike point
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — prefers clusters containing enemies
                      not already bleeding, so the DoT spreads
THREAT:               some
--- growth ---
RANK ADDS:            +2 impact damage; +1 bleed per tick every 2nd rank;
                      +1s duration every 5th rank
--- identity ---
ENGINE:               feeds +1 stack on the impact only — bleed ticks do not
                      build Momentum, which is worth knowing, because a
                      Savage relying on DoTs will watch his stacks evaporate
                      while enemies die
COST:                 it is the class's cheapest bleed and therefore the
                      cheapest enabler for Blood Scent's +20%. On its own it
                      is fourteen damage on a five-second cooldown, which is
                      nothing
VISUAL:               the edge chips on contact and leaves fragments in the
                      wound; the wound does not close around them
FLAVOR:               The blade breaking is not a failure. He counted on it
                      breaking and left most of it behind on purpose.

SKILL NAME:           Warrior's Momentum
CLASS / TREE / TIER:  savage / Primal Fury / tier_code 2
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
RIDERS:               scene-keyed [declared, not derived] — "blood feeds
                      fury: every hit you land builds momentum (+6% damage a
                      stack, up to 5); go quiet and it all drains away"
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +1% damage per stack per rank; +1 maximum stack every
                      5th rank; +200ms decay interval every 4th rank
--- identity ---
ENGINE:               this node IS the engine. Everything in the Momentum
                      system above was derived from its declared text
COST:                 a slot that produces nothing on its own, at tier 3,
                      whose entire value depends on the player already
                      landing hits constantly. A Savage who does not
                      understand this node will skip it and then wonder why
                      the class feels like it has no ceiling
VISUAL:               no discrete effect — the strikes simply land harder,
                      and the animation gets less careful as the stacks climb
FLAVOR:               He does not warm up. There is no warming up. There is
                      the first one, and then there is whatever the first one
                      started, and stopping it is somebody else's problem.

SKILL NAME:           Savage Leap
CLASS / TREE / TIER:  savage / Primal Fury / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (landing circle)
RANGE:                range short (220px)
TARGETS:              uncapped in the landing area (identity skill — breadth
                      is the point)
--- output ---
DAMAGE TIER:          medium (22)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               stun 700ms in the landing circle; the Savage travels
                      220px and arrives there
DOT:                  none
AFFECTS:              enemies, self (movement)
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 220px — it leaps TOWARD the
                      pack, not away from it (ruling 4)
THREAT:               high
--- growth ---
RANK ADDS:            +4 damage; +100ms stun every 3rd rank; +15px range
                      every 4th rank
--- identity ---
ENGINE:               feeds — landing in a pack means several hits at once
                      and an instant full stack bar
COST:                 it is the only movement skill in the roster besides
                      Shadow Step that deliberately relocates the player
                      *into* danger, and unlike the Assassin's it does not
                      conceal him afterward. He lands in the middle, stunned
                      enemies wake up in 700ms, and he is there
VISUAL:               a high arc with no wind-up; the landing cracks the
                      ground in a hard circle and everything in it goes flat
FLAVOR:               Down is the direction with the most force available and
                      it costs nothing to arrange. He is aware this is the
                      whole of his technique and has never pretended otherwise.

SKILL NAME:           Brutal Cleave
CLASS / TREE / TIER:  savage / Primal Fury / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                fan (wide) (130° total)
RANGE:                melee long (100px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (22)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 100px
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +6° cone width every 4th rank
--- identity ---
ENGINE:               feeds +1 stack per hit, and a 130° fan connecting with
                      four enemies is four stacks in one cast — the fastest
                      way to a full bar in the class
COST:                 no rider at all, and a hundred and thirty degrees still
                      leaves more than half the circle open. It is damage and
                      Momentum and nothing else, and in a tree of nine
                      attacks it needs a reason to be the one slotted
VISUAL:               a wide committed swing that carries his weight through
                      it; he is off balance at the end and does not correct
FLAVOR:               Brutal is a word for the observer. From the inside it
                      is the most economical thing available — one motion,
                      several answers, no follow-up required.

SKILL NAME:           Skull Splitter
CLASS / TREE / TIER:  savage / Primal Fury / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                cone (narrow) (60° total)
RANGE:                melee long (84px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (18)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               stun 900ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (84px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +100ms stun every 3rd rank; +3° cone width
                      every 4th rank
--- identity ---
ENGINE:               feeds +1 stack per hit
COST:                 eighteen damage on an eight-second cooldown is the
                      worst ratio in the tree, and the sixty-degree cone is
                      the narrowest. Everything it is worth is the
                      nine-hundred-millisecond stun, which is the class's
                      only reliable hard control
VISUAL:               a downward two-handed drive into a narrow wedge; the
                      things it catches stop moving entirely
FLAVOR:               A specific target, a specific angle, and a very old
                      argument about whether it counts as a technique.

SKILL NAME:           Terrifying Roar
CLASS / TREE / TIER:  savage / Primal Fury / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r170 on caster)
RANGE:                range short (170px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               slow ×0.6 for 2500ms; weaken 25% for 2800ms — gated in
                      code on enemies being present
                      — roster ruling 6: 4000ms→2800ms (70% of the 4000ms cooldown)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 170px)
THREAT:               high
--- growth ---
RANK ADDS:            +400ms on both riders and +6px radius per rank (not
                      damage — it deals none at any rank)
--- identity ---
ENGINE:               does NOT feed. Zero damage means zero hits means zero
                      stacks, so every Terrifying Roar is a cast during which
                      Momentum is decaying. It is the only skill in the tree
                      that costs him the engine to use
COST:                 see above, and it is the whole problem with the node. A
                      twenty-five percent weaken on five enemies is real
                      mitigation and the Savage pays for it in the only
                      currency he has
VISUAL:               no impact of any kind — a wall of sound, and the
                      enemies caught in it come on slower and hit softer
FLAVOR:               He is not trying to frighten anyone. Frightening people
                      is a side effect of a noise he makes for entirely
                      internal reasons.

SKILL NAME:           Headtaker
CLASS / TREE / TIER:  savage / Primal Fury / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r60)
RANGE:                melee short (60px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          medium (20) — 70 on the finisher
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — ×3.5 against any target below 30% HP,
                      resolved per target. A kill made by the finisher
                      immediately refunds the cooldown to 2000ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 60px, gated to prefer targets
                      under 30%
THREAT:               some
--- growth ---
RANK ADDS:            +4 base damage (the ×3.5 does not scale, so a rank-10
                      Headtaker finishes for 210)
--- identity ---
ENGINE:               feeds, and the cooldown refund means a Headtaker
                      chaining through a wounded pack can hold five stacks
                      on its own
COST:                 sixty pixels, the shortest reach in the class, and
                      twenty damage against anything healthy. It is a
                      cleanup tool that requires the Savage to already be
                      winning, and at tier 8 the player has a right to expect
                      something that starts fights rather than ends them
VISUAL:               one horizontal stroke at neck height; against a
                      wounded enemy the animation does not change and the
                      result does
FLAVOR:               The head is not a trophy. He has been asked and has
                      explained, twice, that it is a receipt, and has given
                      up on the distinction landing.

> **AUTHORED:** ToH's Headtaker is a plain 20-damage circle with no rider —
> the name promises an execute and the code delivers a worse Obsidian Slash.
> I gave it the finisher and the cooldown refund, which also gives the
> Obsidian tree its one moment of acceleration.

SKILL NAME:           Scent of Blood
CLASS / TREE / TIER:  savage / Primal Fury / tier_code 8
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
RIDERS:               stat mods: lifestealPct 0.08
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2% lifesteal per rank
--- identity ---
ENGINE:               neutral, but it scales with Momentum — lifesteal is a
                      percentage of damage dealt, and five stacks is +30%
                      damage, so the Savage's sustain and his engine
                      compound
COST:                 eight percent scales off damage dealt, so it returns
                      nothing at the moment he most needs it: when he has
                      stopped connecting and his stacks have already drained.
                      Every sustain tool this class owns fails in the same
                      situation
VISUAL:               a faint dark return along the arm on each connecting
                      strike
FLAVOR:               It is not that he can smell it. Everyone can smell it.
                      What is unusual is what the information does to him
                      once it has arrived.

SKILL NAME:           Endless Slaughter
CLASS / TREE / TIER:  savage / Primal Fury / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                chain (auto-cascading strikes)
RANGE:                melee long (140px per link)
TARGETS:              cascades from target to target for the duration
--- output ---
DAMAGE TIER:          low (14 per strike)
PACE:                 capstone (25000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               auto-casts a chain of strikes, each finding the nearest
                      enemy to the last; every strike still builds and
                      refreshes Momentum
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (8+ within 250px), consuming all
                      Momentum stacks
THREAT:               high
--- growth ---
RANK ADDS:            +2 damage per strike; +500ms cascade duration every
                      4th rank
--- identity ---
ENGINE:               consumes all stacks for +15% effect each — at five
                      stacks it is +75% duration and damage, and it then
                      rebuilds the bar instantly on its own first strike
COST:                 fifty-five seconds. It wants to be fired at five
                      stacks, which means it wants to be fired while the
                      Savage is already winning, and the automation will
                      trigger it on crowd size rather than on how well things
                      are going. Expect it to go off at two stacks more often
                      than five
VISUAL:               he stops being resolvable as one figure; the strikes
                      arrive in sequence across the whole pack and he ends
                      standing somewhere he did not start
FLAVOR:               Endless is the wrong word and he has never used it. It
                      ends. He simply stops being able to tell, from the
                      inside, where the end is going to be.

---

## TREE: BLOODBOUND  (was Blood in the source conversion)

Role read: **the sustain and ranged spec.** A reflect, a drain, a
self-heal capstone, two bleeds and the class's only projectile. It is where
a Savage goes to survive standing in the middle of things, and its
sustain all scales off damage — so it works exactly as long as Momentum
does.

---

SKILL NAME:           Blood Spike
CLASS / TREE / TIER:  savage / Bloodbound / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (320px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (17)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (320px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; at rank 7 it pierces 1 additional enemy
--- identity ---
ENGINE:               feeds +1 stack per hit, at range — it is the only
                      skill in the class that can hold Momentum while the
                      Savage is retreating, which makes it quietly the most
                      important defensive node he owns
COST:                 seventeen damage, single target, in a class built
                      entirely around being in a crowd. On paper it is the
                      worst-fitting node in the tree; in practice it is what
                      keeps the engine alive during the seconds the player
                      spends running
VISUAL:               a spike of dark red that forms as it leaves the hand
                      rather than before
FLAVOR:               His own, at first. He worked out later that it did not
                      have to be and has not entirely stopped preferring the
                      original method.

SKILL NAME:           Open Veins
CLASS / TREE / TIER:  savage / Bloodbound / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (spreading)
RANGE:                range medium (300px to the first target)
TARGETS:              AUTHORED — spreads to a new enemy within 110px each
                      time it ticks, cap 5 simultaneous
--- output ---
DAMAGE TIER:          none (0 direct) — 6 per 1000ms per bleeding enemy
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               every enemy carrying it counts as BLEEDING for Blood
                      Scent's +20%
DOT:                  6 per 1000ms for 8000ms per infected enemy
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 300px — spread wants bodies
                      close together
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per tick; +1 simultaneous infection every 4th
                      rank; +15px spread radius every 3rd rank
--- identity ---
ENGINE:               feeds only on the initial application — the spread
                      ticks build no Momentum. Like every DoT in this class
                      it produces damage the engine does not see
COST:                 it takes eight seconds to reach full spread, and its
                      real value is not the damage but the fact that it marks
                      five enemies as bleeding for Blood Scent. It is a
                      setup node whose payoff lives in a different tree
VISUAL:               nothing at the cast. Then one of them is bleeding, and
                      then the one beside it is, and the pattern of who has
                      started spreads visibly outward
FLAVOR:               He does not open anything. He points out, with some
                      precision, where it was already going to open, and the
                      body agrees with him.

> **AUTHORED:** the export gives "spreads (see action notes)" with base 0
> and no numbers — spread radius, infection cap and tick values are mine,
> matching the Wizard's Plague treatment.

SKILL NAME:           Crimson Nova
CLASS / TREE / TIER:  savage / Bloodbound / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r140 on caster)
RANGE:                melee long (140px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 140px)
THREAT:               high
--- growth ---
RANK ADDS:            +5 damage; +8px radius every 3rd rank
--- identity ---
ENGINE:               feeds heavily — thirty damage to everything within
                      140px is a full stack bar in one cast
COST:                 the highest flat number in the tree with no rider and
                      no cost, which makes it the least interesting good
                      skill in the class. It exists to be reliable
VISUAL:               an outward wash of dark red with no visible source,
                      leaving the floor stained in a hard circle
FLAVOR:               There is more of it in a room than anyone assumes and
                      most of it is still inside people. He finds the second
                      half of that sentence to be a temporary condition.

SKILL NAME:           Red Harvest
CLASS / TREE / TIER:  savage / Bloodbound / tier_code 3
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
ENGINE:               neutral, but it multiplies with Momentum rather than
                      adding to it — at five stacks the two together are
                      roughly +48%, and both scale without limit
COST:                 the sixth uncapped global damage multiplier in the
                      roster. On this class it is worse than elsewhere,
                      because it stacks multiplicatively with an engine that
                      is itself an uncapped damage multiplier
VISUAL:               nothing visible
FLAVOR:               A harvest is a thing you plan for a year and take in a
                      week. He has always liked the arithmetic of that and
                      has never liked being told the metaphor is unkind.

SKILL NAME:           Transfusion
CLASS / TREE / TIER:  savage / Bloodbound / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target (nearest)
RANGE:                range medium (300px)
TARGETS:              1
--- output ---
DAMAGE TIER:          low (16)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               drain — heals the Savage 60% of damage dealt
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (65%), falling back to
                      NEAREST_IN_RANGE at full health
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage (the 60% ratio does not scale, so the heal
                      grows with it automatically)
--- identity ---
ENGINE:               feeds +1 stack, at range — the second of only two
                      skills that hold Momentum from a distance
COST:                 sixteen damage returns about ten health, which is not
                      a heal on a class that will be taking hits from four
                      directions. It scales beautifully with Momentum and
                      ranks and it is nearly useless in the first minute
VISUAL:               a thread of dark red between them that runs the wrong
                      way and does not detach cleanly
FLAVOR:               An exchange. He is aware that the other party has not
                      agreed to the terms and considers the objection
                      procedural.

SKILL NAME:           Blood Ward
CLASS / TREE / TIER:  savage / Bloodbound / tier_code 5
TYPE:                 buff
AXIS POSITION:        6 (of 10)
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
RIDERS:               timed 7000ms — reflectPct 0.35
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 150px)
THREAT:               none
--- growth ---
RANK ADDS:            +4% reflect per rank; +400ms duration every 4th rank
--- identity ---
ENGINE:               feeds — reflect damage counts as his, so a Savage being
                      swarmed while Blood Ward runs is building Momentum
                      without swinging at anything. It is the one skill in
                      the class that generates the engine defensively
COST:                 thirty-five percent returned means sixty-five percent
                      taken, and this class has no damage reduction anywhere
                      outside Thick Hide. It is a good number attached to a
                      bad plan
VISUAL:               a thin red film just off the skin; blows arrive and an
                      identical shape leaves along the reverse line
FLAVOR:               Not protection. He has been very clear that it is not
                      protection. It is an arrangement whereby the
                      consequences are distributed more evenly than they
                      were going to be.

SKILL NAME:           Sacrificial Might
CLASS / TREE / TIER:  savage / Bloodbound / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
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
RIDERS:               AUTHORED — spends 25% of CURRENT health and grants
                      +50% damage for 5600ms, plus 3 immediate Momentum
                      stacks. Will not fire below 45% health
                      — roster ruling 6: 10000ms→5600ms (70% of the 8000ms cooldown)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (6+ within 250px) while above 45% health
THREAT:               none
--- growth ---
RANK ADDS:            +8% damage per rank; +400ms duration every 4th rank.
                      The 25% health cost does NOT scale down
--- identity ---
ENGINE:               feeds 3 stacks instantly — the only skill in the class
                      that grants Momentum without landing a hit, which makes
                      it the correct opener for a fight the Savage is walking
                      into cold
COST:                 a quarter of his current health, on a class whose only
                      healing is a 60% drain off sixteen damage. The cost is
                      real and it is paid up front and the fight has not
                      started yet
VISUAL:               he opens his own forearm, unhurriedly, and the damage
                      does not appear to register on him at all
FLAVOR:               The offering is not a payment. Nobody is being paid.
                      It is a statement about seriousness, made in the only
                      currency that cannot be faked, and it has never once
                      been misunderstood.

> **AUTHORED FROM NOTHING.** Sacrificial Might has a 20-second cooldown, is
> self-targeted, and has no rider, no buff, no stat mod and no heal — an
> empty node. The name is unambiguous about the shape (pay health, get
> power) and I wrote it that way. Design proposal, not conversion.

SKILL NAME:           Hemorrhage
CLASS / TREE / TIER:  savage / Bloodbound / tier_code 7
TYPE:                 stacking_dot
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range medium (300px)
TARGETS:              1 per cast (nearest below max stacks)
--- output ---
DAMAGE TIER:          low (4 per tick)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               stacks to 4; every stacked target counts as BLEEDING
                      for Blood Scent's +20%
DOT:                  4 per 500ms for 3000ms, stacks to 4
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — nearest enemy below max stacks, so
                      it spreads the bleeding flag across the pack
THREAT:               none
--- growth ---
RANK ADDS:            +1 damage per tick; +1 maximum stack every 5th rank
--- identity ---
ENGINE:               feeds +1 stack per cast, at range, every three seconds
                      — the third and best of the class's ranged Momentum
                      holders
COST:                 four damage a tick is the smallest number in the class.
                      Its output is negligible and its function is entirely
                      to paint the pack with the bleeding flag so that Blood
                      Scent's +20% applies to everything the Obsidian tree
                      does. Read as a damage skill it is a failure; read as
                      an enabler it is the best node in the tree
VISUAL:               nothing lands. The target simply starts losing more
                      than the wound accounts for
FLAVOR:               There is a difference between bleeding and hemorrhaging
                      and the difference is whether anything is still trying
                      to stop it.

SKILL NAME:           Blood Mire
CLASS / TREE / TIER:  savage / Bloodbound / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r120, persistent field 5000ms)
RANGE:                melee long (90px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 4 per 600ms tick
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               slow ×0.6 to everything inside; the field marks
                      everything in it as BLEEDING for Blood Scent
DOT:                  ground tick 4 per 600ms for 5000ms
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (120px)
THREAT:               none
--- growth ---
RANK ADDS:            +1 damage per tick; +1s duration every 4th rank; +6px
                      radius every 3rd rank
--- identity ---
ENGINE:               does not feed — field ticks build no Momentum, and the
                      cast itself lands no hit. Blood Mire is a second skill
                      that costs the Savage engine time to use
COST:                 four damage a tick and a modest slow, at tier 9. Its
                      real function is the same as Hemorrhage's: mass-marking
                      the pack as bleeding. The Blood tree has three separate
                      nodes doing that and the interface explains none of it
VISUAL:               the floor darkens and softens in a wide patch; things
                      crossing it lift their feet wrong
FLAVOR:               The ground here remembers. Not metaphorically. There
                      are five hundred years of it in the soil under this
                      city and he has simply asked for some of it back.

SKILL NAME:           Blood God's Hunger
CLASS / TREE / TIER:  savage / Bloodbound / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r180 on caster)
RANGE:                range short (180px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          high (40)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               heals 12 per enemy PRESENT in r180, maximum 5,
                      pre-counted before the hit resolves (ruling 3) — up to
                      60 health
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 180px), consuming all
                      Momentum stacks
THREAT:               high
--- growth ---
RANK ADDS:            +8 damage and +3 heal per enemy per rank
--- identity ---
ENGINE:               consumes all stacks for +15% effect each, then
                      immediately rebuilds the bar off its own hits — it is
                      the only capstone in the class that both spends and
                      refills in the same cast
COST:                 fifty-five seconds, and the heal is counted on enemies
                      *present* rather than struck, so it explicitly rewards
                      being surrounded by five things. It is the largest
                      heal in the class and collecting it requires the
                      position most likely to kill him
VISUAL:               everything within a wide radius gives at once and the
                      colour of it goes inward rather than out
FLAVOR:               He does not believe it is a god and he does not believe
                      it is hungry. He believes something is on the other end
                      of the arrangement, and he has stopped enquiring
                      further, because the arrangement works.

---

## TREE: AFTERMATH  (was Jaguar in the source conversion)

Role read: **the survivability and speed spec.** Two transformations, three
defensive passives, a heal, a confusion and a totem. It is the only tree in
the class with damage reduction anywhere in it, and it is what lets a
Savage stay standing long enough for Momentum to reach five.

---

SKILL NAME:           Feral Lunge
CLASS / TREE / TIER:  savage / Aftermath / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                line (movement path)
RANGE:                range short (190px)
TARGETS:              each enemy in path once, uncapped
--- output ---
DAMAGE TIER:          medium (20)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               knockdown — stun 350ms per enemy hit; caster displaced
                      190px
DOT:                  none
AFFECTS:              enemies, self (movement)
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (80px) — direction resolved away
                      from the densest cluster per the movement ruling
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +50ms knockdown every 3rd rank; +15px
                      distance every 4th rank
--- identity ---
ENGINE:               feeds — a lunge through three enemies is three stacks
                      at once, and at 2600ms it is the fastest dash in the
                      roster
COST:                 three hundred and fifty milliseconds is barely a
                      stagger, and 190px of forced displacement every 2.6
                      seconds means the Savage is constantly being relocated
                      by his own tier-1 node. Of the nine dashes in the game
                      this one fires most often and moves him least usefully
VISUAL:               low and flat, closing the distance in one motion,
                      shoulder leading
FLAVOR:               The cat does not stalk because it is patient. It stalks
                      because it has exactly one of these in it and cannot
                      afford to spend it early.

SKILL NAME:           Predator's Snarl
CLASS / TREE / TIER:  savage / Aftermath / tier_code 1
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
                      enemies and its threat on the Savage drops to zero
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
ENGINE:               feeds only on the chip ticks, which are the Savage's
                      hits — so a long confusion quietly holds his Momentum
                      up while he is doing nothing else
COST:                 one enemy, three and a half seconds, twelve-second
                      cooldown. Against a swarm it removes one thirtieth of
                      the problem, and against a single large enemy it is the
                      best skill in the class
VISUAL:               a low sound with no direction to it; the target stops,
                      reconsiders, and commits to something else
FLAVOR:               Not a threat. A threat is information about the future.
                      This is a statement about the present that the animal
                      hearing it has no framework for disputing.

SKILL NAME:           Jaguar Spirit
CLASS / TREE / TIER:  savage / Aftermath / tier_code 2
TYPE:                 transformation
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 capstone (30000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               form 10000ms — attackSpeedMult +0.25, moveSpeedMult
                      +0.15
                      — roster ruling 6 (form exception): cooldown moved to the capstone bucket at 30s and the form kept at 10000ms, a third of it
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 250px)
THREAT:               none
--- growth ---
RANK ADDS:            +5% attack speed and +3% move speed per rank; +500ms
                      duration every 4th rank
--- identity ---
ENGINE:               feeds indirectly and substantially — +25% attack speed
                      is +25% more hits, which is +25% more stack refreshes.
                      On a class whose engine decays every two seconds,
                      attack speed is not a damage stat, it is a survival
                      stat for the bar
COST:                 ten seconds in thirty. It is Spirit of the Hunt two
                      tiers below with slightly different numbers, and
                      running both is two slots on overlapping windows —
                      the third time this pattern has appeared in the roster
VISUAL:               nothing changes shape. The movement simply stops
                      having any preparation in it and the rhythm goes wrong
                      in a way that is hard to read
FLAVOR:               Not a costume and not a possession. Something that was
                      already in the arrangement of him is briefly permitted
                      to set the pace.

SKILL NAME:           Thick Hide
CLASS / TREE / TIER:  savage / Aftermath / tier_code 3
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
RIDERS:               stat mods: damageReduction +0.12
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2.5% damage reduction per rank, diminishing above 60%
                      (not damage)
--- identity ---
ENGINE:               neutral
COST:                 it is the only flat mitigation in the entire class, at
                      twelve percent, in a kit that asks the Savage to stand
                      inside a pack for the whole run. A Savage who does not
                      slot this is relying on Blood Ward's reflect and
                      Scent of Blood's eight percent lifesteal to keep him
                      alive, and neither of those is mitigation
VISUAL:               the skin takes a rougher, duller quality that does not
                      catch the light
FLAVOR:               Rosettes are not decoration and were never decoration.
                      Everything about the animal is load-bearing and most of
                      it is doing two jobs.

SKILL NAME:           Spirit of the Hunt
CLASS / TREE / TIER:  savage / Aftermath / tier_code 4
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               timed 5600ms — moveSpeedMult +0.15, attackSpeedMult
                      +0.20
                      — roster ruling 6: 8000ms→5600ms (70% of the 8000ms cooldown)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (60%) — the escape-speed version,
                      distinct from Jaguar Spirit's crowd trigger
THREAT:               none
--- growth ---
RANK ADDS:            +4% attack speed and +3% move speed per rank; +400ms
                      duration every 4th rank
--- identity ---
ENGINE:               feeds indirectly — same attack-speed logic as Jaguar
                      Spirit
COST:                 it is a near-duplicate of the node two tiers below and
                      the only meaningful difference is the trigger I have
                      assigned. If you want one of these cut, this is the one
                      — Jaguar Spirit is a transformation with a longer
                      window and better numbers
VISUAL:               a low readiness in the posture; he stops standing still
                      between actions
FLAVOR:               The hunt is not the chase. The chase is four seconds at
                      the end and everyone remembers it wrongly. The hunt is
                      the two days before, and this is the thing that gets
                      him through those.

SKILL NAME:           Blood Scent
CLASS / TREE / TIER:  savage / Aftermath / tier_code 5
TYPE:                 passive
AXIS POSITION:        6 (of 10)
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
RIDERS:               scene-keyed [declared, not derived] — "you smell what's
                      already open: BLEEDING enemies take 20% more from you"
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on, CONDITIONAL on the target bleeding
THREAT:               none
--- growth ---
RANK ADDS:            +4% to the bleeding-target bonus per rank
--- identity ---
ENGINE:               neutral, but it is the hinge of the whole class — the
                      Blood tree paints the pack bleeding and the Obsidian
                      tree collects the +20% on every swing
COST:                 it does nothing at all against enemies that are not
                      bleeding, and the three skills that apply bleeding are
                      all in another tree. It is the strongest node in the
                      class and it requires a two-tree build to produce a
                      single point of value
VISUAL:               nothing visible; bleeding enemies simply take more
FLAVOR:               He does not hunt the healthy ones. Not out of mercy —
                      out of the same instinct that makes anyone pick up the
                      lighter end of a table.

> **The class's real combo, and it is invisible.** Blood Scent plus any of
> Jagged Wound, Open Veins, Hemorrhage or Blood Mire is a +20% damage
> amplifier across the entire Obsidian tree. Nothing in the interface says
> so and a player will find it by accident or not at all. If one thing in
> this class gets a tooltip callout, make it this.

SKILL NAME:           Lick the Wounds
CLASS / TREE / TIER:  savage / Aftermath / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               heals 28 to self
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (60%)
THREAT:               none
--- growth ---
RANK ADDS:            +8 heal per rank
--- identity ---
ENGINE:               does not feed — a cast with no hit, during which
                      Momentum decays. It is the third skill in the class
                      that costs him the engine to use, and it is the one he
                      will use most under pressure
COST:                 twenty-eight health on a ten-second cooldown, and it is
                      the only unconditional heal the Savage owns —
                      everything else scales off damage he may not currently
                      be dealing. It is his floor, and it is small
VISUAL:               a brief pause and something entirely animal about it;
                      the wound closes badly and it closes
FLAVOR:               Undignified and effective, in that order, and he
                      stopped ranking those two some time ago.

SKILL NAME:           Sun Totem
CLASS / TREE / TIER:  savage / Aftermath / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r120, persistent hazard 4500ms)
RANGE:                melee long (130px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 7 per 500ms tick
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  ground tick 7 per 500ms for 4500ms — 63 to anything
                      that stays
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 130px
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per tick; +1s duration every 4th rank; +6px
                      radius every 3rd rank
--- identity ---
ENGINE:               does not feed — placed hazards land no hits for the
                      Savage, so this is a fourth skill that spends engine
                      time. Four of his thirty skills actively starve
                      Momentum and none of them announce it
COST:                 sixty-three damage over four and a half seconds to
                      whatever stands in it, on a thirteen-second cooldown,
                      anchored to a spot the Savage will have left. It is
                      the only ranged area damage in the tree and it is
                      passive damage on an entirely active class
VISUAL:               a short carved post driven into the floor; the light
                      coming off it is flat and hot and does not flicker
FLAVOR:               Not a prayer and not a request. It is a marker, placed
                      where something is owed, and the sun has always been
                      punctual about collections.

SKILL NAME:           Apex Instinct
CLASS / TREE / TIER:  savage / Aftermath / tier_code 8
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
RIDERS:               stat mods: blockChance +0.12, blockReduction 0.60
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +3% block chance and +2% block reduction per rank,
                      ceiling 85% (not damage)
--- identity ---
ENGINE:               neutral — unlike the Monk, the Savage gets no engine
                      credit for blocking, so this is pure defence on a class
                      that cannot afford pure anything
COST:                 twelve percent of sixty percent of the damage is a very
                      small number and it is variance on top of that. At
                      tier 9 of a tree the player has a right to expect
                      something that changes how the class plays, and this
                      changes a decimal
VISUAL:               incoming blows are turned aside at the forearm without
                      any visible decision preceding them
FLAVOR:               Apex is a position in a diagram. It has never once
                      meant safe and the people who drew the diagram knew
                      that.

SKILL NAME:           Avatar of the Jaguar
CLASS / TREE / TIER:  savage / Aftermath / tier_code 9
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               timed 10000ms — damageMult +0.25, attackSpeedMult
                      +0.20, moveSpeedMult +0.15, lifestealPct +0.10
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (7+ within 250px), consuming all
                      Momentum stacks
THREAT:               none
--- growth ---
RANK ADDS:            +5% damage and +2% lifesteal per rank; +500ms duration
                      every 4th rank
--- identity ---
ENGINE:               consumes all stacks for +15% effect each, then rebuilds
                      immediately — the +20% attack speed means the bar is
                      back to five within two seconds of the window opening
COST:                 sixty seconds for ten, and it is the only capstone in
                      the class that carries lifesteal — which makes it the
                      Savage's single best survival window as well as his
                      best damage window. Firing it correctly means firing it
                      while surrounded and nearly dead, and the trigger I
                      have set fires it while surrounded and healthy
VISUAL:               nothing transforms. Everything about the movement
                      simply becomes more efficient than a person's should be,
                      and the lifesteal is visible as a continuous dark return
FLAVOR:               There is no borrowing involved and there never was.
                      Tezcatlipoca did not lend anyone anything. The jaguar
                      was the shape underneath the whole time and the ten
                      seconds are only how long he can bear looking at it.
