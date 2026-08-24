# BARD — RUMBLEJAM CONVERSION (30 skills)

Mechanical fields carried from the code export unchanged. Eight judgment
fields authored. Class-wide rulings stated once here.


---

## ROSTER RULING APPLIED

**Engine — RULED: Rhythm (doc engine, built name, per §8.3).**

**Tree names — built names win.** HELD — see below
**HELD, and it is a genuine exception.** Songs is clearly the support tree and maps to **Ensemble** (heal/shield/ward/drain). But Battle (melee) and Sonic Chaos (ranged control) both have a claim on **Cadence** and **Requiem**, and neither built name carries a role signal strong enough to decide it.

**Tree contents — the document wins**, per the standing rule. Applied without
further asking; divergences from the built tree are what this file already
describes.

**Pace (ruling 1).** Every timed active rebucketed to the fixed values, then
brought into the bucket-mix rule — at least 2 nodes fast-or-better per tree, at
most 1 very fast, at most 2 very slow. All three trees comply.

**Rate: 5.50/sec on a spread build — BELOW the band.**

**Ruling 6 (rider duration under cooldown) is NOT yet applied to this file.**
Cooldowns moved; rider durations did not. Any rider now longer than its skill's
cooldown is a permanent effect until that sweep runs.

**Outstanding:** the doc's Tempo→song-radius payout is not in the built `rhythm` term.

---

## CLASS ENGINE — TEMPO

**TEMPO, 0–100.** Starts each run at 0.

Feeds:
- A skill firing **within 2000ms** of the previous one: **+8**
- A skill firing after a longer gap: **+2**
- Any song buff being active on an ally: **+1/sec per ally covered**

Consumes:
- Choir of Divinity **60** · War Song **50** · Chaotic Riff **40**

Decays **3/sec.**

And one thing no other engine does: **Tempo scales the radius of every song.**
Song auras project at 120px at zero Tempo and 260px at a hundred. The Bard's
party contribution literally grows as his machine gets busier, which means
the co-op Bard is trying to keep firing *constantly* rather than efficiently
— the opposite of the Wizard, who is trying to fire as little as he can get
away with.

Tempo rewards a build made of many short cooldowns over a build made of few
long ones, which is the correct shape for a class whose tier-1 nodes are
2500ms and whose capstones are a minute apart.

---

## PORT RULINGS

**1. Songs become party auras. This is the big one.** Eight of the ten
Songs-tree skills, plus two in Battle, are marked `AFFECTS: self` in the
code — Sharpen, Echo of Passion, Song of Lore, Chant of the Ancestors, Song
of Blood, Choir of Divinity, Throat Chant. A Bard whose songs buff only
himself is a mislabelled rogue, and in a game with co-op that is a role
failure rather than a balance quirk.

Ruling: **every song-type buff projects to allies and own summons within the
Tempo radius, at full magnitude.** Solo it resolves to self plus summons and
plays exactly as ToH does today. In co-op the Bard becomes the party's
damage amplifier, which is the WoW role the class is obviously reaching for.

This is the largest single invention in the project and I am confident it is
correct. If you disagree, the alternative is to rename the class.

**2. Two songs are completely empty.** Song of Lore (90s cooldown, 60s
duration, no stat mods) and Chant of the Ancestors (20s cooldown, 8s
duration, no stat mods) have no effect of any kind. Same situation as the
Druid's Essential Oils. Authored from their names and flagged on both blocks.

**3. Sonic Echoes' echo is a real damage source.** Declared as a delayed
second hit at 35%. Ruling: it applies to every damaging skill the Bard owns,
600ms after the original, and it can crit and proc independently. This makes
it the Bard's Razor's Edge — a passive that multiplies the whole kit.

**4. Confusion, defined.** Sonic Distortion applies "confusion" with no
numbers. Ruling: **the target attacks other enemies for 4000ms** and its
threat on the player drops to zero. That's what the confusion map in
MainScene is for and it is the only mind-control effect in the roster.

**5. Movement, allies, hazards, channels** carry from earlier classes.

---

## TREE: SONGS

Role read: **the support spec — the roster's only true buffer.** With ruling
1 applied, this is the tree that makes a co-op group hit twenty to fifty
percent harder. Solo it is a self-buff tree with two heals in it and it is
much less interesting, which is honest: the Bard is the one class that is
straightforwardly better with other people.

---

