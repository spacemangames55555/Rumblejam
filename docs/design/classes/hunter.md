# HUNTER — RUMBLEJAM CONVERSION (30 skills)

Mechanical fields carried from the code export unchanged. Eight judgment
fields authored. Class-wide rulings stated once here.


---

## ROSTER RULING APPLIED

**Engine — RULED: `spread` (built). Bond is CUT.**

**Tree names — built names win.** Beasts→Houndmaster, Marksman→Longshot, Frenzy→Pincer


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

**Outstanding:** EVERY Bond-derived ENGINE line in this file still reads proximity and must invert.

---

## CLASS ENGINE — BOND (derived from two declared passives)

Two of the Hunter's scene-keyed passives say the same thing in different
words. Pack Tactics: *"while a beast walks with you, YOU strike 8% harder."*
Pack Leader: *"with a beast close, YOU strike 12% harder."* The code already
measures whether the Hunter and his animal are near each other, and already
pays him for it. That is an engine.

**BOND, 0–100.** Starts each run at 0.

Feeds:
- The Hunter landing a hit with a beast within **250px**: **+3**
- A beast landing a hit with the Hunter within **250px**: **+3**
- **+1 per second** while any beast is within **150px**

Consumes:
- Mode switch (Great Beast / Beast Horde): **30**
- Bestial Rage **30** · Call of the Wild **40** · Eagle's Gaze **40**
- Beast Mastery **50** · Alpha's Fury **60**

Decays **3/sec while no beast is alive or every beast is beyond 250px.**

The Necromancer hides behind his summons; the Druid is sustained by their
mere presence. **The Hunter has to fight beside his.** He is the only class
in the roster whose engine is a function of where he stands relative to
his own bodies — too far back and it drains, in the middle of it and it
compounds. That is the pack, expressed as arithmetic, and it came out of
the code's own two passives rather than being invented.

---

## PORT RULINGS

**1. The bond is one creature with three forms.** Great Beast and Beast
Horde are both `MODE toggle` on the same bond, and the globals export
confirms the Hunter's three bond expressions are the only `Infinity`
lifetime summons in the game. Ruling, following the Samurai stance model:

| mode | what it is | auto-switch trigger |
|---|---|---|
| Companion | default single beast, balanced | holds when neither below applies |
| Great Beast | one large taunt-tank, magnet aggro | `SELF_HP_BELOW_X (45%)` or 6+ enemies within 250px |
| Beast Horde | splits into 3 fast strikers | 5+ enemies within 300px and the Hunter above 60% HP |

Exclusive, 6000ms swap cooldown, 30 Bond per switch. The bond never dies
permanently — it re-manifests after a delay. **This is the tank/DPS role
switch, and it lives inside one class rather than across two builds.**

**2. Pet commands are an AI mode, not a cast.** Focus Prey (all beasts onto
one target) and Scatter the Pack (spread across targets) are exclusive,
newest-wins overrides. Ruling: each occupies a slot and fires on its own
trigger — Focus Prey when a single high-health enemy is present, Scatter
when the swarm is wide. A Hunter running both has automated pet targeting;
one, and his beasts have one habit; neither, and they pick nearest.

**3. Four Marksman nodes have no riders and I have authored them.**
Multishot is single-target despite the name, Crippling Arrow cripples
nothing, Net Shot nets nothing, and Boomerang does not return. Same
pathology as the Samurai's Bow and the Assassin's Marksman trees — the third
time this exact shape has appeared, which suggests it is a systemic gap in
how ranged trees were authored rather than four oversights.

**4. Venom Blades is a bleed-equivalent** — declared, scene-keyed, applies
to every damaging skill. Same treatment as Razor's Edge and Poisoned Edge.

**5. Movement, allies, hazards** carry from earlier classes.

---

## TREE: HOUNDMASTER  (was Beasts in the source conversion)

Role read: **the pet master, and the class's role switch.** The bond, its
two modes, two commands, two multiplier passives, a pet heal and a pet buff.
Almost nothing here damages anything directly — the tree's entire output is
delivered by something else with teeth.

---

SKILL NAME:           Tame Companion
CLASS / TREE / TIER:  hunter / Houndmaster / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range short (200px)
TARGETS:              1
--- output ---
DAMAGE TIER:          low (6)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               manifests the bond in its current mode if it is not
                      present; re-manifests it after a death delay
DOT:                  none
AFFECTS:              allies + enemies
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on the bond being absent
THREAT:               none (the beast carries it)
--- growth ---
RANK ADDS:            +10% beast damage and HP per rank (ranks buy the
                      companion, not the six damage)
