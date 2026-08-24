# WITCH DOCTOR — RUMBLEJAM CONVERSION (30 skills)

Mechanical fields carried from the code export unchanged. Eight judgment
fields authored. Class-wide rulings stated once here.


---

## ROSTER RULING APPLIED

**Engine — RULED: Hex (doc).**

**Tree names — built names win.** Voodoo→Effigy, Decay→Blight, Spirits→Swarm


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

**Outstanding:** none.

---

## A NAMING FLAG, FIRST

The class is rooted in Kinshasa and its central tree is called Voodoo. Vodun
is a living religion with millions of practitioners, and *witch doctor* is a
colonial-era pejorative rather than a term any tradition uses for itself.
This is a heavier version of the flag on Savage: that one is a word attached
to largely historical material, this one is a word attached to a practice
people are engaged in today.

I have written the character as a serious professional — a specialist in
obligation, proxy and consequence, not a caricature — and the mechanics are
excellent and worth keeping exactly as they are. The flag is on the naming
layer only, and it is worth deciding deliberately rather than by default.

---

## CLASS ENGINE — HEX

The Savage is paid only for damage he deals with his own hands. The Witch
Doctor is his exact inverse, because that is what all thirty of his skills
actually do: he never touches anything. He works through a doll, a decoy, an
effigy, a totem, a cloud, a curse.

**HEX, 0–100.** Starts each run at 0.

Feeds — **indirect damage only:**
- A mirrored doll hit: **+2**
- Any DoT or hazard tick of his: **+1**
- An enemy killed by anything other than his own direct strike: **+3**
- **+1 per second per standing proxy** (bound doll, decoy, effigy, totem,
  revenant)

Direct melee and direct projectiles generate **nothing.**

Consumes:
- Voodoo Doll **20** · Soul Bind **30** · Pestilence Nova **40**
- Spirit Split **50** · Soul Revenant **50**

Decays **2/sec while no proxy stands.**

He is the only class in the roster whose engine refuses to pay him for
fighting. It rewards setup, patience and intermediaries, and it drops to
zero the moment his board is cleared. He and the Savage are two answers to
the same question and neither can play the other's game at all.

---

## PORT RULINGS

**1. The doll is the class's real system.** Voodoo Doll binds one enemy at
340px. While it holds, **melee strikes covering the doll mirror 60% of their
damage onto the bound target at any range.** Four nodes upgrade it:

| node | upgrade |
|---|---|
| Soulbound Hex | enemies striking the doll take 12 back |
| Shadow Stitch | mirrored damage also hits enemies within 130px of the bound target, at 50% |
| Spirit Assault | bound target takes 6/s bypassing ALL defences while the doll holds |
| Spirit Split | spawns a decoy and re-arms the mirror |

A Witch Doctor running the doll plus all three upgrades spends **four of
eight slots** on one mechanic — which then converts his melee into ranged
area damage. It is the deepest build in the project and the tree tells the
player none of it.

**2. Decoys and the effigy are the tanking layer.** Spirit Projection,
Spectral Echoes and Cursed Effigy spawn magnet bodies that do not attack.
Same treatment as the Wizard's Ice Golem — ranks buy HP, lifespan and magnet
radius, never damage. The effigy is rooted 60px ahead and cannot move.

**3. Soul Bind's redirect is the Monk's mechanic at a larger number.** 35% of
damage the player would take, split evenly across live summons, before block
and shield. Kept as coded.

**4. Soul Harvest's 6 energy** has no referent. Redirected to +3 Hex per
kill, folded into the engine. The 8 HP is kept as written.

**5. `decayDomain` is cosmetic.** Ten Decay defs carry it with zero runtime
reads. Used to inform DOMAIN on those skills and nothing else.

**6. Movement, allies, stealth, confusion, hazards** carry from earlier
classes. Spirit Walk uses the Assassin's flicker ruling.

---

## TREE: EFFIGY  (was Voodoo in the source conversion)

Role read: **the proxy controller.** The doll turns melee into ranged area
damage; the decoys turn enemy attention into somebody else's problem. Almost
nothing here deals damage directly and the tree's ceiling is the highest in
the class.

---

SKILL NAME:           Voodoo Doll
CLASS / TREE / TIER:  witchdoctor / Effigy / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range medium (340px)
TARGETS:              1 bound
--- output ---
DAMAGE TIER:          low (18)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               THE BIND — while it holds, melee strikes covering the
                      doll mirror 60% of their damage onto the bound target
                      at ANY range (ruling 1)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              COOLDOWN_READY, preferring the highest-health enemy
                      within 340px
THREAT:               none
--- growth ---
RANK ADDS:            +3 damage; +4% mirror ratio per rank; +2s bind duration
                      every 4th rank