SKILL NAME:           Dissonant Symphony
CLASS / TREE / TIER:  bard / Songs / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (circle r120 at 220px)
RANGE:                range short (220px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (22)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               heals the Bard 10 on every cast
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 220px
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +3 self-heal per rank; +8px radius every
                      3rd rank
--- identity ---
ENGINE:               feeds +8 Tempo at 2500ms — the class's primary
                      metronome, and the reason nearly every Bard build
                      keeps this slotted for the whole run
COST:                 it is the tier-1 node and it never stops being correct,
                      which is a design smell. Its damage falls off, but the
                      heal and the Tempo do not, so it occupies a slot
                      permanently for reasons that have nothing to do with
                      killing anything
VISUAL:               a chord that does not resolve, struck once; the air in
                      the circle visibly ripples out of phase
FLAVOR:               A wrong note played with sufficient conviction stops
                      being a mistake and becomes a decision. He learned that
                      in a basement in Camden and has been trading on it ever
                      since.

SKILL NAME:           Hum of the Ancients
CLASS / TREE / TIER:  bard / Songs / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r110 at caster, persistent 20000ms)
RANGE:                melee long (110px)
TARGETS:              every ally and summon in the field
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  heals 3 per 1000ms for 20000ms — 60 per friendly who
                      stays in it
AFFECTS:              allies + own summons
--- automation ---
TRIGGER:              COOLDOWN_READY when 2+ friendlies are below 80% within
                      110px
THREAT:               none
--- growth ---
RANK ADDS:            +1 heal per tick per rank; +4s duration every 4th rank;
                      +8px radius every 3rd rank
--- identity ---
ENGINE:               feeds — twenty seconds of ticking across several bodies
                      is a large slow Tempo block
COST:                 a 110px circle that lasts twenty seconds while the Bard
                      spends nineteen of them somewhere else. It is one of
                      only two skills in the tree that touched allies before
                      my ruling, and it is anchored to a spot
VISUAL:               a low sustained drone with no visible source; the air
                      inside the radius has a warmth to the colour
FLAVOR:               Older than the words. Every culture that has ever
                      buried anyone has one of these and they are all,
                      unnervingly, in roughly the same key.

SKILL NAME:           Sharpen
CLASS / TREE / TIER:  bard / Songs / tier_code 2
TYPE:                 buff
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 self (projects to allies — ruling 1)
SHAPE:                none
RANGE:                Tempo radius (120–260px)
TARGETS:              self + all allies and summons in radius
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               timed 10000ms — damageMult +0.20 to everyone covered
DOT:                  none
AFFECTS:              self + allies + own summons
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ enemies within 300px)
THREAT:               none
--- growth ---
RANK ADDS:            +4% damage multiplier per rank; +500ms duration every
                      4th rank
--- identity ---
ENGINE:               feeds +1/sec per ally covered
COST:                 ten seconds in sixteen. Solo it is a mediocre damage
                      buff; in a four-player group it is +20% damage on four
                      characters, which is the largest single contribution
                      any one slot makes in the game. The Bard's value is
                      almost entirely a function of how many people are
                      standing near him
VISUAL:               a rising two-note figure; every weapon in range picks
                      up a faint hard edge for the duration
FLAVOR:               He is not sharpening the blade. Blades do not listen.
                      He is sharpening the person holding it, which is
                      easier and considerably less reliable.

SKILL NAME:           Echo of Passion
CLASS / TREE / TIER:  bard / Songs / tier_code 3
TYPE:                 buff
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 self (projects to allies — ruling 1)
SHAPE:                none
RANGE:                Tempo radius (120–260px)
TARGETS:              self + all allies and summons in radius
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               timed 8000ms — regenPerSec 6 to everyone covered
DOT:                  none
AFFECTS:              self + allies + own summons
--- automation ---
TRIGGER:              ALLY_HP_BELOW_X (70%)
THREAT:               none
--- growth ---
RANK ADDS:            +2 regen per second per rank; +400ms duration every
                      4th rank
--- identity ---
ENGINE:               feeds +1/sec per ally covered
COST:                 forty-eight health over eight seconds is slow healing
                      even by the standards of slow healing. It cannot answer
                      a burst and it competes for a slot with Sharpen, which
                      contributes to killing things faster and therefore to
                      taking less damage in the first place
VISUAL:               a warm sustained line under everything else, felt more
                      than heard; recipients' outlines steady
FLAVOR:               Passion is a word people use for the loud version. The
                      version he means is quieter and considerably harder to
                      keep going for eight consecutive seconds.

SKILL NAME:           Song of Lore
CLASS / TREE / TIER:  bard / Songs / tier_code 4
TYPE:                 buff
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 self (projects to allies — ruling 1)
SHAPE:                none
RANGE:                Tempo radius (120–260px)
TARGETS:              self + all allies and summons in radius
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               AUTHORED — timed 60000ms: everyone covered gains +20%
                      experience and +15% pickup radius, and every enemy
                      killed while the song runs has a 10% chance to drop an
                      extra pickup
DOT:                  none
AFFECTS:              self + allies + own summons
--- automation ---
TRIGGER:              COOLDOWN_READY — fired the instant it is available and
                      simply maintained