--- identity ---
ENGINE:               feeds — with the bond standing, everything else the
                      Hunter does starts generating
COST:                 six damage, which is the lowest number in the roster
                      and correctly so — this skill is not an attack, it is
                      the tier-1 node that turns the engine on. A Hunter who
                      does not slot it has no Bond generation at all and
                      three-quarters of his tree stops working
VISUAL:               he does not call it. He stops, and waits, and it comes
                      in from the edge of the frame at its own pace
FLAVOR:               Tame is the word other people use. What happened was a
                      long negotiation with no common language and several
                      genuine setbacks, and the terms are still under review.

SKILL NAME:           Pack Tactics
CLASS / TREE / TIER:  hunter / Houndmaster / tier_code 1
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
RIDERS:               scene-keyed [declared, not derived] — "the pack fights
                      as one: while a beast walks with you, YOU strike 8%
                      harder, and your beasts strike 8% harder always"
DOT:                  none
AFFECTS:              self, own summons
--- automation ---
TRIGGER:              always-on, but the caster half is CONDITIONAL — it
                      only applies while a beast is within Bond range
THREAT:               none
--- growth ---
RANK ADDS:            +3% to both halves per rank
--- identity ---
ENGINE:               this node is the engine's origin — the proximity
                      condition in its declared text is where Bond came from
COST:                 the caster half switches off the moment the beast dies
                      or wanders, and the Hunter has no control over either.
                      It is a damage multiplier that turns itself off during
                      the worst parts of a fight
VISUAL:               nothing on the Hunter; the beast's movement visibly
                      coordinates with his — it repositions when he does
FLAVOR:               Neither of them leads. He has been asked which and has
                      never answered, partly out of principle and partly
                      because he does not know.

SKILL NAME:           Focus Prey
CLASS / TREE / TIER:  hunter / Houndmaster / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range medium (300px)
TARGETS:              1 (marked; all beasts redirect onto it)
--- output ---
DAMAGE TIER:          none (0)
PACE:                 fast (1200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               pet-command override, exclusive with Scatter the Pack —
                      newest wins (ruling 2)
DOT:                  none
AFFECTS:              enemies + own summons
--- automation ---
TRIGGER:              COOLDOWN_READY when a single enemy within 300px has
                      more than double the health of any other in range
THREAT:               none
--- growth ---
RANK ADDS:            +8% beast damage against the marked target per rank;
                      +3s mark duration every 4th rank
--- identity ---
ENGINE:               feeds indirectly — concentrated beasts land more
                      killing blows, and every beast hit near the Hunter is
                      +3 Bond
COST:                 it deals nothing itself and it is worth nothing at all
                      in a build with no beasts out. It also fights Scatter
                      the Pack one tier up — running both means the two
                      overwrite each other on whichever fired last, which is
                      the code's own rule and I kept it
VISUAL:               he points, and every animal he owns changes direction
                      at the same instant
FLAVOR:               The gesture is not the instruction. The gesture is for
                      him. They knew before his arm moved and he has stopped
                      finding that unsettling.

SKILL NAME:           Scatter the Pack
CLASS / TREE / TIER:  hunter / Houndmaster / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 self (pack command)
SHAPE:                none
RANGE:                n/a
TARGETS:              own beasts, spread across separate prey
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               pet-command override, exclusive with Focus Prey
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ enemies within 300px) with no
                      single dominant target
THREAT:               none
--- growth ---
RANK ADDS:            +6% beast attack speed while scattered per rank
--- identity ---
ENGINE:               works against the engine — scattered beasts spread out,
                      and beasts beyond 250px stop generating Bond. Scatter
                      is the command that makes the Hunter's own resource
                      decay, and nothing warns him
COST:                 see above. It is the correct command for clearing a
                      swarm and the wrong one for keeping the pack close, and
                      those two goals are the Hunter's whole tension
VISUAL:               an open-handed sweep and the animals break in different
                      directions without hesitating
FLAVOR:               Three animals killing one thing is two animals wasting
                      their afternoon. He worked this out young and has never
                      needed to revise it.

SKILL NAME:           Great Beast
CLASS / TREE / TIER:  hunter / Houndmaster / tier_code 4
TYPE:                 active (MODE)
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none — the bond re-manifests in a new form
RANGE:                n/a
TARGETS:              n/a — 1 large taunt-tank
--- output ---
DAMAGE TIER:          none (0) — the beast deals the damage
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               MODE, exclusive with Beast Horde and Companion. Magnet
                      aggro, high HP, moderate damage, holds position near
                      the Hunter rather than chasing (ruling 1)
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (45%) or 6+ enemies within 250px —
                      highest mode priority, overrides the other two