--- identity ---
ENGINE:               consumes 20 Hex, then feeds +2 per mirrored hit and
                      +1/sec while bound — it repays itself in about six
                      seconds and keeps paying
COST:                 eighteen damage at tier 1, and the mirror does nothing
                      unless he is landing melee strikes he has no melee
                      skills to land. The doll requires a second tree to
                      function and nothing says so
VISUAL:               a small bound figure of cloth and hair; when the mirror
                      fires, a thread of dark light runs from his hand to
                      something on the far side of the room
FLAVOR:               The doll is not the target. It has never been the
                      target. It is a filing reference, and what he does to
                      it is a matter of correct paperwork rather than malice.

SKILL NAME:           Spirit Projection
CLASS / TREE / TIER:  witchdoctor / Effigy / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns adjacent)
TARGETS:              n/a — 1 spirit decoy
--- output ---
DAMAGE TIER:          none (0) — it never attacks
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               magnet aggro decoy; counts as a live summon for Soul
                      Bind's redirect (ruling 2)
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on the decoy being absent
THREAT:               high (delegated)
--- growth ---
RANK ADDS:            +20% decoy HP per rank; +15px magnet radius every 3rd
                      rank (never damage)
--- identity ---
ENGINE:               feeds +1/sec while it stands, and every hit it absorbs
                      is a hit that did not interrupt him
COST:                 it deals nothing and it dies. Fourteen seconds for a
                      body that exists to be attacked, on a class with no way
                      to heal it except Blood Pact two trees over at the cost
                      of his own health
VISUAL:               a translucent second figure that does not quite match
                      his posture and never turns to look at anything
FLAVOR:               It is not a copy of him. It is the part of the
                      transaction that stands where the transaction is
                      happening, which is not a place he intends to be.

SKILL NAME:           Cursed Vision
CLASS / TREE / TIER:  witchdoctor / Effigy / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range medium (320px)
TARGETS:              1
--- output ---
DAMAGE TIER:          none (0) — chip 8 per 600ms at its nearest fellow
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               CONFUSION 80% for 4000ms — the longest confusion in the
                      roster. Target attacks its nearest fellow; threat on
                      the player drops to zero
DOT:                  8 per 600ms for the confusion's duration
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (140px), preferring the
                      highest-health enemy in range
THREAT:               none — a threat removal
--- growth ---
RANK ADDS:            +2 chip damage per tick; +400ms confusion per rank; at
                      rank 8 it confuses a second enemy within 100px
--- identity ---
ENGINE:               feeds — chip from a confused enemy is indirect by
                      definition, and kills it makes are +3 each
COST:                 zero direct damage, one target, twelve seconds. Four
                      seconds is the best confusion window in the game and it
                      still removes exactly one enemy from a swarm of thirty
VISUAL:               the target's head turns fractionally too far and then it
                      commits, without hesitation, to the wrong thing
FLAVOR:               He does not show it anything that is not there. He
                      declines to continue helping it sort what is.

SKILL NAME:           Spirit Shackles
CLASS / TREE / TIER:  witchdoctor / Effigy / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target (nearest)
RANGE:                range medium (300px)
TARGETS:              1
--- output ---
DAMAGE TIER:          low (18)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               drain — heals the Witch Doctor 60% of damage dealt
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (65%), falling back to
                      NEAREST_IN_RANGE at full health
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage (the 60% ratio does not scale, so the heal
                      grows with it)
--- identity ---
ENGINE:               does NOT feed — a direct hit, and direct hits pay this
                      class nothing. Every cast is a moment Hex decays
COST:                 eleven health back on a ten-second cooldown, and the
                      name promises a shackle the code does not deliver. A
                      small heal wearing a control skill's title, working
                      against the engine
VISUAL:               loops of grey light close around the target and then
                      draw back toward him carrying something
FLAVOR:               Shackles are for keeping a thing where it is. He has
                      never needed that. What he needs is a route by which
                      something can travel back along the same line.

SKILL NAME:           Soulbound Hex
CLASS / TREE / TIER:  witchdoctor / Effigy / tier_code 4
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
RIDERS:               scene-keyed [declared, not derived] — "passive doll
                      upgrade: the hex bites back — enemies that strike your
                      doll take 12 damage in return"
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              always-on, CONDITIONAL on a doll being bound
THREAT:               none
--- growth ---
RANK ADDS:            +3 return damage per rank
--- identity ---
ENGINE:               feeds — return damage is indirect, +2 an event, and its
                      kills are +3
COST:                 worthless without Voodoo Doll slotted, and it is the
                      first of four doll upgrades. Taking it is committing to
                      a build that consumes half the loadout before it
                      produces anything the player can see
VISUAL:               the doll flinches when the bound target is struck, and
                      something goes back the other way