THREAT:               none
--- growth ---
RANK ADDS:            +3% experience and +2% extra-drop chance per rank;
                      −5s cooldown every 5th rank, floor 60s
--- identity ---
ENGINE:               feeds +1/sec per ally covered, for a full minute — the
                      largest sustained Tempo source in the class
COST:                 it does nothing in the fight. No damage, no
                      mitigation, no healing — a slot spent entirely on the
                      run going better later. On a short run it is a wasted
                      slot and on a long one it may be the reason the run was
                      long
VISUAL:               nothing dramatic. A recurring melodic figure and a
                      faint gold thread connecting everyone it covers
FLAVOR:               The job was never the fighting. The job was that
                      somebody had to be there and remember it afterward in a
                      form other people would agree to listen to.

> **AUTHORED FROM NOTHING.** Song of Lore has a 90-second cooldown, a
> 60-second duration, and no stat mods of any kind — it is an empty skill.
> The name points at knowledge and memory rather than combat, so I wrote it
> as a run-economy buff rather than another damage multiplier. Reviewed as a
> design proposal, not a conversion.

SKILL NAME:           Chant of the Ancestors
CLASS / TREE / TIER:  bard / Songs / tier_code 5
TYPE:                 buff
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 self (projects to allies — ruling 1)
SHAPE:                none
RANGE:                Tempo radius (120–260px)
TARGETS:              self + all allies and summons in radius
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               AUTHORED — timed 8000ms: everyone covered becomes
                      immune to stun, knockback and root, and takes 40% less
                      duration from every other debuff
DOT:                  none
AFFECTS:              self + allies + own summons
--- automation ---
TRIGGER:              ON_DAMAGE_TAKEN, gated to fire when the Bard or a
                      covered ally is currently stunned, rooted, or carrying
                      2+ afflictions
THREAT:               none
--- growth ---
RANK ADDS:            +400ms duration per rank; +4% debuff duration reduction
                      per rank, floor 20% of original
--- identity ---
ENGINE:               feeds +1/sec per ally covered
COST:                 eight seconds of crowd-control immunity is enormous in
                      the rooms that have crowd control and worth precisely
                      nothing in the rooms that do not. It is the
                      highest-variance slot in the class
VISUAL:               a low unison chant with no clear number of voices in
                      it; incoming control effects visibly break on contact
                      with everyone covered
FLAVOR:               He is not asking them for anything. He is reminding
                      the people around him that a great many others have
                      already been through worse and that the arithmetic of
                      that is on their side.

> **AUTHORED FROM NOTHING.** Chant of the Ancestors has a 20-second
> cooldown, an 8-second duration, and no stat mods. Empty skill. I gave it
> group CC immunity because the roster has no party-wide dispel and the
> Bard is the obvious owner. Design proposal, not conversion.

SKILL NAME:           Disruptive Harmonics
CLASS / TREE / TIER:  bard / Songs / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r140, persistent field 5000ms)
RANGE:                range short (200px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0) — the tick is 0 damage, purely a re-apply
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               slow ×0.55 and weaken 25% to everything inside
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 200px
THREAT:               none
--- growth ---
RANK ADDS:            +1s duration and +6px radius per rank; +2% weaken every
                      3rd rank (not damage — this skill deals none at any
                      rank)
--- identity ---
ENGINE:               feeds +8 Tempo when fired in rhythm
COST:                 zero damage, and it is the only control skill in a tree
                      otherwise made of buffs. A player scanning the Songs
                      tree for something that affects enemies will find this
                      and Dissonant Symphony and nothing else
VISUAL:               a field where the sound is visibly wrong — enemies
                      inside move as though they cannot hear their own
                      footing
FLAVOR:               Every structure has a frequency it does not enjoy.
                      Bodies included. He found most of them by accident and
                      wrote them down.

SKILL NAME:           Song of Blood
CLASS / TREE / TIER:  bard / Songs / tier_code 7
TYPE:                 buff
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 self (projects to allies — ruling 1)
SHAPE:                none
RANGE:                Tempo radius (120–260px)
TARGETS:              self + all allies and summons in radius
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               timed 8000ms — damageMult +0.20, attackSpeedMult +0.20,
                      moveSpeedMult +0.15 to everyone covered
DOT:                  none
AFFECTS:              self + allies + own summons
--- automation ---
TRIGGER:              CROWD_THRESHOLD (6+ enemies within 300px)
THREAT:               none
--- growth ---
RANK ADDS:            +4% damage and +4% attack speed per rank; +400ms
                      duration every 4th rank
--- identity ---
ENGINE:               feeds +1/sec per ally covered
COST:                 it is Sharpen with two extra stats five tiers later,
                      and running both means two slots on buffs whose windows
                      overlap and whose multipliers do not stack cleanly. In
                      a group it is still probably worth it; solo it is
                      redundant
