# PRIEST — RUMBLEJAM CONVERSION (30 skills)

Mechanical fields carried from the code export unchanged. Eight judgment
fields authored. Class-wide rulings stated once here.


---

## ROSTER RULING APPLIED

**Engine — RULED: Conviction (doc). `marks` is superseded.**

**Tree names — built names win.** Light→Reckoning, Rebuke→Judgment, Grace→Grace


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

## CLASS ENGINE — CONVICTION

Three Priest skills already charge the player HP to cast: Guardian's Embrace
(20), Divine Renewal (25), Divine Intervention (30). That is not a cost
system, it is an unstated engine, and the class has been running on it the
whole time. Making it explicit:

**CONVICTION, 0–100.** Starts each run at 0.

Feeds:
- Healing delivered: **+1 per 10 HP restored** (to anyone, including summons)
- An ally or summon taking a hit within 250px: **+4** (he is paid for
  watching someone else get hurt, which is the correct discomfort for this
  class)
- Spending his own HP on a skill: **+15** (self-sacrifice is the purest feed)
- Taking a hit himself: **+2**

Consumes:
- Divine Intervention: **50** · Aegis of Dawn: **50**
- Grace Incarnate: **60** · Divine Judgment: **40**

Decays **1/sec**. The Priest is the only class whose engine fills fastest
when the run is going badly for *everyone else*. Solo, his summons and his
own HP are the fuel; in co-op, the party is.

---

## PORT RULINGS

**1. Divine Intervention is dormant in ToH and I have brought it back.** The
export is explicit: the hook returns false, there is no party roster, every
cast is a refunded whiff, and the 30-HP price is coded but unreachable. This
is the clearest case in the entire project of a skill that RumbleJam can
deliver and ToH could not. Authored as a live co-op skill. In solo it
retargets to the most-injured summon; if he has no summons it does not fire.

**2. The ally resolution order, for the whole roster.** Every ally-affecting
Priest skill resolves targets in this order: **real co-op players → own
summons → self.** Solo with summons, the healer heals his guardians. Solo
with nothing, heals land on him. This should be the standing rule for all
fourteen classes; Priest is where it gets decided because he has eleven
skills that touch allies.

**3. Heals need their own trigger discipline.** `ALLY_HP_BELOW_X` is the
default for targeted heals, `SELF_HP_BELOW_X` for self-heals, and area heals
fire on the *count* of hurt friendlies in radius rather than one threshold —
otherwise a 55-second Grace Incarnate goes off to top up one skeleton. Where
a heal has a big cooldown I set the threshold low and the count high on
purpose.

**4. HP-cost skills gate on HP.** Guardian's Embrace, Divine Renewal, and
Divine Intervention will not auto-fire if the cost would drop the Priest
below 35% — the code already refuses Renewal at ≤25 HP and I extended the
principle. An auto-firing skill that can kill its own caster is the single
worst thing this port could ship.

**5. Priest summons are stationary guardians, not fighters.** Shield of
Faith, Celestial Barrier, and Aegis of Dawn spawn allied entities. Ruling:
they do not chase; they hold position and body-block, taking aggro above the
Priest. They are cover, not damage. This is what gives the class a tank
component without pretending a Priest can tank.

**6. Channels do not break on movement** (carried from Necromancer ruling 4);
60% tick rate while moving. Applies to Judgment Ray.

---

## TREE: RECKONING  (was Light in the source conversion)

Role read: **the protection healer.** Shields, barriers, immunity windows,
and three summonable guardians. This is the tree that makes the Priest a
co-op keystone and, solo, gives him the bodies he needs so that "healer"
means something with nobody else in the room.

---