THREAT:               high (delegated — this is the Hunter's tank)
--- growth ---
RANK ADDS:            +15% Great Beast HP per rank; +20px magnet radius every
                      3rd rank
--- identity ---
ENGINE:               consumes 30 Bond to switch, then feeds strongly — it
                      holds position near him, which keeps it inside the
                      250px generation band by design
COST:                 thirty Bond and the loss of whatever the previous mode
                      was doing. Switching under pressure is expensive at
                      exactly the moment the Hunter is poorest, and the
                      trigger fires at 45% health, which is when his Bond has
                      usually already been decaying
VISUAL:               the animal does not transform so much as arrive at a
                      different size, heavier through the shoulder, and stops
                      moving quickly
FLAVOR:               It has always been this large. The other shapes are the
                      compromise and he has never asked what the compromise
                      costs it.

SKILL NAME:           Beast Horde
CLASS / TREE / TIER:  hunter / Houndmaster / tier_code 5
TYPE:                 active (MODE)
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none — the bond splits into three
RANGE:                n/a
TARGETS:              n/a — 3 fast strikers
--- output ---
DAMAGE TIER:          none (0) — the strikers deal the damage
PACE:                 medium (2000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               MODE, exclusive with Great Beast and Companion. Three
                      low-HP, high-speed bodies that chase
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              5+ enemies within 300px AND the Hunter above 60% HP —
                      the offensive mode, yielded to Great Beast whenever
                      that becomes eligible
THREAT:               some (delegated across three bodies)
--- growth ---
RANK ADDS:            +12% striker damage per rank; +1 striker every 6th rank
--- identity ---
ENGINE:               consumes 30 Bond to switch. Three bodies landing hits
                      is three times the +3 events — the richest mode by a
                      wide margin, provided they stay within 250px, which
                      chasing strikers frequently do not
COST:                 they chase. Three fast animals will scatter across the
                      room after separate targets, and every one that leaves
                      the 250px band stops paying. The Hunter's highest-damage
                      mode is also the one most likely to starve his engine
VISUAL:               it comes apart — not violently, just three of them
                      where there was one, all moving before they have
                      finished separating
FLAVOR:               He does not know how many there really are. He has
                      counted, at different times, and got different answers,
                      and has decided the question was badly formed.

SKILL NAME:           Beast Training
CLASS / TREE / TIER:  hunter / Houndmaster / tier_code 6
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
RIDERS:               scene-keyed [declared, not derived] — "patience and
                      repetition: every beast of yours hits 15% harder and
                      carries 25% more life"
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +5% beast damage and +7% beast life per rank
--- identity ---
ENGINE:               feeds — tougher beasts survive inside the 250px band
                      for longer, and every second they are alive near him is
                      income
COST:                 it does nothing whatsoever without beasts, which makes
                      it dead weight in a Marksman or Frenzy build. It is the
                      most build-locked passive in the class and it is the
                      best one if the build already committed
VISUAL:               the beast carries itself differently — it stops
                      flinching before contact
FLAVOR:               Patience is not a virtue he possesses. It is a thing he
                      does, on purpose, badly, for years at a time.

SKILL NAME:           Beast Bond
CLASS / TREE / TIER:  hunter / Houndmaster / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                n/a — reaches the beast wherever it is
TARGETS:              1 (the most-wounded beast)
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               heals 40 to the beast
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              ALLY_HP_BELOW_X (50%) — resolving to beasts first
THREAT:               none
--- growth ---
RANK ADDS:            +10 heal per rank
--- identity ---
ENGINE:               feeds +4 for the healing, and keeping the bond alive
                      keeps the whole engine running — this is the Hunter's
                      most important non-damage slot
COST:                 it costs him nothing, unlike the Priest's and the
                      Monk's versions, which makes it strictly good and
                      therefore a slot with no interesting decision in it
VISUAL:               a short unglamorous contact — a hand on the flank —
                      and the animal's wounds close from the inside
FLAVOR:               Nothing passes between them. He has been assured of
                      this by people who study such things, and he has been
                      polite about it, and he has continued.

SKILL NAME:           Bestial Rage
CLASS / TREE / TIER:  hunter / Houndmaster / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 self (pack buff)
SHAPE:                none
RANGE:                n/a
TARGETS:              every living beast
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               timed pack buff — beasts gain damage and attack speed
                      for the duration
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 300px)
THREAT:               none
--- growth ---
RANK ADDS:            +6% beast damage and +5% beast attack speed per rank;
                      +500ms duration every 4th rank
--- identity ---
ENGINE:               consumes 30 Bond, then feeds — faster beasts land more
                      hits and every hit inside the band is +3
COST:                 thirty Bond that could have paid for a mode switch. The
                      Beasts tree has four separate Bond spends and one
                      generator, and a Hunter who slots all of them will
                      spend the run at zero
VISUAL:               the animals stop looking at him at all
FLAVOR:               He does not do anything to them. He stops doing the
                      thing he has been quietly doing the entire time, and
                      what is left is what they were.

SKILL NAME:           Beast Mastery
CLASS / TREE / TIER:  hunter / Houndmaster / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (380px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               focus mark — every beast redirects onto the struck
                      target and deals bonus damage to it for the duration
DOT:                  none
AFFECTS:              enemies + own summons
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 380px among enemies above 50%
                      health, gated on 50 Bond
THREAT:               some
--- growth ---
RANK ADDS:            +6 damage; +5% beast bonus damage on the mark per rank;
                      +2s mark duration every 4th rank
--- identity ---
ENGINE:               consumes 50 Bond
COST:                 sixty seconds and fifty Bond for thirty damage and a
                      mark. It is the weakest capstone in the roster measured
                      on its own numbers and the strongest measured on what
                      the pack does with it, and the interface will only show
                      the first figure
VISUAL:               a single shot that does not kill, and then everything
                      he owns arrives at the same place
FLAVOR:               Mastery is not the right word for it either. He has
                      run out of words for it and has settled for the one on
                      the certificate.

---

## TREE: LONGSHOT  (was Marksman in the source conversion)

Role read: **the ranged spec, and the third tree in this project to ship as
interchangeable arrows.** Six single-target shots, four of them with names
promising mechanics the code does not deliver. It is also the only tree that
lets a Hunter fight at 700px, which is further than anything else in the
game reaches.

---

SKILL NAME:           Steady Shot
CLASS / TREE / TIER:  hunter / Longshot / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range long (420px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (18)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (420px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; at rank 6 it pierces 1 additional enemy,
                      +1 every 6 ranks
--- identity ---
ENGINE:               feeds +3 per hit ONLY while a beast is within 250px —
                      a Marksman Hunter shooting from the back line with his
                      bond somewhere else generates nothing at all
COST:                 the tree's core tension in its tier-1 node. Four hundred
                      and twenty pixels is exactly the distance at which the
                      Hunter's engine stops working, and every skill below
                      this one wants him further back
VISUAL:               a long unhurried draw; the release has no flourish in it
FLAVOR:               Steady is not about the hands. Everyone assumes it is
                      about the hands.

SKILL NAME:           Precise Aim
CLASS / TREE / TIER:  hunter / Longshot / tier_code 1
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
RIDERS:               stat mods: damageMult +0.08
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2.5% damage multiplier per rank — global
--- identity ---
ENGINE:               neutral
COST:                 eight percent is the smallest global multiplier in the
                      roster and it sits three tiers below an identical node.
                      See Hawk's Eye
VISUAL:               nothing visible
FLAVOR:               He does not aim. Aiming is what you do when you have
                      not already decided.

SKILL NAME:           Multishot
CLASS / TREE / TIER:  hunter / Longshot / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                fan (wide) (60° total)
RANGE:                range medium (360px)
TARGETS:              AUTHORED — 5 arrows in a spread, each seeking a
                      separate target
--- output ---
DAMAGE TIER:          low (12 per arrow)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (3+ within 360px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage per arrow; +1 arrow every 4th rank
--- identity ---
ENGINE:               feeds +3 per hit within the band — five arrows is
                      potentially five events, which makes this the tree's
                      best Bond generator when the beast is close
COST:                 sixty damage split five ways kills nothing on its own.
                      Against durable enemies it is the worst skill in the
                      tree and against chaff it is the best, and the swarm
                      composition decides which without asking
VISUAL:               a single draw and five arrows leaving on divergent
                      lines, correcting individually
FLAVOR:               One string. He has been asked how and has demonstrated,
                      slowly, twice, and neither observer was any clearer
                      afterward.

> **AUTHORED:** ToH's Multishot is a single 12-damage projectile. The name
> is *Multishot*. Made it a five-arrow spread.

SKILL NAME:           Crippling Arrow
CLASS / TREE / TIER:  hunter / Longshot / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range long (400px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (14)
PACE:                 medium (2000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — slow ×0.45 for 4000ms, and the target's own
                      attack speed is reduced 30% for the duration
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED, preferring the highest-health enemy
                      in range
THREAT:               none
--- growth ---
RANK ADDS:            +3 damage; +400ms duration every 3rd rank; +3% attack
                      speed reduction every 2nd rank
--- identity ---
ENGINE:               feeds +3 per hit within the band
COST:                 fourteen damage. Both halves of the cripple are
                      defensive and neither is visible on a damage meter,
                      which means this node will be dropped by most players
                      before they work out that it was the reason they were
                      surviving
VISUAL:               a low shot that takes the leg; the target keeps coming
                      and stops being able to commit to anything
FLAVOR:               He was taught to do this to things he intended to eat,
                      so they would not run far and spoil the meat. The
                      technique has not changed and the reasoning has.

> **AUTHORED:** no rider in ToH. A Crippling Arrow that cripples nothing.

SKILL NAME:           Hawk's Eye
CLASS / TREE / TIER:  hunter / Longshot / tier_code 4
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
RIDERS:               stat mods: damageMult +0.08
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2.5% damage multiplier per rank — global
--- identity ---
ENGINE:               neutral
COST:                 it is Precise Aim. Identical stat, identical magnitude,
                      identical scaling, three tiers apart in the same tree.
                      A player who takes both has spent two of eight slots on
                      one effect, and nothing in the interface indicates that
VISUAL:               nothing visible
FLAVOR:               A wedge-tailed eagle can see a rabbit from two
                      kilometres. He cannot. He has simply stopped needing to
                      look at the thing he is going to hit.

> **Duplicate flagged:** Precise Aim (tier 2) and Hawk's Eye (tier 5) are
> the same node with the same number. One of them should become something
> else — range, projectile speed, or crit — before this ships.

SKILL NAME:           Net Shot
CLASS / TREE / TIER:  hunter / Longshot / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                multi-target (the net spreads on impact, r90)
RANGE:                range medium (340px)
TARGETS:              AUTHORED — up to 4 enemies within r90 of the impact
--- output ---
DAMAGE TIER:          low (8)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — root 2500ms on everything the net catches
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 340px
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage; +300ms root every 3rd rank; +1 caught enemy
                      every 4th rank
--- identity ---
ENGINE:               feeds +3 per hit within the band
COST:                 eight damage. It is the only multi-target hard control
                      the Hunter owns and its entire value is those two and a
                      half seconds, which against a fast swarm is one wave's
                      worth of breathing room every nine seconds
VISUAL:               a weighted bundle that opens in flight and comes down
                      across several of them at once
FLAVOR:               Nets are older than bows and considerably more useful
                      and nobody has ever written a song about one.

> **AUTHORED:** ToH's Net Shot is a single-target 8-damage projectile with
> no rider — the lowest damage in the class attached to the most
> unambiguous name in it. Added the spread and the root.

SKILL NAME:           Trueshot Aura
CLASS / TREE / TIER:  hunter / Longshot / tier_code 6
TYPE:                 buff
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self + own beasts (see COST)
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               timed 8000ms — attackSpeedMult +0.20, extended to the
                      Hunter's own beasts
DOT:                  none
AFFECTS:              self + own summons
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 350px)
THREAT:               none
--- growth ---
RANK ADDS:            +5% attack speed per rank; +400ms duration every 4th
                      rank
--- identity ---
ENGINE:               feeds — faster beasts and a faster Hunter both generate
                      more +3 events inside the band
COST:                 it is called an aura and it is not one. It projects
                      nothing, covers nobody in co-op, and lasts eight
                      seconds in eighteen. I extended it to the Hunter's own
                      beasts because a pet class's speed buff excluding its
                      pets is clearly unintended, but it still does not reach
                      other players
VISUAL:               a steady focus; the draw-and-release cycle visibly
                      tightens for him and the animals pick up the same tempo
FLAVOR:               Trueshot is a word from a manual written by somebody
                      who had not done it. He kept the word because the
                      recruits liked it.

SKILL NAME:           Boomerang
CLASS / TREE / TIER:  hunter / Longshot / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                line (out and back)
RANGE:                range medium (260px)
TARGETS:              AUTHORED — hits every enemy on the way out and again on
                      the way back
--- output ---
DAMAGE TIER:          low (16 per pass, 32 to anything hit twice)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               the return pass is 400ms after the outbound, along the
                      same line
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 260px — aims along the axis
                      lining up the most bodies
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage per pass; +20px range every 4th rank
--- identity ---
ENGINE:               feeds +3 per hit — the double pass makes it the tree's
                      most Bond-efficient single cast
COST:                 the return pass lands 400ms later, by which time the
                      swarm has moved off the line. In practice it hits most
                      things once and a lucky few twice, and its printed
                      thirty-two is a best case that requires enemies to be
                      standing still
VISUAL:               it goes out flat and low, turns without slowing, and he
                      catches it without looking
FLAVOR:               Not all of them come back. That is the part people get
                      wrong. The returning kind is a specific tool for a
                      specific purpose and the purpose was never hunting.

> **AUTHORED:** ToH's Boomerang is a plain single-target projectile that
> does not return. Added the return pass, which is the entire meaning of the
> word.

SKILL NAME:           Sniper's Focus
CLASS / TREE / TIER:  hunter / Longshot / tier_code 8
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
RIDERS:               timed 5000ms — damageMult +0.35, the largest damage
                      buff magnitude in the class
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              COOLDOWN_READY when a target above 60% health is within
                      range — it wants something worth spending on
THREAT:               none
--- growth ---
RANK ADDS:            +6% damage multiplier per rank; +300ms duration every
                      4th rank
--- identity ---
ENGINE:               neutral
COST:                 five seconds in twenty. It is up a quarter of the time
                      and its magnitude is only large because the window is
                      so short, and in an auto-fire game the player cannot
                      choose to spend those five seconds on the right skills
VISUAL:               everything except the target loses definition slightly;
                      the shot that follows arrives with more weight than the
                      draw suggested
FLAVOR:               There is a moment where the rest of it stops being
                      information. He can produce it now, more or less on
                      demand, and it took him twenty years to be able to and
                      he is not sure he likes what it cost.

SKILL NAME:           Eagle's Gaze
CLASS / TREE / TIER:  hunter / Longshot / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range long (700px — the longest reach in the game)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          high (55)
PACE:                 capstone (25000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 700px, gated on 40 Bond
THREAT:               some
--- growth ---
RANK ADDS:            +10 damage; at rank 6 the impact splashes r80, +12px
                      every 4 ranks
--- identity ---
ENGINE:               consumes 40 Bond — which a Marksman Hunter standing at
                      700px cannot generate, because his beast is nowhere
                      near him. The capstone of this tree is gated behind a
                      resource the tree's own playstyle destroys
COST:                 sixty seconds for fifty-five damage into one enemy.
                      Every other tier-10 in the roster touches a crowd. This
                      one reaches further than anything in the game and
                      arrives at a single target, once a minute
VISUAL:               the shot leaves and there is a long pause with nothing
                      in it, and the impact happens somewhere near the edge
                      of what is visible
FLAVOR:               Seven hundred paces. He has never explained how he
                      knows it will connect and has never once been asked
                      twice.

> **Structural note:** same problem as the Samurai's Bow — the tree's
> capstone costs an engine resource the tree cannot produce. Either Marksman
> hits generate Bond regardless of beast proximity, or Eagle's Gaze should
> not be gated.

---

## TREE: PINCER  (was Frenzy in the source conversion)

Role read: **the melee bruiser, and the tree that agrees with the engine.**
Everything here happens inside 80px, which is exactly where the Bond band
wants the Hunter standing. It is the only tree in the class whose playstyle
and whose resource want the same thing.

---

SKILL NAME:           Feral Swipe
CLASS / TREE / TIER:  hunter / Pincer / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r76)
RANGE:                melee short (76px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          low (18)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (76px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +1 target every 5th rank
--- identity ---
ENGINE:               feeds +3 per hit, and at 76px the beast is always
                      inside the band — this is the class's most reliable
                      generator
COST:                 seventy-six pixels on a class built around a bow. The
                      Frenzy tree makes the engine work and puts the Hunter
                      exactly where a ranged character should never be
VISUAL:               a wide low swipe with the off hand, claws or knife
                      depending on what he has
FLAVOR:               He did not intend to end up fighting like this. It came
                      from spending a great deal of time watching something
                      that fights like this and not enough time watching
                      anything else.

SKILL NAME:           Twin Daggers
CLASS / TREE / TIER:  hunter / Pincer / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r70)
RANGE:                melee short (70px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          low (10 × 2 pulses = 20)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               2 pulses 140ms apart, each rolling its own hits
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (70px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage per pulse; +1 pulse every 6th rank
--- identity ---
ENGINE:               feeds +3 per cast, not per pulse
COST:                 twenty damage over 4500ms is worse than Feral Swipe's
                      eighteen over 2000ms in every respect. Its only
                      argument is two chances to apply Venom Blades instead
                      of one
VISUAL:               left then right, close in, no reach on either
FLAVOR:               Two is not for the second cut. Two is so that the first
                      one does not have to be correct.

SKILL NAME:           Venom Blades
CLASS / TREE / TIER:  hunter / Pincer / tier_code 2
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
RIDERS:               scene-keyed [declared, not derived] — "the edges
                      fester: every strike you land leaves a venom that keeps
                      working after the blade is gone"
DOT:                  venom applied by every damaging skill — magnitude in
                      MainScene
AFFECTS:              enemies
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2 venom damage per tick per rank; +1s duration every
                      5th rank
--- identity ---
ENGINE:               feeds indirectly — venom kills are the Hunter's kills,
                      and they land after the strike, frequently while he is
                      already swinging at something else
COST:                 it applies to the Hunter's strikes and not to his
                      beasts', which means a Beasts-heavy build gets a
                      fraction of it. Every scene-keyed multiplier in this
                      class has that shape
VISUAL:               struck enemies keep a dark weeping line and their
                      movement degrades over the following seconds
FLAVOR:               Australia. He has never had to go looking for the
                      ingredients and has, on several occasions, had to go
                      looking for somewhere without them.

SKILL NAME:           Pack Leader
CLASS / TREE / TIER:  hunter / Pincer / tier_code 3
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
RIDERS:               scene-keyed [declared, not derived] — "the pack makes
                      you braver: with a beast close, YOU strike 12% harder,
                      and beasts fighting at your side strike 12% harder too"
DOT:                  none
AFFECTS:              self, own summons
--- automation ---
TRIGGER:              always-on, CONDITIONAL on a beast being within Bond
                      range
THREAT:               none
--- growth ---
RANK ADDS:            +4% to both halves per rank
--- identity ---
ENGINE:               the second of the two nodes Bond was derived from
COST:                 it is Pack Tactics with bigger numbers in a different
                      tree, and both halves switch off when the beast is not
                      close. Running both is two slots on one conditional
                      multiplier, and the condition is the same condition
VISUAL:               nothing on him; the beast fights nearer than it
                      otherwise would
FLAVOR:               Braver is his word for it and it is not accurate. What
                      it actually is, is that the calculation about whether to
                      commit has stopped being one he performs alone.

SKILL NAME:           Quill Guard
CLASS / TREE / TIER:  hunter / Pincer / tier_code 4
TYPE:                 buff
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               timed 6000ms — reflectPct 0.30
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 120px)
THREAT:               none
--- growth ---
RANK ADDS:            +4% reflect per rank; +400ms duration every 4th rank
--- identity ---
ENGINE:               feeds — reflect kills are his kills, and at 120px the
                      beast is inside the band
COST:                 thirty percent returned means seventy percent taken, on
                      a class with mid-range health that is already standing
                      at seventy-six pixels because of everything else in
                      this tree
VISUAL:               a bristling of dark spines along the forearms and back
                      that retracts as the window closes
FLAVOR:               Echidna. Not a fast animal, not a strong one, and
                      nothing on the continent has worked out what to do
                      about it in fifty million years.

SKILL NAME:           Hamstring Slash
CLASS / TREE / TIER:  hunter / Pincer / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r74)
RANGE:                melee short (74px)
TARGETS:              cap 4
--- output ---
DAMAGE TIER:          low (14)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               slow ×0.5 for 2500ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (74px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage; +300ms slow every 3rd rank; +1 target every
                      4th rank
--- identity ---
ENGINE:               feeds +3 per hit
COST:                 two and a half seconds of slow on a six-second
                      cooldown, applied at melee range to things that are
                      already touching him. It buys distance he then does not
                      want, because his engine needs him close
VISUAL:               a low cut across the back of the legs on the way past
FLAVOR:               Same technique as Crippling Arrow and considerably less
                      dignified about it.

SKILL NAME:           Call of the Wild
CLASS / TREE / TIER:  hunter / Pincer / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns in a loose ring)
TARGETS:              n/a — a temporary wild pack, separate from the bond
--- output ---
DAMAGE TIER:          none (0) — the pack deals the damage
PACE:                 very slow (8000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               the temporary pack does not count against the bond and
                      does not change its mode; it expires on its own
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              CROWD_THRESHOLD (6+ within 300px), gated on 40 Bond
THREAT:               some (delegated across the pack)
--- growth ---
RANK ADDS:            +12% pack damage and HP per rank; +1 animal every 5th
                      rank; +2s lifespan every 4th rank
--- identity ---
ENGINE:               consumes 40 Bond and then floods it — several extra
                      bodies landing hits inside the 250px band is the
                      largest burst of income the class can produce
COST:                 forty Bond, which is most of a full bar, and the pack
                      expires. Everything else in the Beasts tree is an
                      investment that persists; this is a lease, and a Hunter
                      leaning on it for Bond is running to stand still
VISUAL:               they come in from off-screen in ones and twos, from
                      several directions, and none of them look at him
FLAVOR:               He does not summon them. He makes a particular noise
                      and a number of things that were already nearby decide,
                      independently, that the noise concerns them.

SKILL NAME:           Hunt as One
CLASS / TREE / TIER:  hunter / Pincer / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (area at the target)
RANGE:                range medium (260px)
TARGETS:              cap 5
--- output ---
DAMAGE TIER:          medium (20)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               focus mark, applied ONLY if beasts are out — every
                      beast redirects onto the struck area. No stun (zeroed
                      in code)
DOT:                  none
AFFECTS:              enemies + own summons
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 260px, gated to prefer firing
                      while at least one beast is alive
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +6% beast damage on the marked area per rank
--- identity ---
ENGINE:               feeds — it deliberately pulls the pack toward the
                      Hunter's chosen point, which drags them back inside the
                      250px band. It is the only skill in the class that
                      actively repairs the engine's positioning problem
COST:                 the mark half does nothing at all in a beastless build,
                      and twenty damage on a nine-second cooldown is thin for
                      tier 8 without it. It is a good skill in exactly one
                      kind of Hunter
VISUAL:               he strikes a point and every animal he owns is already
                      converging on it before the impact resolves
FLAVOR:               The name is not a metaphor and he would prefer people
                      stopped treating it as one.

SKILL NAME:           Bloodletter
CLASS / TREE / TIER:  hunter / Pincer / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r80)
RANGE:                melee long (80px)
TARGETS:              cap 4
--- output ---
DAMAGE TIER:          medium (22) — plus 56 over the bleed
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none beyond the bleed
DOT:                  7 per 500ms for 4000ms — 56 per target caught
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — prefers clusters containing enemies
                      not already bleeding, so the DoT spreads rather than
                      refreshing
THREAT:               some
--- growth ---
RANK ADDS:            +4 impact damage; +2 bleed per tick every 2nd rank;
                      +1s bleed duration every 5th rank
--- identity ---
ENGINE:               feeds +3 per hit, and bleed kills land later, often
                      while the beast is the nearest thing to them
COST:                 seventy-eight total damage per target is the highest
                      sustained figure in the class, and three-quarters of it
                      arrives over four seconds against swarm enemies that
                      frequently do not last four seconds
VISUAL:               a deep drawing cut rather than a strike; the wound
                      opens further over the following seconds
FLAVOR:               It is not about the blood loss. Four seconds of an
                      animal knowing something is wrong with it does more
                      than the wound ever will.

SKILL NAME:           Alpha's Fury
CLASS / TREE / TIER:  hunter / Pincer / tier_code 9
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               form 10000ms — damageMult +0.20, attackSpeedMult +0.20,
                      moveSpeedMult +0.10
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (7+ within 250px), gated on 60 Bond
THREAT:               none
--- growth ---
RANK ADDS:            +5% damage and +4% attack speed per rank; +500ms
                      duration every 4th rank
--- identity ---
ENGINE:               consumes 60 Bond and then refunds fast — +20% attack
                      speed means more hits, and every hit inside the band is
                      +3. Fired with the pack close, Alpha's Fury pays itself
                      back inside the window
COST:                 sixty Bond is the largest spend in the class and the
                      buff affects only the Hunter. The capstone of the pack
                      class is the one skill that does nothing for the pack,
                      which is either a pointed piece of characterisation or
                      an oversight, and I have written it as the former
VISUAL:               nothing about him changes shape. The animals near him
                      drop back half a step and let him take the front
FLAVOR:               There is a version of the story where the alpha is the
                      strongest. It is not true of wolves and it has never
                      been true of him. The alpha is the one that goes first,
                      and going first is not a reward.