VISUAL:               a driving low rhythm with a physical pulse to it;
                      everyone covered moves fractionally ahead of where they
                      were going to
FLAVOR:               Not about blood. The title is a translation error that
                      stuck four hundred years ago and he has stopped
                      correcting people because the wrong version gets a
                      better response.

SKILL NAME:           Foot Stamp Rally
CLASS / TREE / TIER:  bard / Songs / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                Tempo radius (120–260px)
TARGETS:              self + all allies and summons in radius
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               heals the Bard 30 immediately
DOT:                  allies and summons heal 8 per 300ms for 900ms — a
                      burst of 24 delivered almost instantly
AFFECTS:              allies + own summons + self
--- automation ---
TRIGGER:              ALLY_HP_BELOW_X (50%)
THREAT:               none
--- growth ---
RANK ADDS:            +8 self-heal and +3 per ally tick per rank
--- identity ---
ENGINE:               feeds — the fastest healing delivery in the class,
                      three ticks in under a second across everyone covered
COST:                 the Bard heals thirty and each ally heals twenty-four,
                      which is the wrong way round for a support class and
                      makes this a self-heal that happens to spill. It is
                      also the only fast heal the Bard has, so it will be
                      slotted regardless
VISUAL:               three hard stamps in rhythm; the floor pulses outward
                      with each and everyone covered straightens
FLAVOR:               The oldest instrument. No strings, no reeds, no
                      craftsmanship required, and it has never once needed
                      to be explained to anybody in any century.

SKILL NAME:           Choir of Divinity
CLASS / TREE / TIER:  bard / Songs / tier_code 9
TYPE:                 buff
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self (projects to allies — ruling 1)
SHAPE:                none
RANGE:                Tempo radius (120–260px)
TARGETS:              self + all allies and summons in radius
--- output ---
DAMAGE TIER:          none (0)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               timed 10000ms — damageMult +0.30, attackSpeedMult
                      +0.30, moveSpeedMult +0.20, damageReduction +0.25 to
                      everyone covered
DOT:                  none
AFFECTS:              self + allies + own summons
--- automation ---
TRIGGER:              CROWD_THRESHOLD (10+ within 350px), gated on 60 Tempo
THREAT:               none
--- growth ---
RANK ADDS:            +5% damage and +5% attack speed per rank; +500ms
                      duration every 4th rank
--- identity ---
ENGINE:               consumes 60 Tempo — and the Tempo gate means it fires
                      only when the Bard has been playing continuously, which
                      is exactly right for a capstone about a choir reaching
                      full voice
COST:                 sixty seconds for ten. In a four-player group those ten
                      seconds are the single strongest window any class
                      produces and the whole party feels it land. Solo it is
                      one character getting a large buff for a sixth of a
                      minute, which is fine and not remotely the same thing
VISUAL:               the number of voices is wrong. There are more of them
                      than there are people, and everyone covered is briefly
                      lit from slightly above
FLAVOR:               He does not know who the extra voices belong to. He
                      has asked, in the way one asks a question one does not
                      want answered, and the answer has not arrived, and he
                      keeps using it.

---

## TREE: BATTLE

Role read: **the melee DPS spec, and the tree that has almost nothing to do
with music.** A mosh pit, a stage dive, a heavy swing and a coda. It is where
a Bard goes when the group already has support, and it carries the class's
only high damage tier.

---

SKILL NAME:           Mosh
CLASS / TREE / TIER:  bard / Battle / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r66)
RANGE:                melee short (66px)
TARGETS:              cap 4
--- output ---
DAMAGE TIER:          low (9 × 3 pulses = 27)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               3 pulses 130ms apart, each rolling its own hits
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (3+ within 66px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage per pulse; +1 pulse every 6th rank
--- identity ---
ENGINE:               feeds +8 Tempo at 2800ms — the Battle tree's metronome
COST:                 sixty-six pixels, which is the shortest reach in the
                      tree, on the node a new player takes first. It teaches
                      the Bard's actual lesson immediately: this class stands
                      in the middle of things
VISUAL:               shoulders and elbows, no technique whatsoever, three
                      collisions in under half a second
FLAVOR:               There are rules. Nobody has written them down and
                      everybody knows them, and the only people who get hurt
                      are the ones who came to hurt someone.

SKILL NAME:           Throat Chant
CLASS / TREE / TIER:  bard / Battle / tier_code 1
TYPE:                 buff
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 self (projects to allies — ruling 1)
SHAPE:                none
RANGE:                Tempo radius (120–260px)
TARGETS:              self + all allies and summons in radius
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               timed 8000ms — attackSpeedMult +0.30, damageMult +0.15
                      to everyone covered
DOT:                  none
AFFECTS:              self + allies + own summons
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ enemies within 300px)
THREAT:               none
--- growth ---
RANK ADDS:            +5% attack speed and +3% damage per rank; +400ms
                      duration every 4th rank