FLAVOR:               A binding runs in both directions. Everyone who has
                      asked him for one has been told this and none of them
                      have listened to the second half.

SKILL NAME:           Shadow Stitch
CLASS / TREE / TIER:  witchdoctor / Effigy / tier_code 5
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               scene-keyed [declared, not derived] — "passive doll
                      upgrade: the threads spread — mirrored damage also tears
                      into enemies near the bound target (50% in a 130px
                      weave)"
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              always-on, CONDITIONAL on a doll being bound
THREAT:               none
--- growth ---
RANK ADDS:            +4% spread ratio and +8px weave radius per rank
--- identity ---
ENGINE:               feeds heavily — it turns the mirror from one indirect
                      event per strike into four or five, making it the
                      largest Hex generator in the class
COST:                 the third slot in a four-slot mechanic, and the point at
                      which the doll build stops being a curiosity and starts
                      out-damaging everything else the class can do. Getting
                      there costs most of the loadout
VISUAL:               the thread from his hand does not end at the bound
                      target — it continues, thinner, to everything near it
FLAVOR:               Cloth is threads. A person is threads. He has stopped
                      distinguishing and finds that the work goes faster.

> **This is the class.** Voodoo Doll plus Shadow Stitch converts every melee
> strike into ranged area damage across a pack he is nowhere near. It is the
> most interesting mechanic in the project and a player will never find it,
> because the two nodes are five tiers apart and neither description
> mentions the other.