SKILL NAME:           Ray of Light
CLASS / TREE / TIER:  priest / Reckoning / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (380px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          medium (20)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              NEAREST_IN_RANGE (380px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage
--- identity ---
ENGINE:               neutral
COST:                 the Priest's only reliable damage in the Light tree,
                      and it is twenty. A protection build that slots this
                      as its attack will not clear waves; the tree is
                      honest about not being a damage tree from tier one
VISUAL:               a thin hard line of white that arrives before the
                      sound does
FLAVOR:               He was taught that light is not a weapon, and he
                      believed it for a long time, and then he watched what
                      the winged ones did with it.

SKILL NAME:           Shield of Faith
CLASS / TREE / TIER:  priest / Reckoning / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                range medium (300px placement)
TARGETS:              n/a — cap 2 standing, +1 per 5 ranks
--- output ---
DAMAGE TIER:          none (0)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               grants the recipient 1500ms harm immunity on spawn;
                      guardian holds position, body-blocks, takes aggro above
                      the Priest (ruling 5)
DOT:                  none
AFFECTS:              allies + own summons
--- automation ---
TRIGGER:              COOLDOWN_READY, gated on being under cap
THREAT:               none (delegated to the guardian)
--- growth ---
RANK ADDS:            +15% guardian HP per rank; +200ms spawn immunity every
                      3rd rank; +1 cap every 5th rank
--- identity ---
ENGINE:               feeds — every hit the guardian eats within 250px is
                      +4 Conviction, so a well-placed shield is the class's
                      steadiest income
COST:                 it does not move. Placed at 300px and then abandoned
                      by a player who has to keep running, it spends most of
                      its life protecting empty floor
VISUAL:               a standing plate of layered light, edge-on and faintly
                      humming, the sigil on its face turning slowly
FLAVOR:               Faith is not a feeling. It is the decision to put
                      something between another person and the thing coming
                      for them, and then to stand behind that decision.

SKILL NAME:           Retribution Aura
CLASS / TREE / TIER:  priest / Reckoning / tier_code 2
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
RIDERS:               timed 8000ms — reflectPct 0.35
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (70%)
THREAT:               none
--- growth ---
RANK ADDS:            +4% reflect per rank; +400ms duration every 4th rank
--- identity ---
ENGINE:               feeds — it only pays out while he is being hit, and
                      being hit is +2 Conviction a time
COST:                 a defensive cooldown that requires him to keep taking
                      damage to be worth anything. On a class with 11
                      ally-facing skills, any slot spent on personal
                      retaliation is a slot not spent keeping someone else
                      standing
VISUAL:               a close-fitting shell of gold light; incoming blows
                      strike it and the strike is visibly returned along the
                      same line
FLAVOR:               Rome taught him the word for this and it was not
                      revenge. He has never been fully satisfied with the
                      distinction.

SKILL NAME:           Guardian's Embrace
CLASS / TREE / TIER:  priest / Reckoning / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r180 on caster)
RANGE:                range short (180px)
TARGETS:              every live ally and summon in radius
--- output ---
DAMAGE TIER:          none (0)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               heals 30 to every friendly in r180; COSTS the Priest
                      20 HP, bypassing shields. Will not auto-fire if the
                      cost would drop him below 35% (ruling 4)
DOT:                  none
AFFECTS:              allies + own summons + self (cost)
--- automation ---
TRIGGER:              ALLY_HP_BELOW_X (65%) with 2+ friendlies hurt in radius
THREAT:               none
--- growth ---
RANK ADDS:            +6 heal per rank; +8px radius every 3rd rank. The 20 HP
                      cost does NOT scale — at rank 10 he heals 90 each for
                      the same 20
--- identity ---
ENGINE:               feeds hard — the HP spend alone is +15 Conviction, and
                      the healing on top of it is +3 per target at rank 1
COST:                 it is stated in the code and it is the whole skill: he
                      pays twenty of his own to give thirty to each of
                      theirs. Cast into a crowd of hurt allies it is the best
                      trade in the game. Cast when only one summon is scuffed
                      it is a self-inflicted wound
VISUAL:               he opens his arms and the light goes outward from the
                      chest — a visible red thread runs from him to each
                      recipient and fades
FLAVOR:               It has to come from somewhere. Everyone who has ever
                      been healed by him has understood this in the abstract
                      and almost none of them have asked.

SKILL NAME:           Radiant Aura
CLASS / TREE / TIER:  priest / Reckoning / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (persistent field, 12000ms)
RANGE:                melee long (placed at caster)
TARGETS:              uncapped — friendlies inside are healed
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  heals 3 per 1000ms for 12000ms to the Priest and every
                      friendly standing in it
AFFECTS:              allies + own summons + self
--- automation ---
TRIGGER:              COOLDOWN_READY when 2+ friendlies are below 80% within
                      the placement radius
THREAT:               none
--- growth ---
RANK ADDS:            +1 heal per tick per rank; +2s field duration every
                      4th rank
--- identity ---
ENGINE:               feeds — twelve seconds of ticking heals across several
                      bodies is a large, slow Conviction drip
COST:                 it is a field, and the player's job is to not be
                      standing anywhere in particular. Every second the
                      Priest spends running out of his own healing circle is
                      a second of it wasted, and RumbleJam will make him run
VISUAL:               a soft warm disc on the floor with a slowly rotating
                      pattern in it, brightest at the rim
FLAVOR:               A place where things get better slightly faster than
                      they get worse. He has spent his life trying to make
                      the radius larger.

SKILL NAME:           Celestial Barrier
CLASS / TREE / TIER:  priest / Reckoning / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                range short (160px placement)
TARGETS:              n/a — cap 1
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               guardian holds position and body-blocks; substantially
                      tougher than Shield of Faith and takes aggro above the
                      Priest
DOT:                  none
AFFECTS:              allies + own summons
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (200px) — placed between the Priest
                      and the incoming density, gated on the barrier being
                      down
THREAT:               high (delegated to the barrier)
--- growth ---
RANK ADDS:            +20% barrier HP per rank; +10px barrier width every
                      3rd rank
--- identity ---
ENGINE:               feeds — a barrier absorbing a wave is a continuous
                      stream of +4 Conviction events
COST:                 one barrier, sixteen seconds, one direction. A swarm
                      that arrives from two sides makes it a wall with a door
                      in it, and the Priest is standing in the door
VISUAL:               a broad curved pane of white-gold with visible
                      thickness, planted edge-first into the floor
FLAVOR:               Not a miracle. Masonry. It is simply that the material
                      is more cooperative than stone and requires less of
                      him than stone would.

SKILL NAME:           Divine Fortress
CLASS / TREE / TIER:  priest / Reckoning / tier_code 6
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
RIDERS:               scene-keyed [declared, not derived] — "your shields are
                      architecture: they hold 30% more and last 40% longer"
DOT:                  none
AFFECTS:              self, allies, own summons
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +8% shield capacity and +10% shield duration per rank
                      (not damage)
--- identity ---
ENGINE:               feeds indirectly — shields that last longer absorb more
                      hits, and absorbed hits on allies are +4 each
COST:                 it multiplies something you must already own. Slotted
                      without Shield of Faith or Celestial Barrier it is a
                      dead slot, and it is the tier-7 node, so the tree asks
                      for a two-slot commitment before it starts paying
VISUAL:               every shield he casts gains visible internal structure
                      — ribs, courses, a keystone
FLAVOR:               He does not think of himself as a priest of light. He
                      thinks of himself as a builder who was handed an
                      unusually good material and told not to ask where it
                      came from.

SKILL NAME:           Guardian's Blessing
CLASS / TREE / TIER:  priest / Reckoning / tier_code 7
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
RIDERS:               harm immunity 4000ms — takes no damage from any source
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (30%)
THREAT:               none
--- growth ---
RANK ADDS:            +300ms immunity per rank (not damage). This is the one
                      skill where I'd cap rank scaling — see note
--- identity ---
ENGINE:               consumes nothing, feeds nothing. It is the class's
                      pure survival button
COST:                 four seconds of invulnerability that heals nothing and
                      kills nothing. It buys time and does not use it — a
                      Priest who fires this and then has no heal off cooldown
                      has only delayed the problem by four seconds
VISUAL:               a brief full-body corona; incoming attacks pass through
                      him with a sound like something being set down gently
FLAVOR:               Nothing touches him. He has never been comfortable
                      with how easy this one is, or with the question of who
                      is doing it, or with the fact that it still works.

> **Rank cap flagged:** unlimited ranks on a pure invulnerability window is
> the one place in this class where the points economy breaks — at rank 20
> it is a ten-second immunity on a twenty-second cooldown. I'd hard-cap the
> duration at 6s regardless of rank and let further ranks reduce the
> cooldown instead. Overrule if you'd rather it scale freely.

SKILL NAME:           Divine Intervention
CLASS / TREE / TIER:  priest / Reckoning / tier_code 8
TYPE:                 active
AXIS POSITION:        9 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range long (400px)
TARGETS:              1 — the most-injured ally (co-op) or most-injured
                      summon (solo); does not fire with neither present
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               full heal to the target plus 2000ms harm immunity;
                      COSTS the Priest 30 HP. Will not auto-fire if the cost
                      would drop him below 35% (ruling 4)
DOT:                  none
AFFECTS:              allies (co-op) / own summons (solo)
--- automation ---
TRIGGER:              ALLY_HP_BELOW_X (20%)
THREAT:               none
--- growth ---
RANK ADDS:            +250ms immunity per rank; the heal is already full and
                      does not scale. The 30 HP cost does not scale
--- identity ---
ENGINE:               consumes 50 Conviction; the HP spend refunds +15
                      immediately, so net cost is 35
COST:                 thirty of his own hit points and half his Conviction
                      to pull one person off the floor, on a thirty-second
                      cooldown, and if two people are dying it picks one.
                      Solo it is a very expensive summon repair
VISUAL:               a vertical column of white lands on the target from
                      offscreen; the Priest staggers a half-step at the same
                      instant
FLAVOR:               He does not ask for this one. He has never been sure
                      it is granted rather than taken, and on the nights he
                      is honest with himself he suspects the difference is
                      the whole argument.

> **This skill has never fired.** The export is unambiguous: the ToH hook
> returns false, there is no party roster, and the 30-HP price is coded but
> unreachable. It is a complete, tuned, unreachable skill sitting at tier 9
> of the Priest's best tree. RumbleJam co-op is the first context in which
> it can exist, and it is the strongest single argument in this whole port
> that the conversion is worth doing.

SKILL NAME:           Aegis of Dawn
CLASS / TREE / TIER:  priest / Reckoning / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 summoned
SHAPE:                none
RANGE:                n/a (spawns in a ring around the Priest)
TARGETS:              n/a — 4 guardians at once, 25000ms lifespan, ignoring
                      the Shield of Faith cap
--- output ---
DAMAGE TIER:          none (0)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               the four hold a ring formation around the Priest and
                      move with him — the only mobile guardians in the class
DOT:                  none
AFFECTS:              allies + own summons
--- automation ---
TRIGGER:              CROWD_THRESHOLD (10+ within 350px), gated on 50
                      Conviction
THREAT:               high (delegated across four bodies)
--- growth ---
RANK ADDS:            +20% guardian HP per rank; +3s lifespan every 4th rank;
                      +1 guardian every 6th rank
--- identity ---
ENGINE:               consumes 50 Conviction
COST:                 sixty seconds. It is the Priest's answer to being
                      overwhelmed and it arrives once a minute, which means
                      most of the times he is overwhelmed it is not
                      available. The Conviction gate makes an early-run cast
                      impossible, which is correct and will still feel bad
VISUAL:               four columns of dawn-coloured light drop around him in
                      a square and resolve into standing figures facing
                      outward, moving when he moves
FLAVOR:               The first light is not warm. Anyone who has stood a
                      night watch knows this. It arrives grey and level and
                      indifferent, and it means only that the night is over
                      and you were not required to be grateful.

---

## TREE: JUDGMENT  (was Rebuke in the source conversion)

Role read: **the damage spec.** This is the Priest as a WoW Shadow or
Retribution — the tree you take when the group already has healing or when
you are solo and something has to die. It carries the class's only high
damage tier and its only real burst.

---

SKILL NAME:           Smite
CLASS / TREE / TIER:  priest / Judgment / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r72)
RANGE:                melee short (72px)
TARGETS:              cap 3
--- output ---
DAMAGE TIER:          medium (20)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               weaken 25% for 4000ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (72px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage; +2% weaken every 2nd rank
--- identity ---
ENGINE:               neutral
COST:                 72px on a class with cloth defences and no dash. Every
                      Smite is the Priest choosing to be within reach of the
                      thing he is rebuking, which is theologically apt and
                      mechanically dangerous
VISUAL:               a downward stroke of light with weight to it; struck
                      enemies visibly sag afterward
FLAVOR:               The word means to strike. It has always meant to
                      strike. The people who translated it as correction
                      were being kind to themselves.

SKILL NAME:           Rebuke of the Heretic
CLASS / TREE / TIER:  priest / Judgment / tier_code 1
TYPE:                 active
AXIS POSITION:        2 (of 10)
--- delivery ---
CAST:                 projectile
SHAPE:                single target
RANGE:                range medium (360px)
TARGETS:              1 (first hit)
--- output ---
DAMAGE TIER:          low (12)
PACE:                 fast (1200ms)
DOMAIN:               mental
--- effects ---
RIDERS:               fear — target flees for 2000ms (port addition, see COST)
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              ENEMY_BREACHES_RING (120px) — used as a panic peel, not
                      as damage
THREAT:               none
--- growth ---
RANK ADDS:            +2 damage; +300ms flee every 3rd rank
--- identity ---
ENGINE:               neutral
COST:                 twelve damage on a six-second cooldown. Everything it
                      is worth is in the flee, and a fleeing enemy is an
                      enemy that comes back — it displaces a problem rather
                      than solving one
VISUAL:               a spoken word rendered as a visible concussion; the
                      target turns and runs with its hands over its head
FLAVOR:               He does not raise his voice. He has found that the
                      quiet version is worse and that everyone involved
                      knows it.

> **Port addition flagged:** ToH's Rebuke has no rider — 12 damage on a 6s
> cooldown, the weakest damage-per-cooldown in the class. I gave it the fear
> its name implies rather than raising the number. Invention, flagged.

SKILL NAME:           Divine Wrath
CLASS / TREE / TIER:  priest / Judgment / tier_code 2
TYPE:                 buff
AXIS POSITION:        3 (of 10)
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
ENGINE:               neutral
COST:                 eight seconds in eighteen. It is on for less than half
                      the fight, so every damage number the player sees in
                      the tooltip is one they will only get 44% of the time
VISUAL:               his shadow lengthens and stops matching the light
                      source; every attack he lands in the window has a
                      harder edge
FLAVOR:               He was taught that wrath belongs to someone else. He
                      has recently been given reason to doubt the character
                      of the someone else, and the doubt has not made him
                      gentler.

SKILL NAME:           Word of Power
CLASS / TREE / TIER:  priest / Judgment / tier_code 3
TYPE:                 active
AXIS POSITION:        4 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r180 on caster)
RANGE:                range short (180px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               mental
--- effects ---
RIDERS:               slow ×0.55 for 2500ms; weaken 25% for 4000ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (5+ within 180px)
THREAT:               some
--- growth ---
RANK ADDS:            +400ms slow and +400ms weaken duration per rank; +8px
                      radius every 3rd rank (not damage — it deals none and
                      should not start)
--- identity ---
ENGINE:               neutral
COST:                 zero damage on a ten-second cooldown, and it is not
                      even on the non-damaging list, which is a
                      classification quirk rather than a hidden number. What
                      it buys is two and a half seconds of a slower room
VISUAL:               a single syllable, visible as a ring of displaced air;
                      every enemy in the radius flinches at the same instant
FLAVOR:               One word. He will not tell anyone which one, and the
                      people who have heard it clearly have not been able to
                      repeat it afterward.

SKILL NAME:           Judgment Ray
CLASS / TREE / TIER:  priest / Judgment / tier_code 4
TYPE:                 channel
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                beam
RANGE:                range medium (320px)
TARGETS:              1 (locks nearest)
--- output ---
DAMAGE TIER:          low (9 per tick)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               does NOT break on movement (ruling 6); 60% tick rate
                      while moving; breaks on target death or leaving range
DOT:                  9 per 400ms for up to 4000ms
AFFECTS:              enemies
--- automation ---
TRIGGER:              LOWEST_HP_ENEMY within 320px
THREAT:               some
--- growth ---
RANK ADDS:            +2 damage per tick; +500ms maximum duration every 4th
                      rank
--- identity ---
ENGINE:               neutral
COST:                 the shortest channel in the game — four seconds, ninety
                      total damage, on a twelve-second cooldown. It is the
                      Priest's most efficient single-target output and it
                      still loses to a Necromancer's beam by a factor of
                      three
VISUAL:               a narrow shaft descending from above onto the target,
                      moving as the target moves, the floor beneath it
                      bleached
FLAVOR:               It comes from above and he has stopped claiming to
                      know from how far above, or from whom, or on whose
                      authority he is permitted to point it.

SKILL NAME:           Sanctified Ground
CLASS / TREE / TIER:  priest / Judgment / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (r140, persistent 5000ms)
RANGE:                melee long (140px)
TARGETS:              uncapped — heals friendlies, damages nothing
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  heals 4 per 1000ms for 5000ms to allies and summons
                      standing in it
AFFECTS:              allies + own summons + self
--- automation ---
TRIGGER:              COOLDOWN_READY when 2+ friendlies are below 75% within
                      140px
THREAT:               none
--- growth ---
RANK ADDS:            +1 heal per tick per rank; +1s duration every 4th rank
--- identity ---
ENGINE:               feeds — a small steady Conviction drip
COST:                 a healing field in the damage tree, which means it
                      competes for slots against the things the player took
                      this tree to get. It is also short — five seconds — so
                      it needs the group to already be standing together
VISUAL:               a pale ring burnt into the floor, the ground inside it
                      subtly cleaner than the ground outside
FLAVOR:               Ground is not holy. Ground is ground. What he does is
                      more like an assertion, loudly and repeatedly made,
                      that this particular patch of it is going to behave.

SKILL NAME:           Vanquisher's Zeal
CLASS / TREE / TIER:  priest / Judgment / tier_code 6
TYPE:                 active
AXIS POSITION:        7 (of 10)
--- delivery ---
CAST:                 melee
SHAPE:                multi-target (uncapped circle r60)
RANGE:                melee short (60px)
TARGETS:              cap 4
--- output ---
DAMAGE TIER:          medium (22) — 44 against stunned or slowed targets
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               doubles to 44 per target that is currently STUNNED or
                      SLOWED — resolved per-target, correctly
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              CROWD_THRESHOLD (3+ within 60px), gated to prefer
                      firing when at least 2 of them are slowed or stunned
THREAT:               some
--- growth ---
RANK ADDS:            +4 base damage (the ×2 does not scale, so a rank-10
                      Zeal hits slowed targets for 124)
--- identity ---
ENGINE:               neutral
COST:                 sixty pixels, the shortest reach in the class, and its
                      doubling requires a setup skill in another slot. Word
                      of Power and Zeal together are two slots that only
                      work as a pair, and neither is much on its own
VISUAL:               a fast flurry of short strikes; against a slowed enemy
                      the final one lands with a white flash
FLAVOR:               He is not fast. He has simply noticed that a thing
                      which cannot move properly has already lost, and that
                      the remainder is arithmetic.

SKILL NAME:           Vanquishing Light
CLASS / TREE / TIER:  priest / Judgment / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target (nearest)
RANGE:                range medium (320px)
TARGETS:              1
--- output ---
DAMAGE TIER:          low (18)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               drain — heals the Priest for 60% of damage dealt
DOT:                  none
AFFECTS:              enemies + self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (70%), falling back to
                      NEAREST_IN_RANGE at full health
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage (the 60% drain ratio does not scale, so the
                      heal grows automatically)
--- identity ---
ENGINE:               feeds — the heal counts as healing delivered, +1
                      Conviction per 10 restored
COST:                 eighteen damage means roughly eleven health back. It is
                      the only self-heal in the Rebuke tree and it is barely
                      a self-heal; a Priest relying on it is a Priest who
                      should have taken Grace
VISUAL:               a lance of light that leaves a thread behind it, the
                      thread reeling back into his chest
FLAVOR:               What he takes back is not theirs and was never his. He
                      is moving it, and he has become very calm about the
                      question of whose it was to move.

SKILL NAME:           Righteous Fury
CLASS / TREE / TIER:  priest / Judgment / tier_code 8
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               timed 8000ms — attackSpeedMult +0.25, damageMult +0.15
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (6+ within 300px)
THREAT:               none
--- growth ---
RANK ADDS:            +5% attack speed and +3% damage multiplier per rank
--- identity ---
ENGINE:               neutral
COST:                 it is Divine Wrath again, six tiers later, with a
                      smaller damage bonus and a speed component bolted on.
                      A Rebuke Priest who slots both is spending two of eight
                      slots on overlapping windows that do not stack cleanly
VISUAL:               his movements lose their deliberateness; the light he
                      throws gets ragged at the edges
FLAVOR:               Righteous is doing a great deal of work in that name
                      and he is aware of it.

SKILL NAME:           Divine Judgment
CLASS / TREE / TIER:  priest / Judgment / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                multi-target (circle r90 at nearest)
RANGE:                range medium (300px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          high (50)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               weaken 30% for 6000ms
DOT:                  none
AFFECTS:              enemies
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 300px, gated on 40 Conviction
                      and a minimum of 5 enemies in the r90 circle
THREAT:               high
--- growth ---
RANK ADDS:            +8 damage; +6px radius every 3rd rank; +500ms weaken
                      every 4th rank
--- identity ---
ENGINE:               consumes 40 Conviction
COST:                 forty-five seconds and forty Conviction, on a class
                      that spends its Conviction keeping people alive. Every
                      Divine Judgment is a Divine Intervention not cast, and
                      that is the Priest's actual decision in this game
VISUAL:               the column arrives without a windup, wider than it
                      should be, and the light stays in the air afterward
                      like an afterimage that will not clear
FLAVOR:               He has read the accounts. He knows what the winged
                      ones called judgment and what it looked like from
                      underneath. He uses the word anyway, and he uses it
                      carefully, and he has begun using it about them.

---

## TREE: GRACE

Role read: **the restoration spec.** Sustained healing, cleanses, an escape,
and the class's only untargetable window. Where Light protects with objects,
Grace protects with maintenance. It is also the tree that fixes the
Priest's own problems — Forgiveness's Embrace is the only cleanse in the
class and Ascendance is the only escape.

---

SKILL NAME:           Sanctified Burst
CLASS / TREE / TIER:  priest / Grace / tier_code 0
TYPE:                 active
AXIS POSITION:        1 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (circle r130 on caster)
RANGE:                melee long (130px)
TARGETS:              uncapped in area (identity skill — breadth is the point)
--- output ---
DAMAGE TIER:          low (16)
PACE:                 fast (1200ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               heals 12 to the Priest and every friendly in r130 in
                      the same cast
DOT:                  none
AFFECTS:              enemies + allies + own summons + self
--- automation ---
TRIGGER:              CROWD_THRESHOLD (3+ within 130px)
THREAT:               some
--- growth ---
RANK ADDS:            +3 damage and +3 heal per rank
--- identity ---
ENGINE:               feeds — it heals every three seconds, forever, which
                      makes it the class's Conviction baseline. A Priest with
                      this slotted always has fuel
COST:                 it damages and heals in the same 130px circle, so it
                      wants the Priest standing in the swarm to get value
                      from either half. The best healing tick in the class
                      is available only from the worst position
VISUAL:               a soft outward pulse that is warm on one side of the
                      contact and hard on the other — friendlies brighten,
                      enemies scorch
FLAVOR:               The same light. It has always been the same light. He
                      finds it useful that it knows the difference and has
                      chosen not to examine how.

SKILL NAME:           Words of Grace
CLASS / TREE / TIER:  priest / Grace / tier_code 1
TYPE:                 buff
AXIS POSITION:        2 (of 10)
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
RIDERS:               timed 8000ms — regenPerSec 8
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (75%)
THREAT:               none
--- growth ---
RANK ADDS:            +2 regen per second per rank; +400ms duration every
                      4th rank
--- identity ---
ENGINE:               feeds — self-healing counts, +1 Conviction per 10
                      restored
COST:                 sixty-four health over eight seconds is a slow answer
                      to a fast problem. It cannot save him from a burst; it
                      can only pay back the last one, and only if there is
                      not another
VISUAL:               a faint steady glow at the sternum, brightening
                      slightly with each tick
FLAVOR:               He talks to himself while he works. Everyone does.
                      His has simply started having measurable effects and
                      he has decided not to be strange about it.

SKILL NAME:           Forgiveness's Embrace
CLASS / TREE / TIER:  priest / Grace / tier_code 2
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
RIDERS:               strips EVERY affliction on the Priest at once — DoT
                      stacks, slows, weakens, slowFactor reset. The only
                      cleanse in the class
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              ON_DAMAGE_TAKEN, gated to fire only when carrying 2+
                      afflictions or any DoT stack above half its ceiling
THREAT:               none
--- growth ---
RANK ADDS:            −600ms cooldown per rank, floor 5000ms; at rank 6 it
                      also cleanses the nearest ally or summon, +1 additional
                      friendly every 6 ranks (not damage)
--- identity ---
ENGINE:               neutral
COST:                 it does nothing at all in a room with no debuffs, and
                      the player cannot know in advance which rooms those
                      are. It is the highest-variance slot in the class —
                      either the reason the run continued or ten seconds of
                      cooldown ticking on nothing
VISUAL:               everything clinging to him detaches at once and falls
                      away downward, like water coming off a coat
FLAVOR:               He is not absolving anyone. The gesture is identical
                      and he has noticed that too, and he has decided that
                      the identity of the gesture is the point rather than
                      a coincidence.

SKILL NAME:           Divine Benediction
CLASS / TREE / TIER:  priest / Grace / tier_code 3
TYPE:                 buff
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
RIDERS:               timed 10000ms — damageMult +0.10, regenPerSec 6
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              COOLDOWN_READY (fires on cooldown; a maintenance buff)
THREAT:               none
--- growth ---
RANK ADDS:            +2% damage multiplier and +1.5 regen per second per
                      rank
--- identity ---
ENGINE:               feeds — sixty health per cast is +6 Conviction, every
                      twenty seconds, reliably
COST:                 it does two things adequately and neither of them well.
                      Words of Grace out-heals it and Divine Wrath out-damages
                      it, and both are cheaper tiers. Its case is that it is
                      up half the time and asks nothing
VISUAL:               a slow-turning ring of small script at shoulder height,
                      readable if you look but never in one place long enough
FLAVOR:               A blessing is a sentence with a duration. He has spent
                      thirty years learning to make the sentences longer and
                      is not certain this counts as progress.

SKILL NAME:           Beacon of Light
CLASS / TREE / TIER:  priest / Grace / tier_code 4
TYPE:                 active
AXIS POSITION:        5 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                beam (standing dual beam, 260×60, 4000ms)
RANGE:                range medium (260px)
TARGETS:              uncapped along both beams
--- output ---
DAMAGE TIER:          low (6 per 400ms tick)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               heals 5 per 400ms tick to every friendly standing in
                      the beams, the Priest included — the only skill in the
                      class that damages and heals continuously at once
DOT:                  6 per 400ms to enemies crossing the beams, 4000ms
AFFECTS:              enemies + allies + own summons + self
--- automation ---
TRIGGER:              DENSEST_CLUSTER within 260px — beams oriented across
                      the cluster's long axis
THREAT:               some
--- growth ---
RANK ADDS:            +1 damage and +1 heal per tick per rank; +1s duration
                      every 4th rank
--- identity ---
ENGINE:               feeds strongly — ten heal ticks per second across every
                      friendly in the beams is the fastest Conviction
                      generation in the class
COST:                 it is a stationary line in a game about movement, and
                      it wants the Priest standing in his own beam to get the
                      healing half. Four seconds is not long enough for the
                      swarm to walk into it if the placement is wrong
VISUAL:               two crossed shafts standing upright in the floor,
                      slowly rotating about their intersection, humming
FLAVOR:               A beacon is not for seeing by. It is for being seen
                      from, by someone who is lost and has not yet admitted
                      it.

SKILL NAME:           Divine Renewal
CLASS / TREE / TIER:  priest / Grace / tier_code 5
TYPE:                 active
AXIS POSITION:        6 (of 10)
--- delivery ---
CAST:                 instant-at-range
SHAPE:                single target
RANGE:                range long (400px)
TARGETS:              1 — the most-injured ally (co-op) or summon (solo)
--- output ---
DAMAGE TIER:          none (0)
PACE:                 slow (4000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               heals 60; COSTS the Priest 25 HP. The code already
                      refuses this below 25 HP; ruling 4 raises the floor to
                      35% of maximum
DOT:                  none
AFFECTS:              allies + own summons
--- automation ---
TRIGGER:              ALLY_HP_BELOW_X (45%)
THREAT:               none
--- growth ---
RANK ADDS:            +12 heal per rank. The 25 HP cost does not scale — at
                      rank 10 he trades 25 of his for 180 of theirs
--- identity ---
ENGINE:               feeds hard — the HP spend is +15 Conviction and the
                      60-point heal is another +6
COST:                 the transfer is unfavourable at rank 1 and becomes the
                      best healing in the game by rank 8, which makes this
                      the single strongest argument in the class for
                      concentrating ranks rather than spreading them
VISUAL:               a line of light between them that runs the wrong way
                      first — from the Priest, briefly, before it reverses
FLAVOR:               Renewal is the wrong word and he chose it deliberately.
                      Nothing is renewed. Something is moved from a person
                      who can currently spare it to a person who cannot.

SKILL NAME:           Prophetic Vision
CLASS / TREE / TIER:  priest / Grace / tier_code 6
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
RIDERS:               stat mods: blockChance +0.12, blockReduction 0.50
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              always-on (no trigger; occupies a slot)
THREAT:               none
--- growth ---
RANK ADDS:            +3% block chance per rank; +2% block reduction per
                      rank, ceiling 80% (not damage)
--- identity ---
ENGINE:               feeds slightly — blocked hits still count as hits taken
                      for the +2
COST:                 twelve percent of half of the damage is a very small
                      number, and it is the only defensive passive the entire
                      class owns. It is the tier-7 slot of the healing tree
                      and it is nearly a rounding error at rank 1
VISUAL:               a half-second before an incoming blow, a faint
                      afterimage of it appears; sometimes he moves, sometimes
                      he does not
FLAVOR:               He sees it slightly before it happens. Not far enough
                      before to be useful, most of the time, and just far
                      enough to have to watch.

SKILL NAME:           Hymn of Mending
CLASS / TREE / TIER:  priest / Grace / tier_code 7
TYPE:                 active
AXIS POSITION:        8 (of 10)
--- delivery ---
CAST:                 placed
SHAPE:                ground area (r120 at caster, persistent 12000ms)
RANGE:                melee long (120px)
TARGETS:              every ally and summon in the field
--- output ---
DAMAGE TIER:          none (0)
PACE:                 very slow (8000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  heals 4 per 1000ms for 12000ms
AFFECTS:              allies + own summons
--- automation ---
TRIGGER:              COOLDOWN_READY when 2+ friendlies are below 70% within
                      120px
THREAT:               none
--- growth ---
RANK ADDS:            +1.5 heal per tick per rank; +2s duration every 4th
                      rank; +6px radius every 3rd rank
--- identity ---
ENGINE:               feeds — forty-eight health per friendly per cast, and
                      in a full co-op group that is a large Conviction block
COST:                 twelve seconds of healing in a 120px circle that does
                      not follow anyone. It is the most co-op-dependent skill
                      in the class: with three allies standing in it, it is
                      excellent, and solo with no summons it heals nobody at
                      all
VISUAL:               a low sustained chord; the field is barely visible,
                      just a slight warmth to the floor colour and motes
                      drifting upward
FLAVOR:               Mending is what you do to a thing you intend to keep
                      using. He has never once described a person as
                      irreparable and he has been given several opportunities.

SKILL NAME:           Ascendance
CLASS / TREE / TIER:  priest / Grace / tier_code 8
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
DOMAIN:               spiritual
--- effects ---
RIDERS:               UNTARGETABLE for 3000ms — enemies lose him entirely and
                      retarget — plus 15 HP/s regen for the duration
DOT:                  none
AFFECTS:              self
--- automation ---
TRIGGER:              SELF_HP_BELOW_X (35%)
THREAT:               none — it is the class's only threat drop, and in co-op
                      it dumps everything he was holding onto someone else
--- growth ---
RANK ADDS:            +3 HP/s regen per rank; +200ms duration every 3rd rank
--- identity ---
ENGINE:               feeds — 45 health over the window is +4 Conviction, and
                      surviving to keep healing is worth more than that
COST:                 in solo it is a clean escape. In co-op it is the tank's
                      worst moment: three seconds where the Priest is
                      untouchable and whatever was on him is now on the person
                      next to him. It should probably feel slightly rude
VISUAL:               he rises a few inches and goes translucent from the
                      feet upward; enemy attention visibly slides off him and
                      onto whatever is nearest
FLAVOR:               Up is not a direction he was promised. He has stopped
                      treating it as one and started treating it as an exit,
                      which he suspects is closer to what it always was.

SKILL NAME:           Grace Incarnate
CLASS / TREE / TIER:  priest / Grace / tier_code 9
TYPE:                 active
AXIS POSITION:        10 (of 10)
--- delivery ---
CAST:                 self
SHAPE:                ground area (r200, persistent 6000ms)
RANGE:                range short (200px)
TARGETS:              uncapped — every friendly in the field
--- output ---
DAMAGE TIER:          none (0)
PACE:                 capstone (25000ms)
DOMAIN:               spiritual
--- effects ---
RIDERS:               none
DOT:                  heals 6 per 700ms for 6000ms — roughly 51 per friendly
AFFECTS:              allies + own summons + self
--- automation ---
TRIGGER:              ALLY_HP_BELOW_X (40%) with 3+ friendlies hurt in radius,
                      gated on 60 Conviction
THREAT:               none
--- growth ---
RANK ADDS:            +2 heal per tick per rank; +1s duration every 4th rank;
                      +10px radius every 3rd rank
--- identity ---
ENGINE:               consumes 60 Conviction — the largest spend in the class
COST:                 fifty-five seconds and sixty Conviction, and it heals a
                      circle that has to still contain people six seconds
                      later. It is a group cooldown in a game where the group
                      is running in four directions, and the trigger
                      conditions I set are strict enough that a solo Priest
                      with two summons will rarely see it fire
VISUAL:               the field does not glow so much as everything inside it
                      becomes very slightly more present — colours truer,
                      edges cleaner, wounds visibly closing
FLAVOR:               He has stopped praying before he does this. Not out of
                      doubt, exactly. Out of a growing suspicion that the
                      part of it that works has never had anything to do with
                      the asking.