--- identity ---
ENGINE:               feeds +1/sec per ally covered, and the attack speed
                      raises everyone's cast rate, which raises the Bard's
                      own Tempo generation — the only self-reinforcing loop
                      in the class
COST:                 attack speed is worth the most to characters with many
                      short cooldowns and nearly nothing to a Necromancer
                      whose build is four summons. The Bard's best buff is
                      unevenly good depending on who is standing next to him,
                      and he has no way to tell
VISUAL:               a sustained low overtone with a second pitch inside it;
                      everyone covered starts moving on the same beat
FLAVOR:               Two notes at once from one throat. It is not a trick
                      and it is not difficult, and he has never met anyone
                      who believed either of those statements.

SKILL NAME:           Resonance Cascade
CLASS / TREE / TIER:  bard / Battle / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                chain
RANGE:                melee long (90px)
TARGETS:              chain, 2 jumps
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 90px
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +1 chain jump every 4th rank
--- identity ---
ENGINE:               feeds Tempo normally
COST:                 a chain skill with a ninety-pixel initial range, which
                      is a contradiction — chains want to start far and reach
                      across a crowd, and this one has to be inside the crowd
                      before it can begin
VISUAL:               a struck note that jumps between bodies, each arrival
                      slightly flatter than the last
FLAVOR:               Sound does not stop at the first thing it hits. He has
                      never understood why people expect it to.

SKILL NAME:           Piercing Whistle
CLASS / TREE / TIER:  bard / Battle / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                cone (narrow) (80° total)
RANGE:                melee long (110px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (12)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               stun 900ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (110px)
THREAT:               some
--- growth ---
RANK ADDS:            +100ms stun and +4° cone width per rank (not damage —
                      twelve is the floor and inflating it makes a bad attack
                      out of a good control skill)
--- identity ---
ENGINE:               feeds Tempo normally
COST:                 twelve damage. It is the Battle tree's only stun and
                      the only thing keeping a melee Bard alive at close
                      range, and it is available once every nine seconds
VISUAL:               two fingers, no instrument, and a wedge of the room
                      going rigid
FLAVOR:               Learned on a picket line, not in a conservatory. He is
                      more proud of it than of anything he learned in the
                      conservatory.

SKILL NAME:           Heavy Swing
CLASS / TREE / TIER:  bard / Battle / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r84)
RANGE:                melee long (84px)
TARGETS:              cap 5
--- output ---
DAMAGE TIER:          high (70)
PACE:                 slow (4000ms)
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
ENGINE:               feeds Tempo normally
COST:                 600ms of wind-up, auto-fired, against a swarm that is
                      still moving. It is the joint-highest single hit in the
                      roster and it lands where the enemies were. It is also
                      identical to the Blacksmith's Overswing in every
                      number, which is worth knowing
VISUAL:               the instrument goes fully overhead, held for a beat,
                      and comes down as a blunt object with no musical
                      pretension at all
FLAVOR:               A guitar weighs about eight pounds and the neck gives
                      you a great deal of leverage. This has been true the
                      entire time and he is not the first to notice.

SKILL NAME:           Stage Dive
CLASS / TREE / TIER:  bard / Battle / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                line (movement path)
RANGE:                range medium (280px)
TARGETS:              each enemy in path once, uncapped
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               knockdown — stun 900ms per enemy hit; caster displaced
                      280px
DOT:                  none
AFFECTS:              enemies, self (movement)
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (90px) — direction resolved away
                      from the densest cluster per the movement ruling
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +100ms knockdown every 3rd rank
--- identity ---
ENGINE:               feeds Tempo normally
COST:                 in co-op this is the worst displacement in the roster,
                      because the Bard's songs project from wherever he is
                      standing. Every Stage Dive is 280px of the party losing
                      its buffs, and the automation has no way to know that
VISUAL:               he goes over the front of an imaginary barrier
                      entirely, arms out, and lands on whoever is there
FLAVOR:               The crowd catches you. That is the arrangement and it
                      has never been written down and it has failed, in his
                      experience, twice.

SKILL NAME:           Harmonic Amplification
CLASS / TREE / TIER:  bard / Battle / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none (arms the next 3 striking hits)
RANGE:                n/a
TARGETS:              self; each armed hit splashes r90
--- output ---
DAMAGE TIER:          none (0) at cast
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               the next 3 damaging hits each splash r90 for full
                      damage to everything in the splash
DOT:                  none
AFFECTS:              self + enemies (deferred)
--- automation ---
TRIGGER:              COOLDOWN_READY when 3+ enemies are within 200px — armed
                      states should not be spent on an empty room