SKILL NAME:           Spectral Echoes
CLASS / TREE / TIER:  witchdoctor / Effigy / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns in a loose ring)
TARGETS:              n/a — several mini-decoy illusions, timed
--- output ---
DAMAGE TIER:          none (0) — they never attack
PACE:                 very slow (8000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               low-HP magnet decoys that expire; each counts as a live
                      summon for Soul Bind's redirect
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              CROWD_THRESHOLD (6+ within 250px)
THREAT:               high (delegated across several bodies)
--- growth ---
RANK ADDS:            +15% illusion HP per rank; +1 illusion every 5th rank;
                      +2s lifespan every 4th rank
--- identity ---
ENGINE:               feeds +1/sec each — four illusions standing is +4/sec,
                      the fastest passive Hex income in the class
COST:                 they are made of nothing and die to incidental damage.
                      Sixteen seconds for bodies that last as long as the
                      swarm takes to swing through them, and their real
                      function is spreading Soul Bind's redirect thinner
VISUAL:               several partial figures, none complete, all standing in
                      postures he is not currently in
FLAVOR:               Not illusions. He is firm about that. They are moments
                      of him that have not finished happening and have been
                      asked to wait somewhere useful.

SKILL NAME:           Soul Harvest
CLASS / TREE / TIER:  witchdoctor / Effigy / tier_code 7
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               scene-keyed [declared, not derived] — "fallen enemies'
                      essence flows to you: 8 HP and 6 energy with every
                      kill." The 6 energy has no referent and is redirected
                      to +3 Hex (ruling 4)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              ON_KILL
THREAT:               none
--- growth ---
RANK ADDS:            +2 HP and +1 Hex per kill per rank
--- identity ---
ENGINE:               feeds — this node is where the kill component of the Hex
                      engine came from
COST:                 eight health per kill is excellent in a swarm and
                      nothing against a single large enemy, which is the exact
                      fight the doll build is best at. The class's sustain and
                      its best mechanic want opposite encounters
VISUAL:               a brief thread from each dying enemy, arriving before
                      the body has finished falling
FLAVOR:               Nothing is taken from them. They have finished with it.
                      He is simply the only person present who has thought
                      about what happens to it next.

SKILL NAME:           Spirit Assault
CLASS / TREE / TIER:  witchdoctor / Effigy / tier_code 8
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               scene-keyed [declared, not derived] — "passive doll
                      upgrade: your spirit worries at the binding — the bound
                      target takes 6 damage every 1s, BYPASSING all defences,
                      while the doll holds"
DOT:                  6 per 1000ms, unmitigable, for the bind's duration
AFFECTS:              enemies
--- automation ---
TRIGGER:              always-on, CONDITIONAL on a doll being bound
THREAT:               none
--- growth ---
RANK ADDS:            +2 unmitigable damage per tick per rank
--- identity ---
ENGINE:               feeds +1 per tick — a continuous hands-free drip that
                      runs while he does nothing at all
COST:                 the fourth doll slot. Six damage a second is small and
                      it ignores armour entirely, making it the class's only
                      answer to a heavily mitigated enemy — and it works only
                      on the one thing currently bound
VISUAL:               the doll is never quite still; something works at it
                      continuously and the bound target keeps flinching at
                      nothing
FLAVOR:               He is not doing this part. He set it going some while
                      ago and it has continued without supervision, which is
                      the whole point of an arrangement of this kind.

SKILL NAME:           Spirit Split
CLASS / TREE / TIER:  witchdoctor / Effigy / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none (timed composite state)
RANGE:                n/a
TARGETS:              spawns a decoy AND re-arms the doll mirror
--- output ---
DAMAGE TIER:          low (12)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               composite — a fresh decoy plus a re-armed mirror at full
                      strength, regardless of the doll's remaining bind time
DOT:                  none
AFFECTS:              own summons + enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (7+ within 300px), gated on 50 Hex and
                      on a doll being bound
THREAT:               high (delegated to the decoy)
--- growth ---
RANK ADDS:            +3 damage; +20% decoy HP per rank; +5% mirror ratio
                      every 3rd rank
--- identity ---
ENGINE:               consumes 50 Hex and then floods it — a re-armed mirror
                      with Shadow Stitch running is several +2 events per
                      strike, plus +1/sec from the decoy
COST:                 twelve damage at tier 10 is the smallest capstone number
                      in the roster, and it does nothing without the doll
                      already bound. A capstone requiring four other nodes
                      first — the deepest build in the game or a trap,
                      depending on whether the player understood the tree
VISUAL:               he comes apart along a seam that was not visible, and
                      the part that leaves goes and stands somewhere else
FLAVOR:               Splitting is the wrong word. Nothing is divided.
                      Something that had been in one place is now in two, at
                      full strength in both, and he has stopped explaining how
                      because the explanation upsets people.

---

## TREE: BLIGHT  (was Decay in the source conversion)

Role read: **the damage tree.** Poisons, clouds, an armour form and a
spreading capstone. Where the Witch Doctor goes when the doll build is too
slow, and its hazards are what keep Hex ticking while he runs.

---

SKILL NAME:           Blow Dart
CLASS / TREE / TIER:  witchdoctor / Blight / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (340px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (14)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (340px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; at rank 5 it applies a 4-per-second poison
                      for 4s, +1 per tick every 4 ranks thereafter
--- identity ---
ENGINE:               does NOT feed at rank 1 — a direct projectile pays
                      nothing. From rank 5 the poison ticks pay, so ranking it
                      changes what it is rather than just how big it is
COST:                 fourteen damage and the tree's only fast cycle, and it
                      works against the engine until rank 5. A Witch Doctor
                      leading with Blow Dart never leaves zero Hex
VISUAL:               a short quiet exhale and something very small arriving
                      somewhere far away
FLAVOR:               No sound worth the name. That has always been the
                      argument for it and the argument has never had to be
                      updated.

SKILL NAME:           Venomous Infusion
CLASS / TREE / TIER:  witchdoctor / Blight / tier_code 1
TYPE:                 buff
AXIS POSITION:        2 (of 10)
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
RIDERS:               timed 10000ms — damageMult +0.20
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 300px)
THREAT:               none
--- growth ---
RANK ADDS:            +4% damage multiplier per rank; +500ms duration every
                      4th rank
--- identity ---
ENGINE:               neutral, but it multiplies mirrored damage as well as
                      direct — the doll build gets full value at range
COST:                 ten seconds in sixteen is better uptime than most buffs
                      in the roster, and it is still a slot spent on a
                      multiplier rather than on a thing that happens
VISUAL:               the veins darken at the forearms and everything he casts
                      picks up a greener cast
FLAVOR:               He has been building a tolerance since he was eleven.
                      This is not the same as being immune and he has been
                      careful never to let anyone assume otherwise.

SKILL NAME:           Poison Mastery
CLASS / TREE / TIER:  witchdoctor / Blight / tier_code 2
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
COST:                 the seventh uncapped global damage multiplier in the
                      roster, and the name says poison while the stat says
                      everything. If one node in this class should be narrowed
                      to its own tree it is this one — a Poison Mastery that
                      only improved poisons would be a real choice instead of
                      a default
VISUAL:               nothing visible
FLAVOR:               Mastery is knowing the doses. Everyone can obtain the
                      substances; the doses are four hundred years of somebody
                      writing things down.

SKILL NAME:           Plague Cloud
CLASS / TREE / TIER:  witchdoctor / Blight / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r130, persistent hazard 5000ms)
RANGE:                range short (200px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 6 per 500ms tick
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               weaken 20% to everything inside
DOT:                  ground tick 6 per 500ms for 5000ms — 60 to anything that
                      stays
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 200px
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per tick; +1s duration every 4th rank; +8px
                      radius every 3rd rank
--- identity ---
ENGINE:               feeds +1 per tick per enemy — a cloud sitting on four
                      enemies for five seconds is forty Hex events. Hazards
                      are the engine's bread and butter
COST:                 anchored where he placed it, and he will not be there.
                      Sixty damage per enemy assumes they stand in it the full
                      five seconds, which nothing chasing him will do
VISUAL:               a low green-grey haze with visible motion inside it,
                      settling rather than dispersing
FLAVOR:               Not a disease. Diseases have intentions of their own and
                      he does not trust anything with intentions of its own.

SKILL NAME:           Life Drain
CLASS / TREE / TIER:  witchdoctor / Blight / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target (nearest)
RANGE:                range medium (300px)
TARGETS:              1
--- output ---
DAMAGE TIER:          medium (20)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               drain — heals 70% of damage dealt, the highest drain
                      ratio in the roster
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (65%), falling back to
                      NEAREST_IN_RANGE at full health
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage (the 70% ratio does not scale)
--- identity ---
ENGINE:               does NOT feed — a direct hit
COST:                 fourteen health back on an eight-second cooldown is the
                      best healing the class has, and it is still small. It is
                      also strictly better than Spirit Shackles, four tiers
                      earlier in another tree, doing the same job
VISUAL:               a thick dark line between them that thins as it works;
                      the target loses colour before it loses health
FLAVOR:               Seventy percent. He has measured, repeatedly, and the
                      remaining thirty goes somewhere he has decided not to
                      pursue.

SKILL NAME:           Hallucinogenic Brew
CLASS / TREE / TIER:  witchdoctor / Blight / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range medium (300px)
TARGETS:              1
--- output ---
DAMAGE TIER:          none (0) — chip 8 per 600ms
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               CONFUSION 80% for 3200ms
DOT:                  8 per 600ms for the confusion's duration
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (120px), preferring the
                      highest-health enemy
THREAT:               none — a threat removal
--- growth ---
RANK ADDS:            +2 chip damage per tick; +400ms confusion per rank
--- identity ---
ENGINE:               feeds — confused-enemy chip damage is indirect
COST:                 it is Cursed Vision with 800ms less duration and a
                      two-second shorter cooldown, in a different tree.
                      Running both is two slots on one effect and the overlap
                      is nearly total
VISUAL:               a thrown vial that breaks low; the target's movements
                      acquire a delay that never resolves
FLAVOR:               The recipe is not secret. It is written down in three
                      places he knows of. What is difficult is the quantity,
                      and the quantity is the entire craft.

SKILL NAME:           Miasma Armor
CLASS / TREE / TIER:  witchdoctor / Blight / tier_code 6
TYPE:                 transformation
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none (aura while active — circle r110 on caster)
RANGE:                n/a
TARGETS:              aura: uncapped in r110
--- output ---
DAMAGE TIER:          low (6 per 500ms aura pulse)
PACE:                 very slow (8000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               form 9000ms — damageReduction +0.20; aura 6 damage /
                      r110 / 500ms pulse
DOT:                  none
AFFECTS:              self + enemies (aura)
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 150px)
THREAT:               some — the aura damages continuously
--- growth ---
RANK ADDS:            +2 aura damage per rank; +10px aura radius every 2nd
                      rank; +500ms duration every 4th rank
--- identity ---
ENGINE:               feeds +1 per pulse per enemy — nine seconds of pulsing
                      twice a second across three enemies is over fifty Hex
                      events, the largest single burst of income in the class
COST:                 twenty percent mitigation is the only damage reduction
                      the Witch Doctor owns anywhere in thirty skills, and it
                      is up nine seconds in every eighteen. Half the time he
                      has no defensive stat at all
VISUAL:               a close cloud clinging to him rather than spreading,
                      thick enough to obscure the outline
FLAVOR:               Bad air. The oldest theory of disease, entirely wrong
                      and, handled correctly, entirely sufficient.

SKILL NAME:           Venom Flask
CLASS / TREE / TIER:  witchdoctor / Blight / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (320px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (16)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — shatters on impact into a 90px pool lasting
                      4000ms, 5 damage per 500ms to anything standing in it
DOT:                  5 per 500ms for 4000ms in the pool
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 320px
THREAT:               none
--- growth ---
RANK ADDS:            +3 impact damage; +1 pool damage per tick every 2nd
                      rank; +8px pool radius every 3rd rank
--- identity ---
ENGINE:               feeds via the pool ticks — with the authored rider it
                      becomes a Hex generator; without it, it paid nothing
COST:                 sixteen impact damage on a nine-second cooldown at tier
                      8 was the worst node in the class before the pool. Even
                      now it is Plague Cloud at half strength, five tiers later
VISUAL:               a thrown flask that breaks wide and low; the liquid
                      keeps moving after it lands
FLAVOR:               He does not throw them if he can help it. Glass is
                      expensive in Kinshasa and the contents took a fortnight.

> **AUTHORED:** ToH's Venom Flask is a plain 16-damage single-target
> projectile with no rider — a flask that does not spill. Added the pool.

SKILL NAME:           Corrosive Eruption
CLASS / TREE / TIER:  witchdoctor / Blight / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (circle r120 at 180px)
RANGE:                range short (180px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               weaken 35% for 5000ms — the largest weaken magnitude in
                      the roster
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 180px
THREAT:               none
--- growth ---
RANK ADDS:            +5 damage; +2% weaken every 2nd rank; +8px radius every
                      3rd rank
--- identity ---
ENGINE:               feeds only on kills it makes — the impact is
                      direct-adjacent and pays nothing, which is a fine
                      distinction the engine has to draw somewhere
COST:                 the highest instant damage in the tree, placed at range,
                      resolving once where the cluster was. A thirty-five
                      percent weaken on a pack is enormous mitigation and it
                      is entirely invisible
VISUAL:               the floor gives out in a circle and comes back up wrong;
                      whatever was standing there is visibly thinner afterward
FLAVOR:               Corrosion is not fast. That is the ordinary case. He has
                      found a way to ask for the whole of it at once and settle
                      up later.

SKILL NAME:           Pestilence Nova
CLASS / TREE / TIER:  witchdoctor / Blight / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (r180 seed; spreads within r200, +10 more)
RANGE:                range short (180px)
TARGETS:              seeds uncapped in r180, then spreads to 10 further
                      enemies
--- output ---
DAMAGE TIER:          low (7 per tick)
PACE:                 capstone (25000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               spreading — each infected enemy passes the DoT to a new
                      one within 200px
DOT:                  7 per 500ms for 5000ms per infected enemy
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (8+ within 250px), gated on 40 Hex
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per tick; +2 additional spread targets every
                      4th rank; +1s duration every 4th rank
--- identity ---
ENGINE:               consumes 40 Hex, then returns it many times over — every
                      tick on every infected enemy is +1, and at full spread
                      that is upward of twenty events a second. The single
                      largest Hex event in the game
COST:                 fifty seconds, and it needs a dense long-lived crowd to
                      reach full spread. Against eight enemies that die in
                      three seconds it is a cough. The most
                      encounter-dependent capstone in the roster
VISUAL:               nothing at the cast, then a widening pattern of enemies
                      that have started to fail, and the pattern has an
                      obvious direction to it
FLAVOR:               He is not spreading anything. He set one condition in one
                      place and the rest of it is a property of them standing
                      too near each other, which was their decision.

---

## TREE: SWARM  (was Spirits in the source conversion)

Role read: **the support and mitigation tree.** A heal totem, a party hazard,
the damage redirect, an effigy, a stealth and a permanent ally. The only tree
that touches other people and the only one that keeps him standing while the
other two set up.

---

SKILL NAME:           Spirit Swarm
CLASS / TREE / TIER:  witchdoctor / Swarm / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r130, persistent hazard 4500ms)
RANGE:                range short (200px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 7 per 500ms tick
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               slow ×0.65 to everything inside
DOT:                  ground tick 7 per 500ms for 4500ms — 63 to anything that
                      stays
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 200px
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per tick; +1s duration every 4th rank; +8px
                      radius every 3rd rank
--- identity ---
ENGINE:               feeds heavily — a 2800ms cooldown on a 4500ms hazard
                      means two overlapping swarms running permanently, and
                      every tick on every enemy is +1. This is the class's
                      engine floor and it is a tier-1 node
COST:                 zero direct damage and it is anchored. It is also the
                      best skill in the class for the first thirty seconds of
                      a run and will still be slotted at the end of one — the
                      same design smell as the Bard's tier-1
VISUAL:               a low churn of small indistinct shapes that do not
                      resolve if you look at them directly
FLAVOR:               They were here before he arrived. He has not summoned
                      anything. He has made the case that this particular patch
                      of floor is interesting.

SKILL NAME:           Ancestral Guidance
CLASS / TREE / TIER:  witchdoctor / Swarm / tier_code 1
TYPE:                 buff
AXIS POSITION:        2 (of 10)
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
RIDERS:               timed 9000ms — damageMult +0.15, attackSpeedMult +0.15
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 300px)
THREAT:               none
--- growth ---
RANK ADDS:            +3% damage and +3% attack speed per rank; +400ms
                      duration every 4th rank
--- identity ---
ENGINE:               neutral, though the attack speed accelerates hazard
                      re-placement, which is Hex income
COST:                 it is Venomous Infusion with a smaller damage number and
                      an attack speed rider, one tier apart in a different
                      tree. Two nearly identical low-tier self-buffs and the
                      tree does not indicate that
VISUAL:               a faint doubling at the edges of him, as though several
                      people are standing in almost the same place
FLAVOR:               Advice, mostly. Not all of it good, not all of it
                      relevant, and none of it possible to ignore.

SKILL NAME:           Healing Totem
CLASS / TREE / TIER:  witchdoctor / Swarm / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r130 at caster, persistent 12000ms)
RANGE:                melee long (130px)
TARGETS:              every ally and summon in the field
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  heals 4 per 800ms for 12000ms — 60 per friendly who
                      stays in it
AFFECTS:              allies + own summons
--- automation ---
TRIGGER:              COOLDOWN_READY when 2+ friendlies are below 75% within
                      130px
THREAT:               none
--- growth ---
RANK ADDS:            +1 heal per tick per rank; +2s duration every 4th rank;
                      +8px radius every 3rd rank
--- identity ---
ENGINE:               feeds +1/sec as a standing proxy — the only healing
                      skill in the roster that generates its caster's resource
                      just by existing
COST:                 anchored, and it heals his decoys, which are made of
                      nothing and were going to die anyway. Solo, most of its
                      output goes into bodies whose purpose is to be destroyed
VISUAL:               a short carved post; the ground around it is noticeably
                      less unpleasant than the ground beyond it
FLAVOR:               The wood is not doing anything. He would like that
                      understood before anyone starts carving their own.

SKILL NAME:           Hexing Ritual
CLASS / TREE / TIER:  witchdoctor / Swarm / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r160, persistent field 5000ms)
RANGE:                range short (200px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0) — the tick is 0 damage, purely a re-apply
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               slow ×0.6 and weaken 25% to everything inside
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 200px)
THREAT:               none
--- growth ---
RANK ADDS:            +1s duration and +8px radius per rank; +2% weaken every
                      3rd rank (not damage — it deals none at any rank)
--- identity ---
ENGINE:               feeds +1/sec as a standing proxy, but its zero-damage
                      ticks generate nothing else. The weakest Hex source in a
                      tree full of them
COST:                 zero damage on a fourteen-second cooldown for a
                      five-second field. Both effects are strong and neither is
                      visible, and it sits between a totem and a hazard that
                      both do more
VISUAL:               a ring marked out on the floor in something pale;
                      everything inside it is slower and less certain
FLAVOR:               A ritual is a procedure with steps in a fixed order and
                      no room for improvisation. That is not mysticism. That is
                      why it works and why it is boring to watch.

SKILL NAME:           Blood Pact
CLASS / TREE / TIER:  witchdoctor / Swarm / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              every live summon
--- output ---
DAMAGE TIER:          none (0)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               heals every live summon +30 HP; COSTS the Witch Doctor
                      15 HP, bypassing shields. Refused at ≤15 HP in code; the
                      Priest's 35% floor applies
DOT:                  none
AFFECTS:              self + own summons
--- automation ---
TRIGGER:              ALLY_HP_BELOW_X (55%) with 2+ summons hurt
THREAT:               none
--- growth ---
RANK ADDS:            +8 heal per summon per rank. The 15 HP cost does not
                      scale
--- identity ---
ENGINE:               feeds indirectly — summons kept alive are proxies kept
                      standing, and each is +1/sec
COST:                 fifteen of his own to repair bodies that exist to be
                      destroyed. Only a good trade in a build running three or
                      more decoys, and in that build it is the difference
                      between a board that holds and one that collapses at once
VISUAL:               he opens his hand over the palm and the light goes out
                      from him in several directions at the same moment
FLAVOR:               A pact is not a gift. Both sides are named in it and both
                      sides can be called on, and he has never once been the
                      party who forgot that.

SKILL NAME:           Spirit Walk
CLASS / TREE / TIER:  witchdoctor / Swarm / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
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
RIDERS:               stealth 5000ms, flickering per the Assassin's ruling
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (40%)
THREAT:               none — a threat dump
--- growth ---
RANK ADDS:            +400ms stealth per rank; −150ms re-entry delay every 4th
                      rank
--- identity ---
ENGINE:               neutral, though his hazards keep ticking while he is
                      unfindable, so Hex continues to accumulate through the
                      window
COST:                 five seconds of intermittent concealment with no damage
                      bonus attached. It buys distance and does not heal him,
                      and this class has no burst heal to follow it with
VISUAL:               he becomes difficult to attend to; the enemies' heads
                      track past and settle on the nearest decoy
FLAVOR:               He has not gone anywhere. He is standing exactly where he
                      was. The difficulty is on their side and he has never felt
                      obliged to solve it.

SKILL NAME:           Soul Bind
CLASS / TREE / TIER:  witchdoctor / Swarm / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                none
RANGE:                n/a
TARGETS:              self + all live summons
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               35% of damage the Witch Doctor would take is redirected
                      onto live summons, split evenly, subtracted BEFORE block,
                      shield and HP (ruling 3)
DOT:                  none
AFFECTS:              allies + self
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on at least 2 summons standing
THREAT:               none — the redirect is not aggro; enemies keep attacking
                      him and the damage arrives elsewhere
--- growth ---
RANK ADDS:            +2% redirect per rank, ceiling 65%
--- identity ---
ENGINE:               consumes 30 Hex
COST:                 it is mitigation that consumes his own proxies, and
                      proxies are his engine. Every point Soul Bind moves off
                      him shortens the life of a decoy generating +1/sec. **The
                      class's best defensive skill eats the class's income** —
                      the sharpest internal tension in the roster, left in
                      deliberately
VISUAL:               threads from him to every standing body he owns; hits on
                      him flash outward along all of them at once
FLAVOR:               Shared is not the word. Nothing is shared. It is moved,
                      entire, along a route he laid down in advance, onto
                      something that was made for the purpose.

SKILL NAME:           Cursed Effigy
CLASS / TREE / TIER:  witchdoctor / Swarm / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                melee short (planted 60px ahead)
TARGETS:              n/a — 1 rooted magnet effigy
--- output ---
DAMAGE TIER:          none (0) — it never attacks and never moves
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               magnet aggro; ROOTED in place, cannot follow; counts as a
                      live summon for Soul Bind
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (200px) — planted between him and the
                      incoming direction
THREAT:               high (delegated)
--- growth ---
RANK ADDS:            +25% effigy HP per rank; +20px magnet radius every 3rd
                      rank (never damage)
--- identity ---
ENGINE:               feeds +1/sec while it stands
COST:                 planted sixty pixels ahead of him and it never moves. Of
                      the three decoy skills it is the toughest and the least
                      useful, because he will be two hundred pixels away within
                      four seconds and the effigy will still be holding a piece
                      of floor he has abandoned
VISUAL:               a squat figure of bound sticks and cloth driven into the
                      ground; enemies pile against it and it does not
                      acknowledge them
FLAVOR:               It is not guarding anything. It is standing where the
                      attention is supposed to go, which is a job, and it has
                      never once left early.

SKILL NAME:           Tribal Ritual
CLASS / TREE / TIER:  witchdoctor / Swarm / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r150 at caster, persistent 6000ms)
RANGE:                range short (150px)
TARGETS:              allies and summons in the field; weakens enemies in it
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               weaken 20% to enemies inside
DOT:                  heals 5 per 500ms for 6000ms to allies and summons — 60
                      per friendly, the fastest healing delivery in the class
