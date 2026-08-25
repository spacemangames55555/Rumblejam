# DRUID — RUMBLEJAM CONVERSION (30 skills)

Mechanical fields carried from the code export unchanged. Eight judgment
fields authored. Class-wide rulings stated once here.


---

## ROSTER RULING APPLIED

**Engine — RULED: Kinship (doc).**

**Tree names — RULED: this document's names are KEPT.** The standing rule is
"built names win unless the doc's is clearly better", and here the built name is
not merely worse — it is wrong. **The built names are crossed against their own contents.** The built `Wild Kin` tree has NO summons; the built `Tapestry of Beasts` has three. This document is the opposite way round. Logged separately as a code defect — see KNOWN-DEFECTS #20.

**Tree contents — the document wins**, per the standing rule. Applied without
further asking; divergences from the built tree are what this file already
describes.

**Pace (ruling 1).** Every timed active rebucketed to the fixed values, then
brought into the bucket-mix rule — at least **3** nodes fast-or-better per tree,
at most 1 very fast, at most 2 very slow. All three trees comply.

**Rate: 7.50/sec on a spread build — IN BAND.**

**Ruling 6 (rider duration under cooldown) — APPLIED.** 5 rider durations cut across 5 skills, each to ~70% of its skill's new cooldown and each annotated inline with what it
was. Nothing fell under the 500ms floor, so no rider was deleted outright.

**Exempt:** Lava Pocket held — its `RIDERS` line restates the burn DoT already in `DOT:`, so the two fields are one statement and not two. Cutting one copy and leaving the other would make the block contradict itself; a stacking DoT is rationed by its stack ceiling rather than by the clock.

**Outstanding:** none.

---

## CLASS ENGINE — KINSHIP

The Blacksmith's engine spikes when he is losing. The Priest's fills on
suffering. The Druid's is different in kind: it is not fed by events at all,
it is fed by **presence**. He does not own power; he is lent it, and the
loan is only good while something wild is standing next to him.

**KINSHIP, 0–100.** Starts each run at 0.

Feeds:
- **+1 per second for each living Wild Kin summon** (five out = +5/sec)
- Landing any Tapestry beast skill: **+6**
- Healing delivered, to anyone: **+1 per 10 HP**

Consumes:
- Viper **10** · Wolverine **15** · Scavengers **20** · Chimpanzee Pair
  **25** · Polar Bear **40**
- Elephant's Rage **30** · both Essential Oils **50**

Decay: **none while any summon is alive. 2/sec when he has nothing out.**

That decay rule is the class in one line. A Druid with animals around him
accumulates indefinitely; a Druid alone bleeds out his own Kinship and
cannot afford to call anything back. It makes the opening of a run the
hardest part — he must spend from nearly nothing to get the first Viper
standing — and it means losing his whole menagerie at once is a spiral, not
a setback.

---

## PORT RULINGS

**1. Wild Kin summons persist until killed and re-fire under cap.** Caps:
Viper 2, Wolverine 1, Chimpanzee Pair 1 (spawns 2 bodies), Polar Bear 1,
Scavengers 4 (timed, untargetable — see ruling 3). Ranks buy summon stats,
not caster damage. Same model as Necromancer.

**2. Druid has no auras.** I said two sessions ago that auras were
load-bearing for this class; the derived registry says zero. Tombstoned.
Druid's field presence comes from *hazards* — Queen Bee's Swarm, Sage Burn,
Healing Spores — which is a different thing: placed, expiring, and left
behind when he moves.

**3. Scavengers are untargetable chip units.** The export is specific: they
spawn untargetable and timed. Ruling: they cannot be killed, cannot hold
aggro, and deal small continuous damage for their lifetime. They are the
only summon in the game that is pure output with no body, which makes them
the correct Kinship investment for a Druid who keeps losing his real pets.

**4. The two Essential Oils are empty in code and I have authored them.**
Both are 60-second cooldowns on the non-damaging list with no rider, no
heal, no buff, no stat mod — genuinely nothing derived. Tier 9 and tier 10
of the Restoration tree are, as shipped, two skills that do nothing. I have
written effects from their names. This is the largest invention in the class
and it is flagged on both blocks.

**5. Stealth is a defensive skill here, not an opener.** Snow Leopard's
Stealth drops all enemy targeting for 3s. In ToH that set up a burst; in
RumbleJam, where the player's only job is not being touched, three seconds
of being unfindable is simply a survival cooldown, and I've triggered it
accordingly.

**6. Channels, movement, and ally order** all carry from earlier classes:
movement skills resolve away from the densest cluster, and ally-affecting
skills resolve real players → own summons → self.

---