THREAT:               some (delivered by the armed hits)
--- growth ---
RANK ADDS:            +8px splash radius per rank; +1 armed hit every 5th rank
--- identity ---
ENGINE:               feeds Tempo normally, and the three splashes mean three
                      more damage events per cast
COST:                 it does nothing by itself and its value depends
                      entirely on which three skills happen to fire next. In
                      an auto-fire game the player does not choose those
                      three, so Amplification is a slot spent on whatever the
                      machine felt like doing
VISUAL:               a low feedback whine builds and each of the next three
                      impacts blows outward with a visible pressure ring
FLAVOR:               Everything is louder than it needs to be. That has
                      never once been the complaint he intended to address.

SKILL NAME:           Frequency Shield
CLASS / TREE / TIER:  bard / Battle / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
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
RIDERS:               absorb shield 50 for 5000ms
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (140px)
THREAT:               none
--- growth ---
RANK ADDS:            +12 absorb per rank; +400ms duration every 4th rank
--- identity ---
ENGINE:               feeds Tempo normally
COST:                 fifty absorb for five seconds is the smallest and
                      shortest shield in the roster, and it is the Bard's
                      only one. A melee Bard's entire defensive plan is this
                      and a nine-second stun
VISUAL:               a standing wave close to the body, visible only as an
                      interference pattern where it is struck
FLAVOR:               Two sounds that cancel do not become silence. They
                      become a place where the pressure has agreed to stop
                      arriving, which is not the same and is more useful.

SKILL NAME:           Coda
CLASS / TREE / TIER:  bard / Battle / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r120 on caster)
RANGE:                melee long (120px)
TARGETS:              uncapped in area, judged per target
--- output ---
DAMAGE TIER:          medium (24) — 60 against targets below 35% HP
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — finisher: ×2.5 against any target below 35%
                      HP, resolved per target
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (3+ within 120px), preferring clusters
                      where 2+ are below 35%
THREAT:               some
--- growth ---
RANK ADDS:            +4 base damage (the ×2.5 does not scale, so a rank-10
                      Coda finishes for 160)
--- identity ---
ENGINE:               feeds Tempo normally
COST:                 as a plain area hit it is Crystal Pulse without the
                      knockback. The finisher is what makes it a tier-9 node,
                      and against a fresh wave it is just twenty-four damage
VISUAL:               a hard final chord with a visible cutoff — the sound
                      stops dead rather than decaying, and so do the things
                      that were nearly finished
FLAVOR:               The ending is not the last thing that happens. The
                      ending is the thing that makes everything before it
                      have been leading somewhere, and it has to be decided
                      in advance.

> **AUTHORED:** ToH's Coda is a plain 24-damage circle, which makes its name
> meaningless. The export's own note says "judged per target," implying a
> per-target condition that does not exist in the numbers. I gave it the
> finisher — per-target, correctly, unlike Blacksmith's Execute.