AFFECTS:              allies + own summons
--- automation ---
TRIGGER:              ALLY_HP_BELOW_X (60%) with 2+ friendlies in radius
THREAT:               none
--- growth ---
RANK ADDS:            +1.5 heal per tick per rank; +1s duration every 4th rank;
                      +8px radius every 3rd rank
--- identity ---
ENGINE:               feeds +1/sec as a standing proxy
COST:                 it heals and weakens in the same 150px circle, so it
                      wants his allies and his enemies in the same place — and
                      in solo it wants his decoys standing in it, which they
                      will, because they are rooted and so is this
VISUAL:               a marked area with several small fires at the edge; the
                      light inside it is a different colour from the light
                      outside
FLAVOR:               It takes four people to do this properly and he has done
                      it alone for eleven years. It works either way. It works
                      better the other way and there is nothing to be done
                      about that.

SKILL NAME:           Soul Revenant
CLASS / TREE / TIER:  witchdoctor / Swarm / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns adjacent)
TARGETS:              n/a — 1 revenant ally
--- output ---
DAMAGE TIER:          none (0) — the revenant deals the damage
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               unlike every other body this class summons, the revenant
                      ATTACKS. Persists until killed
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on the revenant being dead or
                      unspawned and on 50 Hex
THREAT:               high (delegated)
--- growth ---
RANK ADDS:            +15% revenant damage and HP per rank
--- identity ---
ENGINE:               consumes 50 Hex, then feeds +1/sec as a proxy and +3 for
                      every kill it makes — a revenant's kills are indirect by
                      definition, so it is the only summon in the class that
                      pays twice
COST:                 fifty-five seconds and fifty Hex, and it is the only
                      thing the Witch Doctor owns that fights. Everything else
                      in thirty skills is a curse, a cloud, a decoy or a totem.
                      Losing it means waiting most of a minute with no offence
                      except poison
VISUAL:               it comes up whole rather than assembling, and it is the
                      only figure he summons that looks at him before it goes
FLAVOR:               He knew this one. That is the difference and it is the
                      entire difference, and it is why this one is the only one
                      that fights and the only one he does not spend carelessly.