## TREE: TAPESTRY OF BEASTS

Role read: **the bruiser-flex.** He borrows one creature at a time — mantis
speed, bear weight, falcon dive, lion resilience — and every borrowing is a
short window. Nothing here is permanent, nothing here summons, and the tree
is the closest the Druid gets to being a melee class in his own right.

---

SKILL NAME:           Praying Mantis Precision
CLASS / TREE / TIER:  druid / Tapestry of Beasts / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r64)
RANGE:                melee short (64px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          low (10 × 3 pulses = 30)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               3 pulses 130ms apart, each rolling its own hits
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (64px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage per pulse; +1 pulse every 6th rank
--- identity ---
ENGINE:               feeds +6 Kinship per cast
COST:                 the three pulses land over 390ms, and a swarm moves
                      during that window — against anything fast the second
                      and third pulses hit air. Its damage on paper is 30;
                      its damage in practice is closer to 20
VISUAL:               two blurred forearm strikes and a third that is not
                      quite visible, the enemy reacting a beat after it lands
FLAVOR:               She watched one take a hummingbird out of the air. Not
                      quickly — that was the thing. It waited an extremely
                      long time and then did not need to be fast.

SKILL NAME:           Chameleon's Tact
CLASS / TREE / TIER:  druid / Tapestry of Beasts / tier_code 1
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
DOMAIN:               mental
--- effects ---
RIDERS:               stat mods: damageReduction +0.12
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +2.5% damage reduction per rank, diminishing above
                      60% (not damage)
--- identity ---
ENGINE:               neutral
COST:                 a flat mitigation slot on a class with five better
                      defensive options in the next tree over. Its only real
                      argument is that it costs nothing to maintain and
                      cannot be interrupted
VISUAL:               her outline never quite settles against the background;
                      the colour lags her movement by a half-step
FLAVOR:               Not hiding. Hiding is a thing you do. This is closer to
                      declining to insist on the distinction between yourself
                      and the wall.

SKILL NAME:           Scorpion's Venom
CLASS / TREE / TIER:  druid / Tapestry of Beasts / tier_code 2
TYPE:                 stacking_dot
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                melee long (90px)
TARGETS:              1 per cast (nearest below max stacks)
--- output ---
DAMAGE TIER:          low (8 per tick)
PACE:                 very fast (600ms)
DOMAIN:               physical
--- effects ---
RIDERS:               stacks to 6 on a single target
DOT:                  8 per 600ms for 5000ms, stacks to 6
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — nearest enemy below max stacks
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage per tick; +1 maximum stack every 5th rank
--- identity ---
ENGINE:               neutral
COST:                 ninety pixels. It is the only stacking DoT in the game
                      that requires melee range, which means the Druid must
                      stand next to a thing for five seconds while it dies of
                      something she applied on the first second
VISUAL:               a fast overhand jab, a bead of amber left behind in the
                      wound, the enemy's movements getting jerkier per stack
FLAVOR:               The dose is nothing. It is always nothing. What kills
                      is that the body cannot decide to stop reading it.

SKILL NAME:           Bear's Might
CLASS / TREE / TIER:  druid / Tapestry of Beasts / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r120 on caster)
RANGE:                melee long (120px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (4+ within 120px)
THREAT:               high
--- growth ---
RANK ADDS:            +4 damage; +6px radius every 3rd rank
--- identity ---
ENGINE:               feeds +6 Kinship per cast
COST:                 twelve seconds for one sweep. It is the tree's crowd
                      answer and it is available five times a minute, which
                      is not enough to be a crowd answer
VISUAL:               she drops her weight and comes up through the shoulder;
                      the arc is much wider than her reach should allow
FLAVOR:               Weight is not strength. Enumclaw taught her that on a
                      logging road, from about forty feet away, and she has
                      never needed a second lesson.

SKILL NAME:           Fierce Peregrine Falcon
CLASS / TREE / TIER:  druid / Tapestry of Beasts / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                line (movement path)
RANGE:                range medium (300px)
TARGETS:              each enemy in path once, uncapped
--- output ---
DAMAGE TIER:          medium (22)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               knockdown — stun 1000ms per enemy hit; caster displaced
                      300px
DOT:                  none
AFFECTS:              enemies, self (movement)
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (90px) — direction resolved away
                      from the densest cluster per the movement ruling
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +100ms knockdown every 3rd rank
--- identity ---
ENGINE:               feeds +6 Kinship per cast
COST:                 three hundred pixels of forced travel on a class that
                      has spent Kinship placing animals in specific places.
                      Every falcon dive is a chance to end up on the wrong
                      side of her own wolverine
VISUAL:               she goes low and flat and very fast, arms back, and the
                      enemies she passes fold backward rather than sideways
FLAVOR:               Two hundred miles an hour and it never once looks like
                      effort. That is the part she borrowed. The stopping she
                      had to work out herself.

SKILL NAME:           Snow Leopard's Stealth
CLASS / TREE / TIER:  druid / Tapestry of Beasts / tier_code 5
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
DOMAIN:               mental
--- effects ---
RIDERS:               stealth 3000ms — all enemy targeting drops her and
                      retargets (ruling 5)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (35%)
THREAT:               none — this is a threat *dump*; in co-op everything on
                      her goes to whoever is nearest
--- growth ---
RANK ADDS:            +250ms stealth per rank; at rank 8 the first attack out
                      of stealth deals ×1.5, +0.25 every 6 ranks thereafter
--- identity ---
ENGINE:               neutral
COST:                 three seconds of being unfindable, and nothing else.
                      It does not heal, does not damage, does not reposition
                      her. If the situation that triggered it is still true
                      when it ends, she has spent sixteen seconds of cooldown
                      to postpone it
VISUAL:               she does not fade — she becomes very slightly wrong to
                      look at, and the enemies' heads track past her and keep
                      going
FLAVOR:               It is not that they cannot see her. It is that seeing
                      her stops seeming like the important thing to be doing.

SKILL NAME:           Queen Bee's Swarm
CLASS / TREE / TIER:  druid / Tapestry of Beasts / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (r140, persistent hazard 10000ms)
RANGE:                melee long (140px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0 direct) — 8 per 500ms tick
PACE:                 very slow (8000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  ground tick 8 per 500ms for 10000ms — 160 total to
                      anything that stands in it the whole time
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 140px)
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage per tick; +2s duration every 4th rank; +8px
                      radius every 3rd rank
--- identity ---
ENGINE:               feeds +6 Kinship per cast
COST:                 it is placed where she is standing and she is about to
                      not be standing there. Ten seconds of the best sustained
                      area damage in the class, anchored to a spot she cannot
                      afford to defend
VISUAL:               a low humming cloud that thickens over the ten seconds
                      rather than thinning, brownish-gold, enemies inside it
                      flinching continuously
FLAVOR:               One is a nuisance. The number at which it stops being a
                      nuisance is not large, and it is a threshold rather than
                      a gradient, and she has stood on both sides of it.

SKILL NAME:           Elk Antlers
CLASS / TREE / TIER:  druid / Tapestry of Beasts / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r110 on caster)
RANGE:                melee long (110px)
TARGETS:              cap 5
--- output ---
DAMAGE TIER:          medium (22)
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               grants the Druid a 30-point absorb shield for 3000ms
                      on the same cast
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (110px)
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage and +8 shield absorb per rank
--- identity ---
ENGINE:               feeds +6 Kinship per cast
COST:                 the shield lasts three seconds. It is the only skill in
                      the tree that both hits and protects, and the protection
                      half expires faster than most enemies take to close
VISUAL:               a hard sweep of the head and shoulders; the antlers are
                      briefly, unmistakably there, and a pale sheath of them
                      stays over her chest afterward
FLAVOR:               They are bone and they are grown fresh every year and
                      they are shed without ceremony. She finds the whole
                      arrangement slightly obscene and extremely practical.

SKILL NAME:           Lion's Mane
CLASS / TREE / TIER:  druid / Tapestry of Beasts / tier_code 8
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
DOMAIN:               physical
--- effects ---
RIDERS:               timed 5600ms — damageReduction +0.25
                      — roster ruling 6: 8000ms→5600ms (70% of the 8000ms cooldown)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (60%)
THREAT:               none
--- growth ---
RANK ADDS:            +3% damage reduction per rank; +400ms duration every
                      4th rank
--- identity ---
ENGINE:               neutral
COST:                 eight seconds in sixteen, and it is Bark Armor from the
                      next tree with less on it. A Druid running both is
                      spending two slots on windows that overlap and do not
                      stack
VISUAL:               a heavy ruff of dark fur rises at the neck and
                      shoulders; blows land on it rather than on her
FLAVOR:               The mane is not armour and never was. It is a claim
                      about size, made in advance, to save everyone the
                      trouble of testing it.

SKILL NAME:           Elephant's Rage
CLASS / TREE / TIER:  druid / Tapestry of Beasts / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r170 on caster)
RANGE:                range short (170px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 capstone (25000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               knockback 120px and stun 800ms (port addition — see COST)
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (7+ within 170px), gated on 30 Kinship
THREAT:               high
--- growth ---
RANK ADDS:            +6 damage; +15px knockback every 3rd rank; +100ms stun
                      every 4th rank
--- identity ---
ENGINE:               consumes 30 Kinship
COST:                 a twenty-second capstone that does thirty damage. Even
                      with the rider it is the weakest tier-10 in the roster
                      on raw output, and the Kinship gate means a Druid whose
                      animals have all died cannot cast the thing that would
                      have saved them
VISUAL:               a full-body stamp; the shockwave is visible as a ring of
                      lifted dust and everything inside it goes over backward
FLAVOR:               There is no rage in it. That is a word people put on
                      large animals to make the size feel like an intention.
                      What there is, is a decision, arrived at slowly, and
                      then carried out completely.

> **Port addition flagged:** Elephant's Rage ships as 30 damage on a 20s
> cooldown with no rider — the weakest capstone in the roster. I added the
> knockback and stun its animation already implies rather than inflating the
> number. Invention, flagged.

---

## TREE: NATURE'S RESTORATION

Role read: **the self-sustain healer.** Eight of these ten skills only
target the Druid herself. This is not a party-healing tree like the Priest's
Grace — it is an apothecary keeping one person upright indefinitely. In
co-op she is the healer who cannot heal you, which is an interesting problem
and, I think, the right identity to protect rather than fix.

---

SKILL NAME:           Lye
CLASS / TREE / TIER:  druid / Nature's Restoration / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                multi-target (2 bolts)
RANGE:                range medium (340px)
TARGETS:              2 (one per bolt)
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (340px) — the two bolts split to
                      separate targets where two are available
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage per bolt; +1 bolt every 6th rank
--- identity ---
ENGINE:               neutral
COST:                 the only real attack in a tree of ten, on a 1.5s cycle,
                      which means a Restoration Druid's entire offence is one
                      slot. Everything else in this tree keeps her alive while
                      Lye does the work very slowly
VISUAL:               two pale caustic streaks that hiss on impact and leave
                      the ground faintly smoking
FLAVOR:               Wood ash and water. It has been in every farmhouse on
                      the continent for four hundred years and it will take
                      the skin off anything, and nobody has ever thought of it
                      as a weapon because it is under the sink.

SKILL NAME:           Mushroom Paste
CLASS / TREE / TIER:  druid / Nature's Restoration / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
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
RIDERS:               heals 30 to self
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (70%)
THREAT:               none
--- growth ---
RANK ADDS:            +8 heal per rank
--- identity ---
ENGINE:               feeds +3 Kinship per cast at rank 1, scaling with the
                      heal
COST:                 thirty health every eight seconds is a good rate and a
                      bad burst. It cannot answer a spike; it can only make
                      the average survivable, and RumbleJam kills by spike
VISUAL:               she works something dark and fibrous into a wound with
                      her thumb and does not look at it while she does
FLAVOR:               Most of what grows in that wood will kill you. A small
                      number of things will fix you. The list is not
                      intuitive and she has it memorised in the order she
                      learned it, which is to say in the order people died.

SKILL NAME:           Aloe
CLASS / TREE / TIER:  druid / Nature's Restoration / tier_code 2
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
DOMAIN:               physical
--- effects ---
RIDERS:               heals 18 to self
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (85%)
THREAT:               none
--- growth ---
RANK ADDS:            +5 heal per rank
--- identity ---
ENGINE:               feeds +2 Kinship per cast, scaling with the heal
COST:                 eighteen. It is the smallest number in the tree and it
                      arrives every four seconds, which makes it the most
                      total healing in the class and the least useful in any
                      given second
VISUAL:               a clear gel smeared fast across the forearm; the skin
                      under it visibly stops being angry
FLAVOR:               Unglamorous. Effective. She has stopped apologising for
                      the ratio.

SKILL NAME:           Clay
CLASS / TREE / TIER:  druid / Nature's Restoration / tier_code 3
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
DOMAIN:               physical
--- effects ---
RIDERS:               heals 22 instantly to self
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (55%)
THREAT:               none
--- growth ---
RANK ADDS:            +7 heal per rank
--- identity ---
ENGINE:               feeds +2 Kinship per cast, scaling with the heal
COST:                 twenty-two health on a ten-second cooldown, sitting one
                      tier above Aloe which gives eighteen every four. It is
                      strictly worse and the tree does not tell you. Its only
                      argument is a lower trigger threshold — it is the one
                      that is still available when things are actually bad
VISUAL:               grey river clay packed straight into the wound and left
                      there, cracking as it dries
FLAVOR:               It is not medicine. It is a lid. She has watched it
                      hold a man together for two days on the strength of
                      being nothing more than a lid.

SKILL NAME:           Honey Spread
CLASS / TREE / TIER:  druid / Nature's Restoration / tier_code 4
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
ENGINE:               feeds +6 Kinship per cast at rank 1 (64 health healed)
COST:                 sixty-four health delivered over eight seconds. It is
                      the tree's best total heal and its slowest delivery,
                      and it competes for the same trigger window as three
                      instant heals that will fire first
VISUAL:               a slow amber sheen over her arms that dulls as it is
                      used up
FLAVOR:               It does not spoil. Not in a year, not in a thousand.
                      Something in the way the bees make it simply refuses to
                      participate in decay, and she has never met a person
                      who was not slightly unsettled once she explained that.

SKILL NAME:           Bark Armor
CLASS / TREE / TIER:  druid / Nature's Restoration / tier_code 5
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
DOMAIN:               physical
--- effects ---
RIDERS:               timed 2800ms — damageReduction +0.25, maxHPMult +0.20
                      — roster ruling 6: 10000ms→2800ms (70% of the 4000ms cooldown)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 250px)
THREAT:               none
--- growth ---
RANK ADDS:            +3% damage reduction and +4% max HP per rank; +500ms
                      duration every 4th rank
--- identity ---
ENGINE:               neutral
COST:                 the maxHP component is the trap — it raises her ceiling
                      without filling the new space, so at low health the
                      buff makes her health bar look worse the instant it
                      lands. Ten good seconds, and a slightly demoralising
                      first one
VISUAL:               grey ridged bark closes over the shoulders and
                      forearms, splitting visibly where she is struck
FLAVOR:               A tree does not defend itself. It simply arranges to be
                      mostly the part that does not matter, and keeps the
                      part that does very far inside.

SKILL NAME:           Sage Burn
CLASS / TREE / TIER:  druid / Nature's Restoration / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r110 at caster, persistent 30000ms)
RANGE:                melee long (110px)
TARGETS:              every ally and summon in the field
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  heals 4 per 1000ms for 30000ms — 120 per friendly who
                      stays in it
AFFECTS:              allies + own summons + self
--- automation ---
TRIGGER:              COOLDOWN_READY when 2+ friendlies are below 75% within
                      110px
THREAT:               none
--- growth ---
RANK ADDS:            +1 heal per tick per rank; +5s duration every 4th rank;
                      +6px radius every 3rd rank
--- identity ---
ENGINE:               feeds — thirty seconds of ticking across several bodies
                      is the largest Kinship block in the class
COST:                 a 110px circle that lasts thirty seconds, on a class
                      whose animals wander and whose player cannot stand
                      still. Its healing is enormous and almost all of it
                      goes to nobody
VISUAL:               a low grey-green smoke that clings at ankle height and
                      does not disperse, smelling of something dry and clean
FLAVOR:               Her grandmother did this in a room where someone had
                      died and called it clearing the air. It turns out that
                      it does clear the air. Nobody had checked.

SKILL NAME:           Healing Spores
CLASS / TREE / TIER:  druid / Nature's Restoration / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r200 at caster, persistent 30000ms)
RANGE:                range short (200px)
TARGETS:              every ally and summon in the field
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  heals 5 per 1000ms for 30000ms — 150 per friendly who
                      stays in it
AFFECTS:              allies + own summons + self
--- automation ---
TRIGGER:              COOLDOWN_READY when 2+ friendlies are below 75% within
                      200px
THREAT:               none
--- growth ---
RANK ADDS:            +1.5 heal per tick per rank; +5s duration every 4th
                      rank; +10px radius every 3rd rank
--- identity ---
ENGINE:               feeds — the class's single largest Kinship source
COST:                 it is Sage Burn one tier later with a bigger radius and
                      a bigger number, on the identical 45-second cooldown.
                      Taking both is redundant and taking neither leaves the
                      Restoration tree with no group contribution at all —
                      an awkward pair of nodes however you approach them
VISUAL:               a wide pale bloom of drifting spores, thickest near the
                      ground, catching the light
FLAVOR:               The mycelium under that forest is one organism and it
                      is older than the language she is thinking in. When she
                      asks it for something she is careful to be specific.

SKILL NAME:           Essential Oil of Immunity
CLASS / TREE / TIER:  druid / Nature's Restoration / tier_code 8
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
RIDERS:               AUTHORED — strips every affliction on the Druid and
                      grants 5600ms immunity to all new debuffs (slow, stun,
                      weaken, root, DoT application). Damage still lands
                      normally
                      — roster ruling 6: 8000ms→5600ms (70% of the 8000ms cooldown)
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              ON_DAMAGE_TAKEN, gated to fire only when carrying 2+
                      afflictions
THREAT:               none
--- growth ---
RANK ADDS:            +600ms immunity per rank; at rank 6 it also cleanses
                      the nearest friendly, +1 friendly every 6 ranks
--- identity ---
ENGINE:               consumes 50 Kinship
COST:                 sixty seconds, fifty Kinship, and it does nothing
                      whatsoever against damage. In a room full of enemies
                      that simply hit hard, it is a slot spent on a problem
                      that room does not have
VISUAL:               she breaks a small stoppered bottle under her own nose;
                      everything clinging to her lets go at once and does not
                      come back
FLAVOR:               Distilled down from about four hundred pounds of plant
                      matter to something that fits in a thimble. She thinks
                      of it as the forest's opinion, concentrated to the
                      point where nothing can argue with it.

> **AUTHORED FROM NOTHING.** This skill has no effect in ToH — non-damaging
> list, 60s cooldown, no rider, no heal, no buff, no stat mod. It is a tier-9
> node that does literally nothing. I wrote the above from the name. This is
> the largest invention in the class and it should be reviewed as a design
> proposal rather than a conversion.

SKILL NAME:           Essential Oil of Vitality
CLASS / TREE / TIER:  druid / Nature's Restoration / tier_code 9
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
DOMAIN:               physical
--- effects ---
RIDERS:               AUTHORED — heals 40% of maximum HP instantly, then
                      grants regenPerSec 12 and damageReduction +0.20 for
                      12000ms
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (30%)
THREAT:               none
--- growth ---
RANK ADDS:            +3% of maximum HP to the instant heal per rank; +2
                      regen per second per rank; +500ms duration every 4th
                      rank
--- identity ---
ENGINE:               consumes 50 Kinship
COST:                 it is the class's only genuine emergency button and it
                      is available once a minute. Everything else in this
                      tree heals in small amounts on short cooldowns; this
                      one is the opposite, and a Druid who has spent her
                      Kinship on animals will find it locked at the exact
                      moment she needs it
VISUAL:               she drinks it. It is the only skill in the class where
                      she stops moving entirely for a beat, and the colour
                      comes back into her from the centre outward
FLAVOR:               She made three of these in her life and has used two.
                      The recipe is not difficult. What is difficult is the
                      forty years the ingredients need to have been standing
                      somewhere undisturbed.

> **AUTHORED FROM NOTHING.** Same as Immunity above — no effect exists in
> ToH. The Restoration tree's top two nodes are, as shipped, two empty
> 60-second cooldowns. Reviewed as proposal, not conversion.

---

## TREE: WILD KIN

Role read: **the summoner-controller.** Five summons and five weather
effects, and the Kinship engine lives here — every animal standing is
income, and everything else in the class is paid for by them. This is the
tree that makes the Druid a pet class, and it is where a solo Druid gets her
threat sink.

---

SKILL NAME:           Freezing Wind Chill
CLASS / TREE / TIER:  druid / Wild Kin / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                cone (narrow) (70° total)
RANGE:                melee long (135px)
TARGETS:              uncapped in cone (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               slow ×0.55 for 840ms
                      — roster ruling 6: 3000ms→840ms (70% of the 1200ms cooldown)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 135px — cone orients to the
                      cluster centroid
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +300ms slow every 3rd rank; +4° cone width
                      every 4th rank
--- identity ---
ENGINE:               neutral
COST:                 135px and a 70-degree wedge. It is the tree's tier-1
                      workhorse and it requires her to be facing the right
                      way at close range, which on a summoner is the position
                      her animals were supposed to prevent
VISUAL:               a flat white gust; the ground it crosses goes pale and
                      the enemies in it move like they are pushing through
                      something
FLAVOR:               Cold is not a substance. Cold is a shortage. She has
                      found that things which are alive object to shortages
                      much more strongly than they object to being struck.

SKILL NAME:           Viper Summon
CLASS / TREE / TIER:  druid / Wild Kin / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns adjacent)
TARGETS:              n/a — cap 2, +1 per 5 ranks
--- output ---
DAMAGE TIER:          none (0) — the viper deals the damage
PACE:                 fast (1200ms)
DOMAIN:               physical
--- effects ---
RIDERS:               persists until killed; applies a poison DoT on its bites
DOT:                  none (the summon's own)
AFFECTS:              own summons
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on being under cap
THREAT:               none (the viper carries it)
--- growth ---
RANK ADDS:            +10% viper damage and HP per rank; +1 cap every 5th rank
--- identity ---
ENGINE:               consumes 10 Kinship — the cheapest entry in the class,
                      and the one that starts the engine at the beginning of
                      a run when she has nothing
COST:                 a viper is small, fragile, and dies to incidental
                      damage. Its value is almost entirely that it is alive,
                      generating +1 Kinship a second, rather than anything it
                      does with its teeth
VISUAL:               it does not appear so much as become noticeable, low
                      and already moving
FLAVOR:               She does not command it. She indicates a direction and
                      it agrees that the direction is interesting.

SKILL NAME:           Lightning Strike
CLASS / TREE / TIER:  druid / Wild Kin / tier_code 2
TYPE:                 active
AXIS POSITION:        3 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                chain
RANGE:                range medium (340px)
TARGETS:              chain, 3 jumps
--- output ---
DAMAGE TIER:          medium (24)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 340px — chains best where bodies
                      are close together
THREAT:               some
--- growth ---
RANK ADDS:            +4 damage; +1 chain jump every 4th rank
--- identity ---
ENGINE:               neutral
COST:                 the chain needs targets within jump distance of each
                      other. Against a spread-out swarm it is a single-target
                      skill on a five-second cooldown, and the Druid has no
                      way to pull enemies together
VISUAL:               it arrives before the sound, white and forked, and the
                      jumps are visible as a single continuous line rather
                      than three separate strikes
FLAVOR:               Enumclaw gets an extraordinary amount of it. She spent
                      her childhood being told to come inside and a good deal
                      of her adulthood not doing so.

SKILL NAME:           Wolverine Summon
CLASS / TREE / TIER:  druid / Wild Kin / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns adjacent)
TARGETS:              n/a — cap 1
--- output ---
DAMAGE TIER:          none (0) — the wolverine deals the damage
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               persists until killed; aggressive — actively closes on
                      the nearest enemy rather than holding near the Druid
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on being dead or unspawned
THREAT:               high (delegated — it is the class's aggro anchor)
--- growth ---
RANK ADDS:            +12% wolverine damage and HP per rank
--- identity ---
ENGINE:               consumes 15 Kinship
COST:                 it chases. That is what a wolverine does and it is
                      correct, and it means the Druid's tankiest body is
                      frequently forty feet away killing something that was
                      not the problem
VISUAL:               low, wide, and much faster than the shape suggests; it
                      does not circle or feint
FLAVOR:               Pound for pound the most unreasonable animal on the
                      continent. She did not choose it for its strength. She
                      chose it because it has never once, in her observation,
                      considered the option of stopping.

SKILL NAME:           Earthquake
CLASS / TREE / TIER:  druid / Wild Kin / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (circle r130 at 200px)
RANGE:                range short (200px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (26)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               slow ×0.5 for 3000ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 200px
THREAT:               none
--- growth ---
RANK ADDS:            +4 damage; +300ms slow every 3rd rank; +8px radius
                      every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 placed at range and resolving once, where the cluster
                      was rather than where it is. The slow is the reason to
                      take it, and it lands on whichever enemies were slowest
                      to leave
VISUAL:               a hard shudder in a circle of floor, tiles lifting and
                      dropping, dust standing up briefly in a wall
FLAVOR:               The ground is not solid and has never been solid. It is
                      simply slow, and things which are slow enough get
                      mistaken for things which are fixed.

SKILL NAME:           Chimpanzee Pair
CLASS / TREE / TIER:  druid / Wild Kin / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns adjacent, two bodies)
TARGETS:              n/a — cap 1 pair (2 units)
--- output ---
DAMAGE TIER:          none (0) — the pair deals the damage
PACE:                 slow (4000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               persists until killed; the two coordinate — they
                      preferentially attack the same target
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on the pair being under cap
THREAT:               some (delegated)
--- growth ---
RANK ADDS:            +10% pair damage and HP per rank; at rank 8 a third
                      chimpanzee joins the group, +1 every 8 ranks
--- identity ---
ENGINE:               consumes 25 Kinship — but two bodies means +2/sec, so
                      the pair repays its cost in thirteen seconds and every
                      second after that is profit
COST:                 fourteen seconds to replace, and they die together
                      because they fight together. Losing the pair is a
                      bigger Kinship shock than losing any single summon in
                      the class
VISUAL:               they arrive already arguing with something, moving in
                      short bursts, and they hand off targets between them
                      without any apparent signal
FLAVOR:               Two of them is not twice one of them. She knew this
                      before she could have explained why, and the explanation
                      when it came was worse than the intuition.

SKILL NAME:           Lava Pocket
CLASS / TREE / TIER:  druid / Wild Kin / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
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
RIDERS:               burn DoT — 6 per 1000ms for 4000ms (port addition, see
                      COST)
DOT:                  6 per 1000ms for 4000ms
AFFECTS:              enemies
--- automation ---
TRIGGER:              TARGET_UNAFFECTED — fires at the nearest enemy not
                      already burning
THREAT:               some
--- growth ---
RANK ADDS:            +4 impact damage; +1 burn damage per tick every 2nd
                      rank
--- identity ---
ENGINE:               neutral
COST:                 single target on a six-second cooldown in a tree that
                      is otherwise all summons and area weather. It is the
                      odd node — nothing else in Wild Kin wants to be pointed
                      at one specific enemy
VISUAL:               a dull red glob that arcs low and splashes, leaving the
                      target lit from inside for a few seconds
FLAVOR:               Rainier is not extinct. Nobody who lives in its shadow
                      thinks of it as extinct. They think of it as being in a
                      mood that has lasted a while.

> **Port addition flagged:** ToH's Lava Pocket has no rider — 24 damage,
> single target, 6s cooldown, strictly worse than Freezing Wind Chill five
> tiers below it. I gave it the burn its name promises. Invention, flagged.

SKILL NAME:           Scavenger Summon
CLASS / TREE / TIER:  druid / Wild Kin / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns in a loose group)
TARGETS:              n/a — 4 untargetable chip units, 15000ms lifespan
--- output ---
DAMAGE TIER:          none (0) — the scavengers deal small continuous damage
PACE:                 very slow (8000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               UNTARGETABLE and timed (ruling 3) — cannot be killed,
                      cannot hold aggro, expire on their own
DOT:                  none (the summons' own chip damage)
AFFECTS:              own summons
--- automation ---
TRIGGER:              COOLDOWN_READY
THREAT:               none — they are the only summon in the game that draws
                      no attention at all
--- growth ---
RANK ADDS:            +12% scavenger damage per rank; +2s lifespan every 4th
                      rank; +1 scavenger every 6th rank
--- identity ---
ENGINE:               consumes 20 Kinship, and four living bodies means
                      +4/sec for fifteen seconds — the single most efficient
                      Kinship trade in the class, and the one to lead with
                      when the run is going badly
COST:                 they expire. Everything else in this tree is an
                      investment that keeps paying; these are a fifteen-second
                      lease, and a Druid leaning on them for Kinship is
                      running on a treadmill
VISUAL:               small, numerous, low to the ground and hard to count;
                      they do not engage so much as attend
FLAVOR:               Nothing in that forest is wasted and nothing waits
                      politely. She has simply stopped thinking of them as
                      arriving afterward.

SKILL NAME:           Polar Bear Summon
CLASS / TREE / TIER:  druid / Wild Kin / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns adjacent)
TARGETS:              n/a — cap 1
--- output ---
DAMAGE TIER:          none (0) — the bear deals the damage
PACE:                 very slow (8000ms)
DOMAIN:               physical
--- effects ---
RIDERS:               persists until killed; the toughest summon in the class
                      and holds position near the Druid rather than chasing
DOT:                  none
AFFECTS:              own summons
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on being dead or unspawned and on
                      40 Kinship
THREAT:               high (delegated — this is the Druid's tank)
--- growth ---
RANK ADDS:            +15% bear damage and HP per rank
--- identity ---
ENGINE:               consumes 40 Kinship
COST:                 forty Kinship and twenty seconds. It is the class's
                      real tank and it is gated behind having already built
                      an economy — a Druid who opens a hard room with no bear
                      standing cannot conjure one in time, and the Kinship
                      decay means every second she spends without summons
                      pushes the bear further away
VISUAL:               it does not hurry. It arrives at the speed it intends
                      to arrive at and things move out of its way before
                      contact
FLAVOR:               The only large predator on earth that has never learned
                      to be afraid of people, because it has never had a
                      reason to. She finds that clarifying and does not find
                      it comforting.

SKILL NAME:           Hail Stones
CLASS / TREE / TIER:  druid / Wild Kin / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (circle r140 at 220px)
RANGE:                range short (220px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          medium (30)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               stun 900ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (6+ within 220px), resolving on the
                      densest cluster
THREAT:               none
--- growth ---
RANK ADDS:            +6 damage; +100ms stun every 3rd rank; +8px radius
                      every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 a fourteen-second capstone that hits for thirty and
                      stuns for under a second. Compared to the other classes'
                      tier-10 nodes it is modest, and the honest reading is
                      that the Druid's capstone is not this — it is the Polar
                      Bear one tier below, and this is the thing you take
                      afterward
VISUAL:               a short violent fall of white in a hard-edged circle,
                      over almost before it registers, the ground left
                      scattered and steaming
FLAVOR:               Weather does not target anything. That is the whole
                      difficulty with it, and the whole reason it works. She
                      is not asking the sky for a favour; she is telling it
                      where she happens to be standing.