SKILL NAME:           War Song
CLASS / TREE / TIER:  bard / Battle / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                chain (cascading, for the duration)
RANGE:                melee long (130px per link)
TARGETS:              cascades from target to target for 8000ms
--- output ---
DAMAGE TIER:          low (14 per strike)
PACE:                 capstone (25000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               for the duration every ally covered by any active song
                      also deals +15% damage — the capstone amplifies the
                      support half of the class rather than replacing it
DOT:                  none
AFFECTS:              enemies + allies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (8+ within 250px), gated on 50 Tempo
THREAT:               high
--- growth ---
RANK ADDS:            +3 damage per strike; +1s duration every 4th rank; +2%
                      to the ally damage bonus every 3rd rank
--- identity ---
ENGINE:               consumes 50 Tempo
COST:                 sixty seconds for fourteen damage a strike, which is
                      the weakest raw capstone number in the roster. Its
                      case is entirely the party bonus, and solo that half
                      applies to one person
VISUAL:               a driving repeated figure, and the strikes land on the
                      beat of it — the damage is visibly rhythmic rather than
                      continuous
FLAVOR:               Every army that ever marched had one and none of them
                      were about winning. They were about the specific
                      problem of getting a large number of frightened people
                      to arrive at the same place at the same time.

---

## TREE: SONIC CHAOS

Role read: **the ranged controller.** Knockbacks, a wall, a confusion, and
the class's only echo passive. It is the tree that lets a Bard fight at
distance, and it is at war with the Songs tree — every knockback pushes
enemies out of the radius his songs are covering.

---

SKILL NAME:           Sonic Blast
CLASS / TREE / TIER:  bard / Sonic Chaos / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                cone (narrow) (52° total)
RANGE:                range medium (260px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 fast (1200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               knockback 120px; knockback-stun 200ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 260px
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +15px knockback every 3rd rank; +3° cone
                      width every 4th rank
--- identity ---
ENGINE:               feeds +8 Tempo at 2600ms
COST:                 fifty-two degrees is the narrowest cone in the game and
                      it reaches 260px, so it is a long thin wedge that will
                      frequently catch one enemy. The knockback is good and
                      it is also pushing that enemy out of song range
VISUAL:               a tight visible pressure wedge; everything in it goes
                      backward at once rather than in sequence
FLAVOR:               Loud is a direction, not a quantity. Most people
                      discover this the first time somebody points a proper
                      rig at them.

SKILL NAME:           Resonance Pulse
CLASS / TREE / TIER:  bard / Sonic Chaos / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r120 on caster)
RANGE:                melee long (120px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (20)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               knockback 140px; knockback-stun 200ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (120px)
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +15px knockback every 3rd rank
--- identity ---
ENGINE:               feeds Tempo normally
COST:                 a hundred and forty pixels of knockback in every
                      direction at once — the most disruptive skill the Bard
                      owns, and it disrupts his own build. Songs, Battle's
                      melee range and Sonic's own Wall of Sound all want
                      enemies close, and this sends them all away
VISUAL:               a single omnidirectional thump at ground level;
                      everything in the circle goes outward evenly
FLAVOR:               Room for the next bit. That is all he ever wants and
                      it is astonishing how rarely anyone gives it to him.

SKILL NAME:           Sonic Echoes
CLASS / TREE / TIER:  bard / Sonic Chaos / tier_code 2
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
DOMAIN:               mental
--- effects ---
RIDERS:               scene-keyed [declared, not derived] — "your attacks
                      leave an ECHO: a delayed second hit at 35% strength."
                      Ruling 3: applies to every damaging skill, 600ms after
                      the original
DOT:                  none
AFFECTS:              self, enemies
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +4% echo strength per rank; −40ms echo delay every 4th
                      rank, floor 300ms
--- identity ---
ENGINE:               neutral directly, but it multiplies every damage skill
                      in every tree without requiring another cast
COST:                 thirty-five percent of everything, six hundred
                      milliseconds late, which means against enemies that
                      die to the first hit the echo lands on a corpse. It is
                      worth the most against durable enemies and least
                      against exactly the swarms this game is made of
VISUAL:               every impact happens twice, the second one fainter and
                      slightly displaced, like a slap-back off a far wall
FLAVOR:               There is always a second one. In a small room you do
                      not notice it. He has spent his career finding out how
                      large the room has to be.

SKILL NAME:           Perfect Pitch
CLASS / TREE / TIER:  bard / Sonic Chaos / tier_code 3
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
RIDERS:               stat mods: damageMult +0.15
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +4% damage multiplier per rank — global, applies to
                      every tree and to the echo
--- identity ---
ENGINE:               neutral
COST:                 the third uncapped global damage multiplier in the
                      roster, after Berserker's Edge and Encapsulation. It is
                      the smallest of the three at rank 1 and scales the same
                      way, and whatever rule you set for those two should
                      apply here
VISUAL:               nothing visible
FLAVOR:               He can name any note he hears and has never been able
                      to explain how, and he stopped being asked about it at
                      roughly the age of eleven.

SKILL NAME:           Sonic Surge
CLASS / TREE / TIER:  bard / Sonic Chaos / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                line (movement path)
RANGE:                range medium (260px)
TARGETS:              each enemy in path once, uncapped
--- output ---
DAMAGE TIER:          low (18)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               knockdown 200ms; leaves a damaging trail zone along the
                      dash path; caster displaced 260px
DOT:                  trail zone along the path
AFFECTS:              enemies, self (movement)
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (90px) — direction resolved away
                      from the densest cluster per the movement ruling
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +20px dash distance every 4th rank; +1s
                      trail duration every 3rd rank
--- identity ---
ENGINE:               feeds Tempo normally
COST:                 it is the only dash in the game that leaves damage
                      behind it, which makes it the only dash where running
                      away is also an attack. It is also 260px of the party
                      losing its songs, same as Stage Dive
VISUAL:               he goes through at speed and the air along the line
                      keeps vibrating visibly afterward
FLAVOR:               The wake is the point. Anyone can arrive somewhere.
                      Leaving a line behind you that is still unpleasant to
                      cross ten seconds later is a craft.

SKILL NAME:           Power Chord
CLASS / TREE / TIER:  bard / Sonic Chaos / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (380px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (34)
PACE:                 fast (1200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 380px
THREAT:               some
--- growth ---
RANK ADDS:            +6 damage; at rank 7 it pierces 1 additional enemy,
                      +1 every 7 ranks thereafter
--- identity ---
ENGINE:               feeds Tempo normally
COST:                 the highest single-target number in the class and the
                      only long-range attack the Bard owns. It is also the
                      only skill in this tree that does not push, slow, or
                      confuse anything, which makes it the odd node in a
                      control tree
VISUAL:               two notes and nothing in between, arriving as one flat
                      slab of sound
FLAVOR:               Two notes. Technically not even a chord. Four hundred
                      years of harmonic theory and the loudest thing anyone
                      ever found was the interval you get for free.

SKILL NAME:           Sonic Distortion
CLASS / TREE / TIER:  bard / Sonic Chaos / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range medium (320px)
TARGETS:              1
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               CONFUSION 4000ms (ruling 4) — the target attacks other
                      enemies and its threat on the player drops to zero
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (100px), preferring the
                      highest-health enemy in range
THREAT:               none — it is a threat *removal*
--- growth ---
RANK ADDS:            +500ms confusion per rank; at rank 8 it confuses a
                      second target within 90px, +1 every 8 ranks
--- identity ---
ENGINE:               feeds Tempo normally
COST:                 zero damage, one target, twelve seconds. It is the only
                      mind-control effect in the roster and it is single
                      target in a swarm game, which means it turns one enemy
                      into a temporary ally in a crowd of thirty. Against a
                      large durable enemy it is the best skill the Bard owns
VISUAL:               the target's movement gets a lag in it and then it
                      turns, deliberately, on whatever is nearest that is not
                      the player
FLAVOR:               He is not telling them anything. He is removing their
                      confidence about which direction the sound came from,
                      and everything after that is their own conclusion.

SKILL NAME:           Wall of Sound
CLASS / TREE / TIER:  bard / Sonic Chaos / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                line (3 hazard cells, r70 each, 110px spacing,
                      perpendicular to the threat)
RANGE:                range short (180px)
TARGETS:              uncapped in the cells (identity skill — breadth is the
                      point)
--- output ---
DAMAGE TIER:          low (8)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               slow ×0.6 inside the cells
DOT:                  cell tick damage for the wall's duration
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (200px) — placed perpendicular to
                      the incoming direction, between the Bard and the swarm
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage; +8px cell radius every 3rd rank; +1 cell
                      every 5th rank
--- identity ---
ENGINE:               feeds Tempo normally
COST:                 three separate circles with 110px spacing, which means
                      the wall has gaps in it wider than the circles are. It
                      is a barrier that anything can walk through if it
                      approaches at the right angle, and the automation
                      cannot guarantee the right angle
VISUAL:               three standing columns of visible pressure, the air
                      between them shimmering but passable
FLAVOR:               It was a joke first. A stack of amplifiers taller than
                      the band, entirely unnecessary, purely to be looked at.
                      Then somebody stood in front of it.

SKILL NAME:           Pentatonic Overload
CLASS / TREE / TIER:  bard / Sonic Chaos / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                multi-target (5-note volley)
RANGE:                range medium (340px)
TARGETS:              5 projectiles, each seeking a separate target where
                      available (port change — see COST)
--- output ---
DAMAGE TIER:          low (8 per note)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               each note that hits an enemy already hit by another
                      note this cast deals double
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (3+ within 340px)
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per note; +1 note every 5th rank
--- identity ---
ENGINE:               feeds Tempo normally
COST:                 forty damage across five targets on a ten-second
                      cooldown at tier 9. Even with the port change it is
                      weak for its position, and its overlap bonus asks for
                      exactly the crowded target the rest of this tree spends
                      its time pushing apart
VISUAL:               five notes released as one gesture, fanning out and
                      then correcting individually
FLAVOR:               Five notes. Every folk tradition on earth found the
                      same five independently and none of them have ever
                      agreed about why.

> **Port change flagged:** ToH's Pentatonic Overload is single-target for 8
> damage on a 10-second cooldown at tier 9 — the worst damage-per-cooldown
> in the roster by a wide margin, and the name says five. I made it a
> five-note volley with an overlap bonus. Even so, consider cutting it.

SKILL NAME:           Chaotic Riff
CLASS / TREE / TIER:  bard / Sonic Chaos / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                chain
RANGE:                range medium (340px)
TARGETS:              chain, 4 jumps
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 capstone (25000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 340px, gated on 40 Tempo
THREAT:               some
--- growth ---
RANK ADDS:            +5 damage; +1 chain jump every 3rd rank
--- identity ---
ENGINE:               consumes 40 Tempo
COST:                 twenty-six damage across five enemies for a
                      forty-five-second cooldown is a modest capstone, and
                      it needs the pack tight enough for four jumps — which
                      Sonic Blast and Resonance Pulse have spent the whole
                      fight preventing. The tree's capstone is undone by the
                      tree's own tier-1 and tier-2 nodes
VISUAL:               a run of notes with no discernible key, each jump
                      landing on a pitch that should not have followed the
                      last one and somehow does
FLAVOR:               He does not know what he is going to play next. He has
                      been asked whether that is frightening and has said
                      that the frightening version is the one where he does.
